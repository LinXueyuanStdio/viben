/**
 * Hook to track elapsed time for running tasks
 *
 * Uses setInterval to update elapsed time every second when the task is running.
 * Returns 0 when not running.
 */

import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

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
  /** Formatted elapsed time string (e.g., "5分32秒", "1小时23分") */
  formattedTime: string;
}

/**
 * Elapsed time parts for formatting
 */
export interface ElapsedTimeParts {
  hours: number;
  minutes: number;
  seconds: number;
}

/**
 * Get elapsed time parts from milliseconds
 */
export function getElapsedTimeParts(ms: number): ElapsedTimeParts {
  const totalSeconds = Math.floor(ms / 1000);
  return {
    hours: Math.floor(totalSeconds / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  };
}

/**
 * Format elapsed time in a human-readable way (non-i18n version)
 * For i18n version, use formatElapsedTimeI18n function
 * @param ms - Elapsed time in milliseconds
 * @returns Formatted string (e.g., "5 min 32 sec" or "1 hr 23 min")
 */
export function formatElapsedTime(ms: number): string {
  const { hours, minutes, seconds } = getElapsedTimeParts(ms);
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;

  // More than a day
  if (days > 0) {
    if (remainingHours > 0) {
      return `${days}d ${remainingHours}h`;
    }
    return `${days}d`;
  }

  // Hours range
  if (hours > 0) {
    if (minutes > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${hours}h`;
  }

  // Minutes range
  if (minutes > 0) {
    if (seconds > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${minutes}m`;
  }

  // Seconds only
  if (seconds > 0) {
    return `${seconds}s`;
  }

  // Just started
  return "0s";
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

  // Get translated formatted time
  const { t } = useTranslation();
  const formattedTime = formatElapsedTimeI18n(elapsedTime, t);

  return {
    elapsedTime,
    formattedTime,
  };
}

/**
 * Format elapsed time with i18n support
 * Produces human-readable output like:
 * - "刚刚" / "just now" (< 5s)
 * - "10 秒" / "10 seconds" (< 1min)
 * - "3 分钟" / "3 minutes" (< 1hr)
 * - "1 小时 23 分钟" / "1 hour 23 minutes" (< 1day)
 * - "2 天 5 小时" / "2 days 5 hours" (>= 1day)
 *
 * @param ms - Elapsed time in milliseconds
 * @param t - i18n translation function
 * @returns Translated formatted string
 */
export function formatElapsedTimeI18n(
  ms: number,
  t: (key: string, defaultValue: string, options?: Record<string, unknown>) => string
): string {
  const { hours, minutes, seconds } = getElapsedTimeParts(ms);
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;

  // Just started (< 5 seconds)
  if (hours === 0 && minutes === 0 && seconds < 5) {
    return t("elapsedTime.justNow", "just now");
  }

  // More than a day
  if (days > 0) {
    if (remainingHours > 0) {
      return t("elapsedTime.daysHours", "{{days}}d {{hours}}h", {
        days,
        hours: remainingHours,
      });
    }
    return t("elapsedTime.days", "{{days}}d", { days });
  }

  // Hours range (1-23 hours)
  if (hours > 0) {
    if (minutes > 0) {
      return t("elapsedTime.hoursMinutes", "{{hours}}h {{minutes}}m", {
        hours,
        minutes,
      });
    }
    return t("elapsedTime.hours", "{{hours}}h", { hours });
  }

  // Minutes range (1-59 minutes)
  if (minutes > 0) {
    if (seconds > 0 && minutes < 10) {
      // Show seconds only for short durations (< 10 min)
      return t("elapsedTime.minutesSeconds", "{{minutes}}m {{seconds}}s", {
        minutes,
        seconds,
      });
    }
    return t("elapsedTime.minutes", "{{minutes}}m", { minutes });
  }

  // Seconds only (5-59 seconds)
  return t("elapsedTime.seconds", "{{seconds}}s", { seconds });
}

export default useElapsedTime;
