/**
 * Swarm CLI Commands Tests
 *
 * Tests for the swarm command implementation:
 * - swarm list - List all worktrees and agents
 * - swarm start <task> - Start agent in worktree
 * - swarm stop <task> - Stop running agent
 * - swarm status - Show agent status
 * - swarm registry - Show agent registry
 * - swarm cleanup - Cleanup worktrees (DEPRECATED: use "task cleanup" instead)
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

vi.mock("node:fs", () => ({
  existsSync: (...args: unknown[]) => mockExistsSync(...args),
  readFileSync: (...args: unknown[]) => mockReadFileSync(...args),
  writeFileSync: (...args: unknown[]) => mockWriteFileSync(...args),
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

describe("Swarm CLI Commands", () => {
  let program: Command;
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
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
    mockSpawn.mockReset();
    mockExecSync.mockReset();

    // Default: not in a viben workspace
    mockExistsSync.mockReturnValue(false);
  });

  afterEach(() => {
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
      expect(subcommands).toContain("cleanup");
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
    it("should call cleanup.py --list when in a workspace", async () => {
      setupVibenWorkspace();

      // Mock spawn to return a process
      const mockProcess = {
        on: vi.fn((event: string, handler: Function) => {
          if (event === "close") {
            setTimeout(() => handler(0), 10);
          }
          return mockProcess;
        }),
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
      };
      mockSpawn.mockReturnValue(mockProcess);

      await runCommand(["swarm", "list"]);

      expect(mockSpawn).toHaveBeenCalledWith(
        "python3",
        expect.arrayContaining(["--list"]),
        expect.any(Object)
      );
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
        return false;
      });

      const mockProcess = {
        on: vi.fn((event: string, handler: Function) => {
          if (event === "close") {
            setTimeout(() => handler(0), 10);
          }
          return mockProcess;
        }),
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
      };
      mockSpawn.mockReturnValue(mockProcess);

      await runCommand(["swarm", "start", "my-task"]);

      expect(mockSpawn).toHaveBeenCalledWith(
        "python3",
        expect.arrayContaining([".viben/tasks/my-task"]),
        expect.any(Object)
      );
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

      // Mock process.kill - first call checks if running, second call stops
      const killSpy = vi.fn();
      process.kill = killSpy as typeof process.kill;

      await runCommand(["swarm", "stop", "my-task"]);

      // Should call kill at least once (either for check or for stop)
      expect(killSpy).toHaveBeenCalled();
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

      const killSpy = vi.fn();
      process.kill = killSpy as typeof process.kill;

      await runCommand(["swarm", "stop", "my-task", "--force"]);

      // Should be called with SIGKILL
      expect(killSpy).toHaveBeenCalledWith(12345, "SIGKILL");
    });
  });

  // ============================================================================
  // swarm status Tests
  // ============================================================================

  describe("swarm status", () => {
    it("should call status.py for summary", async () => {
      setupVibenWorkspace();
      mockExistsSync.mockImplementation((path: string) => {
        if (path === "/test/project/.viben") return true;
        if (path.includes("status.py")) return true;
        return false;
      });

      const mockProcess = {
        on: vi.fn((event: string, handler: Function) => {
          if (event === "close") {
            setTimeout(() => handler(0), 10);
          }
          return mockProcess;
        }),
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
      };
      mockSpawn.mockReturnValue(mockProcess);

      await runCommand(["swarm", "status"]);

      expect(mockSpawn).toHaveBeenCalledWith(
        "python3",
        expect.any(Array),
        expect.any(Object)
      );
    });

    it("should pass --detail for specific task", async () => {
      setupVibenWorkspace();
      mockExistsSync.mockImplementation((path: string) => {
        if (path === "/test/project/.viben") return true;
        if (path.includes("status.py")) return true;
        return false;
      });

      const mockProcess = {
        on: vi.fn((event: string, handler: Function) => {
          if (event === "close") {
            setTimeout(() => handler(0), 10);
          }
          return mockProcess;
        }),
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
      };
      mockSpawn.mockReturnValue(mockProcess);

      await runCommand(["swarm", "status", "my-task", "--detail"]);

      expect(mockSpawn).toHaveBeenCalledWith(
        "python3",
        expect.arrayContaining(["--detail", "my-task"]),
        expect.any(Object)
      );
    });

    it("should pass --watch for live monitoring", async () => {
      setupVibenWorkspace();
      mockExistsSync.mockImplementation((path: string) => {
        if (path === "/test/project/.viben") return true;
        if (path.includes("status.py")) return true;
        return false;
      });

      const mockProcess = {
        on: vi.fn((event: string, handler: Function) => {
          if (event === "close") {
            setTimeout(() => handler(0), 10);
          }
          return mockProcess;
        }),
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
      };
      mockSpawn.mockReturnValue(mockProcess);

      await runCommand(["swarm", "status", "my-task", "--watch"]);

      expect(mockSpawn).toHaveBeenCalledWith(
        "python3",
        expect.arrayContaining(["--watch", "my-task"]),
        expect.any(Object)
      );
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
        on: vi.fn((event: string, handler: Function) => {
          if (event === "close") {
            setTimeout(() => handler(0), 10);
          }
          return mockProcess;
        }),
        stdout: {
          on: vi.fn((event: string, handler: Function) => {
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
    it("should call status.py --registry", async () => {
      setupVibenWorkspace();
      mockExistsSync.mockImplementation((path: string) => {
        if (path === "/test/project/.viben") return true;
        if (path.includes("status.py")) return true;
        return false;
      });

      const mockProcess = {
        on: vi.fn((event: string, handler: Function) => {
          if (event === "close") {
            setTimeout(() => handler(0), 10);
          }
          return mockProcess;
        }),
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
      };
      mockSpawn.mockReturnValue(mockProcess);

      await runCommand(["swarm", "registry"]);

      expect(mockSpawn).toHaveBeenCalledWith(
        "python3",
        expect.arrayContaining(["--registry"]),
        expect.any(Object)
      );
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
  // swarm cleanup Tests
  // ============================================================================
  // DEPRECATED: The "swarm cleanup" command is deprecated in favor of "task cleanup".
  // These tests are kept to verify backward compatibility until the command is removed.
  // See: task.ts for the new "task cleanup" command implementation.

  describe("swarm cleanup (DEPRECATED - use task cleanup instead)", () => {
    // @deprecated This test is for deprecated behavior - use "task cleanup" instead
    it("should require branch or flag", async () => {
      setupVibenWorkspace();

      await runCommand(["swarm", "cleanup"]);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Branch name or --merged/--all required")
      );
    });

    // @deprecated This test is for deprecated behavior - use "task cleanup" instead
    it("should call cleanup.py with branch name", async () => {
      setupVibenWorkspace();
      mockExistsSync.mockImplementation((path: string) => {
        if (path === "/test/project/.viben") return true;
        if (path.includes("cleanup.py")) return true;
        return false;
      });

      const mockProcess = {
        on: vi.fn((event: string, handler: Function) => {
          if (event === "close") {
            setTimeout(() => handler(0), 10);
          }
          return mockProcess;
        }),
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
      };
      mockSpawn.mockReturnValue(mockProcess);

      await runCommand(["swarm", "cleanup", "feature/my-branch"]);

      expect(mockSpawn).toHaveBeenCalledWith(
        "python3",
        expect.arrayContaining(["feature/my-branch"]),
        expect.any(Object)
      );
    });

    // @deprecated This test is for deprecated behavior - use "task cleanup" instead
    it("should pass --merged flag", async () => {
      setupVibenWorkspace();
      mockExistsSync.mockImplementation((path: string) => {
        if (path === "/test/project/.viben") return true;
        if (path.includes("cleanup.py")) return true;
        return false;
      });

      const mockProcess = {
        on: vi.fn((event: string, handler: Function) => {
          if (event === "close") {
            setTimeout(() => handler(0), 10);
          }
          return mockProcess;
        }),
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
      };
      mockSpawn.mockReturnValue(mockProcess);

      await runCommand(["swarm", "cleanup", "--merged"]);

      expect(mockSpawn).toHaveBeenCalledWith(
        "python3",
        expect.arrayContaining(["--merged"]),
        expect.any(Object)
      );
    });

    // @deprecated This test is for deprecated behavior - use "task cleanup" instead
    it("should pass --all flag", async () => {
      setupVibenWorkspace();
      mockExistsSync.mockImplementation((path: string) => {
        if (path === "/test/project/.viben") return true;
        if (path.includes("cleanup.py")) return true;
        return false;
      });

      const mockProcess = {
        on: vi.fn((event: string, handler: Function) => {
          if (event === "close") {
            setTimeout(() => handler(0), 10);
          }
          return mockProcess;
        }),
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
      };
      mockSpawn.mockReturnValue(mockProcess);

      await runCommand(["swarm", "cleanup", "--all"]);

      expect(mockSpawn).toHaveBeenCalledWith(
        "python3",
        expect.arrayContaining(["--all"]),
        expect.any(Object)
      );
    });

    // @deprecated This test is for deprecated behavior - use "task cleanup" instead
    it("should pass --keep-branch flag", async () => {
      setupVibenWorkspace();
      mockExistsSync.mockImplementation((path: string) => {
        if (path === "/test/project/.viben") return true;
        if (path.includes("cleanup.py")) return true;
        return false;
      });

      const mockProcess = {
        on: vi.fn((event: string, handler: Function) => {
          if (event === "close") {
            setTimeout(() => handler(0), 10);
          }
          return mockProcess;
        }),
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
      };
      mockSpawn.mockReturnValue(mockProcess);

      await runCommand(["swarm", "cleanup", "feature/my-branch", "--keep-branch"]);

      expect(mockSpawn).toHaveBeenCalledWith(
        "python3",
        expect.arrayContaining(["--keep-branch"]),
        expect.any(Object)
      );
    });

    // @deprecated This test is for deprecated behavior - use "task cleanup" instead
    it("should pass -y/--yes flag", async () => {
      setupVibenWorkspace();
      mockExistsSync.mockImplementation((path: string) => {
        if (path === "/test/project/.viben") return true;
        if (path.includes("cleanup.py")) return true;
        return false;
      });

      const mockProcess = {
        on: vi.fn((event: string, handler: Function) => {
          if (event === "close") {
            setTimeout(() => handler(0), 10);
          }
          return mockProcess;
        }),
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
      };
      mockSpawn.mockReturnValue(mockProcess);

      await runCommand(["swarm", "cleanup", "--merged", "-y"]);

      expect(mockSpawn).toHaveBeenCalledWith(
        "python3",
        expect.arrayContaining(["--yes"]),
        expect.any(Object)
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
        on: vi.fn((event: string, handler: Function) => {
          if (event === "close") {
            setTimeout(() => handler(0), 10);
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
        on: vi.fn((event: string, handler: Function) => {
          if (event === "close") {
            setTimeout(() => handler(0), 10);
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
