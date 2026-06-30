# WebSocket API

> WebSocket real-time communication endpoints

## Overview

Viben Gateway provides multiple WebSocket endpoints for real-time communication:
- General WebSocket (`/ws`)
- Agent Execution WebSocket (`/ws/agent/run`)
- Group Chat WebSocket (`/api/group-chats/:id/sessions/:sid/ws`)
- Terminal WebSocket (`/terminal/ws`)

---

## Endpoint List

| Path | Description |
|------|-------------|
| `/ws` | General WebSocket, event subscription |
| `/ws/agent/run` | Agent execution, supports interactive Q&A |
| `/api/group-chats/:id/sessions/:sid/ws` | Group chat session real-time communication |
| `/terminal/ws` | Terminal PTY session |

---

## Agent Execution WebSocket

### GET /ws/agent/run

Agent execution WebSocket connection, supports bidirectional communication and interactive features (such as AskUserQuestion, EnterPlanMode).

**Query Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| cwd | string | No | Working directory |
| agent_config_path | string | No | Agent config file path (e.g., `/path/to/agents/myagent/AGENTS.md`) |
| session_id | string | No | Session ID (for persistence) |
| task_id | string | No | Task ID (for persistence) |

Note: This endpoint also accepts the camelCase aliases `agentConfigPath`, `sessionId`, and `taskId` for backward compatibility, but snake_case is the documented gateway convention.
**Client Messages**:

```typescript
// Start execution
{
  "type": "start",
  "prompt": "Please help me create a React component",
  "agentConfig": {  // Optional, if agentConfigPath not provided
    "name": "my-agent",
    "model": "claude-sonnet-4-20250514",
    "systemPrompt": "You are a helpful assistant."
  }
}

// Answer question (AskUserQuestion)
{
  "type": "answer",
  "questionId": "tool_use_123",
  "answers": {
    "question_0": "Option A"
  }
}

// Approve plan
{
  "type": "approve",
  "planId": "plan_123"
}

// Reject plan
{
  "type": "reject",
  "planId": "plan_123"
}

// Cancel execution
{
  "type": "cancel"
}
```

**Server Messages**:

Message format is compatible with SSE endpoint `/api/agent/run`:

```typescript
// Session created
{
  "type": "session",
  "sessionId": "abc-123-def",
  "traceId": "trace-456"
}

// Text content (streaming)
{
  "type": "text",
  "content": "I'll help you create..."
}

// Tool call
{
  "type": "tool_use",
  "id": "tool_use_123",
  "name": "Write",
  "input": {
    "file_path": "/path/to/file.tsx",
    "content": "..."
  }
}

// Tool result
{
  "type": "tool_result",
  "toolUseId": "tool_use_123",
  "output": "File created successfully",
  "isError": false
}

// Interactive question (AskUserQuestion)
{
  "type": "question",
  "id": "tool_use_456",
  "questions": [
    {
      "header": "Select Configuration",
      "question": "Please select your preferred configuration method:",
      "options": [
        { "label": "Default Config", "description": "Use recommended settings" },
        { "label": "Custom Config", "description": "Manually set all options" }
      ],
      "multiSelect": false
    }
  ]
}

// Plan (EnterPlanMode)
{
  "type": "plan",
  "plan": {
    "id": "plan_789",
    "goal": "Create React component",
    "steps": [
      { "id": "1", "description": "Create component file", "status": "pending" },
      { "id": "2", "description": "Add styles", "status": "pending" }
    ],
    "notes": "This is a simple component creation plan"
  }
}

// Execution result
{
  "type": "result",
  "subtype": "success",
  "cost": 0.05,
  "duration": 5000
}

// Error
{
  "type": "error",
  "message": "Execution failed:..."
}

// Done
{
  "type": "done"
}
```

**Features**:

- Interactive Q&A: Agent can ask users questions via `question` message, users reply via `answer` message
- Plan approval: Agent can send plans, users can approve or reject
- Auto-reconnect: Client can reconnect after disconnection and resume session
- SSE-compatible format: Easy to switch between WebSocket and SSE

**Example (JavaScript)**:

```javascript
const ws = new WebSocket('ws://localhost:18790/ws/agent/run?cwd=/my/project');

ws.onopen = () => {
  // Send start message
  ws.send(JSON.stringify({
    type: 'start',
    prompt: 'Please help me create a React component'
  }));
};

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);

  switch (msg.type) {
    case 'text':
      console.log('Agent:', msg.content);
      break;
    case 'question':
      // Display question to user
      console.log('Question:', msg.questions[0].question);
      // Send answer after user selection
      ws.send(JSON.stringify({
        type: 'answer',
        questionId: msg.id,
        answers: { 'question_0': 'Option A' }
      }));
      break;
    case 'done':
      console.log('Completed');
      break;
  }
};
```

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
| queue | Task queue events |

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
