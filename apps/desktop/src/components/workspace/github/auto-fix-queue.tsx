/**
 * Auto-Fix Queue Component
 *
 * Displays a list of all auto-fix tasks with their progress and controls.
 */

import { useTranslation } from "react-i18next";
import {
  CircleDot,
  ExternalLink,
  XCircle,
  CheckCircle,
  Clock,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AutoFixProgress } from "./auto-fix-progress";
import type { AutoFixTask } from "@/stores/github-store";

interface AutoFixQueueProps {
  tasks: AutoFixTask[];
  onCancel: (taskId: string) => void;
  onApprove: (taskId: string) => void;
  onRemove?: (taskId: string) => void;
}

export function AutoFixQueue({
  tasks,
  onCancel,
  onApprove,
  onRemove,
}: AutoFixQueueProps) {
  const { t } = useTranslation();

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <CircleDot className="h-10 w-10 text-muted-foreground/30 mb-3" />
        <p className="text-sm text-muted-foreground">
          {t("workspaceSettings.github.autoFix.noTasks", "No tasks in queue")}
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border">
      {tasks.map((task) => (
        <AutoFixQueueItem
          key={task.id}
          task={task}
          onCancel={onCancel}
          onApprove={onApprove}
          onRemove={onRemove}
        />
      ))}
    </div>
  );
}

interface AutoFixQueueItemProps {
  task: AutoFixTask;
  onCancel: (taskId: string) => void;
  onApprove: (taskId: string) => void;
  onRemove?: (taskId: string) => void;
}

function AutoFixQueueItem({
  task,
  onCancel,
  onApprove,
  onRemove,
}: AutoFixQueueItemProps) {
  const { t } = useTranslation();

  const isActive = ["queued", "analyzing", "plan", "implement", "check", "fix", "creating_pr"].includes(task.status);
  const isAwaitingApproval = task.status === "awaiting_approval";
  const isDone = ["completed", "failed", "cancelled"].includes(task.status);

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="p-4 space-y-3 hover:bg-muted/30 transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Issue numbers */}
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-sm">
              {task.issue_numbers.length === 1 ? (
                <>{t("workspaceSettings.github.autoFix.issueNumber", "Issue #{{number}}", { number: task.issue_numbers[0] })}</>
              ) : (
                <>
                  {task.issue_numbers.length} {t("workspaceSettings.github.autoFix.issues", "issues")}
                </>
              )}
            </span>
            {task.issue_numbers.length > 1 && (
              <div className="flex gap-1">
                {task.issue_numbers.slice(0, 3).map((num) => (
                  <Badge key={num} variant="secondary" className="text-xs px-1.5">
                    #{num}
                  </Badge>
                ))}
                {task.issue_numbers.length > 3 && (
                  <Badge variant="secondary" className="text-xs px-1.5">
                    +{task.issue_numbers.length - 3}
                  </Badge>
                )}
              </div>
            )}
          </div>

          {/* Timestamps */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {t("common.created")}: {formatTime(task.created_at)}
            </span>
            {task.updated_at !== task.created_at && (
              <span>
                {t("common.updated")}: {formatTime(task.updated_at)}
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          {isActive && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-destructive hover:text-destructive"
              onClick={() => onCancel(task.id)}
            >
              <XCircle className="h-4 w-4 mr-1" />
              {t("common.cancel")}
            </Button>
          )}

          {isAwaitingApproval && (
            <Button
              size="sm"
              className="h-7 px-2"
              onClick={() => onApprove(task.id)}
            >
              <CheckCircle className="h-4 w-4 mr-1" />
              {t("workspaceSettings.github.autoFix.approve", "Approve")}
            </Button>
          )}

          {isDone && onRemove && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-muted-foreground"
              onClick={() => onRemove(task.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}

          {task.pr_number && (
            <a
              href={`https://github.com/${task.workspace_path}/pull/${task.pr_number}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                <ExternalLink className="h-4 w-4" />
              </Button>
            </a>
          )}
        </div>
      </div>

      {/* Progress */}
      <AutoFixProgress task={task} compact={isDone} />
    </div>
  );
}
