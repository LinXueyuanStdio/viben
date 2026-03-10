"use client";

import * as React from "react";
import {
  cn,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  Button,
} from "@viben/ui";
import { Check, ChevronDown, Circle } from "lucide-react";
import {
  KANBAN_COLUMNS,
  COLUMN_COLORS,
  VALID_STATUS_TRANSITIONS,
  STATUS_TO_COLUMN,
  type TaskStatus,
  type KanbanColumnId,
} from "@/lib/vibe-kanban/types";

export interface StatusSelectProps {
  value: TaskStatus;
  onValueChange?: (value: TaskStatus) => void;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  size?: "sm" | "md" | "lg";
  /** Show only valid transitions based on current status */
  restrictTransitions?: boolean;
  /** Custom labels for statuses (for i18n) */
  labels?: {
    setStatus?: string;
    backlog?: string;
    queue?: string;
    in_progress?: string;
    paused?: string;
    ai_review?: string;
    human_review?: string;
    completed?: string;
    failed?: string;
    cancelled?: string;
  };
}

const triggerSizeConfig = {
  sm: "h-7 px-2 text-xs",
  md: "h-8 px-3 text-sm",
  lg: "h-9 px-4 text-base",
};

// Default labels for statuses
const DEFAULT_LABELS: Required<StatusSelectProps["labels"]> = {
  setStatus: "Set status",
  backlog: "Backlog",
  queue: "Queue",
  in_progress: "In Progress",
  paused: "Paused",
  ai_review: "AI Review",
  human_review: "Human Review",
  completed: "Completed",
  failed: "Failed",
  cancelled: "Cancelled",
};

// Get status label with i18n support
const getStatusLabel = (
  status: TaskStatus,
  labels?: StatusSelectProps["labels"]
): string => {
  const mergedLabels = { ...DEFAULT_LABELS, ...labels } as Record<string, string>;
  return mergedLabels[status] ?? status;
};

// Get column color for status
const getStatusColor = (status: TaskStatus): string => {
  const column = STATUS_TO_COLUMN[status];
  return COLUMN_COLORS[column] || COLUMN_COLORS.backlog;
};

export function StatusSelect({
  value,
  onValueChange,
  disabled = false,
  className,
  triggerClassName,
  size = "md",
  restrictTransitions = true,
  labels,
}: StatusSelectProps) {
  const [open, setOpen] = React.useState(false);

  const handleSelect = React.useCallback(
    (status: TaskStatus) => {
      onValueChange?.(status);
      setOpen(false);
    },
    [onValueChange]
  );

  // Get available statuses based on current status
  const availableStatuses = React.useMemo(() => {
    if (!restrictTransitions) {
      // Show all columns when not restricting
      return KANBAN_COLUMNS as unknown as KanbanColumnId[];
    }

    // Get valid transitions for current status
    const validTransitions = VALID_STATUS_TRANSITIONS[value] || [];
    const currentColumn = STATUS_TO_COLUMN[value];

    // Include current column + valid transitions
    return [currentColumn, ...validTransitions.filter(col => col !== currentColumn)];
  }, [value, restrictTransitions]);

  const color = getStatusColor(value);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          disabled={disabled}
          className={cn(
            "inline-flex items-center justify-between gap-2",
            "border border-transparent rounded-md",
            "transition-all duration-200 ease-out",
            "hover:border-border hover:bg-accent/50",
            "focus-visible:ring-1 focus-visible:ring-ring",
            triggerSizeConfig[size],
            triggerClassName
          )}
        >
          <div className="flex items-center gap-2">
            <Circle
              className={cn(
                "shrink-0",
                size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3"
              )}
              style={{ color, fill: color }}
            />
            <span className="text-sm">
              {getStatusLabel(value, labels)}
            </span>
          </div>
          <ChevronDown
            className={cn(
              "h-3 w-3 shrink-0 text-muted-foreground",
              "transition-transform duration-200",
              open && "rotate-180"
            )}
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className={cn("min-w-[180px]", className)}
        sideOffset={4}
      >
        <DropdownMenuLabel className="text-xs text-muted-foreground font-normal px-2">
          {labels?.setStatus ?? "Set status"}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {availableStatuses.map((column) => {
          // Map column to status (for display)
          const status = column as TaskStatus;
          const isSelected = STATUS_TO_COLUMN[value] === column;
          const label = getStatusLabel(status, labels);
          const statusColor = COLUMN_COLORS[column];

          return (
            <DropdownMenuItem
              key={column}
              onClick={() => handleSelect(status)}
              className={cn(
                "flex items-center gap-2.5 cursor-pointer py-2 px-2",
                "transition-colors duration-150",
                isSelected && "bg-accent"
              )}
            >
              {/* Status indicator dot */}
              <Circle
                className="h-3 w-3 shrink-0"
                style={{ color: statusColor, fill: statusColor }}
              />
              <span className="flex-1 text-sm">{label}</span>
              {isSelected && (
                <Check className="h-4 w-4 text-primary shrink-0" />
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

StatusSelect.displayName = "StatusSelect";
