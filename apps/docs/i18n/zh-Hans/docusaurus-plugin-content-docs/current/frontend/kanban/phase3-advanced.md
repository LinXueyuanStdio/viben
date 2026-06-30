---
sidebar_position: 4
title: Phase 3 - Advanced Features
description: Kanban advanced features specification
---

# Kanban Phase 3 - Advanced Features Specification

> Advanced features based on vibe-kanban, adapted for Viben Design System

---

## Overview

| Attribute | Value |
|-----------|-------|
| Module ID | M-KANBAN-PHASE3 |
| Dependencies | kanban-features (Phase 1+2) |
| Priority | P1 |
| Status | 📝 Specification |

---

## Feature List

### P0 - Core Experience

| # | Feature | Description | vibe-kanban Reference |
|---|---------|-------------|----------------------|
| F14 | **Quick Task Creation** | Inline creation, keyboard shortcut support | KanbanAddCard |
| F15 | **Inline Task Editing** | Double-click card to edit title directly | KanbanCardContent |
| F16 | **Column Collapse/Expand** | Collapsible columns + WIP limit display | KanbanBoard |

### P1 - Efficiency Enhancement

| # | Feature | Description | vibe-kanban Reference |
|---|---------|-------------|----------------------|
| F17 | **Multiple Sort Modes** | Manual/priority/date/alphabetical | KanbanContainer |
| F18 | **Keyboard Navigation** | Arrow key navigation, quick actions | useKanbanKeyboard |
| F19 | **Command Palette** | Cmd+K quick actions | CommandPalette |
| F20 | **Drag Optimization** | Drag preview, animation optimization | @hello-pangea/dnd |

### P2 - Data Insights

| # | Feature | Description | vibe-kanban Reference |
|---|---------|-------------|----------------------|
| F21 | **Stats Panel** | Task count, completion rate, trends | StatsPanel |
| F22 | **Activity Timeline** | Task change history | ActivityFeed |
| F23 | **Board Configuration** | Column config, visibility, colors | BoardSettings |

---

## F14: Quick Task Creation

### Feature Description
Quickly create tasks at the bottom of columns or via keyboard shortcuts.

### Component Design

**QuickTaskInput** - Quick input component:

```tsx
interface QuickTaskInputProps {
  columnId: string;
  onSubmit: (title: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
}

export function QuickTaskInput({ columnId, onSubmit, placeholder, autoFocus, className }: QuickTaskInputProps) {
  const [value, setValue] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const handleSubmit = () => {
    if (value.trim()) {
      onSubmit(value.trim());
      setValue("");
    }
  };

  if (!isOpen) {
    return (
      <Button
        variant="ghost"
        className="w-full justify-start text-muted-foreground"
        onClick={() => setIsOpen(true)}
      >
        <Plus className="h-4 w-4 mr-2" />
        Add Task
      </Button>
    );
  }

  return (
    <div className={cn("p-2", className)}>
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder || "Enter task title..."}
        autoFocus={autoFocus}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSubmit();
          if (e.key === "Escape") setIsOpen(false);
        }}
        onBlur={() => {
          if (!value.trim()) setIsOpen(false);
        }}
      />
      <div className="flex gap-2 mt-2">
        <Button size="sm" onClick={handleSubmit}>Add</Button>
        <Button size="sm" variant="ghost" onClick={() => setIsOpen(false)}>Cancel</Button>
      </div>
    </div>
  );
}
```

### Keyboard Shortcuts
- `n` - Create task in current column
- `Shift+N` - Open detailed creation dialog

---

## F15: Inline Task Editing

### Feature Description
Double-click card title to edit directly without opening the detail panel.

### Component Design

**EditableCardTitle** - Editable card title:

```tsx
interface EditableCardTitleProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function EditableCardTitle({ value, onChange, className }: EditableCardTitleProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);

  const handleSave = () => {
    if (editValue.trim() && editValue !== value) {
      onChange(editValue.trim());
    }
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <Input
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSave();
          if (e.key === "Escape") {
            setEditValue(value);
            setIsEditing(false);
          }
        }}
        autoFocus
        className={cn("h-auto py-0 px-1 text-sm", className)}
        onClick={(e) => e.stopPropagation()} // Prevent bubbling to card click
      />
    );
  }

  return (
    <span
      className={cn("cursor-text", className)}
      onDoubleClick={(e) => {
        e.stopPropagation();
        setIsEditing(true);
      }}
    >
      {value}
    </span>
  );
}
```

---

## F16: Column Collapse/Expand

### Feature Description
- Collapse entire column to save space
- Show task count when collapsed
- Support WIP (Work In Progress) limits

### Component Design

**CollapsibleColumn** - Collapsible column:

```tsx
interface CollapsibleColumnProps {
  id: string;
  title: string;
  color: string;
  count: number;
  wipLimit?: number;
  collapsed?: boolean;
  onToggleCollapse?: (collapsed: boolean) => void;
  children: React.ReactNode;
}

export function CollapsibleColumn({
  id,
  title,
  color,
  count,
  wipLimit,
  collapsed,
  onToggleCollapse,
  children,
}: CollapsibleColumnProps) {
  const isOverWip = wipLimit && count > wipLimit;

  if (collapsed) {
    return (
      <div
        className="w-10 h-full flex flex-col items-center py-3 bg-muted/30 cursor-pointer hover:bg-muted/50"
        onClick={() => onToggleCollapse?.(false)}
      >
        <div
          className="w-2 h-2 rounded-full mb-2"
          style={{ backgroundColor: color }}
        />
        <span className="text-xs font-medium writing-mode-vertical">
          {title}
        </span>
        <Badge variant="secondary" className="mt-2 text-xs">
          {count}
        </Badge>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 p-3 border-b">
        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
        <span className="flex-1 font-medium">{title}</span>
        <Badge
          variant={isOverWip ? "destructive" : "secondary"}
          className="text-xs"
        >
          {count}{wipLimit && `/${wipLimit}`}
        </Badge>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => onToggleCollapse?.(true)}
        >
          <ChevronsLeft className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
    </div>
  );
}
```

### CSS Support

```css
.writing-mode-vertical {
  writing-mode: vertical-rl;
  text-orientation: mixed;
}
```

---

## F17: Multiple Sort Modes

### Feature Description
Support multiple sorting methods, can save user preferences.

### Sort Options

```typescript
export type SortMode = "manual" | "priority" | "dueDate" | "createdAt" | "updatedAt" | "title";

export const SORT_OPTIONS: Array<{ value: SortMode; label: string; icon: string }> = [
  { value: "manual", label: "Manual Sort", icon: "GripVertical" },
  { value: "priority", label: "By Priority", icon: "Signal" },
  { value: "dueDate", label: "By Due Date", icon: "Calendar" },
  { value: "createdAt", label: "By Created Time", icon: "Clock" },
  { value: "updatedAt", label: "By Updated Time", icon: "RefreshCw" },
  { value: "title", label: "By Title", icon: "ArrowDownAZ" },
];
```

### Component Design

**SortModeSelect**:

```tsx
interface SortModeSelectProps {
  value: SortMode;
  direction: "asc" | "desc";
  onChange: (mode: SortMode, direction: "asc" | "desc") => void;
}
```

---

## F18: Keyboard Navigation

### Keyboard Shortcut Design

| Shortcut | Function |
|----------|----------|
| `↑/↓` | Navigate tasks within column |
| `←/→` | Switch columns |
| `Enter` | Open task details |
| `Space` | Toggle selection |
| `n` | Create new task |
| `e` | Edit current task |
| `d` | Delete current task |
| `1-5` | Set priority |
| `Esc` | Cancel selection/close panel |

### Hook Design

```typescript
interface UseKanbanKeyboardOptions {
  tasks: Task[];
  columns: Column[];
  selectedId?: string;
  onSelect: (id: string) => void;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onPriorityChange: (id: string, priority: IssuePriority) => void;
}

export function useKanbanKeyboard(options: UseKanbanKeyboardOptions) {
  // Implement keyboard navigation logic
}
```

---

## F19: Command Palette

### Feature Description
Cmd+K opens command palette for quick actions.

### Command Categories

1. **Navigation Commands**: Jump to task, jump to column
2. **Action Commands**: Create task, bulk operations
3. **View Commands**: Switch view, filter
4. **Settings Commands**: Open settings, help

### Component Design

**CommandPalette**:

```tsx
interface Command {
  id: string;
  label: string;
  shortcut?: string;
  icon?: React.ReactNode;
  action: () => void;
  category?: string;
}

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  commands: Command[];
}
```

---

## F21: Stats Panel

### Feature Description
Display kanban statistics.

### Statistics Metrics

```typescript
interface KanbanStats {
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  overdueTasks: number;
  completionRate: number;
  avgCompletionTime?: number;
  tasksByPriority: Record<IssuePriority, number>;
  tasksByAssignee: Record<string, number>;
}
```

### Component Design

**StatsPanel** / **StatCard**:

```tsx
interface StatsPanelProps {
  stats: KanbanStats;
  className?: string;
}

interface StatCardProps {
  label: string;
  value: number | string;
  change?: number;
  trend?: "up" | "down" | "neutral";
  icon?: React.ReactNode;
}
```

---

## Implementation Order

### Phase 3A (Parallel)

| Task ID | Feature | Dependencies |
|---------|---------|--------------|
| T14 | Quick Task Creation | None |
| T15 | Inline Task Editing | None |
| T16 | Column Collapse/Expand | None |
| T17 | Multiple Sort Modes | None |

### Phase 3B (Parallel, depends on 3A)

| Task ID | Feature | Dependencies |
|---------|---------|--------------|
| T18 | Keyboard Navigation | T14, T15 |
| T19 | Command Palette | None |
| T20 | Drag Optimization | T16 |

### Phase 3C (depends on 3B)

| Task ID | Feature | Dependencies |
|---------|---------|--------------|
| T21 | Stats Panel | None |
| T22 | Desktop Integration | T14-T21 |

---

## Acceptance Criteria

### F14: Quick Task Creation
- [ ] Click + button to expand input box
- [ ] Enter to submit, Esc to cancel
- [ ] Support keyboard shortcut n to create

### F15: Inline Task Editing
- [ ] Double-click title to enter edit mode
- [ ] Enter to save, Esc to cancel
- [ ] Does not affect card click events

### F16: Column Collapse/Expand
- [ ] Click collapse button to collapse column
- [ ] Collapsed state shows title and count
- [ ] WIP limit exceeded shows warning

### F17: Multiple Sort Modes
- [ ] Support 6 sort modes
- [ ] Support ascending/descending toggle
- [ ] Save user preferences

---

**Last Updated**: 2026-02-07
**Version**: 1.0.0
**Status**: 📝 Specification
