---
sidebar_position: 12
title: "Task API"
description: "Task management API, HTTP interface for viben task CLI"
---

# 任务管理 API

> `/api/task` - 任务管理端点，提供 CLI `viben task` 命令的 HTTP 接口版本

## 概述

Gateway Task API (`/api/task/*`) 提供了 `viben task` CLI 命令的完整 HTTP 接口。所有端点都复用 CLI 的核心实现，仅做输入输出格式转换。

**设计原则**:

1. **复用 CLI 核心函数** - Gateway 端点直接调用 `task/ops/*` 中的函数
2. **snake_case 参数** - 所有请求/响应参数使用 snake_case 格式
3. **workspace_path 必需** - 大部分端点需要 `workspace_path` 指定工作区
4. **POST 请求** - CLI 风格端点统一使用 POST 方法

## 端点列表

| 分类 | 端点 | CLI 对应命令 |
|------|------|-------------|
| CRUD | `list`, `create`, `view`, `delete` | `viben task list/create/view/delete` |
| 生命周期 | `pause`, `resume`, `approve`, `reject`, `retry`, `cancel` | `viben task pause/resume/approve/reject/retry/cancel` |
| 队列管理 | `enqueue`, `dequeue`, `queue-status`, `batch-enqueue` | `viben task enqueue/dequeue` |
| 配置 | `set-branch`, `set-base`, `set-agent` | `viben task set-branch/set-base/set-agent` |
| 上下文管理 | `init-context`, `add-context`, `remove-context`, `list-context`, `validate-context` | `viben task init-context/add-context/...` |
| 执行控制 | `start`, `execute`, `stop`, `running` | `viben task start` |
| 阶段命令 | `plan-phase`, `implement-phase`, `check-phase`, `work-phase` | `viben task plan-phase/...` |
| 审查 | `review`, `context`, `status`, `create-pr` | `viben task review/context/status/create-pr` |
| 归档 | `finish`, `archive`, `list-archive` | `viben task finish/archive/list-archive` |
| Worktree | `create-worktree`, `validate-check-phase-passed`, `cleanup` | `viben task create-worktree/cleanup` |
| 事件/流 | `events`, `specs`, `events-stream`, `execution-stream` | - |
| 会话 | `add-session` | `viben task add-session` |

---

## CRUD 端点

### POST /api/task/list

列出任务。

**请求体**:

```json
{
  "workspace_path": "/path/to/workspace",
  "status": "backlog",
  "mine": false
}
```

**字段说明**:

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| workspace_path | string | Yes | 工作区路径 |
| status | string | No | 按状态过滤 |
| mine | boolean | No | 只显示当前开发者的任务 |

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

---

### POST /api/task/create

创建新任务。

**请求体**:

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

**字段说明**:

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| workspace_path | string | Yes | 工作区路径 |
| title | string | Yes | 任务标题 |
| slug | string | No | 任务标识符，默认从 title 生成 |
| assignee | string | No | 分配人 |
| priority | string | No | 优先级 (P0/P1/P2/P3) |
| agent | string | No | 关联的智能体 ID |
| executor | string | No | 执行器类型 |
| model | string | No | 模型 ID |
| branch | string | No | Git 分支名 |
| worktree | boolean | No | 是否使用 worktree |
| start | boolean | No | 创建后自动启动 |

**响应**:

```json
{
  "success": true,
  "task_dir": ".viben/tasks/03-15-add-user-auth",
  "task": { ... }
}
```

---

### POST /api/task/view

查看任务详情。

**请求体**:

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

---

### POST /api/task/delete

删除任务。

**请求体**:

```json
{
  "workspace_path": "/path/to/workspace",
  "task_id": "add-user-auth",
  "force": false
}
```

---

## 生命周期端点

### POST /api/task/pause

暂停任务。

**请求体**:

```json
{
  "workspace_path": "/path/to/workspace",
  "task_id": "add-user-auth"
}
```

**状态转换**: `queue` / `in_progress` -> `paused`

---

### POST /api/task/resume

恢复暂停的任务。

**请求体**:

```json
{
  "workspace_path": "/path/to/workspace",
  "task_id": "add-user-auth"
}
```

**状态转换**: `paused` -> 原状态 (`queue` 或 `in_progress`)

---

### POST /api/task/approve

批准审查中的任务。

**请求体**:

```json
{
  "workspace_path": "/path/to/workspace",
  "task_id": "add-user-auth"
}
```

**状态转换**: `review` -> `completed`

---

### POST /api/task/reject

拒绝任务，返回待办。

**请求体**:

```json
{
  "workspace_path": "/path/to/workspace",
  "task_id": "add-user-auth",
  "reason": "需要更多测试覆盖"
}
```

**状态转换**: `review` -> `backlog`

---

### POST /api/task/retry

重试失败的任务。

**请求体**:

```json
{
  "workspace_path": "/path/to/workspace",
  "task_id": "add-user-auth"
}
```

**状态转换**: `failed` -> `queue`

---

### POST /api/task/cancel

取消任务。

**请求体**:

```json
{
  "workspace_path": "/path/to/workspace",
  "task_id": "add-user-auth",
  "reason": "需求变更",
  "force": false
}
```

**字段说明**:

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| workspace_path | string | Yes | 工作区路径 |
| task_id | string | Yes | 任务标识符 |
| reason | string | No | 取消原因 |
| force | boolean | No | 强制取消 `in_progress` 状态的任务 |

**状态转换**: `*` -> `cancelled`

---

## 队列管理端点

### POST /api/task/enqueue

将任务加入队列。

**请求体**:

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

**状态转换**: `backlog` -> `queue`

---

### POST /api/task/dequeue

将任务移出队列。

**请求体**:

```json
{
  "workspace_path": "/path/to/workspace",
  "task_id": "add-user-auth"
}
```

**状态转换**: `queue` -> `backlog`

---

### POST /api/task/queue-status

获取队列状态。

**请求体**:

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

### POST /api/task/batch-enqueue

批量入队多个任务。

**请求体**:

```json
{
  "workspace_path": "/path/to/workspace",
  "task_ids": ["task-1", "task-2", "task-3"],
  "executor": "CLAUDE_CODE"
}
```

---

## 配置端点

### POST /api/task/set-branch

设置任务的 Git 分支。

**请求体**:

```json
{
  "workspace_path": "/path/to/workspace",
  "task_id": "add-user-auth",
  "branch": "feature/user-auth"
}
```

---

### POST /api/task/set-base

设置 PR 目标分支。

**请求体**:

```json
{
  "workspace_path": "/path/to/workspace",
  "task_id": "add-user-auth",
  "branch": "develop"
}
```

---

### POST /api/task/set-agent

设置关联的智能体配置。

**请求体**:

```json
{
  "workspace_path": "/path/to/workspace",
  "task_id": "add-user-auth",
  "agent": "coding-assistant"
}
```

---

## 上下文管理端点

### POST /api/task/init-context

初始化空上下文文件。

**请求体**:

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

---

### POST /api/task/add-context

添加上下文文件。

**请求体**:

```json
{
  "workspace_path": "/path/to/workspace",
  "task_id": "add-user-auth",
  "files": ["src/auth/index.ts", "docs/api.md"],
  "reason": "API 参考文档",
  "recursive": false
}
```

**字段说明**:

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| workspace_path | string | Yes | 工作区路径 |
| task_id | string | Yes | 任务标识符 |
| files | string[] | Yes | 文件路径列表 |
| reason | string | No | 添加原因 |
| recursive | boolean | No | 递归添加目录 |

---

### POST /api/task/remove-context

移除上下文文件。

**请求体**:

```json
{
  "workspace_path": "/path/to/workspace",
  "task_id": "add-user-auth",
  "files": ["src/old-file.ts"]
}
```

---

### POST /api/task/list-context

列出上下文条目。

**请求体**:

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

---

### POST /api/task/validate-context

验证上下文文件是否存在。

**请求体**:

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

---

## 执行控制端点

### POST /api/task/start

启动任务执行（标准入口）。

**请求体**:

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

**字段说明**:

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| workspace_path | string | Yes | 工作区路径 |
| task_id | string | Yes | 任务标识符 |
| executor | string | No | 执行器类型 |
| detach | boolean | No | 后台运行（默认 true） |
| worktree | boolean | No | 在 worktree 中运行 |
| resume | boolean | No | 恢复已有 session |
| session_id | string | No | 指定 session ID（配合 resume） |

**执行器类型**: `CLAUDE_CODE`, `CURSOR`, `GEMINI`, `OPENCODE`, `IFLOW`, `CODEX`, `KILO`, `KIRO`, `ANTIGRAVITY`

---

### POST /api/task/execute

通过队列系统执行任务。

**请求体**:

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

### POST /api/task/stop

停止任务执行。

**请求体**:

```json
{
  "workspace_path": "/path/to/workspace",
  "task_id": "add-user-auth"
}
```

---

### POST /api/task/running

检查任务执行状态。

**请求体**:

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

### POST /api/task/plan-phase

运行 Plan 阶段。

**请求体**:

```json
{
  "workspace_path": "/path/to/workspace",
  "task_id": "add-user-auth",
  "platform": "claude",
  "verbose": false
}
```

**字段说明**:

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| workspace_path | string | Yes | 工作区路径 |
| task_id | string | Yes | 任务标识符 |
| platform | string | No | 平台 (claude/cursor/iflow/opencode) |
| verbose | boolean | No | 详细输出 |

---

### POST /api/task/implement-phase

运行 Implement 阶段。

**请求体**:

```json
{
  "workspace_path": "/path/to/workspace",
  "task_id": "add-user-auth",
  "platform": "claude",
  "verbose": false
}
```

---

### POST /api/task/check-phase

运行 Check 阶段。

**请求体**:

```json
{
  "workspace_path": "/path/to/workspace",
  "task_id": "add-user-auth",
  "platform": "claude",
  "verbose": false
}
```

---

### POST /api/task/work-phase

运行 Work 阶段（自动创建 worktree）。

**请求体**:

```json
{
  "workspace_path": "/path/to/workspace",
  "task_id": "add-user-auth",
  "platform": "claude",
  "verbose": false,
  "detach": true
}
```

---

## 审查端点

### POST /api/task/review

获取任务审查信息。

**请求体**:

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

---

### POST /api/task/context

获取任务上下文（用于 AI）。

**请求体**:

```json
{
  "workspace_path": "/path/to/workspace",
  "task_id": "add-user-auth",
  "format": "json"
}
```

**字段说明**:

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| workspace_path | string | Yes | 工作区路径 |
| task_id | string | Yes | 任务标识符 |
| format | string | No | 输出格式 (json/text)，默认 json |

---

### POST /api/task/status

获取任务状态详情。

**请求体**:

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

### POST /api/task/create-pr

创建 Pull Request。

**请求体**:

```json
{
  "workspace_path": "/path/to/workspace",
  "task_id": "add-user-auth",
  "dry_run": false
}
```

**响应**:

```json
{
  "success": true,
  "pr_url": "https://github.com/org/repo/pull/123"
}
```

---

## 归档端点

### POST /api/task/finish

完成任务。

**请求体**:

```json
{
  "workspace_path": "/path/to/workspace",
  "task_id": "add-user-auth"
}
```

---

### POST /api/task/archive

归档已完成的任务。

**请求体**:

```json
{
  "workspace_path": "/path/to/workspace",
  "task_id": "add-user-auth"
}
```

归档到 `archive/YYYY-MM/` 目录。

---

### POST /api/task/list-archive

列出归档任务。

**请求体**:

```json
{
  "workspace_path": "/path/to/workspace",
  "month": "2026-03"
}
```

**字段说明**:

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| workspace_path | string | Yes | 工作区路径 |
| month | string | No | 指定月份 (YYYY-MM)，不填列出所有 |

---

## Worktree 端点

### POST /api/task/create-worktree

为任务创建 Git worktree。

**请求体**:

```json
{
  "workspace_path": "/path/to/workspace",
  "task_id": "add-user-auth",
  "skip_prd": false
}
```

---

### POST /api/task/validate-check-phase-passed

验证 Check 阶段是否通过。

**请求体**:

```json
{
  "workspace_path": "/path/to/workspace",
  "task_id": "add-user-auth",
  "output": "Agent output text...",
  "output_file": null
}
```

---

### POST /api/task/cleanup

清理 worktree 和相关资源。

**请求体**:

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

**字段说明**:

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| workspace_path | string | Yes | 工作区路径 |
| branch | string | No | 指定分支（与 merged/all/list 互斥） |
| keep_branch | boolean | No | 不删除 Git 分支 |
| yes | boolean | No | 跳过确认 |
| merged | boolean | No | 清理所有已合并的 worktree |
| all | boolean | No | 清理所有 worktree |
| list | boolean | No | 仅列出 worktree |

---

## 事件/流端点

### POST /api/task/events

获取任务事件历史。

**请求体**:

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

### POST /api/task/specs

获取任务的 PRD/子任务/日志。

**请求体**:

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

### GET /api/task/events-stream

SSE 事件订阅。

**查询参数**:

| 参数 | 类型 | 说明 |
|------|------|------|
| workspace_path | string | 工作区路径 |
| task_id | string | 任务标识符 |

**响应格式**: `text/event-stream`

```
data: {"type": "task", "task": {...}}

data: {"type": "event", "event": {...}}
```

---

### GET /api/task/execution-stream

SSE 执行进度流。

**查询参数**:

| 参数 | 类型 | 说明 |
|------|------|------|
| workspace_path | string | 工作区路径 |
| task_id | string | 任务标识符 |

---

## 会话端点

### POST /api/task/add-session

添加会话记录到任务日志。

**请求体**:

```json
{
  "workspace_path": "/path/to/workspace",
  "task_id": "add-user-auth",
  "title": "实现登录功能",
  "commit": "abc1234",
  "summary": "完成了基本的登录流程"
}
```

**字段说明**:

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| workspace_path | string | Yes | 工作区路径 |
| task_id | string | Yes | 任务标识符 |
| title | string | Yes | 会话标题 |
| commit | string | No | 关联的 commit hash |
| summary | string | No | 会话摘要 |

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

## 错误码

| HTTP 状态码 | 错误类型 | 说明 |
|-------------|----------|------|
| 400 | ValidationError | 请求参数无效 |
| 404 | NotFoundError | 任务不存在 |
| 409 | StateError | 状态转换非法 |
| 500 | InternalError | 服务器内部错误 |

---

## 相关端点

- [任务队列 API](./queue.md) - 全局任务队列管理
- [智能体 API](./agents.md) - 智能体管理
