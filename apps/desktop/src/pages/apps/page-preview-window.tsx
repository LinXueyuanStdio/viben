import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, FileQuestion } from "lucide-react";
import { PagePreview } from "./components";
import type { PageViewMode } from "./components/page-preview";
import { usePage } from "@/hooks/use-pages";
import { useVitePreview } from "@/hooks/use-vite-preview";
import { cn } from "@/lib/utils";

function getSearchParam(name: string): string | undefined {
  const value = new URLSearchParams(window.location.search).get(name);
  return value?.trim() || undefined;
}

function normalizeViewMode(value: string | undefined): PageViewMode {
  return value === "skill" ? "skill" : "page";
}

export function PagePreviewWindow() {
  const { t } = useTranslation();
  const workspaceId = getSearchParam("workspace_id");
  const workspacePath = getSearchParam("workspace_path");
  const slug = getSearchParam("slug");
  const initialViewMode = useMemo(
    () => normalizeViewMode(getSearchParam("view")),
    []
  );
  const [viewMode] = useState<PageViewMode>(initialViewMode);
  const [iframeKey] = useState(0);

  const {
    data: page,
    isLoading,
    error,
  } = usePage(workspacePath, slug);

  const pageId = useMemo(() => {
    if (!page?.slug) return null;
    return `page-${page.slug}`;
  }, [page?.slug]);

  const {
    previewUrl,
    status: previewStatus,
    error: previewError,
    startPreview,
    stopPreview,
  } = useVitePreview(pageId);

  const handleStartLivePreview = useCallback(() => {
    if (!workspacePath || !page) return;
    startPreview(`${workspacePath}/pages/${page.slug}`);
  }, [page, startPreview, workspacePath]);

  if (!workspaceId || !workspacePath || !slug) {
    return (
      <WindowState
        title={t("page.invalidPath", "Invalid Page Path")}
        message={t("page.invalidPathDesc", "The page path format is invalid.")}
      />
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-sm">{t("common.loading")}</p>
        </div>
      </div>
    );
  }

  if (!page || error) {
    return (
      <WindowState
        title={t("page.notFound", "Page Not Found")}
        message={
          error
            ? String(error)
            : t("page.notFoundDesc", "The requested page could not be found in this workspace.")
        }
      />
    );
  }

  return (
    <div className="h-screen w-screen overflow-hidden bg-background">
      <PagePreview
        page={page}
        workspacePath={workspacePath}
        workspaceId={workspaceId}
        viewMode={viewMode}
        iframeKey={iframeKey}
        livePreviewUrl={previewUrl}
        livePreviewStatus={previewStatus}
        livePreviewError={previewError}
        onStartLivePreview={handleStartLivePreview}
        onStopLivePreview={stopPreview}
        className="h-full"
      />
    </div>
  );
}

function WindowState({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <div className="flex h-screen flex-col items-center justify-center bg-background p-8 text-center">
      <FileQuestion className="mb-4 h-12 w-12 text-muted-foreground" />
      <h1 className="mb-2 text-lg font-semibold text-foreground">{title}</h1>
      <p className={cn("max-w-md text-sm text-muted-foreground")}>{message}</p>
    </div>
  );
}

export default PagePreviewWindow;
