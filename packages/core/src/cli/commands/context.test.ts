/**
 * Context CLI Command Tests
 *
 * Tests for the context command that displays development context.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Command } from "commander";
import { registerContextCommand } from "./context";

// Mock the python-runner module
vi.mock("../lib/python-runner", () => ({
  findVibenRoot: vi.fn(),
  runVibenScript: vi.fn(),
  getVibenScriptPath: vi.fn(),
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

import { findVibenRoot, runVibenScript } from "../lib/python-runner";

/**
 * Sample context data for testing
 */
const sampleContextData = {
  developer: "john",
  git: {
    branch: "feature/user-auth",
    isClean: false,
    uncommittedChanges: 3,
    recentCommits: [
      { hash: "abc1234", message: "feat(auth): add login endpoint" },
      { hash: "def5678", message: "fix: resolve typo in config" },
      { hash: "ghi9012", message: "docs: update README" },
    ],
  },
  tasks: {
    active: [
      { dir: "03-03-add-user-auth", name: "add-user-auth", status: "in_progress" },
      { dir: "03-02-fix-bug", name: "fix-bug", status: "planning" },
    ],
    directory: ".viben/tasks",
  },
  journal: {
    file: ".viben/workspace/john/journal-1.md",
    lines: 1500,
    nearLimit: false,
  },
};

/**
 * Sample text output from Python script
 */
const sampleTextOutput = `========================================
SESSION CONTEXT
========================================

## DEVELOPER
Name: john

## GIT STATUS
Branch: feature/user-auth
Working directory: 3 uncommitted change(s)

## RECENT COMMITS
abc1234 feat(auth): add login endpoint
def5678 fix: resolve typo in config
ghi9012 docs: update README

## ACTIVE TASKS
- 03-03-add-user-auth/ (in_progress) @john
- 03-02-fix-bug/ (planning) @alice
Total: 2 active task(s)

## JOURNAL FILE
Active file: .viben/workspace/john/journal-1.md
Line count: 1500 / 2000

========================================`;

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

  // ============================================================================
  // Basic functionality tests
  // ============================================================================

  describe("basic functionality", () => {
    it("should display context in text format by default", async () => {
      vi.mocked(findVibenRoot).mockReturnValue("/workspace");
      vi.mocked(runVibenScript).mockResolvedValue({
        stdout: sampleTextOutput,
        stderr: "",
        code: 0,
      });

      await runCommand(["context"]);

      expect(findVibenRoot).toHaveBeenCalled();
      expect(runVibenScript).toHaveBeenCalledWith("get_context.py", []);
      expect(consoleSpy).toHaveBeenCalledWith(sampleTextOutput);
    });

    it("should display context in JSON format with --json flag", async () => {
      vi.mocked(findVibenRoot).mockReturnValue("/workspace");
      vi.mocked(runVibenScript).mockResolvedValue({
        stdout: JSON.stringify(sampleContextData),
        stderr: "",
        code: 0,
      });

      await runCommand(["--json", "context"]);

      expect(runVibenScript).toHaveBeenCalledWith("get_context.py", ["--json"]);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"success": true')
      );
    });

    it("should display context in JSON format with local --json flag", async () => {
      vi.mocked(findVibenRoot).mockReturnValue("/workspace");
      vi.mocked(runVibenScript).mockResolvedValue({
        stdout: JSON.stringify(sampleContextData),
        stderr: "",
        code: 0,
      });

      await runCommand(["context", "--json"]);

      expect(runVibenScript).toHaveBeenCalledWith("get_context.py", ["--json"]);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"developer"')
      );
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

    it("should show error when Python script fails", async () => {
      vi.mocked(findVibenRoot).mockReturnValue("/workspace");
      vi.mocked(runVibenScript).mockResolvedValue({
        stdout: "",
        stderr: "Python script error",
        code: 1,
      });

      await expect(runCommand(["context"])).rejects.toThrow("process.exit(1)");

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Python script error")
      );
    });

    it("should show error with JSON format when script fails", async () => {
      vi.mocked(findVibenRoot).mockReturnValue("/workspace");
      vi.mocked(runVibenScript).mockResolvedValue({
        stdout: "",
        stderr: "Script not found",
        code: 1,
      });

      await expect(runCommand(["--json", "context"])).rejects.toThrow("process.exit(1)");

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"success": false')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("SCRIPT_ERROR")
      );
    });
  });

  // ============================================================================
  // JSON output structure tests
  // ============================================================================

  describe("JSON output structure", () => {
    it("should include developer info in JSON output", async () => {
      vi.mocked(findVibenRoot).mockReturnValue("/workspace");
      vi.mocked(runVibenScript).mockResolvedValue({
        stdout: JSON.stringify(sampleContextData),
        stderr: "",
        code: 0,
      });

      await runCommand(["--json", "context"]);

      const output = consoleSpy.mock.calls[0][0] as string;
      const response = JSON.parse(output);

      expect(response.success).toBe(true);
      expect(response.data.developer).toBe("john");
    });

    it("should include git info in JSON output", async () => {
      vi.mocked(findVibenRoot).mockReturnValue("/workspace");
      vi.mocked(runVibenScript).mockResolvedValue({
        stdout: JSON.stringify(sampleContextData),
        stderr: "",
        code: 0,
      });

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
      vi.mocked(findVibenRoot).mockReturnValue("/workspace");
      vi.mocked(runVibenScript).mockResolvedValue({
        stdout: JSON.stringify(sampleContextData),
        stderr: "",
        code: 0,
      });

      await runCommand(["--json", "context"]);

      const output = consoleSpy.mock.calls[0][0] as string;
      const response = JSON.parse(output);

      expect(response.data.tasks).toBeDefined();
      expect(response.data.tasks.active).toHaveLength(2);
      expect(response.data.tasks.directory).toBe(".viben/tasks");
    });

    it("should include journal info in JSON output", async () => {
      vi.mocked(findVibenRoot).mockReturnValue("/workspace");
      vi.mocked(runVibenScript).mockResolvedValue({
        stdout: JSON.stringify(sampleContextData),
        stderr: "",
        code: 0,
      });

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
      const emptyDeveloperData = {
        ...sampleContextData,
        developer: "",
      };

      vi.mocked(findVibenRoot).mockReturnValue("/workspace");
      vi.mocked(runVibenScript).mockResolvedValue({
        stdout: JSON.stringify(emptyDeveloperData),
        stderr: "",
        code: 0,
      });

      await runCommand(["--json", "context"]);

      const output = consoleSpy.mock.calls[0][0] as string;
      const response = JSON.parse(output);

      expect(response.success).toBe(true);
      expect(response.data.developer).toBe("");
    });

    it("should handle no active tasks", async () => {
      const noTasksData = {
        ...sampleContextData,
        tasks: {
          active: [],
          directory: ".viben/tasks",
        },
      };

      vi.mocked(findVibenRoot).mockReturnValue("/workspace");
      vi.mocked(runVibenScript).mockResolvedValue({
        stdout: JSON.stringify(noTasksData),
        stderr: "",
        code: 0,
      });

      await runCommand(["--json", "context"]);

      const output = consoleSpy.mock.calls[0][0] as string;
      const response = JSON.parse(output);

      expect(response.data.tasks.active).toHaveLength(0);
    });

    it("should handle clean git status", async () => {
      const cleanGitData = {
        ...sampleContextData,
        git: {
          branch: "main",
          isClean: true,
          uncommittedChanges: 0,
          recentCommits: [],
        },
      };

      vi.mocked(findVibenRoot).mockReturnValue("/workspace");
      vi.mocked(runVibenScript).mockResolvedValue({
        stdout: JSON.stringify(cleanGitData),
        stderr: "",
        code: 0,
      });

      await runCommand(["--json", "context"]);

      const output = consoleSpy.mock.calls[0][0] as string;
      const response = JSON.parse(output);

      expect(response.data.git.isClean).toBe(true);
      expect(response.data.git.uncommittedChanges).toBe(0);
    });

    it("should handle journal near limit warning", async () => {
      const nearLimitData = {
        ...sampleContextData,
        journal: {
          file: ".viben/workspace/john/journal-1.md",
          lines: 1900,
          nearLimit: true,
        },
      };

      vi.mocked(findVibenRoot).mockReturnValue("/workspace");
      vi.mocked(runVibenScript).mockResolvedValue({
        stdout: JSON.stringify(nearLimitData),
        stderr: "",
        code: 0,
      });

      await runCommand(["--json", "context"]);

      const output = consoleSpy.mock.calls[0][0] as string;
      const response = JSON.parse(output);

      expect(response.data.journal.nearLimit).toBe(true);
      expect(response.data.journal.lines).toBe(1900);
    });

    it("should handle malformed JSON from script gracefully", async () => {
      vi.mocked(findVibenRoot).mockReturnValue("/workspace");
      vi.mocked(runVibenScript).mockResolvedValue({
        stdout: "{ invalid json }",
        stderr: "",
        code: 0,
      });

      await runCommand(["--json", "context"]);

      // Should output the raw string when JSON parsing fails
      expect(consoleSpy).toHaveBeenCalledWith("{ invalid json }");
    });
  });

  // ============================================================================
  // Script integration tests
  // ============================================================================

  describe("script integration", () => {
    it("should call runVibenScript with correct script name", async () => {
      vi.mocked(findVibenRoot).mockReturnValue("/workspace");
      vi.mocked(runVibenScript).mockResolvedValue({
        stdout: sampleTextOutput,
        stderr: "",
        code: 0,
      });

      await runCommand(["context"]);

      expect(runVibenScript).toHaveBeenCalledWith(
        "get_context.py",
        expect.any(Array)
      );
    });

    it("should pass --json flag to Python script when JSON output requested", async () => {
      vi.mocked(findVibenRoot).mockReturnValue("/workspace");
      vi.mocked(runVibenScript).mockResolvedValue({
        stdout: JSON.stringify(sampleContextData),
        stderr: "",
        code: 0,
      });

      await runCommand(["--json", "context"]);

      expect(runVibenScript).toHaveBeenCalledWith("get_context.py", ["--json"]);
    });

    it("should not pass --json flag for text output", async () => {
      vi.mocked(findVibenRoot).mockReturnValue("/workspace");
      vi.mocked(runVibenScript).mockResolvedValue({
        stdout: sampleTextOutput,
        stderr: "",
        code: 0,
      });

      await runCommand(["context"]);

      expect(runVibenScript).toHaveBeenCalledWith("get_context.py", []);
    });
  });
});
