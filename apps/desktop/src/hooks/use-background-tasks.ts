/**
 * useBackgroundTasks Hook
 *
 * Subscribes to background task updates via SSE from the Gateway.
 * Provides real-time task status and management capabilities.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { getGatewayUrl } from "@/lib/gateway";

// ============================================================================
// Types
// ============================================================================

/**
 * Background task status
 */
export type BackgroundTaskStatus = "running" | "completed" | "error" | "cancelled";

/**
 * Background task data
 */
export interface BackgroundTask {
  /** Unique task ID */
  taskId: string;
  /** Agent session ID (for stopping) */
  sessionId: string;
  /** User prompt (for display) */
  prompt: string;
  /** Task status */
  status: BackgroundTaskStatus;
  /** Start time (ISO string) */
  startedAt: string;
  /** Completion time (ISO string) */
  completedAt?: string;
  /** Error message if failed */
  errorMessage?: string;
  /** API cost */
  cost?: number;
  /** Execution duration in ms */
  duration?: number;
}

/**
 * SSE message types from server
 */
interface TasksSSEMessage {
  type: "tasks" | "ping";
  tasks?: BackgroundTask[];
}

/**
 * Hook return type
 */
export interface UseBackgroundTasksReturn {
  /** All tasks */
  tasks: BackgroundTask[];
  /** Running tasks only */
  runningTasks: BackgroundTask[];
  /** Count of running tasks */
  runningCount: number;
  /** Recently completed tasks (completed within last 5 minutes) */
  recentlyCompletedTasks: BackgroundTask[];
  /** Stop a running task */
  stopTask: (taskId: string) => Promise<void>;
  /** Clear completed tasks from view */
  clearCompleted: () => void;
  /** Whether SSE connection is active */
  isConnected: boolean;
  /** Connection error if any */
  connectionError: string | null;
}

// ============================================================================
// Constants
// ============================================================================

/** SSE reconnect delay in ms */
const RECONNECT_DELAY_MS = 5000;

/** Recent tasks threshold (5 minutes) */
const RECENT_TASKS_THRESHOLD_MS = 5 * 60 * 1000;

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Subscribe to background task updates from Gateway
 */
export function useBackgroundTasks(): UseBackgroundTasksReturn {
  const [tasks, setTasks] = useState<BackgroundTask[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [hiddenTaskIds, setHiddenTaskIds] = useState<Set<string>>(new Set());

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Connect to SSE endpoint
  useEffect(() => {
    const connect = () => {
      const gatewayUrl = getGatewayUrl();
      const sseUrl = `${gatewayUrl}/api/agent/tasks/subscribe`;

      console.log("[useBackgroundTasks] Connecting to:", sseUrl);

      try {
        const eventSource = new EventSource(sseUrl);
        eventSourceRef.current = eventSource;

        eventSource.onopen = () => {
          console.log("[useBackgroundTasks] SSE connected");
          setIsConnected(true);
          setConnectionError(null);
        };

        eventSource.onmessage = (event) => {
          try {
            const data: TasksSSEMessage = JSON.parse(event.data);

            if (data.type === "tasks" && data.tasks) {
              setTasks(data.tasks);
            }
            // Ignore ping messages
          } catch (err) {
            console.error("[useBackgroundTasks] Parse error:", err);
          }
        };

        eventSource.onerror = (event) => {
          console.error("[useBackgroundTasks] SSE error:", event);
          setIsConnected(false);
          setConnectionError("Connection lost");

          // Close and reconnect
          eventSource.close();
          eventSourceRef.current = null;

          // Schedule reconnect
          if (!reconnectTimerRef.current) {
            reconnectTimerRef.current = setTimeout(() => {
              reconnectTimerRef.current = null;
              connect();
            }, RECONNECT_DELAY_MS);
          }
        };
      } catch (err) {
        console.error("[useBackgroundTasks] Failed to create EventSource:", err);
        setConnectionError("Failed to connect");

        // Schedule reconnect
        if (!reconnectTimerRef.current) {
          reconnectTimerRef.current = setTimeout(() => {
            reconnectTimerRef.current = null;
            connect();
          }, RECONNECT_DELAY_MS);
        }
      }
    };

    connect();

    // Cleanup
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };
  }, []);

  // Stop a task
  const stopTask = useCallback(async (taskId: string) => {
    const gatewayUrl = getGatewayUrl();
    try {
      const response = await fetch(`${gatewayUrl}/api/agent/tasks/${taskId}/stop`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error(`Failed to stop task: ${response.statusText}`);
      }

      console.log("[useBackgroundTasks] Stopped task:", taskId);
    } catch (err) {
      console.error("[useBackgroundTasks] Failed to stop task:", err);
      throw err;
    }
  }, []);

  // Clear completed tasks from view
  const clearCompleted = useCallback(() => {
    const completedIds = tasks
      .filter((t) => t.status === "completed" || t.status === "error" || t.status === "cancelled")
      .map((t) => t.taskId);

    setHiddenTaskIds((prev) => new Set([...prev, ...completedIds]));
  }, [tasks]);

  // Filter visible tasks (excluding hidden)
  const visibleTasks = tasks.filter((t) => !hiddenTaskIds.has(t.taskId));

  // Running tasks
  const runningTasks = visibleTasks.filter((t) => t.status === "running");

  // Recently completed tasks (within threshold)
  const recentlyCompletedTasks = visibleTasks.filter((t) => {
    if (t.status === "running") return false;
    if (!t.completedAt) return false;

    const completedTime = new Date(t.completedAt).getTime();
    const now = Date.now();
    return now - completedTime < RECENT_TASKS_THRESHOLD_MS;
  });

  return {
    tasks: visibleTasks,
    runningTasks,
    runningCount: runningTasks.length,
    recentlyCompletedTasks,
    stopTask,
    clearCompleted,
    isConnected,
    connectionError,
  };
}
