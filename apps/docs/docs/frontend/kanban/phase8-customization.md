---
sidebar_position: 9
title: Phase 8 - 精确布局
description: 匹配 vibe-kanban 布局规格
---

# Kanban Phase 8: Match vibe-kanban Layout Exactly

## Reference Implementation
vibe-kanban uses this exact layout in KanbanProvider:
```tsx
<div
  className={cn(
    'inline-grid grid-flow-col auto-cols-[minmax(200px,400px)] divide-x border-x items-stretch min-h-full',
    className
  )}
>
```

Key features:
- `inline-grid` - Grid layout that fits content
- `grid-flow-col` - Columns flow horizontally
- `auto-cols-[minmax(200px,400px)]` - Each column is 200-400px wide
- `items-stretch` - Columns stretch to fill height
- Horizontal scrolling enabled by parent overflow-x-auto

## Current Issues

### Issue 1: Panel Size Not Working
- Board panel: 60%, Detail panel: 40% - but detail panel still tiny
- Need to verify Panel component is correctly splitting space

### Issue 2: Task Cards Too Wide
- Cards expand to fill column width (200-400px is reasonable)
- But our current flexbox layout may not constrain width properly

### Issue 3: No Horizontal Scroll
- Kanban should scroll horizontally when columns exceed viewport
- CSS Grid with inline-grid handles this naturally

## Solution: Revert to vibe-kanban's Exact Layout

### KanbanProvider Changes
Replace current flexbox with vibe-kanban's grid:
```tsx
<div
  className={cn(
    "inline-grid grid-flow-col auto-cols-[minmax(200px,400px)] divide-x border-x items-stretch min-h-full",
    className
  )}
>
```

### KanbanBoard Changes
Remove width constraints (let grid control width):
```tsx
<div
  className={cn(
    "flex min-h-40 flex-col",
    isOver ? "outline-primary" : "outline-black",
    className
  )}
>
```

### CollapsibleColumn Approach
For collapsed columns, we have two options:
1. Don't use CollapsibleColumn - use simpler approach like vibe-kanban
2. Make CollapsibleColumn work with grid by using `col-span` or `grid-column`

Since vibe-kanban doesn't have collapsible columns, we should:
- Remove CollapsibleColumn from desktop kanban
- Use standard KanbanHeader like vibe-kanban

### Panel Sizes
Verify react-resizable-panels is working:
- Board: defaultSize={60}, minSize={40}
- Detail: defaultSize={40}, minSize={25}, maxSize={60}

## Files to Modify
1. `packages/kanban/src/kanban.tsx` - Revert to grid layout
2. `apps/desktop/src/pages/workspace-kanban.tsx` - Remove CollapsibleColumn, use KanbanHeader
