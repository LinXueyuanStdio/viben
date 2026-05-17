import { Outlet } from "react-router-dom";
import { Sidebar } from "./sidebar";
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
  TabRouterBridge,
} from "@/components/navigation";

export function AppLayout() {
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

  return (
    <NavigationShellProvider>
      <div className="flex h-screen flex-col">
        <TabRouterBridge />
        {/* Global Tab Bar at top */}
        <GlobalTabBar />

        {/* Rest of the existing layout */}
        <div className="relative flex flex-1 overflow-hidden">
          <Sidebar />
          <div className="flex min-w-0 flex-1 flex-col bg-background theme-transition">
            <GlobalBreadcrumbShell />
            <main className="min-h-0 flex-1 overflow-auto">
              <Outlet />
            </main>
          </div>
        </div>
      </div>
    </NavigationShellProvider>
  );
}
