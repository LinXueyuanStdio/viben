/**
 * VitePreview Component
 *
 * Displays a live Vite dev server preview in an iframe with controls
 * for refresh, open in new tab, fullscreen, and stop server.
 */

import * as React from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import {
  AlertCircle,
  ExternalLink,
  Loader2,
  Maximize2,
  Minimize2,
  Play,
  RefreshCw,
  Square,
  X,
} from "lucide-react";
import type { PreviewStatus } from "@/hooks/use-vite-preview";

interface VitePreviewProps {
  /** The URL to preview */
  previewUrl: string | null;
  /** Current preview status */
  status: PreviewStatus;
  /** Error message if any */
  error: string | null;
  /** Callback to start preview */
  onStart?: () => void;
  /** Callback to stop preview */
  onStop?: () => void;
  /** Callback to close the preview panel */
  onClose?: () => void;
  /** Additional class names */
  className?: string;
}

/**
 * VitePreview component for displaying live Vite dev server preview
 */
export function VitePreview({
  previewUrl,
  status,
  error,
  onStart,
  onStop,
  onClose,
  className,
}: VitePreviewProps) {
  const { t } = useTranslation();
  const iframeRef = React.useRef<HTMLIFrameElement>(null);
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const [iframeKey, setIframeKey] = React.useState(0);

  // Handle iframe refresh
  const handleRefresh = React.useCallback(() => {
    setIframeKey((k) => k + 1);
  }, []);

  // Handle open in new tab
  const handleOpenExternal = React.useCallback(async () => {
    if (previewUrl) {
      try {
        // Try to use Tauri opener plugin if available
        const { openUrl } = await import("@tauri-apps/plugin-opener");
        await openUrl(previewUrl);
      } catch {
        // Fallback to window.open if Tauri plugin fails or not available
        window.open(previewUrl, "_blank");
      }
    }
  }, [previewUrl]);

  // Handle keyboard shortcut for refresh
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + R to refresh
      if ((e.metaKey || e.ctrlKey) && e.key === "r") {
        e.preventDefault();
        handleRefresh();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleRefresh]);

  // Render loading state
  if (status === "starting") {
    return (
      <div
        className={cn(
          "flex h-full flex-col bg-background",
          isFullscreen && "fixed inset-0 z-50",
          className
        )}
      >
        <PreviewHeader
          url={null}
          status={status}
          onRefresh={handleRefresh}
          onOpenExternal={handleOpenExternal}
          onStop={onStop}
          onClose={onClose}
          onFullscreen={() => setIsFullscreen(!isFullscreen)}
          isFullscreen={isFullscreen}
        />
        <div className="flex flex-1 flex-col items-center justify-center bg-muted/20 p-8">
          <Loader2 className="mb-4 h-8 w-8 animate-spin text-primary" />
          <h3 className="mb-1 text-sm font-medium text-foreground">
            {t("preview.startingServer")}
          </h3>
          <p className="mb-2 max-w-xs text-center text-xs text-muted-foreground">
            {t("preview.installingDeps")}
          </p>
          <p className="max-w-xs text-center text-xs text-muted-foreground/70">
            {t("preview.firstRunHint")}
          </p>
        </div>
      </div>
    );
  }

  // Render error state
  if (status === "error" && error) {
    return (
      <div
        className={cn(
          "flex h-full flex-col bg-background",
          isFullscreen && "fixed inset-0 z-50",
          className
        )}
      >
        <PreviewHeader
          url={null}
          status={status}
          onRefresh={handleRefresh}
          onOpenExternal={handleOpenExternal}
          onStop={onStop}
          onClose={onClose}
          onFullscreen={() => setIsFullscreen(!isFullscreen)}
          isFullscreen={isFullscreen}
        />
        <div className="flex flex-1 flex-col items-center justify-center bg-muted/20 p-8">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-xl border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950">
            <AlertCircle className="h-8 w-8 text-red-500" />
          </div>
          <h3 className="mb-2 text-sm font-medium text-foreground">
            {t("preview.previewError")}
          </h3>
          <p className="mb-4 max-w-md text-center text-xs text-muted-foreground">
            {error}
          </p>
          {onStart && (
            <button
              onClick={onStart}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <Play className="h-4 w-4" />
              {t("preview.retry")}
            </button>
          )}
        </div>
      </div>
    );
  }

  // Render idle state (no preview running)
  if (status === "idle" || !previewUrl) {
    return (
      <div
        className={cn(
          "flex h-full flex-col bg-background",
          isFullscreen && "fixed inset-0 z-50",
          className
        )}
      >
        <PreviewHeader
          url={null}
          status={status}
          onRefresh={handleRefresh}
          onOpenExternal={handleOpenExternal}
          onStop={onStop}
          onClose={onClose}
          onFullscreen={() => setIsFullscreen(!isFullscreen)}
          isFullscreen={isFullscreen}
        />
        <div className="flex flex-1 flex-col items-center justify-center bg-muted/20 p-8">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-xl border border-border bg-background">
            <Play className="h-8 w-8 text-muted-foreground/50" />
          </div>
          <h3 className="mb-1 text-sm font-medium text-foreground">
            {t("preview.livePreview")}
          </h3>
          <p className="mb-4 max-w-xs text-center text-xs text-muted-foreground">
            {t("preview.livePreviewHint")}
          </p>
          {onStart && (
            <button
              onClick={onStart}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <Play className="h-4 w-4" />
              {t("preview.startPreview")}
            </button>
          )}
        </div>
      </div>
    );
  }

  // Render running preview
  return (
    <div
      className={cn(
        "flex h-full flex-col bg-background",
        isFullscreen && "fixed inset-0 z-50",
        className
      )}
    >
      <PreviewHeader
        url={previewUrl}
        status={status}
        onRefresh={handleRefresh}
        onOpenExternal={handleOpenExternal}
        onStop={onStop}
        onClose={onClose}
        onFullscreen={() => setIsFullscreen(!isFullscreen)}
        isFullscreen={isFullscreen}
      />
      <div className="flex-1 overflow-hidden bg-white">
        <iframe
          key={iframeKey}
          ref={iframeRef}
          src={previewUrl}
          className="h-full w-full border-0"
          title={t("preview.livePreview")}
        />
      </div>
    </div>
  );
}

// Header component for the preview
interface PreviewHeaderProps {
  url: string | null;
  status: PreviewStatus;
  onRefresh: () => void;
  onOpenExternal: () => void;
  onStop?: () => void;
  onClose?: () => void;
  onFullscreen: () => void;
  isFullscreen: boolean;
}

function PreviewHeader({
  url,
  status,
  onRefresh,
  onOpenExternal,
  onStop,
  onClose,
  onFullscreen,
  isFullscreen,
}: PreviewHeaderProps) {
  const { t } = useTranslation();

  return (
    <div className="flex shrink-0 items-center justify-between border-b border-border/50 bg-muted/30 px-4 py-2">
      {/* Left: Status and URL */}
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {/* Status indicator */}
        <div
          className={cn(
            "h-2 w-2 shrink-0 rounded-full",
            status === "running" && "bg-green-500",
            status === "starting" && "animate-pulse bg-yellow-500",
            status === "error" && "bg-red-500",
            (status === "idle" || status === "stopped") && "bg-gray-400"
          )}
        />
        <span className="shrink-0 text-xs font-medium text-muted-foreground">
          {t("preview.livePreview")}
        </span>
        {url && (
          <>
            <span className="text-muted-foreground/50">|</span>
            <span className="truncate text-xs text-muted-foreground">
              {url}
            </span>
          </>
        )}
      </div>

      {/* Right: Action buttons */}
      <div className="flex shrink-0 items-center gap-1">
        {/* Refresh */}
        {status === "running" && (
          <button
            onClick={onRefresh}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            title={t("preview.refreshHint")}
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        )}

        {/* Open external */}
        {url && (
          <button
            onClick={onOpenExternal}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            title={t("preview.openInNewTab")}
          >
            <ExternalLink className="h-4 w-4" />
          </button>
        )}

        {/* Fullscreen */}
        <button
          onClick={onFullscreen}
          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          title={isFullscreen ? t("preview.exitFullscreen") : t("preview.fullscreen")}
        >
          {isFullscreen ? (
            <Minimize2 className="h-4 w-4" />
          ) : (
            <Maximize2 className="h-4 w-4" />
          )}
        </button>

        {/* Stop server */}
        {status === "running" && onStop && (
          <button
            onClick={onStop}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-950"
            title={t("preview.stopServer")}
          >
            <Square className="h-4 w-4" />
          </button>
        )}

        {/* Close */}
        {onClose && (
          <button
            onClick={onClose}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            title={t("preview.close")}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
