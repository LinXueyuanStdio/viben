import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock VibenClient since verifyToken now uses it internally
const mocks = vi.hoisted(() => ({
  me: vi.fn(),
}));

vi.mock("@viben/api-client", () => ({
  VibenClient: class {
    user: any;
    constructor(_config: unknown) {}
    get user() { return { me: mocks.me }; }
  },
  ApiError: class extends Error { status: number; constructor(msg: string, s: number) { super(msg); this.status = s; } },
  VIBEN_WEB_URL: "https://viben-web.vercel.app",
}));

import { verifyToken, AuthApiError } from "./api";

describe("auth/api — verifyToken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns user info for valid token", async () => {
    const mockUser = {
      id: "user_123",
      username: "testuser",
      email: "test@example.com",
      avatarUrl: "https://example.com/avatar.png",
    };

    mocks.me.mockResolvedValueOnce({ user: mockUser });

    const result = await verifyToken("bmcp_12345678_abcdefghijklmnopqrstuvwx");

    expect(result).toEqual({
      id: "user_123",
      username: "testuser",
      email: "test@example.com",
      avatarUrl: "https://example.com/avatar.png",
    });
    expect(mocks.me).toHaveBeenCalled();
  });

  it("throws AuthApiError for 401 response", async () => {
    mocks.me.mockRejectedValueOnce(
      new (await import("@viben/api-client")).ApiError("Invalid token", 401)
    );

    await expect(
      verifyToken("bmcp_invalid_abcdefghijklmnopqrstuvwx")
    ).rejects.toThrow(AuthApiError);
  });

  it("throws AuthApiError for network error", async () => {
    mocks.me.mockRejectedValueOnce(new Error("Network error"));

    await expect(
      verifyToken("bmcp_12345678_abcdefghijklmnopqrstuvwx")
    ).rejects.toThrow(AuthApiError);
  });
});
