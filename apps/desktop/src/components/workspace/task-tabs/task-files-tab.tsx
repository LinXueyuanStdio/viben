"use client";

import * as React from "react";
import {
  cn,
  ScrollArea,
  Button,
  Skeleton,
  Badge,
} from "@viben/ui";
import {
  File,
  Folder,
  FileText,
  FileCode,
  FileJson,
  ChevronRight,
  ExternalLink,
  Copy,
  Check,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import ReactMarkdown from "react-markdown";

/**
 * Task file with metadata
 */
export interface TaskFile {
  path: string;
  name: string;
  type: "file" | "directory";
  extension?: string;
  size?: number;
  modifiedAt?: string;
  content?: string;
}

export interface TaskFilesTabProps {
  taskId: string;
  files?: TaskFile[];
  isLoading?: boolean;
  error?: string | null;
  className?: string;
  onRefresh?: () => void;
  onOpenInIDE?: (path: string) => void;
  onLoadFileContent?: (path: string) => Promise<string>;
}

/**
 * Get icon for file based on extension
 */
function getFileIcon(file: TaskFile) {
  if (file.type === "directory") {
    return <Folder className="h-4 w-4 text-blue-500" />;
  }

  switch (file.extension?.toLowerCase()) {
    case "md":
    case "mdx":
      return <FileText className="h-4 w-4 text-blue-400" />;
    case "json":
      return <FileJson className="h-4 w-4 text-yellow-500" />;
    case "ts":
    case "tsx":
    case "js":
    case "jsx":
    case "py":
    case "go":
    case "rs":
      return <FileCode className="h-4 w-4 text-green-500" />;
    default:
      return <File className="h-4 w-4 text-muted-foreground" />;
  }
}

/**
 * Format file size for display
 */
function formatFileSize(bytes?: number): string {
  if (bytes === undefined) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * FileListItem - Single file in the list
 */
function FileListItem({
  file,
  isSelected,
  onClick,
}: {
  file: TaskFile;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-2 cursor-pointer rounded-md",
        "hover:bg-muted/50 transition-colors",
        isSelected && "bg-muted"
      )}
      onClick={onClick}
    >
      {getFileIcon(file)}
      <span className={cn("flex-1 truncate text-sm", isSelected && "font-medium")}>
        {file.name}
      </span>
      {file.size !== undefined && (
        <span className="text-xs text-muted-foreground shrink-0">
          {formatFileSize(file.size)}
        </span>
      )}
      <ChevronRight
        className={cn(
          "h-4 w-4 text-muted-foreground/50 shrink-0 transition-opacity",
          isSelected ? "opacity-100" : "opacity-0"
        )}
      />
    </div>
  );
}

/**
 * FileContentPreview - Preview panel for selected file
 */
function FileContentPreview({
  file,
  content,
  isLoading,
  onOpenInIDE,
  onCopyPath,
}: {
  file: TaskFile;
  content?: string;
  isLoading?: boolean;
  onOpenInIDE?: (path: string) => void;
  onCopyPath: (path: string) => void;
}) {
  const { t } = useTranslation();
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    onCopyPath(file.path);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isMarkdown = file.extension?.toLowerCase() === "md" || file.extension?.toLowerCase() === "mdx";
  const isJson = file.extension?.toLowerCase() === "json";

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          {getFileIcon(file)}
          <span className="font-medium truncate">{file.name}</span>
          {file.extension && (
            <Badge variant="secondary" className="text-xs shrink-0">
              .{file.extension}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleCopy}
            title={t("common.copyPath", "Copy path")}
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-green-500" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </Button>
          {onOpenInIDE && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => onOpenInIDE(file.path)}
              title={t("workspace.filesTab.openInIDE", "Open in IDE")}
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Path */}
      <div className="px-4 py-1.5 bg-muted/30 border-b">
        <span className="text-xs text-muted-foreground font-mono truncate block">
          {file.path}
        </span>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="p-4 space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ) : content ? (
          <div className="p-4">
            {isMarkdown ? (
              <article className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown>{content}</ReactMarkdown>
              </article>
            ) : isJson ? (
              <pre className="text-sm font-mono overflow-x-auto whitespace-pre-wrap">
                {(() => {
                  try {
                    return JSON.stringify(JSON.parse(content), null, 2);
                  } catch {
                    return content;
                  }
                })()}
              </pre>
            ) : (
              <pre className="text-sm font-mono overflow-x-auto whitespace-pre-wrap">
                {content}
              </pre>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <p className="text-sm">{t("workspace.filesTab.noContent", "No content available")}</p>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

/**
 * TaskFilesTab - Displays files associated with a task
 *
 * Features:
 * - Left panel with file list
 * - Right panel with content preview
 * - Support for .md and .json rendering
 * - Keyboard navigation (up/down arrows)
 * - Open in IDE button
 * - Copy path functionality
 */
export function TaskFilesTab({
  taskId,
  files = [],
  isLoading = false,
  error,
  className,
  onRefresh,
  onOpenInIDE,
  onLoadFileContent,
}: TaskFilesTabProps) {
  const { t } = useTranslation();
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const [fileContent, setFileContent] = React.useState<string | undefined>();
  const [isLoadingContent, setIsLoadingContent] = React.useState(false);

  // Filter to only show files (not directories) for now
  const displayFiles = files.filter((f) => f.type === "file");
  const selectedFile = displayFiles[selectedIndex];

  // Load file content when selection changes
  React.useEffect(() => {
    if (!selectedFile || !onLoadFileContent) {
      setFileContent(selectedFile?.content);
      return;
    }

    // If content is already available, use it
    if (selectedFile.content) {
      setFileContent(selectedFile.content);
      return;
    }

    // Otherwise, load content
    setIsLoadingContent(true);
    onLoadFileContent(selectedFile.path)
      .then((content) => {
        setFileContent(content);
      })
      .catch((err) => {
        console.error("Failed to load file content:", err);
        setFileContent(undefined);
      })
      .finally(() => {
        setIsLoadingContent(false);
      });
  }, [selectedFile, onLoadFileContent]);

  // Keyboard navigation
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (displayFiles.length === 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, displayFiles.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [displayFiles.length]);

  // Reset selection when files change
  React.useEffect(() => {
    setSelectedIndex(0);
  }, [taskId]);

  const handleCopyPath = (path: string) => {
    navigator.clipboard.writeText(path);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className={cn("flex h-full", className)}>
        <div className="w-64 border-r p-2 space-y-1">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </div>
        <div className="flex-1 p-4 space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={cn("flex flex-col items-center justify-center h-full py-12", className)}>
        <File className="h-12 w-12 text-destructive/30 mb-4" />
        <h3 className="text-lg font-medium text-destructive mb-2">
          {t("workspace.filesTab.loadError", "Failed to load files")}
        </h3>
        <p className="text-sm text-muted-foreground/60 text-center max-w-xs mb-4">
          {error}
        </p>
        {onRefresh && (
          <Button variant="outline" size="sm" onClick={onRefresh}>
            {t("common.retry", "Retry")}
          </Button>
        )}
      </div>
    );
  }

  // Empty state
  if (displayFiles.length === 0) {
    return (
      <div className={cn("flex flex-col items-center justify-center h-full py-12", className)}>
        <Folder className="h-12 w-12 text-muted-foreground/30 mb-4" />
        <h3 className="text-lg font-medium text-muted-foreground mb-2">
          {t("workspace.filesTab.noFiles", "No files found")}
        </h3>
        <p className="text-sm text-muted-foreground/60 text-center max-w-xs">
          {t(
            "workspace.filesTab.filesWillAppear",
            "Modified files will appear here after task execution"
          )}
        </p>
      </div>
    );
  }

  return (
    <div className={cn("flex h-full", className)}>
      {/* File List */}
      <div className="w-64 border-r shrink-0 flex flex-col">
        <div className="px-3 py-2 border-b">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {t("workspace.filesTab.title", "Files")} ({displayFiles.length})
          </span>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-1 space-y-0.5">
            {displayFiles.map((file, index) => (
              <FileListItem
                key={file.path}
                file={file}
                isSelected={index === selectedIndex}
                onClick={() => setSelectedIndex(index)}
              />
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Content Preview */}
      <div className="flex-1 min-w-0">
        {selectedFile ? (
          <FileContentPreview
            file={selectedFile}
            content={fileContent}
            isLoading={isLoadingContent}
            onOpenInIDE={onOpenInIDE}
            onCopyPath={handleCopyPath}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <p className="text-sm">
              {t("workspace.filesTab.selectFile", "Select a file to view")}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
