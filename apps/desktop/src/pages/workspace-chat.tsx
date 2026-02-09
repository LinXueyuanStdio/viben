import * as React from "react";
import * as ContextMenuPrimitive from "@radix-ui/react-context-menu";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import {
  Settings,
  PanelRightOpen,
  PanelRightClose,
  Trash2,
  Loader2,
  Plus,
  MessageSquare,
  Search,
  MoreHorizontal,
  Bot,
  GripVertical,
  Pin,
  Users,
  History,
  FileText,
  Share2,
  Archive,
  RefreshCcw,
} from "lucide-react";
import { getGatewayClient, type FileSession, type SessionMessage } from "@/lib/gateway";
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
} from "@/components/chat";
import { WorkspaceHeader } from "@/components/workspace";
import {
  useAgent,
  useVibenAgents,
  useLocalWorkspaces,
  useChatConfig,
} from "@/hooks";
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
  return {
    id: session.id,
    title: session.prompt || `Session ${session.id.slice(0, 8)}`,
    agentId: session.agent_id,
    createdAt: session.created_at,
    updatedAt: session.updated_at,
    messageCount: 0, // Will be updated when messages are loaded
    isPinned: false,
    isStarred: false,
    isArchived: session.status === "archived",
  };
}

// Convert Gateway SessionMessage to AgentMessage
function sessionMessageToAgentMessage(msg: SessionMessage): import("@/types").AgentMessage {
  const baseMessage = {
    id: crypto.randomUUID(),
    content: msg.content,
  };

  if (msg.role === "user") {
    return { ...baseMessage, type: "user" as const };
  } else if (msg.role === "assistant") {
    return { ...baseMessage, type: "text" as const };
  } else {
    return { ...baseMessage, type: "text" as const };
  }
}

// ============================================================================
// Agent List Item (for left sidebar)
// ============================================================================

interface AgentListItemProps {
  agent: {
    id: string;
    name: string;
    description?: string;
    model?: string;
    updated_at: string;
  };
  isSelected: boolean;
  isDefault?: boolean;
  sessionCount?: number;
  onSelect: () => void;
  onSettings: () => void;
  onSetDefault?: () => void;
}

function AgentListItem({
  agent,
  isSelected,
  isDefault,
  sessionCount = 0,
  onSelect,
  onSettings,
  onSetDefault,
}: AgentListItemProps) {
  const { t } = useTranslation();

  // Get avatar colors based on agent name
  const getAvatarGradient = () => {
    const colors = [
      "from-blue-500 to-cyan-400",
      "from-purple-500 to-pink-400",
      "from-green-500 to-emerald-400",
      "from-orange-500 to-yellow-400",
      "from-red-500 to-rose-400",
      "from-indigo-500 to-violet-400",
    ];
    const index = (agent.name?.charCodeAt(0) || 0) % colors.length;
    return colors[index];
  };

  // Menu items component for reuse in both dropdown and context menu
  const MenuItemsDropdown = () => (
    <>
      <DropdownMenuItem onClick={onSettings}>
        <Settings className="h-4 w-4 mr-2" />
        {t("agent.settings", "智能体设置")}
      </DropdownMenuItem>
      {onSetDefault && !isDefault && (
        <DropdownMenuItem onClick={onSetDefault}>
          <Pin className="h-4 w-4 mr-2" />
          {t("agent.setAsDefault", "设为默认")}
        </DropdownMenuItem>
      )}
      <DropdownMenuSeparator />
      <DropdownMenuItem disabled className="text-muted-foreground">
        <History className="h-4 w-4 mr-2" />
        {sessionCount} {t("agent.sessions", "个会话")}
      </DropdownMenuItem>
    </>
  );

  // Context menu item styles
  const contextMenuItemClass = cn(
    "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none",
    "transition-colors focus:bg-accent focus:text-accent-foreground",
    "data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
  );

  return (
    <ContextMenuPrimitive.Root>
      <ContextMenuPrimitive.Trigger asChild>
        <div
          className={cn(
            "group relative flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-all rounded-lg",
            isSelected
              ? "bg-accent"
              : "hover:bg-muted/50"
          )}
          onClick={onSelect}
        >
          {/* Avatar */}
          <div
            className={cn(
              "relative shrink-0 w-11 h-11 rounded-lg flex items-center justify-center bg-gradient-to-br shadow-sm",
              getAvatarGradient()
            )}
          >
            <Bot className="h-5 w-5 text-white" />
            {/* Online indicator */}
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-background" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 py-0.5">
            <div className="flex items-center gap-1.5">
              <span className="font-medium text-sm truncate">
                {agent.name}
              </span>
              {isDefault && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary shrink-0">
                  {t("agent.default", "默认")}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {agent.description || agent.model || t("agent.noDescription", "暂无描述")}
            </p>
          </div>

          {/* Hover actions - More button */}
          <div
            className={cn(
              "absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity",
              "bg-background/80 backdrop-blur-sm rounded-md px-1 py-0.5"
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6">
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <MenuItemsDropdown />
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </ContextMenuPrimitive.Trigger>

      {/* Context menu (right-click) - using Radix UI */}
      <ContextMenuPrimitive.Portal>
        <ContextMenuPrimitive.Content
          className="z-50 min-w-[12rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md animate-in fade-in-80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2"
        >
          <ContextMenuPrimitive.Item
            className={contextMenuItemClass}
            onClick={onSettings}
          >
            <Settings className="h-4 w-4 mr-2" />
            {t("agent.settings", "智能体设置")}
          </ContextMenuPrimitive.Item>
          {onSetDefault && !isDefault && (
            <ContextMenuPrimitive.Item
              className={contextMenuItemClass}
              onClick={onSetDefault}
            >
              <Pin className="h-4 w-4 mr-2" />
              {t("agent.setAsDefault", "设为默认")}
            </ContextMenuPrimitive.Item>
          )}
          <ContextMenuPrimitive.Separator className="-mx-1 my-1 h-px bg-muted" />
          <ContextMenuPrimitive.Item
            className={cn(contextMenuItemClass, "text-muted-foreground")}
            disabled
          >
            <History className="h-4 w-4 mr-2" />
            {sessionCount} {t("agent.sessions", "个会话")}
          </ContextMenuPrimitive.Item>
        </ContextMenuPrimitive.Content>
      </ContextMenuPrimitive.Portal>
    </ContextMenuPrimitive.Root>
  );
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

  // Conversation State
  const [conversations, setConversations] = React.useState<Conversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = React.useState<string | null>(null);
  const [isLoadingSessions, setIsLoadingSessions] = React.useState(false);
  const [_sessionsError, setSessionsError] = React.useState<string | null>(null);

  // Selected agent for the left sidebar
  const [selectedAgentId, setSelectedAgentId] = React.useState<string | null>(null);

  // Get workspace info
  const { workspaces, isLoading: isLoadingWorkspace } = useLocalWorkspaces();
  const workspace = workspaces.find((w) => w.id === workspaceId);

  // Agents
  const { agents, defaultAgentId, setDefaultAgent } = useVibenAgents();

  // Get chat config for executor and agent selection
  const { selectedExecutor, selectedAgentId: configSelectedAgentId } = useChatConfig();

  // Get current conversation and selected agent
  const currentConversation = conversations.find(
    (c) => c.id === selectedConversationId
  );
  const currentAgent = agents.find(
    (a) => a.id === selectedAgentId
  );

  // Agent hook - use workspace path as workdir for the agent
  // Pass selected executor to connect with the correct coding agent
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
  } = useAgent(workspace?.path || "", { agentType: selectedExecutor });

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
      const convs = sessions.map(fileSessionToConversation);
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

  // Restore last selected agent on mount
  React.useEffect(() => {
    if (workspaceId && agents.length > 0) {
      // Restore last selected agent
      const lastAgentId = loadLastAgentId(workspaceId);
      if (lastAgentId && agents.some((a) => a.id === lastAgentId)) {
        setSelectedAgentId(lastAgentId);
      } else if (!selectedAgentId) {
        // Set default agent if no previous selection
        setSelectedAgentId(defaultAgentId || agents[0].id);
      }
    }
  }, [workspaceId, agents, defaultAgentId, selectedAgentId]);

  // Refs to track loading state and prevent loops
  const prevAgentRef = React.useRef<string | null>(null);
  const isLoadingRef = React.useRef(false);
  const pendingAgentIdRef = React.useRef<string | null>(null);

  // Combined effect: Load sessions and auto-select when agent changes
  // Using a single async flow to prevent cascading effects
  React.useEffect(() => {
    if (!selectedAgentId) return;

    // Skip if same agent (already loaded)
    if (prevAgentRef.current === selectedAgentId) return;

    // Detect if this is an agent switch (not initial load)
    const isAgentSwitch = prevAgentRef.current !== null;
    prevAgentRef.current = selectedAgentId;

    // Prevent re-entry
    if (isLoadingRef.current) {
      pendingAgentIdRef.current = selectedAgentId;
      return;
    }

    // Single async flow to load sessions and auto-select
    const loadAndSelect = async () => {
      isLoadingRef.current = true;
      pendingAgentIdRef.current = null;

      // Clear current session when switching agents
      if (isAgentSwitch) {
        setSelectedConversationId(null);
      }

      setIsLoadingSessions(true);
      setSessionsError(null);

      try {
        const client = getGatewayClient();
        const isReachable = await client.ping();

        if (!isReachable) {
          console.log(`[WorkspaceChat] Gateway not reachable, skipping session load`);
          setConversations([]);
          setIsLoadingSessions(false);
          isLoadingRef.current = false;
          return;
        }

        const sessions = await client.listAgentSessions(selectedAgentId);
        const convs = sessions.map(fileSessionToConversation);
        // Sort by updatedAt descending
        convs.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

        console.log(`[WorkspaceChat] Loaded ${convs.length} sessions for agent ${selectedAgentId}`);

        // Update conversations and auto-select first one atomically
        setConversations(convs);
        if (convs.length > 0) {
          setSelectedConversationId(convs[0].id);
        }
      } catch (error) {
        console.error("[WorkspaceChat] Failed to load sessions from Gateway:", error);
        setSessionsError(error instanceof Error ? error.message : "Failed to load sessions");
        setConversations([]);
      } finally {
        setIsLoadingSessions(false);
        isLoadingRef.current = false;

        // Check if another agent was selected while loading
        if (pendingAgentIdRef.current && pendingAgentIdRef.current !== selectedAgentId) {
          // Reset and let the effect re-run for the pending agent
          prevAgentRef.current = null;
        }
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
    // Early return if no session or agent selected
    if (!selectedConversationId || !selectedAgentId) {
      prevSessionRef.current = null;
      return;
    }

    // Skip if same session (already loaded)
    if (prevSessionRef.current === selectedConversationId) {
      return;
    }

    // Prevent concurrent loads
    if (isLoadingMessagesRef.current) {
      return;
    }

    prevSessionRef.current = selectedConversationId;

    // Capture values for async closure
    const agentId = selectedAgentId;
    const sessionId = selectedConversationId;

    const loadSessionMessages = async () => {
      isLoadingMessagesRef.current = true;

      try {
        const client = getGatewayClient();
        const sessionMessages = await client.listSessionMessages(agentId, sessionId);

        // Check if session is still the same after async call
        if (prevSessionRef.current !== sessionId) {
          console.log(`[WorkspaceChat] Session changed during load, skipping message update`);
          return;
        }

        if (sessionMessages.length > 0) {
          const agentMessages = sessionMessages.map(sessionMessageToAgentMessage);
          loadMessages(agentMessages);
          console.log(`[WorkspaceChat] Loaded ${agentMessages.length} messages for session ${sessionId}`);
        } else {
          clearMessages();
        }
      } catch (error) {
        console.error("[WorkspaceChat] Failed to load messages from Gateway:", error);
        // Only clear if session is still current
        if (prevSessionRef.current === sessionId) {
          clearMessages();
        }
      } finally {
        isLoadingMessagesRef.current = false;
      }
    };

    loadSessionMessages();
  }, [selectedConversationId, selectedAgentId, loadMessages, clearMessages]);

  // Save messages to Gateway whenever they change
  React.useEffect(() => {
    // Note: Messages are automatically saved by the agent executor during chat
    // This effect is kept for potential future use or manual persistence
  }, [selectedConversationId, messages]);

  // Filter agents by search query
  const filteredAgents = React.useMemo(() => {
    if (!searchQuery.trim()) return agents;
    const query = searchQuery.toLowerCase();
    return agents.filter(
      (a) =>
        a.name.toLowerCase().includes(query) ||
        a.description?.toLowerCase().includes(query)
    );
  }, [agents, searchQuery]);

  // Get sessions/conversations for the selected agent
  const agentConversations = React.useMemo(() => {
    if (!selectedAgentId) return conversations;
    return conversations.filter((c) => c.agentId === selectedAgentId);
  }, [conversations, selectedAgentId]);

  // Create new conversation for the selected agent
  const handleCreateConversation = async () => {
    if (!workspaceId || !selectedAgentId) return;

    try {
      const client = getGatewayClient();
      const agent = agents.find((a) => a.id === selectedAgentId);
      const newSession = await client.createAgentSession(selectedAgentId, {
        prompt: t("chat.newConversation") + (agent ? ` - ${agent.name}` : ""),
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
      const newSession = await client.createAgentSession(selectedAgentId, {
        prompt: `${original.title} (副本)`,
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

  // Filter messages by search query
  const filteredMessages = React.useMemo(() => {
    if (!conversationSearchQuery.trim()) return messages;
    const query = conversationSearchQuery.toLowerCase();
    return messages.filter((m) => m.content?.toLowerCase().includes(query));
  }, [messages, conversationSearchQuery]);

  // Navigate to full agent settings
  // Use the agent selected in config bar, or fall back to conversation's agent
  const handleNavigateToAgentSettings = () => {
    const targetAgentId = configSelectedAgentId || currentAgent?.id;
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
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Agent List (resizable) */}
        <div
          className="relative border-r flex flex-col bg-background shrink-0 overflow-visible"
          style={{ width: leftPanelWidth }}
        >
          {/* Resize handle */}
          <ResizeHandle side="left" onResize={handleLeftPanelResize} />
          {/* Header with search and + button */}
          <div className="p-3 border-b">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t("agent.searchAgents", "搜索智能体...")}
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
                    {t("agent.createAgent", "创建智能体")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setIsCreateGroupDialogOpen(true)}>
                    <Users className="h-4 w-4 mr-2" />
                    {t("chat.createGroup", "创建群聊")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Agent List */}
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {filteredAgents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Bot className="h-12 w-12 mb-3 opacity-30" />
                  <p className="text-sm">{t("agent.noAgents", "暂无智能体")}</p>
                </div>
              ) : (
                filteredAgents.map((agent) => (
                  <AgentListItem
                    key={agent.id}
                    agent={agent}
                    isSelected={agent.id === selectedAgentId}
                    isDefault={agent.id === defaultAgentId}
                    sessionCount={conversations.filter((c) => c.agentId === agent.id).length}
                    onSelect={() => {
                      // Set the selected agent - the useEffect will auto-select the session
                      setSelectedAgentId(agent.id);
                    }}
                    onSettings={() => {
                      if (workspaceId) {
                        navigate(`/workspace/${workspaceId}/agent/${agent.id}`);
                      }
                    }}
                    onSetDefault={() => setDefaultAgent(agent.id)}
                  />
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Middle: Chat Area */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {selectedConversationId ? (
            <>
              {/* Chat Header - WeChat style */}
              <div className="flex items-center justify-between px-4 py-2.5 border-b bg-background">
                <div className="flex items-center gap-3">
                  {/* Agent avatar */}
                  <div className="relative w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center shadow-sm">
                    <Bot className="h-5 w-5 text-white" />
                  </div>
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
                          title={t("chat.gatewayOfflineHint", "Gateway 未连接，点击重试")}
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
                    title={t("chat.refreshSessions", "刷新会话")}
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
                className="flex-1"
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
      <Dialog open={isCreateGroupDialogOpen} onOpenChange={setIsCreateGroupDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              {t("chat.createGroup", "创建群聊")}
            </DialogTitle>
            <DialogDescription>
              {t("chat.createGroupDesc", "创建一个群聊，多个智能体可以协作完成任务")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground text-center py-8">
              {t("chat.groupFeatureComingSoon", "群聊功能即将上线，敬请期待")}
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateGroupDialogOpen(false)}>
                {t("common.close", "关闭")}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
