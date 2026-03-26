# FileRL Redesign Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign FileRL to support manual idea input, implement full PPO two-stage selection, and fix idea state management bugs.

**Architecture:** Update types to use new config format (semantic field names, rollout.n, idea.batch_size), refactor runner state machine to support fetch_ideas phase, implement two-stage PPO selection with change_sensitivity (β) parameter, fix loser idea dismissal in cleanup phase.

**Tech Stack:** TypeScript, gray-matter (YAML parsing), Node.js fs

---

## Chunk 1: Type Definitions Update

### Task 1: Update PpoConfig with new field names

**Files:**
- Modify: `packages/core/src/filerl/ops/types.ts:23-41`

- [ ] **Step 1: Update PpoConfig interface**

```typescript
/**
 * PPO algorithm configuration
 */
export interface PpoConfig {
  /** KL penalty coefficient λ (default: 0.05) */
  kl_coef: number;

  /** Change sensitivity β for weight calculation (default: 2.0) */
  change_sensitivity: number;

  /** Clip range ε for weight clipping (default: 0.2) */
  clip_range: number;

  /** Quality threshold τ - minimum adjusted reward (default: 0.6) */
  quality_threshold: number;

  /** Maximum diff lines for normalization (default: 500) */
  max_diff: number;
}
```

- [ ] **Step 2: Update DEFAULT_PPO_CONFIG**

```typescript
export const DEFAULT_PPO_CONFIG: PpoConfig = {
  kl_coef: 0.05,
  change_sensitivity: 2.0,
  clip_range: 0.2,
  quality_threshold: 0.6,
  max_diff: 500,
};
```

- [ ] **Step 3: Run typecheck**

Run: `cd packages/core && pnpm typecheck`
Expected: Errors in files that reference old field names (threshold, parallel_count, etc.)

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/filerl/ops/types.ts
git commit -m "refactor(filerl): update PpoConfig with semantic field names

- kl_coef (λ): KL penalty coefficient
- change_sensitivity (β): exponential decay sensitivity
- clip_range (ε): weight clipping parameter
- quality_threshold (τ): minimum adjusted reward threshold
- max_diff: maximum diff lines for normalization

BREAKING: Removes threshold, parallel_count, max_iterations, convergence_threshold"
```

---

### Task 2: Add RolloutConfig and ConvergenceConfig

**Files:**
- Modify: `packages/core/src/filerl/ops/types.ts:46-58` (after IdeaConfig)

- [ ] **Step 1: Add RolloutConfig interface**

```typescript
/**
 * Rollout configuration
 */
export interface RolloutConfig {
  /** Number of rollouts per idea (default: 1) */
  n: number;

  /** Use git worktree for isolation (default: true) */
  worktree: boolean;
}

/**
 * Default rollout configuration
 */
export const DEFAULT_ROLLOUT_CONFIG: RolloutConfig = {
  n: 1,
  worktree: true,
};
```

- [ ] **Step 2: Add ConvergenceConfig interface**

```typescript
/**
 * Convergence configuration
 */
export interface ConvergenceConfig {
  /** Convergence threshold δ (default: 0.01) */
  threshold: number;

  /** Maximum iterations before stopping (default: 50) */
  max_iterations: number;

  /** Consecutive no-merge iterations before early stop (default: 5) */
  no_merge_limit: number;
}

/**
 * Default convergence configuration
 */
export const DEFAULT_CONVERGENCE_CONFIG: ConvergenceConfig = {
  threshold: 0.01,
  max_iterations: 50,
  no_merge_limit: 5,
};
```

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/filerl/ops/types.ts
git commit -m "feat(filerl): add RolloutConfig and ConvergenceConfig types"
```

---

### Task 3: Update IdeaConfig with batch_size and auto_generate

**Files:**
- Modify: `packages/core/src/filerl/ops/types.ts` (IdeaConfig section)

- [ ] **Step 1: Update IdeaConfig interface**

```typescript
/**
 * Idea generation configuration
 */
export interface IdeaConfig {
  /** Whether to auto-generate ideas when pool is empty (default: false) */
  auto_generate: boolean;

  /** Idea types to generate */
  types: string[];

  /** Maximum ideas per type (default: 5) */
  max_ideas: number;

  /** Number of ideas to process per iteration - batch size B (default: 3) */
  batch_size: number;

  /** Filter by effort level */
  effort_filter?: string[];

  /** Custom session directory for ideas (default: .viben/ideas/<name>) */
  session_dir?: string;
}
```

- [ ] **Step 2: Update DEFAULT_IDEA_CONFIG**

```typescript
export const DEFAULT_IDEA_CONFIG: IdeaConfig = {
  auto_generate: false,
  types: ["code_improvements"],
  max_ideas: 5,
  batch_size: 3,
  effort_filter: undefined,
  session_dir: undefined,
};
```

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/filerl/ops/types.ts
git commit -m "feat(filerl): update IdeaConfig with auto_generate and batch_size

- auto_generate: controls whether ideas are generated automatically
- batch_size: number of ideas to process per iteration (B)
- session_dir: custom directory for idea storage"
```

---

### Task 4: Update FileRlConfig to use new config types

**Files:**
- Modify: `packages/core/src/filerl/ops/types.ts` (FileRlConfig section)

- [ ] **Step 1: Update FileRlConfig interface**

```typescript
/**
 * Complete FileRL target configuration
 */
export interface FileRlConfig {
  /** Target name/identifier */
  name: string;

  /** Human-readable description */
  description?: string;

  /** PPO algorithm configuration */
  ppo: PpoConfig;

  /** Rollout configuration */
  rollout: RolloutConfig;

  /** Convergence configuration */
  convergence: ConvergenceConfig;

  /** Reward configuration for evaluation */
  reward: RewardConfig;

  /** Idea generation configuration */
  idea: IdeaConfig;

  /** Task execution configuration */
  task: TaskConfig;

  /** Whether the FileRL loop is enabled */
  enabled: boolean;

  /** Created timestamp */
  created_at?: string;

  /** Last updated timestamp */
  updated_at?: string;
}
```

- [ ] **Step 2: Remove TaskConfig.worktree and TaskConfig.auto_start (moved to RolloutConfig)**

```typescript
/**
 * Task execution configuration
 */
export interface TaskConfig {
  /** Executor type (default: CLAUDE_CODE) */
  executor: string;

  /** Model to use for task execution */
  model?: string;
}

export const DEFAULT_TASK_CONFIG: TaskConfig = {
  executor: "CLAUDE_CODE",
  model: undefined,
};
```

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/filerl/ops/types.ts
git commit -m "refactor(filerl): restructure FileRlConfig with rollout and convergence sections"
```

---

### Task 5: Update IterationPhase enum

**Files:**
- Modify: `packages/core/src/filerl/ops/types.ts` (IterationPhase section)

- [ ] **Step 1: Update IterationPhase type**

```typescript
/**
 * Iteration phase - tracks progress through the FileRL pipeline
 */
export type IterationPhase =
  | "init"              // Just started
  | "fetch_ideas"       // Fetch ideas from pool
  | "generate_ideas"    // Auto-generate ideas (if enabled and pool empty)
  | "create_rollouts"   // Create N rollout tasks per idea
  | "execute_tasks"     // Start task executors
  | "wait_tasks"        // Wait for tasks to complete
  | "compute_rewards"   // Compute rewards for each task
  | "select_best"       // PPO two-stage selection
  | "merge_cleanup"     // Merge winner, cleanup losers, update idea status
  | "check_converge"    // Check convergence criteria
  | "complete";         // Iteration finished
```

- [ ] **Step 2: Commit**

```bash
git add packages/core/src/filerl/ops/types.ts
git commit -m "feat(filerl): update IterationPhase with fetch_ideas and check_converge"
```

---

### Task 6: Add ideaId field to IterationState

**Files:**
- Modify: `packages/core/src/filerl/ops/types.ts` (IterationState section)

- [ ] **Step 1: Update IterationState interface**

Add `idea_id` field to track which idea each task came from:

```typescript
export interface IterationState {
  /** Iteration number (1-based) */
  iteration: number;

  /** Current phase of this iteration */
  phase: IterationPhase;

  /** Ideas being processed in this iteration */
  ideas: string[];

  /** Tasks created from ideas (includes rollout index) */
  tasks: string[];

  /** Map task to its source idea ID */
  task_idea_map: Record<string, string>;

  /** Task rewards (task name -> reward score) */
  rewards: Record<string, number>;

  /** Selected task (winner) */
  selected_task?: string;

  /** Rejected tasks */
  rejected_tasks: string[];

  /** Merge error if winner merge failed */
  merge_error?: string;

  /** Whether iteration is complete */
  completed: boolean;

  /** Timestamp when iteration started */
  started_at: string;

  /** Timestamp when iteration completed */
  completed_at?: string;
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/core/src/filerl/ops/types.ts
git commit -m "feat(filerl): add task_idea_map and merge_error to IterationState"
```

---

### Task 7: Update FileRlState with no_merge_count

**Files:**
- Modify: `packages/core/src/filerl/ops/types.ts` (FileRlState section)

- [ ] **Step 1: Update FileRlState interface**

```typescript
export interface FileRlState {
  /** Target name */
  name: string;

  /** Path to target file */
  target_path: string;

  /** Current iteration number */
  current_iteration: number;

  /** Total completed iterations */
  completed_iterations: number;

  /** Iteration history */
  iterations: IterationState[];

  /** Best reward achieved so far */
  best_reward: number;

  /** Best task name */
  best_task?: string;

  /** Consecutive iterations without merge */
  no_merge_count: number;

  /** Whether the run is converged */
  converged: boolean;

  /** Whether the run is active */
  active: boolean;

  /** Run started timestamp */
  started_at: string;

  /** Last updated timestamp */
  updated_at: string;
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/core/src/filerl/ops/types.ts
git commit -m "feat(filerl): add no_merge_count to FileRlState for early stop detection"
```

---

### Task 8: Export new types and defaults from index.ts

**Files:**
- Modify: `packages/core/src/filerl/ops/index.ts`

- [ ] **Step 1: Update exports**

```typescript
// Types
export * from "./types";
export {
  DEFAULT_PPO_CONFIG,
  DEFAULT_ROLLOUT_CONFIG,
  DEFAULT_CONVERGENCE_CONFIG,
  DEFAULT_IDEA_CONFIG,
  DEFAULT_TASK_CONFIG,
  DEFAULT_REWARD_CONFIG,
} from "./types";
```

- [ ] **Step 2: Run typecheck to see all breaking changes**

Run: `cd packages/core && pnpm typecheck 2>&1 | head -100`
Expected: List of files with type errors that need updating

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/filerl/ops/index.ts
git commit -m "chore(filerl): export new config types and defaults"
```

---

## Chunk 2: Parser Update

### Task 9: Update parser to handle new config format

**Files:**
- Modify: `packages/core/src/filerl/ops/parser.ts`

- [ ] **Step 1: Add parseRolloutConfig function**

```typescript
import {
  // ... existing imports
  type RolloutConfig,
  type ConvergenceConfig,
  DEFAULT_ROLLOUT_CONFIG,
  DEFAULT_CONVERGENCE_CONFIG,
} from "./types";

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
```

- [ ] **Step 2: Add parseConvergenceConfig function**

```typescript
/**
 * Parse convergence configuration from raw YAML data
 */
function parseConvergenceConfig(raw: Record<string, unknown>): ConvergenceConfig {
  const convRaw = (raw.convergence || {}) as Record<string, unknown>;

  return {
    threshold: typeof convRaw.threshold === "number" ? convRaw.threshold : DEFAULT_CONVERGENCE_CONFIG.threshold,
    max_iterations: typeof convRaw.max_iterations === "number" ? convRaw.max_iterations : DEFAULT_CONVERGENCE_CONFIG.max_iterations,
    no_merge_limit: typeof convRaw.no_merge_limit === "number" ? convRaw.no_merge_limit : DEFAULT_CONVERGENCE_CONFIG.no_merge_limit,
  };
}
```

- [ ] **Step 3: Update parsePpoConfig for new fields**

```typescript
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
```

- [ ] **Step 4: Update parseIdeaConfig for new fields**

```typescript
function parseIdeaConfig(raw: Record<string, unknown>): IdeaConfig {
  const ideaRaw = (raw.idea || {}) as Record<string, unknown>;

  return {
    auto_generate: typeof ideaRaw.auto_generate === "boolean" ? ideaRaw.auto_generate : DEFAULT_IDEA_CONFIG.auto_generate,
    types: Array.isArray(ideaRaw.types) ? ideaRaw.types.map(String) : DEFAULT_IDEA_CONFIG.types,
    max_ideas: typeof ideaRaw.max_ideas === "number" ? ideaRaw.max_ideas : DEFAULT_IDEA_CONFIG.max_ideas,
    batch_size: typeof ideaRaw.batch_size === "number" ? ideaRaw.batch_size : DEFAULT_IDEA_CONFIG.batch_size,
    effort_filter: Array.isArray(ideaRaw.effort_filter) ? ideaRaw.effort_filter.map(String) : undefined,
    session_dir: typeof ideaRaw.session_dir === "string" ? ideaRaw.session_dir : undefined,
  };
}
```

- [ ] **Step 5: Update parseTaskConfig (remove worktree, auto_start)**

```typescript
function parseTaskConfig(raw: Record<string, unknown>): TaskConfig {
  const taskRaw = (raw.task || {}) as Record<string, unknown>;

  return {
    executor: typeof taskRaw.executor === "string" ? taskRaw.executor : DEFAULT_TASK_CONFIG.executor,
    model: typeof taskRaw.model === "string" ? taskRaw.model : undefined,
  };
}
```

- [ ] **Step 6: Update parseTarget to include new configs**

```typescript
const config: FileRlConfig = {
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
```

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/filerl/ops/parser.ts
git commit -m "feat(filerl): update parser for new config format

- Add parseRolloutConfig and parseConvergenceConfig
- Update parsePpoConfig with semantic field names
- Update parseIdeaConfig with auto_generate and batch_size
- Simplify parseTaskConfig (worktree moved to rollout)"
```

---

### Task 10: Update validateConfig for new structure

**Files:**
- Modify: `packages/core/src/filerl/ops/parser.ts` (validateConfig function)

- [ ] **Step 1: Rewrite validateConfig**

```typescript
export function validateConfig(config: FileRlConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Validate PPO config
  if (config.ppo.kl_coef < 0 || config.ppo.kl_coef > 1) {
    errors.push(`ppo.kl_coef must be between 0 and 1 (got ${config.ppo.kl_coef})`);
  }
  if (config.ppo.change_sensitivity < 0) {
    errors.push(`ppo.change_sensitivity must be non-negative (got ${config.ppo.change_sensitivity})`);
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
  if (config.convergence.threshold < 0) {
    errors.push(`convergence.threshold must be non-negative (got ${config.convergence.threshold})`);
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
    errors.push(`reward.weights length must match reward.types length`);
  }
  const weightsSum = config.reward.weights.reduce((a, b) => a + b, 0);
  if (Math.abs(weightsSum - 1) > 0.01) {
    errors.push(`reward.weights must sum to 1.0 (got ${weightsSum.toFixed(3)})`);
  }

  // Validate idea config
  if (config.idea.auto_generate && config.idea.types.length === 0) {
    errors.push("idea.types cannot be empty when auto_generate is true");
  }
  if (config.idea.batch_size < 1) {
    errors.push(`idea.batch_size must be at least 1 (got ${config.idea.batch_size})`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/core/src/filerl/ops/parser.ts
git commit -m "feat(filerl): update validateConfig for new config structure"
```

---

### Task 11: Update generateTargetContent for new format

**Files:**
- Modify: `packages/core/src/filerl/ops/parser.ts` (generateTargetContent function)

- [ ] **Step 1: Rewrite generateTargetContent**

```typescript
export function generateTargetContent(name: string, description?: string): string {
  const now = new Date().toISOString();

  return `---
name: ${name}
description: ${description || `FileRL target for ${name}`}
enabled: true

# Idea configuration
idea:
  auto_generate: false
  types:
    - code_improvements
  max_ideas: ${DEFAULT_IDEA_CONFIG.max_ideas}
  batch_size: ${DEFAULT_IDEA_CONFIG.batch_size}

# Rollout configuration
rollout:
  n: ${DEFAULT_ROLLOUT_CONFIG.n}
  worktree: ${DEFAULT_ROLLOUT_CONFIG.worktree}

# PPO configuration
ppo:
  kl_coef: ${DEFAULT_PPO_CONFIG.kl_coef}
  change_sensitivity: ${DEFAULT_PPO_CONFIG.change_sensitivity}
  clip_range: ${DEFAULT_PPO_CONFIG.clip_range}
  quality_threshold: ${DEFAULT_PPO_CONFIG.quality_threshold}
  max_diff: ${DEFAULT_PPO_CONFIG.max_diff}

# Convergence configuration
convergence:
  threshold: ${DEFAULT_CONVERGENCE_CONFIG.threshold}
  max_iterations: ${DEFAULT_CONVERGENCE_CONFIG.max_iterations}
  no_merge_limit: ${DEFAULT_CONVERGENCE_CONFIG.no_merge_limit}

# Reward configuration
reward:
  types:
${DEFAULT_REWARD_CONFIG.types.map(t => `    - ${t}`).join("\n")}
  weights:
${DEFAULT_REWARD_CONFIG.weights.map(w => `    - ${w}`).join("\n")}

# Task execution
task:
  executor: ${DEFAULT_TASK_CONFIG.executor}

created_at: ${now}
updated_at: ${now}
---

# FileRL: ${name}

This file configures a FileRL (File-based Reinforcement Learning) loop.

## How It Works

1. **Fetch Ideas**: Get pending ideas from the idea pool
2. **Create Rollouts**: For each idea, create N parallel tasks
3. **Execute**: Run tasks in isolated git worktrees
4. **Compute Rewards**: Evaluate each PR using configured reward types
5. **Select Best**: PPO two-stage selection (best per idea, then global best)
6. **Merge Winner**: Merge the winning PR, cleanup rejected ones
7. **Iterate**: Continue until convergence or max iterations

## Usage

\`\`\`bash
# Add ideas manually (when auto_generate: false)
viben filerl add-idea ${name} path/to/idea.md

# Or enable auto_generate in config above

# Start the optimization loop
viben filerl start ${name}.md
\`\`\`
`;
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/core/src/filerl/ops/parser.ts
git commit -m "feat(filerl): update generateTargetContent for new config format"
```

---

## Chunk 3: PPO Selection Algorithm Update

### Task 12: Update TaskCandidate type with new fields

**Files:**
- Modify: `packages/core/src/reward/ops/types.ts`

- [ ] **Step 1: Update TaskCandidate interface**

```typescript
export interface TaskCandidate {
  /** Task name (directory name) */
  task: string;

  /** Source idea ID */
  ideaId?: string;

  /** Original reward score (0-1) */
  reward: number;

  /** Number of lines changed */
  diffLines: number;

  /** Normalized change amount d = min(1, diffLines/maxDiff) */
  d: number;

  /** Change weight w = exp(-β × d) */
  changeWeight: number;

  /** KL penalty = λ × d */
  klPenalty: number;

  /** Adjusted reward R̃ = R - λ × d */
  adjustedReward: number;

  /** Relative score S = R̃ - baseline */
  relativeScore: number;

  /** Final score L = min(w×S, clip(w)×S) */
  finalScore: number;
}
```

- [ ] **Step 2: Update SelectOptions with new PPO params**

```typescript
export interface SelectOptions {
  /** Quality threshold τ (default: 0.6) */
  threshold?: number;

  /** KL penalty coefficient λ (default: 0.05) */
  klCoef?: number;

  /** Change sensitivity β (default: 2.0) */
  changeSensitivity?: number;

  /** Clip range ε (default: 0.2) */
  clipRange?: number;

  /** Maximum diff lines for normalization (default: 500) */
  maxDiff?: number;

  /** Map of task -> ideaId for two-stage selection */
  taskIdeaMap?: Record<string, string>;

  /** FileRL directory path */
  filerlDir?: string;

  /** Current iteration number */
  iteration?: number;
}

export const SELECT_DEFAULTS = {
  threshold: 0.6,
  klCoef: 0.05,
  changeSensitivity: 2.0,
  clipRange: 0.2,
  maxDiff: 500,
} as const;
```

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/reward/ops/types.ts
git commit -m "feat(reward): update TaskCandidate and SelectOptions for two-stage PPO"
```

---

### Task 13: Implement two-stage PPO selection

**Files:**
- Modify: `packages/core/src/reward/ops/select.ts`

- [ ] **Step 1: Update calculatePpoMetrics with new formula**

```typescript
function calculatePpoMetrics(
  taskRewards: Array<{ task: string; reward: number; diffLines: number; ideaId?: string }>,
  options: {
    klCoef: number;
    changeSensitivity: number;
    clipRange: number;
    maxDiff: number;
  }
): TaskCandidate[] {
  const { klCoef, changeSensitivity, clipRange, maxDiff } = options;

  // Step 1: Calculate d, changeWeight, klPenalty, adjustedReward
  const candidates: TaskCandidate[] = taskRewards.map(({ task, reward, diffLines, ideaId }) => {
    const d = Math.min(1, diffLines / maxDiff);
    const changeWeight = Math.exp(-changeSensitivity * d);
    const klPenalty = klCoef * d;
    const adjustedReward = reward - klPenalty;

    return {
      task,
      ideaId,
      reward,
      diffLines,
      d,
      changeWeight,
      klPenalty,
      adjustedReward,
      relativeScore: 0,
      finalScore: 0,
    };
  });

  // Step 2: Calculate baseline (mean of adjusted rewards)
  const baseline = candidates.reduce((sum, c) => sum + c.adjustedReward, 0) / candidates.length;

  // Step 3: Calculate relativeScore and finalScore
  for (const c of candidates) {
    c.relativeScore = c.adjustedReward - baseline;

    // L = min(w × S, clip(w, 1-ε, 1+ε) × S)
    const clippedWeight = Math.max(1 - clipRange, Math.min(1 + clipRange, c.changeWeight));
    c.finalScore = Math.min(c.changeWeight * c.relativeScore, clippedWeight * c.relativeScore);
  }

  return candidates;
}
```

- [ ] **Step 2: Implement two-stage selection in selectBestTask**

```typescript
export function selectBestTask(
  repoRoot: string,
  taskNames: string[],
  options: SelectOptions = {}
): SelectResult {
  const opts = {
    threshold: options.threshold ?? SELECT_DEFAULTS.threshold,
    klCoef: options.klCoef ?? SELECT_DEFAULTS.klCoef,
    changeSensitivity: options.changeSensitivity ?? SELECT_DEFAULTS.changeSensitivity,
    clipRange: options.clipRange ?? SELECT_DEFAULTS.clipRange,
    maxDiff: options.maxDiff ?? SELECT_DEFAULTS.maxDiff,
    taskIdeaMap: options.taskIdeaMap,
    filerlDir: options.filerlDir,
    iteration: options.iteration,
  };

  // ... (load rewards code unchanged) ...

  // Calculate PPO metrics
  const candidates = calculatePpoMetrics(taskRewards, opts);

  // Calculate baseline
  const baseline = candidates.reduce((sum, c) => sum + c.adjustedReward, 0) / candidates.length;

  // Two-stage selection
  let selected: string | null = null;

  if (opts.taskIdeaMap && Object.keys(opts.taskIdeaMap).length > 0) {
    // Stage 1: Best rollout per idea
    const ideaGroups = new Map<string, TaskCandidate[]>();
    for (const c of candidates) {
      const ideaId = c.ideaId || opts.taskIdeaMap[c.task] || c.task;
      if (!ideaGroups.has(ideaId)) {
        ideaGroups.set(ideaId, []);
      }
      ideaGroups.get(ideaId)!.push(c);
    }

    const bestPerIdea: TaskCandidate[] = [];
    for (const [ideaId, group] of ideaGroups) {
      const best = group.reduce((a, b) => a.finalScore > b.finalScore ? a : b);
      bestPerIdea.push(best);
    }

    // Stage 2: Global best from idea winners (above threshold)
    const qualified = bestPerIdea.filter(c => c.adjustedReward >= opts.threshold);
    if (qualified.length > 0) {
      const winner = qualified.reduce((a, b) => a.finalScore > b.finalScore ? a : b);
      selected = winner.task;
    }
  } else {
    // Single-stage selection (no idea grouping)
    candidates.sort((a, b) => b.finalScore - a.finalScore);
    const qualified = candidates.filter(c => c.adjustedReward >= opts.threshold);
    selected = qualified.length > 0 ? qualified[0].task : null;
  }

  const rejected = candidates.filter(c => c.task !== selected).map(c => c.task);

  return {
    success: true,
    baseline,
    threshold: opts.threshold,
    candidates,
    selected,
    rejected,
  };
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/reward/ops/select.ts
git commit -m "feat(reward): implement two-stage PPO selection algorithm

- Stage 1: Select best rollout per idea by finalScore
- Stage 2: Select global best from idea winners above threshold
- Supports single-stage fallback when taskIdeaMap not provided"
```

---

## Chunk 4: State Management Update

### Task 14: Update createInitialState with no_merge_count

**Files:**
- Modify: `packages/core/src/filerl/ops/state.ts`

- [ ] **Step 1: Update createInitialState**

```typescript
export function createInitialState(name: string, targetPath: string): FileRlState {
  const now = new Date().toISOString();

  return {
    name,
    target_path: targetPath,
    current_iteration: 0,
    completed_iterations: 0,
    iterations: [],
    best_reward: 0,
    best_task: undefined,
    no_merge_count: 0,
    converged: false,
    active: false,
    started_at: now,
    updated_at: now,
  };
}
```

- [ ] **Step 2: Update createIterationState with task_idea_map**

```typescript
export function createIterationState(iteration: number): IterationState {
  return {
    iteration,
    phase: "init",
    ideas: [],
    tasks: [],
    task_idea_map: {},
    rewards: {},
    selected_task: undefined,
    rejected_tasks: [],
    merge_error: undefined,
    completed: false,
    started_at: new Date().toISOString(),
    completed_at: undefined,
  };
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/filerl/ops/state.ts
git commit -m "feat(filerl): update state functions with no_merge_count and task_idea_map"
```

---

### Task 15: Update completeIteration to handle no_merge_count

**Files:**
- Modify: `packages/core/src/filerl/ops/state.ts`

- [ ] **Step 1: Update completeIteration signature and logic**

```typescript
export function completeIteration(
  state: FileRlState,
  selectedTask: string | undefined,
  rejectedTasks: string[],
  rewards: Record<string, number>,
  mergeError?: string
): void {
  const currentIter = state.iterations[state.iterations.length - 1];
  if (!currentIter) {
    return;
  }

  currentIter.selected_task = selectedTask;
  currentIter.rejected_tasks = rejectedTasks;
  currentIter.rewards = rewards;
  currentIter.merge_error = mergeError;
  currentIter.completed = true;
  currentIter.phase = "complete";
  currentIter.completed_at = new Date().toISOString();

  state.completed_iterations++;

  // Update no_merge_count
  if (selectedTask && !mergeError) {
    state.no_merge_count = 0;

    // Update best reward tracking
    const reward = rewards[selectedTask];
    if (reward !== undefined && reward > state.best_reward) {
      state.best_reward = reward;
      state.best_task = selectedTask;
    }
  } else {
    state.no_merge_count++;
  }
}
```

- [ ] **Step 2: Update checkConvergence to use convergence config**

```typescript
export function checkConvergence(
  state: FileRlState,
  convergenceThreshold: number,
  noMergeLimit: number
): boolean {
  // Check no-merge limit
  if (state.no_merge_count >= noMergeLimit) {
    return true;
  }

  // Check reward convergence (need at least 2 iterations)
  if (state.completed_iterations < 2) {
    return false;
  }

  const lastTwo = state.iterations.slice(-2);
  if (lastTwo.length < 2) {
    return false;
  }

  const [prev, current] = lastTwo;
  const prevBest = Math.max(...Object.values(prev.rewards), 0);
  const currentBest = Math.max(...Object.values(current.rewards), 0);
  const improvement = currentBest - prevBest;

  return improvement < convergenceThreshold;
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/filerl/ops/state.ts
git commit -m "feat(filerl): update completeIteration with merge error and no_merge tracking"
```

---

## Chunk 5: Runner Refactor

### Task 16: Add orchestrateFetchIdeas function

**Files:**
- Modify: `packages/core/src/filerl/ops/runner.ts`

- [ ] **Step 1: Add orchestrateFetchIdeas function**

```typescript
/**
 * Phase: Fetch Ideas from pool
 *
 * Gets pending ideas from the idea directory for this run.
 * Returns up to batch_size ideas.
 */
export function orchestrateFetchIdeas(
  repoRoot: string,
  name: string,
  onProgress?: (message: string) => void
): OrchestrationResult {
  const debug = createDebugLogger("fetchIdeas");

  const state = readState(repoRoot, name);
  if (!state) {
    return { success: false, phase: "fetch_ideas", error: `FileRL run not found: ${name}` };
  }

  const parseResult = parseTarget(state.target_path, repoRoot);
  if (!parseResult.success || !parseResult.config) {
    return { success: false, phase: "fetch_ideas", error: parseResult.error };
  }

  const config = parseResult.config;

  // Determine ideas directory
  const ideasDir = config.idea.session_dir
    ? resolve(repoRoot, config.idea.session_dir)
    : join(repoRoot, ".viben", "ideas", name);

  // List draft ideas
  const ideasResult = listIdeas(repoRoot, {
    status: "draft",
    sessionDir: ideasDir,
  });

  if (!ideasResult.success) {
    return { success: false, phase: "fetch_ideas", error: "Failed to list ideas" };
  }

  // Take up to batch_size ideas
  const ideas = ideasResult.ideas.slice(0, config.idea.batch_size);

  debug(`Found ${ideas.length} draft ideas (batch_size: ${config.idea.batch_size})`);
  onProgress?.(`Found ${ideas.length} pending ideas`);

  return {
    success: true,
    phase: "fetch_ideas",
    data: {
      ideas,
      ideasDir,
      hasMore: ideasResult.ideas.length > config.idea.batch_size,
      autoGenerate: config.idea.auto_generate,
    },
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/core/src/filerl/ops/runner.ts
git commit -m "feat(filerl): add orchestrateFetchIdeas for manual idea support"
```

---

### Task 17: Add orchestrateCreateRollouts function

**Files:**
- Modify: `packages/core/src/filerl/ops/runner.ts`

- [ ] **Step 1: Add orchestrateCreateRollouts function**

```typescript
/**
 * Phase: Create Rollout Tasks
 *
 * For each idea, creates N rollout tasks (where N = rollout.n).
 * Updates iteration state with task_idea_map.
 */
export function orchestrateCreateRollouts(
  repoRoot: string,
  name: string,
  ideas: Idea[],
  onProgress?: (message: string) => void
): OrchestrationResult {
  const debug = createDebugLogger("createRollouts");

  const state = readState(repoRoot, name);
  if (!state) {
    return { success: false, phase: "create_rollouts", error: `FileRL run not found: ${name}` };
  }

  const parseResult = parseTarget(state.target_path, repoRoot);
  if (!parseResult.success || !parseResult.config) {
    return { success: false, phase: "create_rollouts", error: parseResult.error };
  }

  const config = parseResult.config;
  const currentIter = state.iterations[state.iterations.length - 1];

  if (!currentIter) {
    return { success: false, phase: "create_rollouts", error: "No active iteration" };
  }

  const filerlDir = getFileRlDir(repoRoot, name);
  const taskNames: string[] = [];
  const taskIdeaMap: Record<string, string> = {};
  const errors: string[] = [];

  for (const idea of ideas) {
    for (let rolloutIdx = 0; rolloutIdx < config.rollout.n; rolloutIdx++) {
      const taskSlug = config.rollout.n > 1
        ? `${idea.id}-r${rolloutIdx + 1}`
        : idea.id;

      onProgress?.(`Creating task: ${taskSlug}`);

      const result = promoteIdeaDirect(repoRoot, idea, {
        slug: taskSlug,
        worktree: config.rollout.worktree,
        executor: config.task.executor,
        model: config.task.model,
        start: false,  // Will start in execute_tasks phase
        computeReward: true,
        filerlDir,
      });

      if (result.success && result.dirName) {
        taskNames.push(result.dirName);
        taskIdeaMap[result.dirName] = idea.id;
        debug(`Created ${taskSlug} -> ${result.dirName}`);
      } else {
        errors.push(`Failed to create task for ${idea.id}: ${result.error}`);
      }
    }
  }

  // Update iteration state
  currentIter.ideas = ideas.map(i => i.id);
  currentIter.tasks = taskNames;
  currentIter.task_idea_map = taskIdeaMap;
  writeState(repoRoot, state);

  if (taskNames.length === 0) {
    return { success: false, phase: "create_rollouts", error: errors.join("; ") };
  }

  return {
    success: true,
    phase: "create_rollouts",
    data: { tasks: taskNames, taskIdeaMap, errors: errors.length > 0 ? errors : undefined },
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/core/src/filerl/ops/runner.ts
git commit -m "feat(filerl): add orchestrateCreateRollouts for multi-rollout support"
```

---

### Task 18: Fix orchestrateMergeAndCleanup to dismiss loser ideas

**Files:**
- Modify: `packages/core/src/filerl/ops/runner.ts`

- [ ] **Step 1: Update orchestrateMergeAndCleanup**

```typescript
import { dismissIdea } from "../../idea/ops";

export function orchestrateMergeAndCleanup(
  repoRoot: string,
  name: string,
  selectedTask: string | undefined,
  rejectedTasks: string[],
  taskIdeaMap: Record<string, string>,
  onProgress?: (message: string) => void
): OrchestrationResult {
  const debug = createDebugLogger("mergeAndCleanup");

  const results: {
    merged?: { success: boolean; error?: string };
    cleanedUp: Array<{ task: string; success: boolean; error?: string }>;
    dismissedIdeas: string[];
  } = { cleanedUp: [], dismissedIdeas: [] };

  // Track which ideas should be dismissed (loser ideas)
  const loserIdeaIds = new Set<string>();
  const winnerIdeaId = selectedTask ? taskIdeaMap[selectedTask] : undefined;

  // Approve and merge the winning task
  if (selectedTask) {
    onProgress?.(`Approving winning task: ${selectedTask}`);
    const approveResult = approveTask(repoRoot, selectedTask, {
      cleanupIfMerged: true,
      pullIfMerged: true,
    });

    results.merged = { success: approveResult.success, error: approveResult.error };

    if (approveResult.success) {
      onProgress?.(`Merged PR for task: ${selectedTask}`);
    } else {
      onProgress?.(`Warning: Failed to merge PR: ${approveResult.error}`);
      // Don't dismiss winner idea on merge failure - allow retry
    }
  }

  // Cleanup rejected tasks and collect loser idea IDs
  for (const taskName of rejectedTasks) {
    const ideaId = taskIdeaMap[taskName];
    if (ideaId && ideaId !== winnerIdeaId) {
      loserIdeaIds.add(ideaId);
    }

    cancelTask(repoRoot, taskName, {
      reason: `Rejected in FileRL iteration for run "${name}"`,
      force: true,
    });

    const archiveResult = archiveTask(repoRoot, taskName);
    results.cleanedUp.push({
      task: taskName,
      success: archiveResult.success,
      error: archiveResult.error,
    });
  }

  // Dismiss loser ideas
  for (const ideaId of loserIdeaIds) {
    onProgress?.(`Dismissing loser idea: ${ideaId}`);
    dismissIdea(repoRoot, ideaId);
    results.dismissedIdeas.push(ideaId);
  }

  debug("Complete", {
    merged: results.merged?.success,
    cleanedUp: results.cleanedUp.length,
    dismissedIdeas: results.dismissedIdeas.length,
  });

  return { success: true, phase: "merge_cleanup", data: results };
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/core/src/filerl/ops/runner.ts
git commit -m "fix(filerl): dismiss loser ideas in orchestrateMergeAndCleanup

- Track which ideas belong to rejected tasks
- Dismiss loser ideas (mark as 'dismissed' status)
- Don't dismiss winner idea on merge failure to allow retry"
```

---

### Task 19: Update orchestrateSelectBest to pass taskIdeaMap

**Files:**
- Modify: `packages/core/src/filerl/ops/runner.ts`

- [ ] **Step 1: Update orchestrateSelectBest to use new PPO params**

```typescript
export function orchestrateSelectBest(
  repoRoot: string,
  name: string,
  onProgress?: (message: string) => void
): OrchestrationResult {
  const debug = createDebugLogger("selectBest");

  const state = readState(repoRoot, name);
  if (!state) {
    return { success: false, phase: "select_best", error: `FileRL run not found: ${name}` };
  }

  const parseResult = parseTarget(state.target_path, repoRoot);
  if (!parseResult.success || !parseResult.config) {
    return { success: false, phase: "select_best", error: parseResult.error };
  }

  const config = parseResult.config;
  const currentIter = state.iterations[state.iterations.length - 1];

  if (!currentIter) {
    return { success: false, phase: "select_best", error: "No active iteration" };
  }

  // Gather rewards
  const taskRewards: Record<string, number> = {};
  const filerlDir = getFileRlDir(repoRoot, name);

  for (const taskDirName of currentIter.tasks) {
    // ... (existing reward loading logic) ...
  }

  if (Object.keys(taskRewards).length === 0) {
    return { success: false, phase: "select_best", error: "No tasks with reward data" };
  }

  // Call selectBestTask with new options
  const selectResult = selectBestTask(repoRoot, Object.keys(taskRewards), {
    threshold: config.ppo.quality_threshold,
    klCoef: config.ppo.kl_coef,
    changeSensitivity: config.ppo.change_sensitivity,
    clipRange: config.ppo.clip_range,
    maxDiff: config.ppo.max_diff,
    taskIdeaMap: currentIter.task_idea_map,
    filerlDir,
    iteration: state.current_iteration,
  });

  if (!selectResult.success) {
    return { success: false, phase: "select_best", error: selectResult.error };
  }

  // Update iteration state
  currentIter.selected_task = selectResult.selected || undefined;
  currentIter.rejected_tasks = selectResult.rejected || [];
  currentIter.rewards = taskRewards;
  writeState(repoRoot, state);

  return {
    success: true,
    phase: "select_best",
    data: {
      selected: selectResult.selected,
      rejected: selectResult.rejected,
      rewards: taskRewards,
      taskIdeaMap: currentIter.task_idea_map,
    },
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/core/src/filerl/ops/runner.ts
git commit -m "feat(filerl): update orchestrateSelectBest with two-stage PPO params"
```

---

### Task 20: Update orchestrateFullIteration with new state machine

**Files:**
- Modify: `packages/core/src/filerl/ops/runner.ts`

- [ ] **Step 1: Rewrite orchestrateFullIteration with new phases**

This is a large refactor - update the phase flow to:
1. `fetch_ideas` → check if ideas exist
2. `generate_ideas` → only if auto_generate=true and no ideas
3. `create_rollouts` → create N tasks per idea
4. `execute_tasks` → start executors
5. `wait_tasks` → poll for completion
6. `compute_rewards` → evaluate PRs
7. `select_best` → two-stage PPO
8. `merge_cleanup` → merge winner, dismiss losers
9. `check_converge` → check convergence criteria

```typescript
export async function orchestrateFullIteration(
  repoRoot: string,
  name: string,
  onProgress?: (message: string) => void
): Promise<OrchestrationResult> {
  // ... (implementation following new state machine)
  // Key changes:
  // 1. Call orchestrateFetchIdeas first
  // 2. Call orchestrateCreateRollouts instead of orchestratePromoteIdeas
  // 3. Pass taskIdeaMap to orchestrateMergeAndCleanup
  // 4. Use config.convergence for checkConvergence
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/core/src/filerl/ops/runner.ts
git commit -m "refactor(filerl): update orchestrateFullIteration with new state machine

- Add fetch_ideas phase for manual idea support
- Use create_rollouts for multi-rollout task creation
- Pass taskIdeaMap through selection and cleanup
- Use convergence config for early stop detection"
```

---

## Chunk 6: CLI Updates

### Task 21: Add filerl add-idea command

**Files:**
- Modify: `packages/core/src/cli/commands/filerl.ts`

- [ ] **Step 1: Add add-idea subcommand**

```typescript
// ============================================================================
// filerl add-idea <name> <idea-path>
// ============================================================================
fileRlCmd
  .command("add-idea")
  .description("Add an idea file to a FileRL run's idea pool")
  .argument("<name>", "Name of the FileRL run")
  .argument("<idea-path>", "Path to the idea file (.md)")
  .option("--json", "JSON format output")
  .action(async (name: string, ideaPath: string, options: { json?: boolean }) => {
    const ctx = getOutputContext(program);
    if (options.json) {
      ctx.json = true;
    }
    const cwd = process.cwd();

    try {
      const repoRoot = ensureVibenRoot(cwd);

      // Check run exists
      const state = readState(repoRoot, name);
      if (!state) {
        throw CliError.notFound("FileRL run", name);
      }

      // Get config to find ideas directory
      const parseResult = parseTarget(state.target_path, repoRoot);
      if (!parseResult.success || !parseResult.config) {
        throw CliError.operationFailed("Parse target", parseResult.error || "Failed");
      }

      const config = parseResult.config;
      const ideasDir = config.idea.session_dir
        ? resolve(repoRoot, config.idea.session_dir)
        : join(repoRoot, ".viben", "ideas", name);

      // Ensure ideas directory exists
      if (!existsSync(ideasDir)) {
        mkdirSync(ideasDir, { recursive: true });
      }

      // Copy idea file to ideas directory
      const srcPath = resolve(cwd, ideaPath);
      if (!existsSync(srcPath)) {
        throw CliError.notFound("Idea file", ideaPath);
      }

      const destPath = join(ideasDir, basename(ideaPath));
      copyFileSync(srcPath, destPath);

      output(ctx, successResponse({ name, ideaPath: destPath }), () => {
        outputSuccess(ctx, `Added idea to ${name}: ${basename(ideaPath)}`);
      });
    } catch (error) {
      handleCommandError(ctx, error);
    }
  });
```

- [ ] **Step 2: Add list-ideas subcommand**

```typescript
// ============================================================================
// filerl list-ideas <name>
// ============================================================================
fileRlCmd
  .command("list-ideas")
  .description("List ideas in a FileRL run's pool")
  .argument("<name>", "Name of the FileRL run")
  .option("--status <status>", "Filter by status (draft, promoted, dismissed)")
  .option("--json", "JSON format output")
  .action(async (name: string, options: { status?: string; json?: boolean }) => {
    const ctx = getOutputContext(program);
    if (options.json) {
      ctx.json = true;
    }
    const cwd = process.cwd();

    try {
      const repoRoot = ensureVibenRoot(cwd);

      // Check run exists and get config
      const state = readState(repoRoot, name);
      if (!state) {
        throw CliError.notFound("FileRL run", name);
      }

      const parseResult = parseTarget(state.target_path, repoRoot);
      if (!parseResult.success || !parseResult.config) {
        throw CliError.operationFailed("Parse target", parseResult.error || "Failed");
      }

      const config = parseResult.config;
      const ideasDir = config.idea.session_dir
        ? resolve(repoRoot, config.idea.session_dir)
        : join(repoRoot, ".viben", "ideas", name);

      const result = listIdeas(repoRoot, {
        status: options.status as IdeaStatus | undefined,
        sessionDir: ideasDir,
      });

      output(ctx, successResponse({ ideas: result.ideas, count: result.ideas.length }), () => {
        if (result.ideas.length === 0) {
          console.log(chalk.gray("No ideas found."));
          console.log();
          console.log("To add ideas:");
          console.log(`  viben filerl add-idea ${name} path/to/idea.md`);
          return;
        }

        outputTable(
          ctx,
          ["ID", "TITLE", "EFFORT", "STATUS"],
          result.ideas.map(idea => [
            idea.id,
            idea.title.slice(0, 40) + (idea.title.length > 40 ? "..." : ""),
            idea.estimatedEffort,
            formatIdeaStatus(idea.status),
          ])
        );
      });
    } catch (error) {
      handleCommandError(ctx, error);
    }
  });
```

- [ ] **Step 3: Add import for copyFileSync and listIdeas**

```typescript
import { writeFileSync, existsSync, mkdirSync, copyFileSync } from "node:fs";
import { listIdeas, type IdeaStatus } from "../../idea/ops";
```

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/cli/commands/filerl.ts
git commit -m "feat(filerl): add add-idea and list-ideas CLI commands"
```

---

### Task 22: Update filerl status to show new config fields

**Files:**
- Modify: `packages/core/src/cli/commands/filerl.ts`

- [ ] **Step 1: Update status command output**

```typescript
// In the status command action:
outputKeyValue(ctx, {
  "Target": state.target_path,
  "Status": state.converged
    ? chalk.green("converged")
    : state.active
      ? chalk.cyan("active")
      : chalk.yellow("paused"),
  "Iteration": `${state.current_iteration} / ${config?.convergence.max_iterations || "?"}`,
  "Completed": state.completed_iterations.toString(),
  "No-merge streak": `${state.no_merge_count} / ${config?.convergence.no_merge_limit || "?"}`,
  "Best Reward": state.best_reward.toFixed(3),
  "Best Task": state.best_task || "-",
});

// Show config summary
if (config) {
  console.log();
  console.log(chalk.bold("Configuration:"));
  outputKeyValue(ctx, {
    "Auto-generate": formatStatus(config.idea.auto_generate, "yes", "no"),
    "Batch size": config.idea.batch_size.toString(),
    "Rollouts per idea": config.rollout.n.toString(),
    "Quality threshold": config.ppo.quality_threshold.toString(),
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/core/src/cli/commands/filerl.ts
git commit -m "feat(filerl): update status command with new config fields"
```

---

### Task 23: Update filerl start to show new workflow

**Files:**
- Modify: `packages/core/src/cli/commands/filerl.ts`

- [ ] **Step 1: Update start command output messages**

```typescript
// In start command:
console.log(chalk.green("=== FileRL Starting ==="));
console.log();
console.log(`  Name:              ${config.name}`);
console.log(`  Target:            ${target}`);
console.log(`  Auto-generate:     ${config.idea.auto_generate ? "yes" : "no"}`);
console.log(`  Batch size:        ${config.idea.batch_size} ideas`);
console.log(`  Rollouts per idea: ${config.rollout.n}`);
console.log(`  Max iterations:    ${config.convergence.max_iterations}`);
console.log();

if (!config.idea.auto_generate) {
  console.log(chalk.yellow("Note: auto_generate is off. Add ideas manually:"));
  console.log(chalk.yellow(`  viben filerl add-idea ${config.name} path/to/idea.md`));
  console.log();
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/core/src/cli/commands/filerl.ts
git commit -m "feat(filerl): update start command with new workflow info"
```

---

## Chunk 7: Testing and Documentation

### Task 24: Update FileRL.md slash command

**Files:**
- Modify: `.claude/commands/viben/FileRL.md`

- [ ] **Step 1: Update configuration section**

Update the YAML config example to match new format:

```yaml
filerl:
  rollout:
    n: 3                          # Number of parallel PRs per idea
    worktree: true                # Use git worktree isolation

  ppo:
    kl_coef: 0.05                 # KL penalty coefficient
    change_sensitivity: 2.0       # Change penalty sensitivity
    clip_range: 0.2               # PPO clipping parameter
    quality_threshold: 0.6        # Minimum reward threshold
    max_diff: 500                 # Max lines changed

  convergence:
    threshold: 0.01               # Convergence delta
    max_iterations: 50            # Max iterations
    no_merge_limit: 5             # Early stop after N no-merges
```

- [ ] **Step 2: Update commands reference table**

```markdown
| PPO Step | Viben Command | Description |
|----------|---------------|-------------|
| Add idea | `viben filerl add-idea <name> <idea.md>` | Add idea to pool |
| List ideas | `viben filerl list-ideas <name>` | List ideas in pool |
| Start | `viben filerl start <target.md>` | Start optimization |
| Status | `viben filerl status <name>` | View progress |
| Stop | `viben filerl stop <name>` | Stop run |
| Resume | `viben filerl resume <name>` | Continue run |
```

- [ ] **Step 3: Commit**

```bash
git add .claude/commands/viben/FileRL.md
git commit -m "docs(filerl): update FileRL.md with new config format and commands"
```

---

### Task 25: Run full typecheck and fix remaining errors

**Files:**
- Multiple files may need minor fixes

- [ ] **Step 1: Run typecheck**

Run: `cd packages/core && pnpm typecheck 2>&1`
Expected: All type errors should be resolved

- [ ] **Step 2: Fix any remaining type errors**

Address each error by updating the affected file.

- [ ] **Step 3: Run lint**

Run: `cd packages/core && pnpm lint`
Expected: No lint errors

- [ ] **Step 4: Run tests**

Run: `cd packages/core && pnpm test`
Expected: All tests pass (some may need updates)

- [ ] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "fix(filerl): resolve remaining type and lint errors"
```

---

### Task 26: Final verification

- [ ] **Step 1: Create a test target file**

```bash
cat > /tmp/test-filerl.md << 'EOF'
---
name: test-optimization
description: Test FileRL redesign

idea:
  auto_generate: false
  batch_size: 2

rollout:
  n: 2
  worktree: true

ppo:
  kl_coef: 0.05
  change_sensitivity: 2.0
  clip_range: 0.2
  quality_threshold: 0.6
  max_diff: 500

convergence:
  threshold: 0.01
  max_iterations: 3
  no_merge_limit: 2

reward:
  types:
    - code_quality
  weights:
    - 1.0

task:
  executor: CLAUDE_CODE
---

# Test Optimization

Testing the new FileRL config format.
EOF
```

- [ ] **Step 2: Test dry-run parsing**

Run: `viben filerl start /tmp/test-filerl.md --dry-run`
Expected: Shows parsed config with new field names

- [ ] **Step 3: Test create command**

Run: `viben filerl create new-test --output /tmp/new-test.md`
Expected: Creates file with new config format

- [ ] **Step 4: Commit**

```bash
git commit --allow-empty -m "test(filerl): verify new config format works"
```

---

## Summary

This plan implements the FileRL redesign in 26 tasks across 7 chunks:

1. **Chunk 1 (Tasks 1-8)**: Type definitions update
2. **Chunk 2 (Tasks 9-11)**: Parser update
3. **Chunk 3 (Tasks 12-13)**: PPO selection algorithm
4. **Chunk 4 (Tasks 14-15)**: State management
5. **Chunk 5 (Tasks 16-20)**: Runner refactor
6. **Chunk 6 (Tasks 21-23)**: CLI updates
7. **Chunk 7 (Tasks 24-26)**: Testing and documentation

Key changes:
- New config format with semantic field names
- Support for manual idea input (`auto_generate: false`)
- Multi-rollout support (`rollout.n`)
- Two-stage PPO selection (best per idea, then global best)
- Loser idea dismissal fix
- New CLI commands: `add-idea`, `list-ideas`
