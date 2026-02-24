/**
 * Kanban Routes
 *
 * Provides kanban API endpoints that map to existing Viben services:
 * - Projects = Workspaces
 * - Tasks = Background Tasks
 *
 * This allows the frontend to continue using the existing useVibeKanban* hooks
 * while the backend uses the unified Viben data model.
 */

import type { FastifyInstance } from "fastify";
import { backgroundTaskManager } from "../../services/background-tasks";
import { workspaceManager, type Workspace } from "../../workspace";
import { getConfigDir } from "../../executors";

// ============================================================================
// Types
// ============================================================================

/**
 * Project response (maps from Workspace)
 */
interface KanbanProject {
  id: string;
  name: string;
  git_repo_path: string;
  setup_script: string | null;
  dev_script: string | null;
  cleanup_script: string | null;
  copy_files: string | null;
  parallel_setup_script: boolean;
  remote_project_id: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Task status for kanban
 */
type KanbanTaskStatus = "todo" | "inprogress" | "inreview" | "done" | "cancelled";

/**
 * Task response (maps from BackgroundTask)
 */
interface KanbanTask {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  status: KanbanTaskStatus;
  parent_workspace_id: string | null;
  created_at: string;
  updated_at: string;
  has_in_progress_attempt: boolean;
  last_attempt_failed: boolean;
  executor: string;
}

/**
 * API response wrapper
 */
interface ApiResponse<T> {
  success: boolean;
  data: T;
  error_data: unknown | null;
  message: string | null;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Generate workspace ID from path (matching workspaces.ts convention)
 */
function generateWorkspaceId(path: string): string {
  return Buffer.from(path).toString("base64url");
}

/**
 * Decode workspace ID to path
 */
function decodeWorkspaceId(id: string): string {
  return Buffer.from(id, "base64url").toString();
}

/**
 * Map BackgroundTask status to KanbanTaskStatus
 */
function mapBackgroundStatusToKanban(
  status: "running" | "completed" | "error" | "cancelled"
): KanbanTaskStatus {
  switch (status) {
    case "running":
      return "inprogress";
    case "completed":
      return "done";
    case "error":
      return "inreview"; // Map errors to "in review" for visibility
    case "cancelled":
      return "cancelled";
    default:
      return "todo";
  }
}

/**
 * Create successful API response
 */
function success<T>(data: T): ApiResponse<T> {
  return {
    success: true,
    data,
    error_data: null,
    message: null,
  };
}

/**
 * Create error API response
 */
function error(message: string, errorData?: unknown): ApiResponse<null> {
  return {
    success: false,
    data: null,
    error_data: errorData ?? null,
    message,
  };
}

// ============================================================================
// Routes
// ============================================================================

/**
 * Register kanban routes
 */
export function registerKanbanRoutes(fastify: FastifyInstance): void {
  /**
   * Health check
   * GET /api/kanban/health
   */
  fastify.get("/api/kanban/health", async (_request, reply) => {
    return reply.send(success("OK"));
  });

  /**
   * Get all projects (workspaces)
   * GET /api/kanban/projects
   */
  fastify.get("/api/kanban/projects", async (_request, reply) => {
    try {
      const workspaces = await workspaceManager.listWorkspaces();
      const configDir = getConfigDir();

      // Transform workspaces to kanban projects
      const projects: KanbanProject[] = workspaces.map((ws) => ({
        id: generateWorkspaceId(ws.path),
        name: ws.name,
        git_repo_path: ws.path,
        setup_script: null,
        dev_script: null,
        cleanup_script: null,
        copy_files: null,
        parallel_setup_script: false,
        remote_project_id: null,
        created_at: ws.createdAt || new Date().toISOString(),
        updated_at: ws.updatedAt || new Date().toISOString(),
      }));

      // Add global workspace as a project
      projects.unshift({
        id: "global",
        name: "Global",
        git_repo_path: configDir,
        setup_script: null,
        dev_script: null,
        cleanup_script: null,
        copy_files: null,
        parallel_setup_script: false,
        remote_project_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      return reply.send(success(projects));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to list projects";
      return reply.status(500).send(error(message));
    }
  });

  /**
   * Get tasks for a project
   * GET /api/kanban/tasks?project_id=xxx
   */
  fastify.get<{
    Querystring: { project_id?: string };
  }>("/api/kanban/tasks", async (request, reply) => {
    const { project_id } = request.query;

    if (!project_id) {
      return reply.status(400).send(error("project_id is required"));
    }

    try {
      // Get all background tasks
      const allTasks = backgroundTaskManager.getAllTasks();

      // Get workspace path from project_id
      let workspacePath: string | undefined;
      if (project_id === "global") {
        workspacePath = undefined; // Global tasks have no workspace path
      } else {
        // Decode workspace path from ID
        try {
          workspacePath = decodeWorkspaceId(project_id);
        } catch {
          // If decoding fails, try to find workspace by path
          const workspaces = await workspaceManager.listWorkspaces();
          const workspace = workspaces.find((ws) => generateWorkspaceId(ws.path) === project_id);
          workspacePath = workspace?.path;
        }
      }

      // Filter tasks by workspace
      const filteredTasks = allTasks.filter((task) => {
        if (project_id === "global") {
          // Global project shows tasks without workspacePath
          return !task.workspacePath;
        }
        if (!workspacePath || !task.workspacePath) {
          return false;
        }
        // Normalize paths for comparison
        const normalizedTaskPath = task.workspacePath.replace(/\/+$/, "");
        const normalizedWorkspacePath = workspacePath.replace(/\/+$/, "");
        return normalizedTaskPath === normalizedWorkspacePath;
      });

      // Transform to kanban tasks
      const kanbanTasks: KanbanTask[] = filteredTasks.map((task) => ({
        id: task.taskId,
        project_id,
        title: task.prompt.slice(0, 100) + (task.prompt.length > 100 ? "..." : ""),
        description: task.prompt,
        status: mapBackgroundStatusToKanban(task.status),
        parent_workspace_id: null,
        created_at: task.startedAt.toISOString(),
        updated_at: task.completedAt?.toISOString() || task.startedAt.toISOString(),
        has_in_progress_attempt: task.status === "running",
        last_attempt_failed: task.status === "error",
        executor: task.agentName || "Agent",
      }));

      return reply.send(success(kanbanTasks));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to list tasks";
      return reply.status(500).send(error(message));
    }
  });

  /**
   * Get a single task
   * GET /api/kanban/tasks/:taskId
   */
  fastify.get<{
    Params: { taskId: string };
  }>("/api/kanban/tasks/:taskId", async (request, reply) => {
    const { taskId } = request.params;

    const task = backgroundTaskManager.getTask(taskId);
    if (!task) {
      return reply.status(404).send(error("Task not found"));
    }

    const kanbanTask: KanbanTask = {
      id: task.taskId,
      project_id: task.workspacePath || "global",
      title: task.prompt.slice(0, 100) + (task.prompt.length > 100 ? "..." : ""),
      description: task.prompt,
      status: mapBackgroundStatusToKanban(task.status),
      parent_workspace_id: null,
      created_at: task.startedAt.toISOString(),
      updated_at: task.completedAt?.toISOString() || task.startedAt.toISOString(),
      has_in_progress_attempt: task.status === "running",
      last_attempt_failed: task.status === "error",
      executor: task.agentName || "Agent",
    };

    return reply.send(success(kanbanTask));
  });

  /**
   * Create a new task
   * POST /api/kanban/tasks
   *
   * Note: This endpoint exists for API compatibility but creating tasks
   * through the kanban API is not supported. Tasks are created through
   * the agent run API.
   */
  fastify.post("/api/kanban/tasks", async (_request, reply) => {
    return reply.status(501).send(
      error("Task creation through kanban API is not supported. Use /api/agent/run instead.")
    );
  });

  /**
   * Update a task
   * PUT /api/kanban/tasks/:taskId
   *
   * Note: Only status updates are supported (to cancel/stop tasks)
   */
  fastify.put<{
    Params: { taskId: string };
    Body: { status?: KanbanTaskStatus };
  }>("/api/kanban/tasks/:taskId", async (request, reply) => {
    const { taskId } = request.params;
    const { status } = request.body || {};

    const task = backgroundTaskManager.getTask(taskId);
    if (!task) {
      return reply.status(404).send(error("Task not found"));
    }

    // Only support cancelling running tasks
    if (status === "cancelled" && task.status === "running") {
      backgroundTaskManager.stopTask(taskId);
    }

    // Return updated task
    const updatedTask = backgroundTaskManager.getTask(taskId);
    if (!updatedTask) {
      return reply.status(404).send(error("Task not found after update"));
    }

    const kanbanTask: KanbanTask = {
      id: updatedTask.taskId,
      project_id: updatedTask.workspacePath || "global",
      title: updatedTask.prompt.slice(0, 100) + (updatedTask.prompt.length > 100 ? "..." : ""),
      description: updatedTask.prompt,
      status: mapBackgroundStatusToKanban(updatedTask.status),
      parent_workspace_id: null,
      created_at: updatedTask.startedAt.toISOString(),
      updated_at: updatedTask.completedAt?.toISOString() || updatedTask.startedAt.toISOString(),
      has_in_progress_attempt: updatedTask.status === "running",
      last_attempt_failed: updatedTask.status === "error",
      executor: updatedTask.agentName || "Agent",
    };

    return reply.send(success(kanbanTask));
  });

  /**
   * Delete a task
   * DELETE /api/kanban/tasks/:taskId
   *
   * Note: This removes the task from the background task manager
   */
  fastify.delete<{
    Params: { taskId: string };
  }>("/api/kanban/tasks/:taskId", async (request, reply) => {
    const { taskId } = request.params;

    const task = backgroundTaskManager.getTask(taskId);
    if (!task) {
      return reply.status(404).send(error("Task not found"));
    }

    // Stop if running
    if (task.status === "running") {
      backgroundTaskManager.stopTask(taskId);
    }

    // Cleanup the task
    backgroundTaskManager.cleanup(taskId);

    return reply.send(success(null));
  });
}
