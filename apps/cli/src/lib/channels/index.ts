/**
 * Channels Module
 *
 * Multi-platform message channel support for Viben CLI.
 * Supports Telegram, Discord, Feishu (Lark), and WhatsApp (planned).
 *
 * @example
 * ```typescript
 * import { ChannelManager } from '@viben/cli/lib/channels';
 *
 * const manager = new ChannelManager();
 * await manager.initialize();
 * await manager.connectAll();
 *
 * manager.onMessage((msg) => {
 *   console.log(`[${msg.channelType}] ${msg.senderName}: ${msg.content}`);
 * });
 * ```
 */

// Base types and interfaces
export {
  type Channel,
  type ChannelConfig,
  type ChannelStatus,
  type ChannelType,
  type InboundMessage,
  type MediaAttachment,
  type OutboundMessage,
  BaseChannel,
} from "./base.js";

// Configuration utilities
export {
  type ChannelsConfigFile,
  getConfigDir,
  getConfigPath,
  ensureConfigDir,
  encryptValue,
  decryptValue,
  isEncrypted,
  loadConfig,
  saveConfig,
  createDefaultConfig,
  getChannelConfig,
  setChannelConfig,
  removeChannelConfig,
  setDefaultChannel,
  getEnabledChannels,
  validateChannelConfig,
  createChannelTemplate,
} from "./config.js";

// Channel Manager
export {
  ChannelManager,
  type ChannelManagerOptions,
  type ChannelManagerStatus,
} from "./manager.js";

// Channel implementations
export { TelegramChannel, type TelegramConfig } from "./telegram.js";
export { DiscordChannel, type DiscordConfig } from "./discord.js";
export { FeishuChannel, type FeishuConfig, type FeishuMessageEvent } from "./feishu.js";
