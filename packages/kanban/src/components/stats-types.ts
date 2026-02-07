import type { IssuePriority } from "../primitives/priority-config";

export interface KanbanStats {
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  todoTasks: number;
  overdueTasks: number;
  completionRate: number; // 0-100
  tasksByPriority: Record<IssuePriority, number>;
  tasksByStatus: Record<string, number>;
}

export interface StatCardProps {
  label: string;
  value: number | string;
  subValue?: string;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  icon?: React.ReactNode;
  className?: string;
}
