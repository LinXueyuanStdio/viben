---
sidebar_position: 13
title: "Queue API"
description: "Task queue management API"
---

# Task Queue API

> `/api/queue` - Task queue management endpoints

## Overview

The Task Queue API provides global concurrency control and failure recovery capabilities, allowing the frontend to submit agent tasks to the queue, which are then uniformly scheduled and executed by the Gateway to prevent resource exhaustion from running too many agents simultaneously.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/queue/enqueue` | Submit task to queue |
| POST | `/api/queue/enqueue-batch` | Batch submit tasks to queue |
| GET | `/api/queue/status` | Get overall queue status |
| GET | `/api/queue/tasks` | Get task list |
| GET | `/api/queue/tasks/:id` | Get single task details |
| GET | `/api/queue/tasks/:id/running` | Check if task process is running |
| GET | `/api/queue/tasks/:id/stream` | Task output stream (SSE) |
| DELETE | `/api/queue/tasks/:id` | Cancel/delete task |
| PUT | `/api/queue/config` | Update queue configuration |
| GET | `/api/queue/config` | Get queue configuration |
| POST | `/api/queue/clear-history` | Clear task history |

---

## Detailed Description

### POST /api/queue/enqueue

Submit a task to the queue.

**Request Body**:

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

**Field Description**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| agent_id | string | Yes | Agent ID |
| input | string | Yes | User prompt |
| cwd | string | No | Working directory |
| session_id | string | No | Session ID |
| agent_config_path | string | No | Agent configuration file path |
| resume_session | string | No | Resume existing SDK session |
| max_retries | number | No | Maximum retry count (default 3) |
| attachments | array | No | Attachment list |

**Response**:

```json
{
  "task_id": "task_1709123456789_abc123",
  "position": 2,
  "status": "pending"
}
```

---

### POST /api/queue/enqueue-batch

Batch submit tasks to the queue.

**Request Body**:

```json
{
  "task_ids": ["task-1", "task-2", "task-3"]
}
```

**Response**:

```json
{
  "success": true,
  "queued": 3,
  "failed": []
}
```

---

### GET /api/queue/status

Get overall queue status.

**Response**:

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

Get task list.

**Query Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| status | string | Filter by status: pending, running, completed, failed |

**Response**:

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

Get single task details.

**Response**:

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

Check if task process is actually running.

**Response**:

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

Subscribe to task output SSE stream.

**Response Format**: `text/event-stream`

**Event Types**:

```json
// Initial task status
{"type": "task", "task": {...}}

// Progress update
{"type": "progress", "id": "task_...", "progress": {...}}

// Task completed
{"type": "completed", "task": {...}}

// Task failed
{"type": "failed", "task": {...}}

// Task cancelled
{"type": "cancelled", "task": {...}}

// Heartbeat
{"type": "ping"}

// Stream end
{"type": "done"}
```

---

### DELETE /api/queue/tasks/:id

Cancel or delete a task.

- For pending/running tasks: cancel execution
- For completed/failed tasks: remove from history

**Response**:

```json
// Cancel successful
{"cancelled": true, "task_id": "task_..."}

// Delete successful
{"deleted": true, "task_id": "task_..."}
```

---

### PUT /api/queue/config

Update queue configuration.

**Request Body**:

```json
{
  "max_concurrency": 5,
  "default_max_retries": 3,
  "persist_debounce_ms": 500,
  "shutdown_timeout_ms": 30000
}
```

**Field Description**:

| Field | Type | Description |
|-------|------|-------------|
| max_concurrency | number | Maximum concurrent tasks |
| default_max_retries | number | Default maximum retry count |
| persist_debounce_ms | number | Persistence debounce delay (milliseconds) |
| shutdown_timeout_ms | number | Shutdown timeout (milliseconds) |

---

### GET /api/queue/config

Get current queue configuration.

**Response**:

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

Clear completed and failed task history.

**Response**:

```json
{
  "cleared": 15
}
```

---

## Task Status

| Status | Description |
|--------|-------------|
| pending | Queued, waiting for execution |
| running | Currently executing |
| retrying | Execution failed, preparing to retry |
| completed | Execution completed successfully |
| failed | Execution failed, maximum retries reached |

---

## Event Notifications

Queue status changes will send events to WebSocket (queue channel) and SSE:

```json
// Task queued
{
  "type": "queue_task_queued",
  "data": {
    "task": { "id": "...", "status": "pending", "agent_id": "...", "created_at": ... }
  }
}

// Task started
{
  "type": "queue_task_started",
  "data": {
    "task": { "id": "...", "status": "running", ... }
  }
}

// Task progress
{
  "type": "queue_task_progress",
  "data": {
    "task_id": "...",
    "progress": { ... }
  }
}

// Task completed
{
  "type": "queue_task_completed",
  "data": {
    "task": { ... },
    "duration": 5000
  }
}

// Task failed
{
  "type": "queue_task_failed",
  "data": {
    "task": { ... },
    "error": "Error message",
    "duration": 3000
  }
}

// Task cancelled
{
  "type": "queue_task_cancelled",
  "data": {
    "task": { ... }
  }
}

// Queue status changed
{
  "type": "queue_status_changed",
  "data": {
    "pending_count": 2,
    "running_count": 1,
    "max_concurrency": 3,
    "tasks": [...]
  }
}

// Queue restored (after Gateway restart)
{
  "type": "queue_restored",
  "data": {
    "pending_count": 3,
    "running_recovered": 1
  }
}
```

---

## File Persistence

Queue data is stored in `~/.viben/queue/` directory:

```
~/.viben/queue/
├── config.yaml      # Queue configuration
├── state.yaml       # Queue metadata
├── tasks/           # Task details
│   ├── task-{id}.yaml
│   └── ...
└── corrupted/       # Corrupted task files
```

---

## Related Endpoints

- [Agent API](./agents.md) - Agent management
- [WebSocket API](./websocket.md) - Real-time event subscription
- [Event Stream](./events.md) - SSE event notifications
