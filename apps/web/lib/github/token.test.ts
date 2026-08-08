import { beforeEach, describe, expect, mock, test } from "bun:test";

let getAccessTokenResult: { accessToken?: string | null } | null;
let getAccessTokenError: Error | null;

const getAccessTokenSpy = mock(
  async (_input: { body: { providerId: string; userId: string } }) => {
    if (getAccessTokenError) throw getAccessTokenError;
    return getAccessTokenResult;
  },
);

mock.module("server-only", () => ({}));

mock.module("next/headers", () => ({
  headers: async () => { throw new Error("headers should not be called"); },
}));

mock.module("@/lib/auth/config", () => ({
  auth: { api: { getAccessToken: getAccessTokenSpy } },
}));

mock.module("@/lib/db/client", () => ({ db: {} }));
mock.module("@/lib/db/schema", () => ({ accounts: {} }));

const tokenModulePromise = import("./token");

describe("getGithubOAuthToken", () => {
  beforeEach(() => {
    getAccessTokenSpy.mockClear();
    getAccessTokenResult = { accessToken: "ghu_test" };
    getAccessTokenError = null;
  });

  test("looks up access tokens by user id", async () => {
    const { getGithubOAuthToken } = await tokenModulePromise;
    const token = await getGithubOAuthToken("user-1");
    expect(token).toBe("ghu_test");
  });

  test("returns null when token lookup fails", async () => {
    const { getGithubOAuthToken } = await tokenModulePromise;
    getAccessTokenError = new Error("boom");
    const token = await getGithubOAuthToken("user-1");
    expect(token).toBeNull();
  });
});
