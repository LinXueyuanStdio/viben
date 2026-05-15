import { useMemo, useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Users,
  Bot,
  Loader2,
  MessageSquare,
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
import { SubagentSheet } from "@viben/chat";
import type { AgentMessage, AgentMessage as ChatAgentMessage } from "@viben/chat";
import type { GroupChatUIMessage, GroupChatMember } from "@/lib/gateway";
import { SessionSelector, DesktopMessageList, DesktopChatInput } from "./index";

interface GroupChatViewProps {
  currentGroupChat: {
    group_chat: {
      id: string;
      name: string;
      is_global?: boolean;
    };
  };
  groupChatMembers: GroupChatMember[];
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
  groupChatMessages: GroupChatUIMessage[];
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
  headerless?: boolean;
}

interface GroupChatHeaderCenterProps {
  currentGroupChat: GroupChatViewProps["currentGroupChat"];
  groupChatMembers: GroupChatMember[];
  groupChatConnected: boolean;
}

interface GroupChatHeaderActionsProps {
  currentGroupChat: GroupChatViewProps["currentGroupChat"];
  currentGroupChatSession?: GroupChatViewProps["currentGroupChatSession"];
  groupChatSessions: GroupChatViewProps["groupChatSessions"];
  groupChatViewMode: "ui" | "agent";
  groupChatViewAgentId?: string | null;
  sessionAgents: string[];
  groupChatMembers: GroupChatMember[];
  onSelectSession: (sessionId: string) => void;
  onCreateSession: () => void;
  onSwitchView: (view: "ui" | "agent", agentId?: string) => void;
  onOpenMembersDialog: () => void;
}

export function GroupChatHeaderCenter({
  currentGroupChat,
  groupChatMembers,
  groupChatConnected,
}: GroupChatHeaderCenterProps) {
  const { t } = useTranslation();

  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="relative flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-pink-400 shadow-sm">
        <Users className="h-5 w-5 text-white" />
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">
            {currentGroupChat.group_chat.name}
          </span>
          {currentGroupChat.group_chat.is_global && (
            <span className="rounded bg-blue-500/10 px-1.5 py-0.5 text-[10px] text-blue-600">
              {t("groupChat.global", "Global")}
            </span>
          )}
          {groupChatConnected ? (
            <span className="rounded bg-green-500/10 px-1.5 py-0.5 text-[10px] text-green-600">
              {t("groupChat.connected", "Connected")}
            </span>
          ) : (
            <span className="rounded bg-yellow-500/10 px-1.5 py-0.5 text-[10px] text-yellow-600">
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
  );
}

export function GroupChatHeaderActions({
  currentGroupChat,
  currentGroupChatSession,
  groupChatSessions,
  groupChatViewMode,
  groupChatViewAgentId,
  sessionAgents,
  groupChatMembers,
  onSelectSession,
  onCreateSession,
  onSwitchView,
  onOpenMembersDialog,
}: GroupChatHeaderActionsProps) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-2">
      <SessionSelector
        currentSession={
          currentGroupChatSession
            ? {
                id: currentGroupChatSession.id,
                name: currentGroupChatSession.title || t("chat.sessionFallbackName", "Session {{id}}", { id: currentGroupChatSession.id.slice(0, 8) }),
                createdAt: currentGroupChatSession.created_at,
                updatedAt: currentGroupChatSession.updated_at,
                messageCount: 0,
              }
            : undefined
        }
        sessions={groupChatSessions.map((s) => ({
          id: s.id,
          name: s.title || t("chat.sessionFallbackName", "Session {{id}}", { id: s.id.slice(0, 8) }),
          createdAt: s.created_at,
          updatedAt: s.updated_at,
          messageCount: 0,
        }))}
        onSelect={(session) => onSelectSession(session.id)}
        onCreateNew={onCreateSession}
        showCreateButton={true}
        agentName={currentGroupChat.group_chat.name}
      />

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
            <MessageSquare className="mr-2 h-4 w-4" />
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
                <Bot className="mr-2 h-4 w-4" />
                {agentMember?.display_name || agentId}
              </DropdownMenuItem>
            );
          })}
          {sessionAgents.length === 0 ? (
            <div className="px-2 py-1.5 text-xs italic text-muted-foreground">
              {t("groupChat.noAgents", "No agents in session")}
            </div>
          ) : null}
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
  );
}

// ============================================================================
// Adapter: GroupChatUIMessage[] -> AgentMessage[]
// ============================================================================

/**
 * Convert group chat messages to AgentMessage format for DesktopMessageList.
 *
 * Mapping:
 * - "user"           -> AgentMessage type "user" (renders as right-aligned bubble)
 * - "agent_response" -> AgentMessage type "text" with sender attribution prefix
 * - "agent_thinking" -> AgentMessage type "text" with italic thinking indicator
 * - "system"         -> AgentMessage type "text" with system styling
 */
function adaptGroupChatMessages(
  messages: GroupChatUIMessage[],
  members: GroupChatMember[],
): AgentMessage[] {
  const memberNameMap = new Map<string, string>();
  for (const m of members) {
    memberNameMap.set(m.id, m.display_name);
    memberNameMap.set(m.member_id, m.display_name);
  }

  return messages.map((msg): AgentMessage => {
    const senderName =
      msg.sender_name ||
      msg.agent_name ||
      (msg.sender_id ? memberNameMap.get(msg.sender_id) : undefined) ||
      (msg.agent_id ? memberNameMap.get(msg.agent_id) : undefined);

    switch (msg.type) {
      case "user":
        return {
          id: msg.id,
          type: "user",
          content: msg.content || "",
          timestamp: new Date(msg.timestamp).getTime(),
        };

      case "agent_response": {
        // Prefix with sender name in bold so attribution is preserved
        const prefix = senderName ? `**${senderName}:**\n\n` : "";
        return {
          id: msg.id,
          type: "text",
          content: `${prefix}${msg.content || ""}`,
          timestamp: new Date(msg.timestamp).getTime(),
        };
      }

      case "agent_thinking": {
        const label = senderName || "Agent";
        return {
          id: msg.id,
          type: "text",
          content: `*${label} is thinking...*`,
          timestamp: new Date(msg.timestamp).getTime(),
        };
      }

      case "system":
        return {
          id: msg.id,
          type: "text",
          content: msg.content || "",
          timestamp: new Date(msg.timestamp).getTime(),
        };

      default:
        return {
          id: msg.id,
          type: "text",
          content: msg.content || "",
          timestamp: new Date(msg.timestamp).getTime(),
        };
    }
  });
}

// ============================================================================
// Typing Indicator (inline below message list)
// ============================================================================

function TypingIndicator({
  typingMembers,
  members,
}: {
  typingMembers: string[];
  members: GroupChatMember[];
}) {
  const { t } = useTranslation();

  if (typingMembers.length === 0) return null;

  const typingNames = typingMembers.map((id) => {
    const member = members.find((m) => m.member_id === id);
    return member?.display_name || id;
  });

  let text: string;
  if (typingNames.length === 1) {
    text = t("groupChat.oneTyping", "{{name}} is typing...", { name: typingNames[0] });
  } else if (typingNames.length === 2) {
    text = t("groupChat.twoTyping", "{{name1}} and {{name2}} are typing...", {
      name1: typingNames[0],
      name2: typingNames[1],
    });
  } else {
    text = t("groupChat.manyTyping", "Several people are typing...");
  }

  return (
    <div className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground">
      <div className="flex gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "0ms" }} />
        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "150ms" }} />
        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "300ms" }} />
      </div>
      <span>{text}</span>
    </div>
  );
}

// ============================================================================
// GroupChatView (migrated)
// ============================================================================

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
  groupChatInput: _groupChatInput,
  selectedGroupSessionId,
  onSelectSession,
  onCreateSession,
  onSwitchView,
  onSendMessage,
  onInputChange: _onInputChange,
  onSendTyping: _onSendTyping,
  onOpenMembersDialog,
  headerless = false,
}: GroupChatViewProps) {
  // groupChatInput and onInputChange are no longer needed because DesktopChatInput
  // manages its own internal state. We mark them as unused for API compatibility.
  // onSendTyping is also unused since ChatInput does not expose focus/blur callbacks.
  void _groupChatInput;
  void _onInputChange;
  void _onSendTyping;

  const { t } = useTranslation();

  // Adapt group chat messages to AgentMessage[] for DesktopMessageList
  const agentMessages = useMemo(
    () => adaptGroupChatMessages(groupChatMessages, groupChatMembers),
    [groupChatMessages, groupChatMembers],
  );

  // Wrap onSendMessage for DesktopChatInput (it passes content + optional attachments)
  const handleSend = useCallback(
    (content: string) => {
      if (content.trim()) {
        onSendMessage(content);
      }
    },
    [onSendMessage],
  );

  // Subagent sheet state
  const [sheetData, setSheetData] = useState<{
    title: string;
    subagentType?: string;
    messages: ChatAgentMessage[];
  } | null>(null);

  return (
    <>
      {/* Subagent Sheet (side panel) */}
      <SubagentSheet
        open={!!sheetData}
        onClose={() => setSheetData(null)}
        title={sheetData?.title || ""}
        subagentType={sheetData?.subagentType}
        messages={sheetData?.messages || []}
      />

      {!headerless ? (
        <div className="flex h-14 items-center justify-between border-b bg-background px-4">
          <GroupChatHeaderCenter
            currentGroupChat={currentGroupChat}
            groupChatMembers={groupChatMembers}
            groupChatConnected={groupChatConnected}
          />
          <GroupChatHeaderActions
            currentGroupChat={currentGroupChat}
            currentGroupChatSession={currentGroupChatSession}
            groupChatSessions={groupChatSessions}
            groupChatViewMode={groupChatViewMode}
            groupChatViewAgentId={groupChatViewAgentId}
            sessionAgents={sessionAgents}
            groupChatMembers={groupChatMembers}
            onSelectSession={onSelectSession}
            onCreateSession={onCreateSession}
            onSwitchView={onSwitchView}
            onOpenMembersDialog={onOpenMembersDialog}
          />
        </div>
      ) : null}

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

      {/* Group Chat Messages - using DesktopMessageList with simpleMode */}
      <DesktopMessageList
        messages={agentMessages}
        simpleMode
        className="flex-1 min-w-0 overflow-hidden"
        maxMessageWidth="100%"
        welcomeTitle={t("groupChat.emptyTitle", "No messages yet")}
        welcomeDescription={t("groupChat.emptyDescription", "Start the conversation by sending a message.")}
        onExpandSubagent={(title, subagentType, msgs) =>
          setSheetData({ title, subagentType, messages: msgs })
        }
      />

      {/* Typing indicator */}
      {typingMembers.length > 0 && (
        <TypingIndicator typingMembers={typingMembers} members={groupChatMembers} />
      )}

      {/* Error */}
      {groupChatError && (
        <div className="px-4 py-2 bg-destructive/10 border-t border-destructive/20">
          <p className="text-sm text-destructive">{groupChatError}</p>
        </div>
      )}

      {/* Input */}
      {groupChatViewMode === "ui" ? (
        <div className="border-t border-border">
          <DesktopChatInput
            onSend={handleSend}
            isLoading={isLoadingGroupChat}
            disabled={!selectedGroupSessionId}
            placeholder={
              !selectedGroupSessionId
                ? t("groupChat.selectSession", "Select or create a session to start chatting")
                : t("groupChat.inputPlaceholder", "Type a message...")
            }
            autoFocus
          />
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
