/**
 * viben channel config - Configure channel settings
 */

import chalk from 'chalk';
import type { OutputContext } from '../../types';
import { CliError } from '../../types';
import { output, successResponse } from '../../lib/output';
import {
  getChannelConfig,
  updateChannelConfig,
  channelExists,
  isEncrypted,
} from '../../lib/channels';

export interface ConfigOptions {
  name: string;
  key?: string;
  value?: string;
}

/**
 * Show or set channel configuration
 */
export function configureChannel(ctx: OutputContext, options: ConfigOptions): void {
  const { name, key, value } = options;

  // Check if channel exists
  if (!channelExists(name)) {
    throw new CliError(`Channel "${name}" not found`, 'CHANNEL_NOT_FOUND');
  }

  if (key && value !== undefined) {
    // Set a configuration value
    setConfigValue(ctx, name, key, value);
  } else {
    // Show configuration
    showConfig(ctx, name);
  }
}

/**
 * Show channel configuration
 */
function showConfig(ctx: OutputContext, name: string): void {
  const config = getChannelConfig(name);
  if (!config) {
    throw new CliError(`Channel "${name}" not found`, 'CHANNEL_NOT_FOUND');
  }

  // Mask sensitive values
  const maskedConfig = { ...config };
  for (const key of Object.keys(maskedConfig)) {
    const value = maskedConfig[key];
    if (typeof value === 'string' && isEncrypted(value)) {
      maskedConfig[key] = '********';
    }
  }

  const response = successResponse({
    id: name,
    config: maskedConfig,
  });

  output(ctx, response, () => {
    console.log(chalk.bold(`Channel: ${name}`));
    console.log();

    for (const [key, value] of Object.entries(maskedConfig)) {
      const displayValue = formatValue(value);
      console.log(`  ${chalk.cyan(key)}: ${displayValue}`);
    }

    console.log();
    console.log(chalk.gray('To update a setting:'));
    console.log(chalk.gray(`  viben channel config -n ${name} set <key> <value>`));
  });
}

/**
 * Set a configuration value
 */
function setConfigValue(
  ctx: OutputContext,
  name: string,
  key: string,
  value: string
): void {
  // Validate key
  const allowedKeys = [
    'enabled',
    'token',
    'allowFrom',
    'proxy',
    'appId',
    'appSecret',
    'encryptKey',
    'verificationToken',
    'gatewayUrl',
    'intents',
    'bridgeUrl',
  ];

  if (!allowedKeys.includes(key)) {
    throw new CliError(
      `Unknown configuration key: ${key}. Allowed keys: ${allowedKeys.join(', ')}`,
      'INVALID_CONFIG_KEY'
    );
  }

  // Parse value based on key
  let parsedValue: unknown = value;
  if (key === 'enabled') {
    parsedValue = value === 'true' || value === '1' || value === 'yes';
  } else if (key === 'intents') {
    parsedValue = parseInt(value, 10);
    if (isNaN(parsedValue as number)) {
      throw new CliError('intents must be a number', 'INVALID_VALUE');
    }
  }

  // Update the configuration
  updateChannelConfig(name, key, parsedValue);

  const response = successResponse({
    id: name,
    key,
    updated: true,
  });

  output(ctx, response, () => {
    // Mask sensitive values in output
    const displayValue =
      key === 'token' || key === 'appSecret' ? '********' : value;
    console.log(
      chalk.green('\u2713') +
        ` Updated ${chalk.cyan(key)} for channel ${chalk.cyan(name)}: ${displayValue}`
    );
  });
}

/**
 * Format a value for display
 */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return chalk.gray('(not set)');
  }
  if (typeof value === 'boolean') {
    return value ? chalk.green('true') : chalk.gray('false');
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return chalk.gray('[]');
    }
    return JSON.stringify(value);
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}
