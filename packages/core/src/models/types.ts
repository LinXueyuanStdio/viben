/**
 * Model-specific types (re-exports from main types for convenience)
 */
export type { Model, ModelConfig, ModelAlias } from "../types";

/**
 * Models config file structure
 */
export interface ModelsFile {
  default?: string;
  aliases: Record<string, string>;
  fallbacks: string[];
  configs: Record<string, ModelConfigEntry>;
  /** Custom models added by user */
  custom_models: Record<string, ModelEntry>;
  /** List of disabled built-in model IDs */
  disabled_models: string[];
}

/**
 * Model configuration entry (for inference parameters)
 */
export interface ModelConfigEntry {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
}

/**
 * Model entry in config file (custom models)
 */
export interface ModelEntry {
  name: string;
  provider: string;
  description?: string;
  context_window?: number;
  max_output_tokens?: number;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Known model definitions
 */
export interface KnownModel {
  id: string;
  name: string;
  provider: string;
  description?: string;
  contextLength?: number;
  maxOutputTokens?: number;
  inputPrice?: number; // per 1M tokens
  outputPrice?: number; // per 1M tokens
}
