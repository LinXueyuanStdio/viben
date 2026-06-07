import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bot, CalendarClock, CheckCircle2, ChevronDown, CircleAlert, Clock3, Terminal, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge, cn } from "@viben/ui";
import { MessageList } from "../message-list";
import type { AgentMessage } from "../types";
import type {
  BackgroundTaskItem,
  BackgroundTaskKind,
  BackgroundTaskListProps,
  BackgroundTaskStatus,
  BackgroundTaskUsage,
} from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function formatTemplate(value: string, vars: Record<string, string | number>): string {
  return value.replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, key: string) => String(vars[key] ?? ""));
}

function getTaskKind(toolName: string | undefined): BackgroundTaskKind | null {
  if (toolName === "Cron") return "cron";
  if (toolName === "Agent") return "agent";
  if (toolName === "Task") return "task";
  if (toolName === "Bash") return "bash";
  return null;
}

function getDescription(kind: BackgroundTaskKind, input: Record<string, unknown>, fallback: string): string {
  if (kind === "bash") {
    const command = stringValue(input.command);
    if (!command) return fallback;
    const lines = command.trim().split("\n");
    const firstLine = lines[0] ?? command;
    if (firstLine.startsWith("#") && lines.length > 1) {
      return firstLine.slice(1).trim() || lines[1] || fallback;
    }
    return firstLine;
  }

  return (
    stringValue(input.description) ??
    stringValue(input.subject) ??
    stringValue(input.title) ??
    stringValue(input.name) ??
    fallback
  );
}

function normalizeUsage(raw: unknown): BackgroundTaskUsage | undefined {
  if (!isRecord(raw)) return undefined;
  const inputTokens = numberValue(raw.input_tokens) ?? numberValue(raw.inputTokens);
  const outputTokens = numberValue(raw.output_tokens) ?? numberValue(raw.outputTokens);
  const totalTokens = numberValue(raw.total_tokens) ?? numberValue(raw.totalTokens);
  const costUsd = numberValue(raw.cost_usd) ?? numberValue(raw.costUsd) ?? numberValue(raw.cost);
  if (
    inputTokens === undefined &&
    outputTokens === undefined &&
    totalTokens === undefined &&
    costUsd === undefined
  ) {
    return undefined;
  }
  return { inputTokens, outputTokens, totalTokens, costUsd };
}

function hasToolResult(message: AgentMessage, resultIds: Set<string>): boolean {
  return !!message.toolUseId && resultIds.has(message.toolUseId);
}

export function buildBackgroundTasksFromMessages(
  messages: AgentMessage[] = [],
  now: number = Date.now()
): BackgroundTaskItem[] {
  const resultIds = new Set<string>();
  for (const message of messages) {
    if (message.type === "tool_result" && message.toolUseId) {
      resultIds.add(message.toolUseId);
    }
  }

  return messages.flatMap((message): BackgroundTaskItem[] => {
    if (message.type !== "tool_use") return [];
    const kind = getTaskKind(message.name);
    if (!kind || hasToolResult(message, resultIds) || message.output !== undefined) return [];
    const input = isRecord(message.input) ? message.input : {};
    const id = message.toolUseId ?? message.id ?? `${kind}-${message.timestamp ?? now}`;
    const startedAt =
      numberValue(message.timestamp) ??
      numberValue(input.started_at) ??
      numberValue(input.startedAt);

    return [
      {
        id,
        kind,
        status: "running",
        description: getDescription(kind, input, message.name ?? "Background task"),
        startedAt,
        now,
        usage: normalizeUsage(input.usage),
        usageLabel: stringValue(input.usage_label) ?? stringValue(input.usageLabel),
        details: stringValue(input.prompt) ?? stringValue(input.details),
        messages: message.subagentPreviewMessages ?? message.subagentMessages,
        sourceMessage: message,
      },
    ];
  });
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function getElapsedMs(task: BackgroundTaskItem, defaultNow: number): number {
  if (task.elapsedMs !== undefined) return task.elapsedMs;
  if (task.startedAt === undefined) return 0;
  const end = task.endedAt ?? task.now ?? defaultNow;
  return end - task.startedAt;
}

function formatTokenCount(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}m`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return String(value);
}

function formatUsage(usage: BackgroundTaskUsage | undefined, usageLabel: string | undefined): string {
  if (usageLabel) return usageLabel;
  if (!usage) return "";
  const totalTokens = usage.totalTokens ?? (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0);
  const parts: string[] = [];
  if (totalTokens > 0) parts.push(`${formatTokenCount(totalTokens)} tokens`);
  if (usage.costUsd !== undefined) parts.push(`$${usage.costUsd.toFixed(3)}`);
  return parts.join(" · ");
}

function kindLabel(kind: BackgroundTaskKind): string {
  switch (kind) {
    case "cron":
      return "Cron";
    case "agent":
      return "Agent";
    case "task":
      return "Task";
    case "bash":
      return "Bash";
    case "other":
    default:
      return "Task";
  }
}

function statusLabel(status: BackgroundTaskStatus): string {
  switch (status) {
    case "running":
      return "Running";
    case "queued":
      return "Queued";
    case "completed":
      return "Done";
    case "failed":
      return "Error";
    case "cancelled":
      return "Cancelled";
  }
}

function getKindIcon(kind: BackgroundTaskKind) {
  switch (kind) {
    case "cron":
      return CalendarClock;
    case "agent":
    case "task":
      return Bot;
    case "bash":
      return Terminal;
    case "other":
    default:
      return Clock3;
  }
}

function getStatusIcon(status: BackgroundTaskStatus) {
  if (status === "failed") return CircleAlert;
  if (status === "completed") return CheckCircle2;
  return Clock3;
}

function getStatusVariant(status: BackgroundTaskStatus): "secondary" | "destructive" | "success" | "warning" | "outline" {
  if (status === "failed") return "destructive";
  if (status === "completed") return "success";
  if (status === "running") return "warning";
  return "secondary";
}

function TaskDetailSheet({
  task,
  onClose,
  contained,
}: {
  task: BackgroundTaskItem | null;
  onClose: () => void;
  contained?: boolean;
}) {
  const { t } = useTranslation();
  const open = !!task;

  return (
    <AnimatePresence>
      {open && task && (
        <>
          <motion.div
            key="background-task-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            className={contained ? "absolute inset-0 z-40 bg-black/20" : "fixed inset-0 z-40 bg-black/20"}
            onClick={onClose}
            data-testid="background-task-sheet-backdrop"
          />
          <motion.aside
            key="background-task-panel"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "tween", duration: 0.24, ease: [0.4, 0, 0.2, 1] }}
            className={cn(
              contained
                ? "absolute bottom-0 right-0 top-0 z-50 flex w-[420px] max-w-[85%] flex-col border-l bg-background shadow-xl"
                : "fixed bottom-0 right-0 top-0 z-50 flex w-[420px] max-w-[85vw] flex-col border-l bg-background shadow-xl"
            )}
            data-testid="background-task-sheet-panel"
          >
            <div className="flex shrink-0 items-start justify-between gap-3 border-b px-4 py-3">
              <div className="min-w-0">
                <h3 className="truncate text-sm font-medium text-foreground">{task.description}</h3>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                    {kindLabel(task.kind)}
                  </Badge>
                  <Badge variant={getStatusVariant(task.status)} className="px-1.5 py-0 text-[10px]">
                    {statusLabel(task.status)}
                  </Badge>
                </div>
              </div>
              <button
                type="button"
                aria-label={t("chat.backgroundTasks.closeDetails", "Close task details")}
                onClick={onClose}
                className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
              {task.details && (
                <div className="mb-3 rounded-md border bg-muted/30 p-3 text-xs leading-relaxed text-muted-foreground">
                  {task.details}
                </div>
              )}
              {task.sourceMessage?.input && (
                <details className="mb-3 rounded-md border bg-background p-3">
                  <summary className="cursor-pointer select-none text-xs font-medium text-foreground">
                    {t("chat.backgroundTasks.input", "Input")}
                  </summary>
                  <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-words text-[11px] text-muted-foreground">
                    {JSON.stringify(task.sourceMessage.input, null, 2)}
                  </pre>
                </details>
              )}
              {task.messages && task.messages.length > 0 ? (
                <MessageList messages={task.messages} simpleMode autoScroll={false} />
              ) : (
                <div className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
                  {t("chat.backgroundTasks.noDetails", "No detail transcript available.")}
                </div>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

export function BackgroundTaskList({
  tasks,
  messages,
  now = Date.now(),
  className,
  defaultExpanded = true,
  containedSheet,
  onOpenTask,
}: BackgroundTaskListProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = React.useState(defaultExpanded);
  const [selectedTask, setSelectedTask] = React.useState<BackgroundTaskItem | null>(null);
  const resolvedTasks = React.useMemo(
    () => tasks ?? buildBackgroundTasksFromMessages(messages, now),
    [messages, now, tasks]
  );

  if (!resolvedTasks || resolvedTasks.length === 0) return null;

  const runningCount = resolvedTasks.filter((task) => task.status === "running").length;

  const handleOpenTask = (task: BackgroundTaskItem) => {
    onOpenTask?.(task);
    setSelectedTask(task);
  };

  return (
    <div className={cn("relative rounded-lg border bg-card p-2 text-left", className)}>
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((prev) => !prev)}
        className="flex w-full min-w-0 items-center gap-2 rounded-md px-1 py-1 text-left text-xs transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Clock3 className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="font-medium text-foreground">
          {t("chat.backgroundTasks.title", "Background tasks")}
        </span>
        <Badge variant="secondary" className="h-4 min-w-4 px-1 text-[10px]">
          {resolvedTasks.length}
        </Badge>
        {runningCount > 0 && (
          <span className="min-w-0 truncate text-muted-foreground">
            {formatTemplate(
              t("chat.backgroundTasks.runningCount", {
                defaultValue: "{{count}} running",
                count: runningCount,
              }) as string,
              { count: runningCount }
            )}
          </span>
        )}
        <ChevronDown
          className={cn(
            "ml-auto size-3.5 shrink-0 text-muted-foreground transition-transform",
            expanded && "rotate-180"
          )}
        />
      </button>

      {expanded && (
        <div className="mt-1 max-h-44 space-y-0.5 overflow-y-auto">
          {resolvedTasks.map((task) => {
            const KindIcon = getKindIcon(task.kind);
            const StatusIcon = getStatusIcon(task.status);
            const runtime = formatDuration(getElapsedMs(task, now));
            const usage = formatUsage(task.usage, task.usageLabel);
            return (
              <button
                key={task.id}
                type="button"
                onClick={() => handleOpenTask(task)}
                className="group flex w-full min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <KindIcon className="size-3.5 shrink-0 text-muted-foreground" />
                <StatusIcon className={cn("size-3.5 shrink-0", task.status === "failed" ? "text-red-500" : task.status === "completed" ? "text-emerald-500" : "text-amber-500")} />
                <span className="min-w-0 flex-1 truncate text-foreground">
                  {task.description}
                </span>
                <span className="shrink-0 text-[10px] text-muted-foreground">
                  {runtime}
                </span>
                {usage && (
                  <span className="hidden max-w-[160px] shrink-0 truncate text-[10px] text-muted-foreground sm:inline">
                    {usage}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      <TaskDetailSheet
        task={selectedTask}
        onClose={() => setSelectedTask(null)}
        contained={containedSheet}
      />
    </div>
  );
}
