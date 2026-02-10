/**
 * Source Tooltip Component
 *
 * A tooltip that displays source information (workspace path, etc.)
 * with a copy button. Used in list items to show where an item comes from.
 */

import * as React from "react";
import { useTranslation } from "react-i18next";
import { Copy, Check, Folder, Globe, FolderGit2 } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ============================================================================
// Types
// ============================================================================

export type SourceType = "workspace" | "global" | "project";

export interface SourceTooltipProps {
  /** Source type determines the icon and styling */
  type: SourceType;
  /** Path to display (e.g., workspace path) */
  path: string;
  /** Optional label override (defaults to type name) */
  label?: string;
  /** Children to wrap with tooltip */
  children: React.ReactNode;
  /** Side of the tooltip */
  side?: "top" | "right" | "bottom" | "left";
  /** Additional className for the trigger wrapper */
  className?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

const sourceConfig: Record<
  SourceType,
  { icon: typeof Folder; labelKey: string; color: string }
> = {
  workspace: {
    icon: Folder,
    labelKey: "agent.sourceWorkspace",
    color: "text-blue-500",
  },
  global: {
    icon: Globe,
    labelKey: "agent.sourceGlobal",
    color: "text-green-500",
  },
  project: {
    icon: FolderGit2,
    labelKey: "agent.sourceProject",
    color: "text-orange-500",
  },
};

// ============================================================================
// Component
// ============================================================================

export function SourceTooltip({
  type,
  path,
  label,
  children,
  side = "right",
  className,
}: SourceTooltipProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = React.useState(false);
  const config = sourceConfig[type];
  const Icon = config.icon;
  const displayLabel = label || t(config.labelKey);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(path);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy path:", err);
    }
  };

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={className}>{children}</span>
        </TooltipTrigger>
        <TooltipContent
          side={side}
          className="max-w-[300px] p-0"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-2 space-y-1.5">
            {/* Header */}
            <div className="flex items-center gap-1.5 text-xs font-medium">
              <Icon className={cn("h-3.5 w-3.5", config.color)} />
              <span>{displayLabel}</span>
            </div>

            {/* Path with copy button */}
            <div className="flex items-center gap-1 bg-muted/50 rounded px-2 py-1">
              <code className="flex-1 text-[11px] text-muted-foreground truncate">
                {path}
              </code>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 shrink-0"
                onClick={handleCopy}
              >
                {copied ? (
                  <Check className="h-3 w-3 text-green-500" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </Button>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ============================================================================
// Source Badge Component (for use in avatar)
// ============================================================================

export interface SourceBadgeProps {
  /** Source type */
  type: SourceType;
  /** Path to display in tooltip */
  path: string;
  /** Optional label override */
  label?: string;
  /** Size variant */
  size?: "sm" | "md";
  /** Additional className */
  className?: string;
}

export function SourceBadge({
  type,
  path,
  label,
  size = "sm",
  className,
}: SourceBadgeProps) {
  const config = sourceConfig[type];
  const Icon = config.icon;

  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-5 h-5",
  };

  const iconSizeClasses = {
    sm: "h-2.5 w-2.5",
    md: "h-3 w-3",
  };

  return (
    <SourceTooltip type={type} path={path} label={label} side="right">
      <div
        className={cn(
          "flex items-center justify-center rounded-full bg-background border shadow-sm cursor-help",
          sizeClasses[size],
          className
        )}
      >
        <Icon className={cn(iconSizeClasses[size], config.color)} />
      </div>
    </SourceTooltip>
  );
}
