# Configuration

## Config File Location

Each instance has its own configuration file:

```
<workspace>/.viben/config.json
```

For example, the default instance lives at `~/viben-workspace/.viben/config.json`. The path can be overridden with the `VIBEN_CONFIG_PATH` environment variable. The file is created automatically on first run with safe defaults.

## Interactive Editor

To edit config interactively while Viben is running:

```bash
viben config
```

This opens a menu-driven editor with sections for Channels, Agent, Workspace, Security, Logging, Run Mode, API, and Tunnel. Changes are saved on exit. When the daemon is running, changes are applied immediately via the local API without requiring a restart (where supported).

## Reconfigure Wizard

For a guided reconfiguration of core sections, use:

```bash
viben onboard
```

This runs `runReconfigure()`, which loads your existing config, shows a summary, and lets you step through sections selectively. Sections available:

- **Channels** — Add, modify, disable, or delete channel configurations. For each configured channel you can choose to modify settings, disable the bot without losing credentials, or permanently delete the channel config.
- **Agents** — Select which installed agent to use as the default.
- **Run Mode** — Switch between foreground and daemon mode, and toggle autostart on boot.
- **Integrations** — Configure optional integrations (e.g., Claude CLI).

For the machine-readable schema with all field types and defaults, see the [Configuration Schema](../api-reference/configuration-schema.md). For a full list of environment variable overrides, see [Environment Variables](../api-reference/environment-variables.md).

## Plugin-Specific Settings

With the microkernel plugin architecture, plugin-specific settings (Telegram botToken, speech providers, tunnel config, etc.) are now stored in per-plugin settings files:

```
<instance-root>/plugins/data/<plugin-name>/settings.json
```

The core `config.json` only contains: `defaultAgent`, `security`, `logging`, `runMode`, `autoStart`, and `sessionStore`.

Fields like `channels`, `tunnel`, `speech`, and `usage` in `config.json` are **legacy (auto-migrated)** — they are automatically migrated to their respective plugin `settings.json` files on startup. Existing configurations continue to work without manual changes.

## Full Configuration Reference

### `channels`

Channel adapters. Each key is a channel identifier. The built-in channels are `telegram` and `discord`.

**Telegram:**

```json
"telegram": {
  "enabled": true,
  "botToken": "1234567890:ABC...",
  "chatId": -1001234567890,
  "outputMode": "medium"
}
```

| Field | Type | Default | Description |
|---|---|---|---|
| `enabled` | boolean | `false` | Whether this channel is active |
| `botToken` | string | — | Telegram Bot API token |
| `chatId` | number | — | Forum group chat ID |
| `outputMode` | `low` \| `medium` \| `high` | `medium` | Detail level for agent output messages. The legacy key `displayVerbosity` is accepted for backward compatibility. |

**Discord:**

```json
"discord": {
  "enabled": true,
  "botToken": "MTI...",
  "guildId": "123456789012345678",
  "forumChannelId": null,
  "notificationChannelId": null
}
```

### `agents`

Named map of ACP-compatible agent binaries. Each entry describes how to spawn the agent subprocess.

```json
"agents": {
  "claude": {
    "command": "claude-agent-acp",
    "args": [],
    "env": {},
    "workingDirectory": "~/projects"
  }
}
```

| Field | Type | Default | Description |
|---|---|---|---|
| `command` | string | — | Executable name or path |
| `args` | string[] | `[]` | Additional CLI arguments |
| `env` | object | `{}` | Extra environment variables for the subprocess |
| `workingDirectory` | string | — | Override working directory (otherwise uses workspace) |

### `defaultAgent`

```json
"defaultAgent": "claude"
```

The agent key used when a new session is created. Must exist in `agents`.

### `security`

```json
"security": {
  "allowedUserIds": [],
  "maxConcurrentSessions": 20,
  "sessionTimeoutMinutes": 60
}
```

| Field | Type | Default | Description |
|---|---|---|---|
| `allowedUserIds` | string[] | `[]` | Allowlist of platform user IDs. Empty = all users allowed. |
| `maxConcurrentSessions` | number | `20` | Hard cap on active + initializing sessions across all channels. |
| `sessionTimeoutMinutes` | number | `60` | Idle session timeout in minutes. |

See [Security](security.md) for details.

### `logging`

```json
"logging": {
  "level": "info",
  "logDir": "<instance-root>/logs",
  "maxFileSize": "10m",
  "maxFiles": 7,
  "sessionLogRetentionDays": 30
}
```

See [Logging](logging.md) for details.

### `runMode`

```json
"runMode": "foreground"
```

`"foreground"` or `"daemon"`. Controls whether `viben start` runs in the terminal or spawns a detached background process.

### `autoStart`

```json
"autoStart": false
```

If `true`, Viben installs a platform autostart entry (macOS LaunchAgent or Linux systemd user service) so the daemon starts on login. Managed automatically by the run mode setup in the config editor and onboard wizard.

### `api`

```json
"api": {
  "port": 21420,
  "host": "127.0.0.1"
}
```

The local REST API used by the CLI and web UI. `host` defaults to `127.0.0.1` (loopback only). Do not bind to `0.0.0.0` unless you have network-level access controls in place.

### `tunnel`

```json
"tunnel": {
  "enabled": true,
  "port": 3100,
  "provider": "cloudflare",
  "options": {},
  "maxUserTunnels": 5,
  "storeTtlMinutes": 60,
  "auth": { "enabled": false }
}
```

| Field | Type | Default | Description |
|---|---|---|---|
| `enabled` | boolean | `false` | Enable tunnel |
| `port` | number | `3100` | Local port the tunnel exposes |
| `provider` | string | `"cloudflare"` | `cloudflare`, `ngrok`, `bore`, or `tailscale` |
| `options` | object | `{}` | Provider-specific options (domain, authtoken, etc.) |
| `auth.enabled` | boolean | `false` | Require bearer token on tunnel requests |

### `usage`

```json
"usage": {
  "enabled": true,
  "monthlyBudget": 50,
  "warningThreshold": 0.8,
  "currency": "USD",
  "retentionDays": 90
}
```

Usage tracking. When `monthlyBudget` is set and usage reaches `warningThreshold` (80% by default), a notification is sent. Set `enabled: false` to disable tracking entirely.

### `speech`

```json
"speech": {
  "stt": {
    "provider": null,
    "providers": {
      "groq": { "apiKey": "gsk_..." }
    }
  },
  "tts": {
    "provider": null,
    "providers": {}
  }
}
```

Speech-to-text and text-to-speech configuration. Set `provider` to the key of a configured entry in `providers` to enable. `null` disables speech for that direction.

### `sessionStore`

```json
"sessionStore": {
  "ttlDays": 30
}
```

How long completed session records are retained before cleanup.

### `integrations`

Managed automatically. Records which optional integrations are installed.

## Environment Variable Overrides

The following environment variables override their corresponding config fields at startup. They do not modify the config file on disk.

| Variable | Config path |
|---|---|
| `VIBEN_CONFIG_PATH` | *(config file path itself)* |
| `VIBEN_TELEGRAM_BOT_TOKEN` | `channels.telegram.botToken` |
| `VIBEN_TELEGRAM_CHAT_ID` | `channels.telegram.chatId` |
| `VIBEN_DISCORD_BOT_TOKEN` | `channels.discord.botToken` |
| `VIBEN_DISCORD_GUILD_ID` | `channels.discord.guildId` |
| `VIBEN_SLACK_BOT_TOKEN` | `channels.slack.botToken` |
| `VIBEN_SLACK_APP_TOKEN` | `channels.slack.appToken` |
| `VIBEN_SLACK_SIGNING_SECRET` | `channels.slack.signingSecret` |
| `VIBEN_DEFAULT_AGENT` | `defaultAgent` |
| `VIBEN_RUN_MODE` | `runMode` |
| `VIBEN_API_PORT` | `api.port` |
| `VIBEN_LOG_LEVEL` | `logging.level` |
| `VIBEN_LOG_DIR` | `logging.logDir` |
| `VIBEN_DEBUG` | Sets `logging.level` to `debug` (when `VIBEN_LOG_LEVEL` is not set) |
| `VIBEN_TUNNEL_ENABLED` | `tunnel.enabled` |
| `VIBEN_TUNNEL_PORT` | `tunnel.port` |
| `VIBEN_TUNNEL_PROVIDER` | `tunnel.provider` |
| `VIBEN_SPEECH_STT_PROVIDER` | `speech.stt.provider` |
| `VIBEN_SPEECH_GROQ_API_KEY` | `speech.stt.providers.groq.apiKey` |

Environment variables are applied after the config file is read and before Zod validation. They take precedence over file values.

## Hot-Reload

When `viben config` communicates changes via the local API (daemon mode), supported fields are applied to the running process immediately. Fields that require a full restart (e.g., channel credentials, API port) emit a `needsRestart` signal in the response.

## Backward Compatibility

Every new config field uses `.default()` or `.optional()` in the Zod schema. This means an older `config.json` will always pass validation after an upgrade — missing fields are filled with their defaults. Fields are never renamed or removed without a migration.

Automatic migrations run at startup before validation. Current migrations:

- `add-tunnel-section` — Adds the `tunnel` block if absent (pre-0.3 configs).
- `fix-agent-commands` — Renames legacy agent command names to their current equivalents.
- `migrate-agents-to-store` — Moves agent definitions from `config.json` into the separate `<instance-root>/agents.json` store.

Migrations mutate the raw JSON in place and write it back to disk if any change was made. No action is required from you.
