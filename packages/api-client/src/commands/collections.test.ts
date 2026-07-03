/**
 * Tests for registerCollectionsCommand
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { Command } from "commander";
import { registerCollectionsCommand } from "./collections";

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  get: vi.fn(),
  create: vi.fn(),
  delete: vi.fn(),
  addItem: vi.fn(),
  removeItem: vi.fn(),
  fork: vi.fn(),
  readToken: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock("../client", () => ({
  VibenClient: class {
    constructor(_config: unknown) {}
    get collections() {
      return {
        list: mocks.list,
        get: mocks.get,
        create: mocks.create,
        delete: mocks.delete,
        addItem: mocks.addItem,
        removeItem: mocks.removeItem,
        fork: mocks.fork,
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

describe("registerCollectionsCommand", () => {
  let program: Command;

  beforeEach(() => {
    vi.clearAllMocks();
    program = new Command();
    program.exitOverride();
    registerCollectionsCommand(program);
  });

  it("lists collections", async () => {
    mocks.list.mockResolvedValue({
      collections: [
        {
          id: "c1",
          name: "My Col",
          itemCount: 3,
          entityType: "mcp",
          isPublic: false,
          ownerId: "u1",
        },
      ],
      pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
    });
    await program.parseAsync(["node", "viben", "collection", "list"]);
    expect(mocks.list).toHaveBeenCalled();
  });

  it("lists collections filtered by type", async () => {
    mocks.list.mockResolvedValue({
      collections: [],
      pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
    });
    await program.parseAsync([
      "node", "viben", "collection", "list", "--type", "mcp",
    ]);
    expect(mocks.list).toHaveBeenCalledWith(
      expect.objectContaining({ entityType: "mcp" }),
    );
  });

  it("lists collections with pagination", async () => {
    mocks.list.mockResolvedValue({
      collections: [],
      pagination: { page: 2, limit: 5, total: 0, totalPages: 0 },
    });
    await program.parseAsync([
      "node", "viben", "collection", "list", "--page", "2", "--limit", "5",
    ]);
    expect(mocks.list).toHaveBeenCalledWith(
      expect.objectContaining({ page: 2, limit: 5 }),
    );
  });

  it("views collection details", async () => {
    mocks.get.mockResolvedValue({
      collection: {
        id: "c1",
        name: "My Col",
        description: "Test desc",
        entityType: "mcp",
        isPublic: false,
        ownerId: "u1",
        owner: { displayName: "Owner" },
      },
      items: [],
    });
    await program.parseAsync(["node", "viben", "collection", "view", "c1"]);
    expect(mocks.get).toHaveBeenCalledWith("c1");
  });

  it("creates a collection", async () => {
    mocks.readToken.mockResolvedValue(TOKEN);
    mocks.create.mockResolvedValue({
      collection: {
        id: "c1",
        name: "NewCol",
        entityType: "mcp",
        isPublic: false,
        ownerId: "u1",
      },
    });
    await program.parseAsync([
      "node",
      "viben",
      "collection",
      "create",
      "NewCol",
    ]);
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "NewCol",
        entityType: "mcp",
      }),
    );
  });

  it("creates collection with description and public flag", async () => {
    mocks.readToken.mockResolvedValue(TOKEN);
    mocks.create.mockResolvedValue({
      collection: {
        id: "c2",
        name: "PubCol",
        entityType: "skill",
        isPublic: true,
        ownerId: "u1",
      },
    });
    await program.parseAsync([
      "node",
      "viben",
      "collection",
      "create",
      "PubCol",
      "--description",
      "A public collection",
      "--type",
      "skill",
      "--public",
    ]);
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "PubCol",
        description: "A public collection",
        entityType: "skill",
        isPublic: true,
      }),
    );
  });

  it("rejects create without auth", async () => {
    mocks.readToken.mockResolvedValue(null);
    await expect(
      program.parseAsync(["node", "viben", "collection", "create", "NewCol"]),
    ).rejects.toThrow();
  });

  it("deletes a collection with --force", async () => {
    mocks.readToken.mockResolvedValue(TOKEN);
    mocks.delete.mockResolvedValue({ success: true });
    await program.parseAsync([
      "node",
      "viben",
      "collection",
      "delete",
      "c1",
      "--force",
    ]);
    expect(mocks.delete).toHaveBeenCalledWith("c1");
  });

  it("rejects delete without auth", async () => {
    mocks.readToken.mockResolvedValue(null);
    await expect(
      program.parseAsync([
        "node",
        "viben",
        "collection",
        "delete",
        "c1",
        "--force",
      ]),
    ).rejects.toThrow();
  });

  it("shows confirmation hint when deleting without --force", async () => {
    mocks.readToken.mockResolvedValue(TOKEN);
    await program.parseAsync([
      "node", "viben", "collection", "delete", "c1",
    ]);
    expect(mocks.delete).not.toHaveBeenCalled();
  });

  it("adds an item to a collection", async () => {
    mocks.readToken.mockResolvedValue(TOKEN);
    mocks.addItem.mockResolvedValue({ success: true });
    await program.parseAsync([
      "node",
      "viben",
      "collection",
      "add",
      "c1",
      "item1",
    ]);
    expect(mocks.addItem).toHaveBeenCalledWith("c1", "item1", undefined);
  });

  it("adds an item with note", async () => {
    mocks.readToken.mockResolvedValue(TOKEN);
    mocks.addItem.mockResolvedValue({ success: true });
    await program.parseAsync([
      "node",
      "viben",
      "collection",
      "add",
      "c1",
      "item1",
      "--note",
      "my note",
    ]);
    expect(mocks.addItem).toHaveBeenCalledWith("c1", "item1", "my note");
  });

  it("rejects add without auth", async () => {
    mocks.readToken.mockResolvedValue(null);
    await expect(
      program.parseAsync([
        "node",
        "viben",
        "collection",
        "add",
        "c1",
        "item1",
      ]),
    ).rejects.toThrow();
  });

  it("removes an item from a collection", async () => {
    mocks.readToken.mockResolvedValue(TOKEN);
    mocks.removeItem.mockResolvedValue({ success: true });
    await program.parseAsync([
      "node",
      "viben",
      "collection",
      "remove",
      "c1",
      "item1",
    ]);
    expect(mocks.removeItem).toHaveBeenCalledWith("c1", "item1");
  });

  it("rejects remove without auth", async () => {
    mocks.readToken.mockResolvedValue(null);
    await expect(
      program.parseAsync([
        "node",
        "viben",
        "collection",
        "remove",
        "c1",
        "item1",
      ]),
    ).rejects.toThrow();
  });

  it("forks a collection", async () => {
    mocks.readToken.mockResolvedValue(TOKEN);
    mocks.fork.mockResolvedValue({
      collection: {
        id: "c2",
        name: "Forked",
        entityType: "mcp",
        isPublic: false,
        ownerId: "u1",
      },
    });
    await program.parseAsync(["node", "viben", "collection", "fork", "c1"]);
    expect(mocks.fork).toHaveBeenCalledWith("c1");
  });

  it("rejects fork without auth", async () => {
    mocks.readToken.mockResolvedValue(null);
    await expect(
      program.parseAsync(["node", "viben", "collection", "fork", "c1"]),
    ).rejects.toThrow();
  });
});
