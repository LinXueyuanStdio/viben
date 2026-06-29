import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { getStateDir } from "../../config/paths";
import type { AcpErrorDetail, AcpPermissionMode } from "../types";

const require = createRequire(import.meta.url);
const DEFAULT_SESSION_INDEX_DB_PATH = join(getStateDir(), "acp", "sessions.sqlite");
const DEFAULT_LIST_STATUSES: AcpSessionRecordStatus[] = ["active", "parked"];
const ACP_SESSION_IDENTITY_SEGMENT_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;

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

export type AcpSessionRecordStatus = "active" | "parked" | "finished" | "error";
export type AcpSessionEventStoreType = "jsonl" | "sqlite" | "remote";

export interface AcpSessionRecord {
  executor_type: string;
  session_id: string;
  status: AcpSessionRecordStatus;
  cwd: string;
  workspace_path?: string;
  agent_dir?: string;
  agent_config_path?: string;
  backend_id?: string;
  title?: string;
  permission_mode?: AcpPermissionMode;
  acp_record: Record<string, unknown>;
  persist_session_id?: string;
  persist_task_id?: string;
  gateway_url?: string;
  event_store_type: AcpSessionEventStoreType;
  event_store_uri: string;
  event_last_seq: number;
  created_at: string;
  last_active_at: string;
  parked_at?: string;
  finished_at?: string;
  deleted_at?: string;
  last_error?: AcpErrorDetail;
  meta?: Record<string, unknown>;
}

export interface ListAcpSessionRecordsInput {
  executor_type?: string;
  statuses?: AcpSessionRecordStatus[];
  include_deleted?: boolean;
  cwd?: string;
  workspace_path?: string;
  agent_config_path?: string;
  persist_task_id?: string;
  limit?: number;
  cursor?: string;
}

export interface AcpSessionIndexStore {
  upsertRecord(record: AcpSessionRecord): Promise<void>;
  getRecord(executorType: string, sessionId: string): Promise<AcpSessionRecord | null>;
  findBySessionId(sessionId: string): Promise<AcpSessionRecord[]>;
  listRecords(input?: ListAcpSessionRecordsInput): Promise<AcpSessionRecord[]>;
  updateStatus(
    executorType: string,
    sessionId: string,
    status: AcpSessionRecordStatus,
    patch?: {
      last_active_at?: string;
      parked_at?: string;
      finished_at?: string;
      last_error?: AcpErrorDetail;
    }
  ): Promise<void>;
  updateEventCursor(executorType: string, sessionId: string, eventLastSeq: number): Promise<void>;
  softDeleteRecord(executorType: string, sessionId: string, deletedAt: string): Promise<void>;
  hardDeleteRecord(executorType: string, sessionId: string): Promise<void>;
}

export function createDefaultAcpSessionIndexStore(): AcpSessionIndexStore {
  if (process.env.VIBEN_ACP_SESSION_INDEX_STORE === "memory") {
    return new InMemoryAcpSessionIndexStore();
  }

  return new SqliteAcpSessionIndexStore(process.env.VIBEN_ACP_SESSION_INDEX_DB_PATH || DEFAULT_SESSION_INDEX_DB_PATH);
}

export function validateAcpSessionIdentity(executorType: string, sessionId: string): void {
  if (!ACP_SESSION_IDENTITY_SEGMENT_RE.test(executorType)) {
    throw new Error("ACP session executor_type must match /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/");
  }
  if (!ACP_SESSION_IDENTITY_SEGMENT_RE.test(sessionId)) {
    throw new Error("ACP session session_id must match /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/");
  }
}

export class InMemoryAcpSessionIndexStore implements AcpSessionIndexStore {
  private records = new Map<string, AcpSessionRecord>();

  async upsertRecord(record: AcpSessionRecord): Promise<void> {
    validateAcpSessionIdentity(record.executor_type, record.session_id);
    const key = recordKey(record.executor_type, record.session_id);
    const existing = this.records.get(key);
    this.records.set(key, cloneRecord({
      ...record,
      event_last_seq: Math.max(existing?.event_last_seq ?? -1, record.event_last_seq),
    }));
  }

  async getRecord(executorType: string, sessionId: string): Promise<AcpSessionRecord | null> {
    validateAcpSessionIdentity(executorType, sessionId);
    const record = this.records.get(recordKey(executorType, sessionId));
    return record ? cloneRecord(record) : null;
  }

  async findBySessionId(sessionId: string): Promise<AcpSessionRecord[]> {
    if (!sessionId.trim()) {
      throw new Error("ACP session session_id is required");
    }
    return Array.from(this.records.values())
      .filter((record) => record.session_id === sessionId)
      .sort(compareLastActiveDesc)
      .map((record) => cloneRecord(record));
  }

  async listRecords(input: ListAcpSessionRecordsInput = {}): Promise<AcpSessionRecord[]> {
    const limit = normalizeLimit(input.limit);
    return Array.from(this.records.values())
      .filter((record) => matchesListInput(record, input))
      .sort(compareLastActiveDesc)
      .slice(0, limit)
      .map((record) => cloneRecord(record));
  }

  async updateStatus(
    executorType: string,
    sessionId: string,
    status: AcpSessionRecordStatus,
    patch: {
      last_active_at?: string;
      parked_at?: string;
      finished_at?: string;
      last_error?: AcpErrorDetail;
    } = {}
  ): Promise<void> {
    const record = await this.getRecord(executorType, sessionId);
    if (!record) return;
    record.status = status;
    record.last_active_at = patch.last_active_at ?? record.last_active_at;
    record.parked_at = patch.parked_at ?? record.parked_at;
    record.finished_at = patch.finished_at ?? record.finished_at;
    if (Object.prototype.hasOwnProperty.call(patch, "last_error")) {
      record.last_error = patch.last_error;
    }
    this.records.set(recordKey(executorType, sessionId), record);
  }

  async updateEventCursor(executorType: string, sessionId: string, eventLastSeq: number): Promise<void> {
    const record = await this.getRecord(executorType, sessionId);
    if (!record) return;
    record.event_last_seq = Math.max(record.event_last_seq, eventLastSeq);
    this.records.set(recordKey(executorType, sessionId), record);
  }

  async softDeleteRecord(executorType: string, sessionId: string, deletedAt: string): Promise<void> {
    const record = await this.getRecord(executorType, sessionId);
    if (!record) return;
    record.deleted_at = deletedAt;
    this.records.set(recordKey(executorType, sessionId), record);
  }

  async hardDeleteRecord(executorType: string, sessionId: string): Promise<void> {
    validateAcpSessionIdentity(executorType, sessionId);
    this.records.delete(recordKey(executorType, sessionId));
  }
}

export class SqliteAcpSessionIndexStore implements AcpSessionIndexStore {
  private db: SqliteDatabase;

  constructor(dbPath: string = DEFAULT_SESSION_INDEX_DB_PATH, db?: SqliteDatabase) {
    if (db) {
      this.db = db;
    } else {
      const DatabaseSync = loadDatabaseSync();
      mkdirSync(join(dbPath, ".."), { recursive: true });
      this.db = new DatabaseSync(dbPath);
    }
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS acp_sessions (
        executor_type TEXT NOT NULL,
        session_id TEXT NOT NULL,
        status TEXT NOT NULL,

        cwd TEXT NOT NULL,
        workspace_path TEXT,
        agent_dir TEXT,
        agent_config_path TEXT,
        backend_id TEXT,

        title TEXT,
        permission_mode TEXT,
        acp_record_json TEXT NOT NULL DEFAULT '{}',

        persist_session_id TEXT,
        persist_task_id TEXT,
        gateway_url TEXT,

        event_store_type TEXT NOT NULL DEFAULT 'jsonl',
        event_store_uri TEXT NOT NULL,
        event_last_seq INTEGER NOT NULL DEFAULT -1,

        created_at TEXT NOT NULL,
        last_active_at TEXT NOT NULL,
        parked_at TEXT,
        finished_at TEXT,
        deleted_at TEXT,
        last_error_json TEXT,

        schema_version INTEGER NOT NULL DEFAULT 1,
        meta_json TEXT,

        PRIMARY KEY (executor_type, session_id)
      );

      CREATE INDEX IF NOT EXISTS idx_acp_sessions_status_last_active
        ON acp_sessions (status, last_active_at DESC);
      CREATE INDEX IF NOT EXISTS idx_acp_sessions_executor_status_last_active
        ON acp_sessions (executor_type, status, last_active_at DESC);
      CREATE INDEX IF NOT EXISTS idx_acp_sessions_cwd_last_active
        ON acp_sessions (cwd, last_active_at DESC);
      CREATE INDEX IF NOT EXISTS idx_acp_sessions_agent_config_path
        ON acp_sessions (agent_config_path);
      CREATE INDEX IF NOT EXISTS idx_acp_sessions_persist_task
        ON acp_sessions (persist_task_id, last_active_at DESC);
    `);
  }

  get dbForTests(): SqliteDatabase {
    return this.db;
  }

  async upsertRecord(record: AcpSessionRecord): Promise<void> {
    validateAcpSessionIdentity(record.executor_type, record.session_id);
    this.db.prepare(`
      INSERT INTO acp_sessions (
        executor_type, session_id, status, cwd, workspace_path, agent_dir, agent_config_path,
        backend_id, title, permission_mode, acp_record_json, persist_session_id, persist_task_id,
        gateway_url, event_store_type, event_store_uri, event_last_seq, created_at, last_active_at,
        parked_at, finished_at, deleted_at, last_error_json, meta_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(executor_type, session_id) DO UPDATE SET
        status = excluded.status,
        cwd = excluded.cwd,
        workspace_path = excluded.workspace_path,
        agent_dir = excluded.agent_dir,
        agent_config_path = excluded.agent_config_path,
        backend_id = excluded.backend_id,
        title = excluded.title,
        permission_mode = excluded.permission_mode,
        acp_record_json = excluded.acp_record_json,
        persist_session_id = excluded.persist_session_id,
        persist_task_id = excluded.persist_task_id,
        gateway_url = excluded.gateway_url,
        event_store_type = excluded.event_store_type,
        event_store_uri = excluded.event_store_uri,
        event_last_seq = MAX(acp_sessions.event_last_seq, excluded.event_last_seq),
        last_active_at = excluded.last_active_at,
        parked_at = excluded.parked_at,
        finished_at = excluded.finished_at,
        deleted_at = excluded.deleted_at,
        last_error_json = excluded.last_error_json,
        meta_json = excluded.meta_json
    `).run(
      record.executor_type,
      record.session_id,
      record.status,
      record.cwd,
      record.workspace_path ?? null,
      record.agent_dir ?? null,
      record.agent_config_path ?? null,
      record.backend_id ?? null,
      record.title ?? null,
      record.permission_mode ?? null,
      JSON.stringify(record.acp_record),
      record.persist_session_id ?? null,
      record.persist_task_id ?? null,
      record.gateway_url ?? null,
      record.event_store_type,
      record.event_store_uri,
      record.event_last_seq,
      record.created_at,
      record.last_active_at,
      record.parked_at ?? null,
      record.finished_at ?? null,
      record.deleted_at ?? null,
      record.last_error ? JSON.stringify(record.last_error) : null,
      record.meta ? JSON.stringify(record.meta) : null
    );
  }

  async getRecord(executorType: string, sessionId: string): Promise<AcpSessionRecord | null> {
    validateAcpSessionIdentity(executorType, sessionId);
    const row = this.db.prepare(`
      SELECT * FROM acp_sessions WHERE executor_type = ? AND session_id = ?
    `).get(executorType, sessionId);
    return row ? rowToRecord(row) : null;
  }

  async findBySessionId(sessionId: string): Promise<AcpSessionRecord[]> {
    if (!sessionId.trim()) {
      throw new Error("ACP session session_id is required");
    }
    const rows = this.db.prepare(`
      SELECT * FROM acp_sessions
      WHERE session_id = ?
      ORDER BY last_active_at DESC
    `).all(sessionId);
    return rows.map((row) => rowToRecord(row));
  }

  async listRecords(input: ListAcpSessionRecordsInput = {}): Promise<AcpSessionRecord[]> {
    const filter = buildListFilter(input);
    const rows = this.db.prepare(`
      SELECT * FROM acp_sessions
      ${filter.where}
      ORDER BY last_active_at DESC
      LIMIT ?
    `).all(...filter.params, normalizeLimit(input.limit));
    return rows.map((row) => rowToRecord(row));
  }

  async updateStatus(
    executorType: string,
    sessionId: string,
    status: AcpSessionRecordStatus,
    patch: {
      last_active_at?: string;
      parked_at?: string;
      finished_at?: string;
      last_error?: AcpErrorDetail;
    } = {}
  ): Promise<void> {
    validateAcpSessionIdentity(executorType, sessionId);
    const hasLastError = Object.prototype.hasOwnProperty.call(patch, "last_error");
    this.db.prepare(`
      UPDATE acp_sessions
      SET
        status = ?,
        last_active_at = COALESCE(?, last_active_at),
        parked_at = COALESCE(?, parked_at),
        finished_at = COALESCE(?, finished_at),
        last_error_json = CASE WHEN ? THEN ? ELSE last_error_json END
      WHERE executor_type = ? AND session_id = ?
    `).run(
      status,
      patch.last_active_at ?? null,
      patch.parked_at ?? null,
      patch.finished_at ?? null,
      hasLastError ? 1 : 0,
      patch.last_error ? JSON.stringify(patch.last_error) : null,
      executorType,
      sessionId
    );
  }

  async updateEventCursor(executorType: string, sessionId: string, eventLastSeq: number): Promise<void> {
    validateAcpSessionIdentity(executorType, sessionId);
    this.db.prepare(`
      UPDATE acp_sessions
      SET event_last_seq = MAX(event_last_seq, ?)
      WHERE executor_type = ? AND session_id = ?
    `).run(eventLastSeq, executorType, sessionId);
  }

  async softDeleteRecord(executorType: string, sessionId: string, deletedAt: string): Promise<void> {
    validateAcpSessionIdentity(executorType, sessionId);
    this.db.prepare(`
      UPDATE acp_sessions
      SET deleted_at = ?
      WHERE executor_type = ? AND session_id = ?
    `).run(deletedAt, executorType, sessionId);
  }

  async hardDeleteRecord(executorType: string, sessionId: string): Promise<void> {
    validateAcpSessionIdentity(executorType, sessionId);
    this.db.prepare(`
      DELETE FROM acp_sessions
      WHERE executor_type = ? AND session_id = ?
    `).run(executorType, sessionId);
  }
}

function recordKey(executorType: string, sessionId: string): string {
  return `${executorType}\u0000${sessionId}`;
}

function cloneRecord(record: AcpSessionRecord): AcpSessionRecord {
  return {
    ...record,
    acp_record: cloneJsonRecord(record.acp_record),
    last_error: record.last_error ? cloneJsonRecord(record.last_error) as AcpErrorDetail : undefined,
    meta: record.meta ? cloneJsonRecord(record.meta) : undefined,
  };
}

function cloneJsonRecord<T extends Record<string, unknown>>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function compareLastActiveDesc(left: AcpSessionRecord, right: AcpSessionRecord): number {
  return right.last_active_at.localeCompare(left.last_active_at);
}

function matchesListInput(record: AcpSessionRecord, input: ListAcpSessionRecordsInput): boolean {
  const statuses = input.statuses ?? DEFAULT_LIST_STATUSES;
  if (!input.include_deleted && record.deleted_at) return false;
  if (!statuses.includes(record.status)) return false;
  if (input.executor_type && record.executor_type !== input.executor_type) return false;
  if (input.cwd && record.cwd !== input.cwd) return false;
  if (input.workspace_path && record.workspace_path !== input.workspace_path) return false;
  if (input.agent_config_path && record.agent_config_path !== input.agent_config_path) return false;
  if (input.persist_task_id && record.persist_task_id !== input.persist_task_id) return false;
  if (input.cursor && record.last_active_at >= input.cursor) return false;
  return true;
}

function normalizeLimit(limit: number | undefined): number {
  return Math.max(1, Math.min(limit ?? 50, 200));
}

function loadDatabaseSync(): DatabaseSyncConstructor {
  // Try Bun's built-in SQLite first (bun:sqlite) for Bun-compiled binaries.
  try {
    const bunSqlite = require("bun:sqlite") as { Database?: DatabaseSyncConstructor };
    if (bunSqlite.Database) {
      return bunSqlite.Database;
    }
  } catch {
    // Not running on Bun, fall through to Node.js.
  }

  // Try Node.js built-in SQLite (node:sqlite, requires Node >= 22.5).
  try {
    const sqlite = require("node:sqlite") as { DatabaseSync?: DatabaseSyncConstructor };
    if (sqlite.DatabaseSync) {
      return sqlite.DatabaseSync;
    }
  } catch {
    // Not available on this runtime.
  }

  throw new Error(
    "No SQLite backend available. Requires Bun (bun:sqlite) or Node.js >= 22.5 (node:sqlite)."
  );
}

function buildListFilter(input: ListAcpSessionRecordsInput): {
  where: string;
  params: unknown[];
} {
  const statuses = input.statuses ?? DEFAULT_LIST_STATUSES;
  const clauses: string[] = [];
  const params: unknown[] = [];

  if (!input.include_deleted) {
    clauses.push("deleted_at IS NULL");
  }
  if (statuses.length > 0) {
    clauses.push(`status IN (${statuses.map(() => "?").join(", ")})`);
    params.push(...statuses);
  }
  if (input.executor_type) {
    clauses.push("executor_type = ?");
    params.push(input.executor_type);
  }
  if (input.cwd) {
    clauses.push("cwd = ?");
    params.push(input.cwd);
  }
  if (input.workspace_path) {
    clauses.push("workspace_path = ?");
    params.push(input.workspace_path);
  }
  if (input.agent_config_path) {
    clauses.push("agent_config_path = ?");
    params.push(input.agent_config_path);
  }
  if (input.persist_task_id) {
    clauses.push("persist_task_id = ?");
    params.push(input.persist_task_id);
  }
  if (input.cursor) {
    clauses.push("last_active_at < ?");
    params.push(input.cursor);
  }

  return {
    where: clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "",
    params,
  };
}

function rowToRecord(row: unknown): AcpSessionRecord {
  if (!isRecord(row)) {
    throw new Error("Invalid acp_sessions row");
  }
  return {
    executor_type: readString(row, "executor_type"),
    session_id: readString(row, "session_id"),
    status: readRecordStatus(row.status),
    cwd: readString(row, "cwd"),
    workspace_path: readOptionalString(row.workspace_path),
    agent_dir: readOptionalString(row.agent_dir),
    agent_config_path: readOptionalString(row.agent_config_path),
    backend_id: readOptionalString(row.backend_id),
    title: readOptionalString(row.title),
    permission_mode: readPermissionMode(row.permission_mode),
    acp_record: parseJsonField<Record<string, unknown>>(row.acp_record_json, {}, "acp_record_json"),
    persist_session_id: readOptionalString(row.persist_session_id),
    persist_task_id: readOptionalString(row.persist_task_id),
    gateway_url: readOptionalString(row.gateway_url),
    event_store_type: readEventStoreType(row.event_store_type),
    event_store_uri: readString(row, "event_store_uri"),
    event_last_seq: readNumber(row.event_last_seq, -1),
    created_at: readString(row, "created_at"),
    last_active_at: readString(row, "last_active_at"),
    parked_at: readOptionalString(row.parked_at),
    finished_at: readOptionalString(row.finished_at),
    deleted_at: readOptionalString(row.deleted_at),
    last_error: parseJsonField<AcpErrorDetail | undefined>(row.last_error_json, undefined, "last_error_json"),
    meta: parseJsonField<Record<string, unknown> | undefined>(row.meta_json, undefined, "meta_json"),
  };
}

function parseJsonField<T>(value: unknown, fallback: T, fieldName: string): T {
  if (typeof value !== "string" || !value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch (error) {
    console.warn({ err: error, field: fieldName }, "Failed to parse ACP session index JSON field");
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

function readNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function readRecordStatus(value: unknown): AcpSessionRecordStatus {
  if (value === "active" || value === "parked" || value === "finished" || value === "error") {
    return value;
  }
  return "error";
}

function readEventStoreType(value: unknown): AcpSessionEventStoreType {
  if (value === "jsonl" || value === "sqlite" || value === "remote") {
    return value;
  }
  return "jsonl";
}

function readPermissionMode(value: unknown): AcpPermissionMode | undefined {
  if (
    value === "default" ||
    value === "bypassPermissions" ||
    value === "auto" ||
    value === "acceptEdits" ||
    value === "dontAsk" ||
    value === "plan"
  ) {
    return value;
  }
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
