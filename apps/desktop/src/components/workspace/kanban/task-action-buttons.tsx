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
  GitPullRequest,
  Loader2,
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
} from "@/lib/vibe-kanban/types";

export interface TaskActionButtonsProps {
  /** Task ID */
  taskId: string;
  /** Workspace path */
  workspacePath: string;
  /** Current task status */
  status: TaskStatus;
  /** XState state value */
  xstateState?: XStateValue;
  /** Review reason (for human_review status) */
  reviewReason?: ReviewReason;
  /** Whether the task is stuck */
  isStuck?: boolean;
  /** Whether the task has an in-progress attempt */
  isRunning?: boolean;
  /** Whether the last attempt failed */
  lastAttemptFailed?: boolean;
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
}

/**
 * TaskActionButtons component
 *
 * Renders action buttons based on task state:
 * - backlog/queue: Start button
 * - in_progress (running): Stop button
 * - in_progress (stuck): Recover button
 * - human_review: Approve, Reject, Create PR buttons
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
  lastAttemptFailed = false,
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
            const prompt = taskDescription
              ? `Task: ${taskTitle || "Unnamed task"}\n\nDescription: ${taskDescription}`
              : `Task: ${taskTitle || "Unnamed task"}`;

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
  const handleStart = useCallback(() => submitEvent("START"), [submitEvent]);
  // handleQueue is available for future use when we need queue functionality
  // const handleQueue = useCallback(() => submitEvent("QUEUE"), [submitEvent]);
  const handleStop = useCallback(() => submitEvent("USER_STOPPED"), [submitEvent]);
  const handleApprove = useCallback(() => submitEvent("APPROVED"), [submitEvent]);
  const handleReject = useCallback(() => submitEvent("REJECTED"), [submitEvent]);
  const handleCreatePR = useCallback(() => submitEvent("CREATE_PR"), [submitEvent]);
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

    // Priority 2: Error state - Show Retry and Abandon buttons
    if (status === "error") {
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

    // Priority 3: Human review state - Show Approve, Reject, Create PR buttons
    if (status === "human_review") {
      // Show different buttons based on review reason
      if (reviewReason === "completed") {
        // Task completed, show Approve and Create PR
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
            key="createPr"
            variant="outline"
            size={size}
            className={sizeClasses[size]}
            onClick={handleCreatePR}
            disabled={isSubmitting}
          >
            {submittingEvent === "CREATE_PR" ? (
              <LoadingIcon />
            ) : (
              <GitPullRequest className={iconWithMargin} />
            )}
            {t("workspace.taskActions.createPr", "Create PR")}
          </Button>
        );
      } else if (reviewReason === "plan_review") {
        // Plan review, show Approve and Reject
        buttonList.push(
          <Button
            key="approve"
            variant="default"
            size={size}
            className={sizeClasses[size]}
            onClick={handleApprove}
            disabled={isSubmitting}
          >
            {submittingEvent === "APPROVED" ? (
              <LoadingIcon />
            ) : (
              <CheckCircle2 className={iconWithMargin} />
            )}
            {t("workspace.taskActions.approvePlan", "Approve Plan")}
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
      } else {
        // Other review reasons (errors, qa_rejected, stopped) - Show Resume
        buttonList.push(
          <Button
            key="resume"
            variant="default"
            size={size}
            className={sizeClasses[size]}
            onClick={handleReject}
            disabled={isSubmitting}
          >
            {submittingEvent === "REJECTED" ? (
              <LoadingIcon />
            ) : (
              <Play className={iconWithMargin} />
            )}
            {t("workspace.taskActions.resume", "Resume")}
          </Button>
        );
      }
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

    // Priority 5: Backlog or queue state - Show Start button
    if (status === "backlog" || status === "queue") {
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

    // Priority 6: Failed but not stuck - Show Resume button
    if (lastAttemptFailed && !isRunning) {
      buttonList.push(
        <Button
          key="resume"
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
          {t("workspace.taskActions.resume", "Resume")}
        </Button>
      );
      return buttonList;
    }

    // Priority 7: Done state - Show completion indicator
    if (status === "done" || status === "pr_created") {
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
    lastAttemptFailed,
    reviewReason,
    showAllActions,
    size,
    isSubmitting,
    submittingEvent,
    handleStart,
    handleStop,
    handleApprove,
    handleReject,
    handleCreatePR,
    handleRetry,
    handleAbandon,
    LoadingIcon,
    t,
    sizeClasses,
  ]);

  if (buttons.length === 0) {
    return null;
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {buttons}
    </div>
  );
}

export default TaskActionButtons;
