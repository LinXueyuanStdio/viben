/**
 * Video Preview Component
 *
 * Displays video files with native browser video controls.
 * Supports both local files (via Tauri fs plugin) and remote URLs.
 */

import * as React from "react";
import { useTranslation } from "react-i18next";
import { readFile, stat } from "@tauri-apps/plugin-fs";
import { ExternalLink, Loader2, Video } from "lucide-react";
import { openUrl as openExternal } from "@tauri-apps/plugin-opener";

import type { PreviewComponentProps } from "./types";
import {
  getVideoMimeType,
  isRemoteUrl,
  MAX_PREVIEW_SIZE,
  formatFileSize,
} from "./utils";

export function VideoPreview({ artifact }: PreviewComponentProps) {
  const { t } = useTranslation();
  const [videoUrl, setVideoUrl] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [fileTooLarge, setFileTooLarge] = React.useState<number | null>(null);
  const videoRef = React.useRef<HTMLVideoElement>(null);

  const handleOpenExternal = async () => {
    if (artifact.path) {
      try {
        await openExternal(artifact.path);
      } catch (err) {
        console.error("Failed to open file externally:", err);
      }
    }
  };

  React.useEffect(() => {
    let blobUrl: string | null = null;

    async function loadVideo() {
      // If content is already a data URL or http URL, use it directly
      if (
        artifact.content &&
        (artifact.content.startsWith("data:") ||
          artifact.content.startsWith("http"))
      ) {
        setVideoUrl(artifact.content);
        setLoading(false);
        return;
      }

      if (!artifact.path) {
        setError(t("artifacts.noVideoPath"));
        setLoading(false);
        return;
      }

      try {
        // Check file size first for local files
        if (!isRemoteUrl(artifact.path)) {
          const fileInfo = await stat(artifact.path);
          if (fileInfo.size > MAX_PREVIEW_SIZE) {
            setFileTooLarge(fileInfo.size);
            setLoading(false);
            return;
          }
        }

        if (isRemoteUrl(artifact.path)) {
          // Remote URL - use directly
          const url = artifact.path.startsWith("//")
            ? `https:${artifact.path}`
            : artifact.path;
          setVideoUrl(url);
        } else {
          // Local file - read as blob using Tauri fs plugin
          const ext = artifact.path.split(".").pop()?.toLowerCase() || "";
          const mimeType = getVideoMimeType(ext);

          const data = await readFile(artifact.path);
          const blob = new Blob([data], { type: mimeType });

          blobUrl = URL.createObjectURL(blob);
          setVideoUrl(blobUrl);
        }
        setError(null);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        setError(errorMsg);
      } finally {
        setLoading(false);
      }
    }

    loadVideo();

    // Cleanup blob URL on unmount
    return () => {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [artifact.path, artifact.content]);

  if (loading) {
    return (
      <div className="bg-muted/20 flex h-full flex-col items-center justify-center p-8">
        <div className="relative mb-4">
          <div className="bg-primary/10 flex size-20 items-center justify-center rounded-2xl">
            <Video className="text-primary size-10" />
          </div>
        </div>
        <h3 className="text-foreground mb-2 max-w-md truncate text-center text-lg font-semibold">
          {artifact.name.replace(/\.[^/.]+$/, "")}
        </h3>
        <div className="text-muted-foreground mt-4 flex items-center gap-2">
          <Loader2 className="size-4 animate-spin" />
          <span className="text-sm">{t("artifacts.loadingVideo", "Loading video...")}</span>
        </div>
      </div>
    );
  }

  if (fileTooLarge !== null) {
    return (
      <div className="bg-muted/20 flex h-full flex-col items-center justify-center p-8">
        <div className="flex max-w-md flex-col items-center text-center">
          <div className="border-border bg-background mb-4 flex size-20 items-center justify-center rounded-xl border">
            <Video className="text-muted-foreground size-10" />
          </div>
          <h3 className="text-foreground mb-2 text-lg font-medium">
            {artifact.name}
          </h3>
          <p className="text-muted-foreground mb-4 text-sm">
            {t("artifacts.fileTooLarge", "File too large to preview")} ({formatFileSize(fileTooLarge)})
          </p>
          <button
            onClick={handleOpenExternal}
            className="bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          >
            <ExternalLink className="size-4" />
            {t("artifacts.openInVideoPlayer", "Open in Video Player")}
          </button>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-muted/20 flex h-full flex-col items-center justify-center p-8">
        <div className="flex max-w-md flex-col items-center text-center">
          <div className="mb-4 flex size-20 items-center justify-center rounded-full bg-red-500/10">
            <Video className="size-10 text-red-500" />
          </div>
          <h3 className="text-foreground mb-2 text-lg font-medium">
            {artifact.name}
          </h3>
          <p className="text-muted-foreground mb-4 text-sm break-all whitespace-pre-wrap">
            {error}
          </p>
          <button
            onClick={handleOpenExternal}
            className="bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          >
            <ExternalLink className="size-4" />
            {t("artifacts.openInVideoPlayer", "Open in Video Player")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-muted/30 flex h-full flex-col items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        <video
          ref={videoRef}
          src={videoUrl || undefined}
          controls
          className="h-auto max-h-[70vh] w-full rounded-lg bg-black shadow-xl"
          preload="metadata"
        >
          Your browser does not support the video tag.
        </video>
        <div className="text-muted-foreground mt-3 text-center text-sm">
          {artifact.name}
        </div>
      </div>
    </div>
  );
}
