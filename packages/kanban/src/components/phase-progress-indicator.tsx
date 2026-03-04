"use client";

import * as React from "react";
import { Loader2, CheckCircle, Circle, AlertCircle } from "lucide-react";
import { cn } from "@viben/ui";

export type ExecutionPhase = "planning" | "implementing" | "testing" | "review";

export interface PhaseProgressIndicatorProps {
  /** Current execution phase */
  currentPhase: ExecutionPhase;
  /** Whether the execution is currently running */
  isRunning?: boolean;
  /** Whether the execution has failed */
  hasFailed?: boolean;
  /** Show compact version (just current phase) */
  compact?: boolean;
  className?: string;
}

const PHASE_ORDER: ExecutionPhase[] = ["planning", "implementing", "testing", "review"];

const PHASE_LABELS: Record<ExecutionPhase, string> = {
  planning: "Planning",
  implementing: "Implementing",
  testing: "Testing",
  review: "Review",
};

const PHASE_COLORS: Record<ExecutionPhase, string> = {
  planning: "text-blue-500",
  implementing: "text-amber-500",
  testing: "text-purple-500",
  review: "text-green-500",
};

export function PhaseProgressIndicator({
  currentPhase,
  isRunning = false,
  hasFailed = false,
  compact = false,
  className,
}: PhaseProgressIndicatorProps) {
  const currentIndex = PHASE_ORDER.indexOf(currentPhase);

  if (compact) {
    return (
      <div className={cn("inline-flex items-center gap-1.5", className)}>
        {isRunning && !hasFailed ? (
          <Loader2 className={cn("h-3.5 w-3.5 animate-spin", PHASE_COLORS[currentPhase])} />
        ) : hasFailed ? (
          <AlertCircle className="h-3.5 w-3.5 text-destructive" />
        ) : (
          <CheckCircle className={cn("h-3.5 w-3.5", PHASE_COLORS[currentPhase])} />
        )}
        <span className={cn("text-xs font-medium", PHASE_COLORS[currentPhase])}>
          {PHASE_LABELS[currentPhase]}
        </span>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-1", className)}>
      {PHASE_ORDER.map((phase, index) => {
        const isCompleted = index < currentIndex;
        const isCurrent = index === currentIndex;
        const isPending = index > currentIndex;

        return (
          <React.Fragment key={phase}>
            {/* Phase indicator */}
            <div
              className={cn(
                "flex items-center gap-1 px-2 py-1 rounded-full text-xs",
                isCompleted && "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
                isCurrent && isRunning && !hasFailed && "bg-primary/10 text-primary",
                isCurrent && hasFailed && "bg-destructive/10 text-destructive",
                isCurrent && !isRunning && !hasFailed && "bg-muted text-muted-foreground",
                isPending && "bg-muted/50 text-muted-foreground/50"
              )}
            >
              {isCompleted && <CheckCircle className="h-3 w-3" />}
              {isCurrent && isRunning && !hasFailed && (
                <Loader2 className="h-3 w-3 animate-spin" />
              )}
              {isCurrent && hasFailed && <AlertCircle className="h-3 w-3" />}
              {isCurrent && !isRunning && !hasFailed && <Circle className="h-3 w-3" />}
              {isPending && <Circle className="h-3 w-3 opacity-50" />}
              <span className="font-medium">{PHASE_LABELS[phase]}</span>
            </div>
            {/* Connector line */}
            {index < PHASE_ORDER.length - 1 && (
              <div
                className={cn(
                  "w-4 h-0.5 rounded-full",
                  index < currentIndex ? "bg-green-500" : "bg-muted"
                )}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

PhaseProgressIndicator.displayName = "PhaseProgressIndicator";
