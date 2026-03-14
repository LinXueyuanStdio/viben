import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { getGatewayClient, type LogEntry, type LogSession, type LogSessionSummary } from "@/lib/gateway";

export type { LogEntry, LogSession, LogSessionSummary };

export type LogLevelFilter = "all" | "info" | "warning" | "error" | "debug";

export function useLogs() {
  const { t } = useTranslation();
  const [sessions, setSessions] = useState<LogSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [levelFilter, setLevelFilter] = useState<LogLevelFilter>("all");
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [logsDirPath, setLogsDirPath] = useState<string | null>(null);

  // Fetch all sessions
  const fetchSessions = useCallback(async (serverId?: string) => {
    try {
      const client = getGatewayClient();
      const result = await client.getLogSessions(serverId);
      setSessions(result.sessions);

      // Auto-select the first session if none selected
      if (!selectedSessionId && result.sessions.length > 0) {
        setSelectedSessionId(result.sessions[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [selectedSessionId]);

  // Fetch logs for selected session
  const fetchSessionLogs = useCallback(async (sessionId: string, filter?: LogLevelFilter) => {
    setLoading(true);
    setError(null);
    try {
      const client = getGatewayClient();
      const result = await client.getSessionLogs(
        sessionId,
        filter === "all" ? undefined : filter,
        1000
      );
      setLogs(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  // Initialize
  const initLogs = useCallback(async () => {
    try {
      const client = getGatewayClient();
      await client.initLogs();
      const path = await client.getLogsDirPath();
      setLogsDirPath(path);
    } catch (err) {
      console.error("Failed to initialize logs:", err);
    }
  }, []);

  // Clear session
  const clearSession = useCallback(async (sessionId: string) => {
    setLoading(true);
    try {
      const client = getGatewayClient();
      await client.clearSessionLogs(sessionId);
      await fetchSessions();
      if (selectedSessionId === sessionId) {
        setLogs([]);
        setSelectedSessionId(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [fetchSessions, selectedSessionId]);

  // Cleanup old sessions
  const cleanupSessions = useCallback(async (keepCount: number = 10) => {
    try {
      const client = getGatewayClient();
      const deleted = await client.cleanupOldSessions(keepCount);
      await fetchSessions();
      return deleted;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return 0;
    }
  }, [fetchSessions]);

  // Export session logs
  const exportSession = useCallback(async (sessionId: string, exportPath: string) => {
    try {
      const client = getGatewayClient();
      const result = await client.exportSessionLogs(sessionId, exportPath);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      throw err;
    }
  }, []);

  // Check if a process is alive by PID
  const checkProcessAlive = useCallback(async (pid: number): Promise<boolean> => {
    try {
      const client = getGatewayClient();
      return await client.isProcessAlive(pid);
    } catch {
      return false;
    }
  }, []);

  // Legacy compatibility functions
  const addLog = useCallback(async (
    level: "info" | "warning" | "error" | "debug",
    message: string,
    source?: string
  ) => {
    try {
      const client = getGatewayClient();
      await client.addLog(level, message, source);
    } catch (err) {
      console.error("Failed to add log:", err);
    }
  }, []);

  const clearLogs = useCallback(async () => {
    setLoading(true);
    try {
      const client = getGatewayClient();
      await client.clearLogs();
      setLogs([]);
      setSessions([]);
      setSelectedSessionId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const exportLogs = useCallback(async (exportPath: string) => {
    if (selectedSessionId) {
      return exportSession(selectedSessionId, exportPath);
    }
    throw new Error(t("errors.logs.noSessionSelected"));
  }, [selectedSessionId, exportSession, t]);

  const refresh = useCallback(() => {
    fetchSessions();
    if (selectedSessionId) {
      fetchSessionLogs(selectedSessionId, levelFilter);
    }
  }, [fetchSessions, fetchSessionLogs, selectedSessionId, levelFilter]);

  // Initialize on mount
  useEffect(() => {
    initLogs().then(() => fetchSessions());
  }, [initLogs, fetchSessions]);

  // Fetch logs when session or filter changes
  useEffect(() => {
    if (selectedSessionId) {
      fetchSessionLogs(selectedSessionId, levelFilter);
    }
  }, [selectedSessionId, levelFilter, fetchSessionLogs]);

  // Auto-refresh effect
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchSessions();
      if (selectedSessionId) {
        fetchSessionLogs(selectedSessionId, levelFilter);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [autoRefresh, fetchSessions, fetchSessionLogs, selectedSessionId, levelFilter]);

  // Get log file path for selected session
  const logFilePath = sessions.find(s => s.id === selectedSessionId)?.log_file ?? null;

  return {
    // Session management
    sessions,
    selectedSessionId,
    setSelectedSessionId,
    fetchSessions,
    clearSession,
    cleanupSessions,
    exportSession,
    checkProcessAlive,

    // Logs
    logs,
    loading,
    error,
    levelFilter,
    setLevelFilter,
    autoRefresh,
    setAutoRefresh,
    logFilePath,
    logsDirPath,
    refresh,

    // Legacy
    clearLogs,
    exportLogs,
    addLog,
  };
}
