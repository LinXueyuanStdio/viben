import { useEffect } from "react";
import { useDesktopRouting } from "@/hooks/use-desktop-routing";
import {
  clearNavigateToHandler,
  setNavigateToHandler,
  type NavigateToHandler,
} from "@/lib/action-system/navigation-handler";

/**
 * Bridges non-React GUI actions to the app's canonical desktop navigation API.
 */
export function ActionNavigationHandlerProvider() {
  const { openPath } = useDesktopRouting();

  useEffect(() => {
    const handler: NavigateToHandler = (path, options) => {
      openPath(path, options);
    };
    setNavigateToHandler(handler);
    return () => clearNavigateToHandler(handler);
  }, [openPath]);

  return null;
}
