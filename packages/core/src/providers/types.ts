/**
 * Provider-specific types (re-exports from main types for convenience)
 */
export type {
  Provider,
  ProviderCategory,
  ProviderType,
  ProviderSurface,
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
  "openai-responses": "https://api.openai.com/v1",
  anthropic: "https://api.anthropic.com/v1",
  azure: "", // Requires custom endpoint
  ollama: "http://localhost:11434",
  openrouter: "https://openrouter.ai/api/v1",
  google: "https://generativelanguage.googleapis.com/v1beta",
  volcengine: "https://ark.cn-beijing.volces.com/api/v3",
  grok: "https://api.x.ai/v1",
  nanobanana: "https://generativelanguage.googleapis.com",
  imagerouter: "https://api.imagerouter.io/v1/openai",
  "custom-image": "",
  fal: "https://fal.run",
  leonardo: "https://cloud.leonardo.ai/api/rest/v1",
  minimax: "https://api.minimaxi.chat/v1",
  elevenlabs: "https://api.elevenlabs.io",
  fishaudio: "https://api.fish.audio",
  senseaudio: "https://api.senseaudio.cn",
  aihubmix: "https://aihubmix.com/v1",
  suno: "",
  udio: "",
};

/**
 * Environment variable names for API keys by provider type
 */
export const ENV_VAR_NAMES: Record<string, string | undefined> = {
  openai: "OPENAI_API_KEY",
  "openai-responses": "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  azure: "AZURE_OPENAI_API_KEY",
  ollama: undefined, // No API key needed
  openrouter: "OPENROUTER_API_KEY",
  google: "GOOGLE_API_KEY",
  volcengine: "ARK_API_KEY",
  grok: "XAI_API_KEY",
  nanobanana: "GEMINI_API_KEY",
  imagerouter: "IMAGEROUTER_API_KEY",
  "custom-image": undefined,
  fal: "FAL_KEY",
  leonardo: "LEONARDO_API_KEY",
  minimax: "MINIMAX_API_KEY",
  elevenlabs: "ELEVENLABS_API_KEY",
  fishaudio: "FISH_AUDIO_API_KEY",
  senseaudio: "SENSEAUDIO_API_KEY",
  aihubmix: "AIHUBMIX_API_KEY",
  suno: "SUNO_API_KEY",
  udio: "UDIO_API_KEY",
};

/**
 * Provider file structure in providers.yaml (snake_case to match YAML)
 */
export interface ProviderEntry {
  /** Legacy configs may use type; write path normalizes to provider_type. */
  type?: string;
  provider_type: string;
  category?: string;
  name: string;
  api_key?: string;
  base_url?: string;
  api_version?: string;
  deployment?: string;
  timeout?: number;
  max_retries?: number;
  headers?: Record<string, string>;
  surfaces?: string[];
  supports_custom_model?: boolean;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Providers config file structure
 */
export interface ProvidersFile {
  default?: string;
  defaults?: {
    llm?: string;
    media?: Partial<Record<string, string>>;
  };
  providers: Record<string, ProviderEntry>;
}
