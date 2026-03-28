/**
 * Task CLI-style API routes
 *
 * Provides POST endpoints that mirror CLI `viben task *` commands.
 * All endpoints use workspace_path + task_id pattern for consistency.
 *
 * Configuration endpoints:
 * - POST /api/task/set-branch - Set Git branch for task
 * - POST /api/task/set-base - Set PR target branch
 * - POST /api/task/set-agent - Set associated agent
 *
 * Context management endpoints:
 * - POST /api/task/init-context - Initialize context files
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
 * Lifecycle endpoints:
 * - POST /api/task/start - Start task execution
 * - POST /api/task/finish - Finish task
 * - POST /api/task/pause - Pause task
 * - POST /api/task/resume - Resume task
 * - POST /api/task/approve - Approve task in review
 * - POST /api/task/reject - Reject task in review
 * - POST /api/task/retry - Retry failed task
 * - POST /api/task/cancel - Cancel task
 * - POST /api/task/enqueue - Move task to queue
 * - POST /api/task/dequeue - Remove task from queue
 * - POST /api/task/archive - Archive completed task
 * - POST /api/task/list-archive - List archived tasks
 *
 * Review endpoints:
 * - POST /api/task/review - Get task review info
 * - POST /api/task/context - Get task context for AI
 * - POST /api/task/status - Get task status
 * - POST /api/task/create-pr - Create PR from task
 * - POST /api/task/add-session - Add session to task journal
 *
 * Phase endpoints:
 * - POST /api/task/plan - Run plan phase (legacy)
 * - POST /api/task/plan-phase - Run plan phase
 * - POST /api/task/implement-phase - Run implement phase
 * - POST /api/task/check-phase - Run check phase
 * - POST /api/task/work-phase - Run work phase
 *
 * CRUD endpoints:
 * - POST /api/task/list - List tasks
 * - POST /api/task/create - Create task
 * - POST /api/task/view - View task details
 * - POST /api/task/delete - Delete task
 *
 * Worktree endpoints:
 * - POST /api/task/create-worktree - Create git worktree
 * - POST /api/task/validate-check-phase-passed - Validate check phase
 * - POST /api/task/cleanup - Cleanup worktrees
 */
import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { spawn, execSync, type SpawnOptions } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync, openSync, readdirSync } from "node:fs";
import { join, basename } from "node:path";
import {
  taskService,
  type UnifiedTask,
} from "../../task/service";
import { logger as globalLogger } from "../../telemetry";
import { taskEventStore } from "../../task/events/event-store";
import { isValidEventType, type TaskEventType } from "../../task/events/event-types";
import type { TaskEvent } from "../../task/events/task-event";
import type { AppState } from "../state";
import { taskSSEManager } from "../sse/task-sse-manager";
import {
  pauseTask,
  resumeTask,
  approveTask,
  rejectTask,
  retryTask,
  cancelTask,
  enqueueTask,
  dequeueTask,
} from "../../task/ops/lifecycle";
import { setTaskBranch, setTaskBaseBranch, setTaskAgent } from "../../task/ops/config";
import {
  updateTaskField,
  readJsonlFile,
  appendToJsonl,
  jsonlEntryExists,
  getDeveloper,
  getTasksDir,
  getCurrentTask,
  getActiveTasks,
  getDatePrefix,
  getTodayDate,
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
  writeTaskJson as writeTaskJsonFile,
  DIR_VIBEN,
  DIR_WORKSPACE,
  DIR_TASKS,
  FILE_TASK_JSON,
  createCLIAdapter,
  validateIfReviewFinished,
} from "../../cli/lib/viben-workspace";
import { getContextJson, getContextText } from "../../task/ops/context-output";
import {
  initContext as initContextOp,
  addContext as addContextOp,
  removeContext as removeContextOp,
  listContext as listContextOp,
  validateContext as validateContextOp,
} from "../../task/ops/context-files";
import { finishTask, archiveTask as archiveTaskOp, listArchivedTasks, viewTask, deleteTask, listTasks, createTask } from "../../task/ops/crud";
import { reviewTask } from "../../task/ops/review";
import { createPR } from "../../task/ops/create-pr";
import { runPlanPhase, runImplementPhase, runCheckPhase, runWorkPhase, runCreateWorktree } from "../../task/phase";
import {
  getLatestJournalInfo,
  getSessionNumberFromIndex,
  generateSessionMarkdown,
  createNewJournalFile,
  updateIndexWithNewSession,
} from "../../task/ops/session";
import { deleteCacheEntry, setCacheEntry, getCacheEntry, toSnakeCaseTask } from "./tasks";

// Module-level logger
const log = globalLogger.child({ module: "task-api" });

/**
 * Helper: Resolve task directory from task_id
 */
async function resolveTaskDir(
  taskId: string,
  workspacePath: string
): Promise<string | null> {
  // If already absolute path
  if (taskId.startsWith("/")) {
    return existsSync(taskId) ? taskId : null;
  }

  // Try to resolve using workspace
  const resolved = resolveTaskDirectory(taskId, workspacePath);
  return resolved && existsSync(resolved) ? resolved : null;
}

/**
 * Register Task CLI-style API routes
 */
export function registerTaskRoutes(fastify: FastifyInstance, state: AppState): void {
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

    const result = setTaskBranch(workspace_path, task_id, branch);

    if (!result.success) {
      reply.code(result.error?.includes("not found") ? 404 : 400);
      return { error: result.error };
    }

    return { success: true, task_id: result.task, branch };
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

    const result = setTaskBaseBranch(workspace_path, task_id, base_branch);

    if (!result.success) {
      reply.code(result.error?.includes("not found") ? 404 : 400);
      return { error: result.error };
    }

    return { success: true, task_id: result.task, base_branch };
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

    const result = setTaskAgent(workspace_path, task_id, agent_id);

    if (!result.success) {
      reply.code(result.error?.includes("not found") ? 404 : 400);
      return { error: result.error };
    }

    return { success: true, task_id: result.task, agent_id };
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
  // Creates empty jsonl files with only workflow.md as base context
  // Use add-context endpoint to manually add specific context files
  fastify.post<{
    Body: {
      workspace_path: string;
      task_id: string;
    };
  }>("/api/task/init-context", {
    schema: {
      description: "Initialize empty context files (implement.jsonl, check.jsonl, fix.jsonl) for a task. Use add-context to add specific files.",
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
    const { workspace_path, task_id } = request.body;

    if (!workspace_path || !task_id) {
      reply.code(400);
      return { error: "workspace_path and task_id are required" };
    }

    const result = initContextOp(workspace_path, task_id);

    if (!result.success) {
      reply.code(404);
      return { error: result.error || `Task not found: ${task_id}` };
    }

    return {
      success: true,
      task_id,
      files_created: ["implement.jsonl", "check.jsonl", "fix.jsonl"],
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
      context_type?: "implement" | "check" | "fix";
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
          context_type: { type: "string", enum: ["implement", "check", "fix"], description: "Context file to add to (default: implement)" },
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

    let totalAdded = 0;
    let totalSkipped = 0;

    // Call addContextOp for each file to preserve individual reasons
    for (const fileInput of files) {
      const result = addContextOp(
        workspace_path,
        task_id,
        [fileInput.path],
        {
          reason: fileInput.reason || "Added via API",
          contextType: context_type,
        }
      );

      if (!result.success) {
        reply.code(404);
        return { error: result.error || `Task not found: ${task_id}` };
      }

      totalAdded += result.added;
      totalSkipped += result.skipped;
    }

    return {
      success: true,
      task_id,
      added: totalAdded,
      skipped: totalSkipped,
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

    const result = removeContextOp(workspace_path, task_id, files);

    if (!result.success) {
      reply.code(404);
      return { error: result.error || `Task not found: ${task_id}` };
    }

    return {
      success: true,
      task_id,
      removed: result.removed.length,
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

    const result = listContextOp(workspace_path, task_id);

    if (!result.success) {
      reply.code(404);
      return { error: result.error || `Task not found: ${task_id}` };
    }

    // Transform keys from filename format to short format
    // e.g., "implement.jsonl" -> "implement"
    const context: Record<string, ContextEntry[]> = {
      implement: [],
      check: [],
      debug: [],
    };

    for (const [fileName, entries] of Object.entries(result.context)) {
      const key = fileName.replace(".jsonl", "");
      // Map "fix" to "debug" to match existing API response
      const mappedKey = key === "fix" ? "debug" : key;
      if (mappedKey in context) {
        context[mappedKey] = entries;
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

    const result = validateContextOp(workspace_path, task_id);

    if (result.error) {
      reply.code(404);
      return { error: result.error };
    }

    return {
      success: true,
      task_id,
      valid_count: result.valid.length,
      missing_count: result.missing.length,
      missing_files: result.missing,
      all_valid: result.missing.length === 0,
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
        session_id: task.session_id,
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
        session_id: task.session_id || result.task_id, // Use queue task_id as session reference
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

    if (task.session_id && state.taskQueue) {
      // Search running tasks for matching session
      const runningTasks = state.taskQueue.getTasks("running");
      const pendingTasks = state.taskQueue.getTasks("pending");
      const allTasks = [...runningTasks, ...pendingTasks];

      const queueTask = allTasks.find((qt) => qt.payload.session_id === task.session_id);

      if (queueTask) {
        queueTaskId = queueTask.id;
        cancelled = await state.taskQueue.cancel(queueTask.id);
      }
    }

    // Update task status
    if (cancelled || task.status === "in_progress" || task.status === "queue") {
      await taskService.updateTask(taskDir, {
        status: "review",
        review_reason: "stopped",
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

    if (task.session_id && state.taskQueue) {
      const queueTasks = state.taskQueue.getTasks();
      const queueTask = queueTasks.find((qt) => qt.payload.session_id === task.session_id);

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
          session_id: task.session_id,
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
        prd_content: specsData.prd_content,
        prd_path: specsData.prd_path,
        subtasks: specsData.subtasks,
        logs: specsData.logs,
        task_dir: specsData.task_dir,
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
        log.error({ err: error }, "Error replaying events");
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
    if (task.session_id && state.taskQueue) {
      const queueTasks = state.taskQueue.getTasks();
      const queueTask = queueTasks.find((qt) => qt.payload.session_id === task.session_id);
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
      return cached.task_dir;
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
      const nextSequence = (task.last_event?.sequence ?? 0) + 1;
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
            session_id: task.session_id,
            input: task.prompt,
            cwd: workspace_path,
          });
        } catch (e) {
          log.warn({ err: e }, "Failed to enqueue task for execution");
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

    if (!task_id) {
      reply.code(400);
      return { error: "task_id is required", code: "MISSING_TASK_ID" };
    }

    // Use core finishTask function
    const result = finishTask(workspace_path, task_id);

    if (!result.success) {
      reply.code(400);
      return { error: result.error || "Failed to finish task", code: "FINISH_FAILED" };
    }

    return {
      success: true,
      task_id,
      status: "completed",
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

    const result = pauseTask(workspace_path, task_id);

    if (!result.success) {
      const isNotFound = result.error?.includes("not found");
      reply.code(isNotFound ? 404 : 400);
      return {
        error: result.error,
        code: isNotFound ? "TASK_NOT_FOUND" : "PAUSE_FAILED",
      };
    }

    taskSSEManager.broadcast(
      task_id,
      { type: "STATE_CHANGED", new_state: result.status },
      workspace_path
    );

    return {
      success: true,
      task_id: result.task,
      status: result.status,
      previous_status: result.fromStatus,
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

    const result = resumeTask(workspace_path, task_id);

    if (!result.success) {
      const isNotFound = result.error?.includes("not found");
      reply.code(isNotFound ? 404 : 400);
      return {
        error: result.error,
        code: isNotFound ? "TASK_NOT_FOUND" : "RESUME_FAILED",
      };
    }

    taskSSEManager.broadcast(
      task_id,
      { type: "STATE_CHANGED", new_state: result.status },
      workspace_path
    );

    return {
      success: true,
      task_id: result.task,
      status: result.status,
      previous_status: result.fromStatus,
    };
  });

  // ============================================================================
  // POST /api/task/approve - review -> completed
  // ============================================================================
  fastify.post<{
    Body: {
      workspace_path: string;
      task_id: string;
      comment?: string;
    };
  }>("/api/task/approve", {
    schema: {
      description: "Approve a task in review: review -> completed",
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
    const { workspace_path, task_id } = request.body;

    if (!workspace_path) {
      reply.code(400);
      return { error: "workspace_path is required", code: "MISSING_WORKSPACE_PATH" };
    }

    if (!task_id) {
      reply.code(400);
      return { error: "task_id is required", code: "MISSING_TASK_ID" };
    }

    const result = approveTask(workspace_path, task_id);

    if (!result.success) {
      const isNotFound = result.error?.includes("not found");
      reply.code(isNotFound ? 404 : 400);
      return {
        error: result.error,
        code: isNotFound ? "TASK_NOT_FOUND" : "APPROVE_FAILED",
      };
    }

    taskSSEManager.broadcast(
      task_id,
      { type: "STATE_CHANGED", new_state: result.status },
      workspace_path
    );

    return {
      success: true,
      task_id: result.task,
      status: result.status,
      previous_status: result.fromStatus,
    };
  });

  // ============================================================================
  // POST /api/task/reject - review -> backlog
  // ============================================================================
  fastify.post<{
    Body: {
      workspace_path: string;
      task_id: string;
      reason?: string;
    };
  }>("/api/task/reject", {
    schema: {
      description: "Reject a task in review: review -> backlog",
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

    const result = rejectTask(workspace_path, task_id, reason);

    if (!result.success) {
      const isNotFound = result.error?.includes("not found");
      reply.code(isNotFound ? 404 : 400);
      return {
        error: result.error,
        code: isNotFound ? "TASK_NOT_FOUND" : "REJECT_FAILED",
      };
    }

    taskSSEManager.broadcast(
      task_id,
      { type: "STATE_CHANGED", new_state: result.status },
      workspace_path
    );

    return {
      success: true,
      task_id: result.task,
      status: result.status,
      previous_status: result.fromStatus,
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

    const result = retryTask(workspace_path, task_id);

    if (!result.success) {
      const isNotFound = result.error?.includes("not found");
      reply.code(isNotFound ? 404 : 400);
      return {
        error: result.error,
        code: isNotFound ? "TASK_NOT_FOUND" : "RETRY_FAILED",
      };
    }

    taskSSEManager.broadcast(
      task_id,
      { type: "STATE_CHANGED", new_state: result.status },
      workspace_path
    );

    return {
      success: true,
      task_id: result.task,
      status: result.status,
      previous_status: result.fromStatus,
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
      force?: boolean;
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
          force: { type: "boolean", description: "Force cancel even if task is in_progress" },
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
    const { workspace_path, task_id, reason, force } = request.body;

    if (!workspace_path) {
      reply.code(400);
      return { error: "workspace_path is required", code: "MISSING_WORKSPACE_PATH" };
    }

    if (!task_id) {
      reply.code(400);
      return { error: "task_id is required", code: "MISSING_TASK_ID" };
    }

    const result = cancelTask(workspace_path, task_id, { reason, force });

    if (!result.success) {
      const isNotFound = result.error?.includes("not found");
      reply.code(isNotFound ? 404 : 400);
      return {
        error: result.error,
        code: isNotFound ? "TASK_NOT_FOUND" : "CANCEL_FAILED",
      };
    }

    taskSSEManager.broadcast(
      task_id,
      { type: "STATE_CHANGED", new_state: result.status },
      workspace_path
    );

    return {
      success: true,
      task_id: result.task,
      status: result.status,
      previous_status: result.fromStatus,
    };
  });

  // ============================================================================
  // POST /api/task/enqueue - Move task from backlog to queue
  // ============================================================================
  fastify.post<{
    Body: {
      workspace_path: string;
      task_id: string;
      agent?: string;
      executor?: string;
      model?: string;
      priority?: string;
    };
  }>("/api/task/enqueue", {
    schema: {
      description: "Move task from backlog to queue for execution",
      tags: ["tasks"],
      body: {
        type: "object",
        properties: {
          workspace_path: { type: "string", description: "Workspace path (required)" },
          task_id: { type: "string", description: "Task ID or directory (required)" },
          agent: { type: "string", description: "Agent ID to execute this task" },
          executor: { type: "string", description: "Executor type (CLAUDE_CODE, CURSOR, etc.)" },
          model: { type: "string", description: "Model ID for execution" },
          priority: { type: "string", description: "Priority (urgent/high/medium/low/none)" },
        },
        required: ["workspace_path", "task_id"],
      },
    },
  }, async (request, reply) => {
    const { workspace_path, task_id, agent, executor, model, priority } = request.body;

    if (!workspace_path) {
      reply.code(400);
      return { error: "workspace_path is required", code: "MISSING_WORKSPACE_PATH" };
    }
    if (!task_id) {
      reply.code(400);
      return { error: "task_id is required", code: "MISSING_TASK_ID" };
    }

    const result = enqueueTask(workspace_path, task_id, { agent, executor, model, priority });

    if (!result.success) {
      const code = result.error?.includes("not found") ? 404 : 400;
      reply.code(code);
      return { error: result.error, code: code === 404 ? "TASK_NOT_FOUND" : "ENQUEUE_FAILED" };
    }

    taskSSEManager.broadcast(task_id, { type: "STATE_CHANGED", new_state: result.status }, workspace_path);

    return {
      success: true,
      task_id: result.task,
      status: result.status,
      previous_status: result.fromStatus,
    };
  });

  // ============================================================================
  // POST /api/task/dequeue - Move task from queue back to backlog
  // ============================================================================
  fastify.post<{
    Body: {
      workspace_path: string;
      task_id: string;
    };
  }>("/api/task/dequeue", {
    schema: {
      description: "Remove task from queue back to backlog",
      tags: ["tasks"],
      body: {
        type: "object",
        properties: {
          workspace_path: { type: "string", description: "Workspace path (required)" },
          task_id: { type: "string", description: "Task ID or directory (required)" },
        },
        required: ["workspace_path", "task_id"],
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

    const result = dequeueTask(workspace_path, task_id);

    if (!result.success) {
      const code = result.error?.includes("not found") ? 404 : 400;
      reply.code(code);
      return { error: result.error, code: code === 404 ? "TASK_NOT_FOUND" : "DEQUEUE_FAILED" };
    }

    taskSSEManager.broadcast(task_id, { type: "STATE_CHANGED", new_state: result.status }, workspace_path);

    return {
      success: true,
      task_id: result.task,
      status: result.status,
      previous_status: result.fromStatus,
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
    const nextSequence = (task.last_event?.sequence ?? 0) + 1;
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

    // Use core listArchivedTasks function
    const result = listArchivedTasks(workspace_path, month);
    if (!result.success) {
      reply.code(400);
      return { error: "Failed to list archived tasks", code: "LIST_ARCHIVE_FAILED" };
    }

    // Convert Map to object for JSON response
    const archives: Record<string, string[]> = {};
    for (const [monthKey, tasks] of result.archived) {
      archives[monthKey] = tasks;
    }

    return { archives };
  });

  // ==========================================================================
  // POST /api/task/review - View task details for review
  // ==========================================================================
  fastify.post<{
    Querystring: { workspace_path?: string; task_dir?: string };
  }>("/api/task/review", {
    schema: {
      description: "View task details for review",
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

    // Resolve task directory and determine repoRoot
    let taskDir = task_dir;
    const repoRoot = workspace_path || (task_dir.startsWith("/") ? task_dir.split("/.viben/")[0] : "");

    if (!task_dir.startsWith("/") && workspace_path) {
      const resolved = resolveTaskDirectory(task_dir, workspace_path);
      if (resolved) taskDir = resolved;
    }

    // Use core reviewTask function
    const reviewResult = reviewTask(repoRoot, taskDir);

    if (!reviewResult.success) {
      reply.code(404);
      return { error: reviewResult.error || "Task not found", code: "TASK_NOT_FOUND" };
    }

    const taskData = reviewResult.task!;
    const dirName = reviewResult.dirName || basename(taskDir);
    const prInfo = reviewResult.prInfo || {};

    // Get specs data (additional functionality not in core reviewTask)
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
          branch: taskData.branch,
          base_branch: taskData.base_branch,
          pr_url: taskData.pr_url,
          creator: taskData.creator,
          assignee: taskData.assignee,
          created_at: taskData.created_at,
          completed_at: taskData.completed_at,
        },
        pr_info: prInfo,
        specs: {
          prd_content: specsData.prd_content,
          prd_path: specsData.prd_path,
          subtasks: specsData.subtasks,
          logs: specsData.logs,
        },
        next_actions: taskData.status === "review"
          ? ["approve", "reject"]
          : taskData.status === "failed"
            ? ["retry"]
            : [],
      },
    };
  });

  // ==========================================================================
  // POST /api/task/context - Get session context for AI agents
  // Reuses getContextJson from task/ops/context-output.ts (same as CLI)
  // ==========================================================================
  fastify.post<{
    Querystring: { workspace_path?: string; task_dir?: string };
    Body: { json?: boolean };
  }>("/api/task/context", {
    schema: {
      description: "Get session context for AI agents",
      tags: ["tasks"],
      querystring: {
        type: "object",
        properties: {
          workspace_path: { type: "string", description: "Workspace path (required)" },
          task_dir: { type: "string", description: "Task directory (optional, for current task info)" },
        },
        required: ["workspace_path"],
      },
      body: {
        type: "object",
        properties: {
          json: { type: "boolean", description: "Return JSON format (default: true)" },
        },
      },
    },
  }, async (request, reply) => {
    const { workspace_path, task_dir } = request.query;
    const { json: jsonFormat = true } = request.body || {};

    if (!workspace_path) {
      reply.code(400);
      return { error: "workspace_path is required", code: "MISSING_WORKSPACE_PATH" };
    }

    try {
      // Resolve task directory if provided
      let taskDirAbs: string | undefined;
      if (task_dir) {
        taskDirAbs = task_dir.startsWith("/") ? task_dir : join(workspace_path, task_dir);
      }

      if (jsonFormat) {
        // Use shared implementation from task/ops/context-output.ts
        const contextData = getContextJson(workspace_path, taskDirAbs);
        return { success: true, data: contextData };
      } else {
        const contextText = getContextText(workspace_path, taskDirAbs);
        return { success: true, data: { context: contextText } };
      }
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

    // Use core createPR function
    const result = createPR(repoRoot, taskDirPath, { dry_run: dryRun || false });

    if (!result.success) {
      const errorCode = result.error?.includes("No changes") ? "NO_CHANGES" :
                        result.error?.includes("push") ? "PUSH_FAILED" :
                        result.error?.includes("create PR") ? "PR_CREATE_FAILED" :
                        "CREATE_PR_FAILED";
      reply.code(errorCode === "NO_CHANGES" ? 400 : 500);
      return { error: result.error || "Failed to create PR", code: errorCode };
    }

    // Build steps array for response compatibility
    const steps: string[] = [];
    if (result.had_staged_changes) {
      steps.push(`Committed: ${result.commit_message}`);
    } else if (result.unpushed_commits) {
      steps.push(`Found ${result.unpushed_commits} unpushed commit(s)`);
    }
    if (result.local_only) {
      steps.push("Local-only mode: skipped push and PR creation");
    } else if (!dryRun && result.current_branch) {
      steps.push(`Pushed to origin/${result.current_branch}`);
    }
    if (result.pr_url) {
      steps.push(dryRun ? `[DRY-RUN] Would create PR` : `PR created: ${result.pr_url}`);
    }
    if (!dryRun) {
      steps.push("Task status updated to review");
    }

    return {
      success: true,
      data: {
        pr_url: result.pr_url,
        pr_title: result.task_name,
        base_branch: result.base_branch,
        head_branch: result.current_branch,
        dry_run: dryRun || false,
        local_only: result.local_only || false,
        steps,
        ...(result.dry_run_info && { dry_run_info: result.dry_run_info }),
      },
    };
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
      const dev_dir = join(workspace_path, DIR_VIBEN, DIR_WORKSPACE, developer);
      if (!existsSync(dev_dir)) {
        reply.code(400);
        return { error: `Workspace directory not found: ${dev_dir}`, code: "WORKSPACE_NOT_FOUND" };
      }

      const index_path = join(dev_dir, "index.md");
      const today = getTodayDate();

      // Get journal info
      const journalInfo = getLatestJournalInfo(dev_dir);
      const currentSession = getSessionNumberFromIndex(index_path);
      const newSession = currentSession + 1;

      // Generate session content
      const sessionContent = generateSessionMarkdown({
        session_num: newSession,
        title,
        commit: commit || "-",
        summary: summary || "(Add summary)",
        extra_content: content || "(Add details)",
        date: today,
      });
      const contentLines = sessionContent.split("\n").length;

      // Determine target file
      let targetFile = journalInfo.file;
      let targetNum = journalInfo.number;

      // Check if need to rotate journal file
      if (journalInfo.lines + contentLines > MAX_LINES) {
        targetNum = journalInfo.number + 1;
        targetFile = createNewJournalFile(dev_dir, targetNum, developer, today, journalInfo.number);
      }

      // Create initial journal file if none exists
      if (!targetFile) {
        targetNum = 1;
        targetFile = createNewJournalFile(dev_dir, targetNum, developer, today, 0);
      }

      // Append session content to target file
      const existingContent = readFileSync(targetFile, "utf-8");
      writeFileSync(targetFile, existingContent + sessionContent, "utf-8");

      // Update index.md
      const active_fileName = `journal-${targetNum}.md`;
      const updateSuccess = updateIndexWithNewSession({
        index_path,
        dev_dir,
        session_num: newSession,
        title,
        commit: commit || "-",
        active_file: active_fileName,
        date: today,
      });

      return {
        success: true,
        data: {
          session: newSession,
          journal_file: active_fileName,
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
          requirement: { type: "string", description: "Requirement description (required)" },
          platform: { type: "string", description: "Platform: claude, cursor, iflow, opencode" },
        },
        required: ["name", "requirement"],
      },
    },
  }, async (request, reply) => {
    const { workspace_path } = request.query;
    const { name, requirement, platform = "claude" } = request.body;

    if (!workspace_path) {
      reply.code(400);
      return { error: "workspace_path is required", code: "MISSING_WORKSPACE_PATH" };
    }

    if (!name || !requirement) {
      reply.code(400);
      return { error: "name and requirement are required", code: "MISSING_PARAMS" };
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
        priority: "medium",
        creator: developer,
        assignee: developer,
        createdAt: today,
        base_branch: currentBranch,
        current_phase: 0,
        next_action: [
          { phase: 1, action: "implement" },
          { phase: 2, action: "check" },
          { phase: 3, action: "finish" },
        ],
        subtasks: [],
        relatedFiles: [],
        notes: "",
      };

      writeTaskJsonFile(taskDir, taskData as unknown as Record<string, unknown>);

      const taskDirRel = `${DIR_VIBEN}/${DIR_TASKS}/${dirName}`;

      // Start Plan Agent in background
      const logFile = join(taskDir, "plan.log.jsonl");
      writeFileSync(logFile, "", "utf-8");

      // Build environment
      const env = { ...process.env };
      env.PLAN_TASK_NAME = name;
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
          task_dir: taskDir, // Store absolute path
          platform,
        },
        workspace_path
      );

      return {
        success: true,
        data: {
          task_name: name,
          task_dir: taskDirRel,
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

  // ============================================================================
  // POST /api/task/plan-phase - Run plan phase for a task
  // ============================================================================
  fastify.post<{
    Body: {
      workspace_path: string;
      task_id: string;
      platform?: string;
      verbose?: boolean;
    };
  }>("/api/task/plan-phase", {
    schema: {
      description: "Run plan phase for a task (spawns plan agent)",
      tags: ["tasks"],
      body: {
        type: "object",
        properties: {
          workspace_path: { type: "string", description: "Workspace path (required)" },
          task_id: { type: "string", description: "Task ID or directory (required)" },
          platform: { type: "string", description: "Platform (claude, cursor, iflow, opencode)", default: "claude" },
          verbose: { type: "boolean", description: "Enable verbose output" },
        },
        required: ["workspace_path", "task_id"],
      },
    },
  }, async (request, reply) => {
    const { workspace_path, task_id, platform = "claude", verbose } = request.body;

    if (!workspace_path) {
      reply.code(400);
      return { error: "workspace_path is required", code: "MISSING_WORKSPACE_PATH" };
    }
    if (!task_id) {
      reply.code(400);
      return { error: "task_id is required", code: "MISSING_TASK_ID" };
    }

    // Resolve task directory
    const taskDir = resolveTaskDirectory(task_id, workspace_path);
    if (!taskDir || !existsSync(taskDir)) {
      reply.code(404);
      return { error: `Task not found: ${task_id}`, code: "TASK_NOT_FOUND" };
    }

    try {
      const result = await runPlanPhase(workspace_path, taskDir, { platform, verbose });

      if (!result.success) {
        reply.code(400);
        return { error: result.error, code: "PLAN_PHASE_FAILED" };
      }

      return result;
    } catch (error) {
      reply.code(500);
      return { error: error instanceof Error ? error.message : "Plan phase failed", code: "PLAN_PHASE_ERROR" };
    }
  });

  // ============================================================================
  // POST /api/task/implement-phase - Run implement phase for a task
  // ============================================================================
  fastify.post<{
    Body: {
      workspace_path: string;
      task_id: string;
      platform?: string;
      verbose?: boolean;
    };
  }>("/api/task/implement-phase", {
    schema: {
      description: "Run implement phase for a task (spawns implement agent)",
      tags: ["tasks"],
      body: {
        type: "object",
        properties: {
          workspace_path: { type: "string", description: "Workspace path (required)" },
          task_id: { type: "string", description: "Task ID or directory (required)" },
          platform: { type: "string", description: "Platform (claude, cursor, iflow, opencode)", default: "claude" },
          verbose: { type: "boolean", description: "Enable verbose output" },
        },
        required: ["workspace_path", "task_id"],
      },
    },
  }, async (request, reply) => {
    const { workspace_path, task_id, platform = "claude", verbose } = request.body;

    if (!workspace_path) {
      reply.code(400);
      return { error: "workspace_path is required", code: "MISSING_WORKSPACE_PATH" };
    }
    if (!task_id) {
      reply.code(400);
      return { error: "task_id is required", code: "MISSING_TASK_ID" };
    }

    // Resolve task directory
    const taskDir = resolveTaskDirectory(task_id, workspace_path);
    if (!taskDir || !existsSync(taskDir)) {
      reply.code(404);
      return { error: `Task not found: ${task_id}`, code: "TASK_NOT_FOUND" };
    }

    try {
      const result = await runImplementPhase(workspace_path, taskDir, { platform, verbose });

      if (!result.success) {
        reply.code(400);
        return { error: result.error, code: "IMPLEMENT_PHASE_FAILED" };
      }

      return result;
    } catch (error) {
      reply.code(500);
      return { error: error instanceof Error ? error.message : "Implement phase failed", code: "IMPLEMENT_PHASE_ERROR" };
    }
  });

  // ============================================================================
  // POST /api/task/check-phase - Run check phase for a task
  // ============================================================================
  fastify.post<{
    Body: {
      workspace_path: string;
      task_id: string;
      platform?: string;
      verbose?: boolean;
    };
  }>("/api/task/check-phase", {
    schema: {
      description: "Run check phase for a task (spawns check agent)",
      tags: ["tasks"],
      body: {
        type: "object",
        properties: {
          workspace_path: { type: "string", description: "Workspace path (required)" },
          task_id: { type: "string", description: "Task ID or directory (required)" },
          platform: { type: "string", description: "Platform (claude, cursor, iflow, opencode)", default: "claude" },
          verbose: { type: "boolean", description: "Enable verbose output" },
        },
        required: ["workspace_path", "task_id"],
      },
    },
  }, async (request, reply) => {
    const { workspace_path, task_id, platform = "claude", verbose } = request.body;

    if (!workspace_path) {
      reply.code(400);
      return { error: "workspace_path is required", code: "MISSING_WORKSPACE_PATH" };
    }
    if (!task_id) {
      reply.code(400);
      return { error: "task_id is required", code: "MISSING_TASK_ID" };
    }

    // Resolve task directory
    const taskDir = resolveTaskDirectory(task_id, workspace_path);
    if (!taskDir || !existsSync(taskDir)) {
      reply.code(404);
      return { error: `Task not found: ${task_id}`, code: "TASK_NOT_FOUND" };
    }

    try {
      const result = await runCheckPhase(workspace_path, taskDir, { platform, verbose });

      if (!result.success) {
        reply.code(400);
        return { error: result.error, code: "CHECK_PHASE_FAILED" };
      }

      return result;
    } catch (error) {
      reply.code(500);
      return { error: error instanceof Error ? error.message : "Check phase failed", code: "CHECK_PHASE_ERROR" };
    }
  });

  // ============================================================================
  // POST /api/task/work-phase - Run work phase for a task
  // ============================================================================
  fastify.post<{
    Body: {
      workspace_path: string;
      task_id: string;
      platform?: string;
      verbose?: boolean;
      detach?: boolean;
    };
  }>("/api/task/work-phase", {
    schema: {
      description: "Run work phase for a task (spawns work agent)",
      tags: ["tasks"],
      body: {
        type: "object",
        properties: {
          workspace_path: { type: "string", description: "Workspace path (required)" },
          task_id: { type: "string", description: "Task ID or directory (required)" },
          platform: { type: "string", description: "Platform (claude, cursor, iflow, opencode)", default: "claude" },
          verbose: { type: "boolean", description: "Enable verbose output" },
          detach: { type: "boolean", description: "Run in background", default: true },
        },
        required: ["workspace_path", "task_id"],
      },
    },
  }, async (request, reply) => {
    const { workspace_path, task_id, platform = "claude", verbose, detach = true } = request.body;

    if (!workspace_path) {
      reply.code(400);
      return { error: "workspace_path is required", code: "MISSING_WORKSPACE_PATH" };
    }
    if (!task_id) {
      reply.code(400);
      return { error: "task_id is required", code: "MISSING_TASK_ID" };
    }

    const taskDir = resolveTaskDirectory(task_id, workspace_path);
    if (!taskDir || !existsSync(taskDir)) {
      reply.code(404);
      return { error: `Task not found: ${task_id}`, code: "TASK_NOT_FOUND" };
    }

    try {
      const result = await runWorkPhase({
        repoRoot: workspace_path,
        workingDir: workspace_path,
        task_dir: taskDir,
        platform,
        verbose,
        detach,
      });

      if (!result.success) {
        reply.code(400);
        return { error: result.error, code: "WORK_PHASE_FAILED" };
      }

      return result;
    } catch (error) {
      reply.code(500);
      return { error: error instanceof Error ? error.message : "Work phase failed", code: "WORK_PHASE_ERROR" };
    }
  });

  // ============================================================================
  // POST /api/task/view - View task details
  // ============================================================================
  fastify.post<{
    Body: {
      workspace_path: string;
      task_id: string;
    };
  }>("/api/task/view", {
    schema: {
      description: "View task details",
      tags: ["tasks"],
      body: {
        type: "object",
        properties: {
          workspace_path: { type: "string", description: "Workspace path (required)" },
          task_id: { type: "string", description: "Task ID or directory (required)" },
        },
        required: ["workspace_path", "task_id"],
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

    const result = viewTask(workspace_path, task_id);

    if (!result.success) {
      const code = result.error?.includes("not found") ? 404 : 400;
      reply.code(code);
      return { error: result.error, code: code === 404 ? "TASK_NOT_FOUND" : "VIEW_FAILED" };
    }

    return { success: true, task: result.task };
  });

  // ============================================================================
  // POST /api/task/delete - Delete a task
  // ============================================================================
  fastify.post<{
    Body: {
      workspace_path: string;
      task_id: string;
      force?: boolean;
    };
  }>("/api/task/delete", {
    schema: {
      description: "Delete a task",
      tags: ["tasks"],
      body: {
        type: "object",
        properties: {
          workspace_path: { type: "string", description: "Workspace path (required)" },
          task_id: { type: "string", description: "Task ID or directory (required)" },
          force: { type: "boolean", description: "Force delete even if task is in progress" },
        },
        required: ["workspace_path", "task_id"],
      },
    },
  }, async (request, reply) => {
    const { workspace_path, task_id, force } = request.body;

    if (!workspace_path) {
      reply.code(400);
      return { error: "workspace_path is required", code: "MISSING_WORKSPACE_PATH" };
    }
    if (!task_id) {
      reply.code(400);
      return { error: "task_id is required", code: "MISSING_TASK_ID" };
    }

    const result = deleteTask(workspace_path, task_id);

    if (!result.success) {
      const code = result.error?.includes("not found") ? 404 : 400;
      reply.code(code);
      return { error: result.error, code: code === 404 ? "TASK_NOT_FOUND" : "DELETE_FAILED" };
    }

    // Clear cache entry if exists
    deleteCacheEntry(task_id);

    return { success: true, task_id: result.deleted };
  });

  // ============================================================================
  // POST /api/task/list - List tasks
  // ============================================================================
  fastify.post<{
    Body: {
      workspace_path: string;
      mine?: boolean;
      status?: string;
    };
  }>("/api/task/list", {
    schema: {
      description: "List tasks",
      tags: ["tasks"],
      body: {
        type: "object",
        properties: {
          workspace_path: { type: "string", description: "Workspace path (required)" },
          mine: { type: "boolean", description: "Show only my tasks" },
          status: { type: "string", description: "Filter by status" },
        },
        required: ["workspace_path"],
      },
    },
  }, async (request, reply) => {
    const { workspace_path, mine, status } = request.body;

    if (!workspace_path) {
      reply.code(400);
      return { error: "workspace_path is required", code: "MISSING_WORKSPACE_PATH" };
    }

    const result = listTasks(workspace_path, { mine, status });

    if (!result.success) {
      reply.code(400);
      return { error: result.error, code: "LIST_FAILED" };
    }

    return { success: true, tasks: result.tasks };
  });

  // ============================================================================
  // POST /api/task/create - Create a new task
  // ============================================================================
  fastify.post<{
    Body: {
      workspace_path: string;
      title: string;
      slug?: string;
      branch?: string;
      assignee?: string;
      priority?: string;
      description?: string;
      agent?: string;
      executor?: string;
      model?: string;
      start?: boolean;
      worktree?: boolean;
    };
  }>("/api/task/create", {
    schema: {
      description: "Create a new task",
      tags: ["tasks"],
      body: {
        type: "object",
        properties: {
          workspace_path: { type: "string", description: "Workspace path (required)" },
          title: { type: "string", description: "Task title (required)" },
          slug: { type: "string", description: "Task slug (auto-generated from title if not provided)" },
          branch: { type: "string", description: "Custom branch name" },
          assignee: { type: "string", description: "Assignee developer name" },
          priority: { type: "string", description: "Priority (urgent/high/medium/low/none)", default: "medium" },
          description: { type: "string", description: "Task description" },
          agent: { type: "string", description: "Associated agent ID" },
          executor: { type: "string", description: "Executor type" },
          model: { type: "string", description: "Model to use" },
          start: { type: "boolean", description: "Auto-start task after creation" },
          worktree: { type: "boolean", description: "Run in git worktree" },
        },
        required: ["workspace_path", "title"],
      },
    },
  }, async (request, reply) => {
    const { workspace_path, title, slug, branch, assignee, priority, description, agent, executor, model, start, worktree } = request.body;

    if (!workspace_path) {
      reply.code(400);
      return { error: "workspace_path is required", code: "MISSING_WORKSPACE_PATH" };
    }
    if (!title) {
      reply.code(400);
      return { error: "title is required", code: "MISSING_TITLE" };
    }

    const result = createTask(workspace_path, title, {
      slug,
      branch,
      assignee,
      priority,
      description,
      agent,
      executor,
      model,
      start,
      worktree,
    });

    if (!result.success) {
      reply.code(400);
      return { error: result.error, code: "CREATE_FAILED" };
    }

    return {
      success: true,
      task_id: result.dirName,
      task_dir: result.task_dir,
      status: result.status,
      context_initialized: result.contextInitialized,
    };
  });

  // ============================================================================
  // POST /api/task/create-worktree - Create isolated git worktree for a task
  // ============================================================================
  fastify.post<{
    Body: {
      workspace_path: string;
      task_id: string;
      skip_prd?: boolean;
    };
  }>("/api/task/create-worktree", {
    schema: {
      description: "Create isolated git worktree for a task",
      tags: ["tasks"],
      body: {
        type: "object",
        properties: {
          workspace_path: { type: "string", description: "Workspace path (required)" },
          task_id: { type: "string", description: "Task ID or directory (required)" },
          skip_prd: { type: "boolean", description: "Skip prd.md validation" },
        },
        required: ["workspace_path", "task_id"],
      },
    },
  }, async (request, reply) => {
    const { workspace_path, task_id, skip_prd } = request.body;

    if (!workspace_path) {
      reply.code(400);
      return { error: "workspace_path is required", code: "MISSING_WORKSPACE_PATH" };
    }
    if (!task_id) {
      reply.code(400);
      return { error: "task_id is required", code: "MISSING_TASK_ID" };
    }

    const taskDir = resolveTaskDirectory(task_id, workspace_path);
    if (!taskDir || !existsSync(taskDir)) {
      reply.code(404);
      return { error: `Task not found: ${task_id}`, code: "TASK_NOT_FOUND" };
    }

    // Check if task was rejected
    const taskJson = readTaskJsonFromWorkspace(taskDir) as { status?: string } | null;
    if (taskJson?.status === "rejected") {
      reply.code(400);
      return { error: "Task was rejected. Check REJECTED.md for details.", code: "TASK_REJECTED" };
    }

    // Check prd.md exists (unless skipped)
    if (!skip_prd) {
      const prdFile = join(taskDir, "prd.md");
      if (!existsSync(prdFile)) {
        reply.code(400);
        return { error: "prd.md not found - planning may not have completed. Use skip_prd to bypass.", code: "PRD_NOT_FOUND" };
      }
    }

    try {
      const result = await runCreateWorktree(workspace_path, taskDir);

      if (!result.success) {
        reply.code(400);
        return { error: result.error, code: "CREATE_WORKTREE_FAILED" };
      }

      return {
        success: true,
        worktree_path: result.worktreePath,
        branch: result.branch,
        base_branch: result.base_branch,
      };
    } catch (error) {
      reply.code(500);
      return { error: error instanceof Error ? error.message : "Create worktree failed", code: "CREATE_WORKTREE_ERROR" };
    }
  });

  // ============================================================================
  // POST /api/task/validate-check-phase-passed - Validate check phase passed
  // ============================================================================
  fastify.post<{
    Body: {
      workspace_path: string;
      task_id: string;
      output?: string;
      output_file?: string;
    };
  }>("/api/task/validate-check-phase-passed", {
    schema: {
      description: "Validate check phase passed (runs verify commands or checks completion markers)",
      tags: ["tasks"],
      body: {
        type: "object",
        properties: {
          workspace_path: { type: "string", description: "Workspace path (required)" },
          task_id: { type: "string", description: "Task ID or directory (required)" },
          output: { type: "string", description: "Agent output text (for completion markers validation)" },
          output_file: { type: "string", description: "File containing agent output" },
        },
        required: ["workspace_path", "task_id"],
      },
    },
  }, async (request, reply) => {
    const { workspace_path, task_id, output, output_file } = request.body;

    if (!workspace_path) {
      reply.code(400);
      return { error: "workspace_path is required", code: "MISSING_WORKSPACE_PATH" };
    }
    if (!task_id) {
      reply.code(400);
      return { error: "task_id is required", code: "MISSING_TASK_ID" };
    }

    const taskDir = resolveTaskDirectory(task_id, workspace_path);
    if (!taskDir || !existsSync(taskDir)) {
      reply.code(404);
      return { error: `Task not found: ${task_id}`, code: "TASK_NOT_FOUND" };
    }

    // Get agent output from option or file
    let agentOutput: string | undefined = output;
    if (!agentOutput && output_file && existsSync(output_file)) {
      agentOutput = readFileSync(output_file, "utf-8");
    }

    const result = validateIfReviewFinished(workspace_path, taskDir, agentOutput);

    return {
      success: result.success,
      method: result.method,
      error: result.error,
      details: result.details,
    };
  });

  // ============================================================================
  // POST /api/task/cleanup - Cleanup worktrees and related resources
  // ============================================================================
  fastify.post<{
    Body: {
      workspace_path: string;
      branch?: string;
      keep_branch?: boolean;
      merged?: boolean;
      all?: boolean;
      list?: boolean;
    };
  }>("/api/task/cleanup", {
    schema: {
      description: "Cleanup worktrees and related resources",
      tags: ["tasks"],
      body: {
        type: "object",
        properties: {
          workspace_path: { type: "string", description: "Workspace path (required)" },
          branch: { type: "string", description: "Branch name to cleanup" },
          keep_branch: { type: "boolean", description: "Keep the git branch" },
          merged: { type: "boolean", description: "Cleanup merged worktrees" },
          all: { type: "boolean", description: "Cleanup all worktrees" },
          list: { type: "boolean", description: "List all worktrees" },
        },
        required: ["workspace_path"],
      },
    },
  }, async (request, reply) => {
    const { workspace_path, branch, keep_branch, merged, all, list } = request.body;

    if (!workspace_path) {
      reply.code(400);
      return { error: "workspace_path is required", code: "MISSING_WORKSPACE_PATH" };
    }

    try {
      // List worktrees
      const { stdout: listOutput } = runGitCommand(["worktree", "list", "--porcelain"], workspace_path);
      const worktrees: Array<{ path: string; branch: string; commit: string }> = [];

      const lines = listOutput.split("\n");
      let current: { path?: string; branch?: string; commit?: string } = {};

      for (const line of lines) {
        if (line.startsWith("worktree ")) {
          current.path = line.slice(9);
        } else if (line.startsWith("HEAD ")) {
          current.commit = line.slice(5);
        } else if (line.startsWith("branch ")) {
          current.branch = line.slice(7).replace("refs/heads/", "");
        } else if (line === "") {
          if (current.path && current.branch) {
            worktrees.push({
              path: current.path,
              branch: current.branch,
              commit: current.commit || "",
            });
          }
          current = {};
        }
      }

      if (list) {
        return { success: true, worktrees };
      }

      // Cleanup logic
      const cleaned: string[] = [];
      const errors: string[] = [];

      for (const wt of worktrees) {
        // Skip main worktree
        if (wt.path === workspace_path) continue;

        const shouldClean = all ||
          (branch && wt.branch === branch) ||
          (merged && wt.branch.startsWith("feat/"));

        if (shouldClean) {
          try {
            runGitCommand(["worktree", "remove", wt.path, "--force"], workspace_path);
            if (!keep_branch) {
              runGitCommand(["branch", "-D", wt.branch], workspace_path);
            }
            cleaned.push(wt.path);
          } catch (e) {
            errors.push(`Failed to cleanup ${wt.path}: ${e instanceof Error ? e.message : String(e)}`);
          }
        }
      }

      return {
        success: errors.length === 0,
        cleaned,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error) {
      reply.code(500);
      return { error: error instanceof Error ? error.message : "Cleanup failed", code: "CLEANUP_ERROR" };
    }
  });
}
