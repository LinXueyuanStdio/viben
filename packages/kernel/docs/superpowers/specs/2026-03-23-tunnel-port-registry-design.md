# Dynamic Tunnel Port Registry — Design Spec

## Overview

Extend the tunnel service from a single-port file viewer into a multi-port registry. Each port gets its own tunnel process (via the configured provider) and public URL. The registry persists across restarts.

## TunnelEntry

```typescript
interface TunnelEntry {
  port: number
  type: 'system' | 'user'
  provider: string            // 'cloudflare' | 'ngrok' | 'bore' | 'tailscale'
  label?: string
  publicUrl?: string
  sessionId?: string
  status: 'stopped' | 'starting' | 'active' | 'failed'
  createdAt: string
}
```

## Entry Types

| Type | Auto-start | User kill | User visible | Session end | Example |
|------|-----------|-----------|-------------|-------------|---------|
| `system` | Yes | No | Hidden from `/tunnels` | Keep | File Viewer (port 3100) |
| `user` | Yes (restore) | Yes | Shown | Kill + notify | React app (port 3000) |

System tunnels are internal — users only see and manage user tunnels.

## TunnelRegistry

- In-memory Map: `port → { entry, process, spawnPromise? }`
- Persisted to `~/.viben/tunnels.json`
- Debounced writes (2s)
- On startup: load file → set all entries to `stopped` → re-spawn via configured provider
- `ensureCloudflared()` called once (if provider is cloudflare), path cached
- Each entry spawns through the existing `TunnelProvider` abstraction, not hardcoded to cloudflared
- Max concurrent user tunnels enforced via `tunnel.maxUserTunnels` config (default: 5)

### API

```typescript
class TunnelRegistry {
  add(port: number, opts: { type, provider, label?, sessionId? }): Promise<TunnelEntry>
  stop(port: number): Promise<void>
  stopBySession(sessionId: string): Promise<void>
  stopAll(): Promise<void>
  list(includeSystem?: boolean): TunnelEntry[]  // default: user only
  get(port: number): TunnelEntry | null
  getBySession(sessionId: string): TunnelEntry[]
  restore(): Promise<void>
}
```

### Race Condition Handling

Each entry tracks its `spawnPromise`. When `stop()` is called while status is `starting`:
1. Await the spawn promise (or cancel it)
2. Then kill the process
3. This prevents killing a half-spawned process

## TunnelService Refactor

Currently manages a single provider + Hono HTTP server. Refactored:

- **System tunnel** = tunnel to the internal Hono viewer server (port 3100). Serves `/view/:id`, `/diff/:id` endpoints. This is an implementation detail — hidden from users.
- **User tunnel** = raw tunnel to any local port (3000, 5173, 8080...). No Hono involved — just cloudflared/ngrok/bore/tailscale proxying traffic directly to the local port.

```
TunnelService
  ├── TunnelRegistry
  │     ├── system entry (port 3100) → cloudflared → Hono viewer
  │     ├── user entry (port 3000) → cloudflared → React dev server
  │     └── user entry (port 5173) → cloudflared → Vite dev server
  ├── ViewerStore (attached to system entry)
  ├── addTunnel(port, opts) → registry.add()
  ├── stopTunnel(port) → registry.stop()
  └── listTunnels() → registry.list() (user only)
```

Provider selection per entry: each `TunnelEntry` stores its `provider` field. On spawn, the registry instantiates the corresponding `TunnelProvider` implementation. If the user changes the global provider config between restarts, existing entries keep their original provider (persisted in `tunnels.json`).

## Config

```json
{
  "tunnel": {
    "enabled": true,
    "port": 3100,
    "provider": "cloudflare",
    "maxUserTunnels": 5,
    "storeTtlMinutes": 60,
    "auth": { "enabled": false }
  }
}
```

New field: `maxUserTunnels` (default: 5). Prevents resource exhaustion from too many concurrent cloudflared processes.

## Commands

### Telegram

| Command | Description |
|---------|-------------|
| `/tunnel <port> [label]` | Register a user tunnel |
| `/tunnels` | List user tunnels (system hidden) |
| `/tunnel stop <port>` | Stop a user tunnel |

### CLI

| Command | Description |
|---------|-------------|
| `viben tunnel add <port> [--label name] [--session id]` | Register |
| `viben tunnel list` | List user tunnels |
| `viben tunnel stop <port>` | Stop |
| `viben tunnel stop-all` | Stop all user tunnels |

### Assistant Topic

The assistant's system prompt includes tunnel context. Users can interact conversationally:
- "tunnel my React app on port 3000" → assistant calls `/tunnel 3000`
- "show my tunnels" → assistant calls `/tunnels`
- "stop the tunnel on 3000" → assistant calls `/tunnel stop 3000`

Bot commands (`/tunnel`, `/tunnels`) also work directly in the Assistant topic.

## Lifecycle

### System tunnel
1. Viben start → registry.add({ port: 3100, type: 'system', provider, label: 'File Viewer' })
2. Spawn provider → URL ready
3. Restart → restore, re-spawn, new URL (Cloudflare free tier)
4. Shutdown → stop process, persist as `stopped`

### User tunnel
1. `/tunnel 3000 my-react-app` or `viben tunnel add 3000 --label my-react-app`
2. Check maxUserTunnels limit
3. Spawn provider → URL → notify user
4. Restart → restore, set `stopped` → re-spawn → notify new URL
5. `/tunnel stop 3000` → kill, remove entry, notify
6. Session destroy → stopBySession() → kill, remove, notify

## Notifications

Notifications are sent as structured data to the notification system. Each adapter formats appropriately (Telegram uses emoji, others may differ).

| Event | Summary |
|-------|---------|
| Created | Tunnel opened: port 3000 → {url} |
| Created (label) | Tunnel opened: port 3000 (my-react-app) → {url} |
| Stopped (user) | Tunnel stopped: port 3000 — user requested |
| Stopped (session) | Tunnel stopped: port 3000 — session ended |
| Failed | Tunnel failed: port 3000 — provider error |
| Restored | Tunnel restored: port 3000 → {new url} |

## Persistence

```json
[
  { "port": 3100, "type": "system", "provider": "cloudflare", "label": "File Viewer", "status": "stopped", "createdAt": "..." },
  { "port": 3000, "type": "user", "provider": "cloudflare", "label": "my-react-app", "sessionId": "abc123", "status": "stopped", "createdAt": "..." }
]
```

All entries persisted as `status: 'stopped'`. On restore, transition: `stopped` → `starting` → `active`. This avoids a window where status is `active` but URL is null.

`publicUrl` is not persisted — providers like Cloudflare free tier generate a new URL on each spawn.

## Integration

- **Core**: session destroy → `tunnelService.stopBySession(sessionId)`
- **Telegram**: `/tunnel`, `/tunnels` commands + notifications + assistant context
- **CLI**: `viben tunnel` subcommands
- **Product guide**: update tunnel CLI docs so agents can invoke `viben tunnel add` after starting a dev server
- **Config**: `tunnel.enabled: false` → blocks all tunnel registration

## Files

| File | Action |
|------|--------|
| `src/tunnel/tunnel-registry.ts` | New — registry with persistence and provider-per-entry |
| `src/tunnel/tunnel-service.ts` | Refactor — delegate to registry |
| `src/adapters/telegram/commands/tunnel.ts` | New — /tunnel, /tunnels commands |
| `src/cli/commands.ts` | Modify — add tunnel subcommands |
| `src/core/core.ts` | Modify — session destroy hook |
| `src/core/config.ts` | Modify — add maxUserTunnels |
| `src/product-guide.ts` | Modify — document tunnel CLI |
| `docs/guide/tunnel.md` | Update |
