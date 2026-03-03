"use client";

import * as React from "react";
import {
  cn,
  ScrollArea,
  Badge,
  Skeleton,
} from "@viben/ui";
import * as Collapsible from "@radix-ui/react-collapsible";
import {
  CheckCircle2,
  Circle,
  ChevronRight,
  FileText,
  ListChecks,
  Loader2,
  XCircle,
  Clock,
} from "lucide-react";
import { useTranslation } from "react-i18next";

/**
 * Subtask status from implementation plan
 */
export type SubtaskStatus = "pending" | "in_progress" | "completed" | "failed";

/**
 * Subtask with extended information for display in the tab
 */
export interface ExtendedSubtask {
  id: string;
  title: string;
  completed: boolean;
  description?: string;
  files?: string[];
  status?: SubtaskStatus;
}

export interface TaskSubtasksTabProps {
  subtasks: ExtendedSubtask[];
  className?: string;
  isLoading?: boolean;
  onSubtaskClick?: (subtaskId: string) => void;
  onFileClick?: (filePath: string) => void;
}

/**
 * Get status icon component based on subtask status
 */
function getStatusIcon(subtask: ExtendedSubtask) {
  // Use explicit status if available
  if (subtask.status) {
    switch (subtask.status) {
      case "completed":
        return <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />;
      case "in_progress":
        return <Loader2 className="h-5 w-5 text-blue-500 animate-spin shrink-0 mt-0.5" />;
      case "failed":
        return <XCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />;
      case "pending":
      default:
        return <Clock className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />;
    }
  }

  // Fallback to completed boolean
  return subtask.completed ? (
    <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
  ) : (
    <Circle className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
  );
}

/**
 * Get status label for badge
 */
function getStatusLabel(status: SubtaskStatus | undefined): string | null {
  switch (status) {
    case "in_progress":
      return "In Progress";
    case "failed":
      return "Failed";
    default:
      return null;
  }
}

/**
 * Get status color for badge
 */
function getStatusColor(status: SubtaskStatus | undefined): string {
  switch (status) {
    case "in_progress":
      return "bg-blue-500/10 text-blue-600 dark:text-blue-400";
    case "failed":
      return "bg-red-500/10 text-red-600 dark:text-red-400";
    default:
      return "";
  }
}

/**
 * TaskSubtasksTab - Displays subtasks in a dedicated tab with enhanced UI
 *
 * Features:
 * - Progress summary showing completion ratio
 * - Status icons with color coding
 * - Expandable descriptions
 * - File tags for associated files
 */
export function TaskSubtasksTab({
  subtasks,
  className,
  isLoading = false,
  onSubtaskClick,
  onFileClick,
}: TaskSubtasksTabProps) {
  const { t } = useTranslation();
  const [expandedIds, setExpandedIds] = React.useState<Set<string>>(new Set());

  const completedCount = subtasks.filter((s) => s.completed).length;
  const totalCount = subtasks.length;
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Loading state
  if (isLoading) {
    return (
      <div className={cn("p-4 space-y-4", className)}>
        <Skeleton className="h-16 w-full rounded-lg" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (totalCount === 0) {
    return (
      <div className={cn("flex flex-col items-center justify-center h-full py-12", className)}>
        <ListChecks className="h-12 w-12 text-muted-foreground/30 mb-4" />
        <h3 className="text-lg font-medium text-muted-foreground mb-2">
          {t("workspace.subtasksTab.noSubtasks", "No subtasks defined")}
        </h3>
        <p className="text-sm text-muted-foreground/60 text-center max-w-xs">
          {t(
            "workspace.subtasksTab.subtasksWillAppear",
            "Implementation subtasks will appear here after planning"
          )}
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className={cn("h-full", className)}>
      <div className="p-4 space-y-4">
        {/* Progress Summary */}
        <div className="bg-muted/30 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">
              {t("workspace.subtasksTab.completed", "{{completed}} of {{total}} completed", {
                completed: completedCount,
                total: totalCount,
              })}
            </span>
            <span className="text-sm text-muted-foreground">
              {Math.round(progressPercent)}%
            </span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Subtask List */}
        <div className="space-y-2">
          {subtasks.map((subtask) => {
            const isExpanded = expandedIds.has(subtask.id);
            const hasDescription = !!subtask.description;
            const hasFiles = subtask.files && subtask.files.length > 0;
            const isExpandable = hasDescription || hasFiles;

            const isCompleted = subtask.status === "completed" || subtask.completed;
            const isFailed = subtask.status === "failed";
            const isInProgress = subtask.status === "in_progress";
            const statusLabel = getStatusLabel(subtask.status);
            const statusColor = getStatusColor(subtask.status);

            return (
              <Collapsible.Root
                key={subtask.id}
                open={isExpanded}
                onOpenChange={() => isExpandable && toggleExpanded(subtask.id)}
              >
                <div
                  className={cn(
                    "rounded-lg border transition-colors",
                    isCompleted && "bg-green-500/5 border-green-500/20",
                    isFailed && "bg-red-500/5 border-red-500/20",
                    isInProgress && "bg-blue-500/5 border-blue-500/20",
                    !isCompleted && !isFailed && !isInProgress && "bg-background border-border hover:border-primary/30"
                  )}
                >
                  <Collapsible.Trigger asChild disabled={!isExpandable}>
                    <div
                      className={cn(
                        "flex items-start gap-3 p-3",
                        isExpandable && "cursor-pointer",
                        onSubtaskClick && "hover:bg-muted/50"
                      )}
                      onClick={() => onSubtaskClick?.(subtask.id)}
                    >
                      {/* Status Icon */}
                      {getStatusIcon(subtask)}

                      {/* Title and Meta */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "text-sm font-medium",
                              isCompleted && "text-muted-foreground line-through"
                            )}
                          >
                            {subtask.title}
                          </span>
                          {/* Status badge for in_progress and failed */}
                          {statusLabel && (
                            <Badge
                              variant="secondary"
                              className={cn("text-xs py-0", statusColor)}
                            >
                              {statusLabel}
                            </Badge>
                          )}
                        </div>

                        {/* File Tags (collapsed preview) */}
                        {hasFiles && !isExpanded && (
                          <div className="flex items-center gap-1 mt-1.5">
                            <FileText className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">
                              {subtask.files!.length}{" "}
                              {t("workspace.subtasksTab.files", "file(s)")}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Expand Indicator */}
                      {isExpandable && (
                        <ChevronRight
                          className={cn(
                            "h-4 w-4 text-muted-foreground shrink-0 transition-transform",
                            isExpanded && "rotate-90"
                          )}
                        />
                      )}
                    </div>
                  </Collapsible.Trigger>

                  <Collapsible.Content>
                    <div className="px-3 pb-3 pt-0 pl-11 space-y-2">
                      {/* Description */}
                      {hasDescription && (
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                          {subtask.description}
                        </p>
                      )}

                      {/* File Tags (expanded) */}
                      {hasFiles && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {subtask.files!.map((file) => (
                            <Badge
                              key={file}
                              variant="secondary"
                              className={cn(
                                "text-xs font-mono cursor-pointer",
                                "hover:bg-primary/10"
                              )}
                              onClick={(e) => {
                                e.stopPropagation();
                                onFileClick?.(file);
                              }}
                            >
                              {file.split("/").pop()}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </Collapsible.Content>
                </div>
              </Collapsible.Root>
            );
          })}
        </div>
      </div>
    </ScrollArea>
  );
}
