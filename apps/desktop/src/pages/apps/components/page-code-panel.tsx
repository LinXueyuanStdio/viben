import {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
import { useTranslation } from "react-i18next";
import { DiffEditor } from "@monaco-editor/react";
import {
  ChevronDown,
  ChevronRight,
  File,
  FileEdit,
  Plus,
  Trash2,
  ArrowRightLeft,
  Folder,
  FolderOpen,
  X,
  Loader2,
  RefreshCw,
  FolderTree,
  GitCompare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CodeEditor } from "@/components/skill-files/code-editor";
import { ResizeHandle } from "@/pages/conversation/components/resize-handle";
import { useTheme } from "@/hooks/use-theme";
import { getGatewayUrl } from "@/lib/gateway/config";
import { readDirectory, readFileContent, writeFile } from "@/lib/gateway/modules/files";
import { usePageGitStatus } from "@/hooks/use-page-git-status";
import type { GitFileChange } from "@/hooks/use-page-git-status";
import type { FileEntry } from "@/lib/gateway/types/file";
import type { SaveStatus } from "@/hooks";

// ============================================================================
// Types
// ============================================================================

type SidebarMode = "files" | "changes";

interface PageCodePanelProps {
  workspacePath: string;
  pageUid: string;
  className?: string;
}

interface OpenTab {
  path: string;
  name: string;
  content: string;
  originalContent: string;
  isDirty: boolean;
  saveStatus: SaveStatus;
}

interface TreeNode {
  entry: FileEntry;
  children: TreeNode[];
  isLoaded: boolean;
  isLoading: boolean;
  isExpanded: boolean;
}

// ============================================================================
// Helper: Get file icon
// ============================================================================

function getFileIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "md":
      return <File className="h-4 w-4 text-blue-500" />;
    case "json":
      return <File className="h-4 w-4 text-yellow-500" />;
    case "ts":
    case "tsx":
      return <File className="h-4 w-4 text-blue-600" />;
    case "js":
    case "jsx":
      return <File className="h-4 w-4 text-yellow-600" />;
    case "py":
      return <File className="h-4 w-4 text-green-500" />;
    case "rs":
      return <File className="h-4 w-4 text-orange-500" />;
    case "yaml":
    case "yml":
      return <File className="h-4 w-4 text-red-400" />;
    case "toml":
      return <File className="h-4 w-4 text-gray-500" />;
    case "sh":
    case "bash":
      return <File className="h-4 w-4 text-green-600" />;
    case "css":
    case "scss":
      return <File className="h-4 w-4 text-purple-500" />;
    case "html":
      return <File className="h-4 w-4 text-orange-600" />;
    default:
      return <File className="h-4 w-4 text-muted-foreground" />;
  }
}

// ============================================================================
// Diff helpers
// ============================================================================

function getChangeStatusIcon(status: GitFileChange["status"]) {
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

function getChangeStatusColor(status: GitFileChange["status"]): string {
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

function getChangeStatusBadge(status: GitFileChange["status"]): { label: string; classes: string } {
  switch (status) {
    case "modified":
      return { label: "M", classes: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300" };
    case "added":
      return { label: "A", classes: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" };
    case "deleted":
      return { label: "D", classes: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" };
    case "renamed":
      return { label: "R", classes: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" };
  }
}

function getFileLanguage(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  const langMap: Record<string, string> = {
    ts: "typescript", tsx: "typescriptreact", js: "javascript", jsx: "javascriptreact",
    json: "json", md: "markdown", css: "css", scss: "scss", html: "html",
    yaml: "yaml", yml: "yaml", py: "python", rs: "rust", go: "go",
    sh: "shell", bash: "shell", sql: "sql", xml: "xml", svg: "xml",
  };
  return langMap[ext] || "plaintext";
}

// ============================================================================
// FileTreeNode Component
// ============================================================================

interface FileTreeNodeProps {
  node: TreeNode;
  depth: number;
  selectedPath: string | null;
  onSelectFile: (entry: FileEntry) => void;
  onToggleDir: (path: string) => void;
}

function FileTreeNode({
  node,
  depth,
  selectedPath,
  onSelectFile,
  onToggleDir,
}: FileTreeNodeProps) {
  const { entry } = node;
  const isSelected = selectedPath === entry.path;

  const handleClick = useCallback(() => {
    if (entry.is_directory) {
      onToggleDir(entry.path);
    } else {
      onSelectFile(entry);
    }
  }, [entry, onSelectFile, onToggleDir]);

  return (
    <div>
      <button
        onClick={handleClick}
        className={cn(
          "w-full flex items-center gap-1 px-2 py-1 rounded-md text-left text-sm",
          "hover:bg-accent transition-colors",
          isSelected && "bg-accent text-accent-foreground"
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {entry.is_directory ? (
          <>
            {node.isLoading ? (
              <Loader2 className="h-4 w-4 text-muted-foreground flex-shrink-0 animate-spin" />
            ) : node.isExpanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            )}
            {node.isExpanded ? (
              <FolderOpen className="h-4 w-4 text-amber-500 flex-shrink-0" />
            ) : (
              <Folder className="h-4 w-4 text-amber-500 flex-shrink-0" />
            )}
          </>
        ) : (
          <>
            <span className="w-4 flex-shrink-0" />
            {getFileIcon(entry.name)}
          </>
        )}
        <span className="truncate">{entry.name}</span>
      </button>

      {entry.is_directory && node.isExpanded && (
        <div>
          {node.children.map((child) => (
            <FileTreeNode
              key={child.entry.path}
              node={child}
              depth={depth + 1}
              selectedPath={selectedPath}
              onSelectFile={onSelectFile}
              onToggleDir={onToggleDir}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// PageCodePanel Component
// ============================================================================

export function PageCodePanel({
  workspacePath,
  pageUid,
  className,
}: PageCodePanelProps) {
  const { t } = useTranslation();
  const { resolvedTheme } = useTheme();
  const baseUrl = getGatewayUrl();
  const pageDirPath = useMemo(
    () => `${workspacePath}/pages/${pageUid}`,
    [workspacePath, pageUid]
  );

  // Sidebar mode: file tree or git changes
  const [sidebarMode, setSidebarMode] = useState<SidebarMode>("files");

  // File tree state
  const [treeNodes, setTreeNodes] = useState<TreeNode[]>([]);
  const [isLoadingTree, setIsLoadingTree] = useState(true);
  const [treeError, setTreeError] = useState<string | null>(null);

  // Tabs state
  const [openTabs, setOpenTabs] = useState<OpenTab[]>([]);
  const [activeTabPath, setActiveTabPath] = useState<string | null>(null);

  // Sidebar resize state
  const [sidebarWidth, setSidebarWidth] = useState(250);

  // Diff state
  const { changes, loading: changesLoading, refresh: refreshChanges, fetchDiff } = usePageGitStatus(workspacePath, pageUid);
  const [selectedDiffFile, setSelectedDiffFile] = useState<string | null>(null);
  const [diffOld, setDiffOld] = useState("");
  const [diffNew, setDiffNew] = useState("");
  const [diffLoading, setDiffLoading] = useState(false);

  // Auto-save timer refs
  const saveTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // ============================================================================
  // File tree loading — prefetch first N levels in parallel
  // ============================================================================

  const PREFETCH_DEPTH = 1;

  const loadDirectory = useCallback(
    async (dirPath: string): Promise<TreeNode[]> => {
      const entries = await readDirectory(baseUrl, workspacePath, dirPath);
      const sorted = [...entries].sort((a, b) => {
        if (a.is_directory && !b.is_directory) return -1;
        if (!a.is_directory && b.is_directory) return 1;
        return a.name.localeCompare(b.name);
      });
      return sorted.map((entry) => ({
        entry,
        children: [],
        isLoaded: false,
        isLoading: false,
        isExpanded: false,
      }));
    },
    [baseUrl, workspacePath]
  );

  const loadTreeRecursive = useCallback(
    async (dirPath: string, depth: number): Promise<TreeNode[]> => {
      const nodes = await loadDirectory(dirPath);
      if (depth >= PREFETCH_DEPTH) return nodes;

      const dirNodes = nodes.filter((n) => n.entry.is_directory);
      if (dirNodes.length === 0) return nodes;

      const childResults = await Promise.allSettled(
        dirNodes.map((n) => loadTreeRecursive(n.entry.path, depth + 1))
      );

      const childMap = new Map<string, TreeNode[]>();
      dirNodes.forEach((n, i) => {
        const result = childResults[i];
        if (result.status === "fulfilled") {
          childMap.set(n.entry.path, result.value);
        }
      });

      return nodes.map((n) => {
        const children = childMap.get(n.entry.path);
        if (children) {
          return { ...n, children, isLoaded: true, isExpanded: true };
        }
        return n;
      });
    },
    [loadDirectory]
  );

  const loadTree = useCallback(async () => {
    setIsLoadingTree(true);
    setTreeError(null);
    try {
      const nodes = await loadTreeRecursive(pageDirPath, 0);
      setTreeNodes(nodes);
    } catch (err) {
      setTreeError(
        err instanceof Error ? err.message : t("common.error")
      );
    } finally {
      setIsLoadingTree(false);
    }
  }, [loadTreeRecursive, pageDirPath, t]);

  useEffect(() => {
    loadTree();
  }, [loadTree]);

  // ============================================================================
  // Toggle directory expansion
  // ============================================================================

  const toggleDir = useCallback(
    async (path: string) => {
      // Use functional updater to read current state and determine if we need to load
      let needsLoad = false;
      setTreeNodes((prev) => {
        const node = findNode(prev, path);
        if (node && !node.isLoaded && !node.isLoading) {
          needsLoad = true;
          // Toggle expansion AND mark as loading in one state update
          const toggled = updateNodesToggle(prev, path);
          return updateNodeProp(toggled, path, { isLoading: true });
        }
        // Just toggle expansion
        return updateNodesToggle(prev, path);
      });

      if (needsLoad) {
        try {
          const children = await loadDirectory(path);
          setTreeNodes((prev) =>
            updateNodeProp(prev, path, {
              children,
              isLoaded: true,
              isLoading: false,
              isExpanded: true,
            })
          );
        } catch {
          setTreeNodes((prev) =>
            updateNodeProp(prev, path, { isLoading: false })
          );
        }
      }
    },
    [loadDirectory]
  );

  // ============================================================================
  // File selection - open in tab
  // ============================================================================

  const openFile = useCallback(
    async (entry: FileEntry) => {
      if (entry.is_directory) return;

      // Use functional updater to check if already open without stale closure
      let alreadyOpen = false;
      setOpenTabs((prev) => {
        const existing = prev.find((tab) => tab.path === entry.path);
        if (existing) {
          alreadyOpen = true;
        }
        return prev;
      });

      if (alreadyOpen) {
        setActiveTabPath(entry.path);
        return;
      }

      try {
        const content = await readFileContent(baseUrl, workspacePath, entry.path);
        const newTab: OpenTab = {
          path: entry.path,
          name: entry.name,
          content,
          originalContent: content,
          isDirty: false,
          saveStatus: "idle",
        };
        setOpenTabs((prev) => {
          // Double-check it wasn't opened in the meantime (e.g. rapid double-click)
          if (prev.some((tab) => tab.path === entry.path)) {
            return prev;
          }
          return [...prev, newTab];
        });
        setActiveTabPath(entry.path);
      } catch (err) {
        console.error("Failed to open file:", err);
      }
    },
    [baseUrl, workspacePath]
  );

  // ============================================================================
  // Tab management
  // ============================================================================

  const closeTab = useCallback(
    (path: string) => {
      setOpenTabs((prev) => {
        const tab = prev.find((t) => t.path === path);
        if (tab?.isDirty) {
          const confirmed = window.confirm(
            t("codePanel.unsavedChangesWarning")
          );
          if (!confirmed) return prev;
        }

        // Clear any pending save timer
        const timer = saveTimersRef.current.get(path);
        if (timer) {
          clearTimeout(timer);
          saveTimersRef.current.delete(path);
        }

        const remaining = prev.filter((t) => t.path !== path);

        // Update active tab if the closed tab was active
        setActiveTabPath((prevActive) => {
          if (prevActive !== path) return prevActive;
          return remaining.length > 0 ? remaining[remaining.length - 1].path : null;
        });

        return remaining;
      });
    },
    [t]
  );

  // ============================================================================
  // Auto-save with debounce
  // ============================================================================

  const saveFile = useCallback(
    async (path: string, content: string) => {
      setOpenTabs((prev) =>
        prev.map((tab) =>
          tab.path === path ? { ...tab, saveStatus: "saving" as SaveStatus } : tab
        )
      );

      try {
        await writeFile(baseUrl, path, content);
        setOpenTabs((prev) =>
          prev.map((tab) =>
            tab.path === path
              ? {
                  ...tab,
                  saveStatus: "saved" as SaveStatus,
                  isDirty: false,
                  originalContent: content,
                }
              : tab
          )
        );
        // Reset status after delay
        setTimeout(() => {
          setOpenTabs((prev) =>
            prev.map((tab) =>
              tab.path === path && tab.saveStatus === "saved"
                ? { ...tab, saveStatus: "idle" as SaveStatus }
                : tab
            )
          );
        }, 2000);
      } catch (err) {
        console.error("Failed to save file:", err);
        setOpenTabs((prev) =>
          prev.map((tab) =>
            tab.path === path ? { ...tab, saveStatus: "error" as SaveStatus } : tab
          )
        );
      }
    },
    [baseUrl]
  );

  const handleEditorChange = useCallback(
    (path: string, newContent: string) => {
      setOpenTabs((prev) =>
        prev.map((tab) =>
          tab.path === path
            ? {
                ...tab,
                content: newContent,
                isDirty: newContent !== tab.originalContent,
              }
            : tab
        )
      );

      // Debounced auto-save (1.5s)
      const existingTimer = saveTimersRef.current.get(path);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      const timer = setTimeout(() => {
        saveTimersRef.current.delete(path);
        // Use functional updater to read latest state without stale closure
        setOpenTabs((prev) => {
          const currentTab = prev.find((t) => t.path === path);
          if (currentTab && currentTab.content !== currentTab.originalContent) {
            saveFile(path, currentTab.content);
          }
          return prev;
        });
      }, 1500);

      saveTimersRef.current.set(path, timer);
    },
    [saveFile]
  );

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      for (const timer of saveTimersRef.current.values()) {
        clearTimeout(timer);
      }
    };
  }, []);

  // ============================================================================
  // Diff file loading
  // ============================================================================

  useEffect(() => {
    if (!selectedDiffFile) {
      setDiffOld("");
      setDiffNew("");
      return;
    }

    let cancelled = false;

    async function loadDiff() {
      setDiffLoading(true);
      const result = await fetchDiff(selectedDiffFile!);
      if (!cancelled) {
        if (result) {
          setDiffOld(result.oldContent);
          setDiffNew(result.newContent);
        } else {
          setDiffOld("");
          setDiffNew("");
        }
        setDiffLoading(false);
      }
    }

    loadDiff();
    return () => { cancelled = true; };
  }, [selectedDiffFile, fetchDiff]);

  const diffLanguage = useMemo(
    () => (selectedDiffFile ? getFileLanguage(selectedDiffFile) : "plaintext"),
    [selectedDiffFile]
  );

  const monacoTheme = resolvedTheme === "dark" ? "vs-dark" : "vs";

  // ============================================================================
  // Active tab content
  // ============================================================================

  const activeTab = useMemo(
    () => openTabs.find((tab) => tab.path === activeTabPath) ?? null,
    [openTabs, activeTabPath]
  );

  // Whether showing diff mode (changes selected in sidebar)
  const showingDiff = sidebarMode === "changes" && selectedDiffFile !== null;

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className={cn("flex h-full min-h-0", className)}>
      {/* Left Panel: File Tree / Changes */}
      <div
        className="relative shrink-0 flex flex-col h-full border-r min-h-0"
        style={{ width: sidebarWidth }}
      >
        {/* Mode toggle */}
        <div className="flex items-center gap-1 px-2 py-1.5 border-b shrink-0">
          <button
            onClick={() => setSidebarMode("files")}
            className={cn(
              "flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors",
              sidebarMode === "files"
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
            )}
          >
            <FolderTree className="h-3.5 w-3.5" />
            {t("codePanel.files")}
          </button>
          <button
            onClick={() => { setSidebarMode("changes"); refreshChanges(); }}
            className={cn(
              "flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors",
              sidebarMode === "changes"
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
            )}
          >
            <GitCompare className="h-3.5 w-3.5" />
            {t("pages.diff.changes", "Changes")}
            {changes.length > 0 && (
              <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-muted px-1 text-[10px] font-semibold">
                {changes.length}
              </span>
            )}
          </button>
          <div className="flex-1" />
          <button
            onClick={sidebarMode === "files" ? loadTree : refreshChanges}
            className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            title={t("codePanel.refresh")}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", (sidebarMode === "files" ? isLoadingTree : changesLoading) && "animate-spin")} />
          </button>
        </div>

        {/* Content: File tree or Changes list */}
        <ScrollArea className="flex-1 min-h-0">
          {sidebarMode === "files" ? (
            <div className="p-1">
              {isLoadingTree ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : treeError ? (
                <div className="px-3 py-4 text-sm text-destructive">
                  {treeError}
                </div>
              ) : treeNodes.length === 0 ? (
                <div className="px-3 py-4 text-sm text-muted-foreground">
                  {t("codePanel.noFiles")}
                </div>
              ) : (
                treeNodes.map((node) => (
                  <FileTreeNode
                    key={node.entry.path}
                    node={node}
                    depth={0}
                    selectedPath={activeTabPath}
                    onSelectFile={openFile}
                    onToggleDir={toggleDir}
                  />
                ))
              )}
            </div>
          ) : (
            <div className="py-1">
              {changesLoading && changes.length === 0 ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : changes.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-1 py-8 text-muted-foreground">
                  <p className="text-xs">{t("pages.diff.noChanges", "No changes detected")}</p>
                </div>
              ) : (
                changes.map((change) => {
                  const StatusIcon = getChangeStatusIcon(change.status);
                  const badge = getChangeStatusBadge(change.status);
                  const isSelected = change.path === selectedDiffFile;
                  const fileName = change.path.split("/").pop() ?? change.path;
                  const fileDir = change.path.split("/").slice(0, -1).join("/");

                  return (
                    <button
                      key={change.path}
                      className={cn(
                        "flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors",
                        "hover:bg-accent/50",
                        isSelected && "bg-accent text-accent-foreground"
                      )}
                      onClick={() => setSelectedDiffFile(change.path)}
                    >
                      <StatusIcon className={cn("h-3.5 w-3.5 shrink-0", getChangeStatusColor(change.status))} />
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate font-medium">{fileName}</span>
                        {fileDir && (
                          <span className="truncate text-[10px] text-muted-foreground">{fileDir}</span>
                        )}
                      </div>
                      <span className={cn("shrink-0 rounded px-1 py-0.5 text-[10px] font-bold", badge.classes)}>
                        {badge.label}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          )}
        </ScrollArea>

        {/* Resize handle */}
        <ResizeHandle
          side="left"
          onResize={(delta) =>
            setSidebarWidth((w) => Math.min(400, Math.max(150, w + delta)))
          }
        />
      </div>

      {/* Right Panel: Editor or Diff */}
      <div className="flex flex-col flex-1 h-full min-w-0 min-h-0">
        {/* Tab bar (only when in files mode or no diff selected) */}
        {!showingDiff && openTabs.length > 0 && (
          <div className="flex items-center border-b shrink-0 overflow-x-auto">
            {openTabs.map((tab) => (
              <div
                key={tab.path}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 text-sm border-r cursor-pointer shrink-0",
                  "hover:bg-accent/50 transition-colors",
                  tab.path === activeTabPath
                    ? "bg-background text-foreground border-b-2 border-b-primary"
                    : "text-muted-foreground bg-muted/30"
                )}
                onClick={() => setActiveTabPath(tab.path)}
              >
                {tab.isDirty && (
                  <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                )}
                <span className="truncate max-w-32">{tab.name}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(tab.path);
                  }}
                  className="p-0.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors shrink-0"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Diff header when showing diff */}
        {showingDiff && (
          <div className="flex items-center gap-2 px-3 py-2 border-b shrink-0">
            <File className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate text-xs font-medium text-foreground">
              {selectedDiffFile}
            </span>
          </div>
        )}

        {/* Content area */}
        <div className="flex-1 min-h-0">
          {showingDiff ? (
            diffLoading ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : (
              <DiffEditor
                original={diffOld}
                modified={diffNew}
                language={diffLanguage}
                theme={monacoTheme}
                options={{
                  readOnly: true,
                  renderSideBySide: false,
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
            )
          ) : activeTab ? (
            <CodeEditor
              key={activeTab.path}
              value={activeTab.content}
              filename={activeTab.name}
              height="100%"
              saveStatus={activeTab.saveStatus}
              onChange={(newValue) => {
                if (newValue !== undefined) {
                  handleEditorChange(activeTab.path, newValue);
                }
              }}
              onSave={(content) => saveFile(activeTab.path, content)}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              {t("codePanel.selectFile")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Tree utility functions
// ============================================================================

function findNode(nodes: TreeNode[], path: string): TreeNode | null {
  for (const node of nodes) {
    if (node.entry.path === path) return node;
    if (node.children.length > 0) {
      const found = findNode(node.children, path);
      if (found) return found;
    }
  }
  return null;
}

function updateNodesToggle(nodes: TreeNode[], path: string): TreeNode[] {
  return nodes.map((node) => {
    if (node.entry.path === path) {
      return { ...node, isExpanded: !node.isExpanded };
    }
    if (node.children.length > 0) {
      return { ...node, children: updateNodesToggle(node.children, path) };
    }
    return node;
  });
}

function updateNodeProp(
  nodes: TreeNode[],
  path: string,
  updates: Partial<TreeNode>
): TreeNode[] {
  return nodes.map((node) => {
    if (node.entry.path === path) {
      return { ...node, ...updates };
    }
    if (node.children.length > 0) {
      return { ...node, children: updateNodeProp(node.children, path, updates) };
    }
    return node;
  });
}

export default PageCodePanel;
