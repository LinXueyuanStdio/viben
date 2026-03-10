/**
 * Kanban Board View Component
 *
 * Main board view that renders columns in a horizontal scrollable container.
 * Handles drag-and-drop for task reordering between columns.
 *
 * Extracted from workspace-kanban.tsx for better maintainability.
 * Uses extracted components: CollapsedColumn, ColumnHeader
 */

import { memo, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  GripVertical,
  Inbox,
  ListTodo,
  Play,
  Pause,
  Eye,
  UserCheck,
  CheckCircle2,
  XCircle,
  Ban,
  Archive,
} from "lucide-react";
import { cn } from "@viben/ui";
import {
  KanbanProvider,
  KanbanBoard,
  KanbanCard,
  KanbanCards,
  KanbanHeader,
  SelectableCard,
} from "@viben/kanban";
import { useTranslation } from "react-i18next";
import type { KanbanColumnId } from "@/lib/vibe-kanban";
import type {
  ColumnState,
  DragDropState,
  ColumnManagement,
  MultiSelectState,
  EnhancedTask,
} from "../types";
import { CollapsedColumn } from "./collapsed-column";
import { ColumnHeader } from "./column-header";

// ============================================
// Empty State Configuration per Column
// ============================================

type EmptyStateConfig = {
  icon: React.ReactNode;
  messageKey: string;
  hintKey: string;
};

const COLUMN_EMPTY_STATES: Record<KanbanColumnId, EmptyStateConfig> = {
  backlog: {
    icon: <Inbox className="h-5 w-5 text-muted-foreground/50" />,
    messageKey: "workspace.emptyBacklog",
    hintKey: "workspace.emptyBacklogHint",
  },
  queue: {
    icon: <ListTodo className="h-5 w-5 text-muted-foreground/50" />,
    messageKey: "workspace.emptyQueue",
    hintKey: "workspace.emptyQueueHint",
  },
  in_progress: {
    icon: <Play className="h-5 w-5 text-muted-foreground/50" />,
    messageKey: "workspace.emptyInProgress",
    hintKey: "workspace.emptyInProgressHint",
  },
  paused: {
    icon: <Pause className="h-5 w-5 text-muted-foreground/50" />,
    messageKey: "workspace.emptyPaused",
    hintKey: "workspace.emptyPausedHint",
  },
  ai_review: {
    icon: <Eye className="h-5 w-5 text-muted-foreground/50" />,
    messageKey: "workspace.emptyAiReview",
    hintKey: "workspace.emptyAiReviewHint",
  },
  human_review: {
    icon: <UserCheck className="h-5 w-5 text-muted-foreground/50" />,
    messageKey: "workspace.emptyHumanReview",
    hintKey: "workspace.emptyHumanReviewHint",
  },
  completed: {
    icon: <CheckCircle2 className="h-5 w-5 text-muted-foreground/50" />,
    messageKey: "workspace.emptyCompleted",
    hintKey: "workspace.emptyCompletedHint",
  },
  failed: {
    icon: <XCircle className="h-5 w-5 text-muted-foreground/50" />,
    messageKey: "workspace.emptyFailed",
    hintKey: "workspace.emptyFailedHint",
  },
  cancelled: {
    icon: <Ban className="h-5 w-5 text-muted-foreground/50" />,
    messageKey: "workspace.emptyCancelled",
    hintKey: "workspace.emptyCancelledHint",
  },
  archived: {
    icon: <Archive className="h-5 w-5 text-muted-foreground/50" />,
    messageKey: "workspace.emptyArchived",
    hintKey: "workspace.emptyArchivedHint",
  },
};

/**
 * Props for KanbanBoardView component
 */
export interface KanbanBoardViewProps {
  /** Array of column states with tasks */
  columns: ColumnState[];
  /** Drag and drop state and handlers */
  dragDrop: DragDropState;
  /** Column management (collapse, resize, lock) */
  columnManagement: ColumnManagement;
  /** Currently selected task ID */
  selectedTaskId: string | null;
  /** Callback to select a task */
  onSelectTask: (id: string | null) => void;
  /** Multi-select state for bulk operations */
  multiSelect: MultiSelectState;
  /** Callback to add a new task to a column */
  onAddTask: (columnId: string) => void;
  /** Callback for "Queue All" backlog action */
  onQueueAll: () => void;
  /** Callback for "Archive All" done action */
  onArchiveAll: () => void;
  /** Callback to toggle archived tasks visibility */
  onToggleArchived: () => void;
  /** Callback to open queue settings modal */
  onOpenQueueSettings: () => void;
  /** Whether archived tasks are shown */
  showArchived: boolean;
  /** Count of archived tasks in done column */
  archivedCount: number;
  /** Maximum parallel tasks setting */
  maxParallelTasks: number | null;
  /** Render task card content */
  renderTaskCard: (
    task: EnhancedTask,
    index: number,
    columnId: string
  ) => React.ReactNode;
  /** Render task card menu */
  renderTaskMenu?: (
    task: EnhancedTask,
    onOpenChange?: (open: boolean) => void
  ) => React.ReactNode;
  /** Render drag overlay content */
  renderDragOverlay?: (task: EnhancedTask | null) => React.ReactNode;
  /** Keyboard navigation handler for the container */
  onKeyDown?: (e: React.KeyboardEvent) => void;
  /** Ref for the keyboard navigation container */
  containerRef?: React.RefObject<HTMLDivElement | null>;
}

/**
 * Kanban Board View - Main board rendering component
 *
 * Features:
 * - Horizontal scrollable container for columns
 * - DndContext provider for drag-and-drop
 * - Column collapse/expand support
 * - Column resize handling
 * - Drop validation with visual feedback
 * - Multi-select support for bulk operations
 */
export const KanbanBoardView = memo(function KanbanBoardView({
  columns,
  dragDrop,
  columnManagement,
  selectedTaskId,
  onSelectTask,
  multiSelect,
  onAddTask,
  onQueueAll,
  onArchiveAll,
  onToggleArchived,
  onOpenQueueSettings,
  showArchived,
  archivedCount,
  maxParallelTasks,
  renderTaskCard,
  renderTaskMenu,
  renderDragOverlay,
  onKeyDown,
  containerRef,
}: KanbanBoardViewProps) {
  const { t } = useTranslation();
  const internalRef = useRef<HTMLDivElement>(null);
  const keyboardRef = containerRef || internalRef;

  const {
    draggingTaskId,
    validDropTargets,
    handleDragStart,
    handleDragEnd,
    handleDragCancel,
  } = dragDrop;

  const { toggleCollapse, startResize, isResizing, toggleLock } =
    columnManagement;

  const { isSelecting, toggleSelect, isSelected: isMultiSelected } =
    multiSelect;

  // Handle card click - select the task
  const handleCardClick = useCallback(
    (taskId: string) => {
      onSelectTask(taskId);
    },
    [onSelectTask]
  );

  // Get all tasks from columns for drag overlay lookup (memoized for performance)
  const allTasks = useMemo(
    () => columns.flatMap((col) => col.tasks),
    [columns]
  );

  return (
    <div
      ref={keyboardRef}
      className="flex-1 h-full overflow-x-auto focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      tabIndex={0}
      onKeyDown={onKeyDown}
      role="application"
      aria-label={t("workspace.kanban", "Kanban board")}
    >
      <KanbanProvider
        onDragEnd={handleDragEnd}
        onDragStart={handleDragStart}
        onDragCancel={handleDragCancel}
        renderDragOverlay={(activeId) => {
          if (!activeId) return null;
          const task = allTasks.find((t) => t.id === activeId);
          if (!task) return null;

          if (renderDragOverlay) {
            return renderDragOverlay(task);
          }

          // Default drag overlay
          return (
            <div
              className="w-[264px] p-3 bg-card rounded-lg border border-border"
              style={{
                boxShadow:
                  "0 8px 24px rgba(0,0,0,0.12), 0 4px 8px rgba(0,0,0,0.08)",
              }}
            >
              <span className="text-sm font-semibold">{task.title}</span>
            </div>
          );
        }}
      >
        {columns.map((column) => {
          const columnTasks = column.tasks;
          const colorVar = column.colorVar;
          const columnIsCollapsed = column.isCollapsed;

          // Render collapsed column as a narrow clickable strip
          if (columnIsCollapsed) {
            return (
              <CollapsedColumn
                key={column.id}
                column={column}
                onExpand={() => toggleCollapse(column.id)}
              />
            );
          }

          const columnWidth = column.width;
          const columnLocked = column.isLocked;

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
                isValidDropTarget={validDropTargets.includes(
                  column.id as KanbanColumnId
                )}
              >
                {(isOver: boolean) => {
                  const emptyConfig = COLUMN_EMPTY_STATES[column.id as KanbanColumnId];
                  const isValidTarget = validDropTargets.includes(column.id as KanbanColumnId);
                  return (
                    <>
                      <KanbanHeader>
                        <ColumnHeader
                          column={column}
                          onAddTask={() => onAddTask(column.id)}
                          onCollapse={() => toggleCollapse(column.id)}
                          onToggleLock={() => toggleLock(column.id)}
                          onQueueAll={onQueueAll}
                          onArchiveAll={onArchiveAll}
                          onToggleArchived={onToggleArchived}
                          onOpenQueueSettings={onOpenQueueSettings}
                          selection={{
                            allSelected: multiSelect.isSubsetAllSelected(
                              columnTasks.map((t) => t.id)
                            ),
                            someSelected: multiSelect.isSubsetSomeSelected(
                              columnTasks.map((t) => t.id)
                            ),
                            onToggle: () =>
                              multiSelect.toggleSubset(columnTasks.map((t) => t.id)),
                          }}
                          capacity={
                            column.id === "in_progress" && maxParallelTasks
                              ? { current: columnTasks.length, max: maxParallelTasks }
                              : undefined
                          }
                          archivedCount={archivedCount}
                          showArchived={showArchived}
                        />
                      </KanbanHeader>
                      <KanbanCards
                        className="flex-1 overflow-y-auto"
                        count={columnTasks.length}
                        emptyMessage={t(emptyConfig.messageKey, "No tasks")}
                        emptyHint={t(emptyConfig.hintKey, "Drag tasks here")}
                        emptyIcon={emptyConfig.icon}
                        isOver={isOver && isValidTarget}
                        dropHereText={t("workspace.dropHere", "Drop here")}
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
                          <KanbanCard
                            id={task.id}
                            name={task.title}
                            index={index}
                            parent={column.id}
                            onClick={() => handleCardClick(task.id)}
                            isOpen={selectedTaskId === task.id}
                            tabIndex={selectedTaskId === task.id ? 0 : -1}
                            className={cn(
                              // Running pulse animation - blue border effect
                              task.has_in_progress_attempt &&
                                !task.is_stuck &&
                                "task-running-pulse ring-2 ring-primary/50",
                              // Stuck pulse animation - warning border effect
                              task.is_stuck &&
                                "task-stuck-pulse ring-2 ring-warning/50"
                            )}
                            showMoreMenu={!!renderTaskMenu}
                            renderMoreMenu={
                              renderTaskMenu
                                ? (onOpenChange) =>
                                    renderTaskMenu(task, onOpenChange)
                                : undefined
                            }
                          >
                            {renderTaskCard(task, index, column.id)}
                          </KanbanCard>
                        </SelectableCard>
                      </motion.div>
                    ))}
                      </AnimatePresence>
                    </KanbanCards>
                  </>
                );
              }}
              </KanbanBoard>

              {/* Resize handle - right edge */}
              <ResizeHandle
                columnName={column.name}
                isLocked={columnLocked}
                isResizing={isResizing === column.id}
                onStartResize={(startX) => startResize(column.id, startX)}
              />
            </div>
          );
        })}
      </KanbanProvider>
    </div>
  );
});

/**
 * Resize handle component for columns
 */
interface ResizeHandleProps {
  columnName: string;
  isLocked: boolean;
  isResizing: boolean;
  onStartResize: (startX: number) => void;
}

const ResizeHandle = memo(function ResizeHandle({
  columnName,
  isLocked,
  isResizing,
  onStartResize,
}: ResizeHandleProps) {
  const { t } = useTranslation();

  return (
    <div
      className={cn(
        "absolute top-0 right-0 w-1 h-full z-30 touch-none",
        "group",
        isLocked ? "cursor-not-allowed" : "cursor-col-resize",
        isResizing && "bg-primary/50"
      )}
      onMouseDown={(e) => {
        if (!isLocked) {
          e.preventDefault();
          e.stopPropagation();
          onStartResize(e.clientX);
        }
      }}
      onTouchStart={(e) => {
        if (!isLocked && e.touches.length > 0) {
          e.preventDefault();
          onStartResize(e.touches[0].clientX);
        }
      }}
      role="separator"
      aria-orientation="vertical"
      aria-label={`Resize ${columnName} column`}
      title={isLocked ? t("workspace.columnLocked", "Column width is locked") : undefined}
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
      {/* Grip indicator */}
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
  );
});

KanbanBoardView.displayName = "KanbanBoardView";
