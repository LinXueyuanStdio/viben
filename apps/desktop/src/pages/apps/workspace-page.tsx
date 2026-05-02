/**
 * Workspace Page Detail Route
 *
 * Route component for viewing a specific page within a workspace.
 * URL format: /workspace/page?workspace_id=<id>&page_path=pages/<slug>/SKILL.md
 */

import { useMemo, useState, useCallback } from "react";
import { useSearchParams, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Loader2,
  FileQuestion,
  ArrowLeft,
  FileCode,
  FileText,
  Eye,
  ExternalLink,
  Maximize2,
  Minimize2,
  RefreshCw,
  Square,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PageWrapper } from "@/components/layout";
import { WorkspaceHeader } from "@/components/workspace";
import { PagePreview } from "./components";
import type { PageViewMode } from "./components/page-preview";
import { useLocalWorkspaces } from "@/hooks/use-workspaces";
import { usePage } from "@/hooks/use-pages";
import { useDesktopRouting } from "@/hooks/use-desktop-routing";
import { useVitePreview } from "@/hooks/use-vite-preview";
import { getGatewayUrl } from "@/lib/gateway/config";
import {
  buildFallbackDesktopSegment,
  stackToDesktopSegments,
  type DesktopBreadcrumbSegment,
} from "@/navigation/page-index";

/**
 * Extract slug from page path
 * Format: pages/<slug>/SKILL.md -> <slug>
 * Slug can be nested: pages/parent/child/SKILL.md -> parent/child
 */
function extractSlugFromPath(pagePath: string | null): string | null {
  if (!pagePath) return null;

  // Match pattern: pages/<slug>/SKILL.md (slug can contain slashes for nested pages)
  const match = pagePath.match(/^pages\/(.+)\/SKILL\.md$/);
  if (match) {
    return match[1];
  }

  // Fallback: try to extract from other patterns
  // pages/<slug> -> <slug>
  if (pagePath.startsWith("pages/")) {
    const slug = pagePath.slice(6); // Remove "pages/" prefix
    // Remove trailing /SKILL.md if present
    return slug.replace(/\/SKILL\.md$/, "");
  }

  return null;
}

/**
 * Get the gateway URL for serving a page
 */
function getPageServeUrl(workspacePath: string, slug: string): string {
  const baseUrl = getGatewayUrl();
  const params = new URLSearchParams({
    workspace_path: workspacePath,
    slug: slug,
  });
  return `${baseUrl}/api/page/serve?${params.toString()}`;
}

/**
 * Toolbar for page preview — rendered inside WorkspaceHeader's rightContent.
 * Layout: [view toggle] [status dot] [action buttons]
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
  isFullscreen,
  onToggleFullscreen,
}: {
  page: { type: string; name: string };
  viewMode: PageViewMode;
  onViewModeChange: (mode: PageViewMode) => void;
  livePreviewStatus: string;
  livePreviewUrl?: string | null;
  gatewayServeUrl: string | null;
  onStopLivePreview?: () => void;
  onRefresh: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}) {
  const { t } = useTranslation();
  const isServerType = page.type === "server";
  const showViewToggle = page.type !== "markdown";

  const getStatusColor = () => {
    if (viewMode === "skill") return "bg-gray-400";
    if (viewMode === "page" && isServerType) {
      switch (livePreviewStatus) {
        case "running":
          return "bg-green-500";
        case "starting":
          return "animate-pulse bg-yellow-500";
        case "error":
          return "bg-red-500";
        default:
          return "bg-gray-400";
      }
    }
    return "bg-gray-400";
  };

  const getStatusText = () => {
    if (viewMode === "skill") return "";
    if (viewMode === "page" && isServerType) {
      switch (livePreviewStatus) {
        case "running":
          return t("preview.running", "Running");
        case "starting":
          return t("preview.starting", "Starting...");
        case "error":
          return t("preview.error", "Error");
        default:
          return t("preview.stopped", "Stopped");
      }
    }
    return "";
  };

  const handleOpenExternal = useCallback(async () => {
    const url = viewMode === "page" && page.type === "server" ? livePreviewUrl : gatewayServeUrl;
    if (url) {
      try {
        const { openUrl } = await import("@tauri-apps/plugin-opener");
        await openUrl(url);
      } catch {
        window.open(url, "_blank");
      }
    }
  }, [viewMode, page.type, livePreviewUrl, gatewayServeUrl]);

  const handleDevTools = useCallback(() => {
    console.log("DevTools clicked");
  }, []);

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
            {t("page.viewPage", "页面")}
          </button>
        </div>
      )}

      {/* Status indicator (server type in page view) */}
      {viewMode === "page" && isServerType && (
        <div className="flex items-center gap-1.5">
          <div className={cn("h-2 w-2 rounded-full", getStatusColor())} />
          <span className="text-xs text-muted-foreground">{getStatusText()}</span>
        </div>
      )}

      {/* Action buttons */}
      {viewMode === "page" && (
        <>
          <button
            onClick={onRefresh}
            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            title={t("common.refresh")}
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={handleDevTools}
            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            title={t("page.devTools", "DevTools")}
          >
            <Wrench className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={handleOpenExternal}
            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            title={t("preview.openInNewTab")}
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </button>
        </>
      )}

      <button
        onClick={onToggleFullscreen}
        className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        title={isFullscreen ? t("preview.exitFullscreen") : t("preview.fullscreen")}
      >
        {isFullscreen ? (
          <Minimize2 className="h-3.5 w-3.5" />
        ) : (
          <Maximize2 className="h-3.5 w-3.5" />
        )}
      </button>

      {/* Stop server (only for server type when running) */}
      {viewMode === "page" && isServerType && livePreviewStatus === "running" && onStopLivePreview && (
        <button
          onClick={onStopLivePreview}
          className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-950"
          title={t("preview.stopServer")}
        >
          <Square className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

export function WorkspacePage() {
  const { t } = useTranslation();
  const params = useParams<{ workspaceId?: string; "*": string | undefined }>();
  const [searchParams] = useSearchParams();
  const { getWorkspace, isLoading: isLoadingWorkspaces, workspaces } = useLocalWorkspaces();
  const {
    currentStack,
    openDashboard,
    openWorkspacePage,
    openWorkspaceWeb,
    openWorkspaceSection,
  } = useDesktopRouting();

  const routeWorkspaceId = params.workspaceId;
  const routeSlug = params["*"]?.trim() || null;
  const legacyWorkspaceId = searchParams.get("workspace_id");
  const pagePath = searchParams.get("page_path");
  const viewParam = searchParams.get("view") as PageViewMode | null;
  const workspaceId = routeWorkspaceId ?? legacyWorkspaceId;
  const slug = useMemo(
    () => routeSlug ?? extractSlugFromPath(pagePath),
    [pagePath, routeSlug]
  );

  // View mode state — default to "page" (preview), URL param can override
  const initialViewMode: PageViewMode = useMemo(() => {
    if (viewParam === "skill" || viewParam === "page") {
      return viewParam;
    }
    return "page";
  }, [viewParam]);

  const [viewMode, setViewMode] = useState<PageViewMode>(initialViewMode);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);

  // Get workspace
  const workspace = workspaceId ? getWorkspace(workspaceId) : undefined;

  // Fetch page data
  const {
    data: page,
    isLoading: isLoadingPage,
    error: pageError,
  } = usePage(workspace?.path, slug ?? undefined);

  // Generate page ID for preview
  const pageId = useMemo(() => {
    if (!page?.slug) return null;
    return `page-${page.slug}`;
  }, [page?.slug]);

  // Setup Vite preview for server-type pages
  const {
    previewUrl,
    status: previewStatus,
    error: previewError,
    startPreview,
    stopPreview,
  } = useVitePreview(pageId);

  // Gateway serve URL
  const gatewayServeUrl = useMemo(() => {
    if (!workspace?.path || !page?.slug) return null;
    return getPageServeUrl(workspace.path, page.slug);
  }, [workspace?.path, page?.slug]);

  // Handler to start live preview
  const handleStartLivePreview = () => {
    if (!workspace?.path || !page) return;
    const pageDir = `${workspace.path}/pages/${page.slug}`;
    startPreview(pageDir);
  };

  // Portal target for editor header buttons (rendered in breadcrumb bar)
  // Use callback ref to trigger re-render when the DOM element mounts
  const [editorHeaderEl, setEditorHeaderEl] = useState<HTMLDivElement | null>(null);

  const pageHeaderSegments = useMemo<DesktopBreadcrumbSegment[]>(() => {
    const stackSegments = stackToDesktopSegments(currentStack);
    if (stackSegments.length > 0) {
      return stackSegments;
    }

    if (!workspaceId || !slug) {
      return [];
    }

    return [
      buildFallbackDesktopSegment({
        id: `${workspaceId}:page:${slug}`,
        label: page?.name ?? slug.split("/").filter(Boolean).pop() ?? slug,
        location: {
          kind: "workspace-page",
          workspaceId,
          pageSlug: slug,
        },
        kind: "workspace-page",
        icon: page?.icon ?? { type: "lucide", value: "file-text" },
        meta: {
          workspaceId,
          pageSlug: slug,
        },
      }),
    ];
  }, [currentStack, page?.icon, page?.name, slug, workspaceId]);

  const handleRefresh = useCallback(() => {
    setIframeKey((k) => k + 1);
  }, []);

  const handleOpenPage = useCallback(
    (nextPageSlug: string) => {
      if (!workspaceId) return;
      openWorkspacePage(workspaceId, nextPageSlug);
    },
    [openWorkspacePage, workspaceId]
  );

  const handleOpenWeb = useCallback(
    (url: string, title?: string) => {
      if (!workspaceId) return;
      openWorkspaceWeb(workspaceId, {
        url,
        title,
      });
    },
    [openWorkspaceWeb, workspaceId]
  );

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

  // Invalid page path
  if (!slug) {
    return (
      <PageWrapper className="flex flex-col h-full">
        <WorkspaceHeader
          workspace={workspace}
          segments={pageHeaderSegments}
          showRemove={false}
          showRefresh={false}
        />
        <div className="flex flex-col items-center justify-center flex-1">
          <FileQuestion className="h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">
            {t("page.invalidPath", "Invalid Page Path")}
          </h2>
          <p className="text-muted-foreground mb-4 text-center max-w-md">
            {t("page.invalidPathDesc", "The page path format is invalid.")}
          </p>
          {pagePath && (
            <p className="text-xs text-muted-foreground/70 mb-4 font-mono bg-muted px-3 py-1.5 rounded">
              {pagePath}
            </p>
          )}
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

  // Render page preview — single-row header: [breadcrumb][ ][toggle][actions]
  return (
    <PageWrapper className={cn("flex flex-col h-full", isFullscreen && "fixed inset-0 z-50")}>
      <WorkspaceHeader
        workspace={workspace}
        segments={pageHeaderSegments}
        showRemove={false}
        showRefresh={false}
        rightContent={
          <div className="flex items-center gap-2">
            <div ref={setEditorHeaderEl} />
            <PageToolbar
              page={page}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              livePreviewStatus={previewStatus}
              livePreviewUrl={previewUrl}
              gatewayServeUrl={gatewayServeUrl}
              onStopLivePreview={stopPreview}
              onRefresh={handleRefresh}
              isFullscreen={isFullscreen}
              onToggleFullscreen={() => setIsFullscreen(!isFullscreen)}
            />
          </div>
        }
      />
      <div className="flex-1 overflow-hidden">
        <PagePreview
          page={page}
          workspacePath={workspace.path}
          workspaceId={workspace.id}
          viewMode={viewMode}
          iframeKey={iframeKey}
          livePreviewUrl={previewUrl}
          livePreviewStatus={previewStatus}
          livePreviewError={previewError}
          onStartLivePreview={handleStartLivePreview}
          onStopLivePreview={stopPreview}
          onOpenPage={handleOpenPage}
          onOpenWeb={handleOpenWeb}
          headerPortal={editorHeaderEl}
          className="h-full"
        />
      </div>
    </PageWrapper>
  );
}

export default WorkspacePage;
