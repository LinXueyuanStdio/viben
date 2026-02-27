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
import type { GatewayEvent } from "../../services/events";
import { trace, SpanKind, SpanStatusCode } from "@opentelemetry/api";
import { recordWsConnection, recordWsDisconnect, recordWsMessage } from "../../telemetry";

// WebSocket tracer
const tracer = trace.getTracer("viben-gateway-ws", "1.0.0");

// Track active WebSocket connections for metrics
let activeWsConnectionCount = 0;

/**
 * Get the current number of active WebSocket connections
 * Used for metrics/telemetry Observable Gauge
 */
export function getActiveWsConnectionCount(): number {
  return activeWsConnectionCount;
}

/**
 * WebSocket message types (client to server)
 * Uses PascalCase for type field to match Rust gateway
 */
interface ClientMessage {
  type: "Ping" | "Subscribe" | "Unsubscribe" | "SendMessage";
  data?: {
    channels?: string[];
    session_id?: string;
    content?: string;
  };
}

/**
 * WebSocket message types (server to client)
 * Must match the format expected by desktop/web clients (same as Rust gateway)
 */
interface ServerMessage {
  type: "Pong" | "Subscribed" | "Unsubscribed" | "Event" | "Error";
  data?: {
    channels?: string[];
    channel?: string;
    payload?: {
      type: string;
      data: unknown;
    };
    message?: string;
  };
}

/**
 * Convert snake_case event type to PascalCase
 * e.g., "cron_job_completed" -> "CronJobCompleted"
 */
function snakeToPascal(str: string): string {
  return str
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join("");
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
 * Transform gateway event to WebSocket message format
 * Keeps camelCase field names as-is (packages/core standard)
 */
function transformEvent(event: GatewayEvent): ServerMessage {
  const channel = eventToChannel(event.type);
  const eventType = snakeToPascal(event.type);

  return {
    type: "Event",
    data: {
      channel,
      payload: {
        type: eventType,
        data: event.data,
      },
    },
  };
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
      console.log("[Gateway] WebSocket routes registered at /ws");

      instance.get("/ws", { websocket: true }, (socket) => {
        // Create a session span that covers the entire WebSocket connection lifetime
        const sessionSpan = tracer.startSpan("ws.session", {
          kind: SpanKind.SERVER,
          attributes: {
            "ws.url": "/ws",
            "ws.protocol": "websocket",
          },
        });

        // Track message counts for metrics
        let messagesSent = 0;
        let messagesReceived = 0;

        // Record WebSocket connection and increment counter
        recordWsConnection();
        activeWsConnectionCount++;

        // Set of subscribed channels
        const subscribedChannels = new Set<string>();

        // Subscribe to all events by default
        const unsubscribe = state.events.subscribe((event) => {
          const channel = eventToChannel(event.type);

          // Only send if client is subscribed to this channel (or no specific subscriptions)
          if (subscribedChannels.size === 0 || subscribedChannels.has(channel)) {
            const serverMsg = transformEvent(event);
            socket.send(JSON.stringify(serverMsg));
            messagesSent++;
          }
        });

        // Handle incoming messages
        socket.on("message", (data: Buffer) => {
          messagesReceived++;

          // Create a span for each message received
          const messageSpan = tracer.startSpan("ws.message.receive", {
            kind: SpanKind.SERVER,
            attributes: {
              "ws.message.size": data.length,
            },
          });

          try {
            const msg = JSON.parse(data.toString()) as ClientMessage;
            messageSpan.setAttribute("ws.message.type", msg.type);

            switch (msg.type) {
              case "Ping": {
                const pong: ServerMessage = { type: "Pong" };
                socket.send(JSON.stringify(pong));
                messagesSent++;
                break;
              }

              case "Subscribe": {
                const channels = msg.data?.channels;
                if (channels) {
                  channels.forEach((ch) => subscribedChannels.add(ch));
                  const response: ServerMessage = {
                    type: "Subscribed",
                    data: { channels: Array.from(subscribedChannels) },
                  };
                  socket.send(JSON.stringify(response));
                  messagesSent++;
                  messageSpan.setAttribute("ws.channels.subscribed", channels.join(","));
                }
                break;
              }

              case "Unsubscribe": {
                const channels = msg.data?.channels;
                if (channels) {
                  channels.forEach((ch) => subscribedChannels.delete(ch));
                  const response: ServerMessage = {
                    type: "Unsubscribed",
                    data: { channels: Array.from(subscribedChannels) },
                  };
                  socket.send(JSON.stringify(response));
                  messagesSent++;
                  messageSpan.setAttribute("ws.channels.unsubscribed", channels.join(","));
                }
                break;
              }

              case "SendMessage": {
                // Forward message to running agent process via event broadcast.
                // Note: Direct stdin forwarding would require maintaining a registry
                // of running agent processes and their stdin pipes. The current
                // implementation broadcasts the message to WebSocket subscribers,
                // which allows UI clients to receive messages. For actual agent
                // interaction, use the /api/sessions/:session_id/messages endpoint.
                const session_id = msg.data?.session_id;
                const content = msg.data?.content;
                if (session_id && content) {
                  state.events.sessionMessage(session_id, content, "user");
                  messageSpan.setAttribute("ws.session.id", session_id);
                }
                break;
              }
            }

            messageSpan.setStatus({ code: SpanStatusCode.OK });
          } catch {
            const errorMsg: ServerMessage = {
              type: "Error",
              data: { message: "Failed to parse message" },
            };
            socket.send(JSON.stringify(errorMsg));
            messagesSent++;
            messageSpan.setStatus({ code: SpanStatusCode.ERROR, message: "Failed to parse message" });
          } finally {
            messageSpan.end();
          }
        });

        // Handle close
        socket.on("close", () => {
          unsubscribe();
          sessionSpan.setAttribute("ws.messages.sent", messagesSent);
          sessionSpan.setAttribute("ws.messages.received", messagesReceived);
          sessionSpan.setStatus({ code: SpanStatusCode.OK });
          sessionSpan.end();

          // Record WebSocket disconnect metrics and decrement counter
          recordWsDisconnect("normal");
          activeWsConnectionCount = Math.max(0, activeWsConnectionCount - 1);
        });

        // Handle error
        socket.on("error", (err) => {
          console.error("[WebSocket] Error:", err);
          unsubscribe();
          sessionSpan.setAttribute("ws.messages.sent", messagesSent);
          sessionSpan.setAttribute("ws.messages.received", messagesReceived);
          sessionSpan.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
          sessionSpan.recordException(err);
          sessionSpan.end();

          // Record WebSocket disconnect metrics with error and decrement counter
          recordWsDisconnect("error");
          activeWsConnectionCount = Math.max(0, activeWsConnectionCount - 1);
        });
      });
    } catch (error) {
      // WebSocket plugin not available, skip WebSocket route registration
      console.warn("[Gateway] @fastify/websocket not available, WebSocket routes disabled");
      console.warn("[Gateway] WebSocket registration error:", error instanceof Error ? error.message : error);
    }
  });
}
