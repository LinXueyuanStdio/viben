/**
 * PDF Preview Component
 *
 * Displays PDF files using browser's native PDF viewer (iframe).
 * Supports both local files (via Tauri fs plugin) and remote URLs.
 */

import * as React from "react";
import { useTranslation } from "react-i18next";
import { readFile, stat } from "@tauri-apps/plugin-fs";
import { FileText, Loader2 } from "lucide-react";

import type { PreviewComponentProps } from "./types";
import { isRemoteUrl, MAX_PREVIEW_SIZE, formatFileSize } from "./utils";

export function PdfPreview({ artifact }: PreviewComponentProps) {
  const { t } = useTranslation();
  const [pdfUrl, setPdfUrl] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [fileTooLarge, setFileTooLarge] = React.useState<number | null>(null);

  React.useEffect(() => {
    let blobUrl: string | null = null;

    async function loadPdf() {
      // If content is a data URL, use it directly
      if (artifact.content && artifact.content.startsWith("data:")) {
        setPdfUrl(artifact.content);
        setLoading(false);
        return;
      }

      if (!artifact.path) {
        setError("No PDF file path available");
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

        let blob: Blob;

        if (isRemoteUrl(artifact.path)) {
          // Remote URL - fetch the PDF
          const url = artifact.path.startsWith("//")
            ? `https:${artifact.path}`
            : artifact.path;
          const response = await fetch(url);
          if (!response.ok) {
            throw new Error(
              `Failed to fetch PDF: ${response.status} ${response.statusText}`
            );
          }
          blob = await response.blob();
        } else {
          // Local file - use Tauri fs plugin
          const data = await readFile(artifact.path);
          blob = new Blob([data], { type: "application/pdf" });
        }

        blobUrl = URL.createObjectURL(blob);
        setPdfUrl(blobUrl);
        setError(null);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        setError(errorMsg);
      } finally {
        setLoading(false);
      }
    }

    loadPdf();

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
        <p className="text-muted-foreground mt-4 text-sm">{t("artifacts.loadingPdf", "Loading PDF...")}</p>
      </div>
    );
  }

  if (fileTooLarge !== null) {
    return (
      <div className="bg-muted/20 flex h-full flex-col items-center justify-center p-8">
        <div className="flex max-w-md flex-col items-center text-center">
          <div className="border-border bg-background mb-4 flex size-20 items-center justify-center rounded-xl border">
            <FileText className="text-muted-foreground size-10" />
          </div>
          <h3 className="text-foreground mb-2 text-lg font-medium">
            {artifact.name}
          </h3>
          <p className="text-muted-foreground text-sm">
            {t("artifacts.fileTooLarge", "File too large to preview")} ({formatFileSize(fileTooLarge)})
          </p>
          <p className="text-muted-foreground mt-2 text-xs">
            {t("artifacts.openInPdfViewerHint", "Use the external link button to open in your PDF viewer")}
          </p>
        </div>
      </div>
    );
  }

  if (error || !pdfUrl) {
    return (
      <div className="bg-muted/20 flex h-full flex-col items-center justify-center p-8">
        <div className="flex max-w-md flex-col items-center text-center">
          <div className="border-border bg-background mb-4 flex size-20 items-center justify-center rounded-xl border">
            <FileText className="size-10 text-red-500" />
          </div>
          <h3 className="text-foreground mb-2 text-lg font-medium">
            {artifact.name}
          </h3>
          <p className="text-muted-foreground text-sm break-all whitespace-pre-wrap">
            {error || "No PDF file path available"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-muted/20 h-full">
      <iframe
        src={pdfUrl}
        className="h-full w-full border-0"
        title={artifact.name}
      />
    </div>
  );
}
