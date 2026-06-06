import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn, Badge, Button } from "@viben/ui";
import { MessageList } from "./message-list";
import type { AgentMessage, ExpandSubagentHandler, LoadSubagentDetails, SubagentOpenContext } from "./types";

export interface SubagentSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subagentType?: string;
  messages: AgentMessage[];
  /** Transient messages that update while the parent Agent/Task is still running. */
  liveMessages?: AgentMessage[];
  context?: SubagentOpenContext;
  loadSubagentDetails?: LoadSubagentDetails;
  isLoading?: boolean;
  error?: string | null;
  onExpandSubagent?: ExpandSubagentHandler;
  /** Render inside a relatively positioned parent instead of the viewport. */
  contained?: boolean;
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

    if (message.type === "tool_result") {
      if (message.isError) errorCount += 1;
      if (message.toolUseId) completedToolCount += 1;
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
  context,
  loadSubagentDetails,
  isLoading = false,
  error,
  onExpandSubagent,
  contained = false,
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
  const hasLiveMessages = !!liveMessages && liveMessages.length > 0;
  const effectiveMessages = hasLiveMessages
    ? liveMessages
    : messages.length > 0
      ? messages
      : (loadedMessages ?? messages);
  const hasDisplayMessages = effectiveMessages.length > 0;
  const effectiveTitle = loadedTitle ?? title;
  const effectiveSubagentType = loadedSubagentType ?? subagentType;
  const effectiveIsLoading = isLoading || loadState.isLoading;
  const effectiveError = error ?? loadState.error;
  const { toolCount, errorCount, completedToolCount } = getSubagentStats(effectiveMessages);
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
  }, [context?.subagentId, context?.toolUseId, open]);

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

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            data-testid="subagent-sheet-backdrop"
            className={contained ? "absolute inset-0 z-40 bg-black/20" : "fixed inset-0 z-40 bg-black/20"}
            onClick={onClose}
          />
          {/* Panel */}
          <motion.div
            key="panel"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            data-testid="subagent-sheet-panel"
            className={cn(
              contained
                ? "absolute right-0 top-0 bottom-0 z-50 flex w-[480px] max-w-[85%] flex-col border-l bg-background shadow-xl"
                : "fixed right-0 top-0 bottom-0 z-50 flex w-[480px] max-w-[85vw] flex-col border-l bg-background shadow-xl",
              className
            )}
          >
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
            <div className="flex flex-1 flex-col overflow-hidden min-h-0">
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
                    messages={effectiveMessages}
                    simpleMode
                    toolExpandedInline
                    maxMessageWidth="100%"
                    onExpandSubagent={onExpandSubagent}
                  />
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
