import { useState, useEffect, useCallback, useMemo } from "react";
import {
  getGatewayClient,
  type BrowsePluginRegistryEntry,
  type BrowsePluginRegistry,
  type InstalledBrowsePlugin,
} from "@/lib/gateway";

export interface UseBrowsePluginsReturn {
  registry: BrowsePluginRegistryEntry[];
  installed: InstalledBrowsePlugin[];
  loading: boolean;
  installing: Set<string>;
  error: string | null;
  refresh: () => Promise<void>;
  install: (pluginId: string, downloadUrl: string) => Promise<boolean>;
  uninstall: (pluginId: string) => Promise<boolean>;
  isInstalled: (pluginId: string) => boolean;
}

export function useBrowsePlugins(): UseBrowsePluginsReturn {
  const [registry, setRegistry] = useState<BrowsePluginRegistry | null>(null);
  const [installed, setInstalled] = useState<InstalledBrowsePlugin[]>([]);
  const [loading, setLoading] = useState(false);
  const [installing, setInstalling] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const client = getGatewayClient();
      const [reg, inst] = await Promise.all([
        client.getBrowsePluginRegistry(),
        client.getInstalledBrowsePlugins(),
      ]);
      setRegistry(reg);
      setInstalled(inst.plugins);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const install = useCallback(async (pluginId: string, downloadUrl: string): Promise<boolean> => {
    setInstalling((prev) => new Set(prev).add(pluginId));
    try {
      const client = getGatewayClient();
      const result = await client.installBrowsePlugin(pluginId, downloadUrl);
      if (result.success && result.plugin) {
        setInstalled((prev) => [...prev.filter((p) => p.id !== pluginId), result.plugin!]);
        return true;
      }
      setError(result.error ?? "Install failed");
      return false;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return false;
    } finally {
      setInstalling((prev) => {
        const next = new Set(prev);
        next.delete(pluginId);
        return next;
      });
    }
  }, []);

  const uninstall = useCallback(async (pluginId: string): Promise<boolean> => {
    try {
      const client = getGatewayClient();
      await client.uninstallBrowsePlugin(pluginId);
      setInstalled((prev) => prev.filter((p) => p.id !== pluginId));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return false;
    }
  }, []);

  const isInstalled = useCallback(
    (pluginId: string) => installed.some((p) => p.id === pluginId),
    [installed]
  );

  const registryPlugins = useMemo(() => registry?.plugins ?? [], [registry]);

  return {
    registry: registryPlugins,
    installed,
    loading,
    installing,
    error,
    refresh: fetchAll,
    install,
    uninstall,
    isInstalled,
  };
}
