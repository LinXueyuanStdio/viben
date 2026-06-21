/**
 * Shared YAML storage for provider instances and their models.
 */
import { getModelsPath } from "./paths";
import { fileExists, readYaml, writeYaml } from "./yaml";
import type { ModelConfigEntry, ModelEntry, ModelSurface } from "../models/types";

export const MODELS_METADATA_KEY = "__viben";

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
  enabled?: boolean;
  created_at?: string;
  updated_at?: string;
  name?: string;
}

export interface UnifiedModelsMetadata {
  aliases?: Record<string, string>;
  fallbacks?: string[];
  fallbacks_by_surface?: Partial<Record<ModelSurface, string[]>>;
  configs?: Record<string, ModelConfigEntry>;
  default_provider?: string;
  default_model?: string;
  defaults?: {
    llm?: string;
    media?: Partial<Record<ModelSurface, string>>;
  };
  disabled_models?: string[];
}

export type UnifiedModelsFile = Record<string, UnifiedProviderEntry> & {
  [MODELS_METADATA_KEY]?: UnifiedModelsMetadata;
};

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
    id: nonBlankString(value.id) ?? providerId,
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
    enabled: typeof value.enabled === "boolean" ? value.enabled : undefined,
    created_at: nonBlankString(value.created_at),
    updated_at: nonBlankString(value.updated_at),
    models,
  };
}

function ensureProvider(file: UnifiedModelsFile, providerId: string, providerType: string): UnifiedProviderEntry {
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

  const metadata: UnifiedModelsMetadata = {};
  if (typeof raw.default === "string") {
    metadata.default_model = raw.default;
  }
  if (isRecord(raw.defaults)) {
    metadata.defaults = raw.defaults as UnifiedModelsMetadata["defaults"];
  }
  if (isRecord(raw.aliases)) {
    metadata.aliases = raw.aliases as Record<string, string>;
  }
  if (Array.isArray(raw.fallbacks)) {
    metadata.fallbacks = raw.fallbacks.filter((item): item is string => typeof item === "string");
  }
  if (isRecord(raw.fallbacks_by_surface)) {
    metadata.fallbacks_by_surface = raw.fallbacks_by_surface as Partial<Record<ModelSurface, string[]>>;
  }
  if (isRecord(raw.configs)) {
    metadata.configs = raw.configs as Record<string, ModelConfigEntry>;
  } else if (isRecord(raw.model_config)) {
    metadata.configs = raw.model_config as Record<string, ModelConfigEntry>;
  }
  if (Array.isArray(raw.disabled_models)) {
    metadata.disabled_models = raw.disabled_models.filter((item): item is string => typeof item === "string");
  }

  if (isRecord(raw[MODELS_METADATA_KEY])) {
    Object.assign(metadata, raw[MODELS_METADATA_KEY]);
  }

  if (isRecord(raw.custom_models)) {
    for (const [modelId, modelEntry] of Object.entries(raw.custom_models)) {
      if (!isRecord(modelEntry)) continue;
      const entry = modelEntry as unknown as ModelEntry;
      const providerType = entry.provider;
      if (!providerType) continue;
      const providerId = entry.provider_id;
      if (!providerId) continue;
      const provider = ensureProvider(file, providerId, providerType);
      provider.models = {
        ...(provider.models ?? {}),
        [modelId]: { name: entry.name ?? modelId, enabled: entry.enabled ?? true },
      };
    }
  }

  for (const [providerId, providerValue] of Object.entries(raw)) {
    if (providerId === MODELS_METADATA_KEY || LEGACY_MODELS_KEYS.has(providerId)) {
      continue;
    }
    const provider = normalizeProviderEntry(providerId, providerValue);
    if (provider) {
      file[providerId] = provider;
    }
  }

  if (Object.keys(metadata).length > 0) {
    file[MODELS_METADATA_KEY] = metadata;
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
      id: provider.id,
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
    if (providerId === MODELS_METADATA_KEY || LEGACY_MODELS_KEYS.has(providerId)) continue;
    const provider = normalizeProviderEntry(providerId, providerValue);
    if (provider) {
      providers[providerId] = provider;
    }
  }
  return providers;
}
