---
sidebar_position: 9
title: Layout Architecture
description: Deep dive into the kanban board layout system and resizable panels
---

# Layout Architecture

> Understanding how the kanban board layout system works, including resizable panels, horizontal scrolling, and the detail panel.

---

## Overview

The kanban layout uses a sophisticated system of nested flex containers and CSS Grid to achieve:

- **Full viewport height** utilization
- **Horizontal scrolling** for kanban columns
- **Resizable panels** for the board and detail view
- **Responsive behavior** across different screen sizes

---

## Architecture Diagram

```
+-----------------------------------------------------------------------------------+
|                              SharedAppLayout (h-screen)                           |
+-----------------------------------------------------------------------------------+
|  +---------+  +----------------------------------------------------------------+  |
|  |         |  |                    flex-col flex-1 min-w-0                     |  |
|  |         |  +----------------------------------------------------------------+  |
|  |         |  |  NavbarContainer (shrink-0)                                    |  |
|  |         |  +----------------------------------------------------------------+  |
|  | AppBar  |  |                                                                |  |
|  | (fixed  |  |  Content Area (flex-1 min-h-0)                                 |  |
|  |  width) |  |  +----------------------------------------------------------+  |  |
|  |         |  |  |                    ProjectKanban                         |  |  |
|  |         |  |  |  +--------------------+---+-------------------------+    |  |  |
|  |         |  |  |  | Panel (kanban-left)|Sep| Panel (kanban-right)    |    |  |  |
|  |         |  |  |  | minSize="20%"      | 1 | 400px-800px             |    |  |  |
|  |         |  |  |  | overflow-hidden    | px| (conditional)           |    |  |  |
|  |         |  |  |  |                    |   |                         |    |  |  |
|  |         |  |  |  | +----------------+ |   | +---------------------+ |    |  |  |
|  |         |  |  |  | |KanbanContainer | |   | |KanbanIssuePanelCont.| |    |  |  |
|  |         |  |  |  | | overflow-x-auto| |   | | overflow-y-auto     | |    |  |  |
|  |         |  |  |  | |                | |   | |                     | |    |  |  |
|  |         |  |  |  | | [Col][Col][Col]| |   | | Issue Detail View   | |    |  |  |
|  |         |  |  |  | |  280px each    | |   | |                     | |    |  |  |
|  |         |  |  |  | +----------------+ |   | +---------------------+ |    |  |  |
|  |         |  |  |  +--------------------+---+-------------------------+    |  |  |
|  |         |  |  +----------------------------------------------------------+  |  |
|  +---------+  +----------------------------------------------------------------+  |
+-----------------------------------------------------------------------------------+
```

---

## Component Hierarchy

```
SharedAppLayout
├── AppBar (fixed sidebar)
└── Content Column (flex-col flex-1 min-w-0)
    ├── NavbarContainer
    └── Content (flex-1 min-h-0)
        └── ProjectKanban
            └── OrgProvider
                └── ProjectKanbanInner
                    └── ProjectProvider
                        └── Group (react-resizable-panels - horizontal)
                            ├── Panel#kanban-left (minSize="20%")
                            │   └── KanbanContainer
                            │       └── div.overflow-x-auto
                            │           └── KanbanProvider (inline-grid)
                            │               └── KanbanBoard (per status)
                            │                   ├── KanbanHeader (sticky)
                            │                   └── KanbanCards (droppable)
                            │                       └── KanbanCard (draggable)
                            ├── Separator (1px width, draggable)
                            └── Panel#kanban-right (400px-800px, conditional)
                                └── KanbanIssuePanelContainer
                                    └── KanbanIssuePanel (overflow-y-auto)
```

---

## Key Implementation Details

### 1. Main Layout Structure

The main layout uses a flex container that fills the full viewport height.

```tsx
<div className="flex h-screen bg-primary">
  <AppBar ... />
  <div className="flex flex-col flex-1 min-w-0">
    <NavbarContainer />
    <div className="flex-1 min-h-0">
      <Outlet />  {/* ProjectKanban renders here */}
    </div>
  </div>
</div>
```

**Key CSS Classes:**

| Class | Purpose |
|-------|---------|
| `h-screen` | Full viewport height |
| `flex-col flex-1` | Vertical flex, takes remaining space |
| `min-w-0` | Allows flex child to shrink below content width |
| `min-h-0` | Allows flex child to shrink below content height |

:::tip Why min-w-0 and min-h-0?
By default, flex items have `min-width: auto` and `min-height: auto`, which prevents them from shrinking below their content size. Setting these to `0` allows proper overflow handling.
:::

---

### 2. Resizable Panel Layout

The kanban board uses `react-resizable-panels` for the split view between the board and detail panel.

```tsx
<Group
  orientation="horizontal"
  className="flex-1 min-w-0 h-full"
  defaultLayout={kanbanDefaultLayout}
  onLayoutChange={onKanbanLayoutChange}
>
  {/* Left Panel - Kanban Board */}
  <Panel
    id="kanban-left"
    minSize="20%"
    className="min-w-0 h-full overflow-hidden bg-primary"
  >
    <KanbanContainer />
  </Panel>

  {/* Separator - Only when panel is open */}
  {isPanelOpen && (
    <Separator
      id="kanban-separator"
      className="w-1 bg-panel hover:bg-brand/50 transition-colors cursor-col-resize"
    />
  )}

  {/* Right Panel - Detail Panel (conditional) */}
  {isPanelOpen && (
    <Panel
      id="kanban-right"
      minSize="400px"
      maxSize="800px"
      className="min-w-0 h-full overflow-hidden bg-secondary"
    >
      <KanbanIssuePanelContainer />
    </Panel>
  )}
</Group>
```

**Panel Configuration:**

| Property | Left Panel | Right Panel |
|----------|------------|-------------|
| minSize | `"20%"` (percentage) | `"400px"` (absolute) |
| maxSize | - | `"800px"` (absolute) |
| className | `min-w-0 h-full overflow-hidden` | `min-w-0 h-full overflow-hidden` |
| Visibility | Always | Conditional (`isPanelOpen`) |

**Layout Persistence:**

```tsx
const [kanbanLeftPanelSize, setKanbanLeftPanelSize] = usePaneSize(
  PERSIST_KEYS.kanbanLeftPanel,
  75  // default: left panel takes 75%
);

const kanbanDefaultLayout: Layout = {
  'kanban-left': kanbanLeftPanelSize,
  'kanban-right': 100 - kanbanLeftPanelSize,
};
```

---

### 3. Horizontal Scrolling Kanban Grid

This is the most critical part of the layout - enabling horizontal scrolling for the kanban columns.

**Container Structure:**

```tsx
<div className="flex-1 overflow-x-auto px-double">
  <KanbanProvider onDragEnd={handleDragEnd}>
    {visibleStatuses.map((status) => (
      <KanbanBoard key={status.id}>
        {/* ... */}
      </KanbanBoard>
    ))}
  </KanbanProvider>
</div>
```

**KanbanProvider Grid:**

```tsx
export const KanbanProvider = ({ children, onDragEnd, className }) => {
  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div
        className={cn(
          'inline-grid grid-flow-col auto-cols-[minmax(200px,400px)] divide-x border-x items-stretch min-h-full',
          className
        )}
      >
        {children}
      </div>
    </DragDropContext>
  );
};
```

**How It Works:**

```
Parent Container:
├── flex-1           → Takes remaining height
├── overflow-x-auto  → ENABLES HORIZONTAL SCROLL
└── px-double        → Horizontal padding

  └── KanbanProvider (inline-grid):
      ├── inline-grid     → Grid shrinks to content width (NOT block-level)
      ├── grid-flow-col   → Items flow into columns (horizontal)
      ├── auto-cols-[minmax(200px,400px)]  → Each column 200-400px
      ├── divide-x        → Vertical dividers between columns
      └── min-h-full      → Full height
```

:::warning Why inline-grid is Critical
- `grid` (block-level) expands to fill parent width, causing no overflow and no scroll
- `inline-grid` (inline-level) shrinks to content width, allowing overflow and scroll
:::

---

### 4. Column Structure

Each kanban column is a vertical flex container.

```tsx
export const KanbanBoard = ({ children, className }) => {
  return (
    <div className={cn('flex flex-col min-h-40', className)}>
      {children}
    </div>
  );
};
```

**Column Header (Sticky):**

```tsx
<KanbanHeader>
  <div className="border-t sticky border-b top-0 z-20 flex shrink-0 items-center justify-between gap-2 p-base bg-secondary">
    <div className="flex items-center gap-2">
      <div
        className="h-2 w-2 rounded-full shrink-0"
        style={{ backgroundColor: `hsl(${status.color})` }}
      />
      <p className="m-0 text-sm">{status.name}</p>
    </div>
    <button onClick={() => handleAddTask(status.id)}>
      <PlusIcon />
    </button>
  </div>
</KanbanHeader>
```

The header uses `sticky top-0 z-20` to remain visible during vertical scrolling within the column.

---

### 5. Cards Container (Droppable)

The cards container is a droppable zone for drag-and-drop.

```tsx
export const KanbanCards = ({ id, children, className }) => (
  <Droppable droppableId={id}>
    {(provided) => (
      <div
        className={cn('flex flex-1 flex-col', className)}
        ref={provided.innerRef}
        {...provided.droppableProps}
      >
        {children}
        {provided.placeholder}
      </div>
    )}
  </Droppable>
);
```

- Uses `@hello-pangea/dnd` for drag-drop functionality
- `flex-1` takes remaining space in column
- `flex-col` stacks cards vertically

---

### 6. Detail Panel

The detail panel shows task information when a card is selected.

```tsx
<div className="flex flex-col h-full overflow-hidden" onKeyDown={handleKeyDown}>
  {/* Header - Fixed at top */}
  <div className="flex items-center justify-between px-base py-half border-b shrink-0">
    {/* Close button, breadcrumb, etc. */}
  </div>

  {/* Scrollable Content */}
  <div className="flex-1 overflow-y-auto">
    {/* Issue details, tabs, etc. */}
  </div>
</div>
```

**Key Pattern:**
- `h-full overflow-hidden` on container
- `shrink-0` on header (fixed height)
- `flex-1 overflow-y-auto` on content (scrollable)

---

## Critical CSS Patterns

### Full Height Chain

Every level must properly pass height to its children:

```
h-screen → flex-col flex-1 min-w-0 → flex-1 min-h-0 → h-full
```

### Horizontal Scroll Kanban

```css
/* Parent */
.scroll-container {
  flex: 1;
  overflow-x: auto;
}

/* Grid */
.kanban-grid {
  display: inline-grid;      /* NOT grid */
  grid-auto-flow: column;
  grid-auto-columns: minmax(200px, 400px);  /* or fixed: 280px */
}
```

### Resizable Panel Constraints

```tsx
// Left panel - flexible (percentage)
<Panel minSize="20%" />

// Right panel - constrained (pixels)
<Panel minSize="400px" maxSize="800px" />
```

### Prevent Flex Overflow

```css
.flex-child {
  min-width: 0;   /* Allow shrinking below content width */
  min-height: 0;  /* Allow shrinking below content height */
}
```

---

## Drag-and-Drop Library

The kanban uses `@hello-pangea/dnd` (a fork of `react-beautiful-dnd`) for drag-and-drop:

| Component | Purpose |
|-----------|---------|
| `DragDropContext` | Provider for drag-drop context |
| `Droppable` | Drop target (each column) |
| `Draggable` | Draggable item (each card) |

---

## Common Issues and Solutions

### Issue: Columns Don't Scroll Horizontally

**Cause:** Using `grid` instead of `inline-grid` on the kanban provider.

**Solution:** Ensure the grid container uses `inline-grid`:

```tsx
<div className="inline-grid grid-flow-col ...">
```

### Issue: Content Overflows Parent Container

**Cause:** Missing `min-w-0` or `min-h-0` on flex children.

**Solution:** Add these classes to flex children that should shrink:

```tsx
<div className="flex-1 min-w-0 h-full overflow-hidden">
```

### Issue: Detail Panel Not Scrolling

**Cause:** Missing `overflow-y-auto` on content area.

**Solution:** Structure the panel with fixed header and scrollable content:

```tsx
<div className="flex flex-col h-full overflow-hidden">
  <header className="shrink-0">...</header>
  <div className="flex-1 overflow-y-auto">...</div>
</div>
```

---

## Related Documentation

- [Kanban Module Overview](./index.md) - Module overview and architecture
- [Features Specification](./features.md) - Core features like priority and tags
- [Integration Guide](./integration.md) - Board integration specification

---

**Last Updated**: 2026-03-28
