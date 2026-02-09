import * as React from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  List,
  LayoutGrid,
  Columns,
  GalleryHorizontal,
  FilePlus,
  FolderPlus,
  Folder,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import type { ViewMode } from "@/hooks/use-file-browser";

interface FileToolbarProps {
  /** Current view mode */
  viewMode: ViewMode;
  /** Callback when view mode changes */
  onViewModeChange: (mode: ViewMode) => void;
  /** Whether back navigation is available */
  canGoBack: boolean;
  /** Whether forward navigation is available */
  canGoForward: boolean;
  /** Whether up (parent directory) navigation is available */
  canGoUp: boolean;
  /** Callback for back navigation */
  onGoBack: () => void;
  /** Callback for forward navigation */
  onGoForward: () => void;
  /** Callback for up (parent directory) navigation */
  onGoUp: () => void;
  /** Callback for creating a new file */
  onNewFile: () => void;
  /** Callback for creating a new folder */
  onNewFolder: () => void;
  /** Current directory path */
  currentPath: string;
  /** Additional class names */
  className?: string;
}

/**
 * View mode button configuration
 */
const VIEW_MODE_BUTTONS: Array<{
  mode: ViewMode;
  icon: React.ElementType;
  label: string;
}> = [
  { mode: "list", icon: List, label: "List" },
  { mode: "icon", icon: LayoutGrid, label: "Icon" },
  { mode: "column", icon: Columns, label: "Column" },
  { mode: "gallery", icon: GalleryHorizontal, label: "Gallery" },
];

/**
 * Parse path into breadcrumb segments
 */
function parsePathToBreadcrumbs(path: string): Array<{ name: string; path: string }> {
  if (!path || path === "/") {
    return [{ name: "/", path: "/" }];
  }

  const parts = path.split("/").filter(Boolean);
  const segments: Array<{ name: string; path: string }> = [];

  let currentPath = "";
  for (const part of parts) {
    currentPath += "/" + part;
    segments.push({ name: part, path: currentPath });
  }

  return segments;
}

/**
 * FileToolbar - A macOS Finder-style toolbar for file browsing
 *
 * Features:
 * - Navigation buttons: Back, Forward, Up (parent directory)
 * - View mode toggle buttons: List, Icon, Column, Gallery
 * - Action buttons: New File, New Folder
 * - Current path display (breadcrumb style)
 */
export function FileToolbar({
  viewMode,
  onViewModeChange,
  canGoBack,
  canGoForward,
  canGoUp,
  onGoBack,
  onGoForward,
  onGoUp,
  onNewFile,
  onNewFolder,
  currentPath,
  className,
}: FileToolbarProps) {
  const breadcrumbs = React.useMemo(
    () => parsePathToBreadcrumbs(currentPath),
    [currentPath]
  );

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-2",
        "border-b border-border/50 bg-muted/30",
        className
      )}
    >
      {/* Navigation Group */}
      <div className="flex items-center gap-0.5">
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={onGoBack}
                disabled={!canGoBack}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Back</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={onGoForward}
                disabled={!canGoForward}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Forward</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={onGoUp}
                disabled={!canGoUp}
              >
                <ChevronUp className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Go to Parent</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <Separator orientation="vertical" className="h-5" />

      {/* View Mode Toggle Group */}
      <div className="flex items-center gap-0.5 rounded-md bg-muted/50 p-0.5">
        {VIEW_MODE_BUTTONS.map(({ mode, icon: Icon, label }) => (
          <TooltipProvider key={mode} delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={viewMode === mode ? "secondary" : "ghost"}
                  size="icon"
                  className={cn(
                    "h-7 w-7",
                    viewMode === mode && "bg-background shadow-sm"
                  )}
                  onClick={() => onViewModeChange(mode)}
                >
                  <Icon className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{label} View</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ))}
      </div>

      <Separator orientation="vertical" className="h-5" />

      {/* Action Group */}
      <div className="flex items-center gap-0.5">
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={onNewFile}
              >
                <FilePlus className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>New File</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={onNewFolder}
              >
                <FolderPlus className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>New Folder</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <Separator orientation="vertical" className="h-5" />

      {/* Breadcrumb Path Display */}
      <div className="flex-1 min-w-0">
        <nav className="flex items-center gap-1 overflow-hidden">
          {breadcrumbs.map((segment, index) => (
            <React.Fragment key={segment.path}>
              {index > 0 && (
                <ChevronRight className="h-3 w-3 flex-shrink-0 text-muted-foreground/50" />
              )}
              <span
                className={cn(
                  "flex items-center gap-1.5 px-1.5 py-0.5 rounded text-sm",
                  "truncate max-w-[120px]",
                  index === breadcrumbs.length - 1
                    ? "text-foreground font-medium"
                    : "text-muted-foreground"
                )}
                title={segment.name}
              >
                {index === 0 && (
                  <Folder className="h-3.5 w-3.5 flex-shrink-0 text-amber-500" />
                )}
                <span className="truncate">{segment.name}</span>
              </span>
            </React.Fragment>
          ))}
        </nav>
      </div>
    </div>
  );
}

FileToolbar.displayName = "FileToolbar";

export default FileToolbar;
