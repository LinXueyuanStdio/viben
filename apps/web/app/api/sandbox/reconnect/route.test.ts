import { beforeEach, describe, expect, test, vi } from "vitest";
import { GET } from "./route";

const state = vi.hoisted(() => ({
  updateCalls: [] as Array<{
    sessionId: string;
    patch: Record<string, unknown>;
  }>,
  probeResult: {
    success: true,
    stdout: "ok",
    stderr: "",
  } as {
    success: boolean;
    stdout: string;
    stderr: string;
  },
  sessionRecord: {
    id: "session-1",
    userId: "user-1",
    snapshotUrl: null,
    lifecycleState: "failed",
    lifecycleError: null,
    sandboxState: {
      type: "vercel",
    },
    lastActivityAt: null,
    hibernateAfter: null,
    sandboxExpiresAt: null,
  } as {
    id: string;
    userId: string;
    snapshotUrl: string | null;
    lifecycleState: "failed" | "active" | "hibernated";
    lifecycleError: string | null;
    sandboxState: {
      type: "vercel";
      sandboxName?: string;
      expiresAt?: number;
    };
    lastActivityAt: Date | null;
    hibernateAfter: Date | null;
    sandboxExpiresAt: Date | null;
  },
}));

vi.mock("server-only", () => ({}));

vi.mock("@/app/api/sessions/_lib/session-context", () => ({
  requireAuthenticatedUser: async () => ({ ok: true, userId: "user-1" }),
  requireOwnedSession: async () => ({ ok: true, sessionRecord: state.sessionRecord }),
}));

vi.mock("@/lib/db/sessions", () => ({
  updateSession: async (sessionId: string, patch: Record<string, unknown>) => {
    state.updateCalls.push({ sessionId, patch });
    state.sessionRecord = {
      ...state.sessionRecord,
      ...patch,
    } as typeof state.sessionRecord;
    return state.sessionRecord;
  },
}));

vi.mock("@/lib/sandbox/lifecycle", () => ({
  buildHibernatedLifecycleUpdate: () => ({
    lifecycleState: "hibernated",
    sandboxExpiresAt: null,
    hibernateAfter: null,
    lifecycleRunId: null,
    lifecycleError: null,
  }),
  getSandboxExpiresAtDate: (
    sandboxState: { expiresAt?: unknown } | null | undefined,
  ) =>
    typeof sandboxState?.expiresAt === "number"
      ? new Date(sandboxState.expiresAt)
      : null,
}));

vi.mock("@viben/sandbox", () => ({
  connectSandbox: async (sandboxState: {
    type: "vercel";
    sandboxName?: string;
    expiresAt?: number;
  }) => {
    const expiresAt = Date.now() + 2 * 60_000;
    return {
      workingDirectory: "/vercel/sandbox",
      expiresAt,
      exec: async () => state.probeResult,
      getState: () => ({
        ...sandboxState,
        ...(sandboxState.sandboxName
          ? { sandboxName: sandboxState.sandboxName }
          : {}),
        expiresAt,
      }),
    };
  },
}));

describe("/api/sandbox/reconnect", () => {
  beforeEach(() => {
    state.updateCalls.length = 0;
    state.probeResult = {
      success: true,
      stdout: "ok",
      stderr: "",
    };

    const now = Date.now();
    state.sessionRecord = {
      id: "session-1",
      userId: "user-1",
      snapshotUrl: "snap-1",
      lifecycleState: "failed",
      lifecycleError: "snapshot failed",
      sandboxState: {
        type: "vercel",
        sandboxName: "session_session-1",
        expiresAt: now + 5 * 60_000,
      },
      lastActivityAt: new Date(now - 5_000),
      hibernateAfter: new Date(now + 10_000),
      sandboxExpiresAt: new Date(now + 5 * 60_000),
    };
  });

  test("recovers failed lifecycle state when reconnect succeeds", async () => {
    const response = await GET(
      new Request("http://localhost/api/sandbox/reconnect?sessionId=session-1"),
    );
    const payload = (await response.json()) as {
      status: string;
      hasSnapshot: boolean;
      expiresAt?: number;
      lifecycle: { state: string | null };
    };

    expect(response.ok).toBe(true);
    expect(payload.status).toBe("connected");
    expect(payload.hasSnapshot).toBe(false);
    expect(payload.lifecycle.state).toBe("active");
    expect(typeof payload.expiresAt).toBe("number");

    expect(state.updateCalls).toHaveLength(1);
    expect(state.updateCalls[0]?.sessionId).toBe("session-1");
    expect(state.updateCalls[0]?.patch.lifecycleState).toBe("active");
    expect(state.updateCalls[0]?.patch.lifecycleError).toBeNull();
  });

  test("marks sandbox expired when the reconnect probe hits a 410", async () => {
    state.probeResult = {
      success: false,
      stdout: "",
      stderr: "Status code 410 is not ok",
    };

    const response = await GET(
      new Request("http://localhost/api/sandbox/reconnect?sessionId=session-1"),
    );
    const payload = (await response.json()) as {
      status: string;
      lifecycle: { state: string | null };
    };

    expect(response.ok).toBe(true);
    expect(payload.status).toBe("expired");
    expect(payload.lifecycle.state).toBe("hibernated");

    expect(state.updateCalls).toHaveLength(1);
    expect(state.updateCalls[0]?.sessionId).toBe("session-1");
    expect(state.updateCalls[0]?.patch.lifecycleState).toBe("hibernated");
    expect(state.updateCalls[0]?.patch.lifecycleError).toBeNull();
    expect(state.updateCalls[0]?.patch.sandboxState).toEqual({
      type: "vercel",
      sandboxName: "session_session-1",
    });
  });

  test("drops a missing sandbox resume handle when the reconnect probe hits a 404", async () => {
    state.sessionRecord.snapshotUrl = null;
    state.probeResult = {
      success: false,
      stdout: "",
      stderr: "Status code 404 is not ok",
    };

    const response = await GET(
      new Request("http://localhost/api/sandbox/reconnect?sessionId=session-1"),
    );
    const payload = (await response.json()) as {
      status: string;
      hasSnapshot: boolean;
      lifecycle: { state: string | null };
    };

    expect(response.ok).toBe(true);
    expect(payload.status).toBe("expired");
    expect(payload.hasSnapshot).toBe(false);
    expect(payload.lifecycle.state).toBe("hibernated");

    expect(state.updateCalls).toHaveLength(1);
    expect(state.updateCalls[0]?.sessionId).toBe("session-1");
    expect(state.updateCalls[0]?.patch.lifecycleState).toBe("hibernated");
    expect(state.updateCalls[0]?.patch.lifecycleError).toBeNull();
    expect(state.updateCalls[0]?.patch.sandboxState).toEqual({
      type: "vercel",
    });
  });
});
