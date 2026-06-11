import * as React from "react";
import { useTranslation } from "react-i18next";
import {
  Plus,
  Search,
  Bot,
  Users,
  PanelLeftClose,
  PanelLeftOpen,
  LayoutTemplate,
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
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import { ExecutorList } from "@/components/workspace";
import type { AgentResponse, ChatListItemType } from "@/lib/gateway";
import type { GroupChatItemData } from "./group-chat-list-item";
import { ResizeHandle } from "./resize-handle";
import { GroupChatListItem, AgentListItem } from "./index";

interface LeftPanelProps {
  isCollapsed: boolean;
  onCollapse: (collapsed: boolean) => void;
  width: number;
  onResize: (delta: number) => void;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  contentStyle: React.CSSProperties;
  searchQuery: string;
  onSearchChange: (query: string) => void;

  // Group chats
  filteredGroupChats: GroupChatItemData[];
  selectedGroupChatId: string | null;
  mutedGroupChats: Set<string>;
  workspacePath?: string;
  onSelectGroupChat: (id: string) => void;
  onRenameGroupChat: (id: string, name: string) => void;
  onToggleMuteGroupChat: (id: string) => void;
  onDeleteGroupChat: (id: string) => void;
  onLeaveGroupChat: () => void;

  // Executors
  filteredExecutors: Array<{
    id: string;
    name: string;
    item_type: ChatListItemType;
    source: string;
    workspace_path: string;
    icon_type?: string;
    description?: string;
    metadata?: Record<string, unknown>;
  }>;
  selectedSidebarExecutorId: string | null;
  isLoadingExecutors: boolean;
  onSelectExecutor: (executor: { id: string; name: string; icon_type?: string; metadata?: Record<string, unknown> }) => void;
  onExecutorSettings: (executor: { id: string }) => void;
  onRefreshExecutors: () => void;

  // Agents
  filteredChatListAgents: Array<{
    id: string;
    name: string;
    description?: string;
    source?: string;
  }>;
  selectedAgentId: string | null;
  isGroupChatMode: boolean;
  defaultAgentId?: string | null;
  conversations: Array<{ agentId?: string }>;
  onSelectAgent: (agentId: string) => void;
  onAgentSettings: (agentId: string) => void;
  onSetDefaultAgent: (agentId: string) => void;
  onDeleteAgent: (agentId: string) => void;

  // Create actions
  agentTemplates: AgentResponse[];
  onCreateAgent: (template?: AgentResponse | null) => void;
  onCreateGroupChat: () => void;
}

export function LeftPanel({
  isCollapsed,
  onCollapse,
  width,
  onResize,
  scrollRef,
  contentStyle,
  searchQuery,
  onSearchChange,
  filteredGroupChats,
  selectedGroupChatId,
  mutedGroupChats,
  workspacePath,
  onSelectGroupChat,
  onRenameGroupChat,
  onToggleMuteGroupChat,
  onDeleteGroupChat,
  onLeaveGroupChat,
  filteredExecutors,
  selectedSidebarExecutorId,
  isLoadingExecutors,
  onSelectExecutor,
  onExecutorSettings,
  onRefreshExecutors,
  filteredChatListAgents,
  selectedAgentId,
  isGroupChatMode,
  defaultAgentId,
  conversations,
  onSelectAgent,
  onAgentSettings,
  onSetDefaultAgent,
  onDeleteAgent,
  agentTemplates,
  onCreateAgent,
  onCreateGroupChat,
}: LeftPanelProps) {
  const { t } = useTranslation();

  if (isCollapsed) {
    return (
      <div className="border-r flex flex-col items-center py-3 px-1 bg-background shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => onCollapse(false)}
          title={t("chat.showPanel", "Show Panel")}
        >
          <PanelLeftOpen className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div
      className="relative border-r flex flex-col bg-background shrink-0 overflow-visible"
      style={{ width }}
    >
      <ResizeHandle side="left" onResize={onResize} />

      {/* Header with search and + button */}
      <div className="px-3 py-2.5 border-b h-10 flex items-center">
        <div className="flex items-center gap-2 flex-1">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t("executor.searchExecutors", "Search executors...")}
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-9 h-8"
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="h-8 w-8 shrink-0">
                <Plus className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => onCreateAgent(null)}>
                <Bot className="h-4 w-4 mr-2" />
                {t("agent.createAgent", "Create Agent")}
              </DropdownMenuItem>
              {agentTemplates.length > 0 && (
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <LayoutTemplate className="h-4 w-4 mr-2" />
                    {t("settingsAgents.createFromTemplate", "Create from Template")}
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-64">
                    {agentTemplates.map((template) => (
                      <DropdownMenuItem key={template.id} onClick={() => onCreateAgent(template)}>
                        <LayoutTemplate className="h-4 w-4 mr-2 text-muted-foreground" />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium">{template.name}</div>
                          {template.description && (
                            <div className="text-xs text-muted-foreground truncate">
                              {template.description}
                            </div>
                          )}
                        </div>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onCreateGroupChat}>
                <Users className="h-4 w-4 mr-2" />
                {t("chat.createGroup", "Create Group")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onCollapse(true)}>
                <PanelLeftClose className="h-4 w-4 mr-2" />
                {t("chat.hidePanel", "Hide Panel")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* List */}
      <ScrollArea className="flex-1" ref={scrollRef}>
        <div className="p-2 space-y-1" style={contentStyle}>
          {/* Group Chats */}
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
                  source={workspacePath ? { type: "workspace", path: workspacePath } : undefined}
                  onClick={() => onSelectGroupChat(groupChat.id)}
                  onRename={() => onRenameGroupChat(groupChat.id, groupChat.name)}
                  onToggleMute={() => onToggleMuteGroupChat(groupChat.id)}
                  onDelete={() => onDeleteGroupChat(groupChat.id)}
                  onLeave={onLeaveGroupChat}
                />
              ))}
            </>
          )}

          {/* Executors */}
          <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {t("executor.executors", "Executors")}
          </div>
          <ExecutorList
            executors={filteredExecutors}
            selectedExecutorId={selectedSidebarExecutorId}
            source={workspacePath ? { type: "workspace", path: workspacePath } : undefined}
            onSelect={onSelectExecutor}
            onSettings={onExecutorSettings}
            onRefresh={onRefreshExecutors}
            isLoading={isLoadingExecutors}
            className="px-0"
          />

          {/* Agents */}
          {filteredChatListAgents.length > 0 && (
            <>
              <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider mt-2">
                {t("agent.agents", "Agents")}
              </div>
              {filteredChatListAgents.map((chatListAgent) => (
                <AgentListItem
                  key={chatListAgent.id}
                  agent={{
                    id: chatListAgent.id,
                    name: chatListAgent.name,
                    description: chatListAgent.description,
                  }}
                  isSelected={chatListAgent.id === selectedAgentId && !isGroupChatMode && !selectedSidebarExecutorId}
                  isDefault={chatListAgent.id === defaultAgentId}
                  sessionCount={conversations.filter((c) => c.agentId === chatListAgent.id).length}
                  source={
                    chatListAgent.source === "global"
                      ? { type: "global", path: "~/.viben/agents" }
                      : workspacePath
                        ? { type: "workspace", path: workspacePath }
                        : undefined
                  }
                  onSelect={() => onSelectAgent(chatListAgent.id)}
                  onSettings={() => onAgentSettings(chatListAgent.id)}
                  onSetDefault={() => onSetDefaultAgent(chatListAgent.id)}
                  onDelete={() => onDeleteAgent(chatListAgent.id)}
                />
              ))}
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
