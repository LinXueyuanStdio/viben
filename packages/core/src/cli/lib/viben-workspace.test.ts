/**
 * Viben Workspace Utilities Tests
 *
 * Tests for the viben-workspace module that implements Python scripts logic.
 * Ensures TypeScript implementation matches Python templates/viben/scripts/common/
 *
 * Python reference files:
 * - templates/viben/scripts/common/paths.py
 * - templates/viben/scripts/common/git_context.py
 * - templates/viben/scripts/common/developer.py
 * - templates/viben/scripts/add_session.py
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { join } from "node:path";

// Mock fs modules
vi.mock("node:fs", () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  readdirSync: vi.fn(),
  statSync: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  appendFile: vi.fn(),
  mkdir: vi.fn(),
}));

vi.mock("node:child_process", () => ({
  execSync: vi.fn(),
}));

import * as fs from "node:fs";
import * as fsPromises from "node:fs/promises";
import { execSync } from "node:child_process";

import {
  // Constants
  DIR_VIBEN,
  DIR_WORKSPACE,
  DIR_TASKS,
  DIR_ARCHIVE,
  DIR_SPEC,
  FILE_DEVELOPER,
  FILE_CURRENT_TASK,
  FILE_TASK_JSON,
  FILE_JOURNAL_PREFIX,
  MAX_JOURNAL_LINES,
  // Functions
  findVibenRoot,
  getDeveloper,
  checkDeveloper,
  getWorkspaceDir,
  getTasksDir,
  getAllDevelopers,
  getActiveJournalFile,
  getJournalInfo,
  countLines,
  getCurrentTask,
  getCurrentTaskAbs,
  runGitCommand,
  getGitBranch,
  getGitStatus,
  getGitStatusCount,
  getRecentCommits,
  readTaskJson,
  getActiveTasks,
  getCurrentSessionNumber,
  generateSessionContent,
  createNewJournalFile,
  updateIndexWithSession,
  getTodayDate,
  getDatePrefix,
  getYearMonth,
  slugify,
  findTaskByName,
  resolveTaskDirectory,
  setCurrentTask,
  clearCurrentTask,
  getArchiveDir,
  isSafeTaskPath,
} from "./viben-workspace";

describe("viben-workspace constants", () => {
  /**
   * Tests for constants matching Python paths.py
   * Reference: templates/viben/scripts/common/paths.py lines 24-36
   */

  it("should have correct directory constants", () => {
    // Python: DIR_WORKFLOW = ".viben"
    expect(DIR_VIBEN).toBe(".viben");
    // Python: DIR_WORKSPACE = "workspace"
    expect(DIR_WORKSPACE).toBe("workspace");
    // Python: DIR_TASKS = "tasks"
    expect(DIR_TASKS).toBe("tasks");
    // Python: DIR_ARCHIVE = "archive"
    expect(DIR_ARCHIVE).toBe("archive");
    // Python: DIR_SPEC = "spec"
    expect(DIR_SPEC).toBe("spec");
  });

  it("should have correct file constants", () => {
    // Python: FILE_DEVELOPER = ".developer"
    expect(FILE_DEVELOPER).toBe(".developer");
    // Python: FILE_CURRENT_TASK = ".current-task"
    expect(FILE_CURRENT_TASK).toBe(".current-task");
    // Python: FILE_TASK_JSON = "task.json"
    expect(FILE_TASK_JSON).toBe("task.json");
    // Python: FILE_JOURNAL_PREFIX = "journal-"
    expect(FILE_JOURNAL_PREFIX).toBe("journal-");
  });

  it("should have correct MAX_JOURNAL_LINES constant", () => {
    // Python: MAX_LINES = 2000 (add_session.py line 39)
    expect(MAX_JOURNAL_LINES).toBe(2000);
  });
});

describe("findVibenRoot", () => {
  /**
   * Tests for finding .viben root directory
   * Reference: templates/viben/scripts/common/paths.py lines 43-62
   */

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return null when no .viben directory found", () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const result = findVibenRoot("/some/path");

    expect(result).toBeNull();
  });

  it("should return parent directory containing .viben", () => {
    vi.mocked(fs.existsSync).mockImplementation((path) => {
      return path === "/workspace/.viben";
    });

    const result = findVibenRoot("/workspace/src/lib");

    expect(result).toBe("/workspace");
  });

  it("should handle nested directories correctly", () => {
    vi.mocked(fs.existsSync).mockImplementation((path) => {
      return path === "/home/user/project/.viben";
    });

    const result = findVibenRoot("/home/user/project/src/components");

    expect(result).toBe("/home/user/project");
  });
});

describe("getDeveloper", () => {
  /**
   * Tests for reading developer name
   * Reference: templates/viben/scripts/common/paths.py lines 69-94
   */

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return null when .developer file does not exist", () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const result = getDeveloper("/workspace");

    expect(result).toBeNull();
  });

  it("should return developer name from .developer file", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue("name=john\ninitialized_at=2024-01-01\n");

    const result = getDeveloper("/workspace");

    expect(result).toBe("john");
  });

  it("should handle malformed .developer file", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue("invalid content");

    const result = getDeveloper("/workspace");

    expect(result).toBeNull();
  });

  it("should trim whitespace from developer name", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue("name=  alice  \n");

    const result = getDeveloper("/workspace");

    expect(result).toBe("alice");
  });
});

describe("checkDeveloper", () => {
  /**
   * Tests for checking if developer is initialized
   * Reference: templates/viben/scripts/common/paths.py lines 97-106
   */

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return false when developer not initialized", () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const result = checkDeveloper("/workspace");

    expect(result).toBe(false);
  });

  it("should return true when developer is initialized", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue("name=john\n");

    const result = checkDeveloper("/workspace");

    expect(result).toBe(true);
  });
});

describe("getWorkspaceDir", () => {
  /**
   * Tests for getting workspace directory path
   * Reference: templates/viben/scripts/common/paths.py lines 131-146
   */

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return null when developer not set", () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const result = getWorkspaceDir("/workspace");

    expect(result).toBeNull();
  });

  it("should return workspace path for developer", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue("name=john\n");

    const result = getWorkspaceDir("/workspace");

    // Python: repo_root / DIR_WORKFLOW / DIR_WORKSPACE / developer
    expect(result).toBe(join("/workspace", ".viben", "workspace", "john"));
  });

  it("should use provided developer name", () => {
    const result = getWorkspaceDir("/workspace", "alice");

    expect(result).toBe(join("/workspace", ".viben", "workspace", "alice"));
  });
});

describe("getTasksDir", () => {
  /**
   * Tests for getting tasks directory path
   * Reference: templates/viben/scripts/common/paths.py lines 113-124
   */

  it("should return tasks directory path", () => {
    const result = getTasksDir("/workspace");

    // Python: repo_root / DIR_WORKFLOW / DIR_TASKS
    expect(result).toBe(join("/workspace", ".viben", "tasks"));
  });
});

describe("getAllDevelopers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return empty array when workspace dir does not exist", () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const result = getAllDevelopers("/workspace");

    expect(result).toEqual([]);
  });

  it("should return list of developer directories", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readdirSync).mockReturnValue([
      { name: "john", isDirectory: () => true } as unknown as fs.Dirent,
      { name: "alice", isDirectory: () => true } as unknown as fs.Dirent,
      { name: ".gitkeep", isDirectory: () => false } as unknown as fs.Dirent,
    ]);

    const result = getAllDevelopers("/workspace");

    expect(result).toEqual(["john", "alice"]);
  });

  it("should exclude hidden directories", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readdirSync).mockReturnValue([
      { name: "john", isDirectory: () => true } as unknown as fs.Dirent,
      { name: ".hidden", isDirectory: () => true } as unknown as fs.Dirent,
    ]);

    const result = getAllDevelopers("/workspace");

    expect(result).toEqual(["john"]);
  });
});

describe("getActiveJournalFile", () => {
  /**
   * Tests for getting active journal file
   * Reference: templates/viben/scripts/common/paths.py lines 153-185
   */

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return null when workspace dir does not exist", () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const result = getActiveJournalFile("/workspace");

    expect(result).toBeNull();
  });

  it("should return highest numbered journal file", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue("name=john\n");
    vi.mocked(fs.readdirSync).mockReturnValue([
      "journal-1.md",
      "journal-3.md",
      "journal-2.md",
      "index.md",
    ]);

    const result = getActiveJournalFile("/workspace");

    // Python: finds highest number, returns that file
    expect(result).toContain("journal-3.md");
  });

  it("should return null when no journal files exist", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue("name=john\n");
    vi.mocked(fs.readdirSync).mockReturnValue(["index.md", "notes.txt"]);

    const result = getActiveJournalFile("/workspace");

    expect(result).toBeNull();
  });
});

describe("getJournalInfo", () => {
  /**
   * Tests for getting journal file info
   * Reference: templates/viben/scripts/add_session.py lines 46-70
   */

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return null file and 0 values when no journal exists", () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const result = getJournalInfo("/workspace");

    // Python: return None, 0, 0
    expect(result).toEqual({ file: null, number: 0, lines: 0 });
  });

  it("should return correct journal info", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockImplementation((path) => {
      if (String(path).includes(".developer")) return "name=john\n";
      if (String(path).includes("journal-2.md")) return "Line1\nLine2\nLine3\n";
      return "";
    });
    vi.mocked(fs.readdirSync).mockReturnValue(["journal-1.md", "journal-2.md"]);

    const result = getJournalInfo("/workspace");

    expect(result.file).toContain("journal-2.md");
    expect(result.number).toBe(2);
    expect(result.lines).toBe(4); // 3 lines + empty line at end
  });
});

describe("countLines", () => {
  /**
   * Tests for counting lines in a file
   * Reference: templates/viben/scripts/common/paths.py lines 188-203
   */

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 0 when file does not exist", () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const result = countLines("/path/to/file.md");

    expect(result).toBe(0);
  });

  it("should return correct line count", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue("Line1\nLine2\nLine3");

    const result = countLines("/path/to/file.md");

    // Python: len(file_path.read_text().splitlines())
    expect(result).toBe(3);
  });

  it("should handle empty file", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue("");

    const result = countLines("/path/to/file.md");

    expect(result).toBe(1); // Empty string split gives [""]
  });
});

describe("getCurrentTask", () => {
  /**
   * Tests for getting current task
   * Reference: templates/viben/scripts/common/paths.py lines 224-241
   */

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return null when .current-task does not exist", () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const result = getCurrentTask("/workspace");

    expect(result).toBeNull();
  });

  it("should return task path from .current-task file", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(".viben/tasks/01-01-my-task\n");

    const result = getCurrentTask("/workspace");

    expect(result).toBe(".viben/tasks/01-01-my-task");
  });

  it("should trim whitespace from task path", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue("  .viben/tasks/task  \n");

    const result = getCurrentTask("/workspace");

    expect(result).toBe(".viben/tasks/task");
  });

  it("should return null for empty file", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue("");

    const result = getCurrentTask("/workspace");

    expect(result).toBeNull();
  });
});

describe("getCurrentTaskAbs", () => {
  /**
   * Tests for getting current task absolute path
   * Reference: templates/viben/scripts/common/paths.py lines 244-259
   */

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return null when no current task", () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const result = getCurrentTaskAbs("/workspace");

    expect(result).toBeNull();
  });

  it("should return absolute path to task", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(".viben/tasks/01-01-task");

    const result = getCurrentTaskAbs("/workspace");

    expect(result).toBe(join("/workspace", ".viben/tasks/01-01-task"));
  });
});

describe("runGitCommand", () => {
  /**
   * Tests for running git commands
   * Reference: templates/viben/scripts/common/git_context.py lines 48-67
   */

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return stdout on success", () => {
    vi.mocked(execSync).mockReturnValue("main\n");

    const result = runGitCommand(["branch", "--show-current"], "/workspace");

    expect(result.code).toBe(0);
    expect(result.stdout).toBe("main\n");
    expect(result.stderr).toBe("");
  });

  it("should handle git command failure", () => {
    vi.mocked(execSync).mockImplementation(() => {
      const error = new Error("git error") as Error & {
        status: number;
        stdout: string;
        stderr: string;
      };
      error.status = 1;
      error.stdout = "";
      error.stderr = "fatal: not a git repository";
      throw error;
    });

    const result = runGitCommand(["status"], "/not-a-repo");

    expect(result.code).toBe(1);
  });

  it("should add UTF-8 encoding flag", () => {
    vi.mocked(execSync).mockReturnValue("");

    runGitCommand(["log"], "/workspace");

    expect(execSync).toHaveBeenCalledWith(
      expect.stringContaining("i18n.logOutputEncoding=UTF-8"),
      expect.any(Object)
    );
  });
});

describe("getGitBranch", () => {
  /**
   * Tests for getting git branch
   * Reference: templates/viben/scripts/common/git_context.py lines 108-109
   */

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return branch name", () => {
    vi.mocked(execSync).mockReturnValue("feature/my-branch\n");

    const result = getGitBranch("/workspace");

    expect(result).toBe("feature/my-branch");
  });

  it("should return 'unknown' when no branch", () => {
    vi.mocked(execSync).mockReturnValue("");

    const result = getGitBranch("/workspace");

    // Python: branch = branch_out.strip() or "unknown"
    expect(result).toBe("unknown");
  });
});

describe("getGitStatus", () => {
  /**
   * Tests for getting git status
   * Reference: templates/viben/scripts/common/git_context.py lines 111-112, 215-227
   */

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return status lines", () => {
    vi.mocked(execSync).mockReturnValue(" M src/file.ts\n?? new.ts\n");

    const result = getGitStatus("/workspace");

    expect(result).toContain(" M src/file.ts");
    expect(result).toContain("?? new.ts");
  });

  it("should return empty array when clean", () => {
    vi.mocked(execSync).mockReturnValue("");

    const result = getGitStatus("/workspace");

    expect(result).toEqual([]);
  });

  it("should limit to 10 lines", () => {
    const manyLines = Array(15)
      .fill(0)
      .map((_, i) => `M file${i}.ts`)
      .join("\n");
    vi.mocked(execSync).mockReturnValue(manyLines);

    const result = getGitStatus("/workspace");

    expect(result.length).toBeLessThanOrEqual(10);
  });
});

describe("getGitStatusCount", () => {
  /**
   * Tests for getting git status count
   * Reference: templates/viben/scripts/common/git_context.py lines 111-113
   */

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return count of changed files", () => {
    vi.mocked(execSync).mockReturnValue(" M file1.ts\n M file2.ts\n?? file3.ts\n");

    const result = getGitStatusCount("/workspace");

    // Python: git_status_count = len([line for line in status_out.splitlines() if line.strip()])
    expect(result).toBe(3);
  });

  it("should return 0 when clean", () => {
    vi.mocked(execSync).mockReturnValue("");

    const result = getGitStatusCount("/workspace");

    expect(result).toBe(0);
  });
});

describe("getRecentCommits", () => {
  /**
   * Tests for getting recent commits
   * Reference: templates/viben/scripts/common/git_context.py lines 116-124
   */

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return commit hash and message", () => {
    vi.mocked(execSync).mockReturnValue("abc1234 feat: add feature\ndef5678 fix: bug fix\n");

    const result = getRecentCommits("/workspace");

    // Python: commits.append({"hash": parts[0], "message": parts[1]})
    expect(result[0]).toEqual({ hash: "abc1234", message: "feat: add feature" });
    expect(result[1]).toEqual({ hash: "def5678", message: "fix: bug fix" });
  });

  it("should handle commit with no message", () => {
    vi.mocked(execSync).mockReturnValue("abc1234\n");

    const result = getRecentCommits("/workspace");

    expect(result[0]).toEqual({ hash: "abc1234", message: "" });
  });

  it("should return empty array when no commits", () => {
    vi.mocked(execSync).mockReturnValue("");

    const result = getRecentCommits("/workspace");

    expect(result).toEqual([]);
  });

  it("should respect count parameter", () => {
    vi.mocked(execSync).mockReturnValue("a\nb\nc\n");

    getRecentCommits("/workspace", 3);

    expect(execSync).toHaveBeenCalledWith(
      expect.stringContaining("-3"),
      expect.any(Object)
    );
  });
});

describe("readTaskJson", () => {
  /**
   * Tests for reading task.json
   * Reference: templates/viben/scripts/common/git_context.py lines 70-75
   */

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return null when task.json does not exist", () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const result = readTaskJson("/workspace/.viben/tasks/01-01-task");

    expect(result).toBeNull();
  });

  it("should return parsed task data", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(
      '{"name": "my-task", "status": "in_progress"}'
    );

    const result = readTaskJson("/workspace/.viben/tasks/01-01-task");

    expect(result).toEqual({ name: "my-task", status: "in_progress" });
  });

  it("should return null on invalid JSON", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue("invalid json");

    const result = readTaskJson("/workspace/.viben/tasks/01-01-task");

    expect(result).toBeNull();
  });
});

describe("getActiveTasks", () => {
  /**
   * Tests for getting active tasks
   * Reference: templates/viben/scripts/common/git_context.py lines 128-141
   */

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return empty array when tasks dir does not exist", () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const result = getActiveTasks("/workspace");

    expect(result).toEqual([]);
  });

  it("should exclude archive directory", () => {
    vi.mocked(fs.existsSync).mockImplementation((path) => {
      return !String(path).includes("task.json");
    });
    vi.mocked(fs.readdirSync).mockReturnValue([
      { name: "01-01-task", isDirectory: () => true } as unknown as fs.Dirent,
      { name: "archive", isDirectory: () => true } as unknown as fs.Dirent,
    ]);

    const result = getActiveTasks("/workspace");

    // Python: if d.is_dir() and d.name != "archive":
    expect(result.every((t) => t.dir !== "archive")).toBe(true);
  });
});

describe("getCurrentSessionNumber", () => {
  /**
   * Tests for getting current session number
   * Reference: templates/viben/scripts/add_session.py lines 73-84
   */

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 0 when index.md does not exist", () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const result = getCurrentSessionNumber("/workspace/.viben/workspace/john/index.md");

    expect(result).toBe(0);
  });

  it("should parse session number from index.md", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(
      "## Status\n- **Total Sessions**: 42\n"
    );

    const result = getCurrentSessionNumber("/workspace/.viben/workspace/john/index.md");

    // Python: match = re.search(r":\s*(\d+)", line)
    expect(result).toBe(42);
  });

  it("should return 0 when Total Sessions not found", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue("## Status\nNo sessions yet\n");

    const result = getCurrentSessionNumber("/workspace/.viben/workspace/john/index.md");

    expect(result).toBe(0);
  });
});

describe("generateSessionContent", () => {
  /**
   * Tests for generating session content
   * Reference: templates/viben/scripts/add_session.py lines 130-178
   */

  it("should generate markdown with session header", () => {
    const result = generateSessionContent({
      sessionNum: 5,
      title: "Test Session",
      commit: "abc123",
      summary: "Test summary",
      extraContent: "Extra content",
      date: "2024-03-03",
    });

    // Python: f"## Session {session_num}: {title}"
    expect(result).toContain("## Session 5: Test Session");
    expect(result).toContain("**Date**: 2024-03-03");
    expect(result).toContain("**Task**: Test Session");
  });

  it("should generate commit table for single commit", () => {
    const result = generateSessionContent({
      sessionNum: 1,
      title: "Test",
      commit: "abc123",
      summary: "Summary",
      extraContent: "",
      date: "2024-01-01",
    });

    // Python: commit_table = "| Hash | Message |\n|------|---------|"
    expect(result).toContain("| Hash | Message |");
    expect(result).toContain("| `abc123` | (see git log) |");
  });

  it("should generate commit table for multiple commits", () => {
    const result = generateSessionContent({
      sessionNum: 1,
      title: "Test",
      commit: "abc,def,ghi",
      summary: "Summary",
      extraContent: "",
      date: "2024-01-01",
    });

    // Python: for c in commit.split(","):
    expect(result).toContain("| `abc` |");
    expect(result).toContain("| `def` |");
    expect(result).toContain("| `ghi` |");
  });

  it("should show no commits message when commit is '-'", () => {
    const result = generateSessionContent({
      sessionNum: 1,
      title: "Test",
      commit: "-",
      summary: "Summary",
      extraContent: "",
      date: "2024-01-01",
    });

    // Python: commit_table = "(No commits - planning session)"
    expect(result).toContain("(No commits - planning session)");
  });
});

describe("createNewJournalFile", () => {
  /**
   * Tests for creating new journal file
   * Reference: templates/viben/scripts/add_session.py lines 113-127
   */

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fsPromises.writeFile).mockResolvedValue();
  });

  it("should create file with correct header", async () => {
    const result = await createNewJournalFile({
      workspaceDir: "/workspace/.viben/workspace/john",
      number: 2,
      developer: "john",
      date: "2024-03-03",
      prevNumber: 1,
    });

    expect(fsPromises.writeFile).toHaveBeenCalledWith(
      expect.stringContaining("journal-2.md"),
      expect.stringContaining("# Journal - john (Part 2)"),
      "utf-8"
    );
  });

  it("should reference previous journal in header", async () => {
    await createNewJournalFile({
      workspaceDir: "/workspace/.viben/workspace/john",
      number: 3,
      developer: "john",
      date: "2024-03-03",
      prevNumber: 2,
    });

    // Python: f"> Continuation from `{FILE_JOURNAL_PREFIX}{prev_num}.md`"
    expect(fsPromises.writeFile).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining("Continuation from `journal-2.md`"),
      "utf-8"
    );
  });

  it("should return path to new file", async () => {
    const result = await createNewJournalFile({
      workspaceDir: "/workspace/.viben/workspace/john",
      number: 4,
      developer: "john",
      date: "2024-03-03",
      prevNumber: 3,
    });

    expect(result).toContain("journal-4.md");
  });
});

describe("updateIndexWithSession", () => {
  /**
   * Tests for updating index.md
   * Reference: templates/viben/scripts/add_session.py lines 181-277
   */

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return false when index.md does not exist", async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const result = await updateIndexWithSession({
      indexPath: "/workspace/index.md",
      workspaceDir: "/workspace",
      sessionNum: 1,
      title: "Test",
      commit: "abc",
      activeFile: "journal-1.md",
      date: "2024-03-03",
    });

    expect(result).toBe(false);
  });

  it("should return false when markers not found", async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fsPromises.readFile).mockResolvedValue("No markers here");

    const result = await updateIndexWithSession({
      indexPath: "/workspace/index.md",
      workspaceDir: "/workspace",
      sessionNum: 1,
      title: "Test",
      commit: "abc",
      activeFile: "journal-1.md",
      date: "2024-03-03",
    });

    // Python: if "@@@auto:current-status" not in content: return False
    expect(result).toBe(false);
  });
});

describe("date utilities", () => {
  /**
   * Tests for date formatting functions
   */

  describe("getTodayDate", () => {
    it("should return date in YYYY-MM-DD format", () => {
      const result = getTodayDate();

      // Should match YYYY-MM-DD pattern
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe("getDatePrefix", () => {
    it("should return date in MM-DD format", () => {
      const result = getDatePrefix();

      // Python: datetime.now().strftime("%m-%d")
      expect(result).toMatch(/^\d{2}-\d{2}$/);
    });
  });

  describe("getYearMonth", () => {
    it("should return date in YYYY-MM format", () => {
      const result = getYearMonth();

      expect(result).toMatch(/^\d{4}-\d{2}$/);
    });
  });
});

describe("slugify", () => {
  it("should convert to lowercase", () => {
    const result = slugify("Hello World");

    expect(result).toBe("hello-world");
  });

  it("should replace non-alphanumeric with hyphens", () => {
    const result = slugify("Test: Feature #1");

    expect(result).toBe("test-feature-1");
  });

  it("should collapse multiple hyphens", () => {
    const result = slugify("test---multiple---hyphens");

    expect(result).toBe("test-multiple-hyphens");
  });

  it("should trim leading and trailing hyphens", () => {
    const result = slugify("--test--");

    expect(result).toBe("test");
  });
});

describe("findTaskByName", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return null when tasksDir does not exist", () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const result = findTaskByName("my-task", "/workspace/.viben/tasks");

    expect(result).toBeNull();
  });

  it("should find task by exact name", () => {
    vi.mocked(fs.existsSync).mockImplementation((path) => {
      const pathStr = String(path);
      // Both tasks dir and exact task path should exist
      return (
        pathStr === "/workspace/.viben/tasks" ||
        pathStr === "/workspace/.viben/tasks/01-01-my-task"
      );
    });
    vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => true } as fs.Stats);

    const result = findTaskByName("01-01-my-task", "/workspace/.viben/tasks");

    expect(result).toBe("/workspace/.viben/tasks/01-01-my-task");
  });

  it("should find task by suffix match", () => {
    vi.mocked(fs.existsSync).mockImplementation((path) => {
      return String(path) === "/workspace/.viben/tasks";
    });
    vi.mocked(fs.readdirSync).mockReturnValue([
      { name: "01-01-my-task", isDirectory: () => true } as unknown as fs.Dirent,
      { name: "01-02-other-task", isDirectory: () => true } as unknown as fs.Dirent,
    ]);

    const result = findTaskByName("my-task", "/workspace/.viben/tasks");

    expect(result).toBe("/workspace/.viben/tasks/01-01-my-task");
  });
});

describe("isSafeTaskPath", () => {
  /**
   * Tests for path safety validation
   */

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should reject empty path", () => {
    expect(isSafeTaskPath("", "/workspace")).toBe(false);
  });

  it("should reject null string", () => {
    expect(isSafeTaskPath("null", "/workspace")).toBe(false);
  });

  it("should reject absolute paths", () => {
    expect(isSafeTaskPath("/etc/passwd", "/workspace")).toBe(false);
  });

  it("should reject path traversal", () => {
    expect(isSafeTaskPath("../", "/workspace")).toBe(false);
    expect(isSafeTaskPath("./", "/workspace")).toBe(false);
    expect(isSafeTaskPath("..", "/workspace")).toBe(false);
    expect(isSafeTaskPath(".", "/workspace")).toBe(false);
  });

  it("should accept valid task path", () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    expect(isSafeTaskPath(".viben/tasks/01-01-task", "/workspace")).toBe(true);
  });
});

describe("getArchiveDir", () => {
  it("should return archive directory path", () => {
    const result = getArchiveDir("/workspace");

    expect(result).toBe(join("/workspace", ".viben", "tasks", "archive"));
  });
});
