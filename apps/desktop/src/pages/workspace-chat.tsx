import * as React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import {
  Settings,
  PanelRightOpen,
  PanelRightClose,
  Trash2,
  Loader2,
  Activity,
  Plus,
  MessageSquare,
  Search,
  MoreHorizontal,
  Bot,
  ChevronRight,
  Pencil,
  GripVertical,
  Pin,
  BellOff,
  Users,
  History,
  FileText,
  Share2,
  Archive,
} from "lucide-react";
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  ChatInput,
  MessageList,
  RightSidebar,
} from "@/components/chat";
import { WorkspaceHeader } from "@/components/workspace";
import {
  useAgent,
  useVibenAgents,
  useVibenModels,
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
}

// ============================================================================
// Conversation Management (localStorage-based)
// ============================================================================

const CONVERSATIONS_KEY = "viben_workspace_conversations";

function getConversationsKey(workspaceId: string) {
  return `${CONVERSATIONS_KEY}_${workspaceId}`;
}

function loadConversations(workspaceId: string): Conversation[] {
  try {
    const data = localStorage.getItem(getConversationsKey(workspaceId));
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveConversations(workspaceId: string, conversations: Conversation[]) {
  localStorage.setItem(
    getConversationsKey(workspaceId),
    JSON.stringify(conversations)
  );
}

function generateConversationId() {
  return `conv_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

// ============================================================================
// Conversation List Item (WeChat style)
// ============================================================================

interface ConversationItemProps {
  conversation: Conversation;
  isSelected: boolean;
  agentName?: string;
  agentAvatar?: string;
  isPinned?: boolean;
  isMuted?: boolean;
  unreadCount?: number;
  onSelect: () => void;
  onRename: (newTitle: string) => void;
  onDelete: () => void;
  onPin?: () => void;
  onMute?: () => void;
}

function ConversationItem({
  conversation,
  isSelected,
  agentName,
  isPinned,
  isMuted,
  unreadCount = 0,
  onSelect,
  onRename,
  onDelete,
  onPin,
  onMute,
}: ConversationItemProps) {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = React.useState(false);
  const [editTitle, setEditTitle] = React.useState(conversation.title);

  const handleSubmitRename = () => {
    if (editTitle.trim() && editTitle !== conversation.title) {
      onRename(editTitle.trim());
    }
    setIsEditing(false);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } else if (days === 1) {
      return t("common.yesterday");
    } else if (days < 7) {
      return date.toLocaleDateString([], { weekday: "short" });
    } else {
      return date.toLocaleDateString([], { month: "short", day: "numeric" });
    }
  };

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
    const index = (agentName?.charCodeAt(0) || 0) % colors.length;
    return colors[index];
  };

  return (
    <div
      className={cn(
        "group relative flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-all",
        isSelected
          ? "bg-accent"
          : isPinned
            ? "bg-muted/30 hover:bg-muted/50"
            : "hover:bg-muted/50"
      )}
      onClick={onSelect}
    >
      {/* Avatar */}
      <div
        className={cn(
          "relative shrink-0 w-12 h-12 rounded-lg flex items-center justify-center bg-gradient-to-br shadow-sm",
          getAvatarGradient()
        )}
      >
        <Bot className="h-6 w-6 text-white" />
        {/* Online indicator */}
        <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-background" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 py-0.5">
        <div className="flex items-center justify-between gap-2">
          {isEditing ? (
            <Input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onBlur={handleSubmitRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSubmitRename();
                if (e.key === "Escape") {
                  setEditTitle(conversation.title);
                  setIsEditing(false);
                }
              }}
              onClick={(e) => e.stopPropagation()}
              className="h-6 px-1 text-sm font-medium flex-1"
              autoFocus
            />
          ) : (
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              <span className="font-medium text-sm truncate">
                {conversation.title}
              </span>
              {isPinned && (
                <Pin className="h-3 w-3 text-muted-foreground shrink-0 rotate-45" />
              )}
              {isMuted && (
                <BellOff className="h-3 w-3 text-muted-foreground shrink-0" />
              )}
            </div>
          )}
          <span className="text-[11px] text-muted-foreground shrink-0">
            {formatDate(conversation.updatedAt)}
          </span>
        </div>

        {/* Last message preview */}
        <div className="flex items-center justify-between gap-2 mt-1">
          <p className="text-xs text-muted-foreground truncate flex-1">
            {conversation.lastMessage ? (
              <>
                <span className="text-muted-foreground/70">[{agentName || t("chat.defaultAgent")}]</span>{" "}
                {conversation.lastMessage}
              </>
            ) : (
              <span className="italic opacity-50">{t("chat.noMessages")}</span>
            )}
          </p>
          {/* Unread badge */}
          {unreadCount > 0 && !isMuted && (
            <span className="shrink-0 min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-medium flex items-center justify-center px-1">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
          {unreadCount > 0 && isMuted && (
            <span className="shrink-0 w-2 h-2 rounded-full bg-muted-foreground/50" />
          )}
        </div>
      </div>

      {/* Hover actions */}
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
            {onPin && (
              <DropdownMenuItem onClick={onPin}>
                <Pin className="h-4 w-4 mr-2" />
                {isPinned ? t("chat.unpin") : t("chat.pin")}
              </DropdownMenuItem>
            )}
            {onMute && (
              <DropdownMenuItem onClick={onMute}>
                <BellOff className="h-4 w-4 mr-2" />
                {isMuted ? t("chat.unmute") : t("chat.mute")}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              onClick={() => {
                setEditTitle(conversation.title);
                setIsEditing(true);
              }}
            >
              <Pencil className="h-4 w-4 mr-2" />
              {t("common.rename")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={onDelete}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {t("common.delete")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

// ============================================================================
// Agent Settings Panel (Simplified inline editor)
// ============================================================================

interface AgentSettingsPanelProps {
  agent: {
    id: string;
    name: string;
    description?: string;
    model?: string;
    temperature?: number;
    system_prompt?: string;
  } | null;
  models: { id: string; name: string; provider: string; enabled: boolean }[];
  onNavigateToFull: () => void;
}

function AgentSettingsPanel({
  agent,
  models,
  onNavigateToFull,
}: AgentSettingsPanelProps) {
  const { t } = useTranslation();

  if (!agent) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        <Bot className="h-12 w-12 mx-auto mb-3 opacity-30" />
        <p>{t("chat.noAgentSelected")}</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      {/* Quick Settings */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium">{t("chat.agentSettings")}</h4>
          <Button variant="outline" size="sm" onClick={onNavigateToFull}>
            {t("chat.fullSettings")}
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>

        {/* Agent Name */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">
            {t("settingsAgents.name")}
          </label>
          <p className="text-sm font-medium">{agent.name}</p>
        </div>

        {/* Description */}
        {agent.description && (
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">
              {t("settingsAgents.description")}
            </label>
            <p className="text-sm text-muted-foreground">{agent.description}</p>
          </div>
        )}

        {/* Model */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">
            {t("settingsAgents.model")}
          </label>
          <p className="text-sm">
            {models.find((m) => m.id === agent.model)?.name || agent.model || t("chat.defaultModel")}
          </p>
        </div>

        {/* Temperature */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">
            {t("settingsAgents.temperature")}
          </label>
          <p className="text-sm">{agent.temperature?.toFixed(2) ?? "0.70"}</p>
        </div>
      </div>

      {/* System Prompt Preview */}
      {agent.system_prompt && (
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">
            {t("settingsAgents.systemPrompt")}
          </label>
          <div className="p-3 rounded-lg bg-muted/50 text-xs max-h-40 overflow-auto">
            <pre className="whitespace-pre-wrap font-mono">
              {agent.system_prompt.length > 500
                ? agent.system_prompt.slice(0, 500) + "..."
                : agent.system_prompt}
            </pre>
          </div>
        </div>
      )}
    </div>
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
  const [isAgentSettingsOpen, setIsAgentSettingsOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");

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

  // Get workspace info
  const { workspaces, isLoading: isLoadingWorkspace } = useLocalWorkspaces();
  const workspace = workspaces.find((w) => w.id === workspaceId);

  // Agents and models
  const { agents, defaultAgentId } = useVibenAgents();
  const { models } = useVibenModels();

  // Get chat config for executor selection
  const { selectedExecutor } = useChatConfig();

  // Get current conversation's agent
  const currentConversation = conversations.find(
    (c) => c.id === selectedConversationId
  );
  const currentAgent = agents.find(
    (a) => a.id === (currentConversation?.agentId || defaultAgentId)
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
    gatewayConnected,
    sendMessage,
    approvePlan,
    rejectPlan,
    answerQuestions,
    cancel,
    clearMessages,
  } = useAgent(workspace?.path || "", { agentType: selectedExecutor });

  // Load conversations on mount
  React.useEffect(() => {
    if (workspaceId) {
      const loaded = loadConversations(workspaceId);
      setConversations(loaded);

      // Auto-select first conversation or create one
      if (loaded.length > 0) {
        setSelectedConversationId(loaded[0].id);
      }
    }
  }, [workspaceId]);

  // Navigate back if workspace not found after loading
  React.useEffect(() => {
    if (!isLoadingWorkspace && !workspace && workspaceId) {
      navigate(`/workspace/${workspaceId}`);
    }
  }, [isLoadingWorkspace, workspace, workspaceId, navigate]);

  // Filter conversations by search query
  const filteredConversations = React.useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    const query = searchQuery.toLowerCase();
    return conversations.filter(
      (c) =>
        c.title.toLowerCase().includes(query) ||
        c.lastMessage?.toLowerCase().includes(query)
    );
  }, [conversations, searchQuery]);

  // Create new conversation
  const handleCreateConversation = () => {
    if (!workspaceId) return;

    const newConversation: Conversation = {
      id: generateConversationId(),
      title: t("chat.newConversation"),
      agentId: defaultAgentId || "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messageCount: 0,
    };

    const updated = [newConversation, ...conversations];
    setConversations(updated);
    saveConversations(workspaceId, updated);
    setSelectedConversationId(newConversation.id);
    clearMessages();
  };

  // Rename conversation
  const handleRenameConversation = (id: string, newTitle: string) => {
    if (!workspaceId) return;

    const updated = conversations.map((c) =>
      c.id === id ? { ...c, title: newTitle, updatedAt: new Date().toISOString() } : c
    );
    setConversations(updated);
    saveConversations(workspaceId, updated);
  };

  // Delete conversation
  const handleDeleteConversation = (id: string) => {
    if (!workspaceId) return;

    const updated = conversations.filter((c) => c.id !== id);
    setConversations(updated);
    saveConversations(workspaceId, updated);

    // Select another conversation if current was deleted
    if (selectedConversationId === id) {
      setSelectedConversationId(updated.length > 0 ? updated[0].id : null);
      clearMessages();
    }
  };

  // Handle sending message
  const handleSendMessage = async (message: string) => {
    if (!workspaceId || !selectedConversationId) {
      // Create a new conversation if none selected
      handleCreateConversation();
    }

    await sendMessage(message);

    // Update conversation with last message
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
      if (workspaceId) {
        saveConversations(workspaceId, updated);
      }
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
      saveConversations(workspaceId, updated);
    }
  };

  // Navigate to full agent settings
  const handleNavigateToAgentSettings = () => {
    if (currentAgent && workspaceId) {
      navigate(`/workspace/${workspaceId}/agent/${currentAgent.id}`);
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
          <>
            {/* Gateway connection status */}
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/50 text-xs">
              <Activity
                className={`h-3 w-3 ${
                  gatewayConnected === true
                    ? "text-green-500"
                    : gatewayConnected === false
                      ? "text-red-500"
                      : "text-yellow-500"
                }`}
              />
              <span className="hidden sm:inline text-muted-foreground">
                {gatewayConnected === true
                  ? t("gateway.connected")
                  : gatewayConnected === false
                    ? t("gateway.disconnected")
                    : t("gateway.connecting")}
              </span>
            </div>
            {messages.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearMessages}
                className="h-8"
              >
                <Trash2 className="h-4 w-4" />
                <span className="ml-2 hidden sm:inline">{t("chat.clearMessages")}</span>
              </Button>
            )}
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
            <Button
              variant="ghost"
              size="sm"
              className="h-8"
              onClick={() => setIsAgentSettingsOpen(true)}
            >
              <Settings className="h-4 w-4" />
            </Button>
          </>
        }
      />

      {/* Main content - WeChat style layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Conversation List (resizable) */}
        <div
          className="relative border-r flex flex-col bg-background shrink-0"
          style={{ width: leftPanelWidth }}
        >
          {/* Resize handle */}
          <ResizeHandle side="left" onResize={handleLeftPanelResize} />
          {/* Search and New Chat */}
          <div className="p-3 border-b space-y-2">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t("chat.searchConversations")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>
              <Button
                size="icon"
                className="h-9 w-9 shrink-0"
                onClick={handleCreateConversation}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Conversations List */}
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {filteredConversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <MessageSquare className="h-12 w-12 mb-3 opacity-30" />
                  <p className="text-sm">{t("chat.noConversations")}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4"
                    onClick={handleCreateConversation}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    {t("chat.startConversation")}
                  </Button>
                </div>
              ) : (
                filteredConversations.map((conversation) => (
                  <ConversationItem
                    key={conversation.id}
                    conversation={conversation}
                    isSelected={conversation.id === selectedConversationId}
                    agentName={agents.find((a) => a.id === conversation.agentId)?.name}
                    onSelect={() => {
                      setSelectedConversationId(conversation.id);
                      // TODO: Load conversation messages
                    }}
                    onRename={(newTitle) =>
                      handleRenameConversation(conversation.id, newTitle)
                    }
                    onDelete={() => handleDeleteConversation(conversation.id)}
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
                      <p className="font-medium text-sm">
                        {currentConversation?.title || t("chat.newConversation")}
                      </p>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/10 text-green-600">
                        {t("chat.online")}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {currentAgent?.name || t("chat.defaultAgent")}
                    </p>
                  </div>
                </div>

                {/* WeChat style action buttons */}
                <div className="flex items-center gap-1">
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
                      <DropdownMenuItem>
                        <Search className="h-4 w-4 mr-3" />
                        {t("chat.searchInConversation")}
                      </DropdownMenuItem>

                      {/* View history */}
                      <DropdownMenuItem>
                        <History className="h-4 w-4 mr-3" />
                        {t("chat.viewHistory")}
                      </DropdownMenuItem>

                      {/* Export conversation */}
                      <DropdownMenuItem>
                        <FileText className="h-4 w-4 mr-3" />
                        {t("chat.exportConversation")}
                      </DropdownMenuItem>

                      <DropdownMenuSeparator />

                      {/* Invite to group */}
                      <DropdownMenuItem>
                        <Users className="h-4 w-4 mr-3" />
                        {t("chat.inviteToGroup")}
                      </DropdownMenuItem>

                      {/* Share */}
                      <DropdownMenuItem>
                        <Share2 className="h-4 w-4 mr-3" />
                        {t("chat.shareConversation")}
                      </DropdownMenuItem>

                      <DropdownMenuSeparator />

                      {/* Agent settings */}
                      <DropdownMenuItem onClick={() => setIsAgentSettingsOpen(true)}>
                        <Settings className="h-4 w-4 mr-3" />
                        {t("chat.agentSettings")}
                      </DropdownMenuItem>

                      <DropdownMenuSeparator />

                      {/* Archive */}
                      <DropdownMenuItem>
                        <Archive className="h-4 w-4 mr-3" />
                        {t("chat.archiveConversation")}
                      </DropdownMenuItem>

                      {/* Clear messages */}
                      <DropdownMenuItem
                        onClick={handleClearMessages}
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
              <MessageList
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
              <div className="border-t border-border bg-background px-4 py-3">
                <ChatInput
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

      {/* Agent Settings Sheet */}
      <Sheet open={isAgentSettingsOpen} onOpenChange={setIsAgentSettingsOpen}>
        <SheetContent side="right" className="w-96">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              {t("chat.agentSettings")}
            </SheetTitle>
          </SheetHeader>
          <AgentSettingsPanel
            agent={currentAgent || null}
            models={models}
            onNavigateToFull={handleNavigateToAgentSettings}
          />
        </SheetContent>
      </Sheet>
    </motion.div>
  );
}
