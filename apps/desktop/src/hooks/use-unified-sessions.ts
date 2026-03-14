import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { getGatewayClient } from "@/lib/gateway";
import type { LogSession, LogEntry } from "./use-logs";
import type { ApiLogSession, ApiLogEntry, ApiLogSummary, ApiLogFilter } from "./use-api-logs";

/**
 * Unified session that combines server logs and API logs by run_id
 */
export interface UnifiedSession {
  /** Shared run identifier */
  run_id: string;
  /** Server log session (if exists) */
  serverLog: LogSession | null;
  /** API log session (if exists) */
  apiLog: ApiLogSession | null;
  /** Display name (from server_name or run_id) */
  displayName: string;
  /** Creation time (earliest of server/api) */
  createdAt: string;
  /** Whether the session is still active */
  isActive: boolean;
  /** Process ID (from server log) */
  pid: number | null;
  /** Server ID (from server log) */
  serverId: string | null;
}

// LogSessionSummary now comes from Gateway client (getLogSessions return type)

/**
 * Hook for managing unified sessions (server logs + API logs)
 */
export function useUnifiedSessions() {
  const { t } = useTranslation();

  // Session state
  const [sessions, setSessions] = useState<UnifiedSession[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logsDirPath, setLogsDirPath] = useState<string | null>(null);

  // Auto-refresh state
  const [autoRefresh, setAutoRefresh] = useState(false);

  // Server logs state
  const [serverLogs, setServerLogs] = useState<LogEntry[]>([]);
  const [serverLogLevel, setServerLogLevel] = useState<"all" | "info" | "warning" | "error" | "debug">("all");

  // API logs state
  const [apiLogs, setApiLogs] = useState<ApiLogEntry[]>([]);
  const [apiLogSummary, setApiLogSummary] = useState<ApiLogSummary | null>(null);
  const [apiLogFilter, setApiLogFilter] = useState<ApiLogFilter>({});

  // Get the selected unified session
  const selectedSession = useMemo(
    () => sessions.find((s) => s.run_id === selectedRunId) ?? null,
    [sessions, selectedRunId]
  );

  /**
   * Fetch all sessions and merge them by run_id
   */
  const fetchSessions = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const gateway = getGatewayClient();
      // Fetch server log sessions and API log sessions in parallel
      const [serverResult, apiSessions] = await Promise.all([
        gateway.getLogSessions(),
        gateway.getApiLogSessions(),
      ]);

      const serverSessions = serverResult.sessions;

      // Create a map of run_id to unified session
      const sessionMap = new Map<string, UnifiedSession>();

      // Add server log sessions
      for (const serverLog of serverSessions) {
        sessionMap.set(serverLog.run_id, {
          run_id: serverLog.run_id,
          serverLog,
          apiLog: null,
          displayName: serverLog.server_name,
          createdAt: serverLog.created_at,
          isActive: !serverLog.ended_at,
          pid: serverLog.pid,
          serverId: serverLog.server_id,
        });
      }

      // Merge API log sessions
      for (const apiLog of apiSessions) {
        const existing = sessionMap.get(apiLog.run_id);
        if (existing) {
          // Merge with existing server log session
          existing.apiLog = apiLog;
        } else {
          // Create new unified session with only API log
          sessionMap.set(apiLog.run_id, {
            run_id: apiLog.run_id,
            serverLog: null,
            apiLog,
            displayName: `API Session ${apiLog.run_id.slice(0, 8)}`,
            createdAt: apiLog.created_at || "",
            isActive: false, // API-only sessions are considered inactive
            pid: null,
            serverId: null,
          });
        }
      }

      // Convert to array and sort by createdAt descending
      const unified = Array.from(sessionMap.values()).sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt)
      );

      setSessions(unified);

      // Auto-select first session if none selected
      if (!selectedRunId && unified.length > 0) {
        setSelectedRunId(unified[0].run_id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [selectedRunId]);

  /**
   * Fetch server logs for the selected session
   */
  const fetchServerLogs = useCallback(
    async (sessionId: string, levelFilter?: "all" | "info" | "warning" | "error" | "debug") => {
      try {
        const gateway = getGatewayClient();
        const result = await gateway.getSessionLogs(
          sessionId,
          levelFilter === "all" ? undefined : levelFilter,
          1000
        );
        setServerLogs(result);
      } catch (err) {
        console.error("Failed to fetch server logs:", err);
      }
    },
    []
  );

  /**
   * Fetch API logs for the selected session
   */
  const fetchApiLogs = useCallback(
    async (runId: string, filter?: ApiLogFilter) => {
      try {
        const gateway = getGatewayClient();
        const f = filter || apiLogFilter;
        const [logs, summary] = await Promise.all([
          gateway.getApiLogs(runId, {
            limit: 1000,
            offset: 0,
            providerFilter: f.provider || undefined,
            sourceFilter: f.source || undefined,
            statusFilter: f.status || undefined,
            methodFilter: f.method || undefined,
          }),
          gateway.getApiLogSummary(runId),
        ]);
        setApiLogs(logs);
        setApiLogSummary(summary);
      } catch (err) {
        console.error("Failed to fetch API logs:", err);
      }
    },
    [apiLogFilter]
  );

  /**
   * Refresh all data for the selected session
   */
  const refresh = useCallback(async () => {
    await fetchSessions();
    if (selectedRunId) {
      const session = sessions.find((s) => s.run_id === selectedRunId);
      if (session?.serverLog) {
        await fetchServerLogs(session.serverLog.id, serverLogLevel);
      }
      if (session?.apiLog) {
        await fetchApiLogs(selectedRunId, apiLogFilter);
      }
    }
  }, [fetchSessions, selectedRunId, sessions, serverLogLevel, apiLogFilter, fetchServerLogs, fetchApiLogs]);

  /**
   * Clear a session (delete both server and API logs)
   */
  const clearSession = useCallback(
    async (runId: string) => {
      setLoading(true);
      try {
        const gateway = getGatewayClient();
        const session = sessions.find((s) => s.run_id === runId);

        // Delete server log session if exists
        if (session?.serverLog) {
          await gateway.clearSessionLogs(session.serverLog.id);
        }

        // Delete API log session if exists
        if (session?.apiLog) {
          await gateway.clearApiLogs(runId);
        }

        // Refresh sessions list
        await fetchSessions();

        // Clear selection if deleted session was selected
        if (selectedRunId === runId) {
          setSelectedRunId(null);
          setServerLogs([]);
          setApiLogs([]);
          setApiLogSummary(null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    },
    [sessions, selectedRunId, fetchSessions]
  );

  /**
   * Cleanup old sessions
   */
  const cleanupSessions = useCallback(
    async (keepCount: number = 10) => {
      try {
        const gateway = getGatewayClient();
        const deleted = await gateway.cleanupOldSessions(keepCount);
        await fetchSessions();
        return deleted;
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        return 0;
      }
    },
    [fetchSessions]
  );

  /**
   * Export server logs for the selected session
   */
  const exportServerLogs = useCallback(
    async (exportPath: string) => {
      if (!selectedSession?.serverLog) {
        throw new Error(t("errors.sessions.noServerLogSelected"));
      }
      const gateway = getGatewayClient();
      return gateway.exportSessionLogs(selectedSession.serverLog.id, exportPath);
    },
    [selectedSession, t]
  );

  /**
   * Open logs folder in file explorer
   */
  const openLogsFolder = useCallback(async () => {
    try {
      const gateway = getGatewayClient();
      await gateway.openApiLogsDir();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  /**
   * Apply API log filter
   */
  const applyApiLogFilter = useCallback(
    (filter: ApiLogFilter) => {
      setApiLogFilter(filter);
      if (selectedRunId) {
        fetchApiLogs(selectedRunId, filter);
      }
    },
    [selectedRunId, fetchApiLogs]
  );

  /**
   * Clear API log filter
   */
  const clearApiLogFilter = useCallback(() => {
    setApiLogFilter({});
    if (selectedRunId) {
      fetchApiLogs(selectedRunId, {});
    }
  }, [selectedRunId, fetchApiLogs]);

  // Initialize on mount
  useEffect(() => {
    const init = async () => {
      try {
        const gateway = getGatewayClient();
        await gateway.initLogs();
        const path = await gateway.getLogsDirPath();
        setLogsDirPath(path);
      } catch (err) {
        console.error("Failed to initialize logs:", err);
      }
    };
    init().then(() => fetchSessions());
  }, [fetchSessions]);

  // Fetch logs when selection or filters change
  useEffect(() => {
    if (!selectedRunId) return;

    const session = sessions.find((s) => s.run_id === selectedRunId);
    if (session?.serverLog) {
      fetchServerLogs(session.serverLog.id, serverLogLevel);
    } else {
      setServerLogs([]);
    }
    if (session?.apiLog) {
      fetchApiLogs(selectedRunId, apiLogFilter);
    } else {
      setApiLogs([]);
      setApiLogSummary(null);
    }
  }, [selectedRunId, sessions, serverLogLevel, apiLogFilter, fetchServerLogs, fetchApiLogs]);

  // Auto-refresh effect
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      refresh();
    }, 3000);

    return () => clearInterval(interval);
  }, [autoRefresh, refresh]);

  // Compute unique values for API log filters
  const uniqueProviders = useMemo(
    () => [...new Set(apiLogs.map((l) => l.provider))].sort(),
    [apiLogs]
  );

  const uniqueSources = useMemo(
    () => [...new Set(apiLogs.map((l) => l.source))].sort(),
    [apiLogs]
  );

  const uniqueMethods = useMemo(
    () => [...new Set(apiLogs.map((l) => l.method))].sort(),
    [apiLogs]
  );

  return {
    // Sessions
    sessions,
    selectedRunId,
    setSelectedRunId,
    selectedSession,
    loading,
    error,
    logsDirPath,

    // Auto-refresh
    autoRefresh,
    setAutoRefresh,

    // Server logs
    serverLogs,
    serverLogLevel,
    setServerLogLevel,

    // API logs
    apiLogs,
    apiLogSummary,
    apiLogFilter,
    setApiLogFilter: applyApiLogFilter,
    clearApiLogFilter,
    uniqueProviders,
    uniqueSources,
    uniqueMethods,

    // Actions
    refresh,
    clearSession,
    cleanupSessions,
    exportServerLogs,
    openLogsFolder,
  };
}
