import { useCallback, useEffect, useRef } from "react";

interface UseKanbanNavigationOptions<T extends { id: string }> {
  /** Tasks grouped by column */
  tasksByColumn: Record<string, T[]>;
  /** Column IDs in display order */
  columnIds: string[];
  /** Currently selected task ID */
  selectedTaskId: string | null;
  /** Callback when selection changes */
  onSelectTask: (taskId: string | null) => void;
  /** Callback when Enter is pressed on selected task */
  onOpenTask?: (task: T) => void;
  /** Callback when Escape is pressed */
  onClosePanel?: () => void;
  /** Whether navigation is enabled */
  enabled?: boolean;
}

interface UseKanbanNavigationReturn {
  /** Handler for keydown events on the kanban container */
  handleKeyDown: (e: React.KeyboardEvent) => void;
  /** Ref to attach to the kanban container for focus management */
  containerRef: React.RefObject<HTMLDivElement>;
  /** Focus the container */
  focusContainer: () => void;
}

/**
 * Hook for keyboard navigation in kanban board
 *
 * Supports:
 * - Arrow keys (Up/Down/Left/Right) for task navigation
 * - Enter to open task details
 * - Escape to close panel
 * - Home/End for jumping to first/last task in column
 */
export function useKanbanNavigation<T extends { id: string }>({
  tasksByColumn,
  columnIds,
  selectedTaskId,
  onSelectTask,
  onOpenTask,
  onClosePanel,
  enabled = true,
}: UseKanbanNavigationOptions<T>): UseKanbanNavigationReturn {
  const containerRef = useRef<HTMLDivElement>(null);

  // Find the current position of selected task
  const findTaskPosition = useCallback(() => {
    if (!selectedTaskId) return null;

    for (let colIndex = 0; colIndex < columnIds.length; colIndex++) {
      const columnId = columnIds[colIndex];
      const tasks = tasksByColumn[columnId] || [];
      const taskIndex = tasks.findIndex((t) => t.id === selectedTaskId);
      if (taskIndex !== -1) {
        return {
          columnIndex: colIndex,
          taskIndex,
          columnId,
          task: tasks[taskIndex],
        };
      }
    }
    return null;
  }, [selectedTaskId, tasksByColumn, columnIds]);

  // Get task at position
  const getTaskAt = useCallback(
    (columnIndex: number, taskIndex: number): T | null => {
      const columnId = columnIds[columnIndex];
      if (!columnId) return null;
      const tasks = tasksByColumn[columnId] || [];
      return tasks[taskIndex] ?? null;
    },
    [tasksByColumn, columnIds]
  );

  // Navigate to specific position
  const navigateTo = useCallback(
    (columnIndex: number, taskIndex: number) => {
      const task = getTaskAt(columnIndex, taskIndex);
      if (task) {
        onSelectTask(task.id);
      }
    },
    [getTaskAt, onSelectTask]
  );

  // Handle arrow key navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!enabled) return;

      const position = findTaskPosition();

      switch (e.key) {
        case "ArrowUp": {
          e.preventDefault();
          if (!position) {
            // Select first task in first non-empty column
            for (const columnId of columnIds) {
              const tasks = tasksByColumn[columnId] || [];
              if (tasks.length > 0) {
                onSelectTask(tasks[0].id);
                break;
              }
            }
          } else {
            // Move up in current column
            if (position.taskIndex > 0) {
              navigateTo(position.columnIndex, position.taskIndex - 1);
            }
          }
          break;
        }

        case "ArrowDown": {
          e.preventDefault();
          if (!position) {
            // Select first task in first non-empty column
            for (const columnId of columnIds) {
              const tasks = tasksByColumn[columnId] || [];
              if (tasks.length > 0) {
                onSelectTask(tasks[0].id);
                break;
              }
            }
          } else {
            // Move down in current column
            const currentColumn = tasksByColumn[position.columnId] || [];
            if (position.taskIndex < currentColumn.length - 1) {
              navigateTo(position.columnIndex, position.taskIndex + 1);
            }
          }
          break;
        }

        case "ArrowLeft": {
          e.preventDefault();
          if (!position) return;
          // Move to same index in previous column (or last task if shorter)
          for (let i = position.columnIndex - 1; i >= 0; i--) {
            const tasks = tasksByColumn[columnIds[i]] || [];
            if (tasks.length > 0) {
              const targetIndex = Math.min(position.taskIndex, tasks.length - 1);
              navigateTo(i, targetIndex);
              break;
            }
          }
          break;
        }

        case "ArrowRight": {
          e.preventDefault();
          if (!position) return;
          // Move to same index in next column (or last task if shorter)
          for (let i = position.columnIndex + 1; i < columnIds.length; i++) {
            const tasks = tasksByColumn[columnIds[i]] || [];
            if (tasks.length > 0) {
              const targetIndex = Math.min(position.taskIndex, tasks.length - 1);
              navigateTo(i, targetIndex);
              break;
            }
          }
          break;
        }

        case "Enter": {
          e.preventDefault();
          if (position && onOpenTask) {
            onOpenTask(position.task);
          }
          break;
        }

        case "Escape": {
          e.preventDefault();
          if (onClosePanel) {
            onClosePanel();
          } else if (selectedTaskId) {
            onSelectTask(null);
          }
          break;
        }

        case "Home": {
          e.preventDefault();
          if (position) {
            // Jump to first task in current column
            const tasks = tasksByColumn[position.columnId] || [];
            if (tasks.length > 0) {
              navigateTo(position.columnIndex, 0);
            }
          }
          break;
        }

        case "End": {
          e.preventDefault();
          if (position) {
            // Jump to last task in current column
            const tasks = tasksByColumn[position.columnId] || [];
            if (tasks.length > 0) {
              navigateTo(position.columnIndex, tasks.length - 1);
            }
          }
          break;
        }

        default:
          break;
      }
    },
    [
      enabled,
      findTaskPosition,
      columnIds,
      tasksByColumn,
      onSelectTask,
      navigateTo,
      onOpenTask,
      onClosePanel,
      selectedTaskId,
    ]
  );

  // Focus container when enabled
  const focusContainer = useCallback(() => {
    containerRef.current?.focus();
  }, []);

  // Auto-focus container when no task is selected and user clicks in kanban area
  useEffect(() => {
    if (!enabled) return;

    const container = containerRef.current;
    if (!container) return;

    const handleClick = (e: MouseEvent) => {
      // Only focus if clicking directly on the container (not on a task card)
      if (e.target === container) {
        container.focus();
      }
    };

    container.addEventListener("click", handleClick);
    return () => container.removeEventListener("click", handleClick);
  }, [enabled]);

  return {
    handleKeyDown,
    containerRef,
    focusContainer,
  };
}

export type { UseKanbanNavigationOptions, UseKanbanNavigationReturn };
