# CLI Commands

All commands are invoked as `viben <command> [subcommand] [options]`. Every command accepts `-h` / `--help` for inline help.

---

## JSON Output

Many commands accept a `--json` flag for machine-readable output. When `--json` is passed:

- Output is a single line of valid JSON on stdout
- Exit code `0` for success, non-zero for errors
- All progress indicators and ANSI codes are suppressed

**Success envelope (exit 0):**
```json
{ "success": true, "data": { ... } }
```

**Error envelope (exit non-zero):**
```json
{ "success": false, "error": { "code": "ERROR_CODE", "message": "Human-readable description" } }
```

Commands that support `--json` are noted in their options tables below.

---

## adopt

Transfers an existing external agent session into Viben so it appears as a messaging thread. Requires a running daemon.

**Usage**
```
viben adopt <agent> <session_id> [--cwd <path>] [--channel <name>]
```

**Options**

| Flag | Description |
|---|---|
| `--cwd <path>` | Working directory for the session (default: current directory) |
| `--channel <name>` | Target channel adapter, e.g. `telegram`, `discord` (default: first registered) |
| `--json` | Output result as JSON |

**Examples**
```bash
viben adopt claude abc123-def456
viben adopt claude abc123 --cwd /path/to/project
viben adopt claude abc123 --channel discord
viben adopt claude abc123 --json
```

**JSON output** (`data` shape):
```json
{ "sessionId": "...", "threadId": "...", "agent": "claude", "status": "active" }
```

---

## attach

Connects to a running daemon and displays live status with log tailing. Useful for monitoring a daemon instance without opening a separate terminal.

**Usage**
```
viben attach
```

Shows the daemon's current status (uptime, sessions, adapters, tunnel) and tails the log file. Press Ctrl+C to detach.

---

## agents

Browse and manage AI coding agents from the ACP Registry.

**Usage**
```
viben agents [subcommand]
```

### agents (no subcommand)

Lists all installed agents and agents available to install from the registry.

**Example**
```bash
viben agents
viben agents --json
```

**JSON output** (`data` shape):
```json
{ "agents": [{ "key": "claude", "name": "Claude Code", "version": "1.0.0", "distribution": "npm", "description": "...", "installed": true, "available": true, "missingDeps": [] }] }
```

### agents install

Installs an agent from the ACP Registry. Automatically installs the handoff integration if the agent supports it.

```
viben agents install <name> [--force] [--json]
```

| Flag | Description |
|---|---|
| `--force` | Reinstall even if already installed |
| `--json` | Output result as JSON |

```bash
viben agents install claude
viben agents install gemini --force
viben agents install claude --json
```

**JSON output** (`data` shape):
```json
{ "key": "claude", "version": "1.0.0", "installed": true }
```

### agents uninstall

Removes an installed agent and its handoff integration (if any).

```
viben agents uninstall <name> [--json]
```

| Flag | Description |
|---|---|
| `--json` | Output result as JSON |

```bash
viben agents uninstall gemini
viben agents uninstall gemini --json
```

**JSON output** (`data` shape):
```json
{ "key": "gemini", "uninstalled": true }
```

### agents info

Shows version, distribution type, command, setup steps, and installation status for an agent.

```
viben agents info <name> [--json]
```

| Flag | Description |
|---|---|
| `--json` | Output result as JSON |

```bash
viben agents info cursor
viben agents info claude
viben agents info claude --json
```

**JSON output** (`data` shape):
```json
{ "key": "claude", "name": "Claude Code", "version": "1.0.0", "distribution": "npm", "description": "...", "installed": true, "binaryPath": "/usr/local/bin/claude", "command": "claude", "registryId": "claude" }
```

### agents run

Runs the agent's CLI directly (useful for first-run login and configuration). ACP-specific flags are automatically stripped before passing arguments.

```
viben agents run <name> [-- <args>]
```

Use `--` to separate Viben flags from agent-specific arguments.

```bash
viben agents run gemini          # Login to Google (first run)
viben agents run copilot         # Login to GitHub Copilot
viben agents run cline           # Configure API keys
```

### agents refresh

Force-refreshes the agent catalog from the ACP Registry, bypassing the normal staleness check.

```
viben agents refresh
```

---

## api

Interacts with a running Viben daemon over the local REST API. Requires a running daemon (`viben start`).

All `api` subcommands support `--json` for machine-readable output.

**Usage**
```
viben api <subcommand> [args] [--json]
```

### api cancel

Cancels a session.

```
viben api cancel <session-id>
```

### api cleanup

Deletes finished topics from channel adapters.

```
viben api cleanup [--status <statuses>]
```

`--status` accepts a comma-separated list (e.g. `finished,error`). Defaults to finished topics.

### api config

Shows or updates runtime config. Prefer `viben config` for general use — it works whether the daemon is running or not.

```
viben api config
viben api config set <key> <value>
```

### api bypass

Enables or disables bypass permissions for a session. When enabled, the agent runs destructive commands without confirmation prompts.

```
viben api bypass <session-id> on|off
```

### api delete-topic

Deletes a topic for a given session ID.

```
viben api delete-topic <session-id> [--force]
```

`--force` deletes even if the session is currently active.

### api health

Shows system health: status, uptime, version, memory, session counts, adapters, and tunnel status.

```
viben api health
```

### api new

Creates a new session.

```
viben api new [agent] [workspace]
viben api new [agent] --workspace <path>
```

Both `agent` and `workspace` are optional. Uses `defaultAgent` from config if omitted. `workspace` defaults to the current working directory.

```bash
viben api new
viben api new claude /path/to/project
viben api new gemini --workspace /path/to/project
```

### api notify

Sends a notification message to all registered channel adapters.

```
viben api notify <message>
```

All remaining arguments are joined into the message.

```bash
viben api notify "Deployment complete"
```

### api restart

Sends a restart signal to the running daemon.

```
viben api restart
```

### api send

Sends a prompt to a session. The prompt is enqueued; responses arrive asynchronously via the channel adapter.

```
viben api send <session-id> <prompt>
```

All arguments after `<session-id>` are joined as the prompt.

```bash
viben api send abc123 "Fix the login bug"
viben api send abc123 refactor the auth module
```

### api session

Shows detailed information about one session.

```
viben api session <session-id>
```

### api status

Lists all active sessions with ID, agent, status, and name.

```
viben api status
```

### api topics

Lists topics across all channel adapters.

```
viben api topics [--status <statuses>]
```

`--status` accepts a comma-separated filter (e.g. `active,finished`).

### api tunnel

Shows tunnel status (provider, URL).

```
viben api tunnel
```

### api version

Shows the version of the currently running daemon.

```
viben api version
```

---

## dev

Runs Viben with a local plugin loaded in development mode. Compiles TypeScript automatically, starts `tsc --watch` for hot-reload, and boots the server with the plugin.

**Usage**
```
viben dev <plugin-path> [options]
```

**Options**

| Flag | Description |
|---|---|
| `--no-watch` | Disable file watching (no hot-reload) |
| `--verbose` | Enable verbose logging |

**Examples**
```bash
viben dev ./my-plugin
viben dev ../adapter-matrix --no-watch
viben dev ./my-plugin --verbose
```

See [Dev Mode](../extending/dev-mode.md) for the full guide.

---

## config

Views and edits configuration. Works with both a running and a stopped daemon.

**Usage**
```
viben config
viben config set <key> <value>
```

`viben config` (no args) opens an interactive terminal editor. When the daemon is running, changes are applied live via the API; otherwise the config file is edited directly.

`viben config set` applies a single value by dot-notation path. Values are JSON-parsed if possible, otherwise treated as strings. Supports `--json` for scripted use.

```bash
viben config set defaultAgent claude
viben config set security.maxConcurrentSessions 5
viben config set channels.telegram.botToken "123:ABC"
viben config set defaultAgent gemini --json
```

**JSON output for `config set`** (`data` shape):
```json
{ "path": "defaultAgent", "value": "gemini", "needsRestart": false }
```

---

## doctor

Runs system diagnostics. Checks config validity, agent availability, dependencies, and connectivity. Fixable issues can be auto-repaired interactively.

**Usage**
```
viben doctor [--dry-run] [--json]
```

| Flag | Description |
|---|---|
| `--dry-run` | Report issues only; do not apply any fixes |
| `--json` | Output result as JSON (implies `--dry-run`; always exits 0 — check `summary.failed` for health) |

**JSON output** (`data` shape):
```json
{
  "categories": [{ "name": "Config", "results": [{ "status": "pass", "message": "Config is valid" }] }],
  "summary": { "passed": 5, "warnings": 1, "failed": 0 }
}
```

---

## install

Installs a plugin from npm into `<instance-root>/plugins/`. Supports built-in plugins, community npm packages, and pinning a specific version with `@version` syntax.

**Usage**
```
viben install <package>[@version] [--json]
```

| Flag | Description |
|---|---|
| `--json` | Output result as JSON |

```bash
viben install @viben/adapter-discord
viben install @myorg/translator@1.2.0
viben install @viben/adapter-discord --json
```

**JSON output** (`data` shape):
```json
{ "plugin": "@viben/adapter-discord", "version": "1.0.0", "installed": true }
```

This is an alias for `viben plugin add`. See [plugin install](#plugin-install) for details.

---

## integrate

Manages agent integrations that enable features like session handoff from an agent to Viben.

**Usage**
```
viben integrate <agent>
viben integrate <agent> --uninstall
```

```bash
viben integrate claude
viben integrate claude --uninstall
viben integrate opencode
```

---

## logs

Tails the daemon log file (last 50 lines, then follows new output). Equivalent to `tail -f`. Press Ctrl+C to stop.

**Usage**
```
viben logs
```

Log directory is configured via `logging.logDir` (default: `<instance-root>/logs/`).

---

## onboard

Runs the first-run setup wizard if no config exists. If config already exists, runs the reconfiguration wizard, which allows modifying or disabling individual channels, agents, workspace settings, run mode, and integrations. Individual sections (e.g. a specific channel) can be modified, disabled, or deleted without affecting the rest of the config.

**Usage**
```
viben onboard
```

---

## plugin create

Scaffolds a new Viben plugin project with all boilerplate: TypeScript config, test setup, lifecycle hooks, and package.json.

**Usage**
```
viben plugin create
```

Runs an interactive wizard that prompts for:
- Plugin name (npm package name, e.g. `@myorg/my-plugin`)
- Description
- Author
- License

Creates a directory with `src/index.ts`, `src/__tests__/index.test.ts`, `package.json`, `tsconfig.json`, `CLAUDE.md` (AI agent context), `PLUGIN_GUIDE.md` (developer guide), and config files.

**Example**
```bash
viben plugin create
# Follow prompts, then:
cd my-plugin
npm install
npm run build
npm test
```

See [Getting Started: Your First Plugin](../extending/getting-started-plugin.md) for a full walkthrough.

---

## plugin install

Installs a plugin package. Works with both built-in plugins and community plugins published to npm. Supports `@version` syntax to pin a specific version. After npm install, checks the plugin's `engines.viben` field and warns if the installed CLI version is older than the minimum required.

**Usage**
```
viben plugin add <package>[@version] [--json]
viben plugin install <package>[@version] [--json]
```

| Flag | Description |
|---|---|
| `--json` | Output result as JSON |

**Examples**
```bash
viben plugin add @viben/adapter-discord
viben plugin add @myorg/translator@1.2.0
viben plugin install my-plugin
viben plugin add @viben/adapter-discord --json
```

**JSON output** (`data` shape):
```json
{ "plugin": "@viben/adapter-discord", "version": "1.0.0", "installed": true }
```

Community plugins are installed via `npm install` into `<instance-root>/plugins/node_modules/`. The plugin's `install()` hook is called if defined.

---

## plugin configure

Runs the configuration flow for an installed plugin. Calls the plugin's `configure()` hook, which typically presents interactive prompts to update settings.

**Usage**
```
viben plugin configure <name>
```

**Example**
```bash
viben plugin configure @myorg/translator
```

---

## plugin enable / disable

Enables or disables an installed plugin without removing it. Disabled plugins are skipped during server startup.

**Usage**
```
viben plugin enable <name> [--json]
viben plugin disable <name> [--json]
```

| Flag | Description |
|---|---|
| `--json` | Output result as JSON |

**Examples**
```bash
viben plugin disable @myorg/translator
viben plugin enable @myorg/translator
viben plugin enable @myorg/translator --json
```

**JSON output** (`data` shape):
```json
{ "plugin": "@myorg/translator", "enabled": true }
```

---

## remote

Generates access links for connecting app clients to a running Viben instance. Displays local URL, tunnel URL (if enabled), app deep link, and a QR code.

**Usage**
```
viben remote [--json]
```

| Flag | Description |
|---|---|
| `--json` | Output result as JSON (no QR code printed) |

The generated link includes a single-use access code valid for 30 minutes. The app exchanges this code for a JWT token on first use.

**Example output**
```
Local:   http://127.0.0.1:21420
Tunnel:  https://abc.trycloudflare.com
App:     viben://connect?host=abc.trycloudflare.com&code=xyz123

[QR code]
```

**JSON output** (`data` shape):
```json
{ "code": "xyz123", "name": "my-instance", "role": "owner", "expiresAt": "2026-04-02T13:00:00Z", "urls": { "local": "http://127.0.0.1:21420", "tunnel": "https://abc.trycloudflare.com", "app": "viben://connect?host=abc.trycloudflare.com&code=xyz123" } }
```

See [App Connectivity](../features/app-connectivity.md) for the full guide.

---

## plugins

Lists all plugins installed in the current instance's `plugins/` directory.

**Usage**
```
viben plugins [--json]
```

| Flag | Description |
|---|---|
| `--json` | Output result as JSON |

**JSON output** (`data` shape):
```json
{ "plugins": [{ "name": "@viben/adapter-discord", "version": "1.0.0", "enabled": true, "source": "npm", "description": "Discord adapter" }] }
```

---

## reset

Deletes the current instance data and allows starting fresh. This is destructive — config, plugins, and session data for the instance are removed. The daemon must be stopped first.

**Usage**
```
viben reset
```

Prompts for confirmation before proceeding.

---

## restart

Restarts the daemon. By default uses the same run mode as configured; use `--foreground` or `--daemon` to override.

**Usage**
```
viben restart [--foreground | --daemon] [--json]
```

| Flag | Description |
|---|---|
| `--foreground` | Restart in foreground mode (not compatible with `--json`) |
| `--daemon` | Restart as background daemon |
| `--json` | Output result as JSON (always uses daemon mode) |

```bash
viben restart
viben restart --daemon --json
```

**JSON output** (`data` shape):
```json
{ "pid": 12345, "instanceId": "my-instance", "dir": "/Users/alice/viben-workspace/.viben" }
```

---

## setup

Writes a minimal `config.json` to an instance root. Used for non-interactive setup (e.g., scripted deployments and the desktop app onboarding flow).

**Usage**
```
viben setup --agent <name> [--dir <path>] [--run-mode daemon|foreground] [--json]
```

**Options**

| Flag | Description |
|---|---|
| `--agent <name>` | Required. Agent name(s) to configure. Comma-separated for multiple. |
| `--dir <path>` | Workspace directory. Defaults to auto-detected or current directory. |
| `--run-mode` | `daemon` (default) or `foreground`. |
| `--json` | Output result as JSON. |

**Examples**
```bash
viben setup --agent claude
viben setup --agent claude --dir ~/my-project --run-mode daemon
viben setup --agent claude --dir ~/my-project --json
```

**JSON output** (`data` shape):
```json
{ "configPath": "/Users/alice/my-project/.viben/config.json" }
```

---

## instances

Manages registered Viben instances in the shared instance registry (`~/.viben/instances.json`).

**Usage**
```
viben instances [subcommand] [options]
```

### instances list

Lists all instances registered in the global registry with their ID, name, directory, and running status.

```
viben instances list [--json]
```

```bash
viben instances list
viben instances list --json
```

**JSON output** (`data` shape):
```json
[{ "id": "main", "name": "my-instance", "directory": "/Users/alice/viben-workspace", "root": "/Users/alice/viben-workspace/.viben", "status": "running", "port": 21420 }]
```

### instances create

Creates or registers an instance at the specified workspace directory.

- If `<workspace>/.viben/` already exists but is not registered, it is registered.
- Otherwise a new instance root is created with a minimal config.

```
viben instances create --dir <path> [--from <source>] [--name <id>] [--agent <name>] [--no-interactive] [--json]
```

| Flag | Description |
|---|---|
| `--dir <path>` | Required. Workspace directory for the instance. |
| `--from <path>` | Copy config from an existing instance workspace. |
| `--name <id>` | Instance ID to register under. |
| `--agent <name>` | Default agent name (used in non-interactive mode). |
| `--no-interactive` | Skip interactive prompts; write a minimal config immediately. |
| `--json` | Output result as JSON. |

```bash
viben instances create --dir ~/work-project
viben instances create --dir ~/work-project --from ~/viben-workspace
viben instances create --dir ~/work-project --agent claude --no-interactive --json
```

**JSON output** (`data` shape):
```json
{ "id": "work", "name": "work-project", "directory": "/Users/alice/work-project", "root": "/Users/alice/work-project/.viben", "status": "stopped", "port": null }
```

---

## start

Starts Viben as a background daemon. Requires an existing instance config — run `viben` first to set up, or use `viben setup` for non-interactive setup.

**Usage**
```
viben start [--local | --dir <path>] [--json]
```

**Options**

| Flag | Description |
|---|---|
| `--local` | Use `.viben/` instance in the current directory. |
| `--dir <path>` | Use a specific workspace directory. |
| `--json` | Output result as JSON. |

**JSON output** (`data` shape):
```json
{ "pid": 12345, "instanceId": "main", "name": "my-instance", "directory": "/Users/alice/viben-workspace", "dir": "/Users/alice/viben-workspace/.viben", "port": 21420 }
```

---

## status

Shows whether the Viben daemon is running and its PID.

**Usage**
```
viben status [--all] [--id <id>] [--json]
```

| Flag | Description |
|---|---|
| `--all` | Show status of all registered instances, not just the current one |
| `--id <id>` | Show status of a specific instance |
| `--json` | Output result as JSON |

**JSON output** (`data` shape — all instances):
```json
{ "instances": [{ "id": "main", "name": "my-instance", "status": "running", "pid": 12345, "dir": "/Users/alice/viben-workspace/.viben", "mode": "daemon", "channels": ["telegram"], "apiPort": 21420, "tunnelPort": null }] }
```

**JSON output** (`data` shape — single instance with `--id`):
```json
{ "id": "main", "name": "my-instance", "status": "running", "pid": 12345, "dir": "/Users/alice/viben-workspace/.viben", "mode": "daemon", "channels": ["telegram"], "apiPort": 21420, "tunnelPort": null }
```

---

## stop

Sends a stop signal to the running daemon.

**Usage**
```
viben stop [--json]
```

| Flag | Description |
|---|---|
| `--json` | Output result as JSON |

**JSON output** (`data` shape):
```json
{ "stopped": true, "pid": 12345 }
```

---

## tunnel

Manages tunnels to local ports. Requires a running daemon.

**Usage**
```
viben tunnel <subcommand> [args]
```

### tunnel add

Creates a tunnel to a local port.

```
viben tunnel add <port> [--label <name>] [--session <id>] [--json]
```

| Flag | Description |
|---|---|
| `--json` | Output result as JSON |

```bash
viben tunnel add 3000
viben tunnel add 8080 --label "dev server"
viben tunnel add 3000 --json
```

**JSON output** (`data` shape):
```json
{ "port": 3000, "publicUrl": "https://abc.trycloudflare.com" }
```

### tunnel list

Lists all active tunnels with their ports, labels, and public URLs.

```
viben tunnel list [--json]
```

| Flag | Description |
|---|---|
| `--json` | Output result as JSON |

**JSON output** (`data` shape):
```json
{ "tunnels": [{ "port": 3000, "label": "dev server", "publicUrl": "https://abc.trycloudflare.com", "status": "active" }] }
```

### tunnel stop

Stops the tunnel for a specific local port.

```
viben tunnel stop <port> [--json]
```

| Flag | Description |
|---|---|
| `--json` | Output result as JSON |

**JSON output** (`data` shape):
```json
{ "port": 3000, "stopped": true }
```

### tunnel stop-all

Stops all user tunnels.

```
viben tunnel stop-all [--json]
```

| Flag | Description |
|---|---|
| `--json` | Output result as JSON |

**JSON output** (`data` shape):
```json
{ "stopped": true }
```

---

## uninstall

Removes an adapter plugin.

**Usage**
```
viben uninstall <package> [--json]
```

| Flag | Description |
|---|---|
| `--json` | Output result as JSON |

```bash
viben uninstall @viben/adapter-discord
viben uninstall @viben/adapter-discord --json
```

**JSON output** (`data` shape):
```json
{ "plugin": "@viben/adapter-discord", "uninstalled": true }
```

---

## update

Checks npm for the latest version of `@viben/kernel` and installs it if an update is available.

**Usage**
```
viben update
```

---

## (no command / --foreground)

Running `viben` with no arguments starts the server. On first run, the setup wizard launches. After setup, behavior depends on `runMode` in config:

- `foreground` — runs in the current terminal.
- `daemon` — spawns a background process and exits.

If a daemon is already running, `viben` shows a rich status display with an interactive menu instead of an error:

- **r** — restart the daemon
- **f** — restart in foreground mode
- **s** — show full status
- **l** — tail logs
- **q** — quit

The startup display shows which instance is active and its directory path.

`viben --foreground` forces foreground mode regardless of config.

---

## version

Prints the installed version. Also available as `--version` / `-v`.

**Usage**
```
viben version [--json]
viben --version
```

| Flag | Description |
|---|---|
| `--json` | Output result as JSON |

```bash
viben --version
viben version --json
```

**JSON output** (`data` shape):
```json
{ "version": "2026.401.1" }
```

---

## --help / -h

Prints the top-level help message listing all commands.

```bash
viben --help
```
