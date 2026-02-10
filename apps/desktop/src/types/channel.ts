/**
 * Channel configuration types
 * Based on nanobot channel architecture
 * Supports multiple instances of the same channel type
 */

/** Channel type identifiers (matches backend ChannelType) */
export type ChannelType = "telegram" | "discord" | "feishu" | "whatsapp" | "slack" | "webhook";

/** Notification target type */
export type NotificationType = "in_app" | "system" | "channel";

// ============================================================================
// Gateway API Types (matches Rust backend)
// ============================================================================

/** Notification mode for channel messages (matches backend NotificationMode) */
export type NotificationMode = "none" | "in_app" | "system" | "both";

/** Binding type for agent/executor (matches backend BindingType) */
export type BindingType = "agent" | "executor";

/** Agent or executor binding for a channel (matches backend AgentBinding) */
export interface AgentBinding {
  binding_type: BindingType;
  id: string;
  name: string;
  workspace_path?: string;
}

/** Channel config union type (matches backend ChannelConfig) */
export type ChannelConfig =
  | { type: "none" }
  | { type: "telegram"; token?: string; proxy?: string }
  | { type: "discord"; token?: string }
  | { type: "feishu"; app_id?: string; app_secret?: string }
  | { type: "whatsapp"; bridge_url?: string }
  | { type: "slack"; token?: string }
  | { type: "webhook"; url?: string; method?: string; headers?: Record<string, string> };

/** Channel from Gateway API (matches backend Channel struct) */
export interface GatewayChannel {
  id: string;
  channel_type: ChannelType;
  name: string;
  config: ChannelConfig;
  is_default: boolean;
  enabled: boolean;
  notification_mode: NotificationMode;
  agent_binding?: AgentBinding;
  created_at: string; // ISO timestamp
  updated_at: string; // ISO timestamp
}

/** Request to create a channel (matches backend CreateChannelOptions) */
export interface CreateChannelRequest {
  channel_type: ChannelType;
  name: string;
  config?: ChannelConfig;
  set_as_default?: boolean;
  notification_mode?: NotificationMode;
  agent_binding?: AgentBinding;
}

/** Request to update a channel (matches backend ChannelUpdate) */
export interface UpdateChannelRequest {
  name?: string;
  config?: ChannelConfig;
  enabled?: boolean;
  notification_mode?: NotificationMode;
  agent_binding?: AgentBinding | null; // null to clear
  set_as_default?: boolean;
}

/** Response from list channels API */
export interface ListChannelsResponse {
  channels: GatewayChannel[];
}

/** Test channel result (matches backend TestChannelResult) */
export interface TestChannelResult {
  success: boolean;
  details?: string;
  error?: string;
}

/** Send message result (matches backend SendMessageResult) */
export interface SendMessageResult {
  success: boolean;
  message_id?: string;
  error?: string;
}

/** Base channel instance interface */
export interface BaseChannelInstance {
  /** Unique instance ID */
  id: string;
  /** Display name for this instance */
  name: string;
  /** Channel type */
  type: ChannelType;
  /** Whether this instance is enabled */
  enabled: boolean;
  /** Creation timestamp */
  created_at: number;
}

/** Telegram channel instance */
export interface TelegramInstance extends BaseChannelInstance {
  type: "telegram";
  token: string;
  allow_from: string[];
  proxy?: string;
}

/** Discord channel instance */
export interface DiscordInstance extends BaseChannelInstance {
  type: "discord";
  token: string;
  allow_from: string[];
  gateway_url: string;
  intents: number;
}

/** Feishu channel instance */
export interface FeishuInstance extends BaseChannelInstance {
  type: "feishu";
  app_id: string;
  app_secret: string;
  encrypt_key: string;
  verification_token: string;
  allow_from: string[];
}

/** WhatsApp channel instance */
export interface WhatsAppInstance extends BaseChannelInstance {
  type: "whatsapp";
  bridge_url: string;
  allow_from: string[];
}

/** Union type for all channel instances */
export type ChannelInstance =
  | TelegramInstance
  | DiscordInstance
  | FeishuInstance
  | WhatsAppInstance;

/** Notification settings for cron jobs */
export interface NotificationSettings {
  /** Enable in-app notifications */
  in_app: boolean;
  /** Enable system notifications (OS-level) */
  system: boolean;
  /** Channel instance IDs to notify */
  channel_ids: string[];
}

/** Default notification settings */
export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  in_app: true,
  system: false,
  channel_ids: [],
};

/** Channels storage config */
export interface ChannelsStorage {
  /** All channel instances */
  instances: ChannelInstance[];
}

/** Default channels storage */
export const DEFAULT_CHANNELS_STORAGE: ChannelsStorage = {
  instances: [],
};

// ============================================================================
// Legacy types (for backward compatibility)
// ============================================================================

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

// ============================================================================
// Helper functions
// ============================================================================

/** Get channel type display name */
export function getChannelTypeName(type: ChannelType): string {
  const names: Record<ChannelType, string> = {
    telegram: "Telegram",
    discord: "Discord",
    feishu: "飞书",
    whatsapp: "WhatsApp",
    slack: "Slack",
    webhook: "Webhook",
  };
  return names[type];
}

/** Create default instance config for a channel type (legacy) */
export function createDefaultInstance(
  type: ChannelType,
  id: string,
  name: string
): ChannelInstance | null {
  const now = Date.now();
  const base = { id, name, type, enabled: false, created_at: now };

  switch (type) {
    case "telegram":
      return { ...base, type: "telegram", token: "", allow_from: [] };
    case "discord":
      return {
        ...base,
        type: "discord",
        token: "",
        allow_from: [],
        gateway_url: "wss://gateway.discord.gg/?v=10&encoding=json",
        intents: 37377,
      };
    case "feishu":
      return {
        ...base,
        type: "feishu",
        app_id: "",
        app_secret: "",
        encrypt_key: "",
        verification_token: "",
        allow_from: [],
      };
    case "whatsapp":
      return {
        ...base,
        type: "whatsapp",
        bridge_url: "ws://localhost:3001",
        allow_from: [],
      };
    default:
      return null;
  }
}
