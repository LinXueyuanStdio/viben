import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { NextRequest } from "next/server";

const state = vi.hoisted(() => {
  const s = {
    authSession: null as {
      authProvider: "vercel";
      user: { id: string; email?: string };
    } | null,
    hasLinkedGitHub: false,
    installations: [] as Array<{ installationId: number }>,
  };
  return s;
});

vi.mock("server-only", () => ({}));

vi.mock("arctic", () => ({
  generateState: () => "state-123",
}));

vi.mock("@/lib/session/get-server-session", () => ({
  getServerSession: async () => state.authSession,
}));

vi.mock("@/lib/github/token", () => ({
  getGitHubRepoOAuthToken: async () =>
    state.hasLinkedGitHub ? "ghu_test" : null,
}));

vi.mock("@/lib/github/users", () => ({
  hasGitHubAccount: async () => state.hasLinkedGitHub,
  getGitHubUsernameForToken: async () =>
    state.hasLinkedGitHub ? "testuser" : null,
  getGitHubAccountId: async () => (state.hasLinkedGitHub ? "12345" : null),
}));

vi.mock("@/lib/db/installations", () => ({
  getInstallationsByUserId: async () => state.installations,
}));

vi.mock("@/lib/github/sync", () => ({
  syncUserInstallations: async () => state.installations.length,
}));

import * as route from "./route";

const originalEnv = {
  NEXT_PUBLIC_GITHUB_APP_SLUG: process.env.NEXT_PUBLIC_GITHUB_APP_SLUG,
  NODE_ENV: process.env.NODE_ENV,
};

function createRequest(url: string): NextRequest {
  const nextUrl = new URL(url);

  return {
    url,
    nextUrl,
    cookies: {
      get: () => undefined,
    },
  } as unknown as NextRequest;
}

describe("GET /api/github/app/install", () => {
  beforeEach(() => {
    state.authSession = {
      authProvider: "vercel",
      user: { id: "user-1", email: "person@vercel.com" },
    };
    state.hasLinkedGitHub = true;
    state.installations = [{ installationId: 1 }];

    Object.assign(process.env, {
      NEXT_PUBLIC_GITHUB_APP_SLUG: "viben-agent",
      NODE_ENV: "test",
    });
  });

  afterEach(() => {
    Object.assign(process.env, {
      NEXT_PUBLIC_GITHUB_APP_SLUG: originalEnv.NEXT_PUBLIC_GITHUB_APP_SLUG,
      NODE_ENV: originalEnv.NODE_ENV,
    });
  });

  test("redirects to github install when github not linked", async () => {
    state.hasLinkedGitHub = false;
    state.installations = [];
    const { GET } = route;

    const response = await GET(
      createRequest(
        "http://localhost/api/github/app/install?next=/settings/connections",
      ),
    );

    expect(response.status).toBe(307);
    const location = response.headers.get("location");
    expect(location).toBeTruthy();
    const redirectUrl = new URL(location as string);
    expect(redirectUrl.origin).toBe("https://github.com");
    expect(redirectUrl.pathname).toContain("viben-agent");
  });

  test("redirects to github install when linked but no installations", async () => {
    state.installations = [];
    const { GET } = route;

    const response = await GET(
      createRequest("http://localhost/api/github/app/install?next=/sessions"),
    );

    expect(response.status).toBe(307);
    const location = response.headers.get("location");
    expect(location).toBeTruthy();
    const redirectUrl = new URL(location as string);
    expect(redirectUrl.origin).toBe("https://github.com");
    expect(redirectUrl.pathname).toContain("viben-agent");
  });

  test("blocks managed template trial users", async () => {
    state.authSession = {
      authProvider: "vercel",
      user: { id: "user-1", email: "person@example.com" },
    };
    const { GET } = route;

    const response = await GET(
      createRequest(
        "https://viben-web.vercel.app/api/github/app/install?next=/settings/connections",
      ),
    );

    expect(response.status).toBe(307);
    const location = response.headers.get("location");
    expect(location).toBeTruthy();
    const redirectUrl = new URL(location as string);
    expect(redirectUrl.pathname).toBe("/settings/connections");
    expect(redirectUrl.searchParams.get("github")).toBe("trial_blocked");
  });
});
