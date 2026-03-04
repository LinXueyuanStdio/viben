/**
 * Queue Auto-Promotion Hook
 *
 * Automatically promotes tasks from "queue" status to "in_progress"
 * when capacity becomes available (based on maxParallelTasks limit).
 *
 * Reference: Auto-Claude KanbanBoard.tsx processQueue pattern
 */

import { useCallback, useEffect, useRef } from "react";
import { useKanbanQueueStore } from "@/stores/kanban-queue-store";
import type { TaskWithAttemptStatus, TaskStatus } from "@/lib/vibe-kanban";

interface UseQueueAutoPromotionOptions {
  /** Current tasks array */
  tasks: TaskWithAttemptStatus[];
  /** Callback to promote a task (update status to in_progress) */
  onPromoteTask: (taskId: string) => Promise<void>;
  /** Whether auto-promotion is enabled */
  enabled?: boolean;
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
}: UseQueueAutoPromotionOptions) {
  const { maxParallelTasks, archivedTaskIds } = useKanbanQueueStore();

  // Ref to prevent concurrent queue processing
  const isProcessingQueueRef = useRef(false);

  // Ref to track previous task statuses for change detection
  const previousStatusMapRef = useRef<Map<string, TaskStatus>>(new Map());

  /**
   * Process queue - promote tasks from queue to in_progress
   * FIFO ordering: oldest tasks promoted first
   */
  const processQueue = useCallback(async () => {
    if (!enabled) return;

    // Prevent concurrent executions
    if (isProcessingQueueRef.current) {
      console.log("[QueueAutoPromotion] Already processing queue, skipping");
      return;
    }

    isProcessingQueueRef.current = true;

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

        // FIFO ordering - oldest first by created_at
        const sortedQueuedTasks = [...queuedTasks].sort((a, b) => {
          const timeA = new Date(a.created_at).getTime();
          const timeB = new Date(b.created_at).getTime();
          return timeA - timeB;
        });

        const nextTask = sortedQueuedTasks[0];
        attemptedTaskIds.add(nextTask.id);

        console.log(
          `[QueueAutoPromotion] Promoting task ${nextTask.id} (${nextTask.title}) from queue to in_progress`
        );

        try {
          await onPromoteTask(nextTask.id);
          consecutiveFailures = 0;
        } catch (error) {
          console.error(
            `[QueueAutoPromotion] Failed to promote task ${nextTask.id}:`,
            error
          );
          consecutiveFailures++;
        }
      }
    } finally {
      isProcessingQueueRef.current = false;
    }
  }, [enabled, tasks, maxParallelTasks, archivedTaskIds, onPromoteTask]);

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

  // Register listener for queue processing
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
