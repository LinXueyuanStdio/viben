/**
 * Implement Phase Runner
 *
 * Runs the implement agent for a task in the current repository (no worktree).
 * This is a simpler phase runner that spawns an agent in the background.
 *
 * Prerequisites:
 *    - task.json must exist
 *    - implement agent must exist (.claude/agents/implement.md or platform equivalent)
 *    - prd.md must exist (plan phase completed)
 *    - implement.jsonl must exist (context configured)
 *
 * The agent will:
 *    1. Read prd.md for requirements
 *    2. Read info.md for technical design (if exists)
 *    3. Read all spec files from implement.jsonl
 *    4. Implement the feature following specs
 *    5. Run lint and typecheck to verify
 */

import { spawn, type SpawnOptions, type ChildProcess } from "node:child_process";
import { existsSync, writeFileSync, openSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import {
  readTaskJson,
  createCLIAdapter,
  registryAddAgent,
} from "../../cli/lib/viben-workspace";

// =============================================================================
// Types
// =============================================================================

/**
 * Options for running the implement phase
 */
export interface ImplementPhaseOptions {
  /** Platform to use (default: "claude") */
  platform?: string;
  /** Enable verbose output */
  verbose?: boolean;
}

/**
 * Result of running the implement phase
 */
export interface ImplementPhaseResult {
  /** Whether the phase started successfully */
  success: boolean;
  /** Agent ID for tracking */
  agentId?: string;
  /** Process ID of the spawned agent */
  pid?: number;
  /** Path to the log file */
  logFile?: string;
  /** Error message if failed */
  error?: string;
}

/**
 * Task data structure
 */
interface TaskData {
  id?: string;
  name?: string;
  dev_type?: string;
  [key: string]: unknown;
}

// =============================================================================
// Main Function
// =============================================================================

/**
 * Run the implement phase for a task
 *
 * This function:
 * 1. Validates prerequisites (task.json, implement agent, prd.md, implement.jsonl)
 * 2. Sets up environment variables
 * 3. Spawns the implement agent in background
 * 4. Registers the agent to the registry
 *
 * @param repoRoot - Repository root path
 * @param taskDir - Task directory path (relative or absolute)
 * @param options - Phase options
 * @returns ImplementPhaseResult with success status and details
 */
export async function runImplementPhase(
  repoRoot: string,
  taskDir: string,
  options?: ImplementPhaseOptions
): Promise<ImplementPhaseResult> {
  const { platform = "claude", verbose = true } = options || {};

  // Initialize CLI adapter
  const adapter = createCLIAdapter(platform);

  // Normalize paths
  let taskDirRelative: string;
  let taskDirAbs: string;

  if (taskDir.startsWith("/")) {
    taskDirAbs = taskDir;
    taskDirRelative = relative(repoRoot, taskDir);
  } else {
    taskDirRelative = taskDir;
    taskDirAbs = resolve(repoRoot, taskDir);
  }

  // =============================================================================
  // Validation
  // =============================================================================

  // 1. Check task.json exists
  const taskJsonPath = join(taskDirAbs, "task.json");
  if (!existsSync(taskJsonPath)) {
    return {
      success: false,
      error: `task.json not found at ${taskJsonPath}`,
    };
  }

  // 2. Check implement agent exists
  const implementMd = adapter.getAgentConfigPath("implement", repoRoot);
  if (!existsSync(implementMd)) {
    return {
      success: false,
      error: `implement.md not found at ${implementMd}. Platform: ${platform}`,
    };
  }

  // 3. Check prd.md exists (plan phase completed)
  const prdFile = join(taskDirAbs, "prd.md");
  if (!existsSync(prdFile)) {
    return {
      success: false,
      error: `prd.md not found at ${prdFile}. Run plan phase first.`,
    };
  }

  // 4. Check implement.jsonl exists (context configured)
  const implementJsonl = join(taskDirAbs, "implement.jsonl");
  if (!existsSync(implementJsonl)) {
    // Try spec.jsonl as fallback
    const specJsonl = join(taskDirAbs, "spec.jsonl");
    if (!existsSync(specJsonl)) {
      return {
        success: false,
        error: `implement.jsonl not found at ${implementJsonl}. Run context configuration first.`,
      };
    }
  }

  // =============================================================================
  // Read Task Config
  // =============================================================================

  const taskData = readTaskJson(taskDirAbs) as TaskData | null;
  if (!taskData) {
    return {
      success: false,
      error: "Failed to read task.json",
    };
  }

  // Get task identification
  const taskName = taskData.name || taskData.id || "unknown";
  const devType = taskData.dev_type || "unknown";

  // =============================================================================
  // Set Up Environment
  // =============================================================================

  const env: Record<string, string> = { ...process.env } as Record<string, string>;

  // Task-specific environment variables
  env.IMPLEMENT_TASK_NAME = taskName;
  env.IMPLEMENT_TASK_DIR = taskDirRelative;
  env.IMPLEMENT_DEV_TYPE = devType;

  // Proxy environment variables
  env.https_proxy = process.env.https_proxy || "";
  env.http_proxy = process.env.http_proxy || "";
  env.all_proxy = process.env.all_proxy || "";

  // Platform non-interactive env
  Object.assign(env, adapter.getNonInteractiveEnv());

  // =============================================================================
  // Build CLI Command
  // =============================================================================

  const prompt = `task_dir: ${taskDirAbs}

Implement the task described in prd.md.

Follow all code-spec files that have been injected into your context (implement.jsonl).
Run lint and typecheck before finishing.`;

  const cliCmd = adapter.buildRunCommand({
    agent: "implement",
    prompt,
    skipPermissions: true,
    verbose,
    jsonOutput: true,
  });

  // =============================================================================
  // Spawn Background Process
  // =============================================================================

  const logFile = join(taskDirAbs, ".implement-log");

  // Create empty log file
  writeFileSync(logFile, "", "utf-8");

  // Open log file for writing
  const logFd = openSync(logFile, "w");

  // Spawn options
  const spawnOpts: SpawnOptions = {
    cwd: repoRoot,
    env,
    stdio: ["ignore", logFd, logFd],
    detached: true,
  };

  let child: ChildProcess;
  try {
    child = spawn(cliCmd[0], cliCmd.slice(1), spawnOpts);
  } catch (error) {
    return {
      success: false,
      error: `Failed to spawn implement agent: ${error}`,
    };
  }

  // Detach process so it continues running after parent exits
  child.unref();

  const agentPid = child.pid || 0;

  // =============================================================================
  // Register Agent to Registry
  // =============================================================================

  const agentId = `implement-${taskName}`;

  registryAddAgent(
    {
      agentId,
      worktreePath: repoRoot,
      pid: agentPid,
      taskDir: taskDirRelative,
      platform,
    },
    repoRoot
  );

  // =============================================================================
  // Return Result
  // =============================================================================

  return {
    success: true,
    agentId,
    pid: agentPid,
    logFile,
  };
}

/**
 * Run implement phase synchronously (for CLI commands)
 *
 * @param repoRoot - Repository root path
 * @param taskDir - Task directory path
 * @param options - Phase options
 * @returns ImplementPhaseResult
 */
export function runImplementPhaseSync(
  repoRoot: string,
  taskDir: string,
  options?: ImplementPhaseOptions
): ImplementPhaseResult {
  const { platform = "claude", verbose = true } = options || {};

  // Initialize CLI adapter
  const adapter = createCLIAdapter(platform);

  // Normalize paths
  let taskDirRelative: string;
  let taskDirAbs: string;

  if (taskDir.startsWith("/")) {
    taskDirAbs = taskDir;
    taskDirRelative = relative(repoRoot, taskDir);
  } else {
    taskDirRelative = taskDir;
    taskDirAbs = resolve(repoRoot, taskDir);
  }

  // =============================================================================
  // Validation
  // =============================================================================

  // 1. Check task.json exists
  const taskJsonPath = join(taskDirAbs, "task.json");
  if (!existsSync(taskJsonPath)) {
    return {
      success: false,
      error: `task.json not found at ${taskJsonPath}`,
    };
  }

  // 2. Check implement agent exists
  const implementMd = adapter.getAgentConfigPath("implement", repoRoot);
  if (!existsSync(implementMd)) {
    return {
      success: false,
      error: `implement.md not found at ${implementMd}. Platform: ${platform}`,
    };
  }

  // 3. Check prd.md exists (plan phase completed)
  const prdFile = join(taskDirAbs, "prd.md");
  if (!existsSync(prdFile)) {
    return {
      success: false,
      error: `prd.md not found at ${prdFile}. Run plan phase first.`,
    };
  }

  // 4. Check implement.jsonl exists (context configured)
  const implementJsonl = join(taskDirAbs, "implement.jsonl");
  if (!existsSync(implementJsonl)) {
    // Try spec.jsonl as fallback
    const specJsonl = join(taskDirAbs, "spec.jsonl");
    if (!existsSync(specJsonl)) {
      return {
        success: false,
        error: `implement.jsonl not found at ${implementJsonl}. Run context configuration first.`,
      };
    }
  }

  // =============================================================================
  // Read Task Config
  // =============================================================================

  const taskData = readTaskJson(taskDirAbs) as TaskData | null;
  if (!taskData) {
    return {
      success: false,
      error: "Failed to read task.json",
    };
  }

  // Get task identification
  const taskName = taskData.name || taskData.id || "unknown";
  const devType = taskData.dev_type || "unknown";

  // =============================================================================
  // Set Up Environment
  // =============================================================================

  const env: Record<string, string> = { ...process.env } as Record<string, string>;

  // Task-specific environment variables
  env.IMPLEMENT_TASK_NAME = taskName;
  env.IMPLEMENT_TASK_DIR = taskDirRelative;
  env.IMPLEMENT_DEV_TYPE = devType;

  // Proxy environment variables
  env.https_proxy = process.env.https_proxy || "";
  env.http_proxy = process.env.http_proxy || "";
  env.all_proxy = process.env.all_proxy || "";

  // Platform non-interactive env
  Object.assign(env, adapter.getNonInteractiveEnv());

  // =============================================================================
  // Build CLI Command
  // =============================================================================

  const prompt = `task_dir: ${taskDirAbs}

Implement the task described in prd.md.

Follow all code-spec files that have been injected into your context (implement.jsonl).
Run lint and typecheck before finishing.`;

  const cliCmd = adapter.buildRunCommand({
    agent: "implement",
    prompt,
    skipPermissions: true,
    verbose,
    jsonOutput: true,
  });

  // =============================================================================
  // Spawn Background Process
  // =============================================================================

  const logFile = join(taskDirAbs, ".implement-log");

  // Create empty log file
  writeFileSync(logFile, "", "utf-8");

  // Open log file for writing
  const logFd = openSync(logFile, "w");

  // Spawn options
  const spawnOpts: SpawnOptions = {
    cwd: repoRoot,
    env,
    stdio: ["ignore", logFd, logFd],
    detached: true,
  };

  let child: ChildProcess;
  try {
    child = spawn(cliCmd[0], cliCmd.slice(1), spawnOpts);
  } catch (error) {
    return {
      success: false,
      error: `Failed to spawn implement agent: ${error}`,
    };
  }

  // Detach process so it continues running after parent exits
  child.unref();

  const agentPid = child.pid || 0;

  // =============================================================================
  // Register Agent to Registry
  // =============================================================================

  const agentId = `implement-${taskName}`;

  registryAddAgent(
    {
      agentId,
      worktreePath: repoRoot,
      pid: agentPid,
      taskDir: taskDirRelative,
      platform,
    },
    repoRoot
  );

  // =============================================================================
  // Return Result
  // =============================================================================

  return {
    success: true,
    agentId,
    pid: agentPid,
    logFile,
  };
}
