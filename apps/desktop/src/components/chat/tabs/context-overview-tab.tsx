/**
 * Context overview tab - unified view of workspace, artifacts, tools, and skills
 * Displays all context items as collapsible sections in a single scrollable list
 */
import * as React from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import {
  Folder,
  Package,
  Wrench,
  Sparkles,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FolderOpen,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getGatewayClient } from "@/lib/gateway";
import type { Artifact, WorkingFile, ToolUsage } from "@/types";
import type { SkillInfo } from "./types";
import { getFileIconByExt, getArtifactIcon, getToolIcon } from "./utils";

interface ContextOverviewTabProps {
  // Workspace props
  workingDir?: string;
  workingFiles: WorkingFile[];
  externalFolders: string[];
  isLoadingFiles: boolean;
  onFileSelect?: (file: WorkingFile) => void;
  // Artifacts props
  artifacts: Artifact[];
  highlightedArtifactId?: string | null;
  onArtifactSelect?: (artifact: Artifact) => void;
  onArtifactMessageClick?: (messageId: string) => void;
  // Tools props
  tools: ToolUsage[];
  onToolSelect?: (tool: ToolUsage) => void;
  // Skills props
  skills: SkillInfo[];
}

/**
 * Collapsible section header
 */
function SectionHeader({
  icon: Icon,
  label,
  count,
  isExpanded,
  onToggle,
  iconColor,
  action,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  count: number;
  isExpanded: boolean;
  onToggle: () => void;
  iconColor?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-1 mb-1">
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-1.5 flex-1 text-muted-foreground hover:text-foreground transition-colors py-1"
      >
        {isExpanded ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0" />
        )}
        <Icon className={cn("h-3.5 w-3.5 shrink-0", iconColor)} />
        <span className="text-xs font-medium">{label}</span>
        {count > 0 && (
          <span className="text-xs text-muted-foreground/60 ml-auto mr-1">
            {count}
          </span>
        )}
      </button>
      {action}
    </div>
  );
}

/**
 * Empty state for a section
 */
function SectionEmptyState({ message }: { message: string }) {
  return (
    <div className="py-3 text-center">
      <p className="text-xs text-muted-foreground/50">{message}</p>
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
 * Workspace section content
 */
function WorkspaceSection({
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

  const handleOpenFolder = async (folderPath: string) => {
    try {
      await getGatewayClient().revealInFileManager(folderPath);
    } catch (error) {
      console.error("Failed to open folder:", error);
    }
  };

  const getFolderName = (path: string) => path.split(/[\\/]/).pop() || path;

  if (!workingDir) {
    return (
      <SectionEmptyState message={t("chat.sidebar.noWorkingDir", "No working directory")} />
    );
  }

  if (isLoadingFiles) {
    return (
      <div className="flex items-center justify-center gap-2 py-3 text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        <span className="text-xs">{t("common.loading")}</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {workingFiles.length === 0 ? (
        <SectionEmptyState message={t("chat.sidebar.emptyFolder", "Folder is empty")} />
      ) : (
        <div className="space-y-0.5 rounded-md border border-border/30 bg-muted/20 p-1.5 max-h-48 overflow-y-auto">
          {workingFiles.map((file, idx) => (
            <FileTreeItem
              key={`${file.path}-${idx}`}
              file={file}
              onSelect={onFileSelect}
            />
          ))}
        </div>
      )}

      {externalFolders.length > 0 && (
        <div className="space-y-1 rounded-md border border-border/30 bg-muted/20 p-1.5">
          {externalFolders.map((folder) => (
            <button
              key={folder}
              type="button"
              onClick={() => handleOpenFolder(folder)}
              className="flex w-full items-center gap-2 rounded-md py-1 px-2 text-left hover:bg-accent/50 transition-colors group"
            >
              <FolderOpen className="h-3.5 w-3.5 shrink-0 text-amber-500" />
              <span className="truncate text-xs text-foreground/80 flex-1">
                {getFolderName(folder)}
              </span>
              <ExternalLink className="h-3 w-3 text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Artifact item component
 */
function ArtifactItem({
  artifact,
  isHighlighted,
  onSelect,
  onMessageClick,
}: {
  artifact: Artifact;
  isHighlighted?: boolean;
  onSelect?: (artifact: Artifact) => void;
  onMessageClick?: (messageId: string) => void;
}) {
  const Icon = getArtifactIcon(artifact.type);

  return (
    <button
      type="button"
      onClick={() => onSelect?.(artifact)}
      onDoubleClick={() => artifact.sourceMessageId && onMessageClick?.(artifact.sourceMessageId)}
      className={cn(
        "flex w-full items-center gap-2 rounded-md py-1.5 px-2 text-left",
        "hover:bg-muted transition-colors group",
        isHighlighted && "bg-primary/10 ring-1 ring-primary/30"
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <span className="truncate text-xs text-foreground/80 flex-1">
        {artifact.name}
      </span>
    </button>
  );
}

/**
 * Tool item component
 */
function ToolItem({
  tool,
  onSelect,
}: {
  tool: ToolUsage;
  onSelect?: (tool: ToolUsage) => void;
}) {
  const Icon = getToolIcon(tool.name);

  return (
    <button
      type="button"
      onClick={() => onSelect?.(tool)}
      className={cn(
        "flex w-full items-center gap-2 rounded-md py-1.5 px-2 text-left",
        "hover:bg-muted transition-colors group"
      )}
    >
      <Icon className={cn(
        "h-3.5 w-3.5 shrink-0",
        tool.isError ? "text-destructive" : "text-muted-foreground"
      )} />
      <span className="truncate text-xs text-foreground/80 flex-1">
        {tool.displayName}
      </span>
      {tool.isError && (
        <span className="w-1.5 h-1.5 rounded-full bg-destructive shrink-0" />
      )}
    </button>
  );
}

/**
 * Skill item component
 */
function SkillItem({ skill }: { skill: SkillInfo }) {
  return (
    <div className="flex items-center gap-2 rounded-md py-1.5 px-2">
      <Sparkles className="h-3.5 w-3.5 shrink-0 text-violet-500" />
      <span className="truncate text-xs text-foreground/80 flex-1">
        {skill.folder ? `${skill.folder}:${skill.name}` : skill.name}
      </span>
      {skill.callCount > 1 && (
        <span className="text-[10px] text-muted-foreground/60">
          ×{skill.callCount}
        </span>
      )}
    </div>
  );
}

/**
 * Context overview tab - displays workspace, artifacts, tools, and skills as collapsible sections
 */
export function ContextOverviewTabContent({
  // Workspace props
  workingDir,
  workingFiles,
  externalFolders,
  isLoadingFiles,
  onFileSelect,
  // Artifacts props
  artifacts,
  highlightedArtifactId,
  onArtifactSelect,
  onArtifactMessageClick,
  // Tools props
  tools,
  onToolSelect,
  // Skills props
  skills,
}: ContextOverviewTabProps) {
  const { t } = useTranslation();

  // Section expansion states
  const [workspaceExpanded, setWorkspaceExpanded] = React.useState(true);
  const [artifactsExpanded, setArtifactsExpanded] = React.useState(true);
  const [toolsExpanded, setToolsExpanded] = React.useState(true);
  const [skillsExpanded, setSkillsExpanded] = React.useState(true);

  // Counts
  const workspaceCount = workingFiles.length + externalFolders.length;
  const artifactsCount = artifacts.length;
  const toolsCount = tools.length;
  const skillsCount = skills.length;

  // Handle folder open action
  const handleOpenWorkingDir = async () => {
    if (workingDir) {
      try {
        await getGatewayClient().revealInFileManager(workingDir);
      } catch (error) {
        console.error("Failed to open folder:", error);
      }
    }
  };

  return (
    <div className="flex flex-col space-y-3">
      {/* Workspace Section */}
      <div>
        <SectionHeader
          icon={Folder}
          label={t("chat.sidebar.workspace", "Workspace")}
          count={workspaceCount}
          isExpanded={workspaceExpanded}
          onToggle={() => setWorkspaceExpanded(!workspaceExpanded)}
          iconColor="text-amber-500"
          action={workingDir && (
            <button
              type="button"
              onClick={handleOpenWorkingDir}
              className="p-1 text-muted-foreground hover:text-foreground transition-colors rounded hover:bg-accent"
              title={t("workspace.openInFinder")}
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </button>
          )}
        />
        <AnimatePresence>
          {workspaceExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="overflow-hidden"
            >
              <WorkspaceSection
                workingDir={workingDir}
                workingFiles={workingFiles}
                externalFolders={externalFolders}
                isLoadingFiles={isLoadingFiles}
                onFileSelect={onFileSelect}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Artifacts Section */}
      <div>
        <SectionHeader
          icon={Package}
          label={t("chat.artifacts.title", "Artifacts")}
          count={artifactsCount}
          isExpanded={artifactsExpanded}
          onToggle={() => setArtifactsExpanded(!artifactsExpanded)}
          iconColor="text-blue-500"
        />
        <AnimatePresence>
          {artifactsExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="overflow-hidden"
            >
              {artifactsCount === 0 ? (
                <SectionEmptyState message={t("chat.sidebar.noArtifacts", "No artifacts yet")} />
              ) : (
                <div className="space-y-0.5 rounded-md border border-border/30 bg-muted/20 p-1.5 max-h-48 overflow-y-auto">
                  {artifacts.map((artifact) => (
                    <ArtifactItem
                      key={artifact.id}
                      artifact={artifact}
                      isHighlighted={highlightedArtifactId === artifact.id}
                      onSelect={onArtifactSelect}
                      onMessageClick={onArtifactMessageClick}
                    />
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Tools Section */}
      <div>
        <SectionHeader
          icon={Wrench}
          label={t("chat.tools", "Tools")}
          count={toolsCount}
          isExpanded={toolsExpanded}
          onToggle={() => setToolsExpanded(!toolsExpanded)}
          iconColor="text-orange-500"
        />
        <AnimatePresence>
          {toolsExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="overflow-hidden"
            >
              {toolsCount === 0 ? (
                <SectionEmptyState message={t("chat.sidebar.noTools", "No tools used yet")} />
              ) : (
                <div className="space-y-0.5 rounded-md border border-border/30 bg-muted/20 p-1.5 max-h-48 overflow-y-auto">
                  {tools.map((tool) => (
                    <ToolItem
                      key={tool.id}
                      tool={tool}
                      onSelect={onToolSelect}
                    />
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Skills Section */}
      <div>
        <SectionHeader
          icon={Sparkles}
          label={t("chat.sidebar.skills", "Skills")}
          count={skillsCount}
          isExpanded={skillsExpanded}
          onToggle={() => setSkillsExpanded(!skillsExpanded)}
          iconColor="text-violet-500"
        />
        <AnimatePresence>
          {skillsExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="overflow-hidden"
            >
              {skillsCount === 0 ? (
                <SectionEmptyState message={t("chat.sidebar.noSkills", "No skills used yet")} />
              ) : (
                <div className="space-y-0.5 rounded-md border border-border/30 bg-muted/20 p-1.5 max-h-48 overflow-y-auto">
                  {skills.map((skill) => (
                    <SkillItem key={`${skill.folder}-${skill.name}`} skill={skill} />
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
