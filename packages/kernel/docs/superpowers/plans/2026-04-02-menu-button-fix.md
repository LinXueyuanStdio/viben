# Menu Button & Command Dispatch Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all broken/degraded menu buttons and slash commands so they use Telegram-specific rich UI handlers instead of generic core handlers.

**Architecture:** Add an intercept map (`TELEGRAM_OVERRIDES`) that routes 6 commands to Telegram-specific handlers before they reach `CommandRegistry`. Fix the `m:` handler's `callback` case to dispatch Settings and New Session. Add a button-driven New Session flow (`ns:` prefix) that only delegates to AI for custom workspace input.

**Tech Stack:** TypeScript, grammY (Telegram Bot Framework), Vitest

**Spec:** `docs/superpowers/specs/2026-04-02-menu-button-fix-design.md`

---

## File Map

| File | Responsibility | Change type |
|------|---------------|-------------|
| `src/plugins/telegram/commands/index.ts` | Callback routing hub — broad `m:` handler, exports | Modify |
| `src/plugins/telegram/commands/telegram-overrides.ts` | Intercept map: command name → Telegram handler | Create |
| `src/plugins/telegram/commands/new-session.ts` | New Session button flow (`ns:` prefix callbacks) | Modify |
| `src/plugins/telegram/commands/session.ts` | Add `m:topics` callback handler | Modify |
| `src/plugins/telegram/adapter.ts` | Intercept slash commands before `registry.execute()` | Modify |
| `src/core/menu/core-items.ts` | Change New Session action type | Modify |

---

## Task 1: Create Telegram Overrides Map

**Files:**
- Create: `src/plugins/telegram/commands/telegram-overrides.ts`

This is a simple lookup table. No dependencies on adapter.ts — avoids circular imports.

- [ ] **Step 1: Create the intercept map file**

```typescript
// src/plugins/telegram/commands/telegram-overrides.ts
import type { Context } from 'grammy'
import type { VibenCore } from '../../../core/index.js'
import { handleAgents } from './agents.js'
import { handleTopics } from './session.js'
import { handleDoctor } from './doctor.js'
import { handleUpdate, handleRestart } from './admin.js'
import { handleHelp } from './menu.js'

/**
 * Commands that should be intercepted and handled by Telegram-specific
 * handlers instead of going through CommandRegistry core handlers.
 *
 * These handlers use grammY Context for rich UI (inline keyboards,
 * message editing, pagination) that CommandResponse cannot express.
 */
export const TELEGRAM_OVERRIDES: Record<
  string,
  (ctx: Context, core: VibenCore) => Promise<void>
> = {
  agents: (ctx, core) => handleAgents(ctx, core),
  sessions: (ctx, core) => handleTopics(ctx, core),
  doctor: (ctx) => handleDoctor(ctx),
  update: (ctx, core) => handleUpdate(ctx, core),
  restart: (ctx, core) => handleRestart(ctx, core),
  help: (ctx) => handleHelp(ctx),
}
```

- [ ] **Step 2: Verify build passes**

Run: `cd /Users/lucas/viben-workspace/Viben && pnpm build`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/plugins/telegram/commands/telegram-overrides.ts
git commit -m "feat: add Telegram command intercept map"
```

---

## Task 2: Intercept Slash Commands in Adapter

**Files:**
- Modify: `src/plugins/telegram/adapter.ts` (lines 322-394, the `bot.on("message:text")` handler)

Insert the intercept check after extracting `commandName` (line 344) but before `registry.execute()` (line 360).

- [ ] **Step 1: Add import at top of adapter.ts**

Add after the existing imports from `./commands/index.js`:

```typescript
import { TELEGRAM_OVERRIDES } from './commands/telegram-overrides.js'
```

- [ ] **Step 2: Add intercept check in the slash command handler**

In the `bot.on("message:text")` handler, after line 346 (`if (!def) return next();`), add:

```typescript
      // Telegram-specific override — use rich handler instead of core CommandRegistry
      const telegramOverride = TELEGRAM_OVERRIDES[commandName]
      if (telegramOverride) {
        try {
          await telegramOverride(ctx, this.core as VibenCore)
        } catch (err) {
          await ctx.reply(`⚠️ Command failed: ${String(err)}`)
        }
        return
      }
```

This goes between line 346 (`if (!def) return next()`) and line 348 (`const chatId = ctx.chat.id`).

- [ ] **Step 3: Verify build passes**

Run: `cd /Users/lucas/viben-workspace/Viben && pnpm build`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/plugins/telegram/adapter.ts src/plugins/telegram/commands/telegram-overrides.ts
git commit -m "feat: intercept slash commands for Telegram-specific handlers

/agents, /sessions, /doctor, /update, /restart, /help now use
rich Telegram handlers with inline keyboards instead of generic
CommandRegistry core responses."
```

---

## Task 3: Fix `m:` Handler — Command Type Intercept

**Files:**
- Modify: `src/plugins/telegram/commands/index.ts` (the broad `m:` handler, lines 67-134)

The `command` case currently dispatches everything through `CommandRegistry`. Add intercept check.

- [ ] **Step 1: Add import for TELEGRAM_OVERRIDES**

Add at top of `index.ts`:

```typescript
import { TELEGRAM_OVERRIDES } from './telegram-overrides.js'
```

- [ ] **Step 2: Replace the `command` case in the broad `m:` handler**

Replace lines 82-114 (the entire `case 'command': { ... break }` block):

```typescript
      case 'command': {
        // Check Telegram-specific override first
        const cmdName = item.action.command.replace(/^\//, '').split(' ')[0]
        const telegramOverride = TELEGRAM_OVERRIDES[cmdName]
        if (telegramOverride) {
          try {
            await telegramOverride(ctx, core)
          } catch (err) {
            await ctx.reply(`⚠️ Command failed: ${String(err)}`).catch(() => {})
          }
          break
        }

        // Fallback: dispatch through CommandRegistry for commands without overrides
        if (!registry) return
        const response = await registry.execute(item.action.command, {
          raw: '',
          channelId: 'telegram',
          userId: String(ctx.from.id),
          sessionId: null,
          reply: async () => {},
        })
        if (response.type !== 'delegated' && response.type !== 'silent') {
          if (response.type === 'text') {
            await ctx.reply(response.text, { parse_mode: 'HTML' }).catch(() => {})
          } else if (response.type === 'error') {
            await ctx.reply(`⚠️ ${response.message}`).catch(() => {})
          } else if (response.type === 'list') {
            const lines = response.items.map((i: { label: string; detail?: string }) => `• ${i.label}${i.detail ? ` — ${i.detail}` : ''}`).join('\n')
            await ctx.reply(`${response.title}\n${lines}`, { parse_mode: 'HTML' }).catch(() => {})
          } else if (response.type === 'menu') {
            const { InlineKeyboard } = await import('grammy')
            const kb = new InlineKeyboard()
            for (const opt of response.options) {
              kb.text(opt.label, `c/${opt.command}`).row()
            }
            await ctx.reply(response.title, { parse_mode: 'HTML', reply_markup: kb }).catch(() => {})
          } else if (response.type === 'confirm') {
            const { InlineKeyboard } = await import('grammy')
            const kb = new InlineKeyboard()
              .text('✅ Yes', `c/${response.onYes}`)
              .text('❌ No', `c/${response.onNo}`)
            await ctx.reply(response.question, { reply_markup: kb }).catch(() => {})
          }
        }
        break
      }
```

- [ ] **Step 3: Verify build passes**

Run: `cd /Users/lucas/viben-workspace/Viben && pnpm build`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/plugins/telegram/commands/index.ts
git commit -m "feat: intercept menu button commands for Telegram handlers

Menu buttons for Agents, Sessions, Doctor, Update, Restart, Help
now use rich Telegram handlers instead of generic core responses."
```

---

## Task 4: Fix `m:` Handler — Callback Type (Settings)

**Files:**
- Modify: `src/plugins/telegram/commands/index.ts` (the `callback` case, line 130-132)

- [ ] **Step 1: Replace the `callback` case**

Replace lines 130-132:

```typescript
      case 'callback':
        // Pass through to specific callback handlers
        break
```

With:

```typescript
      case 'callback': {
        const cbData = item.action.callbackData
        if (cbData === 's:settings') {
          await handleSettings(ctx, core)
        }
        // ns: callbacks handled in Task 6 (New Session flow)
        break
      }
```

- [ ] **Step 2: Verify build passes**

Run: `cd /Users/lucas/viben-workspace/Viben && pnpm build`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/plugins/telegram/commands/index.ts
git commit -m "fix: Settings menu button now opens settings keyboard

The callback action type was silently doing nothing (break).
Now dispatches s:settings to handleSettings directly."
```

---

## Task 5: Fix `m:topics` Refresh Button

**Files:**
- Modify: `src/plugins/telegram/commands/session.ts` (inside `setupSessionCallbacks`)

The Refresh button in the sessions list sends `m:topics` which reaches the broad `m:` handler → `menuRegistry.getItem("topics")` → undefined → nothing. Fix by adding a specific handler in `setupSessionCallbacks` which runs BEFORE the broad handler.

- [ ] **Step 1: Add `m:topics` callback handler in `setupSessionCallbacks`**

In `session.ts`, inside `setupSessionCallbacks()`, add after the existing `bot.callbackQuery(/^m:cleanup/, ...)` handler (after line 355):

```typescript
  // Refresh sessions list (button created by handleTopics)
  bot.callbackQuery('m:topics', async (ctx) => {
    try { await ctx.answerCallbackQuery() } catch { /* expired */ }
    await handleTopics(ctx, core)
  })
```

- [ ] **Step 2: Verify build passes**

Run: `cd /Users/lucas/viben-workspace/Viben && pnpm build`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/plugins/telegram/commands/session.ts
git commit -m "fix: Refresh button in sessions list now works

m:topics callback was falling through to broad m: handler which
couldn't find a menu item for 'topics'. Now handled directly by
setupSessionCallbacks before the broad handler."
```

---

## Task 6: New Session Button Flow

**Files:**
- Modify: `src/plugins/telegram/commands/new-session.ts` — add `setupNewSessionCallbacks()` and `showAgentPicker()`
- Modify: `src/plugins/telegram/commands/index.ts` — register `ns:` callbacks, update `callback` case
- Modify: `src/core/menu/core-items.ts` — change New Session action type

### Step 1: Add New Session button flow to new-session.ts

- [ ] **Step 1a: Add the workspace cache and agent picker function**

Add at the bottom of `new-session.ts`, before the final export:

```typescript
// --- New Session button flow (ns: prefix) ---

/** Workspace cache for callback data — avoids Telegram's 64-byte callback limit */
const workspaceCache = new Map<number, { agentKey: string; workspace: string }>()
let nextWsId = 0

export async function showAgentPicker(ctx: Context, core: VibenCore, chatId: number): Promise<void> {
  const catalog = core.agentCatalog
  const installed = catalog.getAvailable().filter((i) => i.installed)

  if (installed.length === 0) {
    await ctx.reply('No agents installed. Use /install to add one.', { parse_mode: 'HTML' }).catch(() => {})
    return
  }

  // Single agent → skip picker, go to workspace
  if (installed.length === 1) {
    await showWorkspacePicker(ctx, core, chatId, installed[0].key)
    return
  }

  const kb = new InlineKeyboard()
  for (let i = 0; i < installed.length; i += 2) {
    const row = installed.slice(i, i + 2)
    for (const agent of row) {
      kb.text(agent.name, `ns:agent:${agent.key}`)
    }
    kb.row()
  }

  await ctx.reply('<b>🆕 New Session</b>\nSelect an agent:', {
    parse_mode: 'HTML',
    reply_markup: kb,
  }).catch(() => {})
}

async function showWorkspacePicker(ctx: Context, core: VibenCore, chatId: number, agentKey: string): Promise<void> {
  const records = core.sessionManager.listRecords()
  const recentWorkspaces = [...new Set(records.map((r: any) => r.workingDir).filter(Boolean))]
    .slice(0, 5)

  const config = core.configManager.get()
  const baseDir = config.workspace.baseDir

  // Ensure baseDir is always an option
  const workspaces = recentWorkspaces.includes(baseDir)
    ? recentWorkspaces
    : [baseDir, ...recentWorkspaces].slice(0, 5)

  const kb = new InlineKeyboard()
  for (const ws of workspaces) {
    const id = nextWsId++
    workspaceCache.set(id, { agentKey, workspace: ws })
    // Show shortened path for display
    const label = ws.startsWith('/Users/') ? '~/' + ws.split('/').slice(3).join('/') : ws
    kb.text(`📁 ${label}`, `ns:ws:${id}`).row()
  }
  // Custom path → delegate to AI
  const customId = nextWsId++
  workspaceCache.set(customId, { agentKey, workspace: '' })  // empty = custom
  kb.text('📁 Custom path...', `ns:custom:${agentKey}`).row()

  const agentLabel = escapeHtml(agentKey)
  await ctx.reply(`<b>🆕 New Session</b>\nAgent: <code>${agentLabel}</code>\n\nSelect workspace:`, {
    parse_mode: 'HTML',
    reply_markup: kb,
  }).catch(() => {})
}

export function setupNewSessionCallbacks(
  bot: Bot,
  core: VibenCore,
  chatId: number,
  getAssistantSession?: () => { topicId: number; enqueuePrompt: (p: string) => Promise<void> } | undefined,
): void {
  // Agent picker (also triggered from m: handler callback case)
  bot.callbackQuery('ns:start', async (ctx) => {
    try { await ctx.answerCallbackQuery() } catch { /* expired */ }
    await showAgentPicker(ctx, core, chatId)
  })

  bot.callbackQuery(/^ns:agent:/, async (ctx) => {
    const agentKey = ctx.callbackQuery.data.replace('ns:agent:', '')
    try { await ctx.answerCallbackQuery() } catch { /* expired */ }
    await showWorkspacePicker(ctx, core, chatId, agentKey)
  })

  bot.callbackQuery(/^ns:ws:/, async (ctx) => {
    const id = parseInt(ctx.callbackQuery.data.replace('ns:ws:', ''), 10)
    try { await ctx.answerCallbackQuery() } catch { /* expired */ }

    const entry = workspaceCache.get(id)
    if (!entry) {
      await ctx.reply('⚠️ Session expired. Please try again via /menu.').catch(() => {})
      return
    }
    workspaceCache.delete(id)
    await createSessionDirect(ctx, core, chatId, entry.agentKey, entry.workspace)
  })

  bot.callbackQuery(/^ns:custom:/, async (ctx) => {
    const agentKey = ctx.callbackQuery.data.replace('ns:custom:', '')
    try { await ctx.answerCallbackQuery() } catch { /* expired */ }

    const assistant = getAssistantSession?.()
    if (assistant) {
      await assistant.enqueuePrompt(
        `User wants to create a new session with agent "${agentKey}". Ask them for the workspace (project directory) path, then create the session.`
      )
    } else {
      await ctx.reply(
        `Usage: <code>/new ${escapeHtml(agentKey)} &lt;workspace-path&gt;</code>`,
        { parse_mode: 'HTML' },
      ).catch(() => {})
    }
  })
}
```

- [ ] **Step 1b: Add `InlineKeyboard` to imports**

The top of `new-session.ts` has `import type { Bot, Context } from "grammy"` (line 1). Change it to:

```typescript
import type { Bot, Context } from "grammy";
import { InlineKeyboard } from "grammy";
```

Remove the `import { InlineKeyboard } from 'grammy'` line from inside the new code block added in Step 1a (it's a top-level import now).

- [ ] **Step 1c: Export `showAgentPicker` and `setupNewSessionCallbacks` from the file**

Both are already exported via `export async function` and `export function` in the code above. No additional change needed.

### Step 2: Register ns: callbacks in index.ts

- [ ] **Step 2a: Add imports in index.ts**

Add to the imports from `./new-session.js`:

```typescript
import { handleNew, handleNewChat, createSessionDirect, showAgentPicker, setupNewSessionCallbacks } from './new-session.js'
```

(Replace the existing import line for `new-session.js`.)

- [ ] **Step 2b: Register ns: callbacks in setupAllCallbacks**

Add after the `na:` handler (line 62) and before the `ar:` handler (line 65):

```typescript
  // New Session button flow — must be before broad m: handler
  setupNewSessionCallbacks(bot, core, chatId, getAssistantSession);
```

- [ ] **Step 2c: Update the `callback` case to handle ns:start**

Update the `callback` case (from Task 4) to also handle `ns:`:

```typescript
      case 'callback': {
        const cbData = item.action.callbackData
        if (cbData === 's:settings') {
          await handleSettings(ctx, core)
        } else if (cbData === 'ns:start') {
          await showAgentPicker(ctx, core, chatId)
        }
        break
      }
```

### Step 3: Update core menu item

- [ ] **Step 3a: Change New Session action in core-items.ts**

In `src/core/menu/core-items.ts`, replace line 9:

```typescript
    action: { type: 'delegate', prompt: 'User wants new session. Guide them through agent and workspace selection.' },
```

With:

```typescript
    action: { type: 'callback', callbackData: 'ns:start' },
```

### Step 4: Build and commit

- [ ] **Step 4a: Verify build passes**

Run: `cd /Users/lucas/viben-workspace/Viben && pnpm build`
Expected: No errors

- [ ] **Step 4b: Commit**

```bash
git add src/plugins/telegram/commands/new-session.ts \
  src/plugins/telegram/commands/index.ts \
  src/core/menu/core-items.ts
git commit -m "feat: button-driven New Session flow

New Session menu button now shows:
1. Agent picker (inline buttons, skip if only 1 agent)
2. Workspace picker (recent workspaces from session history)
3. 'Custom path...' delegates to AI for text input
4. Direct workspace selection creates session immediately

Uses workspace cache with numeric IDs to stay within
Telegram's 64-byte callback data limit."
```

---

## Task 7: Add re-export for telegram-overrides

**Files:**
- Modify: `src/plugins/telegram/commands/index.ts`

- [ ] **Step 1: Add re-export**

Add to the re-exports section at the bottom of `index.ts`:

```typescript
export { TELEGRAM_OVERRIDES } from './telegram-overrides.js'
```

- [ ] **Step 2: Verify build passes**

Run: `cd /Users/lucas/viben-workspace/Viben && pnpm build`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/plugins/telegram/commands/index.ts
git commit -m "chore: re-export TELEGRAM_OVERRIDES from commands index"
```

---

## Task 8: Manual Smoke Test

No automated tests for UI callback flows — these require grammY bot context which is hard to mock meaningfully. Verify manually.

- [ ] **Step 1: Build and start**

```bash
cd /Users/lucas/viben-workspace/Viben && pnpm build
```

- [ ] **Step 2: Test each menu button in Telegram**

Open the Telegram group, type `/menu`, then test each button:

| Button | Expected behavior | Pass? |
|--------|-------------------|-------|
| 🆕 New Session | Shows agent picker buttons (or workspace picker if 1 agent) | |
| 📋 Sessions | Shows session list with status emoji + cleanup buttons + Refresh | |
| 📊 Status | Shows status text | |
| 🤖 Agents | Shows paginated agent list with install buttons | |
| ⚙️ Settings | Shows settings keyboard with toggle/select options | |
| 🔗 Integrate | Shows integration menu | |
| 🔄 Restart | Sends restart message, then restarts | |
| ⬆️ Update | Checks version, updates if available | |
| ❓ Help | Shows rich formatted help | |
| 🩺 Doctor | Runs diagnostics, shows report with fix buttons | |

- [ ] **Step 3: Test slash commands**

Type each command directly:

| Command | Expected | Pass? |
|---------|----------|-------|
| `/agents` | Paginated list with install buttons | |
| `/sessions` | Session list with cleanup + refresh | |
| `/doctor` | Diagnostic report with fix buttons | |
| `/help` | Rich formatted help | |

- [ ] **Step 4: Test New Session full flow**

1. `/menu` → tap "🆕 New Session" → agent picker appears
2. Tap an agent → workspace picker appears (recent workspaces + Custom)
3. Tap a recent workspace → session created with topic
4. Repeat: tap "Custom path..." → AI asks for workspace path

- [ ] **Step 5: Test Refresh button**

1. `/menu` → tap "📋 Sessions" → session list with Refresh button
2. Tap "Refresh" → list refreshes
