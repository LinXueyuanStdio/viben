import { afterAll, beforeEach, describe, expect, test, vi } from "vitest";
import { kickSandboxLifecycleWorkflow } from "./lifecycle-kick";

vi.mock("server-only", () => ({}));

type TestSessionRecord = {
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
    sandboxId: string;
  } | null;
  lifecycleRunId: string | null;
};

const state = vi.hoisted(() => {
  const s = {
    sessionRecord: null as TestSessionRecord | null,
    sandboxLifecycleWorkflow: Symbol("sandboxLifecycleWorkflow"),
    spies: {
      start: vi.fn(async () => ({ runId: "workflow-run-1" })),
      claimSessionLifecycleRunId: vi.fn(
        async (sessionId: string, runId: string) => {
          if (
            !s.sessionRecord ||
            s.sessionRecord.id !== sessionId ||
            s.sessionRecord.lifecycleRunId !== null
          ) {
            return false;
          }

          s.sessionRecord = {
            ...s.sessionRecord,
            lifecycleRunId: runId,
          };
          return true;
        },
      ),
      getSessionById: vi.fn(async () =>
        s.sessionRecord
          ? {
              ...s.sessionRecord,
              sandboxState: s.sessionRecord.sandboxState
                ? { ...s.sessionRecord.sandboxState }
                : null,
            }
          : null,
      ),
      updateSession: vi.fn(
        async (_sessionId: string, patch: Record<string, unknown>) => {
          if (!s.sessionRecord) {
            return null;
          }

          s.sessionRecord = {
            ...s.sessionRecord,
            ...patch,
          } as TestSessionRecord;
          return s.sessionRecord;
        },
      ),
      evaluateSandboxLifecycle: vi.fn(async () => ({ action: "skipped" as const })),
      getLifecycleDueAtMs: vi.fn(() => Date.now()),
      canOperateOnSandbox: vi.fn(() => true),
    },
  };

  return s;
});

vi.mock("workflow/api", () => ({
  start: state.spies.start,
}));

vi.mock("@/app/workflows/sandbox-lifecycle", () => ({
  sandboxLifecycleWorkflow: state.sandboxLifecycleWorkflow,
}));

vi.mock("@/lib/db/sessions", () => ({
  claimSessionLifecycleRunId: state.spies.claimSessionLifecycleRunId,
  getSessionById: state.spies.getSessionById,
  updateSession: state.spies.updateSession,
}));

vi.mock("./lifecycle", () => ({
  evaluateSandboxLifecycle: state.spies.evaluateSandboxLifecycle,
  getLifecycleDueAtMs: state.spies.getLifecycleDueAtMs,
}));

vi.mock("./utils", () => ({
  canOperateOnSandbox: state.spies.canOperateOnSandbox,
}));

const scheduledCallbacks: Array<() => Promise<void>> = [];

const originalConsoleError = console.error;
const originalConsoleLog = console.log;
const consoleErrorSpy = vi.fn(() => {});
const consoleLogSpy = vi.fn(() => {});

afterAll(() => {
  console.error = originalConsoleError;
  console.log = originalConsoleLog;
});

describe("kickSandboxLifecycleWorkflow", () => {
  beforeEach(() => {
    state.sessionRecord = {
      id: "session-1",
      status: "running",
      lifecycleState: "active",
      sandboxState: {
        type: "vercel",
        sandboxId: "sandbox-1",
      },
      lifecycleRunId: null,
    };
    scheduledCallbacks.length = 0;
    Object.values(state.spies).forEach((spy) => spy.mockClear());
    consoleErrorSpy.mockClear();
    consoleLogSpy.mockClear();
    console.error = consoleErrorSpy as typeof console.error;
    console.log = consoleLogSpy as typeof console.log;
  });

  test("claims the lifecycle lease before starting so overlapping kicks only start one workflow", async () => {
    const scheduleBackgroundWork = (callback: () => Promise<void>) => {
      scheduledCallbacks.push(callback);
    };

    kickSandboxLifecycleWorkflow({
      sessionId: "session-1",
      reason: "status-check-overdue",
      scheduleBackgroundWork,
    });
    kickSandboxLifecycleWorkflow({
      sessionId: "session-1",
      reason: "status-check-overdue",
      scheduleBackgroundWork,
    });

    expect(scheduledCallbacks).toHaveLength(2);

    await Promise.all(scheduledCallbacks.map((callback) => callback()));

    expect(state.spies.claimSessionLifecycleRunId).toHaveBeenCalledTimes(2);
    expect(state.spies.start).toHaveBeenCalledTimes(1);
    expect(state.spies.evaluateSandboxLifecycle).not.toHaveBeenCalled();

    const startCalls = state.spies.start.mock.calls as unknown as Array<
      [unknown, [string, string, string]]
    >;
    const startArgs = startCalls[0];
    expect(startArgs?.[0]).toBe(state.sandboxLifecycleWorkflow);
    expect(startArgs?.[1]?.[0]).toBe("session-1");
    expect(startArgs?.[1]?.[1]).toBe("status-check-overdue");
    expect(state.sessionRecord?.lifecycleRunId).not.toBeNull();
  });

  test("releases the claimed lease and falls back inline when workflow start fails", async () => {
    state.spies.start.mockImplementationOnce(async () => {
      throw new Error("workflow start failed");
    });

    kickSandboxLifecycleWorkflow({
      sessionId: "session-1",
      reason: "status-check-overdue",
      scheduleBackgroundWork: (callback) => {
        scheduledCallbacks.push(callback);
      },
    });

    expect(scheduledCallbacks).toHaveLength(1);

    await scheduledCallbacks[0]?.();

    expect(state.spies.start).toHaveBeenCalledTimes(1);
    expect(state.spies.evaluateSandboxLifecycle).toHaveBeenCalledTimes(1);
    expect(state.spies.updateSession).toHaveBeenCalledWith("session-1", {
      lifecycleRunId: null,
    });
    expect(state.sessionRecord?.lifecycleRunId).toBeNull();
  });
});
