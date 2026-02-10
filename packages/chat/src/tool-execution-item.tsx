import * as React from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown,
  ChevronRight,
  Wrench,
  Loader2,
  CheckCircle2,
  XCircle,
  Bot,
} from "lucide-react";
import { cn } from "@viben/ui";
import type { AgentMessage } from "./types";

export interface ToolExecutionItemProps {
  name: string;
  displayName?: string;
  input?: Record<string, unknown>;
  output?: string;
  isExecuting?: boolean;
  isError?: boolean;
  className?: string;
  /** Compact mode for use within task groups */
  compact?: boolean;
  /** Subagent ID for Task tool calls */
  subagentId?: string;
  /** Recursively loaded subagent messages for Task tool calls */
  subagentMessages?: AgentMessage[];
  /** Render function for subagent messages */
  renderMessage?: (message: AgentMessage, index: number) => React.ReactNode;
}

export function ToolExecutionItem({
  name,
  displayName,
  input,
  output,
  isExecuting,
  isError,
  className,
  compact = false,
  subagentId,
  subagentMessages,
  renderMessage,
}: ToolExecutionItemProps) {
  const { t } = useTranslation();
  const hasSubagentMessages = subagentMessages && subagentMessages.length > 0;
  // Default to expanded when there are subagent messages
  const [isExpanded, setIsExpanded] = React.useState(hasSubagentMessages);
  const hasDetails = input || output || hasSubagentMessages;

  // Determine status - subagent messages loaded means completed
  const status = isExecuting
    ? "executing"
    : isError
      ? "error"
      : (output || hasSubagentMessages)
        ? "completed"
        : "pending";

  // Check if this is a Task tool (sub-agent)
  const isTaskTool = name === "Task";
  const taskInput = isTaskTool && input ? input as {
    subagent_type?: string;
    description?: string;
    prompt?: string;
    model?: string;
  } : null;

  const StatusIcon = {
    executing: Loader2,
    completed: CheckCircle2,
    error: XCircle,
    pending: Wrench,
  }[status];

  const statusColor = {
    executing: "text-primary",
    completed: "text-green-500",
    error: "text-destructive",
    pending: "text-muted-foreground",
  }[status];

  // Compact mode for use within task groups
  if (compact) {
    return (
      <div className={cn("rounded-lg", className)}>
        <button
          type="button"
          onClick={() => hasDetails && setIsExpanded(!isExpanded)}
          disabled={!hasDetails}
          className={cn(
            "flex w-full items-center gap-2 px-3 py-2 text-left rounded-lg",
            hasDetails && "cursor-pointer hover:bg-accent/50",
            "transition-colors"
          )}
        >
          <StatusIcon
            className={cn(
              "h-3.5 w-3.5 shrink-0",
              statusColor,
              status === "executing" && "animate-spin"
            )}
          />
          <span className="truncate text-sm text-muted-foreground">
            {displayName || name}
          </span>
          {hasDetails && (
            <span className="ml-auto shrink-0 text-muted-foreground">
              {isExpanded ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
            </span>
          )}
        </button>

        {/* Expandable details */}
        <AnimatePresence>
          {isExpanded && hasDetails && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="px-3 py-2 space-y-2 min-w-0 overflow-hidden">
                {input && (
                  <div className="min-w-0 overflow-hidden">
                    <p className="text-xs font-medium text-muted-foreground mb-1">
                      {t("chat.toolInput", "Input")}
                    </p>
                    <pre className="overflow-x-auto overflow-y-auto rounded-md bg-muted p-2 text-xs max-h-[150px] max-w-full">
                      <code className="text-xs break-all">{JSON.stringify(input, null, 2)}</code>
                    </pre>
                  </div>
                )}
                {output && (
                  <div className="min-w-0 overflow-hidden">
                    <p className="text-xs font-medium text-muted-foreground mb-1">
                      {t("chat.toolOutput", "Output")}
                    </p>
                    <pre
                      className={cn(
                        "overflow-x-auto overflow-y-auto rounded-md p-2 text-xs max-h-[150px] max-w-full",
                        isError ? "bg-destructive/10 text-destructive" : "bg-muted"
                      )}
                    >
                      <code className="whitespace-pre-wrap break-all text-xs">{output}</code>
                    </pre>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // Task tool gets a special display
  if (isTaskTool && taskInput) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn("flex gap-3 w-full min-w-0", className)}
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-500/10">
          <Bot className="h-4 w-4 text-violet-500" />
        </div>
        <div className="flex-1 min-w-0 overflow-hidden">
          <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 overflow-hidden">
            {/* Header */}
            <button
              type="button"
              onClick={() => hasDetails && setIsExpanded(!isExpanded)}
              disabled={!hasDetails}
              className={cn(
                "flex w-full items-center gap-3 px-4 py-3 text-left",
                hasDetails && "cursor-pointer hover:bg-violet-500/10",
                "transition-colors"
              )}
            >
              {hasDetails && (
                <span className="shrink-0 text-violet-500">
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </span>
              )}
              <div className="flex flex-1 items-center gap-2 min-w-0">
                <StatusIcon
                  className={cn(
                    "h-4 w-4 shrink-0",
                    status === "executing" ? "text-violet-500" : statusColor,
                    status === "executing" && "animate-spin"
                  )}
                />
                <span className="truncate font-medium text-sm text-violet-600 dark:text-violet-400">
                  {t("chat.subAgent", "Sub-Agent")}: {taskInput.subagent_type || "unknown"}
                </span>
                {taskInput.description && (
                  <span className="text-xs text-muted-foreground truncate">
                    — {taskInput.description}
                  </span>
                )}
              </div>
            </button>

            {/* Expandable details */}
            <AnimatePresence>
              {isExpanded && hasDetails && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="border-t border-violet-500/10 px-4 py-3 space-y-3 min-w-0 overflow-hidden">
                    {/* Task prompt */}
                    {taskInput.prompt && (
                      <div className="min-w-0 overflow-hidden">
                        <p className="text-xs font-medium text-muted-foreground mb-1">
                          {t("chat.taskPrompt", "Task Prompt")}
                        </p>
                        <pre className="overflow-x-auto overflow-y-auto rounded-lg bg-muted p-3 text-xs max-h-[200px] max-w-full">
                          <code className="whitespace-pre-wrap break-all text-xs">{taskInput.prompt}</code>
                        </pre>
                      </div>
                    )}

                    {/* Model if specified */}
                    {taskInput.model && (
                      <div className="text-xs text-muted-foreground">
                        {t("chat.model", "Model")}: <span className="font-medium">{taskInput.model}</span>
                      </div>
                    )}

                    {/* Subagent ID */}
                    {subagentId && (
                      <div className="text-xs text-muted-foreground">
                        {t("chat.subAgentId", "Agent ID")}: <span className="font-mono">{subagentId}</span>
                      </div>
                    )}

                    {/* Subagent messages (recursive rendering) */}
                    {hasSubagentMessages && renderMessage && (
                      <div className="min-w-0 overflow-hidden">
                        <p className="text-xs font-medium text-muted-foreground mb-2">
                          {t("chat.subAgentConversation", "Sub-Agent Conversation")}
                        </p>
                        <div className="space-y-2 pl-2 border-l-2 border-violet-500/20">
                          {subagentMessages.map((msg, idx) => (
                            <div key={msg.id || idx} className="min-w-0">
                              {renderMessage(msg, idx)}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Output (fallback when no subagent messages) */}
                    {output && !hasSubagentMessages && (
                      <div className="min-w-0 overflow-hidden">
                        <p className="text-xs font-medium text-muted-foreground mb-1">
                          {t("chat.subAgentResult", "Sub-Agent Result")}
                        </p>
                        <pre
                          className={cn(
                            "overflow-x-auto overflow-y-auto rounded-lg p-3 text-xs max-h-[300px] max-w-full",
                            isError
                              ? "bg-destructive/10 text-destructive"
                              : "bg-muted"
                          )}
                        >
                          <code className="whitespace-pre-wrap break-all text-xs">
                            {output}
                          </code>
                        </pre>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("flex gap-3 w-full min-w-0", className)}
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
        <Wrench className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0 overflow-hidden">
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {/* Header */}
          <button
            type="button"
            onClick={() => hasDetails && setIsExpanded(!isExpanded)}
            disabled={!hasDetails}
            className={cn(
              "flex w-full items-center gap-3 px-4 py-3 text-left",
              hasDetails && "cursor-pointer hover:bg-muted/50",
              "transition-colors"
            )}
          >
            {hasDetails && (
              <span className="shrink-0 text-muted-foreground">
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </span>
            )}
            <div className="flex flex-1 items-center gap-2 min-w-0">
              <StatusIcon
                className={cn(
                  "h-4 w-4 shrink-0",
                  statusColor,
                  status === "executing" && "animate-spin"
                )}
              />
              <span className="truncate font-medium text-sm">
                {displayName || name}
              </span>
              {status === "executing" && (
                <span className="text-xs text-muted-foreground">
                  {t("chat.toolExecuting", "Executing...")}
                </span>
              )}
            </div>
          </button>

          {/* Expandable details */}
          <AnimatePresence>
            {isExpanded && hasDetails && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="border-t border-border px-4 py-3 space-y-3 min-w-0 overflow-hidden">
                  {/* Input */}
                  {input && (
                    <div className="min-w-0 overflow-hidden">
                      <p className="text-xs font-medium text-muted-foreground mb-1">
                        {t("chat.toolInput", "Input")}
                      </p>
                      <pre className="overflow-x-auto overflow-y-auto rounded-lg bg-muted p-3 text-xs max-h-[200px] max-w-full">
                        <code className="text-xs break-all">{JSON.stringify(input, null, 2)}</code>
                      </pre>
                    </div>
                  )}

                  {/* Output */}
                  {output && (
                    <div className="min-w-0 overflow-hidden">
                      <p className="text-xs font-medium text-muted-foreground mb-1">
                        {t("chat.toolOutput", "Output")}
                      </p>
                      <pre
                        className={cn(
                          "overflow-x-auto overflow-y-auto rounded-lg p-3 text-xs max-h-[300px] max-w-full",
                          isError
                            ? "bg-destructive/10 text-destructive"
                            : "bg-muted"
                        )}
                      >
                        <code className="whitespace-pre-wrap break-all text-xs">
                          {output}
                        </code>
                      </pre>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
