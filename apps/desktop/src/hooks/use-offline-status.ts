import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";

/**
 * Cache statistics and information
 */
export interface CacheInfo {
  /** Path to cache directory */
  cache_dir: string;
  /** Total size of cached data in bytes */
  total_size_bytes: number;
  /** Number of MCP packages cached */
  mcp_packages_cached: number;
  /** Number of Skills packages cached */
  skills_packages_cached: number;
  /** Last time cache was updated (ISO 8601 format) */
  last_updated: string | null;
}

/**
 * Cache configuration settings
 */
export interface CacheSettings {
  /** Whether caching is enabled */
  enabled: boolean;
  /** Maximum cache size in megabytes */
  max_size_mb: number;
  /** Whether to auto-refresh cache periodically */
  auto_refresh: boolean;
  /** Auto-refresh interval in hours */
  refresh_interval_hours: number;
}

/**
 * Hook for managing offline status and cache operations
 */
export function useOfflineStatus() {
  const [isOffline, setIsOffline] = useState(false);
  const [cacheInfo, setCacheInfo] = useState<CacheInfo | null>(null);
  const [cacheSettings, setCacheSettings] = useState<CacheSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  /**
   * Check if currently offline
   */
  const checkOffline = useCallback(async (performNetworkCheck = false) => {
    try {
      const offline = await invoke<boolean>("is_offline", {
        checkNetwork: performNetworkCheck,
      });
      setIsOffline(offline);
      return offline;
    } catch (err) {
      // If the command fails, assume we might be offline
      console.error("Failed to check offline status:", err);
      return false;
    }
  }, []);

  /**
   * Fetch cache information
   */
  const fetchCacheInfo = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const info = await invoke<CacheInfo>("get_cache_info");
      setCacheInfo(info);
      return info;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Fetch cache settings
   */
  const fetchCacheSettings = useCallback(async () => {
    try {
      const settings = await invoke<CacheSettings>("get_cache_settings");
      setCacheSettings(settings);
      return settings;
    } catch (err) {
      console.error("Failed to fetch cache settings:", err);
      return null;
    }
  }, []);

  /**
   * Update cache settings
   */
  const updateCacheSettings = useCallback(async (settings: CacheSettings) => {
    try {
      await invoke("set_cache_settings", { settings });
      setCacheSettings(settings);
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      return false;
    }
  }, []);

  /**
   * Refresh the cache with latest data from the platform
   */
  const refreshCache = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const info = await invoke<CacheInfo>("refresh_cache");
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
  }, [checkOffline]);

  /**
   * Clear all cached data
   */
  const clearCache = useCallback(async () => {
    setError(null);
    try {
      await invoke<string>("clear_cache");
      // Refresh cache info after clearing
      await fetchCacheInfo();
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      return false;
    }
  }, [fetchCacheInfo]);

  /**
   * Check if cache needs refresh based on settings
   */
  const shouldRefreshCache = useCallback(async () => {
    try {
      return await invoke<boolean>("should_refresh_cache");
    } catch {
      return false;
    }
  }, []);

  /**
   * Format cache size for display
   */
  const formatCacheSize = useCallback((bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }, []);

  /**
   * Format last updated time for display
   */
  const formatLastUpdated = useCallback((isoDate: string | null): string => {
    if (!isoDate) return "Never";
    try {
      const date = new Date(isoDate);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return "Just now";
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;

      return date.toLocaleDateString();
    } catch {
      return "Unknown";
    }
  }, []);

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
