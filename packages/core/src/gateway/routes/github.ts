/**
 * GitHub Gateway Routes
 *
 * API endpoints for GitHub integration:
 * - Authentication (gh CLI + PAT)
 * - Repository management
 * - Issues
 * - Pull requests
 * - Releases
 * - Auto-fix tasks
 * - Issue analysis
 * - Issue clustering
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import * as github from "../../services/github";
import * as autofix from "../../github";
import { eventService } from "../../services/events";
import { logger as globalLogger } from "../../telemetry";

// Module-level child logger
const log = globalLogger.child({ module: "github" });

// Track workspaces with event listeners already set up to avoid duplicate registration
const eventListenersSetup = new Set<string>();

/**
 * Convert a GitHubIssue to GHIssue format used by autofix module
 */
function convertToGHIssue(issue: GitHubIssue): autofix.GHIssue {
  return {
    number: issue.number,
    title: issue.title,
    body: issue.body ?? "",
    state: issue.state === "open" ? "OPEN" : "CLOSED",
    labels: issue.labels.map((l) => ({ name: l.name })),
    assignees: issue.assignees.map((a) => ({ login: a.login })),
    author: { login: issue.user.login },
    created_at: issue.created_at,
    updated_at: issue.updated_at,
    url: issue.html_url,
    comments: { totalCount: issue.comments },
  };
}

/**
 * Fetch multiple issues in parallel and convert to GHIssue format
 */
async function fetchIssuesAsGHIssues(
  workspacePath: string,
  issueNumbers: number[]
): Promise<autofix.GHIssue[]> {
  const issuePromises = issueNumbers.map((num) =>
    github.getIssue(workspacePath, num).then(convertToGHIssue)
  );
  return Promise.all(issuePromises);
}

/**
 * Setup event forwarding for a task queue (idempotent)
 * Only sets up listeners once per workspace to prevent memory leaks
 */
function setupTaskQueueEventForwarding(
  queue: autofix.AutoFixTaskQueue,
  workspacePath: string
): void {
  if (eventListenersSetup.has(workspacePath)) {
    return;
  }

  queue.on("status_change", (event) => {
    eventService.githubAutofixTaskStatusChanged(
      event.task_id,
      workspacePath,
      event.status
    );
  });

  queue.on("progress", (event) => {
    eventService.githubAutofixTaskProgress(
      event.task_id,
      workspacePath,
      event.message,
      event.percent
    );
  });

  queue.on("log", (event) => {
    eventService.githubAutofixTaskLog(
      event.task_id,
      workspacePath,
      event.level,
      event.message
    );
  });

  eventListenersSetup.add(workspacePath);
}
import type {
  GitHubAuthStatusResponse,
  GitHubUser,
  GitHubRepository,
  GitHubRepositoryConfig,
  GitHubIssue,
  GitHubComment,
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

interface TaskParams {
  task_id: string;
}

interface CreateAutoFixTaskBody {
  issue_numbers: number[];
  require_approval?: boolean;
  base_branch?: string;
}

interface AnalyzeIssueBody {
  use_ai?: boolean;
}

interface ClusterIssuesBody {
  issue_numbers: number[];
  similarity_threshold?: number;
  max_cluster_size?: number;
}

interface TriageIssuesBody {
  issue_numbers: number[];
  use_ai?: boolean;
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
      log.error({ err: error }, "Auth status error");
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
      log.error({ err: error }, "gh-cli auth error");
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
   * GET /api/github/issues/:number/comments
   * Get comments for an issue
   */
  fastify.get<{
    Querystring: WorkspacePathQuery & { page?: string; per_page?: string };
    Params: IssueParams;
    Reply: GitHubPaginatedResponse<GitHubComment> | { error: string };
  }>("/api/github/issues/:number/comments", async (request, reply) => {
    const workspacePath = requireWorkspacePath(request, reply);
    if (!workspacePath) return;

    const issueNumber = parseInt(request.params.number, 10);
    if (isNaN(issueNumber)) {
      return reply.code(400).send({ error: "Invalid issue number" });
    }

    const page = parseInt(request.query.page || "1", 10);
    const perPage = parseInt(request.query.per_page || "30", 10);

    try {
      const comments = await github.getIssueComments(workspacePath, issueNumber, page, perPage);
      return comments;
    } catch (error) {
      reply.code(500).send({
        error: error instanceof Error ? error.message : "Failed to get comments",
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

  // ---------------------------------------------------------------------------
  // Auto-Fix Configuration Routes
  // ---------------------------------------------------------------------------

  /**
   * GET /api/github/autofix/config
   * Get auto-fix configuration
   */
  fastify.get<{
    Querystring: WorkspacePathQuery;
    Reply: autofix.GitHubAutoFixConfig | { error: string };
  }>("/api/github/autofix/config", async (request, reply) => {
    const workspacePath = requireWorkspacePath(request, reply);
    if (!workspacePath) return;

    try {
      const config = await autofix.loadGitHubConfig(workspacePath);
      return config;
    } catch (error) {
      reply.code(500).send({
        error: error instanceof Error ? error.message : "Failed to load config",
      });
    }
  });

  /**
   * PUT /api/github/autofix/config
   * Update auto-fix configuration
   */
  fastify.put<{
    Querystring: WorkspacePathQuery;
    Body: Partial<autofix.GitHubAutoFixConfig>;
    Reply: { success: boolean } | { error: string };
  }>("/api/github/autofix/config", async (request, reply) => {
    const workspacePath = requireWorkspacePath(request, reply);
    if (!workspacePath) return;

    try {
      await autofix.saveGitHubConfig(request.body, workspacePath);
      return { success: true };
    } catch (error) {
      reply.code(500).send({
        error: error instanceof Error ? error.message : "Failed to save config",
      });
    }
  });

  // ---------------------------------------------------------------------------
  // Auto-Fix Task Routes
  // ---------------------------------------------------------------------------

  /**
   * GET /api/github/autofix/tasks
   * List auto-fix tasks
   */
  fastify.get<{
    Querystring: WorkspacePathQuery & { status?: string };
    Reply: { tasks: autofix.AutoFixTask[] } | { error: string };
  }>("/api/github/autofix/tasks", async (request, reply) => {
    const workspacePath = requireWorkspacePath(request, reply);
    if (!workspacePath) return;

    try {
      const queue = autofix.getTaskQueue(workspacePath);
      await queue.initialize();
      const tasks = await queue.listTasks();
      return { tasks };
    } catch (error) {
      reply.code(500).send({
        error: error instanceof Error ? error.message : "Failed to list tasks",
      });
    }
  });

  /**
   * POST /api/github/autofix/tasks
   * Create a new auto-fix task
   */
  fastify.post<{
    Querystring: WorkspacePathQuery;
    Body: CreateAutoFixTaskBody;
    Reply: { task_id: string } | { error: string; code?: string };
  }>("/api/github/autofix/tasks", async (request, reply) => {
    const workspacePath = requireWorkspacePath(request, reply);
    if (!workspacePath) return;

    const { issue_numbers, require_approval, base_branch } = request.body;
    if (!issue_numbers || !Array.isArray(issue_numbers) || issue_numbers.length === 0) {
      return reply.code(400).send({ error: "issue_numbers array is required" });
    }

    try {
      const queue = autofix.getTaskQueue(workspacePath);
      await queue.initialize();

      // Set up event forwarding (idempotent - only sets up once per workspace)
      setupTaskQueueEventForwarding(queue, workspacePath);

      const taskId = await queue.enqueue({
        issue_numbers,
        require_approval,
        base_branch,
      });

      // Emit task created event
      eventService.githubAutofixTaskCreated(taskId, workspacePath, issue_numbers);

      return { task_id: taskId };
    } catch (error) {
      if (autofix.isGitHubError(error)) {
        return reply.code(400).send({
          error: error.message,
          code: error.code,
        });
      }
      reply.code(500).send({
        error: error instanceof Error ? error.message : "Failed to create task",
      });
    }
  });

  /**
   * GET /api/github/autofix/tasks/:task_id
   * Get a specific auto-fix task
   */
  fastify.get<{
    Querystring: WorkspacePathQuery;
    Params: TaskParams;
    Reply: { task: autofix.AutoFixTask } | { error: string };
  }>("/api/github/autofix/tasks/:task_id", async (request, reply) => {
    const workspacePath = requireWorkspacePath(request, reply);
    if (!workspacePath) return;

    const { task_id } = request.params;

    try {
      const queue = autofix.getTaskQueue(workspacePath);
      await queue.initialize();
      const task = await queue.getTask(task_id);

      if (!task) {
        return reply.code(404).send({ error: "Task not found" });
      }

      return { task };
    } catch (error) {
      reply.code(500).send({
        error: error instanceof Error ? error.message : "Failed to get task",
      });
    }
  });

  /**
   * POST /api/github/autofix/tasks/:task_id/cancel
   * Cancel an auto-fix task
   */
  fastify.post<{
    Querystring: WorkspacePathQuery;
    Params: TaskParams;
    Reply: { success: boolean } | { error: string };
  }>("/api/github/autofix/tasks/:task_id/cancel", async (request, reply) => {
    const workspacePath = requireWorkspacePath(request, reply);
    if (!workspacePath) return;

    const { task_id } = request.params;

    try {
      const queue = autofix.getTaskQueue(workspacePath);
      await queue.initialize();
      await queue.cancel(task_id);

      // Emit cancelled event
      eventService.githubAutofixTaskCancelled(task_id, workspacePath);

      return { success: true };
    } catch (error) {
      reply.code(500).send({
        error: error instanceof Error ? error.message : "Failed to cancel task",
      });
    }
  });

  /**
   * POST /api/github/autofix/tasks/:task_id/approve
   * Approve an auto-fix task awaiting approval
   */
  fastify.post<{
    Querystring: WorkspacePathQuery;
    Params: TaskParams;
    Reply: { success: boolean } | { error: string };
  }>("/api/github/autofix/tasks/:task_id/approve", async (request, reply) => {
    const workspacePath = requireWorkspacePath(request, reply);
    if (!workspacePath) return;

    const { task_id } = request.params;

    try {
      const queue = autofix.getTaskQueue(workspacePath);
      await queue.initialize();
      await queue.approve(task_id);
      return { success: true };
    } catch (error) {
      if (autofix.isGitHubError(error)) {
        return reply.code(400).send({ error: error.message });
      }
      reply.code(500).send({
        error: error instanceof Error ? error.message : "Failed to approve task",
      });
    }
  });

  /**
   * DELETE /api/github/autofix/tasks/:task_id
   * Delete a completed auto-fix task
   */
  fastify.delete<{
    Querystring: WorkspacePathQuery;
    Params: TaskParams;
    Reply: { success: boolean } | { error: string };
  }>("/api/github/autofix/tasks/:task_id", async (request, reply) => {
    const workspacePath = requireWorkspacePath(request, reply);
    if (!workspacePath) return;

    const { task_id } = request.params;

    try {
      const queue = autofix.getTaskQueue(workspacePath);
      await queue.initialize();
      const deleted = await queue.deleteTask(task_id);

      if (!deleted) {
        return reply.code(404).send({ error: "Task not found" });
      }

      return { success: true };
    } catch (error) {
      reply.code(500).send({
        error: error instanceof Error ? error.message : "Failed to delete task",
      });
    }
  });

  // ---------------------------------------------------------------------------
  // Issue Analysis Routes
  // ---------------------------------------------------------------------------

  /**
   * POST /api/github/issues/:number/analyze
   * Analyze a single issue
   */
  fastify.post<{
    Querystring: WorkspacePathQuery;
    Params: IssueParams;
    Body: AnalyzeIssueBody;
    Reply: { analysis: autofix.IssueAnalysis } | { error: string };
  }>("/api/github/issues/:number/analyze", async (request, reply) => {
    const workspacePath = requireWorkspacePath(request, reply);
    if (!workspacePath) return;

    const issueNumber = parseInt(request.params.number, 10);
    if (isNaN(issueNumber)) {
      return reply.code(400).send({ error: "Invalid issue number" });
    }

    const { use_ai } = request.body ?? {};

    try {
      // Fetch issue details using existing service
      const issue = await github.getIssue(workspacePath, issueNumber);
      const commentsResult = await github.getIssueComments(workspacePath, issueNumber);
      const comments = commentsResult.items;

      // Convert to GHIssue format (gh-client uses different case conventions)
      const ghIssue: autofix.GHIssue = {
        number: issue.number,
        title: issue.title,
        body: issue.body ?? "",
        state: issue.state === "open" ? "OPEN" : "CLOSED",
        labels: issue.labels.map((l) => ({
          name: l.name,
        })),
        assignees: issue.assignees.map((a) => ({
          login: a.login,
        })),
        author: {
          login: issue.user.login,
        },
        created_at: issue.created_at,
        updated_at: issue.updated_at,
        url: issue.html_url,
        comments: {
          totalCount: issue.comments,
        },
      };

      // Convert comments
      const convertedComments: autofix.GHComment[] = comments.map((c) => ({
        id: String(c.id),
        body: c.body,
        author: {
          login: c.user.login,
        },
        created_at: c.created_at,
        updated_at: c.updated_at,
      }));

      // Analyze
      const analysis = await autofix.analyzeIssue(ghIssue, convertedComments, {
        useAI: use_ai,
      });

      return { analysis };
    } catch (error) {
      reply.code(500).send({
        error: error instanceof Error ? error.message : "Failed to analyze issue",
      });
    }
  });

  /**
   * POST /api/github/issues/triage
   * Triage multiple issues
   */
  fastify.post<{
    Querystring: WorkspacePathQuery;
    Body: TriageIssuesBody;
    Reply: { results: autofix.BatchTriageResult } | { error: string };
  }>("/api/github/issues/triage", async (request, reply) => {
    const workspacePath = requireWorkspacePath(request, reply);
    if (!workspacePath) return;

    const { issue_numbers, use_ai } = request.body;
    if (!issue_numbers || !Array.isArray(issue_numbers) || issue_numbers.length === 0) {
      return reply.code(400).send({ error: "issue_numbers array is required" });
    }

    try {
      // Fetch all issues in parallel
      const issues = await fetchIssuesAsGHIssues(workspacePath, issue_numbers);

      // Triage
      let results: autofix.BatchTriageResult;
      if (use_ai) {
        const config = await autofix.loadGitHubConfig(workspacePath);
        results = await autofix.triageIssuesWithAI(issues, config.model);
      } else {
        results = autofix.triageIssues(issues);
      }

      return { results };
    } catch (error) {
      reply.code(500).send({
        error: error instanceof Error ? error.message : "Failed to triage issues",
      });
    }
  });

  /**
   * POST /api/github/issues/cluster
   * Cluster issues by semantic similarity
   */
  fastify.post<{
    Querystring: WorkspacePathQuery;
    Body: ClusterIssuesBody;
    Reply: { result: autofix.ClusteringResult } | { error: string };
  }>("/api/github/issues/cluster", async (request, reply) => {
    const workspacePath = requireWorkspacePath(request, reply);
    if (!workspacePath) return;

    const { issue_numbers, similarity_threshold, max_cluster_size } = request.body;
    if (!issue_numbers || !Array.isArray(issue_numbers) || issue_numbers.length === 0) {
      return reply.code(400).send({ error: "issue_numbers array is required" });
    }

    try {
      // Fetch all issues in parallel
      const issues = await fetchIssuesAsGHIssues(workspacePath, issue_numbers);

      // Cluster
      const result = autofix.clusterIssues(issues, {
        similarityThreshold: similarity_threshold,
        maxClusterSize: max_cluster_size,
      });

      return { result };
    } catch (error) {
      reply.code(500).send({
        error: error instanceof Error ? error.message : "Failed to cluster issues",
      });
    }
  });

  // ---------------------------------------------------------------------------
  // Worktree Management Routes
  // ---------------------------------------------------------------------------

  /**
   * GET /api/github/autofix/worktrees
   * List all worktrees
   */
  fastify.get<{
    Querystring: WorkspacePathQuery;
    Reply: { worktrees: autofix.WorktreeInfo[] } | { error: string };
  }>("/api/github/autofix/worktrees", async (request, reply) => {
    const workspacePath = requireWorkspacePath(request, reply);
    if (!workspacePath) return;

    try {
      const config = await autofix.loadGitHubConfig(workspacePath);
      const manager = autofix.createWorktreeManager(workspacePath, config);
      const worktrees = await manager.list();
      return { worktrees };
    } catch (error) {
      reply.code(500).send({
        error: error instanceof Error ? error.message : "Failed to list worktrees",
      });
    }
  });

  /**
   * DELETE /api/github/autofix/worktrees
   * Clean up all auto-fix worktrees
   */
  fastify.delete<{
    Querystring: WorkspacePathQuery;
    Reply: { cleaned: number } | { error: string };
  }>("/api/github/autofix/worktrees", async (request, reply) => {
    const workspacePath = requireWorkspacePath(request, reply);
    if (!workspacePath) return;

    try {
      const config = await autofix.loadGitHubConfig(workspacePath);
      const manager = autofix.createWorktreeManager(workspacePath, config);
      const cleaned = await manager.cleanup();
      return { cleaned };
    } catch (error) {
      reply.code(500).send({
        error: error instanceof Error ? error.message : "Failed to clean up worktrees",
      });
    }
  });
}
