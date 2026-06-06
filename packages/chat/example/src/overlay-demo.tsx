import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Maximize2, Minimize2, Paperclip, Send, Smile, Square } from "lucide-react";
import type { AgentMessage, MessageAttachment } from "@viben/chat";

export type OverlayMode = "floating" | "compact" | "full";
export type AssistantPetState = "idle" | "thinking" | "speaking" | "done";
export type AssistantPetAvatarMap = Partial<Record<AssistantPetState, React.ReactNode>>;

export interface OverlayDemoProps {
  mode: OverlayMode;
  messages: AgentMessage[];
  isStreaming: boolean;
  playerStatus?: "idle" | "playing" | "paused";
  pendingUserMessageCount?: number;
  assistantAvatars?: AssistantPetAvatarMap;
  inputValue?: string;
  onInputValueChange?: (value: string) => void;
  onModeChange: (mode: OverlayMode) => void;
  onSend: (content: string, attachments?: MessageAttachment[]) => void;
  onCancel: () => void;
  renderFullScreen?: () => React.ReactNode;
}

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
  playerStatus = "idle",
  pendingUserMessageCount = 0,
  assistantAvatars,
  inputValue,
  onInputValueChange,
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
        onMinimize={() => onModeChange("floating")}
        onFullScreen={() => onModeChange("full")}
      />
      <CompactChatInput
        value={content}
        isStreaming={isStreaming}
        onValueChange={setContent}
        onSend={handleSubmit}
        onCancel={onCancel}
      />
    </div>
  );
}

function AgentPopup({
  avatar,
  petState,
  text,
  isStreaming,
  onMinimize,
  onFullScreen,
}: {
  avatar: React.ReactNode;
  petState: AssistantPetState;
  text: string;
  isStreaming: boolean;
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
                onClick={onMinimize}
                className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Minimize2 className="size-3.5" />
              </button>
              <button
                type="button"
                aria-label="Open full screen chat"
                onClick={onFullScreen}
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

function CompactChatInput({
  value,
  isStreaming,
  onValueChange,
  onSend,
  onCancel,
}: {
  value: string;
  isStreaming: boolean;
  onValueChange: (value: string) => void;
  onSend: () => void;
  onCancel: () => void;
}) {
  return (
    <section
      data-testid="compact-chat-input"
      className="rounded-xl border border-border bg-background shadow-2xl"
    >
      <div className="flex items-center gap-1 border-b border-border/50 px-2 py-1.5">
        <button type="button" aria-label="Emoji" className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground">
          <Smile className="size-4" />
        </button>
        <button type="button" aria-label="Attach file" className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground">
          <Paperclip className="size-4" />
        </button>
      </div>
      <div className="flex items-end gap-2 px-3 py-2">
        <textarea
          aria-label="Compact chat input"
          rows={1}
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              onSend();
            }
          }}
          placeholder={isStreaming ? "Queue a message..." : "Ask Viben..."}
          className="min-h-9 flex-1 resize-none bg-transparent py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />
        {isStreaming ? (
          <button
            type="button"
            aria-label="Stop"
            onClick={onCancel}
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-destructive text-destructive-foreground transition-colors hover:bg-destructive/90"
          >
            <Square className="size-3.5" />
          </button>
        ) : (
          <button
            type="button"
            aria-label="Send"
            disabled={!value.trim()}
            onClick={onSend}
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-foreground text-background transition-colors hover:bg-foreground/90 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
          >
            <Send className="size-4" />
          </button>
        )}
      </div>
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
