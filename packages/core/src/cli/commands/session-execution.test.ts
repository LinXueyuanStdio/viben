/**
 * Session Command Execution Tests
 *
 * Tests that actually execute session commands and verify behavior.
 * Uses real file system operations with temporary directories.
 *
 * This complements session.test.ts which tests with mocked dependencies.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Command } from "commander";
import { registerSessionCommand } from "./session";
import {
  createWorkspaceTempDir,
  type TempDirContext,
} from "../../test/helpers/temp-dir";
import { createConsoleSpy, type ConsoleSpy } from "../../test/mocks/console";

// =============================================================================
// Test Setup
// =============================================================================

// Mock only findVibenRoot and getTodayDate to use controlled values
// All other file operations are real
vi.mock("../lib/viben-workspace", async (importOriginal) => {
  const original = await importOriginal<typeof import("../lib/viben-workspace")>();
  return {
    ...original,
    findVibenRoot: vi.fn(),
    // Mock getTodayDate to return consistent date for tests
    getTodayDate: vi.fn(() => "2026-03-20"),
  };
});

// Mock chalk to avoid color codes in test output
vi.mock("chalk", () => ({
  default: {
    bold: Object.assign((s: string) => s, {
      cyan: (s: string) => s,
    }),
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

import * as vibenWorkspace from "../lib/viben-workspace";

// Store original process.exit and mock it
const originalExit = process.exit;
let exitCode: number | undefined;

// =============================================================================
// Test Context Helper
// =============================================================================

interface ExecutionTestContext {
  tempDir: TempDirContext & { vibenDir: string; tasksDir: string };
  program: Command;
  console: ConsoleSpy;
  run: (args: string[]) => Promise<void>;
  runJson: (args: string[]) => Promise<unknown>;
  cleanup: () => Promise<void>;
}

async function createExecutionTestContext(): Promise<ExecutionTestContext> {
  const tempDir = await createWorkspaceTempDir();

  // Mock findVibenRoot to return our temp directory
  vi.mocked(vibenWorkspace.findVibenRoot).mockReturnValue(tempDir.root);

  // Mock process.exit to capture exit code instead of actually exiting
  exitCode = undefined;
  process.exit = vi.fn((code?: string | number | null | undefined) => {
    exitCode = typeof code === "number" ? code : 0;
    throw new Error(`process.exit unexpectedly called with "${code}"`);
  }) as never;

  const program = new Command();
  program.option("--json", "Output JSON format");
  program.option("--verbose", "Verbose output");
  program.option("--quiet", "Quiet mode");

  // Prevent commander from calling process.exit
  program.exitOverride();

  registerSessionCommand(program);

  const consoleSpy = createConsoleSpy();

  return {
    tempDir,
    program,
    console: consoleSpy,

    async run(args: string[]) {
      try {
        await program.parseAsync(["node", "test", ...args]);
      } catch (error) {
        // Commander throws on exitOverride, but we can ignore it
        // Also ignore process.exit mock errors
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
      await tempDir.cleanup();
      vi.clearAllMocks();
      // Restore process.exit
      process.exit = originalExit;
    },
  };
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Create a developer file in the temp directory
 */
async function setupDeveloper(
  tempDir: TempDirContext,
  developerName: string
): Promise<void> {
  await tempDir.writeFile(".viben/.developer", `name=${developerName}\n`);
}

/**
 * Create workspace directory structure for a developer
 */
async function setupWorkspace(
  tempDir: TempDirContext,
  developerName: string
): Promise<string> {
  const workspacePath = `.viben/workspace/${developerName}`;
  await tempDir.mkdir(workspacePath);
  return workspacePath;
}

/**
 * Create an index.md file with the required auto markers
 */
async function createIndexFile(
  tempDir: TempDirContext,
  developerName: string,
  sessions: Array<{ number: number; date: string; task: string; commits: string }> = []
): Promise<void> {
  const workspacePath = `.viben/workspace/${developerName}`;

  // Build session history rows
  const sessionRows = sessions
    .map((s) => `| ${s.number} | ${s.date} | ${s.task} | ${s.commits} |`)
    .join("\n");

  const totalSessions = sessions.length > 0 ? Math.max(...sessions.map((s) => s.number)) : 0;
  const lastActive = sessions.length > 0 ? sessions[0].date : "N/A";

  const content = `# Journal Index

## Status

<!-- @@@auto:current-status -->
- **Active File**: \`journal-1.md\`
- **Total Sessions**: ${totalSessions}
- **Last Active**: ${lastActive}
<!-- @@@/auto:current-status -->

## Documents

<!-- @@@auto:active-documents -->
| File | Lines | Status |
|------|-------|--------|
| \`journal-1.md\` | ~100 | Active |
<!-- @@@/auto:active-documents -->

## Session History

<!-- @@@auto:session-history -->
| # | Date | Task | Commits |
|---|------|------|---------|
${sessionRows}
<!-- @@@/auto:session-history -->
`;

  await tempDir.writeFile(`${workspacePath}/index.md`, content);
}

/**
 * Create a journal file
 */
async function createJournalFile(
  tempDir: TempDirContext,
  developerName: string,
  journalNumber: number,
  content?: string
): Promise<void> {
  const workspacePath = `.viben/workspace/${developerName}`;

  const defaultContent = `# Journal - ${developerName} (Part ${journalNumber})

> Started: 2026-03-01

---

## Session 1: Initial Setup

**Date**: 2026-03-01
**Task**: Initial Setup

### Summary

Initial project setup.

### Status

[OK] **Completed**
`;

  await tempDir.writeFile(
    `${workspacePath}/journal-${journalNumber}.md`,
    content ?? defaultContent
  );
}

// =============================================================================
// Execution Tests
// =============================================================================

describe("session command execution", () => {
  let ctx: ExecutionTestContext;

  beforeEach(async () => {
    ctx = await createExecutionTestContext();
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  // ===========================================================================
  // session list execution
  // ===========================================================================

  describe("session list", () => {
    it("should show message when developer not initialized", async () => {
      // No developer file created
      await ctx.run(["session", "list"]);

      // Should have called process.exit with non-zero code
      expect(exitCode).toBe(1);
      expect(ctx.console.hasLog("Developer not initialized")).toBe(true);
    });

    it("should show message when no sessions exist", async () => {
      await setupDeveloper(ctx.tempDir, "testuser");
      await setupWorkspace(ctx.tempDir, "testuser");
      await createIndexFile(ctx.tempDir, "testuser", []);

      await ctx.run(["session", "list"]);

      expect(ctx.console.hasLog("No sessions found")).toBe(true);
    });

    it("should list sessions from index", async () => {
      await setupDeveloper(ctx.tempDir, "testuser");
      await setupWorkspace(ctx.tempDir, "testuser");
      await createIndexFile(ctx.tempDir, "testuser", [
        { number: 2, date: "2026-03-15", task: "Second Session", commits: "`def456`" },
        { number: 1, date: "2026-03-10", task: "First Session", commits: "`abc123`" },
      ]);

      await ctx.run(["session", "list"]);

      expect(ctx.console.hasLog("First Session")).toBe(true);
      expect(ctx.console.hasLog("Second Session")).toBe(true);
      expect(ctx.console.hasLog("Total: 2")).toBe(true);
    });

    it("should return JSON output with session details", async () => {
      await setupDeveloper(ctx.tempDir, "testuser");
      await setupWorkspace(ctx.tempDir, "testuser");
      await createIndexFile(ctx.tempDir, "testuser", [
        { number: 3, date: "2026-03-20", task: "Third Task", commits: "`ghi789`" },
        { number: 2, date: "2026-03-15", task: "Second Task", commits: "`def456`" },
        { number: 1, date: "2026-03-10", task: "First Task", commits: "-" },
      ]);

      const result = (await ctx.runJson(["session", "list"])) as {
        success: boolean;
        data: {
          sessions: Array<{ number: number; date: string; task: string; commits: string }>;
          total: number;
          showing: number;
        };
      };

      expect(result).not.toBeNull();
      expect(result?.success).toBe(true);
      expect(result?.data?.sessions).toHaveLength(3);
      expect(result?.data?.sessions[0].number).toBe(3);
      expect(result?.data?.sessions[0].task).toBe("Third Task");
      expect(result?.data?.total).toBe(3);
    });

    it("should respect --limit option", async () => {
      await setupDeveloper(ctx.tempDir, "testuser");
      await setupWorkspace(ctx.tempDir, "testuser");
      await createIndexFile(ctx.tempDir, "testuser", [
        { number: 5, date: "2026-03-20", task: "Fifth Task", commits: "-" },
        { number: 4, date: "2026-03-19", task: "Fourth Task", commits: "-" },
        { number: 3, date: "2026-03-18", task: "Third Task", commits: "-" },
        { number: 2, date: "2026-03-17", task: "Second Task", commits: "-" },
        { number: 1, date: "2026-03-16", task: "First Task", commits: "-" },
      ]);

      const result = (await ctx.runJson(["session", "list", "-n", "2"])) as {
        success: boolean;
        data: {
          sessions: Array<{ number: number }>;
          total: number;
          showing: number;
        };
      };

      expect(result?.success).toBe(true);
      expect(result?.data?.sessions).toHaveLength(2);
      expect(result?.data?.total).toBe(5);
      expect(result?.data?.showing).toBe(2);
    });

    it("should handle sessions with multiple commits", async () => {
      await setupDeveloper(ctx.tempDir, "testuser");
      await setupWorkspace(ctx.tempDir, "testuser");
      await createIndexFile(ctx.tempDir, "testuser", [
        { number: 1, date: "2026-03-10", task: "Multi Commit", commits: "`abc123`, `def456`, `ghi789`" },
      ]);

      const result = (await ctx.runJson(["session", "list"])) as {
        success: boolean;
        data: {
          sessions: Array<{ commits: string }>;
        };
      };

      expect(result?.success).toBe(true);
      expect(result?.data?.sessions[0].commits).toContain("abc123");
      expect(result?.data?.sessions[0].commits).toContain("def456");
      expect(result?.data?.sessions[0].commits).toContain("ghi789");
    });
  });

  // ===========================================================================
  // session list --all execution
  // ===========================================================================

  describe("session list --all", () => {
    it("should list sessions from all developers", async () => {
      await setupDeveloper(ctx.tempDir, "alice");

      // Setup workspace for alice
      await setupWorkspace(ctx.tempDir, "alice");
      await createIndexFile(ctx.tempDir, "alice", [
        { number: 1, date: "2026-03-10", task: "Alice Task", commits: "`aaa111`" },
      ]);

      // Setup workspace for bob (not current developer but has workspace)
      await setupWorkspace(ctx.tempDir, "bob");
      await createIndexFile(ctx.tempDir, "bob", [
        { number: 1, date: "2026-03-12", task: "Bob Task", commits: "`bbb222`" },
      ]);

      const result = (await ctx.runJson(["session", "list", "--all"])) as {
        success: boolean;
        data: {
          sessions: Array<{ developer: string; task: string }>;
          total: number;
        };
      };

      expect(result?.success).toBe(true);
      expect(result?.data?.sessions.length).toBe(2);

      // Sessions should include developer field
      const developers = result?.data?.sessions.map((s) => s.developer);
      expect(developers).toContain("alice");
      expect(developers).toContain("bob");
    });

    it("should sort sessions by date descending", async () => {
      await setupDeveloper(ctx.tempDir, "alice");

      await setupWorkspace(ctx.tempDir, "alice");
      await createIndexFile(ctx.tempDir, "alice", [
        { number: 1, date: "2026-03-10", task: "Old Task", commits: "-" },
      ]);

      await setupWorkspace(ctx.tempDir, "bob");
      await createIndexFile(ctx.tempDir, "bob", [
        { number: 1, date: "2026-03-15", task: "New Task", commits: "-" },
      ]);

      const result = (await ctx.runJson(["session", "list", "--all"])) as {
        success: boolean;
        data: {
          sessions: Array<{ date: string; task: string }>;
        };
      };

      expect(result?.success).toBe(true);
      // Bob's task is newer so should be first
      expect(result?.data?.sessions[0].task).toBe("New Task");
      expect(result?.data?.sessions[1].task).toBe("Old Task");
    });
  });

  // ===========================================================================
  // session add execution
  // ===========================================================================

  describe("session add", () => {
    it("should fail when developer not initialized", async () => {
      await ctx.run(["session", "add", "-t", "Test Session"]);

      expect(exitCode).toBe(1);
      expect(ctx.console.hasLog("Developer not initialized")).toBe(true);
    });

    it("should fail when workspace directory not found", async () => {
      await setupDeveloper(ctx.tempDir, "testuser");
      // No workspace directory created

      await ctx.run(["session", "add", "-t", "Test Session"]);

      expect(exitCode).toBe(1);
    });

    it("should add session to journal and update index", async () => {
      await setupDeveloper(ctx.tempDir, "testuser");
      await setupWorkspace(ctx.tempDir, "testuser");
      await createIndexFile(ctx.tempDir, "testuser", []);
      await createJournalFile(ctx.tempDir, "testuser", 1);

      await ctx.run(["session", "add", "-t", "New Feature", "-c", "abc123"]);

      // Check journal was updated
      const journalContent = await ctx.tempDir.readFile(
        ".viben/workspace/testuser/journal-1.md"
      );
      expect(journalContent).toContain("## Session 1: New Feature");
      expect(journalContent).toContain("abc123");

      // Check index was updated
      const indexContent = await ctx.tempDir.readFile(
        ".viben/workspace/testuser/index.md"
      );
      expect(indexContent).toContain("| 1 | 2026-03-20 | New Feature |");
      expect(indexContent).toContain("**Total Sessions**: 1");
    });

    it("should increment session number correctly", async () => {
      await setupDeveloper(ctx.tempDir, "testuser");
      await setupWorkspace(ctx.tempDir, "testuser");
      await createIndexFile(ctx.tempDir, "testuser", [
        { number: 5, date: "2026-03-15", task: "Existing Session", commits: "-" },
      ]);
      await createJournalFile(ctx.tempDir, "testuser", 1);

      await ctx.run(["session", "add", "-t", "Next Session"]);

      // Check index has session 6
      const indexContent = await ctx.tempDir.readFile(
        ".viben/workspace/testuser/index.md"
      );
      expect(indexContent).toContain("| 6 | 2026-03-20 | Next Session |");
      expect(indexContent).toContain("**Total Sessions**: 6");
    });

    it("should return JSON output on success", async () => {
      await setupDeveloper(ctx.tempDir, "testuser");
      await setupWorkspace(ctx.tempDir, "testuser");
      await createIndexFile(ctx.tempDir, "testuser", []);
      await createJournalFile(ctx.tempDir, "testuser", 1);

      const result = (await ctx.runJson(["session", "add", "-t", "JSON Test", "-c", "xyz789"])) as {
        success: boolean;
        data: {
          session: number;
          title: string;
          commit: string;
          journal_file: string;
        };
      };

      expect(result?.success).toBe(true);
      expect(result?.data?.session).toBe(1);
      expect(result?.data?.title).toBe("JSON Test");
      expect(result?.data?.commit).toBe("xyz789");
      expect(result?.data?.journal_file).toBe("journal-1.md");
    });

    it("should use default commit value '-' when not provided", async () => {
      await setupDeveloper(ctx.tempDir, "testuser");
      await setupWorkspace(ctx.tempDir, "testuser");
      await createIndexFile(ctx.tempDir, "testuser", []);
      await createJournalFile(ctx.tempDir, "testuser", 1);

      await ctx.run(["session", "add", "-t", "No Commit Session"]);

      // Check index has "-" for commits
      const indexContent = await ctx.tempDir.readFile(
        ".viben/workspace/testuser/index.md"
      );
      expect(indexContent).toContain("| 1 | 2026-03-20 | No Commit Session | - |");
    });

    it("should handle multiple commits", async () => {
      await setupDeveloper(ctx.tempDir, "testuser");
      await setupWorkspace(ctx.tempDir, "testuser");
      await createIndexFile(ctx.tempDir, "testuser", []);
      await createJournalFile(ctx.tempDir, "testuser", 1);

      await ctx.run(["session", "add", "-t", "Multi Commit", "-c", "abc123,def456,ghi789"]);

      // Check journal has all commits
      const journalContent = await ctx.tempDir.readFile(
        ".viben/workspace/testuser/journal-1.md"
      );
      expect(journalContent).toContain("`abc123`");
      expect(journalContent).toContain("`def456`");
      expect(journalContent).toContain("`ghi789`");

      // Check index has formatted commits
      const indexContent = await ctx.tempDir.readFile(
        ".viben/workspace/testuser/index.md"
      );
      expect(indexContent).toContain("`abc123`");
    });

    it("should include summary in journal content", async () => {
      await setupDeveloper(ctx.tempDir, "testuser");
      await setupWorkspace(ctx.tempDir, "testuser");
      await createIndexFile(ctx.tempDir, "testuser", []);
      await createJournalFile(ctx.tempDir, "testuser", 1);

      await ctx.run([
        "session",
        "add",
        "-t",
        "Summary Test",
        "-s",
        "This is a custom summary text",
      ]);

      const journalContent = await ctx.tempDir.readFile(
        ".viben/workspace/testuser/journal-1.md"
      );
      expect(journalContent).toContain("This is a custom summary text");
    });
  });

  // ===========================================================================
  // session add - journal rotation
  // ===========================================================================

  describe("session add - journal rotation", () => {
    it("should create new journal when exceeding MAX_JOURNAL_LINES", async () => {
      await setupDeveloper(ctx.tempDir, "testuser");
      await setupWorkspace(ctx.tempDir, "testuser");
      await createIndexFile(ctx.tempDir, "testuser", []);

      // Create a journal file with many lines (close to MAX_JOURNAL_LINES = 2000)
      const manyLines = Array(1995).fill("Line content here").join("\n");
      await createJournalFile(ctx.tempDir, "testuser", 1, `# Journal\n${manyLines}`);

      await ctx.run(["session", "add", "-t", "Rotation Test"]);

      // Check that journal-2.md was created
      const exists = await ctx.tempDir.exists(".viben/workspace/testuser/journal-2.md");
      expect(exists).toBe(true);

      // Check journal-2 content
      const journal2Content = await ctx.tempDir.readFile(
        ".viben/workspace/testuser/journal-2.md"
      );
      expect(journal2Content).toContain("Continuation from `journal-1.md`");
      expect(journal2Content).toContain("## Session 1: Rotation Test");

      // Check index was updated with journal-2 as active
      const indexContent = await ctx.tempDir.readFile(
        ".viben/workspace/testuser/index.md"
      );
      expect(indexContent).toContain("**Active File**: `journal-2.md`");
    });

    it("should NOT create new journal when exactly at limit", async () => {
      await setupDeveloper(ctx.tempDir, "testuser");
      await setupWorkspace(ctx.tempDir, "testuser");
      await createIndexFile(ctx.tempDir, "testuser", []);

      // Create a journal with fewer lines that won't exceed limit after adding session
      // Session content is roughly 30 lines, so 1950 + 30 = 1980 < 2000
      const manyLines = Array(1950).fill("Line").join("\n");
      await createJournalFile(ctx.tempDir, "testuser", 1, `# Journal\n${manyLines}`);

      await ctx.run(["session", "add", "-t", "Within Limit Test"]);

      // journal-2 should NOT be created
      const exists = await ctx.tempDir.exists(".viben/workspace/testuser/journal-2.md");
      expect(exists).toBe(false);

      // journal-1 should contain the new session
      const journal1Content = await ctx.tempDir.readFile(
        ".viben/workspace/testuser/journal-1.md"
      );
      expect(journal1Content).toContain("## Session 1: Within Limit Test");
    });
  });

  // ===========================================================================
  // Edge cases
  // ===========================================================================

  describe("edge cases", () => {
    it("should handle special characters in session title", async () => {
      await setupDeveloper(ctx.tempDir, "testuser");
      await setupWorkspace(ctx.tempDir, "testuser");
      await createIndexFile(ctx.tempDir, "testuser", []);
      await createJournalFile(ctx.tempDir, "testuser", 1);

      await ctx.run([
        "session",
        "add",
        "-t",
        'Fix: handle "quotes" & <special> chars',
      ]);

      const journalContent = await ctx.tempDir.readFile(
        ".viben/workspace/testuser/journal-1.md"
      );
      expect(journalContent).toContain('Fix: handle "quotes" & <special> chars');
    });

    it("should handle malformed index.md without markers", async () => {
      await setupDeveloper(ctx.tempDir, "testuser");
      await setupWorkspace(ctx.tempDir, "testuser");
      // Create index without proper markers
      await ctx.tempDir.writeFile(
        ".viben/workspace/testuser/index.md",
        "# Some content without markers\n"
      );
      await createJournalFile(ctx.tempDir, "testuser", 1);

      await ctx.run(["session", "add", "-t", "Test"]);

      // Should fail because markers not found
      expect(exitCode).toBe(1);
    });

    it("should handle empty workspace directory for list --all", async () => {
      await setupDeveloper(ctx.tempDir, "testuser");
      // Create workspace parent but no developer subdirectories
      await ctx.tempDir.mkdir(".viben/workspace");

      await ctx.run(["session", "list", "--all"]);

      expect(ctx.console.hasLog("No sessions found")).toBe(true);
    });
  });
});
