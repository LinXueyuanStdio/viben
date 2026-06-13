import { describe, it, expect, beforeEach } from "vitest";
import { ClaudeExecutor } from "./claude";

describe("executor/engines/claude", () => {
  let executor: ClaudeExecutor;

  beforeEach(() => {
    executor = new ClaudeExecutor();
  });

  describe("type", () => {
    it("should be CLAUDE_CODE", () => {
      expect(executor.type).toBe("CLAUDE_CODE");
    });
  });

  describe("capabilities", () => {
    it("should include all Claude capabilities", () => {
      const caps = executor.capabilities();
      expect(caps).toContain("SPAWN");
      expect(caps).toContain("CHAT");
      expect(caps).toContain("CHAT_SDK");
      expect(caps).toContain("CHAT_STREAMING");
      expect(caps).toContain("SESSION_RESUME");
      expect(caps).toContain("SESSION_FORK");
      expect(caps).toContain("CONTEXT_USAGE");
    });

    it("should return 7 capabilities", () => {
      expect(executor.capabilities()).toHaveLength(7);
    });
  });

  describe("supports", () => {
    it("should return true for SPAWN", () => {
      expect(executor.supports("SPAWN")).toBe(true);
    });

    it("should return true for CHAT", () => {
      expect(executor.supports("CHAT")).toBe(true);
    });

    it("should return false for non-existent capability", () => {
      expect(executor.supports("NONEXISTENT" as any)).toBe(false);
    });
  });

  describe("getConfigDirName", () => {
    it("should return .claude", () => {
      expect(executor.getConfigDirName()).toBe(".claude");
    });
  });

  describe("getCliName", () => {
    it("should return claude", () => {
      expect(executor.getCliName()).toBe("claude");
    });
  });

  describe("getConfigDir", () => {
    it("should return correct path", () => {
      expect(executor.getConfigDir("/project")).toBe("/project/.claude");
    });
  });

  describe("getAgentConfigPath", () => {
    it("should return correct path for agent", () => {
      const path = executor.getAgentConfigPath("work", "/project");
      expect(path).toBe("/project/.claude/agents/work.md");
    });
  });

  describe("getCommandsPath", () => {
    it("should return commands dir when no parts", () => {
      expect(executor.getCommandsPath("/project")).toBe("/project/.claude/commands");
    });

    it("should return correct path with parts", () => {
      expect(executor.getCommandsPath("/project", "viben", "finish-work.md"))
        .toBe("/project/.claude/commands/viben/finish-work.md");
    });
  });

  describe("getVibenCommandPath", () => {
    it("should return correct relative path", () => {
      expect(executor.getVibenCommandPath("finish-work"))
        .toBe(".claude/commands/viben/finish-work.md");
    });
  });

  describe("buildRunCommand", () => {
    it("should build command with defaults", () => {
      const cmd = executor.buildRunCommand({
        agent: "work",
        prompt: "test prompt",
      });

      expect(cmd).toContain("claude");
      expect(cmd).toContain("-p");
      expect(cmd).toContain("--agent");
      expect(cmd).toContain("work");
      expect(cmd).toContain("--dangerously-skip-permissions");
      expect(cmd).toContain("--output-format");
      expect(cmd).toContain("stream-json");
      expect(cmd[cmd.length - 1]).toBe("test prompt");
    });

    it("should include session ID when provided", () => {
      const cmd = executor.buildRunCommand({
        agent: "work",
        prompt: "test",
        sessionId: "ses_123",
      });

      expect(cmd).toContain("--session-id");
      expect(cmd).toContain("ses_123");
    });

    it("should respect skipPermissions=false", () => {
      const cmd = executor.buildRunCommand({
        agent: "work",
        prompt: "test",
        dangerouslySkipPermissions: false,
      });

      expect(cmd).not.toContain("--dangerously-skip-permissions");
    });

    it("should use verbose only when jsonOutput=false", () => {
      const cmd = executor.buildRunCommand({
        agent: "work",
        prompt: "test",
        jsonOutput: false,
        verbose: true,
      });

      expect(cmd).toContain("--verbose");
      expect(cmd).not.toContain("--output-format");
    });
  });

  describe("buildResumeCommand", () => {
    it("should build correct resume command", () => {
      const cmd = executor.buildResumeCommand("ses_123");
      expect(cmd).toEqual(["claude", "--resume", "ses_123"]);
    });
  });

  describe("getResumeCommandStr", () => {
    it("should return command string without cwd", () => {
      const str = executor.getResumeCommandStr("ses_123");
      expect(str).toBe("claude --resume ses_123");
    });

    it("should include cd when cwd provided", () => {
      const str = executor.getResumeCommandStr("ses_123", "/path/to/project");
      expect(str).toBe("cd /path/to/project && claude --resume ses_123");
    });
  });

  describe("getNonInteractiveEnv", () => {
    it("should return CLAUDE_NON_INTERACTIVE=1", () => {
      const env = executor.getNonInteractiveEnv();
      expect(env.CLAUDE_NON_INTERACTIVE).toBe("1");
    });
  });

  describe("supportsSessionIdOnCreate", () => {
    it("should return true", () => {
      expect(executor.supportsSessionIdOnCreate()).toBe(true);
    });
  });

  describe("supportsCLIAgents", () => {
    it("should return true", () => {
      expect(executor.supportsCLIAgents()).toBe(true);
    });
  });

  describe("extractSessionIdFromLog", () => {
    it("should return null (Claude uses --session-id)", () => {
      expect(executor.extractSessionIdFromLog("some log content")).toBeNull();
    });
  });

  describe("defaultMcpConfigPath", () => {
    it("should return path to .claude.json in home", () => {
      const path = executor.defaultMcpConfigPath();
      expect(path).toContain(".claude.json");
    });
  });

  describe("config inheritance", () => {
    it("should use config model in buildRunCommand", () => {
      const configuredExecutor = new ClaudeExecutor({ model: "sonnet" });
      expect(configuredExecutor.capabilities()).toContain("CHAT");
    });
  });
});
