/**
 * React Query hooks for kanban activities
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getGatewayClient, type ActivityType } from "@/lib/gateway";

// Re-export types from gateway for consumers
export type { KanbanActivity, ActivityType } from "@/lib/gateway";

// Query keys
export const kanbanActivitiesKeys = {
  all: ["kanban-activities"] as const,
  activities: (taskId: string) => [...kanbanActivitiesKeys.all, "activities", taskId] as const,
};

/**
 * Fetch all activities for a task
 */
export function useKanbanActivities(taskId: string | null) {
  return useQuery({
    queryKey: kanbanActivitiesKeys.activities(taskId || ""),
    queryFn: async () => {
      if (!taskId) return [];
      const gateway = getGatewayClient();
      const activities = await gateway.getKanbanActivities(taskId);
      return activities;
    },
    enabled: !!taskId,
    staleTime: 30 * 1000, // 30 seconds
  });
}

interface AddActivityParams {
  taskId: string;
  activityType: ActivityType;
  actorId: string;
  actorName: string;
  actorAvatar?: string;
  oldValue?: string;
  newValue?: string;
}

/**
 * Add a new activity event to a task
 */
export function useAddKanbanActivity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      taskId,
      activityType,
      actorId,
      actorName,
      actorAvatar,
      oldValue,
      newValue,
    }: AddActivityParams) => {
      const gateway = getGatewayClient();
      const activity = await gateway.addKanbanActivity(
        taskId,
        activityType,
        actorId,
        actorName,
        actorAvatar,
        oldValue,
        newValue
      );
      return activity;
    },
    onSuccess: (newActivity) => {
      // Invalidate and refetch activities
      queryClient.invalidateQueries({
        queryKey: kanbanActivitiesKeys.activities(newActivity.task_id),
      });
    },
  });
}

/**
 * Helper hook to record task changes as activities
 */
export function useRecordTaskActivity() {
  const addActivity = useAddKanbanActivity();

  const recordActivity = async (params: {
    taskId: string;
    type: ActivityType;
    actorId?: string;
    actorName?: string;
    oldValue?: string;
    newValue?: string;
  }) => {
    const { taskId, type, actorId = "current-user", actorName = "You", oldValue, newValue } = params;

    try {
      await addActivity.mutateAsync({
        taskId,
        activityType: type,
        actorId,
        actorName,
        oldValue,
        newValue,
      });
    } catch (error) {
      console.error("Failed to record activity:", error);
    }
  };

  return {
    recordActivity,
    isRecording: addActivity.isPending,
  };
}

/**
 * Clear all comments and activities for a task
 */
export function useClearKanbanTaskData() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (taskId: string) => {
      const gateway = getGatewayClient();
      await gateway.clearKanbanTaskData(taskId);
      return taskId;
    },
    onSuccess: (taskId) => {
      // Invalidate both comments and activities
      queryClient.invalidateQueries({
        queryKey: ["kanban-comments", "comments", taskId],
      });
      queryClient.invalidateQueries({
        queryKey: kanbanActivitiesKeys.activities(taskId),
      });
    },
  });
}
