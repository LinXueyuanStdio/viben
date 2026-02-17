# 执行器 API

> `/api/executors` - 执行器管理端点

## 概述

执行器是底层的 AI coding agent 运行时，如 Claude Code、Gemini 等。执行器 API 提供执行器发现、可用性检查和会话管理功能。

## 端点列表

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/executors` | 列出可用执行器 |
| GET | `/api/executors/:type/discover-sessions` | 发现执行器会话 |
| GET | `/api/executors/:type/sessions/:sid/messages` | 读取会话消息 |

---

## 详细说明

### GET /api/executors

列出所有可用执行器及其状态。

**查询参数**:

| 参数 | 类型 | 必需 | 默认 | 说明 |
|------|------|------|------|------|
| workspace_path | string | 否 | - | 工作空间路径 |
| include_global | bool | 否 | true | 是否包含全局配置 |

**响应**:

```json
{
  "executors": [
    {
      "type": "CLAUDE_CODE",
      "name": "Claude Code",
      "description": "Anthropic Claude Code CLI",
      "is_available": true,
      "availability": {
        "available": true,
        "reason": null,
        "version": "1.0.0"
      },
      "supports_mcp": true,
      "supports_streaming": true,
      "supports_tools": true,
      "features": ["chat", "code", "tools", "streaming", "mcp"]
    },
    {
      "type": "GEMINI",
      "name": "Gemini",
      "description": "Google Gemini CLI",
      "is_available": false,
      "availability": {
        "available": false,
        "reason": "CLI not installed"
      }
    }
  ]
}
```

---

### GET /api/executors/:type/discover-sessions

发现指定执行器类型的已有会话。

**路径参数**:
- `type`: 执行器类型，**必须使用大写下划线格式** (如 `CLAUDE_CODE`, `CODEX`)

**查询参数**:

| 参数 | 类型 | 必需 | 默认 | 说明 |
|------|------|------|------|------|
| workspace_path | string | 否 | - | 限定工作空间路径 |

**响应**:

```json
{
  "sessions": [
    {
      "session_id": "abc123",
      "workspace_path": "/path/to/project",
      "created_at": "2024-01-01T10:00:00Z",
      "last_active": "2024-01-01T14:30:00Z",
      "message_count": 42,
      "title": "Feature implementation"
    }
  ]
}
```

**会话存储位置**:

| 执行器 | 存储路径 |
|--------|----------|
| CLAUDE_CODE | `~/.claude/projects/<encoded-path>/<session-id>.jsonl` |
| CODEX | `~/.codex/sessions/<session-id>/` |

---

### GET /api/executors/:type/sessions/:sid/messages

读取执行器会话的消息历史。

**路径参数**:
- `type`: 执行器类型
- `sid`: 会话 ID

**查询参数**:

| 参数 | 类型 | 必需 | 默认 | 说明 |
|------|------|------|------|------|
| workspace_path | string | 否 | - | 工作空间路径 |
| include_subagents | bool | 否 | true | 是否包含子智能体消息 |

**响应**:

```json
{
  "messages": [
    {
      "id": "msg-1",
      "role": "user",
      "content": "Analyze this code",
      "timestamp": "2024-01-01T10:00:00Z"
    },
    {
      "id": "msg-2",
      "role": "assistant",
      "content": "I'll analyze the code...",
      "timestamp": "2024-01-01T10:00:05Z",
      "tool_calls": [
        {
          "type": "Task",
          "subagent_type": "Explore",
          "status": "completed",
          "result": "..."
        }
      ]
    }
  ],
  "subagent_messages": {
    "task-abc123": [
      {
        "id": "sub-msg-1",
        "role": "assistant",
        "content": "Exploring codebase..."
      }
    ]
  }
}
```

**子智能体消息**:

当 `include_subagents=true` 时，会递归加载 Task 工具调用产生的子智能体会话消息。这对于理解复杂的多智能体交互非常有用。

---

## 执行器类型

| 类型 | 名称 | CLI 命令 | MCP 支持 |
|------|------|----------|----------|
| CLAUDE_CODE | Claude Code | `claude` | ✓ |
| AMP | AMP | `amp` | ✓ |
| GEMINI | Gemini | `gemini` | - |
| CODEX | Codex | `codex` | - |
| OPENCODE | OpenCode | `opencode` | - |
| CURSOR_AGENT | Cursor | `cursor` | ✓ |
| QWEN_CODE | Qwen Code | `qwen` | - |
| COPILOT | Copilot | `copilot` | - |
| DROID | Droid | `droid` | - |

---

## 可用性检查

执行器可用性检查逻辑：

1. 检查 CLI 命令是否存在于 PATH
2. 检查必要的配置文件是否存在
3. 检查 API 密钥是否配置 (如需要)

```json
{
  "available": true,
  "reason": null,
  "version": "1.0.0",
  "cli_path": "/usr/local/bin/claude"
}
```

```json
{
  "available": false,
  "reason": "CLI not found in PATH",
  "suggestion": "Install with: npm install -g @anthropic-ai/claude-code"
}
```

---

## 相关端点

- [智能体 API](./agents.md) - 智能体管理
- [会话 API](./sessions.md) - 会话管理
