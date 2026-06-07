import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Bot, ChevronDown, ChevronUp, Maximize2, Minimize2, MoreHorizontal, Plus, Search, Settings } from "lucide-react";
import { Streamdown } from "streamdown";
import { BackgroundTaskList, ChatInput, CommandQueuePanel, EmojiPicker, ExecApproval, MessageList, PlanApproval, QuestionInput, SubagentSheet, TodoListPanel } from "@viben/chat";
import {
  CHAT_APP_COMPACT_GREETING_COUNT,
  CHAT_APP_COMPACT_GREETING_FALLBACKS,
  DEFAULT_CHAT_APP_AGENTS,
  DEFAULT_CHAT_APP_SESSIONS,
} from "./ChatAppDemoData";
import { VibenPetAvatar } from "./VibenPetAvatar";
import type { AssistantPetState, PetInteractionState } from "./VibenPetAvatar";
import type {
  AgentMessage,
  BackgroundTaskItem,
  ChatInputProps,
  CommandQueueItem,
  ExpandSubagentHandler,
  LoadSubagentDetails,
  MessageAttachment,
  PendingExecApproval,
  PendingQuestion,
  SubagentOpenContext,
  TaskPlan,
} from "@viben/chat";

type Translate = ReturnType<typeof useTranslation>["t"];

export type ChatAppMode = "floating" | "compact" | "expanded" | "full";
export type SessionPlayerStatus = "idle" | "playing" | "paused";
export type AssistantPetAvatarMap = Partial<Record<AssistantPetState, React.ReactNode>>;
export type AssistantPetAvatarSet = {
  dynamic?: AssistantPetAvatarMap;
  static?: AssistantPetAvatarMap;
};
export type ChatAppHeaderRenderProps = {
  mode: ChatAppMode;
  title: string;
  sessions: OverlaySessionItem[];
  agents: OverlayAgentItem[];
  assistantAvatar: React.ReactNode;
  headerActions?: OverlayHeaderActions;
  onModeChange: (mode: ChatAppMode) => void;
};

export interface OverlaySessionItem {
  id: string;
  title: string;
  subtitle?: string;
  avatar?: React.ReactNode;
}

export interface OverlayAgentItem {
  id: string;
  name: string;
  type: string;
  avatar?: React.ReactNode;
}

export interface OverlayHeaderActions {
  onCreateSession?: () => void;
  onNewChat?: () => void;
  onNewChatWindow?: () => void;
  onSettingsClick?: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
  onMoveToWindow?: () => void;
  onShowDebugView?: () => void;
  onShowDebugLog?: () => void;
  onSelectSession?: (session: OverlaySessionItem) => void;
  onSelectAgent?: (agent: OverlayAgentItem) => void;
}

export interface ChatAppProps {
  mode: ChatAppMode;
  messages: AgentMessage[];
  messageUpdates?: Record<string, Partial<AgentMessage>>;
  isStreaming: boolean;
  contained?: boolean;
  title?: string;
  playerStatus?: SessionPlayerStatus;
  pendingUserMessageCount?: number;
  assistantPetAvatars?: AssistantPetAvatarSet;
  assistantAvatars?: AssistantPetAvatarMap;
  sessions?: OverlaySessionItem[];
  agents?: OverlayAgentItem[];
  headerActions?: OverlayHeaderActions;
  inputValue?: string;
  onInputValueChange?: (value: string) => void;
  inputProps?: Partial<ChatInputProps>;
  fullscreenContent?: React.ReactNode;
  renderHeader?: (props: ChatAppHeaderRenderProps) => React.ReactNode;
  messageListRef?: React.ComponentPropsWithRef<typeof MessageList>["ref"];
  onExpandSubagent?: ExpandSubagentHandler;
  subagentSheet?: ChatAppSubagentSheetState;
  loadSubagentDetails?: LoadSubagentDetails;
  onModeChange: (mode: ChatAppMode) => void;
  onSend: (content: string, attachments?: MessageAttachment[]) => void;
  onCancel: () => void;
}

export interface ChatAppSubagentSheetState {
  open: boolean;
  title: string;
  subagentType?: string;
  messages: AgentMessage[];
  liveMessages?: AgentMessage[];
  context?: SubagentOpenContext;
  onClose: () => void;
}

export type ChatAppSessionItem = OverlaySessionItem;
export type ChatAppAgentItem = OverlayAgentItem;
export type ChatAppHeaderActions = OverlayHeaderActions;

export interface ChatAppFullscreenPanelProps {
  messages: AgentMessage[];
  messageUpdates?: Record<string, Partial<AgentMessage>>;
  isStreaming?: boolean;
  pendingPlan?: TaskPlan | null;
  pendingApproval?: PendingExecApproval | null;
  pendingQuestion?: PendingQuestion | null;
  commandQueueItems?: CommandQueueItem[];
  commandQueuePaused?: boolean;
  inputProps: ChatInputProps;
  messageListRef?: React.ComponentPropsWithRef<typeof MessageList>["ref"];
  assistantAvatar?: React.ReactNode;
  welcomeTitle?: string;
  welcomeDescription?: string;
  maxMessageWidth?: string;
  onExpandSubagent?: ExpandSubagentHandler;
  onApprovePlan?: () => void;
  onRejectPlan?: () => void;
  onApprovalDecision?: (decision: string, feedback?: string) => void;
  onAnswerQuestions?: (answers: Record<string, string[]>) => void;
  onCommandQueueRemove?: (id: string) => void;
  onCommandQueueClear?: () => void;
  onCommandQueuePause?: () => void;
  onCommandQueueResume?: () => void;
}

const OVERLAY_TRANSITION = {
  type: "tween",
  duration: 0.34,
  ease: [0.4, 0, 0.2, 1],
} as const;

const OVERLAY_AVATAR_TRANSITION = {
  duration: 0.22,
  ease: [0.4, 0, 0.2, 1],
} as const;

const FLOAT_OVERLAY_TRANSITION = {
  duration: 0.2,
  ease: [0.4, 0, 0.2, 1],
} as const;

const PANEL_FADE_TRANSITION = {
  duration: 0.18,
  ease: [0.4, 0, 0.2, 1],
} as const;

const INTERNAL_LAYOUT_TRANSITION = {
  type: "tween",
  duration: 0.28,
  ease: [0.4, 0, 0.2, 1],
} as const;

const OVERLAY_RADIUS = {
  floating: 999,
  compact: 24,
  expanded: 16,
  full: 0,
} as const;

const OVERLAY_PANEL_WIDTH_CLASS = "w-[min(440px,calc(100dvw_-_2rem))]";
const EXPANDED_PANEL_HEIGHT_CLASS = "h-[75dvh]";
type CompactActivitySummary = {
  kind: "plain" | "thinking";
  text: string;
};

export function getAssistantPetState(
  messages: AgentMessage[],
  isStreaming: boolean,
  playerStatus: SessionPlayerStatus = "idle"
): AssistantPetState {
  if (messages.length === 0) return "idle";
  if (isStreaming) return "review";
  const latestStatefulMessage = [...messages].reverse().find((message) =>
    message.type !== "summary" && message.type !== "plan_mode"
  );
  if (latestStatefulMessage && (latestStatefulMessage.type === "error" || latestStatefulMessage.isError)) return "failed";
  if (playerStatus === "playing") return "waiting";
  if (playerStatus === "paused") return "waving";
  return "idle";
}

export function getPetInteractionForSessionStatus(
  playerStatus: SessionPlayerStatus = "idle",
  isStreaming = false,
  hasPendingUserMessages = false
): PetInteractionState {
  if (isStreaming || hasPendingUserMessages || playerStatus === "playing") return "waiting";
  if (playerStatus === "paused") return "hover";
  return "idle";
}

export function ChatApp({
  mode,
  messages,
  messageUpdates,
  isStreaming,
  contained = false,
  title = "Viben session",
  playerStatus = "idle",
  pendingUserMessageCount = 0,
  assistantPetAvatars,
  assistantAvatars,
  sessions = DEFAULT_CHAT_APP_SESSIONS,
  agents = DEFAULT_CHAT_APP_AGENTS,
  headerActions,
  inputValue,
  onInputValueChange,
  inputProps,
  fullscreenContent,
  renderHeader,
  messageListRef,
  onExpandSubagent,
  subagentSheet,
  loadSubagentDetails,
  onModeChange,
  onSend,
  onCancel,
}: ChatAppProps) {
  const { t } = useTranslation();
  const petState = getAssistantPetState(messages, isStreaming, playerStatus);
  const petInteraction = getPetInteractionForSessionStatus(playerStatus, isStreaming, pendingUserMessageCount > 0);
  const dynamicAssistantAvatar = assistantPetAvatars?.dynamic?.[petState] ?? assistantAvatars?.[petState] ?? (
    <VibenPetAvatar kind="dynamic" state={petState} interaction={petInteraction} />
  );
  const staticAssistantAvatar = assistantPetAvatars?.static?.[petState] ?? assistantAvatars?.[petState] ?? (
    <VibenPetAvatar kind="static" state={petState} interaction="idle" />
  );
  const [uncontrolledInput, setUncontrolledInput] = React.useState("");
  const content = inputValue ?? uncontrolledInput;
  const setContent = React.useCallback((value: string) => {
    if (inputValue === undefined) setUncontrolledInput(value);
    onInputValueChange?.(value);
  }, [inputValue, onInputValueChange]);

  const idleGreeting = React.useMemo(() => {
    const index = Math.min(CHAT_APP_COMPACT_GREETING_COUNT - 1, Math.floor(Math.random() * CHAT_APP_COMPACT_GREETING_COUNT));
    return t(`chat_app.greetings.`, CHAT_APP_COMPACT_GREETING_FALLBACKS[index]);
  }, [t]);
  const compactActivity = React.useMemo(
    () => getCompactActivitySummary(messages, t, idleGreeting),
    [idleGreeting, messages, t]
  );
  const hasCompactDraft = content.trim().length > 0;

  const handleSubmit = React.useCallback(() => {
    const trimmed = content.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setContent("");
  }, [content, onSend, setContent]);

  const defaultExpandedBody = (
    <>
      <motion.div
        layoutId="viben-overlay-message-panel"
        transition={INTERNAL_LAYOUT_TRANSITION}
        className="flex min-h-0 flex-1 flex-col overflow-hidden overscroll-contain border-y border-border/70"
        data-shared-element="overlay-message-panel"
        data-testid="expanded-message-panel"
      >
        <ChatAppMessagePanel
          messageListRef={messageListRef}
          messages={messages}
          messageUpdates={messageUpdates}
          isStreaming={isStreaming}
          assistantAvatar={staticAssistantAvatar}
          maxMessageWidth="100%"
          onExpandSubagent={onExpandSubagent}
        />
      </motion.div>
      <motion.div
        layoutId="viben-overlay-input-panel"
        transition={INTERNAL_LAYOUT_TRANSITION}
        className="w-full shrink-0 border-t border-border"
        data-shared-element="overlay-input-panel"
        data-testid="expanded-chat-input-container"
      >
        <CompactChatInput
          variant="expanded"
          value={content}
          isStreaming={isStreaming}
          onValueChange={setContent}
          onSend={handleSubmit}
          onCancel={onCancel}
          inputProps={getExpandedChatInputProps(inputProps)}
        />
      </motion.div>
    </>
  );

  const headerContent = renderHeader ? renderHeader({
    mode,
    title,
    sessions,
    agents,
    assistantAvatar: staticAssistantAvatar,
    headerActions,
    onModeChange,
  }) : (
    <ExpandedHeader
      title={title}
      sessions={sessions}
      agents={agents}
      assistantAvatar={staticAssistantAvatar}
      headerActions={headerActions}
      onCreateSession={headerActions?.onCreateSession}
      onSettingsClick={headerActions?.onSettingsClick}
      mode={mode}
      onModeChange={onModeChange}
    />
  );

  const expandedContent = (
    <>
      <motion.div
        layoutId="viben-overlay-header"
        transition={INTERNAL_LAYOUT_TRANSITION}
        className="shrink-0"
        data-shared-element="overlay-header"
      >
        {headerContent}
      </motion.div>
      {mode === "full" && fullscreenContent ? fullscreenContent : defaultExpandedBody}
    </>
  );

  const subagentSheetNode = subagentSheet ? (
    <SubagentSheet
      contained
      open={subagentSheet.open}
      onClose={subagentSheet.onClose}
      title={subagentSheet.title}
      subagentType={subagentSheet.subagentType}
      messages={subagentSheet.messages}
      liveMessages={subagentSheet.liveMessages}
      context={subagentSheet.context}
      loadSubagentDetails={loadSubagentDetails}
      onExpandSubagent={onExpandSubagent}
    />
  ) : null;

  if (mode === "full") {
    return (
      <motion.div
        layoutId="viben-overlay-surface"
        transition={OVERLAY_TRANSITION}
        initial={false}
        data-transition-role="expand-to-full"
        className={`overlay-shared-surface flex min-h-0 w-full flex-col overflow-hidden bg-background shadow-none ${
          contained ? "absolute inset-y-0 right-0 z-30 h-full" : "fixed inset-y-0 right-0 z-50 h-full"
        }`}
        style={{ borderRadius: OVERLAY_RADIUS.full }}
        data-testid="full-overlay"
      >
        {expandedContent}
        {subagentSheetNode}
      </motion.div>
    );
  }

  if (mode === "floating") {
    return (
      <div className={contained ? "absolute bottom-6 left-6 z-20" : "fixed bottom-6 left-6 z-50"} data-testid="floating-overlay">
        <motion.button
          type="button"
          aria-label={t("chat_app.overlay.open_compact", "Open compact chat")}
          onClick={() => onModeChange("compact")}
          onMouseEnter={() => onModeChange("compact")}
          initial={{ opacity: 0, x: 10, y: -10 }}
          animate={{ opacity: 1, x: 0, y: 0 }}
          exit={{ opacity: 0, x: 14, y: -14 }}
          transition={FLOAT_OVERLAY_TRANSITION}
          data-transition-role="float-fade"
          data-testid="floating-overlay-surface"
          className="overlay-shared-surface overlay-breathing-surface relative flex size-20 items-center justify-center rounded-full border border-border bg-popover shadow-2xl transition-colors hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          style={{ borderRadius: OVERLAY_RADIUS.floating }}
        >
          <motion.div
            className="size-14"
            data-testid="floating-overlay-avatar"
            data-shared-element="overlay-avatar"
            data-transition-role="avatar-fade"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={OVERLAY_AVATAR_TRANSITION}
          >
            {dynamicAssistantAvatar}
          </motion.div>
          {pendingUserMessageCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex size-6 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
              {pendingUserMessageCount > 9 ? "9+" : pendingUserMessageCount}
            </span>
          )}
        </motion.button>
      </div>
    );
  }

  if (mode === "compact") {
    return (
      <motion.div
        layoutId="viben-overlay-surface"
        transition={OVERLAY_TRANSITION}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        data-shared-surface="overlay"
        data-transition-role="panel-fade"
        onMouseLeave={() => {
          if (!hasCompactDraft) onModeChange("floating");
        }}
        className={`overlay-shared-surface flex ${OVERLAY_PANEL_WIDTH_CLASS} flex-col gap-2 rounded-3xl ${
          contained ? "absolute bottom-5 left-5 z-20" : "fixed bottom-5 left-5 z-50"
        }`}
        style={{ borderRadius: OVERLAY_RADIUS.compact }}
        data-testid="compact-overlay"
      >
        <AgentPopup
          avatar={dynamicAssistantAvatar}
          title={title}
          activity={compactActivity}
          isStreaming={isStreaming}
          showMinimize={hasCompactDraft}
          onExpand={() => onModeChange("expanded")}
          onMinimize={() => onModeChange("floating")}
        />
        <CompactChatInput
          variant="compact"
          value={content}
          isStreaming={isStreaming}
          onValueChange={setContent}
          onSend={handleSubmit}
          onCancel={onCancel}
          inputProps={inputProps}
        />
      </motion.div>
    );
  }

  return (
    <motion.div
      layoutId="viben-overlay-surface"
      transition={OVERLAY_TRANSITION}
      initial={false}
      data-transition-role="expand-to-full"
      className={`overlay-shared-surface pointer-events-auto flex min-h-0 ${EXPANDED_PANEL_HEIGHT_CLASS} ${OVERLAY_PANEL_WIDTH_CLASS} flex-col overflow-hidden rounded-2xl bg-background shadow-2xl ${
        contained ? "absolute bottom-5 left-5 z-20" : "fixed bottom-5 left-5 z-50"
      }`}
      style={{ borderRadius: OVERLAY_RADIUS.expanded }}
      data-testid="expanded-overlay"
    >
      {expandedContent}
      {subagentSheetNode}
    </motion.div>
  );
}

export function ChatAppFullscreenPanel({
  messages,
  messageUpdates,
  isStreaming = false,
  pendingPlan,
  pendingApproval,
  pendingQuestion,
  commandQueueItems = [],
  commandQueuePaused = false,
  inputProps,
  messageListRef,
  assistantAvatar,
  welcomeTitle,
  welcomeDescription,
  maxMessageWidth = "760px",
  onExpandSubagent,
  onApprovePlan,
  onRejectPlan,
  onApprovalDecision,
  onAnswerQuestions,
  onCommandQueueRemove,
  onCommandQueueClear,
  onCommandQueuePause,
  onCommandQueueResume,
}: ChatAppFullscreenPanelProps) {
  const { t } = useTranslation();
  const noop = React.useCallback(() => {}, []);
  const noopRemove = React.useCallback((_id: string) => {}, []);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <motion.div
        layoutId="viben-overlay-message-panel"
        transition={INTERNAL_LAYOUT_TRANSITION}
        className="flex min-h-0 flex-1 flex-col overflow-hidden"
        data-shared-element="overlay-message-panel"
        data-testid="fullscreen-message-panel"
      >
        <ChatAppMessagePanel
          messageListRef={messageListRef}
          messages={messages}
          messageUpdates={messageUpdates}
          isStreaming={isStreaming}
          pendingPlan={pendingPlan}
          pendingApproval={pendingApproval}
          pendingQuestion={pendingQuestion}
          assistantAvatar={assistantAvatar}
          welcomeTitle={welcomeTitle ?? t("chat_app.fullscreen.welcome_title", "@viben/chat Session Player")}
          welcomeDescription={welcomeDescription ?? t("chat_app.fullscreen.welcome_description", "Press Play to replay the demo session, or load a .jsonl file.")}
          maxMessageWidth={maxMessageWidth}
          onExpandSubagent={onExpandSubagent}
          onApprovePlan={onApprovePlan}
          onRejectPlan={onRejectPlan}
          onApprovalDecision={onApprovalDecision}
          onAnswerQuestions={onAnswerQuestions}
        />
        {commandQueueItems.length > 0 && (
          <div className="w-full px-4 pb-2">
            <div className="mb-1.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <div className="size-1.5 animate-pulse rounded-full bg-amber-500" />
              <span>{t("chat_app.queue.will_send_when_finished", "Will send when agent finishes...")}</span>
            </div>
            <CommandQueuePanel
              items={commandQueueItems}
              isPaused={commandQueuePaused}
              onRemove={onCommandQueueRemove ?? noopRemove}
              onClear={onCommandQueueClear ?? noop}
              onPause={onCommandQueuePause ?? noop}
              onResume={onCommandQueueResume ?? noop}
            />
          </div>
        )}
      </motion.div>

      <motion.div
        layoutId="viben-overlay-input-panel"
        transition={INTERNAL_LAYOUT_TRANSITION}
        className="w-full border-t border-border"
        data-shared-element="overlay-input-panel"
        data-testid="fullscreen-chat-input-shell"
      >
        <div className="w-full" data-testid="fullscreen-chat-input-container">
          <AnimatePresence mode="wait">
            {pendingPlan ? (
              <PlanApproval
                key="plan"
                plan={pendingPlan}
                isPending
                onApprove={onApprovePlan}
                onReject={onRejectPlan}
              />
            ) : pendingApproval ? (
              <ExecApproval
                key="approval"
                approval={pendingApproval}
                onDecision={(decision, feedback) => onApprovalDecision?.(decision, feedback)}
                enableKeyboard
              />
            ) : pendingQuestion ? (
              <QuestionInput
                key="question"
                questions={pendingQuestion}
                onSubmit={(answers) => onAnswerQuestions?.(answers)}
              />
            ) : (
              <motion.div
                key="input"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
              >
                <ChatInput
                  {...getExpandedChatInputProps(inputProps)}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}

function AgentPopup({
  avatar,
  title,
  activity,
  isStreaming,
  showMinimize,
  onExpand,
  onMinimize,
}: {
  avatar: React.ReactNode;
  title: string;
  activity: CompactActivitySummary;
  isStreaming: boolean;
  showMinimize: boolean;
  onExpand: () => void;
  onMinimize: () => void;
}) {
  const { t } = useTranslation();
  return (
    <motion.section
      data-testid="agent-popup"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className="overflow-hidden rounded-xl border border-border bg-popover shadow-2xl"
      onClick={onExpand}
    >
      <div className="flex items-start gap-3 p-3">
        <motion.div
          className="size-14 shrink-0"
          data-testid="agent-popup-avatar"
          data-shared-element="overlay-avatar"
          data-transition-role="avatar-fade"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={OVERLAY_AVATAR_TRANSITION}
        >
          {avatar}
        </motion.div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-foreground" data-testid="agent-popup-title">
                {title}
              </span>
            </div>
            {showMinimize && (
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  aria-label={t("chat_app.overlay.minimize", "Minimize chat")}
                  onClick={(event) => {
                    event.stopPropagation();
                    onMinimize();
                  }}
                  className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Minimize2 className="size-3.5" />
                </button>
              </div>
            )}
          </div>
          {activity.kind === "thinking" ? (
            <div
              className="mt-2 overflow-hidden truncate whitespace-nowrap text-sm leading-6 text-foreground/85"
              data-testid="agent-popup-summary"
            >
              <Streamdown mode={isStreaming ? "streaming" : "static"} caret={isStreaming ? "block" : undefined}>
                {activity.text}
              </Streamdown>
            </div>
          ) : (
            <p className="mt-2 overflow-hidden truncate whitespace-nowrap text-sm leading-6 text-foreground/85" data-testid="agent-popup-summary">
              {activity.text}
              {isStreaming && <span className="ml-1 inline-block h-4 w-0.5 translate-y-0.5 animate-pulse bg-primary" />}
            </p>
          )}
        </div>
      </div>
    </motion.section>
  );
}

function ChatAppMessagePanel({
  messages,
  messageUpdates,
  isStreaming,
  pendingPlan,
  pendingApproval,
  pendingQuestion,
  messageListRef,
  assistantAvatar,
  welcomeTitle,
  welcomeDescription,
  maxMessageWidth = "760px",
  onExpandSubagent,
  onApprovePlan,
  onRejectPlan,
  onApprovalDecision,
  onAnswerQuestions,
}: {
  messages: AgentMessage[];
  messageUpdates?: Record<string, Partial<AgentMessage>>;
  isStreaming: boolean;
  pendingPlan?: TaskPlan | null;
  pendingApproval?: PendingExecApproval | null;
  pendingQuestion?: PendingQuestion | null;
  messageListRef?: React.ComponentPropsWithRef<typeof MessageList>["ref"];
  assistantAvatar?: React.ReactNode;
  welcomeTitle?: string;
  welcomeDescription?: string;
  maxMessageWidth?: string;
  onExpandSubagent?: ExpandSubagentHandler;
  onApprovePlan?: () => void;
  onRejectPlan?: () => void;
  onApprovalDecision?: (decision: string, feedback?: string) => void;
  onAnswerQuestions?: (answers: Record<string, string[]>) => void;
}) {
  const { t } = useTranslation();
  const handleBackgroundTaskClick = React.useCallback((task: BackgroundTaskItem) => {
    onExpandSubagent?.(
      task.description,
      task.kind,
      task.messages ?? [],
      {
        subagentId: task.sourceMessage?.subagentId,
        toolUseId: task.sourceMessage?.toolUseId ?? task.id,
        parentMessage: task.sourceMessage,
        messages: task.messages,
      }
    );
  }, [onExpandSubagent]);

  return (
    <>
      <MessageList
        ref={messageListRef}
        messages={messages}
        messageUpdates={messageUpdates}
        isStreaming={isStreaming}
        assistantAvatar={assistantAvatar}
        pendingPlan={pendingPlan}
        pendingApproval={pendingApproval}
        pendingQuestions={pendingQuestion}
        welcomeTitle={welcomeTitle ?? t("chat_app.fullscreen.welcome_title", "@viben/chat Session Player")}
        welcomeDescription={welcomeDescription ?? t("chat_app.fullscreen.welcome_description", "Press Play to replay the demo session, or load a .jsonl file.")}
        maxMessageWidth={maxMessageWidth}
        onExpandSubagent={onExpandSubagent}
        onApprovePlan={onApprovePlan}
        onRejectPlan={onRejectPlan}
        onApprovalDecision={onApprovalDecision}
        onAnswerQuestions={onAnswerQuestions}
      />
      <div className="space-y-2 px-4 pb-2">
        <TodoListPanel messages={messages} compact />
        <BackgroundTaskList messages={messages} onTaskClick={handleBackgroundTaskClick} />
      </div>
    </>
  );
}

function getCompactActivitySummary(messages: AgentMessage[], t: Translate, idleGreeting: string): CompactActivitySummary {
  const latest = [...messages].reverse().find((message) =>
    (message.type === "text" || message.type === "thinking" || message.type === "tool_use" || message.type === "error") &&
    (message.content || message.message || message.name)
  );
  if (!latest) return { kind: "plain", text: idleGreeting };
  if (latest.type === "thinking") return { kind: "thinking", text: latest.content || t("chat_app.activity.thinking", "Thinking...") };
  if (latest.type === "tool_use") return { kind: "plain", text: getToolActivityText(latest, t) };
  if (latest.type === "error") return { kind: "plain", text: latest.message || latest.content || t("chat_app.activity.needs_attention", "Something needs attention.") };
  return { kind: "plain", text: latest.content || latest.message || t("chat_app.activity.working", "Working...") };
}

function getToolActivityText(message: AgentMessage, t: Translate): string {
  const input = message.input;
  switch (message.name) {
    case "Bash": {
      const command = input?.command ? truncateText(String(input.command).trim(), 72) : "";
      return command
        ? t("chat_app.activity.running_command_named", "Running {{command}}", { command })
        : t("chat_app.activity.running_command", "Running command...");
    }
    case "Read": {
      return t("chat_app.activity.reading_file", "Reading {{file}}...", { file: getToolPath(input?.file_path, "file") });
    }
    case "Write": {
      return t("chat_app.activity.writing_file", "Writing {{file}}...", { file: getToolPath(input?.file_path, "file") });
    }
    case "Edit":
    case "MultiEdit": {
      return t("chat_app.activity.editing_file", "Editing {{file}}...", { file: getToolPath(input?.file_path, "file") });
    }
    case "Grep": {
      const pattern = input?.pattern ? truncateText(String(input.pattern), 48) : "";
      return pattern
        ? chatAppTranslate(t, "chat_app.activity.searching_for", "Searching for \"{{pattern}}\"...", { pattern })
        : t("chat_app.activity.searching_workspace", "Searching workspace...");
    }
    case "Glob": {
      const pattern = input?.pattern ? truncateText(String(input.pattern), 48) : "";
      return pattern
        ? t("chat_app.activity.finding", "Finding {{pattern}}...", { pattern })
        : t("chat_app.activity.finding_files", "Finding files...");
    }
    case "WebSearch":
      return t("chat_app.activity.searching_web", "Searching the web...");
    case "WebFetch":
      return t("chat_app.activity.fetching_page", "Fetching page content...");
    case "Task":
    case "Agent":
      return t("chat_app.activity.running_agent_task", "Running a delegated agent task...");
    default:
      return message.name
        ? t("chat_app.activity.running_tool", "Running {{name}}...", { name: message.name })
        : t("chat_app.activity.working", "Working...");
  }
}

function getToolPath(value: unknown, fallback: string): string {
  if (!value) return fallback;
  const raw = String(value);
  const packageIndex = raw.indexOf("packages/");
  return packageIndex >= 0 ? raw.slice(packageIndex) : raw.split("/").filter(Boolean).slice(-3).join("/") || fallback;
}

function truncateText(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength - 3)}...` : value;
}

function ExpandedHeader({
  title,
  sessions,
  agents,
  assistantAvatar,
  headerActions,
  onCreateSession,
  onSettingsClick,
  mode,
  onModeChange,
}: {
  title: string;
  sessions: OverlaySessionItem[];
  agents: OverlayAgentItem[];
  assistantAvatar: React.ReactNode;
  headerActions?: OverlayHeaderActions;
  onCreateSession?: () => void;
  onSettingsClick?: () => void;
  mode: ChatAppMode;
  onModeChange: (mode: ChatAppMode) => void;
}) {
  const { t } = useTranslation();
  const [sessionOpen, setSessionOpen] = React.useState(false);
  const [newOpen, setNewOpen] = React.useState(false);
  const [moreOpen, setMoreOpen] = React.useState(false);
  const [selectedSessionTitle, setSelectedSessionTitle] = React.useState(title);

  React.useEffect(() => {
    setSelectedSessionTitle(title);
  }, [title]);

  return (
    <header
      data-testid="expanded-header"
      className="relative flex h-12 shrink-0 items-center gap-1.5 border-b border-border bg-card px-3"
    >
      <div className="relative" data-testid="session-title-menu">
        <button
          type="button"
          aria-label={t("chat_app.header.session_menu", "Session menu")}
          onClick={() => setSessionOpen((open) => !open)}
          className="flex h-8 max-w-[164px] items-center gap-1.5 rounded-md px-2 text-sm font-medium text-foreground hover:bg-accent"
        >
          <span className="truncate">{selectedSessionTitle}</span>
          {sessionOpen ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
        </button>
        {sessionOpen && (
          <div className="absolute left-0 top-10 z-20 w-72 rounded-lg border border-border bg-popover p-2 shadow-xl">
            <label className="flex h-9 items-center gap-2 rounded-md border border-border/70 bg-background px-2">
              <Search className="size-4 text-muted-foreground" />
              <input
                type="search"
                aria-label={t("chat_app.header.search_sessions", "Search sessions")}
                placeholder={t("chat_app.header.search_sessions", "Search sessions")}
                className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </label>
            <div className="mt-2 space-y-1">
              {sessions.map((session) => (
                <button
                  key={session.id}
                  type="button"
                  onClick={() => {
                    setSelectedSessionTitle(session.title);
                    headerActions?.onSelectSession?.(session);
                    setSessionOpen(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left hover:bg-accent"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary">
                    {session.avatar ?? assistantAvatar}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">{session.title}</span>
                    {session.subtitle && <span className="block truncate text-[11px] text-muted-foreground">{session.subtitle}</span>}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div
        className="relative flex h-8 shrink-0 overflow-hidden rounded-md border border-border bg-background"
        data-testid="new-session-split-button"
      >
        <button
          type="button"
          aria-label={t("chat_app.header.create_session", "Create new session")}
          onClick={onCreateSession}
          className="flex w-8 items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <Plus className="size-4" />
        </button>
        <div className="h-full border-l border-border" />
        <button
          type="button"
          aria-label={t("chat_app.header.open_new_session_menu", "Open new session menu")}
          onClick={() => setNewOpen((open) => !open)}
          className="flex w-8 items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <ChevronDown className="size-4" data-testid="new-session-menu-chevron" />
        </button>
        {newOpen && (
          <div className="absolute right-0 top-10 z-20 w-72 rounded-lg border border-border bg-popover p-1.5 shadow-xl">
            <MenuButton onClick={headerActions?.onNewChat}>{t("chat_app.header.new_chat", "New chat")}</MenuButton>
            <MenuButton onClick={headerActions?.onNewChatWindow}>{t("chat_app.header.new_chat_window", "New chat window")}</MenuButton>
            <MenuDivider />
            {agents.map((agent) => (
              <MenuButton key={agent.id} onClick={() => headerActions?.onSelectAgent?.(agent)}>
                <span className="flex items-center gap-2">
                  <span className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary">
                    {agent.avatar ?? <Bot className="size-4" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate">{agent.name}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">{agent.type}</span>
                  </span>
                </span>
              </MenuButton>
            ))}
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1 cursor-move" data-testid="expanded-header-drag-area" />

      <button
        type="button"
        aria-label={t("chat_app.header.switch_compact", "Switch to compact mode")}
        onClick={() => onModeChange("compact")}
        data-testid="compact-mode-button"
        className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <Minimize2 className="size-4" />
      </button>

      {mode !== "full" && (
        <button
          type="button"
          aria-label={t("chat_app.header.switch_fullscreen", "Switch to fullscreen mode")}
          onClick={() => onModeChange("full")}
          data-testid="full-mode-button"
          className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <Maximize2 className="size-4" />
        </button>
      )}

      <button
        type="button"
        aria-label={t("chat_app.header.settings", "Settings")}
        onClick={onSettingsClick}
        data-testid="settings-button"
        className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <Settings className="size-4" />
      </button>

      <div className="relative" data-testid="more-actions-menu">
        <button
          type="button"
          aria-label={t("chat_app.header.more_actions", "More actions")}
          onClick={() => setMoreOpen((open) => !open)}
          className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <MoreHorizontal className="size-4" />
        </button>
        {moreOpen && (
          <div className="absolute right-0 top-10 z-20 w-56 rounded-lg border border-border bg-popover p-1.5 shadow-xl">
            <MenuButton onClick={headerActions?.onPrevious}>{t("chat_app.header.previous_step", "Previous step")}</MenuButton>
            <MenuButton onClick={headerActions?.onNext}>{t("chat_app.header.next_step", "Next step")}</MenuButton>
            <MenuDivider />
            <MenuButton onClick={headerActions?.onMoveToWindow}>{t("chat_app.header.move_to_window", "Move chat to new window")}</MenuButton>
            <MenuDivider />
            <MenuButton onClick={headerActions?.onShowDebugView}>{t("chat_app.header.show_debug_view", "Show debug view")}</MenuButton>
            <MenuButton onClick={headerActions?.onShowDebugLog}>{t("chat_app.header.show_debug_log", "Show debug log")}</MenuButton>
          </div>
        )}
      </div>
    </header>
  );
}

function MenuButton({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center rounded-md px-2.5 py-2 text-left text-sm text-foreground hover:bg-accent"
    >
      {children}
    </button>
  );
}

function MenuDivider() {
  return <div className="my-1 border-t border-border/70" />;
}

function CompactChatInput({
  variant,
  value,
  isStreaming,
  onValueChange,
  onSend,
  onCancel,
  inputProps,
}: {
  variant: "compact" | "expanded";
  value: string;
  isStreaming: boolean;
  onValueChange: (value: string) => void;
  onSend: () => void;
  onCancel: () => void;
  inputProps?: Partial<ChatInputProps>;
}) {
  const { t } = useTranslation();
  const shellClassName = variant === "compact"
    ? `overlay-input-shell overflow-hidden rounded-xl border border-border bg-background shadow-2xl ${isStreaming ? "overlay-input-shell--running" : ""}`
    : `overlay-input-shell w-full bg-transparent ${isStreaming ? "overlay-input-shell--running" : ""}`;

  return (
    <section
      data-testid="compact-chat-input"
      data-variant={variant}
      className={shellClassName}
    >
      <ChatInput
        {...(variant === "expanded" ? getExpandedChatInputProps(inputProps) : inputProps)}
        value={value}
        onValueChange={onValueChange}
        onSend={(content, attachments) => {
          if (inputProps?.onSend) {
            inputProps.onSend(content, attachments);
            return;
          }
          onSend();
        }}
        onCancel={inputProps?.onCancel ?? onCancel}
        isLoading={isStreaming}
        allowSendWhileLoading
        placeholder={inputProps?.placeholder ?? (
          isStreaming
            ? t("chat_app.input.placeholder.queue", "Queue a message...")
            : t("chat_app.input.placeholder.default", "Ask Viben...")
        )}
        layoutVariant={variant === "expanded" ? (inputProps?.layoutVariant ?? "expanded") : "compact"}
        showTopToolbar={variant === "expanded" ? (inputProps?.showTopToolbar ?? true) : false}
        showConfigBar={variant === "expanded" ? (inputProps?.showConfigBar ?? true) : true}
        renderEmojiPicker={inputProps?.renderEmojiPicker ?? ((props) => <EmojiPicker {...props} />)}
        renderBottomToolbar={variant === "compact" ? (({ editor, submitControl }) => (
          <>
            {editor}
            {submitControl}
          </>
        )) : inputProps?.renderBottomToolbar}
        defaultHeight={variant === "compact" ? 48 : inputProps?.defaultHeight}
        minHeight={variant === "compact" ? 48 : inputProps?.minHeight}
        maxHeight={variant === "compact" ? 48 : inputProps?.maxHeight}
        showResizeHandle={false}
        enableWritingMode={variant === "expanded"}
        hideAgentSelector={variant === "compact" ? true : inputProps?.hideAgentSelector}
        hideModelSelector={variant === "compact" ? true : inputProps?.hideModelSelector}
        hideExecutorSelector={variant === "compact" ? true : inputProps?.hideExecutorSelector}
        className={`bg-background ${inputProps?.className ?? ""}`}
      />
    </section>
  );
}

function getExpandedChatInputProps(inputProps: ChatInputProps): ChatInputProps;
function getExpandedChatInputProps(inputProps?: Partial<ChatInputProps>): Partial<ChatInputProps>;
function getExpandedChatInputProps(inputProps?: Partial<ChatInputProps>): Partial<ChatInputProps> {
  return {
    ...inputProps,
    layoutVariant: inputProps?.layoutVariant ?? "expanded",
    showTopToolbar: inputProps?.showTopToolbar ?? true,
    showConfigBar: inputProps?.showConfigBar ?? true,
    renderEmojiPicker: inputProps?.renderEmojiPicker ?? ((props) => <EmojiPicker {...props} />),
  };
}
