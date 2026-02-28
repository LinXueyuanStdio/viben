---
sidebar_position: 3
title: Kanban 功能规格
description: 基于 vibe-kanban 的完整功能规格
---

# Kanban Features Specification

> 基于 vibe-kanban 的完整功能规格，适配 Viben Design System

---

## Overview

| Attribute | Value |
|-----------|-------|
| Module ID | M-KANBAN-FEATURES |
| Dependencies | kanban-integration (M-KANBAN), design-system |
| Priority | P0 |
| Status | 📝 Specification |
| Reference | [vibe-kanban](file:///Users/lxy/Documents/GitHub/others/vibe-kanban) |

---

## 功能清单

基于 vibe-kanban 的功能，按优先级分组：

### P0 - 核心功能 (必须实现)

| # | 功能 | 描述 | 状态 |
|---|------|------|------|
| F1 | **优先级系统** | urgent/high/medium/low/none 五级优先级 | 🔲 |
| F2 | **标签/Tags** | 多彩标签分类系统 | 🔲 |
| F3 | **高级筛选** | 按优先级、标签、搜索等条件筛选 | 🔲 |
| F4 | **任务详情增强** | 丰富的详情面板编辑功能 | 🔲 |

### P1 - 重要功能

| # | 功能 | 描述 | 状态 |
|---|------|------|------|
| F5 | **任务指派** | 单人/多人指派 | 🔲 |
| F6 | **截止日期** | 任务到期时间管理 | 🔲 |
| F7 | **子任务** | 父子任务层级关系 | 🔲 |
| F8 | **任务关系** | 阻塞/关联/重复关系 | 🔲 |

### P2 - 增强功能

| # | 功能 | 描述 | 状态 |
|---|------|------|------|
| F9 | **PR 集成** | GitHub PR 状态关联 | 🔲 |
| F10 | **多视图** | Kanban 看板 / 列表视图切换 | 🔲 |
| F11 | **排序模式** | 手动/优先级/日期/字母排序 | 🔲 |
| F12 | **批量操作** | 多选和批量更新 | 🔲 |

---

## F1: 优先级系统

### 数据模型

```typescript
// packages/kanban/src/types.ts
export type IssuePriority = "urgent" | "high" | "medium" | "low" | "none";

export interface PriorityConfig {
  value: IssuePriority;
  label: string;
  color: string;
  icon: string; // Lucide icon name
}

export const PRIORITY_CONFIG: Record<IssuePriority, PriorityConfig> = {
  urgent: {
    value: "urgent",
    label: "紧急",
    color: "var(--color-error)",
    icon: "AlertCircle",
  },
  high: {
    value: "high",
    label: "高",
    color: "var(--brand-amber-500)",
    icon: "ArrowUp",
  },
  medium: {
    value: "medium",
    label: "中",
    color: "var(--brand-teal-500)",
    icon: "Minus",
  },
  low: {
    value: "low",
    label: "低",
    color: "var(--neutral-500)",
    icon: "ArrowDown",
  },
  none: {
    value: "none",
    label: "无",
    color: "var(--neutral-400)",
    icon: "MoreHorizontal",
  },
};
```

### UI 组件

**PriorityIcon** - 优先级图标组件:

```tsx
// packages/kanban/src/primitives/priority-icon.tsx
interface PriorityIconProps {
  priority: IssuePriority;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}

export function PriorityIcon({ priority, size = "md", showLabel, className }: PriorityIconProps) {
  const config = PRIORITY_CONFIG[priority];
  const Icon = icons[config.icon];

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <Icon
        className={cn(
          "transition-colors",
          size === "sm" && "h-3 w-3",
          size === "md" && "h-4 w-4",
          size === "lg" && "h-5 w-5",
        )}
        style={{ color: config.color }}
      />
      {showLabel && (
        <span className="text-sm text-foreground-secondary">
          {config.label}
        </span>
      )}
    </div>
  );
}
```

**PrioritySelect** - 优先级选择器:

```tsx
// packages/kanban/src/primitives/priority-select.tsx
interface PrioritySelectProps {
  value: IssuePriority;
  onChange: (priority: IssuePriority) => void;
  disabled?: boolean;
}

export function PrioritySelect({ value, onChange, disabled }: PrioritySelectProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={disabled}>
        <Button variant="ghost" size="sm" className="h-7 gap-1.5">
          <PriorityIcon priority={value} size="sm" />
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-36">
        {Object.values(PRIORITY_CONFIG).map((config) => (
          <DropdownMenuItem
            key={config.value}
            onClick={() => onChange(config.value)}
            className={cn(value === config.value && "bg-accent")}
          >
            <PriorityIcon priority={config.value} size="sm" showLabel />
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

### 卡片集成

```tsx
// 在 KanbanCardContent 中显示优先级
<div className="flex items-center gap-2">
  {task.priority && task.priority !== "none" && (
    <PriorityIcon priority={task.priority} size="sm" />
  )}
  <span className="text-sm font-medium truncate">{task.title}</span>
</div>
```

### API 支持

```typescript
// apps/desktop/src/hooks/use-vibe-kanban.ts
interface UpdateTaskParams {
  id: string;
  priority?: IssuePriority;
  // ... other fields
}

export function useUpdateVibeKanbanTask() {
  return useMutation({
    mutationFn: async (params: UpdateTaskParams) => {
      return vibeKanbanApi.updateTask(params);
    },
    onMutate: async (params) => {
      // Optimistic update
      queryClient.setQueryData(
        vibeKanbanKeys.tasks(projectId),
        (old: Task[]) => old.map(t =>
          t.id === params.id ? { ...t, ...params } : t
        )
      );
    },
  });
}
```

---

## F2: 标签/Tags 系统

### 数据模型

```typescript
// packages/kanban/src/types.ts
export interface Tag {
  id: string;
  name: string;
  color: string; // CSS color value
}

export interface TaskWithTags extends KanbanItem {
  tags?: Tag[];
}

// 预设标签颜色
export const TAG_COLORS = [
  { name: "Red", value: "oklch(0.65 0.2 25)" },
  { name: "Orange", value: "oklch(0.7 0.18 60)" },
  { name: "Yellow", value: "oklch(0.8 0.16 90)" },
  { name: "Green", value: "oklch(0.7 0.18 145)" },
  { name: "Teal", value: "oklch(0.65 0.14 195)" },
  { name: "Blue", value: "oklch(0.6 0.18 240)" },
  { name: "Purple", value: "oklch(0.6 0.2 300)" },
  { name: "Pink", value: "oklch(0.7 0.18 350)" },
] as const;
```

### UI 组件

**TagBadge** - 标签徽章:

```tsx
// packages/kanban/src/primitives/tag-badge.tsx
interface TagBadgeProps {
  tag: Tag;
  size?: "sm" | "md";
  onRemove?: () => void;
  className?: string;
}

export function TagBadge({ tag, size = "sm", onRemove, className }: TagBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-medium",
        "transition-all duration-200",
        size === "sm" && "px-2 py-0.5 text-xs",
        size === "md" && "px-2.5 py-1 text-sm",
        className
      )}
      style={{
        backgroundColor: `color-mix(in oklch, ${tag.color} 20%, transparent)`,
        color: tag.color,
        borderColor: `color-mix(in oklch, ${tag.color} 40%, transparent)`,
        borderWidth: "1px",
      }}
    >
      {tag.name}
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-1 hover:bg-black/10 rounded-full p-0.5"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </span>
  );
}
```

**TagSelect** - 标签选择器:

```tsx
// packages/kanban/src/primitives/tag-select.tsx
interface TagSelectProps {
  projectId: string;
  selectedTags: Tag[];
  onChange: (tags: Tag[]) => void;
  disabled?: boolean;
}

export function TagSelect({ projectId, selectedTags, onChange, disabled }: TagSelectProps) {
  const { tags: availableTags } = useProjectTags(projectId);
  const [isCreating, setIsCreating] = useState(false);
  const [newTagName, setNewTagName] = useState("");

  const handleToggleTag = (tag: Tag) => {
    const isSelected = selectedTags.some(t => t.id === tag.id);
    if (isSelected) {
      onChange(selectedTags.filter(t => t.id !== tag.id));
    } else {
      onChange([...selectedTags, tag]);
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild disabled={disabled}>
        <Button variant="ghost" size="sm" className="h-7 gap-1.5">
          <Tags className="h-4 w-4" />
          {selectedTags.length > 0 && (
            <span className="text-xs bg-primary/10 px-1.5 rounded">
              {selectedTags.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start">
        <div className="space-y-1">
          {availableTags.map((tag) => (
            <button
              key={tag.id}
              onClick={() => handleToggleTag(tag)}
              className={cn(
                "flex items-center gap-2 w-full px-2 py-1.5 rounded-md",
                "hover:bg-accent transition-colors",
                selectedTags.some(t => t.id === tag.id) && "bg-accent"
              )}
            >
              <div
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: tag.color }}
              />
              <span className="text-sm">{tag.name}</span>
              {selectedTags.some(t => t.id === tag.id) && (
                <Check className="h-4 w-4 ml-auto" />
              )}
            </button>
          ))}
        </div>
        <Separator className="my-2" />
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start"
          onClick={() => setIsCreating(true)}
        >
          <Plus className="h-4 w-4 mr-2" />
          创建标签
        </Button>
      </PopoverContent>
    </Popover>
  );
}
```

### 卡片集成

```tsx
// 在 KanbanCardContent 中显示标签
{task.tags && task.tags.length > 0 && (
  <div className="flex flex-wrap gap-1 mt-2">
    {task.tags.slice(0, 3).map((tag) => (
      <TagBadge key={tag.id} tag={tag} size="sm" />
    ))}
    {task.tags.length > 3 && (
      <span className="text-xs text-muted-foreground">
        +{task.tags.length - 3}
      </span>
    )}
  </div>
)}
```

---

## F3: 高级筛选

### 数据模型

```typescript
// packages/kanban/src/types.ts
export interface KanbanFilter {
  search?: string;
  priorities?: IssuePriority[];
  tags?: string[]; // tag IDs
  assignees?: string[]; // user IDs
  statuses?: string[]; // status IDs
  dueDateRange?: {
    start?: string; // ISO date
    end?: string;
  };
}

export interface KanbanFilterState {
  filter: KanbanFilter;
  isFiltering: boolean;
  activeFilterCount: number;
}
```

### UI 组件

**KanbanFilterBar** - 筛选栏:

```tsx
// packages/kanban/src/components/kanban-filter-bar.tsx
interface KanbanFilterBarProps {
  filter: KanbanFilter;
  onChange: (filter: KanbanFilter) => void;
  projectId: string;
  className?: string;
}

export function KanbanFilterBar({ filter, onChange, projectId, className }: KanbanFilterBarProps) {
  const activeCount = countActiveFilters(filter);

  return (
    <div className={cn("flex items-center gap-2 flex-wrap", className)}>
      {/* 搜索框 */}
      <div className="relative flex-1 min-w-[200px] max-w-[300px]">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="搜索任务..."
          value={filter.search || ""}
          onChange={(e) => onChange({ ...filter, search: e.target.value })}
          className="pl-9 h-9"
        />
        {filter.search && (
          <button
            onClick={() => onChange({ ...filter, search: undefined })}
            className="absolute right-2.5 top-1/2 -translate-y-1/2"
          >
            <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
          </button>
        )}
      </div>

      {/* 优先级筛选 */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-9 gap-1.5">
            <Signal className="h-4 w-4" />
            优先级
            {filter.priorities?.length ? (
              <Badge variant="secondary" className="ml-1 px-1.5">
                {filter.priorities.length}
              </Badge>
            ) : null}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-40">
          {Object.values(PRIORITY_CONFIG).map((config) => (
            <DropdownMenuCheckboxItem
              key={config.value}
              checked={filter.priorities?.includes(config.value)}
              onCheckedChange={(checked) => {
                const current = filter.priorities || [];
                onChange({
                  ...filter,
                  priorities: checked
                    ? [...current, config.value]
                    : current.filter(p => p !== config.value),
                });
              }}
            >
              <PriorityIcon priority={config.value} size="sm" showLabel />
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* 标签筛选 */}
      <TagFilterDropdown
        projectId={projectId}
        selectedTags={filter.tags || []}
        onChange={(tags) => onChange({ ...filter, tags })}
      />

      {/* 清除筛选 */}
      {activeCount > 0 && (
        <Button
          variant="ghost"
          size="sm"
          className="h-9 text-muted-foreground hover:text-foreground"
          onClick={() => onChange({})}
        >
          <X className="h-4 w-4 mr-1" />
          清除筛选 ({activeCount})
        </Button>
      )}
    </div>
  );
}

function countActiveFilters(filter: KanbanFilter): number {
  let count = 0;
  if (filter.search) count++;
  if (filter.priorities?.length) count++;
  if (filter.tags?.length) count++;
  if (filter.assignees?.length) count++;
  if (filter.dueDateRange?.start || filter.dueDateRange?.end) count++;
  return count;
}
```

### 筛选逻辑

```typescript
// packages/kanban/src/hooks/use-filtered-tasks.ts
export function useFilteredTasks(tasks: Task[], filter: KanbanFilter): Task[] {
  return useMemo(() => {
    return tasks.filter((task) => {
      // 搜索
      if (filter.search) {
        const searchLower = filter.search.toLowerCase();
        const matches =
          task.title.toLowerCase().includes(searchLower) ||
          task.description?.toLowerCase().includes(searchLower);
        if (!matches) return false;
      }

      // 优先级
      if (filter.priorities?.length) {
        if (!filter.priorities.includes(task.priority || "none")) {
          return false;
        }
      }

      // 标签
      if (filter.tags?.length) {
        const taskTagIds = task.tags?.map(t => t.id) || [];
        const hasMatchingTag = filter.tags.some(id => taskTagIds.includes(id));
        if (!hasMatchingTag) return false;
      }

      // 指派人
      if (filter.assignees?.length) {
        if (!filter.assignees.includes(task.assigneeId || "")) {
          return false;
        }
      }

      // 截止日期范围
      if (filter.dueDateRange) {
        if (!task.dueDate) return false;
        const dueDate = new Date(task.dueDate);
        if (filter.dueDateRange.start && dueDate < new Date(filter.dueDateRange.start)) {
          return false;
        }
        if (filter.dueDateRange.end && dueDate > new Date(filter.dueDateRange.end)) {
          return false;
        }
      }

      return true;
    });
  }, [tasks, filter]);
}
```

---

## F4: 任务详情增强

### 详情面板布局

```tsx
// apps/desktop/src/components/workspace/task-detail-panel.tsx
interface TaskDetailPanelProps {
  task: Task;
  onClose: () => void;
  onUpdate: (updates: Partial<Task>) => void;
  onDelete: () => void;
}

export function TaskDetailPanel({ task, onClose, onUpdate, onDelete }: TaskDetailPanelProps) {
  return (
    <div className="h-full flex flex-col bg-surface border-l border-border">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <StatusBadge status={task.status} />
          <span className="text-sm text-muted-foreground">
            #{task.id.slice(0, 8)}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => {}}>
            <ExternalLink className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          {/* 标题 (可编辑) */}
          <EditableTitle
            value={task.title}
            onChange={(title) => onUpdate({ title })}
            className="text-xl font-serif font-semibold"
          />

          {/* 描述 (可编辑) */}
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">描述</Label>
            <EditableDescription
              value={task.description || ""}
              onChange={(description) => onUpdate({ description })}
              placeholder="添加描述..."
            />
          </div>

          {/* 属性区 */}
          <div className="space-y-3">
            {/* 状态 */}
            <PropertyRow label="状态" icon={Circle}>
              <StatusSelect
                value={task.status}
                onChange={(status) => onUpdate({ status })}
              />
            </PropertyRow>

            {/* 优先级 */}
            <PropertyRow label="优先级" icon={Signal}>
              <PrioritySelect
                value={task.priority || "none"}
                onChange={(priority) => onUpdate({ priority })}
              />
            </PropertyRow>

            {/* 标签 */}
            <PropertyRow label="标签" icon={Tags}>
              <TagSelect
                projectId={task.projectId}
                selectedTags={task.tags || []}
                onChange={(tags) => onUpdate({ tags })}
              />
            </PropertyRow>

            {/* 指派人 */}
            <PropertyRow label="指派给" icon={User}>
              <AssigneeSelect
                value={task.assigneeId}
                onChange={(assigneeId) => onUpdate({ assigneeId })}
              />
            </PropertyRow>

            {/* 截止日期 */}
            <PropertyRow label="截止日期" icon={Calendar}>
              <DueDatePicker
                value={task.dueDate}
                onChange={(dueDate) => onUpdate({ dueDate })}
              />
            </PropertyRow>
          </div>

          {/* 子任务 (F7) */}
          {task.subtasks && (
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">子任务</Label>
              <SubtaskList
                parentId={task.id}
                subtasks={task.subtasks}
                onUpdate={onUpdate}
              />
            </div>
          )}

          {/* 关联 (F8) */}
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">关联</Label>
            <RelationshipList
              taskId={task.id}
              relationships={task.relationships}
            />
          </div>
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="p-4 border-t border-border">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>创建于 {formatDate(task.createdAt)}</span>
          <span>更新于 {formatDate(task.updatedAt)}</span>
        </div>
      </div>
    </div>
  );
}

function PropertyRow({
  label,
  icon: Icon,
  children
}: {
  label: string;
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2 w-24 text-sm text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span>{label}</span>
      </div>
      <div className="flex-1">
        {children}
      </div>
    </div>
  );
}
```

---

## F5: 任务指派

### 数据模型

```typescript
// packages/kanban/src/types.ts
export interface Assignee {
  id: string;
  name: string;
  avatar?: string;
  email?: string;
}

export interface TaskWithAssignee extends KanbanItem {
  assigneeId?: string;
  assignee?: Assignee;
}
```

### UI 组件

**AssigneeAvatar** - 指派人头像:

```tsx
// packages/kanban/src/primitives/assignee-avatar.tsx
interface AssigneeAvatarProps {
  assignee: Assignee;
  size?: "sm" | "md" | "lg";
  showName?: boolean;
  className?: string;
}

export function AssigneeAvatar({ assignee, size = "md", showName, className }: AssigneeAvatarProps) {
  const sizeClasses = {
    sm: "h-5 w-5 text-[10px]",
    md: "h-6 w-6 text-xs",
    lg: "h-8 w-8 text-sm",
  };

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <Avatar className={sizeClasses[size]}>
        {assignee.avatar ? (
          <AvatarImage src={assignee.avatar} alt={assignee.name} />
        ) : (
          <AvatarFallback className="bg-primary/10 text-primary">
            {getInitials(assignee.name)}
          </AvatarFallback>
        )}
      </Avatar>
      {showName && (
        <span className="text-sm truncate max-w-[100px]">
          {assignee.name}
        </span>
      )}
    </div>
  );
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map(n => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}
```

---

## F6: 截止日期

### UI 组件

**DueDateBadge** - 截止日期徽章:

```tsx
// packages/kanban/src/primitives/due-date-badge.tsx
interface DueDateBadgeProps {
  dueDate: string;
  className?: string;
}

export function DueDateBadge({ dueDate, className }: DueDateBadgeProps) {
  const { isOverdue, isDueSoon, displayText } = useDueDateStatus(dueDate);

  return (
    <div
      className={cn(
        "flex items-center gap-1 text-xs px-1.5 py-0.5 rounded",
        isOverdue && "bg-error/10 text-error",
        isDueSoon && !isOverdue && "bg-warning/10 text-warning",
        !isOverdue && !isDueSoon && "bg-muted text-muted-foreground",
        className
      )}
    >
      <Calendar className="h-3 w-3" />
      <span>{displayText}</span>
    </div>
  );
}

function useDueDateStatus(dueDate: string) {
  const date = new Date(dueDate);
  const now = new Date();
  const diffDays = differenceInDays(date, now);

  return {
    isOverdue: diffDays < 0,
    isDueSoon: diffDays >= 0 && diffDays <= 2,
    displayText: formatDueDate(date),
  };
}

function formatDueDate(date: Date): string {
  const now = new Date();
  const diffDays = differenceInDays(date, now);

  if (diffDays < 0) return `逾期 ${Math.abs(diffDays)} 天`;
  if (diffDays === 0) return "今天";
  if (diffDays === 1) return "明天";
  if (diffDays < 7) return `${diffDays} 天后`;
  return format(date, "MM/dd");
}
```

---

## 样式适配规则

所有组件必须遵循 Viben Design System:

### 颜色映射

| vibe-kanban | Viben Design System |
|-------------|---------------------|
| `bg-card` | `bg-surface` |
| `border-border` | `border-border` |
| `text-foreground` | `text-foreground` |
| `text-muted-foreground` | `text-muted-foreground` |
| 蓝色主色 | `var(--primary)` (暖琥珀色) |
| 圆角 `rounded-lg` | `rounded-xl` |

### 动画规则

```css
/* 所有交互元素 */
transition: all var(--duration-fast) var(--ease-out-expo);

/* 悬停效果 */
hover:border-primary/30 hover:shadow-md hover:-translate-y-0.5
```

### 组件样式模板

```tsx
// 标准卡片样式
const cardClass = cn(
  "rounded-xl border border-border bg-surface p-4",
  "transition-all duration-200 ease-out-expo",
  "hover:border-primary/30 hover:shadow-md hover:-translate-y-0.5"
);

// 标准按钮样式
const buttonClass = cn(
  "inline-flex items-center justify-center rounded-lg font-medium",
  "transition-all duration-200 ease-out-expo",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
);
```

---

## 实现顺序

### Phase 1: P0 功能 (并行)

可同时进行的独立任务:

| Task ID | 功能 | 文件 | 依赖 |
|---------|------|------|------|
| T1 | 优先级系统 | `packages/kanban/src/primitives/priority-*.tsx` | 无 |
| T2 | 标签系统 | `packages/kanban/src/primitives/tag-*.tsx` | 无 |
| T3 | 筛选栏 | `packages/kanban/src/components/kanban-filter-bar.tsx` | T1, T2 |
| T4 | 详情面板增强 | `apps/desktop/src/components/workspace/task-detail-panel.tsx` | T1, T2 |

### Phase 2: P1 功能 (并行)

| Task ID | 功能 | 文件 | 依赖 |
|---------|------|------|------|
| T5 | 指派人系统 | `packages/kanban/src/primitives/assignee-*.tsx` | 无 |
| T6 | 截止日期 | `packages/kanban/src/primitives/due-date-*.tsx` | 无 |
| T7 | 子任务 | `packages/kanban/src/components/subtask-*.tsx` | T4 |
| T8 | 任务关系 | `packages/kanban/src/components/relationship-*.tsx` | T4 |

### Phase 3: P2 功能

| Task ID | 功能 | 文件 | 依赖 |
|---------|------|------|------|
| T9 | PR 集成 | 待定 | Phase 1 |
| T10 | 多视图 | 待定 | Phase 1 |
| T11 | 排序模式 | 待定 | Phase 1 |
| T12 | 批量操作 | 待定 | Phase 1 |

---

## 验收标准

### F1: 优先级系统
- [ ] PriorityIcon 显示正确的图标和颜色
- [ ] PrioritySelect 可选择所有优先级
- [ ] 卡片上显示非 none 优先级图标
- [ ] 优先级更新后实时反映

### F2: 标签系统
- [ ] TagBadge 显示正确的颜色和名称
- [ ] TagSelect 可选择/取消选择标签
- [ ] 可创建新标签
- [ ] 卡片上最多显示 3 个标签

### F3: 高级筛选
- [ ] 搜索框支持标题和描述搜索
- [ ] 优先级筛选支持多选
- [ ] 标签筛选支持多选
- [ ] 显示活跃筛选数量
- [ ] 清除筛选按钮工作正常

### F4: 任务详情增强
- [ ] 标题可内联编辑
- [ ] 描述可内联编辑
- [ ] 所有属性可修改
- [ ] 显示创建/更新时间

---

**Last Updated**: 2026-02-07
**Version**: 1.0.0
**Status**: 📝 Specification
