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
  // State Machine Types
  TaskEventType,
  TaskEvent,
  XStateValue,
  TaskSource,
  TaskClassification,
  AgentConfig,
  GitConfig,
  TaskMetadata,
  ApplyResult,
  TaskStateResponse,
  TaskSSEEventType,
  TaskSSEStateChangedEvent,
  TaskSSERecoveredEvent,
  TaskSSEEvent,
  TaskWithStateMachine,
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
  deleteTask,
  checkTaskRunning,
  checkTaskRunningDetailed,
  VibeKanbanApiError,
} from "./api";

export type { CheckTaskRunningResult } from "./api";

// Constants
export {
  STUCK_THRESHOLD_MS,
  SERVER_STUCK_THRESHOLD_MS,
  SSE_HEARTBEAT_INTERVAL_MS,
  STUCK_CHECK_INTERVAL_MS,
  ACTIVITY_MAX_AGE_MS,
  ACTIVITY_CLEANUP_INTERVAL_MS,
  NETWORK_RETRY_CONFIG,
  SAFETY_TIMEOUT_MS,
} from "./constants";

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
