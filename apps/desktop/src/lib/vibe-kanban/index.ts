// Types
export type {
  Task,
  TaskWithAttemptStatus,
  TaskStatus,
  CreateTaskRequest,
  UpdateTaskRequest,
} from "./types";

export {
  STATUS_TO_COLUMN,
  COLUMN_TO_STATUS,
  VISIBLE_STATUSES,
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
