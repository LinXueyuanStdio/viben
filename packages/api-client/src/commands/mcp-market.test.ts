/**
 * Tests for registerMcpMarketCommand
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { Command } from "commander";
import { registerMcpMarketCommand } from "./mcp-market";

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  search: vi.fn(),
  get: vi.fn(),
  download: vi.fn(),
  toggleFavorite: vi.fn(),
  comments: vi.fn(),
  addComment: vi.fn(),
  rate: vi.fn(),
  categories: vi.fn(),
  readToken: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock("../client", () => ({
  VibenClient: class {
    constructor(_config: unknown) {}
    get mcp() {
      return {
        list: mocks.list,
        search: mocks.search,
        get: mocks.get,
        download: mocks.download,
        toggleFavorite: mocks.toggleFavorite,
        comments: mocks.comments,
        addComment: mocks.addComment,
        rate: mocks.rate,
        categories: mocks.categories,
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

const TOKEN = "bmcp_12345678_abcdefghijklmnopqrstuvwx";
const PAGINATED = {
  data: [
    {
      id: "1",
      name: "TestMCP",
      slug: "test-mcp",
      description: "A test MCP",
      version: "1.0.0",
      ratingAvg: 4.5,
      downloadsCount: 100,
      favoritesCount: 10,
      author: {
        id: "a1",
        username: "author",
        displayName: "Author",
        avatarUrl: null,
      },
      category: null,
      transport: "stdio" as const,
      tags: null,
      repositoryUrl: null,
      createdAt: "2025-01-01",
    },
  ],
  pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
};

describe("registerMcpMarketCommand", () => {
  let program: Command;

  beforeEach(() => {
    vi.clearAllMocks();
    program = new Command();
    program.exitOverride();
    registerMcpMarketCommand(program);
  });

  it("lists packages", async () => {
    mocks.list.mockResolvedValue(PAGINATED);
    await program.parseAsync(["node", "viben", "mcp-market", "list"]);
    expect(mocks.list).toHaveBeenCalledWith(expect.objectContaining({}));
  });

  it("lists packages with pagination options", async () => {
    mocks.list.mockResolvedValue(PAGINATED);
    await program.parseAsync([
      "node",
      "viben",
      "mcp-market",
      "list",
      "--page",
      "2",
      "--limit",
      "5",
      "--sort",
      "popular",
    ]);
    expect(mocks.list).toHaveBeenCalledWith(
      expect.objectContaining({ page: 2, limit: 5, sort: "popular" }),
    );
  });

  it("lists packages filtered by category", async () => {
    mocks.list.mockResolvedValue(PAGINATED);
    await program.parseAsync([
      "node",
      "viben",
      "mcp-market",
      "list",
      "--category",
      "ai",
    ]);
    expect(mocks.list).toHaveBeenCalledWith(
      expect.objectContaining({ category: "ai" }),
    );
  });

  it("searches packages", async () => {
    mocks.search.mockResolvedValue(PAGINATED);
    await program.parseAsync([
      "node",
      "viben",
      "mcp-market",
      "search",
      "git",
    ]);
    expect(mocks.search).toHaveBeenCalledWith(
      "git",
      expect.objectContaining({}),
    );
  });

  it("searches packages with pagination", async () => {
    mocks.search.mockResolvedValue(PAGINATED);
    await program.parseAsync([
      "node",
      "viben",
      "mcp-market",
      "search",
      "git",
      "--page",
      "2",
      "--limit",
      "5",
    ]);
    expect(mocks.search).toHaveBeenCalledWith(
      "git",
      expect.objectContaining({ page: 2, limit: 5 }),
    );
  });

  it("views package details", async () => {
    mocks.get.mockResolvedValue({ package: PAGINATED.data[0] });
    await program.parseAsync(["node", "viben", "mcp-market", "view", "test-mcp"]);
    expect(mocks.get).toHaveBeenCalledWith("test-mcp");
  });

  it("downloads package", async () => {
    const blob = new Blob(["test"]);
    mocks.download.mockResolvedValue(blob);
    await program.parseAsync([
      "node",
      "viben",
      "mcp-market",
      "download",
      "test-mcp",
    ]);
    expect(mocks.download).toHaveBeenCalledWith("test-mcp");
  });

  it("toggles favorite (requires auth)", async () => {
    mocks.readToken.mockResolvedValue(TOKEN);
    mocks.toggleFavorite.mockResolvedValue({ favorited: true });
    await program.parseAsync([
      "node",
      "viben",
      "mcp-market",
      "favorite",
      "test-mcp",
    ]);
    expect(mocks.toggleFavorite).toHaveBeenCalledWith("test-mcp");
  });

  it("rejects favorite without auth", async () => {
    mocks.readToken.mockResolvedValue(null);
    await expect(
      program.parseAsync([
        "node",
        "viben",
        "mcp-market",
        "favorite",
        "test-mcp",
      ]),
    ).rejects.toThrow();
  });

  it("rates package", async () => {
    mocks.readToken.mockResolvedValue(TOKEN);
    mocks.rate.mockResolvedValue({ success: true });
    await program.parseAsync([
      "node",
      "viben",
      "mcp-market",
      "rate",
      "test-mcp",
      "4",
    ]);
    expect(mocks.rate).toHaveBeenCalledWith("test-mcp", 4);
  });

  it("rejects invalid rating (< 1)", async () => {
    await expect(
      program.parseAsync([
        "node",
        "viben",
        "mcp-market",
        "rate",
        "test-mcp",
        "0",
      ]),
    ).rejects.toThrow();
  });

  it("rejects invalid rating (> 5)", async () => {
    await expect(
      program.parseAsync([
        "node",
        "viben",
        "mcp-market",
        "rate",
        "test-mcp",
        "6",
      ]),
    ).rejects.toThrow();
  });

  it("rate requires auth", async () => {
    mocks.readToken.mockResolvedValue(null);
    await expect(
      program.parseAsync([
        "node",
        "viben",
        "mcp-market",
        "rate",
        "test-mcp",
        "4",
      ]),
    ).rejects.toThrow();
  });

  it("shows comments", async () => {
    mocks.comments.mockResolvedValue({ comments: [] });
    await program.parseAsync([
      "node",
      "viben",
      "mcp-market",
      "comments",
      "test-mcp",
    ]);
    expect(mocks.comments).toHaveBeenCalledWith("test-mcp");
  });

  it("adds comment", async () => {
    mocks.readToken.mockResolvedValue(TOKEN);
    mocks.addComment.mockResolvedValue({ success: true, id: "c1" });
    await program.parseAsync([
      "node",
      "viben",
      "mcp-market",
      "comment",
      "test-mcp",
      "Nice!",
    ]);
    expect(mocks.addComment).toHaveBeenCalledWith(
      "test-mcp",
      "Nice!",
      undefined,
    );
  });

  it("adds a reply comment with parent", async () => {
    mocks.readToken.mockResolvedValue(TOKEN);
    mocks.addComment.mockResolvedValue({ success: true, id: "c2" });
    await program.parseAsync([
      "node",
      "viben",
      "mcp-market",
      "comment",
      "test-mcp",
      "Thanks!",
      "--parent",
      "c1",
    ]);
    expect(mocks.addComment).toHaveBeenCalledWith(
      "test-mcp",
      "Thanks!",
      "c1",
    );
  });

  it("adds comment requires auth", async () => {
    mocks.readToken.mockResolvedValue(null);
    await expect(
      program.parseAsync([
        "node",
        "viben",
        "mcp-market",
        "comment",
        "test-mcp",
        "Nice!",
      ]),
    ).rejects.toThrow();
  });
});
