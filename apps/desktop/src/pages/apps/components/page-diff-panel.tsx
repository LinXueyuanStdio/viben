/**
 * PageDiffPanel Component
 *
 * A GitHub Desktop-like diff viewer for workspace pages.
 * Shows changed files in a left panel and a Monaco diff editor in the right panel.
 */

import {
  useState,
  useCallback,
  useMemo,
  useEffect,
  useRef,
} from "react";
import { useTranslation } from "react-i18next";
import { DiffEditor } from "@monaco-editor/react";
import {
  GitCompare,
  FileDiff,
  Plus,
  FileEdit,
  Trash2,
  RefreshCw,
  ArrowRightLeft,
  Columns2,
  FileCode,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/use-theme";
import { usePageGitStatus } from "@/hooks/use-page-git-status";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { GitFileChange } from "@/hooks/use-page-git-status";

// ============================================================================
// Types
// ============================================================================

export interface PageDiffPanelProps {
  workspacePath: string;
  pageUid: string;
  className?: string;
}

type DiffViewMode = "unified" | "split";

// ============================================================================
// Constants
// ============================================================================

const FILE_LIST_MIN_WIDTH = 200;
const FILE_LIST_DEFAULT_WIDTH = 250;
const FILE_LIST_MAX_WIDTH = 400;

// ============================================================================
// Helpers
// ============================================================================

function getStatusIcon(status: GitFileChange["status"]) {
  switch (status) {
    case "modified":
      return FileEdit;
    case "added":
      return Plus;
    case "deleted":
      return Trash2;
    case "renamed":
      return ArrowRightLeft;
  }
}

function getStatusLabel(status: GitFileChange["status"]): string {
  switch (status) {
    case "modified":
      return "M";
    case "added":
      return "A";
    case "deleted":
      return "D";
    case "renamed":
      return "R";
  }
}

function getStatusColor(status: GitFileChange["status"]): string {
  switch (status) {
    case "modified":
      return "text-yellow-600 dark:text-yellow-400";
    case "added":
      return "text-green-600 dark:text-green-400";
    case "deleted":
      return "text-red-600 dark:text-red-400";
    case "renamed":
      return "text-blue-600 dark:text-blue-400";
  }
}

function getStatusBadgeClasses(status: GitFileChange["status"]): string {
  switch (status) {
    case "modified":
      return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300";
    case "added":
      return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300";
    case "deleted":
      return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300";
    case "renamed":
      return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300";
  }
}

function getFileLanguage(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  const langMap: Record<string, string> = {
    ts: "typescript",
    tsx: "typescriptreact",
    js: "javascript",
    jsx: "javascriptreact",
    json: "json",
    md: "markdown",
    css: "css",
    scss: "scss",
    html: "html",
    yaml: "yaml",
    yml: "yaml",
    toml: "toml",
    py: "python",
    rs: "rust",
    go: "go",
    sh: "shell",
    bash: "shell",
    sql: "sql",
    xml: "xml",
    svg: "xml",
  };
  return langMap[ext] || "plaintext";
}

function getFileName(filePath: string): string {
  return filePath.split("/").pop() ?? filePath;
}

function getFileDir(filePath: string): string {
  const parts = filePath.split("/");
  if (parts.length <= 1) return "";
  return parts.slice(0, -1).join("/");
}

// ============================================================================
// Sub-components
// ============================================================================

function EmptyState() {
  const { t } = useTranslation();

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
      <CheckCircle2 className="h-12 w-12 opacity-40" />
      <p className="text-sm font-medium">
        {t("pages.diff.noChanges", "No changes detected")}
      </p>
      <p className="text-xs opacity-70">
        {t(
          "pages.diff.noChangesDesc",
          "All files are up to date with the repository"
        )}
      </p>
    </div>
  );
}

function LoadingState() {
  const { t } = useTranslation();

  return (
    <div className="flex h-full items-center justify-center text-muted-foreground">
      <div className="flex items-center gap-2">
        <RefreshCw className="h-4 w-4 animate-spin" />
        <span className="text-sm">
          {t("pages.diff.loading", "Loading changes...")}
        </span>
      </div>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  const { t } = useTranslation();

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
      <GitCompare className="h-12 w-12 opacity-40" />
      <p className="text-sm font-medium">
        {t("pages.diff.error", "Unable to load changes")}
      </p>
      <p className="max-w-xs text-center text-xs opacity-70">{message}</p>
    </div>
  );
}

function NoDiffSelected() {
  const { t } = useTranslation();

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
      <FileDiff className="h-12 w-12 opacity-40" />
      <p className="text-sm font-medium">
        {t("pages.diff.selectFile", "Select a file to view changes")}
      </p>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function PageDiffPanel({
  workspacePath,
  pageUid,
  className,
}: PageDiffPanelProps) {
  const { t } = useTranslation();
  const { resolvedTheme } = useTheme();

  const { changes, loading, error, refresh, fetchDiff } = usePageGitStatus(
    workspacePath,
    pageUid
  );

  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [diffViewMode, setDiffViewMode] = useState<DiffViewMode>("unified");
  const [oldContent, setOldContent] = useState("");
  const [newContent, setNewContent] = useState("");
  const [diffLoading, setDiffLoading] = useState(false);
  const [fileListWidth, setFileListWidth] = useState(FILE_LIST_DEFAULT_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const fileListRef = useRef<HTMLDivElement>(null);
  const selectedIndex = useMemo(
    () => changes.findIndex((c) => c.path === selectedFile),
    [changes, selectedFile]
  );

  // Fetch diff when selected file changes
  useEffect(() => {
    if (!selectedFile) {
      setOldContent("");
      setNewContent("");
      return;
    }

    let cancelled = false;

    async function loadDiff() {
      setDiffLoading(true);
      const result = await fetchDiff(selectedFile!);
      if (!cancelled) {
        if (result) {
          setOldContent(result.oldContent);
          setNewContent(result.newContent);
        } else {
          setOldContent("");
          setNewContent("");
        }
        setDiffLoading(false);
      }
    }

    loadDiff();
    return () => {
      cancelled = true;
    };
  }, [selectedFile, fetchDiff]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (changes.length === 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        const nextIndex = Math.min(selectedIndex + 1, changes.length - 1);
        setSelectedFile(changes[nextIndex].path);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const prevIndex = Math.max(selectedIndex - 1, 0);
        setSelectedFile(changes[prevIndex].path);
      }
    },
    [changes, selectedIndex]
  );

  // Resize handler
  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsResizing(true);

      const startX = e.clientX;
      const startWidth = fileListWidth;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const delta = moveEvent.clientX - startX;
        const newWidth = Math.max(
          FILE_LIST_MIN_WIDTH,
          Math.min(FILE_LIST_MAX_WIDTH, startWidth + delta)
        );
        setFileListWidth(newWidth);
      };

      const handleMouseUp = () => {
        setIsResizing(false);
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [fileListWidth]
  );

  // Monaco theme
  const monacoTheme = resolvedTheme === "dark" ? "vs-dark" : "vs";

  // Selected file language
  const language = useMemo(
    () => (selectedFile ? getFileLanguage(selectedFile) : "plaintext"),
    [selectedFile]
  );

  // ============================================================================
  // Render
  // ============================================================================

  if (loading && changes.length === 0) {
    return (
      <div className={cn("flex h-full", className)}>
        <LoadingState />
      </div>
    );
  }

  if (error && changes.length === 0) {
    return (
      <div className={cn("flex h-full", className)}>
        <ErrorState message={error} />
      </div>
    );
  }

  if (changes.length === 0 && !loading) {
    return (
      <div className={cn("flex h-full", className)}>
        <EmptyState />
      </div>
    );
  }

  return (
    <div
      className={cn("flex h-full overflow-hidden", className)}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      {/* Left panel: File list */}
      <div
        ref={fileListRef}
        className="flex flex-col border-r border-border"
        style={{ width: fileListWidth, minWidth: FILE_LIST_MIN_WIDTH }}
      >
        {/* File list header */}
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <div className="flex items-center gap-2">
            <GitCompare className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-medium text-foreground">
              {t("pages.diff.changes", "Changes")}
            </span>
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 text-[10px] font-semibold text-muted-foreground">
              {changes.length}
            </span>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={refresh}
                disabled={loading}
              >
                <RefreshCw
                  className={cn("h-3.5 w-3.5", loading && "animate-spin")}
                />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {t("pages.diff.refresh", "Refresh")}
            </TooltipContent>
          </Tooltip>
        </div>

        {/* File list */}
        <ScrollArea className="flex-1">
          <div className="py-1">
            {changes.map((change) => {
              const StatusIcon = getStatusIcon(change.status);
              const isSelected = change.path === selectedFile;
              const fileName = getFileName(change.path);
              const fileDir = getFileDir(change.path);

              return (
                <button
                  key={change.path}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors",
                    "hover:bg-accent/50",
                    isSelected && "bg-accent text-accent-foreground"
                  )}
                  onClick={() => setSelectedFile(change.path)}
                >
                  <StatusIcon
                    className={cn("h-3.5 w-3.5 shrink-0", getStatusColor(change.status))}
                  />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-medium">{fileName}</span>
                    {fileDir && (
                      <span className="truncate text-[10px] text-muted-foreground">
                        {fileDir}
                      </span>
                    )}
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded px-1 py-0.5 text-[10px] font-bold",
                      getStatusBadgeClasses(change.status)
                    )}
                  >
                    {getStatusLabel(change.status)}
                  </span>
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </div>

      {/* Resize handle */}
      <div
        className={cn(
          "w-1 cursor-col-resize transition-colors hover:bg-primary/20",
          isResizing && "bg-primary/30"
        )}
        onMouseDown={handleResizeStart}
      />

      {/* Right panel: Diff view */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Diff toolbar */}
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <div className="flex items-center gap-2 overflow-hidden">
            {selectedFile && (
              <>
                <FileCode className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="truncate text-xs font-medium text-foreground">
                  {selectedFile}
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "h-7 w-7",
                    diffViewMode === "unified" && "bg-accent"
                  )}
                  onClick={() => setDiffViewMode("unified")}
                >
                  <FileDiff className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {t("pages.diff.unified", "Unified view")}
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "h-7 w-7",
                    diffViewMode === "split" && "bg-accent"
                  )}
                  onClick={() => setDiffViewMode("split")}
                >
                  <Columns2 className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {t("pages.diff.split", "Split view")}
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Diff content */}
        <div className="flex-1 overflow-hidden">
          {!selectedFile && <NoDiffSelected />}
          {selectedFile && diffLoading && <LoadingState />}
          {selectedFile && !diffLoading && (
            <DiffEditor
              original={oldContent}
              modified={newContent}
              language={language}
              theme={monacoTheme}
              options={{
                readOnly: true,
                renderSideBySide: diffViewMode === "split",
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                lineNumbers: "on",
                fontSize: 12,
                wordWrap: "on",
                diffWordWrap: "on",
                renderOverviewRuler: false,
                scrollbar: {
                  verticalScrollbarSize: 8,
                  horizontalScrollbarSize: 8,
                },
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
