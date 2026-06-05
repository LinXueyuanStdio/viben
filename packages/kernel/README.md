Viben — self-hosted bridge that connects 28+ AI coding agents (Claude Code, Codex, Gemini, Cursor) to Telegram, Discord & Slack. Your machine, your keys, your data.

<div align="center">

# Viben

**Control AI coding agents from Telegram, Discord & Slack**

Send a message. The agent writes code. You see everything — in real time.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js >= 20](https://img.shields.io/badge/Node.js-%3E%3D%2020-green.svg)](https://nodejs.org/)
[![ACP Protocol](https://img.shields.io/badge/Protocol-ACP-purple.svg)](https://agentclientprotocol.org/)
[![npm](https://img.shields.io/npm/v/@viben/kernel.svg)](https://www.npmjs.com/package/@viben/kernel)
[![Twitter Follow](https://img.shields.io/twitter/follow/viben_ai?style=social)](https://x.com/viben_ai)

[Documentation](https://viben.gitbook.io/docs) · [Quick Start](#quick-start) · [Features](#features) · [Agents](#supported-agents) · [Contributing](CONTRIBUTING.md) · [Discussions](https://github.com/LinXueyuanStdio/viben/discussions)

<img src="docs/images/banner.jpg" alt="Viben — Control AI coding agents from Telegram, Discord and Slack" width="100%" />

</div>

---

## What is Viben?

Viben is a self-hosted bridge that connects AI coding agents to your messaging platforms. You chat with an AI agent through Telegram, Discord, or Slack — it reads your codebase, writes code, runs commands, and streams results back to you in real time.

Built on the open [Agent Client Protocol (ACP)](https://agentclientprotocol.org/). Your machine, your keys, your data.

```
You (Telegram / Discord / Slack)
  ↓
Viben (bridge + session manager)
  ↓
AI Agent (Claude Code, Codex, Gemini, Cursor, ...)
  ↓
Your Codebase
```

## Why Viben?

| Without Viben | With Viben |
|----------------|-------------|
| *"Its usage is currently focused on its dedicated terminal REPL and specific IDE integrations"* | Control from Telegram, Discord, or Slack — any device, anywhere |
| *"Codex Desktop App only works with local projects. It does not support development on remote hosts"* | Full remote development support — run agents on your server, manage from your phone |
| *"There's no way to trigger Claude Code sessions from external issue trackers"* | REST API for CI/CD integration and external triggers |
| *"Being able to use a proper mobile app UI would be much better than having to access sessions through ssh + tmux"* | Native Telegram/Discord UI — no SSH, no terminal on mobile |
| *"Cline is really burning up OpenRouter tokens and my wallet"* | Built-in usage tracking and monthly budget limits per session |

## Use Cases

- **Remote coding** — Tired of being chained to your desk to run Claude Code? Review PRs, fix bugs, and deploy from your phone via Telegram while away from your desk.
- **Team visibility** — Share a Discord channel where everyone sees what the AI agent is doing in real time — no more black-box coding sessions.
- **Multi-agent workflows** — Start with Claude Code for planning, switch to Codex for implementation, use Gemini for review — all in one chat thread, no reconfiguration.
- **CI/CD integration** — Trigger agent sessions from GitHub Actions or any issue tracker via the REST API.
- **Self-hosted AI gateway** — Keep API keys and code on your own infrastructure. No third-party cloud, no vendor lock-in.
- **Local LLM support** — Run agents against self-hosted models (Ollama, LM Studio) via ACP-compatible adapters. Your models, your data.

<div align="center">
<table>
<tr>
<td align="center"><img src="docs/images/menu.png" width="250" alt="Viben control panel showing session management, agent selection, and settings menu in Telegram" /><br /><b>Control Panel</b><br />Manage sessions, agents, and settings</td>
<td align="center"><img src="docs/images/agent-working.png" width="250" alt="AI coding agent reading files, planning changes, and writing code through Viben Telegram interface" /><br /><b>Agent at Work</b><br />Plans, reads files, writes code</td>
</tr>
<tr>
<td align="center"><img src="docs/images/tool-calls.png" width="250" alt="Real-time tool call streaming showing agent actions like file reads, edits, and command execution" /><br /><b>Real-time Tool Calls</b><br />See every action the agent takes</td>
<td align="center"><img src="docs/images/skills.png" width="250" alt="Viben agent skills menu with options for brainstorming, TDD, debugging, and code review" /><br /><b>Agent Skills</b><br />Brainstorming, TDD, debugging & more</td>
</tr>
</table>
</div>

## Installation

**Requirements:** Node.js 20+ (the installer handles this for you)

### macOS

```bash
curl -fsSL https://raw.githubusercontent.com/Viben/Viben/main/scripts/install.sh | bash
```

### Linux

```bash
curl -fsSL https://raw.githubusercontent.com/Viben/Viben/main/scripts/install.sh | bash
```

> Works on Debian/Ubuntu, Fedora/RHEL, Arch, and other distros. Also supports WSL (Windows Subsystem for Linux).

### Windows

Open PowerShell and run:

```powershell
powershell -c "irm https://raw.githubusercontent.com/Viben/Viben/main/scripts/install.ps1 | iex"
```

> Requires PowerShell 5.1+ (built into Windows 10/11).

### Manual install via npm

If you do not have Node.js yet, install it first. For example, on macOS or Linux with `nvm`:

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm install --lts
nvm use --lts
```

Then install Viben with npm:

```bash
npm install -g @viben/kernel
viben
# → Interactive setup wizard starts:
# → ? Choose your platform: Telegram / Discord / Slack
# → ? Enter your bot token: ********
# → ? Select workspace directory: ~/projects
# → ? Choose default AI agent: Claude Code
# → ✓ Configuration saved. Starting Viben...
# → 🚀 Viben is running. Send a message to your bot!
```

---

After installation, the **interactive setup wizard** walks you through everything:

1. Choose your platform (Telegram, Discord, Slack, or multiple)
2. Connect your bot (token validation + auto-detection)
3. Pick a workspace directory
4. Select your default AI agent
5. Choose run mode (foreground or daemon)

That's it. Send a message to your bot and start coding.

> **Need detailed setup for a specific platform?** See the [Platform Setup guides](https://viben.gitbook.io/docs/platform-setup).

## Features

### Messaging Platforms

| Platform | Status | Highlights |
|----------|--------|------------|
| **Telegram** | Stable | Forum topics per session, streaming, permission buttons, voice |
| **Discord** | Stable | Thread-based sessions, slash commands, button interactions |
| **Slack** | Stable | Socket Mode, channel-based sessions, thread organization |

### Core

- **28+ AI agents** — Claude Code, Codex, Gemini, Cursor, Copilot, and [more](#supported-agents)
- **Session management** — Each conversation gets its own thread/topic with auto-naming
- **Session persistence** — Sessions survive restarts, with configurable TTL
- **Permission control** — Approve or deny agent actions via buttons, with optional auto-approve
- **Real-time streaming** — See agent thinking, tool calls, and output as they happen
- **Agent switching** — Switch agents mid-conversation with `/switch`; history carries over automatically

### Developer Tools

- **Tunnel & port forwarding** — Expose local ports to the internet (Cloudflare, ngrok, bore, Tailscale)
- **Built-in file viewer** — Monaco Editor with syntax highlighting, diffs, and markdown preview
- **Session transfer** — Move sessions between terminal and chat (`/handoff`)
- **Agent switch** — Change which AI agent handles your session mid-conversation (`/switch`)
- **Voice & speech** — Send voice messages, get spoken responses (Groq STT + Edge TTS)
- **Usage tracking** — Token counts, cost reports, optional monthly budget limits
- **Context resume** — Resume sessions with full conversation history

### Operations

- **Daemon mode** — Run as a background service with auto-start on boot
- **CLI API** — Full REST API for automation (`viben api ...`)
- **Plugin system** — Install adapters as npm packages
- **Doctor diagnostics** — `viben doctor` checks everything and suggests fixes
- **Structured logging** — Pino with rotation, per-session log files

> **Full feature documentation** — [Documentation](https://viben.gitbook.io/docs)

## Supported Agents

Viben uses the [ACP Registry](https://agentclientprotocol.com/get-started/registry) — new agents are available as soon as they're registered.

| Agent | Type | Description |
|-------|------|-------------|
| [Claude Code](https://github.com/anthropics/claude-code) | npx | Anthropic's Claude coding agent |
| [Gemini CLI](https://github.com/google-gemini/gemini-cli) | npx | Google's Gemini CLI |
| [Codex CLI](https://github.com/openai/codex) | npx | OpenAI's coding assistant |
| [GitHub Copilot](https://github.com/github/copilot-cli) | npx | GitHub's AI pair programmer |
| [Cursor](https://www.cursor.com/) | binary | Cursor's coding agent |
| [Cline](https://github.com/cline/cline) | npx | Autonomous coding agent |
| [goose](https://github.com/block/goose) | binary | Open source AI agent by Block |
| Amp | binary | The frontier coding agent |
| [Auggie CLI](https://www.augmentcode.com/) | npx | Augment Code's context engine |
| [Junie](https://www.jetbrains.com/) | binary | AI coding agent by JetBrains |
| [Kilo](https://github.com/kilocode/kilo) | npx | Open source coding agent |
| [Qwen Code](https://github.com/QwenLM/qwen-code) | npx | Alibaba's Qwen assistant |
| ...and more | | [Full registry →](https://agentclientprotocol.com/get-started/registry) |

```bash
viben agents                     # Browse all agents
viben agents install <name>      # Install from registry
```

## CLI Overview

```bash
# Server
viben                            # Start (first run = setup wizard)
viben start / stop / restart     # Daemon management
viben status                     # Check daemon status
viben logs                       # Tail daemon logs

# Configuration
viben config                     # Interactive config editor
viben reset                      # Re-run setup wizard
viben doctor                     # System diagnostics

# Sessions & API (requires running daemon)
viben api new [agent] [workspace]
viben api status
viben api cancel <id>

# Tunnels
viben tunnel add <port> [--label name]
viben tunnel list
```

> **Full CLI reference** — [CLI Commands](https://viben.gitbook.io/docs/api-reference/cli-commands)

## Documentation

| Section | Description |
|---------|-------------|
| [Getting Started](https://viben.gitbook.io/docs/getting-started) | What is Viben, quickstart for users & developers |
| [Platform Setup](https://viben.gitbook.io/docs/platform-setup) | Step-by-step guides for Telegram, Discord, Slack |
| [Using Viben](https://viben.gitbook.io/docs/using-viben) | Commands, sessions, agents, permissions, voice |
| [Self-Hosting](https://viben.gitbook.io/docs/self-hosting) | Installation, configuration, daemon, security |
| [Features](https://viben.gitbook.io/docs/features) | Tunnel, context resume, usage tracking, and more |
| [Extending](https://viben.gitbook.io/docs/extending) | Plugin system, building adapters, contributing |
| [API Reference](https://viben.gitbook.io/docs/api-reference) | CLI commands, REST API, config schema, env vars |
| [Troubleshooting](https://viben.gitbook.io/docs/troubleshooting) | Common issues and FAQ |

## Known Limitations

- **Early stage** — Viben is under active development; expect breaking changes between minor versions
- **Single user** — Currently designed for individual use; multi-user/team support is planned
- **Remote host** — Agents run on the same machine as Viben; to use on a remote server, install Viben on that server
- **Agent availability** — Some agents require their own API keys and local installation
- **Platform features** — Not all messaging platform features are supported equally (e.g., Slack threads vs Telegram forum topics)
- **No Windows daemon** — Daemon mode (auto-start on boot) currently supports macOS and Linux only

## FAQ

### Why use Telegram or Discord instead of just the terminal?
Most AI coding agents are locked to a terminal REPL or IDE. Viben lets you send messages, review code diffs, approve or deny actions, and monitor progress from any device — phone, tablet, or browser — without opening a laptop.

### How is Viben different from MCP?
MCP (Model Context Protocol) is a standard for giving AI models access to tools and data sources. Viben uses the **Agent Client Protocol (ACP)** to manage full coding agent *sessions* — starting agents, streaming output, handling permissions, and routing results to your messaging platform. The two protocols are complementary: your agents can use MCP tools while Viben manages the session layer.

### Can I auto-approve agent actions?
Yes. By default, Viben shows a permission button for destructive actions. You can configure [auto-approve rules](https://viben.gitbook.io/docs/using-viben) to skip confirmation for specific action types (e.g., read-only operations) while still requiring approval for file writes or shell commands.

### How do I control API spending?
Set a monthly budget limit in your config. Viben tracks token usage and cost in real time and will pause the agent when the limit is reached. Run `viben config` to set limits per session.

### Can I use a local or self-hosted LLM?
Yes, if the model has a compatible agent CLI. Any agent that implements the ACP protocol can be registered. Community adapters exist for Ollama and LM Studio — run `viben agents` to browse available options.

### What happens if the agent gets stuck or the chat hangs?
Use `/cancel` in your chat to stop the current session. Run `viben doctor` to check for connectivity or configuration issues. Viben's session persistence means you can resume with full context intact after a restart.

### Does Viben send my code to the cloud?
No. Viben runs entirely on your machine. AI agents connect directly to your chosen provider using your own API keys. Nothing is routed through Viben servers.

### Can I use multiple AI agents at the same time?
Each session uses one agent, but you can run multiple sessions simultaneously — one per thread/topic in your chat. Switch agents between sessions or start a new session with a different agent at any time.

### Is Viben free?
Yes. Viben is MIT-licensed and free to self-host. You only pay for the AI provider API keys you choose to use.

### How do I update Viben?
```bash
npm update -g @viben/kernel
```

## Security

Viben grants AI agents access to your filesystem and shell. Before using in production:

- Run in a sandboxed environment or container when possible
- Review agent permissions — use the built-in permission gate to approve/deny actions
- Never expose your Viben instance to the public internet without authentication
- Keep your bot tokens secret — rotate them if compromised
- See the [Security guide](https://viben.gitbook.io/docs/self-hosting/security) for hardening recommendations

## Star History

<a href="https://star-history.com/#Viben/Viben&Date">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=Viben/Viben&type=Date&theme=dark" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=Viben/Viben&type=Date" />
   <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=Viben/Viben&type=Date" />
 </picture>
</a>

## Contributing

We welcome contributions! See the [contributing guide](CONTRIBUTING.md) for development setup, testing conventions, and PR process. Have questions? Start a thread on [GitHub Discussions](https://github.com/LinXueyuanStdio/viben/discussions).

## License

[MIT](LICENSE)
