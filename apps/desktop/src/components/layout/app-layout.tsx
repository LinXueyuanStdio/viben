import { useEffect } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./sidebar";
import { usePython } from "@/hooks/use-python";
import { useAppStore } from "@/stores";

export function AppLayout() {
  const { selectedPython, browseMcpInfo } = usePython();
  const { setSetupStatus } = useAppStore();

  // Centralized setup status calculation - runs once at app level
  // All child components should read from setupStatus in the store
  useEffect(() => {
    if (selectedPython !== null && browseMcpInfo !== undefined) {
      const isSetupComplete = selectedPython?.is_valid && browseMcpInfo?.installed;
      setSetupStatus(isSetupComplete);
    }
  }, [selectedPython, browseMcpInfo, setSetupStatus]);

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
