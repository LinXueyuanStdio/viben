/**
 * Reward Phase Runner
 *
 * Runs the reward agent to evaluate PR quality using configured reward types.
 *
 * Two modes of operation:
 * 1. FileRL mode (when task.filerl_dir is set):
 *    - Reads reward_config from FileRL state.json
 *    - Outputs to .viben/filerl/<name>/iter<N>/<task>/reward.json
 *    - Logs to .viben/filerl/<name>/iter<N>/<task>/reward.log.jsonl
 *
 * 2. Standalone mode (when task.filerl_dir is not set):
 *    - Uses reward_config from task.json or defaults
 *    - Outputs to task.json.reward
 *    - Logs to <task-dir>/reward.log.jsonl
 *
 * Prerequisites:
 *    - task.json must exist
 *    - reward agent must exist (.claude/agents/reward.md)
 *    - pr_url should exist (PR created) - warning if missing
 */

import { spawnSync, execSync } from "node:child_process";
import { existsSync, writeFileSync, openSync, closeSync, readFileSync, mkdirSync } from "node:fs";
import { join, resolve, basename } from "node:path";

import {
  readTaskJson,
  writeTaskJson,
  readJsonlFile,
  createCLIAdapter,
} from "../../cli/lib/viben-workspace";

import { getRewardType } from "../../reward/ops";
import type { RewardConfig, RewardResult, RewardScore } from "../../reward/ops/types";
import { DEFAULT_REWARD_CONFIG } from "../../reward/ops/types";

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
  /** FileRL directory for reward config and output */
  filerl_dir?: string;
  [key: string]: unknown;
}

/**
 * FileRL state structure (subset of fields we need)
 */
interface FileRlStateData {
  name: string;
  current_iteration: number;
  target_path?: string;
  [key: string]: unknown;
}

/**
 * FileRL target config structure (subset of fields we need)
 */
interface FileRlTargetConfig {
  reward?: RewardConfig;
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
 * Extract JSON objects from text content using bracket matching
 *
 * This handles arbitrarily nested JSON objects by counting braces.
 * More robust than regex-based approaches for nested structures.
 *
 * @param content - Text content potentially containing JSON objects
 * @returns Array of JSON strings found in the content
 */
function extractJsonObjects(content: string): string[] {
  const results: string[] = [];
  let i = 0;

  while (i < content.length) {
    // Find the start of a potential JSON object
    if (content[i] === "{") {
      let depth = 1;
      let start = i;
      let inString = false;
      let escapeNext = false;
      i++;

      // Track bracket depth to find matching closing brace
      while (i < content.length && depth > 0) {
        const char = content[i];

        if (escapeNext) {
          escapeNext = false;
        } else if (char === "\\") {
          escapeNext = true;
        } else if (char === '"') {
          inString = !inString;
        } else if (!inString) {
          if (char === "{") {
            depth++;
          } else if (char === "}") {
            depth--;
          }
        }
        i++;
      }

      // If we found a complete object (depth returned to 0)
      if (depth === 0) {
        const jsonStr = content.slice(start, i);
        results.push(jsonStr);
      }
    } else {
      i++;
    }
  }

  return results;
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
 * Read FileRL state from filerl_dir
 *
 * @param filerlDir - Absolute path to FileRL directory
 * @returns FileRL state or null if not found
 */
function readFileRlState(filerlDir: string): FileRlStateData | null {
  const statePath = join(filerlDir, "state.json");
  if (!existsSync(statePath)) {
    return null;
  }

  try {
    const content = readFileSync(statePath, "utf-8");
    return JSON.parse(content) as FileRlStateData;
  } catch {
    return null;
  }
}

/**
 * Read FileRL target config to get reward_config
 *
 * @param targetPath - Absolute path to target file
 * @returns Reward config or null if not found
 */
function readFileRlRewardConfig(targetPath: string): RewardConfig | null {
  if (!existsSync(targetPath)) {
    return null;
  }

  try {
    const content = readFileSync(targetPath, "utf-8");

    // Parse YAML frontmatter using gray-matter pattern
    const frontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n---/;
    const match = content.match(frontmatterRegex);
    if (!match) {
      return null;
    }

    // Simple YAML parsing for reward config
    const yamlContent = match[1];
    const lines = yamlContent.split("\n");

    let inReward = false;
    let inTypes = false;
    let inWeights = false;
    const types: string[] = [];
    const weights: number[] = [];

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed === "reward:") {
        inReward = true;
        continue;
      }

      if (inReward) {
        if (trimmed === "types:") {
          inTypes = true;
          inWeights = false;
          continue;
        }
        if (trimmed === "weights:") {
          inWeights = true;
          inTypes = false;
          continue;
        }

        // Check if we've exited reward section
        if (!line.startsWith(" ") && !line.startsWith("\t") && trimmed !== "") {
          inReward = false;
          continue;
        }

        if (inTypes && trimmed.startsWith("- ")) {
          types.push(trimmed.slice(2).trim());
        }
        if (inWeights && trimmed.startsWith("- ")) {
          const value = parseFloat(trimmed.slice(2).trim());
          if (!isNaN(value)) {
            weights.push(value);
          }
        }
      }
    }

    if (types.length === 0) {
      return null;
    }

    // Normalize weights to match types length
    const normalizedWeights = weights.length === types.length
      ? weights
      : types.map(() => 1 / types.length);

    return { types, weights: normalizedWeights };
  } catch {
    return null;
  }
}

/**
 * Get the output directory for reward results
 *
 * @param filerlDir - FileRL directory (or null for standalone mode)
 * @param iteration - Current iteration number
 * @param taskName - Task name
 * @param taskDirAbs - Task directory (fallback for standalone mode)
 * @returns Absolute path to output directory
 */
function getRewardOutputDir(
  filerlDir: string | undefined,
  iteration: number,
  taskName: string,
  taskDirAbs: string
): string {
  if (filerlDir) {
    // FileRL mode: .viben/filerl/<name>/iter<N>/<task>/
    const outputDir = join(filerlDir, `iter${iteration}`, taskName);
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }
    return outputDir;
  }

  // Standalone mode: task directory
  return taskDirAbs;
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
  const taskName = taskData.name || taskData.id || basename(taskDirAbs);

  // 3. Check pr_url exists (warning if missing)
  if (!taskData.pr_url) {
    warnings.push(
      "pr_url not found in task.json - PR may not have been created"
    );
  }

  // =============================================================================
  // Determine Reward Config and Output Directory (FileRL vs Standalone)
  // =============================================================================

  let rewardConfig: RewardConfig;
  let outputDir: string;
  let currentIteration = 0;
  const filerlDir = taskData.filerl_dir;

  if (filerlDir && existsSync(filerlDir)) {
    // FileRL mode: read config from FileRL state/target
    const filerlState = readFileRlState(filerlDir);
    if (!filerlState) {
      return {
        success: false,
        error: `FileRL state.json not found at ${filerlDir}`,
      };
    }

    currentIteration = filerlState.current_iteration;

    // Try to read reward config from target file
    let targetRewardConfig: RewardConfig | null = null;
    if (filerlState.target_path) {
      targetRewardConfig = readFileRlRewardConfig(filerlState.target_path);
    }

    if (targetRewardConfig) {
      rewardConfig = targetRewardConfig;
    } else {
      // Fallback to task.json reward_config or defaults
      rewardConfig = taskData.reward_config || DEFAULT_REWARD_CONFIG;
      warnings.push("Could not read reward config from FileRL target, using task.json or defaults");
    }

    // Output to FileRL directory
    outputDir = getRewardOutputDir(filerlDir, currentIteration, taskName, taskDirAbs);
  } else {
    // Standalone mode: use task.json config
    rewardConfig = taskData.reward_config || DEFAULT_REWARD_CONFIG;
    outputDir = taskDirAbs;
  }

  // =============================================================================
  // Generate reward.jsonl
  // =============================================================================

  const jsonlResult = generateRewardJsonl(repoRoot, outputDir, rewardConfig);
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
  env.REWARD_OUTPUT_DIR = outputDir;

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

  // Log file goes to output directory (FileRL or task dir)
  const logFile = join(outputDir, "reward.log.jsonl");

  // Open log file for writing
  const logFd = openSync(logFile, "w");

  // Run synchronously using spawnSync
  const result = spawnSync(cliCmd[0], cliCmd.slice(1), {
    cwd: repoRoot,
    env,
    stdio: ["ignore", logFd, logFd],
  });

  // Close file descriptor after spawn completes
  closeSync(logFd);

  // Check for spawn errors
  if (result.error) {
    return {
      success: false,
      error: `Failed to run reward agent: ${result.error.message}`,
      logFile,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  // Check if process was terminated by a signal
  if (result.signal) {
    warnings.push(`Agent was terminated by signal ${result.signal}`);
  } else if (result.status !== null && result.status !== 0) {
    // Agent may exit with non-zero code but still produce valid output
    warnings.push(`Agent exited with code ${result.status}`);
  }

  // =============================================================================
  // Parse Results and Write to Output
  // =============================================================================

  const parseResult = parseRewardResult(repoRoot, taskDir, {
    outputDir,
    filerlDir,
    iteration: currentIteration,
  });

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
 * Options for parsing reward result
 */
export interface ParseRewardOptions {
  /** Output directory (for FileRL mode) */
  outputDir?: string;
  /** FileRL directory (if in FileRL mode) */
  filerlDir?: string;
  /** Current iteration (for FileRL mode) */
  iteration?: number;
}

/**
 * Parse reward agent log and write results
 *
 * This function:
 * 1. Reads reward.log.jsonl from output directory
 * 2. Parses JSON lines to find score entries and summary
 * 3. Calculates weighted total from reward.jsonl weights
 * 4. Gets diff lines using git diff --stat
 * 5. Writes results to:
 *    - FileRL mode: .viben/filerl/<name>/iter<N>/<task>/reward.json
 *    - Standalone mode: task.json.reward field
 *
 * @param repoRoot - Repository root path
 * @param taskDir - Task directory path (relative or absolute)
 * @param options - Parse options including output directory
 * @returns ParseRewardResultOutput with success status and parsed reward
 */
export function parseRewardResult(
  repoRoot: string,
  taskDir: string,
  options?: ParseRewardOptions
): ParseRewardResultOutput {
  // Normalize paths
  let taskDirAbs: string;

  if (taskDir.startsWith("/")) {
    taskDirAbs = taskDir;
  } else {
    taskDirAbs = resolve(repoRoot, taskDir);
  }

  // Determine output directory
  const outputDir = options?.outputDir || taskDirAbs;
  const filerlDir = options?.filerlDir;
  const isFileRlMode = !!filerlDir;

  // Check task.json exists
  const taskJsonPath = join(taskDirAbs, "task.json");
  if (!existsSync(taskJsonPath)) {
    return {
      success: false,
      error: `task.json not found at ${taskJsonPath}`,
    };
  }

  // Check reward.log.jsonl exists in output directory
  const logFile = join(outputDir, "reward.log.jsonl");
  if (!existsSync(logFile)) {
    return {
      success: false,
      error: `reward.log.jsonl not found at ${logFile}`,
    };
  }

  // Read task data (for task name and standalone mode output)
  const taskData = readTaskJson(taskDirAbs) as TaskData | null;
  if (!taskData) {
    return {
      success: false,
      error: "Failed to read task.json",
    };
  }

  // Read reward.jsonl for weights (from output directory)
  const rewardJsonlPath = join(outputDir, "reward.jsonl");
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

  // Extract JSON objects from content using bracket matching
  // This handles arbitrarily nested JSON objects
  const jsonObjects = extractJsonObjects(logContent);

  for (const jsonStr of jsonObjects) {
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
  const taskName = taskData.name || taskData.id || basename(taskDirAbs);
  const reward: RewardResult = {
    scores,
    total,
    diffLines,
    computedAt: new Date().toISOString(),
  };

  // Write output based on mode
  if (isFileRlMode) {
    // FileRL mode: write to reward.json in output directory
    const rewardJsonPath = join(outputDir, "reward.json");
    const rewardOutput = {
      task: taskName,
      iteration: options?.iteration ?? 0,
      ...reward,
    };

    try {
      writeFileSync(rewardJsonPath, JSON.stringify(rewardOutput, null, 2), "utf-8");
    } catch (err) {
      return {
        success: false,
        error: `Failed to write reward.json: ${err}`,
      };
    }
  } else {
    // Standalone mode: update task.json with reward field
    taskData.reward = reward;

    const writeSuccess = writeTaskJson(taskDirAbs, taskData);
    if (!writeSuccess) {
      return {
        success: false,
        error: "Failed to write reward to task.json",
      };
    }
  }

  return {
    success: true,
    reward,
  };
}
