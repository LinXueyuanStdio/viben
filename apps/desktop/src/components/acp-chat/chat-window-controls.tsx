// apps/desktop/src/components/acp-chat/chat-window-controls.tsx

/**
 * Chat Window Controls Component
 *
 * Window controls (minimize, maximize, close) for the standalone chat window.
 * Always renders regardless of platform (unlike the standard WindowControls
 * which hides on macOS where native controls are used).
 */

import { useState, useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { platform } from "@tauri-apps/plugin-os";
import { X, Minus, Square, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

export function ChatWindowControls() {
  const [isMaximized, setIsMaximized] = useState(false);
  const [isMacOS, setIsMacOS] = useState(false);

  useEffect(() => {
    let mounted = true;
    let unlisten: (() => void) | null = null;

    const init = async () => {
      if (!mounted) return;

      const platformName = platform();
      setIsMacOS(platformName === "macos");

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

  // macOS style controls (traffic lights)
  if (isMacOS) {
    return (
      <div className="flex items-center gap-2 pr-2">
        <button
          onClick={handleClose}
          className={cn(
            "flex size-3 items-center justify-center rounded-full",
            "bg-[#ff5f57] hover:bg-[#ff5f57]/80",
            "transition-colors"
          )}
          aria-label="Close"
        >
          <X className="size-2 text-[#4d0000] opacity-0 hover:opacity-100" />
        </button>
        <button
          onClick={handleMinimize}
          className={cn(
            "flex size-3 items-center justify-center rounded-full",
            "bg-[#febc2e] hover:bg-[#febc2e]/80",
            "transition-colors"
          )}
          aria-label="Minimize"
        >
          <Minus className="size-2 text-[#995700] opacity-0 hover:opacity-100" />
        </button>
        <button
          onClick={handleMaximize}
          className={cn(
            "flex size-3 items-center justify-center rounded-full",
            "bg-[#28c840] hover:bg-[#28c840]/80",
            "transition-colors"
          )}
          aria-label={isMaximized ? "Restore" : "Maximize"}
        >
          {isMaximized ? (
            <Copy className="size-2 text-[#006500] opacity-0 hover:opacity-100" />
          ) : (
            <Square className="size-1.5 text-[#006500] opacity-0 hover:opacity-100" />
          )}
        </button>
      </div>
    );
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
        aria-label="Minimize"
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
        aria-label={isMaximized ? "Restore" : "Maximize"}
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
        aria-label="Close"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
