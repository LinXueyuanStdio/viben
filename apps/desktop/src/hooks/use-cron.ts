/**
 * Cron Job Management Hooks
 *
 * Provides React hooks for managing cron jobs via the gateway API.
 * Supports real-time updates via WebSocket with heartbeat and auto-reconnect.
 */

import { useState, useCallback, useMemo } from "react";
import { getGatewayClient } from "@/lib/gateway";
import { useGatewayWebSocket, type GatewayEventPayload } from "./use-gateway-websocket";
import type { CronJob, CreateCronJob, UpdateCronJob, JobStatus } from "@/types/cron";

// ============================================================================
// WebSocket Event Types
// ============================================================================

interface CronJobData {
  job?: CronJob;
  job_id?: string;
  status?: JobStatus;
  triggered_at?: number;
  completed_at?: number;
}

/**
 * Helper to make API requests to the gateway
 */
async function gatewayFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const client = getGatewayClient();
  const baseUrl = client.getBaseUrl();

  // Build headers - only set Content-Type for requests with body
  const headers: HeadersInit = {
    Accept: "application/json",
    ...options?.headers,
  };

  // For POST/PUT/PATCH requests, always send JSON body (empty object if no body provided)
  const method = options?.method?.toUpperCase();
  const needsBody = method === "POST" || method === "PUT" || method === "PATCH";
  let body = options?.body;

  if (needsBody) {
    (headers as Record<string, string>)["Content-Type"] = "application/json";
    // If no body provided, send empty JSON object to avoid "Body cannot be empty" error
    if (!body) {
      body = "{}";
    }
  }

  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers,
    body,
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
  const handleWsEvent = useCallback((channel: string, payload: GatewayEventPayload) => {
    if (channel !== "cron") return;

    const data = payload.data as unknown as CronJobData;

    switch (payload.type) {
      case "CronJobCreated": {
        const job = data?.job;
        if (job) {
          setJobs((prev) => {
            // Avoid duplicates
            if (prev.some((j) => j.id === job.id)) {
              return prev.map((j) => (j.id === job.id ? job : j));
            }
            return [...prev, job];
          });
        }
        break;
      }

      case "CronJobUpdated": {
        const job = data?.job;
        if (job) {
          setJobs((prev) =>
            prev.map((j) => (j.id === job.id ? job : j))
          );
        }
        break;
      }

      case "CronJobDeleted": {
        const job_id = data?.job_id;
        if (job_id) {
          setJobs((prev) => prev.filter((j) => j.id !== job_id));
        }
        break;
      }

      case "CronJobTriggered": {
        const { job_id, triggered_at } = data || {};
        if (job_id && triggered_at) {
          setJobs((prev) =>
            prev.map((j) =>
              j.id === job_id
                ? { ...j, last_status: "running" as JobStatus, last_run: triggered_at }
                : j
            )
          );
        }
        break;
      }

      case "CronJobCompleted": {
        const { job_id, status, completed_at } = data || {};
        if (job_id && status && completed_at) {
          setJobs((prev) =>
            prev.map((j) =>
              j.id === job_id
                ? { ...j, last_status: status, last_run: completed_at }
                : j
            )
          );
        }
        break;
      }
    }
  }, []);

  // Memoize onOpen callback to load jobs when connected
  const handleOpen = useMemo(() => {
    return () => {
      loadJobs();
    };
  }, [loadJobs]);

  // Use gateway WebSocket with heartbeat and auto-reconnect
  useGatewayWebSocket({
    channels: ["cron"],
    onEvent: handleWsEvent,
    onOpen: handleOpen,
    // Heartbeat every 30 seconds
    heartbeatInterval: 30000,
    // Timeout after 10 seconds of no response
    heartbeatTimeout: 10000,
    // Start reconnect at 1 second
    reconnectDelay: 1000,
    // Max reconnect delay of 30 seconds
    maxReconnectDelay: 30000,
    // Unlimited reconnect attempts
    maxReconnectAttempts: Infinity,
  });

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
