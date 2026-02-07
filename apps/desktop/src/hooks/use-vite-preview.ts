/**
 * useVitePreview Hook
 *
 * Manages the lifecycle of a Vite preview server for live preview functionality.
 * Provides start/stop controls and status monitoring.
 *
 * Note: This hook requires a backend server to manage Vite process lifecycle.
 * Since the viben desktop app may not have this backend yet, the implementation
 * includes a mock mode that can be enabled for development/testing.
 */

import { useCallback, useEffect, useRef, useState } from "react";

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
}

/**
 * API response type for preview operations
 */
interface PreviewApiResponse {
  id: string;
  taskId: string;
  status: "starting" | "running" | "stopped" | "error";
  url?: string;
  port?: number;
  error?: string;
}

// Poll interval for checking server startup status
const POLL_INTERVAL_MS = 2000;

// Backend API URL for preview server management
// This should be configured based on your backend setup
const getPreviewApiUrl = (): string => {
  // Check for environment variable first
  if (import.meta.env.VITE_PREVIEW_API_URL) {
    return import.meta.env.VITE_PREVIEW_API_URL;
  }
  // Default to localhost for development
  return "http://127.0.0.1:3100";
};

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
  }, [taskId]);

  /**
   * Update local state from API response
   */
  const updateStateFromResponse = useCallback((data: PreviewApiResponse) => {
    setStatus(data.status === "stopped" ? "idle" : data.status);
    setPreviewUrl(data.url || null);
    setPort(data.port || null);
    setError(data.error || null);

    // Stop polling if no longer starting
    if (data.status !== "starting" && pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  /**
   * Fetch current status from the server
   */
  const refreshStatus = useCallback(async () => {
    if (!taskIdRef.current) return;

    try {
      const response = await fetch(
        `${getPreviewApiUrl()}/preview/status/${taskIdRef.current}`
      );

      if (!response.ok) {
        // If 404, the preview doesn't exist (idle state)
        if (response.status === 404) {
          setStatus("idle");
          setPreviewUrl(null);
          setPort(null);
          setError(null);
          return;
        }
        throw new Error(`Failed to get status: ${response.statusText}`);
      }

      const data: PreviewApiResponse = await response.json();
      updateStateFromResponse(data);
    } catch (err) {
      // Backend not available - set to idle
      console.warn("[useVitePreview] Backend not available:", err);
      setStatus("idle");
    }
  }, [updateStateFromResponse]);

  /**
   * Start the Vite preview server
   */
  const startPreview = useCallback(
    async (workingDir: string) => {
      if (!taskIdRef.current) {
        setError("No task ID provided");
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
        console.log(
          "[useVitePreview] Starting preview for:",
          taskIdRef.current
        );
        console.log("[useVitePreview] workingDir:", workingDir);

        const response = await fetch(`${getPreviewApiUrl()}/preview/start`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            taskId: taskIdRef.current,
            workDir: workingDir,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.error || `Failed to start preview: ${response.statusText}`
          );
        }

        const data: PreviewApiResponse = await response.json();
        console.log("[useVitePreview] Start response:", data);

        updateStateFromResponse(data);

        // If still starting, poll for status updates
        if (data.status === "starting") {
          pollIntervalRef.current = setInterval(async () => {
            if (!taskIdRef.current) return;

            try {
              const statusResponse = await fetch(
                `${getPreviewApiUrl()}/preview/status/${taskIdRef.current}`
              );

              if (statusResponse.ok) {
                const statusData: PreviewApiResponse =
                  await statusResponse.json();
                updateStateFromResponse(statusData);
              }
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

      const response = await fetch(`${getPreviewApiUrl()}/preview/stop`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          taskId: taskIdRef.current,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || `Failed to stop preview: ${response.statusText}`
        );
      }

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
  };
}
