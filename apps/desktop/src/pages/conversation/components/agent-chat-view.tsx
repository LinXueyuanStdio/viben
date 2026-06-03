import { useCallback, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, MessageSquare, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getGatewayClient } from "@/lib/gateway";
import { isAgentAvailable } from "@/lib/gateway/utils";
import type { AgentMessage, Artifact, TaskPlan, PendingQuestion, PendingExecApproval } from "@/types";
import {
  ExecApproval,
  PlanApproval,
  QuestionInput,
  CommandQueuePanel,
  SubagentSheet,
} from "@viben/chat";
import type { SlashCommand, CommandQueueItem, AgentMessage as ChatAgentMessage } from "@viben/chat";
import { DesktopChatInput, DesktopMessageList } from "./index";
import { ChatHeader } from "./chat-header";
import { ContextUsageIndicator } from "./context-usage-indicator";
import type { Conversation } from "../conversation-utils";

interface AgentChatViewProps {
  // Conversation
  selectedConversationId: string | null;
  currentConversation?: Conversation;
  agentConversations: Conversation[];
  conversations: Conversation[];

  // Agent
  agents: Array<{ id: string; name: string }>;
  selectedAgentId: string | null;
  currentAgent?: {
    id: string;
    name: string;
    config_path?: string;
    model?: string;
  };
  currentChatListAgent?: { id: string };

  // Messages
  messages: AgentMessage[];
  phase: string;
  isStreaming: boolean;
  pendingPlan: TaskPlan | null;
  pendingQuestions: PendingQuestion | null;
  pendingExecApproval?: PendingExecApproval | null;
  contextUsage?: { used: number; total: number } | null;
  artifacts: Artifact[];
  error: string | null;
  highlightedMessageId: string | null;

  // Gateway
  gatewayConnected: boolean | null;
  executorType?: string;
  isLoadingSessions: boolean;

  // Command Queue
  commandQueue?: {
    items: CommandQueueItem[];
    isPaused: boolean;
    onRemove: (id: string) => void;
    onClear: () => void;
    onPause: () => void;
    onResume: () => void;
  };

  // Slash commands
  slashCommands: SlashCommand[];

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
  onSendMessage: (message: string) => void;
  onSteerMessage?: (message: string) => void;
  onCancel: () => void;
  onApprovePlan: (feedback?: string) => void;
  onRejectPlan: (feedback?: string) => void;
  onAnswerQuestions: (answers: Record<string, string[]>) => void;
  onApproveExec?: (decision: string, feedback?: string) => void;
  onSlashCommand: (command: SlashCommand) => void;
  onArtifactClick: (artifactId: string) => void;
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
  onAgentSettings: (agentId: string) => void;
  headerless?: boolean;
}

export function AgentChatView({
  selectedConversationId,
  currentConversation,
  agentConversations,
  agents,
  selectedAgentId,
  currentAgent,
  currentChatListAgent,
  messages,
  phase,
  isStreaming,
  pendingPlan,
  pendingQuestions,
  pendingExecApproval,
  contextUsage,
  artifacts,
  error,
  highlightedMessageId,
  gatewayConnected,
  executorType,
  isLoadingSessions,
  commandQueue,
  slashCommands,
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
  onSendMessage,
  onSteerMessage,
  onCancel,
  onApprovePlan,
  onRejectPlan,
  onAnswerQuestions,
  onApproveExec,
  onSlashCommand,
  onArtifactClick,
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
  onAgentSettings,
  headerless = false,
}: AgentChatViewProps) {
  const { t } = useTranslation();

  // Route send to steer when agent is streaming
  const handleSend = useCallback((message: string) => {
    if (isStreaming && onSteerMessage) {
      onSteerMessage(message);
    } else {
      onSendMessage(message);
    }
  }, [isStreaming, onSteerMessage, onSendMessage]);

  // Subagent sheet state (uses @viben/chat's AgentMessage type for SubagentSheet compatibility)
  const [sheetData, setSheetData] = useState<{
    title: string;
    subagentType?: string;
    messages: ChatAgentMessage[];
  } | null>(null);

  // OpenClaw unavailability check
  const [openclawUnavailable, setOpenclawUnavailable] = useState(false);
  useEffect(() => {
    if (executorType !== "OPENCLAW" || gatewayConnected !== true) {
      setOpenclawUnavailable(false);
      return;
    }
    let cancelled = false;
    getGatewayClient()
      .checkAvailability("OPENCLAW")
      .then((info) => {
        if (!cancelled) setOpenclawUnavailable(!isAgentAvailable(info));
      })
      .catch(() => {
        if (!cancelled) setOpenclawUnavailable(true);
      });
    return () => { cancelled = true; };
  }, [executorType, gatewayConnected]);

  if (!selectedConversationId) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <MessageSquare className="h-16 w-16 mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium mb-2">{t("chat.welcomeTitle")}</p>
          <p className="text-sm text-muted-foreground mb-4">
            {t("chat.welcomeDescription")}
          </p>
          <Button onClick={onCreateConversation}>
            <Plus className="h-4 w-4 mr-2" />
            {t("chat.startConversation")}
          </Button>
        </div>
      </div>
    );
  }

  const agentConversationsForHeader = agentConversations.map((c) => ({
    id: c.id,
    name: c.title,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    messageCount: c.messageCount,
    isPinned: c.isPinned,
    isStarred: c.isStarred,
    lastMessage: c.lastMessage,
    agentName: agents.find((a) => a.id === c.agentId)?.name,
  }));

  return (
    <>
      {/* Subagent Sheet (side panel) */}
      <SubagentSheet
        open={!!sheetData}
        onClose={() => setSheetData(null)}
        title={sheetData?.title || ""}
        subagentType={sheetData?.subagentType}
        messages={sheetData?.messages || []}
        onExpandSubagent={(title, subagentType, msgs) =>
          setSheetData({ title, subagentType, messages: msgs })
        }
      />

      {!headerless ? (
        <ChatHeader
          currentConversation={currentConversation}
          currentAgent={currentAgent}
          currentChatListAgent={currentChatListAgent}
          agentConversations={agentConversationsForHeader}
          agents={agents}
          selectedAgentId={selectedAgentId}
          gatewayConnected={gatewayConnected}
          executorType={executorType}
          isLoadingSessions={isLoadingSessions}
          onSelectSession={onSelectSession}
          onCreateConversation={onCreateConversation}
          onRenameSession={onRenameSession}
          onDeleteSession={onDeleteSession}
          onPinSession={onPinSession}
          onArchiveSession={onArchiveSession}
          onStarSession={onStarSession}
          onDuplicateSession={onDuplicateSession}
          onRefreshSessions={onRefreshSessions}
          onCheckGateway={onCheckGateway}
          onAgentAvatarClick={onAgentAvatarClick}
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
      ) : null}

      {/* OpenClaw unavailability banner */}
      {openclawUnavailable && (
        <div className="flex items-center gap-2 border-b border-yellow-500/20 bg-yellow-500/5 px-4 py-2">
          <AlertTriangle className="h-4 w-4 shrink-0 text-yellow-600" />
          <p className="flex-1 text-xs text-yellow-700 dark:text-yellow-400">
            {t("chat.openclawUnavailableBanner")}
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs"
            onClick={onNavigateToAgentSettings}
          >
            {t("chat.openclawUnavailableAction")}
          </Button>
        </div>
      )}

      {/* Messages */}
      <DesktopMessageList
        messages={messages}
        isStreaming={isStreaming}
        pendingPlan={pendingPlan}
        pendingQuestions={pendingQuestions}
        onApprovePlan={onApprovePlan}
        onRejectPlan={onRejectPlan}
        onAnswerQuestions={onAnswerQuestions}
        className="flex-1 min-w-0 overflow-hidden"
        maxMessageWidth="100%"
        artifacts={artifacts}
        highlightedMessageId={highlightedMessageId}
        onArtifactClick={onArtifactClick}
        onExpandSubagent={(title, subagentType, msgs) =>
          setSheetData({ title, subagentType, messages: msgs })
        }
      />

      {/* Error display */}
      {error && (
        <div className="px-4 py-2 bg-destructive/10 border-t border-destructive/20">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Command Queue Panel */}
      {commandQueue && commandQueue.items.length > 0 && (
        <CommandQueuePanel
          items={commandQueue.items}
          isPaused={commandQueue.isPaused}
          onRemove={commandQueue.onRemove}
          onClear={commandQueue.onClear}
          onPause={commandQueue.onPause}
          onResume={commandQueue.onResume}
        />
      )}

      {/* Bottom bar: animated transition between PlanApproval / ExecApproval / QuestionInput / ChatInput */}
      <div className="border-t border-border">
        <AnimatePresence mode="wait">
          {pendingPlan ? (
            <PlanApproval
              key="plan"
              plan={pendingPlan}
              isPending
              onApprove={() => onApprovePlan()}
              onReject={() => onRejectPlan()}
              className="px-4 py-3"
            />
          ) : pendingExecApproval && onApproveExec ? (
            <motion.div
              key="approval"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              className="px-4 py-3"
            >
              <ExecApproval
                approval={pendingExecApproval}
                onDecision={onApproveExec}
                enableKeyboard
              />
            </motion.div>
          ) : pendingQuestions ? (
            <QuestionInput
              key="question"
              questions={pendingQuestions}
              onSubmit={onAnswerQuestions}
              className="px-4 py-3"
            />
          ) : (
            <motion.div
              key="input"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              className="relative"
            >
              {/* Context Usage Indicator - positioned top-right of input area */}
              {contextUsage && (
                <div className="absolute top-2 right-3 z-10">
                  <ContextUsageIndicator used={contextUsage.used} total={contextUsage.total} />
                </div>
              )}
              <DesktopChatInput
                onSend={handleSend}
                onCancel={onCancel}
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
                allowSendWhileLoading={!!onSteerMessage}
                useGlobalConfig
                hideAgentSelector
                hideExecutorSelector
                hideModelSelector
                showSandboxToggle
                slashCommands={slashCommands}
                onSlashCommand={onSlashCommand}
                onAgentSettings={(agentId) => onAgentSettings(agentId)}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
