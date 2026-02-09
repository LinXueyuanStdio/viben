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
  GripVertical,
  Users,
  User,
  Bot,
  Crown,
  Shield,
  UserMinus,
  UserPlus,
  Pencil,
  Check,
  Calendar,
  LogOut,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { Artifact, ArtifactType, WorkingFile, ToolUsage, AgentMessage } from "@/types";
import type {
  GroupChat,
  GroupChatMember,
  MemberType,
  MemberRole,
  AddMemberRequest,
} from "@/lib/gateway";
import { invoke } from "@tauri-apps/api/core";

// Default number of items to show before "show more"
const DEFAULT_VISIBLE_COUNT = 10;

/**
 * Resize handle component for sidebar
 */
function ResizeHandle({
  onResize,
}: {
  onResize: (delta: number) => void;
}) {
  const [isDragging, setIsDragging] = React.useState(false);
  const startXRef = React.useRef(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    startXRef.current = e.clientX;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const delta = startXRef.current - moveEvent.clientX;
      startXRef.current = moveEvent.clientX;
      onResize(delta);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  return (
    <div
      className={cn(
        "group absolute left-0 top-0 bottom-0 w-1 cursor-col-resize z-10",
        "flex items-center justify-center",
        isDragging && "bg-primary/30"
      )}
      onMouseDown={handleMouseDown}
    >
      {/* Hover/drag indicator line */}
      <div
        className={cn(
          "absolute inset-y-0 w-0.5 transition-colors",
          isDragging ? "bg-primary" : "bg-transparent group-hover:bg-border"
        )}
      />
      {/* Grip handle */}
      <div
        className={cn(
          "absolute flex items-center justify-center w-4 h-8 rounded-md transition-all",
          isDragging
            ? "bg-primary text-primary-foreground"
            : "bg-muted/80 text-muted-foreground opacity-0 group-hover:opacity-100"
        )}
      >
        <GripVertical className="h-4 w-4" />
      </div>
    </div>
  );
}

// Tab types for the sidebar
type SidebarTab = "workspace" | "artifacts" | "tools" | "skills" | "groupChat";

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
  /** Custom width in pixels */
  width?: number;
  /** Callback when resize handle is dragged */
  onResize?: (delta: number) => void;
  // Group Chat props
  /** Group chat data - when provided, shows the group chat tab */
  groupChat?: GroupChat | null;
  /** Members of the current group chat */
  groupChatMembers?: GroupChatMember[];
  /** Available agents that can be added to the group */
  availableAgents?: Array<{ id: string; name: string }>;
  /** Current user's member ID */
  currentUserId?: string;
  /** Current user's role in the group */
  currentUserRole?: MemberRole;
  /** Called when a member is added */
  onAddMember?: (member: AddMemberRequest) => Promise<void>;
  /** Called when a member is removed */
  onRemoveMember?: (memberId: string) => Promise<void>;
  /** Called when the group chat is updated */
  onUpdateGroupChat?: (data: { name?: string; description?: string }) => Promise<void>;
  /** Called when the user leaves the group */
  onLeaveGroupChat?: () => Promise<void>;
  /** Called when the group is deleted */
  onDeleteGroupChat?: () => Promise<void>;
  /** Whether group chat operations are loading */
  isGroupChatLoading?: boolean;
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

// ============================================================================
// Tab Types
// ============================================================================

interface OpenTab {
  id: string;
  type: "category" | "artifact" | "tool";
  category?: SidebarTab;
  artifact?: Artifact;
  tool?: ToolUsage;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

/**
 * VS Code style tab component
 */
function EditorTab({
  tab,
  isActive,
  onClick,
  onClose,
  count,
}: {
  tab: OpenTab;
  isActive: boolean;
  onClick: () => void;
  onClose?: () => void;
  count?: number;
}) {
  const Icon = tab.icon;

  return (
    <button
      type="button"
      className={cn(
        "group relative flex items-center gap-2 px-3 py-2 text-xs font-medium transition-all cursor-pointer",
        "border-b-2 -mb-[2px]",
        isActive
          ? "border-primary text-foreground bg-background"
          : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30"
      )}
      onClick={onClick}
    >
      <Icon className={cn(
        "h-4 w-4 shrink-0 transition-colors",
        isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
      )} />
      <span className="truncate max-w-20">{tab.label}</span>
      {count !== undefined && count > 0 && tab.type === "category" && (
        <span
          className={cn(
            "min-w-[18px] h-[18px] rounded-full px-1.5 text-[10px] font-semibold flex items-center justify-center",
            isActive
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground"
          )}
        >
          {count}
        </span>
      )}
      {tab.tool?.isError && (
        <span className="w-2 h-2 rounded-full bg-destructive shrink-0 animate-pulse" />
      )}
      {onClose && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className={cn(
            "p-0.5 rounded-sm hover:bg-accent transition-colors ml-auto",
            isActive ? "opacity-70 hover:opacity-100" : "opacity-0 group-hover:opacity-70 hover:!opacity-100"
          )}
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </button>
  );
}

/**
 * Artifact preview content
 */
function ArtifactPreview({ artifact }: { artifact: Artifact }) {
  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        {(() => {
          const IconComponent = getArtifactIcon(artifact.type);
          return <IconComponent className="h-5 w-5 text-muted-foreground" />;
        })()}
        <div>
          <h3 className="font-medium">{artifact.name}</h3>
          <p className="text-xs text-muted-foreground">{artifact.type}</p>
        </div>
      </div>
      {artifact.content && (
        <pre className="bg-muted/50 rounded-lg p-3 text-xs overflow-auto max-h-[calc(100vh-300px)] whitespace-pre-wrap break-words font-mono">
          {artifact.content}
        </pre>
      )}
    </div>
  );
}

/**
 * Tool preview content
 */
function ToolPreview({ tool }: { tool: ToolUsage }) {
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
    if (output.length > 10000) {
      return output.slice(0, 10000) + "\n\n... (truncated)";
    }
    return output;
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        {(() => {
          const IconComponent = getToolIcon(tool.name);
          return <IconComponent className="h-5 w-5 text-muted-foreground" />;
        })()}
        <div className="flex items-center gap-2">
          <h3 className="font-medium">{tool.displayName}</h3>
          {isMcpTool(tool.name) && (
            <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
              MCP
            </span>
          )}
          {tool.isError && (
            <span className="rounded bg-red-500/10 px-1.5 py-0.5 text-[10px] text-red-500">
              {t("chat.error")}
            </span>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <h4 className="text-xs font-medium text-muted-foreground mb-2">{t("chat.toolInput")}</h4>
          <pre className="bg-muted/50 rounded-lg p-3 text-xs overflow-auto max-h-[200px] whitespace-pre-wrap break-words font-mono">
            {formatInput(tool.input)}
          </pre>
        </div>
        <div>
          <h4 className="text-xs font-medium text-muted-foreground mb-2">{t("chat.toolOutput")}</h4>
          <pre
            className={cn(
              "bg-muted/50 rounded-lg p-3 text-xs overflow-auto max-h-[calc(100vh-400px)] whitespace-pre-wrap break-words font-mono",
              tool.isError && "bg-red-500/10 text-red-400"
            )}
          >
            {formatOutput(tool.output)}
          </pre>
        </div>
      </div>
    </div>
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
  const getFolderName = (path: string) => path.split(/[\\/]/).pop() || path;

  // Handle opening folder in system file manager
  const handleOpenFolder = async (folderPath: string) => {
    try {
      await invoke("open_path_in_file_manager", { path: folderPath });
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

// ============================================================================
// Group Chat Tab Content
// ============================================================================

/**
 * Get icon for member type
 */
function getMemberTypeIcon(type: MemberType) {
  switch (type) {
    case "human":
      return User;
    case "agent":
      return Bot;
    case "executor":
      return Terminal;
    default:
      return User;
  }
}

/**
 * Get role icon
 */
function getRoleIcon(role: MemberRole) {
  switch (role) {
    case "owner":
      return Crown;
    case "admin":
      return Shield;
    default:
      return null;
  }
}

/**
 * Check if user can manage members
 */
function canManageMembers(role?: MemberRole): boolean {
  return role === "owner" || role === "admin";
}

/**
 * Check if user can remove a specific member
 */
function canRemoveMember(
  currentUserRole?: MemberRole,
  targetMemberRole?: MemberRole,
  targetMemberId?: string,
  currentUserId?: string
): boolean {
  if (targetMemberId === currentUserId) return false;
  if (currentUserRole === "owner") return true;
  if (currentUserRole === "admin" && targetMemberRole === "member") return true;
  return false;
}

/**
 * Format date string to localized format
 */
function formatGroupChatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Editable field component for inline editing
 */
interface EditableFieldProps {
  value: string;
  onSave: (value: string) => Promise<void>;
  placeholder?: string;
  multiline?: boolean;
  className?: string;
  inputClassName?: string;
  disabled?: boolean;
}

function EditableField({
  value,
  onSave,
  placeholder,
  multiline = false,
  className,
  inputClassName,
  disabled = false,
}: EditableFieldProps) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [editValue, setEditValue] = React.useState(value);
  const [isSaving, setIsSaving] = React.useState(false);

  const handleSave = async () => {
    if (editValue.trim() === value) {
      setIsEditing(false);
      return;
    }
    setIsSaving(true);
    try {
      await onSave(editValue.trim());
      setIsEditing(false);
    } catch (error) {
      console.error("[EditableField] Save failed:", error);
      setEditValue(value);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditValue(value);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !multiline) {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      handleCancel();
    }
  };

  React.useEffect(() => {
    setEditValue(value);
  }, [value]);

  if (isEditing) {
    return (
      <div className={cn("flex items-start gap-1", className)}>
        {multiline ? (
          <Textarea
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className={cn("min-h-[60px] resize-none text-sm", inputClassName)}
            autoFocus
            disabled={isSaving}
          />
        ) : (
          <Input
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className={cn("h-8 text-sm", inputClassName)}
            autoFocus
            disabled={isSaving}
          />
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={handleSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Check className="h-4 w-4" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={handleCancel}
          disabled={isSaving}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "group flex items-start gap-1 cursor-pointer rounded-md hover:bg-muted/50 transition-colors -mx-1 px-1",
        disabled && "cursor-default hover:bg-transparent",
        className
      )}
      onClick={() => !disabled && setIsEditing(true)}
    >
      <span className={cn("flex-1", !value && "text-muted-foreground")}>
        {value || placeholder}
      </span>
      {!disabled && (
        <Pencil className="h-3.5 w-3.5 opacity-0 group-hover:opacity-50 shrink-0 mt-0.5" />
      )}
    </div>
  );
}

/**
 * Member list item for group chat
 */
interface GroupChatMemberListItemProps {
  member: GroupChatMember;
  isCurrentUser: boolean;
  canRemove: boolean;
  onRemove?: () => void;
  isRemoving?: boolean;
}

function GroupChatMemberListItem({
  member,
  isCurrentUser,
  canRemove,
  onRemove,
  isRemoving,
}: GroupChatMemberListItemProps) {
  const { t } = useTranslation();
  const TypeIcon = getMemberTypeIcon(member.member_type);
  const RoleIcon = getRoleIcon(member.role);

  const getAvatarGradient = () => {
    const colors = [
      "from-blue-500 to-cyan-400",
      "from-purple-500 to-pink-400",
      "from-green-500 to-emerald-400",
      "from-orange-500 to-yellow-400",
      "from-red-500 to-rose-400",
      "from-indigo-500 to-violet-400",
    ];
    const index = (member.display_name?.charCodeAt(0) || 0) % colors.length;
    return colors[index];
  };

  return (
    <div className="flex items-center gap-2 p-1.5 rounded-md hover:bg-muted/50 transition-colors">
      <div
        className={cn(
          "relative shrink-0 w-7 h-7 rounded-full flex items-center justify-center bg-gradient-to-br shadow-sm",
          getAvatarGradient()
        )}
      >
        <TypeIcon className="h-3.5 w-3.5 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <span className="font-medium text-xs truncate">
            {member.display_name}
          </span>
          {isCurrentUser && (
            <span className="text-[9px] px-1 py-0.5 rounded bg-primary/10 text-primary">
              {t("common.you", "You")}
            </span>
          )}
          {RoleIcon && (
            <RoleIcon
              className={cn(
                "h-2.5 w-2.5",
                member.role === "owner" ? "text-yellow-500" : "text-blue-500"
              )}
            />
          )}
        </div>
      </div>
      {canRemove && onRemove && (
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground hover:text-destructive"
          onClick={onRemove}
          disabled={isRemoving}
        >
          {isRemoving ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <UserMinus className="h-3 w-3" />
          )}
        </Button>
      )}
    </div>
  );
}

/**
 * Add member section for group chat
 */
interface AddMemberSectionProps {
  availableAgents: Array<{ id: string; name: string }>;
  existingMemberIds: string[];
  onAdd: (member: AddMemberRequest) => Promise<void>;
  isLoading?: boolean;
}

function GroupChatAddMemberSection({
  availableAgents,
  existingMemberIds,
  onAdd,
  isLoading,
}: AddMemberSectionProps) {
  const { t } = useTranslation();
  const [selectedAgentId, setSelectedAgentId] = React.useState<string>("");
  const [isAdding, setIsAdding] = React.useState(false);

  const availableToAdd = availableAgents.filter(
    (agent) => !existingMemberIds.includes(agent.id)
  );

  const handleAdd = async () => {
    if (!selectedAgentId) return;
    const agent = availableAgents.find((a) => a.id === selectedAgentId);
    if (!agent) return;

    setIsAdding(true);
    try {
      const memberRequest: AddMemberRequest = {
        member_type: "agent",
        member_id: agent.id,
        display_name: agent.name,
        role: "member",
      };
      await onAdd(memberRequest);
      setSelectedAgentId("");
    } finally {
      setIsAdding(false);
    }
  };

  if (availableAgents.length === 0) {
    return (
      <p className="text-xs text-muted-foreground text-center py-2">
        {t("groupChat.noAgentsAvailable", "No agents available")}
      </p>
    );
  }

  if (availableToAdd.length === 0) {
    return (
      <p className="text-xs text-muted-foreground text-center py-2">
        {t("groupChat.allAgentsAdded", "All agents are already members")}
      </p>
    );
  }

  return (
    <div className="flex gap-1.5">
      <Select
        value={selectedAgentId}
        onValueChange={setSelectedAgentId}
        disabled={isLoading || isAdding}
      >
        <SelectTrigger className="flex-1 h-8 text-xs">
          <SelectValue placeholder={t("groupChat.selectAgent", "Select agent...")} />
        </SelectTrigger>
        <SelectContent>
          {availableToAdd.map((agent) => (
            <SelectItem key={agent.id} value={agent.id}>
              <div className="flex items-center gap-2">
                <Bot className="h-3.5 w-3.5" />
                <span className="text-xs">{agent.name}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        size="sm"
        onClick={handleAdd}
        disabled={!selectedAgentId || isLoading || isAdding}
        className="h-8 px-2"
      >
        {isAdding ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <UserPlus className="h-3.5 w-3.5" />
        )}
      </Button>
    </div>
  );
}

/**
 * Group Chat tab content
 */
interface GroupChatTabContentProps {
  groupChat: GroupChat;
  members: GroupChatMember[];
  availableAgents: Array<{ id: string; name: string }>;
  currentUserId: string;
  currentUserRole?: MemberRole;
  onAddMember: (member: AddMemberRequest) => Promise<void>;
  onRemoveMember: (memberId: string) => Promise<void>;
  onUpdateGroupChat: (data: { name?: string; description?: string }) => Promise<void>;
  onLeaveGroup: () => Promise<void>;
  onDeleteGroup: () => Promise<void>;
  isLoading?: boolean;
}

function GroupChatTabContent({
  groupChat,
  members,
  availableAgents,
  currentUserId,
  currentUserRole,
  onAddMember,
  onRemoveMember,
  onUpdateGroupChat,
  onLeaveGroup,
  onDeleteGroup,
  isLoading,
}: GroupChatTabContentProps) {
  const { t } = useTranslation();
  const [removingMemberId, setRemovingMemberId] = React.useState<string | null>(null);
  const [isLeaveDialogOpen, setIsLeaveDialogOpen] = React.useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [isLeavingOrDeleting, setIsLeavingOrDeleting] = React.useState(false);

  const handleRemoveMember = async (memberId: string) => {
    setRemovingMemberId(memberId);
    try {
      await onRemoveMember(memberId);
    } finally {
      setRemovingMemberId(null);
    }
  };

  const handleUpdateName = async (name: string) => {
    await onUpdateGroupChat({ name });
  };

  const handleUpdateDescription = async (description: string) => {
    await onUpdateGroupChat({ description });
  };

  const handleLeaveGroup = async () => {
    setIsLeavingOrDeleting(true);
    try {
      await onLeaveGroup();
      setIsLeaveDialogOpen(false);
    } finally {
      setIsLeavingOrDeleting(false);
    }
  };

  const handleDeleteGroup = async () => {
    setIsLeavingOrDeleting(true);
    try {
      await onDeleteGroup();
      setIsDeleteDialogOpen(false);
    } finally {
      setIsLeavingOrDeleting(false);
    }
  };

  const sortedMembers = React.useMemo(() => {
    return [...members].sort((a, b) => {
      const roleOrder = { owner: 0, admin: 1, member: 2 };
      return roleOrder[a.role] - roleOrder[b.role];
    });
  }, [members]);

  const existingMemberIds = members.map((m) => m.member_id);
  const isOwner = currentUserRole === "owner";

  const getGroupAvatarGradient = () => {
    const colors = [
      "from-purple-500 to-pink-400",
      "from-blue-500 to-cyan-400",
      "from-green-500 to-emerald-400",
      "from-orange-500 to-yellow-400",
    ];
    const index = (groupChat.name?.charCodeAt(0) || 0) % colors.length;
    return colors[index];
  };

  return (
    <>
      <div className="space-y-4">
        {/* Group Info Section */}
        <div className="flex flex-col items-center text-center space-y-2">
          <div
            className={cn(
              "w-12 h-12 rounded-lg flex items-center justify-center bg-gradient-to-br shadow-md",
              getGroupAvatarGradient()
            )}
          >
            <Users className="h-6 w-6 text-white" />
          </div>
          <div className="w-full">
            <EditableField
              value={groupChat.name}
              onSave={handleUpdateName}
              placeholder={t("groupChat.namePlaceholder", "Group name")}
              className="justify-center text-base font-semibold"
              disabled={!canManageMembers(currentUserRole)}
            />
          </div>
          <div className="w-full">
            <EditableField
              value={groupChat.description || ""}
              onSave={handleUpdateDescription}
              placeholder={t("groupChat.descriptionPlaceholder", "Add a description...")}
              multiline
              className="text-xs text-muted-foreground justify-center"
              disabled={!canManageMembers(currentUserRole)}
            />
          </div>
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Calendar className="h-3 w-3" />
            <span>
              {t("groupChat.created", "Created")} {formatGroupChatDate(groupChat.created_at)}
            </span>
          </div>
        </div>

        <Separator />

        {/* Members Section */}
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-muted-foreground">
            {t("groupChat.members", "Members")} ({members.length})
          </h4>
          <div className="space-y-0.5 rounded-md border border-border/30 bg-muted/20 p-1.5 max-h-[200px] overflow-y-auto">
            {sortedMembers.map((member) => (
              <GroupChatMemberListItem
                key={member.id}
                member={member}
                isCurrentUser={member.member_id === currentUserId}
                canRemove={canRemoveMember(
                  currentUserRole,
                  member.role,
                  member.member_id,
                  currentUserId
                )}
                onRemove={() => handleRemoveMember(member.id)}
                isRemoving={removingMemberId === member.id}
              />
            ))}
          </div>

          {/* Add Member Section */}
          {canManageMembers(currentUserRole) && (
            <div className="space-y-1.5 pt-1">
              <h4 className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <UserPlus className="h-3 w-3" />
                {t("groupChat.addMembers", "Add Agent")}
              </h4>
              <GroupChatAddMemberSection
                availableAgents={availableAgents}
                existingMemberIds={existingMemberIds}
                onAdd={onAddMember}
                isLoading={isLoading}
              />
            </div>
          )}
        </div>

        <Separator />

        {/* Actions */}
        <div className="space-y-1.5">
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start text-xs text-muted-foreground hover:text-foreground h-8"
            onClick={() => setIsLeaveDialogOpen(true)}
          >
            <LogOut className="h-3.5 w-3.5 mr-2" />
            {t("groupChat.leave", "Leave Group")}
          </Button>
          {isOwner && (
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start text-xs text-destructive hover:text-destructive hover:bg-destructive/10 h-8"
              onClick={() => setIsDeleteDialogOpen(true)}
            >
              <Trash2 className="h-3.5 w-3.5 mr-2" />
              {t("groupChat.delete", "Delete Group")}
            </Button>
          )}
        </div>
      </div>

      {/* Leave Group Confirmation Dialog */}
      <AlertDialog open={isLeaveDialogOpen} onOpenChange={setIsLeaveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("groupChat.leaveConfirmTitle", "Leave Group?")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                "groupChat.leaveConfirmDesc",
                "Are you sure you want to leave this group? You will no longer receive messages from this group."
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLeavingOrDeleting}>
              {t("common.cancel", "Cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleLeaveGroup}
              disabled={isLeavingOrDeleting}
            >
              {isLeavingOrDeleting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {t("groupChat.leave", "Leave Group")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Group Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("groupChat.deleteConfirmTitle", "Delete Group?")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                "groupChat.deleteConfirmDesc",
                "Are you sure you want to delete this group? This action cannot be undone and all messages will be lost."
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLeavingOrDeleting}>
              {t("common.cancel", "Cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteGroup}
              disabled={isLeavingOrDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isLeavingOrDeleting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {t("groupChat.delete", "Delete Group")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
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
  workingDir,
  filesVersion,
  isOpen = true,
  onClose,
  className,
  width,
  onResize,
  // Group chat props
  groupChat,
  groupChatMembers = [],
  availableAgents = [],
  currentUserId = "",
  currentUserRole,
  onAddMember,
  onRemoveMember,
  onUpdateGroupChat,
  onLeaveGroupChat,
  onDeleteGroupChat,
  isGroupChatLoading,
}: RightSidebarProps) {
  const { t } = useTranslation();
  const [loadedWorkingFiles, setLoadedWorkingFiles] = React.useState<WorkingFile[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<SidebarTab>("workspace");

  // Load working directory files via Tauri command
  // Note: read_directory_tree command is not implemented yet, using fs API instead
  React.useEffect(() => {
    async function loadWorkingDirFiles() {
      if (!workingDir) {
        setLoadedWorkingFiles([]);
        return;
      }

      setIsLoadingFiles(true);
      try {
        // Use Tauri fs plugin to read directory
        const { readDir } = await import("@tauri-apps/plugin-fs");
        const entries = await readDir(workingDir);

        // Convert to WorkingFile format
        const files: WorkingFile[] = entries.map((entry) => ({
          name: entry.name,
          path: `${workingDir}/${entry.name}`,
          isDir: entry.isDirectory,
        }));

        // Sort: directories first, then files, alphabetically
        files.sort((a, b) => {
          if (a.isDir && !b.isDir) return -1;
          if (!a.isDir && b.isDir) return 1;
          return a.name.localeCompare(b.name);
        });

        setLoadedWorkingFiles(files);
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
  const groupChatMembersCount = groupChatMembers.length;

  // Auto-expand sidebar if there's content and switch to relevant tab
  React.useEffect(() => {
    if (artifactsCount > 0 && activeTab === "workspace" && workspaceCount === 0) {
      setActiveTab("artifacts");
    } else if (toolsCount > 0 && activeTab === "workspace" && workspaceCount === 0 && artifactsCount === 0) {
      setActiveTab("tools");
    }
  }, [artifactsCount, toolsCount, workspaceCount, activeTab]);

  // Open tabs state - includes category tabs and opened preview tabs
  const [openTabs, setOpenTabs] = React.useState<OpenTab[]>([]);
  const [activeTabId, setActiveTabId] = React.useState<string>("workspace");

  // Track previous groupChat to detect when it changes
  const prevGroupChatRef = React.useRef<GroupChat | null | undefined>(undefined);

  // Initialize category tabs - dynamically include group chat tab when available
  React.useEffect(() => {
    const baseTabs: OpenTab[] = [
      { id: "workspace", type: "category", category: "workspace", label: t("chat.sidebar.workspace", "Workspace"), icon: Folder },
      { id: "artifacts", type: "category", category: "artifacts", label: t("chat.artifacts"), icon: Package },
      { id: "tools", type: "category", category: "tools", label: t("chat.tools"), icon: Wrench },
      { id: "skills", type: "category", category: "skills", label: t("chat.sidebar.skills", "Skills"), icon: Sparkles },
    ];

    // Add group chat tab at the beginning if group chat is available
    if (groupChat) {
      baseTabs.unshift({
        id: "groupChat",
        type: "category",
        category: "groupChat",
        label: t("groupChat.details", "Group"),
        icon: Users,
      });
    }

    setOpenTabs(baseTabs);

    // Auto-switch to groupChat tab when groupChat becomes available (or changes to a different group)
    if (groupChat && (!prevGroupChatRef.current || prevGroupChatRef.current.id !== groupChat.id)) {
      setActiveTabId("groupChat");
    } else if (!groupChat && prevGroupChatRef.current) {
      // Switch away from groupChat tab when groupChat is removed
      setActiveTabId("workspace");
    }

    prevGroupChatRef.current = groupChat;
  }, [t, groupChat]);

  // Handle artifact selection - open as new tab
  const handleArtifactSelectWithPreview = (artifact: Artifact) => {
    const tabId = `artifact-${artifact.id}`;
    const existingTab = openTabs.find((tab) => tab.id === tabId);

    if (!existingTab) {
      const newTab: OpenTab = {
        id: tabId,
        type: "artifact",
        artifact,
        label: artifact.name,
        icon: getArtifactIcon(artifact.type),
      };
      setOpenTabs([...openTabs, newTab]);
    }
    setActiveTabId(tabId);
    onArtifactSelect?.(artifact);
  };

  // Handle tool selection - open as new tab
  const handleToolSelectWithPreview = (tool: ToolUsage) => {
    const tabId = `tool-${tool.id}`;
    const existingTab = openTabs.find((tab) => tab.id === tabId);

    if (!existingTab) {
      const newTab: OpenTab = {
        id: tabId,
        type: "tool",
        tool,
        label: tool.displayName,
        icon: getToolIcon(tool.name),
      };
      setOpenTabs([...openTabs, newTab]);
    }
    setActiveTabId(tabId);
    onToolSelect?.(tool);
  };

  // Close tab
  const closeTab = (tabId: string) => {
    const updatedTabs = openTabs.filter((tab) => tab.id !== tabId);
    setOpenTabs(updatedTabs);

    // If closing active tab, switch to the previous tab or workspace
    if (activeTabId === tabId) {
      const tabIndex = openTabs.findIndex((tab) => tab.id === tabId);
      const newActiveTab = updatedTabs[Math.max(0, tabIndex - 1)] || updatedTabs[0];
      setActiveTabId(newActiveTab?.id || "workspace");
    }
  };

  // Get count for category tabs
  const getTabCount = (tabId: string): number | undefined => {
    switch (tabId) {
      case "workspace": return workspaceCount;
      case "artifacts": return artifactsCount;
      case "tools": return toolsCount;
      case "skills": return skillsCount;
      case "groupChat": return groupChatMembersCount;
      default: return undefined;
    }
  };

  // Get current active tab
  const currentTab = openTabs.find((tab) => tab.id === activeTabId);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className={cn(
        "relative flex h-full flex-col border-l border-border bg-background overflow-hidden shrink-0",
        className
      )}
      style={{ width: width ?? 320 }}
    >
      {/* Resize handle */}
      {onResize && <ResizeHandle onResize={onResize} />}

      {/* Tab bar */}
      <div className="flex items-center border-b-2 border-border shrink-0 bg-muted/20">
        <div className="flex-1 flex items-center overflow-x-auto scrollbar-none gap-1 px-1">
          {openTabs.map((tab) => (
            <EditorTab
              key={tab.id}
              tab={tab}
              isActive={activeTabId === tab.id}
              onClick={() => setActiveTabId(tab.id)}
              onClose={tab.type !== "category" ? () => closeTab(tab.id) : undefined}
              count={getTabCount(tab.id)}
            />
          ))}
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors shrink-0 rounded-md m-1"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Tab content */}
      <ScrollArea className="flex-1">
        {currentTab?.type === "category" && currentTab.category === "workspace" && (
          <div className="p-3 h-full">
            <WorkspaceTabContent
              workingDir={workingDir}
              workingFiles={displayWorkingFiles}
              externalFolders={externalFolders}
              isLoadingFiles={isLoadingFiles}
              onFileSelect={onFileSelect}
            />
          </div>
        )}

        {currentTab?.type === "category" && currentTab.category === "artifacts" && (
          <div className="p-3">
            <ArtifactsTabContent
              artifacts={artifacts}
              selectedArtifact={null}
              onArtifactSelect={handleArtifactSelectWithPreview}
            />
          </div>
        )}

        {currentTab?.type === "category" && currentTab.category === "tools" && (
          <div className="p-3">
            <ToolsTabContent
              tools={allTools}
              onToolSelect={handleToolSelectWithPreview}
            />
          </div>
        )}

        {currentTab?.type === "category" && currentTab.category === "skills" && (
          <div className="p-3">
            <SkillsTabContent skills={usedSkills} />
          </div>
        )}

        {currentTab?.type === "category" && currentTab.category === "groupChat" && groupChat && (
          <div className="p-3">
            <GroupChatTabContent
              groupChat={groupChat}
              members={groupChatMembers}
              availableAgents={availableAgents}
              currentUserId={currentUserId}
              currentUserRole={currentUserRole}
              onAddMember={onAddMember || (async () => {})}
              onRemoveMember={onRemoveMember || (async () => {})}
              onUpdateGroupChat={onUpdateGroupChat || (async () => {})}
              onLeaveGroup={onLeaveGroupChat || (async () => {})}
              onDeleteGroup={onDeleteGroupChat || (async () => {})}
              isLoading={isGroupChatLoading}
            />
          </div>
        )}

        {currentTab?.type === "artifact" && currentTab.artifact && (
          <ArtifactPreview artifact={currentTab.artifact} />
        )}

        {currentTab?.type === "tool" && currentTab.tool && (
          <ToolPreview tool={currentTab.tool} />
        )}
      </ScrollArea>
    </div>
  );
}
