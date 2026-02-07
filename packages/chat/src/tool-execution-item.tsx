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
} from "lucide-react";
import { cn } from "@viben/ui";

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
}: ToolExecutionItemProps) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = React.useState(false);

  const hasDetails = input || output;
  const status = isExecuting
    ? "executing"
    : isError
      ? "error"
      : output
        ? "completed"
        : "pending";

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
              <div className="px-3 py-2 space-y-2">
                {input && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">
                      {t("chat.toolInput", "Input")}
                    </p>
                    <pre className="overflow-x-auto rounded-md bg-muted p-2 text-xs max-h-[150px]">
                      <code>{JSON.stringify(input, null, 2)}</code>
                    </pre>
                  </div>
                )}
                {output && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">
                      {t("chat.toolOutput", "Output")}
                    </p>
                    <pre
                      className={cn(
                        "overflow-x-auto rounded-md p-2 text-xs max-h-[150px]",
                        isError ? "bg-destructive/10 text-destructive" : "bg-muted"
                      )}
                    >
                      <code className="whitespace-pre-wrap break-all">{output}</code>
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("flex gap-3", className)}
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
        <Wrench className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex-1 overflow-hidden">
        <div className="rounded-xl border border-border bg-card">
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
                <div className="border-t border-border px-4 py-3 space-y-3">
                  {/* Input */}
                  {input && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">
                        {t("chat.toolInput", "Input")}
                      </p>
                      <pre className="overflow-x-auto rounded-lg bg-muted p-3 text-xs">
                        <code>{JSON.stringify(input, null, 2)}</code>
                      </pre>
                    </div>
                  )}

                  {/* Output */}
                  {output && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">
                        {t("chat.toolOutput", "Output")}
                      </p>
                      <pre
                        className={cn(
                          "overflow-x-auto rounded-lg p-3 text-xs max-h-[300px]",
                          isError
                            ? "bg-destructive/10 text-destructive"
                            : "bg-muted"
                        )}
                      >
                        <code className="whitespace-pre-wrap break-all">
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
