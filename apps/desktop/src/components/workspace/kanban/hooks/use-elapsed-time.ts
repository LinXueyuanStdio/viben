/**
 * Hook to track elapsed time for running tasks
 *
 * Uses setInterval to update elapsed time every second when the task is running.
 * Returns 0 when not running.
 */

import { useState, useEffect, useRef } from "react";

export interface UseElapsedTimeOptions {
  /** Whether the task is currently running */
  isRunning: boolean;
  /** Start timestamp (ISO string) - defaults to task.updated_at */
  startTime?: string;
  /** Update interval in milliseconds (default: 1000ms = 1 second) */
  updateInterval?: number;
}

export interface UseElapsedTimeReturn {
  /** Elapsed time in milliseconds */
  elapsedTime: number;
  /** Formatted elapsed time string (e.g., "5:32", "1:23:45") */
  formattedTime: string;
}

/**
 * Format elapsed time as HH:MM:SS or MM:SS
 * @param ms - Elapsed time in milliseconds
 * @returns Formatted string (e.g., "5:32" or "1:23:45")
 */
export function formatElapsedTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

/**
 * Hook to track elapsed time for running tasks
 *
 * @example
 * ```tsx
 * const { elapsedTime, formattedTime } = useElapsedTime({
 *   isRunning: task.has_in_progress_attempt,
 *   startTime: task.updated_at,
 * });
 * ```
 */
export function useElapsedTime({
  isRunning,
  startTime,
  updateInterval = 1000,
}: UseElapsedTimeOptions): UseElapsedTimeReturn {
  const [elapsedTime, setElapsedTime] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (!isRunning) {
      // Reset when not running
      setElapsedTime(0);
      startTimeRef.current = null;
      return;
    }

    // Parse start time
    const parsedStartTime = startTime ? new Date(startTime).getTime() : null;
    if (parsedStartTime && !Number.isNaN(parsedStartTime)) {
      startTimeRef.current = parsedStartTime;
    } else {
      // If no valid start time, use current time as start
      startTimeRef.current = Date.now();
    }

    // Update function
    const updateElapsedTime = () => {
      if (startTimeRef.current !== null) {
        const now = Date.now();
        const elapsed = now - startTimeRef.current;
        setElapsedTime(Math.max(0, elapsed));
      }
    };

    // Initial update
    updateElapsedTime();

    // Set up interval
    intervalRef.current = setInterval(updateElapsedTime, updateInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isRunning, startTime, updateInterval]);

  return {
    elapsedTime,
    formattedTime: formatElapsedTime(elapsedTime),
  };
}

export default useElapsedTime;
