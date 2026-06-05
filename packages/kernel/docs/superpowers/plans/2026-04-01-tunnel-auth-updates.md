# Tunnel Auto-Start, Auth One-Time Code, Display Updates — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one-time code auth for remote access links, merge tunnel viewer server into API server (1 port, 1 tunnel), add tunnel keepalive ping, auto-start tunnel on boot, and make terminal links copyable.

**Architecture:** Extend existing TokenStore with a `codes` Map for one-time codes. Port Hono viewer routes to Fastify plugin registered via ApiServerService. Add TunnelKeepAlive class that HTTP-pings the tunnel URL and triggers existing retry logic on failure. Update startup display and `viben remote` output to show links outside Unicode boxes.

**Tech Stack:** Fastify, Zod, Node.js crypto, vitest

**Spec:** `docs/superpowers/specs/2026-04-01-tunnel-auth-updates-design.md`

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `src/plugins/tunnel/viewer-routes.ts` | Fastify plugin — viewer HTML + JSON API routes (ported from Hono server.ts) |
| `src/plugins/tunnel/keepalive.ts` | TunnelKeepAlive — HTTP ping loop for system tunnel liveness |
| `src/plugins/tunnel/__tests__/keepalive.test.ts` | Tests for keepalive |
| `src/plugins/api-server/__tests__/auth-codes.test.ts` | Tests for one-time code auth endpoints |

### Modified Files
| File | Changes |
|------|---------|
| `src/plugins/api-server/auth/types.ts` | Add `StoredCode` interface |
| `src/plugins/api-server/auth/token-store.ts` | Add codes Map, CRUD methods, persist in tokens.json, cleanup |
| `src/plugins/api-server/schemas/auth.ts` | Add Zod schemas for code endpoints |
| `src/plugins/api-server/routes/auth.ts` | Add `/codes` and `/exchange` endpoints |
| `src/plugins/api-server/index.ts` | Register `/exchange` as separate unauthenticated route group |
| `src/plugins/tunnel/tunnel-service.ts` | Remove Hono server boot, accept apiPort, update getPublicUrl() |
| `src/plugins/tunnel/tunnel-registry.ts` | Integrate keepalive for system tunnel |
| `src/plugins/api-server/index.ts` | Register `/exchange` as separate unauthenticated route group |
| `src/plugins/tunnel/index.ts` | Add api-server dependency, register viewer routes, auto-start tunnel |
| `src/core/plugin/types.ts` | Update TunnelServiceInterface.start(apiPort) signature |
| `src/main.ts` | Update startup display — links as plain text below status checkmarks |
| `src/cli/commands/remote.ts` | Use /auth/codes, output with links outside box |

### Deleted Files
| File | Reason |
|------|--------|
| `src/plugins/tunnel/server.ts` | Hono viewer server replaced by Fastify viewer-routes.ts |

---

### Task 1: StoredCode Type and TokenStore Code Storage

**Files:**
- Modify: `src/plugins/api-server/auth/types.ts`
- Modify: `src/plugins/api-server/auth/token-store.ts`
- Test: `src/plugins/api-server/__tests__/auth-codes.test.ts`

- [ ] **Step 1: Add StoredCode interface to types.ts**

In `src/plugins/api-server/auth/types.ts`, add after the `StoredToken` interface:

```typescript
export interface StoredCode {
  code: string;
  role: string;
  scopes?: string[];
  name: string;
  expire: string;
  createdAt: string;
  expiresAt: string;
  used: boolean;
}

export interface CreateCodeOpts {
  role: string;
  name: string;
  expire: string;
  scopes?: string[];
  codeTtlMs?: number; // default 30 minutes
}
```

- [ ] **Step 2: Write failing tests for TokenStore code methods**

Create `src/plugins/api-server/__tests__/auth-codes.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { TokenStore } from '../auth/token-store.js'
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

  afterEach(() => {
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
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd /Users/lucas/viben-workspace/Viben-tunnel-auth-updates && pnpm vitest run src/plugins/api-server/__tests__/auth-codes.test.ts`

Expected: FAIL — `createCode`, `getCode`, `exchangeCode`, `listCodes`, `revokeCode` methods don't exist on TokenStore.

- [ ] **Step 4: Implement code methods in TokenStore**

In `src/plugins/api-server/auth/token-store.ts`, add:

1. Import `StoredCode` and `CreateCodeOpts` from types.
2. Add `private codes: Map<string, StoredCode> = new Map()` field.
3. Add `crypto` import for `randomBytes`.
4. Update `load()` to read `codes` array from JSON file into the Map.
5. Update `save()` to include `codes` array in persisted JSON.
6. Add these methods:

```typescript
createCode(opts: CreateCodeOpts): StoredCode {
  const code = crypto.randomBytes(16).toString('hex')
  const now = new Date()
  const ttl = opts.codeTtlMs ?? 30 * 60 * 1000 // 30 minutes
  const stored: StoredCode = {
    code,
    role: opts.role,
    scopes: opts.scopes,
    name: opts.name,
    expire: opts.expire,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + ttl).toISOString(),
    used: false,
  }
  this.codes.set(code, stored)
  this.scheduleSave()
  return stored
}

getCode(code: string): StoredCode | undefined {
  const stored = this.codes.get(code)
  if (!stored) return undefined
  if (stored.used) return undefined
  if (new Date(stored.expiresAt).getTime() < Date.now()) return undefined
  return stored
}

/**
 * Atomically check and mark code as used.
 * Returns the code if exchange succeeds, undefined if code is invalid/used/expired.
 * No async gap between check and mark — event loop guarantees atomicity.
 */
exchangeCode(code: string): StoredCode | undefined {
  const stored = this.codes.get(code)
  if (!stored) return undefined
  if (stored.used) return undefined
  if (new Date(stored.expiresAt).getTime() < Date.now()) return undefined
  stored.used = true
  this.scheduleSave()
  return stored
}

listCodes(): StoredCode[] {
  const now = Date.now()
  return [...this.codes.values()].filter(
    (c) => !c.used && new Date(c.expiresAt).getTime() > now,
  )
}

revokeCode(code: string): void {
  this.codes.delete(code)
  this.scheduleSave()
}
```

7. Update `cleanup()` to also remove expired + used codes:

```typescript
// Add to existing cleanup() method:
for (const [code, stored] of this.codes) {
  if (stored.used || new Date(stored.expiresAt).getTime() < Date.now()) {
    this.codes.delete(code)
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd /Users/lucas/viben-workspace/Viben-tunnel-auth-updates && pnpm vitest run src/plugins/api-server/__tests__/auth-codes.test.ts`

Expected: ALL PASS

- [ ] **Step 6: Run full test suite to verify no regressions**

Run: `cd /Users/lucas/viben-workspace/Viben-tunnel-auth-updates && pnpm vitest run`

Expected: Same pass/fail count as baseline (167 pass, 2 pre-existing failures).

- [ ] **Step 7: Commit**

```bash
git add src/plugins/api-server/auth/types.ts src/plugins/api-server/auth/token-store.ts src/plugins/api-server/__tests__/auth-codes.test.ts
git commit -m "feat(auth): add one-time code storage to TokenStore"
```

---

### Task 2: Auth Code Endpoints

**Files:**
- Modify: `src/plugins/api-server/schemas/auth.ts`
- Modify: `src/plugins/api-server/routes/auth.ts`
- Modify: `src/plugins/api-server/index.ts`
- Test: `src/plugins/api-server/__tests__/auth-codes.test.ts`

- [ ] **Step 1: Add Zod schemas for code endpoints**

In `src/plugins/api-server/schemas/auth.ts`, add:

```typescript
export const CreateCodeBodySchema = z.object({
  role: z.enum(['admin', 'operator', 'viewer']),
  name: z.string().min(1),
  expire: z.string().regex(/^\d+(h|d|m)$/).default('24h'),
  scopes: z.array(z.string()).optional(),
})

export const ExchangeCodeBodySchema = z.object({
  code: z.string().length(32),
})

export const RevokeCodeParamSchema = z.object({
  code: z.string().length(32),
})
```

- [ ] **Step 2: Write failing tests for auth code endpoints**

Append to `src/plugins/api-server/__tests__/auth-codes.test.ts`:

```typescript
import { createApiServer } from '../server.js'
import type { ApiServerInstance } from '../server.js'

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
    // Note: inject() works on Fastify without calling start() —
    // it simulates HTTP requests in-process. No port binding needed.
    // Verify this works by checking existing tests in the codebase.
    // If inject() fails, call: await server.start()
  })

  afterEach(async () => {
    await server.stop()
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
    // Create code first
    const createRes = await server.app.inject({
      method: 'POST',
      url: '/api/v1/auth/codes',
      headers: { authorization: `Bearer ${SECRET}` },
      payload: { role: 'admin', name: 'test', expire: '24h' },
    })
    const { code } = createRes.json()

    // Exchange — no auth header needed
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

    // First exchange succeeds
    const first = await server.app.inject({
      method: 'POST',
      url: '/api/v1/auth/exchange',
      payload: { code },
    })
    expect(first.statusCode).toBe(200)

    // Second exchange fails
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

    // Exchange should fail
    const exchangeRes = await server.app.inject({
      method: 'POST',
      url: '/api/v1/auth/exchange',
      payload: { code },
    })
    expect(exchangeRes.statusCode).toBe(401)
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd /Users/lucas/viben-workspace/Viben-tunnel-auth-updates && pnpm vitest run src/plugins/api-server/__tests__/auth-codes.test.ts`

Expected: FAIL — endpoints don't exist yet.

- [ ] **Step 4: Add code management endpoints to auth routes**

In `src/plugins/api-server/routes/auth.ts`, add the following routes inside the `authRoutes` function (these are authenticated routes):

```typescript
import { CreateCodeBodySchema, RevokeCodeParamSchema } from '../schemas/auth.js'

// POST /codes — generate one-time code (secret token only)
app.post('/codes', {
  preHandler: requireRole('admin'),
}, async (request, reply) => {
  if (request.auth.type !== 'secret') {
    throw new AuthError('FORBIDDEN', 'Only secret token can create codes', 403)
  }
  const body = CreateCodeBodySchema.parse(request.body)
  const code = deps.tokenStore.createCode({
    role: body.role,
    name: body.name,
    expire: body.expire,
    scopes: body.scopes,
  })
  return reply.send({ code: code.code, expiresAt: code.expiresAt })
})

// GET /codes — list active codes (auth:manage scope)
app.get('/codes', {
  preHandler: requireScopes('auth:manage'),
}, async (_request, reply) => {
  return reply.send({ codes: deps.tokenStore.listCodes() })
})

// DELETE /codes/:code — revoke unused code (auth:manage scope)
app.delete<{ Params: { code: string } }>('/codes/:code', {
  preHandler: requireScopes('auth:manage'),
}, async (request, reply) => {
  const { code } = RevokeCodeParamSchema.parse(request.params)
  deps.tokenStore.revokeCode(code)
  return reply.send({ revoked: true, code })
})
```

- [ ] **Step 5: Register /exchange as unauthenticated route**

In `src/plugins/api-server/index.ts`, register `/exchange` as a separate route group with `{ auth: false }`. This follows the same pattern as `/api/v1/system` which is registered without auth to allow `/health` to be public.

Find where auth routes are registered and add below:

```typescript
import { ExchangeCodeBodySchema } from './schemas/auth.js'
import { signToken } from './auth/jwt.js'
import { parseDuration } from './auth/token-store.js'
import { AuthError } from './middleware/error-handler.js'

// Exchange endpoint — NO auth (code in body IS the credential)
server.registerPlugin('/api/v1/auth', async (app) => {
  app.post('/exchange', async (request, reply) => {
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
    })
  })
}, { auth: false })
```

**Note on rate limiting:** `@fastify/rate-limit` is configured globally at 100 req/min. Route-level override is not supported by the plugin. The global rate limit provides baseline protection. For stronger brute-force protection on `/exchange`, the 32-char hex code space (2^128 possibilities) makes guessing infeasible within 100 req/min.

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd /Users/lucas/viben-workspace/Viben-tunnel-auth-updates && pnpm vitest run src/plugins/api-server/__tests__/auth-codes.test.ts`

Expected: ALL PASS

- [ ] **Step 7: Run full test suite**

Run: `cd /Users/lucas/viben-workspace/Viben-tunnel-auth-updates && pnpm vitest run`

Expected: Same baseline pass/fail count.

- [ ] **Step 8: Commit**

```bash
git add src/plugins/api-server/schemas/auth.ts src/plugins/api-server/routes/auth.ts src/plugins/api-server/index.ts src/plugins/api-server/__tests__/auth-codes.test.ts
git commit -m "feat(auth): add one-time code endpoints for remote access"
```

---

### Task 3: Viewer Routes — Port Hono to Fastify

**Files:**
- Create: `src/plugins/tunnel/viewer-routes.ts`
- Reference (read-only): `src/plugins/tunnel/server.ts` (Hono routes to port)
- Reference (read-only): `src/plugins/tunnel/templates/*.ts`
- Reference (read-only): `src/plugins/tunnel/viewer-store.ts`

- [ ] **Step 1: Create viewer-routes.ts as Fastify plugin**

Create `src/plugins/tunnel/viewer-routes.ts`:

```typescript
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import type { ViewerStore } from './viewer-store.js'
import { renderFileViewer } from './templates/file-viewer.js'
import { renderDiffViewer } from './templates/diff-viewer.js'
import { renderOutputViewer } from './templates/output-viewer.js'

const NOT_FOUND_HTML = `<!DOCTYPE html><html><body style="font-family:system-ui;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;color:#666"><div style="text-align:center"><h1>Not Found</h1><p>This link has expired or the content is no longer available.</p></div></body></html>`

export function createViewerRoutes(store: ViewerStore): FastifyPluginAsync {
  return async (app) => {
    app.get<{ Params: { id: string } }>('/view/:id', async (request, reply) => {
      const entry = store.get(request.params.id)
      if (!entry || entry.type !== 'file') {
        return reply.status(404).type('text/html').send(NOT_FOUND_HTML)
      }
      return reply.type('text/html').send(renderFileViewer(entry))
    })

    app.get<{ Params: { id: string } }>('/diff/:id', async (request, reply) => {
      const entry = store.get(request.params.id)
      if (!entry || entry.type !== 'diff') {
        return reply.status(404).type('text/html').send(NOT_FOUND_HTML)
      }
      return reply.type('text/html').send(renderDiffViewer(entry))
    })

    app.get<{ Params: { id: string } }>('/output/:id', async (request, reply) => {
      const entry = store.get(request.params.id)
      if (!entry || entry.type !== 'output') {
        return reply.status(404).type('text/html').send(NOT_FOUND_HTML)
      }
      return reply.type('text/html').send(renderOutputViewer(entry))
    })

    // JSON APIs — used by HTML templates via fetch()
    // ViewerEntry fields: id, type, filePath?, content, oldContent?, language?, sessionId, workingDirectory, createdAt, expiresAt
    app.get<{ Params: { id: string } }>('/api/file/:id', async (request, reply) => {
      const entry = store.get(request.params.id)
      if (!entry || entry.type !== 'file') {
        return reply.status(404).send({ error: 'Not found' })
      }
      return reply.send({
        filePath: entry.filePath,
        content: entry.content,
        language: entry.language,
      })
    })

    app.get<{ Params: { id: string } }>('/api/diff/:id', async (request, reply) => {
      const entry = store.get(request.params.id)
      if (!entry || entry.type !== 'diff') {
        return reply.status(404).send({ error: 'Not found' })
      }
      // For diffs: entry.content = new content, entry.oldContent = old content
      return reply.send({
        filePath: entry.filePath,
        oldContent: entry.oldContent,
        newContent: entry.content,
        language: entry.language,
      })
    })
  }
}
```

- [ ] **Step 2: Verify file compiles**

Run: `cd /Users/lucas/viben-workspace/Viben-tunnel-auth-updates && pnpm tsc --noEmit src/plugins/tunnel/viewer-routes.ts`

If TypeScript check fails, fix type issues (check ViewerStore entry types for exact field names).

- [ ] **Step 3: Commit**

```bash
git add src/plugins/tunnel/viewer-routes.ts
git commit -m "feat(tunnel): add Fastify viewer routes (port from Hono)"
```

---

### Task 4: TunnelKeepAlive Class

**Files:**
- Create: `src/plugins/tunnel/keepalive.ts`
- Test: `src/plugins/tunnel/__tests__/keepalive.test.ts`

- [ ] **Step 1: Write failing tests for TunnelKeepAlive**

Create `src/plugins/tunnel/__tests__/keepalive.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { TunnelKeepAlive } from '../keepalive.js'

describe('TunnelKeepAlive', () => {
  let keepalive: TunnelKeepAlive

  beforeEach(() => {
    vi.useFakeTimers()
    keepalive = new TunnelKeepAlive()
  })

  afterEach(() => {
    keepalive.stop()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('calls onDead after 3 consecutive fetch failures', async () => {
    const onDead = vi.fn()
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')))

    keepalive.start('https://example.com', onDead)

    // Fail 1
    await vi.advanceTimersByTimeAsync(30_000)
    expect(onDead).not.toHaveBeenCalled()

    // Fail 2
    await vi.advanceTimersByTimeAsync(30_000)
    expect(onDead).not.toHaveBeenCalled()

    // Fail 3 — trigger onDead
    await vi.advanceTimersByTimeAsync(30_000)
    expect(onDead).toHaveBeenCalledOnce()
  })

  it('resets fail count on successful ping', async () => {
    const onDead = vi.fn()
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce({ ok: true }) // success resets
      .mockRejectedValueOnce(new Error('fail'))
      .mockRejectedValueOnce(new Error('fail'))

    vi.stubGlobal('fetch', fetchMock)
    keepalive.start('https://example.com', onDead)

    // 2 fails
    await vi.advanceTimersByTimeAsync(30_000)
    await vi.advanceTimersByTimeAsync(30_000)
    // 1 success — resets
    await vi.advanceTimersByTimeAsync(30_000)
    // 2 more fails — still only 2, not 3
    await vi.advanceTimersByTimeAsync(30_000)
    await vi.advanceTimersByTimeAsync(30_000)

    expect(onDead).not.toHaveBeenCalled()
  })

  it('pings the correct health endpoint URL', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)

    keepalive.start('https://my-tunnel.trycloudflare.com', vi.fn())
    await vi.advanceTimersByTimeAsync(30_000)

    expect(fetchMock).toHaveBeenCalledWith(
      'https://my-tunnel.trycloudflare.com/api/v1/system/health',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
  })

  it('stop() clears interval and resets state', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('fail'))
    vi.stubGlobal('fetch', fetchMock)
    const onDead = vi.fn()

    keepalive.start('https://example.com', onDead)
    await vi.advanceTimersByTimeAsync(30_000) // 1 fail
    keepalive.stop()

    // No more pings after stop
    await vi.advanceTimersByTimeAsync(120_000)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(onDead).not.toHaveBeenCalled()
  })

  it('start() clears previous interval', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('fail'))
    vi.stubGlobal('fetch', fetchMock)
    const onDead1 = vi.fn()
    const onDead2 = vi.fn()

    keepalive.start('https://old-url.com', onDead1)
    keepalive.start('https://new-url.com', onDead2)

    // 3 fails
    await vi.advanceTimersByTimeAsync(30_000)
    await vi.advanceTimersByTimeAsync(30_000)
    await vi.advanceTimersByTimeAsync(30_000)

    expect(onDead1).not.toHaveBeenCalled()
    expect(onDead2).toHaveBeenCalledOnce()
  })

  it('treats non-200 response as failure', async () => {
    const onDead = vi.fn()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 502 }))

    keepalive.start('https://example.com', onDead)
    await vi.advanceTimersByTimeAsync(30_000)
    await vi.advanceTimersByTimeAsync(30_000)
    await vi.advanceTimersByTimeAsync(30_000)

    expect(onDead).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/lucas/viben-workspace/Viben-tunnel-auth-updates && pnpm vitest run src/plugins/tunnel/__tests__/keepalive.test.ts`

Expected: FAIL — module `../keepalive.js` doesn't exist.

- [ ] **Step 3: Implement TunnelKeepAlive**

Create `src/plugins/tunnel/keepalive.ts`:

```typescript
export class TunnelKeepAlive {
  private interval: NodeJS.Timeout | null = null
  private consecutiveFails = 0

  static readonly PING_INTERVAL = 30_000
  static readonly FAIL_THRESHOLD = 3
  static readonly PING_TIMEOUT = 5_000

  start(tunnelUrl: string, onDead: () => void): void {
    this.stop()

    this.interval = setInterval(async () => {
      try {
        const res = await fetch(`${tunnelUrl}/api/v1/system/health`, {
          signal: AbortSignal.timeout(TunnelKeepAlive.PING_TIMEOUT),
        })
        if (res.ok) {
          this.consecutiveFails = 0
        } else {
          this.consecutiveFails++
        }
      } catch {
        this.consecutiveFails++
      }

      if (this.consecutiveFails >= TunnelKeepAlive.FAIL_THRESHOLD) {
        this.stop()
        onDead()
      }
    }, TunnelKeepAlive.PING_INTERVAL)
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval)
      this.interval = null
    }
    this.consecutiveFails = 0
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/lucas/viben-workspace/Viben-tunnel-auth-updates && pnpm vitest run src/plugins/tunnel/__tests__/keepalive.test.ts`

Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add src/plugins/tunnel/keepalive.ts src/plugins/tunnel/__tests__/keepalive.test.ts
git commit -m "feat(tunnel): add TunnelKeepAlive class for system tunnel liveness"
```

---

### Task 5: Refactor TunnelService — Remove Hono, Accept apiPort

**Files:**
- Modify: `src/plugins/tunnel/tunnel-service.ts`
- Modify: `src/core/plugin/types.ts`
- Delete: `src/plugins/tunnel/server.ts`

- [ ] **Step 1: Update TunnelServiceInterface in core types**

In `src/core/plugin/types.ts`, change:

```typescript
// Before
start(): Promise<string>

// After
start(apiPort: number): Promise<string>
```

- [ ] **Step 2: Refactor TunnelService.start() to accept apiPort**

In `src/plugins/tunnel/tunnel-service.ts`:

1. Remove imports for `serve` from `@hono/node-server` and `createTunnelServer`.
2. Remove the `server` field and Hono server boot logic.
3. Add `private apiPort: number = 0` field.
4. Rewrite `start()` — ViewerStore is already initialized in constructor, so `start()` only needs to register the system tunnel:

```typescript
async start(apiPort: number): Promise<string> {
  this.apiPort = apiPort

  // ViewerStore already initialized in constructor — no change needed there

  // Restore persisted user tunnels (keep existing logic)
  await this.registry.restore()

  // Register system tunnel pointing to API server port
  if (this.config.provider) {
    try {
      const entry = await this.registry.add(apiPort, {
        type: 'system',
        provider: this.config.provider,
        label: 'system',
      })
      return entry.publicUrl || `http://localhost:${apiPort}`
    } catch (err) {
      this.startError = (err as Error).message
      return `http://localhost:${apiPort}`
    }
  }

  return `http://localhost:${apiPort}`
}
```

5. Update `getPublicUrl()`:

```typescript
getPublicUrl(): string {
  if (!this.apiPort) return ''
  const system = this.registry.getSystemEntry()
  return system?.publicUrl || `http://localhost:${this.apiPort}`
}
```

6. Update `stop()` — remove `this.server.close()` call. Keep registry shutdown and store destroy.

7. Update `fileUrl()`, `diffUrl()`, `outputUrl()` — add empty string check:

```typescript
fileUrl(entryId: string): string {
  const base = this.getPublicUrl()
  return base ? `${base}/view/${entryId}` : ''
}
// Same pattern for diffUrl and outputUrl
```

- [ ] **Step 3: Delete the Hono server file**

Delete `src/plugins/tunnel/server.ts`.

- [ ] **Step 4: Verify compilation**

Run: `cd /Users/lucas/viben-workspace/Viben-tunnel-auth-updates && pnpm tsc --noEmit`

Fix any type errors from the interface change. Check for any imports of the deleted `server.ts`.

- [ ] **Step 5: Run tests**

Run: `cd /Users/lucas/viben-workspace/Viben-tunnel-auth-updates && pnpm vitest run`

Expected: Tunnel tests may need adjustment if they call `start()` without apiPort. Fix accordingly — pass a dummy port (e.g., `3100`).

- [ ] **Step 6: Commit**

```bash
git add src/core/plugin/types.ts src/plugins/tunnel/tunnel-service.ts
git rm src/plugins/tunnel/server.ts
git commit -m "refactor(tunnel): remove Hono server, accept apiPort in TunnelService.start()"
```

---

### Task 6: Integrate Keepalive into TunnelRegistry

**Files:**
- Modify: `src/plugins/tunnel/tunnel-registry.ts`

- [ ] **Step 1: Add keepalive to TunnelRegistry**

In `src/plugins/tunnel/tunnel-registry.ts`:

1. Import: `import { TunnelKeepAlive } from './keepalive.js'`
2. Add field: `private keepalive = new TunnelKeepAlive()`
3. In the `add()` method, after a system tunnel becomes active (has `publicUrl`), start keepalive:

```typescript
// After the line where entry.status = 'active' and entry.publicUrl is set:
if (opts.type === 'system' && entry.publicUrl) {
  this.keepalive.start(entry.publicUrl, () => {
    log.warn('Tunnel keepalive detected dead tunnel, restarting...')
    // Clear publicUrl so getPublicUrl() falls back to localhost
    entry.publicUrl = undefined
    entry.status = 'failed'
    // Kill process to trigger onExit → retry
    if (live) live.process.stop()
  })
}
```

4. In the `onExit` handler (process crash), stop keepalive before retry:

```typescript
// At the start of onExit handler:
if (entry.type === 'system') {
  this.keepalive.stop()
}
```

5. In `shutdown()`, stop keepalive:

```typescript
// At the start of shutdown():
this.keepalive.stop()
```

- [ ] **Step 2: Run existing tunnel tests + keepalive tests**

Run: `cd /Users/lucas/viben-workspace/Viben-tunnel-auth-updates && pnpm vitest run src/plugins/tunnel/`

Expected: ALL PASS

- [ ] **Step 3: Commit**

```bash
git add src/plugins/tunnel/tunnel-registry.ts
git commit -m "feat(tunnel): integrate keepalive ping into TunnelRegistry for system tunnel"
```

---

### Task 7: Tunnel Plugin — Register Viewer Routes + Auto-Start

**Files:**
- Modify: `src/plugins/tunnel/index.ts`

- [ ] **Step 1: Update tunnel plugin dependencies and setup**

In `src/plugins/tunnel/index.ts`:

1. Add `'@viben/api-server'` to the plugin's `dependencies` array.

2. Import viewer routes: `import { createViewerRoutes } from './viewer-routes.js'`

3. In the `setup()` hook, register viewer routes AND update start() call. The existing flow is: construct TunnelService → await `start()` → register service. Modify to:

```typescript
// Get API server service (new dependency)
const apiServer = ctx.getService<ApiServerService>('api-server')

// Register viewer routes in API server (replaces Hono viewer server)
if (apiServer) {
  const viewerRoutes = createViewerRoutes(tunnelSvc.getStore())
  apiServer.registerPlugin('/', viewerRoutes, { auth: false })
} else {
  ctx.log.warn('API server not available — viewer links will be unavailable')
}

// Start tunnel — pass API server port instead of booting separate Hono server
const apiPort = apiServer?.getPort() ?? 0
const publicUrl = await tunnelSvc.start(apiPort)

// Register service (existing code)
ctx.registerService('tunnel', tunnelSvc)
```

The existing `start()` call already creates the system tunnel when provider is configured. If `tunnel.enabled` is true and provider exists, tunnel starts automatically during `setup()`. No event listening needed — this follows the existing pattern where tunnel is awaited directly in setup().

6. Add deprecation warnings for old config fields:

```typescript
if (config.port) {
  ctx.log.warn('tunnel.port is deprecated and ignored — tunnel now uses API server port')
}
if (config.auth?.enabled) {
  ctx.log.warn('tunnel.auth is deprecated and ignored — viewer routes are now public')
}
```

- [ ] **Step 2: Verify compilation**

Run: `cd /Users/lucas/viben-workspace/Viben-tunnel-auth-updates && pnpm tsc --noEmit`

- [ ] **Step 3: Run tests**

Run: `cd /Users/lucas/viben-workspace/Viben-tunnel-auth-updates && pnpm vitest run`

Expected: Same baseline.

- [ ] **Step 4: Commit**

```bash
git add src/plugins/tunnel/index.ts
git commit -m "feat(tunnel): register viewer routes in API server, auto-start tunnel on boot"
```

---

### Task 8: Update Startup Display

**Files:**
- Modify: `src/main.ts`

- [ ] **Step 1: Update startup display in main.ts**

Find the startup display block (around lines 420-441). Replace the tunnel and API server display section with:

```typescript
if (isForegroundTTY) {
  if (spinner) spinner.stop()
  const ok = (msg: string) => console.log(`\x1b[32m✓\x1b[0m ${msg}`)
  const warn = (msg: string) => console.log(`\x1b[33m⚠\x1b[0m  ${msg}`)
  const spin = (msg: string) => console.log(`\x1b[36m⟳\x1b[0m ${msg}`)

  ok('Config loaded')
  ok('Dependencies checked')

  const tunnelSvc = core.lifecycleManager.serviceRegistry.get<TunnelService>('tunnel')
  let tunnelUrl: string | null = null
  if (tunnelSvc) {
    const tunnelErr = tunnelSvc.getStartError()
    const url = tunnelSvc.getPublicUrl()
    const isPublic = url && !url.startsWith('http://localhost') && !url.startsWith('http://127.0.0.1')
    if (tunnelErr) {
      warn(`Tunnel failed (${tunnelErr}) — retrying in background`)
    } else if (isPublic) {
      ok('Tunnel ready')
      tunnelUrl = url
    } else {
      spin('Tunnel connecting...')
    }
  }

  for (const [name] of core.adapters) {
    ok(`${name.charAt(0).toUpperCase() + name.slice(1)} connected`)
  }

  const apiSvc = core.lifecycleManager.serviceRegistry.get('api-server')
  const apiPort = config.api?.port ?? 21420
  if (apiSvc) ok(`API server on port ${apiPort}`)

  // Links as plain text — easily copyable
  console.log('')
  console.log(`Local:  http://localhost:${apiPort}`)
  if (tunnelUrl) {
    console.log(`Tunnel: ${tunnelUrl}`)
  }

  console.log(`\nViben is running. Press Ctrl+C to stop.\n`)
  unmuteLogger()
}
```

- [ ] **Step 2: Verify compilation**

Run: `cd /Users/lucas/viben-workspace/Viben-tunnel-auth-updates && pnpm tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/main.ts
git commit -m "feat(display): show copyable links outside status checkmarks on startup"
```

---

### Task 9: Update `viben remote` Command

**Files:**
- Modify: `src/cli/commands/remote.ts`

- [ ] **Step 1: Update remote command to use /auth/codes**

In `src/cli/commands/remote.ts`:

1. Change the API call from `POST /api/v1/auth/tokens` to `POST /api/v1/auth/codes`:

```typescript
// Before:
const tokenRes = await fetch(`http://127.0.0.1:${port}/api/v1/auth/tokens`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${secret}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ role, name: tokenName, expire }),
})

// After:
const codeRes = await fetch(`http://127.0.0.1:${port}/api/v1/auth/codes`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${secret}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ role, name: tokenName, expire }),
})
const { code, expiresAt: codeExpiresAt } = await codeRes.json()
```

2. Update link generation — use `?code=` instead of `?token=`:

```typescript
const localUrl = `http://127.0.0.1:${port}?code=${code}`
const tunnelLink = tunnelUrl ? `${tunnelUrl}?code=${code}` : null
const appLink = tunnelUrl
  ? `viben://connect?host=${new URL(tunnelUrl).host}&code=${code}`
  : null
```

3. Rewrite output format — metadata in box, links outside as plain text:

```typescript
const W = 64
const line = '─'.repeat(W - 4)

// Box with metadata
console.log(`  ┌${line}┐`)
console.log(`  │  Remote Access${' '.repeat(W - 4 - 15)}│`)
console.log(`  ├${line}┤`)
console.log(`  │  Token:   ${tokenName}${' '.repeat(Math.max(0, W - 4 - 11 - tokenName.length))}│`)
console.log(`  │  Role:    ${role}${' '.repeat(Math.max(0, W - 4 - 11 - role.length))}│`)
console.log(`  │  Expires: ${expireDisplay}${' '.repeat(Math.max(0, W - 4 - 11 - expireDisplay.length))}│`)
console.log(`  └${line}┘`)

// Links as plain text — copyable
console.log('')
console.log('Local:')
console.log(localUrl)

if (tunnelLink) {
  console.log('')
  console.log('Tunnel:')
  console.log(tunnelLink)
}

if (appLink) {
  console.log('')
  console.log('App:')
  console.log(appLink)
}

// QR code
if (!noQr && (tunnelLink || localUrl)) {
  console.log('')
  qrcode.generate(tunnelLink || localUrl, { small: true })
}

// Warning
console.log('')
console.log('\x1b[33m⚠\x1b[0m  Code expires in 30 minutes and can only be used once.')
if (!tunnelLink) {
  console.log('\x1b[33m⚠\x1b[0m  No tunnel available — local link only works on same machine.')
}
```

- [ ] **Step 2: Verify compilation**

Run: `cd /Users/lucas/viben-workspace/Viben-tunnel-auth-updates && pnpm tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/cli/commands/remote.ts
git commit -m "feat(remote): use one-time codes, show copyable links outside box"
```

---

### Task 10: Remove Hono Dependencies + Config Deprecation

**Files:**
- Modify: `package.json`
- Modify: Tunnel config schema (wherever it's defined, likely in `src/plugins/tunnel/index.ts` or a config file)

- [ ] **Step 1: Remove hono and @hono/node-server from package.json**

Run:

```bash
cd /Users/lucas/viben-workspace/Viben-tunnel-auth-updates && pnpm remove hono @hono/node-server
```

- [ ] **Step 2: Verify no remaining imports of hono**

Search for any remaining `from 'hono'` or `from '@hono/node-server'` imports:

```bash
grep -r "from 'hono'" src/ || echo "No hono imports found"
grep -r "from '@hono/node-server'" src/ || echo "No @hono/node-server imports found"
```

If any found (other than deleted server.ts), remove them.

- [ ] **Step 3: Run full test suite**

Run: `cd /Users/lucas/viben-workspace/Viben-tunnel-auth-updates && pnpm vitest run`

Expected: Same baseline. No hono-related failures since server.ts was deleted and viewer-routes.ts uses Fastify.

- [ ] **Step 4: Verify build**

Run: `cd /Users/lucas/viben-workspace/Viben-tunnel-auth-updates && pnpm build`

Expected: Clean build with no errors.

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: remove hono dependencies (viewer server merged into API server)"
```

---

### Task 11: Final Integration Verification

**Files:** None (verification only)

- [ ] **Step 1: Run full test suite**

```bash
cd /Users/lucas/viben-workspace/Viben-tunnel-auth-updates && pnpm vitest run
```

Expected: 167+ test files pass (2 pre-existing failures in multi-instance OK).

- [ ] **Step 2: Run build**

```bash
cd /Users/lucas/viben-workspace/Viben-tunnel-auth-updates && pnpm build
```

Expected: Clean build, no errors.

- [ ] **Step 3: Verify TypeScript strict mode**

```bash
cd /Users/lucas/viben-workspace/Viben-tunnel-auth-updates && pnpm tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 4: Quick manual smoke test (optional)**

Start the server and verify:
- Startup display shows links below checkmarks
- `viben remote` generates code-based links
- Viewer routes accessible at `/view/`, `/diff/`, `/output/` on API server port

- [ ] **Step 5: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: integration fixes from final verification"
```
