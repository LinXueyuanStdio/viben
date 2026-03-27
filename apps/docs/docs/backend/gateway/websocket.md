# WebSocket API

> WebSocket real-time communication endpoints

## Overview

Viben Gateway provides multiple WebSocket endpoints for real-time communication:
- General WebSocket (`/ws`)
- Group Chat WebSocket (`/api/group-chats/:id/sessions/:sid/ws`)
- Terminal WebSocket (`/terminal/ws`)

---

## Endpoint List

| Path | Description |
|------|-------------|
| `/ws` | General WebSocket, event subscription |
| `/api/group-chats/:id/sessions/:sid/ws` | Group chat session real-time communication |
| `/terminal/ws` | Terminal PTY session |

---

## General WebSocket

### GET /ws

General WebSocket connection for subscribing to system events.

**Event Channels**:

| Channel | Description |
|---------|-------------|
| cron | Cron job events |
| channels | Channel events |
| group | Group chat events |
| tasks | Task events |
| sessions | Session events |
| agents | Agent events |
| gateway | Gateway events |

**Client Messages**:

```json
// Subscribe to events
{
  "type": "subscribe",
  "channels": ["cron", "agents"]
}

// Unsubscribe from events
{
  "type": "unsubscribe",
  "channels": ["cron"]
}
```

**Server Messages**:

```json
{
  "channel": "agents",
  "type": "AgentSpawned",
  "data": {
    "agent_id": "CLAUDE_CODE",
    "session_id": "abc123",
    "workdir": "/path/to/project"
  },
  "timestamp": "2024-01-16T10:00:00Z"
}
```

---

## Group Chat WebSocket

### GET /api/group-chats/:id/sessions/:sid/ws

Group chat session WebSocket connection.

**Query Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| workspace_path | string | No | Workspace path |
| member_type | string | No | Member type |
| member_id | string | No | Member ID |

**Client Messages**:

```typescript
// Send message
{
  "type": "send_message",
  "data": {
    "content": "Hello everyone"
  }
}

// Switch view
{
  "type": "switch_view",
  "data": {
    "view": "agent",
    "agent_id": "CLAUDE_CODE"
  }
}

// Typing indicator
{
  "type": "typing",
  "data": {
    "is_typing": true
  }
}
```

**Server Messages**:

```typescript
// New message
{
  "type": "message",
  "data": {
    "id": "msg-123",
    "sender": {
      "type": "agent",
      "agent_id": "CLAUDE_CODE"
    },
    "content": "I'll help with that..."
  }
}

// Agent thinking
{
  "type": "agent_thinking",
  "data": {
    "agent_id": "CLAUDE_CODE",
    "status": "thinking"
  }
}

// Agent response
{
  "type": "agent_response",
  "data": {
    "agent_id": "CLAUDE_CODE",
    "status": "completed",
    "message_id": "msg-456"
  }
}

// Typing indicator
{
  "type": "typing_indicator",
  "data": {
    "member_id": "user-1",
    "is_typing": true
  }
}

// Error
{
  "type": "error",
  "data": {
    "code": "AGENT_ERROR",
    "message": "Agent failed to respond"
  }
}
```

---

## Terminal WebSocket

### GET /terminal/ws

Terminal PTY session WebSocket connection.

**Query Parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| cwd | string | No | cwd | Working directory |
| cols | int | No | 80 | Terminal columns |
| rows | int | No | 24 | Terminal rows |

**Data Encoding**: Base64

**Client Messages**:

```typescript
// Input data (Base64 encoded)
{
  "type": "input",
  "data": "bHMgLWxhCg=="  // "ls -la\n"
}

// Resize
{
  "type": "resize",
  "data": {
    "cols": 120,
    "rows": 40
  }
}
```

**Server Messages**:

```typescript
// Output data (Base64 encoded)
{
  "type": "output",
  "data": "dG90YWwgMTI4Cg=="
}

// Terminal closed
{
  "type": "exit",
  "data": {
    "code": 0
  }
}
```

**Example (JavaScript)**:

```javascript
const ws = new WebSocket('ws://localhost:18790/terminal/ws?cols=80&rows=24');

ws.onopen = () => {
  // Send command
  const input = btoa('ls -la\n');
  ws.send(JSON.stringify({ type: 'input', data: input }));
};

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.type === 'output') {
    const output = atob(msg.data);
    console.log(output);
  }
};
```

---

## Event Types Summary

### Task Events

| Type | Description |
|------|-------------|
| TaskCreated | Task created |
| TaskUpdated | Task updated |
| TaskDeleted | Task deleted |
| TaskStatusChanged | Task status changed |

### Agent Events

| Type | Description |
|------|-------------|
| AgentSpawned | Agent started |
| AgentCompleted | Agent completed |
| AgentError | Agent error |

### Group Chat Events

| Type | Description |
|------|-------------|
| GroupChatMessage | New message |
| GroupChatAgentThinking | Agent thinking |
| GroupChatAgentResponse | Agent response |

### Cron Job Events

| Type | Description |
|------|-------------|
| CronJobTriggered | Job triggered |
| CronJobCompleted | Job completed |
| CronJobFailed | Job failed |

---

## Connection Management

### Heartbeat

WebSocket connections use ping/pong mechanism to stay alive:
- Server sends ping every 30 seconds
- Client should respond with pong within 10 seconds
- Connection will be closed if no response within timeout

### Reconnection

It is recommended that clients implement automatic reconnection logic:

```javascript
function connect() {
  const ws = new WebSocket('ws://localhost:18790/ws');

  ws.onclose = () => {
    setTimeout(connect, 3000);  // Reconnect after 3 seconds
  };

  ws.onerror = () => {
    ws.close();
  };
}
```

---

## Related Endpoints

- [Event Stream API](./events.md) - SSE event stream
- [Group Chats API](./group-chats.md) - Group chat management
