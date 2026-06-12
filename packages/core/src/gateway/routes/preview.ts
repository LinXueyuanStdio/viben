/**
 * Preview API Routes
 *
 * Provides HTTP endpoints for managing Vite preview servers.
 * Supports live preview with HMR for HTML/JS/CSS files.
 */

import type { FastifyInstance, FastifyReply } from "fastify";
import {
  getPreviewManager,
  isNodeAvailable,
  type PreviewConfig,
  type PreviewStatus,
  type PreviewSSEEvent,
} from "../../services/preview";
import { logger as globalLogger } from "../../telemetry";

// Module-level logger
const log = globalLogger.child({ module: "preview-routes" });

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
  command?: string;
  ready_pattern?: string;
  timeout?: number;
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
 * Helper to send SSE event
 */
function sendSSEEvent(reply: FastifyReply, event: PreviewSSEEvent): void {
  const data = JSON.stringify(event);
  reply.raw.write(`data: ${data}\n\n`);
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
    log.debug({ available }, "Node.js availability check");
    return { available };
  });

  /**
   * Start a Vite preview server with SSE streaming
   * GET /api/preview/start-sse
   *
   * Query params: task_id, work_dir, port?, command?, ready_pattern?, timeout?
   */
  fastify.get<{
    Querystring: {
      task_id: string;
      work_dir: string;
      port?: string;
      command?: string;
      ready_pattern?: string;
      timeout?: string;
    };
  }>("/api/preview/start-sse", {
    schema: {
      description: "Start a Vite preview server with SSE streaming for real-time feedback",
      tags: ["preview"],
      querystring: {
        type: "object",
        required: ["task_id", "work_dir"],
        properties: {
          task_id: { type: "string", description: "Task identifier" },
          work_dir: { type: "string", description: "Working directory path" },
          port: { type: "string", description: "Preferred port (optional)" },
          command: { type: "string", description: "Custom command to run (e.g., 'npm run serve')" },
          ready_pattern: { type: "string", description: "Regex pattern to detect server ready in stdout/stderr" },
          timeout: { type: "string", description: "Startup timeout in milliseconds" },
        },
      },
    },
  }, async (request, reply) => {
    const { task_id, work_dir, port, command, ready_pattern, timeout } = request.query;

    if (!task_id) {
      return reply.status(400).send({ error: "task_id is required" });
    }

    if (!work_dir) {
      return reply.status(400).send({ error: "work_dir is required" });
    }

    log.info({ taskId: task_id, workDir: work_dir, command }, "Starting preview with SSE");

    // Set up SSE headers
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });

    const config: PreviewConfig = {
      taskId: task_id,
      workDir: work_dir,
      port: port ? parseInt(port, 10) : undefined,
      command,
      readyPattern: ready_pattern,
      timeout: timeout ? parseInt(timeout, 10) : undefined,
    };

    const manager = getPreviewManager();

    // Handle client disconnect
    let clientDisconnected = false;
    request.raw.on("close", () => {
      clientDisconnected = true;
      log.debug({ taskId: task_id }, "SSE client disconnected");
    });

    // Start preview with SSE events
    manager.startPreviewWithSSE(config, (event) => {
      if (clientDisconnected) return;

      try {
        sendSSEEvent(reply, event);

        // Close connection after complete event
        if (event.type === "complete") {
          reply.raw.end();
        }
      } catch (error) {
        log.error({ err: error }, "Error sending SSE event");
      }
    });

    // Don't return anything - SSE handles the response
    return reply;
  });

  /**
   * Start a Vite preview server (legacy non-SSE endpoint)
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
          command: { type: "string", description: "Custom command to run (e.g., 'npm run serve')" },
          ready_pattern: { type: "string", description: "Regex pattern to detect server ready in stdout/stderr" },
          timeout: { type: "number", description: "Startup timeout in milliseconds" },
        },
      },
      response: {
        200: {
          type: "object",
          properties: {
            id: { type: "string" },
            task_id: { type: "string" },
            status: { type: "string", enum: ["starting", "running", "stopped", "error"] },
            url: { type: "string" },
            host_port: { type: "number" },
            error: { type: "string" },
            started_at: { type: "string", format: "date-time" },
            last_accessed_at: { type: "string", format: "date-time" },
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
      const { task_id, work_dir, port, command, ready_pattern, timeout } = request.body;

      if (!task_id) {
        return reply.status(400).send({ error: "task_id is required" });
      }

      if (!work_dir) {
        return reply.status(400).send({ error: "work_dir is required" });
      }

      log.info({ taskId: task_id, workDir: work_dir, command }, "Starting preview");

      const config: PreviewConfig = {
        taskId: task_id,
        workDir: work_dir,
        port,
        command,
        readyPattern: ready_pattern,
        timeout,
      };

      const manager = getPreviewManager();
      const status = await manager.startPreview(config);

      return status;
    } catch (error) {
      log.error({ err: error }, "Start error");
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
            task_id: { type: "string" },
            status: { type: "string", enum: ["starting", "running", "stopped", "error"] },
            url: { type: "string" },
            host_port: { type: "number" },
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

      log.info({ taskId: task_id }, "Stopping preview");

      const manager = getPreviewManager();
      const status = await manager.stopPreview(task_id);

      return status;
    } catch (error) {
      log.error({ err: error }, "Stop error");
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
            task_id: { type: "string" },
            status: { type: "string", enum: ["starting", "running", "stopped", "error"] },
            url: { type: "string" },
            host_port: { type: "number" },
            error: { type: "string" },
            started_at: { type: "string", format: "date-time" },
            last_accessed_at: { type: "string", format: "date-time" },
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
      log.error({ err: error }, "Status error");
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
      log.info("Stopping all preview servers");

      const manager = getPreviewManager();
      await manager.stopAll();

      return { success: true, message: "All preview servers stopped" };
    } catch (error) {
      log.error({ err: error }, "Stop-all error");
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
                  task_id: { type: "string" },
                  status: { type: "string", enum: ["starting", "running", "stopped", "error"] },
                  url: { type: "string" },
                  host_port: { type: "number" },
                  error: { type: "string" },
                  started_at: { type: "string", format: "date-time" },
                  last_accessed_at: { type: "string", format: "date-time" },
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

  /**
   * Kill process occupying a port
   * POST /api/preview/kill-port
   */
  fastify.post<{ Body: { port: number } }>("/api/preview/kill-port", {
    schema: {
      description: "Kill the process occupying a specific port",
      tags: ["preview"],
      body: {
        type: "object",
        required: ["port"],
        properties: {
          port: { type: "number", description: "Port number to free" },
        },
      },
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            error: { type: "string" },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { port } = request.body;
      if (!port) {
        return reply.status(400).send({ success: false, error: "port is required" });
      }

      log.info({ port }, "Killing process on port");
      const manager = getPreviewManager();
      const result = await manager.killPort(port);
      return result;
    } catch (error) {
      log.error({ err: error }, "Kill-port error");
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });
}
