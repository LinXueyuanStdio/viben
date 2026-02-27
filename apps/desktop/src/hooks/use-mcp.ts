import { useState, useEffect, useCallback } from "react";
import {
  getGatewayClient,
  type McpStatus,
  type McpStartConfig,
  type PortStatus,
} from "@/lib/gateway";

export type { McpStatus, McpStartConfig, PortStatus };

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
      const client = getGatewayClient();
      const currentStatus = await client.getMcpStatus();
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
      const client = getGatewayClient();
      const newStatus = await client.startMcpServer(config);
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
      const client = getGatewayClient();
      await client.stopMcpServer();
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
      const client = getGatewayClient();
      return await client.testMcpConnection(pythonPath);
    } catch {
      return false;
    }
  }, []);

  const checkPortStatus = useCallback(async (port: number): Promise<PortStatus> => {
    try {
      const client = getGatewayClient();
      return await client.checkPortStatus(port);
    } catch {
      return { in_use: false, pid: null, process_name: null };
    }
  }, []);

  const killProcess = useCallback(async (pid: number): Promise<boolean> => {
    try {
      const client = getGatewayClient();
      return await client.killProcess(pid);
    } catch {
      return false;
    }
  }, []);

  const isProcessAlive = useCallback(async (pid: number): Promise<boolean> => {
    try {
      const client = getGatewayClient();
      return await client.isProcessAlive(pid);
    } catch {
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
