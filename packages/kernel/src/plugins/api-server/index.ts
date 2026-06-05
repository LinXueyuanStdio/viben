import * as fs from 'node:fs'
import * as crypto from 'node:crypto'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { VibenPlugin, InstallContext } from '../../core/plugin/types.js'
import type { VibenCore } from '../../core/core.js'
import { BusEvent } from '../../core/events.js'
import type { TopicManager } from '../telegram/topic-manager.js'
import type { CommandRegistry } from '../../core/command-registry.js'
import type { ContextManager } from '../context/context-manager.js'
import type { ApiServerInstance } from './server.js'
import type { RouteDeps } from './routes/types.js'
import { createChildLogger } from '../../core/utils/log.js'

const log = createChildLogger({ module: 'api-server' })

// ─── Utilities extracted from the old ApiServer class ──────────────────────

let cachedVersion: string | undefined

/** Reads the package.json version once and caches it for the lifetime of the process. */
function getVersion(): string {
  if (cachedVersion) return cachedVersion
  try {
    const __filename = fileURLToPath(import.meta.url)
    const pkgPath = path.resolve(path.dirname(__filename), '../../../package.json')
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
    cachedVersion = pkg.version ?? '0.0.0-dev'
  } catch {
    cachedVersion = '0.0.0-dev'
  }
  return cachedVersion!
}

/**
 * Loads a secret from disk, or generates a new one and persists it with mode 0600.
 *
 * Used for both the raw API secret and the JWT signing secret. The file is created
 * with restrictive permissions on first run; subsequent starts re-use the existing value
 * so secrets survive restarts. An SSH-style warning is logged if the file permissions
 * are too open (group/other readable), which can happen if the user copied the file.
 */
function loadOrCreateSecret(secretFilePath: string): string {
  const dir = path.dirname(secretFilePath)
  fs.mkdirSync(dir, { recursive: true })

  try {
    const existing = fs.readFileSync(secretFilePath, 'utf-8').trim()
    if (existing) {
      // Warn if file permissions are too open (like SSH does for private keys)
      try {
        const stat = fs.statSync(secretFilePath)
        const mode = stat.mode & 0o777
        if (mode & 0o077) {
          log.warn(
            { path: secretFilePath, mode: '0' + mode.toString(8) },
            'API secret file has insecure permissions (should be 0600). Run: chmod 600 %s',
            secretFilePath,
          )
        }
      } catch {
        /* stat failed, skip check */
      }
      return existing
    }
  } catch {
    // File doesn't exist, create it
  }

  const secret = crypto.randomBytes(32).toString('hex')
  fs.writeFileSync(secretFilePath, secret, { mode: 0o600 })
  return secret
}

/**
 * Writes the actual listening port to `<instanceRoot>/api.port`.
 *
 * The CLI reads this file to locate the running server when the user runs
 * `viben` commands against a daemonized instance.
 */
function writePortFile(portFilePath: string, port: number): void {
  const dir = path.dirname(portFilePath)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(portFilePath, String(port))
}

/** Removes the port file on shutdown so stale files don't mislead CLI auto-discovery. */
function removePortFile(portFilePath: string): void {
  try {
    fs.unlinkSync(portFilePath)
  } catch {
    /* ignore */
  }
}

// ─── ApiConfig interface (replaces the one from deleted api-server.ts) ─────

export interface ApiConfig {
  port: number
  host: string
}

// ─── Plugin Definition ─────────────────────────────────────────────────────

/**
 * Creates the `@viben/api-server` plugin.
 *
 * This plugin wires together:
 * - A Fastify HTTP server with JWT auth, rate limiting, and Swagger docs
 * - REST route groups for sessions, agents, config, system, auth, plugins, topics, tunnel, etc.
 * - An SSE manager that relays EventBus events to connected App clients in real time
 * - Static file serving for the bundled Viben App dashboard
 * - An `api-server` service registered in ServiceRegistry for other plugins to extend
 *
 * Startup is deferred to the `SYSTEM_READY` event so all other plugins are fully
 * booted before the server accepts connections.
 */
function createApiServerPlugin(): VibenPlugin {
  let server: ApiServerInstance | null = null
  let portFilePath = ''
  let actualPort = 0
  let cleanupInterval: ReturnType<typeof setInterval> | null = null
  let tokenStoreRef: import('./auth/token-store.js').TokenStore | null = null
  let sseManagerRef: import('./sse-manager.js').SSEManager | null = null

  return {
    name: '@viben/api-server',
    version: '1.0.0',
    description: 'REST API + SSE streaming server',
    essential: false,
    permissions: ['services:register', 'services:use', 'kernel:access', 'commands:register', 'events:read', 'events:emit'],

    async install(ctx: InstallContext) {
      const { settings, terminal } = ctx

      // Save defaults
      await settings.setAll({
        port: 21420,
        host: '127.0.0.1',
      })
      terminal.log.success('API server defaults saved')
    },

    async configure(ctx: InstallContext) {
      const { terminal, settings } = ctx
      const current = await settings.getAll()

      const choice = await terminal.select({
        message: 'What to configure?',
        options: [
          { value: 'port', label: `Change port (current: ${current.port ?? 21420})` },
          { value: 'host', label: `Change host (current: ${current.host ?? '127.0.0.1'})` },
          { value: 'done', label: 'Done' },
        ],
      })

      if (choice === 'port') {
        const val = await terminal.text({
          message: 'API port:',
          defaultValue: String(current.port ?? 21420),
          validate: (v) => {
            const n = Number(v.trim())
            if (isNaN(n) || n < 1 || n > 65535) return 'Port must be 1-65535'
            return undefined
          },
        })
        await settings.set('port', Number(val.trim()))
        terminal.log.success('Port updated')
      } else if (choice === 'host') {
        const val = await terminal.text({
          message: 'API host:',
          defaultValue: (current.host as string) ?? '127.0.0.1',
        })
        await settings.set('host', val.trim())
        terminal.log.success('Host updated')
      }
    },

    async uninstall(ctx: InstallContext, opts: { purge: boolean }) {
      if (opts.purge) {
        await ctx.settings.clear()
        ctx.terminal.log.success('API server settings cleared')
      }
    },

    inheritableKeys: ['host'],

    async setup(ctx) {
      ctx.registerEditableFields([
        { key: 'port', displayName: 'API Port', type: 'number', scope: 'safe', hotReload: false },
      ])

      const config = ctx.pluginConfig as Record<string, unknown>
      const instanceRoot = ctx.instanceRoot
      const core = ctx.core as VibenCore

      const apiConfig: ApiConfig = {
        port: (config.port as number) ?? 21420,
        host: (config.host as string) ?? '127.0.0.1',
      }

      log.info(
        { port: apiConfig.port, host: apiConfig.host, instanceRoot },
        'API server plugin setup — config loaded',
      )

      portFilePath = path.join(instanceRoot, 'api.port')
      const secretFilePath = path.join(instanceRoot, 'api-secret')
      const jwtSecretFilePath = path.join(instanceRoot, 'jwt-secret')
      const tokensFilePath = path.join(instanceRoot, 'tokens.json')
      const startedAt = Date.now()

      // Load or create the API secret
      const secret = loadOrCreateSecret(secretFilePath)

      // Load or create the JWT signing secret
      const jwtSecret = loadOrCreateSecret(jwtSecretFilePath)

      // Load token store
      const { TokenStore } = await import('./auth/token-store.js')
      const tokenStore = new TokenStore(tokensFilePath)
      await tokenStore.load()
      tokenStoreRef = tokenStore

      // Expose tokenStore as a service so other plugins (e.g. identity) can associate
      // their user IDs with tokens without a direct import dependency.
      ctx.registerService('token-store', tokenStore)

      // Lazy import to avoid loading Fastify unless needed
      const { createApiServer } = await import('./server.js')
      const { SSEManager } = await import('./sse-manager.js')
      const { StaticServer } = await import('./static-server.js')
      const { createApiServerService } = await import('./service.js')
      const { createAuthPreHandler } = await import('./middleware/auth.js')

      // Route plugins
      const { sessionRoutes } = await import('./routes/sessions.js')
      const { agentRoutes } = await import('./routes/agents.js')
      const { configRoutes } = await import('./routes/config.js')
      const { systemRoutes } = await import('./routes/health.js')
      const { topicRoutes } = await import('./routes/topics.js')
      const { tunnelRoutes } = await import('./routes/tunnel.js')
      const { notifyRoutes } = await import('./routes/notify.js')
      const { commandRoutes } = await import('./routes/commands.js')
      const { authRoutes } = await import('./routes/auth.js')
      const { workspaceRoute } = await import('./routes/workspace.js')
      const { pluginRoutes } = await import('./routes/plugins.js')

      // Create Fastify server
      server = await createApiServer({
        port: apiConfig.port,
        host: apiConfig.host,
        getSecret: () => secret,
        getJwtSecret: () => jwtSecret,
        tokenStore,
      })

      // Resolve optional services for route deps
      const topicManager = ctx.getService<TopicManager>('topic-manager')
      const commandRegistry = ctx.getService<CommandRegistry>('command-registry')
      const contextManager = ctx.getService<ContextManager>('context')

      // Build auth pre-handler for route-level auth on unauthenticated route groups
      const routeAuthPreHandler = createAuthPreHandler(() => secret, () => jwtSecret, tokenStore)

      // Resolve instance ID from registry — used in health response for instance verification
      const { InstanceRegistry } = await import('../../core/instance/instance-registry.js')
      const { getGlobalRoot } = await import('../../core/instance/instance-context.js')
      const globalRoot = getGlobalRoot()
      const instanceReg = new InstanceRegistry(path.join(globalRoot, 'instances.json'))
      instanceReg.load()
      const instanceEntry = instanceReg.getByRoot(instanceRoot)
      const workspaceId = instanceEntry?.id ?? 'main'

      const deps: RouteDeps = {
        core,
        topicManager,
        startedAt,
        getVersion,
        instanceId: workspaceId,
        commandRegistry,
        authPreHandler: routeAuthPreHandler,
        contextManager,
        lifecycleManager: core.lifecycleManager,
      }

      // Register all route plugins under /api/v1/
      server.registerPlugin('/api/v1/sessions', async (app) => sessionRoutes(app, deps))
      server.registerPlugin('/api/v1/agents', async (app) => agentRoutes(app, deps))
      server.registerPlugin('/api/v1/config', async (app) => configRoutes(app, deps))
      server.registerPlugin('/api/v1/system', async (app) => systemRoutes(app, deps), { auth: false })
      server.registerPlugin('/api/v1/topics', async (app) => topicRoutes(app, deps))
      server.registerPlugin('/api/v1/tunnel', async (app) => tunnelRoutes(app, deps))
      server.registerPlugin('/api/v1/notify', async (app) => notifyRoutes(app, deps))
      server.registerPlugin('/api/v1/commands', async (app) => commandRoutes(app, deps))
      server.registerPlugin('/api/v1/auth', async (app) => authRoutes(app, {
        tokenStore,
        getJwtSecret: () => jwtSecret,
        // Lazy resolver: identity plugin may not be loaded, so we fetch it on demand
        getIdentityService: () => ctx.getService<{ getUser(userId: string): Promise<{ displayName: string } | undefined> }>('identity') ?? undefined,
      }))
      server.registerPlugin('/api/v1/plugins', async (app) => pluginRoutes(app, deps))
      const appConfig = core.configManager.get()
      const workspaceName = (appConfig as Record<string, unknown>).instanceName as string ?? 'Main'
      const workspaceDir = path.dirname(instanceRoot)
      server.registerPlugin('/api/v1', async (app) => {
        await app.register(workspaceRoute, {
          id: workspaceId,
          name: workspaceName,
          directory: workspaceDir,
          version: getVersion(),
        })
      })

      // Exchange endpoint — NO auth. The one-time code in the request body IS the
      // credential; adding Bearer auth here would require the caller to already have a
      // token, defeating the purpose. Fastify encapsulation makes dual registerPlugin
      // on the same prefix safe — each call creates an independent scope with its own hooks.
      server.registerPlugin('/api/v1/auth', async (app) => {
        const { ExchangeCodeBodySchema } = await import('./schemas/auth.js')
        const { signToken } = await import('./auth/jwt.js')
        const { parseDuration } = await import('./auth/token-store.js')
        const { AuthError } = await import('./middleware/error-handler.js')

        app.post('/exchange', {
          config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
        }, async (request, reply) => {
          const body = ExchangeCodeBodySchema.parse(request.body)
          const code = tokenStore.exchangeCode(body.code)
          if (!code) {
            throw new AuthError('INVALID_CODE', 'Code is invalid, expired, or already used', 401)
          }
          const token = tokenStore.create({
            role: code.role,
            name: code.name,
            expire: code.expire,
            scopes: code.scopes,
          })
          const rfd = new Date(token.refreshDeadline).getTime() / 1000
          const accessToken = signToken(
            { sub: token.id, role: token.role, scopes: token.scopes, rfd },
            jwtSecret,
            code.expire,
          )
          return reply.send({
            accessToken,
            tokenId: token.id,
            expiresAt: new Date(Date.now() + parseDuration(code.expire)).toISOString(),
            refreshDeadline: token.refreshDeadline,
            identitySecret: token.identitySecret,
          })
        })
      }, { auth: false })

      // SSE manager
      const sseManager = (sseManagerRef = new SSEManager(
        core.eventBus,
        () => {
          const sessions = core.sessionManager.listSessions()
          return {
            active: sessions.filter(
              (s) => s.status === 'active' || s.status === 'initializing',
            ).length,
            total: sessions.length,
          }
        },
        startedAt,
      ))

      // Register SSE route with auth (supports both Bearer header and ?token= query param)
      server.registerPlugin('/api/v1/events', async (app) => {
        app.get('/', sseManager.createFastifyHandler())
      })

      // Static file serving (UI dashboard)
      const staticServer = new StaticServer()
      if (staticServer.isAvailable()) {
        // Catch-all for non-API routes — serves the UI dashboard
        server.app.setNotFoundHandler((request, reply) => {
          // Only serve static files for non-API routes
          if (request.url.startsWith('/api/')) {
            reply.status(404).send({ error: 'Not found' })
            return
          }
          // Hijack reply so Fastify doesn't interfere with the raw pipe
          reply.hijack()
          if (!staticServer.serve(request.raw, reply.raw)) {
            reply.raw.writeHead(404, { 'Content-Type': 'application/json' })
            reply.raw.end(JSON.stringify({ error: 'Not found' }))
          }
        })
      }

      // Build auth pre-handler for the service
      const authPreHandler = createAuthPreHandler(() => secret, () => jwtSecret, tokenStore)

      // Create and register the ApiServerService
      const apiService = createApiServerService(
        server,
        () => actualPort,
        () => `http://${apiConfig.host}:${actualPort}`,
        () => {
          const tunnel = core.tunnelService
          return tunnel ? tunnel.getPublicUrl() : null
        },
        authPreHandler,
      )

      ctx.registerService('api-server', apiService)

      // Periodic token cleanup (every hour)
      cleanupInterval = setInterval(() => tokenStore.cleanup(), 60 * 60 * 1000)

      // Start on system:ready
      ctx.on(BusEvent.SYSTEM_READY, async () => {
        log.info(
          { configPort: apiConfig.port, configHost: apiConfig.host },
          'API server starting...',
        )
        try {
          const addr = await server!.start()
          actualPort = addr.port

          writePortFile(portFilePath, actualPort)
          sseManager.setup()

          log.info(
            { host: addr.host, port: addr.port, portFile: portFilePath },
            'API server listening on http://%s:%d',
            addr.host,
            addr.port,
          )

          if (apiConfig.host !== '127.0.0.1' && apiConfig.host !== 'localhost') {
            log.warn(
              'API server binding to non-localhost. Ensure api-secret file is secured.',
            )
          }

          ctx.emit('api-server:started', { port: actualPort })
        } catch (err) {
          log.error({ err, configPort: apiConfig.port, configHost: apiConfig.host }, 'API server failed to start')
        }
      })
    },

    async teardown() {
      if (cleanupInterval) {
        clearInterval(cleanupInterval)
        cleanupInterval = null
      }
      if (tokenStoreRef) {
        tokenStoreRef.destroy()
        tokenStoreRef = null
      }
      if (sseManagerRef) {
        sseManagerRef.stop()
        sseManagerRef = null
      }
      if (server) {
        await server.stop()
        server = null
      }
      removePortFile(portFilePath)
    },
  }
}

export default createApiServerPlugin()
