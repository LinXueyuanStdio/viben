---
sidebar_position: 7
title: "viben executor"
description: "发现和查看执行器（Claude Code、Cursor 等）"
---

# viben executor

发现和查看执行器。执行器是实际运行智能体的 coding agent，如 Claude Code、Cursor 等。

## 概念说明

### 什么是执行器？

执行器（Executor）是运行智能体的底层 coding agent。Viben 通过为这些执行器配置不同的技能（skills）、提示词（prompts）、MCP 服务器等，将其组装成功能丰富的智能体。

| 概念 | 说明 | 示例 |
|------|------|------|
| **执行器** | 底层 coding agent，负责执行任务 | Claude Code, Cursor, Gemini CLI, Codex, Windsurf |
| **智能体** | Viben 配置的智能体实例，基于某个执行器 | `main` 智能体（基于 Claude Code）|
| **关系** | 智能体 = 执行器 + 技能 + 提示词 + MCP + 记忆 | 一个执行器可以支持多个智能体 |

**执行器的职责**：
- 接收用户指令
- 调用 LLM 进行推理
- 执行工具调用（代码编写、文件操作等）
- 与 MCP 服务器通信

**Viben 的职责**：
- 发现本地已安装的执行器
- 为执行器配置技能、提示词、MCP
- 管理智能体实例（基于执行器）
- 提供统一的配置和记忆管理

## 支持的执行器

| ID | 名称 | 说明 | 检测方式 |
|----|------|------|----------|
| `CLAUDE_CODE` | Claude Code | Anthropic 官方 CLI | `claude --version` |
| `CURSOR` | Cursor | AI-first 编辑器 | `cursor --version` |
| `GEMINI` | Gemini CLI | Google Gemini CLI | `gemini --version` |
| `CODEX` | OpenAI Codex | OpenAI Codex CLI | `codex --version` |
| `WINDSURF` | Windsurf | Codeium IDE | `windsurf --version` |
| `AMP` | Amp | Sourcegraph Amp | `amp --version` |
| `OPENCODE` | OpenCode | 开源 coding agent | `opencode --version` |
| `QWEN_CODE` | Qwen Code | 阿里通义千问 coding agent | `qwen-code --version` |
| `AIDER` | Aider | AI 结对编程 | `aider --version` |
| `CONTINUE` | Continue | IDE 插件 | `continue --version` |

## 命令

```bash
# ============================================================
# 执行器发现（仅发现，不安装）
# ============================================================

# 列出支持的执行器类型
viben executor types
viben executor types --json

# 列出所有已发现的执行器（含安装状态）
viben executor list
viben executor list --json

# 查看特定执行器详情
viben executor show -n <executor-id>
viben executor show -n CLAUDE_CODE
viben executor show -n CURSOR --json

# ============================================================
# 执行器 Chat（非交互式执行）
# ============================================================

# 基本用法
viben executor chat -n CLAUDE_CODE -p "分析这段代码"

# 从 stdin 读取
echo "写一个排序函数" | viben executor chat -n CLAUDE_CODE

# JSON 流输入输出（用于程序化调用）
viben executor chat -n CLAUDE_CODE --input-format stream-json --output-format stream-json

# 恢复会话
viben executor chat -n CLAUDE_CODE -p "继续" --resume <session-id>
```

:::note
发现功能不实现安装，安装应由用户通过各执行器官方渠道完成。
:::

## 输出示例

**`viben executor types`（人类可读）：**

```
TYPE          DESCRIPTION
------------  -----------------------
CLAUDE_CODE   Claude Code (Anthropic)
AMP           Amp
GEMINI        Gemini CLI (Google)
CODEX         Codex CLI (OpenAI)
OPENCODE      Opencode
CURSOR_AGENT  Cursor Agent
QWEN_CODE     Qwen Code (Alibaba)
COPILOT       GitHub Copilot
DROID         Droid
```

**`viben executor types --json`：**

```json
{
  "success": true,
  "data": {
    "types": [
      { "id": "CLAUDE_CODE", "name": "Claude Code (Anthropic)" },
      { "id": "AMP", "name": "Amp" },
      { "id": "GEMINI", "name": "Gemini CLI (Google)" },
      { "id": "CODEX", "name": "Codex CLI (OpenAI)" },
      { "id": "OPENCODE", "name": "Opencode" },
      { "id": "CURSOR_AGENT", "name": "Cursor Agent" },
      { "id": "QWEN_CODE", "name": "Qwen Code (Alibaba)" },
      { "id": "COPILOT", "name": "GitHub Copilot" },
      { "id": "DROID", "name": "Droid" }
    ]
  }
}
```

**`viben executor list`（人类可读）：**

```
Executors:

  Installed:
    CLAUDE_CODE     Claude Code      v1.0.25    Anthropic's official CLI
    CURSOR          Cursor           v0.45.2    AI-first code editor

  Not Installed:
    GEMINI_CLI      Gemini CLI       -          Google Gemini CLI
    CODEX           OpenAI Codex     -          OpenAI Codex CLI
    WINDSURF        Windsurf         -          Codeium IDE
    AMP             Amp              -          Sourcegraph Amp
    OPENCODE        OpenCode         -          Open source coding agent
    QWEN_CODE       Qwen Code        -          Alibaba Qwen coding agent
    AIDER           Aider            -          AI pair programming
    CONTINUE        Continue         -          IDE plugin for AI coding

Tip: Use 'viben executor show -n <id>' to see details.
```

**`viben executor show -n CLAUDE_CODE`（人类可读）：**

```
Executor: CLAUDE_CODE
Name: Claude Code
Description: Anthropic's official CLI for Claude

Status: ✓ Installed
Version: 1.0.25
Path: /usr/local/bin/claude

Configuration:
  Config Dir:    ~/.claude/
  MCP Config:    ~/.claude/mcp_servers.json
  Settings:      ~/.claude/settings.json

Agents using this executor:
  main          3 sessions    default
  my-agent      1 session

Capabilities:
  - Tool use (Bash, Read, Write, Edit, etc.)
  - MCP server support
  - Multi-turn conversations
  - Extended thinking
  - Image understanding
```

**`viben executor list --json`：**

```json
{
  "success": true,
  "data": {
    "executors": [
      {
        "id": "CLAUDE_CODE",
        "name": "Claude Code",
        "description": "Anthropic's official CLI for Claude",
        "installed": true,
        "version": "1.0.25",
        "path": "/usr/local/bin/claude",
        "configDir": "~/.claude/",
        "mcpConfigPath": "~/.claude/mcp_servers.json",
        "settingsPath": "~/.claude/settings.json"
      },
      {
        "id": "CURSOR",
        "name": "Cursor",
        "description": "AI-first code editor",
        "installed": true,
        "version": "0.45.2",
        "path": "/Applications/Cursor.app/Contents/MacOS/Cursor",
        "configDir": "~/.cursor/",
        "mcpConfigPath": "~/.cursor/mcp.json",
        "settingsPath": "~/.cursor/settings.json"
      },
      {
        "id": "GEMINI_CLI",
        "name": "Gemini CLI",
        "description": "Google Gemini CLI",
        "installed": false
      }
    ]
  }
}
```

## 执行器 Chat

与执行器进行非交互式对话。

### 命令接口

```
viben executor chat [OPTIONS] -n <EXECUTOR_NAME>

OPTIONS:
    -n, --name <NAME>           执行器名称（如 CLAUDE_CODE, GEMINI）
    -p, --prompt <PROMPT>       提示词（可选，无则从 stdin 读取）
    -C, --cwd <DIR>             工作目录（默认当前目录）

    --input-format <FORMAT>     输入格式: text（默认）, stream-json
    --output-format <FORMAT>    输出格式: text（默认）, stream-json
    --verbose                   详细输出

    --session-id <ID>           指定会话 ID
    --resume <SESSION_ID>       恢复已有会话

    --model <MODEL>             指定模型（如果执行器支持）
    --dangerously-skip-permissions  跳过权限检查
```

### 使用示例

```bash
# 基本用法
viben executor chat -n CLAUDE_CODE -p "分析这段代码"

# 从 stdin 读取纯文本
echo "写一个排序函数" | viben executor chat -n CLAUDE_CODE

# JSON 流输入输出（用于程序化调用）
echo '{"type":"user","message":{"role":"user","content":"分析代码"}}' | \
  viben executor chat -n CLAUDE_CODE --input-format stream-json --output-format stream-json

# 恢复会话
viben executor chat -n CLAUDE_CODE -p "继续上次的工作" --resume abc123
```

## 与智能体的关系

```
┌─────────────────────────────────────────────────────────────┐
│                    Viben 架构                               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  viben executor list          viben agent list              │
│       ↓                            ↓                        │
│  ┌─────────────┐             ┌─────────────┐                │
│  │   执行器    │─────────────│   智能体    │                │
│  │ CLAUDE_CODE │   1:N       │   main      │                │
│  │  (已安装)   │             │  my-agent   │                │
│  └─────────────┘             └─────────────┘                │
│       │                            │                        │
│       │ 运行环境                   │ 配置                   │
│       ↓                            ↓                        │
│  ┌─────────────┐             ┌─────────────┐                │
│  │  ~/.claude/ │             │ ~/.viben/   │                │
│  │  (执行器    │◄────────────│ agents/xxx/ │                │
│  │  原生配置)  │   叠加配置   │ (skills,mcp │                │
│  └─────────────┘             │  memory)    │                │
│                              └─────────────┘                │
│                                                             │
│  流程:                                                       │
│  1. viben executor list  → 发现本地已安装的执行器           │
│  2. viben agent create -n xxx -e CLAUDE_CODE                │
│     → 创建基于 Claude Code 的智能体实例                     │
│  3. viben agent config → 配置技能、MCP、提示词               │
│  4. 运行智能体时，执行器配置 + viben 配置叠加生效            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**关键区别**：

| 维度 | 执行器 | 智能体 |
|------|--------|--------|
| 定义 | 底层 coding agent 工具 | Viben 配置的智能体实例 |
| 数量 | 少（通常 1-3 个已安装）| 多（可创建任意数量）|
| 管理 | 系统级安装，Viben 只发现 | Viben 创建和管理 |
| 配置 | 原生配置（如 ~/.claude/）| Viben 配置（叠加到原生）|
| 操作 | `list`、`show`（只读）| `create`、`remove`、`config`（读写）|

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

- [viben agent](./agent) - 智能体管理
- [viben agent chat](./agent-chat) - 智能体聊天
