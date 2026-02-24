/**
 * useLocalBackgroundTasks Hook
 *
 * Subscribe to local background task updates.
 * For client-side task management (task switching, AbortController preservation).
 *
 * Note: For Gateway-synced tasks, use useBackgroundTasks instead.
 */

import { useState, useEffect, useCallback } from "react";
import {
  getAllBackgroundTasks,
  subscribeToBackgroundTasks,
  stopBackgroundTask,
  clearAllBackgroundTasks,
  type LocalBackgroundTask,
} from "@/lib/background-tasks";

/**
 * Hook return type
 */
export interface UseLocalBackgroundTasksReturn {
  /** All local background tasks */
  tasks: LocalBackgroundTask[];
  /** Running tasks only */
  runningTasks: LocalBackgroundTask[];
  /** Count of running tasks */
  runningCount: number;
  /** Stop a running task */
  stopTask: (taskId: string) => void;
  /** Clear all background tasks */
  clearAll: () => void;
}

/**
 * Subscribe to local background task updates
 */
export function useLocalBackgroundTasks(): UseLocalBackgroundTasksReturn {
  const [tasks, setTasks] = useState<LocalBackgroundTask[]>(() =>
    getAllBackgroundTasks()
  );

  useEffect(() => {
    // Subscribe to task changes
    const unsubscribe = subscribeToBackgroundTasks((updatedTasks) => {
      setTasks(updatedTasks);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Running tasks
  const runningTasks = tasks.filter((t) => t.isRunning);

  // Stop a task
  const stopTask = useCallback((taskId: string) => {
    stopBackgroundTask(taskId);
  }, []);

  // Clear all tasks
  const clearAll = useCallback(() => {
    clearAllBackgroundTasks();
  }, []);

  return {
    tasks,
    runningTasks,
    runningCount: runningTasks.length,
    stopTask,
    clearAll,
  };
}
