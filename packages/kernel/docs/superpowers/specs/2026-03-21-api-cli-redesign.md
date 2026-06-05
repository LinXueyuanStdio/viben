# API CLI Redesign — Rename `runtime` to `api` + New Commands

**Date:** 2026-03-21
**Status:** Approved

## Problem

The `viben runtime` CLI subcommand group is vague — "runtime" doesn't communicate what it does. Users confuse `viben status` (daemon health) with `viben runtime status` (active sessions). Additionally, many useful operations available in the codebase are not exposed via CLI.

## Solution

1. Rename `runtime` → `api` across CLI, help text, and error messages
2. Add 11 new CLI commands + their corresponding HTTP API endpoints

## Design Decisions

- **`api` as the group name.** Technically accurate (all commands talk to the internal HTTP API), short, and familiar. The user approved this name.
- **New HTTP endpoints follow existing patterns.** Same `ApiServer.handleRequest` router, same `sendJson` response format, same error conventions (404/400/429/500).
- **`api config set` validates via Zod before saving.** The API handler pre-validates by building the merged config and running `ConfigSchema.safeParse()` before calling `ConfigManager.save()`. If validation fails, 400 is returned with the Zod error. `ConfigManager.save()` itself silently ignores validation failures, so pre-validation is required.
- **`api send` is fire-and-forget from CLI perspective.** Prompt is enqueued; output goes to the adapter (Telegram topic). CLI just confirms enqueue. This matches how the API session creation already works.
- **`api health` aggregates from multiple sources.** No new module needed — just reads from existing objects at request time.

## 1. Rename: `runtime` → `api`

### Files Changed

- `src/cli.ts` — Change command map key from `'runtime'` to `'api'`, update import from `cmdRuntime` to `cmdApi`
- `src/cli/commands.ts` — Rename `cmdRuntime` → `cmdApi`, update all help text and error messages from `runtime` to `api`
- Help text in `printHelp()` — Replace all `viben runtime` with `viben api`

### Backward Compatibility

None needed. This is a pre-1.0 project with no external consumers depending on the `runtime` command name.

## 2. New HTTP API Endpoints

### `POST /api/sessions/:sessionId/prompt`

Send a prompt to a running session.

- Body: `{ "prompt": "fix the login bug" }`
- Success: `200 { ok: true, sessionId, queueDepth }`
- Session not found: `404 { error: "Session not found" }`
- Session not active (status is `cancelled`, `finished`, or `error`): `400 { error: "Session is not active" }`. Note: `initializing` sessions accept prompts — the queue buffers them until warmup completes.
- Missing prompt: `400 { error: "Missing prompt" }`

Implementation: Calls `session.enqueuePrompt(prompt)`. Returns immediately — output is delivered via the adapter (Telegram topic etc).

### `GET /api/sessions/:sessionId`

Get detailed info about a single session.

- Response: `200 { session: { id, agent, status, name, workspace, createdAt, dangerousMode, queueDepth, promptRunning, threadId, channelId, agentSessionId } }`
- Not found: `404 { error: "Session not found" }`

Merges data from the in-memory `Session` object and the persisted `SessionRecord`.

### `PATCH /api/sessions/:sessionId/dangerous`

Toggle dangerous mode for a session.

- Body: `{ "enabled": true }` or `{ "enabled": false }`
- Success: `200 { ok: true, dangerousMode: boolean }`
- Session not found: `404 { error: "Session not found" }`

Implementation: Two-step update — (1) set `session.dangerousMode = enabled` on the in-memory object, then (2) persist via `sessionManager.updateSessionDangerousMode(sessionId, enabled)` to the session store.

### `GET /api/health`

System health check.

- Response:
```json
{
  "status": "ok",
  "uptime": 3600,
  "version": "0.5.0",
  "memory": { "rss": 52428800, "heapUsed": 25165824 },
  "sessions": { "active": 2, "total": 5 },  // active = in-memory sessions with active/initializing status, total = all records from session store
  "adapters": ["telegram"],
  "tunnel": { "enabled": true, "url": "https://abc.trycloudflare.com" } | { "enabled": false }
}
```

No authentication — server only listens on 127.0.0.1.

### `POST /api/restart`

Trigger daemon restart.

- Success: `200 { ok: true, message: "Restarting..." }`
- Not available: `501 { error: "Restart not available" }` (if `core.requestRestart` is null)

Implementation: Calls `core.requestRestart()` which triggers graceful shutdown with `RESTART_EXIT_CODE`.

### `GET /api/config`

Get current runtime configuration.

- Response: `200 { config: <full config object> }`

Sensitive fields are redacted: `channels.telegram.botToken` → `"***"`, `tunnel.auth.token` → `"***"`.

### `PATCH /api/config`

Update configuration at runtime.

- Body: `{ "path": "security.maxConcurrentSessions", "value": 10 }`
- Success: `200 { ok: true, config: <updated full config> }`
- Invalid: `400 { error: "Validation failed: ..." }`
- Invalid path: `400 { error: "Invalid config path" }`

Implementation: Converts dot-path to nested object, calls `ConfigManager.save()` which deep-merges and validates via Zod. Note: some config changes (like port, adapters) won't take effect until restart — the response includes a `needsRestart: boolean` flag for paths that require it.

### `GET /api/adapters`

List registered adapters and their status.

- Response:
```json
{
  "adapters": [
    { "name": "telegram", "type": "built-in" }
  ]
}
```

### `GET /api/tunnel`

Tunnel status and public URL.

- Response (enabled): `200 { enabled: true, url: "https://abc.trycloudflare.com", provider: "cloudflare" }`
- Response (disabled): `200 { enabled: false }`

### `POST /api/notify`

Send a notification to all channels.

- Body: `{ "message": "Deploy complete!" }`
- Success: `200 { ok: true }`
- Missing message: `400 { error: "Missing message" }`

Implementation: Constructs a `NotificationMessage` and calls `core.notificationManager.notifyAll()`:
```typescript
core.notificationManager.notifyAll({
  sessionId: 'api',
  type: 'completed',
  summary: body.message,
})
```

### `GET /api/version`

Get running daemon version.

- Response: `200 { version: "0.5.0" }`

Reads from `package.json` at runtime. This may differ from the CLI version if the user updated the CLI but hasn't restarted the daemon.

## 3. New CLI Commands

All new commands follow the existing pattern: read port from `~/.viben/api.port`, call HTTP endpoint, format output.

### `viben api send <session-id> <prompt>`

```
$ viben api send abc123 "fix the login bug"
Prompt sent to session abc123 (queue depth: 1)
```

Prompt text can be the remaining args joined, or quoted.

### `viben api session <session-id>`

```
$ viben api session abc123
Session abc123
  Agent        : claude
  Status       : active
  Name         : "Fix login bug"
  Workspace    : /Users/lucas/code/myapp
  Created      : 2026-03-21 14:30:00
  Dangerous    : off
  Queue depth  : 0
  Prompt active: no
  Channel      : telegram
  Thread       : 42
```

### `viben api dangerous <session-id> [on|off]`

```
$ viben api dangerous abc123 on
Dangerous mode enabled for session abc123

$ viben api dangerous abc123 off
Dangerous mode disabled for session abc123
```

### `viben api health`

```
$ viben api health
Viben Health
  Status   : ok
  Uptime   : 1h 23m
  Version  : 0.5.0
  Memory   : 50 MB RSS, 24 MB heap
  Sessions : 2 active / 5 total
  Adapters : telegram
  Tunnel   : https://abc.trycloudflare.com
```

### `viben api restart`

```
$ viben api restart
Restart signal sent. Viben is restarting...
```

### `viben api config`

```
$ viben api config
{
  "defaultAgent": "claude",
  "security": { ... },
  "logging": { ... },
  ...
}
```

Prints the full config as formatted JSON (with sensitive fields redacted).

### `viben api config set <path> <value>`

```
$ viben api config set security.maxConcurrentSessions 10
Config updated: security.maxConcurrentSessions = 10
```

The CLI parses the value as JSON if possible, otherwise treats as string. Dot-path notation for nested keys.

### `viben api adapters`

```
$ viben api adapters
Registered adapters:
  telegram  (built-in)
```

### `viben api tunnel`

```
$ viben api tunnel
Tunnel: active
  Provider : cloudflare
  URL      : https://abc.trycloudflare.com
```

Or: `Tunnel: not enabled`

### `viben api notify <message>`

```
$ viben api notify "Deploy complete!"
Notification sent to all channels.
```

### `viben api version`

```
$ viben api version
Daemon version: 0.5.0
```

## 4. Updated Help Text

```
Usage:
  viben                              Start (mode from config)
  viben start                        Start as background daemon
  viben stop                         Stop background daemon
  viben status                       Show daemon status
  viben logs                         Tail daemon log file
  viben config                       Edit configuration
  viben reset                        Delete all data and start fresh
  viben update                       Update to latest version
  viben install <package>            Install a plugin adapter
  viben uninstall <package>          Uninstall a plugin adapter
  viben plugins                      List installed plugins
  viben --foreground                 Force foreground mode
  viben --version                    Show version
  viben --help                       Show this help

API (requires running daemon):
  viben api status                       Show active sessions
  viben api session <id>                 Show session details
  viben api new [agent] [workspace]      Create a new session
  viben api send <id> <prompt>           Send prompt to session
  viben api cancel <id>                  Cancel a session
  viben api dangerous <id> [on|off]      Toggle dangerous mode
  viben api agents                       List available agents
  viben api topics [--status s1,s2]      List topics
  viben api delete-topic <id> [--force]  Delete a topic
  viben api cleanup [--status s1,s2]     Cleanup finished topics
  viben api health                       Show system health
  viben api adapters                     List registered adapters
  viben api tunnel                       Show tunnel status
  viben api config                       Show runtime config
  viben api config set <key> <value>     Update config value
  viben api restart                      Restart daemon
  viben api notify <message>             Send notification to all channels
  viben api version                      Show daemon version

Note: "viben status" shows daemon process health.
      "viben api status" shows active agent sessions.
      "viben --version" shows CLI version.
      "viben api version" shows running daemon version.
```

## 5. ApiServer Changes

**Constructor:** No change to the existing constructor signature — it already has access to `core` (which provides `configManager`, `sessionManager`, `agentManager`, `notificationManager`, `adapters`, `tunnelService`, `requestRestart`) and `topicManager`. A new `private startedAt = new Date()` property is added to the class for uptime calculation in the health endpoint.

**Route ordering:** The `handleRequest` method grows with new route matches. More-specific routes (e.g., `POST /api/sessions/:id/prompt`, `PATCH /api/sessions/:id/dangerous`) must be matched **before** the existing greedy `DELETE /api/sessions/(.+)$` pattern. The if/else chain order for session routes:

1. `POST /api/sessions/:id/prompt` (match `/api/sessions/(.+)/prompt$`)
2. `PATCH /api/sessions/:id/dangerous` (match `/api/sessions/(.+)/dangerous$`)
3. `GET /api/sessions/:id` (match `/api/sessions/([^/]+)$` — non-greedy)
4. `DELETE /api/sessions/:id` (match `/api/sessions/([^/]+)$` — non-greedy, updated from `.+`)
5. `GET /api/sessions` (exact match)
6. `POST /api/sessions` (exact match)

The existing `if/else if` pattern is kept (consistent with current code) — the total route count (~18) doesn't warrant a router abstraction yet.

## 6. Config Redaction

A utility function `redactConfig(config)` strips sensitive fields before sending over the API:

```typescript
const SENSITIVE_KEYS = ['botToken', 'token', 'apiKey', 'secret', 'password', 'webhookSecret']

function redactConfig(config: Config): Config {
  const redacted = structuredClone(config)
  redactDeep(redacted)
  return redacted
}

function redactDeep(obj: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.includes(key) && typeof value === 'string') {
      obj[key] = '***'
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      redactDeep(value as Record<string, unknown>)
    }
  }
}
```

This approach handles current fields (`botToken`, `tunnel.auth.token`) and automatically catches future sensitive fields from plugin adapters.

## 7. Restart-Requiring Config Paths

These config paths require a daemon restart to take effect:

- `api.port`, `api.host`
- `channels.*` (adapter registration happens at startup)
- `tunnel.*` (tunnel starts at startup)
- `runMode`
- `agents.*.command`, `agents.*.args` (existing sessions keep old agent, new sessions use new config)

The `PATCH /api/config` response includes `needsRestart: boolean`.

## Implementation Order

1. Rename `runtime` → `api` (CLI mapping, function name, help text)
2. Add new HTTP endpoints to `ApiServer` (health, version, config, restart, adapters, tunnel, notify, send, session detail, dangerous)
3. Add new CLI commands to `cmdApi` function
4. Update help text
5. Add tests for new endpoints
6. Update assistant system prompt to use `viben api` instead of `viben runtime`
