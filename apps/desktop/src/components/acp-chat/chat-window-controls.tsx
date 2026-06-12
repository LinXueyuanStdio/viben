// apps/desktop/src/components/acp-chat/chat-window-controls.tsx

/**
 * Chat Window Controls Component
 *
 * Window controls (minimize, maximize, close) for the standalone chat window.
 * Only renders on Windows and Linux - macOS uses native traffic lights via
 * titleBarStyle: "Overlay" in tauri.conf.json.
 */

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { platform } from "@tauri-apps/plugin-os";
import { X, Minus, Square, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

export function ChatWindowControls() {
  const { t } = useTranslation();
  const [isMaximized, setIsMaximized] = useState(false);
  const [currentPlatform, setCurrentPlatform] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    let unlisten: (() => void) | null = null;

    const init = async () => {
      if (!mounted) return;

      const platformName = platform();
      setCurrentPlatform(platformName);

      // Only initialize for Windows and Linux
      if (platformName === "windows" || platformName === "linux") {
        try {
          const win = getCurrentWindow();
          const maximized = await win.isMaximized();
          if (mounted) setIsMaximized(maximized);

          unlisten = await win.onResized(async () => {
            if (mounted) {
              const isMax = await win.isMaximized();
              setIsMaximized(isMax);
            }
          });
        } catch (error) {
          console.debug("[ChatWindowControls] Tauri APIs not available:", error);
        }
      }
    };

    init();

    return () => {
      mounted = false;
      if (unlisten) unlisten();
    };
  }, []);

  const handleMinimize = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      await getCurrentWindow().minimize();
    } catch (err) {
      console.error("[ChatWindowControls] minimize failed:", err);
    }
  };

  const handleMaximize = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      await getCurrentWindow().toggleMaximize();
    } catch (err) {
      console.error("[ChatWindowControls] toggleMaximize failed:", err);
    }
  };

  const handleClose = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      await getCurrentWindow().hide();
    } catch (err) {
      console.error("[ChatWindowControls] close failed:", err);
    }
  };

  // Only render on Windows and Linux
  // macOS uses native traffic lights via titleBarStyle: "Overlay"
  if (currentPlatform !== "windows" && currentPlatform !== "linux") {
    return null;
  }

  // Windows/Linux style controls
  return (
    <div className="flex items-center">
      <button
        onClick={handleMinimize}
        className={cn(
          "flex h-8 w-10 items-center justify-center",
          "text-muted-foreground hover:bg-foreground/10 hover:text-foreground",
          "transition-colors"
        )}
        aria-label={t("windowControls.minimize")}
      >
        <Minus className="size-4" />
      </button>
      <button
        onClick={handleMaximize}
        className={cn(
          "flex h-8 w-10 items-center justify-center",
          "text-muted-foreground hover:bg-foreground/10 hover:text-foreground",
          "transition-colors"
        )}
        aria-label={t(isMaximized ? "windowControls.restore" : "windowControls.maximize")}
      >
        {isMaximized ? <Copy className="size-3.5" /> : <Square className="size-3.5" />}
      </button>
      <button
        onClick={handleClose}
        className={cn(
          "flex h-8 w-10 items-center justify-center",
          "text-muted-foreground hover:bg-[#c42b1c] hover:text-white",
          "transition-colors"
        )}
        aria-label={t("windowControls.close")}
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
