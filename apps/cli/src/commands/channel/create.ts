/**
 * viben channel create - Create a new channel
 */

import chalk from 'chalk';
import type { OutputContext } from '../../types';
import { CliError } from '../../types';
import { output, successResponse } from '../../lib/output';
import {
  createChannelConfig,
  setChannelConfig,
  validateChannelId,
  channelExists,
  setDefaultChannel,
  getDefaultChannelId,
} from '../../lib/channels';
import type { ChannelType } from '../../lib/channels';

export interface CreateChannelOptions {
  name: string;
  type: ChannelType;
  token?: string;
  appId?: string;
  appSecret?: string;
  encryptKey?: string;
  verificationToken?: string;
  allowFrom?: string;
  proxy?: string;
  enabled?: boolean;
  setDefault?: boolean;
}

/**
 * Create a new channel
 */
export function createChannel(ctx: OutputContext, options: CreateChannelOptions): void {
  const { name, type } = options;

  // Validate channel ID
  validateChannelId(name);

  // Check if channel already exists
  if (channelExists(name)) {
    throw new CliError(`Channel "${name}" already exists`, 'CHANNEL_EXISTS');
  }

  // Validate required options based on type
  validateTypeOptions(type, options);

  // Parse allowFrom if provided
  let allowFrom: string[] | undefined;
  if (options.allowFrom) {
    try {
      allowFrom = JSON.parse(options.allowFrom);
    } catch {
      // Treat as comma-separated list
      allowFrom = options.allowFrom.split(',').map((s) => s.trim());
    }
  }

  // Create the channel configuration
  const channelConfig = createChannelConfig(name, type, {
    token: options.token,
    appId: options.appId,
    appSecret: options.appSecret,
    encryptKey: options.encryptKey,
    verificationToken: options.verificationToken,
    allowFrom,
    proxy: options.proxy,
    enabled: options.enabled ?? true,
  });

  // Save the configuration
  setChannelConfig(name, channelConfig);

  // Set as default if requested or if it's the first channel
  const currentDefault = getDefaultChannelId();
  if (options.setDefault || !currentDefault) {
    setDefaultChannel(name);
  }

  const response = successResponse({
    id: name,
    type,
    enabled: channelConfig.enabled,
    isDefault: options.setDefault || !currentDefault,
  });

  output(ctx, response, () => {
    console.log(chalk.green('\u2713') + ` Created channel ${chalk.cyan(name)}`);
    console.log();
    console.log(`  Type:    ${type}`);
    console.log(`  Enabled: ${channelConfig.enabled ? 'yes' : 'no'}`);

    if (options.setDefault || !currentDefault) {
      console.log(`  Default: yes`);
    }

    console.log();
    console.log('Next steps:');
    console.log(chalk.gray(`  viben channel status -n ${name}  # Check connection status`));
    console.log(chalk.gray(`  viben gateway                    # Start gateway to use channel`));
  });
}

/**
 * Validate type-specific options
 */
function validateTypeOptions(type: ChannelType, options: CreateChannelOptions): void {
  switch (type) {
    case 'telegram':
      if (!options.token) {
        throw new CliError(
          'Token is required for Telegram channels (--token)',
          'MISSING_TOKEN'
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

    case 'whatsapp':
      // WhatsApp doesn't require initial credentials
      break;

    default:
      throw new CliError(`Unknown channel type: ${type}`, 'UNKNOWN_CHANNEL_TYPE');
  }
}
