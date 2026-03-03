/**
 * GitHub Service Module
 *
 * Provides GitHub integration services for Viben workspaces:
 * - Authentication (gh CLI + PAT)
 * - Repository management
 * - Issue operations
 * - Pull request operations
 * - Release management
 * - Issue investigation and spec generation
 */

// ============================================================================
// Authentication Service
// ============================================================================

export {
  // gh CLI detection
  isGhCliInstalled,
  isGhCliLoggedIn,
  getGhCliToken,
  // OAuth flow
  startGhCliOAuth,
  completeGhCliOAuth,
  pollGhCliOAuthCompletion,
  type OAuthDeviceFlowState,
  // PAT authentication
  verifyPAT,
  // Auth management
  getAuthStatus,
  authenticateWithGhCli,
  authenticateWithPAT,
  signOut,
  getAccessToken,
  requireAuth,
} from "./auth";

// ============================================================================
// Repository Service
// ============================================================================

export {
  // Repository listing
  listRepositories,
  getRepository,
  // Repository detection
  detectRepository,
  detectAndFetchRepository,
  // Repository connection
  connectRepository,
  disconnectRepository,
  getConnectedRepository,
  // Branches and tags
  listBranches,
  listTags,
} from "./repository";

// ============================================================================
// Issues Service
// ============================================================================

export {
  // Issue operations
  listIssues,
  getIssue,
  getIssueComments,
  getIssueWithComments,
  // Labels and milestones
  listLabels,
  listMilestones,
} from "./issues";

// ============================================================================
// Pull Requests Service
// ============================================================================

export {
  // PR operations
  listPullRequests,
  getPullRequest,
  createPullRequest,
  // PR details
  getPullRequestDiff,
  listPullRequestCommits,
  listPullRequestFiles,
} from "./pull-requests";

// ============================================================================
// Releases Service
// ============================================================================

export {
  // Release operations
  listReleases,
  getRelease,
  getReleaseByTag,
  getLatestRelease,
  createRelease,
  generateReleaseNotes,
} from "./releases";

// ============================================================================
// Investigation Service
// ============================================================================

export {
  investigateIssue,
  investigateIssues,
} from "./investigation";

// ============================================================================
// Import Service
// ============================================================================

export {
  importIssues,
  importAllOpenIssues,
  type ImportResult,
} from "./import";

// ============================================================================
// Utility Functions
// ============================================================================

export {
  // Configuration
  readGitHubConfig,
  writeGitHubConfig,
  updateGitHubAuth,
  clearGitHubAuth,
  updateGitHubRepository,
  clearGitHubRepository,
  updateGitHubPreferences,
  // Paths
  getGitHubConfigPath,
  getWorkspacesDir,
  getSpecsDir,
  getIssueSpecsDir,
  getIssueSpecPath,
  generateWorkspaceId,
  // API helpers
  githubRequest,
  isGitHubAPIError,
  isRateLimitError,
  isAuthError,
  isNotFoundError,
  parseGitHubRemoteUrl,
  ensureSpecsDir,
  // Constants
  GITHUB_CONFIG_FILE,
  GITHUB_API_BASE,
  SPECS_DIR,
  ISSUES_SPECS_DIR,
  // Types
  type GitHubRequestOptions,
  type GitHubResponse,
} from "./utils";

// Re-export requireRepository from repository module for convenience
export { requireRepository } from "./repository";
