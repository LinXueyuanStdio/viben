import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Server, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores";
import { useMcpStatusMonitor } from "@/hooks/use-mcp-status-monitor";
import { usePython } from "@/hooks/use-python";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTranslation } from "react-i18next";

type StatusVariant = "success" | "warning" | "error" | "neutral";

/**
 * Status phases in progressive order:
 * 1. python_checking - Detecting Python version
 * 2. python_missing - Python not found or invalid
 * 3. package_checking - Checking browse-mcp installation
 * 4. package_missing - browse-mcp not installed
 * 5. server_none - No MCP servers created
 * 6. server_inactive - All servers stopped (0/N)
 * 7. server_partial - Some servers running (M/N)
 * 8. server_active - All servers running (N/N)
 * 9. server_error - Some servers have errors
 */
type StatusPhase =
  | "python_checking"
  | "python_missing"
  | "package_checking"
  | "package_missing"
  | "server_none"
  | "server_inactive"
  | "server_partial"
  | "server_active"
  | "server_error";

/**
 * Unified Status Indicator
 *
 * Shows progressive status in the sidebar:
 * - Python detection status
 * - browse-mcp installation status
 * - MCP server status (X/Y format)
 *
 * Clicking navigates to the appropriate settings/service page.
 */
export function McpStatusIndicator({ collapsed = false }: { collapsed?: boolean }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { mcpServers, mcpServerStatuses } = useAppStore();
  const { getStats } = useMcpStatusMonitor();
  const { selectedPython, browseMcpInfo, loading: pythonLoading } = usePython();

  // Calculate MCP server statistics
  const stats = useMemo(() => getStats(), [getStats, mcpServers, mcpServerStatuses]);

  // Extract stable values for memo dependencies
  const pythonValid = selectedPython?.is_valid ?? false;
  const browseMcpInstalled = browseMcpInfo?.installed ?? false;
  const browseMcpChecked = browseMcpInfo !== null;

  // Determine the current status phase
  const phase: StatusPhase = useMemo(() => {
    // Phase 1 & 2: Python check
    if (pythonLoading) {
      return "python_checking";
    }
    if (!pythonValid) {
      return "python_missing";
    }

    // Phase 3 & 4: Package check
    if (!browseMcpChecked) {
      return "package_checking";
    }
    if (!browseMcpInstalled) {
      return "package_missing";
    }

    // Phase 5-9: Server status
    if (stats.total === 0) {
      return "server_none";
    }

    // Check if we're still loading server status
    const hasStatusData = Object.keys(mcpServerStatuses).length > 0;
    if (!hasStatusData) {
      return "server_inactive"; // Default to inactive while loading
    }

    if (stats.error > 0) {
      return "server_error";
    }
    if (stats.running === stats.total) {
      return "server_active";
    }
    if (stats.running > 0) {
      return "server_partial";
    }
    return "server_inactive";
  }, [pythonLoading, pythonValid, browseMcpChecked, browseMcpInstalled, stats, mcpServerStatuses]);

  // Determine variant based on phase
  const variant: StatusVariant = useMemo(() => {
    switch (phase) {
      case "python_checking":
      case "package_checking":
        return "neutral";
      case "python_missing":
      case "package_missing":
      case "server_error":
        return "error";
      case "server_none":
      case "server_inactive":
        return "warning";
      case "server_partial":
        return "warning";
      case "server_active":
        return "success";
      default:
        return "neutral";
    }
  }, [phase]);

  // Handle click to navigate to appropriate page
  const handleClick = () => {
    switch (phase) {
      case "python_checking":
      case "python_missing":
      case "package_checking":
      case "package_missing":
        navigate("/settings/environment");
        break;
      default:
        // Navigate to MCP settings page with dashboard tab
        navigate("/settings/mcp?tab=dashboard");
    }
  };

  // Get display text
  const displayText = useMemo(() => {
    switch (phase) {
      case "python_checking":
        return t("mcpStatus.pythonChecking");
      case "python_missing":
        return t("mcpStatus.pythonMissing");
      case "package_checking":
        return t("mcpStatus.packageChecking");
      case "package_missing":
        return t("mcpStatus.packageMissing");
      case "server_none":
        return t("mcpStatus.serverNone");
      case "server_inactive":
        return t("mcpStatus.count", { running: 0, total: stats.total });
      case "server_partial":
      case "server_active":
      case "server_error":
        return t("mcpStatus.count", { running: stats.running, total: stats.total });
      default:
        return "";
    }
  }, [phase, stats, t]);

  // Get tooltip content
  const tooltipContent = useMemo(() => {
    switch (phase) {
      case "python_checking":
        return t("mcpStatus.pythonCheckingTooltip");
      case "python_missing":
        return t("mcpStatus.pythonMissingTooltip");
      case "package_checking":
        return t("mcpStatus.packageCheckingTooltip");
      case "package_missing":
        return t("mcpStatus.packageMissingTooltip");
      case "server_none":
        return t("mcpStatus.serverNoneTooltip");
      case "server_inactive":
        return t("mcpStatus.allStopped");
      case "server_partial":
        return t("mcpStatus.partialRunning", { running: stats.running, total: stats.total });
      case "server_active":
        return t("mcpStatus.allRunning");
      case "server_error":
        return t("mcpStatus.hasErrors", { count: stats.error });
      default:
        return "";
    }
  }, [phase, stats, t]);

  // Get icon based on phase
  const Icon = useMemo(() => {
    switch (phase) {
      case "python_checking":
      case "package_checking":
        return Loader2;
      case "python_missing":
      case "package_missing":
        return AlertCircle;
      case "server_none":
        return AlertCircle;
      case "server_inactive":
        return Server;
      case "server_partial":
        return Server;
      case "server_active":
        return CheckCircle2;
      case "server_error":
        return AlertTriangle;
      default:
        return Server;
    }
  }, [phase]);

  const isLoading = phase === "python_checking" || phase === "package_checking";

  // Collapsed view - just icon with tooltip
  if (collapsed) {
    return (
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={handleClick}
              className={cn(
                "flex items-center justify-center h-10 w-10 rounded-lg transition-colors",
                "hover:bg-sidebar-accent",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              )}
            >
              <Icon
                className={cn(
                  "h-4 w-4",
                  isLoading && "animate-spin",
                  variant === "success" && "text-green-500",
                  variant === "warning" && "text-yellow-500",
                  variant === "error" && "text-red-500",
                  variant === "neutral" && "text-muted-foreground"
                )}
              />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" className="font-medium">
            {tooltipContent}
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
            className={cn(
              "w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs",
              "transition-colors duration-200",
              "hover:bg-sidebar-accent",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            )}
          >
            <Icon
              className={cn(
                "h-3.5 w-3.5 shrink-0",
                isLoading && "animate-spin",
                variant === "success" && "text-green-500",
                variant === "warning" && "text-yellow-500",
                variant === "error" && "text-red-500",
                variant === "neutral" && "text-muted-foreground"
              )}
            />
            <span className="text-sidebar-foreground/70 truncate">{displayText}</span>
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
