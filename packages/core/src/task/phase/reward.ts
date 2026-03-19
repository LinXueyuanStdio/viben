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
  spawnSync,
  execSync,
  type SpawnOptions,
  type ChildProcess,
} from "node:child_process";
import { existsSync, writeFileSync, openSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import {
  readTaskJson,
  writeTaskJson,
  readJsonlFile,
  createCLIAdapter,
  registryAddAgent,
} from "../../cli/lib/viben-workspace";

import { getRewardType } from "../../reward/ops";
import type { RewardConfig, RewardResult, RewardScore } from "../../reward/ops/types";

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
  reward?: RewardResult;
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

/**
 * Single score entry from reward agent log
 */
interface RewardLogScoreEntry {
  type: string;
  score: number;
  reasoning: string;
}

/**
 * Summary entry from reward agent log
 */
interface RewardLogSummaryEntry {
  _summary: true;
  scores: Record<string, { score: number; reasoning: string }>;
  completed: boolean;
}

/**
 * Result of parsing reward log
 */
export interface ParseRewardResultOutput {
  /** Whether parsing was successful */
  success: boolean;
  /** Parsed reward result (if successful) */
  reward?: RewardResult;
  /** Error message (if failed) */
  error?: string;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Check if an entry is a score entry (has type, score, reasoning)
 */
function isScoreEntry(entry: unknown): entry is RewardLogScoreEntry {
  if (typeof entry !== "object" || entry === null) return false;
  const obj = entry as Record<string, unknown>;
  return (
    typeof obj.type === "string" &&
    typeof obj.score === "number" &&
    typeof obj.reasoning === "string" &&
    !("_summary" in obj)
  );
}

/**
 * Check if an entry is a summary entry
 */
function isSummaryEntry(entry: unknown): entry is RewardLogSummaryEntry {
  if (typeof entry !== "object" || entry === null) return false;
  const obj = entry as Record<string, unknown>;
  return obj._summary === true && typeof obj.scores === "object";
}

/**
 * Get diff lines count using git diff --stat
 *
 * @param repoRoot - Repository root path
 * @param baseBranch - Base branch to compare against (default: main)
 * @returns Number of lines changed, or 0 if error
 */
function getDiffLines(repoRoot: string, baseBranch: string = "main"): number {
  try {
    // Try origin/main first, then main
    let output: string;
    try {
      output = execSync(`git diff --stat origin/${baseBranch}..HEAD`, {
        cwd: repoRoot,
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      });
    } catch {
      // Fallback to local main
      output = execSync(`git diff --stat ${baseBranch}..HEAD`, {
        cwd: repoRoot,
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      });
    }

    // Parse the last line of git diff --stat output
    // Example: " 5 files changed, 120 insertions(+), 30 deletions(-)"
    const lines = output.trim().split("\n");
    const lastLine = lines[lines.length - 1] || "";

    // Extract insertions and deletions
    const insertionsMatch = lastLine.match(/(\d+) insertion/);
    const deletionsMatch = lastLine.match(/(\d+) deletion/);

    const insertions = insertionsMatch ? parseInt(insertionsMatch[1], 10) : 0;
    const deletions = deletionsMatch ? parseInt(deletionsMatch[1], 10) : 0;

    return insertions + deletions;
  } catch {
    return 0;
  }
}

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
 * This function:
 * 1. Validates prerequisites
 * 2. Generates reward.jsonl
 * 3. Runs reward agent SYNCHRONOUSLY (waits for completion)
 * 4. Parses results and writes to task.json
 *
 * @param repoRoot - Repository root path
 * @param taskDir - Task directory path
 * @param options - Phase options
 * @returns RewardPhaseResult with reward data
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
  let taskDirAbs: string;

  if (taskDir.startsWith("/")) {
    taskDirAbs = taskDir;
  } else {
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
  env.REWARD_TASK_DIR = taskDirAbs;

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
  // Run Agent Synchronously
  // =============================================================================

  const logFile = join(taskDirAbs, "reward.log.jsonl");

  // Open log file for writing
  const logFd = openSync(logFile, "w");

  // Run synchronously using spawnSync
  const result = spawnSync(cliCmd[0], cliCmd.slice(1), {
    cwd: repoRoot,
    env,
    stdio: ["ignore", logFd, logFd],
    maxBuffer: 50 * 1024 * 1024, // 50MB buffer
  });

  // Check for spawn errors
  if (result.error) {
    return {
      success: false,
      error: `Failed to run reward agent: ${result.error.message}`,
      logFile,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  // Agent may exit with non-zero code but still produce valid output
  if (result.status !== 0) {
    warnings.push(`Agent exited with code ${result.status}`);
  }

  // =============================================================================
  // Parse Results and Write to task.json
  // =============================================================================

  const parseResult = parseRewardResult(repoRoot, taskDir);

  if (!parseResult.success) {
    return {
      success: false,
      error: parseResult.error,
      logFile,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  // =============================================================================
  // Return Result
  // =============================================================================

  return {
    success: true,
    logFile,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

// =============================================================================
// Result Parsing
// =============================================================================

/**
 * Parse reward agent log and write results to task.json
 *
 * This function:
 * 1. Reads reward.log.jsonl
 * 2. Parses JSON lines to find score entries and summary
 * 3. Calculates weighted total from reward.jsonl weights
 * 4. Gets diff lines using git diff --stat
 * 5. Writes the reward field to task.json
 *
 * Can be called:
 * - After agent completes (via swarm wait callback)
 * - Manually via CLI command
 *
 * @param repoRoot - Repository root path
 * @param taskDir - Task directory path (relative or absolute)
 * @returns ParseRewardResultOutput with success status and parsed reward
 */
export function parseRewardResult(
  repoRoot: string,
  taskDir: string
): ParseRewardResultOutput {
  // Normalize paths
  let taskDirAbs: string;

  if (taskDir.startsWith("/")) {
    taskDirAbs = taskDir;
  } else {
    taskDirAbs = resolve(repoRoot, taskDir);
  }

  // Check task.json exists
  const taskJsonPath = join(taskDirAbs, "task.json");
  if (!existsSync(taskJsonPath)) {
    return {
      success: false,
      error: `task.json not found at ${taskJsonPath}`,
    };
  }

  // Check reward.log.jsonl exists
  const logFile = join(taskDirAbs, "reward.log.jsonl");
  if (!existsSync(logFile)) {
    return {
      success: false,
      error: `reward.log.jsonl not found at ${logFile}`,
    };
  }

  // Read task data
  const taskData = readTaskJson(taskDirAbs) as TaskData | null;
  if (!taskData) {
    return {
      success: false,
      error: "Failed to read task.json",
    };
  }

  // Read reward.jsonl for weights
  const rewardJsonlPath = join(taskDirAbs, "reward.jsonl");
  const rewardConfigRaw = readJsonlFile(rewardJsonlPath);

  // Build weights map from reward.jsonl (reason -> weight)
  const weightsMap: Record<string, number> = {};
  for (const entry of rewardConfigRaw) {
    // Validate entry has required fields
    if (
      typeof entry.reason === "string" &&
      typeof entry.weight === "number"
    ) {
      weightsMap[entry.reason] = entry.weight;
    }
  }

  // Parse reward.log.jsonl
  // The log file contains Claude's JSON output, which may have JSON embedded in text
  const logContent = readFileSync(logFile, "utf-8");
  const scores: Record<string, RewardScore> = {};

  // Try to find JSON objects in the log content
  // Strategy 1: Try parsing each line as JSON directly
  // Strategy 2: Look for JSON patterns in the content

  const lines = logContent.split("\n");

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;

    // Try to extract JSON from the line
    // The log may contain JSONL output from Claude, which includes JSON objects
    const jsonMatches = trimmedLine.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g);

    if (jsonMatches) {
      for (const jsonStr of jsonMatches) {
        try {
          const parsed = JSON.parse(jsonStr);

          if (isSummaryEntry(parsed)) {
            // Found summary - use its scores
            for (const [typeName, scoreData] of Object.entries(parsed.scores)) {
              const data = scoreData as { score: number; reasoning: string };
              scores[typeName] = {
                score: data.score,
                reasoning: data.reasoning,
              };
            }
          } else if (isScoreEntry(parsed)) {
            // Individual score entry
            scores[parsed.type] = {
              score: parsed.score,
              reasoning: parsed.reasoning,
            };
          }
        } catch {
          // Not valid JSON, skip
        }
      }
    }
  }

  // Check if we found any scores
  if (Object.keys(scores).length === 0) {
    return {
      success: false,
      error: "No score entries found in reward.log.jsonl. Agent may not have completed evaluation.",
    };
  }

  // Calculate weighted total
  let total = 0;
  let totalWeight = 0;

  for (const [typeName, scoreData] of Object.entries(scores)) {
    const weight = weightsMap[typeName] ?? (1 / Object.keys(scores).length);
    total += scoreData.score * weight;
    totalWeight += weight;
  }

  // Normalize if weights don't sum to 1
  if (totalWeight > 0 && totalWeight !== 1) {
    total = total / totalWeight;
  }

  // Get diff lines
  const diffLines = getDiffLines(repoRoot);

  // Build reward result
  const reward: RewardResult = {
    scores,
    total,
    diffLines,
    computedAt: new Date().toISOString(),
  };

  // Update task.json with reward field
  taskData.reward = reward;

  const writeSuccess = writeTaskJson(taskDirAbs, taskData);
  if (!writeSuccess) {
    return {
      success: false,
      error: "Failed to write reward to task.json",
    };
  }

  return {
    success: true,
    reward,
  };
}
