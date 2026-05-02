import { useMemo } from "react";
import { Activity, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useGatewayStatus } from "@/hooks/use-gateway-status";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTranslation } from "react-i18next";
import { usePageTabs } from "@/hooks/use-page-tabs";

type StatusVariant = "success" | "warning" | "error" | "neutral";

interface GatewayStatusIndicatorProps {
  collapsed?: boolean;
  className?: string;
}

/**
 * Gateway Status Indicator
 * 网关状态指示器
 *
 * Shows the connection status to viben gateway in the sidebar.
 * 在侧边栏显示 viben 网关的连接状态。
 * - Green: Connected 绿色：已连接
 * - Yellow: Connecting 黄色：连接中
 * - Red: Disconnected or error 红色：已断开或错误
 *
 * Clicking navigates to settings where users can configure the gateway URL.
 * 点击跳转到设置页面，用户可以配置网关 URL。
 */
export function GatewayStatusIndicator({
  collapsed = false,
  className,
}: GatewayStatusIndicatorProps) {
  const { t } = useTranslation();
  const { openGlobalView } = usePageTabs();
  const { status, isChecking, error, checkConnection } =
    useGatewayStatus();

  // Determine variant based on status
  const variant: StatusVariant = useMemo(() => {
    switch (status) {
      case "connected":
        return "success";
      case "connecting":
        return "neutral";
      case "disconnected":
        return "warning";
      case "error":
        return "error";
      default:
        return "neutral";
    }
  }, [status]);

  // Get icon based on status
  const Icon = useMemo(() => {
    switch (status) {
      case "connected":
        return CheckCircle2;
      case "connecting":
        return Loader2;
      case "disconnected":
        return Activity;
      case "error":
        return AlertCircle;
      default:
        return Activity;
    }
  }, [status]);

  // Handle click - either retry or navigate to gateway settings
  const handleClick = async () => {
    if (status === "disconnected" || status === "error") {
      // Try to reconnect first
      const connected = await checkConnection();
      if (!connected) {
        // If still not connected, navigate to gateway settings
        openGlobalView("/settings/gateway", t("settingsGateway.title", "Gateway"), {
          type: "lucide",
          value: "network",
        });
      }
    } else {
      openGlobalView("/settings/gateway", t("settingsGateway.title", "Gateway"), {
        type: "lucide",
        value: "network",
      });
    }
  };

  // Get display text
  const displayText = useMemo(() => {
    switch (status) {
      case "connected":
        return t("gateway.connected");
      case "connecting":
        return t("gateway.connecting");
      case "disconnected":
        return t("gateway.disconnected");
      case "error":
        return t("gateway.error");
      default:
        return "";
    }
  }, [status, t]);

  // Get tooltip content
  const tooltipContent = useMemo(() => {
    switch (status) {
      case "connected":
        return t("gateway.connectedTooltip");
      case "connecting":
        return t("gateway.connectingTooltip");
      case "disconnected":
        return t("gateway.disconnectedTooltip");
      case "error":
        return error || t("gateway.errorTooltip");
      default:
        return "";
    }
  }, [status, error, t]);

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
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                className
              )}
            >
              <Icon
                className={cn(
                  "h-4 w-4",
                  isChecking && "animate-spin",
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
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              className
            )}
          >
            <Icon
              className={cn(
                "h-3.5 w-3.5 shrink-0",
                isChecking && "animate-spin",
                variant === "success" && "text-green-500",
                variant === "warning" && "text-yellow-500",
                variant === "error" && "text-red-500",
                variant === "neutral" && "text-muted-foreground"
              )}
            />
            <span className="text-sidebar-foreground/70 truncate">
              {displayText}
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

GatewayStatusIndicator.displayName = "GatewayStatusIndicator";
