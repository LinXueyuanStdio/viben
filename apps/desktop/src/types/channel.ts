/**
 * Channel configuration types
 * Based on nanobot channel architecture
 */

export interface TelegramConfig {
  enabled: boolean;
  token: string;
  allow_from: string[];
  proxy?: string;
}

export interface DiscordConfig {
  enabled: boolean;
  token: string;
  allow_from: string[];
  gateway_url: string;
  intents: number;
}

export interface FeishuConfig {
  enabled: boolean;
  app_id: string;
  app_secret: string;
  encrypt_key: string;
  verification_token: string;
  allow_from: string[];
}

export interface WhatsAppConfig {
  enabled: boolean;
  bridge_url: string;
  allow_from: string[];
}

export interface ChannelsConfig {
  telegram: TelegramConfig;
  discord: DiscordConfig;
  feishu: FeishuConfig;
  whatsapp: WhatsAppConfig;
}

// Default configurations
export const DEFAULT_TELEGRAM_CONFIG: TelegramConfig = {
  enabled: false,
  token: "",
  allow_from: [],
  proxy: undefined,
};

export const DEFAULT_DISCORD_CONFIG: DiscordConfig = {
  enabled: false,
  token: "",
  allow_from: [],
  gateway_url: "wss://gateway.discord.gg/?v=10&encoding=json",
  intents: 37377, // GUILDS + GUILD_MESSAGES + DIRECT_MESSAGES + MESSAGE_CONTENT
};

export const DEFAULT_FEISHU_CONFIG: FeishuConfig = {
  enabled: false,
  app_id: "",
  app_secret: "",
  encrypt_key: "",
  verification_token: "",
  allow_from: [],
};

export const DEFAULT_WHATSAPP_CONFIG: WhatsAppConfig = {
  enabled: false,
  bridge_url: "ws://localhost:3001",
  allow_from: [],
};

export const DEFAULT_CHANNELS_CONFIG: ChannelsConfig = {
  telegram: DEFAULT_TELEGRAM_CONFIG,
  discord: DEFAULT_DISCORD_CONFIG,
  feishu: DEFAULT_FEISHU_CONFIG,
  whatsapp: DEFAULT_WHATSAPP_CONFIG,
};
