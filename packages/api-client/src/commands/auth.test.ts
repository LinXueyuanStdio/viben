/**
 * Tests for registerAuthCommand
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { Command } from "commander";
import { registerAuthCommand } from "./auth";

const mocks = vi.hoisted(() => ({
  me: vi.fn(),
  readToken: vi.fn(),
  writeToken: vi.fn(),
  deleteToken: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock("../client", () => ({
  VibenClient: class {
    constructor(_config: unknown) {}
    get user() {
      return { me: mocks.me };
    }
  },
  ApiError: class extends Error {
    status: number;
    constructor(msg: string, s: number) {
      super(msg);
      this.status = s;
    }
  },
}));

// Let real client-factory import mocked ../client
vi.mock("../proxy-fetch", () => ({
  proxyFetch: (...args: any[]) => mocks.fetch(...args),
  getProxyUrl: () => undefined,
  hasProxy: () => false,
  createProxyFetch: () => mocks.fetch,
}));

vi.mock("../utils/token", () => ({
  readToken: mocks.readToken,
  writeToken: mocks.writeToken,
  deleteToken: mocks.deleteToken,
  validateTokenFormat: (t: string) => /^bmcp_/.test(t),
  TOKEN_REGEX: /^bmcp_[a-zA-Z0-9]{8}_[a-zA-Z0-9]{24}$/,
}));

vi.mock("../utils/config", () => ({
  getWebUrl: () => "https://test.example.com",
}));

const TOKEN = "bmcp_12345678_abcdefghijklmnopqrstuvwx";

describe("registerAuthCommand", () => {
  let program: Command;

  beforeEach(() => {
    vi.clearAllMocks();
    program = new Command();
    program.exitOverride();
    registerAuthCommand(program);
  });

  describe("viben auth login", () => {
    it("logs in with --token option", async () => {
      mocks.me.mockResolvedValue({
        user: { id: "1", username: "test", email: "test@test.com" },
      });
      await program.parseAsync([
        "node",
        "viben",
        "auth",
        "login",
        "--token",
        TOKEN,
      ]);
      expect(mocks.me).toHaveBeenCalled();
      expect(mocks.writeToken).toHaveBeenCalledWith(TOKEN);
    });

    it("rejects invalid token format", async () => {
      await expect(
        program.parseAsync([
          "node",
          "viben",
          "auth",
          "login",
          "--token",
          "bad_token",
        ]),
      ).rejects.toThrow();
      expect(mocks.writeToken).not.toHaveBeenCalled();
    });

    it("accepts -f flag to force overwrite without confirmation", async () => {
      mocks.readToken.mockResolvedValue(TOKEN);
      mocks.me.mockResolvedValue({
        user: { id: "1", username: "test", email: "test@test.com" },
      });
      await program.parseAsync([
        "node",
        "viben",
        "auth",
        "login",
        "-f",
        "--token",
        TOKEN,
      ]);
      expect(mocks.me).toHaveBeenCalled();
      expect(mocks.writeToken).toHaveBeenCalledWith(TOKEN);
    });
  });

  describe("viben auth logout", () => {
    it("logs out when logged in", async () => {
      mocks.readToken.mockResolvedValue(TOKEN);
      await program.parseAsync(["node", "viben", "auth", "logout"]);
      expect(mocks.deleteToken).toHaveBeenCalled();
    });

    it("shows not logged in message", async () => {
      mocks.readToken.mockResolvedValue(null);
      await program.parseAsync(["node", "viben", "auth", "logout"]);
      expect(mocks.deleteToken).not.toHaveBeenCalled();
    });
  });

  describe("viben auth whoami", () => {
    it("shows username when logged in", async () => {
      mocks.readToken.mockResolvedValue(TOKEN);
      mocks.me.mockResolvedValue({
        user: { id: "1", username: "testuser", email: "test@test.com" },
      });
      await program.parseAsync(["node", "viben", "auth", "whoami"]);
      expect(mocks.me).toHaveBeenCalled();
    });

    it("exits with error when not logged in", async () => {
      mocks.readToken.mockResolvedValue(null);
      await expect(
        program.parseAsync(["node", "viben", "auth", "whoami"]),
      ).rejects.toThrow();
    });

    it("exits with error when token is invalid", async () => {
      mocks.readToken.mockResolvedValue(TOKEN);
      mocks.me.mockRejectedValue(new Error("Unauthorized"));
      await expect(
        program.parseAsync(["node", "viben", "auth", "whoami"]),
      ).rejects.toThrow();
    });
  });

  describe("viben auth status", () => {
    it("shows valid when token works", async () => {
      mocks.readToken.mockResolvedValue(TOKEN);
      mocks.me.mockResolvedValue({
        user: { id: "1", username: "test", email: "test@test.com" },
      });
      await program.parseAsync(["node", "viben", "auth", "status"]);
      expect(mocks.me).toHaveBeenCalled();
    });

    it("shows invalid when token fails", async () => {
      mocks.readToken.mockResolvedValue(TOKEN);
      mocks.me.mockRejectedValue(new Error("401"));
      await expect(
        program.parseAsync(["node", "viben", "auth", "status"]),
      ).rejects.toThrow();
    });

    it("exits when not logged in", async () => {
      mocks.readToken.mockResolvedValue(null);
      await expect(
        program.parseAsync(["node", "viben", "auth", "status"]),
      ).rejects.toThrow();
    });
  });

  describe("viben auth register", () => {
    it("registers a new account and auto-logins", async () => {
      const respJson = {
        accessToken: TOKEN,
        user: { username: "newuser" },
      };
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(respJson),
      });
      vi.stubGlobal("fetch", mockFetch);
      await program.parseAsync([
        "node",
        "viben",
        "auth",
        "register",
        "--email",
        "test@test.com",
        "--username",
        "newuser",
        "--password",
        "pass123",
      ]);
      expect(mockFetch).toHaveBeenCalled();
      expect(mocks.writeToken).toHaveBeenCalledWith(TOKEN);
      vi.unstubAllGlobals();
    });

    it("shows error on failed registration", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
        json: () => Promise.resolve({ error: "Email already in use" }),
      });
      vi.stubGlobal("fetch", mockFetch);
      await expect(
        program.parseAsync([
          "node",
          "viben",
          "auth",
          "register",
          "--email",
          "test@test.com",
          "--username",
          "exists",
          "--password",
          "pass123",
        ]),
      ).rejects.toThrow();
      vi.unstubAllGlobals();
    });
  });
});
