# Backend Development Guidelines

> Best practices for backend development in Viben project.

---

## Overview

This directory contains guidelines for backend development. The backend is built with TypeScript in `packages/core`, serving as the foundation for all frontend applications.

**Important**: `packages/core` is the single boundary for all apps to access underlying capabilities. See [CLAUDE.md](../../../CLAUDE.md) for core architecture principles.

## Architecture Note

> **Important**: Viben has a dual-language architecture:

| Component | Language | Purpose |
|-----------|----------|---------|
| `packages/core` | TypeScript | Gateway API, CLI, Agent system, MCP client |
| `backend/browse-mcp` | Python | MCP server for academic search (arXiv, PubMed, etc.) |

**This directory's guidelines focus on `packages/core` (TypeScript).**

For Python MCP server development, see [Plugin Architecture](./plugin-architecture.md) which documents the stevedore-based plugin system in `backend/browse-mcp`.

---

## Guidelines Index

### Core Guidelines

| Guide | Description | Status |
|-------|-------------|--------|
| [Directory Structure](./core/directory-structure.md) | 模块组织与文件布局 | ✅ Complete |
| [Plugin Architecture](./plugin-architecture.md) | Python MCP 可插拔 Provider 系统 (stevedore) | ✅ Complete |
| [Telemetry Guidelines](./telemetry-guidelines.md) | OpenTelemetry tracing, metrics, logging | ✅ Complete |
| [API Module](./core/api-module.md) | API 模块设计与路由规范 | ✅ Complete |
| [Quality](./core/quality.md) | 代码质量标准与审查指南 | ✅ Complete |

### To Fill

| Guide | Description | Status |
|-------|-------------|--------|
| [Database Guidelines](./database-guidelines.md) | ORM patterns, queries, migrations | 📝 To fill |
| [Error Handling](./error-handling.md) | Error types, handling strategies | 📝 To fill |
| [Quality Guidelines](./core/quality-guidelines.md) | Code standards, forbidden patterns | 📝 To fill |
| [Logging Guidelines](./logging-guidelines.md) | Structured logging, log levels | 📝 To fill |

---

## Related Module Specs

### Gateway API

> Gateway 是 packages/core 的 HTTP/WebSocket 服务层

| Guide | Description | Status |
|-------|-------------|--------|
| [Gateway Index](../modules/gateway/) | Gateway 模块索引 | - |
| [Gateway Health](../modules/gateway/health.md) | 健康检查端点 | ✅ Complete |
| [Gateway Agents](../modules/gateway/agents.md) | Agent 管理 API | ✅ Complete |
| [Gateway Models](../modules/gateway/models.md) | Model 配置 API | ✅ Complete |
| [Gateway Sessions](../modules/gateway/sessions.md) | Session 管理 API | ✅ Complete |
| [Gateway Group Chats](../modules/gateway/group-chats.md) | 群聊 API | ✅ Complete |
| [Gateway Executors](../modules/gateway/executors.md) | Executor 执行 API | ✅ Complete |
| [Gateway Cron](../modules/gateway/cron.md) | 定时任务 API | ✅ Complete |
| [Gateway Channels](../modules/gateway/channels.md) | Channel 管理 API | ✅ Complete |
| [Gateway Providers](../modules/gateway/providers.md) | Provider 配置 API | ✅ Complete |
| [Gateway Telemetry](../modules/gateway/telemetry.md) | 遥测数据 API | ✅ Complete |
| [Gateway Kanban](../modules/gateway/kanban-api.md) | Kanban API | ✅ Complete |
| [Gateway WebSocket](../modules/gateway/websocket.md) | WebSocket 实时通信 | ✅ Complete |

### CLI Commands

| Guide | Description | Status |
|-------|-------------|--------|
| [CLI Index](../modules/cli/) | CLI 命令索引 | - |
| [CLI Agent](../modules/cli/agent.md) | `viben agent` 命令 | ✅ Complete |
| [CLI Agent Chat](../modules/cli/agent-chat.md) | `viben agent chat` 命令 | ✅ Complete |
| [CLI Model](../modules/cli/model.md) | `viben model` 命令 | ✅ Complete |
| [CLI Provider](../modules/cli/provider.md) | `viben provider` 命令 | ✅ Complete |
| [CLI Executor](../modules/cli/executor.md) | `viben executor` 命令 | ✅ Complete |
| [CLI MCP](../modules/cli/mcp.md) | `viben mcp` 命令 | ✅ Complete |
| [CLI Skill](../modules/cli/skill.md) | `viben skill` 命令 | ✅ Complete |
| [CLI Team](../modules/cli/team.md) | `viben team` 命令 | ✅ Complete |
| [CLI Gateway](../modules/cli/gateway.md) | `viben gateway` 命令 | ✅ Complete |
| [CLI Channel](../modules/cli/channel.md) | `viben channel` 命令 | ✅ Complete |
| [CLI Cron](../modules/cli/cron.md) | `viben cron` 命令 | ✅ Complete |

### Chat System

| Guide | Description | Status |
|-------|-------------|--------|
| [Chat Index](../modules/chat/) | Chat 模块索引 | - |
| [Agent Hooks Spec](../modules/chat/agent-hooks-spec.md) | Agent Hooks 统一架构规范 | ✅ Done |
| [SSE Streaming](../modules/chat/sse-streaming.md) | SSE 流式通信规范 | ✅ Complete |
| [Background Tasks](../modules/chat/background-tasks.md) | 后台任务管理规范 | ✅ Complete |
| [Sandbox Spec](../modules/chat/sandbox-spec.md) | Sandbox 沙箱规范 | ✅ Complete |
| [WorkAny Migration](../modules/chat/workany-migration.md) | WorkAny 核心功能迁移规范 | 🟡 规划中 |

### Kanban System

| Guide | Description | Status |
|-------|-------------|--------|
| [Kanban Index](../modules/kanban/) | Kanban 模块索引 | - |
| [Kanban Storage](../modules/kanban/storage.md) | 文件存储系统设计 | 📝 Specification |
| [Kanban Project](../modules/kanban/project.md) | 项目管理模块 | 📝 Specification |
| [Kanban Task](../modules/kanban/task.md) | 任务管理模块 | 📝 Specification |
| [Kanban Workspace](../modules/kanban/workspace.md) | 工作区 (Worktree) 管理 | 📝 Specification |
| [Kanban Session](../modules/kanban/session.md) | 会话管理模块 | 📝 Specification |
| [Kanban Git Operations](../modules/kanban/git-operations.md) | Git 操作封装 | 📝 Specification |

---

## Tech Stack

- **Runtime**: Node.js + TypeScript
- **HTTP Framework**: Hono
- **AI SDK**: Vercel AI SDK
- **Configuration**: YAML (file-native paradigm)
- **Storage**: File-based (`~/.viben/`)
- **Telemetry**: OpenTelemetry

---

## API Naming Convention

**IMPORTANT**: All Gateway API query parameters use **snake_case** format:

```typescript
// ✅ Correct
workspace_path, include_global, session_id

// ❌ Wrong
workspacePath, includeGlobal, sessionId
```

---

## How to Fill These Guidelines

For each guideline file:

1. Document your project's **actual conventions** (not ideals)
2. Include **code examples** from your codebase
3. List **forbidden patterns** and why
4. Add **common mistakes** your team has made

The goal is to help AI assistants and new team members understand how YOUR project works.

---

**Language**: Documentation in English, spec content can be in Chinese.
