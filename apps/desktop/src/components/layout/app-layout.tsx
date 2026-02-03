import { useEffect, useRef } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./sidebar";
import { usePython } from "@/hooks/use-python";
import { useAppStore } from "@/stores";

export function AppLayout() {
  const { selectedPython, browseMcpInfo } = usePython();
  const { setupStatus, setSetupStatus } = useAppStore();
  const hasInitialized = useRef(false);

  // Setup status detection - runs ONLY ONCE at app startup
  // After that, only Settings page "Detect" button can trigger update
  useEffect(() => {
    // Skip if already initialized
    if (hasInitialized.current) return;

    // Skip if no cached status exists but data hasn't loaded yet
    // This prevents setting status before data is ready
    if (selectedPython === null || browseMcpInfo === undefined) return;

    // Only initialize if no cached status exists
    // If user already has cached status from previous session, respect it
    if (setupStatus === null) {
      const isSetupComplete = (selectedPython?.is_valid === true) && (browseMcpInfo?.installed === true);
      setSetupStatus(isSetupComplete);
    }

    hasInitialized.current = true;
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
