import { describe, it, expect, vi, beforeEach } from "vitest";

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
      getConfigByCategory: vi.fn().mockReturnValue(undefined),
      clientOverrides: { bypassPermissions: false },
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
    expect((callOpts as any).reply_markup).toEqual({ force_reply: true });
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
    if (replyArg !== undefined) {
      expect(replyArg).not.toContain("❌");
    }
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
    expect((sendOpts as any).reply_markup).toEqual({ force_reply: true });

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
