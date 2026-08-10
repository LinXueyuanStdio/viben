import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const cookieSet = vi.hoisted(() => vi.fn());
const cookieDelete = vi.hoisted(() => vi.fn());

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => undefined,
    set: cookieSet,
    delete: cookieDelete,
  }),
}));

vi.mock("@/lib/utils", () => ({
  generateId: () => "oauth-state",
}));

vi.mock("@/lib/auth/desktop-redirect", () => ({
  describeDesktopRedirectUri: () => ({}),
  isAllowedDesktopRedirectUri: () => false,
}));

const originalClientId = process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID;
const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;
const routeModulePromise = import("./route");

describe("GET /api/auth/github", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID = "github-client-id";
    process.env.NEXT_PUBLIC_APP_URL = "https://viben.example";
    cookieSet.mockClear();
    cookieDelete.mockClear();
  });

  afterEach(() => {
    if (originalClientId === undefined) {
      delete process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID;
    } else {
      process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID = originalClientId;
    }
    if (originalAppUrl === undefined) {
      delete process.env.NEXT_PUBLIC_APP_URL;
    } else {
      process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
    }
  });

  test("requests repo access during GitHub login", async () => {
    const { GET } = await routeModulePromise;
    const response = await GET(
      new NextRequest("https://viben.example/api/auth/github"),
    );
    const location = response.headers.get("location");

    expect(location).not.toBeNull();
    expect(new URL(location!).searchParams.get("scope")).toBe(
      "read:user user:email repo",
    );
  });
});
