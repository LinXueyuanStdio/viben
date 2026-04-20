---
sidebar_position: 20
title: "Task + Queue Integration"
description: "Integration design between Task system and Queue system for queued task execution"
---

# Task + Queue Integration

Integration design between Task system and Queue system for queued task execution.

## Overview

The `viben task enqueue` command submits tasks to the Command Queue system, enabling:

- Queued task execution (concurrency control)
- Background execution (detached process)
- Task continuation after Gateway restart

## Architecture Design

### Core Principle

**Queue system has zero knowledge of Task system**: Queue is just a generic command executor that doesn't know about the Task system's existence.

### Data Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│  viben task enqueue <task>                                          │
│       │                                                              │
│       ├──1. Update task.json status: "queue"                         │
│       │                                                              │
│       └──2. Call queue.enqueue({                                     │
│              command: "viben task start <task>",                     │
│              cwd: repoRoot,                                          │
│              metadata: { task_dir: ".viben/tasks/xxx" }              │
│            })                                                        │
│              │                                                       │
│              └──3. Save queue_id to task.json                        │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  Queue System (Zero Knowledge)                                       │
│       │                                                              │
│       ├── Promoter: Check pending, spawn process                     │
│       │                                                              │
│       └── Execute "viben task start <task>" (as regular shell cmd)   │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  viben task start <task> (command handles status updates internally) │
│       │                                                              │
│       ├── Start: task.json status → in_progress                      │
│       │                                                              │
│       └── End: task.json status → completed/failed (by Agent)        │
└─────────────────────────────────────────────────────────────────────┘
```

### System Boundaries

```
┌─────────────────────┐      ┌─────────────────────┐
│   Task System       │ ───> │   Queue System      │
│                     │      │   (Zero Knowledge)  │
│ - task.json mgmt    │      │                     │
│ - State transitions │      │ - Command queuing   │
│ - Agent scheduling  │      │ - Process mgmt      │
│                     │      │ - Concurrency ctrl  │
│ enqueueTask()       │      │                     │
│  └─ queue.enqueue() │      │ Only executes shell │
└─────────────────────┘      └─────────────────────┘
```

## Implementation Details

### task.json New Field

```typescript
interface UnifiedTask {
  // ... existing fields

  /** Queue system task ID (when task is submitted to command queue) */
  queue_id?: string;
}
```

### enqueueTask() Function

Location: `packages/core/src/task/ops/lifecycle.ts`

```typescript
export function enqueueTask(
  repoRoot: string,
  taskName: string,
  options: {
    agent?: string;
    executor?: string;
    model?: string;
    priority?: string;
    /** Skip submitting to queue system (only update status) */
    skipQueue?: boolean;
  } = {}
): LifecycleResult {
  // 1. Validate task exists
  // 2. Validate state transition (backlog -> queue)

  // 3. Submit to queue system
  if (!options.skipQueue) {
    const command = `viben task start ${taskName}`;
    const queueResult = queueEnqueue({
      command,
      cwd: repoRoot,
      metadata: {
        task_dir: ".viben/tasks/" + taskName,
        task_name: taskName,
      },
    });

    if (!queueResult.success) {
      return { success: false, error: queueResult.error };
    }

    // Save queue_id
    additionalFields.queue_id = queueResult.id;
  }

  // 4. Update task.json
  updateTaskStatus(taskDir, "queue", additionalFields);

  return { success: true, ... };
}
```

## Usage Examples

### Basic Flow

```bash
# 1. Create task
viben task create "My feature" --slug my-feature

# 2. Submit to queue
viben task enqueue my-feature

# 3. View queue status
viben queue status
# Queue Status
# ────────────────────────────────────────
#   Pending:     1 task(s)
#   Running:     0 / 3 (max concurrency)

# 4. View queue details
viben queue list
# ID              STATUS   COMMAND                          CWD
# ────────────────────────────────────────────────────────────────
# q_7kA9OXDz71T7  pending  viben task start my-feature      /path/to/repo

# 5. View task.json
cat .viben/tasks/03-15-my-feature/task.json
# {
#   "status": "queue",
#   "queue_id": "q_7kA9OXDz71T7",
#   ...
# }
```

### Skip Queue (Direct Execution)

```bash
# Use --skip-queue option to only update status, not submit to queue
viben task enqueue my-feature --skip-queue

# Or use start command directly (bypass queue)
viben task start my-feature
```

### Cancel Queued Task

```bash
# Method 1: Cancel via task system
viben task dequeue my-feature

# Method 2: Cancel via queue system
viben queue cancel q_7kA9OXDz71T7
```

## Status Mapping

| Task Status | Queue Status | Description |
|-------------|--------------|-------------|
| `backlog` | - | Task not submitted to queue |
| `queue` | `pending` | Task waiting for execution |
| `in_progress` | `running` | Task is executing |
| `completed` | `completed` (exit 0) | Task completed successfully |
| `failed` | `completed` (exit != 0) | Task execution failed |

## Important Notes

### Queue System Independence

The Queue system should NOT:
- Read or modify task.json
- Know about Task system's state machine
- Callback to Task system after task completion

The Queue system only:
- Receives command strings
- Executes according to configured concurrency
- Records execution results and logs

### State Synchronization

Task state updates are handled internally by `viben task start` command:
- On execution start: `queue` -> `in_progress`
- On Agent completion: `in_progress` -> `completed/failed`

### Error Handling

If queue submission fails, `enqueueTask()` will:
1. Return error, do not update task.json status
2. Keep task in original state (backlog)

## Related

- [queue](./queue.md) - Queue system commands
- [task](./task.md) - Task system commands
