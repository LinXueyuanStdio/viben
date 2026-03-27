# Event Stream API

> `/api/events` - Server-Sent Events endpoint

## Overview

The Event Stream API provides real-time event push via Server-Sent Events (SSE).

## Endpoint

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/events` | SSE event stream |

---

## Detailed Description

### GET /api/events

Establish an SSE connection to receive real-time event push.

**Response Headers**:

```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
```

**Event Format**:

```
event: TaskCreated
data: {"task_id":"task-abc123","title":"New task"}

event: AgentSpawned
data: {"agent_id":"CLAUDE_CODE","session_id":"xyz"}
```

---

## Event Types

### Task Events

| Event | Description |
|-------|-------------|
| TaskCreated | Task created |
| TaskUpdated | Task updated |
| TaskDeleted | Task deleted |
| TaskStatusChanged | Task status changed |

**Example**:

```json
{
  "type": "TaskStatusChanged",
  "task_id": "task-abc123",
  "old_status": "pending",
  "new_status": "in_progress",
  "timestamp": "2024-01-16T10:00:00Z"
}
```

### Agent Events

| Event | Description |
|-------|-------------|
| AgentSpawned | Agent started |
| AgentCompleted | Agent completed |
| AgentError | Agent error |

**Example**:

```json
{
  "type": "AgentSpawned",
  "agent_id": "CLAUDE_CODE",
  "session_id": "session-xyz",
  "workdir": "/path/to/project",
  "timestamp": "2024-01-16T10:00:00Z"
}
```

### Group Chat Events

| Event | Description |
|-------|-------------|
| GroupChatMessage | New message |
| GroupChatAgentThinking | Agent thinking |
| GroupChatAgentResponse | Agent response |

### Cron Job Events

| Event | Description |
|-------|-------------|
| CronJobTriggered | Job triggered |
| CronJobCompleted | Job completed |
| CronJobFailed | Job failed |

---

## Usage Examples

### JavaScript

```javascript
const eventSource = new EventSource('http://localhost:18790/api/events');

eventSource.addEventListener('TaskCreated', (event) => {
  const data = JSON.parse(event.data);
  console.log('Task created:', data.task_id);
});

eventSource.addEventListener('AgentSpawned', (event) => {
  const data = JSON.parse(event.data);
  console.log('Agent spawned:', data.agent_id);
});

eventSource.onerror = (error) => {
  console.error('SSE error:', error);
};
```

### cURL

```bash
curl -N http://localhost:18790/api/events
```

---

## SSE vs WebSocket Comparison

| Feature | SSE | WebSocket |
|---------|-----|-----------|
| Direction | Server → Client | Bidirectional |
| Protocol | HTTP | WebSocket |
| Reconnection | Automatic | Manual |
| Use Case | Event push | Real-time interaction |

**Recommendations**:
- Use SSE for unidirectional event push (`/api/events`)
- Use WebSocket for bidirectional interaction (`/ws`)

---

## Related Endpoints

- [WebSocket](./websocket.md) - WebSocket communication
- [Tasks API](./tasks.md) - Task management
- [Agents API](./agents.md) - Agent management
