/**
 * Reward Phase Runner
 *
 * Runs the reward agent to evaluate PR quality using configured reward types.
 * Outputs scores to reward.log.jsonl and updates task.json with results.
 *
 * Prerequisites:
 *    - task.json must exist
 *    - reward agent must exist (.claude/agents/reward.md)
 *    - pr_url should exist (PR created) - warning if missing
 *    - reward_config in task.json (or uses defaults)
 */

import {
  spawn,
  type SpawnOptions,
  type ChildProcess,
} from "node:child_process";
import { existsSync, writeFileSync, openSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import {
  readTaskJson,
  createCLIAdapter,
  registryAddAgent,
} from "../../cli/lib/viben-workspace";

import { getRewardType } from "../../reward/ops";
import type { RewardConfig } from "../../reward/ops/types";

// =============================================================================
// Constants
// =============================================================================

/** Default reward configuration if not specified in task.json */
export const DEFAULT_REWARD_CONFIG: RewardConfig = {
  types: ["test_coverage", "code_quality", "agent_review"],
  weights: [0.34, 0.33, 0.33],
};

// =============================================================================
// Types
// =============================================================================

/**
 * Options for running the reward phase
 */
export interface RewardPhaseOptions {
  /** Platform to use (default: "claude") */
  platform?: string;
  /** Enable verbose output */
  verbose?: boolean;
}

/**
 * Result of running the reward phase
 */
export interface RewardPhaseResult {
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
  /** Warning messages */
  warnings?: string[];
}

/**
 * Task data structure
 */
interface TaskData {
  id?: string;
  name?: string;
  pr_url?: string;
  reward_config?: RewardConfig;
  [key: string]: unknown;
}

/**
 * Entry in reward.jsonl file
 */
interface RewardJsonlEntry {
  file: string;
  reason: string;
  weight: number;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Generate reward.jsonl file from reward config
 *
 * @param repoRoot - Repository root path
 * @param taskDirAbs - Absolute path to task directory
 * @param config - Reward configuration
 * @returns Result with success status and warnings
 */
function generateRewardJsonl(
  repoRoot: string,
  taskDirAbs: string,
  config: RewardConfig
): { success: boolean; warnings: string[] } {
  const warnings: string[] = [];
  const entries: RewardJsonlEntry[] = [];

  for (let i = 0; i < config.types.length; i++) {
    const typeName = config.types[i];
    const weight = config.weights[i] ?? 1 / config.types.length;

    const rewardType = getRewardType(repoRoot, typeName);
    if (!rewardType) {
      warnings.push(`Reward type "${typeName}" not found, skipping`);
      continue;
    }

    entries.push({
      file: rewardType.promptPath,
      reason: typeName,
      weight,
    });
  }

  if (entries.length === 0) {
    return { success: false, warnings: ["No valid reward types found"] };
  }

  const jsonlPath = join(taskDirAbs, "reward.jsonl");
  const content = entries.map((e) => JSON.stringify(e)).join("\n") + "\n";
  writeFileSync(jsonlPath, content, "utf-8");

  return { success: true, warnings };
}

// =============================================================================
// Main Functions
// =============================================================================

/**
 * Run the reward phase for a task
 *
 * This function:
 * 1. Validates prerequisites (task.json, reward agent)
 * 2. Generates reward.jsonl from reward config
 * 3. Sets up environment variables
 * 4. Spawns the reward agent in background
 * 5. Registers the agent to the registry
 *
 * @param repoRoot - Repository root path
 * @param taskDir - Task directory path (relative or absolute)
 * @param options - Phase options
 * @returns RewardPhaseResult with success status and details
 */
export async function runRewardPhase(
  repoRoot: string,
  taskDir: string,
  options?: RewardPhaseOptions
): Promise<RewardPhaseResult> {
  const { platform = "claude", verbose = true } = options || {};
  const warnings: string[] = [];

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

  // 2. Check reward agent exists
  const rewardMd = adapter.getAgentConfigPath("reward", repoRoot);
  if (!existsSync(rewardMd)) {
    return {
      success: false,
      error: `reward.md not found at ${rewardMd}. Platform: ${platform}`,
    };
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

  // 3. Check pr_url exists (warning if missing)
  if (!taskData.pr_url) {
    warnings.push(
      "pr_url not found in task.json - PR may not have been created"
    );
  }

  // Get reward config (use defaults if not specified)
  const rewardConfig = taskData.reward_config || DEFAULT_REWARD_CONFIG;

  // =============================================================================
  // Generate reward.jsonl
  // =============================================================================

  const jsonlResult = generateRewardJsonl(repoRoot, taskDirAbs, rewardConfig);
  if (!jsonlResult.success) {
    return {
      success: false,
      error: jsonlResult.warnings.join("; "),
    };
  }
  warnings.push(...jsonlResult.warnings);

  // =============================================================================
  // Set Up Environment
  // =============================================================================

  const env: Record<string, string> = { ...process.env } as Record<
    string,
    string
  >;

  // Task-specific environment variables
  env.REWARD_TASK_NAME = taskName;
  env.REWARD_TASK_DIR = taskDirRelative;

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

Evaluate the PR quality using the reward types in reward.jsonl.

Read each reward type prompt, evaluate the code changes, and output JSON scores.`;

  const cliCmd = adapter.buildRunCommand({
    agent: "reward",
    prompt,
    skipPermissions: true,
    verbose,
    jsonOutput: true,
  });

  // =============================================================================
  // Spawn Background Process
  // =============================================================================

  const logFile = join(taskDirAbs, "reward.log.jsonl");

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
      error: `Failed to spawn reward agent: ${error}`,
    };
  }

  // Detach process so it continues running after parent exits
  child.unref();

  const agentPid = child.pid || 0;

  // =============================================================================
  // Register Agent to Registry
  // =============================================================================

  const agentId = `reward-${taskName}`;

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
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

/**
 * Run reward phase synchronously (for CLI commands)
 *
 * @param repoRoot - Repository root path
 * @param taskDir - Task directory path
 * @param options - Phase options
 * @returns RewardPhaseResult
 */
export function runRewardPhaseSync(
  repoRoot: string,
  taskDir: string,
  options?: RewardPhaseOptions
): RewardPhaseResult {
  const { platform = "claude", verbose = true } = options || {};
  const warnings: string[] = [];

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

  // 2. Check reward agent exists
  const rewardMd = adapter.getAgentConfigPath("reward", repoRoot);
  if (!existsSync(rewardMd)) {
    return {
      success: false,
      error: `reward.md not found at ${rewardMd}. Platform: ${platform}`,
    };
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

  // 3. Check pr_url exists (warning if missing)
  if (!taskData.pr_url) {
    warnings.push(
      "pr_url not found in task.json - PR may not have been created"
    );
  }

  // Get reward config (use defaults if not specified)
  const rewardConfig = taskData.reward_config || DEFAULT_REWARD_CONFIG;

  // =============================================================================
  // Generate reward.jsonl
  // =============================================================================

  const jsonlResult = generateRewardJsonl(repoRoot, taskDirAbs, rewardConfig);
  if (!jsonlResult.success) {
    return {
      success: false,
      error: jsonlResult.warnings.join("; "),
    };
  }
  warnings.push(...jsonlResult.warnings);

  // =============================================================================
  // Set Up Environment
  // =============================================================================

  const env: Record<string, string> = { ...process.env } as Record<
    string,
    string
  >;

  // Task-specific environment variables
  env.REWARD_TASK_NAME = taskName;
  env.REWARD_TASK_DIR = taskDirRelative;

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

Evaluate the PR quality using the reward types in reward.jsonl.

Read each reward type prompt, evaluate the code changes, and output JSON scores.`;

  const cliCmd = adapter.buildRunCommand({
    agent: "reward",
    prompt,
    skipPermissions: true,
    verbose,
    jsonOutput: true,
  });

  // =============================================================================
  // Spawn Background Process
  // =============================================================================

  const logFile = join(taskDirAbs, "reward.log.jsonl");

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
      error: `Failed to spawn reward agent: ${error}`,
    };
  }

  // Detach process so it continues running after parent exits
  child.unref();

  const agentPid = child.pid || 0;

  // =============================================================================
  // Register Agent to Registry
  // =============================================================================

  const agentId = `reward-${taskName}`;

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
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}
