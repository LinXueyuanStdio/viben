/**
 * File Column View Component
 *
 * Miller Columns view like macOS Finder column view.
 * Displays multiple columns side by side, each showing a directory.
 * Selecting a folder adds a new column to the right showing its contents.
 */

import * as React from "react";
import {
  ChevronRight,
  File,
  Folder,
  FileText,
  FileCode,
  FileImage,
  FileAudio,
  FileVideo,
  FileArchive,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTranslation } from "react-i18next";
import type { FileEntry } from "@/types";

/**
 * Column width constant
 */
const COLUMN_WIDTH = 200;

/**
 * Props for FileColumnView
 */
export interface FileColumnViewProps {
  /** Workspace root path for relative path display */
  workspacePath: string;
  /** Array of directory paths representing the column trail */
  columnPaths: string[];
  /** Files in the currently visible rightmost directory */
  files: FileEntry[];
  /** Currently selected file (for preview) */
  selectedFile: FileEntry | null;
  /** Called when a file or folder is selected (single click) */
  onSelect: (file: FileEntry) => void;
  /** Called when a file or folder is opened (double click) */
  onOpen: (file: FileEntry) => void;
  /** Called to update the column paths when navigation changes */
  onUpdateColumns: (paths: string[]) => void;
  /** Function to load directory contents */
  loadDirectory: (path: string) => Promise<FileEntry[]>;
}

/**
 * State for each column
 */
interface ColumnState {
  path: string;
  files: FileEntry[];
  loading: boolean;
  error: string | null;
  selectedPath: string | null;
}

/**
 * Get file icon based on extension
 */
function getFileIcon(name: string, isDirectory: boolean) {
  if (isDirectory) {
    return <Folder className="h-4 w-4 text-amber-500 flex-shrink-0" />;
  }

  const ext = name.split(".").pop()?.toLowerCase();

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
    case "rb":
    case "php":
    case "swift":
    case "kt":
      return <FileCode className="h-4 w-4 text-blue-500 flex-shrink-0" />;

    // Text/doc files
    case "md":
    case "txt":
    case "json":
    case "yaml":
    case "yml":
    case "toml":
    case "xml":
    case "html":
    case "css":
    case "scss":
    case "sass":
      return <FileText className="h-4 w-4 text-slate-500 flex-shrink-0" />;

    // Image files
    case "png":
    case "jpg":
    case "jpeg":
    case "gif":
    case "svg":
    case "webp":
    case "ico":
    case "bmp":
      return <FileImage className="h-4 w-4 text-emerald-500 flex-shrink-0" />;

    // Audio files
    case "mp3":
    case "wav":
    case "ogg":
    case "flac":
    case "aac":
    case "m4a":
      return <FileAudio className="h-4 w-4 text-purple-500 flex-shrink-0" />;

    // Video files
    case "mp4":
    case "webm":
    case "mov":
    case "avi":
    case "mkv":
      return <FileVideo className="h-4 w-4 text-pink-500 flex-shrink-0" />;

    // Archive files
    case "zip":
    case "tar":
    case "gz":
    case "rar":
    case "7z":
      return <FileArchive className="h-4 w-4 text-orange-500 flex-shrink-0" />;

    default:
      return <File className="h-4 w-4 text-muted-foreground flex-shrink-0" />;
  }
}

/**
 * Format file size for display
 */
function formatFileSize(bytes: number | undefined): string {
  if (bytes === undefined || bytes === 0) return "";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

/**
 * Get the last path segment (directory/file name)
 */
function getPathName(path: string): string {
  const segments = path.split(/[/\\]/);
  return segments[segments.length - 1] || path;
}

/**
 * Single Column Component
 */
interface ColumnProps {
  state: ColumnState;
  onSelectItem: (file: FileEntry) => void;
  onDoubleClickItem: (file: FileEntry) => void;
}

function Column({ state, onSelectItem, onDoubleClickItem }: ColumnProps) {
  const { t } = useTranslation();
  const columnRef = React.useRef<HTMLDivElement>(null);
  const [focusedIndex, setFocusedIndex] = React.useState(-1);

  // Handle keyboard navigation within column
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (state.files.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setFocusedIndex((prev) =>
          prev < state.files.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setFocusedIndex((prev) => (prev > 0 ? prev - 1 : prev));
        break;
      case "Enter":
        e.preventDefault();
        if (focusedIndex >= 0 && focusedIndex < state.files.length) {
          const file = state.files[focusedIndex];
          if (file.is_directory) {
            onSelectItem(file);
          } else {
            onDoubleClickItem(file);
          }
        }
        break;
    }
  };

  // Update selection when focused index changes
  React.useEffect(() => {
    if (focusedIndex >= 0 && focusedIndex < state.files.length) {
      onSelectItem(state.files[focusedIndex]);
    }
  }, [focusedIndex]);

  return (
    <div
      ref={columnRef}
      className={cn(
        "flex flex-col border-r border-border/50 flex-shrink-0",
        "focus:outline-none"
      )}
      style={{ width: COLUMN_WIDTH }}
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      {/* Column header - directory name */}
      <div className="px-3 py-2 border-b border-border/30 bg-muted/30">
        <span className="text-xs font-medium text-muted-foreground truncate block">
          {getPathName(state.path)}
        </span>
      </div>

      {/* Column content */}
      <ScrollArea className="flex-1">
        <div className="py-1">
          {state.loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : state.error ? (
            <div className="px-3 py-4 text-center">
              <p className="text-xs text-destructive">{state.error}</p>
            </div>
          ) : state.files.length === 0 ? (
            <div className="px-3 py-4 text-center">
              <p className="text-xs text-muted-foreground">{t("fileBrowser.emptyFolder")}</p>
            </div>
          ) : (
            state.files.map((file, index) => {
              const isSelected = state.selectedPath === file.path;
              const isFocused = focusedIndex === index;

              return (
                <button
                  key={file.path}
                  onClick={() => {
                    setFocusedIndex(index);
                    onSelectItem(file);
                  }}
                  onDoubleClick={() => onDoubleClickItem(file)}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-1.5 text-left",
                    "transition-colors cursor-pointer",
                    "focus:outline-none",
                    isSelected
                      ? "bg-primary text-primary-foreground"
                      : isFocused
                        ? "bg-accent"
                        : "hover:bg-accent/50"
                  )}
                >
                  {getFileIcon(file.name, file.is_directory)}
                  <span className="flex-1 truncate text-sm">{file.name}</span>
                  {file.is_directory && (
                    <ChevronRight
                      className={cn(
                        "h-4 w-4 flex-shrink-0",
                        isSelected ? "text-primary-foreground/70" : "text-muted-foreground"
                      )}
                    />
                  )}
                </button>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

/**
 * File Preview Panel
 */
interface PreviewPanelProps {
  file: FileEntry | null;
  workspacePath: string;
}

function PreviewPanel({ file, workspacePath }: PreviewPanelProps) {
  const { t } = useTranslation();
  const getFileTypeDescription = useFileTypeDescription();

  if (!file) {
    return (
      <div className="flex-1 flex items-center justify-center bg-muted/20">
        <p className="text-sm text-muted-foreground">{t("fileBrowser.selectToPreview")}</p>
      </div>
    );
  }

  // Calculate relative path
  const relativePath = file.path.startsWith(workspacePath)
    ? file.path.slice(workspacePath.length + 1)
    : file.path;

  return (
    <div className="flex-1 flex flex-col bg-muted/20 min-w-[200px]">
      {/* Preview header */}
      <div className="px-4 py-3 border-b border-border/30">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-lg bg-muted">
            {getFileIcon(file.name, file.is_directory)}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-sm truncate">{file.name}</h3>
            <p className="text-xs text-muted-foreground truncate">{relativePath}</p>
          </div>
        </div>
      </div>

      {/* Preview content */}
      <div className="flex-1 p-4 overflow-auto">
        <div className="space-y-4">
          {/* File info */}
          <div className="space-y-2">
            <InfoRow label={t("fileBrowser.type")} value={file.is_directory ? t("fileBrowser.folder") : t("fileBrowser.file")} />
            {!file.is_directory && file.size !== undefined && (
              <InfoRow label={t("fileBrowser.size")} value={formatFileSize(file.size)} />
            )}
            {file.modified && (
              <InfoRow
                label={t("fileBrowser.modified")}
                value={new Date(file.modified).toLocaleString()}
              />
            )}
            {file.created && (
              <InfoRow
                label={t("fileBrowser.created")}
                value={new Date(file.created).toLocaleString()}
              />
            )}
          </div>

          {/* Extension info for files */}
          {!file.is_directory && (
            <div className="pt-2 border-t border-border/30">
              <p className="text-xs text-muted-foreground">
                {getFileTypeDescription(file.name)}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Info row component for preview panel
 */
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono text-xs">{value}</span>
    </div>
  );
}

/**
 * Get file type description based on extension
 * Uses i18n translation keys from fileBrowser.fileTypes namespace
 */
function useFileTypeDescription() {
  const { t } = useTranslation();

  return React.useCallback((name: string): string => {
    const ext = name.split(".").pop()?.toLowerCase();
    if (!ext) return t("fileBrowser.unknownFileType");

    // Check if we have a translation for this extension
    const translationKey = `fileBrowser.fileTypes.${ext}`;
    const translation = t(translationKey, { defaultValue: "" });

    if (translation && translation !== translationKey) {
      return translation;
    }

    return `${ext.toUpperCase()} ${t("fileBrowser.file").toLowerCase()}`;
  }, [t]);
}

/**
 * FileColumnView Component
 *
 * Miller Columns navigation for file browsing.
 */
export function FileColumnView({
  workspacePath,
  columnPaths,
  files,
  selectedFile,
  onSelect,
  onOpen,
  onUpdateColumns,
  loadDirectory,
}: FileColumnViewProps) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [columns, setColumns] = React.useState<ColumnState[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);

  // Initialize columns from columnPaths
  React.useEffect(() => {
    const initializeColumns = async () => {
      if (columnPaths.length === 0) return;

      setIsLoading(true);
      const newColumns: ColumnState[] = [];

      for (let i = 0; i < columnPaths.length; i++) {
        const path = columnPaths[i];
        const column: ColumnState = {
          path,
          files: [],
          loading: false,
          error: null,
          selectedPath: columnPaths[i + 1] || null,
        };

        try {
          const entries = await loadDirectory(path);
          column.files = entries;
        } catch (err) {
          column.error = String(err);
        }

        newColumns.push(column);
      }

      // Set selected path for the last column if there's a selected file
      if (selectedFile && newColumns.length > 0) {
        const lastColumn = newColumns[newColumns.length - 1];
        lastColumn.selectedPath = selectedFile.path;
      }

      setColumns(newColumns);
      setIsLoading(false);
    };

    initializeColumns();
  }, [columnPaths.join(",")]);

  // Update last column's files when files prop changes
  React.useEffect(() => {
    if (columns.length > 0 && files.length > 0) {
      setColumns((prev) => {
        const updated = [...prev];
        if (updated.length > 0) {
          updated[updated.length - 1] = {
            ...updated[updated.length - 1],
            files,
            selectedPath: selectedFile?.path || null,
          };
        }
        return updated;
      });
    }
  }, [files, selectedFile]);

  // Scroll to the rightmost column when columns change
  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    }
  }, [columns.length]);

  // Handle item selection in a column
  const handleSelectItem = async (columnIndex: number, file: FileEntry) => {
    // Update selected state for the clicked column
    setColumns((prev) => {
      const updated = [...prev];
      updated[columnIndex] = {
        ...updated[columnIndex],
        selectedPath: file.path,
      };
      return updated;
    });

    if (file.is_directory) {
      // For directories: load contents and update columns
      const newColumnPaths = [...columnPaths.slice(0, columnIndex + 1), file.path];
      onUpdateColumns(newColumnPaths);

      // Load the directory contents for the new column
      try {
        const entries = await loadDirectory(file.path);

        setColumns((prev) => {
          // Remove columns after the current one and add the new column
          const updated = prev.slice(0, columnIndex + 1);
          updated[columnIndex] = {
            ...updated[columnIndex],
            selectedPath: file.path,
          };
          updated.push({
            path: file.path,
            files: entries,
            loading: false,
            error: null,
            selectedPath: null,
          });
          return updated;
        });
      } catch (err) {
        console.error("Failed to load directory:", err);
      }
    } else {
      // For files: select it and remove columns to the right
      onSelect(file);

      // Remove any columns after the current one
      setColumns((prev) => {
        const updated = prev.slice(0, columnIndex + 1);
        updated[columnIndex] = {
          ...updated[columnIndex],
          selectedPath: file.path,
        };
        return updated;
      });
    }
  };

  // Handle double click
  const handleDoubleClick = (file: FileEntry) => {
    onOpen(file);
  };

  // Handle keyboard navigation between columns
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") {
      // Focus previous column
      e.preventDefault();
    } else if (e.key === "ArrowRight") {
      // Focus next column or enter selected directory
      e.preventDefault();
    }
  };

  if (isLoading && columns.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div
      className="flex h-full bg-background"
      onKeyDown={handleKeyDown}
    >
      {/* Columns container with horizontal scroll */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <div
          ref={scrollRef}
          className="flex h-full"
          style={{ minWidth: "fit-content" }}
        >
          {columns.map((column, index) => (
            <Column
              key={column.path}
              state={column}
              onSelectItem={(file) => handleSelectItem(index, file)}
              onDoubleClickItem={handleDoubleClick}
            />
          ))}

          {/* Preview panel for selected file */}
          {selectedFile && !selectedFile.is_directory && (
            <PreviewPanel file={selectedFile} workspacePath={workspacePath} />
          )}
        </div>
      </div>
    </div>
  );
}

export default FileColumnView;
