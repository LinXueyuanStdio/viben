/**
 * Tests for registerApiKeyCommand
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { Command } from "commander";
import { registerApiKeyCommand } from "./api-key";

const mocks = vi.hoisted(() => ({
  apiKeys: vi.fn(),
  createApiKey: vi.fn(),
  deleteApiKey: vi.fn(),
  readToken: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock("../client", () => ({
  VibenClient: class {
    constructor(_config: unknown) {}
    get user() {
      return {
        apiKeys: mocks.apiKeys,
        createApiKey: mocks.createApiKey,
        deleteApiKey: mocks.deleteApiKey,
      };
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

vi.mock("node:readline", () => {
  return {
    createInterface: vi.fn(() => ({
      question: (_q: string, cb: (answer: string) => void) => cb("y"),
      close: vi.fn(),
    })),
  };
});

const TOKEN = "bmcp_12345678_abcdefghijklmnopqrstuvwx";

describe("registerApiKeyCommand", () => {
  let program: Command;

  beforeEach(() => {
    vi.clearAllMocks();
    program = new Command();
    program.exitOverride();
    registerApiKeyCommand(program);
  });

  it("lists API keys", async () => {
    mocks.readToken.mockResolvedValue(TOKEN);
    mocks.apiKeys.mockResolvedValue({
      apiKeys: [
        {
          id: "k1",
          name: "test",
          keyPrefix: "bmcp_",
          scopes: [],
          expiresAt: null,
          lastUsedAt: null,
          createdAt: "2025-01-01",
        },
      ],
    });
    await program.parseAsync(["node", "viben", "api-key", "list"]);
    expect(mocks.apiKeys).toHaveBeenCalled();
  });

  it("rejects list without auth", async () => {
    mocks.readToken.mockResolvedValue(null);
    await expect(
      program.parseAsync(["node", "viben", "api-key", "list"]),
    ).rejects.toThrow();
  });

  it("creates API key", async () => {
    mocks.readToken.mockResolvedValue(TOKEN);
    mocks.createApiKey.mockResolvedValue({
      apiKey: {
        id: "k1",
        name: "new",
        keyPrefix: "bmcp_",
        scopes: [],
        expiresAt: null,
        lastUsedAt: null,
        createdAt: "2025-01-01",
      },
      key: "full_key_here",
    });
    await program.parseAsync([
      "node",
      "viben",
      "api-key",
      "create",
      "new-key",
    ]);
    expect(mocks.createApiKey).toHaveBeenCalledWith(
      expect.objectContaining({ name: "new-key" }),
    );
  });

  it("creates API key with scopes and expiration", async () => {
    mocks.readToken.mockResolvedValue(TOKEN);
    mocks.createApiKey.mockResolvedValue({
      apiKey: {
        id: "k2",
        name: "scoped",
        keyPrefix: "bmcp_",
        scopes: [],
        expiresAt: null,
        lastUsedAt: null,
        createdAt: "2025-01-01",
      },
      key: "full_key_2",
    });
    await program.parseAsync([
      "node",
      "viben",
      "api-key",
      "create",
      "scoped",
      "--scopes",
      "read,write",
      "--expires-in",
      "30",
    ]);
    expect(mocks.createApiKey).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "scoped",
        scopes: ["read", "write"],
        expiresIn: 30,
      }),
    );
  });

  it("rejects create without auth", async () => {
    mocks.readToken.mockResolvedValue(null);
    await expect(
      program.parseAsync(["node", "viben", "api-key", "create", "new-key"]),
    ).rejects.toThrow();
  });

  it("deletes API key with --force", async () => {
    mocks.readToken.mockResolvedValue(TOKEN);
    mocks.deleteApiKey.mockResolvedValue({ success: true });
    await program.parseAsync([
      "node",
      "viben",
      "api-key",
      "delete",
      "k1",
      "--force",
    ]);
    expect(mocks.deleteApiKey).toHaveBeenCalledWith("k1");
  });

  it("deletes API key with interactive confirmation", async () => {
    mocks.readToken.mockResolvedValue(TOKEN);
    mocks.deleteApiKey.mockResolvedValue({ success: true });
    await program.parseAsync([
      "node",
      "viben",
      "api-key",
      "delete",
      "k1",
    ]);
    expect(mocks.deleteApiKey).toHaveBeenCalledWith("k1");
  });

  it("rejects delete without auth", async () => {
    mocks.readToken.mockResolvedValue(null);
    await expect(
      program.parseAsync([
        "node",
        "viben",
        "api-key",
        "delete",
        "k1",
        "--force",
      ]),
    ).rejects.toThrow();
  });
});
