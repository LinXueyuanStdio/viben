import { beforeEach, describe, expect, test, vi } from "vitest";

const state = vi.hoisted(() => {
  const s = {
    authSession: null as { user: { id: string } } | null,
    cookieValues: {} as Record<string, string>,
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

vi.mock("@/lib/github/app", () => ({
  isGitHubAppConfigured: () => true,
  fetchInstallationDetail: async () => ({
    id: 123,
    accountLogin: "octocat",
    accountType: "User",
    repositorySelection: "all",
    htmlUrl: null,
  }),
}));

vi.mock("@/lib/db/installations", () => ({
  upsertInstallation: async () => ({}),
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
  });

  test("returns no_action when the user exits before selecting an installation", async () => {
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

  test("returns request_sent when setup_action is request", async () => {
    const { GET } = route;

    const response = await GET(
      new Request(
        "http://localhost/api/github/app/callback?setup_action=request",
      ),
    );

    expect(response.status).toBe(307);
    const redirectUrl = getRedirectUrl(response);
    expect(redirectUrl.searchParams.get("github")).toBe("request_sent");
  });

  test("returns app_installed when installation_id is present", async () => {
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
