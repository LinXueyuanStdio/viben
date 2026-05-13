/**
 * Static Page Preview Component
 *
 * Routes static page files to the appropriate preview component
 * based on file extension. Supports PDF, PPTX, DOCX, XLSX, images,
 * audio, video, fonts, markdown, and HTML (iframe fallback).
 */

import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { readTextFile } from "@tauri-apps/plugin-fs";

import { cn } from "@/lib/utils";
import { getGatewayUrl } from "@/lib/gateway/config";
import { PdfPreview } from "@/components/artifacts/pdf-preview";
import { PptxPreview } from "@/components/artifacts/pptx-preview";
import { DocxPreview } from "@/components/artifacts/docx-preview";
import { XlsxPreview } from "@/components/artifacts/xlsx-preview";
import { ImagePreview } from "@/components/artifacts/image-preview";
import { AudioPreview } from "@/components/artifacts/audio-preview";
import { VideoPreview } from "@/components/artifacts/video-preview";
import { FontPreview } from "@/components/artifacts/font-preview";
import { MarkdownPreview } from "@/components/artifacts/markdown-preview";
import type { Artifact, ArtifactType } from "@/components/artifacts/types";
import type { StaticPageConfig } from "@/lib/gateway/types/page";
import {
  detectFilePreviewType,
  type FilePreviewType,
} from "../utils/file-type-detector";
import { useTheme } from "@/hooks/use-theme";

interface StaticPagePreviewProps {
  page: StaticPageConfig;
  workspacePath: string;
  iframeKey?: number;
  className?: string;
}

/** Map FilePreviewType to ArtifactType */
function toArtifactType(previewType: FilePreviewType): ArtifactType {
  switch (previewType) {
    case "pdf":
      return "pdf";
    case "presentation":
      return "presentation";
    case "document":
      return "document";
    case "spreadsheet":
      return "spreadsheet";
    case "image":
      return "image";
    case "audio":
      return "audio";
    case "video":
      return "video";
    case "font":
      return "font";
    case "markdown":
      return "markdown";
    default:
      return "html";
  }
}

/**
 * StaticPagePreview - routes to the correct viewer based on file type
 */
export function StaticPagePreview({
  page,
  workspacePath,
  iframeKey = 0,
  className,
}: StaticPagePreviewProps) {
  const filePreviewType = useMemo(
    () => detectFilePreviewType(page.file),
    [page.file]
  );

  const { resolvedTheme } = useTheme();

  // Construct absolute file path for artifact-based viewers
  const filePath = useMemo(() => {
    return `${workspacePath}/pages/${page.slug}/${page.file}`;
  }, [workspacePath, page.slug, page.file]);

  // Construct gateway serve URL for iframe-based preview (with theme)
  const gatewayServeUrl = useMemo(() => {
    const baseUrl = getGatewayUrl();
    const params = new URLSearchParams({
      workspace_path: workspacePath,
      slug: page.slug,
      theme: resolvedTheme,
    });
    return `${baseUrl}/api/page/serve?${params.toString()}`;
  }, [workspacePath, page.slug, resolvedTheme]);

  // Create an Artifact object from the page config
  const artifact = useMemo<Artifact>(
    () => ({
      id: `page-${page.slug}`,
      name: page.name || page.file,
      type: toArtifactType(filePreviewType),
      path: filePath,
    }),
    [page.slug, page.name, page.file, filePreviewType, filePath]
  );

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const gatewayOrigin = useMemo(() => {
    try {
      return new URL(getGatewayUrl()).origin;
    } catch {
      return "";
    }
  }, []);

  // Listen for viben-page-ready and send init
  const handleMessage = useCallback(
    (e: MessageEvent) => {
      if (e.origin !== gatewayOrigin) return;
      if (e.data?.type === "viben-page-ready") {
        iframeRef.current?.contentWindow?.postMessage(
          {
            type: "viben-page-init",
            theme: resolvedTheme,
            workspace_path: workspacePath,
          },
          gatewayOrigin
        );
      }
    },
    [resolvedTheme, workspacePath, gatewayOrigin]
  );

  useEffect(() => {
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [handleMessage]);

  // Send theme updates when resolvedTheme changes
  useEffect(() => {
    iframeRef.current?.contentWindow?.postMessage(
      { type: "viben-page-theme", theme: resolvedTheme },
      gatewayOrigin
    );
  }, [resolvedTheme, gatewayOrigin]);

  // For HTML and fallback: use iframe with gateway serve
  if (filePreviewType === "html" || filePreviewType === "iframe-fallback") {
    return (
      <div className={cn("h-full w-full bg-white", className)}>
        <iframe
          key={iframeKey}
          ref={iframeRef}
          src={gatewayServeUrl}
          className="h-full w-full border-0"
          title={page.name}
          onLoad={(e) => {
            iframeRef.current = e.currentTarget;
          }}
        />
      </div>
    );
  }

  // For markdown: load content from file and render
  if (filePreviewType === "markdown") {
    return (
      <MarkdownFilePreview
        artifact={artifact}
        filePath={filePath}
        className={className}
      />
    );
  }

  // All other types: route to artifact preview components
  switch (filePreviewType) {
    case "pdf":
      return <PdfPreview artifact={artifact} />;
    case "presentation":
      return <PptxPreview artifact={artifact} />;
    case "document":
      return <DocxPreview artifact={artifact} />;
    case "spreadsheet":
      return <XlsxPreview artifact={artifact} />;
    case "image":
      return <ImagePreview artifact={artifact} />;
    case "audio":
      return <AudioPreview artifact={artifact} />;
    case "video":
      return <VideoPreview artifact={artifact} />;
    case "font":
      return <FontPreview artifact={artifact} />;
    default:
      return null;
  }
}

/**
 * Internal component for markdown file preview.
 * Loads markdown content from file then passes to MarkdownPreview.
 */
function MarkdownFilePreview({
  artifact,
  filePath,
  className,
}: {
  artifact: Artifact;
  filePath: string;
  className?: string;
}) {
  const { t } = useTranslation();
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadContent() {
      try {
        const text = await readTextFile(filePath);
        if (!cancelled) {
          setContent(text);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadContent();
    return () => {
      cancelled = true;
    };
  }, [filePath]);

  if (loading) {
    return (
      <div className={cn("flex h-full items-center justify-center", className)}>
        <p className="text-muted-foreground text-sm">{t("common.loading")}</p>
      </div>
    );
  }

  if (error || content === null) {
    return (
      <div className={cn("flex h-full items-center justify-center", className)}>
        <p className="text-muted-foreground text-sm">
          {error || t("page.notFound")}
        </p>
      </div>
    );
  }

  const mdArtifact: Artifact = { ...artifact, content };
  return <MarkdownPreview artifact={mdArtifact} />;
}
