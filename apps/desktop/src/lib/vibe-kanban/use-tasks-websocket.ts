/**
 * WebSocket hook for real-time task streaming with JSON Patch
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { applyPatch, type Operation } from "fast-json-patch";
import type { TaskWithAttemptStatus } from "./types";
import {
  type WebSocketState,
  type UseWebSocketReturn,
  buildTasksWebSocketUrl,
  isJsonPatchMessage,
  isStreamFinishedMessage,
} from "./websocket-types";

interface UseTasksWebSocketOptions {
  /** Enable automatic reconnection (default: true) */
  autoReconnect?: boolean;
  /** Maximum reconnection attempts (default: 10) */
  maxReconnectAttempts?: number;
  /** Base delay for exponential backoff in ms (default: 1000) */
  baseReconnectDelay?: number;
  /** Maximum reconnection delay in ms (default: 8000) */
  maxReconnectDelay?: number;
}

const DEFAULT_OPTIONS: Required<UseTasksWebSocketOptions> = {
  autoReconnect: true,
  maxReconnectAttempts: 10,
  baseReconnectDelay: 1000,
  maxReconnectDelay: 8000,
};

/**
 * Hook for streaming task updates via WebSocket with JSON Patch
 *
 * @param projectId - Project ID to stream tasks for (null to disable)
 * @param options - Configuration options
 * @returns WebSocket state and data
 */
export function useTasksWebSocket(
  projectId: string | null,
  options: UseTasksWebSocketOptions = {}
): UseWebSocketReturn<TaskWithAttemptStatus[]> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // State
  const [data, setData] = useState<TaskWithAttemptStatus[] | null>(null);
  const [connectionState, setConnectionState] =
    useState<WebSocketState>("disconnected");
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Refs for managing connection
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const isMountedRef = useRef(true);

  // Clear reconnect timeout
  const clearReconnectTimeout = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  // Calculate reconnect delay with exponential backoff
  const getReconnectDelay = useCallback(() => {
    const delay = Math.min(
      opts.baseReconnectDelay * Math.pow(2, reconnectAttemptRef.current),
      opts.maxReconnectDelay
    );
    return delay;
  }, [opts.baseReconnectDelay, opts.maxReconnectDelay]);

  // Disconnect WebSocket
  const disconnect = useCallback(() => {
    clearReconnectTimeout();
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (isMountedRef.current) {
      setConnectionState("disconnected");
    }
  }, [clearReconnectTimeout]);

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (!projectId) return;

    // Close existing connection
    if (wsRef.current) {
      wsRef.current.close();
    }

    const url = buildTasksWebSocketUrl(projectId);
    setConnectionState("connecting");
    setError(null);

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!isMountedRef.current) return;
        setConnectionState("connected");
        reconnectAttemptRef.current = 0;
        // Reset data to receive fresh snapshot
        setData(null);
        setIsInitialized(false);
      };

      ws.onmessage = (event) => {
        if (!isMountedRef.current) return;

        try {
          const message = JSON.parse(event.data);

          if (isStreamFinishedMessage(message)) {
            // Initial snapshot complete
            setIsInitialized(true);
            return;
          }

          if (isJsonPatchMessage(message)) {
            const operations = message.patch;

            setData((currentData) => {
              // Initialize with empty array if null
              const baseData = currentData ?? [];

              try {
                // Apply JSON Patch operations
                const result = applyPatch(
                  baseData,
                  operations as Operation[],
                  // Don't validate paths to allow array index operations
                  false,
                  // Don't mutate original
                  false
                );
                return result.newDocument;
              } catch (patchError) {
                console.error(
                  "[useTasksWebSocket] Failed to apply patch:",
                  patchError,
                  operations
                );
                // Return current data on patch error
                return currentData;
              }
            });
          }
        } catch (parseError) {
          console.error(
            "[useTasksWebSocket] Failed to parse message:",
            parseError
          );
        }
      };

      ws.onerror = (event) => {
        if (!isMountedRef.current) return;
        console.error("[useTasksWebSocket] WebSocket error:", event);
        setError(new Error("WebSocket connection error"));
        setConnectionState("error");
      };

      ws.onclose = (event) => {
        if (!isMountedRef.current) return;

        wsRef.current = null;

        // Check if this was a clean close or an error
        if (event.code !== 1000 && event.code !== 1001) {
          setConnectionState("error");
          setError(
            new Error(`WebSocket closed with code ${event.code}: ${event.reason}`)
          );
        } else {
          setConnectionState("disconnected");
        }

        // Auto-reconnect logic
        if (
          opts.autoReconnect &&
          reconnectAttemptRef.current < opts.maxReconnectAttempts
        ) {
          const delay = getReconnectDelay();
          reconnectAttemptRef.current += 1;

          reconnectTimeoutRef.current = setTimeout(() => {
            if (isMountedRef.current) {
              connect();
            }
          }, delay);
        }
      };
    } catch (err) {
      if (!isMountedRef.current) return;
      setError(err instanceof Error ? err : new Error("Failed to connect"));
      setConnectionState("error");
    }
  }, [
    projectId,
    opts.autoReconnect,
    opts.maxReconnectAttempts,
    getReconnectDelay,
  ]);

  // Manual reconnect
  const reconnect = useCallback(() => {
    reconnectAttemptRef.current = 0;
    clearReconnectTimeout();
    disconnect();
    connect();
  }, [connect, disconnect, clearReconnectTimeout]);

  // Effect: Connect when projectId changes
  useEffect(() => {
    isMountedRef.current = true;

    if (projectId) {
      connect();
    } else {
      disconnect();
      setData(null);
      setIsInitialized(false);
    }

    return () => {
      isMountedRef.current = false;
      clearReconnectTimeout();
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [projectId, connect, disconnect, clearReconnectTimeout]);

  return {
    data,
    connectionState,
    isInitialized,
    error,
    reconnect,
    disconnect,
  };
}
