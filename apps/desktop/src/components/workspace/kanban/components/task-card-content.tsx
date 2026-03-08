/**
 * TaskCardContent - Pure display component for task card content
 *
 * Displays vibe-kanban task with enhanced fields (Auto-Claude style).
 * This component handles the rendering of task metadata, badges,
 * progress indicators, and action buttons.
 *
 * Extracted from workspace-kanban.tsx for better organization and reusability.
 */

import { memo, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Clock,
  AlertTriangle,
  Archive,
  GitPullRequest,
  XCircle,
  Loader2,
  Play,
  Square,
  RotateCcw,
} from "lucide-react";
import {
  Badge,
  cn,
} from "@viben/ui";
import { Button } from "@/components/ui/button";
import {
  PriorityIcon,
  TagBadge,
  AssigneeAvatar,
  DueDateBadge,
  EditableCardTitle,
  formatRelativeTime,
  EXECUTION_PHASE_LABELS,
  EXECUTION_PHASE_BADGE_COLORS,
  TASK_CATEGORY_LABELS,
  TASK_CATEGORY_COLORS,
  TASK_COMPLEXITY_LABELS,
  TASK_COMPLEXITY_COLORS,
  TASK_IMPACT_LABELS,
  TASK_IMPACT_COLORS,
  REVIEW_REASON_LABELS,
  REVIEW_REASON_COLORS,
  type ReviewReason,
} from "@viben/kanban";
import type { TaskCardContentProps, Subtask } from "../types";
import { CategoryIcons } from "../constants";
import { PhaseProgressIndicator } from "../phase-progress-indicator";

/**
 * TaskCardContent - Displays task card content with all metadata and actions
 *
 * Layout:
 * - Row 1: Title with optional priority indicator
 * - Row 2: Description (truncated)
 * - Row 3: Metadata badges (stuck, failed, archived, execution phase, category, etc.)
 * - Row 4: Tags (max 3)
 * - Row 5: Phase progress indicator with subtask visualization
 * - Row 6: Footer - time, assignee, due date, and action buttons
 */
export const TaskCardContent = memo(function TaskCardContent({
  task,
  onTitleChange,
  onStart,
  onStop,
  onRecover,
  onResume,
  onViewPR,
  onArchive,
  isSelected,
}: TaskCardContentProps) {
  const { t } = useTranslation();

  // Determine card state
  const isRunning = task.has_in_progress_attempt;
  const isStuck = task.isStuck ?? task.is_stuck ?? false;
  const isArchived = !!task.archivedAt;
  const isFailed = task.last_attempt_failed && !isRunning;

  // Determine if execution phase badge should show
  // ExecutionPhase: "planning" | "coding" | "qa_review" | "qa_fixing" | "complete"
  const executionPhase = task.executionPhase ?? task.execution_phase;
  const hasActiveExecution = executionPhase && executionPhase !== "complete";

  // Determine review reason info
  const effectiveReviewReason: ReviewReason | undefined =
    executionPhase === "complete" ? "completed" : task.reviewReason;
  const reviewReasonInfo = effectiveReviewReason
    ? REVIEW_REASON_COLORS[effectiveReviewReason]
    : null;

  // Check if we have metadata badges to show
  const hasMetadataBadges =
    isStuck ||
    isFailed ||
    isArchived ||
    hasActiveExecution ||
    reviewReasonInfo ||
    task.category ||
    (task.impact && (task.impact === "high" || task.impact === "critical")) ||
    task.complexity;

  // Check if we have footer content
  const hasFooter =
    task.updated_at ||
    task.kanbanAssignee ||
    task.dueDate ||
    isStuck ||
    isFailed ||
    (task.status === "done" && (task.prUrl || task.pr_url));

  // Memoize relative time
  const relativeTime = useMemo(
    () => (task.updated_at ? formatRelativeTime(task.updated_at) : null),
    [task.updated_at]
  );

  return (
    <div
      className={cn(
        "flex flex-col gap-2 min-w-0 transition-all duration-200",
        // Card state styles (applied to inner content for visual feedback)
        isRunning && !isStuck && "task-running-content",
        isStuck && "task-stuck-content",
        isArchived && "opacity-60",
        isSelected && "bg-accent/5"
      )}
    >
      {/* Row 1: Title with optional priority indicator */}
      <div className="flex items-start gap-2">
        {task.kanbanPriority && task.kanbanPriority !== "none" && (
          <div className="shrink-0 mt-0.5">
            <PriorityIcon priority={task.kanbanPriority} size="sm" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          {onTitleChange ? (
            <EditableCardTitle
              value={task.title}
              onChange={onTitleChange}
              className="text-sm font-semibold leading-snug"
            />
          ) : (
            <span className="text-sm font-semibold leading-snug line-clamp-2">
              {task.title}
            </span>
          )}
        </div>
      </div>

      {/* Row 2: Description (truncated) */}
      {task.description && (
        <p className="text-xs text-muted-foreground/80 m-0 line-clamp-2 leading-relaxed">
          {task.description}
        </p>
      )}

      {/* Row 3: Metadata badges (Auto-Claude style) */}
      {hasMetadataBadges && (
        <div className="flex flex-wrap gap-1.5 mt-0.5">
          {/* Stuck indicator - highest priority */}
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

          {/* Execution phase badge - shown when actively running */}
          {hasActiveExecution && executionPhase && !isStuck && !isFailed && (
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] px-1.5 py-0.5 flex items-center gap-1",
                EXECUTION_PHASE_BADGE_COLORS[executionPhase]
              )}
            >
              <Loader2 className="h-2.5 w-2.5 animate-spin" />
              {t(
                `workspace.taskCard.phase.${executionPhase}`,
                EXECUTION_PHASE_LABELS[executionPhase]
              )}
            </Badge>
          )}

          {/* Review reason badge */}
          {reviewReasonInfo &&
            effectiveReviewReason &&
            !isStuck &&
            !isFailed &&
            !hasActiveExecution && (
              <Badge
                variant="outline"
                className={cn("text-[10px] px-1.5 py-0.5", reviewReasonInfo.className)}
              >
                {t(
                  `workspace.taskCard.reviewReason.${effectiveReviewReason}`,
                  REVIEW_REASON_LABELS[effectiveReviewReason]
                )}
              </Badge>
            )}

          {/* Category badge with icon */}
          {task.category && (
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] px-1.5 py-0.5 flex items-center gap-1",
                TASK_CATEGORY_COLORS[task.category]
              )}
            >
              {CategoryIcons[task.category] &&
                (() => {
                  const Icon = CategoryIcons[task.category!];
                  return <Icon className="h-2.5 w-2.5" />;
                })()}
              {t(
                `workspace.taskCard.category.${task.category}`,
                TASK_CATEGORY_LABELS[task.category]
              )}
            </Badge>
          )}

          {/* Impact badge - only show high/critical */}
          {task.impact &&
            (task.impact === "high" || task.impact === "critical") && (
              <Badge
                variant="outline"
                className={cn("text-[10px] px-1.5 py-0.5", TASK_IMPACT_COLORS[task.impact])}
              >
                {t(
                  `workspace.taskCard.impact.${task.impact}`,
                  TASK_IMPACT_LABELS[task.impact]
                )}
              </Badge>
            )}

          {/* Complexity badge */}
          {task.complexity && (
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] px-1.5 py-0.5",
                TASK_COMPLEXITY_COLORS[task.complexity]
              )}
            >
              {t(
                `workspace.taskCard.complexity.${task.complexity}`,
                TASK_COMPLEXITY_LABELS[task.complexity]
              )}
            </Badge>
          )}
        </div>
      )}

      {/* Row 4: Tags (max 3) */}
      {task.tags && task.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {task.tags.slice(0, 3).map((tag) => (
            <TagBadge key={tag.id} tag={tag} size="sm" />
          ))}
          {task.tags.length > 3 && (
            <span className="text-[10px] text-muted-foreground/60 ml-0.5">
              +{task.tags.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Row 5: Phase progress indicator with subtask visualization */}
      {((task.subtasks_detail && task.subtasks_detail.length > 0) ||
        (executionPhase && executionPhase !== "complete" && isRunning)) && (
        <PhaseProgressIndicator
          phase={executionPhase}
          subtasks={task.subtasks_detail as Subtask[] | undefined}
          phaseProgress={task.execution_progress?.phaseProgress}
          isStuck={isStuck}
          isRunning={isRunning}
        />
      )}

      {/* Row 6: Footer - time, assignee, due date, and action buttons */}
      {hasFooter && (
        <div className="flex items-center justify-between gap-1.5 pt-1.5 mt-0.5 border-t border-border/30">
          {/* Left side: Time, Assignee, Due Date */}
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            {/* Relative time */}
            {relativeTime && (
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground shrink-0">
                <Clock className="h-3 w-3" />
                <span>{relativeTime}</span>
              </div>
            )}

            {/* Assignee */}
            {task.kanbanAssignee && (
              <AssigneeAvatar assignee={task.kanbanAssignee} size="sm" />
            )}

            {/* Due Date */}
            {task.dueDate && <DueDateBadge dueDate={task.dueDate} />}
          </div>

          {/* Right side: Action buttons based on state (Auto-Claude style) */}
          <div className="flex items-center gap-1 shrink-0">
            {/* Priority 1: Stuck - Show Recover button */}
            {isStuck && onRecover ? (
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2.5 text-warning border-warning/30 hover:bg-warning/10"
                onClick={(e) => {
                  e.stopPropagation();
                  onRecover();
                }}
              >
                <RotateCcw className="h-3 w-3 mr-1.5" />
                {t("workspace.taskCard.recover", "Recover")}
              </Button>
            ) : /* Priority 2: Failed/Incomplete - Show Resume button */
            isFailed && !isStuck && onResume ? (
              <Button
                variant="default"
                size="sm"
                className="h-7 px-2.5"
                onClick={(e) => {
                  e.stopPropagation();
                  onResume();
                }}
              >
                <Play className="h-3 w-3 mr-1.5" />
                {t("workspace.taskCard.resume", "Resume")}
              </Button>
            ) : /* Priority 3: Done with PR - Show View PR and Archive buttons */
            task.status === "done" && (task.prUrl || task.pr_url) ? (
              <div className="flex gap-1">
                {onViewPR && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      onViewPR();
                    }}
                    title={t("workspace.taskCard.viewPR", "View PR")}
                  >
                    <GitPullRequest className="h-3 w-3" />
                  </Button>
                )}
                {!isArchived && onArchive && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      onArchive();
                    }}
                    title={t("workspace.taskCard.archive", "Archive")}
                  >
                    <Archive className="h-3 w-3" />
                  </Button>
                )}
              </div>
            ) : /* Priority 4: Done without PR - Show Archive button */
            task.status === "done" && !isArchived && onArchive ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2.5 hover:bg-muted-foreground/10"
                onClick={(e) => {
                  e.stopPropagation();
                  onArchive();
                }}
                title={t("workspace.taskCard.archive", "Archive")}
              >
                <Archive className="h-3 w-3 mr-1.5" />
                {t("workspace.taskCard.archive", "Archive")}
              </Button>
            ) : /* Priority 5: Backlog/Queue/In Progress - Show Start/Stop button */
            (task.status === "backlog" ||
              task.status === "queue" ||
              task.status === "in_progress") &&
              (onStart || onStop) ? (
              isRunning ? (
                onStop && (
                  <Button
                    variant="destructive"
                    size="sm"
                    className="h-7 px-2.5"
                    onClick={(e) => {
                      e.stopPropagation();
                      onStop();
                    }}
                  >
                    <Square className="h-3 w-3 mr-1.5" />
                    {t("workspace.taskCard.stop", "Stop")}
                  </Button>
                )
              ) : (
                onStart && (
                  <Button
                    variant="default"
                    size="sm"
                    className="h-7 px-2.5"
                    onClick={(e) => {
                      e.stopPropagation();
                      onStart();
                    }}
                  >
                    <Play className="h-3 w-3 mr-1.5" />
                    {t("workspace.taskCard.start", "Start")}
                  </Button>
                )
              )
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
});

export default TaskCardContent;
