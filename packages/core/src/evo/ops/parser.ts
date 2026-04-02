/**
 * Evo Target Parser
 *
 * Parses Evo target files (YAML header + Markdown body).
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve, basename } from "node:path";
import matter from "gray-matter";

import {
  type EvoConfig,
  type PpoConfig,
  type IdeaConfig,
  type RolloutConfig,
  type ConvergenceConfig,
  type TaskConfig,
  type ParseTargetResult,
  DEFAULT_PPO_CONFIG,
  DEFAULT_IDEA_CONFIG,
  DEFAULT_ROLLOUT_CONFIG,
  DEFAULT_CONVERGENCE_CONFIG,
  DEFAULT_TASK_CONFIG,
  DEFAULT_REWARD_CONFIG,
} from "./types";

import type { RewardConfig } from "../../reward/ops/types";

// =============================================================================
// Parser Functions
// =============================================================================

/**
 * Parse PPO configuration from raw YAML data
 */
function parsePpoConfig(raw: Record<string, unknown>): PpoConfig {
  const ppoRaw = (raw.ppo || {}) as Record<string, unknown>;

  return {
    kl_coef: typeof ppoRaw.kl_coef === "number" ? ppoRaw.kl_coef : DEFAULT_PPO_CONFIG.kl_coef,
    change_sensitivity: typeof ppoRaw.change_sensitivity === "number" ? ppoRaw.change_sensitivity : DEFAULT_PPO_CONFIG.change_sensitivity,
    clip_range: typeof ppoRaw.clip_range === "number" ? ppoRaw.clip_range : DEFAULT_PPO_CONFIG.clip_range,
    quality_threshold: typeof ppoRaw.quality_threshold === "number" ? ppoRaw.quality_threshold : DEFAULT_PPO_CONFIG.quality_threshold,
    max_diff: typeof ppoRaw.max_diff === "number" ? ppoRaw.max_diff : DEFAULT_PPO_CONFIG.max_diff,
  };
}

/**
 * Parse reward configuration from raw YAML data
 */
function parseRewardConfig(raw: Record<string, unknown>): RewardConfig {
  const rewardRaw = (raw.reward || {}) as Record<string, unknown>;

  const types = Array.isArray(rewardRaw.types)
    ? rewardRaw.types.map(String)
    : DEFAULT_REWARD_CONFIG.types;

  const weights = Array.isArray(rewardRaw.weights)
    ? rewardRaw.weights.map(Number)
    : DEFAULT_REWARD_CONFIG.weights;

  // Ensure weights array matches types array length
  const normalizedWeights = weights.length === types.length
    ? weights
    : types.map(() => 1 / types.length);

  return {
    types,
    weights: normalizedWeights,
  };
}

/**
 * Parse idea configuration from raw YAML data
 */
function parseIdeaConfig(raw: Record<string, unknown>): IdeaConfig {
  const ideaRaw = (raw.idea || {}) as Record<string, unknown>;

  return {
    auto_generate: typeof ideaRaw.auto_generate === "boolean"
      ? ideaRaw.auto_generate
      : DEFAULT_IDEA_CONFIG.auto_generate,
    types: Array.isArray(ideaRaw.types)
      ? ideaRaw.types.map(String)
      : DEFAULT_IDEA_CONFIG.types,
    max_ideas: typeof ideaRaw.max_ideas === "number" ? ideaRaw.max_ideas : DEFAULT_IDEA_CONFIG.max_ideas,
    batch_size: typeof ideaRaw.batch_size === "number"
      ? ideaRaw.batch_size
      : DEFAULT_IDEA_CONFIG.batch_size,
    effort_filter: Array.isArray(ideaRaw.effort_filter)
      ? ideaRaw.effort_filter.map(String)
      : undefined,
    session_dir: typeof ideaRaw.session_dir === "string"
      ? ideaRaw.session_dir
      : undefined,
  };
}

/**
 * Parse rollout configuration from raw YAML data
 */
function parseRolloutConfig(raw: Record<string, unknown>): RolloutConfig {
  const rolloutRaw = (raw.rollout || {}) as Record<string, unknown>;

  return {
    n: typeof rolloutRaw.n === "number" ? rolloutRaw.n : DEFAULT_ROLLOUT_CONFIG.n,
    worktree: typeof rolloutRaw.worktree === "boolean" ? rolloutRaw.worktree : DEFAULT_ROLLOUT_CONFIG.worktree,
  };
}

/**
 * Parse convergence configuration from raw YAML data
 */
function parseConvergenceConfig(raw: Record<string, unknown>): ConvergenceConfig {
  const convergenceRaw = (raw.convergence || {}) as Record<string, unknown>;

  return {
    threshold: typeof convergenceRaw.threshold === "number" ? convergenceRaw.threshold : DEFAULT_CONVERGENCE_CONFIG.threshold,
    max_iterations: typeof convergenceRaw.max_iterations === "number" ? convergenceRaw.max_iterations : DEFAULT_CONVERGENCE_CONFIG.max_iterations,
    no_merge_limit: typeof convergenceRaw.no_merge_limit === "number" ? convergenceRaw.no_merge_limit : DEFAULT_CONVERGENCE_CONFIG.no_merge_limit,
  };
}

/**
 * Parse task configuration from raw YAML data
 */
function parseTaskConfig(raw: Record<string, unknown>): TaskConfig {
  const taskRaw = (raw.task || {}) as Record<string, unknown>;

  return {
    executor: typeof taskRaw.executor === "string" ? taskRaw.executor : DEFAULT_TASK_CONFIG.executor,
    model: typeof taskRaw.model === "string" ? taskRaw.model : undefined,
  };
}

/**
 * Parse an Evo target file
 *
 * Target files have YAML frontmatter with configuration and
 * markdown body with the workflow instructions.
 *
 * @param targetPath - Path to the target file (can be relative or absolute)
 * @param repoRoot - Repository root for resolving relative paths
 * @returns Parsed configuration and body content
 */
export function parseTarget(targetPath: string, repoRoot: string): ParseTargetResult {
  // Resolve path
  const resolvedPath = resolve(repoRoot, targetPath);

  if (!existsSync(resolvedPath)) {
    return {
      success: false,
      error: `Target file not found: ${resolvedPath}`,
    };
  }

  try {
    const content = readFileSync(resolvedPath, "utf-8");
    const parsed = matter(content);
    const raw = parsed.data as Record<string, unknown>;

    // Extract name from frontmatter or filename
    const name = typeof raw.name === "string"
      ? raw.name
      : basename(resolvedPath, ".md");

    const config: EvoConfig = {
      name,
      description: typeof raw.description === "string" ? raw.description : undefined,
      ppo: parsePpoConfig(raw),
      rollout: parseRolloutConfig(raw),
      convergence: parseConvergenceConfig(raw),
      reward: parseRewardConfig(raw),
      idea: parseIdeaConfig(raw),
      task: parseTaskConfig(raw),
      enabled: typeof raw.enabled === "boolean" ? raw.enabled : true,
      created_at: typeof raw.created_at === "string" ? raw.created_at : undefined,
      updated_at: typeof raw.updated_at === "string" ? raw.updated_at : undefined,
    };

    return {
      success: true,
      config,
      body: parsed.content.trim(),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Validate an Evo configuration
 *
 * @param config - Configuration to validate
 * @returns Validation result with any errors
 */
export function validateConfig(config: EvoConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Validate PPO config
  if (config.ppo.kl_coef < 0 || config.ppo.kl_coef > 1) {
    errors.push(`ppo.kl_coef must be between 0 and 1 (got ${config.ppo.kl_coef})`);
  }
  if (config.ppo.change_sensitivity <= 0) {
    errors.push(`ppo.change_sensitivity must be positive (got ${config.ppo.change_sensitivity})`);
  }
  if (config.ppo.clip_range < 0 || config.ppo.clip_range > 1) {
    errors.push(`ppo.clip_range must be between 0 and 1 (got ${config.ppo.clip_range})`);
  }
  if (config.ppo.quality_threshold < 0 || config.ppo.quality_threshold > 1) {
    errors.push(`ppo.quality_threshold must be between 0 and 1 (got ${config.ppo.quality_threshold})`);
  }
  if (config.ppo.max_diff <= 0) {
    errors.push(`ppo.max_diff must be positive (got ${config.ppo.max_diff})`);
  }

  // Validate rollout config
  if (config.rollout.n < 1) {
    errors.push(`rollout.n must be at least 1 (got ${config.rollout.n})`);
  }

  // Validate convergence config
  if (config.convergence.threshold < 0 || config.convergence.threshold > 1) {
    errors.push(`convergence.threshold must be between 0 and 1 (got ${config.convergence.threshold})`);
  }
  if (config.convergence.max_iterations < 1) {
    errors.push(`convergence.max_iterations must be at least 1 (got ${config.convergence.max_iterations})`);
  }
  if (config.convergence.no_merge_limit < 1) {
    errors.push(`convergence.no_merge_limit must be at least 1 (got ${config.convergence.no_merge_limit})`);
  }

  // Validate reward config
  if (config.reward.types.length === 0) {
    errors.push("reward.types cannot be empty");
  }
  if (config.reward.weights.length !== config.reward.types.length) {
    errors.push(`reward.weights length (${config.reward.weights.length}) must match reward.types length (${config.reward.types.length})`);
  }
  const weightsSum = config.reward.weights.reduce((a, b) => a + b, 0);
  if (Math.abs(weightsSum - 1) > 0.01) {
    errors.push(`reward.weights must sum to 1.0 (got ${weightsSum.toFixed(3)})`);
  }

  // Validate idea config
  if (config.idea.types.length === 0) {
    errors.push("idea.types cannot be empty");
  }
  if (config.idea.max_ideas < 1) {
    errors.push(`idea.max_ideas must be at least 1 (got ${config.idea.max_ideas})`);
  }
  if (config.idea.batch_size < 1) {
    errors.push(`idea.batch_size must be at least 1 (got ${config.idea.batch_size})`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Generate a default Evo target file content
 *
 * @param name - Target name
 * @param description - Optional description
 * @returns Markdown content with YAML frontmatter
 */
export function generateTargetContent(name: string, description?: string): string {
  const now = new Date().toISOString();

  const frontmatter = `---
name: ${name}
description: ${description || `Evo target for ${name}`}
enabled: true

ppo:
  kl_coef: ${DEFAULT_PPO_CONFIG.kl_coef}
  change_sensitivity: ${DEFAULT_PPO_CONFIG.change_sensitivity}
  clip_range: ${DEFAULT_PPO_CONFIG.clip_range}
  quality_threshold: ${DEFAULT_PPO_CONFIG.quality_threshold}
  max_diff: ${DEFAULT_PPO_CONFIG.max_diff}

rollout:
  n: ${DEFAULT_ROLLOUT_CONFIG.n}
  worktree: ${DEFAULT_ROLLOUT_CONFIG.worktree}

convergence:
  threshold: ${DEFAULT_CONVERGENCE_CONFIG.threshold}
  max_iterations: ${DEFAULT_CONVERGENCE_CONFIG.max_iterations}
  no_merge_limit: ${DEFAULT_CONVERGENCE_CONFIG.no_merge_limit}

reward:
  types:
${DEFAULT_REWARD_CONFIG.types.map(t => `    - ${t}`).join("\n")}
  weights:
${DEFAULT_REWARD_CONFIG.weights.map(w => `    - ${w}`).join("\n")}

idea:
  auto_generate: ${DEFAULT_IDEA_CONFIG.auto_generate}
  types:
${DEFAULT_IDEA_CONFIG.types.map(t => `    - ${t}`).join("\n")}
  max_ideas: ${DEFAULT_IDEA_CONFIG.max_ideas}
  batch_size: ${DEFAULT_IDEA_CONFIG.batch_size}

task:
  executor: ${DEFAULT_TASK_CONFIG.executor}

created_at: ${now}
updated_at: ${now}
---

# Evo: ${name}

This file configures an Evo (File-based Self-Evolution) loop.

## How It Works

1. **Generate Ideas**: AI analyzes the codebase and generates improvement ideas
2. **Create Tasks**: Top ideas are promoted to tasks
3. **Execute in Parallel**: Tasks run in isolated git worktrees
4. **Compute Rewards**: Each task's PR is evaluated using configured reward types
5. **Select Best**: PPO algorithm selects the best task based on rewards
6. **Merge Winner**: The winning PR is merged, rejected PRs are cleaned up
7. **Iterate**: Process repeats until convergence or max iterations

## Configuration

### PPO Settings
- \`kl_coef\`: Penalty for large code changes (prevents over-modification)
- \`threshold\`: Minimum reward score to accept a change
- \`parallel_count\`: Number of parallel variations to try

### Reward Types
Configure which aspects to evaluate:
- \`test_coverage\`: Test pass rate and coverage
- \`code_quality\`: Lint scores and complexity
- \`agent_review\`: AI code review scoring

### Idea Types
Configure which improvements to look for:
- \`code_improvements\`: General code enhancements
- \`performance_optimizations\`: Performance bottlenecks
- \`security_hardening\`: Security vulnerabilities

## Usage

\`\`\`bash
# Run the Evo loop
viben evo start ${name}.md

# Check status
viben evo status ${name}

# Stop a running loop
viben evo stop ${name}
\`\`\`
`;

  return frontmatter;
}
