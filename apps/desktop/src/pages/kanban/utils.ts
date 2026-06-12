import type { TaskStatus as VibeTaskStatus } from "@/lib/kanban";
import type { LifecycleAction } from "@/hooks/use-kanban";
import type { IssuePriority } from "@viben/kanban";

/**
 * Maps a status transition to the appropriate lifecycle action
 *
 * @param fromStatus - Current task status (optional, used for context-aware mapping)
 * @param toStatus - Target task status
 * @returns The lifecycle action to use, or null if no direct mapping exists
 */
export function getLifecycleActionForStatusChange(
  fromStatus: VibeTaskStatus | undefined,
  toStatus: VibeTaskStatus
): LifecycleAction | null {
  // Context-aware mappings (depend on current status)
  if (toStatus === "backlog") {
    if (fromStatus === "queue") return "dequeue";
    if (fromStatus === "review") return "reject";
    // For other statuses going to backlog, use dequeue as fallback
    return "dequeue";
  }

  if (toStatus === "in_progress") {
    if (fromStatus === "paused") return "resume";
    // For queue -> in_progress, use start
    return "start";
  }

  // Simple status -> action mappings
  const statusToAction: Partial<Record<VibeTaskStatus, LifecycleAction>> = {
    queue: "enqueue",
    paused: "pause",
    completed: "approve",
    cancelled: "cancel",
    archived: "archive",
  };

  return statusToAction[toStatus] ?? null;
}

/** Validate priority string is a valid IssuePriority */
export const validatePriority = (priority?: string): IssuePriority | undefined => {
  if (!priority) return undefined;
  const validPriorities: IssuePriority[] = ["urgent", "high", "medium", "low", "none"];
  return validPriorities.includes(priority as IssuePriority)
    ? (priority as IssuePriority)
    : undefined;
};
