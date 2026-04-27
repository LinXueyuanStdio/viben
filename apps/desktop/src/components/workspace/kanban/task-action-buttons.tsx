/**
 * TaskActionButtons - Action buttons based on task state machine state
 *
 * Renders appropriate action buttons based on the current task status
 * and state machine state. Triggers state transitions via events.
 *
 * After START/RETRY events, the task is enqueued for background execution
 * via /api/queue/enqueue. The agent runs in the background without opening UI.
 *
 * Based on Auto-Claude TaskDetailModal.tsx renderPrimaryAction() logic.
 */

import { useState, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Play,
  Square,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertCircle,
  Clock,
  FileText,
  Archive,
} from "lucide-react";
import { Button, cn } from "@viben/ui";
import { getGatewayUrl } from "@/lib/gateway";
import {
  submitTaskEvent,
  enqueueTask,
  type TaskEvent,
} from "@/lib/gateway/modules/tasks";
import { toast } from "@/hooks/use-toast";
import type {
  TaskStatus,
  TaskEventType,
  XStateValue,
  ReviewReason,
  ExecutionPhase,
} from "@/lib/kanban/types";

export interface TaskActionButtonsProps {
  /** Task ID */
  taskId: string;
  /** Workspace path */
  workspacePath: string;
  /** Current task status */
  status: TaskStatus;
  /** XState state value */
  xstateState?: XStateValue;
  /** Review reason (for review status) */
  reviewReason?: ReviewReason;
  /** Whether the task is stuck */
  isStuck?: boolean;
  /** Whether the task has an in-progress attempt */
  isRunning?: boolean;
  /** Current execution phase */
  executionPhase?: ExecutionPhase;
  /** Last event sequence number */
  lastEventSequence?: number;
  /** Callback after successful event submission */
  onEventSubmitted?: (eventType: TaskEventType, newState?: string) => void;
  /** Callback on event submission error */
  onEventError?: (error: string) => void;
  /** Task title - used to build the prompt for background execution */
  taskTitle?: string;
  /** Task description - used to build the prompt for background execution */
  taskDescription?: string;
  /** Agent ID - used for background execution (defaults to "default") */
  agentId?: string;
  /** Additional CSS classes */
  className?: string;
  /** Button size variant */
  size?: "sm" | "default" | "lg";
  /** Whether to show all buttons or just primary */
  showAllActions?: boolean;
  /** Whether to show status context with description (for detail panel) */
  showStatusContext?: boolean;
  /** Callback for archive action */
  onArchive?: () => void;
  /** Content to render between status context and action buttons */
  renderBetween?: React.ReactNode;
}

/**
 * TaskActionButtons component
 *
 * Renders action buttons based on task state:
 * - backlog: Queue button (move to queue)
 * - queue: Start button (begin execution)
 * - in_progress (running): Stop button
 * - in_progress (stuck): Recover button
 * - review: Approve, Reject, Create PR buttons
 * - error: Retry, Abandon buttons
 * - done: View PR button (if PR exists)
 */
export function TaskActionButtons({
  taskId,
  workspacePath,
  status,
  // xstateState is available for future use when we need to check nested states
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  xstateState: _xstateState,
  reviewReason,
  isStuck = false,
  isRunning = false,
  // executionPhase is available for future use when we need phase-specific actions
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  executionPhase: _executionPhase,
  lastEventSequence = 0,
  onEventSubmitted,
  onEventError,
  taskTitle,
  taskDescription,
  agentId = "default",
  className,
  size = "default",
  showAllActions = false,
  showStatusContext = false,
  onArchive,
  renderBetween,
}: TaskActionButtonsProps) {
  const { t } = useTranslation();
  const gatewayUrl = getGatewayUrl();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittingEvent, setSubmittingEvent] = useState<TaskEventType | null>(null);

  // Create and submit an event
  const submitEvent = useCallback(
    async (eventType: TaskEventType, payload?: Record<string, unknown>) => {
      if (!gatewayUrl || isSubmitting) return;

      setIsSubmitting(true);
      setSubmittingEvent(eventType);

      try {
        const event: TaskEvent = {
          eventId: crypto.randomUUID(),
          sequence: lastEventSequence + 1,
          type: eventType,
          timestamp: new Date().toISOString(),
          payload,
        };

        const result = await submitTaskEvent(
          gatewayUrl,
          taskId,
          workspacePath,
          event
        );

        if (result.success) {
          onEventSubmitted?.(eventType, result.newState);

          // Trigger background execution for events that start/resume task execution
          // START: Initial task start from backlog/queue
          // RETRY: Retry after error state
          // REJECTED: Resume execution (used for non-plan-review rejections)
          const executionTriggeringEvents: TaskEventType[] = ["START", "RETRY", "REJECTED"];
          if (executionTriggeringEvents.includes(eventType)) {
            // Build prompt from task title and description
            const taskLabel = t("workspace.taskActions.taskLabel", "Task:");
            const descriptionLabel = t("workspace.taskActions.descriptionLabel", "Description:");
            const prompt = taskDescription
              ? `${taskLabel} ${taskTitle || t("workspace.taskActions.unnamedTask", "Unnamed task")}\n\n${descriptionLabel} ${taskDescription}`
              : `${taskLabel} ${taskTitle || t("workspace.taskActions.unnamedTask", "Unnamed task")}`;

            try {
              // Enqueue task for background execution
              await enqueueTask(gatewayUrl, {
                agent_id: agentId,
                input: prompt,
                cwd: workspacePath,
              });

              toast.success(
                t("workspace.taskActions.taskStarted", "Task started"),
                {
                  description: t(
                    "workspace.taskActions.taskStartedDesc",
                    "Task is running in the background"
                  ),
                }
              );
            } catch (enqueueError) {
              // Log but don't fail - the state transition already succeeded
              console.error("[TaskActionButtons] Failed to enqueue task:", enqueueError);
              toast.warning(
                t("workspace.taskActions.enqueueWarning", "Warning"),
                {
                  description: t(
                    "workspace.taskActions.enqueueWarningDesc",
                    "Task state updated but background execution may have failed"
                  ),
                }
              );
            }
          }
        } else {
          const errorMessage =
            result.error === "SEQUENCE_MISMATCH"
              ? t("workspace.taskActions.sequenceMismatch", "Sequence mismatch - please refresh")
              : result.error === "INVALID_TRANSITION"
                ? t("workspace.taskActions.invalidTransition", "Invalid state transition")
                : t("workspace.taskActions.submitFailed", "Failed to submit event");
          onEventError?.(errorMessage);
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : t("common.unknownError");
        onEventError?.(errorMessage);
      } finally {
        setIsSubmitting(false);
        setSubmittingEvent(null);
      }
    },
    [
      gatewayUrl,
      taskId,
      workspacePath,
      lastEventSequence,
      isSubmitting,
      onEventSubmitted,
      onEventError,
      taskTitle,
      taskDescription,
      agentId,
      t,
    ]
  );

  // Event handlers
  const handleQueue = useCallback(() => submitEvent("QUEUE"), [submitEvent]);
  const handleStart = useCallback(() => submitEvent("START"), [submitEvent]);
  const handleStop = useCallback(() => submitEvent("USER_STOPPED"), [submitEvent]);
  const handleApprove = useCallback(() => submitEvent("APPROVED"), [submitEvent]);
  const handleReject = useCallback(() => submitEvent("REJECTED"), [submitEvent]);
  // Note: CREATE_PR is not a state machine event, handle separately if needed
  const handleRetry = useCallback(() => submitEvent("RETRY"), [submitEvent]);
  const handleAbandon = useCallback(() => submitEvent("ABANDON"), [submitEvent]);

  // Button size classes
  const sizeClasses = {
    sm: "h-7 px-2.5 text-xs",
    default: "h-9 px-4",
    lg: "h-11 px-6",
  };

  // Loading indicator
  const LoadingIcon = useCallback(
    () => <Loader2 className={cn("animate-spin", size === "sm" ? "h-3 w-3" : "h-4 w-4")} />,
    [size]
  );

  // Determine which buttons to show based on state
  const buttons = useMemo(() => {
    const buttonList: React.ReactNode[] = [];
    const iconClass = size === "sm" ? "h-3 w-3" : "h-4 w-4";
    const iconWithMargin = cn(iconClass, "mr-1.5");

    // Priority 1: Stuck state - Show Recover button
    if (isStuck) {
      buttonList.push(
        <Button
          key="recover"
          variant="outline"
          size={size}
          className={cn(
            sizeClasses[size],
            "text-warning border-warning/30 hover:bg-warning/10"
          )}
          onClick={handleRetry}
          disabled={isSubmitting}
        >
          {submittingEvent === "RETRY" ? (
            <LoadingIcon />
          ) : (
            <RotateCcw className={iconWithMargin} />
          )}
          {t("workspace.taskActions.recover", "Recover")}
        </Button>
      );
      return buttonList;
    }

    // Priority 2: Failed state - Show Retry and Abandon buttons
    if (status === "failed") {
      buttonList.push(
        <Button
          key="retry"
          variant="default"
          size={size}
          className={sizeClasses[size]}
          onClick={handleRetry}
          disabled={isSubmitting}
        >
          {submittingEvent === "RETRY" ? (
            <LoadingIcon />
          ) : (
            <RotateCcw className={iconWithMargin} />
          )}
          {t("workspace.taskActions.retry", "Retry")}
        </Button>
      );
      if (showAllActions) {
        buttonList.push(
          <Button
            key="abandon"
            variant="outline"
            size={size}
            className={cn(sizeClasses[size], "text-muted-foreground")}
            onClick={handleAbandon}
            disabled={isSubmitting}
          >
            {submittingEvent === "ABANDON" ? (
              <LoadingIcon />
            ) : (
              <XCircle className={iconWithMargin} />
            )}
            {t("workspace.taskActions.abandon", "Abandon")}
          </Button>
        );
      }
      return buttonList;
    }

    // Priority 3: review state - Show Approve and Reject buttons
    if (status === "review") {
      buttonList.push(
        <Button
          key="approve"
          variant="default"
          size={size}
          className={cn(sizeClasses[size], "bg-success hover:bg-success/90")}
          onClick={handleApprove}
          disabled={isSubmitting}
        >
          {submittingEvent === "APPROVED" ? (
            <LoadingIcon />
          ) : (
            <CheckCircle2 className={iconWithMargin} />
          )}
          {t("workspace.taskActions.approve", "Approve")}
        </Button>
      );
      buttonList.push(
        <Button
          key="reject"
          variant="outline"
          size={size}
          className={sizeClasses[size]}
          onClick={handleReject}
          disabled={isSubmitting}
        >
          {submittingEvent === "REJECTED" ? (
            <LoadingIcon />
          ) : (
            <XCircle className={iconWithMargin} />
          )}
          {t("workspace.taskActions.reject", "Reject")}
        </Button>
      );
      return buttonList;
    }

    // Priority 4: In progress state - Show Stop button
    if (status === "in_progress" && isRunning) {
      buttonList.push(
        <Button
          key="stop"
          variant="destructive"
          size={size}
          className={sizeClasses[size]}
          onClick={handleStop}
          disabled={isSubmitting}
        >
          {submittingEvent === "USER_STOPPED" ? (
            <LoadingIcon />
          ) : (
            <Square className={iconWithMargin} />
          )}
          {t("workspace.taskActions.stop", "Stop")}
        </Button>
      );
      return buttonList;
    }

    // Priority 5: Backlog state - Show Queue button (move to queue)
    if (status === "backlog") {
      buttonList.push(
        <Button
          key="queue"
          variant="default"
          size={size}
          className={sizeClasses[size]}
          onClick={handleQueue}
          disabled={isSubmitting}
        >
          {submittingEvent === "QUEUE" ? (
            <LoadingIcon />
          ) : (
            <Play className={iconWithMargin} />
          )}
          {t("workspace.taskActions.queue", "Queue")}
        </Button>
      );
      return buttonList;
    }

    // Priority 6: Queue state - Show Start button (begin execution)
    if (status === "queue") {
      buttonList.push(
        <Button
          key="start"
          variant="default"
          size={size}
          className={sizeClasses[size]}
          onClick={handleStart}
          disabled={isSubmitting}
        >
          {submittingEvent === "START" ? (
            <LoadingIcon />
          ) : (
            <Play className={iconWithMargin} />
          )}
          {t("workspace.taskActions.start", "Start")}
        </Button>
      );
      return buttonList;
    }

    // Priority 7: Completed state - Show completion indicator
    if (status === "completed") {
      buttonList.push(
        <div
          key="complete"
          className="flex items-center gap-2 text-success text-sm"
        >
          <CheckCircle2 className={iconClass} />
          <span className="font-medium">
            {t("workspace.taskActions.completed", "Completed")}
          </span>
        </div>
      );
      return buttonList;
    }

    return buttonList;
  }, [
    status,
    isStuck,
    isRunning,
    reviewReason,
    showAllActions,
    size,
    isSubmitting,
    submittingEvent,
    handleQueue,
    handleStart,
    handleStop,
    handleApprove,
    handleReject,
    handleRetry,
    handleAbandon,
    LoadingIcon,
    t,
    sizeClasses,
  ]);

  // Get status context info for detailed view
  const statusContext = useMemo(() => {
    if (!showStatusContext) return null;

    // Priority 1: Stuck
    if (isStuck) {
      return {
        icon: AlertCircle,
        title: t("workspace.statusContext.stuck.title", "Task is stuck"),
        description: t("workspace.statusContext.stuck.description", "The task execution has stalled. Click Recover to restart the task."),
        variant: "warning" as const,
      };
    }

    // Priority 2: Failed
    if (status === "failed") {
      return {
        icon: XCircle,
        title: t("workspace.statusContext.failed.title", "Task failed"),
        description: t("workspace.statusContext.failed.description", "The task encountered an error. You can retry or abandon it."),
        variant: "destructive" as const,
      };
    }

    // Priority 3: Review
    if (status === "review") {
      if (reviewReason === "completed") {
        return {
          icon: CheckCircle2,
          title: t("workspace.statusContext.review.completed.title", "Ready for approval"),
          description: t("workspace.statusContext.review.completed.description", "The task has been completed. Review the changes and approve to mark as done."),
          variant: "success" as const,
        };
      }
      if (reviewReason === "plan_review") {
        return {
          icon: FileText,
          title: t("workspace.statusContext.review.plan.title", "Plan needs review"),
          description: t("workspace.statusContext.review.plan.description", "Review the implementation plan. Approve to proceed with coding, or reject to revise."),
          variant: "info" as const,
        };
      }
      if (reviewReason === "errors") {
        return {
          icon: AlertCircle,
          title: t("workspace.statusContext.review.errors.title", "Errors need attention"),
          description: t("workspace.statusContext.review.errors.description", "The task encountered errors during execution. Review and click Resume to retry."),
          variant: "warning" as const,
        };
      }
      if (reviewReason === "qa_rejected") {
        return {
          icon: XCircle,
          title: t("workspace.statusContext.review.qa.title", "QA found issues"),
          description: t("workspace.statusContext.review.qa.description", "Quality assurance has identified issues. Click Resume to address them."),
          variant: "warning" as const,
        };
      }
      if (reviewReason === "stopped") {
        return {
          icon: Square,
          title: t("workspace.statusContext.review.stopped.title", "Task was stopped"),
          description: t("workspace.statusContext.review.stopped.description", "The task was manually stopped. Click Resume to continue execution."),
          variant: "muted" as const,
        };
      }
      return {
        icon: Clock,
        title: t("workspace.statusContext.review.default.title", "Awaiting review"),
        description: t("workspace.statusContext.review.default.description", "This task requires your review before proceeding."),
        variant: "info" as const,
      };
    }

    // Priority 4: Running
    if (status === "in_progress" && isRunning) {
      return {
        icon: Loader2,
        title: t("workspace.statusContext.running.title", "Task is running"),
        description: t("workspace.statusContext.running.description", "The agent is currently working on this task. You can stop it if needed."),
        variant: "info" as const,
        iconClassName: "animate-spin",
      };
    }

    // Priority 5: Backlog
    if (status === "backlog") {
      return {
        icon: Clock,
        title: t("workspace.statusContext.backlog.title", "In backlog"),
        description: t("workspace.statusContext.backlog.description", "This task is waiting to be queued. Click Queue to add it to the execution queue."),
        variant: "muted" as const,
      };
    }

    // Priority 6: Queue
    if (status === "queue") {
      return {
        icon: Play,
        title: t("workspace.statusContext.queue.title", "Ready to start"),
        description: t("workspace.statusContext.queue.description", "This task is queued and ready. Click Start to begin execution."),
        variant: "info" as const,
      };
    }

    // Priority 7: Completed
    if (status === "completed") {
      return {
        icon: CheckCircle2,
        title: t("workspace.statusContext.completed.title", "Task completed"),
        description: t("workspace.statusContext.completed.description", "This task has been successfully completed."),
        variant: "success" as const,
      };
    }

    return null;
  }, [showStatusContext, status, isStuck, isRunning, reviewReason, t]);

  // Variant styles for status context
  const variantStyles = {
    success: "bg-success/10 border-success/30 text-success",
    warning: "bg-warning/10 border-warning/30 text-warning",
    destructive: "bg-destructive/10 border-destructive/30 text-destructive",
    info: "bg-primary/10 border-primary/30 text-primary",
    muted: "bg-muted/50 border-border text-muted-foreground",
  };

  if (buttons.length === 0 && !statusContext) {
    return null;
  }

  // Detailed view with status context
  if (showStatusContext && statusContext) {
    const StatusIcon = statusContext.icon;
    return (
      <div className={cn("space-y-3", className)}>
        {/* Status context card */}
        <div className={cn(
          "flex items-start gap-3 p-3 rounded-lg border",
          variantStyles[statusContext.variant]
        )}>
          <StatusIcon className={cn("h-5 w-5 shrink-0 mt-0.5", statusContext.iconClassName)} />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm">{statusContext.title}</p>
            <p className="text-xs opacity-80 mt-0.5">{statusContext.description}</p>
          </div>
        </div>

        {/* Content between status context and buttons (e.g., PR card) */}
        {renderBetween}

        {/* Action buttons */}
        {buttons.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            {buttons}
            {/* Archive button for completed tasks */}
            {status === "completed" && onArchive && (
              <Button
                variant="outline"
                size={size}
                className={sizeClasses[size]}
                onClick={onArchive}
              >
                <Archive className={cn(size === "sm" ? "h-3 w-3" : "h-4 w-4", "mr-1.5")} />
                {t("workspace.taskActions.archive", "Archive")}
              </Button>
            )}
          </div>
        )}
      </div>
    );
  }

  // Simple view (just buttons)
  return (
    <div className={cn("flex items-center gap-2 flex-wrap", className)}>
      {buttons}
    </div>
  );
}

export default TaskActionButtons;
