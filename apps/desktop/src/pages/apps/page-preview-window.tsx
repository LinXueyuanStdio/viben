import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { homeDir } from "@tauri-apps/api/path";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { openUrl } from "@tauri-apps/plugin-opener";
import { platform } from "@tauri-apps/plugin-os";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CornerUpRight,
  FileQuestion,
  Loader2,
  MoreHorizontal,
  MonitorUp,
  Plus,
  RefreshCw,
  Search,
  X,
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
import { openFolder } from "@/lib/gateway/modules/files";
import type { PageConfig, ProxyPageConfig, ServerPageConfig } from "@/lib/gateway/types/page";
import { cn } from "@/lib/utils";
import { withNewTabRequest } from "@/navigation/new-tab-request";
import { useTabStore } from "@/stores/tab-store";
import type { TabNavigationState } from "@/stores/tab-store";

const NEW_TAB_URL = "/workspace";
const DEFAULT_ZOOM_SCALE = 1;
const ZOOM_STEP = 0.1;
const MIN_ZOOM_SCALE = 0.5;
const MAX_ZOOM_SCALE = 2;

type BrowserFindWindow = Window & {
  find?: (
    query: string,
    caseSensitive?: boolean,
    backwards?: boolean,
    wrapAround?: boolean,
    wholeWord?: boolean,
    searchInFrames?: boolean,
    showDialog?: boolean
  ) => boolean;
};

interface PreviewHistoryMenuItem {
  historyIndex: number;
  label: string;
  url: string;
  active: boolean;
}

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

function clampZoomScale(value: number): number {
  return Math.min(
    MAX_ZOOM_SCALE,
    Math.max(MIN_ZOOM_SCALE, Math.round(value * 10) / 10)
  );
}

function buildDownloadsPath(homePath: string): string {
  const trimmed = homePath.replace(/[\\/]+$/, "");
  const separator = trimmed.includes("\\") ? "\\" : "/";
  return `${trimmed}${separator}Downloads`;
}

function getPreviewFrame(surface: HTMLElement | null): HTMLIFrameElement | null {
  return surface?.querySelector("iframe") ?? null;
}

function getFrameWindow(surface: HTMLElement | null): Window | null {
  return getPreviewFrame(surface)?.contentWindow ?? null;
}

function runPreviewHistory(
  surface: HTMLElement | null,
  direction: "back" | "forward"
): boolean {
  const frameWindow = getFrameWindow(surface);
  try {
    frameWindow?.history[direction]();
    return Boolean(frameWindow);
  } catch {
    return false;
  }
}

function printPreview(surface: HTMLElement | null): void {
  const frameWindow = getFrameWindow(surface);
  try {
    frameWindow?.focus();
    frameWindow?.print();
    if (frameWindow) return;
  } catch {
    // Fall through to printing the page-preview window itself.
  }
  window.print();
}

function findInPreview(
  surface: HTMLElement | null,
  query: string,
  backwards = false
): boolean {
  const trimmed = query.trim();
  if (!trimmed) return false;

  const frameWindow = getFrameWindow(surface) as BrowserFindWindow | null;
  try {
    frameWindow?.focus();
    const frameFound = frameWindow?.find?.(
      trimmed,
      false,
      backwards,
      true,
      false,
      true,
      false
    );
    if (typeof frameFound === "boolean") return frameFound;
  } catch {
    // Cross-origin frames cannot always be searched directly.
  }

  const browserWindow = window as BrowserFindWindow;
  try {
    browserWindow.focus();
    return Boolean(
      browserWindow.find?.(
        trimmed,
        false,
        backwards,
        true,
        false,
        true,
        false
      )
    );
  } catch {
    return false;
  }
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
  const previewSurfaceRef = useRef<HTMLDivElement>(null);
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
  const [zoomScale, setZoomScale] = useState(DEFAULT_ZOOM_SCALE);
  const [findOpen, setFindOpen] = useState(false);
  const [findQuery, setFindQuery] = useState("");
  const activeTabId = useTabStore((state) => state.activeTabId);
  const activeTab = useTabStore((state) =>
    activeTabId ? state.tabs.find((tab) => tab.id === activeTabId) : null
  );
  const canReopenClosedTab = useTabStore(
    (state) => state.recentlyClosedTabs.length > 0
  );
  const goBackInStore = useTabStore((state) => state.goBack);
  const goForwardInStore = useTabStore((state) => state.goForward);
  const jumpToHistoryInStore = useTabStore((state) => state.jumpToHistory);
  const closeAllTabsInStore = useTabStore((state) => state.closeAllTabs);
  const reopenClosedTabInStore = useTabStore((state) => state.reopenClosedTab);

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

  const previewZoomStyle = useMemo<CSSProperties>(
    () => ({ zoom: zoomScale } as CSSProperties),
    [zoomScale]
  );

  const historyItems = useMemo<PreviewHistoryMenuItem[]>(() => {
    if (!activeTab) {
      return externalUrl
        ? [
            {
              historyIndex: 0,
              label: page?.name || page?.slug || externalUrl,
              url: externalUrl,
              active: true,
            },
          ]
        : [];
    }
    return activeTab.navigationHistory.map(
      (entry: TabNavigationState, historyIndex) => {
        const leaf = entry.breadcrumbStack[entry.breadcrumbStack.length - 1];
        return {
          historyIndex,
          label: leaf?.label || entry.url,
          url: entry.url,
          active: historyIndex === activeTab.historyIndex,
        };
      }
    );
  }, [activeTab, externalUrl, page?.name, page?.slug]);

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

  const navigateToStoreTab = useCallback(
    (tabId: string) => {
      const url = useTabStore.getState().getCurrentUrl(tabId);
      if (url) {
        navigateToWorkspace(url);
      }
    },
    [navigateToWorkspace]
  );

  const handleGoBack = useCallback(() => {
    if (activeTabId && useTabStore.getState().canGoBack(activeTabId)) {
      goBackInStore(activeTabId);
      navigateToStoreTab(activeTabId);
      return;
    }
    runPreviewHistory(previewSurfaceRef.current, "back");
  }, [activeTabId, goBackInStore, navigateToStoreTab]);

  const handleGoForward = useCallback(() => {
    if (activeTabId && useTabStore.getState().canGoForward(activeTabId)) {
      goForwardInStore(activeTabId);
      navigateToStoreTab(activeTabId);
      return;
    }
    runPreviewHistory(previewSurfaceRef.current, "forward");
  }, [activeTabId, goForwardInStore, navigateToStoreTab]);

  const handleActualSize = useCallback(() => {
    setZoomScale(DEFAULT_ZOOM_SCALE);
  }, []);

  const handleZoomIn = useCallback(() => {
    setZoomScale((scale) => clampZoomScale(scale + ZOOM_STEP));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoomScale((scale) => clampZoomScale(scale - ZOOM_STEP));
  }, []);

  const handleFind = useCallback(() => {
    setFindOpen(true);
  }, []);

  const handleFindSubmit = useCallback((query: string, backwards = false) => {
    setFindQuery(query);
    findInPreview(previewSurfaceRef.current, query, backwards);
  }, []);

  const handlePrint = useCallback(() => {
    printPreview(previewSurfaceRef.current);
  }, []);

  const handleOpenDownloads = useCallback(async () => {
    try {
      const homePath = await homeDir();
      await openFolder(getGatewayUrl(), buildDownloadsPath(homePath));
    } catch (error) {
      console.error("Failed to open downloads folder:", error);
      toast.error(t("common.openFolderFailed", "Failed to open folder"));
    }
  }, [t]);

  const handleCloseAllTabs = useCallback(() => {
    closeAllTabsInStore();
    void handleCloseWindow();
  }, [closeAllTabsInStore, handleCloseWindow]);

  const handleReopenClosedTab = useCallback(() => {
    const restoredTabId = reopenClosedTabInStore();
    if (!restoredTabId) return;
    navigateToStoreTab(restoredTabId);
  }, [navigateToStoreTab, reopenClosedTabInStore]);

  const handleHistorySelect = useCallback(
    (historyIndex: number) => {
      if (!activeTabId) return;
      jumpToHistoryInStore(activeTabId, historyIndex);
      navigateToStoreTab(activeTabId);
    },
    [activeTabId, jumpToHistoryInStore, navigateToStoreTab]
  );

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
        canGoBack
        canGoForward
        zoomScale={zoomScale}
        historyItems={historyItems}
        canReopenClosedTab={canReopenClosedTab}
        onBack={handleGoBack}
        onForward={handleGoForward}
        onRefresh={handleRefresh}
        onCopyLink={() => void handleCopyLink()}
        onOpenExternal={() => void handleOpenExternal()}
        onActualSize={handleActualSize}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onFind={handleFind}
        onPrint={handlePrint}
        onOpenDownloads={() => void handleOpenDownloads()}
        onCloseAllTabs={handleCloseAllTabs}
        onReopenClosedTab={handleReopenClosedTab}
        onHistorySelect={handleHistorySelect}
        onCloseTab={() => void handleCloseWindow()}
        onNewTab={handleNewTab}
      />
      <div
        ref={previewSurfaceRef}
        className="relative min-h-0 flex-1 overflow-auto bg-background"
        data-preview-zoom={zoomScale.toFixed(1)}
      >
        <div className="h-full min-h-0 w-full" style={previewZoomStyle}>
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
            className="h-full min-h-0"
          />
        </div>
        <PreviewFindBar
          open={findOpen}
          query={findQuery}
          onQueryChange={setFindQuery}
          onSearch={handleFindSubmit}
          onClose={() => setFindOpen(false)}
        />
      </div>
    </div>
  );
}

function PagePreviewWindowTabBar({
  page,
  isMacOS,
  reserveMacOSControlsSpace,
  canOpenExternal,
  canGoBack,
  canGoForward,
  zoomScale,
  historyItems,
  canReopenClosedTab,
  onBack,
  onForward,
  onRefresh,
  onCopyLink,
  onOpenExternal,
  onActualSize,
  onZoomIn,
  onZoomOut,
  onFind,
  onPrint,
  onOpenDownloads,
  onCloseAllTabs,
  onReopenClosedTab,
  onHistorySelect,
  onCloseTab,
  onNewTab,
}: {
  page: PageConfig;
  isMacOS: boolean;
  reserveMacOSControlsSpace: boolean;
  canOpenExternal: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  zoomScale: number;
  historyItems: PreviewHistoryMenuItem[];
  canReopenClosedTab: boolean;
  onBack: () => void;
  onForward: () => void;
  onRefresh: () => void;
  onCopyLink: () => void;
  onOpenExternal: () => void;
  onActualSize: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFind: () => void;
  onPrint: () => void;
  onOpenDownloads: () => void;
  onCloseAllTabs: () => void;
  onReopenClosedTab: () => void;
  onHistorySelect: (historyIndex: number) => void;
  onCloseTab: () => void;
  onNewTab: () => void;
}) {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const refreshShortcut = isMacOS ? "⌘R" : "Ctrl+R";
  const actualSizeShortcut = isMacOS ? "⌘0" : "Ctrl+0";
  const zoomInShortcut = isMacOS ? "⌘+" : "Ctrl+";
  const zoomOutShortcut = isMacOS ? "⌘-" : "Ctrl+-";
  const findShortcut = isMacOS ? "⌘F" : "Ctrl+F";
  const printShortcut = isMacOS ? "⌘P" : "Ctrl+P";
  const downloadsShortcut = isMacOS ? "⌥⌘L" : "Alt+Ctrl+L";
  const closeTabsShortcut = isMacOS ? "⌥⌘W" : "Alt+Ctrl+W";
  const reopenClosedTabShortcut = isMacOS ? "⌘⇧T" : "Ctrl+Shift+T";
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
      if (!event.altKey && !event.shiftKey && key === "r") {
        event.preventDefault();
        onRefresh();
        return;
      }

      if (!event.altKey && !event.shiftKey && key === "0") {
        event.preventDefault();
        onActualSize();
        return;
      }

      if (!event.altKey && (key === "+" || key === "=")) {
        event.preventDefault();
        onZoomIn();
        return;
      }

      if (!event.altKey && !event.shiftKey && key === "-") {
        event.preventDefault();
        onZoomOut();
        return;
      }

      if (!event.altKey && !event.shiftKey && key === "f") {
        event.preventDefault();
        onFind();
        return;
      }

      if (!event.altKey && !event.shiftKey && key === "p") {
        event.preventDefault();
        onPrint();
        return;
      }

      if (event.altKey && !event.shiftKey && key === "w") {
        event.preventDefault();
        onCloseAllTabs();
        return;
      }

      if (event.altKey && !event.shiftKey && key === "l") {
        event.preventDefault();
        onOpenDownloads();
        return;
      }

      if (!event.altKey && event.shiftKey && key === "t") {
        event.preventDefault();
        onReopenClosedTab();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    isMacOS,
    onActualSize,
    onCloseAllTabs,
    onFind,
    onOpenDownloads,
    onPrint,
    onRefresh,
    onReopenClosedTab,
    onZoomIn,
    onZoomOut,
  ]);

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
                  onClick={onBack}
                  disabled={!canGoBack}
                  isMacOS={isMacOS}
                />
                <BrowserTabFrameIconButton
                  aria-label={t("common.forward", "Go Forward")}
                  tooltip={t("common.forward", "Go Forward")}
                  icon={<ChevronRight className={cn(isMacOS ? "h-3.5 w-3.5" : "h-4 w-4")} />}
                  onClick={onForward}
                  disabled={!canGoForward}
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
                      canGoForward
                      zoomScale={zoomScale}
                      historyItems={historyItems}
                      canReopenClosedTab={canReopenClosedTab}
                      refreshShortcut={refreshShortcut}
                      actualSizeShortcut={actualSizeShortcut}
                      zoomInShortcut={zoomInShortcut}
                      zoomOutShortcut={zoomOutShortcut}
                      findShortcut={findShortcut}
                      printShortcut={printShortcut}
                      downloadsShortcut={downloadsShortcut}
                      closeTabsShortcut={closeTabsShortcut}
                      reopenClosedTabShortcut={reopenClosedTabShortcut}
                      onForward={onForward}
                      onRefresh={onRefresh}
                      onCopyLink={onCopyLink}
                      onOpenExternal={onOpenExternal}
                      onActualSize={onActualSize}
                      onZoomIn={onZoomIn}
                      onZoomOut={onZoomOut}
                      onFind={onFind}
                      onPrint={onPrint}
                      onOpenDownloads={onOpenDownloads}
                      onCloseAllTabs={onCloseAllTabs}
                      onReopenClosedTab={onReopenClosedTab}
                      onHistorySelect={onHistorySelect}
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
          canGoForward
          zoomScale={zoomScale}
          historyItems={historyItems}
          canReopenClosedTab={canReopenClosedTab}
          refreshShortcut={refreshShortcut}
          actualSizeShortcut={actualSizeShortcut}
          zoomInShortcut={zoomInShortcut}
          zoomOutShortcut={zoomOutShortcut}
          findShortcut={findShortcut}
          printShortcut={printShortcut}
          downloadsShortcut={downloadsShortcut}
          closeTabsShortcut={closeTabsShortcut}
          reopenClosedTabShortcut={reopenClosedTabShortcut}
          onForward={onForward}
          onRefresh={onRefresh}
          onCopyLink={onCopyLink}
          onOpenExternal={onOpenExternal}
          onActualSize={onActualSize}
          onZoomIn={onZoomIn}
          onZoomOut={onZoomOut}
          onFind={onFind}
          onPrint={onPrint}
          onOpenDownloads={onOpenDownloads}
          onCloseAllTabs={onCloseAllTabs}
          onReopenClosedTab={onReopenClosedTab}
          onHistorySelect={onHistorySelect}
          onCloseTab={onCloseTab}
        />
      </ContextMenuContent>
    </ContextMenu>
  );
}

function PreviewDropdownMenuItems({
  canOpenExternal,
  canGoForward,
  zoomScale,
  historyItems,
  canReopenClosedTab,
  refreshShortcut,
  actualSizeShortcut,
  zoomInShortcut,
  zoomOutShortcut,
  findShortcut,
  printShortcut,
  downloadsShortcut,
  closeTabsShortcut,
  reopenClosedTabShortcut,
  onForward,
  onRefresh,
  onCopyLink,
  onOpenExternal,
  onActualSize,
  onZoomIn,
  onZoomOut,
  onFind,
  onPrint,
  onOpenDownloads,
  onCloseAllTabs,
  onReopenClosedTab,
  onHistorySelect,
  onCloseTab,
}: {
  canOpenExternal: boolean;
  canGoForward: boolean;
  zoomScale: number;
  historyItems: PreviewHistoryMenuItem[];
  canReopenClosedTab: boolean;
  refreshShortcut: string;
  actualSizeShortcut: string;
  zoomInShortcut: string;
  zoomOutShortcut: string;
  findShortcut: string;
  printShortcut: string;
  downloadsShortcut: string;
  closeTabsShortcut: string;
  reopenClosedTabShortcut: string;
  onForward: () => void;
  onRefresh: () => void;
  onCopyLink: () => void;
  onOpenExternal: () => void;
  onActualSize: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFind: () => void;
  onPrint: () => void;
  onOpenDownloads: () => void;
  onCloseAllTabs: () => void;
  onReopenClosedTab: () => void;
  onHistorySelect: (historyIndex: number) => void;
  onCloseTab: () => void;
}) {
  const { t } = useTranslation();
  const isActualSize = zoomScale === DEFAULT_ZOOM_SCALE;

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
          <DropdownMenuCheckboxItem
            checked={isActualSize}
            onCheckedChange={onActualSize}
          >
            {t("pagePreview.actualSize", "Actual Size")}
            <DropdownMenuShortcut>{actualSizeShortcut}</DropdownMenuShortcut>
          </DropdownMenuCheckboxItem>
          <DropdownMenuItem onClick={onZoomIn}>
            <span className="mr-6" />
            {t("pagePreview.zoomIn", "Zoom In")}
            <DropdownMenuShortcut>{zoomInShortcut}</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onZoomOut}>
            <span className="mr-6" />
            {t("pagePreview.zoomOut", "Zoom Out")}
            <DropdownMenuShortcut>{zoomOutShortcut}</DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuSubContent>
      </DropdownMenuSub>
      <DropdownMenuItem onClick={onFind}>
        {t("common.find", "Find...")}
        <DropdownMenuShortcut>{findShortcut}</DropdownMenuShortcut>
      </DropdownMenuItem>
      <DropdownMenuItem onClick={onPrint}>
        {t("common.print", "Print")}
        <DropdownMenuShortcut>{printShortcut}</DropdownMenuShortcut>
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={onForward} disabled={!canGoForward}>
        <CornerUpRight className="mr-2 h-4 w-4" />
        {t("common.forward", "Forward")}
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={onOpenExternal} disabled={!canOpenExternal}>
        {t("page.openExternalDefault", "Open with Default Browser")}
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuSub>
        <DropdownMenuSubTrigger>
          {t("pagePreview.history", "History")}
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent className="w-64">
          {historyItems.length > 0 ? (
            historyItems.map((item) => (
              <DropdownMenuCheckboxItem
                key={`${item.historyIndex}:${item.url}`}
                checked={item.active}
                onCheckedChange={() => onHistorySelect(item.historyIndex)}
              >
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
              </DropdownMenuCheckboxItem>
            ))
          ) : (
            <DropdownMenuItem disabled>
              {t("pagePreview.noHistory", "No history")}
            </DropdownMenuItem>
          )}
        </DropdownMenuSubContent>
      </DropdownMenuSub>
      <DropdownMenuItem onClick={onOpenDownloads}>
        {t("pagePreview.downloads", "Downloads")}
        <DropdownMenuShortcut>{downloadsShortcut}</DropdownMenuShortcut>
      </DropdownMenuItem>
      <DropdownMenuItem onClick={onCloseAllTabs}>
        {t("tabBar.closeAllTabs", "Close All Tabs")}
        <DropdownMenuShortcut>{closeTabsShortcut}</DropdownMenuShortcut>
      </DropdownMenuItem>
      <DropdownMenuItem onClick={onReopenClosedTab} disabled={!canReopenClosedTab}>
        {t("tabBar.reopenClosedTab", "Reopen Closed Tab")}
        <DropdownMenuShortcut>{reopenClosedTabShortcut}</DropdownMenuShortcut>
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={onCloseTab}>
        {t("tabBar.closeTab", "Close Tab")}
      </DropdownMenuItem>
    </>
  );
}

function PreviewContextMenuItems({
  canOpenExternal,
  canGoForward,
  zoomScale,
  historyItems,
  canReopenClosedTab,
  refreshShortcut,
  actualSizeShortcut,
  zoomInShortcut,
  zoomOutShortcut,
  findShortcut,
  printShortcut,
  downloadsShortcut,
  closeTabsShortcut,
  reopenClosedTabShortcut,
  onForward,
  onRefresh,
  onCopyLink,
  onOpenExternal,
  onActualSize,
  onZoomIn,
  onZoomOut,
  onFind,
  onPrint,
  onOpenDownloads,
  onCloseAllTabs,
  onReopenClosedTab,
  onHistorySelect,
  onCloseTab,
}: {
  canOpenExternal: boolean;
  canGoForward: boolean;
  zoomScale: number;
  historyItems: PreviewHistoryMenuItem[];
  canReopenClosedTab: boolean;
  refreshShortcut: string;
  actualSizeShortcut: string;
  zoomInShortcut: string;
  zoomOutShortcut: string;
  findShortcut: string;
  printShortcut: string;
  downloadsShortcut: string;
  closeTabsShortcut: string;
  reopenClosedTabShortcut: string;
  onForward: () => void;
  onRefresh: () => void;
  onCopyLink: () => void;
  onOpenExternal: () => void;
  onActualSize: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFind: () => void;
  onPrint: () => void;
  onOpenDownloads: () => void;
  onCloseAllTabs: () => void;
  onReopenClosedTab: () => void;
  onHistorySelect: (historyIndex: number) => void;
  onCloseTab: () => void;
}) {
  const { t } = useTranslation();
  const isActualSize = zoomScale === DEFAULT_ZOOM_SCALE;

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
          <ContextMenuCheckboxItem
            checked={isActualSize}
            onCheckedChange={onActualSize}
          >
            {t("pagePreview.actualSize", "Actual Size")}
            <ContextMenuShortcut>{actualSizeShortcut}</ContextMenuShortcut>
          </ContextMenuCheckboxItem>
          <ContextMenuItem onClick={onZoomIn}>
            <span className="mr-6" />
            {t("pagePreview.zoomIn", "Zoom In")}
            <ContextMenuShortcut>{zoomInShortcut}</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem onClick={onZoomOut}>
            <span className="mr-6" />
            {t("pagePreview.zoomOut", "Zoom Out")}
            <ContextMenuShortcut>{zoomOutShortcut}</ContextMenuShortcut>
          </ContextMenuItem>
        </ContextMenuSubContent>
      </ContextMenuSub>
      <ContextMenuItem onClick={onFind}>
        {t("common.find", "Find...")}
        <ContextMenuShortcut>{findShortcut}</ContextMenuShortcut>
      </ContextMenuItem>
      <ContextMenuItem onClick={onPrint}>
        {t("common.print", "Print")}
        <ContextMenuShortcut>{printShortcut}</ContextMenuShortcut>
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem onClick={onForward} disabled={!canGoForward}>
        <CornerUpRight className="mr-2 h-4 w-4" />
        {t("common.forward", "Forward")}
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem onClick={onOpenExternal} disabled={!canOpenExternal}>
        {t("page.openExternalDefault", "Open with Default Browser")}
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuSub>
        <ContextMenuSubTrigger>
          {t("pagePreview.history", "History")}
        </ContextMenuSubTrigger>
        <ContextMenuSubContent className="w-64">
          {historyItems.length > 0 ? (
            historyItems.map((item) => (
              <ContextMenuCheckboxItem
                key={`${item.historyIndex}:${item.url}`}
                checked={item.active}
                onCheckedChange={() => onHistorySelect(item.historyIndex)}
              >
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
              </ContextMenuCheckboxItem>
            ))
          ) : (
            <ContextMenuItem disabled>
              {t("pagePreview.noHistory", "No history")}
            </ContextMenuItem>
          )}
        </ContextMenuSubContent>
      </ContextMenuSub>
      <ContextMenuItem onClick={onOpenDownloads}>
        {t("pagePreview.downloads", "Downloads")}
        <ContextMenuShortcut>{downloadsShortcut}</ContextMenuShortcut>
      </ContextMenuItem>
      <ContextMenuItem onClick={onCloseAllTabs}>
        {t("tabBar.closeAllTabs", "Close All Tabs")}
        <ContextMenuShortcut>{closeTabsShortcut}</ContextMenuShortcut>
      </ContextMenuItem>
      <ContextMenuItem onClick={onReopenClosedTab} disabled={!canReopenClosedTab}>
        {t("tabBar.reopenClosedTab", "Reopen Closed Tab")}
        <ContextMenuShortcut>{reopenClosedTabShortcut}</ContextMenuShortcut>
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem onClick={onCloseTab}>
        {t("tabBar.closeTab", "Close Tab")}
      </ContextMenuItem>
    </>
  );
}

function PreviewFindBar({
  open,
  query,
  onQueryChange,
  onSearch,
  onClose,
}: {
  open: boolean;
  query: string;
  onQueryChange: (query: string) => void;
  onSearch: (query: string, backwards?: boolean) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [open]);

  if (!open) return null;

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      onSearch(query, event.shiftKey);
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    }
  };

  return (
    <div className="absolute right-3 top-3 z-50 flex h-9 items-center gap-1 rounded-md border bg-popover px-2 text-popover-foreground shadow-md">
      <Search className="h-4 w-4 text-muted-foreground" />
      <input
        ref={inputRef}
        aria-label={t("common.find", "Find...")}
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        onKeyDown={handleKeyDown}
        className="h-7 w-44 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        placeholder={t("common.find", "Find...")}
      />
      <button
        type="button"
        aria-label={t("pagePreview.previousMatch", "Previous match")}
        className="inline-flex h-6 w-6 items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        onClick={() => onSearch(query, true)}
      >
        <ChevronUp className="h-4 w-4" />
      </button>
      <button
        type="button"
        aria-label={t("pagePreview.nextMatch", "Next match")}
        className="inline-flex h-6 w-6 items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        onClick={() => onSearch(query)}
      >
        <ChevronDown className="h-4 w-4" />
      </button>
      <button
        type="button"
        aria-label={t("common.close", "Close")}
        className="inline-flex h-6 w-6 items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        onClick={onClose}
      >
        <X className="h-4 w-4" />
      </button>
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
