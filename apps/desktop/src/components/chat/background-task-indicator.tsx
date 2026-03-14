/**
 * BackgroundTaskIndicator Component
 *
 * Shows a notification indicator for running background tasks.
 * Displays in the header/navbar area with a popover for task details.
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Loader2,
  X,
  Bell,
  CheckCircle2,
  AlertCircle,
  Ban,
  Clock,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  useBackgroundTasks,
  type BackgroundTask,
  type BackgroundTaskStatus,
} from "@/hooks/use-background-tasks";

// ============================================================================
// Sub-Components
// ============================================================================

interface TaskItemProps {
  task: BackgroundTask;
  onStop: (taskId: string) => void;
}

function TaskStatusIcon({ status }: { status: BackgroundTaskStatus }) {
  switch (status) {
    case "running":
      return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
    case "completed":
      return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
    case "error":
      return <AlertCircle className="h-4 w-4 text-destructive" />;
    case "cancelled":
      return <Ban className="h-4 w-4 text-muted-foreground" />;
  }
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}

function formatCost(cost: number): string {
  if (cost < 0.01) return `<$0.01`;
  return `$${cost.toFixed(2)}`;
}

function TaskItem({ task, onStop }: TaskItemProps) {
  const { t } = useTranslation();
  const prefersReducedMotion = useReducedMotion();

  // Truncate prompt for display
  const displayPrompt =
    task.prompt.length > 60 ? task.prompt.slice(0, 60) + "..." : task.prompt;

  return (
    <motion.div
      initial={{ opacity: 0, y: prefersReducedMotion ? 0 : -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: prefersReducedMotion ? 0 : 10 }}
      transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
      className={cn(
        "flex items-start gap-2 p-2.5 rounded-lg transition-colors",
        task.status === "running"
          ? "bg-primary/5 border border-primary/20"
          : task.status === "completed"
            ? "bg-emerald-50/50 dark:bg-emerald-950/20"
            : task.status === "error"
              ? "bg-destructive/5"
              : "bg-muted/50"
      )}
    >
      <div className="mt-0.5">
        <TaskStatusIcon status={task.status} />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">
          {displayPrompt}
        </p>
        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
          {task.status === "running" ? (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {t("chat.backgroundTask.running")}
            </span>
          ) : task.status === "completed" ? (
            <>
              {task.duration !== undefined && (
                <span>{formatDuration(task.duration)}</span>
              )}
              {task.cost !== undefined && <span>{formatCost(task.cost)}</span>}
            </>
          ) : task.status === "error" ? (
            <span className="text-destructive truncate">
              {task.errorMessage || t("chat.backgroundTask.failed")}
            </span>
          ) : (
            <span>{t("chat.backgroundTask.cancelled")}</span>
          )}
        </div>
      </div>

      {task.status === "running" && (
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          onClick={() => onStop(task.taskId)}
          title={t("chat.backgroundTask.stop")}
        >
          <X className="h-3 w-3" />
        </Button>
      )}
    </motion.div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

interface BackgroundTaskIndicatorProps {
  className?: string;
}

export function BackgroundTaskIndicator({
  className,
}: BackgroundTaskIndicatorProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  const {
    tasks,
    runningTasks,
    runningCount,
    recentlyCompletedTasks,
    stopTask,
    clearCompleted,
    isConnected,
  } = useBackgroundTasks();

  // Count of completed/failed tasks to show notification
  const notificationCount = runningCount + recentlyCompletedTasks.length;

  // Don't render if no tasks and no recent completions
  if (notificationCount === 0 && tasks.length === 0) {
    return null;
  }

  const handleStopTask = async (taskId: string) => {
    try {
      await stopTask(taskId);
    } catch {
      // Error already logged in hook
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("relative", className)}
          aria-label={t("chat.backgroundTask.title")}
        >
          <Bell className="h-4 w-4" />
          {notificationCount > 0 && (
            <motion.span
              initial={{ scale: prefersReducedMotion ? 1 : 0 }}
              animate={{ scale: 1 }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
              className={cn(
                "absolute -top-1 -right-1 h-4 w-4 rounded-full text-[10px] font-medium flex items-center justify-center",
                runningCount > 0
                  ? "bg-primary text-primary-foreground"
                  : "bg-emerald-500 text-white"
              )}
            >
              {notificationCount > 9 ? "9+" : notificationCount}
            </motion.span>
          )}
          {runningCount > 0 && (
            <motion.span
              initial={{ opacity: prefersReducedMotion ? 1 : 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
              className={cn(
                "absolute inset-0 rounded-md bg-primary/10",
                !prefersReducedMotion && "animate-pulse"
              )}
            />
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-80 p-0" align="end" sideOffset={8}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <h4 className="font-medium text-sm">
              {t("chat.backgroundTask.title")}
            </h4>
            {runningCount > 0 && (
              <span className="bg-primary/20 text-primary rounded-full px-2 py-0.5 text-xs font-medium">
                {runningCount} {t("chat.backgroundTask.running")}
              </span>
            )}
          </div>

          {/* Connection status dot */}
          <div
            className={cn(
              "h-2 w-2 rounded-full",
              isConnected ? "bg-emerald-500" : "bg-muted-foreground"
            )}
            title={
              isConnected
                ? t("chat.backgroundTask.connected")
                : t("chat.backgroundTask.disconnected")
            }
          />
        </div>

        {/* Task list */}
        <div className="max-h-80 overflow-y-auto">
          {tasks.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              {t("chat.backgroundTask.noTasks")}
            </div>
          ) : (
            <div className="p-2 space-y-2">
              <AnimatePresence mode="popLayout">
                {/* Running tasks first */}
                {runningTasks.map((task) => (
                  <TaskItem
                    key={task.taskId}
                    task={task}
                    onStop={handleStopTask}
                  />
                ))}
                {/* Then completed/failed tasks */}
                {tasks
                  .filter((t) => t.status !== "running")
                  .map((task) => (
                    <TaskItem
                      key={task.taskId}
                      task={task}
                      onStop={handleStopTask}
                    />
                  ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Footer actions */}
        {tasks.some((t) => t.status !== "running") && (
          <div className="px-4 py-2 border-t bg-muted/30">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-muted-foreground hover:text-foreground"
              onClick={clearCompleted}
            >
              <Trash2 className="h-3.5 w-3.5 mr-2" />
              {t("chat.backgroundTask.clearCompleted")}
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
