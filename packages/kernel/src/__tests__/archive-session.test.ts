import { describe, it, expect, vi } from "vitest";
import { handleArchive, handleArchiveConfirm } from "../plugins/telegram/commands/session.js";

function mockCtx(threadId?: number) {
  return {
    message: threadId ? { message_thread_id: threadId } : undefined,
    reply: vi.fn(() => Promise.resolve()),
  } as any;
}

describe("handleArchive", () => {
  it("shows confirmation for active session", async () => {
    const ctx = mockCtx(456);
    const core = {
      sessionManager: {
        getSessionByThread: vi.fn(() => ({ id: "sess-1", status: "active" })),
        getRecordByThread: vi.fn(),
      },
    } as any;

    await handleArchive(ctx, core);
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining("Archive this session"),
      expect.objectContaining({ reply_markup: expect.any(Object) }),
    );
  });

  it("confirmation text describes permanent deletion", async () => {
    const ctx = mockCtx(456);
    const core = {
      sessionManager: {
        getSessionByThread: vi.fn(() => ({ id: "sess-1", status: "active" })),
        getRecordByThread: vi.fn(),
      },
    } as any;

    await handleArchive(ctx, core);
    const text = ctx.reply.mock.calls[0][0] as string;
    expect(text).toContain("Stop the agent session");
    expect(text).toContain("Delete this topic permanently");
    expect(text).toContain("cannot be undone");
  });

  it("rejects initializing session", async () => {
    const ctx = mockCtx(456);
    const core = {
      sessionManager: {
        getSessionByThread: vi.fn(() => ({ id: "sess-1", status: "initializing" })),
        getRecordByThread: vi.fn(),
      },
    } as any;

    await handleArchive(ctx, core);
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining("still initializing"),
      expect.any(Object),
    );
  });

  it("rejects non-session topic (no session, no record)", async () => {
    const ctx = mockCtx(999);
    const core = {
      sessionManager: {
        getSessionByThread: vi.fn(() => undefined),
        getRecordByThread: vi.fn(() => undefined),
      },
    } as any;

    await handleArchive(ctx, core);
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining("not linked to a session"),
      expect.any(Object),
    );
  });

  it("shows confirmation for stored record (after restart)", async () => {
    const ctx = mockCtx(456);
    const core = {
      sessionManager: {
        getSessionByThread: vi.fn(() => undefined),
        getRecordByThread: vi.fn(() => ({ sessionId: "stored-1", status: "active" })),
      },
    } as any;

    await handleArchive(ctx, core);
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining("Archive this session"),
      expect.objectContaining({ reply_markup: expect.any(Object) }),
    );
  });

  it("does nothing without threadId", async () => {
    const ctx = mockCtx();
    const core = { sessionManager: {} } as any;

    await handleArchive(ctx, core);
    expect(ctx.reply).not.toHaveBeenCalled();
  });

  it("allows archiving error/cancelled sessions", async () => {
    for (const status of ["error", "cancelled"]) {
      const ctx = mockCtx(456);
      const core = {
        sessionManager: {
          getSessionByThread: vi.fn(() => ({ id: "sess-1", status })),
          getRecordByThread: vi.fn(),
        },
      } as any;

      await handleArchive(ctx, core);
      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining("Archive this session"),
        expect.objectContaining({ reply_markup: expect.any(Object) }),
      );
    }
  });
});

describe("handleArchiveConfirm", () => {
  it("cancels when user taps Cancel", async () => {
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

  it("calls core.archiveSession to delete topic and cancel session", async () => {
    const core = {
      archiveSession: vi.fn(() => Promise.resolve({ ok: true })),
    } as any;
    const ctx = {
      callbackQuery: { data: "ar:yes:sess-1" },
      answerCallbackQuery: vi.fn(() => Promise.resolve()),
      editMessageText: vi.fn(() => Promise.resolve()),
    } as any;

    await handleArchiveConfirm(ctx, core, 123);
    expect(core.archiveSession).toHaveBeenCalledWith("sess-1");
  });

  it("shows error when archive fails", async () => {
    const core = {
      archiveSession: vi.fn(() => Promise.resolve({ ok: false, error: "No permission" })),
      notificationManager: { notifyAll: vi.fn(() => Promise.resolve()) },
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

  it("does not send message to new topic after archive", async () => {
    const sendMessage = vi.fn(() => Promise.resolve());
    const core = {
      archiveSession: vi.fn(() => Promise.resolve({ ok: true })),
      adapters: new Map([["telegram", { sendMessage }]]),
    } as any;
    const ctx = {
      callbackQuery: { data: "ar:yes:sess-1" },
      answerCallbackQuery: vi.fn(() => Promise.resolve()),
      editMessageText: vi.fn(() => Promise.resolve()),
    } as any;

    await handleArchiveConfirm(ctx, core, 123);
    expect(sendMessage).not.toHaveBeenCalled();
  });
});
