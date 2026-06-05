# Security

## User Allowlist

By default, any user who can send messages to your bot can create sessions. To restrict access to a specific set of users, populate `security.allowedUserIds` in your config:

```json
"security": {
  "allowedUserIds": ["123456789", "987654321"]
}
```

Values are platform user IDs as strings. For Telegram, this is the numeric user ID. For Discord, it is the user snowflake.

When the list is non-empty, `SecurityGuard.checkAccess()` rejects any incoming message whose `userId` is not in the list. The user receives no response (the message is silently dropped). An empty list means all users are allowed — this is the default and is appropriate when your bot is in a private group that only you can access.

To find your user ID:
- **Telegram**: Message `@userinfobot` or `@getidsbot`.
- **Discord**: Enable Developer Mode in Settings, then right-click your username and select "Copy User ID".

## Concurrent Session Limits

```json
"security": {
  "maxConcurrentSessions": 20
}
```

This is a hard cap on the number of sessions with status `active` or `initializing` across all channels at any given moment. When the limit is reached, new incoming messages are rejected with a "Session limit reached" response until an existing session completes.

The default of 20 is generous for personal use. Reduce it if you are on a machine with limited resources or want to prevent accidental runaway usage.

## Session Timeout

```json
"security": {
  "sessionTimeoutMinutes": 60
}
```

Sessions that have been idle (no new prompt sent) for longer than this value are eligible for automatic cleanup. The default is 60 minutes.

## API Authentication

The REST API uses a two-tier authentication system:

### Secret token (master key)

The API secret is stored in `<instance-root>/api-secret` (e.g. `~/viben-workspace/.viben/api-secret`). This file is created automatically on first start with `0600` permissions. The token is a 64-character hex string generated with `crypto.randomBytes(32)`.

The secret token provides full administrative access. Use it for:

- CLI-to-daemon communication (handled automatically).
- Issuing JWT access tokens for apps and integrations.

```http
Authorization: Bearer <contents of api-secret>
```

At startup, if the file permissions are more permissive than `0600`, a warning is logged:

```
API secret file has insecure permissions (should be 0600). Run: chmod 600 <instance-root>/api-secret
```

### JWT access tokens

For app clients and remote access, Viben issues scoped JWT tokens. Unlike the secret token, JWTs are:

- **Scoped** — assigned a role (`admin`, `operator`, or `viewer`) with predefined permissions.
- **Revokable** — can be revoked individually via the API.
- **Time-limited** — expire after a configurable period, with a 7-day refresh window.
- **Stateful** — tracked in `<instance-root>/tokens.json` with last-used timestamps.

#### Roles

| Role | Capabilities |
|------|-------------|
| `admin` | Full access: manage sessions, config, agents, tokens |
| `operator` | Create/manage sessions, send prompts, view config |
| `viewer` | Read-only: view sessions, status, and events |

#### Issuing tokens

Tokens are issued by authenticating with the secret token:

```bash
curl -X POST \
  -H "Authorization: Bearer $SECRET" \
  -H "Content-Type: application/json" \
  -d '{"name": "my-app", "role": "operator"}' \
  http://localhost:21420/api/v1/auth/tokens
```

Or use `viben remote` to generate a one-time access code that can be exchanged for a JWT (see [App Connectivity](../features/app-connectivity.md)).

#### Revoking tokens

```bash
curl -X DELETE \
  -H "Authorization: Bearer $SECRET" \
  http://localhost:21420/api/v1/auth/tokens/<token-id>
```

### Network security

Do not expose the API port externally. The default `host: "127.0.0.1"` binding ensures the API is only reachable from localhost. If you change `api.host` to `0.0.0.0`, the server logs a warning — ensure your firewall blocks external access to port `21420`.

For remote access, use a tunnel instead of exposing the port directly. The tunnel provides HTTPS encryption and access control via one-time codes.

## Bypass Permissions

Some agent operations (file writes, command execution) require explicit user approval via permission request buttons in the chat. This is the default behavior. For details on how permissions work from a user's perspective, see [Permissions](../using-viben/permissions.md).

If an agent is configured to run without permission prompts (agent-side configuration), ensure your allowlist is restricted to trusted users only, since any allowlisted user will have the ability to trigger unrestricted agent actions.

## Best Practices

1. **Always set `allowedUserIds`** unless your bot is already in a fully private, access-controlled group. Even a private Telegram group can have its invite link shared accidentally.

2. **Keep `api-secret` at `0600`**. The CLI warns you if it is not. Run `chmod 600 <instance-root>/api-secret` if needed.

3. **Do not change `api.host` to `0.0.0.0`** unless you have a specific need and have locked down port `21420` with firewall rules. Use tunnels for remote access instead.

4. **Review `maxConcurrentSessions`** if you share the bot with multiple users. A session per user is reasonable; 20 concurrent ACP agent subprocesses can be resource-intensive.

5. **Rotate the API secret** by deleting `<instance-root>/api-secret` and restarting the daemon. A new token is generated automatically. All existing JWT tokens issued from the old secret become invalid.

6. **Use daemon mode with autostart** for persistent deployments so the server does not silently go offline after a reboot.

7. **Revoke unused JWT tokens** periodically. Use `GET /api/v1/auth/tokens` to list active tokens and their last-used timestamps. Revoke any you no longer need.
