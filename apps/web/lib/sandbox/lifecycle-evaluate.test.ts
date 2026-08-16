import { beforeEach, describe, expect, test, vi } from "vitest";
import { evaluateSandboxLifecycle } from "./lifecycle";

vi.mock("server-only", () => ({}));

interface TestSessionRecord {
  id: string;
  status: "running" | "completed" | "failed" | "archived";
  lifecycleState:
    | "provisioning"
    | "active"
    | "hibernating"
    | "hibernated"
    | "restoring"
    | "archived"
    | "failed";
  sandboxState: {
    type: "vercel";
    sandboxName: string;
    expiresAt: number;
  };
  hibernateAfter: Date | null;
  lastActivityAt: Date | null;
  sandboxExpiresAt: Date | null;
  updatedAt: Date;
}

const state = vi.hoisted(() => {
  const stopSpy = vi.fn(async () => undefined);

  const s = {
    sessionRecord: null as TestSessionRecord | null,
    chatsInSession: [] as Array<{ id: string; activeStreamId: string | null }>,
    stopSpy,
    spies: {
      getChatsBySessionId: vi.fn(
        async (_sessionId: string) => s.chatsInSession as never,
      ),
      getSessionById: vi.fn(
        async (_sessionId: string) => s.sessionRecord as never,
      ),
      updateSession: vi.fn(
        async (_sessionId: string, patch: Record<string, unknown>) => patch,
      ),
      connectSandbox: vi.fn(async () => ({
        stop: stopSpy,
      })),
      stop: stopSpy,
    },
  };

  return s;
});

vi.mock("@/lib/db/sessions", () => ({
  getChatsBySessionId: state.spies.getChatsBySessionId,
  getSessionById: state.spies.getSessionById,
  updateSession: state.spies.updateSession,
}));

vi.mock("@viben/sandbox", () => ({
  connectSandbox: state.spies.connectSandbox,
}));

function makeDueSession(): TestSessionRecord {
  const nowMs = Date.now();

  return {
    id: "session-1",
    status: "running",
    lifecycleState: "active",
    sandboxState: {
      type: "vercel",
      sandboxName: "session_session-1",
      expiresAt: nowMs + 5 * 60_000,
    },
    hibernateAfter: new Date(nowMs - 1_000),
    lastActivityAt: new Date(nowMs - 60_000),
    sandboxExpiresAt: null,
    updatedAt: new Date(nowMs - 60_000),
  };
}

beforeEach(() => {
  state.sessionRecord = makeDueSession();
  state.chatsInSession = [];

  Object.values(state.spies).forEach((spy) => spy.mockClear());
});

describe("evaluateSandboxLifecycle", () => {
  test("skips hibernation whenever any chat still has an activeStreamId", async () => {
    state.chatsInSession = [{ id: "chat-1", activeStreamId: "wrun-running-1" }];

    const result = await evaluateSandboxLifecycle(
      "session-1",
      "status-check-overdue",
    );

    expect(result).toEqual({ action: "skipped", reason: "active-workflow" });
    expect(state.spies.connectSandbox).not.toHaveBeenCalled();
    expect(state.spies.updateSession).not.toHaveBeenCalled();
    expect(state.spies.stop).not.toHaveBeenCalled();
  });

  test("rechecks for activeStreamId before stopping and restores active lifecycle state", async () => {
    state.spies.connectSandbox.mockImplementationOnce(async () => {
      state.chatsInSession = [{ id: "chat-1", activeStreamId: "wrun-raced-in-1" }];
      return {
        stop: state.stopSpy,
      };
    });

    const result = await evaluateSandboxLifecycle(
      "session-1",
      "status-check-overdue",
    );

    expect(result).toEqual({ action: "skipped", reason: "active-workflow" });
    expect(state.spies.getChatsBySessionId).toHaveBeenCalledTimes(2);
    expect(state.spies.stop).not.toHaveBeenCalled();

    const updateCalls = state.spies.updateSession.mock.calls as unknown[][];
    const firstPatch = updateCalls[0]?.[1] as Record<string, unknown>;
    const finalPatch = updateCalls.at(-1)?.[1] as Record<string, unknown>;

    expect(firstPatch).toEqual({
      lifecycleState: "hibernating",
      lifecycleError: null,
    });
    expect(finalPatch.lifecycleState).toBe("active");
    expect(finalPatch.lifecycleError).toBeNull();
    expect(finalPatch.sandboxExpiresAt).toBeInstanceOf(Date);
    expect(finalPatch).not.toHaveProperty("lastActivityAt");
    expect(finalPatch).not.toHaveProperty("hibernateAfter");
  });

  test("skips hibernation when lifecycle timing is refreshed before stopping", async () => {
    state.spies.connectSandbox.mockImplementationOnce(async () => {
      if (!state.sessionRecord) {
        throw new Error("sessionRecord must be set");
      }

      const refreshedAt = new Date();
      state.sessionRecord = {
        ...state.sessionRecord,
        lastActivityAt: refreshedAt,
        hibernateAfter: new Date(refreshedAt.getTime() + 60_000),
      };

      return {
        stop: state.stopSpy,
      };
    });

    const result = await evaluateSandboxLifecycle(
      "session-1",
      "status-check-overdue",
    );

    expect(result).toEqual({ action: "skipped", reason: "not-due-yet" });
    expect(state.spies.stop).not.toHaveBeenCalled();

    const updateCalls = state.spies.updateSession.mock.calls as unknown[][];
    const firstPatch = updateCalls[0]?.[1] as Record<string, unknown>;
    const finalPatch = updateCalls.at(-1)?.[1] as Record<string, unknown>;

    expect(firstPatch).toEqual({
      lifecycleState: "hibernating",
      lifecycleError: null,
    });
    expect(finalPatch.lifecycleState).toBe("active");
    expect(finalPatch.lifecycleError).toBeNull();
    expect(finalPatch.sandboxExpiresAt).toBeInstanceOf(Date);
    expect(finalPatch).not.toHaveProperty("lastActivityAt");
    expect(finalPatch).not.toHaveProperty("hibernateAfter");
  });

  test("hibernates by stopping the persistent sandbox session", async () => {
    const result = await evaluateSandboxLifecycle(
      "session-1",
      "status-check-overdue",
    );

    expect(result).toEqual({ action: "hibernated" });
    expect(state.spies.connectSandbox).toHaveBeenCalledTimes(1);
    expect(state.spies.stop).toHaveBeenCalledTimes(1);

    const updateCalls = state.spies.updateSession.mock.calls as unknown[][];
    const firstPatch = updateCalls[0]?.[1] as Record<string, unknown>;
    const finalPatch = updateCalls.at(-1)?.[1] as Record<string, unknown>;

    expect(firstPatch.lifecycleState).toBe("hibernating");
    expect(finalPatch).toEqual(
      expect.objectContaining({
        lifecycleState: "hibernated",
        snapshotUrl: null,
        snapshotCreatedAt: null,
        sandboxState: {
          type: "vercel",
          sandboxName: "session_session-1",
        },
      }),
    );
  });
});
