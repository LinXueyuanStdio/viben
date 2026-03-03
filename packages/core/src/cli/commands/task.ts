/**
 * viben task - Task management commands
 *
 * Provides commands for managing development tasks, including creation, context management,
 * status tracking, and PR workflow. Delegates to Python scripts in .viben/scripts/.
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
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import type { Command } from "commander";
import type { OutputContext } from "../types";
import {
  output,
  successResponse,
  outputKeyValue,
  handleCommandError,
  outputSuccess,
} from "../lib";
import { CliError } from "../types";

// =============================================================================
// Constants
// =============================================================================

const VIBEN_DIR = ".viben";
const SCRIPTS_DIR = "scripts";
const TASK_SCRIPT = "task.py";
const MULTI_AGENT_DIR = "multi_agent";
const PLAN_SCRIPT = "plan.py";
const STATUS_SCRIPT = "status.py";
const CREATE_PR_SCRIPT = "create_pr.py";

// =============================================================================
// Types
// =============================================================================

interface TaskJson {
  id: string;
  name: string;
  title: string;
  description?: string;
  status: string;
  dev_type?: string;
  scope?: string;
  priority: string;
  creator?: string;
  assignee?: string;
  createdAt: string;
  completedAt?: string;
  branch?: string;
  base_branch?: string;
  worktree_path?: string;
  current_phase: number;
  next_action?: Array<{ phase: number; action: string }>;
  commit?: string;
  pr_url?: string;
  subtasks?: string[];
  relatedFiles?: string[];
  notes?: string;
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
 * Get the path to a Python script in .viben/scripts/
 */
function getScriptPath(cwd: string, ...parts: string[]): string {
  return join(cwd, VIBEN_DIR, SCRIPTS_DIR, ...parts);
}

/**
 * Check if the .viben directory exists in the workspace
 */
function ensureVibenDir(cwd: string): void {
  const vibenDir = join(cwd, VIBEN_DIR);
  if (!existsSync(vibenDir)) {
    throw CliError.operationFailed(
      "Task command",
      `Not a Viben workspace (${VIBEN_DIR} not found). Run "viben team init" first.`
    );
  }
}

/**
 * Check if a Python script exists
 */
function ensureScriptExists(scriptPath: string, scriptName: string): void {
  if (!existsSync(scriptPath)) {
    throw CliError.operationFailed(
      "Task command",
      `Script not found: ${scriptName}. Run "viben team init" to set up the workspace.`
    );
  }
}

/**
 * Run a Python script and return a promise
 */
function runPythonScript(
  scriptPath: string,
  args: string[],
  cwd: string,
  ctx: OutputContext
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const spawnOptions: SpawnOptions = {
      cwd,
      shell: true,
      stdio: ["inherit", "pipe", "pipe"],
    };

    // Use python3 command
    const child = spawn("python3", [scriptPath, ...args], spawnOptions);

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (data) => {
      stdout += data.toString();
      if (!ctx.quiet && !ctx.json) {
        process.stdout.write(data);
      }
    });

    child.stderr?.on("data", (data) => {
      stderr += data.toString();
      if (!ctx.quiet && !ctx.json) {
        process.stderr.write(data);
      }
    });

    child.on("error", (error) => {
      resolve({ exitCode: 1, stdout, stderr: error.message });
    });

    child.on("close", (code) => {
      resolve({ exitCode: code ?? 0, stdout, stderr });
    });
  });
}

/**
 * Run a Python script synchronously (for simpler commands)
 */
function runPythonScriptSync(
  scriptPath: string,
  args: string[],
  cwd: string
): string {
  const command = `python3 "${scriptPath}" ${args.map(a => `"${a}"`).join(" ")}`;
  return execSync(command, { cwd, encoding: "utf-8" });
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
 */
function formatStatus(status: string): string {
  switch (status) {
    case "completed":
      return chalk.green(status);
    case "in_progress":
      return chalk.blue(status);
    case "planning":
      return chalk.yellow(status);
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
        ensureVibenDir(cwd);
        const scriptPath = getScriptPath(cwd, TASK_SCRIPT);
        ensureScriptExists(scriptPath, TASK_SCRIPT);

        const args = ["list"];
        if (options.mine) {
          args.push("--mine");
        }
        if (options.status) {
          args.push("--status", options.status);
        }

        const result = await runPythonScript(scriptPath, args, cwd, ctx);

        if (ctx.json) {
          // Parse output and format as JSON
          output(ctx, successResponse({ output: result.stdout.trim() }), () => {});
        }
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
    .option("--agent <agent-id>", "Associated agent configuration")
    .action(async (title: string, options: {
      slug?: string;
      assignee?: string;
      priority?: string;
      agent?: string;
    }) => {
      const ctx = getContext(program);
      const cwd = process.cwd();

      try {
        ensureVibenDir(cwd);
        const scriptPath = getScriptPath(cwd, TASK_SCRIPT);
        ensureScriptExists(scriptPath, TASK_SCRIPT);

        const args = ["create", title];
        if (options.slug) {
          args.push("--slug", options.slug);
        }
        if (options.assignee) {
          args.push("--assignee", options.assignee);
        }
        if (options.priority) {
          args.push("--priority", options.priority);
        }

        const result = await runPythonScript(scriptPath, args, cwd, ctx);

        if (result.exitCode === 0) {
          // Extract task directory from output
          const taskDir = result.stdout.trim().split("\n").pop() || "";

          output(ctx, successResponse({ taskDir }), () => {
            if (!ctx.quiet) {
              outputSuccess(ctx, `Created task: ${taskDir}`);
            }
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
    .action(async (task: string) => {
      const ctx = getContext(program);
      const cwd = process.cwd();

      try {
        ensureVibenDir(cwd);

        // Try to resolve task directory
        const taskDir = resolveTaskDir(cwd, task);
        const taskJson = readTaskJson(taskDir);

        if (!taskJson) {
          throw CliError.notFound("Task", task);
        }

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
        ensureVibenDir(cwd);
        const taskDir = resolveTaskDir(cwd, task);
        const taskJsonPath = join(taskDir, "task.json");

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
        ensureVibenDir(cwd);
        const taskDir = resolveTaskDir(cwd, task);

        if (!existsSync(taskDir)) {
          throw CliError.notFound("Task", task);
        }

        if (!options.force && !ctx.quiet) {
          console.log(chalk.yellow(`Warning: This will permanently delete task "${task}".`));
          console.log(chalk.gray("Use --force to skip this warning"));
          return;
        }

        // Use rm -rf to delete the directory
        execSync(`rm -rf "${taskDir}"`, { cwd });

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
        ensureVibenDir(cwd);
        const scriptPath = getScriptPath(cwd, TASK_SCRIPT);
        ensureScriptExists(scriptPath, TASK_SCRIPT);

        const args = ["start", task];
        const result = await runPythonScript(scriptPath, args, cwd, ctx);

        if (result.exitCode === 0 && options.resume) {
          // TODO: Implement resume via swarm command when available
          if (!ctx.quiet) {
            console.log(chalk.gray("Note: --resume will be available when swarm command is implemented"));
          }
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
    .action(async (task?: string) => {
      const ctx = getContext(program);
      const cwd = process.cwd();

      try {
        ensureVibenDir(cwd);
        const scriptPath = getScriptPath(cwd, TASK_SCRIPT);
        ensureScriptExists(scriptPath, TASK_SCRIPT);

        const args = ["finish"];
        if (task) {
          args.push(task);
        }

        await runPythonScript(scriptPath, args, cwd, ctx);
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
        ensureVibenDir(cwd);
        const scriptPath = getScriptPath(cwd, TASK_SCRIPT);
        ensureScriptExists(scriptPath, TASK_SCRIPT);

        await runPythonScript(scriptPath, ["archive", task], cwd, ctx);
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
        ensureVibenDir(cwd);
        const scriptPath = getScriptPath(cwd, TASK_SCRIPT);
        ensureScriptExists(scriptPath, TASK_SCRIPT);

        const args = ["list-archive"];
        if (month) {
          args.push(month);
        }

        await runPythonScript(scriptPath, args, cwd, ctx);
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
        ensureVibenDir(cwd);
        const scriptPath = getScriptPath(cwd, TASK_SCRIPT);
        ensureScriptExists(scriptPath, TASK_SCRIPT);

        await runPythonScript(scriptPath, ["set-branch", task, options.branch], cwd, ctx);
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
        ensureVibenDir(cwd);
        const scriptPath = getScriptPath(cwd, TASK_SCRIPT);
        ensureScriptExists(scriptPath, TASK_SCRIPT);

        await runPythonScript(scriptPath, ["set-base-branch", task, options.branch], cwd, ctx);
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
        ensureVibenDir(cwd);
        const scriptPath = getScriptPath(cwd, TASK_SCRIPT);
        ensureScriptExists(scriptPath, TASK_SCRIPT);

        await runPythonScript(scriptPath, ["set-scope", task, options.scope], cwd, ctx);
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
        ensureVibenDir(cwd);
        const taskDir = resolveTaskDir(cwd, task);
        const taskJsonPath = join(taskDir, "task.json");

        if (!existsSync(taskJsonPath)) {
          throw CliError.notFound("Task", task);
        }

        // Read, update, and write task.json
        const content = readFileSync(taskJsonPath, "utf-8");
        const taskJson = JSON.parse(content) as TaskJson & { agent?: string };
        taskJson.agent = options.agent;
        writeFileSync(taskJsonPath, JSON.stringify(taskJson, null, 2), "utf-8");

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
    .description("Initialize context files for task")
    .argument("<task>", "Task name or directory")
    .requiredOption("-t, --type <type>", "Dev type (frontend, backend, fullstack, test, docs)")
    .action(async (task: string, options: { type: string }) => {
      const ctx = getContext(program);
      const cwd = process.cwd();

      try {
        ensureVibenDir(cwd);
        const scriptPath = getScriptPath(cwd, TASK_SCRIPT);
        ensureScriptExists(scriptPath, TASK_SCRIPT);

        await runPythonScript(scriptPath, ["init-context", task, options.type], cwd, ctx);
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
        ensureVibenDir(cwd);
        const scriptPath = getScriptPath(cwd, TASK_SCRIPT);
        ensureScriptExists(scriptPath, TASK_SCRIPT);

        // Add each file
        for (const file of files) {
          const args = ["add-context", task, "implement", file];
          if (options.reason) {
            args.push(options.reason);
          }

          await runPythonScript(scriptPath, args, cwd, ctx);
        }
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
        ensureVibenDir(cwd);

        // This command is not directly supported by task.py
        // We need to manually edit the jsonl files
        const taskDir = resolveTaskDir(cwd, task);

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
        ensureVibenDir(cwd);
        const scriptPath = getScriptPath(cwd, TASK_SCRIPT);
        ensureScriptExists(scriptPath, TASK_SCRIPT);

        await runPythonScript(scriptPath, ["list-context", task], cwd, ctx);
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
        ensureVibenDir(cwd);
        const scriptPath = getScriptPath(cwd, TASK_SCRIPT);
        ensureScriptExists(scriptPath, TASK_SCRIPT);

        await runPythonScript(scriptPath, ["validate", task], cwd, ctx);
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
        ensureVibenDir(cwd);
        const scriptPath = getScriptPath(cwd, MULTI_AGENT_DIR, PLAN_SCRIPT);
        ensureScriptExists(scriptPath, PLAN_SCRIPT);

        const args = [
          "--name", options.name,
          "--type", options.type,
          "--requirement", options.requirement,
        ];
        if (options.platform) {
          args.push("--platform", options.platform);
        }

        await runPythonScript(scriptPath, args, cwd, ctx);
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
    .option("-s, --status <status>", "Filter by status")
    .option("--running", "Show only tasks with running agents")
    .option("--json", "Output in JSON format")
    .option("--detail", "Show detailed status (for specific task)")
    .option("--watch", "Watch agent log in real-time (for specific task)")
    .option("--log", "Show recent log entries (for specific task)")
    .action(async (task: string | undefined, options: {
      assignee?: string;
      status?: string;
      running?: boolean;
      json?: boolean;
      detail?: boolean;
      watch?: boolean;
      log?: boolean;
    }) => {
      const ctx = getContext(program);
      if (options.json) {
        ctx.json = true;
      }

      const cwd = process.cwd();

      try {
        ensureVibenDir(cwd);
        const scriptPath = getScriptPath(cwd, MULTI_AGENT_DIR, STATUS_SCRIPT);
        ensureScriptExists(scriptPath, STATUS_SCRIPT);

        const args: string[] = [];

        if (task) {
          // Specific task
          if (options.detail) {
            args.push("--detail", task);
          } else if (options.watch) {
            args.push("--watch", task);
          } else if (options.log) {
            args.push("--log", task);
          } else {
            args.push(task);
          }
        } else {
          // All tasks
          if (options.assignee) {
            args.push("-a", options.assignee);
          }
          if (options.running) {
            args.push("--running");
          }
        }

        await runPythonScript(scriptPath, args, cwd, ctx);
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
        ensureVibenDir(cwd);
        const scriptPath = getScriptPath(cwd, MULTI_AGENT_DIR, CREATE_PR_SCRIPT);
        ensureScriptExists(scriptPath, CREATE_PR_SCRIPT);

        const args: string[] = [];
        if (task) {
          args.push(task);
        }
        if (options.dryRun) {
          args.push("--dry-run");
        }

        await runPythonScript(scriptPath, args, cwd, ctx);
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Resolve task directory from task name or path
 */
function resolveTaskDir(cwd: string, task: string): string {
  // If it's an absolute path
  if (task.startsWith("/")) {
    return task;
  }

  // If it's a relative path with directory separator
  if (task.includes("/")) {
    return resolve(cwd, task);
  }

  // Otherwise, search in .viben/tasks/
  const tasksDir = join(cwd, VIBEN_DIR, "tasks");
  if (!existsSync(tasksDir)) {
    throw CliError.operationFailed("Task command", "Tasks directory not found");
  }

  // Try to find a matching task directory
  const dirs = readdirSync(tasksDir, { encoding: "utf-8" });

  for (const dir of dirs) {
    // Match by exact name or by suffix after date prefix (MM-DD-)
    if (dir === task || dir.endsWith(`-${task}`)) {
      return join(tasksDir, dir);
    }
    // Also match if task name is contained in directory name
    if (dir.includes(task)) {
      return join(tasksDir, dir);
    }
  }

  // Fallback: return the input as a relative path
  return join(tasksDir, task);
}
