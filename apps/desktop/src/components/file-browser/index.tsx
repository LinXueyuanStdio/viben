import * as React from "react";
import { useCallback, useEffect, useRef, useImperativeHandle, forwardRef } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ChevronRight,
  Copy,
  Eye,
  File,
  FileCode,
  FileImage,
  FileText,
  Folder,
  FolderPlus,
  FilePlus,
  LayoutGrid,
  List,
  Loader2,
  Scissors,
  Trash2,
  Pencil,
  Columns3,
  Image,
  Home,
  HardDrive,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
// Dropdown menu components available if needed:
// import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { invoke } from "@tauri-apps/api/core";
import { useFileBrowser, type ViewMode } from "@/hooks/use-file-browser";
import type { FileEntry } from "@/types";

/* -----------------------------------------------------------------------------
 * Types
 * -------------------------------------------------------------------------- */

interface FileBrowserProps {
  workspacePath: string;
  initialPath?: string;
  className?: string;
  /** Callback when path changes - used to sync with workspace breadcrumb */
  onPathChange?: (path: string, segments: { name: string; path: string }[]) => void;
  /** Hide internal toolbar completely (when using external toolbar in header) */
  hideToolbar?: boolean;
}

/** Methods exposed via ref for external control */
export interface FileBrowserRef {
  navigateToColumnIndex: (index: number) => void;
  // View mode control
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  // File creation
  createFile: () => void;
  createFolder: () => void;
}

interface SidebarItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  path?: string;
  onClick?: () => void;
}

/* -----------------------------------------------------------------------------
 * Utility Functions
 * -------------------------------------------------------------------------- */

function getFileIcon(file: FileEntry, size: "sm" | "md" | "lg" = "md") {
  const sizeClass = size === "sm" ? "h-4 w-4" : size === "lg" ? "h-12 w-12" : "h-5 w-5";
  const iconClass = cn(sizeClass, "flex-shrink-0");

  if (file.is_directory) {
    return <Folder className={cn(iconClass, "text-amber-500")} />;
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

function formatFileSize(bytes: number | undefined): string {
  if (!bytes || bytes === 0) return "--";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return "--";
  const date = new Date(dateStr);
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getPathSegments(path: string, rootPath: string): { name: string; path: string }[] {
  const relativePath = path.replace(rootPath, "");
  const parts = relativePath.split("/").filter(Boolean);

  const segments: { name: string; path: string }[] = [];
  let currentPath = rootPath;

  for (const part of parts) {
    currentPath = `${currentPath}/${part}`;
    segments.push({ name: part, path: currentPath });
  }

  return segments;
}

/* -----------------------------------------------------------------------------
 * View Mode Toggle
 * -------------------------------------------------------------------------- */

interface ViewModeToggleProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}

function ViewModeToggle({ viewMode, onViewModeChange }: ViewModeToggleProps) {
  const modes: { mode: ViewMode; icon: React.ReactNode; label: string }[] = [
    { mode: "list", icon: <List className="h-4 w-4" />, label: "List" },
    { mode: "icon", icon: <LayoutGrid className="h-4 w-4" />, label: "Icon" },
    { mode: "column", icon: <Columns3 className="h-4 w-4" />, label: "Column" },
    { mode: "gallery", icon: <Image className="h-4 w-4" />, label: "Gallery" },
  ];

  return (
    <TooltipProvider>
      <div className="flex items-center gap-0.5 bg-muted rounded-lg p-0.5">
        {modes.map(({ mode, icon, label }) => (
          <Tooltip key={mode}>
            <TooltipTrigger asChild>
              <Button
                variant={viewMode === mode ? "secondary" : "ghost"}
                size="sm"
                className={cn(
                  "h-7 w-7 p-0",
                  viewMode === mode && "bg-background shadow-sm"
                )}
                onClick={() => onViewModeChange(mode)}
              >
                {icon}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{label}</TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
}

/* -----------------------------------------------------------------------------
 * Toolbar
 * -------------------------------------------------------------------------- */

interface ToolbarProps {
  workspacePath: string;
  currentPath: string;
  viewMode: ViewMode;
  canGoBack: boolean;
  canGoForward: boolean;
  canGoUp: boolean;
  onGoBack: () => void;
  onGoForward: () => void;
  onGoUp: () => void;
  onNavigateTo: (path: string) => void;
  onViewModeChange: (mode: ViewMode) => void;
  onNewFile: () => void;
  onNewFolder: () => void;
}

function Toolbar({
  workspacePath,
  currentPath,
  viewMode,
  canGoBack,
  canGoForward,
  canGoUp,
  onGoBack,
  onGoForward,
  onGoUp,
  onNavigateTo,
  onViewModeChange,
  onNewFile,
  onNewFolder,
}: ToolbarProps) {
  const pathSegments = getPathSegments(currentPath, workspacePath);

  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b bg-background/50">
      {/* Navigation buttons */}
      <TooltipProvider>
        <div className="flex items-center gap-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                disabled={!canGoBack}
                onClick={onGoBack}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Back</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                disabled={!canGoForward}
                onClick={onGoForward}
              >
                <ArrowRight className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Forward</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                disabled={!canGoUp}
                onClick={onGoUp}
              >
                <ArrowUp className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Up</TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>

      <Separator orientation="vertical" className="h-6" />

      {/* Breadcrumb */}
      <div className="flex-1 flex items-center gap-1 overflow-hidden">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-muted-foreground hover:text-foreground"
          onClick={() => onNavigateTo(workspacePath)}
        >
          <Home className="h-4 w-4 mr-1" />
          <span className="truncate max-w-[100px]">
            {workspacePath.split("/").pop()}
          </span>
        </Button>
        {pathSegments.map((segment, i) => (
          <React.Fragment key={segment.path}>
            <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "h-7 px-2",
                i === pathSegments.length - 1
                  ? "text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => onNavigateTo(segment.path)}
            >
              <span className="truncate max-w-[100px]">{segment.name}</span>
            </Button>
          </React.Fragment>
        ))}
      </div>

      <Separator orientation="vertical" className="h-6" />

      {/* View mode toggle */}
      <ViewModeToggle viewMode={viewMode} onViewModeChange={onViewModeChange} />

      <Separator orientation="vertical" className="h-6" />

      {/* Action buttons */}
      <TooltipProvider>
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onNewFile}>
                <FilePlus className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>New File (Cmd+N)</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onNewFolder}>
                <FolderPlus className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>New Folder (Cmd+Shift+N)</TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    </div>
  );
}

/* -----------------------------------------------------------------------------
 * Sidebar
 * -------------------------------------------------------------------------- */

interface SidebarProps {
  workspacePath: string;
  onNavigateTo: (path: string) => void;
}

function Sidebar({ workspacePath, onNavigateTo }: SidebarProps) {
  const favorites: SidebarItem[] = [
    {
      id: "workspace",
      label: workspacePath.split("/").pop() || "Workspace",
      icon: <Folder className="h-4 w-4 text-amber-500" />,
      path: workspacePath,
    },
  ];

  const locations: SidebarItem[] = [
    {
      id: "root",
      label: "Workspace Root",
      icon: <HardDrive className="h-4 w-4 text-muted-foreground" />,
      path: workspacePath,
    },
  ];

  return (
    <div className="w-48 flex-shrink-0 border-r bg-muted/30">
      <ScrollArea className="h-full">
        <div className="p-2 space-y-4">
          {/* Favorites */}
          <div>
            <div className="px-2 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Favorites
            </div>
            <div className="space-y-0.5">
              {favorites.map((item) => (
                <Button
                  key={item.id}
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start h-8 px-2"
                  onClick={() => item.path && onNavigateTo(item.path)}
                >
                  {item.icon}
                  <span className="ml-2 truncate">{item.label}</span>
                </Button>
              ))}
            </div>
          </div>

          {/* Locations */}
          <div>
            <div className="px-2 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Locations
            </div>
            <div className="space-y-0.5">
              {locations.map((item) => (
                <Button
                  key={item.id}
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start h-8 px-2"
                  onClick={() => item.path && onNavigateTo(item.path)}
                >
                  {item.icon}
                  <span className="ml-2 truncate">{item.label}</span>
                </Button>
              ))}
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

/* -----------------------------------------------------------------------------
 * List View
 * -------------------------------------------------------------------------- */

interface ListViewProps {
  files: FileEntry[];
  selectedFiles: Set<string>;
  onSelect: (file: FileEntry, multiSelect?: boolean) => void;
  onOpen: (file: FileEntry) => void;
  onContextMenu: (file: FileEntry, e: React.MouseEvent) => void;
}

function ListView({ files, selectedFiles, onSelect, onOpen, onContextMenu }: ListViewProps) {
  return (
    <div className="divide-y">
      {/* Header */}
      <div className="flex items-center gap-4 px-4 py-2 text-xs font-medium text-muted-foreground bg-muted/30">
        <div className="flex-1">Name</div>
        <div className="w-24 text-right">Size</div>
        <div className="w-32 text-right">Modified</div>
      </div>
      {/* Items */}
      {files.map((file) => (
        <div
          key={file.path}
          className={cn(
            "flex items-center gap-4 px-4 py-2 cursor-pointer",
            "hover:bg-accent/50 transition-colors",
            selectedFiles.has(file.path) && "bg-accent"
          )}
          onClick={(e) => onSelect(file, e.metaKey || e.ctrlKey)}
          onDoubleClick={() => onOpen(file)}
          onContextMenu={(e) => onContextMenu(file, e)}
        >
          <div className="flex-1 flex items-center gap-3 min-w-0">
            {getFileIcon(file)}
            <span className="truncate">{file.name}</span>
          </div>
          <div className="w-24 text-right text-sm text-muted-foreground">
            {file.is_directory ? "--" : formatFileSize(file.size)}
          </div>
          <div className="w-32 text-right text-sm text-muted-foreground">
            {formatDate(file.modified)}
          </div>
        </div>
      ))}
    </div>
  );
}

/* -----------------------------------------------------------------------------
 * Icon View
 * -------------------------------------------------------------------------- */

interface IconViewProps {
  files: FileEntry[];
  selectedFiles: Set<string>;
  onSelect: (file: FileEntry, multiSelect?: boolean) => void;
  onOpen: (file: FileEntry) => void;
  onContextMenu: (file: FileEntry, e: React.MouseEvent) => void;
}

function IconView({ files, selectedFiles, onSelect, onOpen, onContextMenu }: IconViewProps) {
  return (
    <div className="p-4 grid grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-4">
      {files.map((file) => (
        <div
          key={file.path}
          className={cn(
            "flex flex-col items-center gap-2 p-3 rounded-lg cursor-pointer",
            "hover:bg-accent/50 transition-colors",
            selectedFiles.has(file.path) && "bg-accent"
          )}
          onClick={(e) => onSelect(file, e.metaKey || e.ctrlKey)}
          onDoubleClick={() => onOpen(file)}
          onContextMenu={(e) => onContextMenu(file, e)}
        >
          {getFileIcon(file, "lg")}
          <span className="text-xs text-center truncate w-full">{file.name}</span>
        </div>
      ))}
    </div>
  );
}

/* -----------------------------------------------------------------------------
 * Column View (Miller Columns)
 * -------------------------------------------------------------------------- */

interface ColumnViewProps {
  workspacePath: string;
  onSelect: (file: FileEntry) => void;
  onOpen: (file: FileEntry) => void;
  onContextMenu: (file: FileEntry, e: React.MouseEvent) => void;
  /** Called when path changes (for breadcrumb sync) */
  onPathChange?: (path: string, segments: { name: string; path: string }[]) => void;
}

/** Methods exposed by ColumnView via ref */
export interface ColumnViewRef {
  navigateToColumnIndex: (index: number) => void;
}

/** Column data structure */
interface ColumnData {
  path: string;
  files: FileEntry[];
  loading: boolean;
  selectedItem: string | null; // Path of selected item in this column
}

/** Preview Panel for selected file */
function ColumnPreviewPanel({ file, workspacePath }: { file: FileEntry | null; workspacePath: string }) {
  if (!file) {
    return (
      <div className="w-64 min-w-[256px] flex-shrink-0 border-l bg-muted/20 flex items-center justify-center">
        <p className="text-sm text-muted-foreground">No selection</p>
      </div>
    );
  }

  // Calculate relative path
  const relativePath = file.path.startsWith(workspacePath)
    ? file.path.slice(workspacePath.length + 1)
    : file.path;

  return (
    <div className="w-64 min-w-[256px] flex-shrink-0 border-l bg-muted/20 flex flex-col">
      {/* Preview header with large icon */}
      <div className="p-4 flex flex-col items-center border-b">
        <div className="p-3 rounded-xl bg-background shadow-sm mb-2">
          {getFileIcon(file, "lg")}
        </div>
        <h3 className="font-medium text-sm text-center truncate w-full px-2">{file.name}</h3>
        <p className="text-xs text-muted-foreground text-center truncate w-full mt-0.5">
          {file.is_directory ? "Folder" : file.name.split(".").pop()?.toUpperCase() || "File"}
        </p>
      </div>

      {/* File info */}
      <div className="p-3 space-y-2 text-xs flex-1 overflow-auto">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Type</span>
          <span>{file.is_directory ? "Folder" : "File"}</span>
        </div>
        {!file.is_directory && file.size !== undefined && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Size</span>
            <span>{formatFileSize(file.size)}</span>
          </div>
        )}
        {file.modified && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Modified</span>
            <span>{formatDate(file.modified)}</span>
          </div>
        )}
        <div className="pt-2 border-t">
          <span className="text-muted-foreground">Path</span>
          <p className="font-mono mt-1 break-all text-[10px] leading-relaxed">{relativePath}</p>
        </div>
      </div>
    </div>
  );
}

/** Helper to build path segments for breadcrumb */
function buildPathSegments(columns: ColumnData[]): { name: string; path: string }[] {
  // Skip the first column (workspace root), return subsequent paths
  return columns.slice(1).map(col => ({
    name: col.path.split("/").pop() || "",
    path: col.path
  }));
}

const ColumnView = forwardRef<ColumnViewRef, ColumnViewProps>(function ColumnView({
  workspacePath,
  onSelect,
  onOpen,
  onContextMenu,
  onPathChange,
}, ref) {
  const [columns, setColumns] = React.useState<ColumnData[]>([]);
  const [previewFile, setPreviewFile] = React.useState<FileEntry | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isInitializedRef = useRef(false);

  // Load a directory and return sorted files
  const loadDirectoryFiles = useCallback(async (dirPath: string): Promise<FileEntry[]> => {
    const entries = await invoke<FileEntry[]>("read_directory", {
      workspacePath,
      dirPath,
    });
    // Sort: directories first, then files, alphabetically
    return entries.sort((a, b) => {
      if (a.is_directory && !b.is_directory) return -1;
      if (!a.is_directory && b.is_directory) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [workspacePath]);

  // Initialize first column on mount
  useEffect(() => {
    if (isInitializedRef.current) return;
    isInitializedRef.current = true;

    const initFirstColumn = async () => {
      setColumns([{ path: workspacePath, files: [], loading: true, selectedItem: null }]);
      try {
        const files = await loadDirectoryFiles(workspacePath);
        setColumns([{ path: workspacePath, files, loading: false, selectedItem: null }]);
      } catch (error) {
        console.error("Failed to load root directory:", error);
        setColumns([{ path: workspacePath, files: [], loading: false, selectedItem: null }]);
      }
    };

    initFirstColumn();
  }, [workspacePath, loadDirectoryFiles]);

  // Notify parent when columns change (for breadcrumb sync)
  useEffect(() => {
    if (columns.length > 0 && onPathChange) {
      const lastColumn = columns[columns.length - 1];
      const segments = buildPathSegments(columns);
      onPathChange(lastColumn.path, segments);
    }
  }, [columns, onPathChange]);

  // Auto-scroll to the right when new columns are added
  useEffect(() => {
    if (scrollContainerRef.current && columns.length > 1) {
      setTimeout(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollLeft = scrollContainerRef.current.scrollWidth;
        }
      }, 50);
    }
  }, [columns.length]);

  // Handle item click in a column
  const handleItemClick = useCallback(async (columnIndex: number, file: FileEntry) => {
    if (file.is_directory) {
      // Directory clicked - add new column to the right
      setPreviewFile(null);

      // Step 1: Truncate columns to current + set selection + add loading column
      setColumns(prev => {
        const updated = prev.slice(0, columnIndex + 1);
        updated[columnIndex] = { ...updated[columnIndex], selectedItem: file.path };
        return [...updated, { path: file.path, files: [], loading: true, selectedItem: null }];
      });

      // Step 2: Load directory contents
      try {
        const files = await loadDirectoryFiles(file.path);

        // Step 3: Update the new column with loaded files
        setColumns(prev => {
          return prev.map(col =>
            col.path === file.path && col.loading
              ? { ...col, files, loading: false }
              : col
          );
        });
      } catch (error) {
        console.error("Failed to load directory:", error);
        // Remove failed column
        setColumns(prev => prev.filter(col => col.path !== file.path));
      }
    } else {
      // File clicked - show in preview panel, truncate columns to current
      setPreviewFile(file);
      onSelect(file);

      setColumns(prev => {
        const updated = prev.slice(0, columnIndex + 1);
        updated[columnIndex] = { ...updated[columnIndex], selectedItem: file.path };
        return updated;
      });
    }
  }, [loadDirectoryFiles, onSelect]);

  // Navigate to a specific column index (called from breadcrumb)
  const navigateToColumnIndex = useCallback((targetColumnIndex: number) => {
    setColumns(prev => {
      if (targetColumnIndex < 0 || targetColumnIndex >= prev.length) return prev;

      const updated = prev.slice(0, targetColumnIndex + 1);
      // Clear selection in target column
      updated[targetColumnIndex] = { ...updated[targetColumnIndex], selectedItem: null };

      setPreviewFile(null);
      return updated;
    });
  }, []);

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    navigateToColumnIndex,
  }), [navigateToColumnIndex]);

  if (columns.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Columns container with horizontal scroll */}
      <div
        ref={scrollContainerRef}
        className="flex-1 flex overflow-x-auto"
      >
        {columns.map((column, columnIndex) => (
          <div
            key={column.path}
            className="w-52 min-w-[208px] max-w-[208px] flex-shrink-0 border-r bg-background flex flex-col"
          >
            {/* Column content */}
            <ScrollArea className="flex-1">
              {column.loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : column.files.length === 0 ? (
                <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                  Empty folder
                </div>
              ) : (
                <div className="py-0.5">
                  {column.files.map((file) => {
                    const isSelected = column.selectedItem === file.path;
                    return (
                      <div
                        key={file.path}
                        className={cn(
                          "flex items-center gap-1.5 px-2 py-1 cursor-pointer mx-0.5 rounded",
                          "hover:bg-accent/50 transition-colors",
                          "min-w-0", // Allow shrinking
                          isSelected && "bg-primary text-primary-foreground"
                        )}
                        onClick={() => handleItemClick(columnIndex, file)}
                        onDoubleClick={() => !file.is_directory && onOpen(file)}
                        onContextMenu={(e) => onContextMenu(file, e)}
                      >
                        <span className="flex-shrink-0">{getFileIcon(file, "sm")}</span>
                        <span className="flex-1 min-w-0 truncate text-sm">{file.name}</span>
                        {file.is_directory && (
                          <ChevronRight className={cn(
                            "h-3.5 w-3.5 flex-shrink-0",
                            isSelected ? "text-primary-foreground" : "text-muted-foreground"
                          )} />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </div>
        ))}
      </div>

      {/* Preview panel on the right */}
      <ColumnPreviewPanel file={previewFile} workspacePath={workspacePath} />
    </div>
  );
});

/* -----------------------------------------------------------------------------
 * Gallery View
 * -------------------------------------------------------------------------- */

interface GalleryViewProps {
  files: FileEntry[];
  selectedFiles: Set<string>;
  onSelect: (file: FileEntry, multiSelect?: boolean) => void;
  onOpen: (file: FileEntry) => void;
  onContextMenu: (file: FileEntry, e: React.MouseEvent) => void;
}

function GalleryView({ files, selectedFiles, onSelect, onOpen, onContextMenu }: GalleryViewProps) {
  const imageExtensions = ["jpg", "jpeg", "png", "gif", "webp", "svg", "ico"];
  const images = files.filter((f) => {
    const ext = f.name.split(".").pop()?.toLowerCase();
    return ext && imageExtensions.includes(ext);
  });
  const others = files.filter((f) => !images.includes(f));

  return (
    <div className="p-4 space-y-6">
      {/* Images grid */}
      {images.length > 0 && (
        <div>
          <div className="text-sm font-medium text-muted-foreground mb-3">
            Images ({images.length})
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-4">
            {images.map((file) => (
              <div
                key={file.path}
                className={cn(
                  "aspect-square rounded-lg border overflow-hidden cursor-pointer",
                  "hover:ring-2 hover:ring-primary/50 transition-all",
                  selectedFiles.has(file.path) && "ring-2 ring-primary"
                )}
                onClick={(e) => onSelect(file, e.metaKey || e.ctrlKey)}
                onDoubleClick={() => onOpen(file)}
                onContextMenu={(e) => onContextMenu(file, e)}
              >
                <div className="w-full h-full bg-muted flex items-center justify-center">
                  <FileImage className="h-12 w-12 text-muted-foreground" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Other files */}
      {others.length > 0 && (
        <div>
          <div className="text-sm font-medium text-muted-foreground mb-3">
            Other Files ({others.length})
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-3">
            {others.map((file) => (
              <div
                key={file.path}
                className={cn(
                  "flex flex-col items-center gap-2 p-3 rounded-lg cursor-pointer",
                  "hover:bg-accent/50 transition-colors",
                  selectedFiles.has(file.path) && "bg-accent"
                )}
                onClick={(e) => onSelect(file, e.metaKey || e.ctrlKey)}
                onDoubleClick={() => onOpen(file)}
                onContextMenu={(e) => onContextMenu(file, e)}
              >
                {getFileIcon(file, "lg")}
                <span className="text-xs text-center truncate w-full">{file.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* -----------------------------------------------------------------------------
 * Quick Look Preview
 * -------------------------------------------------------------------------- */

interface QuickLookProps {
  file: FileEntry | null;
  onClose: () => void;
  readFileContent: (path: string) => Promise<string | null>;
}

function QuickLook({ file, onClose, readFileContent }: QuickLookProps) {
  const [content, setContent] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  useEffect(() => {
    if (!file || file.is_directory) {
      setContent(null);
      return;
    }

    const loadContent = async () => {
      setLoading(true);
      const result = await readFileContent(file.path);
      setContent(result);
      setLoading(false);
    };

    loadContent();
  }, [file, readFileContent]);

  if (!file) return null;

  const isImage = ["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(
    file.name.split(".").pop()?.toLowerCase() || ""
  );

  return (
    <Dialog open={!!file} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {getFileIcon(file)}
            {file.name}
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : file.is_directory ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
              <Folder className="h-16 w-16 text-amber-500 mb-4" />
              <p>Directory: {file.name}</p>
              <p className="text-sm mt-2">{file.path}</p>
            </div>
          ) : isImage ? (
            <div className="flex items-center justify-center h-64 bg-muted rounded-lg">
              <FileImage className="h-16 w-16 text-muted-foreground" />
            </div>
          ) : content !== null ? (
            <ScrollArea className="h-96 border rounded-lg">
              <pre className="p-4 text-sm font-mono whitespace-pre-wrap break-all">
                {content}
              </pre>
            </ScrollArea>
          ) : (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              <p>Unable to preview this file</p>
            </div>
          )}
        </div>
        <DialogFooter>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>Size: {formatFileSize(file.size)}</span>
            <span>Modified: {formatDate(file.modified)}</span>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -----------------------------------------------------------------------------
 * Context Menu
 * -------------------------------------------------------------------------- */

interface ContextMenuState {
  file: FileEntry | null;
  x: number;
  y: number;
}

interface ContextMenuProps {
  state: ContextMenuState;
  onClose: () => void;
  onOpen: (file: FileEntry) => void;
  onPreview: (file: FileEntry) => void;
  onCopy: (file: FileEntry) => void;
  onCut: (file: FileEntry) => void;
  onDelete: (file: FileEntry) => void;
  onRename: (file: FileEntry) => void;
}

function ContextMenu({
  state,
  onClose,
  onOpen,
  onPreview,
  onCopy,
  onCut,
  onDelete,
  onRename,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!state.file) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [state.file, onClose]);

  if (!state.file) return null;

  return (
    <div
      ref={menuRef}
      className={cn(
        "fixed z-50 min-w-[180px] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md",
        "animate-in fade-in-0 zoom-in-95"
      )}
      style={{ left: state.x, top: state.y }}
    >
      <div
        className="flex items-center gap-2 px-2 py-1.5 text-sm cursor-pointer hover:bg-accent rounded-sm"
        onClick={() => {
          onOpen(state.file!);
          onClose();
        }}
      >
        <Folder className="h-4 w-4" />
        Open
      </div>
      <div
        className="flex items-center gap-2 px-2 py-1.5 text-sm cursor-pointer hover:bg-accent rounded-sm"
        onClick={() => {
          onPreview(state.file!);
          onClose();
        }}
      >
        <Eye className="h-4 w-4" />
        Quick Look
      </div>
      <div className="-mx-1 my-1 h-px bg-muted" />
      <div
        className="flex items-center gap-2 px-2 py-1.5 text-sm cursor-pointer hover:bg-accent rounded-sm"
        onClick={() => {
          onCopy(state.file!);
          onClose();
        }}
      >
        <Copy className="h-4 w-4" />
        Copy
      </div>
      <div
        className="flex items-center gap-2 px-2 py-1.5 text-sm cursor-pointer hover:bg-accent rounded-sm"
        onClick={() => {
          onCut(state.file!);
          onClose();
        }}
      >
        <Scissors className="h-4 w-4" />
        Cut
      </div>
      <div className="-mx-1 my-1 h-px bg-muted" />
      <div
        className="flex items-center gap-2 px-2 py-1.5 text-sm cursor-pointer hover:bg-accent rounded-sm"
        onClick={() => {
          onRename(state.file!);
          onClose();
        }}
      >
        <Pencil className="h-4 w-4" />
        Rename
      </div>
      <div
        className="flex items-center gap-2 px-2 py-1.5 text-sm cursor-pointer hover:bg-accent text-destructive rounded-sm"
        onClick={() => {
          onDelete(state.file!);
          onClose();
        }}
      >
        <Trash2 className="h-4 w-4" />
        Delete
      </div>
    </div>
  );
}

/* -----------------------------------------------------------------------------
 * Create Dialog
 * -------------------------------------------------------------------------- */

interface CreateDialogProps {
  open: boolean;
  type: "file" | "folder";
  onClose: () => void;
  onCreate: (name: string) => void;
}

function CreateDialog({ open, type, onClose, onCreate }: CreateDialogProps) {
  const [name, setName] = React.useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setName("");
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onCreate(name.trim());
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {type === "file" ? "Create New File" : "Create New Folder"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="py-4">
            <Input
              ref={inputRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={type === "file" ? "filename.txt" : "folder name"}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim()}>
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* -----------------------------------------------------------------------------
 * Rename Dialog
 * -------------------------------------------------------------------------- */

interface RenameDialogProps {
  file: FileEntry | null;
  onClose: () => void;
  onRename: (oldPath: string, newName: string) => void;
}

function RenameDialog({ file, onClose, onRename }: RenameDialogProps) {
  const [name, setName] = React.useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (file) {
      setName(file.name);
      setTimeout(() => {
        inputRef.current?.focus();
        // Select filename without extension for files
        if (!file.is_directory) {
          const lastDot = file.name.lastIndexOf(".");
          if (lastDot > 0) {
            inputRef.current?.setSelectionRange(0, lastDot);
          } else {
            inputRef.current?.select();
          }
        } else {
          inputRef.current?.select();
        }
      }, 100);
    }
  }, [file]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (file && name.trim() && name.trim() !== file.name) {
      onRename(file.path, name.trim());
      onClose();
    }
  };

  return (
    <Dialog open={!!file} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Rename</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="py-4">
            <Input
              ref={inputRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="New name"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || name.trim() === file?.name}>
              Rename
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* -----------------------------------------------------------------------------
 * Delete Confirmation Dialog
 * -------------------------------------------------------------------------- */

interface DeleteDialogProps {
  file: FileEntry | null;
  onClose: () => void;
  onConfirm: (path: string) => void;
}

function DeleteDialog({ file, onClose, onConfirm }: DeleteDialogProps) {
  if (!file) return null;

  return (
    <Dialog open={!!file} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete {file.is_directory ? "Folder" : "File"}</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete{" "}
            <span className="font-medium text-foreground">{file.name}</span>?
            {file.is_directory && " This will delete all contents inside."}
          </p>
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => {
              onConfirm(file.path);
              onClose();
            }}
          >
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -----------------------------------------------------------------------------
 * Empty State
 * -------------------------------------------------------------------------- */

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
      <Folder className="h-16 w-16 mb-4" />
      <p className="text-lg font-medium">This folder is empty</p>
      <p className="text-sm mt-1">Drop files here or create new ones</p>
    </div>
  );
}

/* -----------------------------------------------------------------------------
 * Loading State
 * -------------------------------------------------------------------------- */

function LoadingState() {
  return (
    <div className="flex items-center justify-center h-full">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}

/* -----------------------------------------------------------------------------
 * Error State
 * -------------------------------------------------------------------------- */

interface ErrorStateProps {
  error: string;
  onRetry: () => void;
}

function ErrorState({ error, onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
      <p className="text-destructive mb-2">Error loading directory</p>
      <p className="text-sm mb-4">{error}</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}

/* -----------------------------------------------------------------------------
 * Main FileBrowser Component
 * -------------------------------------------------------------------------- */

export const FileBrowser = forwardRef<FileBrowserRef, FileBrowserProps>(function FileBrowser(
  { workspacePath, initialPath, className, onPathChange, hideToolbar },
  ref
) {
  const browser = useFileBrowser({ workspacePath, initialPath });
  const columnViewRef = useRef<ColumnViewRef>(null);

  // Dialog states for file creation
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);
  const [createDialogType, setCreateDialogType] = React.useState<"file" | "folder">("file");

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    navigateToColumnIndex: (index: number) => {
      columnViewRef.current?.navigateToColumnIndex(index);
    },
    viewMode: browser.viewMode,
    setViewMode: browser.setViewMode,
    createFile: () => {
      setCreateDialogType("file");
      setCreateDialogOpen(true);
    },
    createFolder: () => {
      setCreateDialogType("folder");
      setCreateDialogOpen(true);
    },
  }), [browser.viewMode, browser.setViewMode]);

  // Notify parent of path changes (only for non-column views, column view handles this itself)
  useEffect(() => {
    if (onPathChange && browser.viewMode !== "column") {
      const segments = getPathSegments(browser.currentPath, workspacePath);
      onPathChange(browser.currentPath, segments);
    }
  }, [browser.currentPath, workspacePath, onPathChange, browser.viewMode]);

  // Dialog states (createDialogOpen and createDialogType are already defined above for ref)
  const [renameFile, setRenameFile] = React.useState<FileEntry | null>(null);
  const [deleteFile, setDeleteFile] = React.useState<FileEntry | null>(null);

  // Context menu state
  const [contextMenu, setContextMenu] = React.useState<ContextMenuState>({
    file: null,
    x: 0,
    y: 0,
  });

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const modKey = isMac ? e.metaKey : e.ctrlKey;

      // Cmd+N: New file
      if (modKey && !e.shiftKey && e.key === "n") {
        e.preventDefault();
        setCreateDialogType("file");
        setCreateDialogOpen(true);
        return;
      }

      // Cmd+Shift+N: New folder
      if (modKey && e.shiftKey && e.key === "N") {
        e.preventDefault();
        setCreateDialogType("folder");
        setCreateDialogOpen(true);
        return;
      }

      // Backspace: Go back
      if (e.key === "Backspace" && !e.target) {
        e.preventDefault();
        browser.goBack();
        return;
      }

      // Space: Toggle Quick Look preview
      if (e.key === " " && browser.selectedFile) {
        e.preventDefault();
        if (browser.previewFile) {
          browser.setPreviewFile(null);
        } else {
          browser.setPreviewFile(browser.selectedFile);
        }
        return;
      }

      // Delete: Delete selected file
      if ((e.key === "Delete" || (isMac && e.key === "Backspace" && modKey)) && browser.selectedFile) {
        e.preventDefault();
        setDeleteFile(browser.selectedFile);
        return;
      }

      // Cmd+C: Copy
      if (modKey && e.key === "c" && browser.selectedFile) {
        e.preventDefault();
        browser.copyToClipboard([browser.selectedFile]);
        return;
      }

      // Cmd+X: Cut
      if (modKey && e.key === "x" && browser.selectedFile) {
        e.preventDefault();
        browser.cutToClipboard([browser.selectedFile]);
        return;
      }

      // Cmd+V: Paste
      if (modKey && e.key === "v") {
        e.preventDefault();
        browser.paste();
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [browser]);

  // Handle file open (navigate to directory or preview file)
  const handleOpen = useCallback(
    (file: FileEntry) => {
      if (file.is_directory) {
        browser.navigateTo(file.path);
      } else {
        browser.setPreviewFile(file);
      }
    },
    [browser]
  );

  // Handle context menu
  const handleContextMenu = useCallback((file: FileEntry, e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ file, x: e.clientX, y: e.clientY });
  }, []);

  // Render content based on view mode
  const renderContent = () => {
    if (browser.loading) {
      return <LoadingState />;
    }

    if (browser.error) {
      return (
        <ErrorState
          error={browser.error}
          onRetry={() => browser.loadDirectory(browser.currentPath)}
        />
      );
    }

    if (browser.files.length === 0) {
      return <EmptyState />;
    }

    switch (browser.viewMode) {
      case "list":
        return (
          <ListView
            files={browser.files}
            selectedFiles={browser.selectedFiles}
            onSelect={browser.selectFile}
            onOpen={handleOpen}
            onContextMenu={handleContextMenu}
          />
        );
      case "icon":
        return (
          <IconView
            files={browser.files}
            selectedFiles={browser.selectedFiles}
            onSelect={browser.selectFile}
            onOpen={handleOpen}
            onContextMenu={handleContextMenu}
          />
        );
      case "column":
        return (
          <ColumnView
            ref={columnViewRef}
            workspacePath={workspacePath}
            onSelect={browser.selectFile}
            onOpen={handleOpen}
            onContextMenu={handleContextMenu}
            onPathChange={onPathChange}
          />
        );
      case "gallery":
        return (
          <GalleryView
            files={browser.files}
            selectedFiles={browser.selectedFiles}
            onSelect={browser.selectFile}
            onOpen={handleOpen}
            onContextMenu={handleContextMenu}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className={cn("flex flex-col h-full bg-background", className)}>
      {/* Toolbar - can be completely hidden when using external toolbar in header */}
      {!hideToolbar && (
        <Toolbar
          workspacePath={workspacePath}
          currentPath={browser.currentPath}
          viewMode={browser.viewMode}
          canGoBack={browser.canGoBack}
          canGoForward={browser.canGoForward}
          canGoUp={browser.canGoUp}
          onGoBack={browser.goBack}
          onGoForward={browser.goForward}
          onGoUp={browser.goUp}
          onNavigateTo={browser.navigateTo}
          onViewModeChange={browser.setViewMode}
          onNewFile={() => {
            setCreateDialogType("file");
            setCreateDialogOpen(true);
          }}
          onNewFolder={() => {
            setCreateDialogType("folder");
            setCreateDialogOpen(true);
          }}
        />
      )}

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <Sidebar workspacePath={workspacePath} onNavigateTo={browser.navigateTo} />

        {/* File content */}
        <div className="flex-1 overflow-hidden">
          {/* ColumnView handles its own scrolling, other views need ScrollArea */}
          {browser.viewMode === "column" ? (
            <div className="h-full">{renderContent()}</div>
          ) : (
            <ScrollArea className="h-full">{renderContent()}</ScrollArea>
          )}
        </div>
      </div>

      {/* Quick Look Preview */}
      <QuickLook
        file={browser.previewFile}
        onClose={() => browser.setPreviewFile(null)}
        readFileContent={browser.readFileContent}
      />

      {/* Context Menu */}
      <ContextMenu
        state={contextMenu}
        onClose={() => setContextMenu({ file: null, x: 0, y: 0 })}
        onOpen={handleOpen}
        onPreview={(file) => browser.setPreviewFile(file)}
        onCopy={(file) => browser.copyToClipboard([file])}
        onCut={(file) => browser.cutToClipboard([file])}
        onDelete={(file) => setDeleteFile(file)}
        onRename={(file) => setRenameFile(file)}
      />

      {/* Create Dialog */}
      <CreateDialog
        open={createDialogOpen}
        type={createDialogType}
        onClose={() => setCreateDialogOpen(false)}
        onCreate={(name) => {
          if (createDialogType === "file") {
            browser.createFile(name);
          } else {
            browser.createDirectory(name);
          }
        }}
      />

      {/* Rename Dialog */}
      <RenameDialog
        file={renameFile}
        onClose={() => setRenameFile(null)}
        onRename={browser.renameItem}
      />

      {/* Delete Dialog */}
      <DeleteDialog
        file={deleteFile}
        onClose={() => setDeleteFile(null)}
        onConfirm={browser.deleteItem}
      />
    </div>
  );
});

export default FileBrowser;
