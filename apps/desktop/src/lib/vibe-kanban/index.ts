// Types
export type {
  Task,
  TaskWithAttemptStatus,
  TaskStatus,
  CreateTaskRequest,
  UpdateTaskRequest,
  ReviewReason,
  ExecutionPhase,
  KanbanColumnId,
  SubtaskStatus,
  Subtask,
  ExecutionProgress,
} from "./types";

export {
  STATUS_TO_COLUMN,
  COLUMN_TO_STATUS,
  VISIBLE_STATUSES,
  KANBAN_COLUMNS,
  COLUMN_COLOR_VARS,
  COLUMN_COLORS,
  TASK_STATUS_COLORS,
  TASK_STATUS_PRIORITY,
  REVIEW_REASON_COLORS,
  REVIEW_REASON_LABELS,
  COLUMN_LABELS,
  VALID_TASK_STATUSES,
  isValidTaskStatus,
  VALID_STATUS_TRANSITIONS,
  isValidStatusTransition,
  getValidDropTargets,
} from "./types";

// API client
export {
  checkHealth,
  getTasks,
  getTask,
  createTask,
  updateTask,
  deleteTask,
  updateTaskStatus,
  VibeKanbanApiError,
} from "./api";

// WebSocket types
export type {
  WebSocketState,
  JsonPatchMessage,
  StreamFinishedMessage,
  WebSocketMessage,
  WebSocketOptions,
  UseWebSocketReturn,
} from "./websocket-types";

export {
  isJsonPatchMessage,
  isStreamFinishedMessage,
  buildTasksWebSocketUrl,
  getWebSocketCloseReason,
} from "./websocket-types";

// WebSocket hook
export { useTasksWebSocket } from "./use-tasks-websocket";
