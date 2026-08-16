import { beforeEach, describe, expect, test, vi } from "vitest";
import { POST, PUT } from "./route";

type TestSandboxState = {
  type: "vercel";
  sandboxName?: string;
  expiresAt?: number;
};

type TestSessionRecord = {
  id: string;
  userId: string;
  sandboxState: TestSandboxState | null;
  snapshotUrl: string | null;
  snapshotCreatedAt: Date | null;
  lifecycleVersion: number;
  lifecycleState: string | null;
  sandboxExpiresAt: Date | null;
  hibernateAfter: Date | null;
  lastActivityAt: Date | null;
};

const state = vi.hoisted(() => ({
  connectCalls: [] as Array<{
    state: Record<string, unknown>;
    options: Record<string, unknown> | undefined;
  }>,
  updateCalls: [] as Array<Record<string, unknown>>,
  kickCalls: [] as Array<{ sessionId: string; reason: string }>,
  stopCallCount: 0,
  connectSandboxResumeError: null as Error | null,
  sessionRecord: undefined as TestSessionRecord | undefined,
}));

vi.mock("server-only", () => ({}));

vi.mock("@/app/api/sessions/_lib/session-context", () => ({
  requireAuthenticatedUser: async () => ({
    ok: true as const,
    userId: "user-1",
  }),
  requireOwnedSession: async () => ({
    ok: true as const,
    sessionRecord: state.sessionRecord,
  }),
  requireOwnedSessionWithSandboxGuard: async ({
    sandboxGuard,
  }: {
    sandboxGuard: (state: TestSandboxState | null) => boolean;
  }) =>
    sandboxGuard(state.sessionRecord!.sandboxState)
      ? ({ ok: true as const, sessionRecord: state.sessionRecord } as const)
      : ({
          ok: false as const,
          response: Response.json(
            { error: "Sandbox not initialized" },
            { status: 400 },
          ),
        } as const),
}));

vi.mock("@/lib/db/sessions", () => ({
  getChatsBySessionId: async () => [],
  getSessionById: async () => state.sessionRecord,
  updateSession: async (_sessionId: string, patch: Record<string, unknown>) => {
    state.updateCalls.push(patch);
    state.sessionRecord = {
      ...state.sessionRecord,
      ...(patch as Partial<TestSessionRecord>),
    };
    return state.sessionRecord;
  },
}));

vi.mock("@/lib/sandbox/lifecycle-kick", () => ({
  kickSandboxLifecycleWorkflow: (input: {
    sessionId: string;
    reason: string;
  }) => {
    state.kickCalls.push(input);
  },
}));

vi.mock("@viben/sandbox", () => ({
  connectSandbox: async (
    sandboxState: Record<string, unknown>,
    options?: Record<string, unknown>,
  ) => {
    state.connectCalls.push({ state: sandboxState, options });

    if (
      state.connectSandboxResumeError &&
      options?.resume === true &&
      typeof sandboxState.sandboxName === "string" &&
      sandboxState.snapshotId === undefined
    ) {
      throw state.connectSandboxResumeError;
    }

    const sandboxName =
      typeof sandboxState.sandboxName === "string"
        ? sandboxState.sandboxName
        : "session_session-1";
    return {
      id: "runtime-1",
      expiresAt: Date.now() + 120_000,
      workingDirectory: "/vercel/sandbox",
      stop: async () => {
        state.stopCallCount += 1;
      },
      getState: () => ({
        type: "vercel" as const,
        sandboxName,
        expiresAt: Date.now() + 120_000,
      }),
    };
  },
}));

function makeSessionRecord(
  overrides: Partial<TestSessionRecord> = {},
): TestSessionRecord {
  return {
    id: "session-1",
    userId: "user-1",
    sandboxState: {
      type: "vercel",
      sandboxName: "session_session-1",
      expiresAt: Date.now() + 60_000,
    },
    snapshotUrl: null,
    snapshotCreatedAt: null,
    lifecycleVersion: 2,
    lifecycleState: "active",
    sandboxExpiresAt: new Date(Date.now() + 60_000),
    hibernateAfter: new Date(Date.now() + 30_000),
    lastActivityAt: new Date(),
    ...overrides,
  };
}

describe("/api/sandbox/snapshot", () => {
  beforeEach(() => {
    state.connectCalls.length = 0;
    state.updateCalls.length = 0;
    state.kickCalls.length = 0;
    state.stopCallCount = 0;
    state.connectSandboxResumeError = null;
    state.sessionRecord = makeSessionRecord();
  });

  test("POST pauses a named persistent sandbox without writing a legacy snapshot", async () => {
    const response = await POST(
      new Request("http://localhost/api/sandbox/snapshot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: "session-1" }),
      }),
    );
    const payload = (await response.json()) as {
      snapshotId: string | null;
    };

    expect(response.ok).toBe(true);
    expect(state.stopCallCount).toBe(1);
    expect(payload.snapshotId).toBe("session_session-1");
    expect(state.connectCalls[0]).toMatchObject({
      state: {
        type: "vercel",
        sandboxName: "session_session-1",
      },
    });
    expect(state.updateCalls[0]).toEqual(
      expect.objectContaining({
        snapshotUrl: null,
        snapshotCreatedAt: null,
        sandboxState: {
          type: "vercel",
          sandboxName: "session_session-1",
        },
        lifecycleVersion: 3,
        lifecycleState: "hibernated",
      }),
    );
  });

  test("PUT resumes an existing named persistent sandbox", async () => {
    state.sessionRecord = makeSessionRecord({
      sandboxState: {
        type: "vercel",
        sandboxName: "session_session-1",
      },
      lifecycleState: "hibernated",
      sandboxExpiresAt: null,
      hibernateAfter: null,
    });

    const response = await PUT(
      new Request("http://localhost/api/sandbox/snapshot", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: "session-1" }),
      }),
    );

    expect(response.ok).toBe(true);
    expect(state.connectCalls[0]).toMatchObject({
      state: {
        type: "vercel",
        sandboxName: "session_session-1",
      },
      options: {
        resume: true,
      },
    });
    expect(state.updateCalls[0]).toEqual(
      expect.objectContaining({
        sandboxState: expect.objectContaining({
          type: "vercel",
          sandboxName: "session_session-1",
        }),
        snapshotUrl: null,
        snapshotCreatedAt: null,
        lifecycleVersion: 3,
      }),
    );
    expect(state.kickCalls).toEqual([
      { sessionId: "session-1", reason: "snapshot-restored" },
    ]);
  });

  test("PUT clears a broken persistent sandbox handle after a 404", async () => {
    state.sessionRecord = makeSessionRecord({
      sandboxState: {
        type: "vercel",
        sandboxName: "session_session-1",
      },
      snapshotUrl: null,
      lifecycleState: "hibernated",
      sandboxExpiresAt: null,
      hibernateAfter: null,
    });
    state.connectSandboxResumeError = new Error("Status code 404 is not ok");

    const response = await PUT(
      new Request("http://localhost/api/sandbox/snapshot", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: "session-1" }),
      }),
    );
    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(404);
    expect(payload.error).toContain("Saved sandbox is no longer available");
    expect(state.updateCalls[0]).toEqual(
      expect.objectContaining({
        sandboxState: {
          type: "vercel",
        },
        lifecycleState: "hibernated",
      }),
    );
  });

  test("PUT lazily migrates a legacy snapshot-backed session on first resume", async () => {
    state.sessionRecord = makeSessionRecord({
      sandboxState: { type: "vercel" },
      snapshotUrl: "snap-legacy-1",
      lifecycleState: "hibernated",
      sandboxExpiresAt: null,
      hibernateAfter: null,
    });

    const response = await PUT(
      new Request("http://localhost/api/sandbox/snapshot", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: "session-1" }),
      }),
    );

    expect(response.ok).toBe(true);
    expect(state.connectCalls[0]).toMatchObject({
      state: {
        type: "vercel",
        sandboxName: "session_session-1",
        snapshotId: "snap-legacy-1",
      },
      options: {
        resume: true,
        createIfMissing: true,
        persistent: true,
      },
    });
    expect(state.updateCalls[0]).toEqual(
      expect.objectContaining({
        sandboxState: expect.objectContaining({
          type: "vercel",
          sandboxName: "session_session-1",
        }),
        snapshotUrl: null,
        snapshotCreatedAt: null,
        lifecycleVersion: 3,
      }),
    );
    expect(state.kickCalls).toEqual([
      { sessionId: "session-1", reason: "snapshot-restored" },
    ]);
  });
});
