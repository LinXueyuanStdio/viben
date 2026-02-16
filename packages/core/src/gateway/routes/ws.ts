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
import { trace, SpanKind, SpanStatusCode, type Span } from "@opentelemetry/api";

// WebSocket tracer
const tracer = trace.getTracer("viben-gateway-ws", "1.0.0");

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
              case "ping": {
                const pong: ServerMessage = { type: "pong" };
                socket.send(JSON.stringify(pong));
                messagesSent++;
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
                  messagesSent++;
                  messageSpan.setAttribute("ws.channels.subscribed", msg.channels.join(","));
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
                  messagesSent++;
                  messageSpan.setAttribute("ws.channels.unsubscribed", msg.channels.join(","));
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
                  messageSpan.setAttribute("ws.session.id", msg.sessionId);
                }
                break;
              }
            }

            messageSpan.setStatus({ code: SpanStatusCode.OK });
          } catch {
            const errorMsg: ServerMessage = {
              type: "error",
              code: "INVALID_MESSAGE",
              message: "Failed to parse message",
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
        });
      });
    } catch {
      // WebSocket plugin not available, skip WebSocket route registration
      console.warn("[Gateway] @fastify/websocket not available, WebSocket routes disabled");
    }
  });
}
