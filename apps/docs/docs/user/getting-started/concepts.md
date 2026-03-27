---
sidebar_position: 3
title: "Core Concepts"
description: "Understanding Viben's core concepts: FileRL, Task System, Agents, Executors"
---

# Core Concepts

This document introduces Viben's core concepts to help you understand how the system works.

## FileRL: Code Iterative Optimization

FileRL is Viben's core algorithm that achieves iterative code quality improvement through multi-objective constrained candidate selection.

### Core Idea

```
Generate multiple candidates → Multi-dimensional evaluation → Select best to merge → Iterate
```

### System Components

| Component | Description |
|-----------|-------------|
| **Candidate Generator** | Agent generates PRs in isolated Worktree environments |
| **Reference Baseline** | Main Branch original codebase, used to calculate change volume |
| **Quality Evaluator** | CI + Agent multi-dimensional scoring (tests, quality, security) |

### Iteration Loop

1. **Sampling** - Batch generate B different types of ideas, each expanded N times in parallel
2. **Evaluation** - Multi-objective scoring R + change volume penalty d → adjusted score R̃
3. **Selection** - Two-stage filtering: select best per idea, then select global best
4. **Update** - Merge best PR, update codebase

### Scoring Mechanism

**Multi-objective Scoring**:

`R = Σ wᵢ · rᵢ`

Where rᵢ represents scores for each dimension (test pass rate, code quality, security, etc.)

**Change Penalty**:

`R̃ = R - λ · d`

Where d is the normalized change volume, λ is the penalty coefficient

---

## Task System

Task lifecycle management based on XState state machine.

### Task States

| State | Description |
|-------|-------------|
| `backlog` | Pending, waiting to be queued |
| `queue` | Queued, waiting for execution |
| `in_progress` | Executing (plan → implement → check → fix) |
| `paused` | Paused, progress preserved |
| `review` | Waiting for manual review |
| `completed` | Completed |
| `failed` | Execution failed |
| `cancelled` | Cancelled |

### Internal Execution Flow

Internal execution within `in_progress` state:

```
plan → implement → check → fix (loops on failure)
```

### Task Directory Structure

```
.viben/tasks/<date>-<slug>/
├── task.json           # Task metadata
├── events.jsonl        # Event history
├── prd.md              # Product requirements document
├── implement.jsonl     # Implementation phase context
├── check.jsonl         # Check phase context
└── logs/               # Execution logs
```

---

## Agent vs Executor

Viben distinguishes between two key concepts:

### Executor

An Executor is the underlying AI coding agent runtime.

**Characteristics**:
- **Read-only** - Executors are detected by the system; users cannot create or modify them
- **Independent Installation** - Requires separate installation
- **Runtime Environment** - Provides actual AI inference capabilities

**Supported Executors**:

| Executor | Type | CLI Command | MCP Support |
|----------|------|-------------|-------------|
| Claude Code | CLAUDE_CODE | `claude` | ✓ |
| AMP | AMP | `amp` | ✓ |
| Gemini | GEMINI | `gemini` | - |
| Codex | CODEX | `codex` | - |
| Cursor | CURSOR_AGENT | `cursor` | ✓ |
| Qwen Code | QWEN_CODE | `qwen` | - |
| Copilot | COPILOT | `copilot` | - |

### Agent

An Agent is a user-created configuration that defines how to use an Executor.

**Characteristics**:
- **Editable** - Users can create, modify, and delete
- **Stored in YAML** - Configuration files stored in `.viben/agents/` directory
- **References Executor** - Specifies which executor to use via the `executor_type` field

**Configuration Example**:

```yaml
# ~/.viben/agents/my-agent/config.yaml
id: my-agent
name: My Coding Assistant
executor_type: CLAUDE_CODE
model: claude-3-sonnet
system_prompt: You are a helpful coding assistant.
```

### Relationship Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        Agent                                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  name: My Agent                                      │   │
│  │  executor_type: CLAUDE_CODE  ──────────────────┐    │   │
│  │  model: claude-3-sonnet                        │    │   │
│  │  system_prompt: "..."                          │    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                    │        │
│                                                    ▼        │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                    Executor                          │   │
│  │  type: CLAUDE_CODE                                   │   │
│  │  cli: claude                                         │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## Idea Generation

AI-driven codebase analysis that automatically discovers improvement opportunities.

### Built-in Types

| Type | Description |
|------|-------------|
| `code_improvements` | Code improvements based on existing patterns |
| `security_hardening` | Security vulnerabilities and hardening measures |
| `performance_optimizations` | Performance bottlenecks and optimizations |
| `documentation_gaps` | Missing documentation |
| `ui_ux_improvements` | UI/UX enhancements |
| `code_quality` | Code quality and refactoring |

### Custom Types

Create custom prompt templates in `docs/idea-types/*.md`.

---

## Configuration System

Viben uses YAML files for configuration storage, supporting multi-level configuration merging.

### Configuration Storage Locations

| Scope | Location | Description |
|-------|----------|-------------|
| **Global** | `~/.viben/` | System-level configuration, applies to all projects |
| **Project** | `<project>/.viben/` | Project-specific configuration, overrides global |

### Global Configuration Structure

```
~/.viben/
├── providers.yaml       # API Keys, Endpoints
├── models.yaml          # Model parameters
├── agents/              # Agent definitions
│   └── <name>/
│       └── AGENTS.md
├── cron.yaml            # Scheduled tasks
├── channels.yaml        # Notification channels
└── workspaces.yaml      # Workspaces
```

### Project Configuration Structure

```
<project>/.viben/
├── agents/              # Project agents
├── tasks/               # Task directory
│   └── <date>-<slug>/
│       └── task.json
└── workspace/           # Developer workspace
```

### Configuration Priority

```
Global config (~/.viben/) → Project config (<project>/.viben/) → Command line arguments
```

---

## Provider and Model

### Provider

A Provider is an AI service provider.

```yaml
# ~/.viben/providers.yaml
anthropic:
  api_key: ${ANTHROPIC_API_KEY}
  base_url: https://api.anthropic.com
```

### Model

A Model is a specific AI model.

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

## Next Steps

- [Quick Start](./quick-start) - Get started with Viben
- [Desktop App Features](../desktop/features) - Learn about desktop app features
- [CLI Documentation](/cli/) - Command line tool reference
