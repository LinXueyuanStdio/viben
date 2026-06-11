/**
 * Model management for Viben
 */
import { getModelsPath } from "../config/paths";
import { readYaml, writeYaml, fileExists } from "../config/yaml";
import type { Model, ModelConfig } from "../types";
import type {
  ModelCategory,
  ModelConfigEntry,
  ModelEntry,
  ModelSurface,
  ModelsFile,
} from "./types";
import { KNOWN_MODELS, DEFAULT_ALIASES, getKnownModel } from "./known-models";

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

/**
 * ModelManager handles model configuration and aliases
 */
export class ModelManager {
  private config: ModelsFile | undefined;

  /**
   * Load the models configuration
   */
  private async loadConfig(): Promise<ModelsFile> {
    if (this.config) {
      return this.config;
    }

    const path = getModelsPath();
    if (!fileExists(path)) {
      this.config = {
        aliases: { ...DEFAULT_ALIASES },
        fallbacks: [],
        fallbacks_by_surface: {},
        configs: {},
        custom_models: {},
        disabled_models: [],
      };
      return this.config;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const loaded = await readYaml<any>(path);

    // Handle YAML field name differences (Rust uses model_config, TypeScript uses configs)
    this.config = {
      default: loaded?.default,
      // Merge loaded aliases with defaults (loaded takes precedence)
      aliases: { ...DEFAULT_ALIASES, ...(loaded?.aliases || {}) },
      fallbacks: loaded?.fallbacks || [],
      fallbacks_by_surface: loaded?.fallbacks_by_surface || {},
      // Handle both field names: Rust uses model_config, TypeScript uses configs
      configs: loaded?.configs || loaded?.model_config || {},
      // Custom models added by user
      custom_models: loaded?.custom_models || {},
      // Disabled built-in models
      disabled_models: loaded?.disabled_models || [],
    };
    return this.config;
  }

  /**
   * Save the models configuration
   */
  private async saveConfig(config: ModelsFile): Promise<void> {
    await writeYaml(getModelsPath(), config);
    this.config = config;
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
   * List all available models (built-in + custom)
   */
  async listModels(): Promise<Model[]> {
    const config = await this.loadConfig();
    const models: Model[] = [];

    // Add known (built-in) models
    for (const known of KNOWN_MODELS) {
      const enabled = !config.disabled_models.includes(known.id);
      const isDefault = config.default === known.id;
      models.push({
        id: known.id,
        name: known.name,
        provider: known.provider,
        category: normalizeModelCategory(known.category),
        surface: normalizeModelSurface(
          known.surface,
          normalizeModelCategory(known.category)
        ),
        capabilities: known.capabilities,
        description: known.description,
        contextLength: known.contextLength,
        maxOutputTokens: known.maxOutputTokens,
        inputPrice: known.inputPrice,
        outputPrice: known.outputPrice,
        isDefault,
        enabled,
      });
    }

    // Add custom models
    for (const [id, entry] of Object.entries(config.custom_models)) {
      const isDefault = config.default === id;
      models.push({
        id,
        name: entry.name,
        provider: entry.provider,
        category: normalizeModelCategory(entry.category),
        surface: normalizeModelSurface(
          entry.surface,
          normalizeModelCategory(entry.category)
        ),
        capabilities: entry.capabilities,
        description: entry.description,
        contextLength: entry.context_window,
        maxOutputTokens: entry.max_output_tokens,
        isDefault,
        enabled: entry.enabled,
        created_at: entry.created_at,
        updated_at: entry.updated_at,
      });
    }

    return models;
  }

  /**
   * Get models by provider
   */
  async getModelsByProvider(provider: string): Promise<Model[]> {
    const all = await this.listModels();
    return all.filter((m) => m.provider === provider);
  }

  async listModelsFiltered(filters: {
    provider?: string;
    category?: ModelCategory;
    surface?: ModelSurface;
  }): Promise<Model[]> {
    let models = await this.listModels();
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

    // Check custom models first
    const customEntry = config.custom_models[id];
    if (customEntry) {
      const isDefault = config.default === id;
      return {
        id,
        name: customEntry.name,
        provider: customEntry.provider,
        category: normalizeModelCategory(customEntry.category),
        surface: normalizeModelSurface(
          customEntry.surface,
          normalizeModelCategory(customEntry.category)
        ),
        capabilities: customEntry.capabilities,
        description: customEntry.description,
        contextLength: customEntry.context_window,
        maxOutputTokens: customEntry.max_output_tokens,
        isDefault,
        enabled: customEntry.enabled,
        created_at: customEntry.created_at,
        updated_at: customEntry.updated_at,
      };
    }

    // Check known models
    const known = getKnownModel(id);
    if (known) {
      const enabled = !config.disabled_models.includes(id);
      const isDefault = config.default === id;
      return {
        id: known.id,
        name: known.name,
        provider: known.provider,
        category: normalizeModelCategory(known.category),
        surface: normalizeModelSurface(
          known.surface,
          normalizeModelCategory(known.category)
        ),
        capabilities: known.capabilities,
        description: known.description,
        contextLength: known.contextLength,
        maxOutputTokens: known.maxOutputTokens,
        inputPrice: known.inputPrice,
        outputPrice: known.outputPrice,
        isDefault,
        enabled,
      };
    }

    return null;
  }

  /**
   * Create a custom model
   */
  async createModel(options: {
    id: string;
    name: string;
    provider: string;
    category?: ModelCategory;
    surface?: ModelSurface;
    capabilities?: string[];
    description?: string;
    contextWindow?: number;
    maxOutputTokens?: number;
    setAsDefault?: boolean;
  }): Promise<Model> {
    const config = await this.loadConfig();

    // Check if model already exists
    if (config.custom_models[options.id] || getKnownModel(options.id)) {
      throw new Error(`Model already exists: ${options.id}`);
    }

    const now = new Date().toISOString();
    const entry: ModelEntry = {
      name: options.name,
      provider: options.provider,
      category: normalizeModelCategory(options.category),
      surface: normalizeModelSurface(
        options.surface,
        normalizeModelCategory(options.category)
      ),
      capabilities: options.capabilities,
      description: options.description,
      context_window: options.contextWindow,
      max_output_tokens: options.maxOutputTokens,
      enabled: true,
      created_at: now,
      updated_at: now,
    };

    config.custom_models[options.id] = entry;

    // Set as default if requested
    const isDefault = options.setAsDefault ?? false;
    if (isDefault) {
      config.default = options.id;
    }

    await this.saveConfig(config);

    return {
      id: options.id,
      name: entry.name,
      provider: entry.provider,
      category: entry.category,
      surface: entry.surface,
      capabilities: entry.capabilities,
      description: entry.description,
      contextLength: entry.context_window,
      maxOutputTokens: entry.max_output_tokens,
      isDefault,
      enabled: entry.enabled,
      created_at: entry.created_at,
      updated_at: entry.updated_at,
    };
  }

  /**
   * Remove a custom model
   */
  async removeModel(id: string): Promise<void> {
    const config = await this.loadConfig();

    // Can't remove built-in models
    if (getKnownModel(id)) {
      throw new Error(`Cannot remove built-in model: ${id}`);
    }

    if (!config.custom_models[id]) {
      throw new Error(`Model not found: ${id}`);
    }

    delete config.custom_models[id];

    // Clear default if it was this model
    if (config.default === id) {
      config.default = undefined;
    }

    await this.saveConfig(config);
  }

  /**
   * Update a custom model
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

    // Can't update built-in models
    if (getKnownModel(id)) {
      throw new Error(`Cannot update built-in model: ${id}`);
    }

    const entry = config.custom_models[id];
    if (!entry) {
      throw new Error(`Model not found: ${id}`);
    }

    const now = new Date().toISOString();

    if (updates.name !== undefined) {
      entry.name = updates.name;
    }
    if (updates.description !== undefined) {
      entry.description = updates.description;
    }
    if (updates.contextWindow !== undefined) {
      entry.context_window = updates.contextWindow;
    }
    if (updates.maxOutputTokens !== undefined) {
      entry.max_output_tokens = updates.maxOutputTokens;
    }
    entry.updated_at = now;

    await this.saveConfig(config);

    return {
      id,
      name: entry.name,
      provider: entry.provider,
      description: entry.description,
      contextLength: entry.context_window,
      maxOutputTokens: entry.max_output_tokens,
      isDefault: config.default === id,
      enabled: entry.enabled,
      created_at: entry.created_at,
      updated_at: entry.updated_at,
    };
  }

  /**
   * Enable a model (built-in, custom, or discovered)
   * @param providerType - Required when the model is not yet registered (discovered models)
   */
  async enableModel(id: string, providerType: string): Promise<void> {
    const config = await this.loadConfig();

    const customEntry = config.custom_models[id];
    if (customEntry) {
      customEntry.enabled = true;
      customEntry.updated_at = new Date().toISOString();
    } else if (getKnownModel(id)) {
      config.disabled_models = config.disabled_models.filter((m) => m !== id);
    } else {
      config.custom_models[id] = {
        name: id,
        provider: providerType,
        enabled: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }

    await this.saveConfig(config);
  }

  /**
   * Disable a model (built-in, custom, or discovered)
   * @param providerType - Required when the model is not yet registered (discovered models)
   */
  async disableModel(id: string, providerType: string): Promise<void> {
    const config = await this.loadConfig();

    const customEntry = config.custom_models[id];
    if (customEntry) {
      customEntry.enabled = false;
      customEntry.updated_at = new Date().toISOString();
    } else if (getKnownModel(id)) {
      if (!config.disabled_models.includes(id)) {
        config.disabled_models.push(id);
      }
    } else {
      config.custom_models[id] = {
        name: id,
        provider: providerType,
        enabled: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }

    await this.saveConfig(config);
  }

  /**
   * Get the default model
   */
  async getDefault(): Promise<string | undefined> {
    const config = await this.loadConfig();
    return config.default;
  }

  /**
   * Set the default model
   */
  async setDefault(model: string): Promise<void> {
    const config = await this.loadConfig();
    config.default = model;
    await this.saveConfig(config);
  }

  async getDefaultForSurface(surface: ModelSurface): Promise<string | undefined> {
    const config = await this.loadConfig();
    if (surface === "chat") {
      return config.defaults?.llm ?? config.default;
    }
    return config.defaults?.media?.[surface];
  }

  async setDefaultForSurface(surface: ModelSurface, model: string): Promise<void> {
    const config = await this.loadConfig();
    if (!config.defaults) {
      config.defaults = {};
    }
    if (surface === "chat") {
      config.defaults.llm = model;
      config.default = model;
    } else {
      config.defaults.media = {
        ...(config.defaults.media ?? {}),
        [surface]: model,
      };
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
    return { ...config.aliases };
  }

  /**
   * Create or update an alias
   */
  async createAlias(alias: string, model: string): Promise<void> {
    const config = await this.loadConfig();
    config.aliases[alias] = model;
    await this.saveConfig(config);
  }

  /**
   * Remove an alias
   */
  async removeAlias(alias: string): Promise<void> {
    const config = await this.loadConfig();
    delete config.aliases[alias];
    await this.saveConfig(config);
  }

  /**
   * Resolve an alias to the actual model ID
   * Returns the input if it's not an alias
   */
  async resolveAlias(aliasOrModel: string): Promise<string> {
    const config = await this.loadConfig();
    return config.aliases[aliasOrModel] || aliasOrModel;
  }

  /**
   * Resolve alias synchronously (uses cached config)
   */
  resolveAliasSync(aliasOrModel: string): string {
    if (!this.config) {
      return DEFAULT_ALIASES[aliasOrModel] || aliasOrModel;
    }
    return this.config.aliases[aliasOrModel] || aliasOrModel;
  }

  // ========================================================================
  // Fallbacks
  // ========================================================================

  /**
   * Get the fallback chain
   */
  async getFallbacks(): Promise<string[]> {
    const config = await this.loadConfig();
    return [...config.fallbacks];
  }

  /**
   * Add a model to the fallback chain
   */
  async addFallback(model: string): Promise<void> {
    const config = await this.loadConfig();
    if (!config.fallbacks.includes(model)) {
      config.fallbacks.push(model);
      await this.saveConfig(config);
    }
  }

  /**
   * Remove a model from the fallback chain
   */
  async removeFallback(model: string): Promise<void> {
    const config = await this.loadConfig();
    const index = config.fallbacks.indexOf(model);
    if (index !== -1) {
      config.fallbacks.splice(index, 1);
      await this.saveConfig(config);
    }
  }

  /**
   * Clear the fallback chain
   */
  async clearFallbacks(): Promise<void> {
    const config = await this.loadConfig();
    config.fallbacks = [];
    await this.saveConfig(config);
  }

  /**
   * Reorder fallbacks
   */
  async setFallbacks(fallbacks: string[]): Promise<void> {
    const config = await this.loadConfig();
    config.fallbacks = fallbacks;
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
    const resolved = config.aliases[model] || model;
    return config.configs[resolved] || null;
  }

  /**
   * Set model-specific configuration
   */
  async setModelConfig(model: string, modelConfig: ModelConfig): Promise<void> {
    const config = await this.loadConfig();
    const resolved = config.aliases[model] || model;

    config.configs[resolved] = {
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

    await this.saveConfig(config);
  }

  /**
   * Remove model-specific configuration
   */
  async removeModelConfig(model: string): Promise<void> {
    const config = await this.loadConfig();
    const resolved = config.aliases[model] || model;
    delete config.configs[resolved];
    await this.saveConfig(config);
  }

  // ========================================================================
  // Helpers
  // ========================================================================

  /**
   * Get model info synchronously (from known models or cached custom models)
   */
  getModelInfo(model: string): Model | undefined {
    const resolved = this.resolveAliasSync(model);

    // Check custom models first (if config is cached)
    if (this.config) {
      const customEntry = this.config.custom_models[resolved];
      if (customEntry) {
        return {
          id: resolved,
          name: customEntry.name,
          provider: customEntry.provider,
          category: normalizeModelCategory(customEntry.category),
          surface: normalizeModelSurface(
            customEntry.surface,
            normalizeModelCategory(customEntry.category)
          ),
          capabilities: customEntry.capabilities,
          description: customEntry.description,
          contextLength: customEntry.context_window,
          maxOutputTokens: customEntry.max_output_tokens,
          isDefault: this.config.default === resolved,
          enabled: customEntry.enabled,
          created_at: customEntry.created_at,
          updated_at: customEntry.updated_at,
        };
      }
    }

    // Check known models
    const known = getKnownModel(resolved);
    if (!known) return undefined;

    const enabled = this.config
      ? !this.config.disabled_models.includes(resolved)
      : true;
    const isDefault = this.config?.default === resolved;

    return {
      id: known.id,
      name: known.name,
      provider: known.provider,
      category: normalizeModelCategory(known.category),
      surface: normalizeModelSurface(
        known.surface,
        normalizeModelCategory(known.category)
      ),
      capabilities: known.capabilities,
      description: known.description,
      contextLength: known.contextLength,
      maxOutputTokens: known.maxOutputTokens,
      inputPrice: known.inputPrice,
      outputPrice: known.outputPrice,
      isDefault,
      enabled,
    };
  }
}

// Export singleton instance
export const modelManager = new ModelManager();
