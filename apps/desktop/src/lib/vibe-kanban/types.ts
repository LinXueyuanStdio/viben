/**
 * Types for vibe-kanban local backend API
 * Matches the Rust models in crates/db/src/models/
 */

// Task status enum - matches TaskStatus in Rust
export type TaskStatus = "todo" | "inprogress" | "inreview" | "done" | "cancelled";

// Task model - matches KanbanTask in gateway
export interface Task {
  id: string;
  workspace_path: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  created_at: string;
  updated_at: string;
}

// Task with attempt status - matches TaskWithAttemptStatus
export interface TaskWithAttemptStatus extends Task {
  has_in_progress_attempt: boolean;
  last_attempt_failed: boolean;
  executor: string;
}

// Create task request
export interface CreateTaskRequest {
  workspace_path?: string;
  title: string;
  description?: string | null;
  status?: TaskStatus;
}

// Update task request
export interface UpdateTaskRequest {
  title?: string;
  description?: string | null;
  status?: TaskStatus;
}

// API response wrapper
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error_data: unknown | null;
  message: string | null;
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
