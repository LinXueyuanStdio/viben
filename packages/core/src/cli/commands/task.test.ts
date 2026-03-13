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
      status: "plan",
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

      // Status lifecycle
      expect(subcommandNames).toContain("enqueue");
      expect(subcommandNames).toContain("dequeue");
      expect(subcommandNames).toContain("pause");
      expect(subcommandNames).toContain("resume");
      expect(subcommandNames).toContain("review");
      expect(subcommandNames).toContain("approve");
      expect(subcommandNames).toContain("reject");
      expect(subcommandNames).toContain("retry");

      // Config
      expect(subcommandNames).toContain("set-branch");
      expect(subcommandNames).toContain("set-base");
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

  describe("validateStatusTransition", () => {
    // Import validateStatusTransition and TaskEventType for testing
    let validateStatusTransition: (
      currentStatus: string,
      targetStatus: string,
      eventType: import("../lib/viben-workspace").TaskEventType
    ) => { valid: boolean; error?: string };

    beforeEach(async () => {
      const module = await import("../lib/viben-workspace");
      validateStatusTransition = module.validateStatusTransition;
    });

    describe("valid transitions", () => {
      it("should allow QUEUE from backlog to queue", () => {
        expect(validateStatusTransition("backlog", "queue", "QUEUE")).toEqual({ valid: true });
      });

      it("should allow START from queue to in_progress", () => {
        expect(validateStatusTransition("queue", "in_progress", "START")).toEqual({ valid: true });
      });

      it("should allow DEQUEUE from queue to backlog", () => {
        expect(validateStatusTransition("queue", "backlog", "DEQUEUE")).toEqual({ valid: true });
      });

      it("should allow PAUSE from in_progress to paused", () => {
        expect(validateStatusTransition("in_progress", "paused", "PAUSE")).toEqual({ valid: true });
      });

      it("should allow PAUSE from queue to paused", () => {
        expect(validateStatusTransition("queue", "paused", "PAUSE")).toEqual({ valid: true });
      });

      it("should allow RESUME from paused (dynamic target)", () => {
        expect(validateStatusTransition("paused", "queue", "RESUME")).toEqual({ valid: true });
        expect(validateStatusTransition("paused", "in_progress", "RESUME")).toEqual({ valid: true });
      });

      it("should allow APPROVED from human_review to completed", () => {
        expect(validateStatusTransition("human_review", "completed", "APPROVED")).toEqual({ valid: true });
      });

      it("should allow REJECTED from human_review to backlog", () => {
        expect(validateStatusTransition("human_review", "backlog", "REJECTED")).toEqual({ valid: true });
      });

      it("should allow RETRY from failed to queue", () => {
        expect(validateStatusTransition("failed", "queue", "RETRY")).toEqual({ valid: true });
      });

      it("should allow CANCEL from multiple states", () => {
        expect(validateStatusTransition("backlog", "cancelled", "CANCEL")).toEqual({ valid: true });
        expect(validateStatusTransition("queue", "cancelled", "CANCEL")).toEqual({ valid: true });
        expect(validateStatusTransition("paused", "cancelled", "CANCEL")).toEqual({ valid: true });
        expect(validateStatusTransition("in_progress", "cancelled", "CANCEL")).toEqual({ valid: true });
        expect(validateStatusTransition("human_review", "cancelled", "CANCEL")).toEqual({ valid: true });
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

      it("should reject APPROVED from non-human_review states", () => {
        const result1 = validateStatusTransition("backlog", "completed", "APPROVED");
        expect(result1.valid).toBe(false);
        expect(result1.error).toContain("Cannot approved task in 'backlog'");

        const result2 = validateStatusTransition("completed", "completed", "APPROVED");
        expect(result2.valid).toBe(false);

        const result3 = validateStatusTransition("queue", "completed", "APPROVED");
        expect(result3.valid).toBe(false);
      });

      it("should reject REJECTED from non-human_review states", () => {
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
        const result = validateStatusTransition("human_review", "queue", "APPROVED");
        expect(result.valid).toBe(false);
        expect(result.error).toContain("Expected: completed");
      });

      it("should reject incorrect target for REJECTED", () => {
        const result = validateStatusTransition("human_review", "completed", "REJECTED");
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
        expect(validateStatusTransition("paused", "queue", "RESUME")).toEqual({ valid: true });
        expect(validateStatusTransition("paused", "in_progress", "RESUME")).toEqual({ valid: true });
        expect(validateStatusTransition("paused", "backlog", "RESUME")).toEqual({ valid: true });
      });
    });

    describe("unsupported event types", () => {
      it("should reject unknown event types", () => {
        const result = validateStatusTransition("backlog", "queue", "INVALID_EVENT" as any);
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
