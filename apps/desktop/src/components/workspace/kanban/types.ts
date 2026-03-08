/**
 * Types for the workspace kanban component
 *
 * This file contains type definitions extracted from workspace-kanban.tsx
 * for better organization and reusability.
 */

import type {
  TaskWithAttemptStatus,
  KanbanColumnId,
  ExecutionPhase as VibeExecutionPhase,
  ReviewReason as VibeReviewReason,
  Subtask,
} from "@/lib/vibe-kanban";
import type {
  IssuePriority,
  Tag,
  Assignee,
  KanbanFilter,
  ViewMode,
  SortMode,
  SortDirection,
  DragEndEvent,
  TaskCategory,
  TaskComplexity,
  TaskImpact,
} from "@viben/kanban";

// ============================================
// Enhanced Task Types
// ============================================

/**
 * Enhanced task type with all UI-specific fields
 *
 * Extends TaskWithAttemptStatus with additional fields for rich UI display.
 * Based on Auto-Claude style task metadata.
 */
export interface EnhancedTask extends TaskWithAttemptStatus {
  // Core kanban fields (extended for UI display)
  kanbanPriority?: IssuePriority;
  tags?: Tag[];
  kanbanAssignee?: Assignee;
  dueDate?: string;

  // Execution metadata (using mapped names for consistency)
  executionPhase?: VibeExecutionPhase;
  category?: TaskCategory;
  complexity?: TaskComplexity;
  impact?: TaskImpact;
  isStuck?: boolean;
  reviewReason?: VibeReviewReason;
  prUrl?: string;
  archivedAt?: string;
}

// ============================================
// Task Action Interfaces
// ============================================

/**
 * Task action callbacks for card and list item interactions
 */
export interface TaskActions {
  /** Start/queue a task for execution */
  onStart: (taskId: string) => void;
  /** Stop a running task */
  onStop: (taskId: string) => void;
  /** Recover a stuck task */
  onRecover: (taskId: string) => void;
  /** Resume a failed/incomplete task */
  onResume: (taskId: string) => void;
  /** Archive a completed task */
  onArchive: (taskId: string) => void;
  /** Delete a task */
  onDelete: (taskId: string) => void;
  /** Duplicate a task */
  onDuplicate: (taskId: string) => void;
  /** Move task to a specific column */
  onMoveToColumn: (taskId: string, columnId: KanbanColumnId) => void;
  /** Update task title inline */
  onTitleChange: (taskId: string, title: string) => void;
  /** Open PR URL in browser */
  onViewPR: (prUrl: string) => void;
  /** Bulk delete multiple tasks */
  bulkDelete: (taskIds: string[]) => void;
  /** Bulk change status for multiple tasks */
  bulkStatusChange: (taskIds: string[], status: string) => void;
  /** Queue all specified tasks */
  queueAll: (taskIds: string[]) => Promise<void>;
}

// ============================================
// Column State Types
// ============================================

/**
 * Column state for kanban board
 */
export interface ColumnState {
  /** Column identifier */
  id: KanbanColumnId;
  /** Display name (translated) */
  name: string;
  /** Full CSS color value */
  color: string;
  /** CSS variable name for color */
  colorVar: string;
  /** Tasks in this column */
  tasks: EnhancedTask[];
  /** Whether column is collapsed */
  isCollapsed: boolean;
  /** Whether column width is locked */
  isLocked: boolean;
  /** Column width in pixels */
  width: number;
}

// ============================================
// Drag and Drop Types
// ============================================

/**
 * Drag and drop state for kanban board
 *
 * Note: handleDragEnd uses the DragEndEvent type from @dnd-kit/core via @viben/kanban
 */
export interface DragDropState {
  /** Currently dragging task ID */
  draggingTaskId: string | null;
  /** Valid drop target column IDs for current drag */
  validDropTargets: KanbanColumnId[];
  /** Called when drag starts */
  handleDragStart: (activeId: string) => void;
  /**
   * Called when drag ends
   * @param event - DragEndEvent from @dnd-kit/core (re-exported by @viben/kanban)
   */
  handleDragEnd: (event: DragEndEvent) => void;
  /** Called when drag is cancelled */
  handleDragCancel: () => void;
}

// ============================================
// Column Management Types
// ============================================

/**
 * Column collapse and resize management
 */
export interface ColumnManagement {
  /** Check if column is collapsed */
  isCollapsed: (columnId: string) => boolean;
  /** Toggle column collapsed state */
  toggleCollapse: (columnId: string, collapsed?: boolean) => void;
  /** Expand all columns */
  expandAll: () => void;
  /** Count of collapsed columns */
  collapsedCount: number;
  /** Get column width */
  getWidth: (columnId: string) => number;
  /** Start column resize */
  startResize: (columnId: string, startX: number) => void;
  /** Currently resizing column ID */
  isResizing: string | null;
  /** Check if column is locked */
  isLocked: (columnId: string) => boolean;
  /** Toggle column lock state */
  toggleLock: (columnId: string) => void;
  /** Map of collapsed column states */
  collapsedColumns: Record<string, boolean>;
  /** Map of column widths */
  columnWidths: Record<string, number>;
  /** List of locked column IDs */
  lockedColumns: string[];
  /** Reset column width to default */
  resetWidth: (columnId: string) => void;
  /** Reset all column widths to default */
  resetAllWidths: () => void;
}

// ============================================
// Multi-Select Types
// ============================================

/**
 * Multi-select state for bulk operations
 */
export interface MultiSelectState {
  /** Set of selected task IDs */
  selectedIds: Set<string>;
  /** Count of selected tasks */
  selectedCount: number;
  /** Whether selection mode is active */
  isSelecting: boolean;
  /** Toggle selection for a task */
  toggleSelect: (id: string) => void;
  /** Check if task is selected */
  isSelected: (id: string) => boolean;
  /** Select all visible tasks */
  selectAll: () => void;
  /** Clear all selections */
  clearSelection: () => void;
  /** Toggle selection for a subset of tasks */
  toggleSubset: (ids: string[]) => void;
  /** Check if all tasks in subset are selected */
  isSubsetAllSelected: (ids: string[]) => boolean;
  /** Check if some tasks in subset are selected */
  isSubsetSomeSelected: (ids: string[]) => boolean;
}

// ============================================
// Filter and Sort Types
// ============================================

/**
 * Re-export filter types from @viben/kanban for convenience
 */
export type { KanbanFilter, ViewMode, SortMode, SortDirection };

/**
 * Filter state with handlers
 */
export interface FilterState {
  filter: KanbanFilter;
  setFilter: (filter: KanbanFilter) => void;
}

/**
 * Sort state with handlers
 */
export interface SortState {
  sortMode: SortMode;
  sortDirection: SortDirection;
  setSortMode: (mode: SortMode) => void;
  setSortDirection: (direction: SortDirection) => void;
}

// ============================================
// Task Card Props Types
// ============================================

/**
 * Props for TaskCardContent component
 */
export interface TaskCardContentProps {
  task: EnhancedTask;
  onTitleChange?: (title: string) => void;
  onStart?: () => void;
  onStop?: () => void;
  onRecover?: () => void;
  onResume?: () => void;
  onViewPR?: () => void;
  onArchive?: () => void;
  isSelected?: boolean;
}

/**
 * Props for TaskCardWithStuckDetection wrapper
 */
export interface TaskCardWithStuckDetectionProps {
  task: EnhancedTask;
  index: number;
  columnId: string;
  workspacePath: string;
  isSelected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  showMoreMenu?: boolean;
  renderMoreMenu?: (onOpenChange?: (open: boolean) => void) => React.ReactNode;
}

/**
 * Props for ListViewItemWithStuckDetection wrapper
 */
export interface ListViewItemWithStuckDetectionProps {
  task: EnhancedTask;
  workspacePath: string;
  isSelected: boolean;
  onClick: () => void;
  renderStatus?: (task: EnhancedTask) => React.ReactNode;
  children: React.ReactNode;
}

// ============================================
// Queue Management Types
// ============================================

/**
 * Queue status from Gateway API
 */
export interface QueueStatus {
  pending_count: number;
  running_count: number;
  max_concurrency: number;
}

/**
 * Queue settings state
 */
export interface QueueSettingsState {
  maxParallelTasks: number;
  setMaxParallelTasks: (value: number) => void;
  showArchived: boolean;
  toggleShowArchived: () => void;
  archivedTaskIds: string[];
  archiveTask: (taskId: string) => void;
  archiveAllDone: (taskIds: string[]) => void;
  queueStatus: QueueStatus | null;
  fetchQueueStatus: () => Promise<void>;
  isLoadingQueueStatus: boolean;
}

// ============================================
// Re-exports for convenience
// ============================================

export type { DragEndEvent };
export type { Subtask };
export type { KanbanColumnId };
export type { TaskCategory, TaskComplexity, TaskImpact };
export type { IssuePriority, Tag, Assignee };
export type { VibeExecutionPhase, VibeReviewReason };
