---
sidebar_position: 1
title: "命令概览"
description: "微本 CLI 命令、全局选项和输出格式概览"
---

# 命令概览

Viben CLI (`viben`) 是 **Agent Swarm x Code Evolution** 的命令行界面。它支持 AI 智能体集群的编排，用于持续代码改进和智能任务管理。

## 命令结构

```
viben <命令> [子命令] [选项]
```

## 核心命令 (Agent Swarm x Code Evolution)

这些命令代表代码进化的主要工作流：

| 命令 | 描述 |
|------|------|
| [`task`](./task.md) | XState 驱动的任务管理，支持状态机工作流 |
| [`swarm`](./swarm.md) | 编排多个智能体并行工作 |
| [`idea`](./idea.md) | AI 驱动的功能和改进点生成 |
| [`queue`](./queue.md) | 后台命令执行，支持并发控制 |
| [`evo`](./evo.md) | FileEvo - 基于文件的自我进化代码优化 |

## 智能体与配置命令

| 命令 | 描述 |
|------|------|
| [`agent`](./agent.md) | 管理智能体实例和模板 |
| [`agent chat`](./agent-chat.md) | 使用智能体进行非交互式对话 |
| [`executor`](./executor.md) | 发现和查看执行器（Claude Code、Cursor 等）|
| [`executor chat`](./executor-chat.md) | 非交互式调用 AI coding agent |
| [`provider`](./provider.md) | 管理 API 提供商 (OpenAI、Anthropic 等) |
| [`model`](./model.md) | 管理模型、别名和回退链 |
| [`mcp`](./mcp.md) | 管理 MCP 服务器 |
| [`skill`](./skill.md) | 管理技能 |

## 工作区与服务命令

| 命令 | 描述 |
|------|------|
| [`init`](./init.md) | 在当前目录初始化工作区 |
| [`config`](./config.md) | 配置管理 (git 风格) |
| [`service`](./service.md) | 管理后台服务 |
| [`gateway`](./gateway.md) | 启动 Gateway（消息总线 + 智能体循环）|
| [`channel`](./channel.md) | 管理聊天渠道（Telegram、Discord 等）|
| [`cron`](./cron.md) | 管理定时任务 |
| [`workspace`](./workspace.md) | 工作区操作 |
| `version` | 显示版本信息 |
| `help` | 显示帮助 |

## 全局选项

这些选项适用于所有命令：

| 选项 | 简写 | 描述 |
|------|------|------|
| `--json` | | 输出 JSON 格式（供智能体解析）|
| `--global` | `-g` | 使用全局配置 |
| `--workspace` | | 使用工作区配置（当前目录）|
| `--name <id>` | `-n` | 指定智能体名称/ID（默认：当前或 'main'）|
| `--verbose` | `-v` | 详细输出 |
| `--quiet` | `-q` | 抑制非必要输出 |
| `--help` | `-h` | 显示帮助 |

## JSON 输出格式

所有命令都支持 `--json` 标志以输出结构化数据，这对 AI 智能体和脚本非常有用。

### 响应模式

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
    "task": {
      "id": "implement-auth",
      "state": "in_progress",
      "swarm": ["architect", "implementer"]
    }
  }
}
```

### 错误响应

```json
{
  "success": false,
  "error": {
    "code": "TASK_NOT_FOUND",
    "message": "Task 'unknown-task' not found in workspace"
  }
}
```

## 作用域解析

CLI 根据当前目录自动检测作用域（全局或工作区）：

| 优先级 | 来源 | 描述 |
|--------|------|------|
| 1 | 命令行标志 | `--global` 或 `--workspace` |
| 2 | 环境变量 | `VIBEN_SCOPE` |
| 3 | 自动检测 | 如果当前或父目录存在 `.viben/`：工作区；否则：全局 |

## 环境变量

| 变量 | 描述 | 默认值 |
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

# 群体 (Swarm) 配置
swarm:
  default_roles:
    - architect
    - implementer
    - reviewer
  max_parallel_agents: 4

# FileEvo 设置
evo:
  enabled: true
  metrics:
    - code_quality
    - test_coverage
    - complexity

mcp:
  enabled:
    - filesystem
    - git

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
# 任务工作流（主要用例）
viben task create "implement-auth" --json
viben task enqueue implement-auth --json
viben task start implement-auth --json

# 群体编排
viben swarm start --task implement-auth --json
viben swarm status --json

# 创意生成
viben idea generate --context "improve auth" --json

# 配置
viben config list --json
viben agent sync claude-code --json
```

## 下一步

- [viben task](./task.md) - XState 驱动的任务管理
- [viben swarm](./swarm.md) - 多智能体编排
- [viben idea](./idea.md) - AI 驱动的 idea 生成
- [viben queue](./queue.md) - 后台命令执行
- [viben agent](./agent.md) - 管理智能体
- [viben gateway](./gateway.md) - 启动 Gateway
