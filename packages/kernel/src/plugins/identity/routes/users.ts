import type { FastifyInstance } from 'fastify'
import type { IdentityServiceImpl } from '../identity-service.js'
import type { IdentityId } from '../types.js'

interface RouteDeps {
  service: IdentityServiceImpl
  tokenStore: { getUserId(tokenId: string): string | undefined } | undefined
}

/**
 * Registers identity user routes under the plugin's prefix (e.g. /api/v1/identity).
 *
 * All routes require auth (enforced by the parent registerPlugin call).
 * The /users/me and /resolve/:identityId routes bridge the JWT token identity
 * to the canonical user record stored by the identity service.
 */
export function registerIdentityRoutes(app: FastifyInstance, deps: RouteDeps): void {
  const { service, tokenStore } = deps

  // Resolves the caller's userId from the JWT token via the token-store mapping.
  // Returns undefined if the token has not been associated with an identity yet.
  function resolveUserId(request: any): string | undefined {
    return tokenStore?.getUserId?.(request.auth?.tokenId)
  }

  // GET /users — list users with optional filters
  app.get('/users', async (request) => {
    const { source, role, q } = request.query as any
    if (q) return service.searchUsers(q as string)
    return service.listUsers({ source: source as string | undefined, role: role as any })
  })

  // GET /users/me — own profile (must be declared BEFORE /:userId to avoid shadowing)
  app.get('/users/me', async (request, reply) => {
    const userId = resolveUserId(request)
    if (!userId) return reply.status(403).send({ error: 'Identity not set up' })
    const user = await service.getUser(userId)
    if (!user) return reply.status(404).send({ error: 'User not found' })
    return user
  })

  // PUT /users/me — update own profile fields
  app.put('/users/me', async (request, reply) => {
    const userId = resolveUserId(request)
    if (!userId) {
      return reply.status(403).send({ error: 'Identity not set up. Call POST /identity/setup first.' })
    }
    const body = request.body as any
    return service.updateUser(userId, {
      displayName: body.displayName,
      username: body.username,
      avatarUrl: body.avatarUrl,
      timezone: body.timezone,
      locale: body.locale,
    })
  })

  // GET /users/:userId
  app.get('/users/:userId', async (request, reply) => {
    const { userId } = request.params as any
    const user = await service.getUser(userId as string)
    if (!user) return reply.status(404).send({ error: 'User not found' })
    return user
  })

  // PUT /users/:userId/role — admin-only role assignment
  app.put('/users/:userId/role', async (request, reply) => {
    const callerUserId = resolveUserId(request)
    if (!callerUserId) return reply.status(403).send({ error: 'Identity not set up' })
    const caller = await service.getUser(callerUserId)
    if (!caller || caller.role !== 'admin') return reply.status(403).send({ error: 'Admin only' })

    const { userId } = request.params as any
    const { role } = request.body as any
    await service.setRole(userId as string, role)
    return { ok: true }
  })

  // GET /users/:userId/identities — all platform identities for a user
  app.get('/users/:userId/identities', async (request) => {
    const { userId } = request.params as any
    return service.getIdentitiesFor(userId as string)
  })

  // GET /resolve/:identityId — look up user by platform identity ID
  app.get('/resolve/:identityId', async (request, reply) => {
    const { identityId } = request.params as any
    const user = await service.getUserByIdentity(identityId as IdentityId)
    if (!user) return reply.status(404).send({ error: 'Identity not found' })
    const identity = await service.getIdentity(identityId as IdentityId)
    return { user, identity }
  })

  // POST /link — merge two identities into a single user account (admin only)
  app.post('/link', async (request, reply) => {
    const callerUserId = resolveUserId(request)
    if (!callerUserId) return reply.status(403).send({ error: 'Identity not set up' })
    const caller = await service.getUser(callerUserId)
    if (!caller || caller.role !== 'admin') return reply.status(403).send({ error: 'Admin only' })

    const { identityIdA, identityIdB } = request.body as any
    await service.link(identityIdA as IdentityId, identityIdB as IdentityId)
    return { ok: true }
  })

  // POST /unlink — split an identity off into its own user account (admin only)
  app.post('/unlink', async (request, reply) => {
    const callerUserId = resolveUserId(request)
    if (!callerUserId) return reply.status(403).send({ error: 'Identity not set up' })
    const caller = await service.getUser(callerUserId)
    if (!caller || caller.role !== 'admin') return reply.status(403).send({ error: 'Admin only' })

    const { identityId } = request.body as any
    await service.unlink(identityId as IdentityId)
    return { ok: true }
  })

  // GET /search — search users by display name or username
  app.get('/search', async (request) => {
    const { q } = request.query as any
    if (!q) return []
    return service.searchUsers(q as string)
  })
}
