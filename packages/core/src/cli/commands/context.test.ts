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
  getGitBranch: vi.fn(),
  getGitStatus: vi.fn(),
  getGitStatusCount: vi.fn(),
  getRecentCommits: vi.fn(),
  getActiveTasks: vi.fn(),
  readTaskJson: vi.fn(),
  getTasksDir: vi.fn(),
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
  getGitBranch,
  getGitStatus,
  getGitStatusCount,
  getRecentCommits,
  getActiveTasks,
  readTaskJson,
  getTasksDir,
} from "../lib/viben-workspace";

/**
 * Sample task data for testing
 */
// Tasks are sorted by dir name (getActiveTasks sorts by localeCompare)
// 03-02 < 03-03, so 03-03-add-user-auth is the latest (last in list)
const sampleTasks = [
  {
    dir: "03-02-fix-bug",
    id: "03-02-fix-bug",
    name: "fix-bug",
    status: "plan",
    assignee: "alice",
    title: "Fix login bug",
    priority: "P2",
    description: null,
    created_at: "2025-03-02T10:00:00Z",
    updated_at: "2025-03-02T10:00:00Z",
    workspace_path: "/workspace",
    executor: "CLAUDE_CODE",
  },
  {
    dir: "03-03-add-user-auth",
    id: "03-03-add-user-auth",
    name: "add-user-auth",
    status: "in_progress",
    assignee: "john",
    title: "Add user authentication",
    priority: "P1",
    description: null,
    created_at: "2025-03-03T10:00:00Z",
    updated_at: "2025-03-03T10:00:00Z",
    workspace_path: "/workspace",
    executor: "CLAUDE_CODE",
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
    vi.mocked(getTasksDir).mockReturnValue("/workspace/.viben/tasks");
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
      expect(response.data.git.is_clean).toBe(false);
      expect(response.data.git.uncommitted_changes).toBe(3);
      expect(response.data.git.recent_commits).toHaveLength(3);
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
      expect(response.data.journal.near_limit).toBe(false);
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

      expect(response.data.git.is_clean).toBe(true);
      expect(response.data.git.uncommitted_changes).toBe(0);
    });

    it("should handle journal near limit warning", async () => {
      setupStandardMocks();
      vi.mocked(countLines).mockReturnValue(1900);

      await runCommand(["--json", "context"]);

      const output = consoleSpy.mock.calls[0][0] as string;
      const response = JSON.parse(output);

      expect(response.data.journal.near_limit).toBe(true);
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
  // Latest task tests (inferred from most recent task directory)
  // ============================================================================

  describe("latest task", () => {
    it("should display latest task (last in sorted list)", async () => {
      setupStandardMocks();
      // sampleTasks are sorted by dir name, last one is "03-03-add-user-auth"
      vi.mocked(readTaskJson).mockReturnValue({
        name: "add-user-auth",
        status: "in_progress",
        createdAt: "2024-03-03",
        description: "Add user authentication",
      });

      await runCommand(["context"]);

      const output = consoleSpy.mock.calls[0][0] as string;
      expect(output).toContain("## LATEST TASK");
      expect(output).toContain("Path: .viben/tasks/03-03-add-user-auth");
      expect(output).toContain("Name: add-user-auth");
    });

    it("should display (none) when no active tasks", async () => {
      setupStandardMocks();
      vi.mocked(getActiveTasks).mockReturnValue([]);

      await runCommand(["context"]);

      const output = consoleSpy.mock.calls[0][0] as string;
      expect(output).toContain("## LATEST TASK");
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
          id: "03-02-fix-bug",
          name: "fix-bug",
          status: "plan",
          assignee: "alice",
          title: "Fix login bug",
          priority: "P2",
          description: null,
          created_at: "2025-03-02T10:00:00Z",
          updated_at: "2025-03-02T10:00:00Z",
          workspace_path: "/workspace",
          executor: "CLAUDE_CODE",
        },
      ]);

      await runCommand(["context"]);

      const output = consoleSpy.mock.calls[0][0] as string;
      expect(output).toContain("(no tasks assigned to you)");
    });
  });

  // ============================================================================
  // Python parity tests - git_context.py get_context_json()
  // ============================================================================

  describe("Python parity - get_context_json()", () => {
    /**
     * Python reference: git_context.py lines 83-160
     * Tests that JSON output structure matches Python implementation
     */

    it("should match Python JSON structure for developer field", async () => {
      setupStandardMocks();

      await runCommand(["--json", "context"]);

      const output = consoleSpy.mock.calls[0][0] as string;
      const response = JSON.parse(output);

      // Python: context["developer"] = developer or ""
      expect(response.data).toHaveProperty("developer");
      expect(typeof response.data.developer).toBe("string");
    });

    it("should match Python JSON structure for git object", async () => {
      setupStandardMocks();

      await runCommand(["--json", "context"]);

      const output = consoleSpy.mock.calls[0][0] as string;
      const response = JSON.parse(output);

      // Python: context["git"] = { branch, is_clean, uncommitted_changes, recent_commits }
      expect(response.data.git).toHaveProperty("branch");
      expect(response.data.git).toHaveProperty("is_clean");
      expect(response.data.git).toHaveProperty("uncommitted_changes");
      expect(response.data.git).toHaveProperty("recent_commits");
    });

    it("should match Python isClean logic (status_count == 0)", async () => {
      setupStandardMocks();
      vi.mocked(getGitStatusCount).mockReturnValue(0);

      await runCommand(["--json", "context"]);

      const output = consoleSpy.mock.calls[0][0] as string;
      const response = JSON.parse(output);

      // Python: is_clean = git_status_count == 0
      expect(response.data.git.is_clean).toBe(true);
      expect(response.data.git.uncommitted_changes).toBe(0);
    });

    it("should match Python commits structure [{hash, message}]", async () => {
      setupStandardMocks();

      await runCommand(["--json", "context"]);

      const output = consoleSpy.mock.calls[0][0] as string;
      const response = JSON.parse(output);

      // Python: commits.append({"hash": parts[0], "message": parts[1]})
      expect(Array.isArray(response.data.git.recent_commits)).toBe(true);
      if (response.data.git.recent_commits.length > 0) {
        expect(response.data.git.recent_commits[0]).toHaveProperty("hash");
        expect(response.data.git.recent_commits[0]).toHaveProperty("message");
      }
    });

    it("should match Python tasks structure", async () => {
      setupStandardMocks();

      await runCommand(["--json", "context"]);

      const output = consoleSpy.mock.calls[0][0] as string;
      const response = JSON.parse(output);

      // Python: context["tasks"] = { active: [...], directory: "..." }
      expect(response.data.tasks).toHaveProperty("active");
      expect(response.data.tasks).toHaveProperty("directory");
      expect(Array.isArray(response.data.tasks.active)).toBe(true);
    });

    it("should match Python journal structure", async () => {
      setupStandardMocks();

      await runCommand(["--json", "context"]);

      const output = consoleSpy.mock.calls[0][0] as string;
      const response = JSON.parse(output);

      // Python: context["journal"] = { file, lines, near_limit: lines > 1800 }
      expect(response.data.journal).toHaveProperty("file");
      expect(response.data.journal).toHaveProperty("lines");
      expect(response.data.journal).toHaveProperty("near_limit");
    });

    it("should calculate near_limit as lines > 1800 (Python parity)", async () => {
      setupStandardMocks();

      // Test exactly at boundary
      vi.mocked(countLines).mockReturnValue(1800);
      await runCommand(["--json", "context"]);
      let output = consoleSpy.mock.calls[0][0] as string;
      let response = JSON.parse(output);
      expect(response.data.journal.near_limit).toBe(false);

      consoleSpy.mockClear();

      // Test just over boundary
      vi.mocked(countLines).mockReturnValue(1801);
      await runCommand(["--json", "context"]);
      output = consoleSpy.mock.calls[0][0] as string;
      response = JSON.parse(output);
      expect(response.data.journal.near_limit).toBe(true);
    });

    it("should match Python directory path format", async () => {
      setupStandardMocks();

      await runCommand(["--json", "context"]);

      const output = consoleSpy.mock.calls[0][0] as string;
      const response = JSON.parse(output);

      // Python: f"{DIR_WORKFLOW}/{DIR_TASKS}" = ".viben/tasks"
      expect(response.data.tasks.directory).toBe(".viben/tasks");
    });
  });

  // ============================================================================
  // Python parity tests - git_context.py get_context_text()
  // ============================================================================

  describe("Python parity - get_context_text()", () => {
    /**
     * Python reference: git_context.py lines 178-343
     * Tests that text output format matches Python implementation
     */

    it("should output header matching Python format", async () => {
      setupStandardMocks();

      await runCommand(["context"]);

      const output = consoleSpy.mock.calls[0][0] as string;

      // Python: lines 191-194
      expect(output).toContain("========================================");
      expect(output).toContain("SESSION CONTEXT");
    });

    it("should output DEVELOPER section header", async () => {
      setupStandardMocks();

      await runCommand(["context"]);

      const output = consoleSpy.mock.calls[0][0] as string;

      // Python: lines.append("## DEVELOPER")
      expect(output).toContain("## DEVELOPER");
    });

    it("should output GIT STATUS section with correct format", async () => {
      setupStandardMocks();

      await runCommand(["context"]);

      const output = consoleSpy.mock.calls[0][0] as string;

      // Python: lines.append("## GIT STATUS"), lines.append(f"Branch: {branch}")
      expect(output).toContain("## GIT STATUS");
      expect(output).toContain("Branch: feature/user-auth");
    });

    it("should show 'Working directory: Clean' when isClean", async () => {
      setupStandardMocks();
      vi.mocked(getGitStatus).mockReturnValue([]);
      vi.mocked(getGitStatusCount).mockReturnValue(0);

      await runCommand(["context"]);

      const output = consoleSpy.mock.calls[0][0] as string;

      // Python: lines.append("Working directory: Clean")
      expect(output).toContain("Working directory: Clean");
    });

    it("should show change count when not clean", async () => {
      setupStandardMocks();

      await runCommand(["context"]);

      const output = consoleSpy.mock.calls[0][0] as string;

      // Python: lines.append(f"Working directory: {status_count} uncommitted change(s)")
      expect(output).toContain("Working directory: 3 uncommitted change(s)");
    });

    it("should output RECENT COMMITS section", async () => {
      setupStandardMocks();

      await runCommand(["context"]);

      const output = consoleSpy.mock.calls[0][0] as string;

      // Python: lines.append("## RECENT COMMITS")
      expect(output).toContain("## RECENT COMMITS");
      expect(output).toContain("abc1234 feat(auth): add login endpoint");
    });

    it("should show (no commits) when no commits exist", async () => {
      setupStandardMocks();
      vi.mocked(getRecentCommits).mockReturnValue([]);

      await runCommand(["context"]);

      const output = consoleSpy.mock.calls[0][0] as string;

      // Python: lines.append("(no commits)")
      expect(output).toContain("(no commits)");
    });

    it("should output LATEST TASK section", async () => {
      setupStandardMocks();

      await runCommand(["context"]);

      const output = consoleSpy.mock.calls[0][0] as string;

      // Latest task is inferred from most recent task directory
      expect(output).toContain("## LATEST TASK");
    });

    it("should output ACTIVE TASKS section with count", async () => {
      setupStandardMocks();

      await runCommand(["context"]);

      const output = consoleSpy.mock.calls[0][0] as string;

      // Python: lines.append("## ACTIVE TASKS"), lines.append(f"Total: {task_count} active task(s)")
      expect(output).toContain("## ACTIVE TASKS");
      expect(output).toContain("Total: 2 active task(s)");
    });

    it("should output MY TASKS section", async () => {
      setupStandardMocks();

      await runCommand(["context"]);

      const output = consoleSpy.mock.calls[0][0] as string;

      // Python: lines.append("## MY TASKS (Assigned to me)")
      expect(output).toContain("## MY TASKS (Assigned to me)");
    });

    it("should output JOURNAL FILE section", async () => {
      setupStandardMocks();

      await runCommand(["context"]);

      const output = consoleSpy.mock.calls[0][0] as string;

      // Python: lines.append("## JOURNAL FILE")
      expect(output).toContain("## JOURNAL FILE");
      expect(output).toContain("Line count: 1500 / 2000");
    });

    it("should show journal warning when approaching limit", async () => {
      setupStandardMocks();
      vi.mocked(countLines).mockReturnValue(1900);

      await runCommand(["context"]);

      const output = consoleSpy.mock.calls[0][0] as string;

      // Python: lines.append("[!] WARNING: Approaching 2000 line limit!")
      expect(output).toContain("[!] WARNING: Approaching 2000 line limit!");
    });

    it("should output PATHS section", async () => {
      setupStandardMocks();

      await runCommand(["context"]);

      const output = consoleSpy.mock.calls[0][0] as string;

      // Python: lines.append("## PATHS"), lines.append(f"Workspace: {DIR_WORKFLOW}/...")
      expect(output).toContain("## PATHS");
      expect(output).toContain("Workspace: .viben/workspace/john/");
      expect(output).toContain("Tasks: .viben/tasks/");
      expect(output).toContain("Spec: docs/specs/");
    });

    it("should output footer matching Python format", async () => {
      setupStandardMocks();

      await runCommand(["context"]);

      const output = consoleSpy.mock.calls[0][0] as string;

      // Python: lines.append("========================================")
      const footerMatch = output.match(/={40}/g);
      expect(footerMatch).not.toBeNull();
      expect(footerMatch!.length).toBeGreaterThanOrEqual(2); // Header and footer
    });

    it("should show error format matching Python when not initialized", async () => {
      vi.mocked(findVibenRoot).mockReturnValue("/workspace");
      vi.mocked(getDeveloper).mockReturnValue(null);

      await runCommand(["context"]);

      const output = consoleSpy.mock.calls[0][0] as string;

      // Python: lines.append(f"ERROR: Not initialized. Run: ...")
      expect(output).toContain("ERROR: Not initialized");
    });
  });

  // ============================================================================
  // Python parity tests - paths.py functions
  // ============================================================================

  describe("Python parity - paths.py functions", () => {
    /**
     * Tests that workspace functions work as in Python paths.py
     */

    it("should correctly format journal relative path", async () => {
      setupStandardMocks();

      await runCommand(["--json", "context"]);

      const output = consoleSpy.mock.calls[0][0] as string;
      const response = JSON.parse(output);

      // Python: f"{DIR_WORKFLOW}/{DIR_WORKSPACE}/{developer}/{journal_file.name}"
      expect(response.data.journal.file).toMatch(/\.viben\/workspace\/john\/journal-\d+\.md/);
    });

    it("should handle null journal file", async () => {
      setupStandardMocks();
      vi.mocked(getActiveJournalFile).mockReturnValue(null);

      await runCommand(["--json", "context"]);

      const output = consoleSpy.mock.calls[0][0] as string;
      const response = JSON.parse(output);

      // Python: journal_relative = ""
      expect(response.data.journal.file).toBe("");
      expect(response.data.journal.lines).toBe(0);
    });
  });

  // ============================================================================
  // Edge cases for complete Python parity
  // ============================================================================

  describe("complete Python parity edge cases", () => {
    it("should handle task with prd.md file indicator", async () => {
      setupStandardMocks();
      // Latest task is inferred from getActiveTasks (last in sorted list)
      vi.mocked(readTaskJson).mockReturnValue({
        name: "add-user-auth",
        status: "in_progress",
      });

      // Note: The prd.md check requires existsSync which is not mocked here
      // This test verifies the task info is shown correctly
      await runCommand(["context"]);

      const output = consoleSpy.mock.calls[0][0] as string;
      expect(output).toContain("Path: .viben/tasks/03-03-add-user-auth");
    });

    it("should filter out completed tasks from MY TASKS", async () => {
      setupStandardMocks();
      vi.mocked(getActiveTasks).mockReturnValue([
        {
          dir: "03-03-completed-task",
          id: "03-03-completed-task",
          name: "completed-task",
          status: "completed",
          assignee: "john",
          title: "Completed task",
          priority: "P1",
          description: null,
          created_at: "2025-03-03T10:00:00Z",
          updated_at: "2025-03-03T10:00:00Z",
          workspace_path: "/workspace",
          executor: "CLAUDE_CODE",
        },
      ]);

      await runCommand(["context"]);

      const output = consoleSpy.mock.calls[0][0] as string;

      // Filter out completed tasks from MY TASKS
      expect(output).toContain("(no tasks assigned to you)");
    });

    it("should show tasks in ACTIVE TASKS with format: dir/ (status) @assignee", async () => {
      setupStandardMocks();

      await runCommand(["context"]);

      const output = consoleSpy.mock.calls[0][0] as string;

      // Python: lines.append(f"- {dir_name}/ ({status}) @{assignee}")
      expect(output).toContain("- 03-03-add-user-auth/ (in_progress) @john");
    });

    it("should show (no active tasks) when tasks list is empty", async () => {
      setupStandardMocks();
      vi.mocked(getActiveTasks).mockReturnValue([]);

      await runCommand(["context"]);

      const output = consoleSpy.mock.calls[0][0] as string;

      // Python: lines.append("(no active tasks)")
      expect(output).toContain("(no active tasks)");
      expect(output).toContain("Total: 0 active task(s)");
    });
  });
});
