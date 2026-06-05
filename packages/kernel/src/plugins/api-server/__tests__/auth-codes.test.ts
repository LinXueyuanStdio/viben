import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { TokenStore } from '../auth/token-store.js'
import { createApiServer } from '../server.js'
import type { ApiServerInstance } from '../server.js'
import { authRoutes } from '../routes/auth.js'
import { ExchangeCodeBodySchema } from '../schemas/auth.js'
import { signToken } from '../auth/jwt.js'
import { parseDuration } from '../auth/token-store.js'
import { AuthError } from '../middleware/error-handler.js'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

describe('TokenStore — codes', () => {
  let store: TokenStore
  let tmpDir: string
  let filePath: string

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'auth-codes-'))
    filePath = path.join(tmpDir, 'tokens.json')
    store = new TokenStore(filePath)
    await store.load()
  })

  afterEach(async () => {
    await store.flush()
    store.destroy()
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('creates a code with 32-char hex string', () => {
    const code = store.createCode({ role: 'admin', name: 'test-code', expire: '24h' })
    expect(code.code).toMatch(/^[0-9a-f]{32}$/)
    expect(code.role).toBe('admin')
    expect(code.name).toBe('test-code')
    expect(code.expire).toBe('24h')
    expect(code.used).toBe(false)
  })

  it('creates code with 30-minute TTL by default', () => {
    const before = Date.now()
    const code = store.createCode({ role: 'admin', name: 'test', expire: '24h' })
    const expiresAt = new Date(code.expiresAt).getTime()
    const thirtyMin = 30 * 60 * 1000
    expect(expiresAt).toBeGreaterThanOrEqual(before + thirtyMin - 100)
    expect(expiresAt).toBeLessThanOrEqual(before + thirtyMin + 1000)
  })

  it('gets a code by code string', () => {
    const created = store.createCode({ role: 'viewer', name: 'test', expire: '1h' })
    const found = store.getCode(created.code)
    expect(found).toBeDefined()
    expect(found!.role).toBe('viewer')
  })

  it('returns undefined for unknown code', () => {
    expect(store.getCode('nonexistent')).toBeUndefined()
  })

  it('exchanges code: marks used and returns true', () => {
    const created = store.createCode({ role: 'admin', name: 'test', expire: '24h' })
    const result = store.exchangeCode(created.code)
    expect(result).toBeDefined()
    expect(result!.used).toBe(true)
    // second exchange fails
    expect(store.exchangeCode(created.code)).toBeUndefined()
  })

  it('exchange fails for expired code', () => {
    vi.useFakeTimers()
    const code = store.createCode({ role: 'admin', name: 'test', expire: '24h' })
    vi.advanceTimersByTime(31 * 60 * 1000) // 31 minutes
    expect(store.exchangeCode(code.code)).toBeUndefined()
    vi.useRealTimers()
  })

  it('lists only active codes (not used, not expired)', () => {
    const c1 = store.createCode({ role: 'admin', name: 'c1', expire: '24h' })
    store.createCode({ role: 'admin', name: 'c2', expire: '24h' })
    store.exchangeCode(c1.code) // mark used
    const active = store.listCodes()
    expect(active).toHaveLength(1)
    expect(active[0].name).toBe('c2')
  })

  it('revokes unused code', () => {
    const code = store.createCode({ role: 'admin', name: 'test', expire: '24h' })
    store.revokeCode(code.code)
    expect(store.getCode(code.code)).toBeUndefined()
  })

  it('persists codes to disk and reloads', async () => {
    store.createCode({ role: 'admin', name: 'persist-test', expire: '24h' })
    await store.save()

    const store2 = new TokenStore(filePath)
    await store2.load()
    const codes = store2.listCodes()
    expect(codes).toHaveLength(1)
    expect(codes[0].name).toBe('persist-test')
    store2.destroy()
  })

  it('cleanup removes expired and used codes', () => {
    vi.useFakeTimers()
    const c1 = store.createCode({ role: 'admin', name: 'used', expire: '24h' })
    store.createCode({ role: 'admin', name: 'expired', expire: '24h', codeTtlMs: 1000 })
    store.createCode({ role: 'admin', name: 'active', expire: '24h' })
    store.exchangeCode(c1.code)
    vi.advanceTimersByTime(2000) // expire the short-TTL code
    store.cleanup()
    const remaining = store.listCodes()
    expect(remaining).toHaveLength(1)
    expect(remaining[0].name).toBe('active')
    vi.useRealTimers()
  })
})

describe('Auth code endpoints', () => {
  let server: ApiServerInstance
  let store: TokenStore
  let tmpDir: string
  const SECRET = 'test-secret-token'
  const JWT_SECRET = 'test-jwt-secret-32charslong!!!!!'

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'auth-code-routes-'))
    const tokensPath = path.join(tmpDir, 'tokens.json')
    store = new TokenStore(tokensPath)
    await store.load()

    server = await createApiServer({
      port: 0,
      host: '127.0.0.1',
      getSecret: () => SECRET,
      getJwtSecret: () => JWT_SECRET,
      tokenStore: store,
    })

    // Register auth routes (code endpoints live here)
    server.registerPlugin('/api/v1/auth', async (app) => {
      await authRoutes(app, { tokenStore: store, getJwtSecret: () => JWT_SECRET })
    })

    // Exchange endpoint — NO auth (code in body IS the credential)
    server.registerPlugin('/api/v1/auth', async (app) => {
      app.post('/exchange', async (request, reply) => {
        const body = ExchangeCodeBodySchema.parse(request.body)
        const code = store.exchangeCode(body.code)
        if (!code) {
          throw new AuthError('INVALID_CODE', 'Code is invalid, expired, or already used', 401)
        }
        const token = store.create({
          role: code.role,
          name: code.name,
          expire: code.expire,
          scopes: code.scopes,
        })
        const rfd = new Date(token.refreshDeadline).getTime() / 1000
        const accessToken = signToken(
          { sub: token.id, role: token.role, scopes: token.scopes, rfd },
          JWT_SECRET,
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

    await server.app.ready()
  })

  afterEach(async () => {
    await server.stop()
    await store.flush()
    store.destroy()
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('POST /api/v1/auth/codes creates code with secret token', async () => {
    const res = await server.app.inject({
      method: 'POST',
      url: '/api/v1/auth/codes',
      headers: { authorization: `Bearer ${SECRET}` },
      payload: { role: 'admin', name: 'test-remote', expire: '24h' },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toMatch(/^[0-9a-f]{32}$/)
    expect(body.expiresAt).toBeDefined()
  })

  it('POST /api/v1/auth/codes rejects non-secret auth', async () => {
    const res = await server.app.inject({
      method: 'POST',
      url: '/api/v1/auth/codes',
      headers: { authorization: 'Bearer some-jwt-token' },
      payload: { role: 'admin', name: 'test', expire: '24h' },
    })
    expect(res.statusCode).toBe(401)
  })

  it('POST /api/v1/auth/exchange returns JWT for valid code', async () => {
    const createRes = await server.app.inject({
      method: 'POST',
      url: '/api/v1/auth/codes',
      headers: { authorization: `Bearer ${SECRET}` },
      payload: { role: 'admin', name: 'test', expire: '24h' },
    })
    const { code } = createRes.json()

    const exchangeRes = await server.app.inject({
      method: 'POST',
      url: '/api/v1/auth/exchange',
      payload: { code },
    })
    expect(exchangeRes.statusCode).toBe(200)
    const body = exchangeRes.json()
    expect(body.accessToken).toBeDefined()
    expect(body.tokenId).toMatch(/^tok_/)
    expect(body.expiresAt).toBeDefined()
    expect(body.refreshDeadline).toBeDefined()
  })

  it('POST /api/v1/auth/exchange rejects used code (one-time only)', async () => {
    const createRes = await server.app.inject({
      method: 'POST',
      url: '/api/v1/auth/codes',
      headers: { authorization: `Bearer ${SECRET}` },
      payload: { role: 'admin', name: 'test', expire: '24h' },
    })
    const { code } = createRes.json()

    const first = await server.app.inject({
      method: 'POST',
      url: '/api/v1/auth/exchange',
      payload: { code },
    })
    expect(first.statusCode).toBe(200)

    const second = await server.app.inject({
      method: 'POST',
      url: '/api/v1/auth/exchange',
      payload: { code },
    })
    expect(second.statusCode).toBe(401)
  })

  it('POST /api/v1/auth/exchange rejects invalid code', async () => {
    const res = await server.app.inject({
      method: 'POST',
      url: '/api/v1/auth/exchange',
      payload: { code: 'a'.repeat(32) },
    })
    expect(res.statusCode).toBe(401)
  })

  it('GET /api/v1/auth/codes lists active codes', async () => {
    await server.app.inject({
      method: 'POST',
      url: '/api/v1/auth/codes',
      headers: { authorization: `Bearer ${SECRET}` },
      payload: { role: 'admin', name: 'code-1', expire: '24h' },
    })
    await server.app.inject({
      method: 'POST',
      url: '/api/v1/auth/codes',
      headers: { authorization: `Bearer ${SECRET}` },
      payload: { role: 'viewer', name: 'code-2', expire: '1h' },
    })

    const res = await server.app.inject({
      method: 'GET',
      url: '/api/v1/auth/codes',
      headers: { authorization: `Bearer ${SECRET}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().codes).toHaveLength(2)
  })

  it('DELETE /api/v1/auth/codes/:code revokes code', async () => {
    const createRes = await server.app.inject({
      method: 'POST',
      url: '/api/v1/auth/codes',
      headers: { authorization: `Bearer ${SECRET}` },
      payload: { role: 'admin', name: 'to-revoke', expire: '24h' },
    })
    const { code } = createRes.json()

    const delRes = await server.app.inject({
      method: 'DELETE',
      url: `/api/v1/auth/codes/${code}`,
      headers: { authorization: `Bearer ${SECRET}` },
    })
    expect(delRes.statusCode).toBe(200)

    const exchangeRes = await server.app.inject({
      method: 'POST',
      url: '/api/v1/auth/exchange',
      payload: { code },
    })
    expect(exchangeRes.statusCode).toBe(401)
  })
})

describe('TokenStore — identitySecret', () => {
  let store: TokenStore
  let tmpDir: string
  let filePath: string

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'identity-secret-test-'))
    filePath = path.join(tmpDir, 'tokens.json')
    store = new TokenStore(filePath)
    await store.load()
  })

  afterEach(async () => {
    await store.flush()
    store.destroy()
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('create() assigns a 32-char hex identitySecret', () => {
    const token = store.create({ role: 'admin', name: 'test', expire: '24h' })
    expect(token.identitySecret).toMatch(/^[0-9a-f]{32}$/)
  })

  it('each token gets a unique identitySecret', () => {
    const a = store.create({ role: 'admin', name: 'a', expire: '24h' })
    const b = store.create({ role: 'admin', name: 'b', expire: '24h' })
    expect(a.identitySecret).not.toBe(b.identitySecret)
  })

  it('getByIdentitySecret returns matching non-revoked token', () => {
    const token = store.create({ role: 'admin', name: 'test', expire: '24h' })
    const found = store.getByIdentitySecret(token.identitySecret)
    expect(found?.id).toBe(token.id)
  })

  it('getByIdentitySecret returns undefined for revoked token', () => {
    const token = store.create({ role: 'admin', name: 'test', expire: '24h' })
    store.revoke(token.id)
    expect(store.getByIdentitySecret(token.identitySecret)).toBeUndefined()
  })

  it('getByIdentitySecret returns undefined for unknown secret', () => {
    expect(store.getByIdentitySecret('a'.repeat(32))).toBeUndefined()
  })

  it('load() migrates tokens without identitySecret', async () => {
    // Write a tokens.json with a token that has no identitySecret (old format)
    const oldToken = {
      id: 'tok_old123',
      name: 'legacy',
      role: 'admin',
      createdAt: new Date().toISOString(),
      refreshDeadline: new Date(Date.now() + 7 * 86400_000).toISOString(),
      revoked: false,
    }
    await import('node:fs/promises').then(fs =>
      fs.writeFile(filePath, JSON.stringify({ tokens: [oldToken], codes: [] }))
    )

    const freshStore = new TokenStore(filePath)
    await freshStore.load()

    const loaded = freshStore.get('tok_old123')
    expect(loaded?.identitySecret).toBeDefined()
    expect(loaded?.identitySecret).toMatch(/^[0-9a-f]{32}$/)

    await freshStore.flush()
    freshStore.destroy()
  })
})
