// apps/desktop/src/components/global-tab-bar/window-controls.tsx

/**
 * Window Controls Component
 *
 * Windows 11 style window controls (minimize, maximize, close).
 * Renders on Windows and Linux platforms.
 */

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { MinimizeIcon, MaximizeIcon, RestoreIcon, CloseIcon } from "./window-control-icons";

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

        // Initialize for Windows and Linux
        if (platformName === "windows" || platformName === "linux") {
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

  // Only render on Windows and Linux
  if (currentPlatform !== "windows" && currentPlatform !== "linux") {
    return null;
  }

  // Common button styles - Windows 11 proportions
  const buttonBase = cn(
    "h-10 w-[46px] flex items-center justify-center",
    "transition-colors duration-100"
  );

  // Minimize/Maximize button styles
  const standardButtonStyles = cn(
    buttonBase,
    "hover:bg-foreground/10 active:bg-foreground/15"
  );

  // Close button styles - Windows 11 red
  const closeButtonStyles = cn(
    buttonBase,
    "hover:bg-[#c42b1c] hover:text-white",
    "active:bg-[#b4271a] active:text-white"
  );

  return (
    <div className="flex items-center">
      {/* Minimize */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={handleMinimize}
            className={standardButtonStyles}
            aria-label={t("windowControls.minimize", "Minimize")}
          >
            <MinimizeIcon size={10} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={4} className="text-xs">
          {t("windowControls.minimize", "Minimize")}
        </TooltipContent>
      </Tooltip>

      {/* Maximize/Restore */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={handleMaximize}
            className={standardButtonStyles}
            aria-label={
              isMaximized
                ? t("windowControls.restore", "Restore")
                : t("windowControls.maximize", "Maximize")
            }
          >
            {isMaximized ? <RestoreIcon size={10} /> : <MaximizeIcon size={10} />}
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={4} className="text-xs">
          {isMaximized
            ? t("windowControls.restore", "Restore")
            : t("windowControls.maximize", "Maximize")}
        </TooltipContent>
      </Tooltip>

      {/* Close */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={handleClose}
            className={closeButtonStyles}
            aria-label={t("windowControls.close", "Close")}
          >
            <CloseIcon size={10} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={4} className="text-xs">
          {t("windowControls.close", "Close")}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
