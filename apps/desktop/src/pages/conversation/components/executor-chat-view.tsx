import { useTranslation } from "react-i18next";
import {
  Terminal,
  Loader2,
  MessageSquare,
  Search,
  RefreshCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AgentMessage } from "@/types";
import { SessionSelector, DesktopChatInput, DesktopMessageList } from "./index";

interface ExecutorChatViewProps {
  // Executor
  selectedSidebarExecutor: {
    id: string;
    name: string;
    icon_type?: string;
    metadata?: Record<string, unknown>;
  };

  // Sessions
  executorSessionsForSelector: Array<{
    id: string;
    name: string;
    createdAt: string;
    updatedAt: string;
    messageCount: number;
  }>;
  selectedExecutorSessionId: string | null;
  isLoadingExecutorSessions: boolean;

  // Messages
  executorMessagesAsAgentMessages: AgentMessage[];
  isLoadingExecutorMessages: boolean;

  // Models
  executorModels: Array<{ id: string; name: string; provider: string; provider_id: string }>;
  selectedExecutorModelId: string | null;

  // Stats
  executorSessionStats: {
    toolsCount: number;
    skillsCount: number;
    estimatedTokens: number;
  };

  // Gateway
  gatewayConnected: boolean | null;

  // Callbacks
  onSelectSession: (sessionId: string) => void;
  onRefreshSessions: () => void;
  onModelChange: (modelId: string) => void;
  onCheckGateway: () => void;
  onOpenSearchDialog: () => void;
  onExecutorAvatarClick: () => void;
}

export function ExecutorChatView({
  selectedSidebarExecutor,
  executorSessionsForSelector,
  selectedExecutorSessionId,
  isLoadingExecutorSessions,
  executorMessagesAsAgentMessages,
  isLoadingExecutorMessages,
  executorModels,
  selectedExecutorModelId,
  executorSessionStats,
  gatewayConnected,
  onSelectSession,
  onRefreshSessions,
  onModelChange,
  onCheckGateway,
  onOpenSearchDialog,
  onExecutorAvatarClick,
}: ExecutorChatViewProps) {
  const { t } = useTranslation();

  return (
    <>
      {/* Executor Chat Header */}
      <div className="flex items-center justify-between px-4 border-b bg-background h-14">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="relative w-9 h-9 rounded-lg bg-gradient-to-br from-amber-500 to-orange-400 flex items-center justify-center shadow-sm hover:opacity-90 transition-opacity cursor-pointer"
            onClick={onExecutorAvatarClick}
            title={t("executor.showDetails", "Show executor details")}
          >
            <Terminal className="h-5 w-5 text-white" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <SessionSelector
                currentSession={
                  selectedExecutorSessionId && executorSessionsForSelector.find(s => s.id === selectedExecutorSessionId)
                    ? executorSessionsForSelector.find(s => s.id === selectedExecutorSessionId)
                    : undefined
                }
                sessions={executorSessionsForSelector}
                onSelect={(session) => onSelectSession(session.id)}
                onCreateNew={() => {}}
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
                  onClick={onCheckGateway}
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

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            title={t("chat.refreshSessions", "Refresh sessions")}
            onClick={onRefreshSessions}
            disabled={isLoadingExecutorSessions}
          >
            <RefreshCcw className={cn("h-4 w-4", isLoadingExecutorSessions && "animate-spin")} />
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
      ) : executorSessionsForSelector.length === 0 ? (
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

      {/* Input (read-only) */}
      <div className="border-t border-border">
        <DesktopChatInput
          onSend={() => {}}
          disabled
          placeholder={t("executor.readOnlyHint", "Executor sessions are read-only")}
          showConfigBar
          hideAgentSelector
          hideExecutorSelector
          models={executorModels}
          selectedModelId={selectedExecutorModelId}
          onModelChange={onModelChange}
          enabledToolsCount={executorSessionStats.toolsCount}
          onToolsClick={() => {}}
          enabledSkillsCount={executorSessionStats.skillsCount}
          onSkillsClick={() => {}}
          contextTokens={executorSessionStats.estimatedTokens}
        />
      </div>
    </>
  );
}
