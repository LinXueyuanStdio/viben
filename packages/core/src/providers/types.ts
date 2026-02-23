/**
 * Provider-specific types (re-exports from main types for convenience)
 */
export type {
  Provider,
  ProviderType,
  ProviderConfig,
  ProviderStatus,
  CreateProviderOptions,
  ProviderUpdate,
} from "../types";

/**
 * Default base URLs for known provider types
 */
export const DEFAULT_BASE_URLS: Record<string, string> = {
  openai: "https://api.openai.com/v1",
  anthropic: "https://api.anthropic.com/v1",
  azure: "", // Requires custom endpoint
  ollama: "http://localhost:11434",
  openrouter: "https://openrouter.ai/api/v1",
  google: "https://generativelanguage.googleapis.com/v1beta",
  custom: "",
};

/**
 * Environment variable names for API keys by provider type
 */
export const ENV_VAR_NAMES: Record<string, string | undefined> = {
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  azure: "AZURE_OPENAI_API_KEY",
  ollama: undefined, // No API key needed
  openrouter: "OPENROUTER_API_KEY",
  google: "GOOGLE_API_KEY",
  custom: undefined,
};

/**
 * Provider file structure in providers.yaml (snake_case to match YAML)
 */
export interface ProviderEntry {
  provider_type: string;
  name: string;
  api_key?: string;
  base_url?: string;
  api_version?: string;
  deployment?: string;
  timeout?: number;
  max_retries?: number;
  headers?: Record<string, string>;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Providers config file structure
 */
export interface ProvidersFile {
  default?: string;
  providers: Record<string, ProviderEntry>;
}
