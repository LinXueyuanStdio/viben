import { useState, useCallback, useEffect, useRef } from "react";
import { useUpdateVibeKanbanTaskStatus } from "./use-vibe-kanban";
import { hasRecentActivity } from "@/stores/task-activity-store";
import { checkTaskRunning } from "@/lib/vibe-kanban";

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
  /** Check interval in milliseconds (default: 30000ms = 30 seconds) */
  checkInterval?: number;
  /** Stuck threshold in milliseconds (default: 60000ms = 1 minute) */
  stuckThreshold?: number;
  /** Enable process verification (default: true) */
  enableProcessCheck?: boolean;
  /** Auto-restart after recovery (default: false) */
  autoRestartOnRecovery?: boolean;
  /** Callback when task is recovered (before restart) */
  onRecovered?: () => void;
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
  /** Whether checking for stuck status */
  isChecking: boolean;
  /** Trigger recovery (restart the task) */
  handleRecover: () => Promise<void>;
  /** Reset stuck status (e.g., when task resumes activity) */
  resetStuck: () => void;
}

/**
 * Hook for detecting stuck tasks
 *
 * Uses a multi-layer detection strategy:
 * 1. Check client-side activity tracking (SSE events, data refreshes)
 * 2. Check lastUpdated timestamp from the task
 * 3. Verify with the Gateway if the process is actually running
 *
 * A task is only marked as stuck if:
 * - No recent client activity AND
 * - lastUpdated exceeds threshold AND
 * - Process verification confirms process is not running
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
  checkInterval = 30000, // 30 seconds
  stuckThreshold = 60000, // 1 minute without updates
  enableProcessCheck = true,
  autoRestartOnRecovery = false,
  onRecovered,
}: UseStuckDetectionOptions): UseStuckDetectionReturn {
  const [isStuck, setIsStuck] = useState(false);
  const [stuckDuration, setStuckDuration] = useState(0);
  const [isRecovering, setIsRecovering] = useState(false);
  const [isChecking, setIsChecking] = useState(false);

  const lastCheckedRef = useRef<string | undefined>(lastUpdated);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isCheckingRef = useRef(false);

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

    const checkStuck = async () => {
      // Prevent concurrent checks
      if (isCheckingRef.current) return;
      isCheckingRef.current = true;
      setIsChecking(true);

      try {
        // Layer 1: Check client-side activity tracking
        if (hasRecentActivity(taskId, stuckThreshold)) {
          setIsStuck(false);
          setStuckDuration(0);
          return;
        }

        // Layer 2: Check lastUpdated timestamp
        if (lastUpdated) {
          const lastUpdateTime = new Date(lastUpdated).getTime();
          const now = Date.now();
          const timeSinceUpdate = now - lastUpdateTime;

          if (timeSinceUpdate < stuckThreshold) {
            // Recent update from server
            setIsStuck(false);
            setStuckDuration(0);
            lastCheckedRef.current = lastUpdated;
            return;
          }

          // Check if lastUpdated changed (new activity)
          if (lastUpdated !== lastCheckedRef.current) {
            setIsStuck(false);
            setStuckDuration(0);
            lastCheckedRef.current = lastUpdated;
            return;
          }
        }

        // Layer 3: Verify with Gateway if process is actually running
        if (enableProcessCheck) {
          const processRunning = await checkTaskRunning(taskId);

          // Double-check activity after async call (race condition protection)
          if (hasRecentActivity(taskId, stuckThreshold)) {
            setIsStuck(false);
            setStuckDuration(0);
            return;
          }

          if (processRunning) {
            // Process is running but no updates - could be slow, not stuck
            // Keep checking but don't mark as stuck yet
            return;
          }
        }

        // All checks indicate task is stuck
        const now = Date.now();
        const lastUpdateTime = lastUpdated
          ? new Date(lastUpdated).getTime()
          : now - stuckThreshold;
        const duration = now - lastUpdateTime;

        setIsStuck(true);
        setStuckDuration(duration);
      } finally {
        isCheckingRef.current = false;
        setIsChecking(false);
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
  }, [isRunning, lastUpdated, checkInterval, stuckThreshold, taskId, enableProcessCheck]);

  // Handle recovery - restart the task
  const handleRecover = useCallback(async () => {
    if (!workspacePath || isRecovering) return;

    try {
      setIsRecovering(true);

      // Move task back to queue first
      await updateTaskStatus.mutateAsync({
        taskId,
        status: "queue",
        workspacePath,
      });

      // Notify callback before restart
      onRecovered?.();

      // If auto-restart is enabled, immediately promote to in_progress
      if (autoRestartOnRecovery) {
        // Small delay to let the queue transition complete
        await new Promise((resolve) => setTimeout(resolve, 100));

        await updateTaskStatus.mutateAsync({
          taskId,
          status: "in_progress",
          workspacePath,
        });
      }

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
  }, [taskId, workspacePath, updateTaskStatus, isRecovering, autoRestartOnRecovery, onRecovered]);

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
    isChecking,
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
