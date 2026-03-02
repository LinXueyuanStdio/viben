/**
 * GitHub Gateway Routes
 *
 * API endpoints for GitHub integration:
 * - Authentication (gh CLI + PAT)
 * - Repository management
 * - Issues
 * - Pull requests
 * - Releases
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import * as github from "../../services/github";
import type {
  GitHubAuthStatusResponse,
  GitHubUser,
  GitHubRepository,
  GitHubRepositoryConfig,
  GitHubIssue,
  GitHubPullRequest,
  GitHubRelease,
  GitHubPaginatedResponse,
  GitHubIssueInvestigation,
  GitHubListIssuesParams,
  GitHubListPRsParams,
  GitHubListReleasesParams,
} from "../../types/github";

// ============================================================================
// Request/Response Types
// ============================================================================

interface WorkspacePathQuery {
  workspace_path: string;
}

interface PATRequestBody {
  token: string;
}

interface ConnectRepoBody {
  owner: string;
  name: string;
}

interface CreatePRBody {
  title: string;
  body?: string;
  head: string;
  base: string;
  draft?: boolean;
}

interface CreateReleaseBody {
  tag_name: string;
  name?: string;
  body?: string;
  draft?: boolean;
  prerelease?: boolean;
  target_commitish?: string;
}

interface InvestigateBody {
  save_spec?: boolean;
}

interface ImportIssuesBody {
  issue_numbers: number[];
}

interface IssueParams {
  number: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

function requireWorkspacePath(
  request: FastifyRequest<{ Querystring: WorkspacePathQuery }>,
  reply: FastifyReply
): string | null {
  const workspacePath = request.query.workspace_path;
  if (!workspacePath) {
    reply.code(400).send({ error: "workspace_path is required" });
    return null;
  }
  return workspacePath;
}

// ============================================================================
// Route Registration
// ============================================================================

export function registerGitHubRoutes(fastify: FastifyInstance): void {
  // ---------------------------------------------------------------------------
  // Authentication Routes
  // ---------------------------------------------------------------------------

  /**
   * GET /api/github/auth/status
   * Get current authentication status
   */
  fastify.get<{
    Querystring: WorkspacePathQuery;
    Reply: GitHubAuthStatusResponse | { error: string };
  }>("/api/github/auth/status", async (request, reply) => {
    const workspacePath = requireWorkspacePath(request, reply);
    if (!workspacePath) return;

    try {
      const status = await github.getAuthStatus(workspacePath);
      return status;
    } catch (error) {
      console.error("[GitHub] Auth status error:", error);
      return reply.code(500).send({
        error: error instanceof Error ? error.message : "Failed to get auth status",
      });
    }
  });

  /**
   * POST /api/github/auth/gh-cli
   * Authenticate using gh CLI
   */
  fastify.post<{
    Querystring: WorkspacePathQuery;
    Reply: { user: GitHubUser } | { error: string };
  }>("/api/github/auth/gh-cli", async (request, reply) => {
    const workspacePath = requireWorkspacePath(request, reply);
    if (!workspacePath) return;

    try {
      const user = await github.authenticateWithGhCli(workspacePath);
      return { user };
    } catch (error) {
      console.error("[GitHub] gh-cli auth error:", error);
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Failed to authenticate with gh CLI",
      });
    }
  });

  /**
   * POST /api/github/auth/pat
   * Authenticate using Personal Access Token
   */
  fastify.post<{
    Querystring: WorkspacePathQuery;
    Body: PATRequestBody;
    Reply: { user: GitHubUser } | { error: string };
  }>("/api/github/auth/pat", async (request, reply) => {
    const workspacePath = requireWorkspacePath(request, reply);
    if (!workspacePath) return;

    const { token } = request.body;
    if (!token) {
      return reply.code(400).send({ error: "token is required" });
    }

    try {
      const user = await github.authenticateWithPAT(workspacePath, token);
      return { user };
    } catch (error) {
      reply.code(400).send({
        error: error instanceof Error ? error.message : "Failed to authenticate with PAT",
      });
    }
  });

  /**
   * DELETE /api/github/auth
   * Sign out from GitHub
   */
  fastify.delete<{
    Querystring: WorkspacePathQuery;
    Reply: { success: boolean } | { error: string };
  }>("/api/github/auth", async (request, reply) => {
    const workspacePath = requireWorkspacePath(request, reply);
    if (!workspacePath) return;

    try {
      await github.signOut(workspacePath);
      return { success: true };
    } catch (error) {
      reply.code(500).send({
        error: error instanceof Error ? error.message : "Failed to sign out",
      });
    }
  });

  // ---------------------------------------------------------------------------
  // Repository Routes
  // ---------------------------------------------------------------------------

  /**
   * GET /api/github/repos
   * List repositories accessible by the user
   */
  fastify.get<{
    Querystring: WorkspacePathQuery & { page?: string; per_page?: string };
    Reply: GitHubPaginatedResponse<GitHubRepository> | { error: string };
  }>("/api/github/repos", async (request, reply) => {
    const workspacePath = requireWorkspacePath(request, reply);
    if (!workspacePath) return;

    try {
      const page = parseInt(request.query.page || "1", 10);
      const perPage = parseInt(request.query.per_page || "30", 10);
      const repos = await github.listRepositories(workspacePath, page, perPage);
      return repos;
    } catch (error) {
      reply.code(500).send({
        error: error instanceof Error ? error.message : "Failed to list repositories",
      });
    }
  });

  /**
   * GET /api/github/repos/detect
   * Detect repository from workspace .git directory
   */
  fastify.get<{
    Querystring: WorkspacePathQuery;
    Reply: { repository: GitHubRepository | null } | { error: string };
  }>("/api/github/repos/detect", async (request, reply) => {
    const workspacePath = requireWorkspacePath(request, reply);
    if (!workspacePath) return;

    try {
      const repository = await github.detectAndFetchRepository(workspacePath);
      return { repository };
    } catch (error) {
      reply.code(500).send({
        error: error instanceof Error ? error.message : "Failed to detect repository",
      });
    }
  });

  /**
   * GET /api/github/repos/connected
   * Get connected repository for workspace
   */
  fastify.get<{
    Querystring: WorkspacePathQuery;
    Reply: { repository: GitHubRepositoryConfig | null } | { error: string };
  }>("/api/github/repos/connected", async (request, reply) => {
    const workspacePath = requireWorkspacePath(request, reply);
    if (!workspacePath) return;

    try {
      const repository = await github.getConnectedRepository(workspacePath);
      return { repository };
    } catch (error) {
      reply.code(500).send({
        error: error instanceof Error ? error.message : "Failed to get connected repository",
      });
    }
  });

  /**
   * POST /api/github/repos/connect
   * Connect to a GitHub repository
   */
  fastify.post<{
    Querystring: WorkspacePathQuery;
    Body: ConnectRepoBody;
    Reply: { repository: GitHubRepository } | { error: string };
  }>("/api/github/repos/connect", async (request, reply) => {
    const workspacePath = requireWorkspacePath(request, reply);
    if (!workspacePath) return;

    const { owner, name } = request.body;
    if (!owner || !name) {
      return reply.code(400).send({ error: "owner and name are required" });
    }

    try {
      const repository = await github.connectRepository(workspacePath, owner, name);
      return { repository };
    } catch (error) {
      reply.code(400).send({
        error: error instanceof Error ? error.message : "Failed to connect repository",
      });
    }
  });

  /**
   * DELETE /api/github/repos/connect
   * Disconnect from repository
   */
  fastify.delete<{
    Querystring: WorkspacePathQuery;
    Reply: { success: boolean } | { error: string };
  }>("/api/github/repos/connect", async (request, reply) => {
    const workspacePath = requireWorkspacePath(request, reply);
    if (!workspacePath) return;

    try {
      await github.disconnectRepository(workspacePath);
      return { success: true };
    } catch (error) {
      reply.code(500).send({
        error: error instanceof Error ? error.message : "Failed to disconnect repository",
      });
    }
  });

  // ---------------------------------------------------------------------------
  // Issues Routes
  // ---------------------------------------------------------------------------

  /**
   * GET /api/github/issues
   * List issues for connected repository
   */
  fastify.get<{
    Querystring: WorkspacePathQuery & {
      state?: string;
      labels?: string;
      assignee?: string;
      sort?: string;
      direction?: string;
      page?: string;
      per_page?: string;
    };
    Reply: GitHubPaginatedResponse<GitHubIssue> | { error: string };
  }>("/api/github/issues", async (request, reply) => {
    const workspacePath = requireWorkspacePath(request, reply);
    if (!workspacePath) return;

    try {
      const params: GitHubListIssuesParams = {
        state: (request.query.state as GitHubListIssuesParams["state"]) || "open",
        labels: request.query.labels,
        assignee: request.query.assignee,
        sort: (request.query.sort as GitHubListIssuesParams["sort"]) || "created",
        direction: (request.query.direction as GitHubListIssuesParams["direction"]) || "desc",
        page: parseInt(request.query.page || "1", 10),
        per_page: parseInt(request.query.per_page || "30", 10),
      };

      const issues = await github.listIssues(workspacePath, params);
      return issues;
    } catch (error) {
      reply.code(500).send({
        error: error instanceof Error ? error.message : "Failed to list issues",
      });
    }
  });

  /**
   * GET /api/github/issues/:number
   * Get a single issue
   */
  fastify.get<{
    Querystring: WorkspacePathQuery;
    Params: IssueParams;
    Reply: { issue: GitHubIssue } | { error: string };
  }>("/api/github/issues/:number", async (request, reply) => {
    const workspacePath = requireWorkspacePath(request, reply);
    if (!workspacePath) return;

    const issueNumber = parseInt(request.params.number, 10);
    if (isNaN(issueNumber)) {
      return reply.code(400).send({ error: "Invalid issue number" });
    }

    try {
      const issue = await github.getIssue(workspacePath, issueNumber);
      return { issue };
    } catch (error) {
      reply.code(404).send({
        error: error instanceof Error ? error.message : "Issue not found",
      });
    }
  });

  /**
   * POST /api/github/issues/:number/investigate
   * Investigate an issue with AI analysis
   */
  fastify.post<{
    Querystring: WorkspacePathQuery;
    Params: IssueParams;
    Body: InvestigateBody;
    Reply: { investigation: GitHubIssueInvestigation } | { error: string };
  }>("/api/github/issues/:number/investigate", async (request, reply) => {
    const workspacePath = requireWorkspacePath(request, reply);
    if (!workspacePath) return;

    const issueNumber = parseInt(request.params.number, 10);
    if (isNaN(issueNumber)) {
      return reply.code(400).send({ error: "Invalid issue number" });
    }

    const saveSpec = request.body?.save_spec ?? false;

    try {
      const investigation = await github.investigateIssue(workspacePath, issueNumber, saveSpec);
      return { investigation };
    } catch (error) {
      reply.code(500).send({
        error: error instanceof Error ? error.message : "Failed to investigate issue",
      });
    }
  });

  /**
   * POST /api/github/issues/import
   * Import multiple issues as spec files
   */
  fastify.post<{
    Querystring: WorkspacePathQuery;
    Body: ImportIssuesBody;
    Reply: github.ImportResult | { error: string };
  }>("/api/github/issues/import", async (request, reply) => {
    const workspacePath = requireWorkspacePath(request, reply);
    if (!workspacePath) return;

    const { issue_numbers } = request.body;
    if (!issue_numbers || !Array.isArray(issue_numbers) || issue_numbers.length === 0) {
      return reply.code(400).send({ error: "issue_numbers array is required" });
    }

    try {
      const result = await github.importIssues(workspacePath, issue_numbers);
      return result;
    } catch (error) {
      reply.code(500).send({
        error: error instanceof Error ? error.message : "Failed to import issues",
      });
    }
  });

  // ---------------------------------------------------------------------------
  // Pull Requests Routes
  // ---------------------------------------------------------------------------

  /**
   * GET /api/github/prs
   * List pull requests for connected repository
   */
  fastify.get<{
    Querystring: WorkspacePathQuery & {
      state?: string;
      sort?: string;
      direction?: string;
      page?: string;
      per_page?: string;
    };
    Reply: GitHubPaginatedResponse<GitHubPullRequest> | { error: string };
  }>("/api/github/prs", async (request, reply) => {
    const workspacePath = requireWorkspacePath(request, reply);
    if (!workspacePath) return;

    try {
      const params: GitHubListPRsParams = {
        state: (request.query.state as GitHubListPRsParams["state"]) || "open",
        sort: (request.query.sort as GitHubListPRsParams["sort"]) || "created",
        direction: (request.query.direction as GitHubListPRsParams["direction"]) || "desc",
        page: parseInt(request.query.page || "1", 10),
        per_page: parseInt(request.query.per_page || "30", 10),
      };

      const prs = await github.listPullRequests(workspacePath, params);
      return prs;
    } catch (error) {
      reply.code(500).send({
        error: error instanceof Error ? error.message : "Failed to list pull requests",
      });
    }
  });

  /**
   * GET /api/github/prs/:number
   * Get a single pull request
   */
  fastify.get<{
    Querystring: WorkspacePathQuery;
    Params: IssueParams;
    Reply: { pr: GitHubPullRequest } | { error: string };
  }>("/api/github/prs/:number", async (request, reply) => {
    const workspacePath = requireWorkspacePath(request, reply);
    if (!workspacePath) return;

    const prNumber = parseInt(request.params.number, 10);
    if (isNaN(prNumber)) {
      return reply.code(400).send({ error: "Invalid PR number" });
    }

    try {
      const pr = await github.getPullRequest(workspacePath, prNumber);
      return { pr };
    } catch (error) {
      reply.code(404).send({
        error: error instanceof Error ? error.message : "Pull request not found",
      });
    }
  });

  /**
   * POST /api/github/prs
   * Create a new pull request
   */
  fastify.post<{
    Querystring: WorkspacePathQuery;
    Body: CreatePRBody;
    Reply: { pr: GitHubPullRequest } | { error: string };
  }>("/api/github/prs", async (request, reply) => {
    const workspacePath = requireWorkspacePath(request, reply);
    if (!workspacePath) return;

    const { title, body, head, base, draft } = request.body;
    if (!title || !head || !base) {
      return reply.code(400).send({ error: "title, head, and base are required" });
    }

    try {
      const pr = await github.createPullRequest(workspacePath, {
        title,
        body,
        head,
        base,
        draft,
      });
      return { pr };
    } catch (error) {
      reply.code(400).send({
        error: error instanceof Error ? error.message : "Failed to create pull request",
      });
    }
  });

  // ---------------------------------------------------------------------------
  // Releases Routes
  // ---------------------------------------------------------------------------

  /**
   * GET /api/github/releases
   * List releases for connected repository
   */
  fastify.get<{
    Querystring: WorkspacePathQuery & { page?: string; per_page?: string };
    Reply: GitHubPaginatedResponse<GitHubRelease> | { error: string };
  }>("/api/github/releases", async (request, reply) => {
    const workspacePath = requireWorkspacePath(request, reply);
    if (!workspacePath) return;

    try {
      const params: GitHubListReleasesParams = {
        page: parseInt(request.query.page || "1", 10),
        per_page: parseInt(request.query.per_page || "30", 10),
      };

      const releases = await github.listReleases(workspacePath, params);
      return releases;
    } catch (error) {
      reply.code(500).send({
        error: error instanceof Error ? error.message : "Failed to list releases",
      });
    }
  });

  /**
   * GET /api/github/releases/latest
   * Get latest release
   */
  fastify.get<{
    Querystring: WorkspacePathQuery;
    Reply: { release: GitHubRelease } | { error: string };
  }>("/api/github/releases/latest", async (request, reply) => {
    const workspacePath = requireWorkspacePath(request, reply);
    if (!workspacePath) return;

    try {
      const release = await github.getLatestRelease(workspacePath);
      return { release };
    } catch (error) {
      reply.code(404).send({
        error: error instanceof Error ? error.message : "No releases found",
      });
    }
  });

  /**
   * POST /api/github/releases
   * Create a new release
   */
  fastify.post<{
    Querystring: WorkspacePathQuery;
    Body: CreateReleaseBody;
    Reply: { release: GitHubRelease } | { error: string };
  }>("/api/github/releases", async (request, reply) => {
    const workspacePath = requireWorkspacePath(request, reply);
    if (!workspacePath) return;

    const { tag_name, name, body, draft, prerelease, target_commitish } = request.body;
    if (!tag_name) {
      return reply.code(400).send({ error: "tag_name is required" });
    }

    try {
      const release = await github.createRelease(workspacePath, {
        tag_name,
        name,
        body,
        draft,
        prerelease,
        target_commitish,
      });
      return { release };
    } catch (error) {
      reply.code(400).send({
        error: error instanceof Error ? error.message : "Failed to create release",
      });
    }
  });

  /**
   * POST /api/github/releases/generate-notes
   * Generate release notes
   */
  fastify.post<{
    Querystring: WorkspacePathQuery;
    Body: { tag_name: string; previous_tag?: string };
    Reply: { name: string; body: string } | { error: string };
  }>("/api/github/releases/generate-notes", async (request, reply) => {
    const workspacePath = requireWorkspacePath(request, reply);
    if (!workspacePath) return;

    const { tag_name, previous_tag } = request.body;
    if (!tag_name) {
      return reply.code(400).send({ error: "tag_name is required" });
    }

    try {
      const notes = await github.generateReleaseNotes(workspacePath, tag_name, previous_tag);
      return notes;
    } catch (error) {
      reply.code(400).send({
        error: error instanceof Error ? error.message : "Failed to generate release notes",
      });
    }
  });
}
