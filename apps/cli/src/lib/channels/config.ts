/**
 * Channel Configuration Management
 *
 * Handles reading, writing, and validating channel configurations
 * stored in ~/.viben/channels.yaml
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import * as crypto from "node:crypto";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import type { ChannelConfig, ChannelType } from "./base.js";

// ============================================================================
// Types
// ============================================================================

/**
 * Root configuration structure
 */
export interface ChannelsConfigFile {
  /** Configuration version */
  version: number;
  /** Default channel ID */
  default?: string;
  /** Channel configurations by ID */
  channels: Record<string, ChannelConfig>;
}

// ============================================================================
// Constants
// ============================================================================

const CONFIG_VERSION = 1;
const DEFAULT_CONFIG_DIR = ".viben";
const DEFAULT_CONFIG_FILE = "channels.yaml";

// Simple encryption key derivation from machine ID
// In production, use a proper key management solution
const ENCRYPTION_PREFIX = "encrypted:";

// ============================================================================
// Configuration Path
// ============================================================================

/**
 * Get the default configuration directory path
 */
export function getConfigDir(): string {
  return path.join(os.homedir(), DEFAULT_CONFIG_DIR);
}

/**
 * Get the default configuration file path
 */
export function getConfigPath(): string {
  return path.join(getConfigDir(), DEFAULT_CONFIG_FILE);
}

/**
 * Ensure the configuration directory exists
 */
export function ensureConfigDir(): void {
  const configDir = getConfigDir();
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true, mode: 0o700 });
  }
}

// ============================================================================
// Encryption Utilities
// ============================================================================

/**
 * Get encryption key from environment or generate a machine-specific one
 */
function getEncryptionKey(): Buffer {
  // Try to get key from environment
  const envKey = process.env.VIBEN_ENCRYPTION_KEY;
  if (envKey) {
    return crypto.scryptSync(envKey, "viben-salt", 32);
  }

  // Fallback to machine-specific key (not ideal for security, but works for basic obfuscation)
  const machineId = `${os.hostname()}-${os.userInfo().username}`;
  return crypto.scryptSync(machineId, "viben-salt", 32);
}

/**
 * Encrypt a string value
 * @param value - Plain text value
 * @returns Encrypted string with prefix
 */
export function encryptValue(value: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  const combined = Buffer.concat([iv, encrypted]);
  return `${ENCRYPTION_PREFIX}${combined.toString("base64")}`;
}

/**
 * Decrypt a string value
 * @param encrypted - Encrypted string with prefix
 * @returns Plain text value
 */
export function decryptValue(encrypted: string): string {
  if (!encrypted.startsWith(ENCRYPTION_PREFIX)) {
    return encrypted; // Not encrypted, return as-is
  }

  const key = getEncryptionKey();
  const data = Buffer.from(encrypted.slice(ENCRYPTION_PREFIX.length), "base64");
  const iv = data.subarray(0, 16);
  const encryptedData = data.subarray(16);
  const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
  const decrypted = Buffer.concat([
    decipher.update(encryptedData),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

/**
 * Check if a value is encrypted
 */
export function isEncrypted(value: string): boolean {
  return value.startsWith(ENCRYPTION_PREFIX);
}

// ============================================================================
// Configuration Loading/Saving
// ============================================================================

/**
 * Create a default configuration structure
 */
export function createDefaultConfig(): ChannelsConfigFile {
  return {
    version: CONFIG_VERSION,
    channels: {},
  };
}

/**
 * Load configuration from file
 * @param configPath - Path to configuration file (optional)
 * @returns Configuration object
 */
export function loadConfig(configPath?: string): ChannelsConfigFile {
  const filePath = configPath ?? getConfigPath();

  if (!fs.existsSync(filePath)) {
    return createDefaultConfig();
  }

  try {
    const content = fs.readFileSync(filePath, "utf8");
    const config = parseYaml(content) as ChannelsConfigFile;

    // Validate version
    if (config.version !== CONFIG_VERSION) {
      console.warn(
        `Config version mismatch: expected ${CONFIG_VERSION}, got ${config.version}`
      );
    }

    // Decrypt sensitive values
    for (const [id, channelConfig] of Object.entries(config.channels)) {
      if (channelConfig.token && isEncrypted(channelConfig.token)) {
        try {
          channelConfig.token = decryptValue(channelConfig.token);
        } catch {
          console.warn(`Failed to decrypt token for channel ${id}`);
        }
      }
      // Handle Feishu-specific secrets
      if (channelConfig.type === "feishu") {
        const feishuConfig = channelConfig as ChannelConfig & {
          appSecret?: string;
        };
        if (feishuConfig.appSecret && isEncrypted(feishuConfig.appSecret)) {
          try {
            feishuConfig.appSecret = decryptValue(feishuConfig.appSecret);
          } catch {
            console.warn(`Failed to decrypt appSecret for channel ${id}`);
          }
        }
      }
    }

    return config;
  } catch (error) {
    console.error("Failed to load config:", error);
    return createDefaultConfig();
  }
}

/**
 * Save configuration to file
 * @param config - Configuration object
 * @param configPath - Path to configuration file (optional)
 */
export function saveConfig(
  config: ChannelsConfigFile,
  configPath?: string
): void {
  const filePath = configPath ?? getConfigPath();

  ensureConfigDir();

  // Clone config and encrypt sensitive values
  const configToSave: ChannelsConfigFile = {
    ...config,
    channels: {},
  };

  for (const [id, channelConfig] of Object.entries(config.channels)) {
    const savedConfig = { ...channelConfig };

    // Encrypt token if not already encrypted
    if (savedConfig.token && !isEncrypted(savedConfig.token)) {
      savedConfig.token = encryptValue(savedConfig.token);
    }

    // Handle Feishu-specific secrets
    if (savedConfig.type === "feishu") {
      const feishuConfig = savedConfig as ChannelConfig & {
        appSecret?: string;
      };
      if (feishuConfig.appSecret && !isEncrypted(feishuConfig.appSecret)) {
        feishuConfig.appSecret = encryptValue(feishuConfig.appSecret);
      }
    }

    configToSave.channels[id] = savedConfig;
  }

  const content = stringifyYaml(configToSave, {
    lineWidth: 0, // Disable line wrapping
  });

  fs.writeFileSync(filePath, content, { mode: 0o600 });
}

// ============================================================================
// Configuration Helpers
// ============================================================================

/**
 * Get a channel configuration by ID
 */
export function getChannelConfig(
  config: ChannelsConfigFile,
  id: string
): ChannelConfig | undefined {
  return config.channels[id];
}

/**
 * Add or update a channel configuration
 */
export function setChannelConfig(
  config: ChannelsConfigFile,
  id: string,
  channelConfig: ChannelConfig
): void {
  config.channels[id] = channelConfig;
}

/**
 * Remove a channel configuration
 */
export function removeChannelConfig(
  config: ChannelsConfigFile,
  id: string
): boolean {
  if (config.channels[id]) {
    delete config.channels[id];
    if (config.default === id) {
      config.default = undefined;
    }
    return true;
  }
  return false;
}

/**
 * Set the default channel
 */
export function setDefaultChannel(
  config: ChannelsConfigFile,
  id: string
): void {
  if (!config.channels[id]) {
    throw new Error(`Channel ${id} does not exist`);
  }
  config.default = id;
}

/**
 * Get list of enabled channel IDs
 */
export function getEnabledChannels(config: ChannelsConfigFile): string[] {
  return Object.entries(config.channels)
    .filter(([_, cfg]) => cfg.enabled)
    .map(([id]) => id);
}

/**
 * Validate a channel configuration
 */
export function validateChannelConfig(
  config: ChannelConfig
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!config.id) {
    errors.push("Channel ID is required");
  }

  if (!config.type) {
    errors.push("Channel type is required");
  } else if (!["telegram", "discord", "whatsapp", "feishu"].includes(config.type)) {
    errors.push(`Invalid channel type: ${config.type}`);
  }

  // Type-specific validation
  switch (config.type) {
    case "telegram":
    case "discord":
      if (!config.token) {
        errors.push(`Token is required for ${config.type} channel`);
      }
      break;
    case "feishu": {
      const feishuConfig = config as ChannelConfig & {
        appId?: string;
        appSecret?: string;
      };
      if (!feishuConfig.appId) {
        errors.push("appId is required for Feishu channel");
      }
      if (!feishuConfig.appSecret) {
        errors.push("appSecret is required for Feishu channel");
      }
      break;
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Create a channel configuration template
 */
export function createChannelTemplate(
  type: ChannelType,
  id: string
): ChannelConfig {
  const base: ChannelConfig = {
    id,
    type,
    enabled: false,
    allowFrom: [],
  };

  switch (type) {
    case "telegram":
      return {
        ...base,
        token: "",
        proxy: undefined,
      };
    case "discord":
      return {
        ...base,
        token: "",
      };
    case "feishu":
      return {
        ...base,
        appId: "",
        appSecret: "",
        encryptKey: "",
        verificationToken: "",
      } as ChannelConfig;
    case "whatsapp":
      return {
        ...base,
        // WhatsApp uses session-based auth
      };
    default:
      return base;
  }
}
