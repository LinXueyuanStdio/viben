# CLI Module Specifications

> Viben CLI 命令的详细设计文档

## 文档列表

### 核心初始化与配置

| 文档 | 命令 | 说明 | 状态 |
|------|------|------|------|
| [init.md](./init.md) | `viben init` | 工作区初始化 | 待实现 |
| [config.md](./config.md) | `viben config` | Git 风格配置管理 | 待实现 |
| [workspace.md](./workspace.md) | `viben workspace` | 工作区操作 | 待实现 |
| [team.md](./team.md) | `viben team` | 团队协作工作区初始化 | 待实现 |
| [user.md](./user.md) | `viben user` | 用户身份管理 | 已实现 |

### 服务与运行时

| 文档 | 命令 | 说明 | 状态 |
|------|------|------|------|
| [service.md](./service.md) | `viben service` | 后台服务管理 | 待实现 |
| [gateway.md](./gateway.md) | `viben gateway` | Gateway 运行时 | 待实现 |

### 执行器与智能体

| 文档 | 命令 | 说明 | 状态 |
|------|------|------|------|
| [executor.md](./executor.md) | `viben executor` | Executor 发现和管理 | 部分实现 |
| [executor-chat.md](./executor-chat.md) | `viben executor chat` | 非交互式调用 AI coding agent | 待实现 |
| [agent.md](./agent.md) | `viben agent` | Agent 实例管理 | 待实现 |
| [agent-chat.md](./agent-chat.md) | `viben agent chat` | 基于 Agent 的对话 | 待实现 |

### 任务与集群调度

| 文档 | 命令 | 说明 | 状态 |
|------|------|------|------|
| [task.md](./task.md) | `viben task` | 任务管理（CRUD、上下文、规划、监控） | 待实现 |
| [swarm.md](./swarm.md) | `viben swarm` | 智能体集群调度（列出、启动、停止、清理） | 待实现 |

### 模型与服务商

| 文档 | 命令 | 说明 | 状态 |
|------|------|------|------|
| [provider.md](./provider.md) | `viben provider` | API Provider 管理 | 待实现 |
| [model.md](./model.md) | `viben model` | Model 管理 | 待实现 |

### 扩展与集成

| 文档 | 命令 | 说明 | 状态 |
|------|------|------|------|
| [mcp.md](./mcp.md) | `viben mcp` | MCP Server 管理 | 部分实现 |
| [skill.md](./skill.md) | `viben skill` | Skill 管理 | 待实现 |
| [channel.md](./channel.md) | `viben channel` | Chat Channel 管理 | 部分实现 |

### 自动化

| 文档 | 命令 | 说明 | 状态 |
|------|------|------|------|
| [cron.md](./cron.md) | `viben cron` | 定时任务管理 | 待实现 |

## 命令结构

```
viben <command> [subcommand] [options]

Commands:
  # 核心初始化与配置
  init          Initialize workspace in current directory
  config        Configuration management (git-style)
  workspace     Workspace operations
  team          Team collaboration workspace setup
  user          Manage user identity (init, get, status)

  # 服务与运行时
  service       Manage background services
  gateway       Start the gateway (message bus + agent loop)

  # 执行器与智能体
  executor      Discover and inspect executors (Claude Code, Cursor, etc.)
  agent         Manage agent instances and templates

  # 任务与集群调度
  task          Manage tasks (CRUD, context, planning, monitoring)
  swarm         Agent swarm orchestration (list, start, stop, cleanup)

  # 模型与服务商
  provider      Manage API providers (OpenAI, Anthropic, etc.)
  model         Manage models, aliases, and fallbacks

  # 扩展与集成
  mcp           Manage MCP servers
  skill         Manage skills
  channel       Manage chat channels (Telegram, Discord, WhatsApp, Feishu)

  # 自动化
  cron          Manage scheduled tasks

  # 通用
  version       Show version info
  help          Show help
```

## 全局选项

```
--json              Output as JSON (for Agent parsing)
--global, -g        Use global config
--workspace         Use workspace config (current directory)
-n, --name <id>     Specify agent name/ID (default: current or 'main')
--verbose, -v       Verbose output
--quiet, -q         Suppress non-essential output
--help, -h          Show help
```

## 关联文档

- [../cli-app.md](../cli-app.md) - CLI 应用总体规范（包含配置、测试等）
