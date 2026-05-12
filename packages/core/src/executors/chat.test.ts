/**
 * Executor Chat Functionality Unit Tests
 *
 * These tests verify command construction for each executor's chat mode.
 * The spawn function is mocked to test argument building without actually
 * launching external processes.
 *
 * Tests cover:
 * - Command argument building for ClaudeExecutor, GeminiExecutor, CodexExecutor
 * - Environment variable merging (config + runtime)
 * - Error cases (executable not found via mocked `whichSync`)
 * - Session resume functionality
 * - Model and format options
 * - Chat capability detection via supports("CHAT")
 *
 * NOTE: These are UNIT tests that mock spawn and whichSync. They verify that
 * the correct commands would be executed, but do NOT test actual process
 * spawning. For integration tests that verify spawn works correctly with
 * real executables, see the E2E test suite.
 *
 * The spawn infrastructure itself (child_process.spawn) is part of Node.js
 * and is assumed to work correctly. We only test our argument construction.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { ChildProcess } from "node:child_process";

import {
  ClaudeExecutor,
  GeminiExecutor,
  CodexExecutor,
  AmpExecutor,
  OpencodeExecutor,
  CursorAgentExecutor,
  QwenCodeExecutor,
  CopilotExecutor,
  DroidExecutor,
  getExecutor,
  getRegisteredTypes,
} from "./index";

import { ExecutorError } from "../error";

// Mock child_process module
vi.mock("node:child_process", () => ({
  spawn: vi.fn(),
  execSync: vi.fn(),
}));

// Mock SDK MCP registry to avoid TDZ issues from circular side-effect imports
vi.mock("./chat/sdk-mcp-registry", () => ({
  registerSdkMcpServer: vi.fn(),
  getSdkMcpServer: vi.fn(),
  getRegisteredSdkMcpServers: vi.fn(() => []),
  resolveMcpServersForSdk: vi.fn(() => []),
}));

// Mock ops/utils module for whichSync and fileExists
vi.mock("./ops/utils", () => ({
  which: vi.fn(),
  whichSync: vi.fn(),
  getHomeDir: vi.fn(() => "/mock/home"),
  getDataDir: vi.fn(() => "/mock/home/.viben"),
  fileExists: vi.fn(() => false),
  joinPath: vi.fn((...parts: string[]) => parts.join("/")),
}));

import { spawn } from "node:child_process";
import { whichSync } from "./ops/utils";

/**
 * Create a mock ChildProcess for testing
 */
function createMockChildProcess(): ChildProcess {
  const mockProcess = {
    pid: 12345,
    stdin: null,
    stdout: null,
    stderr: null,
    stdio: [null, null, null, null, null],
    killed: false,
    exitCode: null,
    signalCode: null,
    spawnargs: [],
    spawnfile: "",
    connected: false,
    kill: vi.fn(),
    send: vi.fn(),
    disconnect: vi.fn(),
    unref: vi.fn(),
    ref: vi.fn(),
    on: vi.fn((event: string, callback: (...args: any[]) => void) => {
      if (event === "exit") {
        // Simulate exit after a tick
        setTimeout(() => callback(0), 0);
      }
      return mockProcess;
    }),
    once: vi.fn(),
    emit: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    removeAllListeners: vi.fn(),
    setMaxListeners: vi.fn(),
    getMaxListeners: vi.fn(() => 10),
    listeners: vi.fn(() => []),
    rawListeners: vi.fn(() => []),
    listenerCount: vi.fn(() => 0),
    prependListener: vi.fn(),
    prependOnceListener: vi.fn(),
    eventNames: vi.fn(() => []),
    [Symbol.dispose]: vi.fn(),
  } as unknown as ChildProcess;
  return mockProcess;
}

// ============================================================================
// ClaudeExecutor.chat Tests
// ============================================================================

describe("ClaudeExecutor.chat", () => {
  const mockSpawn = vi.mocked(spawn);
  const mockWhichSync = vi.mocked(whichSync);

  beforeEach(() => {
    vi.clearAllMocks();
    mockWhichSync.mockReturnValue("/usr/local/bin/claude");
    mockSpawn.mockReturnValue(createMockChildProcess());
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("should spawn claude with basic prompt", async () => {
    const executor = new ClaudeExecutor();
    await executor.chat({ prompt: "test prompt" });

    expect(mockSpawn).toHaveBeenCalledWith(
      "/usr/local/bin/claude",
      expect.arrayContaining(["-p", "test prompt"]),
      expect.objectContaining({
        stdio: "inherit",
      })
    );
  });

  it("should include model option when specified in config", async () => {
    const executor = new ClaudeExecutor({ model: "claude-3-opus" });
    await executor.chat({ prompt: "test" });

    expect(mockSpawn).toHaveBeenCalledWith(
      "/usr/local/bin/claude",
      expect.arrayContaining(["--model", "claude-3-opus"]),
      expect.any(Object)
    );
  });

  it("should override config model with options model", async () => {
    const executor = new ClaudeExecutor({ model: "claude-3-opus" });
    await executor.chat({ prompt: "test", model: "claude-3-sonnet" });

    const [, args] = mockSpawn.mock.calls[0];
    expect(args).toContain("--model");
    const modelIndex = args.indexOf("--model");
    expect(args[modelIndex + 1]).toBe("claude-3-sonnet");
  });

  it("should include verbose flag when specified", async () => {
    const executor = new ClaudeExecutor();
    await executor.chat({ prompt: "test", verbose: true });

    expect(mockSpawn).toHaveBeenCalledWith(
      "/usr/local/bin/claude",
      expect.arrayContaining(["--verbose"]),
      expect.any(Object)
    );
  });

  it("should include session-id when specified", async () => {
    const executor = new ClaudeExecutor();
    await executor.chat({ prompt: "test", sessionId: "session-123" });

    expect(mockSpawn).toHaveBeenCalledWith(
      "/usr/local/bin/claude",
      expect.arrayContaining(["--session-id", "session-123"]),
      expect.any(Object)
    );
  });

  it("should include resume flag when specified", async () => {
    const executor = new ClaudeExecutor();
    await executor.chat({ prompt: "continue", resume: "prev-session" });

    expect(mockSpawn).toHaveBeenCalledWith(
      "/usr/local/bin/claude",
      expect.arrayContaining(["--resume", "prev-session"]),
      expect.any(Object)
    );
  });

  it("should include dangerously-skip-permissions from config", async () => {
    const executor = new ClaudeExecutor({ dangerouslySkipPermissions: true });
    await executor.chat({ prompt: "test" });

    expect(mockSpawn).toHaveBeenCalledWith(
      "/usr/local/bin/claude",
      expect.arrayContaining(["--dangerously-skip-permissions"]),
      expect.any(Object)
    );
  });

  it("should include dangerously-skip-permissions from options", async () => {
    const executor = new ClaudeExecutor();
    await executor.chat({ prompt: "test", dangerouslySkipPermissions: true });

    expect(mockSpawn).toHaveBeenCalledWith(
      "/usr/local/bin/claude",
      expect.arrayContaining(["--dangerously-skip-permissions"]),
      expect.any(Object)
    );
  });

  it("should include output-format when stream-json specified", async () => {
    const executor = new ClaudeExecutor();
    await executor.chat({ prompt: "test", outputFormat: "stream-json" });

    expect(mockSpawn).toHaveBeenCalledWith(
      "/usr/local/bin/claude",
      expect.arrayContaining(["--output-format", "stream-json"]),
      expect.any(Object)
    );
  });

  it("should include input-format when stream-json specified", async () => {
    const executor = new ClaudeExecutor();
    await executor.chat({ prompt: "test", inputFormat: "stream-json" });

    expect(mockSpawn).toHaveBeenCalledWith(
      "/usr/local/bin/claude",
      expect.arrayContaining(["--input-format", "stream-json"]),
      expect.any(Object)
    );
  });

  it("should not include prompt as argument when inputFormat is stream-json", async () => {
    const executor = new ClaudeExecutor();
    await executor.chat({ prompt: "ignored", inputFormat: "stream-json" });

    const [, args] = mockSpawn.mock.calls[0];
    // Should have -p but not followed by the prompt text
    expect(args).toContain("-p");
    expect(args).not.toContain("ignored");
  });

  it("should use specified cwd", async () => {
    const executor = new ClaudeExecutor();
    await executor.chat({ prompt: "test", cwd: "/custom/path" });

    expect(mockSpawn).toHaveBeenCalledWith(
      "/usr/local/bin/claude",
      expect.any(Array),
      expect.objectContaining({
        cwd: "/custom/path",
      })
    );
  });

  it("should merge environment variables from config and options", async () => {
    const executor = new ClaudeExecutor({ env: { CONFIG_VAR: "config_value" } });
    await executor.chat({
      prompt: "test",
      env: { OPTION_VAR: "option_value" }
    });

    const [, , options] = mockSpawn.mock.calls[0];
    expect(options.env).toMatchObject({
      CONFIG_VAR: "config_value",
      OPTION_VAR: "option_value",
    });
  });

  it("should return NOT_FOUND error when claude command not found", async () => {
    mockWhichSync.mockReturnValue(null);

    const executor = new ClaudeExecutor();
    const result = await executor.chat({ prompt: "test" });

    expect(result.success).toBe(false);
    expect(result.errorType).toBe("NOT_FOUND");
  });

  it("should return ExecutionResult with success", async () => {
    const executor = new ClaudeExecutor();
    const result = await executor.chat({ prompt: "test" });

    expect(result).toHaveProperty("success");
    expect(result).toHaveProperty("exitCode");
  });
});

// ============================================================================
// GeminiExecutor.chat Tests
// ============================================================================

describe("GeminiExecutor.chat", () => {
  const mockSpawn = vi.mocked(spawn);
  const mockWhichSync = vi.mocked(whichSync);

  beforeEach(() => {
    vi.clearAllMocks();
    mockWhichSync.mockReturnValue("/usr/local/bin/gemini");
    mockSpawn.mockReturnValue(createMockChildProcess());
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("should spawn gemini with prompt using --prompt flag", async () => {
    const executor = new GeminiExecutor();
    await executor.chat({ prompt: "test prompt" });

    expect(mockSpawn).toHaveBeenCalledWith(
      "/usr/local/bin/gemini",
      expect.arrayContaining(["--prompt", "test prompt"]),
      expect.objectContaining({
        stdio: "inherit",
      })
    );
  });

  it("should include model option when specified", async () => {
    const executor = new GeminiExecutor({ model: "gemini-1.5-pro" });
    await executor.chat({ prompt: "test" });

    expect(mockSpawn).toHaveBeenCalledWith(
      "/usr/local/bin/gemini",
      expect.arrayContaining(["--model", "gemini-1.5-pro"]),
      expect.any(Object)
    );
  });

  it("should convert stream-json to json for output format", async () => {
    const executor = new GeminiExecutor();
    await executor.chat({ prompt: "test", outputFormat: "stream-json" });

    expect(mockSpawn).toHaveBeenCalledWith(
      "/usr/local/bin/gemini",
      expect.arrayContaining(["--output-format", "json"]),
      expect.any(Object)
    );
  });

  it("should return NOT_FOUND error when gemini command not found", async () => {
    mockWhichSync.mockReturnValue(null);

    const executor = new GeminiExecutor();
    const result = await executor.chat({ prompt: "test" });

    expect(result.success).toBe(false);
    expect(result.errorType).toBe("NOT_FOUND");
  });

  it("should merge environment variables", async () => {
    const executor = new GeminiExecutor({ env: { CONFIG_VAR: "value1" } });
    await executor.chat({
      prompt: "test",
      env: { OPTION_VAR: "value2" }
    });

    const [, , options] = mockSpawn.mock.calls[0];
    expect(options.env).toMatchObject({
      CONFIG_VAR: "value1",
      OPTION_VAR: "value2",
    });
  });
});

// ============================================================================
// CodexExecutor.chat Tests
// ============================================================================

describe("CodexExecutor.chat", () => {
  const mockSpawn = vi.mocked(spawn);
  const mockWhichSync = vi.mocked(whichSync);

  beforeEach(() => {
    vi.clearAllMocks();
    mockWhichSync.mockReturnValue("/usr/local/bin/npx");
    mockSpawn.mockReturnValue(createMockChildProcess());
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("should spawn codex via npx with correct base args", async () => {
    const executor = new CodexExecutor();
    await executor.chat({ prompt: "test prompt" });

    expect(mockSpawn).toHaveBeenCalledWith(
      "/usr/local/bin/npx",
      expect.arrayContaining(["-y", "@openai/codex", "exec", "test prompt"]),
      expect.objectContaining({
        stdio: "inherit",
      })
    );
  });

  it("should include model option when specified", async () => {
    const executor = new CodexExecutor({ model: "gpt-4-turbo" });
    await executor.chat({ prompt: "test" });

    expect(mockSpawn).toHaveBeenCalledWith(
      "/usr/local/bin/npx",
      expect.arrayContaining(["-m", "gpt-4-turbo"]),
      expect.any(Object)
    );
  });

  it("should include session option when specified (resume mode)", async () => {
    const executor = new CodexExecutor();
    await executor.chat({ prompt: "test", sessionId: "codex-session-123" });

    // When sessionId is provided, it uses resume mode with sessionId as positional arg
    expect(mockSpawn).toHaveBeenCalledWith(
      "/usr/local/bin/npx",
      expect.arrayContaining(["resume", "codex-session-123"]),
      expect.any(Object)
    );
  });

  it("should use exec mode for new session", async () => {
    const executor = new CodexExecutor();
    await executor.chat({ prompt: "test" });

    // Codex uses exec mode for new sessions
    expect(mockSpawn).toHaveBeenCalledWith(
      "/usr/local/bin/npx",
      expect.arrayContaining(["exec", "test"]),
      expect.any(Object)
    );
  });

  it("should set NPM_CONFIG_LOGLEVEL to error", async () => {
    const executor = new CodexExecutor();
    await executor.chat({ prompt: "test" });

    const [, , options] = mockSpawn.mock.calls[0];
    expect(options.env?.NPM_CONFIG_LOGLEVEL).toBe("error");
  });

  it("should return NOT_FOUND error when npx command not found", async () => {
    mockWhichSync.mockReturnValue(null);

    const executor = new CodexExecutor();
    const result = await executor.chat({ prompt: "test" });

    expect(result.success).toBe(false);
    expect(result.errorType).toBe("NOT_FOUND");
  });
});

// ============================================================================
// Chat Capability Detection Tests (replaces CHAT_SUPPORTED_EXECUTORS)
// ============================================================================

describe("Chat capability detection via supports('CHAT')", () => {
  const mockWhichSync = vi.mocked(whichSync);

  beforeEach(() => {
    vi.clearAllMocks();
    mockWhichSync.mockReturnValue(null);
  });

  it("ClaudeExecutor should support CHAT", () => {
    const executor = new ClaudeExecutor();
    expect(executor.supports("CHAT")).toBe(true);
  });

  it("GeminiExecutor should support CHAT", () => {
    const executor = new GeminiExecutor();
    expect(executor.supports("CHAT")).toBe(true);
  });

  it("CodexExecutor should support CHAT", () => {
    const executor = new CodexExecutor();
    expect(executor.supports("CHAT")).toBe(true);
  });

  it("AmpExecutor should not support CHAT", () => {
    const executor = new AmpExecutor();
    expect(executor.supports("CHAT")).toBe(false);
  });

  it("OpencodeExecutor should not support CHAT", () => {
    const executor = new OpencodeExecutor();
    expect(executor.supports("CHAT")).toBe(false);
  });

  it("CursorAgentExecutor should not support CHAT", () => {
    const executor = new CursorAgentExecutor();
    expect(executor.supports("CHAT")).toBe(false);
  });

  it("QwenCodeExecutor should not support CHAT", () => {
    const executor = new QwenCodeExecutor();
    expect(executor.supports("CHAT")).toBe(false);
  });

  it("CopilotExecutor should not support CHAT", () => {
    const executor = new CopilotExecutor();
    expect(executor.supports("CHAT")).toBe(false);
  });

  it("DroidExecutor should not support CHAT", () => {
    const executor = new DroidExecutor();
    expect(executor.supports("CHAT")).toBe(false);
  });
});

// ============================================================================
// Executor getCliName Tests (replaces getChatCommand)
// ============================================================================

describe("Executor getCliName", () => {
  const mockWhichSync = vi.mocked(whichSync);

  beforeEach(() => {
    vi.clearAllMocks();
    mockWhichSync.mockReturnValue(null);
  });

  it("ClaudeExecutor CLI name should be 'claude'", () => {
    expect(new ClaudeExecutor().getCliName()).toBe("claude");
  });

  it("GeminiExecutor CLI name should be 'gemini'", () => {
    expect(new GeminiExecutor().getCliName()).toBe("gemini");
  });

  it("CodexExecutor CLI name should be 'codex'", () => {
    expect(new CodexExecutor().getCliName()).toBe("codex");
  });

  it("AmpExecutor CLI name should be 'amp'", () => {
    expect(new AmpExecutor().getCliName()).toBe("amp");
  });
});

// ============================================================================
// getExecutor with Chat Support Tests
// ============================================================================

describe("getExecutor with chat support", () => {
  const mockWhichSync = vi.mocked(whichSync);

  beforeEach(() => {
    vi.clearAllMocks();
    mockWhichSync.mockReturnValue(null);
  });

  it("CLAUDE_CODE executor should support CHAT", () => {
    const executor = getExecutor("CLAUDE_CODE");
    expect(executor.supports("CHAT")).toBe(true);
    expect(executor.getCliName()).toBe("claude");
  });

  it("GEMINI executor should support CHAT", () => {
    const executor = getExecutor("GEMINI");
    expect(executor.supports("CHAT")).toBe(true);
    expect(executor.getCliName()).toBe("gemini");
  });

  it("CODEX executor should support CHAT", () => {
    const executor = getExecutor("CODEX");
    expect(executor.supports("CHAT")).toBe(true);
    expect(executor.getCliName()).toBe("codex");
  });

  it("AMP executor should not support CHAT", () => {
    const executor = getExecutor("AMP");
    expect(executor.supports("CHAT")).toBe(false);
  });
});

// ============================================================================
// ExecutorError Chat Errors Tests
// ============================================================================

describe("ExecutorError chat errors", () => {
  describe("chatNotSupported", () => {
    it("should create error with correct message and code", () => {
      const error = ExecutorError.chatNotSupported("TEST_EXECUTOR");

      expect(error.message).toBe("Chat mode is not supported for TEST_EXECUTOR");
      expect(error.code).toBe("CHAT_NOT_SUPPORTED");
      expect(error.executorType).toBe("TEST_EXECUTOR");
      expect(error).toBeInstanceOf(ExecutorError);
    });
  });

  describe("noPromptProvided", () => {
    it("should create error with correct message and code", () => {
      const error = ExecutorError.noPromptProvided();

      expect(error.message).toBe("No prompt provided and stdin is empty");
      expect(error.code).toBe("NO_PROMPT_PROVIDED");
      expect(error).toBeInstanceOf(ExecutorError);
    });
  });
});

// ============================================================================
// Integration Tests - Full Option Combinations
// ============================================================================

describe("Integration: Full option combinations", () => {
  const mockSpawn = vi.mocked(spawn);
  const mockWhichSync = vi.mocked(whichSync);

  beforeEach(() => {
    vi.clearAllMocks();
    mockWhichSync.mockReturnValue("/usr/local/bin/claude");
    mockSpawn.mockReturnValue(createMockChildProcess());
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("ClaudeExecutor should handle all options correctly", async () => {
    const executor = new ClaudeExecutor({
      model: "claude-3-opus",
      dangerouslySkipPermissions: true,
      env: { CONFIG_ENV: "config" }
    });

    await executor.chat({
      prompt: "full test",
      cwd: "/test/dir",
      verbose: true,
      sessionId: "sess-123",
      outputFormat: "stream-json",
      env: { RUNTIME_ENV: "runtime" }
    });

    const [command, args, options] = mockSpawn.mock.calls[0];

    expect(command).toBe("/usr/local/bin/claude");
    expect(args).toContain("-p");
    expect(args).toContain("full test");
    expect(args).toContain("--model");
    expect(args).toContain("claude-3-opus");
    expect(args).toContain("--verbose");
    expect(args).toContain("--session-id");
    expect(args).toContain("sess-123");
    expect(args).toContain("--output-format");
    expect(args).toContain("stream-json");
    expect(args).toContain("--dangerously-skip-permissions");

    expect(options.cwd).toBe("/test/dir");
    expect(options.env?.CONFIG_ENV).toBe("config");
    expect(options.env?.RUNTIME_ENV).toBe("runtime");
    expect(options.stdio).toBe("inherit");
  });

  it("session resume should work with prompt", async () => {
    const executor = new ClaudeExecutor();

    await executor.chat({
      prompt: "continue working",
      resume: "previous-session-id"
    });

    const [, args] = mockSpawn.mock.calls[0];
    expect(args).toContain("--resume");
    expect(args).toContain("previous-session-id");
    expect(args).toContain("-p");
    expect(args).toContain("continue working");
  });
});
