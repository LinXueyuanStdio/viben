---
sidebar_position: 13
title: "Queue API"
description: "Task queue management API"
---

# 任务队列 API

> `/api/queue` - 任务队列管理端点

## 概述

任务队列 API 提供全局并发控制和故障恢复能力，允许前端提交 agent 任务到队列，由 Gateway 统一调度执行，避免同时运行过多 agent 导致资源耗尽。

## 端点列表

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/queue/enqueue` | 提交任务到队列 |
| POST | `/api/queue/enqueue-batch` | 批量提交任务到队列 |
| GET | `/api/queue/status` | 获取队列整体状态 |
| GET | `/api/queue/tasks` | 获取任务列表 |
| GET | `/api/queue/tasks/:id` | 获取单个任务详情 |
| GET | `/api/queue/tasks/:id/running` | 检查任务进程是否运行中 |
| GET | `/api/queue/tasks/:id/stream` | 任务输出流（SSE） |
| DELETE | `/api/queue/tasks/:id` | 取消/删除任务 |
| PUT | `/api/queue/config` | 更新队列配置 |
| GET | `/api/queue/config` | 获取队列配置 |
| POST | `/api/queue/clear-history` | 清除任务历史 |

---

## 详细说明

### POST /api/queue/enqueue

提交任务到队列。

**请求体**:

```json
{
  "agent_id": "CLAUDE_CODE",
  "input": "Please help me refactor this code",
  "cwd": "/path/to/project",
  "session_id": "session-123",
  "agent_config_path": "/path/to/agents/myagent/AGENTS.md",
  "max_retries": 3,
  "attachments": [
    { "type": "text", "data": "...", "name": "context.txt" }
  ]
}
```

**字段说明**:

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| agent_id | string | Yes | 智能体 ID |
| input | string | Yes | 用户提示词 |
| cwd | string | No | 工作目录 |
| session_id | string | No | 会话 ID |
| agent_config_path | string | No | 智能体配置文件路径 |
| resume_session | string | No | 恢复现有 SDK 会话 |
| max_retries | number | No | 最大重试次数（默认 3） |
| attachments | array | No | 附件列表 |

**响应**:

```json
{
  "task_id": "task_1709123456789_abc123",
  "position": 2,
  "status": "pending"
}
```

---

### POST /api/queue/enqueue-batch

批量提交任务到队列。

**请求体**:

```json
{
  "task_ids": ["task-1", "task-2", "task-3"]
}
```

**响应**:

```json
{
  "success": true,
  "queued": 3,
  "failed": []
}
```

---

### GET /api/queue/status

获取队列整体状态。

**响应**:

```json
{
  "pending_count": 3,
  "running_count": 2,
  "max_concurrency": 3,
  "tasks": [
    {
      "id": "task_1709123456789_abc123",
      "status": "running",
      "agent_id": "CLAUDE_CODE",
      "created_at": 1709123456789
    }
  ]
}
```

---

### GET /api/queue/tasks

获取任务列表。

**查询参数**:

| 参数 | 类型 | 说明 |
|------|------|------|
| status | string | 按状态过滤：pending, running, completed, failed |

**响应**:

```json
{
  "tasks": [
    {
      "id": "task_1709123456789_abc123",
      "type": "agent-run",
      "payload": {
        "agent_id": "CLAUDE_CODE",
        "input": "Please help me..."
      },
      "status": "completed",
      "retry_count": 0,
      "max_retries": 3,
      "created_at": 1709123456789,
      "started_at": 1709123456800,
      "completed_at": 1709123457000
    }
  ]
}
```

---

### GET /api/queue/tasks/:id

获取单个任务详情。

**响应**:

```json
{
  "id": "task_1709123456789_abc123",
  "type": "agent-run",
  "payload": {
    "agent_id": "CLAUDE_CODE",
    "input": "Please help me...",
    "cwd": "/path/to/project"
  },
  "status": "running",
  "retry_count": 0,
  "max_retries": 3,
  "created_at": 1709123456789,
  "started_at": 1709123456800
}
```

---

### GET /api/queue/tasks/:id/running

检查任务进程是否实际运行中。

**响应**:

```json
{
  "success": true,
  "data": {
    "task_id": "task_1709123456789_abc123",
    "running": true,
    "status": "running"
  }
}
```

---

### GET /api/queue/tasks/:id/stream

订阅任务输出的 SSE 流。

**响应格式**: `text/event-stream`

**事件类型**:

```json
// 初始任务状态
{"type": "task", "task": {...}}

// 进度更新
{"type": "progress", "id": "task_...", "progress": {...}}

// 任务完成
{"type": "completed", "task": {...}}

// 任务失败
{"type": "failed", "task": {...}}

// 任务取消
{"type": "cancelled", "task": {...}}

// 心跳
{"type": "ping"}

// 流结束
{"type": "done"}
```

---

### DELETE /api/queue/tasks/:id

取消或删除任务。

- 对于 pending/running 任务：取消执行
- 对于 completed/failed 任务：从历史记录中删除

**响应**:

```json
// 取消成功
{"cancelled": true, "task_id": "task_..."}

// 删除成功
{"deleted": true, "task_id": "task_..."}
```

---

### PUT /api/queue/config

更新队列配置。

**请求体**:

```json
{
  "max_concurrency": 5,
  "default_max_retries": 3,
  "persist_debounce_ms": 500,
  "shutdown_timeout_ms": 30000
}
```

**字段说明**:

| 字段 | 类型 | 说明 |
|------|------|------|
| max_concurrency | number | 最大并发任务数 |
| default_max_retries | number | 默认最大重试次数 |
| persist_debounce_ms | number | 持久化防抖延迟（毫秒） |
| shutdown_timeout_ms | number | 关闭超时时间（毫秒） |

---

### GET /api/queue/config

获取当前队列配置。

**响应**:

```json
{
  "max_concurrency": 3,
  "default_max_retries": 3,
  "persist_debounce_ms": 500,
  "shutdown_timeout_ms": 30000
}
```

---

### POST /api/queue/clear-history

清除已完成和失败的任务历史记录。

**响应**:

```json
{
  "cleared": 15
}
```

---

## 任务状态

| 状态 | 说明 |
|------|------|
| pending | 已入队，等待执行 |
| running | 正在执行中 |
| retrying | 执行失败，准备重试 |
| completed | 执行成功完成 |
| failed | 执行失败，已达最大重试次数 |

---

## 事件通知

队列状态变化时会发送事件到 WebSocket（queue 通道）和 SSE：

```json
// 任务入队
{
  "type": "queue_task_queued",
  "data": {
    "task": { "id": "...", "status": "pending", "agent_id": "...", "created_at": ... }
  }
}

// 任务开始
{
  "type": "queue_task_started",
  "data": {
    "task": { "id": "...", "status": "running", ... }
  }
}

// 任务进度
{
  "type": "queue_task_progress",
  "data": {
    "task_id": "...",
    "progress": { ... }
  }
}

// 任务完成
{
  "type": "queue_task_completed",
  "data": {
    "task": { ... },
    "duration": 5000
  }
}

// 任务失败
{
  "type": "queue_task_failed",
  "data": {
    "task": { ... },
    "error": "Error message",
    "duration": 3000
  }
}

// 任务取消
{
  "type": "queue_task_cancelled",
  "data": {
    "task": { ... }
  }
}

// 队列状态变化
{
  "type": "queue_status_changed",
  "data": {
    "pending_count": 2,
    "running_count": 1,
    "max_concurrency": 3,
    "tasks": [...]
  }
}

// 队列恢复（Gateway 重启后）
{
  "type": "queue_restored",
  "data": {
    "pending_count": 3,
    "running_recovered": 1
  }
}
```

---

## 文件持久化

队列数据存储在 `~/.viben/queue/` 目录：

```
~/.viben/queue/
├── config.yaml      # 队列配置
├── state.yaml       # 队列元数据
├── tasks/           # 任务详情
│   ├── task-{id}.yaml
│   └── ...
└── corrupted/       # 损坏的任务文件
```

---

## 相关端点

- [智能体 API](./agents.md) - 智能体管理
- [WebSocket API](./websocket.md) - 实时事件订阅
- [事件流](./events.md) - SSE 事件通知
