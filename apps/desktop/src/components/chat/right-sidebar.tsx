/**
 * Right sidebar for workspace chat
 * Displays workspace files, artifacts, tools, skills, and detail tabs
 */
import * as React from "react";
import { useTranslation } from "react-i18next";
import {
  Folder,
  Package,
  Wrench,
  X,
  Sparkles,
  GripVertical,
  Users,
  Bot,
  Terminal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Artifact, WorkingFile, ToolUsage, AgentMessage } from "@/types";
import type {
  GroupChat,
  GroupChatMember,
  MemberRole,
  AddMemberRequest,
} from "@/lib/gateway";

// Import tab components and utilities from tabs folder
import {
  type SidebarTab,
  type AgentDetailInfo,
  type ExecutorDetailInfo,
  type OpenTab,
  extractAllTools,
  extractUsedSkills,
  extractExternalFolders,
  getArtifactIcon,
  getToolIcon,
  WorkspaceTabContent,
  ArtifactsTabContent,
  ToolsTabContent,
  SkillsTabContent,
  AgentDetailTabContent,
  ExecutorDetailTabContent,
  GroupChatTabContent,
  ArtifactPreview,
  ToolPreview,
} from "./tabs";

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
  // Agent/Executor detail props
  /** Agent detail info - when provided, shows the agent detail tab */
  agentDetail?: AgentDetailInfo | null;
  /** Executor detail info - when provided, shows the executor detail tab */
  executorDetail?: ExecutorDetailInfo | null;
  /** Workspace ID for loading executor capabilities (MCP, skills, commands) */
  workspaceId?: string;
  /** Called when agent settings button is clicked */
  onAgentSettings?: (agentId: string) => void;
  /** Called when executor settings button is clicked */
  onExecutorSettings?: (executorId: string) => void;
  // Agent detail panel props (for full editing support)
  /** Whether the agent is the default agent */
  isAgentDefault?: boolean;
  /** Available models for agent selection */
  agentModels?: Array<{ id: string; name: string; provider: string; enabled: boolean }>;
  /** Called when agent is updated */
  onAgentUpdate?: (id: string, updates: Record<string, unknown>) => Promise<unknown>;
  /** Called when agent is set as default */
  onAgentSetDefault?: () => void;
  /** Called when agent is deleted */
  onAgentDelete?: () => void;
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
  // Agent/Executor detail props
  agentDetail,
  executorDetail,
  workspaceId,
  onAgentSettings,
  onExecutorSettings,
  // Agent detail panel props
  isAgentDefault,
  agentModels,
  onAgentUpdate,
  onAgentSetDefault,
  onAgentDelete,
}: RightSidebarProps) {
  const { t } = useTranslation();
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

  // Track previous groupChat, agentDetail, executorDetail to detect when they change
  const prevGroupChatRef = React.useRef<GroupChat | null | undefined>(undefined);
  const prevAgentDetailRef = React.useRef<AgentDetailInfo | null | undefined>(undefined);
  const prevExecutorDetailRef = React.useRef<ExecutorDetailInfo | null | undefined>(undefined);

  // Initialize category tabs - dynamically include group chat, agent, executor tabs when available
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

    // Add agent detail tab if agent is selected
    if (agentDetail) {
      baseTabs.unshift({
        id: "agentDetail",
        type: "category",
        category: "agentDetail",
        label: agentDetail.name,
        icon: Bot,
      });
    }

    // Add executor detail tab if executor is selected
    if (executorDetail) {
      baseTabs.unshift({
        id: "executorDetail",
        type: "category",
        category: "executorDetail",
        label: executorDetail.name,
        icon: Terminal,
      });
    }

    setOpenTabs(baseTabs);

    // Auto-switch to groupChat tab when groupChat becomes available (or changes to a different group)
    if (groupChat && (!prevGroupChatRef.current || prevGroupChatRef.current.id !== groupChat.id)) {
      setActiveTabId("groupChat");
    } else if (!groupChat && prevGroupChatRef.current) {
      // Switch away from groupChat tab when groupChat is removed
      if (activeTabId === "groupChat") {
        setActiveTabId("workspace");
      }
    }

    // Auto-switch to agentDetail tab when agent detail becomes available (or changes)
    if (agentDetail && (!prevAgentDetailRef.current || prevAgentDetailRef.current.id !== agentDetail.id)) {
      setActiveTabId("agentDetail");
    } else if (!agentDetail && prevAgentDetailRef.current) {
      if (activeTabId === "agentDetail") {
        setActiveTabId("workspace");
      }
    }

    // Auto-switch to executorDetail tab when executor detail becomes available (or changes)
    if (executorDetail && (!prevExecutorDetailRef.current || prevExecutorDetailRef.current.id !== executorDetail.id)) {
      setActiveTabId("executorDetail");
    } else if (!executorDetail && prevExecutorDetailRef.current) {
      if (activeTabId === "executorDetail") {
        setActiveTabId("workspace");
      }
    }

    prevGroupChatRef.current = groupChat;
    prevAgentDetailRef.current = agentDetail;
    prevExecutorDetailRef.current = executorDetail;
  }, [t, groupChat, agentDetail, executorDetail]);

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
    setOpenTabs(openTabs.filter((tab) => tab.id !== tabId));
    if (activeTabId === tabId) {
      setActiveTabId("workspace");
    }
  };

  // Get count for tab badge
  const getTabCount = (tabId: string): number | undefined => {
    switch (tabId) {
      case "workspace":
        return workspaceCount;
      case "artifacts":
        return artifactsCount;
      case "tools":
        return toolsCount;
      case "skills":
        return skillsCount;
      case "groupChat":
        return groupChatMembersCount;
      default:
        return undefined;
    }
  };

  // Find current tab
  const currentTab = openTabs.find((tab) => tab.id === activeTabId);

  if (!isOpen) return null;

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
      <div className="flex items-center border-b border-border shrink-0 bg-muted/20 h-[57px]">
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

        {currentTab?.type === "category" && currentTab.category === "agentDetail" && agentDetail && (
          <div className="p-3">
            <AgentDetailTabContent
              agent={agentDetail}
              isDefault={isAgentDefault}
              models={agentModels}
              onUpdate={onAgentUpdate}
              onSetDefault={onAgentSetDefault}
              onDelete={onAgentDelete}
              onSettings={onAgentSettings}
            />
          </div>
        )}

        {currentTab?.type === "category" && currentTab.category === "executorDetail" && executorDetail && (
          <div className="p-3">
            <ExecutorDetailTabContent
              executor={executorDetail}
              workspaceId={workspaceId}
              onSettings={onExecutorSettings}
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
