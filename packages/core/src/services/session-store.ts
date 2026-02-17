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
  /** Agent ID (for quick lookup, but not reliable - use agent_path/agent_config instead) */
  agentId: string;
  /** Agent path (absolute path to agent directory, reliable reference) */
  agentPath?: string;
  /** Agent config snapshot at session creation time */
  agentConfig?: Record<string, unknown>;
  /** Task ID (optional) */
  taskId?: string;
  /** Initial prompt */
  prompt?: string;
  /** Session status */
  status: string;
  /** Workspace path where this session runs (absolute path) */
  workspacePath?: string;
  /** Created timestamp */
  createdAt: string;
  /** Updated timestamp */
  updatedAt: string;
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
  /** Message type: "user", "text", "tool_use", "tool_result", "thinking", "error" */
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
  sessionId: string;
  agentId: string;
  status: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Task status type
 */
export type TaskStatus = "running" | "completed" | "error" | "stopped";

/**
 * Task configuration stored in ~/.viben/tasks/<task-id>.yaml
 */
export interface TaskConfig {
  /** Task ID */
  id: string;
  /** Session ID this task belongs to */
  sessionId: string;
  /** Agent ID */
  agentId: string;
  /** Task index within the session */
  taskIndex: number;
  /** User prompt for this task */
  prompt: string;
  /** Task status */
  status: TaskStatus;
  /** API call cost in USD */
  cost?: number;
  /** Execution duration in ms */
  duration?: number;
  /** Whether the task is favorited */
  favorite?: boolean;
  /** Created timestamp */
  createdAt: string;
  /** Updated timestamp */
  updatedAt: string;
}

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
  createdAt: string;
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
    createdAt: now,
    updatedAt: now,
    metadata: {},
  };
}

/**
 * Create a session config with workspace path
 */
export function createSessionConfigWithWorkspace(id: string, agentId: string, workspacePath: string): SessionConfig {
  return {
    ...createSessionConfig(id, agentId),
    workspacePath,
  };
}

/**
 * Create a full session config with all agent information
 */
export function createSessionConfigWithAgentInfo(
  id: string,
  agentId: string,
  agentPath?: string,
  agentConfig?: Record<string, unknown>,
  workspacePath?: string
): SessionConfig {
  return {
    ...createSessionConfig(id, agentId),
    agentPath,
    agentConfig,
    workspacePath,
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
   */
  private sessionsDir(agentId: string): string {
    return join(this.stateDir, "agents", agentId, ".agent_sessions");
  }

  /**
   * Get the session directory
   */
  private sessionDir(agentId: string, sessionId: string): string {
    return join(this.sessionsDir(agentId), sessionId);
  }

  /**
   * Get the config file path for a session
   */
  private configPath(agentId: string, sessionId: string): string {
    return join(this.sessionDir(agentId, sessionId), "config.yaml");
  }

  /**
   * Get the messages file path for a session (rollout - for sending to agent)
   */
  private messagesPath(agentId: string, sessionId: string): string {
    return join(this.sessionDir(agentId, sessionId), "messages.rollout.jsonl");
  }

  /**
   * Get the UI messages file path for a session
   */
  private uiMessagesPath(agentId: string, sessionId: string): string {
    return join(this.sessionDir(agentId, sessionId), "messages.ui.jsonl");
  }

  /**
   * Get the agent messages file path for a session
   */
  private agentMessagesPath(agentId: string, sessionId: string): string {
    return join(this.sessionDir(agentId, sessionId), "messages.agent.jsonl");
  }

  // ============ Task Path Helpers ============

  /**
   * Get the tasks directory
   */
  private tasksDir(): string {
    return join(this.stateDir, "tasks");
  }

  /**
   * Get the task file path
   */
  private taskPath(taskId: string): string {
    return join(this.tasksDir(), `${taskId}.yaml`);
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
    const sessionDir = this.sessionDir(config.agentId, config.id);

    // Create session directory
    await mkdir(sessionDir, { recursive: true });

    // Write config.yaml
    const configPath = this.configPath(config.agentId, config.id);
    const yaml = this.configToYaml(config);
    await writeFile(configPath, yaml);

    // Create empty messages files
    await writeFile(this.messagesPath(config.agentId, config.id), "");
    await writeFile(this.uiMessagesPath(config.agentId, config.id), "");
    await writeFile(this.agentMessagesPath(config.agentId, config.id), "");
  }

  /**
   * Get session config
   */
  async getSession(agentId: string, sessionId: string): Promise<SessionConfig> {
    const configPath = this.configPath(agentId, sessionId);

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
    const configPath = this.configPath(config.agentId, config.id);

    if (!existsSync(configPath)) {
      throw new SessionStoreError(`Session not found: ${config.id}`);
    }

    config.updatedAt = new Date().toISOString();
    const yaml = this.configToYaml(config);
    await writeFile(configPath, yaml);
  }

  /**
   * Delete a session
   */
  async deleteSession(agentId: string, sessionId: string): Promise<void> {
    const sessionDir = this.sessionDir(agentId, sessionId);

    if (!existsSync(sessionDir)) {
      throw new SessionStoreError(`Session not found: ${sessionId}`);
    }

    await rm(sessionDir, { recursive: true });
  }

  /**
   * List all sessions for an agent
   */
  async listSessions(agentId: string): Promise<SessionConfig[]> {
    const sessionsDir = this.sessionsDir(agentId);

    if (!existsSync(sessionsDir)) {
      return [];
    }

    const entries = await readdir(sessionsDir, { withFileTypes: true });
    const sessions: SessionConfig[] = [];

    for (const entry of entries) {
      if (entry.isDirectory()) {
        try {
          const config = await this.getSession(agentId, entry.name);
          sessions.push(config);
        } catch {
          // Skip invalid sessions
        }
      }
    }

    // Sort by created_at descending
    sessions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return sessions;
  }

  /**
   * Append a message to the session
   */
  async appendMessage(agentId: string, sessionId: string, message: SessionMessage): Promise<void> {
    const messagesPath = this.messagesPath(agentId, sessionId);
    const parentDir = this.sessionDir(agentId, sessionId);

    if (!existsSync(parentDir)) {
      throw new SessionStoreError(`Session not found: ${sessionId}`);
    }

    const json = JSON.stringify(message);
    await appendFile(messagesPath, json + "\n");
  }

  /**
   * Read all messages from a session
   */
  async readMessages(agentId: string, sessionId: string): Promise<SessionMessage[]> {
    const messagesPath = this.messagesPath(agentId, sessionId);

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
   */
  async appendUIMessage(agentId: string, sessionId: string, message: UIMessage): Promise<void> {
    const messagesPath = this.uiMessagesPath(agentId, sessionId);
    const parentDir = this.sessionDir(agentId, sessionId);

    if (!existsSync(parentDir)) {
      throw new SessionStoreError(`Session not found: ${sessionId}`);
    }

    const json = JSON.stringify(message);
    await appendFile(messagesPath, json + "\n");
  }

  /**
   * Read all UI messages from a session
   * Falls back to converting rollout messages if UI messages are empty
   */
  async readUIMessages(agentId: string, sessionId: string): Promise<UIMessage[]> {
    const messagesPath = this.uiMessagesPath(agentId, sessionId);

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
    const rolloutMessages = await this.readMessages(agentId, sessionId);
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
   */
  async appendAgentMessage(agentId: string, sessionId: string, message: AgentMessage): Promise<void> {
    const messagesPath = this.agentMessagesPath(agentId, sessionId);
    const parentDir = this.sessionDir(agentId, sessionId);

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
      sessionId,
      agentId,
      status: config.status,
      messageCount: messages.length,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    };
  }

  // ============ Task CRUD Operations ============

  /**
   * Create a new task
   */
  async createTask(config: TaskConfig): Promise<void> {
    const tasksDir = this.tasksDir();

    // Create tasks directory if it doesn't exist
    await mkdir(tasksDir, { recursive: true });

    // Write task.yaml
    const taskPath = this.taskPath(config.id);
    const yaml = this.taskConfigToYaml(config);
    await writeFile(taskPath, yaml);
  }

  /**
   * Get a task by ID
   */
  async getTask(taskId: string): Promise<TaskConfig | null> {
    const taskPath = this.taskPath(taskId);

    if (!existsSync(taskPath)) {
      return null;
    }

    const yaml = await readFile(taskPath, "utf-8");
    return this.yamlToTaskConfig(yaml);
  }

  /**
   * List all tasks for a session
   */
  async listTasksBySession(sessionId: string): Promise<TaskConfig[]> {
    const tasksDir = this.tasksDir();

    if (!existsSync(tasksDir)) {
      return [];
    }

    const entries = await readdir(tasksDir, { withFileTypes: true });
    const tasks: TaskConfig[] = [];

    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith(".yaml")) {
        const taskId = entry.name.replace(".yaml", "");
        try {
          const config = await this.getTask(taskId);
          if (config && config.sessionId === sessionId) {
            tasks.push(config);
          }
        } catch {
          // Skip invalid tasks
        }
      }
    }

    // Sort by taskIndex ascending
    tasks.sort((a, b) => a.taskIndex - b.taskIndex);

    return tasks;
  }

  /**
   * Update a task
   */
  async updateTask(taskId: string, updates: Partial<TaskConfig>): Promise<void> {
    const taskPath = this.taskPath(taskId);

    if (!existsSync(taskPath)) {
      throw new SessionStoreError(`Task not found: ${taskId}`);
    }

    const yaml = await readFile(taskPath, "utf-8");
    const config = this.yamlToTaskConfig(yaml);

    // Apply updates
    const updatedConfig: TaskConfig = {
      ...config,
      ...updates,
      id: config.id, // Prevent ID from being changed
      updatedAt: new Date().toISOString(),
    };

    const updatedYaml = this.taskConfigToYaml(updatedConfig);
    await writeFile(taskPath, updatedYaml);
  }

  /**
   * Delete a task
   */
  async deleteTask(taskId: string): Promise<void> {
    const taskPath = this.taskPath(taskId);

    if (!existsSync(taskPath)) {
      throw new SessionStoreError(`Task not found: ${taskId}`);
    }

    await rm(taskPath);
  }

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

    // Sort by createdAt descending
    files.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

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
    if (config.agentPath) lines.push(`agentPath: ${JSON.stringify(config.agentPath)}`);
    if (config.agentConfig) lines.push(`agentConfig: ${JSON.stringify(config.agentConfig)}`);
    if (config.taskId) lines.push(`taskId: ${JSON.stringify(config.taskId)}`);
    if (config.prompt) lines.push(`prompt: ${JSON.stringify(config.prompt)}`);
    lines.push(`status: ${JSON.stringify(config.status)}`);
    if (config.workspacePath) lines.push(`workspacePath: ${JSON.stringify(config.workspacePath)}`);
    lines.push(`createdAt: ${JSON.stringify(config.createdAt)}`);
    lines.push(`updatedAt: ${JSON.stringify(config.updatedAt)}`);
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
          case "agentPath":
            config.agentPath = parsed;
            break;
          case "agentConfig":
            config.agentConfig = parsed;
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
            config.workspacePath = parsed;
            break;
          case "createdAt":
            config.createdAt = parsed;
            break;
          case "updatedAt":
            config.updatedAt = parsed;
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

  /**
   * Convert TaskConfig to YAML
   */
  private taskConfigToYaml(config: TaskConfig): string {
    const lines: string[] = [];
    lines.push(`id: ${JSON.stringify(config.id)}`);
    lines.push(`sessionId: ${JSON.stringify(config.sessionId)}`);
    lines.push(`agentId: ${JSON.stringify(config.agentId)}`);
    lines.push(`taskIndex: ${JSON.stringify(config.taskIndex)}`);
    lines.push(`prompt: ${JSON.stringify(config.prompt)}`);
    lines.push(`status: ${JSON.stringify(config.status)}`);
    if (config.cost !== undefined) lines.push(`cost: ${JSON.stringify(config.cost)}`);
    if (config.duration !== undefined) lines.push(`duration: ${JSON.stringify(config.duration)}`);
    if (config.favorite !== undefined) lines.push(`favorite: ${JSON.stringify(config.favorite)}`);
    lines.push(`createdAt: ${JSON.stringify(config.createdAt)}`);
    lines.push(`updatedAt: ${JSON.stringify(config.updatedAt)}`);
    return lines.join("\n") + "\n";
  }

  /**
   * Parse YAML to TaskConfig
   */
  private yamlToTaskConfig(yaml: string): TaskConfig {
    const config: Partial<TaskConfig> = {};
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
          case "sessionId":
            config.sessionId = parsed;
            break;
          case "agentId":
            config.agentId = parsed;
            break;
          case "taskIndex":
            config.taskIndex = parsed;
            break;
          case "prompt":
            config.prompt = parsed;
            break;
          case "status":
            config.status = parsed;
            break;
          case "cost":
            config.cost = parsed;
            break;
          case "duration":
            config.duration = parsed;
            break;
          case "favorite":
            config.favorite = parsed;
            break;
          case "createdAt":
            config.createdAt = parsed;
            break;
          case "updatedAt":
            config.updatedAt = parsed;
            break;
        }
      } catch {
        // Skip invalid values
      }
    }

    return config as TaskConfig;
  }

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
    lines.push(`createdAt: ${JSON.stringify(file.createdAt)}`);
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
            file.createdAt = parsed;
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
