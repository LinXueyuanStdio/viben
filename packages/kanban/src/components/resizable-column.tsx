"use client";

import * as React from "react";
import { useCallback } from "react";
import { ChevronsLeft, ChevronsRight, Lock, GripVertical } from "lucide-react";
import { Button, Badge, cn, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@viben/ui";

export interface ResizableColumnProps {
  id: string;
  title: string;
  /** CSS color variable like "--primary" */
  color: string;
  count: number;
  /** WIP limit for this column */
  wipLimit?: number;
  /** Whether the column is collapsed */
  collapsed?: boolean;
  /** Callback when collapse state changes */
  onToggleCollapse?: (collapsed: boolean) => void;
  /** Current width in pixels */
  width?: number;
  /** Whether the column is locked (cannot be resized) */
  isLocked?: boolean;
  /** Callback to toggle lock state */
  onToggleLock?: () => void;
  /** Whether the column is currently being resized */
  isResizing?: boolean;
  /** Callback when resize starts */
  onResizeStart?: (startX: number) => void;
  /** Callback when add task is clicked */
  onAddTask?: () => void;
  /** Label for add task button */
  addTaskLabel?: string;
  children: React.ReactNode;
  className?: string;
}

export function ResizableColumn({
  id,
  title,
  color,
  count,
  wipLimit,
  collapsed = false,
  onToggleCollapse,
  width = 280,
  isLocked = false,
  onToggleLock,
  isResizing = false,
  onResizeStart,
  onAddTask,
  addTaskLabel = "Add task",
  children,
  className,
}: ResizableColumnProps) {
  const isOverWip = wipLimit !== undefined && count > wipLimit;

  // Handle resize drag start
  const handleResizeMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (isLocked) return;
      e.preventDefault();
      e.stopPropagation();
      onResizeStart?.(e.clientX);
    },
    [isLocked, onResizeStart]
  );

  // Collapsed state - narrow strip
  if (collapsed) {
    return (
      <div
        className={cn(
          "w-12 flex flex-col items-center py-3 cursor-pointer",
          "bg-muted/30 hover:bg-muted/50 border-r",
          "transition-all duration-200",
          className
        )}
        onClick={() => onToggleCollapse?.(false)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            onToggleCollapse?.(false);
          }
        }}
        aria-label={`Expand ${title} column`}
      >
        <div
          className="w-2.5 h-2.5 rounded-full mb-3 shrink-0"
          style={{ backgroundColor: `hsl(var(${color}))` }}
        />
        <span
          className="text-xs font-medium text-muted-foreground"
          style={{
            writingMode: "vertical-rl",
            textOrientation: "mixed",
          }}
        >
          {title}
        </span>
        <Badge
          variant={isOverWip ? "destructive" : "secondary"}
          className="mt-3 text-xs px-1.5 py-0.5"
        >
          {count}
          {wipLimit !== undefined && `/${wipLimit}`}
        </Badge>
        <ChevronsRight className="h-4 w-4 mt-3 text-muted-foreground" />
      </div>
    );
  }

  // Expanded state with resize handle
  return (
    <div
      className={cn(
        "relative flex flex-col min-h-0 border-r",
        isResizing && "select-none",
        className
      )}
      style={{ width: `${width}px`, minWidth: `${width}px` }}
    >
      {/* Header */}
      <div
        className={cn(
          "sticky top-0 z-20 flex shrink-0 items-center gap-2 px-3 py-2.5",
          "backdrop-blur-sm border-b"
        )}
        style={{
          backgroundColor: `hsl(var(${color}) / 0.08)`,
          borderColor: `hsl(var(${color}) / 0.15)`,
        }}
      >
        <span className="flex-1 flex items-center gap-2 min-w-0">
          <div
            className="h-2.5 w-2.5 rounded-full shrink-0"
            style={{
              backgroundColor: `hsl(var(${color}))`,
              boxShadow: `0 0 0 3px hsl(var(${color}) / 0.25)`,
            }}
          />
          <p
            className="m-0 text-sm font-semibold truncate"
            style={{ color: `hsl(var(${color}))` }}
          >
            {title}
          </p>
          <Badge
            variant={isOverWip ? "destructive" : "secondary"}
            className="text-xs"
          >
            {count}
            {wipLimit !== undefined && `/${wipLimit}`}
          </Badge>
        </span>

        {/* Lock toggle */}
        {onToggleLock && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "h-6 w-6 rounded-md transition-colors",
                    isLocked && "text-amber-500"
                  )}
                  onClick={onToggleLock}
                  aria-label={isLocked ? "Unlock column width" : "Lock column width"}
                >
                  <Lock className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                {isLocked ? "Unlock column width" : "Lock column width"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {/* Collapse button */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 rounded-md transition-colors"
                style={{ color: `hsl(var(${color}) / 0.7)` }}
                onClick={() => onToggleCollapse?.(true)}
                aria-label="Collapse column"
              >
                <ChevronsLeft className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              Collapse column
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Add task button */}
        {onAddTask && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 rounded-md transition-colors"
                  style={{ color: `hsl(var(${color}) / 0.7)` }}
                  onClick={onAddTask}
                  aria-label={addTaskLabel}
                >
                  <span className="sr-only">{addTaskLabel}</span>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                {addTaskLabel}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">{children}</div>

      {/* Resize handle - right edge */}
      <div
        className={cn(
          "absolute top-0 right-0 w-1 h-full z-30",
          "group cursor-col-resize",
          isLocked && "cursor-not-allowed",
          isResizing && "bg-primary/50"
        )}
        onMouseDown={handleResizeMouseDown}
        role="separator"
        aria-orientation="vertical"
        aria-label={`Resize ${title} column`}
      >
        {/* Visual indicator on hover */}
        <div
          className={cn(
            "absolute top-0 right-0 w-1 h-full",
            "bg-transparent group-hover:bg-primary/30 transition-colors",
            isLocked && "group-hover:bg-transparent",
            isResizing && "bg-primary/50"
          )}
        />
        {/* Grip indicator */}
        <div
          className={cn(
            "absolute top-1/2 -translate-y-1/2 right-0 w-4 h-8 -mr-1.5",
            "flex items-center justify-center",
            "opacity-0 group-hover:opacity-100 transition-opacity",
            isLocked && "hidden"
          )}
        >
          <GripVertical className="h-4 w-4 text-muted-foreground/60" />
        </div>
      </div>
    </div>
  );
}

ResizableColumn.displayName = "ResizableColumn";
