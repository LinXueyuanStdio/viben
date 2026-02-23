/**
 * Provider management for Viben
 */
import { getProvidersPath } from "../config/paths";
import { readYaml, writeYaml, fileExists } from "../config/yaml";
import type {
  Provider,
  ProviderType,
  ProviderStatus,
  CreateProviderOptions,
} from "../types";
import type { ProvidersFile, ProviderEntry } from "./types";
import { DEFAULT_BASE_URLS } from "./types";

export * from "./types";

/**
 * ProviderManager handles provider CRUD operations
 */
export class ProviderManager {
  private config: ProvidersFile | undefined;

  /**
   * Load the providers configuration
   */
  private async loadConfig(): Promise<ProvidersFile> {
    if (this.config) {
      return this.config;
    }

    const path = getProvidersPath();
    if (!fileExists(path)) {
      this.config = { providers: {} };
      return this.config;
    }

    this.config = await readYaml<ProvidersFile>(path);
    return this.config || { providers: {} };
  }

  /**
   * Save the providers configuration
   */
  private async saveConfig(config: ProvidersFile): Promise<void> {
    await writeYaml(getProvidersPath(), config);
    this.config = config;
  }

  /**
   * Reload configuration from disk
   */
  async reload(): Promise<void> {
    this.config = undefined;
    await this.loadConfig();
  }

  /**
   * List all providers
   */
  async listProviders(): Promise<Provider[]> {
    const config = await this.loadConfig();
    const providers: Provider[] = [];

    for (const [id, entry] of Object.entries(config.providers)) {
      providers.push({
        id,
        type: entry.provider_type as ProviderType,
        name: entry.name,
        apiKey: entry.api_key,
        baseUrl: entry.base_url,
        apiVersion: entry.api_version,
        deployment: entry.deployment,
        timeout: entry.timeout,
        maxRetries: entry.max_retries,
        headers: entry.headers,
        isDefault: config.default === id,
        enabled: entry.enabled,
        createdAt: entry.created_at,
        updatedAt: entry.updated_at,
      });
    }

    return providers;
  }

  /**
   * Get a provider by ID
   */
  async getProvider(id: string): Promise<Provider | null> {
    const config = await this.loadConfig();
    const entry = config.providers[id];

    if (!entry) {
      return null;
    }

    return {
      id,
      type: entry.provider_type as ProviderType,
      name: entry.name,
      apiKey: entry.api_key,
      baseUrl: entry.base_url,
      apiVersion: entry.api_version,
      deployment: entry.deployment,
      timeout: entry.timeout,
      maxRetries: entry.max_retries,
      headers: entry.headers,
      isDefault: config.default === id,
      enabled: entry.enabled,
      createdAt: entry.created_at,
      updatedAt: entry.updated_at,
    };
  }

  /**
   * Create a new provider
   */
  async createProvider(options: CreateProviderOptions): Promise<Provider> {
    const config = await this.loadConfig();
    const id = this.generateProviderId(options.name);

    if (config.providers[id]) {
      throw new Error(`Provider with ID "${id}" already exists`);
    }

    const now = new Date().toISOString();
    const entry: ProviderEntry = {
      provider_type: options.type,
      name: options.name,
      api_key: options.apiKey,
      base_url: options.baseUrl || DEFAULT_BASE_URLS[options.type],
      api_version: options.apiVersion,
      deployment: options.deployment,
      timeout: options.timeout,
      max_retries: options.maxRetries,
      headers: options.headers,
      enabled: true,
      created_at: now,
      updated_at: now,
    };

    config.providers[id] = entry;

    // Set as default if requested or if it's the first provider
    if (options.setAsDefault || Object.keys(config.providers).length === 1) {
      config.default = id;
    }

    await this.saveConfig(config);

    return {
      id,
      type: options.type,
      name: options.name,
      apiKey: options.apiKey,
      baseUrl: entry.base_url,
      apiVersion: entry.api_version,
      deployment: entry.deployment,
      timeout: entry.timeout,
      maxRetries: entry.max_retries,
      headers: entry.headers,
      isDefault: config.default === id,
      enabled: true,
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Update a provider
   */
  async updateProvider(
    id: string,
    updates: Partial<Omit<CreateProviderOptions, "setAsDefault">>
  ): Promise<Provider> {
    const config = await this.loadConfig();
    const entry = config.providers[id];

    if (!entry) {
      throw new Error(`Provider "${id}" not found`);
    }

    const now = new Date().toISOString();
    const updated: ProviderEntry = {
      ...entry,
      provider_type: updates.type || entry.provider_type,
      name: updates.name || entry.name,
      api_key: updates.apiKey ?? entry.api_key,
      base_url: updates.baseUrl ?? entry.base_url,
      api_version: updates.apiVersion ?? entry.api_version,
      deployment: updates.deployment ?? entry.deployment,
      timeout: updates.timeout ?? entry.timeout,
      max_retries: updates.maxRetries ?? entry.max_retries,
      headers: updates.headers ?? entry.headers,
      updated_at: now,
    };

    config.providers[id] = updated;
    await this.saveConfig(config);

    return {
      id,
      type: updated.provider_type as ProviderType,
      name: updated.name,
      apiKey: updated.api_key,
      baseUrl: updated.base_url,
      apiVersion: updated.api_version,
      deployment: updated.deployment,
      timeout: updated.timeout,
      maxRetries: updated.max_retries,
      headers: updated.headers,
      isDefault: config.default === id,
      enabled: updated.enabled,
      createdAt: updated.created_at,
      updatedAt: now,
    };
  }

  /**
   * Remove a provider
   */
  async removeProvider(id: string): Promise<void> {
    const config = await this.loadConfig();

    if (!config.providers[id]) {
      throw new Error(`Provider "${id}" not found`);
    }

    delete config.providers[id];

    // Clear default if removing the default provider
    if (config.default === id) {
      const remaining = Object.keys(config.providers);
      config.default = remaining.length > 0 ? remaining[0] : undefined;
    }

    await this.saveConfig(config);
  }

  /**
   * Set the default provider
   */
  async setDefault(id: string): Promise<void> {
    const config = await this.loadConfig();

    if (!config.providers[id]) {
      throw new Error(`Provider "${id}" not found`);
    }

    config.default = id;
    await this.saveConfig(config);
  }

  /**
   * Get the default provider ID
   */
  async getDefault(): Promise<string | undefined> {
    const config = await this.loadConfig();
    return config.default;
  }

  /**
   * Enable or disable a provider
   */
  async setEnabled(id: string, enabled: boolean): Promise<void> {
    const config = await this.loadConfig();
    const entry = config.providers[id];

    if (!entry) {
      throw new Error(`Provider "${id}" not found`);
    }

    entry.enabled = enabled;
    entry.updated_at = new Date().toISOString();
    await this.saveConfig(config);
  }

  /**
   * Check provider connectivity status
   * Note: This is a basic implementation. In production, you'd want to
   * actually test the API connection.
   */
  async checkStatus(id: string): Promise<ProviderStatus> {
    const provider = await this.getProvider(id);
    const now = new Date().toISOString();

    if (!provider) {
      return {
        id,
        connected: false,
        error: "Provider not found",
        checkedAt: now,
      };
    }

    if (!provider.enabled) {
      return {
        id,
        connected: false,
        error: "Provider is disabled",
        checkedAt: now,
      };
    }

    // Check if API key is configured (for providers that need it)
    const needsApiKey = ["openai", "anthropic", "azure", "openrouter", "google"].includes(
      provider.type
    );
    if (needsApiKey && !provider.apiKey) {
      return {
        id,
        connected: false,
        error: "API key not configured",
        checkedAt: now,
      };
    }

    // For now, assume connected if properly configured
    // In production, you'd test the actual API endpoint
    return {
      id,
      connected: true,
      latency: 0,
      checkedAt: now,
    };
  }

  /**
   * Check all providers' status
   */
  async checkAllStatus(): Promise<Record<string, ProviderStatus>> {
    const providers = await this.listProviders();
    const results: Record<string, ProviderStatus> = {};

    for (const provider of providers) {
      results[provider.id] = await this.checkStatus(provider.id);
    }

    return results;
  }

  // ========================================================================
  // Helpers
  // ========================================================================

  /**
   * Generate a valid provider ID from a name
   */
  private generateProviderId(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 50) || `provider-${Date.now()}`;
  }
}

// Export singleton instance
export const providerManager = new ProviderManager();
