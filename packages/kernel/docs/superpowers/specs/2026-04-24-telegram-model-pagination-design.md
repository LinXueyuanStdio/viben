# Telegram /model Pagination Design

**Date:** 2026-04-24
**Issue:** [#235](https://github.com/LinXueyuanStdio/viben/issues/235)

## Problem

The `/model` command fails in Telegram with `400: Bad Request: reply markup is too long` when
an agent exposes many models (e.g. opencode exposes 50+). Every model becomes one row in an
`InlineKeyboard`, and the total serialized markup exceeds Telegram's size limit.

## Root Cause

Two code paths both render the entire model list in a single message with no size check:

1. **Direct command** — user types `/model`: `adapter.ts` → `renderCommandResponse()` →
   `bot.api.sendMessage()` with all buttons.
2. **Menu callback** — user taps the model button in the session control menu:
   `commands/index.ts` `m:` handler → `ctx.reply()` with all buttons.

Both paths bypass Telegram's size limit because the core `CommandResponse` type has no concept
of pagination — it simply exposes a flat `options[]` array.

## Solution

Add `model` to `TELEGRAM_OVERRIDES`. Both code paths check this map before falling through to
generic rendering, so a single Telegram-specific handler covers both entry points.

The handler renders a paginated inline keyboard using the existing `ag:` (agents) pattern as a
reference implementation.

## Architecture

### New file: `src/plugins/telegram/commands/model.ts`

Exports two functions:

```
handleModel(ctx, core): Promise<void>
  — Entry point registered in TELEGRAM_OVERRIDES
  — Resolves session from topicId, calls showModelPage with page 0 and "send" action

showModelPage(ctx, core, page, action: 'send' | 'edit'): Promise<void>
  — Fetches model choices from session config option (category: 'model')
  — Paginates at MODELS_PER_PAGE = 8
  — Builds InlineKeyboard: one model button per row, then Prev/Next nav row
  — Model buttons: callback_data = `c//model <value>` (reuses existing c/ dispatcher)
  — Nav buttons: callback_data = `mod:<page>`
  — Sends new message ('send') or edits existing ('edit')
  — If no active session: replies with error
```

### Changes to `telegram-overrides.ts`

```typescript
model: (ctx, core) => handleModel(ctx, core),
```

### Changes to `commands/index.ts` → `setupAllCallbacks`

Register `mod:` callback handler before the broad `m:` handler:

```typescript
bot.callbackQuery(/^mod:/, async (ctx) => {
  const page = parseInt(ctx.callbackQuery.data.replace('mod:', ''), 10)
  await ctx.answerCallbackQuery()
  await showModelPage(ctx, core, page, 'edit')
})
```

## Data Flow

```
User types /model
  → adapter.ts message:text handler
  → checks TELEGRAM_OVERRIDES['model']
  → handleModel(ctx, core)
  → resolves sessionId from topicId
  → showModelPage(ctx, core, 0, 'send')
  → sends paginated keyboard

User taps ▶ Next
  → mod:1 callback
  → showModelPage(ctx, core, 1, 'edit')
  → edits message in-place

User taps a model button
  → c//model claude-opus-4-7-20250514 callback (existing c/ dispatcher)
  → sets model, returns text response
  → edits message with success text
```

## Keyboard Layout

```
[✅ claude-opus-4-7-20250514]
[claude-sonnet-4-6]
[claude-haiku-4-5]
...
[◀️ Prev]  [Next ▶️]
```

- `✅` prefix on the currently active model
- Nav buttons only rendered when there is a previous/next page
- Page indicator in message title: `Choose a model (current: X) — Page 2/7`

## Constants

| Name | Value | Rationale |
|------|-------|-----------|
| `MODELS_PER_PAGE` | `8` | Leaves headroom for nav row; consistent with agents' 6 per page |
| Callback prefix | `mod:` | Short, namespaced, no collision with existing prefixes |

## Error Handling

- **No active session**: `handleModel` returns early with `ctx.reply('⚠️ No active session.')`
- **Model config not available**: returns `⚠️ This agent does not support switching models.`
- **Stale `mod:` callback** (session ended): `showModelPage` checks session existence, answers
  with `ctx.answerCallbackQuery({ text: 'Session no longer active.' })`

## Files Changed

| File | Change |
|------|--------|
| `src/plugins/telegram/commands/model.ts` | New — `handleModel`, `showModelPage` |
| `src/plugins/telegram/commands/telegram-overrides.ts` | Add `model` entry |
| `src/plugins/telegram/commands/index.ts` | Register `mod:` callback handler |

## Out of Scope

- Discord/Slack adapters — they have different UI primitives and no reported issue
- Pagination for `/mode` or `/thought` — these have far fewer options (< 10) and are not affected
