import {
  TaskLogsTab,
  TaskPRDTab,
  TaskSubtasksTab,
} from "../task-tabs";
import { getGatewayClient } from "@/lib/gateway";
import type { TaskSpecsData } from "@/hooks";
import type { TaskForPanel } from "./types";

export interface SpecsSubtasksTabProps {
  task: TaskForPanel;
  specsData: TaskSpecsData;
}

export function SpecsSubtasksTab({ task, specsData }: SpecsSubtasksTabProps) {
  return (
    <TaskSubtasksTab
      subtasks={
        specsData.subtasks.length > 0
          ? specsData.subtasks.map((s) => ({
              id: s.id,
              title: s.title,
              completed: s.status === "completed",
              description: s.description,
              files: s.files,
              status: s.status,
            }))
          : (task.subtasks || []).map((s) => ({
              id: s.id,
              title: s.title,
              completed: s.completed,
              description: undefined,
              files: undefined,
            }))
      }
      isLoading={specsData.isLoading}
      onSubtaskClick={(subtaskId) => {
        const allSubtasks = specsData.subtasks.length > 0
          ? specsData.subtasks
          : task.subtasks || [];
        const subtask = allSubtasks.find((s) => s.id === subtaskId);
        if (subtask && "files" in subtask && subtask.files && subtask.files.length > 0) {
          const client = getGatewayClient();
          client.openFile(subtask.files[0]).catch(console.error);
        } else {
          console.log("Subtask clicked (no files):", subtaskId, subtask);
        }
      }}
      onFileClick={(filePath) => {
        const client = getGatewayClient();
        client.openFile(filePath).catch(console.error);
      }}
    />
  );
}

export interface SpecsPrdTabProps {
  task: TaskForPanel;
  specsData: TaskSpecsData;
}

export function SpecsPrdTab({ task, specsData }: SpecsPrdTabProps) {
  return (
    <TaskPRDTab
      taskId={task.id}
      prdContent={specsData.prdContent ?? task.prdContent}
      prdPath={specsData.prdPath ?? (task.specsPath ? `${task.specsPath}/spec.md` : undefined)}
      isLoading={specsData.isLoading}
      error={specsData.error}
      onRefresh={specsData.refresh}
      onOpenInEditor={(path) => {
        const client = getGatewayClient();
        client.openFile(path).catch(console.error);
      }}
    />
  );
}

export interface SpecsLogsTabProps {
  task: TaskForPanel;
  specsData: TaskSpecsData;
}

export function SpecsLogsTab({ task, specsData }: SpecsLogsTabProps) {
  return (
    <TaskLogsTab
      taskId={task.id}
      logs={
        specsData.logs
          ? { taskId: task.id, phases: specsData.logs.phases }
          : task.logs
      }
      isLoading={specsData.isLoading}
      error={specsData.error}
      autoScroll={true}
      onRefresh={specsData.refresh}
      isTaskRunning={task.status === "in_progress"}
      pollingInterval={3000}
    />
  );
}
