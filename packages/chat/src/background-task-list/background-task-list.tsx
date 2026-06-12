import * as React from "react";
import { Bot, CalendarClock, CheckCircle2, ChevronDown, CircleAlert, Clock3, Terminal } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge, cn } from "@viben/ui";
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

function timeValue(value: unknown): number | undefined {
  const numeric = numberValue(value);
  if (numeric !== undefined) {
    return numeric < 100_000_000_000 ? numeric * 1000 : numeric;
  }
  const text = stringValue(value);
  if (!text) return undefined;
  const parsed = Date.parse(text);
  return Number.isFinite(parsed) ? parsed : undefined;
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
      timeValue(input.created_at) ??
      timeValue(input.createdAt) ??
      timeValue(input.started_at) ??
      timeValue(input.startedAt) ??
      timeValue(input.timestamp) ??
      timeValue(message.timestamp);

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
        messages: message.subagentMessages,
        sourceMessage: message,
      },
    ];
  });
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (days > 0) return `${days}d ${hours}h`;
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

export function BackgroundTaskList({
  tasks,
  messages,
  now: externalNow,
  className,
  defaultExpanded = true,
  onTaskClick,
}: BackgroundTaskListProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = React.useState(defaultExpanded);
  const [internalNow, setInternalNow] = React.useState(() => externalNow ?? Date.now());

  const now = externalNow ?? internalNow;

  const resolvedTasks = React.useMemo(
    () => tasks ?? buildBackgroundTasksFromMessages(messages, now),
    [messages, now, tasks]
  );

  const runningCount = resolvedTasks?.filter((task) => task.status === "running").length ?? 0;

  React.useEffect(() => {
    if (runningCount === 0) return;
    const interval = setInterval(() => {
      setInternalNow(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [runningCount]);

  if (!resolvedTasks || resolvedTasks.length === 0) return null;

  const handleOpenTask = (task: BackgroundTaskItem) => {
    onTaskClick?.(task);
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
    </div>
  );
}
