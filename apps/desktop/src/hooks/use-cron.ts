/**
 * Cron Job Management Hooks
 *
 * Provides React hooks for managing cron jobs via the gateway API.
 */

import { useState, useEffect, useCallback } from "react";
import { getGatewayClient } from "@/lib/gateway";
import type { CronJob, CreateCronJob, UpdateCronJob } from "@/types/cron";

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
 * Hook to manage cron jobs
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

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

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
