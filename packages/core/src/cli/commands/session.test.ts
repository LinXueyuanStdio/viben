/**
 * Session CLI Commands Tests
 *
 * Tests for the session management CLI commands.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Command } from "commander";
import { registerSessionCommand } from "./session";
import * as fs from "node:fs";
import * as child_process from "node:child_process";

// Mock node:fs
vi.mock("node:fs", () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  readdirSync: vi.fn(),
}));

// Mock node:child_process
vi.mock("node:child_process", () => ({
  spawnSync: vi.fn(),
  execSync: vi.fn(),
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

describe("Session CLI Commands", () => {
  let program: Command;
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let stderrSpy: ReturnType<typeof vi.spyOn>;

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
    stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    // Reset all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    stderrSpy.mockRestore();
    vi.clearAllMocks();
  });

  // ============================================================================
  // Helper to run command
  // ============================================================================
  async function runCommand(args: string[]): Promise<void> {
    await program.parseAsync(["node", "test", ...args]);
  }

  // ============================================================================
  // Helper to setup mocks for a valid workspace
  // ============================================================================
  function setupValidWorkspace(developer: string = "test-user") {
    // Mock existsSync
    vi.mocked(fs.existsSync).mockImplementation((path: fs.PathLike) => {
      const pathStr = path.toString();
      if (pathStr.includes(".viben")) return true;
      if (pathStr.includes(".developer")) return true;
      if (pathStr.includes("add_session.py")) return true;
      if (pathStr.includes("index.md")) return true;
      return false;
    });

    // Mock readFileSync for .developer file
    vi.mocked(fs.readFileSync).mockImplementation((path: fs.PathOrFileDescriptor) => {
      const pathStr = path.toString();
      if (pathStr.includes(".developer")) {
        return `name=${developer}\n`;
      }
      if (pathStr.includes("index.md")) {
        return getMockIndexContent();
      }
      return "";
    });

    // Mock readdirSync for workspace directory
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(fs.readdirSync).mockReturnValue([
      { name: developer, isDirectory: () => true },
    ] as any);

    // Mock spawnSync for Python
    vi.mocked(child_process.spawnSync).mockImplementation((command, args) => {
      if (command === "python3" && args?.includes("--version")) {
        return {
          status: 0,
          stdout: "Python 3.11.0",
          stderr: "",
          output: ["Python 3.11.0"],
          pid: 1234,
          signal: null,
        };
      }
      if (command === "python3" && args?.some((a) => a?.toString().includes("add_session.py"))) {
        return {
          status: 0,
          stdout: "",
          stderr: `========================================
ADD SESSION
========================================

Session: 5
Title: Test Session
Commit: abc1234

Current journal file: journal-1.md
Current lines: 100
New content lines: 50
Total after append: 150

[OK] Appended session to journal-1.md

Updating index.md for session 5...
  Title: Test Session
  Commit: \`abc1234\`
  Active File: journal-1.md

[OK] Updated index.md successfully!

========================================
[OK] Session 5 added successfully!
========================================

Files updated:
  - journal-1.md
  - index.md`,
          output: [""],
          pid: 1234,
          signal: null,
        };
      }
      return {
        status: 1,
        stdout: "",
        stderr: "Command not found",
        output: [""],
        pid: 1234,
        signal: null,
      };
    });
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

      expect(child_process.spawnSync).toHaveBeenCalledWith(
        "python3",
        expect.arrayContaining(["--title", "Test Session", "--commit", "abc1234"]),
        expect.any(Object)
      );
    });

    it("should support -t shorthand for title", async () => {
      setupValidWorkspace();

      await runCommand(["session", "add", "-t", "Short Title"]);

      expect(child_process.spawnSync).toHaveBeenCalledWith(
        "python3",
        expect.arrayContaining(["--title", "Short Title"]),
        expect.any(Object)
      );
    });

    it("should support -c shorthand for commit", async () => {
      setupValidWorkspace();

      await runCommand(["session", "add", "-t", "Title", "-c", "xyz789"]);

      expect(child_process.spawnSync).toHaveBeenCalledWith(
        "python3",
        expect.arrayContaining(["--commit", "xyz789"]),
        expect.any(Object)
      );
    });

    it("should support -s shorthand for summary", async () => {
      setupValidWorkspace();

      await runCommand(["session", "add", "-t", "Title", "-s", "A brief summary"]);

      expect(child_process.spawnSync).toHaveBeenCalledWith(
        "python3",
        expect.arrayContaining(["--summary", "A brief summary"]),
        expect.any(Object)
      );
    });

    it("should support --content-file option", async () => {
      setupValidWorkspace();

      await runCommand([
        "session",
        "add",
        "-t",
        "Title",
        "--content-file",
        "/path/to/notes.md",
      ]);

      expect(child_process.spawnSync).toHaveBeenCalledWith(
        "python3",
        expect.arrayContaining(["--content-file", "/path/to/notes.md"]),
        expect.any(Object)
      );
    });

    it("should fail when developer not initialized", async () => {
      vi.mocked(fs.existsSync).mockImplementation((path: fs.PathLike) => {
        const pathStr = path.toString();
        if (pathStr.includes(".viben")) return true;
        if (pathStr.includes(".developer")) return false;
        return false;
      });

      vi.mocked(fs.readFileSync).mockImplementation(() => "");

      await expect(
        runCommand(["session", "add", "-t", "Title"])
      ).rejects.toThrow();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Developer not initialized")
      );
    });

    it("should output JSON when --json flag is provided", async () => {
      setupValidWorkspace();

      await runCommand(["--json", "session", "add", "-t", "Test Session"]);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"success": true')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"session"')
      );
    });

    it("should pass multiple commits separated by comma", async () => {
      setupValidWorkspace();

      await runCommand([
        "session",
        "add",
        "-t",
        "Multi-commit",
        "-c",
        "abc123,def456,ghi789",
      ]);

      expect(child_process.spawnSync).toHaveBeenCalledWith(
        "python3",
        expect.arrayContaining(["--commit", "abc123,def456,ghi789"]),
        expect.any(Object)
      );
    });

    it("should use default commit value when not provided", async () => {
      setupValidWorkspace();

      await runCommand(["session", "add", "-t", "No Commit Session"]);

      expect(child_process.spawnSync).toHaveBeenCalledWith(
        "python3",
        expect.arrayContaining(["--commit", "-"]),
        expect.any(Object)
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

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Session History")
      );
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
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Total:")
      );
    });

    it("should support -n shorthand for limit", async () => {
      setupValidWorkspace("john");

      await runCommand(["session", "list", "-n", "3"]);

      expect(consoleSpy).toHaveBeenCalled();
    });

    it("should show message when no sessions exist", async () => {
      vi.mocked(fs.existsSync).mockImplementation((path: fs.PathLike) => {
        const pathStr = path.toString();
        if (pathStr.includes(".viben")) return true;
        if (pathStr.includes(".developer")) return true;
        if (pathStr.includes("index.md")) return false;
        return false;
      });

      vi.mocked(fs.readFileSync).mockImplementation((path: fs.PathOrFileDescriptor) => {
        if (path.toString().includes(".developer")) {
          return "name=john\n";
        }
        return "";
      });

      await runCommand(["session", "list"]);

      expect(consoleSpy).toHaveBeenCalledWith("No sessions found.");
    });

    it("should fail when developer not initialized", async () => {
      vi.mocked(fs.existsSync).mockImplementation((path: fs.PathLike) => {
        const pathStr = path.toString();
        if (pathStr.includes(".viben")) return true;
        if (pathStr.includes(".developer")) return false;
        return false;
      });

      vi.mocked(fs.readFileSync).mockImplementation(() => "");

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
      // Setup multiple developers
      vi.mocked(fs.existsSync).mockImplementation((path: fs.PathLike) => {
        const pathStr = path.toString();
        if (pathStr.includes(".viben")) return true;
        if (pathStr.includes(".developer")) return true;
        if (pathStr.includes("index.md")) return true;
        return false;
      });

      vi.mocked(fs.readFileSync).mockImplementation((path: fs.PathOrFileDescriptor) => {
        const pathStr = path.toString();
        if (pathStr.includes(".developer")) {
          return "name=john\n";
        }
        if (pathStr.includes("index.md")) {
          return getMockIndexContent();
        }
        return "";
      });

      vi.mocked(fs.readdirSync).mockReturnValue([
        { name: "john", isDirectory: () => true },
        { name: "jane", isDirectory: () => true },
      ] as any);

      await runCommand(["session", "list", "--all"]);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("All Users")
      );
    });

    it("should support -a shorthand for --all", async () => {
      setupValidWorkspace("john");

      vi.mocked(fs.readdirSync).mockReturnValue([
        { name: "john", isDirectory: () => true },
      ] as any);

      await runCommand(["session", "list", "-a"]);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("All Users")
      );
    });

    it("should include developer column when --all is used", async () => {
      setupValidWorkspace("john");

      vi.mocked(fs.readdirSync).mockReturnValue([
        { name: "john", isDirectory: () => true },
      ] as any);

      await runCommand(["session", "list", "--all"]);

      // The table should include "User" column header
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("User")
      );
    });

    it("should include developer field in JSON when --all is used", async () => {
      setupValidWorkspace("john");

      vi.mocked(fs.readdirSync).mockReturnValue([
        { name: "john", isDirectory: () => true },
      ] as any);

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
    it("should handle Python not found error", async () => {
      vi.mocked(fs.existsSync).mockImplementation((path: fs.PathLike) => {
        const pathStr = path.toString();
        if (pathStr.includes(".viben")) return true;
        if (pathStr.includes(".developer")) return true;
        if (pathStr.includes("add_session.py")) return true;
        return false;
      });

      vi.mocked(fs.readFileSync).mockImplementation((path: fs.PathOrFileDescriptor) => {
        if (path.toString().includes(".developer")) {
          return "name=john\n";
        }
        return "";
      });

      // Mock Python not found
      vi.mocked(child_process.spawnSync).mockReturnValue({
        status: 1,
        stdout: "",
        stderr: "command not found",
        output: [""],
        pid: 0,
        signal: null,
      });

      await expect(
        runCommand(["session", "add", "-t", "Title"])
      ).rejects.toThrow("process.exit(1)");
    });

    it("should handle script not found error", async () => {
      vi.mocked(fs.existsSync).mockImplementation((path: fs.PathLike) => {
        const pathStr = path.toString();
        if (pathStr.includes(".viben") && !pathStr.includes("scripts")) return true;
        if (pathStr.includes(".developer")) return true;
        // add_session.py specifically returns false
        if (pathStr.includes("add_session.py")) return false;
        if (pathStr.includes("scripts")) return true; // scripts dir exists
        return false;
      });

      vi.mocked(fs.readFileSync).mockImplementation((path: fs.PathOrFileDescriptor) => {
        if (path.toString().includes(".developer")) {
          return "name=john\n";
        }
        return "";
      });

      vi.mocked(child_process.spawnSync).mockImplementation((command, args) => {
        // Only Python version check succeeds
        if (command === "python3" && args?.includes("--version")) {
          return {
            status: 0,
            stdout: "Python 3.11.0",
            stderr: "",
            output: [""],
            pid: 1234,
            signal: null,
          };
        }
        // This should not be reached if script is not found
        throw new Error("Should not call script");
      });

      await expect(
        runCommand(["session", "add", "-t", "Title"])
      ).rejects.toThrow();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Script not found")
      );
    });

    it("should handle script execution error", async () => {
      vi.mocked(fs.existsSync).mockImplementation((path: fs.PathLike) => {
        const pathStr = path.toString();
        if (pathStr.includes(".viben")) return true;
        if (pathStr.includes(".developer")) return true;
        if (pathStr.includes("add_session.py")) return true;
        return false;
      });

      vi.mocked(fs.readFileSync).mockImplementation((path: fs.PathOrFileDescriptor) => {
        if (path.toString().includes(".developer")) {
          return "name=john\n";
        }
        return "";
      });

      vi.mocked(child_process.spawnSync).mockImplementation((command, args) => {
        if (command === "python3" && args?.includes("--version")) {
          return {
            status: 0,
            stdout: "Python 3.11.0",
            stderr: "",
            output: [""],
            pid: 1234,
            signal: null,
          };
        }
        // Script fails
        return {
          status: 1,
          stdout: "",
          stderr: "Error: Something went wrong",
          output: [""],
          pid: 1234,
          signal: null,
        };
      });

      await expect(
        runCommand(["session", "add", "-t", "Title"])
      ).rejects.toThrow("process.exit(1)");
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
      vi.mocked(fs.existsSync).mockImplementation((path: fs.PathLike) => {
        const pathStr = path.toString();
        if (pathStr.includes(".viben")) return true;
        if (pathStr.includes(".developer")) return true;
        return false;
      });

      vi.mocked(fs.readFileSync).mockImplementation((path: fs.PathOrFileDescriptor) => {
        if (path.toString().includes(".developer")) {
          return "name=john\n";
        }
        return "";
      });

      vi.mocked(fs.readdirSync).mockReturnValue([]);

      await runCommand(["session", "list", "--all"]);

      expect(consoleSpy).toHaveBeenCalledWith("No sessions found.");
    });

    it("should handle malformed index.md", async () => {
      vi.mocked(fs.existsSync).mockImplementation((path: fs.PathLike) => {
        const pathStr = path.toString();
        if (pathStr.includes(".viben")) return true;
        if (pathStr.includes(".developer")) return true;
        if (pathStr.includes("index.md")) return true;
        return false;
      });

      vi.mocked(fs.readFileSync).mockImplementation((path: fs.PathOrFileDescriptor) => {
        const pathStr = path.toString();
        if (pathStr.includes(".developer")) {
          return "name=john\n";
        }
        if (pathStr.includes("index.md")) {
          // Malformed - missing markers
          return "# Some content without markers\n";
        }
        return "";
      });

      await runCommand(["session", "list"]);

      expect(consoleSpy).toHaveBeenCalledWith("No sessions found.");
    });

    it("should handle special characters in session title", async () => {
      setupValidWorkspace();

      await runCommand([
        "session",
        "add",
        "-t",
        "Fix bug: handle \"quotes\" & <special> chars",
      ]);

      expect(child_process.spawnSync).toHaveBeenCalledWith(
        "python3",
        expect.arrayContaining([
          "--title",
          "Fix bug: handle \"quotes\" & <special> chars",
        ]),
        expect.any(Object)
      );
    });
  });
});
