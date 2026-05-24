/**
 * Session store service for file-based session persistence
 *
 * Stores session data in the file system according to the spec:
 * ~/.viben/agents/<agent-id>/.agent_sessions/<session-id>/
 *   ├── config.yaml              # Session configuration
 *   ├── messages.ui.jsonl        # User-facing messages for rendering (append-only)
 *   ├── messages.rollout.jsonl   # Messages for sending to agent (can be compressed)
 *   └── messages.agent.jsonl     # Agent-side raw messages (append-only)
 */
import { join } from "node:path";
import { mkdir, readFile, writeFile, readdir, rm, appendFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { getStateDir } from "../config/paths";
import { SessionStoreError } from "../error";

/**
 * Session configuration stored in config.yaml
 */
export interface SessionConfig {
  /** Session ID */
  id: string;
  /** Agent ID (for quick lookup, but not reliable - use agent_dir/agent_config instead) */
  agentId: string;
  /** Agent directory (absolute path to agent directory, e.g., /path/to/agents/myagent) */
  agentDir?: string;
  /** Agent config snapshot at session creation time */
  agent_config?: Record<string, unknown>;
  /** Task ID (optional) */
  taskId?: string;
  /** Initial prompt */
  prompt?: string;
  /** Session status */
  status: string;
  /** Workspace path where this session runs (absolute path) */
  workspace_path?: string;
  /** Created timestamp */
  created_at: string;
  /** Updated timestamp */
  updated_at: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Message in the rollout JSONL file (for sending to agent, can be compressed)
 */
export interface SessionMessage {
  /** Timestamp */
  timestamp: string;
  /** Message role (user, assistant, system) */
  role: string;
  /** Message content */
  content: string;
  /** Tool calls (if any) */
  toolCalls?: unknown;
  /** Tool results (if any) */
  toolResult?: unknown;
}

/**
 * UI Message for user-facing rendering (append-only, ignore compression)
 */
export interface UIMessage {
  /** Unique message ID */
  id: string;
  /** Task ID (optional for backward compatibility) */
  taskId?: string;
  /** Timestamp */
  timestamp: string;
  /** Message type: "user", "text", "tool_use", "tool_result", "thinking", "error", "sdk_session" */
  type: string;
  /** Message content (text content for user/text/error, tool name for tool_use) */
  content?: string;
  /** Tool use ID (for tool_use and tool_result) */
  toolUseId?: string;
  /** Tool name (for tool_use) */
  toolName?: string;
  /** Tool input (for tool_use) */
  toolInput?: unknown;
  /** Tool output (for tool_result) */
  toolOutput?: string;
  /** Whether the tool result is an error */
  isError?: boolean;
  /** Attachments (for user messages) */
  attachments?: unknown[];
  /** SDK session ID (for sdk_session type, used for resume functionality) */
  sdkSessionId?: string;
}

/**
 * Agent-side raw message (append-only, agent's data structure)
 */
export interface AgentMessage {
  /** Timestamp when received */
  timestamp: string;
  /** Raw JSON from the agent */
  raw: unknown;
  /** Source executor (e.g., "claude_code", "cursor") */
  source?: string;
}

/**
 * Session statistics
 */
export interface SessionStats {
  session_id: string;
  agentId: string;
  status: string;
  messageCount: number;
  created_at: string;
  updated_at: string;
}

// NOTE: TaskConfig and TaskStatus have been moved to task-service.ts
// Use TaskService for all task operations instead of SessionStoreService

/**
 * Artifact type for library files
 */
export type ArtifactType =
  | "html"
  | "jsx"
  | "css"
  | "json"
  | "text"
  | "image"
  | "code"
  | "markdown"
  | "csv"
  | "document"
  | "spreadsheet"
  | "presentation"
  | "pdf"
  | "audio"
  | "video"
  | "font"
  | "websearch";

/**
 * Library file stored in ~/.viben/files/<file-id>/
 */
export interface LibraryFile {
  /** File ID */
  id: string;
  /** Task ID this file belongs to */
  taskId: string;
  /** File name */
  name: string;
  /** Artifact type */
  type: ArtifactType;
  /** Path to the actual file */
  path: string;
  /** Preview content (optional) */
  preview?: string;
  /** Thumbnail base64 (optional) */
  thumbnail?: string;
  /** Whether the file is favorited */
  isFavorite?: boolean;
  /** Created timestamp */
  created_at: string;
}

/**
 * Create a new session config
 */
export function createSessionConfig(id: string, agentId: string): SessionConfig {
  const now = new Date().toISOString();
  return {
    id,
    agentId,
    status: "active",
    created_at: now,
    updated_at: now,
    metadata: {},
  };
}

/**
 * Create a session config with workspace path
 */
export function createSessionConfigWithWorkspace(id: string, agentId: string, workspacePath: string): SessionConfig {
  return {
    ...createSessionConfig(id, agentId),
    workspace_path: workspacePath,
  };
}

/**
 * Create a full session config with all agent information
 */
export function createSessionConfigWithAgentInfo(
  id: string,
  agentId: string,
  agentDir?: string,
  agentConfig?: Record<string, unknown>,
  workspacePath?: string
): SessionConfig {
  return {
    ...createSessionConfig(id, agentId),
    agentDir,
    agent_config: agentConfig,
    workspace_path: workspacePath,
  };
}

/**
 * Create a user message
 */
export function createUserMessage(content: string): SessionMessage {
  return {
    timestamp: new Date().toISOString(),
    role: "user",
    content,
  };
}

/**
 * Create an assistant message
 */
export function createAssistantMessage(content: string): SessionMessage {
  return {
    timestamp: new Date().toISOString(),
    role: "assistant",
    content,
  };
}

/**
 * Create a system message
 */
export function createSystemMessage(content: string): SessionMessage {
  return {
    timestamp: new Date().toISOString(),
    role: "system",
    content,
  };
}

/**
 * UI Message helper functions
 */
export const UIMessageHelpers = {
  user(id: string, content: string): UIMessage {
    return {
      id,
      timestamp: new Date().toISOString(),
      type: "user",
      content,
    };
  },

  text(id: string, content: string): UIMessage {
    return {
      id,
      timestamp: new Date().toISOString(),
      type: "text",
      content,
    };
  },

  toolUse(id: string, toolUseId: string, toolName: string, toolInput: unknown): UIMessage {
    return {
      id,
      timestamp: new Date().toISOString(),
      type: "tool_use",
      toolUseId,
      toolName,
      toolInput,
    };
  },

  toolResult(id: string, toolUseId: string, output: string, isError: boolean): UIMessage {
    return {
      id,
      timestamp: new Date().toISOString(),
      type: "tool_result",
      toolUseId,
      toolOutput: output,
      isError,
    };
  },

  thinking(id: string, content: string): UIMessage {
    return {
      id,
      timestamp: new Date().toISOString(),
      type: "thinking",
      content,
    };
  },

  error(id: string, content: string): UIMessage {
    return {
      id,
      timestamp: new Date().toISOString(),
      type: "error",
      content,
      isError: true,
    };
  },
};

/**
 * Session store service for file-based session persistence
 */
export class SessionStoreService {
  private stateDir: string;

  constructor(stateDir?: string) {
    this.stateDir = stateDir || getStateDir();
  }

  /**
   * Get the sessions directory for an agent
   * @param agentId - Agent ID
   * @param agentDir - Optional absolute path to agent directory (e.g., /path/to/agents/myagent)
   */
  private sessionsDir(agentId: string, agentDir?: string): string {
    if (agentDir) {
      // Use the agent's directory directly (for workspace agents)
      return join(agentDir, ".agent_sessions");
    }
    // Fallback to global state dir (for global agents)
    return join(this.stateDir, "agents", agentId, ".agent_sessions");
  }

  /**
   * Get the session directory
   */
  private sessionDir(agentId: string, sessionId: string, agentDir?: string): string {
    return join(this.sessionsDir(agentId, agentDir), sessionId);
  }

  /**
   * Get the config file path for a session
   */
  private configPath(agentId: string, sessionId: string, agentDir?: string): string {
    return join(this.sessionDir(agentId, sessionId, agentDir), "config.yaml");
  }

  /**
   * Get the messages file path for a session (rollout - for sending to agent)
   */
  private messagesPath(agentId: string, sessionId: string, agentDir?: string): string {
    return join(this.sessionDir(agentId, sessionId, agentDir), "messages.rollout.jsonl");
  }

  /**
   * Get the UI messages file path for a session
   */
  private uiMessagesPath(agentId: string, sessionId: string, agentDir?: string): string {
    return join(this.sessionDir(agentId, sessionId, agentDir), "messages.ui.jsonl");
  }

  /**
   * Get the agent messages file path for a session
   */
  private agentMessagesPath(agentId: string, sessionId: string, agentDir?: string): string {
    return join(this.sessionDir(agentId, sessionId, agentDir), "messages.agent.jsonl");
  }

  // ============ File Path Helpers ============

  /**
   * Get the files directory
   */
  private filesDir(): string {
    return join(this.stateDir, "files");
  }

  /**
   * Get the file directory for a specific file
   */
  private filePath(fileId: string): string {
    return join(this.filesDir(), fileId);
  }

  /**
   * Get the file metadata path
   */
  private fileMetaPath(fileId: string): string {
    return join(this.filePath(fileId), "meta.yaml");
  }

  /**
   * Create a new session
   */
  async createSession(config: SessionConfig): Promise<void> {
    const sessionDir = this.sessionDir(config.agentId, config.id, config.agentDir);

    // Create session directory
    await mkdir(sessionDir, { recursive: true });

    // Write config.yaml
    const configPath = this.configPath(config.agentId, config.id, config.agentDir);
    const yaml = this.configToYaml(config);
    await writeFile(configPath, yaml);

    // Create empty messages files
    await writeFile(this.messagesPath(config.agentId, config.id, config.agentDir), "");
    await writeFile(this.uiMessagesPath(config.agentId, config.id, config.agentDir), "");
    await writeFile(this.agentMessagesPath(config.agentId, config.id, config.agentDir), "");
  }

  /**
   * Get session config
   * @param agentId - Agent ID
   * @param sessionId - Session ID
   * @param agentDir - Optional absolute path to agent directory (e.g., /path/to/agents/myagent)
   */
  async getSession(agentId: string, sessionId: string, agentDir?: string): Promise<SessionConfig> {
    const configPath = this.configPath(agentId, sessionId, agentDir);

    if (!existsSync(configPath)) {
      throw new SessionStoreError(`Session not found: ${sessionId}`);
    }

    const yaml = await readFile(configPath, "utf-8");
    return this.yamlToConfig(yaml);
  }

  /**
   * Update session config
   */
  async updateSession(config: SessionConfig): Promise<void> {
    const configPath = this.configPath(config.agentId, config.id, config.agentDir);

    if (!existsSync(configPath)) {
      throw new SessionStoreError(`Session not found: ${config.id}`);
    }

    config.updated_at = new Date().toISOString();
    const yaml = this.configToYaml(config);
    await writeFile(configPath, yaml);
  }

  /**
   * Delete a session
   * @param agentId - Agent ID
   * @param sessionId - Session ID
   * @param agentDir - Optional absolute path to agent directory (e.g., /path/to/agents/myagent)
   */
  async deleteSession(agentId: string, sessionId: string, agentDir?: string): Promise<void> {
    const sessionDir = this.sessionDir(agentId, sessionId, agentDir);

    if (!existsSync(sessionDir)) {
      throw new SessionStoreError(`Session not found: ${sessionId}`);
    }

    await rm(sessionDir, { recursive: true });
  }

  /**
   * List all sessions for an agent
   * @param agentId - Agent ID
   * @param agentDir - Optional absolute path to agent directory (e.g., /path/to/agents/myagent)
   */
  async listSessions(agentId: string, agentDir?: string): Promise<SessionConfig[]> {
    const sessionsDir = this.sessionsDir(agentId, agentDir);

    if (!existsSync(sessionsDir)) {
      return [];
    }

    const entries = await readdir(sessionsDir, { withFileTypes: true });

    // Filter to directories only
    const dirEntries = entries.filter((entry) => entry.isDirectory());

    // Read all session configs in parallel
    const results = await Promise.allSettled(
      dirEntries.map((entry) => this.getSession(agentId, entry.name, agentDir))
    );

    // Collect successful results, skip failures
    const sessions: SessionConfig[] = [];
    for (const result of results) {
      if (result.status === "fulfilled") {
        sessions.push(result.value);
      }
    }

    // Sort by created_at descending
    sessions.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return sessions;
  }

  /**
   * Append a message to the session
   * @param agentDir - Optional absolute path to agent directory (e.g., /path/to/agents/myagent)
   */
  async appendMessage(agentId: string, sessionId: string, message: SessionMessage, agentDir?: string): Promise<void> {
    const messagesPath = this.messagesPath(agentId, sessionId, agentDir);
    const parentDir = this.sessionDir(agentId, sessionId, agentDir);

    if (!existsSync(parentDir)) {
      throw new SessionStoreError(`Session not found: ${sessionId}`);
    }

    const json = JSON.stringify(message);
    await appendFile(messagesPath, json + "\n");
  }

  /**
   * Read all messages from a session
   * @param agentDir - Optional absolute path to agent directory (e.g., /path/to/agents/myagent)
   */
  async readMessages(agentId: string, sessionId: string, agentDir?: string): Promise<SessionMessage[]> {
    const messagesPath = this.messagesPath(agentId, sessionId, agentDir);

    if (!existsSync(messagesPath)) {
      return [];
    }

    const content = await readFile(messagesPath, "utf-8");
    const lines = content.split("\n").filter((line) => line.trim());
    const messages: SessionMessage[] = [];

    for (const line of lines) {
      try {
        messages.push(JSON.parse(line));
      } catch {
        // Skip invalid lines
      }
    }

    return messages;
  }

  /**
   * Append a UI message to the session
   * @param agentDir - Optional absolute path to agent directory (e.g., /path/to/agents/myagent)
   */
  async appendUIMessage(agentId: string, sessionId: string, message: UIMessage, agentDir?: string): Promise<void> {
    const messagesPath = this.uiMessagesPath(agentId, sessionId, agentDir);
    const parentDir = this.sessionDir(agentId, sessionId, agentDir);

    if (!existsSync(parentDir)) {
      throw new SessionStoreError(`Session not found: ${sessionId}`);
    }

    const json = JSON.stringify(message);
    await appendFile(messagesPath, json + "\n");
  }

  /**
   * Read all UI messages from a session
   * Falls back to converting rollout messages if UI messages are empty
   * @param agentDir - Optional absolute path to agent directory (e.g., /path/to/agents/myagent)
   */
  async readUIMessages(agentId: string, sessionId: string, agentDir?: string): Promise<UIMessage[]> {
    const messagesPath = this.uiMessagesPath(agentId, sessionId, agentDir);

    // Try to read UI messages first
    if (existsSync(messagesPath)) {
      const content = await readFile(messagesPath, "utf-8");
      const lines = content.split("\n").filter((line) => line.trim());
      const messages: UIMessage[] = [];

      for (const line of lines) {
        try {
          messages.push(JSON.parse(line));
        } catch {
          // Skip invalid lines
        }
      }

      if (messages.length > 0) {
        return messages;
      }
    }

    // Fallback: convert rollout messages to UI messages
    const rolloutMessages = await this.readMessages(agentId, sessionId, agentDir);
    return rolloutMessages.map((msg, index) => this.sessionMessageToUIMessage(msg, index));
  }

  /**
   * Convert a SessionMessage (rollout format) to UIMessage (UI format)
   */
  private sessionMessageToUIMessage(msg: SessionMessage, index: number): UIMessage {
    const id = `rollout-${index}-${Date.now()}`;
    const timestamp = msg.timestamp || new Date().toISOString();

    // Map role to UI message type
    if (msg.role === "user") {
      return {
        id,
        timestamp,
        type: "user",
        content: msg.content,
      };
    } else if (msg.role === "assistant") {
      return {
        id,
        timestamp,
        type: "text",
        content: msg.content,
      };
    } else if (msg.role === "system") {
      return {
        id,
        timestamp,
        type: "text",
        content: msg.content,
      };
    }

    // Default fallback
    return {
      id,
      timestamp,
      type: "text",
      content: msg.content,
    };
  }

  /**
   * Append an agent message to the session
   * @param agentDir - Optional absolute path to agent directory (e.g., /path/to/agents/myagent)
   */
  async appendAgentMessage(agentId: string, sessionId: string, message: AgentMessage, agentDir?: string): Promise<void> {
    const messagesPath = this.agentMessagesPath(agentId, sessionId, agentDir);
    const parentDir = this.sessionDir(agentId, sessionId, agentDir);

    if (!existsSync(parentDir)) {
      throw new SessionStoreError(`Session not found: ${sessionId}`);
    }

    const json = JSON.stringify(message);
    await appendFile(messagesPath, json + "\n");
  }

  /**
   * Read all agent messages from a session
   */
  async readAgentMessages(agentId: string, sessionId: string): Promise<AgentMessage[]> {
    const messagesPath = this.agentMessagesPath(agentId, sessionId);

    if (!existsSync(messagesPath)) {
      return [];
    }

    const content = await readFile(messagesPath, "utf-8");
    const lines = content.split("\n").filter((line) => line.trim());
    const messages: AgentMessage[] = [];

    for (const line of lines) {
      try {
        messages.push(JSON.parse(line));
      } catch {
        // Skip invalid lines
      }
    }

    return messages;
  }

  /**
   * Get session statistics
   */
  async getStats(agentId: string, sessionId: string): Promise<SessionStats> {
    const config = await this.getSession(agentId, sessionId);
    const messages = await this.readMessages(agentId, sessionId);

    return {
      session_id: sessionId,
      agentId,
      status: config.status,
      messageCount: messages.length,
      created_at: config.created_at,
      updated_at: config.updated_at,
    };
  }

  // NOTE: Task CRUD operations have been moved to TaskService (task-service.ts)
  // Use taskService for all task operations

  // ============ File CRUD Operations ============

  /**
   * Create a new file entry
   */
  async createFile(file: LibraryFile, content?: Buffer): Promise<void> {
    const fileDir = this.filePath(file.id);

    // Create file directory
    await mkdir(fileDir, { recursive: true });

    // Write meta.yaml
    const metaPath = this.fileMetaPath(file.id);
    const yaml = this.libraryFileToYaml(file);
    await writeFile(metaPath, yaml);

    // Write actual file content if provided
    if (content) {
      const contentPath = join(fileDir, file.name);
      await writeFile(contentPath, content);
      // Update the path in meta to point to the actual file
      file.path = contentPath;
      const updatedYaml = this.libraryFileToYaml(file);
      await writeFile(metaPath, updatedYaml);
    }
  }

  /**
   * Get a file by ID
   */
  async getFile(fileId: string): Promise<LibraryFile | null> {
    const metaPath = this.fileMetaPath(fileId);

    if (!existsSync(metaPath)) {
      return null;
    }

    const yaml = await readFile(metaPath, "utf-8");
    return this.yamlToLibraryFile(yaml);
  }

  /**
   * List all files for a task
   */
  async listFilesByTask(taskId: string): Promise<LibraryFile[]> {
    const filesDir = this.filesDir();

    if (!existsSync(filesDir)) {
      return [];
    }

    const entries = await readdir(filesDir, { withFileTypes: true });
    const files: LibraryFile[] = [];

    for (const entry of entries) {
      if (entry.isDirectory()) {
        try {
          const file = await this.getFile(entry.name);
          if (file && file.taskId === taskId) {
            files.push(file);
          }
        } catch {
          // Skip invalid files
        }
      }
    }

    // Sort by created_at descending
    files.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return files;
  }

  /**
   * Delete a file
   */
  async deleteFile(fileId: string): Promise<void> {
    const fileDir = this.filePath(fileId);

    if (!existsSync(fileDir)) {
      throw new SessionStoreError(`File not found: ${fileId}`);
    }

    await rm(fileDir, { recursive: true });
  }

  // ============ UI Message by Task ============

  /**
   * Read UI messages filtered by task ID
   */
  async readUIMessagesByTask(agentId: string, sessionId: string, taskId: string): Promise<UIMessage[]> {
    const messages = await this.readUIMessages(agentId, sessionId);
    return messages.filter((msg) => msg.taskId === taskId);
  }

  // ============ YAML Serialization Helpers ============

  /**
   * Convert config to YAML (simple implementation without dependency)
   */
  private configToYaml(config: SessionConfig): string {
    const lines: string[] = [];
    lines.push(`id: ${JSON.stringify(config.id)}`);
    lines.push(`agentId: ${JSON.stringify(config.agentId)}`);
    if (config.agentDir) lines.push(`agentDir: ${JSON.stringify(config.agentDir)}`);
    if (config.agent_config) lines.push(`agent_config: ${JSON.stringify(config.agent_config)}`);
    if (config.taskId) lines.push(`taskId: ${JSON.stringify(config.taskId)}`);
    if (config.prompt) lines.push(`prompt: ${JSON.stringify(config.prompt)}`);
    lines.push(`status: ${JSON.stringify(config.status)}`);
    if (config.workspace_path) lines.push(`workspace_path: ${JSON.stringify(config.workspace_path)}`);
    lines.push(`created_at: ${JSON.stringify(config.created_at)}`);
    lines.push(`updated_at: ${JSON.stringify(config.updated_at)}`);
    if (config.metadata) lines.push(`metadata: ${JSON.stringify(config.metadata)}`);
    return lines.join("\n") + "\n";
  }

  /**
   * Parse YAML to config (simple implementation without dependency)
   */
  private yamlToConfig(yaml: string): SessionConfig {
    const config: Partial<SessionConfig> = {};
    const lines = yaml.split("\n");

    for (const line of lines) {
      const colonIndex = line.indexOf(":");
      if (colonIndex === -1) continue;

      const key = line.slice(0, colonIndex).trim();
      const value = line.slice(colonIndex + 1).trim();

      if (!value) continue;

      try {
        const parsed = JSON.parse(value);
        switch (key) {
          case "id":
            config.id = parsed;
            break;
          case "agentId":
            config.agentId = parsed;
            break;
          case "agentDir":
            config.agentDir = parsed;
            break;
          case "agentConfig":
          case "agent_config":
            config.agent_config = parsed;
            break;
          case "taskId":
            config.taskId = parsed;
            break;
          case "prompt":
            config.prompt = parsed;
            break;
          case "status":
            config.status = parsed;
            break;
          case "workspacePath":
          case "workspace_path":
            config.workspace_path = parsed;
            break;
          case "createdAt":
          case "created_at":
            config.created_at = parsed;
            break;
          case "updatedAt":
          case "updated_at":
            config.updated_at = parsed;
            break;
          case "metadata":
            config.metadata = parsed;
            break;
        }
      } catch {
        // Skip invalid values
      }
    }

    return config as SessionConfig;
  }

  // NOTE: TaskConfig YAML serialization moved to TaskService

  /**
   * Convert LibraryFile to YAML
   */
  private libraryFileToYaml(file: LibraryFile): string {
    const lines: string[] = [];
    lines.push(`id: ${JSON.stringify(file.id)}`);
    lines.push(`taskId: ${JSON.stringify(file.taskId)}`);
    lines.push(`name: ${JSON.stringify(file.name)}`);
    lines.push(`type: ${JSON.stringify(file.type)}`);
    lines.push(`path: ${JSON.stringify(file.path)}`);
    if (file.preview) lines.push(`preview: ${JSON.stringify(file.preview)}`);
    if (file.thumbnail) lines.push(`thumbnail: ${JSON.stringify(file.thumbnail)}`);
    if (file.isFavorite !== undefined) lines.push(`isFavorite: ${JSON.stringify(file.isFavorite)}`);
    lines.push(`created_at: ${JSON.stringify(file.created_at)}`);
    return lines.join("\n") + "\n";
  }

  /**
   * Parse YAML to LibraryFile
   */
  private yamlToLibraryFile(yaml: string): LibraryFile {
    const file: Partial<LibraryFile> = {};
    const lines = yaml.split("\n");

    for (const line of lines) {
      const colonIndex = line.indexOf(":");
      if (colonIndex === -1) continue;

      const key = line.slice(0, colonIndex).trim();
      const value = line.slice(colonIndex + 1).trim();

      if (!value) continue;

      try {
        const parsed = JSON.parse(value);
        switch (key) {
          case "id":
            file.id = parsed;
            break;
          case "taskId":
            file.taskId = parsed;
            break;
          case "name":
            file.name = parsed;
            break;
          case "type":
            file.type = parsed;
            break;
          case "path":
            file.path = parsed;
            break;
          case "preview":
            file.preview = parsed;
            break;
          case "thumbnail":
            file.thumbnail = parsed;
            break;
          case "isFavorite":
            file.isFavorite = parsed;
            break;
          case "createdAt":
          case "created_at":
            file.created_at = parsed;
            break;
        }
      } catch {
        // Skip invalid values
      }
    }

    return file as LibraryFile;
  }
}

/**
 * Singleton session store service instance
 */
export const sessionStoreService = new SessionStoreService();
