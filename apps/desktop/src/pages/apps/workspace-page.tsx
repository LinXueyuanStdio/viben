/**
 * Workspace Page Detail Route
 *
 * Route component for viewing a specific page within a workspace.
 * URL format: /workspace/:workspaceId/page/:uid
 */

import { useMemo, useState, useCallback } from "react";
import { useSearchParams, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  Loader2,
  FileQuestion,
  ArrowLeft,
  FileCode,
  FileText,
  Eye,
  ExternalLink,
  PanelTopOpen,
  Maximize2,
  Minimize2,
  RefreshCw,
  Square,
  MoreHorizontal,
  Pencil,
  CopyPlus,
  Code2,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PageWrapper } from "@/components/layout";
import { WorkspaceHeader } from "@/components/workspace";
import { toast } from "@/hooks/use-toast";
import { PagePreview, PageIconGrid } from "./components";
import { PageCodePanel } from "./components/page-code-panel";
import { PageSettingPanel } from "./components/page-setting-panel";
import { EditPageDialog } from "./components/edit-page-dialog";
import type { PageViewMode } from "./components/page-preview";
import { useLocalWorkspaces } from "@/hooks/use-workspaces";
import { usePage } from "@/hooks/use-pages";
import { useDesktopRouting } from "@/hooks/use-desktop-routing";
import { useVitePreview } from "@/hooks/use-vite-preview";
import type { ServerPageConfig, PageConfig } from "@/lib/gateway/types/page";
import { getGatewayUrl } from "@/lib/gateway/config";
import {
  resolveHeaderSegments,
  type DesktopBreadcrumbSegment,
} from "@/navigation/page-index";
import { buildColdStartBreadcrumb, registry } from "@/navigation/navigate";

/** Workspace page tab for server/static pages */
type WorkspacePageTab = "preview" | "code" | "setting";

/**
 * Extract uid from legacy page path
 * Format: pages/<uid>/SKILL.md -> <uid>
 */
function extractUidFromPath(pagePath: string | null): string | null {
  if (!pagePath) return null;

  // Match pattern: pages/<uid>/SKILL.md
  const match = pagePath.match(/^pages\/(.+)\/SKILL\.md$/);
  if (match) {
    return match[1];
  }

  // Fallback: try to extract from other patterns
  // pages/<uid> -> <uid>
  if (pagePath.startsWith("pages/")) {
    const uid = pagePath.slice(6); // Remove "pages/" prefix
    // Remove trailing /SKILL.md if present
    return uid.replace(/\/SKILL\.md$/, "");
  }

  return null;
}

/**
 * Get the gateway URL for serving a page
 */
function getPageServeUrl(workspacePath: string, uid: string): string {
  const baseUrl = getGatewayUrl();
  const params = new URLSearchParams({
    workspace_path: workspacePath,
    uid: uid,
  });
  return `${baseUrl}/api/page/serve?${params.toString()}`;
}

/**
 * Toolbar for page preview — rendered inside WorkspaceHeader's rightContent.
 * Layout: [view toggle] [status dot] [refresh] [more dropdown]
 */
function PageToolbar({
  page,
  viewMode,
  onViewModeChange,
  livePreviewStatus,
  livePreviewUrl,
  gatewayServeUrl,
  onStopLivePreview,
  onRefresh,
  onDetach,
  onOpenInNewWindow,
  isFullscreen,
  onToggleFullscreen,
  onEditConfig,
  onOpenInNewTab,
  hideViewToggle = false,
  hidePreviewActions = false,
}: {
  page: { type: string; name: string };
  viewMode: PageViewMode;
  onViewModeChange: (mode: PageViewMode) => void;
  livePreviewStatus: string;
  livePreviewUrl?: string | null;
  gatewayServeUrl: string | null;
  onStopLivePreview?: () => void;
  onRefresh: () => void;
  onDetach: () => void | Promise<void>;
  onOpenInNewWindow: () => void | Promise<void>;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onEditConfig: () => void;
  onOpenInNewTab: () => void;
  hideViewToggle?: boolean;
  hidePreviewActions?: boolean;
}) {
  const { t } = useTranslation();
  const isServerType = page.type === "server";
  const showViewToggle = !hideViewToggle && page.type !== "markdown";

  const handleOpenExternal = useCallback(async () => {
    const url = viewMode === "page" && page.type === "server" ? livePreviewUrl : gatewayServeUrl;
    if (url) {
      try {
        await openUrl(url);
      } catch {
        window.open(url, "_blank");
      }
    }
  }, [viewMode, page.type, livePreviewUrl, gatewayServeUrl]);

  return (
    <div className="flex items-center gap-2">
      {/* View mode toggle */}
      {showViewToggle && (
        <div className="flex items-center gap-1 rounded-lg bg-muted/50 p-1">
          <button
            onClick={() => onViewModeChange("skill")}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              viewMode === "skill"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <FileText className="h-3.5 w-3.5" />
            SKILL.md
          </button>
          <button
            onClick={() => onViewModeChange("page")}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              viewMode === "page"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Eye className="h-3.5 w-3.5" />
            {t("page.viewPage", "Page")}
          </button>
        </div>
      )}

      {/* Refresh button (standalone - most common action) */}
      {viewMode === "page" && !hidePreviewActions && (
        <button
          onClick={onRefresh}
          className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          title={t("common.refresh")}
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      )}

      {/* Fullscreen button */}
      {viewMode === "page" && !hidePreviewActions && (
        <button
          onClick={onToggleFullscreen}
          className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          title={isFullscreen ? t("page.exitFullscreen", "Exit Fullscreen") : t("page.fullscreen", "Fullscreen")}
        >
          {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
        </button>
      )}

      {/* Stop server button (server type when running) */}
      {viewMode === "page" && !hidePreviewActions && isServerType && livePreviewStatus === "running" && onStopLivePreview && (
        <button
          onClick={onStopLivePreview}
          className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-950"
          title={t("page.stopServer", "Stop Server")}
        >
          <Square className="h-3.5 w-3.5" />
        </button>
      )}

      {/* More actions dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            title={t("common.more", "More")}
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={onOpenInNewTab}>
            <CopyPlus className="mr-2 h-4 w-4" />
            {t("page.openInNewTab", "Open in New Tab")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => void onOpenInNewWindow()}>
            <PanelTopOpen className="mr-2 h-4 w-4" />
            {t("page.openInNewWindow", "Open in New Window")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => void onDetach()}>
            <PanelTopOpen className="mr-2 h-4 w-4" />
            {t("page.detachToNewWindow", "分离到新窗口")}
          </DropdownMenuItem>
          {viewMode === "page" && (
            <DropdownMenuItem onClick={handleOpenExternal}>
              <ExternalLink className="mr-2 h-4 w-4" />
              {t("page.openExternal", "Open in Browser")}
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onEditConfig}>
            <Pencil className="mr-2 h-4 w-4" />
            {t("page.editConfig", "Edit Page Settings")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function WorkspacePage() {
  const { t } = useTranslation();
  const params = useParams<{ workspaceId?: string; "*"?: string }>();
  const [searchParams] = useSearchParams();
  const { getWorkspace, isLoading: isLoadingWorkspaces, workspaces } = useLocalWorkspaces();
  const {
    currentStack,
    openDashboard,
    pushCurrentPageChild,
    openCurrentPageWeb,
    openWorkspaceSection,
    openWorkspacePage,
    closeCurrentTab,
  } = useDesktopRouting();

  const routeWorkspaceId = params.workspaceId;
  const routeUid = params["*"]?.trim() || null;
  const legacyWorkspaceId = searchParams.get("workspace_id");
  const pagePath = searchParams.get("page_path");
  const viewParam = searchParams.get("view") as PageViewMode | null;
  const focusParam = searchParams.get("focus");
  const workspaceId = routeWorkspaceId ?? legacyWorkspaceId;
  const uid = useMemo(
    () => routeUid ?? extractUidFromPath(pagePath),
    [pagePath, routeUid]
  );

  // View mode state — default to "page" (preview), URL param can override
  const initialViewMode: PageViewMode = useMemo(() => {
    if (viewParam === "skill" || viewParam === "page") {
      return viewParam;
    }
    return "page";
  }, [viewParam]);

  const [viewMode, setViewMode] = useState<PageViewMode>(initialViewMode);
  const [activeTab, setActiveTab] = useState<WorkspacePageTab>("preview");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  // Get workspace
  const workspace = workspaceId ? getWorkspace(workspaceId) : undefined;

  // Fetch page data
  const {
    data: page,
    isLoading: isLoadingPage,
    error: pageError,
  } = usePage(workspace?.path, uid ?? undefined);

  // Generate page ID for preview
  const pageId = useMemo(() => {
    if (!page?.uid) return null;
    return `page-${page.uid}`;
  }, [page?.uid]);

  // Setup Vite preview for server-type pages
  const {
    previewUrl,
    status: previewStatus,
    error: previewError,
    logs: previewLogs,
    retryAttempt: previewRetryAttempt,
    maxRetryAttempts: previewMaxRetryAttempts,
    portConflict,
    startPreview,
    stopPreview,
    killPortAndRetry,
    retryWithNewPort,
    dismissPortConflict,
  } = useVitePreview(pageId);

  // Gateway serve URL
  const gatewayServeUrl = useMemo(() => {
    if (!workspace?.path || !page?.uid) return null;
    return getPageServeUrl(workspace.path, page.uid);
  }, [workspace?.path, page?.uid]);

  // Handler to start live preview
  const handleStartLivePreview = () => {
    if (!workspace?.path || !page) return;
    const pageDir = `${workspace.path}/pages/${page.uid}`;
    const options = page.type === "server"
      ? {
          command: (page as ServerPageConfig).command,
          port: (page as ServerPageConfig).port,
          ready_pattern: (page as ServerPageConfig).ready_pattern,
          timeout: (page as ServerPageConfig).timeout,
        }
      : undefined;
    startPreview(pageDir, options);
  };

  // Portal target for editor header buttons (rendered in breadcrumb bar)
  // Use callback ref to trigger re-render when the DOM element mounts
  const [editorHeaderEl, setEditorHeaderEl] = useState<HTMLDivElement | null>(null);

  const pageHeaderSegments = useMemo<DesktopBreadcrumbSegment[]>(() => {
    if (!workspaceId || !uid) {
      return [];
    }

    const url = registry.build("/workspace/:workspaceId/page/:uid", {
      workspaceId,
      uid,
    });
    const stack = buildColdStartBreadcrumb(url, {
      label: page?.name ?? uid,
      icon: page?.icon,
    });

    return resolveHeaderSegments({
      stack: currentStack,
      fallback: stack.slice(1).map((item) => ({
        id: item.id,
        label: item.label,
        href: item.href ?? "#",
        icon: item.icon,
        meta: item.meta,
      })),
    });
  }, [currentStack, page, uid, workspaceId]);

  const handleRefresh = useCallback(() => {
    setIframeKey((k) => k + 1);
  }, []);

  const openPageInNewWindow = useCallback(async () => {
    const workspacePath = workspace?.path;
    if (!workspaceId || !workspacePath || !page?.uid) {
      toast.error(t("tabBar.detachUnavailable", "This tab cannot be detached"));
      return;
    }

    try {
      await invoke("open_workspace_page_preview_window", {
        workspaceId,
        workspacePath,
        uid: page.uid,
        title: page.name,
        view: viewMode,
      });
    } catch (error) {
      console.error("Failed to open page in new window:", error);
      toast.error(t("common.error"));
    }
  }, [page, t, viewMode, workspace?.path, workspaceId]);

  const handleDetach = useCallback(async () => {
    const workspacePath = workspace?.path;
    if (!workspaceId || !workspacePath || !page?.uid) {
      toast.error(t("tabBar.detachUnavailable", "This tab cannot be detached"));
      return;
    }

    try {
      await invoke("open_workspace_page_preview_window", {
        workspaceId,
        workspacePath,
        uid: page.uid,
        title: page.name,
        view: viewMode,
      });
      closeCurrentTab();
    } catch (error) {
      console.error("Failed to detach workspace page:", error);
      toast.error(t("common.error"));
    }
  }, [closeCurrentTab, page, t, viewMode, workspace?.path, workspaceId]);

  const handleOpenPage = useCallback(
    (nextPageSlug: string) => {
      if (!workspaceId) return;
      pushCurrentPageChild(nextPageSlug);
    },
    [pushCurrentPageChild, workspaceId]
  );

  const handleOpenWeb = useCallback(
    (url: string, title?: string) => {
      if (!workspaceId) return;
      openCurrentPageWeb(url, { title });
    },
    [openCurrentPageWeb, workspaceId]
  );

  const handleOpenInNewTab = useCallback(() => {
    if (!workspaceId || !uid) return;
    openWorkspacePage(workspaceId, uid, { openMode: "new-tab" });
  }, [openWorkspacePage, workspaceId, uid]);

  // Whether to show the tabbed interface (server, static, proxy pages)
  const showTabs = page?.type === "server" || page?.type === "static" || page?.type === "proxy";

  // Build tab list based on page type: proxy has no code/diff
  const tabList = useMemo(() => {
    const tabs: { key: WorkspacePageTab; icon: typeof Eye; label: string }[] = [
      { key: "preview", icon: Eye, label: t("page.tab.preview", "Preview") },
    ];
    if (page?.type !== "proxy") {
      tabs.push({ key: "code", icon: Code2, label: t("page.tab.code", "Code") });
    }
    tabs.push({ key: "setting", icon: Settings, label: t("page.tab.setting", "Setting") });
    return tabs;
  }, [page?.type, t]);

  // Center content: Tab list for tabbed pages, or nothing for other types (e.g. markdown)
  const centerContent = useMemo(() => {
    if (!showTabs) return undefined;

    return (
      <div className="flex items-center gap-1 rounded-lg bg-muted/50 p-1">
        {tabList.map(({ key, icon: Icon, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              activeTab === key
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>
    );
  }, [showTabs, tabList, activeTab]);

  // Loading state
  const isLoading = isLoadingWorkspaces || isLoadingPage;

  // Render loading state
  if (isLoading && !workspace) {
    return (
      <PageWrapper className="flex flex-col h-full">
        <div className="flex flex-col items-center justify-center h-full">
          <Loader2 className="h-12 w-12 animate-spin text-muted-foreground mb-4" />
          <p className="text-muted-foreground">{t("common.loading")}</p>
        </div>
      </PageWrapper>
    );
  }

  // Workspace not found
  if (!workspace && workspaces.length > 0) {
    return (
      <PageWrapper className="flex flex-col h-full">
        <div className="flex flex-col items-center justify-center h-full">
          <FileQuestion className="h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">
            {t("workspace.notFound")}
          </h2>
          <p className="text-muted-foreground mb-4">
            {t("workspace.notFoundDesc")}
          </p>
          <Button asChild>
            <button type="button" onClick={() => openDashboard()}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t("workspace.backToDashboard")}
            </button>
          </Button>
        </div>
      </PageWrapper>
    );
  }

  // Fallback loading state
  if (!workspace) {
    return (
      <PageWrapper className="flex flex-col h-full">
        <div className="flex flex-col items-center justify-center h-full">
          <Loader2 className="h-12 w-12 animate-spin text-muted-foreground mb-4" />
          <p className="text-muted-foreground">{t("common.loading")}</p>
        </div>
      </PageWrapper>
    );
  }

  // No uid — show pages listing
  if (!uid) {
    return (
      <PageWrapper className="flex flex-col h-full">
        <WorkspaceHeader
          workspace={workspace}
          segments={pageHeaderSegments}
          showRemove={false}
          showRefresh={false}
        />
        <div className="min-h-0 flex-1 bg-background">
          <PageIconGrid
            workspaceId={workspace.id}
            workspacePath={workspace.path}
          />
        </div>
      </PageWrapper>
    );
  }

  // Loading page
  if (isLoadingPage) {
    return (
      <PageWrapper className="flex flex-col h-full">
        <WorkspaceHeader
          workspace={workspace}
          segments={pageHeaderSegments}
          showRemove={false}
          showRefresh={false}
        />
        <div className="flex flex-col items-center justify-center flex-1">
          <Loader2 className="h-12 w-12 animate-spin text-muted-foreground mb-4" />
          <p className="text-muted-foreground">{t("common.loading")}</p>
        </div>
      </PageWrapper>
    );
  }

  // Page not found or error
  if (!page || pageError) {
    return (
      <PageWrapper className="flex flex-col h-full">
        <WorkspaceHeader
          workspace={workspace}
          segments={pageHeaderSegments}
          showRemove={false}
          showRefresh={false}
        />
        <div className="flex flex-col items-center justify-center flex-1">
          <FileCode className="h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">
            {t("page.notFound", "Page Not Found")}
          </h2>
          <p className="text-muted-foreground mb-4 text-center max-w-md">
            {pageError
              ? String(pageError)
              : t("page.notFoundDesc", "The requested page could not be found in this workspace.")}
          </p>
          <Button asChild>
            <button
              type="button"
              onClick={() => {
                if (workspaceId) {
                  openWorkspaceSection(workspaceId, "files");
                }
              }}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t("page.backToFiles", "Back to Files")}
            </button>
          </Button>
        </div>
      </PageWrapper>
    );
  }

  // Render the active tab content panel
  const renderTabContent = () => {
    if (!showTabs || activeTab === "preview") {
      return (
        <div className="flex-1 overflow-hidden">
          <PagePreview
            page={page}
            workspacePath={workspace.path}
            workspaceId={workspace.id}
            viewMode={showTabs ? "page" : viewMode}
            iframeKey={iframeKey}
            livePreviewUrl={previewUrl}
            livePreviewStatus={previewStatus}
            livePreviewError={previewError}
            livePreviewLogs={previewLogs}
            livePreviewRetryAttempt={previewRetryAttempt}
            livePreviewMaxRetryAttempts={previewMaxRetryAttempts}
            onStartLivePreview={handleStartLivePreview}
            onStopLivePreview={stopPreview}
            onOpenPage={handleOpenPage}
            onOpenWeb={handleOpenWeb}
            autoFocusTitle={focusParam === "title"}
            headerPortal={editorHeaderEl}
            className="h-full"
          />
        </div>
      );
    }

    if (activeTab === "code") {
      return (
        <div className="flex-1 overflow-hidden">
          <PageCodePanel
            workspacePath={workspace.path}
            pageUid={page.uid}
            className="h-full"
          />
        </div>
      );
    }

    if (activeTab === "setting") {
      return (
        <div className="flex-1 overflow-hidden">
          <PageSettingPanel
            workspacePath={workspace.path}
            pageUid={page.uid}
            pageName={page.name}
            pageType={page.type}
            className="h-full"
          />
        </div>
      );
    }

    return null;
  };

  // Render page — single-row header: [breadcrumb][ ][tabs/toggle][actions]
  const content = (
    <PageWrapper className="flex flex-col h-full">
      <WorkspaceHeader
        workspace={workspace}
        segments={pageHeaderSegments}
        showRemove={false}
        showRefresh={false}
        centerContent={centerContent}
        rightContent={
          <div className="flex items-center gap-2">
            <div ref={setEditorHeaderEl} />
            <PageToolbar
              page={page}
              viewMode={showTabs ? "page" : viewMode}
              onViewModeChange={setViewMode}
              livePreviewStatus={previewStatus}
              livePreviewUrl={previewUrl}
              gatewayServeUrl={gatewayServeUrl}
              onStopLivePreview={stopPreview}
              onRefresh={handleRefresh}
              onDetach={handleDetach}
              onOpenInNewWindow={openPageInNewWindow}
              isFullscreen={isFullscreen}
              onToggleFullscreen={() => setIsFullscreen(!isFullscreen)}
              onEditConfig={() => setEditDialogOpen(true)}
              onOpenInNewTab={handleOpenInNewTab}
              hideViewToggle={showTabs}
              hidePreviewActions={showTabs && activeTab !== "preview"}
            />
          </div>
        }
      />
      {renderTabContent()}
    </PageWrapper>
  );

  const editDialog = (
    <EditPageDialog
      open={editDialogOpen}
      onOpenChange={setEditDialogOpen}
      page={page as PageConfig}
      workspacePath={workspace.path}
    />
  );

  const portConflictDialog = portConflict && (
    <PortConflictDialog
      port={portConflict.port}
      onKillAndRetry={killPortAndRetry}
      onUseNewPort={retryWithNewPort}
      onCancel={dismissPortConflict}
    />
  );

  if (isFullscreen) {
    return (
      <>
        <div className="absolute inset-0 z-50 bg-background">
          {content}
        </div>
        {editDialog}
        {portConflictDialog}
      </>
    );
  }

  return (
    <>
      {content}
      {editDialog}
      {portConflictDialog}
    </>
  );
}

/**
 * Dialog shown when a port conflict is detected during preview start
 */
function PortConflictDialog({
  port,
  onKillAndRetry,
  onUseNewPort,
  onCancel,
}: {
  port: number;
  onKillAndRetry: () => void;
  onUseNewPort: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();

  return (
    <AlertDialog open>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t("page.portConflict.title", "Port {{port}} is in use", { port })}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t(
              "page.portConflict.description",
              "Another process is already using port {{port}}. How would you like to proceed?",
              { port }
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
          <AlertDialogCancel onClick={onCancel}>
            {t("common.cancel", "Cancel")}
          </AlertDialogCancel>
          <AlertDialogAction onClick={onUseNewPort} className="bg-secondary text-secondary-foreground hover:bg-secondary/80">
            {t("page.portConflict.useNewPort", "Use another port")}
          </AlertDialogAction>
          <AlertDialogAction onClick={onKillAndRetry}>
            {t("page.portConflict.killAndRetry", "Kill process & retry")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default WorkspacePage;
