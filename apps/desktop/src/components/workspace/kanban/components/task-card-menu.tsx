/**
 * TaskCardMenu - Dropdown menu for task card actions
 *
 * Provides a context menu for task operations:
 * - Run/Start task (for non-running tasks)
 * - Edit task
 * - Duplicate task
 * - Move to column (submenu with valid target columns)
 * - Stop task (for running tasks)
 * - Recover task (for stuck tasks)
 * - Resume task (for failed tasks)
 * - View PR (if PR URL exists)
 * - Archive task (for done tasks)
 * - Delete task
 *
 * @see docs/plans/2026-03-08-workspace-kanban-refactor-design.md
 */

import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  Play,
  Pencil,
  Copy,
  Trash2,
  MoreHorizontal,
  Square,
  RotateCcw,
  Archive,
  GitPullRequest,
} from "lucide-react";
import {
  Button,
  cn,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@viben/ui";
import type { Status } from "@viben/kanban";
import {
  STATUS_TO_COLUMN,
  COLUMN_COLORS,
  type TaskStatus as VibeTaskStatus,
  type KanbanColumnId,
} from "@/lib/vibe-kanban";
import type { EnhancedTask, TaskActions } from "../types";

export interface TaskCardMenuProps {
  /** The task to show menu for */
  task: EnhancedTask;
  /** Task action callbacks */
  actions: TaskActions;
  /** Available column statuses for "Move to" submenu */
  columnStatuses: Status[];
  /** Callback when menu open state changes */
  onOpenChange?: (open: boolean) => void;
  /** Callback when Edit is clicked (typically opens task detail panel) */
  onEdit?: (taskId: string) => void;
}

/**
 * TaskCardMenu component
 *
 * Renders a dropdown menu with task actions. Actions are conditionally
 * shown based on task state (running, stuck, done, has PR, etc.)
 */
export function TaskCardMenu({
  task,
  actions,
  columnStatuses,
  onOpenChange,
  onEdit,
}: TaskCardMenuProps) {
  const { t } = useTranslation();

  // Determine which actions to show based on task state
  const isRunning = task.status === "in_progress";
  const canStart = !isRunning && task.status !== "completed";
  const canStop = isRunning;
  const canRecover = task.is_stuck === true;
  const canResume = task.status === "failed";
  const canArchive = task.status === "completed" && !task.archivedAt;
  // Support both snake_case (from API) and camelCase (from EnhancedTask)
  const prUrl = task.pr_url || task.prUrl;
  const hasPR = Boolean(prUrl);

  // Get current column for disabling in "Move to" menu
  const currentColumn = STATUS_TO_COLUMN[task.status as VibeTaskStatus];

  // Handle start with auto-start flag
  const handleStart = useCallback(() => {
    actions.onStart(task.id);
  }, [actions, task.id]);

  // Handle edit - opens task detail panel
  const handleEdit = useCallback(() => {
    onEdit?.(task.id);
  }, [onEdit, task.id]);

  return (
    <DropdownMenu onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 rounded-md hover:bg-muted/80 text-muted-foreground hover:text-foreground"
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48 z-50" sideOffset={5}>
        {/* Start task - only show for non-running tasks */}
        {canStart && (
          <>
            <DropdownMenuItem onClick={handleStart} className="gap-2">
              <Play className="h-4 w-4" />
              {t("workspace.runAgent", "Run")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}

        {/* Stop task - only show for running tasks */}
        {canStop && (
          <>
            <DropdownMenuItem
              onClick={() => actions.onStop(task.id)}
              className="gap-2"
            >
              <Square className="h-4 w-4" />
              {t("workspace.stopTask", "Stop")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}

        {/* Recover task - only show for stuck tasks */}
        {canRecover && (
          <>
            <DropdownMenuItem
              onClick={() => actions.onRecover(task.id)}
              className="gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              {t("workspace.recoverTask", "Recover")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}

        {/* Resume task - only show for failed tasks */}
        {canResume && (
          <>
            <DropdownMenuItem
              onClick={() => actions.onResume(task.id)}
              className="gap-2"
            >
              <Play className="h-4 w-4" />
              {t("workspace.actions.resumeTask", "Resume Task")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}

        {/* Edit task */}
        <DropdownMenuItem onClick={handleEdit} className="gap-2">
          <Pencil className="h-4 w-4" />
          {t("workspace.editTask", "Edit")}
        </DropdownMenuItem>

        {/* Duplicate task */}
        <DropdownMenuItem
          onClick={() => actions.onDuplicate(task.id)}
          className="gap-2"
        >
          <Copy className="h-4 w-4" />
          {t("workspace.duplicateTask", "Duplicate")}
        </DropdownMenuItem>

        {/* View PR - only show if task has PR URL */}
        {hasPR && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => actions.onViewPR(prUrl!)}
              className="gap-2"
            >
              <GitPullRequest className="h-4 w-4" />
              {t("workspace.actions.viewPR", "View PR")}
            </DropdownMenuItem>
          </>
        )}

        {/* Move to column submenu */}
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          {t("workspace.moveToColumn", "Move to")}
        </DropdownMenuLabel>
        {columnStatuses.map((col) => {
          const isCurrentColumn = currentColumn === col.id;
          const columnColor = COLUMN_COLORS[col.id as KanbanColumnId];
          return (
            <DropdownMenuItem
              key={col.id}
              onClick={() => actions.onMoveToColumn(task.id, col.id as KanbanColumnId)}
              disabled={isCurrentColumn}
              className={cn("gap-2", isCurrentColumn && "opacity-50")}
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: columnColor }}
              />
              {col.name}
            </DropdownMenuItem>
          );
        })}

        {/* Archive task - only show for done tasks */}
        {canArchive && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => actions.onArchive(task.id)}
              className="gap-2"
            >
              <Archive className="h-4 w-4" />
              {t("workspace.archiveTask", "Archive")}
            </DropdownMenuItem>
          </>
        )}

        {/* Delete task */}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => actions.onDelete(task.id)}
          className="gap-2 text-destructive focus:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
          {t("workspace.deleteTask", "Delete")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

TaskCardMenu.displayName = "TaskCardMenu";
