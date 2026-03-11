/**
 * Task module type definitions
 */

import type { UnifiedTask } from "../../services/task-service";

// =============================================================================
// Core Types
// =============================================================================

/**
 * Task JSON format stored in .viben/tasks/<date>-<slug>/task.json
 * This is compatible with UnifiedTask from task-service.ts
 */
export type TaskJson = UnifiedTask;

/**
 * Context entry in jsonl files (implement.jsonl, check.jsonl, fix.jsonl)
 */
export interface ContextEntry {
  file: string;
  reason: string;
  type?: "file" | "directory";
}

/**
 * Status summary filter options
 */
export interface StatusSummaryOptions {
  filterAssignee?: string;
  filterStatus?: string;
  onlyRunning?: boolean;
}

/**
 * Running task info for status display
 */
export interface RunningTaskInfo {
  name: string;
  priority: string;
  assignee: string;
  phaseInfo: string;
  elapsed: string;
  branch: string;
  modified: number;
  lastTool: string | null;
  pid: number;
}

/**
 * Stopped task info for status display
 */
export interface StoppedTaskInfo {
  name: string;
  worktree: string;
  status: string;
  taskDir: string;
  logFile: string;
  platform: string;
}

/**
 * Regular task info for status display
 */
export interface RegularTaskInfo {
  name: string;
  status: string;
  priority: string;
  assignee: string;
}

/**
 * Context JSON structure matching Python git_context.py get_context_json()
 */
export interface ContextJson {
  developer: string;
  git: {
    branch: string;
    isClean: boolean;
    uncommittedChanges: number;
    recentCommits: Array<{ hash: string; message: string }>;
  };
  currentTask: {
    path: string;
    name: string;
    status: string;
    createdAt: string;
    description: string;
    hasPrd: boolean;
  } | null;
  tasks: {
    active: Array<{
      dir: string;
      name: string;
      status: string;
      assignee: string;
      priority: string;
    }>;
    directory: string;
  };
  myTasks: Array<{
    title: string;
    priority: string;
    status: string;
  }>;
  journal: {
    file: string;
    lines: number;
    nearLimit: boolean;
  };
  paths: {
    workspace: string;
    tasks: string;
    spec: string;
  };
}

/**
 * Session markdown generation parameters
 */
export interface SessionMarkdownParams {
  sessionNum: number;
  title: string;
  commit: string;
  summary: string;
  extraContent: string;
  date: string;
}

/**
 * Index update parameters for add-session
 */
export interface IndexUpdateParams {
  indexPath: string;
  devDir: string;
  sessionNum: number;
  title: string;
  commit: string;
  activeFile: string;
  date: string;
}

/**
 * Journal file info
 */
export interface JournalFileInfo {
  file: string | null;
  number: number;
  lines: number;
}
