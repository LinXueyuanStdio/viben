/**
 * Telegram channel implementation for Viben CLI
 *
 * Uses node-telegram-bot-api for polling-based message handling.
 */

import { BaseChannel } from './base';
import { decryptValue, isEncrypted } from './config';
import type {
  ChannelStatus,
  ChannelType,
  InboundMessage,
  OutboundMessage,
  TelegramConfig,
} from './types';

// Type definitions for node-telegram-bot-api
// We use dynamic import to avoid requiring the package at compile time
interface TelegramBotUser {
  id: number;
  first_name: string;
  username?: string;
  is_bot: boolean;
}

interface TelegramBotMessage {
  message_id: number;
  from?: TelegramBotUser;
  chat: {
    id: number;
    type: string;
  };
  date: number;
  text?: string;
  caption?: string;
  reply_to_message?: TelegramBotMessage;
  photo?: Array<{ file_id: string }>;
  voice?: { file_id: string; mime_type?: string };
  audio?: { file_id: string; mime_type?: string };
  document?: { file_id: string; file_name?: string; mime_type?: string };
}

interface TelegramBotPollingError {
  message: string;
  code?: string;
}

interface TelegramBotOptions {
  polling?: boolean;
  request?: {
    proxy?: string;
  };
}

interface TelegramBotSendOptions {
  reply_to_message_id?: number;
  parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2';
}

interface TelegramBotInstance {
  getMe(): Promise<TelegramBotUser>;
  stopPolling(): Promise<void>;
  sendMessage(
    chatId: number | string,
    text: string,
    options?: TelegramBotSendOptions
  ): Promise<TelegramBotMessage>;
  on(event: 'message', callback: (msg: TelegramBotMessage) => void): void;
  on(event: 'polling_error', callback: (error: TelegramBotPollingError) => void): void;
}

interface TelegramBotConstructor {
  new (token: string, options?: TelegramBotOptions): TelegramBotInstance;
}

/**
 * Telegram channel using long polling
 */
export class TelegramChannel extends BaseChannel {
  readonly type: ChannelType = 'telegram';
  declare readonly config: TelegramConfig;

  private bot: TelegramBotInstance | null = null;
  private botInfo?: TelegramBotUser;

  constructor(id: string, config: TelegramConfig) {
    super(id, config);
  }

  async connect(): Promise<void> {
    const token = this.getDecryptedToken();
    if (!token) {
      throw new Error('Telegram bot token not configured');
    }

    try {
      // Dynamic import to avoid requiring the package at compile time
      const TelegramBot = await this.importTelegramBot();

      const options: TelegramBotOptions = {
        polling: true,
      };

      // Configure proxy if specified
      if (this.config.proxy) {
        options.request = {
          proxy: this.config.proxy,
        };
      }

      this.bot = new TelegramBot(token, options);
      this.botInfo = await this.bot.getMe();

      // Set up message handler
      this.bot.on('message', (msg: TelegramBotMessage) => this.handleMessage(msg));
      this.bot.on('polling_error', (error: TelegramBotPollingError) => {
        this.logError('Polling error', error);
      });

      this._connected = true;
      this.logInfo(`Connected as @${this.botInfo.username}`);
    } catch (error) {
      this.logError('Failed to connect', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.bot) {
      try {
        await this.bot.stopPolling();
      } catch (error) {
        this.logError('Error stopping polling', error);
      }
      this.bot = null;
    }
    this._connected = false;
    this.logInfo('Disconnected');
  }

  async sendMessage(msg: OutboundMessage): Promise<void> {
    if (!this.bot) {
      throw new Error('Bot not connected');
    }

    const options: TelegramBotSendOptions = {};
    if (msg.replyTo) {
      options.reply_to_message_id = parseInt(msg.replyTo, 10);
    }

    try {
      // Try to send with HTML formatting
      options.parse_mode = 'HTML';
      const htmlContent = this.markdownToTelegramHtml(msg.content);
      await this.bot.sendMessage(msg.chatId, htmlContent, options);
    } catch (error) {
      // Fallback to plain text if HTML parsing fails
      this.logError('HTML parse failed, falling back to plain text', error);
      try {
        delete options.parse_mode;
        await this.bot.sendMessage(msg.chatId, msg.content, options);
      } catch (e2) {
        this.logError('Error sending message', e2);
        throw e2;
      }
    }
  }

  getStatus(): ChannelStatus {
    return {
      connected: this._connected,
      identifier: this.botInfo ? `@${this.botInfo.username}` : undefined,
      lastError: this._lastError,
      lastMessageAt: this._lastMessageAt,
    };
  }

  private async importTelegramBot(): Promise<TelegramBotConstructor> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const module = await import('node-telegram-bot-api') as any;
      return module.default || module;
    } catch {
      throw new Error(
        'node-telegram-bot-api is not installed. Run: npm install node-telegram-bot-api'
      );
    }
  }

  private getDecryptedToken(): string | null {
    const token = this.config.token;
    if (!token) {
      return null;
    }
    return isEncrypted(token) ? decryptValue(token) : token;
  }

  private handleMessage(msg: TelegramBotMessage): void {
    const user = msg.from;
    if (!user) {
      return;
    }

    // Build sender ID with username for allowlist compatibility
    let senderId = String(user.id);
    if (user.username) {
      senderId = `${senderId}|${user.username}`;
    }

    // Build content from text and/or media
    const contentParts: string[] = [];
    const mediaPaths: string[] = [];

    if (msg.text) {
      contentParts.push(msg.text);
    }
    if (msg.caption) {
      contentParts.push(msg.caption);
    }

    // Note: Full media handling would require downloading files
    // For now, we just note the presence of media
    if (msg.photo) {
      contentParts.push('[image attached]');
    }
    if (msg.voice) {
      contentParts.push('[voice message]');
    }
    if (msg.audio) {
      contentParts.push('[audio file]');
    }
    if (msg.document) {
      contentParts.push(`[file: ${msg.document.file_name || 'document'}]`);
    }

    const content = contentParts.length > 0 ? contentParts.join('\n') : '[empty message]';

    const inbound: InboundMessage = {
      channel: this.id,
      channelType: 'telegram',
      senderId,
      senderName: user.username || user.first_name,
      chatId: String(msg.chat.id),
      content,
      media: mediaPaths.length > 0 ? mediaPaths.map(p => ({ type: 'file' as const, url: p })) : undefined,
      replyTo: msg.reply_to_message?.message_id?.toString(),
      timestamp: msg.date * 1000,
      metadata: {
        messageId: msg.message_id,
        userId: user.id,
        username: user.username,
        firstName: user.first_name,
        isGroup: msg.chat.type !== 'private',
      },
    };

    this.handleInboundMessage(inbound);
  }

  /**
   * Convert markdown to Telegram-safe HTML
   */
  private markdownToTelegramHtml(text: string): string {
    if (!text) {
      return '';
    }

    // Extract and protect code blocks
    const codeBlocks: string[] = [];
    const saveCodeBlock = (match: string, code: string): string => {
      codeBlocks.push(code);
      return `\x00CB${codeBlocks.length - 1}\x00`;
    };
    text = text.replace(/```[\w]*\n?([\s\S]*?)```/g, saveCodeBlock);

    // Extract and protect inline code
    const inlineCodes: string[] = [];
    const saveInlineCode = (match: string, code: string): string => {
      inlineCodes.push(code);
      return `\x00IC${inlineCodes.length - 1}\x00`;
    };
    text = text.replace(/`([^`]+)`/g, saveInlineCode);

    // Headers -> just the title text
    text = text.replace(/^#{1,6}\s+(.+)$/gm, '$1');

    // Blockquotes -> just the text
    text = text.replace(/^>\s*(.*)$/gm, '$1');

    // Escape HTML special characters
    text = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // Links [text](url)
    text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

    // Bold **text** or __text__
    text = text.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
    text = text.replace(/__(.+?)__/g, '<b>$1</b>');

    // Italic _text_ (avoid matching inside words)
    text = text.replace(/(?<![a-zA-Z0-9])_([^_]+)_(?![a-zA-Z0-9])/g, '<i>$1</i>');

    // Strikethrough ~~text~~
    text = text.replace(/~~(.+?)~~/g, '<s>$1</s>');

    // Bullet lists
    text = text.replace(/^[-*]\s+/gm, '\u2022 ');

    // Restore inline code with HTML tags
    for (let i = 0; i < inlineCodes.length; i++) {
      const escaped = inlineCodes[i]
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      text = text.replace(`\x00IC${i}\x00`, `<code>${escaped}</code>`);
    }

    // Restore code blocks with HTML tags
    for (let i = 0; i < codeBlocks.length; i++) {
      const escaped = codeBlocks[i]
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      text = text.replace(`\x00CB${i}\x00`, `<pre><code>${escaped}</code></pre>`);
    }

    return text;
  }
}
