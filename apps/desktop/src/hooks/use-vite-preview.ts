/**
 * useVitePreview Hook
 *
 * Manages the lifecycle of a Vite preview server for live preview functionality.
 * Provides start/stop controls and status monitoring via Gateway API with SSE support.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import i18n from "@/i18n";
import { getGatewayUrl } from "@/lib/gateway/config";
import {
  checkNodeAvailable as apiCheckNodeAvailable,
  getPreviewStatus as apiGetPreviewStatus,
  startPreviewWithSSE as apiStartPreviewWithSSE,
  stopPreview as apiStopPreview,
  killPort as apiKillPort,
  type PreviewStatusResponse,
  type PreviewServerStatus,
} from "@/lib/gateway/modules/preview";

/**
 * Preview server status
 */
export type PreviewStatus = PreviewServerStatus;

/**
 * Port conflict info
 */
export interface PortConflict {
  port: number;
  workingDir: string;
  options?: StartPreviewOptions;
}

/**
 * Preview state
 */
export interface PreviewState {
  previewUrl: string | null;
  status: PreviewStatus;
  error: string | null;
  port: number | null;
  /** Non-null when a port conflict is detected, awaiting user decision */
  portConflict: PortConflict | null;
  /** Log messages from the server startup */
  logs: string[];
  /** Current retry attempt (if retrying) */
  retryAttempt: number | null;
  /** Max retry attempts */
  maxRetryAttempts: number | null;
}

/**
 * Options for starting a preview server
 */
export interface StartPreviewOptions {
  /** Custom command (e.g., "npm run serve") */
  command?: string;
  /** Preferred port */
  port?: number;
  /** Regex pattern to detect server ready */
  ready_pattern?: string;
  /** Startup timeout in ms */
  timeout?: number;
}

/**
 * Hook return type
 */
export interface UseVitePreviewReturn extends PreviewState {
  startPreview: (workingDir: string, options?: StartPreviewOptions) => void;
  stopPreview: () => Promise<void>;
  refreshPreview: () => void;
  refreshStatus: () => Promise<void>;
  isNodeAvailable: boolean | null;
  checkNodeAvailable: () => Promise<boolean>;
  /** Kill the process on the conflicting port and retry */
  killPortAndRetry: () => Promise<void>;
  /** Retry with an auto-assigned port (ignore preferred port) */
  retryWithNewPort: () => void;
  /** Dismiss the port conflict (cancel) */
  dismissPortConflict: () => void;
  /** Clear logs */
  clearLogs: () => void;
}

/**
 * Hook to manage Vite preview server lifecycle
 *
 * @param taskId - Unique identifier for the preview session (usually workspace or task ID)
 * @returns Preview state and control functions
 */
export function useVitePreview(taskId: string | null): UseVitePreviewReturn {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<PreviewStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [port, setPort] = useState<number | null>(null);
  const [isNodeAvailable, setIsNodeAvailable] = useState<boolean | null>(null);
  const [portConflict, setPortConflict] = useState<PortConflict | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [retryAttempt, setRetryAttempt] = useState<number | null>(null);
  const [maxRetryAttempts, setMaxRetryAttempts] = useState<number | null>(null);

  const taskIdRef = useRef<string | null>(taskId);
  const iframeKeyRef = useRef<number>(0);
  const abortSSERef = useRef<(() => void) | null>(null);
  const mountedRef = useRef(true);

  // Update taskIdRef when taskId changes
  useEffect(() => {
    taskIdRef.current = taskId;
  }, [taskId]);

  // Track mounted state and cleanup SSE on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (abortSSERef.current) {
        abortSSERef.current();
        abortSSERef.current = null;
      }
    };
  }, []);

  /**
   * Check if Node.js is available
   */
  const checkNodeAvailable = useCallback(async (): Promise<boolean> => {
    try {
      const baseUrl = getGatewayUrl();
      const available = await apiCheckNodeAvailable(baseUrl);
      if (mountedRef.current) {
        setIsNodeAvailable(available);
      }
      return available;
    } catch (err) {
      console.warn("[useVitePreview] Failed to check Node.js availability:", err);
      if (mountedRef.current) {
        setIsNodeAvailable(false);
      }
      return false;
    }
  }, []);

  // Check Node.js availability on mount
  useEffect(() => {
    checkNodeAvailable();
  }, [checkNodeAvailable]);

  /**
   * Update local state from API response
   */
  const updateStateFromResponse = useCallback((data: PreviewStatusResponse) => {
    if (!mountedRef.current) return;
    const mappedStatus: PreviewStatus = data.status === "stopped" ? "idle" : data.status;
    setStatus(mappedStatus);
    setPreviewUrl(data.url || null);
    setPort(data.hostPort || null);
    setError(data.error || null);
    setRetryAttempt(null);
    setMaxRetryAttempts(null);
  }, []);

  /**
   * Fetch current status from Gateway API
   */
  const refreshStatus = useCallback(async () => {
    if (!taskIdRef.current) return;

    try {
      const baseUrl = getGatewayUrl();
      const data = await apiGetPreviewStatus(baseUrl, taskIdRef.current);
      updateStateFromResponse(data);
    } catch (err) {
      console.warn("[useVitePreview] Error fetching status:", err);
      if (mountedRef.current) {
        // Assume idle if we can't get status
        setStatus("idle");
        setPreviewUrl(null);
        setPort(null);
        setError(null);
      }
    }
  }, [updateStateFromResponse]);

  // Reset state and abort SSE when taskId changes
  useEffect(() => {
    // Abort any existing SSE connection when taskId changes
    if (abortSSERef.current) {
      abortSSERef.current();
      abortSSERef.current = null;
    }

    if (taskId) {
      // Check if there's an existing preview for this task
      refreshStatus();
    } else {
      setPreviewUrl(null);
      setStatus("idle");
      setError(null);
      setPort(null);
      setLogs([]);
    }
  }, [taskId, refreshStatus]);

  /**
   * Add a log message
   */
  const addLog = useCallback((message: string) => {
    if (!mountedRef.current) return;
    setLogs((prev) => [...prev.slice(-99), message]); // Keep last 100 logs
  }, []);

  /**
   * Clear logs
   */
  const clearLogs = useCallback(() => {
    if (!mountedRef.current) return;
    setLogs([]);
  }, []);

  /**
   * Start the preview server with SSE
   */
  const startPreview = useCallback(
    (workingDir: string, options?: StartPreviewOptions) => {
      if (!taskIdRef.current) {
        setError(i18n.t("errors.vitePreview.noTaskId"));
        setStatus("error");
        return;
      }

      // Abort any existing SSE connection
      if (abortSSERef.current) {
        abortSSERef.current();
        abortSSERef.current = null;
      }

      setStatus("starting");
      setError(null);
      setPortConflict(null);
      setLogs([]);
      setRetryAttempt(null);
      setMaxRetryAttempts(null);

      console.log("[useVitePreview] Starting preview for:", taskIdRef.current);
      console.log("[useVitePreview] workingDir:", workingDir, "options:", options);

      const baseUrl = getGatewayUrl();

      // Start preview with SSE
      const abort = apiStartPreviewWithSSE(
        baseUrl,
        taskIdRef.current,
        workingDir,
        options,
        {
          onStatus: (newStatus, message, newPort, url) => {
            if (!mountedRef.current) return;
            console.log("[useVitePreview] SSE status:", newStatus, message, newPort, url);
            setStatus(newStatus);
            if (newPort) setPort(newPort);
            if (url) setPreviewUrl(url);
            if (message) addLog(message);
          },
          onLog: (message) => {
            if (!mountedRef.current) return;
            console.log("[useVitePreview] SSE log:", message);
            addLog(message);
          },
          onRetry: (attempt, max, message) => {
            if (!mountedRef.current) return;
            console.log("[useVitePreview] SSE retry:", attempt, max, message);
            setRetryAttempt(attempt);
            setMaxRetryAttempts(max);
            addLog(`[Retry ${attempt}/${max}] ${message}`);
          },
          onPortConflict: (conflictPort, message) => {
            if (!mountedRef.current) return;
            console.log("[useVitePreview] SSE port_conflict:", conflictPort, message);
            addLog(message);
            setPortConflict({ port: conflictPort, workingDir, options });
            setStatus("error");
          },
          onComplete: (result) => {
            if (!mountedRef.current) return;
            console.log("[useVitePreview] SSE complete:", result);
            updateStateFromResponse(result);
            abortSSERef.current = null;
          },
          onError: (errMsg) => {
            if (!mountedRef.current) return;
            console.error("[useVitePreview] SSE error:", errMsg);
            addLog(`[Error] ${errMsg}`);
            // Don't set error state here - wait for complete event
          },
        }
      );

      abortSSERef.current = abort;
    },
    [addLog, updateStateFromResponse]
  );

  /**
   * Stop the Vite preview server
   */
  const stopPreview = useCallback(async () => {
    if (!taskIdRef.current) return;

    // Abort any existing SSE connection
    if (abortSSERef.current) {
      abortSSERef.current();
      abortSSERef.current = null;
    }

    try {
      console.log("[useVitePreview] Stopping preview for:", taskIdRef.current);

      const baseUrl = getGatewayUrl();
      await apiStopPreview(baseUrl, taskIdRef.current);

      if (mountedRef.current) {
        setStatus("idle");
        setPreviewUrl(null);
        setPort(null);
        setError(null);
      }
    } catch (err) {
      console.error("[useVitePreview] Stop error:", err);
      if (mountedRef.current) {
        setStatus("error");
        setError(err instanceof Error ? err.message : String(err));
      }
    }
  }, []);

  /**
   * Refresh the preview iframe by incrementing the key
   */
  const refreshPreview = useCallback(() => {
    iframeKeyRef.current += 1;
    // Force a state update to trigger re-render
    setPreviewUrl((prev) => prev);
  }, []);

  /**
   * Kill the process on the conflicting port and retry starting
   */
  const killPortAndRetry = useCallback(async () => {
    if (!portConflict) return;

    const { port: conflictPort, workingDir, options } = portConflict;
    setPortConflict(null);

    try {
      const baseUrl = getGatewayUrl();
      const result = await apiKillPort(baseUrl, conflictPort);
      if (!result.success) {
        if (mountedRef.current) {
          setStatus("error");
          setError(`Failed to kill port ${conflictPort}: ${result.error}`);
        }
        return;
      }
      // Retry with the same options
      startPreview(workingDir, options);
    } catch (err) {
      if (mountedRef.current) {
        setStatus("error");
        setError(err instanceof Error ? err.message : String(err));
      }
    }
  }, [portConflict, startPreview]);

  /**
   * Retry with an auto-assigned port (no preferred port)
   */
  const retryWithNewPort = useCallback(() => {
    if (!portConflict) return;

    const { workingDir, options } = portConflict;
    setPortConflict(null);

    // Remove the port preference so Gateway auto-assigns
    const newOptions = options ? { ...options, port: undefined } : undefined;
    startPreview(workingDir, newOptions);
  }, [portConflict, startPreview]);

  /**
   * Dismiss the port conflict (user chose to cancel)
   */
  const dismissPortConflict = useCallback(() => {
    setPortConflict(null);
    setStatus("idle");
    setError(null);
  }, []);

  return {
    previewUrl,
    status,
    error,
    port,
    portConflict,
    logs,
    retryAttempt,
    maxRetryAttempts,
    startPreview,
    stopPreview,
    refreshPreview,
    refreshStatus,
    isNodeAvailable,
    checkNodeAvailable,
    killPortAndRetry,
    retryWithNewPort,
    dismissPortConflict,
    clearLogs,
  };
}
