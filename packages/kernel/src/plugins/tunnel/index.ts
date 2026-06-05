import path from 'node:path'
import type { VibenPlugin, InstallContext } from '../../core/plugin/types.js'
import type { TunnelConfig } from './tunnel-service.js'
import type { ApiServerService } from '../api-server/service.js'
import { MAX_RETRIES } from './tunnel-registry.js'
import { createViewerRoutes } from './viewer-routes.js'

/**
 * Tunnel plugin — exposes the local API server to the internet via a tunnel provider.
 *
 * Setup starts the system tunnel when the API server emits `api-server:started`,
 * then registers viewer routes so agents can share file/diff/output content via
 * public URLs. Also registers `/tunnel` and `/tunnels` chat commands for managing
 * additional user-created tunnels.
 *
 * The `cloudflare` provider is auto-migrated to `viben` on startup for users
 * who configured it before the managed tunnel was introduced.
 */
function createTunnelPlugin(): VibenPlugin {
  let service: { stop(): Promise<void> } | null = null

  return {
    name: '@viben/tunnel',
    version: '1.0.0',
    description: 'Expose local services to internet via tunnel providers',
    essential: false,
    pluginDependencies: { '@viben/api-server': '*' },
    permissions: ['services:register', 'services:use', 'kernel:access', 'commands:register', 'events:read', 'events:emit', 'storage:read', 'storage:write'],

    async install(ctx: InstallContext) {
      const { terminal, settings } = ctx

      // Interactive setup
      const provider = await terminal.select({
        message: 'Tunnel provider:',
        options: [
          { value: 'viben', label: 'Viben Managed', hint: 'Recommended — stable URL, no account needed' },
          { value: 'cloudflare', label: 'Cloudflare quick tunnel', hint: 'Rate-limited, random URL' },
          { value: 'ngrok', label: 'ngrok', hint: 'Requires auth token' },
          { value: 'bore', label: 'bore', hint: 'Self-hostable' },
          { value: 'tailscale', label: 'Tailscale Funnel' },
        ],
      })

      const portStr = await terminal.text({
        message: 'Local port to expose:',
        defaultValue: '3100',
        validate: (v) => {
          const n = Number(v.trim())
          if (isNaN(n) || n < 1 || n > 65535) return 'Port must be 1-65535'
          return undefined
        },
      })

      let authToken = ''
      if (provider === 'ngrok') {
        authToken = await terminal.text({
          message: 'ngrok auth token:',
          validate: (v) => (!v.trim() ? 'Auth token cannot be empty' : undefined),
        })
        authToken = authToken.trim()
      }

      await settings.setAll({
        enabled: true,
        provider,
        port: Number(portStr.trim()),
        options: authToken ? { authtoken: authToken } : {},
        maxUserTunnels: 5,
        storeTtlMinutes: 60,
        auth: { enabled: false },
      })
      terminal.log.success('Tunnel settings saved')
    },

    async configure(ctx: InstallContext) {
      const { terminal, settings } = ctx
      const current = await settings.getAll()

      const choice = await terminal.select({
        message: 'What to configure?',
        options: [
          { value: 'provider', label: `Change provider (current: ${current.provider ?? 'none'})` },
          { value: 'port', label: `Change port (current: ${current.port ?? 3100})` },
          { value: 'toggle', label: `${current.enabled ? 'Disable' : 'Enable'} tunnel` },
          { value: 'done', label: 'Done' },
        ],
      })

      if (choice === 'provider') {
        const provider = await terminal.select({
          message: 'Tunnel provider:',
          options: [
            { value: 'viben', label: 'Viben Managed', hint: 'Recommended' },
            { value: 'cloudflare', label: 'Cloudflare quick tunnel' },
            { value: 'ngrok', label: 'ngrok' },
            { value: 'bore', label: 'bore' },
            { value: 'tailscale', label: 'Tailscale' },
          ],
        })
        await settings.set('provider', provider)
        terminal.log.success('Provider updated')
      } else if (choice === 'port') {
        const val = await terminal.text({
          message: 'New port:',
          defaultValue: String(current.port ?? 3100),
          validate: (v) => {
            const n = Number(v.trim())
            if (isNaN(n) || n < 1 || n > 65535) return 'Port must be 1-65535'
            return undefined
          },
        })
        await settings.set('port', Number(val.trim()))
        terminal.log.success('Port updated')
      } else if (choice === 'toggle') {
        const newState = !current.enabled
        await settings.set('enabled', newState)
        terminal.log.success(`Tunnel ${newState ? 'enabled' : 'disabled'}`)
      }
    },

    async uninstall(ctx: InstallContext, opts: { purge: boolean }) {
      if (opts.purge) {
        await ctx.settings.clear()
        ctx.terminal.log.success('Tunnel settings cleared')
      }
    },

    async setup(ctx) {
      ctx.registerEditableFields([
        { key: 'enabled', displayName: 'Tunnel', type: 'toggle', scope: 'safe', hotReload: false },
        { key: 'port', displayName: 'Tunnel Port', type: 'number', scope: 'safe', hotReload: false },
        { key: 'provider', displayName: 'Provider', type: 'select', scope: 'safe', hotReload: false, options: ['viben', 'cloudflare', 'ngrok', 'bore', 'tailscale'] },
      ])

      const { default: fs } = await import('node:fs')
      const settingsPath = path.join(ctx.instanceRoot, 'plugins', 'data', ctx.pluginName, 'settings.json')

      // If no settings.json exists yet, bootstrap defaults. This replaces the old
      // inheritableKeys mechanism — plugin is now fully self-contained and does not
      // read from config.json. New installs that went through install() already have
      // settings.json; this handles any edge case where they don't.
      if (!fs.existsSync(settingsPath)) {
        const defaults = { enabled: true, provider: 'viben', maxUserTunnels: 5, auth: { enabled: false } }
        fs.mkdirSync(path.dirname(settingsPath), { recursive: true })
        fs.writeFileSync(settingsPath, JSON.stringify(defaults, null, 2))
        Object.assign(ctx.pluginConfig, defaults)
        ctx.log.info('Initialized tunnel settings with defaults (viben provider)')
      }

      const config = ctx.pluginConfig as Record<string, unknown>

      // Migrate existing cloudflare quick-tunnel users to viben managed tunnel.
      if (config.provider === 'cloudflare') {
        try {
          const current = JSON.parse(fs.readFileSync(settingsPath, 'utf-8')) as Record<string, unknown>
          current.provider = 'viben'
          fs.writeFileSync(settingsPath, JSON.stringify(current, null, 2))
        } catch (err) {
          ctx.log.warn(`Failed to migrate tunnel settings.json: ${(err as Error).message}`)
        }
        config.provider = 'viben'
        ctx.log.info('Auto-migrated tunnel provider: cloudflare → viben (Viben managed tunnel)')
      }

      // Default enabled to true — settings created via copyInstance may omit this key
      const enabled = 'enabled' in config ? config.enabled : true
      if (!enabled) {
        ctx.log.info('Tunnel disabled')
        return
      }
      if (!config.provider) {
        ctx.log.info('Tunnel disabled (no provider configured)')
        return
      }

      if (config.port) {
        ctx.log.warn('tunnel.port is deprecated and ignored — tunnel now uses API server port')
      }
      if ((config.auth as Record<string, unknown> | undefined)?.enabled) {
        ctx.log.warn('tunnel.auth is deprecated and ignored — viewer routes are now public')
      }

      const { TunnelService } = await import('./tunnel-service.js')
      const instanceRoot = ctx.instanceRoot
      const tunnelSvc = new TunnelService(
        config as unknown as TunnelConfig,
        path.join(instanceRoot, 'tunnels.json'),
        path.join(instanceRoot, 'bin'),
        ctx.storage,
        (event, data) => ctx.emit(event, data),
      )

      // Get API server service (new dependency)
      const apiServer = ctx.getService<ApiServerService>('api-server')

      // Register viewer routes in API server (replaces Hono viewer server)
      if (apiServer) {
        const viewerRoutes = createViewerRoutes(tunnelSvc.getStore())
        apiServer.registerPlugin('/', viewerRoutes, { auth: false })
      } else {
        ctx.log.warn('API server not available — viewer links will be unavailable')
      }

      // Start tunnel only after API server is actually listening
      ctx.on('api-server:started', async (data: unknown) => {
        const apiPort = (data as { port: number }).port
        const publicUrl = await tunnelSvc.start(apiPort)
        ctx.log.info(`Tunnel ready: ${publicUrl}`)
      })
      service = tunnelSvc

      ctx.registerService('tunnel', tunnelSvc)

      ctx.registerCommand({
        name: 'tunnel',
        description: 'Manage tunnels: /tunnel <port> [label] | /tunnel stop <port>',
        category: 'plugin',
        handler: async (args) => {
          const parts = args.raw.trim().split(/\s+/)

          // /tunnel stop <port>
          if (parts[0] === 'stop' && parts[1]) {
            const port = parseInt(parts[1], 10)
            if (isNaN(port)) return { type: 'error', message: 'Invalid port number' }
            try {
              await tunnelSvc.stopTunnel(port)
              return { type: 'text', text: `Tunnel on port ${port} stopped.` }
            } catch (err) {
              return { type: 'error', message: (err as Error).message }
            }
          }

          // /tunnel <port> [label]
          if (parts[0] && parts[0] !== '') {
            const port = parseInt(parts[0], 10)
            if (isNaN(port)) return { type: 'error', message: 'Invalid port number' }
            const label = parts.slice(1).join(' ') || undefined
            try {
              const entry = await tunnelSvc.addTunnel(port, { label })
              return { type: 'text', text: `Tunnel created: ${entry.publicUrl ?? 'starting...'}` }
            } catch (err) {
              return { type: 'error', message: (err as Error).message }
            }
          }

          // /tunnel (no args) — show current tunnel URL + health
          const url = tunnelSvc.getPublicUrl()
          const err = tunnelSvc.getStartError()
          let text = url ? `Tunnel: ${url}` : 'No tunnel active.'
          if (err) text += `\n⚠️ System tunnel error: ${err}`
          return { type: 'text', text }
        },
      })

      ctx.registerCommand({
        name: 'tunnels',
        description: 'List active tunnels',
        category: 'plugin',
        handler: async () => {
          const userTunnels = tunnelSvc.listTunnels()
          const systemUrl = tunnelSvc.getPublicUrl()
          const sysError = tunnelSvc.getStartError()
          const systemDetail = sysError ? `${systemUrl} ⚠️ ${sysError}` : systemUrl
          const items = [
            { label: 'System', detail: systemDetail },
            ...userTunnels.map(t => {
              const statusInfo = t.status === 'failed' && t.retryCount > 0
                ? `${t.status} (retry ${t.retryCount}/${MAX_RETRIES})`
                : t.status
              return {
                label: t.label ?? `Port ${t.port}`,
                detail: `${t.publicUrl ?? statusInfo} (${t.provider})`,
              }
            }),
          ]
          return { type: 'list', title: 'Active Tunnels', items }
        },
      })

    },

    async teardown() {
      if (service) {
        await service.stop()
      }
    },
  }
}

export default createTunnelPlugin()
