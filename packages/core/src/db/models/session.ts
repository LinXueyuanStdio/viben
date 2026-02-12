/**
 * Session model - file-based session storage
 */
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { getStateDir } from "../../config/paths";
import { readYaml, writeYaml, ensureDir, fileExists } from "../../config/yaml";
import { NotFoundError } from "../../error";
import type { Session, SessionStatus, CreateSession, UpdateSession } from "../types";

/**
 * Sessions file structure
 */
interface SessionsFile {
  sessions: Record<string, SessionEntry>;
}

interface SessionEntry {
  agentId: string;
  taskId?: string;
  status: SessionStatus;
  prompt?: string;
  sessionData: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

function getSessionsPath(): string {
  return join(getStateDir(), "sessions.yaml");
}

async function loadSessions(): Promise<SessionsFile> {
  const path = getSessionsPath();
  if (!fileExists(path)) {
    return { sessions: {} };
  }
  const data = await readYaml<SessionsFile>(path);
  return data || { sessions: {} };
}

async function saveSessions(data: SessionsFile): Promise<void> {
  await ensureDir(getStateDir());
  await writeYaml(getSessionsPath(), data);
}

/**
 * Session model operations
 */
export const SessionModel = {
  /**
   * Find all sessions
   */
  async findAll(): Promise<Session[]> {
    const data = await loadSessions();
    return Object.entries(data.sessions)
      .map(([id, entry]) => ({
        id,
        ...entry,
      }))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  /**
   * Find a session by ID
   */
  async findById(id: string): Promise<Session | null> {
    const data = await loadSessions();
    const entry = data.sessions[id];
    if (!entry) {
      return null;
    }
    return { id, ...entry };
  },

  /**
   * Find sessions by agent ID
   */
  async findByAgentId(agentId: string): Promise<Session[]> {
    const all = await this.findAll();
    return all.filter((s) => s.agentId === agentId);
  },

  /**
   * Find sessions by task ID
   */
  async findByTaskId(taskId: string): Promise<Session[]> {
    const all = await this.findAll();
    return all.filter((s) => s.taskId === taskId);
  },

  /**
   * Find sessions by status
   */
  async findByStatus(status: SessionStatus): Promise<Session[]> {
    const all = await this.findAll();
    return all.filter((s) => s.status === status);
  },

  /**
   * Find active sessions for an agent
   */
  async findActiveByAgentId(agentId: string): Promise<Session[]> {
    const all = await this.findAll();
    return all.filter((s) => s.agentId === agentId && s.status === "active");
  },

  /**
   * Create a new session
   */
  async create(input: CreateSession): Promise<Session> {
    const data = await loadSessions();
    const id = input.id || randomUUID();
    const now = new Date().toISOString();

    const entry: SessionEntry = {
      agentId: input.agentId,
      taskId: input.taskId,
      status: "active",
      prompt: input.prompt,
      sessionData: input.sessionData || {},
      createdAt: now,
      updatedAt: now,
    };

    data.sessions[id] = entry;
    await saveSessions(data);

    return { id, ...entry };
  },

  /**
   * Update a session
   */
  async update(id: string, input: UpdateSession): Promise<Session> {
    const data = await loadSessions();
    const entry = data.sessions[id];
    if (!entry) {
      throw new NotFoundError("Session", id);
    }

    const now = new Date().toISOString();
    const updated: SessionEntry = {
      agentId: entry.agentId,
      taskId: input.taskId ?? entry.taskId,
      status: input.status ?? entry.status,
      prompt: input.prompt ?? entry.prompt,
      sessionData: input.sessionData ?? entry.sessionData,
      createdAt: entry.createdAt,
      updatedAt: now,
    };

    data.sessions[id] = updated;
    await saveSessions(data);

    return { id, ...updated };
  },

  /**
   * Update session status
   */
  async updateStatus(id: string, status: SessionStatus): Promise<void> {
    await this.update(id, { status });
  },

  /**
   * Delete a session
   */
  async delete(id: string): Promise<boolean> {
    const data = await loadSessions();
    if (!data.sessions[id]) {
      return false;
    }
    delete data.sessions[id];
    await saveSessions(data);
    return true;
  },
};
