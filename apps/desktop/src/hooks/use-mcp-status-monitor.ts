import { useEffect, useRef, useCallback, useMemo, useSyncExternalStore } from "react";
import { getGatewayClient, type McpServerPortStatus } from "@/lib/gateway";
import PQueue from "p-queue";
import { useAppStore } from "@/stores";
import { useMcpWebSocket } from "./use-mcp-websocket";
import type { McpServerStatus, McpServerStatusInfo, McpServerInstance } from "@/types";
import i18n from "@/i18n";

// Configuration constants
const FALLBACK_POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes (only when WebSocket disconnected)
const CACHE_TTL_MS = 60 * 1000; // 1 minute cache TTL
const DEBOUNCE_MS = 100; // 100ms debounce for page enter
const MAX_CONCURRENT_CHECKS = 2; // Max concurrent process checks
const INITIAL_CHECK_DELAY_MS = 1000; // Delay before first check after startup

export type { McpServerPortStatus };

// ============================================================================
// Global Singleton State Manager
// ============================================================================

interface StatusMonitorState {
  wsConnected: boolean;
  isPolling: boolean;
  lastCheckTime: number;
}

type StateListener = () => void;

/**
 * Singleton class to manage MCP status monitoring across all hook instances.
 * This ensures only ONE WebSocket connection and ONE polling interval exist.
 */
class McpStatusMonitorManager {
  private static instance: McpStatusMonitorManager | null = null;

  // State
  private state: StatusMonitorState = {
    wsConnected: false,
    isPolling: false,
    lastCheckTime: 0,
  };
  private listeners = new Set<StateListener>();

  // Singleton resources
  private queue: PQueue;
  private pendingChecks = new Map<string, Promise<McpServerStatusInfo>>();
  private pollIntervalId: ReturnType<typeof setInterval> | null = null;
  private debounceTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private initialCheckTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private hasInitialCheck = false;

  // Reference count for cleanup
  private refCount = 0;

  private constructor() {
    this.queue = new PQueue({ concurrency: MAX_CONCURRENT_CHECKS });
  }

  static getInstance(): McpStatusMonitorManager {
    if (!McpStatusMonitorManager.instance) {
      McpStatusMonitorManager.instance = new McpStatusMonitorManager();
    }
    return McpStatusMonitorManager.instance;
  }

  // ---- State Management ----

  getState(): StatusMonitorState {
    return this.state;
  }

  private setState(partial: Partial<StatusMonitorState>) {
    this.state = { ...this.state, ...partial };
    this.notifyListeners();
  }

  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners() {
    this.listeners.forEach((listener) => listener());
  }

  // ---- Reference Counting ----

  addRef() {
    this.refCount++;
  }

  removeRef() {
    this.refCount--;
    if (this.refCount <= 0) {
      this.cleanup();
    }
  }

  private cleanup() {
    this.stopPolling();
    if (this.debounceTimeoutId) {
      clearTimeout(this.debounceTimeoutId);
      this.debounceTimeoutId = null;
    }
    if (this.initialCheckTimeoutId) {
      clearTimeout(this.initialCheckTimeoutId);
      this.initialCheckTimeoutId = null;
    }
    this.pendingChecks.clear();
    this.hasInitialCheck = false;
  }

  // ---- WebSocket Connection State ----

  setWsConnected(connected: boolean) {
    if (this.state.wsConnected === connected) return;

    this.setState({ wsConnected: connected });

    if (connected) {
      // WebSocket connected - stop polling
      this.stopPolling();
      this.hasInitialCheck = false;
    } else {
      // WebSocket disconnected - start fallback polling with delay
      this.startPollingWithDelay();
    }
  }

  // ---- Polling Control ----

  private startPollingWithDelay() {
    // Don't start if already polling
    if (this.state.isPolling) return;

    // Clear any existing initial check timeout
    if (this.initialCheckTimeoutId) {
      clearTimeout(this.initialCheckTimeoutId);
    }

    // Delay the first check to let the system stabilize
    if (!this.hasInitialCheck) {
      this.initialCheckTimeoutId = setTimeout(() => {
        this.hasInitialCheck = true;
        this.doCheckAllServers(false);
        this.startPollingInterval();
      }, INITIAL_CHECK_DELAY_MS);
    } else {
      this.startPollingInterval();
    }
  }

  private startPollingInterval() {
    if (this.pollIntervalId) return;

    this.setState({ isPolling: true });
    this.pollIntervalId = setInterval(() => {
      this.doCheckAllServers(false);
    }, FALLBACK_POLL_INTERVAL_MS);
  }

  private stopPolling() {
    if (this.pollIntervalId) {
      clearInterval(this.pollIntervalId);
      this.pollIntervalId = null;
    }
    if (this.initialCheckTimeoutId) {
      clearTimeout(this.initialCheckTimeoutId);
      this.initialCheckTimeoutId = null;
    }
    this.setState({ isPolling: false });
  }

  // ---- Status Checking ----

  isStatusValid(serverId: string): boolean {
    const { mcpServerStatuses } = useAppStore.getState();
    const statusInfo = mcpServerStatuses[serverId];
    if (!statusInfo) return false;
    return Date.now() - statusInfo.lastChecked < CACHE_TTL_MS;
  }

  async checkServer(serverId: string, force = false): Promise<McpServerStatusInfo> {
    const { mcpServers, mcpServerStatuses, setMcpServerStatus, setMcpServerStatusInfo } =
      useAppStore.getState();

    // Check cache first (unless force is true)
    if (!force && this.isStatusValid(serverId)) {
      return mcpServerStatuses[serverId];
    }

    // Check if there's already a pending check for this server
    const pending = this.pendingChecks.get(serverId);
    if (pending) {
      return pending;
    }

    // Find the server
    const server = mcpServers.find((s) => s.id === serverId);
    if (!server) {
      const errorInfo: McpServerStatusInfo = {
        status: "error",
        lastChecked: Date.now(),
        error: i18n.t("errors.mcp.serverNotFound", "Server not found"),
      };
      return errorInfo;
    }

    // Queue the check with deduplication
    const checkPromise = this.queue.add(async () => {
      try {
        return await this.performServerCheck(server, setMcpServerStatus, setMcpServerStatusInfo);
      } finally {
        this.pendingChecks.delete(serverId);
      }
    });

    this.pendingChecks.set(serverId, checkPromise as Promise<McpServerStatusInfo>);
    return checkPromise as Promise<McpServerStatusInfo>;
  }

  private async performServerCheck(
    server: McpServerInstance,
    setMcpServerStatus: (id: string, status: McpServerStatus, pid?: number, error?: string) => void,
    setMcpServerStatusInfo: (id: string, info: McpServerStatusInfo) => void
  ): Promise<McpServerStatusInfo> {
    try {
      const client = getGatewayClient();
      let status: McpServerStatus = "stopped";
      let error: string | undefined;
      let detectedPid: number | undefined = server.pid ?? undefined;

      // Fast path: Check if the server has a PID and if the process is alive
      if (server.pid) {
        const isAlive = await client.isProcessAlive(server.pid);
        if (isAlive) {
          status = "running";
        } else {
          // PID is dead, check Gateway for error details
          detectedPid = undefined;

          // Try to get detailed error info from Gateway
          try {
            const mcpStatus = await client.getMcpStatus();
            if (mcpStatus.pid === server.pid && !mcpStatus.running) {
              if (mcpStatus.error) {
                error = mcpStatus.error;
              } else if (mcpStatus.exitCode !== undefined && mcpStatus.exitCode !== 0) {
                error = i18n.t("errors.mcp.processExitedWithCode", { defaultValue: "Process exited with code {{code}}", code: mcpStatus.exitCode });
                if (mcpStatus.stderr) {
                  error += `\n${mcpStatus.stderr.trim().slice(-500)}`;
                }
              }
            }
          } catch {
            // Ignore error fetching detailed status
          }
        }
      }

      // If no running PID found, fall back to port-based detection
      if (status !== "running" && server.port && server.transport !== "stdio") {
        try {
          const portStatus = await client.checkMcpServerOnPort(server.port);

          if (portStatus.status === "running" && portStatus.is_mcp_server) {
            status = "running";
            detectedPid = portStatus.pid ?? undefined;
          } else if (portStatus.status === "conflict") {
            status = "error";
            error = i18n.t("errors.mcp.portInUse", { defaultValue: "Port {{port}} is in use by another process: {{process}}", port: server.port, process: portStatus.process_name || i18n.t("common.unknown", "unknown") });
          } else {
            status = "stopped";
          }
        } catch (portErr) {
          console.warn("Port check failed:", portErr);
          if (server.pid && !detectedPid) {
            status = "error";
            error = error || i18n.t("errors.mcp.processTerminated", "Process terminated unexpectedly");
          } else if (server.status === "running") {
            status = "error";
            error = error || i18n.t("errors.mcp.statusCheckFailed", "Server marked as running but status check failed");
          }
        }
      } else if (status !== "running") {
        if (server.pid && !detectedPid) {
          status = "error";
          error = error || i18n.t("errors.mcp.processTerminated", "Process terminated unexpectedly");
        } else if (server.status === "running" && !server.pid) {
          status = "error";
          error = error || i18n.t("errors.mcp.runningNoProcessId", "Server marked as running but no process ID");
        }
      }

      const statusInfo: McpServerStatusInfo = {
        status,
        lastChecked: Date.now(),
        error,
        pid: detectedPid,
      };

      // Update store with new status
      setMcpServerStatusInfo(server.id, statusInfo);

      // Also update the server's status and PID if they changed
      if (server.status !== status || server.pid !== detectedPid) {
        setMcpServerStatus(server.id, status, detectedPid, error);
      }

      return statusInfo;
    } catch (err) {
      const errorInfo: McpServerStatusInfo = {
        status: "error",
        lastChecked: Date.now(),
        error: err instanceof Error ? err.message : String(err),
      };
      setMcpServerStatusInfo(server.id, errorInfo);
      return errorInfo;
    }
  }

  async checkAllServers(force = false): Promise<Map<string, McpServerStatusInfo>> {
    return this.doCheckAllServers(force);
  }

  private async doCheckAllServers(force: boolean): Promise<Map<string, McpServerStatusInfo>> {
    const { mcpServers } = useAppStore.getState();
    const results = new Map<string, McpServerStatusInfo>();

    // Filter servers that need checking
    const serversToCheck = force
      ? mcpServers
      : mcpServers.filter((s) => !this.isStatusValid(s.id));

    // Queue all checks in parallel (queue handles concurrency)
    const checkPromises = serversToCheck.map(async (server) => {
      const statusInfo = await this.checkServer(server.id, force);
      results.set(server.id, statusInfo);
    });

    await Promise.all(checkPromises);
    this.setState({ lastCheckTime: Date.now() });

    return results;
  }

  triggerCheck(force = false) {
    // Clear existing debounce timeout
    if (this.debounceTimeoutId) {
      clearTimeout(this.debounceTimeoutId);
    }

    // Set new debounced check
    this.debounceTimeoutId = setTimeout(() => {
      this.doCheckAllServers(force);
    }, DEBOUNCE_MS);
  }
}

// ============================================================================
// React Hooks
// ============================================================================

/**
 * Hook for monitoring MCP server status
 *
 * Uses WebSocket for real-time updates when connected.
 * Falls back to polling (5-minute interval) when WebSocket is disconnected.
 *
 * IMPORTANT: This hook uses a singleton manager internally, so multiple
 * instances share the same polling interval and WebSocket connection.
 */
export function useMcpStatusMonitor() {
  const manager = useMemo(() => McpStatusMonitorManager.getInstance(), []);

  const {
    mcpServers,
    mcpServerStatuses,
  } = useAppStore();

  // Subscribe to manager state changes
  const state = useSyncExternalStore(
    useCallback((onStoreChange) => manager.subscribe(onStoreChange), [manager]),
    () => manager.getState(),
    () => manager.getState()
  );

  // Reference counting for cleanup
  useEffect(() => {
    manager.addRef();
    return () => {
      manager.removeRef();
    };
  }, [manager]);

  // Check if a server status is still valid (within cache TTL)
  const isStatusValid = useCallback(
    (serverId: string): boolean => {
      return manager.isStatusValid(serverId);
    },
    [manager]
  );

  // Check status of a single server
  const checkServer = useCallback(
    async (serverId: string, force = false): Promise<McpServerStatusInfo> => {
      return manager.checkServer(serverId, force);
    },
    [manager]
  );

  // Check status of all servers
  const checkAllServers = useCallback(
    async (force = false): Promise<Map<string, McpServerStatusInfo>> => {
      return manager.checkAllServers(force);
    },
    [manager]
  );

  // Trigger a debounced check
  const triggerCheck = useCallback(
    (force = false) => {
      manager.triggerCheck(force);
    },
    [manager]
  );

  // Get computed statistics
  const getStats = useCallback(() => {
    let running = 0;
    let stopped = 0;
    let error = 0;

    for (const server of mcpServers) {
      const statusInfo = mcpServerStatuses[server.id];
      const status = statusInfo?.status ?? server.status;

      switch (status) {
        case "running":
          running++;
          break;
        case "error":
          error++;
          break;
        default:
          stopped++;
      }
    }

    return {
      total: mcpServers.length,
      running,
      stopped,
      error,
    };
  }, [mcpServers, mcpServerStatuses]);

  return {
    // Status checking
    checkServer,
    checkAllServers,
    isStatusValid,

    // Polling control (exposed for manual control if needed)
    triggerCheck,

    // Statistics
    getStats,

    // Direct access to statuses
    statuses: mcpServerStatuses,

    // WebSocket connection status
    wsConnected: state.wsConnected,
  };
}

/**
 * Hook to manage WebSocket connection for MCP status updates.
 * Should be called ONCE at the app root level.
 */
export function useMcpStatusWebSocket() {
  const manager = useMemo(() => McpStatusMonitorManager.getInstance(), []);

  // Subscribe to WebSocket for real-time updates
  const { isConnected: wsConnected } = useMcpWebSocket({
    enabled: true,
    updateStore: true,
  });

  // Update manager with WebSocket connection status
  useEffect(() => {
    manager.setWsConnected(wsConnected);
  }, [manager, wsConnected]);

  return { wsConnected };
}

/**
 * Hook to trigger status check when a page is entered
 * Use this in page components that need fresh status
 */
export function useOnPageEnter(options: { enabled?: boolean; forceCheck?: boolean } = {}) {
  const { enabled = true, forceCheck = false } = options;
  const { triggerCheck } = useMcpStatusMonitor();
  const hasTriggeredRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    // Only trigger once per mount
    if (!hasTriggeredRef.current) {
      hasTriggeredRef.current = true;
      triggerCheck(forceCheck);
    }

    return () => {
      hasTriggeredRef.current = false;
    };
  }, [enabled, forceCheck, triggerCheck]);
}

/**
 * Hook to get server status with automatic refresh
 * Returns status info for a specific server
 */
export function useServerStatus(serverId: string | undefined) {
  const { mcpServerStatuses, mcpServers } = useAppStore();
  const { checkServer } = useMcpStatusMonitor();

  // Find the server
  const server = serverId ? mcpServers.find((s) => s.id === serverId) : undefined;

  // Get cached status
  const statusInfo = serverId ? mcpServerStatuses[serverId] : undefined;

  // Determine effective status
  const effectiveStatus: McpServerStatus = statusInfo?.status ?? server?.status ?? "stopped";

  // Refresh status
  const refresh = useCallback(async () => {
    if (serverId) {
      await checkServer(serverId, true);
    }
  }, [serverId, checkServer]);

  return {
    status: effectiveStatus,
    statusInfo,
    server,
    refresh,
    isRunning: effectiveStatus === "running",
    isStopped: effectiveStatus === "stopped",
    isError: effectiveStatus === "error",
    lastChecked: statusInfo?.lastChecked,
    error: statusInfo?.error,
  };
}
