# Viben Doctor — Design Spec

## Overview

A diagnostic and auto-repair system for Viben, accessible via CLI command (`viben doctor`), Telegram bot command (`/doctor`), and Telegram menu button (🩺 Doctor). It checks all aspects of the system, auto-fixes safe issues, and prompts for confirmation on risky fixes.

## Goals

- Provide a single command to diagnose all system issues
- Auto-fix safe problems (missing dirs, default config fields, stale files)
- Prompt user before risky fixes (corrupt data reset, token changes)
- Work standalone — no dependency on running daemon or active adapters
- Detailed CLI output, compact single-message Telegram output

## Core Data Model

```typescript
// Context passed to all checks — includes resolved paths and raw config
interface DoctorContext {
  config: Config | null       // null if config failed to load
  rawConfig: unknown          // raw parsed JSON (for checks that run before validation)
  configPath: string          // ~/.viben/config.json
  dataDir: string             // ~/.viben/
  sessionsPath: string        // ~/.viben/sessions.json
  pidPath: string             // ~/.viben/viben.pid
  portFilePath: string        // ~/.viben/api.port
  pluginsDir: string          // ~/.viben/plugins/
  logsDir: string             // resolved from config or default
}

interface CheckResult {
  status: 'pass' | 'warn' | 'fail'
  message: string              // Human-readable: "Bot token valid (@MyBot)"
  fixable?: boolean
  fixRisk?: 'safe' | 'risky'  // safe = auto-fix, risky = confirm first
  fix?: () => Promise<FixResult>
}

interface FixResult {
  success: boolean
  message: string              // "Added missing tunnel section with defaults"
}

interface DoctorCheck {
  name: string                 // Category name: "Config", "Telegram", etc.
  order: number                // Execution order — engine sorts ascending before running
  run(ctx: DoctorContext): Promise<CheckResult[]>
}

interface DoctorReport {
  categories: CategoryResult[]
  summary: { passed: number; warnings: number; failed: number; fixed: number }
  pendingFixes: PendingFix[]   // Risky fixes awaiting user confirmation
}

interface CategoryResult {
  name: string
  results: CheckResult[]       // Safe-fixed items have updated message with "→ Fixed" suffix
}

interface PendingFix {
  category: string
  message: string
  fix: () => Promise<FixResult>
}
```

### Fix Application Flow

Safe fixes are applied **inside `DoctorEngine.runAll()`** immediately after each check completes. When a safe fix is applied:
1. The `fix()` function is called
2. On success, the `CheckResult.message` is updated to append " → Fixed (details)"
3. The `CheckResult.status` changes from `'fail'`/`'warn'` to `'warn'` (to indicate it was an issue but is now resolved)
4. The `fix` function is removed from the result (already applied)
5. The `summary.fixed` counter increments

Risky fixes are **not** called by the engine — they are collected into `pendingFixes` for the caller (CLI or Telegram) to present to the user.

## Check Modules

All checks live in `src/core/doctor/checks/`. Each exports a `DoctorCheck`. Each check has a 10-second timeout — if a check hangs (e.g., network call to Telegram API), it returns a `fail` result with timeout message and the engine moves on.

### 1. config.ts (order: 1)
- `~/.viben/config.json` exists and is readable
- JSON parses successfully
- Zod schema validation passes
- Detect & apply pending migrations (safe fix)
- No deprecated/legacy fields

### 2. agents.ts (order: 2)
- Each configured agent's command exists in PATH
- Default agent exists in agents list
- Agent command is executable (spawn quick test)

### 3. telegram.ts (order: 3)
- Bot token format valid (regex pre-check)
- `getMe` API call succeeds — reports bot username
- Chat ID refers to a supergroup with topics enabled
- Bot has admin status in the group
- Uses `fetch` directly (not grammY) for standalone operation
- If bot token is missing/invalid from config, gracefully skips API checks with a `fail` result

### 4. storage.ts (order: 4)
- `~/.viben/` directory exists and is writable (safe fix: create)
- `sessions.json` parses correctly, schema valid (risky fix: reset if corrupt)
- Log directory exists and is writable (safe fix: create)

### 5. workspace.ts (order: 5)
- Base workspace directory exists (safe fix: create)
- Directory is writable

### 6. plugins.ts (order: 6)
- Plugin directory and `package.json` exist (safe fix: init if missing)
- Each installed plugin loads successfully
- Plugin dependencies resolved

### 7. daemon.ts (order: 7)
- No stale PID/port files (safe fix: cleanup)
- No port conflicts on configured API port
- Process running check (if expected)

### 8. tunnel.ts (order: 8)
- Cloudflared binary exists (safe fix: download/install)
- Tunnel config is valid

## Fix Strategy

- **Safe fixes** (`fixRisk: 'safe'`): Applied automatically by the engine during `runAll()`. Result message updated inline with "→ Fixed" suffix. Examples: creating missing directories, adding default config fields, cleaning stale files.
- **Risky fixes** (`fixRisk: 'risky'`): Collected into `pendingFixes` and returned in `DoctorReport`. On CLI: prompt user with readline confirm. On Telegram: show inline button per fix. Examples: resetting corrupt `sessions.json`, reinstalling plugins.

## Entry Points

### CLI: `viben doctor`

Added to both `src/cli.ts` (command record) and `src/cli/commands.ts` (handler implementation). Supports `--dry-run` flag to report issues without applying any fixes. Runs `DoctorEngine.runAll()`, renders detailed output with ANSI colors (reuses existing color utils from `setup.ts`).

```
$ viben doctor

Config
  ✅ Config file exists
  ✅ JSON valid
  ⚠️ Missing 'tunnel' section → Fixed (added defaults)
  ✅ Schema valid

Telegram
  ✅ Bot token valid (@VibenBot)
  ✅ Chat is supergroup with topics
  ❌ Bot is not admin in group
     → Please promote the bot to admin in group settings

Agents
  ✅ claude-agent-acp found
  ⚠️ codex not found in PATH (skipped, not default agent)

...

Result: 12 passed, 2 warnings, 1 failed
```

Exit code: 0 if all pass/warn, 1 if any fail remains unfixed.

### Telegram: `/doctor` command and callbacks

**Command registration:**
- Add `/doctor` to `STATIC_COMMANDS` array in `src/adapters/telegram/commands/index.ts`
- Add `bot.command('doctor', handler)` in `setupCommands()`

**Handler location:** New file `src/adapters/telegram/commands/doctor.ts` — keeps diagnostic logic separate from admin commands.

**Callback routing:** Register `setupDoctorCallbacks()` in `setupAllCallbacks()` with `bot.callbackQuery(/^m:doctor:fix:/)` **before** the broad `m:` fallback handler (same pattern as `setupSettingsCallbacks`). This prevents the broad handler from swallowing fix button presses.

**Callback data format:** `m:doctor:fix:<index>` where index maps to `pendingFixes` array position.

**Rendering:** Same `DoctorEngine`, results rendered as a single message with emoji indicators. Safe fixes applied automatically. Risky fixes shown with inline "🔧 Fix" buttons. After fix button pressed: apply fix, edit message to update status.

### Telegram: Menu button

Added "🩺 Doctor" to `buildMenuKeyboard()` in `src/adapters/telegram/commands/menu.ts` with callback data `m:doctor`. Triggers same logic as `/doctor` command.

## File Structure

```
src/core/doctor/
  index.ts          — DoctorEngine class
  types.ts          — All interfaces (DoctorContext, CheckResult, FixResult, DoctorCheck, DoctorReport)
  checks/
    config.ts       — Config file checks (order: 1)
    agents.ts       — Agent availability checks (order: 2)
    telegram.ts     — Telegram API checks (order: 3)
    storage.ts      — Session store & directory checks (order: 4)
    workspace.ts    — Workspace directory checks (order: 5)
    plugins.ts      — Plugin system checks (order: 6)
    daemon.ts       — Process & port checks (order: 7)
    tunnel.ts       — Tunnel binary & config checks (order: 8)
```

## Integration Points

- `src/cli.ts` — Wire `doctor` command in the commands record
- `src/cli/commands.ts` — Implement `doctor` command handler (parse `--dry-run` flag, instantiate engine, render CLI output)
- `src/adapters/telegram/commands/doctor.ts` — New file: `/doctor` handler, `setupDoctorCallbacks()`, Telegram renderer
- `src/adapters/telegram/commands/menu.ts` — Add 🩺 Doctor button to `buildMenuKeyboard()`
- `src/adapters/telegram/commands/index.ts` — Add `/doctor` to `STATIC_COMMANDS`, call `setupDoctorCallbacks()` in `setupAllCallbacks()` before broad `m:` handler, call `bot.command('doctor', ...)` in `setupCommands()`

## Dependencies

Doctor engine depends only on:
- `config.ts` (ConfigManager for loading config)
- Node.js built-ins (`fs`, `child_process`, `net`)
- Telegram Bot API via `fetch` (only for telegram checks — standalone, not grammY)

No dependency on VibenCore, Session, or running adapters. Doctor can run standalone even when the system hasn't started.

## Rendering

### CLI Renderer
- Uses ANSI color utils (green ✅, yellow ⚠️, red ❌, cyan headers)
- Indented sub-items per category
- Summary line at end
- Readline prompt for risky fix confirmation (skipped in `--dry-run` mode)

### Telegram Renderer
- Single message, categories separated by blank line
- Same emoji indicators
- Inline keyboard with fix buttons for risky issues
- Message edited in-place after fixes applied

## Backward Compatibility

- New CLI command — no existing commands affected
- New Telegram command — no conflicts with existing commands
- Config: doctor reads config but only writes safe migrations already handled by ConfigManager
- No new config fields required
