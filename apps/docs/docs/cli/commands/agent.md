---
sidebar_position: 8
title: "viben agent"
description: "管理智能体实例、模板、会话和记忆"
---

# viben agent

管理智能体实例、模板、会话和记忆。

## 架构概述

```
┌─────────────────────────────────────────────────────────┐
│                    Viben CLI                            │
├─────────────────────────────────────────────────────────┤
│  Agent Instance (独立的智能体实例)                      │
│      ├── config.yaml (智能体配置)                       │
│      ├── mcp_servers.json (MCP 配置)                    │
│      ├── skills/ (智能体专属技能)                       │
│      ├── memory/ (智能体记忆)                           │
│      │   ├── MEMORY.md (主记忆)                         │
│      │   └── YYYY-MM-DD.md (每日日志, append-only)      │
│      ├── .agentrc (启动配置)                            │
│      ├── .agent_history (命令历史)                      │
│      └── .agent_sessions/<session_id>/ (会话存储)       │
└─────────────────────────────────────────────────────────┘
```

## 核心概念

| 概念 | 说明 |
|------|------|
| **Agent** | 独立的智能体实例，拥有自己的配置、记忆、会话 |
| **Memory** | 智能体的长期记忆 (MEMORY.md + 每日日志) |
| **Session** | 智能体的会话存储 (对话历史、状态) |
| **Workspace Config** | 项目工作区的 agent 类型配置 (如 `.claude/`) |

## 用法

```bash
viben agent <subcommand> [options]
```

## 子命令

| 子命令 | 说明 |
|--------|------|
| `list` | 列出所有智能体 |
| `create` | 创建新智能体 |
| `show` | 显示智能体详情 |
| `remove` | 删除智能体 |
| `config` | 查看或设置智能体配置 |
| `set-default` | 设置默认智能体 |
| `set-template` | 设置为模板 |
| `status` | 显示智能体状态 |
| `template` | 管理智能体模板 |
| `session` | 管理智能体会话 |
| `memory` | 管理智能体记忆 |
| `chat` | 使用智能体进行非交互式对话 |

## 智能体管理

### 列出智能体

列出所有配置的智能体：

```bash
viben agent list
viben agent list --json
```

**输出（人类可读）：**

```
Agents:
  main*         claude-code   3 sessions   ~/.viben/agents/main/
  my-agent      claude-code   1 session    ~/.viben/agents/my-agent/
  research-bot  gemini        0 sessions   ~/.viben/agents/research-bot/

* = current agent
```

**输出（JSON）：**

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
      },
      {
        "id": "my-agent",
        "name": "My Coding Assistant",
        "type": "claude-code",
        "path": "~/.viben/agents/my-agent/",
        "session_count": 1,
        "memory_size": "3.4 KB"
      }
    ]
  }
}
```

### 创建智能体

创建新智能体：

```bash
# 创建新智能体
viben agent create -n my-agent

# 从模板创建
viben agent create -n my-agent -f coding-assistant

# 从配置文件创建
viben agent create -n my-agent -f /path/to/config.yaml

# 克隆现有智能体
viben agent create -n my-agent --clone main

# 使用特定 executor
viben agent create -n my-agent --executor /path/to/executor
```

**输出：**

```
Created agent 'my-agent'
  Path: ~/.viben/agents/my-agent/
```

### 显示智能体

显示智能体详情：

```bash
viben agent show -n my-agent
```

**输出（人类可读）：**

```
Agent: my-agent
Name: My Coding Assistant
Type: claude-code
Created: 2024-01-15

Paths:
  Config:   ~/.viben/agents/my-agent/config.yaml
  Memory:   ~/.viben/agents/my-agent/memory/
  Sessions: ~/.viben/agents/my-agent/.agent_sessions/

Memory:
  MEMORY.md     2.3 KB    last modified 2h ago
  2024-01-16.md 1.1 KB    today
  2024-01-15.md 3.2 KB    yesterday

Sessions (1):
  main   "Feature development"   2h ago   42 messages

MCP: filesystem, git (2 enabled)
Skills: code-review, commit (2 enabled)
```

### 删除智能体

删除智能体：

```bash
# 删除智能体（需确认）
viben agent remove -n my-agent

# 强制删除无需确认
viben agent remove -n my-agent --force
```

### 配置智能体

查看或设置智能体配置：

```bash
# 查看配置
viben agent config -n my-agent

# 设置配置值
viben agent config -n my-agent --set model=gpt-4
viben agent config -n my-agent --set plan=true
viben agent config -n my-agent --set mcp.enabled='["filesystem", "git"]'
```

**输出（查看）：**

```yaml
id: my-agent
name: "My Coding Assistant"
type: claude-code
type_config:
  plan: true
  dangerously_skip_permissions: false
mcp:
  enabled:
    - filesystem
    - git
skills:
  enabled:
    - code-review
    - commit
```

### 设置默认智能体

```bash
viben agent set-default -n my-agent
```

**输出：**

```
Set 'my-agent' as default agent
```

### 设置为模板

```bash
viben agent set-template -n my-agent --description "A general coding assistant template"
```

### 智能体状态

显示智能体状态：

```bash
# 所有智能体状态
viben agent status

# 特定智能体状态
viben agent status -n my-agent
```

## 智能体对话

使用指定智能体进行非交互式对话：

```bash
# 基本用法
viben agent chat -n my-agent -p "分析这段代码"

# 从 stdin 读取
echo "写一个排序函数" | viben agent chat -n my-agent

# 指定工作目录
viben agent chat -n my-agent -p "分析项目结构" -C /path/to/project

# 使用特定 session
viben agent chat -n my-agent -p "继续上次的工作" -s main

# 恢复已有 session
viben agent chat -n my-agent -p "接着做" --resume abc123

# 强制创建新 session
viben agent chat -n my-agent -p "开始新任务" --new-session

# 覆盖模型
viben agent chat -n my-agent -p "复杂推理任务" --model claude-3-opus

# 不加载记忆
viben agent chat -n my-agent -p "独立任务" --no-memory

# JSON 格式输出
viben agent chat -n my-agent -p "快速任务" --json
```

### chat 选项

| 选项 | 说明 |
|------|------|
| `-n, --name <id>` | 智能体 ID（必需） |
| `-p, --prompt <prompt>` | 提示词（可选，无则从 stdin 读取） |
| `-C, --cwd <dir>` | 工作目录（默认当前目录） |
| `-s, --session <id>` | 指定 session ID |
| `--resume <id>` | 恢复已有 session |
| `--new-session` | 强制创建新 session |
| `--model <model>` | 覆盖智能体配置的模型 |
| `--no-memory` | 不加载智能体记忆 |
| `--dangerously-skip-permissions` | 跳过权限检查 |
| `--input-format <format>` | 输入格式: text, stream-json |
| `--output-format <format>` | 输出格式: text, stream-json |
| `--verbose` | 详细输出 |
| `--json` | JSON 格式输出结果 |

## 模板管理

### 列出模板

```bash
viben agent template list
viben agent template list --json
```

**输出（人类可读）：**

```
Agent Templates:
  coding-assistant    claude-code   "General coding assistant"
  researcher          gemini        "Research and analysis"
  code-reviewer       claude-code   "Code review specialist"
```

### 创建模板

从现有智能体创建模板：

```bash
viben agent template create -n coding-assistant --clone my-agent
```

### 显示模板

```bash
viben agent template show -n coding-assistant
```

### 删除模板

```bash
viben agent template remove -n coding-assistant
```

## 会话管理

### 列出会话

```bash
viben agent session list -n my-agent
```

**输出：**

```
Sessions for my-agent:
  main     "Feature development"   2h ago    42 messages
  feature  "Auth implementation"   1d ago    128 messages
  bugfix   "Fix login issue"       3d ago    23 messages
```

### 创建会话

```bash
viben agent session create -n my-agent --session-name "feature-auth"
```

### 显示会话

```bash
viben agent session show -n my-agent -s main
```

### 删除会话

```bash
viben agent session remove -n my-agent -s feature-auth
```

### 清空会话历史

```bash
viben agent session clear -n my-agent -s main
```

## 记忆管理

### 显示记忆

```bash
# 显示所有记忆
viben agent memory show -n my-agent

# 显示特定日期
viben agent memory show -n my-agent --date 2024-01-16
```

**输出：**

```
Memory for my-agent:

=== MEMORY.md (2.3 KB) ===
# Agent Memory

## Key Learnings
- Project uses TypeScript with strict mode
- Prefer functional components...

=== 2024-01-16.md (today) ===
# 2024-01-16

## 10:30 - Session started
- Working on feature X
- Discovered issue with Y
```

### 追加记忆

追加内容到今日日志：

```bash
viben agent memory append -n my-agent "Completed feature X implementation"
```

### 编辑记忆

在编辑器中打开记忆文件：

```bash
# 编辑主记忆文件
viben agent memory edit -n my-agent

# 编辑特定日期
viben agent memory edit -n my-agent --date 2024-01-16
```

## 智能体配置文件

```yaml
# ~/.viben/agents/my-agent/config.yaml
version: 1

# 智能体元数据
id: my-agent
name: "My Coding Assistant"
description: "A helpful coding assistant"
created: 2024-01-15T10:30:00Z

# 智能体类型（决定运行时行为）
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

## MCP Servers 配置

```json
// ~/.viben/agents/my-agent/mcp_servers.json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@anthropic-ai/mcp-server-filesystem"],
      "env": {
        "ROOT": "/path/to/workspace"
      }
    },
    "git": {
      "command": "npx",
      "args": ["-y", "@anthropic-ai/mcp-server-git"]
    }
  }
}
```

## 智能体类型

| 类型 | 说明 |
|------|------|
| `claude-code` | Claude Code 智能体 |
| `cursor` | Cursor 智能体 |
| `gemini` | Gemini 智能体 |
| `codex` | OpenAI Codex 智能体 |
| `windsurf` | Windsurf 智能体 |
| `amp` | AMP 智能体 |
| `opencode` | OpenCode 智能体 |
| `qwen-code` | Qwen Code 智能体 |
| `aider` | Aider 智能体 |

## 运行时配置合并

智能体实际运行时，配置按以下顺序叠加：

```
1. ~/.viben/agents/<id>/config.yaml     # 智能体基础配置
2. <project>/.claude/ (或其他 agent 类型)  # 工作区 agent 类型配置
3. 命令行参数                              # 运行时覆盖
```

## 错误处理

### 智能体未找到

```json
{
  "success": false,
  "error": {
    "code": "AGENT_NOT_FOUND",
    "message": "Agent 'unknown-agent' not found"
  }
}
```

### 智能体已存在

```json
{
  "success": false,
  "error": {
    "code": "AGENT_EXISTS",
    "message": "Agent 'my-agent' already exists"
  }
}
```

## 相关命令

- [viben executor](./executor) - 执行器管理
- [viben provider](./provider) - 提供商管理
- [viben model](./model) - 模型管理
- [viben mcp](./mcp) - MCP 服务器管理
- [viben skill](./skill) - 技能管理
