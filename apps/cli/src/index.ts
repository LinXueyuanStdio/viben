/**
 * Viben CLI
 *
 * Command-line interface for managing AI agent workspaces.
 *
 * @packageDocumentation
 */

export { createProgram, run } from './cli';
export { CliError } from './types';
export type {
  CliResponse,
  ConfigScope,
  VibenConfig,
  Agent,
  GlobalOptions,
  OutputContext,
} from './types';

// Export channel types and classes for external use
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
} from './lib/channels';

export {
  ChannelManager,
  TelegramChannel,
  DiscordChannel,
  FeishuChannel,
} from './lib/channels';
