---
sidebar_position: 3
title: "核心概念"
description: "理解 Viben 的核心概念：智能体、执行器、配置系统和 Memory"
---

# 核心概念

本文档介绍 Viben 的核心概念，帮助你理解系统的工作原理。

## 智能体 vs 执行器

Viben 区分两种关键概念：

### 执行器 (Executor)

执行器是底层的 AI coding agent 运行时，如 Claude Code、Cursor、Gemini 等。

**特点**：
- **只读** - 执行器由系统检测，用户无法创建或修改
- **独立安装** - 需要单独安装（如 `npm install -g @anthropic-ai/claude-code`）
- **运行环境** - 提供实际的 AI 推理能力

**支持的执行器**：

| 执行器 | 类型 | CLI 命令 | MCP 支持 | 流式输出 |
|--------|------|----------|----------|----------|
| Claude Code | CLAUDE_CODE | `claude` | ✓ | ✓ |
| AMP | AMP | `amp` | ✓ | ✓ |
| Gemini | GEMINI | `gemini` | - | ✓ |
| Codex | CODEX | `codex` | - | ✓ |
| Cursor | CURSOR_AGENT | `cursor` | ✓ | ✓ |
| Qwen Code | QWEN_CODE | `qwen` | - | ✓ |
| Copilot | COPILOT | `copilot` | - | ✓ |

### 智能体 (Agent)

智能体是用户创建的配置，定义了如何使用执行器。

**特点**：
- **可编辑** - 用户可以创建、修改、删除
- **存储在 YAML** - 配置文件存储在 `.viben/agents/` 目录
- **引用执行器** - 通过 `executor_type` 字段指定使用哪个执行器

**智能体配置内容**：
- 系统提示词 (system_prompt)
- 追加提示词 (append_prompt)
- 模型和参数 (model, temperature, max_tokens)
- MCP 服务器配置
- Skills 配置

**配置示例**：

```yaml
# ~/.viben/agents/my-agent/config.yaml
id: my-agent
name: My Coding Assistant
executor_type: CLAUDE_CODE
model: claude-3-sonnet
system_prompt: You are a helpful coding assistant.
temperature: 0.7
max_tokens: 4096
mcp_servers:
  - filesystem
  - github
skills:
  - code-review
```

### 关系图

```
┌─────────────────────────────────────────────────────────────┐
│                      智能体 (Agent)                          │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  name: My Agent                                      │   │
│  │  executor_type: CLAUDE_CODE  ──────────────────┐    │   │
│  │  model: claude-3-sonnet                        │    │   │
│  │  system_prompt: "..."                          │    │   │
│  │  mcp_servers: [...]                            │    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                    │        │
│                                                    ▼        │
│  ┌─────────────────────────────────────────────────────┐   │
│  │               执行器 (Executor)                      │   │
│  │  type: CLAUDE_CODE                                   │   │
│  │  cli: claude                                         │   │
│  │  supports_mcp: true                                  │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## 配置系统

Viben 使用 YAML 文件存储配置，支持多级配置合并。

### 配置存储位置

| 范围 | 位置 | 说明 |
|------|------|------|
| **全局** | `~/.viben/` | 系统级配置，适用于所有项目 |
| **项目** | `<project>/.viben/` | 项目特定配置，覆盖全局配置 |

### 全局配置结构

```
~/.viben/
├── agents/              # 全局智能体配置
│   └── <agent-id>/
│       ├── config.yaml  # 智能体配置
│       └── MEMORY.md    # 智能体记忆
├── providers/           # Provider 配置
│   └── <provider-id>.yaml
├── models.yaml          # 模型配置
├── channels.yaml        # 通道配置 (Telegram, Discord 等)
├── cron.yaml            # 定时任务配置
└── sessions/            # 会话存储
```

### 项目配置结构

```
<project>/.viben/
├── agents/              # 项目智能体
│   └── <agent-id>/
│       └── config.yaml
├── group-chats/         # 群聊配置
├── kanban/              # 看板数据
└── config.yaml          # 项目配置
```

### 配置优先级

配置按以下优先级合并（后者覆盖前者）：

```
全局配置 (~/.viben/) → 项目配置 (<project>/.viben/) → 命令行参数
```

**示例**：

假设全局配置中 `temperature: 0.7`，项目配置中 `temperature: 0.3`，最终使用 `0.3`。

---

## Memory 系统

Viben 为每个智能体维护一个 Memory 系统，帮助智能体记住重要信息。

### Memory 文件

每个智能体目录下都有一个 `MEMORY.md` 文件：

```
~/.viben/agents/<agent-id>/MEMORY.md
```

### Memory 内容

Memory 文件存储智能体需要记住的长期信息：

```markdown
# Agent Memory

## Project Context
- This is a TypeScript monorepo using pnpm
- Main frameworks: React, Next.js, Tauri

## User Preferences
- Prefer functional components over class components
- Use TypeScript strict mode
- Follow Conventional Commits

## Learned Patterns
- API routes are in apps/web/app/api/
- Shared components are in packages/ui/
```

### 每日日志

除了 MEMORY.md，系统还维护每日日志：

```
~/.viben/agents/<agent-id>/logs/
└── 2024-01-15.md
```

每日日志记录当天的交互摘要和重要决策。

---

## Provider 和 Model

### Provider

Provider 是 AI 服务提供商，如 OpenAI、Anthropic、Ollama 等。

**配置示例**：

```yaml
# ~/.viben/providers/anthropic.yaml
id: anthropic
name: Anthropic
type: anthropic
api_key: ${ANTHROPIC_API_KEY}
base_url: https://api.anthropic.com
```

### Model

Model 是具体的 AI 模型，关联到特定的 Provider。

**配置示例**：

```yaml
# ~/.viben/models.yaml
models:
  - id: claude-3-sonnet
    name: Claude 3 Sonnet
    provider: anthropic
    model_id: claude-3-sonnet-20240229
    context_length: 200000

  - id: gpt-4
    name: GPT-4
    provider: openai
    model_id: gpt-4-turbo
    context_length: 128000

aliases:
  default: claude-3-sonnet
  fast: claude-3-haiku

fallbacks:
  claude-3-sonnet:
    - gpt-4
    - claude-3-haiku
```

---

## 会话 (Session)

会话是智能体与用户的一次对话上下文。

### 会话生命周期

1. **创建** - 用户开始新对话时创建
2. **活跃** - 持续交互中
3. **暂停** - 用户离开但保留上下文
4. **结束** - 用户关闭或超时

### 会话存储

不同执行器的会话存储位置不同：

| 执行器 | 存储路径 |
|--------|----------|
| Claude Code | `~/.claude/projects/<encoded-path>/<session-id>.jsonl` |
| Codex | `~/.codex/sessions/<session-id>/` |
| Viben Agent | `~/.viben/sessions/<agent-id>/<session-id>/` |

---

## 下一步

- [快速入门](./quick-start) - 开始使用 Viben
- [桌面应用功能](../desktop/features) - 了解桌面应用功能
- [CLI 文档](/cli/) - 命令行工具参考
