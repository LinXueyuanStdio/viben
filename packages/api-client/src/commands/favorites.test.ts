/**
 * Tests for registerFavoritesCommand
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { Command } from "commander";
import { registerFavoritesCommand } from "./favorites";

const mocks = vi.hoisted(() => ({
  favorites: vi.fn(),
  readToken: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock("../client", () => ({
  VibenClient: class {
    constructor(_config: unknown) {}
    get user() {
      return { favorites: mocks.favorites };
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
  validateTokenFormat: () => true,
}));

const TOKEN = "bmcp_12345678_abcdefghijklmnopqrstuvwx";

describe("registerFavoritesCommand", () => {
  let program: Command;

  beforeEach(() => {
    vi.clearAllMocks();
    program = new Command();
    program.exitOverride();
    registerFavoritesCommand(program);
  });

  it("lists favorites when logged in", async () => {
    mocks.readToken.mockResolvedValue(TOKEN);
    mocks.favorites.mockResolvedValue({
      favorites: [{ entityType: "mcp", entityId: "pkg1" }],
    });
    const logSpy = vi.spyOn(console, "log");
    await program.parseAsync(["node", "viben", "favorites"]);
    expect(mocks.favorites).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("[mcp]"));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("pkg1"));
    logSpy.mockRestore();
  });

  it("shows empty message when no favorites", async () => {
    mocks.readToken.mockResolvedValue(TOKEN);
    mocks.favorites.mockResolvedValue({ favorites: [] });
    const logSpy = vi.spyOn(console, "log");
    await program.parseAsync(["node", "viben", "favorites"]);
    expect(mocks.favorites).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith("No favorites yet.");
    logSpy.mockRestore();
  });

  it("shows error when not logged in", async () => {
    mocks.readToken.mockResolvedValue(null);
    await expect(
      program.parseAsync(["node", "viben", "favorites"]),
    ).rejects.toThrow();
  });
});
