/**
 * React Query hooks for kanban API
 * Uses workspace_path for filtering tasks
 *
 * Public API:
 * - useTasks: Fetch task list (POST /api/task/list)
 * - useTaskLifecycle: Lifecycle mutations (POST /api/task/{action})
 * - kanbanKeys: Query key factory
 *
 * Internal (CRUD):
 * - _useCreateTask, _useUpdateTask, _useDeleteTask
 *
 * @deprecated hooks (to be removed):
 * - _useUpdateTaskStatus: Uses PUT /api/tasks/:id for status updates
 */

import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getTasks,
  type TaskWithAttemptStatus,
  type TaskStatus,
} from "@/lib/kanban";
import { recordTaskActivity, clearTaskActivity } from "@/stores/task-activity-store";
import { getGatewayClient } from "@/lib/gateway";

// ============================================================================
// Types for Update Hooks
// ============================================================================

/**
 * Request body for POST /api/task/update endpoint
 */
export interface UpdateTaskApiRequest {
  workspace_path: string;  // required
  task_id: string;         // required
  title?: string;
  description?: string;
  agent?: string;
  executor?: string;
  model?: string;
  priority?: string;
  branch?: string;
  base_branch?: string;
  assignee?: string;
  notes?: string;
}

/**
 * Response from POST /api/task/update endpoint
 */
export interface UpdateTaskApiResponse {
  success: boolean;
  task_id: string;
  updated_fields: string[];
}

/**
 * Legacy request body for updating a task
 * @deprecated Will be replaced by UpdateTaskApiRequest
 */
export interface UpdateTaskRequest {
  title?: string;
  description?: string | null;
  prompt?: string;
  status?: TaskStatus;
  priority?: string;
  workspace_path?: string;
  session_id?: string;
  agent_id?: string;
  cost?: number;
  duration?: number;
  favorite?: boolean;
  executor?: string;
}

// ============================================================================
// Types
// ============================================================================

/**
 * Lifecycle action types supported by the task API
 */
export type LifecycleAction =
  | "start"
  | "stop"
  | "pause"
  | "resume"
  | "approve"
  | "reject"
  | "retry"
  | "cancel"
  | "enqueue"
  | "dequeue"
  | "archive";

/**
 * Base request body for lifecycle endpoints
 */
interface LifecycleBaseRequest {
  workspace_path: string;
  task_id: string;
}

/**
 * Extended request params for specific actions
 */
interface StartParams extends LifecycleBaseRequest {
  trigger_execution?: boolean;
}

interface ApproveParams extends LifecycleBaseRequest {
  comment?: string;
}

interface RejectParams extends LifecycleBaseRequest {
  reason?: string;
}

interface CancelParams extends LifecycleBaseRequest {
  reason?: string;
  force?: boolean;
}

interface EnqueueParams extends LifecycleBaseRequest {
  agent?: string;
  executor?: string;
  model?: string;
  priority?: string;
}

/**
 * Union type for all lifecycle params
 */
export type LifecycleParams =
  | ({ action: "start" } & StartParams)
  | ({ action: "stop" } & LifecycleBaseRequest)
  | ({ action: "pause" } & LifecycleBaseRequest)
  | ({ action: "resume" } & LifecycleBaseRequest)
  | ({ action: "approve" } & ApproveParams)
  | ({ action: "reject" } & RejectParams)
  | ({ action: "retry" } & LifecycleBaseRequest)
  | ({ action: "cancel" } & CancelParams)
  | ({ action: "enqueue" } & EnqueueParams)
  | ({ action: "dequeue" } & LifecycleBaseRequest)
  | ({ action: "archive" } & LifecycleBaseRequest);

/**
 * Request body for POST /api/task/create endpoint
 */
export interface CreateTaskApiRequest {
  workspace_path: string;  // required
  title: string;           // required
  slug?: string;
  branch?: string;
  assignee?: string;
  priority?: string;
  description?: string;
  agent?: string;
  executor?: string;
  model?: string;
  start?: boolean;         // auto-start after creation
  worktree?: boolean;      // create in worktree
}

/**
 * Response from POST /api/task/create endpoint
 */
export interface CreateTaskApiResponse {
  success: boolean;
  task_id: string;
  task_dir: string;
  status: string;
  context_initialized: boolean;
}

/**
 * Input type for _useCreateTask hook
 * Accepts either the legacy format or the new API format
 */
export interface CreateTaskInput {
  workspace_path: string;  // required
  title: string;           // required
  slug?: string;
  branch?: string;
  assignee?: string;
  priority?: string;
  description?: string | null;
  // Agent/model fields (support both old and new naming)
  agent?: string;
  agent_id?: string;       // legacy - maps to 'agent'
  executor?: string;
  model?: string;
  model_id?: string;       // legacy - maps to 'model'
  // Auto-start fields (support both old and new naming)
  start?: boolean;
  auto_start?: boolean;    // legacy - maps to 'start'
  worktree?: boolean;
  // Legacy fields (ignored by the API but kept for type compatibility)
  status?: TaskStatus;
  github_issue_number?: number;
  github_issue_url?: string;
  session_id?: string;
  task_index?: number;
}

/**
 * Response from lifecycle endpoints
 */
export interface LifecycleResponse {
  success: boolean;
  task_id: string;
  status: TaskStatus;
  previous_status: TaskStatus;
  /** Archive path (only for archive action) */
  archive_path?: string;
  /** Whether task was cancelled (only for stop action) */
  cancelled?: boolean;
}

/**
 * Error response from lifecycle endpoints
 */
export interface LifecycleErrorResponse {
  error: string;
  code?: string;
}

/**
 * Response from POST /api/task/delete endpoint
 */
export interface DeleteTaskApiResponse {
  success: boolean;
  task_id: string;
  deleted: boolean;
}

// ============================================================================
// Query Keys
// ============================================================================

export const kanbanKeys = {
  all: ["kanban"] as const,
  tasks: (workspacePath: string) => [...kanbanKeys.all, "tasks", workspacePath] as const,
};

// ============================================================================
// Public Hooks
// ============================================================================

/**
 * Fetch tasks for a workspace
 * @param workspacePath - workspace path to filter tasks (undefined for global tasks)
 */
export function useTasks(workspacePath: string | undefined) {
  const queryKey = kanbanKeys.tasks(workspacePath ?? "");

  const query = useQuery({
    queryKey,
    queryFn: () => getTasks(workspacePath),
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 10 * 1000, // Poll every 10 seconds for updates
  });

  // Record activity for running tasks when data is refreshed
  // This helps prevent false stuck detection when polling updates
  useEffect(() => {
    if (query.data) {
      for (const task of query.data) {
        if (task.status === "in_progress") {
          recordTaskActivity(task.id);
        }
      }
    }
  }, [query.data]);

  return {
    data: query.data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
  };
}

/**
 * Lifecycle mutations for task state transitions
 *
 * Actions:
 * - start: queue -> in_progress (optionally trigger execution)
 * - stop: Stop task execution
 * - pause: in_progress/queue -> paused
 * - resume: paused -> queue/in_progress
 * - approve: review -> completed
 * - reject: review -> backlog
 * - retry: failed -> queue
 * - cancel: * -> cancelled
 * - enqueue: backlog -> queue
 * - dequeue: queue -> backlog
 * - archive: completed/failed/cancelled -> archived
 *
 * @example
 * ```tsx
 * const lifecycle = useTaskLifecycle();
 *
 * // Start a task
 * lifecycle.mutate({
 *   action: "start",
 *   workspace_path: "/path/to/workspace",
 *   task_id: "task-123",
 *   trigger_execution: true
 * });
 *
 * // Pause a task
 * lifecycle.mutate({
 *   action: "pause",
 *   workspace_path: "/path/to/workspace",
 *   task_id: "task-123"
 * });
 * ```
 */
export function useTaskLifecycle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: LifecycleParams): Promise<LifecycleResponse> => {
      const { action, workspace_path, task_id, ...rest } = params;

      const body = { workspace_path, task_id, ...rest };

      // Special case: stop endpoint uses task_dir instead of task_id
      if (action === "stop") {
        (body as Record<string, unknown>).task_dir = task_id;
        delete (body as Record<string, unknown>).task_id;
      }

      return getGatewayClient().post<LifecycleResponse>(`/api/task/${action}`, body);
    },
    onMutate: async (params) => {
      const queryKey = kanbanKeys.tasks(params.workspace_path ?? "");

      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey });

      // Snapshot previous value
      const previousTasks = queryClient.getQueryData<TaskWithAttemptStatus[]>(queryKey);

      // Optimistic update based on action
      if (previousTasks) {
        const newStatus = getExpectedStatusForAction(params.action);
        if (newStatus) {
          queryClient.setQueryData<TaskWithAttemptStatus[]>(
            queryKey,
            previousTasks.map((task) =>
              task.id === params.task_id ? { ...task, status: newStatus } : task
            )
          );
        }
      }

      return { previousTasks, queryKey };
    },
    onSuccess: (_data, params) => {
      // Clear activity tracking for terminal states
      if (["cancel", "archive"].includes(params.action)) {
        clearTaskActivity(params.task_id);
      }
    },
    onError: (
      _err: unknown,
      _params: LifecycleParams,
      context: { previousTasks?: TaskWithAttemptStatus[]; queryKey: readonly string[] } | undefined
    ) => {
      // Rollback on error
      if (context?.previousTasks) {
        queryClient.setQueryData(context.queryKey, context.previousTasks);
      }
    },
    onSettled: (_data, _error, params) => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries({
        queryKey: kanbanKeys.tasks(params.workspace_path ?? ""),
      });
    },
  });
}

/**
 * Get the expected new status for a lifecycle action
 * Used for optimistic updates
 */
function getExpectedStatusForAction(action: LifecycleAction): TaskStatus | null {
  const statusMap: Record<LifecycleAction, TaskStatus | null> = {
    start: "in_progress",
    stop: null, // Complex - could go to review or backlog
    pause: "paused",
    resume: "in_progress", // or queue
    approve: "completed",
    reject: "backlog",
    retry: "queue",
    cancel: "cancelled",
    enqueue: "queue",
    dequeue: "backlog",
    archive: "archived",
  };
  return statusMap[action];
}

// ============================================================================
// Internal CRUD Hooks (prefixed with underscore)
// These are for internal use - prefer lifecycle hooks for state transitions
// ============================================================================

/**
 * Create a new task via POST /api/task/create endpoint
 * @internal
 */
export function _useCreateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateTaskInput): Promise<CreateTaskApiResponse> => {
      // Map input to API request format
      const apiRequest: CreateTaskApiRequest = {
        workspace_path: input.workspace_path,
        title: input.title,
        slug: input.slug,
        branch: input.branch,
        assignee: input.assignee,
        priority: input.priority,
        description: input.description ?? undefined,
        // Map legacy field names to new API names
        agent: input.agent ?? input.agent_id,
        executor: input.executor,
        model: input.model ?? input.model_id,
        start: input.start ?? input.auto_start,
        worktree: input.worktree,
      };

      // Remove undefined values
      const body = Object.fromEntries(
        Object.entries(apiRequest).filter(([, v]) => v !== undefined)
      );

      return getGatewayClient().post<CreateTaskApiResponse>("/api/task/create", body);
    },
    onSuccess: (_result: CreateTaskApiResponse, variables: CreateTaskInput) => {
      // Invalidate tasks query to refetch
      queryClient.invalidateQueries({
        queryKey: kanbanKeys.tasks(variables.workspace_path ?? ""),
      });
    },
  });
}

// ============================================================================
// Update Task Hook
// ============================================================================

/**
 * Input parameters for _useUpdateTask hook
 */
export interface UpdateTaskParams {
  workspacePath: string;  // required
  taskId: string;         // required
  data: {
    title?: string;
    description?: string;
    agent?: string;
    executor?: string;
    model?: string;
    priority?: string;
    branch?: string;
    base_branch?: string;
    assignee?: string;
    notes?: string;
  };
}

/**
 * Update task fields (title, description, etc.) via POST /api/task/update
 *
 * @example
 * ```tsx
 * const updateTask = _useUpdateTask();
 *
 * updateTask.mutate({
 *   workspacePath: "/path/to/workspace",
 *   taskId: "task-123",
 *   data: {
 *     title: "New title",
 *     description: "New description",
 *     priority: "high"
 *   }
 * });
 * ```
 *
 * @internal
 */
export function _useUpdateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ workspacePath, taskId, data }: UpdateTaskParams): Promise<UpdateTaskApiResponse> => {
      // Build API request body
      const body: UpdateTaskApiRequest = {
        workspace_path: workspacePath,
        task_id: taskId,
        ...data,
      };

      // Remove undefined values
      const cleanBody = Object.fromEntries(
        Object.entries(body).filter(([, v]) => v !== undefined)
      );

      return getGatewayClient().post<UpdateTaskApiResponse>("/api/task/update", cleanBody);
    },
    onMutate: async ({ workspacePath, taskId, data }: UpdateTaskParams) => {
      const queryKey = kanbanKeys.tasks(workspacePath ?? "");

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
        queryKey: kanbanKeys.tasks(workspacePath ?? ""),
      });
    },
  });
}

// ============================================================================
// Deprecated Update Hooks
// ============================================================================

interface UpdateTaskStatusParams {
  taskId: string;
  status: TaskStatus;
  workspacePath?: string;
}

/**
 * Update task status (convenience hook)
 *
 * @deprecated This hook uses PUT /api/tasks/:id for status updates. Prefer
 * useTaskLifecycle for proper state transitions via POST /api/task/{action}.
 *
 * @internal
 */
export function _useUpdateTaskStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ taskId, status }: UpdateTaskStatusParams) => {
      // Use PUT /api/tasks/:id directly
      return getGatewayClient().request(`/api/tasks/${encodeURIComponent(taskId)}`, {
        method: "PUT",
        body: { status },
      });
    },
    onMutate: async ({ taskId, status, workspacePath }: UpdateTaskStatusParams) => {
      const queryKey = kanbanKeys.tasks(workspacePath ?? "");

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
    onSuccess: (_data, { taskId, status }) => {
      // Clear activity tracking when task completes or is archived
      if (status === "completed") {
        clearTaskActivity(taskId);
      }
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
        queryKey: kanbanKeys.tasks(workspacePath ?? ""),
      });
    },
  });
}

// ============================================================================
// Delete Task Hook
// ============================================================================

interface DeleteTaskParams {
  taskId: string;
  workspacePath: string;  // required for POST /api/task/delete
}

/**
 * Delete a task via POST /api/task/delete endpoint
 * @internal
 */
export function _useDeleteTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ taskId, workspacePath }: DeleteTaskParams): Promise<DeleteTaskApiResponse> => {
      return getGatewayClient().post<DeleteTaskApiResponse>(
        "/api/task/delete",
        {
          workspace_path: workspacePath,
          task_id: taskId,
        }
      );
    },
    onSuccess: (_data: DeleteTaskApiResponse, { taskId, workspacePath }: DeleteTaskParams) => {
      // Clear activity tracking for deleted task
      clearTaskActivity(taskId);

      queryClient.invalidateQueries({
        queryKey: kanbanKeys.tasks(workspacePath),
      });
    },
  });
}

// ============================================================================
// Legacy Aliases (for backward compatibility during migration)
// ============================================================================

/** @deprecated Use useTasks instead */
export const useVibeKanbanTasks = useTasks;

/** @deprecated Use kanbanKeys instead */
export const vibeKanbanKeys = kanbanKeys;

/** @deprecated Use _useCreateTask instead */
export const useCreateVibeKanbanTask = _useCreateTask;

/** @deprecated Use _useUpdateTask instead */
export const useUpdateVibeKanbanTask = _useUpdateTask;

/** @deprecated Use _useUpdateTaskStatus instead */
export const useUpdateVibeKanbanTaskStatus = _useUpdateTaskStatus;

/** @deprecated Use _useDeleteTask instead */
export const useDeleteVibeKanbanTask = _useDeleteTask;
