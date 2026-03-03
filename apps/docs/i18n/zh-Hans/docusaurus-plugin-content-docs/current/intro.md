---
sidebar_position: 1
title: "Viben 简介"
description: "Viben - 多智能体工作空间管理器，集成看板、日历、时间线和任务管理"
---

# Viben

**Viben** 是一个多智能体工作空间管理器，帮助你统一管理 AI 助手、MCP 服务器和开发任务。无论你使用 Claude Code、Cursor、Codex 还是其他 AI 编程助手，Viben 都能让你在一个地方管理所有配置和任务。

## 产品架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        Viben 架构概览                            │
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

Viben 由以下核心产品组成：

| 产品 | 描述 | 适用场景 |
|------|------|----------|
| **桌面应用** | 本地多智能体工作空间管理 | 日常开发、任务管理 |
| **Web 应用** | MCP/Skill 包市场 | 发现和分享工具 |
| **CLI 工具** | 命令行智能体管理 | 自动化、脚本集成 |
| **MCP 服务器** | 学术论文搜索服务 | AI 助手扩展能力 |

:::tip CLI 文档
完整的 CLI 命令参考请查看 [CLI 文档](/cli/)，包含所有命令的详细用法和示例。
:::

## 核心概念

在深入了解功能之前，建议先理解 Viben 的核心概念。详见 [核心概念](getting-started/concepts)。

### 智能体 vs 执行器

Viben 区分两种类型的实体：

| 概念 | 说明 | 可编辑 |
|------|------|--------|
| **智能体 (Agent)** | 用户创建的配置，定义系统提示词、模型参数、MCP 服务器等 | 是 |
| **执行器 (Executor)** | 底层 AI 工具运行时 (Claude Code, Cursor, Gemini 等) | 否 |

智能体通过 `executor_type` 字段指定使用哪个执行器运行。

### 多工作空间管理

管理多个项目工作空间，每个工作空间可以有独立的：
- MCP 服务器配置
- 智能体配置
- Skills 配置
- 任务看板

### 配置优先级

配置按以下优先级合并 (后者覆盖前者)：

```
全局配置 (~/.viben/) → 项目配置 (<project>/.viben/) → 命令行参数
```

### 支持的执行器

| 执行器 | 类型 | CLI 命令 | MCP 支持 |
|--------|------|----------|----------|
| Claude Code | CLAUDE_CODE | `claude` | ✓ |
| AMP | AMP | `amp` | ✓ |
| Gemini | GEMINI | `gemini` | - |
| Codex | CODEX | `codex` | - |
| Cursor | CURSOR_AGENT | `cursor` | ✓ |
| Qwen Code | QWEN_CODE | `qwen` | - |
| Copilot | COPILOT | `copilot` | - |

## 快速开始

### 桌面应用（推荐）

下载桌面应用是最简单的方式：

[![最新版本](https://img.shields.io/github/v/release/LinXueyuanStdio/viben?filter=desktop-v*&label=Desktop%20App)](https://github.com/LinXueyuanStdio/viben/releases?q=desktop)

| 平台 | 下载格式 |
|------|----------|
| **macOS** | `.dmg` (Universal) |
| **Windows** | `.msi` 或 `.exe` |
| **Linux** | `.AppImage` 或 `.deb` |

### CLI 工具

通过 npm 安装命令行工具：

```bash
npm install -g viben
```

或使用 npx 直接运行：

```bash
npx viben
```

详细的 CLI 用法请查看 [CLI 快速入门](/cli/quick-start)。

### MCP 服务器

安装学术搜索 MCP 服务器：

```bash
pip install browse-mcp
```

## MCP 工具

Viben MCP 服务器提供三个核心工具：

| 工具 | 功能 |
|------|------|
| `browse_search` | 搜索学术论文和内容 |
| `browse_download` | 下载论文 PDF |
| `browse_read` | 提取和阅读论文内容 |

支持 18+ 学术数据源：

**免费数据源**：arXiv、PubMed、PMC、bioRxiv、medRxiv、Semantic Scholar、CrossRef、Google Scholar、CORE、IACR

**付费数据源**（需 API 密钥）：IEEE Xplore、Scopus、Springer、ScienceDirect

## Gateway API

Viben Gateway 是核心后端服务，运行在端口 **18790**，提供：

- RESTful API 服务
- WebSocket 实时通信
- Server-Sent Events (SSE) 事件流
- 多智能体编排和协调

主要端点：

| 端点 | 功能 |
|------|------|
| `/health` | 健康检查 |
| `/api/agents` | 智能体管理 |
| `/api/executors` | 执行器管理 |
| `/api/sessions` | 会话管理 |
| `/api/providers` | Provider 管理 |
| `/api/models` | 模型管理 |

:::info API 文档
完整的 Gateway API 文档请查看 [API 参考](/backend/api/)。
:::

## 下一步

- [核心概念](./getting-started/concepts) - 理解 Viben 的核心概念
- [快速入门](./getting-started/quick-start) - 快速上手
- [桌面应用](./desktop/) - 桌面应用完整指南
- [CLI 文档](/cli/) - 命令行工具参考
- [MCP 配置](./getting-started/client-configuration) - 配置 Claude Desktop 等客户端
