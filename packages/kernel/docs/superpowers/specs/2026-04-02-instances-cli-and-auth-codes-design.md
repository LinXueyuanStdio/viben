# Spec: Instances CLI & Auth Codes

**Date:** 2026-04-02
**Status:** Draft
**Related specs:**
- [Spec 1: API Server Core](./2026-03-31-api-server-core-design.md)
- [Spec 2: Auth System](./2026-03-31-auth-system-design.md)
- [Spec 4: App Connectivity](./2026-03-31-app-connectivity-design.md)
- [Multi-Instance Design](./2026-03-30-multi-instance-design.md)
- [App Spec: Add Workspace Feature](../../Viben-App/docs/superpowers/specs/2026-04-02-add-workspace-feature-design.md)

## Overview

Three additions to the Viben core to support the Add Workspace feature in the desktop app:

1. **`viben instances` CLI subcommand** — list and create instances with app-friendly JSON output.
2. **Extend `start --json` output** — include full instance info after startup (wizard or normal start).
3. **Auth code exchange** — one-time codes for secure remote connection, replacing JWT-in-URL.
4. **`GET /api/v1/workspace` endpoint** — lets authenticated clients fetch workspace identity info.

---

## 1. `viben instances` CLI Subcommand

### Relationship to `viben status --all`

`viben status --all` already exists and lists all instances in a table format for terminal users. The new `viben instances list` command targets **app consumption**: its JSON output uses a different schema (`directory` = parent of `.viben` root, `root` = `.viben` path) compared to `status --all --json` which returns runtime fields (`channels`, `runMode`, `pid`). Human-readable output of `instances list` reuses the same table rendering as `status --all`.

---

### `viben instances list`

Lists all registered instances with live status.

```
viben instances list [--json]
```

**Status check per instance:**
1. Read `<root>/viben.pid` — file missing → `stopped`
2. If PID file exists, check process alive (kill -0) → dead process → `stopped`
3. If process alive, `GET http://localhost:<port>/api/v1/system/health` → confirm alive → `running`

**JSON output (`--json`):**

```json
[
  {
    "id": "main",
    "name": "Main",
    "directory": "/Users/user",
    "root": "/Users/user/.viben",
    "status": "running",
    "port": 21420
  },
  {
    "id": "my-project",
    "name": "My Project",
    "directory": "/Users/user/my-project",
    "root": "/Users/user/my-project/.viben",
    "status": "stopped",
    "port": null
  }
]
```

All paths are **absolute** — no `~/` prefix. `directory` = `path.dirname(root)` (the human-facing project folder, not the `.viben` subdirectory itself).

**Human-readable output (no `--json`):** Same table format as `viben status --all`. Can share rendering logic.

---

### `viben instances create`

Creates or registers a new instance at a given directory, non-interactively.

```
viben instances create
  --dir <path>              Target directory — system appends /.viben internally (user-facing convention from multi-instance spec)
  [--from <path>]           Clone from this existing instance directory (same convention: parent dir, not /.viben)
  [--name <name>]           Instance name (default: viben-<N>)
  [--agent <agentName>]     Set default agent in config
  [--no-interactive]        Skip setup wizard entirely
  [--json]                  Print resulting instance info as JSON to stdout
```

**Flow:**

```
→ Resolve --dir to absolute path (expand ~/, resolve symlinks)
→ Check <dir>/.viben already exists?
  → Yes + already in registry:
    → Error: "Instance already exists at <dir> (id: <id>)"
    → Exit 1
  → Yes + not in registry:
    → Read instanceName from <dir>/.viben/config.json
    → Register entry in ~/.viben/instances.json
    → Skip creation, go to output step
→ No .viben yet:
  → --from <fromPath> provided:
    → Validate <fromPath>/.viben/config.json exists (error if not found)
    → Clone using existing copy logic (from multi-instance spec)
    → Register new instance in ~/.viben/instances.json
  → --no-interactive (no --from):
    → Create <dir>/.viben/ directory structure
    → Write minimal config.json: { instanceName: <name>, runMode: "daemon" }
    → Write agents.json with default agent if --agent provided
    → Register in ~/.viben/instances.json
→ Output step:
  → --json: print instance info JSON to stdout, exit 0
  → No --json: print "Instance created: <name> at <dir>", exit 0
```

**JSON output (`--json`):**

```json
{
  "id": "my-project",
  "name": "My Project",
  "directory": "/Users/user/my-project",
  "root": "/Users/user/my-project/.viben",
  "status": "stopped",
  "port": null
}
```

---

## 2. Extend `start --json` and Onboarding Output

### Current `start --json` Output

`viben start --json` (and the default command when starting) already outputs:
```json
{ "success": true, "data": { "pid": 1234, "instanceId": "main", "dir": "/Users/user/.viben" } }
```

`dir` here is the `.viben` root path.

### Required Change

Extend the `data` payload to include `name` and `directory` (the parent folder, i.e., the human-facing project folder):

```json
{
  "success": true,
  "data": {
    "pid": 1234,
    "instanceId": "main",
    "name": "Main",
    "directory": "/Users/user",
    "dir": "/Users/user/.viben",
    "port": 21420
  }
}
```

`dir` is kept for backward compatibility. `directory` is `path.dirname(dir)`.

### Onboarding Wizard with `--json`

When `viben` (or `viben start`) is run with `--json` and no config exists:

1. The setup wizard runs normally (interactive terminal prompts — `--json` controls output format, not interactivity).
2. After wizard completes and server starts, the extended `start --json` output is emitted.

The app reads this JSON from sidecar stdout to capture the newly created instance's `id` immediately after setup completes.

---

## 3. Auth Code Exchange

### Motivation

The current `viben remote` spec embeds the JWT directly in the URL (`?token=eyJ...`). Tokens in URLs can be logged by proxies, cached by browsers, and exposed in QR codes. Replacing the JWT with a short-lived one-time code means the actual token is never exposed in a URL.

### New Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/v1/auth/codes` | Secret token only | Generate one-time code |
| `POST` | `/api/v1/auth/exchange` | None (code is credential) | Exchange code for JWT |

---

### `POST /api/v1/auth/codes`

Only callable with secret token auth.

**Request body:**
```json
{
  "role": "admin",
  "name": "remote-14h30-31-03-2026",
  "expire": "24h",
  "scopes": ["sessions:read"]
}
```
Same fields as `POST /api/v1/auth/tokens` — the code carries the intended token parameters.

**Response:**
```json
{
  "code": "abc123xyz",
  "expiresAt": "2026-04-02T14:35:00Z"
}
```

**Storage:** In-memory Map `code → { tokenParams, expiresAt, used: false }`. Codes expire after 5 minutes. Cleanup on exchange or expiry.

---

### `POST /api/v1/auth/exchange`

No authentication required — the code is the credential.

**Request body:**
```json
{ "code": "abc123xyz" }
```

**Flow:**
```
→ Look up code in store
→ Not found: 401 "Invalid code"
→ Found but expired: 401 "Code expired"
→ Found but already used: 401 "Code already used"
→ Mark code as used (single-use, prevent replay)
→ Call internal token generation with stored tokenParams
→ Return same response as POST /api/v1/auth/tokens
```

**Response:**
```json
{
  "accessToken": "eyJ...",
  "tokenId": "tok_abc123",
  "expiresAt": "2026-04-03T14:30:00Z",
  "refreshDeadline": "2026-04-09T14:30:00Z"
}
```

---

### `viben remote` — Updated Link Format

```
viben remote
  → POST /api/v1/auth/codes (secret token) → code "abc123xyz"
  → Generate links:
    viben://connect?host=<tunnel>&code=abc123xyz
    https://<tunnel>?code=abc123xyz
    http://localhost:<port>?code=abc123xyz
```

The `token=` query param in all link formats is replaced by `code=`. The auth spec's existing link formats are updated accordingly.

---

## 4. `GET /api/v1/workspace`

Returns identity information about the current workspace/instance. Used by the app after connecting to a remote workspace to retrieve the instance `id` and display info.

**Auth:** Any valid auth (secret token or JWT — no specific scope required beyond authentication).

**Response:**
```json
{
  "id": "main",
  "name": "Main",
  "directory": "/Users/user",
  "version": "2026.401.1"
}
```

`directory` is `path.dirname(instanceRoot)` — the parent of the `.viben` folder, i.e., the human-facing project folder.

`directory` is the server-side filesystem path. For remote workspaces, it is meaningful for display only — connection routing uses `host`, not `directory`.

---

## Files to Add / Modify

### New Files (core)
- `src/cli/commands/instances.ts` — `instances list` and `instances create` subcommands
- `src/plugins/api-server/routes/workspace.ts` — `GET /api/v1/workspace` route
- `src/plugins/api-server/auth/code-store.ts` — in-memory code store (TTL + single-use)
- `src/plugins/api-server/routes/auth-codes.ts` — `POST /api/v1/auth/codes` and `POST /api/v1/auth/exchange` routes

### Modified Files (core)
- `src/cli.ts` — register `instances` subcommand in instance-aware command map
- `src/cli/commands/index.ts` — export `cmdInstances`
- `src/cli/commands/start.ts` — extend `--json` output with `name`, `directory`, `port`
- `src/cli/commands/default.ts` — extend `--json` output (startup after wizard) with same fields
- `src/plugins/api-server/routes/auth.ts` — register new code exchange routes
- `src/plugins/api-server/server.ts` — register workspace route

### Modified Files (app)
See companion spec: [App Spec: Add Workspace Feature](../../Viben-App/docs/superpowers/specs/2026-04-02-add-workspace-feature-design.md)
