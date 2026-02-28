---
sidebar_position: 4
title: Phase 3 - 高级功能
description: Kanban 高级功能规格
---

# Kanban Phase 3 - 高级功能规格

> 基于 vibe-kanban 的高级功能，适配 Viben Design System

---

## Overview

| Attribute | Value |
|-----------|-------|
| Module ID | M-KANBAN-PHASE3 |
| Dependencies | kanban-features (Phase 1+2) |
| Priority | P1 |
| Status | 📝 Specification |

---

## 功能清单

### P0 - 核心体验

| # | 功能 | 描述 | vibe-kanban 参考 |
|---|------|------|-----------------|
| F14 | **快速任务创建** | 内联创建、快捷键支持 | KanbanAddCard |
| F15 | **内联任务编辑** | 双击卡片直接编辑标题 | KanbanCardContent |
| F16 | **列折叠/展开** | 可折叠列 + WIP 限制显示 | KanbanBoard |

### P1 - 效率增强

| # | 功能 | 描述 | vibe-kanban 参考 |
|---|------|------|-----------------|
| F17 | **多排序模式** | 手动/优先级/日期/字母 | KanbanContainer |
| F18 | **键盘导航** | 方向键导航、快捷操作 | useKanbanKeyboard |
| F19 | **命令面板** | Cmd+K 快速操作 | CommandPalette |
| F20 | **拖拽优化** | 拖拽预览、动画优化 | @hello-pangea/dnd |

### P2 - 数据洞察

| # | 功能 | 描述 | vibe-kanban 参考 |
|---|------|------|-----------------|
| F21 | **统计面板** | 任务数、完成率、趋势 | StatsPanel |
| F22 | **活动时间线** | 任务变更历史 | ActivityFeed |
| F23 | **看板配置** | 列配置、显隐、颜色 | BoardSettings |

---

## F14: 快速任务创建

### 功能描述
在列底部或通过快捷键快速创建任务。

### 组件设计

**QuickTaskInput** - 快速输入组件:

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
        添加任务
      </Button>
    );
  }

  return (
    <div className={cn("p-2", className)}>
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder || "输入任务标题..."}
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
        <Button size="sm" onClick={handleSubmit}>添加</Button>
        <Button size="sm" variant="ghost" onClick={() => setIsOpen(false)}>取消</Button>
      </div>
    </div>
  );
}
```

### 快捷键
- `n` - 在当前列创建任务
- `Shift+N` - 打开详细创建对话框

---

## F15: 内联任务编辑

### 功能描述
双击卡片标题直接编辑，无需打开详情面板。

### 组件设计

**EditableCardTitle** - 可编辑卡片标题:

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
        onClick={(e) => e.stopPropagation()} // 阻止冒泡到卡片点击
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

## F16: 列折叠/展开

### 功能描述
- 可折叠整列节省空间
- 折叠时显示任务数量
- 支持 WIP (Work In Progress) 限制

### 组件设计

**CollapsibleColumn** - 可折叠列:

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

### CSS 支持

```css
.writing-mode-vertical {
  writing-mode: vertical-rl;
  text-orientation: mixed;
}
```

---

## F17: 多排序模式

### 功能描述
支持多种排序方式，可保存用户偏好。

### 排序选项

```typescript
export type SortMode = "manual" | "priority" | "dueDate" | "createdAt" | "updatedAt" | "title";

export const SORT_OPTIONS: Array<{ value: SortMode; label: string; icon: string }> = [
  { value: "manual", label: "手动排序", icon: "GripVertical" },
  { value: "priority", label: "按优先级", icon: "Signal" },
  { value: "dueDate", label: "按截止日期", icon: "Calendar" },
  { value: "createdAt", label: "按创建时间", icon: "Clock" },
  { value: "updatedAt", label: "按更新时间", icon: "RefreshCw" },
  { value: "title", label: "按标题", icon: "ArrowDownAZ" },
];
```

### 组件设计

**SortModeSelect**:

```tsx
interface SortModeSelectProps {
  value: SortMode;
  direction: "asc" | "desc";
  onChange: (mode: SortMode, direction: "asc" | "desc") => void;
}
```

---

## F18: 键盘导航

### 快捷键设计

| 快捷键 | 功能 |
|--------|------|
| `↑/↓` | 在列内导航任务 |
| `←/→` | 切换列 |
| `Enter` | 打开任务详情 |
| `Space` | 切换选中 |
| `n` | 新建任务 |
| `e` | 编辑当前任务 |
| `d` | 删除当前任务 |
| `1-5` | 设置优先级 |
| `Esc` | 取消选中/关闭面板 |

### Hook 设计

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
  // 实现键盘导航逻辑
}
```

---

## F19: 命令面板

### 功能描述
Cmd+K 打开命令面板，快速执行操作。

### 命令分类

1. **导航命令**: 跳转到任务、跳转到列
2. **操作命令**: 创建任务、批量操作
3. **视图命令**: 切换视图、筛选
4. **设置命令**: 打开设置、帮助

### 组件设计

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

## F21: 统计面板

### 功能描述
显示看板统计信息。

### 统计指标

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

### 组件设计

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

## 实现顺序

### Phase 3A (并行)

| Task ID | 功能 | 依赖 |
|---------|------|------|
| T14 | 快速任务创建 | 无 |
| T15 | 内联任务编辑 | 无 |
| T16 | 列折叠/展开 | 无 |
| T17 | 多排序模式 | 无 |

### Phase 3B (并行，依赖 3A)

| Task ID | 功能 | 依赖 |
|---------|------|------|
| T18 | 键盘导航 | T14, T15 |
| T19 | 命令面板 | 无 |
| T20 | 拖拽优化 | T16 |

### Phase 3C (依赖 3B)

| Task ID | 功能 | 依赖 |
|---------|------|------|
| T21 | 统计面板 | 无 |
| T22 | 集成到 Desktop | T14-T21 |

---

## 验收标准

### F14: 快速任务创建
- [ ] 点击 + 按钮展开输入框
- [ ] Enter 提交，Esc 取消
- [ ] 支持快捷键 n 创建

### F15: 内联任务编辑
- [ ] 双击标题进入编辑
- [ ] Enter 保存，Esc 取消
- [ ] 不影响卡片点击事件

### F16: 列折叠/展开
- [ ] 点击折叠按钮收起列
- [ ] 折叠状态显示标题和数量
- [ ] WIP 超限显示警告

### F17: 多排序模式
- [ ] 支持 6 种排序模式
- [ ] 支持升序/降序切换
- [ ] 保存用户偏好

---

**Last Updated**: 2026-02-07
**Version**: 1.0.0
**Status**: 📝 Specification
