/**
 * Base Executor Tests
 *
 * Tests for the shared functionality in BaseExecutor.
 * Uses a concrete test implementation to verify abstract base class behavior.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { AvailabilityInfo } from "../../types";
import type {
  ExecutorCapability,
  ExecutorConfig,
  SpawnOptions,
  ChatOptions,
  ExecutionResult,
  RunCommandOptions,
  SSEMessage,
} from "../ops/types";
import { BaseExecutor } from "./base";

// =============================================================================
// Test Implementation
// =============================================================================

/**
 * Concrete implementation of BaseExecutor for testing purposes.
 * Implements all abstract methods with configurable behavior.
 */
class TestExecutor extends BaseExecutor {
  readonly type = "CLAUDE_CODE" as const; // Using a valid ExecutorType for testing

  // Configurable test state
  private testCapabilities: ExecutorCapability[] = ["SPAWN", "CHAT"];
  private testCliName = "test-cli";
  private testConfigDirName = ".test";
  private testMcpConfigPath: string | null = "/home/user/.test/config.json";
  private testAvailabilityInfo: AvailabilityInfo = { status: "NOT_FOUND" };
  private testSupportsSessionIdOnCreate = true;
  private testSupportsCLIAgents = true;
  private testNonInteractiveEnv: Record<string, string> = { TEST_MODE: "1" };
  private testExtractedSessionId: string | null = null;

  constructor(config: ExecutorConfig = {}) {
    super(config);
  }

  // Setters for test configuration
  setCapabilities(caps: ExecutorCapability[]): void {
    this.testCapabilities = caps;
  }

  setCliName(name: string): void {
    this.testCliName = name;
  }

  setConfigDirName(name: string): void {
    this.testConfigDirName = name;
  }

  setMcpConfigPath(path: string | null): void {
    this.testMcpConfigPath = path;
  }

  setAvailabilityInfo(info: AvailabilityInfo): void {
    this.testAvailabilityInfo = info;
  }

  setSupportsSessionIdOnCreate(supports: boolean): void {
    this.testSupportsSessionIdOnCreate = supports;
  }

  setSupportsCLIAgents(supports: boolean): void {
    this.testSupportsCLIAgents = supports;
  }

  setNonInteractiveEnv(env: Record<string, string>): void {
    this.testNonInteractiveEnv = env;
  }

  setExtractedSessionId(sessionId: string | null): void {
    this.testExtractedSessionId = sessionId;
  }

  // === Abstract method implementations ===

  getAvailabilityInfo(): AvailabilityInfo {
    return this.testAvailabilityInfo;
  }

  capabilities(): ExecutorCapability[] {
    return this.testCapabilities;
  }

  defaultMcpConfigPath(): string | null {
    return this.testMcpConfigPath;
  }

  getConfigDirName(): string {
    return this.testConfigDirName;
  }

  getCliName(): string {
    return this.testCliName;
  }

  buildRunCommand(options: RunCommandOptions): string[] {
    const { agent, prompt, sessionId, dangerouslySkipPermissions, verbose, jsonOutput } = options;
    const cmd = [this.testCliName, "-p", "--agent", agent];

    if (sessionId) {
      cmd.push("--session-id", sessionId);
    }
    if (dangerouslySkipPermissions) {
      cmd.push("--skip-permissions");
    }
    if (verbose) {
      cmd.push("--verbose");
    }
    if (jsonOutput) {
      cmd.push("--json");
    }

    cmd.push(prompt);
    return cmd;
  }

  buildResumeCommand(sessionId: string): string[] {
    return [this.testCliName, "--resume", sessionId];
  }

  getNonInteractiveEnv(): Record<string, string> {
    return this.testNonInteractiveEnv;
  }

  override extractSessionIdFromLog(logContent: string): string | null {
    // Allow testing custom extraction
    if (this.testExtractedSessionId !== null) {
      return this.testExtractedSessionId;
    }
    // Default implementation returns null
    return super.extractSessionIdFromLog(logContent);
  }

  // === Execution methods (minimal implementations for testing) ===

  async spawn(_options: SpawnOptions): Promise<ExecutionResult> {
    return { success: true, exitCode: 0 };
  }

  async chat(_options: ChatOptions): Promise<ExecutionResult> {
    return { success: true, exitCode: 0 };
  }

  async *chatStreaming(_options: ChatOptions): AsyncGenerator<SSEMessage> {
    yield { type: "text", content: "test" };
  }

  async resume(_sessionId: string, _options?: Partial<SpawnOptions>): Promise<ExecutionResult> {
    return { success: true, exitCode: 0 };
  }

  supportsSessionIdOnCreate(): boolean {
    return this.testSupportsSessionIdOnCreate;
  }

  supportsCLIAgents(): boolean {
    return this.testSupportsCLIAgents;
  }

  // === Expose protected methods for testing ===

  public testMergeConfig<T extends Record<string, unknown>>(
    defaults: T,
    overrides?: Partial<T>
  ): T {
    return this.mergeConfig(defaults, overrides);
  }

  public testGetHomePath(...parts: string[]): string {
    return this.getHomePath(...parts);
  }

  public getInternalConfig(): ExecutorConfig {
    return this.config;
  }
}

// =============================================================================
// Tests
// =============================================================================

describe("executor/engines/base", () => {
  let executor: TestExecutor;

  beforeEach(() => {
    executor = new TestExecutor();
  });

  // =========================================================================
  // supports() method - Capability Detection
  // =========================================================================

  describe("supports()", () => {
    it("should return true for supported capability", () => {
      executor.setCapabilities(["SPAWN", "CHAT", "CHAT_STREAMING"]);

      expect(executor.supports("SPAWN")).toBe(true);
      expect(executor.supports("CHAT")).toBe(true);
      expect(executor.supports("CHAT_STREAMING")).toBe(true);
    });

    it("should return false for unsupported capability", () => {
      executor.setCapabilities(["SPAWN", "CHAT"]);

      expect(executor.supports("CHAT_STREAMING")).toBe(false);
      expect(executor.supports("SESSION_RESUME")).toBe(false);
      expect(executor.supports("PLAN_MODE")).toBe(false);
    });

    it("should return false for empty capabilities array", () => {
      executor.setCapabilities([]);

      expect(executor.supports("SPAWN")).toBe(false);
      expect(executor.supports("CHAT")).toBe(false);
    });

    it("should handle all defined capability types", () => {
      const allCapabilities: ExecutorCapability[] = [
        "SPAWN",
        "CHAT",
        "CHAT_SDK",
        "CHAT_STREAMING",
        "SESSION_RESUME",
        "SESSION_FORK",
        "CONTEXT_USAGE",
        "PLAN_MODE",
        "APPROVALS",
      ];

      executor.setCapabilities(allCapabilities);

      for (const cap of allCapabilities) {
        expect(executor.supports(cap)).toBe(true);
      }
    });

    it("should be consistent with capabilities() return value", () => {
      const caps: ExecutorCapability[] = ["SPAWN", "CHAT_SDK", "APPROVALS"];
      executor.setCapabilities(caps);

      const returned = executor.capabilities();
      for (const cap of returned) {
        expect(executor.supports(cap)).toBe(true);
      }
    });
  });

  // =========================================================================
  // getConfigDir() - Configuration Paths
  // =========================================================================

  describe("getConfigDir()", () => {
    it("should join project root with config dir name", () => {
      executor.setConfigDirName(".myexec");

      expect(executor.getConfigDir("/home/user/project")).toBe("/home/user/project/.myexec");
    });

    it("should work with different config dir names", () => {
      executor.setConfigDirName(".claude");
      expect(executor.getConfigDir("/project")).toBe("/project/.claude");

      executor.setConfigDirName(".gemini");
      expect(executor.getConfigDir("/project")).toBe("/project/.gemini");

      executor.setConfigDirName(".cursor");
      expect(executor.getConfigDir("/project")).toBe("/project/.cursor");
    });

    it("should handle nested project paths", () => {
      executor.setConfigDirName(".test");

      expect(executor.getConfigDir("/home/user/projects/my-app")).toBe(
        "/home/user/projects/my-app/.test"
      );
    });

    it("should handle root path", () => {
      executor.setConfigDirName(".config");

      expect(executor.getConfigDir("/")).toBe("/.config");
    });
  });

  // =========================================================================
  // getAgentConfigPath() - Agent Configuration
  // =========================================================================

  describe("getAgentConfigPath()", () => {
    beforeEach(() => {
      executor.setConfigDirName(".test");
    });

    it("should return correct path for agent", () => {
      const path = executor.getAgentConfigPath("work", "/project");
      expect(path).toBe("/project/.test/agents/work.md");
    });

    it("should handle different agent names", () => {
      expect(executor.getAgentConfigPath("debug", "/project")).toBe(
        "/project/.test/agents/debug.md"
      );
      expect(executor.getAgentConfigPath("review", "/project")).toBe(
        "/project/.test/agents/review.md"
      );
      expect(executor.getAgentConfigPath("my-custom-agent", "/project")).toBe(
        "/project/.test/agents/my-custom-agent.md"
      );
    });

    it("should handle spaces in agent names (unusual but valid)", () => {
      const path = executor.getAgentConfigPath("my agent", "/project");
      expect(path).toBe("/project/.test/agents/my agent.md");
    });
  });

  // =========================================================================
  // getCommandsPath() - Commands Directory
  // =========================================================================

  describe("getCommandsPath()", () => {
    beforeEach(() => {
      executor.setConfigDirName(".test");
    });

    it("should return commands dir when no parts provided", () => {
      expect(executor.getCommandsPath("/project")).toBe("/project/.test/commands");
    });

    it("should return correct path with single part", () => {
      expect(executor.getCommandsPath("/project", "viben")).toBe("/project/.test/commands/viben");
    });

    it("should return correct path with multiple parts", () => {
      expect(executor.getCommandsPath("/project", "viben", "finish-work.md")).toBe(
        "/project/.test/commands/viben/finish-work.md"
      );
    });

    it("should handle deeply nested paths", () => {
      expect(executor.getCommandsPath("/project", "custom", "nested", "deep", "command.md")).toBe(
        "/project/.test/commands/custom/nested/deep/command.md"
      );
    });
  });

  // =========================================================================
  // getVibenCommandPath() - Viben Command Paths
  // =========================================================================

  describe("getVibenCommandPath()", () => {
    it("should return correct relative path", () => {
      executor.setConfigDirName(".test");

      expect(executor.getVibenCommandPath("finish-work")).toBe(
        ".test/commands/viben/finish-work.md"
      );
    });

    it("should work with different config dir names", () => {
      executor.setConfigDirName(".claude");
      expect(executor.getVibenCommandPath("start")).toBe(".claude/commands/viben/start.md");

      executor.setConfigDirName(".gemini");
      expect(executor.getVibenCommandPath("start")).toBe(".gemini/commands/viben/start.md");
    });

    it("should handle command names with hyphens", () => {
      executor.setConfigDirName(".test");
      expect(executor.getVibenCommandPath("finish-review-task")).toBe(
        ".test/commands/viben/finish-review-task.md"
      );
    });
  });

  // =========================================================================
  // getResumeCommandStr() - Resume Command String
  // =========================================================================

  describe("getResumeCommandStr()", () => {
    beforeEach(() => {
      executor.setCliName("test-cli");
    });

    it("should return command string without cwd", () => {
      const str = executor.getResumeCommandStr("ses_123");
      expect(str).toBe("test-cli --resume ses_123");
    });

    it("should include cd when cwd provided", () => {
      const str = executor.getResumeCommandStr("ses_123", "/path/to/project");
      expect(str).toBe("cd /path/to/project && test-cli --resume ses_123");
    });

    it("should handle session IDs with various formats", () => {
      expect(executor.getResumeCommandStr("session_abc123")).toBe(
        "test-cli --resume session_abc123"
      );
      expect(executor.getResumeCommandStr("1234567890")).toBe("test-cli --resume 1234567890");
      expect(executor.getResumeCommandStr("a-b-c-d")).toBe("test-cli --resume a-b-c-d");
    });

    it("should handle paths with spaces in cwd", () => {
      const str = executor.getResumeCommandStr("ses_123", "/path/to/my project");
      expect(str).toBe("cd /path/to/my project && test-cli --resume ses_123");
    });
  });

  // =========================================================================
  // extractSessionIdFromLog() - Default Behavior
  // =========================================================================

  describe("extractSessionIdFromLog()", () => {
    it("should return null by default (no extraction)", () => {
      const result = executor.extractSessionIdFromLog("Session started: ses_12345");
      expect(result).toBeNull();
    });

    it("should return null for empty log content", () => {
      expect(executor.extractSessionIdFromLog("")).toBeNull();
    });

    it("should return null for any log content (base implementation)", () => {
      expect(executor.extractSessionIdFromLog("some random log")).toBeNull();
      expect(executor.extractSessionIdFromLog("session_id=abc123")).toBeNull();
    });

    it("should allow subclass to override extraction", () => {
      executor.setExtractedSessionId("custom_session_123");

      expect(executor.extractSessionIdFromLog("any content")).toBe("custom_session_123");
    });
  });

  // =========================================================================
  // Config Propagation
  // =========================================================================

  describe("config propagation", () => {
    it("should store config passed to constructor", () => {
      const config: ExecutorConfig = {
        model: "gpt-4",
        appendPrompt: "Additional context",
        dangerouslySkipPermissions: true,
      };
      const configuredExecutor = new TestExecutor(config);

      expect(configuredExecutor.getInternalConfig()).toEqual(config);
    });

    it("should use empty config when none provided", () => {
      const defaultExecutor = new TestExecutor();

      expect(defaultExecutor.getInternalConfig()).toEqual({});
    });

    it("should preserve all config fields", () => {
      const fullConfig: ExecutorConfig = {
        model: "claude-3",
        appendPrompt: "Test prompt",
        planMode: true,
        approvals: false,
        dangerouslySkipPermissions: true,
        baseCommandOverride: "custom-cli",
        env: { CUSTOM_VAR: "value" },
      };
      const configuredExecutor = new TestExecutor(fullConfig);

      const internal = configuredExecutor.getInternalConfig();
      expect(internal.model).toBe("claude-3");
      expect(internal.appendPrompt).toBe("Test prompt");
      expect(internal.planMode).toBe(true);
      expect(internal.approvals).toBe(false);
      expect(internal.dangerouslySkipPermissions).toBe(true);
      expect(internal.baseCommandOverride).toBe("custom-cli");
      expect(internal.env).toEqual({ CUSTOM_VAR: "value" });
    });
  });

  // =========================================================================
  // mergeConfig() - Protected Helper
  // =========================================================================

  describe("mergeConfig()", () => {
    it("should return defaults when no overrides", () => {
      const defaults = { a: 1, b: "hello" };

      const result = executor.testMergeConfig(defaults);

      expect(result).toEqual(defaults);
    });

    it("should merge overrides with defaults", () => {
      const defaults = { a: 1, b: "hello", c: true };
      const overrides = { b: "world" };

      const result = executor.testMergeConfig(defaults, overrides);

      expect(result).toEqual({ a: 1, b: "world", c: true });
    });

    it("should override all fields when all provided", () => {
      const defaults = { a: 1, b: "hello" };
      const overrides = { a: 2, b: "world" };

      const result = executor.testMergeConfig(defaults, overrides);

      expect(result).toEqual({ a: 2, b: "world" });
    });

    it("should handle undefined overrides", () => {
      const defaults = { a: 1 };

      const result = executor.testMergeConfig(defaults, undefined);

      expect(result).toEqual({ a: 1 });
    });

    it("should handle nested objects (shallow merge)", () => {
      const defaults = { nested: { x: 1, y: 2 } };
      const overrides = { nested: { x: 10 } };

      // Note: This is a shallow merge, nested object is replaced entirely
      const result = executor.testMergeConfig(defaults, overrides as typeof defaults);

      expect(result).toEqual({ nested: { x: 10 } });
    });
  });

  // =========================================================================
  // getHomePath() - Protected Helper
  // =========================================================================

  describe("getHomePath()", () => {
    it("should return path starting from home directory", () => {
      const path = executor.testGetHomePath(".config", "test.json");

      // Should contain home directory path components
      expect(path).toContain(".config");
      expect(path).toContain("test.json");
    });

    it("should handle empty parts", () => {
      const path = executor.testGetHomePath();

      // Should just return home directory
      expect(path).toBeTruthy();
      expect(typeof path).toBe("string");
    });

    it("should handle single part", () => {
      const path = executor.testGetHomePath(".viben");

      expect(path).toContain(".viben");
    });

    it("should handle multiple nested parts", () => {
      const path = executor.testGetHomePath(".config", "viben", "settings", "default.yaml");

      expect(path).toContain(".config");
      expect(path).toContain("viben");
      expect(path).toContain("settings");
      expect(path).toContain("default.yaml");
    });
  });

  // =========================================================================
  // Command Building Integration
  // =========================================================================

  describe("buildRunCommand() integration", () => {
    it("should build basic command", () => {
      const cmd = executor.buildRunCommand({
        agent: "work",
        prompt: "Do something",
      });

      expect(cmd).toContain("test-cli");
      expect(cmd).toContain("-p");
      expect(cmd).toContain("--agent");
      expect(cmd).toContain("work");
      expect(cmd).toContain("Do something");
    });

    it("should include all options when provided", () => {
      const cmd = executor.buildRunCommand({
        agent: "debug",
        prompt: "Fix bug",
        sessionId: "ses_123",
        dangerouslySkipPermissions: true,
        verbose: true,
        jsonOutput: true,
      });

      expect(cmd).toContain("--session-id");
      expect(cmd).toContain("ses_123");
      expect(cmd).toContain("--skip-permissions");
      expect(cmd).toContain("--verbose");
      expect(cmd).toContain("--json");
    });

    it("should omit options when not provided", () => {
      const cmd = executor.buildRunCommand({
        agent: "work",
        prompt: "Test",
      });

      expect(cmd).not.toContain("--session-id");
      expect(cmd).not.toContain("--skip-permissions");
      expect(cmd).not.toContain("--verbose");
      expect(cmd).not.toContain("--json");
    });

    it("should handle prompts with special characters", () => {
      const cmd = executor.buildRunCommand({
        agent: "work",
        prompt: 'Fix the "bug" in src/file.ts',
      });

      expect(cmd[cmd.length - 1]).toBe('Fix the "bug" in src/file.ts');
    });

    it("should handle empty prompt", () => {
      const cmd = executor.buildRunCommand({
        agent: "work",
        prompt: "",
      });

      expect(cmd[cmd.length - 1]).toBe("");
    });

    it("should handle multiline prompts", () => {
      const multilinePrompt = `First line
Second line
Third line`;
      const cmd = executor.buildRunCommand({
        agent: "work",
        prompt: multilinePrompt,
      });

      expect(cmd[cmd.length - 1]).toBe(multilinePrompt);
    });
  });

  // =========================================================================
  // buildResumeCommand() Integration
  // =========================================================================

  describe("buildResumeCommand() integration", () => {
    it("should build correct resume command", () => {
      const cmd = executor.buildResumeCommand("ses_abc123");

      expect(cmd).toEqual(["test-cli", "--resume", "ses_abc123"]);
    });

    it("should handle various session ID formats", () => {
      expect(executor.buildResumeCommand("simple")).toEqual(["test-cli", "--resume", "simple"]);

      expect(executor.buildResumeCommand("with-dashes-123")).toEqual([
        "test-cli",
        "--resume",
        "with-dashes-123",
      ]);

      expect(executor.buildResumeCommand("with_underscores")).toEqual([
        "test-cli",
        "--resume",
        "with_underscores",
      ]);
    });
  });

  // =========================================================================
  // Type Property
  // =========================================================================

  describe("type property", () => {
    it("should return the executor type", () => {
      expect(executor.type).toBe("CLAUDE_CODE");
    });

    it("should be readonly", () => {
      // Type system prevents modification, but we verify the value exists
      expect(typeof executor.type).toBe("string");
    });
  });

  // =========================================================================
  // Edge Cases and Error Handling
  // =========================================================================

  describe("edge cases", () => {
    it("should handle executor with no capabilities", () => {
      executor.setCapabilities([]);

      expect(executor.capabilities()).toHaveLength(0);
      expect(executor.supports("SPAWN")).toBe(false);
      expect(executor.supports("CHAT")).toBe(false);
    });

    it("should handle executor with single capability", () => {
      executor.setCapabilities(["SPAWN"]);

      expect(executor.capabilities()).toHaveLength(1);
      expect(executor.supports("SPAWN")).toBe(true);
      expect(executor.supports("CHAT")).toBe(false);
    });

    it("should handle empty config dir name", () => {
      executor.setConfigDirName("");

      expect(executor.getConfigDir("/project")).toBe("/project");
      expect(executor.getVibenCommandPath("test")).toBe("/commands/viben/test.md");
    });

    it("should handle config with undefined values", () => {
      const config: ExecutorConfig = {
        model: undefined,
        appendPrompt: undefined,
      };
      const configuredExecutor = new TestExecutor(config);

      // Should not throw, undefined values are preserved
      expect(configuredExecutor.getInternalConfig().model).toBeUndefined();
    });

    it("should handle special characters in paths", () => {
      executor.setConfigDirName(".test-exec_v2");

      expect(executor.getConfigDir("/my project/path")).toBe("/my project/path/.test-exec_v2");
    });
  });

  // =========================================================================
  // Consistency Tests
  // =========================================================================

  describe("method consistency", () => {
    it("should use same cli name across related methods", () => {
      executor.setCliName("my-executor");

      const runCmd = executor.buildRunCommand({ agent: "work", prompt: "test" });
      const resumeCmd = executor.buildResumeCommand("ses_123");
      const resumeStr = executor.getResumeCommandStr("ses_123");

      expect(runCmd[0]).toBe("my-executor");
      expect(resumeCmd[0]).toBe("my-executor");
      expect(resumeStr).toContain("my-executor");
    });

    it("should use same config dir name across related methods", () => {
      executor.setConfigDirName(".custom");

      const configDir = executor.getConfigDir("/project");
      const agentPath = executor.getAgentConfigPath("work", "/project");
      const commandsPath = executor.getCommandsPath("/project");
      const vibenPath = executor.getVibenCommandPath("test");

      expect(configDir).toContain(".custom");
      expect(agentPath).toContain(".custom");
      expect(commandsPath).toContain(".custom");
      expect(vibenPath).toContain(".custom");
    });
  });
});
