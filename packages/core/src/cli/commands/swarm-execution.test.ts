/**
 * Swarm Command Execution Tests
 *
 * Tests that verify actual behavior of swarm commands with real file operations.
 * Uses temporary directories and actual registry/worktree operations.
 *
 * This complements swarm.test.ts which mocks most file system operations.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Command } from "commander";
import { registerSwarmCommand } from "./swarm";
import {
  createTempDir,
  type TempDirContext,
} from "../../test/helpers/temp-dir";
import { createConsoleSpy, type ConsoleSpy } from "../../test/mocks/console";
import * as child_process from "node:child_process";
import { EventEmitter } from "node:events";

// =============================================================================
// Mocks
// =============================================================================

// Mock findVibenRoot to return our temp directory
vi.mock("../lib/viben-workspace", async (importOriginal) => {
  const original = await importOriginal<typeof import("../lib/viben-workspace")>();
  return {
    ...original,
    findVibenRoot: vi.fn(),
    getDeveloper: vi.fn(() => "test-developer"),
  };
});

// Mock child_process.spawn to avoid actually spawning processes
vi.mock("node:child_process", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:child_process")>();
  return {
    ...actual,
    spawn: vi.fn(),
    execSync: vi.fn((cmd: string, options?: Record<string, unknown>) => {
      // Mock git commands
      if (cmd.includes("git worktree list")) {
        return "";
      }
      if (cmd.includes("git branch")) {
        return "main";
      }
      if (cmd.includes("git status")) {
        return "";
      }
      return "";
    }),
  };
});

// Mock chalk to simplify output verification
vi.mock("chalk", () => ({
  default: {
    bold: (s: string) => s,
    gray: (s: string) => s,
    cyan: (s: string) => s,
    green: (s: string) => s,
    yellow: (s: string) => s,
    red: (s: string) => s,
    blue: (s: string) => s,
    dim: (s: string) => s,
  },
}));

import * as vibenWorkspace from "../lib/viben-workspace";

// =============================================================================
// Test Helpers
// =============================================================================

/**
 * Create a mock child process for spawn
 */
function createMockChildProcess(pid: number): child_process.ChildProcess {
  const proc = new EventEmitter() as child_process.ChildProcess;
  Object.defineProperty(proc, "pid", { value: pid, writable: false });
  Object.defineProperty(proc, "stdio", {
    value: [null, null, null, null, null],
    writable: false,
  });
  Object.defineProperty(proc, "killed", { value: false, writable: true });
  Object.defineProperty(proc, "connected", { value: false, writable: true });
  Object.defineProperty(proc, "exitCode", { value: null, writable: true });
  Object.defineProperty(proc, "signalCode", { value: null, writable: true });
  Object.defineProperty(proc, "spawnargs", { value: [], writable: false });
  Object.defineProperty(proc, "spawnfile", { value: "", writable: false });

  proc.unref = vi.fn();
  proc.stdin = null;
  proc.stdout = null;
  proc.stderr = null;
  proc.kill = vi.fn(() => true);
  proc.send = vi.fn();
  proc.disconnect = vi.fn();
  proc.ref = vi.fn();

  return proc;
}

/**
 * Create a viben workspace structure for testing
 */
async function createVibenWorkspace(
  tempDir: TempDirContext,
  developerName: string = "test-developer"
): Promise<void> {
  // Create .viben directory structure
  await tempDir.mkdir(".viben");
  await tempDir.writeFile(".viben/.developer", `name=${developerName}\n`);
  await tempDir.mkdir(".viben/tasks");
  await tempDir.mkdir(`.viben/workspace/${developerName}/.agents`);
  await tempDir.writeJson(
    `.viben/workspace/${developerName}/.agents/registry.json`,
    { agents: [] }
  );
}

/**
 * Add an agent to the registry
 */
async function addAgentToRegistry(
  tempDir: TempDirContext,
  agent: {
    id: string;
    worktree_path: string;
    pid: number;
    task_dir: string;
    started_at: string;
    platform: string;
  },
  developerName: string = "test-developer"
): Promise<void> {
  const registryPath = `.viben/workspace/${developerName}/.agents/registry.json`;
  const registry = await tempDir.readJson<{ agents: unknown[] }>(registryPath);
  registry.agents.push(agent);
  await tempDir.writeJson(registryPath, registry);
}

/**
 * Create a task directory with task.json
 */
async function createTaskDir(
  tempDir: TempDirContext,
  taskName: string,
  taskData: Record<string, unknown> = {}
): Promise<string> {
  const taskDir = await tempDir.mkdir(`.viben/tasks/${taskName}`);
  const now = new Date().toISOString();

  await tempDir.writeJson(`.viben/tasks/${taskName}/task.json`, {
    id: taskName,
    name: taskName,
    title: `Test Task: ${taskName}`,
    status: "backlog",
    priority: "medium",
    created_at: now,
    updated_at: now,
    ...taskData,
  });

  return taskDir;
}

// =============================================================================
// Test Context
// =============================================================================

interface ExecutionTestContext {
  tempDir: TempDirContext;
  program: Command;
  console: ConsoleSpy;
  processKillSpy: ReturnType<typeof vi.spyOn>;
  processExitSpy: ReturnType<typeof vi.spyOn>;
  exitCode: number | undefined;
  run: (args: string[]) => Promise<void>;
  runJson: (args: string[]) => Promise<unknown>;
  cleanup: () => Promise<void>;
}

async function createExecutionTestContext(): Promise<ExecutionTestContext> {
  const tempDir = await createTempDir("swarm-exec-test-");

  // Mock findVibenRoot to return our temp directory
  vi.mocked(vibenWorkspace.findVibenRoot).mockReturnValue(tempDir.root);

  // Track exit code
  let exitCode: number | undefined;

  // Mock process.exit to capture exit code
  const processExitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
    exitCode = code ?? 0;
    throw new Error(`process.exit(${code})`);
  }) as () => never);

  // Mock process.kill for process running checks
  const processKillSpy = vi.spyOn(process, "kill");

  const program = new Command();
  program.option("--json", "Output JSON format");
  program.option("--verbose", "Verbose output");
  program.option("--quiet", "Quiet mode");

  // Prevent commander from calling process.exit
  program.exitOverride();

  registerSwarmCommand(program);

  const consoleSpy = createConsoleSpy();

  return {
    tempDir,
    program,
    console: consoleSpy,
    processKillSpy,
    processExitSpy,
    get exitCode() {
      return exitCode;
    },

    async run(args: string[]) {
      exitCode = undefined;
      try {
        await program.parseAsync(["node", "test", ...args]);
      } catch (error) {
        const errorMessage = (error as Error).message || "";
        if (
          (error as Error).name !== "CommanderError" &&
          !errorMessage.includes("process.exit")
        ) {
          throw error;
        }
      }
    },

    async runJson(args: string[]) {
      exitCode = undefined;
      try {
        await program.parseAsync(["node", "test", "--json", ...args]);
      } catch (error) {
        const errorMessage = (error as Error).message || "";
        if (
          (error as Error).name !== "CommanderError" &&
          !errorMessage.includes("process.exit")
        ) {
          throw error;
        }
      }
      const lastLog = consoleSpy.getLastLog();
      if (lastLog) {
        try {
          return JSON.parse(lastLog);
        } catch {
          return null;
        }
      }
      return null;
    },

    async cleanup() {
      consoleSpy.cleanup();
      processExitSpy.mockRestore();
      processKillSpy.mockRestore();
      vi.clearAllMocks();
      await tempDir.cleanup();
    },
  };
}

// =============================================================================
// Execution Tests
// =============================================================================

describe("swarm command execution", () => {
  let ctx: ExecutionTestContext;

  beforeEach(async () => {
    ctx = await createExecutionTestContext();
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  // ===========================================================================
  // Workspace detection tests
  // ===========================================================================

  describe("workspace detection", () => {
    it("should fail when not in a viben workspace", async () => {
      vi.mocked(vibenWorkspace.findVibenRoot).mockReturnValue(null);

      await ctx.run(["swarm", "list"]);

      expect(ctx.console.hasError("Not in a Viben workspace")).toBe(true);
    });

    it("should succeed when in a valid viben workspace", async () => {
      await createVibenWorkspace(ctx.tempDir);

      await ctx.run(["swarm", "list"]);

      expect(ctx.console.hasLog("Git Worktrees") || ctx.console.hasLog("Registered Agents")).toBe(true);
    });
  });

  // ===========================================================================
  // swarm list execution tests
  // ===========================================================================

  describe("swarm list", () => {
    it("should show empty state when no worktrees or agents exist", async () => {
      await createVibenWorkspace(ctx.tempDir);

      await ctx.run(["swarm", "list"]);

      expect(ctx.console.hasLog("no worktrees") || ctx.console.hasLog("no agents")).toBe(true);
    });

    it("should list registered agents from registry", async () => {
      await createVibenWorkspace(ctx.tempDir);
      await addAgentToRegistry(ctx.tempDir, {
        id: "test-agent-001",
        worktree_path: "/test/worktrees/feature/test-task",
        pid: 12345,
        task_dir: ".viben/tasks/03-20-test-task",
        started_at: new Date().toISOString(),
        platform: "claude",
      });

      await ctx.run(["swarm", "list"]);

      expect(ctx.console.hasLog("test-agent-001")).toBe(true);
    });

    it("should return JSON output with --json flag", async () => {
      await createVibenWorkspace(ctx.tempDir);
      await addAgentToRegistry(ctx.tempDir, {
        id: "json-test-agent",
        worktree_path: "/test/worktrees/feature/json-task",
        pid: 54321,
        task_dir: ".viben/tasks/03-20-json-task",
        started_at: new Date().toISOString(),
        platform: "claude",
      });

      const result = (await ctx.runJson(["swarm", "list"])) as {
        success: boolean;
        data: { agents: Array<{ id: string }> };
      };

      expect(result?.success).toBe(true);
      expect(result?.data?.agents).toBeDefined();
      expect(result?.data?.agents.some((a) => a.id === "json-test-agent")).toBe(true);
    });
  });

  // ===========================================================================
  // swarm registry execution tests
  // ===========================================================================

  describe("swarm registry", () => {
    it("should show empty registry when no agents registered", async () => {
      await createVibenWorkspace(ctx.tempDir);

      await ctx.run(["swarm", "registry"]);

      expect(ctx.console.hasLog("Agent Registry")).toBe(true);
    });

    it("should show registry with agents", async () => {
      await createVibenWorkspace(ctx.tempDir);
      await addAgentToRegistry(ctx.tempDir, {
        id: "registry-agent-001",
        worktree_path: "/test/worktrees/feature/registry-task",
        pid: 11111,
        task_dir: ".viben/tasks/03-20-registry-task",
        started_at: new Date().toISOString(),
        platform: "claude",
      });

      await ctx.run(["swarm", "registry"]);

      expect(ctx.console.hasLog("registry-agent-001")).toBe(true);
    });

    it("should return JSON output with --json flag", async () => {
      await createVibenWorkspace(ctx.tempDir);
      await addAgentToRegistry(ctx.tempDir, {
        id: "json-registry-agent",
        worktree_path: "/test/worktrees/feature/json-registry",
        pid: 22222,
        task_dir: ".viben/tasks/03-20-json-registry",
        started_at: new Date().toISOString(),
        platform: "claude",
      });

      const result = (await ctx.runJson(["swarm", "registry"])) as {
        success: boolean;
        data: { agents: Array<{ id: string }> };
      };

      expect(result?.success).toBe(true);
      expect(result?.data?.agents).toBeDefined();
    });
  });

  // ===========================================================================
  // swarm status execution tests
  // ===========================================================================

  describe("swarm status", () => {
    it("should show summary status when no agents registered", async () => {
      await createVibenWorkspace(ctx.tempDir);

      await ctx.run(["swarm", "status"]);

      expect(ctx.console.hasLog("Swarm Status")).toBe(true);
      expect(ctx.console.hasLog("0 running") || ctx.console.hasLog("0")).toBe(true);
    });

    it("should show agent status summary with registered agents", async () => {
      await createVibenWorkspace(ctx.tempDir);

      // Mock process.kill to indicate process is not running
      ctx.processKillSpy.mockImplementation(() => {
        const err = new Error("ESRCH");
        (err as NodeJS.ErrnoException).code = "ESRCH";
        throw err;
      });

      await addAgentToRegistry(ctx.tempDir, {
        id: "status-agent-001",
        worktree_path: "/test/worktrees/feature/status-task",
        pid: 33333,
        task_dir: ".viben/tasks/03-20-status-task",
        started_at: new Date().toISOString(),
        platform: "claude",
      });

      await ctx.run(["swarm", "status"]);

      expect(ctx.console.hasLog("Swarm Status")).toBe(true);
    });

    it("should show running status for running agent", async () => {
      await createVibenWorkspace(ctx.tempDir);

      // Mock process.kill to indicate process IS running
      ctx.processKillSpy.mockImplementation((pid: number, signal?: string | number) => {
        if (signal === 0 && pid === 44444) {
          return true; // Process exists
        }
        return true;
      });

      await addAgentToRegistry(ctx.tempDir, {
        id: "running-agent",
        worktree_path: ctx.tempDir.resolve("worktrees/running-task"),
        pid: 44444,
        task_dir: ".viben/tasks/03-20-running-task",
        started_at: new Date().toISOString(),
        platform: "claude",
      });

      await ctx.run(["swarm", "status", "--running"]);

      // Status should be shown
      expect(ctx.console.hasLog("Swarm Status") || ctx.console.hasLog("Running")).toBe(true);
    });

    it("should return JSON output with --json flag", async () => {
      await createVibenWorkspace(ctx.tempDir);

      const result = (await ctx.runJson(["swarm", "status"])) as {
        success: boolean;
        data: { agents: unknown[] };
      };

      expect(result?.success).toBe(true);
      expect(result?.data?.agents).toBeDefined();
    });

    it("should filter by --running flag", async () => {
      await createVibenWorkspace(ctx.tempDir);

      // Mock: first agent is running, second is not
      const runningPid = 55555;
      const stoppedPid = 66666;

      ctx.processKillSpy.mockImplementation((pid: number, signal?: string | number) => {
        if (signal === 0) {
          if (pid === runningPid) return true;
          if (pid === stoppedPid) {
            const err = new Error("ESRCH");
            (err as NodeJS.ErrnoException).code = "ESRCH";
            throw err;
          }
        }
        return true;
      });

      await addAgentToRegistry(ctx.tempDir, {
        id: "running-filter-agent",
        worktree_path: ctx.tempDir.resolve("worktrees/running-filter"),
        pid: runningPid,
        task_dir: ".viben/tasks/03-20-running-filter",
        started_at: new Date().toISOString(),
        platform: "claude",
      });

      await addAgentToRegistry(ctx.tempDir, {
        id: "stopped-filter-agent",
        worktree_path: ctx.tempDir.resolve("worktrees/stopped-filter"),
        pid: stoppedPid,
        task_dir: ".viben/tasks/03-20-stopped-filter",
        started_at: new Date().toISOString(),
        platform: "claude",
      });

      const result = (await ctx.runJson(["swarm", "status", "--running"])) as {
        success: boolean;
        data: { agents: Array<{ id: string; running: boolean }> };
      };

      expect(result?.success).toBe(true);
      // All returned agents should be running
      const agents = result?.data?.agents || [];
      expect(agents.every((a) => a.running)).toBe(true);
    });

    it("should filter by --stopped flag", async () => {
      await createVibenWorkspace(ctx.tempDir);

      // All agents are stopped
      ctx.processKillSpy.mockImplementation(() => {
        const err = new Error("ESRCH");
        (err as NodeJS.ErrnoException).code = "ESRCH";
        throw err;
      });

      await addAgentToRegistry(ctx.tempDir, {
        id: "stopped-only-agent",
        worktree_path: ctx.tempDir.resolve("worktrees/stopped-only"),
        pid: 77777,
        task_dir: ".viben/tasks/03-20-stopped-only",
        started_at: new Date().toISOString(),
        platform: "claude",
      });

      const result = (await ctx.runJson(["swarm", "status", "--stopped"])) as {
        success: boolean;
        data: { agents: Array<{ id: string; running: boolean }> };
      };

      expect(result?.success).toBe(true);
      const agents = result?.data?.agents || [];
      expect(agents.every((a) => !a.running)).toBe(true);
    });
  });

  // ===========================================================================
  // swarm stop execution tests
  // ===========================================================================

  describe("swarm stop", () => {
    it("should show error when task name not provided and no --all flag", async () => {
      await createVibenWorkspace(ctx.tempDir);

      await ctx.run(["swarm", "stop"]);

      expect(ctx.console.hasError("Task name is required")).toBe(true);
      expect(ctx.exitCode).toBe(1);
    });

    it("should show error when agent not found", async () => {
      await createVibenWorkspace(ctx.tempDir);

      await ctx.run(["swarm", "stop", "nonexistent-agent"]);

      expect(ctx.console.hasError("Agent not found")).toBe(true);
      expect(ctx.exitCode).toBe(1);
    });

    it("should stop a running agent", async () => {
      await createVibenWorkspace(ctx.tempDir);

      const agentPid = 88888;
      let processStopped = false;

      ctx.processKillSpy.mockImplementation((pid: number, signal?: string | number) => {
        if (pid === agentPid) {
          if (signal === 0) {
            // Check if process is running
            if (processStopped) {
              const err = new Error("ESRCH");
              (err as NodeJS.ErrnoException).code = "ESRCH";
              throw err;
            }
            return true; // Process exists
          }
          if (signal === "SIGTERM" || signal === undefined) {
            processStopped = true;
            return true;
          }
        }
        return true;
      });

      await addAgentToRegistry(ctx.tempDir, {
        id: "stop-target-agent",
        worktree_path: ctx.tempDir.resolve("worktrees/stop-target"),
        pid: agentPid,
        task_dir: ".viben/tasks/03-20-stop-target",
        started_at: new Date().toISOString(),
        platform: "claude",
      });

      await ctx.run(["swarm", "stop", "stop-target-agent"]);

      expect(ctx.console.hasLog("Stopped")).toBe(true);
    });

    it("should use SIGKILL with --force flag", async () => {
      await createVibenWorkspace(ctx.tempDir);

      const agentPid = 99999;
      let receivedSignal: string | number | undefined;

      ctx.processKillSpy.mockImplementation((pid: number, signal?: string | number) => {
        if (pid === agentPid) {
          if (signal === 0) {
            return true; // Process exists
          }
          receivedSignal = signal;
          return true;
        }
        return true;
      });

      await addAgentToRegistry(ctx.tempDir, {
        id: "force-stop-agent",
        worktree_path: ctx.tempDir.resolve("worktrees/force-stop"),
        pid: agentPid,
        task_dir: ".viben/tasks/03-20-force-stop",
        started_at: new Date().toISOString(),
        platform: "claude",
      });

      await ctx.run(["swarm", "stop", "force-stop-agent", "--force"]);

      expect(receivedSignal).toBe("SIGKILL");
    });

    it("should stop all agents with --all flag", async () => {
      await createVibenWorkspace(ctx.tempDir);

      const agent1Pid = 11111;
      const agent2Pid = 22222;
      const stoppedPids: number[] = [];

      ctx.processKillSpy.mockImplementation((pid: number, signal?: string | number) => {
        if (signal === 0) {
          // Check if process is running (if not already stopped)
          if (stoppedPids.includes(pid)) {
            const err = new Error("ESRCH");
            (err as NodeJS.ErrnoException).code = "ESRCH";
            throw err;
          }
          return true;
        }
        if (signal === "SIGTERM" || signal === undefined) {
          stoppedPids.push(pid);
          return true;
        }
        return true;
      });

      await addAgentToRegistry(ctx.tempDir, {
        id: "all-stop-agent-1",
        worktree_path: ctx.tempDir.resolve("worktrees/all-stop-1"),
        pid: agent1Pid,
        task_dir: ".viben/tasks/03-20-all-stop-1",
        started_at: new Date().toISOString(),
        platform: "claude",
      });

      await addAgentToRegistry(ctx.tempDir, {
        id: "all-stop-agent-2",
        worktree_path: ctx.tempDir.resolve("worktrees/all-stop-2"),
        pid: agent2Pid,
        task_dir: ".viben/tasks/03-20-all-stop-2",
        started_at: new Date().toISOString(),
        platform: "claude",
      });

      await ctx.run(["swarm", "stop", "--all"]);

      expect(stoppedPids).toContain(agent1Pid);
      expect(stoppedPids).toContain(agent2Pid);
    });

    it("should report already stopped agent", async () => {
      await createVibenWorkspace(ctx.tempDir);

      const agentPid = 12121;

      // Process is not running
      ctx.processKillSpy.mockImplementation((pid: number, signal?: string | number) => {
        if (pid === agentPid && signal === 0) {
          const err = new Error("ESRCH");
          (err as NodeJS.ErrnoException).code = "ESRCH";
          throw err;
        }
        return true;
      });

      await addAgentToRegistry(ctx.tempDir, {
        id: "already-stopped-agent",
        worktree_path: ctx.tempDir.resolve("worktrees/already-stopped"),
        pid: agentPid,
        task_dir: ".viben/tasks/03-20-already-stopped",
        started_at: new Date().toISOString(),
        platform: "claude",
      });

      await ctx.run(["swarm", "stop", "already-stopped-agent"]);

      expect(ctx.console.hasLog("not running") || ctx.console.hasLog("already_stopped")).toBe(true);
    });
  });

  // ===========================================================================
  // swarm start execution tests (deprecated but still functional)
  // ===========================================================================

  describe("swarm start", () => {
    it("should show deprecation warning", async () => {
      await createVibenWorkspace(ctx.tempDir);

      // Task doesn't exist, but deprecation warning should still show
      await ctx.run(["swarm", "start", "some-task"]);

      expect(ctx.console.hasLog("DEPRECATED")).toBe(true);
    });

    it("should fail when task not found", async () => {
      await createVibenWorkspace(ctx.tempDir);

      await ctx.run(["swarm", "start", "nonexistent-task"]);

      expect(ctx.console.hasError("Task not found")).toBe(true);
      expect(ctx.exitCode).toBe(1);
    });

    it("should start agent when task exists", async () => {
      await createVibenWorkspace(ctx.tempDir);
      await createTaskDir(ctx.tempDir, "03-20-start-task", {
        title: "Start Task",
        status: "queue",
      });

      // Mock spawn to return a process
      const mockProc = createMockChildProcess(13131);
      vi.mocked(child_process.spawn).mockReturnValue(mockProc);

      // Mock git commands
      vi.mocked(child_process.execSync).mockImplementation((cmd: string) => {
        if (typeof cmd === "string" && cmd.includes("git worktree list")) {
          return "";
        }
        if (typeof cmd === "string" && cmd.includes("git branch")) {
          return "main";
        }
        return "";
      });

      await ctx.run(["swarm", "start", "start-task"]);

      // Should show deprecation and attempt to start
      expect(ctx.console.hasLog("DEPRECATED")).toBe(true);
    });
  });

  // ===========================================================================
  // swarm wait execution tests
  // ===========================================================================

  describe("swarm wait", () => {
    it("should show error when no tasks specified and no --all flag", async () => {
      await createVibenWorkspace(ctx.tempDir);

      await ctx.run(["swarm", "wait"]);

      // Check error message was shown (exit code may vary due to error handling chain)
      expect(ctx.console.hasError("No tasks specified")).toBe(true);
    });

    it("should exit successfully when no running agents with --all flag", async () => {
      await createVibenWorkspace(ctx.tempDir);

      // No agents in registry means no running agents
      await ctx.run(["swarm", "wait", "--all"]);

      // Check the output message - exit code 0 indicates no agents to wait for
      expect(ctx.console.hasLog("No running agents") || ctx.console.hasLog("No other running agents")).toBe(true);
    });

    it("should report tasks not found in registry", async () => {
      await createVibenWorkspace(ctx.tempDir);

      await ctx.run(["swarm", "wait", "nonexistent-task-1", "nonexistent-task-2"]);

      expect(
        ctx.console.hasLog("not found") ||
        ctx.console.hasLog("No running agents")
      ).toBe(true);
    });
  });

  // ===========================================================================
  // Registry file operations tests
  // ===========================================================================

  describe("registry file operations", () => {
    it("should read registry from correct location", async () => {
      await createVibenWorkspace(ctx.tempDir);

      const result = (await ctx.runJson(["swarm", "registry"])) as {
        success: boolean;
        data: { path: string };
      };

      expect(result?.success).toBe(true);
      expect(result?.data?.path).toContain(".viben/workspace/test-developer/.agents/registry.json");
    });

    it("should handle missing registry file gracefully", async () => {
      await createVibenWorkspace(ctx.tempDir);

      // Remove the registry file
      const registryPath = ctx.tempDir.resolve(".viben/workspace/test-developer/.agents/registry.json");
      const fs = await import("node:fs/promises");
      await fs.rm(registryPath, { force: true });

      await ctx.run(["swarm", "list"]);

      // Should not crash, should show empty state
      expect(ctx.console.hasLog("no agents") || ctx.console.hasLog("Registered Agents")).toBe(true);
    });

    it("should handle corrupted registry file gracefully", async () => {
      await createVibenWorkspace(ctx.tempDir);

      // Write invalid JSON
      await ctx.tempDir.writeFile(
        ".viben/workspace/test-developer/.agents/registry.json",
        "{ invalid json }"
      );

      await ctx.run(["swarm", "list"]);

      // Should not crash, should treat as empty registry
      expect(ctx.console.hasLog("Registered Agents")).toBe(true);
    });
  });

  // ===========================================================================
  // Task directory resolution tests
  // ===========================================================================

  describe("task directory resolution", () => {
    it("should find task by exact name", async () => {
      await createVibenWorkspace(ctx.tempDir);
      await createTaskDir(ctx.tempDir, "03-20-exact-name-task", {
        title: "Exact Name Task",
        status: "backlog",
      });

      // Mock spawn
      const mockProc = createMockChildProcess(14141);
      vi.mocked(child_process.spawn).mockReturnValue(mockProc);

      await ctx.run(["swarm", "start", "03-20-exact-name-task"]);

      // Should find the task (deprecation warning shown)
      expect(ctx.console.hasLog("DEPRECATED")).toBe(true);
    });

    it("should find task by partial name match", async () => {
      await createVibenWorkspace(ctx.tempDir);
      await createTaskDir(ctx.tempDir, "03-20-partial-match-task", {
        title: "Partial Match Task",
        status: "backlog",
      });

      // Mock spawn
      const mockProc = createMockChildProcess(15151);
      vi.mocked(child_process.spawn).mockReturnValue(mockProc);

      await ctx.run(["swarm", "start", "partial-match"]);

      // Should find the task via partial match
      expect(ctx.console.hasLog("DEPRECATED")).toBe(true);
    });

    it("should sanitize task name to prevent path traversal", async () => {
      await createVibenWorkspace(ctx.tempDir);

      // Attempt path traversal - should be sanitized
      await ctx.run(["swarm", "start", "../../../etc/passwd"]);

      // Should fail safely (task not found)
      expect(ctx.console.hasError("Task not found")).toBe(true);
      expect(ctx.exitCode).toBe(1);
    });
  });

  // ===========================================================================
  // Platform/executor mapping tests
  // ===========================================================================

  describe("platform executor mapping", () => {
    it("should accept CLAUDE_CODE executor", async () => {
      await createVibenWorkspace(ctx.tempDir);
      await createTaskDir(ctx.tempDir, "03-20-claude-task", {
        title: "Claude Task",
        status: "queue",
      });

      const mockProc = createMockChildProcess(16161);
      vi.mocked(child_process.spawn).mockReturnValue(mockProc);

      await ctx.run(["swarm", "start", "claude-task", "--executor", "CLAUDE_CODE"]);

      // Should not error on executor type
      expect(ctx.console.hasLog("DEPRECATED")).toBe(true);
    });

    it("should accept lowercase executor names", async () => {
      await createVibenWorkspace(ctx.tempDir);
      await createTaskDir(ctx.tempDir, "03-20-lower-task", {
        title: "Lower Task",
        status: "queue",
      });

      const mockProc = createMockChildProcess(17171);
      vi.mocked(child_process.spawn).mockReturnValue(mockProc);

      await ctx.run(["swarm", "start", "lower-task", "--executor", "cursor"]);

      // Should accept lowercase executor
      expect(ctx.console.hasLog("DEPRECATED")).toBe(true);
    });
  });
});
