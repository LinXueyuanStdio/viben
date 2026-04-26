/**
 * Workspace tab content for the right sidebar
 */
import * as React from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getGatewayClient } from "@/lib/gateway";
import type { WorkingFile } from "@/types";
import type { WorkspaceTabContentProps } from "./types";
import { getFileIconByExt } from "./utils";

/**
 * Empty state component
 */
function EmptyState({
  icon: Icon,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <div className="bg-muted/30 rounded-full p-3 mb-3">
        <Icon className="h-5 w-5 text-muted-foreground/40" />
      </div>
      <p className="text-sm text-muted-foreground/60">{description}</p>
    </div>
  );
}

/**
 * File tree item component for recursive directory display
 */
function FileTreeItem({
  file,
  depth = 0,
  onSelect,
}: {
  file: WorkingFile;
  depth?: number;
  onSelect?: (file: WorkingFile) => void;
}) {
  const prefersReducedMotion = useReducedMotion();
  const [isExpanded, setIsExpanded] = React.useState(file.isExpanded ?? false);

  const handleClick = () => {
    if (file.isDir) {
      setIsExpanded(!isExpanded);
    } else {
      onSelect?.(file);
    }
  };

  const ext = file.name.split(".").pop();
  const FileIcon = file.isDir
    ? isExpanded
      ? FolderOpen
      : Folder
    : getFileIconByExt(ext);

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        className={cn(
          "flex w-full items-center gap-1.5 rounded-md py-1 text-left text-sm",
          "hover:bg-muted transition-colors",
          file.isDir && "font-medium"
        )}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        <span className="shrink-0 text-muted-foreground/50 w-4 flex items-center justify-center">
          {file.isDir && (
            isExpanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )
          )}
        </span>
        <FileIcon
          className={cn(
            "h-3.5 w-3.5 shrink-0",
            file.isDir ? "text-amber-500" : "text-muted-foreground/60"
          )}
        />
        <span className="truncate text-foreground/80">{file.name}</span>
      </button>
      {file.isDir && isExpanded && file.children && (
        <AnimatePresence>
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.15 }}
          >
            {file.children.map((child, idx) => (
              <FileTreeItem
                key={`${child.path}-${idx}`}
                file={child}
                depth={depth + 1}
                onSelect={onSelect}
              />
            ))}
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}

/**
 * Workspace tab content
 */
export function WorkspaceTabContent({
  workingDir,
  workingFiles,
  externalFolders,
  isLoadingFiles,
  onFileSelect,
}: WorkspaceTabContentProps) {
  const { t } = useTranslation();
  const [outputExpanded, setOutputExpanded] = React.useState(true);
  const [externalExpanded, setExternalExpanded] = React.useState(true);

  // Get folder name from path
  const getFolderName = (path: string) => path.split(/[\\/]/).pop() || path;

  // Handle opening folder in system file manager
  const handleOpenFolder = async (folderPath: string) => {
    try {
      await getGatewayClient().revealInFileManager(folderPath);
    } catch (error) {
      console.error("Failed to open folder:", error);
    }
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Output folder subsection */}
      <div className="flex flex-col flex-1 min-h-0">
        <div className="mb-2 flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setOutputExpanded(!outputExpanded)}
            className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
          >
            {outputExpanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
            <span className="text-xs font-medium">
              {t("chat.sidebar.outputFolder", "Output Folder")}
            </span>
          </button>
          {workingDir && (
            <button
              type="button"
              onClick={() => handleOpenFolder(workingDir)}
              className="ml-auto p-1 text-muted-foreground hover:text-foreground transition-colors rounded hover:bg-accent"
              title={t("workspace.openInFinder")}
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        {outputExpanded && (
          <>
            {!workingDir ? (
              <EmptyState
                icon={Folder}
                description={t("chat.sidebar.noWorkingDir", "No working directory")}
              />
            ) : isLoadingFiles ? (
              <div className="flex items-center justify-center gap-2 py-4 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">{t("common.loading")}</span>
              </div>
            ) : workingFiles.length === 0 ? (
              <div className="rounded-md border border-dashed border-border/50 py-4">
                <EmptyState
                  icon={Folder}
                  description={t("chat.sidebar.emptyFolder", "Folder is empty")}
                />
              </div>
            ) : (
              <div className="flex-1 space-y-0.5 overflow-y-auto rounded-md border border-border/30 bg-muted/20 p-2">
                {workingFiles.map((file, idx) => (
                  <FileTreeItem
                    key={`${file.path}-${idx}`}
                    file={file}
                    onSelect={onFileSelect}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* External folders subsection */}
      {externalFolders.length > 0 && (
        <div>
          <div className="mb-2 flex items-center gap-1">
            <button
              type="button"
              onClick={() => setExternalExpanded(!externalExpanded)}
              className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
            >
              {externalExpanded ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
              <span className="text-xs font-medium">
                {t("chat.sidebar.externalFolders", "External Folders")}
              </span>
            </button>
          </div>
          {externalExpanded && (
            <div className="space-y-1 rounded-md border border-border/30 bg-muted/20 p-2">
              {externalFolders.map((folder) => (
                <button
                  key={folder}
                  type="button"
                  onClick={() => handleOpenFolder(folder)}
                  className="flex w-full items-center gap-2 rounded-md py-1.5 px-2 text-left hover:bg-accent/50 transition-colors group"
                >
                  <FolderOpen className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                  <span className="truncate text-sm text-foreground/80 flex-1">
                    {getFolderName(folder)}
                  </span>
                  <ExternalLink className="h-3 w-3 text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
