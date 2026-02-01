import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { McpStartConfig, McpStatus } from "@/types";

export interface PortStatus {
  in_use: boolean;
  pid: number | null;
  process_name: string | null;
}

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

  const startServer = useCallback(async (config: McpStartConfig) => {
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

  const checkPortStatus = useCallback(async (port: number): Promise<PortStatus> => {
    try {
      return await invoke<PortStatus>("check_port_status", { port });
    } catch (err) {
      return { in_use: false, pid: null, process_name: null };
    }
  }, []);

  const killProcess = useCallback(async (pid: number): Promise<boolean> => {
    try {
      return await invoke<boolean>("kill_process", { pid });
    } catch (err) {
      return false;
    }
  }, []);

  const isProcessAlive = useCallback(async (pid: number): Promise<boolean> => {
    try {
      return await invoke<boolean>("is_process_alive", { pid });
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
    checkPortStatus,
    killProcess,
    isProcessAlive,
  };
}
