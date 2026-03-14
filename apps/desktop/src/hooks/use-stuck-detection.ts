import { useState, useCallback, useEffect, useRef } from "react";
import { useUpdateVibeKanbanTaskStatus } from "./use-vibe-kanban";
import { hasRecentActivity, getTimeSinceActivity } from "@/stores/task-activity-store";
import { checkTaskRunningDetailed } from "@/lib/vibe-kanban";
import {
  STUCK_THRESHOLD_MS,
  STUCK_CHECK_INTERVAL_MS,
  SAFETY_TIMEOUT_MS,
} from "@/lib/vibe-kanban/constants";

/**
 * Minimal subtask interface for stuck detection
 * Compatible with both vibe-kanban Subtask and TaskSpecSubtask
 */
export interface StuckDetectionSubtask {
  id: string;
  status: "pending" | "in_progress" | "completed" | "failed";
}

/**
 * Subtask progress for incomplete task detection
 */
export interface TaskProgress {
  completed: number;
  total: number;
}

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
  /** Subtasks for incomplete task detection */
  subtasks?: StuckDetectionSubtask[];
  /** Whether task has a spec/PRD (for incomplete detection) */
  hasSpec?: boolean;
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
  /** Callback when task is resumed (for incomplete tasks) */
  onResumed?: () => void;
}

/**
 * Return type for stuck detection hook
 */
export interface UseStuckDetectionReturn {
  /** Whether the task is considered stuck */
  isStuck: boolean;
  /** Whether the task is incomplete (has spec but no completed subtasks) */
  isIncomplete: boolean;
  /** Duration the task has been stuck (in ms) */
  stuckDuration: number;
  /** Subtask progress for incomplete tasks */
  taskProgress: TaskProgress;
  /** Whether recovery is in progress */
  isRecovering: boolean;
  /** Whether checking for stuck status */
  isChecking: boolean;
  /** Trigger recovery (restart the task) */
  handleRecover: () => Promise<void>;
  /** Trigger resume (for incomplete tasks) */
  handleResume: () => Promise<void>;
  /** Reset stuck status (e.g., when task resumes activity) */
  resetStuck: () => void;
}

/**
 * Parse a timestamp string with fallback to activity store
 *
 * Strategy:
 * 1. Try to parse the lastUpdated timestamp
 * 2. If invalid, use the activity store timestamp
 * 3. If no activity recorded, return null
 *
 * @param lastUpdated - ISO timestamp string or undefined
 * @param taskId - Task ID for activity store lookup
 * @returns Parsed timestamp in milliseconds, or null if no valid timestamp available
 */
function parseTimestampWithFallback(
  lastUpdated: string | undefined,
  taskId: string
): number | null {
  // Try to parse lastUpdated timestamp
  if (lastUpdated) {
    const parsed = new Date(lastUpdated).getTime();
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
    console.warn(`[useStuckDetection] Invalid lastUpdated timestamp: ${lastUpdated}, using fallback`);
  }

  // Fallback: Use activity store timestamp
  const timeSinceActivity = getTimeSinceActivity(taskId);
  if (timeSinceActivity !== null) {
    // Convert "time since activity" back to absolute timestamp
    return Date.now() - timeSinceActivity;
  }

  // No valid timestamp available
  return null;
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
 * const { isStuck, isIncomplete, stuckDuration, taskProgress, handleRecover, handleResume } = useStuckDetection({
 *   taskId: task.id,
 *   isRunning: task.status === "in_progress",
 *   workspacePath: "/path/to/workspace",
 *   lastUpdated: task.updated_at,
 *   subtasks: task.subtasks_detail,
 *   hasSpec: !!task.spec_content,
 * });
 * ```
 */
export function useStuckDetection({
  taskId,
  isRunning,
  workspacePath,
  lastUpdated,
  subtasks,
  hasSpec = false,
  checkInterval = STUCK_CHECK_INTERVAL_MS,
  stuckThreshold = STUCK_THRESHOLD_MS,
  enableProcessCheck = true,
  autoRestartOnRecovery = false,
  onRecovered,
  onResumed,
}: UseStuckDetectionOptions): UseStuckDetectionReturn {
  const [isStuck, setIsStuck] = useState(false);
  const [stuckDuration, setStuckDuration] = useState(0);
  const [isRecovering, setIsRecovering] = useState(false);
  const [isChecking, setIsChecking] = useState(false);

  // Calculate task progress for incomplete detection
  const taskProgress: TaskProgress = {
    completed: subtasks?.filter((s) => s.status === "completed").length ?? 0,
    total: subtasks?.length ?? 0,
  };

  // Detect incomplete task: has spec but no completed subtasks and not currently running
  const isIncomplete =
    hasSpec &&
    !isRunning &&
    taskProgress.total > 0 &&
    taskProgress.completed === 0;

  const lastCheckedRef = useRef<string | undefined>(lastUpdated);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isCheckingRef = useRef(false);
  const safetyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);

  const updateTaskStatus = useUpdateVibeKanbanTaskStatus();

  // Track mount state for cleanup
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      // Clear safety timeout on unmount to prevent memory leaks
      if (safetyTimeoutRef.current) {
        clearTimeout(safetyTimeoutRef.current);
        safetyTimeoutRef.current = null;
      }
    };
  }, []);

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

      // Safety timeout: If the async operation hangs for too long (e.g., network issues),
      // ensure we reset the checking state to allow future checks.
      // This prevents isCheckingRef from being stuck forever.
      safetyTimeoutRef.current = setTimeout(() => {
        // Only update state if component is still mounted
        if (isMountedRef.current) {
          console.warn("[useStuckDetection] Safety timeout triggered - resetting check state");
          isCheckingRef.current = false;
          setIsChecking(false);
        }
        safetyTimeoutRef.current = null;
      }, SAFETY_TIMEOUT_MS);

      try {
        // Layer 1: Check client-side activity tracking
        if (hasRecentActivity(taskId, stuckThreshold)) {
          setIsStuck(false);
          setStuckDuration(0);
          return;
        }

        // Layer 2: Check lastUpdated timestamp
        // Use helper function to parse timestamp with fallback
        const lastUpdateTime = parseTimestampWithFallback(lastUpdated, taskId);

        if (lastUpdateTime !== null) {
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
          if (lastUpdated && lastUpdated !== lastCheckedRef.current) {
            setIsStuck(false);
            setStuckDuration(0);
            lastCheckedRef.current = lastUpdated;
            return;
          }
        }

        // Layer 3: Verify with Gateway if process is actually running
        // Use detailed version to check reliability of the result
        if (enableProcessCheck) {
          const result = await checkTaskRunningDetailed(taskId, undefined, workspacePath);

          // Double-check activity after async call (race condition protection)
          if (hasRecentActivity(taskId, stuckThreshold)) {
            setIsStuck(false);
            setStuckDuration(0);
            return;
          }

          // Re-validate: check if lastUpdated changed during async call
          if (lastUpdated !== lastCheckedRef.current) {
            // State changed during check, skip this result
            return;
          }

          // If check was reliable and process is running, not stuck
          if (result.reliable && result.running) {
            // Process is running but no updates - could be slow, not stuck
            // Keep checking but don't mark as stuck yet
            return;
          }

          // If check was unreliable (network error), be conservative
          if (!result.reliable) {
            // Network issues - don't mark as stuck to avoid false positives
            console.warn(
              `[useStuckDetection] Unreliable check for task ${taskId}: ${result.error}. ` +
              "Skipping stuck detection to avoid false positive."
            );
            return;
          }

          // Reliable check says process is NOT running - task is stuck
        }

        // All checks indicate task is stuck
        // Calculate stuck duration using best available timestamp
        const now = Date.now();
        const effectiveLastUpdateTime = parseTimestampWithFallback(lastUpdated, taskId) ?? (now - stuckThreshold);
        const duration = now - effectiveLastUpdateTime;

        setIsStuck(true);
        setStuckDuration(duration);
      } finally {
        if (safetyTimeoutRef.current) {
          clearTimeout(safetyTimeoutRef.current);
          safetyTimeoutRef.current = null;
        }
        isCheckingRef.current = false;
        // Only update state if component is still mounted
        if (isMountedRef.current) {
          setIsChecking(false);
        }
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

  // Handle resume - for incomplete tasks (has spec but crashed before completing subtasks)
  const handleResume = useCallback(async () => {
    if (!workspacePath || isRecovering) return;

    try {
      setIsRecovering(true);

      // Move task to queue to restart execution
      await updateTaskStatus.mutateAsync({
        taskId,
        status: "queue",
        workspacePath,
      });

      // Notify callback
      onResumed?.();

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
    } catch (error) {
      console.error("Failed to resume task:", error);
      throw error;
    } finally {
      setIsRecovering(false);
    }
  }, [taskId, workspacePath, updateTaskStatus, isRecovering, autoRestartOnRecovery, onResumed]);

  // Manual reset
  const resetStuck = useCallback(() => {
    setIsStuck(false);
    setStuckDuration(0);
    lastCheckedRef.current = lastUpdated;
  }, [lastUpdated]);

  return {
    isStuck,
    isIncomplete,
    stuckDuration,
    taskProgress,
    isRecovering,
    isChecking,
    handleRecover,
    handleResume,
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
