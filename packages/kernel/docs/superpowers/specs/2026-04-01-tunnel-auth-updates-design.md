# Spec 5: Tunnel Auto-Start, Auth One-Time Code, Display Updates

**Date:** 2026-04-01
**Status:** Draft
**Related specs:**
- [Spec 1: API Server Core](./2026-03-31-api-server-core-design.md)
- [Spec 2: Auth System](./2026-03-31-auth-system-design.md)
- [Spec 3: SSE Adapter](./2026-03-31-sse-adapter-design.md)
- [Spec 4: App Connectivity](./2026-03-31-app-connectivity-design.md)

## Overview

Three updates to the existing specs:

1. **One-time code auth** — Replace JWT-in-URL with a short-lived, single-use code that exchanges for a JWT. Prevents link reuse.
2. **Tunnel auto-start + keepalive** — Server boot auto-creates tunnel when `tunnel.enabled: true`. HTTP keepalive ping detects dead tunnels. Merge viewer server into API server (1 port, 1 tunnel).
3. **Terminal display** — Copyable links outside Unicode boxes in both startup and `viben remote` output.

## 1. One-Time Code Auth

### Changes to Spec 2 (Auth System)

#### Data Model

```typescript
interface StoredCode {
  code: string;           // 32-char random hex (crypto.randomBytes(16))
  role: string;           // admin | operator | viewer
  scopes?: string[];      // optional scope override
  name: string;           // "remote-14h30-01-04-2026"
  expire: string;         // JWT expire duration when exchanged (e.g. "24h")
  createdAt: string;      // ISO 8601
  expiresAt: string;      // createdAt + 30 minutes
  used: boolean;          // true after successful exchange
}
```

#### Storage

Stored in existing `TokenStore` — add `codes: Map<string, StoredCode>` alongside `tokens: Map<string, StoredToken>`. Persisted in same `tokens.json` file with a new `codes` array field.

#### New Endpoints

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `POST` | `/api/v1/auth/codes` | Generate one-time code | Secret token only |
| `POST` | `/api/v1/auth/exchange` | Exchange code for JWT | None (code is auth) |
| `GET` | `/api/v1/auth/codes` | List active (unused, unexpired) codes | `auth:manage` |
| `DELETE` | `/api/v1/auth/codes/:code` | Revoke unused code | `auth:manage` |

#### Generate Code

```
POST /api/v1/auth/codes
Authorization: Bearer <secret-token>
Body: {
  "role": "admin",
  "name": "remote-14h30-01-04-2026",
  "expire": "24h",
  "scopes": ["sessions:read", "sessions:prompt"]  // optional
}

Response: {
  "code": "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4",
  "expiresAt": "2026-04-01T15:00:00Z"
}
```

#### Exchange Code for JWT

```
POST /api/v1/auth/exchange
Body: {
  "code": "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4"
}

Success Response (200): {
  "accessToken": "eyJ...",
  "tokenId": "tok_abc123",
  "expiresAt": "2026-04-02T14:30:00Z",
  "refreshDeadline": "2026-04-08T14:30:00Z"
}

Error Responses:
  401: { "error": { "code": "INVALID_CODE", "message": "Code is invalid, expired, or already used" } }
  429: { "error": { "code": "RATE_LIMITED", "message": "Too many attempts" } }
```

Exchange flow:
1. Look up code in store
2. Check: exists? `used === false`? `expiresAt > now`?
3. **Atomically** mark `code.used = true` (synchronous in single event loop tick — no async gap between check and mark)
4. Create `StoredToken` with role/scopes/expire from the code
5. Sign and return JWT

#### Race Condition Handling

Two clients exchanging the same code concurrently: the check (`used === false`) and mark (`used = true`) happen synchronously in the same event loop tick. No `await` between them. First caller wins, second gets 401.

#### Rate Limiting

`/auth/exchange` rate limited to **10 requests per minute per IP** via Fastify rate limiter config. Prevents brute-force guessing of codes.

#### Cleanup

Expired (`expiresAt < now`) and used codes cleaned up hourly, same schedule as token cleanup.

#### Auth Middleware Update

`/auth/exchange` must bypass auth middleware — it's the one endpoint that accepts no auth header (the code in the body IS the credential). Add to auth middleware's skip list alongside `/api/v1/system/health`.

#### Existing JWT Flow Preserved

`POST /api/v1/auth/tokens` still works for programmatic access (CLI tools, scripts, automation). One-time codes are specifically for `viben remote` → human use via URL.

### Changes to Spec 4 (App Connectivity)

#### `viben remote` Flow Update

```
viben remote
  → (same instance/health checks as before)
  → Read secret token from <instanceRoot>/api-secret
  → POST /api/v1/auth/codes           // was: /auth/tokens
    → Authorization: Bearer <secret-token>
    → Body: { role: "admin", expire: "24h", name: "remote-14h30-01-04-2026" }
  → Receive { code, expiresAt }
  → Generate links with ?code= instead of ?token=
  → Display output
```

#### Link Formats Update

```
Local:
http://localhost:21420?code=a1b2c3d4e5f6...

Tunnel:
https://abc-123.trycloudflare.com?code=a1b2c3d4e5f6...

App:
viben://connect?host=abc-123.trycloudflare.com&code=a1b2c3d4e5f6...
```

#### App Connection Flow Update (Remote — Case 2)

```
User pastes link or scans QR code
  → App parses URL → extract host + code
  → POST {host}/api/v1/auth/exchange
    → Body: { code: "a1b2c3d4..." }
    → 200: receive JWT → store in secure storage
    → 401: code invalid/expired/used → show error + prompt re-enter
    → 429: rate limited → show "try again later"
    → Network error: host unreachable → show error
  → Clear code from URL/history
  → Use JWT Authorization header for all subsequent requests
  → Connect SSE stream
  → Ready
```

#### Custom Scheme Update (Case 3)

```
viben://connect?host=abc-123.trycloudflare.com&code=a1b2c3d4...
  → OS opens app → parse host + code
  → POST {host}/api/v1/auth/exchange → same as Case 2
```

#### Local Auto-Discover (Case 1) — Unchanged

Local connections still use `api-secret` file directly. No code needed.

## 2. Tunnel Auto-Start + Keepalive + Viewer Server Merge

### Merge Viewer Server into API Server

#### Current Architecture (2 servers, 2 ports)

```
Tunnel plugin: Hono viewer server (port 3100)
  /view/:id, /diff/:id, /output/:id    — HTML viewers
  /api/file/:id, /api/diff/:id          — JSON APIs for viewers
  /health                                — health check

API server: Fastify (port 21420)
  /api/v1/*                              — REST API + SSE
  /api/docs                              — Swagger
  /*                                     — Static dashboard (SPA fallback)
```

Problem: 2 tunnels needed for remote access → Cloudflare free tier rate limiting risk on tunnel creation.

#### New Architecture (1 server, 1 port)

```
API server: Fastify (port 21420)
  /api/v1/*          — REST API + SSE
  /api/docs          — Swagger
  /view/:id          — file viewer (registered by tunnel plugin, no auth)
  /diff/:id          — diff viewer (registered by tunnel plugin, no auth)
  /output/:id        — output viewer (registered by tunnel plugin, no auth)
  /api/file/:id      — JSON file API (registered by tunnel plugin, no auth)
  /api/diff/:id      — JSON diff API (registered by tunnel plugin, no auth)
  /*                  — Static dashboard (SPA fallback via notFoundHandler)
```

One tunnel exposes everything.

#### Viewer Routes Registration

Tunnel plugin registers viewer routes via `ApiServerService.registerPlugin()`:

```typescript
// In tunnel plugin setup()
const api = ctx.getService<ApiServerService>('api-server');
const viewerRoutes = createViewerRoutes(store);
api.registerPlugin('/', viewerRoutes, { auth: false });
```

Routes registered with `{ auth: false }` — viewer links are public share links sent in chat messages. They must be accessible without JWT.

**Route priority:** Fastify registered routes match BEFORE `setNotFoundHandler` (static server SPA fallback). No conflict with dashboard.

**`/api/file/:id` and `/api/diff/:id` naming:** These are in `/api/` namespace but NOT `/api/v1/`. No conflict with API routes. Keeping existing names avoids modifying HTML templates.

**Prefix `/` verification:** If Fastify doesn't support `registerPlugin('/', ...)` correctly, fallback: register routes directly on `server.app` via a new `registerRootPlugin()` method on ApiServerService.

#### Files Changed in Tunnel Plugin

| File | Change |
|------|--------|
| `server.ts` | **Delete** — Hono viewer server removed |
| `viewer-routes.ts` | **New** — Fastify plugin with viewer routes |
| `tunnel-service.ts` | Remove Hono server boot, accept `apiPort` param, update `getPublicUrl()` fallback |
| `index.ts` | Add `@viben/api-server` dependency, register viewer routes, auto-connect on `system:ready` |

#### TunnelService Changes

```typescript
// Before
async start(): Promise<string> {
  // Boot Hono server on tunnel.port
  // Register system tunnel pointing to Hono server port
}

// After
async start(apiPort: number): Promise<string> {
  // No server to boot — viewer routes already registered in API server
  // Register system tunnel pointing to apiPort
  this.apiPort = apiPort;
  // ...register tunnel via TunnelRegistry.add(apiPort, provider, options)
}

getPublicUrl(): string {
  const system = this.registry.getSystemEntry();
  return system?.publicUrl || `http://localhost:${this.apiPort}`;
}
```

**Interface update in `core/plugin/types.ts`:**
```typescript
// Before
start(): Promise<string>

// After
start(apiPort: number): Promise<string>
```

Not a breaking change for external plugins — only core calls `start()`.

#### Degraded Mode (No API Server)

If `@viben/api-server` is disabled:
- Viewer routes not registered → viewer URLs won't resolve
- `fileUrl()`, `diffUrl()`, `outputUrl()` return empty string (not broken localhost URL)
- Log warning: "Viewer links unavailable without API server plugin"
- User tunnels (`/tunnel <port>`) still work (tunnel arbitrary ports)

#### Config Deprecations

| Field | Status | Behavior |
|-------|--------|----------|
| `tunnel.port` | Deprecated | Ignored. Log warning if user sets it. Kept in Zod schema with `.optional()` for backward compat. |
| `tunnel.auth.enabled` | Deprecated | Ignored. Same treatment. |
| `tunnel.auth.token` | Deprecated | Ignored. Same treatment. |

Remove deprecated fields from schema after 2 releases.

#### Dependencies Removed

- `hono`
- `@hono/node-server`

### Auto-Start on Server Boot

When `tunnel.enabled: true` and server starts:

```
tunnel plugin setup():
  → Check @viben/api-server dependency available
  → Register viewer routes via ApiServerService
  → Listen for system:ready event

system:ready fires:
  → tunnel.enabled === true?
    → Provider configured in config?
      → Yes → apiPort = ApiServerService.getPort()
            → TunnelService.start(apiPort)
            → TunnelRegistry.add(apiPort, provider, options)
            → Success → log "Tunnel ready → {url}"
            → Fail → existing retry logic (exponential backoff, max 5)
      → No provider → log warning "Tunnel enabled but no provider configured. Run: viben remote"
    → enabled === false → skip (no tunnel)
```

**Startup timeout:** Tunnel creation is awaited for up to **30 seconds** during startup. If not ready in 30s, startup display shows "Tunnel: connecting..." and tunnel continues connecting in background. When ready, logs URL separately.

### Keepalive Ping

#### TunnelKeepAlive Class

```typescript
// New file: plugins/tunnel/keepalive.ts

class TunnelKeepAlive {
  private interval: NodeJS.Timeout | null = null;
  private consecutiveFails = 0;

  private static readonly PING_INTERVAL = 30_000;   // 30 seconds
  private static readonly FAIL_THRESHOLD = 3;        // 3 consecutive fails = dead
  private static readonly PING_TIMEOUT = 5_000;      // 5s per ping

  start(tunnelUrl: string, onDead: () => void): void {
    this.stop(); // clear any existing interval
    this.consecutiveFails = 0;

    this.interval = setInterval(async () => {
      try {
        const res = await fetch(`${tunnelUrl}/api/v1/system/health`, {
          signal: AbortSignal.timeout(TunnelKeepAlive.PING_TIMEOUT),
        });
        if (res.ok) {
          this.consecutiveFails = 0;
        } else {
          this.consecutiveFails++;
        }
      } catch {
        this.consecutiveFails++;
      }

      if (this.consecutiveFails >= TunnelKeepAlive.FAIL_THRESHOLD) {
        this.stop();
        onDead();
      }
    }, TunnelKeepAlive.PING_INTERVAL);
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.consecutiveFails = 0;
  }
}
```

#### Integration with TunnelRegistry

```
Tunnel entry status → 'active' (new tunnel established):
  → Start keepalive with tunnel's publicUrl
  → onDead callback:
    → Clear publicUrl from entry (getPublicUrl() falls back to localhost)
    → Kill tunnel process (SIGTERM)
    → Existing retry logic creates new tunnel
    → New tunnel active → start new keepalive with new URL

Process exit detected (existing onExit handler):
  → Stop keepalive (prevent pinging dead URL)
  → Existing retry logic handles reconnection
  → New tunnel active → start new keepalive

TunnelRegistry.stop() or shutdown():
  → Stop keepalive
  → Normal shutdown flow

Keepalive ONLY applies to:
  → System tunnel (type='system')
  → NOT user tunnels (type='user') — user tunnels are ephemeral
```

#### Timing: Keepalive Start

Keepalive starts AFTER both conditions are met:
1. Tunnel is active (has publicUrl)
2. API server is listening (health endpoint returns 200)

If keepalive starts before API server is ready, pings would fail and false-trigger a restart. The `system:ready` event guarantees both are ready.

#### URL Change on Tunnel Restart

Cloudflare free tier generates a new subdomain on each tunnel creation. After keepalive kills + retry:
1. Old URL is dead → cleared from entry
2. `getPublicUrl()` temporarily returns localhost fallback
3. New tunnel establishes → new URL stored in entry
4. Keepalive restarts with new URL
5. New viewer links use new URL automatically (MessageTransformer calls `getPublicUrl()` per-message)

**Existing viewer links with old URL become broken** — this is expected and acceptable. Viewer entries have 60-minute TTL anyway.

## 3. Terminal Display Updates

### Startup Display (main.ts)

**New format — status in checkmarks, links as plain text below:**

```
✓ Config loaded
✓ Dependencies checked
✓ Tunnel ready
✓ Telegram connected
✓ API server on port 21420

Local:  http://localhost:21420
Tunnel: https://abc-123.trycloudflare.com

Viben is running. Press Ctrl+C to stop.
```

**Tunnel still connecting (>30s startup timeout):**

```
✓ Config loaded
✓ Dependencies checked
⟳ Tunnel connecting...
✓ Telegram connected
✓ API server on port 21420

Local:  http://localhost:21420

Viben is running. Press Ctrl+C to stop.
```

When tunnel connects later, log: `✓ Tunnel ready → https://...`

**Tunnel disabled or failed:**

```
✓ Config loaded
✓ Dependencies checked
✓ Telegram connected
✓ API server on port 21420

Local:  http://localhost:21420

Viben is running. Press Ctrl+C to stop.
```

No Tunnel line — only shown when URL is available.

**Tunnel failed with error:**

```
✓ Config loaded
✓ Dependencies checked
⚠ Tunnel failed (rate limited) — retrying in background
✓ Telegram connected
✓ API server on port 21420

Local:  http://localhost:21420

Viben is running. Press Ctrl+C to stop.
```

**Non-TTY (piped output):** No colors, no box, no spinner. Just raw lines for machine parsing.

### `viben remote` Output

**New format — metadata in box, links as plain text:**

```
  ┌────────────────────────────────────────────────────────────┐
  │  Remote Access                                             │
  ├────────────────────────────────────────────────────────────┤
  │  Token:   remote-14h30-01-04-2026                          │
  │  Role:    admin                                            │
  │  Expires: 2026-04-02 14:30 (24h)                           │
  └────────────────────────────────────────────────────────────┘

Local:
http://localhost:21420?code=a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4

Tunnel:
https://abc-123.trycloudflare.com?code=a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4

App:
viben://connect?host=abc-123.trycloudflare.com&code=a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4

  ██████████████████████
  ██  QR (tunnel link) ██
  ██████████████████████

⚠ Code expires in 30 minutes and can only be used once.
```

**Key changes from Spec 4:**
- Links use `?code=` instead of `?token=`
- Links are plain text outside the box — each URL on its own line, label above
- Easy to triple-click select entire URL
- Warning at bottom about code expiry and single-use
- QR code encodes tunnel link (or local link if `--no-tunnel`)

**No tunnel available:**

```
  ┌────────────────────────────────────────────────────────────┐
  │  Remote Access                                             │
  ├────────────────────────────────────────────────────────────┤
  │  Token:   remote-14h30-01-04-2026                          │
  │  Role:    admin                                            │
  │  Expires: 2026-04-02 14:30 (24h)                           │
  └────────────────────────────────────────────────────────────┘

Local:
http://localhost:21420?code=a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4

⚠ Code expires in 30 minutes and can only be used once.
⚠ No tunnel available — local link only works on same machine.
```

**`--no-qr` flag:** QR block hidden.
**`--no-tunnel` flag:** Only Local link shown, no Tunnel/App links.

## 4. Summary of All File Changes

### New Files

| File | Description |
|------|-------------|
| `plugins/tunnel/viewer-routes.ts` | Fastify plugin — viewer HTML + JSON API routes |
| `plugins/tunnel/keepalive.ts` | TunnelKeepAlive class — HTTP ping loop |

### Modified Files

| File | Changes |
|------|---------|
| `plugins/api-server/routes/auth.ts` | Add `/codes` and `/exchange` endpoints |
| `plugins/api-server/auth/token-store.ts` | Add `codes` Map, persist in `tokens.json`, cleanup |
| `plugins/api-server/auth/types.ts` | Add `StoredCode` interface |
| `plugins/api-server/middleware/auth.ts` | Skip auth for `/auth/exchange` |
| `plugins/api-server/schemas/` | Add Zod schemas for code endpoints |
| `plugins/tunnel/tunnel-service.ts` | Remove Hono server boot, accept `apiPort`, update `getPublicUrl()` fallback |
| `plugins/tunnel/tunnel-registry.ts` | Integrate TunnelKeepAlive for system tunnel |
| `plugins/tunnel/index.ts` | Add `@viben/api-server` dependency, register viewer routes, auto-connect on `system:ready` |
| `core/plugin/types.ts` | Update `TunnelServiceInterface.start(apiPort: number)` signature |
| `main.ts` | Update startup display format (links outside status list) |
| `cli/commands/remote.ts` | Use `/auth/codes`, output format with links outside box |

### Deleted Files

| File | Reason |
|------|--------|
| `plugins/tunnel/server.ts` | Hono viewer server replaced by Fastify routes |

### Dependencies

| Package | Change |
|---------|--------|
| `hono` | Remove |
| `@hono/node-server` | Remove |

### Files NOT Changed

| File | Why |
|------|-----|
| `core/message-transformer.ts` | Uses `TunnelServiceInterface` — interface preserved |
| `core/adapter-primitives/display-spec-builder.ts` | Same interface |
| `plugins/telegram/activity.ts` | Same `outputUrl()` / `getStore()` API |
| `plugins/tunnel/viewer-store.ts` | Unchanged — framework agnostic |
| `plugins/tunnel/templates/*` | Pure HTML strings — no framework dependency |
| `plugins/tunnel/providers/*` | Tunnel providers unchanged |
| `plugins/tunnel/tunnel-registry.ts` (core logic) | Retry logic unchanged, only add keepalive hooks |

## 5. Edge Cases

| Edge Case | Handling |
|-----------|----------|
| **Code replay** (same code used twice) | Synchronous check+mark in single event loop tick. First caller wins, second gets 401. |
| **Code expired** | `expiresAt < now` → 401. Cleaned up hourly. |
| **Code brute force** | Rate limit: 10 req/min per IP on `/auth/exchange`. |
| **Concurrent exchange race** | No async gap between `used` check and mark. Event loop guarantees atomicity. |
| **Viewer URLs with old port 3100** | Self-expire via 60-min TTL. No migration needed. |
| **Tunnel plugin without API server** | Log warning, viewer URLs return empty string, user tunnels still work. |
| **API server not ready when tunnel starts** | LifecycleManager dependency order: api-server boots before tunnel. |
| **Cloudflare URL changes after restart** | Keepalive stops, retry creates new tunnel with new URL, keepalive restarts. |
| **Keepalive false positive** (transient blip) | 3 consecutive fails threshold (90s window). |
| **Keepalive + process exit race** | `onExit` handler checks if already retrying, no double-retry. |
| **Startup tunnel slow (>30s)** | Display "⟳ Tunnel connecting...", log URL when ready. |
| **Fastify prefix `/` for viewer routes** | If unsupported, fallback: add `registerRootPlugin()` to ApiServerService. |
| **`/api/file/:id` naming in API server** | No conflict with `/api/v1/*`. Different prefix. Templates use relative URLs — still work. |
| **`tunnel.port` config set by old user** | Ignored + log deprecation warning. Schema keeps field as `.optional()`. |
| **`tunnel.auth.*` config set by old user** | Ignored + log deprecation warning. Schema keeps fields as `.optional()`. |
| **SSH/remote terminal copy** | Plain text links work reliably in all terminals. |
| **Non-TTY output** | No colors, no box. Raw URLs for machine parsing. |
| **Viewer route vs static server SPA** | Registered Fastify routes match before `setNotFoundHandler`. No conflict. |
| **`getPublicUrl()` during tunnel restart** | `publicUrl` cleared when tunnel fails. Returns localhost fallback until new tunnel active. |
