# 工作空间任务看板优化设计

> 参考 Auto-Claude 实现全功能对齐

## 概述

将 viben 的任务看板升级为与 Auto-Claude 功能对齐的版本，包括 6 列工作流、队列自动化、丰富元数据、执行进度追踪、批量操作、卡住任务恢复等功能。

## 1. 数据模型变更

扩展 Task 数据结构以支持新功能：

```typescript
interface Task {
  // 现有字段保留
  id: string;
  title: string;
  description?: string;
  priority?: "urgent" | "high" | "medium" | "low" | "none";
  tags?: Tag[];

  // 新增: 6 列状态
  status: "backlog" | "queued" | "in_progress" | "ai_review" | "review" | "done" | "cancelled";

  // 新增: 增强元数据
  category?: "feature" | "bug_fix" | "refactoring" | "documentation" | "security" | "performance" | "ui_ux" | "infrastructure" | "testing";
  complexity?: "trivial" | "small" | "medium" | "large" | "complex";
  impact?: "low" | "medium" | "high" | "critical";

  // 新增: 执行追踪
  execution_phase?: "plan" | "implement" | "check" | "fix" | "complete";
  phase_progress?: number; // 0-100
  subtasks?: Subtask[];

  // 新增: 队列与恢复
  queue_position?: number;
  stuck_at?: string;
  stuck_reason?: "timeout" | "error" | "unresponsive";
  review_reason?: "completed" | "errors" | "qa_rejected" | "plan_review" | "stopped";
  recovery_attempts?: number;

  // 新增: 排序
  column_order?: number;
}

interface Subtask {
  id: string;
  title: string;
  status: "pending" | "in_progress" | "completed" | "failed";
}
```

**迁移策略**: 新字段均为可选。现有任务的 `status: "todo"` 映射为 `status: "backlog"`。

## 2. 列管理系统

### 2.1 列配置存储

```typescript
// stores/kanban-settings-store.ts
interface ColumnSettings {
  width: number;
  minWidth: number;
  maxWidth: number;
  collapsed: boolean;
  locked: boolean;
}

interface KanbanSettingsState {
  columns: Record<string, ColumnSettings>;

  setColumnWidth: (columnId: string, width: number) => void;
  toggleCollapsed: (columnId: string) => void;
  toggleLocked: (columnId: string) => void;
  resetToDefaults: () => void;
}

const DEFAULT_COLUMNS = {
  backlog:      { width: 300, minWidth: 250, maxWidth: 450, collapsed: false, locked: false },
  queued:       { width: 300, minWidth: 250, maxWidth: 450, collapsed: false, locked: false },
  in_progress:  { width: 320, minWidth: 280, maxWidth: 500, collapsed: false, locked: false },
  ai_review:    { width: 300, minWidth: 250, maxWidth: 450, collapsed: false, locked: false },
  review: { width: 300, minWidth: 250, maxWidth: 450, collapsed: false, locked: false },
  done:         { width: 280, minWidth: 220, maxWidth: 400, collapsed: false, locked: false },
};
```

存储: `localStorage` 按 `kanban-settings-${workspacePath}` 键存储。

### 2.2 列头控件

| 列 | "+" 按钮 | 设置 | 特殊控件 |
|----|----------|------|----------|
| Backlog | ✅ | ❌ | "Queue All" 按钮 |
| Queue | ❌ | ✅ | 设置: 最大并行任务数 |
| In Progress | ❌ | ❌ | 容量指示器 (如 "3/5") |
| AI Review | ❌ | ❌ | — |
| Human Review | ❌ | ❌ | — |
| Done | ❌ | ❌ | "Archive All", "显示/隐藏已归档" |

**所有列共有:**
- 锁定/解锁按钮
- 折叠/展开按钮
- 全选复选框
- 任务计数徽章
- 调整大小手柄

## 3. 队列自动化系统

### 3.1 核心逻辑

```typescript
const STUCK_ACTIVITY_THRESHOLD_MS = 60_000; // 60 秒
const DEFAULT_MAX_PARALLEL_TASKS = 3;
const MAX_CONSECUTIVE_FAILURES = 10;

// 活动追踪 (存储外部以避免重渲染)
const taskLastActivity = new Map<string, number>();

export function recordTaskActivity(taskId: string): void {
  taskLastActivity.set(taskId, Date.now());
}

export function hasRecentActivity(taskId: string): boolean {
  const lastActivity = taskLastActivity.get(taskId);
  if (!lastActivity) return false;
  return Date.now() - lastActivity < STUCK_ACTIVITY_THRESHOLD_MS;
}

// 队列处理 (带竞态条件防护)
const processQueue = async () => {
  if (isProcessingQueueRef.current) return;
  isProcessingQueueRef.current = true;

  try {
    const attemptedTaskIds = new Set<string>();
    let consecutiveFailures = 0;

    while (consecutiveFailures < MAX_CONSECUTIVE_FAILURES) {
      const { tasks } = useTaskStore.getState();
      const inProgressCount = tasks.filter(t => t.status === 'in_progress').length;
      const queuedTasks = tasks
        .filter(t => t.status === 'queued' && !attemptedTaskIds.has(t.id))
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

      if (inProgressCount >= maxParallelTasks || queuedTasks.length === 0) break;

      const nextTask = queuedTasks[0];
      const result = await updateTaskStatus(nextTask.id, 'in_progress');

      if (!result.success) {
        attemptedTaskIds.add(nextTask.id);
        consecutiveFailures++;
      } else {
        consecutiveFailures = 0;
        startTaskExecution(nextTask.id);
      }
    }
  } finally {
    isProcessingQueueRef.current = false;
  }
};
```

### 3.2 触发机制

```typescript
// 状态变化监听器
registerTaskStatusChangeListener((taskId, oldStatus, newStatus) => {
  if (oldStatus === 'in_progress' && newStatus !== 'in_progress') {
    processQueue(); // 填充空出的槽位
  }
});
```

### 3.3 队列设置

```typescript
interface QueueSettings {
  maxParallelTasks: number;  // 默认: 3
  autoPromote: boolean;      // 默认: true
}
```

## 4. 执行阶段追踪

### 4.1 阶段定义

```typescript
type ExecutionPhase = 'plan' | 'implement' | 'check' | 'fix' | 'complete';

interface ExecutionProgress {
  phase: ExecutionPhase;
  progress: number;
  subtasks: Subtask[];
  startedAt: string;
  lastActivityAt: string;
}

const PHASE_COLORS: Record<ExecutionPhase, string> = {
  plan:      'bg-blue-500',
  implement: 'bg-yellow-500',
  check:     'bg-purple-500',
  fix:       'bg-cyan-500',
  complete:  'bg-green-500',
};
```

### 4.2 进度指示器组件

```typescript
function PhaseProgressIndicator({ task }: { task: Task }) {
  const { phase, progress } = task.execution_progress ?? {};
  if (!phase) return null;

  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
        <div
          className={cn("h-full transition-all", PHASE_COLORS[phase])}
          style={{ width: `${progress}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground capitalize">{phase}</span>
    </div>
  );
}
```

## 5. 批量操作

### 5.1 选择状态管理

```typescript
interface KanbanSelectionState {
  selectedTaskIds: Set<string>;
  selectionMode: boolean;

  toggleTaskSelection: (taskId: string) => void;
  selectAll: (columnStatus: string) => void;
  clearSelection: () => void;
  setSelectionMode: (enabled: boolean) => void;
}
```

### 5.2 批量操作

```typescript
interface BulkActions {
  bulkUpdateStatus: (taskIds: string[], status: TaskStatus) => Promise<void>;
  bulkDelete: (taskIds: string[]) => Promise<void>;
  bulkArchive: (taskIds: string[]) => Promise<void>;
  bulkCreatePR: (taskIds: string[]) => Promise<void>;
  bulkQueueAll: (taskIds: string[]) => Promise<void>;
}
```

### 5.3 操作栏组件

```typescript
function BulkActionBar({ selectedIds }: { selectedIds: string[] }) {
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-background border rounded-lg shadow-lg p-2 flex gap-2">
      <span className="text-sm text-muted-foreground px-2">
        {selectedIds.length} 已选择
      </span>
      <Button size="sm" variant="outline" onClick={() => bulkUpdateStatus(selectedIds, 'queued')}>
        <ListPlus className="h-4 w-4 mr-1" /> 加入队列
      </Button>
      <Button size="sm" variant="outline" onClick={() => bulkArchive(selectedIds)}>
        <Archive className="h-4 w-4 mr-1" /> 归档
      </Button>
      <Button size="sm" variant="outline" onClick={() => bulkCreatePR(selectedIds)}>
        <GitPullRequest className="h-4 w-4 mr-1" /> 创建 PR
      </Button>
      <Button size="sm" variant="destructive" onClick={() => bulkDelete(selectedIds)}>
        <Trash className="h-4 w-4 mr-1" /> 删除
      </Button>
      <Button size="sm" variant="ghost" onClick={clearSelection}>
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
```

## 6. 卡住任务恢复

### 6.1 检测与状态

```typescript
type ReviewReason = 'completed' | 'errors' | 'qa_rejected' | 'plan_review' | 'stopped' | 'timeout';

interface StuckTaskInfo {
  stuck_at: string;
  stuck_reason: 'timeout' | 'error' | 'unresponsive';
  recovery_attempts: number;
}
```

### 6.2 恢复逻辑

```typescript
interface RecoveryOptions {
  targetStatus?: TaskStatus;
  autoRestart?: boolean;
}

async function recoverStuckTask(
  taskId: string,
  options: RecoveryOptions = { autoRestart: true }
): Promise<{ success: boolean; message: string }> {
  const task = getTask(taskId);

  await updateTask(taskId, {
    stuck_at: null,
    stuck_reason: null,
    recovery_attempts: (task.recovery_attempts ?? 0) + 1,
  });

  if (options.targetStatus) {
    await updateTaskStatus(taskId, options.targetStatus);
  } else if (options.autoRestart) {
    await updateTaskStatus(taskId, 'queued');
  }

  return { success: true, message: '任务已恢复' };
}
```

### 6.3 恢复操作

| 操作 | 说明 |
|------|------|
| 重试 | 重置到队列，自动提升后重新执行 |
| 移至 Backlog | 退回 Backlog 等待手动处理 |
| 移至 Review | 移至人工审核列 |
| 取消 | 标记为已取消 |

## 7. UI 优化

### 7.1 性能优化

```typescript
// 带自定义比较器的 React.memo
const TaskCard = React.memo(function TaskCard({ task, ...props }) {
  // ...
}, (prevProps, nextProps) => {
  return (
    prevProps.task.id === nextProps.task.id &&
    prevProps.task.title === nextProps.task.title &&
    prevProps.task.status === nextProps.task.status &&
    prevProps.task.priority === nextProps.task.priority &&
    prevProps.task.execution_progress?.phase === nextProps.task.execution_progress?.phase &&
    prevProps.task.stuck_at === nextProps.task.stuck_at &&
    prevProps.isSelected === nextProps.isSelected
  );
});

// 防抖保存
const debouncedSaveSettings = useMemo(
  () => debounce((settings) => saveToLocalStorage(settings), 500),
  []
);
```

### 7.2 拖拽预览

```typescript
<DragOverlay>
  {activeTask && (
    <div className="opacity-80 rotate-3 shadow-xl">
      <TaskCard task={activeTask} isDragging />
    </div>
  )}
</DragOverlay>
```

### 7.3 空状态提示

| 列 | 空状态消息 |
|----|-----------|
| Backlog | "暂无任务。点击 + 创建新任务。" |
| Queue | "队列为空。从 Backlog 移动任务。" |
| In Progress | "无活动任务。队列将自动提升。" |
| AI Review | "无任务等待 AI 审核。" |
| Human Review | "无任务需要人工审核。" |
| Done | "已完成的任务将显示在此。" |

### 7.4 键盘快捷键

| 快捷键 | 操作 |
|--------|------|
| `↑/↓` | 导航任务 |
| `←/→` | 导航列 |
| `Enter` | 打开任务详情 |
| `Space` | 切换选择 |
| `Cmd+A` | 全选当前列 |
| `Escape` | 清除选择 / 关闭面板 |
| `Delete` | 删除已选 (需确认) |
| `Q` | 将已选任务加入队列 |

## 8. 文件变更清单

### 新增文件

```
apps/desktop/src/
├── stores/
│   ├── kanban-settings-store.ts    # 列配置存储
│   ├── kanban-selection-store.ts   # 多选状态
│   └── task-queue-store.ts         # 队列自动化
├── components/workspace/kanban/
│   ├── kanban-column.tsx           # 单列组件
│   ├── bulk-action-bar.tsx         # 浮动操作栏
│   ├── queue-settings-modal.tsx    # 队列配置弹窗
│   └── phase-progress-indicator.tsx # 执行进度
```

### 修改文件

```
apps/desktop/src/
├── components/workspace/kanban/
│   ├── kanban-board.tsx            # 6 列布局，新头部控件
│   └── task-card.tsx               # 阶段指示器，卡住徽章
├── hooks/
│   └── use-vibe-kanban.ts          # 新状态类型，批量 API

packages/core/src/
├── db/models/task.ts               # 扩展任务 schema
└── gateway/routes/tasks.ts         # 批量端点，阶段更新
```

## 9. 迁移计划

1. **Phase 1**: 数据模型扩展 (向后兼容)
2. **Phase 2**: 6 列布局 + 列管理
3. **Phase 3**: 队列自动化
4. **Phase 4**: 执行阶段追踪
5. **Phase 5**: 批量操作
6. **Phase 6**: 卡住任务恢复
7. **Phase 7**: UI 优化与键盘快捷键
