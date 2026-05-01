/**
 * Kanban Command Palette Commands Configuration
 *
 * Data-driven configuration for the command palette.
 * Extracted from workspace-kanban.tsx for maintainability.
 */
import type { Command, ViewMode, SortMode, SortDirection, KanbanFilter } from "@viben/kanban";
import i18n from "@/i18n";
import {
  Inbox,
  ListPlus,
  CircleDot,
  UserCheck,
  CheckCircle2,
  Plus,
  RefreshCw,
  ArrowRight,
  Archive,
  Settings,
  CheckSquare,
  XSquare,
  Play,
  Square,
  BarChart3,
  EyeOff,
  LayoutGrid,
  List,
  Eye,
  XCircle,
  Search,
  SortAsc,
  Clock,
  ArrowUpDown,
  Table2,
} from "lucide-react";
import * as React from "react";

// Type for task status
type TaskStatus = "backlog" | "queue" | "in_progress" | "paused" | "review" | "completed" | "failed" | "cancelled" | "archived";

/**
 * Minimal task interface for commands
 */
export interface CommandTask {
  id: string;
  title: string;
  status: TaskStatus;
  archived?: boolean;
}

/**
 * Command factory context - data needed to create commands
 */
export interface CommandFactoryContext {
  /** Tasks grouped by column */
  tasksByColumn: Record<string, CommandTask[]>;
  /** Currently selected task ID */
  selectedTaskId: string | null;
  /** Currently selected task */
  selectedTask: CommandTask | null;
  /** All tasks for task lookup */
  allTasks: CommandTask[];
  /** Whether stats panel is shown */
  showStats: boolean;
  /** Whether archived tasks are shown */
  showArchived: boolean;
  /** Current view mode */
  viewMode: ViewMode;
}

/**
 * Command actions - callbacks injected by the consumer
 */
export interface CommandActions {
  /** Set selected task ID */
  setSelectedTaskId: (id: string | null) => void;
  /** Add a new task to a column */
  handleAddTask: (columnId: string) => void;
  /** Refresh all tasks */
  handleRefresh: () => void;
  /** Queue all backlog tasks */
  handleQueueAll: () => void;
  /** Archive a task */
  handleArchiveTask: (taskId: string) => Promise<void>;
  /** Start a task (move to in_progress) */
  handleStartTask: (taskId: string) => void;
  /** Stop a task (move back to backlog) */
  handleStopTask: (taskId: string) => void;
  /** Select all visible tasks */
  selectAll: () => void;
  /** Clear selection */
  clearSelection: () => void;
  /** Toggle stats panel */
  setShowStats: (showOrToggle: boolean | ((prev: boolean) => boolean)) => void;
  /** Set view mode */
  setViewMode: (mode: ViewMode) => void;
  /** Toggle show archived */
  toggleShowArchived: () => void;
  /** Set filter */
  setFilter: (filter: KanbanFilter) => void;
  /** Set sorting */
  setSorting: (mode: SortMode, direction: SortDirection) => void;
  /** Open queue settings modal */
  openQueueSettings: () => void;
  /** Toast for notifications */
  toast: {
    success: (message: string) => void;
    info: (message: string) => void;
  };
}

// ==========================================
// Navigation Commands
// ==========================================

function createNavigationCommands(
  ctx: CommandFactoryContext,
  actions: CommandActions
): Command[] {
  const { tasksByColumn } = ctx;
    const { setSelectedTaskId } = actions;

  return [
    {
      id: "goto-backlog",
      label: i18n.t("workspace.column.backlog", "Backlog"),
      description: i18n.t("workspace.commandPalette.gotoBacklogDesc", "Jump to first task in Backlog"),
      icon: React.createElement(Inbox, { className: "h-4 w-4" }),
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
      label: i18n.t("workspace.column.queue", "Queue"),
      description: i18n.t("workspace.commandPalette.gotoQueueDesc", "Jump to first task in Queue"),
      icon: React.createElement(ListPlus, { className: "h-4 w-4" }),
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
      label: i18n.t("workspace.column.inProgress", "In Progress"),
      description: i18n.t("workspace.commandPalette.gotoInProgressDesc", "Jump to first task in progress"),
      icon: React.createElement(CircleDot, { className: "h-4 w-4" }),
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
      id: "goto-review",
      label: i18n.t("workspace.column.review", "Review"),
      description: i18n.t("workspace.commandPalette.gotoReviewDesc", "Jump to first task in Review"),
      icon: React.createElement(UserCheck, { className: "h-4 w-4" }),
      category: "navigation",
      keywords: ["go", "jump", "review", "审核"],
      action: () => {
        const tasks = tasksByColumn["review"];
        if (tasks && tasks.length > 0) {
          setSelectedTaskId(tasks[0].id);
        }
      },
    },
    {
      id: "goto-completed",
      label: i18n.t("workspace.column.completed", "Completed"),
      description: i18n.t("workspace.commandPalette.gotoCompletedDesc", "Jump to first completed task"),
      icon: React.createElement(CheckCircle2, { className: "h-4 w-4" }),
      category: "navigation",
      keywords: ["go", "jump", "completed", "complete", "完成"],
      action: () => {
        const tasks = tasksByColumn["completed"];
        if (tasks && tasks.length > 0) {
          setSelectedTaskId(tasks[0].id);
        }
      },
    },
  ];
}

// ==========================================
// Action Commands
// ==========================================

function createActionCommands(
  ctx: CommandFactoryContext,
  actions: CommandActions
): Command[] {
  const { tasksByColumn } = ctx;
    const { handleAddTask, handleRefresh, handleQueueAll, handleArchiveTask, toast } = actions;

  return [
    {
      id: "new-task",
      label: i18n.t("workspace.addTask", "Add Task"),
      description: i18n.t("workspace.commandPalette.newTaskDesc", "Create a new task in Backlog"),
      icon: React.createElement(Plus, { className: "h-4 w-4" }),
      shortcut: "n",
      category: "action",
      keywords: ["new", "create", "task", "add", "新建", "创建"],
      action: () => handleAddTask("backlog"),
    },
    {
      id: "refresh",
      label: i18n.t("common.refresh", "Refresh"),
      description: i18n.t("workspace.commandPalette.refreshDesc", "Reload all tasks"),
      icon: React.createElement(RefreshCw, { className: "h-4 w-4" }),
      shortcut: "r",
      category: "action",
      keywords: ["refresh", "reload", "sync", "刷新", "同步"],
      action: () => handleRefresh(),
    },
    {
      id: "queue-all",
      label: i18n.t("workspace.queueAll", "Queue All Backlog Tasks"),
      description: i18n.t("workspace.commandPalette.queueAllDesc", "Move all backlog tasks to queue"),
      icon: React.createElement(ArrowRight, { className: "h-4 w-4" }),
      shortcut: "q",
      category: "action",
      keywords: ["queue", "batch", "all", "backlog", "批量", "队列"],
      action: () => handleQueueAll(),
    },
    {
      id: "archive-completed",
      label: i18n.t("workspace.archiveAll", "Archive All Completed Tasks"),
      description: i18n.t("workspace.commandPalette.archiveAllDesc", "Archive all completed tasks"),
      icon: React.createElement(Archive, { className: "h-4 w-4" }),
      category: "action",
      keywords: ["archive", "completed", "complete", "clean", "归档", "清理"],
      action: async () => {
        const completedTasks = tasksByColumn["completed"] || [];
        const unarchived = completedTasks.filter((task) => !task.archived);
        if (unarchived.length === 0) {
          toast.info(i18n.t("workspace.noTasksToArchive", "No tasks to archive"));
          return;
        }
        for (const task of unarchived) {
          await handleArchiveTask(task.id);
        }
        toast.success(
          i18n.t("workspace.archiveAllSuccess", "Archived {count} tasks").replace(
            "{count}",
            String(unarchived.length)
          )
        );
      },
    },
  ];
}

// ==========================================
// Selection Commands
// ==========================================

function createSelectionCommands(
  _ctx: CommandFactoryContext,
  actions: CommandActions
): Command[] {
    const { selectAll, clearSelection } = actions;

  return [
    {
      id: "select-all",
      label: i18n.t("workspace.selectAll", "Select All Tasks"),
      description: i18n.t("workspace.commandPalette.selectAllDesc", "Select all visible tasks"),
      icon: React.createElement(CheckSquare, { className: "h-4 w-4" }),
      shortcut: "a",
      category: "action",
      keywords: ["select", "all", "check", "全选"],
      action: () => selectAll(),
    },
    {
      id: "clear-selection",
      label: i18n.t("workspace.clearSelection", "Clear Selection"),
      description: i18n.t("workspace.commandPalette.clearSelectionDesc", "Deselect all tasks"),
      icon: React.createElement(XSquare, { className: "h-4 w-4" }),
      shortcut: "Escape",
      category: "action",
      keywords: ["clear", "deselect", "uncheck", "取消选择"],
      action: () => clearSelection(),
    },
  ];
}

// ==========================================
// Task Operation Commands (when task selected)
// ==========================================

function createTaskOperationCommands(
  ctx: CommandFactoryContext,
  actions: CommandActions
): Command[] {
  const { selectedTaskId, allTasks } = ctx;
    const { handleStartTask, handleStopTask } = actions;

  if (!selectedTaskId) {
    return [];
  }

  return [
    {
      id: "run-task",
      label: i18n.t("workspace.runAgent", "Run Selected Task"),
      description: i18n.t("workspace.commandPalette.runTaskDesc", "Start agent for selected task"),
      icon: React.createElement(Play, { className: "h-4 w-4" }),
      category: "action" as const,
      keywords: ["run", "start", "execute", "agent", "运行", "启动"],
      action: () => {
        const task = allTasks.find((t) => t.id === selectedTaskId);
        if (task && task.status !== "in_progress" && task.status !== "completed") {
          handleStartTask(selectedTaskId);
        }
      },
    },
    {
      id: "stop-task",
      label: i18n.t("workspace.stopAgent", "Stop Selected Task"),
      description: i18n.t("workspace.commandPalette.stopTaskDesc", "Stop running agent"),
      icon: React.createElement(Square, { className: "h-4 w-4" }),
      category: "action" as const,
      keywords: ["stop", "cancel", "abort", "agent", "停止", "取消"],
      action: () => {
        const task = allTasks.find((t) => t.id === selectedTaskId);
        if (task?.status === "in_progress") {
          handleStopTask(selectedTaskId);
        }
      },
    },
  ];
}

// ==========================================
// View Commands
// ==========================================

function createViewCommands(
  ctx: CommandFactoryContext,
  actions: CommandActions
): Command[] {
  const { showStats, showArchived } = ctx;
    const { setShowStats, setViewMode, toggleShowArchived } = actions;

  return [
    {
      id: "toggle-stats",
      label: showStats
        ? i18n.t("workspace.hideStats", "Hide Stats")
        : i18n.t("workspace.showStats", "Show Stats"),
      description: i18n.t("workspace.commandPalette.toggleStatsDesc", "Toggle statistics panel"),
      icon: showStats
        ? React.createElement(EyeOff, { className: "h-4 w-4" })
        : React.createElement(BarChart3, { className: "h-4 w-4" }),
      category: "view",
      keywords: ["stats", "statistics", "chart", "统计", "图表"],
      action: () => setShowStats((s) => !s),
    },
    {
      id: "view-kanban",
      label: i18n.t("workspace.viewKanban", "Kanban View"),
      description: i18n.t("workspace.commandPalette.viewKanbanDesc", "Switch to kanban board"),
      icon: React.createElement(LayoutGrid, { className: "h-4 w-4" }),
      category: "view",
      keywords: ["kanban", "board", "看板"],
      action: () => setViewMode("kanban"),
    },
    {
      id: "view-list",
      label: i18n.t("workspace.viewList", "List View"),
      description: i18n.t("workspace.commandPalette.viewListDesc", "Switch to list view"),
      icon: React.createElement(List, { className: "h-4 w-4" }),
      category: "view",
      keywords: ["list", "列表"],
      action: () => setViewMode("list"),
    },
    {
      id: "view-table",
      label: i18n.t("workspace.viewTable", "Table View"),
      description: i18n.t("workspace.commandPalette.viewTableDesc", "Switch to table view"),
      icon: React.createElement(Table2, { className: "h-4 w-4" }),
      category: "view",
      keywords: ["table", "grid", "表格"],
      action: () => setViewMode("table"),
    },
    {
      id: "toggle-archived",
      label: showArchived
        ? i18n.t("workspace.hideArchived", "Hide Archived")
        : i18n.t("workspace.showArchived", "Show Archived"),
      description: i18n.t("workspace.commandPalette.toggleArchivedDesc", "Toggle archived tasks visibility"),
      icon: showArchived
        ? React.createElement(EyeOff, { className: "h-4 w-4" })
        : React.createElement(Eye, { className: "h-4 w-4" }),
      category: "view",
      keywords: ["archive", "hidden", "show", "归档", "显示"],
      action: () => toggleShowArchived(),
    },
  ];
}

// ==========================================
// Filter Commands
// ==========================================

function createFilterCommands(
  _ctx: CommandFactoryContext,
  actions: CommandActions
): Command[] {
    const { setFilter } = actions;

  return [
    {
      id: "clear-filters",
      label: i18n.t("workspace.filter.clear", "Clear All Filters"),
      description: i18n.t("workspace.commandPalette.clearFiltersDesc", "Reset all filters"),
      icon: React.createElement(XCircle, { className: "h-4 w-4" }),
      category: "filter",
      keywords: ["clear", "reset", "filter", "清除", "重置"],
      action: () => setFilter({}),
    },
    {
      id: "filter-search",
      label: i18n.t("workspace.filter.search", "Search Tasks"),
      description: i18n.t("workspace.commandPalette.filterSearchDesc", "Focus on search input"),
      icon: React.createElement(Search, { className: "h-4 w-4" }),
      shortcut: "/",
      category: "filter",
      keywords: ["search", "find", "filter", "搜索", "查找"],
      action: () => {
        const searchInput = document.querySelector<HTMLInputElement>("[data-filter-search]");
        searchInput?.focus();
      },
    },
  ];
}

// ==========================================
// Sort Commands
// ==========================================

function createSortCommands(
  _ctx: CommandFactoryContext,
  actions: CommandActions
): Command[] {
    const { setSorting } = actions;

  return [
    {
      id: "sort-priority",
      label: i18n.t("workspace.sort.priority", "Sort by Priority"),
      description: i18n.t("workspace.commandPalette.sortPriorityDesc", "High priority first"),
      icon: React.createElement(SortAsc, { className: "h-4 w-4" }),
      category: "sort",
      keywords: ["sort", "priority", "urgent", "排序", "优先级"],
      action: () => setSorting("priority", "desc"),
    },
    {
      id: "sort-duedate",
      label: i18n.t("workspace.sort.dueDate", "Sort by Due Date"),
      description: i18n.t("workspace.commandPalette.sortDueDateDesc", "Earliest due date first"),
      icon: React.createElement(Clock, { className: "h-4 w-4" }),
      category: "sort",
      keywords: ["sort", "due", "date", "deadline", "排序", "截止日期"],
      action: () => setSorting("dueDate", "asc"),
    },
    {
      id: "sort-title",
      label: i18n.t("workspace.sort.name", "Sort by Title"),
      description: i18n.t("workspace.commandPalette.sortTitleDesc", "Alphabetical order"),
      icon: React.createElement(ArrowUpDown, { className: "h-4 w-4" }),
      category: "sort",
      keywords: ["sort", "name", "title", "alphabetical", "排序", "名称"],
      action: () => setSorting("title", "asc"),
    },
    {
      id: "sort-created",
      label: i18n.t("workspace.sort.created", "Sort by Created Date"),
      description: i18n.t("workspace.commandPalette.sortCreatedDesc", "Newest first"),
      icon: React.createElement(Clock, { className: "h-4 w-4" }),
      category: "sort",
      keywords: ["sort", "created", "date", "new", "排序", "创建时间"],
      action: () => setSorting("createdAt", "desc"),
    },
    {
      id: "sort-updated",
      label: i18n.t("workspace.sort.updated", "Sort by Updated Date"),
      description: i18n.t("workspace.commandPalette.sortUpdatedDesc", "Recently updated first"),
      icon: React.createElement(Clock, { className: "h-4 w-4" }),
      category: "sort",
      keywords: ["sort", "updated", "modified", "recent", "排序", "更新时间"],
      action: () => setSorting("updatedAt", "desc"),
    },
  ];
}

// ==========================================
// Settings Commands
// ==========================================

function createSettingsCommands(
  _ctx: CommandFactoryContext,
  actions: CommandActions
): Command[] {
    const { openQueueSettings } = actions;

  return [
    {
      id: "queue-settings",
      label: i18n.t("workspace.queueSettings", "Queue Settings"),
      description: i18n.t("workspace.commandPalette.queueSettingsDesc", "Configure queue concurrency"),
      icon: React.createElement(Settings, { className: "h-4 w-4" }),
      category: "settings",
      keywords: ["queue", "settings", "config", "concurrency", "配置", "设置"],
      action: () => openQueueSettings(),
    },
  ];
}

// ==========================================
// Main Export
// ==========================================

/**
 * Creates all commands for the kanban command palette.
 *
 * @param context - Data context (tasks, state, etc.)
 * @param actions - Action callbacks
 * @returns Array of Command objects
 *
 * @example
 * ```tsx
 * const commands = useMemo(
 *   () => createCommands(
 *     {
 *       tasksByColumn,
 *       selectedTaskId,
 *       selectedTask,
 *       allTasks: sortedTasks,
 *       showStats,
 *       showArchived,
 *       viewMode,
 *     },
 *     {
 *       setSelectedTaskId,
 *       handleAddTask,
 *       handleRefresh,
 *       handleQueueAll,
 *       handleArchiveTask,
 *       handleStartTask,
 *       handleStopTask,
 *       selectAll,
 *       clearSelection,
 *       setShowStats,
 *       setViewMode,
 *       toggleShowArchived,
 *       setFilter,
 *       setSorting: handleSortChange,
 *       openQueueSettings: () => setQueueSettingsOpen(true),
 *       toast,
 *     }
 *   ),
 *   [/* dependencies *\/]
 * );
 * ```
 */
export function createCommands(
  context: CommandFactoryContext,
  actions: CommandActions
): Command[] {
  return [
    // Navigation - jump to columns
    ...createNavigationCommands(context, actions),
    // Actions - create, refresh, queue, archive
    ...createActionCommands(context, actions),
    // Selection - select all, clear
    ...createSelectionCommands(context, actions),
    // Task operations - run/stop (only when task selected)
    ...createTaskOperationCommands(context, actions),
    // View - toggle stats, switch views, show archived
    ...createViewCommands(context, actions),
    // Filter - clear filters, focus search
    ...createFilterCommands(context, actions),
    // Sort - various sort modes
    ...createSortCommands(context, actions),
    // Settings - queue configuration
    ...createSettingsCommands(context, actions),
  ];
}
