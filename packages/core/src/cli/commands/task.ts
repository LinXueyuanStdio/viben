/**
 * viben task - Task management commands
 *
 * Provides commands for managing development tasks, including creation, context management,
 * status tracking, and PR workflow.
 *
 * Subcommands:
 * - CRUD: list, create, view, edit, delete
 * - Status: start, finish, archive, list-archive
 * - Config: set-branch, set-base, set-agent
 * - Context: init-context, add-context, remove-context, list-context, validate-context
 * - Planning: plan, status, create-pr
 */
import chalk from "chalk";
import { spawn, execSync, type SpawnOptions } from "node:child_process";
import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  openSync,
} from "node:fs";
import { join, relative, basename } from "node:path";
import type { Command } from "commander";
import type { OutputContext } from "../types";
import {
  output,
  successResponse,
  errorResponse,
  outputKeyValue,
  handleCommandError,
  outputSuccess,
  outputWarning,
} from "../lib";
import { CliError } from "../types";
import {
  findVibenRoot,
  getDeveloper,
  getTasksDir,
  readTaskJson as readTaskJsonFromWorkspace,
  writeTaskJson,
  updateTaskField,
  getDatePrefix,
  getTodayDate,
  resolveTaskDirectory,
  runGitCommand,
  DIR_VIBEN,
  DIR_WORKSPACE,
  DIR_TASKS,
  FILE_TASK_JSON,
  // Phase management
  getPhaseForAction,
  // Agent registry
  registryAddAgent,
  // CLI adapter
  createCLIAdapter,
  // Check phase validation
  validateIfReviewFinished,
} from "../lib/viben-workspace";

import type { UnifiedTask } from "../../task/service";

// Import swarm functions for agent management
import {
  type StartResult,
  type Platform,
  type CleanupResult,
  startAgent,
  getSessionId,
  listWorktrees,
  cleanupWorktree,
  cleanupMerged,
  cleanupAll,
  readRegistry,
  isProcessRunning,
} from "../lib/swarm";

import { detectPlatform } from "../lib/swarm/cli-adapter";

// Import phase functions
import { startTask } from "../../task/phase/start";
import { runWorkPhase } from "../../task/phase/work";
import { runCreateWorktree } from "../../task/phase/worktree";
import { runMergePRPhase } from "../../task/phase/merge-pr";

// Import task operations from lib/task
import {
  // Types
  type TaskJson,
  type ContextEntry,
  // Display
  formatStatus,
  formatPriority,
  // Session
  getLatestJournalInfo,
  getSessionNumberFromIndex,
  generateSessionMarkdown,
  createNewJournalFile,
  updateIndexWithNewSession,
  // Status
  cmdStatusSummary,
  cmdStatusList,
  cmdStatusDetail,
  cmdStatusWatch,
  cmdStatusLog,
  cmdStatusRegistry,
  // Context output
  getContextJson,
  getContextText,
  // Lifecycle operations
  enqueueTask,
  dequeueTask,
  pauseTask,
  resumeTask,
  approveTask,
  rejectTask,
  retryTask,
  cancelTask,
  // Context file operations
  initContext,
  addContext,
  removeContext,
  listContext,
  validateContext,
  // CRUD operations
  listTasks,
  createTask,
  viewTask,
  deleteTask,
  finishTask,
  archiveTask as archiveTaskOp,
  listArchivedTasks,
  // Config operations
  setTaskBranch,
  setTaskBaseBranch,
  setTaskAgent,
  // Review operations
  reviewTask,
  // Edit operations
  editTask,
  // PR operations
  createPR,
  // Stuck detection
  checkStuck,
} from "../../task/ops";

// Import phase operations
import {
  runPlanPhase,
  runImplementPhase,
  runCheckPhase,
} from "../../task/phase";

// =============================================================================
// Cleanup Command Implementations (moved from swarm.ts)
// =============================================================================

/**
 * List all worktrees and registered agents
 */
async function listWorktreesCommand(
  ctx: OutputContext,
  repoRoot: string
): Promise<void> {
  const worktrees = listWorktrees(repoRoot);
  const registry = readRegistry(repoRoot);

  if (ctx.json) {
    output(ctx, successResponse({ worktrees, agents: registry.agents }));
    return;
  }

  // Human-readable output
  console.log(chalk.blue("=== Git Worktrees ==="));
  console.log();

  if (worktrees.length === 0) {
    console.log("  (no worktrees)");
  } else {
    console.log("PATH".padEnd(50) + "COMMIT".padEnd(10) + "BRANCH");
    for (const wt of worktrees) {
      console.log(
        wt.path.padEnd(50) +
        wt.commit.substring(0, 7).padEnd(10) +
        `[${wt.branch || "(detached)"}]`
      );
    }
  }
  console.log();

  console.log(chalk.blue("=== Registered Agents ==="));
  console.log();

  if (registry.agents.length === 0) {
    console.log("  (no agents registered)");
  } else {
    for (const agent of registry.agents) {
      const statusIcon = isProcessRunning(agent.pid)
        ? chalk.green("●")
        : chalk.red("○");
      console.log(`  ${statusIcon} ${agent.id} (PID: ${agent.pid})`);
      console.log(chalk.dim(`    Worktree: ${agent.worktree_path}`));
      console.log(chalk.dim(`    Started:  ${agent.started_at}`));
      console.log();
    }
  }
}

/**
 * Cleanup worktrees
 */
async function cleanupWorktreesCommand(
  ctx: OutputContext,
  repoRoot: string,
  branch: string | undefined,
  options: {
    keepBranch?: boolean;
    yes?: boolean;
    merged?: boolean;
    all?: boolean;
    list?: boolean;
  }
): Promise<void> {
  // Handle list option
  if (options.list) {
    await listWorktreesCommand(ctx, repoRoot);
    return;
  }

  // Handle merged option
  if (options.merged) {
    if (!ctx.quiet) {
      console.log(chalk.blue("=== Cleaning Merged Worktrees ==="));
      console.log();
    }

    const results = await cleanupMerged(repoRoot, {
      keepBranch: options.keepBranch,
      skipConfirm: options.yes,
    });

    if (ctx.json) {
      output(ctx, successResponse({ results }));
      return;
    }

    if (results.length === 0) {
      console.log("No merged worktrees found");
    } else {
      for (const result of results) {
        if (result.success) {
          console.log(chalk.green(`Cleaned: ${result.branch}`));
        } else {
          console.log(chalk.red(`Failed: ${result.branch} - ${result.error}`));
        }
      }
    }
    return;
  }

  // Handle all option
  if (options.all) {
    if (!ctx.quiet) {
      console.log(chalk.blue("=== Cleaning All Worktrees ==="));
      console.log(chalk.red("WARNING: This will remove ALL worktrees!"));
      console.log();
    }

    const results = await cleanupAll(repoRoot, {
      keepBranch: options.keepBranch,
      skipConfirm: options.yes,
    });

    if (ctx.json) {
      output(ctx, successResponse({ results }));
      return;
    }

    if (results.length === 0) {
      console.log("No worktrees to remove");
    } else {
      for (const result of results) {
        if (result.success) {
          console.log(chalk.green(`Cleaned: ${result.branch}`));
        } else {
          console.log(chalk.red(`Failed: ${result.branch} - ${result.error}`));
        }
      }
    }
    return;
  }

  // Handle specific branch
  if (!branch) {
    output(ctx, errorResponse("MISSING_ARG", "Branch name or --merged/--all required"), () => {
      console.error(chalk.red("Error: Branch name or --merged/--all required"));
      console.log();
      console.log("Usage:");
      console.log(chalk.gray("  viben task cleanup <branch>     Remove specific worktree"));
      console.log(chalk.gray("  viben task cleanup --merged     Remove merged worktrees"));
      console.log(chalk.gray("  viben task cleanup --all        Remove all worktrees"));
      console.log(chalk.gray("  viben task cleanup --list       List all worktrees"));
    });
    process.exit(1);
    return;
  }

  if (!ctx.quiet) {
    console.log(chalk.blue(`=== Cleaning Worktree: ${branch} ===`));
    console.log();
  }

  const result: CleanupResult = await cleanupWorktree(repoRoot, branch, {
    keepBranch: options.keepBranch,
    skipConfirm: options.yes,
  });

  if (ctx.json) {
    if (result.success) {
      output(ctx, successResponse(result));
    } else {
      output(ctx, errorResponse("CLEANUP_FAILED", result.error || "Unknown error"));
    }
    return;
  }

  if (result.success) {
    console.log(chalk.green(`Cleanup complete for: ${branch}`));
    if (result.archived) {
      console.log(`  Archived: ${result.archived}`);
    }
    if (result.worktreeRemoved) {
      console.log("  Worktree removed");
    }
    if (result.branchDeleted) {
      console.log("  Branch deleted");
    }
  } else {
    console.error(chalk.red(`Error: ${result.error}`));
    process.exit(1);
  }
}

// =============================================================================
// Constants
// =============================================================================

/** Mapping from CLI executor IDs to platform names */
const EXECUTOR_TO_PLATFORM: Record<string, Platform> = {
  CLAUDE_CODE: "claude",
  CURSOR: "cursor",
  GEMINI: "gemini",
  OPENCODE: "opencode",
  IFLOW: "iflow",
  CODEX: "codex",
  KILO: "kilo",
  KIRO: "kiro",
  ANTIGRAVITY: "antigravity",
};

// =============================================================================
// Helpers
// =============================================================================

/**
 * Get output context from program options
 */
function getContext(program: Command): OutputContext {
  const opts = program.opts();
  return {
    json: opts.json || false,
    verbose: opts.verbose || false,
    quiet: opts.quiet || false,
  };
}

/**
 * Check if the .viben directory exists in the workspace and return the repo root
 */
function ensureVibenDirWithRoot(cwd: string): string {
  const repoRoot = findVibenRoot(cwd);
  if (!repoRoot) {
    throw CliError.operationFailed(
      "Task command",
      `Not a Viben workspace (.viben not found). Run "viben team init" first.`
    );
  }
  return repoRoot;
}

/**
 * Ensure tasks directory exists
 */
function ensureTasksDir(repoRoot: string): string {
  const tasksDir = getTasksDir(repoRoot);
  const archiveDir = join(tasksDir, "archive");

  if (!existsSync(tasksDir)) {
    mkdirSync(tasksDir, { recursive: true });
  }

  if (!existsSync(archiveDir)) {
    mkdirSync(archiveDir, { recursive: true });
  }

  return tasksDir;
}

// =============================================================================
// Command Registration
// =============================================================================

/**
 * Register the task command
 */
export function registerTaskCommand(program: Command): void {
  const taskCmd = program
    .command("task")
    .description("Manage development tasks");

  // ============================================================================
  // CRUD Commands
  // ============================================================================

  // task list
  taskCmd
    .command("list")
    .description("List all tasks, or view task details if task is specified")
    .argument("[task]", "Task name or directory (if specified, shows task details)")
    .option("-m, --mine", "Show only tasks assigned to current developer")
    .option("-s, --status <status>", "Filter by status (backlog, queue, in_progress, review, completed)")
    .option("--json", "Output in JSON format")
    .action(async (task: string | undefined, options: { mine?: boolean; status?: string; json?: boolean }) => {
      const ctx = getContext(program);
      if (options.json) {
        ctx.json = true;
      }

      const cwd = process.cwd();

      try {
        const repoRoot = ensureVibenDirWithRoot(cwd);

        // If task is specified, show task details (equivalent to `viben task view <task>`)
        if (task) {
          const result = viewTask(repoRoot, task);

          if (!result.success) {
            throw CliError.notFound("Task", task);
          }

          const taskJson = result.task!;
          const files = result.files!;

          output(ctx, successResponse({
            task: taskJson,
            taskDir: result.taskDir,
            dirName: result.dirName,
            files,
            runtime: result.runtime,
          }), () => {
            // Compact view for task list <task>
            console.log(chalk.bold.cyan(`=== ${taskJson.title} ===`));
            console.log();

            outputKeyValue(ctx, {
              Status: formatStatus(taskJson.status),
              Priority: formatPriority(taskJson.priority),
              Assignee: taskJson.assignee || "-",
              Branch: taskJson.branch || "-",
              Phase: `${taskJson.current_phase || 0}`,
              "PR URL": taskJson.pr_url || chalk.gray("(none)"),
            });

            // Show file status in compact form
            const hasFiles = files.prd.exists || files.implementJsonl.exists;
            if (hasFiles) {
              console.log();
              const fileStatus: string[] = [];
              if (files.prd.exists) fileStatus.push("prd.md");
              if (files.implementJsonl.exists) fileStatus.push("implement.jsonl");
              if (files.checkJsonl.exists) fileStatus.push("check.jsonl");
              console.log(chalk.gray(`Files: ${fileStatus.join(", ")}`));
            }

            if (taskJson.description) {
              console.log();
              console.log(chalk.gray(taskJson.description));
            }

            console.log();
            console.log(chalk.dim(`Use 'viben task view ${result.dirName}' for full details`));
          });
          return;
        }

        // List all tasks
        const result = listTasks(repoRoot, { mine: options.mine, status: options.status });

        if (!result.success) {
          throw CliError.operationFailed("List tasks", result.error!);
        }

        const { tasks } = result;

        output(ctx, successResponse({ tasks }), () => {
          if (options.mine) {
            const developer = getDeveloper(repoRoot);
            console.log(chalk.blue(`My tasks (assignee: ${developer}):`));
          } else {
            console.log(chalk.blue("All active tasks:"));
          }
          console.log();

          if (tasks.length === 0) {
            if (options.mine) {
              console.log("  (no tasks assigned to you)");
            } else {
              console.log("  (no active tasks)");
            }
          } else {
            for (const t of tasks) {
              if (options.mine) {
                console.log(`  - ${t.dir}/ (${formatStatus(t.status)})`);
              } else {
                console.log(
                  `  - ${t.dir}/ (${formatStatus(t.status)}) [${chalk.cyan(t.assignee)}]`
                );
              }
            }
          }

          console.log();
          console.log(`Total: ${tasks.length} task(s)`);
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // task create
  taskCmd
    .command("create")
    .description("Create a new task")
    .argument("<title>", "Task title (used as commit/PR title)")
    .option("-s, --slug <name>", "Task identifier (auto-generated from title if not provided)")
    .option("-b, --branch <branch>", "Custom branch name (default: feature/<slug>)")
    .option("-a, --assignee <dev>", "Assignee developer name")
    .option("-p, --priority <priority>", "Priority (urgent, high, medium, low, none)", "medium")
    .option("-d, --description <text>", "Task description")
    .option("--agent <agent-id>", "Associated agent configuration")
    .option("--executor <type>", "Executor type (CLAUDE_CODE, CURSOR, etc.)")
    .option("--model <model>", "Model to use for execution")
    .option("--start", "Auto-enqueue task for execution (status: queue)")
    .option("--worktree", "Run agent in a git worktree (isolated branch)")
    .action(async (title: string, options: {
      slug?: string;
      branch?: string;
      assignee?: string;
      priority?: string;
      description?: string;
      agent?: string;
      executor?: string;
      model?: string;
      start?: boolean;
      worktree?: boolean;
    }) => {
      const ctx = getContext(program);
      const cwd = process.cwd();

      try {
        const repoRoot = ensureVibenDirWithRoot(cwd);
        const result = createTask(repoRoot, title, options);

        if (!result.success) {
          throw CliError.operationFailed("Create task", result.error!);
        }

        const { dirName, status, contextInitialized } = result;
        const relativePath = `${DIR_VIBEN}/${DIR_TASKS}/${dirName}`;

        // If --start is provided, enqueue the task to queue system
        if (options.start && dirName) {
          // Task was created with status "backlog", now enqueue to queue system
          const enqueueResult = enqueueTask(repoRoot, dirName, {
            agent: options.agent,
            executor: options.executor,
            model: options.model,
            priority: options.priority,
            skipQueue: false, // Actually submit to queue
          });

          if (!enqueueResult.success) {
            // Task created but enqueue failed
            output(ctx, errorResponse("ENQUEUE_FAILED", enqueueResult.error || "Failed to enqueue task"), () => {
              console.log(chalk.yellow(`Created task: ${dirName}`));
              console.log(chalk.red(`Failed to enqueue: ${enqueueResult.error}`));
              console.log(chalk.gray(`Run manually: viben task enqueue ${dirName}`));
            });
            return;
          }

          const queueId = enqueueResult.additionalData?.queue_id;
          output(ctx, successResponse({ taskDir: relativePath, status: "queue", contextInitialized, queueId }), () => {
            console.log(chalk.green(`Created and enqueued: ${dirName}`));
            console.log(chalk.gray(`Status: backlog -> queue`));
            if (queueId) {
              console.log(chalk.gray(`Queue ID: ${queueId}`));
            }
            if (options.worktree) {
              console.log(chalk.gray(`Worktree: enabled`));
            }
            if (contextInitialized) {
              console.log(chalk.gray(`Context: initialized (empty)`));
            }
          });
        } else {
          // Show what was configured
          output(ctx, successResponse({ taskDir: relativePath, contextInitialized }), () => {
            console.log(chalk.green(`Created task: ${dirName}`));
            console.log();

            // Show auto-configured values
            if (options.branch) {
              console.log(chalk.blue("Configured:"));
              console.log(`  Branch:  ${options.branch}`);
              console.log();
            }

            // Show next steps
            console.log(chalk.blue("Next steps:"));
            console.log("  1. Create prd.md with requirements");
            console.log("  2. Use research agent to add context (add-context)");
            console.log(`  3. Run: viben task start ${dirName}`);
            console.log();
          });
        }
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // task view
  taskCmd
    .command("view")
    .description("View task details")
    .argument("<task>", "Task name or directory")
    .option("--json", "Output in JSON format")
    .action(async (task: string, options: { json?: boolean }) => {
      const ctx = getContext(program);
      if (options.json) {
        ctx.json = true;
      }
      const cwd = process.cwd();

      try {
        const repoRoot = ensureVibenDirWithRoot(cwd);
        const result = viewTask(repoRoot, task);

        if (!result.success) {
          throw CliError.notFound("Task", task);
        }

        const taskJson = result.task!;
        const files = result.files!;

        const worktree = result.worktree;

        // For JSON output, include all data
        output(ctx, successResponse({
          task: taskJson,
          taskDir: result.taskDir,
          dirName: result.dirName,
          files,
          worktree,
          runtime: result.runtime,
          timing: result.timing,
        }), () => {
          // Header
          console.log(chalk.bold.cyan(`=== Task: ${taskJson.title} ===`));
          console.log();

          // Basic Info Section
          console.log(chalk.bold("Basic Info"));
          outputKeyValue(ctx, {
            ID: taskJson.id || "-",
            Directory: result.dirName || "-",
            Status: formatStatus(taskJson.status),
            Priority: formatPriority(taskJson.priority),
          });
          console.log();

          // People Section
          console.log(chalk.bold("People"));
          outputKeyValue(ctx, {
            Creator: taskJson.creator || "-",
            Assignee: taskJson.assignee || "-",
          });
          console.log();

          // Git Section
          console.log(chalk.bold("Git"));
          outputKeyValue(ctx, {
            Branch: taskJson.branch || "-",
            "Base Branch": taskJson.base_branch || "-",
            "PR URL": taskJson.pr_url || chalk.gray("(none)"),
          });
          console.log();

          // Worktree Section
          console.log(chalk.bold("Worktree"));
          if (worktree?.enabled || worktree?.path) {
            const worktreeStatus = worktree.path
              ? (worktree.exists
                  ? (worktree.isDirty
                      ? chalk.yellow("active (dirty)")
                      : chalk.green("active (clean)"))
                  : chalk.red("missing"))
              : chalk.gray("(not created)");

            outputKeyValue(ctx, {
              Mode: worktree.enabled ? chalk.green("enabled") : chalk.gray("disabled"),
              Status: worktreeStatus,
            });

            if (worktree.path) {
              console.log(`  Path:   ${chalk.gray(worktree.path)}`);
            }
            if (worktree.branch) {
              console.log(`  Branch: ${chalk.cyan(worktree.branch)}`);
            }
            if (worktree.isDirty && worktree.uncommittedFiles) {
              console.log(`  Changes: ${chalk.yellow(`${worktree.uncommittedFiles} uncommitted file(s)`)}`);
            }
          } else {
            console.log(chalk.gray("  (not using worktree)"));
          }
          console.log();

          // Progress Section
          console.log(chalk.bold("Progress"));
          const phaseNames = ["backlog", "implement", "check", "finish", "create-pr"];
          const currentPhase = taskJson.current_phase || 0;
          outputKeyValue(ctx, {
            "Current Phase": `${currentPhase}/${phaseNames.length - 1} (${phaseNames[currentPhase] || "unknown"})`,
          });
          // Show next actions
          if (taskJson.next_action && taskJson.next_action.length > 0) {
            const actions = taskJson.next_action.map(a => `${a.phase}:${a.action}`).join(" → ");
            console.log(`  Next Actions: ${chalk.gray(actions)}`);
          }
          console.log();

          // Files Section
          console.log(chalk.bold("Files"));
          const formatFile = (info: typeof files.prd, name: string) => {
            if (!info.exists) {
              return chalk.gray("(missing)");
            }
            const size = info.size ? `${(info.size / 1024).toFixed(1)}KB` : "";
            return chalk.green("✓") + " " + chalk.gray(size);
          };
          console.log(`  prd.md:           ${formatFile(files.prd, "prd.md")}`);
          console.log(`  implement.jsonl:  ${formatFile(files.implementJsonl, "implement.jsonl")}`);
          console.log(`  check.jsonl:      ${formatFile(files.checkJsonl, "check.jsonl")}`);
          console.log(`  fix.jsonl:        ${formatFile(files.fixJsonl, "fix.jsonl")}`);
          console.log();

          // Logs Section
          console.log(chalk.bold("Logs"));
          const formatLog = (info: typeof files.prd) => {
            if (!info.exists) {
              return chalk.gray("-");
            }
            const size = info.size ? `${(info.size / 1024).toFixed(1)}KB` : "";
            const time = info.modifiedAt ? new Date(info.modifiedAt).toLocaleString() : "";
            return `${chalk.green("✓")} ${chalk.gray(size)} ${chalk.dim(time)}`;
          };
          if (files.startLog.exists) {
            console.log(`  start.log.jsonl:      ${formatLog(files.startLog)}`);
          }
          if (files.planLog.exists) {
            console.log(`  plan.log.jsonl:       ${formatLog(files.planLog)}`);
          }
          if (files.workLog.exists) {
            console.log(`  work.log.jsonl:       ${formatLog(files.workLog)}`);
          }
          if (files.implementLog.exists) {
            console.log(`  implement.log.jsonl:  ${formatLog(files.implementLog)}`);
          }
          if (files.reviewLog.exists) {
            console.log(`  review.log.jsonl:     ${formatLog(files.reviewLog)}`);
          }
          if (!files.startLog.exists && !files.planLog.exists && !files.workLog.exists &&
              !files.implementLog.exists && !files.reviewLog.exists) {
            console.log(chalk.gray("  (no logs yet)"));
          }
          console.log();

          // Timestamps Section
          console.log(chalk.bold("Timestamps"));
          const timestamps: Record<string, string> = {
            "Created At": taskJson.createdAt || "-",
          };
          if (taskJson.queuedAt) {
            timestamps["Queued At"] = taskJson.queuedAt;
          }
          if (taskJson.startedAt) {
            timestamps["Started At"] = taskJson.startedAt;
          }
          if (taskJson.checkPassedAt) {
            timestamps["Check Passed"] = taskJson.checkPassedAt;
          }
          if (taskJson.prCreatedAt) {
            timestamps["PR Created"] = taskJson.prCreatedAt;
          }
          if (taskJson.completedAt) {
            timestamps["Completed At"] = taskJson.completedAt;
          }
          outputKeyValue(ctx, timestamps);

          // Timing Section
          const timing = result.timing;
          if (timing) {
            console.log();
            console.log(chalk.bold("Timing"));

            // Build timing display
            const timingDisplay: Record<string, string> = {};

            // Total duration is most important
            if (timing.totalDurationStr) {
              timingDisplay["Total"] = timing.totalDurationStr;
            }

            // Execution duration (actual work time)
            if (timing.executionDurationStr) {
              timingDisplay["Execution"] = timing.executionDurationStr;
            }

            // Queue wait time
            if (timing.queueDurationStr) {
              timingDisplay["Queue Wait"] = timing.queueDurationStr;
            }

            // Phase breakdown
            if (timing.planDurationStr) {
              timingDisplay["Plan Phase"] = timing.planDurationStr;
            }
            if (timing.implementDurationStr) {
              timingDisplay["Implement Phase"] = timing.implementDurationStr;
            }
            if (timing.checkDurationStr) {
              timingDisplay["Check Phase"] = timing.checkDurationStr;
            }

            // Idle time (only for non-completed tasks)
            if (timing.idleDurationStr && taskJson.status !== "completed" && taskJson.status !== "archived") {
              timingDisplay["Idle"] = chalk.yellow(timing.idleDurationStr);
            }

            if (Object.keys(timingDisplay).length > 0) {
              outputKeyValue(ctx, timingDisplay);
            } else {
              console.log(chalk.gray("  (no timing data yet)"));
            }
          }

          // Session Info (if available)
          if (result.runtime?.sessionId) {
            console.log();
            console.log(chalk.bold("Session"));
            outputKeyValue(ctx, {
              "Session ID": result.runtime.sessionId,
            });
          }

          // Description (if exists)
          if (taskJson.description) {
            console.log();
            console.log(chalk.bold("Description"));
            console.log(chalk.gray(taskJson.description));
          }

          // Notes (if exists)
          if (taskJson.notes) {
            console.log();
            console.log(chalk.bold("Notes"));
            console.log(chalk.gray(taskJson.notes));
          }

          console.log();
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // task edit
  taskCmd
    .command("edit")
    .description("Edit task (opens editor)")
    .argument("<task>", "Task name or directory")
    .action(async (task: string) => {
      const ctx = getContext(program);
      const cwd = process.cwd();

      try {
        const repoRoot = ensureVibenDirWithRoot(cwd);

        const { result } = editTask(repoRoot, task, {
          onClose: (code) => {
            if (code === 0) {
              outputSuccess(ctx, `Edited task: ${task}`);
            }
          },
        });

        if (!result.success) {
          throw CliError.notFound("Task", task);
        }
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // task delete
  taskCmd
    .command("delete")
    .description("Delete a task")
    .argument("<task>", "Task name or directory")
    .option("-f, --force", "Skip confirmation")
    .action(async (task: string, options: { force?: boolean }) => {
      const ctx = getContext(program);
      const cwd = process.cwd();

      try {
        const repoRoot = ensureVibenDirWithRoot(cwd);

        // Check if task exists first (for warning message)
        const checkResult = viewTask(repoRoot, task);
        if (!checkResult.success) {
          throw CliError.notFound("Task", task);
        }

        if (!options.force && !ctx.quiet) {
          console.log(chalk.yellow(`Warning: This will permanently delete task "${task}".`));
          console.log(chalk.gray("Use --force to skip this warning"));
          return;
        }

        const result = deleteTask(repoRoot, task);

        if (!result.success) {
          throw CliError.operationFailed("Delete task", result.error!);
        }

        output(ctx, successResponse({ deleted: task }), () => {
          outputSuccess(ctx, `Deleted task: ${task}`);
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // ============================================================================
  // Status Commands
  // ============================================================================

  // task start - Start task execution
  taskCmd
    .command("start")
    .description("Start task execution (serial mode by default, use --worktree for parallel)")
    .argument("<task>", "Task name or directory")
    .option("--executor <type>", "Executor type (CLAUDE_CODE, CURSOR, etc.)")
    .option("--detach", "Run in background")
    .option("--worktree", "Run in isolated git worktree (parallel mode)")
    .option("--resume", "Resume an existing session")
    .option("--session <id>", "Session ID for resume")
    .action(async (task: string, options: {
      executor?: string;
      detach?: boolean;
      worktree?: boolean;
      resume?: boolean;
      session?: string;
    }) => {
      const ctx = getContext(program);
      const cwd = process.cwd();

      try {
        const repoRoot = ensureVibenDirWithRoot(cwd);

        // Resolve task directory
        const taskDir = resolveTaskDirectory(task, repoRoot);
        if (!taskDir || !existsSync(taskDir)) {
          output(ctx, errorResponse("TASK_NOT_FOUND", `Task not found: ${task}`), () => {
            console.error(chalk.red(`Error: Task not found: ${task}`));
            console.log(chalk.gray("Use 'viben task list' to see available tasks"));
          });
          process.exit(1);
          return;
        }

        // Convert to relative path
        let relativePath: string;
        try {
          relativePath = relative(repoRoot, taskDir);
        } catch {
          relativePath = taskDir;
        }

        // Read task.json to get sessionId and other config
        const taskJson = readTaskJsonFromWorkspace(taskDir) as UnifiedTask | null;

        // Handle resume mode
        if (options.resume) {
          // Read session ID from task.json or CLI option
          let sessionId = options.session;
          if (!sessionId && taskJson?.sessionId) {
            sessionId = taskJson.sessionId;
          }

          if (!sessionId) {
            output(ctx, errorResponse("NO_SESSION", "No session ID found for resume"), () => {
              console.error(chalk.red("Error: No session ID found for resume"));
              console.log(chalk.gray("No sessionId in task.json and no --session provided"));
            });
            process.exit(1);
            return;
          }

          // Build resume command using CLI adapter
          const platform = (taskJson?.executor || "claude") as Platform;
          const adapter = createCLIAdapter(platform);
          const resumeCmd = adapter.buildResumeCommand(sessionId);

          if (!ctx.quiet) {
            console.log(chalk.blue("=== Resuming Agent ==="));
            console.log(`  Session: ${sessionId}`);
            console.log(`  Task: ${relativePath}`);
            console.log(`  Command: ${resumeCmd.join(" ")}`);
            console.log();
          }

          // Execute resume command
          const child = spawn(resumeCmd[0], resumeCmd.slice(1), {
            cwd: taskDir,
            stdio: "inherit",
          });

          child.on("close", (code) => {
            process.exit(code ?? 0);
          });

          return;
        }

        // Determine platform
        const platform: Platform = options.executor
          ? EXECUTOR_TO_PLATFORM[options.executor.toUpperCase()] || "claude"
          : "claude";

        // Start task using startTask from phase/start
        if (!ctx.quiet) {
          console.log(chalk.blue("=== Task Start ==="));
          console.log(`[INFO] Task: ${relativePath}`);
          console.log(`[INFO] Platform: ${platform}`);
        }

        const result = await startTask(repoRoot, relativePath, {
          platform,
          detach: options.detach ?? true,
          skipPermissions: true,
          verbose: ctx.verbose,
        });

        if (ctx.json) {
          if (result.success) {
            output(ctx, successResponse(result));
          } else {
            output(ctx, errorResponse("START_FAILED", result.error || "Unknown error"));
          }
        } else {
          if (result.success) {
            console.log();
            console.log(chalk.green(`=== Task Started ===`));
            console.log();
            console.log(`  ID:        ${result.agentId}`);
            console.log(`  PID:       ${result.pid}`);
            console.log(`  Session:   ${result.sessionId || "N/A"}`);
            console.log(`  Working:   ${result.workingDir}`);
            console.log(`  Log:       ${result.logFile}`);
            console.log();
            console.log(chalk.yellow(`To monitor: tail -f ${result.logFile}`));
            console.log(chalk.yellow(`To stop:    kill ${result.pid}`));
            if (result.sessionId) {
              const adapter = createCLIAdapter(platform);
              const resumeCmd = adapter.getResumeCommandStr(result.sessionId, result.workingDir);
              console.log(chalk.yellow(`To resume:  ${resumeCmd}`));
            }
          } else {
            console.error(chalk.red(`Error: ${result.error}`));
            process.exit(1);
          }
        }
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // task finish
  taskCmd
    .command("finish")
    .description("Finish a task (clears current task if it matches)")
    .argument("<task>", "Task name or directory to finish")
    .action(async (task: string) => {
      const ctx = getContext(program);
      const cwd = process.cwd();

      try {
        const repoRoot = ensureVibenDirWithRoot(cwd);
        const result = finishTask(repoRoot, task);

        if (!result.success) {
          throw CliError.operationFailed("Finish task", result.error!);
        }

        output(ctx, successResponse({ finished: result.cleared }), () => {
          console.log(chalk.green(`Finished task: ${result.cleared}`));
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // task archive
  taskCmd
    .command("archive")
    .description("Archive completed task")
    .argument("<task>", "Task name")
    .action(async (task: string) => {
      const ctx = getContext(program);
      const cwd = process.cwd();

      try {
        const repoRoot = ensureVibenDirWithRoot(cwd);
        const result = archiveTaskOp(repoRoot, task);

        if (!result.success) {
          throw CliError.operationFailed("Archive task", result.error!);
        }

        output(ctx, successResponse({ archived: result.archived, to: result.destination }), () => {
          console.log(chalk.green(`Archived: ${result.archived} -> ${result.destination}`));
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // task list-archive
  taskCmd
    .command("list-archive")
    .description("List archived tasks")
    .argument("[month]", "Filter by month (YYYY-MM)")
    .action(async (month?: string) => {
      const ctx = getContext(program);
      const cwd = process.cwd();

      try {
        const repoRoot = ensureVibenDirWithRoot(cwd);
        const result = listArchivedTasks(repoRoot, month);
        const { archived } = result;

        output(ctx, successResponse({ archived: Object.fromEntries(archived) }), () => {
          console.log(chalk.blue("Archived tasks:"));
          console.log();

          if (archived.size === 0) {
            if (month) {
              console.log(`  No archives for ${month}`);
            } else {
              console.log("  (no archived tasks)");
            }
          } else {
            for (const [monthName, tasks] of Array.from(archived.entries())) {
              if (month) {
                console.log(`[${monthName}]`);
                for (const t of tasks) {
                  console.log(`  - ${t}/`);
                }
              } else {
                console.log(`[${monthName}] - ${tasks.length} task(s)`);
              }
            }
          }
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // ============================================================================
  // Task Status Lifecycle Commands
  // ============================================================================

  // task enqueue - backlog -> queue
  taskCmd
    .command("enqueue")
    .description("Move task from backlog to queue for execution")
    .argument("<task>", "Task name or directory")
    .option("--agent <id>", "Agent ID to execute this task")
    .option("--executor <type>", "Executor type (CLAUDE_CODE, CURSOR, OPENCODE, etc.)")
    .option("--model <id>", "Model ID for execution")
    .option("--priority <p>", "Priority (urgent/high/medium/low/none)")
    .action(async (task: string, options: {
      agent?: string;
      executor?: string;
      model?: string;
      priority?: string;
    }) => {
      const ctx = getContext(program);
      const cwd = process.cwd();

      try {
        const repoRoot = ensureVibenDirWithRoot(cwd);
        const result = enqueueTask(repoRoot, task, options);

        if (!result.success) {
          throw CliError.operationFailed("Enqueue task", result.error!);
        }

        output(ctx, successResponse({ task: result.task, status: result.status }), () => {
          console.log(chalk.green(`Enqueued: ${result.task}`));
          console.log(chalk.gray(`Status: ${result.fromStatus} -> ${result.status}`));
          if (options.agent) console.log(chalk.gray(`Agent: ${options.agent}`));
          if (options.executor) console.log(chalk.gray(`Executor: ${options.executor}`));
          if (options.model) console.log(chalk.gray(`Model: ${options.model}`));
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // task dequeue - queue -> backlog
  taskCmd
    .command("dequeue")
    .description("Remove task from queue back to backlog")
    .argument("<task>", "Task name or directory")
    .action(async (task: string) => {
      const ctx = getContext(program);
      const cwd = process.cwd();

      try {
        const repoRoot = ensureVibenDirWithRoot(cwd);
        const result = dequeueTask(repoRoot, task);

        if (!result.success) {
          throw CliError.operationFailed("Dequeue task", result.error!);
        }

        output(ctx, successResponse({ task: result.task, status: result.status }), () => {
          console.log(chalk.green(`Dequeued: ${result.task}`));
          console.log(chalk.gray(`Status: ${result.fromStatus} -> ${result.status}`));
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // task pause - in_progress/queue -> paused
  taskCmd
    .command("pause")
    .description("Pause execution of a task")
    .argument("<task>", "Task name or directory")
    .action(async (task: string) => {
      const ctx = getContext(program);
      const cwd = process.cwd();

      try {
        const repoRoot = ensureVibenDirWithRoot(cwd);
        const result = pauseTask(repoRoot, task);

        if (!result.success) {
          throw CliError.operationFailed("Pause task", result.error!);
        }

        output(ctx, successResponse({ task: result.task, status: result.status, fromState: result.fromStatus }), () => {
          console.log(chalk.green(`Paused: ${result.task}`));
          console.log(chalk.gray(`Status: ${result.fromStatus} -> paused`));
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // task resume - paused -> in_progress/queue (restore)
  taskCmd
    .command("resume")
    .description("Resume a paused task")
    .argument("<task>", "Task name or directory")
    .action(async (task: string) => {
      const ctx = getContext(program);
      const cwd = process.cwd();

      try {
        const repoRoot = ensureVibenDirWithRoot(cwd);
        const result = resumeTask(repoRoot, task);

        if (!result.success) {
          throw CliError.operationFailed("Resume task", result.error!);
        }

        output(ctx, successResponse({ task: result.task, status: result.status }), () => {
          console.log(chalk.green(`Resumed: ${result.task}`));
          console.log(chalk.gray(`Status: paused -> ${result.status}`));
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // ============================================================================
  // Configuration Commands
  // ============================================================================

  // task set-branch
  taskCmd
    .command("set-branch")
    .description("Set Git branch for task")
    .argument("<task>", "Task name or directory")
    .requiredOption("-b, --branch <name>", "Branch name")
    .action(async (task: string, options: { branch: string }) => {
      const ctx = getContext(program);
      const cwd = process.cwd();

      try {
        const repoRoot = ensureVibenDirWithRoot(cwd);
        const result = setTaskBranch(repoRoot, task, options.branch);

        if (!result.success) {
          throw CliError.operationFailed("Set branch", result.error!);
        }

        output(ctx, successResponse({ task, branch: options.branch }), () => {
          console.log(chalk.green(`Branch set to: ${options.branch}`));
          console.log();
          console.log(chalk.blue("Now you can start the multi-agent pipeline:"));
          console.log(`  viben task plan --name ${task} ...`);
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // task set-base
  taskCmd
    .command("set-base")
    .description("Set PR target branch")
    .argument("<task>", "Task name or directory")
    .requiredOption("-b, --branch <name>", "Base branch name")
    .action(async (task: string, options: { branch: string }) => {
      const ctx = getContext(program);
      const cwd = process.cwd();

      try {
        const repoRoot = ensureVibenDirWithRoot(cwd);
        const result = setTaskBaseBranch(repoRoot, task, options.branch);

        if (!result.success) {
          throw CliError.operationFailed("Set base branch", result.error!);
        }

        output(ctx, successResponse({ task, base_branch: options.branch }), () => {
          console.log(chalk.green(`Base branch set to: ${options.branch}`));
          console.log(`  PR will target: ${options.branch}`);
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // task set-agent
  taskCmd
    .command("set-agent")
    .description("Set associated agent configuration")
    .argument("<task>", "Task name or directory")
    .requiredOption("-a, --agent <id>", "Agent ID")
    .action(async (task: string, options: { agent: string }) => {
      const ctx = getContext(program);
      const cwd = process.cwd();

      try {
        const repoRoot = ensureVibenDirWithRoot(cwd);
        const result = setTaskAgent(repoRoot, task, options.agent);

        if (!result.success) {
          throw CliError.operationFailed("Set agent", result.error!);
        }

        output(ctx, successResponse({ task, agent: options.agent }), () => {
          outputSuccess(ctx, `Set agent "${options.agent}" for task "${task}"`);
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // ============================================================================
  // Context Management Commands
  // ============================================================================

  // task init-context
  taskCmd
    .command("init-context")
    .description("Initialize empty context files for task (to be populated by research)")
    .argument("<task>", "Task name or directory")
    .action(async (task: string) => {
      const ctx = getContext(program);
      const cwd = process.cwd();

      try {
        const repoRoot = ensureVibenDirWithRoot(cwd);
        const result = initContext(repoRoot, task);

        if (!result.success) {
          throw CliError.operationFailed("Initialize context", result.error!);
        }

        output(ctx, successResponse({
          taskDir: result.taskDir,
          files: result.files,
        }), () => {
          console.log(chalk.green(`Initialized context files for: ${task}`));
          console.log();
          console.log("Created:");
          console.log("  - implement.jsonl (empty)");
          console.log("  - check.jsonl (empty)");
          console.log("  - fix.jsonl (empty)");
          console.log();
          console.log(chalk.blue("Next steps:"));
          console.log("  1. Use research agent or add-context to populate specs");
          console.log("  2. Run: viben task start <task>");
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // task add-context
  taskCmd
    .command("add-context")
    .description("Add context files to task")
    .argument("<task>", "Task name or directory")
    .argument("<files...>", "Files to add")
    .option("-r, --reason <text>", "Reason for adding")
    .option("--recursive", "Recursively add directory contents")
    .action(async (task: string, files: string[], options: { reason?: string; recursive?: boolean }) => {
      const ctx = getContext(program);
      const cwd = process.cwd();

      try {
        const repoRoot = ensureVibenDirWithRoot(cwd);
        const result = addContext(repoRoot, task, files, options);

        if (!result.success) {
          throw CliError.operationFailed("Add context", result.error!);
        }

        output(ctx, successResponse({ added: result.added, skipped: result.skipped, total: result.total }), () => {
          if (result.skipped > 0) {
            console.log(chalk.yellow(`Skipped ${result.skipped} existing file(s)`));
          }
          console.log(chalk.blue(`Added ${result.added}/${result.total} file(s) to implement.jsonl`));
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // task remove-context
  taskCmd
    .command("remove-context")
    .description("Remove context files from task")
    .argument("<task>", "Task name or directory")
    .argument("<files...>", "Files to remove")
    .action(async (task: string, files: string[]) => {
      const ctx = getContext(program);
      const cwd = process.cwd();

      try {
        const repoRoot = ensureVibenDirWithRoot(cwd);
        const result = removeContext(repoRoot, task, files);

        if (!result.success) {
          throw CliError.operationFailed("Remove context", result.error!);
        }

        output(ctx, successResponse({ removed: result.removed }), () => {
          outputSuccess(ctx, `Removed ${result.removed.length} context file(s) from task "${task}"`);
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // task list-context
  taskCmd
    .command("list-context")
    .description("List context entries for task")
    .argument("<task>", "Task name or directory")
    .action(async (task: string) => {
      const ctx = getContext(program);
      const cwd = process.cwd();

      try {
        const repoRoot = ensureVibenDirWithRoot(cwd);
        const result = listContext(repoRoot, task);

        if (!result.success) {
          throw CliError.operationFailed("List context", result.error!);
        }

        output(ctx, successResponse(result.context), () => {
          console.log(chalk.blue(`Context entries for task: ${task}`));
          console.log();

          for (const [fileName, entries] of Object.entries(result.context)) {
            console.log(chalk.cyan(`[${fileName}]`));
            if (entries.length === 0) {
              console.log("  (empty)");
            } else {
              for (const entry of entries) {
                const typeTag = entry.type ? chalk.gray(` [${entry.type}]`) : "";
                console.log(`  - ${entry.file}${typeTag}`);
                if (entry.reason) {
                  console.log(chalk.gray(`    Reason: ${entry.reason}`));
                }
              }
            }
            console.log();
          }
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // task validate-context
  taskCmd
    .command("validate-context")
    .description("Validate context files (check referenced files exist)")
    .argument("<task>", "Task name or directory")
    .action(async (task: string) => {
      const ctx = getContext(program);
      const cwd = process.cwd();

      try {
        const repoRoot = ensureVibenDirWithRoot(cwd);
        const result = validateContext(repoRoot, task);

        if (result.error) {
          throw CliError.operationFailed("Validate context", result.error);
        }

        output(ctx, successResponse({ valid: result.valid.length, missing: result.missing }), () => {
          console.log(chalk.blue(`Validating context files for task: ${task}`));
          console.log();

          if (result.success) {
            console.log(chalk.green(`All ${result.valid.length} referenced files exist.`));
          } else {
            console.log(chalk.yellow(`Found ${result.missing.length} missing file(s):`));
            for (const file of result.missing) {
              console.log(chalk.red(`  - ${file}`));
            }
            console.log();
            console.log(chalk.gray(`Valid: ${result.valid.length}, Missing: ${result.missing.length}`));
          }
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // ============================================================================
  // Planning & Monitoring Commands
  // ============================================================================

  // task status (with subcommand behavior)
  taskCmd
    .command("status")
    .description("Show task status")
    .argument("[task]", "Specific task to show (shows all if not specified)")
    .option("-a, --assignee <dev>", "Filter by assignee")
    .option("-s, --status <status>", "Filter by status (backlog, queue, in_progress, review, completed)")
    .option("--running", "Show only tasks with running agents")
    .option("--json", "Output in JSON format")
    .option("--list", "List all worktrees and agents")
    .option("--detail", "Show detailed status (for specific task)")
    .option("--watch", "Watch agent log in real-time (for specific task)")
    .option("--log", "Show recent log entries (for specific task)")
    .option("--registry", "Show agent registry")
    .action(async (task: string | undefined, options: {
      assignee?: string;
      status?: string;
      running?: boolean;
      json?: boolean;
      list?: boolean;
      detail?: boolean;
      watch?: boolean;
      log?: boolean;
      registry?: boolean;
    }) => {
      const ctx = getContext(program);
      if (options.json) {
        ctx.json = true;
      }

      const cwd = process.cwd();

      try {
        const repoRoot = ensureVibenDirWithRoot(cwd);

        // Registry command
        if (options.registry) {
          cmdStatusRegistry(repoRoot, ctx);
          return;
        }

        // List command (worktrees and agents)
        if (options.list) {
          cmdStatusList(repoRoot, ctx);
          return;
        }

        // Specific task commands
        if (task) {
          if (options.detail) {
            cmdStatusDetail(task, repoRoot, ctx);
          } else if (options.watch) {
            cmdStatusWatch(task, repoRoot, ctx);
          } else if (options.log) {
            cmdStatusLog(task, repoRoot, ctx);
          } else {
            // Default: show detail for specific task
            cmdStatusDetail(task, repoRoot, ctx);
          }
          return;
        }

        // Summary view (default)
        cmdStatusSummary(repoRoot, {
          filterAssignee: options.assignee,
          filterStatus: options.status,
          onlyRunning: options.running,
        }, ctx);

      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // task create-pr
  taskCmd
    .command("create-pr")
    .description("Create PR from task")
    .argument("<task>", "Task name or directory")
    .option("--dry-run", "Show what would be done without making changes")
    .action(async (task: string, options: { dryRun?: boolean }) => {
      const ctx = getContext(program);
      const cwd = process.cwd();

      try {
        const repoRoot = ensureVibenDirWithRoot(cwd);
        const dryRun = options.dryRun || false;

        console.log(chalk.blue("=== Create PR ==="));
        if (dryRun) {
          console.log(chalk.yellow("[DRY-RUN MODE] No actual changes will be made"));
        }
        console.log();

        const result = createPR(repoRoot, task, { dryRun });

        if (!result.success) {
          throw CliError.operationFailed("Create PR", result.error || "Unknown error");
        }

        // Display task info
        console.log(`Task: ${result.taskName}`);
        console.log(`Base branch: ${result.baseBranch}`);
        console.log(`Current branch: ${result.currentBranch}`);
        console.log();

        if (dryRun && result.dryRunInfo) {
          // Show dry run info
          if (result.hadStagedChanges) {
            console.log(`[DRY-RUN] Would commit with message: ${result.commitMessage}`);
            console.log("[DRY-RUN] Staged files:");
            for (const file of result.dryRunInfo.stagedFiles) {
              console.log(`  - ${file}`);
            }
          } else if (result.unpushedCommits) {
            console.log(`Found ${result.unpushedCommits} unpushed commit(s)`);
          }

          console.log(`[DRY-RUN] Would push to: origin/${result.currentBranch}`);
          console.log("[DRY-RUN] Would create PR:");
          console.log(`  Title: ${result.dryRunInfo.prTitle}`);
          console.log(`  Base:  ${result.dryRunInfo.prBase}`);
          console.log(`  Head:  ${result.dryRunInfo.prHead}`);
          console.log("[DRY-RUN] Would update task.json:");
          console.log("  status: review");
          console.log(`  pr_url: ${result.prUrl}`);
        } else {
          // Show actual results
          if (result.hadStagedChanges) {
            console.log(chalk.green(`Committed: ${result.commitMessage}`));
          } else if (result.unpushedCommits) {
            console.log(`Found ${result.unpushedCommits} unpushed commit(s)`);
          }
          console.log(chalk.green(`Pushed to origin/${result.currentBranch}`));
          console.log(chalk.green(`Task status updated to 'review'`));
        }

        console.log();
        console.log(chalk.green("=== PR Created Successfully ==="));
        console.log(`PR URL: ${result.prUrl}`);

      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // ============================================================================
  // Task Status Lifecycle Commands
  // ============================================================================

  // task review - display task info for review
  taskCmd
    .command("review")
    .description("View task details for review")
    .argument("<task>", "Task name or directory")
    .action(async (task: string) => {
      const ctx = getContext(program);
      const cwd = process.cwd();

      try {
        const repoRoot = ensureVibenDirWithRoot(cwd);
        const result = reviewTask(repoRoot, task);

        if (!result.success) {
          throw CliError.notFound("Task", task);
        }

        const { task: taskData, dirName, prInfo } = result;

        output(ctx, successResponse({ task: dirName, ...taskData, prInfo }), () => {
          console.log(chalk.bold(`=== Task Review: ${dirName} ===`));
          console.log();
          console.log(`Title:    ${taskData!.title}`);
          console.log(`Status:   ${formatStatus(taskData!.status)}`);
          console.log(`Priority: ${formatPriority(taskData!.priority)}`);
          console.log();

          if (taskData!.pr_url) {
            console.log(`PR URL:   ${chalk.cyan(taskData!.pr_url)}`);
            console.log(`Branch:   ${taskData!.branch || "-"}`);
            console.log();
            if (prInfo?.changedFiles) {
              console.log(`Files Changed: ${prInfo.changedFiles}`);
              console.log(`+${prInfo.additions || 0} -${prInfo.deletions || 0}`);
              console.log();
            }
          }

          if (taskData!.status === "review") {
            console.log(chalk.blue("Next steps:"));
            console.log(`  viben task approve ${dirName}   # Approve and complete`);
            console.log(`  viben task reject ${dirName}    # Reject and return to backlog`);
          } else if (taskData!.status === "failed") {
            console.log(chalk.blue("Next steps:"));
            console.log(`  viben task retry ${dirName}     # Retry failed task`);
          }
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // task approve - review -> completed (with auto PR merge detection)
  taskCmd
    .command("approve")
    .description("Approve task and mark as completed (auto-merges PR if exists)")
    .argument("<task>", "Task name or directory")
    .action(async (task: string) => {
      const ctx = getContext(program);
      const cwd = process.cwd();

      try {
        const repoRoot = ensureVibenDirWithRoot(cwd);
        const taskDir = resolveTaskDirectory(task, repoRoot);

        if (!taskDir) {
          throw CliError.notFound("Task", task);
        }

        const taskData = readTaskJsonFromWorkspace(taskDir);

        if (!taskData) {
          throw CliError.operationFailed("Read task", "Cannot read task.json");
        }

        // 检测是否需要合并 PR
        if (taskData.pr_url) {
          // 启动 merge-pr agent (异步)
          const mergeResult = await runMergePRPhase(repoRoot, taskDir, {
            platform: detectPlatform(repoRoot),
            verbose: true,
          });

          if (!mergeResult.success) {
            throw CliError.operationFailed("Start merge agent", mergeResult.error!);
          }

          const dirName = taskDir.split("/").pop() || task;

          // 输出 agent 信息 (任务状态保持 review，由 agent 更新)
          output(ctx, successResponse({
            task: dirName,
            action: "merge_started",
            agentId: mergeResult.agentId,
            pid: mergeResult.pid,
            logFile: mergeResult.logFile,
            pr_url: taskData.pr_url,
          }), () => {
            console.log(chalk.blue(`Merge agent started for: ${dirName}`));
            console.log(chalk.gray(`PR: ${taskData.pr_url}`));
            console.log(chalk.gray(`Agent: ${mergeResult.agentId}`));
            console.log(chalk.gray(`PID: ${mergeResult.pid}`));
            console.log(chalk.gray(`Log: ${mergeResult.logFile}`));
            console.log();
            console.log(chalk.yellow("Task status will be updated by agent upon completion."));
            console.log(`  tail -f ${mergeResult.logFile}    # Watch progress`);
          });
        } else {
          // 无 PR，简单状态转换（现有行为）
          const result = approveTask(repoRoot, task);

          if (!result.success) {
            throw CliError.operationFailed("Approve task", result.error!);
          }

          output(ctx, successResponse({ task: result.task, status: result.status }), () => {
            console.log(chalk.green(`Approved: ${result.task}`));
            console.log(chalk.gray(`Status: ${result.fromStatus} -> completed`));
            console.log();
            console.log(chalk.blue("Next steps:"));
            console.log(`  viben task archive ${result.task}    # Archive completed task`);
          });
        }
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // task reject - review -> backlog
  taskCmd
    .command("reject")
    .description("Reject task and return to backlog")
    .argument("<task>", "Task name or directory")
    .option("--reason <text>", "Reason for rejection")
    .action(async (task: string, options: { reason?: string }) => {
      const ctx = getContext(program);
      const cwd = process.cwd();

      try {
        const repoRoot = ensureVibenDirWithRoot(cwd);
        const result = rejectTask(repoRoot, task, options.reason);

        if (!result.success) {
          throw CliError.operationFailed("Reject task", result.error!);
        }

        output(ctx, successResponse({ task: result.task, status: result.status, reason: options.reason }), () => {
          console.log(chalk.yellow(`Rejected: ${result.task}`));
          console.log(chalk.gray(`Status: ${result.fromStatus} -> backlog`));
          if (options.reason) {
            console.log(chalk.gray(`Reason: ${options.reason}`));
          }
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // task retry - failed -> queue
  taskCmd
    .command("retry")
    .description("Retry a failed task")
    .argument("<task>", "Task name or directory")
    .action(async (task: string) => {
      const ctx = getContext(program);
      const cwd = process.cwd();

      try {
        const repoRoot = ensureVibenDirWithRoot(cwd);
        const result = retryTask(repoRoot, task);

        if (!result.success) {
          throw CliError.operationFailed("Retry task", result.error!);
        }

        output(ctx, successResponse({ task: result.task, status: result.status }), () => {
          console.log(chalk.green(`Retrying: ${result.task}`));
          console.log(chalk.gray(`Status: ${result.fromStatus} -> queue`));
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // task cancel - * -> cancelled
  const cancelAction = async (task: string, options: { reason?: string; force?: boolean }) => {
    const ctx = getContext(program);
    const cwd = process.cwd();

    try {
      const repoRoot = ensureVibenDirWithRoot(cwd);
      const result = cancelTask(repoRoot, task, options);

      if (!result.success) {
        throw CliError.operationFailed("Cancel task", result.error!);
      }

      output(ctx, successResponse({ task: result.task, status: result.status, reason: options.reason }), () => {
        console.log(chalk.red(`Cancelled: ${result.task}`));
        console.log(chalk.gray(`Status: ${result.fromStatus} -> cancelled`));
        if (options.reason) {
          console.log(chalk.gray(`Reason: ${options.reason}`));
        }
      });
    } catch (error) {
      handleCommandError(ctx, error);
    }
  };

  taskCmd
    .command("cancel")
    .description("Cancel a task (enters cancelled state)")
    .argument("<task>", "Task name or directory")
    .option("--reason <text>", "Cancellation reason")
    .option("-f, --force", "Force cancel a running (in_progress) task")
    .action(cancelAction);

  // task stop - alias for cancel
  taskCmd
    .command("stop")
    .description("Stop a task (alias for cancel)")
    .argument("<task>", "Task name or directory")
    .option("--reason <text>", "Cancellation reason")
    .option("-f, --force", "Force stop a running (in_progress) task")
    .action(cancelAction);

  // task context
  taskCmd
    .command("context")
    .description("Get session context for AI agents")
    .argument("<task>", "Task name or directory")
    .option("-j, --json", "Output in JSON format")
    .action(async (task: string, options: { json?: boolean }) => {
      const ctx = getContext(program);
      if (options.json) {
        ctx.json = true;
      }

      const cwd = process.cwd();

      try {
        const repoRoot = ensureVibenDirWithRoot(cwd);
        const taskDir = resolveTaskDirectory(task, repoRoot);

        if (!taskDir || !existsSync(taskDir)) {
          throw CliError.notFound("Task", task);
        }

        if (ctx.json) {
          const contextData = getContextJson(repoRoot, taskDir);
          output(ctx, successResponse(contextData), () => {
            // JSON output handled by output()
          });
        } else {
          const contextText = getContextText(repoRoot, taskDir);
          output(ctx, successResponse({ context: contextText }), () => {
            console.log(contextText);
          });
        }
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // task add-session
  taskCmd
    .command("add-session")
    .description("Add a new session to journal file and update index.md")
    .requiredOption("--title <title>", "Session title")
    .option("--commit <hashes>", "Comma-separated commit hashes", "-")
    .option("--summary <summary>", "Brief summary", "(Add summary)")
    .option("--content <content>", "Detailed content", "(Add details)")
    .action(
      async (options: {
        title: string;
        commit: string;
        summary: string;
        content: string;
      }) => {
        const ctx = getContext(program);
        const cwd = process.cwd();
        const MAX_LINES = 2000;

        try {
          const repoRoot = ensureVibenDirWithRoot(cwd);
          const developer = getDeveloper(repoRoot);

          if (!developer) {
            throw CliError.operationFailed(
              "Add session",
              "Developer not initialized. Run 'viben team init-developer' first."
            );
          }

          // Get workspace directory for developer
          const devDir = join(repoRoot, DIR_VIBEN, DIR_WORKSPACE, developer);
          if (!existsSync(devDir)) {
            throw CliError.operationFailed(
              "Add session",
              `Workspace directory not found: ${devDir}`
            );
          }

          const indexPath = join(devDir, "index.md");
          const today = getTodayDate();

          // Get journal info
          const journalInfo = getLatestJournalInfo(devDir);
          const currentSession = getSessionNumberFromIndex(indexPath);
          const newSession = currentSession + 1;

          // Generate session content
          const sessionContent = generateSessionMarkdown({
            sessionNum: newSession,
            title: options.title,
            commit: options.commit,
            summary: options.summary,
            extraContent: options.content,
            date: today,
          });
          const contentLines = sessionContent.split("\n").length;

          // Output info
          console.log(chalk.blue("========================================"));
          console.log(chalk.blue("ADD SESSION"));
          console.log(chalk.blue("========================================"));
          console.log();
          console.log(`Session: ${newSession}`);
          console.log(`Title: ${options.title}`);
          console.log(`Commit: ${options.commit}`);
          console.log();
          console.log(`Current journal file: journal-${journalInfo.number}.md`);
          console.log(`Current lines: ${journalInfo.lines}`);
          console.log(`New content lines: ${contentLines}`);
          console.log(`Total after append: ${journalInfo.lines + contentLines}`);
          console.log();

          // Determine target file
          let targetFile = journalInfo.file;
          let targetNum = journalInfo.number;

          // Check if need to rotate journal file
          if (journalInfo.lines + contentLines > MAX_LINES) {
            targetNum = journalInfo.number + 1;
            console.log(
              chalk.yellow(
                `[!] Exceeds ${MAX_LINES} lines, creating journal-${targetNum}.md`
              )
            );
            targetFile = createNewJournalFile(
              devDir,
              targetNum,
              developer,
              today,
              journalInfo.number
            );
            console.log(`Created: ${targetFile}`);
          }

          // Create initial journal file if none exists
          if (!targetFile) {
            targetNum = 1;
            targetFile = createNewJournalFile(devDir, targetNum, developer, today, 0);
            console.log(`Created initial: ${targetFile}`);
          }

          // Append session content to target file
          const existingContent = readFileSync(targetFile, "utf-8");
          writeFileSync(targetFile, existingContent + sessionContent, "utf-8");
          console.log(
            chalk.green(`[OK] Appended session to ${basename(targetFile)}`)
          );
          console.log();

          // Update index.md
          console.log("Updating index.md...");
          const activeFileName = `journal-${targetNum}.md`;
          const updateSuccess = updateIndexWithNewSession({
            indexPath,
            devDir,
            sessionNum: newSession,
            title: options.title,
            commit: options.commit,
            activeFile: activeFileName,
            date: today,
          });

          if (updateSuccess) {
            console.log(chalk.green("[OK] Updated index.md successfully!"));
          } else {
            console.log(
              chalk.yellow(
                "[!] Could not update index.md (markers not found or file missing)"
              )
            );
          }

          console.log();
          console.log(chalk.green("========================================"));
          console.log(chalk.green(`[OK] Session ${newSession} added successfully!`));
          console.log(chalk.green("========================================"));
          console.log();
          console.log("Files updated:");
          console.log(`  - ${basename(targetFile)}`);
          console.log("  - index.md");

          output(
            ctx,
            successResponse({
              session: newSession,
              journalFile: activeFileName,
              title: options.title,
            }),
            () => {
              // Already printed above
            }
          );
        } catch (error) {
          handleCommandError(ctx, error);
        }
      }
    );

  // ============================================================================
  // Phase Commands
  // ============================================================================

  // task plan-phase - Run plan phase for an existing task
  taskCmd
    .command("plan-phase")
    .description("Run plan phase for an existing task (spawns plan agent)")
    .argument("<task>", "Task name or directory")
    .option("-p, --platform <platform>", "Platform (claude, cursor, iflow, opencode)", "claude")
    .option("-v, --verbose", "Enable verbose output")
    .action(async (task: string, options: { platform?: string; verbose?: boolean }) => {
      const ctx = getContext(program);
      const cwd = process.cwd();

      try {
        const repoRoot = ensureVibenDirWithRoot(cwd);

        // Resolve task directory
        const taskDir = resolveTaskDirectory(task, repoRoot);
        if (!taskDir) {
          throw CliError.invalidArgument("task", `Task not found: ${task}`);
        }

        console.log();
        console.log(chalk.blue("=== Plan Phase ==="));
        console.log(chalk.cyan("[INFO]"), `Task: ${task}`);
        console.log(chalk.cyan("[INFO]"), `Platform: ${options.platform || "claude"}`);
        console.log();

        const result = await runPlanPhase(repoRoot, taskDir, {
          platform: options.platform,
          verbose: options.verbose,
        });

        if (result.success) {
          console.log(chalk.green("=== Plan Agent Started ==="));
          console.log();
          console.log(`  ID:   ${result.agentId}`);
          console.log(`  PID:  ${result.pid}`);
          console.log(`  Log:  ${result.logFile}`);
          console.log();
          console.log(chalk.yellow("To monitor:"));
          console.log(`  tail -f ${result.logFile}`);
          console.log();

          output(ctx, successResponse(result));
        } else {
          throw CliError.operationFailed("Plan Phase", result.error || "Unknown error");
        }
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // task implement-phase - Run implement phase for a task
  taskCmd
    .command("implement-phase")
    .description("Run implement phase for a task (spawns implement agent)")
    .argument("<task>", "Task name or directory")
    .option("-p, --platform <platform>", "Platform (claude, cursor, iflow, opencode)", "claude")
    .option("-v, --verbose", "Enable verbose output")
    .action(async (task: string, options: { platform?: string; verbose?: boolean }) => {
      const ctx = getContext(program);
      const cwd = process.cwd();

      try {
        const repoRoot = ensureVibenDirWithRoot(cwd);

        // Resolve task directory
        const taskDir = resolveTaskDirectory(task, repoRoot);
        if (!taskDir) {
          throw CliError.invalidArgument("task", `Task not found: ${task}`);
        }

        console.log();
        console.log(chalk.blue("=== Implement Phase ==="));
        console.log(chalk.cyan("[INFO]"), `Task: ${task}`);
        console.log(chalk.cyan("[INFO]"), `Platform: ${options.platform || "claude"}`);
        console.log();

        const result = await runImplementPhase(repoRoot, taskDir, {
          platform: options.platform,
          verbose: options.verbose,
        });

        if (result.success) {
          console.log(chalk.green("=== Implement Agent Started ==="));
          console.log();
          console.log(`  ID:   ${result.agentId}`);
          console.log(`  PID:  ${result.pid}`);
          console.log(`  Log:  ${result.logFile}`);
          console.log();
          console.log(chalk.yellow("To monitor:"));
          console.log(`  tail -f ${result.logFile}`);
          console.log();

          output(ctx, successResponse(result));
        } else {
          throw CliError.operationFailed("Implement Phase", result.error || "Unknown error");
        }
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // task check-phase - Run check phase for a task
  taskCmd
    .command("check-phase")
    .description("Run check phase for a task (spawns check agent)")
    .argument("<task>", "Task name or directory")
    .option("-p, --platform <platform>", "Platform (claude, cursor, iflow, opencode)", "claude")
    .option("-v, --verbose", "Enable verbose output")
    .action(async (task: string, options: { platform?: string; verbose?: boolean }) => {
      const ctx = getContext(program);
      const cwd = process.cwd();

      try {
        const repoRoot = ensureVibenDirWithRoot(cwd);

        // Resolve task directory
        const taskDir = resolveTaskDirectory(task, repoRoot);
        if (!taskDir) {
          throw CliError.invalidArgument("task", `Task not found: ${task}`);
        }

        console.log();
        console.log(chalk.blue("=== Check Phase ==="));
        console.log(chalk.cyan("[INFO]"), `Task: ${task}`);
        console.log(chalk.cyan("[INFO]"), `Platform: ${options.platform || "claude"}`);
        console.log();

        const result = await runCheckPhase(repoRoot, taskDir, {
          platform: options.platform,
          verbose: options.verbose,
        });

        if (result.success) {
          console.log(chalk.green("=== Check Agent Started ==="));
          console.log();
          console.log(`  ID:   ${result.agentId}`);
          console.log(`  PID:  ${result.pid}`);
          console.log(`  Log:  ${result.logFile}`);
          console.log();
          console.log(chalk.yellow("To monitor:"));
          console.log(`  tail -f ${result.logFile}`);
          console.log();

          output(ctx, successResponse(result));
        } else {
          throw CliError.operationFailed("Check Phase", result.error || "Unknown error");
        }
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // task create-worktree - Create isolated git worktree for a task
  taskCmd
    .command("create-worktree")
    .description("Create isolated git worktree for a task")
    .argument("<task>", "Task name or directory")
    .option("--skip-prd", "Skip prd.md validation")
    .action(async (task: string, options: { skipPrd?: boolean }) => {
      const ctx = getContext(program);
      const cwd = process.cwd();

      try {
        const repoRoot = ensureVibenDirWithRoot(cwd);

        // Resolve task directory
        const taskDir = resolveTaskDirectory(task, repoRoot);
        if (!taskDir || !existsSync(taskDir)) {
          throw CliError.notFound("Task", task);
        }

        // Business logic validation (before worktree creation)
        const taskJson = readTaskJsonFromWorkspace(taskDir) as { status?: string } | null;

        // Check if task was rejected
        if (taskJson?.status === "rejected") {
          const rejectedFile = join(taskDir, "REJECTED.md");
          let reason = "";
          if (existsSync(rejectedFile)) {
            reason = readFileSync(rejectedFile, "utf-8").trim();
          }
          throw CliError.operationFailed(
            "Create Worktree",
            `Task was rejected. ${reason ? `Reason: ${reason}` : "Check REJECTED.md for details."}`
          );
        }

        // Check prd.md exists (unless skipped)
        if (!options.skipPrd) {
          const prdFile = join(taskDir, "prd.md");
          if (!existsSync(prdFile)) {
            throw CliError.operationFailed(
              "Create Worktree",
              "prd.md not found - planning may not have completed. Use --skip-prd to bypass this check."
            );
          }
        }

        console.log();
        console.log(chalk.blue("=== Create Worktree ==="));
        console.log(chalk.cyan("[INFO]"), `Task: ${task}`);
        console.log();

        const result = await runCreateWorktree(repoRoot, taskDir);

        if (result.success) {
          console.log(chalk.green("=== Worktree Created ==="));
          console.log();
          console.log(`  Path:        ${result.worktreePath}`);
          console.log(`  Branch:      ${result.branch}`);
          console.log(`  Base Branch: ${result.baseBranch}`);
          console.log();
          console.log(chalk.yellow("Next step:"));
          console.log(`  viben task work-phase ${task} --worktree ${result.worktreePath}`);
          console.log();

          output(ctx, successResponse(result));
        } else {
          throw CliError.operationFailed("Create Worktree", result.error || "Unknown error");
        }
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // task work-phase - Run work agent for a task
  taskCmd
    .command("work-phase")
    .description("Run work phase for a task (spawns work agent)")
    .argument("<task>", "Task name or directory")
    .option("-p, --platform <platform>", "Platform (claude, cursor, iflow, opencode)", "claude")
    .option("-v, --verbose", "Enable verbose output")
    .option("--no-detach", "Run in foreground (default: background)")
    .action(async (task: string, options: { platform?: string; verbose?: boolean; detach?: boolean }) => {
      const ctx = getContext(program);
      const cwd = process.cwd();

      try {
        const repoRoot = ensureVibenDirWithRoot(cwd);
        const platform = options.platform || "claude";

        // Resolve task directory (always use absolute path)
        const taskDirAbs = resolveTaskDirectory(task, repoRoot);
        if (!taskDirAbs || !existsSync(taskDirAbs)) {
          throw CliError.notFound("Task", task);
        }

        // Check work agent exists
        const adapter = createCLIAdapter(platform);
        const workMd = adapter.getAgentConfigPath("work", repoRoot);
        if (!existsSync(workMd)) {
          throw CliError.operationFailed(
            "Work Phase",
            `work agent not found at ${workMd}. Platform: ${platform}`
          );
        }

        // Read task.json to get worktree_path and worktree flag
        const taskJson = readTaskJsonFromWorkspace(taskDirAbs) as {
          id?: string;
          name?: string;
          worktree_path?: string;
          worktree?: boolean;
          branch?: string;
          status?: string;
        } | null;
        let worktreePath = taskJson?.worktree_path;
        const useWorktree = taskJson?.worktree ?? false;

        // Business logic validation (before work phase)
        // Check if task was rejected
        if (taskJson?.status === "rejected") {
          const rejectedFile = join(taskDirAbs, "REJECTED.md");
          let reason = "";
          if (existsSync(rejectedFile)) {
            reason = readFileSync(rejectedFile, "utf-8").trim();
          }
          throw CliError.operationFailed(
            "Work Phase",
            `Task was rejected. ${reason ? `Reason: ${reason}` : "Check REJECTED.md for details."}`
          );
        }

        // Check prd.md exists
        const prdFile = join(taskDirAbs, "prd.md");
        if (!existsSync(prdFile)) {
          throw CliError.operationFailed(
            "Work Phase",
            "prd.md not found - planning must be completed before work phase."
          );
        }

        // Determine working directory from task.json
        let workingDir: string;
        let modeLabel: string;
        let logFileName: string;
        let isWorktreeMode: boolean;

        if (useWorktree || worktreePath) {
          // Check if worktree exists, create if not
          if (!worktreePath || !existsSync(worktreePath)) {
            console.log(chalk.cyan("[INFO]"), "Worktree not found, creating...");

            const createResult = await runCreateWorktree(repoRoot, taskDirAbs);

            if (!createResult.success) {
              throw CliError.operationFailed("Create Worktree", createResult.error || "Unknown error");
            }

            worktreePath = createResult.worktreePath!;
            console.log(chalk.green("[OK]"), `Worktree created at ${worktreePath}`);
          }

          workingDir = worktreePath;
          modeLabel = `worktree (${worktreePath})`;
          logFileName = "agent.log.jsonl";
          isWorktreeMode = true;
        } else {
          workingDir = repoRoot;
          modeLabel = "current repo";
          logFileName = "work.log.jsonl";
          isWorktreeMode = false;
        }

        // Generate agent ID (same logic as swarm start)
        let agentId: string;
        if (taskJson?.id) {
          agentId = taskJson.id;
        } else if (taskJson?.branch) {
          agentId = taskJson.branch.replace(/\//g, "-");
        } else if (taskJson?.name) {
          agentId = taskJson.name;
        } else {
          agentId = `${isWorktreeMode ? "swarm" : "work"}-${basename(taskDirAbs)}`;
        }

        console.log();
        console.log(chalk.blue("=== Work Phase ==="));
        console.log(chalk.cyan("[INFO]"), `Task: ${task}`);
        console.log(chalk.cyan("[INFO]"), `Platform: ${platform}`);
        console.log(chalk.cyan("[INFO]"), `Working Dir: ${modeLabel}`);
        console.log(chalk.cyan("[INFO]"), `Mode: ${options.detach !== false ? "background" : "foreground"}`);
        console.log();

        const result = await runWorkPhase({
          repoRoot,
          workingDir,
          taskDir: taskDirAbs,
          platform,
          verbose: options.verbose,
          detach: options.detach !== false,
          skipPermissions: true,
          jsonOutput: true,
          logFileName,
          agentId,
          skipNextActionValidation: isWorktreeMode,
        });

        if (result.success) {
          console.log(chalk.green("=== Work Agent Started ==="));
          console.log();
          console.log(`  ID:       ${result.agentId}`);
          console.log(`  PID:      ${result.pid}`);
          if (result.sessionId) {
            console.log(`  Session:  ${result.sessionId}`);
          }
          console.log(`  Log:      ${result.logFile}`);
          console.log();
          console.log(chalk.yellow("To monitor:"));
          console.log(`  tail -f ${result.logFile}`);
          console.log(`  viben swarm status ${task}`);
          console.log();

          output(ctx, successResponse(result));
        } else {
          throw CliError.operationFailed("Work Phase", result.error || "Unknown error");
        }
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // task validate-check-phase-passed - Validate check phase passed
  taskCmd
    .command("validate-check-phase-passed")
    .description("Validate check phase passed (runs verify commands or checks completion markers)")
    .argument("<task>", "Task name or directory")
    .option("-o, --output <output>", "Agent output text (for completion markers validation)")
    .option("-f, --output-file <file>", "File containing agent output")
    .action(async (task: string, options: { output?: string; outputFile?: string }) => {
      const ctx = getContext(program);
      const cwd = process.cwd();

      try {
        const repoRoot = ensureVibenDirWithRoot(cwd);

        // Resolve task directory
        const taskDir = resolveTaskDirectory(task, repoRoot);
        if (!taskDir) {
          throw CliError.invalidArgument("task", `Task not found: ${task}`);
        }

        // Get agent output (from option or file)
        let agentOutput: string | undefined = options.output;
        if (!agentOutput && options.outputFile) {
          if (existsSync(options.outputFile)) {
            agentOutput = readFileSync(options.outputFile, "utf-8");
          }
        }

        const result = validateIfReviewFinished(repoRoot, taskDir, agentOutput);

        if (ctx.json) {
          output(ctx, successResponse(result));
          return;
        }

        console.log();
        console.log(chalk.blue("=== Check Phase Validation ==="));
        console.log();
        console.log(`  Method: ${result.method}`);
        console.log(`  Result: ${result.success ? chalk.green("PASSED") : chalk.red("FAILED")}`);
        console.log();

        if (result.method === "verify_commands") {
          console.log(chalk.cyan("Commands:"));
          for (const cmd of result.details.commands || []) {
            console.log(`  - ${cmd}`);
          }
          if (result.details.outputs) {
            console.log();
            for (const out of result.details.outputs) {
              const icon = out.exitCode === 0 ? chalk.green("✓") : chalk.red("✗");
              console.log(`  ${icon} ${out.command} (exit: ${out.exitCode})`);
            }
          }
        } else {
          console.log(chalk.cyan("Expected markers:"));
          for (const marker of result.details.expectedMarkers || []) {
            const found = result.details.foundMarkers?.includes(marker);
            const icon = found ? chalk.green("✓") : chalk.red("✗");
            console.log(`  ${icon} ${marker}`);
          }
        }

        console.log();
        if (result.success) {
          console.log(chalk.green("Check phase validation passed."));
          // Record timestamp when check phase passes
          updateTaskField(taskDir, "checkPassedAt", new Date().toISOString());
        } else {
          console.log(chalk.red("Check phase validation failed:"));
          console.log(chalk.red(`  ${result.error}`));
        }

        output(ctx, successResponse(result));
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // ============================================================================
  // Cleanup Commands (moved from swarm.ts)
  // ============================================================================

  // task cleanup - cleanup worktrees
  taskCmd
    .command("cleanup")
    .description("Cleanup worktrees and related resources")
    .argument("[branch]", "Branch name to cleanup")
    .option("--keep-branch", "Keep the git branch")
    .option("-y, --yes", "Skip confirmation prompts")
    .option("--merged", "Cleanup merged worktrees")
    .option("--all", "Cleanup all worktrees")
    .option("--list", "List all worktrees")
    .action(async (branch: string | undefined, options: {
      keepBranch?: boolean;
      yes?: boolean;
      merged?: boolean;
      all?: boolean;
      list?: boolean;
    }) => {
      const ctx = getContext(program);
      const cwd = process.cwd();

      try {
        const repoRoot = ensureVibenDirWithRoot(cwd);
        await cleanupWorktreesCommand(ctx, repoRoot, branch, options);
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // ============================================================================
  // Stuck Detection Commands
  // ============================================================================

  // task check-stuck - check if a task is stuck
  taskCmd
    .command("check-stuck")
    .description("Check if a task is stuck (no recovery, detection only)")
    .argument("<task>", "Task name or directory")
    .option("-t, --threshold <ms>", "Stuck threshold in milliseconds (default: 120000 = 2min)", "120000")
    .option("-v, --verbose", "Show detailed log analysis")
    .option("--json", "Output in JSON format")
    .action(async (task: string, options: {
      threshold?: string;
      verbose?: boolean;
      json?: boolean;
    }) => {
      const ctx = getContext(program);
      if (options.json) {
        ctx.json = true;
      }
      const cwd = process.cwd();

      try {
        const repoRoot = ensureVibenDirWithRoot(cwd);
        const thresholdMs = parseInt(options.threshold || "120000", 10);

        const result = checkStuck(repoRoot, task, {
          thresholdMs,
          verbose: options.verbose,
        });

        if (!result.success) {
          output(ctx, errorResponse("CHECK_FAILED", result.error || "Unknown error"), () => {
            console.error(chalk.red(`Error: ${result.error}`));
          });
          process.exit(1);
          return;
        }

        if (ctx.json) {
          output(ctx, successResponse(result));
          return;
        }

        // Human-readable output
        console.log(chalk.bold.cyan(`=== Stuck Check: ${result.taskDir} ===`));
        console.log();

        // Overall status
        if (result.isStuck) {
          console.log(chalk.red.bold(`Status: STUCK`));
          console.log(chalk.red(`  ${result.summary}`));
        } else {
          console.log(chalk.green.bold(`Status: OK`));
          console.log(chalk.green(`  ${result.summary}`));
        }
        console.log();

        // Individual checks
        console.log(chalk.cyan("Checks:"));
        for (const check of result.checks) {
          const icon = check.isStuck ? chalk.red("✗") : chalk.green("✓");
          const nameColor = check.isStuck ? chalk.red : chalk.white;
          console.log(`  ${icon} ${nameColor(check.name)}: ${check.reason}`);

          // Show additional data if verbose
          if (options.verbose && check.data && Object.keys(check.data).length > 0) {
            for (const [key, value] of Object.entries(check.data)) {
              if (value !== null && value !== undefined) {
                const displayValue = typeof value === "object" ? JSON.stringify(value) : String(value);
                console.log(chalk.gray(`      ${key}: ${displayValue}`));
              }
            }
          }
        }

        console.log();

        // Task info summary
        if (result.task) {
          console.log(chalk.cyan("Task Info:"));
          console.log(`  Status:   ${formatStatus(result.task.status)}`);
          console.log(`  Assignee: ${result.task.assignee || "-"}`);
          if (result.task.lastEvent) {
            console.log(`  Last Event: ${result.task.lastEvent.type} @ ${result.task.lastEvent.timestamp}`);
          }
          if (result.task.updatedAt) {
            console.log(`  Updated:  ${result.task.updatedAt}`);
          }
        }

      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

}
