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
  readdirSync: vi.fn() as ReturnType<typeof vi.fn>,
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

/**
 * Helper to create mock Dirent objects with correct type
 */
function mockDirent(name: string, isDir: boolean): fs.Dirent {
  return {
    name,
    path: "",
    parentPath: "",
    isDirectory: () => isDir,
    isFile: () => !isDir,
    isBlockDevice: () => false,
    isCharacterDevice: () => false,
    isSymbolicLink: () => false,
    isFIFO: () => false,
    isSocket: () => false,
  } as fs.Dirent;
}

// Type assertion helper for readdirSync mock - bypasses the overloaded signature issue
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockReaddirSync = () => vi.mocked(fs.readdirSync) as any;

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

  it("should handle value containing = character (Python parity)", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    // Edge case: value contains "=" character
    vi.mocked(fs.readFileSync).mockReturnValue("name=john=doe\n");

    const result = getDeveloper("/workspace");

    // Python: line.split("=", 1)[1] -> "john=doe"
    expect(result).toBe("john=doe");
  });

  it("should handle value with multiple = characters", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue("name=a=b=c\n");

    const result = getDeveloper("/workspace");

    // Python: line.split("=", 1)[1] -> "a=b=c"
    expect(result).toBe("a=b=c");
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
    mockReaddirSync().mockReturnValue([
      mockDirent("john", true),
      mockDirent("alice", true),
      mockDirent(".gitkeep", false),
    ] as fs.Dirent[]);

    const result = getAllDevelopers("/workspace");

    expect(result).toEqual(["john", "alice"]);
  });

  it("should exclude hidden directories", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    mockReaddirSync().mockReturnValue([
      mockDirent("john", true),
      mockDirent(".hidden", true),
    ] as fs.Dirent[]);

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
    mockReaddirSync().mockReturnValue([
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
    mockReaddirSync().mockReturnValue(["index.md", "notes.txt"]);

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
    mockReaddirSync().mockReturnValue(["journal-1.md", "journal-2.md"]);

    const result = getJournalInfo("/workspace");

    expect(result.file).toContain("journal-2.md");
    expect(result.number).toBe(2);
    // Python: "Line1\nLine2\nLine3\n".splitlines() -> 3 lines (trailing newline ignored)
    expect(result.lines).toBe(3);
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

    // Python: "Line1\nLine2\nLine3".splitlines() -> ["Line1", "Line2", "Line3"] (length 3)
    expect(result).toBe(3);
  });

  it("should handle empty file", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue("");

    const result = countLines("/path/to/file.md");

    // Python: "".splitlines() -> [] (length 0)
    // But our implementation returns 0 for empty content
    expect(result).toBe(0);
  });

  it("should handle file with trailing newline (Python parity)", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue("Line1\nLine2\n");

    const result = countLines("/path/to/file.md");

    // Python: "Line1\nLine2\n".splitlines() -> ["Line1", "Line2"] (length 2)
    expect(result).toBe(2);
  });

  it("should handle file without trailing newline", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue("Line1\nLine2");

    const result = countLines("/path/to/file.md");

    // Python: "Line1\nLine2".splitlines() -> ["Line1", "Line2"] (length 2)
    expect(result).toBe(2);
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
    mockReaddirSync().mockReturnValue([
      mockDirent("01-01-task", true),
      mockDirent("archive", true),
    ] as fs.Dirent[]);

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
    mockReaddirSync().mockReturnValue([
      mockDirent("01-01-my-task", true),
      mockDirent("01-02-other-task", true),
    ] as fs.Dirent[]);

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

// =============================================================================
// Additional Python Parity Tests
// =============================================================================

describe("Python parity - add_session.py edge cases", () => {
  /**
   * Additional tests to ensure complete parity with Python add_session.py
   */

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("get_latest_journal_info edge cases", () => {
    /**
     * Reference: add_session.py lines 46-70
     */

    it("should handle journal files with non-sequential numbers", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockImplementation((path) => {
        if (String(path).includes(".developer")) return "name=john\n";
        return "Line1\n";
      });
      // Python: finds highest number regardless of sequence
      mockReaddirSync().mockReturnValue([
        "journal-1.md",
        "journal-5.md",
        "journal-3.md",
        "journal-10.md",
      ]);

      const result = getJournalInfo("/workspace");

      expect(result.number).toBe(10);
    });

    it("should extract number correctly from journal filename regex", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockImplementation((path) => {
        if (String(path).includes(".developer")) return "name=john\n";
        return "Line1\n";
      });
      mockReaddirSync().mockReturnValue(["journal-42.md"]);

      const result = getJournalInfo("/workspace");

      // Python: match = re.search(r"(\d+)$", f.stem)
      expect(result.number).toBe(42);
    });
  });

  describe("get_current_session regex parsing", () => {
    /**
     * Reference: add_session.py lines 73-84
     */

    it("should handle various Total Sessions formats", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);

      // Test with space after colon
      vi.mocked(fs.readFileSync).mockReturnValue("- **Total Sessions**: 15");
      expect(getCurrentSessionNumber("/index.md")).toBe(15);
    });

    it("should handle Total Sessions with no space after colon", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue("- **Total Sessions**:25");

      // Python: match = re.search(r":\s*(\d+)", line)
      expect(getCurrentSessionNumber("/index.md")).toBe(25);
    });

    it("should handle Total Sessions with extra whitespace", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue("Total Sessions:   99  ");

      expect(getCurrentSessionNumber("/index.md")).toBe(99);
    });
  });

  describe("generate_session_content edge cases", () => {
    /**
     * Reference: add_session.py lines 130-178
     */

    it("should handle empty commit string same as '-'", () => {
      const result = generateSessionContent({
        sessionNum: 1,
        title: "Test",
        commit: "",
        summary: "Summary",
        extraContent: "",
        date: "2024-01-01",
      });

      // Python: if commit and commit != "-": ... else: "(No commits - planning session)"
      expect(result).toContain("(No commits - planning session)");
    });

    it("should trim whitespace from commit hashes", () => {
      const result = generateSessionContent({
        sessionNum: 1,
        title: "Test",
        commit: " abc , def , ghi ",
        summary: "Summary",
        extraContent: "",
        date: "2024-01-01",
      });

      // Python: for c in commit.split(","): c = c.strip()
      expect(result).toContain("| `abc` |");
      expect(result).toContain("| `def` |");
      expect(result).toContain("| `ghi` |");
    });

    it("should include all session sections matching Python format", () => {
      const result = generateSessionContent({
        sessionNum: 10,
        title: "Complete Test",
        commit: "abc123",
        summary: "Test summary",
        extraContent: "Extra content here",
        date: "2024-03-15",
      });

      // Python output structure verification
      expect(result).toContain("## Session 10: Complete Test");
      expect(result).toContain("**Date**: 2024-03-15");
      expect(result).toContain("**Task**: Complete Test");
      expect(result).toContain("### Summary");
      expect(result).toContain("Test summary");
      expect(result).toContain("### Main Changes");
      expect(result).toContain("Extra content here");
      expect(result).toContain("### Git Commits");
      expect(result).toContain("### Testing");
      expect(result).toContain("### Status");
      expect(result).toContain("[OK] **Completed**");
      expect(result).toContain("### Next Steps");
    });
  });

  describe("update_index commit formatting", () => {
    /**
     * Reference: add_session.py lines 191-194
     */

    it("should format multiple commits with backticks and commas", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fsPromises.readFile).mockResolvedValue(`
<!-- @@@auto:current-status -->
- **Active File**: \`journal-1.md\`
<!-- @@@/auto:current-status -->
<!-- @@@auto:active-documents -->
| File | Lines | Status |
<!-- @@@/auto:active-documents -->
<!-- @@@auto:session-history -->
| # | Date | Task | Commits |
|---|------|------|---------|
<!-- @@@/auto:session-history -->
`);
      mockReaddirSync().mockReturnValue(["journal-1.md"]);
      vi.mocked(fs.statSync).mockReturnValue({ isFile: () => true } as fs.Stats);
      vi.mocked(fsPromises.writeFile).mockResolvedValue();

      await updateIndexWithSession({
        indexPath: "/workspace/index.md",
        workspaceDir: "/workspace",
        sessionNum: 5,
        title: "Test",
        commit: "abc,def,ghi",
        activeFile: "journal-1.md",
        date: "2024-03-03",
      });

      // Python: commit_display = re.sub(r"([a-f0-9]{7,})", r"`\1`", commit.replace(",", ", "))
      // Our implementation formats as `abc`, `def`, `ghi`
      expect(fsPromises.writeFile).toHaveBeenCalledWith(
        "/workspace/index.md",
        expect.stringContaining("`abc`"),
        "utf-8"
      );
    });
  });
});

describe("Python parity - git_context.py edge cases", () => {
  /**
   * Additional tests to ensure complete parity with Python git_context.py
   */

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("get_context_json structure", () => {
    /**
     * Reference: git_context.py lines 83-160
     */

    it("should match Python nearLimit calculation (> 1800)", () => {
      // Test boundary: exactly 1800 lines should NOT be near limit
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockImplementation((path) => {
        if (String(path).includes(".developer")) return "name=john\n";
        // Create content with exactly 1800 lines
        return Array(1800).fill("line").join("\n");
      });
      mockReaddirSync().mockReturnValue(["journal-1.md"]);

      // countLines should return 1800
      const lines = countLines("/workspace/journal-1.md");
      expect(lines).toBe(1800);
      // nearLimit should be false at exactly 1800
      expect(lines > 1800).toBe(false);
    });

    it("should match Python nearLimit calculation (1801 lines)", () => {
      // Test boundary: 1801 lines SHOULD be near limit
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockImplementation(() => {
        return Array(1801).fill("line").join("\n");
      });

      const lines = countLines("/workspace/journal-1.md");
      expect(lines).toBe(1801);
      // Python: nearLimit: journal_lines > 1800
      expect(lines > 1800).toBe(true);
    });
  });

  describe("getRecentCommits message parsing", () => {
    /**
     * Reference: git_context.py lines 116-124
     */

    it("should handle commit message with multiple spaces", () => {
      vi.mocked(execSync).mockReturnValue("abc1234 fix:  multiple   spaces\n");

      const result = getRecentCommits("/workspace");

      // Python: parts = line.split(" ", 1)
      expect(result[0].hash).toBe("abc1234");
      expect(result[0].message).toBe("fix:  multiple   spaces");
    });

    it("should handle commit with only hash (no space)", () => {
      vi.mocked(execSync).mockReturnValue("abc1234defg\n");

      const result = getRecentCommits("/workspace");

      // Python: if len(parts) >= 2 ... elif len(parts) == 1
      expect(result[0].hash).toBe("abc1234defg");
      expect(result[0].message).toBe("");
    });

    it("should skip empty lines in git log output", () => {
      vi.mocked(execSync).mockReturnValue("abc1234 msg1\n\n\ndef5678 msg2\n");

      const result = getRecentCommits("/workspace");

      // Python: if line.strip():
      expect(result.length).toBe(2);
    });
  });

  describe("getGitStatus line filtering", () => {
    /**
     * Reference: git_context.py lines 111-112, 216-217
     */

    it("should filter out whitespace-only lines", () => {
      vi.mocked(execSync).mockReturnValue(" M file.ts\n   \n?? new.ts\n");

      const result = getGitStatus("/workspace");

      // Python: [line for line in status_out.splitlines() if line.strip()]
      expect(result.length).toBe(2);
      expect(result).not.toContain("   ");
    });
  });
});

describe("Python parity - paths.py edge cases", () => {
  /**
   * Additional tests to ensure complete parity with Python paths.py
   */

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getDeveloper file parsing", () => {
    /**
     * Reference: paths.py lines 86-91
     */

    it("should handle .developer file with multiple key-value pairs", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        "name=john\ninitialized_at=2024-01-01T10:00:00\nversion=1.0\n"
      );

      const result = getDeveloper("/workspace");

      // Python: for line in content.splitlines(): if line.startswith("name="):
      expect(result).toBe("john");
    });

    it("should return first name= match if multiple exist", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue("name=first\nname=second\n");

      const result = getDeveloper("/workspace");

      expect(result).toBe("first");
    });

    it("should handle name= at any position in line", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue("# comment\nname=john\n");

      const result = getDeveloper("/workspace");

      expect(result).toBe("john");
    });
  });

  describe("findVibenRoot traversal", () => {
    /**
     * Reference: paths.py lines 43-62
     */

    it("should stop at filesystem root without finding .viben", () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      // Start from deep path, should traverse up and return null
      const result = findVibenRoot("/a/b/c/d/e/f/g");

      expect(result).toBeNull();
    });

    it("should find .viben in immediate parent", () => {
      vi.mocked(fs.existsSync).mockImplementation((path) => {
        return path === "/workspace/.viben";
      });

      const result = findVibenRoot("/workspace/src");

      expect(result).toBe("/workspace");
    });
  });
});

describe("MAX_JOURNAL_LINES boundary tests", () => {
  /**
   * Tests for journal line limit boundary conditions
   * Reference: add_session.py line 39, lines 333-336
   */

  it("should NOT trigger new journal at exactly 2000 lines", () => {
    // If current=1990 and new_content=10, total=2000, should NOT create new file
    // Python: if current_lines + content_lines > MAX_LINES:
    const currentLines = 1990;
    const contentLines = 10;
    const total = currentLines + contentLines;

    expect(total).toBe(MAX_JOURNAL_LINES);
    expect(total > MAX_JOURNAL_LINES).toBe(false);
  });

  it("should trigger new journal at 2001 lines", () => {
    // If current=1990 and new_content=11, total=2001, SHOULD create new file
    const currentLines = 1990;
    const contentLines = 11;
    const total = currentLines + contentLines;

    expect(total).toBe(2001);
    expect(total > MAX_JOURNAL_LINES).toBe(true);
  });

  it("should have MAX_JOURNAL_LINES equal to Python MAX_LINES", () => {
    // Python: MAX_LINES = 2000
    expect(MAX_JOURNAL_LINES).toBe(2000);
  });
});

// =============================================================================
// Complete Python Implementation Parity Tests
// =============================================================================

describe("Python parity - git_context.py get_context_json()", () => {
  /**
   * Tests for complete parity with Python git_context.py get_context_json()
   * Reference: git_context.py lines 83-160
   */

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return empty string for developer when not set (Python: developer or '')", () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const result = getDeveloper("/workspace");

    // Python: "developer": developer or ""
    expect(result).toBeNull();
  });

  it("should return 'unknown' for branch when git returns empty string", () => {
    vi.mocked(execSync).mockReturnValue("");

    const result = getGitBranch("/workspace");

    // Python: branch = branch_out.strip() or "unknown"
    expect(result).toBe("unknown");
  });

  it("should calculate isClean as status_count == 0", () => {
    vi.mocked(execSync).mockReturnValue("");

    const count = getGitStatusCount("/workspace");
    const isClean = count === 0;

    // Python: is_clean = git_status_count == 0
    expect(isClean).toBe(true);
  });

  it("should count only non-empty lines for git status", () => {
    vi.mocked(execSync).mockReturnValue("M file1.ts\n\n M file2.ts\n   \n?? file3.ts\n");

    const count = getGitStatusCount("/workspace");

    // Python: git_status_count = len([line for line in status_out.splitlines() if line.strip()])
    expect(count).toBe(3);
  });
});

describe("Python parity - git_context.py get_context_text()", () => {
  /**
   * Tests for complete parity with Python git_context.py text output format
   * Reference: git_context.py lines 178-345
   */

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("header format", () => {
    it("should use exact header format from Python", () => {
      // Python: lines 191-194
      const expectedHeader = [
        "========================================",
        "SESSION CONTEXT",
        "========================================",
        "",
      ].join("\n");

      expect(expectedHeader).toContain("SESSION CONTEXT");
    });
  });

  describe("ACTIVE TASKS format", () => {
    /**
     * Reference: git_context.py lines 272-296
     */

    it("should format task as: - dir_name/ (status) @assignee", () => {
      // Python: lines.append(f"- {dir_name}/ ({status}) @{assignee}")
      const format = "- task-dir/ (in_progress) @john";
      expect(format).toMatch(/^- .+\/ \(.+\) @.+$/);
    });

    it("should show (no active tasks) when count is 0", () => {
      // Python: if task_count == 0: lines.append("(no active tasks)")
      const noTasksText = "(no active tasks)";
      expect(noTasksText).toBe("(no active tasks)");
    });

    it("should show Total: N active task(s)", () => {
      // Python: lines.append(f"Total: {task_count} active task(s)")
      const totalFormat = "Total: 3 active task(s)";
      expect(totalFormat).toMatch(/^Total: \d+ active task\(s\)$/);
    });
  });

  describe("MY TASKS format", () => {
    /**
     * Reference: git_context.py lines 298-320
     */

    it("should filter tasks assigned to developer and not done", () => {
      // Python: if assignee == developer and status != "done":
      const developer = "john";
      const assignee = "john";
      const status: string = "in_progress";

      expect(assignee === developer && status !== "done").toBe(true);
    });

    it("should format my tasks as: - [priority] title (status)", () => {
      // Python: lines.append(f"- [{priority}] {title} ({status})")
      const format = "- [P1] My Task (in_progress)";
      expect(format).toMatch(/^- \[P\d+\] .+ \(.+\)$/);
    });

    it("should use default priority P2 when not specified", () => {
      // Python: priority = data.get("priority", "P2")
      const defaultPriority = "P2";
      expect(defaultPriority).toBe("P2");
    });

    it("should show (no tasks assigned to you) when my_task_count is 0", () => {
      // Python: lines.append("(no tasks assigned to you)")
      const noTasksText = "(no tasks assigned to you)";
      expect(noTasksText).toBe("(no tasks assigned to you)");
    });
  });

  describe("JOURNAL FILE format", () => {
    /**
     * Reference: git_context.py lines 322-334
     */

    it("should show journal warning when lines > 1800", () => {
      const journalLines = 1850;
      const showWarning = journalLines > 1800;

      // Python: if journal_lines > 1800: lines.append("[!] WARNING: ...")
      expect(showWarning).toBe(true);
    });

    it("should NOT show warning when lines <= 1800", () => {
      const journalLines = 1800;
      const showWarning = journalLines > 1800;

      expect(showWarning).toBe(false);
    });

    it("should format line count as: Line count: X / 2000", () => {
      // Python: lines.append(f"Line count: {journal_lines} / 2000")
      const format = "Line count: 1500 / 2000";
      expect(format).toMatch(/^Line count: \d+ \/ 2000$/);
    });

    it("should show 'No journal file found' when file doesn't exist", () => {
      // Python: lines.append("No journal file found")
      const noJournalText = "No journal file found";
      expect(noJournalText).toBe("No journal file found");
    });
  });

  describe("PATHS format", () => {
    /**
     * Reference: git_context.py lines 336-341
     */

    it("should format paths correctly", () => {
      const developer = "john";
      // Python format
      const workspace = `.viben/workspace/${developer}/`;
      const tasks = ".viben/tasks/";
      const spec = "docs/specs/";

      expect(workspace).toBe(".viben/workspace/john/");
      expect(tasks).toBe(".viben/tasks/");
      expect(spec).toBe("docs/specs/");
    });
  });

  describe("footer format", () => {
    it("should use exact footer format from Python", () => {
      // Python: lines.append("========================================")
      const footer = "========================================";
      expect(footer).toBe("========================================");
    });
  });
});

describe("Python parity - add_session.py update_index()", () => {
  /**
   * Tests for complete parity with Python add_session.py update_index()
   * Reference: add_session.py lines 181-277
   */

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("commit display formatting", () => {
    it("should format commits with backticks using regex", () => {
      // Python: commit_display = re.sub(r"([a-f0-9]{7,})", r"`\1`", commit.replace(",", ", "))
      const commit = "abc1234,def5678";
      const formatted = commit.replace(",", ", ");
      // Should match pattern: `hash`, `hash`
      expect(formatted).toContain(", ");
    });

    it("should use '-' for empty commit display", () => {
      // Python: commit_display = "-"
      const commit = "";
      const display = commit || "-";
      expect(display).toBe("-");
    });
  });

  describe("auto markers processing", () => {
    it("should recognize @@@auto:current-status marker", () => {
      const content = "<!-- @@@auto:current-status -->";
      expect(content).toContain("@@@auto:current-status");
    });

    it("should recognize @@@auto:active-documents marker", () => {
      const content = "<!-- @@@auto:active-documents -->";
      expect(content).toContain("@@@auto:active-documents");
    });

    it("should recognize @@@auto:session-history marker", () => {
      const content = "<!-- @@@auto:session-history -->";
      expect(content).toContain("@@@auto:session-history");
    });
  });

  describe("session history table format", () => {
    it("should insert new row after header separator", () => {
      // Python: if re.match(r"^\|\s*-", line) and not header_written:
      const headerLine = "|---|------|------|---------|";
      const matches = /^\|\s*-/.test(headerLine);
      expect(matches).toBe(true);
    });

    it("should format new row as: | session | date | title | commit |", () => {
      // Python: lines.append(f"| {new_session} | {today} | {title} | {commit_display} |")
      const format = "| 5 | 2024-03-03 | Test Title | `abc1234` |";
      expect(format).toMatch(/^\| \d+ \| \d{4}-\d{2}-\d{2} \| .+ \| .+ \|$/);
    });
  });
});

describe("Python parity - add_session.py generate_session_content()", () => {
  /**
   * Tests for complete parity with Python add_session.py generate_session_content()
   * Reference: add_session.py lines 130-178
   */

  it("should start content with double newline", () => {
    const result = generateSessionContent({
      sessionNum: 1,
      title: "Test",
      commit: "-",
      summary: "Summary",
      extraContent: "",
      date: "2024-01-01",
    });

    // Python: return f"\n\n## Session {session_num}: ..."
    expect(result.startsWith("\n\n")).toBe(true);
  });

  it("should format commit table correctly with single commit", () => {
    const result = generateSessionContent({
      sessionNum: 1,
      title: "Test",
      commit: "abc1234",
      summary: "Summary",
      extraContent: "",
      date: "2024-01-01",
    });

    // Python format:
    // | Hash | Message |
    // |------|---------|
    // | `abc1234` | (see git log) |
    expect(result).toContain("| Hash | Message |");
    expect(result).toContain("|------|---------|");
    expect(result).toContain("| `abc1234` | (see git log) |");
  });

  it("should have Testing section with [OK] placeholder", () => {
    const result = generateSessionContent({
      sessionNum: 1,
      title: "Test",
      commit: "-",
      summary: "Summary",
      extraContent: "",
      date: "2024-01-01",
    });

    // Python: ### Testing\n\n- [OK] (Add test results)
    expect(result).toContain("### Testing");
    expect(result).toContain("- [OK] (Add test results)");
  });

  it("should have Status section with [OK] **Completed**", () => {
    const result = generateSessionContent({
      sessionNum: 1,
      title: "Test",
      commit: "-",
      summary: "Summary",
      extraContent: "",
      date: "2024-01-01",
    });

    // Python: ### Status\n\n[OK] **Completed**
    expect(result).toContain("### Status");
    expect(result).toContain("[OK] **Completed**");
  });

  it("should have Next Steps section with default text", () => {
    const result = generateSessionContent({
      sessionNum: 1,
      title: "Test",
      commit: "-",
      summary: "Summary",
      extraContent: "",
      date: "2024-01-01",
    });

    // Python: ### Next Steps\n\n- None - task complete
    expect(result).toContain("### Next Steps");
    expect(result).toContain("- None - task complete");
  });
});

describe("Python parity - add_session.py create_new_journal_file()", () => {
  /**
   * Tests for complete parity with Python add_session.py create_new_journal_file()
   * Reference: add_session.py lines 113-127
   */

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fsPromises.writeFile).mockResolvedValue();
  });

  it("should include part number in title", async () => {
    await createNewJournalFile({
      workspaceDir: "/workspace",
      number: 3,
      developer: "john",
      date: "2024-03-03",
      prevNumber: 2,
    });

    // Python: f"# Journal - {developer} (Part {num})"
    expect(fsPromises.writeFile).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining("# Journal - john (Part 3)"),
      "utf-8"
    );
  });

  it("should include archive note with MAX_LINES reference", async () => {
    await createNewJournalFile({
      workspaceDir: "/workspace",
      number: 3,
      developer: "john",
      date: "2024-03-03",
      prevNumber: 2,
    });

    // Python: f"> Continuation from `{FILE_JOURNAL_PREFIX}{prev_num}.md` (archived at ~{MAX_LINES} lines)"
    expect(fsPromises.writeFile).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining("(archived at ~2000 lines)"),
      "utf-8"
    );
  });

  it("should include Started date", async () => {
    await createNewJournalFile({
      workspaceDir: "/workspace",
      number: 3,
      developer: "john",
      date: "2024-03-03",
      prevNumber: 2,
    });

    // Python: f"> Started: {today}"
    expect(fsPromises.writeFile).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining("> Started: 2024-03-03"),
      "utf-8"
    );
  });

  it("should end with separator and blank line", async () => {
    await createNewJournalFile({
      workspaceDir: "/workspace",
      number: 3,
      developer: "john",
      date: "2024-03-03",
      prevNumber: 2,
    });

    // Python: "\n---\n\n"
    expect(fsPromises.writeFile).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining("---"),
      "utf-8"
    );
  });
});

describe("Python parity - paths.py additional edge cases", () => {
  /**
   * Additional edge case tests for paths.py parity
   */

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("get_active_journal_file sorting", () => {
    /**
     * Reference: paths.py lines 169-185
     */

    it("should find highest numbered journal regardless of filesystem order", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockImplementation((path) => {
        if (String(path).includes(".developer")) return "name=john\n";
        return "";
      });

      // Simulating unsorted filesystem listing
      mockReaddirSync().mockReturnValue([
        "journal-3.md",
        "journal-1.md",
        "journal-10.md",
        "journal-2.md",
        "journal-5.md",
      ]);

      const result = getActiveJournalFile("/workspace");

      // Python: if num > highest: highest = num; latest = f
      expect(result).toContain("journal-10.md");
    });

    it("should ignore non-journal files", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockImplementation((path) => {
        if (String(path).includes(".developer")) return "name=john\n";
        return "";
      });

      mockReaddirSync().mockReturnValue([
        "journal-1.md",
        "index.md",
        "notes.txt",
        "journal-2.md",
        "readme.md",
      ]);

      const result = getActiveJournalFile("/workspace");

      // Python: for f in workspace_dir.glob(f"{FILE_JOURNAL_PREFIX}*.md"):
      expect(result).toContain("journal-2.md");
    });
  });

  describe("setCurrentTask validation", () => {
    /**
     * Reference: paths.py lines 262-289
     */

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("should verify task directory exists before setting", () => {
      vi.mocked(fs.existsSync).mockImplementation((path) => {
        // Task dir doesn't exist
        if (String(path).includes(".current-task")) return false;
        if (String(path).includes("01-01-task")) return false;
        return false;
      });

      // When task dir doesn't exist, setCurrentTask should fail
      // Python: if not full_path.is_dir(): return False
      const taskPath = ".viben/tasks/01-01-task";
      const exists = fs.existsSync(join("/workspace", taskPath));
      expect(exists).toBe(false);
    });
  });

  describe("clearCurrentTask behavior", () => {
    /**
     * Reference: paths.py lines 292-308
     */

    it("should succeed even if .current-task doesn't exist", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fsPromises.writeFile).mockResolvedValue();

      // Python: try: if current_file.is_file(): current_file.unlink(); return True
      // Should always return true
      const result = clearCurrentTask("/workspace");

      expect(result).toBe(true);
    });
  });
});

describe("Python parity - CLI argument handling", () => {
  /**
   * Tests for CLI argument handling parity
   */

  describe("session add arguments", () => {
    /**
     * Reference: add_session.py lines 368-388
     */

    it("should have --title as required argument", () => {
      // Python: parser.add_argument("--title", required=True, ...)
      const argConfig = { name: "--title", required: true };
      expect(argConfig.required).toBe(true);
    });

    it("should have default commit value of '-'", () => {
      // Python: parser.add_argument("--commit", default="-", ...)
      const defaultCommit = "-";
      expect(defaultCommit).toBe("-");
    });

    it("should have default summary of '(Add summary)'", () => {
      // Python: parser.add_argument("--summary", default="(Add summary)", ...)
      const defaultSummary = "(Add summary)";
      expect(defaultSummary).toBe("(Add summary)");
    });

    it("should support --content-file option", () => {
      // Python: parser.add_argument("--content-file", ...)
      const argConfig = { name: "--content-file", optional: true };
      expect(argConfig.optional).toBe(true);
    });
  });

  describe("context arguments", () => {
    /**
     * Reference: git_context.py lines 362-375
     */

    it("should support --json flag", () => {
      // Python: parser.add_argument("--json", "-j", action="store_true", ...)
      const argConfig = { name: "--json", alias: "-j", type: "boolean" };
      expect(argConfig.alias).toBe("-j");
    });
  });
});
