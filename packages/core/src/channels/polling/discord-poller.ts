/**
 * Discord Gateway WebSocket Client
 *
 * Connects to Discord Gateway via WebSocket to receive messages.
 * Publishes received messages to the MessageBus for routing.
 *
 * Reference: https://discord.com/developers/docs/topics/gateway
 */

import type { MessageBus, InboundMessage } from "../../services/message-bus";
import type { Channel, DiscordChannelConfig } from "../types";
import WebSocketImpl from "ws";

const DISCORD_API_BASE = "https://discord.com/api/v10";
const DEFAULT_GATEWAY_URL = "wss://gateway.discord.gg/?v=10&encoding=json";

/**
 * Discord poller configuration
 */
export interface DiscordPollerConfig {
  /** Channel configuration */
  channel: Channel;
  /** Discord-specific config */
  discordConfig: DiscordChannelConfig;
  /** Message bus for publishing inbound messages */
  messageBus: MessageBus;
  /** Reconnect delay in milliseconds (default: 5000) */
  reconnectDelayMs?: number;
}

/**
 * Discord Gateway WebSocket Client
 *
 * Uses Discord's Gateway API to receive real-time events.
 * No webhook/public IP required.
 */
export class DiscordPoller {
  private channel: Channel;
  private config: DiscordChannelConfig;
  private messageBus: MessageBus;
  private reconnectDelayMs: number;

  private running = false;
  private ws: WebSocket | null = null;
  private seq: number | null = null;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private botUserId: string | null = null;

  constructor(config: DiscordPollerConfig) {
    this.channel = config.channel;
    this.config = config.discordConfig;
    this.messageBus = config.messageBus;
    this.reconnectDelayMs = config.reconnectDelayMs ?? 5000;
  }

  /**
   * Start the Discord Gateway connection
   */
  async start(): Promise<void> {
    if (this.running) {
      console.log(`[DiscordPoller] ${this.channel.name} already running`);
      return;
    }

    if (!this.config.token) {
      console.error(`[DiscordPoller] Bot token not configured for ${this.channel.name}`);
      return;
    }

    console.log(`[DiscordPoller] Starting ${this.channel.name}...`);
    this.running = true;

    // Notify connection status
    this.messageBus.updateConnectionStatus("discord", this.channel.name, false);

    // Start connection loop
    await this.connectionLoop();
  }

  /**
   * Stop the Discord Gateway connection
   */
  async stop(): Promise<void> {
    if (!this.running) {
      return;
    }

    console.log(`[DiscordPoller] Stopping ${this.channel.name}...`);
    this.running = false;

    this.stopHeartbeat();

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.messageBus.updateConnectionStatus("discord", this.channel.name, false);
    console.log(`[DiscordPoller] ${this.channel.name} stopped`);
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
   * Main connection loop with auto-reconnect
   */
  private async connectionLoop(): Promise<void> {
    while (this.running) {
      try {
        const gatewayUrl = this.config.gateway_url || DEFAULT_GATEWAY_URL;
        console.log(`[DiscordPoller] Connecting to Discord Gateway...`);

        await this.connectToGateway(gatewayUrl);
      } catch (error) {
        console.error(`[DiscordPoller] Gateway error:`, error);
      }

      if (this.running) {
        console.log(`[DiscordPoller] Reconnecting in ${this.reconnectDelayMs / 1000}s...`);
        await this.sleep(this.reconnectDelayMs);
      }
    }
  }

  /**
   * Connect to Discord Gateway and handle events
   */
  private async connectToGateway(url: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      try {
        // Use ws library for Node.js
        this.ws = new WebSocketImpl(url) as unknown as WebSocket;

        this.ws.onopen = () => {
          console.log(`[DiscordPoller] WebSocket connected`);
        };

        this.ws.onclose = (event) => {
          console.log(`[DiscordPoller] WebSocket closed: code=${event.code}`);
          this.stopHeartbeat();
          this.ws = null;
          resolve();
        };

        this.ws.onerror = (error) => {
          console.error(`[DiscordPoller] WebSocket error:`, error);
          reject(error);
        };

        this.ws.onmessage = (event) => {
          this.handleGatewayMessage(event.data as string);
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Handle incoming Gateway message
   */
  private handleGatewayMessage(raw: string): void {
    let data: {
      op: number;
      t?: string;
      s?: number;
      d?: Record<string, unknown>;
    };

    try {
      data = JSON.parse(raw);
    } catch {
      console.warn(`[DiscordPoller] Invalid JSON from Gateway`);
      return;
    }

    const { op, t: eventType, s: seq, d: payload } = data;

    // Update sequence number
    if (seq !== undefined && seq !== null) {
      this.seq = seq;
    }

    switch (op) {
      case 10: // HELLO
        this.handleHello(payload as { heartbeat_interval: number });
        break;

      case 0: // DISPATCH
        this.handleDispatch(eventType!, payload!);
        break;

      case 7: // RECONNECT
        console.log(`[DiscordPoller] Gateway requested reconnect`);
        this.ws?.close();
        break;

      case 9: // INVALID_SESSION
        console.warn(`[DiscordPoller] Invalid session`);
        this.ws?.close();
        break;

      case 11: // HEARTBEAT_ACK
        // Heartbeat acknowledged
        break;
    }
  }

  /**
   * Handle HELLO opcode
   */
  private handleHello(payload: { heartbeat_interval: number }): void {
    const intervalMs = payload.heartbeat_interval;
    console.log(`[DiscordPoller] Starting heartbeat (interval: ${intervalMs}ms)`);

    this.startHeartbeat(intervalMs);
    this.sendIdentify();
  }

  /**
   * Start heartbeat loop
   */
  private startHeartbeat(intervalMs: number): void {
    this.stopHeartbeat();

    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === 1) {
        this.ws.send(JSON.stringify({ op: 1, d: this.seq }));
      }
    }, intervalMs);
  }

  /**
   * Stop heartbeat loop
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Send IDENTIFY payload
   */
  private sendIdentify(): void {
    if (!this.ws) return;

    const identify = {
      op: 2,
      d: {
        token: this.config.token,
        intents: this.config.intents ?? 513, // GUILDS + GUILD_MESSAGES
        properties: {
          os: "viben",
          browser: "viben",
          device: "viben",
        },
      },
    };

    this.ws.send(JSON.stringify(identify));
  }

  /**
   * Handle DISPATCH events
   */
  private handleDispatch(eventType: string, payload: Record<string, unknown>): void {
    switch (eventType) {
      case "READY":
        this.handleReady(payload);
        break;

      case "MESSAGE_CREATE":
        this.handleMessageCreate(payload).catch((err) => {
          console.error(`[DiscordPoller] Error handling message:`, err);
        });
        break;
    }
  }

  /**
   * Handle READY event
   */
  private handleReady(payload: Record<string, unknown>): void {
    const user = payload.user as { id: string; username: string } | undefined;
    if (user) {
      this.botUserId = user.id;
      console.log(`[DiscordPoller] Bot ready: @${user.username}`);
    }

    this.messageBus.updateConnectionStatus("discord", this.channel.name, true);
  }

  /**
   * Handle MESSAGE_CREATE event
   */
  private async handleMessageCreate(payload: Record<string, unknown>): Promise<void> {
    const author = payload.author as { id: string; username: string; bot?: boolean } | undefined;
    if (!author) return;

    // Skip bot messages
    if (author.bot) return;

    // Skip own messages
    if (author.id === this.botUserId) return;

    const senderId = author.id;
    const channelId = payload.channel_id as string;
    const content = payload.content as string || "";
    const messageId = payload.id as string;

    // Check allow_from list
    if (!this.isAllowed(senderId)) {
      console.log(`[DiscordPoller] Message from ${author.username} blocked by allow_from`);
      return;
    }

    // Build content with attachments
    const contentParts: string[] = [];
    if (content) {
      contentParts.push(content);
    }

    const attachments = payload.attachments as Array<{ filename: string; url: string }> | undefined;
    if (attachments && attachments.length > 0) {
      for (const att of attachments) {
        contentParts.push(`[attachment: ${att.filename}]`);
      }
    }

    const finalContent = contentParts.join("\n") || "[empty message]";

    const inbound: InboundMessage = {
      channelType: "discord",
      channelName: this.channel.name,
      chatId: channelId,
      senderId,
      senderName: `@${author.username}`,
      message: finalContent,
      timestamp: Date.now(),
      metadata: {
        message_id: messageId,
        guild_id: payload.guild_id,
        referenced_message: (payload.referenced_message as { id?: string } | undefined)?.id,
      },
    };

    const msgPreview = finalContent.length > 50 ? `${finalContent.slice(0, 50)}...` : finalContent;
    console.log(`[DiscordPoller] Message from @${author.username}: ${msgPreview}`);

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
