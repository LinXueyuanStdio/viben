# Daemon Mode

## Foreground vs Daemon

Viben can run in two modes, controlled by the `runMode` config field.

**Foreground** (`runMode: "foreground"`) — The process stays attached to your terminal. Log output is printed to stdout. The process exits when you close the terminal or press Ctrl+C. Use this during initial setup, debugging, or when you want to watch logs in real time.

**Daemon** (`runMode: "daemon"`) — The process detaches from the terminal and runs in the background. Output is written to a log file. The process survives terminal closure. This is the recommended mode for production self-hosting.

## Commands

All daemon commands use the `viben` CLI:

```bash
viben start       # Start (foreground or daemon depending on runMode config)
viben stop        # Send SIGTERM to the daemon, wait up to 5 s, then SIGKILL
viben status      # Print running/stopped and PID if running
viben logs        # Tail the daemon log file
viben restart     # stop + start
viben attach      # Connect to running daemon: show status + tail logs
```

### `viben start`

When `runMode` is `daemon`, this spawns a detached child process (`--daemon-child` flag) and returns immediately. The child writes its PID to the PID file and begins accepting messages.

When `runMode` is `foreground`, this runs the server in the current process.

### `viben stop`

Reads the PID file and sends `SIGTERM`. Polls every 100 ms for up to 5 seconds waiting for the process to exit. If the process does not exit within 5 seconds, `SIGKILL` is sent. The PID file is removed after a successful stop.

Calling `stop` also removes the running marker file (`<instance-root>/running`), which suppresses autostart on the next boot.

### `viben restart`

Equivalent to `stop` followed by `start`. If no daemon is running, it skips the stop step and starts a new one. Useful after updating Viben to pick up the new version without manually stopping first.

### `viben status`

Checks whether the PID in the PID file is alive (using `kill -0`). Cleans up stale PID files automatically.

### `viben logs`

Tails `<instance-root>/logs/viben.log`. In daemon mode this is where all server output goes.

### `viben attach`

Connects to a running daemon and shows a rich status display (uptime, active sessions, adapters, tunnel status) followed by live log tailing. Press Ctrl+C to detach without affecting the daemon.

Useful when you want to monitor a daemon that was started earlier or by autostart, without managing it as a foreground process.

## Smart startup

When you run `viben` (no arguments) and a daemon is already running, instead of printing an error, Viben shows a rich status display with an interactive menu:

| Key | Action |
|-----|--------|
| `r` | Restart the daemon |
| `f` | Restart in foreground mode |
| `s` | Show full status details |
| `l` | Tail the log file |
| `q` | Quit |

The display shows which instance is active and its directory path.

You can force a specific mode on startup:

```bash
viben start --foreground    # force foreground regardless of config
viben start --daemon        # force daemon regardless of config
```

## File Locations

All runtime files live inside the instance root (`<workspace>/.viben/`):

| File | Path | Purpose |
|---|---|---|
| PID file | `<instance-root>/viben.pid` | Process ID of the running daemon |
| Log file | `<instance-root>/logs/viben.log` | Daemon stdout/stderr and application logs |
| Running marker | `<instance-root>/running` | Written on start, removed on stop; used to decide whether to autostart on boot |
| Port file | `<instance-root>/api.port` | Current API port (written by the server on startup) |

## Autostart on Boot

Viben can register itself to start automatically when you log in. This is configured separately per platform.

### macOS — LaunchAgent

On macOS, autostart uses a user-level `launchd` plist:

```
~/Library/LaunchAgents/com.viben.daemon.plist
```

When autostart is enabled, the plist is written and loaded with `launchctl load`. The daemon is configured with `RunAtLoad: true` and `KeepAlive` set to restart on non-zero exit. Log output goes to `<instance-root>/logs/viben.log`.

To enable autostart from the CLI:

```bash
viben config     # → Run Mode → Enable auto-start
```

Or via onboard:

```bash
viben onboard    # → Run Mode → switch to daemon mode (enables autostart automatically)
```

To remove the LaunchAgent:

```bash
viben config     # → Run Mode → Disable auto-start
```

This runs `launchctl unload` and deletes the plist file.

### Linux — systemd User Service

On Linux, autostart uses a systemd user service:

```
~/.config/systemd/user/viben.service
```

When autostart is enabled, the unit file is written and enabled with `systemctl --user enable viben`. The service uses `Restart=on-failure`.

To enable or disable, use the same `viben config` or `viben onboard` flow as on macOS.

### Windows

Autostart is not supported natively on Windows. Use WSL2 and follow the Linux instructions, or configure a Windows Task Scheduler entry manually pointing to the WSL binary.

## When to Use Each Mode

| Scenario | Recommended mode |
|---|---|
| First-time setup | Foreground — watch the logs live |
| Debugging a problem | Foreground with `VIBEN_DEBUG=true` |
| Persistent personal server | Daemon with autostart enabled |
| CI / container | Foreground (process managed by container runtime) |
| Server with uptime requirements | Daemon + systemd (Linux) or LaunchAgent (macOS) |
