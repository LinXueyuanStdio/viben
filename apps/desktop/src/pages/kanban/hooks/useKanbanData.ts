import { useMemo, useEffect } from "react";
import { useAgents, useModels } from "@/hooks";
import {
  useTasks,
  useTaskLifecycle,
  _useUpdateTask,
  _useCreateTask,
} from "@/hooks/use-kanban";
import { useWorkspaceKanbanQueue } from "@/stores/kanban-queue-store";

export interface AvailableAgent {
  id: string;
  name: string;
  description?: string;
  executorType?: string;
  agent_dir?: string;
  config_path?: string;
}

export interface AvailableModel {
  id: string;
  name: string;
  description: undefined;
  provider: string;
  provider_id: string;
}

export function useKanbanData(workspace: { path: string } | undefined) {
  // Fetch tasks for the workspace
  const {
    data: tasks,
    isLoading: isLoadingTasks,
    error: tasksError,
    refetch: refetchTasks,
    isFetching: isFetchingTasks,
  } = useTasks(workspace?.path);

  // Mutations
  const taskLifecycle = useTaskLifecycle();
  const updateTask = _useUpdateTask();
  const createTask = _useCreateTask();

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

  // Transform agents for CreateTaskDialog
  const availableAgents = useMemo<AvailableAgent[]>(
    () =>
      agents.map((a) => ({
        id: a.id,
        name: a.name,
        description: a.description,
        executorType: a.executor_type,
        agent_dir: a.agent_dir,
        config_path: a.config_path,
      })),
    [agents]
  );

  // Transform models for CreateTaskDialog
  const availableModels = useMemo<AvailableModel[]>(
    () =>
      vibenModels
        .filter((m) => m.is_available)
        .map((m) => ({
          id: m.id,
          name: m.name,
          description: undefined,
          provider: m.provider_id,
          provider_id: m.provider_id,
        })),
    [vibenModels]
  );

  // Queue settings and archived tasks store
  const queueStore = useWorkspaceKanbanQueue(workspace?.path);

  // Fetch gateway queue status on mount and when workspace changes
  useEffect(() => {
    if (workspace) {
      queueStore.fetchGatewayQueueStatus();
    }
  }, [workspace, queueStore.fetchGatewayQueueStatus]);

  return {
    // Raw data
    tasks,
    isLoadingTasks,
    isFetchingTasks,
    tasksError,
    refetchTasks,

    // Mutations
    taskLifecycle,
    updateTask,
    createTask,

    // Agents and Models
    availableAgents,
    availableModels,
    defaultAgentId: defaultAgentId ?? undefined,
    defaultModelId: defaultModelId ?? undefined,
    isLoadingAgents,
    isLoadingModels,

    // Queue store
    queueStore,
  };
}
