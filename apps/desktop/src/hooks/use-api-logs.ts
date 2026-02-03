import { useState, useEffect, useCallback, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";

/**
 * API log entry (matches Rust/Python structure)
 */
export interface ApiLogEntry {
  timestamp: string;
  run_id: string;
  api_key_hash: string | null;
  provider: string;
  source: string;
  method: "search" | "download" | "read";
  request: Record<string, unknown>;
  response: Record<string, unknown>;
  latency_ms: number;
  status: "success" | "error";
  error: string | null;
}

/**
 * API log summary statistics
 */
export interface ApiLogSummary {
  run_id: string;
  total_requests: number;
  successful_requests: number;
  failed_requests: number;
  by_source: Record<string, number>;
  by_method: Record<string, number>;
  avg_latency_ms: number;
}

/**
 * API log session info
 */
export interface ApiLogSession {
  run_id: string;
  log_file: string;
  entry_count: number;
  created_at: string | null;
  last_entry_at: string | null;
}

/**
 * Filter options for API logs
 */
export interface ApiLogFilter {
  provider?: string;
  source?: string;
  status?: "success" | "error";
  method?: "search" | "download" | "read";
}

/**
 * Hook for accessing API logs
 */
export function useApiLogs() {
  const [sessions, setSessions] = useState<ApiLogSession[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [logs, setLogs] = useState<ApiLogEntry[]>([]);
  const [summary, setSummary] = useState<ApiLogSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<ApiLogFilter>({});
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [logsDirPath, setLogsDirPath] = useState<string | null>(null);

  /**
   * Fetch all API log sessions
   */
  const fetchSessions = useCallback(async () => {
    try {
      const result = await invoke<ApiLogSession[]>("get_api_log_sessions");
      setSessions(result);

      // Auto-select first session if none selected
      if (!selectedRunId && result.length > 0) {
        setSelectedRunId(result[0].run_id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [selectedRunId]);

  /**
   * Fetch logs for a specific run
   */
  const fetchLogs = useCallback(
    async (
      runId: string,
      limit = 1000,
      offset = 0,
      currentFilter?: ApiLogFilter
    ) => {
      setLoading(true);
      setError(null);
      try {
        const f = currentFilter || filter;
        const result = await invoke<ApiLogEntry[]>("get_api_logs", {
          runId,
          limit,
          offset,
          providerFilter: f.provider || null,
          sourceFilter: f.source || null,
          statusFilter: f.status || null,
          methodFilter: f.method || null,
        });
        setLogs(result);
        return result;
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        return [];
      } finally {
        setLoading(false);
      }
    },
    [filter]
  );

  /**
   * Fetch summary for a specific run
   */
  const fetchSummary = useCallback(async (runId: string) => {
    try {
      const result = await invoke<ApiLogSummary>("get_api_log_summary", {
        runId,
      });
      setSummary(result);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return null;
    }
  }, []);

  /**
   * Clear logs for a specific run
   */
  const clearLogs = useCallback(
    async (runId: string) => {
      try {
        await invoke("clear_api_logs", { runId });
        await fetchSessions();
        if (selectedRunId === runId) {
          setLogs([]);
          setSummary(null);
          setSelectedRunId(null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [fetchSessions, selectedRunId]
  );

  /**
   * Get the logs directory path
   */
  const fetchLogsDirPath = useCallback(async () => {
    try {
      const path = await invoke<string>("get_api_logs_dir_path");
      setLogsDirPath(path);
    } catch (err) {
      console.error("Failed to get logs dir path:", err);
    }
  }, []);

  /**
   * Open the logs directory in system file explorer
   */
  const openLogsFolder = useCallback(async () => {
    try {
      await invoke("open_api_logs_dir");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  /**
   * Refresh all data
   */
  const refresh = useCallback(() => {
    fetchSessions();
    if (selectedRunId) {
      fetchLogs(selectedRunId);
      fetchSummary(selectedRunId);
    }
  }, [fetchSessions, fetchLogs, fetchSummary, selectedRunId]);

  /**
   * Apply a filter and refresh
   */
  const applyFilter = useCallback(
    (newFilter: ApiLogFilter) => {
      setFilter(newFilter);
      if (selectedRunId) {
        fetchLogs(selectedRunId, 1000, 0, newFilter);
      }
    },
    [selectedRunId, fetchLogs]
  );

  /**
   * Clear all filters
   */
  const clearFilter = useCallback(() => {
    setFilter({});
    if (selectedRunId) {
      fetchLogs(selectedRunId, 1000, 0, {});
    }
  }, [selectedRunId, fetchLogs]);

  // Load on mount
  useEffect(() => {
    fetchSessions();
    fetchLogsDirPath();
  }, [fetchSessions, fetchLogsDirPath]);

  // Fetch logs when selection changes
  useEffect(() => {
    if (selectedRunId) {
      fetchLogs(selectedRunId);
      fetchSummary(selectedRunId);
    }
  }, [selectedRunId, fetchLogs, fetchSummary]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      refresh();
    }, 5000);

    return () => clearInterval(interval);
  }, [autoRefresh, refresh]);

  /**
   * Get unique providers from current logs (memoized)
   */
  const uniqueProviders = useMemo(
    () => [...new Set(logs.map((l) => l.provider))].sort(),
    [logs]
  );

  /**
   * Get unique sources from current logs (memoized)
   */
  const uniqueSources = useMemo(
    () => [...new Set(logs.map((l) => l.source))].sort(),
    [logs]
  );

  /**
   * Get unique methods from current logs (memoized)
   */
  const uniqueMethods = useMemo(
    () => [...new Set(logs.map((l) => l.method))].sort(),
    [logs]
  );

  return {
    // Data
    sessions,
    selectedRunId,
    setSelectedRunId,
    logs,
    summary,
    loading,
    error,
    logsDirPath,

    // Filter
    filter,
    setFilter: applyFilter,
    clearFilter,

    // Auto refresh
    autoRefresh,
    setAutoRefresh,

    // Actions
    fetchSessions,
    fetchLogs,
    fetchSummary,
    clearLogs,
    refresh,
    openLogsFolder,

    // Computed
    uniqueProviders,
    uniqueSources,
    uniqueMethods,
  };
}
