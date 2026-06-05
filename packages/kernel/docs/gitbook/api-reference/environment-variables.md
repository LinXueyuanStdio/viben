# Environment Variables

Environment variables override values in `~/.viben/config.json` at startup. They do not modify the config file.

All overrides are applied before Zod schema validation, so the final config is always validated.

| Variable | Config Equivalent | Type | Description |
|---|---|---|---|
| `VIBEN_TELEGRAM_BOT_TOKEN` | `channels.telegram.botToken` | string | Telegram Bot API token |
| `VIBEN_TELEGRAM_CHAT_ID` | `channels.telegram.chatId` | number | Telegram chat/supergroup ID (parsed as integer) |
| `VIBEN_DISCORD_BOT_TOKEN` | `channels.discord.botToken` | string | Discord bot token |
| `VIBEN_DISCORD_GUILD_ID` | `channels.discord.guildId` | string | Discord server (guild) ID |
| `VIBEN_SLACK_BOT_TOKEN` | `channels.slack.botToken` | string | Slack bot OAuth token (`xoxb-...`) |
| `VIBEN_SLACK_APP_TOKEN` | `channels.slack.appToken` | string | Slack app-level token for Socket Mode (`xapp-...`) |
| `VIBEN_SLACK_SIGNING_SECRET` | `channels.slack.signingSecret` | string | Slack signing secret |
| `VIBEN_DEFAULT_AGENT` | `defaultAgent` | string | Agent name to use when none is specified |
| `VIBEN_RUN_MODE` | `runMode` | `"foreground"` \| `"daemon"` | How `viben` starts the server |
| `VIBEN_API_PORT` | `api.port` | number | REST API listen port (parsed as integer) |
| `VIBEN_LOG_LEVEL` | `logging.level` | string | Log level (`silent`, `debug`, `info`, `warn`, `error`, `fatal`) |
| `VIBEN_LOG_DIR` | `logging.logDir` | string | Directory for log files |
| `VIBEN_DEBUG` | `logging.level` → `"debug"` | any | Set to any non-empty value to enable debug logging. Ignored if `VIBEN_LOG_LEVEL` is also set. |
| `VIBEN_TUNNEL_ENABLED` | `tunnel.enabled` | boolean | Set to `"true"` or `"false"` to enable/disable the tunnel service |
| `VIBEN_TUNNEL_PORT` | `tunnel.port` | number | Tunnel service listen port (parsed as integer) |
| `VIBEN_TUNNEL_PROVIDER` | `tunnel.provider` | string | Tunnel provider (`cloudflare`, `ngrok`, `bore`, `tailscale`) |
| `VIBEN_SPEECH_STT_PROVIDER` | `speech.stt.provider` | string | Active speech-to-text provider name |
| `VIBEN_SPEECH_GROQ_API_KEY` | `speech.stt.providers.groq.apiKey` | string | API key for the Groq STT provider |
| `VIBEN_CONFIG_PATH` | — | string | Override the config file path (default: `<instance-root>/config.json`) |
| `VIBEN_INSTANCE_ROOT` | — | string | Set the instance root directory. Overrides auto-detection and CLI flags. See [Multi-Instance](../features/multi-instance.md). |

## Plugin-Level Environment Variables

With the plugin architecture, channel-specific and feature-specific environment variables are now handled by individual plugins in their `setup()` method. The following variables are **plugin-level** (processed by the respective plugin, not core):

- **Telegram plugin:** `VIBEN_TELEGRAM_BOT_TOKEN`, `VIBEN_TELEGRAM_CHAT_ID`
- **Discord plugin:** `VIBEN_DISCORD_BOT_TOKEN`, `VIBEN_DISCORD_GUILD_ID`
- **Slack plugin:** `VIBEN_SLACK_BOT_TOKEN`, `VIBEN_SLACK_APP_TOKEN`, `VIBEN_SLACK_SIGNING_SECRET`
- **Speech plugin:** `VIBEN_SPEECH_STT_PROVIDER`, `VIBEN_SPEECH_GROQ_API_KEY`
- **Tunnel plugin:** `VIBEN_TUNNEL_ENABLED`, `VIBEN_TUNNEL_PORT`, `VIBEN_TUNNEL_PROVIDER`

These remain functional for backward compatibility but are read by each plugin rather than by core config loading.

**Core-level** variables (processed by VibenCore directly): `VIBEN_CONFIG_PATH`, `VIBEN_DEFAULT_AGENT`, `VIBEN_RUN_MODE`, `VIBEN_API_PORT`, `VIBEN_LOG_LEVEL`, `VIBEN_LOG_DIR`, `VIBEN_DEBUG`.

## Notes

- **`VIBEN_DEBUG`** is a convenience shorthand. Setting `VIBEN_LOG_LEVEL=debug` is equivalent and takes precedence.
- **`VIBEN_CONFIG_PATH`** does not correspond to a config field; it controls where the config file is read from and is evaluated before any config is loaded.
- Numeric fields (`VIBEN_TELEGRAM_CHAT_ID`, `VIBEN_API_PORT`, `VIBEN_TUNNEL_PORT`) are converted to integers automatically.
- Boolean fields (`VIBEN_TUNNEL_ENABLED`) are compared to the string `"true"` — any other value is treated as `false`.
- Env vars take precedence over `config.json` but are not persisted; `viben config set` modifies the file.
