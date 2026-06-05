# Auth System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement two-tier authentication (secret token + JWT) with stateful token management, role-based access control, and scope-based authorization for the Fastify API server.

**Architecture:** Auth middleware created in Plan 1 is extended with full JWT support. TokenStore manages stateful token lifecycle (create, refresh, revoke). JWT signing uses HMAC-SHA256 with a separate secret. Roles (admin/operator/viewer) have default scope mappings with optional per-token overrides.

**Tech Stack:** jsonwebtoken (JWT signing/verification), existing Zod for validation, existing crypto for secret generation

**Spec:** [docs/superpowers/specs/2026-03-31-auth-system-design.md](../specs/2026-03-31-auth-system-design.md)
**Depends on:** [Plan 1: API Server Core](./2026-03-31-api-server-core.md) (must be completed first)

---

## File Structure

```
src/plugins/api-server/
  auth/
    token-store.ts      — CREATE: Stateful token storage (in-memory + JSON persist)
    jwt.ts              — CREATE: JWT sign/verify/refresh logic
    roles.ts            — CREATE: Role definitions and scope mappings
    types.ts            — CREATE: Auth interfaces (StoredToken, JwtPayload, etc.)
  middleware/
    auth.ts             — MODIFY: Extend stub with full JWT verification
  routes/
    auth.ts             — CREATE: Auth endpoints (generate, refresh, revoke, me, list)
  schemas/
    auth.ts             — CREATE: Zod schemas for auth endpoints
```

---

## Task 1: Define Auth Types and Role Mappings

**Files:**
- Create: `src/plugins/api-server/auth/types.ts`
- Create: `src/plugins/api-server/auth/roles.ts`
- Test: `src/plugins/api-server/__tests__/roles.test.ts`

- [ ] **Step 1: Write failing tests for role mappings**

```typescript
// src/plugins/api-server/__tests__/roles.test.ts
import { describe, it, expect } from 'vitest';
import { getRoleScopes, hasScope, ROLES, isValidRole } from '../auth/roles.js';

describe('roles', () => {
  it('admin has wildcard scope', () => {
    expect(getRoleScopes('admin')).toEqual(['*']);
  });

  it('operator has session and agent scopes but not config:write', () => {
    const scopes = getRoleScopes('operator');
    expect(scopes).toContain('sessions:read');
    expect(scopes).toContain('sessions:write');
    expect(scopes).toContain('sessions:prompt');
    expect(scopes).toContain('sessions:permission');
    expect(scopes).toContain('agents:read');
    expect(scopes).toContain('commands:execute');
    expect(scopes).toContain('system:health');
    expect(scopes).not.toContain('config:write');
    expect(scopes).not.toContain('system:admin');
    expect(scopes).not.toContain('auth:manage');
  });

  it('viewer has read-only scopes', () => {
    const scopes = getRoleScopes('viewer');
    expect(scopes).toContain('sessions:read');
    expect(scopes).toContain('agents:read');
    expect(scopes).toContain('system:health');
    expect(scopes).not.toContain('sessions:write');
    expect(scopes).not.toContain('sessions:prompt');
  });

  it('hasScope checks wildcard', () => {
    expect(hasScope(['*'], 'anything:here')).toBe(true);
  });

  it('hasScope checks exact match', () => {
    expect(hasScope(['sessions:read', 'agents:read'], 'sessions:read')).toBe(true);
    expect(hasScope(['sessions:read'], 'sessions:write')).toBe(false);
  });

  it('isValidRole validates role names', () => {
    expect(isValidRole('admin')).toBe(true);
    expect(isValidRole('operator')).toBe(true);
    expect(isValidRole('viewer')).toBe(true);
    expect(isValidRole('superadmin')).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm test -- src/plugins/api-server/__tests__/roles.test.ts
```

Expected: FAIL — modules not found.

- [ ] **Step 3: Create auth types**

```typescript
// src/plugins/api-server/auth/types.ts
export interface StoredToken {
  id: string;                // tok_<random>
  name: string;              // "remote-14h30-31-03-2026"
  role: string;              // admin | operator | viewer
  scopes?: string[];         // optional scope override
  createdAt: string;         // ISO 8601
  refreshDeadline: string;   // ISO 8601, 7 days from createdAt
  lastUsedAt?: string;       // ISO 8601
  revoked: boolean;
}

export interface JwtPayload {
  sub: string;               // tokenId
  role: string;
  scopes?: string[];
  iat: number;
  exp: number;
  rfd: number;               // refresh deadline timestamp
}

export interface CreateTokenOpts {
  role: string;
  name: string;
  expire: string;            // "24h", "7d", "30d"
  scopes?: string[];
}

export interface TokenInfo {
  tokenId: string;
  accessToken: string;
  expiresAt: string;
  refreshDeadline: string;
}
```

- [ ] **Step 4: Implement role mappings**

```typescript
// src/plugins/api-server/auth/roles.ts
export const ROLES = {
  admin: ['*'],
  operator: [
    'sessions:read',
    'sessions:write',
    'sessions:prompt',
    'sessions:permission',
    'agents:read',
    'commands:execute',
    'system:health',
  ],
  viewer: ['sessions:read', 'agents:read', 'system:health'],
} as const;

export type RoleName = keyof typeof ROLES;

export function isValidRole(role: string): role is RoleName {
  return role in ROLES;
}

export function getRoleScopes(role: string): string[] {
  if (!isValidRole(role)) return [];
  return [...ROLES[role]];
}

export function hasScope(userScopes: string[], requiredScope: string): boolean {
  if (userScopes.includes('*')) return true;
  return userScopes.includes(requiredScope);
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
pnpm test -- src/plugins/api-server/__tests__/roles.test.ts
```

Expected: All 6 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/plugins/api-server/auth/ src/plugins/api-server/__tests__/roles.test.ts
git commit -m "feat(auth): add role definitions, scope mappings, and auth types"
```

---

## Task 2: Implement TokenStore

**Files:**
- Create: `src/plugins/api-server/auth/token-store.ts`
- Test: `src/plugins/api-server/__tests__/token-store.test.ts`

- [ ] **Step 1: Write failing tests for TokenStore**

```typescript
// src/plugins/api-server/__tests__/token-store.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TokenStore } from '../auth/token-store.js';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('TokenStore', () => {
  let store: TokenStore;
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'token-store-'));
    store = new TokenStore(join(tmpDir, 'tokens.json'));
    await store.load();
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('creates a token with generated ID', () => {
    const token = store.create({ role: 'admin', name: 'test-token', expire: '24h' });

    expect(token.id).toMatch(/^tok_/);
    expect(token.name).toBe('test-token');
    expect(token.role).toBe('admin');
    expect(token.revoked).toBe(false);
    expect(token.createdAt).toBeDefined();
    expect(token.refreshDeadline).toBeDefined();
  });

  it('refresh deadline is 7 days from creation', () => {
    const token = store.create({ role: 'admin', name: 'test', expire: '24h' });
    const created = new Date(token.createdAt).getTime();
    const deadline = new Date(token.refreshDeadline).getTime();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;

    expect(deadline - created).toBe(sevenDays);
  });

  it('gets a token by ID', () => {
    const created = store.create({ role: 'viewer', name: 'get-test', expire: '1h' });
    const found = store.get(created.id);

    expect(found).toBeDefined();
    expect(found!.id).toBe(created.id);
  });

  it('returns undefined for unknown token ID', () => {
    expect(store.get('tok_nonexistent')).toBeUndefined();
  });

  it('revokes a token', () => {
    const token = store.create({ role: 'admin', name: 'revoke-test', expire: '24h' });
    store.revoke(token.id);

    const found = store.get(token.id);
    expect(found!.revoked).toBe(true);
  });

  it('lists all non-revoked tokens', () => {
    store.create({ role: 'admin', name: 'tok-1', expire: '24h' });
    store.create({ role: 'viewer', name: 'tok-2', expire: '24h' });
    const tok3 = store.create({ role: 'operator', name: 'tok-3', expire: '24h' });
    store.revoke(tok3.id);

    const list = store.list();
    expect(list).toHaveLength(2);
  });

  it('updates lastUsedAt', () => {
    const token = store.create({ role: 'admin', name: 'used-test', expire: '24h' });
    expect(token.lastUsedAt).toBeUndefined();

    store.updateLastUsed(token.id);
    const updated = store.get(token.id);
    expect(updated!.lastUsedAt).toBeDefined();
  });

  it('persists to disk and loads back', async () => {
    store.create({ role: 'admin', name: 'persist-test', expire: '24h' });
    await store.save();

    const store2 = new TokenStore(join(tmpDir, 'tokens.json'));
    await store2.load();

    expect(store2.list()).toHaveLength(1);
    expect(store2.list()[0].name).toBe('persist-test');
  });

  it('cleanup removes tokens past refresh deadline', () => {
    const token = store.create({ role: 'admin', name: 'expired', expire: '24h' });
    // Manually set refresh deadline to the past
    const stored = store.get(token.id)!;
    (stored as any).refreshDeadline = new Date(Date.now() - 1000).toISOString();

    store.cleanup();
    expect(store.get(token.id)).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm test -- src/plugins/api-server/__tests__/token-store.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement TokenStore**

```typescript
// src/plugins/api-server/auth/token-store.ts
import { readFile, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import type { StoredToken, CreateTokenOpts } from './types.js';

const REFRESH_DEADLINE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function generateTokenId(): string {
  return `tok_${randomBytes(12).toString('hex')}`;
}

function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)(h|d|m)$/);
  if (!match) throw new Error(`Invalid duration: ${duration}`);
  const value = parseInt(match[1], 10);
  const unit = match[2];
  switch (unit) {
    case 'm':
      return value * 60 * 1000;
    case 'h':
      return value * 60 * 60 * 1000;
    case 'd':
      return value * 24 * 60 * 60 * 1000;
    default:
      throw new Error(`Invalid duration unit: ${unit}`);
  }
}

export class TokenStore {
  private tokens = new Map<string, StoredToken>();

  constructor(private filePath: string) {}

  async load(): Promise<void> {
    try {
      const data = await readFile(this.filePath, 'utf-8');
      const parsed = JSON.parse(data) as { tokens: StoredToken[] };
      this.tokens.clear();
      for (const token of parsed.tokens) {
        this.tokens.set(token.id, token);
      }
    } catch {
      // File doesn't exist yet — start empty
      this.tokens.clear();
    }
  }

  async save(): Promise<void> {
    const data = { tokens: Array.from(this.tokens.values()) };
    await writeFile(this.filePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  create(opts: CreateTokenOpts): StoredToken {
    const now = new Date();
    const token: StoredToken = {
      id: generateTokenId(),
      name: opts.name,
      role: opts.role,
      scopes: opts.scopes,
      createdAt: now.toISOString(),
      refreshDeadline: new Date(now.getTime() + REFRESH_DEADLINE_MS).toISOString(),
      revoked: false,
    };
    this.tokens.set(token.id, token);
    this.save().catch(() => {}); // fire-and-forget persist
    return token;
  }

  get(id: string): StoredToken | undefined {
    return this.tokens.get(id);
  }

  revoke(id: string): void {
    const token = this.tokens.get(id);
    if (token) {
      token.revoked = true;
      this.save().catch(() => {});
    }
  }

  list(): StoredToken[] {
    return Array.from(this.tokens.values()).filter((t) => !t.revoked);
  }

  updateLastUsed(id: string): void {
    const token = this.tokens.get(id);
    if (token) {
      token.lastUsedAt = new Date().toISOString();
      // Don't persist on every request — batch save periodically or on changes
    }
  }

  cleanup(): void {
    const now = Date.now();
    for (const [id, token] of this.tokens) {
      if (new Date(token.refreshDeadline).getTime() < now) {
        this.tokens.delete(id);
      }
    }
    this.save().catch(() => {});
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm test -- src/plugins/api-server/__tests__/token-store.test.ts
```

Expected: All 9 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/plugins/api-server/auth/token-store.ts src/plugins/api-server/__tests__/token-store.test.ts
git commit -m "feat(auth): implement stateful TokenStore with persistence"
```

---

## Task 3: Implement JWT Sign/Verify/Refresh

**Files:**
- Create: `src/plugins/api-server/auth/jwt.ts`
- Test: `src/plugins/api-server/__tests__/jwt.test.ts`

- [ ] **Step 1: Install jsonwebtoken**

```bash
pnpm add jsonwebtoken
pnpm add -D @types/jsonwebtoken
```

- [ ] **Step 2: Write failing tests for JWT operations**

```typescript
// src/plugins/api-server/__tests__/jwt.test.ts
import { describe, it, expect } from 'vitest';
import { signToken, verifyToken, verifyForRefresh } from '../auth/jwt.js';

const JWT_SECRET = 'test-secret-key-for-jwt-signing';

describe('JWT', () => {
  it('signs a token with correct payload', () => {
    const token = signToken(
      { sub: 'tok_123', role: 'admin', rfd: Math.floor(Date.now() / 1000) + 86400 * 7 },
      JWT_SECRET,
      '24h',
    );
    expect(token).toBeDefined();
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3); // JWT format
  });

  it('verifies a valid token', () => {
    const rfd = Math.floor(Date.now() / 1000) + 86400 * 7;
    const token = signToken({ sub: 'tok_123', role: 'operator', rfd }, JWT_SECRET, '24h');
    const payload = verifyToken(token, JWT_SECRET);

    expect(payload.sub).toBe('tok_123');
    expect(payload.role).toBe('operator');
    expect(payload.rfd).toBe(rfd);
  });

  it('rejects an expired token', async () => {
    const rfd = Math.floor(Date.now() / 1000) + 86400 * 7;
    const token = signToken({ sub: 'tok_123', role: 'admin', rfd }, JWT_SECRET, '0s');

    // Wait for token to expire
    await new Promise((r) => setTimeout(r, 1100));

    expect(() => verifyToken(token, JWT_SECRET)).toThrow();
  });

  it('rejects a token with wrong secret', () => {
    const rfd = Math.floor(Date.now() / 1000) + 86400 * 7;
    const token = signToken({ sub: 'tok_123', role: 'admin', rfd }, JWT_SECRET, '24h');

    expect(() => verifyToken(token, 'wrong-secret')).toThrow();
  });

  it('verifyForRefresh accepts expired token but checks signature', () => {
    const rfd = Math.floor(Date.now() / 1000) + 86400 * 7;
    const token = signToken({ sub: 'tok_123', role: 'admin', rfd }, JWT_SECRET, '0s');

    // Even though expired, verifyForRefresh should succeed (ignores exp)
    const payload = verifyForRefresh(token, JWT_SECRET);
    expect(payload.sub).toBe('tok_123');
  });

  it('verifyForRefresh rejects wrong signature', () => {
    const rfd = Math.floor(Date.now() / 1000) + 86400 * 7;
    const token = signToken({ sub: 'tok_123', role: 'admin', rfd }, JWT_SECRET, '0s');

    expect(() => verifyForRefresh(token, 'wrong-secret')).toThrow();
  });

  it('includes scopes in payload when provided', () => {
    const rfd = Math.floor(Date.now() / 1000) + 86400 * 7;
    const token = signToken(
      { sub: 'tok_123', role: 'viewer', scopes: ['sessions:read'], rfd },
      JWT_SECRET,
      '24h',
    );
    const payload = verifyToken(token, JWT_SECRET);
    expect(payload.scopes).toEqual(['sessions:read']);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
pnpm test -- src/plugins/api-server/__tests__/jwt.test.ts
```

Expected: FAIL.

- [ ] **Step 4: Implement JWT module**

```typescript
// src/plugins/api-server/auth/jwt.ts
import jwt from 'jsonwebtoken';
import type { JwtPayload } from './types.js';

export interface SignPayload {
  sub: string;
  role: string;
  scopes?: string[];
  rfd: number;
}

export function signToken(payload: SignPayload, secret: string, expiresIn: string): string {
  return jwt.sign(payload, secret, { algorithm: 'HS256', expiresIn });
}

export function verifyToken(token: string, secret: string): JwtPayload {
  return jwt.verify(token, secret, { algorithms: ['HS256'] }) as JwtPayload;
}

export function verifyForRefresh(token: string, secret: string): JwtPayload {
  // Verify signature but ignore expiration — used for refresh flow
  return jwt.verify(token, secret, { algorithms: ['HS256'], ignoreExpiration: true }) as JwtPayload;
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
pnpm test -- src/plugins/api-server/__tests__/jwt.test.ts
```

Expected: All 7 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml src/plugins/api-server/auth/jwt.ts src/plugins/api-server/__tests__/jwt.test.ts
git commit -m "feat(auth): implement JWT sign/verify/refresh with HMAC-SHA256"
```

---

## Task 4: Extend Auth Middleware with JWT Support

**Files:**
- Modify: `src/plugins/api-server/middleware/auth.ts`
- Test: `src/plugins/api-server/__tests__/auth-middleware.test.ts`

- [ ] **Step 1: Write failing tests for full auth middleware**

```typescript
// src/plugins/api-server/__tests__/auth-middleware.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { createAuthPreHandler } from '../middleware/auth.js';
import { signToken } from '../auth/jwt.js';
import type { TokenStore } from '../auth/token-store.js';

const SECRET = 'a'.repeat(64);
const JWT_SECRET = 'jwt-test-secret';

function mockTokenStore(overrides: Partial<TokenStore> = {}): TokenStore {
  return {
    get: vi.fn().mockReturnValue({ id: 'tok_123', revoked: false }),
    updateLastUsed: vi.fn(),
    ...overrides,
  } as any;
}

describe('auth middleware (full)', () => {
  it('authenticates with secret token', async () => {
    const app = Fastify();
    app.decorateRequest('auth', null);
    const preHandler = createAuthPreHandler(() => SECRET, () => JWT_SECRET, mockTokenStore());
    app.get('/test', { preHandler }, async (req) => ({ auth: req.auth }));
    await app.ready();

    const res = await app.inject({
      method: 'GET',
      url: '/test',
      headers: { authorization: `Bearer ${SECRET}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.auth.type).toBe('secret');
    expect(body.auth.role).toBe('admin');
    await app.close();
  });

  it('authenticates with valid JWT', async () => {
    const app = Fastify();
    app.decorateRequest('auth', null);
    const store = mockTokenStore();
    const preHandler = createAuthPreHandler(() => SECRET, () => JWT_SECRET, store);
    app.get('/test', { preHandler }, async (req) => ({ auth: req.auth }));
    await app.ready();

    const rfd = Math.floor(Date.now() / 1000) + 86400 * 7;
    const jwt = signToken({ sub: 'tok_123', role: 'operator', rfd }, JWT_SECRET, '24h');

    const res = await app.inject({
      method: 'GET',
      url: '/test',
      headers: { authorization: `Bearer ${jwt}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.auth.type).toBe('jwt');
    expect(body.auth.role).toBe('operator');
    expect(body.auth.tokenId).toBe('tok_123');
    await app.close();
  });

  it('rejects revoked token', async () => {
    const app = Fastify();
    app.decorateRequest('auth', null);
    app.setErrorHandler((err, _req, reply) => {
      reply.status(401).send({ error: err.message });
    });
    const store = mockTokenStore({ get: vi.fn().mockReturnValue({ id: 'tok_123', revoked: true }) });
    const preHandler = createAuthPreHandler(() => SECRET, () => JWT_SECRET, store);
    app.get('/test', { preHandler }, async (req) => ({ auth: req.auth }));
    await app.ready();

    const rfd = Math.floor(Date.now() / 1000) + 86400 * 7;
    const jwt = signToken({ sub: 'tok_123', role: 'admin', rfd }, JWT_SECRET, '24h');

    const res = await app.inject({
      method: 'GET',
      url: '/test',
      headers: { authorization: `Bearer ${jwt}` },
    });

    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it('rejects request with no token', async () => {
    const app = Fastify();
    app.decorateRequest('auth', null);
    app.setErrorHandler((err, _req, reply) => {
      reply.status(401).send({ error: err.message });
    });
    const preHandler = createAuthPreHandler(() => SECRET, () => JWT_SECRET, mockTokenStore());
    app.get('/test', { preHandler }, async (req) => ({ auth: req.auth }));
    await app.ready();

    const res = await app.inject({ method: 'GET', url: '/test' });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it('accepts token from query param on SSE-like routes', async () => {
    const app = Fastify();
    app.decorateRequest('auth', null);
    const preHandler = createAuthPreHandler(() => SECRET, () => JWT_SECRET, mockTokenStore());
    app.get('/test', { preHandler }, async (req) => ({ auth: req.auth }));
    await app.ready();

    const res = await app.inject({
      method: 'GET',
      url: `/test?token=${SECRET}`,
    });

    expect(res.statusCode).toBe(200);
    await app.close();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm test -- src/plugins/api-server/__tests__/auth-middleware.test.ts
```

Expected: FAIL — `createAuthPreHandler` signature doesn't match.

- [ ] **Step 3: Update auth middleware with JWT support**

Replace the stub from Plan 1 with full implementation:

```typescript
// src/plugins/api-server/middleware/auth.ts
import type { FastifyReply, FastifyRequest, preHandlerHookHandler } from 'fastify';
import { timingSafeEqual } from 'node:crypto';
import { AuthError } from './error-handler.js';
import { verifyToken } from '../auth/jwt.js';
import { getRoleScopes, hasScope } from '../auth/roles.js';
import type { TokenStore } from '../auth/token-store.js';

declare module 'fastify' {
  interface FastifyRequest {
    auth: {
      type: 'secret' | 'jwt';
      tokenId?: string;
      role: string;
      scopes: string[];
    };
  }
}

export function createAuthPreHandler(
  getSecret: () => string,
  getJwtSecret: () => string,
  tokenStore: TokenStore,
): preHandlerHookHandler {
  return async function authPreHandler(request: FastifyRequest, _reply: FastifyReply) {
    const authHeader = request.headers.authorization;
    const queryToken = (request.query as Record<string, string>)?.token;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : queryToken;

    if (!token) {
      throw new AuthError('UNAUTHORIZED', 'Missing authentication token');
    }

    const secret = getSecret();

    // Secret token check (timing-safe)
    if (token.length === secret.length) {
      try {
        const tokenBuf = Buffer.from(token);
        const secretBuf = Buffer.from(secret);
        if (timingSafeEqual(tokenBuf, secretBuf)) {
          request.auth = { type: 'secret', role: 'admin', scopes: ['*'] };
          return;
        }
      } catch {
        // Buffer length mismatch — not the secret token
      }
    }

    // JWT verification
    try {
      const payload = verifyToken(token, getJwtSecret());

      // Check if token is revoked
      const storedToken = tokenStore.get(payload.sub);
      if (!storedToken || storedToken.revoked) {
        throw new AuthError('UNAUTHORIZED', 'Token revoked');
      }

      // Update last used
      tokenStore.updateLastUsed(payload.sub);

      // Resolve scopes: use token override or role defaults
      const scopes = payload.scopes ?? getRoleScopes(payload.role);

      request.auth = {
        type: 'jwt',
        tokenId: payload.sub,
        role: payload.role,
        scopes,
      };
    } catch (err) {
      if (err instanceof AuthError) throw err;
      throw new AuthError('UNAUTHORIZED', 'Invalid authentication token');
    }
  };
}

export function requireScopes(...scopes: string[]): preHandlerHookHandler {
  return async function scopeCheck(request: FastifyRequest, _reply: FastifyReply) {
    const { scopes: userScopes } = request.auth;
    for (const scope of scopes) {
      if (!hasScope(userScopes, scope)) {
        throw new AuthError('FORBIDDEN', `Missing scope: ${scope}`, 403);
      }
    }
  };
}

export function requireRole(role: string): preHandlerHookHandler {
  const roleHierarchy: Record<string, number> = { viewer: 0, operator: 1, admin: 2 };

  return async function roleCheck(request: FastifyRequest, _reply: FastifyReply) {
    const userLevel = roleHierarchy[request.auth.role] ?? -1;
    const requiredLevel = roleHierarchy[role] ?? 999;

    if (userLevel < requiredLevel) {
      throw new AuthError('FORBIDDEN', `Requires ${role} role`, 403);
    }
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm test -- src/plugins/api-server/__tests__/auth-middleware.test.ts
```

Expected: All 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/plugins/api-server/middleware/auth.ts src/plugins/api-server/__tests__/auth-middleware.test.ts
git commit -m "feat(auth): extend auth middleware with full JWT verification and revocation check"
```

---

## Task 5: Create Auth Schemas and Routes

**Files:**
- Create: `src/plugins/api-server/schemas/auth.ts`
- Create: `src/plugins/api-server/routes/auth.ts`
- Test: `src/plugins/api-server/__tests__/routes-auth.test.ts`

- [ ] **Step 1: Create auth schemas**

```typescript
// src/plugins/api-server/schemas/auth.ts
import { z } from 'zod';

export const CreateTokenBodySchema = z.object({
  role: z.enum(['admin', 'operator', 'viewer']),
  name: z.string().min(1),
  expire: z.string().regex(/^\d+(h|d|m)$/).default('24h'),
  scopes: z.array(z.string()).optional(),
});

export const RefreshTokenResponseSchema = z.object({
  accessToken: z.string(),
  tokenId: z.string(),
  expiresAt: z.string(),
  refreshDeadline: z.string(),
});
```

- [ ] **Step 2: Write failing tests for auth routes**

```typescript
// src/plugins/api-server/__tests__/routes-auth.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import { authRoutes } from '../routes/auth.js';
import { TokenStore } from '../auth/token-store.js';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const JWT_SECRET = 'test-jwt-secret';

describe('auth routes', () => {
  let app: ReturnType<typeof Fastify>;
  let store: TokenStore;
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'auth-routes-'));
    store = new TokenStore(join(tmpDir, 'tokens.json'));
    await store.load();

    app = Fastify();
    app.decorateRequest('auth', null);

    // Simulate secret token auth for all requests
    app.addHook('onRequest', async (req) => {
      req.auth = { type: 'secret', role: 'admin', scopes: ['*'] };
    });

    await app.register(
      (a) => authRoutes(a, { tokenStore: store, getJwtSecret: () => JWT_SECRET }),
      { prefix: '/api/v1/auth' },
    );
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('POST /tokens creates a new token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/tokens',
      payload: { role: 'operator', name: 'test-token', expire: '24h' },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.accessToken).toBeDefined();
    expect(body.tokenId).toMatch(/^tok_/);
    expect(body.expiresAt).toBeDefined();
    expect(body.refreshDeadline).toBeDefined();
  });

  it('GET /tokens lists active tokens', async () => {
    store.create({ role: 'admin', name: 'tok-1', expire: '24h' });
    store.create({ role: 'viewer', name: 'tok-2', expire: '24h' });

    const res = await app.inject({ method: 'GET', url: '/api/v1/auth/tokens' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.tokens).toHaveLength(2);
  });

  it('DELETE /tokens/:id revokes a token', async () => {
    const token = store.create({ role: 'admin', name: 'revoke-me', expire: '24h' });

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/auth/tokens/${token.id}`,
    });

    expect(res.statusCode).toBe(200);
    expect(store.get(token.id)!.revoked).toBe(true);
  });

  it('GET /me returns current auth info', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/auth/me' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.type).toBe('secret');
    expect(body.role).toBe('admin');
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
pnpm test -- src/plugins/api-server/__tests__/routes-auth.test.ts
```

Expected: FAIL.

- [ ] **Step 4: Implement auth routes**

```typescript
// src/plugins/api-server/routes/auth.ts
import type { FastifyInstance } from 'fastify';
import type { TokenStore } from '../auth/token-store.js';
import { signToken, verifyForRefresh } from '../auth/jwt.js';
import { getRoleScopes, isValidRole } from '../auth/roles.js';
import { CreateTokenBodySchema } from '../schemas/auth.js';
import { AuthError, NotFoundError } from '../middleware/error-handler.js';
import { IdParamSchema } from '../schemas/common.js';

export interface AuthRouteDeps {
  tokenStore: TokenStore;
  getJwtSecret: () => string;
}

export async function authRoutes(app: FastifyInstance, deps: AuthRouteDeps): Promise<void> {
  const { tokenStore, getJwtSecret } = deps;

  // POST /tokens — generate new JWT (secret token only)
  app.post('/tokens', async (request, reply) => {
    if (request.auth.type !== 'secret') {
      throw new AuthError('FORBIDDEN', 'Only secret token can generate new tokens', 403);
    }

    const body = CreateTokenBodySchema.parse(request.body);
    if (!isValidRole(body.role)) {
      throw new AuthError('VALIDATION_ERROR', `Invalid role: ${body.role}`, 400);
    }

    const storedToken = tokenStore.create({
      role: body.role,
      name: body.name,
      expire: body.expire,
      scopes: body.scopes,
    });

    const rfd = Math.floor(new Date(storedToken.refreshDeadline).getTime() / 1000);
    const accessToken = signToken(
      {
        sub: storedToken.id,
        role: storedToken.role,
        scopes: storedToken.scopes,
        rfd,
      },
      getJwtSecret(),
      body.expire,
    );

    return reply.status(201).send({
      accessToken,
      tokenId: storedToken.id,
      expiresAt: new Date(Date.now() + parseDurationMs(body.expire)).toISOString(),
      refreshDeadline: storedToken.refreshDeadline,
    });
  });

  // GET /tokens — list active tokens
  app.get('/tokens', async () => {
    const tokens = tokenStore.list();
    return {
      tokens: tokens.map((t) => ({
        id: t.id,
        name: t.name,
        role: t.role,
        scopes: t.scopes,
        createdAt: t.createdAt,
        refreshDeadline: t.refreshDeadline,
        lastUsedAt: t.lastUsedAt,
      })),
    };
  });

  // DELETE /tokens/:id — revoke token
  app.delete('/tokens/:id', async (request) => {
    const { id } = IdParamSchema.parse(request.params);
    const token = tokenStore.get(id);
    if (!token) {
      throw new NotFoundError('TOKEN_NOT_FOUND', `Token ${id} not found`);
    }
    tokenStore.revoke(id);
    return { success: true };
  });

  // POST /refresh — refresh JWT
  app.post('/refresh', async (request, reply) => {
    const authHeader = request.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) {
      throw new AuthError('UNAUTHORIZED', 'Missing token');
    }

    let payload;
    try {
      payload = verifyForRefresh(token, getJwtSecret());
    } catch {
      throw new AuthError('UNAUTHORIZED', 'Invalid token signature');
    }

    // Check revocation
    const storedToken = tokenStore.get(payload.sub);
    if (!storedToken || storedToken.revoked) {
      throw new AuthError('UNAUTHORIZED', 'Token revoked');
    }

    // Check refresh deadline
    if (Date.now() > payload.rfd * 1000) {
      throw new AuthError('UNAUTHORIZED', 'Refresh deadline passed, generate a new token');
    }

    const newToken = signToken(
      {
        sub: payload.sub,
        role: payload.role,
        scopes: payload.scopes,
        rfd: payload.rfd,
      },
      getJwtSecret(),
      '24h',
    );

    return reply.send({
      accessToken: newToken,
      tokenId: payload.sub,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      refreshDeadline: storedToken.refreshDeadline,
    });
  });

  // GET /me — current auth info
  app.get('/me', async (request) => {
    return {
      type: request.auth.type,
      tokenId: request.auth.tokenId,
      role: request.auth.role,
      scopes: request.auth.scopes,
    };
  });
}

function parseDurationMs(duration: string): number {
  const match = duration.match(/^(\d+)(h|d|m)$/);
  if (!match) return 24 * 60 * 60 * 1000;
  const value = parseInt(match[1], 10);
  switch (match[2]) {
    case 'm': return value * 60 * 1000;
    case 'h': return value * 60 * 60 * 1000;
    case 'd': return value * 24 * 60 * 60 * 1000;
    default: return 24 * 60 * 60 * 1000;
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
pnpm test -- src/plugins/api-server/__tests__/routes-auth.test.ts
```

Expected: All 4 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/plugins/api-server/schemas/auth.ts src/plugins/api-server/routes/auth.ts src/plugins/api-server/__tests__/routes-auth.test.ts
git commit -m "feat(auth): add auth routes (generate, list, revoke, refresh, me)"
```

---

## Task 6: Create JWT Secret File and Wire into Plugin

**Files:**
- Modify: `src/plugins/api-server/index.ts`
- Modify: `src/plugins/api-server/server.ts` (update `createApiServer` to accept `getJwtSecret` and `tokenStore`)
- Modify: `src/core/instance-context.ts` (add `jwtSecret` path if not already there)

- [ ] **Step 1: Add jwt-secret to instance paths**

Check `src/core/instance-context.ts` — if `jwtSecret` path is not defined, add it alongside `apiSecret`:

```typescript
jwtSecret: join(root, 'jwt-secret'),
```

- [ ] **Step 2: Update plugin setup to initialize JWT secret and TokenStore**

In `src/plugins/api-server/index.ts` setup hook, add:
- Load or create `jwt-secret` file (same pattern as `api-secret`: 64 hex chars, mode 0o600)
- Create `TokenStore` instance, load from disk
- Update `server.ts` `ApiServerOptions` to include `getJwtSecret` and `tokenStore` params
- Update `createApiServer()` to pass these to `createAuthPreHandler(getSecret, getJwtSecret, tokenStore)` instead of the old 1-arg stub
- Pass `getJwtSecret` and `tokenStore` from plugin index to server creation
- Register auth routes with auth deps
- Run `tokenStore.cleanup()` periodically (every hour) to remove expired tokens

- [ ] **Step 3: Verify build and tests**

```bash
pnpm build && pnpm test
```

Expected: All pass.

- [ ] **Step 4: Commit**

```bash
git add src/plugins/api-server/index.ts src/core/instance-context.ts
git commit -m "feat(auth): wire JWT secret, TokenStore, and auth routes into plugin lifecycle"
```
