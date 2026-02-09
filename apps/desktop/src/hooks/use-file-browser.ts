import { useState, useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { FileEntry, FileInfo } from "@/types";

export type ViewMode = "list" | "icon" | "column" | "gallery";

interface FileBrowserState {
  currentPath: string;
  files: FileEntry[];
  selectedFile: FileEntry | null;
  selectedFiles: Set<string>;
  viewMode: ViewMode;
  loading: boolean;
  error: string | null;
  history: string[];
  historyIndex: number;
  clipboard: { files: FileEntry[]; operation: "copy" | "cut" } | null;
  previewFile: FileEntry | null;
  columnPaths: string[]; // For Miller Columns view
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
