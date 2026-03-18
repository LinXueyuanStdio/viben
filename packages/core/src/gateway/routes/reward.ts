/**
 * Reward REST API routes
 *
 * Provides REST-style endpoints for FileRL reward management:
 * - GET /api/reward/types - List available reward types (builtin + custom)
 * - POST /api/reward/compute - Compute reward for a task
 * - POST /api/reward/select - Select best task using PPO metrics
 *
 * All endpoints share the same src/reward/ops implementation with CLI commands.
 */
import type { FastifyInstance } from "fastify";
import { logger as globalLogger } from "../../telemetry";

// Import from reward/ops module - shared with CLI
import {
  // Types
  type RewardType,
  type TaskCandidate,
  SELECT_DEFAULTS,
  // CRUD operations
  listTypes,
  selectBestTask,
} from "../../reward/ops";

// Import phase runner for compute
import { runRewardPhaseSync } from "../../task/phase";
import { resolveTaskDirectory, findVibenRoot } from "../../cli/lib/viben-workspace";

// Module-level logger
const log = globalLogger.child({ module: "reward" });

// =============================================================================
// Response Transformers (snake_case for API)
// =============================================================================

/**
 * Transform RewardType to snake_case API response format
 */
function toSnakeCaseRewardType(rewardType: RewardType) {
  return {
    name: rewardType.name,
    description: rewardType.description,
    weight_default: rewardType.weightDefault ?? null,
    source: rewardType.source,
    prompt_path: rewardType.promptPath,
  };
}

/**
 * Transform TaskCandidate to snake_case API response format
 */
function toSnakeCaseTaskCandidate(candidate: TaskCandidate) {
  return {
    task: candidate.task,
    reward: candidate.reward,
    diff_lines: candidate.diffLines,
    kl_penalty: candidate.klPenalty,
    adjusted_reward: candidate.adjustedReward,
    advantage: candidate.advantage,
    ppo_score: candidate.ppoScore,
  };
}

// =============================================================================
// Route Registration
// =============================================================================

/**
 * Register reward routes
 */
export function registerRewardRoutes(fastify: FastifyInstance): void {
  // ============================================================================
  // GET /api/reward/types - List available reward types
  // ============================================================================
  fastify.get<{
    Querystring: { workspace_path: string };
  }>("/api/reward/types", {
    schema: {
      description: "List available reward types (builtin + custom)",
      tags: ["reward"],
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
            success: { type: "boolean" },
            types: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  description: { type: "string" },
                  weight_default: { type: "number", nullable: true },
                  source: { type: "string", enum: ["builtin", "custom"] },
                  prompt_path: { type: "string" },
                },
              },
            },
            count: { type: "number" },
          },
        },
        400: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            error: { type: "string" },
          },
        },
      },
    },
  }, async (request, reply) => {
    const { workspace_path } = request.query;

    if (!workspace_path) {
      reply.code(400);
      return { success: false, error: "workspace_path is required" };
    }

    log.debug({ workspacePath: workspace_path }, "Listing reward types");

    const result = listTypes(workspace_path);

    if (!result.success) {
      reply.code(400);
      return { success: false, error: result.error };
    }

    return {
      success: true,
      types: result.types.map(toSnakeCaseRewardType),
      count: result.count,
    };
  });

  // ============================================================================
  // POST /api/reward/compute - Compute reward for a task
  // ============================================================================
  fastify.post<{
    Body: {
      workspace_path: string;
      task: string;
      platform?: string;
      verbose?: boolean;
    };
  }>("/api/reward/compute", {
    schema: {
      description: "Compute reward for a task by spawning the reward agent",
      tags: ["reward"],
      body: {
        type: "object",
        properties: {
          workspace_path: { type: "string", description: "Workspace path (required)" },
          task: { type: "string", description: "Task name or directory (required)" },
          platform: { type: "string", description: "Platform (claude, cursor, iflow, opencode)", default: "claude" },
          verbose: { type: "boolean", description: "Enable verbose output", default: true },
        },
        required: ["workspace_path", "task"],
      },
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            agent_id: { type: "string" },
            pid: { type: "number" },
            log_file: { type: "string" },
            warnings: { type: "array", items: { type: "string" }, nullable: true },
          },
        },
        400: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            error: { type: "string" },
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
    const { workspace_path, task, platform = "claude", verbose = true } = request.body;

    if (!workspace_path) {
      reply.code(400);
      return { success: false, error: "workspace_path is required" };
    }

    if (!task) {
      reply.code(400);
      return { success: false, error: "task is required" };
    }

    log.info({ workspacePath: workspace_path, task, platform }, "Computing reward for task");

    // Find repo root
    const repoRoot = findVibenRoot(workspace_path);
    if (!repoRoot) {
      reply.code(400);
      return { success: false, error: "Not a Viben workspace (.viben not found)" };
    }

    // Resolve task directory
    const taskDir = resolveTaskDirectory(task, repoRoot);
    if (!taskDir) {
      reply.code(404);
      return { success: false, error: `Task not found: ${task}` };
    }

    // Run reward phase
    const result = runRewardPhaseSync(repoRoot, taskDir, {
      platform,
      verbose,
    });

    if (!result.success) {
      reply.code(400);
      return { success: false, error: result.error || "Failed to compute reward" };
    }

    return {
      success: true,
      agent_id: result.agentId,
      pid: result.pid,
      log_file: result.logFile,
      warnings: result.warnings ?? null,
    };
  });

  // ============================================================================
  // POST /api/reward/select - Select best task using PPO metrics
  // ============================================================================
  fastify.post<{
    Body: {
      workspace_path: string;
      tasks: string[];
      threshold?: number;
      kl_coef?: number;
      max_diff?: number;
    };
  }>("/api/reward/select", {
    schema: {
      description: "Select best task using PPO metrics",
      tags: ["reward"],
      body: {
        type: "object",
        properties: {
          workspace_path: { type: "string", description: "Workspace path (required)" },
          tasks: {
            type: "array",
            items: { type: "string" },
            description: "Task names to compare (must have computed rewards)",
          },
          threshold: {
            type: "number",
            description: `Minimum adjusted reward threshold (default: ${SELECT_DEFAULTS.threshold})`,
          },
          kl_coef: {
            type: "number",
            description: `KL penalty coefficient (default: ${SELECT_DEFAULTS.klCoef})`,
          },
          max_diff: {
            type: "number",
            description: `Maximum diff lines for KL normalization (default: ${SELECT_DEFAULTS.maxDiff})`,
          },
        },
        required: ["workspace_path", "tasks"],
      },
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            baseline: { type: "number" },
            threshold: { type: "number" },
            candidates: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  task: { type: "string" },
                  reward: { type: "number" },
                  diff_lines: { type: "number" },
                  kl_penalty: { type: "number" },
                  adjusted_reward: { type: "number" },
                  advantage: { type: "number" },
                  ppo_score: { type: "number" },
                },
              },
            },
            selected: { type: "string", nullable: true },
            rejected: { type: "array", items: { type: "string" } },
          },
        },
        400: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            error: { type: "string" },
          },
        },
      },
    },
  }, async (request, reply) => {
    const { workspace_path, tasks, threshold, kl_coef, max_diff } = request.body;

    if (!workspace_path) {
      reply.code(400);
      return { success: false, error: "workspace_path is required" };
    }

    if (!tasks || tasks.length === 0) {
      reply.code(400);
      return { success: false, error: "tasks array is required and must not be empty" };
    }

    log.info({ workspacePath: workspace_path, tasks }, "Selecting best task");

    // Find repo root
    const repoRoot = findVibenRoot(workspace_path);
    if (!repoRoot) {
      reply.code(400);
      return { success: false, error: "Not a Viben workspace (.viben not found)" };
    }

    // Build options
    const selectOptions: Parameters<typeof selectBestTask>[2] = {};
    if (threshold !== undefined) {
      selectOptions.threshold = threshold;
    }
    if (kl_coef !== undefined) {
      selectOptions.klCoef = kl_coef;
    }
    if (max_diff !== undefined) {
      selectOptions.maxDiff = max_diff;
    }

    const result = selectBestTask(repoRoot, tasks, selectOptions);

    if (!result.success) {
      reply.code(400);
      return { success: false, error: result.error || "Failed to select task" };
    }

    return {
      success: true,
      baseline: result.baseline,
      threshold: result.threshold,
      candidates: (result.candidates || []).map(toSnakeCaseTaskCandidate),
      selected: result.selected ?? null,
      rejected: result.rejected ?? [],
    };
  });
}
