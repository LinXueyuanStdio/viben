/**
 * Task Queue Types
 *
 * Type definitions for the Gateway task queue system.
 * All field names use snake_case for API consistency.
 *
 * ## Status Mapping to Unified TaskStatus
 *
 * The queue system uses its own status terminology for internal operations,
 * which maps to the unified TaskStatus as follows:
 *
 * | Queue Status | Unified TaskStatus | Notes |
 * |--------------|-------------------|-------|
 * | pending      | queue             | Task waiting for execution |
 * | running      | in_progress       | Task currently executing |
 * | retrying     | in_progress       | Task failed, attempting retry (has retry_count flag) |
 * | completed    | done              | Task finished successfully |
 * | failed       | error             | Task failed permanently |
 *
 * @see packages/core/src/services/task-service.ts for UnifiedTask and TaskStatus
 */

import type { TaskStatus as UnifiedTaskStatus } from "../../services/task-service";

/**
 * Task status in the queue lifecycle
 *
 * @deprecated This type will be removed in future versions.
 * Use UnifiedTaskStatus from task-service.ts instead.
 * See status mapping table in module documentation above.
 */
export type QueueTaskStatus = "pending" | "running" | "retrying" | "completed" | "failed";

/**
 * Task status in the queue lifecycle
 *
 * @deprecated Alias for QueueTaskStatus. Use QueueTaskStatus or UnifiedTaskStatus instead.
 */
export type TaskStatus = QueueTaskStatus;

/**
 * Map queue status to unified task status
 *
 * @param queueStatus - Queue-specific status
 * @returns Unified task status
 */
export function mapQueueStatusToUnified(queueStatus: QueueTaskStatus): UnifiedTaskStatus {
  switch (queueStatus) {
    case "pending":
      return "queue";
    case "running":
    case "retrying":
      return "in_progress";
    case "completed":
      return "completed";
    case "failed":
      return "failed";
    default:
      return "queue"; // Default fallback
  }
}

/**
 * Map unified task status to queue status
 *
 * @param unifiedStatus - Unified task status
 * @returns Queue-specific status (best match)
 */
export function mapUnifiedStatusToQueue(unifiedStatus: UnifiedTaskStatus): QueueTaskStatus {
  switch (unifiedStatus) {
    case "queue":
    case "backlog":
      return "pending";
    case "in_progress":
    case "paused":
      return "running";
    case "completed":
    case "human_review":
      return "completed";
    case "failed":
    case "cancelled":
      return "failed";
    default:
      return "pending"; // Default fallback
  }
}

/**
 * Task type - currently only agent-run is supported
 */
export type TaskType = "agent-run";

/**
 * Agent run payload - parameters for executing an agent task
 */
export interface AgentRunPayload {
  /** Agent ID to use */
  agent_id: string;
  /** Session ID for persistence (optional) */
  session_id?: string;
  /** User prompt */
  input: string;
  /** Working directory */
  cwd?: string;
  /** Path to agent AGENTS.md file */
  agent_config_path?: string;
  /** Resume from existing SDK session */
  resume_session?: string;
  /** Attachments (optional) */
  attachments?: Array<{ type: string; data: string; name?: string }>;
}

/**
 * Queue task - represents a task in the queue
 */
export interface QueueTask {
  /** Unique task identifier */
  id: string;
  /** Task type (currently only 'agent-run') */
  type: TaskType;
  /** Execution parameters */
  payload: AgentRunPayload;
  /** Current task status */
  status: TaskStatus;
  /** Current retry count */
  retry_count: number;
  /** Maximum retry attempts */
  max_retries: number;
  /** Creation timestamp (milliseconds) */
  created_at: number;
  /** Start timestamp (milliseconds) - set when task starts running */
  started_at?: number;
  /** Completion timestamp (milliseconds) - set when task completes or fails */
  completed_at?: number;
  /** Error message if task failed */
  error?: string;
  /** Process ID when running */
  pid?: number;
}

/**
 * Queue status - overall queue state
 */
export interface QueueStatus {
  /** Number of pending tasks */
  pending_count: number;
  /** Number of running tasks */
  running_count: number;
  /** Maximum concurrent tasks */
  max_concurrency: number;
  /** All tasks (summary info) */
  tasks: QueueTaskSummary[];
}

/**
 * Task summary - condensed task info for status response
 */
export interface QueueTaskSummary {
  /** Task ID */
  id: string;
  /** Task status */
  status: TaskStatus;
  /** Agent ID */
  agent_id: string;
  /** Creation timestamp */
  created_at: number;
  /** Position in queue (for pending tasks) */
  position?: number;
}

/**
 * Queue configuration
 */
export interface QueueConfig {
  /** Maximum concurrent running tasks */
  max_concurrency: number;
  /** Default maximum retries for new tasks */
  default_max_retries: number;
  /** Debounce delay for persistence (milliseconds) */
  persist_debounce_ms: number;
  /** Shutdown timeout (milliseconds) */
  shutdown_timeout_ms: number;
}

/**
 * Default queue configuration
 */
export const DEFAULT_QUEUE_CONFIG: QueueConfig = {
  max_concurrency: 3,
  default_max_retries: 3,
  persist_debounce_ms: 500,
  shutdown_timeout_ms: 30000,
};

/**
 * Enqueue request - parameters for adding a task to the queue
 */
export interface EnqueueRequest {
  /** Agent ID to use */
  agent_id: string;
  /** Session ID for persistence (optional) */
  session_id?: string;
  /** User prompt */
  input: string;
  /** Working directory */
  cwd?: string;
  /** Path to agent AGENTS.md file */
  agent_config_path?: string;
  /** Resume from existing SDK session */
  resume_session?: string;
  /** Maximum retry attempts (optional, uses default if not specified) */
  max_retries?: number;
  /** Attachments (optional) */
  attachments?: Array<{ type: string; data: string; name?: string }>;
}

/**
 * Enqueue response - result of adding a task to the queue
 */
export interface EnqueueResponse {
  /** Task ID */
  task_id: string;
  /** Position in queue */
  position: number;
  /** Initial status */
  status: TaskStatus;
}

/**
 * Queue state file structure (state.yaml)
 */
export interface QueueStateFile {
  /** File format version */
  version: number;
  /** Maximum concurrency setting */
  max_concurrency: number;
  /** Last update timestamp */
  last_updated: number;
  /** Task IDs by status */
  task_ids: {
    pending: string[];
    running: string[];
  };
}

/**
 * Task file structure (task-{id}.yaml)
 */
export interface TaskFile {
  /** Task ID */
  id: string;
  /** Task type */
  type: TaskType;
  /** Task status */
  status: TaskStatus;
  /** Retry count */
  retry_count: number;
  /** Max retries */
  max_retries: number;
  /** Creation timestamp */
  created_at: number;
  /** Start timestamp */
  started_at?: number;
  /** Completion timestamp */
  completed_at?: number;
  /** Error message */
  error?: string;
  /** Payload */
  payload: AgentRunPayload;
}

/**
 * Queue events emitted by TaskQueueManager
 */
export type QueueEventType =
  | "task:queued"
  | "task:started"
  | "task:progress"
  | "task:completed"
  | "task:failed"
  | "task:cancelled"
  | "queue:changed"
  | "queue:restored";

/**
 * Queue event data types
 */
export interface QueueEventData {
  "task:queued": { task: QueueTask };
  "task:started": { task: QueueTask };
  "task:progress": { id: string; progress: unknown };
  "task:completed": { task: QueueTask };
  "task:failed": { task: QueueTask };
  "task:cancelled": { task: QueueTask };
  "queue:changed": { status: QueueStatus };
  "queue:restored": { pending_count: number; running_recovered: number };
}
