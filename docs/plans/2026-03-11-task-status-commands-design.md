# Task Status Commands Design

> 扩展 `viben task` 命令以支持完整的任务状态生命周期管理

## 背景

根据 `docs/specs/modules/task-system.md` 定义的任务状态机，需要补充以下状态转换的 CLI 命令：

- `backlog` ↔ `queue` (入队/出队)
- `in_progress` ↔ `paused` (暂停/恢复)
- `human_review` → `completed` / `backlog` (批准/拒绝)
- `failed` → `queue` (重试)

## 设计原则

1. **统一使用 task_dir** - 所有命令以任务目录名作为标识
2. **显式参数** - `viben task <command> <task>` 必须指定任务
3. **本地优先** - 直接操作 task.json 和 events.jsonl，不依赖 Gateway
4. **原子命令** - 每个命令负责单一状态转换

## 命令概览

```
viben task <command> <task>

状态转换命令:
  enqueue <task>     backlog → queue        入队等待执行
  dequeue <task>     queue → backlog        移出队列
  pause <task>       in_progress → paused   暂停执行
  resume <task>      paused → 恢复          恢复执行
  review <task>      展示审查信息            查看待审任务
  approve <task>     human_review → completed   批准完成
  reject <task>      human_review → backlog     拒绝返工
  retry <task>       failed → queue         重试失败任务
```

### 与现有命令的关系

| 现有命令 | 用途 | 保持不变 |
|---------|------|---------|
| `start <task>` | 启动任务执行（串行或并行模式） | ✓ |
| `finish <task>` | 标记任务完成 | ✓ |
| `create-pr [task]` | 创建 PR 并进入 human_review | ✓ |
| `archive <task>` | 归档到 archive/ 目录 | ✓ |

## 命令详细规格

### enqueue

入队任务，从 backlog 进入 queue 状态。

```bash
viben task enqueue <task> [options]

Options:
  --agent <id>       执行智能体 ID
  --executor <type>  执行器类型 (CLAUDE_CODE, CURSOR, OPENCODE, etc.)
  --model <id>       模型 ID
  --priority <p>     优先级 (P0/P1/P2/P3)
```

**行为:**

1. 验证 task 状态为 `backlog`
2. 设置 `agent/executor/model`（如指定，入队后锁定）
3. 设置 `queuedAt` 时间戳（用于 FIFO 排序）
4. 状态变更: `backlog` → `queue`
5. 写入 `QUEUE` 事件到 `events.jsonl`

**示例:**

```bash
# 基本入队
viben task enqueue 03-10-feature-xyz

# 指定执行配置
viben task enqueue 03-10-feature-xyz --agent my-agent --executor CLAUDE_CODE --model claude-sonnet-4-20250514
```

### dequeue

移出队列，从 queue 返回 backlog 状态。

```bash
viben task dequeue <task>
```

**行为:**

1. 验证状态为 `queue`
2. 清除 `queuedAt`
3. 状态变更: `queue` → `backlog`
4. 写入 `DEQUEUE` 事件

### pause

暂停执行中的任务。

```bash
viben task pause <task>
```

**行为:**

1. 验证状态为 `in_progress` 或 `queue`
2. 保存 `pausedSnapshot`:
   ```json
   {
     "fromState": "in_progress",
     "subtaskIndex": 2,
     "pausedAt": "2026-03-11T10:00:00Z"
   }
   ```
3. 状态变更: `in_progress/queue` → `paused`
4. 写入 `PAUSE` 事件

### resume

恢复暂停的任务。

```bash
viben task resume <task>
```

**行为:**

1. 验证状态为 `paused`
2. 读取 `pausedSnapshot.fromState`
3. 恢复到暂停前状态
4. 清除 `pausedSnapshot`
5. 写入 `RESUME` 事件

### review

查看待审查任务的详细信息。

```bash
viben task review <task>
```

**输出:**

```
=== Task Review: 03-10-feature-xyz ===

Title:    实现用户认证功能
Status:   human_review
Priority: P1

PR URL:   https://github.com/org/repo/pull/123
Branch:   feature/03-10-feature-xyz

Files Changed: 12
+425 -89

Next steps:
  viben task approve 03-10-feature-xyz   # 批准完成
  viben task reject 03-10-feature-xyz    # 拒绝返工
```

**行为:**

1. 读取 task.json
2. 如有 pr_url，获取 PR 统计信息（通过 gh CLI）
3. 展示任务详情和下一步操作提示

### approve

批准任务完成。

```bash
viben task approve <task>
```

**行为:**

1. 验证状态为 `human_review`
2. 设置 `completedAt` 为当前时间
3. 状态变更: `human_review` → `completed`
4. 写入 `APPROVED` 事件

### reject

拒绝任务，返回待办。

```bash
viben task reject <task> [options]

Options:
  --reason <text>    拒绝原因
```

**行为:**

1. 验证状态为 `human_review`
2. 清除 `pr_url`（PR 可能需要关闭或重新提交）
3. 记录 `reviewReason: "rejected"` 和 `rejectReason`（如指定）
4. 状态变更: `human_review` → `backlog`
5. 写入 `REJECTED` 事件

### retry

重试失败的任务。

```bash
viben task retry <task>
```

**行为:**

1. 验证状态为 `failed`
2. 清除错误相关字段
3. 重新设置 `queuedAt`
4. 状态变更: `failed` → `queue`
5. 写入 `RETRY` 事件

## 状态转换验证

合法的状态转换:

| 命令 | 允许的起始状态 | 目标状态 |
|------|--------------|---------|
| enqueue | backlog | queue |
| dequeue | queue | backlog |
| pause | queue, in_progress | paused |
| resume | paused | queue 或 in_progress |
| approve | human_review | completed |
| reject | human_review | backlog |
| retry | failed | queue |

非法转换应返回错误，如:

```
Error: Cannot enqueue task in 'in_progress' status. Expected: backlog
```

## 实现位置

### 命令实现

```
packages/core/src/cli/commands/task.ts

新增命令:
  - enqueue    ~80 行
  - dequeue    ~40 行
  - pause      ~50 行
  - resume     ~60 行
  - review     ~70 行
  - approve    ~50 行
  - reject     ~55 行
  - retry      ~45 行
```

### 工具函数

```typescript
// packages/core/src/cli/lib/viben-workspace.ts 新增:

/**
 * 统一的状态更新函数
 */
export function updateTaskStatus(
  taskDir: string,
  newStatus: TaskStatus,
  additionalFields?: Record<string, unknown>
): boolean;

/**
 * 追加事件到 events.jsonl
 */
export function appendTaskEvent(
  taskDir: string,
  eventType: TaskEventType,
  payload?: Record<string, unknown>
): boolean;

/**
 * 验证状态转换合法性
 */
export function validateStatusTransition(
  currentStatus: TaskStatus,
  targetStatus: TaskStatus,
  eventType: TaskEventType
): { valid: boolean; error?: string };
```

## 与其他系统的关系

### Gateway Queue

`viben queue` 命令通过 Gateway API 操作队列，主要用于：
- 查看全局队列状态
- 远程管理任务

`viben task enqueue/dequeue` 直接操作本地文件，适用于：
- 本地开发工作流
- 无需启动 Gateway 的场景

两者状态兼容，Gateway 会读取 task.json 的状态。

### Swarm

`viben swarm start` 会将任务状态设为 `in_progress`，与 `enqueue` 命令独立：

- `enqueue` 只是入队，不启动执行
- `swarm start` 启动 worktree agent 并执行

典型工作流:
```bash
viben task create "Feature XYZ"       # → backlog
viben task enqueue 03-11-feature-xyz  # → queue (可选，手动入队)
viben swarm start 03-11-feature-xyz   # → in_progress (自动处理状态)
```

## 完整状态生命周期

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Task Status Lifecycle                                │
└─────────────────────────────────────────────────────────────────────────────┘

viben task create                        → backlog
   │
   ├── viben task enqueue                → queue
   │      │
   │      ├── viben swarm start          → in_progress
   │      │      │
   │      │      ├── viben task pause    → paused
   │      │      │      │
   │      │      │      └── viben task resume → 恢复
   │      │      │
   │      │      └── viben task create-pr → human_review
   │      │             │
   │      │             ├── viben task approve → completed
   │      │             │
   │      │             └── viben task reject  → backlog
   │      │
   │      └── viben task dequeue         → backlog
   │
   └── (CANCEL)                          → cancelled

失败处理:
   *_FAILED                              → failed
   viben task retry                      → queue

归档:
   viben swarm cleanup / viben task archive → completed (archived)
```

## 测试计划

1. **单元测试**: 状态转换验证逻辑
2. **集成测试**: 完整工作流测试
3. **边界测试**: 非法状态转换错误处理

## 参考

- [Task System Spec](../specs/modules/task-system.md)
- [Swarm Commands](../../packages/core/src/cli/commands/swarm.ts)
- [Task Commands](../../packages/core/src/cli/commands/task.ts)
