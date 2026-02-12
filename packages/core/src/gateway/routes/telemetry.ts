/**
 * Telemetry API routes
 *
 * Endpoints:
 *   GET /api/telemetry/dates       - List available dates
 *   GET /api/telemetry/traces      - List traces for a date
 *   GET /api/telemetry/trace/:id   - Get trace details
 *   DELETE /api/telemetry/clean    - Clean old files
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import * as path from "path";
import {
  listTraceDates,
  listTraces,
  loadTrace,
  buildTraceTree,
  getTraceStats,
  cleanOldTelemetryFiles,
  getDefaultTelemetryDir,
} from "../../telemetry";
import type { TraceTree, TraceSpan } from "../../telemetry";

interface DateQuery {
  date?: string;
}

interface TraceParams {
  id: string;
}

interface CleanBody {
  retentionDays?: number;
}

/**
 * Register telemetry routes
 */
export function registerTelemetryRoutes(fastify: FastifyInstance): void {
  const baseDir = getDefaultTelemetryDir();

  /**
   * GET /api/telemetry/dates
   * List available trace dates
   */
  fastify.get("/api/telemetry/dates", async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const dates = listTraceDates(baseDir);
      const result = await Promise.all(
        dates.map(async (date) => {
          const traces = await listTraces(baseDir, date);
          return {
            date,
            count: traces.length,
            totalSize: traces.reduce((sum, t) => sum + t.size, 0),
          };
        })
      );
      return reply.send(result);
    } catch (error) {
      return reply.status(500).send({
        error: "Failed to list dates",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * GET /api/telemetry/traces
   * List traces for a specific date
   */
  fastify.get<{ Querystring: DateQuery }>(
    "/api/telemetry/traces",
    async (request: FastifyRequest<{ Querystring: DateQuery }>, reply: FastifyReply) => {
      try {
        const { date = new Date().toISOString().split("T")[0] } = request.query;
        const traces = await listTraces(baseDir, date);

        const result = traces.map((t) => ({
          traceId: t.traceId,
          size: t.size,
          mtime: t.mtime.toISOString(),
        }));

        return reply.send({
          date,
          count: result.length,
          traces: result,
        });
      } catch (error) {
        return reply.status(500).send({
          error: "Failed to list traces",
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  /**
   * GET /api/telemetry/trace/:id
   * Get trace details with tree structure
   */
  fastify.get<{ Params: TraceParams; Querystring: DateQuery }>(
    "/api/telemetry/trace/:id",
    async (
      request: FastifyRequest<{ Params: TraceParams; Querystring: DateQuery }>,
      reply: FastifyReply
    ) => {
      try {
        const { id } = request.params;
        const { date = new Date().toISOString().split("T")[0] } = request.query;
        const filePath = path.join(baseDir, "traces", date, `${id}.jsonl`);

        const spans = await loadTrace(filePath);
        const tree = buildTraceTree(spans);

        if (!tree) {
          return reply.status(404).send({
            error: "Trace not found or empty",
            traceId: id,
            date,
          });
        }

        const stats = getTraceStats(tree);

        return reply.send({
          traceId: id,
          date,
          tree,
          stats: {
            totalSpans: stats.totalSpans,
            successSpans: stats.successSpans,
            errorSpans: stats.errorSpans,
            maxDepth: stats.maxDepth,
            operations: Array.from(stats.operations.entries()).map(([name, data]) => ({
              name,
              count: data.count,
              totalDuration: data.totalDuration,
              avgDuration: data.totalDuration / data.count,
            })),
          },
        });
      } catch (error) {
        return reply.status(500).send({
          error: "Failed to load trace",
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  /**
   * GET /api/telemetry/trace/:id/spans
   * Get raw spans for a trace (for custom rendering)
   */
  fastify.get<{ Params: TraceParams; Querystring: DateQuery }>(
    "/api/telemetry/trace/:id/spans",
    async (
      request: FastifyRequest<{ Params: TraceParams; Querystring: DateQuery }>,
      reply: FastifyReply
    ) => {
      try {
        const { id } = request.params;
        const { date = new Date().toISOString().split("T")[0] } = request.query;
        const filePath = path.join(baseDir, "traces", date, `${id}.jsonl`);

        const spans = await loadTrace(filePath);

        return reply.send({
          traceId: id,
          date,
          spans,
        });
      } catch (error) {
        return reply.status(500).send({
          error: "Failed to load spans",
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  /**
   * DELETE /api/telemetry/clean
   * Clean old telemetry files
   */
  fastify.delete<{ Body: CleanBody }>(
    "/api/telemetry/clean",
    async (request: FastifyRequest<{ Body: CleanBody }>, reply: FastifyReply) => {
      try {
        const { retentionDays = 7 } = request.body || {};

        // Get before stats
        const datesBefore = listTraceDates(baseDir);
        let tracesBefore = 0;
        for (const d of datesBefore) {
          tracesBefore += (await listTraces(baseDir, d)).length;
        }

        // Clean
        cleanOldTelemetryFiles(baseDir, retentionDays);

        // Get after stats
        const datesAfter = listTraceDates(baseDir);
        let tracesAfter = 0;
        for (const d of datesAfter) {
          tracesAfter += (await listTraces(baseDir, d)).length;
        }

        return reply.send({
          success: true,
          retentionDays,
          datesRemoved: datesBefore.length - datesAfter.length,
          tracesRemoved: tracesBefore - tracesAfter,
        });
      } catch (error) {
        return reply.status(500).send({
          error: "Failed to clean telemetry",
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  /**
   * GET /api/telemetry/stats
   * Get telemetry statistics
   */
  fastify.get("/api/telemetry/stats", async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const dates = listTraceDates(baseDir);
      let totalTraces = 0;
      let totalSize = 0;

      for (const d of dates) {
        const traces = await listTraces(baseDir, d);
        totalTraces += traces.length;
        totalSize += traces.reduce((sum, t) => sum + t.size, 0);
      }

      return reply.send({
        directory: baseDir,
        dates: dates.length,
        totalTraces,
        totalSizeBytes: totalSize,
        totalSizeMB: (totalSize / 1024 / 1024).toFixed(2),
      });
    } catch (error) {
      return reply.status(500).send({
        error: "Failed to get stats",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });
}
