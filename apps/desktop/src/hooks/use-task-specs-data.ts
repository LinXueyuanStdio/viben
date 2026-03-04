/**
 * Task Specs Data Hook
 * 任务规格数据加载 Hook
 *
 * Loads task-specific data from the Gateway API:
 * - PRD content
 * - Implementation plan subtasks
 * - Execution logs
 * - Task directory path (for file browsing)
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { getGatewayClient } from "@/lib/gateway";
import type {
  TaskSpecsDataResponse,
  TaskSpecSubtask,
  TaskLogs,
} from "@/lib/gateway/modules/tasks";

// Re-export types for convenience
export type { TaskSpecSubtask as ImplementationSubtask } from "@/lib/gateway/modules/tasks";

/**
 * Implementation plan structure (for compatibility)
 */
export interface ImplementationPlan {
  version?: string;
  task_id?: string;
  subtasks: TaskSpecSubtask[];
  created_at?: string;
  updated_at?: string;
}

/**
 * Task specs data returned by the hook
 */
export interface TaskSpecsData {
  // PRD content
  prdContent: string | null;
  prdPath: string | null;

  // Subtasks from implementation plan
  subtasks: TaskSpecSubtask[];

  // Execution logs
  logs: TaskLogs | null;

  // Task directory path for file browsing
  taskDir: string | null;

  // Loading and error states
  isLoading: boolean;
  error: string | null;

  // Refresh function
  refresh: () => void;
}

/**
 * Hook to load task specs data from Gateway API
 *
 * @param taskId - Task ID to load data for
 * @param workspacePath - Workspace path where task is located
 * @returns TaskSpecsData object with loaded data and loading state
 */
export function useTaskSpecsData(
  taskId: string | null,
  workspacePath: string
): TaskSpecsData {
  const [prdContent, setPrdContent] = useState<string | null>(null);
  const [prdPath, setPrdPath] = useState<string | null>(null);
  const [subtasks, setSubtasks] = useState<TaskSpecSubtask[]>([]);
  const [logs, setLogs] = useState<TaskLogs | null>(null);
  const [taskDir, setTaskDir] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track last loaded task to avoid duplicate loads
  const lastLoadedRef = useRef<{ taskId: string | null; workspacePath: string }>({
    taskId: null,
    workspacePath: "",
  });

  /**
   * Load specs data from Gateway API
   */
  const loadSpecsData = useCallback(async () => {
    if (!taskId || !workspacePath) {
      // Reset state when no task is selected
      setPrdContent(null);
      setPrdPath(null);
      setSubtasks([]);
      setLogs(null);
      setTaskDir(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    // Skip if already loading the same task
    if (
      lastLoadedRef.current.taskId === taskId &&
      lastLoadedRef.current.workspacePath === workspacePath
    ) {
      return;
    }

    lastLoadedRef.current = { taskId, workspacePath };
    setIsLoading(true);
    setError(null);

    try {
      const client = getGatewayClient();
      console.log("[useTaskSpecsData] Loading specs for task:", taskId, "workspace:", workspacePath);
      const specsData: TaskSpecsDataResponse = await client.getTaskSpecsData(
        taskId,
        workspacePath
      );
      console.log("[useTaskSpecsData] Received specs data:", specsData);

      // Update state from API response
      setPrdContent(specsData.prd_content);
      setPrdPath(specsData.prd_path);
      setSubtasks(specsData.subtasks || []);
      setLogs(specsData.logs);
      setTaskDir(specsData.task_dir);
    } catch (err) {
      console.error("[useTaskSpecsData] Error loading specs data:", err);
      // Don't set error for 404 (task specs not found is not an error)
      if (err instanceof Error && !err.message.includes("404")) {
        setError(err.message);
      }
      // Reset to empty state on error
      setPrdContent(null);
      setPrdPath(null);
      setSubtasks([]);
      setLogs(null);
      setTaskDir(null);
    } finally {
      setIsLoading(false);
    }
  }, [taskId, workspacePath]);

  /**
   * Refresh function to reload data
   */
  const refresh = useCallback(() => {
    // Force reload by clearing the last loaded ref
    lastLoadedRef.current = { taskId: null, workspacePath: "" };
    loadSpecsData();
  }, [loadSpecsData]);

  // Load data when task or workspace changes
  useEffect(() => {
    loadSpecsData();
  }, [loadSpecsData]);

  return {
    prdContent,
    prdPath,
    subtasks,
    logs,
    taskDir,
    isLoading,
    error,
    refresh,
  };
}
