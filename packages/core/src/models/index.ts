/**
 * Model management for Viben
 */
import type { Model, ModelConfig } from "../types";
import {
  getUnifiedProviders,
  loadUnifiedModelsFile,
  saveUnifiedModelsFile,
  type UnifiedModelsFile,
  type UnifiedModelEntry,
  type UnifiedProviderEntry,
} from "../config/model-provider-storage";
import type {
  ModelConfigEntry,
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

function modelFromEntry(
  id: string,
  entry: UnifiedModelEntry,
  providerId: string,
  provider: UnifiedProviderEntry
): Model {
  const category = normalizeModelCategory(provider.category as ModelCategory | undefined);
  return {
    id,
    name: entry.name,
    provider: provider.type,
    provider_id: providerId,
    category,
    surface: normalizeModelSurface(undefined, category),
    isDefault: false,
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
  if (!providerId) {
    throw new Error("Provider ID is required");
  }
  if (!providerType) {
    throw new Error("Provider type is required");
  }
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

function findModelMatches(
  config: UnifiedModelsFile,
  id: string
): Array<{ providerId: string; provider: UnifiedProviderEntry; entry: UnifiedModelEntry }> {
  const providers = getUnifiedProviders(config);
  const matches: Array<{
    providerId: string;
    provider: UnifiedProviderEntry;
    entry: UnifiedModelEntry;
  }> = [];

  for (const providerId of Object.keys(providers)) {
    const provider = providers[providerId];
    const model = provider.models?.[id];
    if (model) {
      matches.push({ providerId, provider, entry: model });
    }
  }
  return matches;
}

function requireSingleModelMatch(
  config: UnifiedModelsFile,
  id: string
): { providerId: string; provider: UnifiedProviderEntry; entry: UnifiedModelEntry } | undefined {
  const matches = findModelMatches(config, id);
  if (matches.length > 1) {
    const providerIds = matches.map((match) => match.providerId).join(", ");
    throw new Error(
      `Model "${id}" exists in multiple providers (${providerIds}); pass provider_id to disambiguate`
    );
  }
  return matches[0];
}

function findModelInProvider(
  config: UnifiedModelsFile,
  providerId: string,
  modelId: string
): { providerId: string; provider: UnifiedProviderEntry; entry: UnifiedModelEntry } | undefined {
  const provider = getUnifiedProviders(config)[providerId];
  const entry = provider?.models?.[modelId];
  if (!provider || !entry) {
    return undefined;
  }
  return { providerId, provider, entry };
}

function requireModelInProvider(
  config: UnifiedModelsFile,
  providerId: string,
  modelId: string
): { providerId: string; provider: UnifiedProviderEntry; entry: UnifiedModelEntry } {
  const found = findModelInProvider(config, providerId, modelId);
  if (!found) {
    throw new Error(`Model not found: ${modelId} for provider ${providerId}`);
  }
  return found;
}

function modelConfigEntryFromModelConfig(modelConfig: ModelConfig): ModelConfigEntry {
  return {
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
    const providers = getUnifiedProviders(config);
    const models: Model[] = [];

    for (const [providerId, provider] of Object.entries(providers)) {
      for (const [id, entry] of Object.entries(provider.models ?? {})) {
        models.push(modelFromEntry(id, entry, providerId, provider));
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
    provider_id?: string;
    category?: ModelCategory;
    surface?: ModelSurface;
  }): Promise<Model[]> {
    let models = await this.listModels();
    if (filters.provider_id) {
      models = models.filter((m) => m.provider_id === filters.provider_id);
    }
    if (filters.provider) {
      models = models.filter((m) => m.provider === filters.provider);
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
    const found = requireSingleModelMatch(config, id);

    if (found) {
      return modelFromEntry(id, found.entry, found.providerId, found.provider);
    }

    return null;
  }

  /**
   * Get a model scoped to a provider instance ID.
   */
  async getModelForProvider(providerId: string, id: string): Promise<Model | null> {
    const config = await this.loadConfig();
    const found = findModelInProvider(config, providerId, id);
    if (!found) {
      return null;
    }
    return modelFromEntry(id, found.entry, found.providerId, found.provider);
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
    const found = requireSingleModelMatch(config, id);

    if (!found) {
      throw new Error(`Model not found: ${id}`);
    }

    delete found.provider.models?.[id];
    config[found.providerId] = found.provider;

    await this.saveConfig(config);
  }

  /**
   * Remove a model scoped to a provider instance ID.
   */
  async removeModelForProvider(providerId: string, id: string): Promise<void> {
    const config = await this.loadConfig();
    const found = requireModelInProvider(config, providerId, id);

    delete found.provider.models?.[id];
    config[found.providerId] = found.provider;
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

    const found = requireSingleModelMatch(config, id);
    if (!found) {
      throw new Error(`Model not found: ${id}`);
    }

    const result = await this.updateModelEntry(config, found, id, updates);
    await this.saveConfig(config);
    return result;
  }

  /**
   * Update a model scoped to a provider instance ID.
   */
  async updateModelForProvider(
    providerId: string,
    id: string,
    updates: {
      name?: string;
      description?: string;
      contextWindow?: number;
      maxOutputTokens?: number;
    }
  ): Promise<Model> {
    const config = await this.loadConfig();
    const found = requireModelInProvider(config, providerId, id);
    const result = await this.updateModelEntry(config, found, id, updates);
    await this.saveConfig(config);
    return result;
  }

  private async updateModelEntry(
    config: UnifiedModelsFile,
    found: { providerId: string; provider: UnifiedProviderEntry; entry: UnifiedModelEntry },
    id: string,
    updates: {
      name?: string;
      description?: string;
      contextWindow?: number;
      maxOutputTokens?: number;
    }
  ): Promise<Model> {
    const entry = { ...found.entry };

    if (updates.name !== undefined) {
      entry.name = updates.name;
    }
    found.provider.models = {
      ...(found.provider.models ?? {}),
      [id]: entry,
    };
    config[found.providerId] = found.provider;

    return {
      id,
      name: entry.name,
      provider: found.provider.type,
      provider_id: found.providerId,
      description: updates.description,
      contextLength: updates.contextWindow,
      maxOutputTokens: updates.maxOutputTokens,
      isDefault: false,
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
    return undefined;
  }

  /**
   * Set the default model
   */
  async setDefault(model: string): Promise<void> {
    void model;
  }

  async getDefaultForSurface(surface: ModelSurface): Promise<string | undefined> {
    void surface;
    return undefined;
  }

  async setDefaultForSurface(surface: ModelSurface, model: string): Promise<void> {
    void surface;
    void model;
  }

  // ========================================================================
  // Aliases
  // ========================================================================

  /**
   * Get all model aliases
   */
  async getAliases(): Promise<Record<string, string>> {
    return { ...DEFAULT_ALIASES };
  }

  /**
   * Create or update an alias
   */
  async createAlias(alias: string, model: string): Promise<void> {
    void alias;
    void model;
  }

  /**
   * Remove an alias
   */
  async removeAlias(alias: string): Promise<void> {
    void alias;
  }

  /**
   * Resolve an alias to the actual model ID
   * Returns the input if it's not an alias
   */
  async resolveAlias(aliasOrModel: string): Promise<string> {
    return DEFAULT_ALIASES[aliasOrModel] || aliasOrModel;
  }

  /**
   * Resolve alias synchronously (uses cached config)
   */
  resolveAliasSync(aliasOrModel: string): string {
    return DEFAULT_ALIASES[aliasOrModel] || aliasOrModel;
  }

  // ========================================================================
  // Model Configs
  // ========================================================================

  /**
   * Get model-specific configuration
   */
  async getModelConfig(model: string, providerId?: string): Promise<ModelConfig | null> {
    if (providerId) {
      return this.getModelConfigForProvider(providerId, model);
    }
    const config = await this.loadConfig();
    const resolved = DEFAULT_ALIASES[model] || model;
    const found = requireSingleModelMatch(config, resolved);
    if (!found) {
      return null;
    }
    return found.entry.config ?? null;
  }

  /**
   * Get provider-scoped model configuration.
   */
  async getModelConfigForProvider(
    providerId: string,
    model: string
  ): Promise<ModelConfig | null> {
    const config = await this.loadConfig();
    const resolved = DEFAULT_ALIASES[model] || model;
    const found = findModelInProvider(config, providerId, resolved);
    if (!found) {
      return null;
    }
    return found.entry.config ?? null;
  }

  /**
   * Set model-specific configuration
   */
  async setModelConfig(
    model: string,
    modelConfig: ModelConfig,
    providerId?: string
  ): Promise<void> {
    if (providerId) {
      return this.setModelConfigForProvider(providerId, model, modelConfig);
    }
    const config = await this.loadConfig();
    const resolved = DEFAULT_ALIASES[model] || model;
    const found = requireSingleModelMatch(config, resolved);
    if (!found) {
      throw new Error(`Model not found: ${resolved}`);
    }
    this.setModelConfigEntry(config, found, resolved, modelConfig);

    await this.saveConfig(config);
  }

  /**
   * Set provider-scoped model configuration.
   */
  async setModelConfigForProvider(
    providerId: string,
    model: string,
    modelConfig: ModelConfig
  ): Promise<void> {
    const config = await this.loadConfig();
    const resolved = DEFAULT_ALIASES[model] || model;
    const found = requireModelInProvider(config, providerId, resolved);
    this.setModelConfigEntry(config, found, resolved, modelConfig);
    await this.saveConfig(config);
  }

  /**
   * Remove model-specific configuration
   */
  async removeModelConfig(model: string, providerId?: string): Promise<void> {
    if (providerId) {
      return this.removeModelConfigForProvider(providerId, model);
    }
    const config = await this.loadConfig();
    const resolved = DEFAULT_ALIASES[model] || model;
    const found = requireSingleModelMatch(config, resolved);
    if (found) {
      const entry = { ...found.entry };
      delete entry.config;
      found.provider.models = {
        ...(found.provider.models ?? {}),
        [resolved]: entry,
      };
      config[found.providerId] = found.provider;
    }
    await this.saveConfig(config);
  }

  /**
   * Remove provider-scoped model configuration.
   */
  async removeModelConfigForProvider(providerId: string, model: string): Promise<void> {
    const config = await this.loadConfig();
    const resolved = DEFAULT_ALIASES[model] || model;
    const found = requireModelInProvider(config, providerId, resolved);
    const entry = { ...found.entry };
    delete entry.config;
    found.provider.models = {
      ...(found.provider.models ?? {}),
      [resolved]: entry,
    };
    config[found.providerId] = found.provider;
    await this.saveConfig(config);
  }

  private setModelConfigEntry(
    config: UnifiedModelsFile,
    found: { providerId: string; provider: UnifiedProviderEntry; entry: UnifiedModelEntry },
    resolved: string,
    modelConfig: ModelConfig
  ): void {
    found.provider.models = {
      ...(found.provider.models ?? {}),
      [resolved]: {
        ...found.entry,
        config: modelConfigEntryFromModelConfig(modelConfig),
      },
    };
    config[found.providerId] = found.provider;
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

    let found:
      | { providerId: string; provider: UnifiedProviderEntry; entry: UnifiedModelEntry }
      | undefined;
    try {
      found = requireSingleModelMatch(this.config, resolved);
    } catch {
      return undefined;
    }
    if (!found) return undefined;
    return modelFromEntry(
      resolved,
      found.entry,
      found.providerId,
      found.provider
    );
  }
}

// Export singleton instance
export const modelManager = new ModelManager();
