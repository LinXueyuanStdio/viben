/**
 * ImageTab Component
 *
 * Tab content for uploading custom images or downloading from URLs.
 * - Local file upload
 * - URL input with download
 * - Preview with delayed selection
 */

import * as React from "react";
import { useState, useRef, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Upload, Link, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useImageUpload } from "../hooks/use-image-upload";

export interface ImageTabProps {
  /** Workspace path for saving uploaded images */
  workspacePath?: string;
  /** Callback when an image is uploaded */
  onSelect: (imagePath: string) => void;
}

export function ImageTab({ workspacePath, onSelect }: ImageTabProps) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<"upload" | "url">("upload");
  const [urlInput, setUrlInput] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup preview timer on unmount
  useEffect(() => {
    return () => {
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    };
  }, []);

  const { uploadFile, uploadUrl, uploading, error, clearError } = useImageUpload({
    workspacePath,
  });

  /**
   * Handle local file selection
   */
  const handleFileSelect = useCallback(async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");

      const selected = await open({
        multiple: false,
        filters: [
          {
            name: t("iconPicker.images", "Images"),
            extensions: ["png", "jpg", "jpeg", "gif", "webp", "svg"],
          },
        ],
      });

      if (selected && typeof selected === "string") {
        clearError();
        const result = await uploadFile(selected);
        if (result) {
          setPreview(result);
          if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
          previewTimerRef.current = setTimeout(() => onSelect(result), 1200);
          return;
        }
      }
    } catch (err) {
      console.error("Failed to open file dialog:", err);
    }
  }, [uploadFile, onSelect, clearError]);

  /**
   * Handle URL download
   */
  const handleUrlDownload = useCallback(async () => {
    if (!urlInput.trim()) return;

    clearError();
    const result = await uploadUrl(urlInput.trim());
    if (result) {
      setUrlInput("");
      setPreview(result);
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
      previewTimerRef.current = setTimeout(() => onSelect(result), 1200);
      return;
    }
  }, [urlInput, uploadUrl, onSelect, clearError]);

  /**
   * Handle Enter key in URL input
   */
  const handleUrlKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !uploading) {
        handleUrlDownload();
      }
    },
    [handleUrlDownload, uploading]
  );

  return (
    <div className="flex flex-col p-3 space-y-3">
      {/* Mode toggle */}
      <div className="flex gap-1 p-1 bg-muted rounded-md">
        <Button
          variant={mode === "upload" ? "secondary" : "ghost"}
          size="sm"
          className="flex-1 h-7 text-xs"
          onClick={() => {
            setMode("upload");
            clearError();
          }}
        >
          <Upload className="h-3.5 w-3.5 mr-1.5" />
          {t("iconPicker.upload", "Upload")}
        </Button>
        <Button
          variant={mode === "url" ? "secondary" : "ghost"}
          size="sm"
          className="flex-1 h-7 text-xs"
          onClick={() => {
            setMode("url");
            clearError();
          }}
        >
          <Link className="h-3.5 w-3.5 mr-1.5" />
          {t("iconPicker.fromUrl", "From URL")}
        </Button>
      </div>

      {/* Upload mode */}
      {mode === "upload" && (
        <div className="space-y-2">
          <Button
            variant="outline"
            className="w-full h-20 border-dashed"
            onClick={handleFileSelect}
            disabled={uploading || !workspacePath}
          >
            {uploading ? (
              <div className="flex flex-col items-center gap-1">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-xs text-muted-foreground">
                  {t("iconPicker.uploading", "Uploading...")}
                </span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1">
                <Upload className="h-5 w-5" />
                <span className="text-xs text-muted-foreground">
                  {t("iconPicker.clickToUpload", "Click to upload")}
                </span>
              </div>
            )}
          </Button>
        </div>
      )}

      {/* URL mode */}
      {mode === "url" && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <Input
              placeholder={t("iconPicker.urlPlaceholder", "https://example.com/icon.png")}
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={handleUrlKeyDown}
              disabled={uploading || !workspacePath}
              className="h-8 text-xs"
            />
            <Button
              size="sm"
              className="h-8 px-3"
              onClick={handleUrlDownload}
              disabled={uploading || !urlInput.trim() || !workspacePath}
            >
              {uploading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                t("iconPicker.download", "Download")
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Preview */}
      {preview && (
        <div className="flex flex-col items-center gap-2 p-3">
          <div className="relative h-16 w-16 rounded-lg overflow-hidden border">
            <img
              src={(() => {
                if (!workspacePath) return preview;
                const gatewayUrl = import.meta.env.VITE_GATEWAY_URL || "http://127.0.0.1:18790";
                return `${gatewayUrl}/api/file/read?workspace_path=${encodeURIComponent(workspacePath)}&file_path=${encodeURIComponent(preview)}`;
              })()}
              alt="Preview"
              className="h-full w-full object-cover"
            />
          </div>
          <span className="text-xs text-muted-foreground">
            {t("iconPicker.uploaded", "Uploaded!")}
          </span>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="flex items-center gap-2 p-2 text-xs text-destructive bg-destructive/10 rounded-md">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Workspace path warning */}
      {!workspacePath && (
        <div className="flex items-center gap-2 p-2 text-xs text-amber-600 bg-amber-500/10 rounded-md">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>{t("iconPicker.noWorkspace", "Workspace required for image upload")}</span>
        </div>
      )}
    </div>
  );
}

export default ImageTab;
