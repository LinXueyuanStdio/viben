/**
 * Cron routes
 */
import type { FastifyInstance } from "fastify";
import type { CronJob, CreateCronJob, UpdateCronJob } from "../../services/cron";
import type { AppState } from "../state";
import { trace, SpanStatusCode } from "../../telemetry";
import { getSpanName } from "../../telemetry/route-names";

// Get tracer for cron routes
const tracer = trace.getTracer("viben-gateway", "1.0.0");

/**
 * Transform CronJob to snake_case response format (to match Rust gateway)
 * Note: CronJob interface now uses snake_case, so this is a simple passthrough
 */
function toSnakeCaseJob(job: CronJob) {
  return {
    id: job.id,
    name: job.name,
    enabled: job.enabled,
    job_type: job.job_type,
    message: job.message,
    script: job.script,
    cron: job.cron,
    every: job.every,
    channel: job.channel,
    agent: job.agent,
    workspace_path: job.workspace_path,
    notifications: job.notifications,
    last_run: job.last_run,
    last_status: job.last_status,
    last_error: job.last_error,
    last_output: job.last_output,
    next_run: job.next_run,
    created_at: job.created_at,
    updated_at: job.updated_at,
  };
}

/**
 * Register cron routes
 */
export function registerCronRoutes(fastify: FastifyInstance, state: AppState): void {
  // List all cron jobs
  fastify.get("/api/cron", {
    schema: {
      description: "List all cron jobs",
      tags: ["cron"],
      response: {
        200: {
          type: "object",
          properties: {
            jobs: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  name: { type: "string" },
                  enabled: { type: "boolean" },
                  job_type: { type: "string", enum: ["agent", "script", "message"] },
                  message: { type: "string" },
                  script: { type: "string" },
                  cron: { type: "string", description: "Cron expression" },
                  every: { type: "number", description: "Interval in milliseconds" },
                  channel: { type: "string" },
                  agent: { type: "string" },
                  workspace_path: { type: "string" },
                  notifications: { type: "object" },
                  last_run: { type: "number" },
                  last_status: { type: "string" },
                  last_error: { type: "string" },
                  last_output: { type: "string" },
                  next_run: { type: "number" },
                  created_at: { type: "number" },
                  updated_at: { type: "number" },
                },
              },
            },
          },
        },
      },
    },
  }, async () => {
    const span = tracer.startSpan(getSpanName("cron.list"));
    try {
      const jobs = await state.cron.listJobs();
      span.setAttributes({
        "cron.job_count": jobs.length,
        "cron.enabled_count": jobs.filter(j => j.enabled).length,
      });
      span.setStatus({ code: SpanStatusCode.OK });
      return { jobs: jobs.map(toSnakeCaseJob) };
    } catch (e) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: e instanceof Error ? e.message : "Failed to list cron jobs" });
      span.recordException(e instanceof Error ? e : new Error(String(e)));
      throw e;
    } finally {
      span.end();
    }
  });

  // Get a specific cron job
  fastify.get<{ Params: { id: string } }>("/api/cron/:id", {
    schema: {
      description: "Get a specific cron job by ID",
      tags: ["cron"],
      params: {
        type: "object",
        properties: {
          id: { type: "string", description: "Cron job ID" },
        },
        required: ["id"],
      },
      response: {
        200: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            enabled: { type: "boolean" },
            job_type: { type: "string" },
            message: { type: "string" },
            script: { type: "string" },
            cron: { type: "string" },
            every: { type: "number" },
            channel: { type: "string" },
            agent: { type: "string" },
            workspace_path: { type: "string" },
            notifications: { type: "object" },
            last_run: { type: "number" },
            last_status: { type: "string" },
            last_error: { type: "string" },
            last_output: { type: "string" },
            next_run: { type: "number" },
            created_at: { type: "number" },
            updated_at: { type: "number" },
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
    const span = tracer.startSpan(getSpanName("cron.get"), {
      attributes: { "cron.job_id": id },
    });
    try {
      const job = await state.cron.getJob(id);
      if (!job) {
        span.setAttributes({ "cron.job_found": false });
        span.setStatus({ code: SpanStatusCode.ERROR, message: "Cron job not found" });
        reply.code(404);
        return { error: `Cron job not found: ${id}` };
      }
      span.setAttributes({
        "cron.job_found": true,
        "cron.job_name": job.name,
        "cron.job_type": job.job_type,
        "cron.job_enabled": job.enabled,
        "cron.job_agent": job.agent,
      });
      span.setStatus({ code: SpanStatusCode.OK });
      return toSnakeCaseJob(job);
    } catch (e) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: e instanceof Error ? e.message : "Failed to get cron job" });
      span.recordException(e instanceof Error ? e : new Error(String(e)));
      throw e;
    } finally {
      span.end();
    }
  });

  // Create a new cron job
  fastify.post<{ Body: CreateCronJob }>("/api/cron", async (request, reply) => {
    const input = request.body;
    const span = tracer.startSpan(getSpanName("cron.create"), {
      attributes: {
        "cron.job_name": input.name,
        "cron.job_type": input.job_type || "agent",
        "cron.job_enabled": input.enabled !== false,
        "cron.job_cron": input.cron || "",
        "cron.job_every": input.every || 0,
        "cron.job_agent": input.agent || "main",
      },
    });
    try {
      const job = await state.cron.createJob(input);
      span.setAttributes({
        "cron.job_id": job.id,
        "cron.job_created": true,
      });
      span.setStatus({ code: SpanStatusCode.OK });
      reply.code(201);
      return toSnakeCaseJob(job);
    } catch (e) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: e instanceof Error ? e.message : "Failed to create cron job" });
      span.recordException(e instanceof Error ? e : new Error(String(e)));
      reply.code(400);
      return { error: e instanceof Error ? e.message : "Failed to create cron job" };
    } finally {
      span.end();
    }
  });

  // Update a cron job
  fastify.patch<{ Params: { id: string }; Body: UpdateCronJob }>("/api/cron/:id", async (request, reply) => {
    const { id } = request.params;
    const updates = request.body;
    const span = tracer.startSpan(getSpanName("cron.update"), {
      attributes: {
        "cron.job_id": id,
        "cron.update_fields": Object.keys(updates).join(","),
      },
    });
    try {
      const job = await state.cron.updateJob(id, updates);
      span.setAttributes({
        "cron.job_name": job.name,
        "cron.job_type": job.job_type,
        "cron.job_enabled": job.enabled,
      });
      span.setStatus({ code: SpanStatusCode.OK });
      return toSnakeCaseJob(job);
    } catch (e) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: e instanceof Error ? e.message : "Failed to update cron job" });
      span.recordException(e instanceof Error ? e : new Error(String(e)));
      reply.code(400);
      return { error: e instanceof Error ? e.message : "Failed to update cron job" };
    } finally {
      span.end();
    }
  });

  // Delete a cron job
  fastify.delete<{ Params: { id: string } }>("/api/cron/:id", async (request, reply) => {
    const { id } = request.params;
    const span = tracer.startSpan(getSpanName("cron.delete"), {
      attributes: { "cron.job_id": id },
    });
    try {
      await state.cron.deleteJob(id);
      span.setStatus({ code: SpanStatusCode.OK });
      return { deleted: id };
    } catch (e) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: e instanceof Error ? e.message : "Failed to delete cron job" });
      span.recordException(e instanceof Error ? e : new Error(String(e)));
      reply.code(400);
      return { error: e instanceof Error ? e.message : "Failed to delete cron job" };
    } finally {
      span.end();
    }
  });

  // Enable a cron job
  fastify.post<{ Params: { id: string } }>("/api/cron/:id/enable", async (request, reply) => {
    const { id } = request.params;
    const span = tracer.startSpan(getSpanName("cron.enable"), {
      attributes: { "cron.job_id": id },
    });
    try {
      const job = await state.cron.enableJob(id);
      span.setAttributes({
        "cron.job_name": job.name,
        "cron.job_enabled": job.enabled,
        "cron.job_next_run": job.next_run || 0,
      });
      span.setStatus({ code: SpanStatusCode.OK });
      return toSnakeCaseJob(job);
    } catch (e) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: e instanceof Error ? e.message : "Failed to enable cron job" });
      span.recordException(e instanceof Error ? e : new Error(String(e)));
      reply.code(400);
      return { error: e instanceof Error ? e.message : "Failed to enable cron job" };
    } finally {
      span.end();
    }
  });

  // Disable a cron job
  fastify.post<{ Params: { id: string } }>("/api/cron/:id/disable", async (request, reply) => {
    const { id } = request.params;
    const span = tracer.startSpan(getSpanName("cron.disable"), {
      attributes: { "cron.job_id": id },
    });
    try {
      const job = await state.cron.disableJob(id);
      span.setAttributes({
        "cron.job_name": job.name,
        "cron.job_enabled": job.enabled,
      });
      span.setStatus({ code: SpanStatusCode.OK });
      return toSnakeCaseJob(job);
    } catch (e) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: e instanceof Error ? e.message : "Failed to disable cron job" });
      span.recordException(e instanceof Error ? e : new Error(String(e)));
      reply.code(400);
      return { error: e instanceof Error ? e.message : "Failed to disable cron job" };
    } finally {
      span.end();
    }
  });

  // Run a cron job immediately
  fastify.post<{ Params: { id: string } }>("/api/cron/:id/run", async (request, reply) => {
    const { id } = request.params;
    const span = tracer.startSpan(getSpanName("cron.run"), {
      attributes: { "cron.job_id": id },
    });
    try {
      // Get job info before running for logging
      const job = await state.cron.getJob(id);
      if (job) {
        span.setAttributes({
          "cron.job_name": job.name,
          "cron.job_type": job.job_type,
          "cron.job_agent": job.agent,
        });
      }
      await state.cron.runJob(id);
      span.setStatus({ code: SpanStatusCode.OK });
      return { triggered: id, message: "Job execution started" };
    } catch (e) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: e instanceof Error ? e.message : "Failed to run cron job" });
      span.recordException(e instanceof Error ? e : new Error(String(e)));
      reply.code(400);
      return { error: e instanceof Error ? e.message : "Failed to run cron job" };
    } finally {
      span.end();
    }
  });

  // Get execution logs for a cron job
  fastify.get<{
    Params: { id: string };
    Querystring: { limit?: string; offset?: string };
  }>("/api/cron/:id/logs", async (request, reply) => {
    const { id } = request.params;
    const limit = request.query.limit ? parseInt(request.query.limit, 10) : 100;
    const offset = request.query.offset ? parseInt(request.query.offset, 10) : 0;
    const span = tracer.startSpan(getSpanName("cron.logs"), {
      attributes: {
        "cron.job_id": id,
        "cron.logs_limit": limit,
        "cron.logs_offset": offset,
      },
    });
    try {
      const logs = await state.cron.getExecutionLogs(id, limit, offset);
      span.setAttributes({
        "cron.logs_count": logs.length,
      });
      span.setStatus({ code: SpanStatusCode.OK });
      return { logs };
    } catch (e) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: e instanceof Error ? e.message : "Failed to get execution logs" });
      span.recordException(e instanceof Error ? e : new Error(String(e)));
      reply.code(400);
      return { error: e instanceof Error ? e.message : "Failed to get execution logs" };
    } finally {
      span.end();
    }
  });

  // Clear execution logs for a cron job
  fastify.delete<{ Params: { id: string } }>("/api/cron/:id/logs", async (request, reply) => {
    const { id } = request.params;
    const span = tracer.startSpan(getSpanName("cron.logs_clear"), {
      attributes: { "cron.job_id": id },
    });
    try {
      await state.cron.clearExecutionLogs(id);
      span.setStatus({ code: SpanStatusCode.OK });
      return { cleared: id };
    } catch (e) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: e instanceof Error ? e.message : "Failed to clear execution logs" });
      span.recordException(e instanceof Error ? e : new Error(String(e)));
      reply.code(400);
      return { error: e instanceof Error ? e.message : "Failed to clear execution logs" };
    } finally {
      span.end();
    }
  });
}
