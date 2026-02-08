/**
 * Provider management for Viben CLI
 *
 * Handles listing, creating, and managing API providers.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import { CliError } from '../types';
import {
  ProviderType,
  ProviderConfig,
  Provider,
  ProviderStatus,
  ProvidersConfigFile,
  PROVIDER_ENV_VARS,
  PROVIDER_DEFAULT_URLS,
} from '../types/provider';
import { getStateDir, ensureDir } from './scope';

/**
 * Get the providers config file path
 */
export function getProvidersConfigPath(): string {
  return path.join(getStateDir(), 'providers.yaml');
}

/**
 * Read the providers config file
 */
export function readProvidersConfig(): ProvidersConfigFile {
  const configPath = getProvidersConfigPath();

  if (!fs.existsSync(configPath)) {
    return {
      version: 1,
      providers: {},
    };
  }

  try {
    const content = fs.readFileSync(configPath, 'utf-8');
    const parsed = yaml.parse(content) as ProvidersConfigFile;
    return {
      version: parsed.version || 1,
      default: parsed.default,
      providers: parsed.providers || {},
    };
  } catch (error) {
    throw new CliError(
      `Failed to read providers config: ${configPath}`,
      'PROVIDERS_READ_ERROR',
      error
    );
  }
}

/**
 * Write the providers config file
 */
export function writeProvidersConfig(config: ProvidersConfigFile): void {
  const configPath = getProvidersConfigPath();
  const configDir = path.dirname(configPath);

  ensureDir(configDir);

  try {
    const content = yaml.stringify(config, {
      indent: 2,
      lineWidth: 0,
    });
    fs.writeFileSync(configPath, content, 'utf-8');
  } catch (error) {
    throw new CliError(
      `Failed to write providers config: ${configPath}`,
      'PROVIDERS_WRITE_ERROR',
      error
    );
  }
}

/**
 * List all providers
 */
export function listProviders(): Provider[] {
  const config = readProvidersConfig();
  const providers: Provider[] = [];

  for (const [name, providerConfig] of Object.entries(config.providers)) {
    providers.push({
      name,
      type: providerConfig.type,
      config: providerConfig,
      isDefault: config.default === name,
    });
  }

  return providers;
}

/**
 * Get a provider by name
 */
export function getProvider(name: string): Provider | null {
  const config = readProvidersConfig();
  const providerConfig = config.providers[name];

  if (!providerConfig) {
    return null;
  }

  return {
    name,
    type: providerConfig.type,
    config: providerConfig,
    isDefault: config.default === name,
  };
}

/**
 * Create a new provider
 */
export function createProvider(
  name: string,
  type: ProviderType,
  options: {
    apiKey?: string;
    baseUrl?: string;
  } = {}
): Provider {
  const config = readProvidersConfig();

  // Check if already exists
  if (config.providers[name]) {
    throw new CliError(
      `Provider "${name}" already exists`,
      'PROVIDER_EXISTS'
    );
  }

  // Build provider config
  const providerConfig: ProviderConfig = {
    type,
  };

  // Set API key if provided
  if (options.apiKey) {
    providerConfig.api_key = options.apiKey;
  }

  // Set base URL if provided
  if (options.baseUrl) {
    providerConfig.base_url = options.baseUrl;
  }

  // Add to config
  config.providers[name] = providerConfig;

  // Set as default if first provider
  if (!config.default) {
    config.default = name;
  }

  writeProvidersConfig(config);

  return {
    name,
    type,
    config: providerConfig,
    isDefault: config.default === name,
  };
}

/**
 * Remove a provider
 */
export function removeProvider(name: string): void {
  const config = readProvidersConfig();

  if (!config.providers[name]) {
    throw new CliError(
      `Provider "${name}" not found`,
      'PROVIDER_NOT_FOUND'
    );
  }

  delete config.providers[name];

  // Clear default if removed provider was default
  if (config.default === name) {
    const remaining = Object.keys(config.providers);
    config.default = remaining.length > 0 ? remaining[0] : undefined;
  }

  writeProvidersConfig(config);
}

/**
 * Set default provider
 */
export function setDefaultProvider(name: string): void {
  const config = readProvidersConfig();

  if (!config.providers[name]) {
    throw new CliError(
      `Provider "${name}" not found`,
      'PROVIDER_NOT_FOUND'
    );
  }

  config.default = name;
  writeProvidersConfig(config);
}

/**
 * Get the default provider name
 */
export function getDefaultProviderName(): string | undefined {
  const config = readProvidersConfig();
  return config.default;
}

/**
 * Validate provider name format
 */
export function validateProviderName(name: string): void {
  if (!name || name.trim() === '') {
    throw new CliError('Provider name cannot be empty', 'INVALID_NAME');
  }

  if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(name)) {
    throw new CliError(
      'Provider name must start with a letter and contain only letters, numbers, underscores, and hyphens',
      'INVALID_NAME'
    );
  }

  if (name.length > 64) {
    throw new CliError('Provider name must be 64 characters or less', 'INVALID_NAME');
  }
}

/**
 * Validate provider type
 */
export function validateProviderType(type: string): ProviderType {
  const validTypes: ProviderType[] = [
    'openai',
    'anthropic',
    'google',
    'azure',
    'openrouter',
    'ollama',
    'custom',
  ];

  if (!validTypes.includes(type as ProviderType)) {
    throw new CliError(
      `Invalid provider type "${type}". Valid types: ${validTypes.join(', ')}`,
      'INVALID_TYPE'
    );
  }

  return type as ProviderType;
}

/**
 * Generate a provider name from type
 */
export function generateProviderName(type: ProviderType): string {
  const config = readProvidersConfig();
  const baseName = type;

  // Check if base name is available
  if (!config.providers[baseName]) {
    return baseName;
  }

  // Try with suffix
  let counter = 1;
  while (config.providers[`${baseName}-${counter}`]) {
    counter++;
  }

  return `${baseName}-${counter}`;
}

/**
 * Resolve API key for a provider (from config or environment)
 */
export function resolveApiKey(provider: Provider): string | undefined {
  const { config, type } = provider;

  // 1. Check explicit config value
  if (config.api_key) {
    // Handle env: prefix
    if (config.api_key.startsWith('env:')) {
      const envVar = config.api_key.slice(4);
      return process.env[envVar];
    }
    // Handle encrypted: prefix (for future use)
    if (config.api_key.startsWith('encrypted:')) {
      // TODO: Implement decryption
      return undefined;
    }
    // Plain text value
    return config.api_key;
  }

  // 2. Check environment variable
  const envVars = PROVIDER_ENV_VARS[type];
  if (envVars?.apiKey) {
    return process.env[envVars.apiKey];
  }

  return undefined;
}

/**
 * Resolve base URL for a provider (from config or environment or default)
 */
export function resolveBaseUrl(provider: Provider): string | undefined {
  const { config, type } = provider;

  // 1. Check explicit config value
  if (config.base_url) {
    // Handle env: prefix
    if (config.base_url.startsWith('env:')) {
      const envVar = config.base_url.slice(4);
      return process.env[envVar];
    }
    return config.base_url;
  }

  // 2. Check environment variable
  const envVars = PROVIDER_ENV_VARS[type];
  if (envVars?.baseUrl) {
    const envValue = process.env[envVars.baseUrl];
    if (envValue) {
      return envValue;
    }
  }

  // 3. Use default URL
  return PROVIDER_DEFAULT_URLS[type];
}

/**
 * Check provider connectivity
 */
export async function checkProviderStatus(provider: Provider): Promise<ProviderStatus> {
  const baseUrl = resolveBaseUrl(provider);
  const apiKey = resolveApiKey(provider);

  const baseStatus: ProviderStatus = {
    name: provider.name,
    type: provider.type,
    isDefault: provider.isDefault,
    status: 'error',
  };

  // Ollama doesn't require API key
  if (provider.type !== 'ollama' && !apiKey) {
    return {
      ...baseStatus,
      status: 'error',
      error: 'API key not configured',
    };
  }

  if (!baseUrl) {
    return {
      ...baseStatus,
      status: 'error',
      error: 'Base URL not configured',
    };
  }

  try {
    const startTime = Date.now();
    const response = await checkEndpoint(provider.type, baseUrl, apiKey);
    const latency = Date.now() - startTime;

    if (response.ok) {
      return {
        ...baseStatus,
        status: 'connected',
        latency,
      };
    } else {
      return {
        ...baseStatus,
        status: 'error',
        latency,
        error: `HTTP ${response.status}`,
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Check for connection refused (server not running)
    if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('connect ECONNREFUSED')) {
      return {
        ...baseStatus,
        status: 'not_running',
        error: 'Connection refused',
      };
    }

    return {
      ...baseStatus,
      status: 'error',
      error: errorMessage,
    };
  }
}

/**
 * Check endpoint based on provider type
 */
async function checkEndpoint(
  type: ProviderType,
  baseUrl: string,
  apiKey?: string
): Promise<Response> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  let endpoint: string;

  switch (type) {
    case 'anthropic':
      // Anthropic uses x-api-key header
      if (apiKey) {
        headers['x-api-key'] = apiKey;
        headers['anthropic-version'] = '2023-06-01';
      }
      // Use a minimal request to check connectivity
      endpoint = `${baseUrl}/v1/messages`;
      // Send a minimal invalid request - we just want to check auth
      return fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          max_tokens: 1,
          messages: [{ role: 'user', content: 'test' }],
        }),
        signal: AbortSignal.timeout(10000),
      });

    case 'openai':
    case 'openrouter':
    case 'custom':
      // OpenAI-compatible APIs use Bearer token
      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }
      endpoint = `${baseUrl}/models`;
      return fetch(endpoint, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(10000),
      });

    case 'google':
      // Google AI uses API key as query param
      endpoint = `${baseUrl}/v1/models?key=${apiKey || ''}`;
      return fetch(endpoint, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(10000),
      });

    case 'azure':
      // Azure OpenAI uses api-key header
      if (apiKey) {
        headers['api-key'] = apiKey;
      }
      // Azure endpoint structure is different
      endpoint = `${baseUrl}/openai/models?api-version=2024-02-15-preview`;
      return fetch(endpoint, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(10000),
      });

    case 'ollama':
      // Ollama doesn't need auth, just check /api/tags
      endpoint = `${baseUrl}/api/tags`;
      return fetch(endpoint, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(10000),
      });

    default:
      throw new Error(`Unknown provider type: ${type}`);
  }
}

/**
 * Check all providers status
 */
export async function checkAllProvidersStatus(): Promise<ProviderStatus[]> {
  const providers = listProviders();
  const statuses: ProviderStatus[] = [];

  for (const provider of providers) {
    const status = await checkProviderStatus(provider);
    statuses.push(status);
  }

  return statuses;
}
