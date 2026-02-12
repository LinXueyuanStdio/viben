# Kanban Phase 5: UI Optimization

## Overview
Optimize the desktop workspace kanban UI to match vibe-kanban's polished interface exactly, using our Viben Design System.

## Reference Implementation
- Source: `/Users/lxy/Documents/GitHub/others/vibe-kanban/frontend/src/components`
- Key files: `tasks/TaskKanbanBoard.tsx`, `tasks/TaskCard.tsx`, `tasks/TaskCardHeader.tsx`, `ui/shadcn-io/kanban/index.tsx`

## Feature Specifications

### F34: Column Layout Optimization
**Goal**: Match vibe-kanban's column grid layout and sticky header styling

**Implementation**:
- Use `auto-cols-[minmax(200px,400px)]` for column sizing
- Add `inline-grid grid-flow-col` layout
- Sticky headers with background gradient: `linear-gradient(hsl(var(${color}) / 0.03), hsl(var(${color}) / 0.03))`
- Column separator with `divide-x border-x`
- Proper `min-h-full items-stretch` for full height columns

**Location**: `@viben/kanban` - Update `KanbanProvider` and `KanbanHeader` components

### F35: Card UI Enhancement
**Goal**: Match vibe-kanban card styling with improved typography

**Implementation**:
- Card with `p-3 border-b flex-col space-y-2`
- Title: `font-light text-sm line-clamp-2`
- Description: `text-sm text-secondary-foreground` with 130 char truncation
- Selected card: `ring-2 ring-secondary-foreground ring-inset`
- Dragging state: `cursor-grabbing` with z-index 1000

**Location**: `@viben/kanban` - Update `KanbanCard` component

### F36: Header Component Redesign
**Goal**: Match vibe-kanban's compact header with status dot

**Implementation**:
- Sticky header with `sticky top-0 z-20`
- Status dot indicator: `h-2 w-2 rounded-full` with column color
- Compact add button: `variant="ghost"` with tooltip
- Border style: `border-b border-dashed`
- Background with column color tint

**Location**: `@viben/kanban` - Update `KanbanHeader` component

### F37: TaskCardContent Redesign
**Goal**: Improve desktop card content layout to match vibe-kanban

**Implementation**:
- Header row with avatar + title + action icons
- Title with `line-clamp-2 font-light text-sm`
- Description truncation at 130 characters
- Status indicators (running spinner, failed icon)
- Parent task link button

**Location**: `apps/desktop` - Update `TaskCardContent` component

### F38: Drag System Enhancement
**Goal**: Match vibe-kanban's smooth drag experience

**Implementation**:
- PointerSensor with `activationConstraint: { distance: 8 }`
- `rectIntersection` collision detection
- Custom `restrictToFirstScrollableAncestor` modifier with right padding
- Transform style: `translateX/Y` for smooth movement
- Drop zone highlight: `outline-primary` when `isOver`

**Location**: `@viben/kanban` - Update `KanbanProvider` and drag system

### F39: Empty State Polish
**Goal**: Add polished empty states matching vibe-kanban

**Implementation**:
- Empty column indicator
- "No tasks" card with CTA button
- "No search results" message
- Consistent padding and spacing

**Location**: `apps/desktop` - Add empty state components

### F40: Filter Bar Toolbar Enhancement
**Goal**: Improve toolbar layout and styling

**Implementation**:
- Toolbar with view switcher, separator, filter, separator, sort
- Consistent `h-6 w-px bg-border` separators
- Background: `bg-muted/30` with `border-b`
- Responsive gap and flex-wrap

**Location**: `apps/desktop` - Update filter/sort bar layout

## Build Verification
After all changes:
```bash
pnpm --filter @viben/kanban build
pnpm --filter @viben/desktop typecheck
```

## Files to Modify
1. `packages/kanban/src/kanban.tsx` - Column layout, card, header updates
2. `apps/desktop/src/pages/workspace-kanban.tsx` - TaskCardContent, toolbar, empty states
3. `apps/desktop/src/components/workspace/TaskDetailPanel.tsx` - Panel styling if needed

## Success Criteria
- Column layout matches vibe-kanban exactly
- Cards have proper typography and spacing
- Drag experience is smooth with correct constraints
- Empty states are polished
- All builds pass without errors
