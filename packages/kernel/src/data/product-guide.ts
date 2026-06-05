/**
 * Viben Product Guide — comprehensive reference text injected into the AI assistant's system prompt.
 *
 * The assistant (in the Assistant topic/thread) reads this at startup to answer user questions
 * about features, CLI commands, configuration, and troubleshooting without hitting the network.
 *
 * **How it's used:** The assistant plugin reads `PRODUCT_GUIDE` and prepends it to the system
 * prompt so the AI has full product knowledge baked in, not fetched per-session.
 *
 * **How to update:** Edit the Markdown content below. Keep it accurate with the current feature set —
 * outdated entries cause the assistant to give wrong answers. Sections use `---` dividers and
 * `##` headings so the assistant can navigate the content efficiently.
 */
export const PRODUCT_GUIDE = `
# Viben — Product Guide

Viben lets you chat with AI coding agents (like Claude Code) through messaging platforms (Telegram, Discord).
You type messages in your chat platform, the agent reads/writes/runs code in your project folder, and results stream back in real time.

---

## Quick Start

1. Start Viben: \`viben\` (or \`viben start\` for background daemon)
2. Open your messaging platform (Telegram group or Discord server) — you'll see the Assistant topic/thread
3. Tap/click 🆕 New Session or type /new
4. Pick an agent and a project folder
5. Chat in the session topic/thread — the agent works on your code

---

## Core Concepts

### Sessions
A session = one conversation with one AI agent working in one project folder.
Each session gets its own topic (Telegram) or forum thread (Discord). Chat there to give instructions to the agent.

### Agents
An agent is an AI coding tool (e.g., Claude Code, Gemini, Cursor, Codex, etc.).
Viben supports 28+ agents from the official ACP Registry (agentclientprotocol.com).
You can install multiple agents and choose which one to use per session.
The default agent is used when you don't specify one.

### Agent Management
- Browse agents: \`/agents\` in your chat platform or \`viben agents\` in CLI
- Install: tap the install button in /agents, or \`viben agents install <name>\`
- Uninstall: \`viben agents uninstall <name>\`
- Setup/login: \`viben agents run <name> -- <args>\` (e.g., \`viben agents run gemini -- auth login\`)
- Details: \`viben agents info <name>\` shows version, dependencies, and setup steps

Some agents need additional setup before they can be used:
- Claude: requires \`claude login\`
- Gemini: requires \`viben agents run gemini -- auth login\`
- Codex: requires setting \`OPENAI_API_KEY\` environment variable
- GitHub Copilot: requires \`viben agents run copilot -- auth login\`

Agents are installed in three ways depending on the agent:
- **npx** — Node.js agents, downloaded automatically on first use
- **uvx** — Python agents, downloaded automatically on first use
- **binary** — Platform-specific binaries, downloaded to \`~/.viben/agents/\`

### Project Folder (Workspace)
The directory where the agent reads, writes, and runs code.
When creating a session, you choose which folder the agent works in.
You can type a full path like \`~/code/my-project\` or just a name like \`my-project\` (it becomes \`<base-dir>/my-project\`).

### System Topics
- **Assistant** — Always-on helper that can answer questions, create sessions, check status, troubleshoot
- **Notifications** — System alerts (permission requests, session errors, completions)

---

## Creating Sessions

### From menu
Tap 🆕 New Session → choose agent (if multiple) → choose project folder → confirm

### From command
- \`/new\` — Interactive flow (asks agent + folder)
- \`/new claude ~/code/my-project\` — Create directly with specific agent and folder

### From Assistant topic
Just ask: "Create a session for my-project with claude" — the assistant handles it

### Quick new chat
\`/newchat\` in a session topic — creates new session with same agent and folder as current one

---

## Working with Sessions

### Chat
Type messages in the session topic. The agent responds with code changes, explanations, tool outputs.

### What you see while the agent works
- **💭 Thinking indicator** — Shows when the agent is reasoning, with elapsed time
- **Text responses** — Streamed in real time, updated every few seconds
- **Tool calls** — When the agent runs commands or edits files, you see tool name, input, status, and output
- **📋 Plan card** — Visual task progress with completed/in-progress/pending items and progress bar
- **"View File" / "View Diff" buttons** — Opens in browser with Monaco editor (requires tunnel)

### Session lifecycle
1. **Creating** — Topic created, agent spawning
2. **Warming up** — Agent primes its cache (happens automatically, invisible to you)
3. **Active** — Ready for your messages
4. **Auto-naming** — After your first message, the session gets a descriptive name (agent summarizes in ~5 words). The topic title updates automatically.
5. **Finished/Error** — Session completed or hit an error

### Agent skills
Some agents provide slash commands (e.g., /compact, /review). Available skills are pinned in the session topic.

### Permission requests
When the agent wants to run a command, it asks for permission.
You see buttons: ✅ Allow, ❌ Reject (and sometimes "Always Allow").
A notification also appears in the Notifications topic with a link to the request.

### Bypass permissions
Auto-approves ALL permission requests — the agent runs any command without asking.
- Toggle: \`/bypass_permissions on\` or tap the ☠️ button in the session
- Disable: \`/bypass_permissions off\` or tap the 🔐 button
- ⚠️ Use with caution — the agent can execute anything

### Session timeout
Idle sessions are automatically cancelled after a configurable timeout (default: 60 minutes).
Configure via \`security.sessionTimeoutMinutes\` in config.

---

## Session Transfer (Handoff)

### Chat → Terminal
1. Type \`/handoff\` in a session topic/thread
2. You get a command like \`claude --resume <SESSION_ID>\`
3. Copy and run it in your terminal — the session continues there with full conversation history

### Terminal → Chat
1. First time: run \`viben integrate <agent>\` to install handoff integration (one-time setup)
2. In supported agents (for example Claude Code or OpenCode), use /viben:handoff
3. The session appears as a new topic/thread and you can continue chatting there

### How it works
- The agent session ID is shared between platforms
- Conversation history is preserved — pick up where you left off
- The agent that supports resume (e.g., Claude with \`--resume\`) handles the actual transfer

---

## Managing Sessions

### Status
- \`/status\` — Shows active sessions count and details
- Ask the Assistant: "What sessions are running?"

### List all sessions
- \`/sessions\` — Shows all sessions with status (active, finished, error)

### Cancel
- \`/cancel\` in a session topic — cancels that session
- Ask the Assistant: "Cancel the stuck session"

### Cleanup
- From \`/sessions\` → tap cleanup buttons (finished, errors, all)
- Ask the Assistant: "Clean up old sessions"

---

## Assistant Topic

The Assistant is an always-on AI helper in its own topic. It can:
- Answer questions about Viben
- Create sessions for you
- Check status and health
- Cancel sessions
- Clean up old sessions
- Troubleshoot issues
- Manage configuration

Just chat naturally: "How do I create a session?", "What's the status?", "Something is stuck"

### Clear history
\`/clear\` in the Assistant topic — resets the conversation

---

## System Commands

| Command | Where | What it does |
|---------|-------|-------------|
| \`/new [agent] [path]\` | Anywhere | Create new session |
| \`/newchat\` | Session topic | New session, same agent + folder |
| \`/cancel\` | Session topic | Cancel current session |
| \`/status\` | Anywhere | Show status |
| \`/sessions\` | Anywhere | List all sessions |
| \`/agents\` | Anywhere | Browse & install agents from ACP Registry |
| \`/install <name>\` | Anywhere | Install an agent |
| \`/bypass_permissions\` | Session topic | Toggle bypass permissions (on/off) |
| \`/handoff\` | Session topic | Transfer session to terminal |
| \`/clear\` | Assistant topic | Clear assistant history |
| \`/menu\` | Anywhere | Show action menu |
| \`/help\` | Anywhere | Show help |
| \`/restart\` | Anywhere | Restart Viben |
| \`/update\` | Anywhere | Update to latest version |
| \`/integrate\` | Anywhere | Manage agent integrations |

---

## Menu Buttons

| Button | Action |
|--------|--------|
| 🆕 New Session | Create new session (interactive) |
| 📋 Sessions | List all sessions with cleanup options |
| 📊 Status | Show active/total session count |
| 🤖 Agents | List available agents |
| 🔗 Integrate | Manage agent integrations |
| ❓ Help | Show help text |
| 🔄 Restart | Restart Viben |
| ⬆️ Update | Check and install updates |

---

## CLI Commands

### Server
- \`viben\` — Start (uses configured mode: foreground or daemon)
- \`viben start\` — Start as background daemon
- \`viben stop\` — Stop daemon
- \`viben status\` — Show daemon status
- \`viben logs\` — Tail daemon logs
- \`viben --foreground\` — Force foreground mode (useful for debugging or containers)

### Auto-start (run on boot)
- macOS: installs a LaunchAgent in \`~/Library/LaunchAgents/\`
- Linux: installs a systemd user service in \`~/.config/systemd/user/\`
- Enabled automatically when you start the daemon. Remove with \`viben stop\`.

### Configuration
- \`viben config\` — Interactive config editor
- \`viben reset\` — Delete all data and start fresh

### Agent Management (CLI)
- \`viben agents\` — List all agents (installed + available from ACP Registry)
- \`viben agents install <name>\` — Install an agent
- \`viben agents uninstall <name>\` — Remove an agent
- \`viben agents info <name>\` — Show details, dependencies, and setup guide
- \`viben agents run <name> [-- args]\` — Run agent CLI directly (for login, config, etc.)
- \`viben agents refresh\` — Force-refresh registry cache

### Plugins
- \`viben install <package>\` — Install adapter plugin
- \`viben uninstall <package>\` — Remove adapter plugin
- \`viben plugins\` — List installed plugins

### Integration
- \`viben integrate <agent>\` — Install agent integration (e.g., Claude handoff skill)
- \`viben integrate <agent> --uninstall\` — Remove integration

### API (requires running daemon)
\`viben api <command>\` — Interact with running daemon:

| Command | Description |
|---------|-------------|
| \`status\` | List active sessions |
| \`session <id>\` | Session details |
| \`new <agent> <path>\` | Create session |
| \`send <id> "text"\` | Send prompt |
| \`cancel <id>\` | Cancel session |
| \`bypass <id> on/off\` | Toggle bypass permissions |
| \`topics [--status x,y]\` | List topics |
| \`delete-topic <id> [--force]\` | Delete topic |
| \`cleanup [--status x,y]\` | Cleanup old topics |
| \`agents\` | List agents |
| \`health\` | System health |
| \`config\` | Show config |
| \`config set <key> <value>\` | Update config |
| \`adapters\` | List adapters |
| \`tunnel\` | Tunnel status |
| \`notify "message"\` | Send notification |
| \`version\` | Daemon version |
| \`restart\` | Restart daemon |

---

## File Viewer (Tunnel)

When tunnel is enabled, file edits and diffs get "View" buttons that open in your browser:
- **Monaco Editor** — Full VS Code editor with syntax highlighting
- **Diff viewer** — Side-by-side or inline comparison
- **Line highlighting** — Click lines to highlight
- Dark/light theme toggle

### Setup
Enable in config: set \`tunnel.enabled\` to \`true\`.
Providers: Cloudflare (default, free), ngrok, bore, Tailscale Funnel.

### Port Tunneling

Expose any local port (dev servers, APIs, etc.) to the internet:

**CLI commands** (agent can call these directly):
- \`viben tunnel add <port> --label <name>\` — Create tunnel to a local port
- \`viben tunnel list\` — List active tunnels
- \`viben tunnel stop <port>\` — Stop a tunnel
- \`viben tunnel stop-all\` — Stop all user tunnels

**Telegram commands**:
- \`/tunnel <port> [label]\` — Create tunnel
- \`/tunnels\` — List active tunnels
- \`/tunnel stop <port>\` — Stop tunnel

Example: after starting a dev server on port 3000, run \`viben tunnel add 3000 --label my-app\` to get a public URL.

---

## Configuration

Config file: \`<workspace>/.viben/config.json\` (default: \`~/viben-workspace/.viben/config.json\`)

### Channels
- **channels.telegram.botToken** — Your Telegram bot token
- **channels.telegram.chatId** — Your Telegram supergroup ID
- **channels.discord.botToken** — Your Discord bot token
- **channels.discord.guildId** — Your Discord server (guild) ID

### Agents
- **defaultAgent** — Which agent to use by default
- Agents are managed via \`/agents\` (Telegram) or \`viben agents\` (CLI)
- Installed agent definitions are stored in \`<instance-root>/agents.json\`; downloaded agent binaries live in \`~/.viben/agents/\`
- Agent list is fetched from the ACP Registry CDN and cached locally (24h)

### Workspace
- Workspace directory is the parent of \`.viben/\` (where you ran \`viben\` setup)

### Security
- **security.allowedUserIds** — Restrict who can use the bot (empty = everyone)
- **security.maxConcurrentSessions** — Max parallel sessions (default: 5)
- **security.sessionTimeoutMinutes** — Auto-cancel idle sessions (default: 60)

### Tunnel / File Viewer
- **tunnel.enabled** — Enable file viewer tunnel
- **tunnel.provider** — Tunnel provider: cloudflare (default, free), ngrok, bore, tailscale
- **tunnel.port** — Local port for tunnel server (default: 3100)
- **tunnel.auth.enabled** — Enable authentication for tunnel URLs
- **tunnel.auth.token** — Auth token for tunnel access
- **tunnel.storeTtlMinutes** — How long viewer links stay cached (default: 60)

### Logging
- **logging.level** — Log level: silent, debug, info, warn, error, fatal (default: info)
- **logging.logDir** — Log directory (default: \`<instance-root>/logs\`)
- **logging.maxFileSize** — Max log file size before rotation
- **logging.maxFiles** — Max number of rotated log files
- **logging.sessionLogRetentionDays** — Auto-delete old session logs (default: 30)

### Data Retention
- **sessionStore.ttlDays** — How long session records persist (default: 30). Old records are cleaned up automatically.

### Environment variables
Override config with env vars:
- \`VIBEN_TELEGRAM_BOT_TOKEN\`
- \`VIBEN_TELEGRAM_CHAT_ID\`
- \`VIBEN_DISCORD_BOT_TOKEN\`
- \`VIBEN_DISCORD_GUILD_ID\`
- \`VIBEN_DEFAULT_AGENT\`
- \`VIBEN_RUN_MODE\` — foreground or daemon
- \`VIBEN_API_PORT\` — API server port (default: 21420)
- \`VIBEN_TUNNEL_ENABLED\`
- \`VIBEN_TUNNEL_PORT\`
- \`VIBEN_TUNNEL_PROVIDER\`
- \`VIBEN_LOG_LEVEL\`
- \`VIBEN_LOG_DIR\`
- \`VIBEN_DEBUG\` — Sets log level to debug

---

## Troubleshooting

### Session stuck / not responding
- Check status: ask Assistant "Is anything stuck?"
- Cancel and create new: \`/cancel\` then \`/new\`
- Check system health: Assistant can run health check

### Agent not found
- Check available agents: \`/agents\` or \`viben agents\`
- Install missing agent: \`viben agents install <name>\`
- Some agents need login first: \`viben agents info <name>\` to see setup steps
- Run agent CLI for setup: \`viben agents run <name> -- <args>\`

### Permission request not showing
- Check Notifications topic for the alert
- Try \`/bypass_permissions on\` to auto-approve (if you trust the agent)

### Session disappeared after restart
- Sessions persist across restarts
- Send a message in the old topic — it auto-resumes
- If topic was deleted, the session record may still exist in status

### Bot not responding at all
- Check daemon: \`viben status\`
- Check logs: \`viben logs\`
- Restart: \`viben start\` or \`/restart\`

### Messages going to wrong topic
- Each session is bound to a specific topic/thread
- If you see messages appearing in the Assistant topic instead of the session topic, try creating a new session

### Viewing logs
- Session-specific logs: \`<instance-root>/logs/sessions/\`
- System logs: \`viben logs\` to tail live
- Set \`VIBEN_DEBUG=true\` for verbose output

---

## Data & Storage

Viben stores per-instance state in \`<workspace>/.viben/\` (the instance root), with shared downloads and caches under \`~/.viben/\`:
- \`<instance-root>/config.json\` — Configuration
- \`<instance-root>/agents.json\` — Installed agent definitions (managed by AgentCatalog)
- \`<instance-root>/sessions.json\` — Session records and state
- \`<instance-root>/usage.json\` — Token and cost tracking
- \`<instance-root>/history/\` — Per-session conversation history
- \`<instance-root>/logs/\` — System and session logs
- \`<instance-root>/plugins/\` — Installed adapter plugins and plugin data
- \`<instance-root>/viben.pid\` — Daemon PID file
- \`~/.viben/cache/registry-cache.json\` — Cached ACP Registry data (refreshes every 24h)
- \`~/.viben/agents/\` — Downloaded binary agents

Session records auto-cleanup: 30 days (configurable via \`sessionStore.ttlDays\`).
Session logs auto-cleanup: 30 days (configurable via \`logging.sessionLogRetentionDays\`).
`;
