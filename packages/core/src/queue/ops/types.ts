/**
 * Queue operations types
 *
 * Shared types for CLI commands and Gateway routes
 */

// =============================================================================
// Data Types
// =============================================================================

/**
 * Queue item status
 */
export type QueueItemStatus = "pending" | "running" | "completed" | "failed" | "cancelled";

/**
 * Queue item - a command waiting in pending queue
 */
export interface QueueItem {
  /** Unique identifier (q_xxx) */
  id: string;
  /** Bash command to execute */
  command: string;
  /** Working directory */
  cwd: string;
  /** Creation timestamp (milliseconds) */
  created_at: number;
  /** Optional metadata (task_dir, retry_count, max_retries, etc.) */
  metadata?: Record<string, unknown>;
}

/**
 * Running item - a command currently being executed
 */
export interface RunningItem extends QueueItem {
  /** Process ID */
  pid: number;
  /** Start timestamp (milliseconds) */
  started_at: number;
  /** Log file path */
  log_file: string;
}

/**
 * Completed item - a command that has finished execution
 */
export interface CompletedItem extends RunningItem {
  /** Completion timestamp (milliseconds) */
  completed_at: number;
  /** Exit code (0 = success) */
  exit_code: number;
}

/**
 * Queue configuration
 */
export interface QueueConfig {
  /** Maximum concurrent running tasks */
  max_concurrency: number;
  /** Promoter check interval (milliseconds) */
  promoter_interval_ms: number;
  /** Monitor check interval (milliseconds) */
  monitor_interval_ms: number;
  /** Log retention days */
  log_retention_days: number;
  /** Completed record retention days */
  completed_retention_days: number;
  /** Default maximum retry count */
  default_max_retries: number;
}

/**
 * Default queue configuration
 */
export const DEFAULT_QUEUE_CONFIG: QueueConfig = {
  max_concurrency: 3,
  promoter_interval_ms: 5000,
  monitor_interval_ms: 30000,
  log_retention_days: 7,
  completed_retention_days: 30,
  default_max_retries: 3,
};

// =============================================================================
// Result Types
// =============================================================================

/**
 * Enqueue operation result
 */
export interface EnqueueResult {
  success: boolean;
  id?: string;
  position?: number;
  error?: string;
}

/**
 * Cancel operation result
 */
export interface CancelResult {
  success: boolean;
  cancelled?: string;
  error?: string;
}

/**
 * Retry operation result
 */
export interface RetryResult {
  success: boolean;
  id?: string;
  position?: number;
  error?: string;
}

/**
 * Status operation result
 */
export interface StatusResult {
  success: boolean;
  pending: number;
  running: number;
  completed: number;
  max_concurrency: number;
  items?: {
    pending: QueueItem[];
    running: RunningItem[];
  };
  error?: string;
}

/**
 * List operation result
 */
export interface ListResult {
  success: boolean;
  items: Array<QueueItem | RunningItem | CompletedItem>;
  total: number;
  error?: string;
}

/**
 * Inspect operation result
 */
export interface InspectResult {
  success: boolean;
  item?: QueueItem | RunningItem | CompletedItem;
  status?: QueueItemStatus;
  error?: string;
}

/**
 * Logs operation result
 */
export interface LogsResult {
  success: boolean;
  id?: string;
  content?: string;
  size?: number;
  truncated?: boolean;
  error?: string;
}

/**
 * Config operation result
 */
export interface ConfigResult {
  success: boolean;
  config?: QueueConfig;
  error?: string;
}

/**
 * Clean operation result
 */
export interface CleanResult {
  success: boolean;
  cleaned: number;
  items?: string[];
  error?: string;
}
