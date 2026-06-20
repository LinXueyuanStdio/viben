import { useCallback, useEffect, useId, useMemo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  useActiveTabState,
  useTabActions,
  useTabNavigation,
  type ActiveTabState,
} from "@/hooks/use-page-tabs";
import {
  useOptionalNavigationShell,
  useNavigationShellHeaderState,
} from "@/components/navigation";
import type { IconData } from "@/components/ui/icon-picker";
import {
  normalizeSettingsSection,
  normalizeWorkspaceSection,
  type SettingsSection,
  type WorkspaceSection,
} from "@/navigation/navigation-meta";
import {
  navigate,
  buildNavigateLeaf,
  buildBreadcrumbItem,
  buildColdStartBreadcrumb,
  registry,
} from "@/navigation/navigate";
import type {
  NavigateHeaders,
  BreadcrumbStackItem,
} from "@/navigation/navigate";
import type { DesktopDeepLinkIntent } from "@/navigation/deep-link";
import { getCurrentWindowTabStore } from "@/stores/tab-store";
import type { Workspace } from "@/types";

export interface DesktopNavigationOptions {
  openMode?: "focus" | "reuse" | "new-tab";
  title?: string;
  icon?: IconData;
  breadcrumbStack?: BreadcrumbStackItem[];
  stackMode?: "open" | "push" | "replace";
}

export interface DesktopRoutingApi {
  currentTab: ActiveTabState["activeTab"];
  currentUrl: string | null;
  currentStack: BreadcrumbStackItem[];
  breadcrumb: BreadcrumbStackItem[];
  currentDescriptor: BreadcrumbStackItem | null;
  currentWorkspaceId: string | null;
  currentWorkspace: Workspace | undefined;

  openWorkspaceHome: (
    workspaceId: string,
    options?: DesktopNavigationOptions,
  ) => void;
  openWorkspacePages: (
    workspaceId: string,
    options?: DesktopNavigationOptions,
  ) => void;
  openWorkspaceSection: (
    workspaceId: string,
    section: WorkspaceSection,
    options?: DesktopNavigationOptions,
  ) => void;
  openWorkspaceAgentList: (
    workspaceId: string,
    options?: DesktopNavigationOptions,
  ) => void;
  openWorkspaceAgentDetail: (
    workspaceId: string,
    agentId: string,
    options?: DesktopNavigationOptions,
  ) => void;
  pushWorkspaceAgentDetail: (
    workspaceId: string,
    agentId: string,
    options?: {
      title?: string;
      icon?: IconData;
      mode?: "push" | "replace";
      openMode?: DesktopNavigationOptions["openMode"];
    },
  ) => void;
  openWorkspaceExecutorDetail: (
    workspaceId: string,
    executorType: string,
    options?: DesktopNavigationOptions,
  ) => void;
  pushWorkspaceExecutorDetail: (
    workspaceId: string,
    executorType: string,
    options?: {
      title?: string;
      icon?: IconData;
      mode?: "push" | "replace";
      openMode?: DesktopNavigationOptions["openMode"];
    },
  ) => void;
  openWorkspacePage: (
    workspaceId: string,
    uid: string,
    options?: DesktopNavigationOptions,
  ) => void;
  openWorkspaceWeb: (
    workspaceId: string,
    input: { url: string; title?: string; webId?: string },
    options?: DesktopNavigationOptions,
  ) => void;
  openSettings: (
    section?: SettingsSection | string,
    options?: DesktopNavigationOptions,
  ) => void;
  openAgentDetail: (
    agentId: string,
    workspacePath?: string,
    options?: DesktopNavigationOptions,
  ) => void;
  openExecutorDetail: (
    executorType: string,
    workspacePath?: string,
    options?: DesktopNavigationOptions,
  ) => void;
  openSkillDetail: (
    skillId: string,
    input: { agentId: string; workspacePath?: string; title?: string },
    options?: DesktopNavigationOptions,
  ) => void;
  openMcpServerDetail: (
    serverName: string,
    input: { executorType: string; workspacePath?: string },
    options?: DesktopNavigationOptions,
  ) => void;
  openSubagentDetail: (
    configId: string,
    input: { executorType: string; workspacePath?: string },
    options?: DesktopNavigationOptions,
  ) => void;
  openPromptDetail: (
    promptId: string,
    input: { executorType: string; workspacePath?: string },
    options?: DesktopNavigationOptions,
  ) => void;
  openCommandDetail: (
    commandId: string,
    input: { executorType: string; workspacePath?: string },
    options?: DesktopNavigationOptions,
  ) => void;
  openDocuments: (options?: DesktopNavigationOptions) => void;
  openDevicePair: (options?: DesktopNavigationOptions) => void;
  openDashboard: (options?: DesktopNavigationOptions) => void;
  openSkillsMarket: (options?: DesktopNavigationOptions) => void;

  pushChildPage: (
    item: BreadcrumbStackItem,
    url: string,
    options?: {
      mode?: "push" | "replace";
      openMode?: DesktopNavigationOptions["openMode"];
    },
  ) => void;
  pushCurrentPageChild: (
    uid: string,
    options?: { title?: string; icon?: IconData; mode?: "push" | "replace" },
  ) => void;
  openCurrentPageWeb: (
    url: string,
    input?: {
      title?: string;
      icon?: IconData;
      webId?: string;
      mode?: "push" | "replace";
    },
  ) => void;

  openRoute: (url: string, options?: DesktopNavigationOptions) => void;
  focusOrOpenRoute: (url: string) => void;
  openPath: (
    path: string,
    input?: {
      title?: string;
      icon?: IconData;
      workspaceId?: string;
      slug?: string;
      descriptorId?: string;
      openMode?: DesktopNavigationOptions["openMode"];
    },
  ) => void;
  handleDeepLink: (intent: DesktopDeepLinkIntent) => void;

  canGoBack: boolean;
  canGoForward: boolean;
  goBack: () => void;
  goForward: () => void;
  closeCurrentTab: () => void;
  detachCurrentTabToNewWindow: () => Promise<boolean>;
  popToBreadcrumb: (index: number) => void;

  setHeaderCenter: (content: ReactNode | null) => void;
  setHeaderRight: (content: ReactNode | null) => void;
  clearHeaderSlots: () => void;
  headerCenter: ReactNode | null;
  headerRight: ReactNode | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function safeHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function inferWorkspaceIdFromUrl(url: string | null): string | null {
  if (!url) return null;
  const match = registry.match(url);
  return match?.params?.workspaceId ?? null;
}

function buildTabStoreActions(
  tabStore: ReturnType<typeof getCurrentWindowTabStore>,
  activeTabId: string | null,
) {
  const store = tabStore.getState();
  return {
    activeTabId: activeTabId ?? "",
    pushNavigation: store.pushNavigation,
    replaceNavigation: store.replaceNavigation,
    resetNavigation: store.resetNavigation,
  };
}

// ─── Main Hook ────────────────────────────────────────────────────────────────

export function useDesktopRouting(): DesktopRoutingApi {
  const { t } = useTranslation();
  const tabStore = useMemo(() => getCurrentWindowTabStore(), []);
  const tabState = useActiveTabState();
  const tabActions = useTabActions();
  const tabNav = useTabNavigation();
  const shell = useOptionalNavigationShell();
  const shellHeader = useNavigationShellHeaderState();
  const ownerId = useId();

  const currentUrl = tabState.currentUrl;
  const currentNavigationState = tabState.currentNavigationState;
  const currentStack = useMemo(
    () => currentNavigationState?.breadcrumbStack ?? [],
    [currentNavigationState],
  );
  const currentDescriptor = currentStack[currentStack.length - 1] ?? null;
  const currentWorkspaceId = inferWorkspaceIdFromUrl(currentUrl);
  const currentWorkspace = shellHeader?.workspace;

  // ─── Pattern A: Simple navigate (reset) ─────────────────────────────────────

  const navigateReset = useCallback(
    (url: string, headers?: NavigateHeaders) => {
      if (!tabState.activeTabId) return;
      navigate(
        "reset",
        url,
        headers,
        buildTabStoreActions(tabStore, tabState.activeTabId),
      );
    },
    [tabState.activeTabId, tabStore],
  );

  const navigatePush = useCallback(
    (url: string, headers?: NavigateHeaders) => {
      if (!tabState.activeTabId) return;
      navigate(
        "push",
        url,
        headers,
        buildTabStoreActions(tabStore, tabState.activeTabId),
      );
    },
    [tabState.activeTabId, tabStore],
  );

  const navigateReplace = useCallback(
    (url: string, headers?: NavigateHeaders) => {
      if (!tabState.activeTabId) return;
      navigate(
        "replace",
        url,
        headers,
        buildTabStoreActions(tabStore, tabState.activeTabId),
      );
    },
    [tabState.activeTabId, tabStore],
  );

  // ─── Open in new tab ────────────────────────────────────────────────────────

  const openInNewTab = useCallback(
    (
      url: string,
      headers?: NavigateHeaders,
      breadcrumbStack?: BreadcrumbStackItem[],
    ) => {
      const stack = breadcrumbStack ?? buildColdStartBreadcrumb(url, headers);
      const store = tabStore.getState();
      store.openTab({
        navigationState: { url, breadcrumbStack: stack },
      });
    },
    [tabStore],
  );

  // ─── Public API implementations ──────────────────────────────────────────────

  const openRoute = useCallback(
    (url: string, options?: DesktopNavigationOptions) => {
      if (options?.openMode === "new-tab") {
        openInNewTab(url, { label: options?.title, icon: options?.icon });
        return;
      }
      navigateReset(url, { label: options?.title, icon: options?.icon });
    },
    [navigateReset, openInNewTab],
  );

  const focusOrOpenRoute = useCallback(
    (url: string) => {
      navigateReset(url);
    },
    [navigateReset],
  );

  const openPath = useCallback(
    (
      path: string,
      input?: {
        title?: string;
        icon?: IconData;
        workspaceId?: string;
        slug?: string;
        descriptorId?: string;
        openMode?: DesktopNavigationOptions["openMode"];
      },
    ) => {
      if (input?.openMode === "new-tab") {
        openInNewTab(path, { label: input?.title, icon: input?.icon });
        return;
      }
      navigateReset(path, {
        label: input?.title,
        icon: input?.icon,
        meta: input?.workspaceId
          ? { workspaceId: input.workspaceId }
          : undefined,
      });
    },
    [navigateReset, openInNewTab],
  );

  const openWorkspaceHome = useCallback(
    (workspaceId: string, options?: DesktopNavigationOptions) => {
      const url = registry.build("/workspace/:workspaceId", { workspaceId });
      if (options?.openMode === "new-tab") {
        openInNewTab(url);
        return;
      }
      navigateReset(url);
    },
    [navigateReset, openInNewTab],
  );

  const openWorkspacePages = useCallback(
    (workspaceId: string, options?: DesktopNavigationOptions) => {
      const url = registry.build("/workspace/:workspaceId/page", {
        workspaceId,
      });
      if (options?.openMode === "new-tab") {
        openInNewTab(url);
        return;
      }
      navigateReset(url);
    },
    [navigateReset, openInNewTab],
  );

  const pushChildPage = useCallback(
    (
      item: BreadcrumbStackItem,
      url: string,
      options?: {
        mode?: "push" | "replace";
        openMode?: DesktopNavigationOptions["openMode"];
      },
    ) => {
      if (options?.openMode === "new-tab") {
        openInNewTab(url, undefined, [...currentStack, item]);
        return;
      }

      if (!tabState.activeTabId) return;
      const store = tabStore.getState();
      if (options?.mode === "replace") {
        store.replaceNavigation(tabState.activeTabId, url, item);
      } else {
        store.pushNavigation(tabState.activeTabId, url, item);
      }
    },
    [currentStack, tabState.activeTabId, openInNewTab, tabStore],
  );

  const openWorkspaceSection = useCallback(
    (
      workspaceId: string,
      section: WorkspaceSection,
      options?: DesktopNavigationOptions,
    ) => {
      const url = registry.build(`/workspace/:workspaceId/${section}`, {
        workspaceId,
      });

      if (options?.stackMode === "push") {
        const entry = registry.getEntry(`/workspace/:workspaceId/${section}`);
        const leaf = entry
          ? buildBreadcrumbItem(entry, { workspaceId })
          : buildNavigateLeaf(url);
        pushChildPage(leaf, url, { mode: "push" });
        return;
      }

      if (options?.openMode === "new-tab") {
        openInNewTab(url);
        return;
      }
      navigateReset(url);
    },
    [navigateReset, openInNewTab, pushChildPage],
  );

  const openWorkspaceAgentList = useCallback(
    (workspaceId: string, options?: DesktopNavigationOptions) => {
      openWorkspaceSection(workspaceId, "agent", options);
    },
    [openWorkspaceSection],
  );

  const openWorkspaceAgentDetail = useCallback(
    (
      workspaceId: string,
      agentId: string,
      options?: DesktopNavigationOptions,
    ) => {
      const url = registry.build("/workspace/:workspaceId/agent/:agentId", {
        workspaceId,
        agentId,
      });
      const headers: NavigateHeaders = {
        label: options?.title ?? agentId,
        icon: options?.icon ?? { type: "lucide", value: "bot" },
        meta: { workspaceId, agentId },
      };

      if (options?.openMode === "new-tab") {
        const stack =
          options?.breadcrumbStack ?? buildColdStartBreadcrumb(url, headers);
        openInNewTab(url, headers, stack);
        return;
      }

      if (options?.breadcrumbStack) {
        if (!tabState.activeTabId) return;
        const store = tabStore.getState();
        store.resetNavigation(
          tabState.activeTabId,
          url,
          options.breadcrumbStack,
        );
        return;
      }

      const sameWorkspace =
        !currentWorkspaceId || currentWorkspaceId === workspaceId;
      const stackMode =
        options?.stackMode ??
        (currentStack.length > 0 && sameWorkspace ? "push" : "open");

      if (stackMode === "open") {
        navigateReset(url, headers);
      } else if (stackMode === "replace") {
        navigateReplace(url, headers);
      } else {
        navigatePush(url, headers);
      }
    },
    [
      currentStack,
      currentWorkspaceId,
      navigatePush,
      navigateReset,
      navigateReplace,
      openInNewTab,
      tabState.activeTabId,
      tabStore,
    ],
  );

  const openWorkspaceExecutorDetail = useCallback(
    (
      workspaceId: string,
      executorType: string,
      options?: DesktopNavigationOptions,
    ) => {
      const url = registry.build(
        "/workspace/:workspaceId/executor/:executorType",
        {
          workspaceId,
          executorType,
        },
      );
      const headers: NavigateHeaders = {
        label: options?.title ?? executorType,
        icon: options?.icon ?? { type: "lucide", value: "terminal" },
        meta: { workspaceId, executorType },
      };

      if (options?.openMode === "new-tab") {
        const stack =
          options?.breadcrumbStack ?? buildColdStartBreadcrumb(url, headers);
        openInNewTab(url, headers, stack);
        return;
      }

      if (options?.breadcrumbStack) {
        if (!tabState.activeTabId) return;
        const store = tabStore.getState();
        store.resetNavigation(
          tabState.activeTabId,
          url,
          options.breadcrumbStack,
        );
        return;
      }

      const sameWorkspace =
        !currentWorkspaceId || currentWorkspaceId === workspaceId;
      const stackMode =
        options?.stackMode ??
        (currentStack.length > 0 && sameWorkspace ? "push" : "open");

      if (stackMode === "open") {
        navigateReset(url, headers);
      } else if (stackMode === "replace") {
        navigateReplace(url, headers);
      } else {
        navigatePush(url, headers);
      }
    },
    [
      currentStack,
      currentWorkspaceId,
      navigatePush,
      navigateReset,
      navigateReplace,
      openInNewTab,
      tabState.activeTabId,
      tabStore,
    ],
  );

  const openWorkspacePage = useCallback(
    (
      workspaceId: string,
      uid: string,
      options?: DesktopNavigationOptions,
    ) => {
      const url = registry.build("/workspace/:workspaceId/page/:uid", {
        workspaceId,
        uid,
      });

      const headers: NavigateHeaders | undefined =
        options?.title || options?.icon
          ? { label: options.title, icon: options.icon }
          : undefined;

      if (options?.openMode === "new-tab") {
        openInNewTab(url, headers, options?.breadcrumbStack);
        return;
      }

      if (options?.breadcrumbStack) {
        if (!tabState.activeTabId) return;
        const store = tabStore.getState();
        store.resetNavigation(
          tabState.activeTabId,
          url,
          options.breadcrumbStack,
        );
        return;
      }

      navigateReset(url, headers);
    },
    [navigateReset, openInNewTab, tabState.activeTabId, tabStore],
  );

  const pushWorkspaceAgentDetail = useCallback(
    (
      workspaceId: string,
      agentId: string,
      options?: {
        title?: string;
        icon?: IconData;
        mode?: "push" | "replace";
        openMode?: DesktopNavigationOptions["openMode"];
      },
    ) =>
      openWorkspaceAgentDetail(workspaceId, agentId, {
        title: options?.title,
        icon: options?.icon,
        openMode: options?.openMode,
        stackMode: options?.mode === "replace" ? "replace" : "push",
      }),
    [openWorkspaceAgentDetail],
  );

  const pushWorkspaceExecutorDetail = useCallback(
    (
      workspaceId: string,
      executorType: string,
      options?: {
        title?: string;
        icon?: IconData;
        mode?: "push" | "replace";
        openMode?: DesktopNavigationOptions["openMode"];
      },
    ) =>
      openWorkspaceExecutorDetail(workspaceId, executorType, {
        title: options?.title,
        icon: options?.icon,
        openMode: options?.openMode,
        stackMode: options?.mode === "replace" ? "replace" : "push",
      }),
    [openWorkspaceExecutorDetail],
  );

  const openWorkspaceWeb = useCallback(
    (
      workspaceId: string,
      input: { url: string; title?: string; webId?: string },
      options?: DesktopNavigationOptions,
    ) => {
      const title = input.title ?? safeHostname(input.url);
      const queryUrl = new URLSearchParams({ url: input.url, title });
      if (input.webId) queryUrl.set("web_id", input.webId);
      const url = `/workspace/${encodeURIComponent(workspaceId)}/web?${queryUrl.toString()}`;
      const headers: NavigateHeaders = {
        label: title,
        icon: { type: "lucide", value: "globe" },
        meta: { workspaceId, webId: input.webId, url: input.url },
      };

      if (options?.openMode === "new-tab") {
        openInNewTab(url, headers);
        return;
      }
      navigateReset(url, headers);
    },
    [navigateReset, openInNewTab],
  );

  const openSettings = useCallback(
    (
      section?: SettingsSection | string,
      options?: DesktopNavigationOptions,
    ) => {
      const normalizedSection = normalizeSettingsSection(section);
      const url = registry.build("/settings/:section", {
        section: normalizedSection,
      });

      if (options?.openMode === "new-tab") {
        openInNewTab(url);
        return;
      }
      if (options?.stackMode === "replace") {
        navigateReplace(url);
        return;
      }
      navigateReset(url);
    },
    [navigateReplace, navigateReset, openInNewTab],
  );

  const openAgentDetail = useCallback(
    (
      agentId: string,
      workspacePath?: string,
      options?: DesktopNavigationOptions,
    ) => {
      const params: Record<string, string> = { agentId };
      let url = registry.build("/agent/:agentId", params);
      if (workspacePath) {
        url += `?workspace_path=${encodeURIComponent(workspacePath)}`;
      }
      const headers: NavigateHeaders = {
        label: options?.title ?? agentId,
        icon: options?.icon ?? { type: "lucide", value: "bot" },
        meta: { agentId },
      };

      if (options?.openMode === "new-tab") {
        openInNewTab(url, headers, options?.breadcrumbStack);
        return;
      }

      if (options?.breadcrumbStack) {
        if (!tabState.activeTabId) return;
        const store = tabStore.getState();
        store.resetNavigation(
          tabState.activeTabId,
          url,
          options.breadcrumbStack,
        );
        return;
      }

      const sameWorkspace = currentStack.length > 0;
      const stackMode = options?.stackMode ?? (sameWorkspace ? "push" : "open");

      if (stackMode === "open") {
        navigateReset(url, headers);
      } else if (stackMode === "replace") {
        navigateReplace(url, headers);
      } else {
        navigatePush(url, headers);
      }
    },
    [
      currentStack,
      navigatePush,
      navigateReset,
      navigateReplace,
      openInNewTab,
      tabState.activeTabId,
      tabStore,
    ],
  );

  const openExecutorDetail = useCallback(
    (
      executorType: string,
      workspacePath?: string,
      options?: DesktopNavigationOptions,
    ) => {
      let url = registry.build("/executor/:executorType", { executorType });
      if (workspacePath) {
        url += `?workspace_path=${encodeURIComponent(workspacePath)}`;
      }
      const headers: NavigateHeaders = {
        label: options?.title ?? executorType,
        icon: options?.icon ?? { type: "lucide", value: "terminal" },
        meta: { executorType },
      };

      if (options?.openMode === "new-tab") {
        openInNewTab(url, headers, options?.breadcrumbStack);
        return;
      }

      if (options?.breadcrumbStack) {
        if (!tabState.activeTabId) return;
        const store = tabStore.getState();
        store.resetNavigation(
          tabState.activeTabId,
          url,
          options.breadcrumbStack,
        );
        return;
      }

      const sameWorkspace = currentStack.length > 0;
      const stackMode = options?.stackMode ?? (sameWorkspace ? "push" : "open");

      if (stackMode === "open") {
        navigateReset(url, headers);
      } else if (stackMode === "replace") {
        navigateReplace(url, headers);
      } else {
        navigatePush(url, headers);
      }
    },
    [
      currentStack,
      navigatePush,
      navigateReset,
      navigateReplace,
      openInNewTab,
      tabState.activeTabId,
      tabStore,
    ],
  );

  const openMcpServerDetail = useCallback(
    (
      serverName: string,
      input: { executorType: string; workspacePath?: string },
      options?: DesktopNavigationOptions,
    ) => {
      let url = registry.build("/mcp-server/:serverName", { serverName });
      const queryParams = new URLSearchParams();
      if (input.workspacePath)
        queryParams.set("workspace_path", input.workspacePath);
      queryParams.set("executor_type", input.executorType);
      const query = queryParams.toString();
      if (query) url += `?${query}`;

      const effectiveWorkspaceId =
        currentWorkspaceId ?? currentStack[0]?.meta?.workspaceId;
      const headers: NavigateHeaders = {
        label: serverName,
        icon: { type: "lucide", value: "server" },
        meta: {
          workspaceId: effectiveWorkspaceId,
          executorType: input.executorType,
        },
      };

      if (options?.openMode === "new-tab") {
        openInNewTab(url, headers, options?.breadcrumbStack);
        return;
      }

      if (options?.breadcrumbStack) {
        if (!tabState.activeTabId) return;
        const store = tabStore.getState();
        store.resetNavigation(
          tabState.activeTabId,
          url,
          options.breadcrumbStack,
        );
        return;
      }

      const sameWorkspace = currentStack.length > 0;
      const stackMode = options?.stackMode ?? (sameWorkspace ? "push" : "open");

      if (stackMode === "open") {
        navigateReset(url, headers);
      } else if (stackMode === "replace") {
        navigateReplace(url, headers);
      } else {
        navigatePush(url, headers);
      }
    },
    [
      currentStack,
      currentWorkspaceId,
      navigatePush,
      navigateReset,
      navigateReplace,
      openInNewTab,
      tabState.activeTabId,
      tabStore,
    ],
  );

  const openSubagentDetail = useCallback(
    (
      configId: string,
      input: { executorType: string; workspacePath?: string },
      options?: DesktopNavigationOptions,
    ) => {
      let url = registry.build("/subagent/:configId", { configId });
      const queryParams = new URLSearchParams();
      if (input.workspacePath)
        queryParams.set("workspace_path", input.workspacePath);
      queryParams.set("executor_type", input.executorType);
      const query = queryParams.toString();
      if (query) url += `?${query}`;

      const effectiveWorkspaceId =
        currentWorkspaceId ?? currentStack[0]?.meta?.workspaceId;
      const headers: NavigateHeaders = {
        label: configId,
        icon: { type: "lucide", value: "bot" },
        meta: {
          workspaceId: effectiveWorkspaceId,
          executorType: input.executorType,
        },
      };

      if (options?.openMode === "new-tab") {
        openInNewTab(url, headers, options?.breadcrumbStack);
        return;
      }

      if (options?.breadcrumbStack) {
        if (!tabState.activeTabId) return;
        const store = tabStore.getState();
        store.resetNavigation(
          tabState.activeTabId,
          url,
          options.breadcrumbStack,
        );
        return;
      }

      const sameWorkspace = currentStack.length > 0;
      const stackMode = options?.stackMode ?? (sameWorkspace ? "push" : "open");

      if (stackMode === "open") {
        navigateReset(url, headers);
      } else if (stackMode === "replace") {
        navigateReplace(url, headers);
      } else {
        navigatePush(url, headers);
      }
    },
    [
      currentStack,
      currentWorkspaceId,
      navigatePush,
      navigateReset,
      navigateReplace,
      openInNewTab,
      tabState.activeTabId,
      tabStore,
    ],
  );

  const openPromptDetail = useCallback(
    (
      promptId: string,
      input: { executorType: string; workspacePath?: string },
      options?: DesktopNavigationOptions,
    ) => {
      let url = registry.build("/prompt/:promptId", { promptId });
      const queryParams = new URLSearchParams();
      if (input.workspacePath)
        queryParams.set("workspace_path", input.workspacePath);
      queryParams.set("executor_type", input.executorType);
      const query = queryParams.toString();
      if (query) url += `?${query}`;

      const effectiveWorkspaceId =
        currentWorkspaceId ?? currentStack[0]?.meta?.workspaceId;
      const headers: NavigateHeaders = {
        label: promptId,
        icon: { type: "lucide", value: "quote" },
        meta: {
          workspaceId: effectiveWorkspaceId,
          executorType: input.executorType,
        },
      };

      if (options?.openMode === "new-tab") {
        openInNewTab(url, headers, options?.breadcrumbStack);
        return;
      }

      if (options?.breadcrumbStack) {
        if (!tabState.activeTabId) return;
        const store = tabStore.getState();
        store.resetNavigation(
          tabState.activeTabId,
          url,
          options.breadcrumbStack,
        );
        return;
      }

      const sameWorkspace = currentStack.length > 0;
      const stackMode = options?.stackMode ?? (sameWorkspace ? "push" : "open");

      if (stackMode === "open") {
        navigateReset(url, headers);
      } else if (stackMode === "replace") {
        navigateReplace(url, headers);
      } else {
        navigatePush(url, headers);
      }
    },
    [
      currentStack,
      currentWorkspaceId,
      navigatePush,
      navigateReset,
      navigateReplace,
      openInNewTab,
      tabState.activeTabId,
      tabStore,
    ],
  );

  const openCommandDetail = useCallback(
    (
      commandId: string,
      input: { executorType: string; workspacePath?: string },
      options?: DesktopNavigationOptions,
    ) => {
      let url = registry.build("/command/:commandId", { commandId });
      const queryParams = new URLSearchParams();
      if (input.workspacePath)
        queryParams.set("workspace_path", input.workspacePath);
      queryParams.set("executor_type", input.executorType);
      const query = queryParams.toString();
      if (query) url += `?${query}`;

      const effectiveWorkspaceId =
        currentWorkspaceId ?? currentStack[0]?.meta?.workspaceId;
      const headers: NavigateHeaders = {
        label: commandId,
        icon: { type: "lucide", value: "terminal" },
        meta: {
          workspaceId: effectiveWorkspaceId,
          executorType: input.executorType,
        },
      };

      if (options?.openMode === "new-tab") {
        openInNewTab(url, headers, options?.breadcrumbStack);
        return;
      }

      if (options?.breadcrumbStack) {
        if (!tabState.activeTabId) return;
        const store = tabStore.getState();
        store.resetNavigation(
          tabState.activeTabId,
          url,
          options.breadcrumbStack,
        );
        return;
      }

      const sameWorkspace = currentStack.length > 0;
      const stackMode = options?.stackMode ?? (sameWorkspace ? "push" : "open");

      if (stackMode === "open") {
        navigateReset(url, headers);
      } else if (stackMode === "replace") {
        navigateReplace(url, headers);
      } else {
        navigatePush(url, headers);
      }
    },
    [
      currentStack,
      currentWorkspaceId,
      navigatePush,
      navigateReset,
      navigateReplace,
      openInNewTab,
      tabState.activeTabId,
      tabStore,
    ],
  );

  const openDocuments = useCallback(
    (options?: DesktopNavigationOptions) => {
      const url = "/documents";
      if (options?.openMode === "new-tab") {
        openInNewTab(url);
        return;
      }
      navigateReset(url);
    },
    [navigateReset, openInNewTab],
  );

  const openDevicePair = useCallback(
    (options?: DesktopNavigationOptions) => {
      const url = "/devices/pair";
      if (options?.openMode === "new-tab") {
        openInNewTab(url);
        return;
      }
      navigateReset(url);
    },
    [navigateReset, openInNewTab],
  );

  const openDashboard = useCallback(
    (options?: DesktopNavigationOptions) => {
      openPath("/mcp-services/dashboard", {
        title: t("nav.dashboard", "Dashboard"),
        icon: { type: "lucide", value: "layout-dashboard" },
        descriptorId: "mcp-dashboard",
        openMode: options?.openMode,
      });
    },
    [openPath, t],
  );

  const openSkillsMarket = useCallback(
    (options?: DesktopNavigationOptions) => {
      openPath("/skills-market", {
        title: t("nav.skillsMarket", "Skills Market"),
        icon: { type: "lucide", value: "sparkles" },
        descriptorId: "skills-market",
        openMode: options?.openMode,
      });
    },
    [openPath, t],
  );

  const openSkillDetail = useCallback(
    (
      skillId: string,
      input: { agentId: string; workspacePath?: string; title?: string },
      options?: DesktopNavigationOptions,
    ) => {
      let url = registry.build("/skill/:skillId", { skillId });
      const queryParams = new URLSearchParams();
      if (input.workspacePath)
        queryParams.set("workspace_path", input.workspacePath);
      queryParams.set("agent_id", input.agentId);
      const query = queryParams.toString();
      if (query) url += `?${query}`;

      const effectiveWorkspaceId =
        currentWorkspaceId ?? currentStack[0]?.meta?.workspaceId;
      const headers: NavigateHeaders = {
        label: input.title ?? skillId,
        icon: { type: "lucide", value: "sparkles" },
        meta: { workspaceId: effectiveWorkspaceId, agentId: input.agentId },
      };

      if (options?.openMode === "new-tab") {
        openInNewTab(url, headers, options?.breadcrumbStack);
        return;
      }

      if (options?.breadcrumbStack) {
        if (!tabState.activeTabId) return;
        const store = tabStore.getState();
        store.resetNavigation(
          tabState.activeTabId,
          url,
          options.breadcrumbStack,
        );
        return;
      }

      const sameWorkspace = currentStack.length > 0;
      const stackMode = options?.stackMode ?? (sameWorkspace ? "push" : "open");

      if (stackMode === "open") {
        navigateReset(url, headers);
      } else if (stackMode === "replace") {
        navigateReplace(url, headers);
      } else {
        navigatePush(url, headers);
      }
    },
    [
      currentStack,
      currentWorkspaceId,
      navigatePush,
      navigateReset,
      navigateReplace,
      openInNewTab,
      tabState.activeTabId,
      tabStore,
    ],
  );

  const pushCurrentPageChild = useCallback(
    (
      uid: string,
      options?: { title?: string; icon?: IconData; mode?: "push" | "replace" },
    ) => {
      if (!currentWorkspaceId) return;

      const url = registry.build("/workspace/:workspaceId/page/:uid", {
        workspaceId: currentWorkspaceId,
        uid,
      });
      const leaf = buildNavigateLeaf(url, {
        label: options?.title ?? uid,
        icon: options?.icon,
        meta: { workspaceId: currentWorkspaceId, pageUid: uid },
      });

      pushChildPage(leaf, url, { mode: options?.mode });
    },
    [currentWorkspaceId, pushChildPage],
  );

  const openCurrentPageWeb = useCallback(
    (
      webUrl: string,
      input?: {
        title?: string;
        icon?: IconData;
        webId?: string;
        mode?: "push" | "replace";
      },
    ) => {
      const workspaceId =
        currentWorkspaceId ?? tabState.activeTab?.meta?.workspaceId ?? "global";
      const title = input?.title ?? safeHostname(webUrl);

      // Determine source page uid from current URL
      let sourcePageUid: string | undefined;
      if (currentUrl) {
        const match = registry.match(currentUrl);
        if (match?.pattern === "/workspace/:workspaceId/page/:uid") {
          sourcePageUid = match.params.uid;
        } else if (match?.pattern === "/workspace/:workspaceId/web") {
          // Propagate source_page from current web view
          const parsed = new URL(currentUrl, "http://localhost");
          sourcePageUid = parsed.searchParams.get("source_page") ?? undefined;
        }
      }

      const queryParams = new URLSearchParams({ url: webUrl, title });
      if (sourcePageUid) queryParams.set("source_page", sourcePageUid);
      if (input?.webId) queryParams.set("web_id", input.webId);
      const url = `/workspace/${encodeURIComponent(workspaceId)}/web?${queryParams.toString()}`;

      const leaf = buildNavigateLeaf(url, {
        label: title,
        icon: input?.icon ?? { type: "lucide", value: "globe" },
        meta: { workspaceId, webId: input?.webId, url: webUrl },
      });

      pushChildPage(leaf, url, { mode: input?.mode });
    },
    [
      currentUrl,
      currentWorkspaceId,
      tabState.activeTab?.meta?.workspaceId,
      pushChildPage,
    ],
  );

  const handleDeepLink = useCallback(
    (intent: DesktopDeepLinkIntent) => {
      openRoute(intent.url, { openMode: intent.openMode });
    },
    [openRoute],
  );

  const closeCurrentTab = useCallback(() => {
    if (!tabState.activeTabId) return;
    tabActions.closeTab(tabState.activeTabId);
  }, [tabActions, tabState.activeTabId]);

  const detachCurrentTabToNewWindow = useCallback(async () => {
    if (!tabState.activeTabId) return false;
    return tabActions.detachTabToNewWindow(tabState.activeTabId);
  }, [tabActions, tabState.activeTabId]);

  const popToBreadcrumb = useCallback(
    (index: number) => {
      tabActions.popTo(index);
    },
    [tabActions],
  );

  const clearHeaderSlots = useCallback(() => {
    shell?.clearSlotContent(ownerId);
  }, [ownerId, shell]);

  const setHeaderCenter = useCallback(
    (content: ReactNode | null) => {
      shell?.setCenterContent(ownerId, content);
    },
    [ownerId, shell],
  );

  const setHeaderRight = useCallback(
    (content: ReactNode | null) => {
      shell?.setRightContent(ownerId, content);
    },
    [ownerId, shell],
  );

  useEffect(
    () => () => {
      shell?.clearSlotContent(ownerId);
    },
    [ownerId, shell],
  );

  return useMemo(
    () => ({
      currentTab: tabState.activeTab,
      currentUrl,
      currentStack,
      breadcrumb: currentStack,
      currentDescriptor,
      currentWorkspaceId,
      currentWorkspace,

      openWorkspaceHome,
      openWorkspacePages,
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

      canGoBack: tabState.canGoBack,
      canGoForward: tabState.canGoForward,
      goBack: tabNav.goBackInTab,
      goForward: tabNav.goForwardInTab,
      closeCurrentTab,
      detachCurrentTabToNewWindow,
      popToBreadcrumb,

      setHeaderCenter,
      setHeaderRight,
      clearHeaderSlots,
      headerCenter: null,
      headerRight: null,
    }),
    [
      clearHeaderSlots,
      closeCurrentTab,
      detachCurrentTabToNewWindow,
      currentDescriptor,
      currentUrl,
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
      openWorkspacePages,
      openWorkspacePage,
      pushWorkspaceAgentDetail,
      openWorkspaceSection,
      openWorkspaceWeb,
      tabState.activeTab,
      tabState.canGoBack,
      tabState.canGoForward,
      tabNav.goBackInTab,
      tabNav.goForwardInTab,
      popToBreadcrumb,
      pushChildPage,
      pushCurrentPageChild,
      setHeaderCenter,
      setHeaderRight,
    ],
  );
}

export function useDesktopRoutingHeaderSync(
  routing: Pick<
    DesktopRoutingApi,
    "setHeaderCenter" | "setHeaderRight" | "clearHeaderSlots"
  >,
  centerContent: ReactNode | null | undefined,
  rightContent: ReactNode | null | undefined,
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
  api: Pick<DesktopRoutingApi, "openWorkspaceSection">,
) {
  api.openWorkspaceSection(workspaceId, normalizeWorkspaceSection(routePath));
}
