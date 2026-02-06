# @viben/kanban - Kanban 核心组件包规格

> 封装可复用的 Kanban 看板 UI 组件，不含业务逻辑。

---

## Overview

| Attribute | Value |
|-----------|-------|
| Package Name | `@viben/kanban` |
| Priority | P1 |
| Dependencies | `@viben/ui`, `@dnd-kit/*` |
| Status | 📝 Specification |

---

## 设计原则

1. **零业务逻辑** - 只包含 UI 组件，不包含 API 调用、状态管理
2. **高度可定制** - 支持自定义卡片渲染、列头渲染
3. **类型安全** - 使用泛型支持自定义数据结构
4. **无障碍** - 支持键盘导航、ARIA 标签
5. **性能优化** - 支持虚拟滚动、优化重渲染

---

## 目录结构

```
packages/kanban/
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── src/
│   ├── index.ts                     # 主导出
│   ├── types.ts                     # 类型定义
│   ├── context.ts                   # React Context
│   ├── constants.ts                 # 常量
│   │
│   ├── components/
│   │   ├── index.ts
│   │   ├── kanban-provider.tsx      # DnD 上下文提供者
│   │   ├── kanban-board.tsx         # 看板容器
│   │   ├── kanban-column.tsx        # 单列组件
│   │   ├── kanban-column-header.tsx # 列头
│   │   ├── kanban-card.tsx          # 卡片 (可拖拽)
│   │   ├── kanban-card-content.tsx  # 卡片内容 (默认实现)
│   │   └── kanban-add-card.tsx      # 添加卡片按钮
│   │
│   ├── primitives/
│   │   ├── index.ts
│   │   ├── priority-icon.tsx        # 优先级图标
│   │   ├── assignee-avatar.tsx      # 指派人头像
│   │   ├── due-date-badge.tsx       # 截止日期徽章
│   │   └── tag-badge.tsx            # 标签徽章
│   │
│   └── hooks/
│       ├── index.ts
│       ├── use-kanban.ts            # Kanban 上下文 hook
│       └── use-drag-handle.ts       # 拖拽手柄 hook
│
└── README.md
```

---

## 类型定义

### src/types.ts

```typescript
import type { DragEndEvent } from "@dnd-kit/core";

// ============================================
// Core Types - 核心类型
// ============================================

/**
 * 看板状态标识
 */
export type KanbanStatus = string;

/**
 * 优先级等级
 */
export type KanbanPriority = "low" | "medium" | "high" | "urgent";

/**
 * 优先级配置
 */
export interface PriorityConfig {
  value: KanbanPriority;
  label: string;
  color: string;
  icon?: string;
}

/**
 * 默认优先级配置
 */
export const DEFAULT_PRIORITIES: PriorityConfig[] = [
  { value: "low", label: "低", color: "#6B7280" },
  { value: "medium", label: "中", color: "#3B82F6" },
  { value: "high", label: "高", color: "#F59E0B" },
  { value: "urgent", label: "紧急", color: "#EF4444" },
];

// ============================================
// Column Types - 列类型
// ============================================

/**
 * 看板列配置
 */
export interface KanbanColumnConfig {
  /** 唯一标识 */
  id: string;
  /** 对应的状态值 */
  status: KanbanStatus;
  /** 显示标题 */
  title: string;
  /** 主题色 */
  color?: string;
  /** 排序序号 */
  order: number;
  /** 是否可折叠 */
  collapsible?: boolean;
  /** 默认折叠状态 */
  defaultCollapsed?: boolean;
  /** WIP 限制 (最大任务数) */
  maxItems?: number;
  /** 是否隐藏 */
  hidden?: boolean;
}

// ============================================
// Item Types - 项目类型
// ============================================

/**
 * 看板项目 (通用基类)
 * @template TMetadata 扩展元数据类型
 */
export interface KanbanItem<TMetadata = Record<string, unknown>> {
  /** 唯一标识 */
  id: string;
  /** 标题 */
  title: string;
  /** 描述 (支持 Markdown) */
  description?: string;
  /** 当前状态 */
  status: KanbanStatus;
  /** 优先级 */
  priority?: KanbanPriority;
  /** 列内排序序号 */
  order: number;
  /** 扩展元数据 */
  metadata?: TMetadata;
}

// ============================================
// Event Types - 事件类型
// ============================================

/**
 * 拖拽结果
 */
export interface KanbanDragResult {
  /** 被拖拽项目 ID */
  itemId: string;
  /** 源列 ID */
  sourceColumnId: string;
  /** 源列内位置 */
  sourceIndex: number;
  /** 目标列 ID */
  targetColumnId: string;
  /** 目标列内位置 */
  targetIndex: number;
  /** 计算后的新排序值 */
  newOrder: number;
}

/**
 * 看板事件回调集合
 * @template TItem 项目类型
 */
export interface KanbanCallbacks<TItem extends KanbanItem = KanbanItem> {
  /** 项目移动 (拖拽完成) */
  onItemMove?: (result: KanbanDragResult) => void | Promise<void>;
  /** 创建项目 */
  onItemCreate?: (columnId: string, item: Partial<TItem>) => void | Promise<void>;
  /** 更新项目 */
  onItemUpdate?: (item: TItem) => void | Promise<void>;
  /** 删除项目 */
  onItemDelete?: (itemId: string) => void | Promise<void>;
  /** 点击项目 */
  onItemClick?: (item: TItem) => void;
  /** 双击项目 */
  onItemDoubleClick?: (item: TItem) => void;
  /** 列折叠状态变化 */
  onColumnCollapse?: (columnId: string, collapsed: boolean) => void;
  /** 添加按钮点击 */
  onAddClick?: (columnId: string) => void;
}

// ============================================
// Config Types - 配置类型
// ============================================

/**
 * 看板全局配置
 */
export interface KanbanConfig {
  /** 允许跨列拖拽 */
  allowCrossColumnDrag?: boolean;
  /** 允许列内重排序 */
  allowReorder?: boolean;
  /** 显示添加卡片按钮 */
  showAddCard?: boolean;
  /** 只读模式 */
  readonly?: boolean;
  /** 虚拟滚动阈值 (项目数超过此值启用) */
  virtualizeThreshold?: number;
  /** 列最小宽度 */
  columnMinWidth?: number;
  /** 列最大宽度 */
  columnMaxWidth?: number;
  /** 卡片间距 */
  cardGap?: number;
}

/**
 * 默认配置
 */
export const DEFAULT_CONFIG: KanbanConfig = {
  allowCrossColumnDrag: true,
  allowReorder: true,
  showAddCard: true,
  readonly: false,
  virtualizeThreshold: 100,
  columnMinWidth: 280,
  columnMaxWidth: 400,
  cardGap: 8,
};

// ============================================
// Component Props - 组件属性
// ============================================

/**
 * KanbanProvider 属性
 */
export interface KanbanProviderProps {
  children: React.ReactNode;
  config?: KanbanConfig;
}

/**
 * KanbanBoard 属性
 * @template TItem 项目类型
 */
export interface KanbanBoardProps<TItem extends KanbanItem = KanbanItem> {
  /** 列配置列表 */
  columns: KanbanColumnConfig[];
  /** 项目列表 */
  items: TItem[];
  /** 事件回调 */
  callbacks?: KanbanCallbacks<TItem>;
  /** 全局配置 */
  config?: KanbanConfig;
  /** 自定义类名 */
  className?: string;
  /** 自定义卡片渲染 */
  renderCard?: (item: TItem, isDragging: boolean) => React.ReactNode;
  /** 自定义列头渲染 */
  renderColumnHeader?: (column: KanbanColumnConfig, itemCount: number) => React.ReactNode;
  /** 自定义添加按钮渲染 */
  renderAddCard?: (columnId: string) => React.ReactNode;
  /** 空状态渲染 */
  renderEmpty?: (column: KanbanColumnConfig) => React.ReactNode;
}

/**
 * KanbanColumn 属性
 */
export interface KanbanColumnProps<TItem extends KanbanItem = KanbanItem> {
  column: KanbanColumnConfig;
  items: TItem[];
  callbacks?: KanbanCallbacks<TItem>;
  config?: KanbanConfig;
  renderCard?: (item: TItem, isDragging: boolean) => React.ReactNode;
  renderColumnHeader?: (column: KanbanColumnConfig, itemCount: number) => React.ReactNode;
  renderAddCard?: (columnId: string) => React.ReactNode;
  renderEmpty?: (column: KanbanColumnConfig) => React.ReactNode;
}

/**
 * KanbanColumnHeader 属性
 */
export interface KanbanColumnHeaderProps {
  column: KanbanColumnConfig;
  itemCount: number;
  isCollapsed?: boolean;
  onCollapseToggle?: () => void;
}

/**
 * KanbanCard 属性
 */
export interface KanbanCardProps<TItem extends KanbanItem = KanbanItem> {
  item: TItem;
  isDragging?: boolean;
  isOverlay?: boolean;
  onClick?: () => void;
  onDoubleClick?: () => void;
  children?: React.ReactNode;
}

/**
 * KanbanCardContent 属性 (默认卡片内容)
 */
export interface KanbanCardContentProps<TItem extends KanbanItem = KanbanItem> {
  item: TItem;
  showPriority?: boolean;
  showDescription?: boolean;
  maxDescriptionLines?: number;
}

/**
 * KanbanAddCard 属性
 */
export interface KanbanAddCardProps {
  columnId: string;
  onClick?: () => void;
  label?: string;
}

// ============================================
// Primitives Props - 原语组件属性
// ============================================

/**
 * PriorityIcon 属性
 */
export interface PriorityIconProps {
  priority: KanbanPriority;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}

/**
 * AssigneeAvatar 属性
 */
export interface AssigneeAvatarProps {
  name: string;
  avatarUrl?: string;
  size?: "sm" | "md" | "lg";
  showName?: boolean;
  className?: string;
}

/**
 * DueDateBadge 属性
 */
export interface DueDateBadgeProps {
  dueDate: string | Date;
  showIcon?: boolean;
  className?: string;
}

/**
 * TagBadge 属性
 */
export interface TagBadgeProps {
  tag: string;
  color?: string;
  onRemove?: () => void;
  className?: string;
}

// ============================================
// Context Types - 上下文类型
// ============================================

/**
 * Kanban 上下文值
 */
export interface KanbanContextValue {
  config: KanbanConfig;
  activeId: string | null;
  overId: string | null;
}
```

---

## 核心组件实现

### KanbanProvider

```tsx
// src/components/kanban-provider.tsx
import * as React from "react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { KanbanContext } from "../context";
import type { KanbanProviderProps, KanbanConfig } from "../types";
import { DEFAULT_CONFIG } from "../types";

export function KanbanProvider({
  children,
  config = DEFAULT_CONFIG,
}: KanbanProviderProps) {
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [overId, setOverId] = React.useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = React.useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragOver = React.useCallback((event: DragOverEvent) => {
    setOverId(event.over?.id as string | null);
  }, []);

  const handleDragEnd = React.useCallback(() => {
    setActiveId(null);
    setOverId(null);
  }, []);

  const handleDragCancel = React.useCallback(() => {
    setActiveId(null);
    setOverId(null);
  }, []);

  const contextValue = React.useMemo(
    () => ({
      config: { ...DEFAULT_CONFIG, ...config },
      activeId,
      overId,
    }),
    [config, activeId, overId]
  );

  return (
    <KanbanContext.Provider value={contextValue}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        {children}
      </DndContext>
    </KanbanContext.Provider>
  );
}

KanbanProvider.displayName = "KanbanProvider";
```

### KanbanBoard

```tsx
// src/components/kanban-board.tsx
import * as React from "react";
import { DragOverlay } from "@dnd-kit/core";
import { cn } from "@viben/ui";
import { KanbanProvider } from "./kanban-provider";
import { KanbanColumn } from "./kanban-column";
import { KanbanCard } from "./kanban-card";
import { useKanban } from "../hooks/use-kanban";
import type { KanbanBoardProps, KanbanItem, KanbanDragResult } from "../types";

export function KanbanBoard<TItem extends KanbanItem = KanbanItem>({
  columns,
  items,
  callbacks,
  config,
  className,
  renderCard,
  renderColumnHeader,
  renderAddCard,
  renderEmpty,
}: KanbanBoardProps<TItem>) {
  const { activeId, config: mergedConfig } = useKanban();

  // Group items by column status
  const itemsByColumn = React.useMemo(() => {
    const grouped = new Map<string, TItem[]>();

    columns.forEach((col) => {
      grouped.set(col.id, []);
    });

    items.forEach((item) => {
      const column = columns.find((c) => c.status === item.status);
      if (column) {
        const columnItems = grouped.get(column.id) || [];
        columnItems.push(item);
        grouped.set(column.id, columnItems);
      }
    });

    // Sort items within each column by order
    grouped.forEach((columnItems, columnId) => {
      columnItems.sort((a, b) => a.order - b.order);
    });

    return grouped;
  }, [columns, items]);

  // Find active item for drag overlay
  const activeItem = React.useMemo(() => {
    if (!activeId) return null;
    return items.find((item) => item.id === activeId) || null;
  }, [activeId, items]);

  // Filter visible columns
  const visibleColumns = React.useMemo(
    () => columns.filter((col) => !col.hidden).sort((a, b) => a.order - b.order),
    [columns]
  );

  return (
    <KanbanProvider config={config}>
      <div
        className={cn(
          "flex gap-4 overflow-x-auto p-4",
          "min-h-[500px]",
          className
        )}
      >
        {visibleColumns.map((column) => (
          <KanbanColumn
            key={column.id}
            column={column}
            items={itemsByColumn.get(column.id) || []}
            callbacks={callbacks}
            config={mergedConfig}
            renderCard={renderCard}
            renderColumnHeader={renderColumnHeader}
            renderAddCard={renderAddCard}
            renderEmpty={renderEmpty}
          />
        ))}
      </div>

      <DragOverlay>
        {activeItem ? (
          <KanbanCard item={activeItem} isOverlay>
            {renderCard ? (
              renderCard(activeItem, true)
            ) : (
              <KanbanCardContent item={activeItem} />
            )}
          </KanbanCard>
        ) : null}
      </DragOverlay>
    </KanbanProvider>
  );
}

KanbanBoard.displayName = "KanbanBoard";
```

### KanbanColumn

```tsx
// src/components/kanban-column.tsx
import * as React from "react";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { cn, ScrollArea } from "@viben/ui";
import { KanbanColumnHeader } from "./kanban-column-header";
import { KanbanCard } from "./kanban-card";
import { KanbanCardContent } from "./kanban-card-content";
import { KanbanAddCard } from "./kanban-add-card";
import type { KanbanColumnProps, KanbanItem } from "../types";

export function KanbanColumn<TItem extends KanbanItem = KanbanItem>({
  column,
  items,
  callbacks,
  config,
  renderCard,
  renderColumnHeader,
  renderAddCard,
  renderEmpty,
}: KanbanColumnProps<TItem>) {
  const [isCollapsed, setIsCollapsed] = React.useState(
    column.defaultCollapsed ?? false
  );

  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    data: {
      type: "column",
      column,
    },
  });

  const itemIds = React.useMemo(() => items.map((item) => item.id), [items]);

  const handleCollapseToggle = React.useCallback(() => {
    const newCollapsed = !isCollapsed;
    setIsCollapsed(newCollapsed);
    callbacks?.onColumnCollapse?.(column.id, newCollapsed);
  }, [isCollapsed, column.id, callbacks]);

  const handleAddClick = React.useCallback(() => {
    callbacks?.onAddClick?.(column.id);
  }, [column.id, callbacks]);

  const isOverLimit = column.maxItems
    ? items.length >= column.maxItems
    : false;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col rounded-xl bg-muted/50",
        "min-w-[280px] max-w-[400px] w-[320px]",
        "border border-transparent",
        isOver && "border-primary/50 bg-primary/5",
        isCollapsed && "w-[60px] min-w-[60px]"
      )}
      style={{
        minWidth: config?.columnMinWidth,
        maxWidth: config?.columnMaxWidth,
      }}
    >
      {/* Column Header */}
      {renderColumnHeader ? (
        renderColumnHeader(column, items.length)
      ) : (
        <KanbanColumnHeader
          column={column}
          itemCount={items.length}
          isCollapsed={isCollapsed}
          onCollapseToggle={column.collapsible ? handleCollapseToggle : undefined}
        />
      )}

      {/* Column Content */}
      {!isCollapsed && (
        <ScrollArea className="flex-1">
          <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
            <div
              className={cn(
                "flex flex-col gap-2 p-2",
                "min-h-[200px]"
              )}
              style={{ gap: config?.cardGap }}
            >
              {items.length === 0 ? (
                renderEmpty ? (
                  renderEmpty(column)
                ) : (
                  <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                    暂无任务
                  </div>
                )
              ) : (
                items.map((item) => (
                  <KanbanCard
                    key={item.id}
                    item={item}
                    onClick={() => callbacks?.onItemClick?.(item)}
                    onDoubleClick={() => callbacks?.onItemDoubleClick?.(item)}
                  >
                    {renderCard ? (
                      renderCard(item, false)
                    ) : (
                      <KanbanCardContent item={item} />
                    )}
                  </KanbanCard>
                ))
              )}
            </div>
          </SortableContext>

          {/* Add Card Button */}
          {config?.showAddCard && !config?.readonly && !isOverLimit && (
            renderAddCard ? (
              renderAddCard(column.id)
            ) : (
              <KanbanAddCard columnId={column.id} onClick={handleAddClick} />
            )
          )}

          {/* WIP Limit Warning */}
          {isOverLimit && (
            <div className="px-2 pb-2">
              <div className="rounded-lg bg-destructive/10 p-2 text-xs text-destructive">
                已达到 WIP 限制 ({column.maxItems})
              </div>
            </div>
          )}
        </ScrollArea>
      )}
    </div>
  );
}

KanbanColumn.displayName = "KanbanColumn";
```

### KanbanCard

```tsx
// src/components/kanban-card.tsx
import * as React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn, Card } from "@viben/ui";
import type { KanbanCardProps, KanbanItem } from "../types";

export function KanbanCard<TItem extends KanbanItem = KanbanItem>({
  item,
  isDragging,
  isOverlay,
  onClick,
  onDoubleClick,
  children,
}: KanbanCardProps<TItem>) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({
    id: item.id,
    data: {
      type: "item",
      item,
    },
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const dragging = isDragging || isSortableDragging;

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(
        "cursor-grab select-none",
        "transition-all duration-200",
        "hover:border-primary/30 hover:shadow-md",
        dragging && "opacity-50 shadow-lg rotate-2",
        isOverlay && "shadow-xl rotate-3 cursor-grabbing"
      )}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      {...attributes}
      {...listeners}
    >
      {children}
    </Card>
  );
}

KanbanCard.displayName = "KanbanCard";
```

---

## 原语组件

### PriorityIcon

```tsx
// src/primitives/priority-icon.tsx
import * as React from "react";
import {
  AlertCircle,
  ArrowUp,
  ArrowRight,
  ArrowDown,
} from "lucide-react";
import { cn } from "@viben/ui";
import type { PriorityIconProps, KanbanPriority } from "../types";

const priorityConfig: Record<
  KanbanPriority,
  { icon: React.ElementType; color: string; label: string }
> = {
  urgent: { icon: AlertCircle, color: "text-red-500", label: "紧急" },
  high: { icon: ArrowUp, color: "text-orange-500", label: "高" },
  medium: { icon: ArrowRight, color: "text-blue-500", label: "中" },
  low: { icon: ArrowDown, color: "text-gray-500", label: "低" },
};

const sizeClasses = {
  sm: "h-3 w-3",
  md: "h-4 w-4",
  lg: "h-5 w-5",
};

export function PriorityIcon({
  priority,
  size = "md",
  showLabel = false,
  className,
}: PriorityIconProps) {
  const config = priorityConfig[priority];
  const Icon = config.icon;

  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      <Icon className={cn(sizeClasses[size], config.color)} />
      {showLabel && (
        <span className={cn("text-xs", config.color)}>{config.label}</span>
      )}
    </span>
  );
}

PriorityIcon.displayName = "PriorityIcon";
```

---

## 配置文件

### package.json

```json
{
  "name": "@viben/kanban",
  "version": "1.0.0",
  "description": "Viben Kanban board components",
  "main": "dist/index.js",
  "module": "dist/index.mjs",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.mjs",
      "require": "./dist/index.js"
    },
    "./primitives": {
      "types": "./dist/primitives/index.d.ts",
      "import": "./dist/primitives/index.mjs",
      "require": "./dist/primitives/index.js"
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "typecheck": "tsc --noEmit",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "@dnd-kit/core": "^6.3.1",
    "@dnd-kit/sortable": "^10.0.0",
    "@dnd-kit/utilities": "^3.2.2"
  },
  "peerDependencies": {
    "@viben/ui": "workspace:*",
    "lucide-react": ">=0.400.0",
    "react": "^18.0.0 || ^19.0.0",
    "react-dom": "^18.0.0 || ^19.0.0"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "tsup": "^8.3.5",
    "typescript": "^5.7.0"
  }
}
```

### tsup.config.ts

```ts
import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: ["src/index.ts"],
    format: ["cjs", "esm"],
    dts: true,
    splitting: false,
    sourcemap: true,
    clean: true,
    external: ["react", "react-dom", "@viben/ui", "lucide-react"],
    treeshake: true,
  },
  {
    entry: ["src/primitives/index.ts"],
    outDir: "dist/primitives",
    format: ["cjs", "esm"],
    dts: true,
    splitting: false,
    sourcemap: true,
    external: ["react", "react-dom", "@viben/ui", "lucide-react"],
    treeshake: true,
  },
]);
```

---

## 使用示例

### 基本使用

```tsx
import { KanbanBoard } from "@viben/kanban";
import type { KanbanItem, KanbanColumnConfig } from "@viben/kanban";

const columns: KanbanColumnConfig[] = [
  { id: "todo", status: "todo", title: "待办", color: "#3B82F6", order: 0 },
  { id: "doing", status: "doing", title: "进行中", color: "#F59E0B", order: 1 },
  { id: "done", status: "done", title: "已完成", color: "#10B981", order: 2 },
];

const items: KanbanItem[] = [
  { id: "1", title: "任务 1", status: "todo", order: 0 },
  { id: "2", title: "任务 2", status: "doing", order: 0, priority: "high" },
  { id: "3", title: "任务 3", status: "done", order: 0 },
];

function MyKanban() {
  return (
    <KanbanBoard
      columns={columns}
      items={items}
      callbacks={{
        onItemMove: (result) => {
          console.log("Item moved:", result);
        },
        onItemClick: (item) => {
          console.log("Item clicked:", item);
        },
      }}
    />
  );
}
```

### 自定义卡片

```tsx
import { KanbanBoard } from "@viben/kanban";
import { PriorityIcon, AssigneeAvatar } from "@viben/kanban/primitives";

interface MyTask extends KanbanItem {
  metadata: {
    assignee: string;
    dueDate: string;
  };
}

function MyKanban({ tasks }: { tasks: MyTask[] }) {
  return (
    <KanbanBoard<MyTask>
      columns={columns}
      items={tasks}
      renderCard={(item, isDragging) => (
        <div className="p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-medium">{item.title}</span>
            {item.priority && <PriorityIcon priority={item.priority} />}
          </div>
          {item.metadata.assignee && (
            <AssigneeAvatar name={item.metadata.assignee} size="sm" />
          )}
        </div>
      )}
    />
  );
}
```

---

## 验收标准

- [ ] 拖拽排序功能正常
- [ ] 跨列拖拽功能正常
- [ ] 键盘导航支持
- [ ] 自定义渲染正常工作
- [ ] TypeScript 类型完整
- [ ] 符合 Viben Design System
- [ ] 无业务逻辑耦合
- [ ] 性能：100+ 任务不卡顿

---

**Last Updated**: 2026-02-06
**Version**: 1.0.0
**Status**: 📝 Specification
