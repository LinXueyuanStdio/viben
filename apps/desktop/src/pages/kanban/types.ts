import type {
  TaskWithAttemptStatus,
  ExecutionPhase as VibeExecutionPhase,
  ReviewReason as VibeReviewReason,
  KanbanColumnId,
} from "@/lib/kanban";
import type {
  Tag,
  Assignee,
  TaskCategory,
  TaskComplexity,
  TaskImpact,
} from "@viben/kanban";

// Kanban column IDs - 9-column layout
// backlog → queue → in_progress → paused → review → completed → failed → cancelled → archived
export type ColumnId = KanbanColumnId;

// Extended task type to support new fields (Auto-Claude style)
// TaskWithAttemptStatus already includes: execution_phase, is_stuck, stuck_duration, archived
// Task already includes: review_reason, pr_url, priority (now IssuePriority type)
export interface EnhancedTask extends TaskWithAttemptStatus {
  // Core kanban fields (extended for UI display)
  // Note: priority field is now IssuePriority type from API, no mapping needed
  tags?: Tag[];
  kanbanAssignee?: Assignee;  // UI assignee type
  dueDate?: string;
  // Execution metadata (using mapped names for consistency)
  executionPhase?: VibeExecutionPhase;  // alias for execution_phase
  category?: TaskCategory;
  complexity?: TaskComplexity;
  impact?: TaskImpact;
  isStuck?: boolean;  // alias for is_stuck
  reviewReason?: VibeReviewReason;  // alias for review_reason
  prUrl?: string;  // alias for pr_url
  archivedAt?: string;  // computed from archived
}

// Task Card Content Component props
export interface TaskCardContentProps {
  task: EnhancedTask;
  onTitleChange?: (title: string) => void;
  onStart?: () => void;
  onStop?: () => void;
  onRecover?: () => void;
  onResume?: () => void;
  onApprove?: () => void;
  onReject?: () => void;
  onViewPR?: () => void;
  onArchive?: () => void;
  isSelected?: boolean;
}

// Task Card with stuck detection props
export interface TaskCardWithStuckDetectionProps {
  task: EnhancedTask;
  index: number;
  columnId: string;
  workspacePath: string;
  isSelected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  showMoreMenu?: boolean;
  renderMoreMenu?: (onOpenChange?: (open: boolean) => void) => React.ReactNode;
}

// List View Item with stuck detection props
export interface ListViewItemWithStuckDetectionProps {
  task: EnhancedTask;
  workspacePath: string;
  isSelected: boolean;
  onClick: () => void;
  renderStatus?: (task: EnhancedTask) => React.ReactNode;
  children: React.ReactNode;
}
