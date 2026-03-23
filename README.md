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

> *将代码库视为可优化的参数空间，通过 PPO 算法迭代提升代码质量*

<details open>
<summary><b>算法概述</b></summary>

<div align="center">

```mermaid
%%{init: {'theme': 'base', 'themeVariables': { 'fontSize': '12px', 'fontFamily': 'Georgia'}}}%%
flowchart TB
    subgraph MODELS ["🧠 Model = Codebase(θ) + Agent(f)"]
        direction LR

        subgraph M1 ["π_θ Policy (Actor)"]
            C1["📂 Worktree<br/>𝒞_θ 可变"]
            A1["🤖 Agent<br/>生成 PR"]
        end
        subgraph M2 ["π_ref Reference"]
            C2["📂 Main Branch<br/>𝒞_ref 固定"]
            A2["🔒 Agent<br/>参考策略"]
        end

        subgraph M3 ["R Reward Model"]
            C3["📂 Worktree<br/>Δ𝒞"]
            A3["⚖️ Agent<br/>质量评分"]
        end
        subgraph M4 ["V Value (Critic)"]
            C4["📂 Main Branch<br/>𝒞_ref (同 π_ref)"]
            A4["📈 Agent<br/>V(𝒞) 期望回报"]
        end
    end

    %% NOTE["💡 FileRL 只优化 θ (代码库)，Agent 架构 f 保持固定"]
    %% FORMULA["🎯 L = 𝔼[min(rₜÂ, clip(rₜ,1-ε,1+ε)Â)] where rₜ = π_θ/π_ref"]

    subgraph LOOP ["🔄 PPO Optimization Loop"]
        direction LR

        subgraph S1 ["① SAMPLE: Parallel Rollout"]
            direction TB
            FORK["git worktree add ×N"]
            GEN["π_θ: Idea → Code → PR"]
            PRS["PR₁ ‖ PR₂ ‖ ... ‖ PRₙ"]
            FORK --> GEN --> PRS
        end

        subgraph S2 ["② REWARD: Multi-Objective"]
            direction TB
            subgraph METRICS ["R(PR) = Σ wᵢrᵢ"]
                R1["Coverage"]
                R2["Quality"]
                R3["Security"]
                R4["Review"]
            end
            KL["D_KL ≈ |Δlines|/max_diff"]
            ADJ["R̃ = R − λ·D_KL"]
            R1 & R2 & R3 & R4 --> ADJ
            KL --> ADJ
        end

        subgraph S3 ["③ PPO: Ratio + Clip + Advantage"]
            direction TB
            RATIO["rₜ = π_θ(PR|𝒞) / π_ref(PR|𝒞_ref)"]
            VALUE["V(𝒞_ref) = Critic(𝒞_ref)"]
            ADV["Â = R̃ − V(𝒞_ref)"]
            CLIP["L = min(rₜÂ, clip(rₜ,1-ε,1+ε)Â)"]
            SEL["PR* = argmax L, where R̃ ≥ τ"]
            RATIO --> CLIP
            VALUE --> ADV --> CLIP --> SEL
        end

        subgraph S4 ["④ UPDATE: Merge Best"]
            direction TB
            MERGE["git merge PR* → main"]
            UPD["θ ← θ' (𝒞 updated)"]
            CHK{"收敛?<br/>ΔL < δ"}
            MERGE --> UPD --> CHK
        end

        S1 --> S2 --> S3 --> S4
    end

    C1 -.->|"生成动作"| GEN
    C2 -.->|"计算 ratio"| RATIO
    A3 -.->|"评估质量"| METRICS
    A4 -.->|"估计 V(s)"| VALUE
    CHK -->|"No, t←t+1"| S1
    CHK -->|"Yes"| DONE["✅ θ* Optimized"]

    classDef modelBox fill:#f8fafc,stroke:#64748b,stroke-width:2px
    classDef policyStyle fill:#fef3c7,stroke:#d97706,stroke-width:2px,color:#78350f
    classDef refStyle fill:#e0f2fe,stroke:#0284c7,stroke-width:2px,color:#0c4a6e
    classDef rewardStyle fill:#fce7f3,stroke:#db2777,stroke-width:2px,color:#831843
    classDef valueStyle fill:#d1fae5,stroke:#059669,stroke-width:2px,color:#064e3b
    classDef noteStyle fill:#fef9c3,stroke:#ca8a04,stroke-width:1px,color:#713f12
    classDef loopStyle fill:#f1f5f9,stroke:#475569,stroke-width:1px
    classDef doneStyle fill:#bbf7d0,stroke:#16a34a,stroke-width:2px,color:#166534

    class MODELS,ROW1,ROW2 modelBox
    class M1,C1,A1,GEN,PRS policyStyle
    class M2,C2,A2,RATIO refStyle
    class M3,C3,A3,METRICS,R1,R2,R3,R4,KL,ADJ rewardStyle
    class M4,C4,A4,VALUE,ADV,CLIP,SEL valueStyle
    class NOTE,FORMULA noteStyle
    class S1,S2,S3,S4,FORK,MERGE,UPD,CHK loopStyle
    class DONE doneStyle
```

</div>

</details>

<details>
<summary><b>形式化定义</b></summary>

**符号映射**: LLM PPO → FileRL

| 符号 | LLM PPO | FileRL |
|:----:|:-------:|:------:|
| **θ** | 模型参数 ∈ ℝᵈ | 代码库 $\mathcal{C} \in \Sigma^*$ |
| **π** | $\pi_\theta(y \mid x)$ | $\pi(\text{PR} \mid \mathcal{C})$ |
| **a** | token $y_t$ | Pull Request |
| **∇** | $\nabla_\theta \mathcal{L}$ | `git diff` |
| **⊕** | $\theta \leftarrow \theta - \eta \nabla \mathcal{L}$ | `git merge` |
| **R** | $R(x, y)$ | CI + Agent Review |

**目标函数**

$$\mathcal{L}^{\text{FileRL}} = \mathbb{E}_{\text{PR} \sim \pi}\left[\min\left(r_t \hat{A}_t,\ \text{clip}(r_t, 1{-}\epsilon, 1{+}\epsilon)\hat{A}_t\right)\right] - \lambda \cdot D_{\text{KL}}$$

**KL 散度近似** (变更规模惩罚)

$$D_{\text{KL}} \approx \frac{|\Delta\text{lines}|}{\text{max\_diff}}$$

**多目标奖励函数**

$$R(\text{PR}) = \sum_{i=1}^{k} w_i \cdot r_i(\text{PR}) - \lambda \cdot D_{\text{KL}}$$

其中 $r_i$ 为各维度评分 (测试覆盖率、代码质量、安全性、Agent 评审等)，$\sum w_i = 1$

**优势估计与选择**

$$\hat{A} = \tilde{R} - \bar{R}, \quad \text{PR}^* = \arg\max_{\text{PR}} \hat{A}(\text{PR})$$

</details>

<details>
<summary><b>算法伪代码</b></summary>

```
Algorithm: FileRL — Codebase Reinforcement Learning
────────────────────────────────────────────────────
Input:  C₀ (initial codebase), T (max iterations), N (parallel rollouts)
        λ (KL coefficient), τ (reward threshold), δ (convergence threshold)
Output: C* (optimized codebase)

1   C ← C₀
2   history ← []
3   for t = 1 to T do
4   │   // Phase 1: Parallel Rollout
5   │   Ideas ← IdeaGeneration(C)
6   │   PRs ← ∅
7   │   for i = 1 to N do in parallel
8   │   │   PRᵢ ← CodeSynthesis(C, Ideas[i])
9   │   │   PRs ← PRs ∪ {PRᵢ}
10  │   end
11  │
12  │   // Phase 2: Reward Computation
13  │   for each PR ∈ PRs do
14  │   │   R(PR) ← Σᵢ wᵢ · rᵢ(PR)           // multi-objective reward
15  │   │   D_KL(PR) ← λ · |Δlines| / max_diff
16  │   │   R̃(PR) ← R(PR) - D_KL(PR)          // adjusted reward
17  │   end
18  │
19  │   // Phase 3: PPO Selection
20  │   baseline ← mean({R̃(PR) : PR ∈ PRs})
21  │   for each PR ∈ PRs do
22  │   │   Â(PR) ← R̃(PR) - baseline          // advantage
23  │   end
24  │   PR* ← argmax_{PR: R̃(PR)≥τ} Â(PR)
25  │
26  │   // Phase 4: Update
27  │   if PR* ≠ ∅ then
28  │   │   C ← Merge(C, PR*)                  // git merge
29  │   │   history.append(R̃(PR*))
30  │   end
31  │
32  │   // Phase 5: Convergence Check
33  │   if |mean(history[-5:]) - mean(history[-10:-5])| < δ then
34  │   │   break                              // converged
35  │   end
36  end
37  return C
```

</details>

<details>
<summary><b>CLI 命令速查</b></summary>

```bash
# 生命周期
viben filerl create <name>       # 创建优化目标
viben filerl start <target.md>   # 启动优化循环
viben filerl status <name>       # 查看状态
viben filerl stop <name>         # 停止
viben filerl resume <name>       # 恢复

# Idea → Task
viben idea generate --types <t>  # 生成想法
viben idea promote <id> --start  # 转为任务

# 奖励与选择
viben reward select <tasks...>   # PPO 选择最佳
viben task approve <task>        # 合并 PR

# 监控
viben swarm status --watch       # 实时监控
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
