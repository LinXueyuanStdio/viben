import { describe, it, expect, beforeEach } from "vitest";
import { GeminiExecutor } from "./gemini";

describe("executor/engines/gemini", () => {
  let executor: GeminiExecutor;

  beforeEach(() => {
    executor = new GeminiExecutor();
  });

  describe("type", () => {
    it("should be GEMINI", () => {
      expect(executor.type).toBe("GEMINI");
    });
  });

  describe("capabilities", () => {
    it("should include basic capabilities", () => {
      const caps = executor.capabilities();
      expect(caps).toContain("SPAWN");
      expect(caps).toContain("CHAT");
      expect(caps).toContain("SESSION_RESUME");
    });

    it("should NOT include streaming (not supported)", () => {
      const caps = executor.capabilities();
      expect(caps).not.toContain("CHAT_STREAMING");
    });

    it("should return 3 capabilities", () => {
      expect(executor.capabilities()).toHaveLength(3);
    });
  });

  describe("getConfigDirName", () => {
    it("should return .gemini", () => {
      expect(executor.getConfigDirName()).toBe(".gemini");
    });
  });

  describe("getCliName", () => {
    it("should return gemini", () => {
      expect(executor.getCliName()).toBe("gemini");
    });
  });

  describe("getVibenCommandPath", () => {
    it("should return .toml extension path", () => {
      expect(executor.getVibenCommandPath("finish-work"))
        .toBe(".gemini/commands/viben/finish-work.toml");
    });
  });

  describe("buildRunCommand", () => {
    it("should build simple command", () => {
      const cmd = executor.buildRunCommand({
        agent: "work",
        prompt: "test prompt",
      });

      expect(cmd).toEqual(["gemini", "test prompt"]);
    });
  });

  describe("buildResumeCommand", () => {
    it("should build correct resume command", () => {
      const cmd = executor.buildResumeCommand("ses_abc");
      expect(cmd).toEqual(["gemini", "--resume", "ses_abc"]);
    });
  });

  describe("getNonInteractiveEnv", () => {
    it("should return empty object", () => {
      const env = executor.getNonInteractiveEnv();
      expect(env).toEqual({});
    });
  });

  describe("supportsSessionIdOnCreate", () => {
    it("should return false", () => {
      expect(executor.supportsSessionIdOnCreate()).toBe(false);
    });
  });

  describe("supportsCLIAgents", () => {
    it("should return true", () => {
      expect(executor.supportsCLIAgents()).toBe(true);
    });
  });

  describe("defaultMcpConfigPath", () => {
    it("should return path to settings.json", () => {
      const path = executor.defaultMcpConfigPath();
      expect(path).toContain(".gemini");
      expect(path).toContain("settings.json");
    });
  });
});
