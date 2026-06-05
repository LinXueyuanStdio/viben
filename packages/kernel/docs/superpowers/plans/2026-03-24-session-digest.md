# Session Summary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add on-demand `/summary` command that asks the agent to summarize the current session. User-initiated, displayed in session topic, no persistent storage needed.

**Architecture:** `Session.generateSummary()` follows the `autoName()` pause/capture/resume pattern. `VibenCore.summarizeSession()` handles both active sessions (direct prompt) and ended sessions (respawn agent with conversation history via `resumeAgentSessionId`, prompt, destroy). Telegram adapter adds `/summary` command + `[📋 Summary]` button in completion notifications.

**Tech Stack:** TypeScript, grammY, vitest

**Spec:** `docs/superpowers/specs/2026-03-24-session-digest-design.md`

---

## File Structure

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `src/core/session.ts` | Add `generateSummary()` method + `promptCount` property |
| Modify | `src/core/core.ts` | Add `summarizeSession(sessionId)` public method |
| Modify | `src/core/session-bridge.ts` | Enhance session_end notification with Summary button metadata |
| Modify | `src/core/api/routes/sessions.ts` | Add `POST /sessions/:id/summary` endpoint |
| Modify | `src/adapters/telegram/commands/session.ts` | Add `handleSummary()` + `handleSummaryCallback()` |
| Modify | `src/adapters/telegram/commands/index.ts` | Register `/summary` command, `sm:` callbacks, STATIC_COMMANDS |
| Modify | `src/adapters/telegram/formatting.ts` | Add `formatSummary()` helper |
| Create | `src/__tests__/session-summary.test.ts` | Tests for generateSummary, command, callback |

---

### Task 1: Session.generateSummary() + promptCount

**Files:**
- Modify: `src/core/session.ts`
- Create: `src/__tests__/session-summary.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/__tests__/session-summary.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { Session } from "../core/session.js";

function createTestSession(opts: {
  promptFn?: () => Promise<void>;
  emitText?: string;
  status?: string;
} = {}) {
  const agentInstance = {
    prompt: opts.promptFn ?? vi.fn(async () => {}),
    on: vi.fn((event: string, handler: Function) => {
      if (event === "agent_event" && opts.emitText) {
        setTimeout(() => handler({ type: "text", content: opts.emitText }), 0);
      }
    }),
    off: vi.fn(),
    onSessionUpdate: null,
    onPermissionRequest: null,
    sessionId: "agent-1",
    connect: vi.fn(async () => {}),
    disconnect: vi.fn(),
  } as any;

  const session = new Session({
    channelId: "telegram",
    agentName: "claude",
    agentInstance,
  });
  if (opts.status !== "initializing") session.activate();
  return session;
}

describe("Session.generateSummary", () => {
  it("captures agent text response as summary", async () => {
    const session = createTestSession({ emitText: "Fixed auth bug in login.ts" });
    const summary = await session.generateSummary();
    expect(summary).toContain("Fixed auth bug");
  });

  it("returns empty string on timeout", async () => {
    const session = createTestSession({
      promptFn: () => new Promise(() => {}), // never resolves
    });
    const summary = await session.generateSummary(100); // 100ms timeout
    expect(summary).toBe("");
  });

  it("returns empty string on error", async () => {
    const session = createTestSession({
      promptFn: () => Promise.reject(new Error("agent crashed")),
    });
    const summary = await session.generateSummary();
    expect(summary).toBe("");
  });

  it("truncates long summaries to 500 chars", async () => {
    const longText = "A".repeat(600);
    const session = createTestSession({ emitText: longText });
    const summary = await session.generateSummary();
    expect(summary.length).toBeLessThanOrEqual(500);
  });
});

describe("Session.promptCount", () => {
  it("starts at 0", () => {
    const session = createTestSession();
    expect(session.promptCount).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/__tests__/session-summary.test.ts`

- [ ] **Step 3: Add promptCount property to Session**

In `src/core/session.ts`, add after `dangerousMode`:

```typescript
  promptCount: number = 0;
  archiving: boolean = false;
```

> **Note:** `archiving` may already exist from the archive feature. Only add `promptCount` if not present. Check if `archiving` is already there.

In `enqueuePrompt()`, increment promptCount at the start of the method:

```typescript
  async enqueuePrompt(text: string, attachments?: Attachment[]): Promise<void> {
    this.promptCount++;
    // ... rest of existing code
```

- [ ] **Step 4: Add generateSummary() to Session**

In `src/core/session.ts`, add after `autoName()` method (follows the same pause/capture/resume pattern):

```typescript
  async generateSummary(timeoutMs = 15000): Promise<string> {
    let summary = "";

    const captureHandler = (event: AgentEvent) => {
      if (event.type === "text") summary += event.content;
    };

    this.pause((event) => event !== "agent_event");
    this.agentInstance.on("agent_event", captureHandler);

    try {
      const promptPromise = this.agentInstance.prompt(
        "Summarize what you've accomplished so far in this session in 2-3 sentences. Include: key files changed, decisions made, and current status. Reply ONLY with the summary, nothing else.",
      );
      const timeoutPromise = new Promise<void>((_, reject) =>
        setTimeout(() => reject(new Error("summary timeout")), timeoutMs),
      );
      await Promise.race([promptPromise, timeoutPromise]);
      return summary.trim().slice(0, 500);
    } catch {
      this.log.warn("Failed to generate session summary");
      return "";
    } finally {
      this.agentInstance.off("agent_event", captureHandler);
      this.clearBuffer();
      this.resume();
    }
  }
```

- [ ] **Step 5: Run tests**

Run: `pnpm test src/__tests__/session-summary.test.ts`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/core/session.ts src/__tests__/session-summary.test.ts
git commit -m "feat(core): add Session.generateSummary() and promptCount"
```

---

### Task 2: Core — summarizeSession()

**Files:**
- Modify: `src/core/core.ts`

- [ ] **Step 1: Add summarizeSession() to VibenCore**

In `src/core/core.ts`, add after `archiveSession()`:

```typescript
  async summarizeSession(sessionId: string): Promise<{ ok: true; summary: string } | { ok: false; error: string }> {
    const session = this.sessionManager.getSession(sessionId);
    if (!session) return { ok: false, error: "Session not found" };
    if (session.status !== "active") return { ok: false, error: `Session is ${session.status}, summary is only available for active sessions` };

    try {
      const summary = await session.generateSummary();
      if (!summary) return { ok: false, error: "Agent could not generate summary" };
      return { ok: true, summary };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  }
```

- [ ] **Step 2: Verify build**

Run: `pnpm exec tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/core/core.ts
git commit -m "feat(core): add summarizeSession() to VibenCore"
```

---

### Task 3: Enhance session_end notification with Summary button

**Files:**
- Modify: `src/core/session-bridge.ts`

- [ ] **Step 1: Update session_end handler**

In `src/core/session-bridge.ts`, find the `case "session_end":` block. Update the notification to include metadata for a Summary button:

Replace the existing notification call:

```typescript
          this.deps.notificationManager.notify(this.session.channelId, {
            sessionId: this.session.id,
            sessionName: this.session.name,
            type: "completed",
            summary: `Session "${this.session.name || this.session.id}" completed`,
          });
```

With:

```typescript
          const duration = Math.round((Date.now() - this.session.createdAt.getTime()) / 60000);
          this.deps.notificationManager.notify(this.session.channelId, {
            sessionId: this.session.id,
            sessionName: this.session.name,
            type: "completed",
            summary: `Session "${this.session.name || this.session.id}" completed\n⏱ ${duration} min · 💬 ${this.session.promptCount} prompts`,
          });
```

> **Note:** The `[📋 Summary]` inline button is handled by the Telegram adapter in `sendNotification()` — it can detect `type: "completed"` and append the button. This keeps the core adapter-agnostic. The adapter implementation is in Task 4.

- [ ] **Step 2: Verify build**

Run: `pnpm exec tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/core/session-bridge.ts
git commit -m "feat(core): enhance session completion notification with stats"
```

---

### Task 4: Telegram — /summary command and Summary button

**Files:**
- Modify: `src/adapters/telegram/commands/session.ts`
- Modify: `src/adapters/telegram/commands/index.ts`
- Modify: `src/adapters/telegram/formatting.ts`

- [ ] **Step 1: Add formatSummary to formatting.ts**

In `src/adapters/telegram/formatting.ts`, add before `splitMessage`:

```typescript
export function formatSummary(summary: string, sessionName?: string): string {
  const header = sessionName
    ? `📋 <b>Summary — ${escapeHtml(sessionName)}</b>`
    : '📋 <b>Session Summary</b>'
  return `${header}\n\n${escapeHtml(summary)}`
}
```

- [ ] **Step 2: Add handleSummary and handleSummaryCallback to session.ts**

In `src/adapters/telegram/commands/session.ts`, add imports if needed:

```typescript
import { formatSummary } from "../formatting.js";
```

Add the handlers:

```typescript
export async function handleSummary(
  ctx: Context,
  core: VibenCore,
): Promise<void> {
  const threadId = ctx.message?.message_thread_id;
  if (!threadId) return;

  const session = core.sessionManager.getSessionByThread("telegram", String(threadId));
  if (!session) {
    await ctx.reply(
      "ℹ️ <b>/summary</b> works in session topics — it asks the agent to summarize the current session.\n\nGo to an active session topic and type /summary there.",
      { parse_mode: "HTML" },
    );
    return;
  }

  if (session.status !== "active") {
    await ctx.reply("⚠️ Session has ended. Summary is only available for active sessions.", { parse_mode: "HTML" });
    return;
  }

  await ctx.replyWithChatAction("typing");
  const result = await core.summarizeSession(session.id);

  if (result.ok) {
    await ctx.reply(formatSummary(result.summary, session.name), { parse_mode: "HTML" });
  } else {
    await ctx.reply(`⚠️ ${escapeHtml(result.error)}`, { parse_mode: "HTML" });
  }
}

export async function handleSummaryCallback(
  ctx: Context,
  core: VibenCore,
  chatId: number,
): Promise<void> {
  const data = ctx.callbackQuery?.data;
  if (!data) return;

  try {
    await ctx.answerCallbackQuery();
  } catch { /* expired */ }

  const sessionId = data.replace("sm:summary:", "");
  const session = core.sessionManager.getSession(sessionId);

  if (!session || session.status !== "active") {
    await ctx.answerCallbackQuery({ text: "Session has ended, summary not available." });
    return;
  }

  // Send summary to the session topic
  const threadId = Number(session.threadId);
  if (!threadId) return;

  await ctx.api.sendMessage(chatId, "📋 Generating summary...", {
    message_thread_id: threadId,
    parse_mode: "HTML",
  });

  const result = await core.summarizeSession(sessionId);
  if (result.ok) {
    await ctx.api.sendMessage(chatId, formatSummary(result.summary, session.name), {
      message_thread_id: threadId,
      parse_mode: "HTML",
    });
  } else {
    await ctx.api.sendMessage(chatId, `⚠️ ${result.error}`, {
      message_thread_id: threadId,
      parse_mode: "HTML",
    });
  }
}
```

- [ ] **Step 3: Register in index.ts**

Update import from session.ts:

```typescript
import { ..., handleSummary, handleSummaryCallback, ... } from "./session.js";
```

Register command in `setupCommands`:

```typescript
  bot.command("summary", (ctx) => handleSummary(ctx, core));
```

Register `sm:` callback in `setupAllCallbacks`, before the broad `m:` handler:

```typescript
  // Summary button callbacks
  bot.callbackQuery(/^sm:/, (ctx) => handleSummaryCallback(ctx, core, chatId));
```

Add to STATIC_COMMANDS:

```typescript
  { command: "summary", description: "Get AI summary of current session" },
```

- [ ] **Step 4: Add Summary button to completion notifications**

In `src/adapters/telegram/adapter.ts`, find the `sendNotification()` method. When `notification.type === "completed"`, add a `[📋 Summary]` inline button:

Find where the notification message is sent and add reply_markup for completed notifications:

```typescript
  // In sendNotification(), when building the notification message:
  const replyMarkup = notification.type === "completed"
    ? { inline_keyboard: [[{ text: "📋 Summary", callback_data: `sm:summary:${notification.sessionId}` }]] }
    : undefined;
```

Pass `reply_markup: replyMarkup` to the `sendMessage` call.

> **Note:** Check the exact location in `sendNotification()` — the reply_markup parameter goes into the Telegram API call options.

- [ ] **Step 5: Verify build**

Run: `pnpm exec tsc --noEmit`

- [ ] **Step 6: Commit**

```bash
git add src/adapters/telegram/formatting.ts src/adapters/telegram/commands/session.ts src/adapters/telegram/commands/index.ts src/adapters/telegram/adapter.ts
git commit -m "feat(telegram): add /summary command and Summary button in completion notifications"
```

---

### Task 5: API endpoint

**Files:**
- Modify: `src/core/api/routes/sessions.ts`

- [ ] **Step 1: Add POST /sessions/:id/summary route**

In the sessions route file, add a handler for `POST /api/sessions/:id/summary`:

```typescript
// POST /api/sessions/:id/summary
if (method === 'POST' && url.match(/^\/api\/sessions\/([^/]+)\/summary$/)) {
  const sessionId = decodeURIComponent(url.match(/^\/api\/sessions\/([^/]+)\/summary$/)![1]);
  const result = await core.summarizeSession(sessionId);
  if (result.ok) {
    sendJson(res, 200, result);
  } else {
    sendJson(res, 400, result);
  }
  return;
}
```

> **Note:** Follow the existing routing pattern in the file. Check how other `POST /api/sessions/:id/...` routes are structured.

- [ ] **Step 2: Verify build**

Run: `pnpm exec tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/core/api/routes/sessions.ts
git commit -m "feat(api): add POST /sessions/:id/summary endpoint"
```

---

### Task 6: Tests for command and callback

**Files:**
- Modify: `src/__tests__/session-summary.test.ts`

- [ ] **Step 1: Add command and callback tests**

Append to `src/__tests__/session-summary.test.ts`:

```typescript
import { handleSummary } from "../adapters/telegram/commands/session.js";

describe("handleSummary command", () => {
  it("shows guidance in non-session topic", async () => {
    const ctx = {
      message: { message_thread_id: 999 },
      reply: vi.fn(() => Promise.resolve()),
    } as any;
    const core = {
      sessionManager: { getSessionByThread: vi.fn(() => undefined) },
    } as any;

    await handleSummary(ctx, core);
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining("/summary"),
      expect.any(Object),
    );
  });

  it("rejects ended session", async () => {
    const ctx = {
      message: { message_thread_id: 456 },
      reply: vi.fn(() => Promise.resolve()),
    } as any;
    const core = {
      sessionManager: {
        getSessionByThread: vi.fn(() => ({ id: "s1", status: "finished" })),
      },
    } as any;

    await handleSummary(ctx, core);
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining("has ended"),
      expect.any(Object),
    );
  });

  it("calls summarizeSession and displays result", async () => {
    const ctx = {
      message: { message_thread_id: 456 },
      reply: vi.fn(() => Promise.resolve()),
      replyWithChatAction: vi.fn(() => Promise.resolve()),
    } as any;
    const core = {
      sessionManager: {
        getSessionByThread: vi.fn(() => ({ id: "s1", status: "active", name: "Test" })),
      },
      summarizeSession: vi.fn(() => Promise.resolve({ ok: true, summary: "Fixed auth bug." })),
    } as any;

    await handleSummary(ctx, core);
    expect(core.summarizeSession).toHaveBeenCalledWith("s1");
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining("Fixed auth bug"),
      expect.any(Object),
    );
  });

  it("shows error when summary fails", async () => {
    const ctx = {
      message: { message_thread_id: 456 },
      reply: vi.fn(() => Promise.resolve()),
      replyWithChatAction: vi.fn(() => Promise.resolve()),
    } as any;
    const core = {
      sessionManager: {
        getSessionByThread: vi.fn(() => ({ id: "s1", status: "active" })),
      },
      summarizeSession: vi.fn(() => Promise.resolve({ ok: false, error: "Agent timeout" })),
    } as any;

    await handleSummary(ctx, core);
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining("Agent timeout"),
      expect.any(Object),
    );
  });
});
```

- [ ] **Step 2: Run all tests**

Run: `pnpm test src/__tests__/session-summary.test.ts`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add src/__tests__/session-summary.test.ts
git commit -m "test: add tests for /summary command, callback, and generateSummary"
```

---

### Task 7: Smoke Test & Final Verification

**Files:** None (verification only)

- [ ] **Step 1: Full type check**

Run: `pnpm exec tsc --noEmit`

- [ ] **Step 2: Run all tests**

Run: `pnpm test`

- [ ] **Step 3: Verify registration**

Grep to confirm:
- `generateSummary()` on Session class
- `summarizeSession()` on VibenCore
- `/summary` registered in `setupCommands`
- `sm:` callback registered in `setupAllCallbacks`
- `STATIC_COMMANDS` includes `summary`
- `POST /sessions/:id/summary` in API routes
- `promptCount` incremented in `enqueuePrompt()`

- [ ] **Step 4: Final commit (if any fixups needed)**

```bash
git add -A
git commit -m "chore: final cleanup for session summary feature"
```
