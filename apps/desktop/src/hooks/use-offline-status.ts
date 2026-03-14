import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { getGatewayClient, type CacheInfo, type CacheSettings } from "@/lib/gateway";

// Re-export types from gateway for consumers of this hook
export type { CacheInfo, CacheSettings };

/**
 * Hook for managing offline status and cache operations
 */
export function useOfflineStatus() {
  const { t } = useTranslation();
  const [isOffline, setIsOffline] = useState(false);
  const [cacheInfo, setCacheInfo] = useState<CacheInfo | null>(null);
  const [cacheSettings, setCacheSettings] = useState<CacheSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const gateway = getGatewayClient();

  /**
   * Check if currently offline
   */
  const checkOffline = useCallback(async (_performNetworkCheck = false) => {
    try {
      const offline = await gateway.isOffline();
      setIsOffline(offline);
      return offline;
    } catch (err) {
      // If the command fails, assume we might be offline
      console.error("Failed to check offline status:", err);
      return false;
    }
  }, [gateway]);

  /**
   * Fetch cache information
   */
  const fetchCacheInfo = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const info = await gateway.getCacheInfo();
      setCacheInfo(info);
      return info;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [gateway]);

  /**
   * Fetch cache settings
   */
  const fetchCacheSettings = useCallback(async () => {
    try {
      const settings = await gateway.getCacheSettings();
      setCacheSettings(settings);
      return settings;
    } catch (err) {
      console.error("Failed to fetch cache settings:", err);
      return null;
    }
  }, [gateway]);

  /**
   * Update cache settings
   */
  const updateCacheSettings = useCallback(async (settings: CacheSettings) => {
    try {
      await gateway.setCacheSettings(settings);
      setCacheSettings(settings);
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      return false;
    }
  }, [gateway]);

  /**
   * Refresh the cache with latest data from the platform
   */
  const refreshCache = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      await gateway.refreshCache();
      const info = await gateway.getCacheInfo();
      setCacheInfo(info);
      setIsOffline(false);
      return info;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      // Check if we went offline during refresh
      await checkOffline(true);
      return null;
    } finally {
      setRefreshing(false);
    }
  }, [gateway, checkOffline]);

  /**
   * Clear all cached data
   */
  const clearCache = useCallback(async () => {
    setError(null);
    try {
      await gateway.clearCache();
      // Refresh cache info after clearing
      await fetchCacheInfo();
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      return false;
    }
  }, [gateway, fetchCacheInfo]);

  /**
   * Check if cache needs refresh based on settings
   */
  const shouldRefreshCache = useCallback(async () => {
    try {
      return await gateway.shouldRefreshCache();
    } catch {
      return false;
    }
  }, [gateway]);

  /**
   * Format cache size for display
   */
  const formatCacheSize = useCallback((bytes: number): string => {
    if (bytes === 0) return t("offline.sizeBytes", "{{value}} B", { value: 0 });
    const k = 1024;
    const sizeKeys = ["sizeBytes", "sizeKB", "sizeMB", "sizeGB"] as const;
    const sizeDefaults = ["{{value}} B", "{{value}} KB", "{{value}} MB", "{{value}} GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const value = parseFloat((bytes / Math.pow(k, i)).toFixed(2));
    return t(`offline.${sizeKeys[i]}`, sizeDefaults[i], { value });
  }, [t]);

  /**
   * Format last updated time for display
   */
  const formatLastUpdated = useCallback((isoDate: string | null): string => {
    if (!isoDate) return t("offline.never", "Never");
    try {
      const date = new Date(isoDate);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return t("offline.justNow", "Just now");
      if (diffMins < 60) return t("offline.minutesAgo", "{{count}}m ago", { count: diffMins });
      if (diffHours < 24) return t("offline.hoursAgo", "{{count}}h ago", { count: diffHours });
      if (diffDays < 7) return t("offline.daysAgo", "{{count}}d ago", { count: diffDays });

      return date.toLocaleDateString();
    } catch {
      return t("offline.unknown", "Unknown");
    }
  }, [t]);

  // Initialize on mount
  useEffect(() => {
    checkOffline(true);
    fetchCacheInfo();
    fetchCacheSettings();
  }, [checkOffline, fetchCacheInfo, fetchCacheSettings]);

  // Listen for browser online/offline events
  useEffect(() => {
    const handleOnline = () => {
      checkOffline(true);
    };

    const handleOffline = () => {
      setIsOffline(true);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [checkOffline]);

  // Auto-refresh check
  useEffect(() => {
    const checkAutoRefresh = async () => {
      if (isOffline) return;

      const shouldRefresh = await shouldRefreshCache();
      if (shouldRefresh) {
        refreshCache();
      }
    };

    // Check once on mount
    checkAutoRefresh();

    // Check periodically (every hour)
    const interval = setInterval(checkAutoRefresh, 3600000);

    return () => clearInterval(interval);
  }, [isOffline, shouldRefreshCache, refreshCache]);

  return {
    isOffline,
    cacheInfo,
    cacheSettings,
    loading,
    error,
    refreshing,
    checkOffline,
    fetchCacheInfo,
    fetchCacheSettings,
    updateCacheSettings,
    refreshCache,
    clearCache,
    shouldRefreshCache,
    formatCacheSize,
    formatLastUpdated,
  };
}
