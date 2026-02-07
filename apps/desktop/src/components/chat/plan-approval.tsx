import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import {
  ListChecks,
  Check,
  X,
  Ban,
  Play,
  Loader2,
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

function StepStatusIndicator({
  step,
  index,
}: {
  step: TaskPlanStep;
  index: number;
}) {
  return (
    <div
      className={cn(
        "flex h-5 w-5 shrink-0 items-center justify-center rounded border text-xs font-medium transition-colors",
        step.status === "completed"
          ? "border-primary bg-primary text-primary-foreground"
          : step.status === "in_progress"
            ? "border-primary bg-primary/10 text-primary"
            : step.status === "failed"
              ? "border-destructive bg-destructive/10 text-destructive"
              : step.status === "cancelled"
                ? "border-muted-foreground/30 bg-muted text-muted-foreground"
                : "border-muted-foreground/30 bg-background text-muted-foreground"
      )}
    >
      {step.status === "completed" ? (
        <Check className="h-3 w-3" />
      ) : step.status === "in_progress" ? (
        <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
      ) : step.status === "cancelled" ? (
        <X className="h-3 w-3" />
      ) : step.status === "failed" ? (
        <X className="h-3 w-3" />
      ) : (
        index + 1
      )}
    </div>
  );
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
  const isAllCompleted = plan.steps.every(
    (step) => step.status === "completed"
  );
  const isCancelled = plan.steps.some((step) => step.status === "cancelled");
  const hasFailed = plan.steps.some((step) => step.status === "failed");
  const isExecuting = plan.steps.some((step) => step.status === "in_progress");
  const completedCount = plan.steps.filter(
    (step) => step.status === "completed"
  ).length;

  // Determine border/background style based on status
  const containerStyle = cn(
    "rounded-xl border overflow-hidden transition-colors",
    isCancelled && !isPending
      ? "border-muted-foreground/30 bg-muted/30"
      : isAllCompleted && !isPending
        ? "border-emerald-500/30 bg-emerald-50/30 dark:bg-emerald-950/20"
        : hasFailed
          ? "border-destructive/30 bg-destructive/5"
          : "border-primary/30 bg-primary/5"
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("flex gap-3", className)}
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
        {isCancelled && !isPending ? (
          <Ban className="h-4 w-4 text-muted-foreground" />
        ) : isAllCompleted && !isPending ? (
          <Check className="h-4 w-4 text-emerald-500" />
        ) : hasFailed ? (
          <X className="h-4 w-4 text-destructive" />
        ) : (
          <ListChecks className="h-4 w-4 text-primary" />
        )}
      </div>
      <div className="flex-1">
        <div className={containerStyle}>
          {/* Header */}
          <div className="px-4 py-3 border-b border-inherit">
            <div className="flex items-center gap-2">
              <h4 className="font-serif font-semibold text-foreground">
                {t("chat.executionPlan")}
              </h4>
              {isPending ? (
                <span className="bg-primary/20 text-primary rounded-full px-2 py-0.5 text-xs font-medium">
                  {t("chat.pendingApproval")}
                </span>
              ) : isCancelled ? (
                <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs font-medium">
                  {t("chat.planCancelled")}
                </span>
              ) : isAllCompleted ? (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                  {t("chat.planCompleted")}
                </span>
              ) : hasFailed ? (
                <span className="bg-destructive/10 text-destructive rounded-full px-2 py-0.5 text-xs font-medium">
                  {t("chat.planFailed")}
                </span>
              ) : isExecuting ? (
                <span className="bg-primary/20 text-primary rounded-full px-2 py-0.5 text-xs font-medium animate-pulse">
                  {t("chat.stepInProgress")}
                </span>
              ) : null}
            </div>
          </div>

          {/* Goal */}
          <div className="px-4 py-3 border-b border-inherit bg-muted/30">
            <p className="text-xs text-muted-foreground mb-1">{t("chat.goal")}</p>
            <p className="text-sm text-foreground">{plan.goal}</p>
          </div>

          {/* Progress bar (when executing) */}
          {isExecuting && plan.steps.length > 0 && (
            <div className="px-4 py-2 border-b border-inherit bg-muted/20">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                <span>{t("chat.progress")}</span>
                <span>
                  {completedCount} / {plan.steps.length}
                </span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-primary rounded-full"
                  initial={{ width: 0 }}
                  animate={{
                    width: `${(completedCount / plan.steps.length) * 100}%`,
                  }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </div>
          )}

          {/* Steps */}
          <div className="px-4 py-3">
            <p className="text-xs text-muted-foreground mb-2">
              {t("chat.stepsCount", { count: plan.steps.length })}
            </p>
            <ul className="space-y-2">
              <AnimatePresence mode="popLayout">
                {plan.steps.map((step, index) => (
                  <motion.li
                    key={step.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="flex items-start gap-2.5"
                  >
                    <StepStatusIndicator step={step} index={index} />
                    <span
                      className={cn(
                        "flex-1 text-sm leading-snug min-w-0",
                        step.status === "completed"
                          ? "text-muted-foreground"
                          : step.status === "in_progress"
                            ? "text-foreground font-medium"
                            : step.status === "failed"
                              ? "text-destructive"
                              : step.status === "cancelled"
                                ? "text-muted-foreground line-through"
                                : "text-foreground"
                      )}
                    >
                      {step.description}
                    </span>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>

            {/* Notes */}
            {plan.notes && (
              <p className="mt-3 text-xs text-muted-foreground italic border-t border-inherit pt-3">
                {plan.notes}
              </p>
            )}
          </div>

          {/* Action buttons - only show when pending and not executing */}
          {isPending && !isExecuting && !isAllCompleted && !isCancelled && (
            <div className="px-4 py-3 bg-muted/50 border-t border-inherit">
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
                  {t("chat.approvePlan")}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
