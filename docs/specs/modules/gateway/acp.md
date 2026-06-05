# Gateway ACP WebSocket 协议

> `/ws/agent/acp` - 通过 WebSocket 暴露 Viben Gateway 的 ACP 兼容智能体端点

## 概述

`/ws/agent/acp` 是 Viben Gateway 面向 ACP Client 的实时协议入口。客户端连接后，通过 JSON-RPC 2.0 调用 `initialize`、`session/new`、`session/prompt` 等 ACP 方法；Gateway 在内部启动或复用底层 ACP Backend（例如 Claude Code、Gemini、Codex、OpenCode 等），并把后端的 `session/update`、权限请求和客户端工具调用转发回客户端。

该端点和 `/ws/agent/run` 的职责不同：

| 端点 | 协议 | 适用场景 |
|------|------|----------|
| `/ws/agent/run` | Viben 自定义消息格式 | Viben Web/Desktop 旧执行流，消息以 `type` 区分 |
| `/ws/agent/acp` | ACP JSON-RPC 2.0 | ACP UI、外部编辑器、可互操作 Agent Client |

---

## 连接信息

### GET /ws/agent/acp

WebSocket Upgrade 后，连接上的每个文本帧承载一个或多个 JSON-RPC 消息。Gateway 写出时始终使用换行分隔 JSON 帧；读取时同时支持：

- 单个文本帧就是一个完整 JSON 对象。
- 一个文本帧包含多行 NDJSON，每一行是一个完整 JSON 对象。

**查询参数**:

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `cwd` | string | 否 | 会话工作目录；未提供时使用 Gateway 进程当前目录 |
| `agent_config_path` | string | 否 | 智能体 Markdown 配置文件路径，例如 `/repo/.viben/agents/coder/AGENTS.md` |
| `agent_dir` | string | 否 | 会话持久化读取智能体目录时使用 |
| `session_id` | string | 否 | Viben 外层持久化会话 ID，用于写入 UI 消息和原始 ACP 消息 |
| `task_id` | string | 否 | Viben 外层任务 ID，用于写入 UI 消息 |
| `gateway_url` | string | 否 | 注入给后端 MCP/工具的 Gateway 地址 |

**示例**:

```text
ws://127.0.0.1:18790/ws/agent/acp?cwd=/repo&agent_config_path=/repo/.viben/agents/coder/AGENTS.md&session_id=sess_1&task_id=task_1
```

**子协议**:

客户端可以声明 `acp.v1` 子协议。Gateway 当前不依赖子协议完成路由，协议版本以 `initialize` 的 `protocolVersion` 为准。

**认证**:

Gateway 当前没有在该路由实现独立认证；如果部署环境需要认证，应由上游 Gateway 中间件、反向代理或 WebSocket 握手层处理。

---

## JSON-RPC 基础格式

所有消息都必须是 JSON-RPC 2.0 对象。

**请求**:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "session/prompt",
  "params": {}
}
```

**响应**:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {}
}
```

**错误响应**:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32602,
    "message": "Invalid params: session/prompt requires sessionId and prompt",
    "data": {}
  }
}
```

**通知**:

```json
{
  "jsonrpc": "2.0",
  "method": "session/cancel",
  "params": {
    "sessionId": "acp-session-id"
  }
}
```

**错误码**:

| code | 含义 | 典型来源 |
|------|------|----------|
| `-32700` | Parse error | WebSocket 收到不可解析 JSON |
| `-32600` | Invalid request | JSON-RPC 对象结构非法 |
| `-32601` | Method not found | 调用了未实现方法，例如 `session/set_mode` |
| `-32602` | Invalid params | 参数缺失或 schema 校验失败 |
| `-32603` | Internal error | 后端执行器启动、运行或工具调用失败 |
| `-32000` | Authentication required | ACP 后端要求认证时可能返回 |
| `-32002` | Resource not found | 文件或资源不存在时可能返回 |

---

## 方法总览

### Client -> Gateway 请求

| 方法 | JSON-RPC 类型 | Gateway 支持 | 说明 |
|------|---------------|--------------|------|
| `initialize` | request | 是 | 协商 ACP 版本、能力和认证方式 |
| `authenticate` | request | 是 | 当前返回空对象；Gateway 不声明 `authMethods` |
| `session/new` | request | 是 | 创建 Viben 外层 ACP 会话 |
| `session/load` | request | 是 | 复用或加载指定外层 ACP 会话 |
| `session/list` | request | 是 | 列出当前 Gateway 进程内 ACP 会话 |
| `session/close` | request | 是 | 关闭外层会话并释放后端进程 |
| `session/prompt` | request | 是 | 发送一轮用户 prompt，响应在该轮结束后返回 |
| `session/cancel` | notification | 是 | 取消指定会话当前运行 prompt 和排队 prompt |
| `session/set_mode` | request | 否 | 未在 Gateway Agent 接口实现，返回 `-32601` |
| `session/set_model` | request | 否 | 未在 Gateway Agent 接口实现，返回 `-32601` |
| `session/set_config_option` | request | 否 | 未在 Gateway Agent 接口实现，返回 `-32601` |
| `session/fork` | request | 否 | 未实现，返回 `-32601` |
| `session/resume` | request | 否 | 未实现，返回 `-32601` |
| `logout` | request | 否 | 未实现，返回 `-32601` |
| 其他方法 | request/notification | 视情况 | SDK 会尝试走扩展方法；当前 Gateway Agent 未实现扩展处理 |

### Gateway -> Client 请求或通知

| 方法 | JSON-RPC 类型 | 触发条件 | 说明 |
|------|---------------|----------|------|
| `session/update` | notification | 后端产生流式内容、工具调用、计划、用量等更新 | 客户端必须按 `sessionId` 归并到对应会话 |
| `session/request_permission` | request | 后端执行敏感工具前需要用户授权 | 客户端必须返回 selected 或 cancelled |
| `_viben/client_tool_call` | request | 后端请求客户端侧工具，或 Viben 拦截到客户端侧 MCP 工具 | Viben 扩展方法，结果使用 MCP `CallToolResult` 形态 |
| `fs/read_text_file` | request | 后端直接请求客户端文件读取 | 仅客户端声明并实现 `fs.readTextFile` 时可用 |
| `fs/write_text_file` | request | 后端直接请求客户端文件写入 | 仅客户端声明并实现 `fs.writeTextFile` 时可用 |
| `terminal/*` | request | 后端请求客户端终端能力 | Viben Gateway 给内层后端声明 `terminal: false`，通常不会出现 |
| 其他扩展方法 | request/notification | 后端透传扩展 | 客户端应按能力或方法名决定是否处理 |

### 心跳

客户端可以发送 JSON-RPC 通知 `$/ping` 作为应用层心跳：

```json
{"jsonrpc":"2.0","method":"$/ping"}
```

这是通知，不带 `id`。Gateway 当前没有实现该扩展通知处理；按 JSON-RPC 通知语义，客户端不应等待响应。若未来严格校验未知通知，应保持对 `$/` 命名空间的静默忽略。

---

## initialize

客户端连接后必须先调用 `initialize`。

**请求**:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": 1,
    "clientInfo": {
      "name": "acp-ui",
      "version": "1.0.0"
    },
    "clientCapabilities": {
      "fs": {
        "readTextFile": false,
        "writeTextFile": false
      },
      "terminal": false,
      "_meta": {
        "_vibenClientTools": true
      }
    }
  }
}
```

**响应**:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "protocolVersion": 1,
    "agentInfo": {
      "name": "viben",
      "title": "Viben Gateway",
      "version": "1.0.0"
    },
    "agentCapabilities": {
      "loadSession": true,
      "sessionCapabilities": {
        "list": {},
        "close": {}
      },
      "promptCapabilities": {
        "embeddedContext": false,
        "image": false,
        "audio": false
      },
      "_meta": {
        "_vibenClientTools": true
      }
    },
    "authMethods": []
  }
}
```

**规则**:

- `protocolVersion` 当前来自 `@agentclientprotocol/sdk`，现行为 `1`。
- `authMethods` 为空表示 Gateway 本身不需要 ACP 认证。
- `promptCapabilities.image/audio/embeddedContext` 均为 `false`；客户端应只发送文本或基础 resource link。Viben 当前执行 prompt 时只把 `type: "text"` 的内容块拼成文本交给后端。

---

## session/new

创建一个新的外层 ACP 会话。此时 Gateway 只创建会话记录，不一定立刻启动后端进程；后端通常在第一次 `session/prompt` 时启动。

**请求**:

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "session/new",
  "params": {
    "cwd": "/repo",
    "mcpServers": [],
    "agent_config": {
      "name": "coder",
      "executor_type": "CLAUDE_CODE",
      "model": "claude-sonnet-4-20250514",
      "system_prompt": "你是一个编码智能体。",
      "mcp_servers": [],
      "permission_mode": "acceptEdits"
    },
    "persist_session_id": "ui-session-1",
    "persist_task_id": "task-1",
    "gateway_url": "http://127.0.0.1:18790"
  }
}
```

**响应**:

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "sessionId": "9b0d8286-1f9a-45ea-b818-e6270c620062"
  }
}
```

**标准字段**:

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `cwd` | string | 是 | 会话工作目录，建议绝对路径 |
| `mcpServers` | array | 是 | ACP MCP server 列表 |

**Viben 扩展字段**:

| 字段 | 类型 | 说明 |
|------|------|------|
| `agent_config` | object | 内联智能体配置，优先于只靠查询参数 |
| `agent_config_path` | string | 智能体 Markdown 配置路径；未传时回退查询参数 |
| `agent_dir` | string | 会话存储智能体目录；未传时回退查询参数 |
| `persist_session_id` | string | Viben UI 会话 ID；用于持久化 UI 消息 |
| `persist_task_id` | string | Viben 任务 ID；用于持久化 UI 消息 |
| `gateway_url` | string | 传给后端 MCP/工具的 Gateway 地址 |
| `sandbox_config` | object | 沙箱配置，例如 `{ "enabled": true, "provider": "native" }` |

> 兼容性：代码中同时接受 camelCase 和 snake_case 版本，例如 `agentConfig` 与 `agent_config`。Gateway API 和文件存储规范要求新客户端使用 snake_case。

**AgentConfigPayload 字段**:

```json
{
  "name": "coder",
  "model": "claude-sonnet-4-20250514",
  "provider": "anthropic",
  "system_prompt": "完整系统提示词",
  "append_prompt": "追加提示词",
  "temperature": 0.2,
  "max_tokens": 4096,
  "executor_type": "CLAUDE_CODE",
  "executor_config": {},
  "mcp_servers": [],
  "skills": [],
  "plan_mode": false,
  "approvals": true,
  "dangerously_skip_permissions": false,
  "permission_mode": "acceptEdits"
}
```

**后端选择**:

`executor_type` 决定内层 ACP Backend。常见值包括 `CLAUDE_CODE`、`CLAUDE`、`GEMINI`、`CODEX`、`OPENCODE`、`OPENCLAW`、`QWEN_CODE`、`COPILOT`、`CURSOR` 等。未提供时默认使用 `CLAUDE_CODE`。

---

## session/load

加载指定外层 ACP 会话。若该外层会话仍在内存中，Gateway 更新连接并返回原会话；若不存在，则用请求中的 `sessionId` 创建一个新的外层会话，并把同一个 ID 作为后端加载目标。

**请求**:

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "session/load",
  "params": {
    "sessionId": "9b0d8286-1f9a-45ea-b818-e6270c620062",
    "cwd": "/repo",
    "mcpServers": [],
    "agent_config_path": "/repo/.viben/agents/coder/AGENTS.md"
  }
}
```

**响应**:

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "result": {
    "sessionId": "9b0d8286-1f9a-45ea-b818-e6270c620062"
  }
}
```

**错误 case**:

如果缺少 `sessionId`，返回 `-32602`：

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "error": {
    "code": -32602,
    "message": "Invalid params: session/load requires sessionId",
    "data": {
      "request": {}
    }
  }
}
```

---

## session/list

列出当前 Gateway 进程内存中的外层 ACP 会话。

**请求**:

```json
{
  "jsonrpc": "2.0",
  "id": 4,
  "method": "session/list",
  "params": {
    "cwd": "/repo"
  }
}
```

**响应**:

```json
{
  "jsonrpc": "2.0",
  "id": 4,
  "result": {
    "sessions": [
      {
        "sessionId": "9b0d8286-1f9a-45ea-b818-e6270c620062",
        "cwd": "/repo",
        "title": "Viben Gateway",
        "updatedAt": "2026-06-05T12:00:00.000Z"
      }
    ]
  }
}
```

**注意**:

- 当前实现没有按 `cwd` 过滤，也没有分页；会返回进程内全部外层 ACP 会话。
- `title` 来自会话能力 `_meta.title`，通常可能为空。

---

## session/close

关闭指定外层会话，释放后端 ACP 连接和子进程，并从当前 WebSocket 连接的 owned sessions 集合中移除。

**请求**:

```json
{
  "jsonrpc": "2.0",
  "id": 5,
  "method": "session/close",
  "params": {
    "sessionId": "9b0d8286-1f9a-45ea-b818-e6270c620062"
  }
}
```

**响应**:

```json
{
  "jsonrpc": "2.0",
  "id": 5,
  "result": {}
}
```

**连接关闭清理**:

WebSocket 断开时，Gateway 会自动关闭该连接创建或加载过的所有 owned sessions。

---

## authenticate

Gateway 当前声明 `authMethods: []`，通常客户端不需要调用 `authenticate`。

**请求**:

```json
{
  "jsonrpc": "2.0",
  "id": 6,
  "method": "authenticate",
  "params": {
    "methodId": "unused"
  }
}
```

**响应**:

```json
{
  "jsonrpc": "2.0",
  "id": 6,
  "result": {}
}
```

---

## session/prompt

向会话发送一轮用户输入。`session/prompt` 是长请求：Gateway 会在请求未返回期间持续向客户端发送 `session/update` 通知；直到后端结束、取消或出错后才返回 `PromptResponse` 或错误响应。

**请求**:

```json
{
  "jsonrpc": "2.0",
  "id": 7,
  "method": "session/prompt",
  "params": {
    "sessionId": "9b0d8286-1f9a-45ea-b818-e6270c620062",
    "prompt": [
      {
        "type": "text",
        "text": "请实现登录页并补充测试。"
      }
    ]
  }
}
```

**成功响应**:

```json
{
  "jsonrpc": "2.0",
  "id": 7,
  "result": {
    "stopReason": "end_turn",
    "usage": {
      "inputTokens": 1200,
      "outputTokens": 900,
      "totalTokens": 2100
    }
  }
}
```

**stopReason**:

| 值 | 说明 |
|----|------|
| `end_turn` | 正常结束 |
| `max_tokens` | 达到输出上限 |
| `max_turn_requests` | 达到本轮请求上限 |
| `refusal` | 模型拒绝 |
| `cancelled` | 用户取消 |
| `error` | Viben 扩展，内部错误时可能出现在会话状态或封装响应中 |

**规则**:

- `sessionId` 必须存在。
- `prompt` 必须是数组。
- Viben 当前只把 `type: "text"` 且含 `text` 的内容块拼接为纯文本；其他内容块不会进入底层 prompt 文本。
- 若同一会话已有 `session/prompt` 正在运行，后续 prompt 会进入 FIFO 队列，前一轮结束后自动执行。
- 用户 prompt 会持久化为 UI 消息；后端 `session/update` 会按可识别类型持久化为 UI 消息和 raw ACP 消息。

**错误 case**:

```json
{
  "jsonrpc": "2.0",
  "id": 7,
  "error": {
    "code": -32602,
    "message": "Invalid params: session/prompt requires sessionId and prompt",
    "data": {
      "request": {
        "sessionId": "9b0d8286-1f9a-45ea-b818-e6270c620062"
      }
    }
  }
}
```

---

## session/cancel

取消指定会话的当前 prompt 和排队 prompt。

**通知**:

```json
{
  "jsonrpc": "2.0",
  "method": "session/cancel",
  "params": {
    "sessionId": "9b0d8286-1f9a-45ea-b818-e6270c620062"
  }
}
```

**规则**:

- 这是通知，没有响应。
- Gateway 会将会话状态置为 `cancelled`。
- 排队中的 prompt 会立即以 `{ "stopReason": "cancelled" }` 完成。
- 如果内层后端已经启动，Gateway 会继续转发 cancel 给内层 ACP Backend。
- 客户端在发送取消后仍应继续接收最终的 `session/update`，直到原 `session/prompt` 请求收到 `stopReason: "cancelled"` 或错误响应。

---

## session/update

Gateway 用 `session/update` 通知向客户端报告智能体输出、工具调用、计划、用量和会话信息。

**通用格式**:

```json
{
  "jsonrpc": "2.0",
  "method": "session/update",
  "params": {
    "sessionId": "9b0d8286-1f9a-45ea-b818-e6270c620062",
    "update": {
      "sessionUpdate": "agent_message_chunk",
      "content": {
        "type": "text",
        "text": "我会先检查现有登录模块。"
      }
    }
  }
}
```

### agent_message_chunk

智能体对用户可见的回复片段。

```json
{
  "sessionUpdate": "agent_message_chunk",
  "content": {
    "type": "text",
    "text": "已创建登录页组件。"
  }
}
```

### agent_thought_chunk

智能体思考片段。客户端可按产品策略决定是否展示。

```json
{
  "sessionUpdate": "agent_thought_chunk",
  "content": {
    "type": "text",
    "text": "需要先确认路由结构。"
  }
}
```

### user_message_chunk

会话回放时可能出现的用户消息片段。

```json
{
  "sessionUpdate": "user_message_chunk",
  "content": {
    "type": "text",
    "text": "请实现登录页。"
  }
}
```

### tool_call

工具调用开始或全量状态。

```json
{
  "sessionUpdate": "tool_call",
  "toolCallId": "toolu_01",
  "title": "Write",
  "kind": "edit",
  "status": "pending",
  "locations": [
    {
      "path": "/repo/apps/web/app/login/page.tsx",
      "line": 1
    }
  ],
  "rawInput": {
    "file_path": "/repo/apps/web/app/login/page.tsx"
  }
}
```

Viben 持久化时会把 `tool_call` 映射为 UI `tool_use` 消息。若 `title` 是客户端侧工具名，且不是 `mcp__gui_action__GUI_execute`，Gateway 可能随后发起 `_viben/client_tool_call` 请求。

### tool_call_update

工具调用增量更新或结果。

```json
{
  "sessionUpdate": "tool_call_update",
  "toolCallId": "toolu_01",
  "status": "completed",
  "rawOutput": "File written successfully"
}
```

`status` 可为 `pending`、`in_progress`、`completed`、`failed`。

### plan

计划更新。

```json
{
  "sessionUpdate": "plan",
  "entries": [
    {
      "content": "检查现有登录页面",
      "status": "completed",
      "priority": "high"
    },
    {
      "content": "实现表单和校验",
      "status": "in_progress",
      "priority": "high"
    }
  ]
}
```

### session_info_update

会话元信息更新。

```json
{
  "sessionUpdate": "session_info_update",
  "title": "实现登录页",
  "updatedAt": "2026-06-05T12:00:00.000Z"
}
```

如果 `session_info_update` 或 `_meta.sessionId` 中携带后端 SDK session ID，Viben 会持久化为 `sdk_session` UI 消息。

### usage_update

上下文窗口、成本或用量更新。

```json
{
  "sessionUpdate": "usage_update",
  "used": 7200,
  "size": 200000,
  "cost": {
    "amount": 0.12,
    "currency": "USD"
  }
}
```

### current_mode_update

后端模式变化。

```json
{
  "sessionUpdate": "current_mode_update",
  "currentModeId": "code"
}
```

### config_option_update

后端配置项变化。

```json
{
  "sessionUpdate": "config_option_update",
  "configOptions": [
    {
      "id": "model",
      "name": "Model",
      "type": "select",
      "category": "model",
      "currentValue": "claude-sonnet-4-20250514",
      "options": {
        "values": [
          {
            "value": "claude-sonnet-4-20250514",
            "name": "Claude Sonnet 4"
          }
        ]
      }
    }
  ]
}
```

### available_commands_update

后端可用命令变化。

```json
{
  "sessionUpdate": "available_commands_update",
  "availableCommands": [
    {
      "name": "review",
      "description": "Review the current changes"
    }
  ]
}
```

### error

Viben 扩展更新。当后端启动或执行失败时，Gateway 会先尝试发一条错误更新，再让原 `session/prompt` 请求以 `-32603` 失败。

```json
{
  "sessionUpdate": "error",
  "error": {
    "message": "ACP backend prompt failed",
    "name": "Error",
    "stderr": "...",
    "exitCode": 1,
    "command": "claude-agent-acp",
    "cwd": "/repo"
  }
}
```

---

## session/request_permission

当后端需要用户批准工具调用时，Gateway 会向客户端发送请求。

**请求**:

```json
{
  "jsonrpc": "2.0",
  "id": "perm-1",
  "method": "session/request_permission",
  "params": {
    "sessionId": "9b0d8286-1f9a-45ea-b818-e6270c620062",
    "toolCall": {
      "toolCallId": "toolu_01",
      "title": "Write /repo/apps/web/app/login/page.tsx",
      "kind": "edit",
      "status": "pending",
      "locations": [
        {
          "path": "/repo/apps/web/app/login/page.tsx"
        }
      ]
    },
    "options": [
      {
        "optionId": "allow_once",
        "name": "Allow once",
        "kind": "allow_once"
      },
      {
        "optionId": "reject_once",
        "name": "Reject",
        "kind": "reject_once"
      }
    ]
  }
}
```

**允许响应**:

```json
{
  "jsonrpc": "2.0",
  "id": "perm-1",
  "result": {
    "outcome": {
      "outcome": "selected",
      "optionId": "allow_once"
    }
  }
}
```

**取消响应**:

```json
{
  "jsonrpc": "2.0",
  "id": "perm-1",
  "result": {
    "outcome": {
      "outcome": "cancelled"
    }
  }
}
```

**规则**:

- 客户端必须回复该请求，否则后端工具调用会一直等待。
- 如果用户在权限弹窗期间取消当前 turn，客户端应先回复 `outcome: cancelled`，再发送或已发送 `session/cancel`。
- Gateway 会把内层后端的 `sessionId` 改写为外层 `sessionId` 后再发给客户端。

---

## _viben/client_tool_call

这是 Viben 扩展请求，用于把某些工具调用交给客户端执行。典型场景是后端产生客户端侧 MCP 工具调用，Gateway 需要 UI/浏览器完成实际动作，然后把结果写回等待中的工具调用。

**请求**:

```json
{
  "jsonrpc": "2.0",
  "id": "client-tool-1",
  "method": "_viben/client_tool_call",
  "params": {
    "sessionId": "9b0d8286-1f9a-45ea-b818-e6270c620062",
    "toolUseId": "toolu_02",
    "toolName": "GUI_execute",
    "input": {
      "action": "click",
      "selector": "button[type=submit]"
    }
  }
}
```

**响应**:

```json
{
  "jsonrpc": "2.0",
  "id": "client-tool-1",
  "result": {
    "content": [
      {
        "type": "text",
        "text": "Clicked submit button"
      }
    ],
    "isError": false
  }
}
```

**错误响应**:

```json
{
  "jsonrpc": "2.0",
  "id": "client-tool-1",
  "result": {
    "content": [
      {
        "type": "text",
        "text": "Client tool failed: selector not found"
      }
    ],
    "isError": true
  }
}
```

**规则**:

- 响应采用 MCP `CallToolResult` 形态：`content` 数组必需，`isError` 可选。
- 如果客户端返回非 `CallToolResult`，Gateway 会把字符串或 JSON 序列化结果包装成一条 text content。
- Gateway 当前为 `GUI_execute` 注册 60 秒等待时间；超时或取消会让等待中的工具结果失败。
- 客户端不支持该扩展时，应返回 JSON-RPC `-32601`。这会被视为工具失败，而不是协议连接失败。

---

## fs/read_text_file 与 fs/write_text_file

这些是 ACP 标准客户端文件系统请求。Viben Gateway 作为外层 Agent 可能直接向客户端发起，内层后端也可能通过透传触发。

### fs/read_text_file

**请求**:

```json
{
  "jsonrpc": "2.0",
  "id": "fs-1",
  "method": "fs/read_text_file",
  "params": {
    "sessionId": "9b0d8286-1f9a-45ea-b818-e6270c620062",
    "path": "/repo/README.md",
    "line": 1,
    "limit": 20
  }
}
```

**响应**:

```json
{
  "jsonrpc": "2.0",
  "id": "fs-1",
  "result": {
    "content": "# Project\n\n..."
  }
}
```

### fs/write_text_file

**请求**:

```json
{
  "jsonrpc": "2.0",
  "id": "fs-2",
  "method": "fs/write_text_file",
  "params": {
    "sessionId": "9b0d8286-1f9a-45ea-b818-e6270c620062",
    "path": "/repo/tmp.txt",
    "content": "hello"
  }
}
```

**响应**:

```json
{
  "jsonrpc": "2.0",
  "id": "fs-2",
  "result": {}
}
```

**规则**:

- 客户端必须只在自己确实能访问 host 文件系统时声明 `fs.readTextFile` 或 `fs.writeTextFile`。
- Web 和移动端客户端通常应声明为 `false`，收到请求时返回 `-32601 Method not found`。
- 对远程 ACP Agent，`path` 的语义属于客户端实现；不要默认把远程路径映射到浏览器本地。

---

## 未实现的 Agent 方法

Gateway 的 `initialize` 没有声明以下能力，因此客户端默认不应调用：

| 方法 | 预期响应 |
|------|----------|
| `session/set_mode` | `-32601 Method not found` |
| `session/set_model` | `-32601 Method not found` |
| `session/set_config_option` | `-32601 Method not found` |
| `session/fork` | `-32601 Method not found` |
| `session/resume` | `-32601 Method not found` |
| `logout` | `-32601 Method not found` |

示例：

```json
{
  "jsonrpc": "2.0",
  "id": 20,
  "error": {
    "code": -32601,
    "message": "\"Method not found\": session/set_mode",
    "data": {
      "method": "session/set_mode"
    }
  }
}
```

---

## 时序

### Case 1: 新建会话并完成一轮 prompt

```mermaid
sequenceDiagram
  participant C as ACP Client
  participant G as Viben Gateway /ws/agent/acp
  participant B as ACP Backend

  C->>G: WebSocket connect
  C->>G: request initialize
  G-->>C: initialize result
  C->>G: request session/new
  G-->>C: sessionId
  C->>G: request session/prompt
  G->>B: start backend process
  G->>B: initialize
  B-->>G: backend capabilities
  G->>B: session/new or session/load
  B-->>G: backend sessionId
  G->>B: session/prompt
  B-->>G: session/update chunks
  G-->>C: session/update chunks
  B-->>G: prompt result stopReason=end_turn
  G-->>C: session/prompt result
```

关键点：

- 外层 `sessionId` 由 Gateway 生成，客户端始终使用这个 ID。
- 内层后端可能返回另一个 backend session ID，Gateway 会隐藏并映射。
- `session/prompt` 响应只表示该轮完成，不承载完整输出；完整输出来自之前的 `session/update`。

### Case 2: 权限请求

```mermaid
sequenceDiagram
  participant C as ACP Client
  participant G as Viben Gateway
  participant B as ACP Backend

  C->>G: request session/prompt
  G->>B: session/prompt
  B-->>G: session/update tool_call pending
  G-->>C: session/update tool_call pending
  B->>G: request session/request_permission
  G->>C: request session/request_permission
  C-->>G: selected allow_once
  G-->>B: selected allow_once
  B-->>G: session/update tool_call_update completed
  G-->>C: session/update tool_call_update completed
  B-->>G: prompt result
  G-->>C: prompt result
```

关键点：

- 权限请求是 Gateway -> Client 的 JSON-RPC request，必须有响应。
- 用户取消权限时返回 `outcome: cancelled`，不应让请求悬挂。

### Case 3: 取消运行中的 prompt

```mermaid
sequenceDiagram
  participant C as ACP Client
  participant G as Viben Gateway
  participant B as ACP Backend

  C->>G: request session/prompt id=7
  G->>B: session/prompt
  B-->>G: session/update ...
  G-->>C: session/update ...
  C->>G: notification session/cancel
  G->>B: notification session/cancel
  B-->>G: final session/update
  G-->>C: final session/update
  B-->>G: prompt result stopReason=cancelled
  G-->>C: response id=7 stopReason=cancelled
```

关键点：

- `session/cancel` 本身不返回。
- 客户端不要在发出 cancel 后立即丢弃连接；应等待原 `session/prompt` 结束。
- 如果同一会话有排队 prompt，Gateway 会直接用 `stopReason: cancelled` 结束这些排队项。

### Case 4: 客户端侧工具调用

```mermaid
sequenceDiagram
  participant C as ACP Client
  participant G as Viben Gateway
  participant B as ACP Backend

  C->>G: request session/prompt
  G->>B: session/prompt
  B-->>G: session/update tool_call title=GUI_execute
  G->>C: request _viben/client_tool_call
  C-->>G: MCP CallToolResult
  G-->>B: complete client-side tool result
  B-->>G: session/update tool_call_update
  G-->>C: session/update tool_call_update
  B-->>G: prompt result
  G-->>C: prompt result
```

关键点：

- `_viben/client_tool_call` 是 Viben 扩展，不属于 ACP 标准方法。
- 客户端应按 `toolUseId` 做幂等处理；重复响应或迟到响应可能被 Gateway 拒收并记录 warn。

### Case 5: 恢复外层会话

```mermaid
sequenceDiagram
  participant C as ACP Client
  participant G as Viben Gateway

  C->>G: WebSocket reconnect
  C->>G: request initialize
  G-->>C: initialize result
  C->>G: request session/load sessionId=old
  alt old session still in memory
    G-->>C: same sessionId
  else old session not in memory
    G-->>C: same sessionId as new live outer session
  end
  C->>G: request session/prompt
```

关键点：

- 断开旧 WebSocket 会触发 owned sessions 自动关闭；因此“恢复”主要依赖客户端在新连接调用 `session/load`。
- 如果旧会话已经被关闭，Gateway 会用传入的 `sessionId` 创建新的 live record，并在启动后端时尝试加载同名后端 session。

### Case 6: 后端启动失败

```mermaid
sequenceDiagram
  participant C as ACP Client
  participant G as Viben Gateway
  participant B as ACP Backend

  C->>G: request session/prompt id=7
  G->>B: spawn backend process
  B--xG: command missing / initialize timeout / exit
  G-->>C: notification session/update error
  G-->>C: response id=7 error -32603
```

错误响应示例：

```json
{
  "jsonrpc": "2.0",
  "id": 7,
  "error": {
    "code": -32603,
    "message": "Internal error: Failed to start ACP backend",
    "data": {
      "message": "Failed to start ACP backend",
      "command": "claude-agent-acp",
      "cwd": "/repo",
      "installHint": "Install or configure the selected ACP backend."
    }
  }
}
```

---

## 会话状态与持久化

Gateway 内部外层会话状态：

| 状态 | 进入条件 |
|------|----------|
| `initializing` | `session/new` 或 `session/load` 创建会话记录后 |
| `active` | 开始执行某个 `session/prompt` |
| `finished` | 当前 prompt 和队列都结束 |
| `cancelled` | 收到 `session/cancel` |
| `error` | prompt 执行抛错 |

如果请求或查询参数提供了 `persist_session_id`/`session_id` 与 `persist_task_id`/`task_id`：

- 用户 prompt 会写入 UI 消息，类型为 `user`。
- `agent_message_chunk` 写入 UI `text`。
- `agent_thought_chunk` 写入 UI `thinking`。
- `tool_call` 写入 UI `tool_use`。
- `tool_call_update` 写入 UI `tool_result`。
- `plan` 写入 UI `plan`。
- `usage_update` 写入 UI `context_usage`。
- 所有可持久化的 ACP 原始更新会作为 raw agent message 写入，`source` 为 `acp`。

---

## 客户端实现建议

1. 连接后先 `initialize`，根据 `agentCapabilities` 决定是否展示加载、关闭和配置 UI。
2. 新建会话使用 `session/new`，恢复会话使用 `session/load`。
3. `session/prompt` 期间按 `session/update` 逐步渲染输出；不要等待 prompt 响应后再展示。
4. 所有 Gateway -> Client 的 request 都必须响应，包括权限请求和 `_viben/client_tool_call`。不支持的方法返回 `-32601`。
5. 使用 snake_case 的 Viben 扩展字段：`agent_config`、`agent_config_path`、`persist_session_id`、`persist_task_id`、`gateway_url`。
6. WebSocket 断开后重新连接并重新 `initialize`；不要假设旧连接上的 in-flight request 会自动恢复。
7. 客户端如果实现心跳，使用无 `id` 的 `$/ping` 通知，不要把心跳当作需要响应的请求。
