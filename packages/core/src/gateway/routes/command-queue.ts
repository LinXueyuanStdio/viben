/**
 * Command Queue Routes
 *
 * REST API endpoints for the command queue system.
 * All parameters use snake_case for API consistency.
 *
 * These routes provide access to the detached process command queue,
 * which executes shell commands in the background.
 *
 * Base path: /api/command-queue/*
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

// Import queue ops directly (no gateway state needed)
import {
  enqueue,
  cancel,
  retry,
  status,
  list,
  inspect,
  logs,
  getConfig,
  updateConfig,
  clean,
  type EnqueueOptions,
  type QueueConfig,
  type QueueItemStatus,
} from "../../queue/ops";

/**
 * Register command queue routes
 */
export function registerCommandQueueRoutes(fastify: FastifyInstance): void {
  /**
   * Enqueue a new command
   * POST /api/command-queue/enqueue
   *
   * Body:
   * - command: string (required) - The shell command to execute
   * - cwd: string (required) - Working directory
   * - metadata?: object - Optional metadata
   *
   * Returns:
   * - success: boolean
   * - id?: string - Queue item ID
   * - position?: number - Position in queue
   * - error?: string
   */
  fastify.post<{
    Body: EnqueueOptions;
  }>("/api/command-queue/enqueue", async (request, reply) => {
    const result = enqueue(request.body);

    if (!result.success) {
      reply.code(400);
      return result;
    }

    reply.code(201);
    return result;
  });

  /**
   * Get queue status
   * GET /api/command-queue/status
   *
   * Query params:
   * - include_items?: boolean - Include item details
   *
   * Returns:
   * - pending: number
   * - running: number
   * - completed: number
   * - max_concurrency: number
   * - items?: { pending: [], running: [] }
   */
  fastify.get<{
    Querystring: { include_items?: string };
  }>("/api/command-queue/status", async (request) => {
    const includeItems = request.query.include_items === "true";
    return status({ include_items: includeItems });
  });

  /**
   * List queue items
   * GET /api/command-queue/items
   *
   * Query params:
   * - status?: string - Filter by status (pending, running, completed, failed, cancelled)
   * - limit?: number - Max items to return (default: 50)
   * - offset?: number - Skip items for pagination
   * - sort?: string - Sort order (created_at_asc, created_at_desc)
   *
   * Returns:
   * - items: array
   * - total: number
   */
  fastify.get<{
    Querystring: {
      status?: string;
      limit?: string;
      offset?: string;
      sort?: string;
    };
  }>("/api/command-queue/items", async (request) => {
    const { status: statusFilter, limit, offset, sort } = request.query;

    return list({
      status: statusFilter ? (statusFilter as QueueItemStatus) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
      sort: sort as "created_at_asc" | "created_at_desc" | undefined,
    });
  });

  /**
   * Inspect a specific item
   * GET /api/command-queue/items/:id
   *
   * Returns:
   * - item: object
   * - status: string
   */
  fastify.get<{
    Params: { id: string };
  }>("/api/command-queue/items/:id", async (request, reply) => {
    const { id } = request.params;
    const result = inspect({ id });

    if (!result.success) {
      reply.code(404);
    }

    return result;
  });

  /**
   * Cancel an item
   * POST /api/command-queue/items/:id/cancel
   *
   * Body:
   * - force?: boolean - Use SIGKILL instead of SIGTERM
   *
   * Returns:
   * - success: boolean
   * - cancelled?: string
   * - error?: string
   */
  fastify.post<{
    Params: { id: string };
    Body: { force?: boolean };
  }>("/api/command-queue/items/:id/cancel", async (request, reply) => {
    const { id } = request.params;
    const { force = false } = request.body || {};

    const result = cancel({ id, force });

    if (!result.success) {
      reply.code(400);
    }

    return result;
  });

  /**
   * Retry a failed item
   * POST /api/command-queue/items/:id/retry
   *
   * Body:
   * - reset_count?: boolean - Reset retry counter
   *
   * Returns:
   * - success: boolean
   * - id?: string - New item ID
   * - position?: number
   * - error?: string
   */
  fastify.post<{
    Params: { id: string };
    Body: { reset_count?: boolean };
  }>("/api/command-queue/items/:id/retry", async (request, reply) => {
    const { id } = request.params;
    const { reset_count = false } = request.body || {};

    const result = retry({ id, reset_count });

    if (!result.success) {
      reply.code(400);
    }

    return result;
  });

  /**
   * Get item logs
   * GET /api/command-queue/items/:id/logs
   *
   * Query params:
   * - tail?: number - Number of lines from end
   * - max_bytes?: number - Max bytes to read
   *
   * Returns:
   * - content: string
   * - size: number
   * - truncated: boolean
   */
  fastify.get<{
    Params: { id: string };
    Querystring: {
      tail?: string;
      max_bytes?: string;
    };
  }>("/api/command-queue/items/:id/logs", async (request, reply) => {
    const { id } = request.params;
    const { tail, max_bytes } = request.query;

    const result = logs({
      id,
      tail: tail !== undefined,
      lines: tail ? parseInt(tail, 10) : undefined,
      max_bytes: max_bytes ? parseInt(max_bytes, 10) : undefined,
    });

    if (!result.success) {
      reply.code(404);
    }

    return result;
  });

  /**
   * Get queue configuration
   * GET /api/command-queue/config
   *
   * Returns: QueueConfig
   */
  fastify.get("/api/command-queue/config", async () => {
    return getConfig();
  });

  /**
   * Update queue configuration
   * PUT /api/command-queue/config
   *
   * Body: Partial<QueueConfig>
   *
   * Returns: ConfigResult with updated config
   */
  fastify.put<{
    Body: Partial<QueueConfig>;
  }>("/api/command-queue/config", async (request, reply) => {
    const result = updateConfig(request.body);

    if (!result.success) {
      reply.code(400);
    }

    return result;
  });

  /**
   * Clean old items
   * POST /api/command-queue/clean
   *
   * Body:
   * - completed_days?: number - Remove records older than N days
   * - log_days?: number - Remove logs older than N days
   * - dry_run?: boolean - Preview what would be cleaned
   * - records_only?: boolean - Only clean records
   * - logs_only?: boolean - Only clean logs
   *
   * Returns:
   * - cleaned: number
   * - items: string[]
   */
  fastify.post<{
    Body: {
      completed_days?: number;
      log_days?: number;
      dry_run?: boolean;
      records_only?: boolean;
      logs_only?: boolean;
    };
  }>("/api/command-queue/clean", async (request) => {
    return clean(request.body);
  });
}
