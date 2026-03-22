**中文 | [English](./README_EN.md)**

<div align="center">

<img src="docs/design-system/brand-preview/viben-logo-animated.svg" alt="Viben Logo" width="120" height="120">

# 微本

### Agent 集群 × 代码进化

##### 把代码库当作模型参数，针对文件使用强化学习持续优化

[![Release](https://img.shields.io/github/v/release/LinXueyuanStdio/viben?style=flat-square&logo=github)](https://github.com/LinXueyuanStdio/viben/releases)
[![License](https://img.shields.io/github/license/LinXueyuanStdio/viben?style=flat-square)](./LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen?style=flat-square&logo=node.js)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Tauri](https://img.shields.io/badge/Tauri-2.0-orange?style=flat-square&logo=tauri)](https://tauri.app/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen?style=flat-square)](https://github.com/LinXueyuanStdio/viben/pulls)

</div>

---

## 🧬 FileRL: 代码库强化学习

<div align="center">

```mermaid
%%{init: {'theme': 'base', 'themeVariables': { 'fontSize': '14px', 'fontFamily': 'Georgia', 'primaryColor': '#f8fafc', 'primaryTextColor': '#0f172a', 'primaryBorderColor': '#334155', 'lineColor': '#475569'}}}%%
flowchart LR
    subgraph INPUT [" "]
        direction TB
        I1["Codebase<br/>C ∈ Σ*"]
        I2["Target<br/>Objective"]
    end

    subgraph POLICY ["Policy Network π(PR|C)"]
        direction TB
        P1["Idea<br/>Generation"]
        P2["Code<br/>Synthesis"]
        P3["PR<br/>Creation"]
        P1 --> P2 --> P3
    end

    subgraph PARALLEL ["Parallel Rollout (×N)"]
        direction TB
        R1["PR₁"]
        R2["PR₂"]
        R3["PR₃"]
        RN["PRₙ"]
        R1 ~~~ R2 ~~~ R3 ~~~ RN
    end

    subgraph REWARD ["Reward Model R(PR)"]
        direction TB
        W1["Coverage<br/>w₁"]
        W2["Quality<br/>w₂"]
        W3["Security<br/>w₃"]
        W4["Review<br/>w₄"]
        SUM["Σ wᵢrᵢ"]
        W1 & W2 & W3 & W4 --> SUM
    end

    subgraph PPO ["PPO Selection"]
        direction TB
        KL["KL ← λ · Δlines/max"]
        ADJ["R̃ ← R - KL"]
        ADV["A ← R̃ - baseline"]
        SEL["π* ← argmax(A)"]
        KL --> ADJ --> ADV --> SEL
    end

    subgraph UPDATE ["Parameter Update"]
        direction TB
        U1["git merge PR*"]
        U2["C ← C'"]
    end

    INPUT --> POLICY
    POLICY --> PARALLEL
    PARALLEL --> REWARD
    REWARD --> PPO
    PPO --> UPDATE
    UPDATE -->|"iteration t+1"| INPUT

    classDef inputStyle fill:#e0f2fe,stroke:#0284c7,stroke-width:2px,color:#0c4a6e
    classDef policyStyle fill:#fef3c7,stroke:#d97706,stroke-width:2px,color:#78350f
    classDef parallelStyle fill:#f3e8ff,stroke:#9333ea,stroke-width:2px,color:#581c87
    classDef rewardStyle fill:#fce7f3,stroke:#db2777,stroke-width:2px,color:#831843
    classDef ppoStyle fill:#d1fae5,stroke:#059669,stroke-width:2px,color:#064e3b
    classDef updateStyle fill:#e0e7ff,stroke:#4f46e5,stroke-width:2px,color:#312e81

    class INPUT,I1,I2 inputStyle
    class POLICY,P1,P2,P3 policyStyle
    class PARALLEL,R1,R2,R3,RN parallelStyle
    class REWARD,W1,W2,W3,W4,SUM rewardStyle
    class PPO,KL,ADJ,ADV,SEL ppoStyle
    class UPDATE,U1,U2 updateStyle
```

</div>

**算法形式化定义**

| 符号 | LLM PPO | FileRL | 描述 |
|:----:|:-------:|:------:|------|
| **θ** | 模型参数 ∈ ℝᵈ | 代码库 C ∈ Σ* | 优化目标 |
| **π** | π_θ(y\|x) | π(PR\|C) | 生成策略 |
| **a** | token yₜ | Pull Request | 单步动作 |
| **∇** | ∇L | git diff | 梯度/变化 |
| **update** | θ ← θ - η∇L | git merge | 参数更新 |
| **R** | R(x,y) | CI + Review | 奖励函数 |

**PPO 目标函数**

$$L^{PPO}(\theta) = \mathbb{E}\left[\min\left(r_t(\theta)\hat{A}_t, \text{clip}(r_t(\theta), 1-\epsilon, 1+\epsilon)\hat{A}_t\right)\right] - \lambda \cdot D_{KL}$$

其中 FileRL 的 KL 散度近似为代码变更规模：$D_{KL} \approx \frac{|\Delta\text{lines}|}{\text{max\_diff}}$

<details>
<summary><b>FileRL CLI 命令</b></summary>

**基础命令**
```bash
viben filerl create <name>       # 创建 FileRL 目标文件
viben filerl start <target.md>   # 启动 FileRL 优化循环
viben filerl status <name>       # 查看运行状态
viben filerl list                # 列出所有运行
viben filerl stop <name>         # 停止运行
viben filerl resume <name>       # 恢复运行
```

**Idea 生成与任务转换**
```bash
viben idea generate --types <types>          # 生成优化想法
viben idea list                              # 列出生成的想法
viben idea promote <id> --worktree --start   # 转为任务并启动
```

**奖励计算与 PPO 选择**
```bash
viben task compute-reward <task>             # 计算 PR 奖励
viben reward select <tasks...>               # PPO 选择最佳 PR
viben reward list-types                      # 列出奖励类型
```

**监控与清理**
```bash
viben swarm status --watch    # 实时监控 Agent
viben task approve <task>     # 批准并合并 PR
viben task cleanup <task>     # 清理 worktree
```

</details>

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

## 📋 任务系统

基于 XState 状态机的任务生命周期管理，支持看板、队列和自动化执行。

### 任务生命周期

```mermaid
%%{init: {'theme': 'base', 'themeVariables': { 'primaryColor': '#dbeafe', 'lineColor': '#64748b', 'primaryTextColor': '#1e293b'}}}%%
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

    in_progress --> review: QA通过
    in_progress --> paused: pause
    in_progress --> failed: 错误

    paused --> queue: resume
    paused --> backlog: abandon

    review --> completed: approve
    review --> backlog: reject

    failed --> queue: retry
    failed --> backlog: abandon

    completed --> [*]
    cancelled --> [*]

    classDef waiting fill:#e0f2fe,stroke:#3b82f6,color:#1e40af
    classDef active fill:#dcfce7,stroke:#22c55e,color:#166534
    classDef review fill:#fef3c7,stroke:#f59e0b,color:#92400e
    classDef done fill:#bbf7d0,stroke:#16a34a,color:#166534
    classDef error fill:#fee2e2,stroke:#ef4444,color:#991b1b

    class backlog,queue,paused waiting
    class in_progress active
    class review review
    class completed done
    class failed,cancelled error
```

> **内部流程**: `in_progress` 状态内部执行 plan → implement → check → fix 循环

| 状态 | 说明 | 触发命令 |
|------|------|----------|
| `backlog` | 待办，等待排队 | `task create` |
| `queue` | 已排队，等待执行 | `task enqueue` |
| `in_progress` | 执行中 (plan → implement → check) | `task start` |
| `paused` | 已暂停，保留进度 | `task pause` |
| `review` | 等待人工审核 | 自动 (QA 通过) |
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
viben task review <task>     # 用户手动审核任务
viben task approve <task>    # review → completed
viben task reject <task>     # review → backlog
viben task retry <task>      # failed → queue
viben task cancel <task>     # * → cancelled
```

**辅助命令**
```bash
viben task list              # 列出所有任务
viben task context <task>    # 获取指定任务的会话上下文
viben task plan-phase <task> # 执行计划阶段
viben task work-phase <task> # 执行工作阶段
viben task create-worktree <task> # 创建 Git 工作树
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

# 将想法转为任务并立即启动（支持 task create 的所有选项）
viben idea promote ci-001 --start --worktree
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
