"use client";

import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogOverlay,
} from "@/components/ui/dialog";
import { cn } from "@viben/ui";
import {
  TaskDetailPanel,
  type TaskDetailPanelProps,
  type TaskForPanel,
} from "./task-detail-panel";

export interface TaskDetailDialogProps extends Omit<TaskDetailPanelProps, "onClose" | "task"> {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
  /** The task to display - dialog only renders when task is not null */
  task: TaskForPanel | null;
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

  // Only render when both open AND task exists to avoid hooks order issues
  const shouldRender = open && task !== null;

  if (!shouldRender) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Custom overlay without close button */}
      <DialogOverlay />
      {/* Custom content with larger size for task details */}
      <div
        className={cn(
          "fixed inset-4 z-50",
          "bg-card border border-border rounded-2xl shadow-xl",
          "animate-in fade-in-0 zoom-in-95",
          "flex flex-col overflow-hidden",
          className
        )}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={task.title || t("workspace.taskDetails", "Task Details")}
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
