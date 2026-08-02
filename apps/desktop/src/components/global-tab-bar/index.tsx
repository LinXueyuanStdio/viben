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
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  PanelLeftClose,
  PanelLeft,
  Settings,
} from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { platform } from "@tauri-apps/plugin-os";
import { useUiStore } from "@/stores";
import { toast } from "@/hooks/use-toast";
import {
  DndContext,
  DragOverlay,
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
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { IconDisplay } from "@/components/ui/icon-picker";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { BrowserTabFrame } from "@/components/browser-tab-frame";
import { cn } from "@/lib/utils";
import {
  useTabList,
  useActiveTabState,
  useTabActions,
  useTabNavigation,
} from "@/hooks/use-page-tabs";
import { getCurrentWindowTabStore } from "@/stores/tab-store";
import { SortableTabItem } from "./sortable-tab-item";
import { WakeWordSegment } from "./wake-word-segment";
import { WindowControls } from "./window-controls";
import { createTabNavigationState } from "@/navigation/tab-navigation";
import { buildColdStartBreadcrumb } from "@/navigation/navigate";

export interface GlobalTabBarProps {
  className?: string;
}

export function GlobalTabBar({ className }: GlobalTabBarProps) {
  const { t } = useTranslation();
  const [isMacOS, setIsMacOS] = useState(false);
  const [shouldReserveMacOSControlsSpace, setShouldReserveMacOSControlsSpace] =
    useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [newTabIds, setNewTabIds] = useState<Set<string>>(new Set());
  const prevTabIdsRef = useRef<string[]>([]);
  const tabStore = useRef(getCurrentWindowTabStore()).current;

  // Detect platform for macOS traffic light spacing
  useEffect(() => {
    let mounted = true;
    let unlisten: (() => void) | null = null;

    const detectPlatform = async () => {
      try {
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

  // Get tab data from granular hooks
  const tabs = useTabList();
  const { activeTabId, canGoBack, canGoForward } = useActiveTabState();
  const { switchToTab, closeTab, detachTabToNewWindow, getTabLink } =
    useTabActions();
  const { goBackInTab, goForwardInTab, jumpToHistory } = useTabNavigation();

  // Get additional store actions
  const pinTab = tabStore((state) => state.pinTab);
  const unpinTab = tabStore((state) => state.unpinTab);
  const closeOtherTabs = tabStore((state) => state.closeOtherTabs);
  const closeTabsToRight = tabStore((state) => state.closeTabsToRight);
  const duplicateTab = tabStore((state) => state.duplicateTab);
  const reopenClosedTab = tabStore((state) => state.reopenClosedTab);
  const closeAllTabs = tabStore((state) => state.closeAllTabs);
  const moveTab = tabStore((state) => state.moveTab);
  const hasRecentlyClosedTabs = tabStore(
    (state) => state.recentlyClosedTabs.length > 0,
  );

  // Track newly added tabs for entrance animation
  useEffect(() => {
    const currentTabIds = tabs.map((t) => t.id);
    const prevTabIds = prevTabIdsRef.current;

    // Find new tabs (ids that exist now but didn't exist before)
    const addedIds = currentTabIds.filter((id) => !prevTabIds.includes(id));

    // Always update ref to prevent re-detecting the same tabs
    prevTabIdsRef.current = currentTabIds;

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
    }),
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
        // Read latest tabs from store to avoid stale closure
        const currentTabs = tabStore.getState().tabs;
        const oldIndex = currentTabs.findIndex((t) => t.id === active.id);
        const newIndex = currentTabs.findIndex((t) => t.id === over.id);
        if (oldIndex !== -1 && newIndex !== -1) {
          moveTab(oldIndex, newIndex);
        }
      }
    },
    [moveTab, tabStore],
  );

  // Handlers for tab actions
  const handlePinTab = useCallback(
    (tabId: string) => {
      pinTab(tabId);
    },
    [pinTab],
  );

  const handleUnpinTab = useCallback(
    (tabId: string) => {
      unpinTab(tabId);
    },
    [unpinTab],
  );

  const handleCloseOthers = useCallback(
    (tabId: string) => {
      closeOtherTabs(tabId);
    },
    [closeOtherTabs],
  );

  const handleCloseRight = useCallback(
    (tabId: string) => {
      closeTabsToRight(tabId);
    },
    [closeTabsToRight],
  );

  const handleDuplicateTab = useCallback(
    (tabId: string) => {
      duplicateTab(tabId);
    },
    [duplicateTab],
  );

  const handleMoveTabToStart = useCallback(
    (tabId: string) => {
      const fromIndex = tabs.findIndex((tab) => tab.id === tabId);
      if (fromIndex <= 0) return;
      moveTab(fromIndex, 0);
    },
    [moveTab, tabs],
  );

  const handleMoveTabToEnd = useCallback(
    (tabId: string) => {
      const fromIndex = tabs.findIndex((tab) => tab.id === tabId);
      if (fromIndex === -1 || fromIndex >= tabs.length - 1) return;
      moveTab(fromIndex, tabs.length - 1);
    },
    [moveTab, tabs],
  );

  const handleReopenClosedTab = useCallback(() => {
    reopenClosedTab();
  }, [reopenClosedTab]);

  const handleCloseAllTabs = useCallback(() => {
    closeAllTabs();
  }, [closeAllTabs]);

  const handleCopyTabLink = useCallback(
    async (tabId: string) => {
      const link = getTabLink(tabId);
      if (!link) return;

      try {
        await navigator.clipboard.writeText(link);
        toast.success(t("pageSection.linkCopied", "Link copied to clipboard"));
      } catch (error) {
        console.error("Failed to copy tab link:", error);
        toast.error(t("common.copyFailed", "Failed to copy"));
      }
    },
    [getTabLink, t],
  );

  const handleDetachTab = useCallback(
    async (tabId: string) => {
      try {
        const detached = await detachTabToNewWindow(tabId);
        if (!detached) {
          toast.error(
            t("tabBar.detachUnavailable", "This tab cannot be detached"),
          );
        }
      } catch (error) {
        console.error("Failed to detach tab:", error);
        toast.error(t("common.error"));
      }
    },
    [detachTabToNewWindow, t],
  );

  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? null;

  // Sidebar toggle from global UI store
  const { sidebarCollapsed, toggleSidebar } = useUiStore();

  // Build current page item for context display in history menus
  const currentPageItem = activeTab
    ? (() => {
        const currentState =
          activeTab.navigationHistory[activeTab.historyIndex];
        if (!currentState) return null;
        const leaf =
          currentState.breadcrumbStack[currentState.breadcrumbStack.length - 1];
        return {
          historyIndex: activeTab.historyIndex,
          label: leaf?.label ?? currentState.url,
          titleKey: leaf?.titleKey,
          icon: leaf?.icon,
        };
      })()
    : null;

  const backHistoryItems = activeTab
    ? activeTab.navigationHistory
        .slice(0, activeTab.historyIndex)
        .map((state, index) => {
          const leaf = state.breadcrumbStack[state.breadcrumbStack.length - 1];
          return {
            historyIndex: index,
            label: leaf?.label ?? state.url,
            titleKey: leaf?.titleKey,
            icon: leaf?.icon,
          };
        })
        .reverse()
        .slice(0, 10)
    : [];
  const forwardHistoryItems = activeTab
    ? activeTab.navigationHistory
        .slice(activeTab.historyIndex + 1)
        .map((state, offset) => {
          const leaf = state.breadcrumbStack[state.breadcrumbStack.length - 1];
          return {
            historyIndex: activeTab.historyIndex + offset + 1,
            label: leaf?.label ?? state.url,
            titleKey: leaf?.titleKey,
            icon: leaf?.icon,
          };
        })
        .slice(0, 10)
    : [];

  // Get openTab action for creating new tabs
  const openTab = tabStore((state) => state.openTab);

  // Handle new tab creation
  const handleNewTab = useCallback(() => {
    const url = "/workspace/global";
    openTab({
      navigationState: createTabNavigationState(
        url,
        buildColdStartBreadcrumb(url),
      ),
      pinned: false,
    });
  }, [openTab]);

  const handleOpenSettings = useCallback(() => {
    openTab({
      navigationState: createTabNavigationState(
        "/settings",
        buildColdStartBreadcrumb("/settings"),
      ),
      pinned: false,
    });
  }, [openTab]);

  // Tab IDs for sortable context
  const tabIds = tabs.map((t) => t.id);

  return (
    <BrowserTabFrame
      isMacOS={isMacOS}
      reserveMacOSControlsSpace={shouldReserveMacOSControlsSpace}
      className={className}
      leadingControls={
        <>
          {/* Sidebar toggle button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(isMacOS ? "h-6 w-6" : "h-7 w-7")}
                onClick={toggleSidebar}
              >
                {sidebarCollapsed ? (
                  <PanelLeft
                    className={cn(isMacOS ? "h-3.5 w-3.5" : "h-4 w-4")}
                  />
                ) : (
                  <PanelLeftClose
                    className={cn(isMacOS ? "h-3.5 w-3.5" : "h-4 w-4")}
                  />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              {sidebarCollapsed
                ? t("sidebar.expand", "Expand sidebar")
                : t("sidebar.collapse", "Collapse sidebar")}
            </TooltipContent>
          </Tooltip>

          {/* Back button */}
          <ContextMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <ContextMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(isMacOS ? "h-6 w-6" : "h-7 w-7")}
                    onClick={goBackInTab}
                    disabled={!canGoBack}
                  >
                    <ChevronLeft
                      className={cn(isMacOS ? "h-3.5 w-3.5" : "h-4 w-4")}
                    />
                  </Button>
                </ContextMenuTrigger>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                {t("common.back", "Go Back")}
              </TooltipContent>
            </Tooltip>
            <ContextMenuContent className="w-64">
              {backHistoryItems.length > 0 ? (
                <>
                  {backHistoryItems.map((item) => (
                    <ContextMenuItem
                      key={`back-${item.historyIndex}`}
                      onClick={() => jumpToHistory(item.historyIndex)}
                      className="gap-2"
                    >
                      {item.icon ? (
                        <IconDisplay
                          icon={item.icon}
                          size="sm"
                          className="shrink-0 text-muted-foreground"
                        />
                      ) : (
                        <span className="w-4 h-4 shrink-0" />
                      )}
                      <span className="truncate max-w-[220px]">
                        {item.titleKey
                          ? t(item.titleKey, item.label)
                          : item.label}
                      </span>
                    </ContextMenuItem>
                  ))}
                  {currentPageItem && (
                    <>
                      <ContextMenuSeparator />
                      <ContextMenuItem disabled className="gap-2 font-medium">
                        {currentPageItem.icon ? (
                          <IconDisplay
                            icon={currentPageItem.icon}
                            size="sm"
                            className="shrink-0 text-muted-foreground"
                          />
                        ) : (
                          <span className="w-4 h-4 shrink-0" />
                        )}
                        <span className="truncate max-w-[220px]">
                          {currentPageItem.titleKey
                            ? t(currentPageItem.titleKey, currentPageItem.label)
                            : currentPageItem.label}
                        </span>
                      </ContextMenuItem>
                    </>
                  )}
                </>
              ) : (
                <ContextMenuItem disabled>
                  {t("tabBar.noBackHistory", "No back history")}
                </ContextMenuItem>
              )}
            </ContextMenuContent>
          </ContextMenu>

          {/* Forward button */}
          <ContextMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <ContextMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(isMacOS ? "h-6 w-6" : "h-7 w-7")}
                    onClick={goForwardInTab}
                    disabled={!canGoForward}
                  >
                    <ChevronRight
                      className={cn(isMacOS ? "h-3.5 w-3.5" : "h-4 w-4")}
                    />
                  </Button>
                </ContextMenuTrigger>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                {t("common.forward", "Go Forward")}
              </TooltipContent>
            </Tooltip>
            <ContextMenuContent className="w-64">
              {forwardHistoryItems.length > 0 ? (
                <>
                  {currentPageItem && (
                    <>
                      <ContextMenuItem disabled className="gap-2 font-medium">
                        {currentPageItem.icon ? (
                          <IconDisplay
                            icon={currentPageItem.icon}
                            size="sm"
                            className="shrink-0 text-muted-foreground"
                          />
                        ) : (
                          <span className="w-4 h-4 shrink-0" />
                        )}
                        <span className="truncate max-w-[220px]">
                          {currentPageItem.titleKey
                            ? t(currentPageItem.titleKey, currentPageItem.label)
                            : currentPageItem.label}
                        </span>
                      </ContextMenuItem>
                      <ContextMenuSeparator />
                    </>
                  )}
                  {forwardHistoryItems.map((item) => (
                    <ContextMenuItem
                      key={`forward-${item.historyIndex}`}
                      onClick={() => jumpToHistory(item.historyIndex)}
                      className="gap-2"
                    >
                      {item.icon ? (
                        <IconDisplay
                          icon={item.icon}
                          size="sm"
                          className="shrink-0 text-muted-foreground"
                        />
                      ) : (
                        <span className="w-4 h-4 shrink-0" />
                      )}
                      <span className="truncate max-w-[220px]">
                        {item.titleKey
                          ? t(item.titleKey, item.label)
                          : item.label}
                      </span>
                    </ContextMenuItem>
                  ))}
                </>
              ) : (
                <ContextMenuItem disabled>
                  {t("tabBar.noForwardHistory", "No forward history")}
                </ContextMenuItem>
              )}
            </ContextMenuContent>
          </ContextMenu>
        </>
      }
      tabsLeading={
        tabs.length > 0 ? (
          <div className="mx-1 h-5 w-px shrink-0 bg-border/50" />
        ) : null
      }
      tabs={
        <>
          {/* Tabs with drag-and-drop */}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={() => setActiveId(null)}
          >
            <SortableContext
              items={tabIds}
              strategy={horizontalListSortingStrategy}
            >
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
                  onCloseRight={() => handleCloseRight(tab.id)}
                  onDuplicate={() => handleDuplicateTab(tab.id)}
                  onReopenClosed={handleReopenClosedTab}
                  onCopyLink={() => handleCopyTabLink(tab.id)}
                  onDetach={() => handleDetachTab(tab.id)}
                  onMoveToStart={() => handleMoveTabToStart(tab.id)}
                  onMoveToEnd={() => handleMoveTabToEnd(tab.id)}
                  canReopenClosed={hasRecentlyClosedTabs}
                  canMoveToStart={
                    tabs.findIndex((item) => item.id === tab.id) > 0
                  }
                  canMoveToEnd={
                    tabs.findIndex((item) => item.id === tab.id) <
                    tabs.length - 1
                  }
                />
              ))}
            </SortableContext>
            <DragOverlay dropAnimation={null}>
              {activeId
                ? (() => {
                    const dragTab = tabs.find((t) => t.id === activeId);
                    if (!dragTab) return null;
                    return (
                      <div className="flex max-w-[180px] items-center gap-1.5 rounded-md bg-background px-2 h-7 text-[13px] text-foreground shadow-lg ring-1 ring-border/50">
                        {dragTab.icon && (
                          <IconDisplay
                            icon={dragTab.icon}
                            size="sm"
                            className="shrink-0"
                          />
                        )}
                        {!dragTab.pinned && (
                          <span className="truncate">
                            {dragTab.titleKey
                              ? t(dragTab.titleKey, dragTab.label)
                              : dragTab.label}
                          </span>
                        )}
                      </div>
                    );
                  })()
                : null}
            </DragOverlay>
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
        </>
      }
      spacerMenu={
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <div data-tauri-drag-region className="h-full w-full" />
          </ContextMenuTrigger>
          <ContextMenuContent className="w-52">
            <ContextMenuItem onClick={handleNewTab}>
              {t("common.newTab", "New Tab")}
            </ContextMenuItem>
            <ContextMenuItem
              onClick={handleReopenClosedTab}
              disabled={!hasRecentlyClosedTabs}
            >
              {t("tabBar.reopenClosedTab", "Reopen Closed Tab")}
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem
              onClick={handleCloseAllTabs}
              disabled={tabs.every((tab) => tab.pinned)}
            >
              {t("tabBar.closeAllUnpinned", "Close All Unpinned Tabs")}
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      }
      rightControls={
        <>
          <WakeWordSegment isMacOS={isMacOS} />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(isMacOS ? "h-6 w-6" : "h-7 w-7")}
                onClick={handleOpenSettings}
              >
                <Settings className={cn(isMacOS ? "h-3.5 w-3.5" : "h-4 w-4")} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              {t("common.settings", "Settings")}
            </TooltipContent>
          </Tooltip>
        </>
      }
      windowControls={<WindowControls />}
    />
  );
}

// Re-export sub-components for flexibility
export { SortableTabItem as TabItem } from "./sortable-tab-item";
export { WindowControls } from "./window-controls";
