import { ChevronsRight, ChevronsLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Badge, cn } from "@viben/ui";
import {
  KANBAN_COLUMNS,
  STATUS_TO_COLUMN,
  type TaskStatus as VibeTaskStatus,
  type KanbanColumnId,
} from "@/lib/kanban";
import type { UseKanbanBoardReturn } from "../hooks/useKanbanBoard";
import type { EnhancedTask } from "../types";
import { COLUMN_COLOR_VARS } from "../constants";
import { TaskCardContent } from "./TaskCardContent";
import { ListViewItemWithStuckDetection } from "./ListViewItemWithStuckDetection";

interface KanbanListViewProps {
  board: UseKanbanBoardReturn;
}

export function KanbanListView({ board }: KanbanListViewProps) {
  const {
    t,
    workspace,
    columnStatuses,
    tasksByColumn,
    sortedTasks,
    selectedTaskId,
    collapsedColumns,
    toggleCollapse,
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
  } = board;

  return (
    <div className="flex-1 h-full overflow-y-auto">
      <div className="flex flex-col">
        {sortedTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <p className="text-sm">{t("workspace.noTasks", "No tasks found")}</p>
          </div>
        ) : (
          KANBAN_COLUMNS.map((columnId) => {
            const columnTasks = tasksByColumn[columnId] ?? [];
            const isColumnCollapsed = collapsedColumns[columnId] ?? false;
            const column = columnStatuses.find((c) => c.id === columnId);
            const columnColor = column?.color ?? `hsl(var(${COLUMN_COLOR_VARS[columnId as KanbanColumnId]}))`;
            const columnName = column?.name ?? columnId.replace("_", " ");

            if (columnTasks.length === 0) {
              return null;
            }

            return (
              <div key={columnId} className="flex flex-col">
                {/* Sticky collapsible section header */}
                <button
                  type="button"
                  className={cn(
                    "flex items-center gap-2 px-4 py-2.5 sticky top-0 z-10",
                    "bg-background/95 backdrop-blur-sm border-b",
                    "hover:bg-muted/50 transition-colors duration-150",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                    "cursor-pointer select-none w-full text-left"
                  )}
                  onClick={() => toggleCollapse(columnId)}
                  aria-expanded={!isColumnCollapsed}
                  aria-controls={`list-section-${columnId}`}
                >
                  <div
                    className="shrink-0 transition-transform duration-200"
                    style={{ color: columnColor }}
                  >
                    {isColumnCollapsed ? (
                      <ChevronsRight className="h-4 w-4" />
                    ) : (
                      <ChevronsLeft className="h-4 w-4 rotate-[-90deg]" />
                    )}
                  </div>

                  <div
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{
                      backgroundColor: columnColor,
                      boxShadow: `0 0 0 3px ${columnColor}40`,
                    }}
                  />

                  <span
                    className="text-sm font-semibold flex-1"
                    style={{ color: columnColor }}
                  >
                    {columnName}
                  </span>

                  <span
                    className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 text-[11px] font-medium rounded-full tabular-nums"
                    style={{
                      backgroundColor: `${columnColor}26`,
                      color: columnColor,
                    }}
                  >
                    {columnTasks.length}
                  </span>
                </button>

                {/* Tasks list - collapsible with animation */}
                <AnimatePresence initial={false}>
                  {!isColumnCollapsed && (
                    <motion.div
                      id={`list-section-${columnId}`}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{
                        height: { duration: 0.2, ease: [0.2, 0, 0, 1] },
                        opacity: { duration: 0.15 },
                      }}
                      className="overflow-hidden"
                    >
                      <div className="flex flex-col">
                        {columnTasks.map((item) => (
                          <ListViewItemWithStuckDetection
                            key={item.id}
                            task={item}
                            workspacePath={workspace?.path ?? ""}
                            onClick={() => handleCardClick(item.id)}
                            isSelected={selectedTaskId === item.id}
                            renderStatus={(task: EnhancedTask) => {
                              const mappedColumn = STATUS_TO_COLUMN[task.status as VibeTaskStatus];
                              const col = columnStatuses.find((c) => c.id === mappedColumn);
                              return (
                                <Badge variant="outline" className="text-xs">
                                  {col?.name || task.status}
                                </Badge>
                              );
                            }}
                          >
                            <TaskCardContent
                              task={item}
                              onTitleChange={(title) => handleTitleChange(item.id, title)}
                              onStart={
                                item.status === "backlog" || item.status === "queue"
                                  ? () => handleStartTask(item.id)
                                  : undefined
                              }
                              onStop={
                                item.status === "in_progress"
                                  ? () => handleStopTask(item.id)
                                  : undefined
                              }
                              onRecover={
                                item.is_stuck
                                  ? () => handleRecoverTask(item.id)
                                  : undefined
                              }
                              onResume={
                                item.status === "failed"
                                  ? () => handleResumeTask(item.id)
                                  : undefined
                              }
                              onApprove={
                                item.status === "review"
                                  ? () => handleApproveTask(item.id)
                                  : undefined
                              }
                              onReject={
                                item.status === "review"
                                  ? () => handleRejectTask(item.id)
                                  : undefined
                              }
                              onViewPR={
                                item.pr_url
                                  ? () => handleViewPR(item.pr_url!)
                                  : undefined
                              }
                              onArchive={
                                item.status === "completed" && !item.archived
                                  ? () => handleArchiveTask(item.id)
                                  : undefined
                              }
                            />
                          </ListViewItemWithStuckDetection>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
