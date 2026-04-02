---
sidebar_position: 1
title: "Introduction to Viben"
description: "Viben - Agent Swarm × Code Evolution, multi-objective constrained iterative optimization, automatically improving code quality"
---

# Viben

**Viben** is an Agent Swarm and Code Evolution platform that automatically improves code quality through multi-objective constrained iterative optimization.

## Core Features

| Feature | Description |
|---------|-------------|
| 🧬 **FileEvo** | Code iterative optimization: multi-candidate sampling + quality evaluation, automatically selects optimal solution to merge |
| 🤖 **Multi-Agent** | Agent swarm orchestration: parallel Worktree isolation, automated task distribution and monitoring |
| 🔌 **MCP Protocol** | Model Context Protocol: tool registration and invocation, extends Agent capability boundaries |
| 📋 **Task System** | XState state machine driven: Kanban + Queue + Auto-execution, complete task lifecycle management |
| 💡 **Idea Generation** | AI-driven code analysis: automatically discovers improvement points, one-click conversion to executable tasks |
| 🖥️ **Cross-Platform** | CLI / Desktop / Web: Tauri 2 desktop app, unified experience across all three |

## Product Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      Viben Architecture Overview                 │
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

## FileEvo: Code Iterative Optimization

> *Multi-objective constrained candidate selection algorithm, iteratively improving code quality through sampling-evaluation-selection cycles*

FileEvo is a **heuristic iterative optimization method**, with the core idea of "generate multiple candidate solutions → multi-dimensional evaluation → select optimal to merge".

### System Components

| Component | Description |
|-----------|-------------|
| **Candidate Generator** | Agent generates PRs in Worktree isolated environments |
| **Reference Baseline** | Main Branch original codebase, used to calculate change volume |
| **Quality Evaluator** | CI + Agent multi-dimensional scoring |

### Iterative Optimization Loop

1. **Sampling** - Batch generate B ideas, each expanded N times in parallel, total B×N candidates
2. **Evaluation** - Multi-objective scoring + change volume calculation + adjusted score
3. **Selection** - Two-phase filtering: select best PR per idea, select best PR globally
4. **Update** - Merge best PR, update codebase, check stop conditions

### CLI Commands

```bash
# Lifecycle
viben evo create <name>       # Create optimization target
viben evo start <target.md>   # Start optimization loop
viben evo status <name>       # View status

# Idea → Task
viben idea generate --types <t>  # Generate ideas
viben idea promote <id> --start  # Convert to task

# Monitoring
viben swarm status --watch       # Real-time monitoring
```

## Task System

Task lifecycle management based on XState state machine, supporting Kanban, queue, and automated execution.

### Task State Transitions

```
backlog → queue → in_progress → review → completed
                       ↓
              plan → implement → check → fix (loop)
```

| State | Description | Trigger Command |
|-------|-------------|-----------------|
| `backlog` | Pending, waiting to be queued | `task create` |
| `queue` | Queued, waiting for execution | `task enqueue` |
| `in_progress` | In progress | `task start` |
| `review` | Awaiting human review | Auto (QA passed) |
| `completed` | Completed | `task approve` |

### CLI Commands

```bash
viben task create "<title>" --slug <name>  # Create task
viben task enqueue <task>                  # backlog → queue
viben task start <task>                    # queue → in_progress
viben task approve <task>                  # review → completed
viben task list                            # List all tasks
```

## 💡 Idea Generation

AI-driven codebase analysis, automatically generating improvement suggestions and converting to tasks.

| Built-in Type | Description |
|---------------|-------------|
| `code_improvements` | Code improvements based on existing patterns |
| `security_hardening` | Security vulnerabilities and hardening measures |
| `performance_optimizations` | Performance bottlenecks and optimizations |
| `documentation_gaps` | Missing documentation |
| `ui_ux_improvements` | UI/UX enhancements |
| `code_quality` | Code quality and refactoring |

```bash
# Generate code improvement suggestions
viben idea generate --types code_improvements security_hardening

# Convert idea to task and start immediately
viben idea promote ci-001 --start --worktree
```

## Configuration

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

## Quick Start

### Desktop App (Recommended)

[![Latest Version](https://img.shields.io/github/v/release/LinXueyuanStdio/viben?filter=desktop-v*&label=Desktop%20App)](https://github.com/LinXueyuanStdio/viben/releases?q=desktop)

| Platform | Download Format |
|----------|-----------------|
| **macOS** | `.dmg` (Universal) |
| **Windows** | `.msi` or `.exe` |
| **Linux** | `.AppImage` or `.deb` |

### CLI Tool

```bash
# npm
npm install -g viben

# Or run directly
npx viben
```

## Gateway API

Viben Gateway is the core backend service, running on port **18790**.

| Endpoint | Function |
|----------|----------|
| `/health` | Health check |
| `/api/agent` | Agent management |
| `/api/sessions` | Session management |
| `/api/providers` | Provider management |
| `/api/models` | Model management |

:::info API Documentation
For complete Gateway API documentation, see [API Reference](/backend/api/).
:::

## Next Steps

- [Core Concepts](./getting-started/concepts.md) - Understand Viben's core concepts
- [Quick Start](./getting-started/quick-start.md) - Get started quickly
- [Desktop App](./desktop/) - Complete desktop app guide
- [CLI Documentation](/cli/) - Command line tool reference
