import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  Bot,
  Search,
  RefreshCcw,
  MoreHorizontal,
  History,
  FileText,
  Users,
  Share2,
  Settings,
  FolderOpen,
  Archive,
  Trash2,
} from "lucide-react";
import { getGatewayClient } from "@/lib/gateway";
import { isAgentAvailable } from "@/lib/gateway/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { SessionSelector } from "./session-selector";
import type { Conversation } from "../conversation-utils";

interface ChatHeaderProps {
  currentConversation?: Conversation;
  currentAgent?: { id: string; name: string; config_path?: string };
  currentChatListAgent?: { id: string };
  agentConversations: Array<{
    id: string;
    name: string;
    createdAt: string;
    updatedAt: string;
    messageCount: number;
    isPinned?: boolean;
    isStarred?: boolean;
    lastMessage?: string;
    agentName?: string;
  }>;
  agents: Array<{ id: string; name: string }>;
  selectedAgentId: string | null;
  gatewayConnected: boolean | null;
  executorType?: string;
  isLoadingSessions: boolean;

  // Callbacks
  onSelectSession: (sessionId: string) => void;
  onCreateConversation: () => void;
  onRenameSession: (sessionId: string, newTitle: string) => void;
  onDeleteSession: (sessionId: string) => void;
  onPinSession: (sessionId: string) => void;
  onArchiveSession: (sessionId: string) => void;
  onStarSession: (sessionId: string) => void;
  onDuplicateSession: (sessionId: string) => void;
  onRefreshSessions: () => void;
  onCheckGateway: () => void;
  onAgentAvatarClick: () => void;

  // Dialog openers
  onOpenSearchDialog: () => void;
  onOpenHistoryDialog: () => void;
  onOpenExportDialog: () => void;
  onOpenGroupDialog: () => void;
  onOpenShareDialog: () => void;
  onOpenClearDialog: () => void;
  onNavigateToAgentSettings: () => void;
  onOpenSessionFolder: () => void;
  onArchiveConversation: () => void;
}

interface ChatHeaderCenterProps {
  currentConversation?: Conversation;
  currentAgent?: { id: string; name: string; config_path?: string };
  agentConversations: Array<{
    id: string;
    name: string;
    createdAt: string;
    updatedAt: string;
    messageCount: number;
    isPinned?: boolean;
    isStarred?: boolean;
    lastMessage?: string;
    agentName?: string;
  }>;
  gatewayConnected: boolean | null;
  executorType?: string;
  onSelectSession: (sessionId: string) => void;
  onCreateConversation: () => void;
  onRenameSession: (sessionId: string, newTitle: string) => void;
  onDeleteSession: (sessionId: string) => void;
  onPinSession: (sessionId: string) => void;
  onArchiveSession: (sessionId: string) => void;
  onStarSession: (sessionId: string) => void;
  onDuplicateSession: (sessionId: string) => void;
  onCheckGateway: () => void;
  onAgentAvatarClick: () => void;
}

interface ChatHeaderActionsProps {
  isLoadingSessions: boolean;
  onRefreshSessions: () => void;
  onOpenSearchDialog: () => void;
  onOpenHistoryDialog: () => void;
  onOpenExportDialog: () => void;
  onOpenGroupDialog: () => void;
  onOpenShareDialog: () => void;
  onOpenClearDialog: () => void;
  onNavigateToAgentSettings: () => void;
  onOpenSessionFolder: () => void;
  onArchiveConversation: () => void;
}

export function ChatHeaderCenter({
  currentConversation,
  currentAgent,
  agentConversations,
  gatewayConnected,
  executorType,
  onSelectSession,
  onCreateConversation,
  onRenameSession,
  onDeleteSession,
  onPinSession,
  onArchiveSession,
  onStarSession,
  onDuplicateSession,
  onCheckGateway,
  onAgentAvatarClick,
}: ChatHeaderCenterProps) {
  const { t } = useTranslation();

  // OpenClaw availability check (only when executor is OPENCLAW and gateway is connected)
  const [openclawAvailable, setOpenclawAvailable] = useState<boolean | null>(null);
  useEffect(() => {
    if (executorType !== "OPENCLAW" || gatewayConnected !== true) {
      setOpenclawAvailable(null);
      return;
    }
    let cancelled = false;
    getGatewayClient()
      .checkAvailability("OPENCLAW")
      .then((info) => {
        if (!cancelled) setOpenclawAvailable(isAgentAvailable(info));
      })
      .catch(() => {
        if (!cancelled) setOpenclawAvailable(false);
      });
    return () => { cancelled = true; };
  }, [executorType, gatewayConnected]);

  return (
    <div className="flex min-w-0 items-center gap-3">
      <button
        type="button"
        className="relative flex h-8 w-8 items-center justify-center rounded-md bg-gradient-to-br from-blue-500 to-cyan-400 shadow-sm transition-opacity hover:opacity-90"
        title={t("agent.showDetails", "Show agent details")}
        onClick={onAgentAvatarClick}
      >
        <Bot className="h-4 w-4 text-white" />
      </button>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
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
              name: c.name,
              createdAt: c.createdAt,
              updatedAt: c.updatedAt,
              messageCount: c.messageCount,
              isPinned: c.isPinned,
              isStarred: c.isStarred,
              lastMessage: c.lastMessage,
              agentName: c.agentName,
            }))}
            onSelect={(session) => onSelectSession(session.id)}
            onCreateNew={onCreateConversation}
            onRename={onRenameSession}
            onDelete={onDeleteSession}
            onPin={onPinSession}
            onArchive={onArchiveSession}
            onStar={onStarSession}
            onDuplicate={onDuplicateSession}
            agentName={currentAgent?.name}
          />
          {gatewayConnected === true ? (
            <span className="rounded bg-green-500/10 px-1.5 py-0.5 text-[10px] text-green-600">
              {t("chat.gatewayConnected", "Gateway")}
            </span>
          ) : gatewayConnected === false ? (
            <span
              className="cursor-pointer rounded bg-yellow-500/10 px-1.5 py-0.5 text-[10px] text-yellow-600"
              onClick={onCheckGateway}
              title={t("chat.gatewayOfflineHint", "Gateway offline, click to retry")}
            >
              {t("chat.gatewayMock", "Mock")}
            </span>
          ) : (
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
              {t("chat.gatewayChecking", "...")}
            </span>
          )}
          {/* OpenClaw-specific status badge */}
          {executorType === "OPENCLAW" && openclawAvailable === true && (
            <span className="rounded bg-red-500/10 px-1.5 py-0.5 text-[10px] text-red-600">
              OpenClaw
            </span>
          )}
          {executorType === "OPENCLAW" && openclawAvailable === false && (
            <span
              className="cursor-pointer rounded bg-red-500/10 px-1.5 py-0.5 text-[10px] text-red-400 line-through"
              onClick={onCheckGateway}
              title={t("chat.openclawOfflineHint", "OpenClaw unavailable, click to retry")}
            >
              OpenClaw
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export function ChatHeaderActions({
  isLoadingSessions,
  onRefreshSessions,
  onOpenSearchDialog,
  onOpenHistoryDialog,
  onOpenExportDialog,
  onOpenGroupDialog,
  onOpenShareDialog,
  onOpenClearDialog,
  onNavigateToAgentSettings,
  onOpenSessionFolder,
  onArchiveConversation,
}: ChatHeaderActionsProps) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        title={t("chat.refreshSessions", "Refresh sessions")}
        onClick={onRefreshSessions}
        disabled={isLoadingSessions}
      >
        <RefreshCcw className={cn("h-4 w-4", isLoadingSessions && "animate-spin")} />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        title={t("chat.searchInConversation")}
        onClick={onOpenSearchDialog}
      >
        <Search className="h-4 w-4" />
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onClick={onOpenSearchDialog}>
            <Search className="mr-3 h-4 w-4" />
            {t("chat.searchInConversation")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onOpenHistoryDialog}>
            <History className="mr-3 h-4 w-4" />
            {t("chat.viewHistory")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onOpenExportDialog}>
            <FileText className="mr-3 h-4 w-4" />
            {t("chat.exportConversation")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onOpenGroupDialog}>
            <Users className="mr-3 h-4 w-4" />
            {t("chat.inviteToGroup")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onOpenShareDialog}>
            <Share2 className="mr-3 h-4 w-4" />
            {t("chat.shareConversation")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onNavigateToAgentSettings}>
            <Settings className="mr-3 h-4 w-4" />
            {t("chat.agentSettings")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onOpenSessionFolder}>
            <FolderOpen className="mr-3 h-4 w-4" />
            {t("chat.openSessionFolder", "Open Session Folder")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onArchiveConversation}>
            <Archive className="mr-3 h-4 w-4" />
            {t("chat.archiveConversation")}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={onOpenClearDialog}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="mr-3 h-4 w-4" />
            {t("chat.clearMessages")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function ChatHeader({
  currentConversation,
  currentAgent,
  agentConversations,
  gatewayConnected,
  executorType,
  isLoadingSessions,
  onSelectSession,
  onCreateConversation,
  onRenameSession,
  onDeleteSession,
  onPinSession,
  onArchiveSession,
  onStarSession,
  onDuplicateSession,
  onRefreshSessions,
  onCheckGateway,
  onAgentAvatarClick,
  onOpenSearchDialog,
  onOpenHistoryDialog,
  onOpenExportDialog,
  onOpenGroupDialog,
  onOpenShareDialog,
  onOpenClearDialog,
  onNavigateToAgentSettings,
  onOpenSessionFolder,
  onArchiveConversation,
}: ChatHeaderProps) {
  return (
    <div className="flex h-10 items-center justify-between border-b bg-background px-4">
      <ChatHeaderCenter
        currentConversation={currentConversation}
        currentAgent={currentAgent}
        agentConversations={agentConversations}
        gatewayConnected={gatewayConnected}
        executorType={executorType}
        onSelectSession={onSelectSession}
        onCreateConversation={onCreateConversation}
        onRenameSession={onRenameSession}
        onDeleteSession={onDeleteSession}
        onPinSession={onPinSession}
        onArchiveSession={onArchiveSession}
        onStarSession={onStarSession}
        onDuplicateSession={onDuplicateSession}
        onCheckGateway={onCheckGateway}
        onAgentAvatarClick={onAgentAvatarClick}
      />
      <ChatHeaderActions
        isLoadingSessions={isLoadingSessions}
        onRefreshSessions={onRefreshSessions}
        onOpenSearchDialog={onOpenSearchDialog}
        onOpenHistoryDialog={onOpenHistoryDialog}
        onOpenExportDialog={onOpenExportDialog}
        onOpenGroupDialog={onOpenGroupDialog}
        onOpenShareDialog={onOpenShareDialog}
        onOpenClearDialog={onOpenClearDialog}
        onNavigateToAgentSettings={onNavigateToAgentSettings}
        onOpenSessionFolder={onOpenSessionFolder}
        onArchiveConversation={onArchiveConversation}
      />
    </div>
  );
}
