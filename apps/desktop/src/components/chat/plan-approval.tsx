import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import {
  ListChecks,
  Check,
  X,
  Loader2,
  CheckCircle2,
  XCircle,
  Play,
  Ban,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { TaskPlan, TaskPlanStep } from "@/types";

interface PlanApprovalProps {
  plan: TaskPlan;
  onApprove?: () => void;
  onReject?: () => void;
  isPending?: boolean;
  isApproving?: boolean;
  isRejecting?: boolean;
  className?: string;
}

function StepStatusIcon({ status }: { status: TaskPlanStep["status"] }) {
  switch (status) {
    case "completed":
      return <Check className="h-3 w-3" />;
    case "in_progress":
      return <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />;
    case "failed":
      return <X className="h-3 w-3" />;
    case "cancelled":
      return <X className="h-3 w-3" />;
    case "pending":
    default:
      return null;
  }
}

function getStepStatusStyles(status: TaskPlanStep["status"]) {
  switch (status) {
    case "completed":
      return "border-primary bg-primary text-primary-foreground";
    case "in_progress":
      return "border-primary bg-primary/10 text-primary";
    case "failed":
      return "border-destructive bg-destructive/10 text-destructive";
    case "cancelled":
      return "border-muted-foreground/30 bg-muted text-muted-foreground";
    case "pending":
    default:
      return "border-muted-foreground/30 bg-background text-muted-foreground";
  }
}

function getStepTextStyles(status: TaskPlanStep["status"]) {
  switch (status) {
    case "completed":
      return "text-muted-foreground";
    case "in_progress":
      return "text-foreground font-medium";
    case "failed":
      return "text-destructive";
    case "cancelled":
      return "text-muted-foreground line-through";
    case "pending":
    default:
      return "text-foreground";
  }
}

export function PlanApproval({
  plan,
  onApprove,
  onReject,
  isPending = false,
  isApproving = false,
  isRejecting = false,
  className,
}: PlanApprovalProps) {
  const { t } = useTranslation();

  // Calculate plan status
  const allCompleted = plan.steps.every((step) => step.status === "completed");
  const isCancelled = plan.steps.some((step) => step.status === "cancelled");
  const hasFailure = plan.steps.some((step) => step.status === "failed");
  const isExecuting = plan.steps.some((step) => step.status === "in_progress");
  const completedCount = plan.steps.filter((step) => step.status === "completed").length;
  const totalSteps = plan.steps.length;

  // Determine container styles based on state
  const containerStyles = cn(
    "rounded-xl border transition-colors",
    isCancelled && !isPending
      ? "border-muted-foreground/30 bg-muted/30"
      : allCompleted && !isPending
        ? "border-emerald-500/30 bg-emerald-50/30 dark:bg-emerald-950/20"
        : hasFailure
          ? "border-destructive/30 bg-destructive/5"
          : "border-primary/30 bg-accent/30"
  );

  // Get header icon based on state
  const HeaderIcon = () => {
    if (isCancelled && !isPending) {
      return <Ban className="h-4 w-4 text-muted-foreground" />;
    }
    if (allCompleted && !isPending) {
      return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
    }
    if (hasFailure) {
      return <XCircle className="h-4 w-4 text-destructive" />;
    }
    return <ListChecks className="h-4 w-4 text-primary" />;
  };

  // Get status badge
  const StatusBadge = () => {
    if (isPending) {
      return (
        <span className="rounded-full bg-primary/20 px-2 py-0.5 text-xs text-primary">
          {t("chat.pendingApproval")}
        </span>
      );
    }
    if (isCancelled) {
      return (
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          {t("chat.planCancelled")}
        </span>
      );
    }
    if (allCompleted) {
      return (
        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
          {t("chat.planCompleted")}
        </span>
      );
    }
    if (hasFailure) {
      return (
        <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive">
          {t("chat.planFailed")}
        </span>
      );
    }
    if (isExecuting) {
      return (
        <span className="rounded-full bg-primary/20 px-2 py-0.5 text-xs text-primary animate-pulse">
          {t("chat.planExecuting")}
        </span>
      );
    }
    return null;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("flex gap-3", className)}
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
        <ListChecks className="h-4 w-4 text-primary" />
      </div>
      <div className="flex-1">
        <div className={cn(containerStyles, "overflow-hidden")}>
          {/* Header */}
          <div className="px-4 py-3 border-b border-primary/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <HeaderIcon />
                <span className="font-serif font-semibold">{t("chat.executionPlan")}</span>
                <StatusBadge />
              </div>
              {/* Progress indicator */}
              {!isPending && totalSteps > 0 && (
                <span className="text-xs text-muted-foreground">
                  {completedCount}/{totalSteps}
                </span>
              )}
            </div>
          </div>

          {/* Goal */}
          <div className="px-4 py-3 space-y-1 border-b border-primary/10">
            <p className="text-xs text-muted-foreground">{t("chat.planGoal")}</p>
            <p className="text-sm text-foreground">{plan.goal}</p>
          </div>

          {/* Steps */}
          <div className="px-4 py-3">
            <p className="text-xs text-muted-foreground mb-2">
              {t("chat.stepsCount", { count: totalSteps })}
            </p>
            <div className="space-y-2">
              <AnimatePresence mode="popLayout">
                {plan.steps.map((step, index) => (
                  <motion.div
                    key={step.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    transition={{ delay: index * 0.05 }}
                    className="flex items-start gap-2.5"
                  >
                    {/* Step number or status indicator */}
                    <div
                      className={cn(
                        "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border text-xs font-medium transition-colors",
                        getStepStatusStyles(step.status)
                      )}
                    >
                      {step.status === "completed" ||
                      step.status === "in_progress" ||
                      step.status === "cancelled" ? (
                        <StepStatusIcon status={step.status} />
                      ) : (
                        index + 1
                      )}
                    </div>
                    <span
                      className={cn(
                        "min-w-0 flex-1 text-sm leading-snug",
                        getStepTextStyles(step.status)
                      )}
                    >
                      {step.description}
                    </span>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>

          {/* Notes */}
          {plan.notes && (
            <div className="px-4 py-3 border-t border-primary/10">
              <p className="text-xs text-muted-foreground mb-1">{t("chat.planNotes")}</p>
              <p className="text-sm text-muted-foreground italic">{plan.notes}</p>
            </div>
          )}

          {/* Action buttons - only show when waiting for approval */}
          {isPending && onApprove && onReject && !isExecuting && !allCompleted && !isCancelled && (
            <div className="px-4 py-3 bg-muted/50 border-t border-primary/20">
              <p className="text-sm text-muted-foreground mb-3">
                {t("chat.planApprovalPrompt")}
              </p>
              <div className="flex items-center justify-end gap-2">
                <Button
                  onClick={onReject}
                  variant="ghost"
                  size="sm"
                  disabled={isRejecting || isApproving}
                  className="text-muted-foreground hover:text-foreground"
                >
                  {isRejecting ? (
                    <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  ) : (
                    <X className="h-4 w-4 mr-1.5" />
                  )}
                  {t("chat.rejectPlan")}
                </Button>
                <Button
                  onClick={onApprove}
                  size="sm"
                  disabled={isApproving || isRejecting}
                >
                  {isApproving ? (
                    <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4 mr-1.5" />
                  )}
                  {t("chat.startExecution")}
                </Button>
              </div>
            </div>
          )}

          {/* Completion status footer */}
          {allCompleted && !isPending && (
            <div className="px-4 py-3 bg-emerald-500/10 border-t border-emerald-500/20">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4" />
                <span className="text-sm font-medium">
                  {t("chat.planCompleted")}
                </span>
              </div>
            </div>
          )}

          {/* Cancelled status footer */}
          {isCancelled && !isPending && !allCompleted && (
            <div className="px-4 py-3 bg-muted border-t border-border">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Ban className="h-4 w-4" />
                <span className="text-sm font-medium">
                  {t("chat.planCancelled")}
                </span>
              </div>
            </div>
          )}

          {/* Failed status footer */}
          {hasFailure && !isCancelled && (
            <div className="px-4 py-3 bg-destructive/10 border-t border-destructive/20">
              <div className="flex items-center gap-2 text-destructive">
                <XCircle className="h-4 w-4" />
                <span className="text-sm font-medium">
                  {t("chat.planFailed")}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
