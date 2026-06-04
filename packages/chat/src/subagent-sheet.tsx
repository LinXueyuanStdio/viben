import { motion, AnimatePresence } from "framer-motion";
import { Loader2, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn, Badge, Button } from "@viben/ui";
import { MessageList } from "./message-list";
import type { AgentMessage, ExpandSubagentHandler } from "./types";

export interface SubagentSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subagentType?: string;
  messages: AgentMessage[];
  isLoading?: boolean;
  error?: string | null;
  onExpandSubagent?: ExpandSubagentHandler;
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
  isLoading = false,
  error,
  onExpandSubagent,
  className,
}: SubagentSheetProps) {
  const { t } = useTranslation();
  const { toolCount, errorCount, completedToolCount } = getSubagentStats(messages);
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
            className="fixed inset-0 z-40 bg-black/20"
            onClick={onClose}
          />
          {/* Panel */}
          <motion.div
            key="panel"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className={cn(
              "fixed right-0 top-0 bottom-0 z-50 flex w-[480px] max-w-[85vw] flex-col border-l bg-background shadow-xl",
              className
            )}
          >
            {/* Header */}
            <div className="flex shrink-0 items-start justify-between gap-3 border-b px-4 py-3">
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-sm font-medium">{title}</h3>
                <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2">
                  {subagentType && (
                    <Badge variant="secondary" className="max-w-full truncate px-1.5 py-0 text-[10px]">
                      {subagentType}
                    </Badge>
                  )}
                  <Badge
                    variant={errorCount > 0 ? "destructive" : status === "Done" ? "success" : "warning"}
                    className="px-1.5 py-0 text-[10px]"
                  >
                    {statusLabel}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {t("chat.subagentMessageCount", {
                      count: messages.length,
                      defaultValue: `${messages.length} messages`,
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
              {isLoading ? (
                <div className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("chat.loadingSubagent", "Loading subagent…")}
                </div>
              ) : error ? (
                <div className="m-4 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                  {error}
                </div>
              ) : (
                <MessageList
                  messages={messages}
                  simpleMode
                  toolExpandedInline
                  maxMessageWidth="100%"
                  onExpandSubagent={onExpandSubagent}
                />
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
