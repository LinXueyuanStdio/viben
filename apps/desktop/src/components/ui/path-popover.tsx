/**
 * PathPopover Component
 *
 * A reusable component that shows a path with copy button on hover.
 * Useful for displaying file paths, workspace paths, etc.
 */

import * as React from "react";
import { Copy, Check, FolderOpen, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

export interface PathPopoverProps {
  /** The path to display */
  path: string;
  /** Label for the path (e.g., "工作空间路径", "配置路径") */
  label?: string;
  /** Type of location - affects icon and styling */
  locationType?: "workspace" | "global" | "custom";
  /** Custom icon to use */
  icon?: React.ReactNode;
  /** Custom trigger element (if not provided, uses default badge) */
  trigger?: React.ReactNode;
  /** Additional class name for the trigger */
  triggerClassName?: string;
  /** Side of the tooltip */
  side?: "top" | "right" | "bottom" | "left";
  /** Alignment of the tooltip */
  align?: "start" | "center" | "end";
}

export function PathPopover({
  path,
  label,
  locationType = "custom",
  icon,
  trigger,
  triggerClassName,
  side = "top",
  align = "center",
}: PathPopoverProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = React.useState(false);

  // Get icon based on location type
  const getIcon = () => {
    if (icon) return icon;
    switch (locationType) {
      case "workspace":
        return <FolderOpen className="h-3 w-3" />;
      case "global":
        return <Globe className="h-3 w-3" />;
      default:
        return <FolderOpen className="h-3 w-3" />;
    }
  };

  // Get label based on location type
  const getLabel = () => {
    if (label) return label;
    switch (locationType) {
      case "workspace":
        return t("settingsAgents.workspaceScoped", "当前工作空间");
      case "global":
        return t("settingsAgents.globalScoped", "全局");
      default:
        return t("common.path", "路径");
    }
  };

  // Get badge style based on location type
  const getBadgeStyle = () => {
    switch (locationType) {
      case "workspace":
        return "bg-blue-500/10 text-blue-600 border-blue-500/30 hover:bg-blue-500/20";
      case "global":
        return "bg-emerald-500/10 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/20";
      default:
        return "bg-muted text-muted-foreground hover:bg-muted/80";
    }
  };

  // Copy to clipboard
  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      await navigator.clipboard.writeText(path);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  // Default trigger
  const defaultTrigger = (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[9px] px-1.5 py-0 rounded border cursor-default transition-colors",
        getBadgeStyle(),
        triggerClassName
      )}
    >
      {getIcon()}
      {getLabel()}
    </span>
  );

  return (
    <TooltipProvider>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          {trigger || defaultTrigger}
        </TooltipTrigger>
        <TooltipContent
          side={side}
          align={align}
          className="w-auto max-w-[400px] p-2"
        >
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <code className="block text-xs bg-muted px-2 py-1.5 rounded font-mono break-all select-all">
                {path}
              </code>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              onClick={handleCopy}
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-green-500" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * WorkspacePathBadge - Shorthand for workspace location badge
 */
export function WorkspacePathBadge({
  path,
  className,
}: {
  path: string;
  className?: string;
}) {
  return (
    <PathPopover
      path={path}
      locationType="workspace"
      triggerClassName={className}
    />
  );
}

/**
 * GlobalPathBadge - Shorthand for global location badge
 */
export function GlobalPathBadge({
  path,
  className,
}: {
  path: string;
  className?: string;
}) {
  return (
    <PathPopover
      path={path}
      locationType="global"
      triggerClassName={className}
    />
  );
}
