import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import {
  ListChecks,
  Check,
  X,
  Loader2,
  Circle,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { TaskPlan, TaskPlanStep } from "@/types";

interface PlanApprovalProps {
  plan: TaskPlan;
  onApprove?: () => void;
  onReject?: () => void;
  isPending?: boolean;
  className?: string;
}

function StepStatusIcon({ status }: { status: TaskPlanStep["status"] }) {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case "in_progress":
      return <Loader2 className="h-4 w-4 text-primary animate-spin" />;
    case "failed":
      return <XCircle className="h-4 w-4 text-destructive" />;
    case "cancelled":
      return <XCircle className="h-4 w-4 text-muted-foreground" />;
    case "pending":
    default:
      return <Circle className="h-4 w-4 text-muted-foreground" />;
  }
}

export function PlanApproval({
  plan,
  onApprove,
  onReject,
  isPending,
  className,
}: PlanApprovalProps) {
  const { t } = useTranslation();

  const allCompleted = plan.steps.every((step) => step.status === "completed");
  const allCancelled = plan.steps.every((step) => step.status === "cancelled");
  const hasFailure = plan.steps.some((step) => step.status === "failed");
  const isExecuting = plan.steps.some((step) => step.status === "in_progress");

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
        <div className="rounded-2xl rounded-tl-md border border-primary/30 bg-primary/5 overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-primary/20">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              <h4 className="font-serif font-semibold text-foreground">
                {t("chat.executionPlan")}
              </h4>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{plan.goal}</p>
          </div>

          {/* Steps */}
          <div className="px-4 py-3">
            <ul className="space-y-2">
              {plan.steps.map((step, index) => (
                <li key={step.id} className="flex items-start gap-3">
                  <StepStatusIcon status={step.status} />
                  <div className="flex-1 min-w-0">
                    <p
                      className={cn(
                        "text-sm",
                        step.status === "completed" && "text-green-600 line-through",
                        step.status === "cancelled" && "text-muted-foreground line-through",
                        step.status === "failed" && "text-destructive",
                        step.status === "in_progress" && "text-primary font-medium"
                      )}
                    >
                      <span className="text-muted-foreground mr-2">
                        {index + 1}.
                      </span>
                      {step.description}
                    </p>
                  </div>
                </li>
              ))}
            </ul>

            {plan.notes && (
              <p className="mt-3 text-xs text-muted-foreground italic">
                {plan.notes}
              </p>
            )}
          </div>

          {/* Actions - only show if pending and not executing */}
          {isPending && !isExecuting && !allCompleted && !allCancelled && (
            <div className="px-4 py-3 bg-muted/50 border-t border-primary/20">
              <p className="text-sm text-muted-foreground mb-3">
                {t("chat.planApprovalPrompt")}
              </p>
              <div className="flex gap-2">
                <Button
                  onClick={onApprove}
                  size="sm"
                  className="flex-1"
                >
                  <Check className="h-4 w-4 mr-1" />
                  {t("chat.approvePlan")}
                </Button>
                <Button
                  onClick={onReject}
                  variant="outline"
                  size="sm"
                  className="flex-1"
                >
                  <X className="h-4 w-4 mr-1" />
                  {t("chat.rejectPlan")}
                </Button>
              </div>
            </div>
          )}

          {/* Status indicators */}
          {allCompleted && (
            <div className="px-4 py-3 bg-green-500/10 border-t border-green-500/20">
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                <span className="text-sm font-medium">
                  {t("chat.planCompleted")}
                </span>
              </div>
            </div>
          )}

          {allCancelled && (
            <div className="px-4 py-3 bg-muted border-t border-border">
              <div className="flex items-center gap-2 text-muted-foreground">
                <XCircle className="h-4 w-4" />
                <span className="text-sm font-medium">
                  {t("chat.planCancelled")}
                </span>
              </div>
            </div>
          )}

          {hasFailure && (
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
