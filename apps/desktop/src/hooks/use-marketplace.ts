import { useState, useEffect, useCallback, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";

/**
 * Source info from a provider
 */
export interface SourceInfo {
  name: string;
  description: string;
  apiKey: "none" | "optional" | "required";
  documentation?: string;
}

/**
 * Provider info from the index
 */
export interface ProviderInfo {
  name: string;
  description: string;
  author: string;
  homepage?: string;
  sources: Record<string, SourceInfo>;
}

/**
 * Full provider index
 */
export interface ProviderIndex {
  version: string;
  updated_at?: string;
  providers: Record<string, ProviderInfo>;
}

/**
 * Flattened source for UI display
 */
export interface FlatSource {
  /** Hierarchical ID: provider/source */
  id: string;
  /** Flat source name */
  source_name: string;
  /** Provider ID */
  provider_id: string;
  /** Display name */
  name: string;
  /** Description */
  description: string;
  /** API key requirement */
  api_key_type: "none" | "optional" | "required";
  /** Documentation URL */
  documentation?: string;
  /** Provider display name */
  provider_name: string;
}

// ============================================================================
// Installed Sources Types (from browse-mcp-cli)
// ============================================================================

/**
 * Source info from the CLI output
 */
export interface InstalledSource {
  name: string;
  provider: string;
  enabled: boolean;
}

/**
 * Provider info from the CLI output
 */
export interface InstalledProviderInfo {
  name: string;
  description?: string;
  package?: string;
  sources: string[];
  count: number;
}

/**
 * Response from browse-mcp-cli list
 */
export interface InstalledSourcesResponse {
  providers: Record<string, InstalledProviderInfo>;
  sources: InstalledSource[];
  total: number;
  enabled: number;
}

/**
 * Hook for accessing the plugin marketplace
 */
export function useMarketplace() {
  const [index, setIndex] = useState<ProviderIndex | null>(null);
  const [sources, setSources] = useState<FlatSource[]>([]);
  const [sourcesByProvider, setSourcesByProvider] = useState<Record<string, FlatSource[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch the provider index
   */
  const fetchIndex = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<ProviderIndex>("get_provider_index", {
        forceRefresh,
      });
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
      const result = await invoke<FlatSource[]>("get_flat_sources");
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
   * Fetch sources grouped by provider
   */
  const fetchSourcesByProvider = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<Record<string, FlatSource[]>>("get_sources_by_provider");
      setSourcesByProvider(result);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      return {};
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Clear the cached provider index
   */
  const clearCache = useCallback(async () => {
    try {
      await invoke("clear_provider_cache");
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
      fetchSourcesByProvider(),
    ]);
  }, [fetchIndex, fetchSources, fetchSourcesByProvider]);

  // Load on mount
  useEffect(() => {
    refresh();
  }, [refresh]);

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
   * Get provider info
   */
  const getProvider = useCallback(
    (providerId: string): ProviderInfo | undefined => {
      return index?.providers[providerId];
    },
    [index]
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
          s.provider_name.toLowerCase().includes(lowerQuery)
      );
    },
    [sources]
  );

  return {
    // Data
    index,
    sources,
    sourcesByProvider,
    loading,
    error,

    // Computed
    apiKeyRequiredSources,
    apiKeyOptionalSources,
    freeSources,

    // Actions
    fetchIndex,
    fetchSources,
    fetchSourcesByProvider,
    clearCache,
    refresh,

    // Helpers
    getSource,
    getProvider,
    searchSources,
  };
}
