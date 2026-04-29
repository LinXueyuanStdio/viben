import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Inbox,
  ListPlus,
  CircleDot,
  UserCheck,
  CheckCircle2,
  Plus,
  RefreshCw,
  ArrowRight,
  Settings,
  Archive,
  CheckSquare,
  XSquare,
  Play,
  Square,
  EyeOff,
  BarChart3,
  LayoutGrid,
  List,
  Table2,
  Eye,
  XCircle,
  Search,
  SortAsc,
  Clock,
  ArrowUpDown,
} from "lucide-react";
import type {
  Command,
  KanbanFilter,
  ViewMode,
  SortMode,
  SortDirection,
} from "@viben/kanban";
import { useToast } from "@/hooks/use-toast";
import type { EnhancedTask } from "../types";

interface UseKanbanCommandsParams {
  tasksByColumn: Record<string, EnhancedTask[]>;
  sortedTasks: EnhancedTask[];
  selectedTaskId: string | null;
  showStats: boolean;
  showArchived: boolean;
  // Setters
  setSelectedTaskId: (id: string | null) => void;
  setFilter: (f: KanbanFilter) => void;
  setShowStats: (show: boolean | ((prev: boolean) => boolean)) => void;
  setViewMode: (mode: ViewMode) => void;
  // Action callbacks
  handleAddTask: (columnId: string) => void;
  handleRefresh: () => void;
  handleQueueAll: () => void;
  handleArchiveTask: (taskId: string) => void;
  handleStartTask: (taskId: string) => void;
  handleStopTask: (taskId: string) => void;
  handleSortChange: (mode: SortMode, direction: SortDirection) => void;
  selectAll: () => void;
  clearSelection: () => void;
  toggleShowArchived: () => void;
  setQueueSettingsOpen: (open: boolean) => void;
}

export function useKanbanCommands({
  tasksByColumn,
  sortedTasks,
  selectedTaskId,
  showStats,
  showArchived,
  setSelectedTaskId,
  setFilter,
  setShowStats,
  setViewMode,
  handleAddTask,
  handleRefresh,
  handleQueueAll,
  handleArchiveTask,
  handleStartTask,
  handleStopTask,
  handleSortChange,
  selectAll,
  clearSelection,
  toggleShowArchived,
  setQueueSettingsOpen,
}: UseKanbanCommandsParams): Command[] {
  const { t } = useTranslation();
  const toast = useToast();

  return useMemo(
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
        id: "goto-review",
        label: t("workspace.column.review", "Review"),
        description: t("workspace.commandPalette.gotoReviewDesc", "Jump to first task in Review"),
        icon: <UserCheck className="h-4 w-4" />,
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
        label: t("workspace.column.completed", "Completed"),
        description: t("workspace.commandPalette.gotoCompletedDesc", "Jump to first completed task"),
        icon: <CheckCircle2 className="h-4 w-4" />,
        category: "navigation",
        keywords: ["go", "jump", "completed", "complete", "完成"],
        action: () => {
          const tasks = tasksByColumn["completed"];
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
        keywords: ["archive", "completed", "complete", "clean", "归档", "清理"],
        action: () => {
          const completedTasks = tasksByColumn["completed"] || [];
          const unarchived = completedTasks.filter((task) => !task.archived);
          if (unarchived.length === 0) {
            toast.info(t("workspace.noTasksToArchive", "No tasks to archive"));
            return;
          }
          for (const task of unarchived) {
            handleArchiveTask(task.id);
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
      ...(selectedTaskId
        ? ([
            {
              id: "run-task",
              label: t("workspace.runAgent", "Run Selected Task"),
              description: t("workspace.commandPalette.runTaskDesc", "Start agent for selected task"),
              icon: <Play className="h-4 w-4" />,
              category: "action" as const,
              keywords: ["run", "start", "execute", "agent", "运行", "启动"],
              action: () => {
                const task = sortedTasks.find((t) => t.id === selectedTaskId);
                if (task && task.status !== "in_progress" && task.status !== "completed") {
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
                if (task?.status === "in_progress") {
                  handleStopTask(selectedTaskId);
                }
              },
            },
          ] satisfies Command[])
        : []),

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
          const searchInput = document.querySelector<HTMLInputElement>("[data-filter-search]");
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
      setFilter,
      handleSortChange,
      setSelectedTaskId,
      setShowStats,
      setViewMode,
      setQueueSettingsOpen,
      toast,
    ]
  );
}
