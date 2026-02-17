/**
 * Shared types for sidebar tabs
 */
import type { LucideIcon } from "lucide-react";
import type { Artifact, WorkingFile, ToolUsage } from "@/types";
import type {
  GroupChat,
  GroupChatMember,
  MemberRole,
  AddMemberRequest,
} from "@/lib/gateway";

// Re-export detail data types from panel components
export type {
  AgentDetailData,
  ModelOption,
} from "@/components/chat/agent-detail-panel";
export type { ExecutorDetailData } from "@/components/chat/executor-detail-panel";

// Tab types for the sidebar
export type SidebarTab = "workspace" | "artifacts" | "tools" | "skills" | "groupChat" | "agentDetail" | "executorDetail";

// Skill info extracted from messages
export interface SkillInfo {
  name: string;
  folder?: string;
  callCount: number;
}

// Open tab in the sidebar
export interface OpenTab {
  id: string;
  type: "category" | "artifact" | "tool";
  category?: SidebarTab;
  artifact?: Artifact;
  tool?: ToolUsage;
  label: string;
  icon: LucideIcon;
}

// Props interfaces for each tab
export interface WorkspaceTabContentProps {
  workingDir?: string;
  workingFiles: WorkingFile[];
  externalFolders: string[];
  isLoadingFiles: boolean;
  onFileSelect?: (file: WorkingFile) => void;
}

export interface ArtifactsTabContentProps {
  artifacts: Artifact[];
  selectedArtifact?: Artifact | null;
  /** ID of the artifact to highlight (for message-artifact linking) */
  highlightedArtifactId?: string | null;
  onArtifactSelect?: (artifact: Artifact) => void;
  /** Called when user wants to navigate to the source message (double-click) */
  onArtifactMessageClick?: (messageId: string) => void;
}

export interface ToolsTabContentProps {
  tools: ToolUsage[];
  onToolSelect?: (tool: ToolUsage) => void;
}

export interface SkillsTabContentProps {
  skills: SkillInfo[];
}

export interface AgentDetailTabContentProps {
  /** Agent data to display (uses AgentDetailData from panel) */
  agent: import("@/components/chat/agent-detail-panel").AgentDetailData;
  /** Whether this is the default agent */
  isDefault?: boolean;
  /** Available models for selection */
  models?: import("@/components/chat/agent-detail-panel").ModelOption[];
  /** Called when agent is updated */
  onUpdate?: (id: string, updates: Record<string, unknown>) => Promise<unknown>;
  /** Called when set as default is requested */
  onSetDefault?: () => void;
  /** Called when delete is requested */
  onDelete?: () => void;
  /** Called when settings is clicked (navigate to edit page) */
  onSettings?: (agentId: string) => void;
  /** Whether this is a workspace-scoped agent */
  isWorkspaceScoped?: boolean;
}

export interface ExecutorDetailTabContentProps {
  /** Executor data to display (uses ExecutorDetailData from panel) */
  executor: import("@/components/chat/executor-detail-panel").ExecutorDetailData;
  /** Workspace path for loading related data (e.g., "/Users/foo/project") */
  workspacePath: string;
  /** Called when settings is clicked (navigate to edit page) */
  onSettings?: (executorId: string) => void;
}

export interface GroupChatTabContentProps {
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
