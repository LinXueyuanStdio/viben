# Queue Auto-Promotion

> 任务从 "queue" 状态自动晋升到 "in_progress" 状态的功能规范

## 概述

Queue Auto-Promotion 功能实现了看板任务的自动晋升机制。当 `in_progress` 状态的任务完成或移动到其他状态时，系统会自动检查 `queue` 中是否有等待的任务，并根据并行任务限制（`maxParallelTasks`）自动晋升。

**参考实现**: Auto-Claude `KanbanBoard.tsx` processQueue 模式

## 设计目标

1. **减少人工干预** - 自动管理任务晋升，无需手动拖拽
2. **FIFO 公平性** - 先进先出，按创建时间排序
3. **容量控制** - 尊重并行任务限制设置
4. **性能优化** - 监听器存储在 store 外部，避免触发重新渲染

## 架构设计

### 数据流

```
┌─────────────────────────────────────────────────────────────────┐
│                    Queue Auto-Promotion Flow                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Task leaves in_progress ──► Listener triggered                 │
│                                    │                            │
│                                    ▼                            │
│                            processQueue()                       │
│                                    │                            │
│                                    ▼                            │
│                   ┌────────────────────────────────┐            │
│                   │ Check capacity:                │            │
│                   │ in_progress < maxParallelTasks │            │
│                   └────────────────────────────────┘            │
│                                    │                            │
│                          Yes ◄────┴────► No (stop)              │
│                           │                                     │
│                           ▼                                     │
│                   Get oldest queue task                         │
│                   (FIFO by created_at)                          │
│                           │                                     │
│                           ▼                                     │
│                   Promote to in_progress                        │
│                           │                                     │
│                           ▼                                     │
│                   Loop until capacity full                      │
│                   or no more queue tasks                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 组件结构

```
apps/desktop/src/
├── hooks/
│   └── use-queue-auto-promotion.ts  # 核心 Hook
├── stores/
│   └── kanban-queue-store.ts        # maxParallelTasks 设置
└── pages/
    └── workspace-kanban.tsx         # Hook 使用位置
```

## API 设计

### useQueueAutoPromotion Hook

```typescript
interface UseQueueAutoPromotionOptions {
  /** 当前任务数组 */
  tasks: TaskWithAttemptStatus[];
  /** 晋升任务的回调（更新状态为 in_progress） */
  onPromoteTask: (taskId: string) => Promise<void>;
  /** 是否启用自动晋升 */
  enabled?: boolean;
}

function useQueueAutoPromotion(options: UseQueueAutoPromotionOptions): {
  processQueue: () => Promise<void>;
  isProcessing: boolean;
};
```

### 状态变化监听器

```typescript
type TaskStatusChangeListener = (
  taskId: string,
  oldStatus: TaskStatus | undefined,
  newStatus: TaskStatus
) => void;

// 注册监听器
function registerTaskStatusChangeListener(
  listener: TaskStatusChangeListener
): () => void;

// 通知监听器
function notifyTaskStatusChange(
  taskId: string,
  oldStatus: TaskStatus | undefined,
  newStatus: TaskStatus
): void;
```

## 实现细节

### 1. 监听器模式

监听器存储在 store 外部，避免触发 React 重新渲染：

```typescript
// 存储在模块顶层，不在 store 内
const taskStatusChangeListeners = new Set<TaskStatusChangeListener>();
```

### 2. processQueue 函数

核心晋升逻辑：

```typescript
const processQueue = useCallback(async () => {
  if (!enabled) return;

  // 防止并发执行
  if (isProcessingQueueRef.current) return;
  isProcessingQueueRef.current = true;

  try {
    const attemptedTaskIds = new Set<string>();
    let consecutiveFailures = 0;
    const MAX_CONSECUTIVE_FAILURES = 10;

    while (true) {
      // 过滤已归档任务
      const activeTasks = tasks.filter(t => !archivedTaskIds.includes(t.id));

      // 计算当前 in_progress 数量
      const inProgressCount = activeTasks.filter(
        t => t.status === "in_progress"
      ).length;

      // 获取未尝试过的 queue 任务
      const queuedTasks = activeTasks.filter(
        t => t.status === "queue" && !attemptedTaskIds.has(t.id)
      );

      // 停止条件
      if (inProgressCount >= maxParallelTasks) break;
      if (queuedTasks.length === 0) break;
      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) break;

      // FIFO 排序 - 按 created_at 升序
      const sortedQueuedTasks = [...queuedTasks].sort((a, b) => {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });

      const nextTask = sortedQueuedTasks[0];
      attemptedTaskIds.add(nextTask.id);

      try {
        await onPromoteTask(nextTask.id);
        consecutiveFailures = 0;
      } catch (error) {
        consecutiveFailures++;
      }
    }
  } finally {
    isProcessingQueueRef.current = false;
  }
}, [enabled, tasks, maxParallelTasks, archivedTaskIds, onPromoteTask]);
```

### 3. 触发时机

1. **任务离开 in_progress 时**：

```typescript
useEffect(() => {
  const unregister = registerTaskStatusChangeListener(
    (taskId, oldStatus, newStatus) => {
      if (oldStatus === "in_progress" && newStatus !== "in_progress") {
        processQueue();
      }
    }
  );
  return unregister;
}, [processQueue]);
```

2. **页面加载时**（初始检查）：

```typescript
useEffect(() => {
  const timer = setTimeout(() => {
    processQueue();
  }, 1000);
  return () => clearTimeout(timer);
}, [processQueue]);
```

### 4. 状态变化检测

使用 ref 跟踪上一次状态，比较检测变化：

```typescript
const previousStatusMapRef = useRef<Map<string, TaskStatus>>(new Map());

useEffect(() => {
  const currentStatusMap = new Map<string, TaskStatus>();
  for (const task of tasks) {
    currentStatusMap.set(task.id, task.status);
  }

  // 检测状态变化
  for (const task of tasks) {
    const oldStatus = previousStatusMapRef.current.get(task.id);
    const newStatus = task.status;

    if (oldStatus !== undefined && oldStatus !== newStatus) {
      notifyTaskStatusChange(task.id, oldStatus, newStatus);
    }
  }

  previousStatusMapRef.current = currentStatusMap;
}, [tasks]);
```

## 使用示例

在 `workspace-kanban.tsx` 中：

```typescript
// 定义晋升回调
const handlePromoteTask = useCallback(
  async (taskId: string) => {
    if (!workspace) return;
    await updateTaskStatus.mutateAsync({
      taskId,
      status: "in_progress",
      workspacePath: workspace.path,
    });
  },
  [workspace, updateTaskStatus]
);

// 使用 Hook
useQueueAutoPromotion({
  tasks: tasks ?? [],
  onPromoteTask: handlePromoteTask,
  enabled: !!workspace,
});
```

## 配置

### maxParallelTasks

通过 `kanban-queue-store.ts` 管理：

| 设置 | 默认值 | 范围 |
|------|--------|------|
| maxParallelTasks | 3 | 1-10 |

用户可通过看板设置界面调整此值。

## 调试日志

Hook 输出以下日志便于调试：

```
[QueueAutoPromotion] Task {id} left in_progress ({old} -> {new}), processing queue
[QueueAutoPromotion] Promoting task {id} ({title}) from queue to in_progress
[QueueAutoPromotion] At capacity ({n}/{max}), stopping
[QueueAutoPromotion] No queued tasks, stopping
[QueueAutoPromotion] Max consecutive failures (10) reached, stopping
[QueueAutoPromotion] Initial queue check on mount
[QueueAutoPromotion] Already processing queue, skipping
```

## 边界情况处理

1. **并发执行保护** - 使用 `isProcessingQueueRef` 防止重复执行
2. **连续失败保护** - 最多连续失败 10 次后停止
3. **已尝试任务跟踪** - 避免重复尝试同一任务
4. **归档任务过滤** - 不晋升已归档的任务
5. **组件卸载** - 清理定时器和监听器

## 与 Auto-Claude 的差异

| 特性 | Auto-Claude | Viben |
|------|-------------|-------|
| 监听器注册 | 在 store 中 | 独立模块 |
| 状态检测 | 通过 store 通知 | 比较前后状态 Map |
| 初始检查延迟 | 无 | 1000ms |
| 日志前缀 | `[Queue]` | `[QueueAutoPromotion]` |

## 未来改进

1. **优先级排序** - 支持按优先级而非仅按时间排序
2. **批量晋升** - 一次性晋升多个任务减少 API 调用
3. **可配置延迟** - 允许用户配置初始检查延迟
4. **晋升通知** - Toast 通知用户任务已自动晋升

## 相关文档

- [Kanban Integration](./kanban-integration.md) - 看板整体架构
- [Kanban Features](./kanban-features.md) - 看板核心功能
- [Task State Machine](../../backend/patterns/task-state-machine.md) - 任务状态机
