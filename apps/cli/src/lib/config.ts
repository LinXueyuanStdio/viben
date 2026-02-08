/**
 * Configuration file management for Viben CLI
 *
 * Handles reading/writing YAML config files and config value manipulation.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import type { VibenConfig, ConfigScope } from '../types';
import { CliError } from '../types';
import {
  getConfigPathForScope,
  getGlobalConfigDir,
  getWorkspaceDir,
  ensureDir,
  CONFIG_FILE,
} from './scope';

/**
 * Default configuration
 */
export const DEFAULT_CONFIG: VibenConfig = {
  version: 1,
  settings: {
    editor: 'code',
    pager: 'less',
    color: 'auto',
  },
  agents: [],
  mcp: {
    enabled: [],
  },
  skills: {
    enabled: [],
  },
};

/**
 * Read a YAML config file
 * Returns null if the file doesn't exist
 */
export function readConfigFile(filePath: string): VibenConfig | null {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return yaml.parse(content) as VibenConfig;
  } catch (error) {
    throw new CliError(
      `Failed to read config file: ${filePath}`,
      'CONFIG_READ_ERROR',
      error
    );
  }
}

/**
 * Write a config to a YAML file
 */
export function writeConfigFile(filePath: string, config: VibenConfig): void {
  try {
    // Ensure parent directory exists
    const dirPath = path.dirname(filePath);
    ensureDir(dirPath);

    const content = yaml.stringify(config, {
      indent: 2,
      lineWidth: 0, // Don't wrap lines
    });
    fs.writeFileSync(filePath, content, 'utf-8');
  } catch (error) {
    throw new CliError(
      `Failed to write config file: ${filePath}`,
      'CONFIG_WRITE_ERROR',
      error
    );
  }
}

/**
 * Read config for a specific scope
 */
export function readScopedConfig(scope: ConfigScope): VibenConfig | null {
  const configPath = getConfigPathForScope(scope);
  return readConfigFile(configPath);
}

/**
 * Write config for a specific scope
 */
export function writeScopedConfig(scope: ConfigScope, config: VibenConfig): void {
  const configPath = getConfigPathForScope(scope);
  writeConfigFile(configPath, config);
}

/**
 * Get a value from config using dot notation
 * e.g., getConfigValue(config, 'settings.editor')
 */
export function getConfigValue(
  config: VibenConfig,
  key: string
): unknown {
  const parts = parseKey(key);
  let current: unknown = config;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }

    if (typeof current !== 'object') {
      return undefined;
    }

    if (part.isArrayIndex) {
      if (!Array.isArray(current)) {
        return undefined;
      }
      current = current[part.index!];
    } else {
      current = (current as Record<string, unknown>)[part.key];
    }
  }

  return current;
}

/**
 * Set a value in config using dot notation
 * Returns a new config object (immutable)
 */
export function setConfigValue(
  config: VibenConfig,
  key: string,
  value: unknown
): VibenConfig {
  const parts = parseKey(key);
  if (parts.length === 0) {
    return config;
  }

  // Deep clone the config
  const newConfig = JSON.parse(JSON.stringify(config)) as VibenConfig;
  let current: Record<string, unknown> = newConfig as unknown as Record<string, unknown>;

  // Navigate to parent, creating objects as needed
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    const nextPart = parts[i + 1];

    if (part.isArrayIndex) {
      // Handle array index
      const arr = current as unknown as unknown[];
      if (!Array.isArray(arr)) {
        throw new CliError(`Cannot index non-array at ${key}`, 'INVALID_KEY');
      }
      if (arr[part.index!] === undefined) {
        // Create object or array based on next part
        arr[part.index!] = nextPart.isArrayIndex ? [] : {};
      }
      current = arr[part.index!] as Record<string, unknown>;
    } else {
      if (current[part.key] === undefined || typeof current[part.key] !== 'object') {
        // Create object or array based on next part
        current[part.key] = nextPart.isArrayIndex ? [] : {};
      }
      current = current[part.key] as Record<string, unknown>;
    }
  }

  // Set the final value
  const lastPart = parts[parts.length - 1];
  if (lastPart.isArrayIndex) {
    const arr = current as unknown as unknown[];
    arr[lastPart.index!] = value;
  } else {
    current[lastPart.key] = value;
  }

  return newConfig;
}

/**
 * Delete a value from config using dot notation
 * Returns a new config object (immutable)
 */
export function deleteConfigValue(
  config: VibenConfig,
  key: string
): VibenConfig {
  const parts = parseKey(key);
  if (parts.length === 0) {
    return config;
  }

  // Deep clone the config
  const newConfig = JSON.parse(JSON.stringify(config)) as VibenConfig;
  let current: Record<string, unknown> = newConfig as unknown as Record<string, unknown>;

  // Navigate to parent
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];

    if (part.isArrayIndex) {
      const arr = current as unknown as unknown[];
      if (!Array.isArray(arr) || arr[part.index!] === undefined) {
        return config; // Key doesn't exist, return unchanged
      }
      current = arr[part.index!] as Record<string, unknown>;
    } else {
      if (current[part.key] === undefined || typeof current[part.key] !== 'object') {
        return config; // Key doesn't exist, return unchanged
      }
      current = current[part.key] as Record<string, unknown>;
    }
  }

  // Delete the final key
  const lastPart = parts[parts.length - 1];
  if (lastPart.isArrayIndex) {
    const arr = current as unknown as unknown[];
    if (Array.isArray(arr)) {
      arr.splice(lastPart.index!, 1);
    }
  } else {
    delete current[lastPart.key];
  }

  return newConfig;
}

/**
 * Key part for dot notation parsing
 */
interface KeyPart {
  key: string;
  isArrayIndex: boolean;
  index?: number;
}

/**
 * Parse a dot-notation key into parts
 * Supports array indexing like "mcp.enabled[0]"
 */
function parseKey(key: string): KeyPart[] {
  const parts: KeyPart[] = [];
  const regex = /([^.\[\]]+)|\[(\d+)\]/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(key)) !== null) {
    if (match[1] !== undefined) {
      // Regular key
      parts.push({ key: match[1], isArrayIndex: false });
    } else if (match[2] !== undefined) {
      // Array index
      parts.push({ key: '', isArrayIndex: true, index: parseInt(match[2], 10) });
    }
  }

  return parts;
}

/**
 * Flatten a config object into key-value pairs
 */
export interface FlatConfigItem {
  key: string;
  value: string;
}

export function flattenConfig(config: VibenConfig): FlatConfigItem[] {
  const items: FlatConfigItem[] = [];

  function flatten(obj: unknown, prefix: string): void {
    if (obj === null || obj === undefined) {
      return;
    }

    if (Array.isArray(obj)) {
      obj.forEach((item, index) => {
        const key = `${prefix}[${index}]`;
        if (typeof item === 'object' && item !== null) {
          flatten(item, key);
        } else {
          items.push({ key, value: formatValue(item) });
        }
      });
    } else if (typeof obj === 'object') {
      for (const [k, v] of Object.entries(obj)) {
        const key = prefix ? `${prefix}.${k}` : k;
        if (typeof v === 'object' && v !== null) {
          flatten(v, key);
        } else {
          items.push({ key, value: formatValue(v) });
        }
      }
    } else {
      items.push({ key: prefix, value: formatValue(obj) });
    }
  }

  flatten(config, '');
  return items;
}

/**
 * Format a value for display
 */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

/**
 * Config item with origin information
 */
export interface ConfigWithOrigin {
  key: string;
  value: string;
  origin: string;
}

/**
 * Get all config values with their origin (global or workspace)
 */
export function getConfigWithOrigin(): ConfigWithOrigin[] {
  const items: ConfigWithOrigin[] = [];
  const seen = new Set<string>();

  // Workspace config (higher priority)
  const workspaceDir = getWorkspaceDir();
  if (workspaceDir) {
    const workspaceConfigPath = path.join(workspaceDir, CONFIG_FILE);
    const workspaceConfig = readConfigFile(workspaceConfigPath);
    if (workspaceConfig) {
      const workspaceItems = flattenConfig(workspaceConfig);
      for (const item of workspaceItems) {
        items.push({ ...item, origin: 'workspace' });
        seen.add(item.key);
      }
    }
  }

  // Global config
  const globalDir = getGlobalConfigDir();
  const globalConfigPath = path.join(globalDir, CONFIG_FILE);
  const globalConfig = readConfigFile(globalConfigPath);
  if (globalConfig) {
    const globalItems = flattenConfig(globalConfig);
    for (const item of globalItems) {
      if (!seen.has(item.key)) {
        items.push({ ...item, origin: 'global' });
      }
    }
  }

  return items;
}

/**
 * Get the configured editor, falling back to defaults
 */
export function getEditor(): string {
  // Check environment variables first
  if (process.env.VISUAL) {
    return process.env.VISUAL;
  }
  if (process.env.EDITOR) {
    return process.env.EDITOR;
  }

  // Check config
  const workspaceDir = getWorkspaceDir();
  if (workspaceDir) {
    const workspaceConfig = readConfigFile(path.join(workspaceDir, CONFIG_FILE));
    if (workspaceConfig?.settings?.editor) {
      return workspaceConfig.settings.editor;
    }
  }

  const globalDir = getGlobalConfigDir();
  const globalConfig = readConfigFile(path.join(globalDir, CONFIG_FILE));
  if (globalConfig?.settings?.editor) {
    return globalConfig.settings.editor;
  }

  // Default
  return DEFAULT_CONFIG.settings?.editor || 'vi';
}
