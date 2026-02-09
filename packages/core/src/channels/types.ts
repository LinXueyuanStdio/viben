/**
 * Channel Types for Viben
 *
 * Types for communication channels (Telegram, Discord, Feishu, WhatsApp)
 */

export type ChannelType = "telegram" | "discord" | "feishu" | "whatsapp";

export interface BaseChannelConfig {
  id: string;
  name: string;
  type: ChannelType;
  enabled: boolean;
  created_at: number;
  allow_from: string[];
}

export interface TelegramChannelConfig extends BaseChannelConfig {
  type: "telegram";
  token: string;
  proxy?: string;
}

export interface DiscordChannelConfig extends BaseChannelConfig {
  type: "discord";
  token: string;
  gateway_url?: string;
  intents?: number;
}

export interface FeishuChannelConfig extends BaseChannelConfig {
  type: "feishu";
  app_id: string;
  app_secret: string;
  encrypt_key?: string;
  verification_token?: string;
}

export interface WhatsAppChannelConfig extends BaseChannelConfig {
  type: "whatsapp";
  bridge_url: string;
}

export type ChannelConfig =
  | TelegramChannelConfig
  | DiscordChannelConfig
  | FeishuChannelConfig
  | WhatsAppChannelConfig;

export interface ChannelsFile {
  version: number;
  channels: Record<string, ChannelConfig>;
  default?: string;
}

export interface SendMessageOptions {
  /** Target chat/channel/user ID */
  chatId: string;
  /** Message content */
  message: string;
  /** Parse mode for formatting (Telegram/Discord) */
  parseMode?: "text" | "markdown" | "html";
}

export interface SendMessageResult {
  success: boolean;
  error?: string;
  messageId?: string;
}

export interface TestChannelResult {
  success: boolean;
  error?: string;
  details?: string;
}
