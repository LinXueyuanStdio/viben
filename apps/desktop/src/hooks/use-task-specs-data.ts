/**
 * Task Specs Data Hook
 * 任务规格数据加载 Hook
 *
 * Loads task-specific data from the .viben/tasks/{taskId}/ directory,
 * including PRD, implementation plan, logs, and modified files.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { getGatewayClient } from "@/lib/gateway";
import type { TaskLog, TaskLogPhase, LogEntry, TaskFile } from "@/components/workspace/task-tabs";

/**
 * Subtask data from implementation_plan.json
 */
export interface ImplementationSubtask {
  id: string;
  title: string;
  description?: string;
  status: "pending" | "in_progress" | "completed" | "failed";
  files?: string[];
  order?: number;
}

/**
 * Implementation plan structure (from Auto-Claude)
 */
export interface ImplementationPlan {
  version?: string;
  task_id?: string;
  subtasks: ImplementationSubtask[];
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
  subtasks: ImplementationSubtask[];

  // Execution logs
  logs: TaskLog | null;

  // Modified files
  files: TaskFile[];

  // Loading and error states
  isLoading: boolean;
  error: string | null;

  // Refresh function
  refresh: () => void;
}

/**
 * Parse log file content into log entries
 */
function parseLogContent(content: string, phaseId: string): LogEntry[] {
  const entries: LogEntry[] = [];
  const lines = content.split("\n").filter((line) => line.trim());

  for (const line of lines) {
    // Try to parse structured log format: [timestamp] [level] message
    const match = line.match(/^\[([^\]]+)\]\s*\[([^\]]+)\]\s*(.*)$/);

    if (match) {
      const [, timestamp, level, message] = match;
      const entryType = mapLogLevel(level);

      entries.push({
        id: `${phaseId}-${entries.length}`,
        type: entryType,
        message: message,
        timestamp: timestamp || new Date().toISOString(),
      });
    } else {
      // Fallback: treat as plain text
      entries.push({
        id: `${phaseId}-${entries.length}`,
        type: "text",
        message: line,
        timestamp: new Date().toISOString(),
      });
    }
  }

  return entries;
}

/**
 * Map log level string to LogEntryType
 */
function mapLogLevel(level: string): LogEntry["type"] {
  const normalized = level.toLowerCase().trim();
  switch (normalized) {
    case "error":
    case "err":
      return "error";
    case "warn":
    case "warning":
      return "warning";
    case "success":
    case "ok":
      return "success";
    case "info":
      return "info";
    case "tool_start":
    case "start":
      return "tool_start";
    case "tool_end":
    case "end":
      return "tool_end";
    default:
      return "text";
  }
}

/**
 * Hook to load task specs data from .viben/tasks/{taskId}/ directory
 *
 * @param taskId - Task ID to load data for
 * @param workspacePath - Workspace path where .viben directory is located
 * @returns TaskSpecsData object with loaded data and loading state
 */
export function useTaskSpecsData(
  taskId: string | null,
  workspacePath: string
): TaskSpecsData {
  const [prdContent, setPrdContent] = useState<string | null>(null);
  const [prdPath, setPrdPath] = useState<string | null>(null);
  const [subtasks, setSubtasks] = useState<ImplementationSubtask[]>([]);
  const [logs, setLogs] = useState<TaskLog | null>(null);
  const [files, setFiles] = useState<TaskFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track last loaded task to avoid duplicate loads
  const lastLoadedRef = useRef<{ taskId: string | null; workspacePath: string }>({
    taskId: null,
    workspacePath: "",
  });

  /**
   * Load all specs data for the task
   */
  const loadSpecsData = useCallback(async () => {
    if (!taskId || !workspacePath) {
      // Reset state when no task is selected
      setPrdContent(null);
      setPrdPath(null);
      setSubtasks([]);
      setLogs(null);
      setFiles([]);
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

    const client = getGatewayClient();
    const specsDir = `${workspacePath}/.viben/tasks/${taskId}`;

    try {
      // Load PRD content (spec.md)
      const prdFilePath = `${specsDir}/spec.md`;
      try {
        const prdResult = await client.readFile(prdFilePath);
        setPrdContent(prdResult.content);
        setPrdPath(prdFilePath);
      } catch {
        // PRD file doesn't exist yet
        setPrdContent(null);
        setPrdPath(null);
      }

      // Load implementation plan (implementation_plan.json)
      try {
        const planPath = `${specsDir}/implementation_plan.json`;
        const planResult = await client.readFile(planPath);
        const plan = JSON.parse(planResult.content) as ImplementationPlan;
        setSubtasks(plan.subtasks || []);
      } catch {
        // Plan doesn't exist yet
        setSubtasks([]);
      }

      // Load logs from logs/ directory
      try {
        const logsDir = `${specsDir}/logs`;
        const logsListResult = await client.listFiles(logsDir);

        if (logsListResult.entries && logsListResult.entries.length > 0) {
          const phases: TaskLogPhase[] = [];

          // Standard phase files to look for
          const phaseFiles = ["planning.log", "coding.log", "validation.log"];

          for (const phaseFile of phaseFiles) {
            const entry = logsListResult.entries.find((e) => e.name === phaseFile);
            if (entry) {
              try {
                const logPath = `${logsDir}/${phaseFile}`;
                const logResult = await client.readFile(logPath);
                const phaseName = phaseFile.replace(".log", "");
                const entries = parseLogContent(logResult.content, phaseName);

                // Determine phase status based on entries
                let status: TaskLogPhase["status"] = "pending";
                if (entries.length > 0) {
                  const hasError = entries.some((e) => e.type === "error");
                  const hasSuccess = entries.some((e) => e.type === "success");
                  if (hasError) status = "failed";
                  else if (hasSuccess) status = "complete";
                  else status = "running";
                }

                phases.push({
                  id: phaseName,
                  name: phaseName.charAt(0).toUpperCase() + phaseName.slice(1),
                  status,
                  entries,
                });
              } catch {
                // Skip unreadable log files
              }
            }
          }

          // Also check for any other .log files
          for (const entry of logsListResult.entries) {
            if (
              entry.name.endsWith(".log") &&
              !phaseFiles.includes(entry.name)
            ) {
              try {
                const logPath = `${logsDir}/${entry.name}`;
                const logResult = await client.readFile(logPath);
                const phaseName = entry.name.replace(".log", "");
                const entries = parseLogContent(logResult.content, phaseName);

                phases.push({
                  id: phaseName,
                  name: phaseName.charAt(0).toUpperCase() + phaseName.slice(1),
                  status: entries.length > 0 ? "complete" : "pending",
                  entries,
                });
              } catch {
                // Skip unreadable log files
              }
            }
          }

          if (phases.length > 0) {
            setLogs({
              taskId,
              phases,
            });
          } else {
            setLogs(null);
          }
        } else {
          setLogs(null);
        }
      } catch {
        // Logs directory doesn't exist
        setLogs(null);
      }

      // Load modified files list (files.json or scan directory)
      try {
        // First try to read files.json
        const filesJsonPath = `${specsDir}/files.json`;
        try {
          const filesResult = await client.readFile(filesJsonPath);
          const filesData = JSON.parse(filesResult.content) as {
            files?: Array<{ path: string; name?: string }>;
          };
          if (filesData.files && Array.isArray(filesData.files)) {
            const loadedFiles: TaskFile[] = filesData.files.map((f) => {
              const name = f.name || f.path.split("/").pop() || f.path;
              const extension = name.includes(".")
                ? name.split(".").pop()
                : undefined;
              return {
                path: f.path,
                name,
                type: "file" as const,
                extension,
              };
            });
            setFiles(loadedFiles);
          } else {
            setFiles([]);
          }
        } catch {
          // files.json doesn't exist, try to list the specs directory
          // and look for any files that might be relevant
          setFiles([]);
        }
      } catch {
        setFiles([]);
      }
    } catch (err) {
      console.error("[useTaskSpecsData] Error loading specs data:", err);
      setError(err instanceof Error ? err.message : "Failed to load task data");
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
    files,
    isLoading,
    error,
    refresh,
  };
}
