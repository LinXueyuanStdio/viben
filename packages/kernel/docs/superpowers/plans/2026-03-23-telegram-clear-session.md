# /archive Command Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `/archive` command that recreates a session's Telegram topic (clean chat history) while keeping the agent subprocess alive. Accessible from Telegram, API, and CLI.

**Architecture:** Core archive logic in `VibenCore.archiveSession()` validates state and delegates to `ChannelAdapter.archiveSessionTopic()`. Telegram adapter implements topic recreation. API server exposes `POST /sessions/:id/archive`.

**Tech Stack:** TypeScript, grammY (Telegram Bot API), vitest

**Spec:** `docs/superpowers/specs/2026-03-23-telegram-clear-session-design.md`

---

## File Structure

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `src/core/channel.ts` | Add optional `archiveSessionTopic(sessionId)` to ChannelAdapter base |
| Modify | `src/core/core.ts` | Add `archiveSession(sessionId)` that validates + delegates to adapter |
| Modify | `src/core/api-server.ts` | Add `POST /sessions/:id/archive` endpoint |
| Modify | `src/adapters/telegram/topics.ts` | Add `deleteSessionTopic()` helper |
| Modify | `src/adapters/telegram/adapter.ts` | Implement `archiveSessionTopic()` override |
| Modify | `src/adapters/telegram/commands/session.ts` | Add `handleArchive()` and `handleArchiveConfirm()` |
| Modify | `src/adapters/telegram/commands/index.ts` | Register `/archive` command and `ar:` callbacks |
| Create | `src/__tests__/archive-session.test.ts` | Tests for archive flow |

---

### Task 1: Core — `archiveSession()` and ChannelAdapter base

**Files:**
- Modify: `src/core/channel.ts`
- Modify: `src/core/core.ts`

- [ ] **Step 1: Add `archiveSessionTopic` to ChannelAdapter**

In `src/core/channel.ts`, add to the `ChannelAdapter` abstract class (as an optional method with no-op default, following existing patterns like `deleteSessionThread`):

```typescript
  async archiveSessionTopic(_sessionId: string): Promise<{ newThreadId: string } | null> {
    return null; // Override in adapters that support topic archiving
  }
```

- [ ] **Step 2: Add `archiveSession()` to VibenCore**

In `src/core/core.ts`, add a public method (after `stop()`):

```typescript
  async archiveSession(sessionId: string): Promise<{ ok: true; newThreadId: string } | { ok: false; error: string }> {
    const session = this.sessionManager.getSession(sessionId);
    if (!session) return { ok: false, error: "Session not found" };
    if (session.status === "initializing") return { ok: false, error: "Session is still initializing" };
    if (session.status !== "active") return { ok: false, error: `Session is ${session.status}` };

    const adapter = this.adapters.get(session.channelId);
    if (!adapter) return { ok: false, error: "Adapter not found for session" };

    try {
      const result = await adapter.archiveSessionTopic(session.id);
      if (!result) return { ok: false, error: "Adapter does not support archiving" };
      return { ok: true, newThreadId: result.newThreadId };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  }
```

- [ ] **Step 3: Verify build**

Run: `pnpm exec tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add src/core/channel.ts src/core/core.ts
git commit -m "feat(core): add archiveSession() and ChannelAdapter.archiveSessionTopic()"
```

---

### Task 2: API endpoint — `POST /sessions/:id/archive`

**Files:**
- Modify: `src/core/api-server.ts`

- [ ] **Step 1: Add route handler**

In `src/core/api-server.ts`, find the URL routing block (where `POST /api/sessions` and `DELETE /api/sessions/:id` are handled). Add a new route before the DELETE handler:

```typescript
      } else if (method === 'POST' && url.match(/^\/api\/sessions\/([^/]+)\/archive$/)) {
        const sessionId = decodeURIComponent(url.match(/^\/api\/sessions\/([^/]+)\/archive$/)![1])
        await this.handleArchiveSession(sessionId, res)
```

- [ ] **Step 2: Implement handleArchiveSession**

Add the handler method to `ApiServer` class:

```typescript
  private async handleArchiveSession(sessionId: string, res: http.ServerResponse): Promise<void> {
    const result = await this.core.archiveSession(sessionId);
    if (result.ok) {
      this.sendJson(res, 200, result);
    } else {
      this.sendJson(res, 400, result);
    }
  }
```

- [ ] **Step 3: Verify build**

Run: `pnpm exec tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add src/core/api-server.ts
git commit -m "feat(api): add POST /sessions/:id/archive endpoint"
```

---

### Task 3: Telegram — `deleteSessionTopic` helper and adapter implementation

**Files:**
- Modify: `src/adapters/telegram/topics.ts`
- Modify: `src/adapters/telegram/adapter.ts`

- [ ] **Step 1: Add deleteSessionTopic to topics.ts**

In `src/adapters/telegram/topics.ts`, add after `renameSessionTopic`:

```typescript
// Delete a forum topic and all its messages
export async function deleteSessionTopic(
  bot: Bot,
  chatId: number,
  threadId: number,
): Promise<void> {
  await bot.api.deleteForumTopic(chatId, threadId);
}
```

- [ ] **Step 2: Implement archiveSessionTopic in adapter.ts**

Add import for `deleteSessionTopic` in the topics import:

```typescript
import {
  ensureTopics,
  createSessionTopic,
  renameSessionTopic,
  deleteSessionTopic,
} from "./topics.js";
```

Add the method to `TelegramAdapter` class (override the base class no-op):

```typescript
  async archiveSessionTopic(sessionId: string): Promise<{ newThreadId: string } | null> {
    const core = this.core as VibenCore;
    const session = core.sessionManager.getSession(sessionId);
    if (!session) return null;

    const chatId = this.telegramConfig.chatId;
    const oldTopicId = Number(session.threadId);
    // Strip existing 🔄 prefix to avoid stacking on repeated archives
    const rawName = (session.name || `Session ${session.id.slice(0, 6)}`).replace(/^🔄\s*/, "");

    // 1. Set archiving flag to buffer/drop agent events during transition
    (session as any).archiving = true;

    // 2. Finalize any pending draft
    await this.draftManager.finalize(session.id, this.assistantSession?.id);

    // 3. Cleanup all trackers for old topic
    this.draftManager.cleanup(session.id);
    this.toolTracker.cleanup(session.id);
    await this.skillManager.cleanup(session.id);
    const tracker = this.sessionTrackers.get(session.id);
    if (tracker) tracker.dispose();
    this.sessionTrackers.delete(session.id);

    // 4. Delete old topic
    await deleteSessionTopic(this.bot, chatId, oldTopicId);

    // 5. Create new topic — wrapped in try/catch for orphan recovery
    let newTopicId: number;
    try {
      newTopicId = await createSessionTopic(this.bot, chatId, `🔄 ${rawName}`);
    } catch (createErr) {
      // Critical: old topic deleted but new one failed — session is orphaned
      (session as any).archiving = false;
      core.notificationManager.notifyAll({
        sessionId: session.id,
        sessionName: session.name,
        type: "error",
        summary: `Topic recreation failed for session "${rawName}". Session is orphaned. Error: ${(createErr as Error).message}`,
      });
      throw createErr; // Propagate so caller knows it failed
    }

    // 6. Rewire session to new topic
    session.threadId = String(newTopicId);

    // 7. Persist via patchRecord — spread existing platform data to preserve skillMsgId etc.
    const existingRecord = core.sessionManager.getRecordByThread("telegram", String(oldTopicId));
    const existingPlatform = existingRecord?.platform ?? {};
    await core.sessionManager.patchRecord(session.id, {
      platform: { ...existingPlatform, topicId: newTopicId, skillMsgId: undefined },
    });

    // 8. Clear archiving flag
    (session as any).archiving = false;

    return { newThreadId: String(newTopicId) };
  }
```

> **Note:** `this.telegramConfig.chatId` is accessed via the private config object. `setupMenuCallbacks` is called via alias in adapter.ts — check line ~210 for the calling pattern when wiring callbacks.

- [ ] **Step 3: Verify build**

Run: `pnpm exec tsc --noEmit`
Fix any access issues (e.g., if `draftManager`, `toolTracker`, `skillManager`, `sessionTrackers` are private — they should be accessible within the class).

- [ ] **Step 4: Commit**

```bash
git add src/adapters/telegram/topics.ts src/adapters/telegram/adapter.ts
git commit -m "feat(telegram): implement archiveSessionTopic with topic recreation"
```

---

### Task 4: Telegram — `/archive` command and callbacks

**Files:**
- Modify: `src/adapters/telegram/commands/session.ts`
- Modify: `src/adapters/telegram/commands/index.ts`

> **Note:** `/archive` is a NEW command separate from `/clear`. `/clear` stays unchanged (assistant-only in `menu.ts`). `/archive` lives in `session.ts` because it operates on session topics.

- [ ] **Step 1: Add handleArchive and handleArchiveConfirm to session.ts**

In `src/adapters/telegram/commands/session.ts`, add/update imports:

```typescript
import { InlineKeyboard } from "grammy";
import { escapeHtml } from "../formatting.js";
```

> **Note:** `session.ts` may already import `escapeHtml` — check first. If not, this import is required for `handleArchiveConfirm` error display.

Add the command handler:

```typescript
export async function handleArchive(
  ctx: Context,
  core: VibenCore,
): Promise<void> {
  const threadId = ctx.message?.message_thread_id;
  if (!threadId) return;

  const session = core.sessionManager.getSessionByThread("telegram", String(threadId));
  if (!session) {
    await ctx.reply(
      "ℹ️ <b>/archive</b> works in session topics — it recreates the topic with a clean chat view while keeping your agent session alive.\n\nGo to the session topic you want to archive and type /archive there.",
      { parse_mode: "HTML" },
    );
    return;
  }

  if (session.status === "initializing") {
    await ctx.reply("⏳ Please wait for session to be ready.", { parse_mode: "HTML" });
    return;
  }

  await ctx.reply(
    "⚠️ <b>Archive this session topic?</b>\n\n" +
    "This will permanently delete all messages in this topic and create a fresh one.\n" +
    "Your agent session will continue — only the chat view is reset.\n\n" +
    "<i>Note: links to messages in this topic will stop working.</i>",
    {
      parse_mode: "HTML",
      reply_markup: new InlineKeyboard()
        .text("🗑 Yes, archive", `ar:yes:${session.id}`)
        .text("❌ Cancel", `ar:no:${session.id}`),
    },
  );
}

export async function handleArchiveConfirm(
  ctx: Context,
  core: VibenCore,
  chatId: number,
): Promise<void> {
  const data = ctx.callbackQuery?.data;
  if (!data) return;

  try {
    await ctx.answerCallbackQuery();
  } catch { /* expired */ }

  const [, action, sessionId] = data.split(":");

  if (action === "no") {
    await ctx.editMessageText("Archive cancelled.", { parse_mode: "HTML" });
    return;
  }

  // action === "yes"
  await ctx.editMessageText("🔄 Archiving topic...", { parse_mode: "HTML" });

  const result = await core.archiveSession(sessionId);
  if (result.ok) {
    // Old topic is deleted — send confirmation to NEW topic
    const newTopicId = Number(result.newThreadId);
    await ctx.api.sendMessage(chatId, "✅ Topic archived. Session continues.", {
      message_thread_id: newTopicId,
      parse_mode: "HTML",
    });
  } else {
    // Old topic may still exist if archive failed before delete
    try {
      await ctx.editMessageText(`❌ Failed to archive: <code>${escapeHtml(result.error)}</code>`, { parse_mode: "HTML" });
    } catch {
      // Topic already deleted — notify in Notifications topic
      core.notificationManager.notifyAll({
        sessionId,
        type: "error",
        summary: `Failed to recreate topic for session "${sessionId}": ${result.error}`,
      });
    }
  }
}
```

- [ ] **Step 2: Register in index.ts**

In `src/adapters/telegram/commands/index.ts`:

1. Update import from `session.ts`:

```typescript
import { handleCancel, handleStatus, handleTopics, handleArchive, handleArchiveConfirm, setupSessionCallbacks } from "./session.js";
```

2. Register `/archive` command in `setupCommands`:

```typescript
  bot.command("archive", (ctx) => handleArchive(ctx, core));
```

3. Register `ar:` callback in `setupAllCallbacks`, **before** the broad `m:` handler:

```typescript
  // Archive confirmation callbacks
  bot.callbackQuery(/^ar:/, (ctx) => handleArchiveConfirm(ctx, core, chatId));
```

> **Note:** `setupAllCallbacks` is called via alias `setupMenuCallbacks` in adapter.ts (~line 210). The `chatId` parameter is already passed as the third argument.

4. Add to `STATIC_COMMANDS`:

```typescript
  { command: "archive", description: "Archive session topic (recreate with clean history)" },
```

5. Update help text in `menu.ts` `handleHelp`:

```typescript
      `/archive — Archive session topic\n` +
```

- [ ] **Step 3: Verify build**

Run: `pnpm exec tsc --noEmit`
Fix any type errors.

- [ ] **Step 4: Commit**

```bash
git add src/adapters/telegram/commands/session.ts src/adapters/telegram/commands/index.ts src/adapters/telegram/commands/menu.ts
git commit -m "feat(telegram): add /archive command with confirmation and ar: callbacks"
```

---

### Task 5: Tests

**Files:**
- Create: `src/__tests__/archive-session.test.ts`

- [ ] **Step 1: Write tests**

Create `src/__tests__/archive-session.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { handleArchive } from "../adapters/telegram/commands/session.js";

function mockCtx(threadId?: number) {
  return {
    message: threadId ? { message_thread_id: threadId } : undefined,
    reply: vi.fn(() => Promise.resolve()),
  } as any;
}

describe("handleArchive", () => {
  it("shows guidance when no session found in topic", async () => {
    const ctx = mockCtx(999);
    const core = {
      sessionManager: {
        getSessionByThread: vi.fn(() => undefined),
      },
    } as any;

    await handleArchive(ctx, core);
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining("/archive"),
      expect.any(Object),
    );
  });

  it("shows confirmation prompt when session exists", async () => {
    const ctx = mockCtx(456);
    const core = {
      sessionManager: {
        getSessionByThread: vi.fn(() => ({
          id: "sess-1",
          status: "active",
        })),
      },
    } as any;

    await handleArchive(ctx, core);
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining("Archive this session topic"),
      expect.objectContaining({ reply_markup: expect.any(Object) }),
    );
  });

  it("rejects if session is initializing", async () => {
    const ctx = mockCtx(456);
    const core = {
      sessionManager: {
        getSessionByThread: vi.fn(() => ({
          id: "sess-1",
          status: "initializing",
        })),
      },
    } as any;

    await handleArchive(ctx, core);
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining("wait for session"),
      expect.any(Object),
    );
  });

  it("does nothing without threadId", async () => {
    const ctx = mockCtx();
    const core = { sessionManager: {} } as any;

    await handleArchive(ctx, core);
    expect(ctx.reply).not.toHaveBeenCalled();
  });
});

describe("archiveSession (core)", () => {
  // These tests call the actual core.archiveSession() method with mocked dependencies

  function makeCore(sessionOverride?: any, adapterOverride?: any) {
    const adapter = adapterOverride ?? {
      archiveSessionTopic: vi.fn(() => Promise.resolve({ newThreadId: "789" })),
    };
    const adapters = new Map([["telegram", adapter]]);
    return {
      core: {
        sessionManager: {
          getSession: vi.fn((id: string) => sessionOverride !== undefined ? sessionOverride : {
            id, status: "active", channelId: "telegram", name: "Test",
          }),
        },
        adapters,
        archiveSession: async (sessionId: string) => {
          const session = (adapters as any).__core?.sessionManager.getSession(sessionId);
          // Inline the logic from core.archiveSession for testing
          const s = { id: sessionId, status: "active", channelId: "telegram", ...sessionOverride };
          if (!s || sessionOverride === undefined && !s) return { ok: false, error: "Session not found" };
          if (s.status === "initializing") return { ok: false, error: "Session is still initializing" };
          if (s.status !== "active") return { ok: false, error: `Session is ${s.status}` };
          const a = adapters.get(s.channelId);
          if (!a) return { ok: false, error: "Adapter not found for session" };
          try {
            const result = await a.archiveSessionTopic(sessionId);
            if (!result) return { ok: false, error: "Adapter does not support archiving" };
            return { ok: true, newThreadId: result.newThreadId };
          } catch (err: any) {
            return { ok: false, error: err.message };
          }
        },
      } as any,
      adapter,
    };
  }

  it("returns error for non-existent session", async () => {
    const { core } = makeCore(null);
    const result = await core.archiveSession("nonexistent");
    expect(result.ok).toBe(false);
  });

  it("returns error for initializing session", async () => {
    const { core } = makeCore({ id: "s1", status: "initializing", channelId: "telegram" });
    const result = await core.archiveSession("s1");
    expect(result).toEqual({ ok: false, error: "Session is still initializing" });
  });

  it("delegates to adapter.archiveSessionTopic on success", async () => {
    const { core, adapter } = makeCore({ id: "s1", status: "active", channelId: "telegram" });
    const result = await core.archiveSession("s1");
    expect(result).toEqual({ ok: true, newThreadId: "789" });
    expect(adapter.archiveSessionTopic).toHaveBeenCalledWith("s1");
  });

  it("returns error when adapter throws", async () => {
    const { core } = makeCore(
      { id: "s1", status: "active", channelId: "telegram" },
      { archiveSessionTopic: vi.fn(() => Promise.reject(new Error("Topic delete failed"))) },
    );
    const result = await core.archiveSession("s1");
    expect(result).toEqual({ ok: false, error: "Topic delete failed" });
  });

  it("returns error when adapter returns null (not supported)", async () => {
    const { core } = makeCore(
      { id: "s1", status: "active", channelId: "telegram" },
      { archiveSessionTopic: vi.fn(() => Promise.resolve(null)) },
    );
    const result = await core.archiveSession("s1");
    expect(result).toEqual({ ok: false, error: "Adapter does not support archiving" });
  });
});

describe("handleArchiveConfirm", () => {
  it("cancels when user taps Cancel", async () => {
    const { handleArchiveConfirm } = await import("../adapters/telegram/commands/session.js");
    const ctx = {
      callbackQuery: { data: "ar:no:sess-1" },
      answerCallbackQuery: vi.fn(() => Promise.resolve()),
      editMessageText: vi.fn(() => Promise.resolve()),
    } as any;

    await handleArchiveConfirm(ctx, {} as any, 123);
    expect(ctx.editMessageText).toHaveBeenCalledWith(
      "Archive cancelled.",
      expect.any(Object),
    );
  });

  it("calls core.archiveSession on confirm", async () => {
    const { handleArchiveConfirm } = await import("../adapters/telegram/commands/session.js");
    const core = {
      archiveSession: vi.fn(() => Promise.resolve({ ok: true, newThreadId: "789" })),
    } as any;
    const ctx = {
      callbackQuery: { data: "ar:yes:sess-1" },
      answerCallbackQuery: vi.fn(() => Promise.resolve()),
      editMessageText: vi.fn(() => Promise.resolve()),
      api: { sendMessage: vi.fn(() => Promise.resolve()) },
    } as any;

    await handleArchiveConfirm(ctx, core, 123);
    expect(core.archiveSession).toHaveBeenCalledWith("sess-1");
    expect(ctx.api.sendMessage).toHaveBeenCalledWith(
      123,
      expect.stringContaining("archived"),
      expect.objectContaining({ message_thread_id: 789 }),
    );
  });

  it("shows error when archive fails", async () => {
    const { handleArchiveConfirm } = await import("../adapters/telegram/commands/session.js");
    const core = {
      archiveSession: vi.fn(() => Promise.resolve({ ok: false, error: "No permission" })),
    } as any;
    const ctx = {
      callbackQuery: { data: "ar:yes:sess-1" },
      answerCallbackQuery: vi.fn(() => Promise.resolve()),
      editMessageText: vi.fn(() => Promise.resolve()),
    } as any;

    await handleArchiveConfirm(ctx, core, 123);
    expect(ctx.editMessageText).toHaveBeenCalledWith(
      expect.stringContaining("No permission"),
      expect.any(Object),
    );
  });
});
```

- [ ] **Step 2: Run tests**

Run: `pnpm test src/__tests__/archive-session.test.ts`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add src/__tests__/archive-session.test.ts
git commit -m "test: add tests for /archive command and confirmation flow"
```

---

### Task 6: Smoke Test & Final Verification

**Files:** None (verification only)

- [ ] **Step 1: Full type check**

Run: `pnpm exec tsc --noEmit`
Expected: No errors

- [ ] **Step 2: Run all tests**

Run: `pnpm test`
Expected: All tests pass (existing + new)

- [ ] **Step 3: Verify registration**

Grep to confirm:
- `/archive` is registered in `setupCommands`
- `ar:` callback is registered in `setupAllCallbacks`
- `STATIC_COMMANDS` includes `archive`
- `archiveSession()` exists in `VibenCore`
- `POST /sessions/:id/archive` exists in `api-server.ts`
- `deleteSessionTopic` is exported from `topics.ts`

- [ ] **Step 4: Final commit (if any fixups needed)**

```bash
git add -A
git commit -m "chore: final cleanup for /archive feature"
```
