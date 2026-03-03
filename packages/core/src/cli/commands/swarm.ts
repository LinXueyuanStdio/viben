/**
 * Swarm CLI commands
 *
 * Manage multi-agent pipelines using git worktrees.
 * This command delegates to Python scripts in the .viben/scripts/multi_agent/ directory.
 */
import { Command } from "commander";
import { spawn, execSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve, basename } from "node:path";
import chalk from "chalk";
import type { OutputContext } from "../types";
import {
  output,
  successResponse,
  errorResponse,
  handleCommandError,
} from "../lib";

// =============================================================================
// Types
// =============================================================================

interface AgentEntry {
  id: string;
  worktree_path: string;
  pid: number;
  task_dir: string;
  started_at: string;
  platform: string;
}

interface Registry {
  agents: AgentEntry[];
}

// =============================================================================
// Constants
// =============================================================================

/** Mapping from CLI executor IDs to Python script platform names */
const EXECUTOR_TO_PLATFORM: Record<string, string> = {
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
 * Find the .viben directory (workflow root)
 */
function findVibenRoot(startDir: string = process.cwd()): string | null {
  let current = resolve(startDir);
  while (current !== "/") {
    if (existsSync(join(current, ".viben"))) {
      return current;
    }
    const parent = resolve(current, "..");
    if (parent === current) break;
    current = parent;
  }
  return null;
}

/**
 * Get path to Python script
 */
function getScriptPath(repoRoot: string, scriptName: string): string {
  return join(repoRoot, ".viben", "scripts", "multi_agent", scriptName);
}

/**
 * Run a Python script and return its output
 */
async function runPythonScript(
  repoRoot: string,
  scriptName: string,
  args: string[] = [],
  options: { cwd?: string; verbose?: boolean } = {}
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const scriptPath = getScriptPath(repoRoot, scriptName);

  if (!existsSync(scriptPath)) {
    return {
      exitCode: 1,
      stdout: "",
      stderr: `Script not found: ${scriptPath}`,
    };
  }

  return new Promise((resolvePromise) => {
    const child = spawn("python3", [scriptPath, ...args], {
      cwd: options.cwd || repoRoot,
      env: process.env,
      stdio: ["inherit", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (data) => {
      stdout += data.toString();
      if (options.verbose) {
        process.stdout.write(data);
      }
    });

    child.stderr?.on("data", (data) => {
      stderr += data.toString();
      if (options.verbose) {
        process.stderr.write(data);
      }
    });

    child.on("close", (code) => {
      resolvePromise({
        exitCode: code ?? 1,
        stdout,
        stderr,
      });
    });

    child.on("error", (err) => {
      resolvePromise({
        exitCode: 1,
        stdout: "",
        stderr: err.message,
      });
    });
  });
}

/**
 * Run a Python script with passthrough (interactive mode)
 */
async function runPythonScriptPassthrough(
  repoRoot: string,
  scriptName: string,
  args: string[] = [],
  options: { cwd?: string } = {}
): Promise<number> {
  const scriptPath = getScriptPath(repoRoot, scriptName);

  if (!existsSync(scriptPath)) {
    console.error(chalk.red(`Script not found: ${scriptPath}`));
    return 1;
  }

  return new Promise((resolvePromise) => {
    const child = spawn("python3", [scriptPath, ...args], {
      cwd: options.cwd || repoRoot,
      env: process.env,
      stdio: "inherit",
    });

    child.on("close", (code) => {
      resolvePromise(code ?? 1);
    });

    child.on("error", (err) => {
      console.error(chalk.red(`Failed to run script: ${err.message}`));
      resolvePromise(1);
    });
  });
}

/**
 * Get the registry file path
 */
function getRegistryPath(repoRoot: string): string | null {
  // First, get the developer name
  const developerFile = join(repoRoot, ".viben", ".developer");
  if (!existsSync(developerFile)) {
    return null;
  }

  try {
    const content = readFileSync(developerFile, "utf-8");
    let developerName: string | null = null;
    for (const line of content.split("\n")) {
      if (line.startsWith("name=")) {
        // Use substring to handle values containing '='
        developerName = line.substring(line.indexOf("=") + 1).trim();
        break;
      }
    }
    if (!developerName) return null;

    return join(
      repoRoot,
      ".viben",
      "workspace",
      developerName,
      ".agents",
      "registry.json"
    );
  } catch {
    return null;
  }
}

/**
 * Read the agent registry
 */
function readRegistry(repoRoot: string): Registry {
  const registryPath = getRegistryPath(repoRoot);
  if (!registryPath || !existsSync(registryPath)) {
    return { agents: [] };
  }

  try {
    const content = readFileSync(registryPath, "utf-8");
    return JSON.parse(content) as Registry;
  } catch {
    return { agents: [] };
  }
}

/**
 * Check if a process is running
 */
function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
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
async function listWorktrees(
  ctx: OutputContext,
  repoRoot: string
): Promise<void> {
  // Use cleanup.py --list for listing
  const exitCode = await runPythonScriptPassthrough(
    repoRoot,
    "cleanup.py",
    ["--list"]
  );

  if (ctx.json) {
    // For JSON output, read and output the registry directly
    const registry = readRegistry(repoRoot);

    // Get worktree list from git
    let worktrees: { path: string; commit: string; branch: string }[] = [];
    try {
      const gitOutput = execSync("git worktree list --porcelain", {
        cwd: repoRoot,
        encoding: "utf-8",
      });

      // Parse worktree output record by record for robustness
      // Each record starts with "worktree " and handles detached worktrees
      let currentWorktree: { path: string; commit: string; branch: string } | null = null;

      for (const line of gitOutput.split("\n")) {
        if (line.startsWith("worktree ")) {
          // Save previous worktree if exists
          if (currentWorktree) {
            worktrees.push(currentWorktree);
          }
          currentWorktree = { path: line.substring(9), commit: "", branch: "" };
        } else if (currentWorktree) {
          if (line.startsWith("HEAD ")) {
            currentWorktree.commit = line.substring(5, 12);
          } else if (line.startsWith("branch ")) {
            currentWorktree.branch = line.substring(7).replace("refs/heads/", "");
          } else if (line.startsWith("detached")) {
            currentWorktree.branch = "(detached)";
          }
        }
      }
      // Don't forget the last worktree
      if (currentWorktree) {
        worktrees.push(currentWorktree);
      }
    } catch {
      // Ignore errors
    }

    output(ctx, successResponse({ worktrees, agents: registry.agents }));
  }

  if (exitCode !== 0) {
    process.exit(exitCode);
  }
}

/**
 * Start an agent in a worktree
 */
async function startAgent(
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

  // Build args for start.py
  const args: string[] = [taskDir];

  // Add platform option if executor specified
  if (options.executor) {
    const platform =
      EXECUTOR_TO_PLATFORM[options.executor.toUpperCase()] ||
      options.executor.toLowerCase();
    args.push("--platform", platform);
  }

  // Handle resume
  if (options.resume) {
    // For resume, we need to use the CLI adapter's resume command
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

    // Read session ID
    const sessionIdFile = join(agent.worktree_path, ".session-id");
    let sessionId = options.session;
    if (!sessionId && existsSync(sessionIdFile)) {
      sessionId = readFileSync(sessionIdFile, "utf-8").trim();
    }

    if (!sessionId) {
      output(ctx, errorResponse("NO_SESSION", "No session ID found for resume"), () => {
        console.error(chalk.red("Error: No session ID found for resume"));
        console.log(chalk.gray("Session ID file not found at: " + sessionIdFile));
      });
      process.exit(1);
      return;
    }

    // Build resume command based on platform
    const platform = agent.platform || "claude";
    let resumeCmd: string[];

    switch (platform) {
      case "opencode":
        resumeCmd = ["opencode", "run", "--session", sessionId];
        break;
      case "codex":
        resumeCmd = ["codex", "resume", sessionId];
        break;
      case "kiro":
        resumeCmd = ["kiro", "resume", sessionId];
        break;
      case "gemini":
        resumeCmd = ["gemini", "--resume", sessionId];
        break;
      default:
        resumeCmd = ["claude", "--resume", sessionId];
    }

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

  // Run start.py
  if (ctx.json) {
    const result = await runPythonScript(repoRoot, "start.py", args, {
      verbose: ctx.verbose,
    });

    if (result.exitCode === 0) {
      // Read registry to get the started agent
      const registry = readRegistry(repoRoot);
      const agent = findAgent(registry, taskName);
      output(ctx, successResponse({ agent, output: result.stdout }));
    } else {
      output(ctx, errorResponse("START_FAILED", result.stderr || result.stdout));
    }

    process.exit(result.exitCode);
  } else {
    const exitCode = await runPythonScriptPassthrough(repoRoot, "start.py", args);
    process.exit(exitCode);
  }
}

/**
 * Stop a running agent
 */
async function stopAgent(
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
async function showStatus(
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
  // Build args for status.py
  const args: string[] = [];

  if (taskName) {
    if (options.detail) {
      args.push("--detail", taskName);
    } else if (options.watch) {
      args.push("--watch", taskName);
    } else if (options.log) {
      args.push("--log", taskName);
    } else {
      args.push("--detail", taskName);
    }
  } else if (options.running) {
    // Filter handled in Python script output
  } else if (options.stopped) {
    // Filter handled in Python script output
  }

  if (ctx.json && !options.watch) {
    // For JSON output, read registry directly and compute status in TypeScript
    // This avoids redundant Python script call and ensures consistency
    const registry = readRegistry(repoRoot);
    const agents = registry.agents.map((agent) => ({
      ...agent,
      running: isProcessRunning(agent.pid),
    }));

    // Apply filters
    let filteredAgents = agents;
    if (options.running) {
      filteredAgents = agents.filter((a) => a.running);
    } else if (options.stopped) {
      filteredAgents = agents.filter((a) => !a.running);
    }

    output(ctx, successResponse({ agents: filteredAgents }));
  } else {
    // Passthrough mode for interactive output
    const exitCode = await runPythonScriptPassthrough(repoRoot, "status.py", args);
    process.exit(exitCode);
  }
}

/**
 * Show agent registry
 */
async function showRegistry(
  ctx: OutputContext,
  repoRoot: string
): Promise<void> {
  if (ctx.json) {
    const registry = readRegistry(repoRoot);
    const registryPath = getRegistryPath(repoRoot);
    output(ctx, successResponse({ path: registryPath, ...registry }));
  } else {
    const exitCode = await runPythonScriptPassthrough(
      repoRoot,
      "status.py",
      ["--registry"]
    );
    process.exit(exitCode);
  }
}

/**
 * Cleanup worktrees
 */
async function cleanupWorktrees(
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
  // Build args for cleanup.py
  const args: string[] = [];

  if (options.list) {
    args.push("--list");
  } else if (options.merged) {
    args.push("--merged");
  } else if (options.all) {
    args.push("--all");
  } else if (branch) {
    args.push(branch);
  } else {
    // Show help
    output(ctx, errorResponse("MISSING_ARG", "Branch name or --merged/--all required"), () => {
      console.error(chalk.red("Error: Branch name or --merged/--all required"));
      console.log();
      console.log("Usage:");
      console.log(chalk.gray("  viben swarm cleanup <branch>     Remove specific worktree"));
      console.log(chalk.gray("  viben swarm cleanup --merged     Remove merged worktrees"));
      console.log(chalk.gray("  viben swarm cleanup --all        Remove all worktrees"));
      console.log(chalk.gray("  viben swarm cleanup --list       List all worktrees"));
    });
    process.exit(1);
    return;
  }

  if (options.keepBranch) {
    args.push("--keep-branch");
  }

  if (options.yes) {
    args.push("--yes");
  }

  if (ctx.json && options.list) {
    const result = await runPythonScript(repoRoot, "cleanup.py", args);
    if (result.exitCode === 0) {
      output(ctx, successResponse({ output: result.stdout }));
    } else {
      output(ctx, errorResponse("CLEANUP_ERROR", result.stderr));
    }
  } else {
    const exitCode = await runPythonScriptPassthrough(repoRoot, "cleanup.py", args);
    process.exit(exitCode);
  }
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
        await listWorktrees(ctx, repoRoot);
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // swarm start - start an agent
  swarm
    .command("start")
    .description("Start an agent in a worktree")
    .argument("<task>", "Task name or directory")
    .option("--executor <type>", "Executor type (CLAUDE_CODE, CURSOR, etc.)")
    .option("--detach", "Run in background")
    .option("--resume", "Resume an existing session")
    .option("--session <id>", "Session ID for resume")
    .action(async (task: string, options) => {
      const ctx = getOutputContext(program);
      const repoRoot = findVibenRoot();

      if (!repoRoot) {
        handleCommandError(ctx, new Error("Not in a Viben workspace"));
        return;
      }

      try {
        await startAgent(ctx, repoRoot, task, options);
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
        await stopAgent(ctx, repoRoot, task, options);
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
        await showStatus(ctx, repoRoot, task, options);
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
        await showRegistry(ctx, repoRoot);
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // swarm cleanup - cleanup worktrees
  swarm
    .command("cleanup")
    .description("Cleanup worktrees and related resources")
    .argument("[branch]", "Branch name to cleanup")
    .option("--keep-branch", "Keep the git branch")
    .option("-y, --yes", "Skip confirmation prompts")
    .option("--merged", "Cleanup merged worktrees")
    .option("--all", "Cleanup all worktrees")
    .option("--list", "List all worktrees")
    .action(async (branch: string | undefined, options) => {
      const ctx = getOutputContext(program);
      const repoRoot = findVibenRoot();

      if (!repoRoot) {
        handleCommandError(ctx, new Error("Not in a Viben workspace"));
        return;
      }

      try {
        await cleanupWorktrees(ctx, repoRoot, branch, options);
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });
}
