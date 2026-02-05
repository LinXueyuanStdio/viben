import { useState, useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { usePython } from "./use-python";

export interface McpProxyConfig {
  python_path: string;
  host: string;
  port: number;
  auth_token?: string;
}

export interface McpProxyStatus {
  running: boolean;
  pid: number | null;
  host: string | null;
  port: number | null;
  auth_token: string | null;
  url: string | null;
}

export interface PortProcess {
  pid: number;
  name: string | null;
  is_mcp_proxy: boolean;
}

export type PortConflictType = 'proxy_already_running' | 'other_process';

interface UseMcpProxyReturn {
  status: McpProxyStatus | null;
  isLoading: boolean;
  error: string | null;
  isInstalled: boolean | null;
  portConflict: { process: PortProcess; type: PortConflictType } | null;
  startProxy: (config?: Partial<McpProxyConfig>) => Promise<McpProxyStatus>;
  stopProxy: () => Promise<void>;
  refreshStatus: () => Promise<void>;
  checkInstalled: () => Promise<boolean>;
  installProxy: () => Promise<void>;
  getPortProcess: (port?: number) => Promise<PortProcess | null>;
  killPortProcess: (port?: number) => Promise<void>;
  killAndRestart: (port?: number) => Promise<McpProxyStatus>;
  adoptExistingProxy: (port?: number) => Promise<void>;
}

const DEFAULT_CONFIG: McpProxyConfig = {
  python_path: "python",
  host: "127.0.0.1",
  port: 6277,
};

export function useMcpProxy(): UseMcpProxyReturn {
  const [status, setStatus] = useState<McpProxyStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInstalled, setIsInstalled] = useState<boolean | null>(null);
  const [portConflict, setPortConflict] = useState<{ process: PortProcess; type: PortConflictType } | null>(null);

  // Get python path from usePython hook
  const { selectedPython } = usePython();
  const pythonPath = selectedPython?.path;

  const refreshStatus = useCallback(async () => {
    try {
      const result = await invoke<McpProxyStatus>("get_mcp_proxy_status");
      setStatus(result);
      setError(null);
    } catch (e) {
      setError(String(e));
    }
  }, []);

  const checkInstalled = useCallback(async (): Promise<boolean> => {
    try {
      const path = pythonPath || DEFAULT_CONFIG.python_path;
      const result = await invoke<boolean>("check_mcp_proxy_installed", {
        pythonPath: path,
      });
      setIsInstalled(result);
      return result;
    } catch (e) {
      setIsInstalled(false);
      return false;
    }
  }, [pythonPath]);

  const startProxy = useCallback(async (config?: Partial<McpProxyConfig>): Promise<McpProxyStatus> => {
    setIsLoading(true);
    setError(null);
    setPortConflict(null);

    try {
      const fullConfig: McpProxyConfig = {
        ...DEFAULT_CONFIG,
        python_path: pythonPath || DEFAULT_CONFIG.python_path,
        ...config,
      };

      const result = await invoke<McpProxyStatus>("start_mcp_proxy", {
        config: fullConfig,
      });

      setStatus(result);
      return result;
    } catch (e) {
      const errorMsg = String(e);
      const port = config?.port || DEFAULT_CONFIG.port;

      // Check for proxy already running error
      if (errorMsg.startsWith("PROXY_ALREADY_RUNNING:")) {
        const parts = errorMsg.split(":");
        const pid = parseInt(parts[2], 10);
        setPortConflict({
          process: { pid, name: "browse-mcp-proxy", is_mcp_proxy: true },
          type: 'proxy_already_running'
        });
        setError(null); // Don't show error for existing proxy
        // Set status as if proxy is running (without auth token - user needs to adopt or restart)
        setStatus({
          running: false, // Mark as not managed by us
          pid,
          host: "127.0.0.1",
          port,
          auth_token: null,
          url: `http://127.0.0.1:${port}`,
        });
        throw new Error("PROXY_ALREADY_RUNNING");
      }

      // Check for port in use by other process
      if (errorMsg.startsWith("PORT_IN_USE:")) {
        try {
          const process = await invoke<PortProcess | null>("get_port_process", { port });
          if (process) {
            setPortConflict({ process, type: 'other_process' });
          }
        } catch {
          // Ignore errors from get_port_process
        }
        setError(`Port ${port} is in use by another process`);
        throw new Error(errorMsg);
      }

      setError(errorMsg);
      throw new Error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  }, [pythonPath]);

  const stopProxy = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      await invoke("stop_mcp_proxy");
      setStatus({
        running: false,
        pid: null,
        host: null,
        port: null,
        auth_token: null,
        url: null,
      });
    } catch (e) {
      setError(String(e));
      throw e;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const installProxy = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const path = pythonPath || DEFAULT_CONFIG.python_path;
      await invoke("install_mcp_proxy", { pythonPath: path });
      setIsInstalled(true);
    } catch (e) {
      setError(String(e));
      throw e;
    } finally {
      setIsLoading(false);
    }
  }, [pythonPath]);

  const getPortProcess = useCallback(async (port?: number): Promise<PortProcess | null> => {
    try {
      const targetPort = port || DEFAULT_CONFIG.port;
      const result = await invoke<PortProcess | null>("get_port_process", { port: targetPort });
      return result;
    } catch {
      return null;
    }
  }, []);

  const killPortProcess = useCallback(async (port?: number): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      const targetPort = port || DEFAULT_CONFIG.port;
      await invoke("kill_port_process", { port: targetPort });
      setPortConflict(null);
    } catch (e) {
      setError(String(e));
      throw e;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const killAndRestart = useCallback(async (port?: number): Promise<McpProxyStatus> => {
    setIsLoading(true);
    setError(null);

    try {
      const targetPort = port || DEFAULT_CONFIG.port;

      // Kill the process using the port
      await invoke("kill_port_process", { port: targetPort });
      setPortConflict(null);

      // Wait a moment for the port to be released
      await new Promise(resolve => setTimeout(resolve, 500));

      // Start the proxy
      const fullConfig: McpProxyConfig = {
        ...DEFAULT_CONFIG,
        python_path: pythonPath || DEFAULT_CONFIG.python_path,
        port: targetPort,
      };

      const result = await invoke<McpProxyStatus>("start_mcp_proxy", {
        config: fullConfig,
      });

      setStatus(result);
      return result;
    } catch (e) {
      const errorMsg = String(e);
      setError(errorMsg);
      throw new Error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  }, [pythonPath]);

  const adoptExistingProxy = useCallback(async (port?: number): Promise<void> => {
    // When a proxy is already running externally, we can't get its auth token
    // The best we can do is mark it as "running but not managed"
    // User needs to either:
    // 1. Kill and restart to get a new auth token
    // 2. Use a different port
    const targetPort = port || DEFAULT_CONFIG.port;
    setStatus({
      running: false, // We don't manage it
      pid: portConflict?.process.pid || null,
      host: "127.0.0.1",
      port: targetPort,
      auth_token: null, // Can't get auth token from existing process
      url: `http://127.0.0.1:${targetPort}`,
    });
    setPortConflict(null);
    setError("Existing proxy detected but auth token unknown. Please restart to get a new token.");
  }, [portConflict]);

  // Check installation and status on mount
  useEffect(() => {
    checkInstalled();
    refreshStatus();
  }, [checkInstalled, refreshStatus]);

  return {
    status,
    isLoading,
    error,
    isInstalled,
    portConflict,
    startProxy,
    stopProxy,
    refreshStatus,
    checkInstalled,
    installProxy,
    getPortProcess,
    killPortProcess,
    killAndRestart,
    adoptExistingProxy,
  };
}

/**
 * Build proxy URL for MCP connection
 */
export function buildProxyUrl(
  proxyUrl: string,
  targetUrl: string,
  transportType: "stdio" | "sse" | "streamable-http" = "streamable-http"
): string {
  const endpoint = transportType === "stdio" ? "/stdio" :
                   transportType === "sse" ? "/sse" : "/mcp";

  const url = new URL(endpoint, proxyUrl);
  url.searchParams.set("url", targetUrl);
  url.searchParams.set("transport_type", transportType);

  return url.toString();
}

/**
 * Build headers for proxy request
 */
export function buildProxyHeaders(
  authToken: string,
  customHeaders?: Record<string, string>
): Record<string, string> {
  return {
    "X-MCP-Proxy-Auth": `Bearer ${authToken}`,
    ...customHeaders,
  };
}
