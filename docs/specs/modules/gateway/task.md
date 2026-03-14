# Gateway Task API

> 任务管理 API，提供 CLI `viben task` 命令的 HTTP 接口版本。

## 概述

Gateway Task API (`/api/task/*`) 提供了 `viben task` CLI 命令的完整 HTTP 接口。所有端点都复用 CLI 的核心实现，仅做输入输出格式转换。

**设计原则**:
1. **复用 CLI 核心函数** - Gateway 端点直接调用 `task/ops/*` 中的函数
2. **snake_case 参数** - 所有请求/响应参数使用 snake_case 格式
3. **workspace_path 必需** - 大部分端点需要 `workspace_path` 指定工作区
4. **POST 请求** - CLI 风格端点统一使用 POST 方法

## 端点分类

| 分类 | 端点 | CLI 对应命令 |
|------|------|-------------|
| [CRUD](#crud-端点) | `/api/task/list`, `/api/task/create`, `/api/task/view`, `/api/task/delete` | `viben task list/create/view/delete` |
| [生命周期](#生命周期端点) | `/api/task/pause`, `/api/task/resume`, `/api/task/approve`, `/api/task/reject`, `/api/task/retry`, `/api/task/cancel` | `viben task pause/resume/approve/reject/retry/cancel` |
| [队列管理](#队列管理端点) | `/api/task/enqueue`, `/api/task/dequeue`, `/api/task/queue-status`, `/api/task/batch-enqueue` | `viben task enqueue/dequeue` |
| [配置](#配置端点) | `/api/task/set-branch`, `/api/task/set-base`, `/api/task/set-agent` | `viben task set-branch/set-base/set-agent` |
| [上下文管理](#上下文管理端点) | `/api/task/init-context`, `/api/task/add-context`, `/api/task/remove-context`, `/api/task/list-context`, `/api/task/validate-context` | `viben task init-context/add-context/...` |
| [执行控制](#执行控制端点) | `/api/task/start`, `/api/task/execute`, `/api/task/stop`, `/api/task/running` | `viben task start` |
| [阶段命令](#阶段命令端点) | `/api/task/plan-phase`, `/api/task/implement-phase`, `/api/task/check-phase`, `/api/task/work-phase` | `viben task plan-phase/...` |
| [审查](#审查端点) | `/api/task/review`, `/api/task/context`, `/api/task/status`, `/api/task/create-pr` | `viben task review/context/status/create-pr` |
| [归档](#归档端点) | `/api/task/finish`, `/api/task/archive`, `/api/task/list-archive` | `viben task finish/archive/list-archive` |
| [Worktree](#worktree-端点) | `/api/task/create-worktree`, `/api/task/validate-check-phase-passed`, `/api/task/cleanup` | `viben task create-worktree/cleanup` |
| [事件/流](#事件流端点) | `/api/task/events`, `/api/task/specs`, `/api/task/events-stream`, `/api/task/execution-stream` | - |
| [会话](#会话端点) | `/api/task/add-session` | `viben task add-session` |

---

## CRUD 端点

### `POST /api/task/list`

列出任务。

**请求参数**:
```json
{
  "workspace_path": "/path/to/workspace",
  "status": "backlog",
  "mine": false
}
```

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `workspace_path` | string | 是 | 工作区路径 |
| `status` | string | 否 | 按状态过滤 |
| `mine` | boolean | 否 | 只显示当前开发者的任务 |

**响应**:
```json
{
  "success": true,
  "tasks": [
    {
      "name": "add-user-auth",
      "status": "backlog",
      "priority": "P2",
      "assignee": "john"
    }
  ]
}
```

**复用函数**: `listTasks()` from `task/ops/crud.ts`

---

### `POST /api/task/create`

创建新任务。

**请求参数**:
```json
{
  "workspace_path": "/path/to/workspace",
  "title": "Add user authentication",
  "slug": "add-user-auth",
  "assignee": "john",
  "priority": "P1",
  "agent": "coding-assistant",
  "executor": "CLAUDE_CODE",
  "model": "claude-sonnet-4-20250514",
  "branch": "feature/user-auth",
  "worktree": true,
  "start": false
}
```

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `workspace_path` | string | 是 | 工作区路径 |
| `title` | string | 是 | 任务标题 |
| `slug` | string | 否 | 任务标识符，默认从 title 生成 |
| `assignee` | string | 否 | 分配人 |
| `priority` | string | 否 | 优先级 (P0/P1/P2/P3) |
| `agent` | string | 否 | 关联的智能体 ID |
| `executor` | string | 否 | 执行器类型 |
| `model` | string | 否 | 模型 ID |
| `branch` | string | 否 | Git 分支名 |
| `worktree` | boolean | 否 | 是否使用 worktree |
| `start` | boolean | 否 | 创建后自动启动 |

**响应**:
```json
{
  "success": true,
  "task_dir": ".viben/tasks/03-15-add-user-auth",
  "task": { ... }
}
```

**复用函数**: `createTask()` from `task/ops/crud.ts`

---

### `POST /api/task/view`

查看任务详情。

**请求参数**:
```json
{
  "workspace_path": "/path/to/workspace",
  "task_id": "add-user-auth"
}
```

**响应**:
```json
{
  "success": true,
  "task": {
    "id": "add-user-auth",
    "title": "Add user authentication",
    "status": "backlog",
    ...
  }
}
```

**复用函数**: `viewTask()` from `task/ops/crud.ts`

---

### `POST /api/task/delete`

删除任务。

**请求参数**:
```json
{
  "workspace_path": "/path/to/workspace",
  "task_id": "add-user-auth",
  "force": false
}
```

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `workspace_path` | string | 是 | 工作区路径 |
| `task_id` | string | 是 | 任务标识符 |
| `force` | boolean | 否 | 强制删除 |

**复用函数**: `deleteTask()` from `task/ops/crud.ts`

---

## 生命周期端点

### `POST /api/task/pause`

暂停任务。

**请求参数**:
```json
{
  "workspace_path": "/path/to/workspace",
  "task_id": "add-user-auth"
}
```

**状态转换**: `queue` / `in_progress` → `paused`

**复用函数**: `pauseTask()` from `task/ops/lifecycle.ts`

---

### `POST /api/task/resume`

恢复暂停的任务。

**请求参数**:
```json
{
  "workspace_path": "/path/to/workspace",
  "task_id": "add-user-auth"
}
```

**状态转换**: `paused` → 原状态 (`queue` 或 `in_progress`)

**复用函数**: `resumeTask()` from `task/ops/lifecycle.ts`

---

### `POST /api/task/approve`

批准审查中的任务。

**请求参数**:
```json
{
  "workspace_path": "/path/to/workspace",
  "task_id": "add-user-auth"
}
```

**状态转换**: `review` → `completed`

**复用函数**: `approveTask()` from `task/ops/lifecycle.ts`

---

### `POST /api/task/reject`

拒绝任务，返回待办。

**请求参数**:
```json
{
  "workspace_path": "/path/to/workspace",
  "task_id": "add-user-auth",
  "reason": "需要更多测试覆盖"
}
```

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `workspace_path` | string | 是 | 工作区路径 |
| `task_id` | string | 是 | 任务标识符 |
| `reason` | string | 否 | 拒绝原因 |

**状态转换**: `review` → `backlog`

**复用函数**: `rejectTask()` from `task/ops/lifecycle.ts`

---

### `POST /api/task/retry`

重试失败的任务。

**请求参数**:
```json
{
  "workspace_path": "/path/to/workspace",
  "task_id": "add-user-auth"
}
```

**状态转换**: `failed` → `queue`

**复用函数**: `retryTask()` from `task/ops/lifecycle.ts`

---

### `POST /api/task/cancel`

取消任务。

**请求参数**:
```json
{
  "workspace_path": "/path/to/workspace",
  "task_id": "add-user-auth",
  "reason": "需求变更",
  "force": false
}
```

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `workspace_path` | string | 是 | 工作区路径 |
| `task_id` | string | 是 | 任务标识符 |
| `reason` | string | 否 | 取消原因 |
| `force` | boolean | 否 | 强制取消 `in_progress` 状态的任务 |

**状态转换**: `*` → `cancelled`

**复用函数**: `cancelTask()` from `task/ops/lifecycle.ts`

---

## 队列管理端点

### `POST /api/task/enqueue`

将任务加入队列。

**请求参数**:
```json
{
  "workspace_path": "/path/to/workspace",
  "task_id": "add-user-auth",
  "agent": "my-agent",
  "executor": "CLAUDE_CODE",
  "model": "claude-sonnet-4-20250514",
  "priority": "P1"
}
```

**状态转换**: `backlog` → `queue`

**复用函数**: `enqueueTask()` from `task/ops/lifecycle.ts`

---

### `POST /api/task/dequeue`

将任务移出队列。

**请求参数**:
```json
{
  "workspace_path": "/path/to/workspace",
  "task_id": "add-user-auth"
}
```

**状态转换**: `queue` → `backlog`

**复用函数**: `dequeueTask()` from `task/ops/lifecycle.ts`

---

### `POST /api/task/queue-status`

获取队列状态。

**请求参数**:
```json
{
  "workspace_path": "/path/to/workspace"
}
```

**响应**:
```json
{
  "success": true,
  "running": [],
  "pending": [],
  "active_count": 0,
  "pending_count": 0,
  "config": {
    "max_concurrent": 4
  }
}
```

---

### `POST /api/task/batch-enqueue`

批量入队多个任务。

**请求参数**:
```json
{
  "workspace_path": "/path/to/workspace",
  "task_ids": ["task-1", "task-2", "task-3"],
  "executor": "CLAUDE_CODE"
}
```

---

### `POST /api/task/queue-config`

获取或更新队列配置。

**请求参数**:
```json
{
  "workspace_path": "/path/to/workspace",
  "max_concurrent": 4
}
```

---

### `POST /api/task/clear-history`

清除执行历史。

**请求参数**:
```json
{
  "workspace_path": "/path/to/workspace"
}
```

---

## 配置端点

### `POST /api/task/set-branch`

设置任务的 Git 分支。

**请求参数**:
```json
{
  "workspace_path": "/path/to/workspace",
  "task_id": "add-user-auth",
  "branch": "feature/user-auth"
}
```

**复用函数**: `setTaskBranch()` from `task/ops/config.ts`

---

### `POST /api/task/set-base`

设置 PR 目标分支。

**请求参数**:
```json
{
  "workspace_path": "/path/to/workspace",
  "task_id": "add-user-auth",
  "branch": "develop"
}
```

**复用函数**: `setTaskBaseBranch()` from `task/ops/config.ts`

---

### `POST /api/task/set-agent`

设置关联的智能体配置。

**请求参数**:
```json
{
  "workspace_path": "/path/to/workspace",
  "task_id": "add-user-auth",
  "agent": "coding-assistant"
}
```

**复用函数**: `setTaskAgent()` from `task/ops/config.ts`

---

## 上下文管理端点

### `POST /api/task/init-context`

初始化空上下文文件。

**请求参数**:
```json
{
  "workspace_path": "/path/to/workspace",
  "task_id": "add-user-auth"
}
```

创建的文件:
- `implement.jsonl` - 实现阶段上下文
- `check.jsonl` - 检查阶段上下文
- `fix.jsonl` - 修复阶段上下文

**复用函数**: `initContext()` from `task/ops/context-files.ts`

---

### `POST /api/task/add-context`

添加上下文文件。

**请求参数**:
```json
{
  "workspace_path": "/path/to/workspace",
  "task_id": "add-user-auth",
  "files": ["src/auth/index.ts", "docs/api.md"],
  "reason": "API 参考文档",
  "recursive": false
}
```

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `workspace_path` | string | 是 | 工作区路径 |
| `task_id` | string | 是 | 任务标识符 |
| `files` | string[] | 是 | 文件路径列表 |
| `reason` | string | 否 | 添加原因 |
| `recursive` | boolean | 否 | 递归添加目录 |

**复用函数**: `addContext()` from `task/ops/context-files.ts`

---

### `POST /api/task/remove-context`

移除上下文文件。

**请求参数**:
```json
{
  "workspace_path": "/path/to/workspace",
  "task_id": "add-user-auth",
  "files": ["src/old-file.ts"]
}
```

**复用函数**: `removeContext()` from `task/ops/context-files.ts`

---

### `POST /api/task/list-context`

列出上下文条目。

**请求参数**:
```json
{
  "workspace_path": "/path/to/workspace",
  "task_id": "add-user-auth"
}
```

**响应**:
```json
{
  "success": true,
  "entries": [
    {
      "file": "src/auth/index.ts",
      "reason": "主认证模块"
    }
  ]
}
```

**复用函数**: `listContext()` from `task/ops/context-files.ts`

---

### `POST /api/task/validate-context`

验证上下文文件是否存在。

**请求参数**:
```json
{
  "workspace_path": "/path/to/workspace",
  "task_id": "add-user-auth"
}
```

**响应**:
```json
{
  "success": true,
  "valid": true,
  "missing": []
}
```

**复用函数**: `validateContext()` from `task/ops/context-files.ts`

---

## 执行控制端点

### `POST /api/task/start`

启动任务执行（标准入口）。

**请求参数**:
```json
{
  "workspace_path": "/path/to/workspace",
  "task_id": "add-user-auth",
  "executor": "CLAUDE_CODE",
  "detach": true,
  "worktree": false,
  "resume": false,
  "session_id": null
}
```

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `workspace_path` | string | 是 | 工作区路径 |
| `task_id` | string | 是 | 任务标识符 |
| `executor` | string | 否 | 执行器类型 |
| `detach` | boolean | 否 | 后台运行（默认 true） |
| `worktree` | boolean | 否 | 在 worktree 中运行 |
| `resume` | boolean | 否 | 恢复已有 session |
| `session_id` | string | 否 | 指定 session ID（配合 resume） |

**执行器类型**: `CLAUDE_CODE`, `CURSOR`, `GEMINI`, `OPENCODE`, `IFLOW`, `CODEX`, `KILO`, `KIRO`, `ANTIGRAVITY`

---

### `POST /api/task/execute`

通过队列系统执行任务。

**请求参数**:
```json
{
  "workspace_path": "/path/to/workspace",
  "task_id": "add-user-auth",
  "executor": "CLAUDE_CODE",
  "wait": false,
  "worktree": false
}
```

---

### `POST /api/task/stop`

停止任务执行。

**请求参数**:
```json
{
  "workspace_path": "/path/to/workspace",
  "task_id": "add-user-auth"
}
```

---

### `POST /api/task/running`

检查任务执行状态。

**请求参数**:
```json
{
  "workspace_path": "/path/to/workspace",
  "task_id": "add-user-auth"
}
```

**响应**:
```json
{
  "success": true,
  "running": true,
  "pid": 12345,
  "elapsed": "5m 32s"
}
```

---

## 阶段命令端点

### `POST /api/task/plan-phase`

运行 Plan 阶段。

**请求参数**:
```json
{
  "workspace_path": "/path/to/workspace",
  "task_id": "add-user-auth",
  "platform": "claude",
  "verbose": false
}
```

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `workspace_path` | string | 是 | 工作区路径 |
| `task_id` | string | 是 | 任务标识符 |
| `platform` | string | 否 | 平台 (claude/cursor/iflow/opencode) |
| `verbose` | boolean | 否 | 详细输出 |

**复用函数**: `runPlanPhase()` from `task/phase/plan.ts`

---

### `POST /api/task/implement-phase`

运行 Implement 阶段。

**请求参数**:
```json
{
  "workspace_path": "/path/to/workspace",
  "task_id": "add-user-auth",
  "platform": "claude",
  "verbose": false
}
```

**复用函数**: `runImplementPhase()` from `task/phase/implement.ts`

---

### `POST /api/task/check-phase`

运行 Check 阶段。

**请求参数**:
```json
{
  "workspace_path": "/path/to/workspace",
  "task_id": "add-user-auth",
  "platform": "claude",
  "verbose": false
}
```

**复用函数**: `runCheckPhase()` from `task/phase/check.ts`

---

### `POST /api/task/work-phase`

运行 Work 阶段（自动创建 worktree）。

**请求参数**:
```json
{
  "workspace_path": "/path/to/workspace",
  "task_id": "add-user-auth",
  "platform": "claude",
  "verbose": false,
  "detach": true
}
```

**复用函数**: `runWorkPhase()` from `task/phase/work.ts`

---

### `POST /api/task/plan`

运行 Plan 阶段（旧版，同 plan-phase）。

---

## 审查端点

### `POST /api/task/review`

获取任务审查信息。

**请求参数**:
```json
{
  "workspace_path": "/path/to/workspace",
  "task_id": "add-user-auth"
}
```

**响应**:
```json
{
  "success": true,
  "review": {
    "title": "Add user authentication",
    "status": "review",
    "priority": "P1",
    "pr_url": "https://github.com/org/repo/pull/123",
    "branch": "feature/user-auth",
    "files_changed": 12,
    "additions": 425,
    "deletions": 89
  }
}
```

**复用函数**: `reviewTask()` from `task/ops/review.ts`

---

### `POST /api/task/context`

获取任务上下文（用于 AI）。

**请求参数**:
```json
{
  "workspace_path": "/path/to/workspace",
  "task_id": "add-user-auth",
  "format": "json"
}
```

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `workspace_path` | string | 是 | 工作区路径 |
| `task_id` | string | 是 | 任务标识符 |
| `format` | string | 否 | 输出格式 (json/text)，默认 json |

**复用函数**: `getContextJson()`, `getContextText()` from `task/ops/context-output.ts`

---

### `POST /api/task/status`

获取任务状态详情。

**请求参数**:
```json
{
  "workspace_path": "/path/to/workspace",
  "task_id": "add-user-auth",
  "detail": false
}
```

**响应**:
```json
{
  "success": true,
  "status": "in_progress",
  "phase": "implement",
  "elapsed": "5m 32s",
  "running": true,
  "pid": 12345
}
```

---

### `POST /api/task/create-pr`

创建 Pull Request。

**请求参数**:
```json
{
  "workspace_path": "/path/to/workspace",
  "task_id": "add-user-auth",
  "dry_run": false
}
```

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `workspace_path` | string | 是 | 工作区路径 |
| `task_id` | string | 是 | 任务标识符 |
| `dry_run` | boolean | 否 | 预览模式，不实际执行 |

**响应**:
```json
{
  "success": true,
  "pr_url": "https://github.com/org/repo/pull/123"
}
```

**复用函数**: `createPR()` from `task/ops/create-pr.ts`

---

## 归档端点

### `POST /api/task/finish`

完成任务。

**请求参数**:
```json
{
  "workspace_path": "/path/to/workspace",
  "task_id": "add-user-auth"
}
```

**复用函数**: `finishTask()` from `task/ops/crud.ts`

---

### `POST /api/task/archive`

归档已完成的任务。

**请求参数**:
```json
{
  "workspace_path": "/path/to/workspace",
  "task_id": "add-user-auth"
}
```

归档到 `archive/YYYY-MM/` 目录。

**复用函数**: `archiveTask()` from `task/ops/crud.ts`

---

### `POST /api/task/list-archive`

列出归档任务。

**请求参数**:
```json
{
  "workspace_path": "/path/to/workspace",
  "month": "2026-03"
}
```

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `workspace_path` | string | 是 | 工作区路径 |
| `month` | string | 否 | 指定月份 (YYYY-MM)，不填列出所有 |

**复用函数**: `listArchivedTasks()` from `task/ops/crud.ts`

---

## Worktree 端点

### `POST /api/task/create-worktree`

为任务创建 Git worktree。

**请求参数**:
```json
{
  "workspace_path": "/path/to/workspace",
  "task_id": "add-user-auth",
  "skip_prd": false
}
```

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `workspace_path` | string | 是 | 工作区路径 |
| `task_id` | string | 是 | 任务标识符 |
| `skip_prd` | boolean | 否 | 跳过 prd.md 验证 |

**复用函数**: `runCreateWorktree()` from `task/phase/worktree.ts`

---

### `POST /api/task/validate-check-phase-passed`

验证 Check 阶段是否通过。

**请求参数**:
```json
{
  "workspace_path": "/path/to/workspace",
  "task_id": "add-user-auth",
  "output": "Agent output text...",
  "output_file": null
}
```

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `workspace_path` | string | 是 | 工作区路径 |
| `task_id` | string | 是 | 任务标识符 |
| `output` | string | 否 | Agent 输出文本 |
| `output_file` | string | 否 | 包含输出的文件路径 |

**复用函数**: `validateIfReviewFinished()` from `cli/lib/viben-workspace.ts`

---

### `POST /api/task/cleanup`

清理 worktree 和相关资源。

**请求参数**:
```json
{
  "workspace_path": "/path/to/workspace",
  "branch": "feature/user-auth",
  "keep_branch": false,
  "yes": false,
  "merged": false,
  "all": false,
  "list": false
}
```

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `workspace_path` | string | 是 | 工作区路径 |
| `branch` | string | 否 | 指定分支（与 merged/all/list 互斥） |
| `keep_branch` | boolean | 否 | 不删除 Git 分支 |
| `yes` | boolean | 否 | 跳过确认 |
| `merged` | boolean | 否 | 清理所有已合并的 worktree |
| `all` | boolean | 否 | 清理所有 worktree |
| `list` | boolean | 否 | 仅列出 worktree |

---

## 事件/流端点

### `POST /api/task/events`

获取任务事件历史。

**请求参数**:
```json
{
  "workspace_path": "/path/to/workspace",
  "task_id": "add-user-auth"
}
```

**响应**:
```json
{
  "success": true,
  "events": [
    {
      "type": "QUEUE",
      "timestamp": "2026-03-15T10:00:00Z",
      "data": {}
    }
  ]
}
```

---

### `POST /api/task/specs`

获取任务的 PRD/子任务/日志。

**请求参数**:
```json
{
  "workspace_path": "/path/to/workspace",
  "task_id": "add-user-auth"
}
```

**响应**:
```json
{
  "success": true,
  "prd": "# PRD Content...",
  "subtasks": [],
  "logs": []
}
```

---

### `GET /api/task/events-stream`

SSE 事件订阅。

**查询参数**:
- `workspace_path` - 工作区路径
- `task_id` - 任务标识符

**响应**: Server-Sent Events 流

```
data: {"type": "task", "task": {...}}

data: {"type": "event", "event": {...}}
```

---

### `GET /api/task/execution-stream`

SSE 执行进度流。

**查询参数**:
- `workspace_path` - 工作区路径
- `task_id` - 任务标识符

---

## 会话端点

### `POST /api/task/add-session`

添加会话记录到任务日志。

**请求参数**:
```json
{
  "workspace_path": "/path/to/workspace",
  "task_id": "add-user-auth",
  "title": "实现登录功能",
  "commit": "abc1234",
  "summary": "完成了基本的登录流程"
}
```

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `workspace_path` | string | 是 | 工作区路径 |
| `task_id` | string | 是 | 任务标识符 |
| `title` | string | 是 | 会话标题 |
| `commit` | string | 否 | 关联的 commit hash |
| `summary` | string | 否 | 会话摘要 |

**复用函数**: `getLatestJournalInfo()`, `generateSessionMarkdown()`, `createNewJournalFile()`, `updateIndexWithNewSession()` from `task/ops/session.ts`

---

## 状态转换表

| 端点 | 允许的起始状态 | 目标状态 |
|------|--------------|---------|
| `/api/task/enqueue` | backlog | queue |
| `/api/task/dequeue` | queue | backlog |
| `/api/task/pause` | queue, in_progress | paused |
| `/api/task/resume` | paused | queue 或 in_progress |
| `/api/task/approve` | review | completed |
| `/api/task/reject` | review | backlog |
| `/api/task/retry` | failed | queue |
| `/api/task/cancel` | backlog, queue, paused, in_progress*, review | cancelled |

> *`in_progress` 状态需要 `force: true` 参数

---

## 错误响应

所有端点在失败时返回统一的错误格式：

```json
{
  "success": false,
  "error": "错误描述"
}
```

常见错误：
- `Task not found: <task_id>` - 任务不存在
- `Cannot <action> task in '<status>' status. Expected: <expected>` - 状态转换非法
- `workspace_path is required` - 缺少必需参数

---

## 实现位置

| 文件 | 描述 |
|------|------|
| `packages/core/src/gateway/routes/task.ts` | Gateway 端点实现 |
| `packages/core/src/task/ops/lifecycle.ts` | 生命周期操作 |
| `packages/core/src/task/ops/config.ts` | 配置操作 |
| `packages/core/src/task/ops/context-files.ts` | 上下文文件操作 |
| `packages/core/src/task/ops/context-output.ts` | 上下文输出 |
| `packages/core/src/task/ops/crud.ts` | CRUD 操作 |
| `packages/core/src/task/ops/review.ts` | 审查操作 |
| `packages/core/src/task/ops/create-pr.ts` | PR 创建 |
| `packages/core/src/task/ops/session.ts` | 会话记录 |
| `packages/core/src/task/phase/*.ts` | 阶段执行函数 |

---

## 相关文档

- [CLI task 命令](../cli/task.md) - CLI 命令文档
- [任务系统状态机](../task-system.md) - 状态机规范
- [REST API tasks](./tasks.md) - REST 风格的 tasks API
