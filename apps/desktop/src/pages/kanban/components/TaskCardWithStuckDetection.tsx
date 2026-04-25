import { useMemo, memo } from "react";
import { KanbanCard } from "@viben/kanban";
import { cn } from "@viben/ui";
import { useStuckDetection } from "@/hooks";
import type { TaskCardWithStuckDetectionProps } from "../types";

/**
 * Task Card with real-time stuck detection
 *
 * Wraps KanbanCard and uses useStuckDetection hook for accurate
 * stuck status that considers client activity and process verification.
 */
export const TaskCardWithStuckDetection = memo(function TaskCardWithStuckDetection({
  task,
  index,
  columnId,
  workspacePath,
  isSelected,
  onClick,
  children,
  showMoreMenu,
  renderMoreMenu,
}: TaskCardWithStuckDetectionProps) {
  // Task is running if status is "in_progress"
  const isRunning = task.status === "in_progress";

  // Use the enhanced stuck detection hook for real-time detection
  const { isStuck: detectedStuck, isChecking } = useStuckDetection({
    taskId: task.id,
    isRunning,
    workspacePath,
    lastUpdated: task.updated_at,
    // Use shorter threshold for active detection
    stuckThreshold: 60000, // 1 minute
    checkInterval: 30000, // 30 seconds
  });

  // Smart stuck status merge with useMemo
  // Priority:
  // 1. If client detection found stuck AND check is reliable (not currently checking), trust it
  // 2. If server says stuck (is_stuck), trust it unless task was recently updated
  // 3. Default to not stuck
  const isStuck = useMemo(() => {
    // If not running, can't be stuck
    if (!isRunning) return false;

    // Client-side detection is most responsive when reliable
    if (detectedStuck && !isChecking) return true;

    // Server-side status - check if it's stale
    const serverStuck = task.isStuck ?? task.is_stuck ?? false;
    if (serverStuck) {
      // If task was updated recently (within 30s), server status might be stale
      if (task.updated_at) {
        const updateAge = Date.now() - new Date(task.updated_at).getTime();
        if (updateAge < 30000) {
          // Recent update - prefer client detection
          return detectedStuck;
        }
      }
      return true;
    }

    return detectedStuck;
  }, [isRunning, detectedStuck, isChecking, task.isStuck, task.is_stuck, task.updated_at]);

  return (
    <KanbanCard
      id={task.id}
      name={task.title}
      index={index}
      parent={columnId}
      onClick={onClick}
      isOpen={isSelected}
      tabIndex={isSelected ? 0 : -1}
      className={cn(
        // Running pulse animation - blue border effect
        isRunning && !isStuck && "task-running-pulse ring-2 ring-primary/50",
        // Stuck pulse animation - warning border effect
        isStuck && "task-stuck-pulse ring-2 ring-warning/50"
      )}
      showMoreMenu={showMoreMenu}
      renderMoreMenu={renderMoreMenu}
    >
      {children}
    </KanbanCard>
  );
});
