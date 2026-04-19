---
sidebar_position: 20
title: "Task + Queue 集成"
description: "Task 系统与 Queue 系统的集成设计，实现任务的排队执行"
---

# Task + Queue 集成

Task 系统与 Queue 系统的集成设计，实现任务的排队执行。

## 概述

`viben task enqueue` 命令将任务提交到 Command Queue 系统，实现：

- 任务排队执行（并发控制）
- 后台运行（detached process）
- Gateway 重启后任务继续运行

## 架构设计

### 核心原则

**Queue 系统对 Task 系统零知识**：Queue 只是一个通用的命令执行器，不了解 Task 系统的存在。

### 数据流

```
┌─────────────────────────────────────────────────────────────────────┐
│  viben task enqueue <task>                                          │
│       │                                                              │
│       ├──1. 更新 task.json status: "queue"                           │
│       │                                                              │
│       └──2. 调用 queue.enqueue({                                     │
│              command: "viben task start <task>",                     │
│              cwd: repoRoot,                                          │
│              metadata: { task_dir: ".viben/tasks/xxx" }              │
│            })                                                        │
│              │                                                       │
│              └──3. 保存 queue_id 到 task.json                        │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  Queue 系统（零知识）                                                 │
│       │                                                              │
│       ├── Promoter: 检查 pending，spawn 进程                         │
│       │                                                              │
│       └── 执行 "viben task start <task>"（当作普通 shell 命令）       │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  viben task start <task>（命令内部负责状态更新）                       │
│       │                                                              │
│       ├── 开始: task.json status → in_progress                       │
│       │                                                              │
│       └── 结束: task.json status → completed/failed（由 Agent 完成）  │
└─────────────────────────────────────────────────────────────────────┘
```

### 系统边界

```
┌─────────────────────┐      ┌─────────────────────┐
│   Task 系统         │ ───> │   Queue 系统        │
│                     │      │   （零知识）         │
│ - task.json 管理    │      │                     │
│ - 状态机转换        │      │ - 命令排队           │
│ - Agent 调度        │      │ - 进程管理           │
│                     │      │ - 并发控制           │
│ enqueueTask()       │      │                     │
│  └─ queue.enqueue() │      │ 只执行 shell 命令    │
└─────────────────────┘      └─────────────────────┘
```

## 实现细节

### task.json 新增字段

```typescript
interface UnifiedTask {
  // ... existing fields

  /** Queue system task ID (when task is submitted to command queue) */
  queue_id?: string;
}
```

### enqueueTask() 函数

位置: `packages/core/src/task/ops/lifecycle.ts`

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
  // 1. 验证任务存在
  // 2. 验证状态转换 (backlog -> queue)

  // 3. 提交到 queue 系统
  if (!options.skipQueue) {
    const command = `viben task start ${taskName}`;
    const queueResult = queueEnqueue({
      command,
      cwd: repoRoot,
      metadata: {
        task_dir: taskDirRel,
        task_name: taskName,
      },
    });

    if (!queueResult.success) {
      return { success: false, error: queueResult.error };
    }

    // 保存 queue_id
    additionalFields.queue_id = queueResult.id;
  }

  // 4. 更新 task.json
  updateTaskStatus(taskDir, "queue", additionalFields);

  return { success: true, ... };
}
```

## 使用示例

### 基本流程

```bash
# 1. 创建任务
viben task create "My feature" --slug my-feature

# 2. 提交到队列
viben task enqueue my-feature

# 3. 查看队列状态
viben queue status
# Queue Status
# ────────────────────────────────────────
#   Pending:     1 task(s)
#   Running:     0 / 3 (max concurrency)

# 4. 查看队列详情
viben queue list
# ID              STATUS   COMMAND                          CWD
# ────────────────────────────────────────────────────────────────
# q_7kA9OXDz71T7  pending  viben task start my-feature      /path/to/repo

# 5. 查看 task.json
cat .viben/tasks/03-15-my-feature/task.json
# {
#   "status": "queue",
#   "queue_id": "q_7kA9OXDz71T7",
#   ...
# }
```

### 跳过队列（直接执行）

```bash
# 使用 --skip-queue 选项只更新状态，不提交到队列
viben task enqueue my-feature --skip-queue

# 或直接使用 start 命令（不经过队列）
viben task start my-feature
```

### 取消排队任务

```bash
# 方式 1: 通过 task 系统取消
viben task dequeue my-feature

# 方式 2: 通过 queue 系统取消
viben queue cancel q_7kA9OXDz71T7
```

## 状态映射

| Task 状态 | Queue 状态 | 说明 |
|-----------|------------|------|
| `backlog` | - | 任务未提交到队列 |
| `queue` | `pending` | 任务等待执行 |
| `in_progress` | `running` | 任务正在执行 |
| `completed` | `completed` (exit 0) | 任务成功完成 |
| `failed` | `completed` (exit != 0) | 任务执行失败 |

## 注意事项

### Queue 系统的独立性

Queue 系统不应该：
- 读取或修改 task.json
- 了解 Task 系统的状态机
- 在任务完成后回调 Task 系统

Queue 系统只负责：
- 接收命令字符串
- 按配置的并发数执行
- 记录执行结果和日志

### 状态同步

Task 状态的更新由 `viben task start` 命令内部完成：
- 开始执行时：`queue` → `in_progress`
- Agent 完成时：`in_progress` → `completed/failed`

### 错误处理

如果 queue 提交失败，`enqueueTask()` 会：
1. 返回错误，不更新 task.json 状态
2. 保持任务在原状态（backlog）

## 相关命令

- [queue](./queue.md) - Queue 系统命令
- [task](./task.md) - Task 系统命令
