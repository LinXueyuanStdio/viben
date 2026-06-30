---
sidebar_position: 3
title: "ACP WebSocket 协议"
description: "ACP WebSocket 协议 — Viben Gateway 的 ACP 兼容智能体端点"
---

# ACP WebSocket 协议

> `/ws/agent/acp` — 通过 WebSocket 暴露 Viben Gateway 的 ACP 兼容智能体端点

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
| `agent_config_path` | string | 否 | 智能体 Markdown 配置文件路径 |
| `agent_dir` | string | 否 | 会话持久化读取智能体目录时使用 |
| `session_id` | string | 否 | Viben 外层持久化会话 ID |
| `task_id` | string | 否 | Viben 外层任务 ID |
| `gateway_url` | string | 否 | 注入给后端 MCP/工具的 Gateway 地址 |

**示例**:

```
ws://127.0.0.1:18790/ws/agent/acp?cwd=/repo&agent_config_path=/repo/.viben/agents/coder/AGENTS.md&session_id=sess_1&task_id=task_1
```

**子协议**: 客户端可以声明 `acp.v1` 子协议。Gateway 当前不依赖子协议完成路由，协议版本以 `initialize` 的 `protocolVersion` 为准。

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
| `-32601` | Method not found | 调用了未实现方法 |
| `-32602` | Invalid params | 参数缺失或 schema 校验失败 |
| `-32603` | Internal error | 后端执行器启动、运行或工具调用失败 |
| `-32000` | Authentication required | ACP 后端要求认证时可能返回 |
| `-32002` | Resource not found | 文件或资源不存在时可能返回 |

---

## 方法总览

### Client → Gateway 请求

| 方法 | JSON-RPC 类型 | 说明 |
|------|---------------|------|
| `initialize` | request | 协商 ACP 版本、能力和认证方式 |
| `authenticate` | request | 认证（当前返回空对象） |
| `session/new` | request | 创建 Viben 外层 ACP 会话 |
| `session/load` | request | 复用或加载指定外层 ACP 会话 |
| `session/list` | request | 列出当前 Gateway 进程内 ACP 会话 |
| `session/close` | request | 关闭外层会话并释放后端进程 |
| `session/prompt` | request | 发送一轮用户 prompt |
| `session/prompt/steer` | request | 会话忙碌时立即入队一条 steer prompt（Viben 扩展） |
| `session/prompt/cancel` | request | 取消尚未消费的 steer prompt（Viben 扩展） |
| `session/prompt/view` | request | 查看 steer prompt 队列记录（Viben 扩展） |
| `session/interrupt` | request/notification | 中断当前执行（Viben 扩展） |
| `session/cancel` | notification | 取消指定会话当前运行 prompt 和排队 prompt |

### Gateway → Client 请求或通知

| 方法 | JSON-RPC 类型 | 触发条件 | 说明 |
|------|---------------|----------|------|
| `session/update` | notification | 后端产生流式内容、工具调用、计划、用量等更新 | 客户端必须按 `sessionId` 归并到对应会话 |
| `session/prompt/consumed` | notification | Gateway 消费 queued steer prompt | Viben 扩展通知 |
| `session/elicitation` | request | 后端需要结构化用户输入、问题回答或计划确认 | 客户端返回 accept/decline/cancel 和表单内容 |
| `session/request_permission` | request | 后端执行敏感工具前需要用户授权 | 客户端必须返回 selected 或 cancelled |
| `_viben/client_tool_call` | request | 后端请求客户端侧工具 | Viben 扩展方法 |

### 心跳

客户端可以发送 JSON-RPC 通知 `$/ping` 作为应用层心跳：

```json
{"jsonrpc":"2.0","method":"$/ping"}
```

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

## 会话管理

### session/new — 创建会话

创建新的 ACP 会话。可指定 `cwd` 工作目录和 `agentConfigPath` 配置文件路径。

### session/load — 加载会话

复用已存在的 ACP 会话，恢复之前的上下文。

### session/close — 关闭会话

关闭会话并释放后端进程资源。

### session/list — 列出会话

列出当前 Gateway 进程内的所有活跃 ACP 会话。

## 会话交互

### session/prompt — 发送提示

发送一轮用户 prompt 给 Agent。Gateway 会启动后端执行，执行完成后返回结果。

### session/prompt/steer — 引导提示（Viben 扩展）

在会话忙碌时，将一条 steer prompt 入队，待当前执行完成后自动作为下一轮 prompt 执行。

### session/cancel — 取消会话

取消指定会话的当前运行 prompt 和所有排队 prompt。

## 参考

- 规范文件: `docs/specs/modules/gateway/acp.md`
- 相关路由: [Gateway 总览](./index.md)
