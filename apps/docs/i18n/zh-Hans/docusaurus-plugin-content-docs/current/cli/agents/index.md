---
sidebar_position: 1
title: "智能体管理"
description: "Viben CLI 智能体管理概述 - 概念、架构和命令"
---

# 智能体管理

Viben CLI 提供了全面的智能体管理工具。**智能体**是一个独立的 AI 助手实例，拥有自己的配置、记忆和会话。

## 关键概念

| 概念 | 说明 |
|------|------|
| **智能体 (Agent)** | 独立的 AI 助手实例，拥有自己的配置、记忆和会话 |
| **模板 (Template)** | 可复用的智能体配置模板，用于创建新智能体 |
| **记忆 (Memory)** | 智能体的长期记忆 (MEMORY.md + 每日日志) |
| **会话 (Session)** | 智能体的对话历史和状态 |
| **工作区配置 (Workspace Config)** | 项目特定的智能体类型配置 (如 `.claude/`) |

## 架构概述

```
                          Viben CLI
+---------------------------------------------------------+
|  Agent Template (可复用的智能体配置模板)                   |
|    |                                                     |
|    +-- Agent Instance (独立的智能体实例)                  |
|          |-- config.yaml (智能体配置)                     |
|          |-- mcp_servers.json (MCP 配置)                 |
|          |-- skills/ (智能体专属技能)                     |
|          |-- memory/ (智能体记忆)                         |
|          |   |-- MEMORY.md (主记忆)                       |
|          |   +-- YYYY-MM-DD.md (每日日志, append-only)    |
|          |-- .agentrc (启动配置)                          |
|          |-- .agent_history (命令历史)                    |
|          +-- .agent_sessions/<session_id>/ (会话)        |
+---------------------------------------------------------+
```

## 智能体目录结构

每个智能体存储在 `~/.viben/agents/<agent-id>/`:

```
~/.viben/agents/<agent-id>/
|-- config.yaml              # 智能体配置
|-- mcp_servers.json         # MCP 服务器配置
|-- skills/                  # 智能体专属技能
|-- memory/                  # 智能体记忆
|   |-- MEMORY.md            # 主记忆文件 (结构化知识)
|   |-- 2024-01-15.md        # 每日日志 (append-only)
|   |-- 2024-01-16.md        # 会话启动时读取今天+昨天
|   +-- ...
|-- .agentrc                 # 智能体启动配置
|-- .agent_history           # 命令历史
+-- .agent_sessions/         # 会话存储
    +-- <session_id>/
        |-- config.yaml              # 会话配置
        +-- messages.rollout.jsonl   # 消息历史 (JSONL)
```

## 运行时配置合并

智能体运行时，配置按以下顺序合并:

```
1. ~/.viben/agents/<id>/config.yaml     # 智能体基础配置
2. <project>/.claude/ (或其他类型)       # 工作区智能体类型配置
3. 命令行参数                            # 运行时覆盖
```

例如：在 `/projects/my-app` 目录下运行智能体 `main`，会先加载 `~/.viben/agents/main/config.yaml`，再叠加 `/projects/my-app/.claude/` 的配置。

## 智能体 vs 模板

| 方面 | 智能体 | 模板 |
|------|--------|------|
| **用途** | 活跃的 AI 助手实例 | 可复用的配置蓝图 |
| **存储** | `~/.viben/agents/<id>/` | `~/.viben/agent-templates/<id>/` |
| **记忆** | 有记忆和会话 | 无运行时状态 |
| **使用** | 直接交互 | 创建新智能体 |

## 快速命令

```bash
# 列出所有智能体
viben agent list

# 创建新智能体
viben agent create -n my-agent

# 从模板创建
viben agent create -n my-agent -f coding-assistant

# 克隆现有智能体
viben agent create -n my-agent --clone existing-agent

# 查看智能体详情
viben agent show -n my-agent

# 配置智能体
viben agent config -n my-agent set model gpt-4

# 删除智能体
viben agent remove -n my-agent

# 设置默认智能体
viben agent set-default -n my-agent

# 查看智能体状态
viben agent status
```

## 命令输出格式

所有智能体命令都支持 `--json` 标志以获得机器可读的输出:

**人类可读输出:**
```
Agents:
  main*         claude-code   3 sessions   ~/.viben/agents/main/
  my-agent      claude-code   1 session    ~/.viben/agents/my-agent/
  research-bot  gemini        0 sessions   ~/.viben/agents/research-bot/

* = 当前智能体
```

**JSON 输出 (`--json` 标志):**
```json
{
  "success": true,
  "data": {
    "current": "main",
    "agents": [
      {
        "id": "main",
        "name": "Main Agent",
        "type": "claude-code",
        "path": "~/.viben/agents/main/",
        "session_count": 3,
        "memory_size": "5.6 KB"
      }
    ]
  }
}
```

## 支持的智能体类型

| 类型 | 说明 |
|------|------|
| `claude-code` | Claude Code (Anthropic) |
| `cursor` | Cursor AI |
| `gemini` | Google Gemini |
| `codex` | OpenAI Codex |
| `windsurf` | Windsurf |
| `amp` | Amp |
| `opencode` | OpenCode |
| `qwen-code` | 通义灵码 |
| `droid` | Droid |

## 下一步

- [创建智能体](/docs/cli/agents/creating-agents) - 创建和管理智能体
- [智能体配置](/docs/cli/agents/agent-configuration) - 配置智能体设置
- [记忆系统](/docs/cli/agents/memory-system) - 了解智能体记忆
- [会话](/docs/cli/agents/sessions) - 管理智能体会话
- [模板](/docs/cli/agents/templates) - 使用智能体模板
