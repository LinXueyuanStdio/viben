/**
 * useVitePreview Hook
 *
 * Manages the lifecycle of a Vite preview server for live preview functionality.
 * Provides start/stop controls and status monitoring via Gateway API.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import i18n from "@/i18n";
import { getGatewayUrl } from "@/lib/gateway/config";
import {
  checkNodeAvailable as apiCheckNodeAvailable,
  getPreviewStatus as apiGetPreviewStatus,
  startPreview as apiStartPreview,
  stopPreview as apiStopPreview,
  killPort as apiKillPort,
  type PreviewStatusResponse,
} from "@/lib/gateway/modules/preview";

/**
 * Preview server status
 */
export type PreviewStatus =
  | "idle"
  | "starting"
  | "running"
  | "error"
  | "stopped";

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
  startPreview: (workingDir: string, options?: StartPreviewOptions) => Promise<void>;
  stopPreview: () => Promise<void>;
  refreshPreview: () => void;
  refreshStatus: () => Promise<void>;
  isNodeAvailable: boolean | null;
  checkNodeAvailable: () => Promise<boolean>;
  /** Kill the process on the conflicting port and retry */
  killPortAndRetry: () => Promise<void>;
  /** Retry with an auto-assigned port (ignore preferred port) */
  retryWithNewPort: () => Promise<void>;
  /** Dismiss the port conflict (cancel) */
  dismissPortConflict: () => void;
}

// Poll interval for checking server startup status
const POLL_INTERVAL_MS = 2000;

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

  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const taskIdRef = useRef<string | null>(taskId);
  const iframeKeyRef = useRef<number>(0);

  // Update taskIdRef when taskId changes
  useEffect(() => {
    taskIdRef.current = taskId;
  }, [taskId]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
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
      setIsNodeAvailable(available);
      return available;
    } catch (err) {
      console.warn("[useVitePreview] Failed to check Node.js availability:", err);
      setIsNodeAvailable(false);
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
    const mappedStatus: PreviewStatus = data.status === "stopped" ? "idle" : data.status;
    setStatus(mappedStatus);
    setPreviewUrl(data.url || null);
    setPort(data.hostPort || null);
    setError(data.error || null);

    // Stop polling if no longer starting
    if (data.status !== "starting" && pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
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
      // Assume idle if we can't get status
      setStatus("idle");
      setPreviewUrl(null);
      setPort(null);
      setError(null);
    }
  }, [updateStateFromResponse]);

  // Reset state when taskId changes
  useEffect(() => {
    if (taskId) {
      // Check if there's an existing preview for this task
      refreshStatus();
    } else {
      setPreviewUrl(null);
      setStatus("idle");
      setError(null);
      setPort(null);
    }
  }, [taskId, refreshStatus]);

  /**
   * Start the preview server
   */
  const startPreview = useCallback(
    async (workingDir: string, options?: StartPreviewOptions) => {
      if (!taskIdRef.current) {
        setError(i18n.t("errors.vitePreview.noTaskId"));
        setStatus("error");
        return;
      }

      // Clear any existing polling
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }

      setStatus("starting");
      setError(null);
      setPortConflict(null);

      try {
        console.log("[useVitePreview] Starting preview for:", taskIdRef.current);
        console.log("[useVitePreview] workingDir:", workingDir, "options:", options);

        const baseUrl = getGatewayUrl();
        const data = await apiStartPreview(baseUrl, taskIdRef.current, workingDir, options);

        console.log("[useVitePreview] Start response:", data);

        // Check for PORT_IN_USE error
        if (data.status === "error" && data.error?.startsWith("PORT_IN_USE:")) {
          const conflictPort = parseInt(data.error.split(":")[1], 10);
          setPortConflict({ port: conflictPort, workingDir, options });
          setStatus("error");
          setError(`Port ${conflictPort} is already in use`);
          return;
        }

        updateStateFromResponse(data);

        // If still starting, poll for status updates
        if (data.status === "starting") {
          pollIntervalRef.current = setInterval(async () => {
            if (!taskIdRef.current) return;

            try {
              const statusData = await apiGetPreviewStatus(baseUrl, taskIdRef.current);
              updateStateFromResponse(statusData);
            } catch (err) {
              console.error("[useVitePreview] Polling error:", err);
            }
          }, POLL_INTERVAL_MS);
        }
      } catch (err) {
        console.error("[useVitePreview] Start error:", err);
        setStatus("error");
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [updateStateFromResponse]
  );

  /**
   * Stop the Vite preview server
   */
  const stopPreview = useCallback(async () => {
    if (!taskIdRef.current) return;

    // Clear any existing polling
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }

    try {
      console.log("[useVitePreview] Stopping preview for:", taskIdRef.current);

      const baseUrl = getGatewayUrl();
      await apiStopPreview(baseUrl, taskIdRef.current);

      setStatus("idle");
      setPreviewUrl(null);
      setPort(null);
      setError(null);
    } catch (err) {
      console.error("[useVitePreview] Stop error:", err);
      setStatus("error");
      setError(err instanceof Error ? err.message : String(err));
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
        setStatus("error");
        setError(`Failed to kill port ${conflictPort}: ${result.error}`);
        return;
      }
      // Retry with the same options
      await startPreview(workingDir, options);
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [portConflict, startPreview]);

  /**
   * Retry with an auto-assigned port (no preferred port)
   */
  const retryWithNewPort = useCallback(async () => {
    if (!portConflict) return;

    const { workingDir, options } = portConflict;
    setPortConflict(null);

    // Remove the port preference so Gateway auto-assigns
    const newOptions = options ? { ...options, port: undefined } : undefined;
    await startPreview(workingDir, newOptions);
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
    startPreview,
    stopPreview,
    refreshPreview,
    refreshStatus,
    isNodeAvailable,
    checkNodeAvailable,
    killPortAndRetry,
    retryWithNewPort,
    dismissPortConflict,
  };
}
