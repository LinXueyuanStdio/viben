/**
 * viben channel create - Create a new channel
 *
 * Uses NAPI bindings to Rust viben-core.
 */

import chalk from 'chalk';
import type { OutputContext } from '../../types';
import { CliError } from '../../types';
import { output, successResponse } from '../../lib/output';
import {
  channelCreate,
  type CreateChannelOptions as NapiCreateChannelOptions,
  type ChannelType,
} from '../../lib/native';

export interface CreateChannelOptions {
  name: string;
  type: string;
  token?: string;
  chatId?: string;
  appId?: string;
  appSecret?: string;
  proxy?: string;
  webhookUrl?: string;
  bridgeUrl?: string;
  enabled?: boolean;
  setDefault?: boolean;
}

/**
 * Map CLI channel type to NAPI channel type
 */
function mapChannelType(type: string): ChannelType {
  const typeMap: Record<string, ChannelType> = {
    telegram: 'Telegram',
    discord: 'Discord',
    feishu: 'Feishu',
    whatsapp: 'WhatsApp',
    slack: 'Slack',
    webhook: 'Webhook',
  };

  const mapped = typeMap[type.toLowerCase()];
  if (!mapped) {
    throw new CliError(
      `Unknown channel type: ${type}. Valid types: telegram, discord, feishu, whatsapp, slack, webhook`,
      'UNKNOWN_CHANNEL_TYPE'
    );
  }
  return mapped;
}

/**
 * Create a new channel
 */
export async function createChannel(ctx: OutputContext, options: CreateChannelOptions): Promise<void> {
  const { name, type } = options;

  // Validate required options based on type
  validateTypeOptions(type, options);

  const channelType = mapChannelType(type);

  // Build create options
  const createOptions: NapiCreateChannelOptions = {
    channelType,
    name,
    setAsDefault: options.setDefault,
    config: {
      telegramToken: type.toLowerCase() === 'telegram' ? options.token : undefined,
      telegramChatId: options.chatId,
      telegramProxy: options.proxy,
      discordToken: type.toLowerCase() === 'discord' ? options.token : undefined,
      feishuAppId: options.appId,
      feishuAppSecret: options.appSecret,
      whatsappBridgeUrl: options.bridgeUrl,
      slackToken: type.toLowerCase() === 'slack' ? options.token : undefined,
      webhookUrl: options.webhookUrl,
    },
  };

  const channel = await channelCreate(createOptions);

  const response = successResponse({
    id: channel.id,
    name: channel.name,
    type: channel.channelType,
    enabled: channel.enabled,
    isDefault: channel.isDefault,
  });

  output(ctx, response, () => {
    console.log(chalk.green('\u2713') + ` Created channel ${chalk.cyan(channel.name)}`);
    console.log();
    console.log(`  ID:      ${channel.id}`);
    console.log(`  Type:    ${channel.channelType}`);
    console.log(`  Enabled: ${channel.enabled ? 'yes' : 'no'}`);

    if (channel.isDefault) {
      console.log(`  Default: yes`);
    }

    console.log();
    console.log('Next steps:');
    console.log(chalk.gray(`  viben channel status -n ${channel.id}  # Check connection status`));
    console.log(chalk.gray(`  viben gateway                          # Start gateway to use channel`));
  });
}

/**
 * Validate type-specific options
 */
function validateTypeOptions(type: string, options: CreateChannelOptions): void {
  const typeLower = type.toLowerCase();

  switch (typeLower) {
    case 'telegram':
      if (!options.token) {
        throw new CliError(
          'Token is required for Telegram channels (--token)',
          'MISSING_TOKEN'
        );
      }
      if (!options.chatId) {
        throw new CliError(
          'Chat ID is required for Telegram channels (--chat-id)',
          'MISSING_CHAT_ID'
        );
      }
      break;

    case 'discord':
      if (!options.token) {
        throw new CliError(
          'Token is required for Discord channels (--token)',
          'MISSING_TOKEN'
        );
      }
      break;

    case 'feishu':
      if (!options.appId || !options.appSecret) {
        throw new CliError(
          'App ID and App Secret are required for Feishu channels (--app-id, --app-secret)',
          'MISSING_CREDENTIALS'
        );
      }
      break;

    case 'slack':
      if (!options.token) {
        throw new CliError(
          'Token is required for Slack channels (--token)',
          'MISSING_TOKEN'
        );
      }
      break;

    case 'webhook':
      if (!options.webhookUrl) {
        throw new CliError(
          'URL is required for Webhook channels (--webhook-url)',
          'MISSING_URL'
        );
      }
      break;

    case 'whatsapp':
      // WhatsApp doesn't require initial credentials
      break;

    default:
      throw new CliError(`Unknown channel type: ${type}`, 'UNKNOWN_CHANNEL_TYPE');
  }
}
