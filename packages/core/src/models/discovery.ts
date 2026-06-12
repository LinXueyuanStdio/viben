/**
 * Model discovery module
 *
 * Discovers models from provider APIs.
 */
import type { Model } from "../types";
import type { ProviderType } from "../types";
import { providerManager } from "../providers";
import { proxyFetch } from "../http";

/**
 * Discovered model from an API
 */
export interface DiscoveredModel {
  /** Model ID */
  id: string;
  /** Display name */
  name?: string;
  /** Creation timestamp (if available) */
  created_at?: number;
  /** Owner/organization */
  owned_by?: string;
  /** Model capabilities */
  capabilities?: string[];
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Discovery result
 */
export interface DiscoveryResult {
  /** Provider ID */
  providerId: string;
  /** Provider type */
  providerType: ProviderType;
  /** Discovered models */
  models: DiscoveredModel[];
  /** Error if discovery failed */
  error?: string;
}

/**
 * OpenAI models response type
 */
interface OpenAIModelsResponse {
  data: Array<{
    id: string;
    created?: number;
    owned_by?: string;
  }>;
}

/**
 * Discover models from OpenAI API
 */
async function discoverOpenAI(
  apiKey: string,
  baseUrl = "https://api.openai.com/v1"
): Promise<DiscoveredModel[]> {
  const response = await proxyFetch(`${baseUrl}/models`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as OpenAIModelsResponse;
  const models: DiscoveredModel[] = [];

  for (const model of data.data || []) {
    models.push({
      id: model.id,
      name: model.id,
      created_at: model.created,
      owned_by: model.owned_by,
    });
  }

  return models;
}

/**
 * Discover models from Anthropic API
 *
 * Note: Anthropic doesn't have a models list endpoint.
 */
async function discoverAnthropic(_apiKey: string, _baseUrl?: string): Promise<DiscoveredModel[]> {
  return [];
}

/**
 * Ollama models response type
 */
interface OllamaModelsResponse {
  models: Array<{
    name: string;
    size?: number;
    digest?: string;
    modified_at?: string;
  }>;
}

/**
 * Discover models from Ollama
 */
async function discoverOllama(baseUrl = "http://localhost:11434"): Promise<DiscoveredModel[]> {
  const response = await proxyFetch(`${baseUrl}/api/tags`);

  if (!response.ok) {
    throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as OllamaModelsResponse;
  const models: DiscoveredModel[] = [];

  for (const model of data.models || []) {
    models.push({
      id: model.name,
      name: model.name,
      metadata: {
        size: model.size,
        digest: model.digest,
        modifiedAt: model.modified_at,
      },
    });
  }

  return models;
}

/**
 * OpenRouter models response type
 */
interface OpenRouterModelsResponse {
  data: Array<{
    id: string;
    name?: string;
    context_length?: number;
    pricing?: unknown;
    architecture?: unknown;
  }>;
}

/**
 * Discover models from OpenRouter
 */
async function discoverOpenRouter(apiKey: string): Promise<DiscoveredModel[]> {
  const response = await proxyFetch("https://openrouter.ai/api/v1/models", {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(`OpenRouter API error: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as OpenRouterModelsResponse;
  const models: DiscoveredModel[] = [];

  for (const model of data.data || []) {
    models.push({
      id: model.id,
      name: model.name || model.id,
      metadata: {
        contextLength: model.context_length,
        pricing: model.pricing,
        architecture: model.architecture,
      },
    });
  }

  return models;
}

/**
 * Google AI models response type
 */
interface GoogleAIModelsResponse {
  models: Array<{
    name?: string;
    displayName?: string;
    supportedGenerationMethods?: string[];
    description?: string;
    inputTokenLimit?: number;
    outputTokenLimit?: number;
    temperature?: number;
    topP?: number;
    topK?: number;
  }>;
}

/**
 * Discover models from Google AI (Gemini)
 */
async function discoverGoogle(apiKey: string): Promise<DiscoveredModel[]> {
  const response = await proxyFetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
  );

  if (!response.ok) {
    throw new Error(`Google AI API error: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as GoogleAIModelsResponse;
  const models: DiscoveredModel[] = [];

  for (const model of data.models || []) {
    models.push({
      id: model.name?.replace("models/", "") || model.name || "",
      name: model.displayName,
      capabilities: model.supportedGenerationMethods,
      metadata: {
        description: model.description,
        inputTokenLimit: model.inputTokenLimit,
        outputTokenLimit: model.outputTokenLimit,
        temperature: model.temperature,
        topP: model.topP,
        topK: model.topK,
      },
    });
  }

  return models;
}

/**
 * Discover models from Azure OpenAI
 *
 * Azure doesn't have a public models list endpoint.
 * Deployments are user-specific — returns empty.
 */
async function discoverAzure(): Promise<DiscoveredModel[]> {
  return [];
}

/**
 * Discover models from a provider
 *
 * @param providerId - The provider ID to discover models from
 * @returns Discovery result with models or error
 */
export async function discoverModels(providerId: string): Promise<DiscoveryResult> {
  const provider = await providerManager.getProvider(providerId);
  if (!provider) {
    return {
      providerId,
      providerType: "custom",
      models: [],
      error: `Provider not found: ${providerId}`,
    };
  }

  const providerType = provider.type as ProviderType;
  const apiKey = provider.apiKey || "";
  const baseUrl = provider.base_url;

  try {
    let models: DiscoveredModel[] = [];

    switch (providerType) {
      case "openai":
        models = await discoverOpenAI(apiKey, baseUrl);
        break;
      case "anthropic":
        models = await discoverAnthropic(apiKey, baseUrl);
        break;
      case "ollama":
        models = await discoverOllama(baseUrl || "http://localhost:11434");
        break;
      case "openrouter":
        models = await discoverOpenRouter(apiKey);
        break;
      case "google":
        models = await discoverGoogle(apiKey);
        break;
      case "azure":
        models = await discoverAzure();
        break;
      case "custom":
        if (baseUrl) {
          models = await discoverOpenAI(apiKey, baseUrl);
        }
        break;
      default:
        return {
          providerId,
          providerType,
          models: [],
          error: `Unsupported provider type: ${providerType}`,
        };
    }

    return {
      providerId,
      providerType,
      models,
    };
  } catch (e) {
    return {
      providerId,
      providerType,
      models: [],
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

/**
 * Discover models from all configured providers
 *
 * @returns Array of discovery results for each provider
 */
export async function discoverAllModels(): Promise<DiscoveryResult[]> {
  const providers = await providerManager.listProviders();
  const results: DiscoveryResult[] = [];

  for (const provider of providers) {
    const result = await discoverModels(provider.id);
    results.push(result);
  }

  return results;
}

/**
 * Enrich discovered models with stored model information
 */
export function enrichModel(discovered: DiscoveredModel): Model | DiscoveredModel {
  return discovered;
}
