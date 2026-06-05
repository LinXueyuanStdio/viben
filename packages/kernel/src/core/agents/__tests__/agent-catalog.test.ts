import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import { AgentCatalog } from "../agent-catalog.js";
import { AgentStore } from "../agent-store.js";

vi.mock("node:fs");

describe("AgentCatalog", () => {
  let catalog: AgentCatalog;

  beforeEach(() => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(fs.mkdirSync).mockReturnValue(undefined as any);
    const store = new AgentStore("/tmp/test/.viben/agents.json");
    catalog = new AgentCatalog(store, "/tmp/test/.viben/registry-cache.json");
  });

  afterEach(() => { vi.restoreAllMocks(); });

  describe("resolve", () => {
    it("returns AgentDefinition for installed agent", () => {
      const storeData = {
        version: 1,
        installed: {
          claude: {
            registryId: "claude-acp", name: "Claude Agent", version: "0.22.2",
            distribution: "npx", command: "npx",
            args: ["@agentclientprotocol/claude-agent-acp@0.22.2"],
            env: {}, installedAt: "2026-03-22T00:00:00.000Z", binaryPath: null,
          },
        },
      };
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(storeData) as any);
      catalog.load();

      const def = catalog.resolve("claude");
      expect(def).toBeDefined();
      expect(def!.name).toBe("claude");
      expect(def!.command).toBe("npx");
      expect(def!.args).toContain("@agentclientprotocol/claude-agent-acp@0.22.2");
    });

    it("returns undefined for unknown agent", () => {
      catalog.load();
      expect(catalog.resolve("nonexistent")).toBeUndefined();
    });
  });

  describe("getAvailable", () => {
    it("marks installed agents correctly", () => {
      const storeData = {
        version: 1,
        installed: {
          claude: {
            registryId: "claude-acp", name: "Claude Agent", version: "0.22.2",
            distribution: "npx", command: "npx", args: [], env: {},
            installedAt: "2026-03-22T00:00:00.000Z", binaryPath: null,
          },
        },
      };
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(storeData) as any);
      catalog.load();

      const items = catalog.getAvailable();
      const claudeItem = items.find((i) => i.key === "claude");
      expect(claudeItem?.installed).toBe(true);
    });
  });
});
