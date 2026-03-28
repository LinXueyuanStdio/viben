/**
 * Task Command Tests
 *
 * Tests for task CLI command registration, option validation, and behavior.
 *
 * Tested commands:
 * - CRUD: list, create, view, edit, delete
 * - Status lifecycle: start, finish, archive, list-archive
 * - Queue operations: enqueue, dequeue, pause, resume
 * - Review operations: review, approve, reject, retry
 * - Cancel operations: cancel, stop (alias)
 * - Config: set-branch, set-base, set-agent
 * - Context: init-context, add-context, remove-context, list-context, validate-context, context
 * - Session: add-session
 * - Phase commands: plan-phase, implement-phase, check-phase, work-phase
 * - Worktree: create-worktree, cleanup, validate-check-phase-passed
 * - Other: status, create-pr
 *
 * Additional test files for operation-level testing:
 * - task/ops/crud.test.ts - CRUD operation unit tests
 * - task/ops/lifecycle.test.ts - Status transition unit tests
 * - task/ops/context-files.test.ts - Context file operation unit tests
 * - task/machine/task-machine.test.ts - State machine tests
 * - task/machine/guards.test.ts - State machine guard tests
 * - task/machine/actions.test.ts - State machine action tests
 * - task/events/event-store.test.ts - Event store tests
 *
 * Note: validateStatusTransition tests are included here for convenience,
 * but could be moved to cli/lib/viben-workspace.test.ts in the future.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Command, type Option } from "commander";
import { registerTaskCommand } from "./task";
import type { TaskEventType } from "../lib/viben-workspace";

// =============================================================================
// Test Helpers
// =============================================================================

/**
 * Find a subcommand within a parent command
 */
function findSubcommand(
  program: Command,
  parent: string,
  child: string
): Command | undefined {
  const parentCmd = program.commands.find((cmd) => cmd.name() === parent);
  return parentCmd?.commands.find((cmd) => cmd.name() === child);
}

/**
 * Find an option by its long name
 */
function findOption(cmd: Command | undefined, optionName: string): Option | undefined {
  return cmd?.options.find((opt) => opt.long === `--${optionName}`);
}

/**
 * Get all subcommand names from a parent command
 */
function getSubcommandNames(program: Command, parent: string): string[] {
  const parentCmd = program.commands.find((cmd) => cmd.name() === parent);
  return parentCmd?.commands.map((cmd) => cmd.name()) ?? [];
}

// =============================================================================
// Mocks
// =============================================================================

// Mock child_process
vi.mock("node:child_process", () => ({
  spawn: vi.fn(() => {
    const mockChild = {
      stdout: {
        on: vi.fn((event: string, callback: (data: Buffer) => void) => {
          if (event === "data") {
            callback(Buffer.from("mock output"));
          }
        }),
      },
      stderr: {
        on: vi.fn(),
      },
      on: vi.fn((event: string, callback: (code: number) => void) => {
        if (event === "close") {
          setTimeout(() => callback(0), 10);
        }
      }),
    };
    return mockChild;
  }),
  execSync: vi.fn(() => "mock output"),
}));

// Mock fs
vi.mock("node:fs", () => ({
  existsSync: vi.fn(() => true),
  readFileSync: vi.fn(() =>
    JSON.stringify({
      id: "test-task",
      name: "test-task",
      title: "Test Task",
      status: "plan",
      priority: "P2",
      created_at: "2024-03-03",
      current_phase: 0,
    })
  ),
  readdirSync: vi.fn(() => ["03-03-test-task"]),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
  statSync: vi.fn(() => ({ isDirectory: () => false })),
}));

// Mock chalk to avoid color codes in test output
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
    white: (s: string) => s,
    magenta: (s: string) => s,
  },
}));

// =============================================================================
// Tests
// =============================================================================

describe("task command", () => {
  let program: Command;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let logOutput: string[];
  let errorOutput: string[];

  beforeEach(() => {
    // Create a fresh program
    program = new Command();
    program.option("--json", "Output JSON format");
    program.option("--verbose", "Verbose output");
    program.option("--quiet", "Quiet mode");

    // Register the task command
    registerTaskCommand(program);

    // Capture console output
    logOutput = [];
    errorOutput = [];
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation((...args) => {
      logOutput.push(args.map(String).join(" "));
    });
    consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation((...args) => {
        errorOutput.push(args.map(String).join(" "));
      });
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    vi.clearAllMocks();
  });

  // ===========================================================================
  // Command Registration Tests
  // ===========================================================================

  describe("command registration", () => {
    it("should register task command with correct description", () => {
      const taskCmd = program.commands.find((cmd) => cmd.name() === "task");
      expect(taskCmd).toBeDefined();
      expect(taskCmd?.description()).toBe("Manage development tasks");
    });

    it("should register all CRUD subcommands", () => {
      const subcommands = getSubcommandNames(program, "task");
      expect(subcommands).toContain("list");
      expect(subcommands).toContain("create");
      expect(subcommands).toContain("view");
      expect(subcommands).toContain("edit");
      expect(subcommands).toContain("delete");
    });

    it("should register all status lifecycle subcommands", () => {
      const subcommands = getSubcommandNames(program, "task");
      expect(subcommands).toContain("start");
      expect(subcommands).toContain("finish");
      expect(subcommands).toContain("archive");
      expect(subcommands).toContain("list-archive");
    });

    it("should register all queue operation subcommands", () => {
      const subcommands = getSubcommandNames(program, "task");
      expect(subcommands).toContain("enqueue");
      expect(subcommands).toContain("dequeue");
      expect(subcommands).toContain("pause");
      expect(subcommands).toContain("resume");
    });

    it("should register all review operation subcommands", () => {
      const subcommands = getSubcommandNames(program, "task");
      expect(subcommands).toContain("review");
      expect(subcommands).toContain("approve");
      expect(subcommands).toContain("reject");
      expect(subcommands).toContain("retry");
    });

    it("should register cancel and stop (alias) subcommands", () => {
      const subcommands = getSubcommandNames(program, "task");
      expect(subcommands).toContain("cancel");
      expect(subcommands).toContain("stop");
    });

    it("should register all config subcommands", () => {
      const subcommands = getSubcommandNames(program, "task");
      expect(subcommands).toContain("set-branch");
      expect(subcommands).toContain("set-base");
      expect(subcommands).toContain("set-agent");
    });

    it("should register all context subcommands", () => {
      const subcommands = getSubcommandNames(program, "task");
      expect(subcommands).toContain("init-context");
      expect(subcommands).toContain("add-context");
      expect(subcommands).toContain("remove-context");
      expect(subcommands).toContain("list-context");
      expect(subcommands).toContain("validate-context");
      expect(subcommands).toContain("context");
    });

    it("should register session subcommand", () => {
      const subcommands = getSubcommandNames(program, "task");
      expect(subcommands).toContain("add-session");
    });

    it("should register all phase subcommands", () => {
      const subcommands = getSubcommandNames(program, "task");
      expect(subcommands).toContain("plan-phase");
      expect(subcommands).toContain("implement-phase");
      expect(subcommands).toContain("check-phase");
      expect(subcommands).toContain("work-phase");
    });

    it("should register worktree and cleanup subcommands", () => {
      const subcommands = getSubcommandNames(program, "task");
      expect(subcommands).toContain("create-worktree");
      expect(subcommands).toContain("cleanup");
      expect(subcommands).toContain("validate-check-phase-passed");
    });

    it("should register status and create-pr subcommands", () => {
      const subcommands = getSubcommandNames(program, "task");
      expect(subcommands).toContain("status");
      expect(subcommands).toContain("create-pr");
    });

    it("should handle multiple registrations gracefully", () => {
      // Verify that the command was registered once in beforeEach
      const taskCommands = program.commands.filter((cmd) => cmd.name() === "task");
      expect(taskCommands.length).toBe(1);
    });
  });

  // ===========================================================================
  // Task List Command Tests
  // ===========================================================================

  describe("task list", () => {
    it("should have correct description", () => {
      const listCmd = findSubcommand(program, "task", "list");
      expect(listCmd?.description()).toContain("List");
      expect(listCmd?.description()).toContain("task");
    });

    it("should support -m/--mine option with correct description", () => {
      const listCmd = findSubcommand(program, "task", "list");
      const mineOption = findOption(listCmd, "mine");
      expect(mineOption).toBeDefined();
      expect(mineOption?.short).toBe("-m");
      expect(mineOption?.description).toContain("assigned to current developer");
    });

    it("should support -s/--status option for filtering", () => {
      const listCmd = findSubcommand(program, "task", "list");
      const statusOption = findOption(listCmd, "status");
      expect(statusOption).toBeDefined();
      expect(statusOption?.short).toBe("-s");
    });

    it("should support --json option for JSON output", () => {
      const listCmd = findSubcommand(program, "task", "list");
      const jsonOption = findOption(listCmd, "json");
      expect(jsonOption).toBeDefined();
    });
  });

  // ===========================================================================
  // Task Create Command Tests
  // ===========================================================================

  describe("task create", () => {
    it("should have correct description", () => {
      const createCmd = findSubcommand(program, "task", "create");
      expect(createCmd?.description()).toBe("Create a new task");
    });

    it("should require title argument", () => {
      const createCmd = findSubcommand(program, "task", "create");
      const args = createCmd?.registeredArguments ?? [];
      expect(args.length).toBeGreaterThan(0);
      expect(args[0]?.name()).toBe("title");
      expect(args[0]?.required).toBe(true);
    });

    it("should support -s/--slug option for custom slug", () => {
      const createCmd = findSubcommand(program, "task", "create");
      const slugOption = findOption(createCmd, "slug");
      expect(slugOption).toBeDefined();
      expect(slugOption?.short).toBe("-s");
    });

    it("should support -b/--branch option for custom branch name", () => {
      const createCmd = findSubcommand(program, "task", "create");
      const branchOption = findOption(createCmd, "branch");
      expect(branchOption).toBeDefined();
      expect(branchOption?.short).toBe("-b");
    });

    it("should support -a/--assignee option", () => {
      const createCmd = findSubcommand(program, "task", "create");
      const assigneeOption = findOption(createCmd, "assignee");
      expect(assigneeOption).toBeDefined();
      expect(assigneeOption?.short).toBe("-a");
    });

    it("should support -p/--priority option with default medium", () => {
      const createCmd = findSubcommand(program, "task", "create");
      const priorityOption = findOption(createCmd, "priority");
      expect(priorityOption).toBeDefined();
      expect(priorityOption?.short).toBe("-p");
      expect(priorityOption?.defaultValue).toBe("medium");
    });

    it("should support -d/--description option", () => {
      const createCmd = findSubcommand(program, "task", "create");
      const descOption = findOption(createCmd, "description");
      expect(descOption).toBeDefined();
      expect(descOption?.short).toBe("-d");
    });

    it("should support --agent option for agent configuration", () => {
      const createCmd = findSubcommand(program, "task", "create");
      const agentOption = findOption(createCmd, "agent");
      expect(agentOption).toBeDefined();
    });

    it("should support --executor option for executor type", () => {
      const createCmd = findSubcommand(program, "task", "create");
      const executorOption = findOption(createCmd, "executor");
      expect(executorOption).toBeDefined();
    });

    it("should support --model option for model selection", () => {
      const createCmd = findSubcommand(program, "task", "create");
      const modelOption = findOption(createCmd, "model");
      expect(modelOption).toBeDefined();
    });

    it("should support --start option to auto-queue task", () => {
      const createCmd = findSubcommand(program, "task", "create");
      const startOption = findOption(createCmd, "start");
      expect(startOption).toBeDefined();
    });

    it("should support --worktree option for isolated development", () => {
      const createCmd = findSubcommand(program, "task", "create");
      const worktreeOption = findOption(createCmd, "worktree");
      expect(worktreeOption).toBeDefined();
    });
  });

  // ===========================================================================
  // Task Start Command Tests
  // ===========================================================================

  describe("task start", () => {
    it("should have correct description", () => {
      const startCmd = findSubcommand(program, "task", "start");
      expect(startCmd?.description()).toContain("Start task execution");
    });

    it("should require task argument", () => {
      const startCmd = findSubcommand(program, "task", "start");
      const args = startCmd?.registeredArguments ?? [];
      expect(args.length).toBeGreaterThan(0);
      expect(args[0]?.name()).toBe("task");
      expect(args[0]?.required).toBe(true);
    });

    it("should support --executor option", () => {
      const startCmd = findSubcommand(program, "task", "start");
      const executorOption = findOption(startCmd, "executor");
      expect(executorOption).toBeDefined();
    });

    it("should support --detach option for background execution", () => {
      const startCmd = findSubcommand(program, "task", "start");
      const detachOption = findOption(startCmd, "detach");
      expect(detachOption).toBeDefined();
    });

    it("should support --worktree option", () => {
      const startCmd = findSubcommand(program, "task", "start");
      const worktreeOption = findOption(startCmd, "worktree");
      expect(worktreeOption).toBeDefined();
    });

    it("should support --resume option to resume existing session", () => {
      const startCmd = findSubcommand(program, "task", "start");
      const resumeOption = findOption(startCmd, "resume");
      expect(resumeOption).toBeDefined();
    });

    it("should support --session option to specify session ID", () => {
      const startCmd = findSubcommand(program, "task", "start");
      const sessionOption = findOption(startCmd, "session");
      expect(sessionOption).toBeDefined();
    });
  });

  // ===========================================================================
  // Task Enqueue Command Tests
  // ===========================================================================

  describe("task enqueue", () => {
    it("should have correct description", () => {
      const enqueueCmd = findSubcommand(program, "task", "enqueue");
      expect(enqueueCmd?.description()).toContain("backlog");
      expect(enqueueCmd?.description()).toContain("queue");
    });

    it("should require task argument", () => {
      const enqueueCmd = findSubcommand(program, "task", "enqueue");
      const args = enqueueCmd?.registeredArguments ?? [];
      expect(args.length).toBeGreaterThan(0);
      expect(args[0]?.name()).toBe("task");
    });

    it("should support --agent option", () => {
      const enqueueCmd = findSubcommand(program, "task", "enqueue");
      const agentOption = findOption(enqueueCmd, "agent");
      expect(agentOption).toBeDefined();
    });

    it("should support --executor option", () => {
      const enqueueCmd = findSubcommand(program, "task", "enqueue");
      const executorOption = findOption(enqueueCmd, "executor");
      expect(executorOption).toBeDefined();
    });

    it("should support --model option", () => {
      const enqueueCmd = findSubcommand(program, "task", "enqueue");
      const modelOption = findOption(enqueueCmd, "model");
      expect(modelOption).toBeDefined();
    });

    it("should support --priority option", () => {
      const enqueueCmd = findSubcommand(program, "task", "enqueue");
      const priorityOption = findOption(enqueueCmd, "priority");
      expect(priorityOption).toBeDefined();
    });
  });

  // ===========================================================================
  // Task Cancel/Stop Command Tests
  // ===========================================================================

  describe("task cancel", () => {
    it("should have correct description", () => {
      const cancelCmd = findSubcommand(program, "task", "cancel");
      expect(cancelCmd?.description()).toContain("Cancel");
    });

    it("should require task argument", () => {
      const cancelCmd = findSubcommand(program, "task", "cancel");
      const args = cancelCmd?.registeredArguments ?? [];
      expect(args.length).toBeGreaterThan(0);
      expect(args[0]?.name()).toBe("task");
    });

    it("should support --reason option", () => {
      const cancelCmd = findSubcommand(program, "task", "cancel");
      const reasonOption = findOption(cancelCmd, "reason");
      expect(reasonOption).toBeDefined();
    });

    it("should support -f/--force option for cancelling running tasks", () => {
      const cancelCmd = findSubcommand(program, "task", "cancel");
      const forceOption = findOption(cancelCmd, "force");
      expect(forceOption).toBeDefined();
      expect(forceOption?.short).toBe("-f");
    });
  });

  describe("task stop (alias)", () => {
    it("should exist as alias for cancel", () => {
      const stopCmd = findSubcommand(program, "task", "stop");
      expect(stopCmd).toBeDefined();
      expect(stopCmd?.description()).toContain("alias");
    });

    it("should have same options as cancel", () => {
      const stopCmd = findSubcommand(program, "task", "stop");
      const reasonOption = findOption(stopCmd, "reason");
      const forceOption = findOption(stopCmd, "force");
      expect(reasonOption).toBeDefined();
      expect(forceOption).toBeDefined();
    });
  });

  // ===========================================================================
  // Task Reject Command Tests
  // ===========================================================================

  describe("task reject", () => {
    it("should have correct description", () => {
      const rejectCmd = findSubcommand(program, "task", "reject");
      expect(rejectCmd?.description()).toContain("Reject");
    });

    it("should require task argument", () => {
      const rejectCmd = findSubcommand(program, "task", "reject");
      const args = rejectCmd?.registeredArguments ?? [];
      expect(args.length).toBeGreaterThan(0);
      expect(args[0]?.name()).toBe("task");
    });

    it("should support --reason option for rejection reason", () => {
      const rejectCmd = findSubcommand(program, "task", "reject");
      const reasonOption = findOption(rejectCmd, "reason");
      expect(reasonOption).toBeDefined();
    });
  });

  // ===========================================================================
  // Task Context Command Tests
  // ===========================================================================

  describe("task context commands", () => {
    it("init-context should have correct description", () => {
      const initCmd = findSubcommand(program, "task", "init-context");
      expect(initCmd).toBeDefined();
      expect(initCmd?.description()).toContain("context");
    });

    it("add-context should support -r/--reason option", () => {
      const addCmd = findSubcommand(program, "task", "add-context");
      const reasonOption = findOption(addCmd, "reason");
      expect(reasonOption).toBeDefined();
      expect(reasonOption?.short).toBe("-r");
    });

    it("add-context should support --recursive option", () => {
      const addCmd = findSubcommand(program, "task", "add-context");
      const recursiveOption = findOption(addCmd, "recursive");
      expect(recursiveOption).toBeDefined();
    });

    it("context command should exist for getting context", () => {
      const contextCmd = findSubcommand(program, "task", "context");
      expect(contextCmd).toBeDefined();
      expect(contextCmd?.description()).toContain("context");
    });

    it("context command should support --json option", () => {
      const contextCmd = findSubcommand(program, "task", "context");
      const jsonOption = findOption(contextCmd, "json");
      expect(jsonOption).toBeDefined();
    });
  });

  // ===========================================================================
  // Task Add-Session Command Tests
  // ===========================================================================

  describe("task add-session", () => {
    it("should have correct description", () => {
      const addSessionCmd = findSubcommand(program, "task", "add-session");
      expect(addSessionCmd).toBeDefined();
      expect(addSessionCmd?.description()).toContain("session");
    });

    it("should support --title option", () => {
      const addSessionCmd = findSubcommand(program, "task", "add-session");
      const titleOption = findOption(addSessionCmd, "title");
      expect(titleOption).toBeDefined();
    });

    it("should support --commit option", () => {
      const addSessionCmd = findSubcommand(program, "task", "add-session");
      const commitOption = findOption(addSessionCmd, "commit");
      expect(commitOption).toBeDefined();
    });

    it("should support --summary option", () => {
      const addSessionCmd = findSubcommand(program, "task", "add-session");
      const summaryOption = findOption(addSessionCmd, "summary");
      expect(summaryOption).toBeDefined();
    });
  });

  // ===========================================================================
  // Task Config Commands Tests
  // ===========================================================================

  describe("task config commands", () => {
    it("set-branch should require --branch option", () => {
      const setBranchCmd = findSubcommand(program, "task", "set-branch");
      const branchOption = findOption(setBranchCmd, "branch");
      expect(branchOption).toBeDefined();
      expect(branchOption?.required).toBe(true);
    });

    it("set-base should require --branch option", () => {
      const setBaseCmd = findSubcommand(program, "task", "set-base");
      const branchOption = findOption(setBaseCmd, "branch");
      expect(branchOption).toBeDefined();
      expect(branchOption?.required).toBe(true);
    });

    it("set-agent should require --agent option", () => {
      const setAgentCmd = findSubcommand(program, "task", "set-agent");
      const agentOption = findOption(setAgentCmd, "agent");
      expect(agentOption).toBeDefined();
      expect(agentOption?.required).toBe(true);
    });
  });

  // ===========================================================================
  // Task Status Command Tests
  // ===========================================================================

  describe("task status", () => {
    it("should have correct description", () => {
      const statusCmd = findSubcommand(program, "task", "status");
      expect(statusCmd?.description()).toContain("status");
    });

    it("should support --detail option", () => {
      const statusCmd = findSubcommand(program, "task", "status");
      const detailOption = findOption(statusCmd, "detail");
      expect(detailOption).toBeDefined();
    });

    it("should support --watch option", () => {
      const statusCmd = findSubcommand(program, "task", "status");
      const watchOption = findOption(statusCmd, "watch");
      expect(watchOption).toBeDefined();
    });

    it("should support --log option", () => {
      const statusCmd = findSubcommand(program, "task", "status");
      const logOption = findOption(statusCmd, "log");
      expect(logOption).toBeDefined();
    });

    it("should support --running option", () => {
      const statusCmd = findSubcommand(program, "task", "status");
      const runningOption = findOption(statusCmd, "running");
      expect(runningOption).toBeDefined();
    });

    it("should support --list option", () => {
      const statusCmd = findSubcommand(program, "task", "status");
      const listOption = findOption(statusCmd, "list");
      expect(listOption).toBeDefined();
    });

    it("should support --registry option", () => {
      const statusCmd = findSubcommand(program, "task", "status");
      const registryOption = findOption(statusCmd, "registry");
      expect(registryOption).toBeDefined();
    });
  });

  // ===========================================================================
  // Task Create-PR Command Tests
  // ===========================================================================

  describe("task create-pr", () => {
    it("should have correct description", () => {
      const createPrCmd = findSubcommand(program, "task", "create-pr");
      expect(createPrCmd?.description()).toContain("PR");
    });

    it("should require task argument", () => {
      const createPrCmd = findSubcommand(program, "task", "create-pr");
      const args = createPrCmd?.registeredArguments ?? [];
      expect(args.length).toBeGreaterThan(0);
      expect(args[0]?.name()).toBe("task");
      expect(args[0]?.required).toBe(true);
    });

    it("should support --dry-run option", () => {
      const createPrCmd = findSubcommand(program, "task", "create-pr");
      const dryRunOption = findOption(createPrCmd, "dry-run");
      expect(dryRunOption).toBeDefined();
    });
  });

  // ===========================================================================
  // Task Phase Commands Tests
  // ===========================================================================

  describe("task phase commands", () => {
    it("plan-phase should have correct description", () => {
      const planPhaseCmd = findSubcommand(program, "task", "plan-phase");
      expect(planPhaseCmd).toBeDefined();
      expect(planPhaseCmd?.description()).toContain("plan");
    });

    it("implement-phase should have correct description", () => {
      const implementPhaseCmd = findSubcommand(program, "task", "implement-phase");
      expect(implementPhaseCmd).toBeDefined();
      expect(implementPhaseCmd?.description()).toContain("implement");
    });

    it("check-phase should have correct description", () => {
      const checkPhaseCmd = findSubcommand(program, "task", "check-phase");
      expect(checkPhaseCmd).toBeDefined();
      expect(checkPhaseCmd?.description()).toContain("check");
    });

    it("work-phase should have correct description", () => {
      const workPhaseCmd = findSubcommand(program, "task", "work-phase");
      expect(workPhaseCmd).toBeDefined();
      expect(workPhaseCmd?.description()).toContain("work");
    });

    it("work-phase should support --platform option", () => {
      const workPhaseCmd = findSubcommand(program, "task", "work-phase");
      const platformOption = findOption(workPhaseCmd, "platform");
      expect(platformOption).toBeDefined();
      expect(platformOption?.short).toBe("-p");
    });

    it("work-phase should support --no-detach option", () => {
      const workPhaseCmd = findSubcommand(program, "task", "work-phase");
      const noDetachOption = workPhaseCmd?.options.find(
        (opt) => opt.long === "--no-detach"
      );
      expect(noDetachOption).toBeDefined();
    });
  });

  // ===========================================================================
  // Task Worktree Commands Tests
  // ===========================================================================

  describe("task worktree commands", () => {
    it("create-worktree should require task argument", () => {
      const createWorktreeCmd = findSubcommand(program, "task", "create-worktree");
      expect(createWorktreeCmd).toBeDefined();
      const args = createWorktreeCmd?.registeredArguments ?? [];
      expect(args.length).toBeGreaterThan(0);
      expect(args[0]?.name()).toBe("task");
    });

    it("validate-check-phase-passed should exist", () => {
      const validateCmd = findSubcommand(program, "task", "validate-check-phase-passed");
      expect(validateCmd).toBeDefined();
    });
  });

  // ===========================================================================
  // Task Cleanup Command Tests
  // ===========================================================================

  describe("task cleanup", () => {
    it("should have correct description", () => {
      const cleanupCmd = findSubcommand(program, "task", "cleanup");
      expect(cleanupCmd?.description()).toBe("Cleanup worktrees and related resources");
    });

    it("should support optional branch argument", () => {
      const cleanupCmd = findSubcommand(program, "task", "cleanup");
      const args = cleanupCmd?.registeredArguments ?? [];
      expect(args.length).toBeGreaterThan(0);
      expect(args[0]?.name()).toBe("branch");
      expect(args[0]?.required).toBe(false);
    });

    it("should support --keep-branch option", () => {
      const cleanupCmd = findSubcommand(program, "task", "cleanup");
      const keepBranchOption = findOption(cleanupCmd, "keep-branch");
      expect(keepBranchOption).toBeDefined();
    });

    it("should support -y/--yes option for auto-confirm", () => {
      const cleanupCmd = findSubcommand(program, "task", "cleanup");
      const yesOption = findOption(cleanupCmd, "yes");
      expect(yesOption).toBeDefined();
      expect(yesOption?.short).toBe("-y");
    });

    it("should support --merged option for cleaning merged worktrees", () => {
      const cleanupCmd = findSubcommand(program, "task", "cleanup");
      const mergedOption = findOption(cleanupCmd, "merged");
      expect(mergedOption).toBeDefined();
    });

    it("should support --all option for cleaning all worktrees", () => {
      const cleanupCmd = findSubcommand(program, "task", "cleanup");
      const allOption = findOption(cleanupCmd, "all");
      expect(allOption).toBeDefined();
    });

    it("should support --list option for listing worktrees", () => {
      const cleanupCmd = findSubcommand(program, "task", "cleanup");
      const listOption = findOption(cleanupCmd, "list");
      expect(listOption).toBeDefined();
    });
  });

  // ===========================================================================
  // validateStatusTransition Tests
  // ===========================================================================

  describe("validateStatusTransition", () => {
    // Note: These tests are for the validateStatusTransition utility function
    // from viben-workspace. They are included here for convenience but could
    // be moved to cli/lib/viben-workspace.test.ts in the future.

    let validateStatusTransition: (
      currentStatus: string,
      targetStatus: string,
      eventType: TaskEventType
    ) => { valid: boolean; error?: string };

    beforeEach(async () => {
      const module = await import("../lib/viben-workspace");
      validateStatusTransition = module.validateStatusTransition;
    });

    describe("valid transitions", () => {
      it("should allow QUEUE from backlog to queue", () => {
        expect(validateStatusTransition("backlog", "queue", "QUEUE")).toEqual({
          valid: true,
        });
      });

      it("should allow START from queue to in_progress", () => {
        expect(validateStatusTransition("queue", "in_progress", "START")).toEqual({
          valid: true,
        });
      });

      it("should allow DEQUEUE from queue to backlog", () => {
        expect(validateStatusTransition("queue", "backlog", "DEQUEUE")).toEqual({
          valid: true,
        });
      });

      it("should allow PAUSE from in_progress to paused", () => {
        expect(validateStatusTransition("in_progress", "paused", "PAUSE")).toEqual({
          valid: true,
        });
      });

      it("should allow PAUSE from queue to paused", () => {
        expect(validateStatusTransition("queue", "paused", "PAUSE")).toEqual({
          valid: true,
        });
      });

      it("should allow RESUME from paused (dynamic target)", () => {
        expect(validateStatusTransition("paused", "queue", "RESUME")).toEqual({
          valid: true,
        });
        expect(validateStatusTransition("paused", "in_progress", "RESUME")).toEqual({
          valid: true,
        });
      });

      it("should allow APPROVED from review to completed", () => {
        expect(validateStatusTransition("review", "completed", "APPROVED")).toEqual({
          valid: true,
        });
      });

      it("should allow REJECTED from review to backlog", () => {
        expect(validateStatusTransition("review", "backlog", "REJECTED")).toEqual({
          valid: true,
        });
      });

      it("should allow RETRY from failed to queue", () => {
        expect(validateStatusTransition("failed", "queue", "RETRY")).toEqual({
          valid: true,
        });
      });

      it("should allow CANCEL from multiple states", () => {
        expect(validateStatusTransition("backlog", "cancelled", "CANCEL")).toEqual({
          valid: true,
        });
        expect(validateStatusTransition("queue", "cancelled", "CANCEL")).toEqual({
          valid: true,
        });
        expect(validateStatusTransition("paused", "cancelled", "CANCEL")).toEqual({
          valid: true,
        });
        expect(validateStatusTransition("in_progress", "cancelled", "CANCEL")).toEqual({
          valid: true,
        });
        expect(validateStatusTransition("review", "cancelled", "CANCEL")).toEqual({
          valid: true,
        });
      });
    });

    describe("invalid transitions - wrong source state", () => {
      it("should reject QUEUE from non-backlog states", () => {
        const result1 = validateStatusTransition("in_progress", "queue", "QUEUE");
        expect(result1.valid).toBe(false);
        expect(result1.error).toContain("Cannot queue task in 'in_progress'");

        const result2 = validateStatusTransition("completed", "queue", "QUEUE");
        expect(result2.valid).toBe(false);

        const result3 = validateStatusTransition("queue", "queue", "QUEUE");
        expect(result3.valid).toBe(false);
      });

      it("should reject START from non-queue states", () => {
        const result1 = validateStatusTransition("backlog", "in_progress", "START");
        expect(result1.valid).toBe(false);
        expect(result1.error).toContain("Cannot start task in 'backlog'");

        const result2 = validateStatusTransition("in_progress", "in_progress", "START");
        expect(result2.valid).toBe(false);

        const result3 = validateStatusTransition("completed", "in_progress", "START");
        expect(result3.valid).toBe(false);
      });

      it("should reject DEQUEUE from non-queue states", () => {
        const result1 = validateStatusTransition("backlog", "backlog", "DEQUEUE");
        expect(result1.valid).toBe(false);
        expect(result1.error).toContain("Cannot dequeue task in 'backlog'");

        const result2 = validateStatusTransition("in_progress", "backlog", "DEQUEUE");
        expect(result2.valid).toBe(false);
      });

      it("should reject PAUSE from terminal or backlog states", () => {
        const result1 = validateStatusTransition("backlog", "paused", "PAUSE");
        expect(result1.valid).toBe(false);
        expect(result1.error).toContain("Cannot pause task in 'backlog'");

        const result2 = validateStatusTransition("completed", "paused", "PAUSE");
        expect(result2.valid).toBe(false);

        const result3 = validateStatusTransition("cancelled", "paused", "PAUSE");
        expect(result3.valid).toBe(false);

        const result4 = validateStatusTransition("failed", "paused", "PAUSE");
        expect(result4.valid).toBe(false);
      });

      it("should reject RESUME from non-paused states", () => {
        const result1 = validateStatusTransition("queue", "in_progress", "RESUME");
        expect(result1.valid).toBe(false);
        expect(result1.error).toContain("Cannot resume task in 'queue'");

        const result2 = validateStatusTransition("backlog", "queue", "RESUME");
        expect(result2.valid).toBe(false);

        const result3 = validateStatusTransition("in_progress", "in_progress", "RESUME");
        expect(result3.valid).toBe(false);
      });

      it("should reject APPROVED from non-review states", () => {
        const result1 = validateStatusTransition("backlog", "completed", "APPROVED");
        expect(result1.valid).toBe(false);
        expect(result1.error).toContain("Cannot approved task in 'backlog'");

        const result2 = validateStatusTransition("completed", "completed", "APPROVED");
        expect(result2.valid).toBe(false);

        const result3 = validateStatusTransition("queue", "completed", "APPROVED");
        expect(result3.valid).toBe(false);
      });

      it("should reject REJECTED from non-review states", () => {
        const result1 = validateStatusTransition("queue", "backlog", "REJECTED");
        expect(result1.valid).toBe(false);
        expect(result1.error).toContain("Cannot rejected task in 'queue'");

        const result2 = validateStatusTransition("backlog", "backlog", "REJECTED");
        expect(result2.valid).toBe(false);
      });

      it("should reject RETRY from non-failed states", () => {
        const result1 = validateStatusTransition("queue", "queue", "RETRY");
        expect(result1.valid).toBe(false);
        expect(result1.error).toContain("Cannot retry task in 'queue'");

        const result2 = validateStatusTransition("backlog", "queue", "RETRY");
        expect(result2.valid).toBe(false);

        const result3 = validateStatusTransition("completed", "queue", "RETRY");
        expect(result3.valid).toBe(false);
      });

      it("should reject CANCEL from terminal states", () => {
        const result1 = validateStatusTransition("completed", "cancelled", "CANCEL");
        expect(result1.valid).toBe(false);

        const result2 = validateStatusTransition("cancelled", "cancelled", "CANCEL");
        expect(result2.valid).toBe(false);

        const result3 = validateStatusTransition("failed", "cancelled", "CANCEL");
        expect(result3.valid).toBe(false);
      });
    });

    describe("invalid transitions - wrong target state", () => {
      it("should reject incorrect target for QUEUE", () => {
        const result = validateStatusTransition("backlog", "in_progress", "QUEUE");
        expect(result.valid).toBe(false);
        expect(result.error).toContain("Expected: queue");
      });

      it("should reject incorrect target for START", () => {
        const result = validateStatusTransition("queue", "queue", "START");
        expect(result.valid).toBe(false);
        expect(result.error).toContain("Expected: in_progress");
      });

      it("should reject incorrect target for DEQUEUE", () => {
        const result = validateStatusTransition("queue", "queue", "DEQUEUE");
        expect(result.valid).toBe(false);
        expect(result.error).toContain("Expected: backlog");
      });

      it("should reject incorrect target for APPROVED", () => {
        const result = validateStatusTransition("review", "queue", "APPROVED");
        expect(result.valid).toBe(false);
        expect(result.error).toContain("Expected: completed");
      });

      it("should reject incorrect target for REJECTED", () => {
        const result = validateStatusTransition("review", "completed", "REJECTED");
        expect(result.valid).toBe(false);
        expect(result.error).toContain("Expected: backlog");
      });

      it("should reject incorrect target for RETRY", () => {
        const result = validateStatusTransition("failed", "backlog", "RETRY");
        expect(result.valid).toBe(false);
        expect(result.error).toContain("Expected: queue");
      });

      it("should reject incorrect target for CANCEL", () => {
        const result = validateStatusTransition("backlog", "completed", "CANCEL");
        expect(result.valid).toBe(false);
        expect(result.error).toContain("Expected: cancelled");
      });

      it("should skip target validation for RESUME (dynamic target)", () => {
        // RESUME allows any target since it restores from pausedSnapshot
        expect(validateStatusTransition("paused", "queue", "RESUME")).toEqual({
          valid: true,
        });
        expect(validateStatusTransition("paused", "in_progress", "RESUME")).toEqual({
          valid: true,
        });
        expect(validateStatusTransition("paused", "backlog", "RESUME")).toEqual({
          valid: true,
        });
      });
    });

    describe("unsupported event types", () => {
      it("should reject unknown event types", () => {
        const result = validateStatusTransition(
          "backlog",
          "queue",
          "INVALID_EVENT" as any
        );
        expect(result.valid).toBe(false);
        expect(result.error).toContain("Unsupported event type for CLI");
      });

      it("should reject internal state machine events not exposed to CLI", () => {
        const internalEvents = [
          "PLAN_COMPLETE",
          "PLAN_FAILED",
          "SUBTASK_COMPLETE",
          "ALL_SUBTASKS_DONE",
          "IMPLEMENT_FAILED",
          "CHECK_PASSED",
          "CHECK_FAILED",
        ];

        for (const event of internalEvents) {
          const result = validateStatusTransition("in_progress", "queue", event as any);
          expect(result.valid).toBe(false);
          expect(result.error).toContain("Unsupported event type for CLI");
        }
      });
    });

    describe("edge cases", () => {
      it("should handle empty string status", () => {
        const result1 = validateStatusTransition("", "queue", "QUEUE");
        expect(result1.valid).toBe(false);

        const result2 = validateStatusTransition("backlog", "", "QUEUE");
        expect(result2.valid).toBe(false);
      });

      it("should be case-sensitive for status values", () => {
        const result1 = validateStatusTransition("BACKLOG", "queue", "QUEUE");
        expect(result1.valid).toBe(false);

        const result2 = validateStatusTransition("backlog", "QUEUE", "QUEUE");
        expect(result2.valid).toBe(false);
      });

      it("should reject status values with whitespace", () => {
        const result1 = validateStatusTransition(" backlog", "queue", "QUEUE");
        expect(result1.valid).toBe(false);

        const result2 = validateStatusTransition("backlog ", "queue", "QUEUE");
        expect(result2.valid).toBe(false);

        const result3 = validateStatusTransition("backlog", " queue", "QUEUE");
        expect(result3.valid).toBe(false);
      });

      it("should reject invalid status names", () => {
        const result1 = validateStatusTransition("invalid_status", "queue", "QUEUE");
        expect(result1.valid).toBe(false);

        const result2 = validateStatusTransition("backlog", "invalid_target", "QUEUE");
        expect(result2.valid).toBe(false);
      });
    });
  });
});
