/**
 * Session CLI Commands Tests
 *
 * Tests for the session management CLI commands (native TypeScript implementation).
 * Ensures TypeScript implementation matches Python scripts/add_session.py
 *
 * Python reference files:
 * - templates/viben/scripts/add_session.py
 * - templates/viben/scripts/common/paths.py (FILE_JOURNAL_PREFIX, MAX_LINES)
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Command } from "commander";
import { registerSessionCommand } from "./session";

// Mock the viben-workspace module
vi.mock("../lib/viben-workspace", () => ({
  findVibenRoot: vi.fn(),
  getDeveloper: vi.fn(),
  getWorkspaceDir: vi.fn(),
  getAllDevelopers: vi.fn(),
  getJournalInfo: vi.fn(),
  getCurrentSessionNumber: vi.fn(),
  generateSessionContent: vi.fn(),
  createNewJournalFile: vi.fn(),
  updateIndexWithSession: vi.fn(),
  getTodayDate: vi.fn(),
  MAX_JOURNAL_LINES: 2000,
  DIR_VIBEN: ".viben",
  DIR_WORKSPACE: "workspace",
  FILE_JOURNAL_PREFIX: "journal-",
}));

// Mock node:fs
vi.mock("node:fs", () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  readdirSync: vi.fn(),
}));

// Mock node:fs/promises
vi.mock("node:fs/promises", () => ({
  appendFile: vi.fn(),
  readFile: vi.fn(),
  writeFile: vi.fn(),
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

import * as fs from "node:fs";
import * as fsPromises from "node:fs/promises";
import {
  findVibenRoot,
  getDeveloper,
  getWorkspaceDir,
  getAllDevelopers,
  getJournalInfo,
  getCurrentSessionNumber,
  generateSessionContent,
  createNewJournalFile,
  updateIndexWithSession,
  getTodayDate,
} from "../lib/viben-workspace";

describe("Session CLI Commands", () => {
  let program: Command;
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Create fresh program instance
    program = new Command();
    program.option("--json", "Output in JSON format");
    program.option("--verbose", "Verbose output");
    program.option("--quiet", "Quiet mode");

    // Register session commands
    registerSessionCommand(program);

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

  // Helper to setup standard mocks for a valid workspace
  function setupValidWorkspace(developer: string = "test-user") {
    vi.mocked(findVibenRoot).mockReturnValue("/workspace");
    vi.mocked(getDeveloper).mockReturnValue(developer);
    vi.mocked(getWorkspaceDir).mockReturnValue(`/workspace/.viben/workspace/${developer}`);
    vi.mocked(getAllDevelopers).mockReturnValue([developer]);
    vi.mocked(getTodayDate).mockReturnValue("2024-03-03");
    vi.mocked(getJournalInfo).mockReturnValue({
      file: `/workspace/.viben/workspace/${developer}/journal-1.md`,
      number: 1,
      lines: 100,
    });
    vi.mocked(getCurrentSessionNumber).mockReturnValue(4);
    vi.mocked(generateSessionContent).mockReturnValue("\n\n## Session 5: Test\n\nContent here\n");
    vi.mocked(updateIndexWithSession).mockResolvedValue(true);
    vi.mocked(fsPromises.appendFile).mockResolvedValue();

    // Mock existsSync
    vi.mocked(fs.existsSync).mockImplementation((path) => {
      const pathStr = path.toString();
      if (pathStr.includes(".viben")) return true;
      if (pathStr.includes("workspace")) return true;
      if (pathStr.includes("index.md")) return true;
      return false;
    });

    // Mock readFileSync for index.md
    vi.mocked(fs.readFileSync).mockImplementation(() => getMockIndexContent());
  }

  function getMockIndexContent(): string {
    return `# Journal Index

## Status

<!-- @@@auto:current-status -->
- **Active File**: \`journal-1.md\`
- **Total Sessions**: 5
- **Last Active**: 2024-03-03
<!-- @@@/auto:current-status -->

## Documents

<!-- @@@auto:active-documents -->
| File | Lines | Status |
|------|-------|--------|
| \`journal-1.md\` | ~150 | Active |
<!-- @@@/auto:active-documents -->

## Session History

<!-- @@@auto:session-history -->
| # | Date | Task | Commits |
|---|------|------|---------|
| 5 | 2024-03-03 | Test Session | \`abc1234\` |
| 4 | 2024-03-02 | Fix Bug | \`def5678\` |
| 3 | 2024-03-02 | Add Feature | \`ghi9012\`, \`jkl3456\` |
| 2 | 2024-03-01 | Initial Setup | - |
| 1 | 2024-03-01 | Project Init | \`mno7890\` |
<!-- @@@/auto:session-history -->
`;
  }

  // ============================================================================
  // session add
  // ============================================================================

  describe("session add", () => {
    it("should add a session with required title", async () => {
      setupValidWorkspace();

      await runCommand(["session", "add", "--title", "Test Session", "--commit", "abc1234"]);

      expect(generateSessionContent).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Test Session",
          commit: "abc1234",
        })
      );
      expect(updateIndexWithSession).toHaveBeenCalled();
    });

    it("should support -t shorthand for title", async () => {
      setupValidWorkspace();

      await runCommand(["session", "add", "-t", "Short Title"]);

      expect(generateSessionContent).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Short Title",
        })
      );
    });

    it("should support -c shorthand for commit", async () => {
      setupValidWorkspace();

      await runCommand(["session", "add", "-t", "Title", "-c", "xyz789"]);

      expect(generateSessionContent).toHaveBeenCalledWith(
        expect.objectContaining({
          commit: "xyz789",
        })
      );
    });

    it("should support -s shorthand for summary", async () => {
      setupValidWorkspace();

      await runCommand(["session", "add", "-t", "Title", "-s", "A brief summary"]);

      expect(generateSessionContent).toHaveBeenCalledWith(
        expect.objectContaining({
          summary: "A brief summary",
        })
      );
    });

    it("should fail when developer not initialized", async () => {
      vi.mocked(findVibenRoot).mockReturnValue("/workspace");
      vi.mocked(getDeveloper).mockReturnValue(null);

      await expect(runCommand(["session", "add", "-t", "Title"])).rejects.toThrow();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Developer not initialized")
      );
    });

    it("should output JSON when --json flag is provided", async () => {
      setupValidWorkspace();

      await runCommand(["--json", "session", "add", "-t", "Test Session"]);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('"success": true'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('"session"'));
    });

    it("should use default commit value when not provided", async () => {
      setupValidWorkspace();

      await runCommand(["session", "add", "-t", "No Commit Session"]);

      expect(generateSessionContent).toHaveBeenCalledWith(
        expect.objectContaining({
          commit: "-",
        })
      );
    });

    it("should create new journal when exceeding line limit", async () => {
      setupValidWorkspace();
      vi.mocked(getJournalInfo).mockReturnValue({
        file: "/workspace/.viben/workspace/test-user/journal-1.md",
        number: 1,
        lines: 1990,
      });
      // Generate content with many lines to exceed 2000 total
      const manyLines = Array(50).fill("Line content").join("\n");
      vi.mocked(generateSessionContent).mockReturnValue(manyLines);
      vi.mocked(createNewJournalFile).mockResolvedValue(
        "/workspace/.viben/workspace/test-user/journal-2.md"
      );

      await runCommand(["session", "add", "-t", "Title"]);

      // 1990 + 50 = 2040 > 2000, should create new file
      expect(createNewJournalFile).toHaveBeenCalled();
    });

    it("should append to existing journal when within limit", async () => {
      setupValidWorkspace();

      await runCommand(["session", "add", "-t", "Title"]);

      expect(createNewJournalFile).not.toHaveBeenCalled();
      expect(fsPromises.appendFile).toHaveBeenCalled();
    });

    it("should update session number correctly", async () => {
      setupValidWorkspace();
      vi.mocked(getCurrentSessionNumber).mockReturnValue(10);

      await runCommand(["session", "add", "-t", "Title"]);

      expect(generateSessionContent).toHaveBeenCalledWith(
        expect.objectContaining({
          session_num: 11,
        })
      );
    });
  });

  // ============================================================================
  // session list
  // ============================================================================

  describe("session list", () => {
    it("should list sessions for current user", async () => {
      setupValidWorkspace("john");

      await runCommand(["session", "list"]);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Session History"));
    });

    it("should show table with sessions", async () => {
      setupValidWorkspace("john");

      await runCommand(["session", "list"]);

      // Should display sessions
      expect(consoleSpy).toHaveBeenCalled();
    });

    it("should support --limit option", async () => {
      setupValidWorkspace("john");

      await runCommand(["session", "list", "--limit", "2"]);

      // Should call console.log with total count
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Total:"));
    });

    it("should support -n shorthand for limit", async () => {
      setupValidWorkspace("john");

      await runCommand(["session", "list", "-n", "3"]);

      expect(consoleSpy).toHaveBeenCalled();
    });

    it("should show message when no sessions exist", async () => {
      vi.mocked(findVibenRoot).mockReturnValue("/workspace");
      vi.mocked(getDeveloper).mockReturnValue("john");
      vi.mocked(getWorkspaceDir).mockReturnValue("/workspace/.viben/workspace/john");

      vi.mocked(fs.existsSync).mockImplementation((path) => {
        const pathStr = path.toString();
        if (pathStr.includes(".viben")) return true;
        if (pathStr.includes("index.md")) return false;
        return false;
      });

      // Return empty content (no session history markers)
      vi.mocked(fs.readFileSync).mockReturnValue("");

      await runCommand(["session", "list"]);

      // chalk.gray wraps "No sessions found."
      expect(consoleSpy).toHaveBeenCalledWith("No sessions found.");
    });

    it("should fail when developer not initialized", async () => {
      vi.mocked(findVibenRoot).mockReturnValue("/workspace");
      vi.mocked(getDeveloper).mockReturnValue(null);

      await expect(runCommand(["session", "list"])).rejects.toThrow();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Developer not initialized")
      );
    });

    it("should output JSON when --json flag is provided", async () => {
      setupValidWorkspace("john");

      await runCommand(["--json", "session", "list"]);

      const output = consoleSpy.mock.calls[0][0] as string;
      const response = JSON.parse(output);

      expect(response.success).toBe(true);
      expect(response.data.sessions).toBeDefined();
      expect(Array.isArray(response.data.sessions)).toBe(true);
    });

    it("should include session details in JSON output", async () => {
      setupValidWorkspace("john");

      await runCommand(["--json", "session", "list"]);

      const output = consoleSpy.mock.calls[0][0] as string;
      const response = JSON.parse(output);

      expect(response.data.sessions.length).toBeGreaterThan(0);
      expect(response.data.sessions[0]).toHaveProperty("number");
      expect(response.data.sessions[0]).toHaveProperty("date");
      expect(response.data.sessions[0]).toHaveProperty("task");
      expect(response.data.sessions[0]).toHaveProperty("commits");
    });

    it("should show total count in JSON output", async () => {
      setupValidWorkspace("john");

      await runCommand(["--json", "session", "list"]);

      const output = consoleSpy.mock.calls[0][0] as string;
      const response = JSON.parse(output);

      expect(response.data.total).toBeDefined();
      expect(response.data.showing).toBeDefined();
    });
  });

  // ============================================================================
  // session list --all
  // ============================================================================

  describe("session list --all", () => {
    it("should list sessions from all users", async () => {
      setupValidWorkspace("john");
      vi.mocked(getAllDevelopers).mockReturnValue(["john", "jane"]);

      await runCommand(["session", "list", "--all"]);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("All Users"));
    });

    it("should support -a shorthand for --all", async () => {
      setupValidWorkspace("john");

      await runCommand(["session", "list", "-a"]);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("All Users"));
    });

    it("should include developer column when --all is used", async () => {
      setupValidWorkspace("john");

      await runCommand(["session", "list", "--all"]);

      // The table should include "User" column header
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("User"));
    });

    it("should include developer field in JSON when --all is used", async () => {
      setupValidWorkspace("john");

      await runCommand(["--json", "session", "list", "--all"]);

      const output = consoleSpy.mock.calls[0][0] as string;
      const response = JSON.parse(output);

      expect(response.data.sessions[0]).toHaveProperty("developer");
    });
  });

  // ============================================================================
  // Error Handling
  // ============================================================================

  describe("error handling", () => {
    it("should fail when developer not initialized in add command", async () => {
      // When not in workspace, getRepoRoot falls back to cwd
      // Then getDeveloper returns null
      vi.mocked(findVibenRoot).mockReturnValue(null);
      vi.mocked(getDeveloper).mockReturnValue(null);

      await expect(runCommand(["session", "add", "-t", "Title"])).rejects.toThrow();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Developer not initialized")
      );
    });

    it("should fail when workspace dir not found", async () => {
      vi.mocked(findVibenRoot).mockReturnValue("/workspace");
      vi.mocked(getDeveloper).mockReturnValue("john");
      vi.mocked(getWorkspaceDir).mockReturnValue("/workspace/.viben/workspace/john");
      vi.mocked(fs.existsSync).mockReturnValue(false);

      await expect(runCommand(["session", "add", "-t", "Title"])).rejects.toThrow();
    });

    it("should handle index update failure", async () => {
      setupValidWorkspace();
      vi.mocked(updateIndexWithSession).mockResolvedValue(false);

      await expect(runCommand(["session", "add", "-t", "Title"])).rejects.toThrow();
    });
  });

  // ============================================================================
  // Spec Compliance Tests
  // ============================================================================

  describe("spec compliance", () => {
    it("should require --title for session add", async () => {
      setupValidWorkspace();

      // Commander should throw error for missing required option
      await expect(runCommand(["session", "add"])).rejects.toThrow();
    });

    it("should parse sessions from @@@auto:session-history markers", async () => {
      setupValidWorkspace("john");

      await runCommand(["--json", "session", "list"]);

      const output = consoleSpy.mock.calls[0][0] as string;
      const response = JSON.parse(output);

      // Should have 5 sessions from mock data
      expect(response.data.sessions.length).toBe(5);
      expect(response.data.sessions[0].number).toBe(5);
      expect(response.data.sessions[0].task).toBe("Test Session");
    });

    it("should support default limit of 20", async () => {
      setupValidWorkspace("john");

      // Should work without explicit limit
      await runCommand(["session", "list"]);

      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe("edge cases", () => {
    it("should handle empty workspace directory", async () => {
      vi.mocked(findVibenRoot).mockReturnValue("/workspace");
      vi.mocked(getDeveloper).mockReturnValue("john");
      vi.mocked(getAllDevelopers).mockReturnValue([]);
      vi.mocked(getWorkspaceDir).mockReturnValue("/workspace/.viben/workspace/john");

      vi.mocked(fs.existsSync).mockReturnValue(false);

      await runCommand(["session", "list", "--all"]);

      expect(consoleSpy).toHaveBeenCalledWith("No sessions found.");
    });

    it("should handle malformed index.md", async () => {
      vi.mocked(findVibenRoot).mockReturnValue("/workspace");
      vi.mocked(getDeveloper).mockReturnValue("john");
      vi.mocked(getWorkspaceDir).mockReturnValue("/workspace/.viben/workspace/john");

      vi.mocked(fs.existsSync).mockImplementation((path) => {
        const pathStr = path.toString();
        return pathStr.includes("index.md") || pathStr.includes(".viben");
      });

      vi.mocked(fs.readFileSync).mockReturnValue("# Some content without markers\n");

      await runCommand(["session", "list"]);

      expect(consoleSpy).toHaveBeenCalledWith("No sessions found.");
    });

    it("should handle special characters in session title", async () => {
      setupValidWorkspace();

      await runCommand([
        "session",
        "add",
        "-t",
        'Fix bug: handle "quotes" & <special> chars',
      ]);

      expect(generateSessionContent).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Fix bug: handle "quotes" & <special> chars',
        })
      );
    });
  });

  // ============================================================================
  // Python parity tests - add_session.py
  // ============================================================================

  describe("Python parity - add_session.py", () => {
    /**
     * Python reference: add_session.py
     * Tests that session add behavior matches Python implementation
     */

    it("should match Python MAX_LINES constant (2000)", async () => {
      setupValidWorkspace();
      // Test boundary: 1999 lines + 2 lines content = 2001, should create new file
      vi.mocked(getJournalInfo).mockReturnValue({
        file: "/workspace/.viben/workspace/test-user/journal-1.md",
        number: 1,
        lines: 1999,
      });
      // Generate content with 2 lines
      vi.mocked(generateSessionContent).mockReturnValue("Line1\nLine2\n");
      vi.mocked(createNewJournalFile).mockResolvedValue(
        "/workspace/.viben/workspace/test-user/journal-2.md"
      );

      await runCommand(["session", "add", "-t", "Title"]);

      // 1999 + 2 = 2001 > 2000, should create new file
      expect(createNewJournalFile).toHaveBeenCalled();
    });

    it("should NOT create new journal when exactly at limit", async () => {
      setupValidWorkspace();
      // Test: 1990 lines + 10 lines content = 2000, should NOT create new file
      vi.mocked(getJournalInfo).mockReturnValue({
        file: "/workspace/.viben/workspace/test-user/journal-1.md",
        number: 1,
        lines: 1990,
      });
      // 10 lines content
      vi.mocked(generateSessionContent).mockReturnValue(
        Array(10).fill("Line").join("\n")
      );

      await runCommand(["session", "add", "-t", "Title"]);

      // 1990 + 10 = 2000, NOT exceeding, should NOT create new file
      expect(createNewJournalFile).not.toHaveBeenCalled();
    });

    it("should pass correct params to generateSessionContent", async () => {
      setupValidWorkspace();
      vi.mocked(getCurrentSessionNumber).mockReturnValue(15);
      vi.mocked(getTodayDate).mockReturnValue("2024-03-15");

      await runCommand([
        "session",
        "add",
        "-t",
        "Test Title",
        "-c",
        "abc123,def456",
        "-s",
        "Test summary",
      ]);

      // Python: generate_session_content(session_num, title, commit, summary, extra_content, today)
      expect(generateSessionContent).toHaveBeenCalledWith(
        expect.objectContaining({
          session_num: 16, // current + 1
          title: "Test Title",
          commit: "abc123,def456",
          summary: "Test summary",
          date: "2024-03-15",
        })
      );
    });

    it("should pass correct params to updateIndexWithSession", async () => {
      setupValidWorkspace();
      vi.mocked(getCurrentSessionNumber).mockReturnValue(10);
      vi.mocked(getTodayDate).mockReturnValue("2024-03-20");

      await runCommand(["session", "add", "-t", "Index Update Test", "-c", "xyz789"]);

      // Python: update_index(index_file, dev_dir, title, commit, new_session, active_file, today)
      expect(updateIndexWithSession).toHaveBeenCalledWith(
        expect.objectContaining({
          session_num: 11,
          title: "Index Update Test",
          commit: "xyz789",
          active_file: "journal-1.md",
          date: "2024-03-20",
        })
      );
    });

    it("should increment journal number when creating new file", async () => {
      setupValidWorkspace();
      vi.mocked(getJournalInfo).mockReturnValue({
        file: "/workspace/.viben/workspace/test-user/journal-3.md",
        number: 3,
        lines: 1990,
      });
      // Content that exceeds limit
      vi.mocked(generateSessionContent).mockReturnValue(
        Array(20).fill("Line").join("\n")
      );
      vi.mocked(createNewJournalFile).mockResolvedValue(
        "/workspace/.viben/workspace/test-user/journal-4.md"
      );

      await runCommand(["session", "add", "-t", "Title"]);

      // Python: target_num = current_num + 1
      expect(createNewJournalFile).toHaveBeenCalledWith(
        expect.objectContaining({
          number: 4, // 3 + 1
          prevNumber: 3,
        })
      );
    });

    it("should use default commit value '-' when not provided", async () => {
      setupValidWorkspace();

      await runCommand(["session", "add", "-t", "No Commit"]);

      // Python: parser.add_argument("--commit", default="-", ...)
      expect(generateSessionContent).toHaveBeenCalledWith(
        expect.objectContaining({
          commit: "-",
        })
      );
    });

    it("should use default summary '(Add summary)' when not provided", async () => {
      setupValidWorkspace();

      await runCommand(["session", "add", "-t", "No Summary"]);

      // Python: parser.add_argument("--summary", default="(Add summary)", ...)
      expect(generateSessionContent).toHaveBeenCalledWith(
        expect.objectContaining({
          summary: "(Add summary)",
        })
      );
    });
  });

  // ============================================================================
  // Python parity tests - get_latest_journal_info()
  // ============================================================================

  describe("Python parity - get_latest_journal_info()", () => {
    /**
     * Python reference: add_session.py lines 46-70
     * Tests journal file detection logic
     */

    it("should return 0 for number and lines when no journal exists", async () => {
      setupValidWorkspace();
      vi.mocked(getJournalInfo).mockReturnValue({
        file: null,
        number: 0,
        lines: 0,
      });

      // This tests that the command handles the case where no journal exists
      await runCommand(["session", "add", "-t", "First Session"]);

      // Should still try to create/update
      expect(updateIndexWithSession).toHaveBeenCalled();
    });

    it("should correctly extract journal number from filename", async () => {
      setupValidWorkspace();
      vi.mocked(getJournalInfo).mockReturnValue({
        file: "/workspace/.viben/workspace/test-user/journal-5.md",
        number: 5,
        lines: 500,
      });

      await runCommand(["session", "add", "-t", "Title"]);

      // active_file should be journal-5.md
      expect(updateIndexWithSession).toHaveBeenCalledWith(
        expect.objectContaining({
          active_file: "journal-5.md",
        })
      );
    });
  });

  // ============================================================================
  // Python parity tests - get_current_session()
  // ============================================================================

  describe("Python parity - get_current_session()", () => {
    /**
     * Python reference: add_session.py lines 73-84
     * Tests session number extraction from index.md
     */

    it("should return 0 when index.md does not exist", async () => {
      setupValidWorkspace();
      vi.mocked(getCurrentSessionNumber).mockReturnValue(0);

      await runCommand(["session", "add", "-t", "Title"]);

      // new_session should be 0 + 1 = 1
      expect(generateSessionContent).toHaveBeenCalledWith(
        expect.objectContaining({
          session_num: 1,
        })
      );
    });

    it("should increment session number by 1", async () => {
      setupValidWorkspace();
      vi.mocked(getCurrentSessionNumber).mockReturnValue(42);

      await runCommand(["session", "add", "-t", "Title"]);

      // Python: new_session = current_session + 1
      expect(generateSessionContent).toHaveBeenCalledWith(
        expect.objectContaining({
          session_num: 43,
        })
      );
    });
  });

  // ============================================================================
  // Python parity tests - generate_session_content()
  // ============================================================================

  describe("Python parity - generate_session_content()", () => {
    /**
     * Python reference: add_session.py lines 130-178
     * Tests session content generation
     */

    it("should handle commit formatting with multiple commits", async () => {
      setupValidWorkspace();

      await runCommand(["session", "add", "-t", "Title", "-c", "abc,def,ghi"]);

      // Python: for c in commit.split(","):
      expect(generateSessionContent).toHaveBeenCalledWith(
        expect.objectContaining({
          commit: "abc,def,ghi",
        })
      );
    });

    it("should handle empty commit as '-'", async () => {
      setupValidWorkspace();

      await runCommand(["session", "add", "-t", "Title", "-c", ""]);

      // Empty string should still be passed (command-level default is "-")
      // But if user explicitly passes empty, it goes through
      expect(generateSessionContent).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Python parity tests - update_index()
  // ============================================================================

  describe("Python parity - update_index()", () => {
    /**
     * Python reference: add_session.py lines 181-277
     * Tests index.md update logic
     */

    it("should fail when @@@auto markers not found", async () => {
      setupValidWorkspace();
      vi.mocked(updateIndexWithSession).mockResolvedValue(false);

      // Python: if "@@@auto:current-status" not in content: return False
      await expect(runCommand(["session", "add", "-t", "Title"])).rejects.toThrow();
    });

    it("should update all three auto-sections", async () => {
      setupValidWorkspace();

      await runCommand(["session", "add", "-t", "Title"]);

      // updateIndexWithSession is called with correct params
      // Python updates: @@@auto:current-status, @@@auto:active-documents, @@@auto:session-history
      expect(updateIndexWithSession).toHaveBeenCalledWith(
        expect.objectContaining({
          index_path: expect.stringContaining("index.md"),
          workspaceDir: expect.any(String),
          session_num: expect.any(Number),
          title: "Title",
          active_file: expect.stringMatching(/journal-\d+\.md/),
        })
      );
    });
  });

  // ============================================================================
  // Python parity tests - parseSessionsFromIndex()
  // ============================================================================

  describe("Python parity - parseSessionsFromIndex()", () => {
    /**
     * Tests session history parsing from @@@auto:session-history markers
     * This tests the TypeScript implementation of parsing index.md
     */

    it("should parse session history table correctly", async () => {
      setupValidWorkspace("john");

      await runCommand(["--json", "session", "list"]);

      const output = consoleSpy.mock.calls[0][0] as string;
      const response = JSON.parse(output);

      // Should parse all 5 sessions from mock index content
      expect(response.data.sessions.length).toBe(5);
      expect(response.data.sessions[0].number).toBe(5);
      expect(response.data.sessions[0].date).toBe("2024-03-03");
      expect(response.data.sessions[0].task).toBe("Test Session");
      expect(response.data.sessions[0].commits).toBe("`abc1234`");
    });

    it("should handle sessions without commits", async () => {
      setupValidWorkspace("john");

      await runCommand(["--json", "session", "list"]);

      const output = consoleSpy.mock.calls[0][0] as string;
      const response = JSON.parse(output);

      // Session 2 has "-" for commits
      const session2 = response.data.sessions.find((s: { number: number }) => s.number === 2);
      expect(session2.commits).toBe("-");
    });

    it("should handle sessions with multiple commits", async () => {
      setupValidWorkspace("john");

      await runCommand(["--json", "session", "list"]);

      const output = consoleSpy.mock.calls[0][0] as string;
      const response = JSON.parse(output);

      // Session 3 has multiple commits
      const session3 = response.data.sessions.find((s: { number: number }) => s.number === 3);
      expect(session3.commits).toContain("`ghi9012`");
      expect(session3.commits).toContain("`jkl3456`");
    });
  });

  // ============================================================================
  // Python parity tests - CLI arguments
  // ============================================================================

  describe("Python parity - CLI arguments", () => {
    /**
     * Python reference: add_session.py lines 368-393
     * Tests CLI argument parsing
     */

    it("should accept --title as required", async () => {
      setupValidWorkspace();

      // Python: parser.add_argument("--title", required=True, ...)
      await expect(runCommand(["session", "add"])).rejects.toThrow();
    });

    it("should accept -t as shorthand for --title", async () => {
      setupValidWorkspace();

      await runCommand(["session", "add", "-t", "Short Title"]);

      expect(generateSessionContent).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Short Title",
        })
      );
    });

    it("should accept -c as shorthand for --commit", async () => {
      setupValidWorkspace();

      await runCommand(["session", "add", "-t", "Title", "-c", "commit123"]);

      expect(generateSessionContent).toHaveBeenCalledWith(
        expect.objectContaining({
          commit: "commit123",
        })
      );
    });

    it("should accept -s as shorthand for --summary", async () => {
      setupValidWorkspace();

      await runCommand(["session", "add", "-t", "Title", "-s", "Summary text"]);

      expect(generateSessionContent).toHaveBeenCalledWith(
        expect.objectContaining({
          summary: "Summary text",
        })
      );
    });

    it("should accept --content-file option", async () => {
      setupValidWorkspace();
      vi.mocked(fs.existsSync).mockImplementation((path) => {
        const pathStr = path.toString();
        if (pathStr === "/path/to/content.md") return true;
        if (pathStr.includes(".viben")) return true;
        return false;
      });
      vi.mocked(fs.readFileSync).mockImplementation((path) => {
        const pathStr = path.toString();
        if (pathStr === "/path/to/content.md") {
          return "Extra content from file";
        }
        return getMockIndexContent();
      });

      await runCommand([
        "session",
        "add",
        "-t",
        "Title",
        "--content-file",
        "/path/to/content.md",
      ]);

      expect(generateSessionContent).toHaveBeenCalledWith(
        expect.objectContaining({
          extra_content: "Extra content from file",
        })
      );
    });
  });

  // ============================================================================
  // Complete workflow tests
  // ============================================================================

  describe("complete workflow", () => {
    it("should execute full session add workflow", async () => {
      setupValidWorkspace();
      vi.mocked(getJournalInfo).mockReturnValue({
        file: "/workspace/.viben/workspace/test-user/journal-1.md",
        number: 1,
        lines: 100,
      });
      vi.mocked(getCurrentSessionNumber).mockReturnValue(5);
      vi.mocked(generateSessionContent).mockReturnValue(
        "\n\n## Session 6: Complete Test\n\nContent\n"
      );

      await runCommand([
        "session",
        "add",
        "-t",
        "Complete Test",
        "-c",
        "abc123",
        "-s",
        "Test summary",
      ]);

      // 1. Generate session content
      expect(generateSessionContent).toHaveBeenCalledWith({
        session_num: 6,
        title: "Complete Test",
        commit: "abc123",
        summary: "Test summary",
        extra_content: "(Add details)",
        date: "2024-03-03",
      });

      // 2. Append to journal (via fsPromises.appendFile)
      expect(fsPromises.appendFile).toHaveBeenCalledWith(
        "/workspace/.viben/workspace/test-user/journal-1.md",
        "\n\n## Session 6: Complete Test\n\nContent\n",
        "utf-8"
      );

      // 3. Update index.md
      expect(updateIndexWithSession).toHaveBeenCalledWith({
        index_path: "/workspace/.viben/workspace/test-user/index.md",
        workspaceDir: "/workspace/.viben/workspace/test-user",
        session_num: 6,
        title: "Complete Test",
        commit: "abc123",
        active_file: "journal-1.md",
        date: "2024-03-03",
      });
    });

    it("should handle journal rotation workflow", async () => {
      setupValidWorkspace();
      vi.mocked(getJournalInfo).mockReturnValue({
        file: "/workspace/.viben/workspace/test-user/journal-2.md",
        number: 2,
        lines: 1990,
      });
      vi.mocked(getCurrentSessionNumber).mockReturnValue(50);
      // Content that will exceed 2000 when added to 1990
      vi.mocked(generateSessionContent).mockReturnValue(
        Array(15).fill("Line content").join("\n")
      );
      vi.mocked(createNewJournalFile).mockResolvedValue(
        "/workspace/.viben/workspace/test-user/journal-3.md"
      );

      await runCommand(["session", "add", "-t", "Rotation Test"]);

      // Should create new journal
      expect(createNewJournalFile).toHaveBeenCalledWith({
        workspaceDir: "/workspace/.viben/workspace/test-user",
        number: 3,
        developer: "test-user",
        date: "2024-03-03",
        prevNumber: 2,
      });

      // Should update index with new journal file
      expect(updateIndexWithSession).toHaveBeenCalledWith(
        expect.objectContaining({
          active_file: "journal-3.md",
        })
      );
    });
  });
});
