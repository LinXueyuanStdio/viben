---
sidebar_position: 9
title: "viben agent chat"
description: "使用指定智能体进行非交互式对话"
---

# viben agent chat

使用指定智能体进行非交互式对话。

## 概述

为 `viben agent` 新增 `chat` 子命令，支持非交互式方式调用智能体进行对话。智能体会根据其配置的 type（如 claude-code、gemini）调用对应的底层执行器，同时自动加载智能体的记忆、MCP 配置和技能。

## 命令接口

```
viben agent chat [OPTIONS] -n <AGENT_ID>

OPTIONS:
    -n, --name <AGENT_ID>       智能体 ID（可选，默认为当前智能体）
    -p, --prompt <PROMPT>       提示词（可选，无则从 stdin 读取）
    -C, --cwd <DIR>             工作目录（默认当前目录）

    --input-format <FORMAT>     输入格式: text（默认）, stream-json
    --output-format <FORMAT>    输出格式: text（默认）, stream-json
    --verbose                   详细输出

    -s, --session <SESSION_ID>  指定会话 ID
    --resume <SESSION_ID>       恢复已有会话
    --new-session               强制创建新会话

    --model <MODEL>             覆盖智能体配置的模型
    --no-memory                 不加载智能体记忆
    --dangerously-skip-permissions  跳过权限检查

    --json                      JSON 格式输出结果
```

## 数据流架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        viben agent chat                          │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      AgentChatCommand::execute()                 │
│  1. 解析参数                                                      │
│  2. 加载智能体配置 (~/.viben/agents/<id>/config.yaml)            │
│  3. 加载智能体记忆 (MEMORY.md + 今日/昨日日志)                    │
│  4. 读取 prompt (从 -p 或 stdin)                                  │
│  5. 合并工作区配置 (<cwd>/.claude/ 等)                           │
│  6. 根据智能体 type 选择执行器                                    │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                     执行器选择                                    │
│  agent.type == "claude-code"  →  ClaudeCode 执行器              │
│  agent.type == "gemini"       →  Gemini 执行器                  │
│  agent.type == "codex"        →  Codex 执行器                   │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                     spawn_agent_chat_process()                   │
│  构建命令: claude -p "prompt" --append-system-prompt "memory"   │
│  - 注入智能体记忆作为 system prompt                              │
│  - 根据 input/output format 添加对应参数                          │
│  - 处理会话、模型等参数                                           │
│  - 加载智能体的 MCP servers 配置                                 │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      子进程 (claude/gemini/...)                  │
│  stdin  ◄──── 继承父进程 stdin                                   │
│  stdout ────► 继承父进程 stdout                                  │
│  stderr ────► 继承父进程 stderr                                  │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      后处理                                       │
│  - 更新智能体每日日志 (memory/YYYY-MM-DD.md)                     │
│  - 保存会话到 .agent_sessions/<session_id>/                      │
└─────────────────────────────────────────────────────────────────┘
```

## 使用示例

```bash
# ============================================================
# 基本用法
# ============================================================

# 使用默认智能体进行对话
viben agent chat -p "分析这段代码"

# 指定智能体
viben agent chat -n my-agent -p "写一个排序函数"

# 从 stdin 读取提示词
echo "解释这个错误" | viben agent chat -n my-agent

# 指定工作目录
viben agent chat -n my-agent -p "分析项目结构" -C /path/to/project

# ============================================================
# 会话管理
# ============================================================

# 使用特定会话
viben agent chat -n my-agent -p "继续上次的工作" -s main

# 恢复已有会话
viben agent chat -n my-agent -p "接着做" --resume abc123

# 强制创建新会话
viben agent chat -n my-agent -p "开始新任务" --new-session

# ============================================================
# 高级选项
# ============================================================

# 覆盖模型
viben agent chat -n my-agent -p "复杂推理任务" --model claude-3-opus

# 不加载记忆（干净状态）
viben agent chat -n my-agent -p "独立任务" --no-memory

# 跳过权限检查
viben agent chat -n my-agent -p "自动化脚本" --dangerously-skip-permissions

# ============================================================
# 程序化调用 (JSON 流)
# ============================================================

# JSON 流输入输出
echo '{"type":"user","message":{"role":"user","content":"分析代码"}}' | \
  viben agent chat -n my-agent --input-format stream-json --output-format stream-json

# JSON 格式输出结果
viben agent chat -n my-agent -p "快速任务" --json
```

## 智能体记忆注入

智能体 chat 会自动加载并注入智能体的记忆：

```
┌─────────────────────────────────────────────────────────────────┐
│                     记忆加载                                      │
├─────────────────────────────────────────────────────────────────┤
│  1. ~/.viben/agents/<id>/memory/MEMORY.md      (主记忆)         │
│  2. ~/.viben/agents/<id>/memory/YYYY-MM-DD.md  (今日日志)       │
│  3. ~/.viben/agents/<id>/memory/YYYY-MM-DD.md  (昨日日志)       │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                     提示词构建                                    │
│                                                                  │
│  [系统提示词]                                                    │
│  # 智能体记忆                                                    │
│  <MEMORY.md 内容>                                                │
│                                                                  │
│  # 近期活动                                                      │
│  ## 昨天 (2024-01-15)                                           │
│  <昨日日志内容>                                                  │
│                                                                  │
│  ## 今天 (2024-01-16)                                           │
│  <今日日志内容>                                                  │
│                                                                  │
│  [用户提示词]                                                    │
│  <实际用户输入>                                                  │
└─────────────────────────────────────────────────────────────────┘
```

使用 `--no-memory` 跳过记忆加载。

## 配置合并顺序

智能体 chat 执行时，配置按以下优先级合并：

```
优先级从低到高:
┌─────────────────────────────────────────────────────────────────┐
│ 1. 智能体基础配置                                                │
│    ~/.viben/agents/<id>/config.yaml                             │
│    - type, model, mcp, skills 等                                 │
├─────────────────────────────────────────────────────────────────┤
│ 2. 工作区配置（根据智能体 type）                                  │
│    <cwd>/.claude/settings.json  (如果 type=claude-code)         │
│    <cwd>/.cursor/settings.json  (如果 type=cursor)              │
├─────────────────────────────────────────────────────────────────┤
│ 3. 命令行参数                                                    │
│    --model, --session, --no-memory 等                           │
└─────────────────────────────────────────────────────────────────┘
```

## 会话存储

对话会话存储在智能体目录下：

```
~/.viben/agents/<agent-id>/.agent_sessions/
└── <session_id>/
    ├── config.yaml              # 会话配置
    │   session_id: abc123
    │   created_at: 2024-01-16T10:30:00Z
    │   last_active: 2024-01-16T14:15:00Z
    │   cwd: /path/to/project
    │   model: claude-3-sonnet
    │
    └── messages.rollout.jsonl   # 消息历史 (JSONL 格式)
```

## 输出示例

**`viben agent chat -n my-agent -p "你好"`（人类可读）：**

```
你好！我是你的编程助手。今天有什么可以帮你的？

我可以访问你的项目上下文，并记得我们之前的对话。
你想处理什么？
```

**`viben agent chat -n my-agent -p "你好" --json`：**

```json
{
  "success": true,
  "agent_id": "my-agent",
  "session_id": "abc123",
  "response": "你好！我是你的编程助手...",
  "tokens": {
    "input": 150,
    "output": 42
  },
  "memory_loaded": true,
  "duration_ms": 1234
}
```

**错误：智能体不存在：**

```
Error: Agent not found: unknown-agent

Available agents:
  main         claude-code
  my-agent     claude-code
  researcher   gemini

Use `viben agent list` to see all agents.
```

**错误：智能体类型不支持 chat：**

```
Error: Chat not supported for agent type: custom

Supported types: claude-code, gemini, codex
```

## executor chat 与 agent chat 的区别

| 特性 | `viben executor chat` | `viben agent chat` |
|------|----------------------|-------------------|
| 目标 | 直接调用底层执行器 | 调用配置好的智能体 |
| 记忆 | 无 | 自动加载智能体记忆 |
| 配置 | 仅命令行参数 | 智能体配置 + 工作区 + 命令行 |
| 会话 | 临时 | 持久化到智能体目录 |
| MCP | 需手动配置 | 使用智能体的 MCP 配置 |
| 技能 | 无 | 使用智能体的技能 |
| 适用场景 | 一次性调用、脚本集成 | 持续对话、项目开发 |

## 相关命令

- [viben agent](./agent) - 智能体管理命令
- [viben executor](./executor) - 执行器管理命令
