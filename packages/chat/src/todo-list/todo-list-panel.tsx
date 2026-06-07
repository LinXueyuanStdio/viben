import * as React from "react";
import { CheckCircle2, ChevronDown, Circle, CircleAlert, CircleDashed, ListTodo, XCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge, cn } from "@viben/ui";
import type { AgentMessage } from "../types";
import type { TodoListItem, TodoListItemStatus, TodoListPanelProps } from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function formatTemplate(value: string, vars: Record<string, string | number>): string {
  return value.replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, key: string) => String(vars[key] ?? ""));
}

function normalizeStatus(value: unknown): TodoListItemStatus {
  const raw = stringValue(value)?.toLowerCase().replace(/[-\s]+/g, "_") ?? "pending";
  if (raw === "done" || raw === "complete" || raw === "completed") return "completed";
  if (raw === "doing" || raw === "active" || raw === "running" || raw === "in_progress") return "in_progress";
  if (raw === "error" || raw === "failed") return "failed";
  if (raw === "canceled" || raw === "cancelled") return "cancelled";
  return "pending";
}

const STATUS_IMPORTANCE: Record<TodoListItemStatus, number> = {
  in_progress: 0,
  failed: 1,
  pending: 2,
  cancelled: 3,
  completed: 4,
};

function sortTodoListItems(items: TodoListItem[]): TodoListItem[] {
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const statusDiff = STATUS_IMPORTANCE[a.item.status] - STATUS_IMPORTANCE[b.item.status];
      return statusDiff === 0 ? a.index - b.index : statusDiff;
    })
    .map(({ item }) => item);
}

function getTaskId(input: Record<string, unknown>, fallback: string): string {
  return getExplicitTaskId(input) ?? fallback;
}

function getExplicitTaskId(input: Record<string, unknown>): string | undefined {
  return (
    stringValue(input.id) ??
    stringValue(input.task_id) ??
    stringValue(input.taskId) ??
    stringValue(input.todo_id) ??
    stringValue(input.todoId)
  );
}

function getTaskContent(input: Record<string, unknown>): string | undefined {
  return (
    stringValue(input.subject) ??
    stringValue(input.content) ??
    stringValue(input.description) ??
    stringValue(input.title) ??
    stringValue(input.task)
  );
}

function getMessageTime(message: AgentMessage): number | undefined {
  return typeof message.timestamp === "number" ? message.timestamp : undefined;
}

function normalizeTodo(rawTodo: unknown, index: number, message: AgentMessage): TodoListItem | null {
  if (!isRecord(rawTodo)) return null;
  const id = getTaskId(rawTodo, `${message.toolUseId ?? message.id ?? "todo"}-${index}`);
  const content = getTaskContent(rawTodo);
  if (!content) return null;
  const timestamp = getMessageTime(message);

  return {
    id,
    content,
    status: normalizeStatus(rawTodo.status),
    createdAt: timestamp,
    updatedAt: timestamp,
    toolUseId: message.toolUseId,
    raw: rawTodo,
  };
}

function extractTodosFromValue(value: unknown, message: AgentMessage): TodoListItem[] {
  if (Array.isArray(value)) {
    return value
      .map((todo, index) => normalizeTodo(todo, index, message))
      .filter((todo): todo is TodoListItem => !!todo);
  }

  if (isRecord(value)) {
    const candidates = [value.todos, value.items, value.tasks, value.todo_list, value.todoList];
    for (const candidate of candidates) {
      const todos = extractTodosFromValue(candidate, message);
      if (todos.length > 0) return todos;
    }
  }

  if (typeof value === "string") {
    try {
      return extractTodosFromValue(JSON.parse(value), message);
    } catch {
      return [];
    }
  }

  return [];
}

export function buildTodoListItems(messages: AgentMessage[] = []): TodoListItem[] {
  return buildTodoListItemsFromMessages(messages);
}

export function buildTodoListItemsFromMessages(
  messages: AgentMessage[] = [],
  messageUpdates?: Record<string, Partial<AgentMessage>>
): TodoListItem[] {
  const itemsById = new Map<string, TodoListItem>();
  const resultsByToolUseId = new Map<string, AgentMessage>();
  const resolvedMessages = messages.map((message) => {
    if (!message.id) return message;
    const update = messageUpdates?.[message.id];
    return update ? { ...message, ...update } : message;
  });

  for (const message of resolvedMessages) {
    if (message.type === "tool_result" && message.toolUseId) {
      resultsByToolUseId.set(message.toolUseId, message);
    }
  }

  let nextTaskCreateId = 1;

  for (const message of resolvedMessages) {
    if (message.type !== "tool_use") continue;
    const toolName = message.name;
    const input = isRecord(message.input) ? message.input : {};
    const timestamp = getMessageTime(message);

    if (toolName === "TodoList" || toolName === "TodoWrite") {
      const result = message.toolUseId ? resultsByToolUseId.get(message.toolUseId) : undefined;
      const snapshot = [
        ...extractTodosFromValue(input, message),
        ...extractTodosFromValue(message.output, message),
        ...extractTodosFromValue(result?.output, result ?? message),
      ];
      if (snapshot.length > 0) {
        itemsById.clear();
        for (const item of snapshot) {
          itemsById.set(item.id, item);
        }
      }
      continue;
    }

    if (toolName !== "TaskCreate" && toolName !== "TaskUpdate") continue;

    const id = getExplicitTaskId(input) ?? (
      toolName === "TaskCreate"
        ? String(nextTaskCreateId++)
        : message.toolUseId ?? message.id ?? `${toolName}-${itemsById.size + 1}`
    );
    const existing = itemsById.get(id);
    const content = getTaskContent(input) ?? existing?.content;
    if (!content) continue;

    itemsById.set(id, {
      ...existing,
      id,
      content,
      status: input.status !== undefined ? normalizeStatus(input.status) : existing?.status ?? "pending",
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp ?? existing?.updatedAt,
      toolUseId: message.toolUseId ?? existing?.toolUseId,
      raw: { ...(existing?.raw ?? {}), ...input },
    });
  }

  return sortTodoListItems(Array.from(itemsById.values()));
}

function statusLabel(status: TodoListItemStatus): string {
  return status.replace("_", " ");
}

function getStatusIcon(status: TodoListItemStatus) {
  switch (status) {
    case "completed":
      return CheckCircle2;
    case "in_progress":
      return CircleDashed;
    case "failed":
      return CircleAlert;
    case "cancelled":
      return XCircle;
    case "pending":
    default:
      return Circle;
  }
}

function getStatusClassName(status: TodoListItemStatus): string {
  switch (status) {
    case "completed":
      return "text-emerald-600 dark:text-emerald-400";
    case "in_progress":
      return "text-blue-600 dark:text-blue-400";
    case "failed":
      return "text-red-600 dark:text-red-400";
    case "cancelled":
      return "text-muted-foreground";
    case "pending":
    default:
      return "text-muted-foreground";
  }
}

export function TodoListPanel({
  messages,
  messageUpdates,
  items,
  className,
  compact,
  defaultExpanded = false,
}: TodoListPanelProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = React.useState(defaultExpanded);
  const resolvedItems = React.useMemo(
    () => items ? sortTodoListItems(items) : buildTodoListItemsFromMessages(messages, messageUpdates),
    [items, messageUpdates, messages]
  );

  if (!resolvedItems || resolvedItems.length === 0) return null;

  const inProgressCount = resolvedItems.filter((item) => item.status === "in_progress").length;
  const completedCount = resolvedItems.filter((item) => item.status === "completed").length;
  const summary = inProgressCount > 0
    ? formatTemplate(
        t("chat.todoList.inProgressCount", {
          defaultValue: "{{count}} in progress",
          count: inProgressCount,
        }) as string,
        { count: inProgressCount }
      )
    : formatTemplate(
        t("chat.todoList.completedCount", {
          defaultValue: "{{count}} completed",
          count: completedCount,
        }) as string,
        { count: completedCount }
      );

  return (
    <div
      className={cn(
        compact ? "border-t border-border/40 bg-muted/30" : "rounded-lg border bg-card p-2",
        "text-left",
        className
      )}
    >
      <button
        type="button"
        aria-expanded={expanded}
        aria-label={expanded ? t("chat.todoList.collapse", "Collapse tasks") : t("chat.todoList.expand", "Expand tasks")}
        onClick={() => setExpanded((prev) => !prev)}
        className={cn(
          "flex w-full min-w-0 items-center gap-2 text-left transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          compact ? "px-3 py-1.5 text-xs text-muted-foreground" : "rounded-md px-1 py-1 text-xs"
        )}
      >
        <ListTodo className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="min-w-0 font-medium text-foreground">
          {t("chat.todoList.title", "Tasks")}
        </span>
        <Badge variant="secondary" className="h-4 min-w-4 px-1 text-[10px]">
          {resolvedItems.length}
        </Badge>
        <span className="min-w-0 truncate text-muted-foreground">
          {summary}
        </span>
        <ChevronDown
          className={cn(
            "ml-auto size-3.5 shrink-0 text-muted-foreground transition-transform",
            expanded && "rotate-180"
          )}
        />
      </button>

      {expanded && (
        <div className={cn("space-y-0.5 overflow-y-auto", compact ? "max-h-28 border-t border-border/20 px-3 py-1.5" : "mt-1 max-h-40")}>
          {resolvedItems.map((item, index) => {
            const StatusIcon = getStatusIcon(item.status);
            return (
              <div
                key={item.id}
                className="flex min-w-0 items-center gap-2 rounded-md px-2 py-1 text-xs hover:bg-muted/50"
              >
                <span className="w-4 shrink-0 text-muted-foreground">
                  {index + 1}
                </span>
                <StatusIcon className={cn("size-3.5 shrink-0", getStatusClassName(item.status))} />
                <span className="min-w-0 flex-1 truncate text-foreground">
                  {item.content}
                </span>
                <span className={cn("shrink-0 text-[10px]", getStatusClassName(item.status))}>
                  {statusLabel(item.status)}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {!expanded && compact && (
        <span className="sr-only">
          {formatTemplate(
            t("chat.todoList.collapsedCount", {
              defaultValue: "{{count}} tasks",
              count: resolvedItems.length,
            }) as string,
            { count: resolvedItems.length }
          )}
        </span>
      )}
      {!expanded && !compact && (
        <div className="px-1 pb-1 text-[11px] text-muted-foreground">
          {formatTemplate(
            t("chat.todoList.collapsedCount", {
              defaultValue: "{{count}} tasks",
              count: resolvedItems.length,
            }) as string,
            { count: resolvedItems.length }
          )}
        </div>
      )}
    </div>
  );
}
