/**
 * Channel Notifications Hook
 *
 * Maintains a WebSocket connection to the gateway and listens for
 * channel notifications (messages from Telegram, Discord, etc.).
 * Shows system notifications when messages arrive.
 *
 * Uses the gateway WebSocket with heartbeat and auto-reconnect for stability.
 */

import { useCallback } from "react";
import { useGatewayWebSocket, type GatewayEventPayload } from "./use-gateway-websocket";
import { useSystemNotification } from "./use-system-notification";
import { useNotificationStore } from "@/stores/notification-store";
import type { WebSocketState } from "./use-websocket";

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

/** Hook return type */
export interface UseChannelNotificationsReturn {
  /** Current connection state */
  connectionState: WebSocketState;
  /** Whether connected */
  isConnected: boolean;
  /** Manually reconnect */
  reconnect: () => void;
  /** Disconnect */
  disconnect: () => void;
}

/**
 * Get channel display name
 * Note: These are brand names that typically don't need translation
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
 * Uses heartbeat and auto-reconnect for stable connections.
 *
 * Usage:
 * ```tsx
 * const { connectionState, reconnect } = useChannelNotifications();
 * ```
 */
export function useChannelNotifications(): UseChannelNotificationsReturn {
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
   * Handle gateway events
   */
  const handleEvent = useCallback(
    (channel: string, payload: GatewayEventPayload) => {
      if (channel !== "channels") return;

      const eventType = payload.type;
      const eventData = payload.data;

      if (eventType === "ChannelMessageReceived" && eventData) {
        handleChannelMessage(eventData as unknown as ChannelMessageEvent);
      } else if (eventType === "ChannelConnectionStatus" && eventData) {
        handleConnectionStatus(eventData as unknown as ChannelConnectionEvent);
      }
    },
    [handleChannelMessage, handleConnectionStatus]
  );

  // Use gateway WebSocket with heartbeat and auto-reconnect
  const { state, isConnected, connect, disconnect } = useGatewayWebSocket({
    channels: ["channels"],
    onEvent: handleEvent,
    enabled: notificationsEnabled,
    // Heartbeat every 30 seconds
    heartbeatInterval: 30000,
    // Timeout after 10 seconds of no response
    heartbeatTimeout: 10000,
    // Start reconnect at 1 second
    reconnectDelay: 1000,
    // Max reconnect delay of 30 seconds
    maxReconnectDelay: 30000,
    // Max 10 reconnect attempts before giving up
    maxReconnectAttempts: 10,
  });

  return {
    connectionState: state,
    isConnected,
    reconnect: connect,
    disconnect,
  };
}
