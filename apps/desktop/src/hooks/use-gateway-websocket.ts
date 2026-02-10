/**
 * Gateway WebSocket Hook
 *
 * Specialized hook for subscribing to gateway event channels.
 * Built on top of the generic WebSocket manager with heartbeat and auto-reconnect.
 */

import { useCallback, useEffect, useRef } from "react";
import { useWebSocket, type UseWebSocketOptions } from "./use-websocket";
import { getGatewayUrl } from "@/lib/gateway";

/** Gateway event payload structure */
export interface GatewayEventPayload {
  type: string;
  data?: Record<string, unknown>;
}

/** WebSocket message from gateway */
export interface GatewayWsMessage {
  type: "Event" | "Pong" | "Subscribed" | "Error";
  data?: {
    channel?: string;
    payload?: GatewayEventPayload;
    message?: string;
    channels?: string[];
  };
}

export interface UseGatewayWebSocketOptions extends Omit<UseWebSocketOptions, "onMessage" | "onOpen"> {
  /** Channels to subscribe to (e.g., ["cron", "channels"]) */
  channels: string[];
  /** Called when a gateway event is received */
  onEvent?: (channel: string, payload: GatewayEventPayload) => void;
  /** Called when subscription is confirmed */
  onSubscribed?: (channels: string[]) => void;
  /** Called on gateway error message */
  onGatewayError?: (message: string) => void;
  /** Whether to enable the connection (default: true) */
  enabled?: boolean;
  /** Called when connection opens (after subscribing) */
  onOpen?: () => void;
}

/**
 * Get WebSocket URL from Gateway URL
 */
function getWebSocketUrl(): string {
  const gatewayUrl = getGatewayUrl();
  return gatewayUrl.replace(/^http/, "ws") + "/ws";
}

/**
 * Hook for subscribing to gateway WebSocket events with heartbeat and auto-reconnect.
 *
 * @example
 * ```tsx
 * const { state, isConnected } = useGatewayWebSocket({
 *   channels: ["cron", "channels"],
 *   onEvent: (channel, payload) => {
 *     if (channel === "cron" && payload.type === "CronJobCompleted") {
 *       // Handle cron job completed event
 *     }
 *   },
 * });
 * ```
 */
export function useGatewayWebSocket(options: UseGatewayWebSocketOptions) {
  const {
    channels,
    onEvent,
    onSubscribed,
    onGatewayError,
    onOpen,
    enabled = true,
    ...wsOptions
  } = options;

  // Store callbacks in refs to avoid recreating handlers
  const onEventRef = useRef(onEvent);
  const onSubscribedRef = useRef(onSubscribed);
  const onGatewayErrorRef = useRef(onGatewayError);
  const onOpenRef = useRef(onOpen);
  const channelsRef = useRef(channels);

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    onSubscribedRef.current = onSubscribed;
  }, [onSubscribed]);

  useEffect(() => {
    onGatewayErrorRef.current = onGatewayError;
  }, [onGatewayError]);

  useEffect(() => {
    onOpenRef.current = onOpen;
  }, [onOpen]);

  useEffect(() => {
    channelsRef.current = channels;
  }, [channels]);

  // Handle incoming messages
  const handleMessage = useCallback((data: unknown) => {
    try {
      const msg = data as GatewayWsMessage;

      switch (msg.type) {
        case "Event":
          if (msg.data?.channel && msg.data?.payload) {
            onEventRef.current?.(msg.data.channel, msg.data.payload);
          }
          break;

        case "Subscribed":
          if (msg.data?.channels) {
            onSubscribedRef.current?.(msg.data.channels);
          }
          break;

        case "Error":
          if (msg.data?.message) {
            console.error("[GatewayWebSocket] Error:", msg.data.message);
            onGatewayErrorRef.current?.(msg.data.message);
          }
          break;

        case "Pong":
          // Pong is handled by the WebSocket manager
          break;
      }
    } catch (err) {
      console.error("[GatewayWebSocket] Failed to process message:", err);
    }
  }, []);

  // Handle connection open - subscribe to channels and call user callback
  const handleOpen = useCallback(() => {
    console.log("[GatewayWebSocket] Connected, subscribing to channels:", channelsRef.current);
    // Call user's onOpen callback
    onOpenRef.current?.();
  }, []);

  const wsUrl = enabled ? getWebSocketUrl() : null;

  const ws = useWebSocket(wsUrl, {
    ...wsOptions,
    onMessage: handleMessage,
    onOpen: handleOpen,
    // Use JSON ping for gateway (server expects { type: "Ping" })
    heartbeatInterval: wsOptions.heartbeatInterval ?? 30000,
    heartbeatTimeout: wsOptions.heartbeatTimeout ?? 10000,
    reconnectDelay: wsOptions.reconnectDelay ?? 1000,
    maxReconnectDelay: wsOptions.maxReconnectDelay ?? 30000,
    maxReconnectAttempts: wsOptions.maxReconnectAttempts ?? Infinity,
  });

  // Subscribe to channels when connected
  useEffect(() => {
    if (ws.isConnected && channels.length > 0) {
      ws.sendJSON({
        type: "Subscribe",
        data: { channels },
      });
    }
  }, [ws.isConnected, channels, ws.sendJSON]);

  return ws;
}
