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
  FileCode,
  FileJson,
  ImageIcon,
  X,
  ExternalLink,
  Loader2,
  Sparkles,
  Table,
  Presentation,
  FileSpreadsheet,
  Music,
  Video,
  Type as TypeIcon,
  File,
  Terminal,
  Search,
  FolderSearch,
  Globe,
  ListTodo,
  Layers,
  Code2,
  FileEdit,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Artifact, ArtifactType, WorkingFile, ToolUsage, AgentMessage } from "@/types";
import { invoke } from "@tauri-apps/api/core";

// Default number of items to show before "show more"
const DEFAULT_VISIBLE_COUNT = 10;

interface RightSidebarProps {
  artifacts: Artifact[];
  workingFiles?: WorkingFile[];
  toolUsages: ToolUsage[];
  messages?: AgentMessage[];
  onArtifactSelect?: (artifact: Artifact) => void;
  onFileSelect?: (file: WorkingFile) => void;
  onToolSelect?: (tool: ToolUsage) => void;
  selectedArtifact?: Artifact | null;
  workingDir?: string;
  isOpen?: boolean;
  onClose?: () => void;
  className?: string;
}

/**
 * Get icon for file based on extension
 */
function getFileIconByExt(ext?: string) {
  if (!ext) return File;
  switch (ext.toLowerCase()) {
    case "html":
    case "htm":
      return FileCode;
    case "js":
    case "jsx":
    case "ts":
    case "tsx":
      return FileCode;
    case "css":
    case "scss":
    case "less":
      return FileCode;
    case "json":
      return FileJson;
    case "md":
    case "markdown":
      return FileText;
    case "csv":
      return Table;
    case "xlsx":
    case "xls":
      return FileSpreadsheet;
    case "pptx":
    case "ppt":
      return Presentation;
    case "docx":
    case "doc":
      return FileText;
    case "pdf":
      return FileText;
    case "png":
    case "jpg":
    case "jpeg":
    case "gif":
    case "svg":
    case "webp":
    case "bmp":
    case "ico":
      return ImageIcon;
    case "mp3":
    case "wav":
    case "ogg":
    case "m4a":
    case "aac":
    case "flac":
      return Music;
    case "mp4":
    case "webm":
    case "mov":
    case "avi":
    case "mkv":
      return Video;
    case "ttf":
    case "otf":
    case "woff":
    case "woff2":
      return TypeIcon;
    case "py":
    case "rb":
    case "go":
    case "rs":
    case "java":
    case "c":
    case "cpp":
    case "h":
      return FileCode;
    default:
      return File;
  }
}

/**
 * Get tool icon based on tool name
 */
function getToolIcon(toolName: string) {
  switch (toolName) {
    case "Bash":
      return Terminal;
    case "Read":
      return FileText;
    case "Write":
    case "Edit":
      return FileEdit;
    case "Grep":
      return Search;
    case "Glob":
      return FolderSearch;
    case "WebFetch":
    case "WebSearch":
      return Globe;
    case "TodoWrite":
      return ListTodo;
    case "Task":
      return Layers;
    case "LSP":
      return Code2;
    default:
      return Wrench;
  }
}

/**
 * Check if a tool is an MCP tool
 */
function isMcpTool(toolName: string): boolean {
  return toolName.startsWith("mcp__");
}

/**
 * Check if a tool is a Skill invocation
 */
function isSkillTool(toolName: string): boolean {
  return toolName === "Skill";
}

/**
 * Get display info for MCP tool
 */
function getMcpToolInfo(toolName: string): { name: string; server: string } {
  if (toolName.startsWith("mcp__")) {
    const parts = toolName.split("__");
    const serverName = parts[1] || "unknown";
    const tool = parts[2] || "";
    return {
      name: tool || serverName,
      server: serverName,
    };
  }
  return { name: toolName, server: "" };
}

/**
 * Extract MCP tools from messages
 */
function extractMcpTools(messages: AgentMessage[]): ToolUsage[] {
  const tools: ToolUsage[] = [];
  const toolUseMessages = messages.filter(
    (m) => m.type === "tool_use" && isMcpTool(m.name || "")
  );
  const toolResultMessages = messages.filter((m) => m.type === "tool_result");

  // Create a map of tool results by toolUseId
  const resultMap = new Map<string, { output: string; isError: boolean }>();
  toolResultMessages.forEach((msg) => {
    if (msg.toolUseId) {
      resultMap.set(msg.toolUseId, {
        output: msg.output || "",
        isError: msg.isError || false,
      });
    }
  });

  toolUseMessages.forEach((msg, index) => {
    const toolName = msg.name || "Unknown";
    const toolId = msg.id || `tool-${index}`;
    const result = resultMap.get(toolId);
    const info = getMcpToolInfo(toolName);

    tools.push({
      id: toolId,
      name: toolName,
      displayName: info.name,
      input: msg.input,
      output: result?.output,
      isError: result?.isError,
      timestamp: Date.now() - (toolUseMessages.length - index) * 1000,
    });
  });

  return tools;
}

/**
 * Extract used skill names from messages
 */
function extractUsedSkillNames(messages: AgentMessage[]): string[] {
  const skillNames = new Set<string>();
  const toolUseMessages = messages.filter(
    (m) => m.type === "tool_use" && isSkillTool(m.name || "")
  );

  toolUseMessages.forEach((msg) => {
    const input = msg.input as Record<string, unknown> | undefined;
    const skillName = input?.skill as string;
    if (skillName) {
      skillNames.add(skillName);
    }
  });

  return Array.from(skillNames);
}

/**
 * Extract external folders from messages (folders outside workingDir that were accessed)
 */
function extractExternalFolders(
  messages: AgentMessage[],
  workingDir?: string
): string[] {
  const foldersSet = new Set<string>();

  // Helper to add folder if it's external
  const addIfExternal = (filePath: string) => {
    const isUnixPath = filePath?.startsWith("/");
    const isWindowsPath = filePath && /^[A-Za-z]:\\/.test(filePath);
    if (!filePath || (!isUnixPath && !isWindowsPath)) return;

    // Get folder path
    const lastSlash = Math.max(filePath.lastIndexOf("/"), filePath.lastIndexOf("\\"));
    const folderPath = lastSlash > 0
      ? filePath.substring(0, lastSlash)
      : (isWindowsPath ? filePath.substring(0, 3) : "/");

    // Only add if it's not within workingDir
    if (folderPath && (!workingDir || !filePath.startsWith(workingDir))) {
      foldersSet.add(folderPath);
    }
  };

  messages.forEach((msg) => {
    if (msg.type !== "tool_use") return;

    const input = msg.input as Record<string, unknown> | undefined;
    if (!input) return;

    switch (msg.name) {
      case "Read":
      case "Write":
      case "Edit": {
        const filePath = input.file_path as string | undefined;
        if (filePath) addIfExternal(filePath);
        break;
      }
      case "Glob":
      case "Grep": {
        const path = input.path as string | undefined;
        if (path) addIfExternal(path);
        break;
      }
    }
  });

  // Deduplicate - remove child folders if parent exists
  const folders = Array.from(foldersSet);
  return folders.filter((folder) => {
    return !folders.some(
      (other) => other !== folder && folder.startsWith(other + "/")
    );
  });
}

/**
 * Get file icon based on artifact type
 */
function getArtifactIcon(type: ArtifactType) {
  switch (type) {
    case "html":
    case "jsx":
    case "css":
    case "code":
      return FileCode;
    case "json":
      return FileJson;
    case "markdown":
    case "document":
    case "pdf":
    case "text":
      return FileText;
    case "csv":
      return Table;
    case "spreadsheet":
      return FileSpreadsheet;
    case "presentation":
      return Presentation;
    case "image":
      return ImageIcon;
    case "audio":
      return Music;
    case "video":
      return Video;
    case "font":
      return TypeIcon;
    case "websearch":
      return Globe;
    default:
      return File;
  }
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
 * Collapsible section component
 */
function CollapsibleSection({
  title,
  icon: Icon,
  children,
  defaultExpanded = true,
  itemCount,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  defaultExpanded?: boolean;
  itemCount?: number;
}) {
  const [isExpanded, setIsExpanded] = React.useState(defaultExpanded);

  return (
    <div className="border-b border-border/50">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between px-4 py-3 hover:bg-accent/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">{title}</span>
          {itemCount !== undefined && itemCount > 0 && (
            <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
              {itemCount}
            </span>
          )}
        </div>
        <span className="text-muted-foreground p-0.5">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </span>
      </button>
      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-300",
          isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        )}
      >
        <div className="overflow-hidden">
          <div className="px-4 pb-3">{children}</div>
        </div>
      </div>
    </div>
  );
}

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
    <div className="flex items-center gap-2 py-2">
      <div className="bg-muted/30 rounded p-1.5">
        <Icon className="h-3.5 w-3.5 text-muted-foreground/40" />
      </div>
      <p className="text-xs text-muted-foreground/60">{description}</p>
    </div>
  );
}

/**
 * Tool Preview Modal Component
 */
function ToolPreviewModal({
  tool,
  onClose,
}: {
  tool: ToolUsage;
  onClose: () => void;
}) {
  const { t } = useTranslation();

  const formatInput = (input: unknown): string => {
    if (!input) return "No input";
    try {
      return JSON.stringify(input, null, 2);
    } catch {
      return String(input);
    }
  };

  const formatOutput = (output: string | undefined): string => {
    if (!output) return "No output";
    if (output.length > 5000) {
      return output.slice(0, 5000) + "\n\n... (truncated)";
    }
    return output;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative flex max-h-[80vh] w-[600px] max-w-[90vw] flex-col rounded-lg border border-border bg-background shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            {(() => {
              const IconComponent = getToolIcon(tool.name);
              return <IconComponent className="h-4 w-4 text-muted-foreground" />;
            })()}
            <span className="font-medium">{tool.displayName}</span>
            {tool.isError && (
              <span className="rounded bg-red-500/10 px-1.5 py-0.5 text-xs text-red-500">
                {t("chat.error")}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 hover:bg-accent transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 space-y-4 overflow-auto p-4">
          {/* Input Section */}
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-2">
              {t("chat.toolInput")}
            </h3>
            <pre className="bg-muted/50 max-h-[200px] overflow-auto rounded-md p-3 text-xs whitespace-pre-wrap break-words">
              {formatInput(tool.input)}
            </pre>
          </div>

          {/* Output Section */}
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-2">
              {t("chat.toolOutput")}
            </h3>
            <pre
              className={cn(
                "max-h-[300px] overflow-auto rounded-md p-3 text-xs whitespace-pre-wrap break-words",
                tool.isError ? "bg-red-500/10 text-red-400" : "bg-muted/50"
              )}
            >
              {formatOutput(tool.output)}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}

export function RightSidebar({
  artifacts,
  workingFiles = [],
  toolUsages,
  messages = [],
  onArtifactSelect,
  onFileSelect,
  onToolSelect,
  selectedArtifact,
  workingDir,
  isOpen = true,
  onClose,
  className,
}: RightSidebarProps) {
  const { t } = useTranslation();
  const [selectedTool, setSelectedTool] = React.useState<ToolUsage | null>(null);
  const [showAllArtifacts, setShowAllArtifacts] = React.useState(false);
  const [showAllTools, setShowAllTools] = React.useState(false);
  const [loadedWorkingFiles, setLoadedWorkingFiles] = React.useState<WorkingFile[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = React.useState(false);
  const [outputExpanded, setOutputExpanded] = React.useState(true);
  const [externalExpanded, setExternalExpanded] = React.useState(true);

  // Load working directory files via Tauri command
  React.useEffect(() => {
    async function loadWorkingDirFiles() {
      if (!workingDir) {
        setLoadedWorkingFiles([]);
        return;
      }

      setIsLoadingFiles(true);
      try {
        const files = await invoke<WorkingFile[]>("read_directory_tree", {
          path: workingDir,
          maxDepth: 3,
        });
        setLoadedWorkingFiles(files || []);
      } catch (error) {
        console.error("Failed to load working directory:", error);
        setLoadedWorkingFiles([]);
      } finally {
        setIsLoadingFiles(false);
      }
    }

    loadWorkingDirFiles();
  }, [workingDir]);

  // Use provided workingFiles or loaded ones
  const displayWorkingFiles = workingFiles.length > 0 ? workingFiles : loadedWorkingFiles;

  // Extract MCP tools from messages or use provided toolUsages
  const mcpTools = messages.length > 0
    ? extractMcpTools(messages)
    : toolUsages.filter(t => isMcpTool(t.name));

  // Extract used skills from messages
  const usedSkills = messages.length > 0
    ? extractUsedSkillNames(messages)
    : [];

  // Extract external folders accessed
  const externalFolders = messages.length > 0
    ? extractExternalFolders(messages, workingDir)
    : [];

  // Artifacts with show more/less
  const visibleArtifacts = showAllArtifacts
    ? artifacts
    : artifacts.slice(0, DEFAULT_VISIBLE_COUNT);
  const hasMoreArtifacts = artifacts.length > DEFAULT_VISIBLE_COUNT;

  // MCP tools with show more/less
  const visibleTools = showAllTools
    ? mcpTools
    : mcpTools.slice(0, DEFAULT_VISIBLE_COUNT);
  const hasMoreTools = mcpTools.length > DEFAULT_VISIBLE_COUNT;

  // Get folder name from path
  const getFolderName = (path: string) => path.split("/").pop() || path;

  // Handle opening folder in system file manager
  const handleOpenFolder = async (folderPath: string) => {
    try {
      await invoke("open_path_in_file_manager", { path: folderPath });
    } catch (error) {
      console.error("Failed to open folder:", error);
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex h-full w-80 flex-col border-l border-border bg-background overflow-hidden",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3 shrink-0">
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

      {/* Scrollable content */}
      <ScrollArea className="flex-1">
        {/* 1. Workspace Section */}
        <CollapsibleSection
          title={t("chat.sidebar.workspace", "Workspace")}
          icon={Folder}
          defaultExpanded={true}
          itemCount={displayWorkingFiles.length + externalFolders.length}
        >
          {/* Output folder subsection */}
          <div className="mb-3">
            <div className="mb-1 flex items-center gap-1">
              <button
                type="button"
                onClick={() => setOutputExpanded(!outputExpanded)}
                className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
              >
                {outputExpanded ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
                <span className="text-xs font-medium">
                  {t("chat.sidebar.outputFolder", "Output Folder")}
                </span>
              </button>
              {workingDir && (
                <button
                  type="button"
                  onClick={() => handleOpenFolder(workingDir)}
                  className="ml-auto p-0.5 text-muted-foreground hover:text-foreground transition-colors"
                  title={t("workspace.openInFinder")}
                >
                  <ExternalLink className="h-3 w-3" />
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
                  <div className="flex items-center gap-2 py-1 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">{t("common.loading")}</span>
                  </div>
                ) : displayWorkingFiles.length === 0 ? (
                  <EmptyState
                    icon={Folder}
                    description={t("chat.sidebar.emptyFolder", "Folder is empty")}
                  />
                ) : (
                  <div className="max-h-[200px] space-y-0.5 overflow-y-auto">
                    {displayWorkingFiles.map((file, idx) => (
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
              <div className="mb-1 flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setExternalExpanded(!externalExpanded)}
                  className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {externalExpanded ? (
                    <ChevronDown className="h-3 w-3" />
                  ) : (
                    <ChevronRight className="h-3 w-3" />
                  )}
                  <span className="text-xs font-medium">
                    {t("chat.sidebar.externalFolders", "External Folders")}
                  </span>
                </button>
              </div>
              {externalExpanded && (
                <div className="space-y-0.5">
                  {externalFolders.map((folder) => (
                    <button
                      key={folder}
                      type="button"
                      onClick={() => handleOpenFolder(folder)}
                      className="flex w-full items-center gap-1.5 rounded-md py-1 pl-2 text-left hover:bg-accent/50 transition-colors"
                    >
                      <FolderOpen className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
                      <span className="truncate text-sm text-foreground/80">
                        {getFolderName(folder)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </CollapsibleSection>

        {/* 2. Artifacts Section */}
        <CollapsibleSection
          title={t("chat.artifacts")}
          icon={Package}
          defaultExpanded={true}
          itemCount={artifacts.length}
        >
          {artifacts.length === 0 ? (
            <EmptyState icon={Package} description={t("chat.noArtifacts")} />
          ) : (
            <>
              <div
                className={cn(
                  "space-y-1",
                  showAllArtifacts && "max-h-[300px] overflow-y-auto"
                )}
              >
                {visibleArtifacts.map((artifact) => {
                  const IconComponent = getArtifactIcon(artifact.type);
                  const isSelected = selectedArtifact?.id === artifact.id;

                  return (
                    <button
                      key={artifact.id}
                      type="button"
                      onClick={() => onArtifactSelect?.(artifact)}
                      className={cn(
                        "flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left transition-colors",
                        isSelected ? "bg-accent/60" : "hover:bg-accent/30"
                      )}
                    >
                      <IconComponent
                        className={cn(
                          "h-3.5 w-3.5 shrink-0",
                          isSelected
                            ? "text-foreground/70"
                            : "text-muted-foreground/60"
                        )}
                      />
                      <span
                        className={cn(
                          "truncate text-sm",
                          isSelected ? "text-foreground" : "text-foreground/80"
                        )}
                      >
                        {artifact.name}
                      </span>
                    </button>
                  );
                })}
              </div>
              {hasMoreArtifacts && (
                <button
                  type="button"
                  onClick={() => setShowAllArtifacts(!showAllArtifacts)}
                  className="w-full py-2 text-center text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showAllArtifacts
                    ? t("chat.sidebar.showLess", "Show less")
                    : t("chat.sidebar.showMore", `Show ${artifacts.length - DEFAULT_VISIBLE_COUNT} more`)}
                </button>
              )}
            </>
          )}
        </CollapsibleSection>

        {/* 3. Tools Section (MCP) */}
        <CollapsibleSection
          title={t("chat.tools")}
          icon={Wrench}
          defaultExpanded={false}
          itemCount={mcpTools.length}
        >
          {mcpTools.length === 0 ? (
            <EmptyState icon={Wrench} description={t("chat.noTools")} />
          ) : (
            <>
              <div
                className={cn(
                  "space-y-1",
                  showAllTools && "max-h-[300px] overflow-y-auto"
                )}
              >
                {visibleTools.map((tool) => {
                  const IconComponent = getToolIcon(tool.name);
                  return (
                    <button
                      key={tool.id}
                      type="button"
                      onClick={() => {
                        setSelectedTool(tool);
                        onToolSelect?.(tool);
                      }}
                      className={cn(
                        "flex w-full items-center gap-1.5 rounded-md py-1 text-left transition-colors",
                        "hover:bg-accent/50",
                        tool.isError && "text-red-400"
                      )}
                    >
                      <IconComponent
                        className={cn(
                          "h-3.5 w-3.5 shrink-0",
                          tool.isError
                            ? "text-red-400"
                            : "text-muted-foreground/60"
                        )}
                      />
                      <span className="truncate text-sm text-foreground/80">
                        {tool.displayName}
                      </span>
                      {tool.isError && (
                        <span className="shrink-0 rounded bg-red-500/10 px-1 py-0.5 text-[10px] text-red-500">
                          {t("chat.error")}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              {hasMoreTools && (
                <button
                  type="button"
                  onClick={() => setShowAllTools(!showAllTools)}
                  className="w-full py-2 text-center text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showAllTools
                    ? t("chat.sidebar.showLess", "Show less")
                    : t("chat.sidebar.showMore", `Show ${mcpTools.length - DEFAULT_VISIBLE_COUNT} more`)}
                </button>
              )}
            </>
          )}
        </CollapsibleSection>

        {/* 4. Skills Section */}
        <CollapsibleSection
          title={t("chat.sidebar.skills", "Skills")}
          icon={Sparkles}
          defaultExpanded={false}
          itemCount={usedSkills.length}
        >
          {usedSkills.length === 0 ? (
            <EmptyState
              icon={Sparkles}
              description={t("chat.sidebar.noSkills", "No skills used")}
            />
          ) : (
            <div className="max-h-[300px] space-y-1 overflow-y-auto">
              {usedSkills.map((skillName) => (
                <div
                  key={skillName}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5"
                >
                  <Sparkles className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
                  <span className="truncate text-sm text-foreground/80">
                    {skillName}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CollapsibleSection>
      </ScrollArea>

      {/* Tool Preview Modal */}
      {selectedTool && (
        <ToolPreviewModal
          tool={selectedTool}
          onClose={() => setSelectedTool(null)}
        />
      )}
    </div>
  );
}
