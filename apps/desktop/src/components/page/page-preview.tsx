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
import {
  FileText,
  Eye,
  ExternalLink,
  Maximize2,
  Minimize2,
  RefreshCw,
  Square,
  AlertCircle,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getGatewayUrl } from "@/lib/gateway/config";
import { VitePreview } from "@/components/chat/vite-preview";
import type { PageConfig } from "@/hooks/use-pages";
import type { PreviewStatus } from "@/hooks/use-vite-preview";

/** View mode for the page preview */
export type PageViewMode = "skill" | "page";

export interface PagePreviewProps {
  /** Page configuration */
  page: PageConfig;
  /** Workspace path */
  workspacePath: string;
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
  /** Whether Node.js is available (from useVitePreview) */
  isNodeAvailable?: boolean | null;
  /** Initial view mode from URL parameter */
  initialViewMode?: PageViewMode;
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
 * Simple Markdown renderer component
 * Renders basic markdown to HTML
 */
function MarkdownRenderer({ content, className }: { content: string; className?: string }) {
  const htmlContent = React.useMemo(() => {
    // Basic markdown to HTML conversion
    let html = content
      // Escape HTML first
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      // Headers
      .replace(/^### (.*$)/gm, '<h3 class="text-lg font-semibold mt-4 mb-2">$1</h3>')
      .replace(/^## (.*$)/gm, '<h2 class="text-xl font-semibold mt-6 mb-3">$1</h2>')
      .replace(/^# (.*$)/gm, '<h1 class="text-2xl font-bold mt-6 mb-4">$1</h1>')
      // Bold and italic
      .replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>")
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      // Inline code
      .replace(/`([^`]+)`/g, '<code class="px-1 py-0.5 bg-muted rounded text-sm font-mono">$1</code>')
      // Links
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-primary underline hover:no-underline" target="_blank" rel="noopener">$1</a>')
      // Unordered lists
      .replace(/^\s*[-*]\s+(.*)$/gm, '<li class="ml-4">$1</li>')
      // Ordered lists
      .replace(/^\s*\d+\.\s+(.*)$/gm, '<li class="ml-4 list-decimal">$1</li>')
      // Horizontal rule
      .replace(/^---$/gm, '<hr class="my-4 border-border" />')
      // Paragraphs (wrap remaining lines)
      .replace(/^(?!<[h|l|u|o|hr])(.+)$/gm, '<p class="my-2">$1</p>')
      // Clean up empty paragraphs
      .replace(/<p class="my-2"><\/p>/g, "");

    // Wrap consecutive li items in ul
    html = html.replace(/(<li.*?<\/li>\n?)+/g, (match) => {
      if (match.includes("list-decimal")) {
        return `<ol class="list-decimal my-2">${match}</ol>`;
      }
      return `<ul class="list-disc my-2">${match}</ul>`;
    });

    return html;
  }, [content]);

  return (
    <div
      className={cn("prose prose-sm dark:prose-invert max-w-none p-6", className)}
      dangerouslySetInnerHTML={{ __html: htmlContent }}
    />
  );
}

/**
 * PagePreview component for displaying workspace pages
 */
export function PagePreview({
  page,
  workspacePath,
  livePreviewUrl,
  livePreviewStatus = "idle",
  livePreviewError,
  onStartLivePreview,
  onStopLivePreview,
  initialViewMode = "skill",
  className,
}: PagePreviewProps) {
  const { t } = useTranslation();
  const iframeRef = React.useRef<HTMLIFrameElement>(null);
  const [viewMode, setViewMode] = React.useState<PageViewMode>(initialViewMode);
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const [iframeKey, setIframeKey] = React.useState(0);

  // Determine the gateway serve URL for static/markdown pages
  const gatewayServeUrl = React.useMemo(() => {
    if (!workspacePath || !page.slug) return null;
    return getPageServeUrl(workspacePath, page.slug);
  }, [workspacePath, page.slug]);

  // Handle iframe refresh
  const handleRefresh = React.useCallback(() => {
    setIframeKey((k) => k + 1);
  }, []);

  // Handle open in new tab
  const handleOpenExternal = React.useCallback(async () => {
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

  // Handle DevTools (placeholder for now)
  const handleDevTools = React.useCallback(() => {
    // TODO: Implement DevTools integration
    console.log("DevTools clicked");
  }, []);

  // Determine page type capabilities
  const isServerType = page.type === "server";
  const isProxy = page.type === "proxy";

  // Markdown-type pages should NOT show the toggle (spec requirement)
  const showViewToggle = page.type !== "markdown";

  // Get status color for indicator
  const getStatusColor = () => {
    if (viewMode === "skill") return "bg-gray-400";
    if (viewMode === "page") {
      if (isServerType) {
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
      return "bg-blue-500";
    }
    return "bg-gray-400";
  };

  // Get status text for indicator
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

  return (
    <div
      className={cn(
        "flex h-full flex-col bg-background",
        isFullscreen && "fixed inset-0 z-50",
        className
      )}
    >
      {/* Header / Toolbar */}
      <div className="flex shrink-0 items-center justify-between border-b border-border/50 bg-muted/30 px-4 py-2">
        {/* Left: View mode toggle (per spec: [SKILL.md | 页面]) */}
        <div className="flex items-center gap-2">
          {showViewToggle ? (
            <div className="flex items-center gap-1 rounded-lg bg-muted/50 p-1">
              <button
                onClick={() => setViewMode("skill")}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  viewMode === "skill"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <FileText className="h-3.5 w-3.5" />
                SKILL.md
              </button>
              <button
                onClick={() => setViewMode("page")}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  viewMode === "page"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Eye className="h-3.5 w-3.5" />
                {t("page.viewPage", "页面")}
              </button>
            </div>
          ) : (
            // Markdown type: single view indicator
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <FileText className="h-3.5 w-3.5" />
              <span>{page.name}</span>
            </div>
          )}
        </div>

        {/* Center: Status indicator (only in page view for server type) */}
        {viewMode === "page" && isServerType && (
          <div className="flex items-center gap-2">
            <div className={cn("h-2 w-2 rounded-full", getStatusColor())} />
            <span className="text-xs text-muted-foreground">{getStatusText()}</span>
          </div>
        )}

        {/* Right: Action buttons */}
        <div className="flex shrink-0 items-center gap-1">
          {/* Refresh - only in page view */}
          {viewMode === "page" && (
            <button
              onClick={handleRefresh}
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              title={t("common.refresh")}
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          )}

          {/* DevTools - only in page view (spec requirement) */}
          {viewMode === "page" && (
            <button
              onClick={handleDevTools}
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              title={t("page.devTools", "DevTools")}
            >
              <Wrench className="h-4 w-4" />
            </button>
          )}

          {/* Open external - only in page view */}
          {viewMode === "page" && (
            <button
              onClick={handleOpenExternal}
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              title={t("preview.openInNewTab")}
            >
              <ExternalLink className="h-4 w-4" />
            </button>
          )}

          {/* Fullscreen */}
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            title={isFullscreen ? t("preview.exitFullscreen") : t("preview.fullscreen")}
          >
            {isFullscreen ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </button>

          {/* Stop server (only for server type when running) */}
          {viewMode === "page" && isServerType && livePreviewStatus === "running" && onStopLivePreview && (
            <button
              onClick={onStopLivePreview}
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-950"
              title={t("preview.stopServer")}
            >
              <Square className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {/* Markdown type pages - always show rendered markdown (no toggle, single view) */}
        {!showViewToggle && (
          <MarkdownRenderer
            content={page.skill_content || ""}
            className="h-full"
          />
        )}

        {/* For pages with view toggle */}
        {showViewToggle && (
          <>
            {/* SKILL.md view - Render markdown content */}
            {viewMode === "skill" && (
              <MarkdownRenderer
                content={page.skill_content || ""}
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
                      ref={iframeRef}
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
