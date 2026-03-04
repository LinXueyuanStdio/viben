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

## Command Reference

### 核心初始化与配置

| Document | Command | Description |
|----------|---------|-------------|
| [init.md](references/init.md) | `viben init` | 工作区初始化 |
| [config.md](references/config.md) | `viben config` | Git 风格配置管理 |
| [workspace.md](references/workspace.md) | `viben workspace` | 工作区操作 |
| [team.md](references/team.md) | `viben team` | 团队协作工作区初始化 |
| [user.md](references/user.md) | `viben user` | 用户身份管理 |

### 服务与运行时

| Document | Command | Description |
|----------|---------|-------------|
| [service.md](references/service.md) | `viben service` | 后台服务管理 |
| [gateway.md](references/gateway.md) | `viben gateway` | Gateway 运行时 |

### 执行器与智能体

| Document | Command | Description |
|----------|---------|-------------|
| [executor.md](references/executor.md) | `viben executor` | Executor 发现和管理 |
| [executor-chat.md](references/executor-chat.md) | `viben executor chat` | 非交互式调用 AI coding agent |
| [agent.md](references/agent.md) | `viben agent` | Agent 实例管理 |
| [agent-chat.md](references/agent-chat.md) | `viben agent chat` | 基于 Agent 的对话 |

### 任务与集群调度

| Document | Command | Description |
|----------|---------|-------------|
| [task.md](references/task.md) | `viben task` | 任务管理（CRUD、上下文、规划、监控） |
| [swarm.md](references/swarm.md) | `viben swarm` | 智能体集群调度 |
| [session.md](references/session.md) | `viben session` | 开发会话管理 |
| [context.md](references/context.md) | `viben context` | 获取当前开发上下文 |
| [queue.md](references/queue.md) | `viben queue` | Gateway 任务队列管理 |

### 模型与服务商

| Document | Command | Description |
|----------|---------|-------------|
| [provider.md](references/provider.md) | `viben provider` | API Provider 管理 |
| [model.md](references/model.md) | `viben model` | Model 管理 |

### 扩展与集成

| Document | Command | Description |
|----------|---------|-------------|
| [mcp.md](references/mcp.md) | `viben mcp` | MCP Server 管理 |
| [skill.md](references/skill.md) | `viben skill` | Skill 管理 |
| [channel.md](references/channel.md) | `viben channel` | Chat Channel 管理 |

### 自动化

| Document | Command | Description |
|----------|---------|-------------|
| [cron.md](references/cron.md) | `viben cron` | 定时任务管理 |

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
