---
sidebar_position: 1
---

# 后端开发指南

> Viben 项目后端开发最佳实践

---

## 概述

本目录包含后端开发指南。后端使用 TypeScript 构建在 `packages/core` 中，作为所有前端应用的基础。

**重要**：`packages/core` 是所有 apps 访问底层能力的唯一边界。

## 架构说明

> **重要**：Viben 采用双语言架构：

| 组件 | 语言 | 用途 |
|------|------|------|
| `packages/core` | TypeScript | Gateway API、CLI、Agent 系统、MCP 客户端 |
| `backend/browse-mcp` | Python | 学术搜索 MCP 服务器（arXiv、PubMed 等）|

**本目录的指南主要关注 `packages/core`（TypeScript）。**

Python MCP 服务器开发请参阅[插件架构](./plugin-architecture.md)，该文档记录了 `backend/browse-mcp` 中基于 stevedore 的插件系统。

---

## 指南索引

### 核心指南

| 指南 | 描述 | 状态 |
|------|------|------|
| [目录结构](./directory-structure.md) | 模块组织与文件布局 | 完成 |
| [插件架构](./plugin-architecture.md) | Python MCP 可插拔 Provider 系统 | 完成 |
| [数据库指南](./database-guidelines.md) | ORM 模式、查询、迁移 | 完成 |
| [错误处理](./error-handling.md) | 错误类型、处理策略 | 完成 |
| [质量指南](./quality-guidelines.md) | 代码标准、禁用模式 | 完成 |
| [日志指南](./logging-guidelines.md) | 结构化日志、日志级别 | 完成 |

### Gateway API

| 指南 | 描述 | 状态 |
|------|------|------|
| [Gateway 索引](/backend/gateway/) | Gateway 模块索引 | 完成 |
| [健康检查](/backend/gateway/health) | 健康检查端点 | 完成 |
| [智能体 API](/backend/gateway/agents) | Agent 管理 API | 完成 |
| [模型 API](/backend/gateway/models) | Model 配置 API | 完成 |
| [会话 API](/backend/gateway/sessions) | Session 管理 API | 完成 |
| [群聊 API](/backend/gateway/group-chats) | 群聊 API | 完成 |
| [执行器 API](/backend/gateway/executors) | Executor 执行 API | 完成 |
| [定时任务 API](/backend/gateway/cron) | 定时任务 API | 完成 |
| [通道 API](/backend/gateway/channels) | Channel 管理 API | 完成 |
| [提供商 API](/backend/gateway/providers) | Provider 配置 API | 完成 |
| [任务 API](/backend/gateway/tasks) | 任务管理 API | 完成 |
| [聊天列表 API](/backend/gateway/chat-list) | 聊天列表聚合 API | 完成 |
| [事件流 API](/backend/gateway/events) | SSE 事件流 | 完成 |
| [WebSocket](/backend/gateway/websocket) | WebSocket 实时通信 | 完成 |

### Web API

| 指南 | 描述 | 状态 |
|------|------|------|
| [MCP API](./api/mcp-api.md) | MCP 包 API | 完成 |
| [Skills API](./api/skills-api.md) | Skills 包 API | 完成 |
| [用户 API](./api/user-api.md) | 用户管理 API | 完成 |
| [社交 API](./api/social-api.md) | 社交功能 API | 完成 |
| [收藏 API](./api/collections-api.md) | 收藏功能 API | 完成 |
| [包管理](./api/packages.md) | 通用包操作 | 完成 |

### 模块

| 指南 | 描述 | 状态 |
|------|------|------|
| [认证模块](./modules/auth.md) | 认证系统 | 完成 |
| [数据库模块](./modules/database.md) | 数据库配置 | 完成 |
| [存储模块](./modules/storage.md) | 文件存储 | 完成 |
| [项目配置](./modules/project-setup.md) | 项目初始化 | 完成 |

### 部署

| 指南 | 描述 | 状态 |
|------|------|------|
| [Vercel 部署](./deployment/vercel.md) | Vercel 部署指南 | 完成 |
| [GitHub OAuth](./deployment/github-oauth.md) | GitHub OAuth 集成 | 完成 |

---

## 技术栈

- **运行时**：Node.js + TypeScript
- **HTTP 框架**：Hono
- **AI SDK**：Vercel AI SDK
- **配置**：YAML（文件原生范式）
- **存储**：基于文件（`~/.viben/`）
- **遥测**：OpenTelemetry

---

## API 命名约定

**重要**：所有 Gateway API 查询参数使用 **snake_case** 格式：

```typescript
// 正确
workspace_path, include_global, session_id

// 错误
workspacePath, includeGlobal, sessionId
```

---

**语言**：文档使用中文，代码注释使用英文。
