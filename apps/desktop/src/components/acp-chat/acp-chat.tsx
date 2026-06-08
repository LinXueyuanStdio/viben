/**
 * AcpChat - Main ACP Chat component for desktop application
 *
 * This component wraps ChatApp and provides ACP WebSocket client integration
 * for communicating with the Viben Gateway's ACP endpoint.
 */

import { useCallback, useMemo } from "react";
import {
  ChevronDown,
  EthernetPort,
  FolderPlus,
  Loader2,
  Maximize2,
  MessageSquare,
  Minimize2,
  Plug,
  Plus,
  RotateCcw,
} from "lucide-react";
import {
  buildBackgroundTasksFromMessages,
  buildTodoListItemsFromMessages,
  BackgroundTaskList,
  ChatApp,
  ChatAppFullscreenCommandQueue,
  ChatAppFullscreenInputPanel,
  ChatAppFullscreenMessagePanel,
  ChatAppFullscreenPanel,
  ChatInputBottomToolbar,
  ChatInputTopToolbar,
  ExpandedHeader,
  ExpandedHeaderModeControls,
  TodoListPanel,
  TripleSelector,
} from "@viben/chat";
import type {
  BackgroundTaskItem,
  BackgroundTasksSummary,
  ChatAppMode,
  ChatInputProps,
  MessageAttachment,
  QueuedInputRecallItem,
  SelectorOption,
  SlashCommand,
  SlashCommandSelection,
  TasksSummary,
  TripleSelectorValue,
} from "@viben/chat";
import { cn } from "@viben/ui";
import { useAcpSession } from "./use-acp-session";

const BACKEND_OPTIONS = [
  { value: "CLAUDE_CODE", label: "Claude ACP" },
  { value: "OPENCLAW", label: "OpenClaw ACP" },
  { value: "OPENCODE", label: "OpenCode" },
  { value: "CODEX", label: "Codex ACP" },
  { value: "GEMINI", label: "Gemini" },
  { value: "QWEN_CODE", label: "Qwen Code" },
];

const DEFAULT_MODEL = "claude-sonnet-4-6";

export interface AcpChatProps {
  mode: ChatAppMode;
  onModeChange: (mode: ChatAppMode) => void;
  contained?: boolean;
  className?: string;
  /** WebSocket URL for ACP connection */
  wsUrl?: string;
  /** Default working directory */
  defaultCwd?: string;
}

interface MenuActionButtonProps {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  icon?: React.ReactNode;
}

function MenuActionButton({ children, onClick, disabled, icon }: MenuActionButtonProps) {
  return (
    <button
      type="button"
      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-foreground hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
      onClick={onClick}
      disabled={disabled}
    >
      {icon}
      <span className="min-w-0 truncate">{children}</span>
    </button>
  );
}

interface AcpHeaderSessionMenuProps {
  title: string;
  sessions: Array<{ id: string; title: string; subtitle?: string }>;
  onSelectSession: (id: string) => void;
}

function AcpHeaderSessionMenu({ title, sessions, onSelectSession }: AcpHeaderSessionMenuProps) {
  return (
    <div className="relative group">
      <button
        type="button"
        className="flex h-8 max-w-44 items-center gap-1.5 rounded-md px-2 text-sm font-medium text-foreground hover:bg-accent"
      >
        <span className="truncate">{title}</span>
        <ChevronDown className="size-3.5 shrink-0" />
      </button>
      <div className="absolute left-0 top-10 z-30 hidden w-72 rounded-lg border border-border bg-popover p-1.5 shadow-xl group-focus-within:block group-hover:block">
        {sessions.length === 0 ? (
          <div className="px-2 py-2 text-xs text-muted-foreground">No sessions</div>
        ) : (
          sessions.map((session) => (
            <button
              key={session.id}
              type="button"
              className="flex w-full min-w-0 flex-col rounded-md px-2 py-2 text-left hover:bg-accent"
              onClick={() => onSelectSession(session.id)}
            >
              <span className="truncate text-sm font-medium text-foreground">{session.title}</span>
              <span className="truncate text-[11px] text-muted-foreground">{session.subtitle ?? session.id}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

interface AcpHeaderNewSessionMenuProps {
  onCreateSession: () => void;
  onSelectExecutor: (executorType: string) => void;
}

function AcpHeaderNewSessionMenu({ onCreateSession, onSelectExecutor }: AcpHeaderNewSessionMenuProps) {
  return (
    <div className="relative group flex h-8 shrink-0 overflow-hidden rounded-md border border-border bg-background">
      <button
        type="button"
        className="flex w-8 items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground"
        onClick={onCreateSession}
        aria-label="Create session"
      >
        <Plus className="size-4" />
      </button>
      <div className="h-full border-l border-border" />
      <button
        type="button"
        className="flex w-8 items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground"
        aria-label="Open session menu"
      >
        <ChevronDown className="size-4" />
      </button>
      <div className="absolute left-0 top-10 z-30 hidden w-64 rounded-lg border border-border bg-popover p-1.5 shadow-xl group-focus-within:block group-hover:block">
        <MenuActionButton onClick={onCreateSession} icon={<FolderPlus size={14} />}>
          New session
        </MenuActionButton>
        <div className="my-1 border-t border-border" />
        {BACKEND_OPTIONS.map((backend) => (
          <MenuActionButton key={backend.value} onClick={() => onSelectExecutor(backend.value)}>
            {backend.label}
          </MenuActionButton>
        ))}
      </div>
    </div>
  );
}

function shortId(id: string): string {
  return id.length <= 8 ? id : id.slice(0, 8);
}

function truncateText(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, Math.max(0, maxLength - 3))}...` : value;
}

function buildAcpCompactSummary(
  messages: Array<{ type?: string; content?: string; message?: string; name?: string }>,
  streamingText: string | null | undefined,
  isAgentRunning: boolean,
  queuedCount: number
): React.ReactNode {
  if (queuedCount > 0) {
    return `${queuedCount} queued prompt${queuedCount === 1 ? "" : "s"}`;
  }
  if (streamingText?.trim()) {
    return truncateText(streamingText.trim(), 120);
  }
  const latest = [...messages]
    .reverse()
    .find((message) => message.type === "text" || message.type === "thinking" || message.type === "tool_use" || message.type === "error");
  if (!latest) return "Ready when you are.";
  if (latest.type === "tool_use") {
    return isAgentRunning ? `Running ${latest.name ?? "tool"}...` : `Tool ${latest.name ?? "call"}`;
  }
  if (latest.type === "error") return truncateText(latest.message ?? latest.content ?? "Something needs attention.", 120);
  return truncateText(latest.content ?? latest.message ?? "Working...", 120);
}

function buildModelOptions(currentModel: string) {
  const models = [currentModel, DEFAULT_MODEL, "claude-opus-4-5", "claude-haiku-4-5"].filter(
    (item): item is string => typeof item === "string" && item.trim().length > 0
  );
  return Array.from(new Set(models)).map((id) => ({
    id,
    name: id,
    provider: id.includes("claude") ? "Anthropic" : undefined,
  }));
}

export function AcpChat({ mode, onModeChange, contained = false, className, wsUrl, defaultCwd }: AcpChatProps) {
  const acp = useAcpSession({
    wsUrl,
    defaultCwd,
  });

  const {
    connected,
    busy,
    error,
    activeSessionId,
    sessions,
    messages,
    streamingText,
    messageUpdates,
    pendingPlan,
    pendingApproval,
    pendingQuestion,
    slashCommands,
    artifacts,
    steerQueueItems,
    isTurnActive,
    isAgentRunning,
    executorType,
    model,
    connect,
    createSession,
    selectSession,
    sendPrompt,
    sendSteerPrompt,
    interrupt,
    handleSlashCommand,
    handleApprovalDecision,
    handleQuestionAnswers,
    handleApprovePlan,
    handleRejectPlan,
    removeSteerQueueItem,
    clearSteerQueue,
    recallSteerQueue,
    setExecutorType,
    setModel,
    subagentSheet,
    liveSubagentMessages,
    handleExpandSubagent,
    closeSubagentSheet,
  } = acp;

  const sessionId = activeSessionId;
  const activeTitle = sessions.find((session) => session.id === sessionId)?.title ?? "ACP Chat";

  const assistantAvatar = useMemo(
    () => (
      <div className="flex size-full items-center justify-center rounded-full bg-primary text-primary-foreground">
        <EthernetPort size={mode === "floating" ? 28 : 18} />
      </div>
    ),
    [mode]
  );

  // Track input value locally for submit control
  const inputValue = "";

  const handleSend = useCallback(
    (content: string, _attachments?: MessageAttachment[]) => {
      if (isTurnActive) {
        void sendSteerPrompt(content);
        return;
      }
      void sendPrompt(content);
    },
    [isTurnActive, sendPrompt, sendSteerPrompt]
  );

  const handleSlashCommandSelect = useCallback(
    (command: SlashCommand, selection: SlashCommandSelection) => {
      if (isTurnActive) {
        const args = selection.args.trim();
        void sendSteerPrompt(`/${command.name}${args ? ` ${args}` : ""}`);
        return;
      }
      handleSlashCommand(command, selection);
    },
    [handleSlashCommand, isTurnActive, sendSteerPrompt]
  );

  const handleRecallQueue = useCallback(
    (items: QueuedInputRecallItem[], _value: string) => {
      void recallSteerQueue(items);
    },
    [recallSteerQueue]
  );

  // TripleSelector options
  const executorSelectorOptions = useMemo<SelectorOption[]>(
    () =>
      BACKEND_OPTIONS.map((backend) => ({
        id: backend.value,
        label: backend.label,
      })),
    []
  );

  const providerSelectorOptions = useMemo<SelectorOption[]>(
    () => [
      { id: "anthropic", label: "Anthropic" },
      { id: "openai", label: "OpenAI" },
      { id: "google", label: "Google AI" },
      { id: "ollama", label: "Ollama" },
    ],
    []
  );

  const modelOptions = useMemo(() => buildModelOptions(model), [model]);
  const modelSelectorOptions = useMemo<SelectorOption[]>(
    () =>
      modelOptions.map((m) => ({
        id: m.id,
        label: m.name,
      })),
    [modelOptions]
  );

  const tripleSelectorValue = useMemo<TripleSelectorValue>(
    () => ({
      first: executorType,
      second: "anthropic",
      third: model,
    }),
    [executorType, model]
  );

  const handleTripleSelectorChange = useCallback(
    (value: TripleSelectorValue) => {
      if (value.first && value.first !== executorType) {
        setExecutorType(value.first);
      }
      if (value.third && value.third !== model) {
        setModel(value.third);
      }
    },
    [executorType, model, setExecutorType, setModel]
  );

  const tripleSelectorNode = (
    <TripleSelector
      compact
      firstOptions={executorSelectorOptions}
      firstLabel="Executor"
      firstPlaceholder="Select executor..."
      secondOptions={providerSelectorOptions}
      secondLabel="Provider"
      secondPlaceholder="Select provider..."
      thirdOptions={modelSelectorOptions}
      thirdLabel="Model"
      thirdPlaceholder="Select model..."
      value={tripleSelectorValue}
      onChange={handleTripleSelectorChange}
    />
  );

  // Build todo items and background tasks from messages
  const todoItems = useMemo(() => buildTodoListItemsFromMessages(messages, messageUpdates), [messages, messageUpdates]);

  const backgroundTasks = useMemo(
    () => buildBackgroundTasksFromMessages(messages).map(({ now: _now, ...task }) => task),
    [messages]
  );

  const tasksSummary: TasksSummary | undefined = useMemo(() => {
    if (todoItems.length === 0) return undefined;
    const completedCount = todoItems.filter((item) => item.status === "completed").length;
    return {
      items: todoItems,
      completedCount,
      totalCount: todoItems.length,
    };
  }, [todoItems]);

  const backgroundTasksSummary: BackgroundTasksSummary | undefined = useMemo(() => {
    if (backgroundTasks.length === 0) return undefined;
    const runningCount = backgroundTasks.filter((task) => task.status === "running").length;
    return {
      items: backgroundTasks,
      runningCount,
      totalCount: backgroundTasks.length,
    };
  }, [backgroundTasks]);

  const handleBackgroundTaskClick = useCallback(
    (task: BackgroundTaskItem) => {
      handleExpandSubagent(task.description, task.kind, task.messages ?? [], {
        subagentId: task.sourceMessage?.subagentId,
        toolUseId: task.sourceMessage?.toolUseId ?? task.id,
        parentMessage: task.sourceMessage,
        messages: task.messages,
      });
    },
    [handleExpandSubagent]
  );

  const renderTasksPopup = useCallback(
    () => (
      <div className="rounded-lg border border-border bg-popover shadow-xl">
        <TodoListPanel items={todoItems} defaultExpanded />
      </div>
    ),
    [todoItems]
  );

  const renderBackgroundTasksPopup = useCallback(
    () => (
      <div className="rounded-lg border border-border bg-popover shadow-xl">
        <BackgroundTaskList tasks={backgroundTasks} onTaskClick={handleBackgroundTaskClick} defaultExpanded />
      </div>
    ),
    [backgroundTasks, handleBackgroundTaskClick]
  );

  const topToolbar = useMemo(
    () => (
      <ChatInputTopToolbar
        onEmojiSelect={() => {}}
        onFileClick={() => {}}
        isLoading={isTurnActive}
        disabled={false}
        tasksSummary={tasksSummary}
        backgroundTasksSummary={backgroundTasksSummary}
        renderTasksPopup={renderTasksPopup}
        renderBackgroundTasksPopup={renderBackgroundTasksPopup}
      />
    ),
    [backgroundTasksSummary, isTurnActive, renderBackgroundTasksPopup, renderTasksPopup, tasksSummary]
  );

  const bottomToolbar = useMemo(
    () => (
      <ChatInputBottomToolbar
        leftContent={tripleSelectorNode}
        onSend={() => handleSend(inputValue)}
        onCancel={interrupt}
        isLoading={isTurnActive}
        canSubmit={connected && !!sessionId && inputValue.trim().length > 0}
        allowSendWhileLoading
      />
    ),
    [connected, handleSend, inputValue, interrupt, isTurnActive, sessionId, tripleSelectorNode]
  );

  const sharedInputProps = useMemo<Partial<ChatInputProps>>(
    () => ({
      onSend: handleSend,
      onCancel: interrupt,
      queuedInputRecallItems: steerQueueItems,
      onQueuedInputRecall: handleRecallQueue,
      isLoading: isTurnActive,
      allowSendWhileLoading: true,
      sendDisabled: !connected || !sessionId,
      sendBlockedReason: !connected
        ? "Connect first to send prompts."
        : !sessionId
          ? "Create or load a session before sending."
          : undefined,
      placeholder: isTurnActive ? "Type steering while the agent is running..." : "Type a message...",
      slashCommands,
      onSlashCommand: handleSlashCommandSelect,
      showTopToolbar: true,
      showBottomToolbar: true,
      topToolbar,
      bottomToolbar,
      showResizeHandle: true,
      defaultHeight: 132,
      minHeight: 96,
      maxHeight: 360,
      heightStorageKey: "viben_acp_chat_input_height",
    }),
    [
      bottomToolbar,
      connected,
      handleRecallQueue,
      handleSend,
      handleSlashCommandSelect,
      interrupt,
      isTurnActive,
      sessionId,
      slashCommands,
      steerQueueItems,
      topToolbar,
    ]
  );

  const statusContent = (
    <ChatAppFullscreenCommandQueue
      commandQueueItems={steerQueueItems}
      onCommandQueueRemove={removeSteerQueueItem}
      onCommandQueueClear={clearSteerQueue}
      hideItemRemove
      onCommandQueueRecall={(items) => {
        const value = items.map((item) => item.content.trim()).filter(Boolean).join("\n\n");
        handleRecallQueue(items, value);
      }}
    />
  );

  const headerContent = (
    <ExpandedHeader
      leftContent={
        <>
          <AcpHeaderSessionMenu title={activeTitle} sessions={sessions} onSelectSession={selectSession} />
          <AcpHeaderNewSessionMenu onCreateSession={createSession} onSelectExecutor={setExecutorType} />
        </>
      }
      centerContent={
        <div className="min-w-0 flex-1 text-xs text-muted-foreground">
          {sessionId ? `session ${shortId(sessionId)}` : connected ? "No active session" : "Disconnected"}
        </div>
      }
      rightContent={
        <ExpandedHeaderModeControls
          mode={mode}
          onModeChange={onModeChange}
          moreMenuContent={
            <>
              <MenuActionButton onClick={() => onModeChange("compact")} icon={<Minimize2 size={14} />}>
                Compact mode
              </MenuActionButton>
              <MenuActionButton onClick={() => onModeChange("expanded")} icon={<MessageSquare size={14} />}>
                Expanded mode
              </MenuActionButton>
              <MenuActionButton onClick={() => onModeChange("full")} icon={<Maximize2 size={14} />}>
                Fullscreen mode
              </MenuActionButton>
              <div className="my-1 border-t border-border" />
              {!connected ? (
                <MenuActionButton
                  onClick={connect}
                  disabled={busy}
                  icon={busy ? <Loader2 className="animate-spin" size={14} /> : <Plug size={14} />}
                >
                  Connect
                </MenuActionButton>
              ) : null}
              {connected && !sessionId ? (
                <MenuActionButton onClick={createSession} icon={<FolderPlus size={14} />}>
                  New session
                </MenuActionButton>
              ) : null}
              <MenuActionButton
                onClick={() => {
                  const value = steerQueueItems.map((item) => item.content.trim()).filter(Boolean).join("\n\n");
                  handleRecallQueue(steerQueueItems, value);
                }}
                disabled={steerQueueItems.length === 0 || !sessionId}
                icon={<RotateCcw size={14} />}
              >
                Recall queue
              </MenuActionButton>
            </>
          }
        />
      }
    />
  );

  const fullscreenContent = (
    <ChatAppFullscreenPanel
      messageContent={
        <ChatAppFullscreenMessagePanel
          messages={messages}
          messageUpdates={messageUpdates}
          isStreaming={isAgentRunning}
          streamingText={streamingText}
          assistantAvatar={assistantAvatar}
          artifacts={artifacts}
          pendingPlan={pendingPlan}
          pendingApproval={pendingApproval}
          pendingQuestion={pendingQuestion}
          onExpandSubagent={handleExpandSubagent}
          onApprovePlan={handleApprovePlan}
          onRejectPlan={handleRejectPlan}
          onApprovalDecision={handleApprovalDecision}
          onAnswerQuestions={handleQuestionAnswers}
          welcomeTitle="ACP Chat"
          welcomeDescription="Connect, create or resume a session, then talk to an ACP backend."
        />
      }
      statusContent={statusContent}
      inputContent={
        <ChatAppFullscreenInputPanel
          pendingPlan={pendingPlan}
          pendingApproval={pendingApproval}
          pendingQuestion={pendingQuestion}
          onApprovePlan={handleApprovePlan}
          onRejectPlan={handleRejectPlan}
          onApprovalDecision={handleApprovalDecision}
          onAnswerQuestions={handleQuestionAnswers}
          inputProps={sharedInputProps as ChatInputProps}
        />
      }
    />
  );

  return (
    <div className={cn("relative h-full min-h-[560px] overflow-hidden bg-background", className)}>
      {error && (
        <div className="absolute left-4 right-4 top-4 z-40 rounded-lg border border-destructive/35 bg-background px-3 py-2 text-sm text-destructive shadow-lg">
          {error}
        </div>
      )}
      {!connected && mode === "floating" ? (
        <button className="btn-primary absolute bottom-6 left-6 z-30" onClick={connect} disabled={busy}>
          {busy ? <Loader2 className="animate-spin" size={16} /> : <Plug size={16} />}
          Connect ACP
        </button>
      ) : null}
      {connected && !sessionId && mode !== "floating" ? (
        <div className="absolute right-5 top-5 z-40 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-background/95 p-3 shadow-lg backdrop-blur">
          <button className="btn-primary" onClick={createSession}>
            <FolderPlus size={16} />
            New Session
          </button>
        </div>
      ) : null}
      <ChatApp
        contained={contained}
        mode={mode}
        title={activeTitle}
        messages={messages}
        messageUpdates={messageUpdates}
        isStreaming={isAgentRunning}
        streamingText={streamingText}
        pendingUserMessageCount={steerQueueItems.length}
        dynamicAssistantAvatar={assistantAvatar}
        staticAssistantAvatar={assistantAvatar}
        artifacts={artifacts}
        compactSummaryContent={buildAcpCompactSummary(messages, streamingText, isAgentRunning, steerQueueItems.length)}
        headerContent={headerContent}
        inputProps={sharedInputProps}
        bottomToolbarLeftContent={tripleSelectorNode}
        statusContent={statusContent}
        fullscreenContent={fullscreenContent}
        pendingPlan={pendingPlan}
        pendingApproval={pendingApproval}
        pendingQuestion={pendingQuestion}
        onApprovePlan={handleApprovePlan}
        onRejectPlan={handleRejectPlan}
        onApprovalDecision={handleApprovalDecision}
        onAnswerQuestions={handleQuestionAnswers}
        subagentSheet={
          subagentSheet
            ? {
                open: true,
                onClose: closeSubagentSheet,
                title: subagentSheet.title,
                subagentType: subagentSheet.subagentType,
                messages: subagentSheet.messages,
                liveMessages: liveSubagentMessages,
                context: subagentSheet.context,
              }
            : undefined
        }
        onExpandSubagent={handleExpandSubagent}
        onModeChange={onModeChange}
        onSend={handleSend}
        onCancel={interrupt}
      />
      {mode === "floating" ? (
        <div className="absolute bottom-6 right-6 z-30 flex gap-2">
          <button className="btn-secondary" onClick={() => onModeChange("compact")}>
            <MessageSquare size={16} />
            Open
          </button>
          <button className="btn-secondary" onClick={() => onModeChange("expanded")}>
            <Maximize2 size={16} />
            Expanded
          </button>
        </div>
      ) : null}
    </div>
  );
}
