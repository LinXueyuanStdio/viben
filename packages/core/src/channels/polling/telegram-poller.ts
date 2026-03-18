/**
 * Telegram Long Polling Client
 *
 * Continuously polls Telegram's getUpdates API to receive messages.
 * Publishes received messages to the MessageBus for routing.
 */

import type { MessageBus, InboundMessage } from "../../services/message-bus";
import type { TelegramChannelConfig, Channel } from "../types";
import {
  getTelegramUpdates,
  deleteTelegramWebhook,
  type TelegramUpdate,
  type TelegramMessage,
} from "../telegram";
import { logger as globalLogger } from "../../telemetry";

// Module-level logger
const log = globalLogger.child({ module: "telegram-poller" });

/**
 * Telegram poller configuration
 */
export interface TelegramPollerConfig {
  /** Channel configuration */
  channel: Channel;
  /** Telegram-specific config */
  telegramConfig: TelegramChannelConfig;
  /** Message bus for publishing inbound messages */
  messageBus: MessageBus;
  /** Long polling timeout in seconds (default: 30) */
  pollingTimeout?: number;
  /** Whether to drop pending updates on start (default: true) */
  dropPendingOnStart?: boolean;
  /** Error retry delay in milliseconds (default: 5000) */
  errorRetryDelayMs?: number;
}

/**
 * Telegram Long Polling Client
 *
 * Simple and reliable - no webhook/public IP needed.
 */
export class TelegramPoller {
  private channel: Channel;
  private config: TelegramChannelConfig;
  private messageBus: MessageBus;
  private pollingTimeout: number;
  private dropPendingOnStart: boolean;
  private errorRetryDelayMs: number;

  private running = false;
  private offset?: number;
  private pollPromise?: Promise<void>;
  private botUsername?: string;

  constructor(config: TelegramPollerConfig) {
    this.channel = config.channel;
    this.config = config.telegramConfig;
    this.messageBus = config.messageBus;
    this.pollingTimeout = config.pollingTimeout ?? 30;
    this.dropPendingOnStart = config.dropPendingOnStart ?? true;
    this.errorRetryDelayMs = config.errorRetryDelayMs ?? 5000;
  }

  /**
   * Start the long polling loop
   */
  async start(): Promise<void> {
    if (this.running) {
      log.debug({ channelName: this.channel.name }, "Already running");
      return;
    }

    log.info({ channelName: this.channel.name }, "Starting...");

    // Delete webhook to enable getUpdates mode
    if (this.dropPendingOnStart) {
      const result = await deleteTelegramWebhook(this.config, true);
      if (!result.success) {
        log.error({ error: result.error }, "Failed to delete webhook");
        // Continue anyway - webhook might not be set
      } else {
        log.debug({ details: result.details }, "Webhook deleted");
      }
    }

    // Get bot info
    const { testTelegramChannel } = await import("../telegram");
    const testResult = await testTelegramChannel(this.config);
    if (testResult.success && testResult.details) {
      // Extract username from "Bot: @username (first_name)"
      const match = testResult.details.match(/@(\w+)/);
      if (match) {
        this.botUsername = match[1];
      }
      log.info({ details: testResult.details }, "Bot connected");
    }

    this.running = true;
    this.pollPromise = this.pollLoop();

    // Notify connection status
    this.messageBus.updateConnectionStatus(
      "telegram",
      this.channel.name,
      true
    );
  }

  /**
   * Stop the long polling loop
   */
  async stop(): Promise<void> {
    if (!this.running) {
      return;
    }

    log.info({ channelName: this.channel.name }, "Stopping...");
    this.running = false;

    // Wait for current poll to complete (with timeout)
    if (this.pollPromise) {
      const timeout = new Promise<void>((resolve) =>
        setTimeout(resolve, this.pollingTimeout * 1000 + 2000)
      );
      await Promise.race([this.pollPromise, timeout]);
      this.pollPromise = undefined;
    }

    // Notify disconnection
    this.messageBus.updateConnectionStatus(
      "telegram",
      this.channel.name,
      false
    );

    log.info({ channelName: this.channel.name }, "Stopped");
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
   * Main polling loop
   */
  private async pollLoop(): Promise<void> {
    log.info({ channelName: this.channel.name }, "Polling started");

    while (this.running) {
      try {
        const result = await getTelegramUpdates(this.config, {
          offset: this.offset,
          timeout: this.pollingTimeout,
          allowedUpdates: ["message"],
        });

        if (!result.success) {
          log.error({ error: result.error }, "getUpdates error");
          // Wait before retrying
          await this.sleep(this.errorRetryDelayMs);
          continue;
        }

        const updates = result.updates || [];

        if (updates.length > 0) {
          log.debug({ count: updates.length }, "Received updates");

          for (const update of updates) {
            await this.handleUpdate(update);
            // Update offset to acknowledge this update
            this.offset = update.update_id + 1;
          }
        }
      } catch (error) {
        log.error({ err: error }, "Poll error");
        // Wait before retrying
        await this.sleep(this.errorRetryDelayMs);
      }
    }

    log.info({ channelName: this.channel.name }, "Polling loop ended");
  }

  /**
   * Handle a single update from Telegram
   */
  private async handleUpdate(update: TelegramUpdate): Promise<void> {
    const message = update.message || update.edited_message;
    if (!message) {
      // Skip non-message updates (channel_post, etc.)
      return;
    }

    // Skip messages from self (if we know our username)
    if (message.from?.is_bot && this.botUsername && message.from.username === this.botUsername) {
      return;
    }

    // Check allow_from list
    if (!this.isAllowed(message)) {
      const senderInfo = this.getSenderInfo(message);
      log.debug({ senderInfo }, "Message blocked by allow_from list");
      return;
    }

    // Build content from text and/or caption
    const content = message.text || message.caption || "[media message]";

    // Build sender ID (numeric ID + username for compatibility)
    const senderId = this.buildSenderId(message);
    const senderName = this.buildSenderName(message);

    const inbound: InboundMessage = {
      channelType: "telegram",
      channelName: this.channel.name,
      chatId: message.chat.id.toString(),
      senderId,
      senderName,
      message: content,
      timestamp: message.date * 1000, // Convert to milliseconds
      metadata: {
        message_id: message.message_id,
        update_id: update.update_id,
        user_id: message.from?.id,
        username: message.from?.username,
        chat_type: message.chat.type,
        is_edited: !!update.edited_message,
      },
    };

    const msgPreview = content.length > 50 ? `${content.slice(0, 50)}...` : content;
    log.info({ senderName, senderId, messagePreview: msgPreview }, "Message received");

    // Publish to message bus
    await this.messageBus.publishInbound(inbound);
  }

  /**
   * Check if sender is allowed based on channel config
   */
  private isAllowed(message: TelegramMessage): boolean {
    const allowFrom = this.channel.allow_from || [];

    // If allow_from is empty, allow all
    if (allowFrom.length === 0) {
      return true;
    }

    const user = message.from;
    if (!user) {
      // No sender info - block by default
      return false;
    }

    // Check against allow list
    for (const allowed of allowFrom) {
      const normalizedAllowed = allowed.toLowerCase().replace(/^@/, "");

      // Check username
      if (user.username && user.username.toLowerCase() === normalizedAllowed) {
        return true;
      }

      // Check numeric ID
      if (user.id.toString() === allowed) {
        return true;
      }
    }

    return false;
  }

  /**
   * Build sender ID (numeric ID + optional username)
   */
  private buildSenderId(message: TelegramMessage): string {
    const user = message.from;
    if (!user) {
      return `chat:${message.chat.id}`;
    }

    if (user.username) {
      return `${user.id}|${user.username}`;
    }

    return user.id.toString();
  }

  /**
   * Build display name for sender
   */
  private buildSenderName(message: TelegramMessage): string {
    const user = message.from;
    if (!user) {
      return message.chat.title || `Chat ${message.chat.id}`;
    }

    if (user.username) {
      return `@${user.username}`;
    }

    const parts = [user.first_name];
    if (user.last_name) {
      parts.push(user.last_name);
    }
    return parts.join(" ");
  }

  /**
   * Get sender info for logging
   */
  private getSenderInfo(message: TelegramMessage): string {
    const user = message.from;
    if (!user) {
      return `chat:${message.chat.id}`;
    }
    return user.username ? `@${user.username}` : `user:${user.id}`;
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
