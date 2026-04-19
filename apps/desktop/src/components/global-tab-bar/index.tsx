// apps/desktop/src/components/global-tab-bar/index.tsx

/**
 * Global Tab Bar Component
 *
 * Browser-like tab bar for the desktop app:
 * - Navigation buttons (back/forward)
 * - Tab items (pinned and regular)
 * - Window controls (Windows only)
 * - macOS traffic light space accommodation
 */

import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
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
import { TabItem } from "./tab-item";
import { WindowControls } from "./window-controls";

export interface GlobalTabBarProps {
  className?: string;
}

export function GlobalTabBar({ className }: GlobalTabBarProps) {
  const [isMacOS, setIsMacOS] = useState(false);

  // Detect platform for macOS traffic light spacing
  useEffect(() => {
    const detectPlatform = async () => {
      try {
        const { platform } = await import("@tauri-apps/plugin-os");
        setIsMacOS(platform() === "macos");
      } catch {
        // In web dev mode, default to non-macOS
        setIsMacOS(false);
      }
    };
    detectPlatform();
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
    // Create a new empty tab that navigates to workspace home or a blank page
    openTab(
      {
        type: "new-tab",
        name: "New Tab",
        icon: "plus",
        pinned: false,
      },
      "/" // Navigate to home
    );
  }, [openTab]);

  // Separate pinned and unpinned tabs
  const pinnedTabs = tabs.filter((t) => t.pinned);
  const unpinnedTabs = tabs.filter((t) => !t.pinned);

  return (
    <TooltipProvider delayDuration={300}>
      <div
        className={cn(
          "flex items-center border-b bg-muted/30",
          // Height: macOS uses 32px to match system titlebar, Windows/Linux uses 40px
          isMacOS ? "h-8" : "h-10",
          // Drag region for window - allow window dragging on empty space
          "app-region-drag",
          className
        )}
      >
        {/* Left side: macOS traffic light space + Navigation buttons */}
        <div
          className={cn(
            "flex items-center gap-1 px-2 shrink-0",
            // Leave space for macOS traffic lights
            isMacOS && "pl-20"
          )}
        >
          {/* Back button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn("app-region-no-drag", isMacOS ? "h-6 w-6" : "h-7 w-7")}
                onClick={goBackInTab}
                disabled={!canGoBack}
              >
                <ChevronLeft className={cn(isMacOS ? "h-3.5 w-3.5" : "h-4 w-4")} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              Go Back
            </TooltipContent>
          </Tooltip>

          {/* Forward button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn("app-region-no-drag", isMacOS ? "h-6 w-6" : "h-7 w-7")}
                onClick={goForwardInTab}
                disabled={!canGoForward}
              >
                <ChevronRight className={cn(isMacOS ? "h-3.5 w-3.5" : "h-4 w-4")} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              Go Forward
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Separator between nav and tabs */}
        {tabs.length > 0 && (
          <div className="h-5 w-px bg-border/50 mx-1 shrink-0" />
        )}

        {/* Tabs + New Tab button (inline, not fixed right) */}
        <div className="flex items-center gap-1 px-1 overflow-x-auto scrollbar-none app-region-no-drag">
          {/* Pinned tabs first */}
          {pinnedTabs.map((tab) => (
            <TabItem
              key={tab.id}
              tab={tab}
              isActive={tab.id === activeTabId}
              isOnlyTab={tabs.length === 1}
              onSelect={() => switchToTab(tab.id)}
              onClose={() => closeTab(tab.id)}
              onPin={() => handlePinTab(tab.id)}
              onUnpin={() => handleUnpinTab(tab.id)}
              onCloseOthers={() => handleCloseOthers(tab.id)}
            />
          ))}

          {/* Separator between pinned and unpinned */}
          {pinnedTabs.length > 0 && unpinnedTabs.length > 0 && (
            <div className="h-5 w-px bg-border/50 mx-1 shrink-0" />
          )}

          {/* Unpinned tabs */}
          {unpinnedTabs.map((tab) => (
            <TabItem
              key={tab.id}
              tab={tab}
              isActive={tab.id === activeTabId}
              isOnlyTab={tabs.length === 1}
              onSelect={() => switchToTab(tab.id)}
              onClose={() => closeTab(tab.id)}
              onPin={() => handlePinTab(tab.id)}
              onUnpin={() => handleUnpinTab(tab.id)}
              onCloseOthers={() => handleCloseOthers(tab.id)}
            />
          ))}

          {/* New Tab button - inline after tabs */}
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
              New Tab
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Spacer to push window controls to right */}
        <div className="flex-1 app-region-drag" />

        {/* Right side: Window Controls only */}
        <div className="flex items-center shrink-0 app-region-no-drag">
          {/* Window Controls - only renders on Windows */}
          <WindowControls />
        </div>
      </div>
    </TooltipProvider>
  );
}

// Re-export sub-components for flexibility
export { TabItem } from "./tab-item";
export { WindowControls } from "./window-controls";
