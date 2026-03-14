/**
 * Preview API Routes
 *
 * Provides HTTP endpoints for managing Vite preview servers.
 * Supports live preview with HMR for HTML/JS/CSS files.
 */

import type { FastifyInstance } from "fastify";
import {
  getPreviewManager,
  isNodeAvailable,
  type PreviewConfig,
  type PreviewStatus,
} from "../../services/preview";

/**
 * Response types for API documentation
 */
interface NodeAvailableResponse {
  available: boolean;
}

interface PreviewStartRequest {
  task_id: string;
  work_dir: string;
  port?: number;
}

interface PreviewStopRequest {
  task_id: string;
}

interface PreviewStopAllResponse {
  success: boolean;
  message?: string;
  error?: string;
}

interface PreviewListResponse {
  previews: PreviewStatus[];
  count: number;
}

/**
 * Register preview routes
 */
export function registerPreviewRoutes(fastify: FastifyInstance): void {
  /**
   * Check if Node.js is available for Live Preview
   * GET /api/preview/node-available
   */
  fastify.get("/api/preview/node-available", {
    schema: {
      description: "Check if Node.js is available for Live Preview",
      tags: ["preview"],
      response: {
        200: {
          type: "object",
          properties: {
            available: { type: "boolean" },
          },
        },
      },
    },
  }, async (): Promise<NodeAvailableResponse> => {
    const available = isNodeAvailable();
    console.log(`[Preview API] Node.js available: ${available}`);
    return { available };
  });

  /**
   * Start a Vite preview server
   * POST /api/preview/start
   */
  fastify.post<{ Body: PreviewStartRequest }>("/api/preview/start", {
    schema: {
      description: "Start a Vite preview server for a task",
      tags: ["preview"],
      body: {
        type: "object",
        required: ["task_id", "work_dir"],
        properties: {
          task_id: { type: "string", description: "Task identifier" },
          work_dir: { type: "string", description: "Working directory path" },
          port: { type: "number", description: "Preferred port (optional)" },
        },
      },
      response: {
        200: {
          type: "object",
          properties: {
            id: { type: "string" },
            taskId: { type: "string" },
            status: { type: "string", enum: ["starting", "running", "stopped", "error"] },
            url: { type: "string" },
            hostPort: { type: "number" },
            error: { type: "string" },
            startedAt: { type: "string", format: "date-time" },
            lastAccessedAt: { type: "string", format: "date-time" },
          },
        },
        400: {
          type: "object",
          properties: {
            error: { type: "string" },
          },
        },
        500: {
          type: "object",
          properties: {
            status: { type: "string" },
            error: { type: "string" },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { task_id, work_dir, port } = request.body;

      if (!task_id) {
        return reply.status(400).send({ error: "task_id is required" });
      }

      if (!work_dir) {
        return reply.status(400).send({ error: "work_dir is required" });
      }

      console.log(`[Preview API] Starting preview for task ${task_id}`);
      console.log(`[Preview API] work_dir: ${work_dir}`);

      const config: PreviewConfig = {
        taskId: task_id,
        workDir: work_dir,
        port,
      };

      const manager = getPreviewManager();
      const status = await manager.startPreview(config);

      return status;
    } catch (error) {
      console.error("[Preview API] Start error:", error);
      return reply.status(500).send({
        status: "error",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * Stop a Vite preview server
   * POST /api/preview/stop
   */
  fastify.post<{ Body: PreviewStopRequest }>("/api/preview/stop", {
    schema: {
      description: "Stop a Vite preview server",
      tags: ["preview"],
      body: {
        type: "object",
        required: ["task_id"],
        properties: {
          task_id: { type: "string", description: "Task identifier" },
        },
      },
      response: {
        200: {
          type: "object",
          properties: {
            id: { type: "string" },
            taskId: { type: "string" },
            status: { type: "string", enum: ["starting", "running", "stopped", "error"] },
            url: { type: "string" },
            hostPort: { type: "number" },
            error: { type: "string" },
          },
        },
        400: {
          type: "object",
          properties: {
            error: { type: "string" },
          },
        },
        500: {
          type: "object",
          properties: {
            status: { type: "string" },
            error: { type: "string" },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { task_id } = request.body;

      if (!task_id) {
        return reply.status(400).send({ error: "task_id is required" });
      }

      console.log(`[Preview API] Stopping preview for task ${task_id}`);

      const manager = getPreviewManager();
      const status = await manager.stopPreview(task_id);

      return status;
    } catch (error) {
      console.error("[Preview API] Stop error:", error);
      return reply.status(500).send({
        status: "error",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * Get status of a preview server
   * GET /api/preview/status/:task_id
   */
  fastify.get<{ Params: { task_id: string } }>("/api/preview/status/:task_id", {
    schema: {
      description: "Get status of a preview server",
      tags: ["preview"],
      params: {
        type: "object",
        required: ["task_id"],
        properties: {
          task_id: { type: "string", description: "Task identifier" },
        },
      },
      response: {
        200: {
          type: "object",
          properties: {
            id: { type: "string" },
            taskId: { type: "string" },
            status: { type: "string", enum: ["starting", "running", "stopped", "error"] },
            url: { type: "string" },
            hostPort: { type: "number" },
            error: { type: "string" },
            startedAt: { type: "string", format: "date-time" },
            lastAccessedAt: { type: "string", format: "date-time" },
          },
        },
        400: {
          type: "object",
          properties: {
            error: { type: "string" },
          },
        },
        500: {
          type: "object",
          properties: {
            status: { type: "string" },
            error: { type: "string" },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { task_id } = request.params;

      if (!task_id) {
        return reply.status(400).send({ error: "task_id is required" });
      }

      const manager = getPreviewManager();
      const status = manager.getStatus(task_id);

      return status;
    } catch (error) {
      console.error("[Preview API] Status error:", error);
      return reply.status(500).send({
        status: "error",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * Stop all preview servers
   * POST /api/preview/stop-all
   */
  fastify.post("/api/preview/stop-all", {
    schema: {
      description: "Stop all running preview servers",
      tags: ["preview"],
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            message: { type: "string" },
          },
        },
        500: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            error: { type: "string" },
          },
        },
      },
    },
  }, async (_request, reply): Promise<PreviewStopAllResponse> => {
    try {
      console.log("[Preview API] Stopping all preview servers");

      const manager = getPreviewManager();
      await manager.stopAll();

      return { success: true, message: "All preview servers stopped" };
    } catch (error) {
      console.error("[Preview API] Stop-all error:", error);
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * List all active preview servers
   * GET /api/preview/list
   */
  fastify.get("/api/preview/list", {
    schema: {
      description: "List all active preview servers",
      tags: ["preview"],
      response: {
        200: {
          type: "object",
          properties: {
            previews: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  taskId: { type: "string" },
                  status: { type: "string", enum: ["starting", "running", "stopped", "error"] },
                  url: { type: "string" },
                  hostPort: { type: "number" },
                  error: { type: "string" },
                  startedAt: { type: "string", format: "date-time" },
                  lastAccessedAt: { type: "string", format: "date-time" },
                },
              },
            },
            count: { type: "number" },
          },
        },
      },
    },
  }, async (): Promise<PreviewListResponse> => {
    const manager = getPreviewManager();
    const previews = manager.getActiveInstances();

    return {
      previews,
      count: previews.length,
    };
  });
}
