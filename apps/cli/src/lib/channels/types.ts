/**
 * Channel type definitions for Viben CLI
 *
 * Defines the base interfaces for chat channel implementations.
 */

/**
 * Supported channel types
 */
export type ChannelType = 'telegram' | 'discord' | 'whatsapp' | 'feishu';

/**
 * Base channel configuration
 */
export interface ChannelConfig {
  id: string;
  type: ChannelType;
  enabled: boolean;
  token?: string;
  allowFrom?: string[];
  proxy?: string;
  // Type-specific configuration
  [key: string]: unknown;
}

/**
 * Telegram-specific configuration
 */
export interface TelegramConfig extends ChannelConfig {
  type: 'telegram';
  token: string;
  allowFrom?: string[];
  proxy?: string;
}

/**
 * Discord-specific configuration
 */
export interface DiscordConfig extends ChannelConfig {
  type: 'discord';
  token: string;
  gatewayUrl?: string;
  intents?: number;
  allowFrom?: string[];
}

/**
 * WhatsApp-specific configuration
 */
export interface WhatsAppConfig extends ChannelConfig {
  type: 'whatsapp';
  bridgeUrl?: string;
  allowFrom?: string[];
}

/**
 * Feishu-specific configuration
 */
export interface FeishuConfig extends ChannelConfig {
  type: 'feishu';
  appId: string;
  appSecret: string;
  encryptKey?: string;
  verificationToken?: string;
  allowFrom?: string[];
}

/**
 * Media attachment in messages
 */
export interface MediaAttachment {
  type: 'image' | 'audio' | 'video' | 'file';
  url: string;
  filename?: string;
  mimeType?: string;
}

/**
 * Inbound message from a channel
 */
export interface InboundMessage {
  channel: string;
  channelType: ChannelType;
  senderId: string;
  senderName?: string;
  chatId: string;
  content: string;
  media?: MediaAttachment[];
  replyTo?: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

/**
 * Outbound message to a channel
 */
export interface OutboundMessage {
  chatId: string;
  content: string;
  replyTo?: string;
  media?: MediaAttachment[];
}

/**
 * Channel connection status
 */
export interface ChannelStatus {
  connected: boolean;
  identifier?: string;
  lastError?: string;
  lastMessageAt?: number;
}

/**
 * Channel interface
 */
export interface Channel {
  readonly id: string;
  readonly type: ChannelType;
  readonly config: ChannelConfig;

  // Lifecycle
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;

  // Message handling
  onMessage(callback: (msg: InboundMessage) => void): void;
  sendMessage(msg: OutboundMessage): Promise<void>;

  // Status
  getStatus(): ChannelStatus;
}

/**
 * Channels configuration file structure
 */
export interface ChannelsConfig {
  version: number;
  default?: string;
  channels: Record<string, ChannelConfig>;
}

/**
 * Default Discord gateway URL
 */
export const DEFAULT_DISCORD_GATEWAY = 'wss://gateway.discord.gg/?v=10&encoding=json';

/**
 * Default Discord intents (GUILDS + GUILD_MESSAGES + DIRECT_MESSAGES + MESSAGE_CONTENT)
 */
export const DEFAULT_DISCORD_INTENTS = 37377;
