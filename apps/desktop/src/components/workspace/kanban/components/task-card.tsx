/**
 * TaskCard - Wrapper component for task cards in kanban view
 *
 * Integrates:
 * - useStuckDetection hook for real-time stuck task detection
 * - TaskCardContent for main content display
 * - TaskCardMenu for dropdown menu actions
 * - KanbanCard from @viben/kanban for drag-and-drop container
 * - SelectableCard for multi-select support
 *
 * This component handles:
 * - Stuck detection with client-side activity tracking and process verification
 * - Visual indication for running/stuck tasks (pulse animations)
 * - Click handler for task selection
 * - Checkbox in selection mode for bulk operations
 *
 * Extracted from workspace-kanban.tsx for better organization and reusability.
 *
 * @see docs/plans/2026-03-08-workspace-kanban-refactor-design.md
 */

import { memo, useMemo, useCallback } from "react";
import { KanbanCard, type Status } from "@viben/kanban";
import { cn } from "@viben/ui";
import { useStuckDetection } from "@/hooks/use-stuck-detection";
import type { EnhancedTask, TaskActions, Subtask } from "../types";
import { TaskCardContent } from "./task-card-content";
import { TaskCardMenu } from "./task-card-menu";
import { useElapsedTime } from "../hooks";

/**
 * Props for TaskCard component
 */
export interface TaskCardProps {
  /** The task to display */
  task: EnhancedTask;
  /** Index in the column for drag ordering */
  index: number;
  /** Parent column ID */
  columnId: string;
  /** Workspace path for API calls and stuck detection */
  workspacePath: string;
  /** Whether this task is currently selected (detail panel open) */
  isSelected: boolean;
  /** Whether multi-select mode is active */
  isSelecting: boolean;
  /** Click handler for task selection */
  onClick: () => void;
  /** Toggle handler for multi-select */
  onToggleSelect: (id: string) => void;
  /** Task action callbacks */
  actions: TaskActions;
  /** Available column statuses for "Move to" menu */
  columnStatuses: Status[];
}

/**
 * TaskCard - Task card wrapper with stuck detection and menu integration
 *
 * Features:
 * - Real-time stuck detection using client-side activity tracking
 * - Smart stuck status merge (client + server detection)
 * - Running task pulse animation (blue border)
 * - Stuck task pulse animation (warning border)
 * - Dropdown menu for task actions
 * - Auto-scroll into view when selected
 */
export const TaskCard = memo(function TaskCard({
  task,
  index,
  columnId,
  workspacePath,
  isSelected,
  isSelecting: _isSelecting,
  onClick,
  onToggleSelect: _onToggleSelect,
  actions,
  columnStatuses,
}: TaskCardProps) {
  // Use the enhanced stuck detection hook for real-time detection
  const {
    isStuck: detectedStuck,
    isIncomplete: _isIncomplete,
    isChecking,
    stuckDuration: _stuckDuration,
    taskProgress: _taskProgress,
    handleRecover,
    handleResume,
  } = useStuckDetection({
    taskId: task.id,
    isRunning: !!task.has_in_progress_attempt,
    workspacePath,
    lastUpdated: task.updated_at,
    subtasks: task.subtasks_detail as Subtask[] | undefined,
    hasSpec: !!task.description, // Use description as proxy for spec
    // Use shorter threshold for active detection
    stuckThreshold: 60000, // 1 minute
    checkInterval: 30000, // 30 seconds
  });

  const isRunning = !!task.has_in_progress_attempt;

  // Track elapsed time for running tasks
  const { elapsedTime } = useElapsedTime({
    isRunning,
    startTime: task.updated_at,
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

  // Prepare action callbacks for TaskCardContent
  const handleStart = useCallback(() => {
    actions.onStart(task.id);
  }, [actions, task.id]);

  const handleStop = useCallback(() => {
    actions.onStop(task.id);
  }, [actions, task.id]);

  const handleRecoverTask = useCallback(() => {
    // Use the stuck detection's handleRecover if available
    // Otherwise fallback to actions.onRecover
    handleRecover().catch(() => {
      // If hook recovery fails, try actions
      actions.onRecover(task.id);
    });
  }, [handleRecover, actions, task.id]);

  const handleResumeTask = useCallback(() => {
    // Use the stuck detection's handleResume if available
    handleResume().catch(() => {
      // If hook resume fails, try actions
      actions.onResume(task.id);
    });
  }, [handleResume, actions, task.id]);

  const handleViewPR = useCallback(() => {
    if (task.prUrl || task.pr_url) {
      actions.onViewPR(task.prUrl || task.pr_url!);
    }
  }, [actions, task.prUrl, task.pr_url]);

  const handleArchive = useCallback(() => {
    actions.onArchive(task.id);
  }, [actions, task.id]);

  const handleTitleChange = useCallback(
    (title: string) => {
      actions.onTitleChange(task.id, title);
    },
    [actions, task.id]
  );

  // Determine which actions to show in TaskCardContent
  const canStart =
    (task.status === "backlog" || task.status === "queue") &&
    !task.has_in_progress_attempt;
  const canStop = !!task.has_in_progress_attempt;
  const canRecover = isStuck;
  const canResume = task.last_attempt_failed && !task.has_in_progress_attempt;
  const canViewPR = !!(task.prUrl || task.pr_url);
  const canArchive = task.status === "completed" && !task.archivedAt;

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
      showMoreMenu
      renderMoreMenu={(onOpenChange) => (
        <TaskCardMenu
          task={task}
          actions={actions}
          columnStatuses={columnStatuses}
          onOpenChange={onOpenChange}
        />
      )}
    >
      <TaskCardContent
        task={task}
        onTitleChange={handleTitleChange}
        onStart={canStart ? handleStart : undefined}
        onStop={canStop ? handleStop : undefined}
        onRecover={canRecover ? handleRecoverTask : undefined}
        onResume={canResume ? handleResumeTask : undefined}
        onViewPR={canViewPR ? handleViewPR : undefined}
        onArchive={canArchive ? handleArchive : undefined}
        isSelected={isSelected}
        elapsedTime={isRunning ? elapsedTime : undefined}
      />
    </KanbanCard>
  );
});

TaskCard.displayName = "TaskCard";

export default TaskCard;
