import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));

type AuthSession = {
  user: {
    id: string;
  };
} | null;

const state = vi.hoisted(() => {
  const s = {
    authSession: null as AuthSession,
    hasLinkedGitHub: false,
    installations: [] as Array<{ installationId: number }>,
    userToken: null as string | null,
    githubUsername: null as string | null,
    syncedInstallationsCount: 0,
    syncError: null as Error | null,
    syncErrorIsAuth: false,
  };
  return s;
});

vi.mock("@/lib/session/get-server-session", () => ({
  getServerSession: async () => state.authSession,
}));

vi.mock("@/lib/github/token", () => ({
  getGitHubRepoOAuthToken: async () => state.userToken,
}));

vi.mock("@/lib/github/users", () => ({
  hasGitHubAccount: async () => state.hasLinkedGitHub,
  getGitHubUsernameForToken: async () => state.githubUsername,
  getGitHubAccountId: async () => null,
}));

vi.mock("@/lib/db/installations", () => ({
  getInstallationsByUserId: async () => state.installations,
}));

vi.mock("@/lib/github/sync", () => ({
  syncUserInstallations: async () => {
    if (state.syncError) {
      throw state.syncError;
    }

    return state.syncedInstallationsCount;
  },
  isGitHubInstallationsAuthError: () => state.syncErrorIsAuth,
}));

import * as route from "./route";

describe("GET /api/github/connection-status", () => {
  beforeEach(() => {
    state.authSession = { user: { id: "user-1" } };
    state.hasLinkedGitHub = true;
    state.installations = [{ installationId: 1 }];
    state.userToken = "ghu_user";
    state.githubUsername = "octocat";
    state.syncedInstallationsCount = 1;
    state.syncError = null;
    state.syncErrorIsAuth = false;
  });

  test("returns 401 when unauthenticated", async () => {
    state.authSession = null;
    const { GET } = route;

    const response = await GET();

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Not authenticated" });
  });

  test("returns not_connected when no GitHub account is linked", async () => {
    state.hasLinkedGitHub = false;
    state.installations = [];
    const { GET } = route;

    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: "not_connected",
      reason: null,
      hasInstallations: false,
      syncedInstallationsCount: 0,
    });
  });

  test("requires reconnect when no usable token is available", async () => {
    state.userToken = null;
    const { GET } = route;

    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: "reconnect_required",
      reason: "token_unavailable",
      hasInstallations: true,
      syncedInstallationsCount: null,
    });
  });

  test("requires reconnect when live sync drops cached installations to zero", async () => {
    state.syncedInstallationsCount = 0;
    const { GET } = route;

    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: "reconnect_required",
      reason: "installations_missing",
      hasInstallations: false,
      syncedInstallationsCount: 0,
    });
  });

  test("stays connected when sync succeeds with installations", async () => {
    state.syncedInstallationsCount = 2;
    const { GET } = route;

    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: "connected",
      reason: null,
      hasInstallations: true,
      syncedInstallationsCount: 2,
    });
  });

  test("stays connected when the account has no installations yet", async () => {
    state.installations = [];
    state.syncedInstallationsCount = 0;
    const { GET } = route;

    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: "connected",
      reason: null,
      hasInstallations: false,
      syncedInstallationsCount: 0,
    });
  });

  test("requires reconnect when GitHub rejects installation sync auth", async () => {
    state.syncError = new Error("GitHub auth failed");
    state.syncErrorIsAuth = true;
    const { GET } = route;

    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: "reconnect_required",
      reason: "sync_auth_failed",
      hasInstallations: true,
      syncedInstallationsCount: null,
    });
  });
});
