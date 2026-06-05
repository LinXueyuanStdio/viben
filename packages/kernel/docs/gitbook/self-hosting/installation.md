# Installation

## System Requirements

| Requirement | Minimum |
|---|---|
| Node.js | 20 or later |
| Package manager | npm (bundled with Node) or pnpm |
| Operating system | macOS, Linux |
| Windows | Supported via WSL2 |

No database, no Docker, no external services required beyond the messaging platform bots you configure.

## One-liner install (recommended)

The fastest way to install Viben on macOS or Linux:

```bash
curl -fsSL https://raw.githubusercontent.com/Viben/Viben/main/scripts/install.sh | bash
```

The script automatically:

1. Detects your platform (macOS or Linux).
2. Checks for Node.js 20+ and installs it if missing.
3. Installs `@viben/kernel` globally via npm.
4. Launches the setup wizard.

No prior setup required — the script handles everything.

## Install via npm

If you prefer to manage Node.js yourself, install Viben directly from npm:

```bash
npm install -g @viben/kernel
```

### Verify the installation

```bash
viben --version
```

This prints the installed version (e.g., `2026.401.1`) and exits. If the command is not found, ensure your npm global bin directory is on `PATH`.

## First Run and Setup Wizard

The first time you run `viben` (bare command, no arguments), the CLI detects that no instance exists and launches the interactive setup wizard automatically.

The wizard walks you through:

1. **Channel selection** — Telegram, Discord, or both.
2. **Bot credentials** — Token and chat/guild ID, validated live against the platform API.
3. **Agent selection** — Which ACP-compatible agent binary to use (e.g., `claude-agent-acp`).
4. **Run mode** — Foreground (interactive) or daemon (background process with optional autostart on boot).

After completing the wizard, an instance is created at `~/viben-workspace/.viben/` and the server starts.

To re-run the wizard at any time:

```bash
viben onboard
```

## Data Directory

Viben separates shared data (used across all instances) from per-instance state.

**Shared store** — lives at `~/.viben/` and is never an instance itself:

```
~/.viben/
  instances.json    — Registry of all known instances (id → workspace path)
  bin/              — Shared CLI tools (jq, cloudflared, etc.)
  agents/           — Shared agent binaries (claude, codex, etc.)
  cache/
    registry-cache.json  — ACP Registry cache (24 h TTL)
```

**Instance** — lives at `<workspace>/.viben/` (default: `~/viben-workspace/.viben/`):

```
<workspace>/.viben/
  config.json       — Instance configuration
  api-secret        — Bearer token for the local REST API (auto-generated, mode 0600)
  api.port          — Port file written by the running daemon
  viben.pid       — PID file for the daemon process
  running           — Marker file: daemon was running before last shutdown (used for autostart)
  sessions.json     — Session records
  agents.json       — Installed agent definitions for this instance
  plugins.json      — Plugin registry
  plugins/          — Installed plugin packages and per-plugin settings
  logs/             — Application and session logs
    viben.log     — Main log (rotated)
    sessions/       — Per-session log files
  history/          — Conversation history per session
  files/            — User-uploaded files
  cache/            — Instance-specific cache
  tunnels.json      — Tunnel configuration
```

You can override the config path with the `VIBEN_CONFIG_PATH` environment variable.

## Running from Source

If you want to hack on Viben or run an unreleased version:

```bash
git clone https://github.com/LinXueyuanStdio/viben.git
cd Viben
pnpm install
pnpm build          # TypeScript compile → dist/
pnpm start          # node dist/cli.js
```

For watch mode during development:

```bash
pnpm dev            # tsc --watch
```

The source build uses the same instance directories as the published package, so you can switch between them freely.
