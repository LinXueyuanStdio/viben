/**
 * KanbanListView - Vertical list view of all tasks grouped by column/status
 *
 * Features:
 * - Groups tasks by column with section headers
 * - Shows status indicator, title, priority, category, tags
 * - Stuck detection with visual indicators
 * - Quick actions on hover
 * - Click to select
 *
 * @see docs/plans/2026-03-08-workspace-kanban-refactor-design.md
 */

import { memo, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Clock,
  AlertTriangle,
  XCircle,
  Archive,
  Loader2,
  Play,
  Square,
  RotateCcw,
  GitPullRequest,
} from "lucide-react";
import {
  Badge,
  cn,
  Button,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@viben/ui";
import {
  ListViewItem,
  PriorityIcon,
  TagBadge,
  formatRelativeTime,
  EXECUTION_PHASE_LABELS,
  EXECUTION_PHASE_BADGE_COLORS,
  TASK_CATEGORY_LABELS,
  TASK_CATEGORY_COLORS,
  type Status,
} from "@viben/kanban";
import { useStuckDetection } from "@/hooks/use-stuck-detection";
import {
  STATUS_TO_COLUMN,
  KANBAN_COLUMNS,
  type TaskStatus as VibeTaskStatus,
  type KanbanColumnId,
} from "@/lib/vibe-kanban";
import { CategoryIcons, COLUMN_COLOR_VARS, COLUMN_I18N_KEYS } from "../constants";
import { useElapsedTime, formatElapsedTime } from "../hooks";
import type { EnhancedTask, TaskActions } from "../types";

// ============================================
// Types
// ============================================

export interface KanbanListViewProps {
  /** All tasks to display (will be grouped by status) */
  tasks: EnhancedTask[];
  /** Column status definitions for labels and colors */
  columnStatuses: Status[];
  /** Task action callbacks */
  taskActions: TaskActions;
  /** Currently selected task ID */
  selectedTaskId: string | null;
  /** Callback when task is selected */
  onSelectTask: (id: string) => void;
  /** Workspace path for API calls */
  workspacePath: string;
}

// ============================================
// List Item Component with Stuck Detection
// ============================================

interface ListItemWithStuckDetectionProps {
  task: EnhancedTask;
  workspacePath: string;
  isSelected: boolean;
  onClick: () => void;
  taskActions: TaskActions;
  columnColor: string;
  columnName: string;
}

const ListItemWithStuckDetection = memo(function ListItemWithStuckDetection({
  task,
  workspacePath,
  isSelected,
  onClick,
  taskActions,
  columnColor,
  columnName,
}: ListItemWithStuckDetectionProps) {
  const { t } = useTranslation();

  // Use the enhanced stuck detection hook for real-time detection
  const { isStuck: detectedStuck, isChecking } = useStuckDetection({
    taskId: task.id,
    isRunning: !!task.has_in_progress_attempt,
    workspacePath,
    lastUpdated: task.updated_at,
    stuckThreshold: 60000,
    checkInterval: 30000,
  });

  const isRunning = !!task.has_in_progress_attempt;
  const isFailed = task.last_attempt_failed && !isRunning;
  const isArchived = !!task.archivedAt;

  // Track elapsed time for running tasks
  const { elapsedTime } = useElapsedTime({
    isRunning,
    startTime: task.updated_at,
  });

  // Smart stuck status merge
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

  // Execution phase info
  const executionPhase = task.executionPhase ?? task.execution_phase;
  const hasActiveExecution = executionPhase && executionPhase !== "complete";

  // Relative time
  const relativeTime = useMemo(
    () => (task.updated_at ? formatRelativeTime(task.updated_at) : null),
    [task.updated_at]
  );

  // Get category icon
  const CategoryIcon = task.category ? CategoryIcons[task.category] : null;

  return (
    <ListViewItem
      item={task}
      onClick={onClick}
      isSelected={isSelected}
      className={cn(
        // Running pulse animation - blue border effect
        isRunning && !isStuck && "task-running-pulse ring-2 ring-primary/50",
        // Stuck pulse animation - warning border effect
        isStuck && "task-stuck-pulse ring-2 ring-warning/50",
        // Archived styling
        isArchived && "opacity-60"
      )}
      renderStatus={() => (
        <Badge
          variant="outline"
          className="text-xs whitespace-nowrap"
          style={{
            borderColor: `${columnColor}80`,
            backgroundColor: `${columnColor}1a`,
          }}
        >
          {columnName}
        </Badge>
      )}
    >
      <div className="flex items-center gap-3 w-full min-w-0">
        {/* Priority indicator */}
        {task.kanbanPriority && task.kanbanPriority !== "none" && (
          <div className="shrink-0">
            <PriorityIcon priority={task.kanbanPriority} size="sm" />
          </div>
        )}

        {/* Title and description */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {/* Running indicator */}
            {isRunning && !isStuck && (
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
              </span>
            )}
            <span className="text-sm font-medium truncate">{task.title}</span>
          </div>
          {task.description && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {task.description}
            </p>
          )}
        </div>

        {/* Metadata badges */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Stuck indicator */}
          {isStuck && (
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0.5 flex items-center gap-1 bg-warning/10 text-warning border-warning/30"
            >
              <AlertTriangle className="h-2.5 w-2.5" />
              {t("workspace.taskCard.stuck", "Stuck")}
            </Badge>
          )}

          {/* Failed indicator */}
          {isFailed && !isStuck && (
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0.5 flex items-center gap-1 bg-destructive/10 text-destructive border-destructive/30"
            >
              <XCircle className="h-2.5 w-2.5" />
              {t("workspace.failed")}
            </Badge>
          )}

          {/* Archived indicator */}
          {isArchived && (
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0.5 flex items-center gap-1 bg-muted text-muted-foreground border-border"
            >
              <Archive className="h-2.5 w-2.5" />
              {t("workspace.taskCard.archived", "Archived")}
            </Badge>
          )}

          {/* Execution phase badge */}
          {hasActiveExecution && executionPhase && !isStuck && !isFailed && (
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] px-1.5 py-0.5 flex items-center gap-1",
                EXECUTION_PHASE_BADGE_COLORS[executionPhase]
              )}
            >
              <Loader2 className="h-2.5 w-2.5 animate-spin" />
              {t(`workspace.taskCard.phase.${executionPhase}`, EXECUTION_PHASE_LABELS[executionPhase])}
            </Badge>
          )}

          {/* Category badge */}
          {task.category && CategoryIcon && (
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] px-1.5 py-0.5 flex items-center gap-1",
                TASK_CATEGORY_COLORS[task.category]
              )}
            >
              <CategoryIcon className="h-2.5 w-2.5" />
              {t(`workspace.taskCard.category.${task.category}`, TASK_CATEGORY_LABELS[task.category])}
            </Badge>
          )}

          {/* Tags (max 2 in list view) */}
          {task.tags && task.tags.length > 0 && (
            <div className="flex items-center gap-1">
              {task.tags.slice(0, 2).map((tag) => (
                <TagBadge key={tag.id} tag={tag} size="sm" />
              ))}
              {task.tags.length > 2 && (
                <span className="text-[10px] text-muted-foreground">
                  +{task.tags.length - 2}
                </span>
              )}
            </div>
          )}

          {/* Running elapsed time (takes precedence) or relative time */}
          {isRunning && elapsedTime > 0 ? (
            <div className="flex items-center gap-1 text-[10px] text-primary font-medium">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>{formatElapsedTime(elapsedTime)}</span>
            </div>
          ) : relativeTime && (
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>{relativeTime}</span>
            </div>
          )}
        </div>

        {/* Quick actions - visible on touch devices, hover-to-show on desktop */}
        <div className="flex items-center gap-1 shrink-0 opacity-60 md:opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
          {/* Stuck - Recover button */}
          {isStuck && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-warning hover:bg-warning/10"
                    onClick={(e) => {
                      e.stopPropagation();
                      taskActions.onRecover(task.id);
                    }}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  {t("workspace.taskCard.recover", "Recover")}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {/* Failed - Resume button */}
          {isFailed && !isStuck && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={(e) => {
                      e.stopPropagation();
                      taskActions.onResume(task.id);
                    }}
                  >
                    <Play className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  {t("workspace.taskCard.resume", "Resume")}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {/* Running - Stop button */}
          {isRunning && !isStuck && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:bg-destructive/10"
                    onClick={(e) => {
                      e.stopPropagation();
                      taskActions.onStop(task.id);
                    }}
                  >
                    <Square className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  {t("workspace.taskCard.stop", "Stop")}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {/* Backlog/Queue - Start button */}
          {!isRunning && !isFailed && (task.status === "backlog" || task.status === "queue") && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={(e) => {
                      e.stopPropagation();
                      taskActions.onStart(task.id);
                    }}
                  >
                    <Play className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  {t("workspace.taskCard.start", "Start")}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {/* Completed with PR - View PR */}
          {task.status === "completed" && (task.prUrl || task.pr_url) && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={(e) => {
                      e.stopPropagation();
                      taskActions.onViewPR(task.prUrl || task.pr_url || "");
                    }}
                  >
                    <GitPullRequest className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  {t("workspace.taskCard.viewPR", "View PR")}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {/* Completed - Archive button */}
          {task.status === "completed" && !isArchived && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={(e) => {
                      e.stopPropagation();
                      taskActions.onArchive(task.id);
                    }}
                  >
                    <Archive className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  {t("workspace.taskCard.archive", "Archive")}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>
    </ListViewItem>
  );
});

// ============================================
// Main Component
// ============================================

/**
 * KanbanListView - Vertical list view of tasks grouped by column
 *
 * Renders all tasks in a single scrollable list, grouped by their column status.
 * Each group has a header showing column name and task count.
 * Tasks show status badge, title, metadata badges, and quick actions.
 */
export function KanbanListView({
  tasks,
  columnStatuses,
  taskActions,
  selectedTaskId,
  onSelectTask,
  workspacePath,
}: KanbanListViewProps) {
  const { t } = useTranslation();

  // Group tasks by column
  const tasksByColumn = useMemo(() => {
    const grouped: Record<KanbanColumnId, EnhancedTask[]> = {
      backlog: [],
      queue: [],
      in_progress: [],
      paused: [],
      ai_review: [],
      human_review: [],
      completed: [],
      failed: [],
      cancelled: [],
      archived: [],
    };

    for (const task of tasks) {
      const columnId = STATUS_TO_COLUMN[task.status as VibeTaskStatus] as KanbanColumnId;
      if (columnId && grouped[columnId]) {
        grouped[columnId].push(task);
      }
    }

    return grouped;
  }, [tasks]);

  // Get column info helper
  const getColumnInfo = (columnId: KanbanColumnId) => {
    const status = columnStatuses.find((s) => s.id === columnId);
    const colorVar = COLUMN_COLOR_VARS[columnId];
    const i18nKey = COLUMN_I18N_KEYS[columnId];
    return {
      name: status?.name ?? t(`workspace.column.${i18nKey}`, columnId.replace("_", " ")),
      color: status?.color ?? `hsl(var(${colorVar}))`,
      colorVar,
    };
  };

  // Check if there are any tasks
  const totalTasks = tasks.length;

  if (totalTasks === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <p className="text-sm">{t("workspace.noTasks", "No tasks found")}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {KANBAN_COLUMNS.map((columnId) => {
        const columnTasks = tasksByColumn[columnId];
        const columnInfo = getColumnInfo(columnId);

        // Skip empty columns
        if (columnTasks.length === 0) {
          return null;
        }

        return (
          <div key={columnId} className="flex flex-col gap-1">
            {/* Column header */}
            <div
              className="flex items-center gap-2 px-3 py-2 sticky top-0 z-10 backdrop-blur-sm rounded-lg"
              style={{
                backgroundColor: `${columnInfo.color}08`,
              }}
            >
              <div
                className="h-2.5 w-2.5 rounded-full shrink-0"
                style={{
                  backgroundColor: columnInfo.color,
                  boxShadow: `0 0 0 3px ${columnInfo.color}40`,
                }}
              />
              <span
                className="text-sm font-semibold"
                style={{ color: columnInfo.color }}
              >
                {columnInfo.name}
              </span>
              <span
                className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 text-[11px] font-medium rounded-full tabular-nums"
                style={{
                  backgroundColor: `${columnInfo.color}26`,
                  color: columnInfo.color,
                }}
              >
                {columnTasks.length}
              </span>
            </div>

            {/* Tasks list */}
            <div className="flex flex-col border rounded-lg overflow-hidden">
              {columnTasks.map((task) => (
                <div
                  key={task.id}
                  className={cn(
                    "group border-b last:border-b-0",
                    "hover:bg-muted/50 transition-colors duration-150"
                  )}
                >
                  <ListItemWithStuckDetection
                    task={task}
                    workspacePath={workspacePath}
                    isSelected={selectedTaskId === task.id}
                    onClick={() => onSelectTask(task.id)}
                    taskActions={taskActions}
                    columnColor={columnInfo.color}
                    columnName={columnInfo.name}
                  />
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

KanbanListView.displayName = "KanbanListView";
