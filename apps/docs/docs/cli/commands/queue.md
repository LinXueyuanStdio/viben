---
sidebar_position: 18
title: "viben queue"
description: "Command queue management for task scheduling and monitoring"
---

# viben queue

Command queue management for operations, debugging, and monitoring queue status.

## Overview

The `viben queue` command is the CLI client for CommandQueue, sharing the same underlying operation layer with `/api/queue/*` Gateway endpoints. Primarily designed for agent debugging scenarios with detailed output information.

## Design Principles

- **Debug-first**: Detailed output for agent problem analysis
- **CLI/API consistency**: All operations share the same underlying ops with Gateway REST API
- **Format-friendly**: Human-readable by default, `--json` output for parsing

## Architecture

```
+---------------------------------------------------------------------+
|                    CLI / Gateway                                      |
+---------------------------------------------------------------------+
|  +------------------+         +------------------+                   |
|  |  viben queue *   |         |  /api/queue/*    |                   |
|  |  (CLI commands)  |         |  (REST routes)   |                   |
|  +--------+---------+         +--------+---------+                   |
|           |                            |                             |
|           +------------+---------------+                             |
|                        |                                             |
|                        v                                             |
|  +---------------------------------------------------------------+  |
|  |              packages/core/src/queue/ops                       |  |
|  |  enqueue, cancel, retry, status, list, logs, config, clean     |  |
|  +---------------------------------------------------------------+  |
+---------------------------------------------------------------------+
```

## Command Structure

```bash
viben queue <subcommand> [options]
```

## Ops-to-API Mapping

### QueueOps

| CLI Command | Ops Function | REST API Endpoint |
|-------------|-------------|-------------------|
| `viben queue status` | `getStatus()` | GET /api/queue/status |
| `viben queue list` | `list()` | GET /api/queue/list |
| `viben queue inspect <id>` | `getItem()` | GET /api/queue/:id |
| `viben queue enqueue` | `enqueue()` | POST /api/queue/enqueue |
| `viben queue cancel <id>` | `cancel()` | DELETE /api/queue/:id |
| `viben queue retry <id>` | `retry()` | POST /api/queue/:id/retry |
| `viben queue logs <id>` | `getLogs()` | GET /api/queue/:id/logs |
| `viben queue watch` | (WebSocket) | WebSocket /ws/queue |
| `viben queue config` | `getConfig()` / `setConfig()` | GET/PUT /api/queue/config |
| `viben queue clean` | `clean()` | DELETE /api/queue/clean |

### ProcessOps

| Operation | Ops Function | Description |
|-----------|-------------|-------------|
| Spawn | `spawnProcess()` | Start a new process for a queue task |
| Kill | `killProcess()` | Terminate a running process (SIGTERM) |
| Monitor | `monitorProcess()` | Check process health and status |

## Subcommand Overview

| Subcommand | Description |
|------------|-------------|
| `status` | Overall queue status |
| `list` | Task list |
| `inspect` | Task details |
| `enqueue` | Submit command |
| `cancel` | Cancel task |
| `retry` | Retry failed task |
| `logs` | View task logs |
| `watch` | Real-time queue monitoring |
| `config` | Configuration management |
| `clean` | Clean completed tasks |

## Queue Status

### View Status

```bash
viben queue status [--json]
```

**Output**:

```
Queue Status
────────────────────────────────────────
  Pending:     3 task(s)
  Running:     2 / 3 (max concurrency)
  Completed:   15 task(s)

Running Tasks:
  q_abc123  sleep 60    2m 15s
  q_def456  claude -p   45s

Persistence: ~/.viben/queue/ (healthy)
```

### List Tasks

```bash
viben queue list [--status <status>] [--limit <n>] [--all] [--json]
```

**Options**:

| Option | Description |
|--------|-------------|
| `--status`, `-s` | Filter by status (pending, running, completed) |
| `--limit`, `-n` | Limit number of results, default 50 |
| `--all` | Show all tasks (including completed) |
| `--json` | JSON format output |

**Examples**:

```bash
viben queue list                      # Default shows pending + running
viben queue list --status completed   # Only completed tasks
viben queue list --all --limit 100    # All statuses, max 100 entries
```

**Output**:

```
ID           STATUS    COMMAND                CREATED       ELAPSED   RETRIES
─────────────────────────────────────────────────────────────────────────────
q_abc123     running   sleep 60               2m ago        2m 15s    0/3
q_def456     running   claude -p "hello"      1m ago        45s       0/3
q_ghi789     pending   npm test               30s ago       -         0/3
q_jkl012     pending   make build             10s ago       -         0/3

Showing 4 of 4 tasks
```

## Task Operations

### Submit Command

```bash
viben queue enqueue --command <cmd> --cwd <path> [options]
viben queue enqueue --stdin --cwd <path> [options]
```

**Options**:

| Option | Description |
|--------|-------------|
| `--command`, `-c` | Bash command to execute |
| `--cwd` | Working directory |
| `--stdin` | Read command from stdin |
| `--metadata` | Metadata in JSON format |
| `--max-retries` | Maximum retry count, default 3 |
| `--json` | JSON format output |

**Examples**:

```bash
# Specify command directly
viben queue enqueue --command "sleep 60" --cwd /tmp

# Execute Claude Code
viben queue enqueue --command 'claude -p "Implement user login"' --cwd /path/to/project

# With metadata
viben queue enqueue --command "npm test" --cwd /app --metadata '{"task_dir":".viben/tasks/my-task"}'

# Read from stdin
echo 'npm run build && npm test' | viben queue enqueue --stdin --cwd /app
```

**Output**:

```
Task enqueued successfully
  ID:        q_abc123
  Position:  4 (3 pending ahead)
  Status:    pending

Use 'viben queue inspect q_abc123' to view details
Use 'viben queue logs q_abc123 --follow' to stream output
```

### Cancel Task

```bash
viben queue cancel <id> [--force] [--json]
```

**Options**:

| Option | Description |
|--------|-------------|
| `--force`, `-f` | Force terminate running task (sends SIGTERM) |
| `--json` | JSON format output |

**Examples**:

```bash
viben queue cancel q_abc123           # Cancel pending task
viben queue cancel q_abc123 --force   # Force terminate running task
```

### View Task Details

```bash
viben queue inspect <id> [--json]
```

**Output**:

```
Task: q_abc123
────────────────────────────────────────
Status:      running
Command:     claude -p "Implement user login"
CWD:         /path/to/project

Timeline:
  Created:   2024-03-03 14:30:00 (2m 15s ago)
  Started:   2024-03-03 14:30:05 (2m 10s ago)
  Elapsed:   2m 10s

Execution:
  PID:       12345
  Log:       ~/.viben/queue/logs/q_abc123.log
  Retries:   0 / 3

Metadata:
  task_dir: .viben/tasks/03-14-user-login
```

### Retry Task

```bash
viben queue retry <id> [--reset-count] [--json]
```

**Options**:

| Option | Description |
|--------|-------------|
| `--reset-count` | Reset retry counter to 0 |
| `--json` | JSON format output |

**Examples**:

```bash
viben queue retry q_abc123                # Retry, keep count
viben queue retry q_abc123 --reset-count  # Retry, reset counter
```

## Logs and Monitoring

### View Logs

```bash
viben queue logs <id> [--follow] [--tail <n>] [--timestamps] [--json]
```

**Options**:

| Option | Description |
|--------|-------------|
| `--follow`, `-f` | Follow output in real-time |
| `--tail`, `-n` | Show last N lines, default all |
| `--timestamps` | Show timestamps |
| `--json` | JSON format output |

**Examples**:

```bash
viben queue logs q_abc123              # View full logs
viben queue logs q_abc123 --tail 50    # Last 50 lines
viben queue logs q_abc123 --follow     # Follow in real-time
```

### Real-time Monitoring

```bash
viben queue watch [--task <id>...] [--events <type>...] [--json]
```

**Options**:

| Option | Description |
|--------|-------------|
| `--task`, `-t` | Monitor only specified tasks (can be specified multiple times) |
| `--events`, `-e` | Show only specified event types |
| `--json` | JSON format output |

**Event Types**:

| Event | Description |
|-------|-------------|
| `task:enqueued` | Task enqueued |
| `task:started` | Task started execution |
| `task:completed` | Task completed |
| `task:failed` | Task failed |
| `queue:status_changed` | Queue status changed |

**Examples**:

```bash
viben queue watch                                      # Monitor all events
viben queue watch --task q_abc123                      # Monitor specific task only
viben queue watch --events task:failed,task:completed  # Only show completed and failed
```

## Configuration Management

### View/Modify Configuration

```bash
viben queue config [--json]                              # View configuration
viben queue config --set <key>=<value> [--set ...]       # Modify configuration
viben queue config --reset                               # Reset to defaults
```

**Configurable Items**:

| Config Item | Type | Default | Description |
|-------------|------|---------|-------------|
| `max_concurrency` | int | 3 | Maximum concurrent tasks |
| `promoter_interval_ms` | int | 5000 | Promoter check interval |
| `monitor_interval_ms` | int | 30000 | Monitor check interval |
| `default_max_retries` | int | 3 | Default maximum retry count |
| `log_retention_days` | int | 7 | Log retention days |
| `completed_retention_days` | int | 30 | Completed record retention days |

**Examples**:

```bash
viben queue config                           # View current configuration
viben queue config --set max_concurrency=5   # Modify concurrency
viben queue config --reset                   # Reset configuration
```

## Cleanup Commands

### Clean Tasks

```bash
viben queue clean [--status <status>] [--before <time>] [--keep <n>] [--dry-run] [--force] [--json]
```

**Options**:

| Option | Description |
|--------|-------------|
| `--status`, `-s` | Clean tasks with specified status, default completed |
| `--before`, `-b` | Only clean tasks before specified time |
| `--keep`, `-k` | Keep most recent N tasks |
| `--dry-run` | Preview tasks to be cleaned without executing |
| `--force`, `-f` | Skip confirmation prompt |
| `--json` | JSON format output |

**Time Format**: `1h`, `2d`, `1w` (hours/days/weeks) or `2024-03-01`

**Examples**:

```bash
viben queue clean                            # Clean all completed
viben queue clean --before 1d                # Clean tasks older than 1 day
viben queue clean --keep 10                  # Keep most recent 10
viben queue clean --dry-run                  # Preview, don't execute
```

## Task Status

| Status | Description |
|--------|-------------|
| pending | Enqueued, waiting for execution |
| running | Currently executing |
| retrying | Execution failed, preparing to retry |
| completed | Execution completed successfully |
| failed | Execution failed, reached maximum retry count |

## File Persistence

Queue data is stored in `~/.viben/queue/` directory:

```
~/.viben/queue/
├── config.yaml      # Queue configuration
├── state.yaml       # Queue metadata
├── tasks/           # Task details
│   ├── task-{id}.yaml
│   └── ...
└── logs/            # Task logs
    └── {id}.log
```

## Global Options

All subcommands support the following global options:

| Option | Description |
|--------|-------------|
| `--json` | JSON format output |
| `--quiet`, `-q` | Suppress non-essential output |
| `--verbose`, `-v` | Show detailed debug information |
| `--help`, `-h` | Show help information |

**Examples**:

```bash
# Debug mode with detailed info
viben queue status --verbose

# Quiet mode for scripting
viben queue list --quiet --json

# JSON output for parsing
viben queue inspect q_abc123 --json
```

## Error Handling

All commands output detailed information on errors to help agents diagnose problems.

### Common Error Scenarios

**Task not found**:
```
Error: Task not found
  ID:      q_abc123
  Reason:  No task with this ID exists

Hint: Use 'viben queue list --all' to see all tasks
```

**Invalid operation**:
```
Error: Invalid operation
  Task:    q_abc123
  Status:  running
  Action:  cancel (without --force)

Hint: Use 'viben queue cancel q_abc123 --force' to terminate running task
```

**Retry not available**:
```
Error: Cannot retry task
  Task:    q_abc123
  Status:  running
  Reason:  Only completed (failed) tasks can be retried

Current task status:
  Status:   running
  Elapsed:  2m 15s
  PID:      12345
```

### Error Codes

| Error Code | Description | Resolution |
|------------|-------------|------------|
| `TASK_NOT_FOUND` | Task ID does not exist | Use `viben queue list --all` to verify |
| `INVALID_STATUS` | Operation not allowed for current status | Check task status first |
| `PROCESS_RUNNING` | Cannot cancel without --force | Add `--force` flag |
| `MAX_RETRIES_EXCEEDED` | Retry count exhausted | Use `--reset-count` with retry |
| `QUEUE_FULL` | Queue at maximum capacity | Wait or increase `max_concurrency` |
| `PERSISTENCE_ERROR` | Failed to read/write queue state | Check `~/.viben/queue/` permissions |

## Related Commands

- [viben task](./task) - Task management command
- [viben swarm](./swarm) - Agent swarm scheduling
