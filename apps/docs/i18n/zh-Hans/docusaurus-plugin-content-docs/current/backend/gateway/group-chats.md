# Group Chats API

> `/api/group-chats` - Group chat management endpoints

## Overview

The Group Chats API provides multi-agent collaborative chat functionality, supporting multiple agents working together in the same session. It uses a file-based storage system and supports a dual-view architecture for different perspectives on conversations.

## Core Concepts

### Dual-View System

Group chats support two distinct views for messages:

| View | File Source | Content | Description |
|------|-------------|---------|-------------|
| **User View** | `messages.ui.jsonl` | Clean message stream | What users see in the UI, without tool call details |
| **Agent View** | `<agent-id>/messages.rollout.jsonl` | Raw agent messages | Complete agent history including tool calls |

When a user sends a message:
1. All agents in the group chat **think in parallel**
2. User view shows "Agent is thinking..." status
3. Each agent provides their response when ready
4. Tool calls happen in the background, hidden from user view

### Participant Types

| Type | Identifier | Description |
|------|------------|-------------|
| `human` | User ID | Human users who send messages via UI |
| `agent` | Agent ID | AI agents like Claude, GPT, etc. |

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

**UI Message Types**:

```typescript
type UIMessageType =
  | "user"           // User message
  | "agent_thinking" // Agent is thinking
  | "agent_response" // Agent response
  | "system"         // System messages (member joined/left, etc.)
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

Group chat data is stored in the workspace directory using a file-based approach:

```
<workspace>/.viben/group-chats/
└── <group-chat-id>/
    ├── config.yaml              # Group chat configuration
    ├── files/                   # Shared files (group files)
    ├── pictures/                # Shared pictures (group album)
    └── sessions/                # Conversation records
        └── <session-id>/
            ├── config.yaml          # Session configuration
            ├── messages.ui.jsonl    # User view messages (append-only)
            ├── responses.jsonl      # Current round agent responses (cleared each round)
            └── agents/
                └── <agent-id>/
                    ├── messages.rollout.jsonl  # Agent message history (with tool calls)
                    └── subagents/              # Sub-agent messages (if any)
                        └── agent-<subagent-id>.jsonl
```

### Key Files Explained

| File | Lifecycle | Purpose |
|------|-----------|---------|
| `messages.ui.jsonl` | append-only | Complete conversation history for user view |
| `responses.jsonl` | cleared each round | Temporary storage for current round agent responses |
| `messages.rollout.jsonl` | append-only | Full agent message history (including tool calls) |
| `subagents/agent-*.jsonl` | append-only | Sub-agent message records (following Claude Code design) |

### The responses.jsonl Lifecycle

The `responses.jsonl` file plays a crucial role in multi-agent coordination:

1. **User sends message**: `responses.jsonl` is **cleared**
2. **Agents process**: Each agent thinks and generates a response
3. **Agent completes**: Response is **appended** to `responses.jsonl`
4. **Next round**: When user sends next message, `responses.jsonl` is read to build context for each agent (showing what other agents said)

This mechanism allows each agent to see what other agents responded in the previous round, enabling coherent multi-agent discussions.

### Message Building Logic

When sending messages to agents, the Gateway constructs context that includes other agents' previous responses:

```
Example: 3 agents (Claude, Cursor, Codex)

User Round 1: "Please review this code"
  -> To Claude: "Please review this code"
  -> To Cursor: "Please review this code"
  -> To Codex: "Please review this code"

After agents respond, responses.jsonl contains all 3 responses.

User Round 2: "How should I fix it?"
  -> To Claude:
     [Cursor]: I found 2 bugs...

     [Codex]: I suggest refactoring...

     [User]: How should I fix it?

  -> To Cursor:
     [Claude]: The code has 3 issues...

     [Codex]: I suggest refactoring...

     [User]: How should I fix it?
```

---

## View Switching

Users can switch between different views in the UI:

| View | Data Source | Can Send Messages | Description |
|------|-------------|-------------------|-------------|
| **Group Chat View** (default) | `messages.ui.jsonl` | Yes | Clean message stream, normal user interaction |
| **Agent View** | `agents/<id>/messages.rollout.jsonl` | No (read-only) | View specific agent's tool calls and processing |

**Switching Behavior**:
- Switching maintains position in the same conversation round
- Agent view disables the message input box
- User must manually switch views; no automatic switching

---

## Comparison with Regular Chat Sessions

| Aspect | Regular Chat Session | Group Chat |
|--------|---------------------|------------|
| Participants | 1 user + 1 agent | 1 user + N agents |
| Agent Response | Sequential | **Parallel** |
| Tool Calls | Shown in UI | **Hidden in background** |
| Storage | Database | **File system** |
| View | Single | **Switchable** |

---

## Related Endpoints

- [Agents API](./agents.md) - Agent management
- [WebSocket](./websocket.md) - WebSocket communication
- [Chat List API](./chat-list.md) - Chat list aggregation
