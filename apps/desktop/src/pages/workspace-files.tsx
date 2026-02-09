import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Loader2, FolderOpen } from "lucide-react";
import { PageWrapper } from "@/components/layout";
import { WorkspaceHeader } from "@/components/workspace";
import { useLocalWorkspaces } from "@/hooks";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import type { FileEntry } from "@/types";

export function WorkspaceFilesPage() {
  const { t } = useTranslation();
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { getWorkspace } = useLocalWorkspaces();
  const [currentPath, setCurrentPath] = useState<string>("");
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const workspace = workspaceId ? getWorkspace(workspaceId) : undefined;

  useEffect(() => {
    if (!workspace) return;

    // Set initial path to workspace root
    setCurrentPath(workspace.path);
  }, [workspace]);

  useEffect(() => {
    if (!workspace || !currentPath) return;

    loadDirectory(currentPath);
  }, [workspace, currentPath]);

  const loadDirectory = async (path: string) => {
    if (!workspace) return;

    setLoading(true);
    setError(null);

    try {
      const entries = await invoke<FileEntry[]>("read_directory", {
        workspacePath: workspace.path,
        dirPath: path,
      });
      setFiles(entries);
    } catch (err) {
      setError(err as string);
    } finally {
      setLoading(false);
    }
  };

  const handleFileClick = (file: FileEntry) => {
    if (file.is_directory) {
      setCurrentPath(file.path);
    }
  };

  if (!workspace) {
    return (
      <PageWrapper>
        <div className="flex flex-col items-center justify-center h-[60vh]">
          <Loader2 className="h-12 w-12 animate-spin text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Loading workspace...</p>
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper className="flex flex-col h-full">
      <WorkspaceHeader workspace={workspace} />

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-7xl mx-auto">
          {/* Breadcrumb */}
          <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
            <FolderOpen className="h-4 w-4" />
            <span className="font-mono truncate">{currentPath}</span>
          </div>

          {/* File List */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12">
              <p className="text-destructive mb-2">Error loading directory</p>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
          ) : (
            <div className="space-y-1">
              {files.map((file) => (
                <div
                  key={file.path}
                  onClick={() => handleFileClick(file)}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent cursor-pointer"
                >
                  <FolderOpen className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  <span className="flex-1 truncate">{file.name}</span>
                  {!file.is_directory && file.size && (
                    <span className="text-sm text-muted-foreground">
                      {formatFileSize(file.size)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </PageWrapper>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}
