/**
 * Channel configuration management for Viben CLI
 *
 * Handles reading/writing channels.yaml configuration file.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import * as crypto from 'crypto';
import { CliError } from '../../types';
import { getStateDir, ensureDir } from '../scope';
import type { ChannelConfig, ChannelsConfig, ChannelType } from './types';
import { DEFAULT_DISCORD_GATEWAY, DEFAULT_DISCORD_INTENTS } from './types';

/**
 * Channels config file name
 */
export const CHANNELS_FILE = 'channels.yaml';

/**
 * Encryption key file name
 */
const ENCRYPTION_KEY_FILE = '.encryption_key';

/**
 * Default channels configuration
 */
export const DEFAULT_CHANNELS_CONFIG: ChannelsConfig = {
  version: 1,
  channels: {},
};

/**
 * Get the channels config file path
 */
export function getChannelsConfigPath(): string {
  return path.join(getStateDir(), CHANNELS_FILE);
}

/**
 * Read the channels configuration
 */
export function readChannelsConfig(): ChannelsConfig {
  const configPath = getChannelsConfigPath();

  if (!fs.existsSync(configPath)) {
    return { ...DEFAULT_CHANNELS_CONFIG };
  }

  try {
    const content = fs.readFileSync(configPath, 'utf-8');
    const config = yaml.parse(content) as ChannelsConfig;
    return config || { ...DEFAULT_CHANNELS_CONFIG };
  } catch (error) {
    throw new CliError(
      `Failed to read channels config: ${configPath}`,
      'CHANNELS_CONFIG_READ_ERROR',
      error
    );
  }
}

/**
 * Write the channels configuration
 */
export function writeChannelsConfig(config: ChannelsConfig): void {
  const configPath = getChannelsConfigPath();
  const stateDir = getStateDir();
  ensureDir(stateDir);

  try {
    const content = yaml.stringify(config, {
      indent: 2,
      lineWidth: 0,
    });
    fs.writeFileSync(configPath, content, 'utf-8');
  } catch (error) {
    throw new CliError(
      `Failed to write channels config: ${configPath}`,
      'CHANNELS_CONFIG_WRITE_ERROR',
      error
    );
  }
}

/**
 * Get a channel configuration by ID
 */
export function getChannelConfig(channelId: string): ChannelConfig | null {
  const config = readChannelsConfig();
  return config.channels[channelId] || null;
}

/**
 * Set a channel configuration
 */
export function setChannelConfig(channelId: string, channelConfig: ChannelConfig): void {
  const config = readChannelsConfig();
  config.channels[channelId] = channelConfig;
  writeChannelsConfig(config);
}

/**
 * Delete a channel configuration
 */
export function deleteChannelConfig(channelId: string): void {
  const config = readChannelsConfig();
  if (!config.channels[channelId]) {
    throw new CliError(`Channel "${channelId}" not found`, 'CHANNEL_NOT_FOUND');
  }
  delete config.channels[channelId];

  // Clear default if deleted channel was default
  if (config.default === channelId) {
    config.default = undefined;
  }

  writeChannelsConfig(config);
}

/**
 * List all channel configurations
 */
export function listChannelConfigs(): Array<ChannelConfig & { isDefault: boolean }> {
  const config = readChannelsConfig();
  return Object.values(config.channels).map((channel) => ({
    ...channel,
    isDefault: config.default === channel.id,
  }));
}

/**
 * Enable or disable a channel
 */
export function setChannelEnabled(channelId: string, enabled: boolean): void {
  const config = readChannelsConfig();
  if (!config.channels[channelId]) {
    throw new CliError(`Channel "${channelId}" not found`, 'CHANNEL_NOT_FOUND');
  }
  config.channels[channelId].enabled = enabled;
  writeChannelsConfig(config);
}

/**
 * Set default channel
 */
export function setDefaultChannel(channelId: string): void {
  const config = readChannelsConfig();
  if (!config.channels[channelId]) {
    throw new CliError(`Channel "${channelId}" not found`, 'CHANNEL_NOT_FOUND');
  }
  config.default = channelId;
  writeChannelsConfig(config);
}

/**
 * Get default channel ID
 */
export function getDefaultChannelId(): string | undefined {
  const config = readChannelsConfig();
  return config.default;
}

/**
 * Get or create encryption key for secure token storage
 */
function getEncryptionKey(): Buffer {
  const keyPath = path.join(getStateDir(), ENCRYPTION_KEY_FILE);

  if (fs.existsSync(keyPath)) {
    return Buffer.from(fs.readFileSync(keyPath, 'utf-8'), 'hex');
  }

  // Generate a new key
  const key = crypto.randomBytes(32);
  ensureDir(getStateDir());
  fs.writeFileSync(keyPath, key.toString('hex'), { mode: 0o600 });
  return key;
}

/**
 * Encrypt a value for storage
 */
export function encryptValue(value: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(value, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `encrypted:${iv.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt a stored value
 */
export function decryptValue(encryptedValue: string): string {
  if (!encryptedValue.startsWith('encrypted:')) {
    return encryptedValue;
  }

  const parts = encryptedValue.split(':');
  if (parts.length !== 3) {
    throw new CliError('Invalid encrypted value format', 'DECRYPT_ERROR');
  }

  const key = getEncryptionKey();
  const iv = Buffer.from(parts[1], 'hex');
  const encrypted = parts[2];
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

/**
 * Check if a value is encrypted
 */
export function isEncrypted(value: string): boolean {
  return value.startsWith('encrypted:');
}

/**
 * Create a new channel configuration
 */
export function createChannelConfig(
  id: string,
  type: ChannelType,
  options: {
    token?: string;
    appId?: string;
    appSecret?: string;
    encryptKey?: string;
    verificationToken?: string;
    allowFrom?: string[];
    proxy?: string;
    enabled?: boolean;
  }
): ChannelConfig {
  const baseConfig: ChannelConfig = {
    id,
    type,
    enabled: options.enabled ?? true,
    allowFrom: options.allowFrom || [],
  };

  if (options.proxy) {
    baseConfig.proxy = options.proxy;
  }

  switch (type) {
    case 'telegram':
      if (!options.token) {
        throw new CliError('Token is required for Telegram channels', 'MISSING_TOKEN');
      }
      return {
        ...baseConfig,
        token: encryptValue(options.token),
      };

    case 'discord':
      if (!options.token) {
        throw new CliError('Token is required for Discord channels', 'MISSING_TOKEN');
      }
      return {
        ...baseConfig,
        token: encryptValue(options.token),
        gatewayUrl: DEFAULT_DISCORD_GATEWAY,
        intents: DEFAULT_DISCORD_INTENTS,
      };

    case 'whatsapp':
      return {
        ...baseConfig,
        bridgeUrl: 'ws://localhost:3001',
      };

    case 'feishu':
      if (!options.appId || !options.appSecret) {
        throw new CliError(
          'App ID and App Secret are required for Feishu channels',
          'MISSING_CREDENTIALS'
        );
      }
      return {
        ...baseConfig,
        appId: options.appId,
        appSecret: encryptValue(options.appSecret),
        encryptKey: options.encryptKey || '',
        verificationToken: options.verificationToken || '',
      };

    default:
      throw new CliError(`Unknown channel type: ${type}`, 'UNKNOWN_CHANNEL_TYPE');
  }
}

/**
 * Update a channel configuration value
 */
export function updateChannelConfig(
  channelId: string,
  key: string,
  value: unknown
): void {
  const config = readChannelsConfig();
  if (!config.channels[channelId]) {
    throw new CliError(`Channel "${channelId}" not found`, 'CHANNEL_NOT_FOUND');
  }

  // Handle special keys that need encryption
  if ((key === 'token' || key === 'appSecret') && typeof value === 'string') {
    value = encryptValue(value);
  }

  // Handle array values passed as JSON strings
  if (key === 'allowFrom' && typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      // If not valid JSON, treat as single value
      value = [value];
    }
  }

  config.channels[channelId][key] = value;
  writeChannelsConfig(config);
}

/**
 * Validate channel ID format
 */
export function validateChannelId(id: string): void {
  if (!id || id.trim() === '') {
    throw new CliError('Channel ID cannot be empty', 'INVALID_CHANNEL_ID');
  }

  if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(id)) {
    throw new CliError(
      'Channel ID must start with a letter and contain only letters, numbers, underscores, and hyphens',
      'INVALID_CHANNEL_ID'
    );
  }

  if (id.length > 64) {
    throw new CliError('Channel ID must be 64 characters or less', 'INVALID_CHANNEL_ID');
  }
}

/**
 * Check if a channel exists
 */
export function channelExists(channelId: string): boolean {
  const config = readChannelsConfig();
  return channelId in config.channels;
}
