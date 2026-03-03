/**
 * Task Command Tests
 *
 * Tests for task CLI commands:
 * - task list: List all tasks
 * - task create: Create a new task
 * - task view: View task details
 * - task edit: Edit task
 * - task delete: Delete task
 * - task start: Start task
 * - task finish: Finish task
 * - task archive: Archive task
 * - task list-archive: List archived tasks
 * - task set-branch: Set branch
 * - task set-base: Set base branch
 * - task set-scope: Set scope
 * - task set-agent: Set agent
 * - task init-context: Initialize context
 * - task add-context: Add context
 * - task remove-context: Remove context
 * - task list-context: List context
 * - task validate-context: Validate context
 * - task plan: Plan task
 * - task status: Show task status
 * - task create-pr: Create PR
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Command } from "commander";
import { registerTaskCommand } from "./task";

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
      status: "planning",
      priority: "P2",
      createdAt: "2024-03-03",
      current_phase: 0,
    })
  ),
  readdirSync: vi.fn(() => ["03-03-test-task"]),
  writeFileSync: vi.fn(),
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
  },
}));

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

  describe("command registration", () => {
    it("should register task command with all subcommands", () => {
      const taskCmd = program.commands.find((cmd) => cmd.name() === "task");
      expect(taskCmd).toBeDefined();

      const subcommandNames = taskCmd?.commands.map((cmd) => cmd.name()) ?? [];

      // CRUD
      expect(subcommandNames).toContain("list");
      expect(subcommandNames).toContain("create");
      expect(subcommandNames).toContain("view");
      expect(subcommandNames).toContain("edit");
      expect(subcommandNames).toContain("delete");

      // Status
      expect(subcommandNames).toContain("start");
      expect(subcommandNames).toContain("finish");
      expect(subcommandNames).toContain("archive");
      expect(subcommandNames).toContain("list-archive");

      // Config
      expect(subcommandNames).toContain("set-branch");
      expect(subcommandNames).toContain("set-base");
      expect(subcommandNames).toContain("set-scope");
      expect(subcommandNames).toContain("set-agent");

      // Context
      expect(subcommandNames).toContain("init-context");
      expect(subcommandNames).toContain("add-context");
      expect(subcommandNames).toContain("remove-context");
      expect(subcommandNames).toContain("list-context");
      expect(subcommandNames).toContain("validate-context");

      // Planning
      expect(subcommandNames).toContain("plan");
      expect(subcommandNames).toContain("status");
      expect(subcommandNames).toContain("create-pr");
    });

    it("should have correct description for task command", () => {
      const taskCmd = program.commands.find((cmd) => cmd.name() === "task");
      expect(taskCmd?.description()).toBe("Manage development tasks");
    });
  });

  describe("task list", () => {
    it("should support --mine option", () => {
      const taskCmd = program.commands.find((cmd) => cmd.name() === "task");
      const listCmd = taskCmd?.commands.find((cmd) => cmd.name() === "list");
      const options = listCmd?.options ?? [];
      const mineOption = options.find((opt) => opt.long === "--mine");
      expect(mineOption).toBeDefined();
    });

    it("should support --status option", () => {
      const taskCmd = program.commands.find((cmd) => cmd.name() === "task");
      const listCmd = taskCmd?.commands.find((cmd) => cmd.name() === "list");
      const options = listCmd?.options ?? [];
      const statusOption = options.find((opt) => opt.long === "--status");
      expect(statusOption).toBeDefined();
    });

    it("should support --json option", () => {
      const taskCmd = program.commands.find((cmd) => cmd.name() === "task");
      const listCmd = taskCmd?.commands.find((cmd) => cmd.name() === "list");
      const options = listCmd?.options ?? [];
      const jsonOption = options.find((opt) => opt.long === "--json");
      expect(jsonOption).toBeDefined();
    });
  });

  describe("task create", () => {
    it("should require title argument", () => {
      const taskCmd = program.commands.find((cmd) => cmd.name() === "task");
      const createCmd = taskCmd?.commands.find(
        (cmd) => cmd.name() === "create"
      );
      const args = createCmd?.registeredArguments ?? [];
      expect(args.length).toBeGreaterThan(0);
      expect(args[0]?.name()).toBe("title");
      expect(args[0]?.required).toBe(true);
    });

    it("should support --slug option", () => {
      const taskCmd = program.commands.find((cmd) => cmd.name() === "task");
      const createCmd = taskCmd?.commands.find(
        (cmd) => cmd.name() === "create"
      );
      const options = createCmd?.options ?? [];
      const slugOption = options.find((opt) => opt.long === "--slug");
      expect(slugOption).toBeDefined();
    });

    it("should support --assignee option", () => {
      const taskCmd = program.commands.find((cmd) => cmd.name() === "task");
      const createCmd = taskCmd?.commands.find(
        (cmd) => cmd.name() === "create"
      );
      const options = createCmd?.options ?? [];
      const assigneeOption = options.find((opt) => opt.long === "--assignee");
      expect(assigneeOption).toBeDefined();
    });

    it("should support --priority option with default P2", () => {
      const taskCmd = program.commands.find((cmd) => cmd.name() === "task");
      const createCmd = taskCmd?.commands.find(
        (cmd) => cmd.name() === "create"
      );
      const options = createCmd?.options ?? [];
      const priorityOption = options.find((opt) => opt.long === "--priority");
      expect(priorityOption).toBeDefined();
      expect(priorityOption?.defaultValue).toBe("P2");
    });
  });

  describe("task status", () => {
    it("should support --detail option", () => {
      const taskCmd = program.commands.find((cmd) => cmd.name() === "task");
      const statusCmd = taskCmd?.commands.find(
        (cmd) => cmd.name() === "status"
      );
      const options = statusCmd?.options ?? [];
      const detailOption = options.find((opt) => opt.long === "--detail");
      expect(detailOption).toBeDefined();
    });

    it("should support --watch option", () => {
      const taskCmd = program.commands.find((cmd) => cmd.name() === "task");
      const statusCmd = taskCmd?.commands.find(
        (cmd) => cmd.name() === "status"
      );
      const options = statusCmd?.options ?? [];
      const watchOption = options.find((opt) => opt.long === "--watch");
      expect(watchOption).toBeDefined();
    });

    it("should support --running option", () => {
      const taskCmd = program.commands.find((cmd) => cmd.name() === "task");
      const statusCmd = taskCmd?.commands.find(
        (cmd) => cmd.name() === "status"
      );
      const options = statusCmd?.options ?? [];
      const runningOption = options.find((opt) => opt.long === "--running");
      expect(runningOption).toBeDefined();
    });
  });

  describe("task plan", () => {
    it("should require --name option", () => {
      const taskCmd = program.commands.find((cmd) => cmd.name() === "task");
      const planCmd = taskCmd?.commands.find((cmd) => cmd.name() === "plan");
      const options = planCmd?.options ?? [];
      const nameOption = options.find((opt) => opt.long === "--name");
      expect(nameOption).toBeDefined();
      expect(nameOption?.required).toBe(true);
    });

    it("should require --type option", () => {
      const taskCmd = program.commands.find((cmd) => cmd.name() === "task");
      const planCmd = taskCmd?.commands.find((cmd) => cmd.name() === "plan");
      const options = planCmd?.options ?? [];
      const typeOption = options.find((opt) => opt.long === "--type");
      expect(typeOption).toBeDefined();
      expect(typeOption?.required).toBe(true);
    });

    it("should require --requirement option", () => {
      const taskCmd = program.commands.find((cmd) => cmd.name() === "task");
      const planCmd = taskCmd?.commands.find((cmd) => cmd.name() === "plan");
      const options = planCmd?.options ?? [];
      const reqOption = options.find((opt) => opt.long === "--requirement");
      expect(reqOption).toBeDefined();
      expect(reqOption?.required).toBe(true);
    });
  });

  describe("task context commands", () => {
    it("init-context should require --type option", () => {
      const taskCmd = program.commands.find((cmd) => cmd.name() === "task");
      const initCmd = taskCmd?.commands.find(
        (cmd) => cmd.name() === "init-context"
      );
      const options = initCmd?.options ?? [];
      const typeOption = options.find((opt) => opt.long === "--type");
      expect(typeOption).toBeDefined();
      expect(typeOption?.required).toBe(true);
    });

    it("add-context should support --reason option", () => {
      const taskCmd = program.commands.find((cmd) => cmd.name() === "task");
      const addCmd = taskCmd?.commands.find(
        (cmd) => cmd.name() === "add-context"
      );
      const options = addCmd?.options ?? [];
      const reasonOption = options.find((opt) => opt.long === "--reason");
      expect(reasonOption).toBeDefined();
    });

    it("add-context should support --recursive option", () => {
      const taskCmd = program.commands.find((cmd) => cmd.name() === "task");
      const addCmd = taskCmd?.commands.find(
        (cmd) => cmd.name() === "add-context"
      );
      const options = addCmd?.options ?? [];
      const recursiveOption = options.find((opt) => opt.long === "--recursive");
      expect(recursiveOption).toBeDefined();
    });
  });

  describe("task config commands", () => {
    it("set-branch should require --branch option", () => {
      const taskCmd = program.commands.find((cmd) => cmd.name() === "task");
      const setBranchCmd = taskCmd?.commands.find(
        (cmd) => cmd.name() === "set-branch"
      );
      const options = setBranchCmd?.options ?? [];
      const branchOption = options.find((opt) => opt.long === "--branch");
      expect(branchOption).toBeDefined();
      expect(branchOption?.required).toBe(true);
    });

    it("set-base should require --branch option", () => {
      const taskCmd = program.commands.find((cmd) => cmd.name() === "task");
      const setBaseCmd = taskCmd?.commands.find(
        (cmd) => cmd.name() === "set-base"
      );
      const options = setBaseCmd?.options ?? [];
      const branchOption = options.find((opt) => opt.long === "--branch");
      expect(branchOption).toBeDefined();
      expect(branchOption?.required).toBe(true);
    });

    it("set-scope should require --scope option", () => {
      const taskCmd = program.commands.find((cmd) => cmd.name() === "task");
      const setScopeCmd = taskCmd?.commands.find(
        (cmd) => cmd.name() === "set-scope"
      );
      const options = setScopeCmd?.options ?? [];
      const scopeOption = options.find((opt) => opt.long === "--scope");
      expect(scopeOption).toBeDefined();
      expect(scopeOption?.required).toBe(true);
    });

    it("set-agent should require --agent option", () => {
      const taskCmd = program.commands.find((cmd) => cmd.name() === "task");
      const setAgentCmd = taskCmd?.commands.find(
        (cmd) => cmd.name() === "set-agent"
      );
      const options = setAgentCmd?.options ?? [];
      const agentOption = options.find((opt) => opt.long === "--agent");
      expect(agentOption).toBeDefined();
      expect(agentOption?.required).toBe(true);
    });
  });

  describe("task create-pr", () => {
    it("should support --dry-run option", () => {
      const taskCmd = program.commands.find((cmd) => cmd.name() === "task");
      const createPrCmd = taskCmd?.commands.find(
        (cmd) => cmd.name() === "create-pr"
      );
      const options = createPrCmd?.options ?? [];
      const dryRunOption = options.find((opt) => opt.long === "--dry-run");
      expect(dryRunOption).toBeDefined();
    });

    it("should have optional task argument", () => {
      const taskCmd = program.commands.find((cmd) => cmd.name() === "task");
      const createPrCmd = taskCmd?.commands.find(
        (cmd) => cmd.name() === "create-pr"
      );
      const args = createPrCmd?.registeredArguments ?? [];
      expect(args.length).toBeGreaterThan(0);
      expect(args[0]?.name()).toBe("task");
      expect(args[0]?.required).toBe(false);
    });
  });
});
