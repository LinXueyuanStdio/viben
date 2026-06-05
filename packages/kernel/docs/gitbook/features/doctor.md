# Doctor

## What it is

`viben doctor` runs a suite of system health checks and reports the status of every major component. It is the fastest way to diagnose why something is not working — misconfigured tokens, missing agent binaries, stale PID files, corrupt sessions data, and more.

---

## Running doctor

From the terminal:

```bash
viben doctor
```

From inside Telegram or Discord, send `/doctor` in the Assistant topic.

Each check produces one or more results with a status of `pass`, `warn`, or `fail`. A summary line at the end shows total counts.

---

## Checks

| Check | What it verifies |
|-------|-----------------|
| **Config** | Config file exists, is valid JSON, passes schema validation, and has no pending migrations |
| **Agents** | Each configured agent's binary exists on PATH; flags a missing default agent as a failure |
| **Telegram** | Bot token is set, the bot can reach the Telegram API, and the configured chat ID resolves to a supergroup with forum topics enabled |
| **Discord** | Bot token and guild ID are set, the bot can connect and access the configured guild |
| **Storage** | Instance root exists and is writable; `sessions.json` is valid; log directory exists and is writable |
| **Workspace** | The instance workspace directory (parent of `.viben/`) exists and is readable |
| **Plugins** | Plugins directory exists; each installed plugin can be loaded without errors |
| **Daemon** | PID file is valid and the process is alive; API port file is valid; API port is in use by Viben (not another process) |
| **Tunnel** | Tunnel is enabled; configured provider is recognized; `cloudflared` binary is present (for Cloudflare provider); tunnel port is in valid range |

---

## Auto-fix

Some issues can be fixed automatically. When a fix is marked as safe (low risk), doctor applies it immediately and reports what was done. Examples of safe auto-fixes:

- Applying pending config migrations
- Removing a stale or invalid PID file
- Removing an invalid API port file
- Creating a missing log directory
- Installing the `cloudflared` binary

Fixes that are risky (could cause data loss, such as resetting a corrupt sessions file) are listed as pending and require explicit confirmation before they are applied.

---

## Exit code

`viben doctor` exits with code `0` if all checks pass or produce only warnings. It exits with code `1` if any check fails. This makes it usable in CI or startup scripts:

```bash
viben doctor || exit 1
```
