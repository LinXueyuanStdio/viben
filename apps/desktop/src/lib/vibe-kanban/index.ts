// Types
export type {
  Task,
  TaskWithAttemptStatus,
  TaskStatus,
  CreateTaskRequest,
  UpdateTaskRequest,
  Project,
  ApiResponse,
} from "./types";

export {
  STATUS_TO_COLUMN,
  COLUMN_TO_STATUS,
  VISIBLE_STATUSES,
} from "./types";

// API client
export {
  checkHealth,
  getProjects,
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
} from "./websocket-types";

// WebSocket hook
export { useTasksWebSocket } from "./use-tasks-websocket";
