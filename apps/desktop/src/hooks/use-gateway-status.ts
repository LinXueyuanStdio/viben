/**
 * Gateway Status Hook
 *
 * Provides global gateway connection status monitoring.
 * Auto-pings the gateway periodically and tracks connection state.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { getGatewayClient, getGatewayUrl, setGatewayUrl } from "@/lib/gateway";
import { useWorkspaceStore, useAppStore } from "@/stores";
import type { Workspace } from "@/types";
import { pollWithBackoff, createPollController } from "@/lib/onboarding/polling";
import { GATEWAY_READINESS_POLICY } from "@/lib/onboarding/runtime-policies";
import i18n from "@/i18n";
import { useAnalytics } from "@/lib/analytics";
import { AnalyticsEvents } from "@/lib/analytics/types";

export type GatewayStatus = "connected" | "disconnected" | "connecting" | "error";

export interface UseGatewayStatusReturn {
  /** Current connection status */
  status: GatewayStatus;
  /** Whether the gateway is connected */
  isConnected: boolean;
  /** Whether we're currently checking connection */
  isChecking: boolean;
  /** Last successful connection timestamp */
  lastConnected: number | null;
  /** Last error message if any */
  error: string | null;
  /** Current gateway URL */
  gatewayUrl: string;
  /** Manually check connection */
  checkConnection: () => Promise<boolean>;
  /** Check connection with exponential backoff (for bootstrap) */
  checkConnectionWithBackoff: () => Promise<boolean>;
  /** Update gateway URL */
  updateGatewayUrl: (url: string) => void;
}

// Global state for singleton pattern
let globalStatus: GatewayStatus = "disconnected";
let globalLastConnected: number | null = null;
let globalError: string | null = null;
let globalListeners: Set<() => void> = new Set();
let pingInterval: NodeJS.Timeout | null = null;

// Notify all listeners of state change
function notifyListeners() {
  globalListeners.forEach((listener) => listener());
}

// Load workspaces when gateway connects (only if no persisted data)
async function loadWorkspacesOnConnect() {
  const store = useWorkspaceStore.getState();

  // Skip if already have workspaces (persisted data) or if already loading
  if (store.workspaces.length > 0 || store.isLoading) {
    return;
  }

  try {
    store.setLoading(true);
    const client = getGatewayClient();
    const response = await client.listWorkspaces();

    // Transform gateway workspaces to local format
    // Global workspace is identified by id === "global"
    const workspaces: Workspace[] = response.workspaces.map((w) => ({
      id: w.id,
      path: w.path,
      name: w.name,
      created_at: w.created_at || new Date().toISOString(),
      last_accessed: w.updated_at || new Date().toISOString(),
    }));

    store.setWorkspaces(workspaces);
  } catch (err) {
    console.error("Failed to load workspaces on gateway connect:", err);
  } finally {
    store.setLoading(false);
  }
}

// Load developer preferences from config when gateway connects
async function loadPreferencesOnConnect() {
  try {
    await useAppStore.getState().loadDeveloperPreferences();
  } catch (err) {
    console.error("Failed to load developer preferences on gateway connect:", err);
  }
}

// Ping the gateway and update global state
async function pingGateway(): Promise<boolean> {
  const client = getGatewayClient();
  const wasConnected = globalStatus === "connected";

  try {
    const isOnline = await client.ping();
    if (isOnline) {
      globalStatus = "connected";
      globalLastConnected = Date.now();
      globalError = null;

      // Load data on first connect or reconnect
      if (!wasConnected) {
        loadWorkspacesOnConnect();
        loadPreferencesOnConnect();
      }
    } else {
      globalStatus = "disconnected";
      globalError = null;
    }
    notifyListeners();
    return isOnline;
  } catch (err) {
    globalStatus = "error";
    globalError = err instanceof Error ? err.message : i18n.t("errors.gateway.unknownError", "Unknown error");
    notifyListeners();
    return false;
  }
}

// Start periodic ping if not already started
function startPingInterval() {
  if (pingInterval) return;

  // Initial ping
  pingGateway();

  // Ping every 10 seconds
  pingInterval = setInterval(() => {
    pingGateway();
  }, 10000);
}

// Stop periodic ping when no listeners
function stopPingInterval() {
  if (pingInterval && globalListeners.size === 0) {
    clearInterval(pingInterval);
    pingInterval = null;
  }
}

/**
 * Hook to monitor gateway connection status globally.
 *
 * Uses a singleton pattern - all components share the same connection state.
 * Automatically pings the gateway periodically.
 */
export function useGatewayStatus(): UseGatewayStatusReturn {
  const { logEvent } = useAnalytics();
  const [, forceUpdate] = useState({});
  const isMounted = useRef(true);
  const prevStatusRef = useRef<GatewayStatus>("disconnected");
  const disconnectedAtRef = useRef<number | null>(null);

  // Register listener on mount, unregister on unmount
  useEffect(() => {
    isMounted.current = true;

    const listener = () => {
      // Track gateway connection state changes
      const prevStatus = prevStatusRef.current;
      const currentStatus = globalStatus;

      if (prevStatus !== currentStatus) {
        if (currentStatus === "disconnected" && prevStatus === "connected") {
          disconnectedAtRef.current = Date.now();
          try {
            logEvent(AnalyticsEvents.GATEWAY_CONNECTION_LOST, {
              previous_status: prevStatus,
              disconnect_reason: "ping_failed",
              connection_duration_ms: 0,
            });
          } catch {}
        } else if (currentStatus === "connected" && prevStatus === "disconnected") {
          const outageDuration = disconnectedAtRef.current ? Date.now() - disconnectedAtRef.current : 0;
          disconnectedAtRef.current = null;
          try {
            logEvent(AnalyticsEvents.GATEWAY_CONNECTION_RESTORED, {
              outage_duration_ms: outageDuration,
              reconnect_attempts: 1,
            });
          } catch {}
        }
        prevStatusRef.current = currentStatus;
      }

      if (isMounted.current) {
        forceUpdate({});
      }
    };

    globalListeners.add(listener);
    startPingInterval();

    return () => {
      isMounted.current = false;
      globalListeners.delete(listener);
      stopPingInterval();
    };
  }, []);

  const checkConnection = useCallback(async () => {
    globalStatus = "connecting";
    notifyListeners();
    return pingGateway();
  }, []);

  /**
   * Check connection with exponential backoff.
   * Used during bootstrap for more reliable connection checking.
   */
  const checkConnectionWithBackoff = useCallback(async (): Promise<boolean> => {
    globalStatus = "connecting";
    notifyListeners();

    const controller = createPollController();
    const client = getGatewayClient();

    const result = await pollWithBackoff({
      policy: GATEWAY_READINESS_POLICY,
      poll: async () => {
        try {
          const response = await client.request<Response>("/health", {
            method: "GET",
            signal: AbortSignal.timeout(5000),
            responseType: "response",
          });
          if (response.ok) {
            return { done: true, value: true };
          }
          return { done: false };
        } catch {
          return { done: false };
        }
      },
      shouldAbort: controller.shouldAbort,
      onAttempt: (attempt, nextInterval) => {
        console.log(`[useGatewayStatus] Connection attempt ${attempt}, next in ${nextInterval}ms`);
      },
    });

    if (result.success) {
      globalStatus = "connected";
      globalLastConnected = Date.now();
      globalError = null;
      notifyListeners();
      // Load data on connect
      loadWorkspacesOnConnect();
      loadPreferencesOnConnect();
      return true;
    } else {
      globalStatus = result.reason === "timeout" ? "error" : "disconnected";
      globalError = result.reason === "timeout" ? i18n.t("errors.gateway.connectionTimeout", "Connection timeout") : null;
      notifyListeners();
      return false;
    }
  }, []);

  const updateGatewayUrl = useCallback((url: string) => {
    setGatewayUrl(url);
    getGatewayClient().setBaseUrl(url);
    // Immediately check connection with new URL
    checkConnection();
  }, [checkConnection]);

  return {
    status: globalStatus,
    isConnected: globalStatus === "connected",
    isChecking: globalStatus === "connecting",
    lastConnected: globalLastConnected,
    error: globalError,
    gatewayUrl: getGatewayUrl(),
    checkConnection,
    checkConnectionWithBackoff,
    updateGatewayUrl,
  };
}
