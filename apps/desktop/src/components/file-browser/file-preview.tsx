import * as React from "react";
import {
  X,
  FileText,
  Image as ImageIcon,
  Code2,
  File,
  Clock,
  HardDrive,
  Calendar,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import type { FileEntry, FileInfo } from "@/types";

/* -----------------------------------------------------------------------------
 * Types
 * -------------------------------------------------------------------------- */

interface FilePreviewProps {
  file: FileEntry | null;
  open: boolean;
  onClose: () => void;
  readFileContent: (path: string) => Promise<string | null>;
  getFileInfo: (path: string) => Promise<FileInfo | null>;
}

type PreviewType = "image" | "text" | "code" | "unknown";

interface FilePreviewState {
  content: string | null;
  fileInfo: FileInfo | null;
  isLoading: boolean;
  error: string | null;
}

/* -----------------------------------------------------------------------------
 * Utilities
 * -------------------------------------------------------------------------- */

const imageExtensions = new Set(["jpg", "jpeg", "png", "gif", "svg", "webp", "bmp", "ico"]);
const textExtensions = new Set(["txt", "md", "markdown"]);
const codeExtensions = new Set([
  "js", "ts", "jsx", "tsx", "py", "rs", "go", "json", "yaml", "yml",
  "html", "css", "scss", "less", "xml", "sh", "bash", "zsh",
  "c", "cpp", "h", "hpp", "java", "kt", "swift", "rb", "php",
  "sql", "toml", "ini", "conf", "env", "gitignore", "dockerfile",
]);

function getFileExtension(filename: string): string {
  const parts = filename.toLowerCase().split(".");
  return parts.length > 1 ? parts[parts.length - 1] : "";
}

function getPreviewType(filename: string): PreviewType {
  const ext = getFileExtension(filename);

  if (imageExtensions.has(ext)) return "image";
  if (textExtensions.has(ext)) return "text";
  if (codeExtensions.has(ext)) return "code";

  return "unknown";
}

function getLanguageFromExtension(ext: string): string {
  const languageMap: Record<string, string> = {
    js: "JavaScript",
    ts: "TypeScript",
    jsx: "JavaScript (React)",
    tsx: "TypeScript (React)",
    py: "Python",
    rs: "Rust",
    go: "Go",
    json: "JSON",
    yaml: "YAML",
    yml: "YAML",
    html: "HTML",
    css: "CSS",
    scss: "SCSS",
    less: "Less",
    xml: "XML",
    sh: "Shell",
    bash: "Bash",
    zsh: "Zsh",
    c: "C",
    cpp: "C++",
    h: "C Header",
    hpp: "C++ Header",
    java: "Java",
    kt: "Kotlin",
    swift: "Swift",
    rb: "Ruby",
    php: "PHP",
    sql: "SQL",
    toml: "TOML",
    ini: "INI",
    conf: "Config",
    md: "Markdown",
    markdown: "Markdown",
  };
  return languageMap[ext] || ext.toUpperCase();
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB"];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${units[i]}`;
}

function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateString;
  }
}

function getPreviewIcon(previewType: PreviewType) {
  switch (previewType) {
    case "image":
      return ImageIcon;
    case "text":
      return FileText;
    case "code":
      return Code2;
    default:
      return File;
  }
}

/* -----------------------------------------------------------------------------
 * Preview Content Components
 * -------------------------------------------------------------------------- */

function ImagePreview({ src, alt }: { src: string; alt: string }) {
  const [error, setError] = React.useState(false);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <ImageIcon className="size-12 mb-3 opacity-50" />
        <p className="text-sm">Failed to load image</p>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center p-4">
      <img
        src={src}
        alt={alt}
        className="max-w-full max-h-[60vh] object-contain rounded-lg shadow-sm"
        onError={() => setError(true)}
      />
    </div>
  );
}

function TextPreview({ content }: { content: string }) {
  return (
    <ScrollArea className="h-[60vh]">
      <div className="p-4">
        <pre className="text-sm text-foreground whitespace-pre-wrap break-words font-sans leading-relaxed">
          {content}
        </pre>
      </div>
    </ScrollArea>
  );
}

function CodePreview({ content, language }: { content: string; language: string }) {
  return (
    <ScrollArea className="h-[60vh]">
      <div className="p-4">
        <div className="mb-2 flex items-center gap-2">
          <Code2 className="size-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground font-medium">{language}</span>
        </div>
        <pre className="text-sm text-foreground bg-accent/30 rounded-lg p-4 overflow-x-auto">
          <code className="font-mono text-[13px] leading-relaxed">{content}</code>
        </pre>
      </div>
    </ScrollArea>
  );
}

function UnknownPreview({ fileInfo }: { fileInfo: FileInfo | null }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
      <File className="size-16 mb-4 opacity-40" />
      <p className="text-sm mb-1">Preview not available</p>
      <p className="text-xs opacity-70">
        {fileInfo?.extension
          ? `${fileInfo.extension.toUpperCase()} files cannot be previewed`
          : "This file type cannot be previewed"}
      </p>
    </div>
  );
}

function LoadingPreview() {
  return (
    <div className="p-4 space-y-4">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-4 w-4/5" />
    </div>
  );
}

function ErrorPreview({ error }: { error: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-destructive">
      <File className="size-12 mb-3 opacity-50" />
      <p className="text-sm font-medium">Error loading file</p>
      <p className="text-xs mt-1 opacity-70 max-w-xs text-center">{error}</p>
    </div>
  );
}

/* -----------------------------------------------------------------------------
 * File Metadata Panel
 * -------------------------------------------------------------------------- */

function FileMetadataPanel({ fileInfo }: { fileInfo: FileInfo | null }) {
  if (!fileInfo) {
    return (
      <div className="border-t border-border bg-accent/20 px-4 py-3 space-y-2">
        <Skeleton className="h-4 w-32" />
        <div className="flex gap-6">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
    );
  }

  return (
    <div className="border-t border-border bg-accent/20 px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <HardDrive className="size-3.5" />
          <span>{formatFileSize(fileInfo.size)}</span>
        </div>
        {fileInfo.modified && (
          <div className="flex items-center gap-1.5">
            <Clock className="size-3.5" />
            <span>Modified: {formatDate(fileInfo.modified)}</span>
          </div>
        )}
        {fileInfo.created && (
          <div className="flex items-center gap-1.5">
            <Calendar className="size-3.5" />
            <span>Created: {formatDate(fileInfo.created)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* -----------------------------------------------------------------------------
 * FilePreview Component
 * -------------------------------------------------------------------------- */

export function FilePreview({
  file,
  open,
  onClose,
  readFileContent,
  getFileInfo,
}: FilePreviewProps) {
  const [state, setState] = React.useState<FilePreviewState>({
    content: null,
    fileInfo: null,
    isLoading: false,
    error: null,
  });

  const previewType = file ? getPreviewType(file.name) : "unknown";
  const Icon = getPreviewIcon(previewType);

  // Load file content and info when file changes
  React.useEffect(() => {
    if (!open || !file) {
      setState({ content: null, fileInfo: null, isLoading: false, error: null });
      return;
    }

    // Capture file for use in async function (TypeScript narrowing)
    const currentFile = file;
    let cancelled = false;

    async function loadFile() {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        // Load file info first
        const info = await getFileInfo(currentFile.path);
        if (cancelled) return;

        setState((prev) => ({ ...prev, fileInfo: info }));

        // Only load content for text-based files
        const type = getPreviewType(currentFile.name);
        if (type === "text" || type === "code") {
          const content = await readFileContent(currentFile.path);
          if (cancelled) return;

          setState((prev) => ({
            ...prev,
            content,
            isLoading: false,
            error: content === null ? "Failed to read file content" : null,
          }));
        } else {
          setState((prev) => ({ ...prev, isLoading: false }));
        }
      } catch (err) {
        if (cancelled) return;
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: err instanceof Error ? err.message : "Failed to load file",
        }));
      }
    }

    loadFile();

    return () => {
      cancelled = true;
    };
  }, [file, open, readFileContent, getFileInfo]);

  // Handle keyboard shortcuts
  React.useEffect(() => {
    if (!open) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" || e.key === " ") {
        e.preventDefault();
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  // Prevent body scroll when modal is open
  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open || !file) return null;

  // Capture values for use in render (TypeScript narrowing)
  const currentFile = file;
  const ext = getFileExtension(currentFile.name);

  // Determine preview content based on state and type
  const previewContent = (() => {
    if (state.isLoading) {
      return <LoadingPreview />;
    }

    if (state.error) {
      return <ErrorPreview error={state.error} />;
    }

    switch (previewType) {
      case "image":
        // For images, use a file:// URL or the path directly
        // In Tauri, we need to convert the path to an asset URL
        return <ImagePreview src={`file://${currentFile.path}`} alt={currentFile.name} />;

      case "text":
        return state.content ? (
          <TextPreview content={state.content} />
        ) : (
          <UnknownPreview fileInfo={state.fileInfo} />
        );

      case "code":
        return state.content ? (
          <CodePreview content={state.content} language={getLanguageFromExtension(ext)} />
        ) : (
          <UnknownPreview fileInfo={state.fileInfo} />
        );

      default:
        return <UnknownPreview fileInfo={state.fileInfo} />;
    }
  })();

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-50 bg-black/60 backdrop-blur-sm",
          "animate-in fade-in-0 duration-200"
        )}
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className={cn(
          "fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2",
          "w-full max-w-3xl max-h-[85vh]",
          "bg-card border border-border rounded-2xl shadow-2xl",
          "animate-in fade-in-0 zoom-in-95 duration-200",
          "flex flex-col overflow-hidden"
        )}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="file-preview-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-accent/10">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center justify-center size-8 rounded-lg bg-primary/10">
              <Icon className="size-4 text-primary" />
            </div>
            <div className="min-w-0">
              <h2
                id="file-preview-title"
                className="font-serif text-base font-semibold truncate"
              >
                {currentFile.name}
              </h2>
              <p className="text-xs text-muted-foreground truncate">
                {currentFile.path}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={cn(
              "flex items-center justify-center size-8 rounded-lg",
              "text-muted-foreground hover:text-foreground",
              "hover:bg-accent transition-colors",
              "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            )}
            aria-label="Close preview"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {previewContent}
        </div>

        {/* Metadata footer */}
        <FileMetadataPanel fileInfo={state.fileInfo} />

        {/* Keyboard hint */}
        <div className="px-4 py-2 border-t border-border bg-accent/5 text-center">
          <span className="text-xs text-muted-foreground">
            Press <kbd className="px-1.5 py-0.5 rounded bg-accent font-mono text-[10px]">Space</kbd> or{" "}
            <kbd className="px-1.5 py-0.5 rounded bg-accent font-mono text-[10px]">Esc</kbd> to close
          </span>
        </div>
      </div>
    </>
  );
}
