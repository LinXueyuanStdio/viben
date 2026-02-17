/**
 * Executor management endpoints
 *
 * Provides APIs for:
 * - Executor discovery and availability checking
 * - Session management (Claude Code, Codex, etc.)
 * - MCP server configuration
 * - Skills configuration
 * - Agent configs (prompts from .claude/agents/*.md)
 * - Commands (slash commands from .claude/commands/)
 *
 * URL structure: /api/executors/:type/<resource>?workspace_path=...
 */
import type { FastifyInstance } from "fastify";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import * as readline from "node:readline";

import type { ExecutorType } from "../../types/index.js";

/**
 * Executor session discovered from file system (snake_case to match Rust gateway)
 */
interface ExecutorSession {
  /** Session ID (UUID format) */
  id: string;
  /** Executor type (claude-code, codex, etc.) */
  executor_type: string;
  /** Workspace path this session belongs to */
  workspace_path: string;
  /** When the session was created */
  created_at: string;
  /** When the session was last updated */
  updated_at: string;
  /** Optional session name or description */
  name?: string;
  /** Number of messages in the session (estimated) */
  message_count?: number;
}

/**
 * UI message converted from Claude Code format (snake_case to match Rust gateway)
 */
interface ExecutorUIMessage {
  id: string;
  timestamp: string;
  type: string;
  content?: string;
  tool_use_id?: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  tool_output?: string;
  is_error?: boolean;
  subagent_id?: string;
  subagent_messages?: ExecutorUIMessage[];
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
        executor_type: "claude-code",
        workspace_path: workspacePath,
        created_at: stats.birthtime.toISOString(),
        updated_at: stats.mtime.toISOString(),
        name,
        message_count: Math.floor(stats.size / 1024), // Rough estimate
      });
    }
  }

  // Sort by updated_at (newest first)
  sessions.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

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
        if (uiMsg.type === "tool_use" && uiMsg.tool_name === "Task" && uiMsg.tool_use_id) {
          const agentId = taskAgentMap.get(uiMsg.tool_use_id);
          if (agentId) {
            uiMsg.subagent_id = agentId;
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
            tool_use_id: block.tool_use_id as string,
            is_error: block.is_error as boolean | undefined,
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
                tool_use_id: block.id as string,
                tool_name: block.name as string,
                tool_input: block.input as Record<string, unknown>,
              };
            default:
              return null;
          }
        })
        .filter((m): m is NonNullable<typeof m> => m !== null) as ExecutorUIMessage[];
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

// ============================================================================
// Codex Session Discovery and Message Reading
// ============================================================================

/**
 * Get the Codex sessions directory (platform-specific)
 */
function getCodexSessionsDir(): string {
  if (process.platform === "darwin") {
    return path.join(os.homedir(), "Library", "Application Support", "codex", "sessions");
  } else if (process.platform === "win32") {
    return path.join(process.env.APPDATA || "", "codex", "sessions");
  } else {
    return path.join(os.homedir(), ".config", "codex", "sessions");
  }
}

/**
 * Discover sessions from Codex's session directory
 * Note: Codex session format is assumed to be similar to Claude Code (JSONL).
 * If Codex uses a different format, this function should be updated accordingly.
 */
async function discoverCodexSessions(workspacePath: string): Promise<ExecutorSession[]> {
  const sessionsDir = getCodexSessionsDir();

  if (!fs.existsSync(sessionsDir)) {
    return [];
  }

  const sessions: ExecutorSession[] = [];

  try {
    const entries = await fs.promises.readdir(sessionsDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith(".jsonl")) {
        const sessionId = entry.name.replace(".jsonl", "");
        const filePath = path.join(sessionsDir, entry.name);
        const stats = await fs.promises.stat(filePath);

        // Try to get first user message for preview
        const name = await readFirstUserMessage(filePath);

        sessions.push({
          id: sessionId,
          executor_type: "codex",
          workspace_path: workspacePath,
          created_at: stats.birthtime.toISOString(),
          updated_at: stats.mtime.toISOString(),
          name,
          message_count: Math.floor(stats.size / 1024), // Rough estimate
        });
      }
    }

    // Sort by updated_at (newest first)
    sessions.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  } catch {
    // Directory read error, return empty
  }

  return sessions;
}

/**
 * Read messages from a Codex session file
 * Assumes JSONL format similar to Claude Code. If Codex uses a different format,
 * this function should be updated to handle it appropriately.
 */
async function readCodexSessionMessages(
  filePath: string,
  limit?: number
): Promise<ExecutorUIMessage[]> {
  if (!fs.existsSync(filePath)) {
    return [];
  }

  const messages: ExecutorUIMessage[] = [];

  try {
    const content = await fs.promises.readFile(filePath, "utf-8");
    const lines = content.split("\n").filter((line) => line.trim() !== "");

    for (const line of lines) {
      try {
        const msg = JSON.parse(line);
        // Attempt to convert using similar logic to Claude Code
        // Adjust based on actual Codex message format when documented
        const uiMsgs = convertCodexMessageToUI(msg);
        messages.push(...uiMsgs);

        if (limit && messages.length >= limit) {
          break;
        }
      } catch {
        // Invalid JSON line, skip
      }
    }
  } catch {
    // File read error
  }

  return messages;
}

/**
 * Convert a Codex message to UI message format
 * This is a best-effort conversion assuming similar format to Claude Code.
 * Update when actual Codex message format is documented.
 */
function convertCodexMessageToUI(msg: Record<string, unknown>): ExecutorUIMessage[] {
  const baseId = (msg.uuid as string) || (msg.id as string) || crypto.randomUUID();
  const timestamp = (msg.timestamp as string) || new Date().toISOString();
  const msgType = msg.type as string;

  switch (msgType) {
    case "user": {
      const content = msg.content as string | undefined;
      const message = msg.message as { content?: string } | undefined;
      const textContent = content || message?.content;
      if (!textContent) return [];

      return [{
        id: baseId,
        timestamp,
        type: "user",
        content: textContent,
      }];
    }

    case "assistant": {
      const content = msg.content as string | undefined;
      const message = msg.message as { content?: string } | undefined;
      const textContent = content || message?.content;
      if (!textContent) return [];

      return [{
        id: baseId,
        timestamp,
        type: "text",
        content: textContent,
      }];
    }

    default:
      return [];
  }
}

/**
 * Executor info for discovery response
 */
interface ExecutorInfo {
  type: string;
  name: string;
  available: boolean;
  version?: string;
  config_path?: string;
}

/**
 * Check if Claude Code is available by looking for ~/.claude.json
 */
function checkClaudeCodeAvailability(): ExecutorInfo {
  const configPath = path.join(os.homedir(), ".claude.json");
  const available = fs.existsSync(configPath);
  return {
    type: "claude-code",
    name: "Claude Code",
    available,
    config_path: available ? configPath : undefined,
  };
}

/**
 * Check if Codex (OpenAI) is available
 */
function checkCodexAvailability(): ExecutorInfo {
  // Check platform-specific config paths
  let configDir: string;
  if (process.platform === "darwin") {
    configDir = path.join(os.homedir(), "Library", "Application Support", "codex");
  } else if (process.platform === "win32") {
    configDir = path.join(process.env.APPDATA || "", "codex");
  } else {
    configDir = path.join(os.homedir(), ".config", "codex");
  }
  const configPath = path.join(configDir, "config.json");
  const available = fs.existsSync(configPath);
  return {
    type: "codex",
    name: "Codex (OpenAI)",
    available,
    config_path: available ? configPath : undefined,
  };
}

/**
 * Check if Cursor is available
 */
function checkCursorAvailability(): ExecutorInfo {
  let configDir: string;
  if (process.platform === "darwin") {
    configDir = path.join(os.homedir(), "Library", "Application Support", "Cursor", "User");
  } else if (process.platform === "win32") {
    configDir = path.join(process.env.APPDATA || "", "Cursor", "User");
  } else {
    configDir = path.join(os.homedir(), ".config", "Cursor", "User");
  }
  const available = fs.existsSync(configDir);
  return {
    type: "cursor",
    name: "Cursor",
    available,
    config_path: available ? configDir : undefined,
  };
}

/**
 * Check if Gemini CLI is available
 */
function checkGeminiAvailability(): ExecutorInfo {
  const configPath = path.join(os.homedir(), ".gemini", "config.json");
  const available = fs.existsSync(configPath);
  return {
    type: "gemini",
    name: "Gemini",
    available,
    config_path: available ? configPath : undefined,
  };
}

/**
 * Check if AMP is available
 */
function checkAmpAvailability(): ExecutorInfo {
  let configDir: string;
  if (process.platform === "darwin") {
    configDir = path.join(os.homedir(), "Library", "Application Support", "amp");
  } else if (process.platform === "win32") {
    configDir = path.join(process.env.APPDATA || "", "amp");
  } else {
    configDir = path.join(os.homedir(), ".config", "amp");
  }
  const configPath = path.join(configDir, "settings.json");
  const available = fs.existsSync(configPath);
  return {
    type: "amp",
    name: "AMP",
    available,
    config_path: available ? configPath : undefined,
  };
}

/**
 * Discover all available executors
 */
function discoverExecutors(): ExecutorInfo[] {
  const executors: ExecutorInfo[] = [
    checkClaudeCodeAvailability(),
    checkCodexAvailability(),
    checkCursorAvailability(),
    checkGeminiAvailability(),
    checkAmpAvailability(),
  ];
  return executors;
}

/**
 * Register executor routes
 */
export function registerExecutorRoutes(fastify: FastifyInstance): void {
  // List executors (workspace-scoped)
  fastify.get<{
    Querystring: { workspace_path?: string; include_global?: boolean };
  }>("/api/executors", async (request) => {
    const workspacePath = request.query.workspace_path || os.homedir();
    const includeGlobal = request.query.include_global !== false;

    // Discover available executors
    const executors = discoverExecutors();

    return { executors, workspacePath, includeGlobal };
  });

  // Discover sessions for an executor type
  fastify.get<{
    Params: { type: string };
    Querystring: { workspace_path: string };
  }>("/api/executors/:type/discover-sessions", async (request, reply) => {
    const { type } = request.params;
    const { workspace_path: workspacePath } = request.query;

    if (!workspacePath) {
      reply.code(400);
      return { error: "workspace_path query parameter is required" };
    }

    let sessions: ExecutorSession[] = [];
    const executorType = type as ExecutorType;

    switch (executorType) {
      case "CLAUDE_CODE":
        sessions = await discoverClaudeCodeSessions(workspacePath);
        break;
      case "CODEX":
        // Codex session discovery - similar to Claude Code pattern
        // Codex stores sessions in ~/.config/codex/sessions/ or platform-specific location
        sessions = await discoverCodexSessions(workspacePath);
        break;
      default:
        reply.code(404);
        return { error: `Unknown executor type: ${type}. Use uppercase format like CLAUDE_CODE` };
    }

    return { sessions, total: sessions.length };
  });

  // Get messages from an executor session
  fastify.get<{
    Params: { type: string; sessionId: string };
    Querystring: { workspace_path: string; limit?: number };
  }>("/api/executors/:type/sessions/:sessionId/messages", async (request, reply) => {
    const { type, sessionId } = request.params;
    const { workspace_path: workspacePath, limit } = request.query;

    if (!workspacePath) {
      reply.code(400);
      return { error: "workspace_path query parameter is required" };
    }

    let messages: ExecutorUIMessage[] = [];
    const executorType = type as ExecutorType;

    switch (executorType) {
      case "CLAUDE_CODE": {
        const projectsDir = getClaudeProjectsDir();
        const encodedPath = encodeWorkspacePath(workspacePath);
        const filePath = path.join(projectsDir, encodedPath, `${sessionId}.jsonl`);
        messages = await readClaudeCodeSessionMessages(filePath, limit);
        break;
      }
      case "CODEX": {
        // Codex message reading - similar to Claude Code pattern
        const codexSessionDir = getCodexSessionsDir();
        const codexFilePath = path.join(codexSessionDir, `${sessionId}.jsonl`);
        if (fs.existsSync(codexFilePath)) {
          messages = await readCodexSessionMessages(codexFilePath, limit);
        }
        break;
      }
      default:
        reply.code(404);
        return { error: `Unknown executor type: ${type}. Use uppercase format like CLAUDE_CODE` };
    }

    return { messages, total: messages.length };
  });

  // ==========================================================================
  // MCP Servers
  // ==========================================================================

  /**
   * Get MCP config path based on executor type
   * Only accepts uppercase underscore format: CLAUDE_CODE, CURSOR_AGENT, etc.
   */
  function getMcpConfigPath(workspacePath: string | undefined, executorType: ExecutorType): string | null {
    const base = workspacePath || os.homedir();

    switch (executorType) {
      case "CLAUDE_CODE":
        // Claude Code: project-level .mcp.json or global ~/.claude.json
        const projectMcp = path.join(base, ".mcp.json");
        if (fs.existsSync(projectMcp)) return projectMcp;
        return path.join(os.homedir(), ".claude.json");
      case "CURSOR_AGENT":
        // Cursor: .cursor/mcp.json
        return path.join(base, ".cursor", "mcp.json");
      default:
        // Generic: .viben/mcp.json
        return path.join(base, ".viben", "mcp.json");
    }
  }

  /**
   * Parse MCP servers from config file
   * Only accepts uppercase underscore format: CLAUDE_CODE, CURSOR_AGENT, etc.
   */
  function parseMcpServers(configPath: string, executorType: ExecutorType): Array<{
    name: string;
    command?: string;
    args?: string[];
    env?: Record<string, string>;
    url?: string;
    transport?: string;
    headers?: Record<string, string>;
    disabled?: boolean;
  }> {
    if (!fs.existsSync(configPath)) {
      return [];
    }

    try {
      const content = fs.readFileSync(configPath, "utf-8");
      const config = JSON.parse(content);

      // Claude Code format: { mcpServers: { name: config } }
      if (executorType === "CLAUDE_CODE") {
        const mcpServers = config.mcpServers || {};
        return Object.entries(mcpServers).map(([name, serverConfig]) => ({
          name,
          ...(serverConfig as Record<string, unknown>),
        }));
      }

      // Generic format: { servers: [...] } or { mcpServers: { name: config } }
      if (config.servers && Array.isArray(config.servers)) {
        return config.servers;
      }
      if (config.mcpServers) {
        return Object.entries(config.mcpServers).map(([name, serverConfig]) => ({
          name,
          ...(serverConfig as Record<string, unknown>),
        }));
      }

      return [];
    } catch {
      return [];
    }
  }

  /**
   * GET /api/executors/:type/mcp-servers?workspace_path=...
   */
  fastify.get<{
    Params: { type: string };
    Querystring: { workspace_path?: string };
  }>("/api/executors/:type/mcp-servers", async (request) => {
    const { type } = request.params;
    const { workspace_path } = request.query;

    const executorType = type as ExecutorType;
    const configPath = getMcpConfigPath(workspace_path, executorType);
    if (!configPath) {
      return { servers: [], total: 0 };
    }

    const servers = parseMcpServers(configPath, executorType);
    return { servers, total: servers.length };
  });

  // ==========================================================================
  // Skills
  // ==========================================================================

  /**
   * Get skills config path based on executor type
   * Only accepts uppercase underscore format: CLAUDE_CODE, CURSOR_AGENT, etc.
   */
  function getSkillsConfigPath(workspacePath: string | undefined, executorType: ExecutorType): {
    jsonPath: string | null;
    folderPath: string | null;
  } {
    const base = workspacePath || os.homedir();

    switch (executorType) {
      case "CLAUDE_CODE":
        return {
          jsonPath: path.join(base, ".claude", "skills.json"),
          folderPath: path.join(base, ".claude", "skills"),
        };
      case "CURSOR_AGENT":
        return {
          jsonPath: path.join(base, ".cursor", "skills.json"),
          folderPath: path.join(base, ".cursor", "skills"),
        };
      default:
        return {
          jsonPath: path.join(base, ".viben", "skills.json"),
          folderPath: path.join(base, ".viben", "skills"),
        };
    }
  }

  /**
   * Parse skill from skill.md file
   */
  function parseSkillMd(filePath: string): {
    id: string;
    name: string;
    version: string;
    source: string;
    path: string;
    description?: string;
  } | null {
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      const folderName = path.basename(path.dirname(filePath));

      // Parse YAML frontmatter
      const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
      let name = folderName;
      let description: string | undefined;

      if (frontmatterMatch) {
        const frontmatter = frontmatterMatch[1];
        const nameMatch = frontmatter.match(/^name:\s*(.+)$/m);
        if (nameMatch) name = nameMatch[1].trim();
        const descMatch = frontmatter.match(/^description:\s*(.+)$/m);
        if (descMatch) description = descMatch[1].trim();
      }

      return {
        id: folderName,
        name,
        version: "1.0.0",
        source: "local",
        path: path.dirname(filePath),
        description,
      };
    } catch {
      return null;
    }
  }

  /**
   * Scan skills folder for skill.md files
   */
  function scanSkillsFolder(folderPath: string): Array<{
    id: string;
    name: string;
    version: string;
    source: string;
    path: string;
    description?: string;
  }> {
    const skills: Array<{
      id: string;
      name: string;
      version: string;
      source: string;
      path: string;
      description?: string;
    }> = [];

    if (!fs.existsSync(folderPath)) {
      return skills;
    }

    try {
      const entries = fs.readdirSync(folderPath);
      for (const entry of entries) {
        const entryPath = path.join(folderPath, entry);
        const stat = fs.statSync(entryPath);

        if (stat.isDirectory()) {
          // Look for skill.md in the directory
          const skillMdPath = path.join(entryPath, "skill.md");
          if (fs.existsSync(skillMdPath)) {
            const skill = parseSkillMd(skillMdPath);
            if (skill) {
              skills.push(skill);
            }
          }
        }
      }
    } catch {
      // Folder not readable
    }

    return skills;
  }

  /**
   * GET /api/executors/:type/skills?workspace_path=...
   */
  fastify.get<{
    Params: { type: string };
    Querystring: { workspace_path?: string };
  }>("/api/executors/:type/skills", async (request) => {
    const { type } = request.params;
    const { workspace_path } = request.query;

    const executorType = type as ExecutorType;
    const { jsonPath, folderPath } = getSkillsConfigPath(workspace_path, executorType);
    const skills: Array<{
      id: string;
      name: string;
      version: string;
      source: string;
      path?: string;
      description?: string;
    }> = [];

    // Load from skills.json if exists
    if (jsonPath && fs.existsSync(jsonPath)) {
      try {
        const content = fs.readFileSync(jsonPath, "utf-8");
        const config = JSON.parse(content);
        if (Array.isArray(config.skills)) {
          skills.push(...config.skills);
        }
      } catch {
        // Invalid JSON
      }
    }

    // Scan skills folder
    if (folderPath) {
      const folderSkills = scanSkillsFolder(folderPath);
      // Merge, avoiding duplicates by id
      for (const skill of folderSkills) {
        if (!skills.find((s) => s.id === skill.id)) {
          skills.push(skill);
        }
      }
    }

    return { skills, total: skills.length };
  });

  // ==========================================================================
  // Agent Configs (prompts from .claude/agents/*.md)
  // ==========================================================================

  /**
   * Get agent configs path based on executor type
   * Only accepts uppercase underscore format: CLAUDE_CODE, CURSOR_AGENT, etc.
   */
  function getAgentConfigsPath(workspacePath: string | undefined, executorType: ExecutorType): string | null {
    const base = workspacePath || os.homedir();

    switch (executorType) {
      case "CLAUDE_CODE":
        return path.join(base, ".claude", "agents");
      case "CURSOR_AGENT":
        return path.join(base, ".cursor", "agents");
      default:
        return path.join(base, ".viben", "agents");
    }
  }

  /**
   * Parse agent config markdown file with YAML frontmatter
   */
  function parseAgentConfigMd(filePath: string, content: string): {
    id: string;
    name: string;
    description: string;
    tools: string[];
    model: string;
    path: string;
    content: string;
  } {
    const filename = path.basename(filePath, ".md");
    let name = filename;
    let description = "";
    let tools: string[] = [];
    let model = "";
    let bodyContent = content;

    // Parse YAML frontmatter
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (frontmatterMatch) {
      const frontmatter = frontmatterMatch[1];
      bodyContent = frontmatterMatch[2].trim();

      const nameMatch = frontmatter.match(/^name:\s*(.+)$/m);
      if (nameMatch) name = nameMatch[1].trim();

      const descMatch = frontmatter.match(/^description:\s*(.+)$/m);
      if (descMatch) description = descMatch[1].trim();

      const toolsMatch = frontmatter.match(/^tools:\s*(.+)$/m);
      if (toolsMatch) {
        tools = toolsMatch[1].split(",").map((t) => t.trim()).filter(Boolean);
      }

      const modelMatch = frontmatter.match(/^model:\s*(.+)$/m);
      if (modelMatch) model = modelMatch[1].trim();
    }

    return { id: filename, name, description, tools, model, path: filePath, content: bodyContent };
  }

  /**
   * Scan agent configs folder
   */
  function scanAgentConfigsFolder(folderPath: string): Array<{
    id: string;
    name: string;
    description: string;
    tools: string[];
    model: string;
    path: string;
    content: string;
  }> {
    const configs: Array<{
      id: string;
      name: string;
      description: string;
      tools: string[];
      model: string;
      path: string;
      content: string;
    }> = [];

    if (!fs.existsSync(folderPath)) {
      return configs;
    }

    try {
      const entries = fs.readdirSync(folderPath);
      for (const entry of entries) {
        const fullPath = path.join(folderPath, entry);
        const stat = fs.statSync(fullPath);

        if (stat.isFile() && entry.endsWith(".md")) {
          try {
            const content = fs.readFileSync(fullPath, "utf-8");
            configs.push(parseAgentConfigMd(fullPath, content));
          } catch {
            // Skip unreadable files
          }
        }
      }
    } catch {
      // Folder not readable
    }

    return configs;
  }

  /**
   * GET /api/executors/:type/configs?workspace_path=...
   */
  fastify.get<{
    Params: { type: string };
    Querystring: { workspace_path?: string };
  }>("/api/executors/:type/configs", async (request) => {
    const { type } = request.params;
    const { workspace_path } = request.query;

    const executorType = type as ExecutorType;
    const configsPath = getAgentConfigsPath(workspace_path, executorType);
    if (!configsPath) {
      return { configs: [] };
    }

    const configs = scanAgentConfigsFolder(configsPath);
    return { configs };
  });

  /**
   * GET /api/executors/:type/configs/:config_id?workspace_path=...
   */
  fastify.get<{
    Params: { type: string; config_id: string };
    Querystring: { workspace_path?: string };
  }>("/api/executors/:type/configs/:config_id", async (request, reply) => {
    const { type, config_id } = request.params;
    const { workspace_path } = request.query;

    const executorType = type as ExecutorType;
    const configsPath = getAgentConfigsPath(workspace_path, executorType);
    if (!configsPath) {
      reply.code(404);
      return { error: "Config path not found" };
    }

    const filePath = path.join(configsPath, `${config_id}.md`);
    if (!fs.existsSync(filePath)) {
      reply.code(404);
      return { error: "Config file not found" };
    }

    try {
      const content = fs.readFileSync(filePath, "utf-8");
      const config = parseAgentConfigMd(filePath, content);
      return { config };
    } catch (e) {
      reply.code(500);
      return { error: e instanceof Error ? e.message : "Failed to read config" };
    }
  });

  // ==========================================================================
  // Commands (slash commands from .claude/commands/)
  // ==========================================================================

  /**
   * Get commands path based on executor type
   * Only accepts uppercase underscore format: CLAUDE_CODE, CURSOR_AGENT, etc.
   */
  function getCommandsPath(workspacePath: string | undefined, executorType: ExecutorType): string | null {
    const base = workspacePath || os.homedir();

    switch (executorType) {
      case "CLAUDE_CODE":
        return path.join(base, ".claude", "commands");
      case "CURSOR_AGENT":
        return path.join(base, ".cursor", "commands");
      default:
        return path.join(base, ".viben", "commands");
    }
  }

  /**
   * Scan commands folder recursively
   * Commands are organized as: .claude/commands/{namespace}/{command}.md
   */
  function scanCommandsFolder(folderPath: string): Array<{
    id: string;
    namespace: string;
    name: string;
    path: string;
    content: string;
  }> {
    const commands: Array<{
      id: string;
      namespace: string;
      name: string;
      path: string;
      content: string;
    }> = [];

    if (!fs.existsSync(folderPath)) {
      return commands;
    }

    try {
      const namespaces = fs.readdirSync(folderPath);
      for (const namespace of namespaces) {
        const namespacePath = path.join(folderPath, namespace);
        const stat = fs.statSync(namespacePath);

        if (stat.isDirectory()) {
          // Scan command files in namespace folder
          try {
            const files = fs.readdirSync(namespacePath);
            for (const file of files) {
              if (file.endsWith(".md")) {
                const fullPath = path.join(namespacePath, file);
                const name = file.replace(/\.md$/, "");
                try {
                  const content = fs.readFileSync(fullPath, "utf-8");
                  commands.push({
                    id: `${namespace}/${name}`,
                    namespace,
                    name,
                    path: fullPath,
                    content,
                  });
                } catch {
                  // Skip unreadable files
                }
              }
            }
          } catch {
            // Namespace folder not readable
          }
        } else if (stat.isFile() && namespace.endsWith(".md")) {
          // Top-level command (no namespace)
          const name = namespace.replace(/\.md$/, "");
          try {
            const content = fs.readFileSync(namespacePath, "utf-8");
            commands.push({
              id: name,
              namespace: "",
              name,
              path: namespacePath,
              content,
            });
          } catch {
            // Skip unreadable files
          }
        }
      }
    } catch {
      // Folder not readable
    }

    return commands;
  }

  /**
   * GET /api/executors/:type/commands?workspace_path=...
   */
  fastify.get<{
    Params: { type: string };
    Querystring: { workspace_path?: string };
  }>("/api/executors/:type/commands", async (request) => {
    const { type } = request.params;
    const { workspace_path } = request.query;

    const executorType = type as ExecutorType;
    const commandsPath = getCommandsPath(workspace_path, executorType);
    if (!commandsPath) {
      return { commands: [] };
    }

    const commands = scanCommandsFolder(commandsPath);
    return { commands };
  });

  /**
   * GET /api/executors/:type/commands/:command_id?workspace_path=...
   * command_id can be "namespace/name" or just "name" for top-level commands
   */
  fastify.get<{
    Params: { type: string; command_id: string };
    Querystring: { workspace_path?: string };
  }>("/api/executors/:type/commands/:command_id", async (request, reply) => {
    const { type, command_id } = request.params;
    const { workspace_path } = request.query;

    const executorType = type as ExecutorType;
    const commandsPath = getCommandsPath(workspace_path, executorType);
    if (!commandsPath) {
      reply.code(404);
      return { error: "Commands path not found" };
    }

    // Parse command_id (can be "namespace/name" or just "name")
    const parts = command_id.split("/");
    let filePath: string;
    let namespace = "";
    let name = command_id;

    if (parts.length === 2) {
      namespace = parts[0];
      name = parts[1];
      filePath = path.join(commandsPath, namespace, `${name}.md`);
    } else {
      filePath = path.join(commandsPath, `${command_id}.md`);
    }

    if (!fs.existsSync(filePath)) {
      reply.code(404);
      return { error: "Command file not found" };
    }

    try {
      const content = fs.readFileSync(filePath, "utf-8");
      return {
        command: { id: command_id, namespace, name, path: filePath, content },
      };
    } catch (e) {
      reply.code(500);
      return { error: e instanceof Error ? e.message : "Failed to read command" };
    }
  });
}
