# Group Chats API

> `/api/group-chats` - Group chat management endpoints

## Overview

The Group Chats API provides multi-agent collaborative chat functionality, supporting multiple agents working together in the same session.

## Endpoint List

### Group Chat CRUD

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/group-chats` | List group chats |
| POST | `/api/group-chats` | Create group chat |
| GET | `/api/group-chats/:id` | Get group chat details |
| PATCH | `/api/group-chats/:id` | Update group chat |
| DELETE | `/api/group-chats/:id` | Delete group chat |

### Member Management

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/group-chats/:id/members` | List members |
| POST | `/api/group-chats/:id/members` | Add member |
| DELETE | `/api/group-chats/:id/members/:mid` | Remove member |

### Session Management

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/group-chats/:id/sessions` | List sessions |
| POST | `/api/group-chats/:id/sessions` | Create session |
| GET | `/api/group-chats/:id/sessions/:sid` | Get session details |
| PATCH | `/api/group-chats/:id/sessions/:sid` | Update session |
| DELETE | `/api/group-chats/:id/sessions/:sid` | Delete session |
| GET | `/api/group-chats/:id/sessions/:sid/agents` | List session agents |

### Message Management

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/group-chats/:id/sessions/:sid/messages` | List messages |
| POST | `/api/group-chats/:id/sessions/:sid/messages` | Send message |

### File Management

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/group-chats/:id/files` | List files |
| POST | `/api/group-chats/:id/files` | Upload file |
| GET | `/api/group-chats/:id/files/:name` | Download file |
| DELETE | `/api/group-chats/:id/files/:name` | Delete file |

### Picture Management

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/group-chats/:id/pictures` | List pictures |
| POST | `/api/group-chats/:id/pictures` | Upload picture |
| GET | `/api/group-chats/:id/pictures/:name` | Download picture |
| DELETE | `/api/group-chats/:id/pictures/:name` | Delete picture |

### WebSocket

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/group-chats/:id/sessions/:sid/ws` | WebSocket connection |

---

## Detailed Description

### GET /api/group-chats

List group chats.

**Query Parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| workspace_path | string | No | - | Workspace path |
| include_global | bool | No | true | Include global group chats |
| created_by | string | No | - | Filter by creator |

**Response**:

```json
{
  "group_chats": [
    {
      "id": "gc-abc123",
      "name": "Project Discussion",
      "description": "Discuss project implementation",
      "workspace_path": "/path/to/project",
      "created_at": "2024-01-01T10:00:00Z",
      "member_count": 3,
      "session_count": 2
    }
  ]
}
```

---

### POST /api/group-chats

Create a group chat.

**Request Body**:

```json
{
  "name": "Project Discussion",
  "description": "Discuss project implementation",
  "workspace_path": "/path/to/project",
  "members": [
    {
      "agent_id": "CLAUDE_CODE",
      "role": "developer"
    },
    {
      "agent_id": "my-reviewer",
      "role": "reviewer"
    }
  ]
}
```

---

### GET /api/group-chats/:id

Get group chat details.

**Response**:

```json
{
  "id": "gc-abc123",
  "name": "Project Discussion",
  "description": "Discuss project implementation",
  "workspace_path": "/path/to/project",
  "created_at": "2024-01-01T10:00:00Z",
  "updated_at": "2024-01-01T14:00:00Z",
  "members": [
    {
      "id": "member-1",
      "agent_id": "CLAUDE_CODE",
      "role": "developer",
      "joined_at": "2024-01-01T10:00:00Z"
    },
    {
      "id": "member-2",
      "agent_id": "my-reviewer",
      "role": "reviewer",
      "joined_at": "2024-01-01T10:00:00Z"
    }
  ],
  "session_count": 2
}
```

---

### GET /api/group-chats/:id/sessions/:sid/messages

List session messages. Supports multiple views.

**Query Parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| view | string | No | ui | View type: `ui` or `agent` |
| agent_id | string | Conditional | - | Agent ID (required when view=agent) |
| limit | int | No | 50 | Number of messages to return |
| before | string | No | - | Pagination cursor |

**View Types**:

- **ui**: User-friendly view, suitable for frontend rendering
- **agent**: Agent view, includes raw messages and tool calls

**Response (ui view)**:

```json
{
  "messages": [
    {
      "id": "msg-1",
      "sender": {
        "type": "user",
        "name": "User"
      },
      "content": "Please review this code",
      "timestamp": "2024-01-01T10:00:00Z"
    },
    {
      "id": "msg-2",
      "sender": {
        "type": "agent",
        "agent_id": "CLAUDE_CODE",
        "name": "Claude Code"
      },
      "content": "I'll review the code...",
      "timestamp": "2024-01-01T10:00:05Z",
      "status": "completed"
    }
  ],
  "has_more": false
}
```

**Response (agent view)**:

```json
{
  "messages": [
    {
      "id": "msg-1",
      "role": "user",
      "content": "Please review this code"
    },
    {
      "id": "msg-2",
      "role": "assistant",
      "content": "I'll review the code...",
      "tool_calls": [
        {
          "id": "call-1",
          "type": "Read",
          "parameters": {"file_path": "/src/main.ts"},
          "result": "..."
        }
      ]
    }
  ]
}
```

---

### POST /api/group-chats/:id/sessions/:sid/messages

Send a message to the group chat. Automatically triggers all agent responses.

**Request Body**:

```json
{
  "content": "Please implement this feature",
  "attachments": [
    {
      "type": "file",
      "name": "spec.md"
    }
  ]
}
```

**Response**:

```json
{
  "message_id": "msg-abc123",
  "triggered_agents": ["CLAUDE_CODE", "my-reviewer"]
}
```

---

### GET /api/group-chats/:id/sessions/:sid/ws

WebSocket connection for real-time communication.

**Query Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| workspace_path | string | No | Workspace path |
| member_type | string | No | Member type |
| member_id | string | No | Member ID |

**WebSocket Message Types**:

```typescript
// Server → Client
interface ServerMessage {
  type:
    | "message"           // New message
    | "agent_thinking"    // Agent thinking
    | "agent_response"    // Agent response
    | "typing_indicator"  // Typing indicator
    | "error";            // Error
  data: any;
}

// Client → Server
interface ClientMessage {
  type:
    | "send_message"      // Send message
    | "switch_view"       // Switch view
    | "subscribe"         // Subscribe to events
    | "unsubscribe";      // Unsubscribe from events
  data: any;
}
```

---

### POST /api/group-chats/:id/files

Upload a file.

**Request**: `multipart/form-data`

| Field | Type | Description |
|-------|------|-------------|
| file | file | File content |

**Response**:

```json
{
  "filename": "document.pdf",
  "size": 102400,
  "url": "/api/group-chats/gc-abc123/files/document.pdf"
}
```

---

### POST /api/group-chats/:id/pictures

Upload a picture. Only accepts image formats.

**Supported Formats**: `image/jpeg`, `image/png`, `image/gif`, `image/webp`

**Response**:

```json
{
  "filename": "screenshot.png",
  "size": 51200,
  "width": 1920,
  "height": 1080,
  "url": "/api/group-chats/gc-abc123/pictures/screenshot.png"
}
```

---

## Group Chat Storage

Group chat data is stored in the workspace directory:

```
<workspace>/.viben/group-chats/
└── <group-chat-id>/
    ├── config.yaml           # Group chat configuration
    ├── members.yaml          # Member list
    ├── sessions/
    │   └── <session-id>/
    │       ├── config.yaml   # Session configuration
    │       └── messages.jsonl # Message history
    ├── files/                # Uploaded files
    └── pictures/             # Uploaded pictures
```

---

## Related Endpoints

- [Agents API](./agents.md) - Agent management
- [WebSocket](./websocket.md) - WebSocket communication
- [Chat List API](./chat-list.md) - Chat list aggregation
