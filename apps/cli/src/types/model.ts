/**
 * Model Service Types
 *
 * Type definitions for model management in Viben CLI.
 */

/**
 * Model capability configuration
 */
export interface ModelCapabilities {
  /** Context window size in tokens */
  context_window?: number;
  /** Whether the model supports vision/images */
  supports_vision?: boolean;
  /** Whether the model supports tool/function calling */
  supports_tools?: boolean;
  /** Whether the model supports streaming responses */
  supports_streaming?: boolean;
  /** Cost per 1k input tokens */
  cost_per_1k_input?: number;
  /** Cost per 1k output tokens */
  cost_per_1k_output?: number;
}

/**
 * Model-specific configuration
 */
export interface ModelConfig {
  /** Provider ID to use for this model */
  provider?: string;
  /** Maximum tokens to generate */
  max_tokens?: number;
  /** Temperature for generation */
  temperature?: number;
  /** Top-p sampling parameter */
  top_p?: number;
  /** Top-k sampling parameter */
  top_k?: number;
  /** Stop sequences */
  stop_sequences?: string[];
}

/**
 * Model definition for display
 */
export interface Model {
  /** Model identifier */
  id: string;
  /** Provider ID */
  provider?: string;
  /** Whether this is the default model */
  isDefault?: boolean;
  /** Model configuration */
  config?: ModelConfig;
  /** Model capabilities */
  capabilities?: ModelCapabilities;
}

/**
 * Model alias mapping
 */
export type ModelAliases = Record<string, string>;

/**
 * Model fallback chain
 */
export type ModelFallbacks = string[];

/**
 * Model configurations mapping
 */
export type ModelConfigs = Record<string, ModelConfig>;

/**
 * Model capabilities mapping
 */
export type ModelCapabilitiesMap = Record<string, ModelCapabilities>;

/**
 * Models configuration file structure
 * Stored in ~/.viben/models.yaml
 */
export interface ModelsConfig {
  version: number;
  /** Default model ID */
  default?: string;
  /** Model aliases (short name -> full model ID) */
  aliases?: ModelAliases;
  /** Fallback chain (ordered list of models to try) */
  fallbacks?: ModelFallbacks;
  /** Model-specific configurations */
  model_config?: ModelConfigs;
  /** Model capabilities metadata */
  model_capabilities?: ModelCapabilitiesMap;
}

/**
 * Model status information
 */
export interface ModelStatus {
  /** Model ID */
  id: string;
  /** Provider ID */
  provider?: string;
  /** Whether the model is available */
  available: boolean;
  /** Error message if not available */
  error?: string;
}

/**
 * Default models configuration
 */
export const DEFAULT_MODELS_CONFIG: ModelsConfig = {
  version: 1,
  default: 'claude-sonnet-4-20250514',
  aliases: {},
  fallbacks: [],
  model_config: {},
  model_capabilities: {},
};

/**
 * Models configuration file name
 */
export const MODELS_CONFIG_FILE = 'models.yaml';
