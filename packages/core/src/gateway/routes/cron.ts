/**
 * Cron routes
 */
import type { FastifyInstance } from "fastify";
import type { CreateCronJob, UpdateCronJob } from "../../services/cron";
import type { AppState } from "../state";

/**
 * Register cron routes
 */
export function registerCronRoutes(fastify: FastifyInstance, state: AppState): void {
  // List all cron jobs
  fastify.get("/api/cron", async () => {
    const jobs = await state.cron.listJobs();
    return { jobs };
  });

  // Get a specific cron job
  fastify.get<{ Params: { id: string } }>("/api/cron/:id", async (request, reply) => {
    const { id } = request.params;
    const job = await state.cron.getJob(id);
    if (!job) {
      reply.code(404);
      return { error: `Cron job not found: ${id}` };
    }
    return { job };
  });

  // Create a new cron job
  fastify.post<{ Body: CreateCronJob }>("/api/cron", async (request, reply) => {
    const input = request.body;
    try {
      const job = await state.cron.createJob(input);
      reply.code(201);
      return { job };
    } catch (e) {
      reply.code(400);
      return { error: e instanceof Error ? e.message : "Failed to create cron job" };
    }
  });

  // Update a cron job
  fastify.patch<{ Params: { id: string }; Body: UpdateCronJob }>("/api/cron/:id", async (request, reply) => {
    const { id } = request.params;
    const updates = request.body;
    try {
      const job = await state.cron.updateJob(id, updates);
      return { job };
    } catch (e) {
      reply.code(400);
      return { error: e instanceof Error ? e.message : "Failed to update cron job" };
    }
  });

  // Delete a cron job
  fastify.delete<{ Params: { id: string } }>("/api/cron/:id", async (request, reply) => {
    const { id } = request.params;
    try {
      await state.cron.deleteJob(id);
      return { success: true };
    } catch (e) {
      reply.code(400);
      return { error: e instanceof Error ? e.message : "Failed to delete cron job" };
    }
  });

  // Enable a cron job
  fastify.post<{ Params: { id: string } }>("/api/cron/:id/enable", async (request, reply) => {
    const { id } = request.params;
    try {
      const job = await state.cron.enableJob(id);
      return { job };
    } catch (e) {
      reply.code(400);
      return { error: e instanceof Error ? e.message : "Failed to enable cron job" };
    }
  });

  // Disable a cron job
  fastify.post<{ Params: { id: string } }>("/api/cron/:id/disable", async (request, reply) => {
    const { id } = request.params;
    try {
      const job = await state.cron.disableJob(id);
      return { job };
    } catch (e) {
      reply.code(400);
      return { error: e instanceof Error ? e.message : "Failed to disable cron job" };
    }
  });

  // Run a cron job immediately
  fastify.post<{ Params: { id: string } }>("/api/cron/:id/run", async (request, reply) => {
    const { id } = request.params;
    try {
      await state.cron.runJob(id);
      return { success: true };
    } catch (e) {
      reply.code(400);
      return { error: e instanceof Error ? e.message : "Failed to run cron job" };
    }
  });
}
