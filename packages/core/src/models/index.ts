/**
 * Model management for Viben
 */
import { getModelsPath } from "../config/paths";
import { readYaml, writeYaml, fileExists } from "../config/yaml";
import type { Model, ModelConfig } from "../types";
import type { ModelsFile, ModelConfigEntry } from "./types";
import { KNOWN_MODELS, DEFAULT_ALIASES, getKnownModel } from "./known-models";

export * from "./types";
export * from "./known-models";
export * from "./discovery";

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
        configs: {},
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
      // Handle both field names: Rust uses model_config, TypeScript uses configs
      configs: loaded?.configs || loaded?.model_config || {},
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
   * List all known models
   */
  async listModels(): Promise<Model[]> {
    return KNOWN_MODELS.map((m) => ({
      id: m.id,
      name: m.name,
      provider: m.provider,
      contextLength: m.contextLength,
      maxOutputTokens: m.maxOutputTokens,
      inputPrice: m.inputPrice,
      outputPrice: m.outputPrice,
    }));
  }

  /**
   * Get models by provider
   */
  async getModelsByProvider(provider: string): Promise<Model[]> {
    const all = await this.listModels();
    return all.filter((m) => m.provider === provider);
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
   * Get model info (from known models)
   */
  getModelInfo(model: string): Model | undefined {
    const resolved = this.resolveAliasSync(model);
    const known = getKnownModel(resolved);
    if (!known) return undefined;

    return {
      id: known.id,
      name: known.name,
      provider: known.provider,
      contextLength: known.contextLength,
      maxOutputTokens: known.maxOutputTokens,
      inputPrice: known.inputPrice,
      outputPrice: known.outputPrice,
    };
  }
}

// Export singleton instance
export const modelManager = new ModelManager();
