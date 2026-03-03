/**
 * GitHub Store
 *
 * Zustand store for GitHub Issues management state.
 * Handles issue list, selection, AI analysis, and auto-fix queue.
 */

import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type {
  GitHubIssue,
  GitHubIssueInvestigation,
  GitHubRepositoryConfig,
} from "@viben/core";

// ============================================================================
// Types
// ============================================================================

/**
 * Issue analysis result with extended metadata
 */
export interface IssueAnalysis {
  issueNumber: number;
  type: "bug" | "feature" | "enhancement" | "docs" | "refactor";
  complexity: "trivial" | "low" | "medium" | "high" | "critical";
  summary: string;
  requirements: string[];
  acceptanceCriteria: string[];
  affectedAreas: string[];
  suggestedLabels: string[];
  estimatedFiles: string[];
  risks: string[];
  // Original investigation data
  investigation?: GitHubIssueInvestigation;
}

/**
 * Auto-fix task status (matches core package AutoFixTaskStatus)
 */
export type AutoFixTaskStatus =
  | "queued"
  | "analyzing"
  | "planning"
  | "executing"
  | "testing"
  | "awaiting_approval"
  | "creating_pr"
  | "completed"
  | "failed"
  | "cancelled";

/**
 * Auto-fix task (uses snake_case to match core package)
 */
export interface AutoFixTask {
  id: string;
  workspace_path: string;
  issue_numbers: number[];
  status: AutoFixTaskStatus;
  worktree_path?: string;
  branch_name?: string;
  analysis?: IssueAnalysis;
  pr_number?: number;
  error?: string;
  progress?: number;
  progress_message?: string;
  created_at: string;
  updated_at: string;
}

/**
 * GitHub configuration
 */
export interface GitHubConfig {
  autoFixLabels: string[];
  requireHumanApproval: boolean;
  maxParallelTasks: number;
}

/**
 * Issue filters
 */
export interface IssueFilters {
  state: "open" | "closed" | "all";
  labels: string[];
  search: string;
}

/**
 * Authentication status
 */
export type GitHubAuthStatus =
  | "checking"
  | "authenticated"
  | "not_authenticated";

// ============================================================================
// State Interface
// ============================================================================

interface GitHubState {
  // Issue list
  issues: GitHubIssue[];
  issuesLoading: boolean;
  issuesError: string | null;
  hasMore: boolean;
  page: number;
  filters: IssueFilters;

  // Current selection
  selectedIssueNumbers: Set<number>;
  currentIssue: GitHubIssue | null;
  currentAnalysis: IssueAnalysis | null;
  analysisLoading: boolean;

  // Auto-fix queue
  autoFixTasks: AutoFixTask[];
  autoFixWsConnected: boolean;

  // Configuration
  config: GitHubConfig | null;

  // Repository info
  repoInfo: GitHubRepositoryConfig | null;
  authStatus: GitHubAuthStatus;

  // Initialization
  initialized: boolean;
}

interface GitHubActions {
  // Issue list operations
  setIssues: (issues: GitHubIssue[]) => void;
  appendIssues: (issues: GitHubIssue[]) => void;
  setIssuesLoading: (loading: boolean) => void;
  setIssuesError: (error: string | null) => void;
  setHasMore: (hasMore: boolean) => void;
  setPage: (page: number) => void;
  setFilters: (filters: Partial<IssueFilters>) => void;
  resetFilters: () => void;

  // Selection operations
  selectIssue: (issue: GitHubIssue | null) => void;
  toggleIssueSelection: (issueNumber: number) => void;
  selectAllIssues: () => void;
  clearSelection: () => void;
  getSelectedIssueNumbers: () => number[];

  // Analysis operations
  setCurrentAnalysis: (analysis: IssueAnalysis | null) => void;
  setAnalysisLoading: (loading: boolean) => void;

  // Auto-fix operations
  addAutoFixTask: (task: AutoFixTask) => void;
  updateAutoFixTask: (taskId: string, updates: Partial<AutoFixTask>) => void;
  removeAutoFixTask: (taskId: string) => void;
  setAutoFixWsConnected: (connected: boolean) => void;
  getRunningTasksCount: () => number;
  getAwaitingApprovalCount: () => number;

  // Configuration
  setConfig: (config: GitHubConfig | null) => void;

  // Repository and auth
  setRepoInfo: (repoInfo: GitHubRepositoryConfig | null) => void;
  setAuthStatus: (status: GitHubAuthStatus) => void;

  // Initialization
  setInitialized: (initialized: boolean) => void;
  reset: () => void;
}

// ============================================================================
// Default Values
// ============================================================================

const defaultFilters: IssueFilters = {
  state: "open",
  labels: [],
  search: "",
};

const defaultConfig: GitHubConfig = {
  autoFixLabels: ["auto-fix", "good-first-issue"],
  requireHumanApproval: true,
  maxParallelTasks: 3,
};

// ============================================================================
// Store Implementation
// ============================================================================

export const useGitHubStore = create<GitHubState & GitHubActions>()(
  devtools(
    (set, get) => ({
      // Initial state
      issues: [],
      issuesLoading: false,
      issuesError: null,
      hasMore: false,
      page: 1,
      filters: { ...defaultFilters },

      selectedIssueNumbers: new Set(),
      currentIssue: null,
      currentAnalysis: null,
      analysisLoading: false,

      autoFixTasks: [],
      autoFixWsConnected: false,

      config: defaultConfig,

      repoInfo: null,
      authStatus: "checking",

      initialized: false,

      // Issue list operations
      setIssues: (issues) => set({ issues, page: 1 }),

      appendIssues: (issues) =>
        set((state) => ({
          issues: [...state.issues, ...issues],
        })),

      setIssuesLoading: (loading) => set({ issuesLoading: loading }),

      setIssuesError: (error) => set({ issuesError: error }),

      setHasMore: (hasMore) => set({ hasMore }),

      setPage: (page) => set({ page }),

      setFilters: (filters) =>
        set((state) => ({
          filters: { ...state.filters, ...filters },
          // Reset pagination when filters change
          page: 1,
          issues: [],
        })),

      resetFilters: () =>
        set({
          filters: { ...defaultFilters },
          page: 1,
          issues: [],
        }),

      // Selection operations
      selectIssue: (issue) =>
        set({
          currentIssue: issue,
          currentAnalysis: null,
        }),

      toggleIssueSelection: (issueNumber) =>
        set((state) => {
          const newSelection = new Set(state.selectedIssueNumbers);
          if (newSelection.has(issueNumber)) {
            newSelection.delete(issueNumber);
          } else {
            newSelection.add(issueNumber);
          }
          return { selectedIssueNumbers: newSelection };
        }),

      selectAllIssues: () =>
        set((state) => ({
          selectedIssueNumbers: new Set(state.issues.map((i) => i.number)),
        })),

      clearSelection: () => set({ selectedIssueNumbers: new Set() }),

      getSelectedIssueNumbers: () => Array.from(get().selectedIssueNumbers),

      // Analysis operations
      setCurrentAnalysis: (analysis) => set({ currentAnalysis: analysis }),

      setAnalysisLoading: (loading) => set({ analysisLoading: loading }),

      // Auto-fix operations
      addAutoFixTask: (task) =>
        set((state) => ({
          autoFixTasks: [...state.autoFixTasks, task],
        })),

      updateAutoFixTask: (taskId, updates) =>
        set((state) => ({
          autoFixTasks: state.autoFixTasks.map((t) =>
            t.id === taskId ? { ...t, ...updates, updated_at: new Date().toISOString() } : t
          ),
        })),

      removeAutoFixTask: (taskId) =>
        set((state) => ({
          autoFixTasks: state.autoFixTasks.filter((t) => t.id !== taskId),
        })),

      setAutoFixWsConnected: (connected) =>
        set({ autoFixWsConnected: connected }),

      getRunningTasksCount: () =>
        get().autoFixTasks.filter((t) =>
          ["queued", "analyzing", "planning", "executing", "testing"].includes(t.status)
        ).length,

      getAwaitingApprovalCount: () =>
        get().autoFixTasks.filter((t) => t.status === "awaiting_approval").length,

      // Configuration
      setConfig: (config) => set({ config }),

      // Repository and auth
      setRepoInfo: (repoInfo) => set({ repoInfo }),

      setAuthStatus: (status) => set({ authStatus: status }),

      // Initialization
      setInitialized: (initialized) => set({ initialized }),

      reset: () =>
        set({
          issues: [],
          issuesLoading: false,
          issuesError: null,
          hasMore: false,
          page: 1,
          filters: { ...defaultFilters },
          selectedIssueNumbers: new Set(),
          currentIssue: null,
          currentAnalysis: null,
          analysisLoading: false,
          autoFixTasks: [],
          autoFixWsConnected: false,
          config: defaultConfig,
          repoInfo: null,
          authStatus: "checking",
          initialized: false,
        }),
    }),
    { name: "github-store" }
  )
);
