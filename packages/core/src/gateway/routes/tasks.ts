/**
 * Task REST API routes (unified workspace-based storage)
 *
 * Provides REST-style endpoints for task CRUD operations:
 * - GET /api/tasks - List all tasks (requires workspace_path)
 * - GET /api/tasks/:id - Get task by ID (requires workspace_path)
 * - POST /api/tasks - Create a new task (requires workspace_path)
 * - PATCH /api/tasks/:id - Update a task
 * - DELETE /api/tasks/:id - Delete a task
 * - GET /api/tasks/:id/specs - Get task PRD/subtasks/logs
 * - POST /api/tasks/batch/events - Apply event to multiple tasks
 * - GET /api/tasks/:id/running - Check if task execution is running
 *
 * Agent-related task endpoints:
 * - GET /api/agent/:agentId/tasks - Get tasks by agent
 * - GET /api/agent/:agentId/sessions/:sessionId/tasks - List tasks by session
 * - GET /api/agent/:agentId/sessions/:sessionId/tasks/:taskId/messages - Get task messages
 *
 * For CLI-style POST /api/task/* endpoints, see ./task.ts
 *
 * IMPORTANT: All tasks are stored in workspace directories:
 * <workspace>/.viben/tasks/<date>-<slug>/task.json
 */
import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  taskService,
  type UnifiedTask,
  type TaskStatus,
  type SubtaskInfo,
  type IssuePriority,
  DEFAULT_PRIORITY,
} from "../../task/service";
import { logger as globalLogger } from "../../telemetry";

// Module-level logger
const log = globalLogger.child({ module: "tasks" });
import { sessionStoreService } from "../../services/session-store";
import { taskEventStore } from "../../task/events/event-store";
import { isValidEventType, type TaskEventType } from "../../task/events/event-types";
import type { TaskEvent } from "../../task/events/task-event";
import type { AppState } from "../state";
import type { Task, TaskStatus as DbTaskStatus } from "../../db/types";
import { taskSSEManager } from "../sse/task-sse-manager";
import {
  resolveTaskDirectory,
  readTaskJson as readTaskJsonFromWorkspace,
  DIR_VIBEN,
  DIR_TASKS,
  FILE_TASK_JSON,
} from "../../cli/lib/viben-workspace";

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
    created_at: task.created_at,
    updated_at: task.updated_at || task.created_at,
  };
}

/**
 * Parse subtasks into structured format
 * If subtaskDetails exists, use it; otherwise parse from subtasks string array
 */
function parseSubtasksDetail(task: UnifiedTask): SubtaskInfo[] | null {
  // Prefer structured subtaskDetails if available
  if (task.subtask_details && task.subtask_details.length > 0) {
    return task.subtask_details;
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
export function toSnakeCaseTask(task: UnifiedTask) {
  return {
    id: task.id,
    name: task.name,
    title: task.title || task.prompt?.slice(0, 100) || "Untitled",
    description: task.description || task.prompt || null,
    status: task.status,
    // Status details
    review_reason: task.review_reason ?? null,
    current_phase: task.current_phase ?? 0,
    next_action: task.next_action ?? null,
    // Organization fields
    priority: task.priority || DEFAULT_PRIORITY,
    workspace_path: task.workspace_path ?? null,
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
    session_id: task.session_id ?? null,
    task_index: task.task_index ?? 0,
    prompt: task.prompt ?? null,
    // Execution info
    cost: task.cost ?? null,
    duration: task.duration ?? null,
    favorite: task.favorite ?? false,
    executor: task.executor || "Agent",
    // Subtask visualization
    subtasks_detail: parseSubtasksDetail(task),
    execution_progress: task.execution_progress ?? null,
    // Timestamps
    created_at: task.created_at,
    updated_at: task.updated_at ?? task.created_at,
    completed_at: task.completed_at ?? null,
    // Template flag
    is_template: task.is_template ?? false,
  };
}

// =============================================================================
// Session/Journal Helper Functions
// =============================================================================

/**
 * Get the latest journal file info from workspace directory
 */
function getLatestJournalInfo(dev_dir: string): {
  file: string | null;
  number: number;
  lines: number;
} {
  if (!existsSync(dev_dir)) {
    return { file: null, number: 0, lines: 0 };
  }

  let latestFile: string | null = null;
  let latestNum = -1;

  try {
    const files = readdirSync(dev_dir);
    for (const file of files) {
      if (file.startsWith("journal-") && file.endsWith(".md")) {
        const match = file.match(/journal-(\d+)\.md$/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > latestNum) {
            latestNum = num;
            latestFile = join(dev_dir, file);
          }
        }
      }
    }
  } catch {
    // Ignore errors
  }

  if (latestFile) {
    let lines = 0;
    try {
      const content = readFileSync(latestFile, "utf-8");
      const splitLines = content.split("\n");
      if (splitLines.length > 0 && splitLines[splitLines.length - 1] === "") {
        lines = splitLines.length - 1;
      } else {
        lines = splitLines.length;
      }
    } catch {
      // Ignore errors
    }
    return { file: latestFile, number: latestNum, lines };
  }

  return { file: null, number: 0, lines: 0 };
}

/**
 * Get current session number from index.md by parsing "Total Sessions" line
 */
function getSessionNumberFromIndex(index_path: string): number {
  if (!existsSync(index_path)) {
    return 0;
  }

  try {
    const content = readFileSync(index_path, "utf-8");
    for (const line of content.split("\n")) {
      if (line.includes("Total Sessions")) {
        const match = line.match(/:\s*(\d+)/);
        if (match) {
          return parseInt(match[1], 10);
        }
      }
    }
  } catch {
    // Ignore errors
  }

  return 0;
}

/**
 * Generate session content markdown
 */
function generateSessionMarkdown(params: {
  session_num: number;
  title: string;
  commit: string;
  summary: string;
  extra_content: string;
  date: string;
}): string {
  const { session_num, title, commit, summary, extra_content, date } = params;

  let commitTable: string;
  if (commit && commit !== "-") {
    const lines = ["| Hash | Message |", "|------|---------|"];
    for (const c of commit.split(",")) {
      const trimmed = c.trim();
      lines.push(`| \`${trimmed}\` | (see git log) |`);
    }
    commitTable = lines.join("\n");
  } else {
    commitTable = "(No commits - planning session)";
  }

  return `

## Session ${session_num}: ${title}

**Date**: ${date}
**Task**: ${title}

### Summary

${summary}

### Main Changes

${extra_content}

### Git Commits

${commitTable}

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete
`;
}

/**
 * Create a new journal file when current one exceeds MAX_LINES
 */
function createNewJournalFileSync(
  dev_dir: string,
  number: number,
  developer: string,
  date: string,
  prevNumber: number
): string {
  const newFilePath = join(dev_dir, `journal-${number}.md`);
  const maxLines = 2000;

  const content = `# Journal - ${developer} (Part ${number})

> Continuation from \`journal-${prevNumber}.md\` (archived at ~${maxLines} lines)
> Started: ${date}

---

`;

  writeFileSync(newFilePath, content, "utf-8");
  return newFilePath;
}

/**
 * Count journal files and return markdown table rows
 */
function countJournalFilesTable(dev_dir: string, activeNum: number): string {
  const active_file = `journal-${activeNum}.md`;
  const resultLines: string[] = [];

  try {
    const files = readdirSync(dev_dir)
      .filter((f) => f.startsWith("journal-") && f.endsWith(".md"))
      .sort((a, b) => {
        const numA = parseInt(a.match(/(\d+)/)?.[1] ?? "0", 10);
        const numB = parseInt(b.match(/(\d+)/)?.[1] ?? "0", 10);
        return numB - numA;
      });

    for (const filename of files) {
      const filePath = join(dev_dir, filename);
      let lines = 0;
      try {
        const content = readFileSync(filePath, "utf-8");
        const splitLines = content.split("\n");
        if (splitLines.length > 0 && splitLines[splitLines.length - 1] === "") {
          lines = splitLines.length - 1;
        } else {
          lines = splitLines.length;
        }
      } catch {
        // Ignore errors
      }
      const status = filename === active_file ? "Active" : "Archived";
      resultLines.push(`| \`${filename}\` | ~${lines} | ${status} |`);
    }
  } catch {
    // Ignore errors
  }

  return resultLines.join("\n");
}

/**
 * Update index.md with new session info
 */
function updateIndexWithNewSession(params: {
  index_path: string;
  dev_dir: string;
  session_num: number;
  title: string;
  commit: string;
  active_file: string;
  date: string;
}): boolean {
  const { index_path, dev_dir, session_num, title, commit, active_file, date } = params;

  if (!existsSync(index_path)) {
    return false;
  }

  let commitDisplay = "-";
  if (commit && commit !== "-") {
    commitDisplay = commit
      .split(",")
      .map((c) => `\`${c.trim()}\``)
      .join(", ");
  }

  const match = active_file.match(/journal-(\d+)\.md$/);
  const activeNum = match ? parseInt(match[1], 10) : 0;
  const filesTable = countJournalFilesTable(dev_dir, activeNum);

  try {
    const content = readFileSync(index_path, "utf-8");

    if (!content.includes("@@@auto:current-status")) {
      return false;
    }

    const lines = content.split("\n");
    const newLines: string[] = [];

    let inCurrentStatus = false;
    let inActiveDocuments = false;
    let inSessionHistory = false;
    let headerWritten = false;

    for (const line of lines) {
      if (line.includes("@@@auto:current-status")) {
        newLines.push(line);
        inCurrentStatus = true;
        newLines.push(`- **Active File**: \`${active_file}\``);
        newLines.push(`- **Total Sessions**: ${session_num}`);
        newLines.push(`- **Last Active**: ${date}`);
        continue;
      }

      if (line.includes("@@@/auto:current-status")) {
        inCurrentStatus = false;
        newLines.push(line);
        continue;
      }

      if (line.includes("@@@auto:active-documents")) {
        newLines.push(line);
        inActiveDocuments = true;
        newLines.push("| File | Lines | Status |");
        newLines.push("|------|-------|--------|");
        newLines.push(filesTable);
        continue;
      }

      if (line.includes("@@@/auto:active-documents")) {
        inActiveDocuments = false;
        newLines.push(line);
        continue;
      }

      if (line.includes("@@@auto:session-history")) {
        newLines.push(line);
        inSessionHistory = true;
        headerWritten = false;
        continue;
      }

      if (line.includes("@@@/auto:session-history")) {
        inSessionHistory = false;
        newLines.push(line);
        continue;
      }

      if (inCurrentStatus) {
        continue;
      }

      if (inActiveDocuments) {
        continue;
      }

      if (inSessionHistory) {
        newLines.push(line);
        if (/^\|\s*-/.test(line) && !headerWritten) {
          newLines.push(`| ${session_num} | ${date} | ${title} | ${commitDisplay} |`);
          headerWritten = true;
        }
        continue;
      }

      newLines.push(line);
    }

    writeFileSync(index_path, newLines.join("\n"), "utf-8");
    return true;
  } catch {
    return false;
  }
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
  workspace_path: string;
  task_dir: string;
  /** Timestamp when this entry was last accessed */
  last_accessed: number;
  /** Timestamp when this entry was created */
  created_at: number;
}

// Store task directory paths by ID for lookups with TTL
const taskDirCache = new Map<string, CacheEntry>();

/**
 * Get an entry from cache, updating last accessed time
 * Returns null if entry is expired or not found
 */
export function getCacheEntry(taskId: string): CacheEntry | null {
  const entry = taskDirCache.get(taskId);
  if (!entry) return null;

  const now = Date.now();
  // Check if entry is expired
  if (now - entry.created_at > CACHE_TTL_MS) {
    taskDirCache.delete(taskId);
    return null;
  }

  // Update last accessed time
  entry.last_accessed = now;
  return entry;
}

/**
 * Set a cache entry, evicting LRU entries if necessary
 */
export function setCacheEntry(taskId: string, workspacePath: string, taskDir: string): void {
  const now = Date.now();

  // Evict oldest entries if at capacity
  if (taskDirCache.size >= CACHE_MAX_SIZE) {
    // Find and remove LRU entry
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of taskDirCache) {
      if (entry.last_accessed < oldestTime) {
        oldestTime = entry.last_accessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      taskDirCache.delete(oldestKey);
    }
  }

  taskDirCache.set(taskId, {
    workspace_path: workspacePath,
    task_dir: taskDir,
    last_accessed: now,
    created_at: now,
  });
}

/**
 * Remove a task from cache
 */
export function deleteCacheEntry(taskId: string): void {
  taskDirCache.delete(taskId);
}

/**
 * Register task routes
 */
export function registerTasksRoutes(fastify: FastifyInstance, state: AppState): void {
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
                  name: { type: "string", nullable: true },
                  title: { type: "string" },
                  description: { type: "string", nullable: true },
                  status: { type: "string", enum: ["backlog", "queue", "in_progress", "paused", "review", "completed", "failed", "cancelled", "archived"] },
                  review_reason: { type: "string", nullable: true },
                  current_phase: { type: "number", nullable: true },
                  next_action: {
                    type: "array",
                    nullable: true,
                    items: {
                      type: "object",
                      properties: {
                        phase: { type: "number" },
                        action: { type: "string" },
                      },
                    },
                  },
                  priority: { type: "string", enum: ["urgent", "high", "medium", "low", "none"] },
                  workspace_path: { type: "string", nullable: true },
                  // People
                  creator: { type: "string", nullable: true },
                  assignee: { type: "string", nullable: true },
                  // Git integration
                  branch: { type: "string", nullable: true },
                  base_branch: { type: "string", nullable: true },
                  worktree_path: { type: "string", nullable: true },
                  commit: { type: "string", nullable: true },
                  pr_url: { type: "string", nullable: true },
                  // Agent/Session fields
                  agent_id: { type: "string", nullable: true },
                  session_id: { type: "string", nullable: true },
                  task_index: { type: "number" },
                  prompt: { type: "string", nullable: true },
                  // Execution info
                  cost: { type: "number", nullable: true },
                  duration: { type: "number", nullable: true },
                  favorite: { type: "boolean" },
                  executor: { type: "string" },
                  // Subtask visualization
                  subtasks_detail: {
                    type: "array",
                    nullable: true,
                    items: {
                      type: "object",
                      properties: {
                        id: { type: "string" },
                        name: { type: "string" },
                        status: { type: "string" },
                      },
                    },
                  },
                  execution_progress: { type: "object", nullable: true },
                  // Timestamps
                  created_at: { type: "string" },
                  updated_at: { type: "string" },
                  completed_at: { type: "string", nullable: true },
                  // Template flag
                  is_template: { type: "boolean" },
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
      taskDir = cached.task_dir;
      workspacePath = cached.workspace_path;
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
    const workspacePath = input.workspace_path || input.workspace_path;

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
      priority: (input.priority ?? sourceTask?.priority ?? DEFAULT_PRIORITY) as IssuePriority,
      creator: input.creator ?? sourceTask?.creator,
      assignee: input.assignee ?? sourceTask?.assignee,
      agent: input.agentId || input.agent_id || sourceTask?.agent,
      session_id: input.sessionId || input.session_id, // Don't copy sessionId - each task needs its own
      task_index: input.taskIndex || input.task_index || 0,
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
        taskDir = cached.task_dir;
        workspacePath = cached.workspace_path;
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
      if (updates.priority !== undefined) taskUpdates.priority = updates.priority as IssuePriority;
      if (updates.assignee !== undefined) taskUpdates.assignee = updates.assignee;
      if (updates.cost !== undefined) taskUpdates.cost = updates.cost;
      if (updates.duration !== undefined) taskUpdates.duration = updates.duration;
      if (updates.favorite !== undefined) taskUpdates.favorite = updates.favorite;
      if (updates.is_template !== undefined) taskUpdates.is_template = updates.is_template;

      // Session/Agent fields
      const sessionId = updates.session_id ?? updates.session_id;
      if (sessionId !== undefined) taskUpdates.session_id = sessionId;
      const agentId = updates.agentId ?? updates.agent_id;
      if (agentId !== undefined) taskUpdates.agent = agentId;

      // Kanban fields
      const newWorkspacePath = updates.workspace_path ?? updates.workspace_path;
      if (newWorkspacePath !== undefined) taskUpdates.workspace_path = newWorkspacePath;
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
          taskDir = cached.task_dir;
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
      const tasks = allTasks.filter((t) => t.session_id === sessionId);
      // Sort by taskIndex
      tasks.sort((a, b) => (a.task_index ?? 0) - (b.task_index ?? 0));
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

    log.info({ taskId: id, workspacePath: workspace_path }, "Getting specs for task");

    // Find task directory
    let taskDir: string | null = null;
    let workspacePath = workspace_path;

    // Check cache first (with TTL validation)
    const cached = getCacheEntry(id);
    if (cached) {
      log.debug({ taskDir: cached.task_dir }, "Found in cache");
      taskDir = cached.task_dir;
      workspacePath = cached.workspace_path;
    } else if (workspace_path) {
      log.debug("Searching for task by ID...");
      taskDir = await taskService.findTaskById(workspace_path, id);
      log.debug({ taskDir }, "findTaskById result");
      // Cache the result if found
      if (taskDir) {
        setCacheEntry(id, workspace_path, taskDir);
      }
    }

    if (!taskDir) {
      log.warn({ taskId: id }, "Task not found");
      reply.code(404);
      return { error: `Task not found: ${id}. Provide workspace_path parameter.` };
    }

    try {
      const specsData = await taskService.getTaskSpecsData(taskDir);
      log.debug({ taskDir: specsData.task_dir }, "Specs data loaded");

      // Convert to snake_case for API response
      return {
        prd_content: specsData.prd_content,
        prd_path: specsData.prd_path,
        subtasks: specsData.subtasks,
        logs: specsData.logs,
        task_dir: specsData.task_dir,
      };
    } catch (error) {
      log.error({ err: error }, "Error getting task specs");
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
          const nextSequence = (task.last_event?.sequence ?? 0) + 1;
          const event: TaskEvent = {
            event_id: randomUUID(),
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
      taskDir = cached.task_dir;
      workspacePath = cached.workspace_path;
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
    const isInProgress = task.status === "in_progress";

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

    if (task.session_id && state.taskQueue) {
      // Get all running queue tasks
      const queueTasks = state.taskQueue.getTasks("running");

      // Check if any queue task matches this task's session
      isRunning = queueTasks.some((qt) =>
        qt.payload.session_id === task.session_id
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
