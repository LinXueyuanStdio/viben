/**
 * Column Header Component
 *
 * Renders the header section of a kanban column with:
 * - Column title with color indicator
 * - Task count badge (or capacity indicator for in_progress)
 * - Action buttons (add, collapse, lock, queue all, archive, settings)
 * - Select all checkbox for multi-select mode
 */

import { memo } from "react";
import { useTranslation } from "react-i18next";
import {
  Plus,
  ChevronsLeft,
  Lock,
  Unlock,
  ListPlus,
  Archive,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  cn,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  Checkbox,
} from "@viben/ui";
import type { ColumnState } from "../types";

/**
 * Props for the ColumnHeader component
 */
export interface ColumnHeaderProps {
  /** Column state containing id, name, color, tasks, etc. */
  column: ColumnState;
  /** Callback to add a new task to this column */
  onAddTask: () => void;
  /** Callback to collapse/expand the column */
  onCollapse: () => void;
  /** Callback to toggle column width lock */
  onToggleLock: () => void;
  /** Callback to queue all backlog tasks (only for backlog column) */
  onQueueAll?: () => void;
  /** Callback to archive all done tasks (only for done column) */
  onArchiveAll?: () => void;
  /** Callback to toggle archived tasks visibility (only for done column) */
  onToggleArchived?: () => void;
  /** Callback to open queue settings modal (only for queue column) */
  onOpenQueueSettings?: () => void;
  /** Selection state for multi-select mode */
  selection: {
    /** Whether all tasks in column are selected */
    allSelected: boolean;
    /** Whether some tasks in column are selected */
    someSelected: boolean;
    /** Callback to toggle selection of all tasks in column */
    onToggle: () => void;
  };
  /** Capacity indicator for in_progress column */
  capacity?: {
    /** Current number of tasks */
    current: number;
    /** Maximum parallel tasks allowed */
    max: number;
  };
  /** Number of archived tasks (for done column) */
  archivedCount?: number;
  /** Whether archived tasks are currently shown */
  showArchived?: boolean;
}

/**
 * ColumnHeader component
 *
 * Renders a sticky header for kanban columns with title, count badge,
 * and action buttons appropriate to each column type.
 */
export const ColumnHeader = memo(function ColumnHeader({
  column,
  onAddTask,
  onCollapse,
  onToggleLock,
  onQueueAll,
  onArchiveAll,
  onToggleArchived,
  onOpenQueueSettings,
  selection,
  capacity,
  archivedCount = 0,
  showArchived = false,
}: ColumnHeaderProps) {
  const { t } = useTranslation();
  const { id, name, colorVar, tasks, isLocked } = column;
  const taskCount = tasks.length;

  // Determine which action buttons to show based on column type
  const isBacklog = id === "backlog";
  const isQueue = id === "queue";
  const isInProgress = id === "in_progress";
  const isDone = id === "done";

  // Show capacity indicator for in_progress, otherwise show task count
  const showCapacity = isInProgress && capacity;

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
      {taskCount > 0 && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center">
                <Checkbox
                  checked={
                    selection.allSelected
                      ? true
                      : selection.someSelected
                        ? "indeterminate"
                        : false
                  }
                  onCheckedChange={selection.onToggle}
                  aria-label={
                    selection.allSelected
                      ? t("workspace.deselectAllInColumn", "Deselect all in column")
                      : t("workspace.selectAllInColumn", "Select all in column")
                  }
                  className="h-4 w-4"
                />
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              {selection.allSelected
                ? t("workspace.deselectAllInColumn", "Deselect all")
                : t("workspace.selectAllInColumn", "Select all")}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      {/* Column title and count */}
      <span className="flex-1 flex items-center gap-2 min-w-0">
        {/* Color dot indicator */}
        <div
          className="h-2.5 w-2.5 rounded-full shrink-0"
          style={{
            backgroundColor: `hsl(var(${colorVar}))`,
            boxShadow: `0 0 0 3px hsl(var(${colorVar}) / 0.25)`,
          }}
        />

        {/* Column name */}
        <p
          className="m-0 text-sm font-semibold truncate"
          style={{ color: `hsl(var(${colorVar}))` }}
        >
          {name}
        </p>

        {/* Task count / capacity indicator */}
        {showCapacity ? (
          <CapacityBadge
            current={capacity.current}
            max={capacity.max}
            colorVar={colorVar}
            title={t(
              "workspace.capacityIndicator",
              "{{current}} of {{max}} parallel tasks",
              { current: capacity.current, max: capacity.max }
            )}
          />
        ) : (
          <CountBadge count={taskCount} colorVar={colorVar} />
        )}
      </span>

      {/* Backlog column actions: Queue All + Add Task */}
      {isBacklog && (
        <>
          {taskCount > 0 && onQueueAll && (
            <ActionButton
              icon={ListPlus}
              label={t("workspace.queueAll", "Queue All")}
              onClick={onQueueAll}
              style={{ color: "hsl(var(--info))" }}
            />
          )}
          <ActionButton
            icon={Plus}
            label={t("workspace.addTask", "Add Task")}
            onClick={onAddTask}
            style={{ color: `hsl(var(${colorVar}))` }}
          />
        </>
      )}

      {/* Queue column actions: Settings */}
      {isQueue && onOpenQueueSettings && (
        <ActionButton
          icon={Settings}
          label={t("workspace.queueSettings", "Queue Settings")}
          onClick={onOpenQueueSettings}
          style={{ color: "hsl(var(--info))" }}
          className="hover:bg-info/10"
        />
      )}

      {/* Done column actions: Archive All + Toggle Archived */}
      {isDone && (
        <>
          {/* Archive All button - only show when there are unarchived tasks */}
          {taskCount > 0 && !showArchived && onArchiveAll && (
            <ActionButton
              icon={Archive}
              label={t("workspace.archiveAll", "Archive All")}
              onClick={onArchiveAll}
              className="opacity-60 hover:opacity-100"
            />
          )}

          {/* Archive toggle button - show when there are archived tasks */}
          {archivedCount > 0 && onToggleArchived && (
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
                    onClick={onToggleArchived}
                    aria-label={
                      showArchived
                        ? t("workspace.hideArchived", "Hide Archived")
                        : t("workspace.showArchived", "Show Archived")
                    }
                  >
                    <Archive className="h-3.5 w-3.5" />
                    <span className="absolute -top-1 -right-1 text-[9px] font-medium bg-muted rounded-full min-w-[12px] h-[12px] flex items-center justify-center">
                      {archivedCount}
                    </span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  {showArchived
                    ? t("workspace.hideArchived", "Hide Archived")
                    : t("workspace.showArchived", "Show Archived ({{count}})", {
                        count: archivedCount,
                      })}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </>
      )}

      {/* Collapse button - available for all columns */}
      <ActionButton
        icon={ChevronsLeft}
        label={t("workspace.collapseColumn", "Collapse column")}
        onClick={onCollapse}
        style={{ color: `hsl(var(${colorVar}) / 0.7)` }}
        className="opacity-60 hover:opacity-100"
      />

      {/* Lock button - available for all columns */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-6 w-6 rounded-md transition-colors",
                isLocked
                  ? "text-amber-500 bg-amber-500/10 hover:bg-amber-500/20"
                  : "opacity-60 hover:opacity-100"
              )}
              onClick={onToggleLock}
              aria-pressed={isLocked}
              aria-label={
                isLocked
                  ? t("workspace.unlockColumn", "Unlock column width")
                  : t("workspace.lockColumn", "Lock column width")
              }
            >
              {isLocked ? (
                <Lock className="h-3 w-3" />
              ) : (
                <Unlock className="h-3 w-3" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            {isLocked
              ? t("workspace.unlockColumn", "Unlock column width")
              : t("workspace.lockColumn", "Lock column width")}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
});

// ============================================
// Sub-components
// ============================================

/**
 * Capacity badge for in_progress column showing current/max tasks
 */
interface CapacityBadgeProps {
  current: number;
  max: number;
  colorVar: string;
  title: string;
}

function CapacityBadge({ current, max, colorVar, title }: CapacityBadgeProps) {
  const isAtCapacity = current >= max;

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 text-[11px] font-medium rounded-full tabular-nums",
        isAtCapacity
          ? "bg-warning/20 text-warning border border-warning/30"
          : undefined
      )}
      style={
        !isAtCapacity
          ? {
              backgroundColor: `hsl(var(${colorVar}) / 0.15)`,
              color: `hsl(var(${colorVar}))`,
            }
          : undefined
      }
      title={title}
    >
      {current}/{max}
    </span>
  );
}

/**
 * Simple count badge for columns
 */
interface CountBadgeProps {
  count: number;
  colorVar: string;
}

function CountBadge({ count, colorVar }: CountBadgeProps) {
  return (
    <span
      className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 text-[11px] font-medium rounded-full tabular-nums"
      style={{
        backgroundColor: `hsl(var(${colorVar}) / 0.15)`,
        color: `hsl(var(${colorVar}))`,
      }}
    >
      {count}
    </span>
  );
}

/**
 * Reusable action button with tooltip
 */
interface ActionButtonProps {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  style?: React.CSSProperties;
  className?: string;
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
  style,
  className,
}: ActionButtonProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn("h-6 w-6 rounded-md transition-colors", className)}
            style={style}
            onClick={onClick}
            aria-label={label}
          >
            <Icon className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          {label}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
