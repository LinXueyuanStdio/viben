/**
 * Task Recovery Service
 *
 * Handles task recovery scenarios:
 * - Gateway restart: Restore state from task.json
 * - Stuck detection: Move inactive tasks to review
 * - Agent crash: Auto-recovery with USER_STOPPED event
 */

import { taskService } from "../service";
import type { UnifiedTask } from "../ops/types";
import { TaskEventStore } from "../events/event-store";
import { createTaskEvent } from "../events/task-event";
import type { TaskSSEManager } from "../../gateway/sse/task-sse-manager";

// =============================================================================
// Types
// =============================================================================

/**
 * Recovery result for a single task
 */
export interface TaskRecoveryResult {
  taskId: string;
  recovered: boolean;
  reason?: string;
  newStatus?: string;
}

/**
 * Overall recovery summary
 */
export interface RecoverySummary {
  totalChecked: number;
  recovered: number;
  failed: number;
  results: TaskRecoveryResult[];
}

/**
 * Recovery configuration
 */
export interface RecoveryConfig {
  /** Threshold in milliseconds to consider a task stuck (default: 5 minutes) */
  stuckThresholdMs?: number;
  /** Whether to auto-recover stuck tasks (default: true) */
  autoRecover?: boolean;
}

// =============================================================================
// Constants
// =============================================================================

/** Default stuck threshold: 2 minutes (aligned with frontend 60s + buffer) */
const DEFAULT_STUCK_THRESHOLD_MS = 2 * 60 * 1000;

// =============================================================================
// Task Recovery Service
// =============================================================================

/**
 * Service for recovering tasks after crashes or restarts
 */
export class TaskRecoveryService {
  private eventStore: TaskEventStore;
  private sseManager?: TaskSSEManager;
  private config: Required<RecoveryConfig>;

  constructor(
    eventStore: TaskEventStore,
    sseManager?: TaskSSEManager,
    config?: RecoveryConfig
  ) {
    this.eventStore = eventStore;
    this.sseManager = sseManager;
    this.config = {
      stuckThresholdMs: config?.stuckThresholdMs ?? DEFAULT_STUCK_THRESHOLD_MS,
      autoRecover: config?.autoRecover ?? true,
    };
  }

  /**
   * Set the SSE manager (for late binding)
   */
  setSSEManager(sseManager: TaskSSEManager): void {
    this.sseManager = sseManager;
  }

  /**
   * Recover all active tasks in a workspace on startup
   *
   * @param workspacePath - Absolute path to workspace
   * @returns Recovery summary
   */
  async recoverOnStartup(workspacePath: string): Promise<RecoverySummary> {
    const summary: RecoverySummary = {
      totalChecked: 0,
      recovered: 0,
      failed: 0,
      results: [],
    };

    try {
      // Get all tasks in workspace
      const tasks = await taskService.listTasks(workspacePath);

      // Filter to active tasks only
      const activeTasks = tasks.filter((t) => taskService.isActiveState(t.status));
      summary.totalChecked = activeTasks.length;

      // Check each active task
      for (const task of activeTasks) {
        const result = await this.checkAndRecoverTask(workspacePath, task);
        summary.results.push(result);

        if (result.recovered) {
          summary.recovered++;
        } else if (result.reason?.includes("failed")) {
          summary.failed++;
        }
      }
    } catch (error) {
      // Log error but don't throw - recovery should be best-effort
      console.error("[TaskRecoveryService] Recovery failed:", error);
    }

    return summary;
  }

  /**
   * Check if a task is stuck and recover if necessary
   *
   * @param workspacePath - Absolute path to workspace
   * @param task - Task to check
   * @returns Recovery result
   */
  async checkAndRecoverTask(workspacePath: string, task: UnifiedTask): Promise<TaskRecoveryResult> {
    const result: TaskRecoveryResult = {
      taskId: task.id,
      recovered: false,
    };

    // Check if task is stuck
    if (!this.isStuck(task)) {
      result.reason = "not_stuck";
      return result;
    }

    // Don't auto-recover if disabled
    if (!this.config.autoRecover) {
      result.reason = "auto_recover_disabled";
      return result;
    }

    // Find task directory
    const taskDir = await taskService.findTaskById(workspacePath, task.id);
    if (!taskDir) {
      result.reason = "task_dir_not_found";
      return result;
    }

    // Try to recover
    try {
      await this.recoverStuckTask(taskDir, task);
      result.recovered = true;
      result.newStatus = "review";
      result.reason = "stuck_detected";

      // Broadcast recovery event via SSE
      if (this.sseManager) {
        this.sseManager.broadcast(task.id, {
          type: "TASK_RECOVERED",
          task_id: task.id,
          reason: "stuck_detected",
          timestamp: Date.now(),
        });
      }
    } catch (error) {
      result.reason = `recovery_failed: ${error}`;
    }

    return result;
  }

  /**
   * Check if a task is stuck (no events for threshold duration)
   *
   * @param task - Task to check
   * @returns True if stuck
   */
  isStuck(task: UnifiedTask): boolean {
    // Only active tasks can be stuck
    if (!taskService.isActiveState(task.status)) {
      return false;
    }

    // No last event means can't determine stuck status
    if (!task.last_event) {
      // Check updatedAt instead
      if (!task.updated_at) {
        return false;
      }
      const lastUpdateTime = new Date(task.updated_at).getTime();
      return Date.now() - lastUpdateTime > this.config.stuckThresholdMs;
    }

    const lastEventTime = new Date(task.last_event.timestamp).getTime();
    return Date.now() - lastEventTime > this.config.stuckThresholdMs;
  }

  /**
   * Recover a stuck task by sending USER_STOPPED event
   *
   * @param taskDir - Absolute path to task directory
   * @param task - Task to recover
   */
  private async recoverStuckTask(taskDir: string, task: UnifiedTask): Promise<void> {
    const nextSeq = (task.last_event?.sequence ?? 0) + 1;

    const event = createTaskEvent("USER_STOPPED", nextSeq, {
      reason: "stuck_detected",
      autoRecovery: true,
      detectedAt: new Date().toISOString(),
      lastEventTimestamp: task.last_event?.timestamp,
    });

    const result = await this.eventStore.applyEvent(taskDir, event);

    if (!result.success) {
      throw new Error(`Failed to apply recovery event: ${result.error}`);
    }
  }

  /**
   * Manually trigger recovery for a specific task
   *
   * @param workspacePath - Absolute path to workspace
   * @param taskId - Task ID to recover
   * @param reason - Recovery reason
   * @returns Recovery result
   */
  async recoverTask(
    workspacePath: string,
    taskId: string,
    reason: string = "manual_recovery"
  ): Promise<TaskRecoveryResult> {
    const result: TaskRecoveryResult = {
      taskId,
      recovered: false,
    };

    // Find task
    const taskDir = await taskService.findTaskById(workspacePath, taskId);
    if (!taskDir) {
      result.reason = "task_not_found";
      return result;
    }

    const task = await taskService.getTask(taskDir);
    if (!task) {
      result.reason = "task_not_found";
      return result;
    }

    // Only recover active tasks
    if (!taskService.isActiveState(task.status)) {
      result.reason = "task_not_active";
      return result;
    }

    try {
      const nextSeq = (task.last_event?.sequence ?? 0) + 1;
      const event = createTaskEvent("USER_STOPPED", nextSeq, {
        reason,
        manualRecovery: true,
      });

      const applyResult = await this.eventStore.applyEvent(taskDir, event);

      if (applyResult.success) {
        result.recovered = true;
        result.newStatus = "review";
        result.reason = reason;

        // Broadcast recovery event
        if (this.sseManager) {
          this.sseManager.broadcast(taskId, {
            type: "TASK_RECOVERED",
            task_id: taskId,
            reason,
            timestamp: Date.now(),
          });
        }
      } else {
        result.reason = `apply_failed: ${applyResult.error}`;
      }
    } catch (error) {
      result.reason = `recovery_error: ${error}`;
    }

    return result;
  }

  /**
   * Start periodic stuck detection
   *
   * @param workspacePath - Workspace to monitor
   * @param intervalMs - Check interval (default: 1 minute)
   * @returns Stop function
   */
  startPeriodicCheck(workspacePath: string, intervalMs: number = 60000): () => void {
    const intervalId = setInterval(async () => {
      try {
        await this.recoverOnStartup(workspacePath);
      } catch (error) {
        console.error("[TaskRecoveryService] Periodic check failed:", error);
      }
    }, intervalMs);

    return () => clearInterval(intervalId);
  }
}
