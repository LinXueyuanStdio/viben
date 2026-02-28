/**
 * Workspace routes
 *
 * Provides HTTP API for workspace CRUD operations.
 *
 * Endpoints:
 * - GET /api/workspaces - List all workspaces (includes global workspace)
 * - GET /api/workspaces/detect - Detect folder status (.git, .viben)
 * - POST /api/workspaces/create - Create workspace with initialization options
 *
 * Note: Resource discovery routes are defined in other files:
 * - /api/executors - See executors.ts
 * - /api/agents - See agents.ts
 * - /api/models - See models.ts
 */
import type { FastifyInstance } from "fastify";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join, basename } from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { workspaceManager } from "../../workspace";
import type { Workspace } from "../../workspace";
import { initTeam, type ProjectType } from "../../team/init";

const execAsync = promisify(exec);

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
// Detect & Create Types
// ============================================================================

/**
 * Response for folder detection
 */
interface DetectFolderResponse {
  path: string;
  folder_name: string;
  has_git: boolean;
  has_viben: boolean;
}

/**
 * Request body for creating a workspace
 */
interface CreateWorkspaceRequest {
  /** Creation method */
  method: "open-existing" | "create-new";
  /** Path - existing folder path or parent directory for new folder */
  path: string;
  /** Workspace name (also folder name for create-new) */
  name: string;
  /** Initialize Git repository */
  init_git: boolean;
  /** Initialize .viben configuration */
  init_viben: boolean;
  /** Viben initialization options (when init_viben is true) */
  viben_options?: {
    developer_name: string;
    project_type: "frontend" | "backend" | "fullstack";
    include_cursor: boolean;
    force: boolean;
  };
}

/**
 * Response for workspace creation
 */
interface CreateWorkspaceResponse {
  workspace: WorkspaceResponse;
  git_initialized: boolean;
  viben_initialized: boolean;
  viben_files?: string[];
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

  /**
   * Detect folder status
   * GET /api/workspaces/detect?path=xxx
   *
   * Checks if folder has .git and .viben directories
   */
  fastify.get<{ Querystring: { path: string } }>("/api/workspaces/detect", async (request, reply) => {
    const { path } = request.query;

    if (!path) {
      reply.status(400);
      return { error: "path is required" };
    }

    // Check if path exists
    if (!existsSync(path)) {
      reply.status(404);
      return { error: "Path does not exist" };
    }

    const folderName = basename(path);
    const hasGit = existsSync(join(path, ".git"));
    const hasViben = existsSync(join(path, ".viben"));

    const response: DetectFolderResponse = {
      path,
      folder_name: folderName,
      has_git: hasGit,
      has_viben: hasViben,
    };

    return response;
  });

  /**
   * Create workspace with initialization options
   * POST /api/workspaces/create
   *
   * Creates a new workspace, optionally initializing Git and .viben
   */
  fastify.post<{ Body: CreateWorkspaceRequest }>("/api/workspaces/create", async (request, reply) => {
    const { method, path, name, init_git, init_viben, viben_options } = request.body;

    // Validate required fields
    if (!method || !path || !name) {
      reply.status(400);
      return { error: "method, path, and name are required" };
    }

    let workspacePath: string;
    let gitInitialized = false;
    let vibenInitialized = false;
    let vibenFiles: string[] | undefined;

    try {
      if (method === "create-new") {
        // Create new folder
        workspacePath = join(path, name);

        if (existsSync(workspacePath)) {
          reply.status(400);
          return { error: `Folder already exists: ${workspacePath}` };
        }

        await mkdir(workspacePath, { recursive: true });
      } else {
        // Use existing folder
        workspacePath = path;

        if (!existsSync(workspacePath)) {
          reply.status(404);
          return { error: `Folder does not exist: ${workspacePath}` };
        }
      }

      // Initialize Git if requested
      if (init_git && !existsSync(join(workspacePath, ".git"))) {
        try {
          await execAsync("git init", { cwd: workspacePath });
          gitInitialized = true;
        } catch (err) {
          // Log but don't fail - git init is optional
          console.warn("Failed to initialize git:", err);
        }
      }

      // Initialize .viben if requested
      if (init_viben) {
        const developerName = viben_options?.developer_name || "developer";
        const projectType: ProjectType = viben_options?.project_type || "fullstack";
        const includeCursor = viben_options?.include_cursor ?? true;
        const force = viben_options?.force ?? false;

        try {
          const result = await initTeam({
            targetDir: workspacePath,
            developerName,
            projectType,
            force,
            skipExisting: !force,
            includeCursor,
          });

          vibenInitialized = result.success;
          vibenFiles = result.files;
        } catch (err) {
          // Log but don't fail - viben init is optional
          console.warn("Failed to initialize .viben:", err);
        }
      }

      // Register workspace with workspace manager
      await workspaceManager.registerWorkspace(workspacePath, name);

      // Get workspace info
      const workspace = await workspaceManager.getWorkspaceInfo(workspacePath);
      if (!workspace) {
        // Workspace might not have .viben config yet, create minimal workspace response
        const id = Buffer.from(workspacePath).toString("base64url");
        const workspaceResponse: WorkspaceResponse = {
          id,
          path: workspacePath,
          name,
          config_path: join(workspacePath, ".viben"),
          git_repo_path: join(workspacePath, ".git"),
          type: "custom",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        const response: CreateWorkspaceResponse = {
          workspace: workspaceResponse,
          git_initialized: gitInitialized,
          viben_initialized: vibenInitialized,
          viben_files: vibenFiles,
        };

        return response;
      }

      const workspaceResponse = toSnakeCaseWorkspace(workspace, "custom");

      const response: CreateWorkspaceResponse = {
        workspace: workspaceResponse,
        git_initialized: gitInitialized,
        viben_initialized: vibenInitialized,
        viben_files: vibenFiles,
      };

      return response;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      reply.status(500);
      return { error: `Failed to create workspace: ${message}` };
    }
  });

  /**
   * Delete (unregister) a workspace
   * DELETE /api/workspaces/:id
   *
   * Removes workspace from registry. Does NOT delete actual folder.
   * Global workspace cannot be deleted.
   */
  fastify.delete<{ Params: { id: string } }>("/api/workspaces/:id", async (request, reply) => {
    const { id } = request.params;

    if (!id) {
      reply.status(400);
      return { error: "Workspace ID is required" };
    }

    // Cannot delete global workspace
    if (id === "global") {
      reply.status(403);
      return { error: "Cannot delete global workspace" };
    }

    try {
      // Decode workspace path from ID (base64url)
      const workspacePath = Buffer.from(id, "base64url").toString();

      // Check if workspace exists in registry
      const workspaces = await workspaceManager.listWorkspaces();
      const workspace = workspaces.find((w) => w.path === workspacePath);

      if (!workspace) {
        reply.status(404);
        return { error: "Workspace not found" };
      }

      // Unregister workspace (does not delete folder)
      await workspaceManager.unregisterWorkspace(workspacePath);

      return { success: true, message: "Workspace removed from registry" };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      reply.status(500);
      return { error: `Failed to delete workspace: ${message}` };
    }
  });
}
