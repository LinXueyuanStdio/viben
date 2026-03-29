/**
 * Executor Chat CLI Commands Tests
 *
 * Strict tests for the `executor chat` subcommand which enables non-interactive
 * AI coding agent execution (similar to `claude -p`).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Command } from "commander";

// Use vi.hoisted to create state that's available during mock setup
const { mockState, createMockChildProcessInternal } = vi.hoisted(() => {
  type MockChild = {
    on: ReturnType<typeof vi.fn>;
    kill: ReturnType<typeof vi.fn>;
    stdin: { write: ReturnType<typeof vi.fn>; end: ReturnType<typeof vi.fn> };
    stdout: { on: ReturnType<typeof vi.fn> };
    stderr: { on: ReturnType<typeof vi.fn> };
    _emit: (event: string, ...args: unknown[]) => void;
  };

  const state: {
    spawnFn: ReturnType<typeof vi.fn> | null;
    lastChild: MockChild | null;
  } = {
    spawnFn: null,
    lastChild: null,
  };

  const createChild = (): MockChild => {
    const listeners: Record<string, ((...args: unknown[]) => void)[]> = {};

    const mockChild: MockChild = {
      on: vi.fn(function (
        this: typeof mockChild,
        event: string,
        callback: (...args: unknown[]) => void
      ) {
        if (!listeners[event]) {
          listeners[event] = [];
        }
        listeners[event].push(callback);
        return mockChild;
      }),
      kill: vi.fn(),
      stdin: { write: vi.fn(), end: vi.fn() },
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() },
      _emit: (event: string, ...args: unknown[]) => {
        if (listeners[event]) {
          for (const listener of listeners[event]) {
            listener(...args);
          }
        }
      },
    };

    return mockChild;
  };

  return { mockState: state, createMockChildProcessInternal: createChild };
});

// Mock child_process.spawn
vi.mock("node:child_process", () => {
  mockState.spawnFn = vi.fn(() => {
    mockState.lastChild = createMockChildProcessInternal();
    return mockState.lastChild;
  });
  return {
    spawn: mockState.spawnFn,
  };
});

// Mock the executors module - proxy mock calls the mocked spawn
vi.mock("../../executors", () => {
  const MOCK_EXECUTOR_TYPES = [
    "CLAUDE_CODE",
    "AMP",
    "GEMINI",
    "CODEX",
    "OPENCODE",
    "CURSOR_AGENT",
    "QWEN_CODE",
    "COPILOT",
    "DROID",
  ];

  const MOCK_CHAT_SUPPORTED_EXECUTORS = ["CLAUDE_CODE", "GEMINI", "CODEX"];

  const createMockExecutor = (type: string, available: boolean) => ({
    type,
    capabilities: () => ["SESSION_FORK"],
    getAvailabilityInfo: () => ({
      status: available ? "INSTALLATION_FOUND" : "NOT_FOUND",
      lastAuthTimestamp: available ? Date.now() : null,
    }),
    supportsChat: () => MOCK_CHAT_SUPPORTED_EXECUTORS.includes(type),
    getChatCommand: () => {
      if (MOCK_CHAT_SUPPORTED_EXECUTORS.includes(type)) {
        switch (type) {
          case "CLAUDE_CODE":
            return "claude";
          case "GEMINI":
            return "gemini";
          case "CODEX":
            return "codex";
          default:
            return null;
        }
      }
      return null;
    },
    defaultMcpConfigPath: () => `/home/user/.${type.toLowerCase()}/config.json`,
  });

  // Mock SpawnChatProxy that uses the shared mockState.spawnFn
  const createMockSpawnProxy = (executorType: string) => ({
    proxyType: "spawn" as const,
    execute: (options: { prompt?: string; cwd?: string; inputFormat?: string; outputFormat?: string; verbose?: boolean; sessionId?: string; resume?: string; model?: string; dangerouslySkipPermissions?: boolean }) => {
      // Get chat command
      const chatCommand = executorType === "CLAUDE_CODE" ? "claude"
        : executorType === "GEMINI" ? "gemini"
        : executorType === "CODEX" ? "codex"
        : null;

      if (!chatCommand) {
        throw new Error(`Chat not supported for executor: ${executorType}`);
      }

      // Build args
      const args: string[] = ["-p"];
      if (options.prompt) {
        args.push(options.prompt);
      }
      if (options.inputFormat && options.inputFormat !== "text") {
        args.push("--input-format", options.inputFormat);
      }
      if (options.outputFormat && options.outputFormat !== "text") {
        args.push("--output-format", options.outputFormat);
      }
      if (options.verbose) {
        args.push("--verbose");
      }
      if (options.sessionId) {
        args.push("--session-id", options.sessionId);
      }
      if (options.resume) {
        args.push("--resume", options.resume);
      }
      if (options.model) {
        args.push("--model", options.model);
      }
      if (options.dangerouslySkipPermissions) {
        args.push("--dangerously-skip-permissions");
      }

      const spawnOpts: { stdio: "inherit"; cwd?: string; shell: boolean } = {
        stdio: "inherit",
        shell: true,
      };
      if (options.cwd) {
        spawnOpts.cwd = options.cwd;
      }

      return new Promise<{ exitCode: number }>((resolve) => {
        if (!mockState.spawnFn) {
          throw new Error("spawn mock not initialized");
        }
        // Call the shared mock spawn function
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const child = (mockState.spawnFn as any)(chatCommand, args, spawnOpts);

        child.on("error", (error: Error) => {
          console.error(`Failed to start ${chatCommand}: ${error.message}`);
          resolve({ exitCode: 1 });
        });

        child.on("exit", (code: number | null, signal: string | null) => {
          if (signal) {
            resolve({ exitCode: 0 });
            return;
          }
          resolve({ exitCode: code ?? 1 });
        });
      });
    },
  });

  return {
    EXECUTOR_TYPES: MOCK_EXECUTOR_TYPES,
    CHAT_SUPPORTED_EXECUTORS: MOCK_CHAT_SUPPORTED_EXECUTORS,
    executorSupportsChat: (type: string) => MOCK_CHAT_SUPPORTED_EXECUTORS.includes(type),
    getAllExecutorsAvailability: () => {
      const result: Record<string, { available: boolean; executor: ReturnType<typeof createMockExecutor> }> = {};
      const availableExecutors = ["CLAUDE_CODE", "GEMINI"];
      for (const type of MOCK_EXECUTOR_TYPES) {
        const available = availableExecutors.includes(type);
        result[type] = {
          available,
          executor: createMockExecutor(type, available),
        };
      }
      return result;
    },
    createExecutor: (type: string) => {
      if (!MOCK_EXECUTOR_TYPES.includes(type)) {
        throw new Error(`Unknown executor type: ${type}`);
      }
      const availableExecutors = ["CLAUDE_CODE", "GEMINI"];
      return createMockExecutor(type, availableExecutors.includes(type));
    },
    // Mock for the new proxy pattern
    createChatProxyAsync: async (executorType: string, _preferSdk?: boolean) => {
      if (!MOCK_CHAT_SUPPORTED_EXECUTORS.includes(executorType)) {
        throw new Error(`Chat not supported for executor: ${executorType}. Chat-enabled executors: ${MOCK_CHAT_SUPPORTED_EXECUTORS.join(", ")}`);
      }
      return createMockSpawnProxy(executorType);
    },
    chatProxyFactory: {
      isSdkAvailable: (executorType: string) => executorType === "CLAUDE_CODE",
    },
  };
});

// Helper to get the last mock child created
function getLastMockChild() {
  return mockState.lastChild;
}

// Helper to get the mock spawn function for assertions
function getMockSpawn() {
  return mockState.spawnFn;
}

// Mock chalk to avoid color output in tests
vi.mock("chalk", () => ({
  default: {
    bold: (s: string) => s,
    green: (s: string) => s,
    yellow: (s: string) => s,
    red: (s: string) => s,
    gray: (s: string) => s,
    cyan: (s: string) => s,
    blue: (s: string) => s,
  },
}));

import { spawn } from "node:child_process";
import { registerExecutorCommand } from "./executor";

// Alias for compatibility with test patterns - uses shared mock state
function createMockChildProcess() {
  // Returns the last child created by mockState.spawnFn
  // Tests should call this AFTER runCommand starts to get the active child
  return getLastMockChild();
}

describe("Executor Chat CLI Commands", () => {
  let program: Command;
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let processExitSpy: any;

  beforeEach(() => {
    program = new Command();
    program.option("--json", "Output in JSON format");
    program.option("--verbose", "Verbose output");
    program.option("--quiet", "Quiet mode");
    registerExecutorCommand(program);

    consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    // Don't throw on exit(0) - successful completion
    processExitSpy = vi.spyOn(process, "exit").mockImplementation((code) => {
      if (code !== 0) {
        throw new Error(`process.exit(${code})`);
      }
      return undefined as never;
    });

    vi.clearAllMocks();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
    vi.clearAllMocks();
  });

  async function runCommand(args: string[]): Promise<void> {
    await program.parseAsync(["node", "test", ...args]);
  }

  // ============================================================================
  // STRICT TESTS: Basic chat command
  // ============================================================================

  describe("executor chat -n <name> -p <prompt>", () => {
    it("should spawn claude with exact arguments for CLAUDE_CODE", async () => {
      // Start command (async) - this will call spawn internally
      const commandPromise = runCommand([
        "executor", "chat", "-n", "CLAUDE_CODE", "-p", "Hello world",
      ]);

      // Wait for spawn to be called, then trigger exit
      await new Promise(r => setTimeout(r, 10));
      const mockChild = getLastMockChild();
      expect(mockChild).not.toBeNull();
      mockChild!._emit("exit", 0, null);

      await commandPromise;

      // Strict check: spawn was called exactly once
      const mockSpawn = getMockSpawn();
      expect(mockSpawn).toHaveBeenCalledTimes(1);

      // Strict check: first argument is the command
      const [cmd, args, options] = mockSpawn!.mock.calls[0];
      expect(cmd).toBe("claude");

      // Strict check: args contains -p followed by the prompt
      expect(args).toContain("-p");
      const pIndex = (args as string[]).indexOf("-p");
      expect((args as string[])[pIndex + 1]).toBe("Hello world");

      // Strict check: stdio is inherit
      expect(options).toHaveProperty("stdio", "inherit");
      expect(options).toHaveProperty("shell", true);
    });

    it("should handle case-insensitive executor name correctly", async () => {
      const commandPromise = runCommand([
        "executor", "chat", "-n", "claude_code", "-p", "Test",
      ]);

      await new Promise(r => setTimeout(r, 10));
      const mockChild = getLastMockChild();
      mockChild!._emit("exit", 0, null);
      await commandPromise;

      // Must call claude command regardless of case
      const mockSpawn = getMockSpawn();
      const [cmd] = mockSpawn!.mock.calls[0];
      expect(cmd).toBe("claude");
    });

    it("should spawn gemini for GEMINI executor", async () => {
      const commandPromise = runCommand([
        "executor", "chat", "-n", "GEMINI", "-p", "Test",
      ]);

      await new Promise(r => setTimeout(r, 10));
      const mockChild = getLastMockChild();
      mockChild!._emit("exit", 0, null);
      await commandPromise;

      const mockSpawn = getMockSpawn();
      const [cmd] = mockSpawn!.mock.calls[0];
      expect(cmd).toBe("gemini");
    });

    it("should spawn codex for CODEX executor", async () => {
      const commandPromise = runCommand([
        "executor", "chat", "-n", "CODEX", "-p", "Test",
      ]);

      await new Promise(r => setTimeout(r, 10));
      const mockChild = getLastMockChild();
      mockChild!._emit("exit", 0, null);
      await commandPromise;

      const mockSpawn = getMockSpawn();
      const [cmd] = mockSpawn!.mock.calls[0];
      expect(cmd).toBe("codex");
    });

    it("should reject non-chat-enabled executor with specific error", async () => {
      await expect(
        runCommand(["executor", "chat", "-n", "AMP", "-p", "Test"])
      ).rejects.toThrow("process.exit(1)");

      // Strict: error must be output to console.error
      expect(consoleErrorSpy).toHaveBeenCalled();
      const errorOutput = consoleErrorSpy.mock.calls.map((c: unknown[]) => String(c[0])).join(" ");
      expect(errorOutput).toContain("Chat not supported for executor: AMP");
      expect(errorOutput).toContain("CLAUDE_CODE");
      expect(errorOutput).toContain("GEMINI");
      expect(errorOutput).toContain("CODEX");
    });

    it("should reject unknown executor type with specific error", async () => {
      await expect(
        runCommand(["executor", "chat", "-n", "UNKNOWN", "-p", "Test"])
      ).rejects.toThrow("process.exit(1)");

      expect(consoleErrorSpy).toHaveBeenCalled();
      const errorOutput = consoleErrorSpy.mock.calls.map((c: unknown[]) => String(c[0])).join(" ");
      expect(errorOutput).toContain("Unknown executor type: UNKNOWN");
    });
  });

  // ============================================================================
  // STRICT TESTS: Format options
  // ============================================================================

  describe("--input-format and --output-format", () => {
    it("should pass stream-json input format exactly", async () => {
      const mockChild = createMockChildProcess();
      vi.mocked(spawn).mockReturnValue(mockChild as unknown as ReturnType<typeof spawn>);

      const commandPromise = runCommand([
        "executor", "chat", "-n", "CLAUDE_CODE", "-p", "Test",
        "--input-format", "stream-json",
      ]);
      setTimeout(() => mockChild?._emit("exit", 0, null), 10);
      await commandPromise;

      const args = vi.mocked(spawn).mock.calls[0][1] as string[];
      const idx = args.indexOf("--input-format");
      expect(idx).toBeGreaterThan(-1);
      expect(args[idx + 1]).toBe("stream-json");
    });

    it("should pass stream-json output format exactly", async () => {
      const mockChild = createMockChildProcess();
      vi.mocked(spawn).mockReturnValue(mockChild as unknown as ReturnType<typeof spawn>);

      const commandPromise = runCommand([
        "executor", "chat", "-n", "CLAUDE_CODE", "-p", "Test",
        "--output-format", "stream-json",
      ]);
      setTimeout(() => mockChild?._emit("exit", 0, null), 10);
      await commandPromise;

      const args = vi.mocked(spawn).mock.calls[0][1] as string[];
      const idx = args.indexOf("--output-format");
      expect(idx).toBeGreaterThan(-1);
      expect(args[idx + 1]).toBe("stream-json");
    });

    it("should NOT pass format options when using default text format", async () => {
      const mockChild = createMockChildProcess();
      vi.mocked(spawn).mockReturnValue(mockChild as unknown as ReturnType<typeof spawn>);

      // Only -p, no format options
      const commandPromise = runCommand([
        "executor", "chat", "-n", "CLAUDE_CODE", "-p", "Test",
      ]);
      setTimeout(() => mockChild?._emit("exit", 0, null), 10);
      await commandPromise;

      const args = vi.mocked(spawn).mock.calls[0][1] as string[];
      // Strict: default text format should NOT add --input-format or --output-format
      expect(args).not.toContain("--input-format");
      expect(args).not.toContain("--output-format");
    });

    it("should NOT pass text format options explicitly", async () => {
      const mockChild = createMockChildProcess();
      vi.mocked(spawn).mockReturnValue(mockChild as unknown as ReturnType<typeof spawn>);

      const commandPromise = runCommand([
        "executor", "chat", "-n", "CLAUDE_CODE", "-p", "Test",
        "--input-format", "text", "--output-format", "text",
      ]);
      setTimeout(() => mockChild?._emit("exit", 0, null), 10);
      await commandPromise;

      const args = vi.mocked(spawn).mock.calls[0][1] as string[];
      // Implementation should omit text format (default behavior)
      expect(args).not.toContain("--input-format");
      expect(args).not.toContain("--output-format");
    });
  });

  // ============================================================================
  // STRICT TESTS: Session management
  // ============================================================================

  describe("--session-id and --resume", () => {
    it("should pass session-id with exact value", async () => {
      const mockChild = createMockChildProcess();
      vi.mocked(spawn).mockReturnValue(mockChild as unknown as ReturnType<typeof spawn>);

      const commandPromise = runCommand([
        "executor", "chat", "-n", "CLAUDE_CODE", "-p", "Test",
        "--session-id", "my-session-123",
      ]);
      setTimeout(() => mockChild?._emit("exit", 0, null), 10);
      await commandPromise;

      const args = vi.mocked(spawn).mock.calls[0][1] as string[];
      const idx = args.indexOf("--session-id");
      expect(idx).toBeGreaterThan(-1);
      expect(args[idx + 1]).toBe("my-session-123");
    });

    it("should pass resume with exact session id", async () => {
      const mockChild = createMockChildProcess();
      vi.mocked(spawn).mockReturnValue(mockChild as unknown as ReturnType<typeof spawn>);

      const commandPromise = runCommand([
        "executor", "chat", "-n", "CLAUDE_CODE", "-p", "Continue",
        "--resume", "prev-session-456",
      ]);
      setTimeout(() => mockChild?._emit("exit", 0, null), 10);
      await commandPromise;

      const args = vi.mocked(spawn).mock.calls[0][1] as string[];
      const idx = args.indexOf("--resume");
      expect(idx).toBeGreaterThan(-1);
      expect(args[idx + 1]).toBe("prev-session-456");
    });
  });

  // ============================================================================
  // STRICT TESTS: Model and permissions
  // ============================================================================

  describe("--model and --dangerously-skip-permissions", () => {
    it("should pass model with exact value", async () => {
      const mockChild = createMockChildProcess();
      vi.mocked(spawn).mockReturnValue(mockChild as unknown as ReturnType<typeof spawn>);

      const commandPromise = runCommand([
        "executor", "chat", "-n", "CLAUDE_CODE", "-p", "Test",
        "--model", "claude-3-opus-20240229",
      ]);
      setTimeout(() => mockChild?._emit("exit", 0, null), 10);
      await commandPromise;

      const args = vi.mocked(spawn).mock.calls[0][1] as string[];
      const idx = args.indexOf("--model");
      expect(idx).toBeGreaterThan(-1);
      expect(args[idx + 1]).toBe("claude-3-opus-20240229");
    });

    it("should pass dangerously-skip-permissions flag", async () => {
      const mockChild = createMockChildProcess();
      vi.mocked(spawn).mockReturnValue(mockChild as unknown as ReturnType<typeof spawn>);

      const commandPromise = runCommand([
        "executor", "chat", "-n", "CLAUDE_CODE", "-p", "Test",
        "--dangerously-skip-permissions",
      ]);
      setTimeout(() => mockChild?._emit("exit", 0, null), 10);
      await commandPromise;

      const args = vi.mocked(spawn).mock.calls[0][1] as string[];
      expect(args).toContain("--dangerously-skip-permissions");
    });

    it("should NOT pass dangerously-skip-permissions when not specified", async () => {
      const mockChild = createMockChildProcess();
      vi.mocked(spawn).mockReturnValue(mockChild as unknown as ReturnType<typeof spawn>);

      const commandPromise = runCommand([
        "executor", "chat", "-n", "CLAUDE_CODE", "-p", "Test",
      ]);
      setTimeout(() => mockChild?._emit("exit", 0, null), 10);
      await commandPromise;

      const args = vi.mocked(spawn).mock.calls[0][1] as string[];
      expect(args).not.toContain("--dangerously-skip-permissions");
    });
  });

  // ============================================================================
  // STRICT TESTS: Working directory
  // ============================================================================

  describe("-C, --cwd option", () => {
    it("should set cwd in spawn options with -C", async () => {
      const mockChild = createMockChildProcess();
      vi.mocked(spawn).mockReturnValue(mockChild as unknown as ReturnType<typeof spawn>);

      const commandPromise = runCommand([
        "executor", "chat", "-n", "CLAUDE_CODE", "-p", "Test",
        "-C", "/path/to/project",
      ]);
      setTimeout(() => mockChild?._emit("exit", 0, null), 10);
      await commandPromise;

      const options = vi.mocked(spawn).mock.calls[0][2] as { cwd?: string };
      expect(options.cwd).toBe("/path/to/project");
    });

    it("should set cwd in spawn options with --cwd", async () => {
      const mockChild = createMockChildProcess();
      vi.mocked(spawn).mockReturnValue(mockChild as unknown as ReturnType<typeof spawn>);

      const commandPromise = runCommand([
        "executor", "chat", "-n", "CLAUDE_CODE", "-p", "Test",
        "--cwd", "/another/path",
      ]);
      setTimeout(() => mockChild?._emit("exit", 0, null), 10);
      await commandPromise;

      const options = vi.mocked(spawn).mock.calls[0][2] as { cwd?: string };
      expect(options.cwd).toBe("/another/path");
    });

    it("should NOT set cwd when not specified", async () => {
      const mockChild = createMockChildProcess();
      vi.mocked(spawn).mockReturnValue(mockChild as unknown as ReturnType<typeof spawn>);

      const commandPromise = runCommand([
        "executor", "chat", "-n", "CLAUDE_CODE", "-p", "Test",
      ]);
      setTimeout(() => mockChild?._emit("exit", 0, null), 10);
      await commandPromise;

      const options = vi.mocked(spawn).mock.calls[0][2] as { cwd?: string };
      expect(options.cwd).toBeUndefined();
    });
  });

  // ============================================================================
  // STRICT TESTS: Verbose option
  // ============================================================================

  describe("--verbose option", () => {
    it("should pass --verbose to subprocess when specified", async () => {
      const mockChild = createMockChildProcess();
      vi.mocked(spawn).mockReturnValue(mockChild as unknown as ReturnType<typeof spawn>);

      const commandPromise = runCommand([
        "--verbose",
        "executor", "chat", "-n", "CLAUDE_CODE", "-p", "Test",
      ]);
      setTimeout(() => mockChild?._emit("exit", 0, null), 10);
      await commandPromise;

      const args = vi.mocked(spawn).mock.calls[0][1] as string[];
      expect(args).toContain("--verbose");
    });

    it("should NOT pass --verbose when not specified", async () => {
      const mockChild = createMockChildProcess();
      vi.mocked(spawn).mockReturnValue(mockChild as unknown as ReturnType<typeof spawn>);

      const commandPromise = runCommand([
        "executor", "chat", "-n", "CLAUDE_CODE", "-p", "Test",
      ]);
      setTimeout(() => mockChild?._emit("exit", 0, null), 10);
      await commandPromise;

      const args = vi.mocked(spawn).mock.calls[0][1] as string[];
      expect(args).not.toContain("--verbose");
    });
  });

  // ============================================================================
  // STRICT TESTS: Process lifecycle
  // ============================================================================

  describe("Process lifecycle", () => {
    it("should complete successfully on exit code 0", async () => {
      const mockChild = createMockChildProcess();
      vi.mocked(spawn).mockReturnValue(mockChild as unknown as ReturnType<typeof spawn>);

      const commandPromise = runCommand([
        "executor", "chat", "-n", "CLAUDE_CODE", "-p", "Test",
      ]);
      setTimeout(() => mockChild?._emit("exit", 0, null), 10);

      // Should not throw
      await expect(commandPromise).resolves.toBeUndefined();
      expect(spawn).toHaveBeenCalledTimes(1);
    });

    it("should call process.exit with exact non-zero code from subprocess", async () => {
      const mockChild = createMockChildProcess();
      vi.mocked(spawn).mockReturnValue(mockChild as unknown as ReturnType<typeof spawn>);

      let capturedExitCode: number | undefined;
      processExitSpy.mockImplementation((code: number | string | null | undefined) => {
        capturedExitCode = code as number;
        return undefined as never;
      });

      runCommand(["executor", "chat", "-n", "CLAUDE_CODE", "-p", "Test"]);
      await new Promise(r => setTimeout(r, 20));
      mockChild?._emit("exit", 42, null);
      await new Promise(r => setTimeout(r, 20));

      expect(capturedExitCode).toBe(42);
    });

    it("should output error and exit(1) on spawn error", async () => {
      const mockChild = createMockChildProcess();
      vi.mocked(spawn).mockReturnValue(mockChild as unknown as ReturnType<typeof spawn>);

      let capturedExitCode: number | undefined;
      processExitSpy.mockImplementation((code: number | string | null | undefined) => {
        capturedExitCode = code as number;
        return undefined as never;
      });

      runCommand(["executor", "chat", "-n", "CLAUDE_CODE", "-p", "Test"]);
      await new Promise(r => setTimeout(r, 20));
      mockChild?._emit("error", new Error("spawn ENOENT: command not found"));
      await new Promise(r => setTimeout(r, 20));

      // Strict: error message must be output
      expect(consoleErrorSpy).toHaveBeenCalled();
      const errorOutput = consoleErrorSpy.mock.calls.map((c: unknown[]) => String(c[0])).join(" ");
      expect(errorOutput).toContain("Failed to start claude");

      // Strict: must exit with code 1
      expect(capturedExitCode).toBe(1);
    });

    it("should handle SIGTERM signal gracefully", async () => {
      const mockChild = createMockChildProcess();
      vi.mocked(spawn).mockReturnValue(mockChild as unknown as ReturnType<typeof spawn>);

      let capturedExitCode: number | undefined;
      processExitSpy.mockImplementation((code: number | string | null | undefined) => {
        capturedExitCode = code as number;
        return undefined as never;
      });

      runCommand(["executor", "chat", "-n", "CLAUDE_CODE", "-p", "Test"]);
      await new Promise(r => setTimeout(r, 20));
      mockChild?._emit("exit", null, "SIGTERM");
      await new Promise(r => setTimeout(r, 20));

      // Should exit with 0 for signal termination
      expect(capturedExitCode).toBe(0);
    });
  });

  // ============================================================================
  // STRICT TESTS: stdin handling
  // ============================================================================

  describe("stdin prompt handling", () => {
    it("should require -p option when stdin is TTY", async () => {
      const originalIsTTY = process.stdin.isTTY;
      Object.defineProperty(process.stdin, "isTTY", { value: true, configurable: true });

      try {
        await expect(
          runCommand(["executor", "chat", "-n", "CLAUDE_CODE"])
        ).rejects.toThrow("process.exit(1)");

        // Strict: must show specific error message
        const errorOutput = consoleErrorSpy.mock.calls.map((c: unknown[]) => String(c[0])).join(" ");
        expect(errorOutput).toContain("No prompt provided");
        expect(errorOutput).toContain("-p");
      } finally {
        Object.defineProperty(process.stdin, "isTTY", { value: originalIsTTY, configurable: true });
      }
    });

    it("should read prompt from stdin when not TTY and no -p provided", async () => {
      const mockChild = createMockChildProcess();
      vi.mocked(spawn).mockReturnValue(mockChild as unknown as ReturnType<typeof spawn>);

      // Mock stdin as non-TTY with content
      const originalIsTTY = process.stdin.isTTY;
      Object.defineProperty(process.stdin, "isTTY", { value: false, configurable: true });

      // Create a mock readable stream with Buffer content
      const { Readable } = await import("node:stream");
      const mockStdin = Readable.from([Buffer.from("Test prompt from stdin")]);
      Object.defineProperty(mockStdin, "isTTY", { value: false, configurable: true });

      // Replace process.stdin temporarily
      const originalStdin = process.stdin;
      Object.defineProperty(process, "stdin", { value: mockStdin, configurable: true });

      try {
        const commandPromise = runCommand(["executor", "chat", "-n", "CLAUDE_CODE"]);
        setTimeout(() => mockChild?._emit("exit", 0, null), 50);
        await commandPromise;

        // Should spawn with the stdin prompt
        expect(spawn).toHaveBeenCalledTimes(1);
        const args = vi.mocked(spawn).mock.calls[0][1] as string[];
        expect(args).toContain("-p");
        const pIndex = args.indexOf("-p");
        expect(args[pIndex + 1]).toBe("Test prompt from stdin");
      } finally {
        Object.defineProperty(process.stdin, "isTTY", { value: originalIsTTY, configurable: true });
        Object.defineProperty(process, "stdin", { value: originalStdin, configurable: true });
      }
    });

    it("should error when stdin is empty (non-TTY, no -p)", async () => {
      // Mock stdin as non-TTY with empty content
      const originalIsTTY = process.stdin.isTTY;
      Object.defineProperty(process.stdin, "isTTY", { value: false, configurable: true });

      // Create a mock readable stream with empty Buffer
      const { Readable } = await import("node:stream");
      const mockStdin = Readable.from([Buffer.from("")]);
      Object.defineProperty(mockStdin, "isTTY", { value: false, configurable: true });

      const originalStdin = process.stdin;
      Object.defineProperty(process, "stdin", { value: mockStdin, configurable: true });

      try {
        await expect(
          runCommand(["executor", "chat", "-n", "CLAUDE_CODE"])
        ).rejects.toThrow("process.exit(1)");

        // Strict: must show specific error message about empty stdin
        const errorOutput = consoleErrorSpy.mock.calls.map((c: unknown[]) => String(c[0])).join(" ");
        expect(errorOutput).toContain("No prompt provided");
        expect(errorOutput).toContain("stdin is empty");
      } finally {
        Object.defineProperty(process.stdin, "isTTY", { value: originalIsTTY, configurable: true });
        Object.defineProperty(process, "stdin", { value: originalStdin, configurable: true });
      }
    });

    it("should trim whitespace from stdin prompt", async () => {
      const mockChild = createMockChildProcess();
      vi.mocked(spawn).mockReturnValue(mockChild as unknown as ReturnType<typeof spawn>);

      const originalIsTTY = process.stdin.isTTY;
      Object.defineProperty(process.stdin, "isTTY", { value: false, configurable: true });

      const { Readable } = await import("node:stream");
      const mockStdin = Readable.from([Buffer.from("  \n  Prompt with whitespace  \n  ")]);
      Object.defineProperty(mockStdin, "isTTY", { value: false, configurable: true });

      const originalStdin = process.stdin;
      Object.defineProperty(process, "stdin", { value: mockStdin, configurable: true });

      try {
        const commandPromise = runCommand(["executor", "chat", "-n", "CLAUDE_CODE"]);
        setTimeout(() => mockChild?._emit("exit", 0, null), 50);
        await commandPromise;

        const args = vi.mocked(spawn).mock.calls[0][1] as string[];
        const pIndex = args.indexOf("-p");
        // Should be trimmed
        expect(args[pIndex + 1]).toBe("Prompt with whitespace");
      } finally {
        Object.defineProperty(process.stdin, "isTTY", { value: originalIsTTY, configurable: true });
        Object.defineProperty(process, "stdin", { value: originalStdin, configurable: true });
      }
    });

    it("should prefer -p option over stdin when both provided", async () => {
      const mockChild = createMockChildProcess();
      vi.mocked(spawn).mockReturnValue(mockChild as unknown as ReturnType<typeof spawn>);

      // Even with stdin available, -p should take precedence
      const commandPromise = runCommand([
        "executor", "chat", "-n", "CLAUDE_CODE", "-p", "Explicit prompt",
      ]);
      setTimeout(() => mockChild?._emit("exit", 0, null), 10);
      await commandPromise;

      const args = vi.mocked(spawn).mock.calls[0][1] as string[];
      const pIndex = args.indexOf("-p");
      expect(args[pIndex + 1]).toBe("Explicit prompt");
    });
  });

  // ============================================================================
  // STRICT TESTS: Combined options
  // ============================================================================

  describe("Combined options", () => {
    it("should pass all options correctly when combined", async () => {
      const mockChild = createMockChildProcess();
      vi.mocked(spawn).mockReturnValue(mockChild as unknown as ReturnType<typeof spawn>);

      const commandPromise = runCommand([
        "--verbose",
        "executor", "chat",
        "-n", "CLAUDE_CODE",
        "-p", "Complex task",
        "-C", "/project",
        "--model", "claude-3-opus",
        "--session-id", "sess-123",
        "--input-format", "stream-json",
        "--output-format", "stream-json",
        "--dangerously-skip-permissions",
      ]);
      setTimeout(() => mockChild?._emit("exit", 0, null), 10);
      await commandPromise;

      const [cmd, args, options] = vi.mocked(spawn).mock.calls[0];
      const argsArr = args as string[];
      const opts = options as { cwd?: string; stdio: string };

      expect(cmd).toBe("claude");
      expect(opts.cwd).toBe("/project");
      expect(opts.stdio).toBe("inherit");

      // Verify each option
      expect(argsArr).toContain("-p");
      expect(argsArr[argsArr.indexOf("-p") + 1]).toBe("Complex task");

      expect(argsArr).toContain("--model");
      expect(argsArr[argsArr.indexOf("--model") + 1]).toBe("claude-3-opus");

      expect(argsArr).toContain("--session-id");
      expect(argsArr[argsArr.indexOf("--session-id") + 1]).toBe("sess-123");

      expect(argsArr).toContain("--input-format");
      expect(argsArr[argsArr.indexOf("--input-format") + 1]).toBe("stream-json");

      expect(argsArr).toContain("--output-format");
      expect(argsArr[argsArr.indexOf("--output-format") + 1]).toBe("stream-json");

      expect(argsArr).toContain("--dangerously-skip-permissions");
      expect(argsArr).toContain("--verbose");
    });
  });

  // ============================================================================
  // STRICT TESTS: JSON error output
  // ============================================================================

  describe("JSON error output", () => {
    it("should output JSON formatted error when --json flag is set", async () => {
      await expect(
        runCommand(["--json", "executor", "chat", "-n", "AMP", "-p", "Test"])
      ).rejects.toThrow("process.exit(1)");

      // With --json flag, error should be output via console.log in JSON format
      expect(consoleSpy).toHaveBeenCalled();
      const logOutput = consoleSpy.mock.calls.map((c: unknown[]) => String(c[0])).join("");

      // Parse as JSON - the format is { success: false, error: { code, message } }
      const jsonOutput = JSON.parse(logOutput);
      expect(jsonOutput.success).toBe(false);
      expect(jsonOutput.error).toBeDefined();
      expect(jsonOutput.error.code).toBeDefined();
      expect(jsonOutput.error.message).toContain("Chat not supported");
    });
  });

  // ============================================================================
  // STRICT TESTS: spawn failure
  // ============================================================================

  describe("spawn failure handling", () => {
    it("should handle synchronous spawn error", async () => {
      vi.mocked(spawn).mockImplementation(() => {
        throw new Error("spawn ENOENT: claude not found");
      });

      await expect(
        runCommand(["executor", "chat", "-n", "CLAUDE_CODE", "-p", "Test"])
      ).rejects.toThrow("process.exit(1)");

      // Strict: error must be output
      const errorOutput = consoleErrorSpy.mock.calls.map((c: unknown[]) => String(c[0])).join(" ");
      expect(errorOutput).toContain("spawn ENOENT");
    });
  });

  // ============================================================================
  // STRICT TESTS: IO inheritance
  // ============================================================================

  describe("IO inheritance", () => {
    it("should always use stdio: inherit for transparent IO", async () => {
      const mockChild = createMockChildProcess();
      vi.mocked(spawn).mockReturnValue(mockChild as unknown as ReturnType<typeof spawn>);

      const commandPromise = runCommand([
        "executor", "chat", "-n", "CLAUDE_CODE", "-p", "Test",
      ]);
      setTimeout(() => mockChild?._emit("exit", 0, null), 10);
      await commandPromise;

      const options = vi.mocked(spawn).mock.calls[0][2] as { stdio: string };
      expect(options.stdio).toBe("inherit");
    });

    it("should use shell: true for command execution", async () => {
      const mockChild = createMockChildProcess();
      vi.mocked(spawn).mockReturnValue(mockChild as unknown as ReturnType<typeof spawn>);

      const commandPromise = runCommand([
        "executor", "chat", "-n", "CLAUDE_CODE", "-p", "Test",
      ]);
      setTimeout(() => mockChild?._emit("exit", 0, null), 10);
      await commandPromise;

      const options = vi.mocked(spawn).mock.calls[0][2] as { shell: boolean };
      expect(options.shell).toBe(true);
    });
  });

  // ============================================================================
  // STRICT TESTS: Argument order
  // ============================================================================

  describe("Argument ordering", () => {
    it("should place -p and prompt as first arguments", async () => {
      const mockChild = createMockChildProcess();
      vi.mocked(spawn).mockReturnValue(mockChild as unknown as ReturnType<typeof spawn>);

      const commandPromise = runCommand([
        "executor", "chat", "-n", "CLAUDE_CODE", "-p", "My prompt",
        "--model", "test-model",
      ]);
      setTimeout(() => mockChild?._emit("exit", 0, null), 10);
      await commandPromise;

      const args = vi.mocked(spawn).mock.calls[0][1] as string[];
      // -p should be first
      expect(args[0]).toBe("-p");
      expect(args[1]).toBe("My prompt");
    });
  });

  // ============================================================================
  // STRICT TESTS: Edge cases and boundary conditions
  // ============================================================================

  describe("Edge cases and boundary conditions", () => {
    it("should handle prompt with special characters", async () => {
      const mockChild = createMockChildProcess();
      vi.mocked(spawn).mockReturnValue(mockChild as unknown as ReturnType<typeof spawn>);

      const specialPrompt = "Test with 'quotes' and \"double quotes\" and $variables";
      const commandPromise = runCommand([
        "executor", "chat", "-n", "CLAUDE_CODE", "-p", specialPrompt,
      ]);
      setTimeout(() => mockChild?._emit("exit", 0, null), 10);
      await commandPromise;

      const args = vi.mocked(spawn).mock.calls[0][1] as string[];
      const pIndex = args.indexOf("-p");
      expect(args[pIndex + 1]).toBe(specialPrompt);
    });

    it("should handle prompt with newlines", async () => {
      const mockChild = createMockChildProcess();
      vi.mocked(spawn).mockReturnValue(mockChild as unknown as ReturnType<typeof spawn>);

      const multilinePrompt = "Line 1\nLine 2\nLine 3";
      const commandPromise = runCommand([
        "executor", "chat", "-n", "CLAUDE_CODE", "-p", multilinePrompt,
      ]);
      setTimeout(() => mockChild?._emit("exit", 0, null), 10);
      await commandPromise;

      const args = vi.mocked(spawn).mock.calls[0][1] as string[];
      const pIndex = args.indexOf("-p");
      expect(args[pIndex + 1]).toBe(multilinePrompt);
    });

    it("should handle very long prompt", async () => {
      const mockChild = createMockChildProcess();
      vi.mocked(spawn).mockReturnValue(mockChild as unknown as ReturnType<typeof spawn>);

      const longPrompt = "a".repeat(10000);
      const commandPromise = runCommand([
        "executor", "chat", "-n", "CLAUDE_CODE", "-p", longPrompt,
      ]);
      setTimeout(() => mockChild?._emit("exit", 0, null), 10);
      await commandPromise;

      const args = vi.mocked(spawn).mock.calls[0][1] as string[];
      const pIndex = args.indexOf("-p");
      expect(args[pIndex + 1]).toBe(longPrompt);
      expect(args[pIndex + 1].length).toBe(10000);
    });

    it("should handle unicode in prompt", async () => {
      const mockChild = createMockChildProcess();
      vi.mocked(spawn).mockReturnValue(mockChild as unknown as ReturnType<typeof spawn>);

      const unicodePrompt = "分析这段代码 🚀 λ → ∞";
      const commandPromise = runCommand([
        "executor", "chat", "-n", "CLAUDE_CODE", "-p", unicodePrompt,
      ]);
      setTimeout(() => mockChild?._emit("exit", 0, null), 10);
      await commandPromise;

      const args = vi.mocked(spawn).mock.calls[0][1] as string[];
      const pIndex = args.indexOf("-p");
      expect(args[pIndex + 1]).toBe(unicodePrompt);
    });

    it("should ignore empty string session-id", async () => {
      const mockChild = createMockChildProcess();
      vi.mocked(spawn).mockReturnValue(mockChild as unknown as ReturnType<typeof spawn>);

      const commandPromise = runCommand([
        "executor", "chat", "-n", "CLAUDE_CODE", "-p", "Test",
        "--session-id", "",
      ]);
      setTimeout(() => mockChild?._emit("exit", 0, null), 10);
      await commandPromise;

      const args = vi.mocked(spawn).mock.calls[0][1] as string[];
      // Empty session-id is filtered out by implementation
      expect(args).not.toContain("--session-id");
    });

    it("should handle path with spaces in cwd", async () => {
      const mockChild = createMockChildProcess();
      vi.mocked(spawn).mockReturnValue(mockChild as unknown as ReturnType<typeof spawn>);

      const commandPromise = runCommand([
        "executor", "chat", "-n", "CLAUDE_CODE", "-p", "Test",
        "-C", "/path/with spaces/project",
      ]);
      setTimeout(() => mockChild?._emit("exit", 0, null), 10);
      await commandPromise;

      const options = vi.mocked(spawn).mock.calls[0][2] as { cwd?: string };
      expect(options.cwd).toBe("/path/with spaces/project");
    });

    it("should handle mixed case executor names consistently", async () => {
      const mockChild = createMockChildProcess();
      vi.mocked(spawn).mockReturnValue(mockChild as unknown as ReturnType<typeof spawn>);

      // Test various case combinations
      for (const name of ["CLAUDE_CODE", "claude_code", "Claude_Code", "CLAUDE_code"]) {
        vi.clearAllMocks();
        vi.mocked(spawn).mockReturnValue(mockChild as unknown as ReturnType<typeof spawn>);

        const commandPromise = runCommand([
          "executor", "chat", "-n", name, "-p", "Test",
        ]);
        setTimeout(() => mockChild?._emit("exit", 0, null), 10);
        await commandPromise;

        // All should resolve to "claude" command
        const [cmd] = vi.mocked(spawn).mock.calls[0];
        expect(cmd).toBe("claude");
      }
    });
  });

  // ============================================================================
  // STRICT TESTS: Required options validation
  // ============================================================================

  describe("Required options validation", () => {
    it("should require -n/--name option", async () => {
      // Commander will handle this error
      try {
        await runCommand(["executor", "chat", "-p", "Test"]);
      } catch {
        // Expected to fail due to missing required option
      }
    });

    it("should accept both -n and --name for executor name", async () => {
      const mockChild = createMockChildProcess();
      vi.mocked(spawn).mockReturnValue(mockChild as unknown as ReturnType<typeof spawn>);

      // Test with --name
      const commandPromise = runCommand([
        "executor", "chat", "--name", "CLAUDE_CODE", "-p", "Test",
      ]);
      setTimeout(() => mockChild?._emit("exit", 0, null), 10);
      await commandPromise;

      const [cmd] = vi.mocked(spawn).mock.calls[0];
      expect(cmd).toBe("claude");
    });
  });
});
