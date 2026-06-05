# Spec 4: App Connectivity

**Date:** 2026-03-31
**Status:** Draft
**Related specs:**
- [Spec 1: API Server Core](./2026-03-31-api-server-core-design.md)
- [Spec 2: Auth System](./2026-03-31-auth-system-design.md)
- [Spec 3: SSE Adapter](./2026-03-31-sse-adapter-design.md)

## Overview

Mechanisms for app clients (desktop/web) to discover and connect to Viben instances — both locally (same machine) and remotely (via tunnel). Includes the `viben remote` CLI command for generating access links with tokens.

## CLI Command: `viben remote`

### Usage

```
viben remote [flags]
  --role <role>        Role for token (default: admin)
  --expire <duration>  JWT expiry (default: 24h, e.g.: 1h, 7d, 30d)
  --scopes <scopes>    Override scopes (comma-separated)
  --name <label>       Token label (default: auto-generated)
  --no-tunnel          Localhost only, don't auto-start tunnel
  --no-qr              Don't show QR code
  --instance <id>      Specific instance (multi-instance support)
```

### Auto-generated Name Format

Pattern: `remote-HHhMM-DD-MM-YYYY`
Example: `remote-14h30-31-03-2026`

### Command Flow

```
viben remote
  → Load instance config (respect --instance flag)
  → Check API server running?
    → Read <instanceRoot>/api.port
    → File missing → error: "API server not running, start with: viben start"
    → File exists → GET http://localhost:<port>/api/v1/system/health → confirm alive
  → Read secret token from <instanceRoot>/api-secret
  → POST http://localhost:<port>/api/v1/auth/tokens
    → Authorization: Bearer <secret-token>
    → Body: { role: "admin", expire: "24h", name: "remote-14h30-31-03-2026" }
  → Receive JWT access token + metadata
  → Tunnel handling:
    → --no-tunnel flag: skip tunnel
    → Tunnel already running: get tunnel URL from tunnel plugin service
    → Tunnel not running: auto-start tunnel
      → Read tunnel config from instance config
      → Config exists: start with configured provider
      → No config: prompt user to choose provider
        → cloudflare (no account needed, recommended)
        → ngrok (needs auth token)
        → bore (self-hosted)
        → tailscale (private network)
      → Start tunnel → wait for URL
  → Generate 3 link formats
  → Display output
```

### Output Format

```
╔══════════════════════════════════════════════════════════════╗
║  Viben Remote Access                                       ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  Token:   remote-14h30-31-03-2026                           ║
║  Role:    admin                                              ║
║  Expires: 2026-04-01 14:30 (24h)                            ║
║  Refresh: until 2026-04-07 14:30 (7d)                       ║
║                                                              ║
║  Local:                                                      ║
║  http://localhost:3100?token=eyJ...                          ║
║                                                              ║
║  Tunnel:                                                     ║
║  https://abc-123.trycloudflare.com?token=eyJ...             ║
║                                                              ║
║  App:                                                        ║
║  viben://connect?host=abc-123.trycloudflare.com&token=eyJ ║
║                                                              ║
║  ██████████████████████                                      ║
║  ██  QR (tunnel link) ██                                     ║
║  ██████████████████████                                      ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
```

QR code encodes the tunnel link (preferred) or localhost link if `--no-tunnel`. Rendered as ASCII art in terminal using a lightweight package like `qrcode-terminal`.

## App Discovery (Localhost)

When the app runs on the same machine, it can auto-discover running Viben instances.

### Mechanism

The app reads the global instance registry at `~/.viben/instances.json` which contains all registered instances and their root paths.

```json
{
  "version": 1,
  "instances": {
    "main": { "id": "main", "root": "/Users/user/.viben" },
    "dev": { "id": "dev", "root": "/path/to/project/.viben" }
  }
}
```

### Discovery Flow

```
App start (local mode)
  → Read ~/.viben/instances.json
  → For each instance in registry:
    → Read <root>/api.port → file exists? Instance potentially running
    → GET http://localhost:<port>/api/v1/system/health → confirm alive
    → Read <root>/config.json → get instanceName
  → Filter: only keep instances that are running (api.port exists + health OK)
  → 0 running: show "Paste link or scan QR" input
  → 1 running: auto-connect to that instance
  → N running: show list for user to choose
    → Display: instanceName, instanceId, port
  → After selection:
    → Read <root>/api-secret → auto-auth with secret token
    → Connected, full access
```

### Local Auto-Auth

The app reads `<instanceRoot>/api-secret` directly from the file system (same machine, same user — file permission `0o600`). This provides zero-friction authentication for local connections without requiring token paste or QR scan.

## App Connection Flows

### Case 1: Local (Auto-Discover)

```
App start
  → Discovery flow (see above)
  → Found running instance(s)
  → Select instance (auto if single)
  → Read <root>/api-secret from filesystem
  → Use secret token for API auth (full access)
  → Connect SSE stream for sessions
  → Ready
```

No token paste required. Seamless local experience.

### Case 2: Remote (Paste Link / QR Scan)

```
User pastes link or scans QR code
  → App parses URL → extract host + token
  → GET {host}/api/v1/auth/me
    → 200: token valid → proceed
      → Response includes role, scopes, expiresAt
    → 401/403: token invalid/expired → show error + prompt re-enter
    → Network error: host unreachable → show error
  → Token valid → store securely (OS keychain / credential store)
  → Clear token from URL/browser history
  → Use Authorization header for all subsequent requests
  → Connect SSE stream
  → Ready
```

### Case 3: Custom Scheme (Desktop App)

```
User clicks: viben://connect?host=abc-123.trycloudflare.com&token=eyJ...
  → OS opens desktop app with URL params
  → App parses: extract host + token
  → GET {host}/api/v1/auth/me → verify token (same as Case 2)
    → Fail: show error with details
    → OK: store token, connect
  → Ready
```

## Tunnel Auto-Start

When `viben remote` runs and no tunnel is active:

```
→ Get tunnel plugin service: ctx.getService('tunnel')
  → Plugin not installed?
    → Error: "Tunnel plugin not installed. Install with: viben plugin install @viben/tunnel"
  → Plugin installed, check tunnel status
    → Tunnel already running → return existing URL
    → Tunnel not running:
      → Read tunnel config from instance config
      → Config exists (provider selected) → start tunnel with config
      → No config → prompt user to choose provider:
        → cloudflare (recommended, no account needed)
        → ngrok (needs auth token)
        → bore (self-hosted)
        → tailscale (private network)
      → Save chosen provider to config
      → Start tunnel → wait for URL → return URL
```

## Link Formats

Three formats generated for different connection scenarios:

### 1. HTTP Local Link
```
http://localhost:<port>?token=<jwt>
```
For: Browser on same machine, or app fallback when auto-discover unavailable.

### 2. HTTP Tunnel Link
```
https://<tunnel-subdomain>.<provider-domain>?token=<jwt>
```
For: Remote browser access, mobile browser, sharing with others.

### 3. Custom Scheme Link
```
viben://connect?host=<tunnel-host>&token=<jwt>&port=<port>
```
For: Desktop app deep linking. OS routes to installed Viben app. Includes both tunnel host and local port for flexibility.

## Security Considerations

- **Token in URL**: JWT in query params risks being logged by proxies/servers. Mitigations:
  - Short-lived tokens (default 24h)
  - Revokable via token management API
  - App should swap to header-based auth immediately after initial connect
  - App should clear token from URL/history after parsing
- **Local file access**: `api-secret` readable only by same OS user (file permission `0o600`). Never exposed via API.
- **Tunnel exposure**: All API routes require authentication when accessed via tunnel. The only exception is `GET /api/v1/system/health` which returns minimal info (`{ status: "ok" }`) without sensitive data — needed for app discovery verification.
- **Token swap flow** (recommended for apps):
  1. Parse token from URL
  2. Call `GET /api/v1/auth/me` to verify token and get metadata
  3. Store token in secure storage (OS keychain, credential store)
  4. Clear token from URL, query params, browser history
  5. Use `Authorization: Bearer <token>` header for all subsequent requests

## New Dependencies

- `qrcode-terminal` — ASCII QR code rendering in terminal (for `viben remote` output)
