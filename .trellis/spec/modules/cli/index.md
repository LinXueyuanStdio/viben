# CLI Module Specifications

> Viben CLI 命令的详细设计文档

## 文档列表

| 文档 | 命令 | 说明 | 状态 |
|------|------|------|------|
| [init.md](./init.md) | `viben init` | 工作区初始化 | 待实现 |
| [config.md](./config.md) | `viben config` | Git 风格配置管理 | 待实现 |
| [service.md](./service.md) | `viben service` | 后台服务管理 | 待实现 |
| [gateway.md](./gateway.md) | `viben gateway` | Gateway 运行时 | 待实现 |
| [executor.md](./executor.md) | `viben executor` | Executor 发现和 Chat | 部分实现 |
| [executor-chat.md](./executor-chat.md) | `viben executor chat` | 非交互式调用 AI coding agent | 待实现 |
| [agent.md](./agent.md) | `viben agent` | Agent 管理 | 待实现 |
| [provider.md](./provider.md) | `viben provider` | API Provider 管理 | 待实现 |
| [model.md](./model.md) | `viben model` | Model 管理 | 待实现 |
| [channel.md](./channel.md) | `viben channel` | Chat Channel 管理 | 部分实现 |
| [cron.md](./cron.md) | `viben cron` | 定时任务管理 | 待实现 |
| [mcp.md](./mcp.md) | `viben mcp` | MCP Server 管理 | 部分实现 |
| [skill.md](./skill.md) | `viben skill` | Skill 管理 | 待实现 |
| [workspace.md](./workspace.md) | `viben workspace` | 工作区操作 | 待实现 |

## 命令结构

```
viben <command> [subcommand] [options]

Commands:
  init          Initialize workspace in current directory
  config        Configuration management (git-style)
  service       Manage background services
  gateway       Start the gateway (message bus + agent loop)
  executor      Discover and inspect executors (Claude Code, Cursor, etc.)
  agent         Manage agent instances and templates
  provider      Manage API providers (OpenAI, Anthropic, etc.)
  model         Manage models, aliases, and fallbacks
  mcp           Manage MCP servers
  skill         Manage skills
  channel       Manage chat channels (Telegram, Discord, WhatsApp, Feishu)
  cron          Manage scheduled tasks
  workspace     Workspace operations
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
