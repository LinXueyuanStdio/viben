# compute-reward Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement compute-reward as a work-phase action, triggered by `--compute-reward` flag on task create.

**Architecture:**
1. `viben task create --compute-reward` sets `compute_reward: true` in task.json
2. work.md agent handles `action: "compute-reward"` by calling reward subagent
3. `viben task compute-reward <task>` available as manual trigger

**Tech Stack:** TypeScript, Commander.js CLI, Node.js child_process spawn

---

## File Structure

| File | Responsibility |
|------|----------------|
| `packages/core/src/task/ops/types.ts` | Add `reward_config`, `reward`, `compute_reward` fields to UnifiedTask |
| `packages/core/src/task/ops/crud.ts` | Handle `--compute-reward` option in createTask |
| `packages/core/src/task/phase/reward.ts` | Phase runner: validation, jsonl generation, agent spawn |
| `packages/core/src/task/phase/index.ts` | Export reward phase |
| `packages/core/src/cli/commands/task.ts` | CLI: `--compute-reward` option + `compute-reward` subcommand |
| `.claude/agents/reward.md` | Agent config: evaluation workflow and output format |
| `.claude/agents/work.md` | Add `action: "compute-reward"` handling |

---

## Chunk 1: Type Extensions

### Task 1: Add reward fields to UnifiedTask

**Files:**
- Modify: `packages/core/src/task/ops/types.ts:330` (after `machine_context`)

- [ ] **Step 1: Open types.ts and locate insertion point**

Find the end of `UnifiedTask` interface, after `machine_context` field (around line 330).

- [ ] **Step 2: Add compute_reward, reward_config and reward fields**

Add these fields before the closing brace of `UnifiedTask`:

```typescript
  // === FileRL Reward ===
  /** Enable compute-reward phase in work-phase pipeline */
  compute_reward?: boolean;

  /** Reward configuration for evaluation */
  reward_config?: import("../../reward/ops/types").RewardConfig;

  /** Reward evaluation result */
  reward?: import("../../reward/ops/types").RewardResult;
```

- [ ] **Step 3: Verify typecheck passes**

Run: `cd packages/core && pnpm typecheck`
Expected: No errors related to UnifiedTask

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/task/ops/types.ts
git commit -m "feat(task): add reward_config and reward fields to UnifiedTask"
```

---

## Chunk 1.5: CLI --compute-reward Option

### Task 1.5: Add --compute-reward option to task create

**Files:**
- Modify: `packages/core/src/cli/commands/task.ts` (task create command)
- Modify: `packages/core/src/task/ops/crud.ts` (createTask function)

- [ ] **Step 1: Add --compute-reward option to task create command**

Find the `task create` command (around line 543) and add the option:

```typescript
    .option("--compute-reward", "Enable compute-reward phase after create-pr")
```

Add after the existing `--worktree` option.

- [ ] **Step 2: Update action handler to pass compute_reward**

In the action handler, add `computeReward` to options type and pass to createTask:

```typescript
// In options type (around line 556)
computeReward?: boolean;

// In createTask call (around line 573)
const result = createTask(repoRoot, title, {
  ...options,
  computeReward: options.computeReward,
});
```

- [ ] **Step 3: Update createTask in crud.ts to handle compute_reward**

Find `createTask` function in `packages/core/src/task/ops/crud.ts` and add:

```typescript
// In CreateTaskOptions interface
computeReward?: boolean;

// In task object creation
const task: UnifiedTask = {
  // ... existing fields ...
  compute_reward: options.computeReward ?? false,
  // If compute_reward is true, also add default reward_config
  ...(options.computeReward && {
    reward_config: {
      types: ["test_coverage", "code_quality", "agent_review"],
      weights: [0.34, 0.33, 0.33],
    },
  }),
};
```

- [ ] **Step 4: Verify typecheck passes**

Run: `cd packages/core && pnpm typecheck`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/cli/commands/task.ts packages/core/src/task/ops/crud.ts
git commit -m "feat(cli): add --compute-reward option to task create"
```

---

## Chunk 2: Reward Agent Configuration

### Task 2: Create reward.md agent

**Files:**
- Create: `.claude/agents/reward.md`

- [ ] **Step 1: Create reward.md agent configuration**

```markdown
---
name: reward
description: |
  PR quality evaluation agent for FileRL. Evaluates code changes using reward type prompts. **IMPORTANT**: Always include `task_dir: <abs path>` as the FIRST LINE of prompt.
tools: Read, Bash, Glob, Grep
model: sonnet
---

# Reward Agent

You are the Reward Agent in the FileRL workflow. Your job is to evaluate PR quality using multiple reward type prompts.

## Task Directory

The task directory is provided in your prompt as `task_dir: <path>`.

Extract this path first, then read the required files from it.

## Startup: Read Context Files

**MUST read these files before evaluating:**

1. **Reward type list**: `{task_dir}/reward.jsonl`
   - Each line is JSON: `{"file": "path/to/reward-type.md", "reason": "type_name", "weight": 0.33}`
   - Read ALL reward type prompt files listed

2. **Task requirements**: `{task_dir}/prd.md` (to understand intent)

3. **Code changes**: Run `git diff main..HEAD` or `git diff origin/main..HEAD`

4. **PR info** (if available): Run `gh pr view --json title,body,state`

## Evaluation Workflow

For each reward type in reward.jsonl:

1. Read the reward type prompt file
2. Apply the evaluation criteria from that prompt
3. Score the PR (0.0 - 1.0)
4. Output JSON result immediately after evaluation

## Output Format

**CRITICAL**: Output each score as a single-line JSON immediately after evaluating:

```json
{"type": "test_coverage", "score": 0.95, "reasoning": "High test coverage, all critical paths tested"}
```

After ALL types are evaluated, output a summary:

```json
{"_summary": true, "scores": {"test_coverage": {"score": 0.95, "reasoning": "..."}, "code_quality": {"score": 0.82, "reasoning": "..."}}, "completed": true}
```

## Scoring Guidelines

| Score Range | Meaning |
|-------------|---------|
| 0.9 - 1.0 | Excellent - exceeds expectations |
| 0.7 - 0.9 | Good - meets expectations with minor issues |
| 0.5 - 0.7 | Acceptable - meets basic requirements |
| 0.3 - 0.5 | Poor - significant issues |
| 0.0 - 0.3 | Failing - does not meet requirements |

## Completion Marker

After outputting the summary JSON, output:

```
REWARD_EVALUATION_COMPLETE
```

This signals the evaluation is finished.
```

- [ ] **Step 2: Verify agent file exists**

Run: `ls -la .claude/agents/reward.md`
Expected: File exists with correct content

- [ ] **Step 3: Commit**

```bash
git add .claude/agents/reward.md
git commit -m "feat(agent): add reward agent for PR quality evaluation"
```

---

### Task 2.5: Update start.md to handle compute-reward action

> **Note**: Architecture changed - `create-pr` and `compute-reward` are now handled by **start agent** in main repo, not work agent.

**Files:**
- Modify: `.claude/commands/viben/start.md`

- [ ] **Step 1: Add compute-reward phase documentation**

Add Phase 4 after Phase 3 (Create PR):

```markdown
## Phase 4: Compute Reward (If Enabled)

If task has `compute_reward=true`, run reward phase after PR creation:

```bash
viben task compute-reward "$TASK_DIR"
```

This action evaluates PR quality using reward type prompts. The reward agent will:

```
Task(
  subagent_type: "reward",
  prompt: "task_dir: .viben/tasks/02-03-my-feature\n\nEvaluate PR quality using reward types in reward.jsonl",
  model: "sonnet",
  run_in_background: true
)
```

The reward agent will:
1. Read reward.jsonl for configured reward types
2. Read each reward type prompt
3. Evaluate code changes against each type
4. Output JSON scores

After reward agent completes, the scores are written to task.json.

**Workflow order**:
- Work agent: implement → check → finish
- Start agent (after work completes): create-pr → **compute-reward** (if enabled)
```

- [ ] **Step 2: Update the phase handling table**

In the "Two Working Modes" section, update to include compute-reward:

```markdown
| Mode | worktree | Branch switching | Final actions |
|------|----------|------------------|---------------|
| Main Repo | `false` or absent | NO switching | Notify completion |
| Worktree | `true` | Isolated branch | Notify completion (start agent handles create-pr → compute-reward) |
```

- [ ] **Step 3: Verify work.md is valid markdown**

Run: `cat .claude/agents/work.md | head -50`
Expected: Valid markdown with new section

- [ ] **Step 4: Commit**

```bash
git add .claude/agents/work.md
git commit -m "feat(agent): add compute-reward action to work agent"
```

---

## Chunk 3: Phase Runner Implementation

### Task 3: Create reward.ts phase runner

**Files:**
- Create: `packages/core/src/task/phase/reward.ts`

- [ ] **Step 1: Create reward.ts with types and imports**

```typescript
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

import { spawn, type SpawnOptions, type ChildProcess } from "node:child_process";
import { existsSync, writeFileSync, openSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import {
  readTaskJson,
  writeTaskJson,
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
  /** Warning messages (non-fatal) */
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
 * Entry in reward.jsonl
 */
interface RewardJsonlEntry {
  file: string;
  reason: string;
  weight: number;
}
```

- [ ] **Step 2: Add generateRewardJsonl helper function**

```typescript
// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Generate reward.jsonl file with reward type prompts
 *
 * @param repoRoot - Repository root path
 * @param taskDirAbs - Absolute path to task directory
 * @param config - Reward configuration
 * @returns Array of warnings if any types not found
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

  // Write reward.jsonl
  const jsonlPath = join(taskDirAbs, "reward.jsonl");
  const content = entries.map((e) => JSON.stringify(e)).join("\n") + "\n";
  writeFileSync(jsonlPath, content, "utf-8");

  return { success: true, warnings };
}
```

- [ ] **Step 3: Add main runRewardPhase function**

```typescript
// =============================================================================
// Main Function
// =============================================================================

/**
 * Run the reward phase for a task
 *
 * This function:
 * 1. Validates prerequisites (task.json, reward agent)
 * 2. Generates reward.jsonl with reward type prompts
 * 3. Spawns the reward agent in background
 * 4. Registers the agent to the registry
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

  // Check PR URL (warning if missing, not error)
  if (!taskData.pr_url) {
    warnings.push("pr_url not found in task.json - PR may not have been created");
  }

  // Get reward config (use default if not specified)
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

  const env: Record<string, string> = { ...process.env } as Record<string, string>;

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
```

- [ ] **Step 4: Add runRewardPhaseSync as alias (since async version is already synchronous)**

The `runRewardPhase` function is async in signature but actually synchronous in behavior (spawn is detached and returns immediately). For consistency with other phase runners, export a sync alias:

```typescript
/**
 * Run reward phase synchronously (for CLI commands)
 *
 * Note: runRewardPhase is already effectively synchronous since it spawns
 * a detached process and returns immediately. This sync version exists
 * for API consistency with other phase runners.
 */
export function runRewardPhaseSync(
  repoRoot: string,
  taskDir: string,
  options?: RewardPhaseOptions
): RewardPhaseResult {
  // Call async version synchronously - safe because spawn is detached
  // and the function returns immediately after spawning
  const result = { success: false, error: "Not executed" } as RewardPhaseResult;

  // Use a synchronous approach - inline the logic
  // (Copy core validation and spawn logic from runRewardPhase)
  // See implement.ts for the pattern - it has identical async/sync versions

  // For simplicity, just re-implement inline following implement.ts pattern
  return runRewardPhaseInternal(repoRoot, taskDir, options);
}

// Extract shared logic to internal function
function runRewardPhaseInternal(
  repoRoot: string,
  taskDir: string,
  options?: RewardPhaseOptions
): RewardPhaseResult {
  // ... (same logic as runRewardPhase but without async/await)
}
```

**Implementation note:** Follow the pattern in `implement.ts` which has both `runImplementPhase` (async) and `runImplementPhaseSync` (sync) with duplicated logic. While not DRY, this matches the established pattern in the codebase.

- [ ] **Step 5: Verify typecheck passes**

Run: `cd packages/core && pnpm typecheck`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/task/phase/reward.ts
git commit -m "feat(task/phase): add reward phase runner"
```

---

### Task 4: Export reward phase from index

**Files:**
- Modify: `packages/core/src/task/phase/index.ts`

- [ ] **Step 1: Add reward phase export**

Add after the merge-pr export:

```typescript
// Reward Phase (evaluates PR quality using reward agents)
export {
  runRewardPhase,
  runRewardPhaseSync,
  DEFAULT_REWARD_CONFIG,
  type RewardPhaseOptions,
  type RewardPhaseResult,
} from "./reward";
```

- [ ] **Step 2: Verify typecheck passes**

Run: `cd packages/core && pnpm typecheck`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/task/phase/index.ts
git commit -m "feat(task/phase): export reward phase"
```

---

## Chunk 4: CLI Command Implementation (Manual Trigger)

### Task 5: Add compute-reward subcommand (manual trigger)

**Files:**
- Modify: `packages/core/src/cli/commands/task.ts`

This command allows manual triggering of compute-reward outside of work-phase pipeline.

- [ ] **Step 1: Add import for runRewardPhaseSync**

Find the imports section (around line 143-147 where phase operations are imported) and add:

```typescript
// Add runRewardPhaseSync to existing phase imports:
import { runRewardPhaseSync } from "../../task/phase";
```

- [ ] **Step 2: Find location to add compute-reward command**

Search for an existing subcommand like `implement-phase` or `check-phase` to understand the pattern. Add compute-reward after similar phase commands.

- [ ] **Step 3: Add compute-reward subcommand**

```typescript
  // ============================================================================
  // task compute-reward (manual trigger for compute-reward phase)
  // ============================================================================
  taskCmd
    .command("compute-reward")
    .description("Manually trigger PR quality evaluation using reward types")
    .argument("<task>", "Task name or directory")
    .option("--platform <platform>", "Executor platform", "claude")
    .option("--no-detach", "Run in foreground (block until complete)")
    .option("-v, --verbose", "Enable verbose output")
    .option("--json", "JSON format output")
    .action(
      async (
        task: string,
        options: {
          platform?: string;
          detach?: boolean;
          verbose?: boolean;
          json?: boolean;
        }
      ) => {
        const ctx = getContext(program);
        if (options.json) {
          ctx.json = true;
        }

        const cwd = process.cwd();

        try {
          const repoRoot = ensureVibenDirWithRoot(cwd);
          const taskDir = resolveTaskDirectory(task, repoRoot);

          if (!taskDir) {
            throw CliError.notFound("Task", task);
          }

          const result = runRewardPhaseSync(repoRoot, taskDir, {
            platform: options.platform || "claude",
            verbose: options.verbose ?? true,
          });

          if (!result.success) {
            throw CliError.operationFailed("Compute reward", result.error || "Unknown error");
          }

          output(
            ctx,
            successResponse({
              agentId: result.agentId,
              pid: result.pid,
              logFile: result.logFile,
              warnings: result.warnings,
            }),
            () => {
              outputSuccess(ctx, `Reward agent started: ${result.agentId}`);
              console.log();
              outputKeyValue(ctx, {
                "Agent ID": result.agentId || "",
                PID: String(result.pid || ""),
                "Log file": result.logFile || "",
              });

              if (result.warnings && result.warnings.length > 0) {
                console.log();
                for (const warning of result.warnings) {
                  outputWarning(ctx, warning);
                }
              }

              console.log();
              console.log(chalk.gray("Monitor with: viben swarm status --watch"));
              console.log(chalk.gray(`View logs: tail -f ${result.logFile}`));
            }
          );
        } catch (error) {
          handleCommandError(ctx, error);
        }
      }
    );
```

- [ ] **Step 4: Verify typecheck passes**

Run: `cd packages/core && pnpm typecheck`
Expected: No errors

- [ ] **Step 5: Build and verify CLI**

Run: `cd packages/core && pnpm build`
Expected: Build succeeds

Run: `viben task compute-reward --help`
Expected: Shows command help

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/cli/commands/task.ts
git commit -m "feat(cli): add compute-reward subcommand"
```

---

## Chunk 5: Integration and Testing

### Task 6: Manual integration test

- [ ] **Step 1: Create a test task directory**

```bash
mkdir -p .viben/tasks/test-reward
cat > .viben/tasks/test-reward/task.json << 'EOF'
{
  "id": "test-reward",
  "name": "test-reward",
  "title": "Test Reward Computation",
  "status": "in_progress",
  "priority": "medium",
  "createdAt": "2026-03-17T00:00:00Z",
  "pr_url": "https://github.com/example/repo/pull/1",
  "reward_config": {
    "types": ["code_quality", "agent_review"],
    "weights": [0.5, 0.5]
  }
}
EOF

cat > .viben/tasks/test-reward/prd.md << 'EOF'
# Test Task PRD

This is a test task for reward computation.

## Requirements
- Test the reward agent
- Verify JSON output format
EOF
```

- [ ] **Step 2: Run compute-reward command**

Run: `viben task compute-reward test-reward --verbose`
Expected: Agent starts, shows PID and log file path

- [ ] **Step 3: Check reward.jsonl was generated**

Run: `cat .viben/tasks/test-reward/reward.jsonl`
Expected: Contains entries for code_quality and agent_review

- [ ] **Step 4: Monitor agent output**

Run: `tail -f .viben/tasks/test-reward/reward.log.jsonl`
Expected: Shows agent evaluation progress and JSON scores

- [ ] **Step 5: Cleanup test task**

```bash
rm -rf .viben/tasks/test-reward
```

- [ ] **Step 6: Final commit with any fixes**

```bash
git status
# If any fixes were needed, commit them
```

---

## Summary

| Task | Files | Description |
|------|-------|-------------|
| 1 | `task/ops/types.ts` | Add compute_reward, reward_config, reward fields to UnifiedTask |
| 1.5 | `cli/commands/task.ts`, `task/ops/crud.ts` | Add --compute-reward option to task create |
| 2 | `.claude/agents/reward.md` | Create reward agent config |
| 2.5 | `.claude/agents/work.md` | Add compute-reward action handling |
| 3 | `task/phase/reward.ts` | Create phase runner |
| 4 | `task/phase/index.ts` | Export reward phase |
| 5 | `cli/commands/task.ts` | Add compute-reward manual trigger command |
| 6 | (manual test) | Integration testing |

**Key Integration Points:**
- `viben task create --compute-reward` → sets `compute_reward: true` in task.json
- start.md agent checks `compute_reward` field and runs reward phase after create-pr (both called from main repo)
- `viben task compute-reward <task>` → manual trigger for testing/debugging

**Total estimated time:** 45-60 minutes
