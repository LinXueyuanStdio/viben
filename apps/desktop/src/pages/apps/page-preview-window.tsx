import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { openUrl } from "@tauri-apps/plugin-opener";
import { platform } from "@tauri-apps/plugin-os";
import {
  ChevronLeft,
  ChevronRight,
  CornerUpRight,
  FileQuestion,
  Loader2,
  MoreHorizontal,
  MonitorUp,
  Plus,
  RefreshCw,
} from "lucide-react";
import {
  BrowserTabFrame,
  BrowserTabFrameIconButton,
  BrowserTabFrameTab,
} from "@/components/browser-tab-frame";
import {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { IconDisplay } from "@/components/ui/icon-picker";
import { PagePreview } from "./components";
import type { PageViewMode } from "./components/page-preview";
import { usePage } from "@/hooks/use-pages";
import { toast } from "@/hooks/use-toast";
import { useVitePreview } from "@/hooks/use-vite-preview";
import { useTheme } from "@/hooks/use-theme";
import { getGatewayUrl } from "@/lib/gateway/config";
import type { PageConfig, ProxyPageConfig, ServerPageConfig } from "@/lib/gateway/types/page";
import { cn } from "@/lib/utils";
import { withNewTabRequest } from "@/navigation/new-tab-request";

const NEW_TAB_URL = "/workspace";

function getSearchParam(name: string): string | undefined {
  const value = new URLSearchParams(window.location.search).get(name);
  return value?.trim() || undefined;
}

function navigateCurrentWindow(url: string) {
  window.location.assign(url);
}

function normalizeViewMode(value: string | undefined): PageViewMode {
  return value === "skill" ? "skill" : "page";
}

function getStaticPageServeUrl(
  workspacePath: string,
  slug: string,
  theme: string
): string {
  const params = new URLSearchParams({
    workspace_path: workspacePath,
    slug,
    theme,
  });
  return `${getGatewayUrl()}/api/page/serve?${params.toString()}`;
}

function normalizeHttpUrl(value: string | undefined): string | null {
  if (!value) return null;

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function getPreviewExternalUrl({
  page,
  workspacePath,
  viewMode,
  resolvedTheme,
  livePreviewUrl,
}: {
  page: PageConfig;
  workspacePath: string;
  viewMode: PageViewMode;
  resolvedTheme: string;
  livePreviewUrl?: string | null;
}): string | null {
  if (viewMode === "skill" || page.type === "markdown") {
    return null;
  }

  if (page.type === "proxy") {
    return normalizeHttpUrl((page as ProxyPageConfig).url);
  }

  if (page.type === "server") {
    return normalizeHttpUrl(livePreviewUrl ?? undefined);
  }

  return getStaticPageServeUrl(workspacePath, page.slug, resolvedTheme);
}

export interface PagePreviewWindowProps {
  navigateToWorkspace?: (url: string) => void;
}

export function PagePreviewWindow({
  navigateToWorkspace = navigateCurrentWindow,
}: PagePreviewWindowProps = {}) {
  const { t } = useTranslation();
  const { resolvedTheme } = useTheme();
  const workspaceId = getSearchParam("workspace_id");
  const workspacePath = getSearchParam("workspace_path");
  const slug = getSearchParam("slug");
  const initialViewMode = useMemo(
    () => normalizeViewMode(getSearchParam("view")),
    []
  );
  const [viewMode] = useState<PageViewMode>(initialViewMode);
  const [iframeKey, setIframeKey] = useState(0);
  const [isMacOS, setIsMacOS] = useState(false);
  const [shouldReserveMacOSControlsSpace, setShouldReserveMacOSControlsSpace] = useState(false);

  const {
    data: page,
    isLoading,
    error,
    refetch,
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

  useEffect(() => {
    let mounted = true;
    let unlisten: (() => void) | null = null;

    const detectPlatform = async () => {
      try {
        if (!mounted) return;

        const isMac = platform() === "macos";
        setIsMacOS(isMac);

        const appWindow = getCurrentWindow();

        if (!isMac) {
          setShouldReserveMacOSControlsSpace(false);
          return;
        }

        const updateWindowState = async () => {
          const isFullscreen = await appWindow.isFullscreen();
          if (mounted) {
            setShouldReserveMacOSControlsSpace(!isFullscreen);
          }
        };

        await updateWindowState();
        unlisten = await appWindow.onResized(() => {
          void updateWindowState();
        });
      } catch {
        setIsMacOS(false);
        setShouldReserveMacOSControlsSpace(false);
      }
    };

    void detectPlatform();

    return () => {
      mounted = false;
      if (unlisten) {
        unlisten();
      }
    };
  }, []);

  const handleStartLivePreview = useCallback(() => {
    if (!workspacePath || !page) return;
    const pageDir = `${workspacePath}/pages/${page.slug}`;
    const options = page.type === "server"
      ? {
          command: (page as ServerPageConfig).command,
          port: (page as ServerPageConfig).port,
          ready_pattern: (page as ServerPageConfig).ready_pattern,
          timeout: (page as ServerPageConfig).timeout,
        }
      : undefined;
    startPreview(pageDir, options);
  }, [page, startPreview, workspacePath]);

  const externalUrl = useMemo(() => {
    if (!workspacePath || !page) return null;
    return getPreviewExternalUrl({
      page,
      workspacePath,
      viewMode,
      resolvedTheme,
      livePreviewUrl: previewUrl,
    });
  }, [previewUrl, page, resolvedTheme, viewMode, workspacePath]);

  const handleRefresh = useCallback(() => {
    setIframeKey((key) => key + 1);
    void refetch();
    if (page?.type === "server" && previewStatus !== "running") {
      handleStartLivePreview();
    }
  }, [handleStartLivePreview, page?.type, previewStatus, refetch]);

  const handleCopyLink = useCallback(async () => {
    if (!externalUrl) return;
    try {
      await navigator.clipboard.writeText(externalUrl);
      toast.success(t("pageSection.linkCopied", "Link copied to clipboard"));
    } catch (error) {
      console.error("Failed to copy preview link:", error);
      toast.error(t("common.copyFailed", "Failed to copy"));
    }
  }, [externalUrl, t]);

  const handleOpenExternal = useCallback(async () => {
    if (!externalUrl) return;
    try {
      await openUrl(externalUrl);
    } catch {
      window.open(externalUrl, "_blank");
    }
  }, [externalUrl]);

  const handleCloseWindow = useCallback(async () => {
    try {
      await getCurrentWindow().close();
    } catch (error) {
      console.error("Failed to close preview window:", error);
    }
  }, []);

  const handleNewTab = useCallback(() => {
    navigateToWorkspace(withNewTabRequest(NEW_TAB_URL));
  }, [navigateToWorkspace]);

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
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background">
      <PagePreviewWindowTabBar
        page={page}
        isMacOS={isMacOS}
        reserveMacOSControlsSpace={shouldReserveMacOSControlsSpace}
        canOpenExternal={!!externalUrl}
        onRefresh={handleRefresh}
        onCopyLink={() => void handleCopyLink()}
        onOpenExternal={() => void handleOpenExternal()}
        onCloseTab={() => void handleCloseWindow()}
        onNewTab={handleNewTab}
      />
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
        className="min-h-0 flex-1"
      />
    </div>
  );
}

function PagePreviewWindowTabBar({
  page,
  isMacOS,
  reserveMacOSControlsSpace,
  canOpenExternal,
  onRefresh,
  onCopyLink,
  onOpenExternal,
  onCloseTab,
  onNewTab,
}: {
  page: PageConfig;
  isMacOS: boolean;
  reserveMacOSControlsSpace: boolean;
  canOpenExternal: boolean;
  onRefresh: () => void;
  onCopyLink: () => void;
  onOpenExternal: () => void;
  onCloseTab: () => void;
  onNewTab: () => void;
}) {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const refreshShortcut = isMacOS ? "⌘R" : "Ctrl+R";
  const actualSizeShortcut = isMacOS ? "⌘0" : "Ctrl+0";
  const closeTabsShortcut = isMacOS ? "⌥⌘W" : "Alt+Ctrl+W";
  const tabIcon = page.icon ? (
    <IconDisplay icon={page.icon} size="sm" className="text-muted-foreground" />
  ) : (
    <IconDisplay icon={{ type: "lucide", value: "file-text" }} size="sm" className="text-muted-foreground" />
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const primaryModifier = isMacOS
        ? event.metaKey && !event.ctrlKey
        : event.ctrlKey && !event.metaKey;
      if (!primaryModifier) return;

      const key = event.key.toLowerCase();
      if (!event.altKey && !event.shiftKey && (key === "r" || key === "0")) {
        event.preventDefault();
        if (key === "r") {
          onRefresh();
        }
        return;
      }

      if (event.altKey && !event.shiftKey && key === "w") {
        event.preventDefault();
        onCloseTab();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMacOS, onCloseTab, onRefresh]);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div>
          <BrowserTabFrame
            isMacOS={isMacOS}
            reserveMacOSControlsSpace={reserveMacOSControlsSpace}
            spacerMenu={<div data-tauri-drag-region className="h-full w-full" />}
            leadingControls={
              <>
                <BrowserTabFrameIconButton
                  aria-label={t("common.back", "Go Back")}
                  tooltip={t("common.back", "Go Back")}
                  icon={<ChevronLeft className={cn(isMacOS ? "h-3.5 w-3.5" : "h-4 w-4")} />}
                  disabled
                  isMacOS={isMacOS}
                />
                <BrowserTabFrameIconButton
                  aria-label={t("common.forward", "Go Forward")}
                  tooltip={t("common.forward", "Go Forward")}
                  icon={<ChevronRight className={cn(isMacOS ? "h-3.5 w-3.5" : "h-4 w-4")} />}
                  disabled
                  isMacOS={isMacOS}
                />
                <BrowserTabFrameIconButton
                  aria-label={t("common.refresh", "Refresh")}
                  tooltip={t("common.refresh", "Refresh")}
                  icon={<RefreshCw className={cn(isMacOS ? "h-3.5 w-3.5" : "h-4 w-4")} />}
                  onClick={onRefresh}
                  isMacOS={isMacOS}
                />
              </>
            }
            tabs={
              <>
                <BrowserTabFrameTab
                  label={page.name || page.slug}
                  icon={tabIcon}
                  active
                  closable
                  onClose={onCloseTab}
                />
                <BrowserTabFrameIconButton
                  aria-label={t("common.newTab", "New Tab")}
                  tooltip={t("common.newTab", "New Tab")}
                  icon={<Plus className={cn(isMacOS ? "h-3.5 w-3.5" : "h-4 w-4")} />}
                  onClick={onNewTab}
                  isMacOS={isMacOS}
                />
              </>
            }
            rightControls={
              <>
                <BrowserTabFrameIconButton
                  aria-label={t("page.openExternal", "Open in Browser")}
                  tooltip={t("page.openExternal", "Open in Browser")}
                  icon={<MonitorUp className={cn(isMacOS ? "h-3.5 w-3.5" : "h-4 w-4")} />}
                  onClick={onOpenExternal}
                  disabled={!canOpenExternal}
                  isMacOS={isMacOS}
                />
                <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      aria-label={t("common.more", "More")}
                      className={cn(
                        "inline-flex shrink-0 items-center justify-center rounded-md",
                        "text-muted-foreground transition-colors duration-150",
                        "hover:bg-accent hover:text-accent-foreground",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        menuOpen && "bg-accent text-accent-foreground",
                        isMacOS ? "h-6 w-6" : "h-7 w-7"
                      )}
                    >
                      <MoreHorizontal className={cn(isMacOS ? "h-3.5 w-3.5" : "h-4 w-4")} />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-64">
                    <PreviewDropdownMenuItems
                      canOpenExternal={canOpenExternal}
                      refreshShortcut={refreshShortcut}
                      actualSizeShortcut={actualSizeShortcut}
                      closeTabsShortcut={closeTabsShortcut}
                      onRefresh={onRefresh}
                      onCopyLink={onCopyLink}
                      onOpenExternal={onOpenExternal}
                      onCloseTab={onCloseTab}
                    />
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            }
          />
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-64">
        <PreviewContextMenuItems
          canOpenExternal={canOpenExternal}
          refreshShortcut={refreshShortcut}
          actualSizeShortcut={actualSizeShortcut}
          closeTabsShortcut={closeTabsShortcut}
          onRefresh={onRefresh}
          onCopyLink={onCopyLink}
          onOpenExternal={onOpenExternal}
          onCloseTab={onCloseTab}
        />
      </ContextMenuContent>
    </ContextMenu>
  );
}

function PreviewDropdownMenuItems({
  canOpenExternal,
  refreshShortcut,
  actualSizeShortcut,
  closeTabsShortcut,
  onRefresh,
  onCopyLink,
  onOpenExternal,
  onCloseTab,
}: {
  canOpenExternal: boolean;
  refreshShortcut: string;
  actualSizeShortcut: string;
  closeTabsShortcut: string;
  onRefresh: () => void;
  onCopyLink: () => void;
  onOpenExternal: () => void;
  onCloseTab: () => void;
}) {
  const { t } = useTranslation();

  return (
    <>
      <DropdownMenuItem onClick={onRefresh}>
        {t("common.refresh", "Refresh")}
        <DropdownMenuShortcut>{refreshShortcut}</DropdownMenuShortcut>
      </DropdownMenuItem>
      <DropdownMenuItem onClick={onCopyLink} disabled={!canOpenExternal}>
        {t("tabBar.copyLink", "Copy Link")}
      </DropdownMenuItem>
      <DropdownMenuSub>
        <DropdownMenuSubTrigger>
          {t("pagePreview.textSize", "Adjust Text Size")}
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent className="w-52">
          <DropdownMenuCheckboxItem checked onCheckedChange={() => undefined}>
            {t("pagePreview.actualSize", "Actual Size")}
            <DropdownMenuShortcut>{actualSizeShortcut}</DropdownMenuShortcut>
          </DropdownMenuCheckboxItem>
          <DropdownMenuItem disabled>
            <span className="mr-6" />
            {t("pagePreview.zoomIn", "Zoom In")}
          </DropdownMenuItem>
          <DropdownMenuItem disabled>
            <span className="mr-6" />
            {t("pagePreview.zoomOut", "Zoom Out")}
          </DropdownMenuItem>
        </DropdownMenuSubContent>
      </DropdownMenuSub>
      <DropdownMenuItem disabled>
        {t("common.find", "Find...")}
      </DropdownMenuItem>
      <DropdownMenuItem disabled>
        {t("common.print", "Print")}
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem disabled>
        <CornerUpRight className="mr-2 h-4 w-4" />
        {t("common.forward", "Forward")}
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={onOpenExternal} disabled={!canOpenExternal}>
        {t("page.openExternalDefault", "Open with Default Browser")}
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem disabled>
        {t("pagePreview.history", "History")}
      </DropdownMenuItem>
      <DropdownMenuItem disabled>
        {t("pagePreview.downloads", "Downloads")}
      </DropdownMenuItem>
      <DropdownMenuItem onClick={onCloseTab}>
        {t("tabBar.closeAllTabs", "Close All Tabs")}
        <DropdownMenuShortcut>{closeTabsShortcut}</DropdownMenuShortcut>
      </DropdownMenuItem>
      <DropdownMenuItem disabled>
        {t("tabBar.reopenClosedTab", "Reopen Closed Tab")}
      </DropdownMenuItem>
    </>
  );
}

function PreviewContextMenuItems({
  canOpenExternal,
  refreshShortcut,
  actualSizeShortcut,
  closeTabsShortcut,
  onRefresh,
  onCopyLink,
  onOpenExternal,
  onCloseTab,
}: {
  canOpenExternal: boolean;
  refreshShortcut: string;
  actualSizeShortcut: string;
  closeTabsShortcut: string;
  onRefresh: () => void;
  onCopyLink: () => void;
  onOpenExternal: () => void;
  onCloseTab: () => void;
}) {
  const { t } = useTranslation();

  return (
    <>
      <ContextMenuItem onClick={onRefresh}>
        {t("common.refresh", "Refresh")}
        <ContextMenuShortcut>{refreshShortcut}</ContextMenuShortcut>
      </ContextMenuItem>
      <ContextMenuItem onClick={onCopyLink} disabled={!canOpenExternal}>
        {t("tabBar.copyLink", "Copy Link")}
      </ContextMenuItem>
      <ContextMenuSub>
        <ContextMenuSubTrigger>
          {t("pagePreview.textSize", "Adjust Text Size")}
        </ContextMenuSubTrigger>
        <ContextMenuSubContent className="w-52">
          <ContextMenuCheckboxItem checked onCheckedChange={() => undefined}>
            {t("pagePreview.actualSize", "Actual Size")}
            <ContextMenuShortcut>{actualSizeShortcut}</ContextMenuShortcut>
          </ContextMenuCheckboxItem>
          <ContextMenuItem disabled>
            <span className="mr-6" />
            {t("pagePreview.zoomIn", "Zoom In")}
          </ContextMenuItem>
          <ContextMenuItem disabled>
            <span className="mr-6" />
            {t("pagePreview.zoomOut", "Zoom Out")}
          </ContextMenuItem>
        </ContextMenuSubContent>
      </ContextMenuSub>
      <ContextMenuItem disabled>
        {t("common.find", "Find...")}
      </ContextMenuItem>
      <ContextMenuItem disabled>
        {t("common.print", "Print")}
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem disabled>
        <CornerUpRight className="mr-2 h-4 w-4" />
        {t("common.forward", "Forward")}
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem onClick={onOpenExternal} disabled={!canOpenExternal}>
        {t("page.openExternalDefault", "Open with Default Browser")}
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem disabled>
        {t("pagePreview.history", "History")}
      </ContextMenuItem>
      <ContextMenuItem disabled>
        {t("pagePreview.downloads", "Downloads")}
      </ContextMenuItem>
      <ContextMenuItem onClick={onCloseTab}>
        {t("tabBar.closeAllTabs", "Close All Tabs")}
        <ContextMenuShortcut>{closeTabsShortcut}</ContextMenuShortcut>
      </ContextMenuItem>
      <ContextMenuItem disabled>
        {t("tabBar.reopenClosedTab", "Reopen Closed Tab")}
      </ContextMenuItem>
    </>
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
