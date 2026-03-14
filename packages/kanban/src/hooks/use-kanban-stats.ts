import { useMemo } from "react";
import type { IssuePriority } from "../primitives/priority-config";
import type { KanbanStats } from "../components/stats-types";

interface StatsItem {
  id: string;
  status?: string;
  priority?: IssuePriority;
  dueDate?: string;
}

export function useKanbanStats<T extends StatsItem>(
  items: T[],
  completedStatuses: string[] = ["completed"]
): KanbanStats {
  return useMemo(() => {
    const totalTasks = items.length;
    const completedTasks = items.filter((t) =>
      completedStatuses.includes(t.status || "")
    ).length;
    const inProgressTasks = items.filter(
      (t) => t.status === "in_progress" || t.status === "inprogress"
    ).length;
    const todoTasks = items.filter(
      (t) => t.status === "todo" || t.status === "backlog"
    ).length;

    const now = new Date();
    const overdueTasks = items.filter((t) => {
      if (!t.dueDate) return false;
      if (completedStatuses.includes(t.status || "")) return false;
      return new Date(t.dueDate) < now;
    }).length;

    const completionRate =
      totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

    const tasksByPriority: Record<IssuePriority, number> = {
      urgent: 0,
      high: 0,
      medium: 0,
      low: 0,
      none: 0,
    };

    const tasksByStatus: Record<string, number> = {};

    items.forEach((item) => {
      const priority = item.priority || "none";
      tasksByPriority[priority] = (tasksByPriority[priority] || 0) + 1;

      const status = item.status || "unknown";
      tasksByStatus[status] = (tasksByStatus[status] || 0) + 1;
    });

    return {
      totalTasks,
      completedTasks,
      inProgressTasks,
      todoTasks,
      overdueTasks,
      completionRate,
      tasksByPriority,
      tasksByStatus,
    };
  }, [items, completedStatuses]);
}
