/**
 * React Query hooks for kanban API
 * Uses workspace_path for filtering tasks
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getTasks,
  createTask,
  updateTask,
  deleteTask,
  updateTaskStatus,
  checkHealth,
  type Task,
  type TaskWithAttemptStatus,
  type CreateTaskRequest,
  type UpdateTaskRequest,
  type TaskStatus,
} from "@/lib/vibe-kanban";

// Query keys
export const vibeKanbanKeys = {
  all: ["vibe-kanban"] as const,
  health: () => [...vibeKanbanKeys.all, "health"] as const,
  tasks: (workspacePath: string) => [...vibeKanbanKeys.all, "tasks", workspacePath] as const,
};

/**
 * Check if kanban backend is healthy
 */
export function useVibeKanbanHealth() {
  return useQuery({
    queryKey: vibeKanbanKeys.health(),
    queryFn: checkHealth,
    staleTime: 30 * 1000, // 30 seconds
    retry: false,
  });
}

/**
 * Fetch tasks for a workspace
 * @param workspacePath - workspace path to filter tasks (undefined for global tasks)
 */
export function useVibeKanbanTasks(workspacePath: string | undefined) {
  const queryKey = vibeKanbanKeys.tasks(workspacePath ?? "");

  const query = useQuery({
    queryKey,
    queryFn: () => getTasks(workspacePath),
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 10 * 1000, // Poll every 10 seconds for updates
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
  };
}

/**
 * Create a new task
 */
export function useCreateVibeKanbanTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateTaskRequest) => createTask(data),
    onSuccess: (newTask: Task) => {
      // Invalidate tasks query to refetch
      queryClient.invalidateQueries({
        queryKey: vibeKanbanKeys.tasks(newTask.workspace_path ?? ""),
      });
    },
  });
}

interface UpdateTaskParams {
  taskId: string;
  data: UpdateTaskRequest;
  workspacePath?: string;
}

/**
 * Update a task
 */
export function useUpdateVibeKanbanTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId, data }: UpdateTaskParams) => updateTask(taskId, data),
    onMutate: async ({ taskId, data, workspacePath }: UpdateTaskParams) => {
      const queryKey = vibeKanbanKeys.tasks(workspacePath ?? "");

      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey });

      // Snapshot previous value
      const previousTasks = queryClient.getQueryData<TaskWithAttemptStatus[]>(queryKey);

      // Optimistically update
      if (previousTasks) {
        queryClient.setQueryData<TaskWithAttemptStatus[]>(
          queryKey,
          previousTasks.map((task) =>
            task.id === taskId ? { ...task, ...data } : task
          )
        );
      }

      return { previousTasks, queryKey };
    },
    onError: (
      _err: unknown,
      _params: UpdateTaskParams,
      context: { previousTasks?: TaskWithAttemptStatus[]; queryKey: readonly string[] } | undefined
    ) => {
      // Rollback on error
      if (context?.previousTasks) {
        queryClient.setQueryData(context.queryKey, context.previousTasks);
      }
    },
    onSettled: (_data, _error, { workspacePath }) => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries({
        queryKey: vibeKanbanKeys.tasks(workspacePath ?? ""),
      });
    },
  });
}

interface UpdateTaskStatusParams {
  taskId: string;
  status: TaskStatus;
  workspacePath?: string;
}

/**
 * Update task status (convenience hook)
 */
export function useUpdateVibeKanbanTaskStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId, status }: UpdateTaskStatusParams) =>
      updateTaskStatus(taskId, status),
    onMutate: async ({ taskId, status, workspacePath }: UpdateTaskStatusParams) => {
      const queryKey = vibeKanbanKeys.tasks(workspacePath ?? "");

      await queryClient.cancelQueries({ queryKey });

      const previousTasks = queryClient.getQueryData<TaskWithAttemptStatus[]>(queryKey);

      if (previousTasks) {
        queryClient.setQueryData<TaskWithAttemptStatus[]>(
          queryKey,
          previousTasks.map((task) =>
            task.id === taskId ? { ...task, status } : task
          )
        );
      }

      return { previousTasks, queryKey };
    },
    onError: (
      _err: unknown,
      _params: UpdateTaskStatusParams,
      context: { previousTasks?: TaskWithAttemptStatus[]; queryKey: readonly string[] } | undefined
    ) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(context.queryKey, context.previousTasks);
      }
    },
    onSettled: (_data, _error, { workspacePath }) => {
      queryClient.invalidateQueries({
        queryKey: vibeKanbanKeys.tasks(workspacePath ?? ""),
      });
    },
  });
}

interface DeleteTaskParams {
  taskId: string;
  workspacePath?: string;
}

/**
 * Delete a task
 */
export function useDeleteVibeKanbanTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId }: DeleteTaskParams) => deleteTask(taskId),
    onSuccess: (_data: void, { workspacePath }: DeleteTaskParams) => {
      queryClient.invalidateQueries({
        queryKey: vibeKanbanKeys.tasks(workspacePath ?? ""),
      });
    },
  });
}
