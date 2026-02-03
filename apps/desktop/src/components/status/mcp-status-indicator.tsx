import * as React from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Server, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores";
import { useMcpStatusMonitor } from "@/hooks/use-mcp-status-monitor";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTranslation } from "react-i18next";

type StatusVariant = "success" | "warning" | "error" | "neutral";

/**
 * MCP Server Status Indicator
 *
 * A fixed pill-shaped badge in the bottom-left corner that shows:
 * - Running server count (X/Y format)
 * - Status color (green/amber/red)
 * - Error indicator when servers have errors
 *
 * Clicking navigates to the Search Service page.
 */
export function McpStatusIndicator() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { mcpServers, mcpServerStatuses } = useAppStore();
  const { getStats } = useMcpStatusMonitor();

  // Calculate statistics
  const stats = React.useMemo(() => getStats(), [getStats, mcpServers, mcpServerStatuses]);

  // Don't render if no servers are configured
  if (stats.total === 0) {
    return null;
  }

  // Determine if still loading (no status data yet)
  const hasStatusData = Object.keys(mcpServerStatuses).length > 0;
  const isLoading = stats.total > 0 && !hasStatusData;

  // Determine variant based on status
  const variant: StatusVariant = React.useMemo(() => {
    if (isLoading) return "neutral";
    if (stats.error > 0) return "error";
    if (stats.running === stats.total) return "success";
    if (stats.running > 0) return "warning";
    return "neutral";
  }, [isLoading, stats.error, stats.running, stats.total]);

  // Handle click to navigate
  const handleClick = () => {
    navigate("/search-service");
  };

  // Handle keyboard navigation
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      navigate("/search-service");
    }
  };

  // Tooltip content
  const tooltipContent = React.useMemo(() => {
    if (isLoading) {
      return t("mcpStatus.checking");
    }
    if (stats.error > 0) {
      return t("mcpStatus.hasErrors", { count: stats.error });
    }
    if (stats.running === stats.total) {
      return t("mcpStatus.allRunning");
    }
    if (stats.running > 0) {
      return t("mcpStatus.partialRunning", { running: stats.running, total: stats.total });
    }
    return t("mcpStatus.allStopped");
  }, [isLoading, stats.error, stats.running, stats.total, t]);

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={handleClick}
            onKeyDown={handleKeyDown}
            className={cn(
              // Position and layout
              "fixed bottom-4 left-4 z-40",
              "inline-flex items-center gap-1.5",
              // Sizing
              "h-7 px-3",
              // Typography
              "text-xs font-medium",
              // Shape
              "rounded-full",
              // Base styles
              "border shadow-sm",
              // Transition
              "transition-all duration-200",
              // Hover and focus states
              "cursor-pointer",
              "hover:scale-105",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              // Variant-specific styles
              variant === "success" && [
                "bg-green-500/10 border-green-500/30 text-green-700",
                "dark:bg-green-500/20 dark:border-green-500/40 dark:text-green-400",
                "hover:bg-green-500/20 hover:border-green-500/50",
                "dark:hover:bg-green-500/30 dark:hover:border-green-500/50",
              ],
              variant === "warning" && [
                "bg-amber-500/10 border-amber-500/30 text-amber-700",
                "dark:bg-amber-500/20 dark:border-amber-500/40 dark:text-amber-400",
                "hover:bg-amber-500/20 hover:border-amber-500/50",
                "dark:hover:bg-amber-500/30 dark:hover:border-amber-500/50",
              ],
              variant === "error" && [
                "bg-red-500/10 border-red-500/30 text-red-700",
                "dark:bg-red-500/20 dark:border-red-500/40 dark:text-red-400",
                "hover:bg-red-500/20 hover:border-red-500/50",
                "dark:hover:bg-red-500/30 dark:hover:border-red-500/50",
              ],
              variant === "neutral" && [
                "bg-muted border-border text-muted-foreground",
                "hover:bg-accent hover:border-border-strong",
              ]
            )}
            aria-label={t("mcpStatus.ariaLabel", { running: stats.running, total: stats.total })}
          >
            {/* Icon */}
            {isLoading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : stats.error > 0 ? (
              <AlertTriangle className="h-3 w-3" />
            ) : (
              <Server className="h-3 w-3" />
            )}

            {/* Count */}
            <span>
              {isLoading
                ? t("mcpStatus.loading")
                : t("mcpStatus.count", { running: stats.running, total: stats.total })}
            </span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="font-medium">
          {tooltipContent}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

McpStatusIndicator.displayName = "McpStatusIndicator";
