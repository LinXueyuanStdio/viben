---
sidebar_position: 1
title: "命令概览"
description: "Viben CLI 命令、全局选项和输出格式概览"
---

# 命令概览

Viben CLI (`viben`) 是一个用于配置应用、管理服务和查询状态的引导工具。它既可供人类使用，也可供 AI 智能体使用。

## 命令结构

```
viben <command> [subcommand] [options]
```

## 可用命令

| 命令 | 说明 |
|------|------|
| [`init`](./init.md) | 在当前目录初始化工作区 |
| [`config`](./config.md) | 配置管理（git 风格） |
| [`service`](./service.md) | 管理后台服务 |
| [`gateway`](./gateway.md) | 启动 Gateway（消息总线 + agent 循环） |
| [`executor`](./executor.md) | 发现和查看执行器（Claude Code、Cursor 等） |
| [`agent`](./agent.md) | 管理智能体实例和模板 |
| [`provider`](./provider.md) | 管理 API 提供商（OpenAI、Anthropic 等） |
| [`model`](./model.md) | 管理模型、别名和回退链 |
| [`mcp`](./mcp.md) | 管理 MCP 服务器 |
| [`skill`](./skill.md) | 管理技能 |
| [`channel`](./channel.md) | 管理聊天渠道（Telegram、Discord 等） |
| [`cron`](./cron.md) | 管理定时任务 |
| [`team`](./team.md) | 团队协作工作区管理 |
| [`workspace`](./workspace.md) | 工作区操作 |
| `version` | 显示版本信息 |
| `help` | 显示帮助 |

## 全局选项

这些选项适用于所有命令：

| 选项 | 简写 | 说明 |
|------|------|------|
| `--json` | | 输出 JSON（供智能体解析） |
| `--global` | `-g` | 使用全局配置 |
| `--workspace` | | 使用工作区配置（当前目录） |
| `--name <id>` | `-n` | 指定智能体名称/ID（默认：当前或 'main'） |
| `--verbose` | `-v` | 详细输出 |
| `--quiet` | `-q` | 抑制非必要输出 |
| `--help` | `-h` | 显示帮助 |

## JSON 输出格式

所有命令都支持 `--json` 标志以获取结构化输出，这对 AI 智能体和脚本很有用。

### 响应结构

```typescript
interface CLIResponse {
  success: boolean;
  data?: any;
  error?: {
    code: string;
    message: string;
  };
}
```

### 成功响应

```json
{
  "success": true,
  "data": {
    "path": "/path/to/project/.viben",
    "files": ["config.yaml"]
  }
}
```

### 错误响应

```json
{
  "success": false,
  "error": {
    "code": "MCP_NOT_FOUND",
    "message": "MCP server 'unknown-mcp' not found in marketplace"
  }
}
```

## 作用域解析

CLI 根据当前目录自动检测作用域（全局或工作区）：

| 优先级 | 来源 | 说明 |
|--------|------|------|
| 1 | 命令行标志 | `--global` 或 `--workspace` |
| 2 | 环境变量 | `VIBEN_SCOPE` |
| 3 | 自动检测 | 如果当前或父目录存在 `.viben/`：工作区；否则：全局 |

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `VIBEN_STATE_DIR` | 状态目录 | `~/.viben` |
| `VIBEN_CONFIG_PATH` | 配置文件路径 | `~/.viben/config.yaml` |
| `VIBEN_AGENT` | 当前智能体 ID | `main` |
| `VIBEN_SCOPE` | 配置作用域 | 自动检测 |

## 配置文件

### 全局配置

位于 `~/.viben/config.yaml`：

```yaml
version: 1

settings:
  editor: code
  pager: less
  color: auto

agents:
  - claude-code
  - cursor

mcp:
  enabled:
    - filesystem
    - git
  disabled:
    - browser

skills:
  enabled:
    - code-review
    - commit
```

### 工作区配置

位于 `<project>/.viben/config.yaml`，覆盖工作区的全局设置。

## 智能体集成

AI 智能体可以通过 Bash 工具使用 CLI：

```bash
# 获取当前配置
viben config list --json

# 为工作区安装 MCP
viben mcp install filesystem --workspace --json

# 配置智能体 MCP
viben agent config claude-code mcp add filesystem --json

# 同步到智能体
viben agent sync claude-code --json
```

## 下一步

- [viben init](./init.md) - 初始化工作区
- [viben config](./config.md) - 管理配置
- [viben agent](./agent.md) - 管理智能体
- [viben mcp](./mcp.md) - 管理 MCP 服务器
- [viben gateway](./gateway.md) - 启动 Gateway
