import { useState, useEffect } from "react";
import { WifiOff, X, RefreshCw, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useOfflineStatus } from "@/hooks/use-offline-status";
import { useTranslation } from "react-i18next";

interface OfflineBannerProps {
  className?: string;
}

/**
 * Dismissible banner shown when offline
 *
 * Displays "Using cached data" message with option to refresh when back online.
 */
export function OfflineBanner({ className }: OfflineBannerProps) {
  const { t } = useTranslation();
  const { isOffline, cacheInfo, refreshing, refreshCache, checkOffline, formatLastUpdated } =
    useOfflineStatus();
  const [dismissed, setDismissed] = useState(false);

  // Reset dismissed state when going back online
  useEffect(() => {
    if (!isOffline) {
      setDismissed(false);
    }
  }, [isOffline]);

  // Don't show if online or dismissed
  if (!isOffline || dismissed) {
    return null;
  }

  const handleRefresh = async () => {
    // First check if we're back online
    const stillOffline = await checkOffline(true);
    if (!stillOffline) {
      // We're back online, refresh the cache
      await refreshCache();
    }
  };

  const lastUpdated = cacheInfo?.last_updated
    ? formatLastUpdated(cacheInfo.last_updated)
    : t("offline.never");

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-3 rounded-xl",
        "bg-yellow-100 dark:bg-yellow-900/30",
        "border border-yellow-200 dark:border-yellow-800",
        "text-yellow-800 dark:text-yellow-200",
        className
      )}
    >
      <WifiOff className="h-4 w-4 shrink-0" />

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{t("offline.usingCachedData")}</p>
        <p className="text-xs opacity-80">
          {t("offline.lastSynced", { time: lastUpdated })}
        </p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRefresh}
          disabled={refreshing}
          className="h-8 px-2 text-yellow-800 dark:text-yellow-200 hover:bg-yellow-200 dark:hover:bg-yellow-800/30"
        >
          {refreshing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          <span className="ml-1">{t("offline.tryReconnect")}</span>
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setDismissed(true)}
          className="h-8 w-8 text-yellow-800 dark:text-yellow-200 hover:bg-yellow-200 dark:hover:bg-yellow-800/30"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">{t("common.close")}</span>
        </Button>
      </div>
    </div>
  );
}

OfflineBanner.displayName = "OfflineBanner";
