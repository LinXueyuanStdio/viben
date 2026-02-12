/**
 * Configuration management for Viben
 */
import type { GlobalConfig, ProvidersConfig, ModelsConfig } from "../types";
import { getConfigPath, getProvidersPath, getModelsPath, getStateDir } from "./paths";
import { readYaml, writeYaml, ensureDir, fileExists } from "./yaml";

export * from "./paths";
export * from "./yaml";
export * from "./manager";

/**
 * ConfigManager handles global configuration
 */
export class ConfigManager {
  private config: GlobalConfig | undefined;

  /**
   * Initialize the config directory and default config
   */
  async initialize(): Promise<void> {
    await ensureDir(getStateDir());

    // Create default config if it doesn't exist
    if (!fileExists(getConfigPath())) {
      await this.save({
        theme: "system",
        locale: "en",
      });
    }
  }

  /**
   * Load the global configuration
   */
  async load(): Promise<GlobalConfig> {
    if (this.config) {
      return this.config;
    }
    this.config = await readYaml<GlobalConfig>(getConfigPath());
    return this.config || {};
  }

  /**
   * Save the global configuration
   */
  async save(config: GlobalConfig): Promise<void> {
    await writeYaml(getConfigPath(), config);
    this.config = config;
  }

  /**
   * Update specific fields in the configuration
   */
  async update(updates: Partial<GlobalConfig>): Promise<GlobalConfig> {
    const current = await this.load();
    const updated = { ...current, ...updates };
    await this.save(updated);
    return updated;
  }

  /**
   * Get the default agent ID
   */
  async getDefaultAgent(): Promise<string | undefined> {
    const config = await this.load();
    return config.defaultAgent;
  }

  /**
   * Set the default agent ID
   */
  async setDefaultAgent(agentId: string | undefined): Promise<void> {
    await this.update({ defaultAgent: agentId });
  }

  /**
   * Get the default provider ID
   */
  async getDefaultProvider(): Promise<string | undefined> {
    const config = await this.load();
    return config.defaultProvider;
  }

  /**
   * Set the default provider ID
   */
  async setDefaultProvider(providerId: string | undefined): Promise<void> {
    await this.update({ defaultProvider: providerId });
  }

  /**
   * Get the default model
   */
  async getDefaultModel(): Promise<string | undefined> {
    const config = await this.load();
    return config.defaultModel;
  }

  /**
   * Set the default model
   */
  async setDefaultModel(model: string | undefined): Promise<void> {
    await this.update({ defaultModel: model });
  }
}

/**
 * ProvidersConfigManager handles providers configuration
 */
export class ProvidersConfigManager {
  private config: ProvidersConfig | undefined;

  /**
   * Load the providers configuration
   */
  async load(): Promise<ProvidersConfig> {
    if (this.config) {
      return this.config;
    }
    this.config = await readYaml<ProvidersConfig>(getProvidersPath());
    return this.config || { providers: [] };
  }

  /**
   * Save the providers configuration
   */
  async save(config: ProvidersConfig): Promise<void> {
    await writeYaml(getProvidersPath(), config);
    this.config = config;
  }

  /**
   * Reload configuration from disk
   */
  async reload(): Promise<ProvidersConfig> {
    this.config = undefined;
    return this.load();
  }
}

/**
 * ModelsConfigManager handles models configuration
 */
export class ModelsConfigManager {
  private config: ModelsConfig | undefined;

  /**
   * Load the models configuration
   */
  async load(): Promise<ModelsConfig> {
    if (this.config) {
      return this.config;
    }
    this.config = await readYaml<ModelsConfig>(getModelsPath());
    return this.config || { aliases: {}, fallbacks: [], configs: {} };
  }

  /**
   * Save the models configuration
   */
  async save(config: ModelsConfig): Promise<void> {
    await writeYaml(getModelsPath(), config);
    this.config = config;
  }

  /**
   * Reload configuration from disk
   */
  async reload(): Promise<ModelsConfig> {
    this.config = undefined;
    return this.load();
  }
}

// Export singleton instances
export const configManager = new ConfigManager();
export const providersConfigManager = new ProvidersConfigManager();
export const modelsConfigManager = new ModelsConfigManager();
