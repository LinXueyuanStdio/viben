import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  currentOwnedSession: null as Record<string, any> | null,
  activePageSession: undefined as Record<string, any> | undefined,
  activePageSessionAfterConflict: undefined as Record<string, any> | undefined,
  updateSession: vi.fn(),
}));

vi.mock("@/app/api/sessions/_lib/session-context", () => ({
  requireAuthenticatedUser: async () => ({ ok: true, userId: "user-1" }),
  requireOwnedSession: async () => ({
    ok: true,
    sessionRecord: mocks.currentOwnedSession,
  }),
}));

vi.mock("@/lib/db/sessions", () => ({
  deleteSession: vi.fn(),
  getActivePageSession: async () =>
    mocks.updateSession.mock.calls.length > 0
      ? mocks.activePageSessionAfterConflict
      : mocks.activePageSession,
  updateSession: mocks.updateSession,
}));

const routeModulePromise = import("./route");

function sessionRequest(body: unknown): Request {
  return new Request("http://localhost/api/sessions/session-archived", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const sessionContext = {
  params: Promise.resolve({ sessionId: "session-archived" }),
};

describe("PATCH /api/sessions/[sessionId]", () => {
  beforeEach(() => {
    mocks.currentOwnedSession = {
      id: "session-archived",
      userId: "user-1",
      status: "archived",
      agentType: "chat",
      publishedPageId: "page-1",
    };
    mocks.activePageSession = undefined;
    mocks.activePageSessionAfterConflict = undefined;
    mocks.updateSession.mockReset();
  });

  test("does not unarchive a page session when another active page session exists", async () => {
    mocks.activePageSession = {
      ...mocks.currentOwnedSession,
      id: "session-winner",
      status: "running",
    };
    const { PATCH } = await routeModulePromise;

    const response = await PATCH(
      sessionRequest({ status: "running" }),
      sessionContext,
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "An active page session already exists",
      session_id: "session-winner",
    });
    expect(mocks.updateSession).not.toHaveBeenCalled();
  });

  test("keeps the work session unarchive flow unchanged", async () => {
    mocks.currentOwnedSession = {
      ...mocks.currentOwnedSession,
      agentType: "work",
      publishedPageId: null,
    };
    mocks.updateSession.mockResolvedValue({
      ...mocks.currentOwnedSession,
      status: "running",
    });
    const { PATCH } = await routeModulePromise;

    const response = await PATCH(
      sessionRequest({ status: "running" }),
      sessionContext,
    );

    expect(response.status).toBe(200);
    expect(mocks.updateSession).toHaveBeenCalledWith("session-archived", {
      status: "running",
    });
  });

  test("returns the winning active page session after a concurrent unarchive conflict", async () => {
    mocks.updateSession.mockRejectedValue(
      Object.assign(new Error("duplicate"), { code: "23505" }),
    );
    mocks.activePageSessionAfterConflict = {
      ...mocks.currentOwnedSession,
      id: "session-winner",
      status: "running",
    };
    const { PATCH } = await routeModulePromise;

    const response = await PATCH(
      sessionRequest({ status: "running" }),
      sessionContext,
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "An active page session already exists",
      session_id: "session-winner",
    });
  });
});
