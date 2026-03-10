/**
 * KanbanColumn - Expanded kanban column with header and task list
 *
 * Full-width column component that displays:
 * - ColumnHeader with controls (collapse, lock, add task, etc.)
 * - Scrollable list of TaskCard components
 * - Drop zone for drag-and-drop
 * - Resize handle on the right edge
 *
 * Uses KanbanBoard from @viben/kanban which internally handles
 * the droppable behavior via @dnd-kit/core.
 */

import { useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { GripVertical } from "lucide-react";
import {
  KanbanBoard,
  KanbanHeader,
  KanbanCards,
  SelectableCard,
} from "@viben/kanban";
import { cn } from "@viben/ui";
import { useTranslation } from "react-i18next";

import type { ColumnState, EnhancedTask, TaskActions } from "../types";

// ============================================
// Props Types
// ============================================

/**
 * Props for the ColumnHeader component (from the same directory)
 * Used to pass through header configuration
 */
export interface ColumnHeaderConfig {
  onAddTask: () => void;
  onCollapse: () => void;
  onToggleLock: () => void;
  onQueueAll?: () => void;
  onArchiveAll?: () => void;
  onToggleArchived?: () => void;
  onOpenQueueSettings?: () => void;
  selection: {
    allSelected: boolean;
    someSelected: boolean;
    onToggle: () => void;
  };
  capacity?: { current: number; max: number };
  archivedCount?: number;
  showArchived?: boolean;
}

/**
 * Props for TaskCard rendering
 */
export interface TaskCardConfig {
  workspacePath: string;
  selectedTaskId: string | null;
  isSelecting: boolean;
  onCardClick: (taskId: string) => void;
  onToggleSelect: (taskId: string) => void;
  isMultiSelected: (taskId: string) => boolean;
  actions: TaskActions;
  columnStatuses: Array<{ id: string; name: string }>;
  renderTaskCard: (
    task: EnhancedTask,
    index: number,
    columnId: string
  ) => React.ReactNode;
}

/**
 * Empty state configuration for a column
 */
export interface EmptyStateConfig {
  /** Main message to display when empty */
  message: string;
  /** Secondary hint text */
  hint: string;
  /** Custom icon to display */
  icon?: React.ReactNode;
  /** Text to show when dragging over */
  dropText?: string;
}

/**
 * Props for KanbanColumn component
 */
export interface KanbanColumnProps {
  /** Column state data */
  column: ColumnState;
  /** Task card rendering configuration */
  taskConfig: TaskCardConfig;
  /** Header configuration (will be rendered by parent via renderHeader) */
  renderHeader: () => React.ReactNode;
  /** Whether any task is currently being dragged */
  isDragging: boolean;
  /** Whether this column is a valid drop target */
  isValidDropTarget: boolean;
  /** Callback when resize handle is activated */
  onStartResize: (startX: number) => void;
  /** Whether this column is currently being resized */
  isResizing: boolean;
  /** Whether this column's width is locked */
  isLocked: boolean;
  /** Empty state configuration */
  emptyState?: EmptyStateConfig;
}

// ============================================
// Animation Configuration
// ============================================

const cardAnimationVariants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, scale: 0.95 },
};

const cardTransition = {
  duration: 0.2,
  ease: [0.2, 0, 0, 1] as const,
};

// ============================================
// Component
// ============================================

/**
 * KanbanColumn - Full expanded column with header, tasks, and resize handle
 *
 * This component combines:
 * - KanbanBoard (droppable container)
 * - KanbanHeader (sticky header)
 * - KanbanCards (scrollable task list)
 * - Resize handle (right edge)
 */
export function KanbanColumn({
  column,
  taskConfig,
  renderHeader,
  isDragging,
  isValidDropTarget,
  onStartResize,
  isResizing,
  isLocked,
  emptyState,
}: KanbanColumnProps) {
  const { t } = useTranslation();

  // Mouse resize handler
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!isLocked) {
        e.preventDefault();
        e.stopPropagation();
        onStartResize(e.clientX);
      }
    },
    [isLocked, onStartResize]
  );

  // Touch resize handler
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (!isLocked && e.touches.length > 0) {
        e.preventDefault();
        onStartResize(e.touches[0].clientX);
      }
    },
    [isLocked, onStartResize]
  );

  return (
    <div
      className={cn(
        "relative flex flex-col min-h-0 h-full",
        isResizing && "select-none"
      )}
      style={{
        width: `${column.width}px`,
        minWidth: `${column.width}px`,
      }}
    >
      {/* Droppable board container */}
      <KanbanBoard
        id={column.id}
        backgroundColor={column.colorVar}
        isDragging={isDragging}
        isValidDropTarget={isValidDropTarget}
      >
        {(isOver: boolean) => (
          <>
            {/* Column header */}
            <KanbanHeader>{renderHeader()}</KanbanHeader>

            {/* Scrollable task cards */}
            <KanbanCards
              className="flex-1 overflow-y-auto"
              emptyMessage={emptyState?.message ?? t("workspace.noTasks", "No tasks")}
              emptyHint={emptyState?.hint ?? t(
                "workspace.emptyColumnHint",
                "Drag tasks here or click + to create"
              )}
              emptyIcon={emptyState?.icon}
              isOver={isOver && isValidDropTarget !== false}
              dropHereText={emptyState?.dropText ?? t("workspace.dropHere", "Drop here")}
            >
              <AnimatePresence initial={false}>
                {column.tasks.map((task, index) => (
                  <motion.div
                    key={task.id}
                    variants={cardAnimationVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    transition={{
                      ...cardTransition,
                      delay: index * 0.02,
                    }}
                  >
                    <SelectableCard
                      id={task.id}
                      isSelected={taskConfig.isMultiSelected(task.id)}
                      isSelecting={taskConfig.isSelecting}
                      onToggle={taskConfig.onToggleSelect}
                    >
                      {taskConfig.renderTaskCard(task, index, column.id)}
                    </SelectableCard>
                  </motion.div>
                ))}
              </AnimatePresence>
            </KanbanCards>
          </>
        )}
      </KanbanBoard>

      {/* Resize handle - right edge */}
      <div
        className={cn(
          "absolute top-0 right-0 w-1 h-full z-30 touch-none",
          "group",
          isLocked ? "cursor-not-allowed" : "cursor-col-resize",
          isResizing && "bg-primary/50"
        )}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        role="separator"
        aria-orientation="vertical"
        aria-label={t("workspace.resizeColumn", {
          name: column.name,
          defaultValue: `Resize ${column.name} column`,
        })}
        title={
          isLocked
            ? t("workspace.columnLocked", "Column width is locked")
            : undefined
        }
      >
        {/* Wider invisible hit area for easier grabbing */}
        <div className="absolute inset-y-0 -left-1 -right-1" />

        {/* Visual indicator on hover */}
        <div
          className={cn(
            "absolute top-0 right-0 w-1 h-full",
            "bg-transparent transition-colors duration-150",
            !isLocked && "group-hover:bg-primary/40",
            isResizing && !isLocked && "bg-primary/60"
          )}
        />

        {/* Grip indicator (visible on hover) */}
        <div
          className={cn(
            "absolute top-1/2 -translate-y-1/2 right-0 w-4 h-8 -mr-1.5",
            "flex items-center justify-center",
            "opacity-0 group-hover:opacity-100 transition-opacity",
            isLocked && "hidden"
          )}
        >
          <GripVertical className="h-4 w-4 text-muted-foreground/60" />
        </div>
      </div>
    </div>
  );
}
