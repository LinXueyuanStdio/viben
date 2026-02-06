/**
 * Types for vibe-kanban local backend API
 * Matches the Rust models in crates/db/src/models/
 */

// Task status enum - matches TaskStatus in Rust
export type TaskStatus = "todo" | "inprogress" | "inreview" | "done" | "cancelled";

// Task model - matches Task struct in task.rs
export interface Task {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  parent_workspace_id: string | null;
  created_at: string;
  updated_at: string;
}

// Task with attempt status - matches TaskWithAttemptStatus
export interface TaskWithAttemptStatus extends Task {
  has_in_progress_attempt: boolean;
  last_attempt_failed: boolean;
  executor: string;
}

// Create task request - matches CreateTask struct
export interface CreateTaskRequest {
  project_id: string;
  title: string;
  description?: string | null;
  status?: TaskStatus;
  parent_workspace_id?: string | null;
}

// Update task request - matches UpdateTask struct
export interface UpdateTaskRequest {
  title?: string;
  description?: string | null;
  status?: TaskStatus;
  parent_workspace_id?: string | null;
}

// Project model - matches Project struct in project.rs
export interface Project {
  id: string;
  name: string;
  git_repo_path: string;
  setup_script: string | null;
  dev_script: string | null;
  cleanup_script: string | null;
  copy_files: string | null;
  parallel_setup_script: boolean;
  remote_project_id: string | null;
  created_at: string;
  updated_at: string;
}

// API response wrapper - matches ApiResponse in Rust
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
