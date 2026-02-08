/**
 * Discord channel implementation for Viben CLI
 *
 * Uses Discord Gateway WebSocket for real-time message handling.
 */

import { BaseChannel } from './base';
import { decryptValue, isEncrypted } from './config';
import type {
  ChannelStatus,
  ChannelType,
  InboundMessage,
  OutboundMessage,
  DiscordConfig,
} from './types';
import { DEFAULT_DISCORD_GATEWAY, DEFAULT_DISCORD_INTENTS } from './types';

const DISCORD_API_BASE = 'https://discord.com/api/v10';

/**
 * Discord channel using Gateway WebSocket
 */
export class DiscordChannel extends BaseChannel {
  readonly type: ChannelType = 'discord';
  declare readonly config: DiscordConfig;

  private ws: WebSocket | null = null;
  private seq: number | null = null;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private botTag?: string;

  constructor(id: string, config: DiscordConfig) {
    super(id, config);
  }

  async connect(): Promise<void> {
    const token = this.getDecryptedToken();
    if (!token) {
      throw new Error('Discord bot token not configured');
    }

    try {
      const gatewayUrl = this.config.gatewayUrl || DEFAULT_DISCORD_GATEWAY;

      // Dynamic import WebSocket for Node.js environment
      const WebSocketImpl = await this.getWebSocket();

      return new Promise((resolve, reject) => {
        this.ws = new WebSocketImpl(gatewayUrl) as WebSocket;

        this.ws.onopen = () => {
          this.logInfo('WebSocket connected');
        };

        this.ws.onmessage = async (event) => {
          try {
            const data = JSON.parse(event.data as string);
            await this.handleGatewayEvent(data, token, resolve);
          } catch (error) {
            this.logError('Error parsing gateway message', error);
          }
        };

        this.ws.onerror = (event) => {
          this.logError('WebSocket error', event);
          reject(new Error('WebSocket connection failed'));
        };

        this.ws.onclose = () => {
          this._connected = false;
          this.logInfo('WebSocket closed');
          this.stopHeartbeat();
        };
      });
    } catch (error) {
      this.logError('Failed to connect', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this._connected = false;
    this.logInfo('Disconnected');
  }

  async sendMessage(msg: OutboundMessage): Promise<void> {
    const token = this.getDecryptedToken();
    if (!token) {
      throw new Error('Discord bot token not configured');
    }

    const url = `${DISCORD_API_BASE}/channels/${msg.chatId}/messages`;
    const payload: Record<string, unknown> = { content: msg.content };

    if (msg.replyTo) {
      payload.message_reference = { message_id: msg.replyTo };
      payload.allowed_mentions = { replied_user: false };
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bot ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Discord API error: ${response.status} ${errorText}`);
    }
  }

  getStatus(): ChannelStatus {
    return {
      connected: this._connected,
      identifier: this.botTag,
      lastError: this._lastError,
      lastMessageAt: this._lastMessageAt,
    };
  }

  private async getWebSocket(): Promise<new (url: string) => WebSocket> {
    // In Node.js, use ws package; in browser, use native WebSocket
    if (typeof WebSocket !== 'undefined') {
      return WebSocket as unknown as new (url: string) => WebSocket;
    }

    try {
      const ws = await import('ws');
      return (ws.default || ws) as unknown as new (url: string) => WebSocket;
    } catch {
      throw new Error('WebSocket not available. In Node.js, install ws package: npm install ws');
    }
  }

  private getDecryptedToken(): string | null {
    const token = this.config.token;
    if (!token) {
      return null;
    }
    return isEncrypted(token) ? decryptValue(token) : token;
  }

  private async handleGatewayEvent(
    data: GatewayPayload,
    token: string,
    onReady: () => void
  ): Promise<void> {
    const { op, t: eventType, s: seq, d: payload } = data;

    if (seq !== null && seq !== undefined) {
      this.seq = seq;
    }

    switch (op) {
      case 10: // HELLO
        const heartbeatInterval = (payload as HelloPayload).heartbeat_interval;
        this.startHeartbeat(heartbeatInterval);
        await this.identify(token);
        break;

      case 0: // DISPATCH
        if (eventType === 'READY') {
          const readyPayload = payload as ReadyPayload;
          this.botTag = `${readyPayload.user.username}#${readyPayload.user.discriminator || '0'}`;
          this._connected = true;
          this.logInfo(`Connected as ${this.botTag}`);
          onReady();
        } else if (eventType === 'MESSAGE_CREATE') {
          await this.handleMessageCreate(payload as MessageCreatePayload);
        }
        break;

      case 7: // RECONNECT
        this.logInfo('Gateway requested reconnect');
        this.disconnect().then(() => this.connect());
        break;

      case 9: // INVALID_SESSION
        this.logError('Invalid session', 'Session invalidated by Discord');
        break;

      case 11: // HEARTBEAT_ACK
        // Heartbeat acknowledged, connection is healthy
        break;
    }
  }

  private async identify(token: string): Promise<void> {
    if (!this.ws) return;

    const identify: GatewayPayload = {
      op: 2,
      d: {
        token,
        intents: this.config.intents || DEFAULT_DISCORD_INTENTS,
        properties: {
          os: 'viben',
          browser: 'viben',
          device: 'viben',
        },
      },
    };

    this.ws.send(JSON.stringify(identify));
  }

  private startHeartbeat(intervalMs: number): void {
    this.stopHeartbeat();

    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === 1) { // OPEN
        const heartbeat: GatewayPayload = {
          op: 1,
          d: this.seq,
        };
        this.ws.send(JSON.stringify(heartbeat));
      }
    }, intervalMs);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private async handleMessageCreate(payload: MessageCreatePayload): Promise<void> {
    const { author, content, channel_id, id, referenced_message } = payload;

    // Ignore bot messages
    if (author.bot) {
      return;
    }

    const senderId = author.id;

    // Check whitelist
    if (!this.isAllowed(senderId)) {
      return;
    }

    const contentParts: string[] = [];
    if (content) {
      contentParts.push(content);
    }

    // Note attachments
    if (payload.attachments && payload.attachments.length > 0) {
      for (const attachment of payload.attachments) {
        contentParts.push(`[attachment: ${attachment.filename || 'file'}]`);
      }
    }

    const inbound: InboundMessage = {
      channel: this.id,
      channelType: 'discord',
      senderId,
      senderName: author.username,
      chatId: channel_id,
      content: contentParts.length > 0 ? contentParts.join('\n') : '[empty message]',
      replyTo: referenced_message?.id,
      timestamp: new Date(payload.timestamp).getTime(),
      metadata: {
        messageId: id,
        guildId: payload.guild_id,
      },
    };

    this.handleInboundMessage(inbound);
  }
}

// Discord Gateway payload types
interface GatewayPayload {
  op: number;
  d?: unknown;
  s?: number | null;
  t?: string | null;
}

interface HelloPayload {
  heartbeat_interval: number;
}

interface ReadyPayload {
  user: {
    id: string;
    username: string;
    discriminator?: string;
  };
}

interface MessageCreatePayload {
  id: string;
  channel_id: string;
  guild_id?: string;
  author: {
    id: string;
    username: string;
    bot?: boolean;
  };
  content: string;
  timestamp: string;
  referenced_message?: {
    id: string;
  };
  attachments?: Array<{
    id: string;
    filename: string;
    url: string;
    size: number;
  }>;
}
