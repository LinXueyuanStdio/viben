import type { VibenPlugin } from '../../core/plugin/types.js'
import { IdentityServiceImpl } from './identity-service.js'
import { KvIdentityStore } from './store/kv-identity-store.js'
import { createAutoRegisterHandler } from './middleware/auto-register.js'
import { formatIdentityId } from './types.js'
import type { IdentityId } from './types.js'
import { Hook } from '../../core/events.js'

/**
 * Identity plugin — user identity, cross-platform linking, and role-based access.
 *
 * Boot order requirement: must come after @viben/security so that blocked users
 * are rejected (at priority 100) before we create identity records for them
 * (this middleware runs at priority 110).
 */
function createIdentityPlugin(): VibenPlugin {
  return {
    name: '@viben/identity',
    version: '1.0.0',
    description: 'User identity, cross-platform linking, and role-based access',
    essential: false,
    permissions: [
      'storage:read',
      'storage:write',
      'middleware:register',
      'services:register',
      'services:use',
      'events:emit',
      'events:read',
      'commands:register',
      'kernel:access',
    ],
    optionalPluginDependencies: {
      '@viben/api-server': '>=1.0.0',
    },

    async setup(ctx) {
      const store = new KvIdentityStore(ctx.storage)
      const service = new IdentityServiceImpl(store, (event, data) => {
        ctx.emit(event, data)
      })

      ctx.registerService('identity', service)

      // Auto-registration runs at priority 110 — after security (100) rejects blocked users
      ctx.registerMiddleware(Hook.MESSAGE_INCOMING, {
        priority: 110,
        handler: createAutoRegisterHandler(service, store),
      })

      // /whoami — lets users set their username and display name
      ctx.registerCommand({
        name: 'whoami',
        description: 'Set your username and display name',
        usage: '@username [Display Name]',
        category: 'plugin',
        async handler(args) {
          const raw = args.raw.trim()
          if (!raw) return { type: 'error', message: 'Usage: /whoami @username [Display Name]' }

          const tokens = raw.split(/\s+/)
          const first = tokens[0]

          // First token must be a username (with or without leading @)
          const usernameRaw = first.startsWith('@') ? first.slice(1) : first
          if (!/^[a-zA-Z0-9_.-]+$/.test(usernameRaw)) {
            return { type: 'error', message: 'Invalid username. Only letters, numbers, _ . - allowed.' }
          }

          const username = usernameRaw
          const displayName = tokens.slice(1).join(' ') || undefined

          const identityId = formatIdentityId(args.channelId, args.userId) as IdentityId
          const user = await service.getUserByIdentity(identityId)
          if (!user) {
            return { type: 'error', message: 'Identity not found. Send a message first.' }
          }

          try {
            await service.updateUser(user.userId, { username, ...(displayName && { displayName }) })
            const parts = [`@${username}`]
            if (displayName) parts.push(`"${displayName}"`)
            return { type: 'text', text: `✅ Profile updated: ${parts.join(' ')}` }
          } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err)
            return { type: 'error', message }
          }
        },
      })

      // Register REST routes if api-server is available.
      // Uses optional chaining so the identity plugin boots fine without api-server.
      const apiServer = ctx.getService<{ registerPlugin(prefix: string, plugin: any, opts?: any): void }>('api-server')
      if (apiServer) {
        const tokenStore = ctx.getService<{
          getUserId(id: string): string | undefined
          setUserId(id: string, uid: string): void
          getByIdentitySecret(secret: string): { id: string } | undefined
        }>('token-store')
        const { registerIdentityRoutes } = await import('./routes/users.js')
        const { registerSetupRoutes } = await import('./routes/setup.js')
        apiServer.registerPlugin('/api/v1/identity', async (app: any) => {
          registerIdentityRoutes(app, { service, tokenStore: tokenStore ?? undefined })
          registerSetupRoutes(app, { service, tokenStore: tokenStore ?? undefined })
        }, { auth: true })
      }

      ctx.log.info(`Identity service ready (${await service.getUserCount()} users)`)
    },
  }
}

export default createIdentityPlugin()
