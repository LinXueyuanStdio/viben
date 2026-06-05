import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { TokenStore, parseDuration } from '../auth/token-store.js'
import { createApiServer } from '../server.js'
import type { ApiServerInstance } from '../server.js'
import { ExchangeCodeBodySchema } from '../schemas/auth.js'
import { signToken } from '../auth/jwt.js'
import { AuthError } from '../middleware/error-handler.js'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const SECRET = 'test-secret-token-exchange'
const JWT_SECRET = 'test-jwt-secret-32charslong!!!!!'

describe('POST /exchange', () => {
  let server: ApiServerInstance
  let store: TokenStore
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'auth-exchange-test-'))
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

    // Register exchange endpoint with no auth — mirrors production setup in index.ts
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

  it('returns JWT on valid code', async () => {
    // Create a one-time code directly via token store
    const created = store.createCode({ role: 'operator', name: 'cli-session', expire: '24h' })

    const res = await server.app.inject({
      method: 'POST',
      url: '/api/v1/auth/exchange',
      payload: { code: created.code },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.accessToken).toBeDefined()
    expect(typeof body.accessToken).toBe('string')
    expect(body.tokenId).toMatch(/^tok_/)
    expect(body.expiresAt).toBeDefined()
    expect(body.refreshDeadline).toBeDefined()
  })

  it('returns 401 for invalid code', async () => {
    const res = await server.app.inject({
      method: 'POST',
      url: '/api/v1/auth/exchange',
      payload: { code: 'a'.repeat(32) },
    })

    expect(res.statusCode).toBe(401)
  })

  it('returns 401 for already-used code', async () => {
    // Create a code and exchange it once to mark it as used
    const created = store.createCode({ role: 'admin', name: 'one-time', expire: '24h' })

    const first = await server.app.inject({
      method: 'POST',
      url: '/api/v1/auth/exchange',
      payload: { code: created.code },
    })
    expect(first.statusCode).toBe(200)

    // Second exchange must fail — code is already used
    const second = await server.app.inject({
      method: 'POST',
      url: '/api/v1/auth/exchange',
      payload: { code: created.code },
    })
    expect(second.statusCode).toBe(401)
  })

  it('exchange response includes identitySecret as 32-char hex', async () => {
    const created = store.createCode({ role: 'operator', name: 'secret-test', expire: '24h' })

    const res = await server.app.inject({
      method: 'POST',
      url: '/api/v1/auth/exchange',
      payload: { code: created.code },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.identitySecret).toBeDefined()
    expect(body.identitySecret).toMatch(/^[0-9a-f]{32}$/)
  })

  it('returns 401 for expired code', async () => {
    const realNow = Date.now()
    // createCode defaults to 30-minute TTL; create code at current real time
    const created = store.createCode({ role: 'operator', name: 'expiry-test', expire: '24h' })

    // Mock Date.now to simulate time past the 30-minute TTL without blocking async I/O
    const expiredTime = realNow + 30 * 60 * 1000 + 1_000
    vi.spyOn(Date, 'now').mockReturnValue(expiredTime)
    try {
      const res = await server.app.inject({
        method: 'POST',
        url: '/api/v1/auth/exchange',
        payload: { code: created.code },
      })

      expect(res.statusCode).toBe(401)
    } finally {
      vi.restoreAllMocks()
    }
  })
})
