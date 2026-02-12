/**
 * Executors Module Tests
 *
 * Tests for:
 * - CommandBuilder - build commands with various parameters
 * - createExecutionEnv - default environment creation
 * - applyEnvToSpawnOptions - environment merging
 * - Each executor type for availability, capabilities, and defaultMcpConfigPath
 * - createExecutor factory function
 * - getAllExecutorsAvailability utility
 * - EXECUTOR_TYPES constant
 * - isExecutorType guard function
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { join } from "node:path";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir, homedir, platform } from "node:os";

import {
  // Types
  type ExecutorType,
  type ExecutionEnv,
  type CommandParts,

  // Utilities
  createExecutionEnv,
  applyEnvToSpawnOptions,
  CommandBuilder,
  CommandBuildError,
  createCommandParts,

  // Executors
  ClaudeCode,
  Amp,
  Gemini,
  Codex,
  Opencode,
  CursorAgent,
  QwenCode,
  Copilot,
  Droid,

  // Factory
  createExecutor,
  EXECUTOR_TYPES,
  isExecutorType,
  getAllExecutorsAvailability,
} from "./index";

// ============================================================================
// CommandBuilder Tests
// ============================================================================

describe("CommandBuilder", () => {
  describe("constructor and static new", () => {
    it("should create builder with base command", () => {
      const builder = CommandBuilder.new("npx");
      const parts = builder.buildInitial();

      expect(parts.program).toBe("npx");
      expect(parts.args).toEqual([]);
      expect(parts.env).toEqual({});
    });

    it("should create builder with compound base command", () => {
      const builder = CommandBuilder.new("npx -y @anthropic-ai/claude-code@latest");
      const parts = builder.buildInitial();

      expect(parts.program).toBe("npx");
      expect(parts.args).toEqual(["-y", "@anthropic-ai/claude-code@latest"]);
    });
  });

  describe("addParams", () => {
    it("should add single parameter", () => {
      const parts = CommandBuilder.new("cmd")
        .addParams("-p")
        .buildInitial();

      expect(parts.args).toEqual(["-p"]);
    });

    it("should add multiple parameters", () => {
      const parts = CommandBuilder.new("cmd")
        .addParams("-a", "-b", "-c")
        .buildInitial();

      expect(parts.args).toEqual(["-a", "-b", "-c"]);
    });

    it("should chain multiple addParams calls", () => {
      const parts = CommandBuilder.new("cmd")
        .addParams("-a")
        .addParams("-b", "-c")
        .buildInitial();

      expect(parts.args).toEqual(["-a", "-b", "-c"]);
    });
  });

  describe("extendParams", () => {
    it("should extend with array of parameters", () => {
      const parts = CommandBuilder.new("cmd")
        .extendParams(["--verbose", "--output-format=json"])
        .buildInitial();

      expect(parts.args).toEqual(["--verbose", "--output-format=json"]);
    });

    it("should chain with addParams", () => {
      const parts = CommandBuilder.new("cmd")
        .addParams("-p")
        .extendParams(["--flag1", "--flag2"])
        .buildInitial();

      expect(parts.args).toEqual(["-p", "--flag1", "--flag2"]);
    });
  });

  describe("env", () => {
    it("should set environment variable", () => {
      const parts = CommandBuilder.new("cmd")
        .env("FOO", "bar")
        .buildInitial();

      expect(parts.env).toEqual({ FOO: "bar" });
    });

    it("should set multiple environment variables", () => {
      const parts = CommandBuilder.new("cmd")
        .env("FOO", "bar")
        .env("BAZ", "qux")
        .buildInitial();

      expect(parts.env).toEqual({ FOO: "bar", BAZ: "qux" });
    });

    it("should override environment variable", () => {
      const parts = CommandBuilder.new("cmd")
        .env("FOO", "original")
        .env("FOO", "override")
        .buildInitial();

      expect(parts.env).toEqual({ FOO: "override" });
    });
  });

  describe("buildInitial", () => {
    it("should build complete command parts", () => {
      const parts = CommandBuilder.new("npx -y @package")
        .addParams("-p")
        .extendParams(["--verbose"])
        .env("DEBUG", "true")
        .buildInitial();

      expect(parts.program).toBe("npx");
      expect(parts.args).toEqual(["-y", "@package", "-p", "--verbose"]);
      expect(parts.env).toEqual({ DEBUG: "true" });
    });

    it("should throw for empty command", () => {
      const builder = CommandBuilder.new("");

      expect(() => builder.buildInitial()).toThrow(CommandBuildError);
      expect(() => builder.buildInitial()).toThrow("Command is empty");
    });

    it("should throw for whitespace-only command", () => {
      const builder = CommandBuilder.new("   ");

      expect(() => builder.buildInitial()).toThrow(CommandBuildError);
    });
  });

  describe("buildFollowUp", () => {
    it("should add extra args for follow-up", () => {
      const parts = CommandBuilder.new("cmd")
        .addParams("-p")
        .buildFollowUp(["--resume", "session-123"]);

      expect(parts.args).toEqual(["-p", "--resume", "session-123"]);
    });

    it("should work with empty extra args", () => {
      const parts = CommandBuilder.new("cmd")
        .addParams("-p")
        .buildFollowUp([]);

      expect(parts.args).toEqual(["-p"]);
    });
  });
});

describe("CommandBuildError", () => {
  it("should create error with default code", () => {
    const error = new CommandBuildError("test message");

    expect(error.message).toBe("test message");
    expect(error.code).toBe("COMMAND_BUILD_ERROR");
    expect(error.name).toBe("CommandBuildError");
  });

  it("should create error with custom code", () => {
    const error = new CommandBuildError("test message", "CUSTOM_CODE");

    expect(error.code).toBe("CUSTOM_CODE");
  });

  it("should create empty command error via static method", () => {
    const error = CommandBuildError.emptyCommand();

    expect(error.message).toBe("Command is empty");
    expect(error.code).toBe("EMPTY_COMMAND");
  });

  it("should create parse error via static method", () => {
    const error = CommandBuildError.parseError("invalid syntax");

    expect(error.message).toBe("Failed to parse command: invalid syntax");
    expect(error.code).toBe("PARSE_ERROR");
  });
});

describe("createCommandParts", () => {
  it("should create command parts with program only", () => {
    const parts = createCommandParts("myprogram");

    expect(parts.program).toBe("myprogram");
    expect(parts.args).toEqual([]);
    expect(parts.env).toEqual({});
  });
});

// ============================================================================
// ExecutionEnv Tests
// ============================================================================

describe("createExecutionEnv", () => {
  it("should create default execution environment", () => {
    const env = createExecutionEnv();

    expect(env.vars).toEqual({});
    expect(env.repoContext.workspaceRoot).toBe("");
    expect(env.repoContext.repoNames).toEqual([]);
    expect(env.commitReminder).toBe(false);
    expect(env.commitReminderPrompt).toBe("");
  });

  it("should create environment with workspace root", () => {
    const env = createExecutionEnv("/path/to/workspace");

    expect(env.repoContext.workspaceRoot).toBe("/path/to/workspace");
    expect(env.repoContext.repoNames).toEqual([]);
  });

  it("should create environment with repo names", () => {
    const env = createExecutionEnv("/workspace", ["repo1", "repo2"]);

    expect(env.repoContext.workspaceRoot).toBe("/workspace");
    expect(env.repoContext.repoNames).toEqual(["repo1", "repo2"]);
  });
});

describe("applyEnvToSpawnOptions", () => {
  it("should apply env vars to spawn options", () => {
    const env = createExecutionEnv();
    env.vars = { CUSTOM_VAR: "value" };

    const options: { env?: NodeJS.ProcessEnv } = {};
    applyEnvToSpawnOptions(env, options);

    expect(options.env).toBeDefined();
    expect(options.env!.CUSTOM_VAR).toBe("value");
    // Should also include process.env
    expect(options.env!.PATH).toBe(process.env.PATH);
  });

  it("should preserve existing spawn options env", () => {
    const env = createExecutionEnv();
    env.vars = { NEW_VAR: "new" };

    const options: { env?: NodeJS.ProcessEnv } = {
      env: { EXISTING_VAR: "existing" },
    };
    applyEnvToSpawnOptions(env, options);

    expect(options.env!.NEW_VAR).toBe("new");
    expect(options.env!.EXISTING_VAR).toBe("existing");
  });

  it("should let spawn options override env vars", () => {
    const env = createExecutionEnv();
    env.vars = { SHARED: "from-env" };

    const options: { env?: NodeJS.ProcessEnv } = {
      env: { SHARED: "from-options" },
    };
    applyEnvToSpawnOptions(env, options);

    // options.env should override env.vars
    expect(options.env!.SHARED).toBe("from-options");
  });
});

// ============================================================================
// Executor Type Tests
// ============================================================================

describe("EXECUTOR_TYPES", () => {
  it("should contain all executor types", () => {
    expect(EXECUTOR_TYPES).toContain("CLAUDE_CODE");
    expect(EXECUTOR_TYPES).toContain("AMP");
    expect(EXECUTOR_TYPES).toContain("GEMINI");
    expect(EXECUTOR_TYPES).toContain("CODEX");
    expect(EXECUTOR_TYPES).toContain("OPENCODE");
    expect(EXECUTOR_TYPES).toContain("CURSOR_AGENT");
    expect(EXECUTOR_TYPES).toContain("QWEN_CODE");
    expect(EXECUTOR_TYPES).toContain("COPILOT");
    expect(EXECUTOR_TYPES).toContain("DROID");
  });

  it("should have exactly 9 executor types", () => {
    expect(EXECUTOR_TYPES).toHaveLength(9);
  });
});

describe("isExecutorType", () => {
  it("should return true for valid executor types", () => {
    expect(isExecutorType("CLAUDE_CODE")).toBe(true);
    expect(isExecutorType("AMP")).toBe(true);
    expect(isExecutorType("GEMINI")).toBe(true);
    expect(isExecutorType("CODEX")).toBe(true);
    expect(isExecutorType("OPENCODE")).toBe(true);
    expect(isExecutorType("CURSOR_AGENT")).toBe(true);
    expect(isExecutorType("QWEN_CODE")).toBe(true);
    expect(isExecutorType("COPILOT")).toBe(true);
    expect(isExecutorType("DROID")).toBe(true);
  });

  it("should return false for invalid executor types", () => {
    expect(isExecutorType("INVALID")).toBe(false);
    expect(isExecutorType("claude_code")).toBe(false);
    expect(isExecutorType("")).toBe(false);
    expect(isExecutorType("GPT")).toBe(false);
  });
});

// ============================================================================
// createExecutor Factory Tests
// ============================================================================

describe("createExecutor", () => {
  it("should create ClaudeCode executor", () => {
    const executor = createExecutor("CLAUDE_CODE");

    expect(executor.type).toBe("CLAUDE_CODE");
    expect(executor).toBeInstanceOf(ClaudeCode);
  });

  it("should create Amp executor", () => {
    const executor = createExecutor("AMP");

    expect(executor.type).toBe("AMP");
    expect(executor).toBeInstanceOf(Amp);
  });

  it("should create Gemini executor", () => {
    const executor = createExecutor("GEMINI");

    expect(executor.type).toBe("GEMINI");
    expect(executor).toBeInstanceOf(Gemini);
  });

  it("should create Codex executor", () => {
    const executor = createExecutor("CODEX");

    expect(executor.type).toBe("CODEX");
    expect(executor).toBeInstanceOf(Codex);
  });

  it("should create Opencode executor", () => {
    const executor = createExecutor("OPENCODE");

    expect(executor.type).toBe("OPENCODE");
    expect(executor).toBeInstanceOf(Opencode);
  });

  it("should create CursorAgent executor", () => {
    const executor = createExecutor("CURSOR_AGENT");

    expect(executor.type).toBe("CURSOR_AGENT");
    expect(executor).toBeInstanceOf(CursorAgent);
  });

  it("should create QwenCode executor", () => {
    const executor = createExecutor("QWEN_CODE");

    expect(executor.type).toBe("QWEN_CODE");
    expect(executor).toBeInstanceOf(QwenCode);
  });

  it("should create Copilot executor", () => {
    const executor = createExecutor("COPILOT");

    expect(executor.type).toBe("COPILOT");
    expect(executor).toBeInstanceOf(Copilot);
  });

  it("should create Droid executor", () => {
    const executor = createExecutor("DROID");

    expect(executor.type).toBe("DROID");
    expect(executor).toBeInstanceOf(Droid);
  });

  it("should throw for unknown executor type", () => {
    expect(() => createExecutor("UNKNOWN" as ExecutorType)).toThrow(
      "Unknown executor type: UNKNOWN"
    );
  });

  it("should pass config to executor", () => {
    const executor = createExecutor("CLAUDE_CODE", { model: "claude-3-opus" });

    expect(executor.type).toBe("CLAUDE_CODE");
  });
});

// ============================================================================
// Individual Executor Tests
// ============================================================================

describe("ClaudeCode", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "viben-claude-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("type", () => {
    it("should have correct type", () => {
      const executor = new ClaudeCode();
      expect(executor.type).toBe("CLAUDE_CODE");
    });
  });

  describe("capabilities", () => {
    it("should return correct capabilities", () => {
      const executor = new ClaudeCode();
      const caps = executor.capabilities();

      expect(caps).toContain("SESSION_FORK");
      expect(caps).toContain("CONTEXT_USAGE");
    });
  });

  describe("defaultMcpConfigPath", () => {
    it("should return path to .claude.json", () => {
      const executor = new ClaudeCode();
      const path = executor.defaultMcpConfigPath();

      expect(path).toBe(join(homedir(), ".claude.json"));
    });
  });

  describe("getAvailabilityInfo", () => {
    it("should return NOT_FOUND when no auth file", () => {
      const executor = new ClaudeCode();
      const info = executor.getAvailabilityInfo();

      // In most test environments, .claude.json won't exist
      // Unless the test runner has Claude Code installed
      expect(["NOT_FOUND", "LOGIN_DETECTED"]).toContain(info.status);
    });
  });

  describe("useApprovals", () => {
    it("should accept approval service", () => {
      const executor = new ClaudeCode();
      const approvalService = {
        requestApproval: async () => true,
      };

      // Should not throw
      expect(() => executor.useApprovals(approvalService)).not.toThrow();
    });
  });
});

describe("Amp", () => {
  describe("type", () => {
    it("should have correct type", () => {
      const executor = new Amp();
      expect(executor.type).toBe("AMP");
    });
  });

  describe("capabilities", () => {
    it("should return correct capabilities", () => {
      const executor = new Amp();
      const caps = executor.capabilities();

      expect(caps).toContain("SESSION_FORK");
    });
  });

  describe("defaultMcpConfigPath", () => {
    it("should return path to amp config", () => {
      const executor = new Amp();
      const path = executor.defaultMcpConfigPath();

      expect(path).toBe(join(homedir(), ".amp", "config.json"));
    });
  });

  describe("getAvailabilityInfo", () => {
    it("should return availability status", () => {
      const executor = new Amp();
      const info = executor.getAvailabilityInfo();

      expect(["NOT_FOUND", "INSTALLATION_FOUND"]).toContain(info.status);
    });
  });
});

describe("Gemini", () => {
  describe("type", () => {
    it("should have correct type", () => {
      const executor = new Gemini();
      expect(executor.type).toBe("GEMINI");
    });
  });

  describe("capabilities", () => {
    it("should return correct capabilities", () => {
      const executor = new Gemini();
      const caps = executor.capabilities();

      expect(caps).toContain("SESSION_FORK");
    });
  });

  describe("defaultMcpConfigPath", () => {
    it("should return path to gemini config", () => {
      const executor = new Gemini();
      const path = executor.defaultMcpConfigPath();

      expect(path).toBe(join(homedir(), ".gemini", "config.json"));
    });
  });

  describe("getAvailabilityInfo", () => {
    it("should return availability status", () => {
      const executor = new Gemini();
      const info = executor.getAvailabilityInfo();

      expect(["NOT_FOUND", "INSTALLATION_FOUND"]).toContain(info.status);
    });
  });
});

describe("Codex", () => {
  describe("type", () => {
    it("should have correct type", () => {
      const executor = new Codex();
      expect(executor.type).toBe("CODEX");
    });
  });

  describe("capabilities", () => {
    it("should return correct capabilities", () => {
      const executor = new Codex();
      const caps = executor.capabilities();

      expect(caps).toContain("SESSION_FORK");
      expect(caps).toContain("SETUP_HELPER");
      expect(caps).toContain("CONTEXT_USAGE");
    });
  });

  describe("defaultMcpConfigPath", () => {
    it("should return path to codex config", () => {
      const executor = new Codex();
      const path = executor.defaultMcpConfigPath();

      // Path depends on platform
      expect(path).toContain("codex");
      expect(path).toContain("config.json");
    });
  });

  describe("getAvailabilityInfo", () => {
    it("should return availability status", () => {
      const executor = new Codex();
      const info = executor.getAvailabilityInfo();

      expect(["NOT_FOUND", "INSTALLATION_FOUND"]).toContain(info.status);
    });
  });

  describe("useApprovals", () => {
    it("should accept approval service", () => {
      const executor = new Codex();
      const approvalService = {
        requestApproval: async () => true,
      };

      expect(() => executor.useApprovals(approvalService)).not.toThrow();
    });
  });
});

describe("Opencode", () => {
  describe("type", () => {
    it("should have correct type", () => {
      const executor = new Opencode();
      expect(executor.type).toBe("OPENCODE");
    });
  });

  describe("capabilities", () => {
    it("should return correct capabilities", () => {
      const executor = new Opencode();
      const caps = executor.capabilities();

      expect(caps).toContain("SESSION_FORK");
      expect(caps).toContain("CONTEXT_USAGE");
    });
  });

  describe("defaultMcpConfigPath", () => {
    it("should return path to opencode config", () => {
      const executor = new Opencode();
      const path = executor.defaultMcpConfigPath();

      expect(path).toBe(join(homedir(), ".opencode", "config.json"));
    });
  });

  describe("getAvailabilityInfo", () => {
    it("should return availability status", () => {
      const executor = new Opencode();
      const info = executor.getAvailabilityInfo();

      expect(["NOT_FOUND", "INSTALLATION_FOUND"]).toContain(info.status);
    });
  });
});

describe("CursorAgent", () => {
  describe("type", () => {
    it("should have correct type", () => {
      const executor = new CursorAgent();
      expect(executor.type).toBe("CURSOR_AGENT");
    });
  });

  describe("capabilities", () => {
    it("should return correct capabilities", () => {
      const executor = new CursorAgent();
      const caps = executor.capabilities();

      expect(caps).toContain("SETUP_HELPER");
    });
  });

  describe("defaultMcpConfigPath", () => {
    it("should return path to cursor config", () => {
      const executor = new CursorAgent();
      const path = executor.defaultMcpConfigPath();

      expect(path).toContain("Cursor");
      expect(path).toContain("settings.json");
    });
  });

  describe("getAvailabilityInfo", () => {
    it("should return availability status", () => {
      const executor = new CursorAgent();
      const info = executor.getAvailabilityInfo();

      expect(["NOT_FOUND", "INSTALLATION_FOUND"]).toContain(info.status);
    });
  });
});

describe("QwenCode", () => {
  describe("type", () => {
    it("should have correct type", () => {
      const executor = new QwenCode();
      expect(executor.type).toBe("QWEN_CODE");
    });
  });

  describe("capabilities", () => {
    it("should return correct capabilities", () => {
      const executor = new QwenCode();
      const caps = executor.capabilities();

      expect(caps).toContain("SESSION_FORK");
    });
  });

  describe("defaultMcpConfigPath", () => {
    it("should return path to qwen-code config", () => {
      const executor = new QwenCode();
      const path = executor.defaultMcpConfigPath();

      expect(path).toBe(join(homedir(), ".qwen-code", "config.json"));
    });
  });

  describe("getAvailabilityInfo", () => {
    it("should return availability status", () => {
      const executor = new QwenCode();
      const info = executor.getAvailabilityInfo();

      expect(["NOT_FOUND", "INSTALLATION_FOUND"]).toContain(info.status);
    });
  });
});

describe("Copilot", () => {
  describe("type", () => {
    it("should have correct type", () => {
      const executor = new Copilot();
      expect(executor.type).toBe("COPILOT");
    });
  });

  describe("capabilities", () => {
    it("should return empty capabilities array", () => {
      const executor = new Copilot();
      const caps = executor.capabilities();

      expect(caps).toEqual([]);
    });
  });

  describe("defaultMcpConfigPath", () => {
    it("should return path to gh-copilot config", () => {
      const executor = new Copilot();
      const path = executor.defaultMcpConfigPath();

      expect(path).toBe(join(homedir(), ".config", "gh-copilot", "config.json"));
    });
  });

  describe("getAvailabilityInfo", () => {
    it("should return availability status", () => {
      const executor = new Copilot();
      const info = executor.getAvailabilityInfo();

      expect(["NOT_FOUND", "INSTALLATION_FOUND"]).toContain(info.status);
    });
  });
});

describe("Droid", () => {
  describe("type", () => {
    it("should have correct type", () => {
      const executor = new Droid();
      expect(executor.type).toBe("DROID");
    });
  });

  describe("capabilities", () => {
    it("should return correct capabilities", () => {
      const executor = new Droid();
      const caps = executor.capabilities();

      expect(caps).toContain("SESSION_FORK");
    });
  });

  describe("defaultMcpConfigPath", () => {
    it("should return path to droid config", () => {
      const executor = new Droid();
      const path = executor.defaultMcpConfigPath();

      expect(path).toBe(join(homedir(), ".droid", "config.json"));
    });
  });

  describe("getAvailabilityInfo", () => {
    it("should return availability status", () => {
      const executor = new Droid();
      const info = executor.getAvailabilityInfo();

      expect(["NOT_FOUND", "INSTALLATION_FOUND"]).toContain(info.status);
    });
  });
});

// ============================================================================
// getAllExecutorsAvailability Tests
// ============================================================================

describe("getAllExecutorsAvailability", () => {
  it("should return availability for all executor types", () => {
    const availability = getAllExecutorsAvailability();

    // Should have entry for each executor type
    for (const type of EXECUTOR_TYPES) {
      expect(availability[type]).toBeDefined();
      expect(typeof availability[type].available).toBe("boolean");
      expect(availability[type].executor).toBeDefined();
      expect(availability[type].executor.type).toBe(type);
    }
  });

  it("should return correct availability based on status", () => {
    const availability = getAllExecutorsAvailability();

    for (const type of EXECUTOR_TYPES) {
      const info = availability[type].executor.getAvailabilityInfo();
      const expected =
        info.status === "LOGIN_DETECTED" || info.status === "INSTALLATION_FOUND";

      expect(availability[type].available).toBe(expected);
    }
  });
});

// ============================================================================
// Executor Config Tests
// ============================================================================

describe("Executor Configuration", () => {
  describe("ClaudeCode with config", () => {
    it("should accept model config", () => {
      const executor = new ClaudeCode({ model: "claude-3-opus" });
      expect(executor.type).toBe("CLAUDE_CODE");
    });

    it("should accept planMode config", () => {
      const executor = new ClaudeCode({ planMode: true });
      expect(executor.type).toBe("CLAUDE_CODE");
    });

    it("should accept approvals config", () => {
      const executor = new ClaudeCode({ approvals: true });
      expect(executor.type).toBe("CLAUDE_CODE");
    });

    it("should accept baseCommandOverride", () => {
      const executor = new ClaudeCode({
        baseCommandOverride: "custom-claude-cli",
      });
      expect(executor.type).toBe("CLAUDE_CODE");
    });

    it("should accept custom env vars", () => {
      const executor = new ClaudeCode({
        env: { CUSTOM_VAR: "value" },
      });
      expect(executor.type).toBe("CLAUDE_CODE");
    });

    it("should accept dangerouslySkipPermissions", () => {
      const executor = new ClaudeCode({
        dangerouslySkipPermissions: true,
      });
      expect(executor.type).toBe("CLAUDE_CODE");
    });
  });

  describe("Amp with config", () => {
    it("should accept model config", () => {
      const executor = new Amp({ model: "gpt-4" });
      expect(executor.type).toBe("AMP");
    });
  });

  describe("Gemini with config", () => {
    it("should accept model config", () => {
      const executor = new Gemini({ model: "gemini-1.5-pro" });
      expect(executor.type).toBe("GEMINI");
    });
  });

  describe("Codex with config", () => {
    it("should accept model config", () => {
      const executor = new Codex({ model: "gpt-4-turbo" });
      expect(executor.type).toBe("CODEX");
    });
  });
});

// ============================================================================
// Integration Tests - Command Building
// ============================================================================

describe("Integration: Command Building", () => {
  it("should build Claude Code command correctly", () => {
    const parts = CommandBuilder.new("npx -y @anthropic-ai/claude-code@latest")
      .addParams("-p")
      .extendParams([
        "--verbose",
        "--output-format=stream-json",
        "--input-format=stream-json",
      ])
      .env("NPM_CONFIG_LOGLEVEL", "error")
      .buildInitial();

    expect(parts.program).toBe("npx");
    expect(parts.args).toContain("-y");
    expect(parts.args).toContain("@anthropic-ai/claude-code@latest");
    expect(parts.args).toContain("-p");
    expect(parts.args).toContain("--verbose");
    expect(parts.args).toContain("--output-format=stream-json");
    expect(parts.env.NPM_CONFIG_LOGLEVEL).toBe("error");
  });

  it("should build follow-up command with session", () => {
    const parts = CommandBuilder.new("npx -y @anthropic-ai/claude-code@latest")
      .addParams("-p")
      .buildFollowUp(["--resume", "session-abc123"]);

    expect(parts.args).toContain("--resume");
    expect(parts.args).toContain("session-abc123");
  });

  it("should build simple command correctly", () => {
    const parts = CommandBuilder.new("amp")
      .addParams("--prompt", "Hello")
      .addParams("--model", "gpt-4")
      .buildInitial();

    expect(parts.program).toBe("amp");
    expect(parts.args).toEqual(["--prompt", "Hello", "--model", "gpt-4"]);
  });
});

// ============================================================================
// Edge Cases and Error Handling
// ============================================================================

describe("Edge Cases", () => {
  describe("CommandBuilder edge cases", () => {
    it("should handle command with multiple spaces", () => {
      const parts = CommandBuilder.new("cmd   arg1    arg2").buildInitial();

      expect(parts.program).toBe("cmd");
      expect(parts.args).toEqual(["arg1", "arg2"]);
    });

    it("should handle command with leading/trailing spaces", () => {
      const parts = CommandBuilder.new("  cmd arg  ").buildInitial();

      expect(parts.program).toBe("cmd");
      expect(parts.args).toEqual(["arg"]);
    });
  });

  describe("ExecutionEnv edge cases", () => {
    it("should handle empty vars object", () => {
      const env = createExecutionEnv();
      const options: { env?: NodeJS.ProcessEnv } = {};

      applyEnvToSpawnOptions(env, options);

      expect(options.env).toBeDefined();
      expect(Object.keys(options.env!).length).toBeGreaterThan(0); // Has process.env
    });
  });

  describe("createExecutor edge cases", () => {
    it("should work with empty config", () => {
      const executor = createExecutor("CLAUDE_CODE", {});
      expect(executor.type).toBe("CLAUDE_CODE");
    });

    it("should work with undefined config", () => {
      const executor = createExecutor("AMP");
      expect(executor.type).toBe("AMP");
    });
  });
});
