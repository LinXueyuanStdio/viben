/**
 * History routes
 *
 * Provides REST API for managing agent command history.
 * History is stored in memory for now (can be persisted later).
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { randomUUID } from "crypto";

/**
 * History entry structure
 */
export interface HistoryEntry {
  id: string;
  agentId?: string;
  command: string;
  timestamp: string;
  workspacePath?: string;
  exitCode?: number;
  duration?: number;
}

/**
 * Query parameters for listing history
 */
interface ListHistoryQuery {
  limit?: number;
  offset?: number;
  agentId?: string;
}

/**
 * Request body for creating a history entry
 */
interface CreateHistoryBody {
  agentId?: string;
  command: string;
  workspacePath?: string;
  exitCode?: number;
  duration?: number;
}

/**
 * Response for list history endpoint
 */
interface ListHistoryResponse {
  entries: HistoryEntry[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * In-memory history storage
 */
const historyStore: Map<string, HistoryEntry> = new Map();

/**
 * Generate a new history entry with auto-generated id and timestamp
 */
function createHistoryEntry(data: CreateHistoryBody): HistoryEntry {
  return {
    id: randomUUID(),
    agentId: data.agentId,
    command: data.command,
    timestamp: new Date().toISOString(),
    workspacePath: data.workspacePath,
    exitCode: data.exitCode,
    duration: data.duration,
  };
}

/**
 * Get all history entries, optionally filtered by agentId
 */
function getHistoryEntries(agentId?: string): HistoryEntry[] {
  const entries = Array.from(historyStore.values());
  if (agentId) {
    return entries.filter((entry) => entry.agentId === agentId);
  }
  return entries;
}

/**
 * Register history routes
 */
export function registerHistoryRoutes(fastify: FastifyInstance): void {
  // List history entries with pagination and optional agentId filter
  fastify.get<{
    Querystring: ListHistoryQuery;
  }>("/api/history", async (request): Promise<ListHistoryResponse> => {
    const { limit = 100, offset = 0, agentId } = request.query;

    const allEntries = getHistoryEntries(agentId);
    // Sort by timestamp descending (newest first)
    allEntries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const total = allEntries.length;
    const entries = allEntries.slice(offset, offset + limit);

    return {
      entries,
      total,
      limit,
      offset,
    };
  });

  // Get a specific history entry by id
  fastify.get<{
    Params: { id: string };
  }>("/api/history/:id", async (request, reply): Promise<HistoryEntry | { error: string }> => {
    const { id } = request.params;
    const entry = historyStore.get(id);

    if (!entry) {
      reply.code(404);
      return { error: `History entry not found: ${id}` };
    }

    return entry;
  });

  // Create a new history entry
  fastify.post<{
    Body: CreateHistoryBody;
  }>("/api/history", async (request, reply): Promise<HistoryEntry | { error: string }> => {
    const body = request.body;

    if (!body.command) {
      reply.code(400);
      return { error: "Command is required" };
    }

    const entry = createHistoryEntry(body);
    historyStore.set(entry.id, entry);

    reply.code(201);
    return entry;
  });

  // Delete a specific history entry
  fastify.delete<{
    Params: { id: string };
  }>("/api/history/:id", async (request, reply): Promise<{ deleted: string } | { error: string }> => {
    const { id } = request.params;

    if (!historyStore.has(id)) {
      reply.code(404);
      return { error: `History entry not found: ${id}` };
    }

    historyStore.delete(id);
    return { deleted: id };
  });

  // Clear all history (with optional agentId filter)
  fastify.delete<{
    Querystring: { agentId?: string };
  }>("/api/history", async (request): Promise<{ cleared: number; agentId?: string }> => {
    const { agentId } = request.query;

    let clearedCount = 0;

    if (agentId) {
      // Clear only entries for the specified agent
      for (const [id, entry] of historyStore.entries()) {
        if (entry.agentId === agentId) {
          historyStore.delete(id);
          clearedCount++;
        }
      }
    } else {
      // Clear all entries
      clearedCount = historyStore.size;
      historyStore.clear();
    }

    return {
      cleared: clearedCount,
      ...(agentId ? { agentId } : {}),
    };
  });
}
