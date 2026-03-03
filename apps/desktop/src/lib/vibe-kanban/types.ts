/**
 * Types for vibe-kanban - unified task API
 * Matches the TypeScript gateway routes in packages/core/src/gateway/routes/tasks.ts
 *
 * Status flow (reference: Auto-Claude):
 * backlog → queue → in_progress → ai_review → human_review → done/pr_created
 */

/**
 * Task status enum - unified status system
 * @see Auto-Claude status machine
 */
export type TaskStatus =
  | "backlog"       // 待办 - Tasks waiting to be started
  | "queue"         // 排队 - Tasks waiting for available capacity
  | "in_progress"   // 执行中 - Currently running (planning/coding)
  | "ai_review"     // AI审查 - AI automatic review (qa_review/qa_fixing)
  | "human_review"  // 人工审查 - Needs human review
  | "done"          // 完成 - Completed
  | "pr_created"    // PR已创建 - PR has been created
  | "error";        // 错误 - Error state

// Legacy status aliases for backward compatibility
export type LegacyTaskStatus = "todo" | "inprogress" | "inreview" | "done" | "cancelled";

/**
 * Reason for entering human_review status
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
  review_reason?: ReviewReason;   // Reason for entering human_review
  current_phase?: number;         // CLI phase system
  next_action?: Array<{ phase: number; action: string }>;

  // === Organization ===
  priority?: string;       // P0, P1, P2, P3
  dev_type?: string;       // backend, frontend, fullstack, test, docs
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
  has_in_progress_attempt: boolean;
  last_attempt_failed: boolean;
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
 */
export type ExecutionPhase =
  | "planning"      // 规划阶段
  | "coding"        // 编码阶段
  | "qa_review"     // QA审查阶段
  | "qa_fixing"     // QA修复阶段
  | "complete";     // 执行完成

// Create task request
export interface CreateTaskRequest {
  title: string;
  description?: string | null;
  prompt?: string;
  status?: TaskStatus;
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
  branch?: string;
  auto_start?: boolean;
}

// Update task request
export interface UpdateTaskRequest {
  title?: string;
  description?: string | null;
  prompt?: string;
  status?: TaskStatus;
  workspace_path?: string;
  session_id?: string;
  agent_id?: string;
  cost?: number;
  duration?: number;
  favorite?: boolean;
  has_in_progress_attempt?: boolean;
  last_attempt_failed?: boolean;
  executor?: string;
}

// ==========================================
// Column Configuration (6-column layout)
// ==========================================

/**
 * Kanban columns in display order
 */
export const KANBAN_COLUMNS = [
  "backlog",
  "queue",
  "in_progress",
  "ai_review",
  "human_review",
  "done",
] as const;

export type KanbanColumnId = (typeof KANBAN_COLUMNS)[number];

/**
 * Status to column mapping
 * - pr_created → done (visually in done column)
 * - error → human_review (errors need human attention)
 */
export const STATUS_TO_COLUMN: Record<TaskStatus, KanbanColumnId> = {
  backlog: "backlog",
  queue: "queue",
  in_progress: "in_progress",
  ai_review: "ai_review",
  human_review: "human_review",
  done: "done",
  pr_created: "done",      // PR tasks shown in done column
  error: "human_review",   // Errors need human attention
};

export const COLUMN_TO_STATUS: Record<KanbanColumnId, TaskStatus> = {
  backlog: "backlog",
  queue: "queue",
  in_progress: "in_progress",
  ai_review: "ai_review",
  human_review: "human_review",
  done: "done",
};

// Visible statuses for kanban
export const VISIBLE_STATUSES: TaskStatus[] = [
  "backlog",
  "queue",
  "in_progress",
  "ai_review",
  "human_review",
  "done",
  "pr_created",
];

// ==========================================
// Status Priority (for deduplication)
// ==========================================

export const TASK_STATUS_PRIORITY: Record<TaskStatus, number> = {
  done: 100,
  pr_created: 90,
  human_review: 80,
  ai_review: 70,
  in_progress: 50,
  queue: 30,
  backlog: 20,
  error: 10,
};

// ==========================================
// Column Colors & Styling
// ==========================================

/**
 * CSS variable names for column colors (--xxx format)
 */
export const COLUMN_COLOR_VARS: Record<KanbanColumnId, string> = {
  backlog: "--muted-foreground",
  queue: "--cyan-500",
  in_progress: "--info",
  ai_review: "--warning",
  human_review: "--purple-500",
  done: "--success",
};

/**
 * Full color values for column indicators
 */
export const COLUMN_COLORS: Record<KanbanColumnId, string> = {
  backlog: "hsl(var(--muted-foreground))",
  queue: "#22d3ee",        // Cyan
  in_progress: "hsl(var(--info))",
  ai_review: "hsl(var(--warning))",
  human_review: "#A855F7", // Purple
  done: "hsl(var(--success))",
};

/**
 * Tailwind class combinations for task status badges
 */
export const TASK_STATUS_COLORS: Record<TaskStatus, string> = {
  backlog: "bg-muted text-muted-foreground",
  queue: "bg-cyan-500/10 text-cyan-400",
  in_progress: "bg-info/10 text-info",
  ai_review: "bg-warning/10 text-warning",
  human_review: "bg-purple-500/10 text-purple-400",
  done: "bg-success/10 text-success",
  pr_created: "bg-info/10 text-info",
  error: "bg-destructive/10 text-destructive",
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
  ai_review: "workspace.column.aiReview",
  human_review: "workspace.column.humanReview",
  done: "workspace.column.done",
};

// ==========================================
// Legacy Compatibility
// ==========================================

/**
 * Map legacy status to new status
 */
export function mapLegacyStatus(status: string): TaskStatus {
  const mapping: Record<string, TaskStatus> = {
    todo: "backlog",
    inprogress: "in_progress",
    inreview: "ai_review",
    done: "done",
    cancelled: "error",
  };
  return mapping[status] || (status as TaskStatus);
}
