import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { useDesktopRouting } from "./use-desktop-routing";
import {
  parseVibenDeepLink,
  type DesktopDeepLinkIntent,
} from "@/navigation/deep-link";

let desktopDeepLinkListenerInitialized = false;

export function useDesktopDeepLink() {
  const { handleDeepLink } = useDesktopRouting();

  useEffect(() => {
    if (desktopDeepLinkListenerInitialized) {
      return;
    }

    desktopDeepLinkListenerInitialized = true;

    const unlistenPromise = listen<string | DesktopDeepLinkIntent>(
      "desktop-deep-link",
      (event) => {
        if (!event.payload) {
          return;
        }

        if (typeof event.payload === "string") {
          const intent = parseVibenDeepLink(event.payload);
          if (intent) {
            handleDeepLink(intent);
          }
          return;
        }

        handleDeepLink(event.payload);
      }
    );

    return () => {
      unlistenPromise.then((unlisten) => {
        unlisten();
        desktopDeepLinkListenerInitialized = false;
      });
    };
  }, [handleDeepLink]);
}
