"use client";

import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogOverlay,
} from "@/components/ui/dialog";
import { cn } from "@viben/ui";
import {
  TaskDetailPanel,
  type TaskDetailPanelProps,
  type TaskForPanel,
} from "./task-detail-panel";

export interface TaskDetailDialogProps extends Omit<TaskDetailPanelProps, "onClose"> {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
  /** Optional className for the dialog content */
  className?: string;
}

/**
 * TaskDetailDialog - A reusable dialog wrapper for TaskDetailPanel.
 *
 * This component can be used anywhere a task card appears to show task details
 * in a modal dialog instead of a side panel layout.
 *
 * Usage:
 * ```tsx
 * <TaskDetailDialog
 *   open={isOpen}
 *   onOpenChange={setIsOpen}
 *   task={selectedTask}
 *   onUpdate={handleUpdate}
 *   workspacePath={workspace.path}
 * />
 * ```
 */
export function TaskDetailDialog({
  open,
  onOpenChange,
  task,
  className,
  ...panelProps
}: TaskDetailDialogProps) {
  const { t } = useTranslation();

  const handleClose = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Custom overlay without close button */}
      <DialogOverlay />
      {/* Custom content with larger size for task details */}
      <div
        className={cn(
          "fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2",
          "w-[90vw] max-w-3xl h-[85vh] max-h-[900px]",
          "bg-card border border-border rounded-2xl shadow-xl",
          "animate-in fade-in-0 zoom-in-95",
          "flex flex-col overflow-hidden",
          !open && "hidden",
          className
        )}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={task?.title || t("workspace.taskDetails", "Task Details")}
      >
        <TaskDetailPanel
          task={task}
          onClose={handleClose}
          {...panelProps}
        />
      </div>
    </Dialog>
  );
}

// Re-export types for convenience
export type { TaskForPanel, TaskDetailPanelProps };
