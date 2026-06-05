# App Connectivity

## What it is

App connectivity lets desktop and web clients connect to a running Viben instance — both on the same machine and remotely (via tunnel). This enables GUI apps, web dashboards, and mobile clients to interact with your Viben server.

---

## Connecting from the same machine

Apps running on the same machine can discover and connect to Viben automatically. No setup is needed — the app reads credentials from a local file that only your user account can access.

---

## Connecting remotely (phone, another computer)

For remote connections, run:

```bash
viben remote
```

This displays:

- **Local URL** — for same-machine access
- **Tunnel URL** — public HTTPS URL via your configured tunnel provider
- **QR code** — scan from your phone to connect instantly

Each link contains a **one-time access code** that expires after 30 minutes. This means:
- The link only works once — sharing it twice does not work
- No long-lived secrets appear in browser history or chat logs
- The code is exchanged for a secure token on first use

If `tunnel.enabled` is `true` in your config, the tunnel starts automatically and `viben remote` uses the existing tunnel URL.

---

## Connection methods

| Method | Best for | How it works |
|--------|----------|--------------|
| Local auto-discovery | Desktop apps on the same machine | App reads credentials from a local file |
| `viben remote` link | Sharing with your phone or a teammate | One-time code, exchanged for a secure token |
| QR code | Quick mobile app setup | Same as remote link, but you scan instead of copy-paste |

---

## Technical details

- Local discovery uses the instance registry at `~/.viben/instances.json`. The API port is read from `<instance-root>/api.port` and authentication uses `<instance-root>/api-secret` directly.
- Remote access codes are generated via `POST /api/v1/auth/codes` and exchanged for JWT tokens via `POST /api/v1/auth/exchange`. JWTs can be refreshed within a 7-day window.
- See [Security](../self-hosting/security.md) for details on roles, scopes, and token management.
