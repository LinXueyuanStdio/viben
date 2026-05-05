import {
  DesktopChatInput,
  DesktopMessageList,
  type SlashCommand,
} from "@/components/chat";
import type { AgentMessage } from "@/types";

export interface AgentChatTabProps {
  messages: AgentMessage[];
  isStreaming: boolean;
  pendingPlan: unknown;
  pendingQuestions: unknown;
  artifacts: unknown;
  error: string | null | undefined;
  phase: string;
  taskStatus: string;
  slashCommands: SlashCommand[];
  placeholder: string;
  waitingForApprovalText: string;
  waitingForInputText: string;
  onSend: (message: string) => void;
  onCancel: () => void;
  onApprovePlan: () => void;
  onRejectPlan: () => void;
  onAnswerQuestions: (answers: unknown) => void;
  onSlashCommand: (command: SlashCommand) => void;
}

export function AgentChatTab({
  messages,
  isStreaming,
  pendingPlan,
  pendingQuestions,
  artifacts,
  error,
  phase,
  taskStatus,
  slashCommands,
  placeholder,
  waitingForApprovalText,
  waitingForInputText,
  onSend,
  onCancel,
  onApprovePlan,
  onRejectPlan,
  onAnswerQuestions,
  onSlashCommand,
}: AgentChatTabProps) {
  return (
    <>
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
      />

      {error && (
        <div className="px-4 py-2 bg-destructive/10 border-t border-destructive/20">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      <div className="border-t border-border">
        <DesktopChatInput
          onSend={onSend}
          onCancel={onCancel}
          isLoading={isStreaming}
          disabled={phase === "awaiting_approval" || phase === "awaiting_input"}
          placeholder={
            phase === "awaiting_approval"
              ? waitingForApprovalText
              : phase === "awaiting_input"
                ? waitingForInputText
                : placeholder
          }
          autoFocus={false}
          showTopToolbar
          showConfigBar
          showResizeHandle
          enableWritingMode
          useGlobalConfig
          hideAgentSelector={taskStatus !== "backlog"}
          hideModelSelector={taskStatus !== "backlog"}
          hideExecutorSelector={taskStatus !== "backlog"}
          slashCommands={slashCommands}
          onSlashCommand={onSlashCommand}
        />
      </div>
    </>
  );
}
