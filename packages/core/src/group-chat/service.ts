/**
 * Group chat service
 *
 * File-based group chat service with JSONL message storage.
 *
 * Directory structure:
 * ```
 * <workspace>/.viben/group-chats/<group-chat-id>/
 * ├── config.yaml              # Group chat configuration + members
 * ├── files/                   # Shared files
 * ├── pictures/                # Shared pictures
 * └── sessions/<session-id>/
 *     ├── config.yaml          # Session configuration
 *     ├── messages.ui.jsonl    # User-facing messages (append-only)
 *     └── responses.jsonl      # Current round agent responses
 * ```
 */
import { join } from "node:path";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile, readdir, rm, appendFile, stat } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { getStateDir } from "../config/paths";
import type {
  GroupChatConfig,
  MemberConfig,
  GroupChatSessionConfig,
  GroupChatUIMessage,
  AgentResponse,
  CreateGroupChatRequest,
  UpdateGroupChatRequest,
  SendMessageRequest,
  CreateSessionRequest,
  UpdateSessionRequest,
  ListMessagesQuery,
  FileInfo,
  FileUploadMeta,
} from "./types";

/**
 * Group chat service for file-based storage
 */
export class GroupChatService {
  private baseDir: string;

  constructor(baseDir?: string) {
    this.baseDir = baseDir || join(getStateDir(), "group-chats");
  }

  // ========================================================================
  // Directory paths
  // ========================================================================

  private groupChatDir(groupChatId: string): string {
    return join(this.baseDir, groupChatId);
  }

  private configPath(groupChatId: string): string {
    return join(this.groupChatDir(groupChatId), "config.yaml");
  }

  private membersPath(groupChatId: string): string {
    return join(this.groupChatDir(groupChatId), "members.yaml");
  }

  private sessionsDir(groupChatId: string): string {
    return join(this.groupChatDir(groupChatId), "sessions");
  }

  private sessionDir(groupChatId: string, sessionId: string): string {
    return join(this.sessionsDir(groupChatId), sessionId);
  }

  private sessionConfigPath(groupChatId: string, sessionId: string): string {
    return join(this.sessionDir(groupChatId, sessionId), "config.yaml");
  }

  private messagesPath(groupChatId: string, sessionId: string): string {
    return join(this.sessionDir(groupChatId, sessionId), "messages.ui.jsonl");
  }

  private responsesPath(groupChatId: string, sessionId: string): string {
    return join(this.sessionDir(groupChatId, sessionId), "responses.jsonl");
  }

  private filesDir(groupChatId: string): string {
    return join(this.groupChatDir(groupChatId), "files");
  }

  private picturesDir(groupChatId: string): string {
    return join(this.groupChatDir(groupChatId), "pictures");
  }

  // ========================================================================
  // Group Chat CRUD
  // ========================================================================

  /**
   * Create a new group chat
   */
  async createGroupChat(
    createdBy: string,
    request: CreateGroupChatRequest
  ): Promise<GroupChatConfig> {
    const id = request.id || randomUUID();
    const groupChatDir = this.groupChatDir(id);

    if (existsSync(groupChatDir)) {
      throw new Error(`Group chat already exists: ${id}`);
    }

    const now = new Date().toISOString();
    const config: GroupChatConfig = {
      id,
      name: request.name,
      description: request.description,
      settings: request.settings,
      createdBy,
      createdAt: now,
      updatedAt: now,
      metadata: request.metadata,
    };

    // Create directories
    await mkdir(groupChatDir, { recursive: true });
    await mkdir(this.sessionsDir(id), { recursive: true });
    await mkdir(this.filesDir(id), { recursive: true });
    await mkdir(this.picturesDir(id), { recursive: true });

    // Write config
    await this.writeConfig(id, config);

    // Add initial members
    if (request.members && request.members.length > 0) {
      const members: MemberConfig[] = request.members.map((m, index) => ({
        id: randomUUID(),
        type: m.type,
        refId: m.refId,
        displayName: m.displayName,
        role: m.role || (index === 0 ? "admin" : "member"),
        joinedAt: now,
      }));
      await this.writeMembers(id, members);
    }

    return config;
  }

  /**
   * Get a group chat by ID
   */
  async getGroupChat(groupChatId: string): Promise<GroupChatConfig | null> {
    const configPath = this.configPath(groupChatId);
    if (!existsSync(configPath)) {
      return null;
    }
    return this.readConfig(groupChatId);
  }

  /**
   * List all group chats
   */
  async listGroupChats(): Promise<GroupChatConfig[]> {
    if (!existsSync(this.baseDir)) {
      return [];
    }

    const entries = await readdir(this.baseDir, { withFileTypes: true });
    const configs: GroupChatConfig[] = [];

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const config = await this.getGroupChat(entry.name);
        if (config) {
          configs.push(config);
        }
      }
    }

    return configs.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  /**
   * Update a group chat
   */
  async updateGroupChat(
    groupChatId: string,
    update: UpdateGroupChatRequest
  ): Promise<GroupChatConfig> {
    const config = await this.getGroupChat(groupChatId);
    if (!config) {
      throw new Error(`Group chat not found: ${groupChatId}`);
    }

    const updated: GroupChatConfig = {
      ...config,
      name: update.name ?? config.name,
      description: update.description ?? config.description,
      settings: update.settings
        ? { ...config.settings, ...update.settings }
        : config.settings,
      metadata: update.metadata ?? config.metadata,
      updatedAt: new Date().toISOString(),
    };

    await this.writeConfig(groupChatId, updated);
    return updated;
  }

  /**
   * Delete a group chat
   */
  async deleteGroupChat(groupChatId: string): Promise<void> {
    const groupChatDir = this.groupChatDir(groupChatId);
    if (!existsSync(groupChatDir)) {
      throw new Error(`Group chat not found: ${groupChatId}`);
    }
    await rm(groupChatDir, { recursive: true });
  }

  // ========================================================================
  // Members
  // ========================================================================

  /**
   * Get members of a group chat
   */
  async getMembers(groupChatId: string): Promise<MemberConfig[]> {
    const membersPath = this.membersPath(groupChatId);
    if (!existsSync(membersPath)) {
      return [];
    }
    return (await this.readYaml<MemberConfig[]>(membersPath)) || [];
  }

  /**
   * Add a member to a group chat
   */
  async addMember(
    groupChatId: string,
    type: "human" | "agent",
    refId: string,
    displayName: string,
    role: "admin" | "member" | "observer" = "member"
  ): Promise<MemberConfig> {
    const members = await this.getMembers(groupChatId);
    const now = new Date().toISOString();

    const member: MemberConfig = {
      id: randomUUID(),
      type,
      refId,
      displayName,
      role,
      joinedAt: now,
    };

    members.push(member);
    await this.writeMembers(groupChatId, members);

    return member;
  }

  /**
   * Remove a member from a group chat
   */
  async removeMember(groupChatId: string, memberId: string): Promise<void> {
    const members = await this.getMembers(groupChatId);
    const index = members.findIndex((m) => m.id === memberId);
    if (index === -1) {
      throw new Error(`Member not found: ${memberId}`);
    }
    members.splice(index, 1);
    await this.writeMembers(groupChatId, members);
  }

  /**
   * Update a member's last seen time
   */
  async updateMemberLastSeen(groupChatId: string, memberId: string): Promise<void> {
    const members = await this.getMembers(groupChatId);
    const member = members.find((m) => m.id === memberId);
    if (member) {
      member.lastSeenAt = new Date().toISOString();
      await this.writeMembers(groupChatId, members);
    }
  }

  // ========================================================================
  // Sessions
  // ========================================================================

  /**
   * Create a session
   */
  async createSession(
    groupChatId: string,
    request: CreateSessionRequest
  ): Promise<GroupChatSessionConfig> {
    const id = request.id || randomUUID();
    const sessionDir = this.sessionDir(groupChatId, id);

    if (existsSync(sessionDir)) {
      throw new Error(`Session already exists: ${id}`);
    }

    const now = new Date().toISOString();
    const config: GroupChatSessionConfig = {
      id,
      groupChatId,
      name: request.name,
      status: "active",
      createdAt: now,
      updatedAt: now,
      metadata: request.metadata,
    };

    await mkdir(sessionDir, { recursive: true });
    await this.writeYaml(this.sessionConfigPath(groupChatId, id), config);

    // Create empty message files
    await writeFile(this.messagesPath(groupChatId, id), "");
    await writeFile(this.responsesPath(groupChatId, id), "");

    return config;
  }

  /**
   * Get a session
   */
  async getSession(
    groupChatId: string,
    sessionId: string
  ): Promise<GroupChatSessionConfig | null> {
    const configPath = this.sessionConfigPath(groupChatId, sessionId);
    if (!existsSync(configPath)) {
      return null;
    }
    return this.readYaml<GroupChatSessionConfig>(configPath);
  }

  /**
   * List sessions for a group chat
   */
  async listSessions(groupChatId: string): Promise<GroupChatSessionConfig[]> {
    const sessionsDir = this.sessionsDir(groupChatId);
    if (!existsSync(sessionsDir)) {
      return [];
    }

    const entries = await readdir(sessionsDir, { withFileTypes: true });
    const sessions: GroupChatSessionConfig[] = [];

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const session = await this.getSession(groupChatId, entry.name);
        if (session) {
          sessions.push(session);
        }
      }
    }

    return sessions.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  /**
   * Update a session
   */
  async updateSession(
    groupChatId: string,
    sessionId: string,
    update: UpdateSessionRequest
  ): Promise<GroupChatSessionConfig> {
    const session = await this.getSession(groupChatId, sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const updated: GroupChatSessionConfig = {
      ...session,
      name: update.name ?? session.name,
      status: update.status ?? session.status,
      metadata: update.metadata ?? session.metadata,
      updatedAt: new Date().toISOString(),
    };

    await this.writeYaml(this.sessionConfigPath(groupChatId, sessionId), updated);
    return updated;
  }

  /**
   * Delete a session
   */
  async deleteSession(groupChatId: string, sessionId: string): Promise<void> {
    const sessionDir = this.sessionDir(groupChatId, sessionId);
    if (!existsSync(sessionDir)) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    await rm(sessionDir, { recursive: true });
  }

  // ========================================================================
  // Messages
  // ========================================================================

  /**
   * Send a message
   */
  async sendMessage(
    groupChatId: string,
    sessionId: string,
    senderId: string,
    senderType: "human" | "agent",
    senderName: string,
    request: SendMessageRequest
  ): Promise<GroupChatUIMessage> {
    const message: GroupChatUIMessage = {
      id: randomUUID(),
      senderId,
      senderType,
      senderName,
      type: request.type || "user",
      content: request.content,
      mentions: request.mentions,
      replyTo: request.replyTo,
      timestamp: new Date().toISOString(),
    };

    await this.appendMessage(groupChatId, sessionId, message);
    return message;
  }

  /**
   * Append a message to the session
   */
  async appendMessage(
    groupChatId: string,
    sessionId: string,
    message: GroupChatUIMessage
  ): Promise<void> {
    const messagesPath = this.messagesPath(groupChatId, sessionId);
    const json = JSON.stringify(message);
    await appendFile(messagesPath, json + "\n");
  }

  /**
   * Get messages from a session
   */
  async getMessages(
    groupChatId: string,
    sessionId: string,
    query?: ListMessagesQuery
  ): Promise<GroupChatUIMessage[]> {
    const messagesPath = this.messagesPath(groupChatId, sessionId);
    if (!existsSync(messagesPath)) {
      return [];
    }

    const content = await readFile(messagesPath, "utf-8");
    const lines = content.split("\n").filter((line) => line.trim());
    let messages: GroupChatUIMessage[] = [];

    for (const line of lines) {
      try {
        messages.push(JSON.parse(line));
      } catch {
        // Skip invalid lines
      }
    }

    // Apply filters
    if (query) {
      if (query.senderId) {
        messages = messages.filter((m) => m.senderId === query.senderId);
      }
      if (query.type) {
        messages = messages.filter((m) => m.type === query.type);
      }
      if (query.after) {
        const afterTime = new Date(query.after).getTime();
        messages = messages.filter((m) => new Date(m.timestamp).getTime() > afterTime);
      }
      if (query.before) {
        const beforeTime = new Date(query.before).getTime();
        messages = messages.filter((m) => new Date(m.timestamp).getTime() < beforeTime);
      }
      if (query.limit) {
        messages = messages.slice(-query.limit);
      }
    }

    return messages;
  }

  // ========================================================================
  // Agent Responses
  // ========================================================================

  /**
   * Add an agent response
   */
  async addAgentResponse(
    groupChatId: string,
    sessionId: string,
    response: AgentResponse
  ): Promise<void> {
    const responsesPath = this.responsesPath(groupChatId, sessionId);
    const json = JSON.stringify(response);
    await appendFile(responsesPath, json + "\n");
  }

  /**
   * Get agent responses for a session
   */
  async getAgentResponses(
    groupChatId: string,
    sessionId: string
  ): Promise<AgentResponse[]> {
    const responsesPath = this.responsesPath(groupChatId, sessionId);
    if (!existsSync(responsesPath)) {
      return [];
    }

    const content = await readFile(responsesPath, "utf-8");
    const lines = content.split("\n").filter((line) => line.trim());
    const responses: AgentResponse[] = [];

    for (const line of lines) {
      try {
        responses.push(JSON.parse(line));
      } catch {
        // Skip invalid lines
      }
    }

    return responses;
  }

  /**
   * Clear agent responses (for next round)
   */
  async clearAgentResponses(groupChatId: string, sessionId: string): Promise<void> {
    const responsesPath = this.responsesPath(groupChatId, sessionId);
    await writeFile(responsesPath, "");
  }

  // ========================================================================
  // File Handling
  // ========================================================================

  /**
   * Upload a file
   */
  async uploadFile(
    groupChatId: string,
    uploadedBy: string,
    data: Buffer,
    meta: FileUploadMeta
  ): Promise<FileInfo> {
    const fileId = randomUUID();
    const extension = meta.name.split(".").pop() || "";
    const fileName = `${fileId}${extension ? "." + extension : ""}`;

    // Determine directory based on MIME type
    const isImage = meta.mimeType.startsWith("image/");
    const targetDir = isImage
      ? this.picturesDir(groupChatId)
      : this.filesDir(groupChatId);

    const filePath = join(targetDir, fileName);
    await writeFile(filePath, data);

    const fileInfo: FileInfo = {
      id: fileId,
      name: meta.name,
      mimeType: meta.mimeType,
      size: meta.size,
      path: isImage ? `pictures/${fileName}` : `files/${fileName}`,
      uploadedAt: new Date().toISOString(),
      uploadedBy,
    };

    return fileInfo;
  }

  /**
   * Get file info
   */
  async getFile(groupChatId: string, fileId: string): Promise<FileInfo | null> {
    // Check files directory
    const filesDir = this.filesDir(groupChatId);
    if (existsSync(filesDir)) {
      const entries = await readdir(filesDir);
      for (const entry of entries) {
        if (entry.startsWith(fileId)) {
          const filePath = join(filesDir, entry);
          const stats = await stat(filePath);
          return {
            id: fileId,
            name: entry,
            mimeType: "application/octet-stream",
            size: stats.size,
            path: `files/${entry}`,
            uploadedAt: stats.mtime.toISOString(),
            uploadedBy: "",
          };
        }
      }
    }

    // Check pictures directory
    const picturesDir = this.picturesDir(groupChatId);
    if (existsSync(picturesDir)) {
      const entries = await readdir(picturesDir);
      for (const entry of entries) {
        if (entry.startsWith(fileId)) {
          const filePath = join(picturesDir, entry);
          const stats = await stat(filePath);
          return {
            id: fileId,
            name: entry,
            mimeType: "image/*",
            size: stats.size,
            path: `pictures/${entry}`,
            uploadedAt: stats.mtime.toISOString(),
            uploadedBy: "",
          };
        }
      }
    }

    return null;
  }

  // ========================================================================
  // Utility Methods
  // ========================================================================

  private async readConfig(groupChatId: string): Promise<GroupChatConfig | null> {
    return this.readYaml<GroupChatConfig>(this.configPath(groupChatId));
  }

  private async writeConfig(groupChatId: string, config: GroupChatConfig): Promise<void> {
    await this.writeYaml(this.configPath(groupChatId), config);
  }

  private async writeMembers(groupChatId: string, members: MemberConfig[]): Promise<void> {
    await this.writeYaml(this.membersPath(groupChatId), members);
  }

  private async readYaml<T>(path: string): Promise<T | null> {
    if (!existsSync(path)) {
      return null;
    }
    const content = await readFile(path, "utf-8");
    // Simple YAML parsing (JSON-compatible subset)
    try {
      return JSON.parse(content);
    } catch {
      // For simple YAML files, parse manually
      const result: Record<string, unknown> = {};
      const lines = content.split("\n");
      for (const line of lines) {
        const colonIndex = line.indexOf(":");
        if (colonIndex === -1) continue;
        const key = line.slice(0, colonIndex).trim();
        const value = line.slice(colonIndex + 1).trim();
        if (!value) continue;
        try {
          result[key] = JSON.parse(value);
        } catch {
          result[key] = value.replace(/^["']|["']$/g, "");
        }
      }
      return result as T;
    }
  }

  private async writeYaml(path: string, data: unknown): Promise<void> {
    // Write as JSON (YAML-compatible)
    await writeFile(path, JSON.stringify(data, null, 2));
  }
}

/**
 * Singleton group chat service instance
 */
export const groupChatService = new GroupChatService();
