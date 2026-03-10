/**
 * viben context - Get current development context
 *
 * Displays developer identity, Git status, current task, active tasks,
 * and journal file status. Useful for AI agents to understand project state.
 *
 * Usage:
 *   viben context         - Display full context (text format)
 *   viben context --json  - JSON format output
 */
import chalk from "chalk";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Command } from "commander";
import type { OutputContext } from "../types";
import {
  output,
  successResponse,
  errorResponse,
  handleCommandError,
} from "../lib";
import {
  findVibenRoot,
  getDeveloper,
  getActiveJournalFile,
  countLines,
  getCurrentTask,
  getGitBranch,
  getGitStatus,
  getGitStatusCount,
  getRecentCommits,
  getActiveTasks,
  readTaskJson,
  DIR_VIBEN,
  DIR_WORKSPACE,
  DIR_TASKS,
  DIR_SPEC,
} from "../lib/viben-workspace";

/**
 * Context data structure
 */
interface ContextData {
  developer: string;
  git: {
    branch: string;
    isClean: boolean;
    uncommittedChanges: number;
    recentCommits: Array<{
      hash: string;
      message: string;
    }>;
  };
  tasks: {
    active: Array<{
      dir: string;
      name: string;
      status: string;
    }>;
    directory: string;
  };
  journal: {
    file: string;
    lines: number;
    nearLimit: boolean;
  };
}

/**
 * Get output context from program options
 */
function getOutputContext(program: Command): OutputContext {
  const opts = program.opts();
  return {
    json: opts.json ?? false,
    verbose: opts.verbose ?? false,
    quiet: opts.quiet ?? false,
  };
}

/**
 * Get context as JSON data
 */
function getContextJson(repoRoot: string): ContextData {
  const developer = getDeveloper(repoRoot) || "";
  const journalFile = getActiveJournalFile(repoRoot);

  let journalLines = 0;
  let journalRelative = "";
  if (journalFile && developer) {
    journalLines = countLines(journalFile);
    const fileName = journalFile.split("/").pop() || "";
    journalRelative = `${DIR_VIBEN}/${DIR_WORKSPACE}/${developer}/${fileName}`;
  }

  // Git info
  const branch = getGitBranch(repoRoot);
  const gitStatusCount = getGitStatusCount(repoRoot);
  const isClean = gitStatusCount === 0;
  const commits = getRecentCommits(repoRoot, 5);

  // Tasks
  const tasks = getActiveTasks(repoRoot).map((t) => ({
    dir: t.dir,
    name: t.name,
    status: t.status,
  }));

  return {
    developer,
    git: {
      branch,
      isClean,
      uncommittedChanges: gitStatusCount,
      recentCommits: commits,
    },
    tasks: {
      active: tasks,
      directory: `${DIR_VIBEN}/${DIR_TASKS}`,
    },
    journal: {
      file: journalRelative,
      lines: journalLines,
      nearLimit: journalLines > 1800,
    },
  };
}

/**
 * Get context as formatted text
 */
function getContextText(repoRoot: string): string {
  const lines: string[] = [];

  lines.push("========================================");
  lines.push("SESSION CONTEXT");
  lines.push("========================================");
  lines.push("");

  const developer = getDeveloper(repoRoot);

  // Developer section
  lines.push("## DEVELOPER");
  if (!developer) {
    lines.push(
      `ERROR: Not initialized. Run: viben user init <name>`
    );
    return lines.join("\n");
  }

  lines.push(`Name: ${developer}`);
  lines.push("");

  // Git status
  lines.push("## GIT STATUS");
  const branch = getGitBranch(repoRoot);
  lines.push(`Branch: ${branch}`);

  const statusLines = getGitStatus(repoRoot);
  const statusCount = statusLines.length;

  if (statusCount === 0) {
    lines.push("Working directory: Clean");
  } else {
    lines.push(`Working directory: ${statusCount} uncommitted change(s)`);
    lines.push("");
    lines.push("Changes:");
    for (const line of statusLines) {
      lines.push(line);
    }
  }
  lines.push("");

  // Recent commits
  lines.push("## RECENT COMMITS");
  const commits = getRecentCommits(repoRoot, 5);
  if (commits.length > 0) {
    for (const commit of commits) {
      lines.push(`${commit.hash} ${commit.message}`);
    }
  } else {
    lines.push("(no commits)");
  }
  lines.push("");

  // Current task
  lines.push("## CURRENT TASK");
  const currentTask = getCurrentTask(repoRoot);
  if (currentTask) {
    const currentTaskDir = join(repoRoot, currentTask);
    const taskData = readTaskJson(currentTaskDir);

    lines.push(`Path: ${currentTask}`);

    if (taskData) {
      const tName = String(taskData.name ?? taskData.id ?? "unknown");
      const tStatus = String(taskData.status ?? "unknown");
      const tCreated = String(taskData.createdAt ?? "unknown");
      const tDesc = String(taskData.description ?? "");

      lines.push(`Name: ${tName}`);
      lines.push(`Status: ${tStatus}`);
      lines.push(`Created: ${tCreated}`);
      if (tDesc) {
        lines.push(`Description: ${tDesc}`);
      }
    }

    // Check for prd.md
    const prdFile = join(currentTaskDir, "prd.md");
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
  const tasks = getActiveTasks(repoRoot);

  if (tasks.length > 0) {
    for (const task of tasks) {
      lines.push(`- ${task.dir}/ (${task.status}) @${task.assignee}`);
    }
  } else {
    lines.push("(no active tasks)");
  }
  lines.push(`Total: ${tasks.length} active task(s)`);
  lines.push("");

  // My tasks
  lines.push("## MY TASKS (Assigned to me)");
  const myTasks = tasks.filter(
    (t) => t.assignee === developer && t.status !== "completed"
  );

  if (myTasks.length > 0) {
    for (const task of myTasks) {
      lines.push(`- [${task.priority}] ${task.title} (${task.status})`);
    }
  } else {
    lines.push("(no tasks assigned to you)");
  }
  lines.push("");

  // Journal file
  lines.push("## JOURNAL FILE");
  const journalFile = getActiveJournalFile(repoRoot);
  if (journalFile && developer) {
    const journalLines = countLines(journalFile);
    const fileName = journalFile.split("/").pop() || "";
    const relative = `${DIR_VIBEN}/${DIR_WORKSPACE}/${developer}/${fileName}`;
    lines.push(`Active file: ${relative}`);
    lines.push(`Line count: ${journalLines} / 2000`);
    if (journalLines > 1800) {
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
  lines.push(`Spec: ${DIR_VIBEN}/${DIR_SPEC}/`);
  lines.push("");

  lines.push("========================================");

  return lines.join("\n");
}

/**
 * Register the context command
 */
export function registerContextCommand(program: Command): void {
  program
    .command("context")
    .description("Get current development context")
    .option("-j, --json", "Output in JSON format")
    .action(async (options: { json?: boolean }) => {
      const ctx = getOutputContext(program);
      // Support both --json (global) and --json (local) for JSON output
      const wantJson = ctx.json || options.json;

      try {
        // Check if we're in a Viben workspace
        const workspaceRoot = findVibenRoot();
        if (!workspaceRoot) {
          output(
            ctx,
            errorResponse("NOT_IN_WORKSPACE", "Not in a Viben workspace"),
            () => {
              console.log(chalk.red("Error: Not in a Viben workspace."));
              console.log();
              console.log("Initialize a workspace with:");
              console.log(chalk.cyan("  viben team init --user <name>"));
            }
          );
          process.exit(1);
        }

        if (wantJson) {
          const data = getContextJson(workspaceRoot);
          output(ctx, successResponse(data), () => {
            // In global JSON mode (--json before command), output() handles it
            // For local --json (after command), print formatted JSON
            if (!ctx.json) {
              console.log(JSON.stringify(data, null, 2));
            }
          });
        } else {
          // Text mode: output directly
          const textOutput = getContextText(workspaceRoot);
          console.log(textOutput);
        }
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });
}
