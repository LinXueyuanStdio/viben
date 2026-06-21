/**
 * Model-specific types (re-exports from main types for convenience)
 */
export type { Model, ModelConfig, ModelAlias } from "../types";

import type { UnifiedModelsFile } from "../config/model-provider-storage";

/**
 * models.yaml stores provider entries keyed by provider_id.
 */
export type ModelsFile = UnifiedModelsFile;

/**
 * Model configuration entry (for inference parameters)
 */
export interface ModelConfigEntry {
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  provider?: string;
  category?: ModelCategory;
  surface?: ModelSurface;
  capabilities?: string[];
  duration_seconds?: number;
  aspect_ratio?: string;
  size?: string;
  voice_id?: string;
}

export type ModelCategory = "llm" | "media";

export type ModelSurface =
  | "chat"
  | "image"
  | "video"
  | "music"
  | "speech"
  | "sfx";

/**
 * Model entry in config file (custom models)
 */
export interface ModelEntry {
  name: string;
  provider: string;
  /** Provider instance ID (e.g. "deepseek-openai") that registered this model */
  provider_id?: string;
  category?: ModelCategory;
  surface?: ModelSurface;
  capabilities?: string[];
  description?: string;
  context_window?: number;
  max_output_tokens?: number;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}
