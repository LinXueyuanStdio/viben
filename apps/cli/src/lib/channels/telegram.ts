/**
 * Telegram Channel Implementation
 *
 * Uses node-telegram-bot-api for Telegram Bot API integration.
 * Supports polling mode for receiving messages.
 */

import TelegramBot from "node-telegram-bot-api";
import {
  BaseChannel,
  type ChannelConfig,
  type ChannelStatus,
  type InboundMessage,
  type MediaAttachment,
  type OutboundMessage,
} from "./base.js";

// ============================================================================
// Types
// ============================================================================

/**
 * Telegram-specific channel configuration
 */
export interface TelegramConfig extends ChannelConfig {
  type: "telegram";
  /** Telegram Bot API token */
  token: string;
  /** HTTP/SOCKS5 proxy URL */
  proxy?: string;
  /** Webhook URL (alternative to polling) */
  webhookUrl?: string;
  /** Webhook port */
  webhookPort?: number;
}

// ============================================================================
// Telegram Channel Implementation
// ============================================================================

export class TelegramChannel extends BaseChannel {
  readonly id: string;
  readonly type = "telegram" as const;
  readonly config: TelegramConfig;

  private bot: TelegramBot | null = null;
  private botInfo?: TelegramBot.User;

  constructor(id: string, config: TelegramConfig) {
    super();
    this.id = id;
    this.config = config;
  }

  async connect(): Promise<void> {
    try {
      const options: TelegramBot.ConstructorOptions = {
        polling: true,
      };

      // Configure proxy if specified
      // Note: proxy configuration requires additional setup with request library
      // For now, we'll skip proxy configuration as it needs special handling
      // if (this.config.proxy) {
      //   // Proxy configuration would go here
      // }

      this.bot = new TelegramBot(this.config.token, options);

      // Get bot info
      this.botInfo = await this.bot.getMe();

      // Set up message handlers
      this.bot.on("message", (msg) => this.handleMessage(msg));
      this.bot.on("polling_error", (error) => {
        this.handleError(error, "Polling error");
      });

      this.connected = true;
      console.log(
        `[Telegram ${this.id}] Connected as @${this.botInfo.username}`
      );
    } catch (error) {
      this.handleError(error, "Connection failed");
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.bot) {
      await this.bot.stopPolling();
      this.bot = null;
    }
    this.connected = false;
    console.log(`[Telegram ${this.id}] Disconnected`);
  }

  async sendMessage(msg: OutboundMessage): Promise<void> {
    if (!this.bot) {
      throw new Error("Bot not connected");
    }

    const options: TelegramBot.SendMessageOptions = {
      parse_mode: "Markdown",
    };

    // Handle reply
    if (msg.replyTo) {
      options.reply_to_message_id = parseInt(msg.replyTo, 10);
    }

    // Send text message
    await this.bot.sendMessage(msg.chatId, msg.content, options);

    // Send media attachments if any
    if (msg.media?.length) {
      for (const media of msg.media) {
        await this.sendMediaAttachment(msg.chatId, media, msg.replyTo);
      }
    }
  }

  getStatus(): ChannelStatus {
    return {
      connected: this.connected,
      identifier: this.botInfo ? `@${this.botInfo.username}` : undefined,
      lastError: this.lastError,
      lastMessageAt: this.lastMessageAt,
      extra: this.botInfo
        ? {
            botId: this.botInfo.id,
            firstName: this.botInfo.first_name,
          }
        : undefined,
    };
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private handleMessage(msg: TelegramBot.Message): void {
    // Check allowlist
    const userId = msg.from?.id?.toString();
    if (!this.isAllowed(userId)) {
      console.log(
        `[Telegram ${this.id}] Ignored message from non-whitelisted user: ${userId}`
      );
      return;
    }

    // Build inbound message
    const inbound: InboundMessage = {
      channel: this.id,
      channelType: "telegram",
      senderId: userId || "",
      senderName: this.getSenderName(msg.from),
      chatId: msg.chat.id.toString(),
      content: msg.text || msg.caption || "",
      messageId: msg.message_id.toString(),
      replyTo: msg.reply_to_message?.message_id?.toString(),
      timestamp: msg.date * 1000, // Convert to milliseconds
      media: this.extractMedia(msg),
      raw: msg,
    };

    this.emitMessage(inbound);
  }

  private getSenderName(from?: TelegramBot.User): string | undefined {
    if (!from) return undefined;
    return (
      from.username || [from.first_name, from.last_name].filter(Boolean).join(" ")
    );
  }

  private extractMedia(msg: TelegramBot.Message): MediaAttachment[] | undefined {
    const media: MediaAttachment[] = [];

    // Photo (get largest)
    if (msg.photo?.length) {
      const largestPhoto = msg.photo[msg.photo.length - 1];
      media.push({
        type: "image",
        url: largestPhoto.file_id,
        // Telegram uses file_id, actual URL needs to be fetched via getFileLink
      });
    }

    // Audio
    if (msg.audio) {
      media.push({
        type: "audio",
        url: msg.audio.file_id,
        filename: msg.audio.title,
        mimeType: msg.audio.mime_type,
        size: msg.audio.file_size,
      });
    }

    // Voice
    if (msg.voice) {
      media.push({
        type: "audio",
        url: msg.voice.file_id,
        mimeType: msg.voice.mime_type,
        size: msg.voice.file_size,
      });
    }

    // Video
    if (msg.video) {
      media.push({
        type: "video",
        url: msg.video.file_id,
        mimeType: msg.video.mime_type,
        size: msg.video.file_size,
      });
    }

    // Document
    if (msg.document) {
      media.push({
        type: "file",
        url: msg.document.file_id,
        filename: msg.document.file_name,
        mimeType: msg.document.mime_type,
        size: msg.document.file_size,
      });
    }

    return media.length > 0 ? media : undefined;
  }

  private async sendMediaAttachment(
    chatId: string,
    media: MediaAttachment,
    replyTo?: string
  ): Promise<void> {
    if (!this.bot) throw new Error("Bot not connected");

    const options: TelegramBot.SendDocumentOptions = {};
    if (replyTo) {
      options.reply_to_message_id = parseInt(replyTo, 10);
    }

    switch (media.type) {
      case "image":
        await this.bot.sendPhoto(chatId, media.url, options);
        break;
      case "audio":
        await this.bot.sendAudio(chatId, media.url, options);
        break;
      case "video":
        await this.bot.sendVideo(chatId, media.url, options);
        break;
      case "file":
        await this.bot.sendDocument(chatId, media.url, options);
        break;
    }
  }

  /**
   * Get the actual download URL for a file
   * @param fileId - Telegram file_id
   * @returns Download URL
   */
  async getFileUrl(fileId: string): Promise<string> {
    if (!this.bot) throw new Error("Bot not connected");
    return this.bot.getFileLink(fileId);
  }

  /**
   * Download a file to a local path
   * @param fileId - Telegram file_id
   * @param destPath - Destination file path
   */
  async downloadFile(fileId: string, destPath: string): Promise<string> {
    if (!this.bot) throw new Error("Bot not connected");
    return this.bot.downloadFile(fileId, destPath);
  }
}
