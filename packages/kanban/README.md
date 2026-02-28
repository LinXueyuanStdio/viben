# @viben/kanban

Viben 看板组件库，基于 @dnd-kit 实现拖拽功能。

## 安装

```bash
pnpm add @viben/kanban
```

## 核心组件

### KanbanProvider

看板拖拽上下文提供者，包裹整个看板区域：

```tsx
import { KanbanProvider, type DragEndEvent } from "@viben/kanban";

function MyKanban() {
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over) {
      // 处理拖拽结束，更新任务状态
      moveTask(active.id, over.id);
    }
  };

  return (
    <KanbanProvider
      onDragEnd={handleDragEnd}
      renderDragOverlay={(activeId) => (
        // 自定义拖拽预览
        <TaskCard task={getTask(activeId)} />
      )}
    >
      {/* 看板列 */}
    </KanbanProvider>
  );
}
```

### KanbanBoard

看板列容器，作为拖拽放置区域：

```tsx
import { KanbanBoard, KanbanHeader, KanbanCards, KanbanCard } from "@viben/kanban";

<KanbanBoard id="todo" backgroundColor="--blue-500">
  <KanbanHeader
    name="待办"
    color="--blue-500"
    taskCount={5}
    onAddTask={() => createTask("todo")}
  />
  <KanbanCards>
    {tasks.map((task, index) => (
      <KanbanCard
        key={task.id}
        id={task.id}
        name={task.name}
        index={index}
        parent="todo"
        onClick={() => openTask(task.id)}
      >
        <TaskCardContent task={task} />
      </KanbanCard>
    ))}
  </KanbanCards>
</KanbanBoard>
```

### KanbanCard

可拖拽的任务卡片：

```tsx
<KanbanCard
  id={task.id}
  name={task.name}
  index={0}
  parent="in-progress"
  onClick={() => openTask(task.id)}
  isOpen={selectedTaskId === task.id}
  statusIndicator="in-progress"
  showMoreMenu={true}
  renderMoreMenu={() => <TaskContextMenu task={task} />}
>
  {/* 自定义卡片内容 */}
</KanbanCard>
```

## 完整示例

```tsx
import {
  KanbanProvider,
  KanbanBoard,
  KanbanHeader,
  KanbanCards,
  KanbanCard,
  STATUS_INDICATOR_COLORS,
  type DragEndEvent,
} from "@viben/kanban";

const COLUMNS = [
  { id: "todo", name: "待办", color: "--muted-foreground" },
  { id: "in-progress", name: "进行中", color: "--blue-500" },
  { id: "done", name: "已完成", color: "--green-500" },
];

function TaskBoard() {
  const [tasks, setTasks] = useState<Task[]>([]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    setTasks((prev) =>
      prev.map((task) =>
        task.id === active.id
          ? { ...task, status: over.id as string }
          : task
      )
    );
  };

  return (
    <KanbanProvider onDragEnd={handleDragEnd}>
      {COLUMNS.map((column) => (
        <KanbanBoard key={column.id} id={column.id}>
          <KanbanHeader
            name={column.name}
            color={column.color}
            taskCount={tasks.filter((t) => t.status === column.id).length}
          />
          <KanbanCards emptyMessage="暂无任务">
            {tasks
              .filter((task) => task.status === column.id)
              .map((task, index) => (
                <KanbanCard
                  key={task.id}
                  id={task.id}
                  name={task.name}
                  index={index}
                  parent={column.id}
                />
              ))}
          </KanbanCards>
        </KanbanBoard>
      ))}
    </KanbanProvider>
  );
}
```

## 辅助组件

### 视图系统

| 组件 | 描述 |
|------|------|
| `ViewSwitcher` | 视图切换器（看板/列表） |
| `ListView` | 列表视图 |
| `ListViewItem` | 列表视图项 |
| `GroupedListView` | 分组列表视图 |

### 任务属性

| 组件 | 描述 |
|------|------|
| `PriorityIcon` / `PrioritySelect` | 优先级图标和选择器 |
| `AssigneeAvatar` / `AssigneeSelect` | 负责人头像和选择器 |
| `DueDateBadge` / `DueDatePicker` | 截止日期徽章和选择器 |
| `TagBadge` / `TagSelect` | 标签徽章和选择器 |

### 子任务系统

| 组件 | 描述 |
|------|------|
| `SubtaskProgress` | 子任务进度条 |
| `SubtaskItem` | 子任务项 |
| `SubtaskList` | 子任务列表 |

### 关系系统

| 组件 | 描述 |
|------|------|
| `RelationshipBadge` | 关系徽章 |
| `RelationshipList` | 关系列表 |
| `RelationshipAdd` | 添加关系 |

### 评论和活动

| 组件 | 描述 |
|------|------|
| `CommentInput` | 评论输入框 |
| `CommentItem` | 评论项 |
| `CommentList` | 评论列表 |
| `ActivityItem` | 活动项 |
| `ActivityFeed` | 活动流 |

### 其他组件

| 组件 | 描述 |
|------|------|
| `BulkActionsBar` | 批量操作栏 |
| `SelectableCard` | 可选择卡片 |
| `QuickTaskInput` | 快速任务输入 |
| `EditableCardTitle` | 可编辑卡片标题 |
| `EditableText` | 可编辑文本 |
| `StatCard` / `StatsPanel` | 统计卡片和面板 |
| `SortModeSelect` | 排序模式选择 |
| `CommandPalette` | 命令面板 |
| `CollapsibleColumn` | 可折叠列 |
| `BoardSettingsDialog` | 看板设置对话框 |
| `DragPreview` | 拖拽预览 |
| `MultiDragOverlay` | 多选拖拽覆盖层 |

## Hooks

| Hook | 描述 |
|------|------|
| `useFilteredItems` | 筛选项目 |
| `useMultiSelect` | 多选状态管理 |
| `useSortedItems` | 排序项目 |
| `useKanbanStats` | 看板统计 |
| `useCommandPalette` | 命令面板状态 |
| `useColumnCollapse` | 列折叠状态 |
| `useKanbanKeyboard` | 键盘快捷键 |
| `useKanbanPreferences` | 看板偏好设置 |
| `useDragPreview` | 拖拽预览状态 |

## 类型导出

```tsx
import type {
  Status,
  Feature,
  DragEndEvent,
  StatusIndicator,
  IssuePriority,
  Assignee,
  Tag,
  Subtask,
  TaskRelationship,
  Comment,
  ActivityEvent,
  ViewMode,
  SortMode,
  KanbanFilter,
  KanbanStats,
  KanbanPreferences,
} from "@viben/kanban";
```

## 依赖

### Peer Dependencies

- `react` ^18.0.0 || ^19.0.0
- `react-dom` ^18.0.0 || ^19.0.0
- `lucide-react` >=0.400.0

### 核心依赖

- `@dnd-kit/core` - 拖拽核心
- `@dnd-kit/sortable` - 排序支持
- `@dnd-kit/utilities` - 工具函数
- `@viben/ui` - UI 组件库
