import { useState, useCallback, useEffect, useRef } from "react";
import { useUpdateVibeKanbanTaskStatus } from "./use-vibe-kanban";

/**
 * Options for stuck detection
 */
export interface UseStuckDetectionOptions {
  /** Task ID to monitor */
  taskId: string;
  /** Whether the task is currently running */
  isRunning: boolean;
  /** Workspace path for API calls */
  workspacePath?: string;
  /** Last update timestamp from the task */
  lastUpdated?: string;
  /** Check interval in milliseconds (default: 60000ms = 1 minute) */
  checkInterval?: number;
  /** Stuck threshold in milliseconds (default: 60000ms = 1 minute) */
  stuckThreshold?: number;
}

/**
 * Return type for stuck detection hook
 */
export interface UseStuckDetectionReturn {
  /** Whether the task is considered stuck */
  isStuck: boolean;
  /** Duration the task has been stuck (in ms) */
  stuckDuration: number;
  /** Whether recovery is in progress */
  isRecovering: boolean;
  /** Trigger recovery (restart the task) */
  handleRecover: () => Promise<void>;
  /** Reset stuck status (e.g., when task resumes activity) */
  resetStuck: () => void;
}

/**
 * Hook for detecting stuck tasks
 *
 * Monitors a running task and detects when it hasn't made progress
 * for a specified threshold. Provides recovery functionality.
 *
 * @example
 * ```tsx
 * const { isStuck, stuckDuration, handleRecover } = useStuckDetection({
 *   taskId: task.id,
 *   isRunning: task.has_in_progress_attempt,
 *   workspacePath: "/path/to/workspace",
 *   lastUpdated: task.updated_at,
 * });
 * ```
 */
export function useStuckDetection({
  taskId,
  isRunning,
  workspacePath,
  lastUpdated,
  checkInterval = 60000, // 1 minute
  stuckThreshold = 60000, // 1 minute without updates
}: UseStuckDetectionOptions): UseStuckDetectionReturn {
  const [isStuck, setIsStuck] = useState(false);
  const [stuckDuration, setStuckDuration] = useState(0);
  const [isRecovering, setIsRecovering] = useState(false);

  const lastCheckedRef = useRef<string | undefined>(lastUpdated);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const updateTaskStatus = useUpdateVibeKanbanTaskStatus();

  // Reset stuck status when task ID changes or stops running
  useEffect(() => {
    if (!isRunning) {
      setIsStuck(false);
      setStuckDuration(0);
      lastCheckedRef.current = lastUpdated;
    }
  }, [taskId, isRunning, lastUpdated]);

  // Check for stuck status periodically
  useEffect(() => {
    if (!isRunning) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    const checkStuck = () => {
      if (!lastUpdated) return;

      const lastUpdateTime = new Date(lastUpdated).getTime();
      const now = Date.now();
      const timeSinceUpdate = now - lastUpdateTime;

      if (timeSinceUpdate >= stuckThreshold) {
        setIsStuck(true);
        setStuckDuration(timeSinceUpdate);
      } else if (lastUpdated !== lastCheckedRef.current) {
        // Activity detected - task is no longer stuck
        setIsStuck(false);
        setStuckDuration(0);
        lastCheckedRef.current = lastUpdated;
      }
    };

    // Initial check
    checkStuck();

    // Set up periodic check
    intervalRef.current = setInterval(checkStuck, checkInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isRunning, lastUpdated, checkInterval, stuckThreshold]);

  // Handle recovery - restart the task
  const handleRecover = useCallback(async () => {
    if (!workspacePath || isRecovering) return;

    try {
      setIsRecovering(true);

      // Move task back to queue to restart it
      await updateTaskStatus.mutateAsync({
        taskId,
        status: "queue",
        workspacePath,
      });

      // Reset stuck status
      setIsStuck(false);
      setStuckDuration(0);
      lastCheckedRef.current = undefined;
    } catch (error) {
      console.error("Failed to recover task:", error);
      throw error;
    } finally {
      setIsRecovering(false);
    }
  }, [taskId, workspacePath, updateTaskStatus, isRecovering]);

  // Manual reset
  const resetStuck = useCallback(() => {
    setIsStuck(false);
    setStuckDuration(0);
    lastCheckedRef.current = lastUpdated;
  }, [lastUpdated]);

  return {
    isStuck,
    stuckDuration,
    isRecovering,
    handleRecover,
    resetStuck,
  };
}

/**
 * Format stuck duration for display
 * @param durationMs - Duration in milliseconds
 * @returns Formatted string like "5m" or "1h 30m"
 */
export function formatStuckDuration(durationMs: number): string {
  const minutes = Math.floor(durationMs / 60000);
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours > 0) {
    return remainingMinutes > 0
      ? `${hours}h ${remainingMinutes}m`
      : `${hours}h`;
  }

  return `${minutes}m`;
}
