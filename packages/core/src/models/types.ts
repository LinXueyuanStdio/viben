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
}

/**
 * Model configuration entry
 */
export interface ModelConfigEntry {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
}

/**
 * Known model definitions
 *
 * Synced with crates/viben-core/src/models/types.rs KnownModel
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
