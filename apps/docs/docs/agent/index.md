---
sidebar_position: 1
title: Agent 开发指南
description: Viben Agent 开发完整指南
---

# Agent 开发指南

本文档为 Agent 开发者提供完整的开发指南，包括 Agent 核心概念、CLI 命令、MCP 开发、Skill 开发等内容。

## 目录

| 文档 | 描述 |
|------|------|
| [MCP 开发](./mcp-development.md) | MCP Server 开发指南 |
| [Skill 开发](./skill-development.md) | Skill 开发指南 |
| [CLI 集成](./cli-integration.md) | Viben CLI 完整命令参考 |
| [Agent 模板](./templates/agent-templates.md) | Agent 模板开发指南 |
| [最佳实践](./best-practices.md) | Agent 开发最佳实践 |

## 核心概念

### 什么是 Agent?

Agent（智能体）是 Viben 中的核心概念，它是一个独立的智能体实例，拥有自己的配置、记忆和会话。

| 概念 | 说明 |
|------|------|
| **Agent** | 独立的智能体实例，拥有自己的配置、记忆、会话 |
| **Executor** | 底层 coding agent 工具 (Claude Code, Cursor 等)，Agent 基于 Executor 运行 |
| **Memory** | Agent 的长期记忆 (MEMORY.md + 每日日志) |
| **Session** | Agent 的会话存储 (对话历史、状态) |
| **Skill** | Agent 的可复用能力单元 |
| **MCP Server** | Agent 与外部数据源、工具交互的桥梁 |

### Agent 与 Executor 的关系

```
Agent = Executor + Skills + Prompts + MCP + Memory
```

- **Executor**: 底层 coding agent，负责执行任务 (如 Claude Code, Cursor, Gemini CLI)
- **Agent**: Viben 配置的智能体实例，基于某个 Executor 运行

一个 Executor 可以支持多个 Agent 实例。

### 架构图

```
┌─────────────────────────────────────────────────────────────┐
│                    Viben Agent 架构                          │
├─────────────────────────────────────────────────────────────┤
│  Agent Instance (独立的 agent 实例)                         │
│      ├── config.yaml (agent 配置)                          │
│      ├── mcp_servers.json (MCP 配置)                       │
│      ├── skills/ (agent 专属 skills)                       │
│      ├── memory/ (agent 记忆)                              │
│      │   ├── MEMORY.md (主记忆)                            │
│      │   └── YYYY-MM-DD.md (每日日志, append-only)         │
│      ├── .agentrc (启动配置)                               │
│      ├── .agent_history (命令历史)                         │
│      └── .agent_sessions/<session_id>/ (会话存储)          │
└─────────────────────────────────────────────────────────────┘
```

## 快速开始

### 1. 创建 Agent

```bash
# 创建新 agent
viben agent create my-agent

# 从模板创建
viben agent create my-agent --from-template coding-assistant

# 克隆现有 agent
viben agent create my-agent --clone existing-agent

# 将 agent 标记为模板
viben agent update my-agent --is-template true

# 列出所有模板
viben agent list --templates
```

### 2. 配置 Agent

```bash
# 查看配置
viben agent config my-agent

# 设置模型
viben agent config my-agent --set model=gpt-4

# 启用 MCP
viben agent config my-agent --set mcp.enabled="[\"filesystem\",\"git\"]"
```

### 3. 安装 Skill

```bash
# 全局安装
viben skill install code-review

# 安装到指定 agent
viben skill install code-review --agent my-agent
```

### 4. 配置 MCP

```bash
# 添加 MCP server
viben mcp add filesystem --agent my-agent --command npx --args @anthropic-ai/mcp-server-filesystem /home/user

# 查看 MCP 列表
viben mcp list --agent my-agent
```

### 5. 使用 Agent 对话

```bash
# 非交互式对话
viben agent chat -n my-agent -p "分析这段代码"

# 从 stdin 读取
echo "写一个排序函数" | viben agent chat -n my-agent

# 指定工作目录
viben agent chat -n my-agent -p "分析项目结构" -C /path/to/project
```

## Agent 存储路径

```
~/.viben/agents/<agent-id>/
├── config.yaml              # Agent 配置
├── mcp_servers.json         # MCP servers 配置
├── skills/                  # Agent 专属 skills
├── memory/                  # Agent 记忆
│   ├── MEMORY.md            # 主记忆文件 (结构化知识)
│   ├── 2024-01-15.md        # 每日日志 (append-only)
│   └── ...
├── .agentrc                 # Agent 启动配置
├── .agent_history           # 命令历史
└── .agent_sessions/         # 会话存储
    └── <session_id>/
        ├── config.yaml      # 会话配置
        └── messages.rollout.jsonl  # 消息历史 (JSONL)
```

## Agent 配置文件

```yaml
# ~/.viben/agents/my-agent/config.yaml
version: 1

# Agent 元数据
id: my-agent
name: "My Coding Assistant"
description: "A helpful coding assistant"
created: 2024-01-15T10:30:00Z

# Agent 类型 (决定运行时行为)
type: claude-code  # claude-code | cursor | gemini | codex | ...

# 类型特定配置
type_config:
  plan: true
  dangerously_skip_permissions: false
  append_prompt: "You are a helpful coding assistant."

# MCP 配置
mcp:
  enabled:
    - filesystem
    - git
  disabled:
    - browser

# Skills 配置
skills:
  enabled:
    - code-review
    - commit
```

## 支持的 Executor 类型

| ID | 名称 | 说明 |
|------|------|------|
| `CLAUDE_CODE` | Claude Code | Anthropic 官方 CLI |
| `CURSOR` | Cursor | AI-first 编辑器 |
| `GEMINI_CLI` | Gemini CLI | Google Gemini CLI |
| `CODEX` | OpenAI Codex | OpenAI Codex CLI |
| `WINDSURF` | Windsurf | Codeium IDE |
| `AMP` | Amp | Sourcegraph Amp |
| `OPENCODE` | OpenCode | 开源 coding agent |
| `QWEN_CODE` | Qwen Code | 阿里通义千问 coding agent |
| `AIDER` | Aider | AI pair programming |
| `CONTINUE` | Continue | IDE 插件 |

## Memory 系统

Agent 记忆系统采用双层设计：

| 文件 | 说明 | 读取时机 |
|------|------|----------|
| `memory/MEMORY.md` | 主记忆文件，结构化知识 | 每次会话启动 |
| `memory/YYYY-MM-DD.md` | 每日日志，append-only | 今天 + 昨天在会话启动时读取 |

**每日日志格式**:

```markdown
# 2024-01-16

## 10:30 - Session started
- Working on feature X
- Discovered issue with Y

## 14:15 - Completed task
- Fixed bug in Z
- Updated documentation

## 17:00 - Session ended
- Next steps: review PR, deploy to staging
```

## 运行时配置合并

Agent 实际运行时，配置按以下顺序叠加：

```
1. ~/.viben/agents/<id>/config.yaml     # Agent 基础配置
2. <project>/.claude/ (或其他 agent 类型)  # 工作区 agent 类型配置
3. 命令行参数                              # 运行时覆盖
```

例如：在 `/projects/my-app` 目录下运行 agent `main`，会先加载 `~/.viben/agents/main/config.yaml`，如果 type 为 `claude-code`，再叠加 `/projects/my-app/.claude/` 的配置。

## 下一步

- 阅读 [MCP 开发指南](./mcp-development.md) 了解如何开发 MCP Server
- 阅读 [Skill 开发指南](./skill-development.md) 了解如何开发 Skill
- 阅读 [CLI 集成指南](./cli-integration.md) 了解完整的 CLI 命令
- 阅读 [最佳实践](./best-practices.md) 了解开发技巧
