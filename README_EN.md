<div align="center">

**[中文](./README.md) | English**

# 🚀 Viben

### Multi-Agent Workspace Manager

*Orchestrate AI Agent clusters locally, unified management of kanban, calendar, timeline and tasks*

[![Release](https://img.shields.io/github/v/release/LinXueyuanStdio/viben?style=flat-square&logo=github)](https://github.com/LinXueyuanStdio/viben/releases)
[![License](https://img.shields.io/github/license/LinXueyuanStdio/viben?style=flat-square)](./LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen?style=flat-square&logo=node.js)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Tauri](https://img.shields.io/badge/Tauri-2.0-orange?style=flat-square&logo=tauri)](https://tauri.app/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen?style=flat-square)](https://github.com/LinXueyuanStdio/viben/pulls)

</div>

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🤖 **Multi-Agent Orchestration** | Coordinate AI Agent clusters in local workspace |
| 🔌 **MCP Protocol** | Full support for Model Context Protocol |
| 🖥️ **Cross-Platform** | CLI, Desktop, and Web apps unified |
| 📋 **Kanban Board** | Drag-and-drop task management with real-time tracking |
| 📡 **Session Monitoring** | Real-time view of Agent conversations and tool calls |

---

## 📦 Download

### 🖥️ Desktop App

| Platform | Download |
|:--------:|----------|
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

# Or run directly (no installation)
npx viben
```

---

## 📋 Task System

XState-based task lifecycle management with kanban, queue, and automated execution.

### Task Lifecycle

```mermaid
%%{init: {'theme': 'base', 'themeVariables': { 'primaryColor': '#dbeafe', 'lineColor': '#64748b', 'primaryTextColor': '#1e293b'}}}%%
stateDiagram-v2
    [*] --> backlog: Create

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
        check --> fix: Failed
        fix --> check
    }

    in_progress --> review: QA Passed
    in_progress --> paused: pause
    in_progress --> failed: Error

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

> **Internal Flow**: `in_progress` state internally executes plan -> implement -> check -> fix loop

| Status | Description | Trigger Command |
|--------|-------------|-----------------|
| `backlog` | Pending, waiting to be queued | `task create` |
| `queue` | Queued, waiting for execution | `task enqueue` |
| `in_progress` | Executing (plan → implement → check) | `task start` |
| `paused` | Paused, progress preserved | `task pause` |
| `review` | Awaiting human review | Auto (QA passed) |
| `completed` | Completed | `task approve` |
| `failed` | Execution failed | Auto |
| `cancelled` | Cancelled | `task cancel` |

### Task Directory Structure

```
.viben/tasks/<date>-<slug>/
├── task.json           # Task metadata (status, config, timestamps)
├── events.jsonl        # Event history (state transitions)
├── prd.md              # Product requirements document
├── implement.jsonl     # Implementation phase context injection
├── check.jsonl         # Check phase context injection
└── logs/               # Execution logs
```

<details>
<summary><b>CLI Command Reference</b></summary>

**Create & Configure**
```bash
viben task create "<title>" --slug <name>    # Create task
viben task init-context <task>               # Init context files
viben task add-context <task> <file> -r "reason"  # Add context file
viben task set-agent <task> -a <agent>       # Set agent
```

**Execution Flow**
```bash
viben task enqueue <task>    # backlog → queue
viben task start <task>      # queue → in_progress
viben task pause <task>      # Pause execution
viben task resume <task>     # Resume execution
viben task status <task>     # View status
```

**Review & Complete**
```bash
viben task review <task>     # View task for review
viben task approve <task>    # review → completed
viben task reject <task>     # review → backlog
viben task retry <task>      # failed → queue
viben task cancel <task>     # * → cancelled
```

**Utilities**
```bash
viben task list              # List all tasks
viben task context <task>    # Get session context for task
viben task create-pr <task>  # Create PR from task
viben task archive <task>    # Archive completed task
```

</details>

---

## 💡 Idea Generation

AI-driven codebase analysis that auto-generates improvement suggestions and converts them to tasks.

| Built-in Types | Description |
|----------------|-------------|
| `code_improvements` | Code improvements based on existing patterns |
| `security_hardening` | Security vulnerabilities and hardening |
| `performance_optimizations` | Performance bottlenecks and optimizations |
| `documentation_gaps` | Missing documentation |
| `ui_ux_improvements` | UI/UX enhancements |
| `code_quality` | Code quality and refactoring |

```bash
# Generate improvement suggestions
viben idea generate --types code_improvements security_hardening

# List generated ideas
viben idea list

# Promote idea to task
viben idea promote ci-001

# Promote idea and start execution (supports all task create options)
viben idea promote ci-001 --start --worktree
```

> Custom type prompt templates can be created in `docs/idea-types/*.md`

---

## ⚙️ Configuration

```
~/.viben/
├── providers.yaml    # API Keys, Endpoints
├── models.yaml       # Model parameters
├── agents/           # Agent definitions
│   └── <name>/
│       └── AGENTS.md
├── cron.yaml         # Scheduled tasks
├── channels.yaml     # Notification channels
└── workspaces.yaml   # Workspaces
```

---

<details>
<summary><b>🛠️ Developer Guide</b></summary>

### 📋 Requirements

- Node.js >= 20
- pnpm >= 9.15
- Rust (for desktop app)

### 🚀 Quick Start

```bash
git clone https://github.com/LinXueyuanStdio/viben.git
cd viben && pnpm install

pnpm build              # Build
pnpm desktop:restart    # Desktop app dev
pnpm gateway:restart    # Start Gateway
```

### 📁 Project Structure

```
apps/
├── cli/        # viben CLI
├── desktop/    # Tauri desktop app
└── web/        # Next.js (MCP marketplace)

packages/
├── core/       # Core library + Gateway
├── ui/         # UI component library
├── chat/       # Chat components
└── kanban/     # Kanban components
```

### 🔧 Tech Stack

| Category | Technology |
|:--------:|------------|
| 📝 Language | TypeScript |
| 🖥️ Desktop | Tauri 2 + React 19 + Vite |
| 🌐 Web | Next.js 15 |
| 🎨 Styling | Tailwind CSS 4 + Radix UI |
| 📊 State | Zustand |
| 🔨 Build | pnpm + Turborepo |

</details>

---

## 📄 License

[MIT](./LICENSE)
