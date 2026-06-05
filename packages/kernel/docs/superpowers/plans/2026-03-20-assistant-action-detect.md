# Assistant Action Detection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Detect action intent in assistant LLM responses and append inline confirm buttons so users can trigger session management actions without typing commands.

**Architecture:** A `detectAction()` function scans finalized assistant text for command patterns (`/new`, `/cancel`) and keyword phrases. When detected, the adapter edits the message to append inline confirm/dismiss buttons. Button callbacks execute extracted command logic (`executeNewSession`, `executeCancelSession`).

**Tech Stack:** TypeScript, grammY (Telegram bot), nanoid (callback keys)

**Spec:** `docs/superpowers/specs/2026-03-20-assistant-action-detect-design.md`

---

## File Structure

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src/adapters/telegram/action-detect.ts` | `detectAction()`, `DetectedAction` type, action callback map, button builder |
| Create | `src/__tests__/action-detect.test.ts` | Unit tests for `detectAction()` |
| Modify | `src/adapters/telegram/adapter.ts:596-602` | Post-finalize hook for assistant messages |
| Modify | `src/adapters/telegram/adapter.ts:133-144` | Register `a:` callback handler |
| Modify | `src/adapters/telegram/commands.ts:80-150,213-226` | Extract `executeNewSession()` and `executeCancelSession()` from handlers |

---

### Task 1: DetectedAction Type + detectAction() Function

**Files:**
- Create: `src/adapters/telegram/action-detect.ts`
- Create: `src/__tests__/action-detect.test.ts`

- [ ] **Step 1: Write failing tests for detectAction**

Create `src/__tests__/action-detect.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { detectAction } from '../adapters/telegram/action-detect.js'

describe('detectAction', () => {
  describe('command pattern detection', () => {
    it('detects /new with agent and workspace', () => {
      const result = detectAction('I will create a session with /new claude ~/project!')
      expect(result).toEqual({ action: 'new_session', agent: 'claude', workspace: '~/project' })
    })

    it('detects /new with agent only', () => {
      const result = detectAction('You can use /new claude to get started')
      expect(result).toEqual({ action: 'new_session', agent: 'claude', workspace: undefined })
    })

    it('detects /new without params', () => {
      const result = detectAction('Use /new to create a new session')
      expect(result).toEqual({ action: 'new_session', agent: undefined, workspace: undefined })
    })

    it('detects /cancel', () => {
      const result = detectAction('You can use /cancel to cancel the session')
      expect(result).toEqual({ action: 'cancel_session' })
    })

    it('does not detect /status or /help', () => {
      expect(detectAction('Use /status to check the status')).toBeNull()
      expect(detectAction('Type /help to see the guide')).toBeNull()
    })
  })

  describe('keyword detection', () => {
    it('detects "tao session" keyword (Vietnamese: create)', () => {
      const result = detectAction('I will create a new session for you')
      expect(result).toEqual({ action: 'new_session', agent: undefined, workspace: undefined })
    })

    it('detects "create session" keyword', () => {
      const result = detectAction('I will create session for you')
      expect(result).toEqual({ action: 'new_session', agent: undefined, workspace: undefined })
    })

    it('detects "huy session" keyword (Vietnamese: cancel)', () => {
      const result = detectAction('I will cancel the current session')
      expect(result).toEqual({ action: 'cancel_session' })
    })

    it('detects "cancel session" keyword', () => {
      const result = detectAction('Let me cancel session for you')
      expect(result).toEqual({ action: 'cancel_session' })
    })

    it('does not false-positive on single word "huy" (Vietnamese name)', () => {
      expect(detectAction('Hey Huy, how are you')).toBeNull()
    })

    it('does not false-positive on unrelated text', () => {
      expect(detectAction('Hello, how can I help you?')).toBeNull()
    })
  })

  describe('priority', () => {
    it('prefers command pattern over keyword', () => {
      const result = detectAction('Create session using /new claude ~/work')
      expect(result).toEqual({ action: 'new_session', agent: 'claude', workspace: '~/work' })
    })
  })

  it('returns null for empty text', () => {
    expect(detectAction('')).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test -- src/__tests__/action-detect.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement detectAction and types**

Create `src/adapters/telegram/action-detect.ts`:

```typescript
import { nanoid } from 'nanoid'
import { InlineKeyboard } from 'grammy'

export interface DetectedAction {
  action: 'new_session' | 'cancel_session'
  agent?: string
  workspace?: string
}

// Command patterns: /new [agent] [workspace], /cancel
const CMD_NEW_RE = /\/new(?:\s+(\S+)(?:\s+(\S+))?)?/
const CMD_CANCEL_RE = /\/cancel\b/

// Keyword patterns (compound phrases only to avoid false positives)
const KW_NEW_RE = /(?:tao|tạo|create|new)\s+session/i
const KW_CANCEL_RE = /(?:huy|huỷ|cancel|dung|dừng)\s+session/i

export function detectAction(text: string): DetectedAction | null {
  if (!text) return null

  // Priority 1: command pattern
  const cancelCmd = CMD_CANCEL_RE.exec(text)
  if (cancelCmd) return { action: 'cancel_session' }

  const newCmd = CMD_NEW_RE.exec(text)
  if (newCmd) {
    return {
      action: 'new_session',
      agent: newCmd[1] || undefined,
      workspace: newCmd[2] || undefined,
    }
  }

  // Priority 2: keyword matching
  if (KW_CANCEL_RE.test(text)) return { action: 'cancel_session' }
  if (KW_NEW_RE.test(text)) return { action: 'new_session', agent: undefined, workspace: undefined }

  return null
}

// --- Callback map for action buttons ---

const ACTION_TTL_MS = 5 * 60 * 1000 // 5 minutes
const actionMap: Map<string, { action: DetectedAction; createdAt: number }> = new Map()

export function storeAction(action: DetectedAction): string {
  const id = nanoid(10)
  actionMap.set(id, { action, createdAt: Date.now() })
  // Cleanup expired entries
  for (const [key, entry] of actionMap) {
    if (Date.now() - entry.createdAt > ACTION_TTL_MS) {
      actionMap.delete(key)
    }
  }
  return id
}

export function getAction(id: string): DetectedAction | undefined {
  const entry = actionMap.get(id)
  if (!entry) return undefined
  if (Date.now() - entry.createdAt > ACTION_TTL_MS) {
    actionMap.delete(id)
    return undefined
  }
  return entry.action
}

export function removeAction(id: string): void {
  actionMap.delete(id)
}

export function buildActionKeyboard(actionId: string, action: DetectedAction): InlineKeyboard {
  const keyboard = new InlineKeyboard()
  if (action.action === 'new_session') {
    keyboard.text('✅ Create session', `a:${actionId}`)
    keyboard.text('❌ Dismiss', `a:dismiss:${actionId}`)
  } else {
    keyboard.text('⛔ Cancel session', `a:${actionId}`)
    keyboard.text('❌ No', `a:dismiss:${actionId}`)
  }
  return keyboard
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test -- src/__tests__/action-detect.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/adapters/telegram/action-detect.ts src/__tests__/action-detect.test.ts
git commit -m "feat(action-detect): add detectAction with command and keyword patterns"
```

---

### Task 2: Extract Reusable Session Actions from Commands

**Files:**
- Modify: `src/adapters/telegram/commands.ts:80-150,213-226`

- [ ] **Step 1: Extract executeNewSession from handleNew**

In `src/adapters/telegram/commands.ts`, add a new exported function that contains the core logic of `handleNew()` — creating topic, calling `core.handleNewSession()`, setting threadId, persisting topicId, renaming topic. This function should NOT depend on `ctx` (grammY Context).

```typescript
export async function executeNewSession(
  bot: Bot,
  core: VibenCore,
  chatId: number,
  agentName?: string,
  workspace?: string,
): Promise<{ session: Session; threadId: number }> {
  // Create topic with generic name first (same as original handleNew)
  const threadId = await createSessionTopic(bot, chatId, '🔄 New Session')

  await bot.api.sendMessage(chatId, '⏳ Setting up session, please wait...', {
    message_thread_id: threadId,
    parse_mode: 'HTML',
  })

  try {
    // core.handleNewSession() already wires events internally — do NOT call wireSessionEvents again
    const session = await core.handleNewSession('telegram', agentName, workspace)
    session.threadId = String(threadId)

    await core.sessionManager.updateSessionPlatform(session.id, { topicId: threadId })

    // Rename topic with agent name after session is created
    const finalName = `🔄 ${session.agentName} — New Session`
    await renameSessionTopic(bot, chatId, threadId, finalName)

    // Warm up model cache
    if (typeof session.warmup === 'function') {
      session.warmup().catch(() => {})
    }

    return { session, threadId }
  } catch (err) {
    // Clean up orphaned topic on failure
    try {
      await bot.api.deleteForumTopic(chatId, threadId)
    } catch { /* best effort */ }
    throw err
  }
}
```

- [ ] **Step 2: Extract executeCancelSession**

Add a function that finds the most recent active non-assistant session and cancels it:

```typescript
export async function executeCancelSession(
  core: VibenCore,
  excludeSessionId?: string,
): Promise<Session | null> {
  const sessions = core.sessionManager.listSessions('telegram')
    .filter(s => s.status === 'active' && s.id !== excludeSessionId)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

  const session = sessions[0]
  if (!session) return null

  await session.cancel()
  return session
}
```

- [ ] **Step 3: Refactor handleNew to use executeNewSession**

Modify `handleNew()` to call `executeNewSession()` internally, keeping the ctx-specific parts (parsing args from message text, replying with success/error).

- [ ] **Step 4: Refactor handleCancel to use executeCancelSession for assistant-topic case**

Keep `handleCancel()` as-is for session topic usage (finds by threadId). The extracted `executeCancelSession()` is only for the assistant topic action.

- [ ] **Step 5: Verify build and existing commands still work**

Run: `pnpm build`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add src/adapters/telegram/commands.ts
git commit -m "refactor(commands): extract executeNewSession and executeCancelSession"
```

---

### Task 3: Post-Finalize Hook for Assistant Messages

**Files:**
- Modify: `src/adapters/telegram/adapter.ts:596-602` (finalizeDraft method)

- [ ] **Step 1: Modify finalizeDraft to detect actions for assistant session**

The current `finalizeDraft` method at lines 596-602:

```typescript
private async finalizeDraft(sessionId: string): Promise<void> {
  const draft = this.sessionDrafts.get(sessionId);
  if (draft) {
    await draft.finalize();
    this.sessionDrafts.delete(sessionId);
  }
}
```

Replace with:

```typescript
private async finalizeDraft(sessionId: string): Promise<void> {
  const draft = this.sessionDrafts.get(sessionId);
  if (!draft) return;

  const messageId = await draft.finalize();
  this.sessionDrafts.delete(sessionId);

  // Post-finalize: detect actions in assistant responses
  if (sessionId === this.assistantSession?.id && messageId && draft.getBuffer()) {
    const action = detectAction(draft.getBuffer());
    if (action) {
      const actionId = storeAction(action);
      const keyboard = buildActionKeyboard(actionId, action);
      try {
        await this.bot.api.editMessageReplyMarkup(
          this.telegramConfig.chatId,
          messageId,
          { reply_markup: keyboard },
        );
      } catch (err) {
        log.warn({ err }, 'Failed to add action buttons');
      }
    }
  }
}
```

- [ ] **Step 2: Add getBuffer() method to MessageDraft**

In `src/adapters/telegram/streaming.ts`, add a getter for the buffered text:

```typescript
getBuffer(): string {
  return this.buffer
}
```

The `buffer` field is `private buffer: string = ''` — add the getter after the existing methods.

- [ ] **Step 3: Add imports to adapter.ts**

Add to the imports in `adapter.ts`:

```typescript
import { detectAction, storeAction, buildActionKeyboard } from './action-detect.js'
```

- [ ] **Step 4: Verify build**

Run: `pnpm build`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/adapters/telegram/adapter.ts src/adapters/telegram/streaming.ts
git commit -m "feat(adapter): add post-finalize action detection for assistant messages"
```

---

### Task 4: Action Callback Handler

**Files:**
- Modify: `src/adapters/telegram/adapter.ts:133-144` (callback registration in start())

- [ ] **Step 1: Add setupActionCallbacks function**

In `src/adapters/telegram/action-detect.ts`, add the callback handler setup:

```typescript
import type { Bot } from 'grammy'
import type { VibenCore } from '../../core/core.js'
import { executeNewSession, executeCancelSession } from './commands.js'

export function setupActionCallbacks(
  bot: Bot,
  core: VibenCore,
  chatId: number,
  getAssistantSessionId: () => string | undefined,
): void {
  // IMPORTANT: dismiss handler MUST be registered BEFORE generic a: handler
  // because grammY routes to the first matching handler and /^a:/ also matches a:dismiss:
  bot.callbackQuery(/^a:dismiss:/, async (ctx) => {
    const actionId = ctx.callbackQuery.data.replace('a:dismiss:', '')
    removeAction(actionId)
    try {
      await ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } })
    } catch { /* message may be old */ }
    await ctx.answerCallbackQuery({ text: 'Dismissed' })
  })

  bot.callbackQuery(/^a:/, async (ctx) => {
    const actionId = ctx.callbackQuery.data.replace('a:', '')
    const action = getAction(actionId)
    if (!action) {
      await ctx.answerCallbackQuery({ text: 'Action expired' })
      return
    }
    removeAction(actionId)

    try {
      if (action.action === 'new_session') {
        await ctx.answerCallbackQuery({ text: '⏳ Creating session...' })
        const { session, threadId } = await executeNewSession(
          bot, core, chatId, action.agent, action.workspace,
        )
        await ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } })
        // Notify in assistant topic
        const topicLink = `https://t.me/c/${String(chatId).replace('-100', '')}/${threadId}`
        await ctx.editMessageText(
          ctx.callbackQuery.message?.text + `\n\n✅ Session created → <a href="${topicLink}">Go to topic</a>`,
          { parse_mode: 'HTML' },
        )
      } else if (action.action === 'cancel_session') {
        const assistantId = getAssistantSessionId()
        const cancelled = await executeCancelSession(core, assistantId)
        if (cancelled) {
          await ctx.answerCallbackQuery({ text: '⛔ Session cancelled' })
          await ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } })
          await ctx.editMessageText(
            ctx.callbackQuery.message?.text + `\n\n⛔ Session "${cancelled.name || cancelled.id}" cancelled`,
            { parse_mode: 'HTML' },
          )
        } else {
          await ctx.answerCallbackQuery({ text: 'No active sessions running' })
          await ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } })
        }
      }
    } catch (err) {
      await ctx.answerCallbackQuery({ text: '❌ Error, try again later' })
      try {
        await ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } })
      } catch { /* best effort */ }
    }
  })
}
```

- [ ] **Step 2: Register in adapter.ts start()**

In `adapter.ts`, add the action callback registration BEFORE `setupMenuCallbacks` (around line 133):

```typescript
// After setupSkillCallbacks (line 133), add:
setupActionCallbacks(
  this.bot,
  this.core as VibenCore,
  this.telegramConfig.chatId,
  () => this.assistantSession?.id,
)
```

Add import:
```typescript
import { setupActionCallbacks } from './action-detect.js'
```

- [ ] **Step 3: Verify build**

Run: `pnpm build`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/adapters/telegram/action-detect.ts src/adapters/telegram/adapter.ts
git commit -m "feat(action-detect): add callback handler for action confirm/dismiss buttons"
```

---

### Task 5: Final Verification

- [ ] **Step 1: Build**

Run: `pnpm build`
Expected: No errors

- [ ] **Step 2: Run all tests**

Run: `pnpm test -- src/__tests__/action-detect.test.ts`
Expected: All pass

- [ ] **Step 3: End-to-end manual test**

1. Start: `VIBEN_CONFIG_PATH=~/.viben/config2.json pnpm start`
2. Go to Assistant topic in Telegram
3. Type "create a new session with claude" → LLM responds → should see [✅ Create session] [❌ Dismiss] buttons
4. Click ✅ → should create topic and link
5. Type "cancel the session" → should see [⛔ Cancel session] [❌ No] buttons
6. Click ⛔ → should cancel most recent session
7. Click ❌ on any action → should remove buttons only

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: assistant action detection with inline confirm buttons"
```
