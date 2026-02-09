import * as React from "react";
import {
  Folder,
  File,
  FileText,
  FileImage,
  FileCode,
  FileJson,
  FileVideo,
  FileAudio,
  FileArchive,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { FileEntry } from "@/types";

type SortField = "name" | "size" | "modified";
type SortDirection = "asc" | "desc";

interface FileListViewProps {
  files: FileEntry[];
  selectedFile: FileEntry | null;
  selectedFiles: Set<string>;
  onSelect: (file: FileEntry, multiSelect?: boolean) => void;
  onOpen: (file: FileEntry) => void;
  onContextMenu: (file: FileEntry, event: React.MouseEvent) => void;
  className?: string;
}

/**
 * Get the appropriate icon for a file based on its extension
 */
function getFileIcon(file: FileEntry): React.ReactNode {
  if (file.is_directory) {
    return <Folder className="h-4 w-4 text-amber-500 flex-shrink-0" />;
  }

  const ext = file.name.split(".").pop()?.toLowerCase();

  switch (ext) {
    // Documents
    case "md":
    case "txt":
    case "doc":
    case "docx":
    case "pdf":
    case "rtf":
      return <FileText className="h-4 w-4 text-blue-500 flex-shrink-0" />;

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
    case "rb":
    case "php":
    case "swift":
    case "kt":
    case "scala":
    case "sh":
    case "bash":
    case "zsh":
    case "css":
    case "scss":
    case "less":
    case "html":
    case "xml":
    case "vue":
    case "svelte":
      return <FileCode className="h-4 w-4 text-green-500 flex-shrink-0" />;

    // JSON and config
    case "json":
    case "yaml":
    case "yml":
    case "toml":
    case "ini":
    case "conf":
    case "config":
      return <FileJson className="h-4 w-4 text-yellow-500 flex-shrink-0" />;

    // Images
    case "png":
    case "jpg":
    case "jpeg":
    case "gif":
    case "svg":
    case "webp":
    case "ico":
    case "bmp":
    case "tiff":
      return <FileImage className="h-4 w-4 text-purple-500 flex-shrink-0" />;

    // Video
    case "mp4":
    case "mov":
    case "avi":
    case "mkv":
    case "webm":
    case "flv":
      return <FileVideo className="h-4 w-4 text-red-500 flex-shrink-0" />;

    // Audio
    case "mp3":
    case "wav":
    case "flac":
    case "ogg":
    case "aac":
    case "m4a":
      return <FileAudio className="h-4 w-4 text-pink-500 flex-shrink-0" />;

    // Archives
    case "zip":
    case "rar":
    case "7z":
    case "tar":
    case "gz":
    case "bz2":
    case "xz":
      return <FileArchive className="h-4 w-4 text-orange-500 flex-shrink-0" />;

    default:
      return <File className="h-4 w-4 text-muted-foreground flex-shrink-0" />;
  }
}

/**
 * Format file size to human-readable string
 */
function formatFileSize(bytes?: number): string {
  if (bytes === undefined || bytes === null) {
    return "--";
  }

  if (bytes === 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = bytes / Math.pow(1024, i);

  return `${size.toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

/**
 * Format date to human-readable string
 */
function formatDate(dateString?: string): string {
  if (!dateString) {
    return "--";
  }

  try {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "--";
  }
}

/**
 * Compare function for sorting files
 */
function compareFiles(
  a: FileEntry,
  b: FileEntry,
  field: SortField,
  direction: SortDirection
): number {
  // Directories always come first
  if (a.is_directory !== b.is_directory) {
    return a.is_directory ? -1 : 1;
  }

  let comparison = 0;

  switch (field) {
    case "name":
      comparison = a.name.localeCompare(b.name, undefined, {
        sensitivity: "base",
      });
      break;
    case "size":
      comparison = (a.size ?? 0) - (b.size ?? 0);
      break;
    case "modified":
      const aTime = a.modified ? new Date(a.modified).getTime() : 0;
      const bTime = b.modified ? new Date(b.modified).getTime() : 0;
      comparison = aTime - bTime;
      break;
  }

  return direction === "asc" ? comparison : -comparison;
}

/**
 * FileListView - Table/list view similar to macOS Finder list view
 *
 * Features:
 * - Table layout with columns: Name, Size, Date Modified
 * - Sortable columns (click header to sort)
 * - Folder icon for directories, file type icon for files
 * - Selected row highlighting
 * - Multi-select with Cmd+click
 * - Double-click to open folder or file
 * - Right-click for context menu
 */
export function FileListView({
  files,
  selectedFile,
  selectedFiles,
  onSelect,
  onOpen,
  onContextMenu,
  className,
}: FileListViewProps) {
  const [sortField, setSortField] = React.useState<SortField>("name");
  const [sortDirection, setSortDirection] =
    React.useState<SortDirection>("asc");

  // Sort files
  const sortedFiles = React.useMemo(() => {
    return [...files].sort((a, b) =>
      compareFiles(a, b, sortField, sortDirection)
    );
  }, [files, sortField, sortDirection]);

  // Handle column header click for sorting
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Toggle direction if same field
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      // New field, default to ascending
      setSortField(field);
      setSortDirection("asc");
    }
  };

  // Handle row click
  const handleRowClick = (
    file: FileEntry,
    event: React.MouseEvent<HTMLTableRowElement>
  ) => {
    const isMultiSelect = event.metaKey || event.ctrlKey;
    onSelect(file, isMultiSelect);
  };

  // Handle row double click
  const handleRowDoubleClick = (file: FileEntry) => {
    onOpen(file);
  };

  // Handle row context menu
  const handleRowContextMenu = (
    file: FileEntry,
    event: React.MouseEvent<HTMLTableRowElement>
  ) => {
    event.preventDefault();
    // Select the file if not already selected
    if (!selectedFiles.has(file.path)) {
      onSelect(file, false);
    }
    onContextMenu(file, event);
  };

  // Render sort indicator
  const renderSortIndicator = (field: SortField) => {
    if (sortField !== field) {
      return null;
    }

    return sortDirection === "asc" ? (
      <ArrowUp className="h-3 w-3 ml-1 inline-block" />
    ) : (
      <ArrowDown className="h-3 w-3 ml-1 inline-block" />
    );
  };

  return (
    <div className={cn("w-full", className)}>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead
              className="cursor-pointer select-none"
              onClick={() => handleSort("name")}
            >
              Name
              {renderSortIndicator("name")}
            </TableHead>
            <TableHead
              className="cursor-pointer select-none w-24 text-right"
              onClick={() => handleSort("size")}
            >
              Size
              {renderSortIndicator("size")}
            </TableHead>
            <TableHead
              className="cursor-pointer select-none w-48"
              onClick={() => handleSort("modified")}
            >
              Date Modified
              {renderSortIndicator("modified")}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedFiles.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={3}
                className="h-24 text-center text-muted-foreground"
              >
                No files
              </TableCell>
            </TableRow>
          ) : (
            sortedFiles.map((file) => {
              const isSelected = selectedFiles.has(file.path);
              const isPrimarySelected = selectedFile?.path === file.path;

              return (
                <TableRow
                  key={file.path}
                  data-state={isSelected ? "selected" : undefined}
                  className={cn(
                    "cursor-default select-none",
                    isSelected && "bg-accent",
                    isPrimarySelected && "bg-accent ring-1 ring-primary/20"
                  )}
                  onClick={(e) => handleRowClick(file, e)}
                  onDoubleClick={() => handleRowDoubleClick(file)}
                  onContextMenu={(e) => handleRowContextMenu(file, e)}
                >
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getFileIcon(file)}
                      <span className="truncate">{file.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {file.is_directory ? "--" : formatFileSize(file.size)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(file.modified)}
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}

export default FileListView;
