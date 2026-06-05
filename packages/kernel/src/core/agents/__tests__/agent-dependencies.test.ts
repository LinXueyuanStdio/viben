import { describe, it, expect, vi, afterEach } from "vitest";
import {
  getAgentDependencies,
  getAgentCapabilities,
  checkDependencies,
  REGISTRY_AGENT_ALIASES,
  getAgentAlias,
} from "../agent-dependencies.js";

describe("agent-dependencies", () => {
  afterEach(() => { vi.restoreAllMocks(); });

  describe("getAgentDependencies", () => {
    it("returns dependencies for known agent", () => {
      const deps = getAgentDependencies("claude-acp");
      expect(deps).toHaveLength(1);
      expect(deps[0].command).toBe("claude");
      expect(deps[0].label).toBe("Claude CLI");
      expect(deps[0].installHint).toContain("npm");
    });

    it("returns empty array for agent with no deps", () => {
      expect(getAgentDependencies("gemini")).toEqual([]);
    });

    it("returns empty array for unknown agent", () => {
      expect(getAgentDependencies("nonexistent")).toEqual([]);
    });
  });

  describe("getAgentCapabilities", () => {
    it("returns capabilities for claude", () => {
      const caps = getAgentCapabilities("claude");
      expect(caps.supportsResume).toBe(true);
      expect(caps.resumeCommand).toBeDefined();
    });

    it("returns default for unknown agent", () => {
      const caps = getAgentCapabilities("unknown");
      expect(caps.supportsResume).toBe(false);
    });

    it("returns opencode resume and plugin integration", () => {
      const caps = getAgentCapabilities("opencode");
      expect(caps.supportsResume).toBe(true);
      expect(caps.resumeCommand?.("sess-123")).toBe("opencode --session sess-123");
      expect(caps.integration?.strategy).toBe("plugin");
      expect(caps.integration?.handoffCommandName).toBe("viben:handoff");
    });
  });

  describe("REGISTRY_AGENT_ALIASES", () => {
    it("maps claude-acp to claude", () => {
      expect(getAgentAlias("claude-acp")).toBe("claude");
    });

    it("maps codex-acp to codex", () => {
      expect(getAgentAlias("codex-acp")).toBe("codex");
    });

    it("returns registry id as-is when no alias", () => {
      expect(getAgentAlias("cline")).toBe("cline");
    });

    it("maps github-copilot-cli to copilot", () => {
      expect(getAgentAlias("github-copilot-cli")).toBe("copilot");
    });
  });

  describe("checkDependencies", () => {
    it("returns available for agent with no deps", () => {
      const result = checkDependencies("gemini");
      expect(result.available).toBe(true);
    });
  });
});
