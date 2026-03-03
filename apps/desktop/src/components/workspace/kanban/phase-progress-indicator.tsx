"use client";

import { useMemo, useRef, useEffect, useState } from "react";
import { cn } from "@viben/ui";
import { useTranslation } from "react-i18next";
import {
  type ExecutionPhase,
  type Subtask,
  type SubtaskStatus,
} from "@/lib/vibe-kanban";

interface PhaseProgressIndicatorProps {
  /** Current execution phase */
  phase?: ExecutionPhase;
  /** Subtask details for visualization */
  subtasks?: Subtask[];
  /** Phase progress percentage (0-100) */
  phaseProgress?: number;
  /** Whether the task is stuck */
  isStuck?: boolean;
  /** Whether the task is actively running */
  isRunning?: boolean;
  /** Additional CSS classes */
  className?: string;
}

// Phase display labels (i18n keys)
const PHASE_LABELS: Record<ExecutionPhase, string> = {
  planning: "workspace.phase.planning",
  coding: "workspace.phase.coding",
  qa_review: "workspace.phase.qaReview",
  qa_fixing: "workspace.phase.qaFixing",
  complete: "workspace.phase.complete",
};

// Phase fallback labels
const PHASE_FALLBACK: Record<ExecutionPhase, string> = {
  planning: "Planning",
  coding: "Coding",
  qa_review: "QA Review",
  qa_fixing: "QA Fixing",
  complete: "Complete",
};

// Subtask status colors
const SUBTASK_STATUS_COLORS: Record<SubtaskStatus, string> = {
  pending: "bg-muted-foreground/30",
  in_progress: "bg-info animate-pulse",
  completed: "bg-success",
  failed: "bg-destructive",
};

// Phase step indicator
const PHASE_STEPS: ExecutionPhase[] = ["planning", "coding", "qa_review"];

/**
 * PhaseProgressIndicator - Displays task execution progress with subtask visualization
 *
 * Features:
 * - Progress label row with phase name and percentage
 * - Animated progress bar (shimmer for planning/qa, determinate for coding)
 * - Subtask dots visualization (max 10)
 * - Phase steps indicator
 * - Performance optimized with IntersectionObserver
 */
export function PhaseProgressIndicator({
  phase,
  subtasks,
  phaseProgress,
  isStuck = false,
  isRunning = false,
  className,
}: PhaseProgressIndicatorProps) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(true);

  // Pause animations when not visible (performance optimization)
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
      },
      { threshold: 0.1 }
    );

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Calculate progress based on subtasks or phaseProgress
  const progress = useMemo(() => {
    if (phaseProgress !== undefined) {
      return phaseProgress;
    }
    if (subtasks && subtasks.length > 0) {
      const completed = subtasks.filter((s) => s.status === "completed").length;
      return Math.round((completed / subtasks.length) * 100);
    }
    return 0;
  }, [phaseProgress, subtasks]);

  // Determine if we should show indeterminate (shimmer) progress
  const isIndeterminate = phase === "planning" || phase === "qa_review" || phase === "qa_fixing";

  // Get current phase index for step indicator
  const currentPhaseIndex = phase ? PHASE_STEPS.indexOf(phase) : -1;

  // Show max 10 subtask dots
  const visibleSubtasks = useMemo(() => {
    if (!subtasks) return [];
    return subtasks.slice(0, 10);
  }, [subtasks]);

  const hasMoreSubtasks = subtasks && subtasks.length > 10;

  // Don't render if no meaningful progress to show
  if (!phase && (!subtasks || subtasks.length === 0)) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        "flex flex-col gap-1.5 py-1.5",
        className
      )}
    >
      {/* Progress label row */}
      <div className="flex items-center justify-between gap-2">
        {/* Phase label */}
        <span className={cn(
          "text-[10px] font-medium",
          isStuck ? "text-warning" : "text-muted-foreground"
        )}>
          {phase && t(PHASE_LABELS[phase], PHASE_FALLBACK[phase])}
        </span>

        {/* Progress percentage (only for determinate progress) */}
        {!isIndeterminate && progress > 0 && (
          <span className="text-[10px] text-muted-foreground tabular-nums">
            {progress}%
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div
        className={cn(
          "relative h-1 w-full rounded-full overflow-hidden",
          "bg-muted/50"
        )}
      >
        {isIndeterminate ? (
          /* Shimmer animation for planning/qa phases */
          <div
            className={cn(
              "absolute inset-0 rounded-full",
              isVisible && isRunning && !isStuck && "animate-progress-shimmer",
              isStuck ? "bg-warning/50" : "bg-info/50"
            )}
            style={{
              background: isVisible && isRunning && !isStuck
                ? `linear-gradient(90deg, transparent, ${isStuck ? "hsl(var(--warning) / 0.5)" : "hsl(var(--info) / 0.5)"}, transparent)`
                : undefined,
              backgroundSize: "200% 100%",
            }}
          />
        ) : (
          /* Determinate fill for coding phase */
          <div
            className={cn(
              "h-full rounded-full transition-all duration-300 ease-out",
              isStuck ? "bg-warning" : "bg-info"
            )}
            style={{ width: `${progress}%` }}
          />
        )}
      </div>

      {/* Subtask dots */}
      {visibleSubtasks.length > 0 && (
        <div className="flex items-center gap-1 mt-0.5">
          {visibleSubtasks.map((subtask) => (
            <div
              key={subtask.id}
              className={cn(
                "w-1.5 h-1.5 rounded-full transition-colors",
                SUBTASK_STATUS_COLORS[subtask.status],
                !isVisible && "animate-none"
              )}
              title={subtask.title || subtask.name}
            />
          ))}
          {hasMoreSubtasks && (
            <span className="text-[9px] text-muted-foreground ml-0.5">
              +{subtasks!.length - 10}
            </span>
          )}
        </div>
      )}

      {/* Phase steps indicator */}
      {phase && currentPhaseIndex >= 0 && (
        <div className="flex items-center gap-1 mt-0.5">
          {PHASE_STEPS.map((stepPhase, index) => {
            const isCompleted = index < currentPhaseIndex;
            const isCurrent = index === currentPhaseIndex;
            const isPending = index > currentPhaseIndex;

            return (
              <div key={stepPhase} className="flex items-center gap-1">
                <div
                  className={cn(
                    "w-1.5 h-1.5 rounded-full transition-colors",
                    isCompleted && "bg-success",
                    isCurrent && (isStuck ? "bg-warning" : "bg-info"),
                    isPending && "bg-muted-foreground/30"
                  )}
                />
                {index < PHASE_STEPS.length - 1 && (
                  <div
                    className={cn(
                      "w-3 h-px transition-colors",
                      isCompleted ? "bg-success/50" : "bg-muted-foreground/20"
                    )}
                  />
                )}
              </div>
            );
          })}
          <span className="text-[9px] text-muted-foreground ml-1">
            {currentPhaseIndex + 1}/{PHASE_STEPS.length}
          </span>
        </div>
      )}
    </div>
  );
}
