# Viben Managed Tunnel — Design Spec

**Date:** 2026-04-02
**Status:** Draft

## Problem

The current Cloudflare tunnel provider uses unauthenticated quick tunnels
(`cloudflared tunnel --url http://localhost:<port>`), which are rate-limited by
Cloudflare and produce random `*.trycloudflare.com` URLs. Users have no stable
URL and can be throttled without warning.

## Solution

Introduce an `viben` tunnel provider that provisions named Cloudflare tunnels
via an Viben-owned Cloudflare Worker. Users get stable subdomains under
`tunnel.viben.ai`, no login required, and no rate limits from unauthenticated
quick tunnels. The Worker becomes the new default tunnel provider shipped with
Viben.

---

## Architecture

```
[Viben CLI]
  │
  ├─ POST /tunnel/create  (shared API key, IP rate-limited)
  │
[Cloudflare Worker — tunnel-worker.viben.ai]
  │
  ├─ Cloudflare API: create named tunnel + DNS record
  ├─ KV: store { tunnelId, dnsName, lastPing } with TTL
  └─ Returns: { tunnelId, token, publicUrl }
  │
[Viben CLI]
  └─ cloudflared tunnel run --token <token>
     Traffic: localhost → cloudflared → CF network → abc123.tunnel.viben.ai

[Heartbeat — every 10 min]
  └─ POST /tunnel/:id/ping  → Worker resets KV TTL to 24h

[Cron — every 10 min]
  └─ Worker scans KV, deletes tunnels with lastPing > 24h ago

[On stop]
  └─ DELETE /tunnel/:id → Worker deletes DNS record + tunnel via CF API
```

Two deliverables:
- `viben-tunnel-worker/` — new Cloudflare Worker project (TypeScript + Hono)
- `Viben/src/plugins/tunnel/providers/viben.ts` — new `TunnelProvider` implementation

---

## Cloudflare Worker

### Project Structure

```
viben-tunnel-worker/
  src/
    index.ts          — Hono app, route registration
    routes/
      create.ts       — POST /tunnel/create
      ping.ts         — POST /tunnel/:id/ping
      destroy.ts      — DELETE /tunnel/:id
    lib/
      cloudflare-api.ts  — Cloudflare REST API calls (create tunnel, DNS, delete)
      rate-limit.ts      — IP rate limiting via KV
      subdomain.ts       — Random 8-char hex subdomain generator
    cron.ts           — Scheduled cleanup handler
  wrangler.toml
```

### Endpoints

| Method   | Path                | Auth        | Description                         |
|----------|---------------------|-------------|-------------------------------------|
| `POST`   | `/tunnel/create`    | Shared key  | Provision new ephemeral tunnel      |
| `POST`   | `/tunnel/:id/ping`  | Shared key  | Reset TTL (heartbeat)               |
| `DELETE` | `/tunnel/:id`       | Shared key  | Delete tunnel immediately           |
| `GET`    | `/health`           | None        | Health check                        |

**Authentication:** `Authorization: Bearer <VIBEN_API_KEY>` header on all
protected endpoints. Key is an environment secret in `wrangler.toml`.

### POST /tunnel/create — Response

```json
{
  "tunnelId": "cf-uuid-...",
  "publicUrl": "https://abc123.tunnel.viben.ai",
  "token": "eyJ..."
}
```

### KV Data Model

**Namespace:** `TUNNELS`
**Key:** `tunnel:<tunnelId>`

```json
{
  "tunnelId": "cf-uuid-...",
  "dnsName": "abc123.tunnel.viben.ai",
  "createdAt": 1743580800,
  "lastPing": 1743584400
}
```

TTL is managed manually via `lastPing`. The cron handler deletes any entry
where `lastPing` is more than 24 hours ago, then calls the Cloudflare API to
delete the tunnel and its DNS record.

### IP Rate Limiting

**Key:** `ratelimit:<ip>`  
**Value:** request count for the current 1-hour window  
**Limit:** 5 tunnel creates per IP per hour  

Enforced on `POST /tunnel/create` only.

### Subdomain Generation

Generate a random 8-character lowercase hex string. Before creating the DNS
record, verify the subdomain is not already in use in KV. Retry up to 3 times
on collision (statistically negligible).

### Cron Schedule

Runs every 10 minutes. Scans all `tunnel:*` keys in KV. For each entry where
`now - lastPing > 86400s` (24h):
1. Call CF API: delete DNS record
2. Call CF API: delete tunnel
3. Delete KV entry

### Environment Variables (wrangler.toml secrets)

| Variable              | Description                                |
|-----------------------|--------------------------------------------|
| `CF_API_TOKEN`        | Cloudflare API token with Tunnel + DNS permissions |
| `CF_ACCOUNT_ID`       | Cloudflare account ID                      |
| `CF_ZONE_ID`          | Zone ID for `viben.ai`                   |
| `VIBEN_API_KEY`     | Shared secret checked on all requests      |

---

## Viben Core — `VibenTunnelProvider`

### New File

`src/plugins/tunnel/providers/viben.ts`

Implements the existing `TunnelProvider` interface unchanged.

### Constructor

```ts
class VibenTunnelProvider implements TunnelProvider {
  constructor(
    options: Record<string, unknown>,
    binDir: string,
    storage: PluginStorage,
  )
}
```

`options` may carry override values for `workerUrl` and `apiKey` (for testing).
Default values are constants baked into the binary:

```ts
const DEFAULT_WORKER_URL = 'https://tunnel-worker.viben.ai'
const DEFAULT_API_KEY = '<hardcoded — rotatable via CLI release>'
```

### Persisted State

State is stored in the tunnel plugin's `ctx.storage` under the key
`'viben-tunnels'`, as a `Record<string, TunnelState>` keyed by port number
(string form, since JSON keys are strings):

```ts
interface TunnelState {
  tunnelId: string
  token: string
  publicUrl: string
}

// Example value in storage:
// {
//   "3100": { tunnelId: "cf-...", token: "eyJ...", publicUrl: "https://abc.tunnel.viben.ai" },
//   "5173": { tunnelId: "cf-...", token: "eyJ...", publicUrl: "https://xyz.tunnel.viben.ai" }
// }
```

### start(port) Flow

```
1. Load all = storage.get('viben-tunnels') ?? {}
2. If all[port] exists:
   a. POST /tunnel/<tunnelId>/ping
   b. If 200 OK → reuse: token = all[port].token, publicUrl = all[port].publicUrl
   c. If error (404/network) → delete all[port], proceed to step 3
3. POST /tunnel/create → { tunnelId, token, publicUrl }
   a. all[port] = { tunnelId, token, publicUrl }
   b. storage.set('viben-tunnels', all)
4. spawn cloudflared tunnel run --token <token>
   (publicUrl is already known from Worker response — no stdout parsing needed.
   If process exits within 10s, treat as failure and throw.)
5. Start heartbeat: setInterval(() => pingWorker(tunnelId), 10 * 60 * 1000)
6. Return publicUrl
```

### stop(force?) Flow

```
1. clearInterval(heartbeat)
2. Kill cloudflared process (SIGTERM → SIGKILL after 5s, or SIGKILL immediately if force)
3. DELETE /tunnel/<tunnelId>  (fire-and-forget, log error if fails)
4. Load all = storage.get('viben-tunnels') ?? {}
   delete all[port]
   storage.set('viben-tunnels', all)
```

### Crash / Unexpected Exit (onExit)

When cloudflared exits after establishment:
- Do NOT call DELETE (tunnel is still valid on CF)
- Do NOT modify storage (token/tunnelId remain valid)
- Clear heartbeat interval
- Invoke registered `onExit` callback → `TunnelRegistry` handles retry with
  exponential backoff (existing behavior)
- On retry, `start(port)` finds the saved state, pings worker (still alive),
  and reuses the token → same public URL after reconnect

### Existing TunnelRegistry Changes

**`tunnel-registry.ts` — `createProvider()`:** Add one case:

```ts
case 'viben':
  return new VibenTunnelProvider(this.providerOptions, this.binDir ?? '', this.storage)
```

`TunnelRegistry` receives a `storage: PluginStorage` constructor argument
(required — `TunnelService` always passes `ctx.storage` down). If provider is
`viben` and `storage` is absent, `createProvider()` must throw with a clear
error rather than failing silently at runtime.

**`tunnel-service.ts` — `TunnelService` constructor:** Accept and forward
`storage` to `TunnelRegistry`.

### Tunnel Plugin Changes

**`plugins/tunnel/index.ts`:**

1. Add `'storage:read', 'storage:write'` to `permissions` array.
2. Pass `ctx.storage` to `TunnelService` constructor.
3. Update both `install()` and `configure()` provider selection lists to include
   `viben` as the first (default) option:
   ```
   viben    — Viben Managed (recommended, no account needed)
   cloudflare — Cloudflare quick tunnel
   ngrok      — ngrok (requires auth token)
   bore       — bore (self-hostable)
   tailscale  — Tailscale Funnel
   ```
4. Default provider in `install()` when migrating from legacy config: keep
   existing value to avoid disrupting current users.

---

## Error Handling & Fallback

| Scenario | Behavior |
|----------|----------|
| Worker unreachable on `create` | Log error, throw — `TunnelRegistry` retries with backoff |
| Worker returns 429 (IP rate limit) | Same as above — retry backoff |
| `cloudflared` binary missing | `VibenTunnelProvider` calls `ensureCloudflared()` as fallback (reuses existing install logic) |
| `cloudflared` exits unexpectedly | Clear heartbeat, fire `onExit` → registry retries; on retry, saved state is reused if still alive |
| Worker unreachable on `ping` | Log warning, do not throw — tunnel continues running |
| Worker unreachable on `DELETE` | Log warning, continue — cron will cleanup after TTL |
| Saved token rejected by cloudflared | `start()` receives error → delete state entry → create new tunnel |

---

## Backward Compatibility

- Existing users with `provider: 'cloudflare'` in their config are unaffected.
  `CloudflareTunnelProvider` is unchanged.
- `viben` is only the default for **new installs** going through the
  interactive `install()` wizard. Existing installs keep their current provider.
- No config migrations needed.

---

## Project Layout (final)

```
viben-workspace/
  Viben/                                          ← core changes
    src/plugins/tunnel/
      providers/viben.ts                          ← NEW provider
      tunnel-registry.ts                            ← add 'viben' case + storage param
      tunnel-service.ts                             ← forward storage param
      index.ts                                      ← permissions + storage + install options
  viben-tunnel-worker/                            ← NEW Cloudflare Worker project
    src/
      index.ts
      routes/create.ts, ping.ts, destroy.ts
      lib/cloudflare-api.ts, rate-limit.ts, subdomain.ts
      cron.ts
    wrangler.toml
```

---

## Out of Scope

- User accounts or per-user quotas (shared API key + IP rate limit is sufficient for v1)
- Custom domains per user
- Tunnel analytics or usage dashboard
- Migration of existing `cloudflare` users to `viben`
