import { useState, useEffect, useCallback, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useAppStore } from "@/stores";

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
 * Hook for accessing installed sources via browse-mcp-cli
 *
 * This is different from useMarketplace which fetches available plugins
 * from the remote marketplace. This hook fetches actually installed
 * and enabled sources from the local browse-mcp installation.
 */
export function useInstalledSources() {
  const { selectedPython } = useAppStore();
  const pythonPath = selectedPython?.path;
  const [data, setData] = useState<InstalledSourcesResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch installed sources from browse-mcp-cli
   */
  const fetchInstalledSources = useCallback(async () => {
    if (!pythonPath) {
      setError("Python path not configured");
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await invoke<InstalledSourcesResponse>(
        "get_installed_sources",
        { pythonPath }
      );
      setData(result);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [pythonPath]);

  /**
   * Show details of a specific provider
   */
  const showProvider = useCallback(
    async (provider: string) => {
      if (!pythonPath) {
        throw new Error("Python path not configured");
      }

      const result = await invoke<Record<string, unknown>>(
        "show_installed_provider",
        { pythonPath, provider }
      );
      return result;
    },
    [pythonPath]
  );

  /**
   * Install a provider plugin
   */
  const installProvider = useCallback(
    async (provider: string, upgrade = false) => {
      if (!pythonPath) {
        throw new Error("Python path not configured");
      }

      const result = await invoke<string>("install_provider", {
        pythonPath,
        provider,
        upgrade,
      });

      // Refresh after installation
      await fetchInstalledSources();

      return result;
    },
    [pythonPath, fetchInstalledSources]
  );

  // Load on mount and when pythonPath changes
  useEffect(() => {
    if (pythonPath) {
      fetchInstalledSources();
    }
  }, [pythonPath, fetchInstalledSources]);

  /**
   * Get all enabled sources (memoized)
   */
  const enabledSources = useMemo(
    () => data?.sources.filter((s) => s.enabled) ?? [],
    [data]
  );

  /**
   * Get sources grouped by provider (memoized)
   */
  const sourcesByProvider = useMemo(() => {
    if (!data) return {};
    const result: Record<string, InstalledSource[]> = {};
    for (const source of data.sources) {
      if (!result[source.provider]) {
        result[source.provider] = [];
      }
      result[source.provider].push(source);
    }
    return result;
  }, [data]);

  /**
   * Get a specific source by name
   */
  const getSource = useCallback(
    (name: string): InstalledSource | undefined => {
      return data?.sources.find((s) => s.name === name);
    },
    [data]
  );

  /**
   * Get provider info
   */
  const getProvider = useCallback(
    (providerId: string): InstalledProviderInfo | undefined => {
      return data?.providers[providerId];
    },
    [data]
  );

  /**
   * Check if a source is installed
   */
  const isInstalled = useCallback(
    (name: string): boolean => {
      return data?.sources.some((s) => s.name === name) ?? false;
    },
    [data]
  );

  /**
   * Check if a provider has any installed sources
   */
  const isProviderInstalled = useCallback(
    (providerId: string): boolean => {
      const provider = data?.providers[providerId];
      return provider ? provider.count > 0 : false;
    },
    [data]
  );

  return {
    // Data
    data,
    providers: data?.providers ?? {},
    sources: data?.sources ?? [],
    total: data?.total ?? 0,
    enabled: data?.enabled ?? 0,
    loading,
    error,

    // Computed
    enabledSources,
    sourcesByProvider,

    // Actions
    refresh: fetchInstalledSources,
    showProvider,
    installProvider,

    // Helpers
    getSource,
    getProvider,
    isInstalled,
    isProviderInstalled,
  };
}
