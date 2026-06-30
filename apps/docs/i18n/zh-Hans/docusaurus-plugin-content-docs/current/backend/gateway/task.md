---
sidebar_position: 12
title: "Task API"
description: "Task management API, HTTP interface for viben task CLI"
---

# Task Management API

> `/api/task` - Task management endpoints, providing HTTP interface version of CLI `viben task` commands

## Overview

The Gateway Task API (`/api/task/*`) provides a complete HTTP interface for the `viben task` CLI commands. All endpoints reuse the CLI's core implementation, only converting input/output formats.

**Design Principles**:

1. **Reuse CLI core functions** - Gateway endpoints directly call functions in `task/ops/*`
2. **snake_case parameters** - All request/response parameters use snake_case format
3. **workspace_path required** - Most endpoints require `workspace_path` to specify workspace
4. **POST requests** - CLI-style endpoints uniformly use POST method

## Endpoint List

| Category | Endpoints | CLI Corresponding Commands |
|----------|-----------|---------------------------|
| CRUD | `list`, `create`, `view`, `delete` | `viben task list/create/view/delete` |
| Lifecycle | `pause`, `resume`, `approve`, `reject`, `retry`, `cancel` | `viben task pause/resume/approve/reject/retry/cancel` |
| Queue Management | `enqueue`, `dequeue`, `queue-status`, `batch-enqueue`, `queue-config`, `clear-history` | `viben task enqueue/dequeue` |
| Configuration | `set-branch`, `set-base`, `set-agent` | `viben task set-branch/set-base/set-agent` |
| Context Management | `init-context`, `add-context`, `remove-context`, `list-context`, `validate-context` | `viben task init-context/add-context/...` |
| Execution Control | `start`, `execute`, `stop`, `running` | `viben task start` |
| Phase Commands | `plan-phase`, `implement-phase`, `check-phase`, `work-phase`, `plan` (legacy) | `viben task plan-phase/...` |
| Review | `review`, `context`, `status`, `create-pr` | `viben task review/context/status/create-pr` |
| Archive | `finish`, `archive`, `list-archive` | `viben task finish/archive/list-archive` |
| Worktree | `create-worktree`, `validate-check-phase-passed`, `cleanup` | `viben task create-worktree/cleanup` |
| Events/Streaming | `events`, `specs`, `events-stream`, `execution-stream` | - |
| Session | `add-session` | `viben task add-session` |

---

## CRUD Endpoints

### POST /api/task/list

List tasks.

**Request Body**:

```json
{
  "workspace_path": "/path/to/workspace",
  "status": "backlog",
  "mine": false
}
```

**Field Description**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| workspace_path | string | Yes | Workspace path |
| status | string | No | Filter by status |
| mine | boolean | No | Only show current developer's tasks |

**Response**:

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

Create a new task.

**Request Body**:

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

**Field Description**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| workspace_path | string | Yes | Workspace path |
| title | string | Yes | Task title |
| slug | string | No | Task identifier, defaults to generated from title |
| assignee | string | No | Assignee |
| priority | string | No | Priority (P0/P1/P2/P3) |
| agent | string | No | Associated agent ID |
| executor | string | No | Executor type |
| model | string | No | Model ID |
| branch | string | No | Git branch name |
| worktree | boolean | No | Whether to use worktree |
| start | boolean | No | Auto-start after creation |

**Response**:

```json
{
  "success": true,
  "task_dir": ".viben/tasks/03-15-add-user-auth",
  "task": { ... }
}
```

---

### POST /api/task/view

View task details.

**Request Body**:

```json
{
  "workspace_path": "/path/to/workspace",
  "task_id": "add-user-auth"
}
```

**Response**:

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

Delete a task.

**Request Body**:

```json
{
  "workspace_path": "/path/to/workspace",
  "task_id": "add-user-auth",
  "force": false
}
```

---

## Lifecycle Endpoints

### POST /api/task/pause

Pause a task.

**Request Body**:

```json
{
  "workspace_path": "/path/to/workspace",
  "task_id": "add-user-auth"
}
```

**State Transition**: `queue` / `in_progress` -> `paused`

---

### POST /api/task/resume

Resume a paused task.

**Request Body**:

```json
{
  "workspace_path": "/path/to/workspace",
  "task_id": "add-user-auth"
}
```

**State Transition**: `paused` -> original state (`queue` or `in_progress`)

---

### POST /api/task/approve

Approve a task under review.

**Request Body**:

```json
{
  "workspace_path": "/path/to/workspace",
  "task_id": "add-user-auth"
}
```

**State Transition**: `review` -> `completed`

---

### POST /api/task/reject

Reject task, return to backlog.

**Request Body**:

```json
{
  "workspace_path": "/path/to/workspace",
  "task_id": "add-user-auth",
  "reason": "Needs more test coverage"
}
```

**State Transition**: `review` -> `backlog`

---

### POST /api/task/retry

Retry a failed task.

**Request Body**:

```json
{
  "workspace_path": "/path/to/workspace",
  "task_id": "add-user-auth"
}
```

**State Transition**: `failed` -> `queue`

---

### POST /api/task/cancel

Cancel a task.

**Request Body**:

```json
{
  "workspace_path": "/path/to/workspace",
  "task_id": "add-user-auth",
  "reason": "Requirements changed",
  "force": false
}
```

**Field Description**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| workspace_path | string | Yes | Workspace path |
| task_id | string | Yes | Task identifier |
| reason | string | No | Cancellation reason |
| force | boolean | No | Force cancel task in `in_progress` state |

**State Transition**: `*` -> `cancelled`

---

## Queue Management Endpoints

### POST /api/task/enqueue

Add task to queue.

**Request Body**:

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

**State Transition**: `backlog` -> `queue`

---

### POST /api/task/dequeue

Remove task from queue.

**Request Body**:

```json
{
  "workspace_path": "/path/to/workspace",
  "task_id": "add-user-auth"
}
```

**State Transition**: `queue` -> `backlog`

---

### POST /api/task/queue-status

Get queue status.

**Request Body**:

```json
{
  "workspace_path": "/path/to/workspace"
}
```

**Response**:

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

Batch enqueue multiple tasks.

**Request Body**:

```json
{
  "workspace_path": "/path/to/workspace",
  "task_ids": ["task-1", "task-2", "task-3"],
  "executor": "CLAUDE_CODE"
}
```

---

### POST /api/task/queue-config

Get or update queue configuration.

**Request Body**:

```json
{
  "workspace_path": "/path/to/workspace",
  "max_concurrent": 4
}
```

**Field Description**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| workspace_path | string | Yes | Workspace path |
| max_concurrent | number | No | Maximum concurrent tasks (omit to read current config) |

---

### POST /api/task/clear-history

Clear execution history.

**Request Body**:

```json
{
  "workspace_path": "/path/to/workspace"
}
```

---

## Configuration Endpoints

### POST /api/task/set-branch

Set task's Git branch.

**Request Body**:

```json
{
  "workspace_path": "/path/to/workspace",
  "task_id": "add-user-auth",
  "branch": "feature/user-auth"
}
```

---

### POST /api/task/set-base

Set PR target branch.

**Request Body**:

```json
{
  "workspace_path": "/path/to/workspace",
  "task_id": "add-user-auth",
  "branch": "develop"
}
```

---

### POST /api/task/set-agent

Set associated agent configuration.

**Request Body**:

```json
{
  "workspace_path": "/path/to/workspace",
  "task_id": "add-user-auth",
  "agent": "coding-assistant"
}
```

---

## Context Management Endpoints

### POST /api/task/init-context

Initialize empty context files.

**Request Body**:

```json
{
  "workspace_path": "/path/to/workspace",
  "task_id": "add-user-auth"
}
```

Created files:
- `implement.jsonl` - Implementation phase context
- `check.jsonl` - Check phase context
- `fix.jsonl` - Fix phase context

---

### POST /api/task/add-context

Add context files.

**Request Body**:

```json
{
  "workspace_path": "/path/to/workspace",
  "task_id": "add-user-auth",
  "files": ["src/auth/index.ts", "docs/api.md"],
  "reason": "API reference documentation",
  "recursive": false
}
```

**Field Description**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| workspace_path | string | Yes | Workspace path |
| task_id | string | Yes | Task identifier |
| files | string[] | Yes | File path list |
| reason | string | No | Reason for adding |
| recursive | boolean | No | Recursively add directory |

---

### POST /api/task/remove-context

Remove context files.

**Request Body**:

```json
{
  "workspace_path": "/path/to/workspace",
  "task_id": "add-user-auth",
  "files": ["src/old-file.ts"]
}
```

---

### POST /api/task/list-context

List context entries.

**Request Body**:

```json
{
  "workspace_path": "/path/to/workspace",
  "task_id": "add-user-auth"
}
```

**Response**:

```json
{
  "success": true,
  "entries": [
    {
      "file": "src/auth/index.ts",
      "reason": "Main authentication module"
    }
  ]
}
```

---

### POST /api/task/validate-context

Validate that context files exist.

**Request Body**:

```json
{
  "workspace_path": "/path/to/workspace",
  "task_id": "add-user-auth"
}
```

**Response**:

```json
{
  "success": true,
  "valid": true,
  "missing": []
}
```

---

## Execution Control Endpoints

### POST /api/task/start

Start task execution (standard entry point).

**Request Body**:

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

**Field Description**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| workspace_path | string | Yes | Workspace path |
| task_id | string | Yes | Task identifier |
| executor | string | No | Executor type |
| detach | boolean | No | Run in background (default true) |
| worktree | boolean | No | Run in worktree |
| resume | boolean | No | Resume existing session |
| session_id | string | No | Specify session ID (used with resume) |

**Executor Types**: `CLAUDE_CODE`, `CURSOR`, `GEMINI`, `OPENCODE`, `IFLOW`, `CODEX`, `KILO`, `KIRO`, `ANTIGRAVITY`

---

### POST /api/task/execute

Execute task through queue system.

**Request Body**:

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

Stop task execution.

**Request Body**:

```json
{
  "workspace_path": "/path/to/workspace",
  "task_id": "add-user-auth"
}
```

---

### POST /api/task/running

Check task execution status.

**Request Body**:

```json
{
  "workspace_path": "/path/to/workspace",
  "task_id": "add-user-auth"
}
```

**Response**:

```json
{
  "success": true,
  "running": true,
  "pid": 12345,
  "elapsed": "5m 32s"
}
```

---

## Phase Command Endpoints

### POST /api/task/plan-phase

Run Plan phase.

**Request Body**:

```json
{
  "workspace_path": "/path/to/workspace",
  "task_id": "add-user-auth",
  "platform": "claude",
  "verbose": false
}
```

**Field Description**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| workspace_path | string | Yes | Workspace path |
| task_id | string | Yes | Task identifier |
| platform | string | No | Platform (claude/cursor/iflow/opencode) |
| verbose | boolean | No | Verbose output |

---

### POST /api/task/implement-phase

Run Implement phase.

**Request Body**:

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

Run Check phase.

**Request Body**:

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

Run Work phase (auto-creates worktree).

**Request Body**:

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

### POST /api/task/plan

Run Plan phase (legacy endpoint, same as `plan-phase`).

**Request Body**:

```json
{
  "workspace_path": "/path/to/workspace",
  "task_id": "add-user-auth",
  "platform": "claude",
  "verbose": false
}
```

:::note
This is a legacy endpoint maintained for backward compatibility. Prefer using `POST /api/task/plan-phase` instead.
:::

---

## Review Endpoints

### POST /api/task/review

Get task review information.

**Request Body**:

```json
{
  "workspace_path": "/path/to/workspace",
  "task_id": "add-user-auth"
}
```

**Response**:

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

Get task context (for AI).

**Request Body**:

```json
{
  "workspace_path": "/path/to/workspace",
  "task_id": "add-user-auth",
  "format": "json"
}
```

**Field Description**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| workspace_path | string | Yes | Workspace path |
| task_id | string | Yes | Task identifier |
| format | string | No | Output format (json/text), default json |

---

### POST /api/task/status

Get task status details.

**Request Body**:

```json
{
  "workspace_path": "/path/to/workspace",
  "task_id": "add-user-auth",
  "detail": false
}
```

**Response**:

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

Create Pull Request.

**Request Body**:

```json
{
  "workspace_path": "/path/to/workspace",
  "task_id": "add-user-auth",
  "dry_run": false
}
```

**Response**:

```json
{
  "success": true,
  "pr_url": "https://github.com/org/repo/pull/123"
}
```

---

## Archive Endpoints

### POST /api/task/finish

Complete a task.

**Request Body**:

```json
{
  "workspace_path": "/path/to/workspace",
  "task_id": "add-user-auth"
}
```

---

### POST /api/task/archive

Archive a completed task.

**Request Body**:

```json
{
  "workspace_path": "/path/to/workspace",
  "task_id": "add-user-auth"
}
```

Archives to `archive/YYYY-MM/` directory.

---

### POST /api/task/list-archive

List archived tasks.

**Request Body**:

```json
{
  "workspace_path": "/path/to/workspace",
  "month": "2026-03"
}
```

**Field Description**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| workspace_path | string | Yes | Workspace path |
| month | string | No | Specify month (YYYY-MM), list all if not provided |

---

## Worktree Endpoints

### POST /api/task/create-worktree

Create Git worktree for a task.

**Request Body**:

```json
{
  "workspace_path": "/path/to/workspace",
  "task_id": "add-user-auth",
  "skip_prd": false
}
```

---

### POST /api/task/validate-check-phase-passed

Validate if Check phase passed.

**Request Body**:

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

Clean up worktree and related resources.

**Request Body**:

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

**Field Description**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| workspace_path | string | Yes | Workspace path |
| branch | string | No | Specify branch (mutually exclusive with merged/all/list) |
| keep_branch | boolean | No | Don't delete Git branch |
| yes | boolean | No | Skip confirmation |
| merged | boolean | No | Clean all merged worktrees |
| all | boolean | No | Clean all worktrees |
| list | boolean | No | Only list worktrees |

---

## Event/Streaming Endpoints

### POST /api/task/events

Get task event history.

**Request Body**:

```json
{
  "workspace_path": "/path/to/workspace",
  "task_id": "add-user-auth"
}
```

**Response**:

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

Get task PRD/subtasks/logs.

**Request Body**:

```json
{
  "workspace_path": "/path/to/workspace",
  "task_id": "add-user-auth"
}
```

**Response**:

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

SSE event subscription.

**Query Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| workspace_path | string | Workspace path |
| task_id | string | Task identifier |

**Response Format**: `text/event-stream`

```
data: {"type": "task", "task": {...}}

data: {"type": "event", "event": {...}}
```

---

### GET /api/task/execution-stream

SSE execution progress stream.

**Query Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| workspace_path | string | Workspace path |
| task_id | string | Task identifier |

---

## Session Endpoints

### POST /api/task/add-session

Add session record to task log.

**Request Body**:

```json
{
  "workspace_path": "/path/to/workspace",
  "task_id": "add-user-auth",
  "title": "Implement login feature",
  "commit": "abc1234",
  "summary": "Completed basic login flow"
}
```

**Field Description**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| workspace_path | string | Yes | Workspace path |
| task_id | string | Yes | Task identifier |
| title | string | Yes | Session title |
| commit | string | No | Associated commit hash |
| summary | string | No | Session summary |

---

## State Transition Table

| Endpoint | Allowed Starting States | Target State |
|----------|------------------------|--------------|
| `/api/task/enqueue` | backlog | queue |
| `/api/task/dequeue` | queue | backlog |
| `/api/task/pause` | queue, in_progress | paused |
| `/api/task/resume` | paused | queue or in_progress |
| `/api/task/approve` | review | completed |
| `/api/task/reject` | review | backlog |
| `/api/task/retry` | failed | queue |
| `/api/task/cancel` | backlog, queue, paused, in_progress*, review | cancelled |

> *`in_progress` state requires `force: true` parameter

---

## Error Codes

| HTTP Status | Error Type | Description |
|-------------|------------|-------------|
| 400 | ValidationError | Invalid request parameters |
| 404 | NotFoundError | Task not found |
| 409 | StateError | Illegal state transition |
| 500 | InternalError | Internal server error |

---

## Implementation File Locations

| File | Description |
|------|-------------|
| `packages/core/src/gateway/routes/task.ts` | Gateway endpoint implementation |
| `packages/core/src/task/ops/lifecycle.ts` | Lifecycle operations |
| `packages/core/src/task/ops/config.ts` | Configuration operations |
| `packages/core/src/task/ops/context-files.ts` | Context file operations |
| `packages/core/src/task/ops/context-output.ts` | Context output |
| `packages/core/src/task/ops/crud.ts` | CRUD operations |
| `packages/core/src/task/ops/review.ts` | Review operations |
| `packages/core/src/task/ops/create-pr.ts` | PR creation |
| `packages/core/src/task/ops/session.ts` | Session records |
| `packages/core/src/task/phase/*.ts` | Phase execution functions |

---

## Related Endpoints

- [Task Queue API](./queue.md) - Global task queue management
- [Agent API](./agents.md) - Agent management
