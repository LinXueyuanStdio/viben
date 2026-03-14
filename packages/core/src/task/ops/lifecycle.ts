/**
 * Task lifecycle operations
 *
 * Status transitions: enqueue, dequeue, pause, resume, approve, reject, retry, cancel
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import {
  resolveTaskDirectory,
  updateTaskStatus,
  appendTaskEvent,
  validateStatusTransition,
  getTodayDate,
  type PausedSnapshot,
  FILE_TASK_JSON,
} from "../../cli/lib/viben-workspace";

import type { TaskJson } from "./types";

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Read task.json from a task directory
 */
function readTaskJson(taskDir: string): TaskJson | null {
  const taskJsonPath = join(taskDir, FILE_TASK_JSON);
  if (!existsSync(taskJsonPath)) {
    return null;
  }
  try {
    const content = readFileSync(taskJsonPath, "utf-8");
    return JSON.parse(content) as TaskJson;
  } catch {
    return null;
  }
}

// =============================================================================
// Result Types
// =============================================================================

export interface LifecycleResult {
  success: boolean;
  task: string;
  status?: string;
  fromStatus?: string;
  error?: string;
  additionalData?: Record<string, unknown>;
}

// =============================================================================
// Lifecycle Operations
// =============================================================================

/**
 * Enqueue task: backlog -> queue
 */
export function enqueueTask(
  repoRoot: string,
  taskName: string,
  options: {
    agent?: string;
    executor?: string;
    model?: string;
    priority?: string;
  } = {}
): LifecycleResult {
  const taskDir = resolveTaskDirectory(taskName, repoRoot);
  if (!taskDir || !existsSync(taskDir)) {
    return { success: false, task: taskName, error: `Task not found: ${taskName}` };
  }

  const taskData = readTaskJson(taskDir);
  if (!taskData) {
    return { success: false, task: taskName, error: `Cannot read task.json` };
  }

  // Validate status transition
  const validation = validateStatusTransition(taskData.status, "queue", "QUEUE");
  if (!validation.valid) {
    return { success: false, task: taskName, error: validation.error };
  }

  // Build additional fields
  const additionalFields: Record<string, unknown> = {
    queuedAt: new Date().toISOString(),
  };

  if (options.agent) additionalFields.agent = options.agent;
  if (options.executor) additionalFields.executor = options.executor;
  if (options.model) additionalFields.model = options.model;
  if (options.priority) additionalFields.priority = options.priority;

  // Update task status
  if (!updateTaskStatus(taskDir, "queue", additionalFields)) {
    return { success: false, task: taskName, error: "Failed to update task.json" };
  }

  // Append event
  appendTaskEvent(taskDir, "QUEUE", {
    agent: options.agent,
    executor: options.executor,
    model: options.model,
  });

  const dirName = taskDir.split("/").pop() || taskName;
  return {
    success: true,
    task: dirName,
    status: "queue",
    fromStatus: taskData.status,
    additionalData: options,
  };
}

/**
 * Dequeue task: queue -> backlog
 */
export function dequeueTask(repoRoot: string, taskName: string): LifecycleResult {
  const taskDir = resolveTaskDirectory(taskName, repoRoot);
  if (!taskDir || !existsSync(taskDir)) {
    return { success: false, task: taskName, error: `Task not found: ${taskName}` };
  }

  const taskData = readTaskJson(taskDir);
  if (!taskData) {
    return { success: false, task: taskName, error: `Cannot read task.json` };
  }

  // Validate status transition
  const validation = validateStatusTransition(taskData.status, "backlog", "DEQUEUE");
  if (!validation.valid) {
    return { success: false, task: taskName, error: validation.error };
  }

  // Update task status (clear queuedAt)
  if (!updateTaskStatus(taskDir, "backlog", { queuedAt: null })) {
    return { success: false, task: taskName, error: "Failed to update task.json" };
  }

  // Append event
  appendTaskEvent(taskDir, "DEQUEUE");

  const dirName = taskDir.split("/").pop() || taskName;
  return {
    success: true,
    task: dirName,
    status: "backlog",
    fromStatus: taskData.status,
  };
}

/**
 * Pause task: in_progress/queue -> paused
 */
export function pauseTask(repoRoot: string, taskName: string): LifecycleResult {
  const taskDir = resolveTaskDirectory(taskName, repoRoot);
  if (!taskDir || !existsSync(taskDir)) {
    return { success: false, task: taskName, error: `Task not found: ${taskName}` };
  }

  const taskData = readTaskJson(taskDir);
  if (!taskData) {
    return { success: false, task: taskName, error: `Cannot read task.json` };
  }

  // Validate status transition
  const validation = validateStatusTransition(taskData.status, "paused", "PAUSE");
  if (!validation.valid) {
    return { success: false, task: taskName, error: validation.error };
  }

  // Save paused snapshot
  const pausedSnapshot: PausedSnapshot = {
    fromState: taskData.status,
    subtaskIndex: taskData.current_phase || 0,
    pausedAt: new Date().toISOString(),
  };

  // Update task status
  if (!updateTaskStatus(taskDir, "paused", { pausedSnapshot })) {
    return { success: false, task: taskName, error: "Failed to update task.json" };
  }

  // Append event
  appendTaskEvent(taskDir, "PAUSE", { fromState: taskData.status });

  const dirName = taskDir.split("/").pop() || taskName;
  return {
    success: true,
    task: dirName,
    status: "paused",
    fromStatus: taskData.status,
  };
}

/**
 * Resume task: paused -> in_progress/queue (restore)
 */
export function resumeTask(repoRoot: string, taskName: string): LifecycleResult {
  const taskDir = resolveTaskDirectory(taskName, repoRoot);
  if (!taskDir || !existsSync(taskDir)) {
    return { success: false, task: taskName, error: `Task not found: ${taskName}` };
  }

  const taskData = readTaskJson(taskDir);
  if (!taskData) {
    return { success: false, task: taskName, error: `Cannot read task.json` };
  }

  // Validate status transition (RESUME expects paused state)
  const validation = validateStatusTransition(taskData.status, "queue", "RESUME");
  if (!validation.valid) {
    return { success: false, task: taskName, error: validation.error };
  }

  // Read pausedSnapshot to determine target status
  const pausedSnapshot = (taskData as unknown as { pausedSnapshot?: PausedSnapshot }).pausedSnapshot;
  const targetStatus = pausedSnapshot?.fromState || "queue";

  // Update task status (clear pausedSnapshot)
  if (!updateTaskStatus(taskDir, targetStatus, { pausedSnapshot: null })) {
    return { success: false, task: taskName, error: "Failed to update task.json" };
  }

  // Append event
  appendTaskEvent(taskDir, "RESUME", { toState: targetStatus });

  const dirName = taskDir.split("/").pop() || taskName;
  return {
    success: true,
    task: dirName,
    status: targetStatus,
    fromStatus: "paused",
  };
}

/**
 * Approve task: review -> completed
 */
export function approveTask(repoRoot: string, taskName: string): LifecycleResult {
  const taskDir = resolveTaskDirectory(taskName, repoRoot);
  if (!taskDir || !existsSync(taskDir)) {
    return { success: false, task: taskName, error: `Task not found: ${taskName}` };
  }

  const taskData = readTaskJson(taskDir);
  if (!taskData) {
    return { success: false, task: taskName, error: `Cannot read task.json` };
  }

  // Validate status transition
  const validation = validateStatusTransition(taskData.status, "completed", "APPROVED");
  if (!validation.valid) {
    return { success: false, task: taskName, error: validation.error };
  }

  // Update task status
  const completedAt = getTodayDate();
  if (!updateTaskStatus(taskDir, "completed", {
    completedAt,
    reviewReason: "approved"
  })) {
    return { success: false, task: taskName, error: "Failed to update task.json" };
  }

  // Append event
  appendTaskEvent(taskDir, "APPROVED");

  const dirName = taskDir.split("/").pop() || taskName;
  return {
    success: true,
    task: dirName,
    status: "completed",
    fromStatus: taskData.status,
  };
}

/**
 * Reject task: review -> backlog
 */
export function rejectTask(
  repoRoot: string,
  taskName: string,
  reason?: string
): LifecycleResult {
  const taskDir = resolveTaskDirectory(taskName, repoRoot);
  if (!taskDir || !existsSync(taskDir)) {
    return { success: false, task: taskName, error: `Task not found: ${taskName}` };
  }

  const taskData = readTaskJson(taskDir);
  if (!taskData) {
    return { success: false, task: taskName, error: `Cannot read task.json` };
  }

  // Validate status transition
  const validation = validateStatusTransition(taskData.status, "backlog", "REJECTED");
  if (!validation.valid) {
    return { success: false, task: taskName, error: validation.error };
  }

  // Build additional fields - clear pr_url, record rejection
  const additionalFields: Record<string, unknown> = {
    pr_url: null, // Clear PR URL as it may need to be resubmitted
    reviewReason: "rejected",
  };
  if (reason) {
    additionalFields.rejectReason = reason;
  }

  // Update task status
  if (!updateTaskStatus(taskDir, "backlog", additionalFields)) {
    return { success: false, task: taskName, error: "Failed to update task.json" };
  }

  // Append event
  appendTaskEvent(taskDir, "REJECTED", { reason });

  const dirName = taskDir.split("/").pop() || taskName;
  return {
    success: true,
    task: dirName,
    status: "backlog",
    fromStatus: taskData.status,
    additionalData: { reason },
  };
}

/**
 * Retry task: failed -> queue
 */
export function retryTask(repoRoot: string, taskName: string): LifecycleResult {
  const taskDir = resolveTaskDirectory(taskName, repoRoot);
  if (!taskDir || !existsSync(taskDir)) {
    return { success: false, task: taskName, error: `Task not found: ${taskName}` };
  }

  const taskData = readTaskJson(taskDir);
  if (!taskData) {
    return { success: false, task: taskName, error: `Cannot read task.json` };
  }

  // Validate status transition
  const validation = validateStatusTransition(taskData.status, "queue", "RETRY");
  if (!validation.valid) {
    return { success: false, task: taskName, error: validation.error };
  }

  // Update task status - clear error fields, set new queuedAt
  if (!updateTaskStatus(taskDir, "queue", {
    queuedAt: new Date().toISOString(),
    error: null,
    errorMessage: null,
    failedAt: null,
  })) {
    return { success: false, task: taskName, error: "Failed to update task.json" };
  }

  // Append event
  appendTaskEvent(taskDir, "RETRY");

  const dirName = taskDir.split("/").pop() || taskName;
  return {
    success: true,
    task: dirName,
    status: "queue",
    fromStatus: taskData.status,
  };
}

/**
 * Cancel task: * -> cancelled
 */
export function cancelTask(
  repoRoot: string,
  taskName: string,
  options: { reason?: string; force?: boolean } = {}
): LifecycleResult {
  const taskDir = resolveTaskDirectory(taskName, repoRoot);
  if (!taskDir || !existsSync(taskDir)) {
    return { success: false, task: taskName, error: `Task not found: ${taskName}` };
  }

  const taskData = readTaskJson(taskDir);
  if (!taskData) {
    return { success: false, task: taskName, error: `Cannot read task.json` };
  }

  // Check if task is in_progress and --force is not specified
  if (taskData.status === "in_progress" && !options.force) {
    return {
      success: false,
      task: taskName,
      error: "Task is in_progress. Use force option to cancel a running task.",
    };
  }

  // Validate status transition
  const validation = validateStatusTransition(taskData.status, "cancelled", "CANCEL");
  if (!validation.valid) {
    return { success: false, task: taskName, error: validation.error };
  }

  // Build additional fields
  const additionalFields: Record<string, unknown> = {
    cancelledAt: new Date().toISOString(),
  };
  if (options.reason) {
    additionalFields.cancelReason = options.reason;
  }

  // Update task status
  if (!updateTaskStatus(taskDir, "cancelled", additionalFields)) {
    return { success: false, task: taskName, error: "Failed to update task.json" };
  }

  // Append event
  appendTaskEvent(taskDir, "CANCEL", options.reason ? { reason: options.reason } : undefined);

  const dirName = taskDir.split("/").pop() || taskName;
  return {
    success: true,
    task: dirName,
    status: "cancelled",
    fromStatus: taskData.status,
    additionalData: { reason: options.reason },
  };
}
