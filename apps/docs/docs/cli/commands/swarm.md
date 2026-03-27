---
sidebar_position: 19
title: "viben swarm"
description: "Agent swarm scheduling command for managing multi-agent parallel development"
---

# viben swarm

Agent swarm scheduling command for managing multi-agent parallel development.

:::warning Deprecation Notice
`viben swarm start` has been deprecated.

**Recommended alternatives**:
- Full workflow (plan -> work): `viben task start <task>`
- Work phase only (skip plan): `viben task work-phase <task>`
:::

## Overview

The `viben swarm` command is used to manage agent swarms, supporting the launch of multiple agents working in parallel in isolated Git worktrees.

## Command Structure

```bash
viben swarm <subcommand> [options]
```

## Subcommand Overview

| Subcommand | Description |
|------------|-------------|
| `start` | Start an agent (deprecated) |
| `stop` | Stop an agent |
| `status` | View agent status |
| `wait` | Wait for agents to complete |
| `list` | List worktrees |
| `registry` | Show agent registry |

## Start Agent (Deprecated)

:::caution
Please use `viben task work-phase <task>` instead.
:::

```bash
viben swarm start <task> [options]
```

**Options**:

| Option | Description |
|--------|-------------|
| `--executor <executor>` | Specify executor (CLAUDE_CODE, CURSOR, GEMINI_CLI, etc.) |
| `--detach` | Run in background, don't block the terminal |
| `--resume` | Resume agent session |
| `--session <id>` | Specify session-id to resume |

**Migration Guide**:

| Old Command | New Command |
|-------------|-------------|
| `viben swarm start <task>` | `viben task start <task>` |
| `viben swarm start <task>` | `viben task work-phase <task>` |

## Stop Agent

```bash
viben swarm stop <task> [--force]
viben swarm stop --all [--force]
```

**Options**:

| Option | Description |
|--------|-------------|
| `--force` | Force terminate (SIGKILL) |
| `--all` | Stop all running agents |

**Examples**:

```bash
viben swarm stop add-user-auth           # Stop specific agent (SIGTERM)
viben swarm stop add-user-auth --force   # Force terminate (SIGKILL)
viben swarm stop --all                   # Stop all agents
```

## View Status

```bash
# View all agent statuses
viben swarm status                       # Show all agent summary
viben swarm status --running             # Show only running
viben swarm status --stopped             # Show only stopped
viben swarm status --json                # JSON output

# View specific agent status
viben swarm status <task>                # Show specific agent
viben swarm status <task> --detail       # Detailed status
viben swarm status <task> --watch        # Real-time log monitoring
viben swarm status <task> --log          # Show recent log entries
```

**Options**:

| Option | Description |
|--------|-------------|
| `--running` | Show only running agents |
| `--stopped` | Show only stopped agents |
| `--json` | JSON format output |
| `--detail` | Show detailed status |
| `--watch` | Real-time monitoring of agent logs |
| `--log` | Show recent log entries |

**Output**:

```
=== Swarm Status ===
Agents: 2 running / 3 registered

Running:
  ▶ add-user-auth [CLAUDE_CODE]
    Phase:    implement (1/3)
    Elapsed:  5m 32s
    Branch:   feature/user-auth
    Modified: 3 file(s)
    Activity: Edit
    PID:      12345

Stopped:
  ○ fix-login-bug [CLAUDE_CODE]
    Status:   in_progress
    "Analyzing login logic..."
    Resume:   viben swarm start fix-login-bug --resume
```

## Wait for Agents to Complete

```bash
viben swarm wait [tasks...] [options]
```

**Arguments**:

| Argument | Description |
|----------|-------------|
| `[tasks...]` | Optional, specify list of tasks to wait for |

**Options**:

| Option | Description | Default |
|--------|-------------|---------|
| `--all` | Wait for all running agents | - |
| `--polling-interval-seconds <n>` | Polling interval | 10 |
| `--timeout-seconds <n>` | Per-task timeout | 300 |
| `--quiet` | Quiet mode | - |
| `--verbose` | Verbose mode | - |
| `--json` | JSON format output | - |

**Completion Status**:

| Status | Description |
|--------|-------------|
| `completed` | Process exited + task.status is completed |
| `failed` | Process exited + task.status is failed |
| `timeout` | Timeout + calls `viben task reject <task>` |
| `exited` | Process exited but task.status not updated |

**Exit Codes**:

| Exit Code | Meaning |
|-----------|---------|
| 0 | All tasks completed |
| 1 | Some tasks timed out |
| 2 | No agents found |
| 3 | Execution error |

**Examples**:

```bash
# Wait for all agents
viben swarm wait --all

# Wait for specific tasks
viben swarm wait task-a task-b task-c

# Custom timeout
viben swarm wait --all --timeout-seconds 600 --polling-interval-seconds 5

# JSON output
viben swarm wait --all --json
```

**Output (progress mode)**:

```
Waiting for 3 agents... [10s] 1/3 completed
Waiting for 3 agents... [20s] 1/3 completed
Waiting for 3 agents... [30s] 2/3 completed
Waiting for 3 agents... [40s] 3/3 completed

=== Wait Complete ===
  ✓ task-a    completed  (35s)
  ✓ task-b    completed  (42s)
  ✗ task-c    timeout    (300s)

Summary: 2 completed, 0 failed, 1 timeout
```

## List Worktrees

```bash
viben swarm list [--json]
```

**Output**:

```
=== Git Worktrees ===

PATH                                           COMMIT   BRANCH
/path/to/project                               abc1234  [main]
~/.viben/worktrees/feature/user-auth           def5678  [feature/user-auth]

=== Registered Agents ===

  ● add-user-auth (PID: 12345)
    Worktree: ~/.viben/worktrees/feature/user-auth
    Started:  2024-03-03T10:30:00
```

## View Registry

```bash
viben swarm registry [--json]
```

**Output**:

```
=== Agent Registry ===

File: .viben/agents/registry.json

{
  "agents": [
    {
      "id": "add-user-auth",
      "worktree_path": "~/.viben/worktrees/feature/user-auth",
      "pid": 12345,
      "task_dir": ".viben/tasks/03-03-add-user-auth",
      "started_at": "2024-03-03T10:30:00",
      "platform": "claude"
    }
  ]
}
```

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Main Repository                       │
│  .viben/                                                 │
│  ├── tasks/                                              │
│  │   └── 03-03-add-user-auth/                           │
│  │       ├── task.json                                   │
│  │       ├── prd.md                                      │
│  │       └── *.jsonl                                     │
│  └── agents/                                             │
│      └── registry.json                                   │
└─────────────────────────────────────────────────────────┘
                          │
                          │ viben task work-phase (recommended)
                          ▼
┌─────────────────────────────────────────────────────────┐
│              Worktree (Isolated Branch)                  │
│  ~/.viben/worktrees/feature/user-auth/                  │
│  ├── (project files)                                     │
│  ├── .viben/                                             │
│  │   ├── .current-task                                   │
│  │   └── tasks/03-03-add-user-auth/                     │
│  ├── .agent-log                                          │
│  └── .session-id                                         │
│                                                          │
│  [Work Agent Running]                                    │
│    └── Executes task phases: implement → check → finish │
└─────────────────────────────────────────────────────────┘
```

## registry.json Format

```json
{
  "agents": [
    {
      "id": "add-user-auth",
      "worktree_path": "/Users/dev/.viben/worktrees/feature/user-auth",
      "pid": 12345,
      "task_dir": ".viben/tasks/03-03-add-user-auth",
      "started_at": "2024-03-03T10:30:00",
      "platform": "claude"
    }
  ]
}
```

## worktree.yaml Configuration

```yaml
# .viben/worktree.yaml
version: 1

# Worktree storage location
base_dir: ~/.viben/worktrees

# Files to copy when creating worktree
copy_files:
  - .env
  - .env.local
  - .envrc

# Commands to execute after creation
post_create:
  - pnpm install
  - pnpm build
```

## Related Commands

- [viben task](./task) - Task management command
- [viben executor](./executor) - Executor discovery and management
