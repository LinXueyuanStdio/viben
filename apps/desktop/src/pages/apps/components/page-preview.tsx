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

import * as React from "react";
import { useTranslation } from "react-i18next";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { getGatewayUrl } from "@/lib/gateway/config";
import { VitePreview } from "@/pages/conversation/components/vite-preview";
import { TiptapMarkdownRenderer } from "./tiptap-markdown-renderer";
import type { PageConfig } from "@/hooks/use-pages";
import type { PreviewStatus } from "@/hooks/use-vite-preview";

/** View mode for the page preview */
export type PageViewMode = "skill" | "page";

export interface PagePreviewProps {
  /** Page configuration */
  page: PageConfig;
  /** Workspace path */
  workspacePath: string;
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
  /** Additional class names */
  className?: string;
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
 * PagePreview component for displaying workspace pages
 * Content-only component — toolbar is rendered by the parent via WorkspaceHeader.
 */
export function PagePreview({
  page,
  workspacePath,
  viewMode,
  iframeKey = 0,
  livePreviewUrl,
  livePreviewStatus = "idle",
  livePreviewError,
  onStartLivePreview,
  onStopLivePreview,
  className,
}: PagePreviewProps) {
  const { t } = useTranslation();

  // Determine the gateway serve URL for static/markdown pages
  const gatewayServeUrl = React.useMemo(() => {
    if (!workspacePath || !page.slug) return null;
    return getPageServeUrl(workspacePath, page.slug);
  }, [workspacePath, page.slug]);

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
          <TiptapMarkdownRenderer
            content={page.skill_content || ""}
            workspacePath={workspacePath}
            slug={page.slug}
            className="h-full"
          />
        )}

        {/* For pages with view toggle */}
        {showViewToggle && (
          <>
            {/* SKILL.md view - Render markdown content */}
            {viewMode === "skill" && (
              <TiptapMarkdownRenderer
                content={page.skill_content || ""}
                workspacePath={workspacePath}
                slug={page.slug}
                className="h-full"
              />
            )}

            {/* Page view - depends on page type */}
            {viewMode === "page" && (
              <>
                {/* Static pages - show iframe */}
                {page.type === "static" && gatewayServeUrl && (
                  <div className="h-full w-full bg-white">
                    <iframe
                      key={iframeKey}
                      src={gatewayServeUrl}
                      className="h-full w-full border-0"
                      title={page.name}
                    />
                  </div>
                )}

                {/* Server pages - use VitePreview */}
                {isServerType && (
                  <VitePreview
                    previewUrl={livePreviewUrl ?? null}
                    status={livePreviewStatus}
                    error={livePreviewError ?? null}
                    onStart={onStartLivePreview}
                    onStop={onStopLivePreview}
                    className="h-full"
                  />
                )}

                {/* Proxy pages - coming soon */}
                {isProxy && (
                  <div className="flex h-full flex-col items-center justify-center bg-muted/20 p-8">
                    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-xl border border-border bg-background">
                      <AlertCircle className="h-8 w-8 text-muted-foreground/50" />
                    </div>
                    <h3 className="mb-1 text-sm font-medium text-foreground">
                      {t("page.proxyPage", "Proxy Page")}
                    </h3>
                    <p className="max-w-xs text-center text-xs text-muted-foreground">
                      {t("page.proxyComingSoon", "Proxy page preview is coming soon")}
                    </p>
                  </div>
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
