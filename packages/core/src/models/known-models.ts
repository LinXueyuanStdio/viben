/**
 * Known model definitions for quick reference
 *
 * Synced with crates/viben-core/src/models/known.rs
 */
import type { KnownModel } from "./types";
export type { KnownModel } from "./types";

export const KNOWN_MODELS: KnownModel[] = [
  // OpenAI Models
  {
    id: "gpt-4o",
    name: "GPT-4o",
    provider: "openai",
    description: "Most capable GPT-4 model with vision",
    contextLength: 128000,
    maxOutputTokens: 16384,
    inputPrice: 2.5,
    outputPrice: 10,
  },
  {
    id: "gpt-4o-mini",
    name: "GPT-4o Mini",
    provider: "openai",
    description: "Fast and efficient GPT-4 model",
    contextLength: 128000,
    maxOutputTokens: 16384,
    inputPrice: 0.15,
    outputPrice: 0.6,
  },
  {
    id: "gpt-4-turbo",
    name: "GPT-4 Turbo",
    provider: "openai",
    description: "GPT-4 Turbo with 128K context",
    contextLength: 128000,
    maxOutputTokens: 4096,
    inputPrice: 10,
    outputPrice: 30,
  },
  {
    id: "gpt-4",
    name: "GPT-4",
    provider: "openai",
    description: "Original GPT-4 model",
    contextLength: 8192,
    maxOutputTokens: 4096,
    inputPrice: 30,
    outputPrice: 60,
  },
  {
    id: "gpt-3.5-turbo",
    name: "GPT-3.5 Turbo",
    provider: "openai",
    description: "Fast and cost-effective model",
    contextLength: 16385,
    maxOutputTokens: 4096,
    inputPrice: 0.5,
    outputPrice: 1.5,
  },
  {
    id: "o1",
    name: "o1",
    provider: "openai",
    description: "Advanced reasoning model",
    contextLength: 200000,
    maxOutputTokens: 100000,
    inputPrice: 15,
    outputPrice: 60,
  },
  {
    id: "o1-mini",
    name: "o1-mini",
    provider: "openai",
    description: "Efficient reasoning model",
    contextLength: 128000,
    maxOutputTokens: 65536,
    inputPrice: 3,
    outputPrice: 12,
  },
  {
    id: "o3-mini",
    name: "o3-mini",
    provider: "openai",
    description: "Latest efficient reasoning model",
    contextLength: 200000,
    maxOutputTokens: 100000,
  },

  // Anthropic Models
  {
    id: "claude-sonnet-4-5-20250514",
    name: "Claude 4.5 Sonnet",
    provider: "anthropic",
    description: "Most intelligent Claude model with extended thinking",
    contextLength: 200000,
    maxOutputTokens: 16384,
    inputPrice: 3,
    outputPrice: 15,
  },
  {
    id: "claude-opus-4-5-20250514",
    name: "Claude 4.5 Opus",
    provider: "anthropic",
    description: "Most capable Claude model for complex tasks",
    contextLength: 200000,
    maxOutputTokens: 32000,
    inputPrice: 15,
    outputPrice: 75,
  },
  {
    id: "claude-3-5-sonnet-20241022",
    name: "Claude 3.5 Sonnet",
    provider: "anthropic",
    description: "High-performance Claude 3.5 model",
    contextLength: 200000,
    maxOutputTokens: 8192,
    inputPrice: 3,
    outputPrice: 15,
  },
  {
    id: "claude-3-5-haiku-20241022",
    name: "Claude 3.5 Haiku",
    provider: "anthropic",
    description: "Fast and efficient Claude model",
    contextLength: 200000,
    maxOutputTokens: 8192,
    inputPrice: 0.8,
    outputPrice: 4,
  },
  {
    id: "claude-3-opus-20240229",
    name: "Claude 3 Opus",
    provider: "anthropic",
    description: "Most capable Claude 3 model",
    contextLength: 200000,
    maxOutputTokens: 4096,
    inputPrice: 15,
    outputPrice: 75,
  },
  {
    id: "claude-3-sonnet-20240229",
    name: "Claude 3 Sonnet",
    provider: "anthropic",
    description: "Balanced Claude 3 model",
    contextLength: 200000,
    maxOutputTokens: 4096,
    inputPrice: 3,
    outputPrice: 15,
  },
  {
    id: "claude-3-haiku-20240307",
    name: "Claude 3 Haiku",
    provider: "anthropic",
    description: "Fast Claude 3 model",
    contextLength: 200000,
    maxOutputTokens: 4096,
    inputPrice: 0.25,
    outputPrice: 1.25,
  },

  // Ollama Models (common ones)
  {
    id: "llama3.3",
    name: "Llama 3.3",
    provider: "ollama",
    description: "Meta's latest Llama model",
    contextLength: 128000,
  },
  {
    id: "llama3.2",
    name: "Llama 3.2",
    provider: "ollama",
    description: "Meta's Llama 3.2",
    contextLength: 128000,
  },
  {
    id: "llama3.1",
    name: "Llama 3.1",
    provider: "ollama",
    description: "Meta's Llama 3.1",
    contextLength: 128000,
  },
  {
    id: "qwen2.5",
    name: "Qwen 2.5",
    provider: "ollama",
    description: "Alibaba's Qwen 2.5",
    contextLength: 128000,
  },
  {
    id: "deepseek-r1",
    name: "DeepSeek R1",
    provider: "ollama",
    description: "DeepSeek reasoning model",
    contextLength: 64000,
  },
  {
    id: "deepseek-coder-v2",
    name: "DeepSeek Coder V2",
    provider: "ollama",
    description: "DeepSeek coding model",
    contextLength: 128000,
  },
  {
    id: "mistral",
    name: "Mistral",
    provider: "ollama",
    description: "Mistral AI's base model",
    contextLength: 32000,
  },
  {
    id: "mixtral",
    name: "Mixtral",
    provider: "ollama",
    description: "Mistral AI's MoE model",
    contextLength: 32000,
  },
  {
    id: "codellama",
    name: "Code Llama",
    provider: "ollama",
    description: "Meta's coding model",
    contextLength: 16384,
  },
  {
    id: "gemma2",
    name: "Gemma 2",
    provider: "ollama",
    description: "Google's Gemma 2",
    contextLength: 8192,
  },
  {
    id: "phi3",
    name: "Phi-3",
    provider: "ollama",
    description: "Microsoft's Phi-3",
    contextLength: 128000,
  },

  // OpenRouter popular models
  {
    id: "openrouter/auto",
    name: "Auto (Best Available)",
    provider: "openrouter",
    description: "Automatically select best model",
  },
  {
    id: "anthropic/claude-3.5-sonnet",
    name: "Claude 3.5 Sonnet (OpenRouter)",
    provider: "openrouter",
    description: "Claude 3.5 Sonnet via OpenRouter",
    contextLength: 200000,
    maxOutputTokens: 8192,
  },
  {
    id: "openai/gpt-4o",
    name: "GPT-4o (OpenRouter)",
    provider: "openrouter",
    description: "GPT-4o via OpenRouter",
    contextLength: 128000,
    maxOutputTokens: 16384,
  },
  {
    id: "google/gemini-2.0-flash-exp",
    name: "Gemini 2.0 Flash",
    provider: "openrouter",
    description: "Google Gemini 2.0 Flash via OpenRouter",
    contextLength: 1000000,
    maxOutputTokens: 8192,
  },
  {
    id: "deepseek/deepseek-r1",
    name: "DeepSeek R1 (OpenRouter)",
    provider: "openrouter",
    description: "DeepSeek R1 via OpenRouter",
    contextLength: 64000,
  },
];

/**
 * Default model aliases for convenience
 */
export const DEFAULT_ALIASES: Record<string, string> = {
  "gpt4": "gpt-4o",
  "gpt4o": "gpt-4o",
  "gpt4-mini": "gpt-4o-mini",
  "gpt35": "gpt-3.5-turbo",
  "claude": "claude-sonnet-4-5-20250514",
  "sonnet": "claude-sonnet-4-5-20250514",
  "sonnet-4.5": "claude-sonnet-4-5-20250514",
  "opus": "claude-opus-4-5-20250514",
  "opus-4.5": "claude-opus-4-5-20250514",
  "haiku": "claude-3-5-haiku-20241022",
  "sonnet-3.5": "claude-3-5-sonnet-20241022",
  "opus-3": "claude-3-opus-20240229",
};

/**
 * Get a known model by ID
 */
export function getKnownModel(id: string): KnownModel | undefined {
  return KNOWN_MODELS.find((m) => m.id === id);
}

/**
 * Get all models for a provider
 */
export function getModelsByProvider(provider: string): KnownModel[] {
  return KNOWN_MODELS.filter((m) => m.provider === provider);
}
