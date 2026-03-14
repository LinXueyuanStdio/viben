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
 * Preview state
 */
export interface PreviewState {
  previewUrl: string | null;
  status: PreviewStatus;
  error: string | null;
  port: number | null;
}

/**
 * Hook return type
 */
export interface UseVitePreviewReturn extends PreviewState {
  startPreview: (workingDir: string) => Promise<void>;
  stopPreview: () => Promise<void>;
  refreshPreview: () => void;
  refreshStatus: () => Promise<void>;
  isNodeAvailable: boolean | null;
  checkNodeAvailable: () => Promise<boolean>;
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
   * Start the Vite preview server
   */
  const startPreview = useCallback(
    async (workingDir: string) => {
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

      try {
        console.log("[useVitePreview] Starting preview for:", taskIdRef.current);
        console.log("[useVitePreview] workingDir:", workingDir);

        const baseUrl = getGatewayUrl();
        const data = await apiStartPreview(baseUrl, taskIdRef.current, workingDir);

        console.log("[useVitePreview] Start response:", data);
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

  return {
    previewUrl,
    status,
    error,
    port,
    startPreview,
    stopPreview,
    refreshPreview,
    refreshStatus,
    isNodeAvailable,
    checkNodeAvailable,
  };
}
