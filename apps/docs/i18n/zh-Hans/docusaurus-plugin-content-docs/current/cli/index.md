---
sidebar_position: 1
title: "CLI 概览"
description: "Viben CLI - 用于配置应用、管理服务和查询状态的引导工具"
---

# Viben CLI

**Viben CLI** (`viben`) 是一个用于配置应用、管理 AI 智能体实例和查询系统状态的引导工具。它同时服务于人类用户和 AI 智能体，为复杂的配置任务提供统一的接口。

## 什么是 Viben CLI？

Viben CLI 针对两个主要使用场景设计：

1. **人类使用**：命令行配置应用、启动服务、查看状态
2. **AI 智能体使用**：智能体通过 Bash 工具调用 CLI 来配置复杂的智能体设置、MCP 服务器和技能

## 核心功能

| 功能 | 描述 |
|------|------|
| **智能体管理** | 创建、配置和管理多个 AI 智能体实例 |
| **Provider 配置** | 设置 API Provider（OpenAI、Anthropic、Google、Azure 等） |
| **模型管理** | 配置模型别名、回退链和每个模型的设置 |
| **MCP 服务器管理** | 安装、启用和配置 MCP 服务器 |
| **技能管理** | 安装和管理智能体技能 |
| **服务控制** | 启动、停止和监控后台服务 |
| **作用域感知** | 自动检测工作区，支持全局/工作区配置 |

## 设计原则

### 简单且专注

CLI 不处理复杂的交互任务。它专注于：
- 配置管理
- 状态查询
- 服务生命周期

### 人机友好

- **人类模式**：彩色、格式化的终端输出（默认）
- **机器模式**：使用 `--json` 标志输出结构化 JSON，供 AI 智能体解析

### 作用域感知

CLI 自动检测您的工作区上下文：
- 如果您在包含 `.viben/` 的目录中，使用工作区配置
- 否则，使用全局配置（`~/.viben/`）
- 可通过 `--global` 或 `--workspace` 标志覆盖

## 技术栈

| 组件 | 选择 | 原因 |
|------|------|------|
| 运行时 | Node.js | 复用现有 TypeScript 代码和包 |
| 框架 | Commander.js | 成熟稳定，生态丰富 |
| 配置 | YAML | 人类可读，支持注释 |
| 输出 | Chalk + JSON | 彩色终端 + 结构化输出 |

## 命令概览

```
viben <command> [subcommand] [options]

命令:
  init          在当前目录初始化工作区
  config        配置管理（git 风格）
  service       管理后台服务
  agent         管理智能体实例和模板
  provider      管理 API Provider（OpenAI、Anthropic 等）
  model         管理模型、别名和回退链
  mcp           管理 MCP 服务器
  skill         管理技能
  workspace     工作区操作
  version       显示版本信息
  help          显示帮助
```

### 全局选项

所有命令都支持以下全局选项：

| 选项 | 描述 |
|------|------|
| `--json` | 输出为 JSON（供智能体解析） |
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
├── agents/                                  # 智能体实例
│   └── <agent-id>/                          # 单个智能体
│       ├── config.yaml                      # 智能体配置
│       ├── mcp_servers.json                 # MCP 服务器配置
│       ├── skills/                          # 智能体专属技能
│       └── memory/                          # 智能体记忆
├── providers.yaml                           # API Provider 配置
├── models.yaml                              # 模型配置
├── mcp/                                     # 共享 MCP 服务器
└── skills/                                  # 共享技能

<project>/.viben/                            # 工作区配置（可选）
└── config.yaml                              # 工作区特定覆盖
```

## 配置文件格式

Viben CLI 使用 YAML 格式实现人类可读的配置：

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
```

## 环境变量

| 变量 | 描述 | 默认值 |
|------|------|--------|
| `VIBEN_STATE_DIR` | 状态目录 | `~/.viben` |
| `VIBEN_CONFIG_PATH` | 配置文件路径 | `~/.viben/config.yaml` |
| `VIBEN_AGENT` | 当前智能体 ID | `main` |
| `VIBEN_SCOPE` | 配置作用域 | 自动检测 |

## 智能体集成

AI 智能体可以通过 Bash 工具调用 Viben CLI。`--json` 标志确保输出结构化数据供智能体解析：

```bash
# 获取当前配置
viben config list --json

# 为工作区安装 MCP 服务器
viben mcp install filesystem --workspace --json

# 配置智能体
viben agent config my-agent set model gpt-4 --json
```

### JSON 响应格式

所有带 `--json` 标志的命令返回结构化响应：

```json
{
  "success": true,
  "data": {
    "key": "value"
  }
}
```

错误响应包含错误代码，便于程序化处理：

```json
{
  "success": false,
  "error": {
    "code": "MCP_NOT_FOUND",
    "message": "MCP server 'unknown-mcp' not found in marketplace"
  }
}
```

## 下一步

- [安装](/docs/cli/installation) - 安装 Viben CLI
- [快速开始](/docs/cli/quick-start) - 开始基本配置
