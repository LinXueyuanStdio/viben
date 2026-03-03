/**
 * GitHub Auto-Fix Module
 *
 * Provides GitHub issue auto-fix capabilities:
 * - gh CLI wrapper with timeout and retry
 * - Configuration management (workspace/global)
 * - Issue analysis (heuristic + AI)
 * - Issue triage and clustering
 * - Auto-fix task queue with worktree isolation
 * - Progress tracking via events
 */

// ============================================================================
// Error Handling
// ============================================================================

export {
  // Enums
  GitHubErrorCode,
  // Classes
  GitHubError,
  // Type guards
  isGitHubError,
  isRecoverableError,
  // Factory functions
  ghNotInstalledError,
  ghNotAuthenticatedError,
  taskAlreadyRunningError,
  worktreeConflictError,
  rateLimitError,
} from "./errors";

// ============================================================================
// GH CLI Client
// ============================================================================

export {
  // Types
  type GHIssue,
  type GHComment,
  type GHPR,
  type GHRepoInfo,
  type GHClientConfig,
  type ListIssuesOptions,
  type CreatePROptions,
  // Class
  GHClient,
  // Factory
  createGHClient,
} from "./gh-client";

// ============================================================================
// Configuration
// ============================================================================

export {
  // Types
  type GitHubModelConfig,
  type GitHubModelsConfig,
  type AutoFixConfig,
  type BatchConfig,
  type GitHubAutoFixConfig,
  type AutoFixTaskStatus,
  type AutoFixTask,
  type GitHubTaskState,
  // Path utilities
  getGlobalConfigPath,
  getWorkspaceConfigPath,
  getTaskStatePath,
  getWorktreeBaseDir,
  // Config loading
  loadGitHubConfig,
  saveGitHubConfig,
  // Task state management
  loadTaskState,
  saveTaskState,
  upsertTask,
  updateTaskStatus,
  deleteTask,
  getActiveTaskCount,
  hasActiveTaskForIssue,
} from "./config";

// ============================================================================
// Issue Analysis
// ============================================================================

export {
  // Types
  type IssueType,
  type IssueComplexity,
  type IssueAnalysis,
  type RepoContext,
  // Functions
  analyzeIssue,
  analyzeIssueHeuristic,
  analyzeIssueWithAI,
} from "./analysis";

// ============================================================================
// Issue Triage
// ============================================================================

export {
  // Types
  type IssuePriority,
  type TriageResult,
  type BatchTriageResult,
  // Functions
  triageIssue,
  triageIssues,
  triageIssuesWithAI,
} from "./analysis";

// ============================================================================
// Batch Clustering
// ============================================================================

export {
  // Types
  type IssueCluster,
  type ClusteringResult,
  // Functions
  clusterIssues,
  clusterIssuesWithAI,
} from "./analysis";

// ============================================================================
// Worktree Management
// ============================================================================

export {
  // Types
  type WorktreeInfo,
  type ExecResult,
  type WorktreeManagerOptions,
  // Class
  WorktreeManager,
  // Factory
  createWorktreeManager,
} from "./auto-fix";

// ============================================================================
// Task Queue
// ============================================================================

export {
  // Types
  type TaskQueueEvents,
  type FixPlan,
  type FixStep,
  type FileEdit,
  type FileChange,
  type CreateTaskOptions,
  // Class
  AutoFixTaskQueue,
  // Singleton management
  getTaskQueue,
  removeTaskQueue,
} from "./auto-fix";
