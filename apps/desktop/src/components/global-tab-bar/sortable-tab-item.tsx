// apps/desktop/src/components/global-tab-bar/sortable-tab-item.tsx

/**
 * Sortable Tab Item Component
 *
 * Individual tab wrapped with @dnd-kit sortable functionality.
 */

import { memo, useCallback, useState, useEffect, useRef, MouseEvent } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  X,
  Pin,
  PinOff,
  GripVertical,
  ExternalLink,
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
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { getDescriptorIcon } from "@/navigation/route-registry";
import { IconDisplay } from "@/components/ui/icon-picker";
import type { IconData } from "@/components/ui/icon-picker";
import type { TabViewModel } from "@/stores/tab-store";

function getTabIconData(tab: TabViewModel): IconData {
  if (tab.icon) {
    return tab.icon;
  }
  return getDescriptorIcon(tab.descriptorId) ?? { type: "lucide", value: "file-text" };
}

export interface SortableTabItemProps {
  tab: TabViewModel;
  isActive: boolean;
  isOnlyTab?: boolean;
  /** Whether this is a newly created tab (for entrance animation) */
  isNew?: boolean;
  isDragging?: boolean;
  onSelect: () => void;
  onClose: () => void;
  onPin: () => void;
  onUnpin: () => void;
  onCloseOthers: () => void;
  onCloseRight: () => void;
  onDuplicate: () => void;
  onReopenClosed: () => void;
  onCopyLink: () => void | Promise<void>;
  onDetach: () => void | Promise<void>;
  onMoveToStart: () => void;
  onMoveToEnd: () => void;
  canReopenClosed?: boolean;
  canMoveToStart?: boolean;
  canMoveToEnd?: boolean;
}

export const SortableTabItem = memo(function SortableTabItem({
  tab,
  isActive,
  isOnlyTab = false,
  isDragging = false,
  isNew = false,
  onSelect,
  onClose,
  onPin,
  onUnpin,
  onCloseOthers,
  onCloseRight,
  onDuplicate,
  onReopenClosed,
  onCopyLink,
  onDetach,
  onMoveToStart,
  onMoveToEnd,
  canReopenClosed = false,
  canMoveToStart = false,
  canMoveToEnd = false,
}: SortableTabItemProps) {
  const { t } = useTranslation();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: tab.id });

  const iconData = getTabIconData(tab);
  const canClose = !isOnlyTab;
  const dragging = isDragging || isSortableDragging;
  const [isHovered, setIsHovered] = useState(false);

  // Entrance animation state
  const [isAnimating, setIsAnimating] = useState(isNew);
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (isNew && !hasAnimated.current) {
      hasAnimated.current = true;
      // Small delay to ensure DOM is ready, then trigger animation
      const timer = setTimeout(() => {
        setIsAnimating(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isNew]);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleClick = useCallback(
    (e: MouseEvent) => {
      e.preventDefault();
      onSelect();
    },
    [onSelect]
  );

  const handleCloseClick = useCallback(
    (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onClose();
    },
    [onClose]
  );

  const handleMiddleClick = useCallback(
    (e: MouseEvent) => {
      if (e.button === 1) {
        e.preventDefault();
        onClose();
      }
    },
    [onClose]
  );

  // Pinned tab: icon only (shows drag handle on hover)
  if (tab.pinned) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
      >
        {/* Wrapper for entrance animation - keeps dnd-kit transform separate */}
        <div
          className={cn(
            isAnimating && "opacity-0 translate-x-5 scale-[0.8]",
            !isAnimating && "opacity-100",
            isNew && "transition-[opacity,transform] duration-300 ease-out"
          )}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
        <ContextMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <ContextMenuTrigger asChild>
                <button
                  onClick={handleClick}
                  onMouseDown={handleMiddleClick}
                  className={cn(
                    "relative h-7 w-7 flex items-center justify-center rounded-md",
                    "text-muted-foreground transition-all duration-200",
                    "hover:bg-accent hover:text-accent-foreground",
                    "cursor-grab active:cursor-grabbing",
                    isActive && [
                      "bg-background text-foreground",
                      "shadow-sm ring-1 ring-border/50",
                    ],
                    dragging && "opacity-40 z-50"
                  )}
                >
                  {/* Icon or drag handle based on hover state */}
                  {isHovered || dragging ? (
                    <GripVertical className="h-3.5 w-3.5 text-muted-foreground/60" />
                  ) : (
                    <IconDisplay icon={iconData} size="sm" />
                  )}
                  {isActive && (
                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3 h-0.5 bg-primary rounded-full" />
                  )}
                </button>
              </ContextMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              {tab.titleKey ? t(tab.titleKey, tab.label) : tab.label}
            </TooltipContent>
          </Tooltip>
          <ContextMenuContent className="w-56">
            <ContextMenuItem onClick={onClose}>
              <X className="h-4 w-4 mr-2" />
              {t("common.close")}
            </ContextMenuItem>
            <ContextMenuItem onClick={onCloseOthers}>
              <span className="w-4 h-4 mr-2" />{t("tabBar.closeOthers", "Close Others")}
            </ContextMenuItem>
            <ContextMenuItem onClick={onCloseRight}>
              <span className="w-4 h-4 mr-2" />{t("tabBar.closeToRight", "Close Tabs to the Right")}
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={onReopenClosed} disabled={!canReopenClosed}>
              <span className="w-4 h-4 mr-2" />{t("tabBar.reopenClosedTab", "Reopen Closed Tab")}
            </ContextMenuItem>
            <ContextMenuItem onClick={onDuplicate}>
              <span className="w-4 h-4 mr-2" />{t("tabBar.duplicateTab", "Duplicate Tab")}
            </ContextMenuItem>
            <ContextMenuItem onClick={onDetach}>
              <ExternalLink className="h-4 w-4 mr-2" />
              {t("tabBar.detachToNewWindow", "Detach to New Window")}
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={onUnpin}>
              <PinOff className="h-4 w-4 mr-2" />
              {t("tabBar.unpinTab", "Unpin Tab")}
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={onCopyLink}>
              <span className="w-4 h-4 mr-2" />{t("tabBar.copyLink", "Copy Link")}
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={onMoveToStart} disabled={!canMoveToStart}>
              <span className="w-4 h-4 mr-2" />{t("tabBar.moveToStart", "Move to Start")}
            </ContextMenuItem>
            <ContextMenuItem onClick={onMoveToEnd} disabled={!canMoveToEnd}>
              <span className="w-4 h-4 mr-2" />{t("tabBar.moveToEnd", "Move to End")}
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
        </div>
      </div>
    );
  }

  // Regular tab
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
    >
      {/* Wrapper for entrance animation - keeps dnd-kit transform separate */}
      <div
        className={cn(
          isAnimating && "opacity-0 translate-x-5 scale-[0.8]",
          !isAnimating && "opacity-100",
          isNew && "transition-[opacity,transform] duration-300 ease-out"
        )}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <button
            onClick={handleClick}
            onMouseDown={handleMiddleClick}
            className={cn(
              "group relative h-7 flex max-w-[180px] items-center gap-1.5 rounded-md px-2",
              "text-muted-foreground transition-all duration-200",
              "hover:bg-accent hover:text-accent-foreground",
              "cursor-grab active:cursor-grabbing",
              isActive && [
                "bg-background text-foreground",
                "shadow-sm ring-1 ring-border/50",
              ],
              dragging && "opacity-40 z-50"
            )}
          >
            {/* Icon or drag handle based on hover state */}
            {isHovered || dragging ? (
              <GripVertical className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
            ) : (
              <IconDisplay
                icon={iconData}
                size="sm"
                className={cn(
                  "shrink-0 transition-colors",
                  isActive && "text-primary"
                )}
              />
            )}
            <span className="min-w-0 flex-1 truncate text-[13px]">
              {tab.titleKey ? t(tab.titleKey, tab.label) : tab.label}
            </span>

            {/* Close button - use span with role="button" to avoid nested button error */}
            {canClose && (
              <span
                role="button"
                tabIndex={0}
                onClick={handleCloseClick}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleCloseClick(e as unknown as MouseEvent);
                  }
                }}
                className={cn(
                  "absolute right-1 top-1/2 z-10 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded",
                  "bg-gradient-to-l from-accent from-70% to-transparent",
                  "opacity-0 group-hover:opacity-100 transition-opacity",
                  "hover:bg-foreground/10 cursor-pointer"
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
        <ContextMenuContent className="w-56">
          {canClose && (
            <>
              <ContextMenuItem onClick={onClose}>
                <X className="h-4 w-4 mr-2" />
                {t("common.close")}
              </ContextMenuItem>
              <ContextMenuItem onClick={onCloseOthers}>
                <span className="w-4 h-4 mr-2" />{t("tabBar.closeOthers", "Close Others")}
              </ContextMenuItem>
              <ContextMenuItem onClick={onCloseRight}>
                <span className="w-4 h-4 mr-2" />{t("tabBar.closeToRight", "Close Tabs to the Right")}
              </ContextMenuItem>
              <ContextMenuSeparator />
            </>
          )}
          <ContextMenuItem onClick={onReopenClosed} disabled={!canReopenClosed}>
            <span className="w-4 h-4 mr-2" />{t("tabBar.reopenClosedTab", "Reopen Closed Tab")}
          </ContextMenuItem>
          <ContextMenuItem onClick={onDuplicate}>
            <span className="w-4 h-4 mr-2" />{t("tabBar.duplicateTab", "Duplicate Tab")}
          </ContextMenuItem>
          <ContextMenuItem onClick={onDetach}>
            <ExternalLink className="h-4 w-4 mr-2" />
            {t("tabBar.detachToNewWindow", "Detach to New Window")}
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={onPin}>
            <Pin className="h-4 w-4 mr-2" />
            {t("tabBar.pinTab", "Pin Tab")}
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={onCopyLink}>
            <span className="w-4 h-4 mr-2" />{t("tabBar.copyLink", "Copy Link")}
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={onMoveToStart} disabled={!canMoveToStart}>
            <span className="w-4 h-4 mr-2" />{t("tabBar.moveToStart", "Move to Start")}
          </ContextMenuItem>
          <ContextMenuItem onClick={onMoveToEnd} disabled={!canMoveToEnd}>
            <span className="w-4 h-4 mr-2" />{t("tabBar.moveToEnd", "Move to End")}
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
      </div>
    </div>
  );
});
