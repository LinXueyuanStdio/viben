/**
 * PageSettingPanel Component
 *
 * A settings panel for workspace pages showing page info and export options.
 * Displayed in the "Setting" tab of the workspace page view.
 */

import { useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useTranslation } from "react-i18next";
import {
  CheckCircle2,
  Download,
  ExternalLink,
  FolderOpen,
  Info,
  Package,
  UploadCloud,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getGatewayUrl } from "@/lib/gateway/config";
import { publishPage, readFile, viewPage } from "@/lib/gateway";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth-store";
import {
  getPagePublishKey,
  usePagePublishStore,
} from "@/stores/page-publish-store";

// ============================================================================
// Types
// ============================================================================

export interface PageSettingPanelProps {
  /** Workspace path */
  workspacePath: string;
  /** Page slug identifier */
  pageUid: string;
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

const VIBEN_WEB_URL = "https://viben-web.vercel.app";

function toExternalPublishedPageUrl(url: string): string {
  return new URL(url, VIBEN_WEB_URL).toString();
}

export function PageSettingPanel({
  workspacePath,
  pageUid,
  pageName,
  pageType,
  className,
}: PageSettingPanelProps) {
  const { t } = useTranslation();
  const [isDownloading, setIsDownloading] = useState(false);
  const accessToken = useAuthStore((state) => state.user?.accessToken);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const publishKey = getPagePublishKey(workspacePath, pageUid);
  const publishEntry = usePagePublishStore((state) => state.entries[publishKey]);
  const publishActions = usePagePublishStore((state) => state.actions);
  const publishedUrl = publishEntry?.url ?? null;
  const isPublishing = publishEntry?.status === "publishing";

  const directoryPath = `pages/${pageUid}`;

  const handleDownloadZip = async () => {
    const baseUrl = getGatewayUrl();
    const params = new URLSearchParams({
      workspace_path: workspacePath,
      dir_path: `pages/${pageUid}`,
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
      a.download = `${pageUid}.zip`;
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

  const handlePublish = async () => {
    if (!isAuthenticated || !accessToken) {
      toast.error(t("page.settings.publishLoginRequired", "Sign in to publish this page"));
      return;
    }

    const baseUrl = getGatewayUrl();
    publishActions.startPublish(publishKey);
    try {
      const { page } = await viewPage(baseUrl, workspacePath, pageUid);
      if (!page || page.type !== "static") {
        throw new Error(t("page.settings.publishStaticOnly", "Only static pages can be published"));
      }

      const entryPath = `${workspacePath}/pages/${pageUid}/${page.file}`;
      const { content } = await readFile(baseUrl, entryPath);
      const result = await publishPage(baseUrl, {
        access_token: accessToken,
        uid: page.uid,
        title: page.name,
        icon: page.icon ?? null,
        description: page.description ?? null,
        html: content,
      });

      if (!result.success || !result.url) {
        throw new Error(
          result.error ??
            t(
              "page.settings.publishMissingUrl",
              "Publish did not return a page URL"
            )
        );
      }

      publishActions.finishPublish(publishKey, result.url);

      toast.success(t("page.settings.publishSuccess", "Page published"), {
        description: result.url,
      });
    } catch (error) {
      console.error("[PageSettingPanel] publish failed:", error);
      const message = error instanceof Error ? error.message : String(error);
      publishActions.failPublish(publishKey, message);
      toast.error(t("page.settings.publishFailed", "Publish failed"), {
        description: message,
      });
    }
  };

  const handleOpenPublishedPage = async () => {
    if (!publishedUrl) return;
    const externalUrl = toExternalPublishedPageUrl(publishedUrl);
    try {
      await openUrl(externalUrl);
    } catch {
      window.open(externalUrl, "_blank");
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
              <dd className="font-mono text-xs text-foreground">{pageUid}</dd>
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

        {pageType === "static" && (
          <section className="rounded-lg border border-border bg-card p-6">
            <div className="mb-4 flex items-center gap-2">
              <UploadCloud className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">
                {t("page.settings.publish", "Publish")}
              </h2>
            </div>

            <p className="mb-4 text-xs text-muted-foreground">
              {isAuthenticated
                ? t(
                    "page.settings.publishDescription",
                    "Publish this static HTML page to the cloud."
                  )
                : t(
                    "page.settings.publishLoginDescription",
                    "Sign in to publish this static HTML page to the cloud."
                  )}
            </p>

            {publishedUrl && (
              <div className="mb-4 rounded-md border border-border bg-muted/50 p-3">
                <div className="mb-2 flex items-center gap-2 text-xs font-medium text-foreground">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  {t("page.settings.published", "Published")}
                </div>
                <div className="space-y-3">
                  <div className="break-all font-mono text-xs text-muted-foreground">
                    {publishedUrl}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleOpenPublishedPage}
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    {t("page.settings.openPublishedPage", "Open in Browser")}
                  </Button>
                </div>
              </div>
            )}

            <Button
              variant="default"
              size="sm"
              onClick={handlePublish}
              disabled={isPublishing || !isAuthenticated}
            >
              <UploadCloud className="mr-2 h-4 w-4" />
              {isPublishing
                ? t("page.settings.publishing", "Publishing...")
                : publishedUrl
                  ? t("page.settings.updatePublishButton", "Update Publish")
                  : t("page.settings.publishButton", "Publish")}
            </Button>
          </section>
        )}

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
