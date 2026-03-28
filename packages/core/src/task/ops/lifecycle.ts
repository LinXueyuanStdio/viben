/**
 * Task lifecycle operations
 *
 * Status transitions: enqueue, dequeue, pause, resume, approve, reject, retry, cancel
 */

import { execSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  resolveTaskDirectory,
  updateTaskStatus,
  appendTaskEvent,
  validateStatusTransition,
  getTodayDate,
  runGitCommand,
  getRegistryFile,
  type PausedSnapshot,
  FILE_TASK_JSON,
} from "../../cli/lib/viben-workspace";

import { enqueue as queueEnqueue } from "../../queue/ops/enqueue";
import { runMergePRPhase } from "../phase/merge-pr";

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

/**
 * Agent registry entry (simplified for lifecycle operations)
 */
interface RegistryEntry {
  id: string;
  worktree_path?: string;
  [key: string]: unknown;
}

/**
 * Agent registry structure
 */
interface Registry {
  agents: RegistryEntry[];
}

/**
 * Remove agent from registry by worktree path
 *
 * @param worktreePath - Worktree path to match
 * @param repoRoot - Repository root path
 * @returns True on success
 */
function removeFromRegistryByWorktree(
  worktreePath: string,
  repoRoot: string
): boolean {
  const registryFile = getRegistryFile(repoRoot);
  if (!registryFile || !existsSync(registryFile)) {
    return true; // No registry, nothing to remove
  }

  try {
    const content = readFileSync(registryFile, "utf-8");
    const registry = JSON.parse(content) as Registry;

    if (!registry.agents || registry.agents.length === 0) {
      return true; // Empty registry
    }

    // Filter out agents with matching worktree_path
    registry.agents = registry.agents.filter(
      (a) => a.worktree_path !== worktreePath
    );

    writeFileSync(registryFile, JSON.stringify(registry, null, 2), "utf-8");
    return true;
  } catch {
    return false;
  }
}

/**
 * Remove worktree directory using git worktree remove
 *
 * @param repoRoot - Repository root path
 * @param worktreePath - Path to worktree directory
 * @returns Object with success status and error message
 */
function removeWorktree(
  repoRoot: string,
  worktreePath: string
): { success: boolean; error?: string } {
  if (!existsSync(worktreePath)) {
    return { success: true }; // Already removed
  }

  try {
    // Try git worktree remove first
    const result = runGitCommand(["worktree", "remove", worktreePath, "--force"], repoRoot);
    if (result.code === 0) {
      return { success: true };
    }

    // If git command fails, try to remove directory manually
    try {
      rmSync(worktreePath, { recursive: true, force: true });
      // Prune worktree references
      runGitCommand(["worktree", "prune"], repoRoot);
      return { success: true };
    } catch (rmError) {
      return { success: false, error: `Failed to remove worktree directory: ${rmError}` };
    }
  } catch (error) {
    return { success: false, error: `Failed to remove worktree: ${error}` };
  }
}

/**
 * Delete local branch
 *
 * @param repoRoot - Repository root path
 * @param branch - Branch name to delete
 * @returns Object with success status and error message
 */
function deleteBranch(
  repoRoot: string,
  branch: string
): { success: boolean; error?: string } {
  try {
    const result = runGitCommand(["branch", "-D", branch], repoRoot);
    if (result.code === 0) {
      return { success: true };
    }
    // Ignore "branch not found" errors
    if (result.stderr.includes("not found")) {
      return { success: true };
    }
    return { success: false, error: `Failed to delete local branch: ${result.stderr}` };
  } catch (error) {
    return { success: false, error: `Failed to delete branch: ${error}` };
  }
}

/**
 * Cleanup options for cleanupWorktree
 */
interface CleanupWorktreeOptions {
  /** Keep the git branch (default: false) */
  keepBranch?: boolean;
}

/**
 * Cleanup worktree result
 */
interface CleanupWorktreeResult {
  success: boolean;
  worktreeRemoved: boolean;
  branchDeleted: boolean;
  errors: string[];
}

/**
 * Clean up worktree for a task
 *
 * This function:
 * 1. Removes the worktree directory using git worktree remove
 * 2. Deletes the local branch (optional, controlled by keepBranch)
 *
 * Note: Does NOT archive task or remove from registry.
 * For full cleanup including archive and registry, use `viben task cleanup`.
 *
 * @param repoRoot - Repository root path
 * @param worktreePath - Path to worktree directory
 * @param branch - Branch name to delete
 * @param options - Cleanup options
 * @returns Object with success status and any errors
 */
function cleanupWorktree(
  repoRoot: string,
  worktreePath: string | undefined,
  branch: string | undefined,
  options: CleanupWorktreeOptions = {}
): CleanupWorktreeResult {
  const { keepBranch = false } = options;
  const errors: string[] = [];
  let worktreeRemoved = false;
  let branchDeleted = false;

  // Step 1: Remove worktree directory
  if (worktreePath) {
    const result = removeWorktree(repoRoot, worktreePath);
    worktreeRemoved = result.success;
    if (result.error) {
      errors.push(result.error);
    }
  }

  // Step 2: Delete local branch (optional)
  if (branch && !keepBranch) {
    const result = deleteBranch(repoRoot, branch);
    branchDeleted = result.success;
    if (result.error) {
      errors.push(result.error);
    }
  }

  return {
    success: errors.length === 0,
    worktreeRemoved,
    branchDeleted,
    errors,
  };
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
 *
 * Submits "viben task start <task>" to the command queue system.
 * Queue system executes the command as a detached process.
 */
export function enqueueTask(
  repoRoot: string,
  taskName: string,
  options: {
    agent?: string;
    executor?: string;
    model?: string;
    priority?: string;
    /** Skip submitting to queue system (only update status) */
    skipQueue?: boolean;
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
    queued_at: new Date().toISOString(),
  };

  if (options.agent) additionalFields.agent = options.agent;
  if (options.executor) additionalFields.executor = options.executor;
  if (options.model) additionalFields.model = options.model;
  if (options.priority) additionalFields.priority = options.priority;

  // Submit to command queue system (unless skipQueue is true)
  let queueId: string | undefined;
  if (!options.skipQueue) {
    const dirName = taskDir.split("/").pop() || taskName;

    // Build command with absolute path: cd <repoRoot> && viben task start <task>
    // This ensures the command works regardless of where the queue worker executes
    const command = `cd "${repoRoot}" && viben task start "${dirName}"`;

    const queueResult = queueEnqueue({
      command,
      cwd: repoRoot,
      metadata: {
        task_dir: taskDir, // Store absolute path
        task_name: dirName,
      },
    });

    if (!queueResult.success) {
      return {
        success: false,
        task: taskName,
        error: `Failed to submit to queue: ${queueResult.error}`,
      };
    }

    queueId = queueResult.id;
    additionalFields.queue_id = queueId;
  }

  // Update task status
  if (!updateTaskStatus(taskDir, "queue", additionalFields)) {
    return { success: false, task: taskName, error: "Failed to update task.json" };
  }

  // Append event
  appendTaskEvent(taskDir, "QUEUE", {
    agent: options.agent,
    executor: options.executor,
    model: options.model,
    queue_id: queueId,
  });

  const dirName = taskDir.split("/").pop() || taskName;
  return {
    success: true,
    task: dirName,
    status: "queue",
    fromStatus: taskData.status,
    additionalData: { ...options, queue_id: queueId },
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
  if (!updateTaskStatus(taskDir, "backlog", { queued_at: null })) {
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
 * Options for approveTask
 */
export interface ApproveTaskOptions {
  /** Skip PR merge (just update status) */
  skipMerge?: boolean;
  /** Clean up worktree and branch after PR is merged (default: false) */
  cleanupIfMerged?: boolean;
  /** Git pull to sync merged code to local after PR is merged (default: false) */
  pullIfMerged?: boolean;
}

/**
 * Approve task: review -> completed
 *
 * Full approve flow (when task has pr_url):
 * 1. Merge PR using runMergePRPhase (direct gh CLI or agent fallback)
 * 2. Optionally git pull (only if --pull-if-merged)
 * 3. Update task.json with merged_at, merge_commit, status=completed
 *
 * Note: Worktree cleanup is NOT done here. Use `viben task cleanup` for that.
 */
export function approveTask(
  repoRoot: string,
  taskName: string,
  options: ApproveTaskOptions = {}
): LifecycleResult {
  const taskDir = resolveTaskDirectory(taskName, repoRoot);
  if (!taskDir || !existsSync(taskDir)) {
    return { success: false, task: taskName, error: `Task not found: ${taskName}` };
  }

  const taskData = readTaskJson(taskDir);
  if (!taskData) {
    return { success: false, task: taskName, error: `Cannot read task.json` };
  }

  // Extract pr_url and worktree info
  const prUrl = (taskData as { pr_url?: string }).pr_url;
  const worktreePath = (taskData as { worktree_path?: string }).worktree_path;
  const branch = taskData.branch;
  const hasPrUrl = !!prUrl;

  // Validate status transition - only review -> completed is allowed
  // No special handling for in_progress + pr_url
  const validation = validateStatusTransition(taskData.status, "completed", "APPROVED");
  if (!validation.valid) {
    return { success: false, task: taskName, error: validation.error };
  }

  const dirName = taskDir.split("/").pop() || taskName;
  const additionalData: Record<string, unknown> = {};

  // Step 1: Merge PR if exists (using runMergePRPhase)
  let mergeCommit: string | undefined;
  let mergedAt: string | undefined;
  let prMerged = false;

  if (hasPrUrl && !options.skipMerge) {
    const mergeResult = runMergePRPhase(repoRoot, taskDir, {
      prUrl: prUrl!,
    });
    additionalData.mergeResult = mergeResult;

    if (!mergeResult.success) {
      return {
        success: false,
        task: dirName,
        error: `Failed to merge PR: ${mergeResult.error}`,
        additionalData,
      };
    }

    mergeCommit = mergeResult.mergeCommit;
    mergedAt = new Date().toISOString();
    prMerged = true;

    // Fetch latest main after merge
    runGitCommand(["fetch", "origin", "main"], repoRoot);
  }

  // Step 2: Optionally git pull after merge (only if --pull-if-merged)
  if (prMerged && options.pullIfMerged) {
    const pullResult = runGitCommand(["pull", "origin", "main"], repoRoot);
    additionalData.pullResult = {
      success: pullResult.code === 0,
      output: pullResult.stdout,
      error: pullResult.stderr,
    };
  }

  // Step 3: Optionally clean up worktree after merge (only if --cleanup-if-merged)
  // This follows the same logic as `viben task cleanup`:
  // 1. Remove agent from registry
  // 2. Remove worktree directory
  // 3. Delete local branch
  if (prMerged && options.cleanupIfMerged && (worktreePath || branch)) {
    // 3a. Remove from registry (by worktree path)
    let removedFromRegistry = false;
    if (worktreePath) {
      removedFromRegistry = removeFromRegistryByWorktree(worktreePath, repoRoot);
    }

    // 3b. Remove worktree and delete branch
    const cleanupResult = cleanupWorktree(repoRoot, worktreePath, branch);

    additionalData.worktreeCleanup = {
      ...cleanupResult,
      removedFromRegistry,
    };

    if (cleanupResult.errors.length > 0) {
      // Log warnings but don't fail - worktree cleanup is best-effort
      console.warn(`Worktree cleanup warnings: ${cleanupResult.errors.join(", ")}`);
    }
  }

  // Step 4: Update task status
  const completedAt = getTodayDate();
  const updateFields: Record<string, unknown> = {
    completed_at: completedAt,
    review_reason: "approved",
  };

  // Note: Do NOT clear worktree_path here - it should be preserved for reference

  if (mergedAt) {
    updateFields.merged_at = mergedAt;
  }
  if (mergeCommit) {
    updateFields.merge_commit = mergeCommit;
  }

  if (!updateTaskStatus(taskDir, "completed", updateFields)) {
    return { success: false, task: taskName, error: "Failed to update task.json" };
  }

  // Append event
  appendTaskEvent(taskDir, "APPROVED", {
    merge_commit: mergeCommit,
    merged_at: mergedAt,
  });

  return {
    success: true,
    task: dirName,
    status: "completed",
    fromStatus: taskData.status,
    additionalData: {
      ...additionalData,
      merge_commit: mergeCommit,
      merged_at: mergedAt,
    },
  };
}

/**
 * Reject task: review -> backlog
 *
 * Also allows: in_progress -> backlog if pr_url exists
 * This handles cases where PR was created but status wasn't updated to review
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

  // Special case: allow reject from in_progress if pr_url exists
  // This handles cases where PR was created but status wasn't updated to review
  const hasPrUrl = !!(taskData as { pr_url?: string }).pr_url;
  const isInProgress = taskData.status === "in_progress";

  if (isInProgress && hasPrUrl) {
    // Allow transition from in_progress with pr_url - treat as if it was in review
    // This is a recovery path for inconsistent state
  } else {
    // Validate status transition normally
    const validation = validateStatusTransition(taskData.status, "backlog", "REJECTED");
    if (!validation.valid) {
      return { success: false, task: taskName, error: validation.error };
    }
  }

  // Build additional fields - clear pr_url, record rejection
  const additionalFields: Record<string, unknown> = {
    pr_url: null, // Clear PR URL as it may need to be resubmitted
    review_reason: "rejected",
  };
  if (reason) {
    additionalFields.reject_reason = reason;
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
    queued_at: new Date().toISOString(),
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
