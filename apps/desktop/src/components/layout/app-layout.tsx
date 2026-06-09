import { Outlet } from "react-router-dom";
import { useEffect } from "react";
import { Sidebar } from "./sidebar";
import { DraggableChatWrapper } from "./draggable-chat-wrapper";
import { GlobalTabBar } from "@/components/global-tab-bar";
import { useTrayStatusSync } from "@/hooks/use-tray-status";
import { useMainWindowStoreSync } from "@/hooks/use-store-sync";
import { useChannelNotifications } from "@/hooks/use-channel-notifications";
import { useCronNotificationAdapter } from "@/hooks/use-cron-notification-adapter";
import { useMcpStatusWebSocket } from "@/hooks/use-mcp-status-monitor";
import { useGlobalShortcuts } from "@/hooks/use-global-shortcuts";
import { useVoiceConfigInit } from "@/hooks/use-voice-config-init";
import { useDesktopDeepLink } from "@/hooks/use-desktop-deep-link";
import {
  GlobalBreadcrumbShell,
  NavigationShellProvider,
} from "@/components/navigation/navigation-shell";
import { ActionNavigationHandlerProvider } from "@/components/action-system";
import { TabRouterBridge } from "@/components/navigation/tab-router-bridge";
import { installTabStoreStorageSync } from "@/stores/tab-store";
import { AcpChat } from "@/components/acp-chat";
import { useChatModeStore } from "@/stores/chat-mode-store";

export function AppLayout() {
  useEffect(() => installTabStoreStorageSync(), []);

  // Initialize global keyboard shortcuts (Ctrl+Shift+J for create task, etc.)
  useGlobalShortcuts();

  // Initialize tray status synchronization
  useTrayStatusSync();

  // Initialize store synchronization across windows
  useMainWindowStoreSync();

  // Initialize MCP status WebSocket connection (singleton - only one connection for the entire app)
  useMcpStatusWebSocket();

  // Initialize channel notifications WebSocket connection
  useChannelNotifications();

  // Initialize cron job notification adapter
  useCronNotificationAdapter();

  // Load voice configuration from disk so sidebar can display wake word
  useVoiceConfigInit();

  // Initialize desktop deep link listener
  useDesktopDeepLink();

  // Chat mode state
  const { mode: chatMode, setMode: setChatMode } = useChatModeStore();
  const isChatFull = chatMode === "full";
  const isChatFloating = chatMode === "floating" || chatMode === "compact" || chatMode === "expanded";

  // Resizable chat panel
  const { width: chatWidth, handleProps } = useResizablePanel({
    minWidth: 320,
    maxWidth: 800,
    defaultWidth: 420,
    direction: "right",
  });

  return (
    <NavigationShellProvider>
      <div className="flex h-screen flex-col">
        <TabRouterBridge />
        <ActionNavigationHandlerProvider />
        {/* Global Tab Bar at top */}
        <GlobalTabBar />

        {/* Main layout: [sidebar][ChatApp?][pages] */}
        <div className="relative flex flex-1 overflow-hidden">
          <Sidebar />

          {/* ChatApp in full mode: occupies independent column between sidebar and pages */}
          {isChatFull && (
            <div
              className="relative flex h-full shrink-0 flex-col bg-background"
              style={{ width: chatWidth }}
            >
              <AcpChat
                mode={chatMode}
                onModeChange={setChatMode}
                contained
                className="h-full"
              />
              {/* Resize handle on right edge - hidden until hover */}
              <div
                className="group absolute -right-1 top-0 z-30 flex h-full w-2 cursor-col-resize items-center justify-center"
                {...handleProps}
              >
                <div className="h-8 w-1 rounded-full bg-border opacity-0 transition-opacity group-hover:opacity-100 group-active:opacity-100 group-active:bg-primary" />
              </div>
            </div>
          )}

          {/* Pages area */}
          <div className="relative flex min-w-0 flex-1 flex-col bg-background theme-transition">
            <GlobalBreadcrumbShell />
            <main className="relative min-h-0 flex-1 overflow-auto">
              <Outlet />
            </main>

            {/* ChatApp in floating/compact/expanded mode: draggable and snaps to edges */}
            {isChatFloating && (
              <DraggableChatWrapper enabled margin={20}>
                <AcpChat
                  mode={chatMode}
                  onModeChange={setChatMode}
                />
              </DraggableChatWrapper>
            )}
          </div>
        </div>
      </div>
    </NavigationShellProvider>
  );
}
