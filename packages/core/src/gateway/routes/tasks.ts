/**
 * Task routes (unified workspace-based storage)
 *
 * Provides REST endpoints for task operations using workspace-based storage:
 * - GET /api/tasks - List all tasks (requires workspace_path)
 * - GET /api/tasks/:id - Get task by ID (requires workspace_path)
 * - POST /api/tasks - Create a new task (requires workspace_path)
 * - PATCH /api/tasks/:id - Update a task
 * - DELETE /api/tasks/:id - Delete a task
 * - GET /api/agent/:agentId/tasks - Get tasks by agent
 * - GET /api/agent/:agentId/sessions/:sessionId/tasks - List tasks by session
 * - GET /api/agent/:agentId/sessions/:sessionId/tasks/:taskId/messages - Get task messages
 *
 * IMPORTANT: All tasks are stored in workspace directories:
 * <workspace>/.viben/tasks/<date>-<slug>/task.json
 */
import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import {
  taskService,
  type UnifiedTask,
  type TaskStatus,
  type SubtaskInfo,
  type TaskSpecsData,
} from "../../services/task-service";
import { sessionStoreService } from "../../services/session-store";
import { taskEventStore } from "../../task/events/event-store";
import { isValidEventType, type TaskEventType } from "../../task/events/event-types";
import type { TaskEvent } from "../../task/events/task-event";
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
    last_attempt_failed: task.lastAttemptFailed ?? task.status === "failed",
    executor: task.executor || "Agent",
    // Subtask visualization
    subtasks_detail: parseSubtasksDetail(task),
    execution_progress: task.executionProgress ?? null,
    // Timestamps
    created_at: task.createdAt,
    updated_at: task.updatedAt ?? task.createdAt,
    completed_at: task.completedAt ?? null,
    // Template flag
    is_template: task.is_template ?? false,
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
  // Template support
  copy_from?: string;    // Source task directory to copy config from
  is_template?: boolean; // Mark this task as a template
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
  // Template support
  is_template?: boolean;
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

/**
 * Task directory cache with TTL and LRU eviction
 *
 * Configuration:
 * - TTL: 5 minutes (300,000 ms)
 * - Max size: 1000 entries
 * - Eviction: LRU (least recently used)
 */
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const CACHE_MAX_SIZE = 1000;

interface CacheEntry {
  workspacePath: string;
  taskDir: string;
  /** Timestamp when this entry was last accessed */
  lastAccessed: number;
  /** Timestamp when this entry was created */
  createdAt: number;
}

// Store task directory paths by ID for lookups with TTL
const taskDirCache = new Map<string, CacheEntry>();

/**
 * Get an entry from cache, updating last accessed time
 * Returns null if entry is expired or not found
 */
function getCacheEntry(taskId: string): CacheEntry | null {
  const entry = taskDirCache.get(taskId);
  if (!entry) return null;

  const now = Date.now();
  // Check if entry is expired
  if (now - entry.createdAt > CACHE_TTL_MS) {
    taskDirCache.delete(taskId);
    return null;
  }

  // Update last accessed time
  entry.lastAccessed = now;
  return entry;
}

/**
 * Set a cache entry, evicting LRU entries if necessary
 */
function setCacheEntry(taskId: string, workspacePath: string, taskDir: string): void {
  const now = Date.now();

  // Evict oldest entries if at capacity
  if (taskDirCache.size >= CACHE_MAX_SIZE) {
    // Find and remove LRU entry
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of taskDirCache) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      taskDirCache.delete(oldestKey);
    }
  }

  taskDirCache.set(taskId, {
    workspacePath,
    taskDir,
    lastAccessed: now,
    createdAt: now,
  });
}

/**
 * Remove a task from cache
 */
function deleteCacheEntry(taskId: string): void {
  taskDirCache.delete(taskId);
}

/**
 * Register task routes
 */
export function registerTaskRoutes(fastify: FastifyInstance, state: AppState): void {
  // List all tasks (requires workspace_path)
  fastify.get<{
    Querystring: { workspace_path?: string; is_template?: string };
  }>("/api/tasks", {
    schema: {
      description: "List all tasks for a workspace (workspace_path required)",
      tags: ["tasks"],
      querystring: {
        type: "object",
        properties: {
          workspace_path: { type: "string", description: "Workspace path (required)" },
          is_template: { type: "string", description: "Filter by template status (true/false)" },
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
                  status: { type: "string", enum: ["backlog", "queue", "in_progress", "paused", "human_review", "completed", "failed", "cancelled"] },
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
    const { workspace_path, is_template } = request.query;

    if (!workspace_path) {
      reply.code(400);
      return { error: "workspace_path is required" };
    }

    let tasks = await taskService.listTasks(workspace_path);

    // Filter by is_template if specified
    if (is_template !== undefined) {
      const isTemplateFilter = is_template === "true";
      tasks = tasks.filter((t) => (t.is_template ?? false) === isTemplateFilter);
    }

    // Cache task directories for ID lookups
    for (const task of tasks) {
      const taskDir = await taskService.findTaskById(workspace_path, task.id);
      if (taskDir) {
        setCacheEntry(task.id, workspace_path, taskDir);
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

    // Check cache first (with TTL validation)
    const cached = getCacheEntry(id);
    if (cached) {
      taskDir = cached.taskDir;
      workspacePath = cached.workspacePath;
    } else if (workspace_path) {
      taskDir = await taskService.findTaskById(workspace_path, id);
      // Cache the result if found
      if (taskDir) {
        setCacheEntry(id, workspace_path, taskDir);
      }
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
  // Supports:
  // - copy_from: Copy configuration from existing task
  // - is_template: Mark as a template
  fastify.post<{ Body: CreateTaskInput }>("/api/tasks", async (request, reply) => {
    const input = request.body;
    const workspacePath = input.workspacePath || input.workspace_path;

    // Require workspace_path
    if (!workspacePath) {
      reply.code(400);
      return { error: "workspace_path is required to create a task" };
    }

    // If copy_from is specified, load the source task first
    let sourceTask: UnifiedTask | null = null;
    if (input.copy_from) {
      // copy_from can be a task directory path or task ID
      const sourceDir = input.copy_from.includes("/")
        ? input.copy_from
        : await taskService.findTaskById(workspacePath, input.copy_from);

      if (sourceDir) {
        sourceTask = await taskService.getTask(sourceDir);
      }

      if (!sourceTask) {
        reply.code(400);
        return { error: `Source task not found: ${input.copy_from}` };
      }
    }

    // Map input status to unified status
    let status: TaskStatus = "backlog";
    if (input.status) {
      status = taskService.normalizeStatus(input.status);
    }

    // Build task input, merging from source task if copying
    const taskInput: Partial<UnifiedTask> = {
      // Use source task values as defaults, then override with explicit input
      title: input.title || sourceTask?.title || input.prompt?.slice(0, 100) || "Untitled",
      description: input.description ?? sourceTask?.description,
      prompt: input.prompt ?? sourceTask?.prompt ?? input.description,
      status,
      priority: input.priority ?? sourceTask?.priority ?? "P2",
      dev_type: input.dev_type ?? sourceTask?.dev_type,
      scope: input.scope ?? sourceTask?.scope,
      creator: input.creator ?? sourceTask?.creator,
      assignee: input.assignee ?? sourceTask?.assignee,
      agent: input.agentId || input.agent_id || sourceTask?.agent,
      sessionId: input.sessionId || input.session_id, // Don't copy sessionId - each task needs its own
      taskIndex: input.taskIndex || input.task_index || 0,
      branch: input.branch ?? sourceTask?.branch,
      base_branch: input.base_branch ?? sourceTask?.base_branch,
      executor: input.executor ?? sourceTask?.executor ?? "Agent",
      model: input.model_id ?? sourceTask?.model, // Copy model from source task
      workspacePath,
      // Template flag
      is_template: input.is_template ?? false,
    };

    try {
      const { taskDir, task } = await taskService.createTask(workspacePath, taskInput);

      // Cache the task directory
      setCacheEntry(task.id, workspacePath, taskDir);

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

      const cached = getCacheEntry(id);
      if (cached) {
        taskDir = cached.taskDir;
        workspacePath = cached.workspacePath;
      } else if (workspace_path) {
        taskDir = await taskService.findTaskById(workspace_path, id);
        // Cache the result if found
        if (taskDir) {
          setCacheEntry(id, workspace_path, taskDir);
        }
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
      if (updates.is_template !== undefined) taskUpdates.is_template = updates.is_template;

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

        const cached = getCacheEntry(id);
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
        deleteCacheEntry(id);

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
    "/api/agent/:agentId/tasks",
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
  }>("/api/agent/:agentId/sessions/:sessionId/tasks", async (request, reply) => {
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
  }>("/api/agent/:agentId/sessions/:sessionId/tasks/:taskId/messages", async (request, reply) => {
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

    // Check cache first (with TTL validation)
    const cached = getCacheEntry(id);
    if (cached) {
      console.log(`[tasks/specs] Found in cache: ${cached.taskDir}`);
      taskDir = cached.taskDir;
      workspacePath = cached.workspacePath;
    } else if (workspace_path) {
      console.log(`[tasks/specs] Searching for task by ID...`);
      taskDir = await taskService.findTaskById(workspace_path, id);
      console.log(`[tasks/specs] findTaskById result: ${taskDir}`);
      // Cache the result if found
      if (taskDir) {
        setCacheEntry(id, workspace_path, taskDir);
      }
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

  // ============================================================================
  // POST /api/tasks/batch/events - Apply event to multiple tasks
  // Supports batch operations like QUEUE, PAUSE, RESUME, CANCEL, DEQUEUE
  // ============================================================================
  fastify.post<{
    Body: {
      workspace_path: string;
      task_dirs: string[];
      event_type: string;
      payload?: Record<string, unknown>;
    };
  }>("/api/tasks/batch/events", {
    schema: {
      description: "Apply an event to multiple tasks (batch operation)",
      tags: ["tasks"],
      body: {
        type: "object",
        properties: {
          workspace_path: { type: "string", description: "Workspace path (required)" },
          task_dirs: {
            type: "array",
            items: { type: "string" },
            description: "Task directories or IDs to apply event to",
          },
          event_type: { type: "string", description: "Event type to apply" },
          payload: { type: "object", description: "Optional event payload" },
        },
        required: ["workspace_path", "task_dirs", "event_type"],
      },
      response: {
        200: {
          type: "object",
          properties: {
            results: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  task_dir: { type: "string" },
                  success: { type: "boolean" },
                  error: { type: "string" },
                  new_state: { type: "string" },
                },
              },
            },
            summary: {
              type: "object",
              properties: {
                total: { type: "number" },
                succeeded: { type: "number" },
                failed: { type: "number" },
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
    const { workspace_path, task_dirs, event_type, payload } = request.body;

    // Validate workspace_path
    if (!workspace_path) {
      reply.code(400);
      return { error: "workspace_path is required" };
    }

    // Validate event_type
    if (!isValidEventType(event_type)) {
      reply.code(400);
      return { error: `Invalid event type: ${event_type}` };
    }

    // Validate task_dirs
    if (!task_dirs || task_dirs.length === 0) {
      reply.code(400);
      return { error: "task_dirs must be a non-empty array" };
    }

    // Process each task
    const results = await Promise.all(
      task_dirs.map(async (taskDirOrId) => {
        try {
          // Resolve task directory (handles both directory paths and task IDs)
          const taskDir = taskDirOrId.includes("/")
            ? taskDirOrId
            : await taskService.findTaskById(workspace_path, taskDirOrId);

          if (!taskDir) {
            return {
              task_dir: taskDirOrId,
              success: false,
              error: "Task not found",
            };
          }

          // Get current task state
          const task = await taskService.getTask(taskDir);
          if (!task) {
            return {
              task_dir: taskDirOrId,
              success: false,
              error: "Task not found",
            };
          }

          // Create event
          const nextSequence = (task.lastEvent?.sequence ?? 0) + 1;
          const event: TaskEvent = {
            eventId: randomUUID(),
            sequence: nextSequence,
            type: event_type as TaskEventType,
            timestamp: new Date().toISOString(),
            payload,
          };

          // Apply event
          const result = await taskEventStore.applyEvent(taskDir, event);

          if (!result.success) {
            return {
              task_dir: taskDirOrId,
              success: false,
              error: result.error,
            };
          }

          return {
            task_dir: taskDirOrId,
            success: true,
            new_state: result.newState,
          };
        } catch (error) {
          return {
            task_dir: taskDirOrId,
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          };
        }
      })
    );

    // Calculate summary
    const succeeded = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    return {
      results,
      summary: {
        total: results.length,
        succeeded,
        failed,
      },
    };
  });

  // ============================================================================
  // GET /api/tasks/:id/running - Check if a task's execution process is running
  // Used by stuck detection to verify if "in_progress" tasks are actually executing
  // ============================================================================
  fastify.get<{
    Params: { id: string };
    Querystring: { workspace_path?: string };
  }>("/api/tasks/:id/running", {
    schema: {
      description: "Check if a task's execution process is currently running",
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
            success: { type: "boolean" },
            data: {
              type: "object",
              properties: {
                task_id: { type: "string" },
                running: { type: "boolean" },
                status: { type: "string" },
              },
            },
          },
        },
        404: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            error: { type: "string" },
          },
        },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params;
    const { workspace_path } = request.query;

    // Find task directory
    let taskDir: string | null = null;
    let workspacePath = workspace_path;

    // Check cache first
    const cached = getCacheEntry(id);
    if (cached) {
      taskDir = cached.taskDir;
      workspacePath = cached.workspacePath;
    } else if (workspace_path) {
      taskDir = await taskService.findTaskById(workspace_path, id);
      if (taskDir) {
        setCacheEntry(id, workspace_path, taskDir);
      }
    }

    if (!taskDir) {
      reply.code(404);
      return {
        success: false,
        error: `Task not found: ${id}`,
      };
    }

    const task = await taskService.getTask(taskDir);
    if (!task) {
      reply.code(404);
      return {
        success: false,
        error: `Task not found: ${id}`,
      };
    }

    // Check if task is in a running state
    const isInProgress = task.status === "in_progress" || task.hasInProgressAttempt;

    if (!isInProgress) {
      // Task is not in progress, so no process should be running
      return {
        success: true,
        data: {
          task_id: id,
          running: false,
          status: task.status,
        },
      };
    }

    // Task is marked as in_progress, check if there's an actual queue task running
    // Try to find the queue task by looking for tasks with matching session_id
    let isRunning = false;

    if (task.sessionId && state.taskQueue) {
      // Get all running queue tasks
      const queueTasks = state.taskQueue.getTasks("running");

      // Check if any queue task matches this task's session
      isRunning = queueTasks.some((qt) =>
        qt.payload.session_id === task.sessionId
      );
    }

    return {
      success: true,
      data: {
        task_id: id,
        running: isRunning,
        status: task.status,
      },
    };
  });
}
