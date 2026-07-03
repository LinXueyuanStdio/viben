/**
 * Tests for registerSkillMarketCommand
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { Command } from "commander";
import { registerSkillMarketCommand } from "./skill-market";

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  search: vi.fn(),
  get: vi.fn(),
  download: vi.fn(),
  toggleFavorite: vi.fn(),
  comments: vi.fn(),
  addComment: vi.fn(),
  rate: vi.fn(),
  readToken: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock("../client", () => ({
  VibenClient: class {
    constructor(_config: unknown) {}
    get skill() {
      return {
        list: mocks.list,
        search: mocks.search,
        get: mocks.get,
        download: mocks.download,
        toggleFavorite: mocks.toggleFavorite,
        comments: mocks.comments,
        addComment: mocks.addComment,
        rate: mocks.rate,
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

vi.mock("node:fs", () => ({
  writeFileSync: vi.fn(),
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
const PAGINATED = {
  data: [
    {
      id: "1",
      name: "TestSkill",
      slug: "test-skill",
      description: "A test skill",
      version: "1.0.0",
      skillType: "command",
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
      tags: null,
      longDescription: null,
      triggerPatterns: null,
      repositoryUrl: null,
      createdAt: "2025-01-01",
    },
  ],
  pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
};

describe("registerSkillMarketCommand", () => {
  let program: Command;

  beforeEach(() => {
    vi.clearAllMocks();
    program = new Command();
    program.exitOverride();
    registerSkillMarketCommand(program);
  });

  it("lists packages", async () => {
    mocks.list.mockResolvedValue(PAGINATED);
    await program.parseAsync(["node", "viben", "skill-market", "list"]);
    expect(mocks.list).toHaveBeenCalledWith(expect.objectContaining({}));
  });

  it("lists packages with pagination options", async () => {
    mocks.list.mockResolvedValue(PAGINATED);
    await program.parseAsync([
      "node",
      "viben",
      "skill-market",
      "list",
      "--page",
      "2",
      "--limit",
      "5",
      "--sort",
      "popular",
      "--category",
      "ai",
      "--type",
      "command",
    ]);
    expect(mocks.list).toHaveBeenCalledWith(
      expect.objectContaining({ page: 2, limit: 5, sort: "popular", category: "ai", type: "command" }),
    );
  });

  it("searches packages", async () => {
    mocks.search.mockResolvedValue(PAGINATED);
    await program.parseAsync([
      "node",
      "viben",
      "skill-market",
      "search",
      "git",
    ]);
    expect(mocks.search).toHaveBeenCalledWith(
      "git",
      expect.objectContaining({}),
    );
  });

  it("searches with pagination options", async () => {
    mocks.search.mockResolvedValue(PAGINATED);
    await program.parseAsync([
      "node",
      "viben",
      "skill-market",
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
    await program.parseAsync(["node", "viben", "skill-market", "view", "test-skill"]);
    expect(mocks.get).toHaveBeenCalledWith("test-skill");
  });

  it("downloads package", async () => {
    const blob = new Blob(["test"]);
    mocks.download.mockResolvedValue(blob);
    await program.parseAsync([
      "node",
      "viben",
      "skill-market",
      "download",
      "test-skill",
    ]);
    expect(mocks.download).toHaveBeenCalledWith("test-skill");
  });

  it("downloads package with custom output path", async () => {
    const blob = new Blob(["test"]);
    mocks.download.mockResolvedValue(blob);
    await program.parseAsync([
      "node",
      "viben",
      "skill-market",
      "download",
      "test-skill",
      "--output",
      "/custom/path.tar.gz",
    ]);
    expect(mocks.download).toHaveBeenCalledWith("test-skill");
  });

  it("toggles favorite (requires auth)", async () => {
    mocks.readToken.mockResolvedValue(TOKEN);
    mocks.toggleFavorite.mockResolvedValue({ favorited: true });
    await program.parseAsync([
      "node",
      "viben",
      "skill-market",
      "favorite",
      "test-skill",
    ]);
    expect(mocks.toggleFavorite).toHaveBeenCalledWith("test-skill");
  });

  it("rejects favorite without auth", async () => {
    mocks.readToken.mockResolvedValue(null);
    await expect(
      program.parseAsync([
        "node",
        "viben",
        "skill-market",
        "favorite",
        "test-skill",
      ]),
    ).rejects.toThrow();
  });

  it("rates package", async () => {
    mocks.readToken.mockResolvedValue(TOKEN);
    mocks.rate.mockResolvedValue({ success: true });
    await program.parseAsync([
      "node",
      "viben",
      "skill-market",
      "rate",
      "test-skill",
      "4",
    ]);
    expect(mocks.rate).toHaveBeenCalledWith("test-skill", 4);
  });

  it("rejects invalid rating (< 1)", async () => {
    await expect(
      program.parseAsync([
        "node",
        "viben",
        "skill-market",
        "rate",
        "test-skill",
        "0",
      ]),
    ).rejects.toThrow();
  });

  it("rejects invalid rating (> 5)", async () => {
    await expect(
      program.parseAsync([
        "node",
        "viben",
        "skill-market",
        "rate",
        "test-skill",
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
        "skill-market",
        "rate",
        "test-skill",
        "4",
      ]),
    ).rejects.toThrow();
  });

  it("shows comments", async () => {
    mocks.comments.mockResolvedValue({ comments: [] });
    await program.parseAsync([
      "node",
      "viben",
      "skill-market",
      "comments",
      "test-skill",
    ]);
    expect(mocks.comments).toHaveBeenCalledWith("test-skill");
  });

  it("adds comment", async () => {
    mocks.readToken.mockResolvedValue(TOKEN);
    mocks.addComment.mockResolvedValue({ success: true, id: "c1" });
    await program.parseAsync([
      "node",
      "viben",
      "skill-market",
      "comment",
      "test-skill",
      "Nice!",
    ]);
    expect(mocks.addComment).toHaveBeenCalledWith(
      "test-skill",
      "Nice!",
      undefined,
    );
  });

  it("adds comment requires auth", async () => {
    mocks.readToken.mockResolvedValue(null);
    await expect(
      program.parseAsync([
        "node",
        "viben",
        "skill-market",
        "comment",
        "test-skill",
        "Nice!",
      ]),
    ).rejects.toThrow();
  });
});
