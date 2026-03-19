/**
 * Swarm CLI commands
 *
 * Manage multi-agent pipelines using git worktrees.
 * This command uses TypeScript implementations in packages/core/src/cli/lib/swarm/
 */
import { Command } from "commander";
import { spawn } from "node:child_process";
import { execSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join, basename, isAbsolute } from "node:path";
import chalk from "chalk";
import type { OutputContext } from "../types";
import {
  output,
  successResponse,
  errorResponse,
  handleCommandError,
} from "../lib";

// Import TypeScript implementations
import {
  // Types
  type AgentEntry,
  type Registry,
  type StartResult,
  type AgentStatus,
  type WaitOptions,
  type WaitResult,
  // Registry functions
  getRegistryPath,
  readRegistry,
  // Start functions
  startAgent,
  // Status functions
  isProcessRunning,
  getAllAgentStatuses,
  findAgentStatus,
  getRecentLogEntries,
  tailFollowConsole,
  getSessionId,
  // Cleanup functions
  listWorktrees,
  // Wait functions
  waitForAgents,
  getRunningAgents,
  formatWaitResult,
  // CLI Adapter
  createCLIAdapter,
  type Platform,
} from "../lib/swarm";

import { findVibenRoot } from "../lib/viben-workspace";

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
// Helper Functions
// =============================================================================

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
 * Find agent by task name or ID
 */
function findAgent(
  registry: Registry,
  search: string
): AgentEntry | undefined {
  // Exact ID match
  const exactMatch = registry.agents.find((a) => a.id === search);
  if (exactMatch) return exactMatch;

  // Partial match on task_dir
  return registry.agents.find((a) => a.task_dir.includes(search));
}

/**
 * Get task directory from task name
 * Sanitizes input to prevent path traversal attacks
 */
function resolveTaskDir(repoRoot: string, taskName: string): string | null {
  const tasksDir = join(repoRoot, ".viben", "tasks");
  if (!existsSync(tasksDir)) {
    return null;
  }

  // Sanitize taskName to prevent path traversal (e.g., ../../etc/passwd)
  const safeTaskName = basename(taskName);

  // Direct path check with sanitized name
  if (existsSync(join(tasksDir, safeTaskName))) {
    return join(".viben", "tasks", safeTaskName);
  }

  // Search for matching task using fs.readdirSync instead of shell command
  // This avoids command injection vulnerabilities
  try {
    const entries = readdirSync(tasksDir);

    for (const entry of entries) {
      if (entry.includes(safeTaskName) || safeTaskName.includes(entry)) {
        return join(".viben", "tasks", entry);
      }
    }
  } catch {
    // Ignore errors
  }

  return null;
}

// =============================================================================
// Command Implementations
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
 * Start an agent in a worktree
 */
async function startAgentCommand(
  ctx: OutputContext,
  repoRoot: string,
  taskName: string,
  options: {
    executor?: string;
    detach?: boolean;
    resume?: boolean;
    session?: string;
  }
): Promise<void> {
  // Resolve task directory
  const taskDir = resolveTaskDir(repoRoot, taskName);
  if (!taskDir) {
    output(ctx, errorResponse("TASK_NOT_FOUND", `Task not found: ${taskName}`), () => {
      console.error(chalk.red(`Error: Task not found: ${taskName}`));
      console.log(chalk.gray("Use 'viben task list' to see available tasks"));
    });
    process.exit(1);
    return;
  }

  // Handle resume
  if (options.resume) {
    const registry = readRegistry(repoRoot);
    const agent = findAgent(registry, taskName);

    if (!agent) {
      output(ctx, errorResponse("AGENT_NOT_FOUND", `No agent found for task: ${taskName}`), () => {
        console.error(chalk.red(`Error: No agent found for task: ${taskName}`));
        console.log(chalk.gray("The agent may not have been started yet"));
      });
      process.exit(1);
      return;
    }

    // Read session ID from task.json
    let sessionId = options.session;
    if (!sessionId) {
      const taskDirAbs = isAbsolute(agent.task_dir) ? agent.task_dir : join(repoRoot, agent.task_dir);
      sessionId = getSessionId(taskDirAbs) || undefined;
    }

    if (!sessionId) {
      output(ctx, errorResponse("NO_SESSION", "No session ID found for resume"), () => {
        console.error(chalk.red("Error: No session ID found for resume"));
        console.log(chalk.gray("No session_id in task.json and no --session provided"));
      });
      process.exit(1);
      return;
    }

    // Build resume command using CLI adapter
    const platform = (agent.platform || "claude") as Platform;
    const adapter = createCLIAdapter(platform);
    const resumeCmd = adapter.buildResumeCommand(sessionId);

    if (!ctx.quiet) {
      console.log(chalk.blue("=== Resuming Agent ==="));
      console.log(`  Session: ${sessionId}`);
      console.log(`  Worktree: ${agent.worktree_path}`);
      console.log(`  Command: ${resumeCmd.join(" ")}`);
      console.log();
    }

    // Execute resume command
    const child = spawn(resumeCmd[0], resumeCmd.slice(1), {
      cwd: agent.worktree_path,
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

  // Start agent using TypeScript implementation
  if (!ctx.quiet) {
    console.log(chalk.blue("=== Multi-Agent Pipeline: Start ==="));
    console.log(`[INFO] Task: ${taskDir}`);
    console.log(`[INFO] Platform: ${platform}`);
  }

  const result: StartResult = await startAgent(repoRoot, taskDir, {
    platform,
    detach: options.detach ?? true,
    skipPermissions: true,
    verbose: ctx.verbose,
    jsonOutput: true,
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
      console.log(chalk.green("=== Agent Started ==="));
      console.log();
      console.log(`  ID:        ${result.agentId}`);
      console.log(`  PID:       ${result.pid}`);
      console.log(`  Session:   ${result.sessionId || "N/A"}`);
      console.log(`  Worktree:  ${result.worktreePath}`);
      console.log(`  Log:       ${result.logFile}`);
      console.log();
      console.log(chalk.yellow(`To monitor: tail -f ${result.logFile}`));
      console.log(chalk.yellow(`To stop:    kill ${result.pid}`));
      if (result.sessionId) {
        const adapter = createCLIAdapter(platform);
        const resumeCmd = adapter.getResumeCommandStr(result.sessionId, result.worktreePath);
        console.log(chalk.yellow(`To resume:  ${resumeCmd}`));
      }
    } else {
      console.error(chalk.red(`Error: ${result.error}`));
      process.exit(1);
    }
  }
}

/**
 * Stop a running agent
 */
async function stopAgentCommand(
  ctx: OutputContext,
  repoRoot: string,
  taskName: string | undefined,
  options: { force?: boolean; all?: boolean }
): Promise<void> {
  const registry = readRegistry(repoRoot);

  if (options.all) {
    // Stop all agents
    const runningAgents = registry.agents.filter((a) =>
      isProcessRunning(a.pid)
    );

    if (runningAgents.length === 0) {
      output(ctx, successResponse({ stopped: [] }), () => {
        console.log(chalk.yellow("No running agents found"));
      });
      return;
    }

    const stopped: string[] = [];
    const failed: string[] = [];

    for (const agent of runningAgents) {
      try {
        process.kill(agent.pid, options.force ? "SIGKILL" : "SIGTERM");
        stopped.push(agent.id);
        if (!ctx.quiet) {
          console.log(
            chalk.green(`Stopped: ${agent.id} (PID: ${agent.pid})`)
          );
        }
      } catch {
        failed.push(agent.id);
        if (!ctx.quiet) {
          console.log(
            chalk.red(`Failed to stop: ${agent.id} (PID: ${agent.pid})`)
          );
        }
      }
    }

    output(ctx, successResponse({ stopped, failed }));
    return;
  }

  if (!taskName) {
    output(ctx, errorResponse("MISSING_TASK", "Task name required"), () => {
      console.error(chalk.red("Error: Task name is required"));
      console.log(chalk.gray("Usage: viben swarm stop <task>"));
      console.log(chalk.gray("       viben swarm stop --all"));
    });
    process.exit(1);
    return;
  }

  const agent = findAgent(registry, taskName);
  if (!agent) {
    output(ctx, errorResponse("AGENT_NOT_FOUND", `Agent not found: ${taskName}`), () => {
      console.error(chalk.red(`Error: Agent not found: ${taskName}`));
    });
    process.exit(1);
    return;
  }

  if (!isProcessRunning(agent.pid)) {
    output(ctx, successResponse({ agent, status: "already_stopped" }), () => {
      console.log(chalk.yellow(`Agent ${agent.id} is not running (PID: ${agent.pid})`));
    });
    return;
  }

  try {
    process.kill(agent.pid, options.force ? "SIGKILL" : "SIGTERM");
    output(ctx, successResponse({ agent, status: "stopped" }), () => {
      console.log(
        chalk.green(`Stopped agent: ${agent.id} (PID: ${agent.pid})`)
      );
    });
  } catch (err) {
    output(ctx, errorResponse("STOP_FAILED", `Failed to stop agent: ${err}`), () => {
      console.error(chalk.red(`Error: Failed to stop agent ${agent.id}: ${err}`));
    });
    process.exit(1);
  }
}

/**
 * Show agent status
 */
async function showStatusCommand(
  ctx: OutputContext,
  repoRoot: string,
  taskName: string | undefined,
  options: {
    running?: boolean;
    stopped?: boolean;
    detail?: boolean;
    watch?: boolean;
    log?: boolean;
  }
): Promise<void> {
  // Handle watch mode
  if (options.watch && taskName) {
    const status = findAgentStatus(taskName, repoRoot);
    if (!status) {
      console.error(chalk.red(`Agent not found: ${taskName}`));
      process.exit(1);
      return;
    }

    const logFile = join(status.worktreePath, "agent.log.jsonl");
    if (!existsSync(logFile)) {
      console.error(chalk.red(`Log file not found: ${logFile}`));
      process.exit(1);
      return;
    }

    console.log(chalk.blue(`Watching: ${logFile}`));
    console.log(chalk.dim("Press Ctrl+C to stop"));
    console.log();

    tailFollowConsole(logFile);
    return;
  }

  // Handle log mode
  if (options.log && taskName) {
    const status = findAgentStatus(taskName, repoRoot);
    if (!status) {
      console.error(chalk.red(`Agent not found: ${taskName}`));
      process.exit(1);
      return;
    }

    const logFile = join(status.worktreePath, "agent.log.jsonl");
    if (!existsSync(logFile)) {
      console.error(chalk.red(`Log file not found: ${logFile}`));
      process.exit(1);
      return;
    }

    console.log(chalk.blue(`=== Recent Log: ${taskName} ===`));
    console.log(chalk.dim(`Platform: ${status.platform}`));
    console.log();

    const entries = getRecentLogEntries(logFile, 50, status.platform);
    for (const entry of entries) {
      console.log(entry);
    }
    return;
  }

  // Handle detail mode
  if ((options.detail || taskName) && taskName) {
    const status = findAgentStatus(taskName, repoRoot);
    if (!status) {
      console.error(chalk.red(`Agent not found: ${taskName}`));
      process.exit(1);
      return;
    }

    if (ctx.json) {
      output(ctx, successResponse(status));
      return;
    }

    console.log(chalk.blue(`=== Agent Detail: ${status.id} ===`));
    console.log();
    console.log(`  ID:        ${status.id}`);
    console.log(`  PID:       ${status.pid}`);
    console.log(`  Session:   ${status.sessionId || "N/A"}`);
    console.log(`  Worktree:  ${status.worktreePath}`);
    console.log(`  Task Dir:  ${status.taskDir}`);
    console.log(`  Started:   ${status.startedAt}`);
    console.log();

    if (status.running) {
      console.log(`  Status:    ${chalk.green("Running")}`);
    } else {
      console.log(`  Status:    ${chalk.red("Stopped")}`);
      if (status.sessionId) {
        const adapter = createCLIAdapter(status.platform as Platform);
        const resumeCmd = adapter.getResumeCommandStr(status.sessionId, status.worktreePath);
        console.log();
        console.log(chalk.yellow(`  Resume: ${resumeCmd}`));
      }
    }

    // Show git changes
    if (existsSync(status.worktreePath)) {
      console.log();
      console.log(chalk.blue("=== Git Changes ==="));
      console.log();

      try {
        const gitStatus = execSync("git status --short", {
          cwd: status.worktreePath,
          encoding: "utf-8",
        });
        if (gitStatus.trim()) {
          const lines = gitStatus.trim().split("\n");
          for (const line of lines.slice(0, 10)) {
            console.log(`  ${line}`);
          }
          if (lines.length > 10) {
            console.log(`  ... and ${lines.length - 10} more`);
          }
        } else {
          console.log("  (no changes)");
        }
      } catch {
        console.log("  (could not get git status)");
      }
    }

    console.log();
    return;
  }

  // Summary mode (default)
  const allStatuses = getAllAgentStatuses(repoRoot);

  // Apply filters
  let filteredStatuses = allStatuses;
  if (options.running) {
    filteredStatuses = allStatuses.filter((s) => s.running);
  } else if (options.stopped) {
    filteredStatuses = allStatuses.filter((s) => !s.running);
  }

  if (ctx.json) {
    output(ctx, successResponse({ agents: filteredStatuses }));
    return;
  }

  // Human-readable summary
  const runningCount = allStatuses.filter((s) => s.running).length;
  const totalCount = allStatuses.length;

  console.log(chalk.blue("=== Swarm Status ==="));
  console.log(`Agents: ${chalk.green(runningCount.toString())} running / ${totalCount} registered`);
  console.log();

  const runningAgents = filteredStatuses.filter((s) => s.running);
  const stoppedAgents = filteredStatuses.filter((s) => !s.running);

  if (runningAgents.length > 0) {
    console.log(chalk.cyan("Running:"));
    for (const agent of runningAgents) {
      console.log(`  ${chalk.green("▶")} ${chalk.cyan(agent.id)} ${chalk.green("[running]")}`);
      if (agent.phase) {
        console.log(`    Phase:    ${agent.phase}`);
      }
      console.log(`    Elapsed:  ${agent.elapsed}`);
      if (agent.branch) {
        console.log(`    Branch:   ${chalk.dim(agent.branch)}`);
      }
      console.log(`    Modified: ${agent.modifiedFiles} file(s)`);
      if (agent.lastTool) {
        console.log(`    Activity: ${chalk.yellow(agent.lastTool)}`);
      }
      console.log(`    PID:      ${chalk.dim(agent.pid.toString())}`);
      console.log();
    }
  }

  if (stoppedAgents.length > 0) {
    console.log(chalk.red("Stopped:"));
    for (const agent of stoppedAgents) {
      console.log(`  ${chalk.red("○")} ${agent.id} ${chalk.red("[stopped]")}`);
      if (agent.lastMessage) {
        console.log(`    ${chalk.dim(`"${agent.lastMessage}"`)}`);
      }
      if (agent.sessionId) {
        const adapter = createCLIAdapter(agent.platform as Platform);
        const resumeCmd = adapter.getResumeCommandStr(agent.sessionId, agent.worktreePath);
        console.log(`    ${chalk.yellow(resumeCmd)}`);
      }
      console.log();
    }
  }
}

/**
 * Show agent registry
 */
async function showRegistryCommand(
  ctx: OutputContext,
  repoRoot: string
): Promise<void> {
  const registryPath = getRegistryPath(repoRoot);
  const registry = readRegistry(repoRoot);

  if (ctx.json) {
    output(ctx, successResponse({ path: registryPath, ...registry }));
    return;
  }

  console.log(chalk.blue("=== Agent Registry ==="));
  console.log();
  console.log(`File: ${registryPath}`);
  console.log();
  console.log(JSON.stringify(registry, null, 2));
}

// =============================================================================
// Command Registration
// =============================================================================

/**
 * Register swarm commands
 */
export function registerSwarmCommand(program: Command): void {
  const swarm = program
    .command("swarm")
    .description("Manage multi-agent pipelines using git worktrees");

  // swarm list - list all worktrees and agents
  swarm
    .command("list")
    .description("List all git worktrees and registered agents")
    .action(async () => {
      const ctx = getOutputContext(program);
      const repoRoot = findVibenRoot();

      if (!repoRoot) {
        handleCommandError(ctx, new Error("Not in a Viben workspace"));
        return;
      }

      try {
        await listWorktreesCommand(ctx, repoRoot);
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // swarm start - start an agent (DEPRECATED)
  swarm
    .command("start")
    .description("[DEPRECATED] Start an agent in a worktree. Use 'viben task work-phase <task>' instead.")
    .argument("<task>", "Task name or directory")
    .option("--executor <type>", "Executor type (CLAUDE_CODE, CURSOR, etc.)")
    .option("--detach", "Run in background")
    .option("--resume", "Resume an existing session")
    .option("--session <id>", "Session ID for resume")
    .action(async (task: string, options) => {
      const ctx = getOutputContext(program);
      const repoRoot = findVibenRoot();

      // Show deprecation warning
      console.log(chalk.yellow("⚠️  DEPRECATED: 'viben swarm start' is deprecated."));
      console.log(chalk.yellow("   Please use 'viben task work-phase <task>' instead."));
      console.log(chalk.yellow("   This command will be removed in a future version."));
      console.log();

      if (!repoRoot) {
        handleCommandError(ctx, new Error("Not in a Viben workspace"));
        return;
      }

      try {
        await startAgentCommand(ctx, repoRoot, task, options);
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // swarm stop - stop an agent
  swarm
    .command("stop")
    .description("Stop a running agent")
    .argument("[task]", "Task name (optional if --all)")
    .option("--force", "Force kill with SIGKILL")
    .option("--all", "Stop all running agents")
    .action(async (task: string | undefined, options) => {
      const ctx = getOutputContext(program);
      const repoRoot = findVibenRoot();

      if (!repoRoot) {
        handleCommandError(ctx, new Error("Not in a Viben workspace"));
        return;
      }

      try {
        await stopAgentCommand(ctx, repoRoot, task, options);
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // swarm status - show status
  swarm
    .command("status")
    .description("Show agent status")
    .argument("[task]", "Task name for specific agent status")
    .option("--running", "Show only running agents")
    .option("--stopped", "Show only stopped agents")
    .option("--detail", "Show detailed status")
    .option("--watch", "Watch agent log in real-time")
    .option("--log", "Show recent log entries")
    .action(async (task: string | undefined, options) => {
      const ctx = getOutputContext(program);
      const repoRoot = findVibenRoot();

      if (!repoRoot) {
        handleCommandError(ctx, new Error("Not in a Viben workspace"));
        return;
      }

      try {
        await showStatusCommand(ctx, repoRoot, task, options);
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // swarm registry - show registry
  swarm
    .command("registry")
    .description("Show agent registry")
    .action(async () => {
      const ctx = getOutputContext(program);
      const repoRoot = findVibenRoot();

      if (!repoRoot) {
        handleCommandError(ctx, new Error("Not in a Viben workspace"));
        return;
      }

      try {
        await showRegistryCommand(ctx, repoRoot);
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // swarm wait - wait for agents to complete
  swarm
    .command("wait")
    .description("Wait for agents to complete")
    .argument("[tasks...]", "Task names to wait for (empty = use --all)")
    .option("--all", "Wait for all running agents")
    .option("--polling-interval-seconds <n>", "Polling interval in seconds", "10")
    .option("--timeout-seconds <n>", "Timeout per task in seconds", "300")
    .option("--global-timeout-seconds <n>", "Global timeout in seconds (0 = no global timeout)", "0")
    .option("--quiet", "Quiet mode - minimal output")
    .option("--verbose", "Verbose mode - show status table each poll")
    .option("--json", "JSON format output")
    .action(async (tasks: string[], options: {
      all?: boolean;
      pollingIntervalSeconds?: string;
      timeoutSeconds?: string;
      globalTimeoutSeconds?: string;
      quiet?: boolean;
      verbose?: boolean;
      json?: boolean;
    }) => {
      const ctx = getOutputContext(program);
      const repoRoot = findVibenRoot();

      if (!repoRoot) {
        handleCommandError(ctx, new Error("Not in a Viben workspace"));
        process.exit(3);
        return;
      }

      try {
        // Determine tasks to wait for
        let tasksToWait: string[] = tasks;

        if (options.all) {
          // Wait for all running agents
          tasksToWait = [];
        } else if (tasks.length === 0) {
          // No tasks specified and no --all flag
          output(ctx, errorResponse("NO_TASKS", "No tasks specified. Use task names or --all"), () => {
            console.error(chalk.red("Error: No tasks specified"));
            console.log(chalk.gray("Usage: viben swarm wait <task1> <task2> ..."));
            console.log(chalk.gray("       viben swarm wait --all"));
          });
          process.exit(2);
          return;
        }

        // Get current PID to exclude self (prevent deadlock)
        const currentPid = process.pid;

        // Parse options (include excludePid to prevent deadlock)
        const waitOptions: WaitOptions = {
          pollingIntervalSeconds: parseInt(options.pollingIntervalSeconds || "10", 10),
          timeoutSeconds: parseInt(options.timeoutSeconds || "300", 10),
          globalTimeoutSeconds: parseInt(options.globalTimeoutSeconds || "0", 10),
          verbose: options.verbose ?? ctx.verbose ?? false,
          quiet: options.quiet ?? ctx.quiet ?? false,
          excludePid: currentPid,
        };

        // Read registry once for all operations
        const registry = readRegistry(repoRoot);

        // Helper: find agent by task with precise matching
        const findAgentByTask = (taskName: string) => {
          // 1. Exact ID match
          const exactId = registry.agents.find((a) => a.id === taskName);
          if (exactId) return exactId;
          // 2. Exact task directory name match
          const exactDir = registry.agents.find((a) => {
            const dirName = a.task_dir.split("/").pop() || "";
            return dirName === taskName;
          });
          if (exactDir) return exactDir;
          // 3. Partial match
          return registry.agents.find((a) => a.task_dir.includes(taskName));
        };

        // Get running agents (excluding self)
        const runningAgents = registry.agents.filter(
          (a) => isProcessRunning(a.pid) && a.pid !== currentPid
        );

        if (runningAgents.length === 0) {
          output(ctx, successResponse({
            completed: [],
            failed: [],
            timeout: [],
            results: [],
            skippedSelf: registry.agents.some((a) => a.pid === currentPid),
          }), () => {
            const selfInRegistry = registry.agents.some((a) => a.pid === currentPid);
            if (selfInRegistry) {
              console.log(chalk.yellow("No other running agents found (excluded self to prevent deadlock)"));
            } else {
              console.log(chalk.yellow("No running agents found"));
            }
          });
          process.exit(0); // No agents to wait for is success
          return;
        }

        // Filter to specified tasks if not --all
        if (tasksToWait.length > 0) {
          const validTasks: string[] = [];
          const invalidTasks: string[] = [];
          const skippedSelf: string[] = [];

          for (const taskName of tasksToWait) {
            const agent = findAgentByTask(taskName);
            if (agent) {
              if (agent.pid === currentPid) {
                // Skip self to prevent deadlock
                skippedSelf.push(taskName);
              } else if (isProcessRunning(agent.pid)) {
                validTasks.push(taskName);
              } else {
                // Agent exists but not running
                if (!waitOptions.quiet) {
                  console.log(chalk.yellow(`Skipping ${taskName}: agent not running`));
                }
              }
            } else {
              invalidTasks.push(taskName);
            }
          }

          if (skippedSelf.length > 0 && !waitOptions.quiet) {
            console.log(chalk.yellow(`⚠️  Skipped self: ${skippedSelf.join(", ")} (prevents deadlock)`));
          }

          if (invalidTasks.length > 0 && !waitOptions.quiet) {
            console.log(chalk.yellow(`Tasks not found in registry: ${invalidTasks.join(", ")}`));
          }

          if (validTasks.length === 0) {
            output(ctx, successResponse({
              completed: [],
              failed: [],
              timeout: [],
              results: [],
              skippedSelf: skippedSelf.length > 0,
            }), () => {
              if (skippedSelf.length > 0 && invalidTasks.length === 0) {
                console.log(chalk.yellow("Only self found - nothing to wait for"));
              } else {
                console.log(chalk.yellow("No running agents match the specified tasks"));
              }
            });
            process.exit(0); // Nothing to wait for is success
            return;
          }

          tasksToWait = validTasks;
        }

        // Show starting message
        if (!waitOptions.quiet) {
          const count = tasksToWait.length || runningAgents.length;
          console.log(chalk.blue(`=== Waiting for ${count} agent(s) ===`));
          console.log(chalk.dim(`Polling: ${waitOptions.pollingIntervalSeconds}s, Timeout: ${waitOptions.timeoutSeconds}s`));
          if (registry.agents.some((a) => a.pid === currentPid)) {
            console.log(chalk.dim(`(Excluded self PID ${currentPid} to prevent deadlock)`));
          }
          console.log();
        }

        // Execute wait
        const result: WaitResult = await waitForAgents(repoRoot, tasksToWait, waitOptions);

        // Output result
        if (ctx.json) {
          const hasTimeout = result.timeout.length > 0;
          const hasFailed = result.failed.length > 0;
          output(ctx, {
            success: !hasTimeout && !hasFailed,
            data: result,
          });
        } else if (!waitOptions.quiet) {
          console.log();
          console.log(formatWaitResult(result));
        }

        // Determine exit code with clear semantics:
        // 0 = all completed successfully
        // 1 = timeout occurred
        // 2 = failed (no timeout)
        if (result.timeout.length > 0) {
          process.exit(1); // Timeout
        } else if (result.failed.length > 0) {
          process.exit(2); // Failed
        } else {
          process.exit(0); // All completed
        }
      } catch (error) {
        handleCommandError(ctx, error);
        process.exit(3);
      }
    });
}
