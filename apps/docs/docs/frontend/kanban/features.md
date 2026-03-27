---
sidebar_position: 3
title: Kanban Features Specification
description: Complete feature specification based on vibe-kanban
---

# Kanban Features Specification

> Complete feature specification based on vibe-kanban, adapted for Viben Design System

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

## Feature List

Features based on vibe-kanban, grouped by priority:

### P0 - Core Features (Must Implement)

| # | Feature | Description | Status |
|---|---------|-------------|--------|
| F1 | **Priority System** | Five-level priority: urgent/high/medium/low/none | 🔲 |
| F2 | **Tags** | Colorful tag classification system | 🔲 |
| F3 | **Advanced Filtering** | Filter by priority, tags, search, etc. | 🔲 |
| F4 | **Enhanced Task Details** | Rich detail panel editing functionality | 🔲 |

### P1 - Important Features

| # | Feature | Description | Status |
|---|---------|-------------|--------|
| F5 | **Task Assignment** | Single/multiple assignee | 🔲 |
| F6 | **Due Date** | Task deadline management | 🔲 |
| F7 | **Subtasks** | Parent-child task hierarchy | 🔲 |
| F8 | **Task Relations** | Blocking/related/duplicate relations | 🔲 |

### P2 - Enhanced Features

| # | Feature | Description | Status |
|---|---------|-------------|--------|
| F9 | **PR Integration** | GitHub PR status linking | 🔲 |
| F10 | **Multiple Views** | Kanban board / list view switching | 🔲 |
| F11 | **Sort Modes** | Manual/priority/date/alphabetical sorting | 🔲 |
| F12 | **Bulk Operations** | Multi-select and batch update | 🔲 |

---

## F1: Priority System

### Data Model

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
    label: "Urgent",
    color: "var(--color-error)",
    icon: "AlertCircle",
  },
  high: {
    value: "high",
    label: "High",
    color: "var(--brand-amber-500)",
    icon: "ArrowUp",
  },
  medium: {
    value: "medium",
    label: "Medium",
    color: "var(--brand-teal-500)",
    icon: "Minus",
  },
  low: {
    value: "low",
    label: "Low",
    color: "var(--neutral-500)",
    icon: "ArrowDown",
  },
  none: {
    value: "none",
    label: "None",
    color: "var(--neutral-400)",
    icon: "MoreHorizontal",
  },
};
```

### UI Components

**PriorityIcon** - Priority icon component:

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

**PrioritySelect** - Priority selector:

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

### Card Integration

```tsx
// Display priority in KanbanCardContent
<div className="flex items-center gap-2">
  {task.priority && task.priority !== "none" && (
    <PriorityIcon priority={task.priority} size="sm" />
  )}
  <span className="text-sm font-medium truncate">{task.title}</span>
</div>
```

### API Support

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

## F2: Tags System

### Data Model

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

// Preset tag colors
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

### UI Components

**TagBadge** - Tag badge:

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

**TagSelect** - Tag selector:

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
          Create Tag
        </Button>
      </PopoverContent>
    </Popover>
  );
}
```

### Card Integration

```tsx
// Display tags in KanbanCardContent
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

## F3: Advanced Filtering

### Data Model

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

### UI Components

**KanbanFilterBar** - Filter bar:

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
      {/* Search box */}
      <div className="relative flex-1 min-w-[200px] max-w-[300px]">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search tasks..."
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

      {/* Priority filter */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-9 gap-1.5">
            <Signal className="h-4 w-4" />
            Priority
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

      {/* Tag filter */}
      <TagFilterDropdown
        projectId={projectId}
        selectedTags={filter.tags || []}
        onChange={(tags) => onChange({ ...filter, tags })}
      />

      {/* Clear filters */}
      {activeCount > 0 && (
        <Button
          variant="ghost"
          size="sm"
          className="h-9 text-muted-foreground hover:text-foreground"
          onClick={() => onChange({})}
        >
          <X className="h-4 w-4 mr-1" />
          Clear Filters ({activeCount})
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

### Filtering Logic

```typescript
// packages/kanban/src/hooks/use-filtered-tasks.ts
export function useFilteredTasks(tasks: Task[], filter: KanbanFilter): Task[] {
  return useMemo(() => {
    return tasks.filter((task) => {
      // Search
      if (filter.search) {
        const searchLower = filter.search.toLowerCase();
        const matches =
          task.title.toLowerCase().includes(searchLower) ||
          task.description?.toLowerCase().includes(searchLower);
        if (!matches) return false;
      }

      // Priority
      if (filter.priorities?.length) {
        if (!filter.priorities.includes(task.priority || "none")) {
          return false;
        }
      }

      // Tags
      if (filter.tags?.length) {
        const taskTagIds = task.tags?.map(t => t.id) || [];
        const hasMatchingTag = filter.tags.some(id => taskTagIds.includes(id));
        if (!hasMatchingTag) return false;
      }

      // Assignee
      if (filter.assignees?.length) {
        if (!filter.assignees.includes(task.assigneeId || "")) {
          return false;
        }
      }

      // Due date range
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

## F4: Enhanced Task Details

### Detail Panel Layout

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
          {/* Title (editable) */}
          <EditableTitle
            value={task.title}
            onChange={(title) => onUpdate({ title })}
            className="text-xl font-serif font-semibold"
          />

          {/* Description (editable) */}
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Description</Label>
            <EditableDescription
              value={task.description || ""}
              onChange={(description) => onUpdate({ description })}
              placeholder="Add description..."
            />
          </div>

          {/* Properties section */}
          <div className="space-y-3">
            {/* Status */}
            <PropertyRow label="Status" icon={Circle}>
              <StatusSelect
                value={task.status}
                onChange={(status) => onUpdate({ status })}
              />
            </PropertyRow>

            {/* Priority */}
            <PropertyRow label="Priority" icon={Signal}>
              <PrioritySelect
                value={task.priority || "none"}
                onChange={(priority) => onUpdate({ priority })}
              />
            </PropertyRow>

            {/* Tags */}
            <PropertyRow label="Tags" icon={Tags}>
              <TagSelect
                projectId={task.projectId}
                selectedTags={task.tags || []}
                onChange={(tags) => onUpdate({ tags })}
              />
            </PropertyRow>

            {/* Assignee */}
            <PropertyRow label="Assignee" icon={User}>
              <AssigneeSelect
                value={task.assigneeId}
                onChange={(assigneeId) => onUpdate({ assigneeId })}
              />
            </PropertyRow>

            {/* Due Date */}
            <PropertyRow label="Due Date" icon={Calendar}>
              <DueDatePicker
                value={task.dueDate}
                onChange={(dueDate) => onUpdate({ dueDate })}
              />
            </PropertyRow>
          </div>

          {/* Subtasks (F7) */}
          {task.subtasks && (
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Subtasks</Label>
              <SubtaskList
                parentId={task.id}
                subtasks={task.subtasks}
                onUpdate={onUpdate}
              />
            </div>
          )}

          {/* Relations (F8) */}
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Relations</Label>
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
          <span>Created at {formatDate(task.createdAt)}</span>
          <span>Updated at {formatDate(task.updatedAt)}</span>
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

## F5: Task Assignment

### Data Model

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

### UI Components

**AssigneeAvatar** - Assignee avatar:

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

## F6: Due Date

### UI Components

**DueDateBadge** - Due date badge:

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

  if (diffDays < 0) return `Overdue ${Math.abs(diffDays)} days`;
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays < 7) return `In ${diffDays} days`;
  return format(date, "MM/dd");
}
```

---

## Style Adaptation Rules

All components must follow Viben Design System:

### Color Mapping

| vibe-kanban | Viben Design System |
|-------------|---------------------|
| `bg-card` | `bg-surface` |
| `border-border` | `border-border` |
| `text-foreground` | `text-foreground` |
| `text-muted-foreground` | `text-muted-foreground` |
| Blue primary | `var(--primary)` (warm amber) |
| Border radius `rounded-lg` | `rounded-xl` |

### Animation Rules

```css
/* All interactive elements */
transition: all var(--duration-fast) var(--ease-out-expo);

/* Hover effects */
hover:border-primary/30 hover:shadow-md hover:-translate-y-0.5
```

### Component Style Template

```tsx
// Standard card style
const cardClass = cn(
  "rounded-xl border border-border bg-surface p-4",
  "transition-all duration-200 ease-out-expo",
  "hover:border-primary/30 hover:shadow-md hover:-translate-y-0.5"
);

// Standard button style
const buttonClass = cn(
  "inline-flex items-center justify-center rounded-lg font-medium",
  "transition-all duration-200 ease-out-expo",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
);
```

---

## Implementation Order

### Phase 1: P0 Features (Parallel)

Independent tasks that can be done simultaneously:

| Task ID | Feature | Files | Dependencies |
|---------|---------|-------|--------------|
| T1 | Priority System | `packages/kanban/src/primitives/priority-*.tsx` | None |
| T2 | Tag System | `packages/kanban/src/primitives/tag-*.tsx` | None |
| T3 | Filter Bar | `packages/kanban/src/components/kanban-filter-bar.tsx` | T1, T2 |
| T4 | Detail Panel Enhancement | `apps/desktop/src/components/workspace/task-detail-panel.tsx` | T1, T2 |

### Phase 2: P1 Features (Parallel)

| Task ID | Feature | Files | Dependencies |
|---------|---------|-------|--------------|
| T5 | Assignee System | `packages/kanban/src/primitives/assignee-*.tsx` | None |
| T6 | Due Date | `packages/kanban/src/primitives/due-date-*.tsx` | None |
| T7 | Subtasks | `packages/kanban/src/components/subtask-*.tsx` | T4 |
| T8 | Task Relations | `packages/kanban/src/components/relationship-*.tsx` | T4 |

### Phase 3: P2 Features

| Task ID | Feature | Files | Dependencies |
|---------|---------|-------|--------------|
| T9 | PR Integration | TBD | Phase 1 |
| T10 | Multiple Views | TBD | Phase 1 |
| T11 | Sort Modes | TBD | Phase 1 |
| T12 | Bulk Operations | TBD | Phase 1 |

---

## Acceptance Criteria

### F1: Priority System
- [ ] PriorityIcon displays correct icon and color
- [ ] PrioritySelect can select all priorities
- [ ] Cards display non-none priority icons
- [ ] Priority updates reflect in real-time

### F2: Tag System
- [ ] TagBadge displays correct color and name
- [ ] TagSelect can select/deselect tags
- [ ] Can create new tags
- [ ] Cards display up to 3 tags

### F3: Advanced Filtering
- [ ] Search box supports title and description search
- [ ] Priority filter supports multi-select
- [ ] Tag filter supports multi-select
- [ ] Shows active filter count
- [ ] Clear filters button works correctly

### F4: Enhanced Task Details
- [ ] Title is inline editable
- [ ] Description is inline editable
- [ ] All properties are modifiable
- [ ] Shows created/updated time

---

**Last Updated**: 2026-02-07
**Version**: 1.0.0
**Status**: 📝 Specification
