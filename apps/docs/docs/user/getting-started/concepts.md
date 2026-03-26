---
sidebar_position: 3
title: "核心概念"
description: "理解 Viben 的核心概念：FileRL、任务系统、智能体、执行器"
---

# 核心概念

本文档介绍 Viben 的核心概念，帮助你理解系统的工作原理。

## FileRL: 代码迭代优化

FileRL 是 Viben 的核心算法，通过多目标带约束的候选选择实现代码质量的迭代提升。

### 核心思想

```
生成多个候选方案 → 多维度评估 → 选择最优合并 → 迭代
```

### 系统组件

| 组件 | 说明 |
|------|------|
| **候选生成器** | 在 Worktree 隔离环境中，Agent 生成 PR |
| **参考基准** | Main Branch 原始代码库，用于计算变更量 |
| **质量评估器** | CI + Agent 多维度评分 (测试、质量、安全) |

### 迭代循环

1. **采样** - 批量生成 B 个不同类型的想法，每个并行展开 N 次
2. **评估** - 多目标评分 R + 变更量惩罚 d → 调整后得分 R̃
3. **选择** - 两阶段筛选：每 idea 选最优，全局选最优
4. **更新** - 合并最佳 PR，更新代码库

### 评分机制

**多目标评分**：

`R = Σ wᵢ · rᵢ`

其中 rᵢ 为各维度评分（测试通过率、代码质量、安全性等）

**变更惩罚**：

`R̃ = R - λ · d`

其中 d 为归一化变更量，λ 为惩罚系数

---

## 任务系统

基于 XState 状态机的任务生命周期管理。

### 任务状态

| 状态 | 说明 |
|------|------|
| `backlog` | 待办，等待排队 |
| `queue` | 已排队，等待执行 |
| `in_progress` | 执行中 (plan → implement → check → fix) |
| `paused` | 已暂停，保留进度 |
| `review` | 等待人工审核 |
| `completed` | 已完成 |
| `failed` | 执行失败 |
| `cancelled` | 已取消 |

### 内部执行流程

`in_progress` 状态内部执行：

```
plan → implement → check → fix (失败时循环)
```

### 任务目录结构

```
.viben/tasks/<date>-<slug>/
├── task.json           # 任务元数据
├── events.jsonl        # 事件历史
├── prd.md              # 产品需求文档
├── implement.jsonl     # 实现阶段上下文
├── check.jsonl         # 检查阶段上下文
└── logs/               # 执行日志
```

---

## 智能体 vs 执行器

Viben 区分两种关键概念：

### 执行器 (Executor)

执行器是底层的 AI coding agent 运行时。

**特点**：
- **只读** - 执行器由系统检测，用户无法创建或修改
- **独立安装** - 需要单独安装
- **运行环境** - 提供实际的 AI 推理能力

**支持的执行器**：

| 执行器 | 类型 | CLI 命令 | MCP 支持 |
|--------|------|----------|----------|
| Claude Code | CLAUDE_CODE | `claude` | ✓ |
| AMP | AMP | `amp` | ✓ |
| Gemini | GEMINI | `gemini` | - |
| Codex | CODEX | `codex` | - |
| Cursor | CURSOR_AGENT | `cursor` | ✓ |
| Qwen Code | QWEN_CODE | `qwen` | - |
| Copilot | COPILOT | `copilot` | - |

### 智能体 (Agent)

智能体是用户创建的配置，定义了如何使用执行器。

**特点**：
- **可编辑** - 用户可以创建、修改、删除
- **存储在 YAML** - 配置文件存储在 `.viben/agents/` 目录
- **引用执行器** - 通过 `executor_type` 字段指定使用哪个执行器

**配置示例**：

```yaml
# ~/.viben/agents/my-agent/config.yaml
id: my-agent
name: My Coding Assistant
executor_type: CLAUDE_CODE
model: claude-3-sonnet
system_prompt: You are a helpful coding assistant.
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
│  └─────────────────────────────────────────────────────┘   │
│                                                    │        │
│                                                    ▼        │
│  ┌─────────────────────────────────────────────────────┐   │
│  │               执行器 (Executor)                      │   │
│  │  type: CLAUDE_CODE                                   │   │
│  │  cli: claude                                         │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## Idea 生成

AI 驱动的代码库分析，自动发现改进点。

### 内置类型

| 类型 | 说明 |
|------|------|
| `code_improvements` | 基于现有模式的代码改进 |
| `security_hardening` | 安全漏洞和加固措施 |
| `performance_optimizations` | 性能瓶颈和优化 |
| `documentation_gaps` | 缺失的文档 |
| `ui_ux_improvements` | UI/UX 增强 |
| `code_quality` | 代码质量和重构 |

### 自定义类型

在 `docs/idea-types/*.md` 创建自定义 prompt 模板。

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
├── providers.yaml       # API Keys, Endpoints
├── models.yaml          # 模型参数
├── agents/              # Agent 定义
│   └── <name>/
│       └── AGENTS.md
├── cron.yaml            # 定时任务
├── channels.yaml        # 通知渠道
└── workspaces.yaml      # 工作空间
```

### 项目配置结构

```
<project>/.viben/
├── agents/              # 项目智能体
├── tasks/               # 任务目录
│   └── <date>-<slug>/
│       └── task.json
└── workspace/           # 开发者工作空间
```

### 配置优先级

```
全局配置 (~/.viben/) → 项目配置 (<project>/.viben/) → 命令行参数
```

---

## Provider 和 Model

### Provider

Provider 是 AI 服务提供商。

```yaml
# ~/.viben/providers.yaml
anthropic:
  api_key: ${ANTHROPIC_API_KEY}
  base_url: https://api.anthropic.com
```

### Model

Model 是具体的 AI 模型。

```yaml
# ~/.viben/models.yaml
models:
  - id: claude-3-sonnet
    provider: anthropic
    model_id: claude-3-sonnet-20240229

aliases:
  default: claude-3-sonnet
  fast: claude-3-haiku
```

---

## 下一步

- [快速入门](./quick-start) - 开始使用 Viben
- [桌面应用功能](../desktop/features) - 了解桌面应用功能
- [CLI 文档](/cli/) - 命令行工具参考
