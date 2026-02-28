/**
 * Feishu/Lark Long Polling Client
 *
 * Uses Feishu's long polling mechanism to receive messages.
 * Reference: nanobot's feishu.py implementation using lark-oapi SDK.
 *
 * Note: Feishu's official SDK uses WebSocket internally for long connection.
 * Since we're in Node.js, we'll use HTTP long polling to the callback endpoint.
 *
 * This implementation uses a simpler HTTP-based approach:
 * - Feishu sends events to a callback URL (requires public endpoint)
 * - OR use the event subscription API with long polling
 *
 * For now, this is a placeholder that logs a message about setup requirements.
 * Full implementation requires the @larksuiteoapi/node-sdk package.
 */

import type { MessageBus, InboundMessage } from "../../services/message-bus";
import type { Channel, FeishuChannelConfig } from "../types";

/**
 * Feishu poller configuration
 */
export interface FeishuPollerConfig {
  /** Channel configuration */
  channel: Channel;
  /** Feishu-specific config */
  feishuConfig: FeishuChannelConfig;
  /** Message bus for publishing inbound messages */
  messageBus: MessageBus;
}

/**
 * Message type display mapping
 */
const MSG_TYPE_MAP: Record<string, string> = {
  image: "[image]",
  audio: "[audio]",
  file: "[file]",
  sticker: "[sticker]",
};

/**
 * Feishu/Lark Poller
 *
 * Note: Feishu requires either:
 * 1. A public webhook URL for event subscription
 * 2. The official SDK's WebSocket client (requires @larksuiteoapi/node-sdk)
 *
 * This implementation uses approach 2 if the SDK is available.
 */
export class FeishuPoller {
  private channel: Channel;
  private config: FeishuChannelConfig;
  private messageBus: MessageBus;

  private running = false;
  private client: unknown = null;
  private wsClient: unknown = null;
  private processedMessageIds: Set<string> = new Set();

  constructor(config: FeishuPollerConfig) {
    this.channel = config.channel;
    this.config = config.feishuConfig;
    this.messageBus = config.messageBus;
  }

  /**
   * Start the Feishu long connection
   */
  async start(): Promise<void> {
    if (this.running) {
      console.log(`[FeishuPoller] ${this.channel.name} already running`);
      return;
    }

    const appId = this.config.app_id;
    const appSecret = this.config.app_secret;

    if (!appId || !appSecret) {
      console.error(`[FeishuPoller] app_id and app_secret are required for ${this.channel.name}`);
      return;
    }

    console.log(`[FeishuPoller] Starting ${this.channel.name}...`);

    // Try to load Feishu SDK (optional dependency)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let lark: any = null;
    try {
      lark = await import("@larksuiteoapi/node-sdk" as string);
    } catch {
      console.error(`[FeishuPoller] @larksuiteoapi/node-sdk not installed.`);
      console.error(`[FeishuPoller] Run: pnpm add @larksuiteoapi/node-sdk`);
      console.error(`[FeishuPoller] Feishu polling requires the official SDK for WebSocket support.`);
      return;
    }

    this.running = true;

    // Create Lark client for sending messages
    this.client = new lark.Client({
      appId,
      appSecret,
      loggerLevel: lark.LoggerLevel.info,
    });

    // Create WebSocket client for receiving events
    // Note: This requires the app to have "Long Connection" enabled in Feishu Open Platform
    try {
      this.wsClient = new lark.WSClient({
        appId,
        appSecret,
        loggerLevel: lark.LoggerLevel.info,
      });

      // Register message handler
      (this.wsClient as { on: (event: string, handler: (data: unknown) => void) => void }).on(
        "im.message.receive_v1",
        (data: unknown) => {
          this.handleMessage(data).catch((err) => {
            console.error(`[FeishuPoller] Error handling message:`, err);
          });
        }
      );

      // Start WebSocket connection
      await (this.wsClient as { start: () => Promise<void> }).start();

      console.log(`[FeishuPoller] ${this.channel.name} connected via WebSocket`);
      console.log(`[FeishuPoller] No public IP required - using WebSocket to receive events`);

      this.messageBus.updateConnectionStatus("feishu", this.channel.name, true);

      // Keep running
      while (this.running) {
        await this.sleep(1000);
      }
    } catch (error) {
      console.error(`[FeishuPoller] Failed to start WebSocket client:`, error);
      console.error(`[FeishuPoller] Make sure "Long Connection" is enabled in Feishu Open Platform`);
      this.running = false;
    }
  }

  /**
   * Stop the Feishu connection
   */
  async stop(): Promise<void> {
    if (!this.running) {
      return;
    }

    console.log(`[FeishuPoller] Stopping ${this.channel.name}...`);
    this.running = false;

    if (this.wsClient) {
      try {
        await (this.wsClient as { stop: () => Promise<void> }).stop();
      } catch {
        // Ignore errors during shutdown
      }
      this.wsClient = null;
    }

    this.client = null;
    this.messageBus.updateConnectionStatus("feishu", this.channel.name, false);
    console.log(`[FeishuPoller] ${this.channel.name} stopped`);
  }

  /**
   * Check if the poller is running
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Get channel info
   */
  getChannel(): Channel {
    return this.channel;
  }

  /**
   * Handle incoming message from Feishu
   */
  private async handleMessage(data: unknown): Promise<void> {
    const event = (data as { event?: unknown }).event as {
      message?: {
        message_id: string;
        chat_id: string;
        chat_type: string;
        message_type: string;
        content: string;
      };
      sender?: {
        sender_type: string;
        sender_id?: {
          open_id: string;
        };
      };
    } | undefined;

    if (!event?.message || !event?.sender) {
      return;
    }

    const { message, sender } = event;

    // Deduplication
    if (this.processedMessageIds.has(message.message_id)) {
      return;
    }
    this.processedMessageIds.add(message.message_id);

    // Trim cache
    if (this.processedMessageIds.size > 1000) {
      const ids = Array.from(this.processedMessageIds);
      this.processedMessageIds = new Set(ids.slice(-500));
    }

    // Skip bot messages
    if (sender.sender_type === "bot") {
      return;
    }

    const senderId = sender.sender_id?.open_id || "unknown";
    const chatId = message.chat_id;
    const chatType = message.chat_type; // "p2p" or "group"
    const msgType = message.message_type;

    // Check allow_from
    if (!this.isAllowed(senderId)) {
      console.log(`[FeishuPoller] Message from ${senderId} blocked by allow_from`);
      return;
    }

    // Parse message content
    let content: string;
    if (msgType === "text") {
      try {
        const parsed = JSON.parse(message.content);
        content = parsed.text || "";
      } catch {
        content = message.content || "";
      }
    } else {
      content = MSG_TYPE_MAP[msgType] || `[${msgType}]`;
    }

    if (!content) {
      return;
    }

    // Determine reply target
    const replyTo = chatType === "group" ? chatId : senderId;

    const inbound: InboundMessage = {
      channelType: "feishu",
      channelName: this.channel.name,
      chatId: replyTo,
      senderId,
      senderName: senderId,
      message: content,
      timestamp: Date.now(),
      metadata: {
        message_id: message.message_id,
        chat_type: chatType,
        msg_type: msgType,
      },
    };

    const msgPreview = content.length > 50 ? `${content.slice(0, 50)}...` : content;
    console.log(`[FeishuPoller] Message from ${senderId}: ${msgPreview}`);

    await this.messageBus.publishInbound(inbound);
  }

  /**
   * Check if sender is allowed
   */
  private isAllowed(senderId: string): boolean {
    const allowFrom = this.channel.allow_from || [];
    if (allowFrom.length === 0) {
      return true;
    }
    return allowFrom.includes(senderId);
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
