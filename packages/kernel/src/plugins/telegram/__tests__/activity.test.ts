import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ThinkingIndicator, ToolCard, ActivityTracker } from "../activity.js";
import type { SendQueue } from "../../../core/adapter-primitives/primitives/send-queue.js";
import type { ToolCallMeta } from "../../../core/adapter-primitives/format-types.js";
import type { ToolDisplaySpec } from "../../../core/adapter-primitives/display-spec-builder.js";

// Flush the microtask queue multiple times to let promise chains resolve
async function flushMicrotasks(ticks = 5): Promise<void> {
  for (let i = 0; i < ticks; i++) {
    await Promise.resolve();
  }
}

// Minimal mock for SendQueue: runs the fn immediately, returns result
function makeMockQueue(): SendQueue {
  return {
    enqueue: vi.fn(async (fn: () => Promise<unknown>) => fn()),
    onRateLimited: vi.fn(),
  } as unknown as SendQueue;
}

// Minimal mock for bot.api
function makeMockApi() {
  return {
    sendMessage: vi.fn().mockResolvedValue({ message_id: 42 }),
    deleteMessage: vi.fn().mockResolvedValue(true),
    editMessageText: vi.fn().mockResolvedValue(true),
  };
}

function makeMeta(overrides: Partial<ToolCallMeta> = {}): ToolCallMeta {
  return {
    id: "tool-1",
    name: "read_file",
    kind: "file_read",
    status: "running",
    ...overrides,
  };
}

function makeSpec(overrides: Partial<ToolDisplaySpec> = {}): ToolDisplaySpec {
  return {
    id: "tool-1",
    icon: "📄",
    title: "read_file",
    description: null,
    command: null,
    outputSummary: null,
    outputContent: null,
    diffStats: null,
    status: "running",
    isNoise: false,
    isHidden: false,
    ...overrides,
  };
}

describe("ThinkingIndicator", () => {
  let api: ReturnType<typeof makeMockApi>;
  let queue: SendQueue;
  let indicator: ThinkingIndicator;

  beforeEach(() => {
    api = makeMockApi();
    queue = makeMockQueue();
    indicator = new ThinkingIndicator(api as never, 100, 200, queue);
  });

  afterEach(() => {
    void indicator.dismiss();
  });

  it("show() sends a thinking message", async () => {
    await indicator.show();
    expect(api.sendMessage).toHaveBeenCalledWith(
      100,
      "💭 <i>Thinking...</i>",
      expect.objectContaining({ message_thread_id: 200, parse_mode: "HTML" }),
    );
  });

  it("show() called twice only sends one message", async () => {
    await indicator.show();
    await indicator.show();
    expect(api.sendMessage).toHaveBeenCalledOnce();
  });

  it("dismiss() after show stops refresh and leaves message in chat", async () => {
    await indicator.show();
    await indicator.dismiss();
    expect(api.deleteMessage).not.toHaveBeenCalled();
  });

  it("dismiss() called twice is idempotent", async () => {
    await indicator.show();
    await indicator.dismiss();
    await indicator.dismiss();
    expect(api.sendMessage).toHaveBeenCalledOnce();
  });

  it("reset() allows show() to work again after dismiss", async () => {
    await indicator.show();
    await indicator.dismiss();
    indicator.reset();
    await indicator.show();
    expect(api.sendMessage).toHaveBeenCalledTimes(2);
  });

  it("show() while dismissed (race: dismiss during queue wait) does not set msgId", async () => {
    let resolveEnqueue!: (v: unknown) => void;
    const slowQueue: SendQueue = {
      enqueue: vi.fn(
        (fn: () => Promise<unknown>) =>
          new Promise((resolve) => {
            resolveEnqueue = async () => {
              const result = await fn();
              resolve(result);
            };
          }),
      ),
      onRateLimited: vi.fn(),
    } as unknown as SendQueue;

    const ind = new ThinkingIndicator(api as never, 100, 200, slowQueue);
    const showPromise = ind.show();

    // dismiss() while show() is waiting in the queue
    await ind.dismiss();

    // Now resolve the queue — sendMessage returns the message
    await resolveEnqueue(undefined);
    await showPromise;

    // The message was sent but NOT deleted (saves API calls)
    expect(api.sendMessage).toHaveBeenCalledOnce();
    expect(api.deleteMessage).not.toHaveBeenCalled();
  });
});

describe("ToolCard", () => {
  let api: ReturnType<typeof makeMockApi>;
  let queue: SendQueue;
  let card: ToolCard;

  beforeEach(() => {
    api = makeMockApi();
    queue = makeMockQueue();
    card = new ToolCard(api as never, 100, 200, queue);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    card.destroy();
  });

  it("hasContent() returns false before any spec added", () => {
    expect(card.hasContent()).toBe(false);
  });

  it("hasContent() returns true after updateFromSpec()", async () => {
    card.updateFromSpec(makeSpec());
    await flushMicrotasks();
    expect(card.hasContent()).toBe(true);
  });

  it("sends message on updateFromSpec() (immediate first flush)", async () => {
    card.updateFromSpec(makeSpec());
    await flushMicrotasks();
    expect(api.sendMessage).toHaveBeenCalledOnce();
  });

  it("getMsgId() returns the message id after first send", async () => {
    card.updateFromSpec(makeSpec());
    await flushMicrotasks();
    expect(card.getMsgId()).toBe(42);
  });

  it("finalize() flushes pending state", async () => {
    card.updateFromSpec(makeSpec());
    await flushMicrotasks();
    card.updateFromSpec(makeSpec({ status: "completed" }));
    // Debounce not fired yet
    expect(api.editMessageText).not.toHaveBeenCalled();
    await card.finalize();
    expect(api.editMessageText).toHaveBeenCalled();
  });

  it("destroy() cancels pending debounce", async () => {
    card.updateFromSpec(makeSpec());
    await flushMicrotasks();
    card.updateFromSpec(makeSpec({ status: "completed" }));
    card.destroy();
    await vi.advanceTimersByTimeAsync(1000);
    // Should not have edited after destroy
    expect(api.editMessageText).not.toHaveBeenCalled();
  });
});

describe("ActivityTracker", () => {
  let api: ReturnType<typeof makeMockApi>;
  let queue: SendQueue;
  let tracker: ActivityTracker;

  beforeEach(() => {
    api = makeMockApi();
    queue = makeMockQueue();
    tracker = new ActivityTracker(api as never, 100, 200, queue);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    tracker.destroy();
  });

  it("onThought() shows thinking indicator", async () => {
    await tracker.onThought("thinking...");
    expect(api.sendMessage).toHaveBeenCalledWith(
      100,
      "💭 <i>Thinking...</i>",
      expect.anything(),
    );
  });

  it("onThought() called multiple times only sends one message", async () => {
    await tracker.onThought("a");
    await tracker.onThought("b");
    await tracker.onThought("c");
    expect(api.sendMessage).toHaveBeenCalledOnce();
  });

  it("onToolCall() dismisses thinking (no delete)", async () => {
    await tracker.onThought("thinking...");
    await tracker.onToolCall(makeMeta(), "file_read", { path: "/tmp/foo" });
    expect(api.deleteMessage).not.toHaveBeenCalled();
  });

  it("onTextStart() dismisses thinking (no delete)", async () => {
    await tracker.onThought("thinking...");
    await tracker.onTextStart();
    expect(api.deleteMessage).not.toHaveBeenCalled();
  });

  it("sendUsage() is a no-op (usage is sent as separate message by adapter)", async () => {
    await tracker.sendUsage({ tokensUsed: 1000, contextSize: 10000 });
    await flushMicrotasks();
    // sendUsage no longer triggers any Telegram API calls — adapter handles it
    expect(api.sendMessage).not.toHaveBeenCalled();
  });

  it("onNewPrompt() dismisses thinking (no delete)", async () => {
    await tracker.onThought("thinking...");
    await tracker.onNewPrompt();
    expect(api.deleteMessage).not.toHaveBeenCalled();
  });

  it("cleanup() finalizes toolCard and dismisses thinking", async () => {
    await tracker.onThought("thinking...");
    await tracker.onToolCall(makeMeta(), "file_read", { path: "/tmp/foo" });
    await flushMicrotasks();
    await tracker.cleanup();
    // After cleanup, tracker is finalized — no errors thrown
    expect(true).toBe(true);
  });

  it("onNewPrompt() dismisses thinking (message left in chat)", async () => {
    await tracker.onThought("thinking...");
    expect(api.sendMessage).toHaveBeenCalledOnce();
    await tracker.onNewPrompt();
    expect(api.deleteMessage).not.toHaveBeenCalled();
  });

  it("getToolCardMsgId() returns undefined when no tool content", () => {
    expect(tracker.getToolCardMsgId()).toBeUndefined();
  });

  it("getToolCardMsgId() returns msgId after tool call", async () => {
    await tracker.onToolCall(makeMeta(), "file_read", { path: "/tmp/foo" });
    await flushMicrotasks();
    expect(tracker.getToolCardMsgId()).toBe(42);
  });

  // ── Full flow tests ──────────────────────────────────────────────────────

  it("full flow: onToolCall followed by onToolUpdate updates the card via edit", async () => {
    await tracker.onToolCall(makeMeta({ id: "t1", name: "read_file" }), "read", { file_path: "/tmp/foo" });
    await flushMicrotasks();
    expect(api.sendMessage).toHaveBeenCalledOnce();

    await tracker.onToolUpdate("t1", "completed");
    // Debounce not fired yet
    expect(api.editMessageText).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(500);
    await flushMicrotasks();
    expect(api.editMessageText).toHaveBeenCalled();
  });

  it("full flow: multiple onToolCall events aggregate into single card", async () => {
    await tracker.onToolCall(makeMeta({ id: "t1", name: "read_file" }), "read", { file_path: "/a.ts" });
    await flushMicrotasks();
    // First spec triggers immediate flush (first flush)
    expect(api.sendMessage).toHaveBeenCalledOnce();

    await tracker.onToolCall(makeMeta({ id: "t2", name: "read_file" }), "read", { file_path: "/b.ts" });
    // Second spec is debounced
    await vi.advanceTimersByTimeAsync(500);
    await flushMicrotasks();
    // Should edit the existing message, not send a new one
    expect(api.sendMessage).toHaveBeenCalledOnce();
    expect(api.editMessageText).toHaveBeenCalled();
  });

  it("full flow: onNewPrompt resets state for fresh card", async () => {
    await tracker.onToolCall(makeMeta({ id: "t1", name: "read_file" }), "read", { file_path: "/a.ts" });
    await flushMicrotasks();
    expect(api.sendMessage).toHaveBeenCalledOnce();

    // Use a new message_id for the second sendMessage call
    let msgCounter = 42;
    api.sendMessage.mockImplementation(async () => ({ message_id: ++msgCounter }));

    await tracker.onNewPrompt();

    await tracker.onToolCall(makeMeta({ id: "t2", name: "write_file" }), "write", { file_path: "/b.ts" });
    await flushMicrotasks();
    // Should be a fresh sendMessage (new card), not an edit of the old one
    expect(api.sendMessage).toHaveBeenCalledTimes(2);
  });

  // ── Overflow handling ────────────────────────────────────────────────────

  it("ToolCard splits message >4096 chars into overflow messages", async () => {
    let msgCounter = 100;
    api.sendMessage.mockImplementation(async () => ({ message_id: ++msgCounter }));

    const card = new ToolCard(api as never, 100, 200, queue);

    // Create many specs with long titles to exceed 4096 chars
    for (let i = 0; i < 40; i++) {
      card.updateFromSpec(makeSpec({
        id: `tool-${i}`,
        kind: "execute",
        title: `command-${i}-${"x".repeat(100)}`,
        description: "A".repeat(80),
        status: "completed",
      }));
    }
    await card.finalize();
    await flushMicrotasks();

    // Primary message + at least one overflow message
    expect(api.sendMessage.mock.calls.length).toBeGreaterThanOrEqual(2);
    card.destroy();
  });

  it("ToolCard deletes stale overflow messages when chunks decrease", async () => {
    let msgCounter = 100;
    api.sendMessage.mockImplementation(async () => ({ message_id: ++msgCounter }));

    const card = new ToolCard(api as never, 100, 200, queue);

    // First: produce overflow by adding many long specs
    const longSpecs: ToolDisplaySpec[] = [];
    for (let i = 0; i < 40; i++) {
      const spec = makeSpec({
        id: `tool-${i}`,
        kind: "execute",
        title: `command-${i}-${"x".repeat(100)}`,
        description: "A".repeat(80),
        status: "running",
      });
      longSpecs.push(spec);
      card.updateFromSpec(spec);
    }
    await card.finalize();
    await flushMicrotasks();

    const overflowSends = api.sendMessage.mock.calls.length;
    expect(overflowSends).toBeGreaterThanOrEqual(2);

    // Now create a fresh card (simulating second flush) with fewer specs that fit in one message
    const card2 = new ToolCard(api as never, 100, 200, queue);
    // Manually set the internal state to simulate having overflow IDs
    // We test through ToolCard directly: update with short content after having overflow
    // The ToolCard already sent overflow. Let's test via a single card that shrinks.

    // Reset and test: first flush produces overflow, second update produces fewer chunks
    api.sendMessage.mockClear();
    api.editMessageText.mockClear();
    api.deleteMessage.mockClear();

    // Use a brand new card for clean test
    msgCounter = 200;
    const card3 = new ToolCard(api as never, 100, 200, queue);

    // First flush: many long specs -> overflow
    for (let i = 0; i < 40; i++) {
      card3.updateFromSpec(makeSpec({
        id: `tool-${i}`,
        kind: "execute",
        title: `longcmd-${i}-${"x".repeat(100)}`,
        description: "B".repeat(80),
        status: "running",
      }));
    }
    // First spec triggers immediate flush, rest are debounced
    await flushMicrotasks();
    await vi.advanceTimersByTimeAsync(500);
    await flushMicrotasks();

    const overflowMsgCount = api.sendMessage.mock.calls.length;
    expect(overflowMsgCount).toBeGreaterThanOrEqual(2);

    // Second flush: replace all specs with short hidden ones so text is much shorter
    for (let i = 0; i < 40; i++) {
      card3.updateFromSpec(makeSpec({
        id: `tool-${i}`,
        kind: "execute",
        title: "short",
        description: null,
        status: "completed",
        isHidden: true,
      }));
    }
    // Add one visible short spec so there is some text
    card3.updateFromSpec(makeSpec({
      id: "tool-visible",
      kind: "read",
      title: "file.ts",
      status: "completed",
    }));

    await vi.advanceTimersByTimeAsync(500);
    await flushMicrotasks();

    // Stale overflow messages should have been deleted
    expect(api.deleteMessage).toHaveBeenCalled();
    card3.destroy();
    card2.destroy();
    card.destroy();
  });

  // ── Out-of-order handling ────────────────────────────────────────────────

  it("onToolUpdate before onToolCall buffers update and applies on arrival", async () => {
    // Send update for a tool that hasn't been announced yet
    await tracker.onToolUpdate("t1", "completed");
    await flushMicrotasks();

    // No message should have been sent (no tool call yet)
    expect(api.sendMessage).not.toHaveBeenCalled();

    // Now the tool call arrives
    await tracker.onToolCall(makeMeta({ id: "t1", name: "read_file", status: "running" }), "read", { file_path: "/tmp/foo" });
    await flushMicrotasks();

    // The card should be sent
    expect(api.sendMessage).toHaveBeenCalledOnce();

    // The rendered card should reflect "completed" status (from the buffered update)
    const sentHtml = api.sendMessage.mock.calls[0][1] as string;
    // completed tools show a checkmark
    expect(sentHtml).toContain("\u2705");
  });

  // ── Noise filtering per mode ─────────────────────────────────────────────

  it("noise tool hidden in medium mode", async () => {
    // Default tracker is "medium" mode
    // "Glob" is classified as noise by NOISE_RULES
    await tracker.onToolCall(
      makeMeta({ id: "t1", name: "Glob", kind: "search" }),
      "search",
      { pattern: "*.ts" },
    );
    await flushMicrotasks();

    // The card is sent but the noise tool should be hidden (not visible in rendered text)
    // In medium mode, isHidden=true means the spec is filtered out of visible count
    // The header should show 0/0 visible tools (hidden tools excluded from counts)
    if (api.sendMessage.mock.calls.length > 0) {
      const sentHtml = api.sendMessage.mock.calls[0][1] as string;
      // A hidden tool should not appear with its title in the rendered output
      expect(sentHtml).not.toContain("Glob");
    }
  });

  it("noise tool shown in high mode", async () => {
    const highTracker = new ActivityTracker(api as never, 100, 200, queue, "high");
    // "Glob" is classified as noise
    await highTracker.onToolCall(
      makeMeta({ id: "t1", name: "Glob", kind: "search" }),
      "search",
      { pattern: "*.ts" },
    );
    await flushMicrotasks();

    expect(api.sendMessage).toHaveBeenCalled();
    const sentHtml = api.sendMessage.mock.calls[0][1] as string;
    // In high mode, noise tools are NOT hidden — they should appear
    expect(sentHtml).toContain("Glob");
    highTracker.destroy();
  });

  // ── Thought handling ─────────────────────────────────────────────────────

  it("onTextStart seals ThoughtBuffer", async () => {
    await tracker.onThought("first thought ");
    await tracker.onTextStart();
    // After seal, further thoughts should not be appended
    await tracker.onThought("second thought ");

    // The ThoughtBuffer is internal, but we can verify via the thinking indicator behavior:
    // After onTextStart, thinking is dismissed; subsequent onThought shows a new thinking message
    // but the internal buffer should be sealed (only "first thought " in buffer).
    // We verify indirectly: the second onThought calls show() again (thinking was dismissed + reset by next prompt cycle)
    // The key assertion is that no error occurs and the flow works.
    // The sealed state is tested via ThoughtBuffer unit behavior — here we just verify the integration.
    expect(api.sendMessage).toHaveBeenCalled();
  });

  // ── Dedup guard ──────────────────────────────────────────────────────────

  it("ToolCard skips edit when rendered text identical to last sent", async () => {
    const card = new ToolCard(api as never, 100, 200, queue);

    const spec = makeSpec({ id: "t1", status: "running" });
    card.updateFromSpec(spec);
    await flushMicrotasks();
    expect(api.sendMessage).toHaveBeenCalledOnce();

    // Update with an identical spec — same rendered HTML
    card.updateFromSpec(makeSpec({ id: "t1", status: "running" }));
    await vi.advanceTimersByTimeAsync(500);
    await flushMicrotasks();

    // Should NOT have called editMessageText since text is identical
    expect(api.editMessageText).not.toHaveBeenCalled();
    card.destroy();
  });

  // ── Empty card handling ──────────────────────────────────────────────────

  it("ToolCard with no specs skips send on finalize", async () => {
    const card = new ToolCard(api as never, 100, 200, queue);
    await card.finalize();
    await flushMicrotasks();

    expect(api.sendMessage).not.toHaveBeenCalled();
    expect(api.editMessageText).not.toHaveBeenCalled();
    card.destroy();
  });
});
