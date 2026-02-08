/**
 * Provider type definitions for Viben CLI
 */

/**
 * Supported provider types
 */
export type ProviderType =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'azure'
  | 'openrouter'
  | 'ollama'
  | 'custom';

/**
 * Provider configuration stored in providers.yaml
 */
export interface ProviderConfig {
  type: ProviderType;
  /** API key (can be env:VAR_NAME, encrypted:xxx, or plain text) */
  api_key?: string;
  /** Base URL for the API */
  base_url?: string;
  /** Azure-specific: API version */
  api_version?: string;
  /** Azure-specific: deployment name */
  deployment?: string;
  /** Optional: request timeout in ms */
  timeout?: number;
  /** Optional: max retries */
  max_retries?: number;
  /** Custom headers */
  headers?: Record<string, string>;
}

/**
 * Provider with resolved status
 */
export interface Provider {
  name: string;
  type: ProviderType;
  config: ProviderConfig;
  isDefault: boolean;
}

/**
 * Provider status after connectivity check
 */
export interface ProviderStatus {
  name: string;
  type: ProviderType;
  isDefault: boolean;
  status: 'connected' | 'error' | 'not_running';
  latency?: number;
  error?: string;
}

/**
 * Providers configuration file structure
 */
export interface ProvidersConfigFile {
  version: number;
  default?: string;
  providers: Record<string, ProviderConfig>;
}

/**
 * Environment variable mapping for each provider type
 */
export const PROVIDER_ENV_VARS: Record<ProviderType, { apiKey?: string; baseUrl?: string }> = {
  anthropic: {
    apiKey: 'ANTHROPIC_API_KEY',
    baseUrl: 'ANTHROPIC_BASE_URL',
  },
  openai: {
    apiKey: 'OPENAI_API_KEY',
    baseUrl: 'OPENAI_BASE_URL',
  },
  google: {
    apiKey: 'GOOGLE_API_KEY',
  },
  azure: {
    apiKey: 'AZURE_OPENAI_API_KEY',
    baseUrl: 'AZURE_OPENAI_ENDPOINT',
  },
  openrouter: {
    apiKey: 'OPENROUTER_API_KEY',
  },
  ollama: {
    baseUrl: 'OLLAMA_HOST',
  },
  custom: {
    apiKey: 'OPENAI_API_KEY',
    baseUrl: 'OPENAI_BASE_URL',
  },
};

/**
 * Default base URLs for provider types
 */
export const PROVIDER_DEFAULT_URLS: Partial<Record<ProviderType, string>> = {
  anthropic: 'https://api.anthropic.com',
  openai: 'https://api.openai.com/v1',
  google: 'https://generativelanguage.googleapis.com',
  openrouter: 'https://openrouter.ai/api/v1',
  ollama: 'http://localhost:11434',
};
