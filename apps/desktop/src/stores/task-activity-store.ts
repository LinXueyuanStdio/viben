/**
 * Task Activity Store
 *
 * Tracks client-side activity for running tasks to prevent
 * false stuck detection. Records activity timestamps when
 * SSE events are received or task data is refreshed.
 *
 * Includes automatic cleanup of stale activity records to prevent memory leaks.
 */

import { create } from "zustand";
import {
  STUCK_THRESHOLD_MS,
  ACTIVITY_MAX_AGE_MS,
  ACTIVITY_CLEANUP_INTERVAL_MS,
} from "@/lib/kanban/constants";

interface TaskActivityState {
  /** Map<taskId, lastActivityTimestamp> */
  activities: Map<string, number>;

  /** Cleanup interval ID (for stopping cleanup on unmount) */
  _cleanupIntervalId: ReturnType<typeof setInterval> | null;

  /**
   * Record activity for a task
   * Called when SSE events or data updates are received
   */
  recordTaskActivity: (taskId: string) => void;

  /**
   * Check if a task has recent activity
   * @param taskId - Task ID to check
   * @param thresholdMs - Custom threshold (default: STUCK_THRESHOLD_MS)
   */
  hasRecentActivity: (taskId: string, thresholdMs?: number) => boolean;

  /**
   * Get time since last activity for a task
   * @returns Milliseconds since last activity, or null if no activity recorded
   */
  getTimeSinceActivity: (taskId: string) => number | null;

  /**
   * Clear activity for a task (when it completes or is deleted)
   */
  clearTaskActivity: (taskId: string) => void;

  /**
   * Clear all task activities
   */
  clearAll: () => void;

  /**
   * Clean up stale activity records (older than ACTIVITY_MAX_AGE_MS)
   * Prevents memory leaks from accumulating old records
   * @returns Number of records cleaned up
   */
  cleanupStaleActivities: () => number;

  /**
   * Start automatic cleanup interval
   * Should be called when the app starts
   */
  startCleanupInterval: () => void;

  /**
   * Stop automatic cleanup interval
   * Should be called when the app unmounts
   */
  stopCleanupInterval: () => void;
}

export const useTaskActivityStore = create<TaskActivityState>((set, get) => ({
  activities: new Map(),
  _cleanupIntervalId: null,

  recordTaskActivity: (taskId) => {
    set((state) => {
      const newActivities = new Map(state.activities);
      newActivities.set(taskId, Date.now());
      return { activities: newActivities };
    });
  },

  hasRecentActivity: (taskId, thresholdMs = STUCK_THRESHOLD_MS) => {
    const lastActivity = get().activities.get(taskId);
    if (!lastActivity) return false;
    return Date.now() - lastActivity < thresholdMs;
  },

  getTimeSinceActivity: (taskId) => {
    const lastActivity = get().activities.get(taskId);
    if (!lastActivity) return null;
    return Date.now() - lastActivity;
  },

  clearTaskActivity: (taskId) => {
    set((state) => {
      const newActivities = new Map(state.activities);
      newActivities.delete(taskId);
      return { activities: newActivities };
    });
  },

  clearAll: () => {
    set({ activities: new Map() });
  },

  cleanupStaleActivities: () => {
    const now = Date.now();
    const state = get();
    let cleanedCount = 0;

    const newActivities = new Map<string, number>();
    for (const [taskId, timestamp] of state.activities) {
      if (now - timestamp < ACTIVITY_MAX_AGE_MS) {
        newActivities.set(taskId, timestamp);
      } else {
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`[TaskActivityStore] Cleaned up ${cleanedCount} stale activity records`);
      set({ activities: newActivities });
    }

    return cleanedCount;
  },

  startCleanupInterval: () => {
    const state = get();
    // Don't start if already running
    if (state._cleanupIntervalId) return;

    const intervalId = setInterval(() => {
      get().cleanupStaleActivities();
    }, ACTIVITY_CLEANUP_INTERVAL_MS);

    set({ _cleanupIntervalId: intervalId });
    console.log("[TaskActivityStore] Started automatic cleanup interval");
  },

  stopCleanupInterval: () => {
    const state = get();
    if (state._cleanupIntervalId) {
      clearInterval(state._cleanupIntervalId);
      set({ _cleanupIntervalId: null });
      console.log("[TaskActivityStore] Stopped automatic cleanup interval");
    }
  },
}));

// Auto-start cleanup interval when module loads
// This ensures cleanup runs even if no component explicitly starts it
if (typeof window !== "undefined") {
  // Only run in browser environment
  useTaskActivityStore.getState().startCleanupInterval();
}

/**
 * Convenience function to record task activity
 * Can be called directly without using the hook
 */
export const recordTaskActivity = (taskId: string): void =>
  useTaskActivityStore.getState().recordTaskActivity(taskId);

/**
 * Convenience function to check if task has recent activity
 * Can be called directly without using the hook
 */
export const hasRecentActivity = (
  taskId: string,
  thresholdMs?: number
): boolean =>
  useTaskActivityStore.getState().hasRecentActivity(taskId, thresholdMs);

/**
 * Convenience function to get time since last activity
 */
export const getTimeSinceActivity = (taskId: string): number | null =>
  useTaskActivityStore.getState().getTimeSinceActivity(taskId);

/**
 * Convenience function to clear task activity
 */
export const clearTaskActivity = (taskId: string): void =>
  useTaskActivityStore.getState().clearTaskActivity(taskId);
