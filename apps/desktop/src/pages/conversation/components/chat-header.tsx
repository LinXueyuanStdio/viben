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

export function ChatHeader({
  currentConversation,
  currentAgent,
  agentConversations,
  gatewayConnected,
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
  const { t } = useTranslation();

  return (
    <div className="flex items-center justify-between px-4 border-b bg-background h-14">
      <div className="flex items-center gap-3">
        {/* Agent avatar */}
        <button
          type="button"
          className="relative w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center shadow-sm hover:opacity-90 transition-opacity cursor-pointer"
          onClick={onAgentAvatarClick}
          title={t("agent.showDetails", "Show agent details")}
        >
          <Bot className="h-5 w-5 text-white" />
        </button>
        <div>
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
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/10 text-green-600">
                Gateway
              </span>
            ) : gatewayConnected === false ? (
              <span
                className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-600 cursor-pointer"
                onClick={onCheckGateway}
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

      {/* Action buttons */}
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
              <Search className="h-4 w-4 mr-3" />
              {t("chat.searchInConversation")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onOpenHistoryDialog}>
              <History className="h-4 w-4 mr-3" />
              {t("chat.viewHistory")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onOpenExportDialog}>
              <FileText className="h-4 w-4 mr-3" />
              {t("chat.exportConversation")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onOpenGroupDialog}>
              <Users className="h-4 w-4 mr-3" />
              {t("chat.inviteToGroup")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onOpenShareDialog}>
              <Share2 className="h-4 w-4 mr-3" />
              {t("chat.shareConversation")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onNavigateToAgentSettings}>
              <Settings className="h-4 w-4 mr-3" />
              {t("chat.agentSettings")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onOpenSessionFolder}>
              <FolderOpen className="h-4 w-4 mr-3" />
              {t("chat.openSessionFolder", "Open Session Folder")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onArchiveConversation}>
              <Archive className="h-4 w-4 mr-3" />
              {t("chat.archiveConversation")}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={onOpenClearDialog}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-3" />
              {t("chat.clearMessages")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
