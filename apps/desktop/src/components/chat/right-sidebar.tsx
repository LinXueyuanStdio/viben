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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type { Artifact, ArtifactType, WorkingFile, ToolUsage, AgentMessage } from "@/types";
import { invoke } from "@tauri-apps/api/core";

// Default number of items to show before "show more"
const DEFAULT_VISIBLE_COUNT = 10;

// Tab types for the sidebar
type SidebarTab = "workspace" | "artifacts" | "tools" | "skills";

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
  /** @deprecated Reserved for future use */
  sessionFolder?: string;
  filesVersion?: number;
  /** @deprecated Reserved for future use */
  isRunning?: boolean;
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
  // Handle MCP tools (mcp__server__tool format)
  const baseName = toolName.startsWith("mcp__")
    ? toolName.split("__")[2] || toolName
    : toolName;

  switch (baseName) {
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
 * Check if a tool is a built-in tool
 */
function isBuiltinTool(toolName: string): boolean {
  const builtinTools = [
    "Bash",
    "Read",
    "Write",
    "Edit",
    "Grep",
    "Glob",
    "WebFetch",
    "WebSearch",
    "TodoWrite",
    "Task",
    "LSP",
    "Skill",
  ];
  return builtinTools.includes(toolName);
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
 * Extract all tools from messages (both built-in and MCP)
 */
function extractAllTools(messages: AgentMessage[]): ToolUsage[] {
  const tools: ToolUsage[] = [];
  const toolUseMessages = messages.filter(
    (m) => m.type === "tool_use" && m.name && !isSkillTool(m.name)
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
      displayName: isMcpTool(toolName) ? info.name : toolName,
      input: msg.input,
      output: result?.output,
      isError: result?.isError,
      timestamp: Date.now() - (toolUseMessages.length - index) * 1000,
    });
  });

  return tools;
}

/**
 * Extract used skill info from messages
 */
interface SkillInfo {
  name: string;
  folder?: string;
  callCount: number;
}

function extractUsedSkills(messages: AgentMessage[]): SkillInfo[] {
  const skillMap = new Map<string, SkillInfo>();
  const toolUseMessages = messages.filter(
    (m) => m.type === "tool_use" && isSkillTool(m.name || "")
  );

  toolUseMessages.forEach((msg) => {
    const input = msg.input as Record<string, unknown> | undefined;
    const skillName = input?.skill as string;
    if (skillName) {
      const existing = skillMap.get(skillName);
      if (existing) {
        existing.callCount++;
      } else {
        // Try to extract folder from skill name (format: folder/skill or just skill)
        const parts = skillName.split("/");
        const folder = parts.length > 1 ? parts[0] : undefined;
        const name = parts.length > 1 ? parts.slice(1).join("/") : skillName;
        skillMap.set(skillName, {
          name,
          folder,
          callCount: 1,
        });
      }
    }
  });

  return Array.from(skillMap.values());
}

/**
 * Group skills by folder
 */
function groupSkillsByFolder(skills: SkillInfo[]): Map<string, SkillInfo[]> {
  const grouped = new Map<string, SkillInfo[]>();

  skills.forEach((skill) => {
    const folder = skill.folder || "root";
    const existing = grouped.get(folder) || [];
    existing.push(skill);
    grouped.set(folder, existing);
  });

  return grouped;
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
            {isMcpTool(tool.name) && (
              <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs text-primary">
                MCP
              </span>
            )}
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

/**
 * Tab trigger with icon and badge
 */
function TabTriggerWithBadge({
  value,
  icon: Icon,
  label,
  count,
}: {
  value: SidebarTab;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  count?: number;
}) {
  return (
    <TabsTrigger
      value={value}
      className="flex items-center gap-1.5 px-2 py-1.5 text-xs data-[state=active]:bg-accent"
    >
      <Icon className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">{label}</span>
      {count !== undefined && count > 0 && (
        <span className="ml-0.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium">
          {count}
        </span>
      )}
    </TabsTrigger>
  );
}

/**
 * Workspace tab content
 */
function WorkspaceTabContent({
  workingDir,
  workingFiles,
  externalFolders,
  isLoadingFiles,
  onFileSelect,
}: {
  workingDir?: string;
  workingFiles: WorkingFile[];
  externalFolders: string[];
  isLoadingFiles: boolean;
  onFileSelect?: (file: WorkingFile) => void;
}) {
  const { t } = useTranslation();
  const [outputExpanded, setOutputExpanded] = React.useState(true);
  const [externalExpanded, setExternalExpanded] = React.useState(true);

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

  return (
    <div className="space-y-4">
      {/* Output folder subsection */}
      <div>
        <div className="mb-2 flex items-center gap-1">
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
              <div className="max-h-[300px] space-y-0.5 overflow-y-auto rounded-md border border-border/30 bg-muted/20 p-2">
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

/**
 * Artifacts tab content
 */
function ArtifactsTabContent({
  artifacts,
  selectedArtifact,
  onArtifactSelect,
}: {
  artifacts: Artifact[];
  selectedArtifact?: Artifact | null;
  onArtifactSelect?: (artifact: Artifact) => void;
}) {
  const { t } = useTranslation();
  const [showAll, setShowAll] = React.useState(false);

  const visibleArtifacts = showAll
    ? artifacts
    : artifacts.slice(0, DEFAULT_VISIBLE_COUNT);
  const hasMore = artifacts.length > DEFAULT_VISIBLE_COUNT;

  if (artifacts.length === 0) {
    return <EmptyState icon={Package} description={t("chat.noArtifacts")} />;
  }

  return (
    <div className="space-y-2">
      <div
        className={cn(
          "space-y-1 rounded-md border border-border/30 bg-muted/20 p-2",
          showAll && "max-h-[400px] overflow-y-auto"
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
                "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors",
                isSelected
                  ? "bg-primary/10 border border-primary/20"
                  : "hover:bg-accent/50"
              )}
            >
              <IconComponent
                className={cn(
                  "h-4 w-4 shrink-0",
                  isSelected
                    ? "text-primary"
                    : "text-muted-foreground/60"
                )}
              />
              <span
                className={cn(
                  "truncate text-sm flex-1",
                  isSelected ? "text-foreground font-medium" : "text-foreground/80"
                )}
              >
                {artifact.name}
              </span>
            </button>
          );
        })}
      </div>
      {hasMore && (
        <button
          type="button"
          onClick={() => setShowAll(!showAll)}
          className="w-full py-1.5 text-center text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {showAll
            ? t("chat.sidebar.showLess", "Show less")
            : t("chat.sidebar.showMore", `Show ${artifacts.length - DEFAULT_VISIBLE_COUNT} more`)}
        </button>
      )}
    </div>
  );
}

/**
 * Tools tab content
 */
function ToolsTabContent({
  tools,
  onToolSelect,
}: {
  tools: ToolUsage[];
  onToolSelect?: (tool: ToolUsage) => void;
}) {
  const { t } = useTranslation();

  // Group tools by type (MCP vs Built-in)
  const mcpTools = tools.filter((t) => isMcpTool(t.name));
  const builtinTools = tools.filter((t) => isBuiltinTool(t.name));

  if (tools.length === 0) {
    return <EmptyState icon={Wrench} description={t("chat.noTools")} />;
  }

  // Count tools by name for display
  const toolCounts = tools.reduce((acc, tool) => {
    const key = tool.displayName;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-3">
      {/* MCP Tools Section */}
      {mcpTools.length > 0 && (
        <div>
          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <span className="rounded bg-primary/10 px-1.5 py-0.5 text-primary">MCP</span>
            <span>{mcpTools.length} calls</span>
          </div>
          <div className="space-y-1 rounded-md border border-border/30 bg-muted/20 p-2 max-h-[250px] overflow-y-auto">
            {Array.from(new Map(mcpTools.map((t) => [t.displayName, t])).values()).map((tool) => {
              const IconComponent = getToolIcon(tool.name);
              const count = toolCounts[tool.displayName];
              const info = getMcpToolInfo(tool.name);
              return (
                <button
                  key={tool.id}
                  type="button"
                  onClick={() => onToolSelect?.(tool)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md py-1.5 px-2 text-left transition-colors",
                    "hover:bg-accent/50",
                    tool.isError && "text-red-400"
                  )}
                >
                  <IconComponent
                    className={cn(
                      "h-3.5 w-3.5 shrink-0",
                      tool.isError ? "text-red-400" : "text-muted-foreground/60"
                    )}
                  />
                  <div className="flex-1 min-w-0">
                    <span className="truncate text-sm text-foreground/80 block">
                      {tool.displayName}
                    </span>
                    <span className="text-[10px] text-muted-foreground/60">
                      {info.server}
                    </span>
                  </div>
                  {count > 1 && (
                    <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      x{count}
                    </span>
                  )}
                  {tool.isError && (
                    <span className="shrink-0 rounded bg-red-500/10 px-1 py-0.5 text-[10px] text-red-500">
                      {t("chat.error")}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Built-in Tools Section */}
      {builtinTools.length > 0 && (
        <div>
          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <span className="rounded bg-muted px-1.5 py-0.5">Built-in</span>
            <span>{builtinTools.length} calls</span>
          </div>
          <div className="space-y-1 rounded-md border border-border/30 bg-muted/20 p-2 max-h-[250px] overflow-y-auto">
            {Array.from(new Map(builtinTools.map((t) => [t.displayName, t])).values()).map((tool) => {
              const IconComponent = getToolIcon(tool.name);
              const count = toolCounts[tool.displayName];
              return (
                <button
                  key={tool.id}
                  type="button"
                  onClick={() => onToolSelect?.(tool)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md py-1.5 px-2 text-left transition-colors",
                    "hover:bg-accent/50",
                    tool.isError && "text-red-400"
                  )}
                >
                  <IconComponent
                    className={cn(
                      "h-3.5 w-3.5 shrink-0",
                      tool.isError ? "text-red-400" : "text-muted-foreground/60"
                    )}
                  />
                  <span className="truncate text-sm text-foreground/80 flex-1">
                    {tool.displayName}
                  </span>
                  {count > 1 && (
                    <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      x{count}
                    </span>
                  )}
                  {tool.isError && (
                    <span className="shrink-0 rounded bg-red-500/10 px-1 py-0.5 text-[10px] text-red-500">
                      {t("chat.error")}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Skills tab content
 */
function SkillsTabContent({ skills }: { skills: SkillInfo[] }) {
  const { t } = useTranslation();

  if (skills.length === 0) {
    return (
      <EmptyState
        icon={Sparkles}
        description={t("chat.sidebar.noSkills", "No skills used")}
      />
    );
  }

  const groupedSkills = groupSkillsByFolder(skills);

  return (
    <div className="space-y-3">
      {Array.from(groupedSkills.entries()).map(([folder, folderSkills]) => (
        <div key={folder}>
          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Folder className="h-3 w-3" />
            <span>{folder === "root" ? "Root" : folder}</span>
          </div>
          <div className="space-y-1 rounded-md border border-border/30 bg-muted/20 p-2">
            {folderSkills.map((skill, idx) => (
              <div
                key={`${skill.name}-${idx}`}
                className="flex items-center gap-2 rounded-md py-1.5 px-2"
              >
                <Sparkles className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                <span className="truncate text-sm text-foreground/80 flex-1">
                  {skill.name}
                </span>
                {skill.callCount > 1 && (
                  <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    x{skill.callCount}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
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
  filesVersion,
  isOpen = true,
  onClose,
  className,
}: RightSidebarProps) {
  const { t } = useTranslation();
  const [selectedTool, setSelectedTool] = React.useState<ToolUsage | null>(null);
  const [loadedWorkingFiles, setLoadedWorkingFiles] = React.useState<WorkingFile[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<SidebarTab>("workspace");

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
  }, [workingDir, filesVersion]);

  // Use provided workingFiles or loaded ones
  const displayWorkingFiles = workingFiles.length > 0 ? workingFiles : loadedWorkingFiles;

  // Extract all tools from messages
  const allTools = messages.length > 0
    ? extractAllTools(messages)
    : toolUsages;

  // Extract used skills from messages
  const usedSkills = messages.length > 0
    ? extractUsedSkills(messages)
    : [];

  // Extract external folders accessed
  const externalFolders = messages.length > 0
    ? extractExternalFolders(messages, workingDir)
    : [];

  // Count items for badges
  const workspaceCount = displayWorkingFiles.length + externalFolders.length;
  const artifactsCount = artifacts.length;
  const toolsCount = allTools.length;
  const skillsCount = usedSkills.length;

  // Auto-expand sidebar if there's content and switch to relevant tab
  React.useEffect(() => {
    if (artifactsCount > 0 && activeTab === "workspace" && workspaceCount === 0) {
      setActiveTab("artifacts");
    } else if (toolsCount > 0 && activeTab === "workspace" && workspaceCount === 0 && artifactsCount === 0) {
      setActiveTab("tools");
    }
  }, [artifactsCount, toolsCount, workspaceCount, activeTab]);

  // Handle tool selection
  const handleToolSelect = (tool: ToolUsage) => {
    setSelectedTool(tool);
    onToolSelect?.(tool);
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
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5 shrink-0">
        <h3 className="font-serif font-semibold text-foreground text-sm">
          {t("chat.sidebar")}
        </h3>
        {onClose && (
          <Button variant="ghost" size="icon" onClick={onClose} className="h-7 w-7">
            <X className="h-4 w-4" />
            <span className="sr-only">{t("common.close")}</span>
          </Button>
        )}
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as SidebarTab)}
        className="flex-1 flex flex-col overflow-hidden"
      >
        <div className="border-b border-border px-2 py-1.5 shrink-0">
          <TabsList className="w-full justify-start gap-0.5 border-0 bg-transparent p-0">
            <TabTriggerWithBadge
              value="workspace"
              icon={Folder}
              label={t("chat.sidebar.workspace", "Workspace")}
              count={workspaceCount}
            />
            <TabTriggerWithBadge
              value="artifacts"
              icon={Package}
              label={t("chat.artifacts")}
              count={artifactsCount}
            />
            <TabTriggerWithBadge
              value="tools"
              icon={Wrench}
              label={t("chat.tools")}
              count={toolsCount}
            />
            <TabTriggerWithBadge
              value="skills"
              icon={Sparkles}
              label={t("chat.sidebar.skills", "Skills")}
              count={skillsCount}
            />
          </TabsList>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-3">
            <TabsContent value="workspace" className="mt-0">
              <WorkspaceTabContent
                workingDir={workingDir}
                workingFiles={displayWorkingFiles}
                externalFolders={externalFolders}
                isLoadingFiles={isLoadingFiles}
                onFileSelect={onFileSelect}
              />
            </TabsContent>

            <TabsContent value="artifacts" className="mt-0">
              <ArtifactsTabContent
                artifacts={artifacts}
                selectedArtifact={selectedArtifact}
                onArtifactSelect={onArtifactSelect}
              />
            </TabsContent>

            <TabsContent value="tools" className="mt-0">
              <ToolsTabContent
                tools={allTools}
                onToolSelect={handleToolSelect}
              />
            </TabsContent>

            <TabsContent value="skills" className="mt-0">
              <SkillsTabContent skills={usedSkills} />
            </TabsContent>
          </div>
        </ScrollArea>
      </Tabs>

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
