import type { DesktopNavigationOptions } from "@/hooks/use-desktop-routing";
import { buildColdStartBreadcrumb } from "@/navigation/breadcrumb-builder";
import { navigate } from "@/navigation/navigate";
import { useTabStore } from "@/stores/tab-store";

export type NavigateToHandler = (
  path: string,
  options?: Pick<DesktopNavigationOptions, "title" | "icon" | "openMode">
) => void;

let navigateToHandler: NavigateToHandler | null = null;

export function setNavigateToHandler(handler: NavigateToHandler): void {
  navigateToHandler = handler;
}

export function clearNavigateToHandler(handler?: NavigateToHandler): void {
  if (!handler || navigateToHandler === handler) {
    navigateToHandler = null;
  }
}

export function navigateToPath(path: string): void {
  if (navigateToHandler) {
    navigateToHandler(path);
    return;
  }

  navigateToPathFromTabStore(path);
}

function navigateToPathFromTabStore(path: string): void {
  const store = useTabStore.getState();
  const activeTabId = store.activeTabId;
  if (activeTabId) {
    navigate("reset", path, undefined, {
      activeTabId,
      pushNavigation: store.pushNavigation,
      replaceNavigation: store.replaceNavigation,
      resetNavigation: store.resetNavigation,
    });
    return;
  }

  store.openTab({
    navigationState: {
      url: path,
      breadcrumbStack: buildColdStartBreadcrumb(path),
    },
  });
}
