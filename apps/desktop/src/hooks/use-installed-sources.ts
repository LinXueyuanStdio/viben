import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { getGatewayClient, type InstalledSource, type InstalledProviderInfo, type InstalledSourcesResponse } from "@/lib/gateway";
import { useAppStore } from "@/stores";

export type { InstalledSource, InstalledProviderInfo, InstalledSourcesResponse };

/**
 * Hook for accessing installed sources via browse-mcp-cli
 *
 * This is different from useMarketplace which fetches available plugins
 * from the remote marketplace. This hook fetches actually installed
 * and enabled sources from the local browse-mcp installation.
 */
export function useInstalledSources() {
  const { t } = useTranslation();
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
      setError(t("errors.sources.pythonPathNotConfigured"));
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const client = getGatewayClient();
      const result = await client.getInstalledSources(pythonPath);
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
        throw new Error(t("errors.sources.pythonPathNotConfigured"));
      }

      const client = getGatewayClient();
      return await client.showInstalledProvider(pythonPath, provider);
    },
    [pythonPath, t]
  );

  /**
   * Install a provider plugin
   */
  const installProvider = useCallback(
    async (provider: string, upgrade = false) => {
      if (!pythonPath) {
        throw new Error(t("errors.sources.pythonPathNotConfigured"));
      }

      const client = getGatewayClient();
      const result = await client.installProvider(pythonPath, provider, upgrade);

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
