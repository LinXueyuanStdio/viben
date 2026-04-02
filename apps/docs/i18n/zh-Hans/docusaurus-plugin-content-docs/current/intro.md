---
sidebar_position: 1
title: "微本简介"
description: "微本 - Agent 集群 × 代码进化，多目标带约束的迭代优化，自动提升代码质量"
---

# 微本

**微本** (Viben) 是一个 Agent 集群与代码进化平台，通过多目标带约束的迭代优化自动提升代码质量。

## 核心特性

| 特性 | 说明 |
|------|------|
| 🧬 **FileEvo** | 代码迭代优化：多候选采样 + 质量评估，自动选择最优方案合并 |
| 🤖 **多智能体** | Agent 集群编排：并行 Worktree 隔离，自动化任务分发与监控 |
| 🔌 **MCP 协议** | Model Context Protocol：工具注册与调用，扩展 Agent 能力边界 |
| 📋 **任务系统** | XState 状态机驱动：看板 + 队列 + 自动执行，完整的任务生命周期管理 |
| 💡 **Idea 生成** | AI 驱动代码分析：自动发现改进点，一键转化为可执行任务 |
| 🖥️ **跨平台** | CLI / Desktop / Web：Tauri 2 桌面应用，三端统一体验 |

## 产品架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        微本架构概览                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐  │
│   │   Web   │     │ Desktop │     │   CLI   │     │  Docs   │  │
│   │ (Next)  │     │ (Tauri) │     │  (Node) │     │(Docusr) │  │
│   └────┬────┘     └────┬────┘     └────┬────┘     └─────────┘  │
│        │               │               │                        │
│        └───────────────┼───────────────┘                        │
│                        │                                        │
│              ┌─────────┴─────────┐                              │
│              │   @viben/core     │                              │
│              │   (Gateway API)   │                              │
│              └───────────────────┘                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## FileEvo: 代码迭代优化

> *多目标带约束的候选选择算法，通过采样-评估-选择循环迭代提升代码质量*

FileEvo 是一种**启发式迭代优化方法**，核心思想是"生成多个候选方案 → 多维度评估 → 选择最优合并"。

### 系统组件

| 组件 | 说明 |
|------|------|
| **候选生成器** | Worktree 隔离环境中，Agent 生成 PR |
| **参考基准** | Main Branch 原始代码库，用于计算变更量 |
| **质量评估器** | CI + Agent 多维度评分 |

### 迭代优化循环

1. **采样** - 批量生成 B 个想法，每个并行展开 N 次，总计 B×N 个候选
2. **评估** - 多目标评分 + 变更量计算 + 调整后得分
3. **选择** - 两阶段筛选：每 idea 选最优 PR，全局选最优 PR
4. **更新** - 合并最佳 PR，更新代码库，检查停止条件

### CLI 命令

```bash
# 生命周期
viben evo create <name>       # 创建优化目标
viben evo start <target.md>   # 启动优化循环
viben evo status <name>       # 查看状态

# Idea → Task
viben idea generate --types <t>  # 生成想法
viben idea promote <id> --start  # 转为任务

# 监控
viben swarm status --watch       # 实时监控
```

## 任务系统

基于 XState 状态机的任务生命周期管理，支持看板、队列和自动化执行。

### 任务状态流转

```
backlog → queue → in_progress → review → completed
                       ↓
              plan → implement → check → fix (循环)
```

| 状态 | 说明 | 触发命令 |
|------|------|----------|
| `backlog` | 待办，等待排队 | `task create` |
| `queue` | 已排队，等待执行 | `task enqueue` |
| `in_progress` | 执行中 | `task start` |
| `review` | 等待人工审核 | 自动 (QA 通过) |
| `completed` | 已完成 | `task approve` |

### CLI 命令

```bash
viben task create "<title>" --slug <name>  # 创建任务
viben task enqueue <task>                  # backlog → queue
viben task start <task>                    # queue → in_progress
viben task approve <task>                  # review → completed
viben task list                            # 列出所有任务
```

## 💡 Idea 生成

AI 驱动的代码库分析，自动生成改进建议并转化为任务。

| 内置类型 | 说明 |
|----------|------|
| `code_improvements` | 基于现有模式的代码改进 |
| `security_hardening` | 安全漏洞和加固措施 |
| `performance_optimizations` | 性能瓶颈和优化 |
| `documentation_gaps` | 缺失的文档 |
| `ui_ux_improvements` | UI/UX 增强 |
| `code_quality` | 代码质量和重构 |

```bash
# 生成代码改进建议
viben idea generate --types code_improvements security_hardening

# 将想法转为任务并立即启动
viben idea promote ci-001 --start --worktree
```

## 配置

```
~/.viben/
├── providers.yaml    # API Keys, Endpoints
├── models.yaml       # 模型参数
├── agents/           # Agent 定义
│   └── <name>/
│       └── AGENTS.md
├── cron.yaml         # 定时任务
├── channels.yaml     # 通知渠道
└── workspaces.yaml   # 工作空间
```

## 快速开始

### 桌面应用（推荐）

[![最新版本](https://img.shields.io/github/v/release/LinXueyuanStdio/viben?filter=desktop-v*&label=Desktop%20App)](https://github.com/LinXueyuanStdio/viben/releases?q=desktop)

| 平台 | 下载格式 |
|------|----------|
| **macOS** | `.dmg` (Universal) |
| **Windows** | `.msi` 或 `.exe` |
| **Linux** | `.AppImage` 或 `.deb` |

### CLI 工具

```bash
# npm
npm install -g viben

# 或直接运行
npx viben
```

## Gateway API

微本 Gateway 是核心后端服务，运行在端口 **18790**。

| 端点 | 功能 |
|------|------|
| `/health` | 健康检查 |
| `/api/agent` | 智能体管理 |
| `/api/sessions` | 会话管理 |
| `/api/providers` | Provider 管理 |
| `/api/models` | 模型管理 |

:::info API 文档
完整的 Gateway API 文档请查看 [API 参考](/backend/api/)。
:::

## 下一步

- [核心概念](./getting-started/concepts) - 理解微本的核心概念
- [快速入门](./getting-started/quick-start) - 快速上手
- [桌面应用](./desktop/) - 桌面应用完整指南
- [CLI 文档](/cli/) - 命令行工具参考
