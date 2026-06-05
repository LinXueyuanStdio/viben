# Spec 2: Auth System

**Date:** 2026-03-31
**Status:** Draft
**Related specs:**
- [Spec 1: API Server Core](./2026-03-31-api-server-core-design.md)
- [Spec 3: SSE Adapter](./2026-03-31-sse-adapter-design.md)
- [Spec 4: App Connectivity](./2026-03-31-app-connectivity-design.md)

## Overview

Two-tier authentication system for the API server: **Secret Token** (master key, local) and **JWT Access Token** (generated, scoped, revokable, stateful). Supports role-based access with optional scope overrides.

## Secret Token

Existing mechanism preserved — random 64-character hex string stored in `<instanceRoot>/api-secret` with file permission `0o600`.

**Behavior:**
- Request with `Authorization: Bearer <secret-token>` → timing-safe compare → **full access** to all endpoints
- Bypasses JWT entirely — no expiry, no scopes, no roles
- Cannot be revoked (regenerate by deleting file + restart)
- Used by: local CLI tools, local app auto-auth, `viben remote` to generate JWTs

## JWT Flow

### Generate Token

Only callable with secret token auth:

```
POST /api/v1/auth/tokens
Authorization: Bearer <secret-token>
Body: {
  "role": "admin",
  "name": "remote-14h30-31-03-2026",
  "expire": "24h",
  "scopes": ["sessions:read", "sessions:prompt"]  // optional override
}

Response: {
  "accessToken": "eyJ...",
  "tokenId": "tok_abc123",
  "expiresAt": "2026-04-01T14:30:00Z",
  "refreshDeadline": "2026-04-07T14:30:00Z"
}
```

### Refresh Token

Use current (potentially expired) JWT to get a new one — as long as refresh deadline hasn't passed:

```
POST /api/v1/auth/refresh
Authorization: Bearer <current-jwt>

Response: {
  "accessToken": "eyJ...",        // new JWT, expires in 24h
  "tokenId": "tok_abc123",        // same tokenId
  "expiresAt": "2026-04-02T...",
  "refreshDeadline": "2026-04-07T..."  // unchanged, 7 days from original creation
}
```

**Refresh rules:**
- JWT expired but `refreshDeadline` not passed → new JWT issued
- `refreshDeadline` passed (>7 days from original token creation) → 401, must generate new token with secret token
- Token revoked → 401, cannot refresh

**Important:** The refresh endpoint verifies JWT signature only — it skips the `exp` check. This allows expired JWTs (within refresh deadline) to obtain a new token. All other endpoints reject expired JWTs normally.

### JWT Payload

```typescript
interface JwtPayload {
  sub: string;          // tokenId (tok_abc123)
  role: string;         // admin | operator | viewer
  scopes?: string[];    // override scopes (null = use role defaults)
  iat: number;          // issued at
  exp: number;          // expires at
  rfd: number;          // refresh deadline timestamp
}
```

### Signing

HMAC-SHA256. Signing key derived from a separate JWT secret stored at `<instanceRoot>/jwt-secret` (auto-generated on first use, similar to `api-secret`). Separate from `api-secret` so rotating one doesn't invalidate the other.

## Roles & Scopes

### Built-in Roles (V1)

3 hardcoded roles. Custom roles planned for V2.

| Role | Scopes |
|---|---|
| `admin` | `*` (all scopes) |
| `operator` | `sessions:read`, `sessions:write`, `sessions:prompt`, `sessions:permission`, `agents:read`, `commands:execute`, `system:health` |
| `viewer` | `sessions:read`, `agents:read`, `system:health` |

### Scope List (V1)

| Scope | Description |
|---|---|
| `sessions:read` | List and get session details |
| `sessions:write` | Create, cancel, update sessions |
| `sessions:prompt` | Enqueue prompts to sessions |
| `sessions:permission` | Resolve permission requests |
| `agents:read` | List and get agent details |
| `config:read` | Read config |
| `config:write` | Update config fields |
| `commands:execute` | Execute chat commands |
| `system:health` | Health check, version info |
| `system:admin` | Restart, system management |
| `auth:manage` | Create/revoke/list tokens |

### Scope Override

When a token has explicit `scopes` array → only those scopes apply, role defaults ignored. This allows creating narrow tokens (e.g., `viewer` role but with only `sessions:read` scope).

## Token Storage (Stateful)

### Data Model

```typescript
interface StoredToken {
  id: string;              // tok_<random> (e.g., tok_abc123)
  name: string;            // "remote-14h30-31-03-2026"
  role: string;            // admin | operator | viewer
  scopes?: string[];       // optional scope override
  createdAt: string;       // ISO 8601
  refreshDeadline: string; // ISO 8601, 7 days from createdAt
  lastUsedAt?: string;     // ISO 8601, updated on each request
  revoked: boolean;        // true = all requests rejected
}
```

### Storage Mechanism

File: `<instanceRoot>/tokens.json`

Pattern: In-memory Map for fast lookup + persist to JSON file on every change. Same pattern as `JsonFileSessionStore`.

```typescript
class TokenStore {
  private tokens: Map<string, StoredToken>;
  private filePath: string;

  load(): Promise<void>;          // read from disk into memory
  save(): Promise<void>;          // persist memory to disk
  create(opts: CreateTokenOpts): StoredToken;
  get(id: string): StoredToken | undefined;
  revoke(id: string): void;
  list(): StoredToken[];
  updateLastUsed(id: string): void;
  cleanup(): void;                // remove expired tokens (refreshDeadline passed)
}
```

### Token Management Endpoints

| Method | Path | Description | Auth Required |
|--------|------|-------------|---------------|
| `POST` | `/api/v1/auth/tokens` | Generate new JWT | Secret token only |
| `GET` | `/api/v1/auth/tokens` | List active tokens | `auth:manage` |
| `DELETE` | `/api/v1/auth/tokens/:id` | Revoke token | `auth:manage` |
| `POST` | `/api/v1/auth/refresh` | Refresh JWT | Valid JWT (even expired, within refresh deadline) |
| `GET` | `/api/v1/auth/me` | Current token info (role, scopes, expiry) | Any valid auth |

## Auth Middleware Flow

```
Request arrives
  → Extract Authorization header (Bearer token)
  → No token? → SSE route? Check ?token= query param
  → No token at all? → 401 Unauthorized

  → Is it the secret token?
    → timing-safe compare against api-secret
    → Match: attach { type: 'secret', role: 'admin', scopes: ['*'] } to request
    → Full access, skip all further checks

  → Is it a JWT?
    → Verify HMAC-SHA256 signature with jwt-secret
    → Invalid signature → 401
    → Decode payload → extract tokenId (sub)
    → Check TokenStore: is tokenId revoked?
      → Yes → 401 "Token revoked"
    → Check exp: is JWT expired?
      → Yes → 401 "Token expired" (client should call /refresh)
    → Attach { type: 'jwt', tokenId, role, scopes } to request
    → Proceed to route handler

  → Route handler uses requireScopes() / requireRole() for fine-grained checks
```

### Fastify Request Decorator

```typescript
declare module 'fastify' {
  interface FastifyRequest {
    auth: {
      type: 'secret' | 'jwt';
      tokenId?: string;       // undefined for secret token
      role: string;           // 'admin' for secret token
      scopes: string[];       // ['*'] for secret token
    }
  }
}
```

### Auth Helpers (exposed via ApiServerService)

```typescript
// Pre-handler that verifies auth (secret or JWT)
authPreHandler: preHandlerHookHandler;

// Pre-handler that checks specific scopes
requireScopes(...scopes: string[]): preHandlerHookHandler;
// Logic: if auth.scopes includes '*' → pass. Otherwise check intersection.

// Pre-handler that checks role
requireRole(role: string): preHandlerHookHandler;
// Logic: admin > operator > viewer hierarchy
```

## Security Considerations

- JWT secret separate from API secret — rotating one doesn't affect the other
- Token revocation is immediate (in-memory check before JWT verification)
- `lastUsedAt` tracking helps identify stale tokens
- Automatic cleanup of tokens past their refresh deadline
- Rate limiting on auth endpoints (via Spec 1 Fastify rate limiter)
- Secret token never leaves the local machine file system
- JWT in query params (for SSE) is a known trade-off — mitigated by short expiry + revokability
