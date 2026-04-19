// apps/desktop/src/components/global-tab-bar/tab-item.tsx

/**
 * Tab Item Component
 *
 * Individual tab in the global tab bar with:
 * - Icon + name display
 * - Close button on hover
 * - Active/pinned state styling
 * - Right-click context menu (single click switches tab)
 */

import { useCallback, MouseEvent } from "react";
import {
  X,
  Pin,
  PinOff,
  FileText,
  MessageSquare,
  Settings,
  Plus,
  Globe,
  LayoutDashboard,
  FolderOpen,
  Clock,
  Bot,
  Activity,
  Lightbulb,
  type LucideIcon,
} from "lucide-react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { PageTab } from "@/stores/tab-store";

// Map icon name to icon component (for dynamic icon resolution)
const ICON_MAP: Record<string, LucideIcon> = {
  "file-text": FileText,
  "message-square": MessageSquare,
  settings: Settings,
  plus: Plus,
  globe: Globe,
  "layout-dashboard": LayoutDashboard,
  "folder-open": FolderOpen,
  clock: Clock,
  bot: Bot,
  activity: Activity,
  lightbulb: Lightbulb,
};

// Fallback icons by tab type
const TAB_TYPE_ICONS: Record<string, LucideIcon> = {
  page: FileText,
  chat: MessageSquare,
  settings: Settings,
  workspace: LayoutDashboard,
  web: Globe,
  "new-tab": Plus,
};

/**
 * Get icon component for a tab.
 * First tries to use tab.icon (dynamic), then falls back to type-based icon.
 */
function getTabIcon(tab: PageTab): LucideIcon {
  // Try dynamic icon name first
  if (tab.icon && ICON_MAP[tab.icon]) {
    return ICON_MAP[tab.icon];
  }
  // Fall back to type-based icon
  return TAB_TYPE_ICONS[tab.type] ?? FileText;
}

export interface TabItemProps {
  tab: PageTab;
  isActive: boolean;
  /** Whether this is the only tab (hide close button) */
  isOnlyTab?: boolean;
  onSelect: () => void;
  onClose: () => void;
  onPin: () => void;
  onUnpin: () => void;
  onCloseOthers: () => void;
}

export function TabItem({
  tab,
  isActive,
  isOnlyTab = false,
  onSelect,
  onClose,
  onPin,
  onUnpin,
  onCloseOthers,
}: TabItemProps) {
  const Icon = getTabIcon(tab);
  const canClose = !isOnlyTab;

  // Single click: switch to tab
  const handleClick = useCallback(
    (e: MouseEvent) => {
      e.preventDefault();
      onSelect();
    },
    [onSelect]
  );

  // Close button click
  const handleCloseClick = useCallback(
    (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onClose();
    },
    [onClose]
  );

  // Middle mouse button click to close tab
  const handleMiddleClick = useCallback(
    (e: MouseEvent) => {
      if (e.button === 1) {
        e.preventDefault();
        onClose();
      }
    },
    [onClose]
  );

  // Pinned tab: icon only with professional active state
  if (tab.pinned) {
    return (
      <ContextMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <ContextMenuTrigger asChild>
              <button
                onClick={handleClick}
                onMouseDown={handleMiddleClick}
                className={cn(
                  "relative h-7 w-7 flex items-center justify-center rounded-md",
                  "text-muted-foreground transition-all duration-150",
                  "hover:bg-accent hover:text-accent-foreground",
                  isActive && [
                    "bg-background text-foreground",
                    "shadow-sm ring-1 ring-border/50",
                  ]
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {isActive && (
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3 h-0.5 bg-primary rounded-full" />
                )}
              </button>
            </ContextMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            {tab.name}
          </TooltipContent>
        </Tooltip>
        <ContextMenuContent className="w-48">
          <ContextMenuItem onClick={onUnpin}>
            <PinOff className="h-4 w-4 mr-2" />
            Unpin Tab
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={onClose}>
            <X className="h-4 w-4 mr-2" />
            Close
          </ContextMenuItem>
          <ContextMenuItem onClick={onCloseOthers}>
            Close Others
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );
  }

  // Regular tab with professional active state design
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <button
          onClick={handleClick}
          onMouseDown={handleMiddleClick}
          className={cn(
            "group relative h-7 flex items-center gap-2 px-2.5 rounded-md",
            "text-muted-foreground transition-all duration-150 max-w-[180px]",
            "hover:bg-accent hover:text-accent-foreground",
            isActive && [
              "bg-background text-foreground",
              "shadow-sm ring-1 ring-border/50",
            ]
          )}
        >
          <Icon className={cn(
            "h-3.5 w-3.5 shrink-0 transition-colors",
            isActive && "text-primary"
          )} />
          <span className="truncate text-[13px]">{tab.name}</span>

          {/* Close button - visible on hover, hidden when only one tab */}
          {canClose && (
            <span
              onClick={handleCloseClick}
              className={cn(
                "shrink-0 h-4 w-4 rounded flex items-center justify-center",
                "opacity-0 group-hover:opacity-100 transition-opacity",
                "hover:bg-foreground/10"
              )}
            >
              <X className="h-3 w-3" />
            </span>
          )}

          {isActive && (
            <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-5 h-0.5 bg-primary rounded-full" />
          )}
        </button>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        <ContextMenuItem onClick={onPin}>
          <Pin className="h-4 w-4 mr-2" />
          Pin Tab
        </ContextMenuItem>
        {canClose && (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={onClose}>
              <X className="h-4 w-4 mr-2" />
              Close
            </ContextMenuItem>
            <ContextMenuItem onClick={onCloseOthers}>
              Close Others
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}
