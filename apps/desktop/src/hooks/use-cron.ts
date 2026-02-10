/**
 * Cron Job Management Hooks
 *
 * Provides React hooks for managing cron jobs via the gateway API.
 * Supports real-time updates via WebSocket.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { getGatewayClient } from "@/lib/gateway";
import type { CronJob, CreateCronJob, UpdateCronJob, JobStatus } from "@/types/cron";

// ============================================================================
// WebSocket Event Types
// ============================================================================

/** WebSocket message from gateway */
interface WsMessage {
  type: "Event";
  data: {
    channel: string;
    payload: CronGatewayEvent;
  };
}

/** Gateway event (matches Rust GatewayEvent enum with tag="type", content="data") */
interface CronJobCreatedEvent {
  type: "CronJobCreated";
  data: { job: CronJob };
}

interface CronJobUpdatedEvent {
  type: "CronJobUpdated";
  data: { job: CronJob };
}

interface CronJobDeletedEvent {
  type: "CronJobDeleted";
  data: { job_id: string };
}

interface CronJobTriggeredEvent {
  type: "CronJobTriggered";
  data: { job_id: string; triggered_at: number };
}

interface CronJobCompletedEvent {
  type: "CronJobCompleted";
  data: { job_id: string; status: JobStatus; completed_at: number };
}

type CronGatewayEvent =
  | CronJobCreatedEvent
  | CronJobUpdatedEvent
  | CronJobDeletedEvent
  | CronJobTriggeredEvent
  | CronJobCompletedEvent;

/**
 * Helper to make API requests to the gateway
 */
async function gatewayFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const client = getGatewayClient();
  const baseUrl = client.getBaseUrl();
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...options?.headers,
    },
    ...options,
  });

  if (!response.ok) {
    let errorMessage = response.statusText;
    try {
      const errorBody = await response.json();
      errorMessage = errorBody?.error?.message || errorBody?.message || JSON.stringify(errorBody);
    } catch {
      // Keep statusText as fallback
    }
    throw new Error(errorMessage);
  }

  // Handle empty responses
  const text = await response.text();
  if (!text) {
    return {} as T;
  }

  return JSON.parse(text) as T;
}

/**
 * Hook to manage cron jobs with real-time WebSocket updates
 */
export function useCronJobs() {
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const loadJobs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await gatewayFetch<{ jobs: CronJob[] }>("/api/cron");
      setJobs(data.jobs || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load cron jobs";
      setError(message);
      console.error("Failed to load cron jobs:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Handle WebSocket events
  const handleWsEvent = useCallback((event: CronGatewayEvent) => {
    switch (event.type) {
      case "CronJobCreated": {
        const { job } = event.data;
        setJobs((prev) => {
          // Avoid duplicates
          if (prev.some((j) => j.id === job.id)) {
            return prev.map((j) => (j.id === job.id ? job : j));
          }
          return [...prev, job];
        });
        break;
      }

      case "CronJobUpdated": {
        const { job } = event.data;
        setJobs((prev) =>
          prev.map((j) => (j.id === job.id ? job : j))
        );
        break;
      }

      case "CronJobDeleted": {
        const { job_id } = event.data;
        setJobs((prev) => prev.filter((j) => j.id !== job_id));
        break;
      }

      case "CronJobTriggered": {
        const { job_id, triggered_at } = event.data;
        setJobs((prev) =>
          prev.map((j) =>
            j.id === job_id
              ? { ...j, last_status: "running" as JobStatus, last_run: triggered_at }
              : j
          )
        );
        break;
      }

      case "CronJobCompleted": {
        const { job_id, status, completed_at } = event.data;
        setJobs((prev) =>
          prev.map((j) =>
            j.id === job_id
              ? { ...j, last_status: status, last_run: completed_at }
              : j
          )
        );
        break;
      }
    }
  }, []);

  // Connect to WebSocket
  const connectWebSocket = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    const client = getGatewayClient();
    const baseUrl = client.getBaseUrl();
    const wsUrl = baseUrl.replace(/^http/, "ws");
    const ws = new WebSocket(`${wsUrl}/ws`);

    ws.onopen = () => {
      console.log("[CronJobs] WebSocket connected");
      // Subscribe to cron events
      ws.send(JSON.stringify({
        type: "Subscribe",
        data: { channels: ["cron"] }
      }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as WsMessage;
        if (msg.type === "Event" && msg.data?.payload?.type?.startsWith("CronJob")) {
          handleWsEvent(msg.data.payload);
        }
      } catch (err) {
        console.error("[CronJobs] Failed to parse WebSocket message:", err);
      }
    };

    ws.onclose = () => {
      console.log("[CronJobs] WebSocket disconnected");
      wsRef.current = null;
      // Reconnect after 3 seconds
      reconnectTimeoutRef.current = setTimeout(() => {
        connectWebSocket();
      }, 3000);
    };

    ws.onerror = (err) => {
      console.error("[CronJobs] WebSocket error:", err);
    };

    wsRef.current = ws;
  }, [handleWsEvent]);

  // Initial load and WebSocket connection
  useEffect(() => {
    loadJobs();
    connectWebSocket();

    return () => {
      // Cleanup
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [loadJobs, connectWebSocket]);

  return {
    jobs,
    loading,
    error,
    refresh: loadJobs,
  };
}

/**
 * Hook to create a new cron job
 */
export function useCreateCronJob() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createJob = useCallback(async (data: CreateCronJob): Promise<CronJob | null> => {
    setLoading(true);
    setError(null);
    try {
      const result = await gatewayFetch<CronJob>("/api/cron", {
        method: "POST",
        body: JSON.stringify(data),
      });
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create cron job";
      setError(message);
      console.error("Failed to create cron job:", err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    createJob,
    loading,
    error,
  };
}

/**
 * Hook to update an existing cron job
 */
export function useUpdateCronJob() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateJob = useCallback(async (id: string, data: UpdateCronJob): Promise<CronJob | null> => {
    setLoading(true);
    setError(null);
    try {
      const result = await gatewayFetch<CronJob>(`/api/cron/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      });
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update cron job";
      setError(message);
      console.error("Failed to update cron job:", err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    updateJob,
    loading,
    error,
  };
}

/**
 * Hook to delete a cron job
 */
export function useDeleteCronJob() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deleteJob = useCallback(async (id: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      await gatewayFetch(`/api/cron/${id}`, {
        method: "DELETE",
      });
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete cron job";
      setError(message);
      console.error("Failed to delete cron job:", err);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    deleteJob,
    loading,
    error,
  };
}

/**
 * Hook to enable a cron job
 */
export function useEnableCronJob() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enableJob = useCallback(async (id: string): Promise<CronJob | null> => {
    setLoading(true);
    setError(null);
    try {
      const result = await gatewayFetch<CronJob>(`/api/cron/${id}/enable`, {
        method: "POST",
      });
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to enable cron job";
      setError(message);
      console.error("Failed to enable cron job:", err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    enableJob,
    loading,
    error,
  };
}

/**
 * Hook to disable a cron job
 */
export function useDisableCronJob() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const disableJob = useCallback(async (id: string): Promise<CronJob | null> => {
    setLoading(true);
    setError(null);
    try {
      const result = await gatewayFetch<CronJob>(`/api/cron/${id}/disable`, {
        method: "POST",
      });
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to disable cron job";
      setError(message);
      console.error("Failed to disable cron job:", err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    disableJob,
    loading,
    error,
  };
}

/**
 * Hook to run a cron job immediately
 */
export function useRunCronJob() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runJob = useCallback(async (id: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      await gatewayFetch(`/api/cron/${id}/run`, {
        method: "POST",
      });
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to run cron job";
      setError(message);
      console.error("Failed to run cron job:", err);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    runJob,
    loading,
    error,
  };
}
