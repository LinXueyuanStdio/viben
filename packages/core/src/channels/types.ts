/**
 * Channel Types for Viben
 *
 * Types for communication channels (Telegram, Discord, Feishu, WhatsApp, Slack, Webhook)
 */

/**
 * Supported channel types
 */
export type ChannelType =
  | "telegram"
  | "discord"
  | "feishu"
  | "whatsapp"
  | "slack"
  | "webhook";

/**
 * Binding type for agent/executor
 */
export type BindingType = "agent" | "executor";

/**
 * Agent or executor binding for a channel
 * Allows binding a channel to a specific agent or executor for automated handling
 */
export interface AgentBinding {
  /** Type of binding: agent or executor */
  binding_type: BindingType;
  /** Agent/executor ID */
  id: string;
  /** Display name */
  name: string;
  /** Workspace path (for executor bindings) */
  workspace_path?: string;
}

/**
 * Channel type metadata
 */
export interface ChannelTypeInfo {
  id: ChannelType;
  name: string;
  description: string;
  setupDifficulty: "easy" | "medium" | "hard";
}

/**
 * All supported channel types with metadata
 */
export const CHANNEL_TYPES: ChannelTypeInfo[] = [
  {
    id: "telegram",
    name: "Telegram Bot API",
    description: "Send messages via Telegram Bot",
    setupDifficulty: "easy",
  },
  {
    id: "discord",
    name: "Discord Bot API",
    description: "Send messages via Discord Bot",
    setupDifficulty: "easy",
  },
  {
    id: "feishu",
    name: "Feishu (Lark) Open Platform",
    description: "Send messages via Feishu/Lark",
    setupDifficulty: "medium",
  },
  {
    id: "whatsapp",
    name: "WhatsApp Web Bridge",
    description: "Send messages via WhatsApp bridge",
    setupDifficulty: "medium",
  },
  {
    id: "slack",
    name: "Slack Web API",
    description: "Send messages via Slack",
    setupDifficulty: "medium",
  },
  {
    id: "webhook",
    name: "Generic Webhook",
    description: "Send messages via HTTP webhook",
    setupDifficulty: "easy",
  },
];

/**
 * Notification mode for channel messages
 */
export type NotificationMode = "none" | "in_app" | "system" | "both";

/**
 * Base channel configuration (shared fields)
 */
export interface BaseChannelConfig {
  id: string;
  name: string;
  type: ChannelType;
  enabled: boolean;
  created_at: number;
  updated_at?: number;
  allow_from: string[];
  notification_mode?: NotificationMode;
}

/**
 * Telegram channel configuration
 */
export interface TelegramChannelConfig extends BaseChannelConfig {
  type: "telegram";
  token: string;
  proxy?: string;
}

/**
 * Discord channel configuration
 */
export interface DiscordChannelConfig extends BaseChannelConfig {
  type: "discord";
  token: string;
  gateway_url?: string;
  intents?: number;
}

/**
 * Feishu channel configuration
 */
export interface FeishuChannelConfig extends BaseChannelConfig {
  type: "feishu";
  app_id: string;
  app_secret: string;
  encrypt_key?: string;
  verification_token?: string;
}

/**
 * WhatsApp channel configuration
 */
export interface WhatsAppChannelConfig extends BaseChannelConfig {
  type: "whatsapp";
  bridge_url: string;
}

/**
 * Slack channel configuration
 */
export interface SlackChannelConfig extends BaseChannelConfig {
  type: "slack";
  token: string;
  channel_id?: string;
}

/**
 * Webhook channel configuration
 */
export interface WebhookChannelConfig extends BaseChannelConfig {
  type: "webhook";
  url: string;
  method?: "POST" | "PUT";
  headers?: Record<string, string>;
}

/**
 * Union type for all channel configurations
 */
export type ChannelConfig =
  | TelegramChannelConfig
  | DiscordChannelConfig
  | FeishuChannelConfig
  | WhatsAppChannelConfig
  | SlackChannelConfig
  | WebhookChannelConfig;

/**
 * Channel entry as stored in YAML file (without id, which is the key)
 */
export interface ChannelEntry {
  type: ChannelType;
  name: string;
  enabled: boolean;
  created_at: number;
  updated_at?: number;
  allow_from?: string[];
  notification_mode?: NotificationMode;
  /** Bound agent or executor */
  agent_binding?: AgentBinding;
  // Type-specific fields
  token?: string;
  proxy?: string;
  gateway_url?: string;
  intents?: number;
  app_id?: string;
  app_secret?: string;
  encrypt_key?: string;
  verification_token?: string;
  bridge_url?: string;
  channel_id?: string;
  url?: string;
  method?: string;
  headers?: Record<string, string>;
  // Allow dynamic property assignment for configuration updates
  [key: string]: unknown;
}

/**
 * Channels file structure (YAML)
 */
export interface ChannelsFile {
  version: number;
  default?: string;
  channels: Record<string, ChannelEntry>;
}

/**
 * Connection status for a channel
 */
export type ConnectionStatus = "connected" | "disconnected" | "error" | "disabled";

/**
 * Channel status with connection info
 */
export interface ChannelStatus {
  id: string;
  type: ChannelType;
  name: string;
  enabled: boolean;
  is_default: boolean;
  status: ConnectionStatus;
  details?: string;
  error?: string;
  latency_ms?: number;
  checked_at: number;
}

/**
 * Options for creating a channel
 */
export interface CreateChannelOptions {
  id?: string;
  name: string;
  type: ChannelType;
  enabled?: boolean;
  set_as_default?: boolean;
  allow_from?: string[];
  notification_mode?: NotificationMode;
  /** Agent or executor to bind */
  agent_binding?: AgentBinding;
  // Type-specific fields
  token?: string;
  proxy?: string;
  gateway_url?: string;
  intents?: number;
  app_id?: string;
  app_secret?: string;
  encrypt_key?: string;
  verification_token?: string;
  bridge_url?: string;
  channel_id?: string;
  url?: string;
  method?: "POST" | "PUT";
  headers?: Record<string, string>;
}

/**
 * Options for updating a channel
 */
export interface UpdateChannelOptions {
  name?: string;
  enabled?: boolean;
  set_as_default?: boolean;
  allow_from?: string[];
  notification_mode?: NotificationMode;
  /** Update agent binding (use null to clear) */
  agent_binding?: AgentBinding | null;
  // Type-specific fields
  token?: string;
  proxy?: string;
  gateway_url?: string;
  intents?: number;
  app_id?: string;
  app_secret?: string;
  encrypt_key?: string;
  verification_token?: string;
  bridge_url?: string;
  channel_id?: string;
  url?: string;
  method?: "POST" | "PUT";
  headers?: Record<string, string>;
}

/**
 * Options for sending a message
 */
export interface SendMessageOptions {
  /** Target chat/channel/user ID */
  chatId: string;
  /** Message content */
  message: string;
  /** Parse mode for formatting (Telegram/Discord) */
  parseMode?: "text" | "markdown" | "html";
}

/**
 * Result of sending a message
 */
export interface SendMessageResult {
  success: boolean;
  error?: string;
  messageId?: string;
}

/**
 * Result of testing a channel
 */
export interface TestChannelResult {
  success: boolean;
  error?: string;
  details?: string;
}

/**
 * Channel with full configuration (for API responses)
 */
export interface Channel {
  id: string;
  type: ChannelType;
  name: string;
  enabled: boolean;
  is_default: boolean;
  created_at: number;
  updated_at?: number;
  allow_from: string[];
  notification_mode: NotificationMode;
  /** Bound agent or executor */
  agent_binding?: AgentBinding;
  config: Omit<ChannelEntry, "type" | "name" | "enabled" | "created_at" | "updated_at" | "allow_from" | "notification_mode" | "agent_binding">;
}
