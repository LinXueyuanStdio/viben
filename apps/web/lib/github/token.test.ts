import { beforeEach, describe, expect, test, vi } from "vitest";
import { getGithubOAuthToken } from "./token";

const state = vi.hoisted(() => ({
  oauthConn: null as { accessToken: string | null } | null,
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db")>();

  return {
    ...actual,
    db: {
      query: {
        oauthConnections: {
          findFirst: async () => state.oauthConn,
        },
      },
    },
  };
});

describe("getGithubOAuthToken", () => {
  beforeEach(() => {
    state.oauthConn = { accessToken: "ghu_test" };
  });

  test("looks up access tokens by user id", async () => {
    const token = await getGithubOAuthToken("user-1");
    expect(token).toBe("ghu_test");
  });

  test("returns null when token lookup fails", async () => {
    state.oauthConn = null;
    const token = await getGithubOAuthToken("user-1");
    expect(token).toBeNull();
  });
});
