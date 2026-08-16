import { beforeEach, describe, expect, test, vi } from "vitest";
import type { WebAgentUIMessage } from "@/app/types";

// ── Mutable spy state ──────────────────────────────────────────────

const state = vi.hoisted(() => {
  const s = {
    createChatMessageIfNotExistsResult: { id: "msg-1" } as unknown,
    isFirstChatMessageResult: false,
    upsertChatMessageScopedResult: { status: "inserted" } as {
      status: string;
    },
  };

  const sandboxExec = vi.fn(() =>
    Promise.resolve({ success: true, stdout: " M file.ts\n" }),
  );

  const spies = {
    claimChatActiveStreamId: vi.fn(() => Promise.resolve(true)),
    compareAndSetChatActiveStreamId: vi.fn(() => Promise.resolve(true)),
    createChatMessageIfNotExists: vi.fn(
      () =>
        Promise.resolve(s.createChatMessageIfNotExistsResult) as Promise<unknown>,
    ),
    isFirstChatMessage: vi.fn(
      () => Promise.resolve(s.isFirstChatMessageResult) as Promise<boolean>,
    ),
    touchChat: vi.fn(() => Promise.resolve()),
    updateChat: vi.fn((_chatId: string, _patch: Record<string, unknown>) =>
      Promise.resolve(),
    ),
    updateChatAssistantActivity: vi.fn(() => Promise.resolve()),
    updateSession: vi.fn((_sessionId: string, _patch: Record<string, unknown>) =>
      Promise.resolve(),
    ),
    upsertChatMessageScoped: vi.fn(() =>
      Promise.resolve(s.upsertChatMessageScopedResult),
    ),
    recordUsage: vi.fn(() => Promise.resolve()),
    buildActiveLifecycleUpdate: vi.fn(() => ({})),
    buildLifecycleActivityUpdate: vi.fn(() => ({})),
    connectSandbox: vi.fn(() =>
      Promise.resolve({
        workingDirectory: "/vercel/sandbox",
        exec: sandboxExec,
        getState: () => ({ type: "vercel", sandboxId: "sb-1" }),
      }),
    ),
    computeAndCacheDiff: vi.fn(() => Promise.resolve()),
    performAutoCommit: vi.fn(() =>
      Promise.resolve({ committed: true, pushed: true }),
    ),
    performAutoCreatePr: vi.fn(() =>
      Promise.resolve({ created: true, syncedExisting: false, skipped: false }),
    ),
  };

  return Object.assign(s, { sandboxExec, spies });
});

// ── Module mocks (must appear before the module-under-test import) ──

vi.mock("@/lib/db/sessions", () => ({
  claimChatActiveStreamId: state.spies.claimChatActiveStreamId,
  compareAndSetChatActiveStreamId: state.spies.compareAndSetChatActiveStreamId,
  createChatMessageIfNotExists: state.spies.createChatMessageIfNotExists,
  isFirstChatMessage: state.spies.isFirstChatMessage,
  touchChat: state.spies.touchChat,
  updateChat: state.spies.updateChat,
  updateChatAssistantActivity: state.spies.updateChatAssistantActivity,
  updateSession: state.spies.updateSession,
  upsertChatMessageScoped: state.spies.upsertChatMessageScoped,
}));

vi.mock("@/lib/db/usage", () => ({
  recordUsage: state.spies.recordUsage,
}));

vi.mock("@/lib/sandbox/lifecycle", () => ({
  buildActiveLifecycleUpdate: state.spies.buildActiveLifecycleUpdate,
  buildLifecycleActivityUpdate: state.spies.buildLifecycleActivityUpdate,
}));

vi.mock("@viben/sandbox", () => ({
  connectSandbox: state.spies.connectSandbox,
}));

vi.mock("@/lib/diff/compute-diff", () => ({
  computeAndCacheDiff: state.spies.computeAndCacheDiff,
}));

vi.mock("@/lib/chat/auto-commit-direct", () => ({
  performAutoCommit: state.spies.performAutoCommit,
}));

vi.mock("@/lib/chat/auto-pr-direct", () => ({
  performAutoCreatePr: state.spies.performAutoCreatePr,
}));

import {
  clearActiveStream,
  hasAutoCommitChangesStep,
  persistAssistantMessage,
  persistSandboxState,
  persistUserMessage,
  refreshDiffCache,
  refreshLifecycleActivity,
  runAutoCommitStep,
  runAutoCreatePrStep,
} from "./chat-post-finish";

// ── Helpers ────────────────────────────────────────────────────────

function makeUserMessage(
  overrides?: Partial<WebAgentUIMessage>,
): WebAgentUIMessage {
  return {
    id: "msg-1",
    role: "user",
    parts: [{ type: "text", text: "Hello world, this is a test message" }],
    ...overrides,
  } as WebAgentUIMessage;
}

function makeAssistantMessage(
  overrides?: Partial<WebAgentUIMessage>,
): WebAgentUIMessage {
  return {
    id: "msg-2",
    role: "assistant",
    parts: [{ type: "text", text: "Response" }],
    ...overrides,
  } as WebAgentUIMessage;
}

// ── Tests ──────────────────────────────────────────────────────────

beforeEach(() => {
  state.sandboxExec.mockClear();
  state.sandboxExec.mockImplementation(() =>
    Promise.resolve({ success: true, stdout: " M file.ts\n" }),
  );
  Object.values(state.spies).forEach((spy) => spy.mockClear());
  state.createChatMessageIfNotExistsResult = { id: "msg-1" };
  state.isFirstChatMessageResult = false;
  state.upsertChatMessageScopedResult = { status: "inserted" };
});

// ─── persistUserMessage ────────────────────────────────────────────

describe("persistUserMessage", () => {
  test("skips non-user messages", async () => {
    await persistUserMessage("chat-1", makeAssistantMessage());
    expect(state.spies.createChatMessageIfNotExists).not.toHaveBeenCalled();
  });

  test("creates message and touches chat", async () => {
    await persistUserMessage("chat-1", makeUserMessage());

    expect(state.spies.createChatMessageIfNotExists).toHaveBeenCalledTimes(1);
    expect(state.spies.touchChat).toHaveBeenCalledWith("chat-1");
  });

  test("returns early when message already exists", async () => {
    state.createChatMessageIfNotExistsResult = undefined;
    await persistUserMessage("chat-1", makeUserMessage());

    expect(state.spies.touchChat).not.toHaveBeenCalled();
  });

  test("sets title when first message with short text", async () => {
    state.isFirstChatMessageResult = true;
    const msg = makeUserMessage({
      parts: [{ type: "text", text: "Fix bug" }],
    });

    await persistUserMessage("chat-1", msg);

    expect(state.spies.updateChat).toHaveBeenCalledWith("chat-1", {
      title: "Fix bug",
    });
  });

  test("truncates title when text exceeds 80 chars", async () => {
    state.isFirstChatMessageResult = true;
    const longText = "A".repeat(100);
    const msg = makeUserMessage({
      parts: [{ type: "text", text: longText }],
    });

    await persistUserMessage("chat-1", msg);

    expect(state.spies.updateChat).toHaveBeenCalledWith("chat-1", {
      title: `${"A".repeat(80)}...`,
    });
  });

  test("skips title when no text parts", async () => {
    state.isFirstChatMessageResult = true;
    const msg = makeUserMessage({
      parts: [{ type: "tool-invocation" as unknown as "text", text: "" }],
    });

    await persistUserMessage("chat-1", msg);

    // updateChat should not be called since text extraction yields ""
    expect(state.spies.updateChat).not.toHaveBeenCalled();
  });

  test("does not throw on db error", async () => {
    state.spies.createChatMessageIfNotExists.mockImplementationOnce(() =>
      Promise.reject(new Error("DB down")),
    );

    // Should not throw
    await persistUserMessage("chat-1", makeUserMessage());
  });
});

// ─── persistAssistantMessage ───────────────────────────────────────

describe("persistAssistantMessage", () => {
  test("upserts assistant message and updates activity on insert", async () => {
    state.upsertChatMessageScopedResult = { status: "inserted" };

    await persistAssistantMessage("chat-1", makeAssistantMessage());

    expect(state.spies.upsertChatMessageScoped).toHaveBeenCalledTimes(1);
    expect(state.spies.updateChatAssistantActivity).toHaveBeenCalledTimes(1);
  });

  test("skips activity update on conflict", async () => {
    state.upsertChatMessageScopedResult = { status: "conflict" };

    await persistAssistantMessage("chat-1", makeAssistantMessage());

    expect(state.spies.upsertChatMessageScoped).toHaveBeenCalledTimes(1);
    expect(state.spies.updateChatAssistantActivity).not.toHaveBeenCalled();
  });

  test("skips activity update on update status", async () => {
    state.upsertChatMessageScopedResult = { status: "updated" };

    await persistAssistantMessage("chat-1", makeAssistantMessage());

    expect(state.spies.updateChatAssistantActivity).not.toHaveBeenCalled();
  });

  test("does not throw on db error", async () => {
    state.spies.upsertChatMessageScoped.mockImplementationOnce(() =>
      Promise.reject(new Error("DB down")),
    );

    await persistAssistantMessage("chat-1", makeAssistantMessage());
  });
});

// ─── refreshLifecycleActivity ──────────────────────────────────────

describe("refreshLifecycleActivity", () => {
  test("updates session lifecycle timing", async () => {
    await refreshLifecycleActivity("session-1");

    expect(state.spies.buildLifecycleActivityUpdate).toHaveBeenCalledTimes(1);
    expect(state.spies.updateSession).toHaveBeenCalledTimes(1);
    expect(state.spies.updateSession).toHaveBeenCalledWith("session-1", {});
  });

  test("does not throw on update error", async () => {
    state.spies.updateSession.mockImplementationOnce(() =>
      Promise.reject(new Error("DB down")),
    );

    await refreshLifecycleActivity("session-1");
  });
});

// ─── persistSandboxState ───────────────────────────────────────────

describe("persistSandboxState", () => {
  test("connects to sandbox and updates session", async () => {
    await persistSandboxState("session-1", { type: "vercel" } as never);

    expect(state.spies.connectSandbox).toHaveBeenCalledTimes(1);
    expect(state.spies.updateSession).toHaveBeenCalledTimes(1);
  });

  test("skips update when getState returns undefined", async () => {
    state.spies.connectSandbox.mockImplementationOnce(
      () => Promise.resolve({ getState: () => undefined }) as never,
    );

    await persistSandboxState("session-1", { type: "vercel" } as never);

    expect(state.spies.updateSession).not.toHaveBeenCalled();
  });

  test("does not throw on connection error", async () => {
    state.spies.connectSandbox.mockImplementationOnce(() =>
      Promise.reject(new Error("Sandbox unavailable")),
    );

    await persistSandboxState("session-1", { type: "vercel" } as never);
  });
});

// ─── clearActiveStream ─────────────────────────────────────────────

describe("clearActiveStream", () => {
  test("calls compareAndSet with correct args", async () => {
    await clearActiveStream("chat-1", "wrun_abc");

    expect(state.spies.compareAndSetChatActiveStreamId).toHaveBeenCalledWith(
      "chat-1",
      "wrun_abc",
      null,
    );
  });

  test("retries transient db errors before succeeding", async () => {
    state.spies.compareAndSetChatActiveStreamId
      .mockImplementationOnce(() => Promise.reject(new Error("DB down")))
      .mockImplementationOnce(() => Promise.reject(new Error("DB still down")));

    await clearActiveStream("chat-1", "wrun_abc");

    expect(state.spies.compareAndSetChatActiveStreamId).toHaveBeenCalledTimes(3);

    const compareAndSetCalls = state.spies.compareAndSetChatActiveStreamId.mock
      .calls as unknown[][];
    expect(compareAndSetCalls).toEqual([
      ["chat-1", "wrun_abc", null],
      ["chat-1", "wrun_abc", null],
      ["chat-1", "wrun_abc", null],
    ]);
  });

  test("does not throw after retry budget is exhausted", async () => {
    state.spies.compareAndSetChatActiveStreamId
      .mockImplementationOnce(() => Promise.reject(new Error("DB down")))
      .mockImplementationOnce(() => Promise.reject(new Error("DB still down")))
      .mockImplementationOnce(() =>
        Promise.reject(new Error("DB really down")),
      );

    await clearActiveStream("chat-1", "wrun_abc");

    expect(state.spies.compareAndSetChatActiveStreamId).toHaveBeenCalledTimes(3);
  });
});

// ─── refreshDiffCache ──────────────────────────────────────────────

describe("refreshDiffCache", () => {
  test("connects sandbox and computes diff", async () => {
    await refreshDiffCache("session-1", { type: "vercel" } as never);

    expect(state.spies.connectSandbox).toHaveBeenCalledTimes(1);
    expect(state.spies.computeAndCacheDiff).toHaveBeenCalledTimes(1);
  });

  test("does not throw on error", async () => {
    state.spies.connectSandbox.mockImplementationOnce(() =>
      Promise.reject(new Error("Sandbox unavailable")),
    );

    await refreshDiffCache("session-1", { type: "vercel" } as never);
  });
});

// ─── hasAutoCommitChangesStep ───────────────────────────────────────

describe("hasAutoCommitChangesStep", () => {
  test("returns false when git status is clean", async () => {
    state.sandboxExec.mockImplementationOnce(() =>
      Promise.resolve({ success: true, stdout: "" }),
    );

    await expect(
      hasAutoCommitChangesStep({
        sandboxState: { type: "vercel" } as never,
      }),
    ).resolves.toBe(false);
  });

  test("falls back to true when preflight fails", async () => {
    state.sandboxExec.mockImplementationOnce(() =>
      Promise.resolve({ success: false, stdout: "" }),
    );

    await expect(
      hasAutoCommitChangesStep({
        sandboxState: { type: "vercel" } as never,
      }),
    ).resolves.toBe(true);
  });
});

// ─── runAutoCommitStep ─────────────────────────────────────────────

describe("runAutoCommitStep", () => {
  test("connects sandbox and performs auto-commit", async () => {
    await runAutoCommitStep({
      userId: "user-1",
      sessionId: "session-1",
      sessionTitle: "My session",
      repoOwner: "acme",
      repoName: "repo",
      sandboxState: { type: "vercel" } as never,
    });

    expect(state.spies.connectSandbox).toHaveBeenCalledTimes(1);
    expect(state.spies.performAutoCommit).toHaveBeenCalledTimes(1);
    expect(state.spies.performAutoCommit).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        sessionId: "session-1",
        sessionTitle: "My session",
        repoOwner: "acme",
        repoName: "repo",
      }),
    );
  });

  test("does not throw on error", async () => {
    state.spies.performAutoCommit.mockImplementationOnce(() =>
      Promise.reject(new Error("Git error")),
    );

    await runAutoCommitStep({
      userId: "user-1",
      sessionId: "session-1",
      sessionTitle: "My session",
      repoOwner: "acme",
      repoName: "repo",
      sandboxState: { type: "vercel" } as never,
    });
  });
});

describe("runAutoCreatePrStep", () => {
  test("connects sandbox and performs auto PR creation", async () => {
    await runAutoCreatePrStep({
      userId: "user-1",
      sessionId: "session-1",
      sessionTitle: "My session",
      repoOwner: "acme",
      repoName: "repo",
      sandboxState: { type: "vercel" } as never,
    });

    expect(state.spies.connectSandbox).toHaveBeenCalledTimes(1);
    expect(state.spies.performAutoCreatePr).toHaveBeenCalledTimes(1);
    expect(state.spies.performAutoCreatePr).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        sessionId: "session-1",
        sessionTitle: "My session",
        repoOwner: "acme",
        repoName: "repo",
      }),
    );
  });

  test("does not throw on error", async () => {
    state.spies.performAutoCreatePr.mockImplementationOnce(() =>
      Promise.reject(new Error("GitHub error")),
    );

    await runAutoCreatePrStep({
      userId: "user-1",
      sessionId: "session-1",
      sessionTitle: "My session",
      repoOwner: "acme",
      repoName: "repo",
      sandboxState: { type: "vercel" } as never,
    });
  });
});
