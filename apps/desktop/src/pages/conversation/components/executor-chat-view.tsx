import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Terminal,
  Loader2,
  MessageSquare,
  Search,
  RefreshCcw,
} from "lucide-react";
import { SubagentSheet } from "@viben/chat";
import type { AgentMessage as ChatAgentMessage } from "@viben/chat";
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

  // Gateway
  gatewayConnected: boolean | null;

  // Callbacks
  onSelectSession: (sessionId: string) => void;
  onRefreshSessions: () => void;
  onCheckGateway: () => void;
  onOpenSearchDialog: () => void;
  onExecutorAvatarClick: () => void;
  headerless?: boolean;
}

interface ExecutorChatHeaderCenterProps {
  selectedSidebarExecutor: ExecutorChatViewProps["selectedSidebarExecutor"];
  executorSessionsForSelector: ExecutorChatViewProps["executorSessionsForSelector"];
  selectedExecutorSessionId: string | null;
  gatewayConnected: boolean | null;
  onSelectSession: (sessionId: string) => void;
  onCheckGateway: () => void;
  onExecutorAvatarClick: () => void;
}

interface ExecutorChatHeaderActionsProps {
  isLoadingExecutorSessions: boolean;
  onRefreshSessions: () => void;
  onOpenSearchDialog: () => void;
}

export function ExecutorChatHeaderCenter({
  selectedSidebarExecutor,
  executorSessionsForSelector,
  selectedExecutorSessionId,
  gatewayConnected,
  onSelectSession,
  onCheckGateway,
  onExecutorAvatarClick,
}: ExecutorChatHeaderCenterProps) {
  const { t } = useTranslation();

  return (
    <div className="flex min-w-0 items-center gap-3">
      <button
        type="button"
        className="relative flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-orange-400 shadow-sm transition-opacity hover:opacity-90"
        title={t("executor.showDetails", "Show executor details")}
        onClick={onExecutorAvatarClick}
      >
        <Terminal className="h-5 w-5 text-white" />
      </button>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <SessionSelector
            currentSession={
              selectedExecutorSessionId &&
              executorSessionsForSelector.find((s) => s.id === selectedExecutorSessionId)
                ? executorSessionsForSelector.find((s) => s.id === selectedExecutorSessionId)
                : undefined
            }
            sessions={executorSessionsForSelector}
            onSelect={(session) => onSelectSession(session.id)}
            onCreateNew={() => {}}
            showCreateButton={false}
            agentName={selectedSidebarExecutor.name}
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
              {t("chat.gatewayOffline", "Offline")}
            </span>
          ) : (
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
              ...
            </span>
          )}
        </div>
        <p className="truncate text-xs text-muted-foreground">
          {selectedSidebarExecutor.name} - {selectedSidebarExecutor.icon_type || t("common.unknown", "Unknown")}
        </p>
      </div>
    </div>
  );
}

export function ExecutorChatHeaderActions({
  isLoadingExecutorSessions,
  onRefreshSessions,
  onOpenSearchDialog,
}: ExecutorChatHeaderActionsProps) {
  const { t } = useTranslation();

  return (
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
  );
}

export function ExecutorChatView({
  selectedSidebarExecutor,
  executorSessionsForSelector,
  selectedExecutorSessionId,
  isLoadingExecutorSessions,
  executorMessagesAsAgentMessages,
  isLoadingExecutorMessages,
  gatewayConnected,
  onSelectSession,
  onRefreshSessions,
  onCheckGateway,
  onOpenSearchDialog,
  onExecutorAvatarClick,
  headerless = false,
}: ExecutorChatViewProps) {
  const { t } = useTranslation();
  const [sheetData, setSheetData] = useState<{
    title: string; subagentType?: string; messages: ChatAgentMessage[]
  } | null>(null);

  return (
    <>
      {!headerless ? (
        <div className="flex h-14 items-center justify-between border-b bg-background px-4">
          <ExecutorChatHeaderCenter
            selectedSidebarExecutor={selectedSidebarExecutor}
            executorSessionsForSelector={executorSessionsForSelector}
            selectedExecutorSessionId={selectedExecutorSessionId}
            gatewayConnected={gatewayConnected}
            onSelectSession={onSelectSession}
            onCheckGateway={onCheckGateway}
            onExecutorAvatarClick={onExecutorAvatarClick}
          />
          <ExecutorChatHeaderActions
            isLoadingExecutorSessions={isLoadingExecutorSessions}
            onRefreshSessions={onRefreshSessions}
            onOpenSearchDialog={onOpenSearchDialog}
          />
        </div>
      ) : null}

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
              onExpandSubagent={(title, subagentType, messages) =>
                setSheetData({ title, subagentType, messages })
              }
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
        />
      </div>

      <SubagentSheet
        open={!!sheetData}
        onClose={() => setSheetData(null)}
        title={sheetData?.title || ""}
        subagentType={sheetData?.subagentType}
        messages={sheetData?.messages || []}
        onExpandSubagent={(title, subagentType, messages) =>
          setSheetData({ title, subagentType, messages })
        }
      />
    </>
  );
}
