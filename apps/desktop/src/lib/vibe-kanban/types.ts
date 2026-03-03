/**
 * Types for vibe-kanban - unified task API
 * Matches the TypeScript gateway routes in packages/core/src/gateway/routes/tasks.ts
 */

// Task status enum (unified for both session tasks and kanban)
export type TaskStatus = "todo" | "inprogress" | "inreview" | "done" | "cancelled";

// Task model - unified task with all fields
export interface Task {
  id: string;
  // Task content
  title: string;
  description: string | null;
  prompt?: string;
  // Status
  status: TaskStatus;
  // Organization
  workspace_path: string | null;
  session_id?: string | null;
  agent_id?: string | null;
  task_index?: number;
  // Execution info
  cost?: number;
  duration?: number;
  favorite?: boolean;
  // GitHub integration
  github_issue_number?: number;
  github_issue_url?: string;
  // Timestamps
  created_at: string;
  updated_at: string;
}

// Task with attempt status - for kanban display
export interface TaskWithAttemptStatus extends Task {
  has_in_progress_attempt: boolean;
  last_attempt_failed: boolean;
  executor: string;
}

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

// Status mapping for kanban columns
export const STATUS_TO_COLUMN: Record<TaskStatus, string> = {
  todo: "todo",
  inprogress: "in-progress",
  inreview: "review",
  done: "done",
  cancelled: "cancelled",
};

export const COLUMN_TO_STATUS: Record<string, TaskStatus> = {
  "todo": "todo",
  "in-progress": "inprogress",
  "review": "inreview",
  "done": "done",
  "cancelled": "cancelled",
};

// Visible statuses for kanban (exclude cancelled by default)
export const VISIBLE_STATUSES: TaskStatus[] = ["todo", "inprogress", "inreview", "done"];
