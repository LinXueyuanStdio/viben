# Viben Gateway API 文档

> **版本**: 1.0.0
> **更新日期**: 2026-02-28
> **默认端口**: 18790
> **基础 URL**: `http://127.0.0.1:18790`

---

## 目录

1. [概述](#1-概述)
2. [基础信息](#2-基础信息)
3. [健康检查](#3-健康检查)
4. [智能体 API](#4-智能体-api)
5. [会话 API](#5-会话-api)
6. [定时任务 API](#6-定时任务-api)
7. [Provider API](#7-provider-api)
8. [Model API](#8-model-api)
9. [MCP API](#9-mcp-api)
10. [市场 API](#10-市场-api)
11. [MCP Inspector API](#11-mcp-inspector-api)
12. [工作区 API](#12-工作区-api)
13. [其他 API](#13-其他-api)

---

## 1. 概述

Viben Gateway 是本地 HTTP API 服务，为桌面应用和 CLI 提供统一的后端接口。

### 核心特性

- RESTful API 设计
- SSE 支持实时消息推送
- WebSocket 支持双向通信
- 文件原生配置 (YAML)

---

## 2. 基础信息

### 2.1 端口配置

| 环境 | 端口 | 描述 |
|------|------|------|
| 默认 | 18790 | Gateway 默认端口 |
| 开发 | 18790 | 开发环境端口 |

### 2.2 参数命名约定

**重要**: 所有 Gateway API 查询参数使用 **snake_case** 格式:

```
# 正确
GET /api/agent?workspace_path=/path/to/project
GET /api/agent?include_global=true

# 错误
GET /api/agent?workspacePath=/path/to/project
GET /api/agent?includeGlobal=true
```

### 2.3 通用响应格式

**成功响应**:
```json
{
  "data": { ... },
  "total": 10
}
```

**错误响应**:
```json
{
  "error": "错误信息描述"
}
```

### 2.4 HTTP 状态码

| 状态码 | 描述 |
|--------|------|
| 200 | 成功 |
| 201 | 创建成功 |
| 400 | 请求参数错误 |
| 404 | 资源不存在 |
| 500 | 服务器内部错误 |

---

## 3. 健康检查

### GET /health

检查 Gateway 服务状态。

**响应示例**:
```json
{
  "status": "ok",
  "service": "viben-gateway",
  "version": "1.0.0",
  "timestamp": "2026-02-28T10:00:00.000Z",
  "uptime": "2h 30m 15s",
  "uptime_seconds": 9015,
  "startup": {
    "host": "127.0.0.1",
    "port": 18790,
    "cors": true,
    "started_at": "2026-02-28T07:29:45.000Z",
    "pid": 12345,
    "node_version": "v20.10.0",
    "platform": "darwin",
    "arch": "arm64",
    "config_dir": "/Users/user/.viben",
    "state_dir": "/Users/user/.viben",
    "command": "viben gateway serve --host 127.0.0.1 --port 18790"
  }
}
```

---

## 4. 智能体 API

### 4.1 列出智能体

**GET /api/agent**

列出所有智能体，支持工作区级别筛选。

**查询参数**:
| 参数 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| workspace_path | string | - | 工作区路径，用于加载项目级智能体 |
| include_global | string | "true" | 是否包含全局智能体 |

**响应示例**:
```json
{
  "agents": [
    {
      "id": "my-agent",
      "name": "My Agent",
      "agent_type": "viben",
      "source": "global",
      "workspace_path": "/Users/user/.viben/agents/my-agent",
      "config_path": "/Users/user/.viben/agents/my-agent/config.yaml",
      "description": "A helpful assistant",
      "model": "claude-sonnet-4-20250514",
      "provider": "anthropic",
      "system_prompt": "You are a helpful assistant.",
      "temperature": 0.7,
      "max_tokens": 4096,
      "executor_type": "VIBEN",
      "mcp_servers": ["filesystem", "git"],
      "skills": [],
      "plan_mode": false,
      "approvals": false,
      "created_at": "2026-02-28T10:00:00.000Z",
      "updated_at": "2026-02-28T10:00:00.000Z"
    }
  ],
  "total": 1
}
```

### 4.2 获取智能体

**GET /api/agent/:id**

获取指定智能体的详细信息。

**查询参数**:
| 参数 | 类型 | 描述 |
|------|------|------|
| workspace_path | string | 优先从工作区查找 |

**响应**: 同上述智能体对象

### 4.3 创建智能体

**POST /api/agent**

创建新智能体。

**请求体**:
```json
{
  "name": "New Agent",
  "id": "new-agent",
  "description": "Description",
  "model": "claude-sonnet-4-20250514",
  "provider": "anthropic",
  "system_prompt": "You are a helpful assistant.",
  "temperature": 0.7,
  "max_tokens": 4096,
  "executor_type": "VIBEN",
  "mcp_servers": [],
  "skills": [],
  "plan_mode": false,
  "approvals": false,
  "from_template": "default"
}
```

### 4.4 更新智能体

**PATCH /api/agent/:id**

更新智能体配置。

**查询参数**:
| 参数 | 类型 | 描述 |
|------|------|------|
| workspace_path | string | 指定工作区 |

**请求体**: 要更新的字段

### 4.5 删除智能体

**DELETE /api/agent/:id**

删除指定智能体。

**查询参数**:
| 参数 | 类型 | 描述 |
|------|------|------|
| workspace_path | string | 指定工作区 |

### 4.6 默认智能体

**GET /api/agent/default**

获取默认智能体 ID。

**PUT /api/agent/default**

设置默认智能体。

**请求体**:
```json
{
  "agent_id": "my-agent"
}
```

### 4.7 智能体模板

**GET /api/agent/templates**

列出所有模板。

**GET /api/agent/templates/:id**

获取指定模板。

**POST /api/agent/templates**

从智能体创建模板。

```json
{
  "agent_id": "my-agent",
  "template_id": "my-template"
}
```

**POST /api/agent/templates/:id/instantiate**

从模板创建智能体。

```json
{
  "agent_id": "new-agent-from-template"
}
```

### 4.8 智能体会话

**GET /api/agent/:id/sessions**

列出智能体的所有会话。

**POST /api/agent/:id/sessions**

创建新会话。

```json
{
  "session_id": "optional-custom-id",
  "prompt": "Initial prompt",
  "task_id": "optional-task-id",
  "workspace_path": "/path/to/workspace"
}
```

**GET /api/agent/:id/sessions/:session_id**

获取会话详情。

**DELETE /api/agent/:id/sessions/:session_id**

删除会话。

### 4.9 会话消息

**GET /api/agent/:id/sessions/:session_id/messages**

获取会话的原始消息 (rollout)。

**POST /api/agent/:id/sessions/:session_id/messages**

追加消息。

**GET /api/agent/:id/sessions/:session_id/ui-messages**

获取 UI 消息 (用于前端渲染)。

### 4.10 智能体可用性检查

**GET /api/agent/:id/availability**

检查智能体或执行器的可用性。

**响应示例**:
```json
{
  "type": "LOGIN_DETECTED",
  "last_auth_timestamp": 1709120000000
}
```

可能的 `type` 值:
- `NOT_FOUND` - 未找到
- `INSTALLATION_FOUND` - 检测到安装
- `LOGIN_DETECTED` - 检测到登录
- `VIBEN_AGENT` - Viben 智能体

---

## 5. 会话 API

### 5.1 列出会话

**GET /api/sessions**

列出所有会话。

### 5.2 获取会话

**GET /api/sessions/:id**

获取指定会话。

### 5.3 创建会话

**POST /api/sessions**

创建新会话 (数据库存储)。

### 5.4 更新会话

**PATCH /api/sessions/:id**

更新会话状态。

### 5.5 删除会话

**DELETE /api/sessions/:id**

删除会话。

### 5.6 会话消息

**GET /api/sessions/:id/messages**

获取会话消息。

**GET /api/sessions/:id/ui-messages**

获取 UI 消息。

### 5.7 任务会话

**GET /api/tasks/:taskId/sessions**

获取指定任务的所有会话。

---

## 6. 定时任务 API

### 6.1 列出任务

**GET /api/cron**

列出所有定时任务。

**响应示例**:
```json
{
  "jobs": [
    {
      "id": "job-123",
      "name": "Daily Report",
      "enabled": true,
      "job_type": "agent",
      "message": "Generate daily report",
      "cron": "0 9 * * *",
      "channel": "default",
      "agent": "reporter",
      "workspace_path": "/path/to/workspace",
      "notifications": true,
      "last_run": 1709120000000,
      "last_status": "success",
      "next_run": 1709206400000,
      "created_at": "2026-02-28T10:00:00.000Z",
      "updated_at": "2026-02-28T10:00:00.000Z"
    }
  ]
}
```

### 6.2 获取任务

**GET /api/cron/:id**

获取指定定时任务。

### 6.3 创建任务

**POST /api/cron**

创建定时任务。

**请求体**:
```json
{
  "name": "Task Name",
  "job_type": "agent",
  "message": "Task message",
  "cron": "0 9 * * *",
  "agent": "my-agent",
  "workspace_path": "/path/to/workspace",
  "enabled": true,
  "notifications": true
}
```

### 6.4 更新任务

**PATCH /api/cron/:id**

更新定时任务。

### 6.5 删除任务

**DELETE /api/cron/:id**

删除定时任务。

### 6.6 启用/禁用任务

**POST /api/cron/:id/enable**

启用任务。

**POST /api/cron/:id/disable**

禁用任务。

### 6.7 手动执行任务

**POST /api/cron/:id/run**

立即执行任务。

### 6.8 执行日志

**GET /api/cron/:id/logs**

获取执行日志。

**查询参数**:
| 参数 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| limit | number | 100 | 返回条数 |
| offset | number | 0 | 偏移量 |

**DELETE /api/cron/:id/logs**

清除执行日志。

---

## 7. Provider API

### 7.1 列出 Provider

**GET /api/providers**

列出所有 Provider。

**响应示例**:
```json
{
  "providers": [
    {
      "id": "anthropic-default",
      "type": "anthropic",
      "name": "Anthropic",
      "api_key": "sk-ant-...",
      "base_url": null,
      "is_default": true,
      "enabled": true,
      "created_at": "2026-02-28T10:00:00.000Z",
      "updated_at": "2026-02-28T10:00:00.000Z"
    }
  ],
  "total": 1,
  "default_provider_id": "anthropic-default"
}
```

### 7.2 获取 Provider

**GET /api/providers/:id**

获取指定 Provider。

### 7.3 创建 Provider

**POST /api/providers**

创建新 Provider。

**请求体**:
```json
{
  "type": "anthropic",
  "name": "My Anthropic",
  "api_key": "sk-ant-xxx",
  "base_url": null,
  "set_as_default": true
}
```

支持的 Provider 类型:
- `openai`
- `anthropic`
- `google`
- `azure`
- `ollama`
- `groq`
- `mistral`
- `deepseek`
- `openrouter`

### 7.4 更新 Provider

**PATCH /api/providers/:id**

更新 Provider 配置。

### 7.5 删除 Provider

**DELETE /api/providers/:id**

删除 Provider。

### 7.6 启用/禁用 Provider

**POST /api/providers/:id/enable**

启用 Provider。

**POST /api/providers/:id/disable**

禁用 Provider。

### 7.7 测试连接

**POST /api/providers/:id/test**

测试 Provider 连接。

**响应**:
```json
{
  "provider_id": "anthropic-default",
  "connected": true,
  "latency": 150,
  "checked_at": "2026-02-28T10:00:00.000Z"
}
```

### 7.8 默认 Provider

**GET /api/providers/default**

获取默认 Provider。

**PUT /api/providers/default**

设置默认 Provider。

### 7.9 Provider 模型

**GET /api/providers/:id/models**

获取 Provider 的可用模型列表。

**GET /api/providers/:id/discover-models**

从 API 发现模型 (原始数据)。

**POST /api/providers/:provider_id/models/:model_id/enable**

启用模型。

**POST /api/providers/:provider_id/models/:model_id/disable**

禁用模型。

### 7.10 API Key 管理

**GET /api/providers/api-keys**

获取所有 Provider 的 API Key 状态。

**POST /api/providers/validate-key**

验证 API Key。

**POST /api/providers/reload**

重新加载配置。

---

## 8. Model API

### 8.1 列出模型

**GET /api/models**

列出所有可用模型。

**查询参数**:
| 参数 | 类型 | 描述 |
|------|------|------|
| workspace_path | string | 工作区路径 |
| include_global | string | 包含全局模型 |
| include_provider_predefined | string | 包含预定义模型 |

### 8.2 获取模型

**GET /api/models/:id**

获取指定模型。

### 8.3 创建模型

**POST /api/models**

注册自定义模型。

### 8.4 更新模型

**PATCH /api/models/:id**

更新模型配置。

### 8.5 删除模型

**DELETE /api/models/:id**

删除模型配置。

### 8.6 启用/禁用模型

**POST /api/models/:id/enable**

**POST /api/models/:id/disable**

### 8.7 默认模型

**GET /api/models/default**

**PUT /api/models/default**

### 8.8 模型别名

**GET /api/models/aliases**

**POST /api/models/aliases**

**DELETE /api/models/aliases/:alias**

### 8.9 回退链

**GET /api/models/fallbacks**

**PUT /api/models/fallbacks**

**POST /api/models/fallbacks**

**DELETE /api/models/fallbacks/:model**

**DELETE /api/models/fallbacks**

### 8.10 模型配置

**GET /api/models/:id/config**

**PUT /api/models/:id/config**

**DELETE /api/models/:id/config**

**POST /api/models/reload**

---

## 9. MCP API

### 9.1 全局安装

**GET /api/mcp/installed**

列出全局安装的 MCP 服务器。

### 9.2 智能体 MCP 配置

**GET /api/mcp/agents/:agentId/servers**

列出智能体的 MCP 服务器。

**POST /api/mcp/agents/:agentId/servers**

添加 MCP 服务器。

**GET /api/mcp/agents/:agentId/servers/:name**

获取指定 MCP 服务器。

**PATCH /api/mcp/agents/:agentId/servers/:name**

更新 MCP 服务器。

**DELETE /api/mcp/agents/:agentId/servers/:name**

删除 MCP 服务器。

**POST /api/mcp/agents/:agentId/servers/:name/enable**

启用 MCP 服务器。

**POST /api/mcp/agents/:agentId/servers/:name/disable**

禁用 MCP 服务器。

### 9.3 Browse-MCP 管理

**GET /api/mcp/browse/status**

获取 Browse-MCP 状态。

**POST /api/mcp/browse/start**

启动 Browse-MCP。

```json
{
  "python_path": "/usr/bin/python3",
  "transport": "sse",
  "port": 8080
}
```

**POST /api/mcp/browse/stop**

停止 Browse-MCP。

**POST /api/mcp/browse/test**

测试 Browse-MCP 连接。

### 9.4 MCP Proxy 管理

**GET /api/mcp/proxy/status**

获取 MCP Proxy 状态。

**POST /api/mcp/proxy/check-installed**

检查是否安装。

**POST /api/mcp/proxy/start**

启动 MCP Proxy。

**POST /api/mcp/proxy/stop**

停止 MCP Proxy。

**POST /api/mcp/proxy/install**

安装 MCP Proxy。

### 9.5 端口和进程管理

**POST /api/mcp/port/status**

检查端口状态。

**POST /api/mcp/process/kill**

终止进程。

**POST /api/mcp/process/alive**

检查进程是否存活。

**POST /api/mcp/server/check-port**

检查端口上的 MCP 服务器状态。

---

## 10. 市场 API

### 10.1 获取索引

**GET /api/marketplace/index**

获取市场索引。

**查询参数**:
| 参数 | 类型 | 描述 |
|------|------|------|
| force_refresh | string | 强制刷新缓存 |

### 10.2 插件列表

**GET /api/marketplace/plugins**

获取所有插件。

**GET /api/marketplace/plugins/:pluginId**

获取指定插件。

### 10.3 分类

**GET /api/marketplace/categories**

获取所有分类。

**GET /api/marketplace/categories/:categoryId/plugins**

获取分类下的插件。

### 10.4 搜索

**GET /api/marketplace/search**

搜索插件。

**查询参数**:
| 参数 | 类型 | 描述 |
|------|------|------|
| q | string | 搜索关键词 |

### 10.5 数据源

**GET /api/marketplace/sources**

获取扁平化的数据源列表。

### 10.6 缓存

**DELETE /api/marketplace/cache**

清除缓存。

---

## 11. MCP Inspector API

MCP Inspector 提供 MCP 服务器调试功能。

### 11.1 健康检查

**GET /api/mcp/inspector/health**

### 11.2 配置

**GET /api/mcp/inspector/config**

### 11.3 Token

**GET /api/mcp/inspector/token**

获取会话 Token (开发环境)。

### 11.4 会话管理

**GET /api/mcp/inspector/sessions**

列出活动会话。

**DELETE /api/mcp/inspector/sessions/:sessionId**

关闭会话。

### 11.5 StreamableHTTP 代理

**GET /api/mcp/inspector/mcp**

SSE 流 (已有会话)。

**POST /api/mcp/inspector/mcp**

初始化或发送消息。

**DELETE /api/mcp/inspector/mcp**

终止会话。

### 11.6 STDIO 代理

**GET /api/mcp/inspector/stdio**

STDIO 传输 SSE 端点。

**查询参数**:
| 参数 | 类型 | 描述 |
|------|------|------|
| transportType | string | 传输类型 ("stdio") |
| command | string | 命令 |
| args | string | 参数 |
| env | string | 环境变量 (JSON) |

### 11.7 SSE 代理

**GET /api/mcp/inspector/sse**

SSE 传输端点 (已弃用，推荐 StreamableHTTP)。

### 11.8 消息端点

**POST /api/mcp/inspector/message**

SSE/STDIO 消息端点。

**查询参数**:
| 参数 | 类型 | 描述 |
|------|------|------|
| sessionId | string | 会话 ID |

---

## 12. 工作区 API

### 12.1 列出工作区

**GET /api/workspaces**

列出所有工作区 (始终包含 global)。

**响应示例**:
```json
{
  "workspaces": [
    {
      "id": "global",
      "path": "/Users/user",
      "name": "Global",
      "config_path": "/Users/user/.viben",
      "git_repo_path": "/Users/user/.git",
      "type": "global"
    },
    {
      "id": "L1VzZXJzL3VzZXIvcHJvamVjdA",
      "path": "/Users/user/project",
      "name": "My Project",
      "config_path": "/Users/user/project/.viben",
      "git_repo_path": "/Users/user/project/.git",
      "type": "custom"
    }
  ],
  "total": 2,
  "active_workspace_id": null
}
```

---

## 13. 其他 API

### 13.1 执行器

**GET /api/executors**

列出可用执行器 (CLAUDE_CODE, CODEX, AMP 等)。

### 13.2 终端

**POST /api/terminal/sessions**

创建终端会话。

**WebSocket /api/terminal/sessions/:sessionId/ws**

终端 WebSocket 连接。

### 13.3 文件系统

**GET /api/filesystem/list**

列出目录内容。

**GET /api/filesystem/read**

读取文件。

**POST /api/filesystem/write**

写入文件。

### 13.4 文件

**GET /api/files**

文件操作 API。

### 13.5 日志

**GET /api/logs**

获取系统日志。

### 13.6 缓存

**DELETE /api/cache/clear**

清除缓存。

### 13.7 遥测

**POST /api/telemetry/events**

发送遥测事件。

### 13.8 隧道

**POST /api/tunnel/start**

启动隧道。

**POST /api/tunnel/stop**

停止隧道。

### 13.9 看板数据

**GET /api/kanban/data**

获取看板数据。

### 13.10 已安装包

**GET /api/packages/installed**

获取已安装的包。

### 13.11 已安装数据源

**GET /api/installed-sources**

获取已安装的数据源。

---

## 附录

### A. 错误代码

| 代码 | 描述 |
|------|------|
| 400 | 请求参数错误 |
| 401 | 未授权 |
| 404 | 资源不存在 |
| 500 | 服务器内部错误 |

### B. 常见问题

**Q: Gateway 无法启动**

检查端口 18790 是否被占用:
```bash
lsof -i :18790
```

**Q: API 调用返回 CORS 错误**

Gateway 默认启用 CORS，检查请求 Origin。

### C. 相关文档

- [系统架构文档](./ARCHITECTURE.md)
- [CLAUDE.md](../CLAUDE.md) - 开发指南
