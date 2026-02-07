/**
 * useVitePreview Hook
 *
 * Manages the lifecycle of a Vite preview server for live preview functionality.
 * Provides start/stop controls and status monitoring.
 */

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Preview server status
 */
export type PreviewStatus = "idle" | "starting" | "running" | "error" | "stopped";

/**
 * Preview state
 */
export interface PreviewState {
  /** The URL of the running preview server */
  previewUrl: string | null;
  /** Current status of the preview server */
  status: PreviewStatus;
  /** Error message if status is 'error' */
  error: string | null;
  /** Port number the server is running on */
  hostPort: number | null;
}

/**
 * Return type of useVitePreview hook
 */
export interface UseVitePreviewReturn extends PreviewState {
  /** Start the preview server */
  startPreview: (workDir: string) => Promise<void>;
  /** Stop the preview server */
  stopPreview: () => Promise<void>;
  /** Refresh the current status from the server */
  refreshStatus: () => Promise<void>;
}

/**
 * API response from preview endpoints
 */
interface PreviewApiResponse {
  id: string;
  taskId: string;
  status: "starting" | "running" | "stopped" | "error";
  url?: string;
  hostPort?: number;
  error?: string;
}

/** Polling interval for status checks while starting */
const POLL_INTERVAL_MS = 2000;

/** Default agent server URL - can be overridden via environment */
const getAgentServerUrl = () => {
  // In desktop app, this would typically come from Tauri config or environment
  return import.meta.env.VITE_AGENT_SERVER_URL || "http://localhost:3001";
};

/**
 * Hook to manage Vite preview server lifecycle
 *
 * @param taskId - The task ID to associate the preview with
 * @returns Preview state and control functions
 *
 * @example
 * ```tsx
 * const { previewUrl, status, startPreview, stopPreview } = useVitePreview(taskId);
 *
 * // Start preview
 * await startPreview('/path/to/project');
 *
 * // Show preview in iframe
 * {status === 'running' && <iframe src={previewUrl} />}
 *
 * // Stop preview
 * await stopPreview();
 * ```
 */
export function useVitePreview(taskId: string | null): UseVitePreviewReturn {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<PreviewStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [hostPort, setHostPort] = useState<number | null>(null);

  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const taskIdRef = useRef<string | null>(taskId);

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
   * Update local state from API response
   */
  const updateStateFromResponse = useCallback((data: PreviewApiResponse) => {
    setStatus(data.status === "stopped" ? "idle" : data.status);
    setPreviewUrl(data.url || null);
    setHostPort(data.hostPort || null);
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
        `${getAgentServerUrl()}/preview/status/${taskIdRef.current}`
      );

      if (!response.ok) {
        // If 404, server might not have this preview - that's okay
        if (response.status === 404) {
          setStatus("idle");
          setPreviewUrl(null);
          setHostPort(null);
          setError(null);
          return;
        }
        throw new Error(`Failed to get status: ${response.statusText}`);
      }

      const data: PreviewApiResponse = await response.json();
      updateStateFromResponse(data);
    } catch (err) {
      console.error("[useVitePreview] Error fetching status:", err);
      // Don't set error state for refresh failures - might just be offline
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
      setHostPort(null);
    }
  }, [taskId, refreshStatus]);

  /**
   * Start the Vite preview server
   */
  const startPreview = useCallback(
    async (workDir: string) => {
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
        console.log("[useVitePreview] Starting preview for:", taskIdRef.current);
        console.log("[useVitePreview] workDir:", workDir);

        const response = await fetch(`${getAgentServerUrl()}/preview/start`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            taskId: taskIdRef.current,
            workDir,
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
                `${getAgentServerUrl()}/preview/status/${taskIdRef.current}`
              );

              if (statusResponse.ok) {
                const statusData: PreviewApiResponse = await statusResponse.json();
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

      const response = await fetch(`${getAgentServerUrl()}/preview/stop`, {
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
      setHostPort(null);
      setError(null);
    } catch (err) {
      console.error("[useVitePreview] Stop error:", err);
      setStatus("error");
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  return {
    previewUrl,
    status,
    error,
    hostPort,
    startPreview,
    stopPreview,
    refreshStatus,
  };
}
