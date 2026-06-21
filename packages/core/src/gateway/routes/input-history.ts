import type { FastifyInstance } from "fastify";
import {
  inputHistoryService,
  type InputHistoryService,
} from "../../services/input-history";

interface ListInputHistoryQuery {
  limit?: number | string;
}

interface ListInputHistoryResponse {
  entries: string[];
  total: number;
  limit: number;
}

export function registerInputHistoryRoutes(
  fastify: FastifyInstance,
  service: InputHistoryService = inputHistoryService
): void {
  fastify.get<{
    Querystring: ListInputHistoryQuery;
  }>("/api/input-history", async (request): Promise<ListInputHistoryResponse> => {
    const limit = normalizeLimit(request.query.limit);
    const entries = await service.listText({ limit });
    return {
      entries,
      total: entries.length,
      limit,
    };
  });
}

function normalizeLimit(limit: number | string | undefined): number {
  if (limit === undefined) return 100;
  const parsed = typeof limit === "string" ? Number.parseInt(limit, 10) : limit;
  if (!Number.isFinite(parsed)) return 100;
  return Math.max(0, Math.floor(parsed));
}
