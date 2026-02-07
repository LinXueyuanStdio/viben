/**
 * Discord Channel Implementation
 *
 * Uses discord.js for Discord Bot API integration.
 * Supports receiving messages from guilds and DMs.
 */

import {
  Client,
  GatewayIntentBits,
  type Message,
  type MessageCreateOptions,
  Partials,
  type Channel as DiscordChannelType,
} from "discord.js";
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
 * Discord-specific channel configuration
 */
export interface DiscordConfig extends ChannelConfig {
  type: "discord";
  /** Discord Bot token */
  token: string;
  /** List of guild IDs to listen to (empty = all) */
  guildIds?: string[];
  /** List of channel IDs to listen to (empty = all) */
  channelIds?: string[];
}

// ============================================================================
// Discord Channel Implementation
// ============================================================================

export class DiscordChannel extends BaseChannel {
  readonly id: string;
  readonly type = "discord" as const;
  readonly config: DiscordConfig;

  private client: Client | null = null;
  private botTag?: string;

  constructor(id: string, config: DiscordConfig) {
    super();
    this.id = id;
    this.config = config;
  }

  async connect(): Promise<void> {
    try {
      this.client = new Client({
        intents: [
          GatewayIntentBits.Guilds,
          GatewayIntentBits.GuildMessages,
          GatewayIntentBits.DirectMessages,
          GatewayIntentBits.MessageContent,
        ],
        partials: [Partials.Channel, Partials.Message],
      });

      // Set up event handlers before login
      this.client.once("ready", () => {
        this.botTag = this.client?.user?.tag;
        this.connected = true;
        console.log(`[Discord ${this.id}] Connected as ${this.botTag}`);
      });

      this.client.on("messageCreate", (msg) => this.handleMessage(msg));

      this.client.on("error", (error) => {
        this.handleError(error, "Client error");
      });

      // Login and wait for ready
      await this.client.login(this.config.token);

      // Wait for ready event
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Connection timeout"));
        }, 30000);

        this.client?.once("ready", () => {
          clearTimeout(timeout);
          resolve();
        });
      });
    } catch (error) {
      this.handleError(error, "Connection failed");
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.destroy();
      this.client = null;
    }
    this.connected = false;
    console.log(`[Discord ${this.id}] Disconnected`);
  }

  async sendMessage(msg: OutboundMessage): Promise<void> {
    if (!this.client) {
      throw new Error("Client not connected");
    }

    const channel = await this.client.channels.fetch(msg.chatId);
    if (!channel || !this.isTextBasedChannel(channel)) {
      throw new Error(`Invalid or inaccessible channel: ${msg.chatId}`);
    }

    const messageOptions: MessageCreateOptions = {
      content: msg.content,
    };

    // Handle reply
    if (msg.replyTo) {
      messageOptions.reply = {
        messageReference: msg.replyTo,
      };
    }

    // Handle media attachments
    if (msg.media?.length) {
      messageOptions.files = msg.media.map((media) => ({
        attachment: media.url,
        name: media.filename,
      }));
    }

    // Type assertion: we already checked it's text-based
    await (channel as unknown as { send: (options: MessageCreateOptions) => Promise<void> }).send(messageOptions);
  }

  getStatus(): ChannelStatus {
    return {
      connected: this.connected,
      identifier: this.botTag,
      lastError: this.lastError,
      lastMessageAt: this.lastMessageAt,
      extra: this.client?.user
        ? {
            botId: this.client.user.id,
            guildCount: this.client.guilds.cache.size,
          }
        : undefined,
    };
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private handleMessage(msg: Message): void {
    // Ignore bot messages
    if (msg.author.bot) return;

    // Check allowlist
    if (!this.isAllowed(msg.author.id)) {
      console.log(
        `[Discord ${this.id}] Ignored message from non-whitelisted user: ${msg.author.id}`
      );
      return;
    }

    // Check guild filter
    if (this.config.guildIds?.length && msg.guildId) {
      if (!this.config.guildIds.includes(msg.guildId)) {
        return;
      }
    }

    // Check channel filter
    if (this.config.channelIds?.length) {
      if (!this.config.channelIds.includes(msg.channelId)) {
        return;
      }
    }

    // Build inbound message
    const inbound: InboundMessage = {
      channel: this.id,
      channelType: "discord",
      senderId: msg.author.id,
      senderName: msg.author.username,
      chatId: msg.channelId,
      content: msg.content,
      messageId: msg.id,
      replyTo: msg.reference?.messageId || undefined,
      timestamp: msg.createdTimestamp,
      media: this.extractMedia(msg),
      raw: msg,
    };

    this.emitMessage(inbound);
  }

  private extractMedia(msg: Message): MediaAttachment[] | undefined {
    const media: MediaAttachment[] = [];

    // Process attachments
    for (const attachment of msg.attachments.values()) {
      const mediaType = this.getMediaType(attachment.contentType);
      media.push({
        type: mediaType,
        url: attachment.url,
        filename: attachment.name || undefined,
        mimeType: attachment.contentType || undefined,
        size: attachment.size,
      });
    }

    return media.length > 0 ? media : undefined;
  }

  private getMediaType(
    contentType: string | null
  ): "image" | "audio" | "video" | "file" {
    if (!contentType) return "file";
    if (contentType.startsWith("image/")) return "image";
    if (contentType.startsWith("audio/")) return "audio";
    if (contentType.startsWith("video/")) return "video";
    return "file";
  }

  private isTextBasedChannel(channel: DiscordChannelType | null): boolean {
    if (!channel) return false;
    // Check if channel has a send method (text-based channels)
    return "send" in channel && typeof (channel as { send?: unknown }).send === "function";
  }
}
