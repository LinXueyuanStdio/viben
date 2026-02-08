/**
 * Channels module for Viben CLI
 *
 * Provides chat channel implementations for Telegram, Discord, Feishu, etc.
 */

// Export types
export type {
  ChannelType,
  ChannelConfig,
  TelegramConfig,
  DiscordConfig,
  WhatsAppConfig,
  FeishuConfig,
  MediaAttachment,
  InboundMessage,
  OutboundMessage,
  ChannelStatus,
  Channel,
  ChannelsConfig,
} from './types';

export {
  DEFAULT_DISCORD_GATEWAY,
  DEFAULT_DISCORD_INTENTS,
} from './types';

// Export base class
export { BaseChannel } from './base';

// Export channel implementations
export { TelegramChannel } from './telegram';
export { DiscordChannel } from './discord';
export { FeishuChannel } from './feishu';

// Export manager
export { ChannelManager } from './manager';

// Export config utilities
export {
  CHANNELS_FILE,
  DEFAULT_CHANNELS_CONFIG,
  getChannelsConfigPath,
  readChannelsConfig,
  writeChannelsConfig,
  getChannelConfig,
  setChannelConfig,
  deleteChannelConfig,
  listChannelConfigs,
  setChannelEnabled,
  setDefaultChannel,
  getDefaultChannelId,
  encryptValue,
  decryptValue,
  isEncrypted,
  createChannelConfig,
  updateChannelConfig,
  validateChannelId,
  channelExists,
} from './config';
