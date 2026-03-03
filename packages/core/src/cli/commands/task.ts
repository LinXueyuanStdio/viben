/**
 * viben task - Task management commands
 *
 * Provides commands for managing development tasks, including creation, context management,
 * status tracking, and PR workflow.
 *
 * Subcommands:
 * - CRUD: list, create, view, edit, delete
 * - Status: start, finish, archive, list-archive
 * - Config: set-branch, set-base, set-scope, set-agent
 * - Context: init-context, add-context, remove-context, list-context, validate-context
 * - Planning: plan, status, create-pr
 */
import chalk from "chalk";
import { spawn, execSync, type SpawnOptions } from "node:child_process";
import {
  existsSync,
  readFileSync,
  readdirSync,
  writeFileSync,
  mkdirSync,
  statSync,
  openSync,
} from "node:fs";
import { resolve, join, relative, basename } from "node:path";
import type { Command } from "commander";
import type { OutputContext } from "../types";
import {
  output,
  successResponse,
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
  getCurrentTask,
  setCurrentTask,
  clearCurrentTask,
  readTaskJson as readTaskJsonFromWorkspace,
  writeTaskJson,
  updateTaskField,
  getActiveTasks,
  getDatePrefix,
  getTodayDate,
  getYearMonth,
  slugify,
  findTaskByName,
  resolveTaskDirectory,
  archiveTask,
  getArchivedTasks,
  readJsonlFile,
  writeJsonlFile,
  appendToJsonl,
  jsonlEntryExists,
  runGitCommand,
  getJournalInfo,
  DIR_VIBEN,
  DIR_WORKSPACE,
  DIR_TASKS,
  DIR_SPEC,
  FILE_TASK_JSON,
  // Phase management
  getPhaseInfo,
  getPhaseForAction,
  // Agent registry
  getRegistryFile,
  getAgentsDir,
  registrySearchAgent,
  registryAddAgent,
  registryListAgents,
  isProcessRunning,
  calcElapsed,
  // Task stats
  getTaskStats,
  formatTaskStats,
  // CLI adapter
  getCLIAdapter,
  detectPlatform,
  type AgentRegistryEntry,
} from "../lib/viben-workspace";

import type { UnifiedTask } from "../../services/task-service";

// =============================================================================
// Constants
// =============================================================================

const VIBEN_DIR = ".viben";

// =============================================================================
// Types
// =============================================================================

/**
 * Task JSON format stored in .viben/tasks/<date>-<slug>/task.json
 * This is compatible with UnifiedTask from task-service.ts
 */
type TaskJson = UnifiedTask;

interface ContextEntry {
  file: string;
  reason: string;
  type?: "file" | "directory";
}

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

/**
 * Read task.json from a task directory
 */
function readTaskJson(taskDir: string): TaskJson | null {
  const taskJsonPath = join(taskDir, "task.json");
  if (!existsSync(taskJsonPath)) {
    return null;
  }
  try {
    const content = readFileSync(taskJsonPath, "utf-8");
    return JSON.parse(content) as TaskJson;
  } catch {
    return null;
  }
}

/**
 * Format task status for display
 * Uses unified status values: backlog, queue, in_progress, ai_review, human_review, done, pr_created, error
 */
function formatStatus(status: string): string {
  switch (status) {
    // Completed states
    case "done":
    case "pr_created":
    case "completed": // Legacy
      return chalk.green(status);
    // In-progress states
    case "in_progress":
    case "ai_review":
    case "queue":
      return chalk.blue(status);
    // Waiting states
    case "backlog":
    case "human_review":
    case "planning": // Legacy
      return chalk.yellow(status);
    // Error state
    case "error":
      return chalk.red(status);
    default:
      return chalk.gray(status);
  }
}

/**
 * Format priority for display
 */
function formatPriority(priority: string): string {
  switch (priority) {
    case "P0":
      return chalk.red(priority);
    case "P1":
      return chalk.yellow(priority);
    case "P2":
      return chalk.blue(priority);
    case "P3":
      return chalk.gray(priority);
    default:
      return priority;
  }
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
    .description("List all tasks")
    .option("-m, --mine", "Show only tasks assigned to current developer")
    .option("-s, --status <status>", "Filter by status (planning, in_progress, completed)")
    .option("--json", "Output in JSON format")
    .action(async (options: { mine?: boolean; status?: string; json?: boolean }) => {
      const ctx = getContext(program);
      if (options.json) {
        ctx.json = true;
      }

      const cwd = process.cwd();

      try {
        const repoRoot = ensureVibenDirWithRoot(cwd);
        const developer = getDeveloper(repoRoot);
        const currentTask = getCurrentTask(repoRoot);

        // Check filters
        if (options.mine && !developer) {
          throw CliError.operationFailed(
            "List tasks",
            "No developer set. Run init-developer first or remove --mine flag"
          );
        }

        // Get all active tasks
        let tasks = getActiveTasks(repoRoot);

        // Apply --mine filter
        if (options.mine && developer) {
          tasks = tasks.filter((t) => t.assignee === developer);
        }

        // Apply --status filter
        if (options.status) {
          tasks = tasks.filter((t) => t.status === options.status);
        }

        output(ctx, successResponse({ tasks, currentTask }), () => {
          if (options.mine) {
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
            for (const task of tasks) {
              const relativePath = `${DIR_VIBEN}/${DIR_TASKS}/${task.dir}`;
              const isCurrent = relativePath === currentTask;
              const marker = isCurrent ? chalk.green(" <- current") : "";

              if (options.mine) {
                console.log(`  - ${task.dir}/ (${formatStatus(task.status)})${marker}`);
              } else {
                console.log(
                  `  - ${task.dir}/ (${formatStatus(task.status)}) [${chalk.cyan(task.assignee)}]${marker}`
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
    .argument("<title>", "Task title")
    .option("-s, --slug <name>", "Task identifier (auto-generated from title if not provided)")
    .option("-a, --assignee <dev>", "Assignee developer name")
    .option("-p, --priority <priority>", "Priority (P0, P1, P2, P3)", "P2")
    .option("-d, --description <text>", "Task description")
    .option("--agent <agent-id>", "Associated agent configuration")
    .action(async (title: string, options: {
      slug?: string;
      assignee?: string;
      priority?: string;
      description?: string;
      agent?: string;
    }) => {
      const ctx = getContext(program);
      const cwd = process.cwd();

      try {
        const repoRoot = ensureVibenDirWithRoot(cwd);

        // Get developer for assignee and creator
        const developer = getDeveloper(repoRoot);
        const assignee = options.assignee || developer;

        if (!assignee) {
          throw CliError.operationFailed(
            "Create task",
            "No developer set. Run init-developer first or use --assignee"
          );
        }

        const creator = developer || assignee;

        // Generate slug if not provided
        const taskSlug = options.slug || slugify(title);
        if (!taskSlug) {
          throw CliError.invalidArgument(
            "slug",
            "Could not generate slug from title. Use --slug to specify manually"
          );
        }

        // Create task directory
        const tasksDir = ensureTasksDir(repoRoot);
        const datePrefix = getDatePrefix();
        const dirName = `${datePrefix}-${taskSlug}`;
        const taskDir = join(tasksDir, dirName);

        if (existsSync(taskDir)) {
          outputWarning(ctx, `Task directory already exists: ${dirName}`);
        } else {
          mkdirSync(taskDir, { recursive: true });
        }

        // Get current branch as base_branch (PR target)
        const { stdout: branchOut } = runGitCommand(
          ["branch", "--show-current"],
          repoRoot
        );
        const currentBranch = branchOut.trim() || "main";

        const today = getTodayDate();

        const taskData: TaskJson = {
          id: taskSlug,
          name: taskSlug,
          title: title,
          description: options.description || "",
          status: "backlog",
          dev_type: undefined,
          scope: undefined,
          priority: options.priority || "P2",
          creator: creator,
          assignee: assignee,
          createdAt: today,
          completedAt: undefined,
          branch: undefined,
          base_branch: currentBranch,
          worktree_path: undefined,
          current_phase: 0,
          next_action: [
            { phase: 1, action: "implement" },
            { phase: 2, action: "check" },
            { phase: 3, action: "finish" },
            { phase: 4, action: "create-pr" },
          ],
          commit: undefined,
          pr_url: undefined,
          subtasks: [],
          relatedFiles: [],
          notes: "",
          agent: options.agent,
        };

        writeTaskJson(taskDir, taskData as unknown as Record<string, unknown>);

        const relativePath = `${DIR_VIBEN}/${DIR_TASKS}/${dirName}`;

        output(ctx, successResponse({ taskDir: relativePath }), () => {
          console.log(chalk.green(`Created task: ${dirName}`));
          console.log();
          console.log(chalk.blue("Next steps:"));
          console.log("  1. Create prd.md with requirements");
          console.log(`  2. Run: viben task init-context ${dirName} -t <dev_type>`);
          console.log(`  3. Run: viben task start ${dirName}`);
          console.log();
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // task view
  taskCmd
    .command("view")
    .description("View task details")
    .argument("<task>", "Task name or directory")
    .action(async (task: string) => {
      const ctx = getContext(program);
      const cwd = process.cwd();

      try {
        const repoRoot = ensureVibenDirWithRoot(cwd);

        // Try to resolve task directory
        const taskDir = resolveTaskDirectory(task, repoRoot);
        if (!taskDir || !existsSync(taskDir)) {
          throw CliError.notFound("Task", task);
        }

        const taskData = readTaskJsonFromWorkspace(taskDir);
        if (!taskData) {
          throw CliError.notFound("Task", task);
        }

        // Cast to TaskJson for type safety
        const taskJson = taskData as unknown as TaskJson;

        output(ctx, successResponse(taskJson), () => {
          console.log(chalk.bold(`Task: ${taskJson.title}`));
          console.log();

          outputKeyValue(ctx, {
            ID: taskJson.id,
            Name: taskJson.name,
            Status: formatStatus(taskJson.status),
            Priority: formatPriority(taskJson.priority),
            "Dev Type": taskJson.dev_type || "-",
            Scope: taskJson.scope || "-",
            Creator: taskJson.creator || "-",
            Assignee: taskJson.assignee || "-",
            Branch: taskJson.branch || "-",
            "Base Branch": taskJson.base_branch || "-",
            "Created At": taskJson.createdAt,
            "Completed At": taskJson.completedAt || "-",
            "Current Phase": String(taskJson.current_phase),
            "PR URL": taskJson.pr_url || "-",
          });

          if (taskJson.description) {
            console.log();
            console.log(chalk.bold("Description:"));
            console.log(taskJson.description);
          }

          if (taskJson.notes) {
            console.log();
            console.log(chalk.bold("Notes:"));
            console.log(taskJson.notes);
          }
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
        const taskDir = resolveTaskDirectory(task, repoRoot);
        if (!taskDir) {
          throw CliError.notFound("Task", task);
        }

        const taskJsonPath = join(taskDir, FILE_TASK_JSON);

        if (!existsSync(taskJsonPath)) {
          throw CliError.notFound("Task", task);
        }

        // Open in default editor
        const editor = process.env.EDITOR || process.env.VISUAL || "vi";
        const child = spawn(editor, [taskJsonPath], {
          stdio: "inherit",
          shell: true,
        });

        child.on("close", (code) => {
          if (code === 0) {
            outputSuccess(ctx, `Edited task: ${task}`);
          }
        });
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
        const taskDir = resolveTaskDirectory(task, repoRoot);

        if (!taskDir || !existsSync(taskDir)) {
          throw CliError.notFound("Task", task);
        }

        if (!options.force && !ctx.quiet) {
          console.log(chalk.yellow(`Warning: This will permanently delete task "${task}".`));
          console.log(chalk.gray("Use --force to skip this warning"));
          return;
        }

        // Use rm -rf to delete the directory
        execSync(`rm -rf "${taskDir}"`, { cwd: repoRoot });

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

  // task start
  taskCmd
    .command("start")
    .description("Set as current task")
    .argument("<task>", "Task name or directory")
    .option("--resume", "Resume associated agent session (if any)")
    .action(async (task: string, options: { resume?: boolean }) => {
      const ctx = getContext(program);
      const cwd = process.cwd();

      try {
        const repoRoot = ensureVibenDirWithRoot(cwd);

        // Resolve task directory
        const taskDir = resolveTaskDirectory(task, repoRoot);
        if (!taskDir || !existsSync(taskDir)) {
          throw CliError.notFound("Task", task);
        }

        // Convert to relative path for storage
        let relativePath: string;
        try {
          relativePath = relative(repoRoot, taskDir);
        } catch {
          relativePath = taskDir;
        }

        if (setCurrentTask(relativePath, repoRoot)) {
          output(ctx, successResponse({ task: relativePath }), () => {
            console.log(chalk.green(`Current task set to: ${relativePath}`));
            console.log();
            console.log(chalk.blue("The hook will now inject context from this task's jsonl files."));
          });

          if (options.resume) {
            // Find agent associated with this task in the registry
            const agent = registrySearchAgent(task, repoRoot);

            if (!agent) {
              if (!ctx.quiet) {
                console.log(chalk.yellow("No agent session found for this task."));
                console.log(chalk.gray("Start an agent with: viben swarm start " + task));
              }
            } else {
              // Check if agent is still running
              if (isProcessRunning(agent.pid)) {
                if (!ctx.quiet) {
                  console.log(chalk.yellow(`Agent is already running (PID: ${agent.pid})`));
                  console.log(chalk.gray(`Worktree: ${agent.worktree_path}`));
                }
              } else {
                // Try to read session ID from worktree
                const sessionIdFile = join(agent.worktree_path, ".session-id");
                let sessionId: string | null = null;

                if (existsSync(sessionIdFile)) {
                  try {
                    sessionId = readFileSync(sessionIdFile, "utf-8").trim();
                  } catch {
                    // Ignore read errors
                  }
                }

                if (!sessionId) {
                  if (!ctx.quiet) {
                    console.log(chalk.yellow("No session ID found for resume."));
                    console.log(chalk.gray("Start a new agent with: viben swarm start " + task));
                  }
                } else {
                  // Build resume command using CLI adapter
                  const platform = agent.platform || detectPlatform(repoRoot);
                  const cliAdapter = getCLIAdapter(platform);
                  const resumeCmd = cliAdapter.buildResumeCommand(sessionId);

                  if (!ctx.quiet) {
                    console.log();
                    console.log(chalk.blue("=== Resuming Agent Session ==="));
                    console.log(`  Session: ${sessionId}`);
                    console.log(`  Platform: ${platform}`);
                    console.log(`  Worktree: ${agent.worktree_path}`);
                    console.log(`  Command: ${resumeCmd.join(" ")}`);
                    console.log();
                  }

                  // Execute resume command
                  const child = spawn(resumeCmd[0], resumeCmd.slice(1), {
                    cwd: agent.worktree_path,
                    stdio: "inherit",
                  });

                  child.on("error", (err) => {
                    console.error(chalk.red(`Failed to resume: ${err.message}`));
                  });

                  // Wait for the child process to complete
                  await new Promise<void>((resolvePromise) => {
                    child.on("close", () => {
                      resolvePromise();
                    });
                  });
                }
              }
            }
          }
        } else {
          throw CliError.operationFailed("Set current task", "Failed to write .current-task file");
        }
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // task finish
  taskCmd
    .command("finish")
    .description("Clear current task")
    .argument("[task]", "Task to finish (uses current task if not specified)")
    .action(async (_task?: string) => {
      const ctx = getContext(program);
      const cwd = process.cwd();

      try {
        const repoRoot = ensureVibenDirWithRoot(cwd);
        const currentTask = getCurrentTask(repoRoot);

        if (!currentTask) {
          output(ctx, successResponse({ message: "No current task set" }), () => {
            console.log(chalk.yellow("No current task set"));
          });
          return;
        }

        clearCurrentTask(repoRoot);

        output(ctx, successResponse({ cleared: currentTask }), () => {
          console.log(chalk.green(`Cleared current task (was: ${currentTask})`));
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
        const tasksDir = getTasksDir(repoRoot);

        // Find task directory
        const taskDir = findTaskByName(task, tasksDir);
        if (!taskDir || !existsSync(taskDir)) {
          throw CliError.notFound("Task", task);
        }

        const dirName = taskDir.split("/").pop() || "";
        const taskJsonPath = join(taskDir, FILE_TASK_JSON);

        // Update status before archiving
        const today = getTodayDate();
        if (existsSync(taskJsonPath)) {
          const taskData = readTaskJsonFromWorkspace(taskDir);
          if (taskData) {
            taskData.status = "done";
            taskData.completedAt = today;
            writeTaskJson(taskDir, taskData);
          }
        }

        // Clear if it's the current task
        const currentTask = getCurrentTask(repoRoot);
        if (currentTask && currentTask.includes(dirName)) {
          clearCurrentTask(repoRoot);
        }

        // Archive the task
        const archiveDest = archiveTask(taskDir, repoRoot);
        if (archiveDest) {
          const yearMonth = getYearMonth();
          output(ctx, successResponse({ archived: dirName, to: archiveDest }), () => {
            console.log(chalk.green(`Archived: ${dirName} -> archive/${yearMonth}/`));
          });
        } else {
          throw CliError.operationFailed("Archive task", "Failed to move task to archive");
        }
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
        const archived = getArchivedTasks(repoRoot, month);

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
        const taskDir = resolveTaskDirectory(task, repoRoot);

        if (!taskDir || !existsSync(join(taskDir, FILE_TASK_JSON))) {
          throw CliError.notFound("Task", task);
        }

        if (updateTaskField(taskDir, "branch", options.branch)) {
          output(ctx, successResponse({ task, branch: options.branch }), () => {
            console.log(chalk.green(`Branch set to: ${options.branch}`));
            console.log();
            console.log(chalk.blue("Now you can start the multi-agent pipeline:"));
            console.log(`  viben task plan --name ${task} ...`);
          });
        } else {
          throw CliError.operationFailed("Set branch", "Failed to update task.json");
        }
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
        const taskDir = resolveTaskDirectory(task, repoRoot);

        if (!taskDir || !existsSync(join(taskDir, FILE_TASK_JSON))) {
          throw CliError.notFound("Task", task);
        }

        if (updateTaskField(taskDir, "base_branch", options.branch)) {
          output(ctx, successResponse({ task, base_branch: options.branch }), () => {
            console.log(chalk.green(`Base branch set to: ${options.branch}`));
            console.log(`  PR will target: ${options.branch}`);
          });
        } else {
          throw CliError.operationFailed("Set base branch", "Failed to update task.json");
        }
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // task set-scope
  taskCmd
    .command("set-scope")
    .description("Set scope for PR title")
    .argument("<task>", "Task name or directory")
    .requiredOption("-s, --scope <name>", "Scope name")
    .action(async (task: string, options: { scope: string }) => {
      const ctx = getContext(program);
      const cwd = process.cwd();

      try {
        const repoRoot = ensureVibenDirWithRoot(cwd);
        const taskDir = resolveTaskDirectory(task, repoRoot);

        if (!taskDir || !existsSync(join(taskDir, FILE_TASK_JSON))) {
          throw CliError.notFound("Task", task);
        }

        if (updateTaskField(taskDir, "scope", options.scope)) {
          output(ctx, successResponse({ task, scope: options.scope }), () => {
            console.log(chalk.green(`Scope set to: ${options.scope}`));
          });
        } else {
          throw CliError.operationFailed("Set scope", "Failed to update task.json");
        }
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
        const taskDir = resolveTaskDirectory(task, repoRoot);

        if (!taskDir || !existsSync(join(taskDir, FILE_TASK_JSON))) {
          throw CliError.notFound("Task", task);
        }

        if (updateTaskField(taskDir, "agent", options.agent)) {
          output(ctx, successResponse({ task, agent: options.agent }), () => {
            outputSuccess(ctx, `Set agent "${options.agent}" for task "${task}"`);
          });
        } else {
          throw CliError.operationFailed("Set agent", "Failed to update task.json");
        }
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
    .description("Initialize context files for task")
    .argument("<task>", "Task name or directory")
    .requiredOption("-t, --type <type>", "Dev type (frontend, backend, fullstack, test, docs)")
    .action(async (task: string, options: { type: string }) => {
      const ctx = getContext(program);
      const cwd = process.cwd();

      try {
        const repoRoot = ensureVibenDirWithRoot(cwd);
        const taskDir = resolveTaskDirectory(task, repoRoot);

        if (!taskDir || !existsSync(taskDir)) {
          throw CliError.notFound("Task", task);
        }

        const devType = options.type;
        const validTypes = ["backend", "frontend", "fullstack", "test", "docs"];
        if (!validTypes.includes(devType)) {
          throw CliError.invalidArgument("type", `Must be one of: ${validTypes.join(", ")}`);
        }

        console.log(chalk.blue("=== Initializing Agent Context Files ==="));
        console.log(`Target dir: ${taskDir}`);
        console.log(`Dev type: ${devType}`);
        console.log();

        // implement.jsonl
        console.log(chalk.cyan("Creating implement.jsonl..."));
        const implementEntries: ContextEntry[] = [
          { file: `${DIR_VIBEN}/workflow.md`, reason: "Project workflow and conventions" },
        ];

        if (devType === "backend" || devType === "test" || devType === "fullstack") {
          implementEntries.push({
            file: `${DIR_VIBEN}/${DIR_SPEC}/backend/index.md`,
            reason: "Backend development guide",
          });
        }
        if (devType === "frontend" || devType === "fullstack") {
          implementEntries.push({
            file: `${DIR_VIBEN}/${DIR_SPEC}/frontend/index.md`,
            reason: "Frontend development guide",
          });
        }

        const implementFile = join(taskDir, "implement.jsonl");
        writeJsonlFile(implementFile, implementEntries as unknown as Array<Record<string, unknown>>);
        console.log(`  ${chalk.green("OK")} ${implementEntries.length} entries`);

        // check.jsonl
        console.log(chalk.cyan("Creating check.jsonl..."));
        const checkEntries: ContextEntry[] = [
          { file: ".claude/commands/viben/finish-work.md", reason: "Finish work checklist" },
        ];
        if (devType === "backend" || devType === "fullstack") {
          checkEntries.push({
            file: ".claude/commands/viben/check-backend.md",
            reason: "Backend check spec",
          });
        }
        if (devType === "frontend" || devType === "fullstack") {
          checkEntries.push({
            file: ".claude/commands/viben/check-frontend.md",
            reason: "Frontend check spec",
          });
        }

        const checkFile = join(taskDir, "check.jsonl");
        writeJsonlFile(checkFile, checkEntries as unknown as Array<Record<string, unknown>>);
        console.log(`  ${chalk.green("OK")} ${checkEntries.length} entries`);

        // debug.jsonl
        console.log(chalk.cyan("Creating debug.jsonl..."));
        const debugEntries: ContextEntry[] = [];
        if (devType === "backend" || devType === "fullstack") {
          debugEntries.push({
            file: ".claude/commands/viben/check-backend.md",
            reason: "Backend check spec",
          });
        }
        if (devType === "frontend" || devType === "fullstack") {
          debugEntries.push({
            file: ".claude/commands/viben/check-frontend.md",
            reason: "Frontend check spec",
          });
        }

        const debugFile = join(taskDir, "debug.jsonl");
        writeJsonlFile(debugFile, debugEntries as unknown as Array<Record<string, unknown>>);
        console.log(`  ${chalk.green("OK")} ${debugEntries.length} entries`);

        // Update task.json with dev_type
        updateTaskField(taskDir, "dev_type", devType);

        console.log();
        console.log(chalk.green("OK All context files created"));
        console.log();
        console.log(chalk.blue("Next steps:"));
        console.log("  1. Add task-specific specs: viben task add-context <task> <path>");
        console.log("  2. Set as current: viben task start <task>");
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
        const taskDir = resolveTaskDirectory(task, repoRoot);

        if (!taskDir || !existsSync(taskDir)) {
          throw CliError.notFound("Task", task);
        }

        const implementFile = join(taskDir, "implement.jsonl");
        const reason = options.reason || "Added by user";

        let addedCount = 0;
        for (const file of files) {
          // Skip if already exists
          if (jsonlEntryExists(implementFile, file)) {
            console.log(chalk.yellow(`Skipped (exists): ${file}`));
            continue;
          }

          // Determine type
          let type: "file" | "directory" | undefined;
          const fullPath = join(repoRoot, file);
          if (existsSync(fullPath)) {
            type = statSync(fullPath).isDirectory() ? "directory" : "file";
          }

          const entry: ContextEntry = { file, reason };
          if (type) {
            entry.type = type;
          }

          appendToJsonl(implementFile, entry as unknown as Record<string, unknown>);
          console.log(chalk.green(`Added: ${file}`));
          addedCount++;
        }

        output(ctx, successResponse({ added: addedCount, total: files.length }), () => {
          console.log();
          console.log(chalk.blue(`Added ${addedCount}/${files.length} file(s) to implement.jsonl`));
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
        const taskDir = resolveTaskDirectory(task, repoRoot);

        if (!taskDir) {
          throw CliError.notFound("Task", task);
        }

        for (const jsonlName of ["implement.jsonl", "check.jsonl", "debug.jsonl"]) {
          const jsonlPath = join(taskDir, jsonlName);
          if (!existsSync(jsonlPath)) continue;

          const content = readFileSync(jsonlPath, "utf-8");
          const lines = content.split("\n").filter((line) => {
            if (!line.trim()) return false;
            try {
              const entry = JSON.parse(line);
              return !files.includes(entry.file);
            } catch {
              return true;
            }
          });

          writeFileSync(jsonlPath, lines.join("\n") + "\n", "utf-8");
        }

        output(ctx, successResponse({ removed: files }), () => {
          outputSuccess(ctx, `Removed ${files.length} context file(s) from task "${task}"`);
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
        const taskDir = resolveTaskDirectory(task, repoRoot);

        if (!taskDir || !existsSync(taskDir)) {
          throw CliError.notFound("Task", task);
        }

        const contextFiles = ["implement.jsonl", "check.jsonl", "debug.jsonl"];
        const result: Record<string, ContextEntry[]> = {};

        for (const fileName of contextFiles) {
          const filePath = join(taskDir, fileName);
          if (existsSync(filePath)) {
            result[fileName] = readJsonlFile(filePath) as unknown as ContextEntry[];
          }
        }

        output(ctx, successResponse(result), () => {
          console.log(chalk.blue(`Context entries for task: ${task}`));
          console.log();

          for (const [fileName, entries] of Object.entries(result)) {
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
        const taskDir = resolveTaskDirectory(task, repoRoot);

        if (!taskDir || !existsSync(taskDir)) {
          throw CliError.notFound("Task", task);
        }

        const contextFiles = ["implement.jsonl", "check.jsonl", "debug.jsonl"];
        const missing: string[] = [];
        const valid: string[] = [];

        for (const fileName of contextFiles) {
          const filePath = join(taskDir, fileName);
          if (!existsSync(filePath)) continue;

          const entries = readJsonlFile(filePath) as unknown as ContextEntry[];
          for (const entry of entries) {
            const fullPath = join(repoRoot, entry.file);
            if (existsSync(fullPath)) {
              valid.push(entry.file);
            } else {
              missing.push(entry.file);
            }
          }
        }

        const success = missing.length === 0;

        output(ctx, successResponse({ valid: valid.length, missing }), () => {
          console.log(chalk.blue(`Validating context files for task: ${task}`));
          console.log();

          if (success) {
            console.log(chalk.green(`All ${valid.length} referenced files exist.`));
          } else {
            console.log(chalk.yellow(`Found ${missing.length} missing file(s):`));
            for (const file of missing) {
              console.log(chalk.red(`  - ${file}`));
            }
            console.log();
            console.log(chalk.gray(`Valid: ${valid.length}, Missing: ${missing.length}`));
          }
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // ============================================================================
  // Planning & Monitoring Commands
  // ============================================================================

  // task plan
  taskCmd
    .command("plan")
    .description("Start Plan Agent to plan a task")
    .requiredOption("-n, --name <name>", "Task name")
    .requiredOption("-t, --type <type>", "Dev type (backend, frontend, fullstack)")
    .requiredOption("-r, --requirement <text>", "Requirement description")
    .option("-p, --platform <platform>", "Platform (claude, cursor, iflow, opencode)", "claude")
    .action(async (options: {
      name: string;
      type: string;
      requirement: string;
      platform?: string;
    }) => {
      const ctx = getContext(program);
      const cwd = process.cwd();

      try {
        const repoRoot = ensureVibenDirWithRoot(cwd);
        const taskName = options.name;
        const devType = options.type;
        const requirement = options.requirement;
        const platform = options.platform || "claude";

        // Validate dev type
        if (!["backend", "frontend", "fullstack"].includes(devType)) {
          throw CliError.invalidArgument(
            "type",
            "Must be: backend, frontend, fullstack"
          );
        }

        // Initialize CLI adapter
        const adapter = getCLIAdapter(platform);

        // Check plan agent exists
        const planMdPath = adapter.getAgentPath("plan", repoRoot);
        if (!existsSync(planMdPath)) {
          throw CliError.operationFailed(
            "Plan",
            `Plan agent not found at ${planMdPath}. Platform: ${platform}`
          );
        }

        // Check developer is initialized
        const developer = getDeveloper(repoRoot);
        if (!developer) {
          throw CliError.operationFailed(
            "Plan",
            "Developer not initialized. Run 'viben team init-developer' first."
          );
        }

        console.log();
        console.log(chalk.blue("=== Multi-Agent Pipeline: Plan ==="));
        console.log(chalk.cyan("[INFO]"), `Task: ${taskName}`);
        console.log(chalk.cyan("[INFO]"), `Type: ${devType}`);
        console.log(chalk.cyan("[INFO]"), `Requirement: ${requirement}`);
        console.log();

        // Step 1: Create task directory
        console.log(chalk.cyan("[INFO]"), "Step 1: Creating task directory...");

        const tasksDir = ensureTasksDir(repoRoot);
        const datePrefix = getDatePrefix();
        const dirName = `${datePrefix}-${taskName}`;
        const taskDir = join(tasksDir, dirName);

        if (!existsSync(taskDir)) {
          mkdirSync(taskDir, { recursive: true });
        }

        // Get current branch as base_branch
        const { stdout: branchOut } = runGitCommand(["branch", "--show-current"], repoRoot);
        const currentBranch = branchOut.trim() || "main";
        const today = getTodayDate();

        const taskData: TaskJson = {
          id: taskName,
          name: taskName,
          title: requirement,
          description: "",
          status: "backlog",
          dev_type: devType,
          scope: undefined,
          priority: "P2",
          creator: developer,
          assignee: developer,
          createdAt: today,
          completedAt: undefined,
          branch: undefined,
          base_branch: currentBranch,
          worktree_path: undefined,
          current_phase: 0,
          next_action: [
            { phase: 1, action: "implement" },
            { phase: 2, action: "check" },
            { phase: 3, action: "finish" },
            { phase: 4, action: "create-pr" },
          ],
          commit: undefined,
          pr_url: undefined,
          subtasks: [],
          relatedFiles: [],
          notes: "",
          agent: undefined,
        };

        writeTaskJson(taskDir, taskData as unknown as Record<string, unknown>);

        const taskDirRel = `${DIR_VIBEN}/${DIR_TASKS}/${dirName}`;
        console.log(chalk.green("[SUCCESS]"), `Task directory: ${taskDirRel}`);

        // Step 2: Start Plan Agent in background
        console.log(chalk.cyan("[INFO]"), "Step 2: Starting Plan Agent in background...");

        const logFile = join(taskDir, ".plan-log");
        // Create empty log file
        writeFileSync(logFile, "", "utf-8");

        // Build environment
        const env = { ...process.env };
        env.PLAN_TASK_NAME = taskName;
        env.PLAN_DEV_TYPE = devType;
        env.PLAN_TASK_DIR = taskDirRel;
        env.PLAN_REQUIREMENT = requirement;
        Object.assign(env, adapter.getNonInteractiveEnv());

        // Build CLI command
        const cliCmd = adapter.buildRunCommand({
          agent: "plan",
          prompt: `Start planning for task: ${taskName}`,
          skipPermissions: true,
          verbose: true,
          jsonOutput: true,
        });

        // Open log file for writing
        const logFd = openSync(logFile, "w");

        // Spawn background process
        const spawnOpts: SpawnOptions = {
          cwd: repoRoot,
          env,
          stdio: ["ignore", logFd, logFd],
          detached: true,
        };

        const child = spawn(cliCmd[0], cliCmd.slice(1), spawnOpts);
        child.unref();

        const agentPid = child.pid || 0;
        console.log(chalk.green("[SUCCESS]"), `Plan Agent started (PID: ${agentPid})`);

        // Register agent in registry
        registryAddAgent(
          {
            agentId: `plan-${taskName}`,
            worktreePath: repoRoot,
            pid: agentPid,
            taskDir: taskDirRel,
            platform,
          },
          repoRoot
        );

        // Summary
        console.log();
        console.log(chalk.green("=== Plan Agent Running ==="));
        console.log();
        console.log(`  Task:  ${taskName}`);
        console.log(`  Type:  ${devType}`);
        console.log(`  Dir:   ${taskDirRel}`);
        console.log(`  Log:   ${logFile}`);
        console.log(`  PID:   ${agentPid}`);
        console.log();
        console.log(chalk.yellow("To monitor:"));
        console.log(`  tail -f ${logFile}`);
        console.log();
        console.log(chalk.yellow("To check status:"));
        console.log(`  ps -p ${agentPid}`);
        console.log(`  viben task status ${taskName}`);
        console.log();

      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // task status (with subcommand behavior)
  taskCmd
    .command("status")
    .description("Show task status")
    .argument("[task]", "Specific task to show (shows all if not specified)")
    .option("-a, --assignee <dev>", "Filter by assignee")
    .option("-s, --status <status>", "Filter by status (planning, in_progress, completed)")
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
    .argument("[task]", "Task name or directory (uses current task if not specified)")
    .option("--dry-run", "Show what would be done without making changes")
    .action(async (task: string | undefined, options: { dryRun?: boolean }) => {
      const ctx = getContext(program);
      const cwd = process.cwd();

      try {
        const repoRoot = ensureVibenDirWithRoot(cwd);
        const dryRun = options.dryRun || false;

        // Get task directory
        let targetDir = task;
        if (!targetDir) {
          const currentTask = getCurrentTask(repoRoot);
          if (currentTask) {
            targetDir = currentTask;
          }
        }

        if (!targetDir) {
          throw CliError.operationFailed(
            "Create PR",
            "No task directory specified and no current task set"
          );
        }

        // Resolve path
        const taskDirPath = targetDir.startsWith("/")
          ? targetDir
          : join(repoRoot, targetDir);

        const taskJsonPath = join(taskDirPath, FILE_TASK_JSON);
        if (!existsSync(taskJsonPath)) {
          throw CliError.notFound("Task", targetDir);
        }

        console.log(chalk.blue("=== Create PR ==="));
        if (dryRun) {
          console.log(chalk.yellow("[DRY-RUN MODE] No actual changes will be made"));
        }
        console.log();

        // Read task config
        const taskData = readTaskJsonFromWorkspace(taskDirPath);
        if (!taskData) {
          throw CliError.operationFailed("Create PR", "Failed to read task.json");
        }

        const taskName = (taskData.name as string) || "";
        const baseBranch = (taskData.base_branch as string) || "main";
        const scope = (taskData.scope as string) || "core";
        const devType = (taskData.dev_type as string) || "feature";

        // Map dev_type to commit prefix
        const prefixMap: Record<string, string> = {
          feature: "feat",
          frontend: "feat",
          backend: "feat",
          fullstack: "feat",
          bugfix: "fix",
          fix: "fix",
          refactor: "refactor",
          docs: "docs",
          test: "test",
        };
        const commitPrefix = prefixMap[devType] || "feat";

        console.log(`Task: ${taskName}`);
        console.log(`Base branch: ${baseBranch}`);
        console.log(`Scope: ${scope}`);
        console.log(`Commit prefix: ${commitPrefix}`);
        console.log();

        // Get current branch
        const { stdout: branchOut } = runGitCommand(["branch", "--show-current"], repoRoot);
        const currentBranch = branchOut.trim();
        console.log(`Current branch: ${currentBranch}`);

        // Check for changes
        console.log(chalk.yellow("Checking for changes..."));

        // Stage changes
        runGitCommand(["add", "-A"], repoRoot);

        // Exclude workspace and temp files
        runGitCommand(["reset", `${DIR_VIBEN}/workspace/`], repoRoot);
        runGitCommand(["reset", ".agent-log", ".session-id"], repoRoot);

        // Check if there are staged changes
        const { code: diffCode } = runGitCommand(["diff", "--cached", "--quiet"], repoRoot);
        const hasStagedChanges = diffCode !== 0;

        if (!hasStagedChanges) {
          console.log(chalk.yellow("No staged changes to commit"));

          // Check for unpushed commits
          const { stdout: logOut } = runGitCommand(
            ["log", `origin/${currentBranch}..HEAD`, "--oneline"],
            repoRoot
          );
          const unpushed = logOut.split("\n").filter((line) => line.trim()).length;

          if (unpushed === 0) {
            if (dryRun) {
              runGitCommand(["reset", "HEAD"], repoRoot);
            }
            throw CliError.operationFailed("Create PR", "No changes to create PR");
          }

          console.log(`Found ${unpushed} unpushed commit(s)`);
        } else {
          // Commit changes
          console.log(chalk.yellow("Committing changes..."));
          const commitMsg = `${commitPrefix}(${scope}): ${taskName}`;

          if (dryRun) {
            console.log(`[DRY-RUN] Would commit with message: ${commitMsg}`);
            const { stdout: stagedOut } = runGitCommand(["diff", "--cached", "--name-only"], repoRoot);
            console.log("[DRY-RUN] Staged files:");
            for (const line of stagedOut.split("\n")) {
              if (line.trim()) {
                console.log(`  - ${line}`);
              }
            }
          } else {
            runGitCommand(["commit", "-m", commitMsg], repoRoot);
            console.log(chalk.green(`Committed: ${commitMsg}`));
          }
        }

        // Push to remote
        console.log(chalk.yellow("Pushing to remote..."));
        if (dryRun) {
          console.log(`[DRY-RUN] Would push to: origin/${currentBranch}`);
        } else {
          const { code: pushCode, stderr: pushErr } = runGitCommand(
            ["push", "-u", "origin", currentBranch],
            repoRoot
          );
          if (pushCode !== 0) {
            throw CliError.operationFailed("Create PR", `Failed to push: ${pushErr}`);
          }
          console.log(chalk.green(`Pushed to origin/${currentBranch}`));
        }

        // Create PR
        console.log(chalk.yellow("Creating PR..."));
        const prTitle = `${commitPrefix}(${scope}): ${taskName}`;
        let prUrl = "";

        if (dryRun) {
          console.log("[DRY-RUN] Would create PR:");
          console.log(`  Title: ${prTitle}`);
          console.log(`  Base:  ${baseBranch}`);
          console.log(`  Head:  ${currentBranch}`);
          const prdFile = join(taskDirPath, "prd.md");
          if (existsSync(prdFile)) {
            console.log("  Body:  (from prd.md)");
          }
          prUrl = "https://github.com/example/repo/pull/DRY-RUN";
        } else {
          // Check if PR already exists
          try {
            const existingPrResult = execSync(
              `gh pr list --head "${currentBranch}" --base "${baseBranch}" --json url --jq ".[0].url"`,
              { cwd: repoRoot, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }
            ).trim();

            if (existingPrResult) {
              console.log(chalk.yellow(`PR already exists: ${existingPrResult}`));
              prUrl = existingPrResult;
            }
          } catch {
            // No existing PR
          }

          if (!prUrl) {
            // Read PRD as PR body
            let prBody = "";
            const prdFile = join(taskDirPath, "prd.md");
            if (existsSync(prdFile)) {
              prBody = readFileSync(prdFile, "utf-8");
            }

            try {
              const createPrResult = execSync(
                `gh pr create --draft --base "${baseBranch}" --title "${prTitle}" --body "${prBody.replace(/"/g, '\\"')}"`,
                { cwd: repoRoot, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }
              ).trim();

              prUrl = createPrResult;
              console.log(chalk.green(`PR created: ${prUrl}`));
            } catch (err) {
              const error = err as { stderr?: string };
              throw CliError.operationFailed("Create PR", `Failed to create PR: ${error.stderr || "Unknown error"}`);
            }
          }
        }

        // Update task.json
        console.log(chalk.yellow("Updating task status..."));
        if (dryRun) {
          console.log("[DRY-RUN] Would update task.json:");
          console.log("  status: pr_created");
          console.log(`  pr_url: ${prUrl}`);
          console.log("  current_phase: (set to create-pr phase)");
        } else {
          // Get phase number for create-pr action
          let createPrPhase = getPhaseForAction(taskJsonPath, "create-pr");
          if (!createPrPhase) {
            createPrPhase = 4; // Default fallback
          }

          updateTaskField(taskDirPath, "status", "pr_created");
          updateTaskField(taskDirPath, "pr_url", prUrl);
          updateTaskField(taskDirPath, "current_phase", createPrPhase);

          console.log(chalk.green(`Task status updated to 'pr_created', phase ${createPrPhase}`));
        }

        // In dry-run, reset staging area
        if (dryRun) {
          runGitCommand(["reset", "HEAD"], repoRoot);
        }

        console.log();
        console.log(chalk.green("=== PR Created Successfully ==="));
        console.log(`PR URL: ${prUrl}`);

      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // task context
  taskCmd
    .command("context")
    .description("Get session context for AI agents")
    .option("-j, --json", "Output in JSON format")
    .action(async (options: { json?: boolean }) => {
      const ctx = getContext(program);
      if (options.json) {
        ctx.json = true;
      }

      const cwd = process.cwd();

      try {
        const repoRoot = ensureVibenDirWithRoot(cwd);

        if (ctx.json) {
          const contextData = getContextJson(repoRoot);
          output(ctx, successResponse(contextData), () => {
            // JSON output handled by output()
          });
        } else {
          const contextText = getContextText(repoRoot);
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
            targetFile = createNewJournalFileSync(
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
            targetFile = createNewJournalFileSync(devDir, targetNum, developer, today, 0);
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
}

// =============================================================================
// Add Session Command Helpers
// =============================================================================

/**
 * Get the latest journal file info from workspace directory
 * Returns: { file: path | null, number: number, lines: number }
 */
function getLatestJournalInfo(devDir: string): {
  file: string | null;
  number: number;
  lines: number;
} {
  if (!existsSync(devDir)) {
    return { file: null, number: 0, lines: 0 };
  }

  let latestFile: string | null = null;
  let latestNum = -1;

  try {
    const files = readdirSync(devDir);
    for (const file of files) {
      if (file.startsWith("journal-") && file.endsWith(".md")) {
        const match = file.match(/journal-(\d+)\.md$/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > latestNum) {
            latestNum = num;
            latestFile = join(devDir, file);
          }
        }
      }
    }
  } catch {
    // Ignore errors
  }

  if (latestFile) {
    let lines = 0;
    try {
      const content = readFileSync(latestFile, "utf-8");
      const splitLines = content.split("\n");
      // Match Python's splitlines() behavior - don't count trailing empty line
      if (splitLines.length > 0 && splitLines[splitLines.length - 1] === "") {
        lines = splitLines.length - 1;
      } else {
        lines = splitLines.length;
      }
    } catch {
      // Ignore errors
    }
    return { file: latestFile, number: latestNum, lines };
  }

  return { file: null, number: 0, lines: 0 };
}

/**
 * Get current session number from index.md by parsing "Total Sessions" line
 */
function getSessionNumberFromIndex(indexPath: string): number {
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
 */
function generateSessionMarkdown(params: {
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
 * Create a new journal file when current one exceeds MAX_LINES
 */
function createNewJournalFileSync(
  devDir: string,
  number: number,
  developer: string,
  date: string,
  prevNumber: number
): string {
  const newFilePath = join(devDir, `journal-${number}.md`);
  const maxLines = 2000;

  const content = `# Journal - ${developer} (Part ${number})

> Continuation from \`journal-${prevNumber}.md\` (archived at ~${maxLines} lines)
> Started: ${date}

---

`;

  writeFileSync(newFilePath, content, "utf-8");
  return newFilePath;
}

/**
 * Count journal files and return markdown table rows
 */
function countJournalFilesTable(devDir: string, activeNum: number): string {
  const activeFile = `journal-${activeNum}.md`;
  const resultLines: string[] = [];

  try {
    const files = readdirSync(devDir)
      .filter((f) => f.startsWith("journal-") && f.endsWith(".md"))
      .sort((a, b) => {
        const numA = parseInt(a.match(/(\d+)/)?.[1] ?? "0", 10);
        const numB = parseInt(b.match(/(\d+)/)?.[1] ?? "0", 10);
        return numB - numA; // Descending order
      });

    for (const filename of files) {
      const filePath = join(devDir, filename);
      let lines = 0;
      try {
        const content = readFileSync(filePath, "utf-8");
        const splitLines = content.split("\n");
        if (splitLines.length > 0 && splitLines[splitLines.length - 1] === "") {
          lines = splitLines.length - 1;
        } else {
          lines = splitLines.length;
        }
      } catch {
        // Ignore errors
      }
      const status = filename === activeFile ? "Active" : "Archived";
      resultLines.push(`| \`${filename}\` | ~${lines} | ${status} |`);
    }
  } catch {
    // Ignore errors
  }

  return resultLines.join("\n");
}

/**
 * Update index.md with new session info
 * Processes sections marked with @@@auto markers
 */
function updateIndexWithNewSession(params: {
  indexPath: string;
  devDir: string;
  sessionNum: number;
  title: string;
  commit: string;
  activeFile: string;
  date: string;
}): boolean {
  const { indexPath, devDir, sessionNum, title, commit, activeFile, date } =
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
  const filesTable = countJournalFilesTable(devDir, activeNum);

  try {
    const content = readFileSync(indexPath, "utf-8");

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
        if (/^\|\s*-/.test(line) && !headerWritten) {
          newLines.push(`| ${sessionNum} | ${date} | ${title} | ${commitDisplay} |`);
          headerWritten = true;
        }
        continue;
      }

      newLines.push(line);
    }

    writeFileSync(indexPath, newLines.join("\n"), "utf-8");
    return true;
  } catch {
    return false;
  }
}

// =============================================================================
// Status Command Helpers
// =============================================================================

/**
 * Get last tool call from agent log
 */
function getLastTool(logFile: string, platform: string = "claude"): string | null {
  if (!existsSync(logFile)) {
    return null;
  }

  try {
    const content = readFileSync(logFile, "utf-8");
    const lines = content.split("\n").slice(-100);

    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i];
      if (!line.trim()) continue;

      try {
        const data = JSON.parse(line);

        if (platform === "opencode") {
          if (data.type === "tool_use") {
            return data.tool;
          }
        } else {
          if (data.type === "assistant") {
            const content = data.message?.content || [];
            for (const item of content) {
              if (item.type === "tool_use") {
                return item.name;
              }
            }
          }
        }
      } catch {
        continue;
      }
    }
  } catch {
    // Ignore errors
  }

  return null;
}

/**
 * Get last assistant message from agent log
 */
function getLastMessage(logFile: string, maxLen: number = 100, platform: string = "claude"): string | null {
  if (!existsSync(logFile)) {
    return null;
  }

  try {
    const content = readFileSync(logFile, "utf-8");
    const lines = content.split("\n").slice(-100);

    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i];
      if (!line.trim()) continue;

      try {
        const data = JSON.parse(line);

        if (platform === "opencode") {
          if (data.type === "text" && data.text) {
            return data.text.slice(0, maxLen);
          }
        } else {
          if (data.type === "assistant") {
            const content = data.message?.content || [];
            for (const item of content) {
              if (item.type === "text" && item.text) {
                return item.text.slice(0, maxLen);
              }
            }
          }
        }
      } catch {
        continue;
      }
    }
  } catch {
    // Ignore errors
  }

  return null;
}

/**
 * Count modified files in a directory
 */
function countModifiedFiles(worktree: string): number {
  if (!existsSync(worktree)) {
    return 0;
  }

  try {
    const { stdout } = runGitCommand(["status", "--short"], worktree);
    return stdout.split("\n").filter((line) => line.trim()).length;
  } catch {
    return 0;
  }
}

/**
 * Format status with color
 * Uses unified status values: backlog, queue, in_progress, ai_review, human_review, done, pr_created, error
 */
function statusColor(status: string): string {
  switch (status) {
    // Completed states
    case "done":
    case "pr_created":
    case "completed": // Legacy
      return chalk.green(status);
    // In-progress states
    case "in_progress":
    case "ai_review":
    case "queue":
      return chalk.blue(status);
    // Waiting states
    case "backlog":
    case "human_review":
    case "planning": // Legacy
      return chalk.yellow(status);
    // Error state
    case "error":
      return chalk.red(status);
    default:
      return chalk.gray(status);
  }
}

/**
 * Status summary filter options
 */
interface StatusSummaryOptions {
  filterAssignee?: string;
  filterStatus?: string;
  onlyRunning?: boolean;
}

/**
 * Show summary of all tasks
 */
function cmdStatusSummary(repoRoot: string, options: StatusSummaryOptions = {}, ctx?: OutputContext): void {
  const { filterAssignee, filterStatus, onlyRunning } = options;
  const tasksDir = getTasksDir(repoRoot);
  if (!existsSync(tasksDir)) {
    console.log("No tasks directory found");
    return;
  }

  // Count running agents
  const agents = registryListAgents(repoRoot);
  let runningCount = 0;
  for (const agent of agents) {
    if (isProcessRunning(agent.pid)) {
      runningCount++;
    }
  }

  // Task queue stats
  const taskStats = getTaskStats(repoRoot);

  console.log(chalk.blue("=== Multi-Agent Status ==="));
  console.log(`  Agents:  ${chalk.green(String(runningCount))} running / ${agents.length} registered`);
  console.log(`  Tasks:   ${formatTaskStats(taskStats)}`);
  console.log();

  // Process tasks
  interface RunningTask {
    name: string;
    priority: string;
    assignee: string;
    phaseInfo: string;
    elapsed: string;
    branch: string;
    modified: number;
    lastTool: string | null;
    pid: number;
  }

  interface StoppedTask {
    name: string;
    worktree: string;
    status: string;
    sessionIdFile: string;
    logFile: string;
    platform: string;
  }

  interface RegularTask {
    name: string;
    status: string;
    priority: string;
    assignee: string;
  }

  const runningTasks: RunningTask[] = [];
  const stoppedTasks: StoppedTask[] = [];
  const regularTasks: RegularTask[] = [];

  const tasks = getActiveTasks(repoRoot);

  for (const t of tasks) {
    const name = t.dir;
    const status = t.status;
    const assignee = t.assignee;
    const priority = t.priority;

    // Filter by assignee
    if (filterAssignee && assignee !== filterAssignee) {
      continue;
    }

    // Filter by status
    if (filterStatus && status !== filterStatus) {
      continue;
    }

    // Check agent status
    const agent = registrySearchAgent(name, repoRoot);

    // If --running flag is set, skip tasks without running agents
    if (onlyRunning && (!agent || !isProcessRunning(agent.pid))) {
      continue;
    }

    if (agent) {
      const pid = agent.pid;
      const worktree = agent.worktree_path;
      const started = agent.started_at;
      const agentPlatform = agent.platform || "claude";

      if (isProcessRunning(pid)) {
        // Running agent
        const taskJsonPath = join(tasksDir, name, FILE_TASK_JSON);
        const phaseInfoStr = getPhaseInfo(taskJsonPath);
        const elapsed = calcElapsed(started);
        const modified = countModifiedFiles(worktree);

        const taskData = readTaskJsonFromWorkspace(join(tasksDir, name));
        const branch = (taskData?.branch as string) || "N/A";

        const logFile = join(worktree, ".agent-log");
        const lastTool = getLastTool(logFile, agentPlatform);

        runningTasks.push({
          name,
          priority,
          assignee,
          phaseInfo: phaseInfoStr,
          elapsed,
          branch,
          modified,
          lastTool,
          pid,
        });
      } else {
        // Stopped agent
        const sessionIdFile = join(worktree, ".session-id");
        const logFile = join(worktree, ".agent-log");

        stoppedTasks.push({
          name,
          worktree,
          status,
          sessionIdFile,
          logFile,
          platform: agentPlatform,
        });
      }
    } else {
      // Regular task
      regularTasks.push({ name, status, priority, assignee });
    }
  }

  // Output running agents
  if (runningTasks.length > 0) {
    console.log(chalk.cyan("Running Agents:"));
    for (const t of runningTasks) {
      const priorityColor = t.priority === "P0" ? chalk.red : t.priority === "P1" ? chalk.yellow : chalk.blue;
      console.log(
        `${chalk.green("▶")} ${chalk.cyan(t.name)} ${chalk.green("[running]")} ${priorityColor(`[${t.priority}]`)} @${t.assignee}`
      );
      console.log(`  Phase:    ${t.phaseInfo}`);
      console.log(`  Elapsed:  ${t.elapsed}`);
      console.log(`  Branch:   ${chalk.gray(t.branch)}`);
      console.log(`  Modified: ${t.modified} file(s)`);
      if (t.lastTool) {
        console.log(`  Activity: ${chalk.yellow(t.lastTool)}`);
      }
      console.log(`  PID:      ${chalk.gray(String(t.pid))}`);
      console.log();
    }
  }

  // Output stopped agents
  if (stoppedTasks.length > 0) {
    console.log(chalk.red("Stopped Agents:"));
    for (const t of stoppedTasks) {
      // Check for completed states (done, pr_created, or legacy "completed")
      if (t.status === "done" || t.status === "pr_created" || t.status === "completed") {
        console.log(`${chalk.green("✓")} ${t.name} ${chalk.green(`[${t.status}]`)}`);
      } else {
        if (existsSync(t.sessionIdFile)) {
          const sessionId = readFileSync(t.sessionIdFile, "utf-8").trim();
          const lastMsg = getLastMessage(t.logFile, 150, t.platform);
          console.log(`${chalk.red("○")} ${t.name} ${chalk.red("[stopped]")}`);
          if (lastMsg) {
            console.log(`${chalk.gray(`"${lastMsg}"`)}`);
          }
          const adapter = getCLIAdapter(t.platform);
          const resumeCmd = adapter.getResumeCommandStr(sessionId, t.worktree);
          console.log(chalk.yellow(resumeCmd));
        } else {
          console.log(`${chalk.red("○")} ${t.name} ${chalk.red("[stopped]")} ${chalk.gray("(no session-id)")}`);
        }
      }
      console.log();
    }
  }

  // Separator
  if ((runningTasks.length > 0 || stoppedTasks.length > 0) && regularTasks.length > 0) {
    console.log(chalk.gray("───────────────────────────────────────"));
    console.log();
  }

  // Output regular tasks grouped by assignee
  if (regularTasks.length > 0) {
    // Sort by assignee, priority, status
    regularTasks.sort((a, b) => {
      const assigneeCompare = a.assignee.localeCompare(b.assignee);
      if (assigneeCompare !== 0) return assigneeCompare;

      const priorityOrder: Record<string, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };
      const priorityCompare = (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2);
      if (priorityCompare !== 0) return priorityCompare;

      const statusOrder: Record<string, number> = { in_progress: 0, planning: 1, completed: 2 };
      return (statusOrder[a.status] || 1) - (statusOrder[b.status] || 1);
    });

    let currentAssignee: string | null = null;
    for (const t of regularTasks) {
      if (t.assignee !== currentAssignee) {
        if (currentAssignee !== null) {
          console.log();
        }
        console.log(chalk.cyan(`@${t.assignee}:`));
        currentAssignee = t.assignee;
      }

      const priorityColor = t.priority === "P0" ? chalk.red : t.priority === "P1" ? chalk.yellow : chalk.blue;
      console.log(`  ${statusColor(t.status).slice(0, 1)} ${t.name} (${t.status}) ${priorityColor(`[${t.priority}]`)}`);
    }
  }

  if (runningTasks.length > 0) {
    console.log();
    console.log(chalk.gray("─────────────────────────────────────"));
    console.log(chalk.gray("Use --detail <name> for more info"));
  }

  console.log();
}

/**
 * List worktrees and agents
 */
function cmdStatusList(repoRoot: string, ctx?: OutputContext): void {
  console.log(chalk.blue("=== Git Worktrees ==="));
  console.log();

  // Run git worktree list
  try {
    const { stdout } = runGitCommand(["worktree", "list"], repoRoot);
    if (stdout.trim()) {
      console.log(stdout);
    } else {
      console.log("  (no worktrees)");
    }
  } catch {
    console.log("  (failed to list worktrees)");
  }
  console.log();

  console.log(chalk.blue("=== Registered Agents ==="));
  console.log();

  const agents = registryListAgents(repoRoot);
  if (agents.length === 0) {
    console.log("  (no agents registered)");
    return;
  }

  for (const agent of agents) {
    const agentId = agent.id;
    const pid = agent.pid;
    const worktree = agent.worktree_path;
    const started = agent.started_at;

    const statusIcon = isProcessRunning(pid)
      ? chalk.green("●")
      : chalk.red("○");

    console.log(`  ${statusIcon} ${agentId} (PID: ${pid})`);
    console.log(`    ${chalk.gray(`Worktree: ${worktree}`)}`);
    console.log(`    ${chalk.gray(`Started:  ${started}`)}`);
    console.log();
  }
}

/**
 * Show detailed task status
 */
function cmdStatusDetail(target: string, repoRoot: string, ctx?: OutputContext): void {
  const agent = registrySearchAgent(target, repoRoot);
  if (!agent) {
    console.log(`Agent not found: ${target}`);
    return;
  }

  const agentId = agent.id;
  const pid = agent.pid;
  const worktree = agent.worktree_path;
  const taskDir = agent.task_dir;
  const started = agent.started_at;
  const platform = agent.platform || "claude";

  // Check for session-id
  let sessionId = "";
  const sessionIdFile = join(worktree, ".session-id");
  if (existsSync(sessionIdFile)) {
    sessionId = readFileSync(sessionIdFile, "utf-8").trim();
  }

  console.log(chalk.blue(`=== Agent Detail: ${agentId} ===`));
  console.log();
  console.log(`  ID:        ${agentId}`);
  console.log(`  PID:       ${pid}`);
  console.log(`  Session:   ${sessionId || "N/A"}`);
  console.log(`  Worktree:  ${worktree}`);
  console.log(`  Task Dir:  ${taskDir}`);
  console.log(`  Started:   ${started}`);
  console.log();

  // Status
  if (isProcessRunning(pid)) {
    console.log(`  Status:    ${chalk.green("Running")}`);
  } else {
    console.log(`  Status:    ${chalk.red("Stopped")}`);
    if (sessionId) {
      console.log();
      const adapter = getCLIAdapter(platform);
      const resumeCmd = adapter.getResumeCommandStr(sessionId, worktree);
      console.log(`  ${chalk.yellow("Resume:")} ${resumeCmd}`);
    }
  }

  // Task info
  const taskJsonPath = join(repoRoot, taskDir, FILE_TASK_JSON);
  if (existsSync(taskJsonPath)) {
    console.log();
    console.log(chalk.blue("=== Task Info ==="));
    console.log();
    const data = readTaskJsonFromWorkspace(join(repoRoot, taskDir));
    if (data) {
      console.log(`  Status:      ${data.status || "unknown"}`);
      console.log(`  Branch:      ${data.branch || "N/A"}`);
      console.log(`  Base Branch: ${data.base_branch || "N/A"}`);
    }
  }

  // Git changes
  if (existsSync(worktree)) {
    console.log();
    console.log(chalk.blue("=== Git Changes ==="));
    console.log();

    const { stdout: changes } = runGitCommand(["status", "--short"], worktree);
    if (changes.trim()) {
      const lines = changes.split("\n").filter((l) => l.trim());
      for (const line of lines.slice(0, 10)) {
        console.log(`  ${line}`);
      }
      if (lines.length > 10) {
        console.log(`  ... and ${lines.length - 10} more`);
      }
    } else {
      console.log("  (no changes)");
    }
  }

  console.log();
}

/**
 * Cross-platform tail follow implementation
 */
function tailFollow(filePath: string): void {
  const fs = require("node:fs");

  // Get initial file size
  let position = 0;
  try {
    const stats = fs.statSync(filePath);
    position = stats.size;
  } catch {
    // Start from beginning if file doesn't exist
  }

  // Poll for changes
  const pollInterval = setInterval(() => {
    try {
      const stats = fs.statSync(filePath);
      if (stats.size > position) {
        // Read new content
        const fd = fs.openSync(filePath, "r");
        const buffer = Buffer.alloc(stats.size - position);
        fs.readSync(fd, buffer, 0, buffer.length, position);
        fs.closeSync(fd);

        process.stdout.write(buffer.toString("utf-8"));
        position = stats.size;
      } else if (stats.size < position) {
        // File was truncated, start from beginning
        position = 0;
      }
    } catch {
      // File might have been deleted, continue polling
    }
  }, 100);

  // Handle cleanup
  process.on("SIGINT", () => {
    clearInterval(pollInterval);
    console.log();
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    clearInterval(pollInterval);
    process.exit(0);
  });
}

/**
 * Watch agent log in real-time
 */
function cmdStatusWatch(target: string, repoRoot: string, ctx?: OutputContext): void {
  const agent = registrySearchAgent(target, repoRoot);
  if (!agent) {
    console.log(`Agent not found: ${target}`);
    return;
  }

  const worktree = agent.worktree_path;
  const logFile = join(worktree, ".agent-log");

  if (!existsSync(logFile)) {
    console.log(`Log file not found: ${logFile}`);
    return;
  }

  console.log(chalk.blue("Watching:"), logFile);
  console.log(chalk.gray("Press Ctrl+C to stop"));
  console.log();

  // Use cross-platform tail follow
  tailFollow(logFile);
}

/**
 * Show recent log entries
 */
function cmdStatusLog(target: string, repoRoot: string, ctx?: OutputContext): void {
  const agent = registrySearchAgent(target, repoRoot);
  if (!agent) {
    console.log(`Agent not found: ${target}`);
    return;
  }

  const worktree = agent.worktree_path;
  const platform = agent.platform || "claude";
  const logFile = join(worktree, ".agent-log");

  if (!existsSync(logFile)) {
    console.log(`Log file not found: ${logFile}`);
    return;
  }

  console.log(chalk.blue(`=== Recent Log: ${target} ===`));
  console.log(chalk.gray(`Platform: ${platform}`));
  console.log();

  const content = readFileSync(logFile, "utf-8");
  const lines = content.split("\n").slice(-50);

  for (const line of lines) {
    if (!line.trim()) continue;

    try {
      const data = JSON.parse(line);
      const msgType = data.type || "";

      if (platform === "opencode") {
        // OpenCode format
        if (msgType === "text") {
          const text = data.text || "";
          if (text) {
            const display = text.slice(0, 300) + (text.length > 300 ? "..." : "");
            console.log(`${chalk.blue("[TEXT]")} ${display}`);
          }
        } else if (msgType === "tool_use") {
          const toolName = data.tool || "unknown";
          const status = data.state?.status || "";
          console.log(`${chalk.yellow("[TOOL]")} ${toolName} (${status})`);
        } else if (msgType === "step_start") {
          console.log(`${chalk.cyan("[STEP]")} Start`);
        } else if (msgType === "step_finish") {
          const reason = data.reason || "";
          console.log(`${chalk.cyan("[STEP]")} Finish (${reason})`);
        } else if (msgType === "error") {
          const errorMsg = data.message || "";
          console.log(`${chalk.red("[ERROR]")} ${errorMsg}`);
        }
      } else {
        // Claude Code format
        if (msgType === "system") {
          const subtype = data.subtype || "";
          console.log(`${chalk.cyan("[SYSTEM]")} ${subtype}`);
        } else if (msgType === "user") {
          const content = data.message?.content || "";
          if (content) {
            console.log(`${chalk.green("[USER]")} ${content.slice(0, 200)}`);
          }
        } else if (msgType === "assistant") {
          const content = data.message?.content || [];
          if (content.length > 0) {
            const item = content[0];
            const text = item.text;
            const tool = item.name;
            if (text) {
              const display = text.slice(0, 300) + (text.length > 300 ? "..." : "");
              console.log(`${chalk.blue("[ASSISTANT]")} ${display}`);
            } else if (tool) {
              console.log(`${chalk.yellow("[TOOL]")} ${tool}`);
            }
          }
        } else if (msgType === "result") {
          const toolName = data.tool || "unknown";
          console.log(`${chalk.gray("[RESULT]")} ${toolName} completed`);
        }
      }
    } catch {
      continue;
    }
  }
}

/**
 * Show agent registry
 */
function cmdStatusRegistry(repoRoot: string, ctx?: OutputContext): void {
  const registryFile = getRegistryFile(repoRoot);

  console.log(chalk.blue("=== Agent Registry ==="));
  console.log();
  console.log(`File: ${registryFile}`);
  console.log();

  if (registryFile && existsSync(registryFile)) {
    const content = readFileSync(registryFile, "utf-8");
    const data = JSON.parse(content);
    console.log(JSON.stringify(data, null, 2));
  } else {
    console.log("(registry not found)");
  }
}

// =============================================================================
// Context Command Types and Helpers
// =============================================================================

/**
 * Context JSON structure matching Python git_context.py get_context_json()
 */
interface ContextJson {
  developer: string;
  git: {
    branch: string;
    isClean: boolean;
    uncommittedChanges: number;
    recentCommits: Array<{ hash: string; message: string }>;
  };
  currentTask: {
    path: string;
    name: string;
    status: string;
    createdAt: string;
    description: string;
    hasPrd: boolean;
  } | null;
  tasks: {
    active: Array<{
      dir: string;
      name: string;
      status: string;
      assignee: string;
      priority: string;
    }>;
    directory: string;
  };
  myTasks: Array<{
    title: string;
    priority: string;
    status: string;
  }>;
  journal: {
    file: string;
    lines: number;
    nearLimit: boolean;
  };
  paths: {
    workspace: string;
    tasks: string;
    spec: string;
  };
}

/**
 * Get context as JSON object
 */
function getContextJson(repoRoot: string): ContextJson {
  const developer = getDeveloper(repoRoot) || "";
  const tasksDir = getTasksDir(repoRoot);

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

  // Current task
  let currentTask: ContextJson["currentTask"] = null;
  const currentTaskPath = getCurrentTask(repoRoot);
  if (currentTaskPath) {
    const currentTaskDir = join(repoRoot, currentTaskPath);
    const taskData = readTaskJsonFromWorkspace(currentTaskDir);
    if (taskData) {
      const prdFile = join(currentTaskDir, "prd.md");
      currentTask = {
        path: currentTaskPath,
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
      spec: `${DIR_VIBEN}/${DIR_SPEC}/`,
    },
  };
}

/**
 * Get context as formatted text
 */
function getContextText(repoRoot: string): string {
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

  // Current task
  lines.push("## CURRENT TASK");
  const currentTaskPath = getCurrentTask(repoRoot);
  if (currentTaskPath) {
    const currentTaskDir = join(repoRoot, currentTaskPath);
    lines.push(`Path: ${currentTaskPath}`);

    const taskData = readTaskJsonFromWorkspace(currentTaskDir);
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
  const tasksDir = getTasksDir(repoRoot);
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
  lines.push(`Spec: ${DIR_VIBEN}/${DIR_SPEC}/`);
  lines.push("");

  lines.push("========================================");

  return lines.join("\n");
}
