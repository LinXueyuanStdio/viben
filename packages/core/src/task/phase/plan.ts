/**
 * Plan Phase Module
 *
 * Runs the Plan Agent for an existing task directory.
 * This is a refactored version of the `viben task plan` command logic.
 *
 * Key differences from `viben task plan`:
 * - Takes an existing task directory as input (does not create new one)
 * - Reads requirement from task.json's `title` or `description` field
 * - Used by `viben task plan-phase <task>`
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

// =============================================================================
// Types
// =============================================================================

/**
 * Options for running the plan phase
 */
export interface PlanPhaseOptions {
  /** Platform to use (default: "claude") */
  platform?: string;
  /** Enable verbose output (default: false) */
  verbose?: boolean;
}

/**
 * Result of running the plan phase
 */
export interface PlanPhaseResult {
  /** Whether the phase started successfully */
  success: boolean;
  /** Agent ID registered in the registry */
  agentId?: string;
  /** Process ID of the spawned agent */
  pid?: number;
  /** Path to the log file */
  logFile?: string;
  /** Error message if failed */
  error?: string;
}

// =============================================================================
// Validation Helpers
// =============================================================================


// =============================================================================
// Main Function
// =============================================================================

/**
 * Run the plan phase for a task
 *
 * This function:
 * 1. Validates the task directory and its task.json
 * 2. Verifies the plan agent exists for the platform
 * 3. Checks developer is initialized
 * 4. Spawns the Plan Agent in background
 * 5. Registers the agent to the registry
 *
 * @param repoRoot - Repository root path (absolute)
 * @param taskDir - Task directory path (relative or absolute)
 * @param options - Phase options
 * @returns PlanPhaseResult
 *
 * @example
 * ```typescript
 * import { runPlanPhase } from "@viben/core/task/phase/plan";
 *
 * const result = await runPlanPhase(
 *   "/path/to/repo",
 *   "03-12-my-task",  // or ".viben/tasks/03-12-my-task"
 *   { platform: "claude" }
 * );
 *
 * if (result.success) {
 *   console.log(`Plan Agent started (PID: ${result.pid})`);
 *   console.log(`Log file: ${result.logFile}`);
 * } else {
 *   console.error(`Failed: ${result.error}`);
 * }
 * ```
 */
export async function runPlanPhase(
  repoRoot: string,
  taskDir: string,
  options: PlanPhaseOptions = {}
): Promise<PlanPhaseResult> {
  const platform = options.platform || "claude";

  // ---------------------------------------------------------------------------
  // Step 1: Resolve task directory path
  // ---------------------------------------------------------------------------

  let taskDirAbs: string;
  let taskDirRel: string;

  if (taskDir.startsWith("/")) {
    // Absolute path
    taskDirAbs = taskDir;
    taskDirRel = relative(repoRoot, taskDir);
  } else if (taskDir.startsWith(".viben") || taskDir.includes("/")) {
    // Relative path from repo root
    taskDirAbs = join(repoRoot, taskDir);
    taskDirRel = taskDir;
  } else {
    // Task name only - look in tasks directory
    taskDirRel = `${DIR_VIBEN}/${DIR_TASKS}/${taskDir}`;
    taskDirAbs = join(repoRoot, taskDirRel);
  }

  // ---------------------------------------------------------------------------
  // Step 2: Validate task.json exists
  // ---------------------------------------------------------------------------

  const taskJsonPath = join(taskDirAbs, "task.json");
  if (!existsSync(taskJsonPath)) {
    return {
      success: false,
      error: `task.json not found at ${taskJsonPath}`,
    };
  }

  const taskData = readTaskJson(taskDirAbs);
  if (!taskData) {
    return {
      success: false,
      error: `Cannot read task.json at ${taskJsonPath}`,
    };
  }

  // ---------------------------------------------------------------------------
  // Step 3: Extract task info from task.json
  // ---------------------------------------------------------------------------

  // Get task name/id
  const taskName = String(taskData.name || taskData.id || "unknown");
  if (taskName === "unknown") {
    return {
      success: false,
      error: "task.json must have 'name' or 'id' field",
    };
  }

  // Get requirement from title AND description (both are important)
  const title = String(taskData.title || "").trim();
  const description = String(taskData.description || "").trim();

  // Combine title and description for full context
  let requirement = "";
  if (title && description) {
    requirement = `${title}\n\n${description}`;
  } else {
    requirement = title || description;
  }
  if (!requirement) {
    return {
      success: false,
      error: "task.json must have 'title' or 'description' field for requirement",
    };
  }

  // ---------------------------------------------------------------------------
  // Step 4: Validate plan agent exists
  // ---------------------------------------------------------------------------

  const adapter = createCLIAdapter(platform);
  const planMdPath = adapter.getAgentConfigPath("plan", repoRoot);

  if (!existsSync(planMdPath)) {
    return {
      success: false,
      error: `Plan agent not found at ${planMdPath}. Platform: ${platform}`,
    };
  }

  // ---------------------------------------------------------------------------
  // Step 5: Check developer is initialized
  // ---------------------------------------------------------------------------

  const developer = getDeveloper(repoRoot);
  if (!developer) {
    return {
      success: false,
      error: "Developer not initialized. Run 'viben user init' first.",
    };
  }

  // ---------------------------------------------------------------------------
  // Step 6: Set up log file
  // ---------------------------------------------------------------------------

  const logFile = join(taskDirAbs, "plan.log.jsonl");
  // Create empty log file
  writeFileSync(logFile, "", "utf-8");

  // ---------------------------------------------------------------------------
  // Step 7: Build environment variables
  // ---------------------------------------------------------------------------

  const env = { ...process.env };
  env.PLAN_TASK_NAME = taskName;
  env.PLAN_TASK_DIR = taskDirRel;
  env.PLAN_REQUIREMENT = requirement;
  Object.assign(env, adapter.getNonInteractiveEnv());

  // ---------------------------------------------------------------------------
  // Step 8: Build CLI command
  // ---------------------------------------------------------------------------

  const cliCmd = adapter.buildRunCommand({
    agent: "plan",
    prompt: `Start planning for task: ${taskName}`,
    skipPermissions: true,
    verbose: true,
    jsonOutput: true,
  });

  // ---------------------------------------------------------------------------
  // Step 9: Spawn background process
  // ---------------------------------------------------------------------------

  const logFd = openSync(logFile, "w");

  const spawnOpts: SpawnOptions = {
    cwd: repoRoot,
    env,
    stdio: ["ignore", logFd, logFd],
    detached: true,
  };

  const child = spawn(cliCmd[0], cliCmd.slice(1), spawnOpts);
  child.unref();

  const agentPid = child.pid || 0;

  if (agentPid === 0) {
    return {
      success: false,
      error: "Failed to spawn Plan Agent process",
    };
  }

  // ---------------------------------------------------------------------------
  // Step 10: Register agent to registry
  // ---------------------------------------------------------------------------

  const agentId = `plan-${taskName}`;

  registryAddAgent(
    {
      agentId,
      worktreePath: repoRoot,
      pid: agentPid,
      taskDir: taskDirRel,
      platform,
    },
    repoRoot
  );

  // ---------------------------------------------------------------------------
  // Return success result
  // ---------------------------------------------------------------------------

  if (options.verbose) {
    console.log(`[plan-phase] Task: ${taskName}`);
    console.log(`[plan-phase] Requirement: ${requirement}`);
    console.log(`[plan-phase] Agent ID: ${agentId}`);
    console.log(`[plan-phase] PID: ${agentPid}`);
    console.log(`[plan-phase] Log: ${logFile}`);
  }

  return {
    success: true,
    agentId,
    pid: agentPid,
    logFile,
  };
}
