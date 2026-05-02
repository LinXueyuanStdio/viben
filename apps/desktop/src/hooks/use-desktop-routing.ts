import { useCallback, useEffect, useId, useMemo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  usePageTabs,
  createChildBreadcrumbItem,
  type TabType,
} from "@/hooks/use-page-tabs";
import {
  useOptionalNavigationShell,
  useNavigationShellHeaderState,
  useNavigationShellSlots,
} from "@/components/navigation";
import type { IconData } from "@/components/ui/icon-picker";
import { urlToLocation, type DesktopLocation } from "@/navigation/location";
import {
  getSettingsSectionDescriptor,
  getWorkspaceSectionDescriptor,
  normalizeWorkspaceSection,
  type SettingsSection,
} from "@/navigation/navigation-meta";
import type { DesktopDeepLinkIntent } from "@/navigation/deep-link";
import type { BreadcrumbStackItem, WorkspaceSection } from "@/navigation/view-target";
import type { Workspace } from "@/types";

export interface DesktopOpenOptions {
  openMode?: "focus" | "reuse" | "new-tab";
}

export interface DesktopRoutingApi {
  currentTab: ReturnType<typeof usePageTabs>["activeTab"];
  currentRoute: DesktopLocation | null;
  currentStack: BreadcrumbStackItem[];
  breadcrumb: BreadcrumbStackItem[];
  currentDescriptor: BreadcrumbStackItem | null;
  currentWorkspaceId: string | null;
  currentWorkspace: Workspace | undefined;

  openWorkspaceHome: (workspaceId: string, options?: DesktopOpenOptions) => void;
  openWorkspaceSection: (
    workspaceId: string,
    section: WorkspaceSection,
    options?: DesktopOpenOptions
  ) => void;
  openWorkspaceAgentList: (workspaceId: string, options?: DesktopOpenOptions) => void;
  openWorkspaceAgentDetail: (
    workspaceId: string,
    agentId: string,
    options?: DesktopOpenOptions
  ) => void;
  openWorkspaceExecutorDetail: (
    workspaceId: string,
    executorType: string,
    options?: DesktopOpenOptions
  ) => void;
  openWorkspacePage: (
    workspaceId: string,
    pageSlug: string,
    options?: DesktopOpenOptions
  ) => void;
  openWorkspaceWeb: (
    workspaceId: string,
    input: { url: string; title?: string; webId?: string },
    options?: DesktopOpenOptions
  ) => void;
  openSettings: (
    section?: SettingsSection | string,
    options?: DesktopOpenOptions
  ) => void;

  pushChildPage: (
    item: BreadcrumbStackItem,
    location: DesktopLocation,
    options?: { mode?: "push" | "replace"; openMode?: DesktopOpenOptions["openMode"] }
  ) => void;
  pushCurrentPageChild: (
    pageSlug: string,
    options?: { title?: string; icon?: IconData; mode?: "push" | "replace" }
  ) => void;
  openCurrentPageWeb: (
    url: string,
    input?: { title?: string; icon?: IconData; webId?: string; mode?: "push" | "replace" }
  ) => void;

  openRoute: (route: DesktopLocation, options?: DesktopOpenOptions) => void;
  focusOrOpenRoute: (route: DesktopLocation) => void;
  openPath: (
    path: string,
    input?: {
      title?: string;
      icon?: IconData;
      workspaceId?: string;
      slug?: string;
      type?: TabType;
      openMode?: DesktopOpenOptions["openMode"];
    }
  ) => void;
  handleDeepLink: (intent: DesktopDeepLinkIntent) => void;

  canGoBack: boolean;
  canGoForward: boolean;
  goBack: () => void;
  goForward: () => void;
  closeCurrentTab: () => void;

  setHeaderCenter: (content: ReactNode | null) => void;
  setHeaderRight: (content: ReactNode | null) => void;
  clearHeaderSlots: () => void;
  headerCenter: ReactNode | null;
  headerRight: ReactNode | null;
}

function buildOpenTabFlag(options?: DesktopOpenOptions): boolean {
  return options?.openMode === "new-tab";
}

function safeHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function inferWorkspaceId(location: DesktopLocation | null): string | null {
  if (!location) {
    return null;
  }

  return "workspaceId" in location ? location.workspaceId : null;
}

function pathToDesktopLocation(path: string): DesktopLocation {
  return urlToLocation(path) ?? { kind: "global-route", path };
}

export function useDesktopRouting(): DesktopRoutingApi {
  const { t } = useTranslation();
  const pageTabs = usePageTabs();
  const shell = useOptionalNavigationShell();
  const shellHeader = useNavigationShellHeaderState();
  const shellSlots = useNavigationShellSlots();
  const ownerId = useId();

  const currentRoute = pageTabs.currentNavigationState?.location ?? null;
  const currentStack = pageTabs.currentNavigationState?.breadcrumbStack ?? [];
  const currentDescriptor = currentStack[currentStack.length - 1] ?? null;
  const currentWorkspaceId = inferWorkspaceId(currentRoute);
  const currentWorkspace = shellHeader?.workspace;

  const openRoute = useCallback(
    (route: DesktopLocation, options?: DesktopOpenOptions) => {
      pageTabs.openLocation(route, {
        openInNewTab: buildOpenTabFlag(options),
      });
    },
    [pageTabs]
  );

  const focusOrOpenRoute = useCallback(
    (route: DesktopLocation) => {
      pageTabs.openLocation(route);
    },
    [pageTabs]
  );

  const openPath = useCallback(
    (
      path: string,
      input?: {
        title?: string;
        icon?: IconData;
        workspaceId?: string;
        slug?: string;
        type?: TabType;
        openMode?: DesktopOpenOptions["openMode"];
      }
    ) => {
      if (input?.openMode === "new-tab") {
        const location = pathToDesktopLocation(path);
        pageTabs.openLocation(location, {
          openInNewTab: true,
          tabInfo: {
            type: input?.type,
            name: input?.title,
            icon: input?.icon,
            slug: input?.slug,
            workspaceId: input?.workspaceId,
          },
        });
        return;
      }

      pageTabs.navigateTo(path, {
        type: input?.type ?? "workspace",
        name: input?.title ?? path,
        icon: input?.icon,
        slug: input?.slug,
        workspaceId: input?.workspaceId,
      });
    },
    [pageTabs]
  );

  const openWorkspaceHome = useCallback(
    (workspaceId: string, options?: DesktopOpenOptions) => {
      pageTabs.openLocation(
        { kind: "workspace-home", workspaceId },
        {
          openInNewTab: buildOpenTabFlag(options),
          tabInfo: {
            type: "workspace",
            slug: "home",
            workspaceId,
            name: workspaceId,
          },
        }
      );
    },
    [pageTabs]
  );

  const openWorkspaceSection = useCallback(
    (
      workspaceId: string,
      section: WorkspaceSection,
      options?: DesktopOpenOptions
    ) => {
      const descriptor = getWorkspaceSectionDescriptor(section);
      pageTabs.openLocation(
        { kind: "workspace-section", workspaceId, section },
        {
          openInNewTab: buildOpenTabFlag(options),
          tabInfo: {
            type: section === "chat" ? "chat" : "workspace",
            slug: descriptor?.routePath ?? section,
            workspaceId,
            name: descriptor
              ? t(descriptor.titleKey, descriptor.fallbackLabel)
              : section,
            icon: descriptor?.icon,
          },
        }
      );
    },
    [pageTabs, t]
  );

  const openWorkspaceAgentList = useCallback(
    (workspaceId: string, options?: DesktopOpenOptions) => {
      openWorkspaceSection(workspaceId, "agent", options);
    },
    [openWorkspaceSection]
  );

  const openWorkspaceAgentDetail = useCallback(
    (
      workspaceId: string,
      agentId: string,
      options?: DesktopOpenOptions
    ) => {
      pageTabs.openLocation(
        { kind: "workspace-agent-detail", workspaceId, agentId },
        {
          openInNewTab: buildOpenTabFlag(options),
          tabInfo: {
            type: "workspace",
            slug: agentId,
            workspaceId,
            name: agentId,
            icon: { type: "lucide", value: "bot" },
          },
        }
      );
    },
    [pageTabs]
  );

  const openWorkspaceExecutorDetail = useCallback(
    (
      workspaceId: string,
      executorType: string,
      options?: DesktopOpenOptions
    ) => {
      pageTabs.openLocation(
        { kind: "workspace-executor-detail", workspaceId, executorType },
        {
          openInNewTab: buildOpenTabFlag(options),
          tabInfo: {
            type: "workspace",
            slug: executorType,
            workspaceId,
            name: executorType,
            icon: { type: "lucide", value: "terminal" },
          },
        }
      );
    },
    [pageTabs]
  );

  const openWorkspacePage = useCallback(
    (
      workspaceId: string,
      pageSlug: string,
      options?: DesktopOpenOptions
    ) => {
      pageTabs.openLocation(
        { kind: "workspace-page", workspaceId, pageSlug },
        {
          openInNewTab: buildOpenTabFlag(options),
          tabInfo: {
            type: "page",
            slug: pageSlug,
            workspaceId,
            name: pageSlug.split("/").filter(Boolean).pop() ?? pageSlug,
            icon: { type: "lucide", value: "file-text" },
          },
        }
      );
    },
    [pageTabs]
  );

  const openWorkspaceWeb = useCallback(
    (
      workspaceId: string,
      input: { url: string; title?: string; webId?: string },
      options?: DesktopOpenOptions
    ) => {
      const title = input.title ?? safeHostname(input.url);
      pageTabs.openLocation(
        {
          kind: "workspace-web",
          workspaceId,
          title,
          url: input.url,
          webId: input.webId,
        },
        {
          openInNewTab: buildOpenTabFlag(options),
          tabInfo: {
            type: "web",
            slug: input.webId ?? input.url,
            workspaceId,
            name: title,
            icon: { type: "lucide", value: "globe" },
          },
        }
      );
    },
    [pageTabs]
  );

  const openSettings = useCallback(
    (
      section?: SettingsSection | string,
      options?: DesktopOpenOptions
    ) => {
      const normalizedSection = section ?? "general";
      const descriptor = getSettingsSectionDescriptor(normalizedSection);
      pageTabs.openLocation(
        { kind: "settings", section: normalizedSection },
        {
          openInNewTab: buildOpenTabFlag(options),
          tabInfo: {
            type: "settings",
            slug: normalizedSection,
            name: descriptor
              ? t(descriptor.titleKey, descriptor.fallbackLabel)
              : normalizedSection,
            icon: descriptor?.icon ?? { type: "lucide", value: "settings" },
          },
        }
      );
    },
    [pageTabs, t]
  );

  const pushChildPage = useCallback(
    (
      item: BreadcrumbStackItem,
      location: DesktopLocation,
      options?: { mode?: "push" | "replace"; openMode?: DesktopOpenOptions["openMode"] }
    ) => {
      if (options?.openMode === "new-tab") {
        pageTabs.openLocation(location, {
          openInNewTab: true,
          breadcrumbStack: [...currentStack, item],
        });
        return;
      }

      pageTabs.pushPage(item, location, {
        mode: options?.mode,
      });
    },
    [currentStack, pageTabs]
  );

  const pushCurrentPageChild = useCallback(
    (
      pageSlug: string,
      options?: { title?: string; icon?: IconData; mode?: "push" | "replace" }
    ) => {
      if (!currentWorkspaceId) {
        return;
      }

      const location: DesktopLocation = {
        kind: "workspace-page",
        workspaceId: currentWorkspaceId,
        pageSlug,
      };

      pushChildPage(
        createChildBreadcrumbItem(
          options?.title ?? pageSlug.split("/").filter(Boolean).pop() ?? pageSlug,
          location,
          {
            kind: "workspace-page",
            icon: options?.icon,
            meta: {
              workspaceId: currentWorkspaceId,
              pageSlug,
            },
          }
        ),
        location,
        { mode: options?.mode }
      );
    },
    [currentWorkspaceId, pushChildPage]
  );

  const openCurrentPageWeb = useCallback(
    (
      url: string,
      input?: { title?: string; icon?: IconData; webId?: string; mode?: "push" | "replace" }
    ) => {
      const workspaceId = currentWorkspaceId ?? pageTabs.activeTab?.workspaceId ?? "global";
      const title = input?.title ?? safeHostname(url);
      const location: DesktopLocation = {
        kind: "workspace-web",
        workspaceId,
        title,
        url,
        webId: input?.webId,
      };

      pushChildPage(
        createChildBreadcrumbItem(title, location, {
          kind: "workspace-web",
          icon: input?.icon ?? { type: "lucide", value: "globe" },
          meta: {
            workspaceId,
            webId: input?.webId,
            url,
          },
        }),
        location,
        { mode: input?.mode }
      );
    },
    [currentWorkspaceId, pageTabs.activeTab?.workspaceId, pushChildPage]
  );

  const handleDeepLink = useCallback(
    (intent: DesktopDeepLinkIntent) => {
      openRoute(intent.route, { openMode: intent.openMode });
    },
    [openRoute]
  );

  const closeCurrentTab = useCallback(() => {
    if (!pageTabs.activeTabId) {
      return;
    }
    pageTabs.closeTab(pageTabs.activeTabId);
  }, [pageTabs]);

  const clearHeaderSlots = useCallback(() => {
    shell?.clearSlotContent(ownerId);
  }, [ownerId, shell]);

  const setHeaderCenter = useCallback(
    (content: ReactNode | null) => {
      shell?.setCenterContent(ownerId, content);
    },
    [ownerId, shell]
  );

  const setHeaderRight = useCallback(
    (content: ReactNode | null) => {
      shell?.setRightContent(ownerId, content);
    },
    [ownerId, shell]
  );

  useEffect(() => () => {
    shell?.clearSlotContent(ownerId);
  }, [ownerId, shell]);

  return useMemo(
    () => ({
      currentTab: pageTabs.activeTab,
      currentRoute,
      currentStack,
      breadcrumb: currentStack,
      currentDescriptor,
      currentWorkspaceId,
      currentWorkspace,

      openWorkspaceHome,
      openWorkspaceSection,
      openWorkspaceAgentList,
      openWorkspaceAgentDetail,
      openWorkspaceExecutorDetail,
      openWorkspacePage,
      openWorkspaceWeb,
      openSettings,

      pushChildPage,
      pushCurrentPageChild,
      openCurrentPageWeb,

      openRoute,
      focusOrOpenRoute,
      openPath,
      handleDeepLink,

      canGoBack: pageTabs.canGoBack,
      canGoForward: pageTabs.canGoForward,
      goBack: pageTabs.goBackInTab,
      goForward: pageTabs.goForwardInTab,
      closeCurrentTab,

      setHeaderCenter,
      setHeaderRight,
      clearHeaderSlots,
      headerCenter: shellSlots?.centerContent ?? null,
      headerRight: shellSlots?.rightContent ?? null,
    }),
    [
      clearHeaderSlots,
      closeCurrentTab,
      currentDescriptor,
      currentRoute,
      currentStack,
      currentWorkspace,
      currentWorkspaceId,
      focusOrOpenRoute,
      handleDeepLink,
      openCurrentPageWeb,
      openPath,
      openRoute,
      openSettings,
      openWorkspaceAgentDetail,
      openWorkspaceAgentList,
      openWorkspaceExecutorDetail,
      openWorkspaceHome,
      openWorkspacePage,
      openWorkspaceSection,
      openWorkspaceWeb,
      pageTabs.activeTab,
      pageTabs.canGoBack,
      pageTabs.canGoForward,
      pageTabs.goBackInTab,
      pageTabs.goForwardInTab,
      pushChildPage,
      pushCurrentPageChild,
      setHeaderCenter,
      setHeaderRight,
      shellSlots?.centerContent,
      shellSlots?.rightContent,
    ]
  );
}

export function useDesktopRoutingHeaderSync(
  routing: Pick<DesktopRoutingApi, "setHeaderCenter" | "setHeaderRight" | "clearHeaderSlots">,
  centerContent: ReactNode | null | undefined,
  rightContent: ReactNode | null | undefined
) {
  const { setHeaderCenter, setHeaderRight, clearHeaderSlots } = routing;

  useEffect(() => {
    setHeaderCenter(centerContent ?? null);
  }, [centerContent, setHeaderCenter]);

  useEffect(() => {
    setHeaderRight(rightContent ?? null);
  }, [rightContent, setHeaderRight]);

  useEffect(() => clearHeaderSlots, [clearHeaderSlots]);
}

export function openWorkspaceSectionByRoutePath(
  workspaceId: string,
  routePath: string,
  api: Pick<DesktopRoutingApi, "openWorkspaceSection">
) {
  api.openWorkspaceSection(
    workspaceId,
    normalizeWorkspaceSection(routePath)
  );
}
