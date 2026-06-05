# Viben Startup UX Improvements

## Problem

Running `viben` when a daemon is already running shows `Already running (PID 91753)` and exits with code 1. No useful information, no options. Users can't easily:
- See what instance/config is active
- Switch between foreground/background mode
- Know which instance (global vs local) resolved

## Changes

### 1. Rich status + interactive menu when daemon already running

When `startDaemon()` returns "already running" error, instead of printing it and exiting, show a rich status panel and interactive menu.

**TTY mode** (interactive terminal):
```
Viben is already running

  PID:       91753
  Instance:  ~/.viben (global)
  Mode:      daemon
  Channels:  telegram, discord
  API:       port 3000

  [r] Restart          [f] Restart in foreground
  [s] Stop             [l] View logs
  [q] Quit

>
```

User presses a single key (no Enter needed), action executes immediately.

**Non-TTY mode** (pipe, CI, script):
```
Viben is already running (PID 91753)

  Instance:  ~/.viben (global)
  Mode:      daemon
  Channels:  telegram, discord
  API:       port 3000

  Use: viben restart | viben stop | viben logs
```

Exits with code 0 (not an error — it's informational).

### 2. Instance clarity on startup

Every start/restart command prints which instance it resolved to:

```
Instance: ~/.viben (global)
Viben daemon started (PID 91753)
```

When a local `.viben` exists in cwd but global is being used (because no `--local` flag), show a hint:

```
Instance: ~/.viben (global)
  hint: local instance found at ./.viben — use --local to use it
Viben daemon started (PID 91753)
```

Conversely, when local auto-detected:
```
Instance: ./project/.viben (local)
Viben daemon started (PID 91753)
```

### 3. `viben attach` command

New command that shows status then tails logs — a single command to "connect" to a running daemon:

```
viben attach
```

Output:
```
Viben is running (PID 91753)
  Instance:  ~/.viben (global)
  Channels:  telegram, discord

--- logs (Ctrl+C to detach) ---
[2026-03-31 10:00:00] Session created: user123
[2026-03-31 10:00:01] Agent prompt received...
```

If not running, prints "Viben is not running." and exits with code 1.

Respects instance flags: `viben --local attach`, `viben --dir /path attach`.

### 4. Smart default (`viben` with no args)

Current flow:
```
no config → setup wizard
config exists, daemon mode → start daemon (error if running)
config exists, foreground mode → start foreground
```

New flow:
```
no config → setup wizard
daemon already running → rich status + interactive menu (change #1)
config exists, daemon mode → start daemon
config exists, foreground mode → start foreground
```

The key change: check if daemon is running BEFORE trying to start, and show the rich status panel instead of an error.

### 5. Restart with mode flags

`viben restart` gains `--foreground` and `--daemon` flags:

```
viben restart --foreground    # stop daemon, start in foreground
viben restart --daemon        # stop (fg or daemon), start as daemon
```

Without flags, restarts in same mode as currently configured.

When `--foreground` is used, the restart command stops the daemon then starts the server in foreground mode (attached to terminal). This is equivalent to `viben stop && viben --foreground` but in one command.

## Implementation scope

### Files to modify
- `src/cli/commands/default.ts` — smart default flow, instance hints
- `src/cli/daemon.ts` — extract rich status display logic
- `src/cli/commands/start.ts` — instance clarity hints
- `src/cli/commands/restart.ts` — add `--foreground` / `--daemon` flags
- `src/cli/commands/status.ts` — reuse `readInstanceInfo` for rich display
- `src/cli/commands/help.ts` — add `attach` command, document new flags

### Files to create
- `src/cli/commands/attach.ts` — new attach command
- `src/cli/instance-hint.ts` — shared instance clarity logic (print which instance, local hint)
- `src/cli/interactive-menu.ts` — TTY keypress menu utility

### Files to update for routing
- `src/cli.ts` — route `attach` command, pass instance info

## Edge cases

1. **PID file exists but process dead** — already handled by `isProcessRunning()` which cleans stale PID files. Menu won't show; normal start proceeds.
2. **Foreground process running (no PID file)** — no PID file means `isProcessRunning` returns false. Can't detect. This is existing behavior and acceptable — foreground mode ties to the terminal.
3. **Multiple instances** — each command respects `--local`/`--global`/`--dir` flags. The hint system only compares cwd local vs global, not all registered instances.
4. **Non-TTY + interactive menu** — falls back to info-only display with command suggestions.
5. **`viben start` when already running** — keeps current behavior (error), but with richer info. The interactive menu only applies to the bare `viben` command.
6. **`viben restart --foreground` in non-TTY** — works fine, foreground process writes to stdout/stderr which may be redirected.

## Non-goals

- No changes to the setup wizard flow
- No changes to auto-start/LaunchAgent/systemd behavior
- No changes to `viben stop` behavior
- No new config fields
