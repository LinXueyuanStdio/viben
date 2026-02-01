import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { McpConfig, McpStatus } from "@/types";

export function useMcp() {
  const [status, setStatus] = useState<McpStatus>({
    running: false,
    pid: null,
    transport: null,
    port: null,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getStatus = useCallback(async () => {
    try {
      const currentStatus = await invoke<McpStatus>("get_mcp_status");
      setStatus(currentStatus);
      return currentStatus;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return null;
    }
  }, []);

  const startServer = useCallback(async (config: McpConfig) => {
    setLoading(true);
    setError(null);
    try {
      const newStatus = await invoke<McpStatus>("start_mcp_server", { config });
      setStatus(newStatus);
      return newStatus;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const stopServer = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await invoke("stop_mcp_server");
      setStatus({
        running: false,
        pid: null,
        transport: null,
        port: null,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const testConnection = useCallback(async (pythonPath: string) => {
    try {
      return await invoke<boolean>("test_mcp_connection", { pythonPath });
    } catch (err) {
      return false;
    }
  }, []);

  // Poll status periodically when running
  useEffect(() => {
    getStatus();

    const interval = setInterval(() => {
      if (status.running) {
        getStatus();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [getStatus, status.running]);

  return {
    status,
    loading,
    error,
    getStatus,
    startServer,
    stopServer,
    testConnection,
  };
}
