/**
 * Feishu/Lark channel implementation for Viben CLI
 *
 * Uses @larksuiteoapi/node-sdk for WebSocket long connection.
 */

import { BaseChannel } from './base';
import { decryptValue, isEncrypted } from './config';
import type {
  ChannelStatus,
  ChannelType,
  InboundMessage,
  OutboundMessage,
  FeishuConfig,
} from './types';

// Message type display mapping
const MSG_TYPE_MAP: Record<string, string> = {
  image: '[image]',
  audio: '[audio]',
  file: '[file]',
  sticker: '[sticker]',
};

/**
 * Feishu channel using WebSocket long connection
 */
export class FeishuChannel extends BaseChannel {
  readonly type: ChannelType = 'feishu';
  declare readonly config: FeishuConfig;

  private client: LarkClient | null = null;
  private wsClient: LarkWSClient | null = null;
  private processedMessageIds = new Map<string, boolean>();

  constructor(id: string, config: FeishuConfig) {
    super(id, config);
  }

  async connect(): Promise<void> {
    if (!this.config.appId || !this.config.appSecret) {
      throw new Error('Feishu app_id and app_secret not configured');
    }

    const appSecret = this.getDecryptedSecret();
    if (!appSecret) {
      throw new Error('Failed to decrypt Feishu app secret');
    }

    try {
      const lark = await this.importLarkSDK();

      // Create Lark client for sending messages
      this.client = new lark.Client({
        appId: this.config.appId,
        appSecret,
        disableTokenCache: false,
      });

      // Create event handler
      const eventDispatcher = new lark.EventDispatcher({
        encryptKey: this.config.encryptKey || '',
        verificationToken: this.config.verificationToken || '',
      });

      // Register message receive handler
      eventDispatcher.register({
        'im.message.receive_v1': (data: unknown) => {
          this.handleMessage(data as FeishuMessageEvent);
          return {};
        },
      });

      // Create WebSocket client
      this.wsClient = new lark.WSClient({
        appId: this.config.appId,
        appSecret,
        eventDispatcher,
      });

      // Start WebSocket connection
      await this.wsClient.start();

      this._connected = true;
      this.logInfo('Connected via WebSocket');
      this.logInfo('No public IP required - using WebSocket to receive events');
    } catch (error) {
      this.logError('Failed to connect', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.wsClient) {
      try {
        // WSClient may not have a stop method depending on SDK version
        if (typeof (this.wsClient as unknown as { stop: () => void }).stop === 'function') {
          (this.wsClient as unknown as { stop: () => void }).stop();
        }
      } catch (error) {
        this.logError('Error stopping WebSocket client', error);
      }
      this.wsClient = null;
    }
    this.client = null;
    this._connected = false;
    this.logInfo('Disconnected');
  }

  async sendMessage(msg: OutboundMessage): Promise<void> {
    if (!this.client) {
      throw new Error('Client not connected');
    }

    try {
      // Determine receive_id_type based on chat_id format
      // open_id starts with "ou_", chat_id starts with "oc_"
      const receiveIdType = msg.chatId.startsWith('oc_') ? 'chat_id' : 'open_id';

      // Build card with markdown support
      const elements = this.buildCardElements(msg.content);
      const card = {
        config: { wide_screen_mode: true },
        elements,
      };

      await this.client.im.message.create({
        params: {
          receive_id_type: receiveIdType,
        },
        data: {
          receive_id: msg.chatId,
          msg_type: 'interactive',
          content: JSON.stringify(card),
        },
      });
    } catch (error) {
      this.logError('Error sending message', error);
      throw error;
    }
  }

  getStatus(): ChannelStatus {
    return {
      connected: this._connected,
      identifier: this.config.appId ? `App: ${this.config.appId}` : undefined,
      lastError: this._lastError,
      lastMessageAt: this._lastMessageAt,
    };
  }

  private async importLarkSDK(): Promise<LarkModule> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const lark = await import('@larksuiteoapi/node-sdk') as any;
      return lark as LarkModule;
    } catch {
      throw new Error(
        '@larksuiteoapi/node-sdk is not installed. Run: npm install @larksuiteoapi/node-sdk'
      );
    }
  }

  private getDecryptedSecret(): string | null {
    const secret = this.config.appSecret;
    if (!secret) {
      return null;
    }
    return isEncrypted(secret) ? decryptValue(secret) : secret;
  }

  private handleMessage(data: FeishuMessageEvent): void {
    try {
      const event = data.event;
      const message = event.message;
      const sender = event.sender;

      // Deduplication check
      const messageId = message.message_id;
      if (this.processedMessageIds.has(messageId)) {
        return;
      }
      this.processedMessageIds.set(messageId, true);

      // Trim cache: keep most recent 500 when exceeds 1000
      if (this.processedMessageIds.size > 1000) {
        const keys = Array.from(this.processedMessageIds.keys());
        for (let i = 0; i < 500; i++) {
          this.processedMessageIds.delete(keys[i]);
        }
      }

      // Skip bot messages
      if (sender.sender_type === 'bot') {
        return;
      }

      const senderId = sender.sender_id?.open_id || 'unknown';
      const chatId = message.chat_id;
      const chatType = message.chat_type; // "p2p" or "group"
      const msgType = message.message_type;

      // Parse message content
      let content = '';
      if (msgType === 'text') {
        try {
          const parsed = JSON.parse(message.content);
          content = parsed.text || '';
        } catch {
          content = message.content || '';
        }
      } else {
        content = MSG_TYPE_MAP[msgType] || `[${msgType}]`;
      }

      if (!content) {
        return;
      }

      // For group messages, reply to group; for p2p, reply to sender
      const replyTo = chatType === 'group' ? chatId : senderId;

      const inbound: InboundMessage = {
        channel: this.id,
        channelType: 'feishu',
        senderId,
        chatId: replyTo,
        content,
        timestamp: parseInt(message.create_time, 10) || Date.now(),
        metadata: {
          messageId,
          chatType,
          msgType,
        },
      };

      this.handleInboundMessage(inbound);
    } catch (error) {
      this.logError('Error processing message', error);
    }
  }

  /**
   * Build card elements from content, supporting markdown tables
   */
  private buildCardElements(content: string): CardElement[] {
    const elements: CardElement[] = [];
    let lastEnd = 0;

    // Regex to match markdown tables
    const tableRegex = /((?:^[ \t]*\|.+\|[ \t]*\n)(?:^[ \t]*\|[-:\s|]+\|[ \t]*\n)(?:^[ \t]*\|.+\|[ \t]*\n?)+)/gm;

    let match: RegExpExecArray | null;
    while ((match = tableRegex.exec(content)) !== null) {
      const before = content.slice(lastEnd, match.index).trim();
      if (before) {
        elements.push({ tag: 'markdown', content: before });
      }

      const tableElement = this.parseMarkdownTable(match[1]);
      if (tableElement) {
        elements.push(tableElement);
      } else {
        elements.push({ tag: 'markdown', content: match[1] });
      }

      lastEnd = match.index + match[0].length;
    }

    const remaining = content.slice(lastEnd).trim();
    if (remaining) {
      elements.push({ tag: 'markdown', content: remaining });
    }

    return elements.length > 0 ? elements : [{ tag: 'markdown', content }];
  }

  /**
   * Parse a markdown table into a Feishu table element
   */
  private parseMarkdownTable(tableText: string): CardElement | null {
    const lines = tableText.split('\n').filter((l) => l.trim());
    if (lines.length < 3) {
      return null;
    }

    const split = (line: string): string[] =>
      line
        .trim()
        .replace(/^\||\|$/g, '')
        .split('|')
        .map((c) => c.trim());

    const headers = split(lines[0]);
    const rows = lines.slice(2).map(split);

    const columns = headers.map((h, i) => ({
      tag: 'column' as const,
      name: `c${i}`,
      display_name: h,
      width: 'auto' as const,
    }));

    return {
      tag: 'table',
      page_size: rows.length + 1,
      columns,
      rows: rows.map((r) => {
        const row: Record<string, string> = {};
        headers.forEach((_, i) => {
          row[`c${i}`] = r[i] || '';
        });
        return row;
      }),
    };
  }
}

// Type definitions for Lark SDK (simplified)
interface LarkModule {
  Client: new (config: { appId: string; appSecret: string; disableTokenCache?: boolean }) => LarkClient;
  EventDispatcher: new (config: { encryptKey?: string; verificationToken?: string }) => LarkEventDispatcher;
  WSClient: new (config: { appId: string; appSecret: string; eventDispatcher: LarkEventDispatcher }) => LarkWSClient;
}

interface LarkClient {
  im: {
    message: {
      create: (request: {
        params: { receive_id_type: string };
        data: { receive_id: string; msg_type: string; content: string };
      }) => Promise<unknown>;
    };
  };
}

interface LarkEventDispatcher {
  register: (handlers: Record<string, (data: unknown) => unknown>) => void;
}

interface LarkWSClient {
  start: () => Promise<void>;
}

interface FeishuMessageEvent {
  event: {
    message: {
      message_id: string;
      chat_id: string;
      chat_type: string;
      message_type: string;
      content: string;
      create_time: string;
    };
    sender: {
      sender_type: string;
      sender_id?: {
        open_id: string;
      };
    };
  };
}

interface CardElement {
  tag: 'markdown' | 'table' | 'column';
  content?: string;
  page_size?: number;
  columns?: Array<{ tag: 'column'; name: string; display_name: string; width: string }>;
  rows?: Array<Record<string, string>>;
  name?: string;
  display_name?: string;
  width?: string;
}
