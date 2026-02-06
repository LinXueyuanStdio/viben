/**
 * Provider-specific types (re-exports from main types for convenience)
 */
export type {
  Provider,
  ProviderType,
  ProviderConfig,
  ProviderStatus,
  CreateProviderOptions,
} from "../types";

/**
 * Provider file structure in providers.yaml
 */
export interface ProviderEntry {
  type: string;
  name: string;
  apiKey?: string;
  baseUrl?: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Providers config file structure
 */
export interface ProvidersFile {
  default?: string;
  providers: Record<string, ProviderEntry>;
}
