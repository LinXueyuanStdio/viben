/**
 * Logging routes
 *
 * Provides HTTP API for session logs and API request logs.
 * Logs are stored in ~/.viben/logs/ directory.
 */
import type { FastifyInstance } from "fastify";
import { readFile, writeFile, mkdir, readdir, rm, unlink } from "node:fs/promises";
import { existsSync, statSync } from "node:fs";
import { join, basename } from "node:path";
import { homedir } from "node:os";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

// ============================================================================
// Types
// ============================================================================

interface LogEntry {
  id: string;
  timestamp: string;
  level: "info" | "warning" | "error" | "debug";
  message: string;
  source?: string;
}

interface LogSession {
  run_id: string;
  id: string;
  server_id: string;
  server_name: string;
  pid: number | null;
  created_at: string;
  updated_at: string;
  ended_at: string | null;
  log_file: string;
  log_count: number;
  error_count: number;
  started_at?: string;
}

interface LogSessionSummary {
  sessions: LogSession[];
  total_sessions: number;
}

interface ApiLogEntry {
  timestamp: string;
  run_id: string;
  api_key_hash: string | null;
  provider: string;
  source: string;
  method: "search" | "download" | "read";
  request: Record<string, unknown>;
  response: Record<string, unknown>;
  latency_ms: number;
  status: "success" | "error";
  error: string | null;
}

interface ApiLogSummary {
  run_id: string;
  total_requests: number;
  successful_requests: number;
  failed_requests: number;
  by_source: Record<string, number>;
  by_method: Record<string, number>;
  avg_latency_ms: number;
}

interface ApiLogSession {
  run_id: string;
  log_file: string;
  entry_count: number;
  created_at: string | null;
  last_entry_at: string | null;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get the logs directory path
 */
function getLogsDirPath(): string {
  const configDir = process.platform === "darwin"
    ? join(homedir(), "Library", "Application Support", "viben")
    : process.platform === "win32"
      ? join(process.env.APPDATA || join(homedir(), "AppData", "Roaming"), "viben")
      : join(homedir(), ".config", "viben");

  return join(configDir, "logs");
}

/**
 * Get the API logs directory path
 */
function getApiLogsDirPath(): string {
  return join(getLogsDirPath(), "api");
}

/**
 * Ensure logs directory exists
 */
async function ensureLogsDir(): Promise<void> {
  const logsDir = getLogsDirPath();
  if (!existsSync(logsDir)) {
    await mkdir(logsDir, { recursive: true });
  }

  const apiLogsDir = getApiLogsDirPath();
  if (!existsSync(apiLogsDir)) {
    await mkdir(apiLogsDir, { recursive: true });
  }
}

/**
 * Generate a unique ID
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Parse a log file and extract entries
 */
async function parseLogFile(filePath: string): Promise<LogEntry[]> {
  if (!existsSync(filePath)) {
    return [];
  }

  try {
    const content = await readFile(filePath, "utf-8");
    const lines = content.split("\n").filter((l) => l.trim());
    const entries: LogEntry[] = [];

    for (const line of lines) {
      try {
        const entry = JSON.parse(line) as LogEntry;
        if (!entry.id) {
          entry.id = generateId();
        }
        entries.push(entry);
      } catch {
        // If not JSON, create a simple entry
        entries.push({
          id: generateId(),
          timestamp: new Date().toISOString(),
          level: "info",
          message: line,
        });
      }
    }

    return entries;
  } catch {
    return [];
  }
}

/**
 * Get session metadata from log file
 */
async function getSessionFromFile(filePath: string): Promise<LogSession | null> {
  if (!existsSync(filePath)) {
    return null;
  }

  try {
    const entries = await parseLogFile(filePath);
    const stat = statSync(filePath);
    const runId = basename(filePath, ".log");

    let serverId = "unknown";
    let serverName = "Unknown Server";
    let pid: number | null = null;
    let errorCount = 0;

    // Extract metadata from entries
    for (const entry of entries) {
      if (entry.source) {
        serverId = entry.source;
        serverName = entry.source;
      }
      if (entry.level === "error") {
        errorCount++;
      }
    }

    return {
      run_id: runId,
      id: runId,
      server_id: serverId,
      server_name: serverName,
      pid,
      created_at: stat.birthtime.toISOString(),
      updated_at: stat.mtime.toISOString(),
      ended_at: null,
      log_file: filePath,
      log_count: entries.length,
      error_count: errorCount,
      started_at: stat.birthtime.toISOString(),
    };
  } catch {
    return null;
  }
}

/**
 * Get all log sessions
 */
async function getLogSessions(serverId?: string | null): Promise<LogSession[]> {
  const logsDir = getLogsDirPath();
  await ensureLogsDir();

  try {
    const files = await readdir(logsDir);
    const sessions: LogSession[] = [];

    for (const file of files) {
      if (!file.endsWith(".log")) continue;

      const filePath = join(logsDir, file);
      const stat = statSync(filePath);
      if (!stat.isFile()) continue;

      const session = await getSessionFromFile(filePath);
      if (session) {
        if (!serverId || session.server_id === serverId) {
          sessions.push(session);
        }
      }
    }

    // Sort by created_at descending
    sessions.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return sessions;
  } catch {
    return [];
  }
}

/**
 * Open directory in system file explorer
 */
async function openDirectory(dirPath: string): Promise<void> {
  if (process.platform === "darwin") {
    await execAsync(`open "${dirPath}"`);
  } else if (process.platform === "win32") {
    await execAsync(`explorer "${dirPath}"`);
  } else {
    await execAsync(`xdg-open "${dirPath}"`);
  }
}

// ============================================================================
// Routes
// ============================================================================

export function registerLogsRoutes(fastify: FastifyInstance): void {
  // ==========================================================================
  // Session Logs
  // ==========================================================================

  /**
   * Initialize logs system
   * POST /api/logs/init
   */
  fastify.post("/api/logs/init", async () => {
    await ensureLogsDir();
    return { initialized: true };
  });

  /**
   * Get logs directory path
   * GET /api/logs/dir
   */
  fastify.get("/api/logs/dir", async () => {
    return { path: getLogsDirPath() };
  });

  /**
   * Get all log sessions
   * GET /api/logs/sessions
   */
  fastify.get<{
    Querystring: { server_id?: string };
  }>("/api/logs/sessions", async (request) => {
    const { server_id } = request.query;
    const sessions = await getLogSessions(server_id || null);
    return {
      sessions,
      total_sessions: sessions.length,
    };
  });

  /**
   * Get logs for a specific session
   * GET /api/logs/session/:sessionId
   */
  fastify.get<{
    Params: { sessionId: string };
    Querystring: {
      level_filter?: string;
      limit?: string;
    };
  }>("/api/logs/session/:sessionId", async (request, reply) => {
    const { sessionId } = request.params;
    const { level_filter, limit } = request.query;

    const logsDir = getLogsDirPath();
    const filePath = join(logsDir, `${sessionId}.log`);

    if (!existsSync(filePath)) {
      reply.code(404);
      return { error: "Session not found" };
    }

    let entries = await parseLogFile(filePath);

    // Apply level filter
    if (level_filter && level_filter !== "all") {
      entries = entries.filter((e) => e.level === level_filter);
    }

    // Apply limit
    const maxEntries = limit ? parseInt(limit, 10) : 1000;
    if (entries.length > maxEntries) {
      entries = entries.slice(-maxEntries);
    }

    return entries;
  });

  /**
   * Add a log entry
   * POST /api/logs/add
   */
  fastify.post<{
    Body: {
      level: "info" | "warning" | "error" | "debug";
      message: string;
      source?: string;
      session_id?: string;
    };
  }>("/api/logs/add", async (request) => {
    const { level, message, source, session_id } = request.body;

    await ensureLogsDir();

    const sessionId = session_id || "default";
    const logsDir = getLogsDirPath();
    const filePath = join(logsDir, `${sessionId}.log`);

    const entry: LogEntry = {
      id: generateId(),
      timestamp: new Date().toISOString(),
      level,
      message,
      source,
    };

    // Append to log file
    const line = JSON.stringify(entry) + "\n";
    await writeFile(filePath, line, { flag: "a" });

    return { added: true };
  });

  /**
   * Clear logs for a session
   * DELETE /api/logs/session/:sessionId
   */
  fastify.delete<{
    Params: { sessionId: string };
  }>("/api/logs/session/:sessionId", async (request, reply) => {
    const { sessionId } = request.params;

    const logsDir = getLogsDirPath();
    const filePath = join(logsDir, `${sessionId}.log`);

    if (!existsSync(filePath)) {
      reply.code(404);
      return { error: "Session not found" };
    }

    await unlink(filePath);
    return { deleted: sessionId };
  });

  /**
   * Clear all logs
   * DELETE /api/logs
   */
  fastify.delete("/api/logs", async () => {
    const logsDir = getLogsDirPath();

    if (existsSync(logsDir)) {
      const files = await readdir(logsDir);
      for (const file of files) {
        if (file.endsWith(".log")) {
          await unlink(join(logsDir, file));
        }
      }
    }

    return { cleared: true };
  });

  /**
   * Cleanup old sessions
   * POST /api/logs/cleanup
   */
  fastify.post<{
    Body: { keep_count?: number };
  }>("/api/logs/cleanup", async (request) => {
    const { keep_count = 10 } = request.body;

    const sessions = await getLogSessions();
    const toDelete = sessions.slice(keep_count);
    let deleted = 0;

    for (const session of toDelete) {
      try {
        await unlink(session.log_file);
        deleted++;
      } catch {
        // Ignore errors
      }
    }

    return { deleted };
  });

  /**
   * Export session logs
   * POST /api/logs/session/:sessionId/export
   */
  fastify.post<{
    Params: { sessionId: string };
    Body: { export_path: string };
  }>("/api/logs/session/:sessionId/export", async (request, reply) => {
    const { sessionId } = request.params;
    const { export_path } = request.body;

    const logsDir = getLogsDirPath();
    const sourcePath = join(logsDir, `${sessionId}.log`);

    if (!existsSync(sourcePath)) {
      reply.code(404);
      return { error: "Session not found" };
    }

    const content = await readFile(sourcePath, "utf-8");
    await writeFile(export_path, content, "utf-8");

    return { exported: export_path };
  });

  // ==========================================================================
  // API Logs
  // ==========================================================================

  /**
   * Get API logs directory path
   * GET /api/api-logs/dir
   */
  fastify.get("/api/api-logs/dir", async () => {
    return { path: getApiLogsDirPath() };
  });

  /**
   * Get all API log sessions
   * GET /api/api-logs/sessions
   */
  fastify.get("/api/api-logs/sessions", async () => {
    const apiLogsDir = getApiLogsDirPath();
    await ensureLogsDir();

    try {
      const files = await readdir(apiLogsDir);
      const sessions: ApiLogSession[] = [];

      for (const file of files) {
        if (!file.endsWith(".jsonl")) continue;

        const filePath = join(apiLogsDir, file);
        const stat = statSync(filePath);
        if (!stat.isFile()) continue;

        const runId = basename(file, ".jsonl");
        const content = await readFile(filePath, "utf-8");
        const lines = content.split("\n").filter((l) => l.trim());

        let firstTimestamp: string | null = null;
        let lastTimestamp: string | null = null;

        if (lines.length > 0) {
          try {
            const first = JSON.parse(lines[0]) as ApiLogEntry;
            firstTimestamp = first.timestamp;

            const last = JSON.parse(lines[lines.length - 1]) as ApiLogEntry;
            lastTimestamp = last.timestamp;
          } catch {
            // Ignore parse errors
          }
        }

        sessions.push({
          run_id: runId,
          log_file: filePath,
          entry_count: lines.length,
          created_at: firstTimestamp,
          last_entry_at: lastTimestamp,
        });
      }

      // Sort by created_at descending
      sessions.sort((a, b) => {
        const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
        return bTime - aTime;
      });

      return sessions;
    } catch {
      return [];
    }
  });

  /**
   * Get API logs for a specific run
   * GET /api/api-logs/:runId
   */
  fastify.get<{
    Params: { runId: string };
    Querystring: {
      limit?: string;
      offset?: string;
      provider_filter?: string;
      source_filter?: string;
      status_filter?: string;
      method_filter?: string;
    };
  }>("/api/api-logs/:runId", async (request, reply) => {
    const { runId } = request.params;
    const { limit, offset, provider_filter, source_filter, status_filter, method_filter } = request.query;

    const apiLogsDir = getApiLogsDirPath();
    const filePath = join(apiLogsDir, `${runId}.jsonl`);

    if (!existsSync(filePath)) {
      reply.code(404);
      return { error: "Run not found" };
    }

    const content = await readFile(filePath, "utf-8");
    const lines = content.split("\n").filter((l) => l.trim());
    let entries: ApiLogEntry[] = [];

    for (const line of lines) {
      try {
        const entry = JSON.parse(line) as ApiLogEntry;
        entries.push(entry);
      } catch {
        // Ignore parse errors
      }
    }

    // Apply filters
    if (provider_filter) {
      entries = entries.filter((e) => e.provider === provider_filter);
    }
    if (source_filter) {
      entries = entries.filter((e) => e.source === source_filter);
    }
    if (status_filter) {
      entries = entries.filter((e) => e.status === status_filter);
    }
    if (method_filter) {
      entries = entries.filter((e) => e.method === method_filter);
    }

    // Apply pagination
    const offsetNum = offset ? parseInt(offset, 10) : 0;
    const limitNum = limit ? parseInt(limit, 10) : 1000;
    entries = entries.slice(offsetNum, offsetNum + limitNum);

    return entries;
  });

  /**
   * Get API log summary for a run
   * GET /api/api-logs/:runId/summary
   */
  fastify.get<{
    Params: { runId: string };
  }>("/api/api-logs/:runId/summary", async (request, reply) => {
    const { runId } = request.params;

    const apiLogsDir = getApiLogsDirPath();
    const filePath = join(apiLogsDir, `${runId}.jsonl`);

    if (!existsSync(filePath)) {
      reply.code(404);
      return { error: "Run not found" };
    }

    const content = await readFile(filePath, "utf-8");
    const lines = content.split("\n").filter((l) => l.trim());
    const entries: ApiLogEntry[] = [];

    for (const line of lines) {
      try {
        const entry = JSON.parse(line) as ApiLogEntry;
        entries.push(entry);
      } catch {
        // Ignore parse errors
      }
    }

    const bySource: Record<string, number> = {};
    const byMethod: Record<string, number> = {};
    let successCount = 0;
    let totalLatency = 0;

    for (const entry of entries) {
      bySource[entry.source] = (bySource[entry.source] || 0) + 1;
      byMethod[entry.method] = (byMethod[entry.method] || 0) + 1;
      if (entry.status === "success") {
        successCount++;
      }
      totalLatency += entry.latency_ms;
    }

    const summary: ApiLogSummary = {
      run_id: runId,
      total_requests: entries.length,
      successful_requests: successCount,
      failed_requests: entries.length - successCount,
      by_source: bySource,
      by_method: byMethod,
      avg_latency_ms: entries.length > 0 ? totalLatency / entries.length : 0,
    };

    return summary;
  });

  /**
   * Clear API logs for a run
   * DELETE /api/api-logs/:runId
   */
  fastify.delete<{
    Params: { runId: string };
  }>("/api/api-logs/:runId", async (request, reply) => {
    const { runId } = request.params;

    const apiLogsDir = getApiLogsDirPath();
    const filePath = join(apiLogsDir, `${runId}.jsonl`);

    if (!existsSync(filePath)) {
      reply.code(404);
      return { error: "Run not found" };
    }

    await unlink(filePath);
    return { deleted: runId };
  });

  /**
   * Open API logs directory
   * POST /api/api-logs/open
   */
  fastify.post("/api/api-logs/open", async (reply) => {
    const apiLogsDir = getApiLogsDirPath();
    await ensureLogsDir();
    await openDirectory(apiLogsDir);
    return { opened: apiLogsDir };
  });
}
