"use client";

import * as React from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@viben/ui";
import { PriorityIcon, PRIORITY_CONFIG } from "../primitives";
import type { KanbanStats } from "./stats-types";

export interface StatsPanelProps {
  stats: KanbanStats;
  className?: string;
  /** Compact mode shows minimal stats */
  compact?: boolean;
}

/**
 * Minimal stat display
 */
function StatBadge({
  value,
  label,
  variant = "default",
}: {
  value: number;
  label: string;
  variant?: "default" | "success" | "warning" | "destructive";
}) {
  const variantStyles = {
    default: "bg-muted/60 text-muted-foreground",
    success: "bg-green-500/10 text-green-600 dark:text-green-400",
    warning: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    destructive: "bg-destructive/10 text-destructive",
  };

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium",
        variantStyles[variant]
      )}
      title={label}
    >
      <span className="tabular-nums">{value}</span>
      <span className="text-[10px] opacity-70">{label}</span>
    </div>
  );
}

export function StatsPanel({ stats, className, compact = false }: StatsPanelProps) {
  const { t } = useTranslation();
  const hasPriorityTasks = Object.values(stats.tasksByPriority).some(count => count > 0);

  if (compact) {
    // Ultra-compact: just progress and count
    return (
      <div className={cn("flex items-center gap-3", className)}>
        <div className="flex items-center gap-2 min-w-[100px]">
          <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary/80 transition-all duration-300"
              style={{ width: `${stats.completionRate}%` }}
            />
          </div>
          <span className="text-[10px] text-muted-foreground tabular-nums">
            {stats.completedTasks}/{stats.totalTasks}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-2 flex-wrap", className)}>
      {/* Progress indicator */}
      <div className="flex items-center gap-2 min-w-[120px] max-w-[160px]">
        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-primary/80 transition-all duration-500 ease-out"
            style={{ width: `${stats.completionRate}%` }}
          />
        </div>
        <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
          {stats.completionRate.toFixed(0)}%
        </span>
      </div>

      {/* Divider */}
      <div className="h-4 w-px bg-border/50" />

      {/* Core stats */}
      <div className="flex items-center gap-1.5">
        <StatBadge value={stats.completedTasks} label={t("kanban.stats.completed")} variant="success" />
        <StatBadge value={stats.inProgressTasks} label={t("kanban.stats.inProgress")} variant="warning" />
        {stats.overdueTasks > 0 && (
          <StatBadge value={stats.overdueTasks} label={t("kanban.stats.overdue")} variant="destructive" />
        )}
      </div>

      {/* Priority distribution */}
      {hasPriorityTasks && (
        <>
          <div className="h-4 w-px bg-border/50" />
          <div className="flex items-center gap-1">
            {Object.entries(stats.tasksByPriority).map(([priority, count]) => {
              if (count === 0) return null;
              return (
                <div
                  key={priority}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs"
                  title={priority}
                >
                  <PriorityIcon
                    priority={priority as keyof typeof PRIORITY_CONFIG}
                    size="sm"
                  />
                  <span className="tabular-nums text-muted-foreground">{count}</span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
