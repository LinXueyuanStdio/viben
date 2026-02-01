import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";

export interface LogEntry {
  id: string;
  timestamp: string;
  level: "info" | "warning" | "error" | "debug";
  message: string;
  source?: string;
}

export interface LogSession {
  /** Unique run identifier (used for log filename) */
  run_id: string;
  /** Session ID (same as run_id) */
  id: string;
  /** Server instance ID */
  server_id: string;
  /** Human-readable server name */
  server_name: string;
  /** Process ID of the MCP server */
  pid: number | null;
  /** Session creation time */
  created_at: string;
  /** Last update time */
  updated_at: string;
  /** Session end time (null if still running) */
  ended_at: string | null;
  /** Path to the log file */
  log_file: string;
  /** Number of log entries */
  log_count: number;
  /** Number of error entries */
  error_count: number;
  /** Legacy field for compatibility */
  started_at?: string;
}

export interface LogSessionSummary {
  sessions: LogSession[];
  total_sessions: number;
}

export type LogLevel = "all" | "info" | "warning" | "error" | "debug";

export function useLogs() {
  const [sessions, setSessions] = useState<LogSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [levelFilter, setLevelFilter] = useState<LogLevel>("all");
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [logsDirPath, setLogsDirPath] = useState<string | null>(null);

  // Fetch all sessions
  const fetchSessions = useCallback(async (serverId?: string) => {
    try {
      const result = await invoke<LogSessionSummary>("get_log_sessions", {
        serverId: serverId || null,
      });
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
  const fetchSessionLogs = useCallback(async (sessionId: string, filter?: LogLevel) => {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<LogEntry[]>("get_session_logs", {
        sessionId,
        levelFilter: filter === "all" ? null : filter,
        limit: 1000,
      });
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
      await invoke("init_logs");
      const path = await invoke<string>("get_logs_dir_path");
      setLogsDirPath(path);
    } catch (err) {
      console.error("Failed to initialize logs:", err);
    }
  }, []);

  // Clear session
  const clearSession = useCallback(async (sessionId: string) => {
    setLoading(true);
    try {
      await invoke("clear_session_logs", { sessionId });
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
      const deleted = await invoke<number>("cleanup_old_sessions", { keepCount });
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
      const result = await invoke<string>("export_session_logs", {
        sessionId,
        exportPath,
      });
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      throw err;
    }
  }, []);

  // Check if a process is alive by PID
  const checkProcessAlive = useCallback(async (pid: number): Promise<boolean> => {
    try {
      return await invoke<boolean>("is_process_alive", { pid });
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
      await invoke("add_log", { level, message, source, sessionId: null });
    } catch (err) {
      console.error("Failed to add log:", err);
    }
  }, []);

  const clearLogs = useCallback(async () => {
    setLoading(true);
    try {
      await invoke("clear_logs");
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
    throw new Error("No session selected");
  }, [selectedSessionId, exportSession]);

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
