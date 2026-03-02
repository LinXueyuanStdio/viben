---
sidebar_position: 1
title: "Gateway API 参考"
description: "Viben Gateway RESTful API 完整参考文档"
---

# Gateway API 参考

Viben Gateway 提供 RESTful API 用于智能体编排和多智能体工作空间管理。

## 基本信息

- **Base URL**: `http://127.0.0.1:18790`
- **协议**: HTTP/HTTPS
- **格式**: JSON

## 认证

当前版本的 Gateway 运行在本地，不需要认证。未来版本可能添加认证支持。

## API 端点概览

### 健康检查

| 端点 | 方法 | 描述 |
|------|------|------|
| `/health` | GET | 检查 Gateway 健康状态 |

### 智能体管理

| 端点 | 方法 | 描述 |
|------|------|------|
| `/api/agents` | GET | 列出所有智能体 |
| `/api/agents/:id` | GET | 获取特定智能体 |
| `/api/agents` | POST | 创建智能体 |
| `/api/agents/:id` | PATCH | 更新智能体 |
| `/api/agents/:id` | DELETE | 删除智能体 |

### 执行器管理

| 端点 | 方法 | 描述 |
|------|------|------|
| `/api/executors` | GET | 列出可用执行器 |
| `/api/executors/:type/discover-sessions` | GET | 发现执行器会话 |
| `/api/executors/:type/mcp-servers` | GET | 获取执行器 MCP 服务器 |
| `/api/executors/:type/skills` | GET | 获取执行器技能 |

### 会话管理

| 端点 | 方法 | 描述 |
|------|------|------|
| `/api/sessions` | GET | 列出所有会话 |
| `/api/sessions/:id` | GET | 获取特定会话 |
| `/api/sessions` | POST | 创建会话 |
| `/api/sessions/:id` | PATCH | 更新会话 |
| `/api/sessions/:id` | DELETE | 删除会话 |
| `/api/sessions/:id/messages` | GET | 获取会话消息 |

### Provider 管理

| 端点 | 方法 | 描述 |
|------|------|------|
| `/api/providers` | GET | 列出所有 Provider |
| `/api/providers/:id` | GET | 获取特定 Provider |
| `/api/providers` | POST | 创建 Provider |
| `/api/providers/:id` | PATCH | 更新 Provider |
| `/api/providers/:id` | DELETE | 删除 Provider |
| `/api/providers/:id/test` | POST | 测试 Provider 连接 |

### 模型管理

| 端点 | 方法 | 描述 |
|------|------|------|
| `/api/models` | GET | 列出所有模型 |
| `/api/models/:id` | GET | 获取特定模型 |
| `/api/models/default` | GET | 获取默认模型 |
| `/api/models/default` | PUT | 设置默认模型 |
| `/api/models/aliases` | GET | 获取模型别名 |
| `/api/models/fallbacks` | GET | 获取回退链 |

### 通知渠道管理

| 端点 | 方法 | 描述 |
|------|------|------|
| `/api/channels` | GET | 列出所有通知渠道 |
| `/api/channels/:id` | GET | 获取特定渠道 |
| `/api/channels` | POST | 创建渠道 |
| `/api/channels/:id` | PATCH | 更新渠道 |
| `/api/channels/:id` | DELETE | 删除渠道 |
| `/api/channels/:id/default` | POST | 设置为默认渠道 |
| `/api/channels/send` | POST | 发送消息 |
| `/api/channels/test` | POST | 测试渠道配置 |

### 定时任务管理

| 端点 | 方法 | 描述 |
|------|------|------|
| `/api/cron` | GET | 列出所有定时任务 |
| `/api/cron/:id` | GET | 获取特定定时任务 |
| `/api/cron` | POST | 创建定时任务 |
| `/api/cron/:id` | PATCH | 更新定时任务 |
| `/api/cron/:id` | DELETE | 删除定时任务 |
| `/api/cron/:id/enable` | POST | 启用定时任务 |
| `/api/cron/:id/disable` | POST | 禁用定时任务 |
| `/api/cron/:id/run` | POST | 立即执行定时任务 |
| `/api/cron/:id/logs` | GET | 获取执行日志 |

### 任务管理

| 端点 | 方法 | 描述 |
|------|------|------|
| `/api/tasks` | GET | 列出所有任务 |
| `/api/tasks/:id` | GET | 获取特定任务 |
| `/api/tasks` | POST | 创建任务 |
| `/api/tasks/:id` | PATCH | 更新任务 |
| `/api/tasks/:id` | DELETE | 删除任务 |
| `/api/agents/:agentId/tasks` | GET | 获取智能体任务 |
| `/api/agents/:agentId/sessions/:sessionId/tasks` | GET | 获取会话任务 |

## 通用查询参数

许多端点支持以下查询参数：

| 参数 | 类型 | 描述 |
|------|------|------|
| `workspace_path` | string | 工作空间路径，用于获取工作空间特定的配置 |
| `include_global` | string | 是否包含全局配置 (默认: "true") |

## 响应格式

所有响应使用 JSON 格式，字段名使用 **snake_case**。

### 成功响应

```json
{
  "agents": [...],
  "total": 10
}
```

### 错误响应

```json
{
  "error": "Agent not found: xxx"
}
```

## HTTP 状态码

| 状态码 | 描述 |
|--------|------|
| 200 | 成功 |
| 201 | 创建成功 |
| 400 | 请求错误 |
| 404 | 资源不存在 |
| 500 | 服务器错误 |

## Swagger UI

Gateway 运行时提供 Swagger UI 用于交互式 API 探索：

```
http://127.0.0.1:18790/docs
```

## 下一步

- [Gateway 概述](/backend/gateway) - 了解 Gateway 架构
- [CLI 文档](/cli/) - 使用命令行管理智能体
- [用户指南](/user/) - 桌面应用使用指南
