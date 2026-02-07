import * as React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import {
  Settings,
  PanelRightOpen,
  PanelRightClose,
  Trash2,
  Loader2,
  Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AgentChatInput,
  MessageList,
  RightSidebar,
} from "@/components/chat";
import { WorkspaceHeader } from "@/components/workspace";
import { useAgent } from "@/hooks";
import { useLocalWorkspaces } from "@/hooks";

export function WorkspaceChatPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(true);

  // Get workspace info
  const { workspaces, isLoading: isLoadingWorkspace } = useLocalWorkspaces();
  const workspace = workspaces.find((w) => w.id === workspaceId);

  // Agent hook - use workspace path as workdir for the agent
  const {
    messages,
    phase,
    isStreaming,
    pendingPlan,
    pendingQuestions,
    artifacts,
    toolUsages,
    error,
    gatewayConnected,
    sendMessage,
    approvePlan,
    rejectPlan,
    answerQuestions,
    cancel,
    clearMessages,
  } = useAgent(workspace?.path || "");

  // Navigate back if workspace not found after loading
  React.useEffect(() => {
    if (!isLoadingWorkspace && !workspace && workspaceId) {
      navigate(`/workspace/${workspaceId}`);
    }
  }, [isLoadingWorkspace, workspace, workspaceId, navigate]);

  if (isLoadingWorkspace) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-sm">{t("common.loading")}</p>
        </div>
      </div>
    );
  }

  if (!workspace) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex h-full flex-col overflow-hidden"
    >
      {/* Header with breadcrumb */}
      <WorkspaceHeader
        workspace={workspace}
        segments={[{ label: t("chat.title"), href: `/workspace/${workspaceId}/chat` }]}
        showRefresh={false}
        showRemove={false}
        rightContent={
          <>
            {/* Gateway connection status */}
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/50 text-xs">
              <Activity
                className={`h-3 w-3 ${
                  gatewayConnected === true
                    ? "text-green-500"
                    : gatewayConnected === false
                      ? "text-red-500"
                      : "text-yellow-500"
                }`}
              />
              <span className="hidden sm:inline text-muted-foreground">
                {gatewayConnected === true
                  ? t("gateway.connected")
                  : gatewayConnected === false
                    ? t("gateway.disconnected")
                    : t("gateway.connecting")}
              </span>
            </div>
            {messages.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearMessages}
                className="h-8"
              >
                <Trash2 className="h-4 w-4" />
                <span className="ml-2 hidden sm:inline">{t("chat.clearMessages")}</span>
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="h-8"
            >
              {isSidebarOpen ? (
                <PanelRightClose className="h-4 w-4" />
              ) : (
                <PanelRightOpen className="h-4 w-4" />
              )}
            </Button>
            <Button variant="ghost" size="sm" className="h-8">
              <Settings className="h-4 w-4" />
            </Button>
          </>
        }
      />

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Chat area */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Messages */}
          <MessageList
            messages={messages}
            isStreaming={isStreaming}
            pendingPlan={pendingPlan}
            pendingQuestions={pendingQuestions}
            onApprovePlan={approvePlan}
            onRejectPlan={rejectPlan}
            onAnswerQuestions={answerQuestions}
            className="flex-1"
          />

          {/* Error display */}
          {error && (
            <div className="px-4 py-2 bg-destructive/10 border-t border-destructive/20">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {/* Input */}
          <div className="border-t border-border bg-background p-4">
            <AgentChatInput
              onSend={sendMessage}
              onCancel={cancel}
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
            />
          </div>
        </div>

        {/* Right sidebar */}
        <RightSidebar
          artifacts={artifacts}
          toolUsages={toolUsages}
          messages={messages}
          workingDir={workspace.path}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />
      </div>
    </motion.div>
  );
}
