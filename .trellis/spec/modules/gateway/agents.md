# 智能体 API

> `/api/agents` - 智能体管理端点

## 概述

智能体 (Agent) 是用户创建的配置，定义了：
- 使用哪个执行器 (executor_type: CLAUDE_CODE, CURSOR, etc.)
- 系统提示词、追加提示词
- 模型和参数 (temperature, max_tokens)
- MCP 服务器和技能配置

**重要概念区分**：
- **智能体 (Agent)**: 用户创建的配置文件，存储在 `.viben/agents/`，**可编辑**
- **执行器 (Executor)**: 底层 AI 工具运行时 (Claude Code, Cursor 等)，通过 `/api/executors` 管理，**只读**

智能体通过 `executor_type` 字段指定使用哪个执行器来运行。

## 端点列表

### 基础 CRUD

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/agents` | 列出所有智能体 |
| POST | `/api/agents` | 创建 Viben 智能体 |
| GET | `/api/agents/:id` | 获取智能体详情 |
| PATCH | `/api/agents/:id` | 更新 Viben 智能体 |
| DELETE | `/api/agents/:id` | 删除 Viben 智能体 |

### 默认智能体

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/agents/default` | 获取默认智能体 ID |
| PUT | `/api/agents/default` | 设置默认智能体 |

### 模板管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/agents/templates` | 列出所有模板 |
| GET | `/api/agents/templates/:id` | 获取模板详情 |
| POST | `/api/agents/templates` | 从智能体创建模板 |
| POST | `/api/agents/templates/:id/instantiate` | 从模板创建智能体 |

### 可用性检查

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/agents/:id/availability` | 检查智能体可用性 |

### 进程管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/agents/:id/spawn` | 启动智能体进程 |
| POST | `/api/agents/:id/stop` | 停止智能体进程 |

### 会话管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/agents/:id/sessions` | 列出会话 |
| POST | `/api/agents/:id/sessions` | 创建会话 |
| GET | `/api/agents/:id/sessions/:sid` | 获取会话详情 |
| DELETE | `/api/agents/:id/sessions/:sid` | 删除会话 |

### 消息管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/agents/:id/sessions/:sid/messages` | 列出消息 |
| POST | `/api/agents/:id/sessions/:sid/messages` | 添加消息 |
| GET | `/api/agents/:id/sessions/:sid/ui-messages` | 获取 UI 消息 |

### 历史记录

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/agents/:id/history` | 获取历史记录 |
| POST | `/api/agents/:id/history` | 添加历史记录 |
| GET | `/api/agents/:id/history/stats` | 获取历史统计 |
| DELETE | `/api/agents/:id/history` | 清空历史记录 |

---

## 详细说明

### GET /api/agents

列出所有用户创建的智能体。

**注意**: 此 API 只返回智能体 (agents)，不返回执行器 (executors)。
执行器通过 `/api/executors` 单独管理。

**查询参数**:

| 参数 | 类型 | 必需 | 默认 | 说明 |
|------|------|------|------|------|
| workspace_path | string | 否 | - | 工作空间路径 |
| include_global | bool | 否 | true | 是否包含全局智能体 |

**响应**:

```json
{
  "agents": [
    {
      "id": "my-agent",
      "name": "My Agent",
      "executor_type": "CLAUDE_CODE",
      "model": "claude-3-sonnet",
      "description": "A helpful coding assistant",
      "source": "global",
      "config_path": "~/.viben/agents/my-agent/config.yaml",
      "is_available": true
    },
    {
      "id": "project-helper",
      "name": "Project Helper",
      "executor_type": "CURSOR",
      "model": "gpt-4",
      "description": "Project-specific assistant",
      "source": "workspace",
      "workspace_path": "/path/to/project",
      "config_path": "/path/to/project/.viben/agents/project-helper/config.yaml",
      "is_available": true
    }
  ]
}
```

---

### POST /api/agents

创建新的 Viben 智能体。

**请求体**:

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

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| name | string | ✓ | 智能体名称 |
| id | string | 否 | 智能体 ID (自动生成) |
| description | string | 否 | 描述 |
| model | string | 否 | 模型 ID |
| provider | string | 否 | 提供商 ID |
| system_prompt | string | 否 | 系统提示词 |
| temperature | float | 否 | 温度参数 |
| max_tokens | int | 否 | 最大 token 数 |
| from_template | string | 否 | 从模板创建 |
| base_path | string | 否 | 存储路径 |

**响应**: 创建的智能体详情

---

### GET /api/agents/:id

获取智能体详情。支持 Viben 智能体和执行器智能体。

**路径参数**:
- `id`: 智能体 ID 或执行器类型 (如 `CLAUDE_CODE`)

**响应 (Viben 智能体)**:

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

**响应 (执行器智能体)**:

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

### POST /api/agents/:id/spawn

启动智能体进程。

**请求体**:

```json
{
  "prompt": "分析这段代码",
  "workdir": "/path/to/project",
  "session_id": "optional-session-id"
}
```

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| prompt | string | ✓ | 提示词 |
| workdir | string | ✓ | 工作目录 |
| session_id | string | 否 | 会话 ID |

**响应**:

```json
{
  "success": true,
  "session_id": "abc123",
  "pid": 12345
}
```

---

### POST /api/agents/:id/stop

停止智能体进程。

**请求体**:

```json
{
  "session_id": "abc123"
}
```

**响应**:

```json
{
  "success": true
}
```

---

### GET /api/agents/:id/sessions/:sid/ui-messages

获取 UI 友好的消息列表，用于前端渲染。

**响应**:

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

### GET /api/agents/:id/history

获取智能体历史记录。

**查询参数**:

| 参数 | 类型 | 必需 | 默认 | 说明 |
|------|------|------|------|------|
| limit | int | 否 | 50 | 返回记录数 |
| search | string | 否 | - | 搜索关键词 |

**响应**:

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

## 智能体存储

智能体配置存储在：
- 全局: `~/.viben/agents/<id>/config.yaml`
- 工作空间: `<workspace>/.viben/agents/<id>/config.yaml`

## 执行器类型 (executor_type)

智能体通过 `executor_type` 字段指定使用哪个执行器。**统一使用大写格式**：

| executor_type | 执行器 | 说明 |
|---------------|--------|------|
| CLAUDE_CODE | Claude Code | Anthropic Claude Code CLI |
| AMP | AMP | AMP coding agent |
| GEMINI | Gemini | Google Gemini CLI |
| CODEX | Codex | OpenAI Codex |
| CURSOR | Cursor | Cursor IDE agent |
| QWEN_CODE | Qwen Code | Qwen coding agent |
| COPILOT | Copilot | GitHub Copilot |

**注意**: 执行器本身通过 [执行器 API](./executors.md) 管理，智能体只是引用执行器类型。

---

## 相关端点

- [执行器 API](./executors.md) - 执行器管理
- [模型 API](./models.md) - 模型管理
- [会话 API](./sessions.md) - 会话管理
