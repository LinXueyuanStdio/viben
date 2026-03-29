import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

import { verifyToken, AuthApiError, VIBEN_WEB_URL } from "./api";

describe("auth/api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("verifyToken", () => {
    it("should return user info for valid token", async () => {
      const mockUser = {
        id: "user_123",
        username: "testuser",
        email: "test@example.com",
        avatarUrl: "https://example.com/avatar.png",
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ user: mockUser }),
      });

      const result = await verifyToken("bmcp_12345678_abcdefghijklmnopqrstuvwx");

      expect(result).toEqual(mockUser);
      expect(mockFetch).toHaveBeenCalledWith(
        `${VIBEN_WEB_URL}/api/users/me`,
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer bmcp_12345678_abcdefghijklmnopqrstuvwx",
          }),
        })
      );
    });

    it("should throw AuthApiError for invalid token", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: "Invalid API key" }),
      });

      await expect(
        verifyToken("bmcp_invalid_abcdefghijklmnopqrstuvwx")
      ).rejects.toThrow(AuthApiError);
    });

    it("should throw AuthApiError for network error", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      await expect(
        verifyToken("bmcp_12345678_abcdefghijklmnopqrstuvwx")
      ).rejects.toThrow(AuthApiError);
    });
  });
});
