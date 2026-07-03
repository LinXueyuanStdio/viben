/**
 * Tests for registerPagesPublishCommand
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { Command } from "commander";
import { registerPagesPublishCommand } from "./pages-publish";

const mocks = vi.hoisted(() => ({
  publish: vi.fn(),
  publishStatus: vi.fn(),
  publishHistory: vi.fn(),
  publishRollback: vi.fn(),
  readToken: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock("../client", () => ({
  VibenClient: class {
    constructor(_config: unknown) {}
    get pages() {
      return {
        publish: mocks.publish,
        publishStatus: mocks.publishStatus,
        publishHistory: mocks.publishHistory,
        publishRollback: mocks.publishRollback,
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
  validateTokenFormat: (t: string) => /^bmcp_/.test(t),
}));

vi.mock("node:fs", () => ({
  readFileSync: vi.fn(() => "<h1>Test</h1>"),
}));

const TOKEN = "bmcp_12345678_abcdefghijklmnopqrstuvwx";

describe("registerPagesPublishCommand", () => {
  let program: Command;

  beforeEach(() => {
    vi.clearAllMocks();
    program = new Command();
    program.exitOverride();
    registerPagesPublishCommand(program);
  });

  it("publishes a page with --uid and --title using HTML file", async () => {
    mocks.readToken.mockResolvedValue(TOKEN);
    mocks.publish.mockResolvedValue({ success: true, url: "https://test.example.com/p/test-user/my-page" });
    await program.parseAsync([
      "node",
      "viben",
      "page",
      "publish",
      "--uid",
      "my-page",
      "--title",
      "My Page",
      "--html",
      "/path/to/index.html",
    ]);
    expect(mocks.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        uid: "my-page",
        title: "My Page",
        html: "<h1>Test</h1>",
      }),
    );
  });

  it("publish requires auth", async () => {
    mocks.readToken.mockResolvedValue(null);
    await expect(
      program.parseAsync([
        "node",
        "viben",
        "page",
        "publish",
        "--uid",
        "my-page",
        "--title",
        "My Page",
        "--html",
        "/path/to/index.html",
      ]),
    ).rejects.toThrow();
  });

  it("publish exits when --uid is missing", async () => {
    mocks.readToken.mockResolvedValue(TOKEN);
    await expect(
      program.parseAsync([
        "node",
        "viben",
        "page",
        "publish",
        "--title",
        "My Page",
        "--html",
        "/path/to/index.html",
      ]),
    ).rejects.toThrow();
  });

  it("publish exits when --title is missing", async () => {
    mocks.readToken.mockResolvedValue(TOKEN);
    await expect(
      program.parseAsync([
        "node",
        "viben",
        "page",
        "publish",
        "--uid",
        "my-page",
        "--html",
        "/path/to/index.html",
      ]),
    ).rejects.toThrow();
  });

  it("checks publish-status with --uid and --user-slug", async () => {
    mocks.readToken.mockResolvedValue(TOKEN);
    mocks.publishStatus.mockResolvedValue({ published: true, url: "https://test.example.com/p/test-user/my-page" });
    await program.parseAsync([
      "node",
      "viben",
      "page",
      "publish-status",
      "--uid",
      "my-page",
      "--user-slug",
      "test-user",
    ]);
    expect(mocks.publishStatus).toHaveBeenCalledWith("test-user", "my-page");
  });

  it("publish-status requires auth", async () => {
    mocks.readToken.mockResolvedValue(null);
    await expect(
      program.parseAsync([
        "node",
        "viben",
        "page",
        "publish-status",
        "--uid",
        "my-page",
        "--user-slug",
        "test-user",
      ]),
    ).rejects.toThrow();
  });

  it("publish-status exits when args are missing", async () => {
    mocks.readToken.mockResolvedValue(TOKEN);
    await expect(
      program.parseAsync([
        "node",
        "viben",
        "page",
        "publish-status",
      ]),
    ).rejects.toThrow();
  });

  it("shows publish-history with --uid", async () => {
    mocks.readToken.mockResolvedValue(TOKEN);
    mocks.publishHistory.mockResolvedValue({
      history: [{ version: 1, title: "First publish", published_at: "2025-01-01" }],
    });
    await program.parseAsync([
      "node",
      "viben",
      "page",
      "publish-history",
      "--uid",
      "my-page",
    ]);
    expect(mocks.publishHistory).toHaveBeenCalledWith("my-page");
  });

  it("publish-history requires auth", async () => {
    mocks.readToken.mockResolvedValue(null);
    await expect(
      program.parseAsync([
        "node",
        "viben",
        "page",
        "publish-history",
        "--uid",
        "my-page",
      ]),
    ).rejects.toThrow();
  });

  it("publish-history exits when --uid is missing", async () => {
    mocks.readToken.mockResolvedValue(TOKEN);
    await expect(
      program.parseAsync([
        "node",
        "viben",
        "page",
        "publish-history",
      ]),
    ).rejects.toThrow();
  });

  it("rolls back a page with --uid and --version", async () => {
    mocks.readToken.mockResolvedValue(TOKEN);
    mocks.publishRollback.mockResolvedValue({ success: true });
    await program.parseAsync([
      "node",
      "viben",
      "page",
      "publish-rollback",
      "--uid",
      "my-page",
      "--version",
      "3",
    ]);
    expect(mocks.publishRollback).toHaveBeenCalledWith("my-page", 3);
  });

  it("publish-rollback requires auth", async () => {
    mocks.readToken.mockResolvedValue(null);
    await expect(
      program.parseAsync([
        "node",
        "viben",
        "page",
        "publish-rollback",
        "--uid",
        "my-page",
        "--version",
        "3",
      ]),
    ).rejects.toThrow();
  });
});
