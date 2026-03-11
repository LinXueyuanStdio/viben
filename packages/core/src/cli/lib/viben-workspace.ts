/**
 * Viben Workspace Utilities
 *
 * Shared utilities for working with .viben workspace directories.
 * Replaces Python scripts in templates/viben/scripts/common/
 */
import { execSync } from "node:child_process";
import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
  unlinkSync,
  mkdirSync,
  appendFileSync,
  renameSync,
} from "node:fs";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { join, parse, resolve } from "node:path";
import type { TaskEventType } from "../../services/task-service";

// Re-export TaskService for unified task operations
export {
  TaskService,
  taskService,
  type UnifiedTask,
  type TaskStatus,
  type ReviewReason,
  type SubtaskStatus,
  type TaskEventType,
  type TaskEvent,
  isValidTaskStatus,
} from "../../services/task-service";

/**
 * Snapshot saved when a task is paused, used to restore state on resume
 */
export interface PausedSnapshot {
  fromState: string;
  subtaskIndex?: number;
  pausedAt: string;
}

// =============================================================================
// Constants
// =============================================================================

/** Main workflow directory name */
export const DIR_VIBEN = ".viben";
/** Workspace subdirectory */
export const DIR_WORKSPACE = "workspace";
/** Tasks subdirectory */
export const DIR_TASKS = "tasks";
/** Archive subdirectory */
export const DIR_ARCHIVE = "archive";
/** Spec subdirectory */
export const DIR_SPEC = "spec";
/** Scripts subdirectory */
export const DIR_SCRIPTS = "scripts";

/** Developer identity file */
export const FILE_DEVELOPER = ".developer";
/** Current task file */
export const FILE_CURRENT_TASK = ".current-task";
/** Task JSON file */
export const FILE_TASK_JSON = "task.json";
/** Journal file prefix */
export const FILE_JOURNAL_PREFIX = "journal-";

/** Maximum lines per journal file */
export const MAX_JOURNAL_LINES = 2000;

// =============================================================================
// Repository Root
// =============================================================================

/**
 * Find the workspace root by looking for .viben directory
 *
 * @param startDir - Starting directory to search from (defaults to cwd)
 * @returns Path to workspace root, or null if not found
 */
export function findVibenRoot(startDir?: string): string | null {
  let currentDir = resolve(startDir || process.cwd());
  const root = parse(currentDir).root;

  while (currentDir !== root) {
    const vibenDir = join(currentDir, DIR_VIBEN);
    if (existsSync(vibenDir)) {
      return currentDir;
    }
    const parentDir = join(currentDir, "..");
    if (parentDir === currentDir) {
      break;
    }
    currentDir = parentDir;
  }

  return null;
}

// =============================================================================
// Developer
// =============================================================================

/**
 * Get developer name from .developer file
 *
 * @param repoRoot - Repository root path
 * @returns Developer name or null if not initialized
 */
export function getDeveloper(repoRoot: string): string | null {
  const devFile = join(repoRoot, DIR_VIBEN, FILE_DEVELOPER);

  if (!existsSync(devFile)) {
    return null;
  }

  try {
    const content = readFileSync(devFile, "utf-8");
    for (const line of content.split("\n")) {
      if (line.startsWith("name=")) {
        // Use split with limit 2 to match Python: line.split("=", 1)[1]
        // This correctly handles values containing "=" characters
        const parts = line.split("=");
        const value = parts.slice(1).join("=").trim();
        return value || null;
      }
    }
  } catch {
    // Ignore errors
  }

  return null;
}

/**
 * Check if developer is initialized
 *
 * @param repoRoot - Repository root path
 * @returns True if developer is initialized
 */
export function checkDeveloper(repoRoot: string): boolean {
  return getDeveloper(repoRoot) !== null;
}

// =============================================================================
// Directories
// =============================================================================

/**
 * Get workspace directory for the developer
 *
 * @param repoRoot - Repository root path
 * @param developer - Developer name (optional, reads from .developer if not provided)
 * @returns Path to workspace directory or null
 */
export function getWorkspaceDir(
  repoRoot: string,
  developer?: string
): string | null {
  const dev = developer || getDeveloper(repoRoot);
  if (!dev) {
    return null;
  }
  return join(repoRoot, DIR_VIBEN, DIR_WORKSPACE, dev);
}

/**
 * Get tasks directory
 *
 * @param repoRoot - Repository root path
 * @returns Path to tasks directory
 */
export function getTasksDir(repoRoot: string): string {
  return join(repoRoot, DIR_VIBEN, DIR_TASKS);
}

/**
 * Get all developers from workspace directory
 *
 * @param repoRoot - Repository root path
 * @returns Array of developer names
 */
export function getAllDevelopers(repoRoot: string): string[] {
  const workspaceDir = join(repoRoot, DIR_VIBEN, DIR_WORKSPACE);

  if (!existsSync(workspaceDir)) {
    return [];
  }

  try {
    return readdirSync(workspaceDir, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory() && !dirent.name.startsWith("."))
      .map((dirent) => dirent.name);
  } catch {
    return [];
  }
}

// =============================================================================
// Journal File
// =============================================================================

/**
 * Get the active (latest) journal file
 *
 * @param repoRoot - Repository root path
 * @returns Path to active journal file or null
 */
export function getActiveJournalFile(repoRoot: string): string | null {
  const workspaceDir = getWorkspaceDir(repoRoot);
  if (!workspaceDir || !existsSync(workspaceDir)) {
    return null;
  }

  let latestFile: string | null = null;
  let highestNum = 0;

  try {
    const files = readdirSync(workspaceDir);
    for (const file of files) {
      if (file.startsWith(FILE_JOURNAL_PREFIX) && file.endsWith(".md")) {
        // Extract number from filename (e.g., "journal-1.md" -> 1)
        const match = file.match(/journal-(\d+)\.md$/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > highestNum) {
            highestNum = num;
            latestFile = join(workspaceDir, file);
          }
        }
      }
    }
  } catch {
    // Ignore errors
  }

  return latestFile;
}

/**
 * Get journal file info (file path, number, line count)
 *
 * @param repoRoot - Repository root path
 * @returns Object with file, number, and lines, or null values if not found
 */
export function getJournalInfo(repoRoot: string): {
  file: string | null;
  number: number;
  lines: number;
} {
  const journalFile = getActiveJournalFile(repoRoot);
  if (!journalFile) {
    return { file: null, number: 0, lines: 0 };
  }

  const match = journalFile.match(/journal-(\d+)\.md$/);
  const number = match ? parseInt(match[1], 10) : 0;
  const lines = countLines(journalFile);

  return { file: journalFile, number, lines };
}

/**
 * Count lines in a file
 *
 * @param filePath - Path to file
 * @returns Number of lines, or 0 if file doesn't exist
 */
export function countLines(filePath: string): number {
  if (!existsSync(filePath)) {
    return 0;
  }

  try {
    const content = readFileSync(filePath, "utf-8");
    // Match Python's splitlines() behavior:
    // - "a\nb" -> ["a", "b"] (length 2)
    // - "a\nb\n" -> ["a", "b"] (length 2, not 3)
    // - "" -> [] (length 0, but we return 1 for empty file like Python)
    const lines = content.split("\n");
    // If content ends with newline, the last element is empty string - don't count it
    if (lines.length > 0 && lines[lines.length - 1] === "") {
      return lines.length - 1;
    }
    return lines.length;
  } catch {
    return 0;
  }
}

// =============================================================================
// Current Task
// =============================================================================

/**
 * Get current task path (relative to repo root)
 *
 * @param repoRoot - Repository root path
 * @returns Relative path to current task directory or null
 */
export function getCurrentTask(repoRoot: string): string | null {
  const currentFile = join(repoRoot, DIR_VIBEN, FILE_CURRENT_TASK);

  if (!existsSync(currentFile)) {
    return null;
  }

  try {
    return readFileSync(currentFile, "utf-8").trim() || null;
  } catch {
    return null;
  }
}

/**
 * Get current task absolute path
 *
 * @param repoRoot - Repository root path
 * @returns Absolute path to current task directory or null
 */
export function getCurrentTaskAbs(repoRoot: string): string | null {
  const relative = getCurrentTask(repoRoot);
  if (!relative) {
    return null;
  }
  return join(repoRoot, relative);
}

// =============================================================================
// Git Operations
// =============================================================================

/**
 * Run a git command and return the output
 *
 * @param args - Git command arguments
 * @param cwd - Working directory
 * @returns Object with code, stdout, stderr
 */
export function runGitCommand(
  args: string[],
  cwd: string
): { code: number; stdout: string; stderr: string } {
  try {
    // Force UTF-8 encoding for consistent output
    const gitArgs = ["-c", "i18n.logOutputEncoding=UTF-8", ...args];
    const stdout = execSync(`git ${gitArgs.join(" ")}`, {
      cwd,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      maxBuffer: 10 * 1024 * 1024, // 10MB
    });
    return { code: 0, stdout, stderr: "" };
  } catch (error: unknown) {
    const execError = error as {
      status?: number;
      stdout?: string;
      stderr?: string;
      message?: string;
    };
    return {
      code: execError.status ?? 1,
      stdout: execError.stdout ?? "",
      stderr: execError.stderr ?? execError.message ?? "",
    };
  }
}

/**
 * Get git branch name
 *
 * @param repoRoot - Repository root path
 * @returns Branch name or "unknown"
 */
export function getGitBranch(repoRoot: string): string {
  const result = runGitCommand(["branch", "--show-current"], repoRoot);
  return result.stdout.trim() || "unknown";
}

/**
 * Get git status (porcelain format)
 *
 * @param repoRoot - Repository root path
 * @returns Array of status lines
 */
export function getGitStatus(repoRoot: string): string[] {
  const result = runGitCommand(["status", "--porcelain"], repoRoot);
  return result.stdout
    .split("\n")
    .filter((line) => line.trim())
    .slice(0, 10); // Limit to 10 lines
}

/**
 * Get git status count
 *
 * @param repoRoot - Repository root path
 * @returns Number of uncommitted changes
 */
export function getGitStatusCount(repoRoot: string): number {
  const result = runGitCommand(["status", "--porcelain"], repoRoot);
  return result.stdout.split("\n").filter((line) => line.trim()).length;
}

/**
 * Get recent commits
 *
 * @param repoRoot - Repository root path
 * @param count - Number of commits to return (default: 5)
 * @returns Array of commit objects with hash and message
 */
export function getRecentCommits(
  repoRoot: string,
  count: number = 5
): Array<{ hash: string; message: string }> {
  const result = runGitCommand(
    ["log", "--oneline", `-${count}`],
    repoRoot
  );

  const commits: Array<{ hash: string; message: string }> = [];
  for (const line of result.stdout.split("\n")) {
    if (line.trim()) {
      const parts = line.split(" ", 1);
      const hash = parts[0] || "";
      const message = line.slice(hash.length + 1) || "";
      commits.push({ hash, message });
    }
  }

  return commits;
}

// =============================================================================
// Task Operations
// =============================================================================

/**
 * Read task.json file
 *
 * @param taskDir - Path to task directory
 * @returns Parsed task object or null
 */
export function readTaskJson(taskDir: string): Record<string, unknown> | null {
  const taskJsonPath = join(taskDir, FILE_TASK_JSON);
  if (!existsSync(taskJsonPath)) {
    return null;
  }

  try {
    const content = readFileSync(taskJsonPath, "utf-8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Get all active tasks (excluding archive)
 *
 * @param repoRoot - Repository root path
 * @returns Array of task info objects
 */
export function getActiveTasks(repoRoot: string): Array<{
  dir: string;
  name: string;
  status: string;
  assignee: string;
  title: string;
  priority: string;
}> {
  const tasksDir = getTasksDir(repoRoot);
  if (!existsSync(tasksDir)) {
    return [];
  }

  const tasks: Array<{
    dir: string;
    name: string;
    status: string;
    assignee: string;
    title: string;
    priority: string;
  }> = [];

  try {
    const dirs = readdirSync(tasksDir, { withFileTypes: true });
    for (const dirent of dirs) {
      if (dirent.isDirectory() && dirent.name !== DIR_ARCHIVE) {
        const taskData = readTaskJson(join(tasksDir, dirent.name));
        if (taskData) {
          tasks.push({
            dir: dirent.name,
            name: String(taskData.name ?? taskData.id ?? "unknown"),
            status: String(taskData.status ?? "unknown"),
            assignee: String(taskData.assignee ?? "-"),
            title: String(taskData.title ?? taskData.name ?? "unknown"),
            priority: String(taskData.priority ?? "P2"),
          });
        }
      }
    }
  } catch {
    // Ignore errors
  }

  return tasks.sort((a, b) => a.dir.localeCompare(b.dir));
}

// =============================================================================
// Session Operations
// =============================================================================

/**
 * Get current session number from index.md
 *
 * @param indexPath - Path to index.md file
 * @returns Session number or 0 if not found
 */
export function getCurrentSessionNumber(indexPath: string): number {
  if (!existsSync(indexPath)) {
    return 0;
  }

  try {
    const content = readFileSync(indexPath, "utf-8");
    for (const line of content.split("\n")) {
      if (line.includes("Total Sessions")) {
        const match = line.match(/:\s*(\d+)/);
        if (match) {
          return parseInt(match[1], 10);
        }
      }
    }
  } catch {
    // Ignore errors
  }

  return 0;
}

/**
 * Generate session content markdown
 *
 * @param params - Session parameters
 * @returns Markdown content string
 */
export function generateSessionContent(params: {
  sessionNum: number;
  title: string;
  commit: string;
  summary: string;
  extraContent: string;
  date: string;
}): string {
  const { sessionNum, title, commit, summary, extraContent, date } = params;

  let commitTable: string;
  if (commit && commit !== "-") {
    const lines = ["| Hash | Message |", "|------|---------|"];
    for (const c of commit.split(",")) {
      const trimmed = c.trim();
      lines.push(`| \`${trimmed}\` | (see git log) |`);
    }
    commitTable = lines.join("\n");
  } else {
    commitTable = "(No commits - planning session)";
  }

  return `

## Session ${sessionNum}: ${title}

**Date**: ${date}
**Task**: ${title}

### Summary

${summary}

### Main Changes

${extraContent}

### Git Commits

${commitTable}

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete
`;
}

/**
 * Create a new journal file
 *
 * @param params - Creation parameters
 * @returns Path to new file
 */
export async function createNewJournalFile(params: {
  workspaceDir: string;
  number: number;
  developer: string;
  date: string;
  prevNumber: number;
}): Promise<string> {
  const { workspaceDir, number, developer, date, prevNumber } = params;
  const newFilePath = join(workspaceDir, `${FILE_JOURNAL_PREFIX}${number}.md`);

  const content = `# Journal - ${developer} (Part ${number})

> Continuation from \`${FILE_JOURNAL_PREFIX}${prevNumber}.md\` (archived at ~${MAX_JOURNAL_LINES} lines)
> Started: ${date}

---

`;

  await writeFile(newFilePath, content, "utf-8");
  return newFilePath;
}

/**
 * Update index.md with new session info
 *
 * @param params - Update parameters
 * @returns True on success
 */
export async function updateIndexWithSession(params: {
  indexPath: string;
  workspaceDir: string;
  sessionNum: number;
  title: string;
  commit: string;
  activeFile: string;
  date: string;
}): Promise<boolean> {
  const { indexPath, workspaceDir, sessionNum, title, commit, activeFile, date } =
    params;

  if (!existsSync(indexPath)) {
    return false;
  }

  // Format commit for display
  let commitDisplay = "-";
  if (commit && commit !== "-") {
    commitDisplay = commit
      .split(",")
      .map((c) => `\`${c.trim()}\``)
      .join(", ");
  }

  // Get active file number and count all journal files
  const match = activeFile.match(/journal-(\d+)\.md$/);
  const activeNum = match ? parseInt(match[1], 10) : 0;
  const filesTable = countJournalFiles(workspaceDir, activeNum);

  try {
    const content = await readFile(indexPath, "utf-8");

    if (!content.includes("@@@auto:current-status")) {
      return false;
    }

    const lines = content.split("\n");
    const newLines: string[] = [];

    let inCurrentStatus = false;
    let inActiveDocuments = false;
    let inSessionHistory = false;
    let headerWritten = false;

    for (const line of lines) {
      if (line.includes("@@@auto:current-status")) {
        newLines.push(line);
        inCurrentStatus = true;
        newLines.push(`- **Active File**: \`${activeFile}\``);
        newLines.push(`- **Total Sessions**: ${sessionNum}`);
        newLines.push(`- **Last Active**: ${date}`);
        continue;
      }

      if (line.includes("@@@/auto:current-status")) {
        inCurrentStatus = false;
        newLines.push(line);
        continue;
      }

      if (line.includes("@@@auto:active-documents")) {
        newLines.push(line);
        inActiveDocuments = true;
        newLines.push("| File | Lines | Status |");
        newLines.push("|------|-------|--------|");
        newLines.push(filesTable);
        continue;
      }

      if (line.includes("@@@/auto:active-documents")) {
        inActiveDocuments = false;
        newLines.push(line);
        continue;
      }

      if (line.includes("@@@auto:session-history")) {
        newLines.push(line);
        inSessionHistory = true;
        headerWritten = false;
        continue;
      }

      if (line.includes("@@@/auto:session-history")) {
        inSessionHistory = false;
        newLines.push(line);
        continue;
      }

      if (inCurrentStatus) {
        continue;
      }

      if (inActiveDocuments) {
        continue;
      }

      if (inSessionHistory) {
        newLines.push(line);
        if (line.match(/^\|\s*-/) && !headerWritten) {
          newLines.push(`| ${sessionNum} | ${date} | ${title} | ${commitDisplay} |`);
          headerWritten = true;
        }
        continue;
      }

      newLines.push(line);
    }

    await writeFile(indexPath, newLines.join("\n"), "utf-8");
    return true;
  } catch {
    return false;
  }
}

/**
 * Count journal files and return table rows
 *
 * @param workspaceDir - Workspace directory path
 * @param activeNum - Active journal number
 * @returns Table rows string
 */
function countJournalFiles(workspaceDir: string, activeNum: number): string {
  const activeFile = `${FILE_JOURNAL_PREFIX}${activeNum}.md`;
  const resultLines: string[] = [];

  try {
    const files = readdirSync(workspaceDir)
      .filter(
        (f) =>
          f.startsWith(FILE_JOURNAL_PREFIX) &&
          f.endsWith(".md") &&
          statSync(join(workspaceDir, f)).isFile()
      )
      .sort((a, b) => {
        const numA = parseInt(a.match(/(\d+)/)?.[1] ?? "0", 10);
        const numB = parseInt(b.match(/(\d+)/)?.[1] ?? "0", 10);
        return numB - numA; // Descending order
      });

    for (const filename of files) {
      const lines = countLines(join(workspaceDir, filename));
      const status = filename === activeFile ? "Active" : "Archived";
      resultLines.push(`| \`${filename}\` | ~${lines} | ${status} |`);
    }
  } catch {
    // Ignore errors
  }

  return resultLines.join("\n");
}

// =============================================================================
// Date Utilities
// =============================================================================

/**
 * Get today's date in YYYY-MM-DD format
 *
 * @returns Date string
 */
export function getTodayDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Get date prefix in MM-DD format for task IDs
 *
 * @returns Date prefix string
 */
export function getDatePrefix(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${month}-${day}`;
}

/**
 * Get year-month string in YYYY-MM format
 *
 * @returns Year-month string
 */
export function getYearMonth(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

// =============================================================================
// Task Name Resolution
// =============================================================================

/**
 * Slugify a string (convert to lowercase, replace non-alphanumeric with hyphens)
 *
 * @param input - Input string
 * @returns Slugified string
 */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Find a task by name in the tasks directory
 *
 * Supports:
 * - Exact match: "01-31-my-task"
 * - Suffix match: "my-task" matches "01-31-my-task"
 *
 * @param taskName - Task name to find
 * @param tasksDir - Tasks directory path
 * @returns Absolute path to task directory, or null if not found
 */
export function findTaskByName(
  taskName: string,
  tasksDir: string
): string | null {
  if (!taskName || !existsSync(tasksDir)) {
    return null;
  }

  // Try exact match first
  const exactPath = join(tasksDir, taskName);
  if (existsSync(exactPath) && statSync(exactPath).isDirectory()) {
    return exactPath;
  }

  // Try suffix match (e.g., "my-task" matches "01-31-my-task")
  try {
    const dirs = readdirSync(tasksDir, { withFileTypes: true });
    for (const dirent of dirs) {
      if (dirent.isDirectory() && dirent.name.endsWith(`-${taskName}`)) {
        return join(tasksDir, dirent.name);
      }
    }
  } catch {
    // Ignore errors
  }

  return null;
}

/**
 * Resolve task directory from task name or path
 *
 * Supports:
 * - Absolute path: /path/to/task
 * - Relative path: .viben/tasks/01-31-my-task
 * - Task name: my-task (uses findTaskByName)
 *
 * @param taskInput - Task input (name or path)
 * @param repoRoot - Repository root path
 * @returns Absolute path to task directory, or null if not found
 */
export function resolveTaskDirectory(
  taskInput: string,
  repoRoot: string
): string | null {
  if (!taskInput) {
    return null;
  }

  // Absolute path
  if (taskInput.startsWith("/")) {
    return taskInput;
  }

  // Relative path (contains path separator or starts with .viben)
  if (taskInput.includes("/") || taskInput.startsWith(".viben")) {
    return resolve(repoRoot, taskInput);
  }

  // Task name - try to find in tasks directory
  const tasksDir = getTasksDir(repoRoot);
  const found = findTaskByName(taskInput, tasksDir);
  if (found) {
    return found;
  }

  // Fallback to treating as directory name under tasks
  return join(tasksDir, taskInput);
}

// =============================================================================
// Current Task Operations
// =============================================================================

/**
 * Set the current task
 *
 * @param taskPath - Task directory path (relative to repo root)
 * @param repoRoot - Repository root path
 * @returns True on success, false on error
 */
export function setCurrentTask(taskPath: string, repoRoot: string): boolean {
  if (!taskPath) {
    return false;
  }

  // Verify task directory exists
  const fullPath = join(repoRoot, taskPath);
  if (!existsSync(fullPath) || !statSync(fullPath).isDirectory()) {
    return false;
  }

  const currentFile = join(repoRoot, DIR_VIBEN, FILE_CURRENT_TASK);

  try {
    writeFileSync(currentFile, taskPath, "utf-8");
    return true;
  } catch {
    return false;
  }
}

/**
 * Clear the current task
 *
 * @param repoRoot - Repository root path
 * @returns True on success
 */
export function clearCurrentTask(repoRoot: string): boolean {
  const currentFile = join(repoRoot, DIR_VIBEN, FILE_CURRENT_TASK);

  try {
    if (existsSync(currentFile)) {
      unlinkSync(currentFile);
    }
    return true;
  } catch {
    return false;
  }
}

// =============================================================================
// Task Archive Operations
// =============================================================================

/**
 * Get archive directory for current month
 *
 * @param repoRoot - Repository root path
 * @returns Path to archive directory
 */
export function getArchiveDir(repoRoot: string): string {
  return join(repoRoot, DIR_VIBEN, DIR_TASKS, DIR_ARCHIVE);
}

/**
 * Archive a task to the archive directory
 *
 * @param taskDir - Absolute path to task directory
 * @param repoRoot - Repository root path
 * @returns Path to archived task, or null on error
 */
export function archiveTask(
  taskDir: string,
  repoRoot: string
): string | null {
  if (!existsSync(taskDir) || !statSync(taskDir).isDirectory()) {
    return null;
  }

  const archiveBase = getArchiveDir(repoRoot);
  const yearMonth = getYearMonth();
  const monthDir = join(archiveBase, yearMonth);

  try {
    // Update task status to completed before archiving
    const taskJsonPath = join(taskDir, FILE_TASK_JSON);
    if (existsSync(taskJsonPath)) {
      try {
        const taskData = JSON.parse(readFileSync(taskJsonPath, "utf-8"));
        taskData.status = "completed";
        taskData.completedAt = getTodayDate();
        writeFileSync(taskJsonPath, JSON.stringify(taskData, null, 2), "utf-8");
      } catch {
        // Continue even if status update fails
      }
    }

    // Create archive directory if needed
    if (!existsSync(monthDir)) {
      mkdirSync(monthDir, { recursive: true });
    }

    // Move task to archive
    const taskName = taskDir.split("/").pop() || "";
    const destPath = join(monthDir, taskName);

    renameSync(taskDir, destPath);
    return destPath;
  } catch {
    return null;
  }
}

/**
 * Get archived tasks list
 *
 * @param repoRoot - Repository root path
 * @param month - Optional month filter (YYYY-MM format)
 * @returns Map of month to task names
 */
export function getArchivedTasks(
  repoRoot: string,
  month?: string
): Map<string, string[]> {
  const archiveDir = getArchiveDir(repoRoot);
  const result = new Map<string, string[]>();

  if (!existsSync(archiveDir)) {
    return result;
  }

  try {
    const monthDirs = readdirSync(archiveDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .filter((d) => !month || d.name === month)
      .sort((a, b) => b.name.localeCompare(a.name)); // Descending order

    for (const monthDir of monthDirs) {
      const monthPath = join(archiveDir, monthDir.name);
      const tasks = readdirSync(monthPath, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name)
        .sort();
      result.set(monthDir.name, tasks);
    }
  } catch {
    // Ignore errors
  }

  return result;
}

// =============================================================================
// Task JSON Operations
// =============================================================================

/**
 * Write task.json file
 *
 * @param taskDir - Path to task directory
 * @param data - Task data object
 * @returns True on success
 */
export function writeTaskJson(
  taskDir: string,
  data: Record<string, unknown>
): boolean {
  const taskJsonPath = join(taskDir, FILE_TASK_JSON);
  try {
    writeFileSync(
      taskJsonPath,
      JSON.stringify(data, null, 2),
      "utf-8"
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Update a field in task.json
 *
 * @param taskDir - Path to task directory
 * @param field - Field name to update
 * @param value - New value
 * @returns True on success
 */
export function updateTaskField(
  taskDir: string,
  field: string,
  value: unknown
): boolean {
  const taskData = readTaskJson(taskDir);
  if (!taskData) {
    return false;
  }

  taskData[field] = value;
  return writeTaskJson(taskDir, taskData);
}

// =============================================================================
// JSONL Context Operations
// =============================================================================

/**
 * Read JSONL file and return entries
 *
 * @param filePath - Path to JSONL file
 * @returns Array of parsed entries
 */
export function readJsonlFile(
  filePath: string
): Array<Record<string, unknown>> {
  if (!existsSync(filePath)) {
    return [];
  }

  try {
    const content = readFileSync(filePath, "utf-8");
    const entries: Array<Record<string, unknown>> = [];
    for (const line of content.split("\n")) {
      if (line.trim()) {
        try {
          entries.push(JSON.parse(line));
        } catch {
          // Skip invalid JSON lines
        }
      }
    }
    return entries;
  } catch {
    return [];
  }
}

/**
 * Write entries to JSONL file
 *
 * @param filePath - Path to JSONL file
 * @param entries - Array of entries to write
 * @returns True on success
 */
export function writeJsonlFile(
  filePath: string,
  entries: Array<Record<string, unknown>>
): boolean {
  try {
    const lines = entries.map((e) => JSON.stringify(e));
    writeFileSync(filePath, lines.join("\n") + "\n", "utf-8");
    return true;
  } catch {
    return false;
  }
}

/**
 * Append entry to JSONL file
 *
 * @param filePath - Path to JSONL file
 * @param entry - Entry to append
 * @returns True on success
 */
export function appendToJsonl(
  filePath: string,
  entry: Record<string, unknown>
): boolean {
  try {
    appendFileSync(filePath, JSON.stringify(entry) + "\n", "utf-8");
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if entry already exists in JSONL file (by file path)
 *
 * @param filePath - Path to JSONL file
 * @param entryPath - File path to check
 * @returns True if exists
 */
export function jsonlEntryExists(
  filePath: string,
  entryPath: string
): boolean {
  const entries = readJsonlFile(filePath);
  return entries.some((e) => e.file === entryPath);
}

// =============================================================================
// Path Safety
// =============================================================================

/**
 * Check if a task path is safe to operate on
 *
 * @param taskPath - Task path (relative to repo root)
 * @param repoRoot - Repository root path
 * @returns True if safe, false if dangerous
 */
export function isSafeTaskPath(taskPath: string, repoRoot: string): boolean {
  // Check empty or null
  if (!taskPath || taskPath === "null") {
    return false;
  }

  // Reject absolute paths
  if (taskPath.startsWith("/")) {
    return false;
  }

  // Reject path traversal
  if (
    taskPath === "." ||
    taskPath === ".." ||
    taskPath.startsWith("./") ||
    taskPath.startsWith("../") ||
    taskPath.includes("..")
  ) {
    return false;
  }

  // Final check: ensure resolved path is not the repo root
  const absPath = resolve(repoRoot, taskPath);
  if (existsSync(absPath)) {
    try {
      const resolved = resolve(absPath);
      const rootResolved = resolve(repoRoot);
      if (resolved === rootResolved) {
        return false;
      }
    } catch {
      // Ignore errors
    }
  }

  return true;
}

// =============================================================================
// Phase Management
// =============================================================================

/**
 * Get current phase number from task.json
 *
 * @param taskJsonPath - Path to task.json file
 * @returns Current phase number, or 0 if not found
 */
export function getCurrentPhase(taskJsonPath: string): number {
  const taskDir = taskJsonPath.endsWith(FILE_TASK_JSON)
    ? taskJsonPath.slice(0, -FILE_TASK_JSON.length - 1)
    : taskJsonPath;
  const data = readTaskJson(taskDir);
  if (!data) {
    return 0;
  }
  return (data.current_phase as number) || 0;
}

/**
 * Get total number of phases from task.json
 *
 * @param taskJsonPath - Path to task.json file
 * @returns Total phase count, or 0 if not found
 */
export function getTotalPhases(taskJsonPath: string): number {
  const taskDir = taskJsonPath.endsWith(FILE_TASK_JSON)
    ? taskJsonPath.slice(0, -FILE_TASK_JSON.length - 1)
    : taskJsonPath;
  const data = readTaskJson(taskDir);
  if (!data) {
    return 0;
  }

  const nextAction = data.next_action;
  if (Array.isArray(nextAction)) {
    return nextAction.length;
  }
  return 0;
}

/**
 * Get action name for a specific phase
 *
 * @param taskJsonPath - Path to task.json file
 * @param phase - Phase number
 * @returns Action name, or "unknown" if not found
 */
export function getPhaseAction(taskJsonPath: string, phase: number): string {
  const taskDir = taskJsonPath.endsWith(FILE_TASK_JSON)
    ? taskJsonPath.slice(0, -FILE_TASK_JSON.length - 1)
    : taskJsonPath;
  const data = readTaskJson(taskDir);
  if (!data) {
    return "unknown";
  }

  const nextAction = data.next_action;
  if (Array.isArray(nextAction)) {
    for (const item of nextAction) {
      if (typeof item === "object" && item !== null && (item as Record<string, unknown>).phase === phase) {
        return ((item as Record<string, unknown>).action as string) || "unknown";
      }
    }
  }
  return "unknown";
}

/**
 * Get formatted phase info: "N/M (action)"
 *
 * @param taskJsonPath - Path to task.json file
 * @returns Formatted string like "1/4 (implement)"
 */
export function getPhaseInfo(taskJsonPath: string): string {
  const currentPhase = getCurrentPhase(taskJsonPath);
  const totalPhases = getTotalPhases(taskJsonPath);
  const actionName = getPhaseAction(taskJsonPath, currentPhase);

  if (currentPhase === 0) {
    return `0/${totalPhases} (pending)`;
  }
  return `${currentPhase}/${totalPhases} (${actionName})`;
}

/**
 * Set current phase to a specific value
 *
 * @param taskJsonPath - Path to task.json file
 * @param phase - Phase number to set
 * @returns True on success, false on error
 */
export function setPhase(taskJsonPath: string, phase: number): boolean {
  const taskDir = taskJsonPath.endsWith(FILE_TASK_JSON)
    ? taskJsonPath.slice(0, -FILE_TASK_JSON.length - 1)
    : taskJsonPath;
  return updateTaskField(taskDir, "current_phase", phase);
}

/**
 * Advance to next phase
 *
 * @param taskJsonPath - Path to task.json file
 * @returns True on success, false on error or at final phase
 */
export function advancePhase(taskJsonPath: string): boolean {
  const currentPhase = getCurrentPhase(taskJsonPath);
  const totalPhases = getTotalPhases(taskJsonPath);
  const nextPhase = currentPhase + 1;

  if (nextPhase > totalPhases) {
    return false; // Already at final phase
  }

  return setPhase(taskJsonPath, nextPhase);
}

/**
 * Get phase number for a specific action name
 *
 * @param taskJsonPath - Path to task.json file
 * @param action - Action name
 * @returns Phase number, or 0 if not found
 */
export function getPhaseForAction(taskJsonPath: string, action: string): number {
  const taskDir = taskJsonPath.endsWith(FILE_TASK_JSON)
    ? taskJsonPath.slice(0, -FILE_TASK_JSON.length - 1)
    : taskJsonPath;
  const data = readTaskJson(taskDir);
  if (!data) {
    return 0;
  }

  const nextAction = data.next_action;
  if (Array.isArray(nextAction)) {
    for (const item of nextAction) {
      if (typeof item === "object" && item !== null && (item as Record<string, unknown>).action === action) {
        return ((item as Record<string, unknown>).phase as number) || 0;
      }
    }
  }
  return 0;
}

// =============================================================================
// Agent Registry
// =============================================================================

/** Agent registry directory name */
const DIR_AGENTS = ".agents";

/** Agent registry file name */
const FILE_REGISTRY = "registry.json";

/**
 * Agent registry entry
 */
export interface AgentRegistryEntry {
  id: string;
  worktree_path: string;
  pid: number;
  started_at: string;
  task_dir: string;
  platform: string;
}

/**
 * Agent registry structure
 */
export interface AgentRegistry {
  agents: AgentRegistryEntry[];
}

/**
 * Get agents directory for current developer
 *
 * @param repoRoot - Repository root path
 * @returns Path to agents directory, or null if no workspace
 */
export function getAgentsDir(repoRoot: string): string | null {
  const workspaceDir = getWorkspaceDir(repoRoot);
  if (workspaceDir) {
    return join(workspaceDir, DIR_AGENTS);
  }
  return null;
}

/**
 * Get registry file path
 *
 * @param repoRoot - Repository root path
 * @returns Path to registry.json, or null if agents dir not found
 */
export function getRegistryFile(repoRoot: string): string | null {
  const agentsDir = getAgentsDir(repoRoot);
  if (agentsDir) {
    return join(agentsDir, FILE_REGISTRY);
  }
  return null;
}

/**
 * Read agent registry
 *
 * @param repoRoot - Repository root path
 * @returns Registry object, or null if not found
 */
function readRegistry(repoRoot: string): AgentRegistry | null {
  const registryFile = getRegistryFile(repoRoot);
  if (!registryFile || !existsSync(registryFile)) {
    return null;
  }

  try {
    const content = readFileSync(registryFile, "utf-8");
    return JSON.parse(content) as AgentRegistry;
  } catch {
    return null;
  }
}

/**
 * Write agent registry
 *
 * @param repoRoot - Repository root path
 * @param registry - Registry to write
 * @returns True on success
 */
function writeRegistry(repoRoot: string, registry: AgentRegistry): boolean {
  const registryFile = getRegistryFile(repoRoot);
  if (!registryFile) {
    return false;
  }

  try {
    const agentsDir = getAgentsDir(repoRoot);
    if (agentsDir && !existsSync(agentsDir)) {
      mkdirSync(agentsDir, { recursive: true });
    }
    writeFileSync(registryFile, JSON.stringify(registry, null, 2), "utf-8");
    return true;
  } catch {
    return false;
  }
}

/**
 * Get agent by ID
 *
 * @param agentId - Agent ID
 * @param repoRoot - Repository root path
 * @returns Agent entry, or null if not found
 */
export function registryGetAgentById(
  agentId: string,
  repoRoot: string
): AgentRegistryEntry | null {
  const registry = readRegistry(repoRoot);
  if (!registry) {
    return null;
  }

  for (const agent of registry.agents) {
    if (agent.id === agentId) {
      return agent;
    }
  }
  return null;
}

/**
 * Search agent by ID or task_dir containing search term
 *
 * @param search - Search term
 * @param repoRoot - Repository root path
 * @returns First matching agent, or null if not found
 */
export function registrySearchAgent(
  search: string,
  repoRoot: string
): AgentRegistryEntry | null {
  const registry = readRegistry(repoRoot);
  if (!registry) {
    return null;
  }

  for (const agent of registry.agents) {
    // Exact ID match
    if (agent.id === search) {
      return agent;
    }
    // Partial match on task_dir
    if (agent.task_dir.includes(search)) {
      return agent;
    }
  }
  return null;
}

/**
 * Add agent to registry (replaces if same ID exists)
 *
 * @param params - Agent parameters
 * @param repoRoot - Repository root path
 * @returns True on success
 */
export function registryAddAgent(
  params: {
    agentId: string;
    worktreePath: string;
    pid: number;
    taskDir: string;
    platform?: string;
  },
  repoRoot: string
): boolean {
  let registry = readRegistry(repoRoot);
  if (!registry) {
    registry = { agents: [] };
  }

  // Remove existing agent with same ID
  registry.agents = registry.agents.filter((a) => a.id !== params.agentId);

  // Create new agent record
  const newAgent: AgentRegistryEntry = {
    id: params.agentId,
    worktree_path: params.worktreePath,
    pid: params.pid,
    started_at: new Date().toISOString(),
    task_dir: params.taskDir,
    platform: params.platform || "claude",
  };

  registry.agents.push(newAgent);
  return writeRegistry(repoRoot, registry);
}

/**
 * Remove agent by ID
 *
 * @param agentId - Agent ID
 * @param repoRoot - Repository root path
 * @returns True on success
 */
export function registryRemoveById(agentId: string, repoRoot: string): boolean {
  const registry = readRegistry(repoRoot);
  if (!registry) {
    return true; // Nothing to remove
  }

  registry.agents = registry.agents.filter((a) => a.id !== agentId);
  return writeRegistry(repoRoot, registry);
}

/**
 * List all agents
 *
 * @param repoRoot - Repository root path
 * @returns List of agent entries
 */
export function registryListAgents(repoRoot: string): AgentRegistryEntry[] {
  const registry = readRegistry(repoRoot);
  if (!registry) {
    return [];
  }
  return registry.agents;
}

// =============================================================================
// Worktree Configuration
// =============================================================================

/** Worktree config file name */
const FILE_WORKTREE_CONFIG = "worktree.yaml";

/**
 * Parse simple YAML (only supports key: value and lists)
 *
 * @param content - YAML content string
 * @returns Parsed object
 */
export function parseSimpleYaml(content: string): Record<string, string | string[]> {
  const result: Record<string, string | string[]> = {};
  let currentKey: string | null = null;
  let currentList: string[] | null = null;

  for (const line of content.split("\n")) {
    const stripped = line.trim();
    if (!stripped || stripped.startsWith("#")) {
      continue;
    }

    if (stripped.startsWith("- ")) {
      if (currentList !== null) {
        const value = stripped.slice(2).trim().replace(/^["']|["']$/g, "");
        currentList.push(value);
      }
    } else if (stripped.includes(":")) {
      const colonIndex = stripped.indexOf(":");
      const key = stripped.slice(0, colonIndex).trim();
      const value = stripped.slice(colonIndex + 1).trim().replace(/^["']|["']$/g, "");
      if (value) {
        result[key] = value;
        currentKey = null;
        currentList = null;
      } else {
        currentKey = key;
        currentList = [];
        result[key] = currentList;
      }
    }
  }

  return result;
}

/**
 * Get worktree.yaml config file path
 *
 * @param repoRoot - Repository root path
 * @returns Path to config file
 */
export function getWorktreeConfig(repoRoot: string): string {
  return join(repoRoot, DIR_VIBEN, FILE_WORKTREE_CONFIG);
}

/**
 * Get worktree base directory
 *
 * @param repoRoot - Repository root path
 * @returns Path to worktree base directory
 */
export function getWorktreeBaseDir(repoRoot: string): string {
  const configPath = getWorktreeConfig(repoRoot);
  let worktreeDir = "../worktrees"; // Default

  if (existsSync(configPath)) {
    try {
      const content = readFileSync(configPath, "utf-8");
      const config = parseSimpleYaml(content);
      if (typeof config.worktree_dir === "string") {
        worktreeDir = config.worktree_dir;
      }
    } catch {
      // Use default
    }
  }

  // Handle relative path
  if (worktreeDir.startsWith("../") || worktreeDir.startsWith("./")) {
    return resolve(repoRoot, worktreeDir);
  }
  return worktreeDir;
}

// =============================================================================
// Task Queue Statistics
// =============================================================================

/**
 * Task statistics
 */
export interface TaskStats {
  P0: number;
  P1: number;
  P2: number;
  P3: number;
  Total: number;
}

/**
 * Get task statistics (priority counts)
 *
 * @param repoRoot - Repository root path
 * @returns Stats object
 */
export function getTaskStats(repoRoot: string): TaskStats {
  const tasksDir = getTasksDir(repoRoot);
  const stats: TaskStats = { P0: 0, P1: 0, P2: 0, P3: 0, Total: 0 };

  if (!existsSync(tasksDir)) {
    return stats;
  }

  try {
    const dirs = readdirSync(tasksDir, { withFileTypes: true });
    for (const dirent of dirs) {
      if (dirent.isDirectory() && dirent.name !== DIR_ARCHIVE) {
        const taskData = readTaskJson(join(tasksDir, dirent.name));
        if (taskData) {
          const priority = (taskData.priority as string) || "P2";
          if (priority in stats) {
            stats[priority as keyof Omit<TaskStats, "Total">]++;
          }
          stats.Total++;
        }
      }
    }
  } catch {
    // Ignore errors
  }

  return stats;
}

/**
 * Format task stats as string
 *
 * @param stats - Stats from getTaskStats
 * @returns Formatted string like "P0:0 P1:1 P2:2 P3:0 Total:3"
 */
export function formatTaskStats(stats: TaskStats): string {
  return `P0:${stats.P0} P1:${stats.P1} P2:${stats.P2} P3:${stats.P3} Total:${stats.Total}`;
}

// =============================================================================
// Process Utilities
// =============================================================================

/**
 * Check if a PID is running
 *
 * @param pid - Process ID
 * @returns True if running
 */
export function isProcessRunning(pid: number | string | null | undefined): boolean {
  if (!pid) {
    return false;
  }

  try {
    const pidNum = typeof pid === "string" ? parseInt(pid, 10) : pid;
    if (isNaN(pidNum)) {
      return false;
    }
    // On Unix, kill with signal 0 checks if process exists
    process.kill(pidNum, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Calculate elapsed time from ISO timestamp
 *
 * @param started - ISO timestamp string
 * @returns Formatted elapsed time (e.g., "5m 30s")
 */
export function calcElapsed(started: string | null | undefined): string {
  if (!started) {
    return "N/A";
  }

  try {
    // Handle timezone suffix
    let dateStr = started;
    if (dateStr.includes("+")) {
      dateStr = dateStr.split("+")[0];
    }

    const startDt = new Date(dateStr);
    const now = new Date();
    const elapsed = (now.getTime() - startDt.getTime()) / 1000;

    if (elapsed < 60) {
      return `${Math.floor(elapsed)}s`;
    } else if (elapsed < 3600) {
      const mins = Math.floor(elapsed / 60);
      const secs = Math.floor(elapsed % 60);
      return `${mins}m ${secs}s`;
    } else {
      const hours = Math.floor(elapsed / 3600);
      const mins = Math.floor((elapsed % 3600) / 60);
      return `${hours}h ${mins}m`;
    }
  } catch {
    return "N/A";
  }
}

// =============================================================================
// Task Status Lifecycle
// =============================================================================

// NOTE: TaskEventType is imported from task-service.ts (re-exported above)
// This validation function handles a subset of CLI-relevant transitions

/**
 * Validate if a status transition is legal
 *
 * Based on the task lifecycle defined in docs/specs/modules/task-system.md
 *
 * @param currentStatus - Current task status
 * @param targetStatus - Target task status
 * @param eventType - The event type causing this transition
 * @returns Object with valid flag and optional error message
 */
export function validateStatusTransition(
  currentStatus: string,
  targetStatus: string,
  eventType: TaskEventType
): { valid: boolean; error?: string } {
  // CLI-relevant status transitions
  const validTransitions: Partial<Record<TaskEventType, { from: string[]; to: string }>> = {
    QUEUE: { from: ["backlog"], to: "queue" },
    START: { from: ["queue"], to: "in_progress" },
    DEQUEUE: { from: ["queue"], to: "backlog" },
    PAUSE: { from: ["queue", "in_progress"], to: "paused" },
    RESUME: { from: ["paused"], to: "queue" }, // Note: actual target determined by pausedSnapshot
    APPROVED: { from: ["human_review"], to: "completed" },
    REJECTED: { from: ["human_review"], to: "backlog" },
    RETRY: { from: ["failed"], to: "queue" },
    CANCEL: { from: ["backlog", "queue", "paused", "in_progress", "human_review"], to: "cancelled" },
  };

  const transition = validTransitions[eventType];
  if (!transition) {
    return { valid: false, error: `Unsupported event type for CLI: ${eventType}` };
  }

  if (!transition.from.includes(currentStatus)) {
    return {
      valid: false,
      error: `Cannot ${eventType.toLowerCase()} task in '${currentStatus}' status. Expected: ${transition.from.join(" or ")}`,
    };
  }

  // For RESUME, target is dynamic based on pausedSnapshot, skip target validation
  if (eventType !== "RESUME" && targetStatus !== transition.to) {
    return {
      valid: false,
      error: `Invalid target status '${targetStatus}' for ${eventType}. Expected: ${transition.to}`,
    };
  }

  return { valid: true };
}

/**
 * Update task status with additional fields
 *
 * @param taskDir - Absolute path to task directory
 * @param newStatus - New status value
 * @param additionalFields - Optional additional fields to update
 * @returns True on success
 */
export function updateTaskStatus(
  taskDir: string,
  newStatus: string,
  additionalFields?: Record<string, unknown>
): boolean {
  const taskJsonPath = join(taskDir, FILE_TASK_JSON);
  if (!existsSync(taskJsonPath)) {
    return false;
  }

  try {
    const taskData = JSON.parse(readFileSync(taskJsonPath, "utf-8"));
    taskData.status = newStatus;

    // Merge additional fields
    if (additionalFields) {
      for (const [key, value] of Object.entries(additionalFields)) {
        if (value === null || value === undefined) {
          delete taskData[key];
        } else {
          taskData[key] = value;
        }
      }
    }

    writeFileSync(taskJsonPath, JSON.stringify(taskData, null, 2), "utf-8");
    return true;
  } catch {
    return false;
  }
}

/**
 * Generate a simple UUID v4
 */
function generateEventId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Get the next sequence number for events in a task
 */
function getNextEventSequence(taskDir: string): number {
  const eventsPath = join(taskDir, "events.jsonl");
  if (!existsSync(eventsPath)) {
    return 1;
  }

  try {
    const content = readFileSync(eventsPath, "utf-8");
    const lines = content.split("\n").filter(line => line.trim());
    let maxSeq = 0;
    for (const line of lines) {
      try {
        const event = JSON.parse(line);
        if (typeof event.sequence === "number" && event.sequence > maxSeq) {
          maxSeq = event.sequence;
        }
      } catch {
        // Skip invalid lines
      }
    }
    return maxSeq + 1;
  } catch {
    return 1;
  }
}

/**
 * Append an event to the task's events.jsonl file
 *
 * Events are used for event sourcing the task lifecycle.
 * Format matches TaskEvent interface from task-service.ts
 *
 * @param taskDir - Absolute path to task directory
 * @param eventType - Type of event
 * @param payload - Optional additional event data
 * @returns True on success
 */
export function appendTaskEvent(
  taskDir: string,
  eventType: TaskEventType,
  payload?: Record<string, unknown>
): boolean {
  const eventsPath = join(taskDir, "events.jsonl");

  const event = {
    eventId: generateEventId(),
    sequence: getNextEventSequence(taskDir),
    type: eventType,
    timestamp: new Date().toISOString(),
    payload: payload || undefined,
  };

  try {
    appendFileSync(eventsPath, JSON.stringify(event) + "\n", "utf-8");
    return true;
  } catch {
    return false;
  }
}

// =============================================================================
// CLI Adapter (Re-exported from swarm module)
// =============================================================================

// Re-export CLI adapter types and functions from the swarm module
// for backward compatibility
export {
  type Platform,
  type RunCommandOptions,
  type ICLIAdapter,
  CLIAdapter,
  createCLIAdapter,
  createCLIAdapterAuto,
  detectPlatform,
} from "./swarm/cli-adapter";
