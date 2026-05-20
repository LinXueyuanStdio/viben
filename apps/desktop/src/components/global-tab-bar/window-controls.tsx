// apps/desktop/src/components/global-tab-bar/window-controls.tsx

/**
 * Window Controls Component
 *
 * Windows-style window controls (minimize, maximize, close).
 * Only renders on Windows platform.
 */

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Minus, Square, Copy, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function WindowControls() {
  const { t } = useTranslation();
  const [currentPlatform, setCurrentPlatform] = useState<string | null>(null);
  const [isMaximized, setIsMaximized] = useState(false);

  // Initialize platform detection and maximized state listener
  useEffect(() => {
    let mounted = true;
    let unlisten: (() => void) | null = null;

    const init = async () => {
      try {
        const [{ platform }, { getCurrentWindow }] = await Promise.all([
          import("@tauri-apps/plugin-os"),
          import("@tauri-apps/api/window"),
        ]);

        if (!mounted) return;

        const platformName = platform();
        setCurrentPlatform(platformName);

        if (platformName === "windows") {
          const win = getCurrentWindow();

          const maximized = await win.isMaximized();
          if (mounted) setIsMaximized(maximized);

          unlisten = await win.onResized(async () => {
            if (mounted) {
              const isMax = await win.isMaximized();
              setIsMaximized(isMax);
            }
          });
        }
      } catch (error) {
        console.debug("[WindowControls] Tauri APIs not available:", error);
      }
    };

    init();

    return () => {
      mounted = false;
      if (unlisten) unlisten();
    };
  }, []);

  const handleMinimize = async () => {
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      await getCurrentWindow().minimize();
    } catch (e) {
      console.error("[WindowControls] minimize failed:", e);
    }
  };

  const handleMaximize = async () => {
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      await getCurrentWindow().toggleMaximize();
    } catch (e) {
      console.error("[WindowControls] toggleMaximize failed:", e);
    }
  };

  const handleClose = async () => {
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      await getCurrentWindow().close();
    } catch (e) {
      console.error("[WindowControls] close failed:", e);
    }
  };

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
