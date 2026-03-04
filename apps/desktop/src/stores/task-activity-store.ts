/**
 * Task Activity Store
 *
 * Tracks client-side activity for running tasks to prevent
 * false stuck detection. Records activity timestamps when
 * SSE events are received or task data is refreshed.
 */

import { create } from "zustand";

/**
 * Activity threshold in milliseconds (60 seconds)
 * Tasks with activity more recent than this are considered active
 */
const ACTIVITY_THRESHOLD_MS = 60_000;

interface TaskActivityState {
  /** Map<taskId, lastActivityTimestamp> */
  activities: Map<string, number>;

  /**
   * Record activity for a task
   * Called when SSE events or data updates are received
   */
  recordTaskActivity: (taskId: string) => void;

  /**
   * Check if a task has recent activity
   * @param taskId - Task ID to check
   * @param thresholdMs - Custom threshold (default: 60s)
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
}

export const useTaskActivityStore = create<TaskActivityState>((set, get) => ({
  activities: new Map(),

  recordTaskActivity: (taskId) => {
    set((state) => {
      const newActivities = new Map(state.activities);
      newActivities.set(taskId, Date.now());
      return { activities: newActivities };
    });
  },

  hasRecentActivity: (taskId, thresholdMs = ACTIVITY_THRESHOLD_MS) => {
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
}));

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
