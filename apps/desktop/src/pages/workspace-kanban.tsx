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
  X,
  AlertCircle,
  RefreshCw,
  Play,
  XCircle,
  ArrowLeft,
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
  type DragEndEvent,
  type Status,
} from "@viben/kanban";
import { PageWrapper } from "@/components/layout";
import { WorkspaceHeader } from "@/components/workspace";
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

// Column colors mapping
const COLUMN_COLORS: Record<ColumnId, string> = {
  todo: "--muted",
  "in-progress": "--primary",
  review: "--warning",
  done: "--success",
};

// Sort options
type SortField = "created" | "updated" | "title";
type SortDirection = "asc" | "desc";

// Task Card Content Component - displays vibe-kanban task
function TaskCardContent({ task }: { task: TaskWithAttemptStatus }) {
  return (
    <div className="flex flex-col gap-1.5 min-w-0">
      {/* Row 1: Title */}
      <span className="text-sm font-medium truncate">{task.title}</span>

      {/* Row 2: Description (truncated) */}
      {task.description && (
        <p className="text-xs text-muted-foreground m-0 line-clamp-2">
          {task.description}
        </p>
      )}

      {/* Row 3: Status indicators */}
      <div className="flex items-center gap-2 mt-1">
        {task.has_in_progress_attempt && (
          <Badge variant="secondary" className="text-xs px-1.5 py-0 gap-1">
            <Play className="h-3 w-3" />
            Running
          </Badge>
        )}
        {task.last_attempt_failed && (
          <Badge variant="destructive" className="text-xs px-1.5 py-0 gap-1">
            <XCircle className="h-3 w-3" />
            Failed
          </Badge>
        )}
        {task.executor && task.executor !== "unknown" && (
          <span className="text-xs text-muted-foreground truncate">
            {task.executor}
          </span>
        )}
      </div>
    </div>
  );
}

// Task Detail Panel Component
function TaskDetailPanel({
  task,
  onClose,
}: {
  task: TaskWithAttemptStatus | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();

  if (!task) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <p>{t("workspace.selectTaskToView", "Select a task to view details")}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <span className="font-mono text-sm text-muted-foreground truncate flex-1">
          {task.id.slice(0, 8)}...
        </span>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* Title */}
        <h2 className="text-xl font-semibold">{task.title}</h2>

        {/* Description */}
        {task.description && (
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-1">
              {t("workspace.description", "Description")}
            </h3>
            <p className="text-sm whitespace-pre-wrap">{task.description}</p>
          </div>
        )}

        {/* Status */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-1">
            Status
          </h3>
          <Badge variant="outline">{task.status}</Badge>
        </div>

        {/* Execution Status */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-1">
            Execution
          </h3>
          <div className="flex flex-wrap gap-2">
            {task.has_in_progress_attempt ? (
              <Badge variant="secondary" className="gap-1">
                <Play className="h-3 w-3" />
                Running
              </Badge>
            ) : task.last_attempt_failed ? (
              <Badge variant="destructive" className="gap-1">
                <XCircle className="h-3 w-3" />
                Last attempt failed
              </Badge>
            ) : (
              <Badge variant="outline">Idle</Badge>
            )}
            {task.executor && task.executor !== "unknown" && (
              <Badge variant="outline">{task.executor}</Badge>
            )}
          </div>
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-1">
              {t("workspace.created", "Created")}
            </h3>
            <p className="text-sm">
              {new Date(task.created_at).toLocaleDateString()}
            </p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-1">
              {t("workspace.updated", "Updated")}
            </h3>
            <p className="text-sm">
              {new Date(task.updated_at).toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>
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
  const [sortField, setSortField] = useState<SortField>("created");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

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
  const createTask = useCreateVibeKanbanTask();

  // Selected task
  const selectedTask = useMemo(() => {
    if (!selectedTaskId || !tasks) return null;
    return tasks.find((t) => t.id === selectedTaskId) ?? null;
  }, [selectedTaskId, tasks]);

  const isPanelOpen = selectedTaskId !== null;

  // Sort and group tasks by column
  const tasksByColumn = useMemo(() => {
    const grouped: Record<string, TaskWithAttemptStatus[]> = {};

    for (const column of columnStatuses) {
      // Get tasks for this column (map vibe-kanban status to column id)
      let columnTasks = (tasks ?? []).filter((task) => {
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
  }, [tasks, columnStatuses, sortField, sortDirection]);

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

      {/* Sort Bar */}
      <div className="px-4 py-2 border-b bg-muted/30">
        <KanbanSortBar
          sortField={sortField}
          sortDirection={sortDirection}
          onSortChange={handleSortChange}
          onRefresh={handleRefresh}
          isRefreshing={isFetchingTasks}
        />
      </div>

      {/* Loading tasks */}
      {isLoadingTasks ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        /* Main Content with Resizable Panels */
        <Group orientation="horizontal" className="flex-1 min-h-0">
          {/* Kanban Board Panel */}
          <Panel
            id="kanban-board"
            defaultSize={isPanelOpen ? 70 : 100}
            minSize={50}
          >
            <div className="h-full overflow-x-auto overflow-y-auto p-4">
              <KanbanProvider onDragEnd={handleDragEnd} className="h-full">
                {columnStatuses.map((column) => (
                  <KanbanBoard key={column.id} id={column.id} className="h-full">
                    <KanbanHeader
                      name={column.name}
                      color={column.color}
                      onAddTask={() => handleAddTask(column.id)}
                      addTaskLabel={t("workspace.addTask", "Add Task")}
                    />
                    <KanbanCards className="p-2 gap-2 overflow-y-auto">
                      {tasksByColumn[column.id]?.map((task, index) => (
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
                      ))}
                    </KanbanCards>
                  </KanbanBoard>
                ))}
              </KanbanProvider>
            </div>
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
                <TaskDetailPanel task={selectedTask} onClose={handleClosePanel} />
              </div>
            </Panel>
          )}
        </Group>
      )}
    </PageWrapper>
  );
}
