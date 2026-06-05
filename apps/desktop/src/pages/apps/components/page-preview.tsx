/**
 * PagePreview Component
 *
 * A two-view preview component for workspace pages.
 * - SKILL.md view: Renders the markdown content of SKILL.md
 * - Page view: Shows the actual page (iframe for static/markdown, server preview for server type)
 *
 * Per spec:
 * - View toggle: [SKILL.md | 页面] (2 modes, not 3)
 * - SKILL.md view renders markdown (not code)
 * - Markdown-type pages should NOT show the toggle (single view only)
 */

import { useRef, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { getGatewayUrl } from "@/lib/gateway/config";
import { updatePageConfig } from "@/lib/gateway/modules/pages";
import { VitePreview } from "@/components/conversation/vite-preview";
import { YooptaMarkdownRenderer } from "./yoopta-markdown-renderer";
import { StaticPagePreview } from "./static-page-preview";
import type { PageConfig } from "@/hooks/use-pages";
import type { StaticPageConfig, ProxyPageConfig } from "@/lib/gateway/types/page";
import type { PreviewStatus } from "@/hooks/use-vite-preview";

/** View mode for the page preview */
export type PageViewMode = "skill" | "page";

export interface PagePreviewProps {
  /** Page configuration */
  page: PageConfig;
  /** Workspace path */
  workspacePath: string;
  /** Workspace id for canonical page/web routes */
  workspaceId: string;
  /** Current view mode (controlled from parent) */
  viewMode: PageViewMode;
  /** Key to force iframe refresh (increment to reload) */
  iframeKey?: number;
  /** Live preview URL (from useVitePreview) */
  livePreviewUrl?: string | null;
  /** Live preview status (from useVitePreview) */
  livePreviewStatus?: PreviewStatus;
  /** Live preview error (from useVitePreview) */
  livePreviewError?: string | null;
  /** Callback to start live preview */
  onStartLivePreview?: () => void;
  /** Callback to stop live preview */
  onStopLivePreview?: () => void;
  /** Navigate to another workspace page in the current tab */
  onOpenPage?: (pageSlug: string) => void;
  /** Navigate to a workspace web wrapper in the current tab */
  onOpenWeb?: (url: string, title?: string) => void;
  /** Additional class names */
  className?: string;
  /** Portal target for editor header buttons */
  headerPortal?: HTMLElement | null;
}

/**
 * PagePreview component for displaying workspace pages
 * Content-only component — toolbar is rendered by the parent via WorkspaceHeader.
 */
export function PagePreview({
  page,
  workspacePath,
  workspaceId,
  viewMode,
  iframeKey = 0,
  livePreviewUrl,
  livePreviewStatus = "idle",
  livePreviewError,
  onStartLivePreview,
  onStopLivePreview,
  onOpenPage,
  onOpenWeb,
  className,
  headerPortal,
}: PagePreviewProps) {
  const { t } = useTranslation();

  // Debounced title save
  const titleSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleTitleChange = useCallback(
    (newTitle: string) => {
      if (!workspacePath || !page.slug) return;
      if (titleSaveTimerRef.current) clearTimeout(titleSaveTimerRef.current);
      titleSaveTimerRef.current = setTimeout(async () => {
        try {
          const baseUrl = getGatewayUrl();
          await updatePageConfig(baseUrl, {
            workspace_path: workspacePath,
            slug: page.slug,
            name: newTitle || t("page.untitled", "Untitled"),
          });
        } catch (err) {
          console.error("[PagePreview] title save failed:", err);
        }
      }, 800);
    },
    [workspacePath, page.slug]
  );

  useEffect(() => {
    return () => {
      if (titleSaveTimerRef.current) clearTimeout(titleSaveTimerRef.current);
    };
  }, []);

  // Determine page type capabilities
  const isServerType = page.type === "server";
  const isProxy = page.type === "proxy";

  // Markdown-type pages should NOT show the toggle (spec requirement)
  const showViewToggle = page.type !== "markdown";

  return (
    <div className={cn("flex h-full flex-col bg-background", className)}>
      <div className="flex-1 overflow-auto">
        {/* Markdown type pages - always show rendered markdown (no toggle, single view) */}
        {!showViewToggle && (
          <YooptaMarkdownRenderer
            content={page.skill_content || ""}
            workspacePath={workspacePath}
            workspaceId={workspaceId}
            slug={page.slug}
            title={page.name}
            icon={page.icon}
            cover={page.cover}
            pageWidth={page.page_width}
            showToc={page.show_toc}
            updatedAt={page.updated_at}
            onTitleChange={handleTitleChange}
            onOpenPage={onOpenPage}
            onOpenWeb={onOpenWeb}
            headerPortal={headerPortal}
            className="h-full"
          />
        )}

        {/* For pages with view toggle */}
        {showViewToggle && (
          <>
            {/* SKILL.md view - Render markdown content */}
            {viewMode === "skill" && (
              <YooptaMarkdownRenderer
                content={page.skill_content || ""}
                workspacePath={workspacePath}
                workspaceId={workspaceId}
                slug={page.slug}
                title={page.name}
                icon={page.icon}
                cover={page.cover}
                pageWidth={page.page_width}
                showToc={page.show_toc}
                updatedAt={page.updated_at}
                onTitleChange={handleTitleChange}
                onOpenPage={onOpenPage}
                onOpenWeb={onOpenWeb}
                headerPortal={headerPortal}
                className="h-full"
              />
            )}

            {/* Page view - depends on page type */}
            {viewMode === "page" && (
              <>
                {/* Static pages - route to appropriate viewer based on file type */}
                {page.type === "static" && (
                  <StaticPagePreview
                    page={page as StaticPageConfig}
                    workspacePath={workspacePath}
                    workspaceId={workspaceId}
                    iframeKey={iframeKey}
                    className="h-full"
                  />
                )}

                {/* Server pages - use VitePreview */}
                {isServerType && (
                  <VitePreview
                    key={iframeKey}
                    previewUrl={livePreviewUrl ?? null}
                    status={livePreviewStatus}
                    error={livePreviewError ?? null}
                    onStart={onStartLivePreview}
                    onStop={onStopLivePreview}
                    hideHeader
                    className="h-full"
                  />
                )}

                {/* Proxy pages - iframe to target URL */}
                {isProxy && (
                  <iframe
                    key={iframeKey}
                    src={(page as ProxyPageConfig).url}
                    className="h-full w-full border-0"
                    title={page.name}
                  />
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default PagePreview;
