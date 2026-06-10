// apps/desktop/src/pages/chat-window/index.tsx
import { useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";
import { AcpChat } from "@/components/acp-chat";

export default function ChatWindowPage() {
  // Hide window on blur (click outside)
  useEffect(() => {
    let mounted = true;

    const setupBlurListener = async () => {
      const win = getCurrentWindow();

      // Listen for window blur event
      const unlisten = await win.onFocusChanged(({ payload: focused }) => {
        if (!focused && mounted) {
          win.hide();
        }
      });

      return unlisten;
    };

    const unlistenPromise = setupBlurListener();

    return () => {
      mounted = false;
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, []);

  // Listen for reload event
  useEffect(() => {
    const unlisten = listen("chat-window-reload", () => {
      window.location.reload();
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  return (
    <AcpChat
      mode="expanded"
      onModeChange={() => {}}
      contained
      className="h-screen w-screen"
      windowMode
    />
  );
}
