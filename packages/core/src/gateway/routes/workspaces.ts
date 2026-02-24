/**
 * Workspace routes
 *
 * Provides HTTP API for workspace CRUD operations.
 *
 * Endpoints:
 * - GET /api/workspaces - List all workspaces (includes global workspace)
 *
 * Note: Resource discovery routes are defined in other files:
 * - /api/executors - See executors.ts
 * - /api/agents - See agents.ts
 * - /api/models - See models.ts
 */
import type { FastifyInstance } from "fastify";
import { homedir } from "node:os";
import { join } from "node:path";
import { workspaceManager } from "../../workspace";
import type { Workspace } from "../../workspace";

// ============================================================================
// Types
// ============================================================================

/**
 * Workspace type - global (non-deletable) or custom (user-added)
 */
type WorkspaceType = "global" | "custom";

/**
 * Workspace response (snake_case to match API conventions)
 */
interface WorkspaceResponse {
  id: string;
  path: string;
  name: string;
  config_path: string;
  /** Git repo path (path + "/.git") for kanban compatibility */
  git_repo_path: string;
  type: WorkspaceType;
  mcp?: {
    enabled: string[];
    disabled?: string[];
  };
  skills?: {
    enabled: string[];
    disabled?: string[];
  };
  agents?: string[];
  created_at?: string;
  updated_at?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Transform workspace to API response format (snake_case)
 */
function toSnakeCaseWorkspace(workspace: Workspace, type: WorkspaceType = "custom"): WorkspaceResponse {
  // Generate ID from path (base64 encoding of path)
  const id = Buffer.from(workspace.path).toString("base64url");
  return {
    id,
    path: workspace.path,
    name: workspace.name,
    config_path: workspace.configPath,
    git_repo_path: join(workspace.path, ".git"),
    type,
    mcp: workspace.mcp,
    skills: workspace.skills,
    agents: workspace.agents,
    created_at: workspace.createdAt,
    updated_at: workspace.updatedAt,
  };
}

/**
 * Create a global workspace pointing to user's home directory
 */
function createGlobalWorkspaceResponse(): WorkspaceResponse {
  const home = homedir();
  return {
    id: "global",
    path: home,
    name: "Global",
    config_path: join(home, ".viben"),
    git_repo_path: join(home, ".git"),
    type: "global",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

// ============================================================================
// Route Registration
// ============================================================================

/**
 * Register workspace routes
 */
export function registerWorkspaceRoutes(fastify: FastifyInstance): void {
  /**
   * List all workspaces
   * GET /api/workspaces
   *
   * Always includes a "global" workspace pointing to user's home directory
   */
  fastify.get("/api/workspaces", async () => {
    const workspaces = await workspaceManager.listWorkspaces();

    // Always include a global workspace pointing to home directory
    const globalWorkspace = createGlobalWorkspaceResponse();
    const customWorkspaces = workspaces.map((w) => toSnakeCaseWorkspace(w, "custom"));

    return {
      workspaces: [globalWorkspace, ...customWorkspaces],
      total: workspaces.length + 1,
      active_workspace_id: null,
    };
  });
}
