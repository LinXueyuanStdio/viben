import React, { useState, useCallback, useRef, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Loader2, FolderOpen, File, FileCode, FileImage, FileText, X, GripVertical, Code } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageWrapper } from "@/components/layout";
import { WorkspaceHeader } from "@/components/workspace";
import { FileBrowser, FileBrowserToolbar, type FileBrowserRef } from "@/components/file-browser";
import { useLocalWorkspaces } from "@/hooks";
import { useDesktopRouting } from "@/hooks/use-desktop-routing";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { getGatewayClient } from "@/lib/gateway";
import type { BreadcrumbSegment } from "@/components/workspace/workspace-breadcrumb";
import type { ViewMode, SortField, SortDirection, GroupField } from "@/hooks/use-file-browser";
import type { FileEntry } from "@/types";

// Artifact preview components
import { ImagePreview } from "@/components/artifacts/image-preview";
import { CodePreview } from "@/components/artifacts/code-preview";
import { MarkdownPreview } from "@/components/artifacts/markdown-preview";
import { PdfPreview } from "@/components/artifacts/pdf-preview";
import { AudioPreview } from "@/components/artifacts/audio-preview";
import { VideoPreview } from "@/components/artifacts/video-preview";
import { FontPreview } from "@/components/artifacts/font-preview";
import { DocxPreview } from "@/components/artifacts/docx-preview";
import { XlsxPreview } from "@/components/artifacts/xlsx-preview";
import { PptxPreview } from "@/components/artifacts/pptx-preview";
import { getArtifactTypeFromExt, getFileExtension, parseCSV } from "@/components/artifacts/utils";
import type { Artifact, ArtifactType } from "@/components/artifacts/types";

/* -----------------------------------------------------------------------------
 * Constants
 * -------------------------------------------------------------------------- */
const MIN_PREVIEW_WIDTH = 280;
const DEFAULT_PREVIEW_WIDTH = 300;
const PREVIEW_WIDTH_STORAGE_KEY = "workspace-files.previewPanelWidth";

/* -----------------------------------------------------------------------------
 * Types
 * -------------------------------------------------------------------------- */
interface PreviewTab {
  file: FileEntry;
  content: string | null;
  loading: boolean;
}

/* -----------------------------------------------------------------------------
 * Utility Functions
 * -------------------------------------------------------------------------- */
function getFileIcon(file: FileEntry, size: "sm" | "md" = "md") {
  const sizeClass = size === "sm" ? "h-4 w-4" : "h-5 w-5";
  const iconClass = cn(sizeClass, "flex-shrink-0");

  if (file.is_directory) {
    return <FolderOpen className={cn(iconClass, "text-amber-500")} />;
  }

  const ext = file.name.split(".").pop()?.toLowerCase();

  switch (ext) {
    case "jpg":
    case "jpeg":
    case "png":
    case "gif":
    case "webp":
    case "svg":
    case "ico":
      return <FileImage className={cn(iconClass, "text-pink-500")} />;
    case "ts":
    case "tsx":
    case "js":
    case "jsx":
    case "py":
    case "rs":
    case "go":
    case "java":
    case "c":
    case "cpp":
    case "h":
    case "css":
    case "scss":
    case "html":
    case "json":
    case "yaml":
    case "yml":
    case "toml":
    case "xml":
      return <FileCode className={cn(iconClass, "text-blue-500")} />;
    case "md":
    case "txt":
    case "log":
    case "csv":
      return <FileText className={cn(iconClass, "text-green-500")} />;
    default:
      return <File className={cn(iconClass, "text-muted-foreground")} />;
  }
}

/**
 * Convert FileEntry to Artifact for preview components
 */
function fileEntryToArtifact(file: FileEntry, content: string | null): Artifact {
  const ext = getFileExtension(file.name);
  const type = getArtifactTypeFromExt(ext);

  return {
    id: file.path,
    name: file.name,
    type,
    content: content ?? undefined,
    path: file.path,
    fileSize: file.size,
  };
}

/**
 * Check if artifact type needs text content for preview
 */
function needsTextContent(type: ArtifactType): boolean {
  return ["code", "text", "markdown", "csv", "json", "html", "jsx", "css"].includes(type);
}

/* -----------------------------------------------------------------------------
 * ResizeHandle Component
 * -------------------------------------------------------------------------- */
function ResizeHandle({
  onResize,
}: {
  onResize: (delta: number) => void;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    startXRef.current = e.clientX;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const delta = startXRef.current - moveEvent.clientX;
      startXRef.current = moveEvent.clientX;
      onResize(delta);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  return (
    <div
      className={cn(
        "group absolute left-0 top-0 bottom-0 w-1 cursor-col-resize z-10",
        "flex items-center justify-center",
        isDragging && "bg-primary/30"
      )}
      onMouseDown={handleMouseDown}
    >
      <div
        className={cn(
          "absolute inset-y-0 w-0.5 transition-colors",
          isDragging ? "bg-primary" : "bg-transparent group-hover:bg-border"
        )}
      />
      <div
        className={cn(
          "absolute flex items-center justify-center w-4 h-8 rounded-md transition-all",
          isDragging
            ? "bg-primary text-primary-foreground"
            : "bg-muted/80 text-muted-foreground opacity-0 group-hover:opacity-100"
        )}
      >
        <GripVertical className="h-4 w-4" />
      </div>
    </div>
  );
}

/* -----------------------------------------------------------------------------
 * EditorTab Component
 * -------------------------------------------------------------------------- */
function EditorTab({
  tab,
  isActive,
  onClick,
  onClose,
}: {
  tab: PreviewTab;
  isActive: boolean;
  onClick: () => void;
  onClose: () => void;
}) {
  const Icon = () => getFileIcon(tab.file, "sm");

  return (
    <div
      role="tab"
      tabIndex={0}
      className={cn(
        "group relative flex items-center gap-2 px-3 py-2 text-xs font-medium transition-all cursor-pointer",
        "border-b-2 -mb-[2px]",
        isActive
          ? "border-primary text-foreground bg-background"
          : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30"
      )}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <Icon />
      <span className="truncate max-w-24">{tab.file.name}</span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className={cn(
          "p-0.5 rounded-sm hover:bg-accent transition-colors ml-1",
          isActive ? "opacity-70 hover:opacity-100" : "opacity-0 group-hover:opacity-70 hover:!opacity-100"
        )}
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

/* -----------------------------------------------------------------------------
 * FilePreviewContent Component - Renders appropriate preview based on file type
 * -------------------------------------------------------------------------- */
function FilePreviewContent({
  file,
  content,
}: {
  file: FileEntry;
  content: string | null;
}) {
  const { t } = useTranslation();
  const artifact = fileEntryToArtifact(file, content);

  // Image Preview
  if (artifact.type === "image") {
    return <ImagePreview artifact={artifact} />;
  }

  // PDF Preview
  if (artifact.type === "pdf") {
    return <PdfPreview artifact={artifact} />;
  }

  // Audio Preview
  if (artifact.type === "audio") {
    return <AudioPreview artifact={artifact} />;
  }

  // Video Preview
  if (artifact.type === "video") {
    return <VideoPreview artifact={artifact} />;
  }

  // Font Preview
  if (artifact.type === "font") {
    return <FontPreview artifact={artifact} />;
  }

  // Document Preview (Word)
  if (artifact.type === "document") {
    return <DocxPreview artifact={artifact} />;
  }

  // Spreadsheet Preview (Excel)
  if (artifact.type === "spreadsheet") {
    return <XlsxPreview artifact={artifact} />;
  }

  // Presentation Preview (PowerPoint)
  if (artifact.type === "presentation") {
    return <PptxPreview artifact={artifact} />;
  }

  // Markdown Preview
  if (artifact.type === "markdown" && content) {
    return <MarkdownPreview artifact={artifact} />;
  }

  // CSV Preview
  if (artifact.type === "csv" && content) {
    const csvData = parseCSV(content);
    return (
      <div className="bg-background h-full overflow-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-muted sticky top-0">
            {csvData.length > 0 && (
              <tr>
                {csvData[0].map((cell, i) => (
                  <th
                    key={i}
                    className="border-border text-foreground border px-3 py-2 text-left font-medium"
                  >
                    {cell}
                  </th>
                ))}
              </tr>
            )}
          </thead>
          <tbody>
            {csvData.slice(1).map((row, rowIndex) => (
              <tr key={rowIndex} className="hover:bg-muted/50">
                {row.map((cell, cellIndex) => (
                  <td
                    key={cellIndex}
                    className="border-border text-foreground border px-3 py-2"
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // HTML Preview (in iframe)
  if (artifact.type === "html" && content) {
    const blob = new Blob([content], { type: "text/html" });
    const iframeSrc = URL.createObjectURL(blob);
    return (
      <div className="h-full bg-white">
        <iframe
          src={iframeSrc}
          className="h-full w-full border-0"
          sandbox="allow-scripts allow-same-origin"
          title={file.name}
          onLoad={() => URL.revokeObjectURL(iframeSrc)}
        />
      </div>
    );
  }

  // Code/Text Preview
  if (["code", "text", "jsx", "css", "json"].includes(artifact.type) && content) {
    return <CodePreview artifact={artifact} />;
  }

  // No content or unsupported type
  if (content === null && needsTextContent(artifact.type)) {
    return (
      <div className="bg-muted/20 flex h-full flex-col items-center justify-center p-8">
        <div className="flex flex-col items-center text-center">
          <div className="border-border bg-background mb-4 flex size-16 items-center justify-center rounded-xl border">
            <Code className="text-muted-foreground/50 size-8" />
          </div>
          <h3 className="text-muted-foreground text-sm font-medium">
            {t("fileBrowser.unableToPreview")}
          </h3>
          <p className="text-muted-foreground/70 mt-1 text-xs">
            {t("fileBrowser.fileTooLarge", "File may be too large or binary")}
          </p>
        </div>
      </div>
    );
  }

  // Default: show "unable to preview" message
  return (
    <div className="bg-muted/20 flex h-full flex-col items-center justify-center p-8">
      <div className="flex flex-col items-center text-center">
        <div className="border-border bg-background mb-4 flex size-16 items-center justify-center rounded-xl border">
          <File className="text-muted-foreground/50 size-8" />
        </div>
        <h3 className="text-muted-foreground text-sm font-medium">
          {t("fileBrowser.previewNotAvailable")}
        </h3>
      </div>
    </div>
  );
}

/* -----------------------------------------------------------------------------
 * FilePreviewPanel Component
 * -------------------------------------------------------------------------- */
function FilePreviewPanel({
  tabs,
  activeTabPath,
  onTabClick,
  onTabClose,
  width,
  onResize,
}: {
  tabs: PreviewTab[];
  activeTabPath: string | null;
  onTabClick: (path: string) => void;
  onTabClose: (path: string) => void;
  width: number;
  onResize: (delta: number) => void;
}) {
  const { t } = useTranslation();
  const activeTab = tabs.find((tab) => tab.file.path === activeTabPath);

  if (tabs.length === 0) {
    return null;
  }

  return (
    <div
      className="relative flex flex-col border-l bg-background"
      style={{ width, minWidth: MIN_PREVIEW_WIDTH }}
    >
      <ResizeHandle onResize={onResize} />

      {/* Tab bar */}
      <div className="flex items-center border-b overflow-x-auto bg-muted/30">
        {tabs.map((tab) => (
          <EditorTab
            key={tab.file.path}
            tab={tab}
            isActive={tab.file.path === activeTabPath}
            onClick={() => onTabClick(tab.file.path)}
            onClose={() => onTabClose(tab.file.path)}
          />
        ))}
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-hidden">
        {activeTab ? (
          activeTab.loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <FilePreviewContent file={activeTab.file} content={activeTab.content} />
          )
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <FileText className="h-12 w-12 mb-2" />
            <p className="text-sm">{t("workspace.selectFileToView")}</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* -----------------------------------------------------------------------------
 * Main Component
 * -------------------------------------------------------------------------- */
export function WorkspaceFilesPage() {
  const { t } = useTranslation();
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { getWorkspace, isLoading, workspaces } = useLocalWorkspaces();
  const { openDashboard } = useDesktopRouting();

  // Reference to FileBrowser for imperative navigation
  const fileBrowserRef = useRef<FileBrowserRef>(null);

  // Track current path segments for breadcrumb
  const [currentSegments, setCurrentSegments] = useState<{ name: string; path: string }[]>([]);

  // Track view mode state (for toolbar in header)
  // Initialize from localStorage if available
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = localStorage.getItem("fileBrowser.viewMode");
    return (saved as ViewMode) || "column";
  });

  // Track sort state (for toolbar in header)
  const [sortField, setSortField] = useState<SortField>(() => {
    const saved = localStorage.getItem("fileBrowser.sortField");
    return (saved as SortField) || "name";
  });
  const [sortDirection, setSortDirection] = useState<SortDirection>(() => {
    const saved = localStorage.getItem("fileBrowser.sortDirection");
    return (saved as SortDirection) || "asc";
  });

  // Track search state (for toolbar in header)
  const [searchQuery, setSearchQuery] = useState("");

  // Track group state (for toolbar in header)
  const [groupField, setGroupField] = useState<GroupField>(() => {
    const saved = localStorage.getItem("fileBrowser.groupField");
    return (saved as GroupField) || "none";
  });

  // Preview panel state
  const [previewTabs, setPreviewTabs] = useState<PreviewTab[]>([]);
  const [activePreviewPath, setActivePreviewPath] = useState<string | null>(null);
  const [previewPanelWidth, setPreviewPanelWidth] = useState<number>(() => {
    const saved = localStorage.getItem(PREVIEW_WIDTH_STORAGE_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_PREVIEW_WIDTH;
  });
  const containerRef = useRef<HTMLDivElement>(null);

  // Handle opening a file in preview panel
  const handleFilePreview = useCallback(async (file: FileEntry) => {
    if (file.is_directory) return;

    // Check if tab already exists
    const existingTab = previewTabs.find((tab) => tab.file.path === file.path);
    if (existingTab) {
      setActivePreviewPath(file.path);
      return;
    }

    // Determine file type to decide if we need to load text content
    const ext = getFileExtension(file.name);
    const artifactType = getArtifactTypeFromExt(ext);
    const needsContent = needsTextContent(artifactType);

    // For non-text files (images, PDFs, etc.), add tab immediately without loading content
    // The preview component will handle loading the binary data itself
    if (!needsContent) {
      const newTab: PreviewTab = {
        file,
        content: null,
        loading: false,
      };
      setPreviewTabs((prev) => [...prev, newTab]);
      setActivePreviewPath(file.path);
      return;
    }

    // For text-based files, add tab in loading state and load content
    const newTab: PreviewTab = {
      file,
      content: null,
      loading: true,
    };
    setPreviewTabs((prev) => [...prev, newTab]);
    setActivePreviewPath(file.path);

    // Load file content for text-based files
    // Get workspace path from workspaceId
    const ws = workspaceId ? getWorkspace(workspaceId) : undefined;
    if (!ws?.path) {
      console.error("Workspace not found");
      setPreviewTabs((prev) =>
        prev.map((tab) =>
          tab.file.path === file.path
            ? { ...tab, content: null, loading: false }
            : tab
        )
      );
      return;
    }

    try {
      const content = await getGatewayClient().readFileContent(ws.path, file.path);
      setPreviewTabs((prev) =>
        prev.map((tab) =>
          tab.file.path === file.path
            ? { ...tab, content, loading: false }
            : tab
        )
      );
    } catch (error) {
      console.error("Failed to read file:", error);
      setPreviewTabs((prev) =>
        prev.map((tab) =>
          tab.file.path === file.path
            ? { ...tab, content: null, loading: false }
            : tab
        )
      );
    }
  }, [previewTabs, workspaceId, getWorkspace]);

  // Handle closing a preview tab
  const handleClosePreviewTab = useCallback((path: string) => {
    setPreviewTabs((prev) => {
      const newTabs = prev.filter((tab) => tab.file.path !== path);
      // If closing active tab, switch to another tab
      if (activePreviewPath === path && newTabs.length > 0) {
        const closedIndex = prev.findIndex((tab) => tab.file.path === path);
        const newActiveIndex = Math.min(closedIndex, newTabs.length - 1);
        setActivePreviewPath(newTabs[newActiveIndex]?.file.path || null);
      } else if (newTabs.length === 0) {
        setActivePreviewPath(null);
      }
      return newTabs;
    });
  }, [activePreviewPath]);

  // Handle resize
  const handlePreviewResize = useCallback((delta: number) => {
    setPreviewPanelWidth((prev) => {
      const containerWidth = containerRef.current?.offsetWidth || 800;
      const maxWidth = containerWidth - 400; // Leave at least 400px for file browser
      const newWidth = Math.max(MIN_PREVIEW_WIDTH, Math.min(prev + delta, maxWidth));
      localStorage.setItem(PREVIEW_WIDTH_STORAGE_KEY, String(newWidth));
      return newWidth;
    });
  }, []);

  // Sync viewMode when FileBrowser initializes
  useEffect(() => {
    if (fileBrowserRef.current) {
      const browserViewMode = fileBrowserRef.current.viewMode;
      if (browserViewMode !== viewMode) {
        setViewMode(browserViewMode);
      }
    }
  }, []);

  const workspace = workspaceId ? getWorkspace(workspaceId) : undefined;

  // Handle path changes from FileBrowser
  const handlePathChange = useCallback(
    (_path: string, segments: { name: string; path: string }[]) => {
      setCurrentSegments(segments);
    },
    []
  );

  // Build breadcrumb segments with proper onClick handlers for column navigation
  const buildBreadcrumbs = useCallback((): BreadcrumbSegment[] => {
    const breadcrumbs: BreadcrumbSegment[] = [
      {
        id: `workspace:${workspaceId}:files`,
        label: t("workspace.files", "Files"),
        href: `/workspace/${workspaceId}/files`,
        descriptorId: "workspace-section:files",
        icon: { type: "lucide", value: "folder-open" },
        path: workspace?.path,
        meta: {
          workspaceId,
          section: "files",
          routePath: "files",
        },
        onClick: () => {
          // Navigate to root (column index 0)
          fileBrowserRef.current?.navigateToColumnIndex(0);
        },
      },
    ];

    // Add path segments with onClick handlers for column navigation
    currentSegments.forEach((segment, index) => {
      breadcrumbs.push({
        id: `workspace:${workspaceId}:files:${segment.path}`,
        label: segment.name,
        href: `/workspace/${workspaceId}/files`,
        descriptorId: "virtual-folder",
        icon: { type: "lucide", value: "folder" },
        path: segment.path,
        meta: {
          workspaceId,
          section: "files",
          routePath: "files",
        },
        onClick: () => {
          // Navigate to column index (index + 1 because root is 0)
          fileBrowserRef.current?.navigateToColumnIndex(index + 1);
        },
      });
    });

    return breadcrumbs;
  }, [currentSegments, workspaceId, workspace?.path, t]);

  const pathSegments = buildBreadcrumbs();

  // Show loading state while workspaces are being fetched
  if (isLoading && !workspace) {
    return (
      <PageWrapper>
        <div className="flex flex-col items-center justify-center h-[60vh]">
          <Loader2 className="h-12 w-12 animate-spin text-muted-foreground mb-4" />
          <p className="text-muted-foreground">{t("common.loading")}</p>
        </div>
      </PageWrapper>
    );
  }

  // Only show "not found" after workspaces have loaded
  if (!workspace && workspaces.length > 0) {
    return (
      <PageWrapper>
        <div className="flex flex-col items-center justify-center h-[60vh]">
          <FolderOpen className="h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">
            {t("workspace.notFound")}
          </h2>
          <p className="text-muted-foreground mb-4">
            {t("workspace.notFoundDesc")}
          </p>
          <Button
            type="button"
            onClick={() => openDashboard()}
          >
            {t("workspace.backToDashboard")}
          </Button>
        </div>
      </PageWrapper>
    );
  }

  // Fallback - still loading or no workspaces
  if (!workspace) {
    return (
      <PageWrapper>
        <div className="flex flex-col items-center justify-center h-[60vh]">
          <Loader2 className="h-12 w-12 animate-spin text-muted-foreground mb-4" />
          <p className="text-muted-foreground">{t("common.loading")}</p>
        </div>
      </PageWrapper>
    );
  }

  // Handle view mode change from toolbar
  const handleViewModeChange = useCallback((mode: ViewMode) => {
    setViewMode(mode);
    fileBrowserRef.current?.setViewMode(mode);
  }, []);

  // Handle sort field change from toolbar
  const handleSortFieldChange = useCallback((field: SortField) => {
    setSortField(field);
    localStorage.setItem("fileBrowser.sortField", field);
    fileBrowserRef.current?.setSortField(field);
  }, []);

  // Handle sort direction change from toolbar
  const handleSortDirectionChange = useCallback((direction: SortDirection) => {
    setSortDirection(direction);
    localStorage.setItem("fileBrowser.sortDirection", direction);
    fileBrowserRef.current?.setSortDirection(direction);
  }, []);

  // Handle search change from toolbar
  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);
    fileBrowserRef.current?.setSearchQuery(query);
  }, []);

  // Handle group field change from toolbar
  const handleGroupFieldChange = useCallback((field: GroupField) => {
    setGroupField(field);
    localStorage.setItem("fileBrowser.groupField", field);
    fileBrowserRef.current?.setGroupField(field);
  }, []);

  // Toolbar component for header's rightContent
  const toolbarContent = (
    <FileBrowserToolbar
      viewMode={viewMode}
      onViewModeChange={handleViewModeChange}
      sortField={sortField}
      sortDirection={sortDirection}
      onSortFieldChange={handleSortFieldChange}
      onSortDirectionChange={handleSortDirectionChange}
      groupField={groupField}
      onGroupFieldChange={handleGroupFieldChange}
      searchQuery={searchQuery}
      onSearchChange={handleSearchChange}
      onNewFile={() => fileBrowserRef.current?.createFile()}
      onNewFolder={() => fileBrowserRef.current?.createFolder()}
    />
  );

  return (
    <PageWrapper className="flex flex-col h-full">
      <WorkspaceHeader
        workspace={workspace}
        segments={pathSegments}
        showRefresh={false}
        showRemove={false}
        rightContent={toolbarContent}
      />

      <div ref={containerRef} className="flex-1 flex overflow-hidden">
        {/* File Browser */}
        <div className="flex-1 overflow-hidden">
          <FileBrowser
            ref={fileBrowserRef}
            workspacePath={workspace.path}
            className="h-full"
            onPathChange={handlePathChange}
            onFilePreview={handleFilePreview}
            hideToolbar
          />
        </div>

        {/* Preview Panel */}
        <FilePreviewPanel
          tabs={previewTabs}
          activeTabPath={activePreviewPath}
          onTabClick={setActivePreviewPath}
          onTabClose={handleClosePreviewTab}
          width={previewPanelWidth}
          onResize={handlePreviewResize}
        />
      </div>
    </PageWrapper>
  );
}
