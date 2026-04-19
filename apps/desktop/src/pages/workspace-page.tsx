/**
 * Workspace Page Detail Route
 *
 * Route component for viewing a specific page within a workspace.
 * URL format: /workspace/page?workspace_id=<id>&page_path=pages/<slug>/SKILL.md
 */

import { useMemo, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Loader2, FileQuestion, ArrowLeft, FileCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageWrapper } from "@/components/layout";
import { WorkspaceHeader } from "@/components/workspace";
import { PagePreview } from "@/components/page";
import type { PageViewMode } from "@/components/page/page-preview";
import { useLocalWorkspaces } from "@/hooks/use-workspaces";
import { usePage } from "@/hooks/use-pages";
import { useVitePreview } from "@/hooks/use-vite-preview";

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

export function WorkspacePage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const { getWorkspace, isLoading: isLoadingWorkspaces, workspaces } = useLocalWorkspaces();

  // Parse URL parameters
  const workspaceId = searchParams.get("workspace_id");
  const pagePath = searchParams.get("page_path");
  const viewParam = searchParams.get("view") as PageViewMode | null;
  const slug = useMemo(() => extractSlugFromPath(pagePath), [pagePath]);

  // Validate view parameter (default to "skill" if invalid)
  const initialViewMode: PageViewMode = useMemo(() => {
    if (viewParam === "skill" || viewParam === "page") {
      return viewParam;
    }
    return "skill";
  }, [viewParam]);

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
    isNodeAvailable,
  } = useVitePreview(pageId);

  // Handler to start live preview
  const handleStartLivePreview = () => {
    if (!workspace?.path || !page) return;
    // Start preview in the page directory
    const pageDir = `${workspace.path}/pages/${page.slug}`;
    startPreview(pageDir);
  };

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
            <Link to="/mcp-services/dashboard">
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t("workspace.backToDashboard")}
            </Link>
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
          segments={[
            { label: t("page.pages", "Pages"), href: `/workspace/${workspaceId}/files` },
          ]}
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
            <Link to={`/workspace/${workspaceId}/files`}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t("page.backToFiles", "Back to Files")}
            </Link>
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
          segments={[
            { label: t("page.pages", "Pages"), href: `/workspace/${workspaceId}/files` },
            { label: slug, href: "#" },
          ]}
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
          segments={[
            { label: t("page.pages", "Pages"), href: `/workspace/${workspaceId}/files` },
            { label: slug, href: "#" },
          ]}
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
            <Link to={`/workspace/${workspaceId}/files`}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t("page.backToFiles", "Back to Files")}
            </Link>
          </Button>
        </div>
      </PageWrapper>
    );
  }

  // Render page preview
  return (
    <PageWrapper className="flex flex-col h-full">
      <WorkspaceHeader
        workspace={workspace}
        segments={[
          { label: t("page.pages", "Pages"), href: `/workspace/${workspaceId}/files` },
          { label: page.name, href: "#" },
        ]}
        showRemove={false}
        showRefresh={false}
      />
      <div className="flex-1 overflow-hidden">
        <PagePreview
          page={page}
          workspacePath={workspace.path}
          livePreviewUrl={previewUrl}
          livePreviewStatus={previewStatus}
          livePreviewError={previewError}
          onStartLivePreview={handleStartLivePreview}
          onStopLivePreview={stopPreview}
          isNodeAvailable={isNodeAvailable}
          initialViewMode={initialViewMode}
          className="h-full"
        />
      </div>
    </PageWrapper>
  );
}

export default WorkspacePage;
