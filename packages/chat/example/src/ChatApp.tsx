import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bot, ChevronDown, ChevronUp, Maximize2, Minimize2, MoreHorizontal, Plus, Search, Settings } from "lucide-react";
import { Streamdown } from "streamdown";
import { ChatInput, CommandQueuePanel, EmojiPicker, ExecApproval, MessageList, PlanApproval, QuestionInput, SubagentSheet } from "@viben/chat";
import type {
  AgentMessage,
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

export type OverlayMode = "floating" | "compact" | "expanded" | "full";
export type ChatAppMode = OverlayMode;
export type AssistantPetState = "idle" | "waiting" | "review" | "waving" | "failed";
export type SessionPlayerStatus = "idle" | "playing" | "paused";
export type PetInteractionState = "idle" | "hover" | "drag-right" | "drag-left" | "drag-up" | "drag-down" | "waiting";
export type AssistantPetAvatarMap = Partial<Record<AssistantPetState, React.ReactNode>>;

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
  mode: OverlayMode;
  messages: AgentMessage[];
  messageUpdates?: Record<string, Partial<AgentMessage>>;
  isStreaming: boolean;
  contained?: boolean;
  title?: string;
  playerStatus?: SessionPlayerStatus;
  pendingUserMessageCount?: number;
  assistantAvatars?: AssistantPetAvatarMap;
  sessions?: OverlaySessionItem[];
  agents?: OverlayAgentItem[];
  headerActions?: OverlayHeaderActions;
  inputValue?: string;
  onInputValueChange?: (value: string) => void;
  inputProps?: Partial<ChatInputProps>;
  fullscreenContent?: React.ReactNode;
  messageListRef?: React.ComponentPropsWithRef<typeof MessageList>["ref"];
  onExpandSubagent?: ExpandSubagentHandler;
  subagentSheet?: ChatAppSubagentSheetState;
  loadSubagentDetails?: LoadSubagentDetails;
  onModeChange: (mode: OverlayMode) => void;
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

const DEFAULT_SESSIONS: OverlaySessionItem[] = [
  {
    id: "2c88f85a-690d-49ca-95f4-c3aa71da1da8",
    title: "Claude Code: breadcrumb navigation debug",
    subtitle: "2c88f85a...jsonl",
  },
  {
    id: "2e83fc8b-a852-4530-a5f3-497bcafa9da6",
    title: "Claude Code: 2e83fc8b session replay",
    subtitle: "2e83fc8b...jsonl",
  },
  {
    id: "3bbcc4d2-0267-4938-98c3-c06a380828ba",
    title: "Claude Code: 3bbcc4d2 session replay",
    subtitle: "3bbcc4d2...jsonl",
  },
];

const DEFAULT_AGENTS: OverlayAgentItem[] = [
  { id: "claude-code", name: "Claude Code", type: "agent & executor" },
  { id: "openai-browser", name: "OpenAI · Browser", type: "agent & executor" },
];

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

const OVERLAY_RADIUS = {
  floating: 999,
  compact: 24,
  expanded: 16,
  full: 0,
} as const;

const OVERLAY_PANEL_WIDTH_CLASS = "w-[min(440px,calc(100dvw_-_2rem))]";
const FULLSCREEN_PANEL_WIDTH_CLASS = "w-[calc(100dvw_-_280px)]";
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
  assistantAvatars,
  sessions = DEFAULT_SESSIONS,
  agents = DEFAULT_AGENTS,
  headerActions,
  inputValue,
  onInputValueChange,
  inputProps,
  fullscreenContent,
  messageListRef,
  onExpandSubagent,
  subagentSheet,
  loadSubagentDetails,
  onModeChange,
  onSend,
  onCancel,
}: ChatAppProps) {
  const petState = getAssistantPetState(messages, isStreaming, playerStatus);
  const petInteraction = getPetInteractionForSessionStatus(playerStatus, isStreaming, pendingUserMessageCount > 0);
  const assistantAvatar = assistantAvatars?.[petState] ?? <VibenPetAvatar state={petState} interaction={petInteraction} />;
  const [uncontrolledInput, setUncontrolledInput] = React.useState("");
  const content = inputValue ?? uncontrolledInput;
  const setContent = React.useCallback((value: string) => {
    if (inputValue === undefined) setUncontrolledInput(value);
    onInputValueChange?.(value);
  }, [inputValue, onInputValueChange]);

  const compactActivity = React.useMemo(() => getCompactActivitySummary(messages), [messages]);

  const handleSubmit = React.useCallback(() => {
    const trimmed = content.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setContent("");
  }, [content, onSend, setContent]);

  const defaultExpandedBody = (
    <>
      <div className="min-h-0 flex-1 overflow-hidden border-y border-border/70">
        <ChatAppMessagePanel
          messageListRef={messageListRef}
          messages={messages}
          messageUpdates={messageUpdates}
          isStreaming={isStreaming}
          maxMessageWidth="100%"
          onExpandSubagent={onExpandSubagent}
        />
      </div>
      <div className="w-full shrink-0 border-t border-border" data-testid="expanded-chat-input-container">
        <CompactChatInput
          variant="expanded"
          value={content}
          isStreaming={isStreaming}
          onValueChange={setContent}
          onSend={handleSubmit}
          onCancel={onCancel}
          inputProps={getExpandedChatInputProps(inputProps)}
        />
      </div>
    </>
  );

  const expandedContent = (
    <>
      <ExpandedHeader
        title={title}
        sessions={sessions}
        agents={agents}
        assistantAvatar={assistantAvatar}
        headerActions={headerActions}
        onCreateSession={headerActions?.onCreateSession}
        onSettingsClick={headerActions?.onSettingsClick}
        mode={mode}
        onModeChange={onModeChange}
      />
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
      className="w-[min(420px,85%)]"
    />
  ) : null;

  if (mode === "full") {
    return (
      <motion.div
        layoutId="viben-overlay-surface"
        transition={OVERLAY_TRANSITION}
        initial={false}
        data-transition-role="expand-to-full"
        className={`overlay-shared-surface relative flex min-h-0 ${FULLSCREEN_PANEL_WIDTH_CLASS} flex-col overflow-hidden bg-background shadow-none ${
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
          aria-label="Open compact chat"
          onClick={() => onModeChange("compact")}
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
            {assistantAvatar}
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
        className={`overlay-shared-surface flex ${OVERLAY_PANEL_WIDTH_CLASS} flex-col gap-2 rounded-3xl ${
          contained ? "absolute bottom-5 left-5 z-20" : "fixed bottom-5 left-5 z-50"
        }`}
        style={{ borderRadius: OVERLAY_RADIUS.compact }}
        data-testid="compact-overlay"
      >
        <AgentPopup
          avatar={assistantAvatar}
          petState={petState}
          activity={compactActivity}
          isStreaming={isStreaming}
          onExpand={() => onModeChange("expanded")}
          onMinimize={() => onModeChange("floating")}
          onFullScreen={() => onModeChange("full")}
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
      className={`overlay-shared-surface relative flex min-h-0 ${EXPANDED_PANEL_HEIGHT_CLASS} ${OVERLAY_PANEL_WIDTH_CLASS} flex-col overflow-hidden rounded-2xl bg-background shadow-2xl ${
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
  welcomeTitle = "@viben/chat Session Player",
  welcomeDescription = "Press Play to replay the demo session, or load a .jsonl file.",
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
  const noop = React.useCallback(() => {}, []);
  const noopRemove = React.useCallback((_id: string) => {}, []);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col">
        <ChatAppMessagePanel
          messageListRef={messageListRef}
          messages={messages}
          messageUpdates={messageUpdates}
          isStreaming={isStreaming}
          pendingPlan={pendingPlan}
          pendingApproval={pendingApproval}
          pendingQuestion={pendingQuestion}
          welcomeTitle={welcomeTitle}
          welcomeDescription={welcomeDescription}
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
              <span>Will send when agent finishes...</span>
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
      </div>

      <div className="w-full border-t border-border" data-testid="fullscreen-chat-input-shell">
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
      </div>
    </div>
  );
}

function AgentPopup({
  avatar,
  petState,
  activity,
  isStreaming,
  onExpand,
  onMinimize,
  onFullScreen,
}: {
  avatar: React.ReactNode;
  petState: AssistantPetState;
  activity: CompactActivitySummary;
  isStreaming: boolean;
  onExpand: () => void;
  onMinimize: () => void;
  onFullScreen: () => void;
}) {
  return (
    <motion.section
      data-testid="agent-popup"
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
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
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate text-sm font-medium text-foreground">Viben Sprite</span>
              <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                {petState}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                aria-label="Minimize chat"
                onClick={(event) => {
                  event.stopPropagation();
                  onMinimize();
                }}
                className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Minimize2 className="size-3.5" />
              </button>
              <button
                type="button"
                aria-label="Open fullscreen chat"
                onClick={(event) => {
                  event.stopPropagation();
                  onFullScreen();
                }}
                className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Maximize2 className="size-3.5" />
              </button>
            </div>
          </div>
          {activity.kind === "thinking" ? (
            <div
              className="mt-2 max-h-24 overflow-hidden text-sm leading-6 text-foreground/85"
              data-testid="agent-popup-thinking-stream"
            >
              <Streamdown mode={isStreaming ? "streaming" : "static"} caret={isStreaming ? "block" : undefined}>
                {activity.text}
              </Streamdown>
            </div>
          ) : (
            <p className="mt-2 max-h-24 overflow-hidden text-sm leading-6 text-foreground/85" data-testid="agent-popup-description">
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
  welcomeTitle = "@viben/chat Session Player",
  welcomeDescription = "Press Play to replay the demo session, or load a .jsonl file.",
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
  welcomeTitle?: string;
  welcomeDescription?: string;
  maxMessageWidth?: string;
  onExpandSubagent?: ExpandSubagentHandler;
  onApprovePlan?: () => void;
  onRejectPlan?: () => void;
  onApprovalDecision?: (decision: string, feedback?: string) => void;
  onAnswerQuestions?: (answers: Record<string, string[]>) => void;
}) {
  return (
    <MessageList
      ref={messageListRef}
      messages={messages}
      messageUpdates={messageUpdates}
      isStreaming={isStreaming}
      pendingPlan={pendingPlan}
      pendingApproval={pendingApproval}
      pendingQuestions={pendingQuestion}
      welcomeTitle={welcomeTitle}
      welcomeDescription={welcomeDescription}
      maxMessageWidth={maxMessageWidth}
      onExpandSubagent={onExpandSubagent}
      onApprovePlan={onApprovePlan}
      onRejectPlan={onRejectPlan}
      onApprovalDecision={onApprovalDecision}
      onAnswerQuestions={onAnswerQuestions}
    />
  );
}

function getCompactActivitySummary(messages: AgentMessage[]): CompactActivitySummary {
  const latest = [...messages].reverse().find((message) =>
    (message.type === "text" || message.type === "thinking" || message.type === "tool_use" || message.type === "error") &&
    (message.content || message.message || message.name)
  );
  if (!latest) return { kind: "plain", text: "Ready when you are." };
  if (latest.type === "thinking") return { kind: "thinking", text: latest.content || "Thinking..." };
  if (latest.type === "tool_use") return { kind: "plain", text: getToolActivityText(latest) };
  if (latest.type === "error") return { kind: "plain", text: latest.message || latest.content || "Something needs attention." };
  return { kind: "plain", text: latest.content || latest.message || "Working..." };
}

function getToolActivityText(message: AgentMessage): string {
  const input = message.input;
  switch (message.name) {
    case "Bash": {
      const command = input?.command ? truncateText(String(input.command).trim(), 72) : "";
      return command ? `Running ${command}` : "Running command...";
    }
    case "Read": {
      return `Reading ${getToolPath(input?.file_path, "file")}...`;
    }
    case "Write": {
      return `Writing ${getToolPath(input?.file_path, "file")}...`;
    }
    case "Edit":
    case "MultiEdit": {
      return `Editing ${getToolPath(input?.file_path, "file")}...`;
    }
    case "Grep": {
      const pattern = input?.pattern ? truncateText(String(input.pattern), 48) : "";
      return pattern ? `Searching for "${pattern}"...` : "Searching workspace...";
    }
    case "Glob": {
      const pattern = input?.pattern ? truncateText(String(input.pattern), 48) : "";
      return pattern ? `Finding ${pattern}...` : "Finding files...";
    }
    case "WebSearch":
      return "Searching the web...";
    case "WebFetch":
      return "Fetching page content...";
    case "Task":
    case "Agent":
      return "Running a delegated agent task...";
    default:
      return message.name ? `Running ${message.name}...` : "Working...";
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
  mode: OverlayMode;
  onModeChange: (mode: OverlayMode) => void;
}) {
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
          aria-label="Session menu"
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
                aria-label="Search sessions"
                placeholder="Search sessions"
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
          aria-label="Create new session"
          onClick={onCreateSession}
          className="flex w-8 items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <Plus className="size-4" />
        </button>
        <div className="h-full border-l border-border" />
        <button
          type="button"
          aria-label="Open new session menu"
          onClick={() => setNewOpen((open) => !open)}
          className="flex w-8 items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <ChevronDown className="size-4" data-testid="new-session-menu-chevron" />
        </button>
        {newOpen && (
          <div className="absolute right-0 top-10 z-20 w-72 rounded-lg border border-border bg-popover p-1.5 shadow-xl">
            <MenuButton onClick={headerActions?.onNewChat}>新建聊天</MenuButton>
            <MenuButton onClick={headerActions?.onNewChatWindow}>新建聊天窗口</MenuButton>
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
        aria-label="Switch to compact mode"
        onClick={() => onModeChange("compact")}
        data-testid="compact-mode-button"
        className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <Minimize2 className="size-4" />
      </button>

      {mode !== "full" && (
        <button
          type="button"
          aria-label="Switch to fullscreen mode"
          onClick={() => onModeChange("full")}
          data-testid="full-mode-button"
          className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <Maximize2 className="size-4" />
        </button>
      )}

      <button
        type="button"
        aria-label="Settings"
        onClick={onSettingsClick}
        data-testid="settings-button"
        className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <Settings className="size-4" />
      </button>

      <div className="relative" data-testid="more-actions-menu">
        <button
          type="button"
          aria-label="More actions"
          onClick={() => setMoreOpen((open) => !open)}
          className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <MoreHorizontal className="size-4" />
        </button>
        {moreOpen && (
          <div className="absolute right-0 top-10 z-20 w-56 rounded-lg border border-border bg-popover p-1.5 shadow-xl">
            <MenuButton onClick={headerActions?.onPrevious}>上一步</MenuButton>
            <MenuButton onClick={headerActions?.onNext}>下一步</MenuButton>
            <MenuDivider />
            <MenuButton onClick={headerActions?.onMoveToWindow}>将聊天移动到新窗口</MenuButton>
            <MenuDivider />
            <MenuButton onClick={headerActions?.onShowDebugView}>显示调试视图</MenuButton>
            <MenuButton onClick={headerActions?.onShowDebugLog}>显示调试日志</MenuButton>
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
        placeholder={inputProps?.placeholder ?? (isStreaming ? "Queue a message..." : "Ask Viben...")}
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

const PET_STATE_META: Record<AssistantPetState, {
  label: string;
  halo: string;
  eye: string;
  mouth: string;
  statusFill: string;
}> = {
  idle: {
    label: "Idle",
    halo: "oklch(0.78 0.13 188)",
    eye: "M27 42 Q31 39 35 42",
    mouth: "M31 55 Q40 59 49 55",
    statusFill: "oklch(0.78 0.13 188)",
  },
  waiting: {
    label: "Waiting",
    halo: "oklch(0.82 0.16 82)",
    eye: "M27 41 H35",
    mouth: "M32 56 Q40 54 48 56",
    statusFill: "oklch(0.82 0.16 82)",
  },
  review: {
    label: "Review",
    halo: "oklch(0.75 0.15 172)",
    eye: "M27 42 Q31 39 35 42",
    mouth: "M31 55 Q40 52 49 55",
    statusFill: "oklch(0.75 0.15 172)",
  },
  waving: {
    label: "Waving",
    halo: "oklch(0.78 0.15 132)",
    eye: "M27 41 Q31 44 35 41",
    mouth: "M31 54 Q40 61 49 54",
    statusFill: "oklch(0.78 0.15 132)",
  },
  failed: {
    label: "Failed",
    halo: "oklch(0.66 0.2 28)",
    eye: "M27 39 L35 45 M35 39 L27 45",
    mouth: "M31 58 Q40 53 49 58",
    statusFill: "oklch(0.66 0.2 28)",
  },
};

const PET_FLOAT_ANIMATION: Record<PetInteractionState, { y?: number[]; rotate?: number[]; x?: number[]; scale?: number[] }> = {
  idle: { y: [0, -1.5, 0] },
  hover: { rotate: [-2, 2, -2] },
  "drag-right": { x: [0, 2, 0] },
  "drag-left": { x: [0, -2, 0] },
  "drag-up": { y: [0, -5, 0] },
  "drag-down": { y: [0, 3, 0] },
  waiting: { y: [0, -3, 0], scale: [1, 1.02, 1] },
};

function VibenPetAvatar({ state, interaction }: { state: AssistantPetState; interaction: PetInteractionState }) {
  const meta = PET_STATE_META[state];
  const gradientId = React.useId().replace(/:/g, "");
  const warmGradientId = `${gradientId}-warm`;
  const bodyGradientId = `${gradientId}-body`;
  const glowId = `${gradientId}-glow`;
  const movement = PET_FLOAT_ANIMATION[interaction];
  const shouldLoop = interaction !== "idle" || state === "review" || state === "waiting";

  return (
    <svg
      viewBox="0 0 80 80"
      role="img"
      aria-label={`Viben pet ${meta.label}`}
      className="size-full"
    >
      <defs>
        <linearGradient id={warmGradientId} x1="13" y1="13" x2="67" y2="67" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FDB813" />
          <stop offset="100%" stopColor="#38B2AC" />
        </linearGradient>
        <radialGradient id={bodyGradientId} cx="33%" cy="24%" r="68%">
          <stop offset="0%" stopColor="oklch(0.99 0.02 95)" />
          <stop offset="52%" stopColor="oklch(0.93 0.04 102)" />
          <stop offset="100%" stopColor="oklch(0.86 0.05 176)" />
        </radialGradient>
        <filter id={glowId} x="-24%" y="-24%" width="148%" height="148%">
          <feDropShadow dx="0" dy="7" stdDeviation="5" floodColor="#0f172a" floodOpacity="0.28" />
          <feDropShadow dx="0" dy="0" stdDeviation="2" floodColor="#38B2AC" floodOpacity="0.25" />
        </filter>
      </defs>
      <motion.g
        filter={`url(#${glowId})`}
        animate={movement}
        transition={{ duration: interaction === "waiting" ? 1.1 : 1.6, repeat: shouldLoop ? Infinity : 0, ease: "easeInOut" }}
        style={{ transformOrigin: "40px 43px" }}
      >
        <motion.path
          d="M18 31 L8 20 L24 24"
          fill="none"
          stroke="#FDB813"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
          animate={state === "waving" ? { rotate: [-7, 7, -7] } : undefined}
          transition={{ duration: 0.7, repeat: state === "waving" ? Infinity : 0 }}
          style={{ transformOrigin: "21px 28px" }}
        />
        <motion.path
          d="M62 31 L72 20 L56 24"
          fill="none"
          stroke="#38B2AC"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
          animate={state === "waving" ? { rotate: [7, -7, 7] } : undefined}
          transition={{ duration: 0.7, repeat: state === "waving" ? Infinity : 0 }}
          style={{ transformOrigin: "59px 28px" }}
        />
        <circle cx="40" cy="41" r="29" fill={`url(#${bodyGradientId})`} stroke={`url(#${warmGradientId})`} strokeWidth="3" />
        <path d="M28 25 L40 35 L52 25" fill="none" stroke={`url(#${warmGradientId})`} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" opacity="0.95" />
        <path d="M31 33 L40 55 L49 33" fill="none" stroke="oklch(0.22 0.04 220)" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M21 36 L12 43 L21 50" fill="none" stroke="#FDB813" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" opacity="0.96" />
        <path d="M59 36 L68 43 L59 50" fill="none" stroke="#38B2AC" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" opacity="0.96" />
        <path d={meta.eye} stroke="oklch(0.19 0.03 230)" strokeWidth="3" strokeLinecap="round" fill="none" />
        <path d={meta.eye.replace(/27/g, "45").replace(/35/g, "53")} stroke="oklch(0.19 0.03 230)" strokeWidth="3" strokeLinecap="round" fill="none" />
        <motion.path
          d={meta.mouth}
          stroke="oklch(0.19 0.03 230)"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
          animate={state === "review" ? { d: ["M31 55 Q40 52 49 55", "M31 55 Q40 58 49 55", "M31 55 Q40 52 49 55"] } : undefined}
          transition={{ duration: 0.7, repeat: state === "review" ? Infinity : 0 }}
        />
        <motion.circle
          cx="61"
          cy="20"
          r="5"
          fill={meta.statusFill}
          stroke="oklch(0.99 0.01 95)"
          strokeWidth="2"
          animate={state === "waiting" || state === "review" ? { scale: [0.85, 1.18, 0.85], opacity: [0.75, 1, 0.75] } : undefined}
          transition={{ duration: 0.9, repeat: state === "waiting" || state === "review" ? Infinity : 0 }}
        />
        {state === "failed" && (
          <path d="M23 64 H57" stroke="oklch(0.66 0.2 28)" strokeWidth="4" strokeLinecap="round" opacity="0.75" />
        )}
      </motion.g>
    </svg>
  );
}
