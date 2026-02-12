import * as React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import {
  PanelRightOpen,
  PanelRightClose,
  PanelLeftOpen,
  PanelLeftClose,
  Trash2,
  Loader2,
  Plus,
  MessageSquare,
  Search,
  Bot,
  GripVertical,
  Users,
  FileText,
  Share2,
  Archive,
  RefreshCcw,
  Terminal,
  MoreHorizontal,
  History,
  Settings,
} from "lucide-react";
import { getGatewayClient, type FileSession, type UIMessage, type ExecutorUIMessage, type MemberType, type MemberRole } from "@/lib/gateway";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
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
import { Textarea } from "@/components/ui/textarea";
import {
  DesktopChatInput,
  DesktopMessageList,
  RightSidebar,
  SessionSelector,
  CreateGroupChatDialog,
  GroupChatMessageList,
  GroupChatListItem,
  GroupChatMembersDialog,
  AgentListItem,
} from "@/components/chat";
import { WorkspaceHeader, ExecutorList } from "@/components/workspace";
import {
  useAgentConversation,
  useAgents,
  useAgentDetail,
  useModels,
  useLocalWorkspaces,
  useChatConfig,
  useGroupChat,
  useChatNotifications,
  useGroupNotifications,
  useExecutorSessions,
  useExecutorSessionMessages,
  useChatList,
} from "@/hooks";
import type { AgentMessage } from "@/types";
import { cn } from "@/lib/utils";

// ============================================================================
// Resize Handle Component
// ============================================================================

interface ResizeHandleProps {
  side: "left" | "right";
  onResize: (delta: number) => void;
  className?: string;
}

function ResizeHandle({ side, onResize, className }: ResizeHandleProps) {
  const [isDragging, setIsDragging] = React.useState(false);
  const startXRef = React.useRef(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    startXRef.current = e.clientX;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startXRef.current;
      startXRef.current = moveEvent.clientX;
      // For left panel, positive delta = expand; for right panel, negative delta = expand
      onResize(side === "left" ? delta : -delta);
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
        "group absolute top-0 bottom-0 w-1 cursor-col-resize z-10",
        "flex items-center justify-center",
        side === "left" ? "right-0" : "left-0",
        isDragging && "bg-primary/30",
        className
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

// ============================================================================
// Types
// ============================================================================

interface Conversation {
  id: string;
  title: string;
  agentId: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  lastMessage?: string;
  isPinned?: boolean;
  isMuted?: boolean;
  isArchived?: boolean;
  isStarred?: boolean;
}

// ============================================================================
// Conversation Management (Gateway API + localStorage fallback)
// ============================================================================

const LAST_SESSION_KEY = "viben_workspace_last_session";
const LAST_AGENT_KEY = "viben_workspace_last_agent";

function getLastSessionKey(workspaceId: string) {
  return `${LAST_SESSION_KEY}_${workspaceId}`;
}

function getLastAgentKey(workspaceId: string) {
  return `${LAST_AGENT_KEY}_${workspaceId}`;
}

function saveLastSessionId(workspaceId: string, sessionId: string) {
  localStorage.setItem(getLastSessionKey(workspaceId), sessionId);
}

function loadLastAgentId(workspaceId: string): string | null {
  try {
    return localStorage.getItem(getLastAgentKey(workspaceId));
  } catch {
    return null;
  }
}

function saveLastAgentId(workspaceId: string, agentId: string) {
  localStorage.setItem(getLastAgentKey(workspaceId), agentId);
}

// Convert Gateway FileSession to Conversation
function fileSessionToConversation(session: FileSession): Conversation {
  const sessionId = session.id || crypto.randomUUID();
  return {
    id: sessionId,
    title: session.prompt || `Session ${sessionId.slice(0, 8)}`,
    agentId: session.agent_id,
    createdAt: session.created_at,
    updatedAt: session.updated_at,
    messageCount: 0, // Will be updated when messages are loaded
    isPinned: false,
    isStarred: false,
    isArchived: session.status === "archived",
  };
}

// Convert Gateway UIMessage to AgentMessage
// UIMessage is already in the correct format for frontend rendering
function uiMessageToAgentMessage(msg: UIMessage): import("@/types").AgentMessage | null {
  switch (msg.type) {
    case "user":
      return {
        id: msg.id,
        type: "user" as const,
        content: msg.content || "",
      };
    case "text":
      return {
        id: msg.id,
        type: "text" as const,
        content: msg.content || "",
      };
    case "tool_use":
      return {
        id: msg.id,
        type: "tool_use" as const,
        name: msg.tool_name || "unknown_tool",
        input: msg.tool_input || {},
        toolUseId: msg.tool_use_id,
      };
    case "tool_result":
      return {
        id: msg.id,
        type: "tool_result" as const,
        toolUseId: msg.tool_use_id,
        output: msg.tool_output || "",
        isError: msg.is_error || false,
      };
    case "thinking":
      return {
        id: msg.id,
        type: "text" as const,
        content: msg.content || "",
      };
    case "error":
      return {
        id: msg.id,
        type: "error" as const,
        message: msg.content || "",
        isError: true,
      };
    default:
      return null;
  }
}

// ============================================================================
// Main Component
// ============================================================================

export function WorkspaceChatPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { workspaceId } = useParams<{ workspaceId: string }>();

  // UI State
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState("");

  // Dialog states
  const [isSearchDialogOpen, setIsSearchDialogOpen] = React.useState(false);
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = React.useState(false);
  const [isExportDialogOpen, setIsExportDialogOpen] = React.useState(false);
  const [isGroupDialogOpen, setIsGroupDialogOpen] = React.useState(false);
  const [isShareDialogOpen, setIsShareDialogOpen] = React.useState(false);
  const [isClearDialogOpen, setIsClearDialogOpen] = React.useState(false);
  const [isCreateAgentDialogOpen, setIsCreateAgentDialogOpen] = React.useState(false);
  const [isCreateGroupDialogOpen, setIsCreateGroupDialogOpen] = React.useState(false);
  const [conversationSearchQuery, setConversationSearchQuery] = React.useState("");

  // Resizable panel widths
  const [leftPanelWidth, setLeftPanelWidth] = React.useState(320); // Default 320px (w-80)
  const [rightPanelWidth, setRightPanelWidth] = React.useState(320); // Default 320px (w-80)
  const [isLeftPanelCollapsed, setIsLeftPanelCollapsed] = React.useState(false);

  // Panel width constraints
  const MIN_LEFT_PANEL_WIDTH = 240;
  const MAX_LEFT_PANEL_WIDTH = 480;
  const MIN_RIGHT_PANEL_WIDTH = 280;
  const MAX_RIGHT_PANEL_WIDTH = 480;

  // Handle panel resize
  const handleLeftPanelResize = React.useCallback((delta: number) => {
    setLeftPanelWidth((prev) =>
      Math.min(MAX_LEFT_PANEL_WIDTH, Math.max(MIN_LEFT_PANEL_WIDTH, prev + delta))
    );
  }, []);

  const handleRightPanelResize = React.useCallback((delta: number) => {
    setRightPanelWidth((prev) =>
      Math.min(MAX_RIGHT_PANEL_WIDTH, Math.max(MIN_RIGHT_PANEL_WIDTH, prev + delta))
    );
  }, []);

  // Left panel ScrollArea ref and width tracking for overflow fix
  const leftPanelScrollRef = React.useRef<HTMLDivElement>(null);
  const [leftPanelScrollWidth, setLeftPanelScrollWidth] = React.useState<number | null>(null);

  // Track left panel scroll area width using ResizeObserver
  React.useEffect(() => {
    const scrollArea = leftPanelScrollRef.current;
    if (!scrollArea) return;

    const updateWidth = () => {
      const width = scrollArea.getBoundingClientRect().width;
      setLeftPanelScrollWidth(width);
    };

    updateWidth();
    const resizeObserver = new ResizeObserver(updateWidth);
    resizeObserver.observe(scrollArea);
    return () => resizeObserver.disconnect();
  }, []);

  // Constrain left panel content width to prevent overflow
  const leftPanelContentStyle: React.CSSProperties = leftPanelScrollWidth
    ? { width: leftPanelScrollWidth, maxWidth: leftPanelScrollWidth }
    : {};

  // Conversation State
  const [conversations, setConversations] = React.useState<Conversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = React.useState<string | null>(null);
  const [isLoadingSessions, setIsLoadingSessions] = React.useState(false);
  const [_sessionsError, setSessionsError] = React.useState<string | null>(null);

  // Group Chat State
  const [selectedGroupChatId, setSelectedGroupChatId] = React.useState<string | null>(null);
  const [selectedGroupSessionId, setSelectedGroupSessionId] = React.useState<string | null>(null);
  const [isCreatingGroupChat, setIsCreatingGroupChat] = React.useState(false);
  const [groupChatInput, setGroupChatInput] = React.useState("");
  const [isMembersDialogOpen, setIsMembersDialogOpen] = React.useState(false);
  const [renameGroupChatId, setRenameGroupChatId] = React.useState<string | null>(null);
  const [renameGroupChatName, setRenameGroupChatName] = React.useState("");
  const [mutedGroupChats, setMutedGroupChats] = React.useState<Set<string>>(new Set());

  // Right sidebar detail views
  // Use on-demand loading for agent details - only load when user clicks to view details
  const [detailAgentId, setDetailAgentId] = React.useState<string | null>(null);
  const [rightSidebarExecutorDetail, setRightSidebarExecutorDetail] = React.useState<{
    id: string;
    name: string;
    type: string;
    config_path?: string;
  } | null>(null);

  // Get workspace info
  const { workspaces, isLoading: isLoadingWorkspace } = useLocalWorkspaces();
  const workspace = workspaces.find((w) => w.id === workspaceId);

  // Aggregated chat list from Gateway API (group chats, executors, agents)
  // This is the single source of truth for the left sidebar list
  const {
    groupChats: _chatListGroupChats, // Not used yet - using useGroupChat for full data
    executors: chatListExecutors,
    agents: chatListAgents,
    loading: isLoadingChatList,
    refresh: refreshChatList,
  } = useChatList({
    workspacePath: workspace?.path,
    includeGlobal: true,
  });

  // On-demand agent detail loading for right sidebar
  // Loads complete agent info only when user clicks to view details
  const {
    agent: detailAgentData,
    loading: isLoadingDetailAgent,
    error: _detailAgentError,
  } = useAgentDetail(detailAgentId, workspace?.path);

  // Convert to the format expected by RightSidebar (rightSidebarAgentDetail)
  const rightSidebarAgentDetail = detailAgentData ? {
    id: detailAgentData.id,
    name: detailAgentData.name,
    path: detailAgentData.config_path,
    description: detailAgentData.description,
    model: detailAgentData.model,
    provider: detailAgentData.provider,
    system_prompt: detailAgentData.system_prompt,
    temperature: detailAgentData.temperature,
    max_tokens: detailAgentData.max_tokens,
    mcp_servers: detailAgentData.mcp_servers,
    skills: detailAgentData.skills,
    created_at: detailAgentData.created_at,
    updated_at: detailAgentData.updated_at,
  } : null;

  // Alias for backwards compatibility
  const isLoadingExecutors = isLoadingChatList;
  const loadExecutors = refreshChatList;

  // Selected executor for left sidebar (different from config bar executor)
  const [selectedSidebarExecutorId, setSelectedSidebarExecutorId] = React.useState<string | null>(null);
  // Selected executor session ID (from the session selector dropdown)
  const [selectedExecutorSessionId, setSelectedExecutorSessionId] = React.useState<string | null>(null);

  // Get executor sessions for the selected sidebar executor
  const selectedSidebarExecutor = chatListExecutors.find((e) => e.id === selectedSidebarExecutorId);
  // Get executor type from ChatListItem (stored in icon_type or metadata)
  const selectedExecutorType = selectedSidebarExecutor?.icon_type || null;

  const {
    sessions: executorSessions,
    isLoading: isLoadingExecutorSessions,
    error: _executorSessionsError,
    refresh: refreshExecutorSessions,
  } = useExecutorSessions(
    selectedExecutorType,
    workspace?.path || null
  );

  // Auto-select first executor session when sessions load
  React.useEffect(() => {
    if (executorSessions.length > 0 && !selectedExecutorSessionId) {
      setSelectedExecutorSessionId(executorSessions[0].id);
    }
    // Clear selection when executor changes and has no sessions
    if (executorSessions.length === 0 && selectedExecutorSessionId) {
      setSelectedExecutorSessionId(null);
    }
  }, [executorSessions, selectedExecutorSessionId]);

  // Get messages for the selected executor session
  const {
    messages: executorMessages,
    isLoading: isLoadingExecutorMessages,
    error: _executorMessagesError,
    refresh: _refreshExecutorMessages,
  } = useExecutorSessionMessages(
    selectedExecutorType,
    selectedExecutorSessionId,
    workspace?.path || null
  );

  // Convert ExecutorUIMessage to AgentMessage for display
  // Merges tool_use with its matching tool_result
  const executorMessagesAsAgentMessages = React.useMemo(() => {
    // Recursive conversion function for handling subagent messages
    const convertMessages = (messages: ExecutorUIMessage[]): AgentMessage[] => {
      // First, build a map of tool_use_id -> tool_result
      const toolResultMap = new Map<string, ExecutorUIMessage>();
      messages.forEach((msg) => {
        if (msg.type === "tool_result" && msg.tool_use_id) {
          toolResultMap.set(msg.tool_use_id, msg);
        }
      });

      const result: AgentMessage[] = [];

      messages.forEach((msg: ExecutorUIMessage) => {
        switch (msg.type) {
          case "user":
            result.push({
              id: msg.id,
              type: "user",
              content: msg.content || "",
            });
            break;
          case "text":
            result.push({
              id: msg.id,
              type: "text",
              content: msg.content || "",
            });
            break;
          case "thinking":
            result.push({
              id: msg.id,
              type: "thinking",
              content: msg.content || "",
            });
            break;
          case "tool_use": {
            // Find matching tool_result
            const toolResult = msg.tool_use_id ? toolResultMap.get(msg.tool_use_id) : undefined;
            const toolName = msg.tool_name || "unknown";

            // Handle special tool types
            if (toolName === "AskUserQuestion" && msg.tool_input) {
              // Parse AskUserQuestion input to extract questions
              const input = msg.tool_input as { questions?: Array<{
                question: string;
                header?: string;
                options?: Array<{ label: string; description?: string }>;
                multiSelect?: boolean;
              }> };
              if (input.questions && input.questions.length > 0) {
                result.push({
                  id: msg.id,
                  type: "ask_question",
                  questions: input.questions.map(q => ({
                    question: q.question,
                    header: q.header || "",
                    options: q.options || [],
                    multiSelect: q.multiSelect || false,
                  })),
                });
                break;
              }
            }

            if (toolName === "EnterPlanMode") {
              result.push({
                id: msg.id,
                type: "plan_mode",
                planModeAction: "enter",
              });
              break;
            }

            if (toolName === "ExitPlanMode") {
              result.push({
                id: msg.id,
                type: "plan_mode",
                planModeAction: "exit",
              });
              break;
            }

            // Convert subagent messages recursively if present
            const subagentMessages = msg.subagent_messages
              ? convertMessages(msg.subagent_messages)
              : undefined;

            // Regular tool_use
            result.push({
              id: msg.id,
              type: "tool_use",
              name: toolName,
              input: msg.tool_input || {},
              toolUseId: msg.tool_use_id,
              // Merge tool_result output into tool_use
              output: toolResult?.content || toolResult?.tool_output,
              isError: toolResult?.is_error,
              // Subagent data for Task tool calls
              subagentId: msg.subagent_id,
              subagentMessages,
            });
            break;
          }
          case "tool_result":
            // Skip - already merged into tool_use
            break;
          case "error":
            result.push({
              id: msg.id,
              type: "error",
              message: msg.content || "Unknown error",
              isError: true,
            });
            break;
        }
      });

      return result;
    };

    return convertMessages(executorMessages);
  }, [executorMessages]);

  // Compute executor session statistics for config bar
  const executorSessionStats = React.useMemo(() => {
    // Count unique tools used in this session
    const toolNames = new Set<string>();
    let totalContentLength = 0;

    executorMessages.forEach((msg) => {
      if (msg.type === "tool_use" && msg.tool_name) {
        toolNames.add(msg.tool_name);
      }
      // Estimate content length for token approximation
      if (msg.content) {
        totalContentLength += msg.content.length;
      }
      if (msg.tool_output) {
        totalContentLength += msg.tool_output.length;
      }
    });

    // Rough token estimate: ~4 chars per token
    const estimatedTokens = Math.round(totalContentLength / 4);

    return {
      toolsCount: toolNames.size,
      skillsCount: 0, // Skills are not tracked in executor sessions
      estimatedTokens,
    };
  }, [executorMessages]);

  // Get models supported by the selected executor type
  const executorModels = React.useMemo(() => {
    if (!selectedExecutorType) return [];

    // Define models per executor type
    const modelsByExecutor: Record<string, Array<{ id: string; name: string; provider: string }>> = {
      "claude-code": [
        { id: "claude-sonnet-4-20250514", name: "Claude Sonnet 4", provider: "Anthropic" },
        { id: "claude-4-opus-20250514", name: "Claude Opus 4", provider: "Anthropic" },
        { id: "claude-3-5-sonnet-20241022", name: "Claude 3.5 Sonnet", provider: "Anthropic" },
        { id: "claude-3-5-haiku-20241022", name: "Claude 3.5 Haiku", provider: "Anthropic" },
      ],
      "codex": [
        { id: "codex-mini-latest", name: "Codex Mini", provider: "OpenAI" },
        { id: "o3", name: "o3", provider: "OpenAI" },
        { id: "o4-mini", name: "o4-mini", provider: "OpenAI" },
      ],
      "cursor": [
        { id: "cursor-small", name: "Cursor Small", provider: "Cursor" },
        { id: "gpt-4o", name: "GPT-4o", provider: "OpenAI" },
        { id: "claude-3-5-sonnet", name: "Claude 3.5 Sonnet", provider: "Anthropic" },
      ],
    };

    return modelsByExecutor[selectedExecutorType] || [];
  }, [selectedExecutorType]);

  // Selected model state for executor (display only, executor sessions are read-only)
  const [selectedExecutorModelId, setSelectedExecutorModelId] = React.useState<string | null>(null);

  // Auto-select first model when executor changes
  React.useEffect(() => {
    if (executorModels.length > 0) {
      // Reset to first model when executor type changes
      setSelectedExecutorModelId(executorModels[0].id);
    } else {
      setSelectedExecutorModelId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedExecutorType]); // Only trigger on executor type change, executorModels is derived from it

  // Agents (using Gateway API)
  const { agents, defaultAgentId, setDefaultAgent, updateAgent, removeAgent } = useAgents({ workspacePath: workspace?.path });

  // Models for agent detail panel
  const { models: vibenModels } = useModels();
  const agentModelsForPanel = vibenModels.map((m) => ({
    id: m.id,
    name: m.name,
    provider: m.provider_id,
    enabled: m.is_available,
  }));

  // Get chat config for agent selection
  // selectedAgentId is the single source of truth for both sidebar and input bar
  const { selectedAgentId, setSelectedAgentId } = useChatConfig();

  // Chat notifications hook
  const { notifyAIResponse, notifyChatError } = useChatNotifications();

  // Get current conversation and selected agent
  const currentConversation = conversations.find(
    (c) => c.id === selectedConversationId
  );
  // Try to find agent in full agents list first, then fall back to chatListAgents
  // This ensures we can show details for both workspace and global agents
  const currentAgent = agents.find((a) => a.id === selectedAgentId);
  const currentChatListAgent = chatListAgents.find((a) => a.id === selectedAgentId);

  // Build agent config from current agent for the useAgent hook
  const currentAgentConfig = currentAgent ? {
    name: currentAgent.name,
    model: currentAgent.model,
    provider: currentAgent.provider,
    systemPrompt: currentAgent.system_prompt,
    appendPrompt: currentAgent.append_prompt,
    temperature: currentAgent.temperature,
    maxTokens: currentAgent.max_tokens,
    executorType: currentAgent.executor_type,
    mcpServers: currentAgent.mcp_servers,
    skills: currentAgent.skills,
    planMode: currentAgent.plan_mode,
    approvals: currentAgent.approvals,
  } : undefined;

  // Agent hook - use workspace path as workdir for the agent
  // Pass complete agent configuration directly
  const {
    messages,
    phase,
    isStreaming,
    pendingPlan,
    pendingQuestions,
    artifacts,
    toolUsages,
    error,
    sendMessage,
    approvePlan,
    rejectPlan,
    answerQuestions,
    cancel,
    clearMessages,
    loadMessages,
    gatewayConnected,
    checkGatewayConnection,
  } = useAgentConversation(workspace?.path || "", { agentConfig: currentAgentConfig });

  // Debug: Log messages changes
  React.useEffect(() => {
    console.log("[WorkspaceChat] messages changed:", messages.length, "isStreaming:", isStreaming, "phase:", phase);
    console.log("[WorkspaceChat] selectedConversationId:", selectedConversationId, "isGroupChatMode:", selectedGroupChatId !== null);
    if (messages.length > 0) {
      console.log("[WorkspaceChat] Last message:", messages[messages.length - 1]);
    }
  }, [messages, isStreaming, phase, selectedConversationId, selectedGroupChatId]);

  // Group notifications hook
  const {
    notifyGroupMessage,
    notifyMemberJoined,
    notifyMemberLeft,
  } = useGroupNotifications();

  // Group Chat hook - now uses session-based API
  const {
    groupChats,
    currentGroupChat,
    sessions: groupChatSessions,
    currentSession: currentGroupChatSession,
    messages: groupChatMessages,
    members: groupChatMembers,
    typingMembers,
    thinkingAgents,
    sessionAgents,
    viewMode: groupChatViewMode,
    viewAgentId: groupChatViewAgentId,
    isConnected: groupChatConnected,
    isLoading: isLoadingGroupChat,
    error: groupChatError,
    loadGroupChats,
    createGroupChat,
    loadGroupChat,
    updateGroupChat,
    deleteGroupChat,
    loadSessions: loadGroupChatSessions,
    createSession: createGroupChatSession,
    selectSession: selectGroupChatSession,
    addMember: addGroupChatMember,
    removeMember: removeGroupChatMember,
    sendMessage: sendGroupChatMessage,
    switchView: switchGroupChatView,
    sendTyping,
    setWorkspacePath: setGroupChatWorkspacePath,
  } = useGroupChat(selectedGroupChatId || undefined, selectedGroupSessionId || undefined, {
    userId: "user-1", // TODO: Get from auth context
    userDisplayName: "User",
    workspacePath: workspace?.path,
    autoConnect: true,
    notificationCallbacks: {
      onNewMessage: (groupId, groupName, message, currentUserId) => {
        console.log("[GroupChat] New message notification:", { groupId, groupName, senderId: message.sender_id, currentUserId });
        notifyGroupMessage(groupId, groupName, message, currentUserId);
      },
      onMemberJoined: (groupId, groupName, member) => {
        console.log("[GroupChat] Member joined notification:", { groupId, groupName, member: member.display_name });
        notifyMemberJoined(groupId, groupName, member);
      },
      onMemberLeft: (groupId, groupName, memberId, memberName) => {
        console.log("[GroupChat] Member left notification:", { groupId, groupName, memberId, memberName });
        notifyMemberLeft(groupId, groupName, memberId, memberName);
      },
    },
  });

  // Set workspace path when it becomes available
  React.useEffect(() => {
    if (workspace?.path) {
      setGroupChatWorkspacePath(workspace.path);
    }
  }, [workspace?.path, setGroupChatWorkspacePath]);

  // Load group chats when workspace path is available
  // Include global group chats from ~/.viben/group-chats/
  React.useEffect(() => {
    if (workspace?.path) {
      loadGroupChats({ workspace_path: workspace.path, include_global: true });
    }
  }, [workspace?.path, loadGroupChats]);

  // Check if we're in group chat mode
  const isGroupChatMode = selectedGroupChatId !== null;

  // Chat notifications - track previous state to detect changes
  const prevPhaseRef = React.useRef<string | null>(null);
  const prevErrorRef = React.useRef<string | null>(null);

  // Notify on AI response completion or error
  React.useEffect(() => {
    // Detect phase transition to completed
    if (prevPhaseRef.current === "running" && phase === "completed") {
      // Get the last assistant message for preview
      const lastAssistantMessage = [...messages].reverse().find(
        (m) => m.type === "text" || m.type === "result"
      );
      if (lastAssistantMessage && lastAssistantMessage.content) {
        const agentName = currentAgent?.name || t("chat.defaultAgent");
        notifyAIResponse(agentName, lastAssistantMessage.content, {
          agentId: selectedAgentId || undefined,
          workspaceId: workspaceId,
          sessionId: selectedConversationId || undefined,
        });
      }
    }
    prevPhaseRef.current = phase;
  }, [phase, messages, currentAgent, selectedAgentId, workspaceId, selectedConversationId, notifyAIResponse, t]);

  // Notify on error
  React.useEffect(() => {
    if (error && error !== prevErrorRef.current) {
      const agentName = currentAgent?.name;
      notifyChatError(error, agentName);
    }
    prevErrorRef.current = error;
  }, [error, currentAgent, notifyChatError]);

  // Refresh sessions for current agent (manual refresh button)
  const refreshAgentSessions = React.useCallback(async () => {
    if (!selectedAgentId || isLoadingRef.current) return;

    setIsLoadingSessions(true);
    setSessionsError(null);

    try {
      const client = getGatewayClient();
      const isReachable = await client.ping();
      if (!isReachable) {
        console.log(`[WorkspaceChat] Gateway not reachable, skipping session refresh`);
        return;
      }

      const sessions = await client.listAgentSessions(selectedAgentId);
      // Filter out sessions with missing id (invalid data from API)
      const validSessions = sessions.filter(s => s && s.id);
      const convs = validSessions.map(fileSessionToConversation);
      convs.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      setConversations(convs);
      console.log(`[WorkspaceChat] Refreshed ${convs.length} sessions for agent ${selectedAgentId}`);
    } catch (error) {
      console.error("[WorkspaceChat] Failed to refresh sessions from Gateway:", error);
      setSessionsError(error instanceof Error ? error.message : "Failed to refresh sessions");
    } finally {
      setIsLoadingSessions(false);
    }
  }, [selectedAgentId]);

  // Restore last selected agent on mount - run only once when agents are available
  const hasInitializedAgentRef = React.useRef(false);

  React.useEffect(() => {
    // Only run once
    if (hasInitializedAgentRef.current) {
      console.log("[WorkspaceChat:Effect:InitAgent] Already initialized, skipping");
      return;
    }

    if (!workspaceId || agents.length === 0) {
      console.log("[WorkspaceChat:Effect:InitAgent] No workspace or agents yet, waiting");
      return;
    }

    hasInitializedAgentRef.current = true;

    // Restore last selected agent
    const lastAgentId = loadLastAgentId(workspaceId);
    console.log(`[WorkspaceChat:Effect:InitAgent] Initializing agent: lastAgentId=${lastAgentId}, defaultAgentId=${defaultAgentId}`);

    if (lastAgentId && agents.some((a) => a.id === lastAgentId)) {
      console.log(`[WorkspaceChat:Effect:InitAgent] Restoring last agent: ${lastAgentId}`);
      setSelectedAgentId(lastAgentId);
    } else {
      // Set default agent if no previous selection
      const agentToSelect = defaultAgentId || agents[0].id;
      console.log(`[WorkspaceChat:Effect:InitAgent] Setting default agent: ${agentToSelect}`);
      setSelectedAgentId(agentToSelect);
    }
  }, [workspaceId, agents, defaultAgentId]);

  // Refs to track loading state and prevent loops
  const prevAgentRef = React.useRef<string | null>(null);
  const isLoadingRef = React.useRef(false);

  // Combined effect: Load sessions and auto-select when agent changes
  // Using a single async flow to prevent cascading effects
  React.useEffect(() => {
    // Guard: no agent selected
    if (!selectedAgentId) {
      console.log("[WorkspaceChat:Effect:Sessions] No agent selected, skipping");
      return;
    }

    // Guard: already loading
    if (isLoadingRef.current) {
      console.log("[WorkspaceChat:Effect:Sessions] Already loading, skipping");
      return;
    }

    // Guard: same agent (already loaded)
    if (prevAgentRef.current === selectedAgentId) {
      console.log("[WorkspaceChat:Effect:Sessions] Same agent, skipping");
      return;
    }

    // Detect if this is an agent switch (not initial load)
    const isAgentSwitch = prevAgentRef.current !== null;
    const previousAgent = prevAgentRef.current;

    console.log(`[WorkspaceChat:Effect:Sessions] Agent changed: ${previousAgent} -> ${selectedAgentId}, isSwitch=${isAgentSwitch}`);

    // Mark as loading and update ref BEFORE any async work
    isLoadingRef.current = true;
    prevAgentRef.current = selectedAgentId;

    // Capture current agent ID for closure
    const targetAgentId = selectedAgentId;

    // Single async flow to load sessions and auto-select
    const loadAndSelect = async () => {
      console.log(`[WorkspaceChat:Effect:Sessions] Starting load for agent ${targetAgentId}`);

      // Clear current session when switching agents - do this synchronously before async
      if (isAgentSwitch) {
        console.log("[WorkspaceChat:Effect:Sessions] Clearing conversation for agent switch");
        setSelectedConversationId(null);
        setConversations([]);
      }

      setIsLoadingSessions(true);
      setSessionsError(null);

      try {
        const client = getGatewayClient();
        const isReachable = await client.ping();

        // Check if agent changed during async
        if (prevAgentRef.current !== targetAgentId) {
          console.log(`[WorkspaceChat:Effect:Sessions] Agent changed during ping, aborting (${targetAgentId} -> ${prevAgentRef.current})`);
          return;
        }

        if (!isReachable) {
          console.log(`[WorkspaceChat:Effect:Sessions] Gateway not reachable`);
          setConversations([]);
          return;
        }

        console.log(`[WorkspaceChat:Effect:Sessions] Fetching sessions for ${targetAgentId}`);
        const sessions = await client.listAgentSessions(targetAgentId);

        // Check if agent changed during fetch
        if (prevAgentRef.current !== targetAgentId) {
          console.log(`[WorkspaceChat:Effect:Sessions] Agent changed during fetch, aborting`);
          return;
        }

        // Filter out sessions with missing id (invalid data from API)
        const validSessions = sessions.filter(s => s && s.id);
        const convs = validSessions.map(fileSessionToConversation);
        convs.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

        console.log(`[WorkspaceChat:Effect:Sessions] Loaded ${convs.length} sessions for agent ${targetAgentId}`);

        // Batch state updates
        if (convs.length > 0) {
          console.log(`[WorkspaceChat:Effect:Sessions] Setting conversations and selecting first: ${convs[0].id}`);
          setConversations(convs);
          setSelectedConversationId(convs[0].id);
        } else {
          console.log(`[WorkspaceChat:Effect:Sessions] No sessions, setting empty conversations`);
          setConversations([]);
          // Don't set selectedConversationId to null here - it's already null or will cause issues
        }
      } catch (error) {
        console.error("[WorkspaceChat:Effect:Sessions] Failed to load sessions:", error);
        setSessionsError(error instanceof Error ? error.message : "Failed to load sessions");
        setConversations([]);
      } finally {
        console.log(`[WorkspaceChat:Effect:Sessions] Finished loading for ${targetAgentId}`);
        setIsLoadingSessions(false);
        isLoadingRef.current = false;
      }
    };

    loadAndSelect();
  }, [selectedAgentId]);

  // Save last selected session whenever it changes
  React.useEffect(() => {
    if (workspaceId && selectedConversationId) {
      saveLastSessionId(workspaceId, selectedConversationId);
    }
  }, [workspaceId, selectedConversationId]);

  // Save last selected agent whenever it changes
  React.useEffect(() => {
    if (workspaceId && selectedAgentId) {
      saveLastAgentId(workspaceId, selectedAgentId);
    }
  }, [workspaceId, selectedAgentId]);

  // Navigate back if workspace not found after loading
  React.useEffect(() => {
    if (!isLoadingWorkspace && !workspace && workspaceId) {
      navigate(`/workspace/${workspaceId}`);
    }
  }, [isLoadingWorkspace, workspace, workspaceId, navigate]);

  // Load messages from Gateway when session changes
  const prevSessionRef = React.useRef<string | null>(null);
  const isLoadingMessagesRef = React.useRef(false);

  React.useEffect(() => {
    console.log(`[WorkspaceChat:Effect:Messages] Effect triggered: session=${selectedConversationId}, agent=${selectedAgentId}`);

    // Early return if no session or agent selected
    if (!selectedConversationId || !selectedAgentId) {
      console.log("[WorkspaceChat:Effect:Messages] No session or agent, resetting ref");
      prevSessionRef.current = null;
      return;
    }

    // Skip if same session (already loaded)
    if (prevSessionRef.current === selectedConversationId) {
      console.log("[WorkspaceChat:Effect:Messages] Same session, skipping");
      return;
    }

    // Prevent concurrent loads
    if (isLoadingMessagesRef.current) {
      console.log("[WorkspaceChat:Effect:Messages] Already loading messages, skipping");
      return;
    }

    console.log(`[WorkspaceChat:Effect:Messages] Session changed: ${prevSessionRef.current} -> ${selectedConversationId}`);

    // Update ref BEFORE async work
    prevSessionRef.current = selectedConversationId;
    isLoadingMessagesRef.current = true;

    // Capture values for async closure
    const agentId = selectedAgentId;
    const sessionId = selectedConversationId;

    const loadSessionMessages = async () => {
      console.log(`[WorkspaceChat:Effect:Messages] Loading UI messages for session ${sessionId}`);

      try {
        const client = getGatewayClient();
        // Use the new UI messages endpoint for proper rendering
        const uiMessages = await client.listSessionUIMessages(agentId, sessionId);

        // Check if session is still the same after async call
        if (prevSessionRef.current !== sessionId) {
          console.log(`[WorkspaceChat:Effect:Messages] Session changed during load, aborting`);
          return;
        }

        if (uiMessages.length > 0) {
          // Convert UI messages to agent messages, filtering out null results
          const agentMessages = uiMessages
            .map(uiMessageToAgentMessage)
            .filter((msg): msg is import("@/types").AgentMessage => msg !== null);
          console.log(`[WorkspaceChat:Effect:Messages] Loaded ${agentMessages.length} messages from ${uiMessages.length} UI messages, calling loadMessages`);
          loadMessages(agentMessages);
        } else {
          console.log(`[WorkspaceChat:Effect:Messages] No messages, calling clearMessages`);
          clearMessages();
        }
      } catch (error) {
        console.error("[WorkspaceChat:Effect:Messages] Failed to load UI messages:", error);
        if (prevSessionRef.current === sessionId) {
          clearMessages();
        }
      } finally {
        console.log(`[WorkspaceChat:Effect:Messages] Finished loading for ${sessionId}`);
        isLoadingMessagesRef.current = false;
      }
    };

    loadSessionMessages();
    // NOTE: We intentionally exclude loadMessages and clearMessages from deps
    // They are stable callbacks but including them can cause issues with React's effect comparisons
  }, [selectedConversationId, selectedAgentId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Save messages to Gateway whenever they change
  React.useEffect(() => {
    // Note: Messages are automatically saved by the agent executor during chat
    // This effect is kept for potential future use or manual persistence
  }, [selectedConversationId, messages]);

  // Filter group chats by search query (from useChatList)
  const filteredGroupChats = React.useMemo(() => {
    // Use groupChats from useGroupChat since it has full data
    // ChatListItem doesn't have enough data for GroupChatListItem
    if (!searchQuery.trim()) return groupChats;
    const query = searchQuery.toLowerCase();
    return groupChats.filter(
      (g) =>
        g.name.toLowerCase().includes(query) ||
        (g.description?.toLowerCase().includes(query) ?? false)
    );
  }, [groupChats, searchQuery]);

  // Filter agents by search query (from useChatList)
  const filteredChatListAgents = React.useMemo(() => {
    if (!searchQuery.trim()) return chatListAgents;
    const query = searchQuery.toLowerCase();
    return chatListAgents.filter(
      (a) =>
        a.name.toLowerCase().includes(query) ||
        (a.description?.toLowerCase().includes(query) ?? false)
    );
  }, [chatListAgents, searchQuery]);

  // Note: filteredAgents from useVibenAgents is no longer used in the sidebar
  // The sidebar now uses filteredChatListAgents from useChatList which includes both workspace and global agents

  // Filter executors by search query (from useChatList)
  const filteredExecutors = React.useMemo(() => {
    if (!searchQuery.trim()) return chatListExecutors;
    const query = searchQuery.toLowerCase();
    return chatListExecutors.filter(
      (e) =>
        e.name.toLowerCase().includes(query) ||
        (e.icon_type?.toLowerCase().includes(query) ?? false)
    );
  }, [chatListExecutors, searchQuery]);

  // Get sessions/conversations for the selected agent
  const agentConversations = React.useMemo(() => {
    if (!selectedAgentId) return conversations;
    return conversations.filter((c) => c.agentId === selectedAgentId);
  }, [conversations, selectedAgentId]);

  // Convert executor sessions to Session format for SessionSelector
  const executorSessionsForSelector = React.useMemo(() => {
    return executorSessions.map((session) => ({
      id: session.id,
      name: session.name || `Session ${session.id.slice(0, 8)}`,
      createdAt: session.created_at,
      updatedAt: session.updated_at,
      messageCount: session.message_count,
    }));
  }, [executorSessions]);

  // Create new conversation for the selected agent
  const handleCreateConversation = async () => {
    if (!workspaceId || !selectedAgentId) return;

    try {
      const client = getGatewayClient();
      const agent = agents.find((a) => a.id === selectedAgentId);

      // Create agent config snapshot (preserve agent state at session creation)
      const agentConfigSnapshot = agent ? {
        id: agent.id,
        name: agent.name,
        description: agent.description,
        model: agent.model,
        provider: agent.provider,
        system_prompt: agent.system_prompt,
        temperature: agent.temperature,
        max_tokens: agent.max_tokens,
        plan_mode: agent.plan_mode,
        approvals: agent.approvals,
      } : undefined;

      const newSession = await client.createAgentSession(selectedAgentId, {
        prompt: t("chat.newConversation") + (agent ? ` - ${agent.name}` : ""),
        // Save agent config snapshot for reliable reference
        agent_config: agentConfigSnapshot,
        // Save workspace path for global agents running in this workspace
        workspace_path: workspace?.path,
      });

      const newConversation = fileSessionToConversation(newSession);
      const updated = [newConversation, ...conversations];
      setConversations(updated);
      setSelectedConversationId(newConversation.id);
      clearMessages();
      console.log(`[WorkspaceChat] Created new session ${newSession.id} for agent ${selectedAgentId}`);
    } catch (error) {
      console.error("[WorkspaceChat] Failed to create session:", error);
      // Fallback: create local conversation
      const agent = agents.find((a) => a.id === selectedAgentId);
      const newConversation: Conversation = {
        id: `local_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        title: t("chat.newConversation") + (agent ? ` - ${agent.name}` : ""),
        agentId: selectedAgentId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messageCount: 0,
      };
      const updated = [newConversation, ...conversations];
      setConversations(updated);
      setSelectedConversationId(newConversation.id);
      clearMessages();
    }
  };

  // Rename session (local state only for now)
  const handleRenameSession = (sessionId: string, newTitle: string) => {
    if (!workspaceId) return;
    const updated = conversations.map((c) =>
      c.id === sessionId ? { ...c, title: newTitle, updatedAt: new Date().toISOString() } : c
    );
    setConversations(updated);
  };

  // Delete session
  const handleDeleteSession = async (sessionId: string) => {
    if (!workspaceId || !selectedAgentId) return;

    try {
      const client = getGatewayClient();
      await client.deleteAgentSession(selectedAgentId, sessionId);
      console.log(`[WorkspaceChat] Deleted session ${sessionId}`);
    } catch (error) {
      console.error("[WorkspaceChat] Failed to delete session from Gateway:", error);
    }

    // Update local state
    const updated = conversations.filter((c) => c.id !== sessionId);
    setConversations(updated);
    if (selectedConversationId === sessionId) {
      setSelectedConversationId(updated.length > 0 ? updated[0].id : null);
      clearMessages();
    }
  };

  // Pin/Unpin session (local state only for now)
  const handlePinSession = (sessionId: string) => {
    if (!workspaceId) return;
    const updated = conversations.map((c) =>
      c.id === sessionId ? { ...c, isPinned: !c.isPinned, updatedAt: new Date().toISOString() } : c
    );
    updated.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
    setConversations(updated);
  };

  // Archive session (local state only for now)
  const handleArchiveSession = (sessionId: string) => {
    if (!workspaceId) return;
    const updated = conversations.map((c) =>
      c.id === sessionId ? { ...c, isArchived: true } : c
    );
    setConversations(updated);
    if (selectedConversationId === sessionId) {
      const remaining = updated.filter((c) => !c.isArchived);
      setSelectedConversationId(remaining.length > 0 ? remaining[0].id : null);
      clearMessages();
    }
  };

  // Star/Unstar session (local state only for now)
  const handleStarSession = (sessionId: string) => {
    if (!workspaceId) return;
    const updated = conversations.map((c) =>
      c.id === sessionId ? { ...c, isStarred: !c.isStarred } : c
    );
    setConversations(updated);
  };

  // Duplicate session
  const handleDuplicateSession = async (sessionId: string) => {
    if (!workspaceId || !selectedAgentId) return;
    const original = conversations.find((c) => c.id === sessionId);
    if (!original) return;

    try {
      const client = getGatewayClient();
      const agent = agents.find((a) => a.id === selectedAgentId);

      // Create agent config snapshot
      const agentConfigSnapshot = agent ? {
        id: agent.id,
        name: agent.name,
        description: agent.description,
        model: agent.model,
        provider: agent.provider,
        system_prompt: agent.system_prompt,
        temperature: agent.temperature,
        max_tokens: agent.max_tokens,
        plan_mode: agent.plan_mode,
        approvals: agent.approvals,
      } : undefined;

      const newSession = await client.createAgentSession(selectedAgentId, {
        prompt: t("chat.copyName", { name: original.title }),
        agent_config: agentConfigSnapshot,
        workspace_path: workspace?.path,
      });
      const duplicate = fileSessionToConversation(newSession);
      const updated = [duplicate, ...conversations];
      setConversations(updated);
      setSelectedConversationId(duplicate.id);
      console.log(`[WorkspaceChat] Duplicated session ${sessionId} as ${newSession.id}`);
    } catch (error) {
      console.error("[WorkspaceChat] Failed to duplicate session:", error);
    }
  };

  // Handle sending message
  const handleSendMessage = async (message: string) => {
    if (!workspaceId || !selectedConversationId) {
      // Create a new conversation if none selected
      await handleCreateConversation();
    }

    // Save message to Gateway
    if (selectedAgentId && selectedConversationId) {
      try {
        const client = getGatewayClient();
        await client.appendSessionMessage(selectedAgentId, selectedConversationId, {
          role: "user",
          content: message,
        });
      } catch (error) {
        console.error("[WorkspaceChat] Failed to save message to Gateway:", error);
      }
    }

    await sendMessage(message);

    // Update conversation with last message (local state)
    if (selectedConversationId) {
      const updated = conversations.map((c) =>
        c.id === selectedConversationId
          ? {
              ...c,
              lastMessage: message.slice(0, 100),
              messageCount: c.messageCount + 1,
              updatedAt: new Date().toISOString(),
            }
          : c
      );
      setConversations(updated);
    }
  };

  // Clear current conversation's messages
  const handleClearMessages = () => {
    clearMessages();
    if (selectedConversationId && workspaceId) {
      const updated = conversations.map((c) =>
        c.id === selectedConversationId
          ? { ...c, messageCount: 0, lastMessage: undefined, updatedAt: new Date().toISOString() }
          : c
      );
      setConversations(updated);
    }
    setIsClearDialogOpen(false);
  };

  // Archive conversation
  const handleArchiveConversation = () => {
    if (!workspaceId || !selectedConversationId) return;

    const updated = conversations.map((c) =>
      c.id === selectedConversationId ? { ...c, isArchived: true } : c
    );
    setConversations(updated);

    // Select next conversation
    const remaining = updated.filter((c) => !c.isArchived);
    setSelectedConversationId(remaining.length > 0 ? remaining[0].id : null);
    clearMessages();
  };

  // Export conversation as JSON
  const handleExportConversation = () => {
    if (!currentConversation) return;

    const exportData = {
      title: currentConversation.title,
      agent: currentAgent?.name || "Default Agent",
      createdAt: currentConversation.createdAt,
      messages: messages.map((m) => ({
        type: m.type,
        content: m.content,
      })),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${currentConversation.title.replace(/[^a-z0-9]/gi, "_")}_${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setIsExportDialogOpen(false);
  };

  // Share conversation (copy to clipboard)
  const handleShareConversation = () => {
    if (!currentConversation) return;

    const shareText = messages
      .map((m) => `${m.type === "user" ? t("chat.you") : currentAgent?.name || "Agent"}: ${m.content}`)
      .join("\n\n");

    navigator.clipboard.writeText(shareText);
    setIsShareDialogOpen(false);
  };

  // Handle creating a group chat
  const handleCreateGroupChat = async (data: {
    name: string;
    description?: string;
    initial_members: Array<{
      member_type: "human" | "agent";
      member_id: string;
      display_name: string;
      role?: "owner" | "admin" | "member";
      model?: string;
    }>;
  }) => {
    setIsCreatingGroupChat(true);
    try {
      // Convert initial_members to CreateMemberInput format
      const members = data.initial_members.map((m) => ({
        type: m.member_type,
        member_id: m.member_id,
        display_name: m.display_name,
        role: m.role,
        model: m.model,
      }));

      const result = await createGroupChat({
        name: data.name,
        description: data.description,
        members,
      });
      // Switch to the new group chat
      setSelectedGroupChatId(result.group_chat.id);
      setSelectedConversationId(null);
      setIsCreateGroupDialogOpen(false);

      // Create initial session for the new group chat
      if (result.group_chat.id) {
        try {
          const session = await createGroupChatSession(result.group_chat.id, "Initial Session");
          setSelectedGroupSessionId(session.id);
        } catch (err) {
          console.error("[WorkspaceChat] Failed to create initial session:", err);
        }
      }
    } catch (error) {
      console.error("[WorkspaceChat] Failed to create group chat:", error);
      throw error;
    } finally {
      setIsCreatingGroupChat(false);
    }
  };

  // Handle selecting a group chat
  const handleSelectGroupChat = async (groupChatId: string) => {
    setSelectedGroupChatId(groupChatId);
    setSelectedConversationId(null);
    setSelectedGroupSessionId(null);
    await loadGroupChat(groupChatId);
    await loadGroupChatSessions(groupChatId);

    // Auto-select first session or create one if none exist
    if (groupChatSessions.length > 0) {
      setSelectedGroupSessionId(groupChatSessions[0].id);
    }
  };

  // Handle sending message in group chat
  const handleSendGroupChatMessage = async (content: string) => {
    if (!selectedGroupChatId || !selectedGroupSessionId || !content.trim()) return;
    try {
      await sendGroupChatMessage(content);
    } catch (error) {
      console.error("[WorkspaceChat] Failed to send group chat message:", error);
    }
  };

  // Handle deleting a group chat
  const handleDeleteGroupChat = async (groupChatId: string) => {
    try {
      await deleteGroupChat(groupChatId);
      if (selectedGroupChatId === groupChatId) {
        setSelectedGroupChatId(null);
        setSelectedGroupSessionId(null);
      }
    } catch (error) {
      console.error("[WorkspaceChat] Failed to delete group chat:", error);
    }
  };

  // Handle leaving a group chat (remove self from members)
  const handleLeaveGroupChat = async () => {
    if (!selectedGroupChatId) return;
    try {
      // Remove self from group chat
      await removeGroupChatMember("user-1");
      setSelectedGroupChatId(null);
      setSelectedGroupSessionId(null);
    } catch (error) {
      console.error("[WorkspaceChat] Failed to leave group chat:", error);
    }
  };

  // Handle creating a new group chat session
  const handleCreateGroupChatSession = async () => {
    if (!selectedGroupChatId) return;
    try {
      const session = await createGroupChatSession(selectedGroupChatId, `Session ${groupChatSessions.length + 1}`);
      setSelectedGroupSessionId(session.id);
    } catch (error) {
      console.error("[WorkspaceChat] Failed to create group chat session:", error);
    }
  };

  // Handle selecting a group chat session
  const handleSelectGroupChatSession = (sessionId: string) => {
    setSelectedGroupSessionId(sessionId);
    selectGroupChatSession(sessionId);
  };

  // Handle switching view mode in group chat
  const handleSwitchGroupChatView = (view: "ui" | "agent", agentId?: string) => {
    switchGroupChatView(view, agentId);
  };

  // Handle renaming a group chat
  const handleRenameGroupChat = async (groupChatId: string, newName: string) => {
    if (!newName.trim()) return;
    try {
      await updateGroupChat(groupChatId, { name: newName.trim() });
      setRenameGroupChatId(null);
      setRenameGroupChatName("");
    } catch (error) {
      console.error("[WorkspaceChat] Failed to rename group chat:", error);
    }
  };

  // Handle toggling mute for a group chat
  const handleToggleMuteGroupChat = (groupChatId: string) => {
    setMutedGroupChats((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(groupChatId)) {
        newSet.delete(groupChatId);
      } else {
        newSet.add(groupChatId);
      }
      return newSet;
    });
  };

  // Handle opening rename dialog
  const handleOpenRenameDialog = (groupChatId: string, currentName: string) => {
    setRenameGroupChatId(groupChatId);
    setRenameGroupChatName(currentName);
  };

  // Handle adding a member to the current group chat
  const handleAddGroupChatMember = async (member: {
    type: MemberType;
    member_id: string;
    display_name: string;
    role?: MemberRole;
    model?: string;
  }) => {
    try {
      await addGroupChatMember(member);
    } catch (error) {
      console.error("[WorkspaceChat] Failed to add member:", error);
      throw error;
    }
  };

  // Handle removing a member from the current group chat
  const handleRemoveGroupChatMember = async (memberId: string) => {
    try {
      await removeGroupChatMember(memberId);
    } catch (error) {
      console.error("[WorkspaceChat] Failed to remove member:", error);
      throw error;
    }
  };

  // Get current user's role in the group chat
  const currentUserGroupRole = React.useMemo(() => {
    if (!groupChatMembers.length) return undefined;
    const currentUserMember = groupChatMembers.find(
      (m) => m.member_type === "human" && m.member_id === "user-1"
    );
    return currentUserMember?.role;
  }, [groupChatMembers]);

  // Filter messages by search query
  const filteredMessages = React.useMemo(() => {
    if (!conversationSearchQuery.trim()) return messages;
    const query = conversationSearchQuery.toLowerCase();
    return messages.filter((m) => m.content?.toLowerCase().includes(query));
  }, [messages, conversationSearchQuery]);

  // Navigate to full agent settings
  // Use the agent selected in config bar, or fall back to conversation's agent
  const handleNavigateToAgentSettings = () => {
    const targetAgentId = selectedAgentId || currentAgent?.id;
    if (targetAgentId && workspaceId) {
      navigate(`/workspace/${workspaceId}/agent/${targetAgentId}`);
    }
  };

  if (isLoadingWorkspace) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-sm">{t("common.loading")}</p>
        </div>
      </div>
    );
  }

  if (!workspace) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex h-full flex-col overflow-hidden"
    >
      {/* Header with breadcrumb */}
      <WorkspaceHeader
        workspace={workspace}
        segments={[{ label: t("chat.title"), href: `/workspace/${workspaceId}/chat` }]}
        showRefresh={false}
        showRemove={false}
        rightContent={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="h-8"
          >
            {isSidebarOpen ? (
              <PanelRightClose className="h-4 w-4" />
            ) : (
              <PanelRightOpen className="h-4 w-4" />
            )}
          </Button>
        }
      />

      {/* Main content - WeChat style layout */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left: Executor List (resizable) - collapsible */}
        {isLeftPanelCollapsed ? (
          /* Collapsed state - show expand button */
          <div className="border-r flex flex-col items-center py-3 px-1 bg-background shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={() => setIsLeftPanelCollapsed(false)}
              title={t("chat.showPanel", "Show Panel")}
            >
              <PanelLeftOpen className="h-4 w-4" />
            </Button>
          </div>
        ) : (
        <div
          className="relative border-r flex flex-col bg-background shrink-0 overflow-visible"
          style={{ width: leftPanelWidth }}
        >
          {/* Resize handle */}
          <ResizeHandle side="left" onResize={handleLeftPanelResize} />
          {/* Header with search and + button */}
          <div className="px-3 py-2.5 border-b h-[57px] flex items-center">
            <div className="flex items-center gap-2 flex-1">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t("executor.searchExecutors", "Search executors...")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>
              {/* Add button with dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="h-9 w-9 shrink-0">
                    <Plus className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => setIsCreateAgentDialogOpen(true)}>
                    <Bot className="h-4 w-4 mr-2" />
                    {t("agent.createAgent", "Create Agent")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setIsCreateGroupDialogOpen(true)}>
                    <Users className="h-4 w-4 mr-2" />
                    {t("chat.createGroup", "Create Group")}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setIsLeftPanelCollapsed(true)}>
                    <PanelLeftClose className="h-4 w-4 mr-2" />
                    {t("chat.hidePanel", "Hide Panel")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Executor List */}
          <ScrollArea className="flex-1" ref={leftPanelScrollRef}>
            <div className="p-2 space-y-1" style={leftPanelContentStyle}>
              {/* Group Chats Section */}
              {filteredGroupChats.length > 0 && (
                <>
                  <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {t("groupChat.groupChats", "Group Chats")}
                  </div>
                  {filteredGroupChats.map((groupChat) => (
                    <GroupChatListItem
                      key={groupChat.id}
                      groupChat={groupChat}
                      isSelected={groupChat.id === selectedGroupChatId}
                      isMuted={mutedGroupChats.has(groupChat.id)}
                      source={workspace?.path ? { type: "workspace", path: workspace.path } : undefined}
                      onClick={() => handleSelectGroupChat(groupChat.id)}
                      onRename={() => handleOpenRenameDialog(groupChat.id, groupChat.name)}
                      onToggleMute={() => handleToggleMuteGroupChat(groupChat.id)}
                      onDelete={() => handleDeleteGroupChat(groupChat.id)}
                      onLeave={handleLeaveGroupChat}
                    />
                  ))}
                </>
              )}

              {/* Executors Section */}
              <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {t("executor.executors", "Executors")}
              </div>
              <ExecutorList
                executors={filteredExecutors}
                selectedExecutorId={selectedSidebarExecutorId}
                source={workspace?.path ? { type: "workspace", path: workspace.path } : undefined}
                onSelect={(executor) => {
                  // Exit group chat mode and select executor
                  setSelectedGroupChatId(null);
                  setSelectedGroupSessionId(null);
                  setSelectedSidebarExecutorId(executor.id);
                }}
                onSettings={(executor) => {
                  if (workspaceId) {
                    navigate(`/workspace/${workspaceId}/executor/${executor.id}`);
                  }
                }}
                onRefresh={loadExecutors}
                isLoading={isLoadingExecutors}
                className="px-0"
              />

              {/* Agents Section (from useChatList - includes both workspace and global agents) */}
              {filteredChatListAgents.length > 0 && (
                <>
                  <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider mt-2">
                    {t("agent.agents", "Agents")}
                  </div>
                  {filteredChatListAgents.map((chatListAgent) => {
                    // Get full agent data from useVibenAgents for default status and session count
                    const fullAgent = agents.find((a) => a.id === chatListAgent.id);
                    return (
                      <AgentListItem
                        key={chatListAgent.id}
                        agent={{
                          id: chatListAgent.id,
                          name: chatListAgent.name,
                          description: chatListAgent.description,
                        }}
                        isSelected={chatListAgent.id === selectedAgentId && !isGroupChatMode && !selectedSidebarExecutorId}
                        isDefault={chatListAgent.id === defaultAgentId}
                        sessionCount={fullAgent ? conversations.filter((c) => c.agentId === chatListAgent.id).length : undefined}
                        source={
                          chatListAgent.source === "global"
                            ? { type: "global", path: "~/.viben/agents" }
                            : workspace?.path
                              ? { type: "workspace", path: workspace.path }
                              : undefined
                        }
                        onSelect={() => {
                          // Exit group chat mode and executor mode, select agent
                          setSelectedGroupChatId(null);
                          setSelectedGroupSessionId(null);
                          setSelectedSidebarExecutorId(null);
                          setSelectedAgentId(chatListAgent.id);
                        }}
                        onSettings={fullAgent ? () => {
                          if (workspaceId) {
                            navigate(`/workspace/${workspaceId}/agent/${chatListAgent.id}`);
                          }
                        } : undefined}
                        onSetDefault={fullAgent ? () => setDefaultAgent(chatListAgent.id) : undefined}
                        onDelete={fullAgent ? () => removeAgent(chatListAgent.id) : undefined}
                      />
                    );
                  })}
                </>
              )}
            </div>
          </ScrollArea>
        </div>
        )}

        {/* Middle: Chat Area */}
        <div className="flex flex-1 w-0 flex-col min-w-0 overflow-hidden">
          {/* Group Chat Mode */}
          {isGroupChatMode && currentGroupChat ? (
            <>
              {/* Group Chat Header */}
              <div className="flex items-center justify-between px-4 border-b bg-background h-[57px]">
                <div className="flex items-center gap-3">
                  {/* Group avatar */}
                  <div className="relative w-9 h-9 rounded-lg bg-gradient-to-br from-purple-500 to-pink-400 flex items-center justify-center shadow-sm">
                    <Users className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">
                        {currentGroupChat.group_chat.name}
                      </span>
                      {/* Global badge */}
                      {currentGroupChat.group_chat.is_global && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600">
                          {t("groupChat.global", "Global")}
                        </span>
                      )}
                      {/* Connection status */}
                      {groupChatConnected ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/10 text-green-600">
                          {t("groupChat.connected", "Connected")}
                        </span>
                      ) : (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-600">
                          {t("groupChat.disconnected", "Disconnected")}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t("groupChat.memberCount", "{{count}} members", {
                        count: groupChatMembers.length,
                      })}
                    </p>
                  </div>
                </div>

                {/* Group Chat action buttons */}
                <div className="flex items-center gap-2">
                  {/* Session Selector */}
                  <SessionSelector
                    currentSession={
                      currentGroupChatSession
                        ? {
                            id: currentGroupChatSession.id,
                            name: currentGroupChatSession.title || `Session ${currentGroupChatSession.id.slice(0, 8)}`,
                            createdAt: currentGroupChatSession.created_at,
                            updatedAt: currentGroupChatSession.updated_at,
                            messageCount: 0,
                          }
                        : undefined
                    }
                    sessions={groupChatSessions.map((s) => ({
                      id: s.id,
                      name: s.title || `Session ${s.id.slice(0, 8)}`,
                      createdAt: s.created_at,
                      updatedAt: s.updated_at,
                      messageCount: 0,
                    }))}
                    onSelect={(session) => handleSelectGroupChatSession(session.id)}
                    onCreateNew={handleCreateGroupChatSession}
                    showCreateButton={true}
                    agentName={currentGroupChat.group_chat.name}
                  />

                  {/* View Toggle */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="h-8 gap-1.5">
                        {groupChatViewMode === "ui" ? (
                          <>
                            <MessageSquare className="h-3.5 w-3.5" />
                            {t("groupChat.viewUI", "Chat View")}
                          </>
                        ) : (
                          <>
                            <Bot className="h-3.5 w-3.5" />
                            {t("groupChat.viewAgent", "Agent View")}
                          </>
                        )}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem
                        onClick={() => handleSwitchGroupChatView("ui")}
                        className={cn(groupChatViewMode === "ui" && "bg-accent")}
                      >
                        <MessageSquare className="h-4 w-4 mr-2" />
                        {t("groupChat.viewUI", "Chat View")}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                        {t("groupChat.agentViews", "Agent Views")}
                      </div>
                      {sessionAgents.map((agentId) => {
                        const agentMember = groupChatMembers.find(
                          (m) => m.member_type === "agent" && m.id === agentId
                        );
                        return (
                          <DropdownMenuItem
                            key={agentId}
                            onClick={() => handleSwitchGroupChatView("agent", agentId)}
                            className={cn(
                              groupChatViewMode === "agent" && groupChatViewAgentId === agentId && "bg-accent"
                            )}
                          >
                            <Bot className="h-4 w-4 mr-2" />
                            {agentMember?.display_name || agentId}
                          </DropdownMenuItem>
                        );
                      })}
                      {sessionAgents.length === 0 && (
                        <div className="px-2 py-1.5 text-xs text-muted-foreground italic">
                          {t("groupChat.noAgents", "No agents in session")}
                        </div>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    title={t("groupChat.viewDetails", "View Details")}
                    onClick={() => setIsMembersDialogOpen(true)}
                  >
                    <Users className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Thinking agents indicator */}
              {thinkingAgents.length > 0 && (
                <div className="px-4 py-2 bg-muted/30 border-b flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {thinkingAgents.map((agentId) => {
                      const agent = groupChatMembers.find((m) => m.id === agentId);
                      return agent?.display_name || agentId;
                    }).join(", ")}{" "}
                    {t("groupChat.thinking", "thinking...")}
                  </span>
                </div>
              )}

              {/* Group Chat Messages */}
              <GroupChatMessageList
                messages={groupChatMessages}
                members={groupChatMembers}
                currentUserId="user-1"
                typingMembers={typingMembers}
                className="flex-1"
              />

              {/* Group Chat Error */}
              {groupChatError && (
                <div className="px-4 py-2 bg-destructive/10 border-t border-destructive/20">
                  <p className="text-sm text-destructive">{groupChatError}</p>
                </div>
              )}

              {/* Group Chat Input - disabled in agent view */}
              {groupChatViewMode === "ui" ? (
                <div className="border-t border-border p-4">
                  <div className="flex gap-2">
                    <Input
                      placeholder={t("groupChat.inputPlaceholder", "Type a message...")}
                      value={groupChatInput}
                      onChange={(e) => setGroupChatInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSendGroupChatMessage(groupChatInput);
                          setGroupChatInput("");
                        }
                      }}
                      onFocus={() => sendTyping(true)}
                      onBlur={() => sendTyping(false)}
                      className="flex-1"
                      disabled={!selectedGroupSessionId}
                    />
                    <Button
                      onClick={() => {
                        handleSendGroupChatMessage(groupChatInput);
                        setGroupChatInput("");
                      }}
                      disabled={!groupChatInput.trim() || isLoadingGroupChat || !selectedGroupSessionId}
                    >
                      {t("common.send", "Send")}
                    </Button>
                  </div>
                  {!selectedGroupSessionId && (
                    <p className="text-xs text-muted-foreground mt-2">
                      {t("groupChat.selectSession", "Select or create a session to start chatting")}
                    </p>
                  )}
                </div>
              ) : (
                <div className="border-t border-border p-4 bg-muted/20">
                  <p className="text-sm text-muted-foreground text-center">
                    {t("groupChat.agentViewReadOnly", "Agent view is read-only. Switch to Chat View to send messages.")}
                  </p>
                </div>
              )}
            </>
          ) : selectedSidebarExecutorId && selectedSidebarExecutor ? (
            <>
              {/* Executor Chat Header */}
              <div className="flex items-center justify-between px-4 border-b bg-background h-[57px]">
                <div className="flex items-center gap-3">
                  {/* Executor avatar - clickable to show details */}
                  <button
                    type="button"
                    className="relative w-9 h-9 rounded-lg bg-gradient-to-br from-amber-500 to-orange-400 flex items-center justify-center shadow-sm hover:opacity-90 transition-opacity cursor-pointer"
                    onClick={() => {
                      setRightSidebarExecutorDetail({
                        id: selectedSidebarExecutor.id,
                        name: selectedSidebarExecutor.name,
                        type: selectedSidebarExecutor.icon_type || "unknown",
                        config_path: (selectedSidebarExecutor.metadata?.config_path as string) || undefined,
                      });
                      // Clear agent detail by resetting the detail agent ID
                      setDetailAgentId(null);
                      setIsSidebarOpen(true);
                    }}
                    title={t("executor.showDetails", "Show executor details")}
                  >
                    <Terminal className="h-5 w-5 text-white" />
                  </button>
                  <div>
                    <div className="flex items-center gap-2">
                      {/* Session Selector for Executor */}
                      <SessionSelector
                        currentSession={
                          selectedExecutorSessionId && executorSessionsForSelector.find(s => s.id === selectedExecutorSessionId)
                            ? executorSessionsForSelector.find(s => s.id === selectedExecutorSessionId)
                            : undefined
                        }
                        sessions={executorSessionsForSelector}
                        onSelect={(session) => {
                          setSelectedExecutorSessionId(session.id);
                        }}
                        onCreateNew={() => {
                          // For executors, we typically don't create sessions from the UI
                          // Sessions are created by the executor itself
                          console.log("[WorkspaceChat] Create new executor session not implemented");
                        }}
                        showCreateButton={false}
                        agentName={selectedSidebarExecutor.name}
                      />
                      {gatewayConnected === true ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/10 text-green-600">
                          Gateway
                        </span>
                      ) : gatewayConnected === false ? (
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-600 cursor-pointer"
                          onClick={checkGatewayConnection}
                          title={t("chat.gatewayOfflineHint", "Gateway offline, click to retry")}
                        >
                          Offline
                        </span>
                      ) : (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                          ...
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {selectedSidebarExecutor.name} - {selectedSidebarExecutor.icon_type || "unknown"}
                    </p>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-1">
                  {/* Refresh sessions button */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    title={t("chat.refreshSessions", "Refresh sessions")}
                    onClick={refreshExecutorSessions}
                    disabled={isLoadingExecutorSessions}
                  >
                    <RefreshCcw className={cn("h-4 w-4", isLoadingExecutorSessions && "animate-spin")} />
                  </Button>

                  {/* Search in conversation */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    title={t("chat.searchInConversation")}
                    onClick={() => setIsSearchDialogOpen(true)}
                  >
                    <Search className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Executor Messages */}
              {isLoadingExecutorSessions ? (
                <div className="flex-1 flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <Loader2 className="h-8 w-8 mx-auto mb-3 animate-spin opacity-50" />
                    <p className="text-sm">{t("common.loading", "Loading sessions...")}</p>
                  </div>
                </div>
              ) : executorSessions.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <Terminal className="h-16 w-16 mx-auto mb-4 opacity-30" />
                    <p className="text-lg font-medium mb-2">
                      {t("executor.noSessions", "No sessions found")}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {t("executor.noSessionsHint", "Sessions will appear when you use this executor")}
                    </p>
                  </div>
                </div>
              ) : selectedExecutorSessionId ? (
                <>
                  {isLoadingExecutorMessages ? (
                    <div className="flex-1 flex items-center justify-center text-muted-foreground">
                      <div className="text-center">
                        <Loader2 className="h-8 w-8 mx-auto mb-3 animate-spin opacity-50" />
                        <p className="text-sm">{t("common.loading", "Loading messages...")}</p>
                      </div>
                    </div>
                  ) : executorMessagesAsAgentMessages.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center text-muted-foreground">
                      <div className="text-center">
                        <MessageSquare className="h-16 w-16 mx-auto mb-4 opacity-30" />
                        <p className="text-lg font-medium mb-2">
                          {t("executor.noMessages", "No messages in this session")}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {t("executor.noMessagesHint", "This session appears to be empty")}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <DesktopMessageList
                      messages={executorMessagesAsAgentMessages}
                      isStreaming={false}
                      className="flex-1 w-full h-full min-w-0 overflow-hidden"
                      simpleMode
                      maxMessageWidth="100%"
                      autoScroll
                    />
                  )}
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <MessageSquare className="h-16 w-16 mx-auto mb-4 opacity-30" />
                    <p className="text-lg font-medium mb-2">
                      {t("executor.selectSession", "Select a session")}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {t("executor.selectSessionHint", "Choose a session from the dropdown above")}
                    </p>
                  </div>
                </div>
              )}

              {/* Input (read-only for executor sessions - config bar display) */}
              <div className="border-t border-border">
                <DesktopChatInput
                  onSend={() => {}}
                  disabled
                  placeholder={t("executor.readOnlyHint", "Executor sessions are read-only")}
                  showConfigBar
                  hideAgentSelector
                  hideExecutorSelector
                  // Show model selector with executor-specific models
                  models={executorModels}
                  selectedModelId={selectedExecutorModelId}
                  onModelChange={setSelectedExecutorModelId}
                  // Show session statistics - provide onClick handlers to display the buttons
                  enabledToolsCount={executorSessionStats.toolsCount}
                  onToolsClick={() => {}} // Show tools button (count only, no interaction)
                  enabledSkillsCount={executorSessionStats.skillsCount}
                  onSkillsClick={() => {}} // Show skills button (count only, no interaction)
                  contextTokens={executorSessionStats.estimatedTokens}
                />
              </div>
            </>
          ) : selectedConversationId ? (
            <>
              {/* Chat Header - WeChat style */}
              <div className="flex items-center justify-between px-4 border-b bg-background h-[57px]">
                <div className="flex items-center gap-3">
                  {/* Agent avatar - clickable to show details */}
                  <button
                    type="button"
                    className="relative w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center shadow-sm hover:opacity-90 transition-opacity cursor-pointer"
                    onClick={() => {
                      // Use on-demand loading: set the agent ID and let useAgentDetail fetch the full data
                      const agentId = selectedAgentId || currentChatListAgent?.id;
                      if (agentId) {
                        // Strip "viben:" prefix if present for the detail fetch
                        const cleanId = agentId.startsWith("viben:") ? agentId.slice(6) : agentId;
                        setDetailAgentId(cleanId);
                        setRightSidebarExecutorDetail(null);
                        setIsSidebarOpen(true);
                      }
                    }}
                    title={t("agent.showDetails", "Show agent details")}
                  >
                    <Bot className="h-5 w-5 text-white" />
                  </button>
                  <div>
                    <div className="flex items-center gap-2">
                      {/* Session Selector */}
                      <SessionSelector
                        currentSession={
                          currentConversation
                            ? {
                                id: currentConversation.id,
                                name: currentConversation.title,
                                createdAt: currentConversation.createdAt,
                                updatedAt: currentConversation.updatedAt,
                                messageCount: currentConversation.messageCount,
                                isPinned: currentConversation.isPinned,
                                isStarred: currentConversation.isStarred,
                                lastMessage: currentConversation.lastMessage,
                                agentName: currentAgent?.name,
                              }
                            : undefined
                        }
                        sessions={agentConversations.map((c) => ({
                          id: c.id,
                          name: c.title,
                          createdAt: c.createdAt,
                          updatedAt: c.updatedAt,
                          messageCount: c.messageCount,
                          isPinned: c.isPinned,
                          isStarred: c.isStarred,
                          lastMessage: c.lastMessage,
                          agentName: agents.find((a) => a.id === c.agentId)?.name,
                        }))}
                        onSelect={(session) => {
                          setSelectedConversationId(session.id);
                          // TODO: Load conversation messages
                        }}
                        onCreateNew={handleCreateConversation}
                        onRename={handleRenameSession}
                        onDelete={handleDeleteSession}
                        onPin={handlePinSession}
                        onArchive={handleArchiveSession}
                        onStar={handleStarSession}
                        onDuplicate={handleDuplicateSession}
                        agentName={currentAgent?.name}
                      />
                      {gatewayConnected === true ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/10 text-green-600">
                          Gateway
                        </span>
                      ) : gatewayConnected === false ? (
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-600 cursor-pointer"
                          onClick={checkGatewayConnection}
                          title={t("chat.gatewayOfflineHint", "Gateway offline, click to retry")}
                        >
                          Mock
                        </span>
                      ) : (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                          ...
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {currentAgent?.name || t("chat.defaultAgent")}
                    </p>
                  </div>
                </div>

                {/* WeChat style action buttons */}
                <div className="flex items-center gap-1">
                  {/* Refresh sessions button */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    title={t("chat.refreshSessions", "Refresh sessions")}
                    onClick={refreshAgentSessions}
                    disabled={isLoadingSessions}
                  >
                    <RefreshCcw className={cn("h-4 w-4", isLoadingSessions && "animate-spin")} />
                  </Button>

                  {/* Search in conversation */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    title={t("chat.searchInConversation")}
                  >
                    <Search className="h-4 w-4" />
                  </Button>

                  {/* More options dropdown */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      {/* Search */}
                      <DropdownMenuItem onClick={() => setIsSearchDialogOpen(true)}>
                        <Search className="h-4 w-4 mr-3" />
                        {t("chat.searchInConversation")}
                      </DropdownMenuItem>

                      {/* View history */}
                      <DropdownMenuItem onClick={() => setIsHistoryDialogOpen(true)}>
                        <History className="h-4 w-4 mr-3" />
                        {t("chat.viewHistory")}
                      </DropdownMenuItem>

                      {/* Export conversation */}
                      <DropdownMenuItem onClick={() => setIsExportDialogOpen(true)}>
                        <FileText className="h-4 w-4 mr-3" />
                        {t("chat.exportConversation")}
                      </DropdownMenuItem>

                      <DropdownMenuSeparator />

                      {/* Invite to group */}
                      <DropdownMenuItem onClick={() => setIsGroupDialogOpen(true)}>
                        <Users className="h-4 w-4 mr-3" />
                        {t("chat.inviteToGroup")}
                      </DropdownMenuItem>

                      {/* Share */}
                      <DropdownMenuItem onClick={() => setIsShareDialogOpen(true)}>
                        <Share2 className="h-4 w-4 mr-3" />
                        {t("chat.shareConversation")}
                      </DropdownMenuItem>

                      <DropdownMenuSeparator />

                      {/* Agent settings - navigate to agent orchestration */}
                      <DropdownMenuItem onClick={handleNavigateToAgentSettings}>
                        <Settings className="h-4 w-4 mr-3" />
                        {t("chat.agentSettings")}
                      </DropdownMenuItem>

                      <DropdownMenuSeparator />

                      {/* Archive */}
                      <DropdownMenuItem onClick={handleArchiveConversation}>
                        <Archive className="h-4 w-4 mr-3" />
                        {t("chat.archiveConversation")}
                      </DropdownMenuItem>

                      {/* Clear messages */}
                      <DropdownMenuItem
                        onClick={() => setIsClearDialogOpen(true)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-3" />
                        {t("chat.clearMessages")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* Messages */}
              <DesktopMessageList
                messages={messages}
                isStreaming={isStreaming}
                pendingPlan={pendingPlan}
                pendingQuestions={pendingQuestions}
                onApprovePlan={approvePlan}
                onRejectPlan={rejectPlan}
                onAnswerQuestions={answerQuestions}
                className="flex-1 min-w-0 overflow-hidden"
                maxMessageWidth="100%"
              />

              {/* Error display */}
              {error && (
                <div className="px-4 py-2 bg-destructive/10 border-t border-destructive/20">
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              )}

              {/* Input */}
              <div className="border-t border-border">
                <DesktopChatInput
                  onSend={handleSendMessage}
                  onCancel={cancel}
                  isLoading={isStreaming}
                  disabled={phase === "awaiting_approval" || phase === "awaiting_input"}
                  placeholder={
                    phase === "awaiting_approval"
                      ? t("chat.waitingForApproval")
                      : phase === "awaiting_input"
                        ? t("chat.waitingForInput")
                        : undefined
                  }
                  autoFocus
                  showTopToolbar
                  showConfigBar
                  showResizeHandle
                  enableWritingMode
                  useGlobalConfig
                  hideExecutorSelector
                  hideModelSelector
                  onAgentSettings={(agentId) => {
                    // Navigate to agent orchestration page
                    if (workspaceId) {
                      navigate(`/workspace/${workspaceId}/agent/${agentId}`);
                    }
                  }}
                />
              </div>
            </>
          ) : (
            /* Empty state when no conversation selected */
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <MessageSquare className="h-16 w-16 mx-auto mb-4 opacity-30" />
                <p className="text-lg font-medium mb-2">{t("chat.welcomeTitle")}</p>
                <p className="text-sm text-muted-foreground mb-4">
                  {t("chat.welcomeDescription")}
                </p>
                <Button onClick={handleCreateConversation}>
                  <Plus className="h-4 w-4 mr-2" />
                  {t("chat.startConversation")}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Right sidebar (resizable) */}
        <RightSidebar
          artifacts={artifacts}
          toolUsages={toolUsages}
          messages={messages}
          workingDir={workspace.path}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          width={rightPanelWidth}
          onResize={handleRightPanelResize}
          // Group chat props (only when in group chat mode)
          groupChat={isGroupChatMode && currentGroupChat ? currentGroupChat.group_chat : null}
          groupChatMembers={isGroupChatMode ? groupChatMembers : []}
          availableAgents={agents.map((a) => ({ id: a.id, name: a.name }))}
          currentUserId="user-1"
          currentUserRole={currentUserGroupRole}
          onAddMember={addGroupChatMember}
          onRemoveMember={removeGroupChatMember}
          onUpdateGroupChat={(data) => updateGroupChat(selectedGroupChatId!, data)}
          onLeaveGroupChat={handleLeaveGroupChat}
          onDeleteGroupChat={() => deleteGroupChat(selectedGroupChatId!)}
          isGroupChatLoading={isLoadingGroupChat}
          // Agent/Executor detail props
          agentDetail={rightSidebarAgentDetail}
          isAgentDetailLoading={isLoadingDetailAgent}
          executorDetail={rightSidebarExecutorDetail}
          workspacePath={workspace.path}
          onAgentSettings={(agentId) => {
            if (workspaceId) {
              navigate(`/workspace/${workspaceId}/agent/${agentId}`);
            }
          }}
          onExecutorSettings={(executorId) => {
            // Navigate to executor settings or show modal
            console.log("[WorkspaceChat] Executor settings:", executorId);
          }}
          // Agent detail panel props (for full editing support)
          isAgentDefault={rightSidebarAgentDetail?.id === defaultAgentId}
          agentModels={agentModelsForPanel}
          onAgentUpdate={async (id, updates) => {
            await updateAgent(id, updates);
          }}
          onAgentSetDefault={rightSidebarAgentDetail ? () => {
            setDefaultAgent(rightSidebarAgentDetail.id);
          } : undefined}
          onAgentDelete={rightSidebarAgentDetail ? () => {
            // Agent deletion logic - could navigate to agents page or show confirmation
            console.log("[WorkspaceChat] Delete agent:", rightSidebarAgentDetail.id);
          } : undefined}
        />
      </div>

      {/* Search Dialog */}
      <Dialog open={isSearchDialogOpen} onOpenChange={setIsSearchDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              {t("chat.searchInConversation")}
            </DialogTitle>
            <DialogDescription>
              {t("chat.searchInConversationDesc")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("chat.searchPlaceholder")}
                value={conversationSearchQuery}
                onChange={(e) => setConversationSearchQuery(e.target.value)}
                className="pl-10"
                autoFocus
              />
            </div>
            {conversationSearchQuery && (
              <div className="max-h-60 overflow-auto space-y-2">
                {filteredMessages.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    {t("chat.noSearchResults")}
                  </p>
                ) : (
                  filteredMessages.map((message, index) => (
                    <div
                      key={index}
                      className="p-2 rounded-lg bg-muted/50 text-sm"
                    >
                      <span className="font-medium text-xs text-muted-foreground">
                        {message.type === "user" ? t("chat.you") : currentAgent?.name}
                      </span>
                      <p className="truncate">{message.content}</p>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={isHistoryDialogOpen} onOpenChange={setIsHistoryDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              {t("chat.viewHistory")}
            </DialogTitle>
            <DialogDescription>
              {t("chat.viewHistoryDesc")}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[400px]">
            <div className="space-y-3">
              {messages.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {t("chat.noMessages")}
                </p>
              ) : (
                messages.map((message, index) => (
                  <div
                    key={index}
                    className={cn(
                      "p-3 rounded-lg text-sm",
                      message.type === "user"
                        ? "bg-primary/10 ml-8"
                        : "bg-muted/50 mr-8"
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-xs">
                        {message.type === "user" ? t("chat.you") : currentAgent?.name}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Export Dialog */}
      <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {t("chat.exportConversation")}
            </DialogTitle>
            <DialogDescription>
              {t("chat.exportConversationDesc")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-muted/50">
              <p className="text-sm font-medium mb-1">
                {currentConversation?.title}
              </p>
              <p className="text-xs text-muted-foreground">
                {messages.length} {t("chat.messagesCount")}
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsExportDialogOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button onClick={handleExportConversation}>
                <FileText className="h-4 w-4 mr-2" />
                {t("chat.exportAsJson")}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Group Dialog */}
      <Dialog open={isGroupDialogOpen} onOpenChange={setIsGroupDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              {t("chat.inviteToGroup")}
            </DialogTitle>
            <DialogDescription>
              {t("chat.inviteToGroupDesc")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground text-center py-8">
              {t("chat.groupFeatureComingSoon")}
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsGroupDialogOpen(false)}>
                {t("common.close")}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Share Dialog */}
      <Dialog open={isShareDialogOpen} onOpenChange={setIsShareDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="h-5 w-5" />
              {t("chat.shareConversation")}
            </DialogTitle>
            <DialogDescription>
              {t("chat.shareConversationDesc")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              readOnly
              value={messages
                .map((m) => `${m.type === "user" ? t("chat.you") : currentAgent?.name}: ${m.content}`)
                .join("\n\n")}
              className="h-40 text-xs"
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsShareDialogOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button onClick={handleShareConversation}>
                <Share2 className="h-4 w-4 mr-2" />
                {t("chat.copyToClipboard")}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Clear Messages Confirmation Dialog */}
      <AlertDialog open={isClearDialogOpen} onOpenChange={setIsClearDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("chat.clearMessagesConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("chat.clearMessagesConfirmDesc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearMessages}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("chat.clearMessages")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create Agent Dialog */}
      <Dialog open={isCreateAgentDialogOpen} onOpenChange={setIsCreateAgentDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              {t("agent.createAgent", "创建智能体")}
            </DialogTitle>
            <DialogDescription>
              {t("agent.createAgentDesc", "创建一个新的智能体来处理特定任务")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground text-center py-8">
              {t("agent.createAgentHint", "请前往智能体管理页面创建新智能体")}
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateAgentDialogOpen(false)}>
                {t("common.cancel", "取消")}
              </Button>
              <Button onClick={() => {
                setIsCreateAgentDialogOpen(false);
                if (workspaceId) {
                  navigate(`/workspace/${workspaceId}/agents`);
                }
              }}>
                <Bot className="h-4 w-4 mr-2" />
                {t("agent.goToAgents", "前往管理")}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Group Chat Dialog */}
      <CreateGroupChatDialog
        open={isCreateGroupDialogOpen}
        onOpenChange={setIsCreateGroupDialogOpen}
        agents={agents}
        onCreate={handleCreateGroupChat}
        isCreating={isCreatingGroupChat}
      />

      {/* Group Chat Members Dialog */}
      {currentGroupChat && (
        <GroupChatMembersDialog
          open={isMembersDialogOpen}
          onOpenChange={setIsMembersDialogOpen}
          groupChatName={currentGroupChat.group_chat.name}
          members={groupChatMembers}
          currentUserId="user-1"
          currentUserRole={currentUserGroupRole}
          availableAgents={agents.map((a) => ({ id: a.id, name: a.name }))}
          onRemoveMember={handleRemoveGroupChatMember}
          onAddMember={handleAddGroupChatMember}
          isLoading={isLoadingGroupChat}
        />
      )}

      {/* Rename Group Chat Dialog */}
      <Dialog
        open={renameGroupChatId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRenameGroupChatId(null);
            setRenameGroupChatName("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {t("groupChat.renameTitle", "Rename Group Chat")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">
                {t("groupChat.newName", "New Name")}
              </label>
              <Input
                value={renameGroupChatName}
                onChange={(e) => setRenameGroupChatName(e.target.value)}
                placeholder={t("groupChat.namePlaceholder", "Enter group name...")}
                className="mt-1.5"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && renameGroupChatId) {
                    handleRenameGroupChat(renameGroupChatId, renameGroupChatName);
                  }
                }}
              />
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setRenameGroupChatId(null);
                  setRenameGroupChatName("");
                }}
              >
                {t("common.cancel")}
              </Button>
              <Button
                onClick={() => {
                  if (renameGroupChatId) {
                    handleRenameGroupChat(renameGroupChatId, renameGroupChatName);
                  }
                }}
                disabled={!renameGroupChatName.trim()}
              >
                {t("common.save")}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

    </motion.div>
  );
}
