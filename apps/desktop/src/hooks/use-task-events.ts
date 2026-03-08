/**
 * Hook for subscribing to task state machine events via SSE
 *
 * Provides real-time updates when task state changes occur.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { subscribeTaskEvents } from "@/lib/gateway/modules/tasks";
import { getGatewayUrl } from "@/lib/gateway";
import { recordTaskActivity } from "@/stores/task-activity-store";
import type {
  TaskEvent,
  TaskSSEEvent,
  TaskSSEStateChangedEvent,
  TaskSSERecoveredEvent,
} from "@/lib/vibe-kanban/types";

export interface UseTaskEventsOptions {
  /** Whether to auto-connect on mount */
  autoConnect?: boolean;
  /** Callback when state changes */
  onStateChanged?: (event: TaskSSEStateChangedEvent) => void;
  /** Callback when task is recovered */
  onTaskRecovered?: (event: TaskSSERecoveredEvent) => void;
  /** Callback on connection error */
  onError?: (error: Event) => void;
  /** Callback on connection open */
  onOpen?: () => void;
}

export interface UseTaskEventsReturn {
  /** Whether currently connected to SSE stream */
  isConnected: boolean;
  /** Last received event */
  lastEvent: TaskEvent | null;
  /** Connection error */
  error: string | null;
  /** Subscribe to task events */
  subscribe: () => void;
  /** Unsubscribe from task events */
  unsubscribe: () => void;
}

/**
 * Hook for subscribing to task state machine events
 *
 * @param taskId - Task ID to subscribe to (null to skip subscription)
 * @param workspacePath - Workspace path
 * @param options - Hook options
 * @returns SSE subscription state and controls
 *
 * @example
 * ```tsx
 * const { isConnected, lastEvent, subscribe, unsubscribe } = useTaskEvents(
 *   task.id,
 *   workspacePath,
 *   {
 *     autoConnect: true,
 *     onStateChanged: (event) => {
 *       console.log('Task state changed:', event.new_state);
 *       // Refresh task data
 *     },
 *     onTaskRecovered: (event) => {
 *       toast.info(`Task recovered: ${event.reason}`);
 *     },
 *   }
 * );
 * ```
 */
export function useTaskEvents(
  taskId: string | null,
  workspacePath: string,
  options: UseTaskEventsOptions = {}
): UseTaskEventsReturn {
  const {
    autoConnect = false,
    onStateChanged,
    onTaskRecovered,
    onError,
    onOpen,
  } = options;

  const gatewayUrl = useMemo(() => getGatewayUrl(), []);
  const eventSourceRef = useRef<EventSource | null>(null);
  const lastSequenceRef = useRef<number>(0); // Track last received sequence for event replay
  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<TaskEvent | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      setIsConnected(false);
    }
  }, []);

  // Subscribe to task events
  const subscribe = useCallback(() => {
    if (!taskId || !workspacePath || !gatewayUrl) {
      return;
    }

    // Cleanup existing connection
    cleanup();
    setError(null);

    try {
      // Pass lastSequence for event replay on reconnect
      const eventSource = subscribeTaskEvents(
        gatewayUrl,
        taskId,
        workspacePath,
        lastSequenceRef.current > 0 ? lastSequenceRef.current : undefined
      );
      eventSourceRef.current = eventSource;

      // Handle connection open
      eventSource.onopen = () => {
        setIsConnected(true);
        setError(null);
        onOpen?.();
      };

      // Handle connection error
      eventSource.onerror = (e) => {
        setIsConnected(false);
        setError("Connection error");
        onError?.(e);
      };

      // Handle STATE_CHANGED events
      eventSource.addEventListener("STATE_CHANGED", (e) => {
        try {
          const data = JSON.parse(e.data) as TaskSSEStateChangedEvent;
          // Track sequence number for event replay on reconnect
          if (data.event?.sequence) {
            lastSequenceRef.current = data.event.sequence;
          }
          // Record activity for stuck detection
          if (taskId) {
            recordTaskActivity(taskId);
          }
          setLastEvent(data.event);
          onStateChanged?.(data);
        } catch (err) {
          console.error("[useTaskEvents] Failed to parse STATE_CHANGED event:", err);
        }
      });

      // Handle TASK_RECOVERED events
      eventSource.addEventListener("TASK_RECOVERED", (e) => {
        try {
          const data = JSON.parse(e.data) as TaskSSERecoveredEvent;
          // Record activity for stuck detection
          if (taskId) {
            recordTaskActivity(taskId);
          }
          onTaskRecovered?.(data);
        } catch (err) {
          console.error("[useTaskEvents] Failed to parse TASK_RECOVERED event:", err);
        }
      });

      // Handle generic message events (fallback)
      eventSource.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data) as TaskSSEEvent;
          // Track sequence number for event replay on reconnect
          if (data.type === "STATE_CHANGED") {
            const stateEvent = data as TaskSSEStateChangedEvent;
            if (stateEvent.event?.sequence) {
              lastSequenceRef.current = stateEvent.event.sequence;
            }
          }
          // Record activity for any valid event
          if (taskId && (data.type === "STATE_CHANGED" || data.type === "TASK_RECOVERED")) {
            recordTaskActivity(taskId);
          }
          if (data.type === "STATE_CHANGED") {
            setLastEvent((data as TaskSSEStateChangedEvent).event);
            onStateChanged?.(data as TaskSSEStateChangedEvent);
          } else if (data.type === "TASK_RECOVERED") {
            onTaskRecovered?.(data as TaskSSERecoveredEvent);
          }
        } catch (err) {
          // Ignore parse errors for non-JSON messages
        }
      };
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect");
    }
  }, [taskId, workspacePath, gatewayUrl, cleanup, onStateChanged, onTaskRecovered, onError, onOpen]);

  // Unsubscribe from task events
  const unsubscribe = useCallback(() => {
    cleanup();
    setError(null);
  }, [cleanup]);

  // Auto-connect on mount if enabled
  useEffect(() => {
    if (autoConnect && taskId && workspacePath) {
      subscribe();
    }

    return () => {
      cleanup();
    };
  }, [autoConnect, taskId, workspacePath, subscribe, cleanup]);

  return {
    isConnected,
    lastEvent,
    error,
    subscribe,
    unsubscribe,
  };
}

export default useTaskEvents;
