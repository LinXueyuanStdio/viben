import * as React from "react";
import {
  HardDrive,
  RefreshCw,
  Trash2,
  Loader2,
  Clock,
  Package,
  Sparkles,
  FolderOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useOfflineStatus, CacheSettings } from "@/hooks/use-offline-status";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";

interface CacheManagerProps {
  className?: string;
}

/**
 * Cache management component for settings page
 *
 * Displays cache size, provides clear/refresh buttons, and cache settings.
 */
export function CacheManager({ className }: CacheManagerProps) {
  const { t } = useTranslation();
  const {
    isOffline,
    cacheInfo,
    cacheSettings,
    loading,
    error,
    refreshing,
    refreshCache,
    clearCache,
    updateCacheSettings,
    formatCacheSize,
    formatLastUpdated,
  } = useOfflineStatus();

  const [clearing, setClearing] = React.useState(false);
  const [localSettings, setLocalSettings] = React.useState<CacheSettings | null>(null);

  // Initialize local settings when cache settings are loaded
  React.useEffect(() => {
    if (cacheSettings && !localSettings) {
      setLocalSettings(cacheSettings);
    }
  }, [cacheSettings, localSettings]);

  const handleRefresh = async () => {
    await refreshCache();
  };

  const handleClear = async () => {
    if (!window.confirm(t("offline.confirmClear"))) {
      return;
    }

    setClearing(true);
    try {
      await clearCache();
    } finally {
      setClearing(false);
    }
  };

  const handleOpenCacheFolder = async () => {
    if (cacheInfo?.cache_dir) {
      try {
        await invoke("open_folder", { path: cacheInfo.cache_dir });
      } catch (err) {
        console.error("Failed to open cache folder:", err);
      }
    }
  };

  const handleSettingChange = async (key: keyof CacheSettings, value: boolean | number) => {
    if (!localSettings) return;

    const newSettings = { ...localSettings, [key]: value };
    setLocalSettings(newSettings);
    await updateCacheSettings(newSettings);
  };

  const totalPackages =
    (cacheInfo?.mcp_packages_cached ?? 0) + (cacheInfo?.skills_packages_cached ?? 0);

  return (
    <div className={cn("space-y-4", className)}>
      {/* Cache Statistics */}
      <div className="grid grid-cols-2 gap-4">
        {/* Cache Size */}
        <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/50">
          <div className="p-2 rounded-lg bg-primary/10">
            <HardDrive className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t("offline.cacheSize")}</p>
            <p className="text-sm font-medium">
              {loading ? "..." : formatCacheSize(cacheInfo?.total_size_bytes ?? 0)}
            </p>
          </div>
        </div>

        {/* Last Updated */}
        <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/50">
          <div className="p-2 rounded-lg bg-primary/10">
            <Clock className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t("offline.lastUpdated")}</p>
            <p className="text-sm font-medium">
              {loading ? "..." : formatLastUpdated(cacheInfo?.last_updated ?? null)}
            </p>
          </div>
        </div>

        {/* MCP Packages */}
        <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/50">
          <div className="p-2 rounded-lg bg-primary/10">
            <Package className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t("offline.mcpPackages")}</p>
            <p className="text-sm font-medium">
              {loading ? "..." : cacheInfo?.mcp_packages_cached ?? 0}
            </p>
          </div>
        </div>

        {/* Skills Packages */}
        <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/50">
          <div className="p-2 rounded-lg bg-primary/10">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t("offline.skillsPackages")}</p>
            <p className="text-sm font-medium">
              {loading ? "..." : cacheInfo?.skills_packages_cached ?? 0}
            </p>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-3 rounded-xl bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={refreshing || isOffline}
          className="rounded-xl"
        >
          {refreshing ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          {t("offline.refreshCache")}
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={handleClear}
          disabled={clearing || totalPackages === 0}
          className="rounded-xl"
        >
          {clearing ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4 mr-2" />
          )}
          {t("offline.clearCache")}
        </Button>

        {cacheInfo?.cache_dir && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleOpenCacheFolder}
            className="rounded-xl ml-auto"
          >
            <FolderOpen className="h-4 w-4 mr-2" />
            {t("offline.openFolder")}
          </Button>
        )}
      </div>

      {/* Settings */}
      {localSettings && (
        <div className="pt-4 border-t space-y-4">
          <h4 className="text-sm font-medium">{t("offline.cacheSettings")}</h4>

          {/* Enable Caching */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm">{t("offline.enableCaching")}</p>
              <p className="text-xs text-muted-foreground">
                {t("offline.enableCachingDesc")}
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={localSettings.enabled}
                onChange={(e) => handleSettingChange("enabled", e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/20 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
            </label>
          </div>

          {/* Auto-refresh */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm">{t("offline.autoRefresh")}</p>
              <p className="text-xs text-muted-foreground">
                {t("offline.autoRefreshDesc", { hours: localSettings.refresh_interval_hours })}
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={localSettings.auto_refresh}
                onChange={(e) => handleSettingChange("auto_refresh", e.target.checked)}
                disabled={!localSettings.enabled}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/20 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary disabled:opacity-50"></div>
            </label>
          </div>

          {/* Max Cache Size */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm">{t("offline.maxCacheSize")}</p>
              <p className="text-xs text-muted-foreground">
                {t("offline.maxCacheSizeDesc")}
              </p>
            </div>
            <select
              value={localSettings.max_size_mb}
              onChange={(e) => handleSettingChange("max_size_mb", parseInt(e.target.value, 10))}
              disabled={!localSettings.enabled}
              className="rounded-xl border bg-background px-3 py-1.5 text-sm transition-all duration-200 focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-50"
            >
              <option value={50}>50 MB</option>
              <option value={100}>100 MB</option>
              <option value={200}>200 MB</option>
              <option value={500}>500 MB</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
}

CacheManager.displayName = "CacheManager";
