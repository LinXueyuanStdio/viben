import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn, Badge, Button } from "@viben/ui";
import { MessageList } from "./message-list";
import type { MessageListProps } from "./message-list";
import type { AgentMessage, ExpandSubagentHandler, InspectToolHandler, LoadSubagentDetails, SubagentOpenContext } from "./types";

/** MessageList props that SubagentSheet forwards to its internal MessageList. */
export type SubagentMessageListConfig = Pick<MessageListProps,
  | "assistantAvatar"
  | "showUserAvatar"
  | "showAssistantAvatar"
  | "artifacts"
  | "onArtifactClick"
  | "renderSummary"
  | "onLinkClick"
>;

const DEFAULT_SHEET_WIDTH = 480;
const MIN_SHEET_WIDTH = 320;
const MAX_SHEET_WIDTH = 760;

function mergeToolResultsIntoToolCalls(messages: AgentMessage[]): AgentMessage[] {
  const resultsByToolUseId = new Map<string, AgentMessage>();
  for (const message of messages) {
    if (message.type === "tool_result" && message.toolUseId) {
      resultsByToolUseId.set(message.toolUseId, message);
    }
  }

  return messages
    .filter((message) => message.type !== "tool_result")
    .map((message) => {
      if (message.type !== "tool_use" || !message.toolUseId) return message;
      const result = resultsByToolUseId.get(message.toolUseId);
      if (!result) return message;
      return {
        ...message,
        output: result.output,
        isError: result.isError ?? message.isError,
      };
    });
}

export interface SubagentSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subagentType?: string;
  messages: AgentMessage[];
  /** Transient messages that update while the parent Agent/Task is still running. */
  liveMessages?: AgentMessage[];
  /** Final answer/output from the Agent/Task tool (tool_result). */
  answer?: AgentMessage["output"];
  context?: SubagentOpenContext;
  loadSubagentDetails?: LoadSubagentDetails;
  isLoading?: boolean;
  error?: string | null;
  onExpandSubagent?: ExpandSubagentHandler;
  onInspectTool?: InspectToolHandler;
  /** MessageList visual/rendering configuration forwarded from the parent. */
  messageListConfig?: SubagentMessageListConfig;
  /** Render inside a relatively positioned parent instead of the viewport. */
  contained?: boolean;
  /** Maximum width of the sheet panel (px). Overrides the default CSS max-width. */
  maxWidth?: number;
  className?: string;
}

function getSubagentStats(messages: AgentMessage[]) {
  let toolCount = 0;
  let errorCount = 0;
  let completedToolCount = 0;

  for (const message of messages) {
    if (message.type === "tool_use") {
      toolCount += 1;
      if (message.output !== undefined) completedToolCount += 1;
      if (message.isError) errorCount += 1;
    }

    if (message.type === "error") {
      errorCount += 1;
    }
  }

  return { toolCount, errorCount, completedToolCount };
}

export function SubagentSheet({
  open,
  onClose,
  title,
  subagentType,
  messages,
  liveMessages,
  answer,
  context,
  loadSubagentDetails,
  isLoading = false,
  error,
  onExpandSubagent,
  onInspectTool,
  messageListConfig,
  contained = false,
  maxWidth,
  className,
}: SubagentSheetProps) {
  const { t } = useTranslation();
  const [loadedTitle, setLoadedTitle] = useState<string | undefined>();
  const [loadedSubagentType, setLoadedSubagentType] = useState<string | undefined>();
  const [loadedMessages, setLoadedMessages] = useState<AgentMessage[] | null>(null);
  const [loadState, setLoadState] = useState<{
    isLoading: boolean;
    error: string | null;
  }>({ isLoading: false, error: null });
  const [sheetWidth, setSheetWidth] = useState(DEFAULT_SHEET_WIDTH);
  const dragStateRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const hasLiveMessages = !!liveMessages && liveMessages.length > 0;
  const effectiveMessages = hasLiveMessages
    ? liveMessages
    : messages.length > 0
      ? messages
      : (loadedMessages ?? messages);
  const prompt = context?.prompt;
  const displayMessages = useMemo(() => {
    const merged = mergeToolResultsIntoToolCalls(effectiveMessages);
    const result: AgentMessage[] = [];
    if (prompt) {
      result.push({
        id: "subagent-prompt",
        type: "user",
        content: prompt,
      });
    }
    result.push(...merged);
    if (answer) {
      const answerContent = typeof answer === "string" ? answer : Array.isArray(answer)
        ? answer.map((b) => ("text" in b ? b.text : "")).join("\n")
        : "";
      if (answerContent) {
        result.push({
          id: "subagent-final-answer",
          type: "result",
          content: answerContent,
        });
      }
    }
    return result;
  }, [effectiveMessages, answer, prompt]);
  const hasDisplayMessages = effectiveMessages.length > 0;
  const effectiveTitle = loadedTitle ?? title;
  const effectiveSubagentType = loadedSubagentType ?? subagentType;
  const effectiveIsLoading = isLoading || loadState.isLoading;
  const effectiveError = error ?? loadState.error;
  const { toolCount, errorCount, completedToolCount } = getSubagentStats(displayMessages);
  const status = errorCount > 0
    ? "Error"
    : toolCount > 0 && completedToolCount >= toolCount
      ? "Done"
      : "Running";
  const statusLabel = status === "Error"
    ? t("chat.error", "Error")
    : status === "Done"
      ? t("chat.done", "Done")
      : t("chat.subAgentRunning", "Running…");

  useEffect(() => {
    setLoadedTitle(undefined);
    setLoadedSubagentType(undefined);
    setLoadedMessages(null);
    setLoadState({ isLoading: false, error: null });
  }, [context?.subagentId, context?.toolUseId]);

  useEffect(() => {
    if (!open || !loadSubagentDetails || !context || messages.length > 0) return;

    let cancelled = false;
    setLoadState({ isLoading: true, error: null });

    loadSubagentDetails(context)
      .then((details) => {
        if (cancelled) return;
        setLoadedTitle(details.title);
        setLoadedSubagentType(details.subagentType);
        setLoadedMessages(details.messages);
        setLoadState({ isLoading: false, error: null });
      })
      .catch((loadError: unknown) => {
        if (cancelled) return;
        const message = loadError instanceof Error ? loadError.message : String(loadError);
        setLoadState({ isLoading: false, error: message });
      });

    return () => {
      cancelled = true;
    };
  }, [context, loadSubagentDetails, messages.length, open]);

  useEffect(() => {
    if (!open) return;

    const handleMouseMove = (event: MouseEvent) => {
      const dragState = dragStateRef.current;
      if (!dragState) return;
      const maxWidth = Math.min(MAX_SHEET_WIDTH, Math.max(MIN_SHEET_WIDTH, window.innerWidth - 48));
      const nextWidth = dragState.startWidth + dragState.startX - event.clientX;
      setSheetWidth(Math.min(maxWidth, Math.max(MIN_SHEET_WIDTH, nextWidth)));
    };

    const handleMouseUp = () => {
      dragStateRef.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [open]);

  const handleResizeStart = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    dragStateRef.current = {
      startX: event.clientX,
      startWidth: sheetWidth,
    };
    document.body.style.cursor = "ew-resize";
    document.body.style.userSelect = "none";
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop - only rendered in standalone (non-contained) mode */}
      {!contained && (
        <div
          data-testid="subagent-sheet-backdrop"
          className="fixed inset-0 z-40 bg-black/20"
          onClick={onClose}
        />
      )}
      {/* Panel */}
      <div
        data-testid="subagent-sheet-panel"
        className={cn(
          contained
            ? "flex h-full min-w-0 flex-col overflow-hidden border-l bg-background shadow-xl"
            : "fixed right-0 top-0 bottom-0 z-50 flex min-w-0 flex-col overflow-hidden border-l bg-background shadow-xl",
          className
        )}
        style={{ width: `${sheetWidth}px`, maxWidth: maxWidth ? `${maxWidth}px` : contained ? "85%" : "85vw" }}
      >
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label={t("chat.resizeSubagentPanel", "Resize subagent panel")}
          data-testid="subagent-sheet-resize-handle"
          className="absolute inset-y-0 left-0 z-10 w-2 -translate-x-1/2 cursor-ew-resize touch-none"
          onMouseDown={handleResizeStart}
        >
          <div className="absolute left-1/2 top-1/2 h-12 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-border transition-colors hover:bg-primary/60" />
        </div>
        {/* Header */}
        <div className="flex shrink-0 items-start justify-between gap-3 border-b px-4 py-3">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-medium">{effectiveTitle}</h3>
            <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2">
              {effectiveSubagentType && (
                <Badge variant="secondary" className="max-w-full truncate px-1.5 py-0 text-[10px]">
                  {effectiveSubagentType}
                </Badge>
              )}
              <Badge
                variant={effectiveError || errorCount > 0 ? "destructive" : status === "Done" ? "success" : "warning"}
                className="px-1.5 py-0 text-[10px]"
              >
                {effectiveError
                  ? t("chat.error", "Error")
                  : effectiveIsLoading
                    ? t("chat.subAgentRunning", "Running…")
                    : statusLabel}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {t("chat.subagentMessageCount", {
                  count: effectiveMessages.length,
                  defaultValue: `${effectiveMessages.length} messages`,
                })}
                {toolCount > 0
                  ? ` · ${t("chat.subagentToolCount", {
                      count: toolCount,
                      defaultValue: `${toolCount} tools`,
                    })}`
                  : ""}
              </span>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="ml-2 shrink-0"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        {/* Message list */}
        <div className="flex w-full flex-1 flex-col overflow-hidden min-h-0 min-w-0">
          {effectiveIsLoading && !hasDisplayMessages ? (
            <div className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("chat.loadingSubagent", "Loading subagent…")}
            </div>
          ) : (
            <>
              {effectiveError && (
                <div className="m-3 shrink-0 rounded-md border border-destructive/30 bg-destructive/5 px-2.5 py-1.5 text-xs text-destructive">
                  {effectiveError}
                </div>
              )}
              {effectiveIsLoading && hasDisplayMessages && (
                <div className="mx-3 mt-2 flex shrink-0 items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {t("chat.loadingSubagent", "Loading subagent…")}
                </div>
              )}
              <MessageList
                messages={displayMessages}
                simpleMode
                maxMessageWidth="100%"
                onExpandSubagent={onExpandSubagent}
                onInspectTool={onInspectTool}
                {...messageListConfig}
                userAvatar={messageListConfig?.assistantAvatar}
                showUserAvatar={!!prompt}
              />
            </>
          )}
        </div>
      </div>
    </>
  );
}
