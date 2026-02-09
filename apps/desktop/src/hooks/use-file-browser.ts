import { useState, useCallback, useEffect, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
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
      const entries = await invoke<FileEntry[]>("read_directory", {
        workspacePath,
        dirPath: path,
      });

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
        error: err as string,
        loading: false,
      }));
      return [];
    }
  }, [workspacePath]);

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
      await invoke("create_file", {
        workspacePath,
        filePath: `${state.currentPath}/${name}`,
        content,
      });
      await loadDirectory(state.currentPath);
    } catch (err) {
      setState(prev => ({ ...prev, error: err as string }));
    }
  }, [workspacePath, state.currentPath, loadDirectory]);

  const createDirectory = useCallback(async (name: string) => {
    try {
      await invoke("create_directory", {
        workspacePath,
        dirPath: `${state.currentPath}/${name}`,
      });
      await loadDirectory(state.currentPath);
    } catch (err) {
      setState(prev => ({ ...prev, error: err as string }));
    }
  }, [workspacePath, state.currentPath, loadDirectory]);

  const renameItem = useCallback(async (oldPath: string, newName: string) => {
    try {
      const parentDir = oldPath.split("/").slice(0, -1).join("/");
      await invoke("rename_item", {
        workspacePath,
        oldPath,
        newPath: `${parentDir}/${newName}`,
      });
      await loadDirectory(state.currentPath);
    } catch (err) {
      setState(prev => ({ ...prev, error: err as string }));
    }
  }, [workspacePath, state.currentPath, loadDirectory]);

  const deleteItem = useCallback(async (path: string) => {
    try {
      await invoke("delete_item", {
        workspacePath,
        itemPath: path,
      });
      await loadDirectory(state.currentPath);
      setState(prev => ({
        ...prev,
        selectedFile: prev.selectedFile?.path === path ? null : prev.selectedFile,
        selectedFiles: new Set([...prev.selectedFiles].filter(p => p !== path)),
      }));
    } catch (err) {
      setState(prev => ({ ...prev, error: err as string }));
    }
  }, [workspacePath, state.currentPath, loadDirectory]);

  const copyToClipboard = useCallback((files: FileEntry[]) => {
    setState(prev => ({ ...prev, clipboard: { files, operation: "copy" } }));
  }, []);

  const cutToClipboard = useCallback((files: FileEntry[]) => {
    setState(prev => ({ ...prev, clipboard: { files, operation: "cut" } }));
  }, []);

  const paste = useCallback(async () => {
    if (!state.clipboard) return;

    try {
      for (const file of state.clipboard.files) {
        const destPath = `${state.currentPath}/${file.name}`;
        if (state.clipboard.operation === "copy") {
          await invoke("copy_item", {
            workspacePath,
            srcPath: file.path,
            destPath,
          });
        } else {
          await invoke("move_item", {
            workspacePath,
            srcPath: file.path,
            destPath,
          });
        }
      }
      await loadDirectory(state.currentPath);
      if (state.clipboard.operation === "cut") {
        setState(prev => ({ ...prev, clipboard: null }));
      }
    } catch (err) {
      setState(prev => ({ ...prev, error: err as string }));
    }
  }, [workspacePath, state.currentPath, state.clipboard, loadDirectory]);

  const getFileInfo = useCallback(async (path: string): Promise<FileInfo | null> => {
    try {
      return await invoke<FileInfo>("get_file_info", {
        workspacePath,
        filePath: path,
      });
    } catch {
      return null;
    }
  }, [workspacePath]);

  const readFileContent = useCallback(async (path: string): Promise<string | null> => {
    try {
      return await invoke<string>("read_file_content", {
        workspacePath,
        filePath: path,
      });
    } catch {
      return null;
    }
  }, [workspacePath]);

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

    // Sort and search
    setSortField,
    setSortDirection,
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
