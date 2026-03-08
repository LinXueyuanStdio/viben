// Layout
export { TasksLayout, type LayoutMode } from "./tasks-layout";

// Dialogs
export {
  CreateTaskDialog,
  type CreateTaskDialogProps,
  type CreateTaskData,
} from "./create-task-dialog";
export { QueueSettingsModal } from "./queue-settings-modal";

// Components
export {
  TaskActionButtons,
  type TaskActionButtonsProps,
} from "./task-action-buttons";
export { PhaseProgressIndicator } from "./phase-progress-indicator";
export {
  TaskWarnings,
  type TaskWarningsProps,
} from "./task-warnings";

// Extracted components (kanban refactoring)
export {
  CollapsedColumn,
  type CollapsedColumnProps,
  ColumnHeader,
  type ColumnHeaderProps,
  KanbanColumn,
  type KanbanColumnProps,
  type ColumnHeaderConfig,
  type TaskCardConfig,
  KanbanToolbar,
  type KanbanToolbarProps,
  TaskCard,
  type TaskCardProps,
  TaskCardContent,
  TaskCardMenu,
  type TaskCardMenuProps,
  // View components
  KanbanBoardView,
  type KanbanBoardViewProps,
  KanbanListView,
  type KanbanListViewProps,
} from "./components";

// Hooks
export {
  useKanbanNavigation,
  type UseKanbanNavigationOptions,
  type UseKanbanNavigationReturn,
} from "./use-kanban-navigation";

export {
  useColumnManagement,
  type UseColumnManagementOptions,
  type ColumnManagement,
  useKanbanState,
  type UseKanbanStateOptions,
  type DialogState,
  type KanbanState,
  useDragDrop,
  type UseDragDropOptions,
  useTaskActions,
  type TaskActions as HookTaskActions,
  type UseTaskActionsOptions,
  type TaskActionsResult,
} from "./hooks";

// Types
export type {
  EnhancedTask,
  DragDropState,
  TaskActions,
  ColumnState,
  ColumnManagement as ColumnManagementState,
  MultiSelectState,
  FilterState,
  SortState,
  TaskCardContentProps,
  TaskCardWithStuckDetectionProps,
  ListViewItemWithStuckDetectionProps,
  QueueStatus,
  QueueSettingsState,
  KanbanFilter,
  ViewMode,
  SortMode,
  SortDirection,
  // Re-exported types from vibe-kanban and @viben/kanban
  DragEndEvent,
  Subtask,
  KanbanColumnId,
  TaskCategory,
  TaskComplexity,
  TaskImpact,
  IssuePriority,
  Tag,
  Assignee,
  VibeExecutionPhase,
  VibeReviewReason,
} from "./types";

// Constants
export {
  KANBAN_COLUMNS,
  COLUMN_COLORS,
  COLUMN_COLOR_VARS,
  CategoryIcons,
  COLUMN_I18N_KEYS,
  DEFAULT_COLUMN_WIDTH,
  MIN_COLUMN_WIDTH,
  MAX_COLUMN_WIDTH,
  DEFAULT_MAX_PARALLEL_TASKS,
  MAX_PARALLEL_TASKS_LIMIT,
  MIN_PARALLEL_TASKS_LIMIT,
  DEFAULT_STUCK_THRESHOLD_MS,
  DEFAULT_STUCK_CHECK_INTERVAL_MS,
  CARD_ANIMATION_DURATION_MS,
  PANEL_ANIMATION_DURATION_MS,
  VIEW_MODES,
  DEFAULT_VIEW_MODE,
  SORT_MODES,
  DEFAULT_SORT_MODE,
  DEFAULT_SORT_DIRECTION,
} from "./constants";

// Config - command palette commands
export {
  createCommands,
  type CommandFactoryContext,
  type CommandActions,
  type CommandTask,
} from "./config";
