import { useState, useCallback, useMemo, useEffect } from "react";
import { arraysEqual } from "@/lib/utils";
import { useParams } from "react-router-dom";
import { useReducedMotion } from "framer-motion";
import {
  useFilteredItems,
  useMultiSelect,
  useKanbanStats,
  useCommandPalette,
  useSortedItems,
  useKanbanPreferences,
  useColumnCollapse,
  useColumnResize,
  type ColumnConfig,
  type KanbanFilter,
  type ViewMode,
  type SortMode,
  type SortDirection,
  type DragEndEvent,
} from "@viben/kanban";
import {
  useKanbanNavigation,
  type TaskForPanel,
  type CreateTaskData,
} from "@/components/workspace";
import { useLocalWorkspaces } from "@/hooks";
import {
  type TaskStatus as VibeTaskStatus,
  type KanbanColumnId,
  STATUS_TO_COLUMN,
  COLUMN_TO_STATUS,
  KANBAN_COLUMNS,
  isValidStatusTransition,
  getValidDropTargets,
} from "@/lib/kanban";
import { type LifecycleAction } from "@/hooks/use-kanban";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { COLUMN_COLORS, validatePriority } from "../constants";
import type { EnhancedTask, ColumnId } from "../types";
import { getLifecycleActionForStatusChange } from "../utils";
import { useColumnStatuses } from "./useColumnStatuses";
import { useKanbanData } from "./useKanbanData";
import { useKanbanCommands } from "./useKanbanCommands";

export function useKanbanBoard() {
  const { t } = useTranslation();
  const toast = useToast();
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const prefersReducedMotion = useReducedMotion();
  const {
    getWorkspace,
    isLoading: isLoadingWorkspaces,
    workspaces,
  } = useLocalWorkspaces();

  const workspace = workspaceId ? getWorkspace(workspaceId) : undefined;

  // ── Kanban preferences (persisted to localStorage) ──
  const {
    preferences,
    updatePreference,
  } = useKanbanPreferences({
    projectId: workspaceId ?? "default",
  });

  // Column collapse state (synced with preferences)
  const {
    collapsedColumns,
    toggleCollapse,
    expandAll,
    isCollapsed,
  } = useColumnCollapse(
    preferences.collapsedColumns.reduce<Record<string, boolean>>((acc, id) => ({ ...acc, [id]: true }), {})
  );

  // Sync collapsed columns to preferences
  useEffect(() => {
    const collapsed = Object.entries(collapsedColumns)
      .filter(([_, v]) => v)
      .map(([id]) => id);
    if (!arraysEqual(collapsed, preferences.collapsedColumns)) {
      updatePreference("collapsedColumns", collapsed);
    }
  }, [collapsedColumns, preferences.collapsedColumns, updatePreference]);

  // Column resize state (synced with preferences)
  const {
    widths: _columnWidths,
    isResizing,
    getWidth,
    isLocked: isColumnLocked,
    startResize,
    setLockedColumns,
  } = useColumnResize({
    minWidth: 200,
    maxWidth: 600,
    defaultWidth: 280,
    initialWidths: preferences.columnWidths,
    lockedColumns: preferences.lockedColumns,
    onWidthChange: (columnId: string, width: number) => {
      updatePreference("columnWidths", {
        ...preferences.columnWidths,
        [columnId]: width,
      });
    },
  });

  // Toggle column lock
  const toggleColumnLock = useCallback(
    (columnId: string) => {
      const newLocked = preferences.lockedColumns.includes(columnId)
        ? preferences.lockedColumns.filter((id) => id !== columnId)
        : [...preferences.lockedColumns, columnId];
      updatePreference("lockedColumns", newLocked);
      setLockedColumns(newLocked);
    },
    [preferences.lockedColumns, updatePreference, setLockedColumns]
  );

  // ── UI state ──
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [filter, setFilter] = useState<KanbanFilter>({});
  const [autoStartTaskOnOpen, setAutoStartTaskOnOpen] = useState(false);

  // Use preferences for view/sort state
  const viewMode = preferences.viewMode;
  const sortMode = preferences.sortMode === "manual" ? "createdAt" : preferences.sortMode as SortMode;
  const sortDirection = preferences.sortDirection;
  const showStats = preferences.showStats;

  // Setters that update preferences
  const setViewMode = useCallback((mode: ViewMode) => {
    updatePreference("viewMode", mode);
  }, [updatePreference]);

  const setSortMode = useCallback((mode: SortMode) => {
    updatePreference("sortMode", mode);
  }, [updatePreference]);

  const setSortDirection = useCallback((direction: SortDirection) => {
    updatePreference("sortDirection", direction);
  }, [updatePreference]);

  const setShowStats = useCallback((show: boolean | ((prev: boolean) => boolean)) => {
    if (typeof show === "function") {
      updatePreference("showStats", show(preferences.showStats));
    } else {
      updatePreference("showStats", show);
    }
  }, [updatePreference, preferences.showStats]);

  const collapsedCount = Object.values(collapsedColumns).filter(Boolean).length;

  // Create task dialog state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createDialogColumnId, setCreateDialogColumnId] = useState<string>("backlog");

  // Board settings dialog state
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Queue settings modal state
  const [queueSettingsOpen, setQueueSettingsOpen] = useState(false);

  // Command palette state
  const { isOpen: isCommandPaletteOpen, setIsOpen: setIsCommandPaletteOpen } =
    useCommandPalette();

  const columnStatuses = useColumnStatuses();

  // Build column configs from column statuses
  const columnConfigs = useMemo<ColumnConfig[]>(() => {
    return KANBAN_COLUMNS.map((id, index) => ({
      id,
      name: columnStatuses.find((c) => c.id === id)?.name ?? id,
      color: COLUMN_COLORS[id],
      visible: true,
      order: index,
    }));
  }, [columnStatuses]);

  // Handle column config changes from settings dialog
  const handleColumnsChange = useCallback((_columns: ColumnConfig[]) => {
    setSettingsOpen(false);
  }, []);

  // ── Data fetching ──
  const {
    tasks,
    isLoadingTasks,
    isFetchingTasks,
    tasksError,
    refetchTasks,
    taskLifecycle,
    updateTask,
    createTask,
    availableAgents,
    availableModels,
    defaultAgentId,
    defaultModelId,
    isLoadingAgents,
    isLoadingModels,
    queueStore,
  } = useKanbanData(workspace);

  const {
    maxParallelTasks,
    setMaxParallelTasks,
    showArchived,
    toggleShowArchived,
    archivedTaskIds,
    archiveTask,
    archiveAllDone,
    queueAllBacklogTasks,
    updateGatewayMaxConcurrency,
    isLoadingGatewayStatus,
  } = queueStore;

  // ── Derived state ──

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
  const statsItems = useMemo(() =>
    (tasks ?? []).map((t) => ({
      id: t.id,
      status: t.status,
      priority: validatePriority(t.priority),
      dueDate: undefined as string | undefined,
    })),
    [tasks]
  );
  const stats = useKanbanStats(statsItems);

  // Multi-select for bulk actions
  const {
    selectedIds,
    selectedCount,
    isSelecting,
    toggleSelect,
    isSelected: isMultiSelected,
    selectAll,
    clearSelection,
    toggleSubset,
    isSubsetAllSelected,
    isSubsetSomeSelected,
  } = useMultiSelect(sortedTasks, {
    persistence: {
      projectId: workspaceId ?? "",
      enabled: !!workspaceId,
    },
  });

  // Selected task - transform to TaskForPanel
  const selectedTask = useMemo<TaskForPanel | null>(() => {
    if (!selectedTaskId || !tasks) return null;
    const task = tasks.find((t) => t.id === selectedTaskId);
    if (!task) return null;
    return {
      id: task.id,
      name: task.name,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: validatePriority(task.priority),
      tags: undefined,
      assignee: undefined,
      dueDate: undefined,
      created_at: task.created_at,
      updated_at: task.updated_at,
      session_id: task.session_id,
      agent_id: task.agent_id,
      executor: task.executor,
      branch: task.branch,
      base_branch: task.base_branch,
      pr_url: task.pr_url,
      worktree_path: task.worktree_path,
      workspace_path: task.workspace_path,
      creator: task.creator,
      current_phase: task.current_phase,
      next_action: task.next_action,
    };
  }, [selectedTaskId, tasks]);

  // Available tasks for relationships
  const availableTasks = useMemo(() => {
    return (tasks ?? []).map((t) => ({ id: t.id, title: t.title }));
  }, [tasks]);

  const isPanelOpen = selectedTaskId !== null;

  // Group tasks by column
  const tasksByColumn = useMemo(() => {
    const grouped: Record<string, EnhancedTask[]> = {};

    for (const column of columnStatuses) {
      let columnTasks = (sortedTasks ?? []).filter((task) => {
        const mappedColumn = STATUS_TO_COLUMN[task.status as VibeTaskStatus];
        return mappedColumn === column.id;
      });

      if (column.id === "completed" && !showArchived) {
        columnTasks = columnTasks.filter((task) => !archivedTaskIds.includes(task.id));
      }

      grouped[column.id] = columnTasks;
    }

    return grouped;
  }, [sortedTasks, columnStatuses, showArchived, archivedTaskIds]);

  // Count archived tasks in Completed column
  const archivedCompletedCount = useMemo(() => {
    const completedTasks = (sortedTasks ?? []).filter((task) => {
      const mappedColumn = STATUS_TO_COLUMN[task.status as VibeTaskStatus];
      return mappedColumn === "completed";
    });
    return completedTasks.filter((task) => archivedTaskIds.includes(task.id)).length;
  }, [sortedTasks, archivedTaskIds]);

  // ── Action handlers ──
  // All callbacks close over local variables directly — no params interface needed.

  // Drag state
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [validDropTargets, setValidDropTargets] = useState<KanbanColumnId[]>([]);

  // Handle drag end - move task to new status with transition validation
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setDraggingTaskId(null);
      setValidDropTargets([]);

      const { active, over } = event;
      if (!over || !workspace) return;

      const taskId = active.id as string;
      const newColumnId = over.id as ColumnId;
      const newStatus = COLUMN_TO_STATUS[newColumnId];
      if (!newStatus) return;

      const task = sortedTasks.find((t) => t.id === taskId);
      if (!task) return;

      const currentStatus = task.status as VibeTaskStatus;
      const currentColumn = STATUS_TO_COLUMN[currentStatus];

      if (currentColumn === newColumnId) return;

      if (!isValidStatusTransition(currentStatus, newColumnId)) {
        toast.error(
          t("workspace.invalidTransition", "Cannot move task from {{from}} to {{to}}", {
            from: t(`workspace.column.${currentColumn}`, currentColumn),
            to: t(`workspace.column.${newColumnId}`, newColumnId),
          })
        );
        return;
      }

      const isMovingToInProgress = newStatus === "in_progress" && currentStatus !== "in_progress";

      const action = getLifecycleActionForStatusChange(currentStatus, newStatus);
      if (action) {
        taskLifecycle.mutate({
          action,
          workspace_path: workspace.path,
          task_id: taskId,
        });
      }

      if (isMovingToInProgress) {
        setSelectedTaskId(taskId);
        setAutoStartTaskOnOpen(true);
      }
    },
    [workspace, taskLifecycle, sortedTasks, toast, t]
  );

  // Handle drag start - compute valid drop targets for visual feedback
  const handleDragStart = useCallback(
    (activeId: string) => {
      setDraggingTaskId(activeId);
      const task = sortedTasks.find((t) => t.id === activeId);
      if (task) {
        const currentStatus = task.status as VibeTaskStatus;
        const targets = getValidDropTargets(currentStatus);
        setValidDropTargets(targets);
      }
    },
    [sortedTasks]
  );

  // Handle drag cancel - clear visual feedback state
  const handleDragCancel = useCallback(() => {
    setDraggingTaskId(null);
    setValidDropTargets([]);
  }, []);

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
      if (!workspace) return;

      try {
        await createTask.mutateAsync({
          workspace_path: workspace.path,
          title: data.title,
          description: data.description ?? undefined,
          agent_id: data.agentId,
          model_id: data.modelId,
          auto_start: data.autoStart,
          worktree: data.worktree,
        });
        toast.success(t("workspace.taskCreated", "Task created successfully"));
      } catch (error) {
        const message = error instanceof Error ? error.message : t("common.unknownError", "Unknown error");
        toast.error(t("workspace.taskCreateFailed", "Failed to create task: {{message}}", { message }));
        throw error;
      }
    },
    [workspace, createTask, toast, t]
  );

  // Handle inline title edit
  const handleTitleChange = useCallback(
    (taskId: string, newTitle: string) => {
      if (!workspace) return;
      updateTask.mutate({
        taskId,
        data: { title: newTitle },
        workspacePath: workspace.path,
      });
    },
    [workspace, updateTask]
  );

  // Handle task update from detail panel
  const handleTaskUpdate = useCallback(
    (updates: Record<string, unknown>) => {
      if (!workspace || !selectedTaskId) return;
      updateTask.mutate({
        taskId: selectedTaskId,
        data: updates,
        workspacePath: workspace.path,
      });
    },
    [workspace, selectedTaskId, updateTask]
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
    (mode: SortMode, direction: SortDirection) => {
      setSortMode(mode);
      setSortDirection(direction);
    },
    [setSortMode, setSortDirection]
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
      if (!workspace) return;
      const newStatus = COLUMN_TO_STATUS[status as ColumnId];
      if (!newStatus) return;

      for (const taskId of selectedIds) {
        const task = sortedTasks.find((t) => t.id === taskId);
        const currentStatus = task?.status as VibeTaskStatus | undefined;
        const action = getLifecycleActionForStatusChange(currentStatus, newStatus);
        if (action) {
          taskLifecycle.mutate({
            action,
            workspace_path: workspace.path,
            task_id: taskId,
          });
        }
      }
      clearSelection();
    },
    [workspace, selectedIds, taskLifecycle, sortedTasks, clearSelection]
  );

  // Bulk delete (placeholder)
  const handleBulkDelete = useCallback(() => {
    clearSelection();
  }, [clearSelection]);

  // Handle move task to column
  const handleMoveToColumn = useCallback(
    (taskId: string, columnId: string) => {
      if (!workspace) return;
      const newStatus = COLUMN_TO_STATUS[columnId as ColumnId];
      if (!newStatus) return;

      const task = sortedTasks.find((t) => t.id === taskId);
      const currentStatus = task?.status as VibeTaskStatus | undefined;
      const action = getLifecycleActionForStatusChange(currentStatus, newStatus);
      if (action) {
        taskLifecycle.mutate({
          action,
          workspace_path: workspace.path,
          task_id: taskId,
        });
      }
    },
    [workspace, taskLifecycle, sortedTasks]
  );

  // Handle duplicate task
  const handleDuplicateTask = useCallback(
    (taskId: string) => {
      if (!workspace) return;
      const task = sortedTasks.find((t) => t.id === taskId);
      if (!task) return;

      createTask.mutate({
        workspace_path: workspace.path,
        title: `${task.title} (copy)`,
        description: task.description ?? undefined,
      });
    },
    [workspace, sortedTasks, createTask]
  );

  // Handle delete task (placeholder)
  const handleDeleteTask = useCallback(
    (_taskId: string) => {
      // TODO: Implement delete when API is available
    },
    []
  );

  // Handle start task - enqueue the task to be automatically picked up
  const handleStartTask = useCallback(
    (taskId: string) => {
      if (!workspace) return;
      taskLifecycle.mutate({
        action: "enqueue",
        workspace_path: workspace.path,
        task_id: taskId,
      });
    },
    [workspace, taskLifecycle]
  );

  // Queue All - move all backlog tasks to queue
  const handleQueueAll = useCallback(() => {
    if (!workspace) return;
    const backlogTasks = tasksByColumn["backlog"] ?? [];
    if (backlogTasks.length === 0) return;

    const taskIds = backlogTasks.map((t) => t.id);
    queueAllBacklogTasks(taskIds).catch((error) => {
      console.error("[WorkspaceKanban] Queue all batch enqueue failed:", error);
    });

    for (const task of backlogTasks) {
      taskLifecycle.mutate({
        action: "enqueue",
        workspace_path: workspace.path,
        task_id: task.id,
      });
    }
    toast.success(
      t("workspace.queueAllSuccess", "Queued {{count}} tasks", { count: backlogTasks.length })
    );
  }, [workspace, tasksByColumn, taskLifecycle, queueAllBacklogTasks, toast, t]);

  // Archive All - archive all completed tasks
  const handleArchiveAll = useCallback(() => {
    const completedTasks = tasksByColumn["completed"] ?? [];
    const taskIds = completedTasks.map((t) => t.id);
    if (taskIds.length === 0) return;

    archiveAllDone(taskIds);
    toast.success(
      t("workspace.archiveAllSuccess", "Archived {{count}} tasks", { count: taskIds.length })
    );
  }, [tasksByColumn, archiveAllDone, toast, t]);

  // Archive single task
  const handleArchiveTask = useCallback(
    (taskId: string) => {
      archiveTask(taskId);
      toast.success(t("workspace.taskArchived", "Task archived"));
    },
    [archiveTask, toast, t]
  );

  // Stop task
  const handleStopTask = useCallback(
    (taskId: string) => {
      if (!workspace) return;
      taskLifecycle.mutate({
        action: "stop",
        workspace_path: workspace.path,
        task_id: taskId,
      });
      toast.success(t("workspace.taskStopped", "Task stopped"));
    },
    [workspace, taskLifecycle, toast, t]
  );

  // View PR - open in browser
  const handleViewPR = useCallback(
    (prUrl: string) => {
      if (prUrl) {
        window.open(prUrl, "_blank", "noopener,noreferrer");
      }
    },
    []
  );

  // Resume task - for paused or failed/incomplete tasks
  const handleResumeTask = useCallback(
    (taskId: string) => {
      if (!workspace) return;
      const task = sortedTasks.find((t) => t.id === taskId);
      const action: LifecycleAction = task?.status === "paused" ? "resume" : "retry";
      taskLifecycle.mutate({
        action,
        workspace_path: workspace.path,
        task_id: taskId,
      });
    },
    [workspace, taskLifecycle, sortedTasks]
  );

  // Recover task - for stuck tasks
  const handleRecoverTask = useCallback(
    (taskId: string) => {
      if (!workspace) return;
      taskLifecycle.mutate({
        action: "retry",
        workspace_path: workspace.path,
        task_id: taskId,
      });
      toast.success(t("workspace.taskRecovered", "Task recovered and restarted"));
    },
    [workspace, taskLifecycle, toast, t]
  );

  // Approve a task in review
  const handleApproveTask = useCallback(
    async (taskId: string) => {
      if (!workspace) return;

      try {
        await taskLifecycle.mutateAsync({
          action: "approve",
          workspace_path: workspace.path,
          task_id: taskId,
        });
        toast.success(t("workspace.taskActions.approved", "Task approved"));
      } catch (error) {
        const message = error instanceof Error ? error.message : t("common.unknownError", "Unknown error");
        toast.error(t("workspace.taskActions.approveFailed", "Failed to approve task"), {
          description: message,
        });
      }
    },
    [workspace, taskLifecycle, toast, t]
  );

  // Reject a task in review
  const handleRejectTask = useCallback(
    async (taskId: string) => {
      if (!workspace) return;

      try {
        await taskLifecycle.mutateAsync({
          action: "reject",
          workspace_path: workspace.path,
          task_id: taskId,
        });
        toast.success(t("workspace.taskActions.rejected", "Task sent back for revision"));
      } catch (error) {
        const message = error instanceof Error ? error.message : t("common.unknownError", "Unknown error");
        toast.error(t("workspace.taskActions.rejectFailed", "Failed to reject task"), {
          description: message,
        });
      }
    },
    [workspace, taskLifecycle, toast, t]
  );

  // ── Keyboard navigation ──
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

  // ── Commands ──
  const commands = useKanbanCommands({
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
  });

  return {
    // Route / workspace
    workspaceId,
    workspace,
    isLoadingWorkspaces,
    workspaces,
    t,
    prefersReducedMotion,

    // Tasks
    tasks,
    isLoadingTasks,
    isFetchingTasks,
    tasksError,
    sortedTasks,
    tasksByColumn,

    // Selected task
    selectedTaskId,
    setSelectedTaskId,
    selectedTask,
    isPanelOpen,
    availableTasks,
    autoStartTaskOnOpen,
    setAutoStartTaskOnOpen,

    // Preferences
    viewMode,
    sortMode,
    sortDirection,
    showStats,
    setViewMode,
    setShowStats,

    // Column state
    columnStatuses,
    columnConfigs,
    collapsedColumns,
    collapsedCount,
    isCollapsed,
    toggleCollapse,
    expandAll,
    getWidth,
    isResizing,
    isColumnLocked,
    toggleColumnLock,
    startResize,

    // Filter / sort
    filter,
    setFilter,

    // Stats
    stats,

    // Multi-select
    selectedIds,
    selectedCount,
    isSelecting,
    toggleSelect,
    isMultiSelected,
    selectAll,
    clearSelection,
    toggleSubset,
    isSubsetAllSelected,
    isSubsetSomeSelected,

    // Agents / Models
    availableAgents,
    availableModels,
    defaultAgentId,
    defaultModelId,
    isLoadingAgents,
    isLoadingModels,

    // Queue
    maxParallelTasks,
    showArchived,
    toggleShowArchived,
    archivedCompletedCount,

    // Create task dialog
    createDialogOpen,
    setCreateDialogOpen,
    createDialogColumnId,
    createTask,

    // Settings dialogs
    settingsOpen,
    setSettingsOpen,
    queueSettingsOpen,
    setQueueSettingsOpen,
    handleColumnsChange,

    // Command palette
    commands,
    isCommandPaletteOpen,
    setIsCommandPaletteOpen,

    // Keyboard navigation
    handleKanbanKeyDown,
    keyboardContainerRef,

    // Drag state
    draggingTaskId,
    validDropTargets,

    // Drag handlers
    handleDragEnd,
    handleDragStart,
    handleDragCancel,

    // Task CRUD
    handleAddTask,
    handleCreateTaskSubmit,
    handleTitleChange,
    handleTaskUpdate,

    // Card interaction
    handleCardClick,
    handleClosePanel,

    // Sort/Refresh/Navigate
    handleSortChange,
    handleRefresh,
    handleNavigateToTask,

    // Task lifecycle
    handleStartTask,
    handleStopTask,
    handleResumeTask,
    handleRecoverTask,
    handleApproveTask,
    handleRejectTask,
    handleViewPR,
    handleArchiveTask,

    // Bulk actions
    handleBulkStatusChange,
    handleBulkDelete,
    handleQueueAll,
    handleArchiveAll,

    // Other
    handleMoveToColumn,
    handleDuplicateTask,
    handleDeleteTask,

    // Queue store methods needed by modals
    updateGatewayMaxConcurrency,
    setMaxParallelTasks,
    isLoadingGatewayStatus,

    // Refetch
    refetchTasks,
  };
}

export type UseKanbanBoardReturn = ReturnType<typeof useKanbanBoard>;
