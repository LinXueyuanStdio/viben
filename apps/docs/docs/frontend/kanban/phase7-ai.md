---
sidebar_position: 8
title: Phase 7 - 布局修复
description: Kanban 关键布局修复
---

# Kanban Phase 7: Critical Layout Fixes

## Issues from Screenshot

### Issue 1: Right Detail Panel Too Narrow
**Problem**: When clicking a task, the detail panel is extremely narrow. Title "研究 vibe-kanban" breaks character-by-character vertically.

**Root Cause**:
- Kanban board panel has `defaultSize={isPanelOpen ? 70 : 100}`
- Detail panel has `defaultSize={40}`
- Total would be 110%, so detail panel gets squeezed

**Solution**: Change board panel to `defaultSize={isPanelOpen ? 60 : 100}` so detail gets full 40%.

### Issue 2: Collapsed Columns Not Fully Collapsed
**Problem**: Collapsed columns (待办, 进行中) still take ~200px width each.

**Root Cause**:
- `KanbanProvider` uses CSS grid with `gridAutoColumns: "minmax(200px, 400px)"`
- This forces ALL children to be minimum 200px
- CollapsibleColumn's `w-12` (48px) is overridden by grid

**Solution**: CollapsibleColumn when collapsed should NOT be inside the grid, OR the grid should respect collapsed column width.

**Best approach**: Move collapsed columns outside the grid OR use flexbox instead of grid.

## Implementation Plan

### F46: Fix Panel Size Distribution
- Change kanban board `defaultSize` from 70 to 60 when panel is open
- This gives detail panel the full 40% it needs

### F47: Fix Collapsed Column Width
- Modify KanbanProvider to use flexbox instead of grid
- OR wrap CollapsibleColumn to handle collapsed state outside grid
- Collapsed columns should be exactly 48px (w-12)

### F48: Ensure Detail Panel Content Fits
- Verify title and properties display correctly in 40% width panel

## Files to Modify
1. `apps/desktop/src/pages/workspace-kanban.tsx` - Panel sizes
2. `packages/kanban/src/kanban.tsx` - Grid to flexbox for proper collapsed support

## Success Criteria
- Detail panel shows full content without character-by-character wrapping
- Collapsed columns are exactly 48px wide
- Expanded columns still have proper min/max width
