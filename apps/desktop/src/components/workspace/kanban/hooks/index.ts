/**
 * Kanban hooks index
 *
 * Custom hooks for kanban management functionality.
 */

export {
  useColumnManagement,
  type UseColumnManagementOptions,
  type ColumnManagement,
} from "./use-column-management";

export {
  useKanbanState,
  type UseKanbanStateOptions,
  type DialogState,
  type KanbanState,
} from "./use-kanban-state";

export {
  useDragDrop,
  type UseDragDropOptions,
} from "./use-drag-drop";

export {
  useTaskActions,
  type CreateTaskData,
  type UseTaskActionsOptions,
  type TaskActionsResult,
} from "./use-task-actions";

export {
  useElapsedTime,
  formatElapsedTime,
  type UseElapsedTimeOptions,
  type UseElapsedTimeReturn,
} from "./use-elapsed-time";

// Re-export TaskActions from types (single source of truth)
export type { TaskActions } from "../types";
