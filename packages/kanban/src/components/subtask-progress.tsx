"use client";

import * as React from "react";
import { cn } from "@viben/ui";

export interface SubtaskProgressProps {
  completed: number;
  total: number;
  className?: string;
}

export const SubtaskProgress = React.forwardRef<
  HTMLDivElement,
  SubtaskProgressProps
>(({ completed, total, className }, ref) => {
  const percentage = total > 0 ? (completed / total) * 100 : 0;

  return (
    <div
      ref={ref}
      className={cn("flex items-center gap-2", className)}
    >
      <span className="text-xs text-muted-foreground font-medium whitespace-nowrap">
        {completed}/{total}
      </span>
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full bg-primary",
            "transition-all duration-200"
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
});

SubtaskProgress.displayName = "SubtaskProgress";
