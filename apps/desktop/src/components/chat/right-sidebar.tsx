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
  Sparkles,
  ExternalLink,
  Loader2,
  FileSpreadsheet,
  Presentation,
  Music,
  Video,
  FileType,
  Table,
  Globe,
  File,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Artifact, WorkingFile, ToolUsage, AgentMessage, ArtifactType } from "@/types";

// Skill usage info
interface SkillUsage {
  id: string;
  name: string;
  path?: string;
  timestamp: number;
}

interface RightSidebarProps {
  artifacts: Artifact[];
  workingFiles?: WorkingFile[];
  toolUsages: ToolUsage[];
  skillUsages?: SkillUsage[];
  messages?: AgentMessage[];
  workingDir?: string;
  onArtifactSelect?: (artifact: Artifact) => void;
  onFileSelect?: (file: WorkingFile) => void;
  onToolSelect?: (tool: ToolUsage) => void;
  onSkillSelect?: (skill: SkillUsage) => void;
  selectedArtifact?: Artifact | null;
  isOpen?: boolean;
  onClose?: () => void;
  className?: string;
}

// Get file icon based on extension
function getFileIconByExt(ext?: string) {
  if (!ext) return File;
  switch (ext) {
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
      return FileType;
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

// Get artifact type based on file extension
function getArtifactTypeByExt(ext?: string): ArtifactType {
  if (!ext) return "text";
  switch (ext) {
    case "html":
    case "htm":
      return "html";
    case "jsx":
    case "tsx":
      return "jsx";
    case "css":
    case "scss":
    case "less":
      return "css";
    case "json":
      return "json";
    case "md":
    case "markdown":
      return "markdown";
    case "csv":
      return "csv";
    case "xlsx":
    case "xls":
      return "spreadsheet";
    case "pptx":
    case "ppt":
      return "presentation";
    case "docx":
    case "doc":
      return "document";
    case "pdf":
      return "pdf";
    case "png":
    case "jpg":
    case "jpeg":
    case "gif":
    case "svg":
    case "webp":
    case "bmp":
    case "ico":
      return "image";
    case "mp3":
    case "wav":
    case "ogg":
    case "m4a":
    case "aac":
    case "flac":
      return "audio";
    case "mp4":
    case "webm":
    case "mov":
    case "avi":
    case "mkv":
      return "video";
    default:
      return "code";
  }
}

// File types that should NOT read content (binary/streaming files)
const SKIP_CONTENT_TYPES: ArtifactType[] = [
  "audio",
  "video",
  "font",
  "image",
  "pdf",
  "spreadsheet",
  "presentation",
  "document",
];

// Get file icon based on artifact type
function getFileIcon(type: ArtifactType) {
  switch (type) {
    case "html":
    case "jsx":
    case "css":
    case "code":
      return FileCode;
    case "json":
    case "document":
    case "pdf":
      return FileText;
    case "image":
      return ImageIcon;
    case "markdown":
      return FileType;
    case "csv":
      return Table;
    case "spreadsheet":
      return FileSpreadsheet;
    case "presentation":
      return Presentation;
    case "websearch":
      return Globe;
    case "audio":
      return Music;
    case "video":
      return Video;
    default:
      return File;
  }
}

/**
 * Collapsible section component
 */
function CollapsibleSection({
  title,
  icon: Icon,
  children,
  defaultExpanded = true,
  badge,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  defaultExpanded?: boolean;
  badge?: number;
}) {
  const [isExpanded, setIsExpanded] = React.useState(defaultExpanded);

  return (
    <div className="border-b border-border/50">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full cursor-pointer items-center justify-between px-4 py-3 transition-colors hover:bg-accent/30"
      >
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">{title}</span>
          {badge !== undefined && badge > 0 && (
            <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
              {badge}
            </span>
          )}
        </div>
        <span className="p-0.5 text-muted-foreground">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </span>
      </button>
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
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
  icon: React.ElementType;
  description: string;
}) {
  return (
    <div className="flex items-center gap-2 py-2">
      <div className="rounded bg-muted/30 p-1.5">
        <Icon className="h-3.5 w-3.5 text-muted-foreground/40" />
      </div>
      <p className="text-xs text-muted-foreground/60">{description}</p>
    </div>
  );
}

/**
 * File tree item component
 */
function FileTreeItem({
  file,
  depth = 0,
  onSelect,
  onSelectArtifact,
}: {
  file: WorkingFile;
  depth?: number;
  onSelect?: (file: WorkingFile) => void;
  onSelectArtifact?: (artifact: Artifact) => void;
}) {
  const [isExpanded, setIsExpanded] = React.useState(file.isExpanded ?? false);
  const [isLoading, setIsLoading] = React.useState(false);

  const ext = file.name.split(".").pop()?.toLowerCase();
  const FileIcon = file.isDir
    ? isExpanded
      ? FolderOpen
      : Folder
    : getFileIconByExt(ext);

  const handleClick = async () => {
    if (file.isDir) {
      setIsExpanded(!isExpanded);
    } else if (onSelect) {
      onSelect(file);
    } else if (onSelectArtifact) {
      const artifactType = getArtifactTypeByExt(ext);

      // For binary files, just pass the path without reading content
      if (SKIP_CONTENT_TYPES.includes(artifactType)) {
        const artifact: Artifact = {
          id: file.path,
          name: file.name,
          type: artifactType,
          path: file.path,
        };
        onSelectArtifact(artifact);
        return;
      }

      // For text files, create artifact (content loading handled by preview)
      setIsLoading(true);
      try {
        const artifact: Artifact = {
          id: file.path,
          name: file.name,
          type: artifactType,
          path: file.path,
        };
        onSelectArtifact(artifact);
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={isLoading}
        className={cn(
          "group flex w-full cursor-pointer items-center gap-1.5 rounded-md py-1 text-left transition-colors",
          "hover:bg-accent/50",
          isLoading && "opacity-70"
        )}
        style={{ paddingLeft: `${depth * 12}px` }}
      >
        <span className="flex h-4 w-4 shrink-0 items-center justify-center text-muted-foreground/50">
          {file.isDir ? (
            isExpanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )
          ) : null}
        </span>
        {isLoading ? (
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground/60" />
        ) : (
          <FileIcon
            className={cn(
              "h-3.5 w-3.5 shrink-0",
              file.isDir ? "text-amber-500" : "text-muted-foreground/60"
            )}
          />
        )}
        <span className="truncate text-sm text-foreground/80">{file.name}</span>
      </button>
      <AnimatePresence>
        {file.isDir && isExpanded && file.children && (
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
                onSelectArtifact={onSelectArtifact}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Artifact item component
 */
function ArtifactItem({
  artifact,
  onClick,
  isSelected,
}: {
  artifact: Artifact;
  onClick?: () => void;
  isSelected?: boolean;
}) {
  const IconComponent = getFileIcon(artifact.type);

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-left transition-colors",
        isSelected ? "bg-accent/60" : "hover:bg-accent/30"
      )}
    >
      <IconComponent
        className={cn(
          "h-3.5 w-3.5 shrink-0",
          isSelected ? "text-foreground/70" : "text-muted-foreground/60"
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
      onClick={onClick}
      className={cn(
        "group flex w-full cursor-pointer items-center gap-1.5 rounded-md py-1 text-left transition-colors",
        "hover:bg-accent/50",
        tool.isError && "text-red-400"
      )}
    >
      <Wrench
        className={cn(
          "h-3.5 w-3.5 shrink-0",
          tool.isError ? "text-red-400" : "text-muted-foreground/60"
        )}
      />
      <span className="truncate text-sm text-foreground/80">{tool.displayName}</span>
      {tool.isError && (
        <span className="shrink-0 rounded bg-red-500/10 px-1 py-0.5 text-[10px] text-red-500">
          Error
        </span>
      )}
    </button>
  );
}

/**
 * Skill usage item component
 */
function SkillUsageItem({
  skill,
  onClick,
}: {
  skill: SkillUsage;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group flex w-full cursor-pointer items-center gap-1.5 rounded-md py-1 text-left transition-colors hover:bg-accent/50"
    >
      <Sparkles className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
      <span className="truncate text-sm text-foreground/80">{skill.name}</span>
    </button>
  );
}

/**
 * Tool preview modal component
 */
function ToolPreviewModal({
  tool,
  onClose,
}: {
  tool: ToolUsage;
  onClose: () => void;
}) {
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
    // Truncate very long output
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
            <Wrench className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{tool.name}</span>
            {tool.isError && (
              <span className="rounded bg-red-500/10 px-1.5 py-0.5 text-xs text-red-500">
                Error
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 transition-colors hover:bg-accent"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 space-y-4 overflow-auto p-4">
          {/* Input Section */}
          <div>
            <h3 className="mb-2 text-sm font-medium text-muted-foreground">Input</h3>
            <pre className="max-h-[200px] overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted/50 p-3 text-xs">
              {formatInput(tool.input)}
            </pre>
          </div>

          {/* Output Section */}
          <div>
            <h3 className="mb-2 text-sm font-medium text-muted-foreground">Output</h3>
            <pre
              className={cn(
                "max-h-[300px] overflow-auto whitespace-pre-wrap break-words rounded-md p-3 text-xs",
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

// Default number of items to show before "show more"
const DEFAULT_VISIBLE_COUNT = 5;

// Extract MCP tools from messages
function extractMcpTools(messages: AgentMessage[]): ToolUsage[] {
  if (!messages) return [];
  const tools: ToolUsage[] = [];
  const toolUseMessages = messages.filter(
    (m) => m.type === "tool_use" && m.name?.startsWith("mcp__")
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

    // Parse MCP tool name: mcp__server__tool
    const parts = toolName.split("__");
    const displayName = parts[2] || parts[1] || toolName;

    tools.push({
      id: toolId,
      name: toolName,
      displayName,
      input: msg.input,
      output: result?.output,
      isError: result?.isError,
      timestamp: Date.now() - (toolUseMessages.length - index) * 1000,
    });
  });

  return tools;
}

// Extract skill usages from messages
function extractSkillUsages(messages: AgentMessage[]): SkillUsage[] {
  if (!messages) return [];
  const skills: SkillUsage[] = [];
  const seenSkills = new Set<string>();

  const skillMessages = messages.filter(
    (m) => m.type === "tool_use" && m.name === "Skill"
  );

  skillMessages.forEach((msg, index) => {
    const input = msg.input as Record<string, unknown> | undefined;
    const skillName = (input?.skill as string) || "Unknown";

    if (!seenSkills.has(skillName)) {
      seenSkills.add(skillName);
      skills.push({
        id: `skill-${index}`,
        name: skillName,
        timestamp: Date.now() - (skillMessages.length - index) * 1000,
      });
    }
  });

  return skills;
}

// Extract artifacts from messages (Write tool calls)
function extractArtifactsFromMessages(messages: AgentMessage[]): Artifact[] {
  if (!messages) return [];
  const artifacts: Artifact[] = [];
  const seenPaths = new Set<string>();

  messages.forEach((msg) => {
    if (msg.type === "tool_use" && msg.name === "Write") {
      const input = msg.input as Record<string, unknown> | undefined;
      const filePath = input?.file_path as string | undefined;
      const content = input?.content as string | undefined;

      if (filePath && !seenPaths.has(filePath)) {
        seenPaths.add(filePath);
        const filename = filePath.split("/").pop() || filePath;
        const ext = filename.split(".").pop()?.toLowerCase();
        const type = getArtifactTypeByExt(ext);

        artifacts.push({
          id: filePath,
          name: filename,
          type,
          content,
          path: filePath,
        });
      }
    }
  });

  return artifacts;
}

export function RightSidebar({
  artifacts: externalArtifacts,
  workingFiles = [],
  toolUsages: externalToolUsages,
  skillUsages: externalSkillUsages,
  messages = [],
  workingDir,
  onArtifactSelect,
  onFileSelect,
  onToolSelect,
  onSkillSelect,
  selectedArtifact,
  isOpen = true,
  onClose,
  className,
}: RightSidebarProps) {
  const { t } = useTranslation();
  const [selectedTool, setSelectedTool] = React.useState<ToolUsage | null>(null);
  const [showAllArtifacts, setShowAllArtifacts] = React.useState(false);
  const [showAllTools, setShowAllTools] = React.useState(false);
  const [showAllSkills, setShowAllSkills] = React.useState(false);

  // Extract data from messages if not provided externally
  const mcpTools = React.useMemo(
    () => (externalToolUsages.length > 0 ? externalToolUsages : extractMcpTools(messages)),
    [externalToolUsages, messages]
  );

  const skillUsages = React.useMemo(
    () => (externalSkillUsages?.length ? externalSkillUsages : extractSkillUsages(messages)),
    [externalSkillUsages, messages]
  );

  const artifacts = React.useMemo(
    () =>
      externalArtifacts.length > 0
        ? externalArtifacts
        : extractArtifactsFromMessages(messages),
    [externalArtifacts, messages]
  );

  // Pagination for sections
  const visibleArtifacts = showAllArtifacts
    ? artifacts
    : artifacts.slice(0, DEFAULT_VISIBLE_COUNT);
  const hasMoreArtifacts = artifacts.length > DEFAULT_VISIBLE_COUNT;

  const visibleTools = showAllTools ? mcpTools : mcpTools.slice(0, DEFAULT_VISIBLE_COUNT);
  const hasMoreTools = mcpTools.length > DEFAULT_VISIBLE_COUNT;

  const visibleSkills = showAllSkills
    ? skillUsages
    : skillUsages.slice(0, DEFAULT_VISIBLE_COUNT);
  const hasMoreSkills = skillUsages.length > DEFAULT_VISIBLE_COUNT;

  // Handle tool click
  const handleToolClick = (tool: ToolUsage) => {
    if (onToolSelect) {
      onToolSelect(tool);
    } else {
      setSelectedTool(tool);
    }
  };

  // Open folder in system file explorer
  const handleOpenFolder = async (folderPath: string) => {
    // This would call Tauri command to open folder
    console.log("[RightSidebar] Open folder:", folderPath);
  };

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

      {/* Scrollable content */}
      <ScrollArea className="flex-1">
        {/* 1. Workspace Section (File Tree) */}
        <CollapsibleSection
          title={t("chat.sidebar.workspace", "Workspace")}
          icon={Folder}
          defaultExpanded={true}
          badge={workingFiles.length}
        >
          {workingDir && (
            <div className="mb-2 flex items-center justify-between">
              <span className="truncate text-xs text-muted-foreground">{workingDir}</span>
              <button
                onClick={() => handleOpenFolder(workingDir)}
                className="ml-2 p-0.5 text-muted-foreground transition-colors hover:text-foreground"
                title={t("workspace.openInFinder")}
              >
                <ExternalLink className="h-3 w-3" />
              </button>
            </div>
          )}
          {workingFiles.length === 0 ? (
            <EmptyState icon={Folder} description={t("chat.noFiles")} />
          ) : (
            <div className="max-h-[200px] space-y-0.5 overflow-y-auto">
              {workingFiles.map((file, idx) => (
                <FileTreeItem
                  key={`${file.path}-${idx}`}
                  file={file}
                  onSelect={onFileSelect}
                  onSelectArtifact={onArtifactSelect}
                />
              ))}
            </div>
          )}
        </CollapsibleSection>

        {/* 2. Artifacts Section (Generated Files) */}
        <CollapsibleSection
          title={t("chat.artifacts")}
          icon={Package}
          defaultExpanded={true}
          badge={artifacts.length}
        >
          {artifacts.length === 0 ? (
            <EmptyState icon={Package} description={t("chat.noArtifacts")} />
          ) : (
            <>
              <div
                className={cn("space-y-1", showAllArtifacts && "max-h-[300px] overflow-y-auto")}
              >
                {visibleArtifacts.map((artifact) => (
                  <ArtifactItem
                    key={artifact.id}
                    artifact={artifact}
                    onClick={() => onArtifactSelect?.(artifact)}
                    isSelected={selectedArtifact?.id === artifact.id}
                  />
                ))}
              </div>
              {hasMoreArtifacts && (
                <button
                  onClick={() => setShowAllArtifacts(!showAllArtifacts)}
                  className="w-full py-2 text-center text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  {showAllArtifacts
                    ? t("common.less", "Show less")
                    : t("common.more", `Show ${artifacts.length - DEFAULT_VISIBLE_COUNT} more`)}
                </button>
              )}
            </>
          )}
        </CollapsibleSection>

        {/* 3. Tools Section (MCP Tools Used) */}
        <CollapsibleSection
          title={t("chat.tools")}
          icon={Wrench}
          defaultExpanded={false}
          badge={mcpTools.length}
        >
          {mcpTools.length === 0 ? (
            <EmptyState icon={Wrench} description={t("chat.noTools")} />
          ) : (
            <>
              <div
                className={cn("space-y-1", showAllTools && "max-h-[300px] overflow-y-auto")}
              >
                {visibleTools.map((tool) => (
                  <ToolUsageItem
                    key={tool.id}
                    tool={tool}
                    onClick={() => handleToolClick(tool)}
                  />
                ))}
              </div>
              {hasMoreTools && (
                <button
                  onClick={() => setShowAllTools(!showAllTools)}
                  className="w-full py-2 text-center text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  {showAllTools
                    ? t("common.less", "Show less")
                    : t("common.more", `Show ${mcpTools.length - DEFAULT_VISIBLE_COUNT} more`)}
                </button>
              )}
            </>
          )}
        </CollapsibleSection>

        {/* 4. Skills Section (Skills Invoked) */}
        <CollapsibleSection
          title={t("chat.sidebar.skills", "Skills")}
          icon={Sparkles}
          defaultExpanded={false}
          badge={skillUsages.length}
        >
          {skillUsages.length === 0 ? (
            <EmptyState icon={Sparkles} description={t("chat.sidebar.noSkills", "No skills used yet")} />
          ) : (
            <>
              <div
                className={cn("space-y-1", showAllSkills && "max-h-[300px] overflow-y-auto")}
              >
                {visibleSkills.map((skill) => (
                  <SkillUsageItem
                    key={skill.id}
                    skill={skill}
                    onClick={() => onSkillSelect?.(skill)}
                  />
                ))}
              </div>
              {hasMoreSkills && (
                <button
                  onClick={() => setShowAllSkills(!showAllSkills)}
                  className="w-full py-2 text-center text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  {showAllSkills
                    ? t("common.less", "Show less")
                    : t("common.more", `Show ${skillUsages.length - DEFAULT_VISIBLE_COUNT} more`)}
                </button>
              )}
            </>
          )}
        </CollapsibleSection>
      </ScrollArea>

      {/* Tool Preview Modal */}
      {selectedTool && (
        <ToolPreviewModal tool={selectedTool} onClose={() => setSelectedTool(null)} />
      )}
    </div>
  );
}
