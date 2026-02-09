import * as React from "react";
import {
  File,
  FileCode,
  FileImage,
  FileJson,
  FileText,
  FileArchive,
  FileAudio,
  FileVideo,
  FileSpreadsheet,
  Folder,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { FileEntry } from "@/types";

interface FileIconViewProps {
  files: FileEntry[];
  selectedFile: FileEntry | null;
  selectedFiles: Set<string>;
  onSelect: (file: FileEntry, multiSelect?: boolean) => void;
  onOpen: (file: FileEntry) => void;
  className?: string;
}

/**
 * Get file icon based on file extension
 */
function getFileIcon(file: FileEntry): React.ReactNode {
  if (file.is_directory) {
    return <Folder className="h-12 w-12 text-amber-500" />;
  }

  const ext = file.name.split(".").pop()?.toLowerCase();

  switch (ext) {
    // Code files
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
    case "hpp":
    case "cs":
    case "rb":
    case "php":
    case "swift":
    case "kt":
    case "scala":
    case "vue":
    case "svelte":
      return <FileCode className="h-12 w-12 text-blue-500" />;

    // JSON/Config files
    case "json":
    case "yaml":
    case "yml":
    case "toml":
    case "xml":
    case "ini":
    case "conf":
    case "config":
      return <FileJson className="h-12 w-12 text-yellow-500" />;

    // Text/Document files
    case "md":
    case "txt":
    case "rtf":
    case "doc":
    case "docx":
    case "pdf":
      return <FileText className="h-12 w-12 text-gray-500" />;

    // Image files
    case "png":
    case "jpg":
    case "jpeg":
    case "gif":
    case "svg":
    case "webp":
    case "ico":
    case "bmp":
    case "tiff":
      return <FileImage className="h-12 w-12 text-green-500" />;

    // Audio files
    case "mp3":
    case "wav":
    case "ogg":
    case "flac":
    case "aac":
    case "m4a":
      return <FileAudio className="h-12 w-12 text-purple-500" />;

    // Video files
    case "mp4":
    case "mov":
    case "avi":
    case "mkv":
    case "webm":
    case "wmv":
      return <FileVideo className="h-12 w-12 text-pink-500" />;

    // Archive files
    case "zip":
    case "tar":
    case "gz":
    case "rar":
    case "7z":
    case "bz2":
      return <FileArchive className="h-12 w-12 text-orange-500" />;

    // Spreadsheet files
    case "csv":
    case "xls":
    case "xlsx":
      return <FileSpreadsheet className="h-12 w-12 text-emerald-500" />;

    // Default file icon
    default:
      return <File className="h-12 w-12 text-muted-foreground" />;
  }
}

/**
 * FileIconView - A grid/icon view for file browsing (like macOS Finder icon view)
 *
 * Features:
 * - Responsive CSS grid layout with auto-fill columns
 * - Large icons (48x48 or 64x64)
 * - File name displayed below icon with ellipsis truncation
 * - Single click to select, Cmd+click for multi-select
 * - Double click to open
 */
export function FileIconView({
  files,
  selectedFile: _selectedFile,
  selectedFiles,
  onSelect,
  onOpen,
  className,
}: FileIconViewProps) {
  // Note: selectedFile is kept for API compatibility but we use selectedFiles Set for selection state
  void _selectedFile;
  // Handle click with platform-specific multi-select detection
  const handleClick = React.useCallback(
    (file: FileEntry, event: React.MouseEvent) => {
      const multiSelect = event.metaKey || event.ctrlKey;
      onSelect(file, multiSelect);
    },
    [onSelect]
  );

  // Handle double-click to open
  const handleDoubleClick = React.useCallback(
    (file: FileEntry) => {
      onOpen(file);
    },
    [onOpen]
  );

  // Handle keyboard navigation
  const handleKeyDown = React.useCallback(
    (file: FileEntry, event: React.KeyboardEvent) => {
      if (event.key === "Enter") {
        onOpen(file);
      }
    },
    [onOpen]
  );

  return (
    <div
      className={cn(
        // Grid layout with responsive auto-fill columns
        "grid gap-4 p-4",
        "grid-cols-[repeat(auto-fill,minmax(100px,1fr))]",
        className
      )}
    >
      {files.map((file) => {
        const isSelected = selectedFiles.has(file.path);

        return (
          <button
            key={file.path}
            type="button"
            onClick={(e) => handleClick(file, e)}
            onDoubleClick={() => handleDoubleClick(file)}
            onKeyDown={(e) => handleKeyDown(file, e)}
            className={cn(
              // Layout
              "flex flex-col items-center gap-2 p-3",
              // Shape and border
              "rounded-lg border-2 border-transparent",
              // Hover and focus states
              "hover:bg-accent/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              // Transition
              "transition-colors duration-150",
              // Selected state
              isSelected && [
                "bg-accent border-primary/50",
                "ring-2 ring-primary/30",
              ]
            )}
            aria-selected={isSelected}
            title={file.name}
          >
            {/* File Icon */}
            <div className="flex items-center justify-center flex-shrink-0">
              {getFileIcon(file)}
            </div>

            {/* File Name */}
            <span
              className={cn(
                "w-full text-center text-xs leading-tight",
                // Truncate long names with ellipsis (2 lines max)
                "line-clamp-2 break-all",
                // Text color
                isSelected ? "text-accent-foreground" : "text-foreground"
              )}
            >
              {file.name}
            </span>
          </button>
        );
      })}
    </div>
  );
}

FileIconView.displayName = "FileIconView";

export default FileIconView;
