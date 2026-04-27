/**
 * Tasks tab content for the right sidebar
 * Displays kanban tasks grouped by status
 */
import React, { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  CheckSquare,
  Circle,
  Clock,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { TasksTabContentProps } from "./types";
import type { TaskWithAttemptStatus, TaskStatus } from "@/lib/kanban";

/**
 * Get status icon component
 * Using unified task status system: backlog, queue, in_progress, paused, review, completed, failed, cancelled, archived
 */
function getStatusIcon(status: TaskStatus) {
  switch (status) {
    case "backlog":
      return Circle;
    case "queue":
      return Clock;
    case "in_progress":
      return Clock;
    case "review":
      return AlertCircle;
    case "paused":
      return Clock;
    case "completed":
      return CheckCircle2;
    case "failed":
      return XCircle;
    case "cancelled":
      return XCircle;
    case "archived":
      return Circle;
    default:
      return Circle;
  }
}

/**
 * Get status color class
 */
function getStatusColor(status: TaskStatus) {
  switch (status) {
    case "backlog":
      return "text-muted-foreground";
    case "queue":
      return "text-cyan-500";
    case "in_progress":
      return "text-blue-500";
    case "review":
      return "text-purple-500";
    case "paused":
      return "text-yellow-500";
    case "completed":
      return "text-green-500";
    case "failed":
      return "text-red-500";
    case "cancelled":
      return "text-muted-foreground";
    case "archived":
      return "text-slate-500";
    default:
      return "text-muted-foreground";
  }
}

/**
 * Status labels for display
 * Using unified task status system
 */
const STATUS_LABELS: Record<TaskStatus, { key: string; fallback: string }> = {
  backlog: { key: "workspace.column.backlog", fallback: "Backlog" },
  queue: { key: "workspace.column.queue", fallback: "Queue" },
  in_progress: { key: "workspace.column.inProgress", fallback: "In Progress" },
  paused: { key: "workspace.column.paused", fallback: "Paused" },
  review: { key: "workspace.column.review", fallback: "Review" },
  completed: { key: "workspace.column.completed", fallback: "Completed" },
  failed: { key: "workspace.column.failed", fallback: "Failed" },
  cancelled: { key: "workspace.column.cancelled", fallback: "Cancelled" },
  archived: { key: "workspace.column.archived", fallback: "Archived" },
};

/**
 * Empty state component
 */
function EmptyState({
  icon: Icon,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <div className="bg-muted/30 rounded-full p-3 mb-3">
        <Icon className="h-5 w-5 text-muted-foreground/40" />
      </div>
      <p className="text-sm text-muted-foreground/60">{description}</p>
    </div>
  );
}

/**
 * Task item component
 */
function TaskItem({
  task,
  onClick,
}: {
  task: TaskWithAttemptStatus;
  onClick?: (task: TaskWithAttemptStatus) => void;
}) {
  const StatusIcon = getStatusIcon(task.status);
  const statusColor = getStatusColor(task.status);

  return (
    <button
      type="button"
      onClick={() => onClick?.(task)}
      className={cn(
        "flex w-full items-start gap-2 rounded-md p-2 text-left",
        "hover:bg-muted transition-colors",
        "group"
      )}
    >
      <StatusIcon className={cn("h-4 w-4 shrink-0 mt-0.5", statusColor)} />
      <div className="flex-1 min-w-0">
        <p className="text-sm truncate text-foreground/90 group-hover:text-foreground">
          {task.title}
        </p>
        {task.description && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {task.description}
          </p>
        )}
      </div>
      {/* Status indicators */}
      {task.status === "in_progress" && (
        <Loader2 className="h-3 w-3 shrink-0 text-blue-500 animate-spin" />
      )}
      {task.status === "failed" && (
        <AlertCircle className="h-3 w-3 shrink-0 text-red-500" />
      )}
    </button>
  );
}

/**
 * Task group component - collapsible section for each status
 */
function TaskGroup({
  status,
  tasks,
  onTaskClick,
}: {
  status: TaskStatus;
  tasks: TaskWithAttemptStatus[];
  onTaskClick?: (task: TaskWithAttemptStatus) => void;
}) {
  const { t } = useTranslation();
  const prefersReducedMotion = useReducedMotion();
  const [isExpanded, setIsExpanded] = useState(true);
  const StatusIcon = getStatusIcon(status);
  const statusColor = getStatusColor(status);

  if (tasks.length === 0) {
    return null;
  }

  return (
    <div className="mb-3">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-1.5 w-full text-muted-foreground hover:text-foreground transition-colors mb-1"
      >
        {isExpanded ? (
          <ChevronDown className="h-3.5 w-3.5" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5" />
        )}
        <StatusIcon className={cn("h-3.5 w-3.5", statusColor)} />
        <span className="text-xs font-medium">
          {t(STATUS_LABELS[status].key, STATUS_LABELS[status].fallback)}
        </span>
        <span className="text-xs text-muted-foreground/60 ml-auto">
          {tasks.length}
        </span>
      </button>
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.15 }}
            className="overflow-hidden"
          >
            <div className="space-y-0.5 rounded-md border border-border/30 bg-muted/20 p-1">
              {tasks.map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  onClick={onTaskClick}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Tasks tab content - displays kanban tasks grouped by status
 */
export function TasksTabContent({
  tasks,
  isLoading,
  onTaskClick,
}: TasksTabContentProps) {
  const { t } = useTranslation();

  // Group tasks by status
  const tasksByStatus = useMemo(() => {
    const groups: Record<TaskStatus, TaskWithAttemptStatus[]> = {
      backlog: [],
      queue: [],
      in_progress: [],
      paused: [],
      review: [],
      completed: [],
      failed: [],
      cancelled: [],
      archived: [],
    };

    for (const task of tasks) {
      if (groups[task.status]) {
        groups[task.status].push(task);
      }
    }

    return groups;
  }, [tasks]);

  // Status order for display (failed and archived shown separately)
  const statusOrder: TaskStatus[] = ["in_progress", "paused", "queue", "review", "backlog", "completed", "cancelled"];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">{t("common.loading")}</span>
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <EmptyState
        icon={CheckSquare}
        description={t("chat.sidebar.noTasks", "No tasks in this workspace")}
      />
    );
  }

  return (
    <div className="flex flex-col h-full">
      {statusOrder.map((status) => (
        <TaskGroup
          key={status}
          status={status}
          tasks={tasksByStatus[status]}
          onTaskClick={onTaskClick}
        />
      ))}
      {/* Show failed tasks if any exist */}
      {tasksByStatus.failed.length > 0 && (
        <TaskGroup
          status="failed"
          tasks={tasksByStatus.failed}
          onTaskClick={onTaskClick}
        />
      )}
    </div>
  );
}
