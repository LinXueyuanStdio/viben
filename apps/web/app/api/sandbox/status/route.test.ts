import { beforeEach, describe, expect, test, vi } from "vitest";
import { GET } from "./route";

interface KickCall {
  sessionId: string;
  reason: string;
}

const state = vi.hoisted(() => ({
  kickCalls: [] as KickCall[],
  updateCalls: [] as Array<{
    sessionId: string;
    patch: Record<string, unknown>;
  }>,
  sessionRecord: undefined as
    | {
        id: string;
        userId: string;
        sandboxState: {
          type: "vercel";
          sandboxName: string;
          expiresAt: number;
        };
        lifecycleState: "active" | "failed";
        lifecycleError: string | null;
        lifecycleVersion: number;
        hibernateAfter: Date | null;
        sandboxExpiresAt: Date | null;
        snapshotUrl: string | null;
        lastActivityAt: Date | null;
        updatedAt: Date;
      }
    | undefined,
}));

vi.mock("server-only", () => ({}));

vi.mock("@/app/api/sessions/_lib/session-context", () => ({
  requireAuthenticatedUser: async () => ({ ok: true, userId: "user-1" }),
  requireOwnedSession: async () => ({
    ok: true,
    sessionRecord: state.sessionRecord,
  }),
}));

vi.mock("@/lib/db/sessions", () => ({
  getChatsBySessionId: async () => [],
  getSessionById: async () => state.sessionRecord,
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
  getLifecycleDueAtMs: (source: {
    hibernateAfter: Date | null;
    lastActivityAt: Date | null;
    sandboxExpiresAt: Date | null;
    updatedAt: Date;
  }) => {
    if (source.hibernateAfter) {
      return source.hibernateAfter.getTime();
    }
    return source.updatedAt.getTime();
  },
  getSandboxExpiresAtDate: (
    sandboxState: { expiresAt?: unknown } | null | undefined,
  ) =>
    typeof sandboxState?.expiresAt === "number"
      ? new Date(sandboxState.expiresAt)
      : null,
}));

vi.mock("@/lib/sandbox/lifecycle-kick", () => ({
  kickSandboxLifecycleWorkflow: (input: KickCall) => {
    state.kickCalls.push(input);
  },
}));

describe("/api/sandbox/status lifecycle safety net", () => {
  beforeEach(() => {
    state.kickCalls.length = 0;
    state.updateCalls.length = 0;

    state.sessionRecord = {
      id: "session-1",
      userId: "user-1",
      sandboxState: {
        type: "vercel",
        sandboxName: "session_session-1",
        expiresAt: Date.now() + 5 * 60_000,
      },
      lifecycleState: "active",
      lifecycleError: null,
      lifecycleVersion: 10,
      hibernateAfter: new Date(Date.now() - 2_000),
      sandboxExpiresAt: new Date(Date.now() + 5 * 60_000),
      snapshotUrl: null,
      lastActivityAt: new Date(Date.now() - 5_000),
      updatedAt: new Date(Date.now() - 5_000),
    };
  });

  test("kicks overdue lifecycle immediately", async () => {
    const response = await GET(
      new Request("http://localhost/api/sandbox/status?sessionId=session-1"),
    );
    const payload = (await response.json()) as {
      status: string;
      hasSnapshot: boolean;
    };

    expect(response.ok).toBe(true);
    expect(payload.status).toBe("active");
    expect(payload.hasSnapshot).toBe(false);
    expect(state.kickCalls.length).toBe(1);
    expect(state.kickCalls[0]).toEqual({
      sessionId: "session-1",
      reason: "status-check-overdue",
    });
    expect(state.updateCalls).toHaveLength(0);
  });

  test("recovers failed lifecycle state when runtime sandbox is still active", async () => {
    state.sessionRecord!.lifecycleState = "failed";
    state.sessionRecord!.lifecycleError = "snapshot failed";
    state.sessionRecord!.hibernateAfter = new Date(Date.now() + 30_000);

    const response = await GET(
      new Request("http://localhost/api/sandbox/status?sessionId=session-1"),
    );
    const payload = (await response.json()) as {
      status: string;
      hasSnapshot: boolean;
      lifecycle: { state: string | null };
    };

    expect(response.ok).toBe(true);
    expect(payload.status).toBe("active");
    expect(payload.hasSnapshot).toBe(false);
    expect(payload.lifecycle.state).toBe("active");
    expect(state.updateCalls).toHaveLength(1);
    expect(state.updateCalls[0]?.sessionId).toBe("session-1");
    expect(state.updateCalls[0]?.patch.lifecycleState).toBe("active");
    expect(state.updateCalls[0]?.patch.lifecycleError).toBeNull();
    expect(state.kickCalls).toHaveLength(0);
  });
});
