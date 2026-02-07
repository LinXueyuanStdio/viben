/**
 * Feishu (Lark) Channel Implementation
 *
 * Uses @larksuiteoapi/node-sdk for Feishu/Lark Bot API integration.
 * Note: WebSocket mode requires proper setup. This implementation
 * provides the base structure for HTTP webhook mode.
 */

import * as lark from "@larksuiteoapi/node-sdk";
import {
  BaseChannel,
  type ChannelConfig,
  type ChannelStatus,
  type InboundMessage,
  type OutboundMessage,
} from "./base.js";

// ============================================================================
// Types
// ============================================================================

/**
 * Feishu-specific channel configuration
 */
export interface FeishuConfig extends ChannelConfig {
  type: "feishu";
  /** Feishu App ID */
  appId: string;
  /** Feishu App Secret */
  appSecret: string;
  /** Encryption key for event verification */
  encryptKey?: string;
  /** Verification token for event verification */
  verificationToken?: string;
}

/**
 * Feishu message event data structure (simplified)
 */
export interface FeishuMessageEvent {
  message: {
    message_id: string;
    root_id?: string;
    parent_id?: string;
    create_time: string;
    chat_id: string;
    chat_type: string;
    message_type: string;
    content: string;
    mentions?: Array<{
      key: string;
      id: {
        union_id?: string;
        user_id?: string;
        open_id?: string;
      };
      name: string;
    }>;
  };
  sender: {
    sender_id: {
      union_id?: string;
      user_id?: string;
      open_id?: string;
    };
    sender_type: string;
    tenant_key: string;
  };
}

// ============================================================================
// Feishu Channel Implementation
// ============================================================================

export class FeishuChannel extends BaseChannel {
  readonly id: string;
  readonly type = "feishu" as const;
  readonly config: FeishuConfig;

  private client: lark.Client | null = null;
  private eventDispatcher: lark.EventDispatcher | null = null;

  constructor(id: string, config: FeishuConfig) {
    super();
    this.id = id;
    this.config = config;
  }

  async connect(): Promise<void> {
    try {
      // Create Lark client for API calls
      this.client = new lark.Client({
        appId: this.config.appId,
        appSecret: this.config.appSecret,
      });

      // Create event dispatcher for handling incoming events
      this.eventDispatcher = new lark.EventDispatcher({
        encryptKey: this.config.encryptKey,
        verificationToken: this.config.verificationToken,
      });

      // Register message handler
      this.eventDispatcher.register({
        "im.message.receive_v1": (data) => {
          // Cast to our type and handle
          this.handleMessage(data as unknown as FeishuMessageEvent);
          return {};
        },
      });

      this.connected = true;
      console.log(`[Feishu ${this.id}] Client initialized (app:${this.config.appId})`);
      console.log(`[Feishu ${this.id}] Note: Use getEventHandler() for webhook integration`);
    } catch (error) {
      this.handleError(error, "Connection failed");
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    this.eventDispatcher = null;
    this.client = null;
    this.connected = false;
    console.log(`[Feishu ${this.id}] Disconnected`);
  }

  async sendMessage(msg: OutboundMessage): Promise<void> {
    if (!this.client) {
      throw new Error("Client not connected");
    }

    try {
      // Determine receive_id_type based on chat ID format
      const receiveIdType = this.getReceiveIdType(msg.chatId);

      await this.client.im.message.create({
        data: {
          receive_id: msg.chatId,
          msg_type: "text",
          content: JSON.stringify({ text: msg.content }),
        },
        params: {
          receive_id_type: receiveIdType,
        },
      });
    } catch (error) {
      this.handleError(error, "Send message failed");
      throw error;
    }
  }

  /**
   * Reply to a specific message
   */
  async replyMessage(
    messageId: string,
    content: string,
    contentType: "text" | "post" | "image" = "text"
  ): Promise<void> {
    if (!this.client) {
      throw new Error("Client not connected");
    }

    try {
      const msgContent =
        contentType === "text"
          ? JSON.stringify({ text: content })
          : content;

      await this.client.im.message.reply({
        path: {
          message_id: messageId,
        },
        data: {
          msg_type: contentType,
          content: msgContent,
        },
      });
    } catch (error) {
      this.handleError(error, "Reply message failed");
      throw error;
    }
  }

  getStatus(): ChannelStatus {
    return {
      connected: this.connected,
      identifier: `app:${this.config.appId}`,
      lastError: this.lastError,
      lastMessageAt: this.lastMessageAt,
    };
  }

  /**
   * Get the event dispatcher for webhook integration
   * Use this with an HTTP server to receive Feishu events
   *
   * @example
   * ```typescript
   * import express from 'express';
   * const app = express();
   * const handler = feishuChannel.getEventHandler();
   * app.post('/feishu/webhook', handler);
   * ```
   */
  getEventHandler(): lark.EventDispatcher | null {
    return this.eventDispatcher;
  }

  /**
   * Manually process an incoming event
   * Use this if you're handling the HTTP server yourself
   */
  processEvent(event: FeishuMessageEvent): void {
    this.handleMessage(event);
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private handleMessage(data: FeishuMessageEvent): void {
    const message = data.message;
    const sender = data.sender;

    // Check allowlist using open_id
    const openId = sender.sender_id?.open_id;
    if (!this.isAllowed(openId)) {
      console.log(
        `[Feishu ${this.id}] Ignored message from non-whitelisted user: ${openId}`
      );
      return;
    }

    // Parse message content based on type
    let content = "";
    if (message.message_type === "text") {
      try {
        const parsed = JSON.parse(message.content);
        content = parsed.text || "";
      } catch {
        content = message.content;
      }
    } else {
      // For non-text messages, keep raw content
      content = message.content;
    }

    // Build inbound message
    const inbound: InboundMessage = {
      channel: this.id,
      channelType: "feishu",
      senderId: openId || "",
      senderName: undefined, // Feishu doesn't provide sender name in message event
      chatId: message.chat_id,
      content,
      messageId: message.message_id,
      replyTo: message.parent_id,
      timestamp: parseInt(message.create_time, 10),
      raw: data,
    };

    this.emitMessage(inbound);
  }

  private getReceiveIdType(chatId: string): "chat_id" | "open_id" | "union_id" | "user_id" {
    // Feishu chat_id starts with "oc_"
    if (chatId.startsWith("oc_")) return "chat_id";
    // Feishu open_id starts with "ou_"
    if (chatId.startsWith("ou_")) return "open_id";
    // Feishu union_id starts with "on_"
    if (chatId.startsWith("on_")) return "union_id";
    // Default to chat_id
    return "chat_id";
  }

  /**
   * Get user info by open_id
   */
  async getUserInfo(openId: string): Promise<{
    name?: string;
    email?: string;
    mobile?: string;
    avatar_url?: string;
  } | null> {
    if (!this.client) {
      throw new Error("Client not connected");
    }

    try {
      const response = await this.client.contact.user.get({
        path: {
          user_id: openId,
        },
        params: {
          user_id_type: "open_id",
        },
      });

      if (response.data?.user) {
        return {
          name: response.data.user.name,
          email: response.data.user.email,
          mobile: response.data.user.mobile,
          avatar_url: response.data.user.avatar?.avatar_240,
        };
      }
      return null;
    } catch {
      return null;
    }
  }
}
