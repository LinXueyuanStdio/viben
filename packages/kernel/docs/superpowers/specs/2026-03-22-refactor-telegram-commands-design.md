# Refactor Telegram Commands

## Problem

`src/adapters/telegram/commands.ts` has grown to 1400 lines / 50KB containing ~30 functions spanning unrelated concerns (session creation, cleanup, admin ops, integrations, menus). This makes navigation and maintenance difficult.

## Decision

Split `commands.ts` into a `commands/` directory with files organized by functional domain.

## Structure

```
src/adapters/telegram/commands/
  index.ts          — setupCommands(), setupAllCallbacks(), re-exports, STATIC_COMMANDS
  new-session.ts    — new session creation flow + state
  session.ts        — session management (status, topics, cancel, cleanup)
  admin.ts          — restart, update, dangerous mode
  menu.ts           — menu keyboard, help, agents, clear, buildSkillMessages
  integrate.ts      — integrate flow + callbacks
```

## File Breakdown

### `index.ts`

Responsibilities:
- `setupCommands(bot, core, chatId, assistant)` — registers all `bot.command()` handlers by importing handler functions from other files
- `setupAllCallbacks(bot, core, chatId, systemTopicIds)` — replaces current `setupMenuCallbacks()`. Calls sub-setup functions from each file, then handles remaining menu dispatch (`m:status`, `m:agents`, `m:help`, etc.) via a single `bot.callbackQuery(/^m:/)` for unhandled menu items
- Re-exports everything that external consumers need (see External API section)
- Exports `STATIC_COMMANDS` array
- Re-export compat alias: `export { setupAllCallbacks as setupMenuCallbacks }`

### `new-session.ts`

Contains:
- `PendingNewSession` interface (internal)
- `pendingNewSessions` Map + `cleanupPending()` + `PENDING_TIMEOUT_MS`
- `handleNew()`, `handleNewChat()`
- `startWorkspaceStep()`, `startConfirmStep()`, `createSessionDirect()`
- `startInteractiveNewSession()`, `handlePendingWorkspaceInput()`
- `executeNewSession()` (exported, used by `action-detect.ts`)
- `botFromCtx()` helper (used by `createSessionDirect` and `handleNewChat`)
- `setupNewSessionCallbacks(bot, core, chatId)` — registers `bot.callbackQuery(/^m:new:/)` for the interactive flow (agent selection, workspace selection, confirm, cancel)

Cross-file dependency: imports `buildDangerousModeKeyboard` from `admin.ts` (used by `createSessionDirect` and `handleNewChat` when creating sessions).

### `session.ts`

Contains:
- `handleCancel()`, `handleStatus()`, `handleTopics()`
- `handleCleanup()`, `handleCleanupEverything()`, `handleCleanupEverythingConfirmed()`
- `executeCancelSession()`
- `setupSessionCallbacks(bot, core, chatId, systemTopicIds)` — registers `bot.callbackQuery(/^m:cleanup/)` handlers

### `admin.ts`

Contains:
- `handleRestart()`, `handleUpdate()`
- `handleEnableDangerous()`, `handleDisableDangerous()`
- `buildDangerousModeKeyboard()` (exported, also used by `new-session.ts`)
- `setupDangerousModeCallbacks(bot, core)` — registers `bot.callbackQuery(/^d:/)` for dangerous mode toggles

### `menu.ts`

Contains:
- `buildMenuKeyboard()`
- `handleMenu()`, `handleHelp()`, `handleAgents()`, `handleClear()`
- `buildSkillMessages()` + `TELEGRAM_MSG_LIMIT` constant

### `integrate.ts`

Contains:
- `handleIntegrate()`
- `buildAgentItemsKeyboard()`
- `setupIntegrateCallbacks(bot, core)` — registers `bot.callbackQuery(/^i:/)` for install/uninstall actions

## Callback Routing Strategy

Each file registers its own callback query handlers with distinct prefixes:
- `new-session.ts`: `bot.callbackQuery(/^m:new:/)` — interactive new session flow
- `session.ts`: `bot.callbackQuery(/^m:cleanup/)` — cleanup actions
- `admin.ts`: `bot.callbackQuery(/^d:/)` — dangerous mode toggles
- `integrate.ts`: `bot.callbackQuery(/^i:/)` — integration install/uninstall actions
- `index.ts`: `bot.callbackQuery(/^m:/)` — remaining menu dispatch (status, agents, help, restart, update, topics, integrate, new). This must be registered LAST since it uses a broad prefix.

Registration order matters for grammY middleware chain. Specific prefixes must be registered before broad ones.

## Types

- `CommandsAssistantContext` — the `AssistantContext` interface in `commands.ts` (lines 11-15: `topicId`, `getSession`, `respawn`) is **different** from the `AssistantContext` in `assistant.ts` (lines 61-66: `config`, `activeSessionCount`, etc.). Rename to `CommandsAssistantContext` and place in `src/adapters/telegram/types.ts` to avoid naming conflict. Used by `new-session.ts`, `session.ts`, and `menu.ts`.
- `PendingNewSession` — stays in `new-session.ts` (internal only)

## Shared Dependencies

Multiple files will import from common modules:
- `escapeHtml` from `../formatting.js`
- `createSessionTopic`, `renameSessionTopic`, `buildDeepLink` from `../topics.js`
- `InlineKeyboard` from `grammy`
- `createChildLogger` from `../../core/log.js`

Each file creates its own logger instance with a descriptive module name (e.g., `telegram-cmd-session`, `telegram-cmd-admin`).

No import cycles: all dependencies flow from leaf files → shared modules. `index.ts` imports from command files but command files never import from `index.ts`.

## External API

Zero breaking changes. `adapter.ts` and `action-detect.ts` import from `./commands.js` which resolves to `commands/index.ts`. All current exports are re-exported from index:

From `adapter.ts`:
- `setupCommands`, `setupMenuCallbacks` (alias for `setupAllCallbacks`), `buildMenuKeyboard`, `buildSkillMessages`, `handlePendingWorkspaceInput`, `STATIC_COMMANDS`, `setupDangerousModeCallbacks`, `setupIntegrateCallbacks`

From `action-detect.ts`:
- `executeNewSession`, `executeCancelSession`, `startInteractiveNewSession`
