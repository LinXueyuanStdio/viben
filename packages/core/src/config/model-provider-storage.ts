/**
 * Shared YAML storage for provider instances and their models.
 */
import { getModelsPath } from "./paths";
import { fileExists, readYaml, writeYaml } from "./yaml";
import type { ModelConfigEntry, ModelEntry } from "../models/types";

export interface UnifiedModelEntry {
  name: string;
  enabled?: boolean;
  config?: ModelConfigEntry;
}

export interface UnifiedProviderEntry {
  id: string;
  type: string;
  base_url?: string;
  api_key?: string;
  models: Record<string, UnifiedModelEntry>;
  category?: string;
  api_version?: string;
  deployment?: string;
  timeout?: number;
  max_retries?: number;
  headers?: Record<string, string>;
  surfaces?: string[];
  supports_custom_model?: boolean;
  is_default?: boolean;
  enabled?: boolean;
  created_at?: string;
  updated_at?: string;
  name?: string;
}

export type UnifiedModelsFile = Record<string, UnifiedProviderEntry>;

const LEGACY_MODELS_KEYS = new Set([
  "default",
  "defaults",
  "aliases",
  "fallbacks",
  "fallbacks_by_surface",
  "configs",
  "model_config",
  "custom_models",
  "disabled_models",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonBlankString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function normalizeModelConfig(value: unknown): ModelConfigEntry | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  return value as ModelConfigEntry;
}

function normalizeModelEntry(id: string, value: unknown): UnifiedModelEntry {
  if (typeof value === "string") {
    return { name: value, enabled: true };
  }
  if (isRecord(value)) {
    const name = nonBlankString(value.name) ?? nonBlankString(value.model_name) ?? id;
    const entry: UnifiedModelEntry = {
      name,
      enabled: typeof value.enabled === "boolean" ? value.enabled : true,
    };
    const config = normalizeModelConfig(value.config);
    if (config) {
      entry.config = config;
    }
    return entry;
  }
  return { name: id, enabled: true };
}

function normalizeProviderEntry(id: string, value: unknown): UnifiedProviderEntry | undefined {
  const providerId = nonBlankString(id);
  if (!providerId || !isRecord(value)) {
    return undefined;
  }

  const rawModels = isRecord(value.models) ? value.models : {};
  const models: Record<string, UnifiedModelEntry> = {};
  for (const [modelId, modelValue] of Object.entries(rawModels)) {
    models[modelId] = normalizeModelEntry(modelId, modelValue);
  }

  const name = nonBlankString(value.provider_name) ?? nonBlankString(value.name) ?? providerId;
  const type = nonBlankString(value.type) ?? nonBlankString(value.provider_type);
  if (!type) {
    return undefined;
  }
  const apiKey = nonBlankString(value.api_key) ?? nonBlankString(value.apiKey);

  return {
    id: providerId,
    type,
    name,
    base_url: nonBlankString(value.base_url),
    api_key: apiKey,
    category: nonBlankString(value.category),
    api_version: nonBlankString(value.api_version),
    deployment: nonBlankString(value.deployment),
    timeout: typeof value.timeout === "number" ? value.timeout : undefined,
    max_retries: typeof value.max_retries === "number" ? value.max_retries : undefined,
    headers: isRecord(value.headers) ? value.headers as Record<string, string> : undefined,
    surfaces: Array.isArray(value.surfaces) ? value.surfaces.filter((item): item is string => typeof item === "string") : undefined,
    supports_custom_model: typeof value.supports_custom_model === "boolean" ? value.supports_custom_model : undefined,
    is_default: typeof value.is_default === "boolean" ? value.is_default : undefined,
    enabled: typeof value.enabled === "boolean" ? value.enabled : undefined,
    created_at: nonBlankString(value.created_at),
    updated_at: nonBlankString(value.updated_at),
    models,
  };
}

function ensureProvider(file: UnifiedModelsFile, providerId: string, providerType: string): UnifiedProviderEntry {
  if (!providerId) {
    throw new Error("Provider ID is required");
  }
  if (!providerType) {
    throw new Error("Provider type is required");
  }
  const existing = normalizeProviderEntry(providerId, file[providerId]) ?? {
    id: providerId,
    type: providerType,
    name: providerId,
    models: {},
  };

  if (!existing.models) {
    existing.models = {};
  }
  file[providerId] = existing;
  return existing;
}

function normalizeModelsYaml(raw: unknown): UnifiedModelsFile {
  const file = {} as UnifiedModelsFile;
  if (!isRecord(raw)) {
    return file;
  }

  const legacyConfigs = isRecord(raw.configs)
    ? raw.configs as Record<string, ModelConfigEntry>
    : isRecord(raw.model_config)
      ? raw.model_config as Record<string, ModelConfigEntry>
      : {};

  if (isRecord(raw.custom_models)) {
    for (const [modelId, modelEntry] of Object.entries(raw.custom_models)) {
      if (!isRecord(modelEntry)) continue;
      const entry = modelEntry as unknown as ModelEntry;
      const providerType = entry.provider;
      if (!providerType) continue;
      const providerId = entry.provider_id;
      if (!providerId) continue;
      const provider = ensureProvider(file, providerId, providerType);
      const legacyConfig = legacyConfigs[`${providerId}:${modelId}`] ?? legacyConfigs[modelId];
      provider.models = {
        ...(provider.models ?? {}),
        [modelId]: {
          name: entry.name ?? modelId,
          enabled: entry.enabled ?? true,
          ...(legacyConfig ? { config: legacyConfig } : {}),
        },
      };
    }
  }

  for (const [providerId, providerValue] of Object.entries(raw)) {
    if (LEGACY_MODELS_KEYS.has(providerId)) {
      continue;
    }
    const provider = normalizeProviderEntry(providerId, providerValue);
    if (provider) {
      for (const [modelId, modelEntry] of Object.entries(provider.models ?? {})) {
        const legacyConfig = legacyConfigs[`${providerId}:${modelId}`] ?? legacyConfigs[modelId];
        if (legacyConfig && !modelEntry.config) {
          provider.models[modelId] = {
            ...modelEntry,
            config: legacyConfig,
          };
        }
      }
      file[providerId] = provider;
    }
  }

  return file;
}

export async function loadUnifiedModelsFile(): Promise<UnifiedModelsFile> {
  const rawModels = fileExists(getModelsPath()) ? await readYaml<unknown>(getModelsPath()) : undefined;
  return normalizeModelsYaml(rawModels);
}

export async function saveUnifiedModelsFile(file: UnifiedModelsFile): Promise<void> {
  const normalized = normalizeModelsYaml(file);
  const output = {} as UnifiedModelsFile;
  for (const [providerId, provider] of Object.entries(getUnifiedProviders(normalized))) {
    output[providerId] = {
      id: providerId,
      type: provider.type,
      base_url: provider.base_url,
      api_key: provider.api_key,
      models: provider.models ?? {},
    };
  }
  await writeYaml(getModelsPath(), output);
}

export function getUnifiedProviders(file: UnifiedModelsFile): Record<string, UnifiedProviderEntry> {
  const providers: Record<string, UnifiedProviderEntry> = {};
  for (const [providerId, providerValue] of Object.entries(file)) {
    if (LEGACY_MODELS_KEYS.has(providerId)) continue;
    const provider = normalizeProviderEntry(providerId, providerValue);
    if (provider) {
      providers[providerId] = provider;
    }
  }
  return providers;
}
