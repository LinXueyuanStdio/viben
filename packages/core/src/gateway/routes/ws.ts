/**
 * WebSocket endpoint
 *
 * Provides real-time bidirectional communication for:
 * - Event streaming (alternative to SSE)
 * - Channel subscriptions
 * - Session message forwarding
 */
import type { FastifyInstance } from "fastify";
import type { AppState } from "../state";

/**
 * WebSocket message types (client to server)
 */
interface ClientMessage {
  type: "ping" | "subscribe" | "unsubscribe" | "send_message";
  channels?: string[];
  sessionId?: string;
  content?: string;
}

/**
 * WebSocket message types (server to client)
 */
interface ServerMessage {
  type: "pong" | "subscribed" | "unsubscribed" | "event" | "error";
  channels?: string[];
  channel?: string;
  eventType?: string;
  data?: unknown;
  code?: string;
  message?: string;
}

/**
 * Map gateway event type to channel name
 */
function eventToChannel(eventType: string): string {
  // Cron events
  if (eventType.startsWith("cron")) {
    return "cron";
  }

  // Channel events
  if (eventType.startsWith("channel")) {
    return "channels";
  }

  // Group chat events
  if (eventType.startsWith("group")) {
    return "group";
  }

  // Task events
  if (eventType.startsWith("task")) {
    return "tasks";
  }

  // Session events
  if (eventType.startsWith("session") || eventType === "execution_log") {
    return "sessions";
  }

  // Agent events
  if (eventType.startsWith("agent")) {
    return "agents";
  }

  // Default to gateway channel
  return "gateway";
}

/**
 * Register WebSocket routes
 */
export function registerWebSocketRoutes(fastify: FastifyInstance, state: AppState): void {
  // We need @fastify/websocket plugin for this
  // Register WebSocket route dynamically if the plugin is available
  fastify.register(async (instance) => {
    try {
      const websocket = await import("@fastify/websocket");
      await instance.register(websocket.default);

      instance.get("/ws", { websocket: true }, (socket) => {
        // Set of subscribed channels
        const subscribedChannels = new Set<string>();

        // Subscribe to all events by default
        const unsubscribe = state.events.subscribe((event) => {
          const channel = eventToChannel(event.type);

          // Only send if client is subscribed to this channel (or no specific subscriptions)
          if (subscribedChannels.size === 0 || subscribedChannels.has(channel)) {
            const serverMsg: ServerMessage = {
              type: "event",
              channel,
              eventType: event.type,
              data: event.data,
            };
            socket.send(JSON.stringify(serverMsg));
          }
        });

        // Handle incoming messages
        socket.on("message", (data: Buffer) => {
          try {
            const msg = JSON.parse(data.toString()) as ClientMessage;

            switch (msg.type) {
              case "ping": {
                const pong: ServerMessage = { type: "pong" };
                socket.send(JSON.stringify(pong));
                break;
              }

              case "subscribe": {
                if (msg.channels) {
                  msg.channels.forEach((ch) => subscribedChannels.add(ch));
                  const response: ServerMessage = {
                    type: "subscribed",
                    channels: Array.from(subscribedChannels),
                  };
                  socket.send(JSON.stringify(response));
                }
                break;
              }

              case "unsubscribe": {
                if (msg.channels) {
                  msg.channels.forEach((ch) => subscribedChannels.delete(ch));
                  const response: ServerMessage = {
                    type: "unsubscribed",
                    channels: Array.from(subscribedChannels),
                  };
                  socket.send(JSON.stringify(response));
                }
                break;
              }

              case "send_message": {
                // Forward message to running agent process via event broadcast.
                // Note: Direct stdin forwarding would require maintaining a registry
                // of running agent processes and their stdin pipes. The current
                // implementation broadcasts the message to WebSocket subscribers,
                // which allows UI clients to receive messages. For actual agent
                // interaction, use the /api/sessions/:sessionId/messages endpoint.
                if (msg.sessionId && msg.content) {
                  state.events.sessionMessage(msg.sessionId, msg.content, "user");
                }
                break;
              }
            }
          } catch {
            const errorMsg: ServerMessage = {
              type: "error",
              code: "INVALID_MESSAGE",
              message: "Failed to parse message",
            };
            socket.send(JSON.stringify(errorMsg));
          }
        });

        // Handle close
        socket.on("close", () => {
          unsubscribe();
        });

        // Handle error
        socket.on("error", (err) => {
          console.error("[WebSocket] Error:", err);
          unsubscribe();
        });
      });
    } catch {
      // WebSocket plugin not available, skip WebSocket route registration
      console.warn("[Gateway] @fastify/websocket not available, WebSocket routes disabled");
    }
  });
}
