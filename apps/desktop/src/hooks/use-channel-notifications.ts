/**
 * Channel Notifications Hook
 *
 * Maintains a WebSocket connection to the gateway and listens for
 * channel notifications (messages from Telegram, Discord, etc.).
 * Shows system notifications when messages arrive.
 */

import { useEffect, useRef, useCallback, useState } from "react";
import { getGatewayUrl } from "@/lib/gateway";
import { useSystemNotification } from "./use-system-notification";
import { useNotificationStore } from "@/stores/notification-store";

/** Channel message event from gateway */
interface ChannelMessageEvent {
  channel_type: string;
  channel_name: string;
  chat_id: string;
  sender_name?: string;
  message: string;
  timestamp: number;
}

/** Channel connection status event */
interface ChannelConnectionEvent {
  channel_type: string;
  channel_name: string;
  connected: boolean;
  error?: string;
}

/** WebSocket message from server */
interface WsServerMessage {
  type: "Event" | "Pong" | "Subscribed" | "Error";
  data?: {
    channel?: string;
    payload?: {
      type?: string;
      data?: ChannelMessageEvent | ChannelConnectionEvent;
    };
  };
}

/** Connection state */
type ConnectionState = "disconnected" | "connecting" | "connected" | "error";

/** Hook return type */
export interface UseChannelNotificationsReturn {
  /** Current connection state */
  connectionState: ConnectionState;
  /** Last error message */
  error: string | null;
  /** Manually reconnect */
  reconnect: () => void;
  /** Disconnect */
  disconnect: () => void;
}

/**
 * Get WebSocket URL from Gateway URL
 */
function getWebSocketUrl(): string {
  const gatewayUrl = getGatewayUrl();
  return gatewayUrl.replace(/^http/, "ws") + "/ws";
}

/**
 * Get channel display name
 */
function getChannelDisplayName(channelType: string): string {
  const names: Record<string, string> = {
    telegram: "Telegram",
    discord: "Discord",
    feishu: "Feishu",
    whatsapp: "WhatsApp",
    slack: "Slack",
    webhook: "Webhook",
  };
  return names[channelType] || channelType;
}

/**
 * Hook to listen for channel notifications via WebSocket
 *
 * Usage:
 * ```tsx
 * const { connectionState, reconnect } = useChannelNotifications();
 * ```
 */
export function useChannelNotifications(): UseChannelNotificationsReturn {
  const [connectionState, setConnectionState] = useState<ConnectionState>("disconnected");
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 10;
  const baseReconnectDelay = 1000; // 1 second

  const { notify, notifyIfBackground, isGranted } = useSystemNotification();
  const { preferences } = useNotificationStore();
  const notificationsEnabled = preferences.enabled;

  /**
   * Handle incoming channel message
   */
  const handleChannelMessage = useCallback(
    async (event: ChannelMessageEvent) => {
      if (!notificationsEnabled || !isGranted) {
        return;
      }

      const channelName = getChannelDisplayName(event.channel_type);
      const title = event.sender_name
        ? `${channelName}: ${event.sender_name}`
        : `${channelName} Message`;

      // Truncate long messages
      const body = event.message.length > 200
        ? event.message.substring(0, 197) + "..."
        : event.message;

      // Only show notification if app is in background
      await notifyIfBackground({
        title,
        body,
      });
    },
    [notificationsEnabled, isGranted, notifyIfBackground]
  );

  /**
   * Handle channel connection status change
   */
  const handleConnectionStatus = useCallback(
    async (event: ChannelConnectionEvent) => {
      if (!notificationsEnabled || !isGranted) {
        return;
      }

      // Only notify on errors
      if (!event.connected && event.error) {
        const channelName = getChannelDisplayName(event.channel_type);
        await notify({
          title: `${channelName} Disconnected`,
          body: event.error,
        });
      }
    },
    [notificationsEnabled, isGranted, notify]
  );

  /**
   * Process WebSocket message
   */
  const processMessage = useCallback(
    (data: string) => {
      try {
        const msg: WsServerMessage = JSON.parse(data);

        if (msg.type === "Event" && msg.data?.payload) {
          const eventType = msg.data.payload.type;
          const eventData = msg.data.payload.data;

          if (eventType === "ChannelMessageReceived" && eventData) {
            handleChannelMessage(eventData as ChannelMessageEvent);
          } else if (eventType === "ChannelConnectionStatus" && eventData) {
            handleConnectionStatus(eventData as ChannelConnectionEvent);
          }
        }
      } catch (e) {
        console.error("[ChannelNotifications] Failed to parse message:", e);
      }
    },
    [handleChannelMessage, handleConnectionStatus]
  );

  /**
   * Connect to WebSocket
   */
  const connect = useCallback(() => {
    // Don't connect if already connected or connecting
    if (wsRef.current?.readyState === WebSocket.OPEN ||
        wsRef.current?.readyState === WebSocket.CONNECTING) {
      return;
    }

    setConnectionState("connecting");
    setError(null);

    try {
      const wsUrl = getWebSocketUrl();
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log("[ChannelNotifications] Connected to gateway");
        setConnectionState("connected");
        setError(null);
        reconnectAttemptsRef.current = 0;

        // Subscribe to channel events
        ws.send(JSON.stringify({
          type: "Subscribe",
          data: { channels: ["channels"] },
        }));
      };

      ws.onmessage = (event) => {
        processMessage(event.data);
      };

      ws.onerror = (event) => {
        console.error("[ChannelNotifications] WebSocket error:", event);
        setError("Connection error");
      };

      ws.onclose = (event) => {
        console.log("[ChannelNotifications] Disconnected:", event.code, event.reason);
        setConnectionState("disconnected");
        wsRef.current = null;

        // Auto-reconnect with exponential backoff
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          const delay = baseReconnectDelay * Math.pow(2, reconnectAttemptsRef.current);
          reconnectAttemptsRef.current++;
          console.log(`[ChannelNotifications] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current})`);

          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        } else {
          setConnectionState("error");
          setError("Max reconnection attempts reached");
        }
      };

      wsRef.current = ws;
    } catch (e) {
      console.error("[ChannelNotifications] Failed to connect:", e);
      setConnectionState("error");
      setError(e instanceof Error ? e.message : "Failed to connect");
    }
  }, [processMessage]);

  /**
   * Disconnect from WebSocket
   */
  const disconnect = useCallback(() => {
    // Clear reconnect timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // Reset reconnect attempts
    reconnectAttemptsRef.current = maxReconnectAttempts; // Prevent auto-reconnect

    // Close WebSocket
    if (wsRef.current) {
      wsRef.current.close(1000, "User disconnected");
      wsRef.current = null;
    }

    setConnectionState("disconnected");
  }, []);

  /**
   * Manually reconnect
   */
  const reconnect = useCallback(() => {
    disconnect();
    reconnectAttemptsRef.current = 0;
    connect();
  }, [connect, disconnect]);

  // Connect on mount if notifications are enabled
  useEffect(() => {
    if (notificationsEnabled) {
      connect();
    }

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close(1000, "Component unmounted");
      }
    };
  }, [notificationsEnabled, connect]);

  // Send periodic ping to keep connection alive
  useEffect(() => {
    if (connectionState !== "connected") {
      return;
    }

    const pingInterval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "Ping" }));
      }
    }, 30000); // Ping every 30 seconds

    return () => {
      clearInterval(pingInterval);
    };
  }, [connectionState]);

  return {
    connectionState,
    error,
    reconnect,
    disconnect,
  };
}
