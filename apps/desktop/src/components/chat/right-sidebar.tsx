import * as React from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  Folder,
  FolderOpen,
  Wrench,
  ChevronRight,
  ChevronDown,
  Package,
  Code,
  FileCode,
  FileJson,
  ImageIcon,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type { Artifact, WorkingFile, ToolUsage } from "@/types";

interface RightSidebarProps {
  artifacts: Artifact[];
  workingFiles?: WorkingFile[];
  toolUsages: ToolUsage[];
  onArtifactSelect?: (artifact: Artifact) => void;
  onFileSelect?: (file: WorkingFile) => void;
  onToolSelect?: (tool: ToolUsage) => void;
  selectedArtifact?: Artifact | null;
  isOpen?: boolean;
  onClose?: () => void;
  className?: string;
}

/**
 * Get icon for file based on extension
 */
function getFileIcon(filename: string) {
  const ext = filename.split(".").pop()?.toLowerCase();

  switch (ext) {
    case "js":
    case "jsx":
    case "ts":
    case "tsx":
      return FileCode;
    case "json":
      return FileJson;
    case "png":
    case "jpg":
    case "jpeg":
    case "gif":
    case "svg":
      return ImageIcon;
    case "md":
      return FileText;
    default:
      return Code;
  }
}

/**
 * File tree item component
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
  const [isExpanded, setIsExpanded] = React.useState(file.isExpanded ?? true);

  const handleClick = () => {
    if (file.isDir) {
      setIsExpanded(!isExpanded);
    } else {
      onSelect?.(file);
    }
  };

  const FileIcon = file.isDir
    ? isExpanded
      ? FolderOpen
      : Folder
    : getFileIcon(file.name);

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        className={cn(
          "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm",
          "hover:bg-muted transition-colors",
          file.isDir && "font-medium"
        )}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        {file.isDir && (
          <span className="shrink-0 text-muted-foreground">
            {isExpanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
          </span>
        )}
        <FileIcon
          className={cn(
            "h-4 w-4 shrink-0",
            file.isDir ? "text-amber-500" : "text-muted-foreground"
          )}
        />
        <span className="truncate">{file.name}</span>
      </button>
      {file.isDir && isExpanded && file.children && (
        <AnimatePresence>
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
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
 * Artifact card component
 */
function ArtifactCard({
  artifact,
  onClick,
  isSelected,
}: {
  artifact: Artifact;
  onClick?: () => void;
  isSelected?: boolean;
}) {
  const typeIcons: Record<string, React.ElementType> = {
    html: FileCode,
    jsx: FileCode,
    css: FileCode,
    json: FileJson,
    markdown: FileText,
    code: Code,
    image: ImageIcon,
    default: Package,
  };

  const Icon = typeIcons[artifact.type] || typeIcons.default;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full flex items-start gap-3 rounded-lg border p-3 text-left transition-all",
        isSelected
          ? "border-primary bg-primary/10"
          : "border-border bg-card hover:border-primary/50 hover:bg-muted/50"
      )}
    >
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
          isSelected ? "bg-primary/20" : "bg-muted"
        )}
      >
        <Icon className={cn("h-4 w-4", isSelected ? "text-primary" : "text-muted-foreground")} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn("text-sm font-medium truncate", isSelected && "text-primary")}>
          {artifact.name}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">{artifact.type}</p>
      </div>
    </button>
  );
}

/**
 * Tool usage item component
 */
function ToolUsageItem({
  tool,
  onClick,
}: {
  tool: ToolUsage;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-start gap-3 rounded-lg border border-border bg-card p-3 text-left hover:border-primary/50 hover:bg-muted/50 transition-all"
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
        <Wrench className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{tool.displayName}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {new Date(tool.timestamp).toLocaleTimeString()}
        </p>
      </div>
    </button>
  );
}

export function RightSidebar({
  artifacts,
  workingFiles = [],
  toolUsages,
  onArtifactSelect,
  onFileSelect,
  onToolSelect,
  selectedArtifact,
  isOpen = true,
  onClose,
  className,
}: RightSidebarProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = React.useState("artifacts");

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex h-full w-80 flex-col border-l border-border bg-background",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h3 className="font-serif font-semibold text-foreground">
          {t("chat.sidebar")}
        </h3>
        {onClose && (
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
            <X className="h-4 w-4" />
            <span className="sr-only">{t("common.close")}</span>
          </Button>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="mx-4 mt-2" variant="pills">
          <TabsTrigger value="artifacts" variant="pills">
            <Package className="h-4 w-4 mr-1.5" />
            {t("chat.artifacts")}
          </TabsTrigger>
          <TabsTrigger value="files" variant="pills">
            <Folder className="h-4 w-4 mr-1.5" />
            {t("chat.files")}
          </TabsTrigger>
          <TabsTrigger value="tools" variant="pills">
            <Wrench className="h-4 w-4 mr-1.5" />
            {t("chat.tools")}
          </TabsTrigger>
        </TabsList>

        {/* Artifacts tab */}
        <TabsContent value="artifacts" className="flex-1 mt-0 p-0">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-2">
              {artifacts.length === 0 ? (
                <div className="text-center py-8">
                  <Package className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                  <p className="text-sm text-muted-foreground">
                    {t("chat.noArtifacts")}
                  </p>
                </div>
              ) : (
                artifacts.map((artifact) => (
                  <ArtifactCard
                    key={artifact.id}
                    artifact={artifact}
                    onClick={() => onArtifactSelect?.(artifact)}
                    isSelected={selectedArtifact?.id === artifact.id}
                  />
                ))
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Files tab */}
        <TabsContent value="files" className="flex-1 mt-0 p-0">
          <ScrollArea className="h-full">
            <div className="p-2">
              {workingFiles.length === 0 ? (
                <div className="text-center py-8">
                  <Folder className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                  <p className="text-sm text-muted-foreground">
                    {t("chat.noFiles")}
                  </p>
                </div>
              ) : (
                workingFiles.map((file, idx) => (
                  <FileTreeItem
                    key={`${file.path}-${idx}`}
                    file={file}
                    onSelect={onFileSelect}
                  />
                ))
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Tools tab */}
        <TabsContent value="tools" className="flex-1 mt-0 p-0">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-2">
              {toolUsages.length === 0 ? (
                <div className="text-center py-8">
                  <Wrench className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                  <p className="text-sm text-muted-foreground">
                    {t("chat.noTools")}
                  </p>
                </div>
              ) : (
                toolUsages.map((tool) => (
                  <ToolUsageItem
                    key={tool.id}
                    tool={tool}
                    onClick={() => onToolSelect?.(tool)}
                  />
                ))
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
