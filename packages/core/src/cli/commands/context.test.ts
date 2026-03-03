/**
 * Context CLI Command Tests
 *
 * Tests for the context command that displays development context.
 * Ensures TypeScript implementation matches Python scripts/common/git_context.py
 *
 * Python reference files:
 * - templates/viben/scripts/get_context.py
 * - templates/viben/scripts/common/git_context.py
 * - templates/viben/scripts/common/paths.py
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Command } from "commander";
import { registerContextCommand } from "./context";

// Mock the viben-workspace module
vi.mock("../lib/viben-workspace", () => ({
  findVibenRoot: vi.fn(),
  getDeveloper: vi.fn(),
  getActiveJournalFile: vi.fn(),
  countLines: vi.fn(),
  getCurrentTask: vi.fn(),
  getGitBranch: vi.fn(),
  getGitStatus: vi.fn(),
  getGitStatusCount: vi.fn(),
  getRecentCommits: vi.fn(),
  getActiveTasks: vi.fn(),
  readTaskJson: vi.fn(),
  DIR_VIBEN: ".viben",
  DIR_WORKSPACE: "workspace",
  DIR_TASKS: "tasks",
  DIR_SPEC: "spec",
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

// Mock process.exit
vi.spyOn(process, "exit").mockImplementation((code?: number | string | null | undefined) => {
  throw new Error(`process.exit(${code})`);
});

import {
  findVibenRoot,
  getDeveloper,
  getActiveJournalFile,
  countLines,
  getCurrentTask,
  getGitBranch,
  getGitStatus,
  getGitStatusCount,
  getRecentCommits,
  getActiveTasks,
  readTaskJson,
} from "../lib/viben-workspace";

/**
 * Sample task data for testing
 */
const sampleTasks = [
  {
    dir: "03-03-add-user-auth",
    name: "add-user-auth",
    status: "in_progress",
    assignee: "john",
    title: "Add user authentication",
    priority: "P1",
  },
  {
    dir: "03-02-fix-bug",
    name: "fix-bug",
    status: "planning",
    assignee: "alice",
    title: "Fix login bug",
    priority: "P2",
  },
];

/**
 * Sample commits for testing
 */
const sampleCommits = [
  { hash: "abc1234", message: "feat(auth): add login endpoint" },
  { hash: "def5678", message: "fix: resolve typo in config" },
  { hash: "ghi9012", message: "docs: update README" },
];

describe("Context CLI Command", () => {
  let program: Command;
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Create fresh program instance
    program = new Command();
    program.option("--json", "Output in JSON format");
    program.option("--verbose", "Verbose output");
    program.option("--quiet", "Quiet mode");

    // Register context command
    registerContextCommand(program);

    // Spy on console
    consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    // Reset all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    vi.clearAllMocks();
  });

  // Helper to run command
  async function runCommand(args: string[]): Promise<void> {
    await program.parseAsync(["node", "test", ...args]);
  }

  // Helper to set up standard mocks
  function setupStandardMocks() {
    vi.mocked(findVibenRoot).mockReturnValue("/workspace");
    vi.mocked(getDeveloper).mockReturnValue("john");
    vi.mocked(getGitBranch).mockReturnValue("feature/user-auth");
    vi.mocked(getGitStatus).mockReturnValue([
      " M src/auth.ts",
      " M src/api.ts",
      "?? src/new-file.ts",
    ]);
    vi.mocked(getGitStatusCount).mockReturnValue(3);
    vi.mocked(getRecentCommits).mockReturnValue(sampleCommits);
    vi.mocked(getActiveTasks).mockReturnValue(sampleTasks);
    vi.mocked(getCurrentTask).mockReturnValue(null);
    vi.mocked(getActiveJournalFile).mockReturnValue("/workspace/.viben/workspace/john/journal-1.md");
    vi.mocked(countLines).mockReturnValue(1500);
    vi.mocked(readTaskJson).mockReturnValue(null);
  }

  // ============================================================================
  // Basic functionality tests
  // ============================================================================

  describe("basic functionality", () => {
    it("should display context in text format by default", async () => {
      setupStandardMocks();

      await runCommand(["context"]);

      expect(findVibenRoot).toHaveBeenCalled();
      expect(getDeveloper).toHaveBeenCalled();
      expect(getGitBranch).toHaveBeenCalled();

      // Check output contains key sections
      const output = consoleSpy.mock.calls[0][0] as string;
      expect(output).toContain("SESSION CONTEXT");
      expect(output).toContain("## DEVELOPER");
      expect(output).toContain("Name: john");
      expect(output).toContain("## GIT STATUS");
    });

    it("should display context in JSON format with --json flag", async () => {
      setupStandardMocks();

      await runCommand(["--json", "context"]);

      const output = consoleSpy.mock.calls[0][0] as string;
      const response = JSON.parse(output);

      expect(response.success).toBe(true);
      expect(response.data.developer).toBe("john");
      expect(response.data.git.branch).toBe("feature/user-auth");
    });

    it("should display context in JSON format with local --json flag", async () => {
      setupStandardMocks();

      await runCommand(["context", "--json"]);

      const output = consoleSpy.mock.calls[0][0] as string;
      expect(output).toContain('"developer"');
    });
  });

  // ============================================================================
  // Error handling tests
  // ============================================================================

  describe("error handling", () => {
    it("should show error when not in a Viben workspace", async () => {
      vi.mocked(findVibenRoot).mockReturnValue(null);

      await expect(runCommand(["context"])).rejects.toThrow("process.exit(1)");

      // Error message is displayed via console.log with chalk.red
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Not in a Viben workspace")
      );
    });

    it("should show error with JSON format when not in workspace", async () => {
      vi.mocked(findVibenRoot).mockReturnValue(null);

      await expect(runCommand(["--json", "context"])).rejects.toThrow("process.exit(1)");

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"success": false')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("NOT_IN_WORKSPACE")
      );
    });

    it("should show error when developer not initialized", async () => {
      vi.mocked(findVibenRoot).mockReturnValue("/workspace");
      vi.mocked(getDeveloper).mockReturnValue(null);

      await runCommand(["context"]);

      const output = consoleSpy.mock.calls[0][0] as string;
      expect(output).toContain("ERROR: Not initialized");
    });
  });

  // ============================================================================
  // JSON output structure tests
  // ============================================================================

  describe("JSON output structure", () => {
    it("should include developer info in JSON output", async () => {
      setupStandardMocks();

      await runCommand(["--json", "context"]);

      const output = consoleSpy.mock.calls[0][0] as string;
      const response = JSON.parse(output);

      expect(response.success).toBe(true);
      expect(response.data.developer).toBe("john");
    });

    it("should include git info in JSON output", async () => {
      setupStandardMocks();

      await runCommand(["--json", "context"]);

      const output = consoleSpy.mock.calls[0][0] as string;
      const response = JSON.parse(output);

      expect(response.data.git).toBeDefined();
      expect(response.data.git.branch).toBe("feature/user-auth");
      expect(response.data.git.isClean).toBe(false);
      expect(response.data.git.uncommittedChanges).toBe(3);
      expect(response.data.git.recentCommits).toHaveLength(3);
    });

    it("should include tasks info in JSON output", async () => {
      setupStandardMocks();

      await runCommand(["--json", "context"]);

      const output = consoleSpy.mock.calls[0][0] as string;
      const response = JSON.parse(output);

      expect(response.data.tasks).toBeDefined();
      expect(response.data.tasks.active).toHaveLength(2);
      expect(response.data.tasks.directory).toBe(".viben/tasks");
    });

    it("should include journal info in JSON output", async () => {
      setupStandardMocks();

      await runCommand(["--json", "context"]);

      const output = consoleSpy.mock.calls[0][0] as string;
      const response = JSON.parse(output);

      expect(response.data.journal).toBeDefined();
      expect(response.data.journal.file).toContain("journal-1.md");
      expect(response.data.journal.lines).toBe(1500);
      expect(response.data.journal.nearLimit).toBe(false);
    });
  });

  // ============================================================================
  // Edge cases
  // ============================================================================

  describe("edge cases", () => {
    it("should handle empty developer name", async () => {
      vi.mocked(findVibenRoot).mockReturnValue("/workspace");
      vi.mocked(getDeveloper).mockReturnValue("");
      vi.mocked(getGitBranch).mockReturnValue("main");
      vi.mocked(getGitStatusCount).mockReturnValue(0);
      vi.mocked(getRecentCommits).mockReturnValue([]);
      vi.mocked(getActiveTasks).mockReturnValue([]);
      vi.mocked(getActiveJournalFile).mockReturnValue(null);

      await runCommand(["--json", "context"]);

      const output = consoleSpy.mock.calls[0][0] as string;
      const response = JSON.parse(output);

      expect(response.success).toBe(true);
      expect(response.data.developer).toBe("");
    });

    it("should handle no active tasks", async () => {
      setupStandardMocks();
      vi.mocked(getActiveTasks).mockReturnValue([]);

      await runCommand(["--json", "context"]);

      const output = consoleSpy.mock.calls[0][0] as string;
      const response = JSON.parse(output);

      expect(response.data.tasks.active).toHaveLength(0);
    });

    it("should handle clean git status", async () => {
      setupStandardMocks();
      vi.mocked(getGitBranch).mockReturnValue("main");
      vi.mocked(getGitStatus).mockReturnValue([]);
      vi.mocked(getGitStatusCount).mockReturnValue(0);
      vi.mocked(getRecentCommits).mockReturnValue([]);

      await runCommand(["--json", "context"]);

      const output = consoleSpy.mock.calls[0][0] as string;
      const response = JSON.parse(output);

      expect(response.data.git.isClean).toBe(true);
      expect(response.data.git.uncommittedChanges).toBe(0);
    });

    it("should handle journal near limit warning", async () => {
      setupStandardMocks();
      vi.mocked(countLines).mockReturnValue(1900);

      await runCommand(["--json", "context"]);

      const output = consoleSpy.mock.calls[0][0] as string;
      const response = JSON.parse(output);

      expect(response.data.journal.nearLimit).toBe(true);
      expect(response.data.journal.lines).toBe(1900);
    });

    it("should handle no journal file", async () => {
      setupStandardMocks();
      vi.mocked(getActiveJournalFile).mockReturnValue(null);

      await runCommand(["context"]);

      const output = consoleSpy.mock.calls[0][0] as string;
      expect(output).toContain("No journal file found");
    });
  });

  // ============================================================================
  // Current task tests
  // ============================================================================

  describe("current task", () => {
    it("should display current task when set", async () => {
      setupStandardMocks();
      vi.mocked(getCurrentTask).mockReturnValue(".viben/tasks/03-03-add-user-auth");
      vi.mocked(readTaskJson).mockReturnValue({
        name: "add-user-auth",
        status: "in_progress",
        createdAt: "2024-03-03",
        description: "Add user authentication",
      });

      await runCommand(["context"]);

      const output = consoleSpy.mock.calls[0][0] as string;
      expect(output).toContain("## CURRENT TASK");
      expect(output).toContain("Path: .viben/tasks/03-03-add-user-auth");
      expect(output).toContain("Name: add-user-auth");
    });

    it("should display (none) when no current task", async () => {
      setupStandardMocks();
      vi.mocked(getCurrentTask).mockReturnValue(null);

      await runCommand(["context"]);

      const output = consoleSpy.mock.calls[0][0] as string;
      expect(output).toContain("## CURRENT TASK");
      expect(output).toContain("(none)");
    });
  });

  // ============================================================================
  // My tasks filter tests
  // ============================================================================

  describe("my tasks filter", () => {
    it("should show tasks assigned to current developer", async () => {
      setupStandardMocks();

      await runCommand(["context"]);

      const output = consoleSpy.mock.calls[0][0] as string;
      expect(output).toContain("## MY TASKS (Assigned to me)");
      expect(output).toContain("[P1] Add user authentication (in_progress)");
    });

    it("should show message when no tasks assigned", async () => {
      setupStandardMocks();
      vi.mocked(getActiveTasks).mockReturnValue([
        {
          dir: "03-02-fix-bug",
          name: "fix-bug",
          status: "planning",
          assignee: "alice",
          title: "Fix login bug",
          priority: "P2",
        },
      ]);

      await runCommand(["context"]);

      const output = consoleSpy.mock.calls[0][0] as string;
      expect(output).toContain("(no tasks assigned to you)");
    });
  });
});
