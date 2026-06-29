/**
 * PageSettingPanel Component
 *
 * A settings panel for workspace pages showing page info and export options.
 * Displayed in the "Setting" tab of the workspace page view.
 */

import { useEffect, useState } from "react";
import type { ComponentType, ReactNode } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  ChevronRight,
  Code2,
  Copy,
  Download,
  ExternalLink,
  FolderOpen,
  Globe,
  History,
  Info,
  Link2,
  Mail,
  MessageCircle,
  Package,
  RotateCcw,
  Search,
  Share2,
  Tags,
  UploadCloud,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getGatewayUrl } from "@/lib/gateway/config";
import {
  getPublishedPageStatus,
  getPublishedPageHistory,
  getPublishedPageVersion,
  publishPage,
  readFile,
  rollbackPublishedPage,
  viewPage,
  writeFile,
} from "@/lib/gateway";
import type { PublishedPageHistoryRecord } from "@/lib/gateway";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAuthStore } from "@/stores/auth-store";
import {
  getPagePublishKey,
  usePagePublishStore,
} from "@/stores/page-publish-store";
import { useAnalytics } from "@/lib/analytics";
import { AnalyticsEvents } from "@/lib/analytics/types";

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

type PublishSettingsView = "overview" | "seo" | "embed" | "share";

function toExternalPublishedPageUrl(url: string): string {
  return new URL(url, VIBEN_WEB_URL).toString();
}

function buildEmbedCode(url: string): string {
  return `<iframe src="${url}" width="100%" height="600" frameborder="0" allowfullscreen />`;
}

function formatPublishRecordTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

interface PublishActionRowProps {
  icon: ComponentType<{ className?: string }>;
  label: string;
  onClick?: () => void;
  trailing?: ReactNode;
}

function PublishActionRow({
  icon: Icon,
  label,
  onClick,
  trailing = <ChevronRight className="h-4 w-4 text-muted-foreground" />,
}: PublishActionRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-muted"
    >
      <Icon className="h-4 w-4 text-muted-foreground" />
      <span className="min-w-0 flex-1 text-foreground">{label}</span>
      {trailing}
    </button>
  );
}

export function PageSettingPanel({
  workspacePath,
  pageUid,
  pageName,
  pageType,
  className,
}: PageSettingPanelProps) {
  const { t } = useTranslation();
  const { logEvent } = useAnalytics();
  const [isDownloading, setIsDownloading] = useState(false);
  const [publishSettingsView, setPublishSettingsView] =
    useState<PublishSettingsView>("overview");
  const [seoDiscoverable, setSeoDiscoverable] = useState(true);
  const [showEmbedTitle, setShowEmbedTitle] = useState(true);
  const [seoTitle, setSeoTitle] = useState(pageName);
  const [seoDescription, setSeoDescription] = useState("");
  const [publishHistory, setPublishHistory] = useState<PublishedPageHistoryRecord[]>([]);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isRollingBack, setIsRollingBack] = useState(false);
  const [isApplyingVersion, setIsApplyingVersion] = useState(false);
  const accessToken = useAuthStore((state) => state.user?.accessToken);
  const userSlug = useAuthStore((state) => state.user?.userSlug);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const publishKey = getPagePublishKey(workspacePath, pageUid);
  const publishEntry = usePagePublishStore((state) => state.entries[publishKey]);
  const publishActions = usePagePublishStore((state) => state.actions);
  const publishedUrl = publishEntry?.url ?? null;
  const isPublishing = publishEntry?.status === "publishing";
  const externalPublishedUrl = publishedUrl
    ? toExternalPublishedPageUrl(publishedUrl)
    : null;
  const embedCode = externalPublishedUrl ? buildEmbedCode(externalPublishedUrl) : "";
  const selectedRecord =
    publishHistory.find((record) => record.id === selectedRecordId) ??
    publishHistory[0] ??
    null;

  const directoryPath = `pages/${pageUid}`;

  const loadPublishHistory = async (sessionAccessToken: string) => {
    setIsLoadingHistory(true);
    try {
      const result = await getPublishedPageHistory(getGatewayUrl(), {
        access_token: sessionAccessToken,
        uid: pageUid,
      });

      if (result.success) {
        const records = result.records ?? [];
        setPublishHistory(records);
        setSelectedRecordId((current) => {
          if (current && records.some((record) => record.id === current)) {
            return current;
          }
          return records[0]?.id ?? null;
        });
      }
    } catch (error) {
      console.error("[PageSettingPanel] load publish history failed:", error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (pageType !== "static") {
      return;
    }

    if (!isAuthenticated || !accessToken || !userSlug) {
      publishActions.clearPublish(publishKey);
      return;
    }

    let cancelled = false;
    const sessionAccessToken = accessToken;
    const sessionUserSlug = userSlug;
    const initialUpdatedAt =
      usePagePublishStore.getState().entries[publishKey]?.updatedAt ?? null;

    async function loadPublishedStatus() {
      try {
        const result = await getPublishedPageStatus(getGatewayUrl(), {
          access_token: sessionAccessToken,
          user_slug: sessionUserSlug,
          uid: pageUid,
        });

        if (cancelled) {
          return;
        }

        const currentUpdatedAt =
          usePagePublishStore.getState().entries[publishKey]?.updatedAt ?? null;
        if (currentUpdatedAt !== initialUpdatedAt) {
          return;
        }

        if (result.success && result.published && result.url) {
          publishActions.finishPublish(publishKey, result.url);
          void loadPublishHistory(sessionAccessToken);
          return;
        }

        publishActions.clearPublish(publishKey);
        setPublishHistory([]);
        setSelectedRecordId(null);
      } catch (error) {
        if (!cancelled) {
          console.error("[PageSettingPanel] load publish status failed:", error);
        }
      }
    }

    void loadPublishedStatus();

    return () => {
      cancelled = true;
    };
  }, [
    accessToken,
    isAuthenticated,
    pageType,
    pageUid,
    publishActions,
    publishKey,
    userSlug,
  ]);

  const copyText = async (text: string, successMessage: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(successMessage);
    } catch (error) {
      console.error("[PageSettingPanel] copy failed:", error);
      toast.error(t("common.copyFailed", "Failed to copy"));
    }
  };

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
    const startTime = Date.now();
    publishActions.startPublish(publishKey);
    try {
      logEvent(AnalyticsEvents.PAGE_PUBLISH_STARTED, {
        page_id: pageUid,
        page_type: pageType,
      });
    } catch {}

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
      void loadPublishHistory(accessToken);

      toast.success(t("page.settings.publishSuccess", "Page published"), {
        description: result.url,
      });
      try {
        logEvent(AnalyticsEvents.PAGE_PUBLISH_COMPLETED, {
          page_id: pageUid,
          publish_url: result.url,
          duration_ms: Date.now() - startTime,
          asset_count: 0,
        });
      } catch {}
    } catch (error) {
      console.error("[PageSettingPanel] publish failed:", error);
      const message = error instanceof Error ? error.message : String(error);
      publishActions.failPublish(publishKey, message);
      toast.error(t("page.settings.publishFailed", "Publish failed"));
      try {
        logEvent(AnalyticsEvents.PAGE_PUBLISH_FAILED, {
          page_id: pageUid,
          error_type: error instanceof Error ? error.name : "UnknownError",
          error_message: message,
          duration_ms: Date.now() - startTime,
        });
      } catch {}
    }
  };

  const handleOpenPublishedPage = async () => {
    if (!externalPublishedUrl) return;
    try {
      await openUrl(externalPublishedUrl);
    } catch {
      window.open(externalPublishedUrl, "_blank");
    }
  };

  const handleOpenSelectedVersion = async () => {
    if (!selectedRecord) return;
    const versionUrl = toExternalPublishedPageUrl(selectedRecord.url);
    try {
      await openUrl(versionUrl);
    } catch {
      window.open(versionUrl, "_blank");
    }
  };

  const handleRollbackSelectedVersion = async () => {
    if (!selectedRecord || selectedRecord.is_current || !accessToken) return;

    setIsRollingBack(true);
    try {
      const result = await rollbackPublishedPage(getGatewayUrl(), {
        access_token: accessToken,
        uid: pageUid,
        version: selectedRecord.version,
      });

      if (!result.success || !result.url) {
        throw new Error(
          result.error ?? t("page.settings.rollbackFailed", "Rollback failed")
        );
      }

      publishActions.finishPublish(publishKey, result.url);
      await loadPublishHistory(accessToken);
      toast.success(t("page.settings.rollbackComplete", "Rollback complete"));
    } catch (error) {
      console.error("[PageSettingPanel] rollback failed:", error);
      toast.error(t("page.settings.rollbackFailed", "Rollback failed"));
    } finally {
      setIsRollingBack(false);
    }
  };

  const handleApplySelectedVersionToLocalHtml = async () => {
    if (!selectedRecord || !accessToken) return;

    setIsApplyingVersion(true);
    try {
      const baseUrl = getGatewayUrl();
      const [{ page }, versionResult] = await Promise.all([
        viewPage(baseUrl, workspacePath, pageUid),
        getPublishedPageVersion(baseUrl, {
          access_token: accessToken,
          uid: pageUid,
          version: selectedRecord.version,
        }),
      ]);

      if (!page || page.type !== "static") {
        throw new Error(t("page.settings.publishStaticOnly", "Only static pages can be published"));
      }

      if (!versionResult.success || typeof versionResult.html !== "string") {
        throw new Error(
          versionResult.error ??
            t("page.settings.versionHtmlMissing", "Version HTML missing")
        );
      }

      await writeFile(
        baseUrl,
        `${workspacePath}/pages/${pageUid}/${page.file}`,
        versionResult.html
      );
      toast.success(t("page.settings.localHtmlUpdated", "Local HTML updated"));
    } catch (error) {
      console.error("[PageSettingPanel] apply cloud version failed:", error);
      toast.error(t("page.settings.localHtmlUpdateFailed", "Update failed"));
    } finally {
      setIsApplyingVersion(false);
    }
  };

  const handleSocialShare = async (target: "x" | "whatsapp" | "facebook" | "linkedin" | "email") => {
    if (!externalPublishedUrl) return;
    const encodedUrl = encodeURIComponent(externalPublishedUrl);
    const encodedTitle = encodeURIComponent(pageName);
    const targets: Record<typeof target, string> = {
      x: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`,
      whatsapp: `https://wa.me/?text=${encodedTitle}%20${encodedUrl}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
      email: `mailto:?subject=${encodedTitle}&body=${encodedUrl}`,
    };
    try {
      await openUrl(targets[target]);
    } catch {
      window.open(targets[target], "_blank");
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

            {publishedUrl && externalPublishedUrl && (
              <div className="mb-4 rounded-md border border-border bg-muted/50 p-3">
                {publishSettingsView === "overview" && (
                  <div className="space-y-3">
                    <div className="flex min-w-0 items-center rounded-md border border-border bg-background">
                      <div className="shrink-0 border-r border-border px-2 py-2 font-mono text-xs text-muted-foreground">
                        {VIBEN_WEB_URL}
                      </div>
                      <div className="min-w-0 flex-1 truncate px-2 py-2 font-mono text-xs text-foreground">
                        {publishedUrl}
                      </div>
                      <button
                        type="button"
                        aria-label="Copy published URL"
                        onClick={() =>
                          copyText(
                            externalPublishedUrl,
                            t("page.settings.copyPublishedUrlSuccess", "Link copied")
                          )
                        }
                        className="flex h-8 w-8 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        aria-label="Open published page"
                        onClick={handleOpenPublishedPage}
                        className="flex h-8 w-8 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="space-y-1">
                      <PublishActionRow
                        icon={Search}
                        label="搜索引擎索引"
                        onClick={() => setPublishSettingsView("seo")}
                      />
                    </div>
                    <div className="border-t border-border" />
                    <div className="space-y-1">
                      <PublishActionRow
                        icon={Code2}
                        label="嵌入此页面"
                        onClick={() => setPublishSettingsView("embed")}
                      />
                      <PublishActionRow
                        icon={Share2}
                        label="分享到社交平台"
                        onClick={() => setPublishSettingsView("share")}
                      />
                    </div>
                    <div className="border-t border-border" />
                    <div className="space-y-1">
                      <PublishActionRow
                        icon={ExternalLink}
                        label="在浏览器打开"
                        onClick={handleOpenPublishedPage}
                        trailing={null}
                      />
                    </div>
                  </div>
                )}

                {publishSettingsView === "seo" && (
                  <div className="space-y-4">
                    <button
                      type="button"
                      aria-label="Back to publish settings"
                      onClick={() => setPublishSettingsView("overview")}
                      className="flex items-center gap-2 text-sm font-medium text-foreground"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      搜索引擎索引
                    </button>
                    <div className="flex items-center gap-3 rounded-md px-2 py-2">
                      <Globe className="h-4 w-4 text-muted-foreground" />
                      <span className="min-w-0 flex-1 text-sm text-foreground">
                        可在网络上被发现
                      </span>
                      <Switch
                        checked={seoDiscoverable}
                        onCheckedChange={setSeoDiscoverable}
                        aria-label="可在网络上被发现"
                      />
                    </div>
                    <div className="border-t border-border" />
                    <div className="space-y-3">
                      <div className="text-sm font-medium text-foreground">
                        SEO 预览
                      </div>
                      <div className="rounded-md border border-border bg-background p-3">
                        <div className="truncate text-sm font-medium text-blue-600">
                          {seoTitle || pageName}
                        </div>
                        <div className="truncate text-xs text-green-700">
                          {externalPublishedUrl}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {seoDescription || "Demo description"}
                        </div>
                      </div>
                      <label className="block space-y-1 text-sm">
                        <span className="font-medium text-foreground">
                          链接标题
                        </span>
                        <Input
                          value={seoTitle}
                          onChange={(event) => setSeoTitle(event.target.value)}
                        />
                      </label>
                      <label className="block space-y-1 text-sm">
                        <span className="font-medium text-foreground">描述</span>
                        <Textarea
                          value={seoDescription}
                          onChange={(event) =>
                            setSeoDescription(event.target.value)
                          }
                          className="min-h-[84px]"
                        />
                      </label>
                    </div>
                  </div>
                )}

                {publishSettingsView === "embed" && (
                  <div className="space-y-4">
                    <button
                      type="button"
                      aria-label="Back to publish settings"
                      onClick={() => setPublishSettingsView("overview")}
                      className="flex items-center gap-2 text-sm font-medium text-foreground"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      嵌入此页面
                    </button>
                    <div className="flex items-center gap-3 rounded-md px-2 py-2">
                      <Tags className="h-4 w-4 text-muted-foreground" />
                      <span className="min-w-0 flex-1 text-sm text-foreground">
                        显示页面标题
                      </span>
                      <Switch
                        checked={showEmbedTitle}
                        onCheckedChange={setShowEmbedTitle}
                        aria-label="显示页面标题"
                      />
                    </div>
                    <div className="border-t border-border" />
                    <label className="block space-y-2 text-sm">
                      <span className="sr-only">嵌入代码</span>
                      <Textarea
                        aria-label="嵌入代码"
                        value={embedCode}
                        readOnly
                        className="min-h-[108px] font-mono text-xs"
                      />
                    </label>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        copyText(
                          embedCode,
                          t("page.settings.copyEmbedSuccess", "Embed code copied")
                        )
                      }
                    >
                      <Copy className="mr-2 h-4 w-4" />
                      复制代码
                    </Button>
                  </div>
                )}

                {publishSettingsView === "share" && (
                  <div className="space-y-3">
                    <button
                      type="button"
                      aria-label="Back to publish settings"
                      onClick={() => setPublishSettingsView("overview")}
                      className="flex items-center gap-2 text-sm font-medium text-foreground"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      分享到社交平台
                    </button>
                    <div className="space-y-1">
                      <PublishActionRow
                        icon={Share2}
                        label="分享到 X"
                        onClick={() => handleSocialShare("x")}
                        trailing={null}
                      />
                      <PublishActionRow
                        icon={MessageCircle}
                        label="分享到 Whatsapp"
                        onClick={() => handleSocialShare("whatsapp")}
                        trailing={null}
                      />
                      <PublishActionRow
                        icon={Globe}
                        label="分享到 Facebook"
                        onClick={() => handleSocialShare("facebook")}
                        trailing={null}
                      />
                      <PublishActionRow
                        icon={Link2}
                        label="分享到 Linkin"
                        onClick={() => handleSocialShare("linkedin")}
                        trailing={null}
                      />
                    </div>
                    <div className="border-t border-border" />
                    <PublishActionRow
                      icon={Mail}
                      label="分享到 电子邮件"
                      onClick={() => handleSocialShare("email")}
                      trailing={null}
                    />
                  </div>
                )}
              </div>
            )}

            {publishedUrl && (
              <div className="mb-4 rounded-md border border-border bg-muted/50 p-3">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <History className="h-4 w-4 text-muted-foreground" />
                    <h3 className="text-sm font-medium text-foreground">
                      {t("page.settings.publishHistory", "Publish history")}
                    </h3>
                  </div>
                  {isLoadingHistory && (
                    <span className="text-xs text-muted-foreground">
                      {t("page.settings.loadingHistory", "Loading...")}
                    </span>
                  )}
                </div>

                {publishHistory.length > 0 ? (
                  <div className="space-y-3">
                    <div className="max-h-48 space-y-1 overflow-auto">
                      {publishHistory.map((record) => {
                        const selected = selectedRecord?.id === record.id;
                        return (
                          <button
                            key={record.id}
                            type="button"
                            onClick={() => setSelectedRecordId(record.id)}
                            className={cn(
                              "flex w-full items-center justify-between gap-3 rounded-md px-2 py-2 text-left text-sm transition-colors",
                              selected
                                ? "bg-background text-foreground"
                                : "text-muted-foreground hover:bg-background/70 hover:text-foreground"
                            )}
                          >
                            <span className="min-w-0">
                              <span className="block font-medium">
                                {t("page.settings.versionLabel", "Version")}{" "}
                                {record.version}
                              </span>
                              <span className="block truncate text-xs">
                                {record.action === "rollback"
                                  ? t("page.settings.rollbackAction", "Rollback")
                                  : t("page.settings.publishAction", "Publish")}{" "}
                                · {formatPublishRecordTime(record.created_at)}
                              </span>
                            </span>
                            {record.is_current && (
                              <span className="shrink-0 rounded-sm bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary">
                                {t("page.settings.currentVersion", "Current")}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    <div className="flex flex-wrap gap-2 border-t border-border pt-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleOpenSelectedVersion}
                        disabled={!selectedRecord}
                      >
                        <ExternalLink className="mr-2 h-4 w-4" />
                        {t("page.settings.openVersion", "Open version")}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRollbackSelectedVersion}
                        disabled={
                          !selectedRecord ||
                          selectedRecord.is_current ||
                          isRollingBack
                        }
                      >
                        <RotateCcw className="mr-2 h-4 w-4" />
                        {isRollingBack
                          ? t("page.settings.rollingBack", "Rolling back...")
                          : t("page.settings.rollbackAction", "Rollback")}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleApplySelectedVersionToLocalHtml}
                        disabled={!selectedRecord || isApplyingVersion}
                      >
                        <Download className="mr-2 h-4 w-4" />
                        {isApplyingVersion
                          ? t("page.settings.updatingLocalHtml", "Updating...")
                          : t(
                              "page.settings.useAsLocalHtml",
                              "Use as local HTML"
                            )}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {isLoadingHistory
                      ? t("page.settings.historyLoadingDescription", "Loading publish history.")
                      : t("page.settings.noPublishHistory", "No publish history yet.")}
                  </p>
                )}
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
