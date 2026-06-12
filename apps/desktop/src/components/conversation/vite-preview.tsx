/**
 * VitePreview Component
 *
 * Displays a live Vite dev server preview in an iframe with controls
 * for refresh, open in new tab, fullscreen, and stop server.
 * Shows real-time logs and retry status during server startup.
 */

import { useRef, useState, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Loader2,
  Maximize2,
  Minimize2,
  Play,
  RefreshCw,
  Square,
  Terminal,
  X,
} from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import type { PreviewStatus } from "@/hooks/use-vite-preview";

interface VitePreviewProps {
  /** The URL to preview */
  previewUrl: string | null;
  /** Current preview status */
  status: PreviewStatus;
  /** Error message if any */
  error: string | null;
  /** Log messages from server startup */
  logs?: string[];
  /** Current retry attempt */
  retryAttempt?: number | null;
  /** Max retry attempts */
  maxRetryAttempts?: number | null;
  /** Callback to start preview */
  onStart?: () => void;
  /** Callback to stop preview */
  onStop?: () => void;
  /** Callback to close the preview panel */
  onClose?: () => void;
  /** Hide the built-in header (when parent provides its own toolbar) */
  hideHeader?: boolean;
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
  logs = [],
  retryAttempt,
  maxRetryAttempts,
  onStart,
  onStop,
  onClose,
  hideHeader = false,
  className,
}: VitePreviewProps) {
  const { t } = useTranslation();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const logsContainerRef = useRef<HTMLDivElement>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const [showLogs, setShowLogs] = useState(true);
  const [userScrolledUp, setUserScrolledUp] = useState(false);

  // Track if user has scrolled up from bottom
  useEffect(() => {
    const container = logsContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const isAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 50;
      setUserScrolledUp(!isAtBottom);
    };

    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, [showLogs]);

  // Auto-scroll logs to bottom only if user hasn't scrolled up
  useEffect(() => {
    if (showLogs && logsEndRef.current && !userScrolledUp) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, showLogs, userScrolledUp]);

  // Handle iframe refresh
  const handleRefresh = useCallback(() => {
    setIframeKey((k) => k + 1);
  }, []);

  // Handle open in new tab
  const handleOpenExternal = useCallback(async () => {
    if (previewUrl) {
      try {
        // Try to use Tauri opener plugin if available
        await openUrl(previewUrl);
      } catch {
        // Fallback to window.open if Tauri plugin fails or not available
        window.open(previewUrl, "_blank");
      }
    }
  }, [previewUrl]);

  // Handle keyboard shortcut for refresh
  useEffect(() => {
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

  // Render starting state with logs
  if (status === "starting") {
    return (
      <div
        className={cn(
          "flex h-full flex-col bg-background",
          isFullscreen && "fixed inset-0 z-50",
          className
        )}
      >
        {!hideHeader && (
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
        )}
        <div className="flex flex-1 flex-col bg-muted/20 p-4">
          <div className="mb-4 flex flex-col items-center justify-center gap-3">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <div className="text-center">
                <h3 className="text-sm font-medium text-foreground">
                  {t("preview.startingServer")}
                </h3>
                {retryAttempt && maxRetryAttempts && (
                  <p className="text-xs text-muted-foreground">
                    {t("preview.retryAttempt", "Attempt {{attempt}} of {{max}}", {
                      attempt: retryAttempt,
                      max: maxRetryAttempts,
                    })}
                  </p>
                )}
              </div>
            </div>
            {/* Stop/Restart buttons for when server startup is stuck */}
            <div className="flex items-center gap-2">
              {onStop && (
                <button
                  onClick={onStop}
                  className="flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <Square className="h-3.5 w-3.5" />
                  {t("preview.stopServer", "Stop")}
                </button>
              )}
              {onStart && (
                <button
                  onClick={() => {
                    onStop?.();
                    setTimeout(() => onStart(), 500);
                  }}
                  className="flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  {t("preview.restart", "Restart")}
                </button>
              )}
            </div>
          </div>

          {/* Logs panel */}
          <div className="flex flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card">
            <button
              type="button"
              onClick={() => setShowLogs(!showLogs)}
              className="flex items-center gap-2 border-b border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <Terminal className="h-3.5 w-3.5" />
              {t("preview.serverLogs", "Server Logs")}
              {showLogs ? (
                <ChevronUp className="ml-auto h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="ml-auto h-3.5 w-3.5" />
              )}
            </button>
            {showLogs && (
              <div ref={logsContainerRef} className="flex-1 overflow-auto p-2 font-mono text-xs">
                {logs.length === 0 ? (
                  <p className="text-muted-foreground/50">{t("preview.waitingForLogs", "Waiting for server output...")}</p>
                ) : (
                  logs.map((log, index) => (
                    <div
                      key={index}
                      className={cn(
                        "whitespace-pre-wrap break-all py-0.5",
                        log.startsWith("[Error]") && "text-red-500",
                        log.startsWith("[stderr]") && "text-yellow-600 dark:text-yellow-400",
                        log.startsWith("[Retry") && "text-blue-500"
                      )}
                    >
                      {log}
                    </div>
                  ))
                )}
                <div ref={logsEndRef} />
              </div>
            )}
          </div>
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
        {!hideHeader && (
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
        )}
        <div className="flex flex-1 flex-col bg-muted/20 p-4">
          <div className="mb-4 flex flex-col items-center justify-center">
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

          {/* Show logs if available */}
          {logs.length > 0 && (
            <div className="flex flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card">
              <button
                type="button"
                onClick={() => setShowLogs(!showLogs)}
                className="flex items-center gap-2 border-b border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                <Terminal className="h-3.5 w-3.5" />
                {t("preview.serverLogs", "Server Logs")}
                {showLogs ? (
                  <ChevronUp className="ml-auto h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="ml-auto h-3.5 w-3.5" />
                )}
              </button>
              {showLogs && (
                <div ref={logsContainerRef} className="flex-1 overflow-auto p-2 font-mono text-xs">
                  {logs.map((log, index) => (
                    <div
                      key={index}
                      className={cn(
                        "whitespace-pre-wrap break-all py-0.5",
                        log.startsWith("[Error]") && "text-red-500",
                        log.startsWith("[stderr]") && "text-yellow-600 dark:text-yellow-400",
                        log.startsWith("[Retry") && "text-blue-500"
                      )}
                    >
                      {log}
                    </div>
                  ))}
                  <div ref={logsEndRef} />
                </div>
              )}
            </div>
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
        {!hideHeader && (
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
        )}
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
      {!hideHeader && (
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
      )}
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
