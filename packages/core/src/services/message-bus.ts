/**
 * Message bus for channel inbound/outbound routing
 *
 * Routes messages between external channels (Telegram, Discord, etc.)
 * and internal services.
 */
import { EventEmitter } from "node:events";
import type { ChannelType } from "../channels";
import { EventService } from "./events";

/**
 * Inbound message from an external channel
 */
export interface InboundMessage {
  /** Channel type */
  channelType: ChannelType;
  /** Channel name/ID */
  channelName: string;
  /** Chat/conversation ID */
  chatId: string;
  /** Sender name */
  senderName?: string;
  /** Sender ID */
  senderId?: string;
  /** Message content */
  message: string;
  /** Timestamp */
  timestamp: number;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Outbound message to an external channel
 */
export interface OutboundMessage {
  /** Channel type */
  channelType: ChannelType;
  /** Channel name/ID */
  channelName: string;
  /** Chat/conversation ID */
  chatId: string;
  /** Message content */
  message: string;
  /** Parse mode (for formatting) */
  parseMode?: "markdown" | "html";
  /** Reply to message ID */
  replyTo?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Message handler type
 */
export type InboundMessageHandler = (message: InboundMessage) => void | Promise<void>;

/**
 * Message bus for channel message routing
 */
export class MessageBus {
  private emitter: EventEmitter;
  private eventService: EventService;
  private handlers: Map<string, InboundMessageHandler[]> = new Map();

  constructor(eventService: EventService) {
    this.eventService = eventService;
    this.emitter = new EventEmitter();
    this.emitter.setMaxListeners(100);
  }

  /**
   * Register a handler for inbound messages
   *
   * @param channelType - Channel type to handle (or "*" for all)
   * @param handler - Message handler function
   * @returns Unsubscribe function
   */
  onInboundMessage(channelType: ChannelType | "*", handler: InboundMessageHandler): () => void {
    const key = channelType;
    const handlers = this.handlers.get(key) || [];
    handlers.push(handler);
    this.handlers.set(key, handlers);

    return () => {
      const currentHandlers = this.handlers.get(key) || [];
      const index = currentHandlers.indexOf(handler);
      if (index !== -1) {
        currentHandlers.splice(index, 1);
        this.handlers.set(key, currentHandlers);
      }
    };
  }

  /**
   * Publish an inbound message (from external channel)
   */
  async publishInbound(message: InboundMessage): Promise<void> {
    // Broadcast event
    this.eventService.broadcast({
      type: "channel_message_received",
      data: {
        channel_type: message.channelType,
        channel_name: message.channelName,
        chat_id: message.chatId,
        sender_name: message.senderName,
        message: message.message,
        timestamp: message.timestamp,
      },
    });

    // Call specific handlers
    const specificHandlers = this.handlers.get(message.channelType) || [];
    for (const handler of specificHandlers) {
      try {
        await handler(message);
      } catch (e) {
        console.error(`[MessageBus] Handler error for ${message.channelType}:`, e);
      }
    }

    // Call wildcard handlers
    const wildcardHandlers = this.handlers.get("*") || [];
    for (const handler of wildcardHandlers) {
      try {
        await handler(message);
      } catch (e) {
        console.error("[MessageBus] Wildcard handler error:", e);
      }
    }
  }

  /**
   * Publish an outbound message (to external channel)
   *
   * This is typically handled by the channel service, but the message bus
   * can be used to queue or route outbound messages.
   */
  async publishOutbound(message: OutboundMessage): Promise<void> {
    this.emitter.emit("outbound", message);
  }

  /**
   * Register a handler for outbound messages
   */
  onOutboundMessage(handler: (message: OutboundMessage) => void | Promise<void>): () => void {
    this.emitter.on("outbound", handler);
    return () => this.emitter.off("outbound", handler);
  }

  /**
   * Update channel connection status
   */
  updateConnectionStatus(
    channelType: ChannelType,
    channelName: string,
    connected: boolean,
    error?: string
  ): void {
    this.eventService.broadcast({
      type: "channel_connection_status",
      data: {
        channel_type: channelType,
        channel_name: channelName,
        connected,
        error,
      },
    });
  }
}
