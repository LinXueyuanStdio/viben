/**
 * Known model definitions for quick reference
 */
import type { KnownModel } from "./types";

export const KNOWN_MODELS: KnownModel[] = [
  // OpenAI Models
  {
    id: "gpt-4o",
    name: "GPT-4o",
    provider: "openai",
    contextLength: 128000,
    maxOutputTokens: 16384,
    inputPrice: 2.5,
    outputPrice: 10,
  },
  {
    id: "gpt-4o-mini",
    name: "GPT-4o Mini",
    provider: "openai",
    contextLength: 128000,
    maxOutputTokens: 16384,
    inputPrice: 0.15,
    outputPrice: 0.6,
  },
  {
    id: "gpt-4-turbo",
    name: "GPT-4 Turbo",
    provider: "openai",
    contextLength: 128000,
    maxOutputTokens: 4096,
    inputPrice: 10,
    outputPrice: 30,
  },
  {
    id: "gpt-3.5-turbo",
    name: "GPT-3.5 Turbo",
    provider: "openai",
    contextLength: 16385,
    maxOutputTokens: 4096,
    inputPrice: 0.5,
    outputPrice: 1.5,
  },
  {
    id: "o1",
    name: "OpenAI o1",
    provider: "openai",
    contextLength: 200000,
    maxOutputTokens: 100000,
    inputPrice: 15,
    outputPrice: 60,
  },
  {
    id: "o1-mini",
    name: "OpenAI o1-mini",
    provider: "openai",
    contextLength: 128000,
    maxOutputTokens: 65536,
    inputPrice: 3,
    outputPrice: 12,
  },

  // Anthropic Models
  {
    id: "claude-3-5-sonnet-20241022",
    name: "Claude 3.5 Sonnet",
    provider: "anthropic",
    contextLength: 200000,
    maxOutputTokens: 8192,
    inputPrice: 3,
    outputPrice: 15,
  },
  {
    id: "claude-3-5-haiku-20241022",
    name: "Claude 3.5 Haiku",
    provider: "anthropic",
    contextLength: 200000,
    maxOutputTokens: 8192,
    inputPrice: 0.8,
    outputPrice: 4,
  },
  {
    id: "claude-3-opus-20240229",
    name: "Claude 3 Opus",
    provider: "anthropic",
    contextLength: 200000,
    maxOutputTokens: 4096,
    inputPrice: 15,
    outputPrice: 75,
  },
  {
    id: "claude-3-sonnet-20240229",
    name: "Claude 3 Sonnet",
    provider: "anthropic",
    contextLength: 200000,
    maxOutputTokens: 4096,
    inputPrice: 3,
    outputPrice: 15,
  },
  {
    id: "claude-3-haiku-20240307",
    name: "Claude 3 Haiku",
    provider: "anthropic",
    contextLength: 200000,
    maxOutputTokens: 4096,
    inputPrice: 0.25,
    outputPrice: 1.25,
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
  "claude": "claude-3-5-sonnet-20241022",
  "sonnet": "claude-3-5-sonnet-20241022",
  "haiku": "claude-3-5-haiku-20241022",
  "opus": "claude-3-opus-20240229",
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
