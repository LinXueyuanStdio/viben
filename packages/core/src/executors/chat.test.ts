/**
 * Executor Chat Functionality Unit Tests
 *
 * These tests verify command construction for each executor's chat mode.
 * The spawn function is mocked to test argument building without actually
 * launching external processes.
 *
 * Tests cover:
 * - Command argument building for ClaudeCode, Gemini, Codex
 * - Environment variable merging (config + runtime)
 * - Error cases (executable not found via mocked `which`)
 * - Session resume functionality
 * - Model and format options
 *
 * NOTE: These are UNIT tests that mock spawn and which. They verify that
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
  ClaudeCode,
  Gemini,
  Codex,
  Amp,
  Opencode,
  CursorAgent,
  QwenCode,
  Copilot,
  Droid,
  CHAT_SUPPORTED_EXECUTORS,
  executorSupportsChat,
  createExecutor,
} from "./index";

import { ExecutorError } from "../error";

// Mock child_process module
vi.mock("node:child_process", () => ({
  spawn: vi.fn(),
}));

// Mock utils module for which function
vi.mock("./utils", () => ({
  which: vi.fn(),
  whichSync: vi.fn(),
  getConfigDir: vi.fn(() => "/mock/config"),
}));

import { spawn } from "node:child_process";
import { which, whichSync } from "./utils";

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
// ClaudeCode.spawnChat Tests
// ============================================================================

describe("ClaudeCode.spawnChat", () => {
  const mockSpawn = vi.mocked(spawn);
  const mockWhich = vi.mocked(which);

  beforeEach(() => {
    vi.clearAllMocks();
    mockWhich.mockResolvedValue("/usr/local/bin/claude");
    mockSpawn.mockReturnValue(createMockChildProcess());
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("should spawn claude with basic prompt", async () => {
    const executor = new ClaudeCode();
    await executor.spawnChat({ prompt: "test prompt" });

    expect(mockSpawn).toHaveBeenCalledWith(
      "/usr/local/bin/claude",
      expect.arrayContaining(["-p", "test prompt"]),
      expect.objectContaining({
        stdio: "inherit",
      })
    );
  });

  it("should include model option when specified in config", async () => {
    const executor = new ClaudeCode({ model: "claude-3-opus" });
    await executor.spawnChat({ prompt: "test" });

    expect(mockSpawn).toHaveBeenCalledWith(
      "/usr/local/bin/claude",
      expect.arrayContaining(["--model", "claude-3-opus"]),
      expect.any(Object)
    );
  });

  it("should override config model with options model", async () => {
    const executor = new ClaudeCode({ model: "claude-3-opus" });
    await executor.spawnChat({ prompt: "test", model: "claude-3-sonnet" });

    const [, args] = mockSpawn.mock.calls[0];
    expect(args).toContain("--model");
    const modelIndex = args.indexOf("--model");
    expect(args[modelIndex + 1]).toBe("claude-3-sonnet");
  });

  it("should include verbose flag when specified", async () => {
    const executor = new ClaudeCode();
    await executor.spawnChat({ prompt: "test", verbose: true });

    expect(mockSpawn).toHaveBeenCalledWith(
      "/usr/local/bin/claude",
      expect.arrayContaining(["--verbose"]),
      expect.any(Object)
    );
  });

  it("should include session-id when specified", async () => {
    const executor = new ClaudeCode();
    await executor.spawnChat({ prompt: "test", sessionId: "session-123" });

    expect(mockSpawn).toHaveBeenCalledWith(
      "/usr/local/bin/claude",
      expect.arrayContaining(["--session-id", "session-123"]),
      expect.any(Object)
    );
  });

  it("should include resume flag when specified", async () => {
    const executor = new ClaudeCode();
    await executor.spawnChat({ prompt: "continue", resume: "prev-session" });

    expect(mockSpawn).toHaveBeenCalledWith(
      "/usr/local/bin/claude",
      expect.arrayContaining(["--resume", "prev-session"]),
      expect.any(Object)
    );
  });

  it("should include dangerously-skip-permissions from config", async () => {
    const executor = new ClaudeCode({ dangerouslySkipPermissions: true });
    await executor.spawnChat({ prompt: "test" });

    expect(mockSpawn).toHaveBeenCalledWith(
      "/usr/local/bin/claude",
      expect.arrayContaining(["--dangerously-skip-permissions"]),
      expect.any(Object)
    );
  });

  it("should include dangerously-skip-permissions from options", async () => {
    const executor = new ClaudeCode();
    await executor.spawnChat({ prompt: "test", dangerouslySkipPermissions: true });

    expect(mockSpawn).toHaveBeenCalledWith(
      "/usr/local/bin/claude",
      expect.arrayContaining(["--dangerously-skip-permissions"]),
      expect.any(Object)
    );
  });

  it("should include output-format when stream-json specified", async () => {
    const executor = new ClaudeCode();
    await executor.spawnChat({ prompt: "test", outputFormat: "stream-json" });

    expect(mockSpawn).toHaveBeenCalledWith(
      "/usr/local/bin/claude",
      expect.arrayContaining(["--output-format", "stream-json"]),
      expect.any(Object)
    );
  });

  it("should include input-format when stream-json specified", async () => {
    const executor = new ClaudeCode();
    await executor.spawnChat({ inputFormat: "stream-json" });

    expect(mockSpawn).toHaveBeenCalledWith(
      "/usr/local/bin/claude",
      expect.arrayContaining(["--input-format", "stream-json"]),
      expect.any(Object)
    );
  });

  it("should not include prompt as argument when inputFormat is stream-json", async () => {
    const executor = new ClaudeCode();
    await executor.spawnChat({ prompt: "ignored", inputFormat: "stream-json" });

    const [, args] = mockSpawn.mock.calls[0];
    // Should have -p but not followed by the prompt text
    expect(args).toContain("-p");
    expect(args).not.toContain("ignored");
  });

  it("should use specified cwd", async () => {
    const executor = new ClaudeCode();
    await executor.spawnChat({ prompt: "test", cwd: "/custom/path" });

    expect(mockSpawn).toHaveBeenCalledWith(
      "/usr/local/bin/claude",
      expect.any(Array),
      expect.objectContaining({
        cwd: "/custom/path",
      })
    );
  });

  it("should merge environment variables from config and options", async () => {
    const executor = new ClaudeCode({ env: { CONFIG_VAR: "config_value" } });
    await executor.spawnChat({
      prompt: "test",
      env: { OPTION_VAR: "option_value" }
    });

    const [, , options] = mockSpawn.mock.calls[0];
    expect(options.env).toMatchObject({
      CONFIG_VAR: "config_value",
      OPTION_VAR: "option_value",
    });
  });

  it("should throw ExecutorError when claude command not found", async () => {
    mockWhich.mockResolvedValue(null);

    const executor = new ClaudeCode();
    await expect(executor.spawnChat({ prompt: "test" }))
      .rejects
      .toThrow(ExecutorError);
  });

  it("should return exitPromise that resolves with exit code", async () => {
    const executor = new ClaudeCode();
    const result = await executor.spawnChat({ prompt: "test" });

    expect(result.child).toBeDefined();
    expect(result.exitPromise).toBeInstanceOf(Promise);
  });
});

// ============================================================================
// Gemini.spawnChat Tests
// ============================================================================

describe("Gemini.spawnChat", () => {
  const mockSpawn = vi.mocked(spawn);
  const mockWhich = vi.mocked(which);

  beforeEach(() => {
    vi.clearAllMocks();
    mockWhich.mockResolvedValue("/usr/local/bin/gemini");
    mockSpawn.mockReturnValue(createMockChildProcess());
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("should spawn gemini with prompt using --prompt flag", async () => {
    const executor = new Gemini();
    await executor.spawnChat({ prompt: "test prompt" });

    expect(mockSpawn).toHaveBeenCalledWith(
      "/usr/local/bin/gemini",
      expect.arrayContaining(["--prompt", "test prompt"]),
      expect.objectContaining({
        stdio: "inherit",
      })
    );
  });

  it("should include model option when specified", async () => {
    const executor = new Gemini({ model: "gemini-1.5-pro" });
    await executor.spawnChat({ prompt: "test" });

    expect(mockSpawn).toHaveBeenCalledWith(
      "/usr/local/bin/gemini",
      expect.arrayContaining(["--model", "gemini-1.5-pro"]),
      expect.any(Object)
    );
  });

  it("should convert stream-json to json for output format", async () => {
    const executor = new Gemini();
    await executor.spawnChat({ prompt: "test", outputFormat: "stream-json" });

    expect(mockSpawn).toHaveBeenCalledWith(
      "/usr/local/bin/gemini",
      expect.arrayContaining(["--output-format", "json"]),
      expect.any(Object)
    );
  });

  it("should include verbose flag when specified", async () => {
    const executor = new Gemini();
    await executor.spawnChat({ prompt: "test", verbose: true });

    expect(mockSpawn).toHaveBeenCalledWith(
      "/usr/local/bin/gemini",
      expect.arrayContaining(["--verbose"]),
      expect.any(Object)
    );
  });

  it("should throw ExecutorError when gemini command not found", async () => {
    mockWhich.mockResolvedValue(null);

    const executor = new Gemini();
    await expect(executor.spawnChat({ prompt: "test" }))
      .rejects
      .toThrow(ExecutorError);
  });

  it("should merge environment variables", async () => {
    const executor = new Gemini({ env: { CONFIG_VAR: "value1" } });
    await executor.spawnChat({
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
// Codex.spawnChat Tests
// ============================================================================

describe("Codex.spawnChat", () => {
  const mockSpawn = vi.mocked(spawn);
  const mockWhich = vi.mocked(which);

  beforeEach(() => {
    vi.clearAllMocks();
    mockWhich.mockResolvedValue("/usr/local/bin/npx");
    mockSpawn.mockReturnValue(createMockChildProcess());
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("should spawn codex via npx with correct base args", async () => {
    const executor = new Codex();
    await executor.spawnChat({ prompt: "test prompt" });

    expect(mockSpawn).toHaveBeenCalledWith(
      "/usr/local/bin/npx",
      expect.arrayContaining(["-y", "@openai/codex", "exec", "test prompt"]),
      expect.objectContaining({
        stdio: "inherit",
      })
    );
  });

  it("should include model option when specified", async () => {
    const executor = new Codex({ model: "gpt-4-turbo" });
    await executor.spawnChat({ prompt: "test" });

    expect(mockSpawn).toHaveBeenCalledWith(
      "/usr/local/bin/npx",
      expect.arrayContaining(["-m", "gpt-4-turbo"]),
      expect.any(Object)
    );
  });

  it("should include session option when specified (resume mode)", async () => {
    const executor = new Codex();
    await executor.spawnChat({ prompt: "test", sessionId: "codex-session-123" });

    // When sessionId is provided, it uses resume mode with sessionId as positional arg
    expect(mockSpawn).toHaveBeenCalledWith(
      "/usr/local/bin/npx",
      expect.arrayContaining(["resume", "codex-session-123"]),
      expect.any(Object)
    );
  });

  it("should use exec mode for new session", async () => {
    const executor = new Codex();
    await executor.spawnChat({ prompt: "test" });

    // Codex uses exec mode for new sessions (no verbose flag)
    expect(mockSpawn).toHaveBeenCalledWith(
      "/usr/local/bin/npx",
      expect.arrayContaining(["exec", "test"]),
      expect.any(Object)
    );
  });

  it("should set NPM_CONFIG_LOGLEVEL to error", async () => {
    const executor = new Codex();
    await executor.spawnChat({ prompt: "test" });

    const [, , options] = mockSpawn.mock.calls[0];
    expect(options.env?.NPM_CONFIG_LOGLEVEL).toBe("error");
  });

  it("should throw ExecutorError when npx command not found", async () => {
    mockWhich.mockResolvedValue(null);

    const executor = new Codex();
    await expect(executor.spawnChat({ prompt: "test" }))
      .rejects
      .toThrow(ExecutorError);
  });
});

// ============================================================================
// CHAT_SUPPORTED_EXECUTORS Tests
// ============================================================================

describe("CHAT_SUPPORTED_EXECUTORS", () => {
  it("should include CLAUDE_CODE, GEMINI, and CODEX", () => {
    expect(CHAT_SUPPORTED_EXECUTORS).toContain("CLAUDE_CODE");
    expect(CHAT_SUPPORTED_EXECUTORS).toContain("GEMINI");
    expect(CHAT_SUPPORTED_EXECUTORS).toContain("CODEX");
  });

  it("should not include unsupported executors", () => {
    expect(CHAT_SUPPORTED_EXECUTORS).not.toContain("AMP");
    expect(CHAT_SUPPORTED_EXECUTORS).not.toContain("OPENCODE");
    expect(CHAT_SUPPORTED_EXECUTORS).not.toContain("CURSOR_AGENT");
    expect(CHAT_SUPPORTED_EXECUTORS).not.toContain("QWEN_CODE");
    expect(CHAT_SUPPORTED_EXECUTORS).not.toContain("COPILOT");
    expect(CHAT_SUPPORTED_EXECUTORS).not.toContain("DROID");
  });

  it("should have exactly 3 supported executors", () => {
    expect(CHAT_SUPPORTED_EXECUTORS).toHaveLength(3);
  });
});

// ============================================================================
// executorSupportsChat Tests
// ============================================================================

describe("executorSupportsChat", () => {
  it("should return true for supported executors", () => {
    expect(executorSupportsChat("CLAUDE_CODE")).toBe(true);
    expect(executorSupportsChat("GEMINI")).toBe(true);
    expect(executorSupportsChat("CODEX")).toBe(true);
  });

  it("should return false for unsupported executors", () => {
    expect(executorSupportsChat("AMP")).toBe(false);
    expect(executorSupportsChat("OPENCODE")).toBe(false);
    expect(executorSupportsChat("CURSOR_AGENT")).toBe(false);
    expect(executorSupportsChat("QWEN_CODE")).toBe(false);
    expect(executorSupportsChat("COPILOT")).toBe(false);
    expect(executorSupportsChat("DROID")).toBe(false);
  });
});

// ============================================================================
// Executor supportsChat and getChatCommand Tests
// ============================================================================

describe("Executor supportsChat and getChatCommand", () => {
  describe("ClaudeCode", () => {
    it("supportsChat should return true", () => {
      expect(new ClaudeCode().supportsChat()).toBe(true);
    });

    it("getChatCommand should return 'claude'", () => {
      expect(new ClaudeCode().getChatCommand()).toBe("claude");
    });
  });

  describe("Gemini", () => {
    it("supportsChat should return true", () => {
      expect(new Gemini().supportsChat()).toBe(true);
    });

    it("getChatCommand should return 'gemini'", () => {
      expect(new Gemini().getChatCommand()).toBe("gemini");
    });
  });

  describe("Codex", () => {
    it("supportsChat should return true", () => {
      expect(new Codex().supportsChat()).toBe(true);
    });

    it("getChatCommand should return 'codex'", () => {
      expect(new Codex().getChatCommand()).toBe("codex");
    });
  });

  describe("Executors without chat support", () => {
    it("Amp should return false and null", () => {
      const executor = new Amp();
      expect(executor.supportsChat()).toBe(false);
      expect(executor.getChatCommand()).toBeNull();
    });

    it("Opencode should return false and null", () => {
      const executor = new Opencode();
      expect(executor.supportsChat()).toBe(false);
      expect(executor.getChatCommand()).toBeNull();
    });

    it("CursorAgent should return false and null", () => {
      const executor = new CursorAgent();
      expect(executor.supportsChat()).toBe(false);
      expect(executor.getChatCommand()).toBeNull();
    });

    it("QwenCode should return false and null", () => {
      const executor = new QwenCode();
      expect(executor.supportsChat()).toBe(false);
      expect(executor.getChatCommand()).toBeNull();
    });

    it("Copilot should return false and null", () => {
      const executor = new Copilot();
      expect(executor.supportsChat()).toBe(false);
      expect(executor.getChatCommand()).toBeNull();
    });

    it("Droid should return false and null", () => {
      const executor = new Droid();
      expect(executor.supportsChat()).toBe(false);
      expect(executor.getChatCommand()).toBeNull();
    });
  });
});

// ============================================================================
// createExecutor with Chat Support Tests
// ============================================================================

describe("createExecutor with chat support", () => {
  it("CLAUDE_CODE executor should support chat", () => {
    const executor = createExecutor("CLAUDE_CODE");
    expect(executor.supportsChat?.()).toBe(true);
    expect(executor.getChatCommand?.()).toBe("claude");
    expect(executor.spawnChat).toBeDefined();
  });

  it("GEMINI executor should support chat", () => {
    const executor = createExecutor("GEMINI");
    expect(executor.supportsChat?.()).toBe(true);
    expect(executor.getChatCommand?.()).toBe("gemini");
    expect(executor.spawnChat).toBeDefined();
  });

  it("CODEX executor should support chat", () => {
    const executor = createExecutor("CODEX");
    expect(executor.supportsChat?.()).toBe(true);
    expect(executor.getChatCommand?.()).toBe("codex");
    expect(executor.spawnChat).toBeDefined();
  });

  it("AMP executor should not support chat", () => {
    const executor = createExecutor("AMP");
    expect(executor.supportsChat?.()).toBe(false);
    expect(executor.getChatCommand?.()).toBeNull();
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
  const mockWhich = vi.mocked(which);

  beforeEach(() => {
    vi.clearAllMocks();
    mockWhich.mockResolvedValue("/usr/local/bin/claude");
    mockSpawn.mockReturnValue(createMockChildProcess());
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("ClaudeCode should handle all options correctly", async () => {
    const executor = new ClaudeCode({
      model: "claude-3-opus",
      dangerouslySkipPermissions: true,
      env: { CONFIG_ENV: "config" }
    });

    await executor.spawnChat({
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
    const executor = new ClaudeCode();

    await executor.spawnChat({
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
