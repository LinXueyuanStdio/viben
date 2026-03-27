/**
 * Types for vibe-kanban - unified task API
 * Matches the TypeScript gateway routes in packages/core/src/gateway/routes/tasks.ts
 *
 * Status flow:
 * backlog → queue → in_progress → review → completed
 * Terminal states: completed, failed, cancelled, archived
 */

/**
 * Task status enum - unified status system
 * @see XState task machine in packages/core/src/task/machine/task-machine.ts
 */
export type TaskStatus =
  | "backlog"       // 待办 - Tasks waiting to be started
  | "queue"         // 排队 - Tasks waiting for available capacity
  | "in_progress"   // 执行中 - Currently running (plan/implement/check/fix)
  | "paused"        // 暂停中 - Task paused, preserving progress
  | "review"        // 审查 - Needs review
  | "completed"     // 已完成 - Successfully completed
  | "failed"        // 失败 - Task execution failed
  | "cancelled"     // 已取消 - Task was cancelled
  | "archived";     // 已归档 - Task archived for reference

/**
 * Reason for entering review status
 */
export type ReviewReason =
  | "completed"     // 所有子任务完成，QA通过，等待最终审批
  | "errors"        // 执行过程中出错
  | "qa_rejected"   // QA发现问题需要修复
  | "plan_review"   // 规划完成，等待审批后开始编码
  | "stopped";      // 用户手动停止

/**
 * Subtask status
 */
export type SubtaskStatus = "pending" | "in_progress" | "completed" | "failed";

/**
 * Subtask detail - structured subtask data
 */
export interface Subtask {
  id: string;
  name: string;
  title?: string;
  status: SubtaskStatus;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Execution progress tracking
 */
export interface ExecutionProgress {
  phase: ExecutionPhase;
  phaseProgress?: number;  // 0-100
}

// Task model - unified task with all fields (reference: Auto-Claude UnifiedTask)
export interface Task {
  id: string;
  name?: string;           // URL-safe slug

  // === Task content ===
  title: string;
  description: string | null;
  prompt?: string;

  // === Status tracking ===
  status: TaskStatus;
  review_reason?: ReviewReason;   // Reason for entering review
  current_phase?: number;         // CLI phase system
  next_action?: Array<{ phase: number; action: string }>;

  // === Organization ===
  priority?: string;       // urgent, high, medium, low, none
  scope?: string;
  workspace_path: string | null;

  // === People ===
  creator?: string;
  assignee?: string;

  // === Git integration ===
  branch?: string;
  base_branch?: string;
  worktree_path?: string;
  commit?: string;
  pr_url?: string;

  // === Context (CLI) ===
  subtasks?: string[];
  related_files?: string[];
  notes?: string;

  // === Agent/Session integration (Gateway) ===
  session_id?: string | null;
  agent_id?: string | null;
  task_index?: number;

  // === Execution tracking (Gateway) ===
  cost?: number;           // API cost (USD)
  duration?: number;       // Execution time (ms)
  favorite?: boolean;

  // === GitHub integration ===
  github_issue_number?: number;
  github_issue_url?: string;

  // === Timestamps ===
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

// Task with attempt status - for kanban display
export interface TaskWithAttemptStatus extends Task {
  executor: string;
  // Extended execution info
  is_stuck?: boolean;           // Task stuck in execution
  stuck_duration?: number;      // How long stuck (ms)
  execution_phase?: ExecutionPhase;
  archived?: boolean;
  // Subtask visualization
  subtasks_detail?: Subtask[];           // Structured subtask data
  execution_progress?: ExecutionProgress; // Phase progress tracking
}

/**
 * Execution phase for running tasks
 * Matches @viben/kanban ExecutionPhase type
 */
export type ExecutionPhase =
  | "idle"                  // 空闲
  | "plan"                  // 规划阶段
  | "implement"             // 实现阶段
  | "rate_limit_paused"     // 速率限制暂停
  | "auth_failure_paused"   // 认证失败暂停
  | "check"                 // 检查阶段
  | "fix"                   // 修复阶段
  | "complete"              // 执行完成
  | "failed";               // 执行失败

// Priority type (matches IssuePriority from @viben/kanban)
export type IssuePriority = "urgent" | "high" | "medium" | "low" | "none";

// Create task request
export interface CreateTaskRequest {
  title: string;
  description?: string | null;
  prompt?: string;
  status?: TaskStatus;
  priority?: IssuePriority;
  workspace_path?: string;
  session_id?: string;
  agent_id?: string;
  task_index?: number;
  executor?: string;
  // GitHub integration
  github_issue_number?: number;
  github_issue_url?: string;
  // Legacy kanban fields
  model_id?: string;
  auto_start?: boolean;
  worktree?: boolean;
}

// Update task request
export interface UpdateTaskRequest {
  title?: string;
  description?: string | null;
  prompt?: string;
  status?: TaskStatus;
  priority?: IssuePriority;
  workspace_path?: string;
  session_id?: string;
  agent_id?: string;
  cost?: number;
  duration?: number;
  favorite?: boolean;
  executor?: string;
}

// ==========================================
// Column Configuration (9-column layout)
// ==========================================

/**
 * Kanban columns in display order (9 columns)
 * Flow: backlog → queue → in_progress → paused → review → completed → failed → cancelled → archived
 */
export const KANBAN_COLUMNS = [
  "backlog",
  "queue",
  "in_progress",
  "paused",
  "review",
  "completed",
  "failed",
  "cancelled",
  "archived",
] as const;

export type KanbanColumnId = (typeof KANBAN_COLUMNS)[number];

/**
 * Status to column mapping
 */
export const STATUS_TO_COLUMN: Record<TaskStatus, KanbanColumnId> = {
  backlog: "backlog",
  queue: "queue",
  in_progress: "in_progress",
  paused: "paused",
  review: "review",
  completed: "completed",
  failed: "failed",
  cancelled: "cancelled",
  archived: "archived",
};

export const COLUMN_TO_STATUS: Record<KanbanColumnId, TaskStatus> = {
  backlog: "backlog",
  queue: "queue",
  in_progress: "in_progress",
  paused: "paused",
  review: "review",
  completed: "completed",
  failed: "failed",
  cancelled: "cancelled",
  archived: "archived",
};

// Visible statuses for kanban
export const VISIBLE_STATUSES: TaskStatus[] = [
  "backlog",
  "queue",
  "in_progress",
  "paused",
  "review",
  "completed",
  "failed",
  "cancelled",
  "archived",
];

// ==========================================
// Status Priority (for deduplication)
// ==========================================

export const TASK_STATUS_PRIORITY: Record<TaskStatus, number> = {
  archived: 110,
  completed: 100,
  cancelled: 95,
  failed: 90,
  review: 80,
  paused: 60,
  in_progress: 50,
  queue: 30,
  backlog: 20,
};

// ==========================================
// Status Transition Constraints (for drag-drop)
// ==========================================

/**
 * Valid status transitions map
 * Defines which columns a task can be dragged to based on its current status
 *
 * Rules based on XState task machine:
 * - backlog: QUEUE → queue, CANCEL → cancelled
 * - queue: START → in_progress, DEQUEUE → backlog, PAUSE → paused, CANCEL → cancelled
 * - in_progress: PAUSE → paused, USER_STOPPED → backlog/review
 * - paused: RESUME → in_progress, ABANDON → backlog, CANCEL → cancelled
 * - review: APPROVED → completed, REJECTED → backlog, CANCEL → cancelled
 * - completed: ARCHIVE → archived
 * - failed: RETRY → queue, ABANDON → backlog, ARCHIVE → archived
 * - cancelled: ARCHIVE → archived
 * - archived: Terminal state (no transitions out)
 */
export const VALID_STATUS_TRANSITIONS: Record<TaskStatus, KanbanColumnId[]> = {
  backlog: ["queue", "cancelled"],
  queue: ["backlog", "in_progress", "paused", "cancelled"],
  in_progress: ["paused", "backlog", "review"],
  paused: ["in_progress", "backlog", "cancelled"],
  review: ["backlog", "completed", "cancelled"],
  completed: ["archived"],
  failed: ["queue", "backlog", "archived"],
  cancelled: ["archived"],
  archived: [],  // Terminal state
};

/**
 * Check if a status transition is valid for drag-drop
 * @param fromStatus - Current task status
 * @param toColumn - Target column ID
 * @returns true if the transition is allowed
 */
export function isValidStatusTransition(
  fromStatus: TaskStatus,
  toColumn: KanbanColumnId
): boolean {
  // Same column is always valid (reordering within column)
  const currentColumn = STATUS_TO_COLUMN[fromStatus];
  if (currentColumn === toColumn) return true;

  // Check against valid transitions
  const validTargets = VALID_STATUS_TRANSITIONS[fromStatus];
  return validTargets?.includes(toColumn) ?? false;
}

/**
 * Get valid drop targets for a task based on its current status
 * @param fromStatus - Current task status
 * @returns Array of valid column IDs the task can be dropped into
 */
export function getValidDropTargets(fromStatus: TaskStatus): KanbanColumnId[] {
  const currentColumn = STATUS_TO_COLUMN[fromStatus];
  const validTargets = VALID_STATUS_TRANSITIONS[fromStatus] ?? [];
  // Include current column (for reordering)
  return [currentColumn, ...validTargets.filter(col => col !== currentColumn)];
}

// ==========================================
// Column Colors & Styling
// ==========================================

/**
 * CSS variable names for column colors (--xxx format)
 */
export const COLUMN_COLOR_VARS: Record<KanbanColumnId, string> = {
  backlog: "--zinc-500",
  queue: "--cyan-500",
  in_progress: "--info",
  paused: "--yellow-500",
  review: "--purple-500",
  completed: "--success",
  failed: "--red-500",
  cancelled: "--zinc-500",
  archived: "--slate-500",
};

/**
 * Full color values for column indicators
 */
export const COLUMN_COLORS: Record<KanbanColumnId, string> = {
  backlog: "#71717a",      // Zinc-500 (muted)
  queue: "#22d3ee",        // Cyan-400
  in_progress: "#3b82f6",  // Blue-500 (info)
  paused: "#EAB308",       // Yellow-500
  review: "#A855F7",       // Purple-500
  completed: "#22c55e",    // Green-500 (success)
  failed: "#ef4444",       // Red-500 (destructive)
  cancelled: "#71717a",    // Zinc-500 (muted)
  archived: "#64748b",     // Slate-500
};

/**
 * Tailwind class combinations for task status badges
 */
export const TASK_STATUS_COLORS: Record<TaskStatus, string> = {
  backlog: "bg-muted text-muted-foreground",
  queue: "bg-cyan-500/10 text-cyan-400",
  in_progress: "bg-info/10 text-info",
  paused: "bg-yellow-500/10 text-yellow-500",
  review: "bg-purple-500/10 text-purple-400",
  completed: "bg-success/10 text-success",
  failed: "bg-destructive/10 text-destructive",
  cancelled: "bg-muted text-muted-foreground",
  archived: "bg-slate-500/10 text-slate-400",
};

/**
 * Review reason badge styling
 */
export const REVIEW_REASON_COLORS: Record<ReviewReason, string> = {
  completed: "bg-success/10 text-success border-success/30",
  errors: "bg-destructive/10 text-destructive border-destructive/30",
  qa_rejected: "bg-warning/10 text-warning border-warning/30",
  plan_review: "bg-warning/10 text-warning border-warning/30",
  stopped: "bg-warning/10 text-warning border-warning/30",
};

/**
 * Review reason labels (i18n keys)
 */
export const REVIEW_REASON_LABELS: Record<ReviewReason, string> = {
  completed: "workspace.reviewReason.completed",
  errors: "workspace.reviewReason.errors",
  qa_rejected: "workspace.reviewReason.qaRejected",
  plan_review: "workspace.reviewReason.planReview",
  stopped: "workspace.reviewReason.stopped",
};

/**
 * Column display names (i18n keys)
 */
export const COLUMN_LABELS: Record<KanbanColumnId, string> = {
  backlog: "workspace.column.backlog",
  queue: "workspace.column.queue",
  in_progress: "workspace.column.inProgress",
  paused: "workspace.column.paused",
  review: "workspace.column.review",
  completed: "workspace.column.completed",
  failed: "workspace.column.failed",
  cancelled: "workspace.column.cancelled",
  archived: "workspace.column.archived",
};

// ==========================================
// Status Utilities
// ==========================================

/**
 * All valid task statuses
 */
export const VALID_TASK_STATUSES: TaskStatus[] = [
  "backlog",
  "queue",
  "in_progress",
  "paused",
  "review",
  "completed",
  "failed",
  "cancelled",
  "archived",
];

/**
 * Check if a status is valid
 */
export function isValidTaskStatus(status: string): status is TaskStatus {
  return VALID_TASK_STATUSES.includes(status as TaskStatus);
}

// ==========================================
// Task State Machine Types
// ==========================================

/**
 * Task event types for state machine transitions
 * Matches the XState machine events in packages/core/src/task/machine/task-machine.ts
 */
export type TaskEventType =
  | 'QUEUE' | 'START' | 'DEQUEUE'
  | 'PLAN_COMPLETE' | 'PLAN_FAILED'
  | 'SUBTASK_COMPLETE' | 'ALL_SUBTASKS_DONE' | 'IMPLEMENT_FAILED'
  | 'CHECK_PASSED' | 'CHECK_FAILED' | 'FIX_COMPLETE' | 'FIX_FAILED'
  | 'USER_STOPPED' | 'APPROVED' | 'REJECTED' | 'CANCEL'
  | 'PAUSE' | 'RESUME' | 'RETRY' | 'ABANDON' | 'ARCHIVE';

/**
 * Task event structure for state machine transitions
 */
export interface TaskEvent {
  eventId: string;           // UUID, unique event identifier
  sequence: number;          // Incrementing sequence number
  type: TaskEventType;       // Event type
  timestamp: string;         // ISO timestamp
  payload?: Record<string, unknown>;  // Optional event payload
}

/**
 * XState state value type
 * Can be a simple string status or nested state for in_progress
 */
export type XStateValue = string | { in_progress: ExecutionPhase };

/**
 * Task source information
 */
export interface TaskSource {
  type: 'manual' | 'github_issue' | 'linear' | 'ideation';
  ref?: string;
  importedAt?: string;
}

/**
 * Task classification metadata
 */
export interface TaskClassification {
  category: 'feature' | 'bugfix' | 'refactor' | 'docs';
  complexity: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  priority: 'urgent' | 'high' | 'medium' | 'low' | 'none';
}

/**
 * Agent configuration for task execution
 */
export interface AgentConfig {
  model?: string;
  thinkingLevel?: 'low' | 'medium' | 'high';
  maxRetries?: number;
}

/**
 * Git configuration for task branches
 */
export interface GitConfig {
  baseBranch?: string;
  branchPrefix?: string;
  useWorktree?: boolean;
}

/**
 * Extended task metadata for state machine
 */
export interface TaskMetadata {
  source?: TaskSource;
  classification?: TaskClassification;
  agentConfig?: AgentConfig;
  gitConfig?: GitConfig;
  prUrl?: string;
  requireReviewBeforeCoding?: boolean;
}

/**
 * Apply result from event store
 */
export interface ApplyResult {
  success: boolean;
  error?: 'SEQUENCE_MISMATCH' | 'INVALID_TRANSITION';
  expected?: number;
  received?: number;
  currentState?: string;
  newState?: string;
}

/**
 * Task state response from gateway
 */
export interface TaskStateResponse {
  task_id: string;
  status: TaskStatus;
  xstate_state?: XStateValue;
  last_event?: TaskEvent;
  review_reason?: ReviewReason;
}

/**
 * SSE event types for task events stream
 */
export type TaskSSEEventType = 'STATE_CHANGED' | 'TASK_RECOVERED' | 'ERROR';

/**
 * SSE event data for state changed
 */
export interface TaskSSEStateChangedEvent {
  type: 'STATE_CHANGED';
  task_id: string;
  event: TaskEvent;
  new_state: string;
}

/**
 * SSE event data for task recovered
 */
export interface TaskSSERecoveredEvent {
  type: 'TASK_RECOVERED';
  task_id: string;
  reason: string;
}

/**
 * SSE event data union
 */
export type TaskSSEEvent = TaskSSEStateChangedEvent | TaskSSERecoveredEvent;

// ==========================================
// Extended Task Type with State Machine
// ==========================================

/**
 * Extended TaskWithAttemptStatus with state machine fields
 */
export interface TaskWithStateMachine extends TaskWithAttemptStatus {
  /** XState state machine current state */
  xstateState?: XStateValue;
  /** Last applied event */
  lastEvent?: TaskEvent;
  /** Event history for this task */
  eventHistory?: TaskEvent[];
  /** Extended metadata */
  metadata?: TaskMetadata;
}
