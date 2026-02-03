import { useEffect, useRef, useCallback, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import PQueue from "p-queue";
import { useAppStore } from "@/stores";
import type { McpServerStatus, McpServerStatusInfo } from "@/types";

// Configuration constants
const POLL_INTERVAL_MS = 60 * 1000; // 1 minute
const CACHE_TTL_MS = 30 * 1000; // 30 seconds
const DEBOUNCE_MS = 300; // 300ms debounce for page enter
const MAX_CONCURRENT_CHECKS = 2; // Max concurrent process checks

// Singleton queue instance for concurrency control
let globalQueue: PQueue | null = null;

function getQueue(): PQueue {
  if (!globalQueue) {
    globalQueue = new PQueue({ concurrency: MAX_CONCURRENT_CHECKS });
  }
  return globalQueue;
}

// Track pending checks to avoid duplicate requests
const pendingChecks = new Map<string, Promise<McpServerStatusInfo>>();

/**
 * Hook for monitoring MCP server status
 * Provides intelligent polling with caching and debouncing
 */
export function useMcpStatusMonitor() {
  const {
    mcpServers,
    mcpServerStatuses,
    setMcpServerStatus,
    setMcpServerStatusInfo,
  } = useAppStore();

  const queue = useMemo(() => getQueue(), []);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Check if a server status is still valid (within cache TTL)
   */
  const isStatusValid = useCallback((serverId: string): boolean => {
    const statusInfo = mcpServerStatuses[serverId];
    if (!statusInfo) return false;
    return Date.now() - statusInfo.lastChecked < CACHE_TTL_MS;
  }, [mcpServerStatuses]);

  /**
   * Check status of a single server
   * Uses task deduplication and caching
   */
  const checkServer = useCallback(async (serverId: string, force = false): Promise<McpServerStatusInfo> => {
    // Check cache first (unless force is true)
    if (!force && isStatusValid(serverId)) {
      return mcpServerStatuses[serverId];
    }

    // Check if there's already a pending check for this server
    const pending = pendingChecks.get(serverId);
    if (pending) {
      return pending;
    }

    // Find the server
    const server = mcpServers.find((s) => s.id === serverId);
    if (!server) {
      const errorInfo: McpServerStatusInfo = {
        status: "error",
        lastChecked: Date.now(),
        error: "Server not found",
      };
      return errorInfo;
    }

    // Queue the check with deduplication
    const checkPromise = queue.add(async () => {
      try {
        let status: McpServerStatus = "stopped";
        let error: string | undefined;

        // Check if the server has a PID and if the process is alive
        if (server.pid) {
          const isAlive = await invoke<boolean>("is_process_alive", { pid: server.pid });
          if (isAlive) {
            status = "running";
          } else {
            // Process died unexpectedly
            status = "error";
            error = "Process terminated unexpectedly";
          }
        } else if (server.status === "running") {
          // Server marked as running but no PID - likely an error state
          status = "error";
          error = "Server marked as running but no process ID";
        } else {
          status = "stopped";
        }

        const statusInfo: McpServerStatusInfo = {
          status,
          lastChecked: Date.now(),
          error,
          pid: server.pid ?? undefined,
        };

        // Update store with new status
        setMcpServerStatusInfo(serverId, statusInfo);

        // Also update the server's status if it changed
        if (server.status !== status) {
          setMcpServerStatus(serverId, status, server.pid, error);
        }

        return statusInfo;
      } catch (err) {
        const errorInfo: McpServerStatusInfo = {
          status: "error",
          lastChecked: Date.now(),
          error: err instanceof Error ? err.message : String(err),
        };
        setMcpServerStatusInfo(serverId, errorInfo);
        return errorInfo;
      } finally {
        // Clean up pending check
        pendingChecks.delete(serverId);
      }
    });

    // Store the pending promise
    pendingChecks.set(serverId, checkPromise as Promise<McpServerStatusInfo>);

    return checkPromise as Promise<McpServerStatusInfo>;
  }, [mcpServers, mcpServerStatuses, isStatusValid, setMcpServerStatus, setMcpServerStatusInfo, queue]);

  /**
   * Check status of all servers
   * Only checks servers that need checking (cache expired or force)
   */
  const checkAllServers = useCallback(async (force = false): Promise<Map<string, McpServerStatusInfo>> => {
    const results = new Map<string, McpServerStatusInfo>();

    // Filter servers that need checking
    const serversToCheck = force
      ? mcpServers
      : mcpServers.filter((s) => !isStatusValid(s.id));

    // Queue all checks in parallel (queue handles concurrency)
    const checkPromises = serversToCheck.map(async (server) => {
      const statusInfo = await checkServer(server.id, force);
      results.set(server.id, statusInfo);
    });

    await Promise.all(checkPromises);

    return results;
  }, [mcpServers, isStatusValid, checkServer]);

  /**
   * Start the periodic polling
   */
  const startPolling = useCallback(() => {
    // Clear existing interval if any
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }

    // Start new polling interval
    pollIntervalRef.current = setInterval(() => {
      checkAllServers(false);
    }, POLL_INTERVAL_MS);

    // Do an immediate check
    checkAllServers(false);
  }, [checkAllServers]);

  /**
   * Stop the periodic polling
   */
  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  /**
   * Trigger a debounced check (for page enter events)
   */
  const triggerCheck = useCallback((force = false) => {
    // Clear existing debounce timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // Set new debounced check
    debounceTimeoutRef.current = setTimeout(() => {
      checkAllServers(force);
    }, DEBOUNCE_MS);
  }, [checkAllServers]);

  /**
   * Get computed statistics
   */
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPolling();
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [stopPolling]);

  return {
    // Status checking
    checkServer,
    checkAllServers,
    isStatusValid,

    // Polling control
    startPolling,
    stopPolling,
    triggerCheck,

    // Statistics
    getStats,

    // Direct access to statuses
    statuses: mcpServerStatuses,
  };
}

/**
 * Hook to trigger status check when a page is entered
 * Use this in page components that need fresh status
 */
export function useOnPageEnter(options: { enabled?: boolean } = {}) {
  const { enabled = true } = options;
  const { triggerCheck, startPolling, stopPolling } = useMcpStatusMonitor();
  const hasTriggeredRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    // Only trigger once per mount
    if (!hasTriggeredRef.current) {
      hasTriggeredRef.current = true;
      triggerCheck();
    }

    // Start polling while on this page
    startPolling();

    // Cleanup: stop polling when leaving the page
    return () => {
      hasTriggeredRef.current = false;
      stopPolling();
    };
  }, [enabled, triggerCheck, startPolling, stopPolling]);
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
