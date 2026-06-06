import * as React from "react";
import { motion } from "framer-motion";
import { Bot, ChevronDown, ChevronUp, Maximize2, Minimize2, MoreHorizontal, Plus, Search, Settings } from "lucide-react";
import { ChatInput } from "@viben/chat";
import type { AgentMessage, ChatInputProps, MessageAttachment } from "@viben/chat";

export type OverlayMode = "floating" | "compact" | "expanded" | "full";
export type AssistantPetState = "idle" | "thinking" | "speaking" | "done";
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

export interface OverlayDemoProps {
  mode: OverlayMode;
  messages: AgentMessage[];
  isStreaming: boolean;
  title?: string;
  playerStatus?: "idle" | "playing" | "paused";
  pendingUserMessageCount?: number;
  assistantAvatars?: AssistantPetAvatarMap;
  sessions?: OverlaySessionItem[];
  agents?: OverlayAgentItem[];
  headerActions?: OverlayHeaderActions;
  inputValue?: string;
  onInputValueChange?: (value: string) => void;
  inputProps?: Partial<ChatInputProps>;
  onModeChange: (mode: OverlayMode) => void;
  onSend: (content: string, attachments?: MessageAttachment[]) => void;
  onCancel: () => void;
  renderFullScreen?: () => React.ReactNode;
}

const DEFAULT_SESSIONS: OverlaySessionItem[] = [
  {
    id: "2c88f85a-690d-49ca-95f4-c3aa71da1da8",
    title: "Claude Code: breadcrumb navigation debug",
    subtitle: "2c88f85a...jsonl",
  },
];

const DEFAULT_AGENTS: OverlayAgentItem[] = [
  { id: "claude-code", name: "Claude Code", type: "agent & executor" },
  { id: "openai-browser", name: "OpenAI · Browser", type: "agent & executor" },
];

export function getAssistantPetState(
  messages: AgentMessage[],
  isStreaming: boolean,
  playerStatus: "idle" | "playing" | "paused" = "idle"
): AssistantPetState {
  if (messages.length === 0) return "idle";
  if (isStreaming || playerStatus === "playing") return "thinking";
  if (playerStatus === "paused") return "speaking";
  return "done";
}

export function OverlayDemo({
  mode,
  messages,
  isStreaming,
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
  onModeChange,
  onSend,
  onCancel,
  renderFullScreen,
}: OverlayDemoProps) {
  const petState = getAssistantPetState(messages, isStreaming, playerStatus);
  const assistantAvatar = assistantAvatars?.[petState] ?? <VibenPetAvatar state={petState} />;
  const [uncontrolledInput, setUncontrolledInput] = React.useState("");
  const content = inputValue ?? uncontrolledInput;
  const setContent = React.useCallback((value: string) => {
    if (inputValue === undefined) setUncontrolledInput(value);
    onInputValueChange?.(value);
  }, [inputValue, onInputValueChange]);

  const latestText = React.useMemo(() => {
    const latest = [...messages].reverse().find((message) =>
      (message.type === "text" || message.type === "thinking" || message.type === "tool_use" || message.type === "error") &&
      (message.content || message.message || message.name)
    );
    if (!latest) return "Ready when you are.";
    if (latest.type === "tool_use") return `${latest.name ?? "Tool"} is working...`;
    return latest.content || latest.message || "Working...";
  }, [messages]);

  const handleSubmit = React.useCallback(() => {
    const trimmed = content.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setContent("");
  }, [content, onSend, setContent]);

  if (mode === "full") {
    return <>{renderFullScreen?.()}</>;
  }

  if (mode === "floating") {
    return (
      <div className="fixed bottom-6 right-6 z-50" data-testid="floating-overlay">
        <button
          type="button"
          aria-label="Open compact chat"
          onClick={() => onModeChange("compact")}
          className="relative flex size-20 items-center justify-center rounded-full border border-border bg-popover shadow-2xl transition-transform hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          {assistantAvatar}
          {pendingUserMessageCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex size-6 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
              {pendingUserMessageCount > 9 ? "9+" : pendingUserMessageCount}
            </span>
          )}
        </button>
      </div>
    );
  }

  if (mode === "compact") {
    return (
      <div
        className="fixed bottom-5 right-5 z-50 flex w-[min(440px,calc(100vw-2rem))] flex-col gap-2"
        data-testid="compact-overlay"
      >
        <AgentPopup
          avatar={assistantAvatar}
          petState={petState}
          text={latestText}
          isStreaming={isStreaming}
          onExpand={() => onModeChange("expanded")}
          onMinimize={() => onModeChange("floating")}
          onFullScreen={() => onModeChange("full")}
        />
        <CompactChatInput
          value={content}
          isStreaming={isStreaming}
          onValueChange={setContent}
          onSend={handleSubmit}
          onCancel={onCancel}
          inputProps={inputProps}
        />
      </div>
    );
  }

  return (
    <div
      className="flex h-full min-h-0 w-full flex-col bg-background"
      data-testid="expanded-overlay"
    >
      <ExpandedHeader
        title={title}
        sessions={sessions}
        agents={agents}
        assistantAvatar={assistantAvatar}
        headerActions={headerActions}
        onCreateSession={headerActions?.onCreateSession}
        onSettingsClick={headerActions?.onSettingsClick}
      />
      <div className="min-h-0 flex-1 overflow-hidden border-y border-border/70">
        <ExpandedMessageList
          messages={messages}
          isStreaming={isStreaming}
          assistantAvatar={assistantAvatar}
        />
      </div>
      <div className="shrink-0 p-3">
        <CompactChatInput
          value={content}
          isStreaming={isStreaming}
          onValueChange={setContent}
          onSend={handleSubmit}
          onCancel={onCancel}
          inputProps={inputProps}
        />
      </div>
    </div>
  );
}

function AgentPopup({
  avatar,
  petState,
  text,
  isStreaming,
  onExpand,
  onMinimize,
  onFullScreen,
}: {
  avatar: React.ReactNode;
  petState: AssistantPetState;
  text: string;
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
        <div className="size-14 shrink-0">{avatar}</div>
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
                aria-label="Open full screen chat"
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
          <p className="mt-2 max-h-24 overflow-hidden text-sm leading-6 text-foreground/85">
            {text}
            {isStreaming && <span className="ml-1 inline-block h-4 w-0.5 translate-y-0.5 animate-pulse bg-primary" />}
          </p>
        </div>
      </div>
    </motion.section>
  );
}

function ExpandedMessageList({
  messages,
  isStreaming,
  assistantAvatar,
}: {
  messages: AgentMessage[];
  isStreaming: boolean;
  assistantAvatar: React.ReactNode;
}) {
  if (messages.length === 0) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center">
        <div>
          <div className="mx-auto mb-3 size-14">{assistantAvatar}</div>
          <p className="text-sm font-medium text-foreground">Viben expanded chat</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Select a session or send a message from the compact input.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto px-4 py-4">
      <div className="mx-auto flex max-w-[720px] flex-col gap-3">
        {messages.map((message, index) => {
          const isUser = message.type === "user";
          const text = message.content || message.message || (message.type === "tool_use" ? `${message.name ?? "Tool"} is running...` : "");
          if (!text) return null;
          return (
            <div key={message.id ?? index} className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
              {!isUser && <div className="mt-1 size-8 shrink-0">{assistantAvatar}</div>}
              <div
                className={`max-w-[78%] rounded-xl px-3 py-2 text-sm leading-6 ${
                  isUser
                    ? "bg-primary text-primary-foreground"
                    : "border border-border bg-card text-foreground"
                }`}
              >
                {text}
              </div>
            </div>
          );
        })}
        {isStreaming && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="size-2 animate-pulse rounded-full bg-primary" />
            Viben is thinking
          </div>
        )}
      </div>
    </div>
  );
}

function ExpandedHeader({
  title,
  sessions,
  agents,
  assistantAvatar,
  headerActions,
  onCreateSession,
  onSettingsClick,
}: {
  title: string;
  sessions: OverlaySessionItem[];
  agents: OverlayAgentItem[];
  assistantAvatar: React.ReactNode;
  headerActions?: OverlayHeaderActions;
  onCreateSession?: () => void;
  onSettingsClick?: () => void;
}) {
  const [sessionOpen, setSessionOpen] = React.useState(false);
  const [newOpen, setNewOpen] = React.useState(false);
  const [moreOpen, setMoreOpen] = React.useState(false);

  return (
    <header className="relative flex h-12 shrink-0 items-center gap-2 border-b border-border bg-card px-3">
      <div className="relative">
        <button
          type="button"
          aria-label="Session menu"
          onClick={() => setSessionOpen((open) => !open)}
          className="flex h-8 max-w-[220px] items-center gap-1.5 rounded-md px-2 text-sm font-medium text-foreground hover:bg-accent"
        >
          <span className="truncate">{title}</span>
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
                  onClick={() => headerActions?.onSelectSession?.(session)}
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

      <div className="min-w-0 flex-1" />

      <button
        type="button"
        aria-label="Create new session"
        onClick={onCreateSession}
        className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <Plus className="size-4" />
      </button>

      <div className="relative">
        <button
          type="button"
          aria-label="New session menu"
          onClick={() => setNewOpen((open) => !open)}
          className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <ChevronUp className="size-4" />
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

      <button
        type="button"
        aria-label="Settings"
        onClick={onSettingsClick}
        className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <Settings className="size-4" />
      </button>

      <div className="relative">
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
  value,
  isStreaming,
  onValueChange,
  onSend,
  onCancel,
  inputProps,
}: {
  value: string;
  isStreaming: boolean;
  onValueChange: (value: string) => void;
  onSend: () => void;
  onCancel: () => void;
  inputProps?: Partial<ChatInputProps>;
}) {
  return (
    <section
      data-testid="compact-chat-input"
      className="overflow-hidden rounded-xl border border-border bg-background shadow-2xl"
    >
      <ChatInput
        {...inputProps}
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
        showTopToolbar
        showConfigBar={false}
        defaultHeight={48}
        minHeight={48}
        maxHeight={48}
        showResizeHandle={false}
        enableWritingMode={false}
        hideAgentSelector
        hideModelSelector
        hideExecutorSelector
        className={`bg-background ${inputProps?.className ?? ""}`}
      />
    </section>
  );
}

function VibenPetAvatar({ state }: { state: AssistantPetState }) {
  const stateColor = {
    idle: "oklch(0.74 0.12 190)",
    thinking: "oklch(0.78 0.16 75)",
    speaking: "oklch(0.7 0.18 145)",
    done: "oklch(0.72 0.16 125)",
  }[state];

  return (
    <svg
      viewBox="0 0 80 80"
      role="img"
      aria-label={`Viben pet ${state}`}
      className="size-full"
    >
      <defs>
        <filter id={`pet-shadow-${state}`} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="6" stdDeviation="5" floodOpacity="0.25" />
        </filter>
      </defs>
      <motion.g
        filter={`url(#pet-shadow-${state})`}
        animate={state === "thinking" ? { y: [0, -3, 0] } : state === "speaking" ? { rotate: [-2, 2, -2] } : { y: 0 }}
        transition={{ duration: state === "thinking" ? 1.1 : 0.8, repeat: state === "idle" || state === "done" ? 0 : Infinity }}
      >
        <circle cx="40" cy="40" r="30" fill={stateColor} />
        <path d="M19 32 9 19l17 5" fill={stateColor} opacity="0.9" />
        <path d="M61 32 71 19l-17 5" fill={stateColor} opacity="0.9" />
        <circle cx="30" cy="38" r="4" fill="oklch(0.16 0.01 75)" />
        <circle cx="50" cy="38" r="4" fill="oklch(0.16 0.01 75)" />
        <motion.path
          d={state === "speaking" ? "M32 52 Q40 58 48 52" : "M32 52 Q40 55 48 52"}
          stroke="oklch(0.16 0.01 75)"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
          animate={state === "speaking" ? { d: ["M32 52 Q40 58 48 52", "M32 52 Q40 50 48 52", "M32 52 Q40 58 48 52"] } : undefined}
          transition={{ duration: 0.6, repeat: state === "speaking" ? Infinity : 0 }}
        />
        <motion.circle
          cx="58"
          cy="22"
          r="4"
          fill="oklch(0.98 0.02 95)"
          animate={state === "thinking" ? { scale: [1, 1.45, 1], opacity: [0.7, 1, 0.7] } : undefined}
          transition={{ duration: 1, repeat: state === "thinking" ? Infinity : 0 }}
        />
        <path d="M28 21 Q40 10 52 21" stroke="oklch(0.98 0.02 95)" strokeWidth="4" strokeLinecap="round" fill="none" opacity="0.8" />
      </motion.g>
    </svg>
  );
}
