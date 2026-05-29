/**
 * Artifact Preview Component
 *
 * Main orchestrator component that displays artifact previews
 * with view mode toggle (preview/code), static/live preview toggle for HTML,
 * and header controls.
 */

import * as React from "react";
import { useState, useRef, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { openUrl as openExternal } from "@tauri-apps/plugin-opener";
import {
  Check,
  Code,
  Copy,
  ExternalLink,
  Eye,
  FileCode2,
  FileText,
  Maximize2,
  Radio,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { VitePreview } from "@/components/conversation/vite-preview";
import { checkNodeAvailable } from "@/lib/gateway/modules/preview";
import { getGatewayUrl } from "@/lib/gateway/config";

import type { Artifact, ArtifactPreviewProps, PreviewMode, ViewMode } from "./types";
import {
  getFileExtension,
  getOpenWithApp,
  inlineAssets,
  isCodeFile,
  parseCSV,
} from "./utils";
import { CodePreview } from "./code-preview";
import { ImagePreview } from "./image-preview";
import { MarkdownPreview } from "./markdown-preview";
import { AudioPreview } from "./audio-preview";
import { VideoPreview } from "./video-preview";
import { PdfPreview } from "./pdf-preview";
import { WebSearchPreview } from "./websearch-preview";
import { FontPreview } from "./font-preview";
import { DocxPreview } from "./docx-preview";
import { XlsxPreview } from "./xlsx-preview";
import { PptxPreview } from "./pptx-preview";

/**
 * Main Artifact Preview Component
 */
export function ArtifactPreview({
  artifact,
  onClose,
  allArtifacts = [],
  className,
  livePreviewUrl,
  livePreviewStatus = "idle",
  livePreviewError,
  onStartLivePreview,
  onStopLivePreview,
}: ArtifactPreviewProps) {
  const { t } = useTranslation();
  const [viewMode, setViewMode] = useState<ViewMode>("preview");
  const [previewMode, setPreviewMode] = useState<PreviewMode>("static");
  const [copied, setCopied] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isNodeAvailable, setIsNodeAvailable] = useState<boolean | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Check if Node.js is available (required for Live Preview)
  useEffect(() => {
    async function checkNode() {
      try {
        const baseUrl = getGatewayUrl();
        const available = await checkNodeAvailable(baseUrl);
        setIsNodeAvailable(available);
        console.log("[ArtifactPreview] Node.js available:", available);
      } catch (error) {
        console.error("[ArtifactPreview] Failed to check Node.js availability:", error);
        setIsNodeAvailable(false);
      }
    }
    checkNode();
  }, []);

  // Check if live preview is available for this artifact
  // Requires: HTML artifact + onStartLivePreview handler + Node.js installed
  const canUseLivePreview = useMemo(() => {
    if (!artifact) return false;
    if (!isNodeAvailable) return false;
    return artifact.type === "html" && onStartLivePreview !== undefined;
  }, [artifact, onStartLivePreview, isNodeAvailable]);

  // Auto-switch to live mode if live preview is already running
  useEffect(() => {
    if (livePreviewStatus === "running" && canUseLivePreview) {
      setPreviewMode("live");
    }
  }, [livePreviewStatus, canUseLivePreview]);

  // Reset view mode when artifact changes
  useEffect(() => {
    if (!artifact) {
      setViewMode("preview");
      return;
    }

    // For code-only types, default to code view
    const codeOnlyTypes = ["code", "jsx", "css", "json", "text"];
    if (codeOnlyTypes.includes(artifact.type)) {
      setViewMode("code");
    } else {
      setViewMode("preview");
    }
  }, [artifact?.id, artifact?.type]);

  // Handle copy to clipboard
  const handleCopy = async () => {
    if (!artifact?.content) return;
    try {
      await navigator.clipboard.writeText(artifact.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  // Handle open in external app
  const handleOpenExternal = async () => {
    if (!artifact) return;

    if (artifact.path) {
      try {
        await openExternal(artifact.path);
        return;
      } catch (err) {
        console.error("Failed to open file:", err);
      }
    }

    // Fallback for HTML content without path
    if (artifact.type === "html" && artifact.content) {
      const blob = new Blob([artifact.content], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
    }
  };

  // Handle open in code editor
  const handleOpenInEditor = async () => {
    if (!artifact?.path) return;
    // Note: This would require a backend API to open files in editor
    // For now, we just open the file with the system default app
    try {
      await openExternal(artifact.path);
    } catch (err) {
      console.error("Failed to open in editor:", err);
    }
  };

  // Check if preview is available
  const hasPreview = useMemo(() => {
    if (!artifact) return false;
    switch (artifact.type) {
      case "html":
        return true;
      case "image":
        return !!artifact.content || !!artifact.path;
      case "markdown":
        return !!artifact.content;
      case "csv":
        return !!artifact.content;
      case "pdf":
        return !!artifact.content || !!artifact.path;
      case "audio":
        return !!artifact.content || !!artifact.path;
      case "video":
        return !!artifact.content || !!artifact.path;
      case "websearch":
        return !!artifact.content;
      case "font":
        return !!artifact.path || !!artifact.content;
      case "document":
        return !!artifact.path;
      case "spreadsheet":
        return !!artifact.path;
      case "presentation":
        return !!artifact.path;
      default:
        return false;
    }
  }, [artifact]);

  // Check if code view is available
  const hasCodeView = useMemo(() => {
    if (!artifact) return false;
    if (
      ["image", "pdf", "document", "spreadsheet", "presentation", "font", "audio", "video"].includes(
        artifact.type
      )
    ) {
      return false;
    }
    return !!artifact.content;
  }, [artifact]);

  // Get open with app info
  const openWithApp = artifact ? getOpenWithApp(artifact) : null;

  // Generate iframe content for HTML with inlined assets
  // Only compute when in static preview mode to avoid unnecessary blob URL creation/revocation
  const shouldShowStaticPreview =
    viewMode === "preview" && previewMode === "static";

  const iframeSrc = useMemo(() => {
    // Only create blob URL when we need to show static preview
    if (!shouldShowStaticPreview) return null;
    if (!artifact?.content || artifact.type !== "html") return null;

    const enhancedHtml =
      allArtifacts.length > 0
        ? inlineAssets(artifact.content, allArtifacts)
        : artifact.content;

    const blob = new Blob([enhancedHtml], { type: "text/html" });
    return URL.createObjectURL(blob);
  }, [artifact?.content, artifact?.type, allArtifacts, shouldShowStaticPreview]);

  // Cleanup blob URL when it changes or on unmount
  useEffect(() => {
    return () => {
      if (iframeSrc) {
        URL.revokeObjectURL(iframeSrc);
      }
    };
  }, [iframeSrc]);

  // Empty state
  if (!artifact) {
    return (
      <div className={cn("bg-background flex h-full flex-col", className)}>
        <div className="border-border/50 bg-muted/30 flex shrink-0 items-center justify-between border-b px-4 py-2">
          <div className="flex items-center gap-2">
            <Eye className="text-muted-foreground size-4" />
            <span className="text-muted-foreground text-sm font-medium">
              {t("chat.artifacts.title")}
            </span>
          </div>
        </div>
        <div className="bg-muted/20 flex flex-1 flex-col items-center justify-center p-8">
          <div className="flex flex-col items-center text-center">
            <div className="border-border bg-background mb-4 flex size-16 items-center justify-center rounded-xl border">
              <FileText className="text-muted-foreground/50 size-8" />
            </div>
            <h3 className="text-muted-foreground text-sm font-medium">
              {t("chat.noArtifacts")}
            </h3>
            <p className="text-muted-foreground/70 mt-1 text-xs">
              {t("artifacts.selectToPreview", "Select an artifact from the sidebar to preview")}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "bg-background flex h-full flex-col",
        isFullscreen && "fixed inset-0 z-50",
        className
      )}
    >
      {/* Header */}
      <div className="border-border/50 bg-muted/30 flex shrink-0 items-center justify-between border-b px-4 py-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="text-foreground truncate text-sm font-medium">
            {artifact.name}
          </span>
          <span className="bg-muted text-muted-foreground shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase">
            {getFileExtension(artifact.name) || artifact.type}
          </span>
        </div>

        <TooltipProvider delayDuration={300}>
          <div className="flex shrink-0 items-center gap-1">
            {openWithApp && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={handleOpenExternal}
                    className="text-muted-foreground hover:bg-accent hover:text-foreground flex size-8 cursor-pointer items-center justify-center rounded-md transition-colors"
                  >
                    <ExternalLink className="size-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>{t("artifacts.openIn", "Open in {{name}}", { name: openWithApp.name })}</p>
                </TooltipContent>
              </Tooltip>
            )}

            {isCodeFile(artifact) && artifact.path && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={handleOpenInEditor}
                    className="text-muted-foreground hover:bg-accent hover:text-foreground flex size-8 cursor-pointer items-center justify-center rounded-md transition-colors"
                  >
                    <FileCode2 className="size-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>{t("artifacts.openInEditor", "Open in Editor")}</p>
                </TooltipContent>
              </Tooltip>
            )}

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  className="text-muted-foreground hover:bg-accent hover:text-foreground flex size-8 cursor-pointer items-center justify-center rounded-md transition-colors"
                >
                  <Maximize2 className="size-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>{isFullscreen ? t("artifacts.exitFullscreen", "Exit Fullscreen") : t("artifacts.fullscreen", "Fullscreen")}</p>
              </TooltipContent>
            </Tooltip>

            {onClose && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={onClose}
                    className="text-muted-foreground hover:bg-accent hover:text-foreground flex size-8 cursor-pointer items-center justify-center rounded-md transition-colors"
                  >
                    <X className="size-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>{t("common.close")}</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </TooltipProvider>
      </div>

      {/* View mode toggle */}
      {(hasCodeView || (canUseLivePreview && viewMode === "preview")) && (
        <div className="bg-muted/20 border-border/30 flex shrink-0 items-center gap-2 border-b px-4 py-2">
          {hasPreview && hasCodeView && (
            <div className="bg-muted flex items-center gap-1 rounded-lg p-0.5">
              <button
                onClick={() => setViewMode("preview")}
                className={cn(
                  "flex cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  viewMode === "preview"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Eye className="size-3.5" />
                {t("artifacts.preview", "Preview")}
              </button>
              <button
                onClick={() => setViewMode("code")}
                className={cn(
                  "flex cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  viewMode === "code"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Code className="size-3.5" />
                {t("artifacts.code", "Code")}
              </button>
            </div>
          )}

          {/* Static/Live preview toggle for HTML */}
          {canUseLivePreview && viewMode === "preview" && (
            <div className="bg-muted flex items-center gap-1 rounded-lg p-0.5">
              <button
                onClick={() => setPreviewMode("static")}
                className={cn(
                  "flex cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  previewMode === "static"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Eye className="size-3.5" />
                {t("preview.static", "Static")}
              </button>
              <button
                onClick={() => {
                  setPreviewMode("live");
                  if (livePreviewStatus === "idle" && onStartLivePreview) {
                    onStartLivePreview();
                  }
                }}
                className={cn(
                  "flex cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  previewMode === "live"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Radio
                  className={cn(
                    "size-3.5",
                    livePreviewStatus === "running" && "text-green-500"
                  )}
                />
                {t("preview.live", "Live")}
                {livePreviewStatus === "running" && (
                  <span className="size-1.5 animate-pulse rounded-full bg-green-500" />
                )}
              </button>
            </div>
          )}

          {!hasPreview && hasCodeView && (
            <div className="bg-muted text-foreground flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium">
              <Code className="size-3.5" />
              {t("artifacts.code", "Code")}
            </div>
          )}

          {hasCodeView && viewMode === "code" && (
            <button
              onClick={handleCopy}
              className="text-muted-foreground hover:bg-accent hover:text-foreground ml-auto flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors"
              title={t("common.copy")}
            >
              {copied ? (
                <>
                  <Check className="size-3.5 text-emerald-500" />
                  <span className="text-emerald-500">{t("common.copied")}</span>
                </>
              ) : (
                <>
                  <Copy className="size-3.5" />
                  <span>{t("common.copy")}</span>
                </>
              )}
            </button>
          )}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {viewMode === "preview" ? (
          previewMode === "live" && canUseLivePreview ? (
            <VitePreview
              previewUrl={livePreviewUrl || null}
              status={livePreviewStatus}
              error={livePreviewError || null}
              onStart={onStartLivePreview}
              onStop={onStopLivePreview}
            />
          ) : (
            <PreviewContent
              artifact={artifact}
              iframeSrc={iframeSrc}
              iframeRef={iframeRef}
            />
          )
        ) : (
          <CodePreview artifact={artifact} />
        )}
      </div>
    </div>
  );
}

/**
 * Preview content component - renders the appropriate preview based on artifact type
 */
function PreviewContent({
  artifact,
  iframeSrc,
  iframeRef,
}: {
  artifact: Artifact;
  iframeSrc: string | null;
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
}) {
  const { t } = useTranslation();

  // HTML Preview
  if (artifact.type === "html" && iframeSrc) {
    return (
      <div className="h-full bg-white">
        <iframe
          ref={iframeRef}
          src={iframeSrc}
          className="h-full w-full border-0"
          sandbox="allow-scripts allow-same-origin"
          title={artifact.name}
        />
      </div>
    );
  }

  // Image Preview
  if (artifact.type === "image") {
    return <ImagePreview artifact={artifact} />;
  }

  // Markdown Preview
  if (artifact.type === "markdown" && artifact.content) {
    return <MarkdownPreview artifact={artifact} />;
  }

  // CSV Preview
  if (artifact.type === "csv" && artifact.content) {
    const csvData = parseCSV(artifact.content);
    return (
      <div className="bg-background h-full overflow-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-muted sticky top-0">
            {csvData.length > 0 && (
              <tr>
                {csvData[0].map((cell, i) => (
                  <th
                    key={i}
                    className="border-border text-foreground border px-3 py-2 text-left font-medium"
                  >
                    {cell}
                  </th>
                ))}
              </tr>
            )}
          </thead>
          <tbody>
            {csvData.slice(1).map((row, rowIndex) => (
              <tr key={rowIndex} className="hover:bg-muted/50">
                {row.map((cell, cellIndex) => (
                  <td
                    key={cellIndex}
                    className="border-border text-foreground border px-3 py-2"
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // PDF Preview
  if (artifact.type === "pdf") {
    return <PdfPreview artifact={artifact} />;
  }

  // Audio Preview
  if (artifact.type === "audio") {
    return <AudioPreview artifact={artifact} />;
  }

  // Video Preview
  if (artifact.type === "video") {
    return <VideoPreview artifact={artifact} />;
  }

  // WebSearch Preview
  if (artifact.type === "websearch") {
    return <WebSearchPreview artifact={artifact} />;
  }

  // Font Preview
  if (artifact.type === "font") {
    return <FontPreview artifact={artifact} />;
  }

  // Document Preview
  if (artifact.type === "document") {
    return <DocxPreview artifact={artifact} />;
  }

  // Spreadsheet Preview
  if (artifact.type === "spreadsheet") {
    return <XlsxPreview artifact={artifact} />;
  }

  // Presentation Preview
  if (artifact.type === "presentation") {
    return <PptxPreview artifact={artifact} />;
  }

  // Default: show prompt to switch to code view
  return (
    <div className="bg-muted/20 flex h-full flex-col items-center justify-center p-8">
      <div className="flex flex-col items-center text-center">
        <div className="border-border bg-background mb-4 flex size-16 items-center justify-center rounded-xl border">
          <Code className="text-muted-foreground/50 size-8" />
        </div>
        <h3 className="text-muted-foreground text-sm font-medium">
          {t("artifacts.previewNotAvailable", "Preview not available")}
        </h3>
        <p className="text-muted-foreground/70 mt-1 text-xs">
          {t("artifacts.switchToCodeView", "Switch to Code view to see the content")}
        </p>
      </div>
    </div>
  );
}
