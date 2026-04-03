/**
 * useColumnManagement Hook
 *
 * Integrates column collapse, resize, and lock functionality
 * with persistence via useKanbanPreferences.
 *
 * Extracted from workspace-kanban.tsx to reduce complexity.
 */

import { useEffect, useCallback, useMemo } from "react";
import {
  useKanbanPreferences,
  useColumnCollapse,
  useColumnResize,
  type ColumnWidths,
} from "@viben/kanban";
import type { KanbanColumnId } from "@/lib/kanban";

/**
 * Options for useColumnManagement hook
 */
export interface UseColumnManagementOptions {
  /** Project ID for preference persistence */
  projectId: string;
  /** Array of column IDs in display order */
  columnIds: KanbanColumnId[];
}

/**
 * Return type for useColumnManagement hook
 */
export interface ColumnManagement {
  // Collapse state
  /** Map of column ID to collapsed state */
  collapsedColumns: Record<string, boolean>;
  /** Toggle collapse state for a column */
  toggleCollapse: (columnId: string, collapsed?: boolean) => void;
  /** Expand all columns */
  expandAll: () => void;
  /** Check if a column is collapsed */
  isCollapsed: (columnId: string) => boolean;
  /** Number of currently collapsed columns */
  collapsedCount: number;

  // Resize state
  /** Map of column ID to width */
  columnWidths: ColumnWidths;
  /** Column ID currently being resized, or null */
  isResizing: string | null;
  /** Get width for a specific column */
  getWidth: (columnId: string) => number;
  /** Start resizing a column */
  startResize: (columnId: string, startX: number) => void;
  /** Reset a column to default width */
  resetWidth: (columnId: string) => void;
  /** Reset all columns to default width */
  resetAllWidths: () => void;

  // Lock state
  /** Array of locked column IDs */
  lockedColumns: string[];
  /** Check if a column is locked */
  isLocked: (columnId: string) => boolean;
  /** Toggle lock state for a column */
  toggleLock: (columnId: string) => void;
}

/**
 * Hook to manage kanban column states (collapse, resize, lock)
 * with automatic preference persistence.
 *
 * @example
 * ```tsx
 * const {
 *   collapsedColumns,
 *   toggleCollapse,
 *   isCollapsed,
 *   getWidth,
 *   isLocked,
 *   toggleLock,
 * } = useColumnManagement({
 *   projectId: "my-project",
 *   columnIds: KANBAN_COLUMNS,
 * });
 * ```
 */
export function useColumnManagement(
  options: UseColumnManagementOptions
): ColumnManagement {
  const { projectId, columnIds: _columnIds } = options;

  // Use kanban preferences for persistence
  const { preferences, updatePreference } = useKanbanPreferences({
    projectId,
  });

  // Column collapse state (synced with preferences)
  const {
    collapsedColumns,
    toggleCollapse,
    expandAll,
    isCollapsed,
  } = useColumnCollapse(
    // Initialize from preferences: convert string[] to Record<string, boolean>
    preferences.collapsedColumns.reduce<Record<string, boolean>>(
      (acc, id) => ({ ...acc, [id]: true }),
      {}
    )
  );

  // Sync collapsed columns to preferences when they change
  useEffect(() => {
    const collapsed = Object.entries(collapsedColumns)
      .filter(([_, isCollapsed]) => isCollapsed)
      .map(([id]) => id);

    // Only update if different to avoid infinite loops
    if (JSON.stringify(collapsed) !== JSON.stringify(preferences.collapsedColumns)) {
      updatePreference("collapsedColumns", collapsed);
    }
  }, [collapsedColumns, preferences.collapsedColumns, updatePreference]);

  // Column resize state (synced with preferences)
  const {
    widths: columnWidths,
    isResizing,
    getWidth,
    isLocked,
    startResize,
    resetWidth,
    resetAllWidths,
    setLockedColumns,
  } = useColumnResize({
    minWidth: 200,
    maxWidth: 600,
    defaultWidth: 280,
    initialWidths: preferences.columnWidths,
    lockedColumns: preferences.lockedColumns,
    onWidthChange: (columnId: string, width: number) => {
      // Persist width changes to preferences
      updatePreference("columnWidths", {
        ...preferences.columnWidths,
        [columnId]: width,
      });
    },
  });

  // Toggle column lock
  const toggleLock = useCallback(
    (columnId: string) => {
      const newLocked = preferences.lockedColumns.includes(columnId)
        ? preferences.lockedColumns.filter((id) => id !== columnId)
        : [...preferences.lockedColumns, columnId];

      // Update preferences
      updatePreference("lockedColumns", newLocked);
      // Update resize hook state
      setLockedColumns(newLocked);
    },
    [preferences.lockedColumns, updatePreference, setLockedColumns]
  );

  // Calculate collapsed count
  const collapsedCount = useMemo(
    () => Object.values(collapsedColumns).filter(Boolean).length,
    [collapsedColumns]
  );

  return {
    // Collapse state
    collapsedColumns,
    toggleCollapse,
    expandAll,
    isCollapsed,
    collapsedCount,

    // Resize state
    columnWidths,
    isResizing,
    getWidth,
    startResize,
    resetWidth,
    resetAllWidths,

    // Lock state
    lockedColumns: preferences.lockedColumns,
    isLocked,
    toggleLock,
  };
}
