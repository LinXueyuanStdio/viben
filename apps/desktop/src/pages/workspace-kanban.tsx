import { useState, useCallback, useMemo, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import {
  Loader2,
  FolderOpen,
  Plus,
  Circle,
  AlertCircle,
  RefreshCw,
  Play,
  XCircle,
  ArrowLeft,
  BarChart3,
  Keyboard,
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
  PriorityIcon,
  TagBadge,
  AssigneeAvatar,
  DueDateBadge,
  ViewSwitcher,
  ListView,
  ListViewItem,
  BulkActionsBar,
  // SelectableCard, // TODO: use in multi-select mode
  EditableCardTitle,
  SortModeSelect,
  StatsPanel,
  CommandPalette,
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
} from "@viben/kanban";
import { PageWrapper } from "@/components/layout";
import {
  WorkspaceHeader,
  TaskDetailPanel,
  TasksLayout,
  useKanbanNavigation,
} from "@/components/workspace";
import { useLocalWorkspaces } from "@/hooks";
import {
  useVibeKanbanTasks,
  useVibeKanbanProjects,
  useUpdateVibeKanbanTaskStatus,
  useUpdateVibeKanbanTask,
  useCreateVibeKanbanTask,
} from "@/hooks/use-vibe-kanban";
import {
  type TaskWithAttemptStatus,
  type TaskStatus as VibeTaskStatus,
  STATUS_TO_COLUMN,
  COLUMN_TO_STATUS,
} from "@/lib/vibe-kanban";
import { useTranslation } from "react-i18next";

// Kanban column IDs
const COLUMN_IDS = ["todo", "in-progress", "review", "done"] as const;
type ColumnId = (typeof COLUMN_IDS)[number];

// Column colors mapping (full CSS value for List View)
const COLUMN_COLORS: Record<ColumnId, string> = {
  todo: "hsl(var(--muted))",
  "in-progress": "hsl(var(--primary))",
  review: "hsl(var(--warning))",
  done: "hsl(var(--success))",
};

// Column color CSS variables for KanbanHeader
const COLUMN_COLOR_VARS: Record<ColumnId, string> = {
  todo: "--muted",
  "in-progress": "--primary",
  review: "--warning",
  done: "--success",
};

// Extended task type to support new fields
interface EnhancedTask extends TaskWithAttemptStatus {
  priority?: IssuePriority;
  tags?: Tag[];
  assignee?: Assignee;
  dueDate?: string;
}

// Task Card Content Component - displays vibe-kanban task with enhanced fields
function TaskCardContent({
  task,
  onTitleChange,
}: {
  task: EnhancedTask;
  onTitleChange?: (title: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5 min-w-0">
      {/* Row 1: Priority + Title (inline editable) */}
      <div className="flex items-center gap-2">
        {task.priority && task.priority !== "none" && (
          <PriorityIcon priority={task.priority} size="sm" />
        )}
        {onTitleChange ? (
          <EditableCardTitle
            value={task.title}
            onChange={onTitleChange}
            className="text-sm font-medium flex-1"
          />
        ) : (
          <span className="text-sm font-medium truncate flex-1">{task.title}</span>
        )}
      </div>

      {/* Row 2: Description (truncated) */}
      {task.description && (
        <p className="text-xs text-muted-foreground m-0 line-clamp-2">
          {task.description}
        </p>
      )}

      {/* Row 3: Tags (max 3) */}
      {task.tags && task.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {task.tags.slice(0, 3).map((tag) => (
            <TagBadge key={tag.id} tag={tag} size="sm" />
          ))}
          {task.tags.length > 3 && (
            <span className="text-xs text-muted-foreground">
              +{task.tags.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Row 4: Bottom row - Assignee, Due Date, Execution Status */}
      <div className="flex items-center gap-2 mt-1">
        {/* Assignee */}
        {task.assignee && (
          <AssigneeAvatar assignee={task.assignee} size="sm" />
        )}

        {/* Due Date */}
        {task.dueDate && (
          <DueDateBadge dueDate={task.dueDate} />
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Execution Status (preserved from original) */}
        {task.has_in_progress_attempt && (
          <Badge variant="secondary" className="text-xs px-1.5 py-0 gap-1">
            <Play className="h-3 w-3" />
            Running
          </Badge>
        )}
        {task.last_attempt_failed && !task.has_in_progress_attempt && (
          <Badge variant="destructive" className="text-xs px-1.5 py-0 gap-1">
            <XCircle className="h-3 w-3" />
            Failed
          </Badge>
        )}
      </div>
    </div>
  );
}


// Build column statuses with translations
function useColumnStatuses(): Status[] {
  const { t } = useTranslation();
  return COLUMN_IDS.map((id) => ({
    id,
    name: t(`workspace.kanbanStatus.${id === "in-progress" ? "inProgress" : id}`),
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
  return (
    <div className="flex flex-col items-center justify-center h-[60vh] text-center px-4">
      <AlertCircle className="h-12 w-12 text-destructive mb-4" />
      <h2 className="text-xl font-semibold mb-2">Connection Error</h2>
      <p className="text-muted-foreground mb-4 max-w-md">{message}</p>
      {onRetry && (
        <Button onClick={onRetry}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      )}
    </div>
  );
}

// No project found state
function NoProjectState({ workspacePath }: { workspacePath: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-[60vh] text-center px-4">
      <Circle className="h-12 w-12 text-muted-foreground mb-4" />
      <h2 className="text-xl font-semibold mb-2">No Project Found</h2>
      <p className="text-muted-foreground mb-4 max-w-md">
        No vibe-kanban project found for this workspace path:
      </p>
      <code className="text-sm bg-muted px-3 py-1 rounded">{workspacePath}</code>
      <p className="text-muted-foreground mt-4 text-sm">
        Create a project in vibe-kanban first.
      </p>
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

  // UI state
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>("createdAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [filter, setFilter] = useState<KanbanFilter>({});
  const [viewMode, setViewMode] = useState<ViewMode>("kanban");
  const [showStats, setShowStats] = useState(false);

  // Command palette state
  const { isOpen: isCommandPaletteOpen, setIsOpen: setIsCommandPaletteOpen } =
    useCommandPalette();

  const columnStatuses = useColumnStatuses();
  const workspace = workspaceId ? getWorkspace(workspaceId) : undefined;

  // Fetch projects from vibe-kanban
  const {
    data: projects,
    isLoading: isLoadingProjects,
    error: projectsError,
    refetch: refetchProjects,
  } = useVibeKanbanProjects();

  // Find matching project by workspace path
  const vibeProject = useMemo(() => {
    if (!workspace?.path || !projects) return null;
    const normalizedPath = workspace.path.replace(/\/+$/, "");
    return projects.find(
      (p) => p.git_repo_path.replace(/\/+$/, "") === normalizedPath
    ) ?? null;
  }, [workspace?.path, projects]);

  // Fetch tasks for the project
  const {
    data: tasks,
    isLoading: isLoadingTasks,
    error: tasksError,
    refetch: refetchTasks,
    isFetching: isFetchingTasks,
  } = useVibeKanbanTasks(vibeProject?.id ?? null);

  // Mutations
  const updateTaskStatus = useUpdateVibeKanbanTaskStatus();
  const updateTask = useUpdateVibeKanbanTask();
  const createTask = useCreateVibeKanbanTask();

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

  // Calculate stats
  const stats = useKanbanStats(tasks ?? []);

  // Multi-select for bulk actions
  const {
    selectedIds,
    selectedCount,
    isSelecting: _isSelecting,
    toggleSelect: _toggleSelect,
    selectAll,
    clearSelection,
    isSelected: _isSelected,
  } = useMultiSelect(sortedTasks);

  // Selected task
  const selectedTask = useMemo(() => {
    if (!selectedTaskId || !tasks) return null;
    return tasks.find((t) => t.id === selectedTaskId) ?? null;
  }, [selectedTaskId, tasks]);

  // Available tasks for relationships
  const availableTasks = useMemo(() => {
    return (tasks ?? []).map((t) => ({ id: t.id, title: t.title }));
  }, [tasks]);

  const isPanelOpen = selectedTaskId !== null;

  // Group tasks by column (already sorted)
  const tasksByColumn = useMemo(() => {
    const grouped: Record<string, EnhancedTask[]> = {};

    for (const column of columnStatuses) {
      // Get tasks for this column (map vibe-kanban status to column id)
      const columnTasks = (sortedTasks ?? []).filter((task) => {
        const mappedColumn = STATUS_TO_COLUMN[task.status as VibeTaskStatus];
        return mappedColumn === column.id;
      });

      grouped[column.id] = columnTasks;
    }

    return grouped;
  }, [sortedTasks, columnStatuses]);

  // Handle drag end - move task to new status
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      if (!over || !vibeProject) return;

      const taskId = active.id as string;
      const newColumnId = over.id as string;
      const newStatus = COLUMN_TO_STATUS[newColumnId];

      if (!newStatus) return;

      // Update task status via API
      updateTaskStatus.mutate({
        taskId,
        status: newStatus,
        projectId: vibeProject.id,
      });
    },
    [vibeProject, updateTaskStatus]
  );

  // Add new task (for header button)
  const handleAddTask = useCallback(
    (columnId: string) => {
      if (!vibeProject) return;

      const status = COLUMN_TO_STATUS[columnId] ?? "todo";

      createTask.mutate({
        project_id: vibeProject.id,
        title: "New Task",
        description: null,
        status,
      });
    },
    [vibeProject, createTask]
  );

  // Quick add task (with title from QuickTaskInput)
  // TODO: Use this when QuickTaskInput is implemented
  // const handleQuickAddTask = useCallback(
  //   (columnId: string, title: string) => {
  //     if (!vibeProject) return;
  //     const status = COLUMN_TO_STATUS[columnId] ?? "todo";
  //     createTask.mutate({
  //       project_id: vibeProject.id,
  //       title,
  //       description: null,
  //       status,
  //     });
  //   },
  //   [vibeProject, createTask]
  // );

  // Handle inline title edit
  const handleTitleChange = useCallback(
    (taskId: string, newTitle: string) => {
      if (!vibeProject) return;

      updateTask.mutate({
        taskId,
        data: { title: newTitle },
        projectId: vibeProject.id,
      });
    },
    [vibeProject, updateTask]
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
      if (!vibeProject) return;
      const newStatus = COLUMN_TO_STATUS[status];
      if (!newStatus) return;

      // Update all selected tasks
      for (const taskId of selectedIds) {
        updateTaskStatus.mutate({
          taskId,
          status: newStatus,
          projectId: vibeProject.id,
        });
      }
      clearSelection();
    },
    [vibeProject, selectedIds, updateTaskStatus, clearSelection]
  );

  // Bulk delete (placeholder - would need delete mutation)
  const handleBulkDelete = useCallback(() => {
    // TODO: Implement bulk delete when API is available
    clearSelection();
  }, [clearSelection]);

  // Command palette commands
  const commands: Command[] = useMemo(
    () => [
      // Navigation
      {
        id: "goto-todo",
        label: t("workspace.kanbanStatus.todo", "To Do"),
        category: "navigation",
        action: () => {
          const todoTasks = tasksByColumn["todo"];
          if (todoTasks && todoTasks.length > 0) {
            setSelectedTaskId(todoTasks[0].id);
          }
        },
      },
      {
        id: "goto-in-progress",
        label: t("workspace.kanbanStatus.inProgress", "In Progress"),
        category: "navigation",
        action: () => {
          const tasks = tasksByColumn["in-progress"];
          if (tasks && tasks.length > 0) {
            setSelectedTaskId(tasks[0].id);
          }
        },
      },
      // Actions
      {
        id: "new-task",
        label: t("workspace.addTask", "Add Task"),
        shortcut: "n",
        category: "action",
        action: () => handleAddTask("todo"),
      },
      {
        id: "refresh",
        label: t("common.refresh", "Refresh"),
        shortcut: "r",
        category: "action",
        action: () => handleRefresh(),
      },
      {
        id: "toggle-stats",
        label: showStats
          ? t("workspace.hideStats", "Hide Stats")
          : t("workspace.showStats", "Show Stats"),
        category: "view",
        action: () => setShowStats((s) => !s),
      },
      // View
      {
        id: "view-kanban",
        label: t("workspace.viewKanban", "Kanban View"),
        category: "view",
        action: () => setViewMode("kanban"),
      },
      {
        id: "view-list",
        label: t("workspace.viewList", "List View"),
        category: "view",
        action: () => setViewMode("list"),
      },
      // Sort
      {
        id: "sort-priority",
        label: t("workspace.sort.priority", "Sort by Priority"),
        category: "sort",
        action: () => handleSortChange("priority", "desc"),
      },
      {
        id: "sort-duedate",
        label: t("workspace.sort.dueDate", "Sort by Due Date"),
        category: "sort",
        action: () => handleSortChange("dueDate", "asc"),
      },
      {
        id: "sort-title",
        label: t("workspace.sort.name", "Sort by Title"),
        category: "sort",
        action: () => handleSortChange("title", "asc"),
      },
    ],
    [
      t,
      tasksByColumn,
      handleAddTask,
      handleRefresh,
      showStats,
      handleSortChange,
    ]
  );

  // Loading state for workspace
  if (isLoadingWorkspaces && !workspace) {
    return (
      <PageWrapper>
        <div className="flex flex-col items-center justify-center h-[60vh]">
          <Loader2 className="h-12 w-12 animate-spin text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Loading workspace...</p>
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
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </PageWrapper>
    );
  }

  // Loading projects from vibe-kanban
  if (isLoadingProjects) {
    return (
      <PageWrapper className="flex flex-col h-full">
        <WorkspaceHeader
          workspace={workspace}
          segments={[{ label: t("workspace.kanban", "Task Board"), href: `/workspace/${workspaceId}/kanban` }]}
          showRefresh={false}
          showRemove={false}
        />
        <div className="flex-1 flex flex-col items-center justify-center">
          <Loader2 className="h-12 w-12 animate-spin text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Connecting to vibe-kanban...</p>
        </div>
      </PageWrapper>
    );
  }

  // Error loading projects
  if (projectsError) {
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
            projectsError instanceof Error
              ? projectsError.message
              : "Failed to connect to vibe-kanban backend"
          }
          onRetry={() => refetchProjects()}
        />
      </PageWrapper>
    );
  }

  // No matching project found
  if (!vibeProject) {
    return (
      <PageWrapper className="flex flex-col h-full">
        <WorkspaceHeader
          workspace={workspace}
          segments={[{ label: t("workspace.kanban", "Task Board"), href: `/workspace/${workspaceId}/kanban` }]}
          showRefresh={false}
          showRemove={false}
        />
        <NoProjectState workspacePath={workspace.path} />
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
              : "Failed to load tasks"
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
            <Badge variant="outline" className="font-mono text-xs">
              {vibeProject.name}
            </Badge>
            <Button
              size="sm"
              onClick={() => handleAddTask(columnStatuses[0]?.id || "todo")}
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
          </>
        }
      />

      {/* Filter and Sort Bar */}
      <div className="px-4 py-2 border-b bg-muted/30">
        <div className="flex items-center gap-4 flex-wrap">
          {/* View Switcher */}
          <ViewSwitcher value={viewMode} onChange={setViewMode} />

          {/* Separator */}
          <div className="h-6 w-px bg-border" />

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
            {t("workspace.stats", "Stats")}
          </Button>

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
                  <p className="font-medium">{t("workspace.keyboardShortcuts", "Keyboard Shortcuts")}</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-muted-foreground">
                    <span>Arrow keys</span>
                    <span>{t("workspace.shortcut.navigate", "Navigate")}</span>
                    <span>Enter</span>
                    <span>{t("workspace.shortcut.open", "Open task")}</span>
                    <span>Escape</span>
                    <span>{t("workspace.shortcut.close", "Close panel")}</span>
                    <span>Cmd/Ctrl + K</span>
                    <span>{t("workspace.shortcut.command", "Commands")}</span>
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
      ) : (
        /* Main Content with TasksLayout for proper three-column responsive layout */
        <TasksLayout
          isPanelOpen={isPanelOpen}
          kanban={
            viewMode === "kanban" ? (
              /* Kanban View - horizontal scroll when columns exceed width */
              <div
                ref={keyboardContainerRef}
                className="h-full overflow-x-auto p-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                tabIndex={0}
                onKeyDown={handleKanbanKeyDown}
                role="application"
                aria-label={t("workspace.kanban", "Kanban board")}
              >
                <KanbanProvider
                  onDragEnd={handleDragEnd}
                  className="inline-grid grid-flow-col auto-cols-[280px] divide-x border-x items-stretch min-h-full"
                >
                  {columnStatuses.map((column) => {
                    const columnTasks = tasksByColumn[column.id] ?? [];

                    return (
                      <KanbanBoard key={column.id} id={column.id}>
                        <KanbanHeader
                          name={column.name}
                          color={COLUMN_COLOR_VARS[column.id as ColumnId]}
                          onAddTask={() => handleAddTask(column.id)}
                          addTaskLabel={t("workspace.addTask", "Add Task")}
                          taskCount={columnTasks.length}
                        />
                        <KanbanCards
                          className="flex-1 flex-col p-2 gap-2"
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
                                <KanbanCard
                                  id={task.id}
                                  name={task.title}
                                  index={index}
                                  parent={column.id}
                                  onClick={() => handleCardClick(task.id)}
                                  isOpen={selectedTaskId === task.id}
                                  tabIndex={selectedTaskId === task.id ? 0 : -1}
                                  showMoreMenu
                                >
                                  <TaskCardContent
                                    task={task}
                                    onTitleChange={(title) =>
                                      handleTitleChange(task.id, title)
                                    }
                                  />
                                </KanbanCard>
                              </motion.div>
                            ))}
                          </AnimatePresence>
                        </KanbanCards>
                      </KanbanBoard>
                    );
                  })}
                </KanbanProvider>
              </div>
            ) : (
              /* List View */
              <div className="h-full overflow-y-auto p-4">
                <ListView
                  items={sortedTasks}
                  selectedId={selectedTaskId ?? undefined}
                  onItemClick={(item) => handleCardClick(item.id)}
                  emptyMessage={t("workspace.noTasks", "No tasks found")}
                  renderItem={(item, itemIsSelected) => (
                    <ListViewItem
                      item={item}
                      onClick={() => handleCardClick(item.id)}
                      isSelected={itemIsSelected}
                      renderStatus={(task: TaskWithAttemptStatus) => {
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
                    </ListViewItem>
                  )}
                />
              </div>
            )
          }
          taskPanel={
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
              className="h-full border-l bg-background overflow-y-auto"
            >
              <TaskDetailPanel
                task={selectedTask}
                onClose={handleClosePanel}
                availableTasks={availableTasks}
                onNavigateToTask={handleNavigateToTask}
              />
            </motion.div>
          }
        />
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
      />
    </PageWrapper>
  );
}
