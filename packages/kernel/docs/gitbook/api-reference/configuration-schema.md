# Configuration Schema

Config is stored at `<workspace>/.viben/config.json` (e.g. `~/viben-workspace/.viben/config.json`). The file is created with defaults on first run. All fields support backward-compatible migrations; old configs load without errors.

Edit interactively with `viben config`, or set individual values with `viben config set <path> <value>`.

---

## channels

Channel adapters. Each adapter key under `channels` is an object. The built-in Telegram and Discord adapters ship with Viben; Slack and others are plugin-based.

### channels.telegram.*

| Field | Type | Default | Description |
|---|---|---|---|
| `channels.telegram.enabled` | boolean | `false` | Enable the Telegram adapter |
| `channels.telegram.botToken` | string | `"YOUR_BOT_TOKEN_HERE"` | Telegram Bot API token (from @BotFather) |
| `channels.telegram.chatId` | number | `0` | Telegram group/supergroup chat ID |
| `channels.telegram.notificationTopicId` | number \| null | `null` | Forum topic ID for system notifications |
| `channels.telegram.assistantTopicId` | number \| null | `null` | Forum topic ID for the Assistant |
| `channels.telegram.outputMode` | `"low"` \| `"medium"` \| `"high"` | `"medium"` | Controls how much detail is shown in messages. The legacy key `displayVerbosity` is accepted for backward compatibility. |

### channels.discord.*

| Field | Type | Default | Description |
|---|---|---|---|
| `channels.discord.enabled` | boolean | `false` | Enable the Discord adapter |
| `channels.discord.botToken` | string | `"YOUR_DISCORD_BOT_TOKEN_HERE"` | Discord bot token |
| `channels.discord.guildId` | string | `""` | Discord server (guild) ID |
| `channels.discord.forumChannelId` | string \| null | `null` | Forum channel ID for session threads |
| `channels.discord.notificationChannelId` | string \| null | `null` | Channel ID for system notifications |
| `channels.discord.assistantThreadId` | string \| null | `null` | Thread ID for the Assistant |
| `channels.discord.outputMode` | `"low"` \| `"medium"` \| `"high"` | `"medium"` | Adapter-level output detail. Overridden per session via `/outputmode session`. 3-level cascade: session → adapter → global → `"medium"`. The legacy key `displayVerbosity` is auto-migrated on startup. |

### channels.slack.*

Slack support is provided via a plugin adapter. Fields follow the schema below when the Slack plugin is installed.

| Field | Type | Default | Description |
|---|---|---|---|
| `channels.slack.enabled` | boolean | `false` | Enable the Slack adapter |
| `channels.slack.botToken` | string | — | Slack bot OAuth token (`xoxb-...`) |
| `channels.slack.appToken` | string | — | Slack app-level token for Socket Mode (`xapp-...`) |
| `channels.slack.signingSecret` | string | — | Slack signing secret for request verification |
| `channels.slack.notificationChannelId` | string | — | Channel ID for system notifications |
| `channels.slack.allowedUserIds` | string[] | `[]` | Slack user IDs permitted to interact |
| `channels.slack.channelPrefix` | string | `"viben"` | Prefix for auto-created Slack channels |
| `channels.slack.autoCreateSession` | boolean | `true` | Auto-create a session on first message |
| `channels.slack.startupChannelId` | string | — | Channel to post startup notification to |

### Base channel fields (all adapters)

| Field | Type | Default | Description |
|---|---|---|---|
| `enabled` | boolean | `false` | Whether this channel is active |
| `adapter` | string | — | Package name for plugin-based adapters |
| `outputMode` | `"low"` \| `"medium"` \| `"high"` | `"medium"` | Message detail level. The legacy key `displayVerbosity` is accepted for backward compatibility. |

---

## agents

Map of named agent configurations. Each key is an agent name used in `defaultAgent` and session creation.

| Field | Type | Default | Description |
|---|---|---|---|
| `agents.<name>.command` | string | — | Executable to spawn (e.g. `claude-agent-acp`) |
| `agents.<name>.args` | string[] | `[]` | Arguments passed to the command |
| `agents.<name>.workingDirectory` | string | — | Default working directory for this agent |
| `agents.<name>.env` | object | `{}` | Additional environment variables for the subprocess |

**Example**
```json
"agents": {
  "claude": { "command": "claude-agent-acp", "args": [], "env": {} },
  "codex":  { "command": "codex", "args": ["--acp"], "env": {} }
}
```

---

## outputMode

| Field | Type | Default | Description |
|---|---|---|---|
| `outputMode` | `"low"` \| `"medium"` \| `"high"` | `"medium"` | Global default output mode. Overridden per adapter via `channels.<name>.outputMode` and per session via `/outputmode session`. See [Output Modes](../features/output-modes.md). |

---

## defaultAgent

| Field | Type | Default | Description |
|---|---|---|---|
| `defaultAgent` | string | `"claude"` | Agent name used when no agent is specified in a session |

---

## workspace

| Field | Type | Default | Description |
|---|---|---|---|
| `workspace.allowExternalWorkspaces` | boolean | `true` | Whether sessions can use working directories outside the workspace root |

The workspace base directory is derived automatically from the instance root parent — it is no longer a config field. The directory containing `.viben/` is the workspace.

---

## security

| Field | Type | Default | Description |
|---|---|---|---|
| `security.allowedUserIds` | string[] | `[]` | Whitelist of channel user IDs permitted to start sessions. Empty list allows all users. |
| `security.maxConcurrentSessions` | number | `20` | Maximum number of simultaneously active sessions |
| `security.sessionTimeoutMinutes` | number | `60` | Minutes of inactivity before a session is automatically closed |

---

## logging

| Field | Type | Default | Description |
|---|---|---|---|
| `logging.level` | `"silent"` \| `"debug"` \| `"info"` \| `"warn"` \| `"error"` \| `"fatal"` | `"info"` | Log verbosity level |
| `logging.logDir` | string | `"<instance-root>/logs"` | Directory for log files |
| `logging.maxFileSize` | string \| number | `"10m"` | Maximum size per log file before rotation |
| `logging.maxFiles` | number | `7` | Number of rotated log files to retain |
| `logging.sessionLogRetentionDays` | number | `30` | Days to retain per-session log files |

---

## api

| Field | Type | Default | Description |
|---|---|---|---|
| `api.port` | number | `21420` | Port for the local REST API server |
| `api.host` | string | `"127.0.0.1"` | Host/interface to bind. Change to `0.0.0.0` to expose externally (not recommended without firewall rules). |

---

## runMode

| Field | Type | Default | Description |
|---|---|---|---|
| `runMode` | `"foreground"` \| `"daemon"` | `"foreground"` | How `viben` (no args) starts the server. `daemon` forks to a background process. |

---

## autoStart

| Field | Type | Default | Description |
|---|---|---|---|
| `autoStart` | boolean | `false` | Whether to register Viben as a system service that starts on login |

---

## sessionStore

| Field | Type | Default | Description |
|---|---|---|---|
| `sessionStore.ttlDays` | number | `30` | Days before session records are purged from the store |

---

## tunnel

| Field | Type | Default | Description |
|---|---|---|---|
| `tunnel.enabled` | boolean | `false` | Enable the built-in tunnel service. When `true`, the tunnel auto-starts on server boot with keepalive monitoring. |
| `tunnel.provider` | `"cloudflare"` \| `"ngrok"` \| `"bore"` \| `"tailscale"` | `"cloudflare"` | Tunnel provider |
| `tunnel.options` | object | `{}` | Provider-specific options (passed through to the tunnel process) |
| `tunnel.maxUserTunnels` | number | `5` | Maximum number of simultaneous user-created tunnels |
| `tunnel.storeTtlMinutes` | number | `60` | Minutes before expired tunnel entries are cleaned up |

---

## usage

| Field | Type | Default | Description |
|---|---|---|---|
| `usage.enabled` | boolean | `true` | Track token/cost usage per session |
| `usage.monthlyBudget` | number | — | Monthly spending limit in `usage.currency` |
| `usage.warningThreshold` | number | `0.8` | Fraction of budget at which to send a warning (0–1) |
| `usage.currency` | string | `"USD"` | Currency for budget tracking |
| `usage.retentionDays` | number | `90` | Days to retain usage records |

---

## speech

### speech.stt.*

| Field | Type | Default | Description |
|---|---|---|---|
| `speech.stt.provider` | string \| null | `null` | Active STT provider name (e.g. `"groq"`) |
| `speech.stt.providers.<name>.apiKey` | string | — | API key for the named provider |
| `speech.stt.providers.<name>.model` | string | — | Model identifier for the named provider |

### speech.tts.*

| Field | Type | Default | Description |
|---|---|---|---|
| `speech.tts.provider` | string \| null | `null` | Active TTS provider name |
| `speech.tts.providers.<name>.apiKey` | string | — | API key for the named provider |
| `speech.tts.providers.<name>.model` | string | — | Model identifier for the named provider |

---

## agentSwitch

Controls the behavior of the `/switch` command.

| Field | Type | Default | Description |
|---|---|---|---|
| `agentSwitch.labelHistory` | boolean | `true` | When `true`, agent names are prepended to messages in the conversation history injected into the new agent during a switch. Helps the incoming agent distinguish which AI produced which response. |

**Example**
```json
"agentSwitch": {
  "labelHistory": true
}
```

---

## integrations

Tracks installed agent integrations (managed automatically by `viben agents install` / `viben integrate`).

| Field | Type | Description |
|---|---|---|
| `integrations.<name>.installed` | boolean | Whether the integration is installed |
| `integrations.<name>.installedAt` | string | ISO 8601 timestamp of installation |
