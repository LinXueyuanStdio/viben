/**
 * TaskWarnings - Warning indicators for stuck and incomplete tasks
 *
 * Based on Auto-Claude's TaskWarnings.tsx pattern.
 * Shows visual warnings when tasks are stuck or incomplete,
 * with one-click recovery functionality.
 */

import { AlertTriangle, Play, RotateCcw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { formatStuckDuration } from "@/hooks/use-stuck-detection";

export interface TaskWarningsProps {
  /** Whether the task is stuck (process not running but marked as in_progress) */
  isStuck: boolean;
  /** Whether the task is incomplete (has spec but crashed before completing subtasks) */
  isIncomplete: boolean;
  /** Whether recovery is in progress */
  isRecovering: boolean;
  /** Subtask progress for incomplete task warning */
  taskProgress?: { completed: number; total: number };
  /** How long the task has been stuck (in ms) */
  stuckDuration?: number;
  /** Callback to recover a stuck task */
  onRecover: () => void;
  /** Callback to resume an incomplete task */
  onResume: () => void;
  /** Optional className */
  className?: string;
}

/**
 * TaskWarnings component displays warning banners for problematic task states
 *
 * Two types of warnings:
 * 1. Stuck Task - Task is marked as running but no process is found
 * 2. Incomplete Task - Task has a spec but crashed before completing subtasks
 */
export function TaskWarnings({
  isStuck,
  isIncomplete,
  isRecovering,
  taskProgress = { completed: 0, total: 0 },
  stuckDuration,
  onRecover,
  onResume,
  className,
}: TaskWarningsProps) {
  const { t } = useTranslation();

  if (!isStuck && !isIncomplete) return null;

  return (
    <div className={className}>
      {/* Stuck Task Warning */}
      {isStuck && (
        <div className="rounded-xl border border-warning/30 bg-warning/10 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-medium text-sm text-foreground mb-1">
                {t("workspace.taskWarnings.stuckTitle", "Task Appears Stuck")}
              </h3>
              <p className="text-sm text-muted-foreground mb-3">
                {t(
                  "workspace.taskWarnings.stuckDescription",
                  "This task is marked as running but no active process was found. This can happen if the app crashed or the process was terminated unexpectedly."
                )}
              </p>
              {stuckDuration && stuckDuration > 0 && (
                <p className="text-xs text-muted-foreground mb-3">
                  {t("workspace.taskWarnings.stuckDuration", "Stuck for {{duration}}", {
                    duration: formatStuckDuration(stuckDuration),
                  })}
                </p>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={onRecover}
                disabled={isRecovering}
                className="w-full text-warning border-warning/30 hover:bg-warning/10"
              >
                {isRecovering ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t("workspace.taskWarnings.recovering", "Recovering...")}
                  </>
                ) : (
                  <>
                    <RotateCcw className="mr-2 h-4 w-4" />
                    {t("workspace.taskWarnings.recoverAndRestart", "Recover & Restart Task")}
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Incomplete Task Warning */}
      {isIncomplete && !isStuck && (
        <div className="rounded-xl border border-orange-500/30 bg-orange-500/10 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-orange-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-medium text-sm text-foreground mb-1">
                {t("workspace.taskWarnings.incompleteTitle", "Task Incomplete")}
              </h3>
              <p className="text-sm text-muted-foreground mb-3">
                {t(
                  "workspace.taskWarnings.incompleteDescription",
                  "This task has a spec and implementation plan but never completed any subtasks ({{completed}}/{{total}}). The process likely crashed during spec creation. Click Resume to continue implementation.",
                  {
                    completed: taskProgress.completed,
                    total: taskProgress.total,
                  }
                )}
              </p>
              <Button
                variant="default"
                size="sm"
                onClick={onResume}
                disabled={isRecovering}
                className="w-full"
              >
                {isRecovering ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t("workspace.taskWarnings.resuming", "Resuming...")}
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    {t("workspace.taskWarnings.resumeTask", "Resume Task")}
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TaskWarnings;
