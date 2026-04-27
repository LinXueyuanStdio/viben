"use client";

import * as React from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@viben/ui";
import { Calendar } from "lucide-react";
import { getDueDateStatus } from "./due-date-utils";

export interface DueDateBadgeProps {
  dueDate: string | Date;
  className?: string;
}

export const DueDateBadge = React.forwardRef<HTMLDivElement, DueDateBadgeProps>(
  ({ dueDate, className }, ref) => {
    const { t } = useTranslation();
    const status = getDueDateStatus(dueDate, t);

    return (
      <div
        ref={ref}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium",
          "transition-all duration-200",
          status.isOverdue && "bg-destructive/10 text-destructive",
          status.isDueSoon &&
            !status.isOverdue &&
            "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
          !status.isOverdue &&
            !status.isDueSoon &&
            "bg-muted text-muted-foreground",
          className
        )}
      >
        <Calendar className="h-3 w-3" />
        <span>{status.displayText}</span>
      </div>
    );
  }
);
DueDateBadge.displayName = "DueDateBadge";
