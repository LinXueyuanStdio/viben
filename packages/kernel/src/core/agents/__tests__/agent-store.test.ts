import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import { AgentStore } from "../agent-store.js";

vi.mock("node:fs");
describe("AgentStore", () => {
  let store: AgentStore;

  beforeEach(() => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(fs.mkdirSync).mockReturnValue(undefined as any);
    store = new AgentStore("/home/testuser/.viben/agents.json");
  });

  afterEach(() => { vi.restoreAllMocks(); });

  describe("load", () => {
    it("creates empty store if file does not exist", () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      store.load();
      expect(store.getInstalled()).toEqual({});
    });

    it("loads existing agents from file", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({
        version: 1,
        installed: {
          claude: {
            registryId: "claude-acp",
            name: "Claude Agent",
            version: "0.22.2",
            distribution: "npx",
            command: "npx",
            args: ["@agentclientprotocol/claude-agent-acp@0.22.2"],
            env: {},
            installedAt: "2026-03-22T00:00:00.000Z",
            binaryPath: null,
          },
        },
      }) as any);
      store.load();
      const installed = store.getInstalled();
      expect(installed["claude"]).toBeDefined();
      expect(installed["claude"].name).toBe("Claude Agent");
    });
  });

  describe("addAgent / removeAgent", () => {
    it("adds agent and persists", () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.writeFileSync).mockReturnValue(undefined);
      vi.mocked(fs.renameSync).mockReturnValue(undefined);
      store.load();
      store.addAgent("gemini", {
        registryId: "gemini",
        name: "Gemini CLI",
        version: "0.34.0",
        distribution: "npx",
        command: "npx",
        args: ["@google/gemini-cli@0.34.0", "--acp"],
        env: {},
        installedAt: new Date().toISOString(),
        binaryPath: null,
      });
      expect(store.getAgent("gemini")).toBeDefined();
      expect(vi.mocked(fs.writeFileSync)).toHaveBeenCalled();
    });

    it("removes agent and persists", () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.writeFileSync).mockReturnValue(undefined);
      vi.mocked(fs.renameSync).mockReturnValue(undefined);
      store.load();
      store.addAgent("gemini", {
        registryId: "gemini",
        name: "Gemini CLI",
        version: "0.34.0",
        distribution: "npx",
        command: "npx",
        args: ["@google/gemini-cli@0.34.0", "--acp"],
        env: {},
        installedAt: new Date().toISOString(),
        binaryPath: null,
      });
      store.removeAgent("gemini");
      expect(store.getAgent("gemini")).toBeUndefined();
    });
  });
});
