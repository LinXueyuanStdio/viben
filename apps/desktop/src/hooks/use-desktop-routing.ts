import { useCallback, useEffect, useId, useMemo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  usePageTabs,
  type TabType,
} from "@/hooks/use-page-tabs";
import {
  useOptionalNavigationShell,
  useNavigationShellHeaderState,
} from "@/components/navigation";
import type { IconData } from "@/components/ui/icon-picker";
import { urlToLocation, type DesktopLocation } from "@/navigation/location";
import {
  getSettingsSectionDescriptor,
  getWorkspaceSectionDescriptor,
  normalizeWorkspaceSection,
  type SettingsSection,
} from "@/navigation/navigation-meta";
import { createLocationBreadcrumbItem } from "@/navigation/breadcrumb-stack";
import type { DesktopDeepLinkIntent } from "@/navigation/deep-link";
import type { BreadcrumbStackItem, WorkspaceSection } from "@/navigation/view-target";
import type { Workspace } from "@/types";

export interface DesktopOpenOptions {
  openMode?: "focus" | "reuse" | "new-tab";
}

export interface DesktopNavigationDescriptor {
  title?: string;
  icon?: IconData;
  breadcrumbStack?: BreadcrumbStackItem[];
}

export interface DesktopNavigateOptions
  extends DesktopOpenOptions,
    DesktopNavigationDescriptor {}

export interface DesktopChildNavigateOptions
  extends DesktopNavigateOptions {
  stackMode?: "open" | "push" | "replace";
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
  openWorkspaceApps: (workspaceId: string, options?: DesktopOpenOptions) => void;
  openWorkspaceSection: (
    workspaceId: string,
    section: WorkspaceSection,
    options?: DesktopOpenOptions
  ) => void;
  openWorkspaceAgentList: (workspaceId: string, options?: DesktopOpenOptions) => void;
  openWorkspaceAgentDetail: (
    workspaceId: string,
    agentId: string,
    options?: DesktopChildNavigateOptions
  ) => void;
  openWorkspaceExecutorDetail: (
    workspaceId: string,
    executorType: string,
    options?: DesktopChildNavigateOptions
  ) => void;
  openWorkspacePage: (
    workspaceId: string,
    pageSlug: string,
    options?: DesktopNavigateOptions
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
  openAgentDetail: (
    agentId: string,
    workspacePath?: string,
    options?: DesktopOpenOptions
  ) => void;
  openExecutorDetail: (
    executorType: string,
    workspacePath?: string,
    options?: DesktopOpenOptions
  ) => void;
  openSkillDetail: (
    skillId: string,
    input: { agentId: string; workspacePath?: string; title?: string },
    options?: DesktopChildNavigateOptions
  ) => void;
  openMcpServerDetail: (
    serverName: string,
    input: { executorType: string; workspacePath?: string },
    options?: DesktopChildNavigateOptions
  ) => void;
  openSubagentDetail: (
    configId: string,
    input: { executorType: string; workspacePath?: string },
    options?: DesktopChildNavigateOptions
  ) => void;
  openPromptDetail: (
    promptId: string,
    input: { executorType: string; workspacePath?: string },
    options?: DesktopChildNavigateOptions
  ) => void;
  openCommandDetail: (
    commandId: string,
    input: { executorType: string; workspacePath?: string },
    options?: DesktopChildNavigateOptions
  ) => void;
  openDocuments: (options?: DesktopOpenOptions) => void;
  openDevicePair: (options?: DesktopOpenOptions) => void;
  openDashboard: (options?: DesktopOpenOptions) => void;
  openSkillsMarket: (options?: DesktopOpenOptions) => void;

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

  const openWorkspaceApps = useCallback(
    (workspaceId: string, options?: DesktopOpenOptions) => {
      pageTabs.openLocation(
        { kind: "workspace-apps", workspaceId },
        {
          openInNewTab: buildOpenTabFlag(options),
          tabInfo: {
            type: "workspace",
            slug: "apps",
            workspaceId,
            name: t("page.pages", "Apps"),
            icon: { type: "lucide", value: "layout-grid" },
          },
        }
      );
    },
    [pageTabs, t]
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
      options?: DesktopChildNavigateOptions
    ) => {
      const location: DesktopLocation = {
        kind: "workspace-agent-detail",
        workspaceId,
        agentId,
      };
      openChildLocation(
        location,
        createLocationBreadcrumbItem(location, {
          id: `workspace:${workspaceId}:agent:${agentId}`,
          kind: "workspace-agent",
          label: options?.title ?? agentId,
          icon: options?.icon ?? { type: "lucide", value: "bot" },
          meta: {
            workspaceId,
            agentId,
          },
        }),
        {
          type: "workspace",
          slug: agentId,
          workspaceId,
          name: options?.title ?? agentId,
          icon: options?.icon ?? { type: "lucide", value: "bot" },
        },
        options
      );
    },
    [openChildLocation]
  );

  const openWorkspaceExecutorDetail = useCallback(
    (
      workspaceId: string,
      executorType: string,
      options?: DesktopChildNavigateOptions
    ) => {
      const location: DesktopLocation = {
        kind: "workspace-executor-detail",
        workspaceId,
        executorType,
      };
      openChildLocation(
        location,
        createLocationBreadcrumbItem(location, {
          id: `workspace:${workspaceId}:executor:${executorType}`,
          kind: "workspace-executor",
          label: options?.title ?? executorType,
          icon: options?.icon ?? { type: "lucide", value: "terminal" },
          meta: {
            workspaceId,
            executorType,
          },
        }),
        {
          type: "workspace",
          slug: executorType,
          workspaceId,
          name: options?.title ?? executorType,
          icon: options?.icon ?? { type: "lucide", value: "terminal" },
        },
        options
      );
    },
    [openChildLocation]
  );

  const openWorkspacePage = useCallback(
    (
      workspaceId: string,
      pageSlug: string,
      options?: DesktopNavigateOptions
    ) => {
      const breadcrumbStack = options?.breadcrumbStack;
      const leaf = breadcrumbStack?.[breadcrumbStack.length - 1];

      pageTabs.openLocation(
        { kind: "workspace-page", workspaceId, pageSlug },
        {
          openInNewTab: buildOpenTabFlag(options),
          breadcrumbStack: options?.breadcrumbStack,
          tabInfo: {
            type: "page",
            slug: pageSlug,
            workspaceId,
            name:
              leaf?.label ??
              options?.title ??
              pageSlug.split("/").filter(Boolean).pop() ??
              pageSlug,
            icon:
              leaf?.icon ??
              options?.icon ??
              { type: "lucide", value: "file-text" },
          },
        }
      );
    },
    [pageTabs]
  );

  const pushWorkspaceAgentDetail = useCallback(
    (
      workspaceId: string,
      agentId: string,
      options?: { title?: string; icon?: IconData; mode?: "push" | "replace"; openMode?: DesktopOpenOptions["openMode"] }
    ) =>
      openWorkspaceAgentDetail(workspaceId, agentId, {
        title: options?.title,
        icon: options?.icon,
        openMode: options?.openMode,
        stackMode: options?.mode === "replace" ? "replace" : "push",
      }),
    [openWorkspaceAgentDetail]
  );

  const pushWorkspaceExecutorDetail = useCallback(
    (
      workspaceId: string,
      executorType: string,
      options?: { title?: string; icon?: IconData; mode?: "push" | "replace"; openMode?: DesktopOpenOptions["openMode"] }
    ) =>
      openWorkspaceExecutorDetail(workspaceId, executorType, {
        title: options?.title,
        icon: options?.icon,
        openMode: options?.openMode,
        stackMode: options?.mode === "replace" ? "replace" : "push",
      }),
    [openWorkspaceExecutorDetail]
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

  const openAgentDetail = useCallback(
    (
      agentId: string,
      workspacePath?: string,
      options?: DesktopOpenOptions
    ) => {
      pageTabs.openLocation(
        { kind: "agent-detail", agentId, workspacePath },
        {
          openInNewTab: buildOpenTabFlag(options),
          tabInfo: {
            type: "workspace",
            slug: agentId,
            name: agentId,
            icon: { type: "lucide", value: "bot" },
          },
        }
      );
    },
    [pageTabs]
  );

  const openExecutorDetail = useCallback(
    (
      executorType: string,
      workspacePath?: string,
      options?: DesktopOpenOptions
    ) => {
      pageTabs.openLocation(
        { kind: "executor-detail", executorType, workspacePath },
        {
          openInNewTab: buildOpenTabFlag(options),
          tabInfo: {
            type: "workspace",
            slug: executorType,
            name: executorType,
            icon: { type: "lucide", value: "terminal" },
          },
        }
      );
    },
    [pageTabs]
  );

  const openMcpServerDetail = useCallback(
    (
      serverName: string,
      input: { executorType: string; workspacePath?: string },
      options?: DesktopOpenOptions
    ) => {
      pageTabs.openLocation(
        {
          kind: "mcp-server-detail",
          serverName,
          executorType: input.executorType,
          workspacePath: input.workspacePath,
        },
        {
          openInNewTab: buildOpenTabFlag(options),
          tabInfo: {
            type: "page",
            slug: serverName,
            name: serverName,
            icon: { type: "lucide", value: "server" },
          },
        }
      );
    },
    [pageTabs]
  );

  const openSubagentDetail = useCallback(
    (
      configId: string,
      input: { executorType: string; workspacePath?: string },
      options?: DesktopOpenOptions
    ) => {
      pageTabs.openLocation(
        {
          kind: "subagent-detail",
          configId,
          executorType: input.executorType,
          workspacePath: input.workspacePath,
        },
        {
          openInNewTab: buildOpenTabFlag(options),
          tabInfo: {
            type: "page",
            slug: configId,
            name: configId,
            icon: { type: "lucide", value: "bot" },
          },
        }
      );
    },
    [pageTabs]
  );

  const openPromptDetail = useCallback(
    (
      promptId: string,
      input: { executorType: string; workspacePath?: string },
      options?: DesktopOpenOptions
    ) => {
      pageTabs.openLocation(
        {
          kind: "prompt-detail",
          promptId,
          executorType: input.executorType,
          workspacePath: input.workspacePath,
        },
        {
          openInNewTab: buildOpenTabFlag(options),
          tabInfo: {
            type: "page",
            slug: promptId,
            name: promptId,
            icon: { type: "lucide", value: "quote" },
          },
        }
      );
    },
    [pageTabs]
  );

  const openCommandDetail = useCallback(
    (
      commandId: string,
      input: { executorType: string; workspacePath?: string },
      options?: DesktopOpenOptions
    ) => {
      pageTabs.openLocation(
        {
          kind: "command-detail",
          commandId,
          executorType: input.executorType,
          workspacePath: input.workspacePath,
        },
        {
          openInNewTab: buildOpenTabFlag(options),
          tabInfo: {
            type: "page",
            slug: commandId,
            name: commandId,
            icon: { type: "lucide", value: "terminal" },
          },
        }
      );
    },
    [pageTabs]
  );

  const openDocuments = useCallback(
    (options?: DesktopOpenOptions) => {
      pageTabs.openLocation(
        { kind: "documents" },
        {
          openInNewTab: buildOpenTabFlag(options),
          tabInfo: {
            type: "workspace",
            slug: "documents",
            name: t("nav.documents", "Documents"),
            icon: { type: "lucide", value: "file-text" },
          },
        }
      );
    },
    [pageTabs, t]
  );

  const openDevicePair = useCallback(
    (options?: DesktopOpenOptions) => {
      pageTabs.openLocation(
        { kind: "device-pair" },
        {
          openInNewTab: buildOpenTabFlag(options),
          tabInfo: {
            type: "workspace",
            slug: "device-pair",
            name: t("nav.devices", "Devices"),
            icon: { type: "lucide", value: "smartphone" },
          },
        }
      );
    },
    [pageTabs, t]
  );

  const openDashboard = useCallback(
    (options?: DesktopOpenOptions) => {
      openPath("/mcp-services/dashboard", {
        title: t("nav.dashboard", "Dashboard"),
        icon: { type: "lucide", value: "layout-dashboard" },
        type: "workspace",
        slug: "dashboard",
        openMode: options?.openMode,
      });
    },
    [openPath, t]
  );

  const openSkillsMarket = useCallback(
    (options?: DesktopOpenOptions) => {
      openPath("/skills-market", {
        title: t("nav.skillsMarket", "Skills Market"),
        icon: { type: "lucide", value: "sparkles" },
        type: "page",
        slug: "skills-market",
        openMode: options?.openMode,
      });
    },
    [openPath, t]
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

  const openChildLocation = useCallback(
    (
      location: DesktopLocation,
      item: BreadcrumbStackItem,
      tabInfo: {
        type: TabType;
        slug?: string;
        workspaceId?: string;
        name: string;
        icon?: IconData;
      },
      options?: DesktopChildNavigateOptions
    ) => {
      const explicitStack = options?.breadcrumbStack;
      const explicitLeaf = explicitStack?.[explicitStack.length - 1];
      const resolvedTabInfo = {
        ...tabInfo,
        name: explicitLeaf?.label ?? tabInfo.name,
        icon: explicitLeaf?.icon ?? tabInfo.icon,
      };

      if (options?.openMode === "new-tab") {
        pageTabs.openLocation(location, {
          openInNewTab: true,
          breadcrumbStack: explicitStack ?? [...currentStack, item],
          tabInfo: resolvedTabInfo,
        });
        return;
      }

      if (explicitStack) {
        pageTabs.openLocation(location, {
          breadcrumbStack: explicitStack,
          tabInfo: resolvedTabInfo,
        });
        return;
      }

      const sameWorkspace =
        !("workspaceId" in location) ||
        !currentWorkspaceId ||
        currentWorkspaceId === location.workspaceId;
      const stackMode =
        options?.stackMode ?? (currentStack.length > 0 && sameWorkspace ? "push" : "open");

      if (stackMode === "open") {
        pageTabs.openLocation(location, {
          tabInfo: resolvedTabInfo,
        });
        return;
      }

      pushChildPage(item, location, {
        mode: stackMode,
      });
    },
    [currentStack, currentWorkspaceId, pageTabs, pushChildPage]
  );

  const openSkillDetail = useCallback(
    (
      skillId: string,
      input: { agentId: string; workspacePath?: string; title?: string },
      options?: DesktopChildNavigateOptions
    ) => {
      const location: DesktopLocation = {
        kind: "skill-detail",
        skillId,
        agentId: input.agentId,
        workspacePath: input.workspacePath,
      };
      openChildLocation(
        location,
        createLocationBreadcrumbItem(location, {
          id: `skill:${skillId}`,
          label: input.title ?? skillId,
          kind: "workspace-page",
          icon: { type: "lucide", value: "sparkles" },
          meta: {
            workspaceId: currentWorkspaceId ?? currentStack[0]?.meta?.workspaceId,
            agentId: input.agentId,
          },
        }),
        {
          type: "page",
          slug: skillId,
          name: input.title ?? skillId,
          icon: { type: "lucide", value: "sparkles" },
        },
        options
      );
    },
    [currentStack, currentWorkspaceId, openChildLocation]
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
        createLocationBreadcrumbItem(location, {
          label: options?.title ?? pageSlug.split("/").filter(Boolean).pop() ?? pageSlug,
          kind: "workspace-page",
          icon: options?.icon,
          meta: {
            workspaceId: currentWorkspaceId,
            pageSlug,
          },
        }),
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
        createLocationBreadcrumbItem(location, {
          label: title,
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
      openWorkspaceApps,
      openWorkspaceSection,
      openWorkspaceAgentList,
      openWorkspaceAgentDetail,
      pushWorkspaceAgentDetail,
      openWorkspaceExecutorDetail,
      pushWorkspaceExecutorDetail,
      openWorkspacePage,
      openWorkspaceWeb,
      openSettings,
      openAgentDetail,
      openExecutorDetail,
      openSkillDetail,
      openMcpServerDetail,
      openSubagentDetail,
      openPromptDetail,
      openCommandDetail,
      openDocuments,
      openDevicePair,
      openDashboard,
      openSkillsMarket,

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
      headerCenter: null,
      headerRight: null,
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
      openAgentDetail,
      openCommandDetail,
      openDashboard,
      openDevicePair,
      openDocuments,
      openExecutorDetail,
      openMcpServerDetail,
      openSettings,
      openPromptDetail,
      openSkillDetail,
      openSkillsMarket,
      openSubagentDetail,
      openWorkspaceAgentDetail,
      openWorkspaceAgentList,
      openWorkspaceExecutorDetail,
      pushWorkspaceExecutorDetail,
      openWorkspaceHome,
      openWorkspaceApps,
      openWorkspacePage,
      pushWorkspaceAgentDetail,
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
