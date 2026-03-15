/**
 * Spreadsheet Preview Component
 *
 * Displays Excel spreadsheets (xlsx, xls, ods).
 * Since parsing these formats requires additional dependencies (xlsx),
 * this component provides a fallback to open in external application.
 */

import { openUrl as openExternal } from "@tauri-apps/plugin-opener";
import { useTranslation } from "react-i18next";
import { ExternalLink, FileSpreadsheet } from "lucide-react";

import type { PreviewComponentProps } from "./types";

export function XlsxPreview({ artifact }: PreviewComponentProps) {
  const { t } = useTranslation();
  const handleOpenExternal = async () => {
    if (artifact.path) {
      try {
        await openExternal(artifact.path);
      } catch (err) {
        console.error("Failed to open file externally:", err);
      }
    }
  };

  return (
    <div className="bg-muted/20 flex h-full flex-col items-center justify-center p-8">
      <div className="flex max-w-md flex-col items-center text-center">
        <div className="border-border bg-background mb-4 flex size-20 items-center justify-center rounded-xl border">
          <FileSpreadsheet className="size-10 text-green-600" />
        </div>
        <h3 className="text-foreground mb-2 text-lg font-medium">
          {artifact.name}
        </h3>
        <p className="text-muted-foreground mb-6 text-sm">
          {t("artifacts.xlsxPreview.description")}
        </p>
        <button
          onClick={handleOpenExternal}
          className="bg-primary text-primary-foreground hover:bg-primary/90 flex cursor-pointer items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
        >
          <ExternalLink className="size-4" />
          {t("artifacts.xlsxPreview.openButton")}
        </button>
      </div>
    </div>
  );
}
