/**
 * Model and Provider Types
 * 模型和供应商类型定义
 */

// ============================================================================
// Provider Types
// ============================================================================

/** Provider type (matching Rust ProviderType) */
export type ProviderType =
  | "openai"
  | "anthropic"
  | "google"
  | "groq"
  | "deepseek"
  | "openrouter"
  | "ollama"
  | "azure"
  | "volcengine"
  | "grok"
  | "nanobanana"
  | "imagerouter"
  | "custom-image"
  | "fal"
  | "leonardo"
  | "minimax"
  | "elevenlabs"
  | "fishaudio"
  | "senseaudio"
  | "aihubmix"
  | "suno"
  | "udio"
  | "custom";

export type ProviderCategory = "llm" | "media";

export type ProviderSurface =
  | "chat"
  | "image"
  | "video"
  | "music"
  | "speech"
  | "sfx";

export type ModelCategory = "llm" | "media";

export type ModelSurface =
  | "chat"
  | "image"
  | "video"
  | "music"
  | "speech"
  | "sfx";

/** Provider response from gateway */
export interface ProviderResponse {
  id: string;
  type: ProviderType;
  category: ProviderCategory;
  name: string;
  api_key?: string;
  base_url?: string;
  api_version?: string;
  deployment?: string;
  timeout?: number;
  max_retries?: number;
  headers?: Record<string, string>;
  surfaces: ProviderSurface[];
  supports_custom_model?: boolean;
  is_default: boolean;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

/** Options for creating a provider */
export interface CreateProviderOptions {
  type: ProviderType;
  category?: ProviderCategory;
  name: string;
  apiKey?: string;
  baseUrl?: string;
  apiVersion?: string;
  deployment?: string;
  timeout?: number;
  maxRetries?: number;
  headers?: Record<string, string>;
  surfaces?: ProviderSurface[];
  supportsCustomModel?: boolean;
  setAsDefault?: boolean;
}

/** Options for updating a provider */
export interface ProviderUpdate {
  type?: ProviderType;
  category?: ProviderCategory;
  name?: string;
  apiKey?: string;
  baseUrl?: string;
  apiVersion?: string;
  deployment?: string;
  timeout?: number;
  maxRetries?: number;
  headers?: Record<string, string>;
  surfaces?: ProviderSurface[];
  supportsCustomModel?: boolean;
}

export interface ProviderListOptions {
  category?: ProviderCategory;
  surface?: ProviderSurface;
}

/** Provider status from test */
export interface ProviderStatus {
  provider_id: string;
  connected: boolean;
  latency?: number;
  error?: string;
  checked_at: string;
}

/** Response for listing providers */
export interface ProvidersListResponse {
  providers: ProviderResponse[];
  total: number;
  default_provider_id: string | null;
}

/** API key info for a provider */
export interface ApiKeyInfo {
  provider_id: string;
  provider_name: string;
  provider_type: string;
  has_key: boolean;
  key_prefix: string | null;
  doc_url: string | null;
}

/** Response for API key providers */
export interface ApiKeyProvidersResponse {
  providers: ApiKeyInfo[];
}

// ============================================================================
// Model Types
// ============================================================================

/** Options for creating a custom model */
export interface CreateModelOptions {
  id: string;
  name: string;
  provider: ProviderType;
  provider_id?: string;
  category?: ModelCategory;
  surface?: ModelSurface;
  capabilities?: string[];
  description?: string;
  context_window?: number;
  max_output_tokens?: number;
  set_as_default?: boolean;
}

/** Options for updating a model */
export interface ModelUpdate {
  name?: string;
  description?: string;
  context_window?: number;
  max_output_tokens?: number;
}

/** Response from model operations */
export interface ModelResponse {
  id: string;
  name: string;
  provider_type: string;
  provider_id: string;
  provider_name: string;
  category?: ModelCategory;
  surface?: ModelSurface;
  capabilities?: string[];
  description?: string;
  context_window?: number;
  max_output_tokens?: number;
  input_price?: number;
  output_price?: number;
  is_default: boolean;
  enabled: boolean;
  is_available: boolean;
  created_at?: string;
  updated_at?: string;
}

/** Response for default model */
export interface DefaultModelResponse {
  default_model_id: string | null;
  surface?: ModelSurface;
}

/** Discovered model from provider API */
export interface DiscoveredModel {
  id: string;
  name: string;
  description?: string;
  context_window?: number;
  max_output_tokens?: number;
  owned_by?: string;
  created?: number;
}

/** Response for discovered models */
export interface DiscoverModelsResponse {
  models: DiscoveredModel[];
  total: number;
}

/** Provider model with enabled status */
export interface ProviderModelResponse {
  id: string;
  name: string;
  provider: string;
  description?: string;
  enabled: boolean;
  context_window?: number;
  max_output_tokens?: number;
  input_price?: number;
  output_price?: number;
}

/** Response for provider enabled models */
export interface ProviderEnabledModelsResponse {
  provider_id: string;
  models: ProviderModelResponse[];
  total: number;
}
