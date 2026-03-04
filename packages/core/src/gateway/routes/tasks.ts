/**
 * Task routes (unified workspace-based storage)
 *
 * Provides REST endpoints for task operations using workspace-based storage:
 * - GET /api/tasks - List all tasks (requires workspace_path)
 * - GET /api/tasks/:id - Get task by ID (requires workspace_path)
 * - POST /api/tasks - Create a new task (requires workspace_path)
 * - PATCH /api/tasks/:id - Update a task
 * - DELETE /api/tasks/:id - Delete a task
 * - GET /api/agents/:agentId/tasks - Get tasks by agent
 * - GET /api/agents/:agentId/sessions/:sessionId/tasks - List tasks by session
 * - GET /api/agents/:agentId/sessions/:sessionId/tasks/:taskId/messages - Get task messages
 *
 * IMPORTANT: All tasks are stored in workspace directories:
 * <workspace>/.viben/tasks/<date>-<slug>/task.json
 */
import type { FastifyInstance } from "fastify";
import {
  taskService,
  type UnifiedTask,
  type TaskStatus,
  type SubtaskInfo,
  type TaskSpecsData,
} from "../../services/task-service";
import { sessionStoreService } from "../../services/session-store";
import type { AppState } from "../state";
import type { Task, TaskStatus as DbTaskStatus } from "../../db/types";

/**
 * Convert UnifiedTask to db Task for events
 * Now uses unified status directly since DbTaskStatus is the same
 */
function toDbTask(task: UnifiedTask): Task {
  return {
    id: task.id,
    title: task.title || task.prompt?.slice(0, 50) || "Untitled",
    description: task.description || task.prompt,
    status: task.status as DbTaskStatus,
    agentId: task.agent,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt || task.createdAt,
  };
}

/**
 * Parse subtasks into structured format
 * If subtaskDetails exists, use it; otherwise parse from subtasks string array
 */
function parseSubtasksDetail(task: UnifiedTask): SubtaskInfo[] | null {
  // Prefer structured subtaskDetails if available
  if (task.subtaskDetails && task.subtaskDetails.length > 0) {
    return task.subtaskDetails;
  }

  // Parse from legacy subtasks string array if available
  if (task.subtasks && task.subtasks.length > 0) {
    return task.subtasks.map((name, index) => ({
      id: `subtask_${index}`,
      name,
      status: "pending" as const,
    }));
  }

  return null;
}

/**
 * Transform task to snake_case response format (for API responses)
 * Uses unified status (backlog, queue, in_progress, etc.)
 */
function toSnakeCaseTask(task: UnifiedTask) {
  return {
    id: task.id,
    name: task.name,
    title: task.title || task.prompt?.slice(0, 100) || "Untitled",
    description: task.description || task.prompt || null,
    status: task.status,
    // Status details
    review_reason: task.reviewReason ?? null,
    current_phase: task.current_phase ?? 0,
    // Organization fields
    priority: task.priority || "P2",
    dev_type: task.dev_type ?? null,
    scope: task.scope ?? null,
    workspace_path: task.workspacePath ?? null,
    // People
    creator: task.creator ?? null,
    assignee: task.assignee ?? null,
    // Git integration
    branch: task.branch ?? null,
    base_branch: task.base_branch ?? null,
    worktree_path: task.worktree_path ?? null,
    commit: task.commit ?? null,
    pr_url: task.pr_url ?? null,
    // Agent/Session fields
    agent_id: task.agent ?? null,
    session_id: task.sessionId ?? null,
    task_index: task.taskIndex ?? 0,
    prompt: task.prompt ?? null,
    // Execution info
    cost: task.cost ?? null,
    duration: task.duration ?? null,
    favorite: task.favorite ?? false,
    // Kanban attempt status - use unified status for inference
    has_in_progress_attempt: task.hasInProgressAttempt ?? task.status === "in_progress",
    last_attempt_failed: task.lastAttemptFailed ?? task.status === "error",
    executor: task.executor || "Agent",
    // Subtask visualization
    subtasks_detail: parseSubtasksDetail(task),
    execution_progress: task.executionProgress ?? null,
    // Timestamps
    created_at: task.createdAt,
    updated_at: task.updatedAt ?? task.createdAt,
    completed_at: task.completedAt ?? null,
  };
}

/**
 * Input type for creating a task (supports both camelCase and snake_case)
 */
interface CreateTaskInput {
  title?: string;
  description?: string;
  prompt?: string;
  status?: string;
  priority?: string;
  dev_type?: string;
  scope?: string;
  creator?: string;
  assignee?: string;
  sessionId?: string;
  session_id?: string;
  agentId?: string;
  agent_id?: string;
  taskIndex?: number;
  task_index?: number;
  // Workspace is REQUIRED
  workspacePath?: string;
  workspace_path?: string;
  executor?: string;
  auto_start?: boolean;
  model_id?: string;
  branch?: string;
  base_branch?: string;
}

/**
 * Input type for updating a task
 */
interface UpdateTaskInput {
  title?: string;
  description?: string;
  prompt?: string;
  status?: string;
  priority?: string;
  dev_type?: string;
  scope?: string;
  assignee?: string;
  cost?: number;
  duration?: number;
  favorite?: boolean;
  // Session/Agent fields
  sessionId?: string;
  session_id?: string;
  agentId?: string;
  agent_id?: string;
  // Kanban fields
  workspacePath?: string;
  workspace_path?: string;
  hasInProgressAttempt?: boolean;
  has_in_progress_attempt?: boolean;
  lastAttemptFailed?: boolean;
  last_attempt_failed?: boolean;
  executor?: string;
  // Git fields
  branch?: string;
  base_branch?: string;
  commit?: string;
  pr_url?: string;
}

// Store task directory paths by ID for lookups
const taskDirCache = new Map<string, { workspacePath: string; taskDir: string }>();

/**
 * Register task routes
 */
export function registerTaskRoutes(fastify: FastifyInstance, state: AppState): void {
  // List all tasks (requires workspace_path)
  fastify.get<{
    Querystring: { workspace_path?: string };
  }>("/api/tasks", {
    schema: {
      description: "List all tasks for a workspace (workspace_path required)",
      tags: ["tasks"],
      querystring: {
        type: "object",
        properties: {
          workspace_path: { type: "string", description: "Workspace path (required)" },
        },
        required: ["workspace_path"],
      },
      response: {
        200: {
          type: "object",
          properties: {
            tasks: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  name: { type: "string" },
                  title: { type: "string" },
                  description: { type: "string" },
                  status: { type: "string", enum: ["backlog", "queue", "in_progress", "ai_review", "human_review", "done", "pr_created", "error"] },
                  workspace_path: { type: "string" },
                  agent_id: { type: "string" },
                  session_id: { type: "string" },
                  task_index: { type: "number" },
                  prompt: { type: "string" },
                  cost: { type: "number" },
                  duration: { type: "number" },
                  favorite: { type: "boolean" },
                  has_in_progress_attempt: { type: "boolean" },
                  last_attempt_failed: { type: "boolean" },
                  executor: { type: "string" },
                  created_at: { type: "string" },
                  updated_at: { type: "string" },
                },
              },
            },
          },
        },
        400: {
          type: "object",
          properties: {
            error: { type: "string" },
          },
        },
      },
    },
  }, async (request, reply) => {
    const { workspace_path } = request.query;

    if (!workspace_path) {
      reply.code(400);
      return { error: "workspace_path is required" };
    }

    const tasks = await taskService.listTasks(workspace_path);

    // Cache task directories for ID lookups
    for (const task of tasks) {
      const taskDir = await taskService.findTaskById(workspace_path, task.id);
      if (taskDir) {
        taskDirCache.set(task.id, { workspacePath: workspace_path, taskDir });
      }
    }

    return { tasks: tasks.map(toSnakeCaseTask) };
  });

  // Get a specific task by ID (requires workspace_path query param or cached lookup)
  fastify.get<{
    Params: { id: string };
    Querystring: { workspace_path?: string };
  }>("/api/tasks/:id", {
    schema: {
      description: "Get a specific task by ID",
      tags: ["tasks"],
      params: {
        type: "object",
        properties: {
          id: { type: "string", description: "Task ID" },
        },
        required: ["id"],
      },
      querystring: {
        type: "object",
        properties: {
          workspace_path: { type: "string", description: "Workspace path" },
        },
      },
      response: {
        200: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            title: { type: "string" },
            description: { type: "string" },
            status: { type: "string" },
            workspace_path: { type: "string" },
            agent_id: { type: "string" },
            session_id: { type: "string" },
            task_index: { type: "number" },
            prompt: { type: "string" },
            cost: { type: "number" },
            duration: { type: "number" },
            favorite: { type: "boolean" },
            has_in_progress_attempt: { type: "boolean" },
            last_attempt_failed: { type: "boolean" },
            executor: { type: "string" },
            created_at: { type: "string" },
            updated_at: { type: "string" },
          },
        },
        404: {
          type: "object",
          properties: {
            error: { type: "string" },
          },
        },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params;
    const { workspace_path } = request.query;

    // Try to find task from cache or workspace
    let taskDir: string | null = null;
    let workspacePath = workspace_path;

    // Check cache first
    const cached = taskDirCache.get(id);
    if (cached) {
      taskDir = cached.taskDir;
      workspacePath = cached.workspacePath;
    } else if (workspace_path) {
      taskDir = await taskService.findTaskById(workspace_path, id);
    }

    if (!taskDir) {
      reply.code(404);
      return { error: `Task not found: ${id}. Provide workspace_path parameter.` };
    }

    const task = await taskService.getTask(taskDir);
    if (!task) {
      reply.code(404);
      return { error: `Task not found: ${id}` };
    }

    return toSnakeCaseTask(task);
  });

  // Create a new task (requires workspace_path)
  fastify.post<{ Body: CreateTaskInput }>("/api/tasks", async (request, reply) => {
    const input = request.body;
    const workspacePath = input.workspacePath || input.workspace_path;

    // Require workspace_path
    if (!workspacePath) {
      reply.code(400);
      return { error: "workspace_path is required to create a task" };
    }

    // Map input status to unified status
    let status: TaskStatus = "backlog";
    if (input.status) {
      status = taskService.normalizeStatus(input.status);
    }

    const taskInput: Partial<UnifiedTask> = {
      title: input.title || input.prompt?.slice(0, 100) || "Untitled",
      description: input.description,
      prompt: input.prompt || input.description,
      status,
      priority: input.priority || "P2",
      dev_type: input.dev_type,
      scope: input.scope,
      creator: input.creator,
      assignee: input.assignee,
      agent: input.agentId || input.agent_id,
      sessionId: input.sessionId || input.session_id,
      taskIndex: input.taskIndex || input.task_index || 0,
      branch: input.branch,
      base_branch: input.base_branch,
      executor: input.executor || "Agent",
      workspacePath,
    };

    try {
      const { taskDir, task } = await taskService.createTask(workspacePath, taskInput);

      // Cache the task directory
      taskDirCache.set(task.id, { workspacePath, taskDir });

      state.events.taskCreated(toDbTask(task));
      reply.code(201);
      return toSnakeCaseTask(task);
    } catch (e) {
      reply.code(400);
      return { error: e instanceof Error ? e.message : "Failed to create task" };
    }
  });

  // Update a task (supports both PATCH and PUT)
  const updateTaskHandler = async (
    request: { params: { id: string }; body: UpdateTaskInput; query: { workspace_path?: string } },
    reply: { code: (code: number) => void }
  ) => {
    const { id } = request.params;
    const updates = request.body;
    const { workspace_path } = request.query;

    try {
      // Find task directory
      let taskDir: string | null = null;
      let workspacePath = workspace_path;

      const cached = taskDirCache.get(id);
      if (cached) {
        taskDir = cached.taskDir;
        workspacePath = cached.workspacePath;
      } else if (workspace_path) {
        taskDir = await taskService.findTaskById(workspace_path, id);
      }

      if (!taskDir) {
        reply.code(404);
        return { error: `Task not found: ${id}. Provide workspace_path parameter.` };
      }

      const existingTask = await taskService.getTask(taskDir);
      if (!existingTask) {
        reply.code(404);
        return { error: `Task not found: ${id}` };
      }

      // Build update object
      const taskUpdates: Partial<UnifiedTask> = {};
      if (updates.title !== undefined) taskUpdates.title = updates.title;
      if (updates.description !== undefined) taskUpdates.description = updates.description;
      if (updates.prompt !== undefined) taskUpdates.prompt = updates.prompt;
      if (updates.status !== undefined) {
        taskUpdates.status = taskService.normalizeStatus(updates.status);
      }
      if (updates.priority !== undefined) taskUpdates.priority = updates.priority;
      if (updates.dev_type !== undefined) taskUpdates.dev_type = updates.dev_type;
      if (updates.scope !== undefined) taskUpdates.scope = updates.scope;
      if (updates.assignee !== undefined) taskUpdates.assignee = updates.assignee;
      if (updates.cost !== undefined) taskUpdates.cost = updates.cost;
      if (updates.duration !== undefined) taskUpdates.duration = updates.duration;
      if (updates.favorite !== undefined) taskUpdates.favorite = updates.favorite;

      // Session/Agent fields
      const sessionId = updates.sessionId ?? updates.session_id;
      if (sessionId !== undefined) taskUpdates.sessionId = sessionId;
      const agentId = updates.agentId ?? updates.agent_id;
      if (agentId !== undefined) taskUpdates.agent = agentId;

      // Kanban fields
      const newWorkspacePath = updates.workspacePath ?? updates.workspace_path;
      if (newWorkspacePath !== undefined) taskUpdates.workspacePath = newWorkspacePath;
      const hasInProgressAttempt = updates.hasInProgressAttempt ?? updates.has_in_progress_attempt;
      if (hasInProgressAttempt !== undefined) taskUpdates.hasInProgressAttempt = hasInProgressAttempt;
      const lastAttemptFailed = updates.lastAttemptFailed ?? updates.last_attempt_failed;
      if (lastAttemptFailed !== undefined) taskUpdates.lastAttemptFailed = lastAttemptFailed;
      if (updates.executor !== undefined) taskUpdates.executor = updates.executor;

      // Git fields
      if (updates.branch !== undefined) taskUpdates.branch = updates.branch;
      if (updates.base_branch !== undefined) taskUpdates.base_branch = updates.base_branch;
      if (updates.commit !== undefined) taskUpdates.commit = updates.commit;
      if (updates.pr_url !== undefined) taskUpdates.pr_url = updates.pr_url;

      const task = await taskService.updateTask(taskDir, taskUpdates);

      state.events.taskUpdated(toDbTask(task));
      if (updates.status && existingTask.status !== task.status) {
        state.events.taskStatusChanged(id, existingTask.status, task.status);
      }

      return toSnakeCaseTask(task);
    } catch (e) {
      reply.code(400);
      return { error: e instanceof Error ? e.message : "Failed to update task" };
    }
  };

  fastify.patch<{ Params: { id: string }; Body: UpdateTaskInput; Querystring: { workspace_path?: string } }>(
    "/api/tasks/:id",
    updateTaskHandler
  );

  // Also support PUT for kanban compatibility
  fastify.put<{ Params: { id: string }; Body: UpdateTaskInput; Querystring: { workspace_path?: string } }>(
    "/api/tasks/:id",
    updateTaskHandler
  );

  // Delete a task
  fastify.delete<{ Params: { id: string }; Querystring: { workspace_path?: string } }>(
    "/api/tasks/:id",
    async (request, reply) => {
      const { id } = request.params;
      const { workspace_path } = request.query;

      try {
        // Find task directory
        let taskDir: string | null = null;

        const cached = taskDirCache.get(id);
        if (cached) {
          taskDir = cached.taskDir;
        } else if (workspace_path) {
          taskDir = await taskService.findTaskById(workspace_path, id);
        }

        if (!taskDir) {
          reply.code(404);
          return { error: `Task not found: ${id}. Provide workspace_path parameter.` };
        }

        const deleted = await taskService.deleteTask(taskDir);
        if (!deleted) {
          reply.code(404);
          return { error: `Task not found: ${id}` };
        }

        // Remove from cache
        taskDirCache.delete(id);

        state.events.taskDeleted(id);
        return { deleted: id };
      } catch (e) {
        reply.code(400);
        return { error: e instanceof Error ? e.message : "Failed to delete task" };
      }
    }
  );

  // Get tasks by agent (requires workspace_path)
  fastify.get<{ Params: { agentId: string }; Querystring: { workspace_path?: string } }>(
    "/api/agents/:agentId/tasks",
    async (request, reply) => {
      const { agentId } = request.params;
      const { workspace_path } = request.query;

      if (!workspace_path) {
        reply.code(400);
        return { error: "workspace_path is required" };
      }

      const allTasks = await taskService.listTasks(workspace_path);
      const tasks = allTasks.filter((t) => t.agent === agentId);
      return { tasks: tasks.map(toSnakeCaseTask) };
    }
  );

  // List tasks by session (requires workspace_path)
  fastify.get<{
    Params: { agentId: string; sessionId: string };
    Querystring: { workspace_path?: string };
  }>("/api/agents/:agentId/sessions/:sessionId/tasks", async (request, reply) => {
    const { sessionId } = request.params;
    const { workspace_path } = request.query;

    if (!workspace_path) {
      reply.code(400);
      return { error: "workspace_path is required" };
    }

    try {
      const allTasks = await taskService.listTasks(workspace_path);
      const tasks = allTasks.filter((t) => t.sessionId === sessionId);
      // Sort by taskIndex
      tasks.sort((a, b) => (a.taskIndex ?? 0) - (b.taskIndex ?? 0));
      return { tasks: tasks.map(toSnakeCaseTask) };
    } catch (error) {
      reply.code(500);
      return { error: error instanceof Error ? error.message : "Failed to list tasks" };
    }
  });

  // Get task messages (uses sessionStoreService for UI messages)
  fastify.get<{
    Params: { agentId: string; sessionId: string; taskId: string };
  }>("/api/agents/:agentId/sessions/:sessionId/tasks/:taskId/messages", async (request, reply) => {
    const { agentId, sessionId, taskId } = request.params;
    try {
      const messages = await sessionStoreService.readUIMessagesByTask(agentId, sessionId, taskId);
      return { messages };
    } catch (error) {
      reply.code(500);
      return { error: error instanceof Error ? error.message : "Failed to get messages" };
    }
  });

  // Get task specs data (PRD, subtasks, logs, files)
  fastify.get<{
    Params: { id: string };
    Querystring: { workspace_path?: string };
  }>("/api/tasks/:id/specs", {
    schema: {
      description: "Get task specs data (PRD, subtasks, logs, files)",
      tags: ["tasks"],
      params: {
        type: "object",
        properties: {
          id: { type: "string", description: "Task ID" },
        },
        required: ["id"],
      },
      querystring: {
        type: "object",
        properties: {
          workspace_path: { type: "string", description: "Workspace path" },
        },
      },
      response: {
        200: {
          type: "object",
          properties: {
            prd_content: { type: "string", nullable: true },
            prd_path: { type: "string", nullable: true },
            subtasks: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  title: { type: "string" },
                  description: { type: "string" },
                  status: { type: "string", enum: ["pending", "in_progress", "completed", "failed"] },
                  files: { type: "array", items: { type: "string" } },
                  order: { type: "number" },
                },
              },
            },
            logs: {
              type: "object",
              nullable: true,
              properties: {
                phases: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      name: { type: "string" },
                      status: { type: "string", enum: ["pending", "running", "complete", "failed"] },
                      entries: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            id: { type: "string" },
                            type: { type: "string" },
                            message: { type: "string" },
                            timestamp: { type: "string" },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            task_dir: { type: "string", description: "Task directory path for file browsing" },
          },
        },
        404: {
          type: "object",
          properties: {
            error: { type: "string" },
          },
        },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params;
    const { workspace_path } = request.query;

    console.log(`[tasks/specs] Getting specs for task ${id}, workspace: ${workspace_path}`);

    // Find task directory
    let taskDir: string | null = null;
    let workspacePath = workspace_path;

    // Check cache first
    const cached = taskDirCache.get(id);
    if (cached) {
      console.log(`[tasks/specs] Found in cache: ${cached.taskDir}`);
      taskDir = cached.taskDir;
      workspacePath = cached.workspacePath;
    } else if (workspace_path) {
      console.log(`[tasks/specs] Searching for task by ID...`);
      taskDir = await taskService.findTaskById(workspace_path, id);
      console.log(`[tasks/specs] findTaskById result: ${taskDir}`);
    }

    if (!taskDir) {
      console.log(`[tasks/specs] Task not found: ${id}`);
      reply.code(404);
      return { error: `Task not found: ${id}. Provide workspace_path parameter.` };
    }

    try {
      const specsData = await taskService.getTaskSpecsData(taskDir);
      console.log(`[tasks/specs] Specs data loaded, taskDir: ${specsData.taskDir}`);

      // Convert to snake_case for API response
      return {
        prd_content: specsData.prdContent,
        prd_path: specsData.prdPath,
        subtasks: specsData.subtasks,
        logs: specsData.logs,
        task_dir: specsData.taskDir,
      };
    } catch (error) {
      console.error(`[tasks/specs] Error:`, error);
      reply.code(500);
      return { error: error instanceof Error ? error.message : "Failed to get task specs" };
    }
  });
}
