/**
 * History routes
 *
 * Provides REST API for managing agent command history.
 * History is stored in memory for now (can be persisted later).
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { randomUUID } from "crypto";

/**
 * History entry structure (snake_case for API and storage)
 */
export interface HistoryEntry {
  id: string;
  agent_id?: string;
  command: string;
  timestamp: string;
  workspace_path?: string;
  exit_code?: number;
  duration?: number;
}

/**
 * History entry response structure (snake_case for API)
 */
interface HistoryEntryResponse {
  id: string;
  agent_id?: string;
  command: string;
  timestamp: string;
  workspace_path?: string;
  exit_code?: number;
  duration?: number;
}

/**
 * Transform history entry to response format (same fields, snake_case)
 */
function toResponseEntry(entry: HistoryEntry): HistoryEntryResponse {
  return {
    id: entry.id,
    agent_id: entry.agent_id,
    command: entry.command,
    timestamp: entry.timestamp,
    workspace_path: entry.workspace_path,
    exit_code: entry.exit_code,
    duration: entry.duration,
  };
}

/**
 * Query parameters for listing history
 */
interface ListHistoryQuery {
  limit?: number;
  offset?: number;
  agent_id?: string;
}

/**
 * Request body for creating a history entry
 */
interface CreateHistoryBody {
  agent_id?: string;
  command: string;
  workspace_path?: string;
  exit_code?: number;
  duration?: number;
}

/**
 * Response for list history endpoint
 */
interface ListHistoryResponse {
  entries: HistoryEntryResponse[];
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
    agent_id: data.agent_id,
    command: data.command,
    timestamp: new Date().toISOString(),
    workspace_path: data.workspace_path,
    exit_code: data.exit_code,
    duration: data.duration,
  };
}

/**
 * Get all history entries, optionally filtered by agent_id
 */
function getHistoryEntries(agentId?: string): HistoryEntry[] {
  const entries = Array.from(historyStore.values());
  if (agentId) {
    return entries.filter((entry) => entry.agent_id === agentId);
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
    const { limit = 100, offset = 0, agent_id: agentId } = request.query;

    const allEntries = getHistoryEntries(agentId);
    // Sort by timestamp descending (newest first)
    allEntries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const total = allEntries.length;
    const entries = allEntries.slice(offset, offset + limit);

    return {
      entries: entries.map(toResponseEntry),
      total,
      limit,
      offset,
    };
  });

  // Get a specific history entry by id
  fastify.get<{
    Params: { id: string };
  }>("/api/history/:id", async (request, reply): Promise<HistoryEntryResponse | { error: string }> => {
    const { id } = request.params;
    const entry = historyStore.get(id);

    if (!entry) {
      reply.code(404);
      return { error: `History entry not found: ${id}` };
    }

    return toResponseEntry(entry);
  });

  // Create a new history entry
  fastify.post<{
    Body: CreateHistoryBody;
  }>("/api/history", async (request, reply): Promise<HistoryEntryResponse | { error: string }> => {
    const body = request.body;

    if (!body.command) {
      reply.code(400);
      return { error: "Command is required" };
    }

    const entry = createHistoryEntry(body);
    historyStore.set(entry.id, entry);

    reply.code(201);
    return toResponseEntry(entry);
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
    Querystring: { agentId?: string; agent_id?: string };
  }>("/api/history", async (request): Promise<{ cleared: number; agent_id?: string }> => {
    // Support both camelCase and snake_case
    const agentId = request.query.agentId || request.query.agent_id;

    let clearedCount = 0;

    if (agentId) {
      // Clear only entries for the specified agent
      for (const [id, entry] of historyStore.entries()) {
        if (entry.agent_id === agentId) {
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
      ...(agentId ? { agent_id: agentId } : {}),
    };
  });
}
