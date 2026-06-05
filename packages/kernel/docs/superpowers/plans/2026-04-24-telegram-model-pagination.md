# Telegram /model Pagination Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the `400: reply markup is too long` error on `/model` in Telegram by rendering model lists in paginated pages instead of one flat keyboard.

**Architecture:** Add `model` to `TELEGRAM_OVERRIDES` so both the direct `/model` command and the session control menu button go through a Telegram-specific handler. The handler renders a paginated `InlineKeyboard` (8 per page) with `mod:<page>` navigation callbacks.

**Tech Stack:** grammY (InlineKeyboard), TypeScript, vitest

**Spec:** `docs/superpowers/specs/2026-04-24-telegram-model-pagination-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/plugins/telegram/commands/model.ts` | **Create** | `handleModel` entry point + `showModelPage` renderer |
| `src/plugins/telegram/commands/telegram-overrides.ts` | **Modify** | Add `model` entry to intercept both command paths |
| `src/plugins/telegram/commands/index.ts` | **Modify** | Register `mod:` callback handler for page navigation |
| `src/plugins/telegram/commands/__tests__/model.test.ts` | **Create** | Unit tests for paginated model menu |

---

## Task 1: Create `commands/model.ts`

**Files:**
- Create: `src/plugins/telegram/commands/model.ts`

- [ ] **Step 1: Create the file**

```typescript
import type { Context } from 'grammy'
import { InlineKeyboard } from 'grammy'
import type { VibenCore } from '../../../core/index.js'
import type { ConfigSelectChoice, ConfigSelectGroup } from '../../../core/types.js'

const MODELS_PER_PAGE = 8

function flattenChoices(options: (ConfigSelectChoice | ConfigSelectGroup)[]): ConfigSelectChoice[] {
  const result: ConfigSelectChoice[] = []
  for (const item of options) {
    if ('group' in item && 'options' in item) {
      result.push(...(item as ConfigSelectGroup).options)
    } else {
      result.push(item as ConfigSelectChoice)
    }
  }
  return result
}

/**
 * Entry point for /model — shows page 0 of the paginated model selection menu.
 * Registered in TELEGRAM_OVERRIDES to intercept both direct-command and menu-callback flows.
 */
export async function handleModel(ctx: Context, core: VibenCore): Promise<void> {
  await showModelPage(ctx, core, 0, 'send')
}

/**
 * Render a paginated model selection keyboard.
 *
 * Model buttons use `c//model <value>` callback data, handled by the existing
 * c/ dispatcher in adapter.ts. Navigation buttons use `mod:<page>`.
 */
export async function showModelPage(
  ctx: Context,
  core: VibenCore,
  page: number,
  action: 'send' | 'edit',
): Promise<void> {
  const topicId = (ctx.message ?? ctx.callbackQuery?.message)?.message_thread_id

  const sessionId = topicId != null
    ? ((await core.getOrResumeSession('telegram', String(topicId)))?.id ?? null)
    : null

  if (!sessionId) {
    const text = '⚠️ No active session. Start a session first.'
    if (action === 'edit') {
      await ctx.editMessageText(text).catch(() => {})
    } else {
      await ctx.reply(text).catch(() => {})
    }
    return
  }

  const session = core.sessionManager.getSession(sessionId)
  const configOption = session?.getConfigByCategory('model')

  if (!configOption || configOption.type !== 'select') {
    const text = '⚠️ This agent does not support switching models.'
    if (action === 'edit') {
      await ctx.editMessageText(text).catch(() => {})
    } else {
      await ctx.reply(text).catch(() => {})
    }
    return
  }

  const choices = flattenChoices(configOption.options)
  const totalPages = Math.ceil(choices.length / MODELS_PER_PAGE)
  const safePage = Math.max(0, Math.min(page, totalPages - 1))
  const pageChoices = choices.slice(safePage * MODELS_PER_PAGE, (safePage + 1) * MODELS_PER_PAGE)

  const currentChoice = choices.find(c => c.value === configOption.currentValue)
  const currentLabel = currentChoice?.name ?? String(configOption.currentValue)
  const pageInfo = totalPages > 1 ? ` — Page ${safePage + 1}/${totalPages}` : ''
  const title = `Choose a model (current: ${currentLabel})${pageInfo}`

  const kb = new InlineKeyboard()
  for (const choice of pageChoices) {
    const label = choice.value === configOption.currentValue ? `✅ ${choice.name}` : choice.name
    kb.text(label, `c//model ${choice.value}`).row()
  }

  // Navigation row — only shown when there is more than one page
  if (totalPages > 1) {
    if (safePage > 0) kb.text('◀️ Prev', `mod:${safePage - 1}`)
    if (safePage < totalPages - 1) kb.text('Next ▶️', `mod:${safePage + 1}`)
    kb.row()
  }

  if (action === 'edit') {
    await ctx.editMessageText(title, { reply_markup: kb }).catch(() => {})
  } else {
    await ctx.reply(title, { reply_markup: kb }).catch(() => {})
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/lucas/viben-workspace/Viben && pnpm build
```

Expected: no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add src/plugins/telegram/commands/model.ts
git commit -m "feat(telegram): add paginated model selection handler"
```

---

## Task 2: Wire up `TELEGRAM_OVERRIDES` and `mod:` callback

**Files:**
- Modify: `src/plugins/telegram/commands/telegram-overrides.ts`
- Modify: `src/plugins/telegram/commands/index.ts`

- [ ] **Step 1: Add `model` to `TELEGRAM_OVERRIDES`**

In `src/plugins/telegram/commands/telegram-overrides.ts`, add the import and entry:

```typescript
import { handleModel } from './model.js'
```

Add to the `TELEGRAM_OVERRIDES` object (after the existing `agents` entry):

```typescript
model: (ctx, core) => handleModel(ctx, core),
```

Full file after change:

```typescript
import type { Context } from 'grammy'
import type { VibenCore } from '../../../core/index.js'
import type { MenuRegistry } from '../../../core/menu-registry.js'
import { handleAgents } from './agents.js'
import { handleTopics } from './session.js'
import { handleDoctor } from './doctor.js'
import { handleUpdate, handleRestart } from './admin.js'
import { handleHelp, handleMenu } from './menu.js'
import { handleModel } from './model.js'

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
  model: (ctx, core) => handleModel(ctx, core),
  sessions: (ctx, core) => handleTopics(ctx, core),
  doctor: (ctx) => handleDoctor(ctx),
  update: (ctx, core) => handleUpdate(ctx, core),
  restart: (ctx, core) => handleRestart(ctx, core),
  help: (ctx) => handleHelp(ctx),
  menu: (ctx, core) => {
    const menuRegistry = core.lifecycleManager?.serviceRegistry?.get('menu-registry') as MenuRegistry | undefined
    return handleMenu(ctx, menuRegistry)
  },
}
```

- [ ] **Step 2: Register `mod:` callback handler in `setupAllCallbacks`**

In `src/plugins/telegram/commands/index.ts`, add the import at the top:

```typescript
import { showModelPage } from './model.js'
```

Then, in the `setupAllCallbacks` function, add the `mod:` handler **before** the broad `m:` handler (after the `ag:` handler registration at line ~59):

```typescript
  // Model pagination callbacks — must be before broad m: handler
  bot.callbackQuery(/^mod:/, async (ctx) => {
    const page = parseInt(ctx.callbackQuery.data.replace('mod:', ''), 10)
    try { await ctx.answerCallbackQuery() } catch { /* expired */ }
    await showModelPage(ctx, core, page, 'edit')
  })
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/lucas/viben-workspace/Viben && pnpm build
```

Expected: no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add src/plugins/telegram/commands/telegram-overrides.ts src/plugins/telegram/commands/index.ts
git commit -m "feat(telegram): wire model pagination into overrides and callback handler"
```

---

## Task 3: Tests

**Files:**
- Create: `src/plugins/telegram/commands/__tests__/model.test.ts`

- [ ] **Step 1: Write the tests**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { handleModel, showModelPage } from '../model.js'
import type { VibenCore } from '../../../../core/index.js'
import type { Context } from 'grammy'

function makeChoices(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    value: `model-${i}`,
    name: `Model ${i}`,
  }))
}

function makeCore(opts: {
  sessionId?: string | null
  choices?: { value: string; name: string }[]
  currentValue?: string
  noConfig?: boolean
}): VibenCore {
  const { sessionId = 'sess-1', choices = makeChoices(3), currentValue = 'model-0', noConfig = false } = opts
  const configOption = noConfig ? undefined : {
    id: 'model-opt',
    name: 'Model',
    category: 'model',
    type: 'select' as const,
    currentValue,
    options: choices,
  }
  const session = {
    getConfigByCategory: (cat: string) => cat === 'model' ? configOption : undefined,
  }
  return {
    getOrResumeSession: vi.fn().mockResolvedValue(sessionId ? { id: sessionId } : null),
    sessionManager: { getSession: vi.fn().mockReturnValue(session) },
  } as unknown as VibenCore
}

function makeCtx(opts: { topicId?: number } = {}): Context {
  return {
    message: opts.topicId != null ? { message_thread_id: opts.topicId } : undefined,
    callbackQuery: undefined,
    reply: vi.fn().mockResolvedValue(undefined),
    editMessageText: vi.fn().mockResolvedValue(undefined),
    answerCallbackQuery: vi.fn().mockResolvedValue(undefined),
  } as unknown as Context
}

describe('handleModel', () => {
  it('calls showModelPage with page 0 and send action', async () => {
    const core = makeCore({ choices: makeChoices(3) })
    const ctx = makeCtx({ topicId: 42 })
    await handleModel(ctx, core)
    expect(ctx.reply).toHaveBeenCalledOnce()
    const [title, options] = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(title).toContain('Choose a model')
    expect(options.reply_markup).toBeDefined()
  })

  it('replies with error when no active session', async () => {
    const core = makeCore({ sessionId: null })
    const ctx = makeCtx({ topicId: 42 })
    await handleModel(ctx, core)
    expect(ctx.reply).toHaveBeenCalledWith('⚠️ No active session. Start a session first.')
  })

  it('replies with error when model config not available', async () => {
    const core = makeCore({ noConfig: true })
    const ctx = makeCtx({ topicId: 42 })
    await handleModel(ctx, core)
    expect(ctx.reply).toHaveBeenCalledWith('⚠️ This agent does not support switching models.')
  })
})

describe('showModelPage — pagination', () => {
  it('renders all models on one page when count <= 8', async () => {
    const choices = makeChoices(5)
    const core = makeCore({ choices })
    const ctx = makeCtx({ topicId: 1 })
    await showModelPage(ctx, core, 0, 'send')
    const [title, { reply_markup }] = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0]
    // No page indicator when only one page
    expect(title).not.toContain('Page')
    // 5 model buttons, no nav buttons
    const buttons = reply_markup.inline_keyboard.flat()
    expect(buttons).toHaveLength(5)
  })

  it('paginates and shows nav buttons when count > 8', async () => {
    const choices = makeChoices(20)
    const core = makeCore({ choices })
    const ctx = makeCtx({ topicId: 1 })
    await showModelPage(ctx, core, 0, 'send')
    const [title, { reply_markup }] = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(title).toContain('Page 1/')
    const buttons = reply_markup.inline_keyboard.flat()
    // 8 model buttons + 1 Next button (no Prev on page 0)
    const nextBtn = buttons.find((b: { callback_data: string }) => b.callback_data === 'mod:1')
    expect(nextBtn).toBeDefined()
    const prevBtn = buttons.find((b: { callback_data: string }) => b.callback_data === 'mod:-1')
    expect(prevBtn).toBeUndefined()
  })

  it('shows Prev button on page > 0', async () => {
    const choices = makeChoices(20)
    const core = makeCore({ choices })
    const ctx = makeCtx({ topicId: 1 })
    await showModelPage(ctx, core, 1, 'send')
    const [, { reply_markup }] = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0]
    const buttons = reply_markup.inline_keyboard.flat()
    const prevBtn = buttons.find((b: { callback_data: string }) => b.callback_data === 'mod:0')
    expect(prevBtn).toBeDefined()
  })

  it('marks the current model with a checkmark', async () => {
    const choices = makeChoices(3)
    const core = makeCore({ choices, currentValue: 'model-1' })
    const ctx = makeCtx({ topicId: 1 })
    await showModelPage(ctx, core, 0, 'send')
    const [, { reply_markup }] = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0]
    const buttons = reply_markup.inline_keyboard.flat()
    const activeBtn = buttons.find((b: { text: string }) => b.text.startsWith('✅'))
    expect(activeBtn?.text).toBe('✅ Model 1')
  })

  it('edits message in-place when action is edit', async () => {
    const core = makeCore({ choices: makeChoices(3) })
    const ctx = makeCtx({ topicId: 1 })
    await showModelPage(ctx, core, 0, 'edit')
    expect(ctx.editMessageText).toHaveBeenCalledOnce()
    expect(ctx.reply).not.toHaveBeenCalled()
  })

  it('clamps page to valid range', async () => {
    const choices = makeChoices(5)
    const core = makeCore({ choices })
    const ctx = makeCtx({ topicId: 1 })
    // page 99 should clamp to last valid page (0, since only 1 page)
    await showModelPage(ctx, core, 99, 'send')
    expect(ctx.reply).toHaveBeenCalledOnce()
    const [title] = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(title).toContain('Choose a model')
  })
})
```

- [ ] **Step 2: Run the tests**

```bash
cd /Users/lucas/viben-workspace/Viben && pnpm test src/plugins/telegram/commands/__tests__/model.test.ts
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/plugins/telegram/commands/__tests__/model.test.ts
git commit -m "test(telegram): add model pagination tests"
```

---

## Self-Review Checklist

- [x] **Spec coverage:** new file `model.ts` ✓, `TELEGRAM_OVERRIDES` entry ✓, `mod:` callback ✓, error handling (no session, no config) ✓, pagination with Prev/Next ✓, current model checkmark ✓, page indicator ✓
- [x] **No placeholders:** all steps contain actual code
- [x] **Type consistency:** `showModelPage` signature used identically in all three tasks; `ConfigSelectChoice`/`ConfigSelectGroup` match `types.ts` definitions
