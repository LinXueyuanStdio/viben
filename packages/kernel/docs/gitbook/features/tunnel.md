# Tunneling

## What it is and why it matters

When your AI agent spins up a local development server — a React app on port 3000, a FastAPI service on port 8000, a database UI on port 5432 — that server is only reachable from your own machine. The tunnel feature solves this by establishing a secure public URL that proxies traffic to any local port.

You can share the URL with teammates, preview your app on a phone, or let a webhook service reach your local API. No manual port-forwarding or cloud deployment required.

Viben also runs an internal file viewer server. When an agent edits a file or produces a diff, the viewer generates a shareable link that renders the content with syntax highlighting (via Monaco editor) or side-by-side diff view.

---

## Providers

Viben supports four tunnel providers. The active provider is configured once in `~/.viben/config.json` and applies to all tunnels.

### Cloudflare (default, free)

Uses the `cloudflared` binary to create ephemeral `*.trycloudflare.com` URLs. No account required. Viben installs `cloudflared` automatically to `~/.viben/bin/cloudflared` if it is not already on your PATH.

Supports an optional custom `domain` if you have a Cloudflare account with a zone configured.

### ngrok

Uses the `ngrok` binary. Requires `ngrok` to be installed separately (https://ngrok.com/download). Supports `authtoken`, `domain`, and `region` options.

### bore

Uses the `bore` CLI to tunnel through `bore.pub` (or a self-hosted bore server). Requires `bore` to be installed (https://github.com/ekzhang/bore). Supports custom `server`, `port`, and `secret` options.

### Tailscale Funnel

Uses `tailscale funnel` to expose a port over your Tailscale network. Requires Tailscale to be installed and authenticated (https://tailscale.com/download). The provider resolves your Tailscale hostname via `tailscale status --json` to construct the public URL.

---

## Configuration

Add a `tunnel` block to `<instance-root>/config.json` (see [Configuration](../self-hosting/configuration.md) for the full `tunnel` config reference):

```json
{
  "tunnel": {
    "enabled": true,
    "provider": "cloudflare",
    "maxUserTunnels": 5,
    "storeTtlMinutes": 60,
    "options": {}
  }
}
```

| Field | Default | Description |
|-------|---------|-------------|
| `enabled` | `false` | Enable or disable the tunnel feature. When `true`, the tunnel auto-starts on server boot. |
| `provider` | `"cloudflare"` | One of `cloudflare`, `ngrok`, `bore`, `tailscale` |
| `maxUserTunnels` | `5` | Maximum number of simultaneous user-created tunnels |
| `storeTtlMinutes` | `60` | How long file/diff viewer entries are kept in memory |
| `options` | `{}` | Provider-specific options (see below) |

### Provider-specific options

**Cloudflare:**
```json
{ "options": { "domain": "my-app.example.com" } }
```

**ngrok:**
```json
{ "options": { "authtoken": "...", "domain": "my-app.ngrok.app", "region": "eu" } }
```

**bore:**
```json
{ "options": { "server": "bore.pub", "port": 2200, "secret": "mysecret" } }
```

**Tailscale:**
```json
{ "options": { "bg": true } }
```

---

## CLI commands

Tunnels can be managed from the terminal:

```bash
# Expose a local port
viben tunnel add 3000 --label my-app

# List active tunnels and their public URLs
viben tunnel list

# Stop a tunnel by port
viben tunnel stop 3000

# Stop all user tunnels
viben tunnel stop-all
```

Inside Telegram or Discord, if you have the agent integration installed, the agent can run these commands on your behalf — just ask it to "expose port 3000" or "give me a public URL for this Vite app."

---

## File viewer

When an agent reads, edits, or writes a file, Viben can generate a clickable link that opens the content in a web-based viewer with syntax highlighting and side-by-side diff view. This is especially useful when reviewing changes from your phone.

The viewer supports dozens of languages including TypeScript, JavaScript, Python, Rust, Go, Java, and many more. Large tool output that does not fit inline in chat is also viewable through these links.

Viewer links expire automatically after the configured `storeTtlMinutes` (default 60 minutes).

---

## Limits and auto-recovery

- Each user or session can open up to `maxUserTunnels` tunnels simultaneously (default 5).
- When `tunnel.enabled` is `true`, the tunnel starts automatically on server boot — no manual start needed.
- If the tunnel connection drops, Viben automatically detects the failure and restarts the tunnel within about 90 seconds.

---

## Security

- Files outside the session's working directory cannot be viewed — path access is restricted to prevent unauthorized file access.
- Viewer entries expire automatically and are cleaned up periodically.
- When connecting apps remotely, `viben remote` generates a single-use access code instead of embedding secrets in the URL. See [App Connectivity](app-connectivity.md) for details.
