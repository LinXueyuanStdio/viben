import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Fastify from 'fastify'
import { createApiServer } from '../../api-server/server.js'
import { TokenStore } from '../../api-server/auth/token-store.js'
import { IdentityServiceImpl } from '../identity-service.js'
import type { IdentityStore } from '../store/identity-store.js'
import type { UserRecord, IdentityRecord, IdentityId } from '../types.js'
import { signToken } from '../../api-server/auth/jwt.js'
import { registerSetupRoutes } from '../routes/setup.js'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const JWT_SECRET = 'test-jwt-secret-32charslong!!!!!'
const API_SECRET = 'a'.repeat(64)

// ─── In-memory identity store — mirrors the pattern in identity-service.test.ts ───

function createMemoryStore(): IdentityStore {
  const users = new Map<string, UserRecord>()
  const identities = new Map<string, IdentityRecord>()
  const usernameIdx = new Map<string, string>()
  const sourceIdx = new Map<string, IdentityId>()

  return {
    getUser: async (id) => users.get(id),
    putUser: async (record) => { users.set(record.userId, record) },
    deleteUser: async (id) => { users.delete(id) },
    listUsers: async (filter) => {
      let all = [...users.values()]
      if (filter?.role) all = all.filter((u) => u.role === filter.role)
      if (filter?.source) {
        all = all.filter((u) => u.identities.some((id) => id.startsWith(`${filter.source}:`)))
      }
      return all
    },
    getIdentity: async (id) => identities.get(id),
    putIdentity: async (record) => { identities.set(record.identityId, record) },
    deleteIdentity: async (id) => { identities.delete(id) },
    getIdentitiesForUser: async (userId) => {
      const user = users.get(userId)
      if (!user) return []
      return user.identities
        .map((id) => identities.get(id))
        .filter((r): r is IdentityRecord => r !== undefined)
    },
    getUserIdByUsername: async (username) => usernameIdx.get(username.toLowerCase()),
    getIdentityIdBySource: async (source, platformId) =>
      sourceIdx.get(`${source}/${platformId}`),
    setUsernameIndex: async (username, userId) => { usernameIdx.set(username.toLowerCase(), userId) },
    deleteUsernameIndex: async (username) => { usernameIdx.delete(username.toLowerCase()) },
    setSourceIndex: async (source, platformId, identityId) => {
      sourceIdx.set(`${source}/${platformId}`, identityId)
    },
    deleteSourceIndex: async (source, platformId) => {
      sourceIdx.delete(`${source}/${platformId}`)
    },
    getUserCount: async () => users.size,
  }
}

describe('POST /identity/setup', () => {
  let server: Awaited<ReturnType<typeof createApiServer>>
  let tokenStore: TokenStore
  let identityService: IdentityServiceImpl
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'identity-setup-test-'))
    const tokensFile = path.join(tmpDir, 'tokens.json')
    tokenStore = new TokenStore(tokensFile)
    await tokenStore.load()

    const memStore = createMemoryStore()
    identityService = new IdentityServiceImpl(memStore, () => {})

    server = await createApiServer({
      port: 0,
      host: '127.0.0.1',
      getSecret: () => API_SECRET,
      getJwtSecret: () => JWT_SECRET,
      tokenStore,
    })

    server.registerPlugin('/api/v1/identity', async (app) => {
      registerSetupRoutes(app, { service: identityService, tokenStore })
    })

    await server.app.ready()
  })

  afterEach(async () => {
    if (server) {
      await server.app.close()
    }
    tokenStore.destroy()
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  /** Creates a stored token and returns its JWT + the stored token record. */
  function makeToken(name: string) {
    const stored = tokenStore.create({ role: 'member', name, expire: '1h' })
    const jwt = signToken(
      { sub: stored.id, role: 'member', rfd: Date.now() / 1000 + 86400 },
      JWT_SECRET,
      '1h',
    )
    return { stored, jwt }
  }

  // ─── Path 2: identitySecret re-link ───

  it('re-links new token to existing user via identitySecret', async () => {
    // Set up: old token with a linked user
    const { stored: oldToken, jwt: _oldJwt } = makeToken('old-token')
    const { user } = await identityService.createUserWithIdentity({
      displayName: 'Alice',
      source: 'api',
      platformId: oldToken.id,
    })
    tokenStore.setUserId(oldToken.id, user.userId)

    // New token — not yet linked
    const { stored: newToken, jwt: newJwt } = makeToken('new-token')

    const response = await server.app.inject({
      method: 'POST',
      url: '/api/v1/identity/setup',
      headers: { authorization: `Bearer ${newJwt}` },
      payload: { identitySecret: oldToken.identitySecret },
    })

    expect(response.statusCode).toBe(200)
    const body = JSON.parse(response.body)
    expect(body.displayName).toBe('Alice')
    expect(body.userId).toBe(user.userId)

    // New token must now be associated with the same user
    expect(tokenStore.getUserId(newToken.id)).toBe(user.userId)
  })

  it('returns 401 for unknown identitySecret', async () => {
    const { jwt } = makeToken('any-token')

    const response = await server.app.inject({
      method: 'POST',
      url: '/api/v1/identity/setup',
      headers: { authorization: `Bearer ${jwt}` },
      payload: { identitySecret: 'deadbeefdeadbeefdeadbeefdeadbeef' },
    })

    expect(response.statusCode).toBe(401)
    const body = JSON.parse(response.body)
    expect(body.error).toMatch(/invalid identity secret/i)
  })

  it('returns 401 if matching token has no linked identity', async () => {
    // Old token exists in the store but was never used to set up an identity
    const { stored: oldToken } = makeToken('unlinked-token')
    const { jwt: newJwt } = makeToken('new-token')

    const response = await server.app.inject({
      method: 'POST',
      url: '/api/v1/identity/setup',
      headers: { authorization: `Bearer ${newJwt}` },
      payload: { identitySecret: oldToken.identitySecret },
    })

    expect(response.statusCode).toBe(401)
    const body = JSON.parse(response.body)
    expect(body.error).toMatch(/no identity linked/i)
  })

  // ─── Path 1: idempotent already-linked ───

  it('returns existing user when token is already linked (idempotent)', async () => {
    const { stored, jwt } = makeToken('already-linked')
    const { user } = await identityService.createUserWithIdentity({
      displayName: 'Bob',
      source: 'api',
      platformId: stored.id,
    })
    tokenStore.setUserId(stored.id, user.userId)

    // Calling setup again with displayName should return the existing user, not create a new one
    const response = await server.app.inject({
      method: 'POST',
      url: '/api/v1/identity/setup',
      headers: { authorization: `Bearer ${jwt}` },
      payload: { displayName: 'Bob v2' },
    })

    expect(response.statusCode).toBe(200)
    const body = JSON.parse(response.body)
    expect(body.userId).toBe(user.userId)
    expect(body.displayName).toBe('Bob') // unchanged — idempotent

    // User count must not have changed
    expect(await identityService.getUserCount()).toBe(1)
  })

  // ─── Path 4: new user ───

  it('creates a new user with displayName and username', async () => {
    const { jwt } = makeToken('new-user-token')

    const response = await server.app.inject({
      method: 'POST',
      url: '/api/v1/identity/setup',
      headers: { authorization: `Bearer ${jwt}` },
      payload: { displayName: 'Carol', username: 'carol' },
    })

    expect(response.statusCode).toBe(200)
    const body = JSON.parse(response.body)
    expect(body.displayName).toBe('Carol')
    expect(body.username).toBe('carol')
    expect(body.userId).toMatch(/^u_/)

    // username lookup must work
    const fetched = await identityService.getUserByUsername('carol')
    expect(fetched).toBeDefined()
    expect(fetched?.displayName).toBe('Carol')
  })

  it('creates a new user with displayName only (username is optional)', async () => {
    const { jwt } = makeToken('no-username-token')

    const response = await server.app.inject({
      method: 'POST',
      url: '/api/v1/identity/setup',
      headers: { authorization: `Bearer ${jwt}` },
      payload: { displayName: 'Dave' },
    })

    expect(response.statusCode).toBe(200)
    const body = JSON.parse(response.body)
    expect(body.displayName).toBe('Dave')
    expect(body.username).toBeUndefined()
  })

  // ─── Path 5: 400 fallback ───

  it('returns 400 when body has no recognized path', async () => {
    const { jwt } = makeToken('empty-body-token')

    const response = await server.app.inject({
      method: 'POST',
      url: '/api/v1/identity/setup',
      headers: { authorization: `Bearer ${jwt}` },
      payload: {},
    })

    expect(response.statusCode).toBe(400)
    const body = JSON.parse(response.body)
    expect(body.error).toMatch(/displayName/i)
  })
})
