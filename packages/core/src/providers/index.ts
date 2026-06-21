/**
 * Provider management for Viben
 */
import {
  getUnifiedProviders,
  loadUnifiedModelsFile,
  MODELS_METADATA_KEY,
  saveUnifiedModelsFile,
  type UnifiedModelsFile,
  type UnifiedProviderEntry,
} from "../config/model-provider-storage";
import type {
  CreateProviderOptions,
  Provider,
  ProviderCategory,
  ProviderStatus,
  ProviderSurface,
  ProviderType,
} from "../types";
import type { ProviderEntry } from "./types";
import { DEFAULT_BASE_URLS } from "./types";

export * from "./types";

const LLM_PROVIDER_TYPES = new Set<ProviderType>([
  "openai",
  "openai-responses",
  "anthropic",
  "azure",
  "ollama",
  "openrouter",
  "google",
]);

function normalizeProviderCategory(
  category: string | undefined,
  type: ProviderType
): ProviderCategory {
  if (category === "media" || category === "llm") {
    return category;
  }
  return LLM_PROVIDER_TYPES.has(type) ? "llm" : "media";
}

function normalizeSurfaces(
  surfaces: string[] | undefined,
  category: ProviderCategory
): ProviderSurface[] {
  const valid = new Set<ProviderSurface>([
    "chat",
    "image",
    "video",
    "music",
    "speech",
    "sfx",
  ]);
  const normalized = (surfaces ?? []).filter((surface): surface is ProviderSurface =>
    valid.has(surface as ProviderSurface)
  );

  if (normalized.length > 0) {
    return [...new Set(normalized)];
  }

  return category === "llm" ? ["chat"] : [];
}

function providerTypeFromEntry(entry: ProviderEntry): ProviderType {
  return (entry.provider_type ?? entry.type) as ProviderType;
}

function providerEntryFromUnified(entry: UnifiedProviderEntry): ProviderEntry {
  const now = new Date().toISOString();
  return {
    provider_type: entry.type,
    category: entry.category,
    name: entry.name ?? entry.id,
    api_key: entry.api_key,
    base_url: entry.base_url,
    api_version: entry.api_version,
    deployment: entry.deployment,
    timeout: entry.timeout,
    max_retries: entry.max_retries,
    headers: entry.headers,
    surfaces: entry.surfaces,
    supports_custom_model: entry.supports_custom_model,
    enabled: entry.enabled ?? true,
    created_at: entry.created_at ?? now,
    updated_at: entry.updated_at ?? now,
  };
}

function getDefaultProviderId(config: UnifiedModelsFile): string | undefined {
  return config[MODELS_METADATA_KEY]?.default_provider;
}

function setDefaultProviderId(config: UnifiedModelsFile, id: string | undefined): void {
  config[MODELS_METADATA_KEY] = {
    ...(config[MODELS_METADATA_KEY] ?? {}),
    default_provider: id,
  };
}

function providerFromEntry(
  id: string,
  entry: ProviderEntry,
  defaultId: string | undefined
): Provider {
  const type = providerTypeFromEntry(entry);
  const category = normalizeProviderCategory(entry.category, type);
  return {
    id,
    type,
    category,
    name: entry.name,
    apiKey: entry.api_key,
    base_url: entry.base_url,
    apiVersion: entry.api_version,
    deployment: entry.deployment,
    timeout: entry.timeout,
    max_retries: entry.max_retries,
    headers: entry.headers,
    surfaces: normalizeSurfaces(entry.surfaces, category),
    supportsCustomModel: entry.supports_custom_model,
    isDefault: defaultId === id,
    enabled: entry.enabled,
    created_at: entry.created_at,
    updated_at: entry.updated_at,
  };
}

/**
 * ProviderManager handles provider CRUD operations
 */
export class ProviderManager {
  private config: UnifiedModelsFile | undefined;

  /**
   * Load the providers configuration
   */
  private async loadConfig(): Promise<UnifiedModelsFile> {
    if (this.config) {
      return this.config;
    }

    this.config = await loadUnifiedModelsFile();
    return this.config;
  }

  /**
   * Save the providers configuration
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

  /**
   * List all providers
   */
  async listProviders(): Promise<Provider[]> {
    const config = await this.loadConfig();
    const providers: Provider[] = [];
    const entries = getUnifiedProviders(config);
    const defaultId = getDefaultProviderId(config);

    for (const [id, entry] of Object.entries(entries)) {
      providers.push(providerFromEntry(id, providerEntryFromUnified(entry), defaultId));
    }

    return providers;
  }

  /**
   * Get a provider by ID
   */
  async getProvider(id: string): Promise<Provider | null> {
    const config = await this.loadConfig();
    const entry = getUnifiedProviders(config)[id];

    if (!entry) {
      return null;
    }

    return providerFromEntry(id, providerEntryFromUnified(entry), getDefaultProviderId(config));
  }

  /**
   * Create a new provider
   */
  async createProvider(options: CreateProviderOptions): Promise<Provider> {
    const config = await this.loadConfig();
    const id = this.generateProviderId(options.name);
    const providers = getUnifiedProviders(config);

    if (providers[id]) {
      throw new Error(`Provider with ID "${id}" already exists`);
    }

    const now = new Date().toISOString();
    const category = normalizeProviderCategory(options.category, options.type);
    const entry: ProviderEntry = {
      provider_type: options.type,
      category,
      name: options.name,
      api_key: options.apiKey,
      base_url: options.base_url || DEFAULT_BASE_URLS[options.type],
      api_version: options.apiVersion,
      deployment: options.deployment,
      timeout: options.timeout,
      max_retries: options.max_retries,
      headers: options.headers,
      surfaces: normalizeSurfaces(options.surfaces, category),
      supports_custom_model: options.supportsCustomModel,
      enabled: true,
      created_at: now,
      updated_at: now,
    };

    config[id] = {
      id,
      type: entry.provider_type,
      name: entry.name,
      base_url: entry.base_url,
      api_key: entry.api_key,
      category: entry.category,
      api_version: entry.api_version,
      deployment: entry.deployment,
      timeout: entry.timeout,
      max_retries: entry.max_retries,
      headers: entry.headers,
      surfaces: entry.surfaces,
      supports_custom_model: entry.supports_custom_model,
      enabled: entry.enabled,
      created_at: entry.created_at,
      updated_at: entry.updated_at,
      models: {},
    };

    // Set as default if requested or if it's the first provider
    if (options.setAsDefault || Object.keys(providers).length === 0) {
      setDefaultProviderId(config, id);
    }

    await this.saveConfig(config);

    return {
      id,
      type: options.type,
      category,
      name: options.name,
      apiKey: options.apiKey,
      base_url: entry.base_url,
      apiVersion: entry.api_version,
      deployment: entry.deployment,
      timeout: entry.timeout,
      max_retries: entry.max_retries,
      headers: entry.headers,
      surfaces: entry.surfaces as ProviderSurface[],
      supportsCustomModel: entry.supports_custom_model,
      isDefault: getDefaultProviderId(config) === id,
      enabled: true,
      created_at: now,
      updated_at: now,
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
    const provider = getUnifiedProviders(config)[id];

    if (!provider) {
      throw new Error(`Provider "${id}" not found`);
    }

    const entry = providerEntryFromUnified(provider);
    const now = new Date().toISOString();
    const updatedType = updates.type || providerTypeFromEntry(entry);
    const category = normalizeProviderCategory(
      updates.category ?? entry.category,
      updatedType
    );
    const updated: ProviderEntry = {
      ...entry,
      provider_type: updatedType,
      category,
      name: updates.name || entry.name,
      api_key: updates.apiKey ?? entry.api_key,
      base_url: updates.base_url ?? entry.base_url,
      api_version: updates.apiVersion ?? entry.api_version,
      deployment: updates.deployment ?? entry.deployment,
      timeout: updates.timeout ?? entry.timeout,
      max_retries: updates.max_retries ?? entry.max_retries,
      headers: updates.headers ?? entry.headers,
      surfaces: normalizeSurfaces(updates.surfaces ?? entry.surfaces, category),
      supports_custom_model:
        updates.supportsCustomModel ?? entry.supports_custom_model,
      updated_at: now,
    };

    config[id] = {
      ...provider,
      id,
      type: updated.provider_type,
      name: updated.name,
      base_url: updated.base_url,
      api_key: updated.api_key,
      category: updated.category,
      api_version: updated.api_version,
      deployment: updated.deployment,
      timeout: updated.timeout,
      max_retries: updated.max_retries,
      headers: updated.headers,
      surfaces: updated.surfaces,
      supports_custom_model: updated.supports_custom_model,
      enabled: updated.enabled,
      created_at: updated.created_at,
      updated_at: updated.updated_at,
    };
    await this.saveConfig(config);

    return providerFromEntry(id, updated, getDefaultProviderId(config));
  }

  /**
   * Remove a provider
   */
  async removeProvider(id: string): Promise<void> {
    const config = await this.loadConfig();
    const providers = getUnifiedProviders(config);

    if (!providers[id]) {
      throw new Error(`Provider "${id}" not found`);
    }

    delete config[id];

    // Clear default if removing the default provider
    if (getDefaultProviderId(config) === id) {
      const remaining = Object.keys(getUnifiedProviders(config));
      setDefaultProviderId(config, remaining.length > 0 ? remaining[0] : undefined);
    }

    await this.saveConfig(config);
  }

  /**
   * Set the default provider
   */
  async setDefault(id: string): Promise<void> {
    const config = await this.loadConfig();
    const providers = getUnifiedProviders(config);

    if (!providers[id]) {
      throw new Error(`Provider "${id}" not found`);
    }

    setDefaultProviderId(config, id);
    await this.saveConfig(config);
  }

  /**
   * Get the default provider ID
   */
  async getDefault(): Promise<string | undefined> {
    const config = await this.loadConfig();
    return getDefaultProviderId(config);
  }

  /**
   * Enable or disable a provider
   */
  async setEnabled(id: string, enabled: boolean): Promise<void> {
    const config = await this.loadConfig();
    const entry = getUnifiedProviders(config)[id];

    if (!entry) {
      throw new Error(`Provider "${id}" not found`);
    }

    entry.enabled = enabled;
    entry.updated_at = new Date().toISOString();
    config[id] = entry;
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
        checked_at: now,
      };
    }

    if (!provider.enabled) {
      return {
        id,
        connected: false,
        error: "Provider is disabled",
        checked_at: now,
      };
    }

    // Check if API key is configured (for providers that need it)
    const needsApiKey = ["openai", "openai-responses", "anthropic", "azure", "openrouter", "google"].includes(
      provider.type
    );
    if (needsApiKey && !provider.apiKey) {
      return {
        id,
        connected: false,
        error: "API key not configured",
        checked_at: now,
      };
    }

    // For now, assume connected if properly configured
    // In production, you'd test the actual API endpoint
    return {
      id,
      connected: true,
      latency: 0,
      checked_at: now,
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
