import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));

type AuthSession = {
  user: {
    id: string;
  };
} | null;

const state = vi.hoisted(() => ({
  authSession: null as AuthSession,
}));

vi.mock("@/lib/session/get-server-session", () => ({
  getServerSession: async () => state.authSession,
}));

import * as route from "./route";

function createRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/github/create-repo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/github/create-repo", () => {
  beforeEach(() => {
    state.authSession = {
      user: {
        id: "user-1",
      },
    };
  });

  test("returns 401 when unauthenticated", async () => {
    state.authSession = null;
    const { POST } = route;

    const response = await POST(createRequest({ sessionId: "session-1" }));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Not authenticated" });
  });

  test("returns 400 for invalid JSON", async () => {
    const { POST } = route;

    const response = await POST(
      new Request("http://localhost/api/github/create-repo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not-json",
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid JSON body" });
  });

  test("returns disabled response for authenticated users", async () => {
    const { POST } = route;

    const response = await POST(
      createRequest({
        sessionId: "session-1",
        repoName: "repo-1",
      }),
    );

    expect(response.status).toBe(501);
    expect(await response.json()).toEqual({
      error:
        "Creating repositories from Viben Assistant is temporarily disabled. Create the repository on GitHub first, then connect it to a session.",
    });
  });
});
