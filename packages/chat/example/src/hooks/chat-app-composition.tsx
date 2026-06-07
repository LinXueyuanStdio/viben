import * as React from "react"
import { Streamdown } from "streamdown"
import type { AgentMessage, ChatInputProps, CommandQueueItem, MessageListHandle } from "@viben/chat"
import type { ExpandSubagentHandler } from "@viben/chat"
import type { TFunction } from "i18next"
import {
  CHAT_APP_COMPACT_GREETING_COUNT,
  CHAT_APP_COMPACT_GREETING_FALLBACKS,
} from "../ChatAppDemoData"
import {
  ChatAppFullscreenCommandQueue,
  ChatAppFullscreenInputPanel,
  ChatAppFullscreenMessagePanel,
  ChatAppFullscreenPanel,
  DefaultExpandedHeaderMoreMenu,
  ExpandedHeader,
  ExpandedHeaderModeControls,
  ExpandedHeaderNewSessionMenu,
  ExpandedHeaderSessionMenu,
} from "../ChatApp"
import type { ChatAppHeaderRenderProps, ChatAppMode, ChatAppSessionItem } from "../ChatApp"

type CompactActivity = {
  kind: "plain" | "thinking"
  text: string
}

type UseCompactSummaryOptions = {
  messages: AgentMessage[]
  isStreaming: boolean
  t: TFunction
}

export function useCompactSummaryContent({
  messages,
  isStreaming,
  t,
}: UseCompactSummaryOptions) {
  const compactIdleGreeting = React.useMemo(() => {
    const index = Math.min(CHAT_APP_COMPACT_GREETING_COUNT - 1, Math.floor(Math.random() * CHAT_APP_COMPACT_GREETING_COUNT))
    return t(`chat_app.greetings.${index}`, CHAT_APP_COMPACT_GREETING_FALLBACKS[index])
  }, [t])

  const compactActivity = React.useMemo<CompactActivity>(() => {
    const formatToolPath = (value: unknown): string => {
      if (!value) return "file"
      const raw = String(value)
      const packageIndex = raw.indexOf("packages/")
      return packageIndex >= 0 ? raw.slice(packageIndex) : raw.split("/").filter(Boolean).slice(-3).join("/") || "file"
    }
    const truncate = (value: string, maxLength: number): string =>
      value.length > maxLength ? `${value.slice(0, maxLength - 3)}...` : value
    const latest = [...messages].reverse().find((message) =>
      (message.type === "text" || message.type === "thinking" || message.type === "tool_use" || message.type === "error") &&
      (message.content || message.message || message.name)
    )

    if (!latest) return { kind: "plain", text: compactIdleGreeting }
    if (latest.type === "thinking") {
      return { kind: "thinking", text: latest.content || t("chat_app.activity.thinking", "Thinking...") }
    }
    if (latest.type === "error") {
      return { kind: "plain", text: latest.message || latest.content || t("chat_app.activity.needs_attention", "Something needs attention.") }
    }
    if (latest.type !== "tool_use") {
      return { kind: "plain", text: latest.content || latest.message || t("chat_app.activity.working", "Working...") }
    }

    const input = latest.input
    switch (latest.name) {
      case "Bash": {
        const command = input?.command ? truncate(String(input.command).trim(), 72) : ""
        return {
          kind: "plain",
          text: command
            ? t("chat_app.activity.running_command_named", "Running {{command}}", { command })
            : t("chat_app.activity.running_command", "Running command..."),
        }
      }
      case "Read":
        return { kind: "plain", text: t("chat_app.activity.reading_file", "Reading {{file}}...", { file: formatToolPath(input?.file_path) }) }
      case "Write":
        return { kind: "plain", text: t("chat_app.activity.writing_file", "Writing {{file}}...", { file: formatToolPath(input?.file_path) }) }
      case "Edit":
      case "MultiEdit":
        return { kind: "plain", text: t("chat_app.activity.editing_file", "Editing {{file}}...", { file: formatToolPath(input?.file_path) }) }
      case "Grep": {
        const pattern = input?.pattern ? truncate(String(input.pattern), 48) : ""
        return {
          kind: "plain",
          text: pattern
            ? t("chat_app.activity.searching_for", "Searching for \"{{pattern}}\"...", { pattern })
            : t("chat_app.activity.searching_workspace", "Searching workspace..."),
        }
      }
      case "Glob": {
        const pattern = input?.pattern ? truncate(String(input.pattern), 48) : ""
        return {
          kind: "plain",
          text: pattern
            ? t("chat_app.activity.finding", "Finding {{pattern}}...", { pattern })
            : t("chat_app.activity.finding_files", "Finding files..."),
        }
      }
      case "WebSearch":
        return { kind: "plain", text: t("chat_app.activity.searching_web", "Searching the web...") }
      case "WebFetch":
        return { kind: "plain", text: t("chat_app.activity.fetching_page", "Fetching page content...") }
      case "Task":
      case "Agent":
        return { kind: "plain", text: t("chat_app.activity.running_agent_task", "Running a delegated agent task...") }
      default:
        return {
          kind: "plain",
          text: latest.name
            ? t("chat_app.activity.running_tool", "Running {{name}}...", { name: latest.name })
            : t("chat_app.activity.working", "Working..."),
        }
    }
  }, [compactIdleGreeting, messages, t])

  return React.useMemo(() => {
    if (compactActivity.kind === "thinking") {
      return (
        <Streamdown mode={isStreaming ? "streaming" : "static"} caret={isStreaming ? "block" : undefined}>
          {compactActivity.text}
        </Streamdown>
      )
    }
    return (
      <>
        {compactActivity.text}
        {isStreaming && <span className="ml-1 inline-block h-4 w-0.5 translate-y-0.5 animate-pulse bg-primary" />}
      </>
    )
  }, [compactActivity, isStreaming])
}

type UseExpandedHeaderRendererOptions = {
  onSelectSession: (session: ChatAppSessionItem) => void
  onCreateSession: () => void
  onSettingsClick: () => void
}

export function useExpandedHeaderRenderer({
  onSelectSession,
  onCreateSession,
  onSettingsClick,
}: UseExpandedHeaderRendererOptions) {
  return React.useCallback((headerProps: ChatAppHeaderRenderProps) => (
    <ExpandedHeader
      leftContent={(
        <>
          <ExpandedHeaderSessionMenu
            title={headerProps.title}
            sessions={headerProps.sessions}
            assistantAvatar={headerProps.assistantAvatar}
            onSelectSession={onSelectSession}
          />
          <ExpandedHeaderNewSessionMenu
            agents={headerProps.agents}
            onCreateSession={onCreateSession}
          />
        </>
      )}
      centerContent={<div className="min-w-0 flex-1 cursor-move" data-testid="expanded-header-drag-area" />}
      rightContent={(
        <ExpandedHeaderModeControls
          mode={headerProps.mode}
          onModeChange={headerProps.onModeChange}
          moreMenuContent={<DefaultExpandedHeaderMoreMenu onSettingsClick={onSettingsClick} />}
        />
      )}
    />
  ), [onCreateSession, onSelectSession, onSettingsClick])
}

type UseFullscreenContentOptions = {
  messages: AgentMessage[]
  messageUpdates: Record<string, Partial<AgentMessage>>
  isStreaming: boolean
  pendingPlan: Parameters<typeof ChatAppFullscreenMessagePanel>[0]["pendingPlan"]
  pendingApproval: Parameters<typeof ChatAppFullscreenMessagePanel>[0]["pendingApproval"]
  pendingQuestion: Parameters<typeof ChatAppFullscreenMessagePanel>[0]["pendingQuestion"]
  commandQueueItems: CommandQueueItem[]
  commandQueuePaused: boolean
  messageListRef: React.RefObject<MessageListHandle | null>
  inputProps: ChatInputProps
  onExpandSubagent: ExpandSubagentHandler
  onResolvePlan: (approved: boolean) => void
  onResolveApproval: (decision: string, feedback?: string) => void
  onResolveQuestion: (answers: Record<string, string[]>) => void
  onCommandQueueRemove: (id: string) => void
  onCommandQueueClear: () => void
  onCommandQueuePause: () => void
  onCommandQueueResume: () => void
}

export function useFullscreenContent({
  messages,
  messageUpdates,
  isStreaming,
  pendingPlan,
  pendingApproval,
  pendingQuestion,
  commandQueueItems,
  commandQueuePaused,
  messageListRef,
  inputProps,
  onExpandSubagent,
  onResolvePlan,
  onResolveApproval,
  onResolveQuestion,
  onCommandQueueRemove,
  onCommandQueueClear,
  onCommandQueuePause,
  onCommandQueueResume,
}: UseFullscreenContentOptions) {
  const handleApprovePlan = React.useCallback(() => {
    console.log("Plan approved")
    onResolvePlan(true)
  }, [onResolvePlan])
  const handleRejectPlan = React.useCallback(() => {
    console.log("Plan rejected")
    onResolvePlan(false)
  }, [onResolvePlan])
  const handleApprovalDecision = React.useCallback((decision: string, feedback?: string) => {
    console.log("Exec decision:", decision, "Feedback:", feedback)
    onResolveApproval(decision, feedback)
  }, [onResolveApproval])
  const handleAnswerQuestions = React.useCallback((answers: Record<string, string[]>) => {
    console.log("Answers:", answers)
    onResolveQuestion(answers)
  }, [onResolveQuestion])

  return React.useMemo(() => (
    <ChatAppFullscreenPanel
      messageContent={(
        <ChatAppFullscreenMessagePanel
          messages={messages}
          messageUpdates={messageUpdates}
          isStreaming={isStreaming}
          pendingPlan={pendingPlan}
          pendingApproval={pendingApproval}
          pendingQuestion={pendingQuestion}
          messageListRef={messageListRef}
          onExpandSubagent={onExpandSubagent}
          onApprovePlan={handleApprovePlan}
          onRejectPlan={handleRejectPlan}
          onApprovalDecision={handleApprovalDecision}
          onAnswerQuestions={handleAnswerQuestions}
        />
      )}
      statusContent={(
        <ChatAppFullscreenCommandQueue
          commandQueueItems={commandQueueItems}
          commandQueuePaused={commandQueuePaused}
          onCommandQueueRemove={onCommandQueueRemove}
          onCommandQueueClear={onCommandQueueClear}
          onCommandQueuePause={onCommandQueuePause}
          onCommandQueueResume={onCommandQueueResume}
        />
      )}
      inputContent={(
        <ChatAppFullscreenInputPanel
          pendingPlan={pendingPlan}
          pendingApproval={pendingApproval}
          pendingQuestion={pendingQuestion}
          onApprovePlan={handleApprovePlan}
          onRejectPlan={handleRejectPlan}
          onApprovalDecision={handleApprovalDecision}
          onAnswerQuestions={handleAnswerQuestions}
          inputProps={inputProps}
        />
      )}
    />
  ), [
    commandQueueItems,
    commandQueuePaused,
    handleAnswerQuestions,
    handleApprovalDecision,
    handleApprovePlan,
    handleRejectPlan,
    inputProps,
    isStreaming,
    messageListRef,
    messageUpdates,
    messages,
    onCommandQueueClear,
    onCommandQueuePause,
    onCommandQueueRemove,
    onCommandQueueResume,
    onExpandSubagent,
    pendingApproval,
    pendingPlan,
    pendingQuestion,
  ])
}
