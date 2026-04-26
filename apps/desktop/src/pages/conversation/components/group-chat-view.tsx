import { useTranslation } from "react-i18next";
import {
  Users,
  Bot,
  Loader2,
  MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { SessionSelector, GroupChatMessageList } from "./index";

interface GroupChatViewProps {
  currentGroupChat: {
    group_chat: {
      id: string;
      name: string;
      is_global?: boolean;
    };
  };
  groupChatMembers: Array<{
    id: string;
    member_type: string;
    member_id: string;
    display_name: string;
    role?: string;
  }>;
  groupChatSessions: Array<{
    id: string;
    title?: string;
    created_at: string;
    updated_at: string;
  }>;
  currentGroupChatSession?: {
    id: string;
    title?: string;
    created_at: string;
    updated_at: string;
  } | null;
  groupChatMessages: Array<unknown>;
  typingMembers: string[];
  thinkingAgents: string[];
  sessionAgents: string[];
  groupChatViewMode: "ui" | "agent";
  groupChatViewAgentId?: string | null;
  groupChatConnected: boolean;
  isLoadingGroupChat: boolean;
  groupChatError: string | null;
  groupChatInput: string;
  selectedGroupSessionId: string | null;

  // Callbacks
  onSelectSession: (sessionId: string) => void;
  onCreateSession: () => void;
  onSwitchView: (view: "ui" | "agent", agentId?: string) => void;
  onSendMessage: (content: string) => void;
  onInputChange: (value: string) => void;
  onSendTyping: (typing: boolean) => void;
  onOpenMembersDialog: () => void;
}

export function GroupChatView({
  currentGroupChat,
  groupChatMembers,
  groupChatSessions,
  currentGroupChatSession,
  groupChatMessages,
  typingMembers,
  thinkingAgents,
  sessionAgents,
  groupChatViewMode,
  groupChatViewAgentId,
  groupChatConnected,
  isLoadingGroupChat,
  groupChatError,
  groupChatInput,
  selectedGroupSessionId,
  onSelectSession,
  onCreateSession,
  onSwitchView,
  onSendMessage,
  onInputChange,
  onSendTyping,
  onOpenMembersDialog,
}: GroupChatViewProps) {
  const { t } = useTranslation();

  return (
    <>
      {/* Group Chat Header */}
      <div className="flex items-center justify-between px-4 border-b bg-background h-14">
        <div className="flex items-center gap-3">
          <div className="relative w-9 h-9 rounded-lg bg-gradient-to-br from-purple-500 to-pink-400 flex items-center justify-center shadow-sm">
            <Users className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">
                {currentGroupChat.group_chat.name}
              </span>
              {currentGroupChat.group_chat.is_global && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600">
                  {t("groupChat.global", "Global")}
                </span>
              )}
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

        <div className="flex items-center gap-2">
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
            onSelect={(session) => onSelectSession(session.id)}
            onCreateNew={onCreateSession}
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
                onClick={() => onSwitchView("ui")}
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
                    onClick={() => onSwitchView("agent", agentId)}
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
            onClick={onOpenMembersDialog}
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
        messages={groupChatMessages as any}
        members={groupChatMembers as any}
        currentUserId="user-1"
        typingMembers={typingMembers}
        className="flex-1"
      />

      {/* Error */}
      {groupChatError && (
        <div className="px-4 py-2 bg-destructive/10 border-t border-destructive/20">
          <p className="text-sm text-destructive">{groupChatError}</p>
        </div>
      )}

      {/* Input */}
      {groupChatViewMode === "ui" ? (
        <div className="border-t border-border p-4">
          <div className="flex gap-2">
            <Input
              placeholder={t("groupChat.inputPlaceholder", "Type a message...")}
              value={groupChatInput}
              onChange={(e) => onInputChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  onSendMessage(groupChatInput);
                  onInputChange("");
                }
              }}
              onFocus={() => onSendTyping(true)}
              onBlur={() => onSendTyping(false)}
              className="flex-1"
              disabled={!selectedGroupSessionId}
            />
            <Button
              onClick={() => {
                onSendMessage(groupChatInput);
                onInputChange("");
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
  );
}
