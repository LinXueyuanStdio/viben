/**
 * MCP WebSocket Hook
 *
 * Subscribes to the "mcp" WebSocket channel and handles MCP-related events.
 * Updates Zustand store when MCP server status changes.
 */

import { useCallback, useRef } from "react";
import { useGatewayWebSocket, type GatewayEventPayload } from "./use-gateway-websocket";
import { useAppStore } from "@/stores";
import type {
  McpProcessStatusChangedData,
  McpServerEventData,
  McpConfigChangedData,
  McpWebSocketEventType,
} from "@/lib/gateway/types";

/** Callback types for MCP events */
export interface McpWebSocketCallbacks {
  /** Called when MCP process status changes */
  onProcessStatusChanged?: (data: McpProcessStatusChangedData) => void;
  /** Called when MCP server starts */
  onServerStarted?: (data: McpServerEventData) => void;
  /** Called when MCP server stops */
  onServerStopped?: (data: McpServerEventData) => void;
  /** Called when MCP config file changes */
  onConfigChanged?: (data: McpConfigChangedData) => void;
}

/** Options for useMcpWebSocket hook */
export interface UseMcpWebSocketOptions extends McpWebSocketCallbacks {
  /** Whether to enable the WebSocket connection (default: true) */
  enabled?: boolean;
  /** Whether to update Zustand store on events (default: true) */
  updateStore?: boolean;
}

/** Return type for useMcpWebSocket hook */
export interface UseMcpWebSocketReturn {
  /** Whether WebSocket is connected */
  isConnected: boolean;
  /** Current WebSocket connection state */
  state: "connected" | "connecting" | "disconnected" | "reconnecting";
}

/**
 * Hook for subscribing to MCP WebSocket events with automatic store updates
 *
 * @example
 * ```tsx
 * // Basic usage - just subscribe with store updates
 * const { isConnected } = useMcpWebSocket();
 *
 * // With custom callbacks
 * const { isConnected } = useMcpWebSocket({
 *   onProcessStatusChanged: (data) => {
 *     console.log(`Server ${data.server_name} changed from ${data.old_status} to ${data.new_status}`);
 *   },
 *   onConfigChanged: (data) => {
 *     console.log("Config file changed:", data.config_path);
 *   },
 * });
 *
 * // Disable store updates (custom handling only)
 * const { isConnected } = useMcpWebSocket({
 *   updateStore: false,
 *   onProcessStatusChanged: handleStatusChange,
 * });
 * ```
 */
export function useMcpWebSocket(options: UseMcpWebSocketOptions = {}): UseMcpWebSocketReturn {
  const {
    enabled = true,
    updateStore = true,
    onProcessStatusChanged,
    onServerStarted,
    onServerStopped,
    onConfigChanged,
  } = options;

  const {
    setMcpServerStatus,
    setMcpServerStatusInfo,
  } = useAppStore();

  // Store callbacks in refs to avoid recreating event handler
  const onProcessStatusChangedRef = useRef(onProcessStatusChanged);
  const onServerStartedRef = useRef(onServerStarted);
  const onServerStoppedRef = useRef(onServerStopped);
  const onConfigChangedRef = useRef(onConfigChanged);

  // Update refs when callbacks change
  onProcessStatusChangedRef.current = onProcessStatusChanged;
  onServerStartedRef.current = onServerStarted;
  onServerStoppedRef.current = onServerStopped;
  onConfigChangedRef.current = onConfigChanged;

  // Handle incoming MCP events
  const handleEvent = useCallback(
    (channel: string, payload: GatewayEventPayload) => {
      if (channel !== "mcp") return;

      const eventType = payload.type as McpWebSocketEventType;
      const data = payload.data as Record<string, unknown>;

      switch (eventType) {
        case "McpProcessStatusChanged": {
          const statusData = data as unknown as McpProcessStatusChangedData;

          // Update Zustand store
          if (updateStore) {
            setMcpServerStatus(
              statusData.server_id,
              statusData.new_status,
              statusData.pid,
              statusData.error
            );
            setMcpServerStatusInfo(statusData.server_id, {
              status: statusData.new_status,
              lastChecked: Date.now(),
              pid: statusData.pid,
              error: statusData.error,
            });
          }

          // Call user callback
          onProcessStatusChangedRef.current?.(statusData);
          break;
        }

        case "McpServerStarted": {
          const serverData = data as unknown as McpServerEventData;

          // Update Zustand store
          if (updateStore) {
            setMcpServerStatus(
              serverData.server_id,
              "running",
              serverData.pid,
              undefined
            );
            setMcpServerStatusInfo(serverData.server_id, {
              status: "running",
              lastChecked: Date.now(),
              pid: serverData.pid,
            });
          }

          // Call user callback
          onServerStartedRef.current?.(serverData);
          break;
        }

        case "McpServerStopped": {
          const serverData = data as unknown as McpServerEventData;

          // Update Zustand store
          if (updateStore) {
            const status = serverData.error ? "error" : "stopped";
            setMcpServerStatus(
              serverData.server_id,
              status,
              undefined,
              serverData.error
            );
            setMcpServerStatusInfo(serverData.server_id, {
              status,
              lastChecked: Date.now(),
              error: serverData.error,
            });
          }

          // Call user callback
          onServerStoppedRef.current?.(serverData);
          break;
        }

        case "McpConfigChanged": {
          const configData = data as unknown as McpConfigChangedData;

          // Config changes are handled by the caller (typically useStoreSync)
          // No store update here as the config change handler will reload from file

          // Call user callback
          onConfigChangedRef.current?.(configData);
          break;
        }
      }
    },
    [updateStore, setMcpServerStatus, setMcpServerStatusInfo]
  );

  // Connect to WebSocket with "mcp" channel subscription
  const ws = useGatewayWebSocket({
    channels: ["mcp"],
    onEvent: handleEvent,
    enabled,
  });

  return {
    isConnected: ws.isConnected,
    state: ws.state,
  };
}
