/**
 * VitePreview Component
 *
 * Displays a live Vite dev server preview in an iframe with controls
 * for refresh, open in new tab, fullscreen, and stop server.
 * Shows real-time logs and retry status during server startup.
 */

import { useRef, useState, useCallback, useEffect, memo, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  ExternalLink,
  Loader2,
  Maximize2,
  Minimize2,
  Play,
  RefreshCw,
  Square,
  Terminal,
  Trash2,
  X,
} from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import type { PreviewStatus } from "@/hooks/use-vite-preview";

// ============================================================================
// Log Entry Types and Parsing
// ============================================================================

type LogLevel = "info" | "warn" | "error" | "debug" | "retry";

interface ParsedLog {
  index: number;
  level: LogLevel;
  message: string;
}

const LOG_LEVEL_COLORS: Record<LogLevel, string> = {
  info: "text-slate-300",
  warn: "text-yellow-400",
  error: "text-red-400",
  debug: "text-slate-500",
  retry: "text-blue-400",
};

const LOG_LEVEL_BADGES: Record<LogLevel, { bg: string; text: string }> = {
  info: { bg: "bg-slate-700", text: "text-slate-300" },
  warn: { bg: "bg-yellow-900/50", text: "text-yellow-400" },
  error: { bg: "bg-red-900/50", text: "text-red-400" },
  debug: { bg: "bg-slate-800", text: "text-slate-500" },
  retry: { bg: "bg-blue-900/50", text: "text-blue-400" },
};

function parseLogEntry(log: string, index: number): ParsedLog {
  let level: LogLevel = "info";
  let message = log;

  if (log.startsWith("[Error]") || log.toLowerCase().includes("error")) {
    level = "error";
    message = log.replace(/^\[Error\]\s*/, "");
  } else if (log.startsWith("[stderr]")) {
    level = "warn";
    message = log.replace(/^\[stderr\]\s*/, "");
  } else if (log.startsWith("[Retry")) {
    level = "retry";
  } else if (log.toLowerCase().includes("debug")) {
    level = "debug";
  }

  return { index, level, message };
}

// ============================================================================
// ANSI Color Parsing for Terminal Output
// ============================================================================

interface AnsiSpan {
  text: string;
  className: string;
}

const ANSI_COLORS: Record<number, string> = {
  30: "text-black",
  31: "text-red-500",
  32: "text-green-500",
  33: "text-yellow-500",
  34: "text-blue-500",
  35: "text-purple-500",
  36: "text-cyan-500",
  37: "text-white",
  90: "text-slate-500",
  91: "text-red-400",
  92: "text-green-400",
  93: "text-yellow-400",
  94: "text-blue-400",
  95: "text-purple-400",
  96: "text-cyan-400",
  97: "text-slate-200",
};

const ANSI_BG_COLORS: Record<number, string> = {
  40: "bg-black",
  41: "bg-red-900",
  42: "bg-green-900",
  43: "bg-yellow-900",
  44: "bg-blue-900",
  45: "bg-purple-900",
  46: "bg-cyan-900",
  47: "bg-white",
};

function parseAnsiString(str: string): AnsiSpan[] {
  const spans: AnsiSpan[] = [];
  // eslint-disable-next-line no-control-regex
  const ansiRegex = /\x1b\[([0-9;]*)m/g;

  let lastIndex = 0;
  let currentClasses: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = ansiRegex.exec(str)) !== null) {
    // Add text before this escape sequence
    if (match.index > lastIndex) {
      const text = str.slice(lastIndex, match.index);
      if (text) {
        spans.push({ text, className: currentClasses.join(" ") });
      }
    }

    // Parse the escape codes
    const codes = match[1].split(";").map(Number);
    for (const code of codes) {
      if (code === 0) {
        currentClasses = [];
      } else if (code === 1) {
        currentClasses.push("font-bold");
      } else if (code === 2) {
        currentClasses.push("opacity-70");
      } else if (code === 3) {
        currentClasses.push("italic");
      } else if (code === 4) {
        currentClasses.push("underline");
      } else if (ANSI_COLORS[code]) {
        // Remove existing text color
        currentClasses = currentClasses.filter((c) => !c.startsWith("text-"));
        currentClasses.push(ANSI_COLORS[code]);
      } else if (ANSI_BG_COLORS[code]) {
        // Remove existing bg color
        currentClasses = currentClasses.filter((c) => !c.startsWith("bg-"));
        currentClasses.push(ANSI_BG_COLORS[code]);
      }
    }

    lastIndex = ansiRegex.lastIndex;
  }

  // Add remaining text
  if (lastIndex < str.length) {
    const text = str.slice(lastIndex);
    if (text) {
      spans.push({ text, className: currentClasses.join(" ") });
    }
  }

  // If no spans were created, return the original string
  if (spans.length === 0 && str) {
    spans.push({ text: str, className: "" });
  }

  return spans;
}

// ============================================================================
// Memoized Log Line Component
// ============================================================================

interface LogLineProps {
  log: ParsedLog;
}

const LogLine = memo(function LogLine({ log }: LogLineProps) {
  const badge = LOG_LEVEL_BADGES[log.level];

  // Split message by newlines and parse ANSI for each line
  const lines = useMemo(() => {
    return log.message.split("\n").map((line) => parseAnsiString(line));
  }, [log.message]);

  // Single line - simple layout
  if (lines.length === 1) {
    return (
      <div className="group flex items-start gap-2 py-0.5 hover:bg-white/5">
        <span className="w-6 shrink-0 select-none text-right text-slate-600">
          {log.index + 1}
        </span>
        {log.level !== "info" && (
          <span
            className={cn(
              "shrink-0 rounded px-1 text-[10px] font-medium uppercase",
              badge.bg,
              badge.text
            )}
          >
            {log.level}
          </span>
        )}
        <span className={cn("flex-1 break-all", LOG_LEVEL_COLORS[log.level])}>
          {lines[0].map((span, i) => (
            <span key={i} className={span.className}>
              {span.text}
            </span>
          ))}
        </span>
      </div>
    );
  }

  // Multi-line - first line has line number and badge, rest are indented
  return (
    <div className="group py-0.5 hover:bg-white/5">
      {lines.map((lineSpans, lineIndex) => (
        <div key={lineIndex} className="flex items-start gap-2">
          {lineIndex === 0 ? (
            <>
              <span className="w-6 shrink-0 select-none text-right text-slate-600">
                {log.index + 1}
              </span>
              {log.level !== "info" && (
                <span
                  className={cn(
                    "shrink-0 rounded px-1 text-[10px] font-medium uppercase",
                    badge.bg,
                    badge.text
                  )}
                >
                  {log.level}
                </span>
              )}
            </>
          ) : (
            <>
              <span className="w-6 shrink-0" />
              {log.level !== "info" && <span className="shrink-0 w-[42px]" />}
            </>
          )}
          <span className={cn("flex-1 break-all", LOG_LEVEL_COLORS[log.level])}>
            {lineSpans.length === 0 ? (
              <span>&nbsp;</span>
            ) : (
              lineSpans.map((span, i) => (
                <span key={i} className={span.className}>
                  {span.text}
                </span>
              ))
            )}
          </span>
        </div>
      ))}
    </div>
  );
});

// ============================================================================
// Terminal Logs Panel Component
// ============================================================================

interface TerminalLogsPanelProps {
  logs: string[];
  showLogs: boolean;
  onToggleLogs: () => void;
  onClearLogs?: () => void;
  className?: string;
}

const TerminalLogsPanel = memo(function TerminalLogsPanel({
  logs,
  showLogs,
  onToggleLogs,
  onClearLogs,
  className,
}: TerminalLogsPanelProps) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const [userScrolledUp, setUserScrolledUp] = useState(false);
  const [copied, setCopied] = useState(false);

  // Parse logs with memoization - use index as stable key
  const parsedLogs = useMemo(
    () => logs.map((log, index) => parseLogEntry(log, index)),
    [logs]
  );

  // Track scroll position
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const isAtBottom =
        container.scrollHeight - container.scrollTop <= container.clientHeight + 50;
      setUserScrolledUp(!isAtBottom);
    };

    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, [showLogs]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (showLogs && endRef.current && !userScrolledUp) {
      endRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [parsedLogs.length, showLogs, userScrolledUp]);

  const handleCopy = useCallback(async () => {
    const text = logs.join("\n");
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [logs]);

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-lg border border-slate-700 bg-slate-900",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-700 bg-slate-800/50 px-3 py-1.5">
        <button
          type="button"
          onClick={onToggleLogs}
          className="flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-slate-200"
        >
          <Terminal className="h-3.5 w-3.5" />
          {t("preview.serverLogs", "Server Logs")}
          <span className="rounded bg-slate-700 px-1.5 py-0.5 text-[10px] text-slate-400">
            {logs.length}
          </span>
          {showLogs ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
        </button>

        {showLogs && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleCopy}
              className="flex h-6 w-6 items-center justify-center rounded text-slate-500 hover:bg-slate-700 hover:text-slate-300"
              title={t("preview.copyLogs", "Copy logs")}
            >
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            </button>
            {onClearLogs && (
              <button
                type="button"
                onClick={onClearLogs}
                className="flex h-6 w-6 items-center justify-center rounded text-slate-500 hover:bg-slate-700 hover:text-slate-300"
                title={t("preview.clearLogs", "Clear logs")}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Logs content */}
      {showLogs && (
        <div
          ref={containerRef}
          className="flex-1 overflow-auto bg-slate-950 p-2 font-mono text-xs leading-relaxed"
        >
          {parsedLogs.length === 0 ? (
            <div className="flex h-full items-center justify-center text-slate-600">
              <span>{t("preview.waitingForLogs", "Waiting for server output...")}</span>
            </div>
          ) : (
            <>
              {parsedLogs.map((log) => (
                <LogLine key={log.index} log={log} />
              ))}
              <div ref={endRef} />
            </>
          )}
        </div>
      )}
    </div>
  );
});

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
  /** Callback to clear logs */
  onClearLogs?: () => void;
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
  onClearLogs,
  hideHeader = false,
  className,
}: VitePreviewProps) {
  const { t } = useTranslation();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showLogs, setShowLogs] = useState(true);

  // Handle iframe refresh using native reload
  const handleRefresh = useCallback(() => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.location.reload();
    }
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
          <TerminalLogsPanel
            logs={logs}
            showLogs={showLogs}
            onToggleLogs={() => setShowLogs(!showLogs)}
            onClearLogs={onClearLogs}
            className="flex-1"
          />
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
            <TerminalLogsPanel
              logs={logs}
              showLogs={showLogs}
              onToggleLogs={() => setShowLogs(!showLogs)}
              onClearLogs={onClearLogs}
              className="flex-1"
            />
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
