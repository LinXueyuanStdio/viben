# Remote Identity Claim — Server Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `identitySecret` to token lifecycle and extend `POST /identity/setup` with a reconnect re-link path and username support.

**Architecture:** `identitySecret` is a random 32-char hex string generated alongside each token, never embedded in the JWT, and returned at exchange/creation time. It enables the App to silently re-link a new token to an existing user identity on reconnect. The identity setup route gains a new path keyed by this secret.

**Tech Stack:** TypeScript, Fastify, Vitest, `node:crypto`

**Spec:** `docs/superpowers/specs/2026-04-14-remote-identity-claim-design.md`

**Dependency:** App plan (`Viben-App`) depends on these server changes being deployed first.

---

## File Map

| File | Change |
|---|---|
| `src/plugins/api-server/auth/types.ts` | Add `identitySecret: string` to `StoredToken`; add `identitySecret` to `TokenInfo` |
| `src/plugins/api-server/auth/token-store.ts` | Generate secret in `create()`; add `getByIdentitySecret()`; migrate old tokens in `load()` |
| `src/plugins/api-server/index.ts` | Return `identitySecret` in exchange response |
| `src/plugins/api-server/routes/auth.ts` | Return `identitySecret` in `POST /tokens` response |
| `src/plugins/identity/routes/setup.ts` | Add `identitySecret` re-link path; add `username` to new-user path; extend `SetupDeps.tokenStore` type |
| `src/plugins/api-server/__tests__/auth-codes.test.ts` | Add tests for `identitySecret` on `create()`, `getByIdentitySecret()`, migration |
| `src/plugins/api-server/__tests__/auth-exchange.test.ts` | Assert exchange response includes `identitySecret` |
| `src/plugins/identity/__tests__/identity-setup.test.ts` | New: test `identitySecret` re-link path and `username` in new-user path |

---

## Task 1: Add `identitySecret` to `StoredToken` and `TokenInfo` types

**Files:**
- Modify: `src/plugins/api-server/auth/types.ts`

- [ ] **Step 1: Add `identitySecret` to `StoredToken` and `TokenInfo`**

In `src/plugins/api-server/auth/types.ts`, update both interfaces:

```typescript
/** A token record persisted in tokens.json. Tokens are never deleted; they are revoked by flag. */
export interface StoredToken {
  id: string;
  name: string;
  role: string;
  /** Custom scope overrides; when absent, role defaults from ROLES apply. */
  scopes?: string[];
  createdAt: string;
  /** Absolute deadline after which the token cannot be refreshed — requires re-authentication. */
  refreshDeadline: string;
  lastUsedAt?: string;
  revoked: boolean;
  /** User ID from identity system. Null until user completes /identity/setup. */
  userId?: string;
  /**
   * Per-token secret for identity re-linking on reconnect.
   * Never embedded in the JWT — only returned at token creation/exchange time.
   * The App stores this in its workspace store and uses it to silently re-link
   * a new token to the same user after the old token's refresh deadline expires.
   */
  identitySecret: string;
}
```

```typescript
/** Shape returned to the caller when a new token is issued. */
export interface TokenInfo {
  tokenId: string;
  accessToken: string;
  expiresAt: string;
  refreshDeadline: string;
  /** Opaque secret for identity re-linking. See StoredToken.identitySecret. */
  identitySecret: string;
}
```

- [ ] **Step 2: Verify TypeScript compiles (no test needed — type-only change)**

```bash
cd /Users/lucas/code/viben-workspace/Viben && pnpm build 2>&1 | head -30
```

Expected: compile errors on `token-store.ts` (missing `identitySecret` in `create()`) — that's expected, Task 2 fixes it.

---

## Task 2: Generate `identitySecret` in `TokenStore`, add lookup, migrate old tokens

**Files:**
- Modify: `src/plugins/api-server/auth/token-store.ts`
- Modify: `src/plugins/api-server/__tests__/auth-codes.test.ts`

- [ ] **Step 1: Write failing tests**

Add to `src/plugins/api-server/__tests__/auth-codes.test.ts`, after the existing describe block:

```typescript
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

    freshStore.destroy()
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /Users/lucas/code/viben-workspace/Viben && pnpm test src/plugins/api-server/__tests__/auth-codes.test.ts 2>&1 | tail -20
```

Expected: FAIL — `token.identitySecret` is undefined, `getByIdentitySecret` is not a function.

- [ ] **Step 3: Implement `identitySecret` in `token-store.ts`**

In `src/plugins/api-server/auth/token-store.ts`, make these changes:

**In `create()`** — add `identitySecret` to the token object:

```typescript
create(opts: CreateTokenOpts): StoredToken {
  const now = new Date();
  const token: StoredToken = {
    id: generateTokenId(),
    identitySecret: randomBytes(16).toString('hex'),
    name: opts.name,
    role: opts.role,
    scopes: opts.scopes,
    createdAt: now.toISOString(),
    refreshDeadline: new Date(now.getTime() + REFRESH_DEADLINE_MS).toISOString(),
    revoked: false,
  };
  this.tokens.set(token.id, token);
  this.scheduleSave();
  return token;
}
```

**In `load()`** — add migration inside the token loop, just before `this.tokens.set`:

```typescript
async load(): Promise<void> {
  try {
    const data = await readFile(this.filePath, 'utf-8');
    let parsed: { tokens: StoredToken[]; codes?: StoredCode[] };
    try {
      parsed = JSON.parse(data) as { tokens: StoredToken[]; codes?: StoredCode[] };
    } catch {
      console.warn(`[TokenStore] Failed to parse ${this.filePath} — retaining existing tokens`);
      return;
    }
    this.tokens.clear();
    let needsMigration = false;
    for (const token of parsed.tokens) {
      // Migrate tokens created before identitySecret was introduced
      if (!token.identitySecret) {
        token.identitySecret = randomBytes(16).toString('hex');
        needsMigration = true;
      }
      this.tokens.set(token.id, token);
    }
    this.codes.clear();
    for (const code of parsed.codes ?? []) {
      this.codes.set(code.code, code);
    }
    // Persist migrated secrets so they survive the next restart
    if (needsMigration) this.scheduleSave();
  } catch {
    this.tokens.clear();
    this.codes.clear();
  }
}
```

**Add `getByIdentitySecret()` method** after `getUserId()`:

```typescript
/**
 * Looks up a non-revoked token by its identity secret.
 *
 * Used by the identity re-link flow: the App sends the old token's identitySecret
 * to prove continuity of identity when reconnecting with a new JWT.
 * Returns undefined if no match, or if the matching token is revoked.
 */
getByIdentitySecret(secret: string): StoredToken | undefined {
  for (const token of this.tokens.values()) {
    if (!token.revoked && token.identitySecret === secret) return token;
  }
  return undefined;
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd /Users/lucas/code/viben-workspace/Viben && pnpm test src/plugins/api-server/__tests__/auth-codes.test.ts 2>&1 | tail -20
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/lucas/code/viben-workspace/Viben
git add src/plugins/api-server/auth/types.ts src/plugins/api-server/auth/token-store.ts src/plugins/api-server/__tests__/auth-codes.test.ts
git commit -m "feat(auth): add identitySecret to StoredToken for identity re-linking

Each token now carries a random 32-char hex identitySecret, separate from
the JWT payload, that the App can use to re-link identity on reconnect.
Includes migration for existing tokens loaded from disk."
```

---

## Task 3: Return `identitySecret` in exchange and token creation responses

**Files:**
- Modify: `src/plugins/api-server/index.ts`
- Modify: `src/plugins/api-server/routes/auth.ts`
- Modify: `src/plugins/api-server/__tests__/auth-exchange.test.ts`

- [ ] **Step 1: Write failing test for exchange response**

In `src/plugins/api-server/__tests__/auth-exchange.test.ts`, update the exchange handler in `beforeEach` and add a new test. First update the inline exchange handler to return `identitySecret`:

```typescript
// In beforeEach, update the reply.send call:
return reply.send({
  accessToken,
  tokenId: token.id,
  expiresAt: new Date(Date.now() + parseDuration(code.expire)).toISOString(),
  refreshDeadline: token.refreshDeadline,
  identitySecret: token.identitySecret,  // ← add
})
```

Then add this test after the existing ones:

```typescript
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
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd /Users/lucas/code/viben-workspace/Viben && pnpm test src/plugins/api-server/__tests__/auth-exchange.test.ts 2>&1 | tail -20
```

Expected: FAIL — `body.identitySecret` is undefined (test handler not updated yet in real code).

- [ ] **Step 3: Update exchange response in `index.ts`**

Find the exchange endpoint handler in `src/plugins/api-server/index.ts` and update the `reply.send` call:

```typescript
return reply.send({
  accessToken,
  tokenId: stored.id,
  expiresAt: new Date(Date.now() + parseDuration(code.expire)).toISOString(),
  refreshDeadline: stored.refreshDeadline,
  identitySecret: stored.identitySecret,
})
```

- [ ] **Step 4: Update `POST /tokens` response in `routes/auth.ts`**

Find the `POST /tokens` handler and update the return:

```typescript
return {
  tokenId: stored.id,
  accessToken,
  expiresAt,
  refreshDeadline: stored.refreshDeadline,
  identitySecret: stored.identitySecret,
};
```

- [ ] **Step 5: Run all auth tests to confirm they pass**

```bash
cd /Users/lucas/code/viben-workspace/Viben && pnpm test src/plugins/api-server/__tests__/ 2>&1 | tail -20
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
cd /Users/lucas/code/viben-workspace/Viben
git add src/plugins/api-server/index.ts src/plugins/api-server/routes/auth.ts src/plugins/api-server/__tests__/auth-exchange.test.ts
git commit -m "feat(auth): return identitySecret in exchange and token creation responses"
```

---

## Task 4: Extend `POST /identity/setup` — `identitySecret` re-link path + `username`

**Files:**
- Modify: `src/plugins/identity/routes/setup.ts`
- Create: `src/plugins/identity/__tests__/identity-setup-routes.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/plugins/identity/__tests__/identity-setup-routes.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { TokenStore } from '../../api-server/auth/token-store.js'
import { createApiServer } from '../../api-server/server.js'
import type { ApiServerInstance } from '../../api-server/server.js'
import { registerSetupRoutes } from '../routes/setup.js'
import { IdentityServiceImpl } from '../identity-service.js'
import type { IdentityStore } from '../store/identity-store.js'
import type { UserRecord, IdentityRecord, IdentityId } from '../types.js'
import { signToken } from '../../api-server/auth/jwt.js'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const JWT_SECRET = 'test-jwt-secret-32charslong!!!!!'
const API_SECRET = 'test-api-secret'

// In-memory identity store — same pattern as identity-service.test.ts
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
      if (filter?.source) all = all.filter((u) => u.identities.some((id) => id.startsWith(`${filter.source}:`)))
      return all
    },
    getIdentity: async (id) => identities.get(id),
    putIdentity: async (record) => { identities.set(record.identityId, record) },
    deleteIdentity: async (id) => { identities.delete(id) },
    getIdentitiesForUser: async (userId) => {
      const user = users.get(userId)
      if (!user) return []
      return user.identities.map((id) => identities.get(id)).filter((r): r is IdentityRecord => r !== undefined)
    },
    getUserIdByUsername: async (username) => usernameIdx.get(username.toLowerCase()),
    getIdentityIdBySource: async (source, platformId) => sourceIdx.get(`${source}/${platformId}`),
    setUsernameIndex: async (username, userId) => { usernameIdx.set(username.toLowerCase(), userId) },
    deleteUsernameIndex: async (username) => { usernameIdx.delete(username.toLowerCase()) },
    setSourceIndex: async (source, platformId, identityId) => { sourceIdx.set(`${source}/${platformId}`, identityId) },
    deleteSourceIndex: async (source, platformId) => { sourceIdx.delete(`${source}/${platformId}`) },
    getUserCount: async () => users.size,
  }
}

describe('POST /identity/setup', () => {
  let server: ApiServerInstance
  let tokenStore: TokenStore
  let service: IdentityServiceImpl
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'identity-setup-test-'))
    const tokensPath = path.join(tmpDir, 'tokens.json')
    tokenStore = new TokenStore(tokensPath)
    await tokenStore.load()

    service = new IdentityServiceImpl(createMemoryStore(), () => {})

    server = await createApiServer({
      port: 0,
      host: '127.0.0.1',
      getSecret: () => API_SECRET,
      getJwtSecret: () => JWT_SECRET,
      tokenStore,
    })

    // Register identity setup routes with default auth middleware
    server.registerPlugin('/api/v1/identity', async (app) => {
      registerSetupRoutes(app, { service, tokenStore })
    })

    await server.app.ready()
  })

  afterEach(async () => {
    await server.stop()
    await tokenStore.flush()
    tokenStore.destroy()
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  function makeJwt(tokenId: string): string {
    const token = tokenStore.get(tokenId)!
    const rfd = new Date(token.refreshDeadline).getTime() / 1000
    return signToken({ sub: tokenId, role: token.role, rfd }, JWT_SECRET, '24h')
  }

  // --- identitySecret re-link path ---

  it('re-links new token to existing user via identitySecret', async () => {
    // Arrange: create old token with linked identity
    const oldToken = tokenStore.create({ role: 'admin', name: 'old-session', expire: '24h' })
    const { user } = await service.createUserWithIdentity({
      displayName: 'Lucas',
      source: 'api',
      platformId: oldToken.id,
    })
    tokenStore.setUserId(oldToken.id, user.userId)

    // Arrange: create new token (simulates reconnect after exchange)
    const newToken = tokenStore.create({ role: 'admin', name: 'new-session', expire: '24h' })
    const jwt = makeJwt(newToken.id)

    // Act: call /identity/setup with old token's identitySecret
    const res = await server.app.inject({
      method: 'POST',
      url: '/api/v1/identity/setup',
      headers: { Authorization: `Bearer ${jwt}` },
      payload: { identitySecret: oldToken.identitySecret },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.displayName).toBe('Lucas')
    // New token should now have the same userId
    expect(tokenStore.getUserId(newToken.id)).toBe(user.userId)
  })

  it('returns 401 for unknown identitySecret', async () => {
    const token = tokenStore.create({ role: 'admin', name: 'test', expire: '24h' })
    const jwt = makeJwt(token.id)

    const res = await server.app.inject({
      method: 'POST',
      url: '/api/v1/identity/setup',
      headers: { Authorization: `Bearer ${jwt}` },
      payload: { identitySecret: 'a'.repeat(32) },
    })

    expect(res.statusCode).toBe(401)
  })

  it('returns 401 if matching token has no linked identity', async () => {
    // oldToken exists but was never claimed
    const oldToken = tokenStore.create({ role: 'admin', name: 'unclaimed', expire: '24h' })
    const newToken = tokenStore.create({ role: 'admin', name: 'new', expire: '24h' })
    const jwt = makeJwt(newToken.id)

    const res = await server.app.inject({
      method: 'POST',
      url: '/api/v1/identity/setup',
      headers: { Authorization: `Bearer ${jwt}` },
      payload: { identitySecret: oldToken.identitySecret },
    })

    expect(res.statusCode).toBe(401)
  })

  it('is idempotent — re-linking already-linked token returns existing user', async () => {
    const token = tokenStore.create({ role: 'admin', name: 'linked', expire: '24h' })
    const { user } = await service.createUserWithIdentity({
      displayName: 'Lucas',
      source: 'api',
      platformId: token.id,
    })
    tokenStore.setUserId(token.id, user.userId)
    const jwt = makeJwt(token.id)

    // Call setup again — should return same user, not error
    const res = await server.app.inject({
      method: 'POST',
      url: '/api/v1/identity/setup',
      headers: { Authorization: `Bearer ${jwt}` },
      payload: { displayName: 'Should Not Create New User' },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().userId).toBe(user.userId)
  })

  // --- username in new-user path ---

  it('creates user with displayName and username', async () => {
    const token = tokenStore.create({ role: 'admin', name: 'new-user', expire: '24h' })
    const jwt = makeJwt(token.id)

    const res = await server.app.inject({
      method: 'POST',
      url: '/api/v1/identity/setup',
      headers: { Authorization: `Bearer ${jwt}` },
      payload: { displayName: 'Lucas Chen', username: 'lucas' },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.displayName).toBe('Lucas Chen')
    expect(body.username).toBe('lucas')
  })

  it('creates user with displayName only (username optional)', async () => {
    const token = tokenStore.create({ role: 'admin', name: 'no-username', expire: '24h' })
    const jwt = makeJwt(token.id)

    const res = await server.app.inject({
      method: 'POST',
      url: '/api/v1/identity/setup',
      headers: { Authorization: `Bearer ${jwt}` },
      payload: { displayName: 'Lucas Chen' },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().displayName).toBe('Lucas Chen')
  })

  it('returns 400 if no recognized path (no displayName, no linkCode, no identitySecret)', async () => {
    const token = tokenStore.create({ role: 'admin', name: 'bad', expire: '24h' })
    const jwt = makeJwt(token.id)

    const res = await server.app.inject({
      method: 'POST',
      url: '/api/v1/identity/setup',
      headers: { Authorization: `Bearer ${jwt}` },
      payload: {},
    })

    expect(res.statusCode).toBe(400)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /Users/lucas/code/viben-workspace/Viben && pnpm test src/plugins/identity/__tests__/identity-setup-routes.test.ts 2>&1 | tail -30
```

Expected: FAIL — `identitySecret` path not implemented, username not passed to `createUserWithIdentity`.

- [ ] **Step 3: Update `setup.ts`**

Replace `src/plugins/identity/routes/setup.ts` with:

```typescript
import { randomBytes } from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import type { IdentityServiceImpl } from '../identity-service.js'

interface SetupDeps {
  service: IdentityServiceImpl
  tokenStore:
    | {
        getUserId(tokenId: string): string | undefined
        setUserId(tokenId: string, userId: string): void
        getByIdentitySecret(secret: string): { id: string } | undefined
      }
    | undefined
}

/**
 * Short-lived in-memory link codes for multi-device account linking.
 *
 * These are intentionally not persisted: a restart invalidates all pending codes,
 * which is acceptable given the 5-minute TTL. Persistence would add complexity
 * (storage, migration) for minimal practical benefit.
 */
const linkCodes = new Map<string, { userId: string; expiresAt: number }>()

/**
 * Registers identity setup routes under the plugin's prefix (e.g. /api/v1/identity).
 *
 * POST /setup — first-time identity claim for API token holders.
 * POST /link-code — generate a one-time code to link a second device/token.
 *
 * Three paths for POST /setup (checked in priority order):
 * 1. Token already linked → idempotent return of existing user.
 * 2. identitySecret → re-link new token to existing user (reconnect flow).
 * 3. linkCode → link to existing user via short-lived link code (multi-device).
 * 4. displayName → create new user (first-time setup).
 */
export function registerSetupRoutes(app: FastifyInstance, deps: SetupDeps): void {
  const { service, tokenStore } = deps

  app.post('/setup', async (request, reply) => {
    const auth = (request as any).auth
    if (!auth?.tokenId) return reply.status(401).send({ error: 'JWT required' })

    // Path 1: idempotent — token already linked, return existing user
    const existingUserId = tokenStore?.getUserId?.(auth.tokenId)
    if (existingUserId) {
      const user = await service.getUser(existingUserId)
      if (user) return user
    }

    const body = request.body as any

    // Path 2: re-link via identitySecret — silent reconnect flow.
    // The App holds the old token's identitySecret and sends it to link the
    // new token to the same user without requiring manual re-setup.
    if (body?.identitySecret) {
      const oldToken = tokenStore?.getByIdentitySecret(body.identitySecret as string)
      if (!oldToken) {
        return reply.status(401).send({ error: 'Invalid identity secret' })
      }
      const userId = tokenStore?.getUserId(oldToken.id)
      if (!userId) {
        return reply.status(401).send({ error: 'No identity linked to this secret' })
      }
      await service.createIdentity(userId, {
        source: 'api',
        platformId: auth.tokenId as string,
      })
      tokenStore?.setUserId?.(auth.tokenId as string, userId)
      return service.getUser(userId)
    }

    // Path 3: link-code — multi-device linking
    if (body?.linkCode) {
      const entry = linkCodes.get(body.linkCode as string)
      if (!entry || entry.expiresAt < Date.now()) {
        return reply.status(401).send({ error: 'Invalid or expired link code' })
      }
      linkCodes.delete(body.linkCode as string)

      await service.createIdentity(entry.userId, {
        source: 'api',
        platformId: auth.tokenId as string,
      })

      tokenStore?.setUserId?.(auth.tokenId as string, entry.userId)
      return service.getUser(entry.userId)
    }

    // Path 4: new user — displayName required, username optional
    if (!body?.displayName) return reply.status(400).send({ error: 'displayName is required' })

    const { user } = await service.createUserWithIdentity({
      displayName: body.displayName as string,
      username: body.username as string | undefined,
      source: 'api',
      platformId: auth.tokenId as string,
    })

    tokenStore?.setUserId?.(auth.tokenId as string, user.userId)
    return user
  })

  // POST /link-code — generate a one-time code so another token can link to this user.
  // The caller must already have a linked identity. Code expires in 5 minutes.
  app.post('/link-code', async (request, reply) => {
    const auth = (request as any).auth
    if (!auth?.tokenId) return reply.status(401).send({ error: 'JWT required' })

    const userId = tokenStore?.getUserId?.(auth.tokenId as string)
    if (!userId) return reply.status(403).send({ error: 'Identity not set up' })

    const code = randomBytes(16).toString('hex')
    const expiresAt = Date.now() + 5 * 60 * 1000

    // Evict stale codes before inserting to keep the map bounded
    for (const [k, v] of linkCodes) {
      if (v.expiresAt < Date.now()) linkCodes.delete(k)
    }

    linkCodes.set(code, { userId, expiresAt })
    return { linkCode: code, expiresAt: new Date(expiresAt).toISOString() }
  })
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd /Users/lucas/code/viben-workspace/Viben && pnpm test src/plugins/identity/__tests__/identity-setup-routes.test.ts 2>&1 | tail -20
```

Expected: all tests PASS.

- [ ] **Step 5: Run full test suite to confirm no regressions**

```bash
cd /Users/lucas/code/viben-workspace/Viben && pnpm test 2>&1 | tail -20
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
cd /Users/lucas/code/viben-workspace/Viben
git add src/plugins/identity/routes/setup.ts src/plugins/identity/__tests__/identity-setup-routes.test.ts
git commit -m "feat(identity): add identitySecret re-link path and username to POST /identity/setup

Reconnect flow: App sends old token's identitySecret to silently re-link
a new token to the same user identity after refresh deadline expires.
New-user path now accepts optional username alongside displayName."
```
