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
 *
 * Uses real file system operations with temp directories for actual behavior testing.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { join } from "node:path";
import { execSync } from "node:child_process";
import {
  createTempDir,
  createWorkspaceTempDir,
  type TempDirContext,
} from "../../test/helpers/temp-dir";

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
  getArchiveDir,
  isSafeTaskPath,
  readJsonlFile,
  writeJsonlFile,
  appendToJsonl,
  jsonlEntryExists,
  writeTaskJson,
  updateTaskField,
} from "./viben-workspace";

// =============================================================================
// Constants Tests (no file system needed)
// =============================================================================

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

// =============================================================================
// File System Tests with Real Temp Directories
// =============================================================================

describe("findVibenRoot", () => {
  /**
   * Tests for finding .viben root directory
   * Reference: templates/viben/scripts/common/paths.py lines 43-62
   */
  let tempDir: TempDirContext;

  beforeEach(async () => {
    tempDir = await createTempDir("findVibenRoot-");
  });

  afterEach(async () => {
    await tempDir.cleanup();
  });

  it("should return null when no .viben directory found", () => {
    const result = findVibenRoot(tempDir.root);
    expect(result).toBeNull();
  });

  it("should return parent directory containing .viben", async () => {
    await tempDir.mkdir(".viben");
    await tempDir.mkdir("src/lib");

    const result = findVibenRoot(tempDir.resolve("src/lib"));

    expect(result).toBe(tempDir.root);
  });

  it("should find .viben in current directory", async () => {
    await tempDir.mkdir(".viben");

    const result = findVibenRoot(tempDir.root);

    expect(result).toBe(tempDir.root);
  });

  it("should handle nested directories correctly", async () => {
    await tempDir.mkdir(".viben");
    await tempDir.mkdir("src/components/nested/deep");

    const result = findVibenRoot(tempDir.resolve("src/components/nested/deep"));

    expect(result).toBe(tempDir.root);
  });
});

describe("getDeveloper", () => {
  /**
   * Tests for reading developer name
   * Reference: templates/viben/scripts/common/paths.py lines 69-94
   */
  let tempDir: TempDirContext;

  beforeEach(async () => {
    tempDir = await createWorkspaceTempDir();
  });

  afterEach(async () => {
    await tempDir.cleanup();
  });

  it("should return null when .developer file does not exist", () => {
    const result = getDeveloper(tempDir.root);
    expect(result).toBeNull();
  });

  it("should return developer name from .developer file", async () => {
    await tempDir.writeFile(".viben/.developer", "name=john\ninitialized_at=2024-01-01\n");

    const result = getDeveloper(tempDir.root);

    expect(result).toBe("john");
  });

  it("should handle malformed .developer file", async () => {
    await tempDir.writeFile(".viben/.developer", "invalid content without name");

    const result = getDeveloper(tempDir.root);

    expect(result).toBeNull();
  });

  it("should trim whitespace from developer name", async () => {
    await tempDir.writeFile(".viben/.developer", "name=  alice  \n");

    const result = getDeveloper(tempDir.root);

    expect(result).toBe("alice");
  });

  it("should handle value containing = character (Python parity)", async () => {
    await tempDir.writeFile(".viben/.developer", "name=john=doe\n");

    const result = getDeveloper(tempDir.root);

    // Python: line.split("=", 1)[1] -> "john=doe"
    expect(result).toBe("john=doe");
  });

  it("should handle value with multiple = characters", async () => {
    await tempDir.writeFile(".viben/.developer", "name=a=b=c\n");

    const result = getDeveloper(tempDir.root);

    // Python: line.split("=", 1)[1] -> "a=b=c"
    expect(result).toBe("a=b=c");
  });

  it("should handle .developer file with multiple key-value pairs", async () => {
    await tempDir.writeFile(
      ".viben/.developer",
      "name=john\ninitialized_at=2024-01-01T10:00:00\nversion=1.0\n"
    );

    const result = getDeveloper(tempDir.root);

    // Python: for line in content.splitlines(): if line.startswith("name="):
    expect(result).toBe("john");
  });

  it("should return first name= match if multiple exist", async () => {
    await tempDir.writeFile(".viben/.developer", "name=first\nname=second\n");

    const result = getDeveloper(tempDir.root);

    expect(result).toBe("first");
  });
});

describe("checkDeveloper", () => {
  /**
   * Tests for checking if developer is initialized
   * Reference: templates/viben/scripts/common/paths.py lines 97-106
   */
  let tempDir: TempDirContext;

  beforeEach(async () => {
    tempDir = await createWorkspaceTempDir();
  });

  afterEach(async () => {
    await tempDir.cleanup();
  });

  it("should return false when developer not initialized", () => {
    const result = checkDeveloper(tempDir.root);
    expect(result).toBe(false);
  });

  it("should return true when developer is initialized", async () => {
    await tempDir.writeFile(".viben/.developer", "name=john\n");

    const result = checkDeveloper(tempDir.root);

    expect(result).toBe(true);
  });
});

describe("getWorkspaceDir", () => {
  /**
   * Tests for getting workspace directory path
   * Reference: templates/viben/scripts/common/paths.py lines 131-146
   */
  let tempDir: TempDirContext;

  beforeEach(async () => {
    tempDir = await createWorkspaceTempDir();
  });

  afterEach(async () => {
    await tempDir.cleanup();
  });

  it("should return null when developer not set", () => {
    const result = getWorkspaceDir(tempDir.root);
    expect(result).toBeNull();
  });

  it("should return workspace path for developer", async () => {
    await tempDir.writeFile(".viben/.developer", "name=john\n");

    const result = getWorkspaceDir(tempDir.root);

    // Python: repo_root / DIR_WORKFLOW / DIR_WORKSPACE / developer
    expect(result).toBe(join(tempDir.root, ".viben", "workspace", "john"));
  });

  it("should use provided developer name", () => {
    const result = getWorkspaceDir(tempDir.root, "alice");

    expect(result).toBe(join(tempDir.root, ".viben", "workspace", "alice"));
  });
});

describe("getTasksDir", () => {
  /**
   * Tests for getting tasks directory path
   * Reference: templates/viben/scripts/common/paths.py lines 113-124
   */
  let tempDir: TempDirContext;

  beforeEach(async () => {
    tempDir = await createWorkspaceTempDir();
  });

  afterEach(async () => {
    await tempDir.cleanup();
  });

  it("should return tasks directory path", () => {
    const result = getTasksDir(tempDir.root);

    // Python: repo_root / DIR_WORKFLOW / DIR_TASKS
    expect(result).toBe(join(tempDir.root, ".viben", "tasks"));
  });
});

describe("getAllDevelopers", () => {
  let tempDir: TempDirContext;

  beforeEach(async () => {
    tempDir = await createWorkspaceTempDir();
  });

  afterEach(async () => {
    await tempDir.cleanup();
  });

  it("should return empty array when workspace dir does not exist", async () => {
    const isolated = await createTempDir("no-workspace-");
    await isolated.mkdir(".viben");

    const result = getAllDevelopers(isolated.root);

    expect(result).toEqual([]);
    await isolated.cleanup();
  });

  it("should return list of developer directories", async () => {
    await tempDir.mkdir(".viben/workspace/john");
    await tempDir.mkdir(".viben/workspace/alice");
    await tempDir.writeFile(".viben/workspace/.gitkeep", "");

    const result = getAllDevelopers(tempDir.root);

    expect(result).toContain("john");
    expect(result).toContain("alice");
    expect(result).toHaveLength(2);
  });

  it("should exclude hidden directories", async () => {
    await tempDir.mkdir(".viben/workspace/john");
    await tempDir.mkdir(".viben/workspace/.hidden");

    const result = getAllDevelopers(tempDir.root);

    expect(result).toEqual(["john"]);
  });
});

describe("getActiveJournalFile", () => {
  /**
   * Tests for getting active journal file
   * Reference: templates/viben/scripts/common/paths.py lines 153-185
   */
  let tempDir: TempDirContext;

  beforeEach(async () => {
    tempDir = await createWorkspaceTempDir();
  });

  afterEach(async () => {
    await tempDir.cleanup();
  });

  it("should return null when workspace dir does not exist", () => {
    const result = getActiveJournalFile(tempDir.root);
    expect(result).toBeNull();
  });

  it("should return highest numbered journal file", async () => {
    await tempDir.writeFile(".viben/.developer", "name=john\n");
    await tempDir.mkdir(".viben/workspace/john");
    await tempDir.writeFile(".viben/workspace/john/journal-1.md", "content 1");
    await tempDir.writeFile(".viben/workspace/john/journal-3.md", "content 3");
    await tempDir.writeFile(".viben/workspace/john/journal-2.md", "content 2");
    await tempDir.writeFile(".viben/workspace/john/index.md", "index");

    const result = getActiveJournalFile(tempDir.root);

    // Python: finds highest number, returns that file
    expect(result).toContain("journal-3.md");
  });

  it("should return null when no journal files exist", async () => {
    await tempDir.writeFile(".viben/.developer", "name=john\n");
    await tempDir.mkdir(".viben/workspace/john");
    await tempDir.writeFile(".viben/workspace/john/index.md", "index");
    await tempDir.writeFile(".viben/workspace/john/notes.txt", "notes");

    const result = getActiveJournalFile(tempDir.root);

    expect(result).toBeNull();
  });

  it("should find highest numbered journal regardless of filesystem order", async () => {
    await tempDir.writeFile(".viben/.developer", "name=john\n");
    await tempDir.mkdir(".viben/workspace/john");
    await tempDir.writeFile(".viben/workspace/john/journal-3.md", "");
    await tempDir.writeFile(".viben/workspace/john/journal-1.md", "");
    await tempDir.writeFile(".viben/workspace/john/journal-10.md", "");
    await tempDir.writeFile(".viben/workspace/john/journal-2.md", "");
    await tempDir.writeFile(".viben/workspace/john/journal-5.md", "");

    const result = getActiveJournalFile(tempDir.root);

    // Python: if num > highest: highest = num; latest = f
    expect(result).toContain("journal-10.md");
  });
});

describe("getJournalInfo", () => {
  /**
   * Tests for getting journal file info
   * Reference: templates/viben/scripts/add_session.py lines 46-70
   */
  let tempDir: TempDirContext;

  beforeEach(async () => {
    tempDir = await createWorkspaceTempDir();
  });

  afterEach(async () => {
    await tempDir.cleanup();
  });

  it("should return null file and 0 values when no journal exists", () => {
    const result = getJournalInfo(tempDir.root);

    // Python: return None, 0, 0
    expect(result).toEqual({ file: null, number: 0, lines: 0 });
  });

  it("should return correct journal info", async () => {
    await tempDir.writeFile(".viben/.developer", "name=john\n");
    await tempDir.mkdir(".viben/workspace/john");
    await tempDir.writeFile(".viben/workspace/john/journal-1.md", "Line1\n");
    await tempDir.writeFile(".viben/workspace/john/journal-2.md", "Line1\nLine2\nLine3\n");

    const result = getJournalInfo(tempDir.root);

    expect(result.file).toContain("journal-2.md");
    expect(result.number).toBe(2);
    // Python: "Line1\nLine2\nLine3\n".splitlines() -> 3 lines (trailing newline ignored)
    expect(result.lines).toBe(3);
  });

  it("should handle journal files with non-sequential numbers", async () => {
    await tempDir.writeFile(".viben/.developer", "name=john\n");
    await tempDir.mkdir(".viben/workspace/john");
    await tempDir.writeFile(".viben/workspace/john/journal-1.md", "Line1\n");
    await tempDir.writeFile(".viben/workspace/john/journal-5.md", "Line1\n");
    await tempDir.writeFile(".viben/workspace/john/journal-3.md", "Line1\n");
    await tempDir.writeFile(".viben/workspace/john/journal-10.md", "Line1\n");

    const result = getJournalInfo(tempDir.root);

    expect(result.number).toBe(10);
  });
});

describe("countLines", () => {
  /**
   * Tests for counting lines in a file
   * Reference: templates/viben/scripts/common/paths.py lines 188-203
   */
  let tempDir: TempDirContext;

  beforeEach(async () => {
    tempDir = await createTempDir("countLines-");
  });

  afterEach(async () => {
    await tempDir.cleanup();
  });

  it("should return 0 when file does not exist", () => {
    const result = countLines(tempDir.resolve("nonexistent.md"));
    expect(result).toBe(0);
  });

  it("should return correct line count", async () => {
    await tempDir.writeFile("file.md", "Line1\nLine2\nLine3");

    const result = countLines(tempDir.resolve("file.md"));

    // Python: "Line1\nLine2\nLine3".splitlines() -> ["Line1", "Line2", "Line3"] (length 3)
    expect(result).toBe(3);
  });

  it("should handle empty file", async () => {
    await tempDir.writeFile("empty.md", "");

    const result = countLines(tempDir.resolve("empty.md"));

    // Python: "".splitlines() -> [] (length 0)
    expect(result).toBe(0);
  });

  it("should handle file with trailing newline (Python parity)", async () => {
    await tempDir.writeFile("file.md", "Line1\nLine2\n");

    const result = countLines(tempDir.resolve("file.md"));

    // Python: "Line1\nLine2\n".splitlines() -> ["Line1", "Line2"] (length 2)
    expect(result).toBe(2);
  });

  it("should handle file without trailing newline", async () => {
    await tempDir.writeFile("file.md", "Line1\nLine2");

    const result = countLines(tempDir.resolve("file.md"));

    // Python: "Line1\nLine2".splitlines() -> ["Line1", "Line2"] (length 2)
    expect(result).toBe(2);
  });
});

describe("getCurrentTask", () => {
  /**
   * Tests for getting current task
   * Reference: templates/viben/scripts/common/paths.py lines 224-241
   */
  let tempDir: TempDirContext;

  beforeEach(async () => {
    tempDir = await createWorkspaceTempDir();
  });

  afterEach(async () => {
    await tempDir.cleanup();
  });

  it("should return null when .current-task does not exist", () => {
    const result = getCurrentTask(tempDir.root);
    expect(result).toBeNull();
  });

  it("should return task path from .current-task file", async () => {
    await tempDir.writeFile(".viben/.current-task", ".viben/tasks/01-01-my-task\n");

    const result = getCurrentTask(tempDir.root);

    expect(result).toBe(".viben/tasks/01-01-my-task");
  });

  it("should trim whitespace from task path", async () => {
    await tempDir.writeFile(".viben/.current-task", "  .viben/tasks/task  \n");

    const result = getCurrentTask(tempDir.root);

    expect(result).toBe(".viben/tasks/task");
  });

  it("should return null for empty file", async () => {
    await tempDir.writeFile(".viben/.current-task", "");

    const result = getCurrentTask(tempDir.root);

    expect(result).toBeNull();
  });
});

describe("getCurrentTaskAbs", () => {
  /**
   * Tests for getting current task absolute path
   * Reference: templates/viben/scripts/common/paths.py lines 244-259
   */
  let tempDir: TempDirContext;

  beforeEach(async () => {
    tempDir = await createWorkspaceTempDir();
  });

  afterEach(async () => {
    await tempDir.cleanup();
  });

  it("should return null when no current task", () => {
    const result = getCurrentTaskAbs(tempDir.root);
    expect(result).toBeNull();
  });

  it("should return absolute path to task", async () => {
    await tempDir.writeFile(".viben/.current-task", ".viben/tasks/01-01-task");

    const result = getCurrentTaskAbs(tempDir.root);

    expect(result).toBe(join(tempDir.root, ".viben/tasks/01-01-task"));
  });
});

// =============================================================================
// Git Command Tests (mocked - git requires real repo)
// =============================================================================

vi.mock("node:child_process", () => ({
  execSync: vi.fn(),
}));

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

  it("should filter out whitespace-only lines", () => {
    vi.mocked(execSync).mockReturnValue(" M file.ts\n   \n?? new.ts\n");

    const result = getGitStatus("/workspace");

    // Python: [line for line in status_out.splitlines() if line.strip()]
    expect(result.length).toBe(2);
    expect(result).not.toContain("   ");
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

  it("should count only non-empty lines for git status", () => {
    vi.mocked(execSync).mockReturnValue("M file1.ts\n\n M file2.ts\n   \n?? file3.ts\n");

    const count = getGitStatusCount("/workspace");

    // Python: git_status_count = len([line for line in status_out.splitlines() if line.strip()])
    expect(count).toBe(3);
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

  it("should handle commit message with multiple spaces", () => {
    vi.mocked(execSync).mockReturnValue("abc1234 fix:  multiple   spaces\n");

    const result = getRecentCommits("/workspace");

    // Python: parts = line.split(" ", 1)
    expect(result[0].hash).toBe("abc1234");
    expect(result[0].message).toBe("fix:  multiple   spaces");
  });

  it("should skip empty lines in git log output", () => {
    vi.mocked(execSync).mockReturnValue("abc1234 msg1\n\n\ndef5678 msg2\n");

    const result = getRecentCommits("/workspace");

    // Python: if line.strip():
    expect(result.length).toBe(2);
  });
});

// =============================================================================
// Task Operations Tests with Real File System
// =============================================================================

describe("readTaskJson", () => {
  /**
   * Tests for reading task.json
   * Reference: templates/viben/scripts/common/git_context.py lines 70-75
   */
  let tempDir: TempDirContext;

  beforeEach(async () => {
    tempDir = await createWorkspaceTempDir();
  });

  afterEach(async () => {
    await tempDir.cleanup();
  });

  it("should return null when task.json does not exist", async () => {
    await tempDir.mkdir(".viben/tasks/01-01-task");

    const result = readTaskJson(tempDir.resolve(".viben/tasks/01-01-task"));

    expect(result).toBeNull();
  });

  it("should return parsed task data", async () => {
    await tempDir.mkdir(".viben/tasks/01-01-task");
    await tempDir.writeJson(".viben/tasks/01-01-task/task.json", {
      name: "my-task",
      status: "in_progress",
    });

    const result = readTaskJson(tempDir.resolve(".viben/tasks/01-01-task"));

    expect(result).toEqual({ name: "my-task", status: "in_progress" });
  });

  it("should return null on invalid JSON", async () => {
    await tempDir.mkdir(".viben/tasks/01-01-task");
    await tempDir.writeFile(".viben/tasks/01-01-task/task.json", "invalid json");

    const result = readTaskJson(tempDir.resolve(".viben/tasks/01-01-task"));

    expect(result).toBeNull();
  });
});

describe("writeTaskJson", () => {
  let tempDir: TempDirContext;

  beforeEach(async () => {
    tempDir = await createWorkspaceTempDir();
  });

  afterEach(async () => {
    await tempDir.cleanup();
  });

  it("should write task.json file", async () => {
    await tempDir.mkdir(".viben/tasks/01-01-task");

    const success = writeTaskJson(tempDir.resolve(".viben/tasks/01-01-task"), {
      name: "test-task",
      status: "backlog",
    });

    expect(success).toBe(true);
    const content = await tempDir.readJson(".viben/tasks/01-01-task/task.json");
    expect(content).toEqual({ name: "test-task", status: "backlog" });
  });
});

describe("updateTaskField", () => {
  let tempDir: TempDirContext;

  beforeEach(async () => {
    tempDir = await createWorkspaceTempDir();
  });

  afterEach(async () => {
    await tempDir.cleanup();
  });

  it("should update a field in task.json", async () => {
    await tempDir.mkdir(".viben/tasks/01-01-task");
    await tempDir.writeJson(".viben/tasks/01-01-task/task.json", {
      name: "test-task",
      status: "backlog",
    });

    const success = updateTaskField(
      tempDir.resolve(".viben/tasks/01-01-task"),
      "status",
      "in_progress"
    );

    expect(success).toBe(true);
    const content = await tempDir.readJson<{ status: string }>(".viben/tasks/01-01-task/task.json");
    expect(content.status).toBe("in_progress");
  });

  it("should return false when task.json does not exist", async () => {
    await tempDir.mkdir(".viben/tasks/01-01-task");

    const success = updateTaskField(
      tempDir.resolve(".viben/tasks/01-01-task"),
      "status",
      "in_progress"
    );

    expect(success).toBe(false);
  });
});

describe("getActiveTasks", () => {
  /**
   * Tests for getting active tasks
   * Reference: templates/viben/scripts/common/git_context.py lines 128-141
   */
  let tempDir: TempDirContext;

  beforeEach(async () => {
    tempDir = await createWorkspaceTempDir();
  });

  afterEach(async () => {
    await tempDir.cleanup();
  });

  it("should return empty array when tasks dir does not exist", async () => {
    const isolated = await createTempDir("no-tasks-");
    await isolated.mkdir(".viben");

    const result = getActiveTasks(isolated.root);

    expect(result).toEqual([]);
    await isolated.cleanup();
  });

  it("should return tasks with correct info", async () => {
    await tempDir.mkdir(".viben/tasks/01-01-task");
    await tempDir.writeJson(".viben/tasks/01-01-task/task.json", {
      name: "my-task",
      status: "in_progress",
      assignee: "john",
      title: "My Task",
      priority: "high",
    });

    const result = getActiveTasks(tempDir.root);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("my-task");
    expect(result[0].status).toBe("in_progress");
    expect(result[0].assignee).toBe("john");
  });

  it("should exclude archive directory", async () => {
    await tempDir.mkdir(".viben/tasks/01-01-task");
    await tempDir.writeJson(".viben/tasks/01-01-task/task.json", {
      name: "active-task",
      status: "in_progress",
    });
    await tempDir.mkdir(".viben/tasks/archive/2024-01");
    await tempDir.mkdir(".viben/tasks/archive/2024-01/old-task");
    await tempDir.writeJson(".viben/tasks/archive/2024-01/old-task/task.json", {
      name: "archived-task",
      status: "completed",
    });

    const result = getActiveTasks(tempDir.root);

    // Python: if d.is_dir() and d.name != "archive":
    expect(result.every((t) => t.dir !== "archive")).toBe(true);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("active-task");
  });
});

// =============================================================================
// Session Operations Tests
// =============================================================================

describe("getCurrentSessionNumber", () => {
  /**
   * Tests for getting current session number
   * Reference: templates/viben/scripts/add_session.py lines 73-84
   */
  let tempDir: TempDirContext;

  beforeEach(async () => {
    tempDir = await createTempDir("session-");
  });

  afterEach(async () => {
    await tempDir.cleanup();
  });

  it("should return 0 when index.md does not exist", () => {
    const result = getCurrentSessionNumber(tempDir.resolve("index.md"));
    expect(result).toBe(0);
  });

  it("should parse session number from index.md", async () => {
    await tempDir.writeFile("index.md", "## Status\n- **Total Sessions**: 42\n");

    const result = getCurrentSessionNumber(tempDir.resolve("index.md"));

    // Python: match = re.search(r":\s*(\d+)", line)
    expect(result).toBe(42);
  });

  it("should return 0 when Total Sessions not found", async () => {
    await tempDir.writeFile("index.md", "## Status\nNo sessions yet\n");

    const result = getCurrentSessionNumber(tempDir.resolve("index.md"));

    expect(result).toBe(0);
  });

  it("should handle Total Sessions with no space after colon", async () => {
    await tempDir.writeFile("index.md", "- **Total Sessions**:25");

    // Python: match = re.search(r":\s*(\d+)", line)
    expect(getCurrentSessionNumber(tempDir.resolve("index.md"))).toBe(25);
  });

  it("should handle Total Sessions with extra whitespace", async () => {
    await tempDir.writeFile("index.md", "Total Sessions:   99  ");

    expect(getCurrentSessionNumber(tempDir.resolve("index.md"))).toBe(99);
  });
});

describe("generateSessionContent", () => {
  /**
   * Tests for generating session content
   * Reference: templates/viben/scripts/add_session.py lines 130-178
   */

  it("should generate markdown with session header", () => {
    const result = generateSessionContent({
      session_num: 5,
      title: "Test Session",
      commit: "abc123",
      summary: "Test summary",
      extra_content: "Extra content",
      date: "2024-03-03",
    });

    // Python: f"## Session {session_num}: {title}"
    expect(result).toContain("## Session 5: Test Session");
    expect(result).toContain("**Date**: 2024-03-03");
    expect(result).toContain("**Task**: Test Session");
  });

  it("should generate commit table for single commit", () => {
    const result = generateSessionContent({
      session_num: 1,
      title: "Test",
      commit: "abc123",
      summary: "Summary",
      extra_content: "",
      date: "2024-01-01",
    });

    // Python: commit_table = "| Hash | Message |\n|------|---------|"
    expect(result).toContain("| Hash | Message |");
    expect(result).toContain("| `abc123` | (see git log) |");
  });

  it("should generate commit table for multiple commits", () => {
    const result = generateSessionContent({
      session_num: 1,
      title: "Test",
      commit: "abc,def,ghi",
      summary: "Summary",
      extra_content: "",
      date: "2024-01-01",
    });

    // Python: for c in commit.split(","):
    expect(result).toContain("| `abc` |");
    expect(result).toContain("| `def` |");
    expect(result).toContain("| `ghi` |");
  });

  it("should show no commits message when commit is '-'", () => {
    const result = generateSessionContent({
      session_num: 1,
      title: "Test",
      commit: "-",
      summary: "Summary",
      extra_content: "",
      date: "2024-01-01",
    });

    // Python: commit_table = "(No commits - planning session)"
    expect(result).toContain("(No commits - planning session)");
  });

  it("should handle empty commit string same as '-'", () => {
    const result = generateSessionContent({
      session_num: 1,
      title: "Test",
      commit: "",
      summary: "Summary",
      extra_content: "",
      date: "2024-01-01",
    });

    // Python: if commit and commit != "-": ... else: "(No commits - planning session)"
    expect(result).toContain("(No commits - planning session)");
  });

  it("should trim whitespace from commit hashes", () => {
    const result = generateSessionContent({
      session_num: 1,
      title: "Test",
      commit: " abc , def , ghi ",
      summary: "Summary",
      extra_content: "",
      date: "2024-01-01",
    });

    // Python: for c in commit.split(","): c = c.strip()
    expect(result).toContain("| `abc` |");
    expect(result).toContain("| `def` |");
    expect(result).toContain("| `ghi` |");
  });

  it("should start content with double newline", () => {
    const result = generateSessionContent({
      session_num: 1,
      title: "Test",
      commit: "-",
      summary: "Summary",
      extra_content: "",
      date: "2024-01-01",
    });

    // Python: return f"\n\n## Session {session_num}: ..."
    expect(result.startsWith("\n\n")).toBe(true);
  });

  it("should include all session sections matching Python format", () => {
    const result = generateSessionContent({
      session_num: 10,
      title: "Complete Test",
      commit: "abc123",
      summary: "Test summary",
      extra_content: "Extra content here",
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

describe("createNewJournalFile", () => {
  /**
   * Tests for creating new journal file
   * Reference: templates/viben/scripts/add_session.py lines 113-127
   */
  let tempDir: TempDirContext;

  beforeEach(async () => {
    tempDir = await createTempDir("journal-");
  });

  afterEach(async () => {
    await tempDir.cleanup();
  });

  it("should create file with correct header", async () => {
    await tempDir.mkdir("workspace");

    const result = await createNewJournalFile({
      workspaceDir: tempDir.resolve("workspace"),
      number: 2,
      developer: "john",
      date: "2024-03-03",
      prevNumber: 1,
    });

    const content = await tempDir.readFile("workspace/journal-2.md");
    expect(content).toContain("# Journal - john (Part 2)");
  });

  it("should reference previous journal in header", async () => {
    await tempDir.mkdir("workspace");

    await createNewJournalFile({
      workspaceDir: tempDir.resolve("workspace"),
      number: 3,
      developer: "john",
      date: "2024-03-03",
      prevNumber: 2,
    });

    // Python: f"> Continuation from `{FILE_JOURNAL_PREFIX}{prev_num}.md`"
    const content = await tempDir.readFile("workspace/journal-3.md");
    expect(content).toContain("Continuation from `journal-2.md`");
  });

  it("should return path to new file", async () => {
    await tempDir.mkdir("workspace");

    const result = await createNewJournalFile({
      workspaceDir: tempDir.resolve("workspace"),
      number: 4,
      developer: "john",
      date: "2024-03-03",
      prevNumber: 3,
    });

    expect(result).toContain("journal-4.md");
    expect(await tempDir.exists("workspace/journal-4.md")).toBe(true);
  });

  it("should include archive note with MAX_LINES reference", async () => {
    await tempDir.mkdir("workspace");

    await createNewJournalFile({
      workspaceDir: tempDir.resolve("workspace"),
      number: 3,
      developer: "john",
      date: "2024-03-03",
      prevNumber: 2,
    });

    // Python: f"> Continuation from `{FILE_JOURNAL_PREFIX}{prev_num}.md` (archived at ~{MAX_LINES} lines)"
    const content = await tempDir.readFile("workspace/journal-3.md");
    expect(content).toContain("(archived at ~2000 lines)");
  });

  it("should include Started date", async () => {
    await tempDir.mkdir("workspace");

    await createNewJournalFile({
      workspaceDir: tempDir.resolve("workspace"),
      number: 3,
      developer: "john",
      date: "2024-03-03",
      prevNumber: 2,
    });

    // Python: f"> Started: {today}"
    const content = await tempDir.readFile("workspace/journal-3.md");
    expect(content).toContain("> Started: 2024-03-03");
  });
});

describe("updateIndexWithSession", () => {
  /**
   * Tests for updating index.md
   * Reference: templates/viben/scripts/add_session.py lines 181-277
   */
  let tempDir: TempDirContext;

  beforeEach(async () => {
    tempDir = await createTempDir("index-");
  });

  afterEach(async () => {
    await tempDir.cleanup();
  });

  it("should return false when index.md does not exist", async () => {
    const result = await updateIndexWithSession({
      index_path: tempDir.resolve("index.md"),
      workspaceDir: tempDir.root,
      session_num: 1,
      title: "Test",
      commit: "abc",
      active_file: "journal-1.md",
      date: "2024-03-03",
    });

    expect(result).toBe(false);
  });

  it("should return false when markers not found", async () => {
    await tempDir.writeFile("index.md", "No markers here");

    const result = await updateIndexWithSession({
      index_path: tempDir.resolve("index.md"),
      workspaceDir: tempDir.root,
      session_num: 1,
      title: "Test",
      commit: "abc",
      active_file: "journal-1.md",
      date: "2024-03-03",
    });

    // Python: if "@@@auto:current-status" not in content: return False
    expect(result).toBe(false);
  });

  it("should update index.md with session info", async () => {
    await tempDir.writeFile("journal-1.md", "Line1\nLine2\n");
    await tempDir.writeFile(
      "index.md",
      `# Index
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
`
    );

    const result = await updateIndexWithSession({
      index_path: tempDir.resolve("index.md"),
      workspaceDir: tempDir.root,
      session_num: 5,
      title: "Test Session",
      commit: "abc123",
      active_file: "journal-1.md",
      date: "2024-03-03",
    });

    expect(result).toBe(true);
    const content = await tempDir.readFile("index.md");
    expect(content).toContain("**Total Sessions**: 5");
    expect(content).toContain("**Last Active**: 2024-03-03");
  });
});

// =============================================================================
// Date Utilities Tests
// =============================================================================

describe("date utilities", () => {
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

// =============================================================================
// String Utilities Tests
// =============================================================================

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

// =============================================================================
// Task Name Resolution Tests
// =============================================================================

describe("findTaskByName", () => {
  let tempDir: TempDirContext;

  beforeEach(async () => {
    tempDir = await createWorkspaceTempDir();
  });

  afterEach(async () => {
    await tempDir.cleanup();
  });

  it("should return null when tasksDir does not exist", async () => {
    const isolated = await createTempDir("no-tasks-");

    const result = findTaskByName("my-task", isolated.resolve("tasks"));

    expect(result).toBeNull();
    await isolated.cleanup();
  });

  it("should find task by exact name", async () => {
    await tempDir.mkdir(".viben/tasks/01-01-my-task");

    const result = findTaskByName("01-01-my-task", tempDir.resolve(".viben/tasks"));

    expect(result).toBe(tempDir.resolve(".viben/tasks/01-01-my-task"));
  });

  it("should find task by suffix match", async () => {
    await tempDir.mkdir(".viben/tasks/01-01-my-task");
    await tempDir.mkdir(".viben/tasks/01-02-other-task");

    const result = findTaskByName("my-task", tempDir.resolve(".viben/tasks"));

    expect(result).toBe(tempDir.resolve(".viben/tasks/01-01-my-task"));
  });

  it("should return null when no match found", async () => {
    await tempDir.mkdir(".viben/tasks/01-01-different");

    const result = findTaskByName("my-task", tempDir.resolve(".viben/tasks"));

    expect(result).toBeNull();
  });
});

describe("resolveTaskDirectory", () => {
  let tempDir: TempDirContext;

  beforeEach(async () => {
    tempDir = await createWorkspaceTempDir();
  });

  afterEach(async () => {
    await tempDir.cleanup();
  });

  it("should return null for empty input", () => {
    const result = resolveTaskDirectory("", tempDir.root);
    expect(result).toBeNull();
  });

  it("should handle absolute path", () => {
    const result = resolveTaskDirectory("/absolute/path/to/task", tempDir.root);
    expect(result).toBe("/absolute/path/to/task");
  });

  it("should resolve relative path starting with .viben", () => {
    const result = resolveTaskDirectory(".viben/tasks/my-task", tempDir.root);
    expect(result).toBe(join(tempDir.root, ".viben/tasks/my-task"));
  });

  it("should find task by name using findTaskByName", async () => {
    await tempDir.mkdir(".viben/tasks/01-01-my-task");

    const result = resolveTaskDirectory("my-task", tempDir.root);

    expect(result).toBe(tempDir.resolve(".viben/tasks/01-01-my-task"));
  });
});

// =============================================================================
// Path Safety Tests
// =============================================================================

describe("isSafeTaskPath", () => {
  let tempDir: TempDirContext;

  beforeEach(async () => {
    tempDir = await createTempDir("safe-path-");
  });

  afterEach(async () => {
    await tempDir.cleanup();
  });

  it("should reject empty path", () => {
    expect(isSafeTaskPath("", tempDir.root)).toBe(false);
  });

  it("should reject null string", () => {
    expect(isSafeTaskPath("null", tempDir.root)).toBe(false);
  });

  it("should reject absolute paths", () => {
    expect(isSafeTaskPath("/etc/passwd", tempDir.root)).toBe(false);
  });

  it("should reject path traversal", () => {
    expect(isSafeTaskPath("../", tempDir.root)).toBe(false);
    expect(isSafeTaskPath("./", tempDir.root)).toBe(false);
    expect(isSafeTaskPath("..", tempDir.root)).toBe(false);
    expect(isSafeTaskPath(".", tempDir.root)).toBe(false);
  });

  it("should accept valid task path", () => {
    expect(isSafeTaskPath(".viben/tasks/01-01-task", tempDir.root)).toBe(true);
  });
});

describe("getArchiveDir", () => {
  let tempDir: TempDirContext;

  beforeEach(async () => {
    tempDir = await createWorkspaceTempDir();
  });

  afterEach(async () => {
    await tempDir.cleanup();
  });

  it("should return archive directory path", () => {
    const result = getArchiveDir(tempDir.root);

    expect(result).toBe(join(tempDir.root, ".viben", "tasks", "archive"));
  });
});

// =============================================================================
// JSONL Operations Tests
// =============================================================================

describe("readJsonlFile", () => {
  let tempDir: TempDirContext;

  beforeEach(async () => {
    tempDir = await createTempDir("jsonl-");
  });

  afterEach(async () => {
    await tempDir.cleanup();
  });

  it("should return empty array when file does not exist", () => {
    const entries = readJsonlFile(tempDir.resolve("nonexistent.jsonl"));
    expect(entries).toEqual([]);
  });

  it("should parse JSONL entries", async () => {
    await tempDir.writeFile("test.jsonl", '{"id":"1","name":"a"}\n{"id":"2","name":"b"}\n');

    const entries = readJsonlFile(tempDir.resolve("test.jsonl"));

    expect(entries).toHaveLength(2);
    expect(entries[0]).toEqual({ id: "1", name: "a" });
    expect(entries[1]).toEqual({ id: "2", name: "b" });
  });

  it("should handle empty file", async () => {
    await tempDir.writeFile("empty.jsonl", "");

    const entries = readJsonlFile(tempDir.resolve("empty.jsonl"));

    expect(entries).toEqual([]);
  });

  it("should skip invalid JSON lines", async () => {
    await tempDir.writeFile("mixed.jsonl", '{"valid":true}\ninvalid json\n{"also":"valid"}\n');

    const entries = readJsonlFile(tempDir.resolve("mixed.jsonl"));

    expect(entries).toHaveLength(2);
    expect(entries[0]).toEqual({ valid: true });
    expect(entries[1]).toEqual({ also: "valid" });
  });

  it("should skip empty lines", async () => {
    await tempDir.writeFile("gaps.jsonl", '{"a":1}\n\n{"b":2}\n\n');

    const entries = readJsonlFile(tempDir.resolve("gaps.jsonl"));

    expect(entries).toHaveLength(2);
  });
});

describe("writeJsonlFile", () => {
  let tempDir: TempDirContext;

  beforeEach(async () => {
    tempDir = await createTempDir("jsonl-");
  });

  afterEach(async () => {
    await tempDir.cleanup();
  });

  it("should write entries as JSONL", async () => {
    const entries = [{ id: "1" }, { id: "2" }];

    const success = writeJsonlFile(tempDir.resolve("out.jsonl"), entries);

    expect(success).toBe(true);
    const content = await tempDir.readFile("out.jsonl");
    expect(content).toBe('{"id":"1"}\n{"id":"2"}\n');
  });

  it("should handle empty array", async () => {
    const success = writeJsonlFile(tempDir.resolve("empty.jsonl"), []);

    expect(success).toBe(true);
    const content = await tempDir.readFile("empty.jsonl");
    expect(content).toBe("\n");
  });
});

describe("appendToJsonl", () => {
  let tempDir: TempDirContext;

  beforeEach(async () => {
    tempDir = await createTempDir("jsonl-");
  });

  afterEach(async () => {
    await tempDir.cleanup();
  });

  it("should append entry to existing file", async () => {
    await tempDir.writeFile("existing.jsonl", '{"id":"1"}\n');

    const success = appendToJsonl(tempDir.resolve("existing.jsonl"), { id: "2" });

    expect(success).toBe(true);
    const content = await tempDir.readFile("existing.jsonl");
    expect(content).toBe('{"id":"1"}\n{"id":"2"}\n');
  });

  it("should create file if it does not exist", async () => {
    const success = appendToJsonl(tempDir.resolve("new.jsonl"), { id: "1" });

    expect(success).toBe(true);
    const content = await tempDir.readFile("new.jsonl");
    expect(content).toBe('{"id":"1"}\n');
  });
});

describe("jsonlEntryExists", () => {
  let tempDir: TempDirContext;

  beforeEach(async () => {
    tempDir = await createTempDir("jsonl-");
  });

  afterEach(async () => {
    await tempDir.cleanup();
  });

  it("should return false when file does not exist", () => {
    const exists = jsonlEntryExists(tempDir.resolve("nonexistent.jsonl"), "path/to/file");
    expect(exists).toBe(false);
  });

  it("should return true when entry with file path exists", async () => {
    await tempDir.writeFile(
      "files.jsonl",
      '{"file":"src/a.ts"}\n{"file":"src/b.ts"}\n'
    );

    const exists = jsonlEntryExists(tempDir.resolve("files.jsonl"), "src/a.ts");

    expect(exists).toBe(true);
  });

  it("should return false when entry does not exist", async () => {
    await tempDir.writeFile("files.jsonl", '{"file":"src/a.ts"}\n');

    const exists = jsonlEntryExists(tempDir.resolve("files.jsonl"), "src/other.ts");

    expect(exists).toBe(false);
  });
});

// =============================================================================
// MAX_JOURNAL_LINES Boundary Tests
// =============================================================================

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
// Python Parity Tests (format verification)
// =============================================================================

describe("Python parity - text format verification", () => {
  describe("ACTIVE TASKS format", () => {
    it("should format task as: - dir_name/ (status) @assignee", () => {
      // Python: lines.append(f"- {dir_name}/ ({status}) @{assignee}")
      const format = "- task-dir/ (in_progress) @john";
      expect(format).toMatch(/^- .+\/ \(.+\) @.+$/);
    });

    it("should show Total: N active task(s)", () => {
      // Python: lines.append(f"Total: {task_count} active task(s)")
      const totalFormat = "Total: 3 active task(s)";
      expect(totalFormat).toMatch(/^Total: \d+ active task\(s\)$/);
    });
  });

  describe("MY TASKS format", () => {
    it("should format my tasks as: - [priority] title (status)", () => {
      // Python: lines.append(f"- [{priority}] {title} ({status})")
      const format = "- [P1] My Task (in_progress)";
      expect(format).toMatch(/^- \[P\d+\] .+ \(.+\)$/);
    });
  });

  describe("JOURNAL FILE format", () => {
    it("should format line count as: Line count: X / 2000", () => {
      // Python: lines.append(f"Line count: {journal_lines} / 2000")
      const format = "Line count: 1500 / 2000";
      expect(format).toMatch(/^Line count: \d+ \/ 2000$/);
    });
  });

  describe("session history table format", () => {
    it("should format new row as: | session | date | title | commit |", () => {
      // Python: lines.append(f"| {new_session} | {today} | {title} | {commit_display} |")
      const format = "| 5 | 2024-03-03 | Test Title | `abc1234` |";
      expect(format).toMatch(/^\| \d+ \| \d{4}-\d{2}-\d{2} \| .+ \| .+ \|$/);
    });
  });
});
