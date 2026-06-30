---
sidebar_position: 15
title: "Kanban API"
description: "Kanban board API for task visualization"
---

# Kanban API

> Task Kanban Board API

## Overview

The task kanban board functionality is built on top of existing Viben data models and does not require separate kanban data storage:

- **Workspace** = Kanban Project (workspace as project)
- **Background Tasks** = Kanban Task (background agent tasks as kanban tasks)

## Data Reuse

| Kanban Concept | Viben Implementation | API Endpoint |
|----------------|---------------------|--------------|
| Project | Workspace | `GET /api/workspaces` |
| Task | Background Task | `GET /api/agent/tasks/subscribe` (SSE) |
| Stop Task | Stop Task | `POST /api/agent/tasks/:taskId/stop` |

## Related APIs

### Workspace API

```
GET /api/workspaces
```

Returns all workspaces, including the global workspace.

### Background Tasks API

```
GET /api/agent/tasks/subscribe  (SSE)
```

Subscribe to background task status updates. Response format:

```json
{
  "type": "tasks",
  "tasks": [
    {
      "taskId": "uuid",
      "sessionId": "agent-session-uuid",
      "prompt": "user input",
      "status": "running",
      "startedAt": "ISO timestamp",
      "completedAt": "ISO timestamp (optional)",
      "cost": 0.001,
      "duration": 1234
    }
  ]
}
```

**Task Status**:

| Status | Description |
|--------|-------------|
| `running` | Running |
| `completed` | Completed |
| `error` | Error |
| `cancelled` | Cancelled |

```
POST /api/agent/tasks/:taskId/stop
```

Stop a background task.

## Kanban Column Mapping

| Column Name | Background Task Status |
|-------------|----------------------|
| In Progress | `running` |
| Done | `completed` |
| Error | `error` |
| Cancelled | `cancelled` |

## Frontend Integration

The frontend uses the following hooks to fetch kanban data:

1. `useLocalWorkspaces()` - Get workspace list as projects
2. `useBackgroundTasks()` - Get background tasks as kanban tasks

## Related Endpoints

- [Task API](./tasks.md) - Task management
- [Agent API](./agents.md) - Agent management
