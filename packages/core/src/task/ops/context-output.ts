/**
 * Task context output operations
 *
 * Generate session context for AI agents (JSON and text formats)
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

import {
  getDeveloper,
  getTasksDir,
  getActiveTasks,
  readTaskJson as readTaskJsonFromWorkspace,
  runGitCommand,
  getJournalInfo,
  DIR_VIBEN,
  DIR_WORKSPACE,
  DIR_TASKS,
} from "../../cli/lib/viben-workspace";

import type { ContextJson } from "./types";

/**
 * Get context as JSON object
 * @param repoRoot - Repository root directory
 * @param taskDir - Task directory (required for CURRENT TASK section)
 */
export function getContextJson(repoRoot: string, taskDir?: string): ContextJson {
  const developer = getDeveloper(repoRoot) || "";
  const _tasksDir = getTasksDir(repoRoot);

  // Git info
  const { stdout: branchOut } = runGitCommand(["branch", "--show-current"], repoRoot);
  const branch = branchOut.trim() || "unknown";

  const { stdout: statusOut } = runGitCommand(["status", "--porcelain"], repoRoot);
  const statusLines = statusOut.split("\n").filter((line) => line.trim());
  const gitStatusCount = statusLines.length;
  const isClean = gitStatusCount === 0;

  // Recent commits
  const { stdout: logOut } = runGitCommand(["log", "--oneline", "-5"], repoRoot);
  const commits: Array<{ hash: string; message: string }> = [];
  for (const line of logOut.split("\n")) {
    if (line.trim()) {
      const parts = line.split(" ", 1);
      const hash = parts[0] || "";
      const message = line.slice(hash.length + 1) || "";
      commits.push({ hash, message });
    }
  }

  // Current task - requires taskDir parameter
  let currentTask: ContextJson["currentTask"] = null;
  if (taskDir) {
    const taskData = readTaskJsonFromWorkspace(taskDir);
    if (taskData) {
      const prdFile = join(taskDir, "prd.md");
      // Get relative path from repoRoot
      const relativePath = taskDir.startsWith(repoRoot)
        ? taskDir.slice(repoRoot.length + 1)
        : taskDir;
      currentTask = {
        path: relativePath,
        name: String(taskData.name || taskData.id || "unknown"),
        status: String(taskData.status || "unknown"),
        createdAt: String(taskData.createdAt || "unknown"),
        description: String(taskData.description || ""),
        hasPrd: existsSync(prdFile),
      };
    }
  }

  // Active tasks
  const activeTasks = getActiveTasks(repoRoot);

  // My tasks (assigned to developer and not done)
  const myTasks: Array<{ title: string; priority: string; status: string }> = [];
  if (developer) {
    for (const task of activeTasks) {
      if (task.assignee === developer && task.status !== "done") {
        myTasks.push({
          title: task.title,
          priority: task.priority,
          status: task.status,
        });
      }
    }
  }

  // Journal info
  const journalInfo = getJournalInfo(repoRoot);
  const journalRelative = journalInfo.file && developer
    ? `${DIR_VIBEN}/${DIR_WORKSPACE}/${developer}/${journalInfo.file.split("/").pop()}`
    : "";

  return {
    developer,
    git: {
      branch,
      isClean,
      uncommittedChanges: gitStatusCount,
      recentCommits: commits,
    },
    currentTask,
    tasks: {
      active: activeTasks,
      directory: `${DIR_VIBEN}/${DIR_TASKS}`,
    },
    myTasks,
    journal: {
      file: journalRelative,
      lines: journalInfo.lines,
      nearLimit: journalInfo.lines > 1800,
    },
    paths: {
      workspace: `${DIR_VIBEN}/${DIR_WORKSPACE}/${developer}/`,
      tasks: `${DIR_VIBEN}/${DIR_TASKS}/`,
      spec: "docs/specs/",
    },
  };
}

/**
 * Get context as formatted text
 * @param repoRoot - Repository root directory
 * @param taskDir - Task directory (required for CURRENT TASK section)
 */
export function getContextText(repoRoot: string, taskDir?: string): string {
  const lines: string[] = [];
  const developer = getDeveloper(repoRoot);

  lines.push("========================================");
  lines.push("SESSION CONTEXT");
  lines.push("========================================");
  lines.push("");

  // Developer section
  lines.push("## DEVELOPER");
  if (!developer) {
    lines.push(
      `ERROR: Not initialized. Run: viben team init-developer <name>`
    );
    return lines.join("\n");
  }

  lines.push(`Name: ${developer}`);
  lines.push("");

  // Git status
  lines.push("## GIT STATUS");
  const { stdout: branchOut } = runGitCommand(["branch", "--show-current"], repoRoot);
  const branch = branchOut.trim() || "unknown";
  lines.push(`Branch: ${branch}`);

  const { stdout: statusOut } = runGitCommand(["status", "--porcelain"], repoRoot);
  const statusLines = statusOut.split("\n").filter((line) => line.trim());
  const statusCount = statusLines.length;

  if (statusCount === 0) {
    lines.push("Working directory: Clean");
  } else {
    lines.push(`Working directory: ${statusCount} uncommitted change(s)`);
    lines.push("");
    lines.push("Changes:");
    const { stdout: shortOut } = runGitCommand(["status", "--short"], repoRoot);
    for (const line of shortOut.split("\n").slice(0, 10)) {
      if (line.trim()) {
        lines.push(line);
      }
    }
  }
  lines.push("");

  // Recent commits
  lines.push("## RECENT COMMITS");
  const { stdout: logOut } = runGitCommand(["log", "--oneline", "-5"], repoRoot);
  if (logOut.trim()) {
    for (const line of logOut.split("\n")) {
      if (line.trim()) {
        lines.push(line);
      }
    }
  } else {
    lines.push("(no commits)");
  }
  lines.push("");

  // Current task - requires taskDir parameter
  lines.push("## CURRENT TASK");
  if (taskDir) {
    // Get relative path from repoRoot
    const relativePath = taskDir.startsWith(repoRoot)
      ? taskDir.slice(repoRoot.length + 1)
      : taskDir;
    lines.push(`Path: ${relativePath}`);

    const taskData = readTaskJsonFromWorkspace(taskDir);
    if (taskData) {
      const tName = String(taskData.name || taskData.id || "unknown");
      const tStatus = String(taskData.status || "unknown");
      const tCreated = String(taskData.createdAt || "unknown");
      const tDesc = String(taskData.description || "");

      lines.push(`Name: ${tName}`);
      lines.push(`Status: ${tStatus}`);
      lines.push(`Created: ${tCreated}`);
      if (tDesc) {
        lines.push(`Description: ${tDesc}`);
      }
    }

    // Check for prd.md
    const prdFile = join(taskDir, "prd.md");
    if (existsSync(prdFile)) {
      lines.push("");
      lines.push("[!] This task has prd.md - read it for task details");
    }
  } else {
    lines.push("(none)");
  }
  lines.push("");

  // Active tasks
  lines.push("## ACTIVE TASKS");
  const activeTasks = getActiveTasks(repoRoot);
  const taskCount = activeTasks.length;

  if (taskCount > 0) {
    for (const t of activeTasks) {
      lines.push(`- ${t.dir}/ (${t.status}) @${t.assignee}`);
    }
  } else {
    lines.push("(no active tasks)");
  }
  lines.push(`Total: ${taskCount} active task(s)`);
  lines.push("");

  // My tasks
  lines.push("## MY TASKS (Assigned to me)");
  let myTaskCount = 0;

  for (const t of activeTasks) {
    if (t.assignee === developer && t.status !== "done") {
      lines.push(`- [${t.priority}] ${t.title} (${t.status})`);
      myTaskCount++;
    }
  }

  if (myTaskCount === 0) {
    lines.push("(no tasks assigned to you)");
  }
  lines.push("");

  // Journal file
  lines.push("## JOURNAL FILE");
  const journalInfo = getJournalInfo(repoRoot);
  if (journalInfo.file) {
    const journalRelative = `${DIR_VIBEN}/${DIR_WORKSPACE}/${developer}/${journalInfo.file.split("/").pop()}`;
    lines.push(`Active file: ${journalRelative}`);
    lines.push(`Line count: ${journalInfo.lines} / 2000`);
    if (journalInfo.lines > 1800) {
      lines.push("[!] WARNING: Approaching 2000 line limit!");
    }
  } else {
    lines.push("No journal file found");
  }
  lines.push("");

  // Paths
  lines.push("## PATHS");
  lines.push(`Workspace: ${DIR_VIBEN}/${DIR_WORKSPACE}/${developer}/`);
  lines.push(`Tasks: ${DIR_VIBEN}/${DIR_TASKS}/`);
  lines.push("Spec: docs/specs/");
  lines.push("");

  lines.push("========================================");

  return lines.join("\n");
}
