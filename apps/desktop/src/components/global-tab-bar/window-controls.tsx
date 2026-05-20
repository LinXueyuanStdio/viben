// apps/desktop/src/components/global-tab-bar/window-controls.tsx

/**
 * Window Controls Component
 *
 * Windows-style window controls (minimize, maximize, close).
 * Only renders on Windows platform.
 */

import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Minus, Square, Copy, X } from "lucide-react";
import { cn } from "@/lib/utils";

// Types for Tauri APIs - these will be dynamically imported
type TauriWindow = {
  minimize: () => Promise<void>;
  toggleMaximize: () => Promise<void>;
  close: () => Promise<void>;
  isMaximized: () => Promise<boolean>;
  onResized: (handler: () => void) => Promise<() => void>;
};

export function WindowControls() {
  const { t } = useTranslation();
  const [currentPlatform, setCurrentPlatform] = useState<string | null>(null);
  const [isMaximized, setIsMaximized] = useState(false);
  const [appWindow, setAppWindow] = useState<TauriWindow | null>(null);

  // Initialize platform detection and window reference
  useEffect(() => {
    let mounted = true;
    let unlisten: (() => void) | null = null;

    const init = async () => {
      try {
        // Dynamically import Tauri APIs to handle web dev mode gracefully
        const [{ platform }, { getCurrentWindow }] = await Promise.all([
          import("@tauri-apps/plugin-os"),
          import("@tauri-apps/api/window"),
        ]);

        if (!mounted) return;

        const platformName = platform();
        setCurrentPlatform(platformName);

        // Only set up window controls for Windows
        if (platformName === "windows") {
          const window = getCurrentWindow();
          setAppWindow(window as unknown as TauriWindow);

          // Check initial maximized state
          const maximized = await window.isMaximized();
          if (mounted) {
            setIsMaximized(maximized);
          }

          // Listen for resize events to update maximized state
          unlisten = await window.onResized(async () => {
            if (mounted) {
              const isMax = await window.isMaximized();
              setIsMaximized(isMax);
            }
          });
        }
      } catch (error) {
        // Silently fail in web dev mode
        console.debug("[WindowControls] Tauri APIs not available:", error);
      }
    };

    init();

    return () => {
      mounted = false;
      if (unlisten) {
        unlisten();
      }
    };
  }, []);

  const handleMinimize = useCallback(async () => {
    if (appWindow) {
      await appWindow.minimize();
    }
  }, [appWindow]);

  const handleMaximize = useCallback(async () => {
    if (appWindow) {
      await appWindow.toggleMaximize();
    }
  }, [appWindow]);

  const handleClose = useCallback(async () => {
    if (appWindow) {
      await appWindow.close();
    }
  }, [appWindow]);

  // Only render on Windows
  if (currentPlatform !== "windows") {
    return null;
  }

  return (
    <div className="flex items-center">
      {/* Minimize */}
      <button
        onClick={handleMinimize}
        className={cn(
          "h-9 w-11 flex items-center justify-center",
          "hover:bg-muted/80 transition-colors"
        )}
        aria-label={t("windowControls.minimize", "Minimize")}
      >
        <Minus className="h-4 w-4" />
      </button>

      {/* Maximize/Restore */}
      <button
        onClick={handleMaximize}
        className={cn(
          "h-9 w-11 flex items-center justify-center",
          "hover:bg-muted/80 transition-colors"
        )}
        aria-label={isMaximized ? t("windowControls.restore", "Restore") : t("windowControls.maximize", "Maximize")}
      >
        {isMaximized ? (
          <Copy className="h-3.5 w-3.5" />
        ) : (
          <Square className="h-3.5 w-3.5" />
        )}
      </button>

      {/* Close */}
      <button
        onClick={handleClose}
        className={cn(
          "h-9 w-11 flex items-center justify-center",
          "hover:bg-red-500 hover:text-white transition-colors"
        )}
        aria-label={t("windowControls.close", "Close")}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
