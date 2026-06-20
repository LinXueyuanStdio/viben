import * as React from "react";
import { useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useDesktopRouting } from "@/hooks/use-desktop-routing";

interface SidebarIconButtonProps {
  /** Icon component to render */
  icon: React.ReactNode;
  /** Tooltip text */
  tooltip: string;
  /** If provided, navigates to this path on click */
  href?: string;
  /** Click handler */
  onClick?: () => void;
  /** Whether the button is disabled */
  disabled?: boolean;
}

/**
 * Unified icon button for collapsed sidebar.
 * Modeled after McpStatusIndicator for consistent behavior.
 *
 * IMPORTANT: Parent must wrap this in a centering container:
 * <div className="grid place-items-center w-full">
 *   <SidebarIconButton ... />
 * </div>
 */
export function SidebarIconButton({
  icon,
  tooltip,
  href,
  onClick,
  disabled,
}: SidebarIconButtonProps) {
  const { openPath } = useDesktopRouting();
  const location = useLocation();

  // Check if current route matches href (for active state)
  const isActive = href
    ? location.pathname === href || location.pathname.startsWith(href + "/")
    : false;

  const handleClick = () => {
    if (disabled) return;
    // If onClick is provided, let it handle navigation
    if (onClick) {
      onClick();
      return;
    }
    // Fallback: use href for direct navigation
    if (href) {
      openPath(href, {
        descriptorId: href.startsWith("/settings") ? "settings" : "workspace",
        title: tooltip,
      });
    }
  };

  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={tooltip}
            onClick={handleClick}
            disabled={disabled}
            className={cn(
              "flex items-center justify-center h-10 w-10 rounded-lg transition-colors",
              "hover:bg-sidebar-accent",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              isActive && "bg-sidebar-accent text-sidebar-accent-foreground",
              disabled && "opacity-50 cursor-not-allowed"
            )}
          >
            {icon}
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" className="font-medium">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
