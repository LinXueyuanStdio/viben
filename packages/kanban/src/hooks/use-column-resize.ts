import { useState, useCallback, useRef, useEffect } from "react";

export interface ColumnWidths {
  [columnId: string]: number;
}

export interface UseColumnResizeOptions {
  /** Minimum column width in pixels (default: 200) */
  minWidth?: number;
  /** Maximum column width in pixels (default: 600) */
  maxWidth?: number;
  /** Default column width in pixels (default: 280) */
  defaultWidth?: number;
  /** Initial column widths */
  initialWidths?: ColumnWidths;
  /** Callback when width changes */
  onWidthChange?: (columnId: string, width: number) => void;
  /** Locked columns that cannot be resized */
  lockedColumns?: string[];
}

export interface UseColumnResizeReturn {
  /** Current widths for each column */
  widths: ColumnWidths;
  /** Column ID currently being resized, null if not resizing */
  isResizing: string | null;
  /** Get width for a specific column */
  getWidth: (columnId: string) => number;
  /** Check if a column is locked */
  isLocked: (columnId: string) => boolean;
  /** Start resizing a column */
  startResize: (columnId: string, startX: number) => void;
  /** Reset a column to default width */
  resetWidth: (columnId: string) => void;
  /** Reset all columns to default width */
  resetAllWidths: () => void;
  /** Set locked columns */
  setLockedColumns: (columnIds: string[]) => void;
}

export function useColumnResize(
  options: UseColumnResizeOptions = {}
): UseColumnResizeReturn {
  const {
    minWidth = 200,
    maxWidth = 600,
    defaultWidth = 280,
    initialWidths = {},
    onWidthChange,
    lockedColumns: initialLockedColumns = [],
  } = options;

  const [widths, setWidths] = useState<ColumnWidths>(initialWidths);
  const [lockedColumns, setLockedColumns] = useState<string[]>(initialLockedColumns);
  const [isResizing, setIsResizing] = useState<string | null>(null);

  // Track resize state
  const resizeState = useRef<{
    columnId: string;
    startX: number;
    startWidth: number;
  } | null>(null);

  const getWidth = useCallback(
    (columnId: string): number => {
      return widths[columnId] ?? defaultWidth;
    },
    [widths, defaultWidth]
  );

  const isLocked = useCallback(
    (columnId: string): boolean => {
      return lockedColumns.includes(columnId);
    },
    [lockedColumns]
  );

  const startResize = useCallback(
    (columnId: string, startX: number) => {
      if (isLocked(columnId)) return;

      const startWidth = widths[columnId] ?? defaultWidth;
      resizeState.current = { columnId, startX, startWidth };
      setIsResizing(columnId);

      // Prevent text selection during resize
      document.body.style.userSelect = "none";
      document.body.style.cursor = "col-resize";
    },
    [widths, defaultWidth, isLocked]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!resizeState.current) return;

      const { columnId, startX, startWidth } = resizeState.current;
      const deltaX = e.clientX - startX;
      const newWidth = Math.min(maxWidth, Math.max(minWidth, startWidth + deltaX));

      setWidths((prev) => ({
        ...prev,
        [columnId]: newWidth,
      }));

      onWidthChange?.(columnId, newWidth);
    },
    [minWidth, maxWidth, onWidthChange]
  );

  const handleMouseUp = useCallback(() => {
    resizeState.current = null;
    setIsResizing(null);

    // Restore normal cursor and selection
    document.body.style.userSelect = "";
    document.body.style.cursor = "";
  }, []);

  // Set up global mouse event listeners when resizing
  useEffect(() => {
    if (isResizing) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);

      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isResizing, handleMouseMove, handleMouseUp]);

  const resetWidth = useCallback(
    (columnId: string) => {
      setWidths((prev) => {
        const { [columnId]: _, ...rest } = prev;
        return rest;
      });
      onWidthChange?.(columnId, defaultWidth);
    },
    [defaultWidth, onWidthChange]
  );

  const resetAllWidths = useCallback(() => {
    setWidths({});
  }, []);

  return {
    widths,
    isResizing,
    getWidth,
    isLocked,
    startResize,
    resetWidth,
    resetAllWidths,
    setLockedColumns,
  };
}
