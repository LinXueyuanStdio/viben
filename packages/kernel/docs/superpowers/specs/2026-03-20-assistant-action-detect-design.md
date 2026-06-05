# Assistant Action Detection Design

## Problem

In the Assistant topic, users must type Telegram commands (`/new`, `/cancel`) manually to perform actions. The LLM assistant can guide users conversationally but cannot trigger actions. Users expect to chat naturally ("create a session with claude for project abc") and have actions execute without memorizing command syntax.

## Solution

Post-processing middleware in the Telegram adapter that scans assistant responses for action patterns, appends inline confirm/cancel buttons, and executes the action when user confirms.

- Only applies to the Assistant topic — session topics are unaffected
- Only detects side-effect actions: `new_session` and `cancel_session`
- Read-only queries (status, agents, help) are handled by the LLM directly via system prompt knowledge

## Action Detection

### Two Detection Layers

**1. Command pattern (priority)** — Regex detect `/new` and `/cancel` in response text:

- `/new claude ~/project` → `{ action: "new_session", agent: "claude", workspace: "~/project" }`
- `/new claude` → `{ action: "new_session", agent: "claude" }`
- `/new` → `{ action: "new_session" }` (use defaults)
- `/cancel` → `{ action: "cancel_session" }`

**2. Keyword matching (fallback)** — Detect intent when LLM doesn't mention commands. Requires compound phrases to avoid false positives (single words like "cancel" are too ambiguous):

- "tao session" (Vietnamese: create), "create session", "new session" + optional agent/workspace
- "huy session" (Vietnamese: cancel), "cancel session", "dung session" (Vietnamese: stop)

Command pattern takes priority. If both match, use command pattern result.

### DetectedAction Type

```typescript
interface DetectedAction {
  action: "new_session" | "cancel_session"
  agent?: string
  workspace?: string
}
```

## Detection Layer — MessageDraft Post-Processing

Detection runs on the **finalized full text** after `MessageDraft.finalize()`, not on individual streaming chunks. The flow:

1. `MessageDraft.finalize()` sends/edits the final message to Telegram, returns the message ID
2. After finalize, if this is the assistant session, call `detectAction(finalText)`
3. If action detected, **edit the finalized message** to append inline keyboard

This avoids interfering with the streaming buffer and works with the existing `MessageDraft` architecture.

## Button Rendering

When action detected, edit the finalized message to append inline keyboard:

```text
🤖 I'll create a session with agent claude, workspace ~/project!
[✅ Create session] [❌ Dismiss]
```

### Callback Data Format

Prefix `a:` to distinguish from existing prefixes (`m:` menu, `p:` permission, `s:` skill).

Store action payload in `Map<string, DetectedAction>` keyed by nanoid (same pattern as `p:` and `s:` prefixes). Use `a:<nanoid>` as callback data to avoid Telegram's 64-byte `callback_data` limit with long workspace paths.

- Confirm button: `a:<nanoid>`
- Dismiss button: `a:dismiss:<nanoid>`

### Callback Registration Order

The `a:` callback handler must be registered using `bot.callbackQuery(/^a:/)` (regex pattern, not catch-all) and placed BEFORE `permissionHandler.setupCallbackHandler()` in `adapter.ts start()`, since the permission handler uses a catch-all `bot.on('callback_query:data')` that would consume unmatched callbacks.

Registration order in `start()`:
1. `setupSkillCallbacks(bot, core)` — `s:` prefix
2. **`setupActionCallbacks(bot, ...)`** — `a:` prefix (NEW)
3. `setupMenuCallbacks(bot, core, chatId)` — `m:` prefix
4. `permissionHandler.setupCallbackHandler(bot)` — `p:` prefix (catch-all)

### Button Labels

- `new_session` → `[✅ Create session]` + `[❌ Dismiss]`
- `cancel_session` → `[⛔ Cancel session]` + `[❌ No]`

## Action Execution

When user clicks confirm button:

- `a:new_session` → Same logic as `handleNew()` in commands.ts: create topic, call `core.handleNewSession()`, set threadId, persist topicId, rename topic. Edit assistant message to remove buttons and append "✅ Session created".
- `a:cancel_session` → Find the **most recent non-assistant active session** (not by thread ID, since we're in the assistant topic). Call `session.cancel()`. If multiple active sessions exist, cancel the most recently created one. Edit assistant message to confirm.
- `a:dismiss` → Edit message to remove inline keyboard, no action.

Error handling: If action fails (e.g., no active session to cancel, max sessions reached), edit the message to show error and remove buttons.

## Integration Flow

```text
User chat in Assistant topic
  → setupRoutes() routes to handleAssistantMessage()
  → session.enqueuePrompt(text)
  → Agent responds in chunks → MessageDraft buffers
  → MessageDraft.finalize() sends final message to Telegram
  → Post-finalize: is this the assistant session?
    → Yes: detectAction(finalizedText)
      → Action found: store in actionMap, edit message to add inline keyboard
      → No action: done (message already sent)
    → No: done (session topics unchanged)
  → User clicks button → callbackQuery(/^a:/) → lookup actionMap → execute action
```

## Files Changed

- **Create:** `src/adapters/telegram/action-detect.ts` — `detectAction()` function, `DetectedAction` type, action callback map
- **Modify:** `src/adapters/telegram/adapter.ts` — post-finalize hook for assistant messages, register `a:` callback handler
- **Modify:** `src/adapters/telegram/commands.ts` — extract reusable logic from `handleNew`/`handleCancel` into shared functions (e.g., `executeNewSession()`, `executeCancelSession()`)

## Files Not Changed

- Core (`core.ts`, `session-manager.ts`) — no changes
- System prompt — no changes (LLM already suggests commands naturally)
- Session topics — not affected by detection logic
- `MessageDraft` internals — detection runs after finalize, not inside it

## Design Decisions

1. **Adapter-level, not core** — Only Telegram has the Assistant topic concept. If other adapters need this, extract to core later.
2. **Confirm button required** — Never auto-execute. User must click to confirm action. Prevents accidental actions from LLM misunderstanding.
3. **Only side-effect actions** — Status, agents, help are read-only and the LLM can answer from system prompt knowledge. No buttons needed. `newchat` deliberately excluded for v1 — can be added later.
4. **Dual detection** — Command pattern first (reliable), keyword fallback with compound phrases only (natural language, minimizes false positives).
5. **Reuse existing command logic** — Extract `handleNew`/`handleCancel` internals into functions callable from both command handlers and action buttons.
6. **Post-finalize detection** — Runs on full finalized text after `MessageDraft.finalize()`, not on streaming chunks. Avoids interfering with the streaming architecture.
7. **Nanoid callback keys** — Store action payload in Map, use short nanoid in callback data to stay within Telegram's 64-byte limit.
8. **Cancel targets most recent session** — Since assistant topic has no "current session", cancel finds the most recent non-assistant active session.
9. **Callback registration order** — `a:` handler registered before permission catch-all to prevent callback consumption.
