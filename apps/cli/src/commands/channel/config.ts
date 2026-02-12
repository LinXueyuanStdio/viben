/**
 * viben channel config - Configure channel settings
 *
 * Uses NAPI bindings to Rust viben-core.
 */

import chalk from 'chalk';
import type { OutputContext } from '../../types';
import { CliError } from '../../types';
import { output, successResponse } from '../../lib/output';
import {
  channelGet,
  channelUpdate,
  type UpdateChannelOptions,
} from '../../lib/native';

export interface ConfigOptions {
  name: string;
  key?: string;
  value?: string;
}

/**
 * Show or set channel configuration
 */
export async function configureChannel(ctx: OutputContext, options: ConfigOptions): Promise<void> {
  const { name, key, value } = options;

  if (key && value !== undefined) {
    // Set a configuration value
    await setConfigValue(ctx, name, key, value);
  } else {
    // Show configuration
    await showConfig(ctx, name);
  }
}

/**
 * Show channel configuration
 */
async function showConfig(ctx: OutputContext, name: string): Promise<void> {
  const channel = await channelGet(name);
  if (!channel) {
    throw new CliError(`Channel "${name}" not found`, 'CHANNEL_NOT_FOUND');
  }

  const response = successResponse({
    id: channel.id,
    name: channel.name,
    type: channel.channelType,
    enabled: channel.enabled,
    isDefault: channel.isDefault,
    notificationMode: channel.notificationMode,
    agentBinding: channel.agentBinding,
  });

  output(ctx, response, () => {
    console.log(chalk.bold(`Channel: ${channel.name}`));
    console.log();
    console.log(`  ${chalk.cyan('id')}: ${channel.id}`);
    console.log(`  ${chalk.cyan('type')}: ${channel.channelType}`);
    console.log(`  ${chalk.cyan('enabled')}: ${channel.enabled ? chalk.green('true') : chalk.gray('false')}`);
    console.log(`  ${chalk.cyan('isDefault')}: ${channel.isDefault ? chalk.yellow('true') : 'false'}`);
    console.log(`  ${chalk.cyan('notificationMode')}: ${channel.notificationMode}`);

    if (channel.agentBinding) {
      console.log(`  ${chalk.cyan('agentBinding')}:`);
      console.log(`    type: ${channel.agentBinding.bindingType}`);
      console.log(`    id: ${channel.agentBinding.id}`);
      console.log(`    name: ${channel.agentBinding.name}`);
    }

    console.log();
    console.log(chalk.gray('To update a setting:'));
    console.log(chalk.gray(`  viben channel config -n ${name} set <key> <value>`));
  });
}

/**
 * Set a configuration value
 */
async function setConfigValue(
  ctx: OutputContext,
  name: string,
  key: string,
  value: string
): Promise<void> {
  // Build update options based on key
  const updateOptions: UpdateChannelOptions = {};

  switch (key) {
    case 'name':
      updateOptions.name = value;
      break;
    case 'enabled':
      updateOptions.enabled = value === 'true' || value === '1' || value === 'yes';
      break;
    case 'notificationMode':
      updateOptions.notificationMode = value;
      break;
    case 'setAsDefault':
      updateOptions.setAsDefault = value === 'true' || value === '1' || value === 'yes';
      break;
    // Config options - need to specify which channel type field to update
    case 'telegramToken':
    case 'telegramChatId':
    case 'telegramProxy':
    case 'discordToken':
    case 'feishuAppId':
    case 'feishuAppSecret':
    case 'whatsappBridgeUrl':
    case 'slackToken':
    case 'webhookUrl':
    case 'webhookMethod':
      updateOptions.config = { [key]: value };
      break;
    default:
      throw new CliError(
        `Unknown configuration key: ${key}. Allowed keys: name, enabled, notificationMode, setAsDefault, telegramToken, telegramChatId, telegramProxy, discordToken, feishuAppId, feishuAppSecret, whatsappBridgeUrl, slackToken, webhookUrl, webhookMethod`,
        'INVALID_CONFIG_KEY'
      );
  }

  // Update the channel
  await channelUpdate(name, updateOptions);

  const response = successResponse({
    id: name,
    key,
    updated: true,
  });

  output(ctx, response, () => {
    // Mask sensitive values in output
    const sensitiveKeys = ['telegramToken', 'discordToken', 'feishuAppSecret', 'slackToken'];
    const displayValue = sensitiveKeys.includes(key) ? '********' : value;
    console.log(
      chalk.green('\u2713') +
        ` Updated ${chalk.cyan(key)} for channel ${chalk.cyan(name)}: ${displayValue}`
    );
  });
}
