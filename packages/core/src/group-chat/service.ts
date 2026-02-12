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
import { join, basename, extname } from "node:path";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile, readdir, rm, appendFile, stat, unlink } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { getStateDir } from "../config/paths";
import type {
  GroupChatConfig,
  MemberConfig,
  GroupChatSessionConfig,
  GroupChatUIMessage,
  AgentResponse,
  AgentRolloutMessage,
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

  /**
   * Get the base directory for group chats
   * This is useful for determining workspace context
   */
  getBaseDir(): string {
    return this.baseDir;
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

  private agentsDir(groupChatId: string, sessionId: string): string {
    return join(this.sessionDir(groupChatId, sessionId), "agents");
  }

  private agentDir(groupChatId: string, sessionId: string, agentId: string): string {
    return join(this.agentsDir(groupChatId, sessionId), agentId);
  }

  private agentRolloutPath(groupChatId: string, sessionId: string, agentId: string): string {
    return join(this.agentDir(groupChatId, sessionId, agentId), "messages.rollout.jsonl");
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
      activeAgents: request.activeAgents || [],
      createdAt: now,
      updatedAt: now,
      metadata: request.metadata,
    };

    await mkdir(sessionDir, { recursive: true });
    await mkdir(this.agentsDir(groupChatId, id), { recursive: true });
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
      activeAgents: update.activeAgents ?? session.activeAgents,
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
  // Agent Rollout Messages (agents/<id>/messages.rollout.jsonl)
  // ========================================================================

  /**
   * Ensure agent directory exists
   */
  async ensureAgentDir(
    groupChatId: string,
    sessionId: string,
    agentId: string
  ): Promise<string> {
    const agentDir = this.agentDir(groupChatId, sessionId, agentId);
    await mkdir(agentDir, { recursive: true });
    return agentDir;
  }

  /**
   * Append an agent rollout message
   */
  async appendAgentRolloutMessage(
    groupChatId: string,
    sessionId: string,
    agentId: string,
    message: AgentRolloutMessage
  ): Promise<void> {
    await this.ensureAgentDir(groupChatId, sessionId, agentId);
    const rolloutPath = this.agentRolloutPath(groupChatId, sessionId, agentId);
    const json = JSON.stringify(message);
    await appendFile(rolloutPath, json + "\n");
  }

  /**
   * Get agent rollout messages
   */
  async getAgentRolloutMessages(
    groupChatId: string,
    sessionId: string,
    agentId: string
  ): Promise<AgentRolloutMessage[]> {
    const rolloutPath = this.agentRolloutPath(groupChatId, sessionId, agentId);
    if (!existsSync(rolloutPath)) {
      return [];
    }

    const content = await readFile(rolloutPath, "utf-8");
    const lines = content.split("\n").filter((line) => line.trim());
    const messages: AgentRolloutMessage[] = [];

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
   * Get last N agent rollout messages
   */
  async getAgentRolloutMessagesLast(
    groupChatId: string,
    sessionId: string,
    agentId: string,
    limit: number
  ): Promise<AgentRolloutMessage[]> {
    const messages = await this.getAgentRolloutMessages(groupChatId, sessionId, agentId);
    return messages.slice(-limit);
  }

  /**
   * List agents with rollout messages in a session
   */
  async listSessionAgents(groupChatId: string, sessionId: string): Promise<string[]> {
    const agentsDir = this.agentsDir(groupChatId, sessionId);
    if (!existsSync(agentsDir)) {
      return [];
    }

    const entries = await readdir(agentsDir, { withFileTypes: true });
    const agents: string[] = [];

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const agentId = entry.name;
        const rolloutPath = this.agentRolloutPath(groupChatId, sessionId, agentId);
        if (existsSync(rolloutPath)) {
          agents.push(agentId);
        }
      }
    }

    return agents;
  }

  /**
   * Build message for an agent (prepend other agents' responses)
   */
  async buildMessageForAgent(
    groupChatId: string,
    sessionId: string,
    targetAgentId: string,
    userMessage: string,
    senderName: string
  ): Promise<string> {
    const responses = await this.getAgentResponses(groupChatId, sessionId);

    // Filter out the target agent's own responses
    const otherResponses = responses.filter((r) => r.agentId !== targetAgentId);

    if (otherResponses.length === 0) {
      // First round or no other agent responses
      return userMessage;
    } else {
      // Prepend other agents' responses
      const parts: string[] = [];
      for (const resp of otherResponses) {
        parts.push(`[${resp.agentName}]: ${resp.content}`);
      }
      parts.push(`[${senderName}]: ${userMessage}`);
      return parts.join("\n\n");
    }
  }

  /**
   * Get agent members from a group chat
   */
  async getAgentMembers(groupChatId: string): Promise<MemberConfig[]> {
    const members = await this.getMembers(groupChatId);
    return members.filter((m) => m.type === "agent");
  }

  // ========================================================================
  // File Management (files/)
  // ========================================================================

  /**
   * Valid image extensions
   */
  private static readonly IMAGE_EXTENSIONS = [
    "jpg",
    "jpeg",
    "png",
    "gif",
    "webp",
    "bmp",
    "svg",
    "ico",
    "tiff",
    "tif",
  ];

  /**
   * Sanitize filename to prevent path traversal attacks
   */
  private sanitizeFilename(filename: string): string {
    // Get just the basename (removes any path components)
    const name = basename(filename);
    // Replace problematic characters
    return name.replace(/[/\\:*?"<>|]/g, "_");
  }

  /**
   * Check if filename has a valid image extension
   */
  private isValidImageExtension(filename: string): boolean {
    const ext = extname(filename).slice(1).toLowerCase();
    return GroupChatService.IMAGE_EXTENSIONS.includes(ext);
  }

  /**
   * Guess MIME type from filename extension
   */
  private guessMimeType(filename: string): string | undefined {
    const ext = extname(filename).slice(1).toLowerCase();
    const mimeTypes: Record<string, string> = {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      gif: "image/gif",
      webp: "image/webp",
      bmp: "image/bmp",
      svg: "image/svg+xml",
      ico: "image/x-icon",
      tiff: "image/tiff",
      tif: "image/tiff",
      pdf: "application/pdf",
      txt: "text/plain",
      json: "application/json",
      xml: "application/xml",
      html: "text/html",
      css: "text/css",
      js: "application/javascript",
      ts: "application/typescript",
      md: "text/markdown",
      zip: "application/zip",
      tar: "application/x-tar",
      gz: "application/gzip",
    };
    return mimeTypes[ext];
  }

  /**
   * Generate a unique filename if file already exists
   */
  private async generateUniqueFilename(dir: string, filename: string): Promise<string> {
    const safeName = this.sanitizeFilename(filename);
    let finalName = safeName;
    let filePath = join(dir, finalName);

    if (existsSync(filePath)) {
      // Add timestamp suffix to make it unique
      const timestamp = Date.now();
      const ext = extname(safeName);
      const nameWithoutExt = safeName.slice(0, -ext.length || undefined);
      finalName = `${nameWithoutExt}_${timestamp}${ext}`;
    }

    return finalName;
  }

  /**
   * Upload a file to the group chat
   */
  async saveFile(
    groupChatId: string,
    filename: string,
    data: Buffer,
    uploadedBy?: string,
    mimeType?: string
  ): Promise<FileInfo> {
    // Verify group chat exists
    const config = await this.getGroupChat(groupChatId);
    if (!config) {
      throw new Error(`Group chat not found: ${groupChatId}`);
    }

    const filesDir = this.filesDir(groupChatId);
    await mkdir(filesDir, { recursive: true });

    const finalFilename = await this.generateUniqueFilename(filesDir, filename);
    const filePath = join(filesDir, finalFilename);

    await writeFile(filePath, data);

    const stats = await stat(filePath);
    const guessedMime = mimeType || this.guessMimeType(finalFilename) || "application/octet-stream";

    const fileInfo: FileInfo = {
      id: randomUUID(),
      name: finalFilename,
      mimeType: guessedMime,
      size: stats.size,
      path: `files/${finalFilename}`,
      uploadedAt: new Date().toISOString(),
      uploadedBy: uploadedBy || "",
    };

    return fileInfo;
  }

  /**
   * List all files in the group chat
   */
  async listFiles(groupChatId: string): Promise<FileInfo[]> {
    // Verify group chat exists
    const config = await this.getGroupChat(groupChatId);
    if (!config) {
      throw new Error(`Group chat not found: ${groupChatId}`);
    }

    const filesDir = this.filesDir(groupChatId);
    if (!existsSync(filesDir)) {
      return [];
    }

    const entries = await readdir(filesDir, { withFileTypes: true });
    const files: FileInfo[] = [];

    for (const entry of entries) {
      if (entry.isFile()) {
        const filePath = join(filesDir, entry.name);
        const stats = await stat(filePath);
        const mimeType = this.guessMimeType(entry.name) || "application/octet-stream";

        files.push({
          id: entry.name, // Using filename as ID for simplicity
          name: entry.name,
          mimeType,
          size: stats.size,
          path: `files/${entry.name}`,
          uploadedAt: stats.mtime.toISOString(),
          uploadedBy: "",
        });
      }
    }

    // Sort by upload time descending
    files.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());

    return files;
  }

  /**
   * Get file path for download
   */
  getFilePath(groupChatId: string, filename: string): string {
    const safeFilename = this.sanitizeFilename(filename);
    return join(this.filesDir(groupChatId), safeFilename);
  }

  /**
   * Get file content
   */
  async getFileContent(groupChatId: string, filename: string): Promise<Buffer> {
    // Verify group chat exists
    const config = await this.getGroupChat(groupChatId);
    if (!config) {
      throw new Error(`Group chat not found: ${groupChatId}`);
    }

    const filePath = this.getFilePath(groupChatId, filename);
    if (!existsSync(filePath)) {
      throw new Error(`File not found: ${filename}`);
    }

    return readFile(filePath);
  }

  /**
   * Get file info by filename
   */
  async getFileInfo(groupChatId: string, filename: string): Promise<FileInfo | null> {
    const safeFilename = this.sanitizeFilename(filename);
    const filePath = join(this.filesDir(groupChatId), safeFilename);

    if (!existsSync(filePath)) {
      return null;
    }

    const stats = await stat(filePath);
    const mimeType = this.guessMimeType(safeFilename) || "application/octet-stream";

    return {
      id: safeFilename,
      name: safeFilename,
      mimeType,
      size: stats.size,
      path: `files/${safeFilename}`,
      uploadedAt: stats.mtime.toISOString(),
      uploadedBy: "",
    };
  }

  /**
   * Delete a file
   */
  async deleteFile(groupChatId: string, filename: string): Promise<void> {
    // Verify group chat exists
    const config = await this.getGroupChat(groupChatId);
    if (!config) {
      throw new Error(`Group chat not found: ${groupChatId}`);
    }

    const filePath = this.getFilePath(groupChatId, filename);
    if (!existsSync(filePath)) {
      throw new Error(`File not found: ${filename}`);
    }

    await unlink(filePath);
  }

  // ========================================================================
  // Picture Management (pictures/)
  // ========================================================================

  /**
   * Upload a picture to the group chat
   */
  async savePicture(
    groupChatId: string,
    filename: string,
    data: Buffer,
    uploadedBy?: string,
    mimeType?: string
  ): Promise<FileInfo> {
    // Verify group chat exists
    const config = await this.getGroupChat(groupChatId);
    if (!config) {
      throw new Error(`Group chat not found: ${groupChatId}`);
    }

    // Validate image extension
    if (!this.isValidImageExtension(filename)) {
      throw new Error(
        `Invalid image extension: ${filename}. Allowed: ${GroupChatService.IMAGE_EXTENSIONS.join(", ")}`
      );
    }

    // Validate MIME type if provided
    if (mimeType && !mimeType.startsWith("image/") && mimeType !== "application/octet-stream") {
      throw new Error(`Invalid image type: ${mimeType}. Only image/* types are allowed.`);
    }

    const picturesDir = this.picturesDir(groupChatId);
    await mkdir(picturesDir, { recursive: true });

    const finalFilename = await this.generateUniqueFilename(picturesDir, filename);
    const filePath = join(picturesDir, finalFilename);

    await writeFile(filePath, data);

    const stats = await stat(filePath);
    const guessedMime = mimeType || this.guessMimeType(finalFilename) || "image/jpeg";

    const fileInfo: FileInfo = {
      id: randomUUID(),
      name: finalFilename,
      mimeType: guessedMime,
      size: stats.size,
      path: `pictures/${finalFilename}`,
      uploadedAt: new Date().toISOString(),
      uploadedBy: uploadedBy || "",
    };

    return fileInfo;
  }

  /**
   * List all pictures in the group chat
   */
  async listPictures(groupChatId: string): Promise<FileInfo[]> {
    // Verify group chat exists
    const config = await this.getGroupChat(groupChatId);
    if (!config) {
      throw new Error(`Group chat not found: ${groupChatId}`);
    }

    const picturesDir = this.picturesDir(groupChatId);
    if (!existsSync(picturesDir)) {
      return [];
    }

    const entries = await readdir(picturesDir, { withFileTypes: true });
    const pictures: FileInfo[] = [];

    for (const entry of entries) {
      if (entry.isFile()) {
        const filePath = join(picturesDir, entry.name);
        const stats = await stat(filePath);
        const mimeType = this.guessMimeType(entry.name) || "image/jpeg";

        pictures.push({
          id: entry.name, // Using filename as ID for simplicity
          name: entry.name,
          mimeType,
          size: stats.size,
          path: `pictures/${entry.name}`,
          uploadedAt: stats.mtime.toISOString(),
          uploadedBy: "",
        });
      }
    }

    // Sort by upload time descending
    pictures.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());

    return pictures;
  }

  /**
   * Get picture path for download
   */
  getPicturePath(groupChatId: string, filename: string): string {
    const safeFilename = this.sanitizeFilename(filename);
    return join(this.picturesDir(groupChatId), safeFilename);
  }

  /**
   * Get picture content
   */
  async getPictureContent(groupChatId: string, filename: string): Promise<Buffer> {
    // Verify group chat exists
    const config = await this.getGroupChat(groupChatId);
    if (!config) {
      throw new Error(`Group chat not found: ${groupChatId}`);
    }

    const filePath = this.getPicturePath(groupChatId, filename);
    if (!existsSync(filePath)) {
      throw new Error(`Picture not found: ${filename}`);
    }

    return readFile(filePath);
  }

  /**
   * Get picture info by filename
   */
  async getPictureInfo(groupChatId: string, filename: string): Promise<FileInfo | null> {
    const safeFilename = this.sanitizeFilename(filename);
    const filePath = join(this.picturesDir(groupChatId), safeFilename);

    if (!existsSync(filePath)) {
      return null;
    }

    const stats = await stat(filePath);
    const mimeType = this.guessMimeType(safeFilename) || "image/jpeg";

    return {
      id: safeFilename,
      name: safeFilename,
      mimeType,
      size: stats.size,
      path: `pictures/${safeFilename}`,
      uploadedAt: stats.mtime.toISOString(),
      uploadedBy: "",
    };
  }

  /**
   * Delete a picture
   */
  async deletePicture(groupChatId: string, filename: string): Promise<void> {
    // Verify group chat exists
    const config = await this.getGroupChat(groupChatId);
    if (!config) {
      throw new Error(`Group chat not found: ${groupChatId}`);
    }

    const filePath = this.getPicturePath(groupChatId, filename);
    if (!existsSync(filePath)) {
      throw new Error(`Picture not found: ${filename}`);
    }

    await unlink(filePath);
  }

  // ========================================================================
  // Legacy File Handling (for backward compatibility)
  // ========================================================================

  /**
   * Upload a file (legacy method)
   * @deprecated Use saveFile or savePicture instead
   */
  async uploadFile(
    groupChatId: string,
    uploadedBy: string,
    data: Buffer,
    meta: FileUploadMeta
  ): Promise<FileInfo> {
    // Determine directory based on MIME type
    const isImage = meta.mimeType.startsWith("image/");

    if (isImage) {
      return this.savePicture(groupChatId, meta.name, data, uploadedBy, meta.mimeType);
    } else {
      return this.saveFile(groupChatId, meta.name, data, uploadedBy, meta.mimeType);
    }
  }

  /**
   * Get file info by ID (legacy method)
   * @deprecated Use getFileInfo or getPictureInfo instead
   */
  async getFile(groupChatId: string, fileId: string): Promise<FileInfo | null> {
    // Check files directory
    const fileInfo = await this.getFileInfo(groupChatId, fileId);
    if (fileInfo) {
      return fileInfo;
    }

    // Check pictures directory
    const pictureInfo = await this.getPictureInfo(groupChatId, fileId);
    if (pictureInfo) {
      return pictureInfo;
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
