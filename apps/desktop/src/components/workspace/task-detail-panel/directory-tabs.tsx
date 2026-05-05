import { FolderOpen } from "lucide-react";
import type { TFunction } from "i18next";
import { FileBrowser } from "@/components/file-browser";
import type { TaskForPanel } from "./types";

export interface TaskDirectoryTabProps {
  taskDir?: string | null;
  workspacePath: string;
  t: TFunction;
}

export function TaskDirectoryTab({ taskDir, workspacePath, t }: TaskDirectoryTabProps) {
  if (taskDir) {
    return (
      <FileBrowser
        workspacePath={workspacePath}
        initialPath={taskDir}
        hideToolbar={true}
        className="h-full"
      />
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-full py-12">
      <FolderOpen className="h-12 w-12 text-muted-foreground/30 mb-4" />
      <h3 className="text-lg font-medium text-muted-foreground mb-2">
        {t("workspace.taskDirTab.noTaskDir", "No task directory")}
      </h3>
      <p className="text-sm text-muted-foreground/60 text-center max-w-xs">
        {t(
          "workspace.taskDirTab.taskDirWillAppear",
          "Task files will appear here after the task directory is created"
        )}
      </p>
    </div>
  );
}

export interface WorkingDirectoryTabProps {
  task: TaskForPanel;
  workspacePath: string;
  t: TFunction;
}

export function WorkingDirectoryTab({ task, workspacePath, t }: WorkingDirectoryTabProps) {
  const workingDir = task.worktree_path || task.workspace_path || workspacePath;

  if (workingDir) {
    return (
      <FileBrowser
        workspacePath={workspacePath}
        initialPath={workingDir}
        hideToolbar={true}
        className="h-full"
      />
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-full py-12">
      <FolderOpen className="h-12 w-12 text-muted-foreground/30 mb-4" />
      <h3 className="text-lg font-medium text-muted-foreground mb-2">
        {t("workspace.workingDirTab.noWorkingDir", "No working directory")}
      </h3>
      <p className="text-sm text-muted-foreground/60 text-center max-w-xs">
        {t(
          "workspace.workingDirTab.workingDirWillAppear",
          "Working directory will appear here when the task is assigned to a workspace"
        )}
      </p>
    </div>
  );
}
