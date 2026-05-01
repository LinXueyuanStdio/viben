import { useEffect } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./sidebar";
import { GlobalTabBar } from "@/components/global-tab-bar";
import { usePython } from "@/hooks/use-python";
import { useTrayStatusSync } from "@/hooks/use-tray-status";
import { useMainWindowStoreSync } from "@/hooks/use-store-sync";
import { useChannelNotifications } from "@/hooks/use-channel-notifications";
import { useCronNotificationAdapter } from "@/hooks/use-cron-notification-adapter";
import { useMcpStatusWebSocket } from "@/hooks/use-mcp-status-monitor";
import { useGlobalShortcuts } from "@/hooks/use-global-shortcuts";
import { useVoiceConfigInit } from "@/hooks/use-voice-config-init";
import { useAppStore } from "@/stores";
import {
  GlobalBreadcrumbShell,
  NavigationShellProvider,
  TabRouterBridge,
} from "@/components/navigation";

export function AppLayout() {
  const { selectedPython, browseMcpInfo } = usePython();
  const { setupStatus, setSetupStatus } = useAppStore();

  // Initialize global keyboard shortcuts (Ctrl+Shift+J for create task, etc.)
  useGlobalShortcuts();

  // Initialize tray status synchronization
  useTrayStatusSync();

  // Initialize store synchronization across windows
  useMainWindowStoreSync();

  // Initialize MCP status WebSocket connection (singleton - only one connection for the entire app)
  useMcpStatusWebSocket();

  // Initialize channel notifications WebSocket connection
  // This maintains a persistent connection to receive notifications from
  // external channels (Telegram, Discord, etc.)
  useChannelNotifications();

  // Initialize cron job notification adapter
  // This listens for cron job completion events and displays notifications
  useCronNotificationAdapter();

  // Load voice configuration from disk so sidebar can display wake word
  useVoiceConfigInit();

  // Setup status detection - updates whenever browseMcpInfo changes
  // This ensures status is updated when user installs browse-mcp
  useEffect(() => {
    // Skip if data hasn't loaded yet
    if (selectedPython === null || browseMcpInfo === undefined) return;

    const isSetupComplete =
      selectedPython?.is_valid === true && browseMcpInfo?.installed === true;

    // Always update if the computed status differs from cached status
    // This handles the case where user installs browse-mcp while app is running
    if (setupStatus === null || setupStatus.isComplete !== isSetupComplete) {
      setSetupStatus(isSetupComplete);
    }
  }, [selectedPython, browseMcpInfo, setupStatus, setSetupStatus]);

  return (
    <NavigationShellProvider>
      <div className="flex h-screen flex-col">
        <TabRouterBridge />
        {/* Global Tab Bar at top */}
        <GlobalTabBar />

        {/* Rest of the existing layout */}
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />
          <div className="flex min-w-0 flex-1 flex-col bg-background theme-transition">
            <GlobalBreadcrumbShell />
            <main className="min-h-0 flex-1 overflow-auto">
              {/* Page transition animation removed - causes blank screen during navigation */}
              <Outlet />
            </main>
          </div>
        </div>
      </div>
    </NavigationShellProvider>
  );
}
