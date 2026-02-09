/**
 * File Browser Action Components
 *
 * Reusable toolbar components for file browser actions.
 * Can be placed in WorkspaceHeader's rightContent.
 */

import * as React from "react";
import {
  List,
  LayoutGrid,
  Columns3,
  Image,
  FilePlus,
  FolderPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { ViewMode } from "@/hooks/use-file-browser";

/* -----------------------------------------------------------------------------
 * View Mode Toggle
 * -------------------------------------------------------------------------- */

export interface ViewModeToggleProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  className?: string;
}

export function ViewModeToggle({ viewMode, onViewModeChange, className }: ViewModeToggleProps) {
  const modes: { mode: ViewMode; icon: React.ReactNode; label: string }[] = [
    { mode: "list", icon: <List className="h-4 w-4" />, label: "List" },
    { mode: "icon", icon: <LayoutGrid className="h-4 w-4" />, label: "Icon" },
    { mode: "column", icon: <Columns3 className="h-4 w-4" />, label: "Column" },
    { mode: "gallery", icon: <Image className="h-4 w-4" />, label: "Gallery" },
  ];

  return (
    <TooltipProvider>
      <div className={cn("flex items-center gap-0.5 bg-muted rounded-lg p-0.5", className)}>
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
 * File Action Buttons
 * -------------------------------------------------------------------------- */

export interface FileActionButtonsProps {
  onNewFile: () => void;
  onNewFolder: () => void;
  className?: string;
}

export function FileActionButtons({ onNewFile, onNewFolder, className }: FileActionButtonsProps) {
  return (
    <TooltipProvider>
      <div className={cn("flex items-center gap-1", className)}>
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
  );
}

/* -----------------------------------------------------------------------------
 * Combined File Browser Toolbar
 * -------------------------------------------------------------------------- */

export interface FileBrowserToolbarProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onNewFile: () => void;
  onNewFolder: () => void;
  className?: string;
}

export function FileBrowserToolbar({
  viewMode,
  onViewModeChange,
  onNewFile,
  onNewFolder,
  className,
}: FileBrowserToolbarProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <ViewModeToggle viewMode={viewMode} onViewModeChange={onViewModeChange} />
      <Separator orientation="vertical" className="h-6" />
      <FileActionButtons onNewFile={onNewFile} onNewFolder={onNewFolder} />
    </div>
  );
}
