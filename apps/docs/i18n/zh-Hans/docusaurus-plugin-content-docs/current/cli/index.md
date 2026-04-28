---
sidebar_position: 1
title: "CLI 概览"
description: "Viben CLI - Agent Swarm x Code Evolution 的命令行工具"
---

# Viben CLI

**Viben CLI** (`viben`) 是 **Agent Swarm x Code Evolution** 的命令行接口。它为智能体集群编排、代码迭代优化和任务状态管理提供统一的命令行入口。

## 什么是 Viben CLI？

Viben CLI 是连接人类开发者和 AI 智能体集群的桥梁：

1. **面向人类**：通过命令行配置应用、启动服务和查看状态
2. **面向 AI 智能体**：智能体通过 Bash 工具调用 CLI 来配置复杂的 agent 设置、MCP 服务器和技能

## 核心功能

| 功能 | 说明 |
|------|------|
| **Agent Swarm** | 智能体集群编排，协调多个 AI 智能体协同工作 |
| **FileEvo (代码迭代优化)** | 基于文件的自我进化，通过反馈循环持续优化代码质量 |
| **Task System** | XState 状态机驱动的任务管理，支持 backlog → queue → in_progress → review → completed 工作流 |
| **Idea Generation** | 创意生成系统，激发和捕捉开发灵感 |
| **Agent 管理** | 创建、配置和管理多个 AI 智能体实例 |
| **Provider 配置** | 设置 API 提供商（OpenAI、Anthropic、Google、Azure 等） |
| **Model 管理** | 配置模型别名、回退链和模型级设置 |
| **Executor 发现** | 发现本地已安装的执行器（Claude Code、Cursor 等） |
| **MCP 服务器管理** | 安装、启用和配置 MCP 服务器 |
| **Skill 管理** | 安装和管理智能体技能 |
| **Gateway 运行时** | 启动连接 channels 到 agent loop 的核心运行时 |
| **Channel 管理** | 配置聊天渠道（Telegram、Discord、飞书等） |
| **Cron 定时任务** | 管理智能体的定时任务 |
| **Team 协作** | 初始化团队协作工作区 |
| **服务控制** | 启动、停止和监控后台服务 |
| **作用域感知** | 自动检测工作区，支持全局/工作区配置 |

## 设计原则

### 多智能体编排 (Agent Swarm x Code Evolution)

CLI 围绕通过 AI 协作持续改进代码的核心理念设计：

- **FileEvo**：智能体从代码变更结果中学习，做出更好的决策
- **群体智能 (Swarm Intelligence)**：多个专业化智能体并行工作
- **任务驱动 (Task-Driven)**：XState 状态机管理复杂的开发工作流
- **创意生成 (Idea Generation)**：AI 主动建议改进和新功能

### 人机友好

- **人类模式**：彩色、格式化的终端输出（默认）
- **机器模式**：使用 `--json` 标志输出结构化 JSON，便于 AI 智能体解析

### 作用域感知

CLI 自动检测你的工作区上下文：
- 如果当前目录包含 `.viben/`，则使用工作区配置
- 否则使用全局配置（`~/.viben/`）
- 可通过 `--global` 或 `--workspace` 标志覆盖

## 技术栈

| 组件 | 选择 | 原因 |
|------|------|------|
| 运行时 | Node.js | 复用现有 TypeScript 代码和包 |
| 框架 | Commander.js | 成熟稳定，生态丰富 |
| 状态机 | XState | 稳健的任务工作流管理 |
| 配置 | YAML | 人类可读，支持注释 |
| 输出 | Chalk + JSON | 彩色终端 + 结构化输出 |

## 命令概览

```
viben <command> [subcommand] [options]

核心命令 (Agent Swarm x Code Evolution):
  task          XState 驱动的任务管理，支持状态机工作流
  swarm         编排多个智能体并行工作
  idea          AI 驱动的功能和改进创意生成
  queue         后台命令执行，支持并发控制

智能体与配置:
  agent         管理智能体实例和模板
  provider      管理 API 提供商（OpenAI、Anthropic 等）
  model         管理模型、别名和回退链
  executor      发现和查看执行器（Claude Code、Cursor 等）
  mcp           管理 MCP 服务器
  skill         管理技能

工作区与服务:
  init          在当前目录初始化工作区
  config        配置管理（git 风格）
  service       管理后台服务
  gateway       启动 Gateway（消息总线 + 智能体循环）
  channel       管理聊天渠道（Telegram、Discord、飞书等）
  cron          管理定时任务
  team          团队协作工作区管理
  workspace     工作区操作
  version       显示版本信息
  help          显示帮助
```

### 全局选项

所有命令都支持以下全局选项：

| 选项 | 说明 |
|------|------|
| `--json` | 输出 JSON（供智能体解析） |
| `--global`, `-g` | 使用全局配置 |
| `--workspace` | 使用工作区配置（当前目录） |
| `-n`, `--name <id>` | 指定智能体名称/ID（默认：当前或 'main'） |
| `--verbose`, `-v` | 详细输出 |
| `--quiet`, `-q` | 抑制非必要输出 |
| `--help`, `-h` | 显示帮助 |

## 架构概览

```
~/.viben/                                    # 状态目录
├── config.yaml                              # 全局配置
├── queue/                                   # 命令队列（后台执行）
├── agents/                                  # 智能体实例
│   └── <agent-id>/                          # 单个智能体
│       ├── config.yaml                      # 智能体配置
│       ├── mcp_servers.json                 # MCP 服务器配置
│       ├── skills/                          # 智能体专属技能
│       ├── memory/                          # 智能体记忆
│       │   ├── MEMORY.md                    # 主记忆文件
│       │   └── YYYY-MM-DD.md                # 每日日志
│       ├── .agentrc                         # 启动配置
│       ├── .agent_history                   # 命令历史
│       └── .agent_sessions/                 # 会话存储
├── providers.yaml                           # API 提供商配置
├── models.yaml                              # 模型配置
├── channels.yaml                            # 渠道配置
├── cron.yaml                                # 定时任务配置
├── mcp/                                     # 共享 MCP 服务器
└── skills/                                  # 共享技能

<project>/.viben/                            # 工作区配置（可选）
├── config.yaml                              # 工作区特定覆盖
└── tasks/                                   # 任务存储（XState 工作流）
    └── <task-id>/
        ├── task.json                        # 任务状态和元数据
        └── context.md                       # 任务上下文和备注
```

## 配置文件格式

Viben CLI 使用 YAML 进行人类可读的配置：

```yaml
# ~/.viben/config.yaml
version: 1

# 全局设置
settings:
  editor: code
  pager: less
  color: auto

# 默认 MCP 服务器
mcp:
  enabled:
    - filesystem
    - git

# 默认技能
skills:
  enabled:
    - code-review
    - commit

# 群体 (Swarm) 配置
swarm:
  default_roles:
    - architect
    - implementer
    - reviewer
  max_parallel_agents: 4
```

## 环境变量

| 变量 | 描述 | 默认值 |
|------|------|--------|
| `VIBEN_STATE_DIR` | 状态目录 | `~/.viben` |
| `VIBEN_CONFIG_PATH` | 配置文件路径 | `~/.viben/config.yaml` |
| `VIBEN_AGENT` | 当前智能体 ID | `main` |
| `VIBEN_SCOPE` | 配置作用域 | 自动检测 |

## 智能体集成

AI 智能体可以通过 Bash 工具调用使用 Viben CLI。`--json` 标志确保输出结构化，便于智能体解析：

```bash
# 任务管理工作流
viben task create "implement-auth" --json
viben task enqueue implement-auth --json
viben task status implement-auth --json

# 群体编排
viben swarm start --task implement-auth --json

# 创意生成
viben idea generate --context "auth system" --json

# 配置
viben config list --json
viben agent config my-agent set model gpt-4 --json
```

### JSON 响应格式

所有带 `--json` 标志的命令返回结构化响应：

```json
{
  "success": true,
  "data": {
    "task": {
      "id": "implement-auth",
      "state": "in_progress",
      "agents": ["architect", "implementer"]
    }
  }
}
```

错误响应包含错误码，便于程序化处理：

```json
{
  "success": false,
  "error": {
    "code": "TASK_NOT_FOUND",
    "message": "Task 'unknown-task' not found in workspace"
  }
}
```

## 下一步

- [安装](./installation.md) - 安装 Viben CLI
- [快速开始](./quick-start.md) - 开始基本配置
- [任务系统](./commands/task.md) - 了解 XState 驱动的任务管理
- [Agent Swarm](/cli/agents/) - 了解多智能体编排
