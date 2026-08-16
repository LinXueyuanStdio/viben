import { beforeEach, describe, expect, test, vi } from "vitest";

// The route calls the real isGitHubAppConfigured(), which reads these env vars.
process.env.GITHUB_APP_ID = "4254151";
process.env.GITHUB_APP_PRIVATE_KEY =
  "-----BEGIN RSA PRIVATE KEY-----\ntest\n-----END RSA PRIVATE KEY-----";

const state = vi.hoisted(() => {
  const s = {
    authSession: null as { user: { id: string } } | null,
    cookieValues: {} as Record<string, string>,
    githubToken: null as string | null,
    githubUsername: null as string | null,
    syncedInstallationsCount: 0,
    syncInstallationsError: null as Error | null,
  };
  return s;
});

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = state.cookieValues[name];
      return value ? { value } : undefined;
    },
  }),
}));

vi.mock("@/lib/session/get-server-session", () => ({
  getServerSession: async () => state.authSession,
}));

vi.mock("@/lib/github/token", () => ({
  getGithubOAuthToken: async () => state.githubToken,
}));

vi.mock("@/lib/github/users", () => ({
  getGitHubUsername: async () => state.githubUsername,
  getGitHubAccountId: async () => null,
}));

vi.mock("@/lib/github/sync", () => ({
  syncUserInstallations: async () => {
    if (state.syncInstallationsError) {
      throw state.syncInstallationsError;
    }

    return state.syncedInstallationsCount;
  },
}));

import * as route from "./route";

function getRedirectUrl(response: Response): URL {
  const location = response.headers.get("location");
  expect(location).toBeTruthy();
  return new URL(location as string);
}

describe("GET /api/github/app/callback", () => {
  beforeEach(() => {
    state.authSession = { user: { id: "user-1" } };
    state.cookieValues = {
      github_app_install_redirect_to: "/settings/connections",
    };
    state.githubToken = "ghu_test";
    state.githubUsername = "octocat";
    state.syncedInstallationsCount = 1;
    state.syncInstallationsError = null;
  });

  test("returns no_action when the user exits before selecting an installation", async () => {
    state.syncedInstallationsCount = 0;
    const { GET } = route;

    const response = await GET(
      new Request("http://localhost/api/github/app/callback"),
    );

    expect(response.status).toBe(307);
    const redirectUrl = getRedirectUrl(response);
    expect(redirectUrl.pathname).toBe("/settings/connections");
    expect(redirectUrl.searchParams.get("github")).toBe("no_action");
    expect(redirectUrl.searchParams.get("missing_installation_id")).toBe("1");
  });

  test("returns pending_sync when github reports an installation but sync is still empty", async () => {
    state.syncedInstallationsCount = 0;
    const { GET } = route;

    const response = await GET(
      new Request(
        "http://localhost/api/github/app/callback?installation_id=123",
      ),
    );

    expect(response.status).toBe(307);
    const redirectUrl = getRedirectUrl(response);
    expect(redirectUrl.searchParams.get("github")).toBe("pending_sync");
    expect(redirectUrl.searchParams.get("missing_installation_id")).toBeNull();
  });

  test("returns app_installed only after at least one installation syncs", async () => {
    state.syncedInstallationsCount = 1;
    const { GET } = route;

    const response = await GET(
      new Request(
        "http://localhost/api/github/app/callback?installation_id=123",
      ),
    );

    expect(response.status).toBe(307);
    const redirectUrl = getRedirectUrl(response);
    expect(redirectUrl.searchParams.get("github")).toBe("app_installed");
    expect(redirectUrl.searchParams.get("missing_installation_id")).toBeNull();
  });
});
