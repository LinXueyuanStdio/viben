"use client";

import { useMemo, useRef, useEffect, useState, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@viben/ui";
import { useTranslation } from "react-i18next";
import {
  type ExecutionPhase,
  type Subtask,
  type SubtaskStatus,
} from "@/lib/kanban";

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

// Phase colors configuration
const PHASE_COLORS: Record<ExecutionPhase, { color: string; bgColor: string }> = {
  idle: { color: "bg-muted-foreground", bgColor: "bg-muted/20" },
  plan: { color: "bg-amber-500", bgColor: "bg-amber-500/20" },
  implement: { color: "bg-info", bgColor: "bg-info/20" },
  rate_limit_paused: { color: "bg-orange-400", bgColor: "bg-orange-400/20" },
  auth_failure_paused: { color: "bg-red-400", bgColor: "bg-red-400/20" },
  check: { color: "bg-purple-500", bgColor: "bg-purple-500/20" },
  fix: { color: "bg-orange-500", bgColor: "bg-orange-500/20" },
  complete: { color: "bg-success", bgColor: "bg-success/20" },
  failed: { color: "bg-destructive", bgColor: "bg-destructive/20" },
};

// Phase display labels (i18n keys)
const PHASE_LABELS: Record<ExecutionPhase, string> = {
  idle: "workspace.phase.idle",
  plan: "workspace.phase.plan",
  implement: "workspace.phase.implement",
  rate_limit_paused: "workspace.phase.rateLimitPaused",
  auth_failure_paused: "workspace.phase.authFailurePaused",
  check: "workspace.phase.check",
  fix: "workspace.phase.fix",
  complete: "workspace.phase.complete",
  failed: "workspace.phase.failed",
};

// Phase fallback labels (i18n keys)
const PHASE_FALLBACK_KEYS: Record<ExecutionPhase, string> = {
  idle: "phase.idle",
  plan: "phase.plan",
  implement: "phase.implement",
  rate_limit_paused: "phase.rateLimitPaused",
  auth_failure_paused: "phase.authFailurePaused",
  check: "phase.check",
  fix: "phase.fix",
  complete: "phase.complete",
  failed: "phase.failed",
};

// Phase short labels for step indicator (i18n keys)
const PHASE_SHORT_LABEL_KEYS: Record<ExecutionPhase, string> = {
  idle: "phase.idleShort",
  plan: "phase.planShort",
  implement: "phase.implementShort",
  rate_limit_paused: "phase.pausedShort",
  auth_failure_paused: "phase.authShort",
  check: "phase.checkShort",
  fix: "phase.fixShort",
  complete: "phase.doneShort",
  failed: "phase.failedShort",
};

// Subtask status colors
const SUBTASK_STATUS_COLORS: Record<SubtaskStatus, string> = {
  pending: "bg-muted-foreground/30",
  in_progress: "bg-info",
  completed: "bg-success",
  failed: "bg-destructive",
};


/**
 * PhaseProgressIndicator - Displays task execution progress with subtask visualization
 * Based on Auto-Claude's implementation with framer-motion animations
 *
 * Features:
 * - Progress label row with phase name and percentage
 * - Animated progress bar (shimmer for plan/check/fix, determinate for implement)
 * - Subtask dots visualization (max 10) with status-specific animations
 * - Phase steps indicator (Plan → Implement → Check)
 * - Performance optimized with IntersectionObserver
 */
export const PhaseProgressIndicator = memo(function PhaseProgressIndicator({
  phase: rawPhase,
  subtasks = [],
  phaseProgress,
  isStuck = false,
  isRunning = false,
  className,
}: PhaseProgressIndicatorProps) {
  const { t } = useTranslation();
  const phase = rawPhase || "plan";
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(true);

  // Use IntersectionObserver to pause animations when component is not visible
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
      },
      { threshold: 0.1 }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // Only animate when visible and running
  const shouldAnimate = isVisible && isRunning && !isStuck;

  // Calculate subtask-based progress
  const completedSubtasks = subtasks.filter((s) => s.status === "completed").length;
  const totalSubtasks = subtasks.length;
  const subtaskProgress = totalSubtasks > 0
    ? Math.round((completedSubtasks / totalSubtasks) * 100)
    : 0;

  // Determine if we should show indeterminate (activity) vs determinate (%) progress
  const isIndeterminatePhase = phase === "plan" || phase === "check" || phase === "fix";
  // Show subtask progress whenever subtasks exist
  const showSubtaskProgress = totalSubtasks > 0;

  const colors = PHASE_COLORS[phase] || PHASE_COLORS.plan;
  const phaseLabel = t(PHASE_LABELS[phase] || PHASE_LABELS.plan, t(PHASE_FALLBACK_KEYS[phase]));

  // Show max 10 subtask dots
  const visibleSubtasks = useMemo(() => subtasks.slice(0, 10), [subtasks]);
  const hasMoreSubtasks = totalSubtasks > 10;

  // Don't render if no meaningful progress to show
  if (!rawPhase && totalSubtasks === 0 && !isRunning) {
    return null;
  }

  return (
    <div ref={containerRef} className={cn("space-y-1.5", className)}>
      {/* Progress label row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {isStuck
              ? t("workspace.taskCard.interrupted", "Interrupted")
              : showSubtaskProgress
                ? t("workspace.taskCard.progress", "Progress")
                : phaseLabel}
          </span>
          {/* Activity indicator dot for non-coding phases - only animate when visible */}
          {isRunning && !isStuck && isIndeterminatePhase && !showSubtaskProgress && (
            <motion.div
              className={cn("h-1.5 w-1.5 rounded-full", colors.color)}
              animate={shouldAnimate ? {
                scale: [1, 1.5, 1],
                opacity: [1, 0.5, 1],
              } : { scale: 1, opacity: 1 }}
              transition={shouldAnimate ? {
                duration: 1,
                repeat: Infinity,
                ease: "easeInOut",
              } : undefined}
            />
          )}
        </div>
        <span className="text-xs font-medium text-foreground tabular-nums">
          {showSubtaskProgress ? (
            `${subtaskProgress}%`
          ) : isRunning && isIndeterminatePhase && (phaseProgress ?? 0) > 0 ? (
            `${Math.round(Math.min(phaseProgress!, 100))}%`
          ) : (
            "—"
          )}
        </span>
      </div>

      {/* Progress bar */}
      <div
        className={cn(
          "relative h-1.5 w-full overflow-hidden rounded-full",
          isStuck ? "bg-warning/20" : "bg-border"
        )}
      >
        <AnimatePresence mode="wait">
          {isStuck ? (
            // Stuck/Interrupted state - pulsing warning bar
            <motion.div
              key="stuck"
              className="absolute inset-0 bg-warning/40"
              initial={{ opacity: 0 }}
              animate={isVisible ? { opacity: [0.3, 0.6, 0.3] } : { opacity: 0.45 }}
              transition={isVisible ? { duration: 2, repeat: Infinity, ease: "easeInOut" } : undefined}
            />
          ) : showSubtaskProgress ? (
            // Determinate progress for coding phase
            <motion.div
              key="determinate"
              className={cn("h-full rounded-full", colors.color)}
              initial={{ width: 0 }}
              animate={{ width: `${subtaskProgress}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
          ) : shouldAnimate && isIndeterminatePhase ? (
            // Indeterminate animated progress for planning/validation
            <motion.div
              key="indeterminate"
              className={cn("absolute h-full w-1/3 rounded-full", colors.color)}
              animate={{
                x: ["-100%", "400%"],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          ) : isRunning && isIndeterminatePhase && !isVisible ? (
            // Static placeholder when not visible but running
            <motion.div
              key="indeterminate-static"
              className={cn("absolute h-full w-1/3 rounded-full left-1/3", colors.color)}
            />
          ) : null}
        </AnimatePresence>
      </div>

      {/* Subtask indicators (only show when subtasks exist) */}
      {totalSubtasks > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {visibleSubtasks.map((subtask, index) => {
            const isInProgress = subtask.status === "in_progress";
            const shouldPulse = isInProgress && isVisible;

            return (
              <motion.div
                key={subtask.id || `subtask-${index}`}
                className={cn(
                  "h-2 w-2 rounded-full",
                  SUBTASK_STATUS_COLORS[subtask.status]
                )}
                initial={{ scale: 0, opacity: 0 }}
                animate={
                  shouldPulse
                    ? { scale: [1, 1.3, 1], opacity: 1 }
                    : { scale: 1, opacity: 1 }
                }
                transition={
                  shouldPulse
                    ? {
                        scale: { delay: index * 0.03, duration: 1.2, repeat: Infinity, ease: "easeInOut" },
                        opacity: { delay: index * 0.03, duration: 0.2 },
                      }
                    : {
                        scale: { delay: index * 0.03, duration: 0.2 },
                        opacity: { delay: index * 0.03, duration: 0.2 },
                      }
                }
                title={t("workspace.subtaskTooltip", "{{title}}: {{status}}", { title: subtask.title || subtask.name, status: subtask.status })}
              />
            );
          })}
          {hasMoreSubtasks && (
            <span className="text-[10px] text-muted-foreground font-medium ml-0.5">
              +{totalSubtasks - 10}
            </span>
          )}
        </div>
      )}

      {/* Phase steps indicator (shows overall flow) */}
      {(isRunning || rawPhase) && (
        <PhaseStepsIndicator currentPhase={phase} isStuck={isStuck} isVisible={isVisible} />
      )}
    </div>
  );
});

/**
 * Mini phase steps indicator showing the overall flow
 */
const PhaseStepsIndicator = memo(function PhaseStepsIndicator({
  currentPhase,
  isStuck,
  isVisible = true,
}: {
  currentPhase: ExecutionPhase;
  isStuck: boolean;
  isVisible?: boolean;
}) {
  const { t } = useTranslation();
  const phases: { key: ExecutionPhase; labelKey: string }[] = [
    { key: "plan", labelKey: PHASE_SHORT_LABEL_KEYS.plan },
    { key: "implement", labelKey: PHASE_SHORT_LABEL_KEYS.implement },
    { key: "check", labelKey: PHASE_SHORT_LABEL_KEYS.check },
  ];

  const getPhaseState = (phaseKey: ExecutionPhase) => {
    const phaseOrder = ["plan", "implement", "check", "fix", "complete"];
    const currentIndex = phaseOrder.indexOf(currentPhase);
    const phaseIndex = phaseOrder.indexOf(phaseKey);

    if (currentPhase === "complete") return "complete";
    if (phaseKey === currentPhase || (phaseKey === "check" && currentPhase === "fix")) {
      return isStuck ? "stuck" : "active";
    }
    if (phaseIndex < currentIndex) return "complete";
    return "pending";
  };

  return (
    <div className="flex items-center gap-1 mt-2">
      {phases.map((phase, index) => {
        const state = getPhaseState(phase.key);
        const shouldAnimate = state === "active" && !isStuck && isVisible;

        return (
          <div key={phase.key} className="flex items-center">
            <motion.div
              className={cn(
                "flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium",
                state === "complete" && "bg-success/10 text-success",
                state === "active" && "bg-primary/10 text-primary",
                state === "stuck" && "bg-warning/10 text-warning",
                state === "pending" && "bg-muted text-muted-foreground"
              )}
              animate={shouldAnimate ? { opacity: [1, 0.6, 1] } : { opacity: 1 }}
              transition={shouldAnimate ? { duration: 1.5, repeat: Infinity, ease: "easeInOut" } : undefined}
            >
              {state === "complete" && (
                <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
              {t(phase.labelKey)}
            </motion.div>
            {index < phases.length - 1 && (
              <div
                className={cn(
                  "w-2 h-px mx-0.5",
                  getPhaseState(phases[index + 1].key) !== "pending" ? "bg-success/50" : "bg-border"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
});
