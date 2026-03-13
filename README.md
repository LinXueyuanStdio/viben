<div align="center">

**中文 | [English](./README_EN.md)**

# 🚀 Viben

### 多智能体工作空间管理器

*在本地编排 AI Agent 集群，统一管理看板、日历、时间线和任务*

[![Release](https://img.shields.io/github/v/release/LinXueyuanStdio/viben?style=flat-square&logo=github)](https://github.com/LinXueyuanStdio/viben/releases)
[![License](https://img.shields.io/github/license/LinXueyuanStdio/viben?style=flat-square)](./LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen?style=flat-square&logo=node.js)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Tauri](https://img.shields.io/badge/Tauri-2.0-orange?style=flat-square&logo=tauri)](https://tauri.app/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen?style=flat-square)](https://github.com/LinXueyuanStdio/viben/pulls)

</div>

---

## ✨ 特性

| 特性 | 描述 |
|------|------|
| 🤖 **多智能体编排** | 在本地工作空间中协调 AI Agent 集群 |
| 🔌 **MCP 协议** | 完整支持 Model Context Protocol |
| 🖥️ **跨平台** | CLI、桌面应用、Web 应用三端统一 |
| 📋 **看板管理** | 可拖拽的任务看板，实时追踪进度 |
| 📡 **会话监控** | 实时查看 Agent 对话和工具调用 |

---

## 📦 下载

### 🖥️ 桌面应用

| 平台 | 下载 |
|:----:|------|
| 🍎 **macOS** | [.dmg](https://github.com/LinXueyuanStdio/viben/releases/latest) (Universal) |
| 🪟 **Windows** | [.msi](https://github.com/LinXueyuanStdio/viben/releases/latest) / [.exe](https://github.com/LinXueyuanStdio/viben/releases/latest) (64-bit) |
| 🐧 **Linux** | [.AppImage](https://github.com/LinXueyuanStdio/viben/releases/latest) / [.deb](https://github.com/LinXueyuanStdio/viben/releases/latest) |

### 💻 CLI

```bash
# Shell (macOS/Linux)
curl -fsSL https://github.com/LinXueyuanStdio/viben/releases/latest/download/install.sh | bash

# npm
npm install -g viben

# Homebrew
brew tap LinXueyuanStdio/viben && brew install viben

# 或直接运行 (无需安装)
npx viben
```

---

## 🏗️ 架构

```mermaid
graph LR
    subgraph Clients["📱 客户端"]
        direction LR
        CLI["CLI"]
        Desktop["Desktop"]
        Web["Web"]
    end

    subgraph Core["📦 packages/core"]
        direction TB

        subgraph GW["Gateway :18790"]
            direction LR
            REST["REST API"]
            WS["WebSocket"]
        end

        subgraph Svc["Services"]
            direction LR
            Agent["AgentService"]
            Session["SessionStore"]
            Cron["CronService"]
        end

        subgraph Mod["Modules"]
            direction LR
            Exec["Executors"]
            MCP["MCP Client"]
            Chan["Channels"]
        end
    end

    subgraph Ext["🌍 外部"]
        direction TB
        LLM["LLM APIs"]
        MCPSrv["MCP Servers"]
    end

    subgraph Cfg["📁 ~/.viben/"]
        direction TB
        YAML["*.yaml"]
    end

    Clients -->|HTTP/WS| GW
    GW --> Svc
    Svc --> Mod
    Mod --> Cfg
    Exec --> LLM
    MCP --> MCPSrv
```

> **设计原则**: `packages/core` 是唯一边界 · file-native 配置 (YAML+Markdown) · 统一 REST/WebSocket API · 多 Provider 支持

---

## 📋 任务系统

基于 XState 状态机的任务生命周期管理，支持看板、队列和自动化执行。

### 任务生命周期

```mermaid
stateDiagram-v2
    [*] --> backlog: 创建

    backlog --> queue: enqueue
    backlog --> cancelled: cancel

    queue --> in_progress: start
    queue --> backlog: dequeue
    queue --> paused: pause

    state in_progress {
        direction LR
        [*] --> plan
        plan --> implement
        implement --> check
        check --> fix: 失败
        fix --> check
    }

    in_progress --> human_review: QA通过
    in_progress --> paused: pause
    in_progress --> failed: 错误

    paused --> queue: resume
    paused --> backlog: abandon

    human_review --> completed: approve
    human_review --> backlog: reject

    failed --> queue: retry
    failed --> backlog: abandon

    completed --> [*]
    cancelled --> [*]
```

| 状态 | 说明 | 触发命令 |
|------|------|----------|
| `backlog` | 待办，等待排队 | `task create` |
| `queue` | 已排队，等待执行 | `task enqueue` |
| `in_progress` | 执行中 (plan → implement → check) | `task start` |
| `paused` | 已暂停，保留进度 | `task pause` |
| `human_review` | 等待人工审核 | 自动 (QA 通过) |
| `completed` | 已完成 | `task approve` |
| `failed` | 执行失败 | 自动 |
| `cancelled` | 已取消 | `task cancel` |

### 任务目录结构

```
.viben/tasks/<date>-<slug>/
├── task.json           # 任务元数据 (状态、配置、时间戳)
├── events.jsonl        # 事件历史 (状态转换记录)
├── prd.md              # 产品需求文档
├── implement.jsonl     # 实现阶段上下文注入
├── check.jsonl         # 检查阶段上下文注入
└── logs/               # 执行日志
```

<details>
<summary><b>CLI 命令速查</b></summary>

**创建与配置**
```bash
viben task create "<title>" --slug <name>    # 创建任务
viben task init-context <task>               # 初始化上下文文件
viben task add-context <task> <file> -r "原因"  # 添加上下文文件
viben task set-agent <task> -a <agent>       # 设置智能体
```

**执行流程**
```bash
viben task enqueue <task>    # backlog → queue
viben task start <task>      # queue → in_progress
viben task pause <task>      # 暂停执行
viben task resume <task>     # 恢复执行
viben task status <task>     # 查看状态
```

**审核与完成**
```bash
viben task review <task>     # 查看待审核任务
viben task approve <task>    # human_review → completed
viben task reject <task>     # human_review → backlog
viben task retry <task>      # failed → queue
viben task cancel <task>     # * → cancelled
```

**辅助命令**
```bash
viben task list              # 列出所有任务
viben task context <task>    # 获取指定任务的会话上下文
viben task create-pr <task>  # 从任务创建 PR
viben task archive <task>    # 归档已完成任务
```

</details>

---

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

# 查看生成的想法
viben idea list

# 将想法转为任务
viben idea promote ci-001
```

> 支持在 `docs/idea-types/*.md` 创建自定义类型 prompt 模板

---

## ⚙️ 配置

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

---

<details>
<summary><b>🛠️ 开发者指南</b></summary>

### 📋 环境要求

- Node.js >= 20
- pnpm >= 9.15
- Rust (桌面应用)

### 🚀 快速开始

```bash
git clone https://github.com/LinXueyuanStdio/viben.git
cd viben && pnpm install

pnpm build              # 构建
pnpm desktop:restart    # 桌面应用开发
pnpm gateway:restart    # 启动 Gateway
```

### 📁 项目结构

```
apps/
├── cli/        # viben 命令行
├── desktop/    # Tauri 桌面应用
└── web/        # Next.js (MCP 市场)

packages/
├── core/       # 核心库 + Gateway
├── ui/         # UI 组件库
├── chat/       # 聊天组件
└── kanban/     # 看板组件
```

### 🔧 技术栈

| 类别 | 技术 |
|:----:|------|
| 📝 语言 | TypeScript |
| 🖥️ 桌面 | Tauri 2 + React 19 + Vite |
| 🌐 Web | Next.js 15 |
| 🎨 样式 | Tailwind CSS 4 + Radix UI |
| 📊 状态 | Zustand |
| 🔨 构建 | pnpm + Turborepo |

</details>

---

## 📄 许可证

[MIT](./LICENSE)
