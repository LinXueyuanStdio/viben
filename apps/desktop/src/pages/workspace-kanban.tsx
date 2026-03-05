import { useState, useCallback, useMemo, useEffect, memo } from "react";
import { useParams, Link } from "react-router-dom";
import {
  Loader2,
  FolderOpen,
  Plus,
  AlertCircle,
  RefreshCw,
  Play,
  Square,
  XCircle,
  ArrowLeft,
  BarChart3,
  Keyboard,
  Pencil,
  Copy,
  Trash2,
  MoreHorizontal,
  ChevronsLeft,
  ChevronsRight,
  Maximize2,
  Clock,
  AlertTriangle,
  RotateCcw,
  Archive,
  GitPullRequest,
  Target,
  Bug,
  Wrench,
  FileText,
  Shield,
  Gauge,
  Palette,
  Server,
  TestTube,
  Lock,
  Unlock,
  GripVertical,
  Settings,
  ListPlus,
  Search,
  ArrowUpDown,
  Eye,
  EyeOff,
  LayoutGrid,
  List,
  CheckSquare,
  XSquare,
  ArrowRight,
  Inbox,
  CircleDot,
  CheckCircle2,
  UserCheck,
  Bot,
  SortAsc,
  Table2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Badge,
  cn,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  Checkbox,
} from "@viben/ui";
import {
  KanbanProvider,
  KanbanBoard,
  KanbanCard,
  KanbanCards,
  KanbanHeader,
  KanbanFilterBar,
  useFilteredItems,
  useMultiSelect,
  useKanbanStats,
  useCommandPalette,
  useSortedItems,
  useKanbanPreferences,
  useColumnCollapse,
  useColumnResize,
  PriorityIcon,
  TagBadge,
  AssigneeAvatar,
  DueDateBadge,
  ViewSwitcher,
  ListView,
  ListViewItem,
  TableView,
  type TableColumn,
  BulkActionsBar,
  SelectableCard,
  EditableCardTitle,
  SortModeSelect,
  StatsPanel,
  CommandPalette,
  BoardSettingsDialog,
  type ColumnConfig,
  formatRelativeTime,
  type DragEndEvent,
  type Status,
  type IssuePriority,
  type Tag,
  type Assignee,
  type KanbanFilter,
  type ViewMode,
  type SortMode,
  type SortDirection,
  type Command,
  // Task metadata types and constants
  // type ExecutionPhase, // Using VibeExecutionPhase from vibe-kanban
  type TaskCategory,
  type TaskComplexity,
  type TaskImpact,
  type ReviewReason,
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
} from "@viben/kanban";
import { PageWrapper } from "@/components/layout";
import {
  WorkspaceHeader,
  TaskDetailDialog,
  useKanbanNavigation,
  CreateTaskDialog,
  type CreateTaskData,
  type TaskForPanel,
} from "@/components/workspace";
import { useLocalWorkspaces, useAgents, useModels, useQueueAutoPromotion, useStuckDetection } from "@/hooks";
import {
  useVibeKanbanTasks,
  useUpdateVibeKanbanTaskStatus,
  useUpdateVibeKanbanTask,
  useCreateVibeKanbanTask,
} from "@/hooks/use-vibe-kanban";
import {
  type TaskWithAttemptStatus,
  type TaskStatus as VibeTaskStatus,
  type ReviewReason as VibeReviewReason,
  type ExecutionPhase as VibeExecutionPhase,
  type Subtask,
  type KanbanColumnId,
  STATUS_TO_COLUMN,
  COLUMN_TO_STATUS,
  KANBAN_COLUMNS,
  COLUMN_COLOR_VARS as VIBE_COLUMN_COLOR_VARS,
  COLUMN_COLORS as VIBE_COLUMN_COLORS,
  isValidStatusTransition,
  getValidDropTargets,
} from "@/lib/vibe-kanban";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";
import { useWorkspaceKanbanQueue } from "@/stores/kanban-queue-store";
import { QueueSettingsModal } from "@/components/workspace/kanban/queue-settings-modal";
import { PhaseProgressIndicator } from "@/components/workspace/kanban/phase-progress-indicator";

// Kanban column IDs - using new 6-column layout from Auto-Claude
// backlog → queue → in_progress → ai_review → human_review → done
type ColumnId = KanbanColumnId;

// Column colors mapping (full CSS value for List View)
const COLUMN_COLORS: Record<ColumnId, string> = VIBE_COLUMN_COLORS;

// Column color CSS variables for KanbanHeader
const COLUMN_COLOR_VARS: Record<ColumnId, string> = VIBE_COLUMN_COLOR_VARS;

// Extended task type to support new fields (Auto-Claude style)
// TaskWithAttemptStatus already includes: execution_phase, is_stuck, stuck_duration, archived
// Task already includes: review_reason, pr_url, priority (as string)
interface EnhancedTask extends TaskWithAttemptStatus {
  // Core kanban fields (extended for UI display)
  kanbanPriority?: IssuePriority;  // UI priority type
  tags?: Tag[];
  kanbanAssignee?: Assignee;  // UI assignee type
  dueDate?: string;
  // Execution metadata (using mapped names for consistency)
  executionPhase?: VibeExecutionPhase;  // alias for execution_phase
  category?: TaskCategory;
  complexity?: TaskComplexity;
  impact?: TaskImpact;
  isStuck?: boolean;  // alias for is_stuck
  reviewReason?: VibeReviewReason;  // alias for review_reason
  prUrl?: string;  // alias for pr_url
  archivedAt?: string;  // computed from archived
}

// Category icon mapping (Lucide components)
const CategoryIcons: Record<TaskCategory, React.ElementType> = {
  feature: Target,
  bug_fix: Bug,
  refactoring: Wrench,
  documentation: FileText,
  security: Shield,
  performance: Gauge,
  ui_ux: Palette,
  infrastructure: Server,
  testing: TestTube,
};

// Task Card Content Component - displays vibe-kanban task with enhanced fields (Auto-Claude style)
interface TaskCardContentProps {
  task: EnhancedTask;
  onTitleChange?: (title: string) => void;
  onStart?: () => void;
  onStop?: () => void;
  onRecover?: () => void;
  onResume?: () => void;
  onViewPR?: () => void;
  onArchive?: () => void;
  isSelected?: boolean;
}

const TaskCardContent = memo(function TaskCardContent({
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
  const hasActiveExecution =
    executionPhase &&
    executionPhase !== "complete";

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
              {t(`workspace.taskCard.phase.${executionPhase}`, EXECUTION_PHASE_LABELS[executionPhase])}
            </Badge>
          )}

          {/* Review reason badge */}
          {reviewReasonInfo && effectiveReviewReason && !isStuck && !isFailed && !hasActiveExecution && (
            <Badge
              variant="outline"
              className={cn("text-[10px] px-1.5 py-0.5", reviewReasonInfo.className)}
            >
              {t(`workspace.taskCard.reviewReason.${effectiveReviewReason}`, REVIEW_REASON_LABELS[effectiveReviewReason])}
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
              {CategoryIcons[task.category] && (
                (() => {
                  const Icon = CategoryIcons[task.category!];
                  return <Icon className="h-2.5 w-2.5" />;
                })()
              )}
              {t(`workspace.taskCard.category.${task.category}`, TASK_CATEGORY_LABELS[task.category])}
            </Badge>
          )}

          {/* Impact badge - only show high/critical */}
          {task.impact && (task.impact === "high" || task.impact === "critical") && (
            <Badge
              variant="outline"
              className={cn("text-[10px] px-1.5 py-0.5", TASK_IMPACT_COLORS[task.impact])}
            >
              {t(`workspace.taskCard.impact.${task.impact}`, TASK_IMPACT_LABELS[task.impact])}
            </Badge>
          )}

          {/* Complexity badge */}
          {task.complexity && (
            <Badge
              variant="outline"
              className={cn("text-[10px] px-1.5 py-0.5", TASK_COMPLEXITY_COLORS[task.complexity])}
            >
              {t(`workspace.taskCard.complexity.${task.complexity}`, TASK_COMPLEXITY_LABELS[task.complexity])}
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
      {(task.subtasks_detail && task.subtasks_detail.length > 0) ||
        (executionPhase && executionPhase !== "complete" && isRunning) ? (
        <PhaseProgressIndicator
          phase={executionPhase}
          subtasks={task.subtasks_detail as Subtask[] | undefined}
          phaseProgress={task.execution_progress?.phaseProgress}
          isStuck={isStuck}
          isRunning={isRunning}
        />
      ) : null}

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
            (task.status === "backlog" || task.status === "queue" || task.status === "in_progress") && (onStart || onStop) ? (
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


/**
 * Task Card with real-time stuck detection
 *
 * Wraps KanbanCard and uses useStuckDetection hook for accurate
 * stuck status that considers client activity and process verification.
 */
interface TaskCardWithStuckDetectionProps {
  task: EnhancedTask;
  index: number;
  columnId: string;
  workspacePath: string;
  isSelected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  showMoreMenu?: boolean;
  renderMoreMenu?: (onOpenChange?: (open: boolean) => void) => React.ReactNode;
}

const TaskCardWithStuckDetection = memo(function TaskCardWithStuckDetection({
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
  // Use the enhanced stuck detection hook for real-time detection
  const { isStuck: detectedStuck, isChecking } = useStuckDetection({
    taskId: task.id,
    isRunning: !!task.has_in_progress_attempt,
    workspacePath,
    lastUpdated: task.updated_at,
    // Use shorter threshold for active detection
    stuckThreshold: 60000, // 1 minute
    checkInterval: 30000, // 30 seconds
  });

  const isRunning = !!task.has_in_progress_attempt;

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


/**
 * List View Item with real-time stuck detection
 *
 * Wraps ListViewItem and uses useStuckDetection hook for accurate
 * stuck status that considers client activity and process verification.
 */
interface ListViewItemWithStuckDetectionProps {
  task: EnhancedTask;
  workspacePath: string;
  isSelected: boolean;
  onClick: () => void;
  renderStatus?: (task: EnhancedTask) => React.ReactNode;
  children: React.ReactNode;
}

const ListViewItemWithStuckDetection = memo(function ListViewItemWithStuckDetection({
  task,
  workspacePath,
  isSelected,
  onClick,
  renderStatus,
  children,
}: ListViewItemWithStuckDetectionProps) {
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


// Build column statuses with translations
// Using new 6-column layout: backlog, queue, in_progress, ai_review, human_review, done
function useColumnStatuses(): Status[] {
  const { t } = useTranslation();

  // Map column IDs to i18n keys
  const columnI18nKeys: Record<ColumnId, string> = {
    backlog: "backlog",
    queue: "queue",
    in_progress: "inProgress",
    ai_review: "aiReview",
    human_review: "humanReview",
    done: "done",
  };

  return KANBAN_COLUMNS.map((id) => ({
    id,
    name: t(`workspace.column.${columnI18nKeys[id]}`, id.replace("_", " ")),
    color: COLUMN_COLORS[id],
  }));
}

// Error state component
function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center h-[60vh] text-center px-4">
      <AlertCircle className="h-12 w-12 text-destructive mb-4" />
      <h2 className="text-xl font-semibold mb-2">{t("workspace.connectionError")}</h2>
      <p className="text-muted-foreground mb-4 max-w-md">{message}</p>
      {onRetry && (
        <Button onClick={onRetry}>
          <RefreshCw className="h-4 w-4 mr-2" />
          {t("common.retry")}
        </Button>
      )}
    </div>
  );
}


export function WorkspaceKanbanPage() {
  const { t } = useTranslation();
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const {
    getWorkspace,
    isLoading: isLoadingWorkspaces,
    workspaces,
  } = useLocalWorkspaces();

  // Kanban preferences (persisted to localStorage)
  const {
    preferences,
    updatePreference,
  } = useKanbanPreferences({
    projectId: workspaceId ?? "default",
  });

  // Column collapse state (synced with preferences)
  const {
    collapsedColumns,
    toggleCollapse,
    expandAll,
    isCollapsed,
  } = useColumnCollapse(
    // Initialize from preferences
    preferences.collapsedColumns.reduce<Record<string, boolean>>((acc, id) => ({ ...acc, [id]: true }), {})
  );

  // Sync collapsed columns to preferences
  useEffect(() => {
    const collapsed = Object.entries(collapsedColumns)
      .filter(([_, isCollapsed]) => isCollapsed)
      .map(([id]) => id);
    if (JSON.stringify(collapsed) !== JSON.stringify(preferences.collapsedColumns)) {
      updatePreference("collapsedColumns", collapsed);
    }
  }, [collapsedColumns, preferences.collapsedColumns, updatePreference]);

  // Column resize state (synced with preferences)
  const {
    widths: _columnWidths,
    isResizing,
    getWidth,
    isLocked: isColumnLocked,
    startResize,
    setLockedColumns,
  } = useColumnResize({
    minWidth: 200,
    maxWidth: 600,
    defaultWidth: 280,
    initialWidths: preferences.columnWidths,
    lockedColumns: preferences.lockedColumns,
    onWidthChange: (columnId: string, width: number) => {
      updatePreference("columnWidths", {
        ...preferences.columnWidths,
        [columnId]: width,
      });
    },
  });

  // Toggle column lock
  const toggleColumnLock = useCallback(
    (columnId: string) => {
      const newLocked = preferences.lockedColumns.includes(columnId)
        ? preferences.lockedColumns.filter((id) => id !== columnId)
        : [...preferences.lockedColumns, columnId];
      updatePreference("lockedColumns", newLocked);
      setLockedColumns(newLocked);
    },
    [preferences.lockedColumns, updatePreference, setLockedColumns]
  );

  // UI state
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [filter, setFilter] = useState<KanbanFilter>({});
  // Flag to trigger auto-start when opening task detail panel from "Run" action
  const [autoStartTaskOnOpen, setAutoStartTaskOnOpen] = useState(false);
  // Track dragging state for visual feedback on valid drop targets
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [validDropTargets, setValidDropTargets] = useState<KanbanColumnId[]>([]);

  // Use preferences for view/sort state
  const viewMode = preferences.viewMode;
  const sortMode = preferences.sortMode === "manual" ? "createdAt" : preferences.sortMode as SortMode;
  const sortDirection = preferences.sortDirection;
  const showStats = preferences.showStats;

  // Setters that update preferences
  const setViewMode = useCallback((mode: ViewMode) => {
    updatePreference("viewMode", mode);
  }, [updatePreference]);

  const setSortMode = useCallback((mode: SortMode) => {
    updatePreference("sortMode", mode);
  }, [updatePreference]);

  const setSortDirection = useCallback((direction: SortDirection) => {
    updatePreference("sortDirection", direction);
  }, [updatePreference]);

  const setShowStats = useCallback((show: boolean | ((prev: boolean) => boolean)) => {
    if (typeof show === "function") {
      updatePreference("showStats", show(preferences.showStats));
    } else {
      updatePreference("showStats", show);
    }
  }, [updatePreference, preferences.showStats]);

  // Count collapsed columns for "Expand All" button
  const collapsedCount = Object.values(collapsedColumns).filter(Boolean).length;

  // Create task dialog state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createDialogColumnId, setCreateDialogColumnId] = useState<string>("backlog");

  // Board settings dialog state
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Queue settings modal state
  const [queueSettingsOpen, setQueueSettingsOpen] = useState(false);

  // Toast notifications
  const toast = useToast();

  // Command palette state
  const { isOpen: isCommandPaletteOpen, setIsOpen: setIsCommandPaletteOpen } =
    useCommandPalette();

  const columnStatuses = useColumnStatuses();

  // Build column configs from column statuses
  const columnConfigs = useMemo<ColumnConfig[]>(() => {
    return KANBAN_COLUMNS.map((id, index) => ({
      id,
      name: columnStatuses.find((c) => c.id === id)?.name ?? id,
      color: COLUMN_COLORS[id],
      visible: true,
      order: index,
    }));
  }, [columnStatuses]);

  // Handle column config changes from settings dialog
  const handleColumnsChange = useCallback((_columns: ColumnConfig[]) => {
    // TODO: Implement column reordering and visibility persistence
    // For now, just close the dialog
    setSettingsOpen(false);
  }, []);
  const workspace = workspaceId ? getWorkspace(workspaceId) : undefined;

  // Queue settings and archived tasks store
  const {
    maxParallelTasks,
    setMaxParallelTasks,
    showArchived,
    toggleShowArchived,
    archivedTaskIds,
    archiveTask,
    archiveAllDone,
    // Gateway Queue API integration
    fetchGatewayQueueStatus,
    updateGatewayMaxConcurrency,
    queueAllBacklogTasks,
    isLoadingGatewayStatus,
  } = useWorkspaceKanbanQueue(workspace?.path);

  // Fetch gateway queue status on mount and when workspace changes
  useEffect(() => {
    if (workspace) {
      fetchGatewayQueueStatus();
    }
  }, [workspace, fetchGatewayQueueStatus]);

  // Fetch tasks for the workspace
  const {
    data: tasks,
    isLoading: isLoadingTasks,
    error: tasksError,
    refetch: refetchTasks,
    isFetching: isFetchingTasks,
  } = useVibeKanbanTasks(workspace?.path);

  // Mutations
  const updateTaskStatus = useUpdateVibeKanbanTaskStatus();
  const updateTask = useUpdateVibeKanbanTask();
  const createTask = useCreateVibeKanbanTask();

  // Queue auto-promotion: automatically promote queue -> in_progress when capacity available
  const handlePromoteTask = useCallback(
    async (taskId: string) => {
      if (!workspace) return;
      await updateTaskStatus.mutateAsync({
        taskId,
        status: "in_progress",
        workspacePath: workspace.path,
      });
    },
    [workspace, updateTaskStatus]
  );

  useQueueAutoPromotion({
    tasks: tasks ?? [],
    onPromoteTask: handlePromoteTask,
    enabled: !!workspace,
    workspacePath: workspace?.path,
  });

  // Fetch available agents and models for task creation
  // All agents from useAgents are user-created agents
  const {
    agents,
    defaultAgentId,
    loading: isLoadingAgents,
  } = useAgents({ workspacePath: workspace?.path });

  const {
    models: vibenModels,
    defaultModelId,
    loading: isLoadingModels,
  } = useModels();

  // Transform agents and models for CreateTaskDialog
  const availableAgents = useMemo(() =>
    agents.map((a) => ({
      id: a.id,
      name: a.name,
      description: a.description,
    })),
    [agents]
  );

  const availableModels = useMemo(() =>
    vibenModels
      .filter((m) => m.is_available)
      .map((m) => ({
        id: m.id,
        name: m.name,
        description: undefined, // WorkspaceModel doesn't have description
        provider: m.provider_id,
      })),
    [vibenModels]
  );

  // Apply filtering to tasks
  const filteredTasks = useFilteredItems(tasks ?? [], filter);

  // Apply sorting to filtered tasks
  const sortedTasks = useSortedItems(
    filteredTasks.map((t) => ({
      ...t,
      createdAt: t.created_at,
      updatedAt: t.updated_at,
    })),
    sortMode,
    sortDirection
  );

  // Calculate stats - transform tasks to match StatsItem interface
  // Using basic fields available on all tasks
  const statsItems = useMemo(() =>
    (tasks ?? []).map((t) => ({
      id: t.id,
      status: t.status,
      // priority and dueDate are UI-enriched fields, may not be present
      priority: undefined as IssuePriority | undefined,
      dueDate: undefined as string | undefined,
    })),
    [tasks]
  );
  const stats = useKanbanStats(statsItems);

  // Multi-select for bulk actions (with persistence)
  const {
    selectedIds,
    selectedCount,
    isSelecting,
    toggleSelect,
    isSelected: isMultiSelected,
    selectAll,
    clearSelection,
    toggleSubset,
    isSubsetAllSelected,
    isSubsetSomeSelected,
  } = useMultiSelect(sortedTasks, {
    persistence: {
      projectId: workspaceId ?? "",
      enabled: !!workspaceId,
    },
  });

  // Selected task - transform to TaskForPanel
  const selectedTask = useMemo<TaskForPanel | null>(() => {
    if (!selectedTaskId || !tasks) return null;
    const task = tasks.find((t) => t.id === selectedTaskId);
    if (!task) return null;
    return {
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      // These UI-enriched fields may not be present on backend tasks
      priority: undefined,
      tags: undefined,
      assignee: undefined,
      dueDate: undefined,
      created_at: task.created_at,
      updated_at: task.updated_at,
      session_id: task.session_id,
      agent_id: task.agent_id,
      has_in_progress_attempt: task.has_in_progress_attempt,
      last_attempt_failed: task.last_attempt_failed,
      executor: task.executor,
      // Git worktree/workspace paths
      worktree_path: task.worktree_path,
      workspace_path: task.workspace_path,
    };
  }, [selectedTaskId, tasks]);

  // Available tasks for relationships
  const availableTasks = useMemo(() => {
    return (tasks ?? []).map((t) => ({ id: t.id, title: t.title }));
  }, [tasks]);

  const isPanelOpen = selectedTaskId !== null;

  // Group tasks by column (already sorted)
  // For the Done column, filter out archived tasks unless showArchived is enabled
  const tasksByColumn = useMemo(() => {
    const grouped: Record<string, EnhancedTask[]> = {};

    for (const column of columnStatuses) {
      // Get tasks for this column (map vibe-kanban status to column id)
      let columnTasks = (sortedTasks ?? []).filter((task) => {
        const mappedColumn = STATUS_TO_COLUMN[task.status as VibeTaskStatus];
        return mappedColumn === column.id;
      });

      // For Done column, filter archived tasks unless showArchived is enabled
      if (column.id === "done" && !showArchived) {
        columnTasks = columnTasks.filter((task) => !archivedTaskIds.includes(task.id));
      }

      grouped[column.id] = columnTasks;
    }

    return grouped;
  }, [sortedTasks, columnStatuses, showArchived, archivedTaskIds]);

  // Count archived tasks in Done column (for badge display)
  const archivedDoneCount = useMemo(() => {
    const doneTasks = (sortedTasks ?? []).filter((task) => {
      const mappedColumn = STATUS_TO_COLUMN[task.status as VibeTaskStatus];
      return mappedColumn === "done";
    });
    return doneTasks.filter((task) => archivedTaskIds.includes(task.id)).length;
  }, [sortedTasks, archivedTaskIds]);

  // Handle drag end - move task to new status with transition validation
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      // Clear dragging state first
      setDraggingTaskId(null);
      setValidDropTargets([]);

      const { active, over } = event;

      if (!over || !workspace) return;

      const taskId = active.id as string;
      const newColumnId = over.id as ColumnId;
      const newStatus = COLUMN_TO_STATUS[newColumnId];

      if (!newStatus) return;

      // Get current task
      const task = sortedTasks.find((t) => t.id === taskId);
      if (!task) return;

      const currentStatus = task.status as VibeTaskStatus;
      const currentColumn = STATUS_TO_COLUMN[currentStatus];

      // Skip if same column (just reordering)
      if (currentColumn === newColumnId) return;

      // Validate status transition
      if (!isValidStatusTransition(currentStatus, newColumnId)) {
        // Show toast with invalid transition message
        toast.error(
          t("workspace.invalidTransition", "Cannot move task from {{from}} to {{to}}", {
            from: t(`workspace.column.${currentColumn}`, currentColumn),
            to: t(`workspace.column.${newColumnId}`, newColumnId),
          })
        );
        return;
      }

      const isMovingToInProgress = newStatus === "in_progress" && currentStatus !== "in_progress";

      // Update task status via API
      updateTaskStatus.mutate({
        taskId,
        status: newStatus,
        workspacePath: workspace.path,
      });

      // If moving to in-progress, open detail panel and trigger auto-start
      if (isMovingToInProgress) {
        setSelectedTaskId(taskId);
        setAutoStartTaskOnOpen(true);
      }
    },
    [workspace, updateTaskStatus, sortedTasks, toast, t]
  );

  // Handle drag start - compute valid drop targets for visual feedback
  const handleDragStart = useCallback(
    (activeId: string) => {
      setDraggingTaskId(activeId);
      // Find the task being dragged
      const task = sortedTasks.find((t) => t.id === activeId);
      if (task) {
        const currentStatus = task.status as VibeTaskStatus;
        const targets = getValidDropTargets(currentStatus);
        setValidDropTargets(targets);
      }
    },
    [sortedTasks]
  );

  // Handle drag cancel - clear visual feedback state
  const handleDragCancel = useCallback(() => {
    setDraggingTaskId(null);
    setValidDropTargets([]);
  }, []);

  // Open create task dialog
  const handleAddTask = useCallback(
    (columnId: string) => {
      setCreateDialogColumnId(columnId);
      setCreateDialogOpen(true);
    },
    []
  );

  // Handle create task submission
  const handleCreateTaskSubmit = useCallback(
    async (data: CreateTaskData) => {
      if (!workspace) return;

      const status = COLUMN_TO_STATUS[createDialogColumnId as ColumnId] ?? "backlog";

      try {
        await createTask.mutateAsync({
          workspace_path: workspace.path,
          title: data.title,
          description: data.description ?? null,
          status,
          agent_id: data.agentId,
          model_id: data.modelId,
          branch: data.branch,
          auto_start: data.autoStart,
        });
        toast.success(t("workspace.taskCreated", "Task created successfully"));
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        toast.error(t("workspace.taskCreateFailed", "Failed to create task: {{message}}", { message }));
        throw error; // Re-throw to let the dialog know it failed
      }
    },
    [workspace, createTask, createDialogColumnId, toast, t]
  );

  // Quick add task (with title from QuickTaskInput)
  // TODO: Use this when QuickTaskInput is implemented
  // const handleQuickAddTask = useCallback(
  //   (columnId: string, title: string) => {
  //     if (!workspace) return;
  //     const status = COLUMN_TO_STATUS[columnId as ColumnId] ?? "backlog";
  //     createTask.mutate({
  //       workspace_path: workspace.path,
  //       title,
  //       description: null,
  //       status,
  //     });
  //   },
  //   [workspace, createTask]
  // );

  // Handle inline title edit
  const handleTitleChange = useCallback(
    (taskId: string, newTitle: string) => {
      if (!workspace) return;

      updateTask.mutate({
        taskId,
        data: { title: newTitle },
        workspacePath: workspace.path,
      });
    },
    [workspace, updateTask]
  );

  // Handle task update from detail panel (including session_id binding)
  const handleTaskUpdate = useCallback(
    (updates: Record<string, unknown>) => {
      if (!workspace || !selectedTaskId) return;

      updateTask.mutate({
        taskId: selectedTaskId,
        data: updates,
        workspacePath: workspace.path,
      });
    },
    [workspace, selectedTaskId, updateTask]
  );

  // Handle card click
  const handleCardClick = useCallback((taskId: string) => {
    setSelectedTaskId((prev) => (prev === taskId ? null : taskId));
  }, []);

  // Close detail panel
  const handleClosePanel = useCallback(() => {
    setSelectedTaskId(null);
  }, []);

  // Keyboard navigation
  const {
    handleKeyDown: handleKanbanKeyDown,
    containerRef: keyboardContainerRef,
  } = useKanbanNavigation({
    tasksByColumn,
    columnIds: columnStatuses.map((c) => c.id),
    selectedTaskId,
    onSelectTask: setSelectedTaskId,
    onOpenTask: (task) => setSelectedTaskId(task.id),
    onClosePanel: handleClosePanel,
    enabled: viewMode === "kanban",
  });

  // Focus kanban container when a task is selected via click
  useEffect(() => {
    if (selectedTaskId && keyboardContainerRef.current) {
      keyboardContainerRef.current.focus();
    }
  }, [selectedTaskId, keyboardContainerRef]);

  // Sort change
  const handleSortChange = useCallback(
    (mode: SortMode, direction: SortDirection) => {
      setSortMode(mode);
      setSortDirection(direction);
    },
    []
  );

  // Refresh tasks
  const handleRefresh = useCallback(() => {
    refetchTasks();
  }, [refetchTasks]);

  // Navigate to task (for relationship links)
  const handleNavigateToTask = useCallback((taskId: string) => {
    setSelectedTaskId(taskId);
  }, []);

  // Bulk status change
  const handleBulkStatusChange = useCallback(
    (status: string) => {
      if (!workspace) return;
      const newStatus = COLUMN_TO_STATUS[status as ColumnId];
      if (!newStatus) return;

      // Update all selected tasks
      for (const taskId of selectedIds) {
        updateTaskStatus.mutate({
          taskId,
          status: newStatus,
          workspacePath: workspace.path,
        });
      }
      clearSelection();
    },
    [workspace, selectedIds, updateTaskStatus, clearSelection]
  );

  // Bulk delete (placeholder - would need delete mutation)
  const handleBulkDelete = useCallback(() => {
    // TODO: Implement bulk delete when API is available
    clearSelection();
  }, [clearSelection]);

  // Close more menu helper (for dropdown menu callbacks)
  const closeMoreMenu = useCallback(() => {
    // Dropdown menu handles its own close state
  }, []);

  // Handle move task to column
  const handleMoveToColumn = useCallback(
    (taskId: string, columnId: string) => {
      if (!workspace) return;
      const newStatus = COLUMN_TO_STATUS[columnId as ColumnId];
      if (!newStatus) return;

      updateTaskStatus.mutate({
        taskId,
        status: newStatus,
        workspacePath: workspace.path,
      });
      closeMoreMenu();
    },
    [workspace, updateTaskStatus, closeMoreMenu]
  );

  // Handle duplicate task
  const handleDuplicateTask = useCallback(
    (taskId: string) => {
      if (!workspace) return;
      const task = sortedTasks.find((t) => t.id === taskId);
      if (!task) return;

      createTask.mutate({
        workspace_path: workspace.path,
        title: `${task.title} (copy)`,
        description: task.description ?? null,
        status: task.status,
      });
      closeMoreMenu();
    },
    [workspace, sortedTasks, createTask, closeMoreMenu]
  );

  // Handle delete task (placeholder)
  const handleDeleteTask = useCallback(
    (_taskId: string) => {
      // TODO: Implement delete when API is available
      closeMoreMenu();
    },
    [closeMoreMenu]
  );

  // Handle start task - update status to in_progress (new queue flow)
  const handleStartTask = useCallback(
    (taskId: string) => {
      if (!workspace) return;
      updateTaskStatus.mutate({
        taskId,
        status: "queue", // Add to queue, then automatically picked up
        workspacePath: workspace.path,
      });
      closeMoreMenu();
    },
    [workspace, updateTaskStatus, closeMoreMenu]
  );

  // Queue All - move all backlog tasks to queue
  const handleQueueAll = useCallback(async () => {
    if (!workspace) return;
    const backlogTasks = tasksByColumn["backlog"] ?? [];
    if (backlogTasks.length === 0) return;

    try {
      // Notify Gateway about batch queue operation (for tracking)
      const taskIds = backlogTasks.map((t) => t.id);
      await queueAllBacklogTasks(taskIds);

      // Update task statuses via Kanban API
      for (const task of backlogTasks) {
        updateTaskStatus.mutate({
          taskId: task.id,
          status: "queue",
          workspacePath: workspace.path,
        });
      }
      toast.success(
        t("workspace.queueAllSuccess", "Queued {{count}} tasks", { count: backlogTasks.length })
      );
    } catch (error) {
      console.error("[WorkspaceKanban] Queue all failed:", error);
      // Still update statuses even if Gateway notification failed
      for (const task of backlogTasks) {
        updateTaskStatus.mutate({
          taskId: task.id,
          status: "queue",
          workspacePath: workspace.path,
        });
      }
      toast.success(
        t("workspace.queueAllSuccess", "Queued {{count}} tasks", { count: backlogTasks.length })
      );
    }
  }, [workspace, tasksByColumn, updateTaskStatus, queueAllBacklogTasks, toast, t]);

  // Archive All - archive all done tasks
  const handleArchiveAll = useCallback(() => {
    const doneTasks = tasksByColumn["done"] ?? [];
    const taskIds = doneTasks.map((t) => t.id);
    if (taskIds.length === 0) return;

    archiveAllDone(taskIds);
    toast.success(
      t("workspace.archiveAllSuccess", "Archived {{count}} tasks", { count: taskIds.length })
    );
  }, [tasksByColumn, archiveAllDone, toast, t]);

  // Archive single task
  const handleArchiveTask = useCallback(
    (taskId: string) => {
      archiveTask(taskId);
      toast.success(t("workspace.taskArchived", "Task archived"));
    },
    [archiveTask, toast, t]
  );

  // Stop task - move back to backlog
  const handleStopTask = useCallback(
    (taskId: string) => {
      if (!workspace) return;
      updateTaskStatus.mutate({
        taskId,
        status: "backlog",
        workspacePath: workspace.path,
      });
      toast.success(t("workspace.taskStopped", "Task stopped"));
    },
    [workspace, updateTaskStatus, toast, t]
  );

  // View PR - open in browser
  const handleViewPR = useCallback(
    (prUrl: string) => {
      if (prUrl) {
        window.open(prUrl, "_blank", "noopener,noreferrer");
      }
    },
    []
  );

  // Resume task - for failed/incomplete tasks
  const handleResumeTask = useCallback(
    (taskId: string) => {
      if (!workspace) return;
      updateTaskStatus.mutate({
        taskId,
        status: "queue", // Put back in queue to restart
        workspacePath: workspace.path,
      });
    },
    [workspace, updateTaskStatus]
  );

  // Recover task - for stuck tasks
  const handleRecoverTask = useCallback(
    (taskId: string) => {
      if (!workspace) return;
      updateTaskStatus.mutate({
        taskId,
        status: "queue", // Put back in queue to restart
        workspacePath: workspace.path,
      });
      toast.success(t("workspace.taskRecovered", "Task recovered and restarted"));
    },
    [workspace, updateTaskStatus, toast, t]
  );

  // Command palette commands
  const commands: Command[] = useMemo(
    () => [
      // === Navigation ===
      {
        id: "goto-backlog",
        label: t("workspace.column.backlog", "Backlog"),
        description: t("workspace.commandPalette.gotoBacklogDesc", "Jump to first task in Backlog"),
        icon: <Inbox className="h-4 w-4" />,
        category: "navigation",
        keywords: ["go", "jump", "backlog", "待办"],
        action: () => {
          const tasks = tasksByColumn["backlog"];
          if (tasks && tasks.length > 0) {
            setSelectedTaskId(tasks[0].id);
          }
        },
      },
      {
        id: "goto-queue",
        label: t("workspace.column.queue", "Queue"),
        description: t("workspace.commandPalette.gotoQueueDesc", "Jump to first task in Queue"),
        icon: <ListPlus className="h-4 w-4" />,
        category: "navigation",
        keywords: ["go", "jump", "queue", "队列"],
        action: () => {
          const tasks = tasksByColumn["queue"];
          if (tasks && tasks.length > 0) {
            setSelectedTaskId(tasks[0].id);
          }
        },
      },
      {
        id: "goto-in-progress",
        label: t("workspace.column.inProgress", "In Progress"),
        description: t("workspace.commandPalette.gotoInProgressDesc", "Jump to first task in progress"),
        icon: <CircleDot className="h-4 w-4" />,
        category: "navigation",
        keywords: ["go", "jump", "progress", "running", "进行中"],
        action: () => {
          const tasks = tasksByColumn["in_progress"];
          if (tasks && tasks.length > 0) {
            setSelectedTaskId(tasks[0].id);
          }
        },
      },
      {
        id: "goto-ai-review",
        label: t("workspace.column.aiReview", "AI Review"),
        description: t("workspace.commandPalette.gotoAiReviewDesc", "Jump to first task in AI Review"),
        icon: <Bot className="h-4 w-4" />,
        category: "navigation",
        keywords: ["go", "jump", "ai", "review", "审核"],
        action: () => {
          const tasks = tasksByColumn["ai_review"];
          if (tasks && tasks.length > 0) {
            setSelectedTaskId(tasks[0].id);
          }
        },
      },
      {
        id: "goto-human-review",
        label: t("workspace.column.humanReview", "Human Review"),
        description: t("workspace.commandPalette.gotoHumanReviewDesc", "Jump to first task in Human Review"),
        icon: <UserCheck className="h-4 w-4" />,
        category: "navigation",
        keywords: ["go", "jump", "human", "review", "人工审核"],
        action: () => {
          const tasks = tasksByColumn["human_review"];
          if (tasks && tasks.length > 0) {
            setSelectedTaskId(tasks[0].id);
          }
        },
      },
      {
        id: "goto-done",
        label: t("workspace.column.done", "Done"),
        description: t("workspace.commandPalette.gotoDoneDesc", "Jump to first completed task"),
        icon: <CheckCircle2 className="h-4 w-4" />,
        category: "navigation",
        keywords: ["go", "jump", "done", "complete", "完成"],
        action: () => {
          const tasks = tasksByColumn["done"];
          if (tasks && tasks.length > 0) {
            setSelectedTaskId(tasks[0].id);
          }
        },
      },

      // === Actions ===
      {
        id: "new-task",
        label: t("workspace.addTask", "Add Task"),
        description: t("workspace.commandPalette.newTaskDesc", "Create a new task in Backlog"),
        icon: <Plus className="h-4 w-4" />,
        shortcut: "n",
        category: "action",
        keywords: ["new", "create", "task", "add", "新建", "创建"],
        action: () => handleAddTask("backlog"),
      },
      {
        id: "refresh",
        label: t("common.refresh", "Refresh"),
        description: t("workspace.commandPalette.refreshDesc", "Reload all tasks"),
        icon: <RefreshCw className="h-4 w-4" />,
        shortcut: "r",
        category: "action",
        keywords: ["refresh", "reload", "sync", "刷新", "同步"],
        action: () => handleRefresh(),
      },
      {
        id: "queue-all",
        label: t("workspace.queueAll", "Queue All Backlog Tasks"),
        description: t("workspace.commandPalette.queueAllDesc", "Move all backlog tasks to queue"),
        icon: <ArrowRight className="h-4 w-4" />,
        shortcut: "q",
        category: "action",
        keywords: ["queue", "batch", "all", "backlog", "批量", "队列"],
        action: () => handleQueueAll(),
      },
      {
        id: "queue-settings",
        label: t("workspace.queueSettings", "Queue Settings"),
        description: t("workspace.commandPalette.queueSettingsDesc", "Configure queue concurrency"),
        icon: <Settings className="h-4 w-4" />,
        category: "settings",
        keywords: ["queue", "settings", "config", "concurrency", "配置", "设置"],
        action: () => setQueueSettingsOpen(true),
      },
      {
        id: "archive-done",
        label: t("workspace.archiveAll", "Archive All Done Tasks"),
        description: t("workspace.commandPalette.archiveAllDesc", "Archive all completed tasks"),
        icon: <Archive className="h-4 w-4" />,
        category: "action",
        keywords: ["archive", "done", "complete", "clean", "归档", "清理"],
        action: async () => {
          const doneTasks = tasksByColumn["done"] || [];
          const unarchived = doneTasks.filter((task) => !task.archived);
          if (unarchived.length === 0) {
            toast.info(t("workspace.noTasksToArchive", "No tasks to archive"));
            return;
          }
          for (const task of unarchived) {
            await handleArchiveTask(task.id);
          }
          toast.success(
            t("workspace.archiveAllSuccess", "Archived {count} tasks").replace("{count}", String(unarchived.length))
          );
        },
      },

      // === Selection ===
      {
        id: "select-all",
        label: t("workspace.selectAll", "Select All Tasks"),
        description: t("workspace.commandPalette.selectAllDesc", "Select all visible tasks"),
        icon: <CheckSquare className="h-4 w-4" />,
        shortcut: "a",
        category: "action",
        keywords: ["select", "all", "check", "全选"],
        action: () => selectAll(),
      },
      {
        id: "clear-selection",
        label: t("workspace.clearSelection", "Clear Selection"),
        description: t("workspace.commandPalette.clearSelectionDesc", "Deselect all tasks"),
        icon: <XSquare className="h-4 w-4" />,
        shortcut: "Escape",
        category: "action",
        keywords: ["clear", "deselect", "uncheck", "取消选择"],
        action: () => clearSelection(),
      },

      // === Task Operations (when task selected) ===
      ...(selectedTaskId ? ([
        {
          id: "run-task",
          label: t("workspace.runAgent", "Run Selected Task"),
          description: t("workspace.commandPalette.runTaskDesc", "Start agent for selected task"),
          icon: <Play className="h-4 w-4" />,
          category: "action" as const,
          keywords: ["run", "start", "execute", "agent", "运行", "启动"],
          action: () => {
            const task = sortedTasks.find((t) => t.id === selectedTaskId);
            if (task && !task.has_in_progress_attempt && task.status !== "done") {
              handleStartTask(selectedTaskId);
            }
          },
        },
        {
          id: "stop-task",
          label: t("workspace.stopAgent", "Stop Selected Task"),
          description: t("workspace.commandPalette.stopTaskDesc", "Stop running agent"),
          icon: <Square className="h-4 w-4" />,
          category: "action" as const,
          keywords: ["stop", "cancel", "abort", "agent", "停止", "取消"],
          action: () => {
            const task = sortedTasks.find((t) => t.id === selectedTaskId);
            if (task?.has_in_progress_attempt) {
              handleStopTask(selectedTaskId);
            }
          },
        },
      ] satisfies Command[]) : []),

      // === View ===
      {
        id: "toggle-stats",
        label: showStats
          ? t("workspace.hideStats", "Hide Stats")
          : t("workspace.showStats", "Show Stats"),
        description: t("workspace.commandPalette.toggleStatsDesc", "Toggle statistics panel"),
        icon: showStats ? <EyeOff className="h-4 w-4" /> : <BarChart3 className="h-4 w-4" />,
        category: "view",
        keywords: ["stats", "statistics", "chart", "统计", "图表"],
        action: () => setShowStats((s) => !s),
      },
      {
        id: "view-kanban",
        label: t("workspace.viewKanban", "Kanban View"),
        description: t("workspace.commandPalette.viewKanbanDesc", "Switch to kanban board"),
        icon: <LayoutGrid className="h-4 w-4" />,
        category: "view",
        keywords: ["kanban", "board", "看板"],
        action: () => setViewMode("kanban"),
      },
      {
        id: "view-list",
        label: t("workspace.viewList", "List View"),
        description: t("workspace.commandPalette.viewListDesc", "Switch to list view"),
        icon: <List className="h-4 w-4" />,
        category: "view",
        keywords: ["list", "列表"],
        action: () => setViewMode("list"),
      },
      {
        id: "view-table",
        label: t("workspace.viewTable", "Table View"),
        description: t("workspace.commandPalette.viewTableDesc", "Switch to table view"),
        icon: <Table2 className="h-4 w-4" />,
        category: "view",
        keywords: ["table", "grid", "表格"],
        action: () => setViewMode("table"),
      },
      {
        id: "toggle-archived",
        label: showArchived
          ? t("workspace.hideArchived", "Hide Archived")
          : t("workspace.showArchived", "Show Archived"),
        description: t("workspace.commandPalette.toggleArchivedDesc", "Toggle archived tasks visibility"),
        icon: showArchived ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />,
        category: "view",
        keywords: ["archive", "hidden", "show", "归档", "显示"],
        action: () => toggleShowArchived(),
      },

      // === Filter ===
      {
        id: "clear-filters",
        label: t("workspace.filter.clear", "Clear All Filters"),
        description: t("workspace.commandPalette.clearFiltersDesc", "Reset all filters"),
        icon: <XCircle className="h-4 w-4" />,
        category: "filter",
        keywords: ["clear", "reset", "filter", "清除", "重置"],
        action: () => setFilter({}),
      },
      {
        id: "filter-search",
        label: t("workspace.filter.search", "Search Tasks"),
        description: t("workspace.commandPalette.filterSearchDesc", "Focus on search input"),
        icon: <Search className="h-4 w-4" />,
        shortcut: "/",
        category: "filter",
        keywords: ["search", "find", "filter", "搜索", "查找"],
        action: () => {
          const searchInput = document.querySelector<HTMLInputElement>('[data-filter-search]');
          searchInput?.focus();
        },
      },

      // === Sort ===
      {
        id: "sort-priority",
        label: t("workspace.sort.priority", "Sort by Priority"),
        description: t("workspace.commandPalette.sortPriorityDesc", "High priority first"),
        icon: <SortAsc className="h-4 w-4" />,
        category: "sort",
        keywords: ["sort", "priority", "urgent", "排序", "优先级"],
        action: () => handleSortChange("priority", "desc"),
      },
      {
        id: "sort-duedate",
        label: t("workspace.sort.dueDate", "Sort by Due Date"),
        description: t("workspace.commandPalette.sortDueDateDesc", "Earliest due date first"),
        icon: <Clock className="h-4 w-4" />,
        category: "sort",
        keywords: ["sort", "due", "date", "deadline", "排序", "截止日期"],
        action: () => handleSortChange("dueDate", "asc"),
      },
      {
        id: "sort-title",
        label: t("workspace.sort.name", "Sort by Title"),
        description: t("workspace.commandPalette.sortTitleDesc", "Alphabetical order"),
        icon: <ArrowUpDown className="h-4 w-4" />,
        category: "sort",
        keywords: ["sort", "name", "title", "alphabetical", "排序", "名称"],
        action: () => handleSortChange("title", "asc"),
      },
      {
        id: "sort-created",
        label: t("workspace.sort.created", "Sort by Created Date"),
        description: t("workspace.commandPalette.sortCreatedDesc", "Newest first"),
        icon: <Clock className="h-4 w-4" />,
        category: "sort",
        keywords: ["sort", "created", "date", "new", "排序", "创建时间"],
        action: () => handleSortChange("createdAt", "desc"),
      },
      {
        id: "sort-updated",
        label: t("workspace.sort.updated", "Sort by Updated Date"),
        description: t("workspace.commandPalette.sortUpdatedDesc", "Recently updated first"),
        icon: <Clock className="h-4 w-4" />,
        category: "sort",
        keywords: ["sort", "updated", "modified", "recent", "排序", "更新时间"],
        action: () => handleSortChange("updatedAt", "desc"),
      },
    ],
    [
      t,
      tasksByColumn,
      sortedTasks,
      selectedTaskId,
      handleAddTask,
      handleRefresh,
      handleQueueAll,
      handleArchiveTask,
      handleStartTask,
      handleStopTask,
      selectAll,
      clearSelection,
      showStats,
      showArchived,
      toggleShowArchived,
      filter,
      setFilter,
      handleSortChange,
    ]
  );

  // Loading state for workspace
  if (isLoadingWorkspaces && !workspace) {
    return (
      <PageWrapper>
        <div className="flex flex-col items-center justify-center h-[60vh]">
          <Loader2 className="h-12 w-12 animate-spin text-muted-foreground mb-4" />
          <p className="text-muted-foreground">{t("common.loadingWorkspace", "Loading workspace...")}</p>
        </div>
      </PageWrapper>
    );
  }

  // Not found state
  if (!workspace && workspaces.length > 0) {
    return (
      <PageWrapper>
        <div className="flex flex-col items-center justify-center h-[60vh]">
          <FolderOpen className="h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">
            {t("workspace.notFound")}
          </h2>
          <p className="text-muted-foreground mb-4">
            {t("workspace.notFoundDesc")}
          </p>
          <Button asChild>
            <Link to="/mcp-services/dashboard">
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t("workspace.backToDashboard")}
            </Link>
          </Button>
        </div>
      </PageWrapper>
    );
  }

  // Fallback loading
  if (!workspace) {
    return (
      <PageWrapper>
        <div className="flex flex-col items-center justify-center h-[60vh]">
          <Loader2 className="h-12 w-12 animate-spin text-muted-foreground mb-4" />
          <p className="text-muted-foreground">{t("common.loading")}</p>
        </div>
      </PageWrapper>
    );
  }

  // Error loading tasks
  if (tasksError) {
    return (
      <PageWrapper className="flex flex-col h-full">
        <WorkspaceHeader
          workspace={workspace}
          segments={[{ label: t("workspace.kanban", "Task Board"), href: `/workspace/${workspaceId}/kanban` }]}
          showRefresh={false}
          showRemove={false}
        />
        <ErrorState
          message={
            tasksError instanceof Error
              ? tasksError.message
              : t("workspace.failedToLoadTasks", "Failed to load tasks")
          }
          onRetry={() => refetchTasks()}
        />
      </PageWrapper>
    );
  }

  return (
    <PageWrapper className="flex flex-col h-full">
      {/* Header with breadcrumb */}
      <WorkspaceHeader
        workspace={workspace}
        segments={[{ label: t("workspace.kanban", "Task Board"), href: `/workspace/${workspaceId}/kanban` }]}
        showRefresh={false}
        showRemove={false}
        rightContent={
          <>
            <ViewSwitcher
              value={viewMode}
              onChange={setViewMode}
              labels={{
                kanban: t("workspace.viewMode.kanban", "Kanban"),
                list: t("workspace.viewMode.list", "List"),
                table: t("workspace.viewMode.table", "Table"),
              }}
            />
            <Button
              size="sm"
              onClick={() => handleAddTask(columnStatuses[0]?.id || "backlog")}
              disabled={createTask.isPending}
              className="h-8"
            >
              {createTask.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              {t("workspace.addTask", "Add Task")}
            </Button>
            {/* Board Settings Button */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8"
                    onClick={() => setSettingsOpen(true)}
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  {t("workspace.boardSettings", "Board Settings")}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </>
        }
      />

      {/* Filter and Sort Bar */}
      <div className="px-4 py-2 border-b bg-muted/30">
        <div className="flex items-center gap-4 flex-wrap">
          {/* Filter Bar */}
          <KanbanFilterBar
            filter={filter}
            onChange={setFilter}
            availableTags={[]}
            className="flex-1"
          />

          {/* Separator */}
          <div className="h-6 w-px bg-border" />

          {/* Sort Controls (Phase 3) */}
          <SortModeSelect
            value={sortMode}
            direction={sortDirection}
            onChange={handleSortChange}
          />

          {/* Stats Toggle */}
          <Button
            variant={showStats ? "secondary" : "ghost"}
            size="sm"
            className="h-8"
            onClick={() => setShowStats((s) => !s)}
          >
            <BarChart3 className="h-4 w-4 mr-1" />
            {t("workspace.stats")}
          </Button>

          {/* Expand All Button - shown when 3+ columns are collapsed */}
          {collapsedCount >= 3 && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8"
                    onClick={expandAll}
                  >
                    <Maximize2 className="h-4 w-4 mr-1" />
                    {t("workspace.expandAll", "Expand All")}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  {t("workspace.expandAllHint", "Expand all collapsed columns")}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {/* Keyboard Shortcuts Help */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8"
                  onClick={() => setIsCommandPaletteOpen(true)}
                >
                  <Keyboard className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs">
                <div className="text-xs space-y-1">
                  <p className="font-medium">{t("workspace.keyboardShortcuts")}</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-muted-foreground">
                    <span>{t("workspace.commandPalette.arrowKeys")}</span>
                    <span>{t("workspace.shortcut.navigate")}</span>
                    <span>{t("workspace.commandPalette.enter")}</span>
                    <span>{t("workspace.shortcut.open")}</span>
                    <span>{t("workspace.commandPalette.escape")}</span>
                    <span>{t("workspace.shortcut.close")}</span>
                    <span>{t("workspace.shortcut.cmdK", "Cmd/Ctrl + K")}</span>
                    <span>{t("workspace.shortcut.command")}</span>
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Refresh Button */}
          <Button
            variant="ghost"
            size="sm"
            className="h-8"
            onClick={handleRefresh}
            disabled={isFetchingTasks}
          >
            <RefreshCw
              className={cn("h-4 w-4", isFetchingTasks && "animate-spin")}
            />
          </Button>
        </div>
      </div>

      {/* Stats Panel (Phase 3) */}
      {showStats && (
        <div className="px-4 py-3 border-b bg-muted/20">
          <StatsPanel stats={stats} />
        </div>
      )}

      {/* Loading tasks */}
      {isLoadingTasks ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : viewMode === "kanban" ? (
        /* Kanban View - horizontal scroll when columns exceed width */
        <div
          ref={keyboardContainerRef}
          className="flex-1 h-full overflow-x-auto focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          tabIndex={0}
          onKeyDown={handleKanbanKeyDown}
          role="application"
          aria-label={t("workspace.kanban", "Kanban board")}
        >
          <KanbanProvider
            onDragEnd={handleDragEnd}
            onDragStart={handleDragStart}
            onDragCancel={handleDragCancel}
            renderDragOverlay={(activeId) => {
              if (!activeId) return null;
              const task = sortedTasks.find((t) => t.id === activeId);
              if (!task) return null;
              return (
                <div
                  className="w-[264px] p-3 bg-card rounded-lg border border-border"
                  style={{
                    boxShadow: "0 8px 24px rgba(0,0,0,0.12), 0 4px 8px rgba(0,0,0,0.08)",
                  }}
                >
                  <TaskCardContent task={task} />
                </div>
              );
            }}
          >
            {columnStatuses.map((column) => {
              const columnTasks = tasksByColumn[column.id] ?? [];
              const colorVar = COLUMN_COLOR_VARS[column.id as ColumnId];
              const columnIsCollapsed = isCollapsed(column.id);

              // Render collapsed column as a narrow clickable strip
              if (columnIsCollapsed) {
                return (
                  <div
                    key={column.id}
                    className={cn(
                      "w-12 flex flex-col items-center py-3 cursor-pointer",
                      "bg-muted/30 hover:bg-muted/50 border-r",
                      "transition-all duration-200"
                    )}
                    onClick={() => toggleCollapse(column.id, false)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        toggleCollapse(column.id, false);
                      }
                    }}
                    aria-label={t("workspace.expandColumn", { name: column.name })}
                  >
                    <div
                      className="w-2.5 h-2.5 rounded-full mb-3 shrink-0"
                      style={{ backgroundColor: `hsl(var(${colorVar}))` }}
                    />
                    <span
                      className="text-xs font-medium text-muted-foreground"
                      style={{
                        writingMode: "vertical-rl",
                        textOrientation: "mixed",
                      }}
                    >
                      {column.name}
                    </span>
                    <Badge
                      variant="secondary"
                      className="mt-3 text-xs px-1.5 py-0.5"
                    >
                      {columnTasks.length}
                    </Badge>
                    <ChevronsRight className="h-4 w-4 mt-3 text-muted-foreground" />
                  </div>
                );
              }

              const columnWidth = getWidth(column.id);
              const columnLocked = isColumnLocked(column.id);

              return (
                <div
                  key={column.id}
                  className={cn(
                    "relative flex flex-col min-h-0 h-full",
                    isResizing === column.id && "select-none"
                  )}
                  style={{
                    width: `${columnWidth}px`,
                    minWidth: `${columnWidth}px`,
                  }}
                >
                  <KanbanBoard
                    id={column.id}
                    backgroundColor={colorVar}
                    isDragging={draggingTaskId !== null}
                    isValidDropTarget={validDropTargets.includes(column.id as KanbanColumnId)}
                  >
                    <KanbanHeader>
                      {/* Compute column task IDs for selection */}
                      {(() => {
                        const columnTaskIds = columnTasks.map((t) => t.id);
                        const allSelected = isSubsetAllSelected(columnTaskIds);
                        const someSelected = isSubsetSomeSelected(columnTaskIds);

                        return (
                          <div
                            className={cn(
                              "sticky top-0 z-20 flex shrink-0 items-center gap-2 px-3 py-2.5",
                              "backdrop-blur-sm border-b"
                            )}
                            style={{
                              backgroundColor: `hsl(var(${colorVar}) / 0.08)`,
                              borderColor: `hsl(var(${colorVar}) / 0.15)`,
                            }}
                          >
                            {/* Column-level select all checkbox */}
                            {columnTasks.length > 0 && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="flex items-center">
                                      <Checkbox
                                        checked={allSelected ? true : someSelected ? "indeterminate" : false}
                                        onCheckedChange={() => toggleSubset(columnTaskIds)}
                                        aria-label={allSelected ? t("workspace.deselectAllInColumn", "Deselect all in column") : t("workspace.selectAllInColumn", "Select all in column")}
                                        className="h-4 w-4"
                                      />
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="text-xs">
                                    {allSelected ? t("workspace.deselectAllInColumn", "Deselect all") : t("workspace.selectAllInColumn", "Select all")}
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                            <span className="flex-1 flex items-center gap-2 min-w-0">
                              <div
                                className="h-2.5 w-2.5 rounded-full shrink-0"
                                style={{
                                  backgroundColor: `hsl(var(${colorVar}))`,
                                  boxShadow: `0 0 0 3px hsl(var(${colorVar}) / 0.25)`,
                                }}
                              />
                              <p className="m-0 text-sm font-semibold truncate" style={{ color: `hsl(var(${colorVar}))` }}>
                                {column.name}
                              </p>
                              {/* In Progress column - show capacity indicator */}
                              {column.id === "in_progress" && maxParallelTasks ? (
                                <span
                                  className={cn(
                                    "inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 text-[11px] font-medium rounded-full tabular-nums",
                                    columnTasks.length >= maxParallelTasks
                                      ? "bg-warning/20 text-warning border border-warning/30"
                                      : undefined
                                  )}
                                  style={columnTasks.length < maxParallelTasks ? {
                                    backgroundColor: `hsl(var(${colorVar}) / 0.15)`,
                                    color: `hsl(var(${colorVar}))`,
                                  } : undefined}
                                  title={t("workspace.capacityIndicator", "{{current}} of {{max}} parallel tasks", { current: columnTasks.length, max: maxParallelTasks })}
                                >
                                  {columnTasks.length}/{maxParallelTasks}
                                </span>
                              ) : (
                                <span
                                  className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 text-[11px] font-medium rounded-full tabular-nums"
                                  style={{
                                    backgroundColor: `hsl(var(${colorVar}) / 0.15)`,
                                    color: `hsl(var(${colorVar}))`,
                                  }}
                                >
                                  {columnTasks.length}
                                </span>
                              )}
                            </span>

                            {/* Backlog column - Queue All button */}
                            {column.id === "backlog" && columnTasks.length > 0 && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 rounded-md transition-colors"
                                      style={{ color: "hsl(var(--info))" }}
                                      onClick={handleQueueAll}
                                      aria-label={t("workspace.queueAll", "Queue All")}
                                    >
                                      <ListPlus className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="text-xs">
                                    {t("workspace.queueAll", "Queue All")}
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}

                            {/* Queue column - Settings button */}
                            {column.id === "queue" && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 rounded-md transition-colors hover:bg-info/10"
                                      style={{ color: "hsl(var(--info))" }}
                                      onClick={() => setQueueSettingsOpen(true)}
                                      aria-label={t("workspace.queueSettings", "Queue Settings")}
                                    >
                                      <Settings className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="text-xs">
                                    {t("workspace.queueSettings", "Queue Settings")}
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}

                            {/* Done column - Archive All + Archive Toggle */}
                            {column.id === "done" && (
                              <>
                                {/* Archive All button - only show when there are unarchived tasks */}
                                {columnTasks.length > 0 && !showArchived && (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-6 w-6 rounded-md transition-colors opacity-60 hover:opacity-100"
                                          onClick={handleArchiveAll}
                                          aria-label={t("workspace.archiveAll", "Archive All")}
                                        >
                                          <Archive className="h-3.5 w-3.5" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent side="top" className="text-xs">
                                        {t("workspace.archiveAll", "Archive All")}
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}

                                {/* Archive toggle button - show when there are archived tasks */}
                                {archivedDoneCount > 0 && (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className={cn(
                                            "h-6 w-6 rounded-md transition-colors relative",
                                            showArchived
                                              ? "text-primary bg-primary/10 hover:bg-primary/20"
                                              : "opacity-60 hover:opacity-100"
                                          )}
                                          onClick={toggleShowArchived}
                                          aria-label={showArchived
                                            ? t("workspace.hideArchived", "Hide Archived")
                                            : t("workspace.showArchived", "Show Archived")}
                                        >
                                          <Archive className="h-3.5 w-3.5" />
                                          <span className="absolute -top-1 -right-1 text-[9px] font-medium bg-muted rounded-full min-w-[12px] h-[12px] flex items-center justify-center">
                                            {archivedDoneCount}
                                          </span>
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent side="top" className="text-xs">
                                        {showArchived
                                          ? t("workspace.hideArchived", "Hide Archived")
                                          : t("workspace.showArchived", "Show Archived ({{count}})", { count: archivedDoneCount })}
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}
                              </>
                            )}

                            {/* Add task button - only show for backlog column */}
                            {column.id === "backlog" && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 rounded-md transition-colors"
                                      style={{ color: `hsl(var(${colorVar}))` }}
                                      onClick={() => handleAddTask(column.id)}
                                      aria-label={t("workspace.addTask", "Add Task")}
                                    >
                                      <Plus className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="text-xs">
                                    {t("workspace.addTask", "Add Task")}
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                            {/* Collapse button */}
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 rounded-md transition-colors opacity-60 hover:opacity-100"
                                    style={{ color: `hsl(var(${colorVar}) / 0.7)` }}
                                    onClick={() => toggleCollapse(column.id, true)}
                                    aria-label={t("workspace.collapseColumn", "Collapse column")}
                                  >
                                    <ChevronsLeft className="h-3.5 w-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="text-xs">
                                  {t("workspace.collapseColumn", "Collapse column")}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            {/* Lock button - less common action */}
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className={cn(
                                      "h-6 w-6 rounded-md transition-colors",
                                      columnLocked
                                        ? "text-amber-500 bg-amber-500/10 hover:bg-amber-500/20"
                                        : "opacity-60 hover:opacity-100"
                                    )}
                                    onClick={() => toggleColumnLock(column.id)}
                                    aria-pressed={columnLocked}
                                    aria-label={columnLocked ? t("workspace.unlockColumn", "Unlock column width") : t("workspace.lockColumn", "Lock column width")}
                                  >
                                    {columnLocked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="text-xs">
                                  {columnLocked ? t("workspace.unlockColumn", "Unlock column width") : t("workspace.lockColumn", "Lock column width")}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        );
                      })()}
                    </KanbanHeader>
                  <KanbanCards
                    className="flex-1 overflow-y-auto"
                    emptyMessage={t("workspace.noTasks", "No tasks")}
                    emptyHint={t("workspace.emptyColumnHint", "Drag tasks here or click + to create")}
                  >
                    <AnimatePresence initial={false}>
                      {columnTasks.map((task, index) => (
                        <motion.div
                          key={task.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          transition={{
                            duration: 0.2,
                            ease: [0.2, 0, 0, 1],
                            delay: index * 0.02,
                          }}
                        >
                          <SelectableCard
                            id={task.id}
                            isSelected={isMultiSelected(task.id)}
                            isSelecting={isSelecting}
                            onToggle={toggleSelect}
                          >
                          <TaskCardWithStuckDetection
                            task={task}
                            index={index}
                            columnId={column.id}
                            workspacePath={workspace?.path ?? ""}
                            isSelected={selectedTaskId === task.id}
                            onClick={() => handleCardClick(task.id)}
                            showMoreMenu
                            renderMoreMenu={(onOpenChange) => (
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
                                  {!task.has_in_progress_attempt && task.status !== "done" && (
                                    <>
                                      <DropdownMenuItem
                                        onClick={() => {
                                          handleStartTask(task.id);
                                          setSelectedTaskId(task.id);
                                          setAutoStartTaskOnOpen(true);
                                        }}
                                        className="gap-2"
                                      >
                                        <Play className="h-4 w-4" />
                                        {t("workspace.runAgent", "Run")}
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                    </>
                                  )}
                                  <DropdownMenuItem
                                    onClick={() => setSelectedTaskId(task.id)}
                                    className="gap-2"
                                  >
                                    <Pencil className="h-4 w-4" />
                                    {t("workspace.editTask", "Edit")}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => handleDuplicateTask(task.id)}
                                    className="gap-2"
                                  >
                                    <Copy className="h-4 w-4" />
                                    {t("workspace.duplicateTask", "Duplicate")}
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuLabel className="text-xs text-muted-foreground">
                                    {t("workspace.moveToColumn", "Move to")}
                                  </DropdownMenuLabel>
                                  {columnStatuses.map((col) => {
                                    const isCurrentColumn = STATUS_TO_COLUMN[task.status] === col.id;
                                    return (
                                      <DropdownMenuItem
                                        key={col.id}
                                        onClick={() => handleMoveToColumn(task.id, col.id)}
                                        disabled={isCurrentColumn}
                                        className="gap-2"
                                      >
                                        <span
                                          className="w-2 h-2 rounded-full"
                                          style={{ backgroundColor: COLUMN_COLORS[col.id as ColumnId] }}
                                        />
                                        {col.name}
                                      </DropdownMenuItem>
                                    );
                                  })}
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => handleDeleteTask(task.id)}
                                    className="gap-2 text-destructive focus:text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                    {t("workspace.deleteTask", "Delete")}
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          >
                            <TaskCardContent
                              task={task}
                              onTitleChange={(title) =>
                                handleTitleChange(task.id, title)
                              }
                              onStart={
                                (task.status === "backlog" || task.status === "queue") && !task.has_in_progress_attempt
                                  ? () => handleStartTask(task.id)
                                  : undefined
                              }
                              onStop={
                                task.has_in_progress_attempt
                                  ? () => handleStopTask(task.id)
                                  : undefined
                              }
                              onRecover={
                                task.is_stuck
                                  ? () => handleRecoverTask(task.id)
                                  : undefined
                              }
                              onResume={
                                task.last_attempt_failed && !task.has_in_progress_attempt
                                  ? () => handleResumeTask(task.id)
                                  : undefined
                              }
                              onViewPR={
                                task.pr_url
                                  ? () => handleViewPR(task.pr_url!)
                                  : undefined
                              }
                              onArchive={
                                task.status === "done" && !task.archived
                                  ? () => handleArchiveTask(task.id)
                                  : undefined
                              }
                            />
                          </TaskCardWithStuckDetection>
                          </SelectableCard>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </KanbanCards>
                  </KanbanBoard>
                  {/* Resize handle - right edge */}
                  <div
                    className={cn(
                      "absolute top-0 right-0 w-1 h-full z-30 touch-none",
                      "group",
                      columnLocked ? "cursor-not-allowed" : "cursor-col-resize",
                      isResizing === column.id && "bg-primary/50"
                    )}
                    onMouseDown={(e) => {
                      if (!columnLocked) {
                        e.preventDefault();
                        e.stopPropagation();
                        startResize(column.id, e.clientX);
                      }
                    }}
                    onTouchStart={(e) => {
                      if (!columnLocked && e.touches.length > 0) {
                        e.preventDefault();
                        startResize(column.id, e.touches[0].clientX);
                      }
                    }}
                    role="separator"
                    aria-orientation="vertical"
                    aria-label={`Resize ${column.name} column`}
                    title={columnLocked ? t("workspace.columnLocked", "Column width is locked") : undefined}
                  >
                    {/* Wider invisible hit area for easier grabbing */}
                    <div className="absolute inset-y-0 -left-1 -right-1" />
                    {/* Visual indicator on hover */}
                    <div
                      className={cn(
                        "absolute top-0 right-0 w-1 h-full",
                        "bg-transparent transition-colors duration-150",
                        !columnLocked && "group-hover:bg-primary/40",
                        isResizing === column.id && !columnLocked && "bg-primary/60"
                      )}
                    />
                    {/* Grip indicator */}
                    <div
                      className={cn(
                        "absolute top-1/2 -translate-y-1/2 right-0 w-4 h-8 -mr-1.5",
                        "flex items-center justify-center",
                        "opacity-0 group-hover:opacity-100 transition-opacity",
                        columnLocked && "hidden"
                      )}
                    >
                      <GripVertical className="h-4 w-4 text-muted-foreground/60" />
                    </div>
                  </div>
                </div>
              );
            })}
          </KanbanProvider>
        </div>
      ) : viewMode === "list" ? (
        /* List View */
        <div className="flex-1 h-full overflow-y-auto p-4">
          <ListView
            items={sortedTasks}
            selectedId={selectedTaskId ?? undefined}
            onItemClick={(item) => handleCardClick(item.id)}
            emptyMessage={t("workspace.noTasks", "No tasks found")}
            renderItem={(item, itemIsSelected) => (
              <ListViewItemWithStuckDetection
                task={item}
                workspacePath={workspace?.path ?? ""}
                onClick={() => handleCardClick(item.id)}
                isSelected={itemIsSelected}
                renderStatus={(task: EnhancedTask) => {
                  const mappedColumn = STATUS_TO_COLUMN[task.status as VibeTaskStatus];
                  const column = columnStatuses.find((c) => c.id === mappedColumn);
                  return (
                    <Badge variant="outline" className="text-xs">
                      {column?.name || task.status}
                    </Badge>
                  );
                }}
              >
                <TaskCardContent
                  task={item}
                  onTitleChange={(title) => handleTitleChange(item.id, title)}
                />
              </ListViewItemWithStuckDetection>
            )}
          />
        </div>
      ) : (
        /* Table View */
        <div className="flex-1 h-full overflow-y-auto p-4">
          <TableView
            items={sortedTasks}
            selectedId={selectedTaskId ?? undefined}
            onItemClick={(item) => handleCardClick(item.id)}
            emptyMessage={t("workspace.noTasks", "No tasks found")}
            pagination
            pageSize={50}
            stickyHeader
            hoverable
            columns={[
              {
                id: "title",
                header: t("workspace.taskName", "Task"),
                accessor: (task) => (
                  <div className="flex items-center gap-2 min-w-0">
                    {task.has_in_progress_attempt && (
                      <span className="relative flex h-2 w-2 shrink-0">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                      </span>
                    )}
                    <span className="truncate font-medium">{task.title}</span>
                  </div>
                ),
                sortable: true,
                minWidth: 200,
              },
              {
                id: "status",
                header: t("workspace.status", "Status"),
                accessor: (task) => {
                  const mappedColumn = STATUS_TO_COLUMN[task.status as VibeTaskStatus];
                  const column = columnStatuses.find((c) => c.id === mappedColumn);
                  const colorVar = COLUMN_COLOR_VARS[mappedColumn as ColumnId];
                  return (
                    <Badge
                      variant="outline"
                      className="text-xs whitespace-nowrap"
                      style={{
                        borderColor: `hsl(var(${colorVar}) / 0.5)`,
                        backgroundColor: `hsl(var(${colorVar}) / 0.1)`,
                      }}
                    >
                      {column?.name || task.status}
                    </Badge>
                  );
                },
                sortable: true,
                width: 120,
              },
              {
                id: "priority",
                header: t("workspace.priority.label", "Priority"),
                accessor: (task) => {
                  if (!task.priority || task.priority === "none") {
                    return <span className="text-muted-foreground">-</span>;
                  }
                  return (
                    <div className="flex items-center gap-1.5">
                      <PriorityIcon priority={task.priority as IssuePriority} size="sm" />
                      <span className="capitalize text-xs">{task.priority}</span>
                    </div>
                  );
                },
                sortable: true,
                width: 100,
              },
              {
                id: "agent",
                header: t("workspace.agent", "Agent"),
                accessor: (task) => (
                  <span className="text-xs text-muted-foreground truncate max-w-[150px] block">
                    {task.agent_id || "-"}
                  </span>
                ),
                sortable: true,
                width: 150,
              },
              {
                id: "dueDate",
                header: t("workspace.dueDate", "Due Date"),
                accessor: (task) => {
                  if (!task.due_date) {
                    return <span className="text-muted-foreground">-</span>;
                  }
                  return <DueDateBadge dueDate={new Date(task.due_date)} size="sm" />;
                },
                sortable: true,
                width: 120,
              },
              {
                id: "created",
                header: t("workspace.created", "Created"),
                accessor: (task) => (
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatRelativeTime(new Date(task.created_at))}
                  </span>
                ),
                sortable: true,
                width: 100,
              },
              {
                id: "updated",
                header: t("workspace.updated", "Updated"),
                accessor: (task) => (
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatRelativeTime(new Date(task.updated_at))}
                  </span>
                ),
                sortable: true,
                width: 100,
              },
            ] as TableColumn<EnhancedTask>[]}
            rowClassName={(task) =>
              task.is_stuck ? "bg-destructive/5" : task.has_in_progress_attempt ? "bg-green-500/5" : ""
            }
            labels={{
              showing: t("workspace.table.showing", "Showing"),
              of: t("workspace.table.of", "of"),
              items: t("workspace.table.items", "items"),
              page: t("workspace.table.page", "Page"),
            }}
          />
        </div>
      )}

      {/* Bulk Actions Bar */}
      <BulkActionsBar
        selectedCount={selectedCount}
        totalCount={sortedTasks.length}
        onSelectAll={selectAll}
        onClearSelection={clearSelection}
        onBulkStatusChange={handleBulkStatusChange}
        onBulkDelete={handleBulkDelete}
        statuses={columnStatuses.map((c) => ({ id: c.id, name: c.name, color: c.color }))}
      />

      {/* Command Palette (Cmd+K) (Phase 3) */}
      <CommandPalette
        open={isCommandPaletteOpen}
        onOpenChange={setIsCommandPaletteOpen}
        commands={commands}
        placeholder={t("workspace.commandPalette.placeholder", "Search commands...")}
        labels={{
          noResults: t("workspace.commandPalette.noResults", "No matching commands"),
          navigation: t("workspace.commandPalette.navigation", "Navigation"),
          action: t("workspace.commandPalette.action", "Action"),
          view: t("workspace.commandPalette.view", "View"),
          filter: t("workspace.commandPalette.filter", "Filter"),
          sort: t("workspace.commandPalette.sort", "Sort"),
          settings: t("workspace.commandPalette.settings", "Settings"),
          resultsCount: t("workspace.commandPalette.resultsCount", "{{count}} results"),
          navigate: t("workspace.commandPalette.navigateHint", "navigate"),
          select: t("workspace.commandPalette.selectHint", "select"),
          close: t("workspace.commandPalette.closeHint", "close"),
        }}
      />

      {/* Create Task Dialog */}
      <CreateTaskDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSubmit={handleCreateTaskSubmit}
        defaultColumnId={createDialogColumnId}
        isSubmitting={createTask.isPending}
        availableAgents={availableAgents}
        availableModels={availableModels}
        defaultAgentId={defaultAgentId ?? undefined}
        defaultModelId={defaultModelId ?? undefined}
        isLoadingOptions={isLoadingAgents || isLoadingModels}
      />

      {/* Task Detail Dialog */}
      <TaskDetailDialog
        open={isPanelOpen}
        onOpenChange={(open) => {
          if (!open) handleClosePanel();
        }}
        task={selectedTask}
        onUpdate={handleTaskUpdate}
        onStartTask={handleStartTask}
        availableTasks={availableTasks}
        onNavigateToTask={handleNavigateToTask}
        workspacePath={workspace?.path}
        autoStartOnOpen={autoStartTaskOnOpen}
        onAutoStartConsumed={() => setAutoStartTaskOnOpen(false)}
      />

      {/* Board Settings Dialog */}
      <BoardSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        columns={columnConfigs}
        onColumnsChange={handleColumnsChange}
        translations={{
          title: t("workspace.boardSettingsDialog.title"),
          description: t("workspace.boardSettingsDialog.description"),
          doubleClickToEdit: t("workspace.boardSettingsDialog.doubleClickToEdit"),
          changeColor: t("workspace.boardSettingsDialog.changeColor"),
          deleteColumn: t("workspace.boardSettingsDialog.deleteColumn"),
          noColumns: t("workspace.boardSettingsDialog.noColumns"),
          cancel: t("common.cancel"),
          saveChanges: t("workspace.boardSettingsDialog.saveChanges"),
          colors: {
            gray: t("workspace.colors.gray"),
            blue: t("workspace.colors.blue"),
            yellow: t("workspace.colors.yellow"),
            green: t("workspace.colors.green"),
            red: t("workspace.colors.red"),
            purple: t("workspace.colors.purple"),
            orange: t("workspace.colors.orange"),
            cyan: t("workspace.colors.cyan"),
          },
        }}
      />

      {/* Queue Settings Modal */}
      <QueueSettingsModal
        open={queueSettingsOpen}
        onOpenChange={setQueueSettingsOpen}
        currentMaxParallel={maxParallelTasks}
        onSave={async (value) => {
          // Update Gateway config first, then sync local state
          await updateGatewayMaxConcurrency(value);
          setMaxParallelTasks(value);
        }}
        isSaving={isLoadingGatewayStatus}
      />
    </PageWrapper>
  );
}
