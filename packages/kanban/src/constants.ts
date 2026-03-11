/**
 * Task-related constants for kanban cards
 * Based on Auto-Claude style task metadata
 */

// ============================================
// Execution Phases
// ============================================

export type ExecutionPhase =
  | "idle"
  | "plan"
  | "implement"
  | "rate_limit_paused"
  | "auth_failure_paused"
  | "check"
  | "fix"
  | "complete"
  | "failed";

export const EXECUTION_PHASE_LABELS: Record<ExecutionPhase, string> = {
  idle: "Idle",
  plan: "Planning",
  implement: "Implementing",
  rate_limit_paused: "Rate Limited",
  auth_failure_paused: "Auth Required",
  check: "AI Review",
  fix: "Fixing Issues",
  complete: "Complete",
  failed: "Failed",
};

export const EXECUTION_PHASE_BADGE_COLORS: Record<ExecutionPhase, string> = {
  idle: "bg-muted/50 text-muted-foreground border-muted",
  plan: "bg-amber-500/10 text-amber-500 border-amber-500/30",
  implement: "bg-info/10 text-info border-info/30",
  rate_limit_paused: "bg-orange-500/10 text-orange-400 border-orange-500/30",
  auth_failure_paused: "bg-red-500/10 text-red-400 border-red-500/30",
  check: "bg-purple-500/10 text-purple-400 border-purple-500/30",
  fix: "bg-warning/10 text-warning border-warning/30",
  complete: "bg-success/10 text-success border-success/30",
  failed: "bg-destructive/10 text-destructive border-destructive/30",
};

// ============================================
// Task Categories
// ============================================

export type TaskCategory =
  | "feature"
  | "bug_fix"
  | "refactoring"
  | "documentation"
  | "security"
  | "performance"
  | "ui_ux"
  | "infrastructure"
  | "testing";

export const TASK_CATEGORY_LABELS: Record<TaskCategory, string> = {
  feature: "Feature",
  bug_fix: "Bug Fix",
  refactoring: "Refactoring",
  documentation: "Docs",
  security: "Security",
  performance: "Performance",
  ui_ux: "UI/UX",
  infrastructure: "Infrastructure",
  testing: "Testing",
};

export const TASK_CATEGORY_COLORS: Record<TaskCategory, string> = {
  feature: "bg-primary/10 text-primary border-primary/30",
  bug_fix: "bg-destructive/10 text-destructive border-destructive/30",
  refactoring: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
  documentation: "bg-amber-500/10 text-amber-500 border-amber-500/30",
  security: "bg-red-500/10 text-red-400 border-red-500/30",
  performance: "bg-purple-500/10 text-purple-400 border-purple-500/30",
  ui_ux: "bg-info/10 text-info border-info/30",
  infrastructure: "bg-slate-500/10 text-slate-400 border-slate-500/30",
  testing: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
};

// Category icons mapping (Lucide icon names)
export const TASK_CATEGORY_ICONS: Record<TaskCategory, string> = {
  feature: "Target",
  bug_fix: "Bug",
  refactoring: "Wrench",
  documentation: "FileText",
  security: "Shield",
  performance: "Gauge",
  ui_ux: "Palette",
  infrastructure: "Server",
  testing: "TestTube",
};

// ============================================
// Task Complexity
// ============================================

export type TaskComplexity =
  | "trivial"
  | "small"
  | "medium"
  | "large"
  | "complex";

export const TASK_COMPLEXITY_LABELS: Record<TaskComplexity, string> = {
  trivial: "Trivial",
  small: "Small",
  medium: "Medium",
  large: "Large",
  complex: "Complex",
};

export const TASK_COMPLEXITY_COLORS: Record<TaskComplexity, string> = {
  trivial: "bg-success/10 text-success border-success/30",
  small: "bg-info/10 text-info border-info/30",
  medium: "bg-warning/10 text-warning border-warning/30",
  large: "bg-orange-500/10 text-orange-400 border-orange-500/30",
  complex: "bg-destructive/10 text-destructive border-destructive/30",
};

// ============================================
// Task Impact
// ============================================

export type TaskImpact = "low" | "medium" | "high" | "critical";

export const TASK_IMPACT_LABELS: Record<TaskImpact, string> = {
  low: "Low Impact",
  medium: "Medium Impact",
  high: "High Impact",
  critical: "Critical Impact",
};

export const TASK_IMPACT_COLORS: Record<TaskImpact, string> = {
  low: "bg-muted text-muted-foreground border-muted",
  medium: "bg-info/10 text-info border-info/30",
  high: "bg-warning/10 text-warning border-warning/30",
  critical: "bg-destructive/10 text-destructive border-destructive/30",
};

// ============================================
// Review Reasons
// ============================================

export type ReviewReason =
  | "completed"
  | "errors"
  | "qa_rejected"
  | "plan_review"
  | "stopped";

export const REVIEW_REASON_LABELS: Record<ReviewReason, string> = {
  completed: "Completed",
  errors: "Has Errors",
  qa_rejected: "QA Issues",
  plan_review: "Approve Plan",
  stopped: "Stopped",
};

export const REVIEW_REASON_COLORS: Record<
  ReviewReason,
  { variant: "success" | "destructive" | "warning"; className: string }
> = {
  completed: {
    variant: "success",
    className: "bg-success/10 text-success border-success/30",
  },
  errors: {
    variant: "destructive",
    className: "bg-destructive/10 text-destructive border-destructive/30",
  },
  qa_rejected: {
    variant: "warning",
    className: "bg-warning/10 text-warning border-warning/30",
  },
  plan_review: {
    variant: "warning",
    className: "bg-warning/10 text-warning border-warning/30",
  },
  stopped: {
    variant: "warning",
    className: "bg-orange-500/10 text-orange-400 border-orange-500/30",
  },
};
