/**
 * Shared YAML storage for provider instances and their models.
 */
import { getModelsPath, getProvidersPath } from "./paths";
import { fileExists, readYaml, writeYaml } from "./yaml";
import type { ProviderEntry, ProvidersFile } from "../providers/types";
import type { ModelConfigEntry, ModelEntry, ModelSurface } from "../models/types";

export const MODELS_METADATA_KEY = "__viben";

export interface UnifiedModelEntry {
  name: string;
  enabled?: boolean;
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

function normalizeModelEntry(id: string, value: unknown): UnifiedModelEntry {
  if (typeof value === "string") {
    return { name: value, enabled: true };
  }
  if (isRecord(value)) {
    const name = typeof value.name === "string"
      ? value.name
      : typeof value.model_name === "string"
        ? value.model_name
        : id;
    return {
      name,
      enabled: typeof value.enabled === "boolean" ? value.enabled : true,
    };
  }
  return { name: id, enabled: true };
}

function normalizeProviderEntry(id: string, value: unknown): UnifiedProviderEntry | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const rawModels = isRecord(value.models) ? value.models : {};
  const models: Record<string, UnifiedModelEntry> = {};
  for (const [modelId, modelValue] of Object.entries(rawModels)) {
    models[modelId] = normalizeModelEntry(modelId, modelValue);
  }

  const name = typeof value.provider_name === "string"
    ? value.provider_name
    : typeof value.name === "string"
      ? value.name
      : id;
  const type = typeof value.type === "string"
    ? value.type
    : typeof value.provider_type === "string"
      ? value.provider_type
      : undefined;
  if (!type) {
    return undefined;
  }
  const apiKey = typeof value.api_key === "string"
    ? value.api_key
    : typeof value.apiKey === "string"
      ? value.apiKey
      : undefined;

  return {
    id: typeof value.id === "string" ? value.id : id,
    type,
    name,
    base_url: typeof value.base_url === "string" ? value.base_url : undefined,
    api_key: apiKey,
    category: typeof value.category === "string" ? value.category : undefined,
    api_version: typeof value.api_version === "string" ? value.api_version : undefined,
    deployment: typeof value.deployment === "string" ? value.deployment : undefined,
    timeout: typeof value.timeout === "number" ? value.timeout : undefined,
    max_retries: typeof value.max_retries === "number" ? value.max_retries : undefined,
    headers: isRecord(value.headers) ? value.headers as Record<string, string> : undefined,
    surfaces: Array.isArray(value.surfaces) ? value.surfaces.filter((item): item is string => typeof item === "string") : undefined,
    supports_custom_model: typeof value.supports_custom_model === "boolean" ? value.supports_custom_model : undefined,
    enabled: typeof value.enabled === "boolean" ? value.enabled : undefined,
    created_at: typeof value.created_at === "string" ? value.created_at : undefined,
    updated_at: typeof value.updated_at === "string" ? value.updated_at : undefined,
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
      const entry = modelEntry as ModelEntry;
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

function mergeLegacyProviders(file: UnifiedModelsFile, legacy: ProvidersFile | undefined): void {
  if (!legacy) {
    return;
  }

  for (const [providerId, providerEntry] of Object.entries(legacy.providers ?? {})) {
    const existingModels = normalizeProviderEntry(providerId, file[providerId])?.models ?? {};
    file[providerId] = {
      id: providerId,
      type: providerEntry.provider_type ?? providerEntry.type ?? "",
      name: providerEntry.name,
      base_url: providerEntry.base_url,
      api_key: providerEntry.api_key,
      category: providerEntry.category,
      api_version: providerEntry.api_version,
      deployment: providerEntry.deployment,
      timeout: providerEntry.timeout,
      max_retries: providerEntry.max_retries,
      headers: providerEntry.headers,
      surfaces: providerEntry.surfaces,
      supports_custom_model: providerEntry.supports_custom_model,
      enabled: providerEntry.enabled,
      created_at: providerEntry.created_at,
      updated_at: providerEntry.updated_at,
      models: existingModels,
    };
  }

  if (legacy.default) {
    file[MODELS_METADATA_KEY] = {
      ...(file[MODELS_METADATA_KEY] ?? {}),
      default_provider: file[MODELS_METADATA_KEY]?.default_provider ?? legacy.default,
    };
  }
}

export async function loadUnifiedModelsFile(): Promise<UnifiedModelsFile> {
  const rawModels = fileExists(getModelsPath()) ? await readYaml<unknown>(getModelsPath()) : undefined;
  const file = normalizeModelsYaml(rawModels);

  if (fileExists(getProvidersPath())) {
    const legacyProviders = await readYaml<ProvidersFile>(getProvidersPath());
    mergeLegacyProviders(file, legacyProviders);
  }

  return file;
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
  if (normalized[MODELS_METADATA_KEY]) {
    output[MODELS_METADATA_KEY] = normalized[MODELS_METADATA_KEY];
  }
  await writeYaml(getModelsPath(), output);
}

export function getUnifiedProviders(file: UnifiedModelsFile): Record<string, UnifiedProviderEntry> {
  const providers: Record<string, UnifiedProviderEntry> = {};
  for (const [providerId, providerValue] of Object.entries(file)) {
    if (providerId === MODELS_METADATA_KEY) continue;
    const provider = normalizeProviderEntry(providerId, providerValue);
    if (provider) {
      providers[providerId] = provider;
    }
  }
  return providers;
}
