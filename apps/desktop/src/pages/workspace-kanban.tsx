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
  Pencil,
  Copy,
  Trash2,
  MoreHorizontal,
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
  CreateTaskDialog,
  type CreateTaskData,
} from "@/components/workspace";
import { useLocalWorkspaces, useAgents, useModels } from "@/hooks";
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
  const { t } = useTranslation();
  const hasMeta = task.assignee || task.dueDate || task.has_in_progress_attempt || task.last_attempt_failed;

  return (
    <div className="flex flex-col gap-2 min-w-0">
      {/* Row 1: Title with optional priority indicator */}
      <div className="flex items-start gap-2">
        {task.priority && task.priority !== "none" && (
          <div className="shrink-0 mt-0.5">
            <PriorityIcon priority={task.priority} size="sm" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          {onTitleChange ? (
            <EditableCardTitle
              value={task.title}
              onChange={onTitleChange}
              className="text-sm leading-snug"
            />
          ) : (
            <span className="text-sm leading-snug line-clamp-2">{task.title}</span>
          )}
        </div>
      </div>

      {/* Row 2: Description (truncated) */}
      {task.description && (
        <p className="text-xs text-muted-foreground/80 m-0 line-clamp-2 leading-relaxed">
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
            <span className="text-[10px] text-muted-foreground/60 ml-0.5">
              +{task.tags.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Row 4: Bottom row - Assignee, Due Date, Execution Status */}
      {hasMeta && (
        <div className="flex items-center gap-1.5 pt-1 border-t border-border/30">
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
            <Badge variant="secondary" className="h-5 text-[10px] px-1.5 py-0 gap-1 rounded">
              <Play className="h-2.5 w-2.5" />
              {t("common.running")}
            </Badge>
          )}
          {task.last_attempt_failed && !task.has_in_progress_attempt && (
            <Badge variant="destructive" className="h-5 text-[10px] px-1.5 py-0 gap-1 rounded">
              <XCircle className="h-2.5 w-2.5" />
              {t("workspace.failed")}
            </Badge>
          )}
        </div>
      )}
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

// No project found state
function NoProjectState({ workspacePath }: { workspacePath: string }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center h-[60vh] text-center px-4">
      <Circle className="h-12 w-12 text-muted-foreground mb-4" />
      <h2 className="text-xl font-semibold mb-2">{t("workspace.noProjectFound")}</h2>
      <p className="text-muted-foreground mb-4 max-w-md">
        {t("workspace.noProjectFoundDesc")}
      </p>
      <code className="text-sm bg-muted px-3 py-1 rounded">{workspacePath}</code>
      <p className="text-muted-foreground mt-4 text-sm">
        {t("workspace.createProjectFirst")}
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

  // Create task dialog state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createDialogColumnId, setCreateDialogColumnId] = useState<string>("todo");

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
      if (!vibeProject) return;

      const status = COLUMN_TO_STATUS[createDialogColumnId] ?? "todo";

      await createTask.mutateAsync({
        project_id: vibeProject.id,
        title: data.title,
        description: data.description ?? null,
        status,
      });
    },
    [vibeProject, createTask, createDialogColumnId]
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

  // Close more menu helper (for dropdown menu callbacks)
  const closeMoreMenu = useCallback(() => {
    // Dropdown menu handles its own close state
  }, []);

  // Handle move task to column
  const handleMoveToColumn = useCallback(
    (taskId: string, columnId: string) => {
      if (!vibeProject) return;
      const newStatus = COLUMN_TO_STATUS[columnId];
      if (!newStatus) return;

      updateTaskStatus.mutate({
        taskId,
        status: newStatus,
        projectId: vibeProject.id,
      });
      closeMoreMenu();
    },
    [vibeProject, updateTaskStatus, closeMoreMenu]
  );

  // Handle duplicate task
  const handleDuplicateTask = useCallback(
    (taskId: string) => {
      if (!vibeProject) return;
      const task = sortedTasks.find((t) => t.id === taskId);
      if (!task) return;

      createTask.mutate({
        project_id: vibeProject.id,
        title: `${task.title} (copy)`,
        description: task.description ?? null,
        status: task.status,
      });
      closeMoreMenu();
    },
    [vibeProject, sortedTasks, createTask, closeMoreMenu]
  );

  // Handle delete task (placeholder)
  const handleDeleteTask = useCallback(
    (_taskId: string) => {
      // TODO: Implement delete when API is available
      closeMoreMenu();
    },
    [closeMoreMenu]
  );

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
          <p className="text-muted-foreground">{t("workspace.connectingToKanban", "Connecting to vibe-kanban...")}</p>
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
              : t("workspace.kanbanConnectionFailed", "Failed to connect to vibe-kanban backend")
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
          <ViewSwitcher
            value={viewMode}
            onChange={setViewMode}
            labels={{
              kanban: t("workspace.viewMode.kanban", "Kanban"),
              list: t("workspace.viewMode.list", "List"),
            }}
          />

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
            {t("workspace.stats")}
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
      ) : (
        /* Main Content with TasksLayout for proper three-column responsive layout */
        <TasksLayout
          isPanelOpen={isPanelOpen}
          kanban={
            viewMode === "kanban" ? (
              /* Kanban View - horizontal scroll when columns exceed width */
              <div
                ref={keyboardContainerRef}
                className="h-full overflow-x-auto focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                tabIndex={0}
                onKeyDown={handleKanbanKeyDown}
                role="application"
                aria-label={t("workspace.kanban", "Kanban board")}
              >
                <KanbanProvider
                  onDragEnd={handleDragEnd}
                  renderDragOverlay={(activeId) => {
                    if (!activeId) return null;
                    const task = sortedTasks.find((t) => t.id === activeId);
                    if (!task) return null;
                    return (
                      <div className="p-3 bg-card rounded-lg border border-primary/40 shadow-2xl scale-[1.02]">
                        <TaskCardContent task={task} />
                      </div>
                    );
                  }}
                >
                  {columnStatuses.map((column) => {
                    const columnTasks = tasksByColumn[column.id] ?? [];
                    const colorVar = COLUMN_COLOR_VARS[column.id as ColumnId];

                    return (
                      <KanbanBoard key={column.id} id={column.id} backgroundColor={colorVar}>
                        <KanbanHeader
                          name={column.name}
                          color={colorVar}
                          onAddTask={() => handleAddTask(column.id)}
                          addTaskLabel={t("workspace.addTask", "Add Task")}
                          taskCount={columnTasks.length}
                        />
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
                                <KanbanCard
                                  id={task.id}
                                  name={task.title}
                                  index={index}
                                  parent={column.id}
                                  onClick={() => handleCardClick(task.id)}
                                  isOpen={selectedTaskId === task.id}
                                  tabIndex={selectedTaskId === task.id ? 0 : -1}
                                  showMoreMenu
                                  renderMoreMenu={() => (
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-6 w-6 rounded-md hover:bg-muted/80 text-muted-foreground hover:text-foreground"
                                        >
                                          <MoreHorizontal className="h-4 w-4" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end" className="w-48">
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
        labels={{
          noResults: t("workspace.commandPalette.noResults", "No matching commands"),
          navigation: t("workspace.commandPalette.navigation", "Navigation"),
          action: t("workspace.commandPalette.action", "Action"),
          view: t("workspace.commandPalette.view", "View"),
          filter: t("workspace.commandPalette.filter", "Filter"),
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
    </PageWrapper>
  );
}
