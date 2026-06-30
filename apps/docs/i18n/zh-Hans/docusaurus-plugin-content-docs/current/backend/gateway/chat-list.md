# Chat List API

> `/api/chat-list` - Chat list aggregation endpoint

## Overview

The Chat List API provides a unified aggregated view of chat resources, integrating group chats, executor sessions, and agent sessions.

## Endpoint

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/chat-list` | Get aggregated chat list |

---

## Detailed Description

### GET /api/chat-list

Get all chattable resources under a workspace.

**Query Parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| workspace_path | string | No | - | Workspace path |
| include_global | bool | No | true | Include global resources |

**Response**:

```json
{
  "items": [
    {
      "id": "gc-project-chat",
      "type": "group_chat",
      "name": "Project Discussion",
      "description": "Team collaboration chat",
      "last_active": "2024-01-16T14:30:00Z",
      "unread_count": 3,
      "workspace_path": "/path/to/project"
    },
    {
      "id": "CLAUDE_CODE",
      "type": "executor",
      "name": "Claude Code",
      "description": "Anthropic Claude Code CLI",
      "is_available": true,
      "session_count": 5,
      "last_active": "2024-01-16T13:00:00Z"
    },
    {
      "id": "my-agent",
      "type": "agent",
      "name": "My Coding Assistant",
      "description": "Custom agent for coding",
      "session_count": 2,
      "last_active": "2024-01-16T12:00:00Z"
    }
  ],
  "counts": {
    "group_chats": 1,
    "executors": 3,
    "agents": 2
  }
}
```

---

## Chat Item Types

### Group Chat (group_chat)

```json
{
  "id": "gc-abc123",
  "type": "group_chat",
  "name": "Project Discussion",
  "description": "Team collaboration",
  "member_count": 3,
  "session_count": 2,
  "last_active": "2024-01-16T14:30:00Z",
  "unread_count": 3,
  "workspace_path": "/path/to/project",
  "is_global": false
}
```

### Executor (executor)

```json
{
  "id": "CLAUDE_CODE",
  "type": "executor",
  "name": "Claude Code",
  "description": "Anthropic Claude Code CLI",
  "is_available": true,
  "supports_mcp": true,
  "session_count": 5,
  "last_active": "2024-01-16T13:00:00Z"
}
```

### Agent (agent)

```json
{
  "id": "my-agent",
  "type": "agent",
  "name": "My Coding Assistant",
  "description": "Custom agent",
  "model": "claude-3-sonnet",
  "provider": "anthropic",
  "session_count": 2,
  "last_active": "2024-01-16T12:00:00Z",
  "workspace_path": null,
  "is_global": true
}
```

---

## Sorting Rules

Returned items are sorted by `last_active` in descending order (most recently active first).

---

## Use Cases

The Chat List API is primarily used for:
- Desktop application sidebar display
- Mobile application chat list
- Quick switching between chat targets

---

## Related Endpoints

- [Group Chats API](./group-chats.md) - Group chat details
- [Executors API](./executors.md) - Executor details
- [Agents API](./agents.md) - Agent details
