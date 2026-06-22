/**
 * Executors Module Tests
 *
 * Tests for:
 * - CommandBuilder - build commands with various parameters
 * - Each executor type for availability, capabilities, and defaultMcpConfigPath
 * - getExecutor factory function
 * - getRegisteredTypes() function
 * - isExecutorType guard function
 */
import { describe, it, expect } from "vitest";
import { homedir } from "node:os";
import { join } from "node:path";

import {
  // Types
  type ExecutorType,
  type CommandParts,

  // Utilities
  CommandBuilder,
  CommandBuildError,
  createCommandParts,

  // Engines
  ClaudeExecutor,
  AmpExecutor,
  GeminiExecutor,
  CodexExecutor,
  OpencodeExecutor,
  CursorAgentExecutor,
  QwenCodeExecutor,
  CopilotExecutor,
  DroidExecutor,
  OpenClawExecutor,

  // Registry
  getExecutor,
  getRegisteredTypes,
  isExecutorType,
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
// Executor Type Tests
// ============================================================================

describe("getRegisteredTypes", () => {
  it("should contain all executor types", () => {
    const types = getRegisteredTypes();

    expect(types).toContain("CLAUDE_CODE");
    expect(types).toContain("AMP");
    expect(types).toContain("GEMINI");
    expect(types).toContain("CODEX");
    expect(types).toContain("OPENCODE");
    expect(types).toContain("CURSOR_AGENT");
    expect(types).toContain("QWEN_CODE");
    expect(types).toContain("COPILOT");
    expect(types).toContain("DROID");
    expect(types).toContain("OPENCLAW");
  });

  it("should have exactly 10 executor types", () => {
    expect(getRegisteredTypes()).toHaveLength(10);
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
    expect(isExecutorType("OPENCLAW")).toBe(true);
  });

  it("should return false for invalid executor types", () => {
    expect(isExecutorType("INVALID")).toBe(false);
    expect(isExecutorType("claude_code")).toBe(false);
    expect(isExecutorType("")).toBe(false);
    expect(isExecutorType("GPT")).toBe(false);
  });
});

// ============================================================================
// getExecutor Factory Tests
// ============================================================================

describe("getExecutor", () => {
  it("should create ClaudeExecutor", () => {
    const executor = getExecutor("CLAUDE_CODE");

    expect(executor.type).toBe("CLAUDE_CODE");
    expect(executor).toBeInstanceOf(ClaudeExecutor);
  });

  it("should create AmpExecutor", () => {
    const executor = getExecutor("AMP");

    expect(executor.type).toBe("AMP");
    expect(executor).toBeInstanceOf(AmpExecutor);
  });

  it("should create GeminiExecutor", () => {
    const executor = getExecutor("GEMINI");

    expect(executor.type).toBe("GEMINI");
    expect(executor).toBeInstanceOf(GeminiExecutor);
  });

  it("should create CodexExecutor", () => {
    const executor = getExecutor("CODEX");

    expect(executor.type).toBe("CODEX");
    expect(executor).toBeInstanceOf(CodexExecutor);
  });

  it("should create OpencodeExecutor", () => {
    const executor = getExecutor("OPENCODE");

    expect(executor.type).toBe("OPENCODE");
    expect(executor).toBeInstanceOf(OpencodeExecutor);
  });

  it("should create CursorAgentExecutor", () => {
    const executor = getExecutor("CURSOR_AGENT");

    expect(executor.type).toBe("CURSOR_AGENT");
    expect(executor).toBeInstanceOf(CursorAgentExecutor);
  });

  it("should create QwenCodeExecutor", () => {
    const executor = getExecutor("QWEN_CODE");

    expect(executor.type).toBe("QWEN_CODE");
    expect(executor).toBeInstanceOf(QwenCodeExecutor);
  });

  it("should create CopilotExecutor", () => {
    const executor = getExecutor("COPILOT");

    expect(executor.type).toBe("COPILOT");
    expect(executor).toBeInstanceOf(CopilotExecutor);
  });

  it("should create DroidExecutor", () => {
    const executor = getExecutor("DROID");

    expect(executor.type).toBe("DROID");
    expect(executor).toBeInstanceOf(DroidExecutor);
  });

  it("should create OpenClawExecutor", () => {
    const executor = getExecutor("OPENCLAW");

    expect(executor.type).toBe("OPENCLAW");
    expect(executor).toBeInstanceOf(OpenClawExecutor);
  });

  it("should throw for unknown executor type", () => {
    expect(() => getExecutor("UNKNOWN" as ExecutorType)).toThrow(
      "Unknown executor type: UNKNOWN"
    );
  });

  it("should pass config to executor", () => {
    const executor = getExecutor("CLAUDE_CODE", { model: "claude-3-opus" });

    expect(executor.type).toBe("CLAUDE_CODE");
  });
});

// ============================================================================
// Individual Executor Tests
// ============================================================================

describe("ClaudeExecutor", () => {
  describe("type", () => {
    it("should have correct type", () => {
      const executor = getExecutor("CLAUDE_CODE");
      expect(executor.type).toBe("CLAUDE_CODE");
    });
  });

  describe("capabilities", () => {
    it("should return correct capabilities", () => {
      const executor = getExecutor("CLAUDE_CODE");
      const caps = executor.capabilities();

      expect(caps).toContain("SESSION_FORK");
      expect(caps).toContain("CONTEXT_USAGE");
      expect(caps).toContain("CHAT");
      expect(caps).toContain("CHAT_SDK");
      expect(caps).toContain("CHAT_STREAMING");
    });
  });

  describe("supports", () => {
    it("should support CHAT", () => {
      const executor = getExecutor("CLAUDE_CODE");
      expect(executor.supports("CHAT")).toBe(true);
    });
  });

  describe("defaultMcpConfigPath", () => {
    it("should return path to .claude.json", () => {
      const executor = getExecutor("CLAUDE_CODE");
      const path = executor.defaultMcpConfigPath();

      expect(path).toBe(join(homedir(), ".claude.json"));
    });
  });

  describe("getAvailabilityInfo", () => {
    it("should return a valid status", () => {
      const executor = getExecutor("CLAUDE_CODE");
      const info = executor.getAvailabilityInfo();

      // In most test environments, .claude.json won't exist
      // Unless the test runner has Claude Code installed
      expect(["NOT_FOUND", "LOGIN_DETECTED", "INSTALLATION_FOUND"]).toContain(info.status);
    });
  });
});

describe("AmpExecutor", () => {
  describe("type", () => {
    it("should have correct type", () => {
      const executor = getExecutor("AMP");
      expect(executor.type).toBe("AMP");
    });
  });

  describe("capabilities", () => {
    it("should return correct capabilities", () => {
      const executor = getExecutor("AMP");
      const caps = executor.capabilities();

      expect(caps).toContain("SESSION_FORK");
    });
  });

  describe("defaultMcpConfigPath", () => {
    it("should return path to amp config", () => {
      const executor = getExecutor("AMP");
      const path = executor.defaultMcpConfigPath();

      expect(path).toBe(join(homedir(), ".amp", "config.json"));
    });
  });

  describe("getAvailabilityInfo", () => {
    it("should return availability status", () => {
      const executor = getExecutor("AMP");
      const info = executor.getAvailabilityInfo();

      expect(["NOT_FOUND", "INSTALLATION_FOUND"]).toContain(info.status);
    });
  });
});

describe("GeminiExecutor", () => {
  describe("type", () => {
    it("should have correct type", () => {
      const executor = getExecutor("GEMINI");
      expect(executor.type).toBe("GEMINI");
    });
  });

  describe("capabilities", () => {
    it("should return correct capabilities", () => {
      const executor = getExecutor("GEMINI");
      const caps = executor.capabilities();

      expect(caps).toContain("CHAT");
    });
  });

  describe("defaultMcpConfigPath", () => {
    it("should return path to gemini config", () => {
      const executor = getExecutor("GEMINI");
      const path = executor.defaultMcpConfigPath();

      expect(path).toBe(join(homedir(), ".gemini", "config.json"));
    });
  });

  describe("getAvailabilityInfo", () => {
    it("should return availability status", () => {
      const executor = getExecutor("GEMINI");
      const info = executor.getAvailabilityInfo();

      expect(["NOT_FOUND", "INSTALLATION_FOUND"]).toContain(info.status);
    });
  });
});

describe("CodexExecutor", () => {
  describe("type", () => {
    it("should have correct type", () => {
      const executor = getExecutor("CODEX");
      expect(executor.type).toBe("CODEX");
    });
  });

  describe("capabilities", () => {
    it("should return correct capabilities", () => {
      const executor = getExecutor("CODEX");
      const caps = executor.capabilities();

      expect(caps).toContain("SESSION_FORK");
      expect(caps).toContain("CONTEXT_USAGE");
      expect(caps).toContain("CHAT");
    });
  });

  describe("defaultMcpConfigPath", () => {
    it("should return path to codex config", () => {
      const executor = getExecutor("CODEX");
      const path = executor.defaultMcpConfigPath();

      // Path depends on platform
      expect(path).toContain("codex");
      expect(path).toContain("config.json");
    });
  });

  describe("getAvailabilityInfo", () => {
    it("should return availability status", () => {
      const executor = getExecutor("CODEX");
      const info = executor.getAvailabilityInfo();

      expect(["NOT_FOUND", "INSTALLATION_FOUND"]).toContain(info.status);
    });
  });
});

describe("OpencodeExecutor", () => {
  describe("type", () => {
    it("should have correct type", () => {
      const executor = getExecutor("OPENCODE");
      expect(executor.type).toBe("OPENCODE");
    });
  });

  describe("capabilities", () => {
    it("should return correct capabilities", () => {
      const executor = getExecutor("OPENCODE");
      const caps = executor.capabilities();

      expect(caps).toContain("SESSION_FORK");
    });
  });

  describe("defaultMcpConfigPath", () => {
    it("should return path to opencode config", () => {
      const executor = getExecutor("OPENCODE");
      const path = executor.defaultMcpConfigPath();

      expect(path).toBe(join(homedir(), ".opencode", "config.json"));
    });
  });

  describe("getAvailabilityInfo", () => {
    it("should return availability status", () => {
      const executor = getExecutor("OPENCODE");
      const info = executor.getAvailabilityInfo();

      expect(["NOT_FOUND", "INSTALLATION_FOUND"]).toContain(info.status);
    });
  });
});

describe("CursorAgentExecutor", () => {
  describe("type", () => {
    it("should have correct type", () => {
      const executor = getExecutor("CURSOR_AGENT");
      expect(executor.type).toBe("CURSOR_AGENT");
    });
  });

  describe("capabilities", () => {
    it("should return correct capabilities", () => {
      const executor = getExecutor("CURSOR_AGENT");
      const caps = executor.capabilities();

      expect(caps).toContain("SPAWN");
    });
  });

  describe("defaultMcpConfigPath", () => {
    it("should return path to cursor config", () => {
      const executor = getExecutor("CURSOR_AGENT");
      const path = executor.defaultMcpConfigPath();

      expect(path).toContain("Cursor");
      expect(path).toContain("settings.json");
    });
  });

  describe("getAvailabilityInfo", () => {
    it("should return availability status", () => {
      const executor = getExecutor("CURSOR_AGENT");
      const info = executor.getAvailabilityInfo();

      expect(["NOT_FOUND", "INSTALLATION_FOUND"]).toContain(info.status);
    });
  });
});

describe("QwenCodeExecutor", () => {
  describe("type", () => {
    it("should have correct type", () => {
      const executor = getExecutor("QWEN_CODE");
      expect(executor.type).toBe("QWEN_CODE");
    });
  });

  describe("capabilities", () => {
    it("should return correct capabilities", () => {
      const executor = getExecutor("QWEN_CODE");
      const caps = executor.capabilities();

      expect(caps).toContain("SESSION_FORK");
    });
  });

  describe("defaultMcpConfigPath", () => {
    it("should return path to qwen-code config", () => {
      const executor = getExecutor("QWEN_CODE");
      const path = executor.defaultMcpConfigPath();

      expect(path).toBe(join(homedir(), ".qwen-code", "config.json"));
    });
  });

  describe("getAvailabilityInfo", () => {
    it("should return availability status", () => {
      const executor = getExecutor("QWEN_CODE");
      const info = executor.getAvailabilityInfo();

      expect(["NOT_FOUND", "INSTALLATION_FOUND"]).toContain(info.status);
    });
  });
});

describe("CopilotExecutor", () => {
  describe("type", () => {
    it("should have correct type", () => {
      const executor = getExecutor("COPILOT");
      expect(executor.type).toBe("COPILOT");
    });
  });

  describe("capabilities", () => {
    it("should return capabilities", () => {
      const executor = getExecutor("COPILOT");
      const caps = executor.capabilities();

      expect(caps).toContain("SPAWN");
    });
  });

  describe("defaultMcpConfigPath", () => {
    it("should return path to gh-copilot config", () => {
      const executor = getExecutor("COPILOT");
      const path = executor.defaultMcpConfigPath();

      expect(path).toBe(join(homedir(), ".config", "gh-copilot", "config.json"));
    });
  });

  describe("getAvailabilityInfo", () => {
    it("should return availability status", () => {
      const executor = getExecutor("COPILOT");
      const info = executor.getAvailabilityInfo();

      expect(["NOT_FOUND", "INSTALLATION_FOUND"]).toContain(info.status);
    });
  });
});

describe("DroidExecutor", () => {
  describe("type", () => {
    it("should have correct type", () => {
      const executor = getExecutor("DROID");
      expect(executor.type).toBe("DROID");
    });
  });

  describe("capabilities", () => {
    it("should return correct capabilities", () => {
      const executor = getExecutor("DROID");
      const caps = executor.capabilities();

      expect(caps).toContain("SESSION_FORK");
    });
  });

  describe("defaultMcpConfigPath", () => {
    it("should return path to droid config", () => {
      const executor = getExecutor("DROID");
      const path = executor.defaultMcpConfigPath();

      expect(path).toBe(join(homedir(), ".droid", "config.json"));
    });
  });

  describe("getAvailabilityInfo", () => {
    it("should return availability status", () => {
      const executor = getExecutor("DROID");
      const info = executor.getAvailabilityInfo();

      expect(["NOT_FOUND", "INSTALLATION_FOUND"]).toContain(info.status);
    });
  });
});

// ============================================================================
// Executor Configuration Tests
// ============================================================================

describe("Executor Configuration", () => {
  describe("ClaudeExecutor with config", () => {
    it("should accept model config", () => {
      const executor = getExecutor("CLAUDE_CODE", { model: "claude-3-opus" });
      expect(executor.type).toBe("CLAUDE_CODE");
    });

    it("should accept permissionMode config", () => {
      const executor = getExecutor("CLAUDE_CODE", { permissionMode: "bypassPermissions" });
      expect(executor.type).toBe("CLAUDE_CODE");
    });

    it("should accept baseCommandOverride", () => {
      const executor = getExecutor("CLAUDE_CODE", {
        baseCommandOverride: "custom-claude-cli",
      });
      expect(executor.type).toBe("CLAUDE_CODE");
    });

    it("should accept custom env vars", () => {
      const executor = getExecutor("CLAUDE_CODE", {
        env: { CUSTOM_VAR: "value" },
      });
      expect(executor.type).toBe("CLAUDE_CODE");
    });

    it("should accept dangerouslySkipPermissions", () => {
      const executor = getExecutor("CLAUDE_CODE", {
        dangerouslySkipPermissions: true,
      });
      expect(executor.type).toBe("CLAUDE_CODE");
    });
  });

  describe("AmpExecutor with config", () => {
    it("should accept model config", () => {
      const executor = getExecutor("AMP", { model: "gpt-4" });
      expect(executor.type).toBe("AMP");
    });
  });

  describe("GeminiExecutor with config", () => {
    it("should accept model config", () => {
      const executor = getExecutor("GEMINI", { model: "gemini-1.5-pro" });
      expect(executor.type).toBe("GEMINI");
    });
  });

  describe("CodexExecutor with config", () => {
    it("should accept model config", () => {
      const executor = getExecutor("CODEX", { model: "gpt-4-turbo" });
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

  describe("getExecutor edge cases", () => {
    it("should work with empty config", () => {
      const executor = getExecutor("CLAUDE_CODE", {});
      expect(executor.type).toBe("CLAUDE_CODE");
    });

    it("should work with undefined config", () => {
      const executor = getExecutor("AMP");
      expect(executor.type).toBe("AMP");
    });
  });
});
