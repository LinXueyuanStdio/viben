# Telegram Custom Path Wizard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace AI-assistant delegation for the "Custom path" button in the Telegram new-session wizard with a Force Reply flow that validates the workspace path immediately using pure logic.

**Architecture:** When a user clicks "Custom path", the bot sends a Telegram Force Reply message (which auto-opens a reply box in the user's app). When the user replies, the path is validated with `core.configManager.resolveWorkspace()`. On error, an error message is shown and a new Force Reply is sent. On success, `createSessionDirect()` is called. State is tracked in a module-level Map keyed by the Force Reply message ID, with a 10-minute TTL.

**Tech Stack:** TypeScript, grammY (Telegram bot framework), Vitest

---

## File Structure

| File | Change |
|---|---|
| `src/plugins/telegram/commands/new-session.ts` | Add `forceReplyMap` state, `sendCustomPathPrompt()`, `handleCustomPathReply()`, replace `ns:custom:` body, register `message:text` interceptor |
| `src/plugins/telegram/commands/__tests__/custom-path-wizard.test.ts` | New: unit tests for the wizard logic |

---

### Task 1: Write failing tests for force-reply state management

**Files:**
- Create: `src/plugins/telegram/commands/__tests__/custom-path-wizard.test.ts`

- [ ] **Step 1: Create the test file**

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// We will import these once they are exported from new-session.ts in Task 2
import {
  _forceReplyMap,
  _pruneExpiredForceReplies,
  _handleCustomPathReply,
  _sendCustomPathPrompt,
} from "../new-session.js";

// ── Helpers ──────────────────────────────────────────────────────────

function makeCtx(overrides: Partial<{
  messageId: number;
  replyToMessageId: number | undefined;
  text: string;
  threadId: number | undefined;
  chatId: number;
}> = {}) {
  const opts = {
    messageId: 1,
    replyToMessageId: undefined,
    text: "~/my-project",
    threadId: undefined,
    chatId: 42,
    ...overrides,
  };

  const ctx = {
    message: {
      message_id: opts.messageId,
      text: opts.text,
      message_thread_id: opts.threadId,
      reply_to_message: opts.replyToMessageId
        ? { message_id: opts.replyToMessageId }
        : undefined,
    },
    callbackQuery: undefined,
    from: { id: 1 },
    api: {
      // Full mock of Telegram API methods used by createSessionDirect
      sendMessage: vi.fn().mockResolvedValue({ message_id: 100 }),
      createForumTopic: vi.fn().mockResolvedValue({ message_thread_id: 99 }),
      editForumTopic: vi.fn().mockResolvedValue({}),
      deleteForumTopic: vi.fn().mockResolvedValue({}),
    },
    reply: vi.fn().mockResolvedValue({ message_id: 200 }),
  };

  return ctx as unknown as import("grammy").Context;
}

function makeCore(overrides: { resolveWorkspace?: (input?: string) => string } = {}) {
  return {
    configManager: {
      resolveWorkspace: vi.fn((input?: string) => {
        if (overrides.resolveWorkspace) return overrides.resolveWorkspace(input);
        // Default: expand ~/my-project to absolute path
        if (input?.startsWith("~/")) return `/home/user/${input.slice(2)}`;
        if (input?.startsWith("/")) return input;
        if (/^[a-z0-9_-]+$/i.test(input ?? "")) return `/home/user/viben-workspace/${input}`;
        throw new Error(`Invalid workspace name: "${input}". Only alphanumeric characters, hyphens, and underscores are allowed.`);
      }),
    },
    handleNewSession: vi.fn().mockResolvedValue({
      id: "sess-1",
      agentName: "claude",
      workingDirectory: "/home/user/my-project",
    }),
  } as unknown as import("../../../../core/index.js").VibenCore;
}

// ── Tests ──────────────────────────────────────────────────────────

describe("forceReplyMap TTL pruning", () => {
  beforeEach(() => _forceReplyMap.clear());

  it("prunes entries older than 10 minutes", () => {
    const OLD = Date.now() - 11 * 60 * 1000;
    const FRESH = Date.now() - 1 * 60 * 1000;
    _forceReplyMap.set(1, { agentKey: "claude", chatId: 42, createdAt: OLD });
    _forceReplyMap.set(2, { agentKey: "gemini", chatId: 42, createdAt: FRESH });

    _pruneExpiredForceReplies();

    expect(_forceReplyMap.has(1)).toBe(false);
    expect(_forceReplyMap.has(2)).toBe(true);
  });

  it("leaves empty map intact", () => {
    _pruneExpiredForceReplies();
    expect(_forceReplyMap.size).toBe(0);
  });
});

describe("_sendCustomPathPrompt", () => {
  beforeEach(() => _forceReplyMap.clear());

  it("sends a force_reply message and stores entry in forceReplyMap", async () => {
    const ctx = makeCtx({ chatId: 42, threadId: 5 });

    await _sendCustomPathPrompt(ctx, 42, "claude");

    expect(ctx.api.sendMessage).toHaveBeenCalledOnce();
    const [callChatId, callText, callOpts] = (ctx.api.sendMessage as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(callChatId).toBe(42);
    expect(callText).toContain("workspace path");
    expect((callOpts as any).reply_markup).toEqual({ force_reply: true, selective: true });
    expect((callOpts as any).message_thread_id).toBe(5);

    // Entry stored in map
    expect(_forceReplyMap.size).toBe(1);
    const entry = [..._forceReplyMap.values()][0];
    expect(entry.agentKey).toBe("claude");
    expect(entry.chatId).toBe(42);
    expect(entry.createdAt).toBeGreaterThan(0);
  });

  it("sends without thread_id when not in a topic", async () => {
    const ctx = makeCtx({ chatId: 42, threadId: undefined });

    await _sendCustomPathPrompt(ctx, 42, "claude");

    const callOpts = (ctx.api.sendMessage as ReturnType<typeof vi.fn>).mock.calls[0][2];
    expect((callOpts as any).message_thread_id).toBeUndefined();
  });
});

describe("_handleCustomPathReply", () => {
  beforeEach(() => _forceReplyMap.clear());

  it("calls resolveWorkspace and does not send error reply on valid input", async () => {
    const ctx = makeCtx({ text: "~/my-project", chatId: 42 });
    const core = makeCore();
    const entry = { agentKey: "claude", chatId: 42, createdAt: Date.now() };

    await _handleCustomPathReply(ctx, core, 42, entry);

    // resolveWorkspace was called with trimmed input
    expect(core.configManager.resolveWorkspace).toHaveBeenCalledWith("~/my-project");
    // No error reply sent
    const replyArg = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string | undefined;
    expect(replyArg).not.toContain("❌");
  });

  it("shows error and sends new force_reply on invalid path", async () => {
    const ctx = makeCtx({ text: "bad path!", chatId: 42 });
    const core = makeCore({
      resolveWorkspace: () => { throw new Error('Invalid workspace name: "bad path!". Only alphanumeric characters, hyphens, and underscores are allowed.'); },
    });
    const entry = { agentKey: "claude", chatId: 42, createdAt: Date.now() };

    await _handleCustomPathReply(ctx, core, 42, entry);

    // Should show error
    expect(ctx.reply).toHaveBeenCalledOnce();
    const errorText = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(errorText).toContain("❌");
    expect(errorText).toContain("Invalid workspace name");

    // Should send new force_reply
    expect(ctx.api.sendMessage).toHaveBeenCalledOnce();
    const sendOpts = (ctx.api.sendMessage as ReturnType<typeof vi.fn>).mock.calls[0][2];
    expect((sendOpts as any).reply_markup).toEqual({ force_reply: true, selective: true });

    // New entry stored in map
    expect(_forceReplyMap.size).toBe(1);
  });

  it("does NOT call ctx.api.createForumTopic on invalid path", async () => {
    const ctx = makeCtx({ text: "bad path!", chatId: 42 });
    const core = makeCore({
      resolveWorkspace: () => { throw new Error("Workspace path does not exist."); },
    });
    const entry = { agentKey: "claude", chatId: 42, createdAt: Date.now() };

    await _handleCustomPathReply(ctx, core, 42, entry);

    // createSessionDirect was never reached (no forum topic created)
    expect((ctx.api as any).createForumTopic).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail (module not found)**

```bash
cd /Users/lucas/code/viben-workspace/Viben
pnpm test src/plugins/telegram/commands/__tests__/custom-path-wizard.test.ts 2>&1 | head -30
```

Expected: FAIL — `_forceReplyMap`, `_pruneExpiredForceReplies`, etc. are not exported from `new-session.ts`

---

### Task 2: Add state and helper functions to `new-session.ts`

**Files:**
- Modify: `src/plugins/telegram/commands/new-session.ts`

- [ ] **Step 1: Add `ForceReplyEntry` interface and `forceReplyMap` state after the existing `workspaceCache` block (after line ~226)**

Insert after `let nextWsId = 0` (line 206), before `function cacheWorkspace`:

```typescript
// --- Force Reply state for custom path input ---

interface ForceReplyEntry {
  agentKey: string;
  chatId: number;
  createdAt: number; // ms timestamp, for TTL
}

export const _forceReplyMap = new Map<number, ForceReplyEntry>();

export function _pruneExpiredForceReplies(): void {
  const cutoff = Date.now() - 10 * 60 * 1000;
  for (const [msgId, entry] of _forceReplyMap) {
    if (entry.createdAt < cutoff) _forceReplyMap.delete(msgId);
  }
}
```

- [ ] **Step 2: Add `_sendCustomPathPrompt()` function after `_pruneExpiredForceReplies`**

```typescript
export async function _sendCustomPathPrompt(
  ctx: Context,
  chatId: number,
  agentKey: string,
): Promise<void> {
  const threadId =
    ctx.message?.message_thread_id ??
    (ctx as Context & { callbackQuery?: { message?: { message_thread_id?: number } } })
      .callbackQuery?.message?.message_thread_id;

  const sent = await ctx.api.sendMessage(
    chatId,
    `Please type the workspace path.\n\n` +
      `Examples:\n` +
      `• <code>/absolute/path/to/project</code>\n` +
      `• <code>~/my-project</code>\n` +
      `• <code>project-name</code> (created under your base directory)\n\n` +
      `Reply to this message with your path.`,
    {
      parse_mode: 'HTML',
      reply_markup: { force_reply: true, selective: true },
      ...(threadId !== undefined ? { message_thread_id: threadId } : {}),
    },
  );
  _forceReplyMap.set(sent.message_id, { agentKey, chatId, createdAt: Date.now() });
}
```

- [ ] **Step 3: Add `_handleCustomPathReply()` function after `_sendCustomPathPrompt`**

```typescript
export async function _handleCustomPathReply(
  ctx: Context,
  core: VibenCore,
  chatId: number,
  entry: ForceReplyEntry,
): Promise<void> {
  const input = ctx.message!.text.trim();

  let resolvedPath: string;
  try {
    resolvedPath = core.configManager.resolveWorkspace(input);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await ctx.reply(`❌ ${escapeHtml(message)}\n\nPlease try again:`, {
      parse_mode: 'HTML',
    }).catch(() => {});
    await _sendCustomPathPrompt(ctx, chatId, entry.agentKey);
    return;
  }

  await createSessionDirect(ctx, core, chatId, entry.agentKey, resolvedPath);
}
```

- [ ] **Step 4: Run the tests — they should now pass**

```bash
cd /Users/lucas/code/viben-workspace/Viben
pnpm test src/plugins/telegram/commands/__tests__/custom-path-wizard.test.ts
```

Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/lucas/code/viben-workspace/Viben
git add src/plugins/telegram/commands/new-session.ts src/plugins/telegram/commands/__tests__/custom-path-wizard.test.ts
git commit -m "feat: add force-reply state helpers for telegram custom path wizard"
```

---

### Task 3: Replace `ns:custom:` callback body with Force Reply

**Files:**
- Modify: `src/plugins/telegram/commands/new-session.ts` lines 373–398

- [ ] **Step 1: Replace the `ns:custom:` callback handler body**

Find this block in `setupNewSessionCallbacks` (currently lines 373–398):

```typescript
  bot.callbackQuery(/^ns:custom:/, async (ctx) => {
    const agentKey = ctx.callbackQuery.data.replace('ns:custom:', '')
    try { await ctx.answerCallbackQuery() } catch { /* expired */ }

    const assistant = getAssistantSession?.()
    if (assistant) {
      try {
        await ctx.editMessageText(
          `<b>🆕 New Session</b>\n` +
          `Agent: <code>${escapeHtml(agentKey)}</code>\n\n` +
          `💬 Type your workspace path in the chat below.`,
          { parse_mode: 'HTML' },
        )
      } catch { /* ignore */ }
      await assistant.enqueuePrompt(
        `User wants to create a new session with agent "${agentKey}". Ask them for the workspace (project directory) path, then create the session.`
      )
    } else {
      try {
        await ctx.editMessageText(
          `Usage: <code>/new ${escapeHtml(agentKey)} &lt;workspace-path&gt;</code>`,
          { parse_mode: 'HTML' },
        )
      } catch { /* ignore */ }
    }
  })
```

Replace with:

```typescript
  bot.callbackQuery(/^ns:custom:/, async (ctx) => {
    const agentKey = ctx.callbackQuery.data.replace('ns:custom:', '')
    try { await ctx.answerCallbackQuery() } catch { /* expired */ }

    // Remove inline keyboard from wizard message so user can't click stale buttons
    try {
      await ctx.editMessageText(
        `<b>🆕 New Session</b>\n` +
        `Agent: <code>${escapeHtml(agentKey)}</code>\n\n` +
        `⌨️ Waiting for workspace path...`,
        { parse_mode: 'HTML' },
      )
    } catch { /* ignore */ }

    await _sendCustomPathPrompt(ctx, chatId, agentKey)
  })
```

- [ ] **Step 2: Build to verify no type errors**

```bash
cd /Users/lucas/code/viben-workspace/Viben
pnpm build 2>&1 | tail -20
```

Expected: build succeeds with no errors

- [ ] **Step 3: Run all tests**

```bash
cd /Users/lucas/code/viben-workspace/Viben
pnpm test
```

Expected: all tests pass

- [ ] **Step 4: Commit**

```bash
cd /Users/lucas/code/viben-workspace/Viben
git add src/plugins/telegram/commands/new-session.ts
git commit -m "feat: replace ns:custom AI delegation with force-reply path input"
```

---

### Task 4: Register force-reply interceptor in `setupNewSessionCallbacks`

**Files:**
- Modify: `src/plugins/telegram/commands/new-session.ts`

The interceptor must be registered **inside `setupNewSessionCallbacks`** so it runs before the terminal `setupRoutes()` message handler in `adapter.ts`. It intercepts `message:text` events where the message is a reply to a known force-reply message, processes the path, and calls `next()` otherwise.

- [ ] **Step 1: Add `bot.on("message:text")` interceptor at the top of `setupNewSessionCallbacks`**

Insert as the **first** handler inside `setupNewSessionCallbacks` (before the `bot.callbackQuery('ns:start', ...)` line):

```typescript
  // Intercept replies to force-reply messages (custom path input)
  bot.on("message:text", async (ctx, next) => {
    _pruneExpiredForceReplies()
    const replyToId = ctx.message.reply_to_message?.message_id
    if (replyToId === undefined) return next()
    const entry = _forceReplyMap.get(replyToId)
    if (!entry) return next()
    _forceReplyMap.delete(replyToId)
    await _handleCustomPathReply(ctx, core, chatId, entry)
  })
```

- [ ] **Step 2: Build to verify no type errors**

```bash
cd /Users/lucas/code/viben-workspace/Viben
pnpm build 2>&1 | tail -20
```

Expected: build succeeds

- [ ] **Step 3: Run all tests**

```bash
cd /Users/lucas/code/viben-workspace/Viben
pnpm test
```

Expected: all tests pass

- [ ] **Step 4: Commit**

```bash
cd /Users/lucas/code/viben-workspace/Viben
git add src/plugins/telegram/commands/new-session.ts
git commit -m "feat: register force-reply interceptor for custom path wizard"
```

---

### Task 5: Remove `getAssistantSession` parameter dependency from `setupNewSessionCallbacks`

The `getAssistantSession` parameter in `setupNewSessionCallbacks` was only used by the `ns:custom:` callback body (now replaced). Clean it up to keep the signature lean.

**Files:**
- Modify: `src/plugins/telegram/commands/new-session.ts`
- Modify: `src/plugins/telegram/commands/index.ts` (call site)

- [ ] **Step 1: Check if `getAssistantSession` is used anywhere else in `setupNewSessionCallbacks`**

```bash
grep -n "getAssistantSession\|assistant\." /Users/lucas/code/viben-workspace/Viben/src/plugins/telegram/commands/new-session.ts
```

Expected: the only usage was in the old `ns:custom:` body. If any other usages appear, skip this task.

- [ ] **Step 2: Remove `getAssistantSession` parameter from `setupNewSessionCallbacks` (only if Step 1 confirms no other usage)**

Change the function signature from:

```typescript
export function setupNewSessionCallbacks(
  bot: Bot,
  core: VibenCore,
  chatId: number,
  getAssistantSession?: () => { topicId: number; enqueuePrompt: (p: string) => Promise<string> } | undefined,
): void {
```

To:

```typescript
export function setupNewSessionCallbacks(
  bot: Bot,
  core: VibenCore,
  chatId: number,
): void {
```

- [ ] **Step 3: Update the call site in `commands/index.ts`**

In `setupAllCallbacks`, change:

```typescript
  setupNewSessionCallbacks(bot, core, chatId, getAssistantSession);
```

To:

```typescript
  setupNewSessionCallbacks(bot, core, chatId);
```

- [ ] **Step 4: Update the import in `commands/index.ts` if `getAssistantSession` type is no longer needed there**

The `getAssistantSession` parameter in `setupAllCallbacks` itself is still used by other handlers (e.g., `setupSettingsCallbacks`), so leave the outer signature intact.

- [ ] **Step 5: Build to verify no type errors**

```bash
cd /Users/lucas/code/viben-workspace/Viben
pnpm build 2>&1 | tail -20
```

Expected: build succeeds

- [ ] **Step 6: Run all tests**

```bash
cd /Users/lucas/code/viben-workspace/Viben
pnpm test
```

Expected: all tests pass

- [ ] **Step 7: Commit**

```bash
cd /Users/lucas/code/viben-workspace/Viben
git add src/plugins/telegram/commands/new-session.ts src/plugins/telegram/commands/index.ts
git commit -m "refactor: remove getAssistantSession param from setupNewSessionCallbacks"
```
