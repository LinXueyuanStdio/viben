/**
 * Task Actions Hook
 *
 * Consolidates all task-related operations from workspace-kanban.tsx
 * including CRUD operations, status changes, and batch operations.
 */

import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  useTaskLifecycle,
  _useUpdateTask,
  _useCreateTask,
  _useDeleteTask,
  type LifecycleAction,
} from "@/hooks/use-kanban";
import { useWorkspaceKanbanQueue } from "@/stores/kanban-queue-store";
import {
  COLUMN_TO_STATUS,
  type KanbanColumnId,
  type TaskWithAttemptStatus,
  type TaskStatus,
} from "@/lib/kanban";
import { toast } from "@/hooks/use-toast";
import type { CreateTaskData } from "../create-task-dialog";
import type { TaskActions } from "../types";

/**
 * Maps a status transition to the appropriate lifecycle action
 *
 * @param fromStatus - Current task status (optional, used for context-aware mapping)
 * @param toStatus - Target task status
 * @returns The lifecycle action to use, or null if no direct mapping exists
 */
function getLifecycleActionForStatusChange(
  fromStatus: TaskStatus | undefined,
  toStatus: TaskStatus
): LifecycleAction | null {
  // Context-aware mappings (depend on current status)
  if (toStatus === "backlog") {
    if (fromStatus === "queue") return "dequeue";
    if (fromStatus === "review") return "reject";
    // For other statuses going to backlog, use dequeue as fallback
    return "dequeue";
  }

  if (toStatus === "in_progress") {
    if (fromStatus === "paused") return "resume";
    // For queue -> in_progress, use start
    return "start";
  }

  // Simple status -> action mappings
  const statusToAction: Partial<Record<TaskStatus, LifecycleAction>> = {
    queue: "enqueue",
    paused: "pause",
    completed: "approve",
    cancelled: "cancel",
    archived: "archive",
  };

  return statusToAction[toStatus] ?? null;
}

// Re-export CreateTaskData for convenience
export type { CreateTaskData } from "../create-task-dialog";

/**
 * Options for the useTaskActions hook
 */
export interface UseTaskActionsOptions {
  /** Workspace path for API calls */
  workspacePath: string | undefined;
  /** All tasks in the kanban (for duplicate operation) */
  tasks?: TaskWithAttemptStatus[];
  /** Callback on successful operation */
  onSuccess?: (message: string) => void;
  /** Callback on operation error */
  onError?: (message: string) => void;
}

/**
 * Return type of useTaskActions hook
 */
export interface TaskActionsResult extends TaskActions {
  // Batch operations
  /** Queue all tasks from backlog */
  queueAll: (taskIds: string[]) => Promise<void>;
  /** Archive all completed tasks */
  archiveAll: (taskIds: string[]) => void;
  /** Change status for multiple tasks */
  bulkStatusChange: (taskIds: string[], status: string) => void;
  /** Delete multiple tasks */
  bulkDelete: (taskIds: string[]) => void;

  // Create task
  /** Create a new task */
  createTask: (data: CreateTaskData, columnId: string) => Promise<void>;
  /** Whether task creation is in progress */
  isCreating: boolean;
}

/**
 * Hook that provides all task-related actions for the kanban board
 *
 * Extracts task operations from workspace-kanban.tsx for better modularity
 * and reusability.
 *
 * @param options - Configuration options including workspace path and callbacks
 * @returns Task actions and mutation states
 */
export function useTaskActions(options: UseTaskActionsOptions): TaskActionsResult {
  const { workspacePath, tasks = [], onSuccess, onError } = options;
  const { t } = useTranslation();

  // Mutations from use-kanban
  const taskLifecycle = useTaskLifecycle();
  const updateTask = _useUpdateTask();
  const createTaskMutation = _useCreateTask();
  const deleteTaskMutation = _useDeleteTask();

  // Queue store actions
  const {
    archiveTask,
    archiveAllDone,
    queueAllBacklogTasks,
  } = useWorkspaceKanbanQueue(workspacePath);

  // Creating state
  const [isCreating, setIsCreating] = useState(false);

  // ==========================================
  // Single Task Actions
  // ==========================================

  /**
   * Start/Queue a task for execution
   * Moves task to "queue" status where it will be automatically picked up
   */
  const onStart = useCallback(
    (taskId: string) => {
      if (!workspacePath) return;
      taskLifecycle.mutate({
        action: "enqueue",
        workspace_path: workspacePath,
        task_id: taskId,
      });
    },
    [workspacePath, taskLifecycle]
  );

  /**
   * Stop a running task
   * Uses the stop endpoint to properly halt execution
   */
  const onStop = useCallback(
    (taskId: string) => {
      if (!workspacePath) return;
      taskLifecycle.mutate({
        action: "stop",
        workspace_path: workspacePath,
        task_id: taskId,
      });
      onSuccess?.(t("workspace.taskStopped", "Task stopped"));
    },
    [workspacePath, taskLifecycle, onSuccess, t]
  );

  /**
   * Recover a stuck task
   * Uses retry to put the task back in queue to restart execution
   */
  const onRecover = useCallback(
    (taskId: string) => {
      if (!workspacePath) return;
      taskLifecycle.mutate({
        action: "retry",
        workspace_path: workspacePath,
        task_id: taskId,
      });
      onSuccess?.(t("workspace.taskRecovered", "Task recovered and restarted"));
    },
    [workspacePath, taskLifecycle, onSuccess, t]
  );

  /**
   * Resume a failed/incomplete task
   * Uses resume endpoint for paused tasks, retry for failed tasks
   */
  const onResume = useCallback(
    (taskId: string) => {
      if (!workspacePath) return;
      // Find the task to determine appropriate action
      const task = tasks.find((t) => t.id === taskId);
      const action: LifecycleAction = task?.status === "paused" ? "resume" : "retry";
      taskLifecycle.mutate({
        action,
        workspace_path: workspacePath,
        task_id: taskId,
      });
    },
    [workspacePath, taskLifecycle, tasks]
  );

  /**
   * Approve a task in review
   * Uses the approve lifecycle endpoint to move task to completed status
   */
  const onApprove = useCallback(
    async (taskId: string) => {
      if (!workspacePath) return;

      try {
        await taskLifecycle.mutateAsync({
          action: "approve",
          workspace_path: workspacePath,
          task_id: taskId,
        });
        onSuccess?.(t("workspace.taskActions.approved", "Task approved"));
      } catch (error) {
        const message = error instanceof Error ? error.message : t("common.unknownError", "Unknown error");
        onError?.(message);
        toast.error(t("workspace.taskActions.approveFailed", "Failed to approve task"), {
          description: message,
        });
      }
    },
    [workspacePath, taskLifecycle, onSuccess, onError, t]
  );

  /**
   * Reject a task in review
   * Uses the reject lifecycle endpoint to send task back for revision
   */
  const onReject = useCallback(
    async (taskId: string) => {
      if (!workspacePath) return;

      try {
        await taskLifecycle.mutateAsync({
          action: "reject",
          workspace_path: workspacePath,
          task_id: taskId,
        });
        onSuccess?.(t("workspace.taskActions.rejected", "Task sent back for revision"));
      } catch (error) {
        const message = error instanceof Error ? error.message : t("common.unknownError", "Unknown error");
        onError?.(message);
        toast.error(t("workspace.taskActions.rejectFailed", "Failed to reject task"), {
          description: message,
        });
      }
    },
    [workspacePath, taskLifecycle, onSuccess, onError, t]
  );

  /**
   * Archive a completed task
   * Uses the archive lifecycle endpoint
   */
  const onArchive = useCallback(
    (taskId: string) => {
      if (!workspacePath) {
        // Fallback to local storage if no workspace path
        archiveTask(taskId);
        onSuccess?.(t("workspace.taskArchived", "Task archived"));
        return;
      }
      taskLifecycle.mutate({
        action: "archive",
        workspace_path: workspacePath,
        task_id: taskId,
      });
      onSuccess?.(t("workspace.taskArchived", "Task archived"));
    },
    [workspacePath, taskLifecycle, archiveTask, onSuccess, t]
  );

  /**
   * Delete a task
   */
  const onDelete = useCallback(
    (taskId: string) => {
      if (!workspacePath) return;
      deleteTaskMutation.mutate({
        taskId,
        workspacePath,
      });
      onSuccess?.(t("workspace.taskDeleted", "Task deleted"));
    },
    [workspacePath, deleteTaskMutation, onSuccess, t]
  );

  /**
   * Duplicate a task
   * Creates a copy of the task with "(copy)" suffix
   */
  const onDuplicate = useCallback(
    (taskId: string) => {
      if (!workspacePath) return;
      const task = tasks.find((t) => t.id === taskId);
      if (!task) return;

      createTaskMutation.mutate({
        workspace_path: workspacePath,
        title: `${task.title} (copy)`,
        description: task.description ?? undefined,
      });
      onSuccess?.(t("workspace.taskDuplicated", "Task duplicated"));
    },
    [workspacePath, tasks, createTaskMutation, onSuccess, t]
  );

  /**
   * Move task to a specific column
   * Uses appropriate lifecycle action based on status transition
   */
  const onMoveToColumn = useCallback(
    (taskId: string, columnId: string) => {
      if (!workspacePath) return;
      const newStatus = COLUMN_TO_STATUS[columnId as KanbanColumnId];
      if (!newStatus) return;

      // Find current task status for context-aware action mapping
      const task = tasks.find((t) => t.id === taskId);
      const currentStatus = task?.status as TaskStatus | undefined;
      const action = getLifecycleActionForStatusChange(currentStatus, newStatus);

      if (action) {
        taskLifecycle.mutate({
          action,
          workspace_path: workspacePath,
          task_id: taskId,
        });
      }
    },
    [workspacePath, taskLifecycle, tasks]
  );

  /**
   * Update task title
   */
  const onTitleChange = useCallback(
    (taskId: string, newTitle: string) => {
      if (!workspacePath) return;

      updateTask.mutate({
        taskId,
        data: { title: newTitle },
        workspacePath,
      });
    },
    [workspacePath, updateTask]
  );

  /**
   * Open PR URL in browser
   */
  const onViewPR = useCallback(
    (prUrl: string) => {
      if (prUrl) {
        window.open(prUrl, "_blank", "noopener,noreferrer");
      }
    },
    []
  );

  // ==========================================
  // Batch Operations
  // ==========================================

  /**
   * Queue all backlog tasks
   * Moves all provided tasks from backlog to queue using enqueue lifecycle action
   */
  const queueAll = useCallback(
    async (taskIds: string[]) => {
      if (!workspacePath || taskIds.length === 0) return;

      try {
        // Notify Gateway about batch queue operation (for tracking)
        await queueAllBacklogTasks(taskIds);

        // Use enqueue lifecycle action for each task
        for (const taskId of taskIds) {
          taskLifecycle.mutate({
            action: "enqueue",
            workspace_path: workspacePath,
            task_id: taskId,
          });
        }
        onSuccess?.(
          t("workspace.queueAllSuccess", "Queued {{count}} tasks", { count: taskIds.length })
        );
      } catch (error) {
        console.error("[useTaskActions] Queue all failed:", error);
        // Still enqueue tasks even if Gateway notification failed
        for (const taskId of taskIds) {
          taskLifecycle.mutate({
            action: "enqueue",
            workspace_path: workspacePath,
            task_id: taskId,
          });
        }
        onSuccess?.(
          t("workspace.queueAllSuccess", "Queued {{count}} tasks", { count: taskIds.length })
        );
      }
    },
    [workspacePath, taskLifecycle, queueAllBacklogTasks, onSuccess, t]
  );

  /**
   * Archive all completed tasks
   */
  const archiveAll = useCallback(
    (taskIds: string[]) => {
      if (taskIds.length === 0) return;
      archiveAllDone(taskIds);
      onSuccess?.(
        t("workspace.archiveAllSuccess", "Archived {{count}} tasks", { count: taskIds.length })
      );
    },
    [archiveAllDone, onSuccess, t]
  );

  /**
   * Change status for multiple tasks
   * Uses appropriate lifecycle actions based on status transition
   */
  const bulkStatusChange = useCallback(
    (taskIds: string[], status: string) => {
      if (!workspacePath) return;
      const newStatus = COLUMN_TO_STATUS[status as KanbanColumnId];
      if (!newStatus) return;

      for (const taskId of taskIds) {
        // Find current task status for context-aware action mapping
        const task = tasks.find((t) => t.id === taskId);
        const currentStatus = task?.status as TaskStatus | undefined;
        const action = getLifecycleActionForStatusChange(currentStatus, newStatus);

        if (action) {
          taskLifecycle.mutate({
            action,
            workspace_path: workspacePath,
            task_id: taskId,
          });
        }
      }
    },
    [workspacePath, taskLifecycle, tasks]
  );

  /**
   * Delete multiple tasks
   */
  const bulkDelete = useCallback(
    (taskIds: string[]) => {
      if (!workspacePath) return;

      for (const taskId of taskIds) {
        deleteTaskMutation.mutate({
          taskId,
          workspacePath,
        });
      }
      onSuccess?.(
        t("workspace.bulkDeleteSuccess", "Deleted {{count}} tasks", { count: taskIds.length })
      );
    },
    [workspacePath, deleteTaskMutation, onSuccess, t]
  );

  // ==========================================
  // Create Task
  // ==========================================

  /**
   * Create a new task in the specified column
   * Note: The columnId parameter is kept for API compatibility but the status
   * is no longer sent to the API (tasks are created in backlog by default)
   */
  const createTask = useCallback(
    async (data: CreateTaskData, _columnId: string) => {
      if (!workspacePath) return;

      setIsCreating(true);
      try {
        await createTaskMutation.mutateAsync({
          workspace_path: workspacePath,
          title: data.title,
          description: data.description ?? undefined,
          agent_id: data.agentId,       // will be mapped to 'agent'
          model_id: data.modelId,       // will be mapped to 'model'
          auto_start: data.autoStart,   // will be mapped to 'start'
          worktree: data.worktree,
        });
        onSuccess?.(t("workspace.taskCreated", "Task created successfully"));
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        onError?.(t("workspace.taskCreateFailed", "Failed to create task: {{message}}", { message }));
        throw error;
      } finally {
        setIsCreating(false);
      }
    },
    [workspacePath, createTaskMutation, onSuccess, onError, t]
  );

  return {
    // Single task actions
    onStart,
    onStop,
    onRecover,
    onResume,
    onApprove,
    onReject,
    onArchive,
    onDelete,
    onDuplicate,
    onMoveToColumn,
    onTitleChange,
    onViewPR,

    // Batch operations
    queueAll,
    archiveAll,
    bulkStatusChange,
    bulkDelete,

    // Create task
    createTask,
    isCreating,
  };
}
