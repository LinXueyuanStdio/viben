/**
 * Executor session management endpoints
 *
 * Provides APIs to discover and read sessions from executor-specific locations:
 * - Claude Code: ~/.claude/projects/<encoded-path>/<session-id>.jsonl
 * - Codex: similar structure (TBD)
 */
import type { FastifyInstance } from "fastify";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import * as readline from "node:readline";

/**
 * Executor session discovered from file system
 */
interface ExecutorSession {
  /** Session ID (UUID format) */
  id: string;
  /** Executor type (claude-code, codex, etc.) */
  executorType: string;
  /** Workspace path this session belongs to */
  workspacePath: string;
  /** When the session was created */
  createdAt: string;
  /** When the session was last updated */
  updatedAt: string;
  /** Optional session name or description */
  name?: string;
  /** Number of messages in the session (estimated) */
  messageCount?: number;
}

/**
 * UI message converted from Claude Code format
 */
interface ExecutorUIMessage {
  id: string;
  timestamp: string;
  type: string;
  content?: string;
  toolUseId?: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  toolOutput?: string;
  isError?: boolean;
  subagentId?: string;
  subagentMessages?: ExecutorUIMessage[];
}

/**
 * Encode a workspace path to Claude's project folder format
 * /Users/foo/bar -> -Users-foo-bar
 */
function encodeWorkspacePath(workspacePath: string): string {
  return workspacePath.replace(/\//g, "-");
}

/**
 * Get the Claude Code projects directory
 */
function getClaudeProjectsDir(): string {
  return path.join(os.homedir(), ".claude", "projects");
}

/**
 * Discover sessions from Claude Code's project directory
 */
async function discoverClaudeCodeSessions(workspacePath: string): Promise<ExecutorSession[]> {
  const projectsDir = getClaudeProjectsDir();
  const encodedPath = encodeWorkspacePath(workspacePath);
  const sessionDir = path.join(projectsDir, encodedPath);

  if (!fs.existsSync(sessionDir)) {
    return [];
  }

  const sessions: ExecutorSession[] = [];
  const entries = await fs.promises.readdir(sessionDir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith(".jsonl")) {
      const sessionId = entry.name.replace(".jsonl", "");
      const filePath = path.join(sessionDir, entry.name);
      const stats = await fs.promises.stat(filePath);

      // Read first user message for preview/name
      const name = await readFirstUserMessage(filePath);

      sessions.push({
        id: sessionId,
        executorType: "claude-code",
        workspacePath,
        createdAt: stats.birthtime.toISOString(),
        updatedAt: stats.mtime.toISOString(),
        name,
        messageCount: Math.floor(stats.size / 1024), // Rough estimate
      });
    }
  }

  // Sort by updated_at (newest first)
  sessions.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  return sessions;
}

/**
 * Read the first user message from a Claude Code session file
 */
async function readFirstUserMessage(filePath: string): Promise<string | undefined> {
  try {
    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    for await (const line of rl) {
      if (line.trim() === "") continue;
      try {
        const msg = JSON.parse(line);
        if (msg.type === "user" && msg.message?.content) {
          const content = typeof msg.message.content === "string"
            ? msg.message.content
            : JSON.stringify(msg.message.content);
          const preview = content.substring(0, 100);
          return content.length > 100 ? `${preview}...` : preview;
        }
      } catch {
        // Invalid JSON line, skip
      }
    }
  } catch {
    // File read error
  }
  return undefined;
}

/**
 * Read messages from a Claude Code session file
 */
async function readClaudeCodeSessionMessages(
  filePath: string,
  limit?: number
): Promise<ExecutorUIMessage[]> {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Session file not found: ${filePath}`);
  }

  const messages: ExecutorUIMessage[] = [];
  const taskAgentMap = new Map<string, string>();

  // Read all lines
  const content = await fs.promises.readFile(filePath, "utf-8");
  const lines = content.split("\n").filter((line) => line.trim() !== "");

  // First pass: extract agentId mappings from progress messages
  for (const line of lines) {
    try {
      const msg = JSON.parse(line);
      if (msg.type === "progress") {
        const data = msg.data;
        if (data?.type === "agent_progress" && data.agentId && msg.parentToolUseID) {
          taskAgentMap.set(msg.parentToolUseID, data.agentId);
        }
      }
    } catch {
      // Invalid JSON line, skip
    }
  }

  // Second pass: convert messages
  for (const line of lines) {
    try {
      const msg = JSON.parse(line);
      const uiMsgs = convertClaudeMessageToUI(msg);

      // Add subagent_id for Task tool calls
      for (const uiMsg of uiMsgs) {
        if (uiMsg.type === "tool_use" && uiMsg.toolName === "Task" && uiMsg.toolUseId) {
          const agentId = taskAgentMap.get(uiMsg.toolUseId);
          if (agentId) {
            uiMsg.subagentId = agentId;
          }
        }
      }

      messages.push(...uiMsgs);

      if (limit && messages.length >= limit) {
        break;
      }
    } catch {
      // Invalid JSON line, skip
    }
  }

  return messages;
}

/**
 * Convert a Claude Code message to UI message format
 */
function convertClaudeMessageToUI(msg: Record<string, unknown>): ExecutorUIMessage[] {
  const baseId = (msg.uuid as string) || crypto.randomUUID();
  const timestamp = (msg.timestamp as string) || new Date().toISOString();
  const msgType = msg.type as string;

  switch (msgType) {
    case "user": {
      const message = msg.message as { content?: string | Array<{ type: string; [key: string]: unknown }> } | undefined;
      if (!message) return [];

      if (typeof message.content === "string") {
        return [{
          id: baseId,
          timestamp,
          type: "user",
          content: message.content,
        }];
      }

      if (Array.isArray(message.content)) {
        return message.content
          .filter((block) => block.type === "tool_result")
          .map((block, i) => ({
            id: `${baseId}-${i}`,
            timestamp,
            type: "tool_result",
            content: block.content as string | undefined,
            toolUseId: block.tool_use_id as string,
            isError: block.is_error as boolean | undefined,
          }));
      }
      return [];
    }

    case "assistant": {
      const message = msg.message as { content?: Array<{ type: string; [key: string]: unknown }> } | undefined;
      if (!message?.content || !Array.isArray(message.content)) return [];

      return message.content
        .map((block, i) => {
          switch (block.type) {
            case "thinking":
              return {
                id: `${baseId}-${i}`,
                timestamp,
                type: "thinking",
                content: (block.thinking as string) || (block.content as string),
              };
            case "text":
              if (!(block.text as string)) return null;
              return {
                id: `${baseId}-${i}`,
                timestamp,
                type: "text",
                content: block.text as string,
              };
            case "tool_use":
              return {
                id: `${baseId}-${i}`,
                timestamp,
                type: "tool_use",
                toolUseId: block.id as string,
                toolName: block.name as string,
                toolInput: block.input as Record<string, unknown>,
              };
            default:
              return null;
          }
        })
        .filter((m): m is ExecutorUIMessage => m !== null);
    }

    case "result": {
      const result = (msg as Record<string, unknown>).result as string | undefined;
      const subtype = (msg as Record<string, unknown>).subtype as string | undefined;
      return [{
        id: baseId,
        timestamp,
        type: "text",
        content: result || (subtype ? `[${subtype}]` : undefined),
      }];
    }

    // Skip progress, queue-operation, init, file-history-snapshot
    default:
      return [];
  }
}

/**
 * Register executor routes
 */
export function registerExecutorRoutes(fastify: FastifyInstance): void {
  // List executors (workspace-scoped)
  fastify.get<{
    Querystring: { workspacePath?: string; includeGlobal?: boolean };
  }>("/api/executors", async (request) => {
    const workspacePath = request.query.workspacePath || os.homedir();
    const includeGlobal = request.query.includeGlobal !== false;

    // TODO: Implement workspace-scoped executor discovery
    // For now, return Claude Code as the only executor
    const executors = [
      {
        type: "claude-code",
        name: "Claude Code",
        available: true,
        version: "unknown",
      },
    ];

    return { executors, workspacePath, includeGlobal };
  });

  // Discover sessions for an executor type
  fastify.get<{
    Params: { type: string };
    Querystring: { workspacePath: string };
  }>("/api/executors/:type/discover-sessions", async (request, reply) => {
    const { type } = request.params;
    const { workspacePath } = request.query;

    if (!workspacePath) {
      reply.code(400);
      return { error: "workspace_path query parameter is required" };
    }

    let sessions: ExecutorSession[] = [];

    switch (type.toLowerCase().replace(/_|-/g, "")) {
      case "claudecode":
        sessions = await discoverClaudeCodeSessions(workspacePath);
        break;
      case "codex":
        // TODO: Implement Codex session discovery
        sessions = [];
        break;
      default:
        reply.code(404);
        return { error: `Unknown executor type: ${type}` };
    }

    return { sessions, total: sessions.length };
  });

  // Get messages from an executor session
  fastify.get<{
    Params: { type: string; sessionId: string };
    Querystring: { workspacePath: string; limit?: number };
  }>("/api/executors/:type/sessions/:sessionId/messages", async (request, reply) => {
    const { type, sessionId } = request.params;
    const { workspacePath, limit } = request.query;

    if (!workspacePath) {
      reply.code(400);
      return { error: "workspace_path query parameter is required" };
    }

    let messages: ExecutorUIMessage[] = [];

    switch (type.toLowerCase().replace(/_|-/g, "")) {
      case "claudecode": {
        const projectsDir = getClaudeProjectsDir();
        const encodedPath = encodeWorkspacePath(workspacePath);
        const filePath = path.join(projectsDir, encodedPath, `${sessionId}.jsonl`);
        messages = await readClaudeCodeSessionMessages(filePath, limit);
        break;
      }
      case "codex":
        // TODO: Implement Codex message reading
        messages = [];
        break;
      default:
        reply.code(404);
        return { error: `Unknown executor type: ${type}` };
    }

    return { messages, total: messages.length };
  });
}
