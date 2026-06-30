# Tasks API

> `/api/tasks` - Task management endpoints

## Overview

The Tasks API provides functionality for creating, querying, updating, and deleting tasks.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/tasks` | List all tasks |
| POST | `/api/tasks` | Create a task |
| GET | `/api/tasks/:id` | Get task details |
| PATCH | `/api/tasks/:id` | Update a task |
| DELETE | `/api/tasks/:id` | Delete a task |

---

## Detailed Description

### GET /api/tasks

List all tasks.

**Response**:

```json
{
  "tasks": [
    {
      "id": "task-abc123",
      "title": "Implement user authentication",
      "description": "Add login/logout functionality",
      "status": "in_progress",
      "agent_id": "CLAUDE_CODE",
      "created_at": "2024-01-16T10:00:00Z",
      "updated_at": "2024-01-16T14:30:00Z"
    }
  ]
}
```

---

### POST /api/tasks

Create a new task.

**Request Body**:

```json
{
  "title": "Implement user authentication",
  "description": "Add login/logout functionality",
  "agent_id": "CLAUDE_CODE"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| title | string | Yes | Task title |
| description | string | No | Task description |
| agent_id | string | No | Assigned agent |

**Response**:

```json
{
  "id": "task-abc123",
  "title": "Implement user authentication",
  "description": "Add login/logout functionality",
  "status": "pending",
  "created_at": "2024-01-16T10:00:00Z"
}
```

---

### GET /api/tasks/:id

Get task details.

**Response**:

```json
{
  "id": "task-abc123",
  "title": "Implement user authentication",
  "description": "Add login/logout functionality",
  "status": "in_progress",
  "agent_id": "CLAUDE_CODE",
  "sessions": [
    {
      "id": "session-xyz",
      "status": "active",
      "message_count": 15
    }
  ],
  "created_at": "2024-01-16T10:00:00Z",
  "updated_at": "2024-01-16T14:30:00Z"
}
```

---

### PATCH /api/tasks/:id

Update a task.

**Request Body**:

```json
{
  "title": "Updated title",
  "description": "Updated description",
  "status": "completed",
  "agent_id": "my-agent"
}
```

| Field | Type | Description |
|-------|------|-------------|
| title | string | Task title |
| description | string | Task description |
| status | string | Task status |
| agent_id | string | Assigned agent |

---

### DELETE /api/tasks/:id

Delete a task.

**Response**:

```json
{
  "success": true
}
```

---

## Task Status

| Status | Description |
|--------|-------------|
| pending | Pending |
| in_progress | In progress |
| completed | Completed |
| failed | Failed |
| cancelled | Cancelled |

---

## Event Notifications

Events are sent when task status changes:

```json
{
  "type": "TaskStatusChanged",
  "data": {
    "task_id": "task-abc123",
    "old_status": "pending",
    "new_status": "in_progress",
    "timestamp": "2024-01-16T10:00:00Z"
  }
}
```

---

## Related Endpoints

- [Sessions API](./sessions.md) - Session management
- [Agents API](./agents.md) - Agent management
