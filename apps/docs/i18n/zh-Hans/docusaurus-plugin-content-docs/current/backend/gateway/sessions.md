# Session API

> `/api/sessions` - Session management endpoints

## Overview

The Session API provides independent session management functionality for task execution and agent interaction.

## Endpoint List

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/sessions` | List sessions |
| POST | `/api/sessions` | Create session |
| GET | `/api/sessions/:id` | Get session details |
| PATCH | `/api/sessions/:id` | Update session |
| DELETE | `/api/sessions/:id` | Delete session |
| POST | `/api/sessions/:id/message` | Send message |

---

## Detailed Description

### GET /api/sessions

List sessions.

**Query Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| task_id | string | No | Filter by task |
| agent_id | string | No | Filter by agent |
| status | string | No | Filter by status |

**Response**:

```json
{
  "sessions": [
    {
      "id": "session-abc123",
      "agent_id": "CLAUDE_CODE",
      "task_id": "task-xyz",
      "status": "active",
      "created_at": "2024-01-16T10:00:00Z",
      "last_active": "2024-01-16T14:30:00Z",
      "message_count": 42
    }
  ]
}
```

---

### POST /api/sessions

Create a new session.

**Request Body**:

```json
{
  "agent_id": "CLAUDE_CODE",
  "task_id": "task-xyz",
  "prompt": "Initial prompt for the session"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| agent_id | string | Yes | Agent ID |
| task_id | string | No | Associated task ID |
| prompt | string | No | Initial prompt |

**Response**:

```json
{
  "id": "session-abc123",
  "agent_id": "CLAUDE_CODE",
  "task_id": "task-xyz",
  "status": "created",
  "created_at": "2024-01-16T10:00:00Z"
}
```

---

### GET /api/sessions/:id

Get session details.

**Response**:

```json
{
  "id": "session-abc123",
  "agent_id": "CLAUDE_CODE",
  "task_id": "task-xyz",
  "status": "active",
  "created_at": "2024-01-16T10:00:00Z",
  "last_active": "2024-01-16T14:30:00Z",
  "message_count": 42,
  "data": {
    "workdir": "/path/to/project",
    "model": "claude-3-sonnet"
  }
}
```

---

### PATCH /api/sessions/:id

Update a session.

**Request Body**:

```json
{
  "status": "paused",
  "data": {
    "notes": "Paused for review"
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| status | string | Session status |
| data | object | Session data |
| prompt | string | Update prompt |

---

### POST /api/sessions/:id/message

Send a message to a session.

**Request Body**:

```json
{
  "content": "Please continue with the implementation"
}
```

**Response**:

```json
{
  "message_id": "msg-xyz",
  "status": "sent",
  "timestamp": "2024-01-16T14:35:00Z"
}
```

---

## Session Status

| Status | Description |
|--------|-------------|
| created | Just created |
| active | Active |
| paused | Paused |
| completed | Completed |
| failed | Failed |

---

## Related Endpoints

- [Task API](./tasks.md) - Task management
- [Agent API](./agents.md) - Agent management
