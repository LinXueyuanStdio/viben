# Agent API

> `/api/agent` - Agent management endpoints

## Overview

An Agent is a user-created configuration that defines:
- Which executor to use (executor_type: CLAUDE_CODE, CURSOR, etc.)
- System prompt and append prompt
- Model and parameters (temperature, max_tokens)
- MCP servers and skills configuration

**Important Concept Distinction**:
- **Agent**: User-created configuration file, stored in `.viben/agents/`, **editable**
- **Executor**: Underlying AI tool runtime (Claude Code, Cursor, etc.), managed via `/api/executors`, **read-only**

Agents specify which executor to use via the `executor_type` field.

## Endpoint List

### Basic CRUD

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/agent` | List all agents |
| POST | `/api/agent` | Create Viben agent |
| GET | `/api/agent/:id` | Get agent details |
| PATCH | `/api/agent/:id` | Update Viben agent |
| DELETE | `/api/agent/:id` | Delete Viben agent |

### Default Agent

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/agent/default` | Get default agent ID |
| PUT | `/api/agent/default` | Set default agent |

### Template Management

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/agent/templates` | List all templates |
| GET | `/api/agent/templates/:id` | Get template details |
| POST | `/api/agent/templates` | Create template from agent |
| POST | `/api/agent/templates/:id/instantiate` | Create agent from template |

### Availability Check

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/agent/:id/availability` | Check agent availability |

### Process Management

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/agent/:id/spawn` | Start agent process |
| POST | `/api/agent/:id/stop` | Stop agent process |

### Session Management

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/agent/:id/sessions` | List sessions |
| POST | `/api/agent/:id/sessions` | Create session |
| GET | `/api/agent/:id/sessions/:sid` | Get session details |
| DELETE | `/api/agent/:id/sessions/:sid` | Delete session |

### Message Management

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/agent/:id/sessions/:sid/messages` | List messages |
| POST | `/api/agent/:id/sessions/:sid/messages` | Add message |
| GET | `/api/agent/:id/sessions/:sid/ui-messages` | Get UI messages |

### History

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/agent/:id/history` | Get history records |
| POST | `/api/agent/:id/history` | Add history record |
| GET | `/api/agent/:id/history/stats` | Get history statistics |
| DELETE | `/api/agent/:id/history` | Clear history |

---

## Detailed Description

### GET /api/agent

List all agents (Viben agents + Executor agents).

**Query Parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| workspace_path | string | No | - | Workspace path |
| include_global | bool | No | true | Include global agents |

**Response**:

```json
{
  "agents": [
    {
      "id": "my-agent",
      "name": "My Agent",
      "type": "viben",
      "model": "claude-3-sonnet",
      "provider": "anthropic",
      "is_available": true,
      "workspace_path": null,
      "is_global": true
    },
    {
      "id": "CLAUDE_CODE",
      "name": "Claude Code",
      "type": "executor",
      "is_available": true,
      "supports_mcp": true,
      "features": ["chat", "code", "tools"]
    }
  ]
}
```

---

### POST /api/agent

Create a new Viben agent.

**Request Body**:

```json
{
  "name": "My Agent",
  "id": "my-agent",
  "description": "A helpful coding assistant",
  "model": "claude-3-sonnet",
  "provider": "anthropic",
  "system_prompt": "You are a helpful assistant.",
  "temperature": 0.7,
  "max_tokens": 4096,
  "from_template": "coding-assistant",
  "base_path": "/path/to/workspace"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | string | Yes | Agent name |
| id | string | No | Agent ID (auto-generated) |
| description | string | No | Description |
| model | string | No | Model ID |
| provider | string | No | Provider ID |
| system_prompt | string | No | System prompt |
| temperature | float | No | Temperature parameter |
| max_tokens | int | No | Maximum tokens |
| from_template | string | No | Create from template |
| base_path | string | No | Storage path |

**Response**: Created agent details

---

### GET /api/agent/:id

Get agent details. Supports both Viben agents and Executor agents.

**Path Parameters**:
- `id`: Agent ID or Executor type (e.g., `CLAUDE_CODE`)

**Response (Viben Agent)**:

```json
{
  "id": "my-agent",
  "name": "My Agent",
  "description": "A helpful assistant",
  "model": "claude-3-sonnet",
  "provider": "anthropic",
  "system_prompt": "You are helpful.",
  "temperature": 0.7,
  "max_tokens": 4096,
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-01T00:00:00Z"
}
```

**Response (Executor Agent)**:

```json
{
  "id": "CLAUDE_CODE",
  "name": "Claude Code",
  "type": "executor",
  "is_available": true,
  "availability": {
    "available": true,
    "reason": null
  },
  "supports_mcp": true,
  "features": ["chat", "code", "tools", "streaming"]
}
```

---

### POST /api/agent/:id/spawn

Start an agent process.

**Request Body**:

```json
{
  "prompt": "Analyze this code",
  "workdir": "/path/to/project",
  "session_id": "optional-session-id"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| prompt | string | Yes | Prompt |
| workdir | string | Yes | Working directory |
| session_id | string | No | Session ID |

**Response**:

```json
{
  "success": true,
  "session_id": "abc123",
  "pid": 12345
}
```

---

### POST /api/agent/:id/stop

Stop an agent process.

**Request Body**:

```json
{
  "session_id": "abc123"
}
```

**Response**:

```json
{
  "success": true
}
```

---

### GET /api/agent/:id/sessions/:sid/ui-messages

Get UI-friendly message list for frontend rendering.

**Response**:

```json
{
  "messages": [
    {
      "id": "msg-1",
      "role": "user",
      "content": "Hello",
      "timestamp": "2024-01-01T10:00:00Z"
    },
    {
      "id": "msg-2",
      "role": "assistant",
      "content": "Hi! How can I help?",
      "timestamp": "2024-01-01T10:00:05Z",
      "tool_calls": []
    }
  ]
}
```

---

### GET /api/agent/:id/history

Get agent history records.

**Query Parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| limit | int | No | 50 | Number of records to return |
| search | string | No | - | Search keyword |

**Response**:

```json
{
  "records": [
    {
      "id": "record-1",
      "prompt": "Write a function",
      "response_preview": "Here's a function...",
      "created_at": "2024-01-01T10:00:00Z",
      "tokens": {
        "input": 50,
        "output": 200
      }
    }
  ],
  "total": 100
}
```

---

## Agent Types

### Viben Agents

User-defined agents stored in:
- Global: `~/.viben/agents/<id>/config.yaml`
- Workspace: `<workspace>/.viben/agents/<id>/config.yaml`

### Executor Agents

Based on executor types, available types:

| ID | Name | Description |
|----|------|-------------|
| CLAUDE_CODE | Claude Code | Anthropic Claude Code CLI |
| AMP | AMP | AMP coding agent |
| GEMINI | Gemini | Google Gemini |
| CODEX | Codex | OpenAI Codex |
| OPENCODE | OpenCode | OpenCode agent |
| CURSOR_AGENT | Cursor | Cursor IDE agent |
| QWEN_CODE | Qwen Code | Qwen coding agent |
| COPILOT | Copilot | GitHub Copilot |
| DROID | Droid | Droid agent |

---

## Related Endpoints

- [Executor API](./executors.md) - Executor management
- [Model API](./models.md) - Model management
- [Session API](./sessions.md) - Session management
