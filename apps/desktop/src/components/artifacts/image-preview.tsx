/**
 * Image Preview Component
 *
 * Displays image files with loading state and error handling.
 * Supports both local files (via Tauri fs plugin) and remote URLs.
 */

import * as React from "react";
import { readFile, stat } from "@tauri-apps/plugin-fs";
import { Loader2, ImageIcon } from "lucide-react";

import type { PreviewComponentProps } from "./types";
import {
  getImageMimeType,
  isRemoteUrl,
  MAX_PREVIEW_SIZE,
  formatFileSize,
} from "./utils";

export function ImagePreview({ artifact }: PreviewComponentProps) {
  const [imageUrl, setImageUrl] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [fileTooLarge, setFileTooLarge] = React.useState<number | null>(null);

  React.useEffect(() => {
    let blobUrl: string | null = null;

    async function loadImage() {
      // If content is already a data URL or base64, use it directly
      if (
        artifact.content &&
        (artifact.content.startsWith("data:") ||
          artifact.content.startsWith("http"))
      ) {
        setImageUrl(artifact.content);
        setLoading(false);
        return;
      }

      if (!artifact.path) {
        setError("No image file path available");
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

        // Determine MIME type from extension
        const ext = artifact.path.split(".").pop()?.toLowerCase() || "";
        const mimeType = getImageMimeType(ext);

        let blob: Blob;

        if (isRemoteUrl(artifact.path)) {
          // Remote URL - fetch the image
          const url = artifact.path.startsWith("//")
            ? `https:${artifact.path}`
            : artifact.path;
          const response = await fetch(url);
          if (!response.ok) {
            throw new Error(
              `Failed to fetch image: ${response.status} ${response.statusText}`
            );
          }
          blob = await response.blob();
        } else {
          // Local file - use Tauri fs plugin
          const data = await readFile(artifact.path);
          blob = new Blob([data], { type: mimeType });
        }

        blobUrl = URL.createObjectURL(blob);
        setImageUrl(blobUrl);
        setError(null);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        setError(errorMsg);
      } finally {
        setLoading(false);
      }
    }

    loadImage();

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
        <Loader2 className="text-muted-foreground size-8 animate-spin" />
        <p className="text-muted-foreground mt-4 text-sm">Loading image...</p>
      </div>
    );
  }

  if (fileTooLarge !== null) {
    return (
      <div className="bg-muted/20 flex h-full flex-col items-center justify-center p-8">
        <div className="flex max-w-md flex-col items-center text-center">
          <div className="border-border bg-background mb-4 flex size-20 items-center justify-center rounded-xl border">
            <ImageIcon className="text-muted-foreground size-10" />
          </div>
          <h3 className="text-foreground mb-2 text-lg font-medium">
            {artifact.name}
          </h3>
          <p className="text-muted-foreground text-sm">
            File too large to preview ({formatFileSize(fileTooLarge)})
          </p>
        </div>
      </div>
    );
  }

  if (error || !imageUrl) {
    return (
      <div className="bg-muted/20 flex h-full flex-col items-center justify-center p-8">
        <div className="flex max-w-md flex-col items-center text-center">
          <div className="border-border bg-background mb-4 flex size-20 items-center justify-center rounded-xl border">
            <ImageIcon className="size-10 text-red-500" />
          </div>
          <h3 className="text-foreground mb-2 text-lg font-medium">
            {artifact.name}
          </h3>
          <p className="text-muted-foreground text-sm break-all whitespace-pre-wrap">
            {error || "No image file path available"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-muted/20 flex h-full items-center justify-center p-4">
      <img
        src={imageUrl}
        alt={artifact.name}
        className="max-h-full max-w-full rounded-lg object-contain shadow-sm"
      />
    </div>
  );
}
