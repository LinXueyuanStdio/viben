import { useState, useCallback, useEffect, useMemo } from "react";
import { getGatewayClient } from "@/lib/gateway";
import type { FileEntry, FileInfo } from "@/types";

export type ViewMode = "list" | "icon" | "column" | "gallery";
export type SortField = "name" | "size" | "modified" | "type";
export type SortDirection = "asc" | "desc";
export type GroupField = "none" | "type" | "date" | "size";

export interface FileGroup {
  key: string;
  label: string;
  files: FileEntry[];
}

interface FileBrowserState {
  currentPath: string;
  files: FileEntry[];
  selectedFile: FileEntry | null;
  selectedFiles: Set<string>;
  viewMode: ViewMode;
  sortField: SortField;
  sortDirection: SortDirection;
  groupField: GroupField;
  searchQuery: string;
  loading: boolean;
  error: string | null;
  history: string[];
  historyIndex: number;
  clipboard: { files: FileEntry[]; operation: "copy" | "cut" } | null;
  previewFile: FileEntry | null;
  columnPaths: string[]; // For Miller Columns view
}

/**
 * Get file type/extension for sorting
 */
function getFileType(file: FileEntry): string {
  if (file.is_directory) return "";
  const ext = file.name.split(".").pop()?.toLowerCase();
  return ext || "";
}

/**
 * Compare files for sorting
 */
/**
 * Get file type category for grouping
 */
function getFileTypeCategory(file: FileEntry): string {
  if (file.is_directory) return "folders";
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (!ext) return "other";

  // Image extensions
  const imageExts = ["jpg", "jpeg", "png", "gif", "webp", "svg", "ico", "bmp", "tiff"];
  if (imageExts.includes(ext)) return "images";

  // Code extensions
  const codeExts = [
    "ts", "tsx", "js", "jsx", "py", "rs", "go", "java", "c", "cpp", "h", "hpp",
    "css", "scss", "sass", "less", "html", "xml", "json", "yaml", "yml", "toml",
    "sh", "bash", "zsh", "fish", "rb", "php", "swift", "kt", "scala", "r", "sql"
  ];
  if (codeExts.includes(ext)) return "code";

  // Document extensions
  const docExts = ["md", "txt", "log", "csv", "pdf", "doc", "docx", "rtf", "odt"];
  if (docExts.includes(ext)) return "documents";

  return "other";
}

/**
 * Get date category for grouping
 */
function getDateCategory(file: FileEntry): string {
  if (!file.modified) return "earlier";

  const modified = new Date(file.modified);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const thisWeekStart = new Date(today);
  thisWeekStart.setDate(thisWeekStart.getDate() - today.getDay());
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  if (modified >= today) return "today";
  if (modified >= yesterday) return "yesterday";
  if (modified >= thisWeekStart) return "thisWeek";
  if (modified >= thisMonthStart) return "thisMonth";
  return "earlier";
}

/**
 * Get size category for grouping
 */
function getSizeCategory(file: FileEntry): string {
  if (file.is_directory) return "folders";
  const size = file.size ?? 0;

  const MB = 1024 * 1024;
  const KB = 1024;

  if (size >= 100 * MB) return "large";      // > 100MB
  if (size >= 1 * MB) return "medium";       // 1-100MB
  if (size >= 100 * KB) return "small";      // 100KB-1MB
  return "tiny";                              // < 100KB
}

/**
 * Compare files for sorting
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
      comparison = a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
      break;
    case "size":
      comparison = (a.size ?? 0) - (b.size ?? 0);
      break;
    case "modified":
      const aTime = a.modified ? new Date(a.modified).getTime() : 0;
      const bTime = b.modified ? new Date(b.modified).getTime() : 0;
      comparison = aTime - bTime;
      break;
    case "type":
      const aType = getFileType(a);
      const bType = getFileType(b);
      comparison = aType.localeCompare(bType, undefined, { sensitivity: "base" });
      // If same type, sort by name
      if (comparison === 0) {
        comparison = a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
      }
      break;
  }

  return direction === "asc" ? comparison : -comparison;
}

interface UseFileBrowserOptions {
  workspacePath: string;
  initialPath?: string;
}

export function useFileBrowser({ workspacePath, initialPath }: UseFileBrowserOptions) {
  const [state, setState] = useState<FileBrowserState>({
    currentPath: initialPath || workspacePath,
    files: [],
    selectedFile: null,
    selectedFiles: new Set(),
    viewMode: (localStorage.getItem("fileBrowser.viewMode") as ViewMode) || "column",
    sortField: (localStorage.getItem("fileBrowser.sortField") as SortField) || "name",
    sortDirection: (localStorage.getItem("fileBrowser.sortDirection") as SortDirection) || "asc",
    groupField: (localStorage.getItem("fileBrowser.groupField") as GroupField) || "none",
    searchQuery: "",
    loading: false,
    error: null,
    history: [initialPath || workspacePath],
    historyIndex: 0,
    clipboard: null,
    previewFile: null,
    columnPaths: [initialPath || workspacePath],
  });

  // Load directory contents
  const loadDirectory = useCallback(async (path: string) => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const client = getGatewayClient();
      const result = await client.listFiles(path);

      // Map gateway response to FileEntry format
      const entries: FileEntry[] = result.entries.map(entry => ({
        name: entry.name,
        path: entry.path,
        is_directory: entry.is_directory,
        size: entry.size,
        modified: entry.modified_at,
        created: entry.created_at,
      }));

      // Sort: directories first, then files, alphabetically
      const sorted = entries.sort((a, b) => {
        if (a.is_directory && !b.is_directory) return -1;
        if (!a.is_directory && b.is_directory) return 1;
        return a.name.localeCompare(b.name);
      });

      setState(prev => ({
        ...prev,
        files: sorted,
        loading: false,
      }));

      return sorted;
    } catch (err) {
      setState(prev => ({
        ...prev,
        error: err instanceof Error ? err.message : String(err),
        loading: false,
      }));
      return [];
    }
  }, []);

  // Navigate to a directory
  const navigateTo = useCallback((path: string, addToHistory = true) => {
    setState(prev => {
      const newHistory = addToHistory
        ? [...prev.history.slice(0, prev.historyIndex + 1), path]
        : prev.history;
      const newIndex = addToHistory ? newHistory.length - 1 : prev.historyIndex;

      return {
        ...prev,
        currentPath: path,
        selectedFile: null,
        selectedFiles: new Set(),
        searchQuery: "", // Clear search when navigating
        history: newHistory,
        historyIndex: newIndex,
      };
    });
  }, []);

  // Navigate back in history
  const goBack = useCallback(() => {
    setState(prev => {
      if (prev.historyIndex <= 0) return prev;
      const newIndex = prev.historyIndex - 1;
      return {
        ...prev,
        currentPath: prev.history[newIndex],
        historyIndex: newIndex,
        selectedFile: null,
        selectedFiles: new Set(),
      };
    });
  }, []);

  // Navigate forward in history
  const goForward = useCallback(() => {
    setState(prev => {
      if (prev.historyIndex >= prev.history.length - 1) return prev;
      const newIndex = prev.historyIndex + 1;
      return {
        ...prev,
        currentPath: prev.history[newIndex],
        historyIndex: newIndex,
        selectedFile: null,
        selectedFiles: new Set(),
      };
    });
  }, []);

  // Navigate to parent directory
  const goUp = useCallback(() => {
    setState(prev => {
      const parentPath = prev.currentPath.split("/").slice(0, -1).join("/") || "/";
      if (parentPath.length < workspacePath.length) return prev; // Don't go above workspace
      return {
        ...prev,
        currentPath: parentPath,
        selectedFile: null,
        selectedFiles: new Set(),
        history: [...prev.history.slice(0, prev.historyIndex + 1), parentPath],
        historyIndex: prev.historyIndex + 1,
      };
    });
  }, [workspacePath]);

  // Select a file
  const selectFile = useCallback((file: FileEntry | null, multiSelect = false) => {
    setState(prev => {
      if (!file) {
        return { ...prev, selectedFile: null, selectedFiles: new Set() };
      }

      if (multiSelect) {
        const newSelected = new Set(prev.selectedFiles);
        if (newSelected.has(file.path)) {
          newSelected.delete(file.path);
        } else {
          newSelected.add(file.path);
        }
        return { ...prev, selectedFile: file, selectedFiles: newSelected };
      }

      return {
        ...prev,
        selectedFile: file,
        selectedFiles: new Set([file.path]),
      };
    });
  }, []);

  // Set view mode
  const setViewMode = useCallback((mode: ViewMode) => {
    localStorage.setItem("fileBrowser.viewMode", mode);
    setState(prev => ({ ...prev, viewMode: mode }));
  }, []);

  // Set sort field
  const setSortField = useCallback((field: SortField) => {
    localStorage.setItem("fileBrowser.sortField", field);
    setState(prev => ({ ...prev, sortField: field }));
  }, []);

  // Set sort direction
  const setSortDirection = useCallback((direction: SortDirection) => {
    localStorage.setItem("fileBrowser.sortDirection", direction);
    setState(prev => ({ ...prev, sortDirection: direction }));
  }, []);

  // Set group field
  const setGroupField = useCallback((field: GroupField) => {
    localStorage.setItem("fileBrowser.groupField", field);
    setState(prev => ({ ...prev, groupField: field }));
  }, []);

  // Set search query
  const setSearchQuery = useCallback((query: string) => {
    setState(prev => ({ ...prev, searchQuery: query }));
  }, []);

  // Computed: filtered and sorted files
  const filteredFiles = useMemo(() => {
    let result = state.files;

    // Filter by search query
    if (state.searchQuery.trim()) {
      const query = state.searchQuery.toLowerCase().trim();
      result = result.filter(file =>
        file.name.toLowerCase().includes(query)
      );
    }

    // Sort files
    result = [...result].sort((a, b) =>
      compareFiles(a, b, state.sortField, state.sortDirection)
    );

    return result;
  }, [state.files, state.searchQuery, state.sortField, state.sortDirection]);

  // Computed: grouped files (returns null when groupField is "none")
  const groupedFiles = useMemo((): FileGroup[] | null => {
    if (state.groupField === "none") return null;

    // Group order definitions
    const typeOrder = ["folders", "images", "code", "documents", "other"];
    const dateOrder = ["today", "yesterday", "thisWeek", "thisMonth", "earlier"];
    const sizeOrder = ["folders", "large", "medium", "small", "tiny"];

    // Label maps (keys for i18n)
    const typeLabelKeys: Record<string, string> = {
      folders: "fileBrowser.groupFolders",
      images: "fileBrowser.groupImages",
      code: "fileBrowser.groupCode",
      documents: "fileBrowser.groupDocuments",
      other: "fileBrowser.groupOther",
    };
    const dateLabelKeys: Record<string, string> = {
      today: "fileBrowser.groupToday",
      yesterday: "fileBrowser.groupYesterday",
      thisWeek: "fileBrowser.groupThisWeek",
      thisMonth: "fileBrowser.groupThisMonth",
      earlier: "fileBrowser.groupEarlier",
    };
    const sizeLabelKeys: Record<string, string> = {
      folders: "fileBrowser.groupFolders",
      large: "fileBrowser.groupLarge",
      medium: "fileBrowser.groupMedium",
      small: "fileBrowser.groupSmall",
      tiny: "fileBrowser.groupTiny",
    };

    let getCategoryFn: (file: FileEntry) => string;
    let categoryOrder: string[];
    let labelKeys: Record<string, string>;

    switch (state.groupField) {
      case "type":
        getCategoryFn = getFileTypeCategory;
        categoryOrder = typeOrder;
        labelKeys = typeLabelKeys;
        break;
      case "date":
        getCategoryFn = getDateCategory;
        categoryOrder = dateOrder;
        labelKeys = dateLabelKeys;
        break;
      case "size":
        getCategoryFn = getSizeCategory;
        categoryOrder = sizeOrder;
        labelKeys = sizeLabelKeys;
        break;
      default:
        return null;
    }

    // Group files by category
    const groupMap = new Map<string, FileEntry[]>();
    for (const file of filteredFiles) {
      const category = getCategoryFn(file);
      const existing = groupMap.get(category);
      if (existing) {
        existing.push(file);
      } else {
        groupMap.set(category, [file]);
      }
    }

    // Build ordered groups array
    const groups: FileGroup[] = [];
    for (const key of categoryOrder) {
      const files = groupMap.get(key);
      if (files && files.length > 0) {
        groups.push({
          key,
          label: labelKeys[key] || key,
          files,
        });
      }
    }

    return groups;
  }, [filteredFiles, state.groupField]);

  // Set preview file (for Quick Look)
  const setPreviewFile = useCallback((file: FileEntry | null) => {
    setState(prev => ({ ...prev, previewFile: file }));
  }, []);

  // Update column paths (for Miller Columns view)
  const updateColumnPaths = useCallback((paths: string[]) => {
    setState(prev => ({ ...prev, columnPaths: paths }));
  }, []);

  // File operations
  const createFile = useCallback(async (name: string, content = "") => {
    try {
      const client = getGatewayClient();
      await client.createFile(`${state.currentPath}/${name}`, content);
      await loadDirectory(state.currentPath);
    } catch (err) {
      setState(prev => ({ ...prev, error: err instanceof Error ? err.message : String(err) }));
    }
  }, [state.currentPath, loadDirectory]);

  const createDirectory = useCallback(async (name: string) => {
    try {
      const client = getGatewayClient();
      await client.createDirectory(`${state.currentPath}/${name}`);
      await loadDirectory(state.currentPath);
    } catch (err) {
      setState(prev => ({ ...prev, error: err instanceof Error ? err.message : String(err) }));
    }
  }, [state.currentPath, loadDirectory]);

  const renameItem = useCallback(async (oldPath: string, newName: string) => {
    try {
      const client = getGatewayClient();
      const parentDir = oldPath.split("/").slice(0, -1).join("/");
      await client.renameFile(oldPath, `${parentDir}/${newName}`);
      await loadDirectory(state.currentPath);
    } catch (err) {
      setState(prev => ({ ...prev, error: err instanceof Error ? err.message : String(err) }));
    }
  }, [state.currentPath, loadDirectory]);

  const deleteItem = useCallback(async (path: string) => {
    try {
      const client = getGatewayClient();
      await client.deleteFile(path, true);
      await loadDirectory(state.currentPath);
      setState(prev => ({
        ...prev,
        selectedFile: prev.selectedFile?.path === path ? null : prev.selectedFile,
        selectedFiles: new Set([...prev.selectedFiles].filter(p => p !== path)),
      }));
    } catch (err) {
      setState(prev => ({ ...prev, error: err instanceof Error ? err.message : String(err) }));
    }
  }, [state.currentPath, loadDirectory]);

  const copyToClipboard = useCallback((files: FileEntry[]) => {
    setState(prev => ({ ...prev, clipboard: { files, operation: "copy" } }));
  }, []);

  const cutToClipboard = useCallback((files: FileEntry[]) => {
    setState(prev => ({ ...prev, clipboard: { files, operation: "cut" } }));
  }, []);

  const paste = useCallback(async () => {
    if (!state.clipboard) return;

    try {
      const client = getGatewayClient();
      for (const file of state.clipboard.files) {
        const destPath = `${state.currentPath}/${file.name}`;
        if (state.clipboard.operation === "copy") {
          await client.copyFile(file.path, destPath);
        } else {
          await client.moveFile(file.path, destPath);
        }
      }
      await loadDirectory(state.currentPath);
      if (state.clipboard.operation === "cut") {
        setState(prev => ({ ...prev, clipboard: null }));
      }
    } catch (err) {
      setState(prev => ({ ...prev, error: err instanceof Error ? err.message : String(err) }));
    }
  }, [state.currentPath, state.clipboard, loadDirectory]);

  const getFileInfo = useCallback(async (path: string): Promise<FileInfo | null> => {
    try {
      const client = getGatewayClient();
      const result = await client.listFiles(path.split("/").slice(0, -1).join("/"));
      const fileName = path.split("/").pop();
      const entry = result.entries.find(e => e.name === fileName);
      if (!entry) return null;
      return {
        name: entry.name,
        path: entry.path,
        is_directory: entry.is_directory,
        size: entry.size ?? 0,
        modified: entry.modified_at ?? "",
        created: entry.created_at ?? "",
        extension: entry.extension,
      };
    } catch {
      return null;
    }
  }, []);

  const readFileContent = useCallback(async (path: string): Promise<string | null> => {
    try {
      const client = getGatewayClient();
      const result = await client.readFile(path);
      return result.content;
    } catch {
      return null;
    }
  }, []);

  // Load initial directory
  useEffect(() => {
    if (state.currentPath) {
      loadDirectory(state.currentPath);
    }
  }, [state.currentPath, loadDirectory]);

  return {
    // State
    ...state,
    filteredFiles,
    groupedFiles,
    canGoBack: state.historyIndex > 0,
    canGoForward: state.historyIndex < state.history.length - 1,
    canGoUp: state.currentPath.length > workspacePath.length,

    // Navigation
    navigateTo,
    goBack,
    goForward,
    goUp,
    loadDirectory,

    // Selection
    selectFile,
    setViewMode,
    setPreviewFile,
    updateColumnPaths,

    // Sort, group and search
    setSortField,
    setSortDirection,
    setGroupField,
    setSearchQuery,

    // File operations
    createFile,
    createDirectory,
    renameItem,
    deleteItem,
    copyToClipboard,
    cutToClipboard,
    paste,
    getFileInfo,
    readFileContent,
  };
}
