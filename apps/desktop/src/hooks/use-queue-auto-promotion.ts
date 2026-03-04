/**
 * Queue Auto-Promotion Hook
 *
 * Automatically promotes tasks from "queue" status to "in_progress"
 * when capacity becomes available (based on maxParallelTasks limit).
 *
 * Features:
 * - Priority-based sorting (P0 > P1 > P2 > P3, then FIFO)
 * - Workspace-isolated settings
 * - Toast notifications on promotion
 * - Callback support for detailed results
 *
 * Reference: Auto-Claude KanbanBoard.tsx processQueue pattern
 */

import { useCallback, useEffect, useRef } from "react";
import { useWorkspaceQueueSettings } from "@/stores/kanban-queue-store";
import { toast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import type { TaskWithAttemptStatus, TaskStatus } from "@/lib/vibe-kanban";

/**
 * Priority mapping for task sorting
 * Lower number = higher priority
 */
const PRIORITY_ORDER: Record<string, number> = {
  P0: 0, // Urgent - highest priority
  P1: 1, // High
  P2: 2, // Medium
  P3: 3, // Low
};

/**
 * Get numeric priority for sorting
 * Undefined priority gets lowest priority (4)
 */
function getPriorityOrder(priority: string | undefined): number {
  if (!priority) return 4;
  return PRIORITY_ORDER[priority.toUpperCase()] ?? 4;
}

/**
 * Result of queue processing
 */
export interface QueueProcessResult {
  /** Number of tasks successfully promoted */
  promoted: number;
  /** Number of tasks skipped (at capacity or already attempted) */
  skipped: number;
  /** Number of tasks that failed to promote */
  failed: number;
  /** Titles of promoted tasks */
  promotedTasks: string[];
}

interface UseQueueAutoPromotionOptions {
  /** Current tasks array */
  tasks: TaskWithAttemptStatus[];
  /** Callback to promote a task (update status to in_progress) */
  onPromoteTask: (taskId: string) => Promise<void>;
  /** Whether auto-promotion is enabled */
  enabled?: boolean;
  /** Workspace path for isolated settings */
  workspacePath?: string;
  /** Callback when queue processing completes */
  onQueueProcessed?: (result: QueueProcessResult) => void;
}

// Task status change listeners stored outside store to avoid triggering re-renders
type TaskStatusChangeListener = (
  taskId: string,
  oldStatus: TaskStatus | undefined,
  newStatus: TaskStatus
) => void;

const taskStatusChangeListeners = new Set<TaskStatusChangeListener>();

/**
 * Register a listener for task status changes
 * @returns Unregister function
 */
export function registerTaskStatusChangeListener(
  listener: TaskStatusChangeListener
): () => void {
  taskStatusChangeListeners.add(listener);
  return () => {
    taskStatusChangeListeners.delete(listener);
  };
}

/**
 * Notify all listeners of a task status change
 */
export function notifyTaskStatusChange(
  taskId: string,
  oldStatus: TaskStatus | undefined,
  newStatus: TaskStatus
): void {
  for (const listener of taskStatusChangeListeners) {
    try {
      listener(taskId, oldStatus, newStatus);
    } catch (error) {
      console.error("[QueueAutoPromotion] Error in status change listener:", error);
    }
  }
}

/**
 * Hook for automatic queue-to-in_progress promotion
 */
export function useQueueAutoPromotion({
  tasks,
  onPromoteTask,
  enabled = true,
  workspacePath,
  onQueueProcessed,
}: UseQueueAutoPromotionOptions) {
  const { maxParallelTasks, archivedTaskIds } = useWorkspaceQueueSettings(workspacePath);
  const { t } = useTranslation();

  // Ref to prevent concurrent queue processing
  const isProcessingQueueRef = useRef(false);

  // Ref to track previous task statuses for change detection
  const previousStatusMapRef = useRef<Map<string, TaskStatus>>(new Map());

  // Ref to track previous maxParallelTasks for change detection
  const prevMaxParallelTasksRef = useRef(maxParallelTasks);

  /**
   * Process queue - promote tasks from queue to in_progress
   * Priority ordering: P0 > P1 > P2 > P3, then FIFO by created_at
   */
  const processQueue = useCallback(async () => {
    if (!enabled) return;

    // Prevent concurrent executions
    if (isProcessingQueueRef.current) {
      console.log("[QueueAutoPromotion] Already processing queue, skipping");
      return;
    }

    isProcessingQueueRef.current = true;

    const result: QueueProcessResult = {
      promoted: 0,
      skipped: 0,
      failed: 0,
      promotedTasks: [],
    };

    try {
      const attemptedTaskIds = new Set<string>();
      let consecutiveFailures = 0;
      const MAX_CONSECUTIVE_FAILURES = 10;

      while (true) {
        // Filter out archived tasks
        const activeTasks = tasks.filter(
          (t) => !archivedTaskIds.includes(t.id)
        );

        // Count current in_progress tasks
        const inProgressCount = activeTasks.filter(
          (t) => t.status === "in_progress"
        ).length;

        // Get queued tasks that haven't been attempted yet
        const queuedTasks = activeTasks.filter(
          (t) => t.status === "queue" && !attemptedTaskIds.has(t.id)
        );

        // Stop conditions
        if (inProgressCount >= maxParallelTasks) {
          console.log(
            `[QueueAutoPromotion] At capacity (${inProgressCount}/${maxParallelTasks}), stopping`
          );
          result.skipped += queuedTasks.length;
          break;
        }

        if (queuedTasks.length === 0) {
          console.log("[QueueAutoPromotion] No queued tasks, stopping");
          break;
        }

        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
          console.warn(
            `[QueueAutoPromotion] Max consecutive failures (${MAX_CONSECUTIVE_FAILURES}) reached, stopping`
          );
          break;
        }

        // Priority-based sorting:
        // 1. First by priority (P0 > P1 > P2 > P3 > undefined)
        // 2. Then by created_at (FIFO) for same priority
        const sortedQueuedTasks = [...queuedTasks].sort((a, b) => {
          // Compare priority first
          const priorityA = getPriorityOrder(a.priority);
          const priorityB = getPriorityOrder(b.priority);

          if (priorityA !== priorityB) {
            return priorityA - priorityB;
          }

          // Same priority - sort by created_at (FIFO)
          const timeA = new Date(a.created_at).getTime();
          const timeB = new Date(b.created_at).getTime();
          return timeA - timeB;
        });

        const nextTask = sortedQueuedTasks[0];
        attemptedTaskIds.add(nextTask.id);

        console.log(
          `[QueueAutoPromotion] Promoting task ${nextTask.id} (${nextTask.title}) [priority: ${nextTask.priority ?? "none"}] from queue to in_progress`
        );

        try {
          await onPromoteTask(nextTask.id);
          consecutiveFailures = 0;
          result.promoted++;
          result.promotedTasks.push(nextTask.title);
        } catch (error) {
          console.error(
            `[QueueAutoPromotion] Failed to promote task ${nextTask.id}:`,
            error
          );
          consecutiveFailures++;
          result.failed++;
        }
      }

      // Show toast notification if tasks were promoted
      if (result.promoted > 0) {
        if (result.promoted === 1) {
          toast.success(
            t("workspace.queueAutoPromotion.promoted", {
              title: result.promotedTasks[0],
              defaultValue: `Started task: ${result.promotedTasks[0]}`,
            })
          );
        } else {
          toast.success(
            t("workspace.queueAutoPromotion.promotedBatch", {
              count: result.promoted,
              defaultValue: `Started ${result.promoted} tasks from queue`,
            })
          );
        }
      }

      // Invoke callback with results
      onQueueProcessed?.(result);
    } finally {
      isProcessingQueueRef.current = false;
    }

    return result;
  }, [enabled, tasks, maxParallelTasks, archivedTaskIds, onPromoteTask, t, onQueueProcessed]);

  // Detect task status changes and trigger queue processing
  useEffect(() => {
    if (!enabled) return;

    const currentStatusMap = new Map<string, TaskStatus>();
    for (const task of tasks) {
      currentStatusMap.set(task.id, task.status);
    }

    // Check for status changes
    for (const task of tasks) {
      const oldStatus = previousStatusMapRef.current.get(task.id);
      const newStatus = task.status;

      if (oldStatus !== undefined && oldStatus !== newStatus) {
        // Notify listeners
        notifyTaskStatusChange(task.id, oldStatus, newStatus);
      }
    }

    // Update previous status map
    previousStatusMapRef.current = currentStatusMap;
  }, [enabled, tasks]);

  // Register listener for queue processing when tasks leave in_progress
  useEffect(() => {
    if (!enabled) return;

    const unregister = registerTaskStatusChangeListener(
      (taskId, oldStatus, newStatus) => {
        // When a task leaves in_progress, process the queue
        if (oldStatus === "in_progress" && newStatus !== "in_progress") {
          console.log(
            `[QueueAutoPromotion] Task ${taskId} left in_progress (${oldStatus} -> ${newStatus}), processing queue`
          );
          processQueue();
        }
      }
    );

    return unregister;
  }, [enabled, processQueue]);

  // Monitor maxParallelTasks changes - trigger queue processing when limit increases
  useEffect(() => {
    if (!enabled) return;

    const prevValue = prevMaxParallelTasksRef.current;
    const currentValue = maxParallelTasks;

    // Update ref
    prevMaxParallelTasksRef.current = currentValue;

    // If limit increased, there may be capacity for more tasks
    if (currentValue > prevValue) {
      console.log(
        `[QueueAutoPromotion] maxParallelTasks increased (${prevValue} -> ${currentValue}), processing queue`
      );
      processQueue();
    }
  }, [enabled, maxParallelTasks, processQueue]);

  // Process queue on mount (catch any missed promotions)
  useEffect(() => {
    if (!enabled) return;

    // Small delay to ensure tasks are loaded
    const timer = setTimeout(() => {
      console.log("[QueueAutoPromotion] Initial queue check on mount");
      processQueue();
    }, 1000);

    return () => clearTimeout(timer);
  }, [enabled, processQueue]);

  return {
    processQueue,
    isProcessing: isProcessingQueueRef.current,
  };
}
