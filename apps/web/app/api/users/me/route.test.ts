import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  repoConnection: undefined as { accessTokenEncrypted: string } | undefined,
  user: {
    id: "user-1",
    email: "alice@example.com",
    username: "alice",
    userSlug: "alice",
    displayName: "Alice",
    avatarUrl: null,
    bio: null,
    websiteUrl: null,
    githubUsername: "octocat",
    role: "developer",
    emailVerified: true,
    createdAt: new Date("2026-08-10T00:00:00.000Z"),
  },
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/auth/middleware", () => ({
  AuthError: class AuthError extends Error {
    status = 401;
  },
  requireAuth: async () => ({ userId: "user-1" }),
}));

vi.mock("@/lib/db", () => ({
  db: {
    query: {
      users: {
        findFirst: async () => mocks.user,
      },
      githubConnections: {
        findFirst: async () => mocks.repoConnection,
      },
    },
  },
  users: { id: "users.id" },
  githubConnections: { userId: "github_connections.user_id" },
}));

vi.mock("drizzle-orm", () => ({
  eq: () => true,
}));

const routeModulePromise = import("./route");

describe("GET /api/users/me", () => {
  beforeEach(() => {
    mocks.repoConnection = undefined;
  });

  test("returns hasGitHub false when only the profile username exists", async () => {
    const { GET } = await routeModulePromise;
    const response = await GET(new Request("http://localhost/api/users/me") as never);

    expect(response.status).toBe(200);
    expect((await response.json()).hasGitHub).toBe(false);
  });

  test("returns hasGitHub true when an encrypted repo token exists", async () => {
    mocks.repoConnection = { accessTokenEncrypted: "encrypted-token" };
    const { GET } = await routeModulePromise;
    const response = await GET(new Request("http://localhost/api/users/me") as never);

    expect(response.status).toBe(200);
    expect((await response.json()).hasGitHub).toBe(true);
  });
});
