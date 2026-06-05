import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { getStateDir } from "../../config/paths";
import type {
  AcpContentBlock,
  AcpSteerPromptRecord,
  AcpSteerPromptStatus,
} from "../types";

const require = createRequire(import.meta.url);
const DEFAULT_STEER_DB_PATH = join(getStateDir(), "acp-steer-prompts.sqlite");

interface SqliteDatabase {
  exec(sql: string): void;
  prepare(sql: string): SqliteStatement;
}

interface SqliteStatement {
  run(...params: unknown[]): unknown;
  get(...params: unknown[]): unknown;
  all(...params: unknown[]): unknown[];
}

interface DatabaseSyncConstructor {
  new(path: string): SqliteDatabase;
}

export interface CreateSteerPromptInput {
  session_id: string;
  agent_id: string;
  user_id: string;
  prompt_json: AcpContentBlock[];
  meta_json?: Record<string, unknown>;
}

export interface ListSteerPromptInput {
  session_id: string;
  agent_id?: string;
  user_id?: string;
  status?: AcpSteerPromptStatus;
  limit?: number;
  cursor?: string;
}

export interface AcpSteerPromptStore {
  create(input: CreateSteerPromptInput): Promise<AcpSteerPromptRecord>;
  get(sessionId: string, promptId: string): Promise<AcpSteerPromptRecord | undefined>;
  list(input: ListSteerPromptInput): Promise<AcpSteerPromptRecord[]>;
  count?(input: Omit<ListSteerPromptInput, "limit" | "cursor">): Promise<number>;
  cancel(sessionId: string, promptId: string): Promise<AcpSteerPromptRecord | undefined>;
  consumeNext(sessionId: string): Promise<AcpSteerPromptRecord | undefined>;
  consumeQueued(sessionId: string): Promise<AcpSteerPromptRecord[]>;
  markCompleted(sessionId: string, promptId: string): Promise<AcpSteerPromptRecord | undefined>;
  markFailed(sessionId: string, promptId: string, error: string): Promise<AcpSteerPromptRecord | undefined>;
}

export function createDefaultAcpSteerPromptStore(): AcpSteerPromptStore {
  if (process.env.VIBEN_ACP_STEER_STORE === "memory") {
    return new InMemoryAcpSteerPromptStore();
  }

  try {
    return new SqliteAcpSteerPromptStore(process.env.VIBEN_ACP_STEER_DB_PATH || DEFAULT_STEER_DB_PATH);
  } catch {
    return new InMemoryAcpSteerPromptStore();
  }
}

export class InMemoryAcpSteerPromptStore implements AcpSteerPromptStore {
  private records = new Map<string, AcpSteerPromptRecord>();

  async create(input: CreateSteerPromptInput): Promise<AcpSteerPromptRecord> {
    const now = new Date().toISOString();
    const record: AcpSteerPromptRecord = {
      id: randomUUID(),
      session_id: input.session_id,
      agent_id: input.agent_id,
      user_id: input.user_id,
      prompt_json: input.prompt_json,
      status: "queued",
      created_at: now,
      meta_json: input.meta_json,
    };
    this.records.set(record.id, record);
    return cloneRecord(record);
  }

  async get(sessionId: string, promptId: string): Promise<AcpSteerPromptRecord | undefined> {
    const record = this.records.get(promptId);
    if (!record || record.session_id !== sessionId) return undefined;
    return cloneRecord(record);
  }

  async list(input: ListSteerPromptInput): Promise<AcpSteerPromptRecord[]> {
    const offset = parseCursor(input.cursor);
    const limit = Math.max(1, Math.min(input.limit ?? 20, 100));
    return this.filteredRecords(input)
      .sort((left, right) => left.created_at.localeCompare(right.created_at))
      .slice(offset, offset + limit)
      .map((record) => cloneRecord(record));
  }

  async count(input: Omit<ListSteerPromptInput, "limit" | "cursor">): Promise<number> {
    return this.filteredRecords(input).length;
  }

  async cancel(sessionId: string, promptId: string): Promise<AcpSteerPromptRecord | undefined> {
    const record = this.records.get(promptId);
    if (!record || record.session_id !== sessionId) return undefined;
    if (record.status !== "queued") return cloneRecord(record);
    record.status = "cancelled";
    record.cancelled_at = new Date().toISOString();
    return cloneRecord(record);
  }

  async consumeNext(sessionId: string): Promise<AcpSteerPromptRecord | undefined> {
    const record = Array.from(this.records.values())
      .filter((item) => item.session_id === sessionId && item.status === "queued")
      .sort((left, right) => left.created_at.localeCompare(right.created_at))[0];
    if (!record) return undefined;
    record.status = "consumed";
    record.consumed_at = new Date().toISOString();
    return cloneRecord(record);
  }

  async consumeQueued(sessionId: string): Promise<AcpSteerPromptRecord[]> {
    const records = Array.from(this.records.values())
      .filter((item) => item.session_id === sessionId && item.status === "queued")
      .sort((left, right) => left.created_at.localeCompare(right.created_at));
    const now = new Date().toISOString();
    for (const record of records) {
      record.status = "consumed";
      record.consumed_at = now;
    }
    return records.map((record) => cloneRecord(record));
  }

  async markCompleted(sessionId: string, promptId: string): Promise<AcpSteerPromptRecord | undefined> {
    const record = this.records.get(promptId);
    if (!record || record.session_id !== sessionId) return undefined;
    if (record.status !== "consumed") return cloneRecord(record);
    record.status = "completed";
    record.completed_at = new Date().toISOString();
    return cloneRecord(record);
  }

  async markFailed(sessionId: string, promptId: string, error: string): Promise<AcpSteerPromptRecord | undefined> {
    const record = this.records.get(promptId);
    if (!record || record.session_id !== sessionId) return undefined;
    if (record.status !== "consumed") return cloneRecord(record);
    record.status = "failed";
    record.completed_at = new Date().toISOString();
    record.error = error;
    return cloneRecord(record);
  }

  private filteredRecords(input: Omit<ListSteerPromptInput, "limit" | "cursor">): AcpSteerPromptRecord[] {
    return Array.from(this.records.values())
      .filter((record) => record.session_id === input.session_id)
      .filter((record) => !input.agent_id || record.agent_id === input.agent_id)
      .filter((record) => !input.user_id || record.user_id === input.user_id)
      .filter((record) => !input.status || record.status === input.status);
  }
}

export class SqliteAcpSteerPromptStore implements AcpSteerPromptStore {
  private db: SqliteDatabase;

  constructor(dbPath: string = DEFAULT_STEER_DB_PATH) {
    const DatabaseSync = loadDatabaseSync();
    mkdirSync(join(dbPath, ".."), { recursive: true });
    this.db = new DatabaseSync(dbPath);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS acp_steer_prompts (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        agent_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        prompt_json TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        consumed_at TEXT,
        cancelled_at TEXT,
        completed_at TEXT,
        error TEXT,
        meta_json TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_acp_steer_prompts_session_status_created
        ON acp_steer_prompts (session_id, status, created_at);
      CREATE INDEX IF NOT EXISTS idx_acp_steer_prompts_agent_user
        ON acp_steer_prompts (agent_id, user_id);
    `);
  }

  async create(input: CreateSteerPromptInput): Promise<AcpSteerPromptRecord> {
    const record: AcpSteerPromptRecord = {
      id: randomUUID(),
      session_id: input.session_id,
      agent_id: input.agent_id,
      user_id: input.user_id,
      prompt_json: input.prompt_json,
      status: "queued",
      created_at: new Date().toISOString(),
      meta_json: input.meta_json,
    };
    this.db.prepare(`
      INSERT INTO acp_steer_prompts (
        id, session_id, agent_id, user_id, prompt_json, status, created_at, meta_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      record.id,
      record.session_id,
      record.agent_id,
      record.user_id,
      JSON.stringify(record.prompt_json),
      record.status,
      record.created_at,
      record.meta_json ? JSON.stringify(record.meta_json) : null
    );
    return cloneRecord(record);
  }

  async get(sessionId: string, promptId: string): Promise<AcpSteerPromptRecord | undefined> {
    const row = this.db.prepare(`
      SELECT * FROM acp_steer_prompts WHERE session_id = ? AND id = ?
    `).get(sessionId, promptId);
    return row ? rowToRecord(row) : undefined;
  }

  async list(input: ListSteerPromptInput): Promise<AcpSteerPromptRecord[]> {
    const filter = buildListFilter(input);
    const offset = parseCursor(input.cursor);
    const limit = Math.max(1, Math.min(input.limit ?? 20, 100));
    const rows = this.db.prepare(`
      SELECT * FROM acp_steer_prompts
      ${filter.where}
      ORDER BY created_at ASC
      LIMIT ? OFFSET ?
    `).all(...filter.params, limit, offset);
    return rows.map((row) => rowToRecord(row));
  }

  async count(input: Omit<ListSteerPromptInput, "limit" | "cursor">): Promise<number> {
    const filter = buildListFilter(input);
    const row = this.db.prepare(`
      SELECT COUNT(*) AS count FROM acp_steer_prompts ${filter.where}
    `).get(...filter.params);
    if (!isRecord(row) || typeof row.count !== "number") return 0;
    return row.count;
  }

  async cancel(sessionId: string, promptId: string): Promise<AcpSteerPromptRecord | undefined> {
    const now = new Date().toISOString();
    this.db.prepare(`
      UPDATE acp_steer_prompts
      SET status = 'cancelled', cancelled_at = ?
      WHERE session_id = ? AND id = ? AND status = 'queued'
    `).run(now, sessionId, promptId);
    return await this.get(sessionId, promptId);
  }

  async consumeNext(sessionId: string): Promise<AcpSteerPromptRecord | undefined> {
    const row = this.db.prepare(`
      SELECT id FROM acp_steer_prompts
      WHERE session_id = ? AND status = 'queued'
      ORDER BY created_at ASC
      LIMIT 1
    `).get(sessionId);
    if (!isRecord(row) || typeof row.id !== "string") return undefined;

    const now = new Date().toISOString();
    this.db.prepare(`
      UPDATE acp_steer_prompts
      SET status = 'consumed', consumed_at = ?
      WHERE session_id = ? AND id = ? AND status = 'queued'
    `).run(now, sessionId, row.id);
    const record = await this.get(sessionId, row.id);
    return record?.status === "consumed" ? record : undefined;
  }

  async consumeQueued(sessionId: string): Promise<AcpSteerPromptRecord[]> {
    const rows = this.db.prepare(`
      SELECT id FROM acp_steer_prompts
      WHERE session_id = ? AND status = 'queued'
      ORDER BY created_at ASC
    `).all(sessionId);
    const ids = rows
      .map((row) => isRecord(row) && typeof row.id === "string" ? row.id : undefined)
      .filter((id): id is string => Boolean(id));
    if (ids.length === 0) return [];

    const now = new Date().toISOString();
    const consumed: AcpSteerPromptRecord[] = [];
    for (const id of ids) {
      this.db.prepare(`
        UPDATE acp_steer_prompts
        SET status = 'consumed', consumed_at = ?
        WHERE session_id = ? AND id = ? AND status = 'queued'
      `).run(now, sessionId, id);
      const record = await this.get(sessionId, id);
      if (record?.status === "consumed") {
        consumed.push(record);
      }
    }
    return consumed;
  }

  async markCompleted(sessionId: string, promptId: string): Promise<AcpSteerPromptRecord | undefined> {
    this.db.prepare(`
      UPDATE acp_steer_prompts
      SET status = 'completed', completed_at = ?
      WHERE session_id = ? AND id = ? AND status = 'consumed'
    `).run(new Date().toISOString(), sessionId, promptId);
    return await this.get(sessionId, promptId);
  }

  async markFailed(sessionId: string, promptId: string, error: string): Promise<AcpSteerPromptRecord | undefined> {
    this.db.prepare(`
      UPDATE acp_steer_prompts
      SET status = 'failed', completed_at = ?, error = ?
      WHERE session_id = ? AND id = ? AND status = 'consumed'
    `).run(new Date().toISOString(), error, sessionId, promptId);
    return await this.get(sessionId, promptId);
  }
}

function cloneRecord(record: AcpSteerPromptRecord): AcpSteerPromptRecord {
  return {
    ...record,
    prompt_json: record.prompt_json.map((block) => ({ ...block })),
    meta_json: record.meta_json ? { ...record.meta_json } : undefined,
  };
}

function parseCursor(cursor: string | undefined): number {
  if (!cursor) return 0;
  const offset = Number.parseInt(cursor, 10);
  return Number.isFinite(offset) && offset > 0 ? offset : 0;
}

function loadDatabaseSync(): DatabaseSyncConstructor {
  const sqlite = require("node:sqlite") as { DatabaseSync?: DatabaseSyncConstructor };
  if (!sqlite.DatabaseSync) {
    throw new Error("node:sqlite DatabaseSync is unavailable");
  }
  return sqlite.DatabaseSync;
}

function buildListFilter(input: Omit<ListSteerPromptInput, "limit" | "cursor">): {
  where: string;
  params: unknown[];
} {
  const clauses = ["session_id = ?"];
  const params: unknown[] = [input.session_id];
  if (input.agent_id) {
    clauses.push("agent_id = ?");
    params.push(input.agent_id);
  }
  if (input.user_id) {
    clauses.push("user_id = ?");
    params.push(input.user_id);
  }
  if (input.status) {
    clauses.push("status = ?");
    params.push(input.status);
  }
  return {
    where: `WHERE ${clauses.join(" AND ")}`,
    params,
  };
}

function rowToRecord(row: unknown): AcpSteerPromptRecord {
  if (!isRecord(row)) {
    throw new Error("Invalid acp_steer_prompts row");
  }
  return {
    id: readString(row, "id"),
    session_id: readString(row, "session_id"),
    agent_id: readString(row, "agent_id"),
    user_id: readString(row, "user_id"),
    prompt_json: parseJsonField<AcpContentBlock[]>(row.prompt_json, []),
    status: readSteerStatus(row.status),
    created_at: readString(row, "created_at"),
    consumed_at: readOptionalString(row.consumed_at),
    cancelled_at: readOptionalString(row.cancelled_at),
    completed_at: readOptionalString(row.completed_at),
    error: readOptionalString(row.error),
    meta_json: parseJsonField<Record<string, unknown> | undefined>(row.meta_json, undefined),
  };
}

function parseJsonField<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string" || !value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function readString(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  return typeof value === "string" ? value : "";
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value ? value : undefined;
}

function readSteerStatus(value: unknown): AcpSteerPromptStatus {
  if (
    value === "queued" ||
    value === "consumed" ||
    value === "completed" ||
    value === "failed" ||
    value === "cancelled" ||
    value === "expired"
  ) {
    return value;
  }
  return "failed";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
