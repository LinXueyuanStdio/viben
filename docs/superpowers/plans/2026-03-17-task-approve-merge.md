# Task Approve Auto-Merge Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend `viben task approve` to automatically detect PRs and spawn merge-pr agent for handling merges.

**Architecture:** When `pr_url` exists in task.json, spawn a detached merge-pr agent that checks CI status, handles conflicts, merges the PR, and updates task.json. Without `pr_url`, keep the existing simple status transition behavior.

**Tech Stack:** TypeScript, Node.js child_process (spawn), Claude Code CLI adapter pattern

**Spec:** `docs/superpowers/specs/2026-03-17-task-approve-merge-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `packages/core/src/task/phase/merge-pr.ts` | Create | Phase runner - validates prerequisites, spawns agent |
| `packages/core/src/task/phase/index.ts` | Modify | Export new phase |
| `.claude/agents/merge-pr.md` | Create | Agent config and system prompt |
| `packages/core/src/cli/commands/task.ts` | Modify | Extend approve command with PR detection |

---

## Chunk 1: Phase Runner

### Task 1: Create merge-pr phase runner skeleton

**Files:**
- Create: `packages/core/src/task/phase/merge-pr.ts`

- [ ] **Step 1: Create file with type definitions and imports**

```typescript
/**
 * Merge PR Phase Runner
 *
 * Runs the merge-pr agent for a task to merge an associated PR.
 * This is an async phase runner - it spawns the agent and returns immediately.
 *
 * Prerequisites:
 *    - task.json must exist
 *    - task.json must contain pr_url
 *    - merge-pr agent must exist (.claude/agents/merge-pr.md)
 *
 * The agent will:
 *    1. Check PR status (CI, mergeable)
 *    2. Merge the PR if ready
 *    3. Update task.json with merged_at, merge_commit, status
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
 * Options for running the merge-pr phase
 *
 * Note: pr_url and worktree_path are read from task.json, not passed as options.
 */
export interface MergePRPhaseOptions {
  /** Platform to use (default: "claude") */
  platform?: string;
  /** Enable verbose output */
  verbose?: boolean;
}

/**
 * Result of running the merge-pr phase
 */
export interface MergePRPhaseResult {
  /** Whether the agent started successfully (not whether merge completed) */
  success: boolean;
  /** Agent ID for tracking */
  agentId?: string;
  /** Process ID of the spawned agent */
  pid?: number;
  /** Path to the log file */
  logFile?: string;
  /** Error message if failed to start */
  error?: string;
}

/**
 * Task data structure (subset of TaskJson)
 */
interface TaskData {
  id?: string;
  name?: string;
  pr_url?: string;
  worktree_path?: string;
  [key: string]: unknown;
}
```

- [ ] **Step 2: Verify file created**

Run: `head -20 packages/core/src/task/phase/merge-pr.ts`
Expected: Shows imports and type definitions

- [ ] **Step 3: Commit skeleton**

```bash
git add packages/core/src/task/phase/merge-pr.ts
git commit -m "feat(task): add merge-pr phase runner skeleton"
```

---

### Task 2: Implement runMergePRPhase function

**Files:**
- Modify: `packages/core/src/task/phase/merge-pr.ts`

- [ ] **Step 1: Add the main function implementation**

Append to `packages/core/src/task/phase/merge-pr.ts`:

```typescript
// =============================================================================
// Main Function
// =============================================================================

/**
 * Run the merge-pr phase for a task (async - returns immediately after spawning agent)
 *
 * This function:
 * 1. Validates prerequisites (task.json, pr_url, merge-pr agent)
 * 2. Sets up environment variables
 * 3. Spawns the merge-pr agent in background
 * 4. Registers the agent to the registry
 *
 * @param repoRoot - Repository root path
 * @param taskDir - Task directory path (relative or absolute)
 * @param options - Phase options
 * @returns MergePRPhaseResult with success status and details
 */
export async function runMergePRPhase(
  repoRoot: string,
  taskDir: string,
  options?: MergePRPhaseOptions
): Promise<MergePRPhaseResult> {
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

  // 2. Read task.json
  const taskData = readTaskJson(taskDirAbs) as TaskData | null;
  if (!taskData) {
    return {
      success: false,
      error: "Failed to read task.json",
    };
  }

  // 3. Check pr_url exists
  if (!taskData.pr_url) {
    return {
      success: false,
      error: "task.json does not contain pr_url",
    };
  }

  // 4. Check merge-pr agent exists
  const mergePrMd = adapter.getAgentConfigPath("merge-pr", repoRoot);
  if (!existsSync(mergePrMd)) {
    return {
      success: false,
      error: `merge-pr.md not found at ${mergePrMd}. Platform: ${platform}`,
    };
  }

  // Get task identification
  const taskName = taskData.name || taskData.id || "unknown";

  // =============================================================================
  // Determine Working Directory
  // =============================================================================

  // Use worktree_path if it exists and is valid, otherwise use repoRoot
  let workingDir = repoRoot;
  if (taskData.worktree_path && existsSync(taskData.worktree_path)) {
    workingDir = taskData.worktree_path;
  }

  // =============================================================================
  // Set Up Environment
  // =============================================================================

  const env: Record<string, string> = { ...process.env } as Record<string, string>;

  // Task-specific environment variables
  env.MERGE_TASK_NAME = taskName;
  env.MERGE_TASK_DIR = taskDirRelative;
  env.MERGE_PR_URL = taskData.pr_url;
  if (taskData.worktree_path) {
    env.MERGE_WORKTREE_PATH = taskData.worktree_path;
  }

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

Merge the PR for this task.

PR URL: ${taskData.pr_url}

Check CI status, resolve conflicts if any, then merge.
Update task.json with merged_at, merge_commit, and status when done.`;

  const cliCmd = adapter.buildRunCommand({
    agent: "merge-pr",
    prompt,
    skipPermissions: true,
    verbose,
    jsonOutput: true,
  });

  // =============================================================================
  // Spawn Background Process
  // =============================================================================

  const logFile = join(taskDirAbs, "merge-pr.log.jsonl");

  // Create empty log file
  writeFileSync(logFile, "", "utf-8");

  // Open log file for writing
  const logFd = openSync(logFile, "w");

  // Spawn options
  const spawnOpts: SpawnOptions = {
    cwd: workingDir,
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
      error: `Failed to spawn merge-pr agent: ${error}`,
    };
  }

  // Detach process so it continues running after parent exits
  child.unref();

  const agentPid = child.pid || 0;

  // =============================================================================
  // Register Agent to Registry
  // =============================================================================

  const agentId = `merge-pr-${taskName}`;

  registryAddAgent(
    {
      agentId,
      worktreePath: workingDir,
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
```

- [ ] **Step 2: Verify implementation compiles**

Run: `cd /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben && pnpm typecheck --filter @viben/core`
Expected: No type errors in merge-pr.ts

- [ ] **Step 3: Commit implementation**

```bash
git add packages/core/src/task/phase/merge-pr.ts
git commit -m "feat(task): implement runMergePRPhase function"
```

---

### Task 3: Export from phase index

**Files:**
- Modify: `packages/core/src/task/phase/index.ts`

- [ ] **Step 1: Add export for merge-pr phase**

Add at the end of `packages/core/src/task/phase/index.ts`:

```typescript
// Merge PR Phase (merges PR via agent)
export {
  runMergePRPhase,
  type MergePRPhaseOptions,
  type MergePRPhaseResult,
} from "./merge-pr";
```

- [ ] **Step 2: Verify export works**

Run: `cd /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben && pnpm typecheck --filter @viben/core`
Expected: No errors

- [ ] **Step 3: Commit export**

```bash
git add packages/core/src/task/phase/index.ts
git commit -m "feat(task): export merge-pr phase from index"
```

---

## Chunk 2: Agent Configuration

### Task 4: Create merge-pr agent config

**Files:**
- Create: `.claude/agents/merge-pr.md`

- [ ] **Step 1: Create agent config file**

```markdown
---
name: merge-pr
description: |
  PR merge expert. Checks CI, resolves conflicts, and merges PRs.
  **IMPORTANT**: Always include `task_dir: <abs path>` as the FIRST LINE of prompt.
tools: Read, Write, Edit, Bash, Glob, Grep
model: sonnet
---
# Merge PR Agent

You are the Merge PR Agent in the Viben workflow.

## Task Directory

The task directory is provided in your prompt as `task_dir: <path>`.
Extract this path first, then read the required files from it.

## Startup: Read Context

1. Read `{task_dir}/task.json` to get:
   - `pr_url`: The PR to merge
   - `worktree_path`: Optional worktree location

## Workflow

### Step 1: Check PR Status

```bash
# Get PR state and mergeable status
gh pr view <pr_url> --json state,mergeable,mergeStateStatus,mergeCommit

# Check CI status
gh pr checks <pr_url>
```

### Step 2: Handle Different States

**If PR already merged:**
- Extract `mergeCommit` from PR data
- Update task.json and output `MERGE_SKIPPED`

**If PR is closed (not merged):**
- Output `MERGE_FAILED: PR is closed`
- Do not update task.json status

**If CI is failing:**
- Output `MERGE_FAILED: CI check '<name>' failed`
- Do not update task.json status

**If has conflicts (mergeable: false):**
- Try to resolve conflicts if possible
- If cannot resolve, output `MERGE_FAILED: Unresolved conflicts`

**If ready to merge:**
- Proceed to Step 3

### Step 3: Merge PR

```bash
gh pr merge <pr_url> --merge
```

### Step 4: Update Local

```bash
git fetch origin main
```

### Step 5: Get Merge Commit

```bash
gh pr view <pr_url> --json mergeCommit
```

### Step 6: Update task.json

Read current task.json, update these fields:
- `status`: "completed"
- `completedAt`: Current date (YYYY-MM-DD)
- `merged_at`: Current ISO timestamp
- `merge_commit`: The merge commit SHA

Write updated task.json back to file.

### Step 7: Output Completion Marker

Output one of:
- `MERGE_FINISH` - Merge successful
- `MERGE_SKIPPED` - PR was already merged
- `MERGE_FAILED: <reason>` - Merge failed

## Important Constraints

- Always check PR status before attempting merge
- Do NOT merge if CI is failing
- Update task.json AFTER successful merge, not before
- If any gh command fails, report the error and exit
```

- [ ] **Step 2: Verify file created**

Run: `head -30 .claude/agents/merge-pr.md`
Expected: Shows YAML frontmatter and start of agent instructions

- [ ] **Step 3: Commit agent config**

```bash
git add .claude/agents/merge-pr.md
git commit -m "feat(agent): add merge-pr agent configuration"
```

---

## Chunk 3: CLI Command Update

### Task 5: Update approve command to detect PR

**Files:**
- Modify: `packages/core/src/cli/commands/task.ts`

- [ ] **Step 1: Add import for runMergePRPhase**

Find the imports section in `task.ts` and add:

```typescript
import { runMergePRPhase } from "../../task/phase";
```

Also ensure `detectPlatform` is imported from cli-adapter if not already:

```typescript
import { detectPlatform } from "../lib/swarm/cli-adapter";
```

- [ ] **Step 2: Replace the approve command action**

Find the existing approve command (search for `.command("approve")`) and replace its `.action()` with:

```typescript
  // task approve - review -> completed (with auto PR merge detection)
  taskCmd
    .command("approve")
    .description("Approve task and mark as completed (auto-merges PR if exists)")
    .argument("<task>", "Task name or directory")
    .action(async (task: string) => {
      const ctx = getContext(program);
      const cwd = process.cwd();

      try {
        const repoRoot = ensureVibenDirWithRoot(cwd);
        const taskDir = resolveTaskDirectory(task, repoRoot);

        if (!taskDir) {
          throw CliError.taskNotFound(task);
        }

        const taskData = readTaskJsonFromWorkspace(taskDir);

        if (!taskData) {
          throw CliError.operationFailed("Read task", "Cannot read task.json");
        }

        // 检测是否需要合并 PR
        if (taskData.pr_url) {
          // 启动 merge-pr agent (异步)
          const mergeResult = await runMergePRPhase(repoRoot, taskDir, {
            platform: detectPlatform(repoRoot),
            verbose: true,
          });

          if (!mergeResult.success) {
            throw CliError.operationFailed("Start merge agent", mergeResult.error!);
          }

          const dirName = taskDir.split("/").pop() || task;

          // 输出 agent 信息 (任务状态保持 review，由 agent 更新)
          output(ctx, successResponse({
            task: dirName,
            action: "merge_started",
            agentId: mergeResult.agentId,
            pid: mergeResult.pid,
            logFile: mergeResult.logFile,
            pr_url: taskData.pr_url,
          }), () => {
            console.log(chalk.blue(`Merge agent started for: ${dirName}`));
            console.log(chalk.gray(`PR: ${taskData.pr_url}`));
            console.log(chalk.gray(`Agent: ${mergeResult.agentId}`));
            console.log(chalk.gray(`PID: ${mergeResult.pid}`));
            console.log(chalk.gray(`Log: ${mergeResult.logFile}`));
            console.log();
            console.log(chalk.yellow("Task status will be updated by agent upon completion."));
            console.log(`  tail -f ${mergeResult.logFile}    # Watch progress`);
          });
        } else {
          // 无 PR，简单状态转换（现有行为）
          const result = approveTask(repoRoot, task);

          if (!result.success) {
            throw CliError.operationFailed("Approve task", result.error!);
          }

          output(ctx, successResponse({ task: result.task, status: result.status }), () => {
            console.log(chalk.green(`Approved: ${result.task}`));
            console.log(chalk.gray(`Status: ${result.fromStatus} -> completed`));
            console.log();
            console.log(chalk.blue("Next steps:"));
            console.log(`  viben task archive ${result.task}    # Archive completed task`);
          });
        }
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });
```

- [ ] **Step 3: Verify compilation**

Run: `cd /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben && pnpm typecheck --filter @viben/core`
Expected: No type errors

- [ ] **Step 4: Test CLI help**

Run: `cd /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben && pnpm --filter @viben/core exec viben task approve --help`
Expected: Shows "auto-merges PR if exists" in description

- [ ] **Step 5: Commit CLI changes**

```bash
git add packages/core/src/cli/commands/task.ts
git commit -m "feat(cli): extend approve command with auto PR merge detection"
```

---

## Chunk 4: Verification

### Task 6: Full build verification

**Files:** None (verification only)

- [ ] **Step 1: Run full typecheck**

Run: `cd /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben && pnpm typecheck`
Expected: No errors across all packages

- [ ] **Step 2: Run core package build**

Run: `cd /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben && pnpm --filter @viben/core build`
Expected: Build succeeds

- [ ] **Step 3: Verify CLI works**

Run: `cd /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben && pnpm --filter @viben/core exec viben task --help`
Expected: Shows task subcommands including approve

- [ ] **Step 4: Create summary commit**

```bash
git log --oneline -5
```

Expected: Shows commits for merge-pr phase, agent config, and CLI update

---

## Summary

| Task | Files | Description |
|------|-------|-------------|
| 1 | `phase/merge-pr.ts` | Type definitions and imports |
| 2 | `phase/merge-pr.ts` | runMergePRPhase implementation |
| 3 | `phase/index.ts` | Export new phase |
| 4 | `.claude/agents/merge-pr.md` | Agent configuration |
| 5 | `cli/commands/task.ts` | Update approve command |
| 6 | (verification) | Full build test |

**Total estimated time:** 15-20 minutes

**Dependencies:**
- Tasks 1-2 must complete before Task 3
- Task 4 is independent
- Task 5 depends on Tasks 1-3
- Task 6 depends on all previous tasks

---

## Notes

### Test Coverage

The spec defines 5 test scenarios (see spec lines 417-452). Unit tests for the phase runner validation logic can be added as follow-up work. The current implementation focuses on the core functionality. Key test scenarios:

1. **No PR scenario**: task.json without pr_url → simple status transition
2. **PR normal merge**: PR exists, CI passes → agent merges
3. **CI failure**: Agent detects and reports failure
4. **Conflict scenario**: Agent handles or reports conflicts
5. **Already merged**: Agent detects and updates status

These tests would mock `spawn` and validate the phase runner's behavior. Integration testing requires actual PR environments.
