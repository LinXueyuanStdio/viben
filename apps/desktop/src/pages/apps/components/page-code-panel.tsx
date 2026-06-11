import {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
import { useTranslation } from "react-i18next";
import {
  Group,
  Panel,
  Separator,
} from "react-resizable-panels";
import {
  ChevronDown,
  ChevronRight,
  File,
  Folder,
  FolderOpen,
  X,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CodeEditor } from "@/components/skill-files/code-editor";
import { getGatewayUrl } from "@/lib/gateway/config";
import { readDirectory, readFileContent, writeFile } from "@/lib/gateway/modules/files";
import type { FileEntry } from "@/lib/gateway/types/file";
import type { SaveStatus } from "@/hooks";

// ============================================================================
// Types
// ============================================================================

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
  const baseUrl = getGatewayUrl();
  const pageDirPath = useMemo(
    () => `${workspacePath}/pages/${pageUid}`,
    [workspacePath, pageUid]
  );

  // File tree state
  const [treeNodes, setTreeNodes] = useState<TreeNode[]>([]);
  const [isLoadingTree, setIsLoadingTree] = useState(true);
  const [treeError, setTreeError] = useState<string | null>(null);

  // Tabs state
  const [openTabs, setOpenTabs] = useState<OpenTab[]>([]);
  const [activeTabPath, setActiveTabPath] = useState<string | null>(null);

  // Auto-save timer refs
  const saveTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // ============================================================================
  // File tree loading
  // ============================================================================

  const loadDirectory = useCallback(
    async (dirPath: string): Promise<TreeNode[]> => {
      const entries = await readDirectory(baseUrl, workspacePath, dirPath);
      // Sort: directories first, then files, alphabetical
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

  const loadTree = useCallback(async () => {
    setIsLoadingTree(true);
    setTreeError(null);
    try {
      const nodes = await loadDirectory(pageDirPath);
      setTreeNodes(nodes);
    } catch (err) {
      setTreeError(
        err instanceof Error ? err.message : t("common.error")
      );
    } finally {
      setIsLoadingTree(false);
    }
  }, [loadDirectory, pageDirPath, t]);

  useEffect(() => {
    loadTree();
  }, [loadTree]);

  // ============================================================================
  // Toggle directory expansion
  // ============================================================================

  const toggleDir = useCallback(
    async (path: string) => {
      setTreeNodes((prev) => updateNodesToggle(prev, path));

      // If not loaded yet, load children
      const node = findNode(treeNodes, path);
      if (node && !node.isLoaded && !node.isLoading) {
        // Mark as loading
        setTreeNodes((prev) => updateNodeProp(prev, path, { isLoading: true }));
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
    [treeNodes, loadDirectory]
  );

  // ============================================================================
  // File selection - open in tab
  // ============================================================================

  const openFile = useCallback(
    async (entry: FileEntry) => {
      if (entry.is_directory) return;

      // Check if already open
      const existing = openTabs.find((tab) => tab.path === entry.path);
      if (existing) {
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
        setOpenTabs((prev) => [...prev, newTab]);
        setActiveTabPath(entry.path);
      } catch (err) {
        console.error("Failed to open file:", err);
      }
    },
    [baseUrl, workspacePath, openTabs]
  );

  // ============================================================================
  // Tab management
  // ============================================================================

  const closeTab = useCallback(
    (path: string) => {
      const tab = openTabs.find((t) => t.path === path);
      if (tab?.isDirty) {
        // Simple confirmation for unsaved changes
        const confirmed = window.confirm(
          t("codePanel.unsavedChangesWarning", {
            defaultValue: "This file has unsaved changes. Close anyway?",
          })
        );
        if (!confirmed) return;
      }

      // Clear any pending save timer
      const timer = saveTimersRef.current.get(path);
      if (timer) {
        clearTimeout(timer);
        saveTimersRef.current.delete(path);
      }

      setOpenTabs((prev) => prev.filter((tab) => tab.path !== path));
      if (activeTabPath === path) {
        const remaining = openTabs.filter((tab) => tab.path !== path);
        setActiveTabPath(remaining.length > 0 ? remaining[remaining.length - 1].path : null);
      }
    },
    [openTabs, activeTabPath, t]
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
    [baseUrl, workspacePath]
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
        // Only save if content is actually different from original
        const tab = openTabs.find((t) => t.path === path);
        if (tab) {
          // We need to use the latest content, so we read from the state at save time
          setOpenTabs((prev) => {
            const currentTab = prev.find((t) => t.path === path);
            if (currentTab && currentTab.content !== currentTab.originalContent) {
              saveFile(path, currentTab.content);
            }
            return prev;
          });
        }
      }, 1500);

      saveTimersRef.current.set(path, timer);
    },
    [openTabs, saveFile]
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
  // Active tab content
  // ============================================================================

  const activeTab = useMemo(
    () => openTabs.find((tab) => tab.path === activeTabPath) ?? null,
    [openTabs, activeTabPath]
  );

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className={cn("flex h-full min-h-0", className)}>
      <Group orientation="horizontal" className="h-full min-h-0">
        {/* Left Panel: File Tree */}
        <Panel
          id="code-file-tree"
          defaultSize={25}
          minSize={15}
          maxSize={50}
          className="min-w-0 min-h-0"
        >
          <div className="flex flex-col h-full border-r">
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b shrink-0">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {t("codePanel.files", { defaultValue: "Files" })}
              </span>
              <button
                onClick={loadTree}
                className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                title={t("codePanel.refresh", { defaultValue: "Refresh" })}
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Tree content */}
            <ScrollArea className="flex-1 min-h-0">
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
                    {t("codePanel.noFiles", { defaultValue: "No files found" })}
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
            </ScrollArea>
          </div>
        </Panel>

        {/* Separator */}
        <Separator
          id="code-panel-separator"
          className={cn(
            "relative z-10 bg-border cursor-col-resize group touch-none",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
            "w-1 hover:w-1.5 transition-all"
          )}
        />

        {/* Right Panel: Editor with Tabs */}
        <Panel
          id="code-editor-area"
          defaultSize={75}
          minSize={40}
          className="min-w-0 min-h-0"
        >
          <div className="flex flex-col h-full">
            {/* Tab bar */}
            {openTabs.length > 0 && (
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
                    {/* Dirty indicator */}
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

            {/* Editor area */}
            <div className="flex-1 min-h-0">
              {activeTab ? (
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
                  {t("codePanel.selectFile", {
                    defaultValue: "Select a file from the tree to start editing",
                  })}
                </div>
              )}
            </div>
          </div>
        </Panel>
      </Group>
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
