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
 * Configuration endpoints:
 * - POST /api/task/set-branch - Set Git branch for task
 * - POST /api/task/set-base - Set PR target branch
 * - POST /api/task/set-scope - Set PR title scope
 * - POST /api/task/set-agent - Set associated agent
 *
 * Context management endpoints:
 * - POST /api/task/init-context - Initialize context files (implement.jsonl, check.jsonl, debug.jsonl)
 * - POST /api/task/add-context - Add context files to task
 * - POST /api/task/remove-context - Remove context files from task
 * - POST /api/task/list-context - List context entries
 * - POST /api/task/validate-context - Validate context file existence
 *
 * Execution control endpoints:
 * - POST /api/task/execute - Trigger task execution via queue system
 * - POST /api/task/stop - Stop task execution
 * - POST /api/task/running - Check execution status
 *
 * Queue management endpoints:
 * - POST /api/task/queue-status - Get queue status
 * - POST /api/task/queue-config - Get/update queue configuration
 * - POST /api/task/batch-enqueue - Batch enqueue multiple tasks
 * - POST /api/task/clear-history - Clear execution history
 *
 * Event endpoints:
 * - POST /api/task/events - Get event history for a task
 * - POST /api/task/specs - Get PRD/subtasks/logs for a task
 *
 * Streaming endpoints (SSE):
 * - GET /api/task/events-stream - SSE event subscription
 * - GET /api/task/execution-stream - SSE execution progress
 *
 * IMPORTANT: All tasks are stored in workspace directories:
 * <workspace>/.viben/tasks/<date>-<slug>/task.json
 */
import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { spawn, execSync, type SpawnOptions } from "node:child_process";
import { existsSync, statSync, readFileSync, writeFileSync, mkdirSync, openSync, readdirSync } from "node:fs";
import { join, basename } from "node:path";
import {
  taskService,
  type UnifiedTask,
  type TaskStatus,
  type SubtaskInfo,
} from "../../services/task-service";
import { sessionStoreService } from "../../services/session-store";
import { taskEventStore } from "../../task/events/event-store";
import { isValidEventType, type TaskEventType } from "../../task/events/event-types";
import type { TaskEvent } from "../../task/events/task-event";
import type { AppState } from "../state";
import type { Task, TaskStatus as DbTaskStatus } from "../../db/types";
import { taskSSEManager } from "../sse/task-sse-manager";
import {
  updateTaskField,
  readJsonlFile,
  writeJsonlFile,
  appendToJsonl,
  jsonlEntryExists,
  findVibenRoot,
  getDeveloper,
  getTasksDir,
  getCurrentTask,
  getActiveTasks,
  getDatePrefix,
  getTodayDate,
  writeTaskJson as writeTaskJsonFile,
  resolveTaskDirectory,
  runGitCommand,
  getPhaseForAction,
  registryAddAgent,
  registryListAgents,
  registrySearchAgent,
  isProcessRunning,
  getTaskStats,
  formatTaskStats,
  archiveTask as archiveTaskToDirectory,
  getArchivedTasks,
  getPhaseInfo,
  calcElapsed,
  getJournalInfo,
  readTaskJson as readTaskJsonFromWorkspace,
  DIR_VIBEN,
  DIR_WORKSPACE,
  DIR_TASKS,
  FILE_TASK_JSON,
  createCLIAdapter,
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

// =============================================================================
// Session/Journal Helper Functions
// =============================================================================

/**
 * Get the latest journal file info from workspace directory
 */
function getLatestJournalInfo(devDir: string): {
  file: string | null;
  number: number;
  lines: number;
} {
  if (!existsSync(devDir)) {
    return { file: null, number: 0, lines: 0 };
  }

  let latestFile: string | null = null;
  let latestNum = -1;

  try {
    const files = readdirSync(devDir);
    for (const file of files) {
      if (file.startsWith("journal-") && file.endsWith(".md")) {
        const match = file.match(/journal-(\d+)\.md$/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > latestNum) {
            latestNum = num;
            latestFile = join(devDir, file);
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
function getSessionNumberFromIndex(indexPath: string): number {
  if (!existsSync(indexPath)) {
    return 0;
  }

  try {
    const content = readFileSync(indexPath, "utf-8");
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
  sessionNum: number;
  title: string;
  commit: string;
  summary: string;
  extraContent: string;
  date: string;
}): string {
  const { sessionNum, title, commit, summary, extraContent, date } = params;

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

## Session ${sessionNum}: ${title}

**Date**: ${date}
**Task**: ${title}

### Summary

${summary}

### Main Changes

${extraContent}

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
  devDir: string,
  number: number,
  developer: string,
  date: string,
  prevNumber: number
): string {
  const newFilePath = join(devDir, `journal-${number}.md`);
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
function countJournalFilesTable(devDir: string, activeNum: number): string {
  const activeFile = `journal-${activeNum}.md`;
  const resultLines: string[] = [];

  try {
    const files = readdirSync(devDir)
      .filter((f) => f.startsWith("journal-") && f.endsWith(".md"))
      .sort((a, b) => {
        const numA = parseInt(a.match(/(\d+)/)?.[1] ?? "0", 10);
        const numB = parseInt(b.match(/(\d+)/)?.[1] ?? "0", 10);
        return numB - numA;
      });

    for (const filename of files) {
      const filePath = join(devDir, filename);
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
      const status = filename === activeFile ? "Active" : "Archived";
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
  indexPath: string;
  devDir: string;
  sessionNum: number;
  title: string;
  commit: string;
  activeFile: string;
  date: string;
}): boolean {
  const { indexPath, devDir, sessionNum, title, commit, activeFile, date } = params;

  if (!existsSync(indexPath)) {
    return false;
  }

  let commitDisplay = "-";
  if (commit && commit !== "-") {
    commitDisplay = commit
      .split(",")
      .map((c) => `\`${c.trim()}\``)
      .join(", ");
  }

  const match = activeFile.match(/journal-(\d+)\.md$/);
  const activeNum = match ? parseInt(match[1], 10) : 0;
  const filesTable = countJournalFilesTable(devDir, activeNum);

  try {
    const content = readFileSync(indexPath, "utf-8");

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
        newLines.push(`- **Active File**: \`${activeFile}\``);
        newLines.push(`- **Total Sessions**: ${sessionNum}`);
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
          newLines.push(`| ${sessionNum} | ${date} | ${title} | ${commitDisplay} |`);
          headerWritten = true;
        }
        continue;
      }

      newLines.push(line);
    }

    writeFileSync(indexPath, newLines.join("\n"), "utf-8");
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
                  status: { type: "string", enum: ["backlog", "queue", "in_progress", "paused", "human_review", "completed", "failed", "cancelled", "archived"] },
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

  // ============================================================================
  // Configuration Endpoints
  // ============================================================================

  // POST /api/task/set-branch - Set Git branch for task
  fastify.post<{
    Body: {
      workspace_path: string;
      task_id: string;
      branch: string;
    };
  }>("/api/task/set-branch", {
    schema: {
      description: "Set Git branch for a task",
      tags: ["tasks"],
      body: {
        type: "object",
        properties: {
          workspace_path: { type: "string", description: "Workspace path (required)" },
          task_id: { type: "string", description: "Task ID or directory" },
          branch: { type: "string", description: "Branch name to set" },
        },
        required: ["workspace_path", "task_id", "branch"],
      },
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            task_id: { type: "string" },
            branch: { type: "string" },
          },
        },
        400: {
          type: "object",
          properties: {
            error: { type: "string" },
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
    const { workspace_path, task_id, branch } = request.body;

    if (!workspace_path || !task_id || !branch) {
      reply.code(400);
      return { error: "workspace_path, task_id, and branch are required" };
    }

    // Find task directory
    const taskDir = await taskService.findTaskById(workspace_path, task_id);
    if (!taskDir) {
      reply.code(404);
      return { error: `Task not found: ${task_id}` };
    }

    const success = updateTaskField(taskDir, "branch", branch);
    if (!success) {
      reply.code(400);
      return { error: "Failed to update task.json" };
    }

    return { success: true, task_id, branch };
  });

  // POST /api/task/set-base - Set PR target branch
  fastify.post<{
    Body: {
      workspace_path: string;
      task_id: string;
      base_branch: string;
    };
  }>("/api/task/set-base", {
    schema: {
      description: "Set PR target branch for a task",
      tags: ["tasks"],
      body: {
        type: "object",
        properties: {
          workspace_path: { type: "string", description: "Workspace path (required)" },
          task_id: { type: "string", description: "Task ID or directory" },
          base_branch: { type: "string", description: "Base branch name (PR target)" },
        },
        required: ["workspace_path", "task_id", "base_branch"],
      },
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            task_id: { type: "string" },
            base_branch: { type: "string" },
          },
        },
        400: {
          type: "object",
          properties: {
            error: { type: "string" },
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
    const { workspace_path, task_id, base_branch } = request.body;

    if (!workspace_path || !task_id || !base_branch) {
      reply.code(400);
      return { error: "workspace_path, task_id, and base_branch are required" };
    }

    const taskDir = await taskService.findTaskById(workspace_path, task_id);
    if (!taskDir) {
      reply.code(404);
      return { error: `Task not found: ${task_id}` };
    }

    const success = updateTaskField(taskDir, "base_branch", base_branch);
    if (!success) {
      reply.code(400);
      return { error: "Failed to update task.json" };
    }

    return { success: true, task_id, base_branch };
  });

  // POST /api/task/set-scope - Set PR title scope
  fastify.post<{
    Body: {
      workspace_path: string;
      task_id: string;
      scope: string;
    };
  }>("/api/task/set-scope", {
    schema: {
      description: "Set scope for PR title",
      tags: ["tasks"],
      body: {
        type: "object",
        properties: {
          workspace_path: { type: "string", description: "Workspace path (required)" },
          task_id: { type: "string", description: "Task ID or directory" },
          scope: { type: "string", description: "Scope name for PR title" },
        },
        required: ["workspace_path", "task_id", "scope"],
      },
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            task_id: { type: "string" },
            scope: { type: "string" },
          },
        },
        400: {
          type: "object",
          properties: {
            error: { type: "string" },
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
    const { workspace_path, task_id, scope } = request.body;

    if (!workspace_path || !task_id || !scope) {
      reply.code(400);
      return { error: "workspace_path, task_id, and scope are required" };
    }

    const taskDir = await taskService.findTaskById(workspace_path, task_id);
    if (!taskDir) {
      reply.code(404);
      return { error: `Task not found: ${task_id}` };
    }

    const success = updateTaskField(taskDir, "scope", scope);
    if (!success) {
      reply.code(400);
      return { error: "Failed to update task.json" };
    }

    return { success: true, task_id, scope };
  });

  // POST /api/task/set-agent - Set associated agent
  fastify.post<{
    Body: {
      workspace_path: string;
      task_id: string;
      agent_id: string;
    };
  }>("/api/task/set-agent", {
    schema: {
      description: "Set associated agent configuration for a task",
      tags: ["tasks"],
      body: {
        type: "object",
        properties: {
          workspace_path: { type: "string", description: "Workspace path (required)" },
          task_id: { type: "string", description: "Task ID or directory" },
          agent_id: { type: "string", description: "Agent ID to associate" },
        },
        required: ["workspace_path", "task_id", "agent_id"],
      },
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            task_id: { type: "string" },
            agent_id: { type: "string" },
          },
        },
        400: {
          type: "object",
          properties: {
            error: { type: "string" },
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
    const { workspace_path, task_id, agent_id } = request.body;

    if (!workspace_path || !task_id || !agent_id) {
      reply.code(400);
      return { error: "workspace_path, task_id, and agent_id are required" };
    }

    const taskDir = await taskService.findTaskById(workspace_path, task_id);
    if (!taskDir) {
      reply.code(404);
      return { error: `Task not found: ${task_id}` };
    }

    const success = updateTaskField(taskDir, "agent", agent_id);
    if (!success) {
      reply.code(400);
      return { error: "Failed to update task.json" };
    }

    return { success: true, task_id, agent_id };
  });

  // ============================================================================
  // Context Management Endpoints
  // ============================================================================

  /**
   * Context entry structure stored in JSONL files
   */
  interface ContextEntry {
    file: string;
    reason: string;
    type?: "file" | "directory";
  }

  // POST /api/task/init-context - Initialize context files for task
  fastify.post<{
    Body: {
      workspace_path: string;
      task_id: string;
      dev_type: string;
    };
  }>("/api/task/init-context", {
    schema: {
      description: "Initialize context files (implement.jsonl, check.jsonl, debug.jsonl) for a task",
      tags: ["tasks"],
      body: {
        type: "object",
        properties: {
          workspace_path: { type: "string", description: "Workspace path (required)" },
          task_id: { type: "string", description: "Task ID or directory" },
          dev_type: { type: "string", enum: ["backend", "frontend", "fullstack", "test", "docs"], description: "Development type" },
        },
        required: ["workspace_path", "task_id", "dev_type"],
      },
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            task_id: { type: "string" },
            dev_type: { type: "string" },
            files_created: {
              type: "array",
              items: { type: "string" },
            },
          },
        },
        400: {
          type: "object",
          properties: {
            error: { type: "string" },
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
    const { workspace_path, task_id, dev_type } = request.body;

    if (!workspace_path || !task_id || !dev_type) {
      reply.code(400);
      return { error: "workspace_path, task_id, and dev_type are required" };
    }

    const validTypes = ["backend", "frontend", "fullstack", "test", "docs"];
    if (!validTypes.includes(dev_type)) {
      reply.code(400);
      return { error: `dev_type must be one of: ${validTypes.join(", ")}` };
    }

    const taskDir = await taskService.findTaskById(workspace_path, task_id);
    if (!taskDir) {
      reply.code(404);
      return { error: `Task not found: ${task_id}` };
    }

    const filesCreated: string[] = [];

    // Create implement.jsonl
    const implementEntries: ContextEntry[] = [
      { file: `${DIR_VIBEN}/workflow.md`, reason: "Project workflow and conventions" },
    ];

    if (dev_type === "backend" || dev_type === "test" || dev_type === "fullstack") {
      implementEntries.push({
        file: "docs/specs/backend/index.md",
        reason: "Backend development guide",
      });
    }
    if (dev_type === "frontend" || dev_type === "fullstack") {
      implementEntries.push({
        file: "docs/specs/frontend/index.md",
        reason: "Frontend development guide",
      });
    }

    const implementFile = join(taskDir, "implement.jsonl");
    writeJsonlFile(implementFile, implementEntries as unknown as Array<Record<string, unknown>>);
    filesCreated.push("implement.jsonl");

    // Create check.jsonl
    const checkEntries: ContextEntry[] = [
      { file: ".claude/commands/viben/finish-work.md", reason: "Finish work checklist" },
    ];
    if (dev_type === "backend" || dev_type === "fullstack") {
      checkEntries.push({
        file: ".claude/commands/viben/check-backend.md",
        reason: "Backend check spec",
      });
    }
    if (dev_type === "frontend" || dev_type === "fullstack") {
      checkEntries.push({
        file: ".claude/commands/viben/check-frontend.md",
        reason: "Frontend check spec",
      });
    }

    const checkFile = join(taskDir, "check.jsonl");
    writeJsonlFile(checkFile, checkEntries as unknown as Array<Record<string, unknown>>);
    filesCreated.push("check.jsonl");

    // Create debug.jsonl
    const debugEntries: ContextEntry[] = [];
    if (dev_type === "backend" || dev_type === "fullstack") {
      debugEntries.push({
        file: ".claude/commands/viben/check-backend.md",
        reason: "Backend check spec",
      });
    }
    if (dev_type === "frontend" || dev_type === "fullstack") {
      debugEntries.push({
        file: ".claude/commands/viben/check-frontend.md",
        reason: "Frontend check spec",
      });
    }

    const debugFile = join(taskDir, "debug.jsonl");
    writeJsonlFile(debugFile, debugEntries as unknown as Array<Record<string, unknown>>);
    filesCreated.push("debug.jsonl");

    // Update task.json with dev_type
    updateTaskField(taskDir, "dev_type", dev_type);

    return {
      success: true,
      task_id,
      dev_type,
      files_created: filesCreated,
    };
  });

  // POST /api/task/add-context - Add context files to task
  fastify.post<{
    Body: {
      workspace_path: string;
      task_id: string;
      files: Array<{
        path: string;
        reason?: string;
      }>;
      context_type?: "implement" | "check" | "debug";
    };
  }>("/api/task/add-context", {
    schema: {
      description: "Add context files to a task",
      tags: ["tasks"],
      body: {
        type: "object",
        properties: {
          workspace_path: { type: "string", description: "Workspace path (required)" },
          task_id: { type: "string", description: "Task ID or directory" },
          files: {
            type: "array",
            items: {
              type: "object",
              properties: {
                path: { type: "string" },
                reason: { type: "string" },
              },
              required: ["path"],
            },
            description: "Files to add with optional reasons",
          },
          context_type: { type: "string", enum: ["implement", "check", "debug"], description: "Context file to add to (default: implement)" },
        },
        required: ["workspace_path", "task_id", "files"],
      },
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            task_id: { type: "string" },
            added: { type: "number" },
            skipped: { type: "number" },
            total: { type: "number" },
          },
        },
        400: {
          type: "object",
          properties: {
            error: { type: "string" },
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
    const { workspace_path, task_id, files, context_type = "implement" } = request.body;

    if (!workspace_path || !task_id || !files || files.length === 0) {
      reply.code(400);
      return { error: "workspace_path, task_id, and files are required" };
    }

    const taskDir = await taskService.findTaskById(workspace_path, task_id);
    if (!taskDir) {
      reply.code(404);
      return { error: `Task not found: ${task_id}` };
    }

    const jsonlFile = join(taskDir, `${context_type}.jsonl`);
    let addedCount = 0;
    let skippedCount = 0;

    for (const fileInput of files) {
      // Skip if already exists
      if (jsonlEntryExists(jsonlFile, fileInput.path)) {
        skippedCount++;
        continue;
      }

      // Determine type
      let type: "file" | "directory" | undefined;
      const fullPath = join(workspace_path, fileInput.path);
      if (existsSync(fullPath)) {
        type = statSync(fullPath).isDirectory() ? "directory" : "file";
      }

      const entry: ContextEntry = {
        file: fileInput.path,
        reason: fileInput.reason || "Added via API",
      };
      if (type) {
        entry.type = type;
      }

      appendToJsonl(jsonlFile, entry as unknown as Record<string, unknown>);
      addedCount++;
    }

    return {
      success: true,
      task_id,
      added: addedCount,
      skipped: skippedCount,
      total: files.length,
    };
  });

  // POST /api/task/remove-context - Remove context files from task
  fastify.post<{
    Body: {
      workspace_path: string;
      task_id: string;
      files: string[];
    };
  }>("/api/task/remove-context", {
    schema: {
      description: "Remove context files from a task",
      tags: ["tasks"],
      body: {
        type: "object",
        properties: {
          workspace_path: { type: "string", description: "Workspace path (required)" },
          task_id: { type: "string", description: "Task ID or directory" },
          files: {
            type: "array",
            items: { type: "string" },
            description: "File paths to remove",
          },
        },
        required: ["workspace_path", "task_id", "files"],
      },
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            task_id: { type: "string" },
            removed: { type: "number" },
          },
        },
        400: {
          type: "object",
          properties: {
            error: { type: "string" },
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
    const { workspace_path, task_id, files } = request.body;

    if (!workspace_path || !task_id || !files || files.length === 0) {
      reply.code(400);
      return { error: "workspace_path, task_id, and files are required" };
    }

    const taskDir = await taskService.findTaskById(workspace_path, task_id);
    if (!taskDir) {
      reply.code(404);
      return { error: `Task not found: ${task_id}` };
    }

    let totalRemoved = 0;

    // Remove from all context files
    for (const jsonlName of ["implement.jsonl", "check.jsonl", "debug.jsonl"]) {
      const jsonlPath = join(taskDir, jsonlName);
      if (!existsSync(jsonlPath)) continue;

      const content = readFileSync(jsonlPath, "utf-8");
      const lines = content.split("\n").filter((line) => {
        if (!line.trim()) return false;
        try {
          const entry = JSON.parse(line);
          const shouldRemove = files.includes(entry.file);
          if (shouldRemove) totalRemoved++;
          return !shouldRemove;
        } catch {
          return true;
        }
      });

      writeFileSync(jsonlPath, lines.join("\n") + "\n", "utf-8");
    }

    return {
      success: true,
      task_id,
      removed: totalRemoved,
    };
  });

  // POST /api/task/list-context - List context entries for task
  fastify.post<{
    Body: {
      workspace_path: string;
      task_id: string;
    };
  }>("/api/task/list-context", {
    schema: {
      description: "List all context entries for a task",
      tags: ["tasks"],
      body: {
        type: "object",
        properties: {
          workspace_path: { type: "string", description: "Workspace path (required)" },
          task_id: { type: "string", description: "Task ID or directory" },
        },
        required: ["workspace_path", "task_id"],
      },
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            task_id: { type: "string" },
            context: {
              type: "object",
              properties: {
                implement: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      file: { type: "string" },
                      reason: { type: "string" },
                      type: { type: "string" },
                    },
                  },
                },
                check: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      file: { type: "string" },
                      reason: { type: "string" },
                      type: { type: "string" },
                    },
                  },
                },
                debug: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      file: { type: "string" },
                      reason: { type: "string" },
                      type: { type: "string" },
                    },
                  },
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
        404: {
          type: "object",
          properties: {
            error: { type: "string" },
          },
        },
      },
    },
  }, async (request, reply) => {
    const { workspace_path, task_id } = request.body;

    if (!workspace_path || !task_id) {
      reply.code(400);
      return { error: "workspace_path and task_id are required" };
    }

    const taskDir = await taskService.findTaskById(workspace_path, task_id);
    if (!taskDir) {
      reply.code(404);
      return { error: `Task not found: ${task_id}` };
    }

    const context: Record<string, ContextEntry[]> = {
      implement: [],
      check: [],
      debug: [],
    };

    for (const [key, fileName] of Object.entries({
      implement: "implement.jsonl",
      check: "check.jsonl",
      debug: "debug.jsonl",
    })) {
      const filePath = join(taskDir, fileName);
      if (existsSync(filePath)) {
        context[key] = readJsonlFile(filePath) as unknown as ContextEntry[];
      }
    }

    return {
      success: true,
      task_id,
      context,
    };
  });

  // POST /api/task/validate-context - Validate context files exist
  fastify.post<{
    Body: {
      workspace_path: string;
      task_id: string;
    };
  }>("/api/task/validate-context", {
    schema: {
      description: "Validate that all context file references exist",
      tags: ["tasks"],
      body: {
        type: "object",
        properties: {
          workspace_path: { type: "string", description: "Workspace path (required)" },
          task_id: { type: "string", description: "Task ID or directory" },
        },
        required: ["workspace_path", "task_id"],
      },
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            task_id: { type: "string" },
            valid_count: { type: "number" },
            missing_count: { type: "number" },
            missing_files: {
              type: "array",
              items: { type: "string" },
            },
            all_valid: { type: "boolean" },
          },
        },
        400: {
          type: "object",
          properties: {
            error: { type: "string" },
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
    const { workspace_path, task_id } = request.body;

    if (!workspace_path || !task_id) {
      reply.code(400);
      return { error: "workspace_path and task_id are required" };
    }

    const taskDir = await taskService.findTaskById(workspace_path, task_id);
    if (!taskDir) {
      reply.code(404);
      return { error: `Task not found: ${task_id}` };
    }

    const contextFiles = ["implement.jsonl", "check.jsonl", "debug.jsonl"];
    const missing: string[] = [];
    let validCount = 0;

    for (const fileName of contextFiles) {
      const filePath = join(taskDir, fileName);
      if (!existsSync(filePath)) continue;

      const entries = readJsonlFile(filePath) as unknown as ContextEntry[];
      for (const entry of entries) {
        const fullPath = join(workspace_path, entry.file);
        if (existsSync(fullPath)) {
          validCount++;
        } else {
          missing.push(entry.file);
        }
      }
    }

    return {
      success: true,
      task_id,
      valid_count: validCount,
      missing_count: missing.length,
      missing_files: missing,
      all_valid: missing.length === 0,
    };
  });

  // ============================================================================
  // Execution Control (Integration from Queue)
  // ============================================================================

  /**
   * POST /api/task/execute - Trigger task execution
   * Maps task_dir to queue task_id for tracking
   */
  fastify.post<{
    Body: {
      workspace_path: string;
      task_dir: string;
      agent_id?: string;
      input?: string;
      cwd?: string;
      agent_config_path?: string;
      resume_session?: string;
      max_retries?: number;
      attachments?: Array<{ type: string; data: string; name?: string }>;
    };
  }>("/api/task/execute", {
    schema: {
      description: "Trigger task execution via queue system",
      tags: ["tasks"],
      body: {
        type: "object",
        properties: {
          workspace_path: { type: "string", description: "Workspace path (required)" },
          task_dir: { type: "string", description: "Task directory path or ID (required)" },
          agent_id: { type: "string", description: "Agent ID to use" },
          input: { type: "string", description: "User prompt" },
          cwd: { type: "string", description: "Working directory" },
          agent_config_path: { type: "string", description: "Path to agent config" },
          resume_session: { type: "string", description: "Resume from existing session" },
          max_retries: { type: "number", description: "Maximum retry attempts" },
          attachments: {
            type: "array",
            items: {
              type: "object",
              properties: {
                type: { type: "string" },
                data: { type: "string" },
                name: { type: "string" },
              },
            },
          },
        },
        required: ["workspace_path", "task_dir"],
      },
      response: {
        201: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            task_id: { type: "string", description: "Queue task ID" },
            position: { type: "number" },
            status: { type: "string" },
          },
        },
        400: {
          type: "object",
          properties: {
            error: { type: "string" },
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
    const {
      workspace_path,
      task_dir: taskDirOrId,
      agent_id,
      input,
      cwd,
      agent_config_path,
      resume_session,
      max_retries,
      attachments,
    } = request.body;

    // Validate workspace_path
    if (!workspace_path) {
      reply.code(400);
      return { error: "workspace_path is required" };
    }

    // Resolve task directory
    const taskDir = taskDirOrId.includes("/")
      ? taskDirOrId
      : await taskService.findTaskById(workspace_path, taskDirOrId);

    if (!taskDir) {
      reply.code(404);
      return { error: `Task not found: ${taskDirOrId}` };
    }

    // Get task to extract execution parameters
    const task = await taskService.getTask(taskDir);
    if (!task) {
      reply.code(404);
      return { error: `Task not found: ${taskDirOrId}` };
    }

    // Determine execution parameters
    const effectiveAgentId = agent_id || task.agent;
    const effectiveInput = input || task.prompt || task.description || task.title;
    const effectiveCwd = cwd || workspace_path;

    if (!effectiveAgentId) {
      reply.code(400);
      return { error: "agent_id is required (not found in task or request)" };
    }

    if (!effectiveInput) {
      reply.code(400);
      return { error: "input is required (not found in task or request)" };
    }

    try {
      // Enqueue to the task queue
      const result = await state.taskQueue.enqueue({
        agent_id: effectiveAgentId,
        session_id: task.sessionId,
        input: effectiveInput,
        cwd: effectiveCwd,
        agent_config_path,
        resume_session,
        max_retries,
        attachments,
      });

      // Store mapping from task_dir to queue task_id
      // Update task with queue reference
      await taskService.updateTask(taskDir, {
        status: "queue",
        sessionId: task.sessionId || result.task_id, // Use queue task_id as session reference
      });

      reply.code(201);
      return {
        success: true,
        task_id: result.task_id,
        position: result.position,
        status: result.status,
      };
    } catch (e) {
      reply.code(400);
      return { error: e instanceof Error ? e.message : "Failed to enqueue task" };
    }
  });

  /**
   * POST /api/task/stop - Stop task execution
   * Finds queue task by session_id and cancels it
   */
  fastify.post<{
    Body: {
      workspace_path: string;
      task_dir: string;
    };
  }>("/api/task/stop", {
    schema: {
      description: "Stop task execution",
      tags: ["tasks"],
      body: {
        type: "object",
        properties: {
          workspace_path: { type: "string", description: "Workspace path (required)" },
          task_dir: { type: "string", description: "Task directory path or ID (required)" },
        },
        required: ["workspace_path", "task_dir"],
      },
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            cancelled: { type: "boolean" },
            task_id: { type: "string" },
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
    const { workspace_path, task_dir: taskDirOrId } = request.body;

    // Resolve task directory
    const taskDir = taskDirOrId.includes("/")
      ? taskDirOrId
      : await taskService.findTaskById(workspace_path, taskDirOrId);

    if (!taskDir) {
      reply.code(404);
      return { error: `Task not found: ${taskDirOrId}` };
    }

    // Get task to find session_id
    const task = await taskService.getTask(taskDir);
    if (!task) {
      reply.code(404);
      return { error: `Task not found: ${taskDirOrId}` };
    }

    // Try to find and cancel the queue task
    let cancelled = false;
    let queueTaskId: string | null = null;

    if (task.sessionId && state.taskQueue) {
      // Search running tasks for matching session
      const runningTasks = state.taskQueue.getTasks("running");
      const pendingTasks = state.taskQueue.getTasks("pending");
      const allTasks = [...runningTasks, ...pendingTasks];

      const queueTask = allTasks.find((qt) => qt.payload.session_id === task.sessionId);

      if (queueTask) {
        queueTaskId = queueTask.id;
        cancelled = await state.taskQueue.cancel(queueTask.id);
      }
    }

    // Update task status
    if (cancelled || task.status === "in_progress" || task.status === "queue") {
      await taskService.updateTask(taskDir, {
        status: "human_review",
        reviewReason: "stopped",
      });
    }

    return {
      success: true,
      cancelled,
      task_id: queueTaskId,
    };
  });

  /**
   * POST /api/task/running - Check execution status
   * Checks both task status and actual queue execution
   */
  fastify.post<{
    Body: {
      workspace_path: string;
      task_dir: string;
    };
  }>("/api/task/running", {
    schema: {
      description: "Check if task execution is running",
      tags: ["tasks"],
      body: {
        type: "object",
        properties: {
          workspace_path: { type: "string", description: "Workspace path (required)" },
          task_dir: { type: "string", description: "Task directory path or ID (required)" },
        },
        required: ["workspace_path", "task_dir"],
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
                queue_task_id: { type: "string" },
                queue_status: { type: "string" },
              },
            },
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
    const { workspace_path, task_dir: taskDirOrId } = request.body;

    // Resolve task directory
    const taskDir = taskDirOrId.includes("/")
      ? taskDirOrId
      : await taskService.findTaskById(workspace_path, taskDirOrId);

    if (!taskDir) {
      reply.code(404);
      return { error: `Task not found: ${taskDirOrId}` };
    }

    // Get task
    const task = await taskService.getTask(taskDir);
    if (!task) {
      reply.code(404);
      return { error: `Task not found: ${taskDirOrId}` };
    }

    // Check queue execution status
    let queueTaskId: string | null = null;
    let queueStatus: string | null = null;
    let isRunning = false;

    if (task.sessionId && state.taskQueue) {
      const queueTasks = state.taskQueue.getTasks();
      const queueTask = queueTasks.find((qt) => qt.payload.session_id === task.sessionId);

      if (queueTask) {
        queueTaskId = queueTask.id;
        queueStatus = queueTask.status;
        isRunning = queueTask.status === "running";
      }
    }

    // Also check task status
    const isInProgress = task.status === "in_progress" || task.status === "queue";

    return {
      success: true,
      data: {
        task_id: task.id,
        running: isRunning || isInProgress,
        status: task.status,
        queue_task_id: queueTaskId,
        queue_status: queueStatus,
      },
    };
  });

  // ============================================================================
  // Queue Management
  // ============================================================================

  /**
   * POST /api/task/queue-status - Get queue status
   */
  fastify.post("/api/task/queue-status", {
    schema: {
      description: "Get queue status",
      tags: ["tasks"],
      response: {
        200: {
          type: "object",
          properties: {
            pending_count: { type: "number" },
            running_count: { type: "number" },
            max_concurrency: { type: "number" },
            tasks: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  status: { type: "string" },
                  agent_id: { type: "string" },
                  created_at: { type: "number" },
                  position: { type: "number" },
                },
              },
            },
          },
        },
      },
    },
  }, async () => {
    return state.taskQueue.getStatus();
  });

  /**
   * POST /api/task/queue-config - Get/update queue configuration
   */
  fastify.post<{
    Body: {
      max_concurrency?: number;
      default_max_retries?: number;
    };
  }>("/api/task/queue-config", {
    schema: {
      description: "Get or update queue configuration",
      tags: ["tasks"],
      body: {
        type: "object",
        properties: {
          max_concurrency: { type: "number" },
          default_max_retries: { type: "number" },
        },
      },
      response: {
        200: {
          type: "object",
          properties: {
            max_concurrency: { type: "number" },
            default_max_retries: { type: "number" },
            persist_debounce_ms: { type: "number" },
            shutdown_timeout_ms: { type: "number" },
          },
        },
      },
    },
  }, async (request) => {
    const updates = request.body;

    // If updates provided, update config
    if (updates && Object.keys(updates).length > 0) {
      return await state.taskQueue.updateConfig(updates);
    }

    // Otherwise just return current config
    return state.taskQueue.getConfig();
  });

  /**
   * POST /api/task/batch-enqueue - Batch enqueue multiple tasks
   */
  fastify.post<{
    Body: {
      workspace_path: string;
      task_dirs: string[];
      agent_id?: string;
    };
  }>("/api/task/batch-enqueue", {
    schema: {
      description: "Batch enqueue multiple tasks for execution",
      tags: ["tasks"],
      body: {
        type: "object",
        properties: {
          workspace_path: { type: "string", description: "Workspace path (required)" },
          task_dirs: {
            type: "array",
            items: { type: "string" },
            description: "Task directories or IDs to enqueue",
          },
          agent_id: { type: "string", description: "Agent ID to use for all tasks" },
        },
        required: ["workspace_path", "task_dirs"],
      },
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            queued: { type: "number" },
            failed: { type: "number" },
            results: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  task_dir: { type: "string" },
                  success: { type: "boolean" },
                  error: { type: "string" },
                  queue_task_id: { type: "string" },
                },
              },
            },
          },
        },
      },
    },
  }, async (request) => {
    const { workspace_path, task_dirs, agent_id } = request.body;

    if (!task_dirs || task_dirs.length === 0) {
      return { success: false, queued: 0, failed: 0, results: [] };
    }

    const results = [];
    let queued = 0;
    let failed = 0;

    for (const taskDirOrId of task_dirs) {
      try {
        // Resolve task directory
        const taskDir = taskDirOrId.includes("/")
          ? taskDirOrId
          : await taskService.findTaskById(workspace_path, taskDirOrId);

        if (!taskDir) {
          results.push({ task_dir: taskDirOrId, success: false, error: "Task not found" });
          failed++;
          continue;
        }

        // Get task
        const task = await taskService.getTask(taskDir);
        if (!task) {
          results.push({ task_dir: taskDirOrId, success: false, error: "Task not found" });
          failed++;
          continue;
        }

        // Determine agent_id
        const effectiveAgentId = agent_id || task.agent;
        if (!effectiveAgentId) {
          results.push({ task_dir: taskDirOrId, success: false, error: "No agent_id specified" });
          failed++;
          continue;
        }

        // Determine input
        const effectiveInput = task.prompt || task.description || task.title;
        if (!effectiveInput) {
          results.push({ task_dir: taskDirOrId, success: false, error: "No input/prompt found" });
          failed++;
          continue;
        }

        // Enqueue
        const result = await state.taskQueue.enqueue({
          agent_id: effectiveAgentId,
          session_id: task.sessionId,
          input: effectiveInput,
          cwd: workspace_path,
        });

        // Update task status
        await taskService.updateTask(taskDir, {
          status: "queue",
        });

        results.push({
          task_dir: taskDirOrId,
          success: true,
          queue_task_id: result.task_id,
        });
        queued++;
      } catch (e) {
        results.push({
          task_dir: taskDirOrId,
          success: false,
          error: e instanceof Error ? e.message : "Unknown error",
        });
        failed++;
      }
    }

    return {
      success: failed === 0,
      queued,
      failed,
      results,
    };
  });

  /**
   * POST /api/task/clear-history - Clear execution history
   */
  fastify.post("/api/task/clear-history", {
    schema: {
      description: "Clear completed and failed tasks from queue history",
      tags: ["tasks"],
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            cleared: { type: "number" },
          },
        },
      },
    },
  }, async () => {
    const cleared = await state.taskQueue.clearHistory();
    return { success: true, cleared };
  });

  // ============================================================================
  // Event Operations
  // ============================================================================

  /**
   * POST /api/task/events - Get event history for a task
   */
  fastify.post<{
    Body: {
      workspace_path: string;
      task_dir: string;
      since?: number;
    };
  }>("/api/task/events", {
    schema: {
      description: "Get event history for a task",
      tags: ["tasks"],
      body: {
        type: "object",
        properties: {
          workspace_path: { type: "string", description: "Workspace path (required)" },
          task_dir: { type: "string", description: "Task directory path or ID (required)" },
          since: { type: "number", description: "Get events after this sequence number" },
        },
        required: ["workspace_path", "task_dir"],
      },
      response: {
        200: {
          type: "object",
          properties: {
            task_id: { type: "string" },
            events: { type: "array" },
            count: { type: "number" },
            next_sequence: { type: "number" },
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
    const { workspace_path, task_dir: taskDirOrId, since } = request.body;

    // Resolve task directory
    const taskDir = taskDirOrId.includes("/")
      ? taskDirOrId
      : await taskService.findTaskById(workspace_path, taskDirOrId);

    if (!taskDir) {
      reply.code(404);
      return { error: `Task not found: ${taskDirOrId}` };
    }

    // Get task for ID
    const task = await taskService.getTask(taskDir);
    if (!task) {
      reply.code(404);
      return { error: `Task not found: ${taskDirOrId}` };
    }

    // Get event history
    const events = await taskEventStore.getEventHistory(taskDir, since);
    const nextSequence = await taskEventStore.getNextSequence(taskDir);

    return {
      task_id: task.id,
      events,
      count: events.length,
      next_sequence: nextSequence,
    };
  });

  /**
   * POST /api/task/specs - Get PRD/subtasks/logs for a task
   */
  fastify.post<{
    Body: {
      workspace_path: string;
      task_dir: string;
    };
  }>("/api/task/specs", {
    schema: {
      description: "Get task specs (PRD, subtasks, logs)",
      tags: ["tasks"],
      body: {
        type: "object",
        properties: {
          workspace_path: { type: "string", description: "Workspace path (required)" },
          task_dir: { type: "string", description: "Task directory path or ID (required)" },
        },
        required: ["workspace_path", "task_dir"],
      },
      response: {
        200: {
          type: "object",
          properties: {
            prd_content: { type: "string", nullable: true },
            prd_path: { type: "string", nullable: true },
            subtasks: { type: "array" },
            logs: { type: "object", nullable: true },
            task_dir: { type: "string" },
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
    const { workspace_path, task_dir: taskDirOrId } = request.body;

    // Resolve task directory
    const taskDir = taskDirOrId.includes("/")
      ? taskDirOrId
      : await taskService.findTaskById(workspace_path, taskDirOrId);

    if (!taskDir) {
      reply.code(404);
      return { error: `Task not found: ${taskDirOrId}` };
    }

    try {
      const specsData = await taskService.getTaskSpecsData(taskDir);

      return {
        prd_content: specsData.prdContent,
        prd_path: specsData.prdPath,
        subtasks: specsData.subtasks,
        logs: specsData.logs,
        task_dir: specsData.taskDir,
      };
    } catch (error) {
      reply.code(500);
      return { error: error instanceof Error ? error.message : "Failed to get task specs" };
    }
  });

  // ============================================================================
  // Streaming Endpoints (GET for SSE)
  // ============================================================================

  /**
   * GET /api/task/events-stream - SSE event subscription
   * Subscribe to task events for a workspace or specific tasks
   */
  fastify.get<{
    Querystring: {
      workspace_path: string;
      task_ids?: string;
      last_sequence?: string;
    };
  }>("/api/task/events-stream", {
    schema: {
      description: "SSE stream for task events",
      tags: ["tasks"],
      querystring: {
        type: "object",
        properties: {
          workspace_path: { type: "string", description: "Workspace path (required)" },
          task_ids: { type: "string", description: "Comma-separated task IDs for filtering" },
          last_sequence: { type: "string", description: "Last received sequence for replay" },
        },
        required: ["workspace_path"],
      },
    },
  }, async (request, reply) => {
    const { workspace_path, task_ids, last_sequence } = request.query;

    if (!workspace_path) {
      return reply.status(400).send({ error: "workspace_path required" });
    }

    // Parse task IDs if provided
    const taskIdList = task_ids
      ? task_ids.split(",").map((id) => id.trim()).filter(Boolean)
      : [];

    const isBatchSubscription = taskIdList.length > 0;
    const lastSeq = last_sequence ? parseInt(last_sequence, 10) : undefined;

    // Set SSE headers
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
      "X-Accel-Buffering": "no",
    });

    // Event replay if last_sequence provided
    if (lastSeq !== undefined && !isNaN(lastSeq)) {
      try {
        if (isBatchSubscription) {
          for (const taskId of taskIdList) {
            const taskDir = await taskService.findTaskById(workspace_path, taskId);
            if (taskDir) {
              const missedEvents = await taskEventStore.getEventHistory(taskDir, lastSeq);
              for (const event of missedEvents) {
                const replayEvent = {
                  type: "STATE_CHANGED",
                  task_id: taskId,
                  workspace_path,
                  timestamp: new Date(event.timestamp).getTime(),
                  event,
                  replay: true,
                };
                reply.raw.write(`event: STATE_CHANGED\ndata: ${JSON.stringify(replayEvent)}\n\n`);
              }
            }
          }
        } else {
          const tasks = await taskService.listTasks(workspace_path);
          for (const task of tasks) {
            const taskDir = await taskService.findTaskById(workspace_path, task.id);
            if (taskDir) {
              const missedEvents = await taskEventStore.getEventHistory(taskDir, lastSeq);
              for (const event of missedEvents) {
                const replayEvent = {
                  type: "STATE_CHANGED",
                  task_id: task.id,
                  workspace_path,
                  timestamp: new Date(event.timestamp).getTime(),
                  event,
                  replay: true,
                };
                reply.raw.write(`event: STATE_CHANGED\ndata: ${JSON.stringify(replayEvent)}\n\n`);
              }
            }
          }
        }
      } catch (error) {
        console.error(`[SSE] Error replaying events:`, error);
      }
    }

    // Send connected event
    reply.raw.write(
      `event: connected\ndata: ${JSON.stringify({
        subscription_type: isBatchSubscription ? "batch" : "workspace",
        workspace_path,
        task_ids: isBatchSubscription ? taskIdList : undefined,
        last_sequence: lastSeq,
        timestamp: Date.now(),
      })}\n\n`
    );

    // Subscribe based on type
    let unsubscribe: () => void;

    if (isBatchSubscription) {
      unsubscribe = state.taskSSEManager.subscribeTasks(taskIdList, (event) => {
        try {
          if (reply.raw.writableEnded || reply.raw.destroyed) {
            return false;
          }
          reply.raw.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
          return true;
        } catch {
          return false;
        }
      }, workspace_path);
    } else {
      unsubscribe = state.taskSSEManager.subscribeWorkspace(workspace_path, (event) => {
        try {
          if (reply.raw.writableEnded || reply.raw.destroyed) {
            return false;
          }
          reply.raw.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
          return true;
        } catch {
          return false;
        }
      });
    }

    // Handle client disconnect
    request.raw.on("close", () => {
      unsubscribe();
    });

    // Keep connection open
    await new Promise<void>((resolve) => {
      request.raw.on("close", resolve);
    });
  });

  /**
   * GET /api/task/execution-stream - SSE execution progress
   * Stream real-time execution progress from the queue
   */
  fastify.get<{
    Querystring: {
      workspace_path: string;
      task_dir: string;
    };
  }>("/api/task/execution-stream", {
    schema: {
      description: "SSE stream for task execution progress",
      tags: ["tasks"],
      querystring: {
        type: "object",
        properties: {
          workspace_path: { type: "string", description: "Workspace path (required)" },
          task_dir: { type: "string", description: "Task directory or ID (required)" },
        },
        required: ["workspace_path", "task_dir"],
      },
    },
  }, async (request, reply) => {
    const { workspace_path, task_dir: taskDirOrId } = request.query;

    if (!workspace_path || !taskDirOrId) {
      return reply.status(400).send({ error: "workspace_path and task_dir required" });
    }

    // Resolve task directory
    const taskDir = taskDirOrId.includes("/")
      ? taskDirOrId
      : await taskService.findTaskById(workspace_path, taskDirOrId);

    if (!taskDir) {
      return reply.status(404).send({ error: `Task not found: ${taskDirOrId}` });
    }

    // Get task
    const task = await taskService.getTask(taskDir);
    if (!task) {
      return reply.status(404).send({ error: `Task not found: ${taskDirOrId}` });
    }

    // Set SSE headers
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
      "X-Accel-Buffering": "no",
    });

    // Send initial task state
    reply.raw.write(`data: ${JSON.stringify({ type: "task", task: toSnakeCaseTask(task) })}\n\n`);

    // If task is already completed, send done and close
    if (task.status === "completed" || task.status === "failed" || task.status === "cancelled") {
      reply.raw.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
      reply.raw.end();
      return;
    }

    // Find queue task for this task
    let queueTaskId: string | null = null;
    if (task.sessionId && state.taskQueue) {
      const queueTasks = state.taskQueue.getTasks();
      const queueTask = queueTasks.find((qt) => qt.payload.session_id === task.sessionId);
      if (queueTask) {
        queueTaskId = queueTask.id;
      }
    }

    // If no queue task found, subscribe to task state changes instead
    if (!queueTaskId) {
      const unsubscribe = state.taskSSEManager.subscribe(task.id, (event) => {
        try {
          if (reply.raw.writableEnded || reply.raw.destroyed) {
            return false;
          }
          reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);

          // Check if task is done
          if (event.type === "STATE_CHANGED") {
            const newState = (event as { new_state?: string }).new_state;
            if (newState === "completed" || newState === "failed" || newState === "cancelled") {
              reply.raw.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
              reply.raw.end();
            }
          }
          return true;
        } catch {
          return false;
        }
      }, workspace_path);

      request.raw.on("close", () => {
        unsubscribe();
      });

      await new Promise<void>((resolve) => {
        request.raw.on("close", resolve);
      });
      return;
    }

    // Subscribe to queue task events
    const onProgress = (data: { id: string; progress: unknown }) => {
      if (data.id === queueTaskId) {
        reply.raw.write(`data: ${JSON.stringify({ type: "progress", ...data })}\n\n`);
      }
    };

    const onCompleted = (data: { task: { id: string } }) => {
      if (data.task.id === queueTaskId) {
        reply.raw.write(`data: ${JSON.stringify({ type: "completed", task: data.task })}\n\n`);
        reply.raw.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
        cleanup();
        reply.raw.end();
      }
    };

    const onFailed = (data: { task: { id: string } }) => {
      if (data.task.id === queueTaskId) {
        reply.raw.write(`data: ${JSON.stringify({ type: "failed", task: data.task })}\n\n`);
        reply.raw.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
        cleanup();
        reply.raw.end();
      }
    };

    const onCancelled = (data: { task: { id: string } }) => {
      if (data.task.id === queueTaskId) {
        reply.raw.write(`data: ${JSON.stringify({ type: "cancelled", task: data.task })}\n\n`);
        reply.raw.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
        cleanup();
        reply.raw.end();
      }
    };

    let cleanedUp = false;

    const cleanup = () => {
      if (cleanedUp) return;
      cleanedUp = true;

      state.taskQueue.off("task:progress", onProgress);
      state.taskQueue.off("task:completed", onCompleted);
      state.taskQueue.off("task:failed", onFailed);
      state.taskQueue.off("task:cancelled", onCancelled);
    };

    state.taskQueue.on("task:progress", onProgress);
    state.taskQueue.on("task:completed", onCompleted);
    state.taskQueue.on("task:failed", onFailed);
    state.taskQueue.on("task:cancelled", onCancelled);

    // Heartbeat to keep connection alive
    const heartbeatInterval = setInterval(() => {
      if (request.raw.destroyed || cleanedUp) {
        clearInterval(heartbeatInterval);
        cleanup();
        return;
      }
      reply.raw.write(`data: ${JSON.stringify({ type: "ping" })}\n\n`);
    }, 30000);

    const handleDisconnect = () => {
      clearInterval(heartbeatInterval);
      cleanup();
    };

    await new Promise<void>((resolve) => {
      request.raw.on("close", () => {
        handleDisconnect();
        resolve();
      });
    });
  });

  // ============================================================================
  // Task Status Lifecycle Endpoints
  // These endpoints provide REST API for task state transitions
  // ============================================================================

  /**
   * Helper to find task directory from ID or path
   */
  async function resolveTaskDir(
    taskIdOrPath: string,
    workspacePath: string
  ): Promise<string | null> {
    // Check cache first
    const cached = getCacheEntry(taskIdOrPath);
    if (cached) {
      return cached.taskDir;
    }

    // Try to find by ID
    const taskDir = await taskService.findTaskById(workspacePath, taskIdOrPath);
    if (taskDir) {
      setCacheEntry(taskIdOrPath, workspacePath, taskDir);
    }
    return taskDir;
  }

  // ============================================================================
  // POST /api/task/start - Set as current task + queue -> in_progress + trigger execution
  // ============================================================================
  fastify.post<{
    Body: {
      workspace_path: string;
      task_id: string;
      trigger_execution?: boolean;
    };
  }>("/api/task/start", {
    schema: {
      description: "Start a task: set as current task, queue -> in_progress, optionally trigger execution",
      tags: ["tasks"],
      body: {
        type: "object",
        properties: {
          workspace_path: { type: "string", description: "Workspace path (required)" },
          task_id: { type: "string", description: "Task ID or directory (required)" },
          trigger_execution: { type: "boolean", description: "Trigger TaskQueueManager execution", default: false },
        },
        required: ["workspace_path", "task_id"],
      },
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            task_id: { type: "string" },
            status: { type: "string" },
            previous_status: { type: "string" },
          },
        },
        400: {
          type: "object",
          properties: {
            error: { type: "string" },
            code: { type: "string" },
          },
        },
        404: {
          type: "object",
          properties: {
            error: { type: "string" },
            code: { type: "string" },
          },
        },
      },
    },
  }, async (request, reply) => {
    const { workspace_path, task_id, trigger_execution } = request.body;

    if (!workspace_path) {
      reply.code(400);
      return { error: "workspace_path is required", code: "MISSING_WORKSPACE_PATH" };
    }

    if (!task_id) {
      reply.code(400);
      return { error: "task_id is required", code: "MISSING_TASK_ID" };
    }

    // Find task directory
    const taskDir = await resolveTaskDir(task_id, workspace_path);
    if (!taskDir) {
      reply.code(404);
      return { error: `Task not found: ${task_id}`, code: "TASK_NOT_FOUND" };
    }

    // Get current task
    const task = await taskService.getTask(taskDir);
    if (!task) {
      reply.code(404);
      return { error: `Task not found: ${task_id}`, code: "TASK_NOT_FOUND" };
    }

    const previousStatus = task.status;

    // If task is in queue status, transition to in_progress via START event
    if (task.status === "queue") {
      // Create START event
      const nextSequence = (task.lastEvent?.sequence ?? 0) + 1;
      const event: TaskEvent = {
        eventId: randomUUID(),
        sequence: nextSequence,
        type: "START",
        timestamp: new Date().toISOString(),
      };

      const result = await taskEventStore.applyEvent(taskDir, event);

      if (!result.success) {
        reply.code(400);
        return { error: result.error || "Failed to start task", code: "START_FAILED" };
      }

      // Broadcast state change
      taskSSEManager.broadcast(
        task_id,
        {
          type: "STATE_CHANGED",
          event,
          new_state: result.newState,
        },
        workspace_path
      );

      // Optionally trigger TaskQueueManager execution
      if (trigger_execution && state.taskQueue && task.agent && task.prompt) {
        try {
          await state.taskQueue.enqueue({
            agent_id: task.agent,
            session_id: task.sessionId,
            input: task.prompt,
            cwd: workspace_path,
          });
        } catch (e) {
          console.warn(`[task/start] Failed to enqueue task for execution:`, e);
        }
      }

      return {
        success: true,
        task_id,
        status: result.newState,
        previous_status: previousStatus,
      };
    }

    return {
      success: true,
      task_id,
      status: task.status,
      previous_status: previousStatus,
      message: `Task is already in ${task.status} status`,
    };
  });

  // ============================================================================
  // POST /api/task/finish - Clear current task
  // ============================================================================
  fastify.post<{
    Body: {
      workspace_path: string;
      task_id: string;
    };
  }>("/api/task/finish", {
    schema: {
      description: "Finish a task: clear current task marker",
      tags: ["tasks"],
      body: {
        type: "object",
        properties: {
          workspace_path: { type: "string", description: "Workspace path (required)" },
          task_id: { type: "string", description: "Task ID or directory (required)" },
        },
        required: ["workspace_path", "task_id"],
      },
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            task_id: { type: "string" },
            message: { type: "string" },
          },
        },
      },
    },
  }, async (request, reply) => {
    const { workspace_path, task_id } = request.body;

    if (!workspace_path) {
      reply.code(400);
      return { error: "workspace_path is required", code: "MISSING_WORKSPACE_PATH" };
    }

    return {
      success: true,
      task_id,
      message: "Task finish acknowledged",
    };
  });

  // ============================================================================
  // POST /api/task/pause - in_progress/queue -> paused
  // ============================================================================
  fastify.post<{
    Body: {
      workspace_path: string;
      task_id: string;
    };
  }>("/api/task/pause", {
    schema: {
      description: "Pause a task: in_progress/queue -> paused (saves pausedSnapshot)",
      tags: ["tasks"],
      body: {
        type: "object",
        properties: {
          workspace_path: { type: "string", description: "Workspace path (required)" },
          task_id: { type: "string", description: "Task ID or directory (required)" },
        },
        required: ["workspace_path", "task_id"],
      },
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            task_id: { type: "string" },
            status: { type: "string" },
            previous_status: { type: "string" },
          },
        },
        400: {
          type: "object",
          properties: {
            error: { type: "string" },
            code: { type: "string" },
          },
        },
        404: {
          type: "object",
          properties: {
            error: { type: "string" },
            code: { type: "string" },
          },
        },
      },
    },
  }, async (request, reply) => {
    const { workspace_path, task_id } = request.body;

    if (!workspace_path) {
      reply.code(400);
      return { error: "workspace_path is required", code: "MISSING_WORKSPACE_PATH" };
    }

    if (!task_id) {
      reply.code(400);
      return { error: "task_id is required", code: "MISSING_TASK_ID" };
    }

    const taskDir = await resolveTaskDir(task_id, workspace_path);
    if (!taskDir) {
      reply.code(404);
      return { error: `Task not found: ${task_id}`, code: "TASK_NOT_FOUND" };
    }

    const task = await taskService.getTask(taskDir);
    if (!task) {
      reply.code(404);
      return { error: `Task not found: ${task_id}`, code: "TASK_NOT_FOUND" };
    }

    if (!["queue", "in_progress"].includes(task.status)) {
      reply.code(400);
      return {
        error: `Cannot pause task in '${task.status}' status. Expected: queue or in_progress`,
        code: "INVALID_STATUS_TRANSITION",
      };
    }

    const previousStatus = task.status;
    const nextSequence = (task.lastEvent?.sequence ?? 0) + 1;
    const event: TaskEvent = {
      eventId: randomUUID(),
      sequence: nextSequence,
      type: "PAUSE",
      timestamp: new Date().toISOString(),
      payload: {
        fromState: task.status,
        subtaskIndex: task.current_phase ?? 0,
        pausedAt: new Date().toISOString(),
      },
    };

    const result = await taskEventStore.applyEvent(taskDir, event);

    if (!result.success) {
      reply.code(400);
      return { error: result.error || "Failed to pause task", code: "PAUSE_FAILED" };
    }

    await taskService.updateTask(taskDir, {
      machine_context: {
        current_subtask_index: task.machine_context?.current_subtask_index ?? 0,
        requires_plan_review: task.machine_context?.requires_plan_review ?? false,
        paused_snapshot: {
          from_state: previousStatus,
          subtask_index: task.current_phase ?? 0,
          paused_at: new Date().toISOString(),
        },
      },
    });

    taskSSEManager.broadcast(
      task_id,
      { type: "STATE_CHANGED", event, new_state: result.newState },
      workspace_path
    );

    return {
      success: true,
      task_id,
      status: result.newState,
      previous_status: previousStatus,
    };
  });

  // ============================================================================
  // POST /api/task/resume - paused -> queue/in_progress
  // ============================================================================
  fastify.post<{
    Body: {
      workspace_path: string;
      task_id: string;
    };
  }>("/api/task/resume", {
    schema: {
      description: "Resume a paused task: paused -> queue/in_progress",
      tags: ["tasks"],
      body: {
        type: "object",
        properties: {
          workspace_path: { type: "string", description: "Workspace path (required)" },
          task_id: { type: "string", description: "Task ID or directory (required)" },
        },
        required: ["workspace_path", "task_id"],
      },
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            task_id: { type: "string" },
            status: { type: "string" },
            previous_status: { type: "string" },
          },
        },
        400: {
          type: "object",
          properties: {
            error: { type: "string" },
            code: { type: "string" },
          },
        },
        404: {
          type: "object",
          properties: {
            error: { type: "string" },
            code: { type: "string" },
          },
        },
      },
    },
  }, async (request, reply) => {
    const { workspace_path, task_id } = request.body;

    if (!workspace_path) {
      reply.code(400);
      return { error: "workspace_path is required", code: "MISSING_WORKSPACE_PATH" };
    }

    if (!task_id) {
      reply.code(400);
      return { error: "task_id is required", code: "MISSING_TASK_ID" };
    }

    const taskDir = await resolveTaskDir(task_id, workspace_path);
    if (!taskDir) {
      reply.code(404);
      return { error: `Task not found: ${task_id}`, code: "TASK_NOT_FOUND" };
    }

    const task = await taskService.getTask(taskDir);
    if (!task) {
      reply.code(404);
      return { error: `Task not found: ${task_id}`, code: "TASK_NOT_FOUND" };
    }

    if (task.status !== "paused") {
      reply.code(400);
      return {
        error: `Cannot resume task in '${task.status}' status. Expected: paused`,
        code: "INVALID_STATUS_TRANSITION",
      };
    }

    const pausedSnapshot = task.machine_context?.paused_snapshot;
    const targetStatus = pausedSnapshot?.from_state as string || "queue";
    const previousStatus = task.status;

    const nextSequence = (task.lastEvent?.sequence ?? 0) + 1;
    const event: TaskEvent = {
      eventId: randomUUID(),
      sequence: nextSequence,
      type: "RESUME",
      timestamp: new Date().toISOString(),
      payload: { toState: targetStatus },
    };

    const result = await taskEventStore.applyEvent(taskDir, event);

    if (!result.success) {
      reply.code(400);
      return { error: result.error || "Failed to resume task", code: "RESUME_FAILED" };
    }

    // Clear paused_snapshot from machine_context
    await taskService.updateTask(taskDir, {
      machine_context: {
        current_subtask_index: task.machine_context?.current_subtask_index ?? 0,
        requires_plan_review: task.machine_context?.requires_plan_review ?? false,
        paused_snapshot: undefined,
      },
    });

    taskSSEManager.broadcast(
      task_id,
      { type: "STATE_CHANGED", event, new_state: result.newState },
      workspace_path
    );

    return {
      success: true,
      task_id,
      status: result.newState,
      previous_status: previousStatus,
    };
  });

  // ============================================================================
  // POST /api/task/approve - human_review -> completed
  // ============================================================================
  fastify.post<{
    Body: {
      workspace_path: string;
      task_id: string;
      comment?: string;
    };
  }>("/api/task/approve", {
    schema: {
      description: "Approve a task in human_review: human_review -> completed",
      tags: ["tasks"],
      body: {
        type: "object",
        properties: {
          workspace_path: { type: "string", description: "Workspace path (required)" },
          task_id: { type: "string", description: "Task ID or directory (required)" },
          comment: { type: "string", description: "Optional approval comment" },
        },
        required: ["workspace_path", "task_id"],
      },
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            task_id: { type: "string" },
            status: { type: "string" },
            previous_status: { type: "string" },
          },
        },
        400: {
          type: "object",
          properties: {
            error: { type: "string" },
            code: { type: "string" },
          },
        },
        404: {
          type: "object",
          properties: {
            error: { type: "string" },
            code: { type: "string" },
          },
        },
      },
    },
  }, async (request, reply) => {
    const { workspace_path, task_id, comment } = request.body;

    if (!workspace_path) {
      reply.code(400);
      return { error: "workspace_path is required", code: "MISSING_WORKSPACE_PATH" };
    }

    if (!task_id) {
      reply.code(400);
      return { error: "task_id is required", code: "MISSING_TASK_ID" };
    }

    const taskDir = await resolveTaskDir(task_id, workspace_path);
    if (!taskDir) {
      reply.code(404);
      return { error: `Task not found: ${task_id}`, code: "TASK_NOT_FOUND" };
    }

    const task = await taskService.getTask(taskDir);
    if (!task) {
      reply.code(404);
      return { error: `Task not found: ${task_id}`, code: "TASK_NOT_FOUND" };
    }

    if (task.status !== "human_review") {
      reply.code(400);
      return {
        error: `Cannot approve task in '${task.status}' status. Expected: human_review`,
        code: "INVALID_STATUS_TRANSITION",
      };
    }

    const previousStatus = task.status;
    const nextSequence = (task.lastEvent?.sequence ?? 0) + 1;
    const event: TaskEvent = {
      eventId: randomUUID(),
      sequence: nextSequence,
      type: "APPROVED",
      timestamp: new Date().toISOString(),
      payload: comment ? { comment } : undefined,
    };

    const result = await taskEventStore.applyEvent(taskDir, event);

    if (!result.success) {
      reply.code(400);
      return { error: result.error || "Failed to approve task", code: "APPROVE_FAILED" };
    }

    await taskService.updateTask(taskDir, {
      completedAt: new Date().toISOString().split("T")[0],
    });

    taskSSEManager.broadcast(
      task_id,
      { type: "STATE_CHANGED", event, new_state: result.newState },
      workspace_path
    );

    return {
      success: true,
      task_id,
      status: result.newState,
      previous_status: previousStatus,
    };
  });

  // ============================================================================
  // POST /api/task/reject - human_review -> backlog
  // ============================================================================
  fastify.post<{
    Body: {
      workspace_path: string;
      task_id: string;
      reason?: string;
    };
  }>("/api/task/reject", {
    schema: {
      description: "Reject a task in human_review: human_review -> backlog",
      tags: ["tasks"],
      body: {
        type: "object",
        properties: {
          workspace_path: { type: "string", description: "Workspace path (required)" },
          task_id: { type: "string", description: "Task ID or directory (required)" },
          reason: { type: "string", description: "Optional rejection reason" },
        },
        required: ["workspace_path", "task_id"],
      },
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            task_id: { type: "string" },
            status: { type: "string" },
            previous_status: { type: "string" },
          },
        },
        400: {
          type: "object",
          properties: {
            error: { type: "string" },
            code: { type: "string" },
          },
        },
        404: {
          type: "object",
          properties: {
            error: { type: "string" },
            code: { type: "string" },
          },
        },
      },
    },
  }, async (request, reply) => {
    const { workspace_path, task_id, reason } = request.body;

    if (!workspace_path) {
      reply.code(400);
      return { error: "workspace_path is required", code: "MISSING_WORKSPACE_PATH" };
    }

    if (!task_id) {
      reply.code(400);
      return { error: "task_id is required", code: "MISSING_TASK_ID" };
    }

    const taskDir = await resolveTaskDir(task_id, workspace_path);
    if (!taskDir) {
      reply.code(404);
      return { error: `Task not found: ${task_id}`, code: "TASK_NOT_FOUND" };
    }

    const task = await taskService.getTask(taskDir);
    if (!task) {
      reply.code(404);
      return { error: `Task not found: ${task_id}`, code: "TASK_NOT_FOUND" };
    }

    if (task.status !== "human_review") {
      reply.code(400);
      return {
        error: `Cannot reject task in '${task.status}' status. Expected: human_review`,
        code: "INVALID_STATUS_TRANSITION",
      };
    }

    const previousStatus = task.status;
    const nextSequence = (task.lastEvent?.sequence ?? 0) + 1;
    const event: TaskEvent = {
      eventId: randomUUID(),
      sequence: nextSequence,
      type: "REJECTED",
      timestamp: new Date().toISOString(),
      payload: reason ? { reason } : undefined,
    };

    const result = await taskEventStore.applyEvent(taskDir, event);

    if (!result.success) {
      reply.code(400);
      return { error: result.error || "Failed to reject task", code: "REJECT_FAILED" };
    }

    taskSSEManager.broadcast(
      task_id,
      { type: "STATE_CHANGED", event, new_state: result.newState },
      workspace_path
    );

    return {
      success: true,
      task_id,
      status: result.newState,
      previous_status: previousStatus,
    };
  });

  // ============================================================================
  // POST /api/task/retry - failed -> queue
  // ============================================================================
  fastify.post<{
    Body: {
      workspace_path: string;
      task_id: string;
    };
  }>("/api/task/retry", {
    schema: {
      description: "Retry a failed task: failed -> queue",
      tags: ["tasks"],
      body: {
        type: "object",
        properties: {
          workspace_path: { type: "string", description: "Workspace path (required)" },
          task_id: { type: "string", description: "Task ID or directory (required)" },
        },
        required: ["workspace_path", "task_id"],
      },
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            task_id: { type: "string" },
            status: { type: "string" },
            previous_status: { type: "string" },
          },
        },
        400: {
          type: "object",
          properties: {
            error: { type: "string" },
            code: { type: "string" },
          },
        },
        404: {
          type: "object",
          properties: {
            error: { type: "string" },
            code: { type: "string" },
          },
        },
      },
    },
  }, async (request, reply) => {
    const { workspace_path, task_id } = request.body;

    if (!workspace_path) {
      reply.code(400);
      return { error: "workspace_path is required", code: "MISSING_WORKSPACE_PATH" };
    }

    if (!task_id) {
      reply.code(400);
      return { error: "task_id is required", code: "MISSING_TASK_ID" };
    }

    const taskDir = await resolveTaskDir(task_id, workspace_path);
    if (!taskDir) {
      reply.code(404);
      return { error: `Task not found: ${task_id}`, code: "TASK_NOT_FOUND" };
    }

    const task = await taskService.getTask(taskDir);
    if (!task) {
      reply.code(404);
      return { error: `Task not found: ${task_id}`, code: "TASK_NOT_FOUND" };
    }

    if (task.status !== "failed") {
      reply.code(400);
      return {
        error: `Cannot retry task in '${task.status}' status. Expected: failed`,
        code: "INVALID_STATUS_TRANSITION",
      };
    }

    const previousStatus = task.status;
    const nextSequence = (task.lastEvent?.sequence ?? 0) + 1;
    const event: TaskEvent = {
      eventId: randomUUID(),
      sequence: nextSequence,
      type: "RETRY",
      timestamp: new Date().toISOString(),
    };

    const result = await taskEventStore.applyEvent(taskDir, event);

    if (!result.success) {
      reply.code(400);
      return { error: result.error || "Failed to retry task", code: "RETRY_FAILED" };
    }

    await taskService.updateTask(taskDir, { lastAttemptFailed: false });

    taskSSEManager.broadcast(
      task_id,
      { type: "STATE_CHANGED", event, new_state: result.newState },
      workspace_path
    );

    return {
      success: true,
      task_id,
      status: result.newState,
      previous_status: previousStatus,
    };
  });

  // ============================================================================
  // POST /api/task/cancel - * -> cancelled
  // ============================================================================
  fastify.post<{
    Body: {
      workspace_path: string;
      task_id: string;
      reason?: string;
    };
  }>("/api/task/cancel", {
    schema: {
      description: "Cancel a task: * -> cancelled (terminal state)",
      tags: ["tasks"],
      body: {
        type: "object",
        properties: {
          workspace_path: { type: "string", description: "Workspace path (required)" },
          task_id: { type: "string", description: "Task ID or directory (required)" },
          reason: { type: "string", description: "Optional cancellation reason" },
        },
        required: ["workspace_path", "task_id"],
      },
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            task_id: { type: "string" },
            status: { type: "string" },
            previous_status: { type: "string" },
          },
        },
        400: {
          type: "object",
          properties: {
            error: { type: "string" },
            code: { type: "string" },
          },
        },
        404: {
          type: "object",
          properties: {
            error: { type: "string" },
            code: { type: "string" },
          },
        },
      },
    },
  }, async (request, reply) => {
    const { workspace_path, task_id, reason } = request.body;

    if (!workspace_path) {
      reply.code(400);
      return { error: "workspace_path is required", code: "MISSING_WORKSPACE_PATH" };
    }

    if (!task_id) {
      reply.code(400);
      return { error: "task_id is required", code: "MISSING_TASK_ID" };
    }

    const taskDir = await resolveTaskDir(task_id, workspace_path);
    if (!taskDir) {
      reply.code(404);
      return { error: `Task not found: ${task_id}`, code: "TASK_NOT_FOUND" };
    }

    const task = await taskService.getTask(taskDir);
    if (!task) {
      reply.code(404);
      return { error: `Task not found: ${task_id}`, code: "TASK_NOT_FOUND" };
    }

    const nonCancellableStates = ["completed", "cancelled", "archived"];
    if (nonCancellableStates.includes(task.status)) {
      reply.code(400);
      return {
        error: `Cannot cancel task in '${task.status}' status`,
        code: "INVALID_STATUS_TRANSITION",
      };
    }

    const previousStatus = task.status;
    const nextSequence = (task.lastEvent?.sequence ?? 0) + 1;
    const event: TaskEvent = {
      eventId: randomUUID(),
      sequence: nextSequence,
      type: "CANCEL",
      timestamp: new Date().toISOString(),
      payload: reason ? { reason } : undefined,
    };

    const result = await taskEventStore.applyEvent(taskDir, event);

    if (!result.success) {
      reply.code(400);
      return { error: result.error || "Failed to cancel task", code: "CANCEL_FAILED" };
    }

    taskSSEManager.broadcast(
      task_id,
      { type: "STATE_CHANGED", event, new_state: result.newState },
      workspace_path
    );

    return {
      success: true,
      task_id,
      status: result.newState,
      previous_status: previousStatus,
    };
  });

  // ============================================================================
  // POST /api/task/archive - completed -> archived
  // ============================================================================
  fastify.post<{
    Body: {
      workspace_path: string;
      task_id: string;
    };
  }>("/api/task/archive", {
    schema: {
      description: "Archive a completed task: completed -> archived",
      tags: ["tasks"],
      body: {
        type: "object",
        properties: {
          workspace_path: { type: "string", description: "Workspace path (required)" },
          task_id: { type: "string", description: "Task ID or directory (required)" },
        },
        required: ["workspace_path", "task_id"],
      },
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            task_id: { type: "string" },
            status: { type: "string" },
            previous_status: { type: "string" },
            archive_path: { type: "string" },
          },
        },
        400: {
          type: "object",
          properties: {
            error: { type: "string" },
            code: { type: "string" },
          },
        },
        404: {
          type: "object",
          properties: {
            error: { type: "string" },
            code: { type: "string" },
          },
        },
      },
    },
  }, async (request, reply) => {
    const { workspace_path, task_id } = request.body;

    if (!workspace_path) {
      reply.code(400);
      return { error: "workspace_path is required", code: "MISSING_WORKSPACE_PATH" };
    }

    if (!task_id) {
      reply.code(400);
      return { error: "task_id is required", code: "MISSING_TASK_ID" };
    }

    const taskDir = await resolveTaskDir(task_id, workspace_path);
    if (!taskDir) {
      reply.code(404);
      return { error: `Task not found: ${task_id}`, code: "TASK_NOT_FOUND" };
    }

    const task = await taskService.getTask(taskDir);
    if (!task) {
      reply.code(404);
      return { error: `Task not found: ${task_id}`, code: "TASK_NOT_FOUND" };
    }

    if (task.status !== "completed") {
      reply.code(400);
      return {
        error: `Cannot archive task in '${task.status}' status. Expected: completed`,
        code: "INVALID_STATUS_TRANSITION",
      };
    }

    const previousStatus = task.status;
    const nextSequence = (task.lastEvent?.sequence ?? 0) + 1;
    const event: TaskEvent = {
      eventId: randomUUID(),
      sequence: nextSequence,
      type: "ARCHIVE",
      timestamp: new Date().toISOString(),
    };

    const result = await taskEventStore.applyEvent(taskDir, event);

    if (!result.success) {
      reply.code(400);
      return { error: result.error || "Failed to archive task", code: "ARCHIVE_FAILED" };
    }

    // Archive the task using CLI function
    const archivePath = archiveTaskToDirectory(taskDir, workspace_path);
    deleteCacheEntry(task_id);

    taskSSEManager.broadcast(
      task_id,
      { type: "STATE_CHANGED", event, new_state: result.newState },
      workspace_path
    );

    return {
      success: true,
      task_id,
      status: result.newState,
      previous_status: previousStatus,
      archive_path: archivePath,
    };
  });

  // ============================================================================
  // GET /api/task/list-archive - List archived tasks
  // ============================================================================
  fastify.get<{
    Querystring: {
      workspace_path: string;
      month?: string;
    };
  }>("/api/task/list-archive", {
    schema: {
      description: "List archived tasks",
      tags: ["tasks"],
      querystring: {
        type: "object",
        properties: {
          workspace_path: { type: "string", description: "Workspace path (required)" },
          month: { type: "string", description: "Filter by month (YYYY-MM format)" },
        },
        required: ["workspace_path"],
      },
      response: {
        200: {
          type: "object",
          properties: {
            archives: {
              type: "object",
              additionalProperties: {
                type: "array",
                items: { type: "string" },
              },
            },
          },
        },
        400: {
          type: "object",
          properties: {
            error: { type: "string" },
            code: { type: "string" },
          },
        },
      },
    },
  }, async (request, reply) => {
    const { workspace_path, month } = request.query;

    if (!workspace_path) {
      reply.code(400);
      return { error: "workspace_path is required", code: "MISSING_WORKSPACE_PATH" };
    }

    // Use CLI function for archived tasks
    const archivedMap = getArchivedTasks(workspace_path, month);
    const archives: Record<string, string[]> = {};
    for (const [monthKey, tasks] of archivedMap) {
      archives[monthKey] = tasks;
    }

    return { archives };
  });

  // ==========================================================================
  // POST /api/task/review - View task details for human review
  // ==========================================================================
  fastify.post<{
    Querystring: { workspace_path?: string; task_dir?: string };
  }>("/api/task/review", {
    schema: {
      description: "View task details for human review",
      tags: ["tasks"],
      querystring: {
        type: "object",
        properties: {
          workspace_path: { type: "string", description: "Workspace path" },
          task_dir: { type: "string", description: "Task directory path (required)" },
        },
        required: ["task_dir"],
      },
    },
  }, async (request, reply) => {
    const { workspace_path, task_dir } = request.query;

    if (!task_dir) {
      reply.code(400);
      return { error: "task_dir is required", code: "MISSING_TASK_DIR" };
    }

    // Resolve task directory
    let taskDir = task_dir;
    if (!task_dir.startsWith("/") && workspace_path) {
      const resolved = resolveTaskDirectory(task_dir, workspace_path);
      if (resolved) taskDir = resolved;
    }

    if (!existsSync(taskDir)) {
      reply.code(404);
      return { error: "Task not found", code: "TASK_NOT_FOUND" };
    }

    const taskData = readTaskJsonFromWorkspace(taskDir);
    if (!taskData) {
      reply.code(404);
      return { error: "Task not found", code: "TASK_NOT_FOUND" };
    }

    const dirName = basename(taskDir);

    // Get PR info if pr_url exists
    let prInfo: { additions?: number; deletions?: number; changedFiles?: number } = {};
    if (taskData.pr_url) {
      try {
        const prUrl = String(taskData.pr_url);
        const prMatch = prUrl.match(/\/pull\/(\d+)/);
        if (prMatch && workspace_path) {
          const result = execSync(
            `gh pr view ${prMatch[1]} --json additions,deletions,changedFiles 2>/dev/null`,
            { cwd: workspace_path, encoding: "utf-8" }
          );
          prInfo = JSON.parse(result);
        }
      } catch {
        // Ignore gh errors
      }
    }

    // Get specs data
    const specsData = await taskService.getTaskSpecsData(taskDir);

    return {
      success: true,
      data: {
        task_dir: taskDir,
        task_name: dirName,
        task: {
          id: taskData.id,
          name: taskData.name,
          title: taskData.title,
          description: taskData.description,
          status: taskData.status,
          priority: taskData.priority,
          dev_type: taskData.dev_type,
          scope: taskData.scope,
          branch: taskData.branch,
          base_branch: taskData.base_branch,
          pr_url: taskData.pr_url,
          creator: taskData.creator,
          assignee: taskData.assignee,
          created_at: taskData.createdAt,
          completed_at: taskData.completedAt,
        },
        pr_info: prInfo,
        specs: {
          prd_content: specsData.prdContent,
          prd_path: specsData.prdPath,
          subtasks: specsData.subtasks,
          logs: specsData.logs,
        },
        next_actions: taskData.status === "human_review"
          ? ["approve", "reject"]
          : taskData.status === "failed"
            ? ["retry"]
            : [],
      },
    };
  });

  // ==========================================================================
  // POST /api/task/context - Get session context for AI agents
  // ==========================================================================
  fastify.post<{
    Querystring: { workspace_path?: string };
    Body: { json?: boolean };
  }>("/api/task/context", {
    schema: {
      description: "Get session context for AI agents",
      tags: ["tasks"],
      querystring: {
        type: "object",
        properties: {
          workspace_path: { type: "string", description: "Workspace path (required)" },
        },
        required: ["workspace_path"],
      },
      body: {
        type: "object",
        properties: {
          json: { type: "boolean", description: "Return JSON format" },
        },
      },
    },
  }, async (request, reply) => {
    const { workspace_path } = request.query;
    const { json: jsonFormat } = request.body || {};

    if (!workspace_path) {
      reply.code(400);
      return { error: "workspace_path is required", code: "MISSING_WORKSPACE_PATH" };
    }

    try {
      const developer = getDeveloper(workspace_path) || "";
      const tasksDir = getTasksDir(workspace_path);

      // Git info
      const { stdout: branchOut } = runGitCommand(["branch", "--show-current"], workspace_path);
      const branch = branchOut.trim() || "unknown";

      const { stdout: statusOut } = runGitCommand(["status", "--porcelain"], workspace_path);
      const statusLines = statusOut.split("\n").filter((line: string) => line.trim());
      const gitStatusCount = statusLines.length;
      const isClean = gitStatusCount === 0;

      // Recent commits
      const { stdout: logOut } = runGitCommand(["log", "--oneline", "-5"], workspace_path);
      const commits: Array<{ hash: string; message: string }> = [];
      for (const line of logOut.split("\n")) {
        if (line.trim()) {
          const parts = line.split(" ", 1);
          const hash = parts[0] || "";
          const message = line.slice(hash.length + 1) || "";
          commits.push({ hash, message });
        }
      }

      // Current task
      let currentTask: {
        path: string;
        name: string;
        status: string;
        createdAt: string;
        description: string;
        hasPrd: boolean;
      } | null = null;
      const currentTaskPath = getCurrentTask(workspace_path);
      if (currentTaskPath) {
        const currentTaskDir = join(workspace_path, currentTaskPath);
        const taskData = readTaskJsonFromWorkspace(currentTaskDir);
        if (taskData) {
          const prdFile = join(currentTaskDir, "prd.md");
          currentTask = {
            path: currentTaskPath,
            name: String(taskData.name || taskData.id || "unknown"),
            status: String(taskData.status || "unknown"),
            createdAt: String(taskData.createdAt || "unknown"),
            description: String(taskData.description || ""),
            hasPrd: existsSync(prdFile),
          };
        }
      }

      // Active tasks
      const activeTasks = getActiveTasks(workspace_path);

      // My tasks (assigned to developer and not done)
      const myTasks: Array<{ title: string; priority: string; status: string }> = [];
      if (developer) {
        for (const task of activeTasks) {
          if (task.assignee === developer && task.status !== "done") {
            myTasks.push({
              title: task.title,
              priority: task.priority,
              status: task.status,
            });
          }
        }
      }

      // Journal info
      const journalInfo = getJournalInfo(workspace_path);
      const journalRelative = journalInfo.file && developer
        ? `${DIR_VIBEN}/${DIR_WORKSPACE}/${developer}/${journalInfo.file.split("/").pop()}`
        : "";

      const contextData = {
        developer,
        git: {
          branch,
          isClean,
          uncommittedChanges: gitStatusCount,
          recentCommits: commits,
        },
        currentTask,
        tasks: {
          active: activeTasks,
          directory: `${DIR_VIBEN}/${DIR_TASKS}`,
        },
        myTasks,
        journal: {
          file: journalRelative,
          lines: journalInfo.lines,
          nearLimit: journalInfo.lines > 1800,
        },
        paths: {
          workspace: `${DIR_VIBEN}/${DIR_WORKSPACE}/${developer}/`,
          tasks: `${DIR_VIBEN}/${DIR_TASKS}/`,
          spec: "docs/specs/",
        },
      };

      return { success: true, data: contextData };
    } catch (error) {
      reply.code(500);
      return {
        error: error instanceof Error ? error.message : "Failed to get context",
        code: "CONTEXT_FAILED",
      };
    }
  });

  // ==========================================================================
  // POST /api/task/status - Get task status summary or details
  // ==========================================================================
  fastify.post<{
    Querystring: { workspace_path?: string; task_dir?: string };
    Body: {
      assignee?: string;
      status?: string;
      running?: boolean;
      registry?: boolean;
      list?: boolean;
      detail?: boolean;
    };
  }>("/api/task/status", {
    schema: {
      description: "Get task status summary or details",
      tags: ["tasks"],
      querystring: {
        type: "object",
        properties: {
          workspace_path: { type: "string", description: "Workspace path" },
          task_dir: { type: "string", description: "Specific task directory" },
        },
      },
      body: {
        type: "object",
        properties: {
          assignee: { type: "string", description: "Filter by assignee" },
          status: { type: "string", description: "Filter by status" },
          running: { type: "boolean", description: "Show only running tasks" },
          registry: { type: "boolean", description: "Show agent registry" },
          list: { type: "boolean", description: "List worktrees and agents" },
          detail: { type: "boolean", description: "Show detailed status" },
        },
      },
    },
  }, async (request, reply) => {
    const { workspace_path, task_dir } = request.query;
    const { assignee, status, running, registry, list, detail } = request.body || {};

    if (!workspace_path && !task_dir) {
      reply.code(400);
      return { error: "workspace_path or task_dir is required", code: "MISSING_PATH" };
    }

    const repoRoot = workspace_path || (task_dir ? task_dir.split("/.viben/")[0] : "");

    try {
      // Registry view
      if (registry) {
        const agents = registryListAgents(repoRoot);
        return {
          success: true,
          data: {
            type: "registry",
            agents: agents.map((a) => ({
              agent_id: a.id,
              worktree_path: a.worktree_path,
              pid: a.pid,
              task_dir: a.task_dir,
              platform: a.platform,
              started_at: a.started_at,
              running: a.pid ? isProcessRunning(a.pid) : false,
            })),
          },
        };
      }

      // List view (worktrees and agents)
      if (list) {
        const agents = registryListAgents(repoRoot);
        // Get git worktrees
        const { stdout: worktreeOut } = runGitCommand(["worktree", "list", "--porcelain"], repoRoot);
        const worktrees: Array<{ path: string; branch: string; bare: boolean }> = [];
        let currentWorktree: { path?: string; branch?: string; bare?: boolean } = {};

        for (const line of worktreeOut.split("\n")) {
          if (line.startsWith("worktree ")) {
            if (currentWorktree.path) {
              worktrees.push({
                path: currentWorktree.path,
                branch: currentWorktree.branch || "",
                bare: currentWorktree.bare || false,
              });
            }
            currentWorktree = { path: line.slice(9) };
          } else if (line.startsWith("branch ")) {
            currentWorktree.branch = line.slice(7).replace("refs/heads/", "");
          } else if (line === "bare") {
            currentWorktree.bare = true;
          }
        }
        if (currentWorktree.path) {
          worktrees.push({
            path: currentWorktree.path,
            branch: currentWorktree.branch || "",
            bare: currentWorktree.bare || false,
          });
        }

        return {
          success: true,
          data: {
            type: "list",
            worktrees,
            agents: agents.map((a) => ({
              agent_id: a.id,
              worktree_path: a.worktree_path,
              pid: a.pid,
              task_dir: a.task_dir,
              running: a.pid ? isProcessRunning(a.pid) : false,
            })),
          },
        };
      }

      // Specific task detail
      if (task_dir || detail) {
        const targetDir = task_dir || "";
        let resolvedDir = targetDir;
        if (!targetDir.startsWith("/") && workspace_path) {
          const resolved = resolveTaskDirectory(targetDir, workspace_path);
          if (resolved) resolvedDir = resolved;
        }

        if (!existsSync(resolvedDir)) {
          reply.code(404);
          return { error: "Task not found", code: "TASK_NOT_FOUND" };
        }

        const taskData = readTaskJsonFromWorkspace(resolvedDir);
        if (!taskData) {
          reply.code(404);
          return { error: "Task not found", code: "TASK_NOT_FOUND" };
        }

        // Check if agent is running
        const taskId = (taskData.id as string) || basename(resolvedDir);
        const agent = registrySearchAgent(taskId, repoRoot);
        const isRunning = agent?.pid ? isProcessRunning(agent.pid) : false;

        // Get stats
        const stats = getTaskStats(resolvedDir);

        return {
          success: true,
          data: {
            type: "detail",
            task_dir: resolvedDir,
            task: {
              id: taskData.id,
              name: taskData.name,
              title: taskData.title,
              status: taskData.status,
              priority: taskData.priority,
              dev_type: taskData.dev_type,
              branch: taskData.branch,
              pr_url: taskData.pr_url,
              current_phase: taskData.current_phase,
            },
            agent: agent
              ? {
                  agent_id: agent.id,
                  pid: agent.pid,
                  running: isRunning,
                  platform: agent.platform,
                }
              : null,
            stats,
          },
        };
      }

      // Summary view (default)
      const tasks = getActiveTasks(repoRoot);
      let filtered = tasks;

      if (assignee) {
        filtered = filtered.filter((t) => t.assignee === assignee);
      }
      if (status) {
        filtered = filtered.filter((t) => t.status === status);
      }
      if (running) {
        const agents = registryListAgents(repoRoot);
        const runningTaskIds = new Set(
          agents
            .filter((a) => a.pid && isProcessRunning(a.pid))
            .map((a) => a.task_dir?.split("/").pop())
        );
        filtered = filtered.filter((t) => runningTaskIds.has(t.name));
      }

      // Group by status
      const byStatus: Record<string, typeof filtered> = {};
      for (const task of filtered) {
        if (!byStatus[task.status]) {
          byStatus[task.status] = [];
        }
        byStatus[task.status].push(task);
      }

      return {
        success: true,
        data: {
          type: "summary",
          total: filtered.length,
          by_status: byStatus,
          tasks: filtered,
        },
      };
    } catch (error) {
      reply.code(500);
      return {
        error: error instanceof Error ? error.message : "Failed to get status",
        code: "STATUS_FAILED",
      };
    }
  });

  // ==========================================================================
  // POST /api/task/create-pr - Create PR from task
  // ==========================================================================
  fastify.post<{
    Querystring: { workspace_path?: string; task_dir?: string };
    Body: { dry_run?: boolean };
  }>("/api/task/create-pr", {
    schema: {
      description: "Create PR from task",
      tags: ["tasks"],
      querystring: {
        type: "object",
        properties: {
          workspace_path: { type: "string", description: "Workspace path" },
          task_dir: { type: "string", description: "Task directory path" },
        },
      },
      body: {
        type: "object",
        properties: {
          dry_run: { type: "boolean", description: "Show what would be done without making changes" },
        },
      },
    },
  }, async (request, reply) => {
    const { workspace_path, task_dir } = request.query;
    const { dry_run: dryRun } = request.body || {};

    // Determine task directory
    let targetDir = task_dir;
    if (!targetDir && workspace_path) {
      const currentTask = getCurrentTask(workspace_path);
      if (currentTask) {
        targetDir = currentTask;
      }
    }

    if (!targetDir) {
      reply.code(400);
      return { error: "No task directory specified and no current task set", code: "MISSING_TASK" };
    }

    // Resolve path
    let taskDirPath = targetDir;
    if (!targetDir.startsWith("/") && workspace_path) {
      taskDirPath = join(workspace_path, targetDir);
    }

    const repoRoot = workspace_path || taskDirPath.split("/.viben/")[0];

    if (!existsSync(join(taskDirPath, FILE_TASK_JSON))) {
      reply.code(404);
      return { error: "Task not found", code: "TASK_NOT_FOUND" };
    }

    try {
      const taskData = readTaskJsonFromWorkspace(taskDirPath);
      if (!taskData) {
        reply.code(404);
        return { error: "Failed to read task.json", code: "TASK_READ_FAILED" };
      }

      const taskName = String(taskData.name || "");
      const baseBranch = String(taskData.base_branch || "main");
      const scope = String(taskData.scope || "core");
      const devType = String(taskData.dev_type || "feature");

      const prefixMap: Record<string, string> = {
        feature: "feat",
        frontend: "feat",
        backend: "feat",
        fullstack: "feat",
        bugfix: "fix",
        fix: "fix",
        refactor: "refactor",
        docs: "docs",
        test: "test",
      };
      const commitPrefix = prefixMap[devType] || "feat";

      // Get current branch
      const { stdout: branchOut } = runGitCommand(["branch", "--show-current"], repoRoot);
      const currentBranch = branchOut.trim();

      const steps: string[] = [];
      let prUrl = "";

      // Stage changes
      runGitCommand(["add", "-A"], repoRoot);
      runGitCommand(["reset", `${DIR_VIBEN}/workspace/`], repoRoot);
      runGitCommand(["reset", ".agent-log", ".session-id"], repoRoot);

      // Check for staged changes
      const { code: diffCode } = runGitCommand(["diff", "--cached", "--quiet"], repoRoot);
      const hasStagedChanges = diffCode !== 0;

      if (!hasStagedChanges) {
        // Check for unpushed commits
        const { stdout: logOut } = runGitCommand(
          ["log", `origin/${currentBranch}..HEAD`, "--oneline"],
          repoRoot
        );
        const unpushed = logOut.split("\n").filter((line: string) => line.trim()).length;

        if (unpushed === 0) {
          if (dryRun) {
            runGitCommand(["reset", "HEAD"], repoRoot);
          }
          reply.code(400);
          return { error: "No changes to create PR", code: "NO_CHANGES" };
        }
        steps.push(`Found ${unpushed} unpushed commit(s)`);
      } else {
        // Commit changes
        const commitMsg = `${commitPrefix}(${scope}): ${taskName}`;
        if (dryRun) {
          const { stdout: stagedOut } = runGitCommand(["diff", "--cached", "--name-only"], repoRoot);
          steps.push(`[DRY-RUN] Would commit: ${commitMsg}`);
          steps.push(`[DRY-RUN] Staged files: ${stagedOut.split("\n").filter((l: string) => l.trim()).join(", ")}`);
        } else {
          runGitCommand(["commit", "-m", commitMsg], repoRoot);
          steps.push(`Committed: ${commitMsg}`);
        }
      }

      // Push to remote
      if (dryRun) {
        steps.push(`[DRY-RUN] Would push to: origin/${currentBranch}`);
      } else {
        const { code: pushCode, stderr: pushErr } = runGitCommand(
          ["push", "-u", "origin", currentBranch],
          repoRoot
        );
        if (pushCode !== 0) {
          reply.code(500);
          return { error: `Failed to push: ${pushErr}`, code: "PUSH_FAILED" };
        }
        steps.push(`Pushed to origin/${currentBranch}`);
      }

      // Create PR
      const prTitle = `${commitPrefix}(${scope}): ${taskName}`;

      if (dryRun) {
        steps.push(`[DRY-RUN] Would create PR: ${prTitle}`);
        prUrl = "https://github.com/example/repo/pull/DRY-RUN";
      } else {
        // Check if PR already exists
        try {
          const existingPrResult = execSync(
            `gh pr list --head "${currentBranch}" --base "${baseBranch}" --json url --jq ".[0].url"`,
            { cwd: repoRoot, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }
          ).trim();

          if (existingPrResult) {
            prUrl = existingPrResult;
            steps.push(`PR already exists: ${existingPrResult}`);
          }
        } catch {
          // No existing PR
        }

        if (!prUrl) {
          let prBody = "";
          const prdFile = join(taskDirPath, "prd.md");
          if (existsSync(prdFile)) {
            prBody = readFileSync(prdFile, "utf-8");
          }

          try {
            const createPrResult = execSync(
              `gh pr create --draft --base "${baseBranch}" --title "${prTitle}" --body "${prBody.replace(/"/g, '\\"')}"`,
              { cwd: repoRoot, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }
            ).trim();

            prUrl = createPrResult;
            steps.push(`PR created: ${prUrl}`);
          } catch (err) {
            const error = err as { stderr?: string };
            reply.code(500);
            return { error: `Failed to create PR: ${error.stderr || "Unknown error"}`, code: "PR_CREATE_FAILED" };
          }
        }

        // Update task.json
        let createPrPhase = getPhaseForAction(join(taskDirPath, FILE_TASK_JSON), "create-pr");
        if (!createPrPhase) {
          createPrPhase = 4;
        }

        updateTaskField(taskDirPath, "status", "human_review");
        updateTaskField(taskDirPath, "pr_url", prUrl);
        updateTaskField(taskDirPath, "current_phase", createPrPhase);
        steps.push("Task status updated to human_review");
      }

      // In dry-run, reset staging area
      if (dryRun) {
        runGitCommand(["reset", "HEAD"], repoRoot);
      }

      return {
        success: true,
        data: {
          pr_url: prUrl,
          pr_title: prTitle,
          base_branch: baseBranch,
          head_branch: currentBranch,
          dry_run: dryRun || false,
          steps,
        },
      };
    } catch (error) {
      reply.code(500);
      return {
        error: error instanceof Error ? error.message : "Failed to create PR",
        code: "CREATE_PR_FAILED",
      };
    }
  });

  // ==========================================================================
  // POST /api/task/add-session - Add session to journal file
  // ==========================================================================
  fastify.post<{
    Querystring: { workspace_path?: string };
    Body: {
      title: string;
      commit?: string;
      summary?: string;
      content?: string;
    };
  }>("/api/task/add-session", {
    schema: {
      description: "Add a new session to journal file and update index.md",
      tags: ["tasks"],
      querystring: {
        type: "object",
        properties: {
          workspace_path: { type: "string", description: "Workspace path (required)" },
        },
        required: ["workspace_path"],
      },
      body: {
        type: "object",
        properties: {
          title: { type: "string", description: "Session title (required)" },
          commit: { type: "string", description: "Commit hash(es)" },
          summary: { type: "string", description: "Brief summary" },
          content: { type: "string", description: "Detailed content" },
        },
        required: ["title"],
      },
    },
  }, async (request, reply) => {
    const { workspace_path } = request.query;
    const { title, commit, summary, content } = request.body;

    if (!workspace_path) {
      reply.code(400);
      return { error: "workspace_path is required", code: "MISSING_WORKSPACE_PATH" };
    }

    if (!title) {
      reply.code(400);
      return { error: "title is required", code: "MISSING_TITLE" };
    }

    const MAX_LINES = 2000;

    try {
      const developer = getDeveloper(workspace_path);

      if (!developer) {
        reply.code(400);
        return { error: "Developer not initialized", code: "DEVELOPER_NOT_INITIALIZED" };
      }

      // Get workspace directory for developer
      const devDir = join(workspace_path, DIR_VIBEN, DIR_WORKSPACE, developer);
      if (!existsSync(devDir)) {
        reply.code(400);
        return { error: `Workspace directory not found: ${devDir}`, code: "WORKSPACE_NOT_FOUND" };
      }

      const indexPath = join(devDir, "index.md");
      const today = getTodayDate();

      // Get journal info
      const journalInfo = getLatestJournalInfo(devDir);
      const currentSession = getSessionNumberFromIndex(indexPath);
      const newSession = currentSession + 1;

      // Generate session content
      const sessionContent = generateSessionMarkdown({
        sessionNum: newSession,
        title,
        commit: commit || "-",
        summary: summary || "(Add summary)",
        extraContent: content || "(Add details)",
        date: today,
      });
      const contentLines = sessionContent.split("\n").length;

      // Determine target file
      let targetFile = journalInfo.file;
      let targetNum = journalInfo.number;

      // Check if need to rotate journal file
      if (journalInfo.lines + contentLines > MAX_LINES) {
        targetNum = journalInfo.number + 1;
        targetFile = createNewJournalFileSync(devDir, targetNum, developer, today, journalInfo.number);
      }

      // Create initial journal file if none exists
      if (!targetFile) {
        targetNum = 1;
        targetFile = createNewJournalFileSync(devDir, targetNum, developer, today, 0);
      }

      // Append session content to target file
      const existingContent = readFileSync(targetFile, "utf-8");
      writeFileSync(targetFile, existingContent + sessionContent, "utf-8");

      // Update index.md
      const activeFileName = `journal-${targetNum}.md`;
      const updateSuccess = updateIndexWithNewSession({
        indexPath,
        devDir,
        sessionNum: newSession,
        title,
        commit: commit || "-",
        activeFile: activeFileName,
        date: today,
      });

      return {
        success: true,
        data: {
          session: newSession,
          journal_file: activeFileName,
          title,
          index_updated: updateSuccess,
          lines_added: contentLines,
        },
      };
    } catch (error) {
      reply.code(500);
      return {
        error: error instanceof Error ? error.message : "Failed to add session",
        code: "ADD_SESSION_FAILED",
      };
    }
  });

  // ==========================================================================
  // POST /api/task/plan - Start Plan Agent (simplified version)
  // ==========================================================================
  fastify.post<{
    Querystring: { workspace_path?: string };
    Body: {
      name: string;
      type: string;
      requirement: string;
      platform?: string;
    };
  }>("/api/task/plan", {
    schema: {
      description: "Start Plan Agent to plan a task",
      tags: ["tasks"],
      querystring: {
        type: "object",
        properties: {
          workspace_path: { type: "string", description: "Workspace path (required)" },
        },
        required: ["workspace_path"],
      },
      body: {
        type: "object",
        properties: {
          name: { type: "string", description: "Task name (required)" },
          type: { type: "string", description: "Dev type: backend, frontend, fullstack (required)" },
          requirement: { type: "string", description: "Requirement description (required)" },
          platform: { type: "string", description: "Platform: claude, cursor, iflow, opencode" },
        },
        required: ["name", "type", "requirement"],
      },
    },
  }, async (request, reply) => {
    const { workspace_path } = request.query;
    const { name, type: devType, requirement, platform = "claude" } = request.body;

    if (!workspace_path) {
      reply.code(400);
      return { error: "workspace_path is required", code: "MISSING_WORKSPACE_PATH" };
    }

    if (!name || !devType || !requirement) {
      reply.code(400);
      return { error: "name, type, and requirement are required", code: "MISSING_PARAMS" };
    }

    // Validate dev type
    if (!["backend", "frontend", "fullstack"].includes(devType)) {
      reply.code(400);
      return { error: "type must be: backend, frontend, fullstack", code: "INVALID_TYPE" };
    }

    try {
      const adapter = createCLIAdapter(platform);

      // Check plan agent exists
      const planMdPath = adapter.getAgentConfigPath("plan", workspace_path);
      if (!existsSync(planMdPath)) {
        reply.code(400);
        return { error: `Plan agent not found at ${planMdPath}`, code: "PLAN_AGENT_NOT_FOUND" };
      }

      // Check developer is initialized
      const developer = getDeveloper(workspace_path);
      if (!developer) {
        reply.code(400);
        return { error: "Developer not initialized", code: "DEVELOPER_NOT_INITIALIZED" };
      }

      // Create task directory
      const tasksDir = getTasksDir(workspace_path);
      if (!existsSync(tasksDir)) {
        mkdirSync(tasksDir, { recursive: true });
      }

      const datePrefix = getDatePrefix();
      const dirName = `${datePrefix}-${name}`;
      const taskDir = join(tasksDir, dirName);

      if (!existsSync(taskDir)) {
        mkdirSync(taskDir, { recursive: true });
      }

      // Get current branch as base_branch
      const { stdout: branchOut } = runGitCommand(["branch", "--show-current"], workspace_path);
      const currentBranch = branchOut.trim() || "main";
      const today = getTodayDate();

      const taskData = {
        id: name,
        name,
        title: requirement,
        description: "",
        status: "backlog",
        dev_type: devType,
        priority: "P2",
        creator: developer,
        assignee: developer,
        createdAt: today,
        base_branch: currentBranch,
        current_phase: 0,
        next_action: [
          { phase: 1, action: "implement" },
          { phase: 2, action: "check" },
          { phase: 3, action: "finish" },
          { phase: 4, action: "create-pr" },
        ],
        subtasks: [],
        relatedFiles: [],
        notes: "",
      };

      writeTaskJsonFile(taskDir, taskData as unknown as Record<string, unknown>);

      const taskDirRel = `${DIR_VIBEN}/${DIR_TASKS}/${dirName}`;

      // Start Plan Agent in background
      const logFile = join(taskDir, ".plan-log");
      writeFileSync(logFile, "", "utf-8");

      // Build environment
      const env = { ...process.env };
      env.PLAN_TASK_NAME = name;
      env.PLAN_DEV_TYPE = devType;
      env.PLAN_TASK_DIR = taskDirRel;
      env.PLAN_REQUIREMENT = requirement;
      Object.assign(env, adapter.getNonInteractiveEnv());

      // Build CLI command
      const cliCmd = adapter.buildRunCommand({
        agent: "plan",
        prompt: `Start planning for task: ${name}`,
        skipPermissions: true,
        verbose: true,
        jsonOutput: true,
      });

      // Open log file for writing
      const logFd = openSync(logFile, "w");

      // Spawn background process
      const spawnOpts: SpawnOptions = {
        cwd: workspace_path,
        env,
        stdio: ["ignore", logFd, logFd],
        detached: true,
      };

      const child = spawn(cliCmd[0], cliCmd.slice(1), spawnOpts);
      child.unref();

      const agentPid = child.pid || 0;

      // Register agent in registry
      registryAddAgent(
        {
          agentId: `plan-${name}`,
          worktreePath: workspace_path,
          pid: agentPid,
          taskDir: taskDirRel,
          platform,
        },
        workspace_path
      );

      return {
        success: true,
        data: {
          task_name: name,
          task_dir: taskDirRel,
          dev_type: devType,
          agent_id: `plan-${name}`,
          pid: agentPid,
          log_file: logFile,
          platform,
        },
      };
    } catch (error) {
      reply.code(500);
      return {
        error: error instanceof Error ? error.message : "Failed to start plan agent",
        code: "PLAN_FAILED",
      };
    }
  });
}
