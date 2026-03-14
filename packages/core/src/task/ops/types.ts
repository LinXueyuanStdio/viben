/**
 * Task module type definitions
 *
 * This is the single source of truth for all task-related types.
 * All other modules should import types from here.
 */

import type { TaskEventType } from "../events/event-types";

// Re-export TaskEventType for convenience
export type { TaskEventType } from "../events/event-types";

// =============================================================================
// Priority Types
// =============================================================================

/**
 * Issue priority - unified with @viben/kanban
 * Maps to UI display: urgent (red), high (blue), medium (teal), low (gray), none (muted)
 */
export type IssuePriority = "urgent" | "high" | "medium" | "low" | "none";

/**
 * Priority order for sorting (highest to lowest)
 */
export const PRIORITY_ORDER: IssuePriority[] = ["urgent", "high", "medium", "low", "none"];

/**
 * Default priority for new tasks
 */
export const DEFAULT_PRIORITY: IssuePriority = "medium";

// =============================================================================
// Core Status Types
// =============================================================================

/**
 * Task status - unified state machine (inspired by Auto-Claude)
 *
 * State flow: backlog → queue → in_progress → review → completed
 *
 * Note: paused allows tasks to be paused and resumed later
 * Note: pr_created was removed - PR creation is tracked via pr_url field
 *
 * Terminal states: completed, failed, cancelled
 */
export type TaskStatus =
  | "backlog" // 待办 - Tasks waiting to be started
  | "queue" // Queued for execution
  | "in_progress" // Currently executing (plan or implement)
  | "paused" // Task paused, can be resumed later
  | "review" // Needs review
  | "completed" // Successfully completed
  | "failed" // Execution failed
  | "cancelled" // Cancelled by user
  | "archived"; // Archived for reference

/**
 * Reason for entering review state
 */
export type ReviewReason =
  | "completed" // All subtasks done, QA passed, waiting final approval
  | "errors" // Errors during execution
  | "qa_rejected" // QA found issues
  | "plan_review" // Plan complete, awaiting approval before implement
  | "stopped"; // User manually stopped

/**
 * Subtask status
 */
export type SubtaskStatus = "pending" | "in_progress" | "completed" | "failed";

/**
 * Structured subtask information
 */
export interface SubtaskInfo {
  id: string;
  name: string;
  title?: string;
  status: SubtaskStatus;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Execution phase for running tasks
 */
export type ExecutionPhase = "plan" | "implement" | "check" | "fix" | "complete";

/**
 * Execution progress tracking
 */
export interface ExecutionProgress {
  phase: ExecutionPhase;
  phaseProgress?: number; // 0-100
}

// =============================================================================
// XState State Machine Types (Task State Machine System)
// =============================================================================

/**
 * XState state value type
 * Can be a simple string (top-level state) or nested object (for in_progress substates)
 */
export type XStateValue = string | { in_progress: ExecutionPhase };

/**
 * Task event for state machine transitions
 */
export interface TaskEvent {
  /** Unique event identifier (UUID) */
  eventId: string;
  /** Monotonically increasing sequence number for ordering */
  sequence: number;
  /** Event type - determines the state transition */
  type: TaskEventType;
  /** ISO timestamp when event was created */
  timestamp: string;
  /** Optional payload data for the event */
  payload?: Record<string, unknown>;
}

// =============================================================================
// Extended Metadata Types (Task State Machine System)
// =============================================================================

/**
 * Task source information
 */
export interface TaskSource {
  type: "manual" | "github_issue" | "linear" | "ideation";
  ref?: string;
  importedAt?: string;
}

/**
 * Task classification for prioritization
 */
export interface TaskClassification {
  category: "feature" | "bugfix" | "refactor" | "docs";
  complexity: "low" | "medium" | "high";
  impact: "low" | "medium" | "high";
  priority: IssuePriority;
}

/**
 * Agent configuration for task execution
 */
export interface AgentConfig {
  model?: string;
  thinkingLevel?: "low" | "medium" | "high";
  maxRetries?: number;
}

/**
 * Git configuration for task
 */
export interface GitConfig {
  baseBranch?: string;
  branchPrefix?: string;
  useWorktree?: boolean;
}

/**
 * Extended metadata for task state machine
 */
export interface TaskMetadata {
  source?: TaskSource;
  classification?: TaskClassification;
  agentConfig?: AgentConfig;
  gitConfig?: GitConfig;
}

// =============================================================================
// Unified Task Interface
// =============================================================================

/**
 * Unified Task interface - combines CLI and Gateway task schemas
 */
export interface UnifiedTask {
  // === Core Identity ===
  /** Unique task ID */
  id: string;
  /** URL-safe slug (used in directory name) */
  name: string;
  /** Human-readable title */
  title: string;
  /** Detailed description */
  description?: string;

  // === Status Tracking (Auto-Claude state machine) ===
  /** Primary status */
  status: TaskStatus;
  /** Reason for entering review */
  reviewReason?: ReviewReason;
  /** Current phase number (CLI phase system) */
  current_phase?: number;
  /** Next actions by phase */
  next_action?: Array<{ phase: number; action: string }>;

  // === Organization/Classification ===
  /** Priority level */
  priority: IssuePriority;

  // === People ===
  /** Task creator */
  creator?: string;
  /** Task assignee */
  assignee?: string;

  // === Git Integration ===
  /** Feature branch name */
  branch?: string;
  /** Base branch for PR */
  base_branch?: string;
  /** Git worktree path */
  worktree_path?: string;
  /** Commit hash */
  commit?: string;
  /** PR URL */
  pr_url?: string;

  // === Context (CLI) ===
  /** Subtask names (legacy string array) */
  subtasks?: string[];
  /** Structured subtask details */
  subtaskDetails?: SubtaskInfo[];
  /** Execution progress tracking */
  executionProgress?: ExecutionProgress;
  /** Related file paths */
  relatedFiles?: string[];
  /** Free-form notes */
  notes?: string;

  // === Agent/Session Integration (Gateway) ===
  /** Associated agent ID */
  agent?: string;
  /** Session ID */
  sessionId?: string;
  /** Model ID for task execution */
  model?: string;
  /** Task index within session */
  taskIndex?: number;
  /** User prompt */
  prompt?: string;

  // === Execution Tracking (Gateway) ===
  /** API cost in USD */
  cost?: number;
  /** Execution duration in ms */
  duration?: number;
  /** Whether task is favorited */
  favorite?: boolean;
  /** Has in-progress attempt (kanban display) */
  hasInProgressAttempt?: boolean;
  /** Last attempt failed (kanban display) */
  lastAttemptFailed?: boolean;
  /** Executor name */
  executor?: string;

  // === Workspace ===
  /** Workspace path (absolute) */
  workspacePath?: string;

  // === Timestamps ===
  /** Creation timestamp */
  createdAt: string;
  /** Last update timestamp */
  updatedAt?: string;
  /** Completion timestamp */
  completedAt?: string;

  // === XState State Machine (Task State Machine System) ===
  /** XState state machine current state */
  xstateState?: XStateValue;
  /** Last event that was applied (kept for quick access to latest state) */
  lastEvent?: TaskEvent;
  /**
   * @deprecated Event history is now stored in events.jsonl file.
   * Use TaskEventStore.getEventHistory() to read events.
   * This field is kept for backward compatibility during migration.
   */
  eventHistory?: TaskEvent[];
  /** Extended metadata for classification and configuration */
  metadata?: TaskMetadata;

  // === Task Relationships (Task Dependency System) ===
  /** Task IDs this task depends on - task can only start when all dependencies are completed */
  dependsOn?: string[];
  /** Parent task ID (used for task splitting) */
  parentTaskId?: string;
  /** Child task IDs (reverse reference for task splitting) */
  childTaskIds?: string[];

  // === Scheduling Information ===
  /** Queue entry timestamp (ISO string) - used for FIFO sorting within same priority */
  queuedAt?: string;
  /** Auto-start agent when enqueued */
  autoStart?: boolean;
  /** Run agent in a git worktree (isolated branch) */
  worktree?: boolean;
  /** Queue system task ID (when task is submitted to command queue) */
  queue_id?: string;

  // === Template Support ===
  /** Whether this task is a template for creating other tasks */
  is_template?: boolean;

  // === State Machine Context Persistence ===
  /**
   * Persisted state machine context for pause/resume across restarts.
   * Contains currentSubtaskIndex, paused_snapshot, etc.
   */
  machine_context?: {
    /** Current subtask index (0-based) */
    current_subtask_index: number;
    /** Whether plan requires review before implement */
    requires_plan_review: boolean;
    /** Complete snapshot saved when task is paused */
    paused_snapshot?: {
      from_state: string | { in_progress: string };
      subtask_index: number;
      execution_context?: Record<string, unknown>;
      paused_at: string;
    };
  };
}

// =============================================================================
// Status Constants
// =============================================================================

/**
 * All valid unified task statuses
 */
export const VALID_TASK_STATUSES: TaskStatus[] = [
  "backlog",
  "queue",
  "in_progress",
  "paused",
  "review",
  "completed",
  "failed",
  "cancelled",
  "archived",
];

/**
 * Check if a status is valid
 */
export function isValidTaskStatus(status: string): status is TaskStatus {
  return VALID_TASK_STATUSES.includes(status as TaskStatus);
}

// =============================================================================
// Task Specs Types
// =============================================================================

/**
 * Log entry type
 */
export type TaskLogEntryType =
  | "text"
  | "error"
  | "warning"
  | "success"
  | "info"
  | "tool_start"
  | "tool_end";

/**
 * A single log entry
 */
export interface TaskLogEntry {
  id: string;
  type: TaskLogEntryType;
  message: string;
  timestamp: string;
  details?: string;
}

/**
 * Log phase status
 */
export type TaskLogPhaseStatus = "pending" | "running" | "complete" | "failed";

/**
 * A log phase (plan, implement, check)
 */
export interface TaskLogPhase {
  id: string;
  name: string;
  status: TaskLogPhaseStatus;
  entries: TaskLogEntry[];
  order?: number;
}

/**
 * Task logs structure
 */
export interface TaskLogs {
  phases: TaskLogPhase[];
}

/**
 * Implementation plan subtask (from file)
 */
export interface ImplementationPlanSubtask {
  id: string;
  title: string;
  description?: string;
  status: SubtaskStatus;
  files?: string[];
  order?: number;
}

/**
 * Implementation plan file structure
 */
export interface ImplementationPlanFile {
  version?: string;
  task_id?: string;
  subtasks: ImplementationPlanSubtask[];
  created_at?: string;
  updated_at?: string;
}

// =============================================================================
// Implementation Plan V2 Types (Extended for Task State Machine)
// =============================================================================

/**
 * Extended subtask with verification support
 */
export interface ImplementationPlanSubtaskV2 extends ImplementationPlanSubtask {
  /** Verification configuration for the subtask */
  verification?: {
    /** Type of verification to run */
    type: "command" | "browser";
    /** Command to run for verification (if type is 'command') */
    run?: string;
    /** Browser scenario for verification (if type is 'browser') */
    scenario?: string;
  };
}

/**
 * Phase definition for structured implementation plans
 */
export interface ImplementationPhase {
  /** Phase ID (sequential number) */
  id: number;
  /** Human-readable phase name */
  name: string;
  /** Phase type for categorization */
  type: "plan" | "implement" | "check";
  /** Subtasks within this phase */
  subtasks: ImplementationPlanSubtaskV2[];
}

/**
 * Progress tracking for implementation plans
 */
export interface ImplementationProgress {
  /** Number of completed subtasks */
  completedSubtasks: number;
  /** Total number of subtasks */
  totalSubtasks: number;
  /** Completion percentage (0-100) */
  percentage: number;
}

/**
 * Extended implementation plan with phases and verification support
 *
 * This V2 format supports:
 * - Structured phases (plan, implement, check)
 * - Subtask-level verification
 * - Progress tracking
 */
export interface ImplementationPlanFileV2 extends ImplementationPlanFile {
  /** Structured phases (optional, for advanced workflows) */
  phases?: ImplementationPhase[];
  /** Current active phase index */
  currentPhase?: number;
  /** Computed progress (can be derived from subtasks) */
  progress?: ImplementationProgress;
}

/**
 * Task specs data returned by getTaskSpecsData
 */
export interface TaskSpecsData {
  prdContent: string | null;
  prdPath: string | null;
  subtasks: ImplementationPlanSubtask[];
  logs: TaskLogs | null;
  taskDir: string; // Task directory path for file browsing
}

// =============================================================================
// Task JSON Alias (for backward compatibility with task/ops modules)
// =============================================================================

/**
 * Task JSON format stored in .viben/tasks/<date>-<slug>/task.json
 * This is compatible with UnifiedTask
 */
export type TaskJson = UnifiedTask;

// =============================================================================
// Context and Display Types (used by task/ops modules)
// =============================================================================

/**
 * Context entry in jsonl files (implement.jsonl, check.jsonl, fix.jsonl)
 */
export interface ContextEntry {
  file: string;
  reason: string;
  type?: "file" | "directory";
}

/**
 * Status summary filter options
 */
export interface StatusSummaryOptions {
  filterAssignee?: string;
  filterStatus?: string;
  onlyRunning?: boolean;
}

/**
 * Running task info for status display
 */
export interface RunningTaskInfo {
  name: string;
  priority: string;
  assignee: string;
  phaseInfo: string;
  elapsed: string;
  branch: string;
  modified: number;
  lastTool: string | null;
  pid: number;
}

/**
 * Stopped task info for status display
 */
export interface StoppedTaskInfo {
  name: string;
  worktree: string;
  status: string;
  taskDir: string;
  logFile: string;
  platform: string;
}

/**
 * Regular task info for status display
 */
export interface RegularTaskInfo {
  name: string;
  status: string;
  priority: string;
  assignee: string;
}

/**
 * Context JSON structure matching Python git_context.py get_context_json()
 */
export interface ContextJson {
  developer: string;
  git: {
    branch: string;
    isClean: boolean;
    uncommittedChanges: number;
    recentCommits: Array<{ hash: string; message: string }>;
  };
  currentTask: {
    path: string;
    name: string;
    status: string;
    createdAt: string;
    description: string;
    hasPrd: boolean;
  } | null;
  tasks: {
    active: Array<{
      dir: string;
      name: string;
      status: string;
      assignee: string;
      priority: string;
    }>;
    directory: string;
  };
  myTasks: Array<{
    title: string;
    priority: string;
    status: string;
  }>;
  journal: {
    file: string;
    lines: number;
    nearLimit: boolean;
  };
  paths: {
    workspace: string;
    tasks: string;
    spec: string;
  };
}

/**
 * Session markdown generation parameters
 */
export interface SessionMarkdownParams {
  sessionNum: number;
  title: string;
  commit: string;
  summary: string;
  extraContent: string;
  date: string;
}

/**
 * Index update parameters for add-session
 */
export interface IndexUpdateParams {
  indexPath: string;
  devDir: string;
  sessionNum: number;
  title: string;
  commit: string;
  activeFile: string;
  date: string;
}

/**
 * Journal file info
 */
export interface JournalFileInfo {
  file: string | null;
  number: number;
  lines: number;
}
