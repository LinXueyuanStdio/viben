# viben task approve 自动合并 PR 设计

> 扩展 `viben task approve` 命令，自动检测 PR 并通过 merge-pr agent 处理合并

## 背景

当前 `viben task approve` 仅做简单的状态转换（review → completed）。在 FileEvo 工作流中，approve 需要能够自动合并 PR。

## 设计目标

- 保持向后兼容：无 PR 时行为不变
- 自动检测：根据 `task.json` 中的 `pr_url` 自动决定是否启动 merge agent
- 智能处理：Agent 能处理 CI 失败、冲突等边缘情况

## 执行模式

**重要**: Phase runner 采用**异步模式** - 启动 agent 后立即返回，不等待合并完成。

- CLI 命令返回 agent 信息（pid, logFile）后退出
- Agent 在后台运行，负责：
  - 执行合并操作
  - 更新 task.json（merged_at, merge_commit, status）
- 任务状态在 agent 运行期间保持 `review`，合并成功后由 agent 更新为 `completed`

## 行为逻辑

```
viben task approve <task>
    │
    ├─→ 读取 task.json
    │
    ├─→ 检测: pr_url 存在?
    │   │
    │   ├── [有 PR] → 唤起 merge-pr agent (异步)
    │   │   ├── CLI 立即返回 agent 信息
    │   │   └── Agent 后台处理: CI检查、冲突解决、合并、更新状态
    │   │
    │   └── [无 PR] → 仅状态转换 (同步，当前行为)
    │       └── review → completed
    │
    └─→ 返回结果
```

## 核心判断

| 条件 | 行为 |
|------|------|
| `pr_url` 存在 | 唤起 merge-pr agent（异步处理合并） |
| `pr_url` 不存在 | 简单状态转换（同步，当前行为） |

## merge-pr Agent 职责

Agent 需要智能处理各种情况：

1. **正常路径**: CI 通过 → 无冲突 → 合并 → fetch main → 更新 task.json
2. **CI 失败**: 报告失败原因，不合并，任务保持 review 状态
3. **有冲突**: 尝试解决冲突或报告需要人工干预
4. **已合并**: 检测到 PR 已合并，直接更新 task.json 状态
5. **PR 已关闭**: 报告异常状态

## 数据流

```
viben task approve task-a
    │
    ├─1─→ 读取 task.json
    │     └── pr_url: "https://github.com/.../pull/123"
    │
    ├─2─→ 检测: pr_url 存在?
    │     │
    │     ├── [是] → Spawn merge-pr agent (detached, 异步)
    │     │         │
    │     │         ├─ CLI 立即返回:
    │     │         │  { agentId, pid, logFile }
    │     │         │
    │     │         └─ Agent 后台执行:
    │     │            ├── 工作目录: worktree_path || repoRoot
    │     │            ├── 检查 CI: gh pr checks
    │     │            ├── 检查冲突: gh pr view --json mergeable
    │     │            ├── 合并 PR: gh pr merge --merge
    │     │            ├── 获取最新: git fetch origin main
    │     │            ├── 获取 commit: gh pr view --json mergeCommit
    │     │            ├── 更新 task.json (由 Agent 负责)
    │     │            └── 输出: MERGE_FINISH
    │     │
    │     └── [否] → 简单状态转换 (同步)
    │               ├── 更新 task.json: status → completed
    │               └── 返回结果
    │
    └─3─→ 返回结果
```

## 实现组件

### 1. Phase Runner: `packages/core/src/task/phase/merge-pr.ts`

参考 `implement.ts` 模式，采用 detached 后台进程：

```typescript
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
 * Run the merge-pr phase for a task (async - returns immediately after spawning agent)
 */
export async function runMergePRPhase(
  repoRoot: string,
  taskDir: string,
  options?: MergePRPhaseOptions
): Promise<MergePRPhaseResult>
```

**验证条件**:
- task.json 存在
- task.json 包含 pr_url
- merge-pr agent 存在 (`.claude/agents/merge-pr.md`)

**环境变量**:
- `MERGE_TASK_NAME`: 任务名称
- `MERGE_TASK_DIR`: 任务目录（相对路径）
- `MERGE_PR_URL`: PR URL
- `MERGE_WORKTREE_PATH`: worktree 路径（如果存在）

**工作目录选择**:
- 如果 `task.worktree_path` 存在且目录有效 → 使用 worktree 作为 cwd
- 否则 → 使用 repoRoot 作为 cwd

**Prompt 格式**:
```
task_dir: {taskDirAbs}

Merge the PR for this task.

PR URL: {pr_url}

Check CI status, resolve conflicts if any, then merge.
Update task.json with merged_at, merge_commit, and status when done.
```

### 2. Agent Config: `.claude/agents/merge-pr.md`

```yaml
---
name: merge-pr
description: |
  PR merge expert. Checks CI, resolves conflicts, and merges PRs.
  **IMPORTANT**: Always include `task_dir: <abs path>` as the FIRST LINE of prompt.
tools: Read, Write, Edit, Bash, Glob, Grep
model: sonnet
---
```

**Agent 完整系统 Prompt**:

```markdown
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

### 3. CLI 命令修改: `packages/core/src/cli/commands/task.ts`

修改 `approve` 命令 action:

```typescript
.action(async (task: string) => {
  const ctx = getContext(program);
  const cwd = process.cwd();

  try {
    const repoRoot = ensureVibenDirWithRoot(cwd);
    const taskDir = resolveTaskDirectory(task, repoRoot);

    if (!taskDir) {
      throw CliError.taskNotFound(task);
    }

    const taskData = readTaskJson(taskDir);

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

### 4. Phase Index 导出: `packages/core/src/task/phase/index.ts`

```typescript
// 新增导出
export type { MergePRPhaseOptions, MergePRPhaseResult } from "./merge-pr";
export { runMergePRPhase } from "./merge-pr";
```

## 文件变更清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `packages/core/src/task/phase/merge-pr.ts` | 新建 | Phase runner (异步启动 agent) |
| `packages/core/src/task/phase/index.ts` | 修改 | 导出新 phase |
| `.claude/agents/merge-pr.md` | 新建 | Agent 配置和系统 prompt |
| `packages/core/src/cli/commands/task.ts` | 修改 | approve 命令逻辑 |

## task.json 字段扩展

合并成功后由 **Agent** 添加的字段：

```json
{
  "status": "completed",
  "completedAt": "2026-03-17",
  "merged_at": "2026-03-17T10:30:00Z",
  "merge_commit": "abc1234def5678"
}
```

## 状态转换

| 场景 | 状态流转 | 更新者 |
|------|----------|--------|
| 无 PR | review → completed | CLI (同步) |
| 有 PR，合并成功 | review → completed | Agent (异步) |
| 有 PR，合并失败 | review (保持) | Agent 不更新 |

**注意**: 不引入新的中间状态，任务在 agent 运行期间保持 `review` 状态。

## 边缘情况处理

| 情况 | Agent 行为 | task.json 更新 |
|------|------------|----------------|
| CI 失败 | 输出 `MERGE_FAILED: CI check 'X' failed` | 不更新状态 |
| 有冲突 | 尝试解决，失败则输出 `MERGE_FAILED: Unresolved conflicts` | 不更新状态 |
| PR 已合并 | 输出 `MERGE_SKIPPED`，获取现有 merge commit | 更新为 completed |
| PR 已关闭 | 输出 `MERGE_FAILED: PR is closed` | 不更新状态 |
| gh 命令失败 | 输出 `MERGE_FAILED: <error>` | 不更新状态 |
| Agent 崩溃 | 无输出 | 不更新状态，保持 review |

## 失败恢复

如果 agent 启动成功但中途失败（崩溃、网络错误等）：

1. 任务状态保持 `review`（因为 agent 未能更新）
2. 用户可以重新运行 `viben task approve <task>` 重试
3. 如果 PR 已被合并，agent 会检测到并正确处理

## 完成标记 (Output Markers)

Agent 必须在输出中包含以下标记之一：

| 标记 | 含义 | task.json 更新 |
|------|------|----------------|
| `MERGE_FINISH` | 合并成功 | status=completed, merged_at, merge_commit |
| `MERGE_SKIPPED` | PR 已合并 | status=completed, merged_at, merge_commit |
| `MERGE_FAILED: <reason>` | 合并失败 | 不更新 |

这些标记用于日志分析和监控，不用于 Ralph Loop 控制（因为是单次操作）。

## 测试计划

### 1. 无 PR 场景
- **输入**: task.json 无 pr_url 字段
- **预期**: 同步状态转换，status 变为 completed
- **验证**: task.json status = "completed", 无 merged_at 字段

### 2. 有 PR 正常场景
- **输入**: task.json 有 pr_url，PR 状态正常，CI 通过
- **预期**: Agent 启动，合并 PR，更新 task.json
- **验证**:
  - CLI 返回 agentId, pid, logFile
  - Agent 日志包含 `MERGE_FINISH`
  - task.json: status=completed, merged_at 存在, merge_commit 存在

### 3. CI 失败场景
- **输入**: task.json 有 pr_url，CI 失败
- **预期**: Agent 报告失败，不合并
- **验证**:
  - Agent 日志包含 `MERGE_FAILED: CI check`
  - task.json status 保持 review

### 4. 冲突场景
- **输入**: task.json 有 pr_url，PR 有冲突
- **预期**: Agent 报告冲突
- **验证**:
  - Agent 日志包含 `MERGE_FAILED: Unresolved conflicts`
  - task.json status 保持 review

### 5. 已合并场景
- **输入**: task.json 有 pr_url，PR 已被手动合并
- **预期**: Agent 检测到已合并，更新状态
- **验证**:
  - Agent 日志包含 `MERGE_SKIPPED`
  - task.json: status=completed, merge_commit 为现有提交
