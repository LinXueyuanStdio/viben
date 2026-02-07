# Kanban Phase 6: UI Polish & Layout Fixes

## Overview
Fix UI issues in the desktop workspace kanban based on user screenshot feedback and vibe-kanban reference.

## Issues Identified from Screenshot

### Issue 1: Right Detail Panel Too Narrow
**Problem**: Task detail panel is truncated, content like "研究vibe-kanb..." shows incompletely
**Solution**: Increase default panel size from 30% to 40%, and decrease minSize from 20% to 25%

**Location**: `apps/desktop/src/pages/workspace-kanban.tsx` line 992
```tsx
<Panel id="task-detail" defaultSize={30} minSize={20} maxSize={50}>
// Change to:
<Panel id="task-detail" defaultSize={40} minSize={25} maxSize={60}>
```

### Issue 2: Duplicate Column Headers
**Problem**: Screenshot shows two rows of column headers - one with counts/collapse buttons (待办 0 «, 进行中 0 «) and another simpler row below (待办 +, 进行中 +)
**Root Cause**: The StatisticsPanel or some collapsed state view is showing column summary, while KanbanHeader shows the actual column headers

**Solution**: The collapsed columns feature (Phase 3) may be conflicting. Need to review and fix the StatisticsPanel integration.

### Issue 3: Redundant "添加任务" Buttons
**Problem**: Multiple "添加任务" buttons appear per column
**Solution**: Ensure only one add task button per column (in KanbanHeader)

### Issue 4: Filter Bar Layout Issues
**Problem**: Priority dropdown looks isolated, Stats button exists
**Solution**: Improve toolbar layout, ensure Stats button integrates well

### Issue 5: Column Collapse State Confusion
**Problem**: The << buttons suggest collapsible columns but the UI seems inconsistent
**Solution**: Either remove the collapse buttons or properly implement column collapse

## Feature Specifications

### F41: Detail Panel Size Optimization
- Increase defaultSize from 30 to 40
- Increase minSize from 20 to 25
- Increase maxSize from 50 to 60
- Ensure panel content doesn't truncate

### F42: Remove Duplicate Headers
- Check if StatisticsPanel or collapsible columns are causing duplication
- Ensure only one header row per column
- Remove or fix the count/collapse summary row

### F43: Consolidate Add Task Buttons
- Only show + button in KanbanHeader
- Remove any duplicate add task buttons

### F44: Toolbar Cleanup
- Review Stats button placement
- Ensure filter bar elements are well-spaced
- Make toolbar more compact

### F45: Column Collapse Cleanup
- Review column collapse feature implementation
- Either fix it properly or remove it
- Ensure consistent UX

## Files to Modify
1. `apps/desktop/src/pages/workspace-kanban.tsx` - Panel sizes, toolbar, headers
2. Check for StatisticsPanel component usage

## Success Criteria
- Right panel shows full content without truncation
- No duplicate column headers
- Single add task button per column
- Clean, uncluttered toolbar
- Builds pass without errors
