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

// Tab types for the sidebar
export type SidebarTab = "workspace" | "artifacts" | "tools" | "skills" | "groupChat" | "agentDetail" | "executorDetail";

// Agent info for detail display
export interface AgentDetailInfo {
  id: string;
  name: string;
  type?: string;
  model?: string;
  description?: string;
}

// Executor info for detail display
export interface ExecutorDetailInfo {
  id: string;
  name: string;
  type: string;
  status?: "online" | "offline" | "unknown";
}

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
  onArtifactSelect?: (artifact: Artifact) => void;
}

export interface ToolsTabContentProps {
  tools: ToolUsage[];
  onToolSelect?: (tool: ToolUsage) => void;
}

export interface SkillsTabContentProps {
  skills: SkillInfo[];
}

// Model option for agent detail panel
export interface ModelOption {
  id: string;
  name: string;
  provider: string;
  enabled: boolean;
}

export interface AgentDetailTabContentProps {
  agent: AgentDetailInfo;
  /** Whether this is the default agent */
  isDefault?: boolean;
  /** Available models for selection */
  models?: ModelOption[];
  /** Called when agent is updated */
  onUpdate?: (id: string, updates: Record<string, unknown>) => Promise<unknown>;
  /** Called when set as default is requested */
  onSetDefault?: () => void;
  /** Called when delete is requested */
  onDelete?: () => void;
  /** Called when settings is clicked */
  onSettings?: (agentId: string) => void;
}

export interface ExecutorDetailTabContentProps {
  executor: ExecutorDetailInfo;
  /** Workspace ID for loading related data (MCP, skills, commands) */
  workspaceId?: string;
  /** Called when settings is clicked */
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
