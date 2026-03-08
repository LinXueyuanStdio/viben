# Workspace Kanban 重构设计方案

**日期**: 2026-03-08
**目标**: 重构 `workspace-kanban.tsx`（2799 行 → ~250 行），提升代码可维护性和复用性

## 1. 重构目标

- **分层抽象**: 按职责拆分为多个独立组件
- **状态管理优化**: 将状态逻辑抽取为 Custom Hooks
- **配置化重构**: 命令定义数据驱动化

## 2. 技术决策

| 决策项 | 选择 |
|--------|------|
| 组件位置 | `apps/desktop/src/components/workspace/kanban/` |
| 状态管理 | Custom Hooks 拆分（按功能域） |
| 数据流 | Props 传递（细粒度组件） |
| 命令系统 | 数据驱动配置 + 依赖注入 |

## 3. 目录结构

```
apps/desktop/src/components/workspace/kanban/
├── index.ts                      # 统一导出
├── types.ts                      # 类型定义
├── constants.ts                  # 常量（颜色映射、图标映射）
├── config/
│   └── commands.ts               # Command Palette 命令配置
├── hooks/
│   ├── index.ts
│   ├── use-kanban-state.ts       # UI 状态管理
│   ├── use-task-actions.ts       # 任务 CRUD 操作
│   ├── use-drag-drop.ts          # 拖拽状态与处理
│   └── use-column-management.ts  # 列折叠/宽度/锁定
└── components/
    ├── index.ts
    ├── kanban-toolbar.tsx        # 工具栏（筛选、排序、视图切换）
    ├── kanban-board-view.tsx     # 看板视图容器
    ├── kanban-list-view.tsx      # 列表视图容器
    ├── kanban-column.tsx         # 单列（展开态）
    ├── collapsed-column.tsx      # 单列（折叠态）
    ├── column-header.tsx         # 列头部
    ├── task-card.tsx             # 任务卡片（含 stuck detection）
    ├── task-card-content.tsx     # 卡片内容
    └── task-card-menu.tsx        # 卡片操作菜单
```

## 4. 类型定义

### 核心类型 (`types.ts`)

```typescript
import type { TaskWithAttemptStatus, KanbanColumnId } from "@/lib/vibe-kanban";
import type { IssuePriority, Tag, Assignee } from "@viben/kanban";

// 增强的任务类型（UI 层）
export interface EnhancedTask extends TaskWithAttemptStatus {
  kanbanPriority?: IssuePriority;
  tags?: Tag[];
  kanbanAssignee?: Assignee;
  dueDate?: string;
}

// 任务操作接口
export interface TaskActions {
  onStart: (taskId: string) => void;
  onStop: (taskId: string) => void;
  onRecover: (taskId: string) => void;
  onResume: (taskId: string) => void;
  onArchive: (taskId: string) => void;
  onDelete: (taskId: string) => void;
  onDuplicate: (taskId: string) => void;
  onMoveToColumn: (taskId: string, columnId: KanbanColumnId) => void;
  onTitleChange: (taskId: string, title: string) => void;
  onViewPR: (prUrl: string) => void;
}

// 列配置
export interface ColumnState {
  id: KanbanColumnId;
  name: string;
  color: string;
  colorVar: string;
  tasks: EnhancedTask[];
  isCollapsed: boolean;
  isLocked: boolean;
  width: number;
}
```

## 5. Hooks 设计

### `use-kanban-state.ts` - UI 状态管理

```typescript
interface UseKanbanStateOptions {
  projectId: string;
}

interface KanbanState {
  // 选中状态
  selectedTaskId: string | null;
  setSelectedTaskId: (id: string | null) => void;

  // 视图与排序
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  sortMode: SortMode;
  sortDirection: SortDirection;
  setSorting: (mode: SortMode, direction: SortDirection) => void;

  // 筛选
  filter: KanbanFilter;
  setFilter: (filter: KanbanFilter) => void;
  clearFilter: () => void;

  // UI 开关
  showStats: boolean;
  toggleStats: () => void;

  // Dialog 状态
  dialogs: {
    createTask: { open: boolean; columnId: string };
    settings: boolean;
    queueSettings: boolean;
    commandPalette: boolean;
  };
  openCreateDialog: (columnId: string) => void;
  closeCreateDialog: () => void;
  toggleDialog: (name: 'settings' | 'queueSettings' | 'commandPalette') => void;
}

export function useKanbanState(options: UseKanbanStateOptions): KanbanState;
```

### `use-task-actions.ts` - 任务操作

```typescript
interface UseTaskActionsOptions {
  workspacePath: string | undefined;
  onSuccess?: (message: string) => void;
  onError?: (message: string) => void;
}

export function useTaskActions(options: UseTaskActionsOptions): TaskActions & {
  queueAll: (taskIds: string[]) => Promise<void>;
  archiveAll: (taskIds: string[]) => void;
  bulkStatusChange: (taskIds: string[], status: string) => void;
  bulkDelete: (taskIds: string[]) => void;
  createTask: (data: CreateTaskData) => Promise<void>;
  isCreating: boolean;
};
```

### `use-drag-drop.ts` - 拖拽逻辑

```typescript
interface UseDragDropOptions {
  tasks: EnhancedTask[];
  onMoveTask: (taskId: string, toColumn: KanbanColumnId) => void;
  onInvalidMove?: (from: string, to: string) => void;
}

interface DragDropState {
  draggingTaskId: string | null;
  validDropTargets: KanbanColumnId[];
  handleDragStart: (activeId: string) => void;
  handleDragEnd: (event: DragEndEvent) => void;
  handleDragCancel: () => void;
}

export function useDragDrop(options: UseDragDropOptions): DragDropState;
```

### `use-column-management.ts` - 列管理

```typescript
interface UseColumnManagementOptions {
  projectId: string;
  columnIds: KanbanColumnId[];
}

interface ColumnManagement {
  isCollapsed: (columnId: string) => boolean;
  toggleCollapse: (columnId: string) => void;
  expandAll: () => void;
  collapsedCount: number;
  getWidth: (columnId: string) => number;
  startResize: (columnId: string, startX: number) => void;
  isResizing: string | null;
  isLocked: (columnId: string) => boolean;
  toggleLock: (columnId: string) => void;
}

export function useColumnManagement(options: UseColumnManagementOptions): ColumnManagement;
```

## 6. 组件设计

### `task-card-content.tsx` - 卡片内容（纯展示）

```typescript
interface TaskCardContentProps {
  task: EnhancedTask;
  onTitleChange?: (title: string) => void;
  actions?: {
    onStart?: () => void;
    onStop?: () => void;
    onRecover?: () => void;
    onResume?: () => void;
    onViewPR?: () => void;
    onArchive?: () => void;
  };
}
```

### `task-card.tsx` - 卡片容器

```typescript
interface TaskCardProps {
  task: EnhancedTask;
  index: number;
  columnId: string;
  workspacePath: string;
  isSelected: boolean;
  isSelecting: boolean;
  onClick: () => void;
  onToggleSelect: (id: string) => void;
  actions: TaskActions;
  columnStatuses: Status[];
}
```

### `task-card-menu.tsx` - 卡片操作菜单

```typescript
interface TaskCardMenuProps {
  task: EnhancedTask;
  actions: TaskActions;
  columnStatuses: Status[];
  onOpenChange?: (open: boolean) => void;
}
```

### `column-header.tsx` - 列头部

```typescript
interface ColumnHeaderProps {
  column: ColumnState;
  onAddTask: () => void;
  onCollapse: () => void;
  onToggleLock: () => void;
  onQueueAll?: () => void;
  onArchiveAll?: () => void;
  onToggleArchived?: () => void;
  onOpenQueueSettings?: () => void;
  selection: {
    allSelected: boolean;
    someSelected: boolean;
    onToggle: () => void;
  };
  capacity?: { current: number; max: number };
  archivedCount?: number;
  showArchived?: boolean;
}
```

### `kanban-column.tsx` - 展开态列

```typescript
interface KanbanColumnProps {
  column: ColumnState;
  taskProps: Omit<TaskCardProps, 'task' | 'index'>;
  headerProps: Omit<ColumnHeaderProps, 'column'>;
  isDragging: boolean;
  isValidDropTarget: boolean;
  onStartResize: (startX: number) => void;
}
```

### `collapsed-column.tsx` - 折叠态列

```typescript
interface CollapsedColumnProps {
  column: Pick<ColumnState, 'id' | 'name' | 'colorVar' | 'tasks'>;
  onExpand: () => void;
}
```

### `kanban-toolbar.tsx` - 工具栏

```typescript
interface KanbanToolbarProps {
  filter: KanbanFilter;
  onFilterChange: (filter: KanbanFilter) => void;
  availableTags: Tag[];
  sortMode: SortMode;
  sortDirection: SortDirection;
  onSortChange: (mode: SortMode, direction: SortDirection) => void;
  showStats: boolean;
  onToggleStats: () => void;
  collapsedCount: number;
  onExpandAll: () => void;
  onOpenCommandPalette: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
}
```

### `kanban-board-view.tsx` - 看板视图

```typescript
interface KanbanBoardViewProps {
  columns: ColumnState[];
  taskActions: TaskActions;
  columnStatuses: Status[];
  dragDrop: DragDropState;
  columnManagement: ColumnManagement;
  selectedTaskId: string | null;
  onSelectTask: (id: string | null) => void;
  multiSelect: MultiSelectState;
  onAddTask: (columnId: string) => void;
  onQueueAll: () => void;
  onArchiveAll: () => void;
  onToggleArchived: () => void;
  onOpenQueueSettings: () => void;
  showArchived: boolean;
  archivedCount: number;
  maxParallelTasks: number | null;
  workspacePath: string;
}
```

### `kanban-list-view.tsx` - 列表视图

```typescript
interface KanbanListViewProps {
  tasks: EnhancedTask[];
  columnStatuses: Status[];
  taskActions: TaskActions;
  selectedTaskId: string | null;
  onSelectTask: (id: string) => void;
  workspacePath: string;
}
```

## 7. 命令配置 (`config/commands.ts`)

```typescript
interface CommandFactoryContext {
  t: TFunction;
  tasksByColumn: Record<string, EnhancedTask[]>;
  selectedTaskId: string | null;
  selectedTask: EnhancedTask | null;
  showStats: boolean;
  showArchived: boolean;
  viewMode: ViewMode;
}

interface CommandActions {
  setSelectedTaskId: (id: string | null) => void;
  handleAddTask: (columnId: string) => void;
  handleRefresh: () => void;
  handleQueueAll: () => void;
  handleArchiveTask: (taskId: string) => void;
  handleStartTask: (taskId: string) => void;
  handleStopTask: (taskId: string) => void;
  selectAll: () => void;
  clearSelection: () => void;
  setShowStats: (show: boolean) => void;
  setViewMode: (mode: ViewMode) => void;
  toggleShowArchived: () => void;
  setFilter: (filter: KanbanFilter) => void;
  setSorting: (mode: SortMode, direction: SortDirection) => void;
  openQueueSettings: () => void;
}

export function createCommands(
  context: CommandFactoryContext,
  actions: CommandActions
): Command[];
```

## 8. 实施计划

### Phase 1: 基础设施（types + constants + hooks）
1. 创建 `types.ts` - 类型定义
2. 创建 `constants.ts` - 颜色映射、图标映射
3. 实现 `use-kanban-state.ts`
4. 实现 `use-task-actions.ts`
5. 实现 `use-drag-drop.ts`
6. 实现 `use-column-management.ts`

### Phase 2: 卡片组件
1. 提取 `task-card-content.tsx`
2. 提取 `task-card-menu.tsx`
3. 实现 `task-card.tsx`（组合以上两者 + stuck detection）

### Phase 3: 列组件
1. 提取 `column-header.tsx`
2. 提取 `collapsed-column.tsx`
3. 实现 `kanban-column.tsx`

### Phase 4: 视图容器
1. 实现 `kanban-toolbar.tsx`
2. 实现 `kanban-board-view.tsx`
3. 实现 `kanban-list-view.tsx`

### Phase 5: 命令配置
1. 实现 `config/commands.ts`

### Phase 6: 主页面重构
1. 重构 `workspace-kanban.tsx` 使用新组件
2. 清理未使用的代码
3. 验证功能完整性

## 9. 预期成果

| 指标 | 重构前 | 重构后 |
|------|--------|--------|
| 主文件行数 | 2799 | ~250 |
| 组件数 | 1 (内嵌多个) | 10+ (独立文件) |
| Hooks | 0 (自定义) | 4 (功能域拆分) |
| 可测试性 | 低 | 高 |
| 复用性 | 低 | 高 |
