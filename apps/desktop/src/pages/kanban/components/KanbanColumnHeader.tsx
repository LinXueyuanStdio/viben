import {
  Plus,
  ListPlus,
  Settings,
  Archive,
  ChevronsLeft,
  Lock,
  Unlock,
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
import { KanbanHeader } from "@viben/kanban";
import type { Status } from "@viben/kanban";
import type { EnhancedTask } from "../types";
import type { UseKanbanBoardReturn } from "../hooks/useKanbanBoard";

interface KanbanColumnHeaderProps {
  column: Status;
  columnTasks: EnhancedTask[];
  colorVar: string;
  board: UseKanbanBoardReturn;
}

export function KanbanColumnHeader({ column, columnTasks, colorVar, board }: KanbanColumnHeaderProps) {
  const {
    t,
    maxParallelTasks,
    showArchived,
    archivedCompletedCount,
    isSubsetAllSelected,
    isSubsetSomeSelected,
    toggleSubset,
    toggleCollapse,
    toggleColumnLock,
    isColumnLocked,
    handleQueueAll,
    setQueueSettingsOpen,
    handleArchiveAll,
    toggleShowArchived,
    handleAddTask,
  } = board;

  const columnTaskIds = columnTasks.map((t) => t.id);
  const allSelected = isSubsetAllSelected(columnTaskIds);
  const someSelected = isSubsetSomeSelected(columnTaskIds);
  const columnLocked = isColumnLocked(column.id);

  return (
    <KanbanHeader>
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

        {/* Completed column - Archive All + Archive Toggle */}
        {column.id === "completed" && (
          <>
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

            {archivedCompletedCount > 0 && (
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
                        {archivedCompletedCount}
                      </span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">
                    {showArchived
                      ? t("workspace.hideArchived", "Hide Archived")
                      : t("workspace.showArchived", "Show Archived ({{count}})", { count: archivedCompletedCount })}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </>
        )}

        {/* Add task button - only for backlog */}
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

        {/* Lock button */}
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
    </KanbanHeader>
  );
}
