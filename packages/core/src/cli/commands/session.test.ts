/**
 * Session CLI Commands Tests
 *
 * Tests for the session management CLI commands (native TypeScript implementation).
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
          sessionNum: 11,
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
});
