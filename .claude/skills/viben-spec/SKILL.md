---
name: viben
description: Viben CLI for AI-assisted development with multi-agent orchestration. Use when user asks about viben commands, wants to manage agents/tasks/providers, configure workspaces, or orchestrate multi-agent workflows. Triggers include "viben", "create agent", "start task", "swarm", "gateway", "provider", "executor", "mcp server", "skill install".
---

# Viben CLI

Viben is an AI-assisted development CLI with multi-agent orchestration.

## Core Concepts

- **Executor**: Bottom-layer coding agent (Claude Code, Cursor, Gemini CLI)
- **Agent**: Executor + Skills + Prompts + MCP + Memory
- **Task**: Development unit with context injection
- **Swarm**: Multi-agent orchestration with Git worktree isolation

## Source Code Structure

### CLI (`packages/core/src/cli/`)

```
packages/core/src/cli/
├── bin.ts              # Entry point
├── cli.ts              # Program setup
├── index.ts            # Exports
├── types.ts            # CLI types
├── lib/                # Shared utilities
└── commands/           # Command implementations
    ├── index.ts        # Command registration
    ├── init.ts         # viben init
    ├── config.ts       # viben config
    ├── workspace.ts    # viben workspace
    ├── user.ts         # viben user
    ├── team.ts         # viben team
    ├── gateway.ts      # viben gateway
    ├── service.ts      # viben service
    ├── executor.ts     # viben executor
    ├── agent.ts        # viben agent
    ├── task.ts         # viben task
    ├── swarm.ts        # viben swarm
    ├── session.ts      # viben session
    ├── context.ts      # viben context
    ├── queue.ts        # viben queue
    ├── provider.ts     # viben provider
    ├── model.ts        # viben model
    ├── mcp.ts          # viben mcp
    ├── skill.ts        # viben skill
    ├── channel.ts      # viben channel
    ├── cron.ts         # viben cron
    └── telemetry.ts    # viben telemetry
```

### Gateway API (`packages/core/src/gateway/`)

```
packages/core/src/gateway/
├── index.ts            # Server setup (Fastify)
├── state.ts            # AppState management
├── middleware/         # Auth, CORS, etc.
├── queue/              # Task queue system
├── sse/                # Server-Sent Events
└── routes/             # API endpoints
    ├── index.ts        # Route registration
    ├── health.ts       # GET /health
    ├── agents.ts       # /api/agent/*
    ├── tasks.ts        # /api/task/*
    ├── sessions.ts     # /api/sessions/*
    ├── agent-run.ts    # /api/agent-run/* (SSE)
    ├── agent-ws.ts     # /api/agent-ws/* (WebSocket)
    ├── cron.ts         # /api/cron/*
    ├── channels.ts     # /api/channel/*
    ├── executors.ts    # /api/executor/*
    ├── models.ts       # /api/model/*
    ├── providers.ts    # /api/provider/*
    ├── workspaces.ts   # /api/workspace/*
    ├── mcp.ts          # /api/mcp/*
    ├── queue.ts        # /api/queue/*
    ├── github.ts       # /api/github/*
    ├── group-chats.ts  # /api/group-chat/*
    ├── history.ts      # /api/history/*
    ├── terminal.ts     # /api/terminal/*
    ├── files.ts        # /api/files/*
    ├── filesystem.ts   # /api/fs/*
    ├── kanban-data.ts  # /api/kanban/*
    ├── preferences.ts  # /api/preferences/*
    └── ws.ts           # WebSocket handlers
```

### Other Core Modules

```
packages/core/src/
├── agents/             # Agent definitions & runner
├── services/           # Business logic services
├── config/             # Configuration management
├── db/                 # Database (SQLite)
├── executors/          # Executor integrations
├── models/             # LLM model handling
├── providers/          # API provider handling
├── mcp/                # MCP client
├── task/               # Task state machine
├── team/               # Team collaboration
├── workspace/          # Workspace management
├── channels/           # Notification channels
├── github/             # GitHub integration
├── group-chat/         # Group chat support
├── skills/             # Skill system
├── sandbox/            # Sandbox execution
├── telemetry/          # Usage telemetry
└── types/              # Shared types
```

## Command Reference

### 核心初始化与配置

| Document | Command | Description |
|----------|---------|-------------|
| [init.md](docs/specs/modules/cli/init.md) | `viben init` | 工作区初始化 |
| [config.md](docs/specs/modules/cli/config.md) | `viben config` | Git 风格配置管理 |
| [workspace.md](docs/specs/modules/cli/workspace.md) | `viben workspace` | 工作区操作 |
| [team.md](docs/specs/modules/cli/team.md) | `viben team` | 团队协作工作区初始化 |
| [user.md](docs/specs/modules/cli/user.md) | `viben user` | 用户身份管理 |

### 服务与运行时

| Document | Command | Description |
|----------|---------|-------------|
| [service.md](docs/specs/modules/cli/service.md) | `viben service` | 后台服务管理 |
| [gateway.md](docs/specs/modules/cli/gateway.md) | `viben gateway` | Gateway 运行时 |

### 执行器与智能体

| Document | Command | Description |
|----------|---------|-------------|
| [executor.md](docs/specs/modules/cli/executor.md) | `viben executor` | Executor 发现和管理 |
| [executor-chat.md](docs/specs/modules/cli/executor-chat.md) | `viben executor chat` | 非交互式调用 AI coding agent |
| [agent.md](docs/specs/modules/cli/agent.md) | `viben agent` | Agent 实例管理 |
| [agent-chat.md](docs/specs/modules/cli/agent-chat.md) | `viben agent chat` | 基于 Agent 的对话 |

### 任务与集群调度

| Document | Command | Description |
|----------|---------|-------------|
| [task.md](docs/specs/modules/cli/task.md) | `viben task` | 任务管理（CRUD、上下文、规划、监控） |
| [swarm.md](docs/specs/modules/cli/swarm.md) | `viben swarm` | 智能体集群调度 |
| [session.md](docs/specs/modules/cli/session.md) | `viben session` | 开发会话管理 |
| [context.md](docs/specs/modules/cli/context.md) | `viben context` | 获取当前开发上下文 |
| [queue.md](docs/specs/modules/cli/queue.md) | `viben queue` | Gateway 任务队列管理 |

### 模型与服务商

| Document | Command | Description |
|----------|---------|-------------|
| [provider.md](docs/specs/modules/cli/provider.md) | `viben provider` | API Provider 管理 |
| [model.md](docs/specs/modules/cli/model.md) | `viben model` | Model 管理 |

### 扩展与集成

| Document | Command | Description |
|----------|---------|-------------|
| [mcp.md](docs/specs/modules/cli/mcp.md) | `viben mcp` | MCP Server 管理 |
| [skill.md](docs/specs/modules/cli/skill.md) | `viben skill` | Skill 管理 |
| [channel.md](docs/specs/modules/cli/channel.md) | `viben channel` | Chat Channel 管理 |

### 自动化

| Document | Command | Description |
|----------|---------|-------------|
| [cron.md](docs/specs/modules/cli/cron.md) | `viben cron` | 定时任务管理 |

## Global Options

```
--json              Output as JSON
--global, -g        Use global config
--workspace         Use workspace config
-n, --name <id>     Specify agent name/ID
--verbose, -v       Verbose output
--quiet, -q         Suppress non-essential output
--help, -h          Show help
```
