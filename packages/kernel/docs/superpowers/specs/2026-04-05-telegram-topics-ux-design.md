# Telegram Topics UX Improvements

**Date:** 2026-04-05
**Status:** Approved
**Scope:** `src/plugins/telegram/`, `docs/`

## Problem

When a user sets up the Telegram plugin on a group that does not have Topics enabled (or where the bot lacks the "Manage Topics" admin permission), the bot starts silently, does nothing, and gives no feedback — in the Telegram chat or in logs. The user has no idea what went wrong or how to fix it.

Additionally, the codebase and docs use "supergroup" throughout, which is an internal Telegram API type name that does not appear in the Telegram UI. This confuses users who are not familiar with Telegram internals.

## Goals

1. Replace misleading "supergroup" terminology with user-facing language ("group with Topics enabled").
2. During install (`viben plugin install @viben/telegram`): warn when Topics are not enabled or bot lacks "Manage Topics" permission, provide actionable instructions, and let the user decide whether to proceed.
3. At runtime startup: if prerequisites are not met, send a clear message to the group's General topic, log the issue, then retry silently in the background every 30 seconds. When prerequisites are met, complete initialization and confirm success.

## Out of Scope

- No changes to session topic lifecycle (create, rename, delete).
- No changes to Slack or other adapters.
- No new commands or UI surfaces.

## Terminology Changes

Replace all user-facing occurrences of "supergroup" with appropriate plain language. Internal API type comparisons (`type === 'supergroup'`) remain unchanged because they reflect the Telegram API value.

| Location | Before | After |
|----------|--------|-------|
| `index.ts` install prompt | "Send a message in your Telegram supergroup" | "Send a message in your Telegram group" |
| `index.ts` manual input label | "Supergroup chat ID (e.g. -1001234567890):" | "Group chat ID (e.g. -1001234567890):" |
| `index.ts` fallback manual label | same | same fix |
| `validators.ts` error message | `"Chat is X, must be a supergroup"` | `"Chat must be a group (not a channel or private chat)"` |
| `topics.ts` comment | `// chatId for supergroups starts with -100` | `// chatId for groups starts with -100` |
| `index.ts` plugin description | `'Telegram adapter with forum topics'` | `'Telegram adapter with Topics support'` |
| `docs/gitbook/platform-setup/telegram.md` | "Supergroup with Topics enabled" | "group with Topics enabled" |
| `docs/gitbook/troubleshooting/telegram-issues.md` | "supergroup" references | "group" / "group with Topics enabled" |
| `docs/gitbook/using-viben/chat-commands.md` | "forum topic" | "topic" |
| `README.md` | any "supergroup" references | "group with Topics enabled" |
| `CLAUDE.md` | "Forum topics" | "Topics" |

## Install Flow Changes (`index.ts`)

### isForum check

After `validateChatId()` succeeds, check `chatResult.isForum`:

```
if isForum === false:
  show warning:
    ⚠ Topics are not enabled on this group.
    Viben requires Topics to organize sessions.

    To enable Topics:
    1. Open your group in Telegram
    2. Go to Group Settings → Edit
    3. Enable "Topics"

  ask: "Topics not enabled. Continue anyway? (You can fix this before starting)"
    → Yes: continue install
    → No: exit setup without saving
```

### can_manage_topics check

After `validateBotAdmin()` succeeds (bot is admin), add a new check: does the bot's admin role include `can_manage_topics`?

Extend `validateBotAdmin()` (or add `validateBotTopicsPermission()`) to check the `can_manage_topics` field on the getChatMember result.

```
if can_manage_topics === false:
  show warning:
    ⚠ Bot does not have "Manage Topics" permission.

    To fix:
    1. Open Group Settings → Administrators
    2. Select the bot
    3. Enable "Manage Topics"

  ask: "Bot cannot manage topics. Continue anyway?"
    → Yes: continue install
    → No: exit setup without saving
```

Both warnings can appear in the same install run if both issues exist.

## Runtime Startup Changes (`adapter.ts`)

### New: `checkTopicsPrerequisites()`

A new private method on `TelegramAdapter` that runs the following checks via the Telegram API:

1. `getChat(chatId)` → verify `is_forum === true`
2. `getMe()` + `getChatMember(chatId, botId)` → verify `status === 'administrator' | 'creator'`
3. Same getChatMember result → verify `can_manage_topics === true`

Returns `{ ok: true }` or `{ ok: false; issues: string[] }` where `issues` is a list of human-readable problems.

### Modified: `start()` flow

The `start()` method is split into two phases:

**Phase 1 — always runs (early init):**
- Create bot, DraftManager, SkillManager
- Register middleware (chatId filter, rate-limit handler, allowed_updates)
- Register command handlers and callback handlers (topic-independent)
- Start bot polling
- Run `checkTopicsPrerequisites()`
  - If ok → run Phase 2 immediately
  - If not ok → send setup message to General → start background watcher → return (start() completes)

**Phase 2 — topic-dependent init (runs immediately or via watcher):**
- `ensureTopics()` (with existing retryWithBackoff for transient errors)
- Set `this.notificationTopicId`, `this.assistantTopicId`
- Call `setupMenuCallbacks(...)` with resolved topic IDs (previously called early with undefined IDs — must now be deferred)
- Set up `session:threadReady` and `session:configChanged` event handlers
- Set up routes (`setupRoutes()`)
- Spawn assistant (`assistantManager.spawn(...)`)
- Send welcome message to `assistantTopicId`
- Log "Telegram adapter fully initialized"

**Background watcher loop (only when prerequisites not met):**
- Retry `checkTopicsPrerequisites()` with schedule: 5s, 10s, 30s, then 30s indefinitely
- On each failure: log debug (no spam)
- On success:
  - Run Phase 2
  - Send success message to General: "✅ Viben is ready! System topics have been set up."
  - Cancel watcher

**Watcher cleanup:** The watcher must be cancelled if `stop()` is called while it is still running. Add a `_prerequisiteWatcher` field (e.g., a timeout handle or a cancel flag) that `stop()` clears.

### Handling messages while watcher is running

**Regular messages** (non-command text in topics): silently dropped (log warn). No response is sent.

**Commands** (`/new`, `/status`, etc.): respond with a brief message in the same topic/chat:
```
⏳ Viben is still setting up. Check the General topic for instructions.
```
This avoids silent confusion when a user types a command before setup completes.

**Callback queries** (button clicks): answered with an empty response to dismiss the spinner; no action taken.

### General topic message format

**On failure (sent once at startup):**
```
⚠️ Viben needs setup before it can start.

[for each issue]:
❌ Topics are not enabled on this group.
→ Go to Group Settings → Edit → enable "Topics"

❌ Bot cannot manage topics.
→ In Admin settings, enable "Manage Topics" permission

Viben will automatically retry every 30 seconds.
```

**On success (sent after watcher completes initialization):**
```
✅ Viben is ready!

System topics have been created. Use the 🤖 Assistant topic to get started.
```

## Validators Changes (`validators.ts`)

### `validateBotAdmin()` (or new `validateBotTopicsPermission()`)

Extend the existing function to also return `canManageTopics: boolean` in the success result:

```typescript
{ ok: true; canManageTopics: boolean }
```

This allows the install flow to check both admin status and topics permission in one pass.

Alternatively, if keeping the functions separate is cleaner: add a new `validateBotTopicsPermission(token, chatId)` function that only checks `can_manage_topics`.

Preference: extend `validateBotAdmin()` to return `canManageTopics` in the success case — avoids a second API call since it uses the same getChatMember result.

## Docs Changes

### `docs/gitbook/platform-setup/telegram.md`

- Replace all "Supergroup" / "supergroup" → "group" or "group with Topics enabled" as appropriate.
- Step 2: Remove the sentence "Telegram converts the group to a Supergroup automatically" — replace with a plain note that enabling Topics upgrades the group internally, which is handled automatically by Telegram.
- Add a "Prerequisites" checklist before Step 1:
  1. A Telegram group (any size)
  2. Topics enabled (Group Settings → Edit → Topics)
  3. Bot added as admin with "Manage Topics" permission
- Step 6 "Expected output": update log lines to match new startup flow; add a note that if prerequisites are not met, Viben will send instructions to the group's General topic and retry automatically.
- Step 5 config format: the doc currently shows the old `channels.telegram.*` config path. Add a note clarifying that running `viben` or `viben plugin install @viben/telegram` is the recommended setup method and the config is stored in plugin settings, not main config.
- Troubleshooting section at bottom: update "Chat is not a supergroup" entry to match new terminology and behavior.

### `docs/gitbook/troubleshooting/telegram-issues.md`

- Replace all "supergroup" occurrences with "group" (keep "negative number starting with -100" note unchanged — that is a factual description).
- **Rewrite** the "Topics are not created on startup" section:
  - Old: lists manual steps to diagnose.
  - New: explain that Viben now detects this automatically at startup, sends a message to the group's General topic with exact instructions, and retries every 30 seconds. User just needs to follow the instructions in the group.
- **Add** new entry: "Bot cannot manage topics" — symptoms, cause, and the fix (enable "Manage Topics" in admin settings).
- Update "Not enough rights" entry: remove the "Convert to Supergroup" step; replace with "Enable Topics in Group Settings → Edit → Topics".

### `docs/gitbook/using-viben/chat-commands.md`

- Replace "forum topic" with "topic" (minor).

### `README.md`

- Update any "supergroup" references to "group with Topics enabled".

### `CLAUDE.md` (project root)

- Update "Forum topics (Telegram)" → "Topics (Telegram)" in the adapter patterns section.

## Error Detection

Detecting "Topics not enabled" from Telegram API errors:

When `createForumTopic` is called on a non-forum group, Telegram returns:
```json
{ "ok": false, "error_code": 400, "description": "Bad Request: method is available for supergroups only" }
```
or
```json
{ "ok": false, "error_code": 400, "description": "Bad Request: TOPIC_DISABLED" }
```

`checkTopicsPrerequisites()` uses `getChat()` to avoid this — it detects the problem before attempting to create topics. So runtime error detection in `ensureTopics()` is only a fallback.

## Files to Change

| File | Change type |
|------|-------------|
| `src/plugins/telegram/index.ts` | Add isForum + can_manage_topics warnings in install(); fix "supergroup" terminology in prompts |
| `src/plugins/telegram/validators.ts` | Extend validateBotAdmin() to return canManageTopics; fix error message terminology |
| `src/plugins/telegram/adapter.ts` | Split start() into Phase 1/2; add checkTopicsPrerequisites(); background watcher; command guard; stop() watcher cleanup |
| `src/plugins/telegram/topics.ts` | Fix comment terminology |
| `docs/gitbook/platform-setup/telegram.md` | Terminology + prerequisites section + updated startup behavior note |
| `docs/gitbook/troubleshooting/telegram-issues.md` | Terminology + rewrite "Topics not created" + add "Bot cannot manage topics" entry |
| `docs/gitbook/using-viben/chat-commands.md` | Minor terminology ("forum topic" → "topic") |
| `README.md` | Terminology |
| `CLAUDE.md` | Terminology ("Forum topics" → "Topics") |
