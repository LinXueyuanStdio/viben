import type { AgentMessage } from "@/types";
import type { UIMessage } from "@/lib/gateway";
import type { TaskEventType } from "@/lib/kanban/types";

export function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatEventTime(
  timestamp: string,
  t: (key: string, fallback: string, options?: { count?: number }) => string
): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);

  if (diffMinutes < 1) return t("common.justNow", "Just now");
  if (diffMinutes < 60) return t("common.minutesAgo", "{{count}}m ago", { count: diffMinutes });
  if (diffHours < 24) return t("common.hoursAgo", "{{count}}h ago", { count: diffHours });
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function getEventTypeBadgeClass(eventType: TaskEventType): string {
  const eventClasses: Partial<Record<TaskEventType, string>> = {
    START: "bg-info/10 text-info",
    QUEUE: "bg-cyan-500/10 text-cyan-500",
    DEQUEUE: "bg-muted text-muted-foreground",
    PLAN_COMPLETE: "bg-success/10 text-success",
    PLAN_FAILED: "bg-destructive/10 text-destructive",
    SUBTASK_COMPLETE: "bg-success/10 text-success",
    ALL_SUBTASKS_DONE: "bg-success/10 text-success",
    IMPLEMENT_FAILED: "bg-destructive/10 text-destructive",
    CHECK_PASSED: "bg-success/10 text-success",
    CHECK_FAILED: "bg-warning/10 text-warning",
    FIX_COMPLETE: "bg-success/10 text-success",
    FIX_FAILED: "bg-destructive/10 text-destructive",
    USER_STOPPED: "bg-warning/10 text-warning",
    APPROVED: "bg-success/10 text-success",
    REJECTED: "bg-warning/10 text-warning",
    CANCEL: "bg-muted text-muted-foreground",
    PAUSE: "bg-warning/10 text-warning",
    RESUME: "bg-info/10 text-info",
    RETRY: "bg-info/10 text-info",
    ABANDON: "bg-muted text-muted-foreground",
    ARCHIVE: "bg-muted text-muted-foreground",
  };
  return eventClasses[eventType] || "bg-muted text-muted-foreground";
}

export function uiMessageToAgentMessage(
  msg: UIMessage,
  unknownErrorFallback: string
): AgentMessage | null {
  switch (msg.type) {
    case "user":
      return {
        id: msg.id,
        type: "user",
        content: msg.content || "",
      };
    case "text":
      return {
        id: msg.id,
        type: "text",
        content: msg.content || "",
      };
    case "tool_use":
      return {
        id: msg.id,
        type: "tool_use",
        toolUseId: msg.tool_use_id,
        name: msg.tool_name || "unknown",
        input: msg.tool_input,
      };
    case "tool_result":
      return {
        id: msg.id,
        type: "tool_result",
        toolUseId: msg.tool_use_id,
        output: msg.tool_output,
        isError: msg.is_error,
      };
    case "thinking":
      return {
        id: msg.id,
        type: "thinking",
        content: msg.content || "",
      };
    case "error":
      return {
        id: msg.id,
        type: "error",
        message: msg.content || unknownErrorFallback,
        isError: true,
      };
    case "sdk_session":
      return null;
    default:
      return null;
  }
}
