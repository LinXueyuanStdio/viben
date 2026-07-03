/**
 * Tests for registerProfileCommand
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { Command } from "commander";
import { registerProfileCommand } from "./profile";

const mocks = vi.hoisted(() => ({
  me: vi.fn(),
  update: vi.fn(),
  profile: vi.fn(),
  readToken: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock("../client", () => ({
  VibenClient: class {
    constructor(_config: unknown) {}
    get user() {
      return { me: mocks.me, update: mocks.update, profile: mocks.profile };
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

vi.mock("../proxy-fetch", () => ({
  proxyFetch: (...args: any[]) => mocks.fetch(...args),
  getProxyUrl: () => undefined,
  hasProxy: () => false,
  createProxyFetch: () => mocks.fetch,
}));

vi.mock("../utils/token", () => ({
  readToken: mocks.readToken,
  writeToken: vi.fn(),
  deleteToken: vi.fn(),
  validateTokenFormat: (t: string) => /^bmcp_/.test(t),
}));

vi.mock("../utils/config", () => ({
  getWebUrl: () => "https://test.example.com",
}));

const TOKEN = "bmcp_12345678_abcdefghijklmnopqrstuvwx";
const USER = {
  id: "u1",
  username: "testuser",
  displayName: "Test User",
  email: "test@example.com",
  bio: "Hello world",
  githubUsername: "testuser",
  avatarUrl: null,
  websiteUrl: null,
};

describe("registerProfileCommand", () => {
  let program: Command;

  beforeEach(() => {
    vi.clearAllMocks();
    program = new Command();
    program.exitOverride();
    registerProfileCommand(program);
  });

  it("default action shows profile when authenticated", async () => {
    mocks.readToken.mockResolvedValue(TOKEN);
    mocks.me.mockResolvedValue({ user: USER });
    await program.parseAsync(["node", "viben", "profile"]);
    expect(mocks.me).toHaveBeenCalled();
  });

  it("default action exits when not authenticated", async () => {
    mocks.readToken.mockResolvedValue(null);
    await expect(
      program.parseAsync(["node", "viben", "profile"]),
    ).rejects.toThrow();
  });

  it("show subcommand displays profile", async () => {
    mocks.readToken.mockResolvedValue(TOKEN);
    mocks.me.mockResolvedValue({ user: USER });
    await program.parseAsync(["node", "viben", "profile", "show"]);
    expect(mocks.me).toHaveBeenCalled();
  });

  it("update subcommand modifies profile", async () => {
    mocks.readToken.mockResolvedValue(TOKEN);
    mocks.update.mockResolvedValue({ success: true });
    await program.parseAsync([
      "node",
      "viben",
      "profile",
      "update",
      "--display-name",
      "New Name",
      "--bio",
      "New bio",
      "--website",
      "https://example.com",
    ]);
    expect(mocks.update).toHaveBeenCalledWith({
      displayName: "New Name",
      bio: "New bio",
      websiteUrl: "https://example.com",
    });
  });

  it("update subcommand requires auth", async () => {
    mocks.readToken.mockResolvedValue(null);
    await expect(
      program.parseAsync([
        "node",
        "viben",
        "profile",
        "update",
        "--display-name",
        "New Name",
      ]),
    ).rejects.toThrow();
  });

  it("view subcommand shows public profile", async () => {
    mocks.readToken.mockResolvedValue(TOKEN);
    mocks.profile.mockResolvedValue({ user: USER });
    await program.parseAsync(["node", "viben", "profile", "view", "otheruser"]);
    expect(mocks.profile).toHaveBeenCalledWith("otheruser");
  });

  it("view subcommand exits when user not found", async () => {
    mocks.readToken.mockResolvedValue(TOKEN);
    mocks.profile.mockRejectedValue(new Error("Not found"));
    await expect(
      program.parseAsync(["node", "viben", "profile", "view", "nonexistent"]),
    ).rejects.toThrow();
  });
});
