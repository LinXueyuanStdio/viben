/**
 * PageSettingPanel Component
 *
 * A settings panel for workspace pages showing page info and export options.
 * Displayed in the "Setting" tab of the workspace page view.
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Download, FolderOpen, Info, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import { getGatewayUrl } from "@/lib/gateway/config";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";

// ============================================================================
// Types
// ============================================================================

export interface PageSettingPanelProps {
  /** Workspace path */
  workspacePath: string;
  /** Page slug identifier */
  pageSlug: string;
  /** Display name of the page */
  pageName: string;
  /** Page type (e.g., "static", "server", "markdown", "proxy") */
  pageType: string;
  /** Additional class names */
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

export function PageSettingPanel({
  workspacePath,
  pageSlug,
  pageName,
  pageType,
  className,
}: PageSettingPanelProps) {
  const { t } = useTranslation();
  const [isDownloading, setIsDownloading] = useState(false);

  const directoryPath = `pages/${pageSlug}`;

  const handleDownloadZip = async () => {
    const baseUrl = getGatewayUrl();
    const params = new URLSearchParams({
      workspace_path: workspacePath,
      dir_path: `pages/${pageSlug}`,
    });

    setIsDownloading(true);
    try {
      const response = await fetch(
        `${baseUrl}/api/files/download-zip?${params.toString()}`
      );
      if (!response.ok) throw new Error("Download failed");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${pageSlug}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t("page.downloadSuccess", "Download started"));
    } catch (error) {
      console.error("[PageSettingPanel] download failed:", error);
      toast.error(t("page.downloadFailed", "Download failed"));
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div
      className={cn(
        "flex h-full items-start justify-center overflow-auto p-8",
        className
      )}
    >
      <div className="w-full max-w-lg space-y-6">
        {/* Page Info Section */}
        <section className="rounded-lg border border-border bg-card p-6">
          <div className="mb-4 flex items-center gap-2">
            <Info className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">
              {t("page.settings.pageInfo", "Page Info")}
            </h2>
          </div>

          <dl className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">
                {t("page.settings.name", "Name")}
              </dt>
              <dd className="font-medium text-foreground">{pageName}</dd>
            </div>

            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">
                {t("page.settings.type", "Type")}
              </dt>
              <dd className="font-medium text-foreground">
                <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-0.5 text-xs">
                  <Package className="h-3 w-3" />
                  {pageType}
                </span>
              </dd>
            </div>

            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">
                {t("page.settings.slug", "Slug")}
              </dt>
              <dd className="font-mono text-xs text-foreground">{pageSlug}</dd>
            </div>

            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">
                {t("page.settings.directory", "Directory")}
              </dt>
              <dd className="flex items-center gap-1.5 font-mono text-xs text-foreground">
                <FolderOpen className="h-3 w-3 text-muted-foreground" />
                {directoryPath}
              </dd>
            </div>
          </dl>
        </section>

        {/* Export Section */}
        <section className="rounded-lg border border-border bg-card p-6">
          <div className="mb-4 flex items-center gap-2">
            <Download className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">
              {t("page.settings.export", "Export")}
            </h2>
          </div>

          <p className="mb-4 text-xs text-muted-foreground">
            {t(
              "page.settings.exportDescription",
              "Download the entire page directory as a ZIP archive."
            )}
          </p>

          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadZip}
            disabled={isDownloading}
          >
            <Download className="mr-2 h-4 w-4" />
            {isDownloading
              ? t("page.settings.downloading", "Downloading...")
              : t("page.settings.downloadZip", "Download as ZIP")}
          </Button>
        </section>
      </div>
    </div>
  );
}

export default PageSettingPanel;
