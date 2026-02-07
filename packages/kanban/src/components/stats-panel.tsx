"use client";

import * as React from "react";
import {
  CheckCircle,
  Clock,
  AlertTriangle,
  ListTodo,
  BarChart3,
} from "lucide-react";
import { cn } from "@viben/ui";
import { StatCard } from "./stat-card";
import { PriorityIcon, PRIORITY_CONFIG } from "../primitives";
import type { KanbanStats } from "./stats-types";

export interface StatsPanelProps {
  stats: KanbanStats;
  className?: string;
}

export function StatsPanel({ stats, className }: StatsPanelProps) {
  return (
    <div className={cn("space-y-4", className)}>
      {/* Overview stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="总任务"
          value={stats.totalTasks}
          icon={<ListTodo className="h-4 w-4" />}
        />
        <StatCard
          label="已完成"
          value={stats.completedTasks}
          subValue={`(${stats.completionRate.toFixed(0)}%)`}
          icon={<CheckCircle className="h-4 w-4" />}
        />
        <StatCard
          label="进行中"
          value={stats.inProgressTasks}
          icon={<Clock className="h-4 w-4" />}
        />
        <StatCard
          label="已逾期"
          value={stats.overdueTasks}
          icon={<AlertTriangle className="h-4 w-4" />}
        />
      </div>

      {/* Distribution by priority */}
      <div>
        <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
          <BarChart3 className="h-4 w-4" />
          按优先级分布
        </h4>
        <div className="flex items-center gap-4 flex-wrap">
          {Object.entries(stats.tasksByPriority).map(([priority, count]) => {
            if (count === 0) return null;
            return (
              <div key={priority} className="flex items-center gap-1.5">
                <PriorityIcon
                  priority={priority as keyof typeof PRIORITY_CONFIG}
                  size="sm"
                />
                <span className="text-sm text-muted-foreground">
                  {PRIORITY_CONFIG[priority as keyof typeof PRIORITY_CONFIG]?.label}:
                </span>
                <span className="text-sm font-medium">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Completion progress bar */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm text-muted-foreground">完成进度</span>
          <span className="text-sm font-medium">
            {stats.completedTasks}/{stats.totalTasks}
          </span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-500"
            style={{ width: `${stats.completionRate}%` }}
          />
        </div>
      </div>
    </div>
  );
}
