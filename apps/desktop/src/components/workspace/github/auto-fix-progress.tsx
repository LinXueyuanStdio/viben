/**
 * Auto-Fix Progress Component
 *
 * Displays real-time progress for a single auto-fix task.
 */

import { useTranslation } from "react-i18next";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  FileCode,
  Play,
  TestTube,
  Eye,
  GitPullRequest,
  AlertCircle,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { AutoFixTask, AutoFixTaskStatus } from "@/stores/github-store";

interface AutoFixProgressProps {
  task: AutoFixTask;
  compact?: boolean;
}

// Status icon mapping
const statusIcons: Record<AutoFixTaskStatus, React.ComponentType<{ className?: string }>> = {
  queued: Clock,
  analyzing: Search,
  planning: FileCode,
  executing: Play,
  testing: TestTube,
  awaiting_approval: Eye,
  creating_pr: GitPullRequest,
  completed: CheckCircle2,
  failed: XCircle,
  cancelled: XCircle,
};

// Status colors
const statusColors: Record<AutoFixTaskStatus, string> = {
  queued: "text-muted-foreground",
  analyzing: "text-blue-500",
  planning: "text-purple-500",
  executing: "text-amber-500",
  testing: "text-cyan-500",
  awaiting_approval: "text-orange-500",
  creating_pr: "text-green-500",
  completed: "text-green-600",
  failed: "text-destructive",
  cancelled: "text-muted-foreground",
};

// Status badge colors
const statusBadgeColors: Record<AutoFixTaskStatus, string> = {
  queued: "bg-muted text-muted-foreground",
  analyzing: "bg-blue-500/10 text-blue-600 border-blue-500/30",
  planning: "bg-purple-500/10 text-purple-600 border-purple-500/30",
  executing: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  testing: "bg-cyan-500/10 text-cyan-600 border-cyan-500/30",
  awaiting_approval: "bg-orange-500/10 text-orange-600 border-orange-500/30",
  creating_pr: "bg-green-500/10 text-green-600 border-green-500/30",
  completed: "bg-green-500/10 text-green-600 border-green-500/30",
  failed: "bg-destructive/10 text-destructive border-destructive/30",
  cancelled: "bg-muted text-muted-foreground",
};

// Progress percentage by status
const statusProgress: Record<AutoFixTaskStatus, number> = {
  queued: 0,
  analyzing: 15,
  planning: 30,
  executing: 50,
  testing: 70,
  awaiting_approval: 85,
  creating_pr: 95,
  completed: 100,
  failed: 0,
  cancelled: 0,
};

export function AutoFixProgress({ task, compact = false }: AutoFixProgressProps) {
  const { t } = useTranslation();

  const StatusIcon = statusIcons[task.status];
  const isActive = ["queued", "analyzing", "planning", "executing", "testing", "creating_pr"].includes(task.status);
  const progress = task.progress ?? statusProgress[task.status];

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <StatusIcon
          className={cn(
            "h-4 w-4",
            statusColors[task.status],
            isActive && "animate-pulse"
          )}
        />
        <span className="text-sm text-muted-foreground">
          {task.progress_message || t(`workspaceSettings.github.autoFix.status.${task.status}`, task.status)}
        </span>
        {isActive && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Status header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StatusIcon
            className={cn(
              "h-5 w-5",
              statusColors[task.status],
              isActive && "animate-pulse"
            )}
          />
          <span className="font-medium">
            {t(`workspaceSettings.github.autoFix.status.${task.status}`, task.status)}
          </span>
          {isActive && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
        <Badge variant="outline" className={cn("text-xs", statusBadgeColors[task.status])}>
          {task.status}
        </Badge>
      </div>

      {/* Progress bar */}
      {isActive && (
        <div className="space-y-1">
          <Progress value={progress} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{task.progress_message || "Processing..."}</span>
            <span>{progress}%</span>
          </div>
        </div>
      )}

      {/* Error message */}
      {task.status === "failed" && task.error && (
        <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{task.error}</span>
        </div>
      )}

      {/* Success info */}
      {task.status === "completed" && task.pr_number && (
        <div className="flex items-center gap-2 text-sm text-green-600 bg-green-500/10 p-3 rounded-lg">
          <GitPullRequest className="h-4 w-4" />
          <span>
            {t("workspaceSettings.github.autoFix.prCreated", "Pull request created")}: #{task.pr_number}
          </span>
        </div>
      )}

      {/* Branch info */}
      {task.branch_name && (
        <div className="text-xs text-muted-foreground font-mono">
          Branch: {task.branch_name}
        </div>
      )}
    </div>
  );
}
