/**
 * Model management for Viben
 */
import type { Model, ModelConfig } from "../types";
import {
  getUnifiedProviders,
  loadUnifiedModelsFile,
  MODELS_METADATA_KEY,
  saveUnifiedModelsFile,
  type UnifiedModelsFile,
  type UnifiedModelEntry,
  type UnifiedModelsMetadata,
  type UnifiedProviderEntry,
} from "../config/model-provider-storage";
import type {
  ModelCategory,
  ModelSurface,
} from "./types";
import { DEFAULT_ALIASES } from "./known-models";

export * from "./types";
export * from "./known-models";
export * from "./discovery";

function normalizeModelCategory(category: ModelCategory | undefined): ModelCategory {
  return category ?? "llm";
}

function normalizeModelSurface(
  surface: ModelSurface | undefined,
  category: ModelCategory
): ModelSurface | undefined {
  if (surface) return surface;
  return category === "llm" ? "chat" : undefined;
}

function emptyMetadata(): Required<Pick<UnifiedModelsMetadata, "aliases" | "fallbacks" | "configs" | "disabled_models">> & UnifiedModelsMetadata {
  return {
    aliases: { ...DEFAULT_ALIASES },
    fallbacks: [],
    fallbacks_by_surface: {},
    configs: {},
    disabled_models: [],
  };
}

function getMetadata(config: UnifiedModelsFile): Required<Pick<UnifiedModelsMetadata, "aliases" | "fallbacks" | "configs" | "disabled_models">> & UnifiedModelsMetadata {
  const metadata = {
    ...emptyMetadata(),
    ...(config[MODELS_METADATA_KEY] ?? {}),
  };
  metadata.aliases = {
    ...DEFAULT_ALIASES,
    ...(config[MODELS_METADATA_KEY]?.aliases ?? {}),
  };
  return metadata;
}

function setMetadata(config: UnifiedModelsFile, metadata: UnifiedModelsMetadata): void {
  config[MODELS_METADATA_KEY] = {
    ...(config[MODELS_METADATA_KEY] ?? {}),
    ...metadata,
  };
}

function modelFromEntry(
  id: string,
  entry: UnifiedModelEntry,
  providerId: string,
  provider: UnifiedProviderEntry,
  defaultModelId: string | undefined
): Model {
  const category = normalizeModelCategory(provider.category as ModelCategory | undefined);
  return {
    id,
    name: entry.name,
    provider: provider.type,
    provider_id: providerId,
    category,
    surface: normalizeModelSurface(undefined, category),
    isDefault: defaultModelId === id,
    enabled: entry.enabled ?? true,
  };
}

function modelEntryFromOptions(options: {
  name: string;
}): UnifiedModelEntry {
  return {
    name: options.name,
    enabled: true,
  };
}

function ensureProvider(
  config: UnifiedModelsFile,
  providerId: string,
  providerType: string
): UnifiedProviderEntry {
  const providers = getUnifiedProviders(config);
  const provider = providers[providerId] ?? {
    id: providerId,
    type: providerType,
    models: {},
  };
  provider.models = provider.models ?? {};
  config[providerId] = provider;
  return provider;
}

function findModelInProviders(
  config: UnifiedModelsFile,
  id: string
): { providerId: string; provider: UnifiedProviderEntry; entry: UnifiedModelEntry } | undefined {
  const providers = getUnifiedProviders(config);
  const defaultProvider = config[MODELS_METADATA_KEY]?.default_provider;

  const orderedProviderIds = [
    ...(defaultProvider && providers[defaultProvider] ? [defaultProvider] : []),
    ...Object.keys(providers).filter((providerId) => providerId !== defaultProvider),
  ];

  for (const providerId of orderedProviderIds) {
    const provider = providers[providerId];
    const model = provider.models?.[id];
    if (model) {
      return { providerId, provider, entry: model };
    }
  }
  return undefined;
}

/**
 * ModelManager handles model configuration and aliases
 */
export class ModelManager {
  private config: UnifiedModelsFile | undefined;

  /**
   * Load the models configuration
   */
  private async loadConfig(): Promise<UnifiedModelsFile> {
    if (this.config) {
      return this.config;
    }

    this.config = await loadUnifiedModelsFile();
    return this.config;
  }

  /**
   * Save the models configuration
   */
  private async saveConfig(config: UnifiedModelsFile): Promise<void> {
    await saveUnifiedModelsFile(config);
    this.config = await loadUnifiedModelsFile();
  }

  /**
   * Reload configuration from disk
   */
  async reload(): Promise<void> {
    this.config = undefined;
    await this.loadConfig();
  }

  // ========================================================================
  // Models
  // ========================================================================

  /**
   * List all configured models.
   */
  async listModels(): Promise<Model[]> {
    const config = await this.loadConfig();
    const metadata = getMetadata(config);
    const providers = getUnifiedProviders(config);
    const models: Model[] = [];

    for (const [providerId, provider] of Object.entries(providers)) {
      for (const [id, entry] of Object.entries(provider.models ?? {})) {
        models.push(modelFromEntry(id, entry, providerId, provider, metadata.default_model));
      }
    }

    return models;
  }

  /**
   * Get models by provider type
   */
  async getModelsByProvider(provider: string): Promise<Model[]> {
    const all = await this.listModels();
    return all.filter((m) => m.provider === provider);
  }

  /**
   * Get models by provider instance ID
   */
  async getModelsByProviderId(providerId: string): Promise<Model[]> {
    const all = await this.listModels();
    return all.filter((m) => m.provider_id === providerId);
  }

  async listModelsFiltered(filters: {
    provider?: string;
    category?: ModelCategory;
    surface?: ModelSurface;
  }): Promise<Model[]> {
    let models = await this.listModels();
    if (filters.provider) {
      models = models.filter((m) =>
        m.provider === filters.provider || m.provider_id === filters.provider
      );
    }
    if (filters.category) {
      models = models.filter((m) => normalizeModelCategory(m.category) === filters.category);
    }
    if (filters.surface) {
      models = models.filter((m) => m.surface === filters.surface);
    }
    return models;
  }

  /**
   * Get a model by ID
   */
  async getModel(id: string): Promise<Model | null> {
    const config = await this.loadConfig();
    const metadata = getMetadata(config);
    const found = findModelInProviders(config, id);

    if (found) {
      return modelFromEntry(id, found.entry, found.providerId, found.provider, metadata.default_model);
    }

    return null;
  }

  /**
   * Create a configured model under a provider instance.
   */
  async createModel(options: {
    id: string;
    name: string;
    provider: string;
    provider_id?: string;
    category?: ModelCategory;
    surface?: ModelSurface;
    capabilities?: string[];
    description?: string;
    contextWindow?: number;
    maxOutputTokens?: number;
    setAsDefault?: boolean;
  }): Promise<Model> {
    const config = await this.loadConfig();
    if (!options.provider_id) {
      throw new Error("Provider ID is required");
    }
    const providerId = options.provider_id;
    const provider = ensureProvider(config, providerId, options.provider);

    if (provider.models?.[options.id]) {
      throw new Error(`Model already exists: ${options.id}`);
    }

    const entry = modelEntryFromOptions({
      name: options.name,
    });

    provider.models = {
      ...(provider.models ?? {}),
      [options.id]: entry,
    };
    config[providerId] = provider;

    const isDefault = options.setAsDefault ?? false;
    if (isDefault) {
      setMetadata(config, { default_model: options.id });
    }

    await this.saveConfig(config);

    return {
      id: options.id,
      name: entry.name,
      provider: options.provider,
      provider_id: providerId,
      category: options.category,
      surface: options.surface,
      capabilities: options.capabilities,
      description: options.description,
      contextLength: options.contextWindow,
      maxOutputTokens: options.maxOutputTokens,
      isDefault,
      enabled: true,
    };
  }

  /**
   * Remove a model
   */
  async removeModel(id: string): Promise<void> {
    const config = await this.loadConfig();
    const found = findModelInProviders(config, id);

    if (!found) {
      throw new Error(`Model not found: ${id}`);
    }

    delete found.provider.models?.[id];
    config[found.providerId] = found.provider;

    const metadata = getMetadata(config);
    if (metadata.default_model === id) {
      setMetadata(config, { default_model: undefined });
    }

    await this.saveConfig(config);
  }

  /**
   * Update a model
   */
  async updateModel(
    id: string,
    updates: {
      name?: string;
      description?: string;
      contextWindow?: number;
      maxOutputTokens?: number;
    }
  ): Promise<Model> {
    const config = await this.loadConfig();

    const found = findModelInProviders(config, id);
    if (!found) {
      throw new Error(`Model not found: ${id}`);
    }

    const entry = { ...found.entry };

    if (updates.name !== undefined) {
      entry.name = updates.name;
    }
    found.provider.models = {
      ...(found.provider.models ?? {}),
      [id]: entry,
    };
    config[found.providerId] = found.provider;

    await this.saveConfig(config);

    const metadata = getMetadata(config);
    return {
      id,
      name: entry.name,
      provider: found.provider.type,
      provider_id: found.providerId,
      description: updates.description,
      contextLength: updates.contextWindow,
      maxOutputTokens: updates.maxOutputTokens,
      isDefault: metadata.default_model === id,
      enabled: true,
    };
  }

  /**
   * Enable a model
   */
  async enableModel(id: string, providerType: string, providerId?: string): Promise<void> {
    const config = await this.loadConfig();
    if (!providerId) {
      throw new Error("Provider ID is required");
    }
    const provider = ensureProvider(config, providerId, providerType);
    const existing = provider.models?.[id];

    provider.models = {
      ...(provider.models ?? {}),
      [id]: {
        name: existing?.name ?? id,
        enabled: true,
      },
    };
    config[providerId] = provider;

    await this.saveConfig(config);
  }

  /**
   * Disable a model
   */
  async disableModel(id: string, providerType: string, providerId?: string): Promise<void> {
    const config = await this.loadConfig();
    if (!providerId) {
      throw new Error("Provider ID is required");
    }
    const provider = ensureProvider(config, providerId, providerType);
    const existing = provider.models?.[id];
    provider.models = {
      ...(provider.models ?? {}),
      [id]: {
        name: existing?.name ?? id,
        enabled: false,
      },
    };
    config[providerId] = provider;

    await this.saveConfig(config);
  }

  /**
   * Get the default model
   */
  async getDefault(): Promise<string | undefined> {
    const config = await this.loadConfig();
    return getMetadata(config).default_model;
  }

  /**
   * Set the default model
   */
  async setDefault(model: string): Promise<void> {
    const config = await this.loadConfig();
    setMetadata(config, { default_model: model });
    await this.saveConfig(config);
  }

  async getDefaultForSurface(surface: ModelSurface): Promise<string | undefined> {
    const config = await this.loadConfig();
    const metadata = getMetadata(config);
    if (surface === "chat") {
      return metadata.defaults?.llm ?? metadata.default_model;
    }
    return metadata.defaults?.media?.[surface];
  }

  async setDefaultForSurface(surface: ModelSurface, model: string): Promise<void> {
    const config = await this.loadConfig();
    const metadata = getMetadata(config);
    const defaults = metadata.defaults ?? {};
    if (surface === "chat") {
      defaults.llm = model;
      setMetadata(config, { defaults, default_model: model });
    } else {
      defaults.media = {
        ...(defaults.media ?? {}),
        [surface]: model,
      };
      setMetadata(config, { defaults });
    }
    await this.saveConfig(config);
  }

  // ========================================================================
  // Aliases
  // ========================================================================

  /**
   * Get all model aliases
   */
  async getAliases(): Promise<Record<string, string>> {
    const config = await this.loadConfig();
    return { ...getMetadata(config).aliases };
  }

  /**
   * Create or update an alias
   */
  async createAlias(alias: string, model: string): Promise<void> {
    const config = await this.loadConfig();
    const metadata = getMetadata(config);
    metadata.aliases[alias] = model;
    setMetadata(config, { aliases: metadata.aliases });
    await this.saveConfig(config);
  }

  /**
   * Remove an alias
   */
  async removeAlias(alias: string): Promise<void> {
    const config = await this.loadConfig();
    const metadata = getMetadata(config);
    delete metadata.aliases[alias];
    setMetadata(config, { aliases: metadata.aliases });
    await this.saveConfig(config);
  }

  /**
   * Resolve an alias to the actual model ID
   * Returns the input if it's not an alias
   */
  async resolveAlias(aliasOrModel: string): Promise<string> {
    const config = await this.loadConfig();
    return getMetadata(config).aliases[aliasOrModel] || aliasOrModel;
  }

  /**
   * Resolve alias synchronously (uses cached config)
   */
  resolveAliasSync(aliasOrModel: string): string {
    if (!this.config) {
      return DEFAULT_ALIASES[aliasOrModel] || aliasOrModel;
    }
    return getMetadata(this.config).aliases[aliasOrModel] || aliasOrModel;
  }

  // ========================================================================
  // Fallbacks
  // ========================================================================

  /**
   * Get the fallback chain
   */
  async getFallbacks(): Promise<string[]> {
    const config = await this.loadConfig();
    return [...getMetadata(config).fallbacks];
  }

  /**
   * Add a model to the fallback chain
   */
  async addFallback(model: string): Promise<void> {
    const config = await this.loadConfig();
    const metadata = getMetadata(config);
    if (!metadata.fallbacks.includes(model)) {
      metadata.fallbacks.push(model);
      setMetadata(config, { fallbacks: metadata.fallbacks });
      await this.saveConfig(config);
    }
  }

  /**
   * Remove a model from the fallback chain
   */
  async removeFallback(model: string): Promise<void> {
    const config = await this.loadConfig();
    const metadata = getMetadata(config);
    const index = metadata.fallbacks.indexOf(model);
    if (index !== -1) {
      metadata.fallbacks.splice(index, 1);
      setMetadata(config, { fallbacks: metadata.fallbacks });
      await this.saveConfig(config);
    }
  }

  /**
   * Clear the fallback chain
   */
  async clearFallbacks(): Promise<void> {
    const config = await this.loadConfig();
    setMetadata(config, { fallbacks: [] });
    await this.saveConfig(config);
  }

  /**
   * Reorder fallbacks
   */
  async setFallbacks(fallbacks: string[]): Promise<void> {
    const config = await this.loadConfig();
    setMetadata(config, { fallbacks });
    await this.saveConfig(config);
  }

  // ========================================================================
  // Model Configs
  // ========================================================================

  /**
   * Get model-specific configuration
   */
  async getModelConfig(model: string): Promise<ModelConfig | null> {
    const config = await this.loadConfig();
    const metadata = getMetadata(config);
    const resolved = metadata.aliases[model] || model;
    return metadata.configs[resolved] || null;
  }

  /**
   * Set model-specific configuration
   */
  async setModelConfig(model: string, modelConfig: ModelConfig): Promise<void> {
    const config = await this.loadConfig();
    const metadata = getMetadata(config);
    const resolved = metadata.aliases[model] || model;

    metadata.configs[resolved] = {
      temperature: modelConfig.temperature,
      maxTokens: modelConfig.maxTokens,
      topP: modelConfig.topP,
      frequencyPenalty: modelConfig.frequencyPenalty,
      presencePenalty: modelConfig.presencePenalty,
      provider: modelConfig.provider,
      category: modelConfig.category,
      surface: modelConfig.surface,
      capabilities: modelConfig.capabilities,
      duration_seconds: modelConfig.duration_seconds,
      aspect_ratio: modelConfig.aspect_ratio,
      size: modelConfig.size,
      voice_id: modelConfig.voice_id,
    };

    setMetadata(config, { configs: metadata.configs });
    await this.saveConfig(config);
  }

  /**
   * Remove model-specific configuration
   */
  async removeModelConfig(model: string): Promise<void> {
    const config = await this.loadConfig();
    const metadata = getMetadata(config);
    const resolved = metadata.aliases[model] || model;
    delete metadata.configs[resolved];
    setMetadata(config, { configs: metadata.configs });
    await this.saveConfig(config);
  }

  // ========================================================================
  // Helpers
  // ========================================================================

  /**
   * Get model info synchronously from cached configured models.
   */
  getModelInfo(model: string): Model | undefined {
    const resolved = this.resolveAliasSync(model);

    if (!this.config) return undefined;

    const found = findModelInProviders(this.config, resolved);
    if (!found) return undefined;
    return modelFromEntry(
      resolved,
      found.entry,
      found.providerId,
      found.provider,
      getMetadata(this.config).default_model
    );
  }
}

// Export singleton instance
export const modelManager = new ModelManager();
