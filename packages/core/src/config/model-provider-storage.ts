/**
 * Shared YAML storage for provider instances and their models.
 */
import { getModelsPath, getProvidersPath } from "./paths";
import { fileExists, readYaml, writeYaml } from "./yaml";
import type { ProviderEntry, ProvidersFile } from "../providers/types";
import type { ModelConfigEntry, ModelEntry, ModelSurface } from "../models/types";

export const MODELS_METADATA_KEY = "__viben";

export interface UnifiedModelEntry extends Partial<ModelEntry> {
  model_name?: string;
  is_default?: boolean;
}

export interface UnifiedProviderEntry extends Partial<Omit<ProviderEntry, "name">> {
  provider_name?: string;
  name?: string;
  is_default?: boolean;
  models?: Record<string, UnifiedModelEntry | string>;
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

function normalizeModelEntry(id: string, value: UnifiedModelEntry | string): UnifiedModelEntry {
  if (typeof value === "string") {
    return {
      model_name: value,
      name: value,
      enabled: true,
    };
  }

  return {
    ...value,
    model_name: value.model_name ?? value.name ?? id,
    name: value.name ?? value.model_name ?? id,
    enabled: value.enabled ?? true,
  };
}

function normalizeProviderEntry(id: string, value: unknown): UnifiedProviderEntry | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const rawModels = isRecord(value.models) ? value.models : {};
  const models: Record<string, UnifiedModelEntry> = {};
  for (const [modelId, modelValue] of Object.entries(rawModels)) {
    if (typeof modelValue === "string" || isRecord(modelValue)) {
      models[modelId] = normalizeModelEntry(modelId, modelValue as UnifiedModelEntry | string);
    }
  }

  const providerName = typeof value.provider_name === "string"
    ? value.provider_name
    : typeof value.name === "string"
      ? value.name
      : id;
  const providerType = typeof value.provider_type === "string"
    ? value.provider_type
    : typeof value.type === "string"
      ? value.type
      : id;
  const apiKey = typeof value.api_key === "string"
    ? value.api_key
    : typeof value.apiKey === "string"
      ? value.apiKey
      : undefined;

  const entry: UnifiedProviderEntry = {
    ...(value as UnifiedProviderEntry),
    provider_name: providerName,
    name: typeof value.name === "string" ? value.name : providerName,
    provider_type: providerType,
    api_key: apiKey,
    enabled: typeof value.enabled === "boolean" ? value.enabled : true,
    models,
  };
  delete (entry as Record<string, unknown>).apiKey;
  return entry;
}

function ensureProvider(file: UnifiedModelsFile, providerId: string, providerType: string): UnifiedProviderEntry {
  const existing = normalizeProviderEntry(providerId, file[providerId]) ?? {
    provider_name: providerId,
    name: providerId,
    provider_type: providerType,
    enabled: true,
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
      const providerId = entry.provider_id ?? providerType;
      const provider = ensureProvider(file, providerId, providerType);
      provider.models = {
        ...(provider.models ?? {}),
        [modelId]: {
          ...entry,
          model_name: entry.name ?? modelId,
          name: entry.name ?? modelId,
          is_default: metadata.default_model === modelId,
        },
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
      ...providerEntry,
      provider_name: providerEntry.name,
      name: providerEntry.name,
      is_default: legacy.default === providerId,
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
  await writeYaml(getModelsPath(), normalized);
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
