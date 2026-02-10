import { useEffect } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./sidebar";
import { usePython } from "@/hooks/use-python";
import { useTrayStatusSync } from "@/hooks/use-tray-status";
import { useMainWindowStoreSync } from "@/hooks/use-store-sync";
import { useChannelNotifications } from "@/hooks/use-channel-notifications";
import { useCronNotificationAdapter } from "@/hooks/use-cron-notification-adapter";
import { useAppStore } from "@/stores";

export function AppLayout() {
  const { selectedPython, browseMcpInfo } = usePython();
  const { setupStatus, setSetupStatus } = useAppStore();

  // Initialize tray status synchronization
  useTrayStatusSync();

  // Initialize store synchronization across windows
  useMainWindowStoreSync();

  // Initialize channel notifications WebSocket connection
  // This maintains a persistent connection to receive notifications from
  // external channels (Telegram, Discord, etc.)
  useChannelNotifications();

  // Initialize cron job notification adapter
  // This listens for cron job completion events and displays notifications
  useCronNotificationAdapter();

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
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-auto bg-background theme-transition">
        {/* Page transition animation removed - causes blank screen during navigation */}
        <Outlet />
      </main>
    </div>
  );
}
