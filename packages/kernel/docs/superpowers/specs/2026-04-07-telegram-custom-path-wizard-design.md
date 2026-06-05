# Design: Telegram Custom Path Wizard (No-AI Path Input)

**Date:** 2026-04-07
**Scope:** `src/plugins/telegram/commands/new-session.ts`

## Problem

When a user clicks "Custom path" in the Telegram new-session wizard, the current flow delegates to the AI assistant to collect the workspace path via natural language conversation. This is slow (waiting for AI to think and respond) and error-prone (AI may misinterpret the path or fail to validate correctly).

## Goal

Replace AI delegation for the custom path step with pure logic: bot prompts user via Telegram's Force Reply feature, user types path, bot validates immediately using existing `resolveWorkspace()`, and shows a specific error message on failure with an opportunity to retry.

## Scope

- **In scope:** Telegram adapter only — `src/plugins/telegram/commands/new-session.ts`
- **Out of scope:** Generic command handler (`session.ts` core), Slack adapter, other adapters

## Design

### State Structure

A module-level Map tracks pending force-reply sessions:

```typescript
interface ForceReplyEntry {
  agentKey: string;
  chatId: number;
  createdAt: number; // ms timestamp for TTL
}

const forceReplyMap = new Map<number, ForceReplyEntry>();
// key = message_id of the bot's force_reply message
```

**TTL:** 10 minutes. Entries are pruned lazily on each access (no background timer needed).

### Flow

#### Step 1: User clicks "Custom path" button (`ns:custom:<agentKey>`)

1. `ctx.answerCallbackQuery()`
2. Bot sends a new message with `force_reply: true` and `selective: true`:
   ```
   Please type the workspace path.

   Examples:
   • /absolute/path/to/project
   • ~/my-project
   • project-name (created under your base directory)

   Reply to this message with your path.
   ```
3. Store: `forceReplyMap.set(sentMsg.message_id, { agentKey, chatId, createdAt: Date.now() })`
4. Edit the original wizard message to remove the inline keyboard (avoids stale buttons)

#### Step 2: User sends a reply

A `bot.on("message:text")` handler (registered in Telegram plugin setup) intercepts all text messages:

1. Check `ctx.message.reply_to_message?.message_id`
2. If not in `forceReplyMap` → not a path reply, ignore (let normal message handling continue)
3. If found:
   - Prune expired entries (older than 10 min)
   - Validate the entry is still present and not expired
   - Delete entry from map
   - Call `configManager.resolveWorkspace(ctx.message.text.trim())`

#### Step 3a: Validation success

- Call `createSessionDirect(agentKey, resolvedPath, ctx, core)`
- Session created, topic thread opened as normal

#### Step 3b: Validation error

- Send error message: `❌ <specific error from resolveWorkspace()>\n\nPlease try again:`
- Send a new force_reply message (same template as Step 1)
- `forceReplyMap.set(newMsg.message_id, { agentKey, chatId, createdAt: Date.now() })`

### Handler Registration

The message text handler must run **before** the default message handler (which would route messages to existing sessions). Register it early in the Telegram plugin setup with a filter:

```typescript
bot.on("message:text", async (ctx, next) => {
  const replyToId = ctx.message.reply_to_message?.message_id;
  if (!replyToId || !forceReplyMap.has(replyToId)) {
    return next(); // not a path reply, pass through
  }
  await handleCustomPathReply(ctx, core, configManager);
});
```

### Error Messages

Map `resolveWorkspace()` error messages to user-friendly text:

| Error condition | Message shown |
|---|---|
| Path outside base dir, external not allowed | `Path is outside your workspace directory. Enable external workspaces in config, or use a relative name.` |
| External path does not exist | `Path does not exist: <path>. Create the directory first, then try again.` |
| Invalid workspace name (bad chars) | `Invalid name "<input>". Use only letters, numbers, hyphens, and underscores.` |

### TTL Cleanup

```typescript
function pruneExpired(): void {
  const cutoff = Date.now() - 10 * 60 * 1000;
  for (const [msgId, entry] of forceReplyMap) {
    if (entry.createdAt < cutoff) forceReplyMap.delete(msgId);
  }
}
```

Called at the start of the message:text handler before looking up the entry.

## Files Changed

| File | Change |
|---|---|
| `src/plugins/telegram/commands/new-session.ts` | Replace `ns:custom:` AI delegation with `sendForceReply()` + `handleCustomPathReply()` |
| `src/plugins/telegram/index.ts` (or bot setup file) | Register `bot.on("message:text")` handler for force-reply interception |

## What Is Not Changed

- `resolveWorkspace()` in `config.ts` — used as-is
- `createSessionDirect()` — used as-is
- Agent picker and workspace picker steps — unchanged
- Core session command handler (`session.ts`) — out of scope
