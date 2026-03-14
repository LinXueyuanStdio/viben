/**
 * Task Actions Hook
 *
 * Consolidates all task-related operations from workspace-kanban.tsx
 * including CRUD operations, status changes, and batch operations.
 */

import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  useUpdateVibeKanbanTaskStatus,
  useUpdateVibeKanbanTask,
  useCreateVibeKanbanTask,
  useDeleteVibeKanbanTask,
} from "@/hooks/use-vibe-kanban";
import { useWorkspaceKanbanQueue } from "@/stores/kanban-queue-store";
import {
  COLUMN_TO_STATUS,
  type KanbanColumnId,
  type TaskWithAttemptStatus,
} from "@/lib/vibe-kanban";
import {
  getGatewayUrl,
  submitTaskEvent,
  type TaskEvent,
} from "@/lib/gateway";
import { toast } from "@/hooks/use-toast";
import type { CreateTaskData } from "../create-task-dialog";
import type { TaskActions } from "../types";

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

  // Mutations from use-vibe-kanban
  const updateTaskStatus = useUpdateVibeKanbanTaskStatus();
  const updateTask = useUpdateVibeKanbanTask();
  const createTaskMutation = useCreateVibeKanbanTask();
  const deleteTaskMutation = useDeleteVibeKanbanTask();

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
      updateTaskStatus.mutate({
        taskId,
        status: "queue",
        workspacePath,
      });
    },
    [workspacePath, updateTaskStatus]
  );

  /**
   * Stop a running task
   * Moves task back to "backlog" status
   */
  const onStop = useCallback(
    (taskId: string) => {
      if (!workspacePath) return;
      updateTaskStatus.mutate({
        taskId,
        status: "backlog",
        workspacePath,
      });
      onSuccess?.(t("workspace.taskStopped", "Task stopped"));
    },
    [workspacePath, updateTaskStatus, onSuccess, t]
  );

  /**
   * Recover a stuck task
   * Puts the task back in queue to restart execution
   */
  const onRecover = useCallback(
    (taskId: string) => {
      if (!workspacePath) return;
      updateTaskStatus.mutate({
        taskId,
        status: "queue",
        workspacePath,
      });
      onSuccess?.(t("workspace.taskRecovered", "Task recovered and restarted"));
    },
    [workspacePath, updateTaskStatus, onSuccess, t]
  );

  /**
   * Resume a failed/incomplete task
   * Puts the task back in queue to restart execution
   */
  const onResume = useCallback(
    (taskId: string) => {
      if (!workspacePath) return;
      updateTaskStatus.mutate({
        taskId,
        status: "queue",
        workspacePath,
      });
    },
    [workspacePath, updateTaskStatus]
  );

  /**
   * Approve a task in review
   * Submits APPROVED event to move task to completed status
   */
  const onApprove = useCallback(
    async (taskId: string) => {
      if (!workspacePath) return;

      const gatewayUrl = getGatewayUrl();
      if (!gatewayUrl) return;

      try {
        const event: TaskEvent = {
          eventId: crypto.randomUUID(),
          sequence: 0, // Will be validated by server
          type: "APPROVED",
          timestamp: new Date().toISOString(),
        };

        const result = await submitTaskEvent(
          gatewayUrl,
          taskId,
          workspacePath,
          event
        );

        if (result.success) {
          onSuccess?.(t("workspace.taskActions.approved", "Task approved"));
        } else {
          const errorMessage =
            result.error === "SEQUENCE_MISMATCH"
              ? t("workspace.taskActions.sequenceMismatch", "Sequence mismatch - please refresh")
              : result.error === "INVALID_TRANSITION"
                ? t("workspace.taskActions.invalidTransition", "Invalid state transition")
                : t("workspace.taskActions.submitFailed", "Failed to submit event");
          onError?.(errorMessage);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : t("common.unknownError", "Unknown error");
        onError?.(message);
        toast.error(t("workspace.taskActions.approveFailed", "Failed to approve task"), {
          description: message,
        });
      }
    },
    [workspacePath, onSuccess, onError, t]
  );

  /**
   * Reject a task in review
   * Submits REJECTED event to resume task execution
   */
  const onReject = useCallback(
    async (taskId: string) => {
      if (!workspacePath) return;

      const gatewayUrl = getGatewayUrl();
      if (!gatewayUrl) return;

      try {
        const event: TaskEvent = {
          eventId: crypto.randomUUID(),
          sequence: 0, // Will be validated by server
          type: "REJECTED",
          timestamp: new Date().toISOString(),
        };

        const result = await submitTaskEvent(
          gatewayUrl,
          taskId,
          workspacePath,
          event
        );

        if (result.success) {
          onSuccess?.(t("workspace.taskActions.rejected", "Task sent back for revision"));
        } else {
          const errorMessage =
            result.error === "SEQUENCE_MISMATCH"
              ? t("workspace.taskActions.sequenceMismatch", "Sequence mismatch - please refresh")
              : result.error === "INVALID_TRANSITION"
                ? t("workspace.taskActions.invalidTransition", "Invalid state transition")
                : t("workspace.taskActions.submitFailed", "Failed to submit event");
          onError?.(errorMessage);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : t("common.unknownError", "Unknown error");
        onError?.(message);
        toast.error(t("workspace.taskActions.rejectFailed", "Failed to reject task"), {
          description: message,
        });
      }
    },
    [workspacePath, onSuccess, onError, t]
  );

  /**
   * Archive a completed task
   * Adds task to archived list (local storage)
   */
  const onArchive = useCallback(
    (taskId: string) => {
      archiveTask(taskId);
      onSuccess?.(t("workspace.taskArchived", "Task archived"));
    },
    [archiveTask, onSuccess, t]
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
        description: task.description ?? null,
        status: task.status,
      });
      onSuccess?.(t("workspace.taskDuplicated", "Task duplicated"));
    },
    [workspacePath, tasks, createTaskMutation, onSuccess, t]
  );

  /**
   * Move task to a specific column
   * Updates task status based on column mapping
   */
  const onMoveToColumn = useCallback(
    (taskId: string, columnId: string) => {
      if (!workspacePath) return;
      const newStatus = COLUMN_TO_STATUS[columnId as KanbanColumnId];
      if (!newStatus) return;

      updateTaskStatus.mutate({
        taskId,
        status: newStatus,
        workspacePath,
      });
    },
    [workspacePath, updateTaskStatus]
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
   * Moves all provided tasks from backlog to queue
   */
  const queueAll = useCallback(
    async (taskIds: string[]) => {
      if (!workspacePath || taskIds.length === 0) return;

      try {
        // Notify Gateway about batch queue operation (for tracking)
        await queueAllBacklogTasks(taskIds);

        // Update task statuses via Kanban API
        for (const taskId of taskIds) {
          updateTaskStatus.mutate({
            taskId,
            status: "queue",
            workspacePath,
          });
        }
        onSuccess?.(
          t("workspace.queueAllSuccess", "Queued {{count}} tasks", { count: taskIds.length })
        );
      } catch (error) {
        console.error("[useTaskActions] Queue all failed:", error);
        // Still update statuses even if Gateway notification failed
        for (const taskId of taskIds) {
          updateTaskStatus.mutate({
            taskId,
            status: "queue",
            workspacePath,
          });
        }
        onSuccess?.(
          t("workspace.queueAllSuccess", "Queued {{count}} tasks", { count: taskIds.length })
        );
      }
    },
    [workspacePath, updateTaskStatus, queueAllBacklogTasks, onSuccess, t]
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
   */
  const bulkStatusChange = useCallback(
    (taskIds: string[], status: string) => {
      if (!workspacePath) return;
      const newStatus = COLUMN_TO_STATUS[status as KanbanColumnId];
      if (!newStatus) return;

      for (const taskId of taskIds) {
        updateTaskStatus.mutate({
          taskId,
          status: newStatus,
          workspacePath,
        });
      }
    },
    [workspacePath, updateTaskStatus]
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
   */
  const createTask = useCallback(
    async (data: CreateTaskData, columnId: string) => {
      if (!workspacePath) return;

      const status = COLUMN_TO_STATUS[columnId as KanbanColumnId] ?? "backlog";

      setIsCreating(true);
      try {
        await createTaskMutation.mutateAsync({
          workspace_path: workspacePath,
          title: data.title,
          description: data.description ?? null,
          status,
          agent_id: data.agentId,
          model_id: data.modelId,
          branch: data.branch,
          auto_start: data.autoStart,
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
