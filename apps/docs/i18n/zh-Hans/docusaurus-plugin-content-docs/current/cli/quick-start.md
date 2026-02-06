---
sidebar_position: 3
title: "快速开始"
description: "5 分钟内快速上手 Viben CLI"
---

# 快速开始

5 分钟内让 Viben CLI 运行起来。

## 步骤 1：安装 Viben CLI

```bash
npm install -g @viben/cli
```

验证安装：

```bash
viben --help
```

## 步骤 2：初始化您的第一个工作区

进入您的项目目录并初始化 Viben：

```bash
cd /path/to/your/project
viben init
```

输出：

```
Initialized Viben workspace in /path/to/your/project
  Created .viben/config.yaml

Next steps:
  viben provider create -t anthropic    # 设置 API Provider
  viben mcp install <name>              # 安装 MCP 服务器
  viben skill install <name>            # 安装技能
```

## 步骤 3：配置 API Provider

设置您首选的 AI Provider。Viben 支持多个 Provider，包括 Anthropic、OpenAI、Google、Azure 等。

### 选项 A：使用环境变量（推荐）

将 API 密钥设置为环境变量：

```bash
# Anthropic
export ANTHROPIC_API_KEY="sk-ant-xxx"

# OpenAI
export OPENAI_API_KEY="sk-xxx"
```

然后创建 Provider：

```bash
viben provider create -t anthropic
```

### 选项 B：直接提供 API 密钥

```bash
viben provider create -t anthropic --api-key "sk-ant-xxx"
```

:::tip
直接提供 API 密钥时，它将被加密并安全存储在 `~/.viben/providers.yaml` 中。
:::

### 验证 Provider

检查 Provider 连通性：

```bash
viben provider status
```

输出：

```
Provider Status:
  anthropic-main   anthropic   ✓ connected   latency: 120ms
```

## 步骤 4：创建您的第一个智能体

创建一个 AI 智能体实例：

```bash
viben agent create -n my-agent
```

输出：

```
Agent: my-agent
Type: claude-code
Created: 2024-01-15

Paths:
  Config:   ~/.viben/agents/my-agent/config.yaml
  Memory:   ~/.viben/agents/my-agent/memory/
  Sessions: ~/.viben/agents/my-agent/.agent_sessions/
```

### 配置智能体

为您的智能体设置模型：

```bash
viben agent config -n my-agent set model claude-sonnet-4-20250514
```

### 设为默认

将此智能体设为默认：

```bash
viben agent set-default -n my-agent
```

## 步骤 5：安装 MCP 服务器

安装常用的 MCP 服务器：

```bash
# 文件系统访问
viben mcp install filesystem

# Git 操作
viben mcp install git
```

列出已安装的 MCP 服务器：

```bash
viben mcp list
```

输出：

```
Installed MCP Servers:
  filesystem    v1.2.0    enabled    Local filesystem access
  git           v2.0.1    enabled    Git operations
```

## 步骤 6：验证设置

检查整体状态：

```bash
viben agent status
```

输出：

```
Agent: my-agent (default)
Type: claude-code
Model: claude-sonnet-4-20250514 (anthropic-main)

MCP: filesystem, git (2 enabled)
Skills: none

Memory:
  MEMORY.md     0 KB    empty

Sessions: 0
```

## 常用工作流

### 查看所有配置

```bash
# 列出所有配置（显示全局和工作区）
viben config list --show-origin
```

### 编辑配置

```bash
# 在编辑器中打开配置
viben config edit

# 或设置特定值
viben config set settings.editor vim
```

### 管理多个智能体

```bash
# 列出所有智能体
viben agent list

# 从模板创建智能体
viben agent create -n research-bot -f coding-assistant

# 切换默认智能体
viben agent set-default -n research-bot
```

### 配置模型别名

设置便捷的模型别名：

```bash
# 创建别名以便快速引用
viben model aliases create -n fast -f claude-3-5-haiku-latest
viben model aliases create -n smart -f claude-sonnet-4-20250514
viben model aliases create -n best -f claude-opus-4-20250514
```

现在您可以使用 `fast`、`smart` 或 `best` 代替完整的模型名称：

```bash
viben agent config -n my-agent set model smart
```

### 设置模型回退链

配置主模型不可用时的回退模型：

```bash
viben model fallbacks create -n claude-sonnet-4-20250514
viben model fallbacks create -n gpt-4-turbo
viben model fallbacks create -n claude-3-5-haiku-latest
```

### 工作区特定配置

为特定项目覆盖全局设置：

```bash
# 在您的项目目录中
viben config set --workspace mcp.enabled '["filesystem", "git", "browser"]'
```

## 用于自动化的 JSON 输出

所有命令都支持 `--json` 标志，用于脚本和 AI 智能体集成：

```bash
# 以 JSON 格式获取智能体列表
viben agent list --json

# 以 JSON 格式获取 Provider 状态
viben provider status --json
```

JSON 输出示例：

```json
{
  "success": true,
  "data": {
    "current": "my-agent",
    "agents": [
      {
        "id": "my-agent",
        "name": "My Agent",
        "type": "claude-code",
        "path": "~/.viben/agents/my-agent/"
      }
    ]
  }
}
```

## 快速参考

| 任务 | 命令 |
|------|------|
| 初始化工作区 | `viben init` |
| 创建 Provider | `viben provider create -t <type>` |
| 创建智能体 | `viben agent create -n <name>` |
| 配置智能体 | `viben agent config -n <name> set <key> <value>` |
| 安装 MCP | `viben mcp install <name>` |
| 安装技能 | `viben skill install <name>` |
| 检查状态 | `viben agent status` |
| 列出智能体 | `viben agent list` |
| 列出 Provider | `viben provider list` |
| 列出模型 | `viben model list` |

## 下一步

现在 Viben CLI 已设置完成，您可以：

- 探索[智能体管理](/docs/cli#架构概览)以了解完整的智能体生命周期
- 配置额外的 [API Provider](/docs/cli#配置文件格式) 以获得更多模型选择
- 安装更多 [MCP 服务器](/docs/mcp-server/configuration) 以扩展功能
