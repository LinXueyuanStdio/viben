import {
  MoreHorizontal,
  Pencil,
  Copy,
  Trash2,
  Play,
  ChevronsRight,
  GripVertical,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Badge,
  cn,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@viben/ui";
import {
  KanbanProvider,
  KanbanBoard,
  KanbanCards,
  SelectableCard,
} from "@viben/kanban";
import {
  STATUS_TO_COLUMN,
  type KanbanColumnId,
} from "@/lib/kanban";
import type { UseKanbanBoardReturn } from "../hooks/useKanbanBoard";
import type { ColumnId } from "../types";
import { COLUMN_COLORS, COLUMN_COLOR_VARS } from "../constants";
import { TaskCardContent } from "./task-card-content";
import { TaskCardWithStuckDetection } from "./TaskCardWithStuckDetection";
import { KanbanColumnHeader } from "./KanbanColumnHeader";

interface KanbanBoardViewProps {
  board: UseKanbanBoardReturn;
}

export function KanbanBoardView({ board }: KanbanBoardViewProps) {
  const {
    t,
    prefersReducedMotion,
    workspace,
    columnStatuses,
    tasksByColumn,
    sortedTasks,
    selectedTaskId,
    isCollapsed,
    toggleCollapse,
    getWidth,
    isResizing,
    isColumnLocked,
    startResize,
    draggingTaskId,
    validDropTargets,
    isMultiSelected,
    isSelecting,
    toggleSelect,
    handleDragEnd,
    handleDragStart,
    handleDragCancel,
    handleCardClick,
    handleTitleChange,
    handleStartTask,
    handleStopTask,
    handleRecoverTask,
    handleResumeTask,
    handleApproveTask,
    handleRejectTask,
    handleViewPR,
    handleArchiveTask,
    handleMoveToColumn,
    handleDuplicateTask,
    handleDeleteTask,
    setSelectedTaskId,
    setAutoStartTaskOnOpen,
    handleKanbanKeyDown,
    keyboardContainerRef,
  } = board;

  return (
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
                <KanbanColumnHeader
                  column={column}
                  columnTasks={columnTasks}
                  colorVar={colorVar}
                  board={board}
                />
                <KanbanCards
                  className="flex-1 overflow-y-auto"
                  count={columnTasks.length}
                  emptyMessage={t("workspace.noTasks", "No tasks")}
                  emptyHint={t("workspace.emptyColumnHint", "Drag tasks here or click + to create")}
                >
                  <AnimatePresence initial={false}>
                    {columnTasks.map((task, index) => (
                      <motion.div
                        key={task.id}
                        initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: prefersReducedMotion ? 1 : 0.95 }}
                        transition={{
                          duration: prefersReducedMotion ? 0 : 0.2,
                          ease: [0.2, 0, 0, 1],
                          delay: prefersReducedMotion ? 0 : index * 0.02,
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
                                  {task.status !== "in_progress" && task.status !== "completed" && (
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
                              onTitleChange={(title) => handleTitleChange(task.id, title)}
                              onStart={
                                task.status === "backlog" || task.status === "queue"
                                  ? () => handleStartTask(task.id)
                                  : undefined
                              }
                              onStop={
                                task.status === "in_progress"
                                  ? () => handleStopTask(task.id)
                                  : undefined
                              }
                              onRecover={
                                task.is_stuck
                                  ? () => handleRecoverTask(task.id)
                                  : undefined
                              }
                              onResume={
                                task.status === "failed"
                                  ? () => handleResumeTask(task.id)
                                  : undefined
                              }
                              onApprove={
                                task.status === "review"
                                  ? () => handleApproveTask(task.id)
                                  : undefined
                              }
                              onReject={
                                task.status === "review"
                                  ? () => handleRejectTask(task.id)
                                  : undefined
                              }
                              onViewPR={
                                task.pr_url
                                  ? () => handleViewPR(task.pr_url!)
                                  : undefined
                              }
                              onArchive={
                                task.status === "completed" && !task.archived
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
                aria-label={t("kanban.resizeColumn", { name: column.name })}
                title={columnLocked ? t("workspace.columnLocked", "Column width is locked") : undefined}
              >
                <div className="absolute inset-y-0 -left-1 -right-1" />
                <div
                  className={cn(
                    "absolute top-0 right-0 w-1 h-full",
                    "bg-transparent transition-colors duration-150",
                    !columnLocked && "group-hover:bg-primary/40",
                    isResizing === column.id && !columnLocked && "bg-primary/60"
                  )}
                />
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
  );
}
