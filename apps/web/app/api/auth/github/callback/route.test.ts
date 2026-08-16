import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => {
  const users = { name: "users" };
  const oauthConnections = { name: "oauth_connections" };
  const githubConnections = { name: "github_connections" };
  return {
    users,
    oauthConnections,
    githubConnections,
    insertedRepoConnection: undefined as Record<string, unknown> | undefined,
    setAuthCookies: vi.fn(),
    createSession: vi.fn().mockResolvedValue({ sessionId: 's-1', refreshToken: 'rt-1' }),
  };
});

vi.mock("server-only", () => ({}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "oauth_state" ? { value: "expected-state" } : undefined,
    delete: vi.fn(),
  }),
}));

vi.mock("@/lib/db", () => ({
  users: mocks.users,
  oauthConnections: mocks.oauthConnections,
  githubConnections: mocks.githubConnections,
  db: {
    query: {
      oauthConnections: {
        findFirst: async () => ({
          id: "oauth-1",
          userId: "user-1",
          user: {
            id: "user-1",
            email: "alice@example.com",
            username: "alice",
            userSlug: "alice",
            displayName: "Alice",
            avatarUrl: null,
            githubUsername: "octocat",
            role: "developer",
          },
        }),
      },
      githubConnections: {
        findFirst: async () => undefined,
      },
      users: {
        findFirst: async () => undefined,
      },
    },
    update: () => ({
      set: () => ({ where: async () => [] }),
    }),
    insert: (table: unknown) => ({
      values: async (values: Record<string, unknown>) => {
        if (table === mocks.githubConnections) {
          mocks.insertedRepoConnection = values;
        }
        return [];
      },
    }),
  },
}));

vi.mock("drizzle-orm", () => ({
  and: () => true,
  eq: () => true,
}));

vi.mock("@/lib/auth/cookies", () => ({
  getSession: async () => null,
  setAuthCookies: mocks.setAuthCookies,
}));

vi.mock("@/lib/auth/session-service", () => ({
  createSession: mocks.createSession,
}));

vi.mock("@/lib/auth/token-encryption", () => ({
  encryptToken: async () => "encrypted-repo-token",
  decryptToken: async () => "repo-token",
}));

vi.mock("@/lib/auth/jwe", () => ({
  encryptSession: async () => "desktop-session",
}));

vi.mock("@/lib/auth/desktop-redirect", () => ({
  describeDesktopRedirectUri: () => ({}),
  isAllowedDesktopRedirectUri: () => false,
  renderDesktopOAuthCallbackPage: vi.fn(),
}));

vi.mock("@/lib/media", () => ({
  uploadImageFromUrl: async () => null,
}));

vi.mock("@/lib/utils", () => ({
  generateId: () => "generated-id",
}));

vi.mock("@/lib/utils/user-slug", () => ({
  normalizeUserSlug: (value: string) => value,
}));

const originalFetch = globalThis.fetch;
const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;
const routeModulePromise = import("./route");

describe("GET /api/auth/github/callback", () => {
  beforeEach(() => {
    mocks.insertedRepoConnection = undefined;
    mocks.setAuthCookies.mockClear();
    mocks.createSession.mockClear();
    process.env.NEXT_PUBLIC_APP_URL = "https://viben.example";

    const responses = [
      Response.json({ access_token: "repo-token", scope: "repo" }),
      Response.json({
        id: 42,
        login: "octocat",
        name: "Octo Cat",
        email: "alice@example.com",
        avatar_url: "https://avatars.example/octocat.png",
      }),
      Response.json([
        {
          email: "alice@example.com",
          primary: true,
          verified: true,
        },
      ]),
    ];
    globalThis.fetch = vi.fn(async () => responses.shift()!) as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (originalAppUrl === undefined) {
      delete process.env.NEXT_PUBLIC_APP_URL;
    } else {
      process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
    }
  });

  test("stores the repo-scoped login token as the canonical repo connection", async () => {
    const { GET } = await routeModulePromise;
    const response = await GET(
      new NextRequest(
        "https://viben.example/api/auth/github/callback?code=code&state=expected-state",
      ),
    );

    expect(response.status).toBe(307);
    expect(mocks.insertedRepoConnection).toEqual(
      expect.objectContaining({
        userId: "user-1",
        accessTokenEncrypted: "encrypted-repo-token",
        scope: "repo",
        githubUserId: "42",
        githubUsername: "octocat",
      }),
    );
  });
});
