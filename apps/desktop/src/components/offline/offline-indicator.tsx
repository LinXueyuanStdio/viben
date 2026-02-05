import * as React from "react";
import { Wifi, WifiOff, RefreshCw, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useOfflineStatus } from "@/hooks/use-offline-status";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTranslation } from "react-i18next";

interface OfflineIndicatorProps {
  collapsed?: boolean;
  className?: string;
}

/**
 * Offline status indicator for the sidebar
 *
 * Shows network connection status with icon and optional label.
 * Clicking while online triggers a cache refresh.
 */
export function OfflineIndicator({ collapsed = false, className }: OfflineIndicatorProps) {
  const { t } = useTranslation();
  const {
    isOffline,
    cacheInfo,
    refreshing,
    refreshCache,
    checkOffline,
    formatLastUpdated,
  } = useOfflineStatus();

  const handleClick = async () => {
    if (isOffline) {
      // When offline, check if we're back online
      await checkOffline(true);
    } else {
      // When online, refresh the cache
      await refreshCache();
    }
  };

  const Icon = React.useMemo(() => {
    if (refreshing) return Loader2;
    if (isOffline) return WifiOff;
    return Wifi;
  }, [isOffline, refreshing]);

  const statusText = React.useMemo(() => {
    if (refreshing) return t("offline.syncing");
    if (isOffline) return t("offline.offline");
    return t("offline.online");
  }, [isOffline, refreshing, t]);

  const tooltipText = React.useMemo(() => {
    if (refreshing) return t("offline.syncingTooltip");
    if (isOffline) {
      const lastUpdated = cacheInfo?.last_updated
        ? formatLastUpdated(cacheInfo.last_updated)
        : t("offline.never");
      return t("offline.offlineTooltip", { lastUpdated });
    }
    return t("offline.onlineTooltip");
  }, [isOffline, refreshing, cacheInfo, formatLastUpdated, t]);

  // Collapsed view - just icon with tooltip
  if (collapsed) {
    return (
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={handleClick}
              disabled={refreshing}
              className={cn(
                "flex items-center justify-center h-10 w-10 rounded-lg transition-colors",
                "hover:bg-sidebar-accent",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                className
              )}
            >
              <Icon
                className={cn(
                  "h-4 w-4",
                  refreshing && "animate-spin",
                  isOffline ? "text-yellow-500" : "text-green-500"
                )}
              />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" className="font-medium">
            {tooltipText}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Expanded view - full indicator
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={handleClick}
            disabled={refreshing}
            className={cn(
              "w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs",
              "transition-colors duration-200",
              "hover:bg-sidebar-accent",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              className
            )}
          >
            <Icon
              className={cn(
                "h-3.5 w-3.5 shrink-0",
                refreshing && "animate-spin",
                isOffline ? "text-yellow-500" : "text-green-500"
              )}
            />
            <span className="text-sidebar-foreground/70 truncate">{statusText}</span>
            {!isOffline && !refreshing && (
              <RefreshCw className="h-3 w-3 ml-auto text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="font-medium">
          {tooltipText}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

OfflineIndicator.displayName = "OfflineIndicator";
