/**
 * GitHub Issue Analysis Module
 *
 * Provides AI-powered and heuristic analysis of GitHub issues:
 * - Deep issue analysis
 * - Batch triage
 * - Semantic clustering
 */

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
} from "./issue-analyzer";

export {
  // Types
  type IssuePriority,
  type TriageResult,
  type BatchTriageResult,
  // Functions
  triageIssue,
  triageIssues,
  triageIssuesWithAI,
} from "./issue-triager";

export {
  // Types
  type IssueCluster,
  type ClusteringResult,
  // Functions
  clusterIssues,
  clusterIssuesWithAI,
} from "./batch-cluster";
