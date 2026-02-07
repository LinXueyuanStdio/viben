/**
 * React Query hooks for vibe-kanban API
 * With WebSocket integration for real-time task updates
 */

import { useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getProjects,
  getTasks,
  createTask,
  updateTask,
  deleteTask,
  updateTaskStatus,
  checkHealth,
  useTasksWebSocket,
  type Task,
  type TaskWithAttemptStatus,
  type CreateTaskRequest,
  type UpdateTaskRequest,
  type TaskStatus,
  type WebSocketState,
} from "@/lib/vibe-kanban";

// Query keys
export const vibeKanbanKeys = {
  all: ["vibe-kanban"] as const,
  health: () => [...vibeKanbanKeys.all, "health"] as const,
  projects: () => [...vibeKanbanKeys.all, "projects"] as const,
  tasks: (projectId: string) => [...vibeKanbanKeys.all, "tasks", projectId] as const,
};

/**
 * Check if vibe-kanban backend is healthy
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
 * Fetch all projects from vibe-kanban
 */
export function useVibeKanbanProjects() {
  return useQuery({
    queryKey: vibeKanbanKeys.projects(),
    queryFn: getProjects,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * WebSocket connection state result
 */
export interface TasksWebSocketState {
  connectionState: WebSocketState;
  isInitialized: boolean;
  wsError: Error | null;
  reconnect: () => void;
}

/**
 * Fetch tasks for a project with real-time WebSocket updates
 *
 * Uses WebSocket for real-time streaming with JSON Patch.
 * Falls back to REST API for initial data and when WebSocket is unavailable.
 * React Query cache is automatically updated with WebSocket data.
 */
export function useVibeKanbanTasks(projectId: string | null) {
  const queryClient = useQueryClient();

  // WebSocket connection for real-time updates
  const {
    data: wsData,
    connectionState,
    isInitialized,
    error: wsError,
    reconnect,
  } = useTasksWebSocket(projectId);

  // REST API query as fallback and for initial validation
  const query = useQuery({
    queryKey: vibeKanbanKeys.tasks(projectId || ""),
    queryFn: () => {
      // Guard is ensured by `enabled`, but explicit check for type safety
      if (!projectId) {
        return Promise.resolve([]);
      }
      return getTasks(projectId);
    },
    enabled: !!projectId,
    staleTime: 5 * 60 * 1000, // 5 minutes - rely on WebSocket for freshness
    // No refetchInterval - WebSocket handles real-time updates
  });

  // Update React Query cache when WebSocket data changes
  useEffect(() => {
    if (projectId && wsData && isInitialized) {
      queryClient.setQueryData(vibeKanbanKeys.tasks(projectId), wsData);
    }
  }, [projectId, wsData, isInitialized, queryClient]);

  // Combine data: prefer WebSocket data when initialized, else use REST data
  const data = useMemo(() => {
    if (isInitialized && wsData) {
      return wsData;
    }
    return query.data;
  }, [isInitialized, wsData, query.data]);

  // Determine loading state
  const isLoading = query.isLoading && !isInitialized;
  const isFetching =
    query.isFetching || (connectionState === "connecting" && !isInitialized);

  // Combine errors
  const error = query.error || wsError;

  // WebSocket state for UI feedback
  const websocketState: TasksWebSocketState = {
    connectionState,
    isInitialized,
    wsError,
    reconnect,
  };

  return {
    // Standard React Query properties
    data,
    isLoading,
    isFetching,
    error,
    refetch: query.refetch,
    // WebSocket-specific state
    websocketState,
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
        queryKey: vibeKanbanKeys.tasks(newTask.project_id),
      });
    },
  });
}

interface UpdateTaskParams {
  taskId: string;
  data: UpdateTaskRequest;
  projectId: string;
}

/**
 * Update a task
 */
export function useUpdateVibeKanbanTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId, data }: UpdateTaskParams) => updateTask(taskId, data),
    onMutate: async ({ taskId, data, projectId }: UpdateTaskParams) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: vibeKanbanKeys.tasks(projectId),
      });

      // Snapshot previous value
      const previousTasks = queryClient.getQueryData<TaskWithAttemptStatus[]>(
        vibeKanbanKeys.tasks(projectId)
      );

      // Optimistically update
      if (previousTasks) {
        queryClient.setQueryData<TaskWithAttemptStatus[]>(
          vibeKanbanKeys.tasks(projectId),
          previousTasks.map((task: TaskWithAttemptStatus) =>
            task.id === taskId ? { ...task, ...data } : task
          )
        );
      }

      return { previousTasks };
    },
    onError: (
      _err: unknown,
      { projectId }: UpdateTaskParams,
      context: { previousTasks?: TaskWithAttemptStatus[] } | undefined
    ) => {
      // Rollback on error
      if (context?.previousTasks) {
        queryClient.setQueryData(
          vibeKanbanKeys.tasks(projectId),
          context.previousTasks
        );
      }
    },
    onSettled: (
      _data: Task | undefined,
      _error: unknown,
      { projectId }: UpdateTaskParams
    ) => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries({
        queryKey: vibeKanbanKeys.tasks(projectId),
      });
    },
  });
}

interface UpdateTaskStatusParams {
  taskId: string;
  status: TaskStatus;
  projectId: string;
}

/**
 * Update task status (convenience hook)
 */
export function useUpdateVibeKanbanTaskStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId, status }: UpdateTaskStatusParams) =>
      updateTaskStatus(taskId, status),
    onMutate: async ({ taskId, status, projectId }: UpdateTaskStatusParams) => {
      await queryClient.cancelQueries({
        queryKey: vibeKanbanKeys.tasks(projectId),
      });

      const previousTasks = queryClient.getQueryData<TaskWithAttemptStatus[]>(
        vibeKanbanKeys.tasks(projectId)
      );

      if (previousTasks) {
        queryClient.setQueryData<TaskWithAttemptStatus[]>(
          vibeKanbanKeys.tasks(projectId),
          previousTasks.map((task: TaskWithAttemptStatus) =>
            task.id === taskId ? { ...task, status } : task
          )
        );
      }

      return { previousTasks };
    },
    onError: (
      _err: unknown,
      { projectId }: UpdateTaskStatusParams,
      context: { previousTasks?: TaskWithAttemptStatus[] } | undefined
    ) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(
          vibeKanbanKeys.tasks(projectId),
          context.previousTasks
        );
      }
    },
    onSettled: (
      _data: Task | undefined,
      _error: unknown,
      { projectId }: UpdateTaskStatusParams
    ) => {
      queryClient.invalidateQueries({
        queryKey: vibeKanbanKeys.tasks(projectId),
      });
    },
  });
}

interface DeleteTaskParams {
  taskId: string;
  projectId: string;
}

/**
 * Delete a task
 */
export function useDeleteVibeKanbanTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId }: DeleteTaskParams) => deleteTask(taskId),
    onSuccess: (_data: void, { projectId }: DeleteTaskParams) => {
      queryClient.invalidateQueries({
        queryKey: vibeKanbanKeys.tasks(projectId),
      });
    },
  });
}

/**
 * Find project by git repo path
 */
export function useVibeKanbanProjectByPath(gitRepoPath: string | null) {
  const { data: projects } = useVibeKanbanProjects();

  if (!gitRepoPath || !projects) {
    return null;
  }

  // Normalize paths for comparison
  const normalizedPath = gitRepoPath.replace(/\/+$/, "");
  return projects.find(
    (p) => p.git_repo_path.replace(/\/+$/, "") === normalizedPath
  ) ?? null;
}
