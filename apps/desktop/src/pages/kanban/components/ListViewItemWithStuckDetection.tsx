import { useMemo, memo } from "react";
import { ListViewItem } from "@viben/kanban";
import { cn } from "@viben/ui";
import { useStuckDetection } from "@/hooks";
import type { ListViewItemWithStuckDetectionProps } from "../types";

/**
 * List View Item with real-time stuck detection
 *
 * Wraps ListViewItem and uses useStuckDetection hook for accurate
 * stuck status that considers client activity and process verification.
 */
export const ListViewItemWithStuckDetection = memo(function ListViewItemWithStuckDetection({
  task,
  workspacePath,
  isSelected,
  onClick,
  renderStatus,
  children,
}: ListViewItemWithStuckDetectionProps) {
  // Task is running if status is "in_progress"
  const isRunning = task.status === "in_progress";

  // Use the enhanced stuck detection hook for real-time detection
  const { isStuck: detectedStuck, isChecking } = useStuckDetection({
    taskId: task.id,
    isRunning,
    workspacePath,
    lastUpdated: task.updated_at,
    stuckThreshold: 60000,
    checkInterval: 30000,
  });

  // Smart stuck status merge (same logic as TaskCardWithStuckDetection)
  const isStuck = useMemo(() => {
    if (!isRunning) return false;

    if (detectedStuck && !isChecking) return true;

    const serverStuck = task.isStuck ?? task.is_stuck ?? false;
    if (serverStuck) {
      if (task.updated_at) {
        const updateAge = Date.now() - new Date(task.updated_at).getTime();
        if (updateAge < 30000) {
          return detectedStuck;
        }
      }
      return true;
    }

    return detectedStuck;
  }, [isRunning, detectedStuck, isChecking, task.isStuck, task.is_stuck, task.updated_at]);

  return (
    <ListViewItem
      item={task}
      onClick={onClick}
      isSelected={isSelected}
      renderStatus={renderStatus}
      className={cn(
        // Running pulse animation - blue border effect
        isRunning && !isStuck && "task-running-pulse ring-2 ring-primary/50",
        // Stuck pulse animation - warning border effect
        isStuck && "task-stuck-pulse ring-2 ring-warning/50"
      )}
    >
      {children}
    </ListViewItem>
  );
});
