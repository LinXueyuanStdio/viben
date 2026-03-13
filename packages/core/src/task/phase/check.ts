/**
 * Review Phase Module
 *
 * Runs the "check" agent to review code changes against requirements.
 * This is part of the task phase system where:
 * - plan.ts calls the "plan" agent
 * - implement.ts calls the "implement" agent
 * - review.ts calls the "check" agent (this module)
 *
 * @example
 * ```typescript
 * import { runCheckPhase } from "@viben/core/task/phase/review";
 *
 * const result = await runCheckPhase(repoRoot, taskDir, { verbose: true });
 * if (result.success) {
 *   console.log(`Review agent started: PID ${result.pid}`);
 * }
 * ```
 */

import { spawn, type SpawnOptions } from "node:child_process";
import { existsSync, writeFileSync, openSync } from "node:fs";
import { join, relative } from "node:path";

import {
  readTaskJson,
  getDeveloper,
  createCLIAdapter,
  registryAddAgent,
  DIR_VIBEN,
  DIR_TASKS,
} from "../../cli/lib/viben-workspace";

import { buildContextSection } from "../ops/context-prompt";

// =============================================================================
// Types
// =============================================================================

/**
 * Options for running the review phase
 */
export interface CheckPhaseOptions {
  /** Platform to use (default: "claude") */
  platform?: string;
  /** Enable verbose output */
  verbose?: boolean;
}

/**
 * Result of running the review phase
 */
export interface CheckPhaseResult {
  /** Whether the phase started successfully */
  success: boolean;
  /** Agent ID in the registry */
  agentId?: string;
  /** Process ID of the spawned agent */
  pid?: number;
  /** Path to the log file */
  logFile?: string;
  /** Error message if failed */
  error?: string;
}

// =============================================================================
// Review Phase Implementation
// =============================================================================

/**
 * Run the review (check) phase for a task
 *
 * This function:
 * 1. Validates that task.json, prd.md exist (check.jsonl is optional)
 * 2. Validates that the "check" agent exists for the platform
 * 3. Spawns the check agent in background mode
 * 4. Registers the agent in the registry
 *
 * @param repoRoot - Repository root path
 * @param taskDir - Task directory path (relative or absolute)
 * @param options - Phase options
 * @returns CheckPhaseResult with success status and details
 */
export async function runCheckPhase(
  repoRoot: string,
  taskDir: string,
  options?: CheckPhaseOptions
): Promise<CheckPhaseResult> {
  const platform = options?.platform || "claude";
  const verbose = options?.verbose ?? true;

  // Initialize CLI adapter
  const adapter = createCLIAdapter(platform);

  // Resolve task directory to absolute path
  let taskDirAbs: string;
  if (taskDir.startsWith("/")) {
    taskDirAbs = taskDir;
  } else if (taskDir.startsWith(DIR_VIBEN)) {
    taskDirAbs = join(repoRoot, taskDir);
  } else {
    // Assume it's a task name, resolve from tasks directory
    taskDirAbs = join(repoRoot, DIR_VIBEN, DIR_TASKS, taskDir);
  }

  // Get relative path for environment variable
  let taskDirRelative: string;
  try {
    taskDirRelative = relative(repoRoot, taskDirAbs);
  } catch {
    taskDirRelative = taskDir;
  }

  // Validate task.json exists
  const taskJsonPath = join(taskDirAbs, "task.json");
  if (!existsSync(taskJsonPath)) {
    return {
      success: false,
      error: `task.json not found at ${taskJsonPath}`,
    };
  }

  // Read task.json for task info
  const taskData = readTaskJson(taskDirAbs);
  if (!taskData) {
    return {
      success: false,
      error: "Failed to read task.json",
    };
  }

  const taskName = (taskData.name as string) || (taskData.id as string) || "unknown";

  // Validate prd.md exists (requirements to check against)
  const prdPath = join(taskDirAbs, "prd.md");
  if (!existsSync(prdPath)) {
    return {
      success: false,
      error: `prd.md not found at ${prdPath}. Requirements document is required for review.`,
    };
  }

  // check.jsonl is optional - build context section if it exists
  const contextSection = buildContextSection(
    taskDirAbs,
    "check.jsonl",
    "Code-Spec Files to Read"
  );

  // Check that the "check" agent exists for the platform
  const checkAgentPath = adapter.getAgentConfigPath("check", repoRoot);
  if (!existsSync(checkAgentPath)) {
    return {
      success: false,
      error: `Check agent not found at ${checkAgentPath}. Platform: ${platform}`,
    };
  }

  // Check developer is initialized
  const developer = getDeveloper(repoRoot);
  if (!developer) {
    return {
      success: false,
      error: "Developer not initialized. Run 'viben user init' first.",
    };
  }

  // Create log file
  const logFile = join(taskDirAbs, ".review-log");
  writeFileSync(logFile, "", "utf-8");

  // Build environment variables
  const env = { ...process.env };
  env.REVIEW_TASK_NAME = taskName;
  env.REVIEW_TASK_DIR = taskDirRelative;
  Object.assign(env, adapter.getNonInteractiveEnv());

  // Build the prompt for the check agent
  const prompt = `Review all code changes against the code-spec requirements.

Task directory: ${taskDirRelative}

${contextSection ? contextSection + "\n\n" : ""}Fix any issues you find directly.
Ensure lint and typecheck pass.`;

  // Build CLI command using the adapter
  const cliCmd = adapter.buildRunCommand({
    agent: "check",
    prompt,
    skipPermissions: true,
    verbose: verbose,
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

  try {
    const child = spawn(cliCmd[0], cliCmd.slice(1), spawnOpts);
    child.unref();

    const agentPid = child.pid || 0;
    const agentId = `review-${taskName}`;

    // Register agent in registry
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

    return {
      success: true,
      agentId,
      pid: agentPid,
      logFile,
    };
  } catch (err) {
    const error = err as Error;
    return {
      success: false,
      error: `Failed to spawn check agent: ${error.message}`,
    };
  }
}
