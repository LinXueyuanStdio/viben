# Enhanced CLI Onboarding v2 — Design Spec

## Overview

Full overhaul of the CLI onboarding and startup experience. Three changes:
1. Replace `@inquirer/prompts` with `@clack/prompts` across the entire CLI
2. Add `viben onboard` command for re-running setup without data loss
3. Clean up startup logs to show a concise progress summary instead of verbose log lines

## 1. Migrate to @clack/prompts

### Why

`@clack/prompts` provides a connected pipeline UI with visual flow between steps:

```
◇  Which platform?
│  Telegram
│
◆  Bot token validated ✓
│
◇  Group detected: Liam & claudeACP
│
●  Installing agents...
│
└  Setup complete!
```

vs `@inquirer/prompts` which is plain question/answer with no visual connection.

### Migration Map

| @inquirer/prompts | @clack/prompts | Notes |
|-------------------|----------------|-------|
| `input()` | `text()` | Same API shape |
| `select()` | `select()` | Options use `{ label, value }` instead of `{ name, value }` |
| `checkbox()` | `multiselect()` | Same concept |
| `confirm()` | `confirm()` | Same API |
| (none) | `intro()` / `outro()` | Bookend the wizard |
| (none) | `spinner()` | Built-in spinner with `│` flow |
| (none) | `note()` | Info boxes |
| (none) | `isCancel()` | Ctrl+C detection |

### Files to Migrate

| File | Functions using @inquirer | Effort |
|------|--------------------------|--------|
| `src/core/setup.ts` | input, select, checkbox, confirm | Large — full wizard |
| `src/core/config-editor.ts` | select, input | Large — all editor menus |
| `src/cli/commands.ts` | confirm (2 places) | Small |
| `src/cli/version.ts` | confirm (1 place) | Small |

### Cancellation Handling

`@clack/prompts` returns a symbol when user presses Ctrl+C. Every prompt call must check:

```typescript
const value = await text({ message: '...' })
if (isCancel(value)) {
  cancel('Setup cancelled.')
  process.exit(0)
}
```

### Spinner Integration

Replace manual console.log for async operations with `spinner()`:

```typescript
const s = spinner()
s.start('Validating bot token...')
const result = await validateBotToken(token)
s.stop(result.ok ? 'Connected to @botname' : 'Token invalid')
```

Used for: bot token validation, chat detection, agent install, cloudflared download, tunnel start.

## 2. `viben onboard` Command

### Behavior

- Re-runs the full setup wizard
- **Does NOT delete data** — sessions, logs, agents, plugins preserved
- Overwrites `~/.viben/config.json` with new values
- Pre-fills current config values as defaults (enter to keep)
- Works whether daemon is running or not (stops daemon first if needed)
- Replaces `viben reset` as the recommended way to reconfigure

### CLI Registration

```typescript
// src/cli.ts
'onboard': () => cmdOnboard(),

// src/cli/commands.ts
export async function cmdOnboard(): Promise<void> {
  // Stop daemon if running
  // Load existing config as defaults
  // Run setup wizard with pre-filled values
  // Save new config
  // Offer to start
}
```

### Help Text

```
viben onboard    Re-run setup wizard (keeps data, overwrites config)
viben reset      Delete all data and start fresh
```

### Setup Wizard Changes for Onboard Mode

When running in onboard mode, each prompt shows the current value as default:

```
◇  Bot token (from @BotFather):
│  Current: 8756••••••3kA
│  > [enter to keep]
```

`runSetup()` accepts an optional `defaults?: Partial<Config>` parameter.

## 3. Startup Log Cleanup

### Current Problem

15+ INFO lines on every startup. Users don't need to see session counts, agent capabilities, module internals.

### New Startup Output (Foreground TTY)

```
   ██████╗ ██████╗ ███████╗███╗   ██╗ █████╗  ██████╗██████╗
  ██╔═══██╗██╔══██╗██╔════╝████╗  ██║██╔══██╗██╔════╝██╔══██╗
  ██║   ██║██████╔╝█████╗  ██╔██╗ ██║███████║██║     ██████╔╝
  ██║   ██║██╔═══╝ ██╔══╝  ██║╚██╗██║██╔══██║██║     ██╔═══╝
  ╚██████╔╝██║     ███████╗██║ ╚████║██║  ██║╚██████╗██║
   ╚═════╝ ╚═╝     ╚══════╝╚═╝  ╚═══╝╚═╝  ╚═╝ ╚═════╝╚═╝

              AI coding agents, anywhere.  v0.6.2

  ✓ Config loaded
  ✓ Dependencies checked
  ✓ Tunnel ready → https://xxx.trycloudflare.com
  ✓ Telegram connected
  ✓ Assistant ready
  ✓ API server on port 21420

  Viben is running. Press Ctrl+C to stop.
```

### Log Level Changes

| Current log | Current level | New level | Reason |
|-------------|---------------|-----------|--------|
| Config loaded | info | **debug** | Shown in startup summary instead |
| Loaded session records | info | debug | Internal detail |
| Loaded usage records | info | debug | Internal detail |
| Tunnel HTTP server started | info | debug | Part of tunnel startup |
| Cloudflare tunnel ready | info | debug | Shown in startup summary |
| Tunnel active (registry) | info | debug | Internal detail |
| Restoring tunnels | info | debug | Internal detail |
| Tunnel started | info | debug | Shown in startup summary |
| Adapter registered | info | debug | Shown in startup summary |
| Spawning assistant | info | debug | Internal detail |
| Creating assistant session | info | debug | Internal detail |
| Agent prompt capabilities | info | debug | Internal detail |
| Agent spawn complete | info | debug | Internal detail |
| Session created | info | debug | Internal detail |
| Session created via pipeline | info | debug | Internal detail |
| Assistant agent spawned | info | debug | Internal detail |
| Assistant session ready | info | debug | Internal detail |
| API server listening | info | debug | Shown in startup summary |
| Viben started | info | **keep** | Final ready message |

### Implementation

Add a startup summary function in `main.ts` that prints the concise status after all components are initialized:

```typescript
function printStartupSummary(config: Config, tunnelUrl?: string) {
  if (!process.stdout.isTTY || config.runMode === 'daemon') return
  const ok = (msg: string) => console.log(`  \x1b[32m✓\x1b[0m ${msg}`)
  ok('Config loaded')
  ok('Dependencies checked')
  if (tunnelUrl) ok(`Tunnel ready → ${tunnelUrl}`)
  // ... adapters
  console.log('\n  Viben is running. Press Ctrl+C to stop.\n')
}
```

### Daemon Mode / Non-TTY

No visual output. All logs go through Pino to log file as before. Only behavior change is log levels (debug instead of info for internal details).

## Files

| File | Change | Effort |
|------|--------|--------|
| `src/core/setup.ts` | Migrate to @clack/prompts, accept defaults param, export for onboard | Large |
| `src/core/config-editor.ts` | Migrate to @clack/prompts | Large |
| `src/cli.ts` | Register `onboard` command | Small |
| `src/cli/commands.ts` | Add cmdOnboard, migrate confirm calls | Medium |
| `src/cli/version.ts` | Migrate confirm call | Small |
| `src/main.ts` | Startup summary, reduce log levels | Medium |
| `src/core/session-store.ts` | Reduce log level | Small |
| `src/core/agent-instance.ts` | Reduce log level | Small |
| `src/tunnel/tunnel-service.ts` | Reduce log level | Small |
| `src/tunnel/tunnel-registry.ts` | Reduce log level | Small |
| `src/adapters/telegram/adapter.ts` | Reduce log level | Small |
| `src/adapters/telegram/assistant.ts` | Reduce log level | Small |
| `package.json` | Add @clack/prompts, remove @inquirer/prompts | Small |

## Dependencies

| Action | Package |
|--------|---------|
| Add | `@clack/prompts` |
| Remove | `@inquirer/prompts` |

## Backward Compatibility

- `viben reset` still works (destructive, as before)
- `viben onboard` is new — non-destructive reconfigure
- `viben config` still works (interactive editor, unchanged UX after migration)
- Log content unchanged in debug mode — only default level changes
- Config file format unchanged
