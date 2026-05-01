// apps/desktop/src/components/global-tab-bar/index.tsx

/**
 * Global Tab Bar Component
 *
 * Browser-like tab bar for the desktop app:
 * - Navigation buttons (back/forward)
 * - Tab items (pinned and regular) with drag-and-drop reordering
 * - Window controls (Windows only)
 * - macOS traffic light space accommodation
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { usePageTabs } from "@/hooks/use-page-tabs";
import { useTabStore } from "@/stores/tab-store";
import { SortableTabItem } from "./sortable-tab-item";
import { WindowControls } from "./window-controls";

export interface GlobalTabBarProps {
  className?: string;
}

export function GlobalTabBar({ className }: GlobalTabBarProps) {
  const { t } = useTranslation();
  const [isMacOS, setIsMacOS] = useState(false);
  const [shouldReserveMacOSControlsSpace, setShouldReserveMacOSControlsSpace] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [newTabIds, setNewTabIds] = useState<Set<string>>(new Set());
  const prevTabIdsRef = useRef<string[]>([]);

  // Detect platform for macOS traffic light spacing
  useEffect(() => {
    let mounted = true;
    let unlisten: (() => void) | null = null;

    const detectPlatform = async () => {
      try {
        const [{ platform }, { getCurrentWindow }] = await Promise.all([
          import("@tauri-apps/plugin-os"),
          import("@tauri-apps/api/window"),
        ]);

        if (!mounted) return;

        const isMac = platform() === "macos";
        setIsMacOS(isMac);

        const appWindow = getCurrentWindow();

        if (!isMac) {
          setShouldReserveMacOSControlsSpace(false);
          return;
        }

        const updateWindowState = async () => {
          const isFullscreen = await appWindow.isFullscreen();

          if (mounted) {
            // Keep leading space while macOS traffic lights remain visible.
            // Only reclaim the space in native fullscreen, where the controls
            // are no longer occupying the leading edge of the title bar.
            setShouldReserveMacOSControlsSpace(!isFullscreen);
          }
        };

        await updateWindowState();
        unlisten = await appWindow.onResized(() => {
          void updateWindowState();
        });
      } catch {
        // In web dev mode, default to non-macOS
        setIsMacOS(false);
        setShouldReserveMacOSControlsSpace(false);
      }
    };
    detectPlatform();

    return () => {
      mounted = false;
      if (unlisten) {
        unlisten();
      }
    };
  }, []);

  // Get tab data from hooks
  const {
    tabs,
    activeTabId,
    goBackInTab,
    goForwardInTab,
    canGoBack,
    canGoForward,
    switchToTab,
    closeTab,
  } = usePageTabs();

  // Get additional store actions
  const pinTab = useTabStore((state) => state.pinTab);
  const unpinTab = useTabStore((state) => state.unpinTab);
  const closeOtherTabs = useTabStore((state) => state.closeOtherTabs);
  const moveTab = useTabStore((state) => state.moveTab);

  // Track newly added tabs for entrance animation
  useEffect(() => {
    const currentTabIds = tabs.map((t) => t.id);
    const prevTabIds = prevTabIdsRef.current;

    // Find new tabs (ids that exist now but didn't exist before)
    const addedIds = currentTabIds.filter((id) => !prevTabIds.includes(id));

    if (addedIds.length > 0) {
      setNewTabIds((prev) => {
        const next = new Set(prev);
        addedIds.forEach((id) => next.add(id));
        return next;
      });

      // Remove from new tabs after animation completes
      const timer = setTimeout(() => {
        setNewTabIds((prev) => {
          const next = new Set(prev);
          addedIds.forEach((id) => next.delete(id));
          return next;
        });
      }, 350);

      return () => clearTimeout(timer);
    }

    prevTabIdsRef.current = currentTabIds;
  }, [tabs]);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // 5px movement before drag starts
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // DnD handlers
  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);

      if (over && active.id !== over.id) {
        const oldIndex = tabs.findIndex((t) => t.id === active.id);
        const newIndex = tabs.findIndex((t) => t.id === over.id);
        if (oldIndex !== -1 && newIndex !== -1) {
          moveTab(oldIndex, newIndex);
        }
      }
    },
    [tabs, moveTab]
  );

  // Handlers for tab actions
  const handlePinTab = useCallback(
    (tabId: string) => {
      pinTab(tabId);
    },
    [pinTab]
  );

  const handleUnpinTab = useCallback(
    (tabId: string) => {
      unpinTab(tabId);
    },
    [unpinTab]
  );

  const handleCloseOthers = useCallback(
    (tabId: string) => {
      closeOtherTabs(tabId);
    },
    [closeOtherTabs]
  );

  // Get openTab action for creating new tabs
  const openTab = useTabStore((state) => state.openTab);

  // Handle new tab creation
  const handleNewTab = useCallback(() => {
    openTab(
      {
        type: "new-tab",
        name: t("common.newTab", "New Tab"),
        icon: { type: "lucide", value: "plus" },
        pinned: false,
      },
      "/documents"
    );
  }, [openTab, t]);


  // Tab IDs for sortable context
  const tabIds = tabs.map((t) => t.id);

  return (
    <TooltipProvider delayDuration={300}>
      <div
        data-tauri-drag-region
        className={cn(
          "flex items-center border-b bg-muted/30",
          isMacOS ? "h-8" : "h-10",
          className
        )}
      >
        {/* Left side: macOS traffic light space + Navigation buttons */}
        <div
          data-tauri-drag-region
          className={cn(
            "flex items-center gap-1 px-2 shrink-0",
            shouldReserveMacOSControlsSpace && "pl-20"
          )}
        >
          {/* Back button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(isMacOS ? "h-6 w-6" : "h-7 w-7")}
                onClick={goBackInTab}
                disabled={!canGoBack}
              >
                <ChevronLeft className={cn(isMacOS ? "h-3.5 w-3.5" : "h-4 w-4")} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              {t("common.back", "Go Back")}
            </TooltipContent>
          </Tooltip>

          {/* Forward button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(isMacOS ? "h-6 w-6" : "h-7 w-7")}
                onClick={goForwardInTab}
                disabled={!canGoForward}
              >
                <ChevronRight className={cn(isMacOS ? "h-3.5 w-3.5" : "h-4 w-4")} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              {t("common.forward", "Go Forward")}
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Separator between nav and tabs */}
        {tabs.length > 0 && (
          <div className="h-5 w-px bg-border/50 mx-1 shrink-0" />
        )}

        {/* Tabs with drag-and-drop */}
        <div className="flex items-center gap-1 px-1 overflow-x-auto scrollbar-none">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={tabIds} strategy={horizontalListSortingStrategy}>
              {tabs.map((tab) => (
                <SortableTabItem
                  key={tab.id}
                  tab={tab}
                  isActive={tab.id === activeTabId}
                  isOnlyTab={tabs.length === 1}
                  isDragging={activeId === tab.id}
                  isNew={newTabIds.has(tab.id)}
                  onSelect={() => switchToTab(tab.id)}
                  onClose={() => closeTab(tab.id)}
                  onPin={() => handlePinTab(tab.id)}
                  onUnpin={() => handleUnpinTab(tab.id)}
                  onCloseOthers={() => handleCloseOthers(tab.id)}
                />
              ))}
            </SortableContext>
          </DndContext>

          {/* New Tab button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={handleNewTab}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              {t("common.newTab", "New Tab")}
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Spacer: drag region for window dragging + double-click to maximize */}
        <div
          data-tauri-drag-region
          className="flex-1 self-stretch"
        />

        {/* Right side: Window Controls only */}
        <div className="flex items-center shrink-0">
          <WindowControls />
        </div>
      </div>
    </TooltipProvider>
  );
}

// Re-export sub-components for flexibility
export { SortableTabItem as TabItem } from "./sortable-tab-item";
export { WindowControls } from "./window-controls";
