---
sidebar_position: 1
title: "配置概述"
description: "Viben CLI 配置系统概述 - 文件位置、环境变量和作用域解析"
---

# 配置概述

Viben CLI 使用分层配置系统，支持全局和工作区特定设置。配置文件采用 YAML 格式，便于阅读和编辑。

## 配置文件位置

CLI 使用以下目录结构存储配置：

```
~/.viben/                                    # 状态目录 (VIBEN_STATE_DIR)
├── config.yaml                              # 全局配置
├── providers.yaml                           # API Provider 配置
├── models.yaml                              # 模型配置（别名、回退链）
├── agents/                                  # 智能体实例
│   └── <agent-id>/
│       ├── config.yaml                      # 智能体特定配置
│       └── mcp_servers.json                 # 该智能体的 MCP 服务器
├── agent-templates/                         # 可复用的智能体模板
├── mcp/                                     # 共享 MCP 服务器（所有智能体可用）
│   └── installed.yaml
└── skills/                                  # 共享技能（所有智能体可用）
    └── installed.yaml

<project>/                                   # 项目工作区
├── .viben/
│   └── config.yaml                          # 工作区配置（覆盖全局）
├── .claude/                                 # Claude Code 工作区配置
└── .cursor/                                 # Cursor 工作区配置
```

## 环境变量

以下环境变量控制 CLI 行为：

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `VIBEN_STATE_DIR` | 所有 Viben 状态文件的根目录 | `~/.viben` |
| `VIBEN_CONFIG_PATH` | 全局配置文件路径 | `~/.viben/config.yaml` |
| `VIBEN_AGENT` | 当前使用的智能体 ID | `main` |
| `VIBEN_SCOPE` | 配置作用域（`global` 或 `workspace`） | 自动检测 |

### 设置环境变量

```bash
# 设置状态目录
export VIBEN_STATE_DIR="$HOME/.viben"

# 使用指定智能体
export VIBEN_AGENT="my-agent"

# 强制使用全局作用域
export VIBEN_SCOPE="global"
```

## 全局配置文件

主配置文件位于 `~/.viben/config.yaml`：

```yaml
# ~/.viben/config.yaml
version: 1

# 通用设置
settings:
  editor: code          # viben config edit 的默认编辑器
  pager: less           # 长输出的分页器
  color: auto           # 颜色输出：auto、always、never

# 智能体引用
agents:
  - claude-code
  - cursor

# 默认 MCP 服务器（全局启用）
mcp:
  enabled:
    - filesystem
    - git
  disabled:
    - browser

# 默认技能
skills:
  enabled:
    - code-review
    - commit
```

## 作用域解析

CLI 根据上下文自动确定使用哪个配置：

### 优先级（从高到低）

1. **命令行标志**（`--global` 或 `--workspace`）
2. **环境变量**（`VIBEN_SCOPE`）
3. **自动检测**：
   - 如果当前目录或任何祖先目录存在 `.viben/`：`workspace`
   - 否则：`global`

### 示例

```bash
# 自动检测作用域（存在 .viben/ 则为 workspace，否则为 global）
viben config list

# 强制使用全局作用域
viben config list --global
viben config list -g

# 强制使用工作区作用域
viben config list --workspace
```

### 配置合并

使用工作区作用域时，配置会与全局设置合并：

```
优先级（从高到低）：
1. 命令行参数
2. 工作区配置（.viben/config.yaml）
3. 全局配置（~/.viben/config.yaml）
```

例如，如果全局配置启用了 `filesystem` MCP，工作区配置启用了 `git` MCP，则两者都可用。

## 快速命令

```bash
# 在当前目录初始化工作区
viben init

# 查看所有配置
viben config list

# 查看配置及来源信息
viben config list --show-origin

# 获取特定值
viben config get settings.editor

# 设置值
viben config set settings.editor vim

# 编辑配置文件
viben config edit
viben config edit --global
```

## 配置文件概览

| 文件 | 用途 | 作用域 |
|------|------|--------|
| `config.yaml` | 通用 CLI 设置 | 全局/工作区 |
| `providers.yaml` | API Provider 凭证 | 仅全局 |
| `models.yaml` | 模型别名和回退链 | 仅全局 |
| `agents/<id>/config.yaml` | 每个智能体的设置 | 仅全局 |
| `mcp/installed.yaml` | 已安装的 MCP 服务器 | 仅全局 |
| `skills/installed.yaml` | 已安装的技能 | 仅全局 |

## 下一步

- [Config 命令](./config-command.md) - 学习 git 风格的配置管理
- [Provider 配置](./providers.md) - 配置 API Provider（Anthropic、OpenAI 等）
- [模型配置](./models.md) - 设置模型别名和回退链
