import { useState, useEffect, useCallback, useMemo } from "react";
import {
  getGatewayClient,
  type MarketplaceCategory,
  type MarketplacePlugin,
  type ProviderIndex,
  type FlatSource,
} from "@/lib/gateway";

export type {
  MarketplaceCategory,
  MarketplacePlugin,
  ProviderIndex,
  FlatSource,
};

// Re-export types for backwards compatibility
export type { InstalledSource, InstalledProviderInfo, InstalledSourcesResponse } from "@/lib/gateway";

/**
 * Hook for accessing the plugin marketplace
 */
export function useMarketplace() {
  const [index, setIndex] = useState<ProviderIndex | null>(null);
  const [sources, setSources] = useState<FlatSource[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch the provider index
   */
  const fetchIndex = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const client = getGatewayClient();
      const result = await client.getProviderIndex(forceRefresh);
      setIndex(result);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Fetch all sources as a flat list
   */
  const fetchSources = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const client = getGatewayClient();
      const result = await client.getFlatSources();
      setSources(result);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Clear the cached provider index
   */
  const clearCache = useCallback(async () => {
    try {
      const client = getGatewayClient();
      await client.clearProviderCache();
      // Refresh after clearing
      await fetchIndex(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    }
  }, [fetchIndex]);

  /**
   * Refresh all data
   */
  const refresh = useCallback(async (force = false) => {
    await Promise.all([
      fetchIndex(force),
      fetchSources(),
    ]);
  }, [fetchIndex, fetchSources]);

  // Load on mount
  useEffect(() => {
    refresh();
  }, [refresh]);

  // ============================================================================
  // Computed Properties
  // ============================================================================

  /**
   * Get all plugins (memoized)
   */
  const plugins = useMemo(() => index?.plugins ?? [], [index]);

  /**
   * Get all categories (memoized)
   */
  const categories = useMemo(() => index?.categories ?? [], [index]);

  /**
   * Get built-in plugins (memoized)
   */
  const builtinPlugins = useMemo(
    () => plugins.filter((p) => p.builtin),
    [plugins]
  );

  /**
   * Get third-party plugins (memoized)
   */
  const thirdPartyPlugins = useMemo(
    () => plugins.filter((p) => !p.builtin),
    [plugins]
  );

  /**
   * Get sources that require API keys (memoized)
   */
  const apiKeyRequiredSources = useMemo(
    () => sources.filter((s) => s.api_key_type === "required"),
    [sources]
  );

  /**
   * Get sources with optional API keys (memoized)
   */
  const apiKeyOptionalSources = useMemo(
    () => sources.filter((s) => s.api_key_type === "optional"),
    [sources]
  );

  /**
   * Get free sources (no API key needed) (memoized)
   */
  const freeSources = useMemo(
    () => sources.filter((s) => s.api_key_type === "none"),
    [sources]
  );

  /**
   * Get plugins grouped by category (memoized)
   */
  const pluginsByCategory = useMemo(() => {
    const result: Record<string, MarketplacePlugin[]> = {};
    for (const plugin of plugins) {
      for (const categoryId of plugin.categories) {
        if (!result[categoryId]) {
          result[categoryId] = [];
        }
        result[categoryId].push(plugin);
      }
    }
    return result;
  }, [plugins]);

  /**
   * Get sources grouped by category (memoized)
   * Computed from sources instead of fetching from backend
   */
  const sourcesByCategory = useMemo(() => {
    const result: Record<string, FlatSource[]> = {};
    for (const source of sources) {
      const category = source.category ?? "uncategorized";
      if (!result[category]) {
        result[category] = [];
      }
      result[category].push(source);
    }
    return result;
  }, [sources]);

  /**
   * Get sources grouped by plugin (memoized)
   * Computed from sources instead of fetching from backend
   */
  const sourcesByPlugin = useMemo(() => {
    const result: Record<string, FlatSource[]> = {};
    for (const source of sources) {
      if (!result[source.plugin_id]) {
        result[source.plugin_id] = [];
      }
      result[source.plugin_id].push(source);
    }
    return result;
  }, [sources]);

  // ============================================================================
  // Helper Functions
  // ============================================================================

  /**
   * Get a specific source by ID (hierarchical or flat)
   */
  const getSource = useCallback(
    (id: string): FlatSource | undefined => {
      // Try hierarchical first
      let source = sources.find((s) => s.id === id);
      if (!source) {
        // Try flat name
        source = sources.find((s) => s.source_name === id);
      }
      return source;
    },
    [sources]
  );

  /**
   * Get plugin info by ID
   */
  const getPlugin = useCallback(
    (pluginId: string): MarketplacePlugin | undefined => {
      return plugins.find((p) => p.id === pluginId);
    },
    [plugins]
  );

  /**
   * Get category info by ID
   */
  const getCategory = useCallback(
    (categoryId: string): MarketplaceCategory | undefined => {
      return categories.find((c) => c.id === categoryId);
    },
    [categories]
  );

  /**
   * Search sources by name or description
   */
  const searchSources = useCallback(
    (query: string): FlatSource[] => {
      if (!query.trim()) return sources;
      const lowerQuery = query.toLowerCase();
      return sources.filter(
        (s) =>
          s.name.toLowerCase().includes(lowerQuery) ||
          s.description.toLowerCase().includes(lowerQuery) ||
          s.source_name.toLowerCase().includes(lowerQuery) ||
          s.plugin_name.toLowerCase().includes(lowerQuery)
      );
    },
    [sources]
  );

  /**
   * Search plugins by name or description
   */
  const searchPlugins = useCallback(
    (query: string): MarketplacePlugin[] => {
      if (!query.trim()) return plugins;
      const lowerQuery = query.toLowerCase();
      return plugins.filter(
        (p) =>
          p.name.toLowerCase().includes(lowerQuery) ||
          p.description.toLowerCase().includes(lowerQuery) ||
          p.id.toLowerCase().includes(lowerQuery) ||
          p.author_name.toLowerCase().includes(lowerQuery)
      );
    },
    [plugins]
  );

  return {
    // Data
    index,
    sources,
    plugins,
    categories,
    sourcesByCategory,
    sourcesByPlugin,
    loading,
    error,

    // Computed
    builtinPlugins,
    thirdPartyPlugins,
    pluginsByCategory,
    apiKeyRequiredSources,
    apiKeyOptionalSources,
    freeSources,

    // Actions
    fetchIndex,
    fetchSources,
    clearCache,
    refresh,

    // Helpers
    getSource,
    getPlugin,
    getCategory,
    searchSources,
    searchPlugins,
  };
}
