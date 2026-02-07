import { useState, useCallback, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import {
  Loader2,
  FolderOpen,
  Plus,
  Circle,
  ArrowUp,
  ArrowDown,
  ChevronDown,
  AlertCircle,
  RefreshCw,
  XCircle,
  ArrowLeft,
  Settings,
} from "lucide-react";
import { Group, Panel, Separator } from "react-resizable-panels";
import { Button } from "@/components/ui/button";
import {
  Badge,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
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
  PriorityIcon,
  TagBadge,
  AssigneeAvatar,
  DueDateBadge,
  ViewSwitcher,
  BulkActionsBar,
  SelectableCard,
  // Phase 4 components
  BoardSettingsDialog,
  GroupedListView,
  MultiDragOverlay,
  useDragPreview,
  useGroupedList,
  type DragEndEvent,
  type Status,
  type IssuePriority,
  type Tag,
  type Assignee,
  type KanbanFilter,
  type ViewMode,
  type ColumnConfig,
  type ListGroup,
  type DragItemProps,
} from "@viben/kanban";
import { PageWrapper } from "@/components/layout";
import { WorkspaceHeader, TaskDetailPanel } from "@/components/workspace";
import { useLocalWorkspaces } from "@/hooks";
import {
  useVibeKanbanTasks,
  useVibeKanbanProjects,
  useUpdateVibeKanbanTaskStatus,
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

// Default column colors mapping (CSS variable names without hsl() wrapper)
// KanbanHeader and BulkActionsBar expect variable names like "--muted"
// and wrap them internally with hsl(var(...))
const DEFAULT_COLUMN_COLORS: Record<ColumnId, string> = {
  todo: "--muted",
  "in-progress": "--primary",
  review: "--warning",
  done: "--success",
};

// Sort options
type SortField = "created" | "updated" | "title";
type SortDirection = "asc" | "desc";

// Extended task type to support new fields
interface EnhancedTask extends TaskWithAttemptStatus {
  priority?: IssuePriority;
  tags?: Tag[];
  assignee?: Assignee;
  dueDate?: string;
}

// Task Card Content Component - displays vibe-kanban task with enhanced fields
// Design follows vibe-kanban TaskCard.tsx pattern
function TaskCardContent({ task }: { task: EnhancedTask }) {
  return (
    <div className="flex flex-col gap-2 min-w-0">
      {/* Row 1: Header - Title with status icons on the right */}
      <div className="flex items-start gap-2">
        {/* Priority icon */}
        {task.priority && task.priority !== "none" && (
          <PriorityIcon priority={task.priority} size="sm" className="mt-0.5 shrink-0" />
        )}
        {/* Title - light weight, 2-line clamp */}
        <span className="line-clamp-2 font-light text-sm flex-1 min-w-0">
          {task.title}
        </span>
        {/* Status icons on the right */}
        <div className="flex items-center gap-1 shrink-0">
          {task.has_in_progress_attempt && (
            <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
          )}
          {task.last_attempt_failed && !task.has_in_progress_attempt && (
            <XCircle className="h-4 w-4 text-destructive" />
          )}
        </div>
      </div>

      {/* Row 2: Description - truncate at 130 chars */}
      {task.description && (
        <p className="text-sm text-secondary-foreground break-words m-0">
          {task.description.length > 130
            ? `${task.description.substring(0, 130)}...`
            : task.description}
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

      {/* Row 4: Bottom row - Assignee + Due Date */}
      {(task.assignee || task.dueDate) && (
        <div className="flex items-center gap-2 mt-0.5">
          {task.assignee && (
            <AssigneeAvatar assignee={task.assignee} size="sm" />
          )}
          {task.dueDate && (
            <DueDateBadge dueDate={task.dueDate} />
          )}
        </div>
      )}
    </div>
  );
}

// Sort Bar Component
function KanbanSortBar({
  sortField,
  sortDirection,
  onSortChange,
  onRefresh,
  isRefreshing,
}: {
  sortField: SortField;
  sortDirection: SortDirection;
  onSortChange: (field: SortField, direction: SortDirection) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
}) {
  const { t } = useTranslation();

  const sortOptions: { value: SortField; label: string }[] = [
    { value: "created", label: t("workspace.sort.created", "Created") },
    { value: "updated", label: t("workspace.sort.updated", "Updated") },
    { value: "title", label: t("workspace.sort.name", "Title") },
  ];

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Sort Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-8">
            {sortOptions.find((o) => o.value === sortField)?.label}
            {sortDirection === "asc" ? (
              <ArrowUp className="h-3 w-3 ml-1" />
            ) : (
              <ArrowDown className="h-3 w-3 ml-1" />
            )}
            <ChevronDown className="h-3 w-3 ml-1" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuLabel>{t("workspace.sortBy", "Sort by")}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {sortOptions.map((option) => (
            <DropdownMenuItem
              key={option.value}
              onClick={() =>
                onSortChange(
                  option.value,
                  sortField === option.value && sortDirection === "asc"
                    ? "desc"
                    : "asc"
                )
              }
            >
              {option.label}
              {sortField === option.value &&
                (sortDirection === "asc" ? (
                  <ArrowUp className="h-3 w-3 ml-auto" />
                ) : (
                  <ArrowDown className="h-3 w-3 ml-auto" />
                ))}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Refresh Button */}
      <Button
        variant="ghost"
        size="sm"
        className="h-8"
        onClick={onRefresh}
        disabled={isRefreshing}
      >
        <RefreshCw className={cn("h-3 w-3 mr-1", isRefreshing && "animate-spin")} />
        {t("common.refresh", "Refresh")}
      </Button>
    </div>
  );
}

// Build column statuses with translations
function useColumnStatuses(columnConfigs: ColumnConfig[]): Status[] {
  const { t } = useTranslation();

  return useMemo(() => {
    // Sort by order and filter visible
    const visibleConfigs = columnConfigs
      .filter((c) => c.visible)
      .sort((a, b) => a.order - b.order);

    return visibleConfigs.map((config) => ({
      id: config.id,
      name: config.name,
      color: config.color,
    }));
  }, [columnConfigs, t]);
}

// Default column configurations
function useDefaultColumnConfigs(): ColumnConfig[] {
  const { t } = useTranslation();

  return useMemo(() => COLUMN_IDS.map((id, index) => ({
    id,
    name: t(`workspace.kanbanStatus.${id === "in-progress" ? "inProgress" : id}`),
    color: DEFAULT_COLUMN_COLORS[id],
    visible: true,
    order: index,
  })), [t]);
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

// Grouped List Item Component for list view
function GroupedListItem({
  task,
  isSelected,
  onClick,
  dragProps,
  columnStatuses,
}: {
  task: EnhancedTask;
  isSelected: boolean;
  onClick: () => void;
  dragProps: DragItemProps;
  columnStatuses: Status[];
}) {
  const mappedColumn = STATUS_TO_COLUMN[task.status as VibeTaskStatus];
  const column = columnStatuses.find((c) => c.id === mappedColumn);

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-3 border-b cursor-pointer",
        "hover:bg-muted/50 transition-colors",
        isSelected && "bg-muted",
        dragProps.isDragging && "opacity-50"
      )}
      onClick={onClick}
    >
      {/* Drag handle - only show listeners/attributes if not dragging */}
      {dragProps.listeners && (
        <button
          type="button"
          className="cursor-grab touch-none p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          {...dragProps.attributes}
          {...dragProps.listeners}
        >
          <div className="w-4 h-4 flex flex-col justify-center gap-0.5">
            <div className="h-0.5 w-full bg-current rounded" />
            <div className="h-0.5 w-full bg-current rounded" />
          </div>
        </button>
      )}

      {/* Status indicator */}
      <div
        className="w-2 h-2 rounded-full shrink-0"
        style={{ backgroundColor: column?.color ? `hsl(var(${column.color}))` : "hsl(var(--muted))" }}
      />

      {/* Task content */}
      <div className="flex-1 min-w-0">
        <TaskCardContent task={task} />
      </div>

      {/* Status badge */}
      <Badge variant="outline" className="text-xs shrink-0">
        {column?.name || task.status}
      </Badge>
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
  const [sortField, setSortField] = useState<SortField>("created");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [filter, setFilter] = useState<KanbanFilter>({});
  const [viewMode, setViewMode] = useState<ViewMode>("kanban");

  // Phase 4: Board settings state
  const [settingsOpen, setSettingsOpen] = useState(false);
  const defaultColumnConfigs = useDefaultColumnConfigs();
  const [columnConfigs, setColumnConfigs] = useState<ColumnConfig[]>(defaultColumnConfigs);

  const columnStatuses = useColumnStatuses(columnConfigs);
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
  const createTask = useCreateVibeKanbanTask();

  // Apply filtering to tasks
  const filteredTasks = useFilteredItems(tasks ?? [], filter);

  // Multi-select for bulk actions
  const {
    selectedIds,
    selectedCount,
    isSelecting,
    toggleSelect,
    selectAll,
    clearSelection,
    isSelected,
  } = useMultiSelect(filteredTasks);

  // Phase 4: useDragPreview for enhanced drag experience
  const {
    isDragging,
    draggedIds,
    activeId,
    // handleDragStart - not used as KanbanProvider doesn't support onDragStart
  } = useDragPreview({
    selectedIds,
    onDragEnd: (event: DragEndEvent, ids: string[]) => {
      // Handle multi-drag - update all dragged items
      if (!vibeProject || !event.over) return;

      const newColumnId = event.over.id as string;
      const newStatus = COLUMN_TO_STATUS[newColumnId];

      if (!newStatus) return;

      // Update all dragged tasks
      for (const taskId of ids) {
        updateTaskStatus.mutate({
          taskId,
          status: newStatus,
          projectId: vibeProject.id,
        });
      }
    },
  });

  // Phase 4: useGroupedList for list view collapse state
  const {
    collapsedGroups,
    toggleGroup,
  } = useGroupedList({
    initialCollapsed: [],
  });

  // Create list groups from column statuses
  // Note: listGroups.color needs full hsl(var(...)) format for GroupedListView
  const listGroups: ListGroup[] = useMemo(() => {
    return columnStatuses.map((status) => ({
      id: status.id,
      name: status.name,
      color: status.color ? `hsl(var(${status.color}))` : "hsl(var(--muted))",
      count: (filteredTasks ?? []).filter((task: TaskWithAttemptStatus) => {
        const mappedColumn = STATUS_TO_COLUMN[task.status as VibeTaskStatus];
        return mappedColumn === status.id;
      }).length,
    }));
  }, [columnStatuses, filteredTasks]);

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

  // Sort and group tasks by column
  const tasksByColumn = useMemo(() => {
    const grouped: Record<string, TaskWithAttemptStatus[]> = {};

    for (const column of columnStatuses) {
      // Get tasks for this column (map vibe-kanban status to column id)
      let columnTasks = (filteredTasks ?? []).filter((task: TaskWithAttemptStatus) => {
        const mappedColumn = STATUS_TO_COLUMN[task.status as VibeTaskStatus];
        return mappedColumn === column.id;
      });

      // Sort tasks
      columnTasks = [...columnTasks].sort((a, b) => {
        let comparison = 0;
        switch (sortField) {
          case "created":
            comparison =
              new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
            break;
          case "updated":
            comparison =
              new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
            break;
          case "title":
            comparison = a.title.localeCompare(b.title);
            break;
        }
        return sortDirection === "desc" ? -comparison : comparison;
      });

      grouped[column.id] = columnTasks;
    }

    return grouped;
  }, [filteredTasks, columnStatuses, sortField, sortDirection]);

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

  // Add new task
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

  // Handle card click
  const handleCardClick = useCallback((taskId: string) => {
    setSelectedTaskId((prev) => (prev === taskId ? null : taskId));
  }, []);

  // Close detail panel
  const handleClosePanel = useCallback(() => {
    setSelectedTaskId(null);
  }, []);

  // Sort change
  const handleSortChange = useCallback(
    (field: SortField, direction: SortDirection) => {
      setSortField(field);
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
    console.log("Bulk delete not yet implemented", Array.from(selectedIds));
    clearSelection();
  }, [selectedIds, clearSelection]);

  // Phase 4: Handle column config changes
  const handleColumnConfigsChange = useCallback((newConfigs: ColumnConfig[]) => {
    setColumnConfigs(newConfigs);
  }, []);

  // Phase 4: Handle grouped list drag end
  const handleGroupedListDragEnd = useCallback(
    (_event: DragEndEvent, item: EnhancedTask, newGroupId: string) => {
      if (!vibeProject) return;

      const newStatus = COLUMN_TO_STATUS[newGroupId];
      if (!newStatus) return;

      updateTaskStatus.mutate({
        taskId: item.id,
        status: newStatus,
        projectId: vibeProject.id,
      });
    },
    [vibeProject, updateTaskStatus]
  );

  // Get group ID for a task (for GroupedListView)
  const getGroupId = useCallback((task: EnhancedTask) => {
    return STATUS_TO_COLUMN[task.status as VibeTaskStatus] || "todo";
  }, []);

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
            {/* Phase 4: Settings button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSettingsOpen(true)}
              className="h-8"
            >
              <Settings className="h-4 w-4" />
            </Button>
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

      {/* Phase 4: Board Settings Dialog */}
      <BoardSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        columns={columnConfigs}
        onColumnsChange={handleColumnConfigsChange}
      />

      {/* Filter and Sort Bar */}
      <div className="px-4 py-2 border-b bg-muted/30 overflow-hidden">
        <div className="flex items-center gap-3">
          {/* View Switcher */}
          <ViewSwitcher value={viewMode} onChange={setViewMode} />

          {/* Separator */}
          <div className="h-5 w-px bg-border shrink-0" />

          {/* Filter Bar */}
          <KanbanFilterBar
            filter={filter}
            onChange={setFilter}
            availableTags={[]}
            className="flex-1 min-w-0"
          />

          {/* Separator */}
          <div className="h-5 w-px bg-border shrink-0" />

          {/* Sort Controls */}
          <KanbanSortBar
            sortField={sortField}
            sortDirection={sortDirection}
            onSortChange={handleSortChange}
            onRefresh={handleRefresh}
            isRefreshing={isFetchingTasks}
          />
        </div>
      </div>

      {/* Loading tasks */}
      {isLoadingTasks ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        /* Main Content with Resizable Panels */
        <Group orientation="horizontal" className="flex-1 min-h-0">
          {/* Board/List Panel */}
          <Panel
            id="kanban-board"
            defaultSize={isPanelOpen ? 70 : 100}
            minSize={50}
          >
            {viewMode === "kanban" ? (
              /* Kanban View */
              <div className="h-full overflow-x-auto overflow-y-auto p-4">
                <KanbanProvider
                  onDragEnd={handleDragEnd}
                  className="h-full"
                >
                  {columnStatuses.map((column) => (
                    <KanbanBoard key={column.id} id={column.id} className="h-full flex flex-col">
                      <KanbanHeader
                        name={column.name}
                        color={column.color}
                        onAddTask={() => handleAddTask(column.id)}
                        addTaskLabel={t("workspace.addTask", "Add Task")}
                      />
                      <KanbanCards className="flex-1 min-h-0 p-2 space-y-2 overflow-y-auto">
                        {tasksByColumn[column.id]?.map((task, index) =>
                          isSelecting ? (
                            <SelectableCard
                              key={task.id}
                              id={task.id}
                              isSelected={isSelected(task.id)}
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
                              >
                                <TaskCardContent task={task} />
                              </KanbanCard>
                            </SelectableCard>
                          ) : (
                            <KanbanCard
                              key={task.id}
                              id={task.id}
                              name={task.title}
                              index={index}
                              parent={column.id}
                              onClick={() => handleCardClick(task.id)}
                              isOpen={selectedTaskId === task.id}
                            >
                              <TaskCardContent task={task} />
                            </KanbanCard>
                          )
                        )}
                        {tasksByColumn[column.id]?.length === 0 && (
                          <div className="py-8 text-center text-sm text-muted-foreground/60">
                            {t("workspace.noTasksInColumn", "No tasks")}
                          </div>
                        )}
                      </KanbanCards>
                    </KanbanBoard>
                  ))}

                  {/* Phase 4: Multi-drag overlay */}
                  <MultiDragOverlay
                    isDragging={isDragging}
                    draggedIds={draggedIds}
                    activeId={activeId}
                    renderItem={(id: string) => {
                      const task = filteredTasks.find((t: TaskWithAttemptStatus) => t.id === id);
                      if (!task) return null;
                      return (
                        <div className="bg-card border rounded-lg p-3 shadow-lg">
                          <TaskCardContent task={task} />
                        </div>
                      );
                    }}
                  />
                </KanbanProvider>
              </div>
            ) : (
              /* Phase 4: GroupedListView for List View */
              <div className="h-full overflow-y-auto p-4">
                <GroupedListView
                  items={filteredTasks}
                  groups={listGroups}
                  groupBy={getGroupId}
                  collapsedGroups={collapsedGroups}
                  onToggleGroup={toggleGroup}
                  onDragEnd={handleGroupedListDragEnd}
                  emptyMessage={t("workspace.noTasks", "No tasks found")}
                  renderItem={(item: EnhancedTask, dragProps: DragItemProps) => (
                    <GroupedListItem
                      task={item}
                      isSelected={selectedTaskId === item.id}
                      onClick={() => handleCardClick(item.id)}
                      dragProps={dragProps}
                      columnStatuses={columnStatuses}
                    />
                  )}
                />
              </div>
            )}
          </Panel>

          {/* Resize Handle */}
          {isPanelOpen && (
            <Separator
              id="kanban-separator"
              className="w-1 bg-border hover:bg-primary/50 transition-colors"
            />
          )}

          {/* Task Detail Panel */}
          {isPanelOpen && (
            <Panel id="task-detail" defaultSize={30} minSize={20} maxSize={50}>
              <div className="h-full border-l bg-background overflow-y-auto">
                <TaskDetailPanel
                  task={selectedTask}
                  onClose={handleClosePanel}
                  availableTasks={availableTasks}
                  onNavigateToTask={handleNavigateToTask}
                />
              </div>
            </Panel>
          )}
        </Group>
      )}

      {/* Bulk Actions Bar */}
      <BulkActionsBar
        selectedCount={selectedCount}
        totalCount={filteredTasks.length}
        onSelectAll={selectAll}
        onClearSelection={clearSelection}
        onBulkStatusChange={handleBulkStatusChange}
        onBulkDelete={handleBulkDelete}
        statuses={columnStatuses.map((c) => ({ id: c.id, name: c.name, color: c.color }))}
      />
    </PageWrapper>
  );
}
