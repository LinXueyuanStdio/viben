# Viben Gateway

> 基于 Axum 的 HTTP/WebSocket API 服务器，提供 AI 智能体编排和管理服务。

## 概述

Viben Gateway 是 Viben 的核心后端服务，运行在端口 **18790**，提供：
- RESTful API 服务
- WebSocket 实时通信
- Server-Sent Events (SSE) 事件流
- 多智能体编排和协调

## 架构

```
┌─────────────────────────────────────────────────────────────────┐
│                      Viben Gateway                               │
│                      Port: 18790                                 │
├─────────────────────────────────────────────────────────────────┤
│  HTTP Layer (Axum)                                               │
│  ├── CORS Middleware (Allow All Origins)                         │
│  ├── Tracing Middleware (Request/Response Logging)               │
│  └── Router                                                      │
├─────────────────────────────────────────────────────────────────┤
│  API Routes                                                      │
│  ├── /health              健康检查                               │
│  ├── /api/agent          智能体管理                             │
│  ├── /api/executors       执行器管理                             │
│  ├── /api/models          模型管理                               │
│  ├── /api/providers       提供商管理                             │
│  ├── /api/tasks           任务管理                               │
│  ├── /api/sessions        会话管理                               │
│  ├── /api/channels        通道管理                               │
│  ├── /api/cron            定时任务                               │
│  ├── /api/queue           任务队列                               │
│  ├── /api/group-chats     群聊管理                               │
│  ├── /api/chat-list       聊天列表聚合                           │
│  ├── /api/telemetry       可观测性数据                           │
│  └── /api/events          SSE 事件流                             │
├─────────────────────────────────────────────────────────────────┤
│  WebSocket Routes                                                │
│  ├── /ws                  通用 WebSocket                         │
│  ├── /api/group-chats/:id/sessions/:sid/ws  群聊 WebSocket       │
│  └── /terminal/ws         终端 WebSocket                         │
├─────────────────────────────────────────────────────────────────┤
│  Storage Layer                                                   │
│  ├── Global: ~/.viben/                                           │
│  └── Workspace: <project>/.viben/                                │
└─────────────────────────────────────────────────────────────────┘
```

## 服务配置

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| 端口 | 18790 | HTTP/WebSocket 服务端口 |
| CORS | Allow All | 跨域请求配置 |
| 日志 | Tracing | 请求/响应日志记录 |

## API 端点索引

| 模块 | 路径前缀 | 规范文档 |
|------|----------|----------|
| 健康检查 | `/health` | [health.md](./health.md) |
| 智能体 | `/api/agent` | [agents.md](./agents.md) |
| 执行器 | `/api/executors` | [executors.md](./executors.md) |
| 模型 | `/api/models` | [models.md](./models.md) |
| 提供商 | `/api/providers` | [providers.md](./providers.md) |
| 任务 | `/api/tasks` | [tasks.md](./tasks.md) |
| 会话 | `/api/sessions` | [sessions.md](./sessions.md) |
| 通道 | `/api/channels` | [channels.md](./channels.md) |
| 定时任务 | `/api/cron` | [cron.md](./cron.md) |
| 任务队列 | `/api/queue` | [queue.md](./queue.md) |
| 群聊 | `/api/group-chats` | [group-chats.md](./group-chats.md) |
| 聊天列表 | `/api/chat-list` | [chat-list.md](./chat-list.md) |
| 可观测性 | `/api/telemetry` | [telemetry.md](./telemetry.md) |
| 事件流 | `/api/events` | [events.md](./events.md) |
| WebSocket | `/ws`, `/terminal/ws` | [websocket.md](./websocket.md) |

## 工作空间作用域

所有资源支持两个作用域级别：

```
┌─────────────────────────────────────────────────────────────────┐
│  Global Scope: ~/.viben/                                         │
│  ├── agents/              全局智能体                             │
│  ├── providers/           提供商配置                             │
│  ├── models.yaml          模型配置                               │
│  ├── channels.yaml        通道配置                               │
│  └── sessions/            会话存储                               │
├─────────────────────────────────────────────────────────────────┤
│  Workspace Scope: <project>/.viben/                              │
│  ├── agents/              工作空间智能体                         │
│  ├── group-chats/         群聊                                   │
│  └── config.yaml          工作空间配置                           │
└─────────────────────────────────────────────────────────────────┘
```

**查询参数**:
- `workspace_path`: 工作空间路径 (绝对路径)
- `include_global`: 是否包含全局资源 (默认 true)

## 通用响应格式

### 成功响应

```json
{
  "id": "resource-id",
  "name": "Resource Name",
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-01T00:00:00Z",
  "workspace_path": "/path/to/workspace",
  "source": "global",
  "is_global": true
}
```

### 错误响应

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {}
}
```

## 启动 Gateway

```bash
# 启动 Gateway
pnpm gateway:build    # 构建并启动
pnpm gateway:restart  # 重启现有 Gateway

# 健康检查
curl http://127.0.0.1:18790/health
```

## 相关文档

- [CLI Gateway 命令](../cli/gateway.md) - Gateway CLI 管理命令
- [CLI Agent 命令](../cli/agent.md) - Agent CLI 管理命令
- [Telemetry Guidelines](../../backend/patterns/telemetry-guidelines.md) - OpenTelemetry 集成指南
