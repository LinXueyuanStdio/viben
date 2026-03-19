/**
 * Swarm CLI Commands Tests
 *
 * Tests for the swarm command implementation:
 * - swarm list - List all worktrees and agents
 * - swarm start <task> - Start agent in worktree
 * - swarm stop <task> - Stop running agent
 * - swarm status - Show agent status
 * - swarm registry - Show agent registry
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Command } from "commander";

// Mock child_process
const mockSpawn = vi.fn();
const mockExecSync = vi.fn();

vi.mock("node:child_process", () => ({
  spawn: (...args: unknown[]) => mockSpawn(...args),
  execSync: (...args: unknown[]) => mockExecSync(...args),
}));

// Mock fs
const mockExistsSync = vi.fn();
const mockReadFileSync = vi.fn();
const mockWriteFileSync = vi.fn();
const mockReaddirSync = vi.fn();

vi.mock("node:fs", () => ({
  existsSync: (...args: unknown[]) => mockExistsSync(...args),
  readFileSync: (...args: unknown[]) => mockReadFileSync(...args),
  writeFileSync: (...args: unknown[]) => mockWriteFileSync(...args),
  readdirSync: (...args: unknown[]) => mockReaddirSync(...args),
}));

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

// Import after mocking
import { registerSwarmCommand } from "./swarm";

// Test timeout constant for async operations
const ASYNC_TICK_MS = 10;

describe("Swarm CLI Commands", () => {
  let program: Command;
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let originalProcessKill: typeof process.kill;

  beforeEach(() => {
    // Save original process.kill for restoration
    originalProcessKill = process.kill;

    // Create fresh program instance
    program = new Command();
    program.option("--json", "Output in JSON format");
    program.option("--verbose", "Verbose output");
    program.option("--quiet", "Quiet mode");

    // Register swarm commands
    registerSwarmCommand(program);

    // Spy on console
    consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    // Reset mocks
    mockExistsSync.mockReset();
    mockReadFileSync.mockReset();
    mockWriteFileSync.mockReset();
    mockReaddirSync.mockReset();
    mockSpawn.mockReset();
    mockExecSync.mockReset();

    // Default: not in a viben workspace
    mockExistsSync.mockReturnValue(false);
    // Default: empty directory listing
    mockReaddirSync.mockReturnValue([]);
  });

  afterEach(() => {
    // Restore original process.kill
    process.kill = originalProcessKill;
    consoleSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    vi.clearAllMocks();
  });

  // ============================================================================
  // Helper to run command
  // ============================================================================
  async function runCommand(args: string[]): Promise<void> {
    // Prevent process.exit from actually exiting
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });

    try {
      await program.parseAsync(["node", "test", ...args]);
    } catch (e) {
      // Ignore process.exit calls
      if (!(e instanceof Error && e.message === "process.exit called")) {
        throw e;
      }
    } finally {
      exitSpy.mockRestore();
    }
  }

  // ============================================================================
  // Helper to setup viben workspace mock
  // ============================================================================
  function setupVibenWorkspace(cwdPath: string = "/test/project") {
    mockExistsSync.mockImplementation((path: string) => {
      if (path === `${cwdPath}/.viben`) return true;
      return false;
    });

    // Mock process.cwd
    vi.spyOn(process, "cwd").mockReturnValue(cwdPath);
  }

  // ============================================================================
  // Command Registration Tests
  // ============================================================================

  describe("command registration", () => {
    it("should register swarm command", () => {
      const commands = program.commands.map((cmd) => cmd.name());
      expect(commands).toContain("swarm");
    });

    it("should register all subcommands", () => {
      const swarmCmd = program.commands.find((cmd) => cmd.name() === "swarm");
      expect(swarmCmd).toBeDefined();

      const subcommands = swarmCmd!.commands.map((cmd) => cmd.name());
      expect(subcommands).toContain("list");
      expect(subcommands).toContain("start");
      expect(subcommands).toContain("stop");
      expect(subcommands).toContain("status");
      expect(subcommands).toContain("registry");
      expect(subcommands).toContain("wait");
    });
  });

  // ============================================================================
  // Workspace Detection Tests
  // ============================================================================

  describe("workspace detection", () => {
    it("should fail when not in a viben workspace", async () => {
      mockExistsSync.mockReturnValue(false);

      await runCommand(["swarm", "list"]);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Not in a Viben workspace")
      );
    });
  });

  // ============================================================================
  // swarm list Tests
  // ============================================================================

  describe("swarm list", () => {
    it("should list worktrees and agents using TypeScript implementation", async () => {
      setupVibenWorkspace();
      mockExistsSync.mockImplementation((path: string) => {
        if (path === "/test/project/.viben") return true;
        if (path.includes(".developer")) return true;
        if (path.includes("registry.json")) return true;
        return false;
      });

      mockReadFileSync.mockImplementation((path: string) => {
        if (path.includes(".developer")) return "name=test-user";
        if (path.includes("registry.json")) {
          return JSON.stringify({ agents: [] });
        }
        return "";
      });

      // Mock execSync for git worktree list
      mockExecSync.mockReturnValue("");

      await runCommand(["swarm", "list"]);

      // The TypeScript implementation uses listWorktrees() and readRegistry() directly
      // It doesn't call python3 anymore
      expect(mockSpawn).not.toHaveBeenCalled();
      // Verify output contains expected headers or list information
      const output = consoleSpy.mock.calls.flat().join(" ");
      expect(output).toMatch(/Worktree|Agent|Task|No worktrees/i);
    });
  });

  // ============================================================================
  // swarm start Tests
  // ============================================================================

  describe("swarm start <task>", () => {
    it("should fail when task not found", async () => {
      setupVibenWorkspace();
      mockExistsSync.mockImplementation((path: string) => {
        if (path === "/test/project/.viben") return true;
        if (path.includes(".viben/tasks/")) return false;
        return false;
      });
      mockExecSync.mockReturnValue("");

      await runCommand(["swarm", "start", "nonexistent-task"]);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Task not found")
      );
    });

    it("should start agent when task exists", async () => {
      setupVibenWorkspace();
      mockExistsSync.mockImplementation((path: string) => {
        if (path === "/test/project/.viben") return true;
        if (path === "/test/project/.viben/tasks") return true;
        if (path === "/test/project/.viben/tasks/my-task") return true;
        if (path.includes(".developer")) return true;
        if (path.includes("registry.json")) return true;
        return false;
      });

      mockReadFileSync.mockImplementation((path: string) => {
        if (path.includes(".developer")) return "name=test-user";
        if (path.includes("registry.json")) {
          return JSON.stringify({ agents: [] });
        }
        return "";
      });

      // Mock execSync for git commands (worktree creation)
      mockExecSync.mockReturnValue("");

      // Mock spawn for the agent process itself with proper typing
      const mockProcess = {
        on: vi.fn((event: string, handler: (code: number) => void) => {
          if (event === "close") {
            setTimeout(() => handler(0), ASYNC_TICK_MS);
          }
          return mockProcess;
        }),
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        pid: 12345,
        unref: vi.fn(),
      };
      mockSpawn.mockReturnValue(mockProcess);

      await runCommand(["swarm", "start", "my-task"]);

      // The TypeScript implementation uses startAgent() which does spawn the agent process
      // but with the CLI adapter's spawn() function, not python3
      // It spawns the agent (e.g., "claude" CLI) not python
      // The exact call depends on the platform/executor being used
      // Verify output indicates agent start attempt
      const output = consoleSpy.mock.calls.flat().join(" ");
      expect(output).toMatch(/Start|Agent|my-task|worktree/i);
    });
  });

  // ============================================================================
  // swarm stop Tests
  // ============================================================================

  describe("swarm stop", () => {
    it("should show error when no task specified and no --all flag", async () => {
      setupVibenWorkspace();
      mockExistsSync.mockImplementation((path: string) => {
        if (path === "/test/project/.viben") return true;
        if (path.includes(".developer")) return true;
        return false;
      });
      mockReadFileSync.mockImplementation((path: string) => {
        if (path.includes(".developer")) return "name=test-user";
        return "";
      });

      await runCommand(["swarm", "stop"]);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Task name is required")
      );
    });

    it("should show error when agent not found", async () => {
      setupVibenWorkspace();
      mockExistsSync.mockImplementation((path: string) => {
        if (path === "/test/project/.viben") return true;
        if (path.includes(".developer")) return true;
        if (path.includes("registry.json")) return true;
        return false;
      });
      mockReadFileSync.mockImplementation((path: string) => {
        if (path.includes(".developer")) return "name=test-user";
        if (path.includes("registry.json")) {
          return JSON.stringify({ agents: [] });
        }
        return "";
      });

      await runCommand(["swarm", "stop", "nonexistent"]);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Agent not found")
      );
    });

    it("should attempt to stop agent by task name", async () => {
      setupVibenWorkspace();
      mockExistsSync.mockImplementation((path: string) => {
        if (path === "/test/project/.viben") return true;
        if (path.includes(".developer")) return true;
        if (path.includes("registry.json")) return true;
        return false;
      });

      mockReadFileSync.mockImplementation((path: string) => {
        if (path.includes(".developer")) return "name=test-user";
        if (path.includes("registry.json")) {
          return JSON.stringify({
            agents: [
              {
                id: "my-task",
                worktree_path: "/test/worktrees/feature/my-task",
                pid: 12345,
                task_dir: ".viben/tasks/my-task",
                started_at: "2024-01-01T00:00:00",
                platform: "claude",
              },
            ],
          });
        }
        return "";
      });

      // Mock process.kill safely - track calls while allowing normal behavior
      const killCalls: Array<{ pid: number; signal?: string | number }> = [];
      process.kill = ((pid: number, signal?: string | number) => {
        killCalls.push({ pid, signal });
        // Return true to indicate process was signaled
        return true;
      }) as typeof process.kill;

      await runCommand(["swarm", "stop", "my-task"]);

      // Should call kill at least once (either for check or for stop)
      expect(killCalls.length).toBeGreaterThan(0);
      expect(killCalls.some(call => call.pid === 12345)).toBe(true);
    });

    it("should use SIGKILL with --force flag", async () => {
      setupVibenWorkspace();
      mockExistsSync.mockImplementation((path: string) => {
        if (path === "/test/project/.viben") return true;
        if (path.includes(".developer")) return true;
        if (path.includes("registry.json")) return true;
        return false;
      });

      mockReadFileSync.mockImplementation((path: string) => {
        if (path.includes(".developer")) return "name=test-user";
        if (path.includes("registry.json")) {
          return JSON.stringify({
            agents: [
              {
                id: "my-task",
                worktree_path: "/test/worktrees/feature/my-task",
                pid: 12345,
                task_dir: ".viben/tasks/my-task",
                started_at: "2024-01-01T00:00:00",
                platform: "claude",
              },
            ],
          });
        }
        return "";
      });

      // Mock process.kill safely - track calls with signal type
      const killCalls: Array<{ pid: number; signal?: string | number }> = [];
      process.kill = ((pid: number, signal?: string | number) => {
        killCalls.push({ pid, signal });
        return true;
      }) as typeof process.kill;

      await runCommand(["swarm", "stop", "my-task", "--force"]);

      // Should be called with SIGKILL
      const sigkillCall = killCalls.find(call => call.signal === "SIGKILL");
      expect(sigkillCall).toBeDefined();
      expect(sigkillCall?.pid).toBe(12345);
    });
  });

  // ============================================================================
  // swarm status Tests
  // ============================================================================

  describe("swarm status", () => {
    it("should display status summary using TypeScript implementation", async () => {
      setupVibenWorkspace();
      mockExistsSync.mockImplementation((path: string) => {
        if (path === "/test/project/.viben") return true;
        if (path.includes(".developer")) return true;
        if (path.includes("registry.json")) return true;
        return false;
      });

      mockReadFileSync.mockImplementation((path: string) => {
        if (path.includes(".developer")) return "name=test-user";
        if (path.includes("registry.json")) {
          return JSON.stringify({ agents: [] });
        }
        return "";
      });

      await runCommand(["swarm", "status"]);

      // The TypeScript implementation doesn't use spawn for status
      // It uses getAllAgentStatuses() which reads registry directly
      expect(mockSpawn).not.toHaveBeenCalled();
      // Verify output contains status-related information
      const output = consoleSpy.mock.calls.flat().join(" ");
      expect(output).toMatch(/Status|Agent|Running|No agents|empty/i);
    });

    it("should show detailed status for specific task", async () => {
      setupVibenWorkspace();
      mockExistsSync.mockImplementation((path: string) => {
        if (path === "/test/project/.viben") return true;
        if (path.includes(".developer")) return true;
        if (path.includes("registry.json")) return true;
        if (path.includes("worktrees")) return true;
        return false;
      });

      mockReadFileSync.mockImplementation((path: string) => {
        if (path.includes(".developer")) return "name=test-user";
        if (path.includes("registry.json")) {
          return JSON.stringify({
            agents: [{
              id: "my-task",
              worktree_path: "/test/worktrees/feature/my-task",
              pid: 12345,
              task_dir: ".viben/tasks/my-task",
              started_at: "2024-01-01T00:00:00",
              platform: "claude",
            }],
          });
        }
        return "";
      });

      await runCommand(["swarm", "status", "my-task", "--detail"]);

      // The TypeScript implementation uses findAgentStatus() directly
      expect(mockSpawn).not.toHaveBeenCalled();
    });

    it("should accept --watch flag for live monitoring", async () => {
      setupVibenWorkspace();
      mockExistsSync.mockImplementation((path: string) => {
        if (path === "/test/project/.viben") return true;
        if (path.includes(".developer")) return true;
        if (path.includes("registry.json")) return true;
        if (path.includes("worktrees")) return true;
        if (path.includes("agent.log")) return true;
        return false;
      });

      mockReadFileSync.mockImplementation((path: string) => {
        if (path.includes(".developer")) return "name=test-user";
        if (path.includes("registry.json")) {
          return JSON.stringify({
            agents: [{
              id: "my-task",
              worktree_path: "/test/worktrees/feature/my-task",
              pid: 12345,
              task_dir: ".viben/tasks/my-task",
              started_at: "2024-01-01T00:00:00",
              platform: "claude",
            }],
          });
        }
        return "";
      });

      // Watch mode starts a long-running process (tailFollowConsole).
      // We test that the command is recognized and starts without error.
      // Use Promise.race with a timeout to prevent blocking.
      const timeoutPromise = new Promise<"timeout">((resolve) =>
        setTimeout(() => resolve("timeout"), 100)
      );

      const result = await Promise.race([
        runCommand(["swarm", "status", "my-task", "--watch"]).then(() => "completed" as const),
        timeoutPromise,
      ]);

      // Either completed quickly (no agent found) or timed out (watching started)
      // Both are acceptable - the key is no unhandled error was thrown
      expect(["completed", "timeout"]).toContain(result);
      // The TypeScript implementation uses tailFollowConsole() directly, not spawn
      expect(mockSpawn).not.toHaveBeenCalled();
    });

    it("should output JSON when --json flag is provided", async () => {
      setupVibenWorkspace();
      mockExistsSync.mockImplementation((path: string) => {
        if (path === "/test/project/.viben") return true;
        if (path.includes("status.py")) return true;
        if (path.includes(".developer")) return true;
        if (path.includes("registry.json")) return true;
        return false;
      });

      mockReadFileSync.mockImplementation((path: string) => {
        if (path.includes(".developer")) return "name=test-user";
        if (path.includes("registry.json")) {
          return JSON.stringify({
            agents: [
              {
                id: "my-task",
                worktree_path: "/test/worktrees/feature/my-task",
                pid: 12345,
                task_dir: ".viben/tasks/my-task",
                started_at: "2024-01-01T00:00:00",
                platform: "claude",
              },
            ],
          });
        }
        return "";
      });

      const mockProcess = {
        on: vi.fn((event: string, handler: (code: number) => void) => {
          if (event === "close") {
            setTimeout(() => handler(0), ASYNC_TICK_MS);
          }
          return mockProcess;
        }),
        stdout: {
          on: vi.fn((event: string, handler: (data: Buffer) => void) => {
            if (event === "data") {
              handler(Buffer.from(""));
            }
          }),
        },
        stderr: { on: vi.fn() },
      };
      mockSpawn.mockReturnValue(mockProcess);

      await runCommand(["--json", "swarm", "status"]);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"success": true')
      );
    });
  });

  // ============================================================================
  // swarm registry Tests
  // ============================================================================

  describe("swarm registry", () => {
    it("should display registry using TypeScript implementation", async () => {
      setupVibenWorkspace();
      mockExistsSync.mockImplementation((path: string) => {
        if (path === "/test/project/.viben") return true;
        if (path.includes(".developer")) return true;
        if (path.includes("registry.json")) return true;
        return false;
      });

      mockReadFileSync.mockImplementation((path: string) => {
        if (path.includes(".developer")) return "name=test-user";
        if (path.includes("registry.json")) {
          return JSON.stringify({
            agents: [{
              id: "my-task",
              worktree_path: "/test/worktrees/feature/my-task",
              pid: 12345,
              task_dir: ".viben/tasks/my-task",
              started_at: "2024-01-01T00:00:00",
              platform: "claude",
            }],
          });
        }
        return "";
      });

      await runCommand(["swarm", "registry"]);

      // The TypeScript implementation uses readRegistry() directly, not spawn
      expect(mockSpawn).not.toHaveBeenCalled();
      // Verify output contains registry information with agent details
      const output = consoleSpy.mock.calls.flat().join(" ");
      expect(output).toMatch(/Registry|Agent|my-task|12345/i);
    });

    it("should output JSON when --json flag is provided", async () => {
      setupVibenWorkspace();
      mockExistsSync.mockImplementation((path: string) => {
        if (path === "/test/project/.viben") return true;
        if (path.includes(".developer")) return true;
        if (path.includes("registry.json")) return true;
        return false;
      });

      mockReadFileSync.mockImplementation((path: string) => {
        if (path.includes(".developer")) return "name=test-user";
        if (path.includes("registry.json")) {
          return JSON.stringify({
            agents: [
              {
                id: "my-task",
                worktree_path: "/test/worktrees/feature/my-task",
                pid: 12345,
                task_dir: ".viben/tasks/my-task",
                started_at: "2024-01-01T00:00:00",
                platform: "claude",
              },
            ],
          });
        }
        return "";
      });

      await runCommand(["--json", "swarm", "registry"]);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"success": true')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"agents"')
      );
    });
  });

  // ============================================================================
  // Executor Mapping Tests
  // ============================================================================

  describe("executor to platform mapping", () => {
    // Test by checking that the command accepts the --executor flag without error
    // The actual mapping is tested implicitly through the start command tests
    it("should accept CLAUDE_CODE executor", async () => {
      setupVibenWorkspace();
      mockExistsSync.mockImplementation((path: string) => {
        if (path === "/test/project/.viben") return true;
        if (path.includes("tasks/my-task")) return true;
        if (path.includes("start.py")) return true;
        return false;
      });

      const mockProcess = {
        on: vi.fn((event: string, handler: (code: number) => void) => {
          if (event === "close") {
            setTimeout(() => handler(0), ASYNC_TICK_MS);
          }
          return mockProcess;
        }),
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
      };
      mockSpawn.mockReturnValue(mockProcess);

      // Should not throw
      await runCommand(["swarm", "start", "my-task", "--executor", "CLAUDE_CODE"]);
    });

    it("should accept lowercase executor names", async () => {
      setupVibenWorkspace();
      mockExistsSync.mockImplementation((path: string) => {
        if (path === "/test/project/.viben") return true;
        if (path.includes("tasks/my-task")) return true;
        if (path.includes("start.py")) return true;
        return false;
      });

      const mockProcess = {
        on: vi.fn((event: string, handler: (code: number) => void) => {
          if (event === "close") {
            setTimeout(() => handler(0), ASYNC_TICK_MS);
          }
          return mockProcess;
        }),
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
      };
      mockSpawn.mockReturnValue(mockProcess);

      // Should not throw even with lowercase
      await runCommand(["swarm", "start", "my-task", "--executor", "claude_code"]);
    });
  });
});
