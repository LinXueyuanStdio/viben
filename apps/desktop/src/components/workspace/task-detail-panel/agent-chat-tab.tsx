import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { DesktopMessageList } from "@/components/conversation";
import { DesktopChatInput } from "@/pages/conversation/components";
import type { SlashCommand, SlashCommandHandler } from "@viben/chat";
import {
  SubagentSheet,
  PlanApproval,
  QuestionInput,
  ExecApproval,
} from "@viben/chat";
import type {
  AgentMessage as ChatAgentMessage,
  MessageAttachment,
  PendingExecApproval,
} from "@viben/chat";
import type {
  AgentMessage,
  AgentPhase,
  Artifact,
  PendingQuestion,
  TaskPlan,
} from "@/types";

export interface AgentChatTabProps {
  messages: AgentMessage[];
  isStreaming: boolean;
  pendingPlan: TaskPlan | null;
  pendingQuestions: PendingQuestion | null;
  pendingExecApproval?: PendingExecApproval | null;
  artifacts: Artifact[];
  error: string | null | undefined;
  phase: AgentPhase;
  slashCommands: SlashCommand[];
  placeholder: string;
  waitingForApprovalText: string;
  waitingForInputText: string;
  onSend: (message: string, attachments?: MessageAttachment[]) => void;
  onCancel: () => void;
  onApprovePlan: () => void;
  onRejectPlan: () => void;
  onAnswerQuestions: (answers: Record<string, string[]>) => void;
  onApproveExec?: (decision: string, feedback?: string) => void;
  onSlashCommand: SlashCommandHandler;
}

export function AgentChatTab({
  messages,
  isStreaming,
  pendingPlan,
  pendingQuestions,
  pendingExecApproval,
  artifacts,
  error,
  phase,
  slashCommands,
  placeholder,
  waitingForApprovalText,
  waitingForInputText,
  onSend,
  onCancel,
  onApprovePlan,
  onRejectPlan,
  onAnswerQuestions,
  onApproveExec,
  onSlashCommand,
}: AgentChatTabProps) {
  const [sheetData, setSheetData] = useState<{
    title: string;
    subagentType?: string;
    messages: ChatAgentMessage[];
  } | null>(null);

  return (
    <>
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
        onExpandSubagent={(title, subagentType, msgs) =>
          setSheetData({ title, subagentType, messages: msgs })
        }
      />

      {error && (
        <div className="px-4 py-2 bg-destructive/10 border-t border-destructive/20">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      <div className="border-t border-border">
        <AnimatePresence mode="wait">
          {pendingPlan ? (
            <motion.div
              key="plan"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              className="px-4 py-3"
            >
              <PlanApproval
                plan={pendingPlan}
                isPending
                onApprove={onApprovePlan}
                onReject={onRejectPlan}
              />
            </motion.div>
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
            <motion.div
              key="questions"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              className="px-4 py-3"
            >
              <QuestionInput
                questions={pendingQuestions}
                onSubmit={onAnswerQuestions}
              />
            </motion.div>
          ) : (
            <motion.div
              key="input"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
            >
              <DesktopChatInput
                onSend={onSend}
                onCancel={onCancel}
                isLoading={isStreaming}
                disabled={
                  phase === "awaiting_approval" ||
                  phase === "awaiting_input"
                }
                placeholder={
                  phase === "awaiting_approval"
                    ? waitingForApprovalText
                    : phase === "awaiting_input"
                      ? waitingForInputText
                      : placeholder
                }
                autoFocus={false}
                showResizeHandle
                slashCommands={slashCommands}
                onSlashCommand={onSlashCommand}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
