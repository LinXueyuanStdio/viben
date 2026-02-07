# Kanban Phase 4 - 高级定制与协作

> 基于 vibe-kanban 的高级功能，适配 Viben Design System

---

## Overview

| Attribute | Value |
|-----------|-------|
| Module ID | M-KANBAN-PHASE4 |
| Dependencies | kanban-features (Phase 1-3) |
| Priority | P1 |
| Status | 📝 Specification |

---

## 功能清单

### P0 - 看板定制

| # | 功能 | 描述 | vibe-kanban 参考 |
|---|------|------|-----------------|
| F24 | **看板显示设置** | 列重排序、颜色、可见性 | KanbanDisplaySettingsContainer |
| F25 | **列配置面板** | 列名编辑、颜色选择、WIP 限制 | ColumnSettings |
| F26 | **用户偏好持久化** | 保存折叠状态、排序偏好 | localStorage/preferences |

### P1 - 协作功能

| # | 功能 | 描述 | vibe-kanban 参考 |
|---|------|------|-----------------|
| F27 | **评论系统** | 富文本评论、表情反应 | IssueCommentsSection |
| F28 | **活动时间线** | 任务变更历史记录 | ActivityFeed |
| F29 | **通知系统** | 评论、状态变更通知 | NotificationTypes |

### P2 - 增强功能

| # | 功能 | 描述 | vibe-kanban 参考 |
|---|------|------|-----------------|
| F30 | **高级列表视图** | 可折叠分组、专用拖拽手柄 | IssueListView |
| F31 | **视图导航标签** | 动态标签、URL 深链接 | ViewNavTabs |
| F32 | **拖拽增强** | Portal 预览、多选拖拽 | DnD enhancements |
| F33 | **看板模板** | 预设模板、快速创建 | BoardTemplates |

---

## F24: 看板显示设置

### 功能描述
提供可视化界面配置看板列的显示和顺序。

### 组件设计

**BoardSettingsDialog** - 看板设置对话框:

```tsx
interface BoardSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  columns: ColumnConfig[];
  onColumnsChange: (columns: ColumnConfig[]) => void;
}

interface ColumnConfig {
  id: string;
  name: string;
  color: string;
  visible: boolean;
  wipLimit?: number;
  order: number;
}
```

### 交互设计
- 拖拽重排列顺序
- 点击颜色块选择颜色
- 切换可见性开关
- 编辑列名 (双击或铅笔图标)

---

## F25: 列配置面板

### 组件设计

**ColumnSettingsPanel**:

```tsx
interface ColumnSettingsPanelProps {
  column: ColumnConfig;
  onChange: (column: ColumnConfig) => void;
  onDelete?: () => void;
  canDelete?: boolean;
}

// 颜色预设
const COLUMN_COLORS = [
  { name: "灰色", value: "hsl(var(--muted))" },
  { name: "蓝色", value: "hsl(var(--primary))" },
  { name: "黄色", value: "hsl(var(--warning))" },
  { name: "绿色", value: "hsl(var(--success))" },
  { name: "红色", value: "hsl(var(--destructive))" },
  { name: "紫色", value: "hsl(280 60% 50%)" },
  { name: "橙色", value: "hsl(25 90% 50%)" },
  { name: "青色", value: "hsl(180 60% 45%)" },
];
```

---

## F26: 用户偏好持久化

### Hook 设计

**useKanbanPreferences**:

```typescript
interface KanbanPreferences {
  // 视图偏好
  viewMode: ViewMode;
  sortMode: SortMode;
  sortDirection: SortDirection;

  // 列状态
  collapsedColumns: string[];
  columnOrder: string[];
  hiddenColumns: string[];

  // 面板状态
  detailPanelWidth: number;
  showStats: boolean;

  // 筛选器
  savedFilters: KanbanFilter[];
}

interface UseKanbanPreferencesOptions {
  projectId: string;
  storageKey?: string;
}

function useKanbanPreferences(options: UseKanbanPreferencesOptions): {
  preferences: KanbanPreferences;
  updatePreference: <K extends keyof KanbanPreferences>(
    key: K,
    value: KanbanPreferences[K]
  ) => void;
  resetPreferences: () => void;
};
```

---

## F27: 评论系统

### 功能描述
- 富文本评论输入
- 表情反应 (👍 ❤️ 🎉 等)
- 评论编辑/删除
- 相对时间显示

### 组件设计

**CommentList** + **CommentItem** + **CommentInput**:

```tsx
interface Comment {
  id: string;
  content: string;
  author: {
    id: string;
    name: string;
    avatar?: string;
  };
  createdAt: string;
  updatedAt?: string;
  reactions: CommentReaction[];
}

interface CommentReaction {
  emoji: string;
  users: { id: string; name: string }[];
  count: number;
}

interface CommentListProps {
  taskId: string;
  comments: Comment[];
  onAddComment: (content: string) => void;
  onEditComment: (id: string, content: string) => void;
  onDeleteComment: (id: string) => void;
  onToggleReaction: (commentId: string, emoji: string) => void;
}
```

### 表情反应预设

```typescript
const REACTION_EMOJIS = ["👍", "👎", "❤️", "🎉", "😄", "🤔", "👀", "🚀"];
```

---

## F28: 活动时间线

### 功能描述
记录任务的所有变更历史。

### 组件设计

**ActivityFeed**:

```tsx
interface ActivityEvent {
  id: string;
  type: ActivityType;
  actor: { id: string; name: string; avatar?: string };
  timestamp: string;
  data: Record<string, unknown>;
}

type ActivityType =
  | "created"
  | "status_changed"
  | "priority_changed"
  | "assignee_changed"
  | "title_changed"
  | "description_changed"
  | "tag_added"
  | "tag_removed"
  | "due_date_changed"
  | "comment_added";

interface ActivityFeedProps {
  events: ActivityEvent[];
  className?: string;
}
```

---

## F30: 高级列表视图

### 功能描述
- 按状态分组，可折叠
- 专用拖拽手柄
- 相对时间格式

### 组件设计

**GroupedListView**:

```tsx
interface ListGroup {
  id: string;
  name: string;
  color: string;
  count: number;
  collapsed?: boolean;
}

interface GroupedListViewProps<T> {
  items: T[];
  groups: ListGroup[];
  groupBy: (item: T) => string;
  collapsedGroups: Set<string>;
  onToggleGroup: (groupId: string) => void;
  renderItem: (item: T) => React.ReactNode;
  onDragEnd: (event: DragEndEvent) => void;
}
```

---

## F32: 拖拽增强

### 功能描述
- Portal 拖拽预览 (防止被裁剪)
- 多选拖拽支持
- 动画优化

### Hook 设计

**useDragPreview**:

```typescript
interface UseDragPreviewOptions {
  enabled?: boolean;
  renderPreview: (ids: string[]) => React.ReactNode;
}

function useDragPreview(options: UseDragPreviewOptions): {
  DragOverlay: React.FC;
  isDragging: boolean;
  draggedIds: string[];
};
```

---

## 实现顺序

### Phase 4A (并行)

| Task ID | 功能 | 依赖 |
|---------|------|------|
| T24 | 看板显示设置 | 无 |
| T25 | 列配置面板 | 无 |
| T26 | 用户偏好持久化 | 无 |
| T27 | 评论系统类型 | 无 |

### Phase 4B (并行，依赖 4A)

| Task ID | 功能 | 依赖 |
|---------|------|------|
| T28 | 评论组件实现 | T27 |
| T29 | 活动时间线 | 无 |
| T30 | 高级列表视图 | 无 |
| T31 | 拖拽增强 | 无 |

### Phase 4C (依赖 4B)

| Task ID | 功能 | 依赖 |
|---------|------|------|
| T32 | 集成到 Desktop | T24-T31 |

---

## 验收标准

### F24: 看板显示设置
- [ ] 可拖拽重排列顺序
- [ ] 颜色选择器工作正常
- [ ] 可见性切换生效
- [ ] 保存设置后刷新保持

### F25: 列配置面板
- [ ] 双击编辑列名
- [ ] 颜色预设选择
- [ ] WIP 限制可配置
- [ ] 删除有任务的列时警告

### F26: 用户偏好持久化
- [ ] 折叠状态持久化
- [ ] 排序偏好持久化
- [ ] 跨会话保持

### F27: 评论系统
- [ ] 可添加评论
- [ ] 可添加表情反应
- [ ] 可编辑/删除自己的评论
- [ ] 显示相对时间

---

**Last Updated**: 2026-02-07
**Version**: 1.0.0
**Status**: 📝 Specification
