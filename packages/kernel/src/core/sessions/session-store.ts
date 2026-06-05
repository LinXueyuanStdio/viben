import fs from "node:fs";
import path from "node:path";
import type { SessionRecord } from "../types.js";
import { createChildLogger } from "../utils/log.js";

const log = createChildLogger({ module: "session-store" });

/** Persistence interface for session records. Implementations handle serialization format and storage. */
export interface SessionStore {
  save(record: SessionRecord): Promise<void>;
  /** Immediately flush pending writes to disk (no debounce). */
  flush(): void;
  get(sessionId: string): SessionRecord | undefined;
  findByPlatform(
    channelId: string,
    predicate: (platform: Record<string, unknown>) => boolean,
  ): SessionRecord | undefined;
  findByAgentSessionId(agentSessionId: string): SessionRecord | undefined;
  findAssistant(channelId: string): SessionRecord | undefined;
  list(channelId?: string): SessionRecord[];
  remove(sessionId: string): Promise<void>;
}

/** On-disk JSON format: versioned envelope wrapping a session ID → record map. */
interface StoreFile {
  version: number;
  sessions: Record<string, SessionRecord>;
}

/** Writes are debounced to avoid excessive disk I/O during rapid state changes. */
const DEBOUNCE_MS = 2000;

/**
 * JSON file-backed session store.
 *
 * Reads the entire store into memory on startup, applies all mutations in-memory,
 * and debounces writes to disk. Expired records (past ttlDays) are cleaned up
 * periodically. On shutdown, pending writes are flushed synchronously.
 */
export class JsonFileSessionStore implements SessionStore {
  private records: Map<string, SessionRecord> = new Map();
  private filePath: string;
  private ttlDays: number;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;
  private flushHandler: (() => void) | null = null;

  constructor(filePath: string, ttlDays: number) {
    this.filePath = filePath;
    this.ttlDays = ttlDays;
    this.load();
    this.cleanup();

    // Daily cleanup for long-running instances
    this.cleanupInterval = setInterval(
      () => this.cleanup(),
      24 * 60 * 60 * 1000,
    );

    // Force flush on shutdown
    this.flushHandler = () => this.flushSync();
    process.on("SIGTERM", this.flushHandler);
    process.on("SIGINT", this.flushHandler);
    process.on("exit", this.flushHandler);
  }

  async save(record: SessionRecord): Promise<void> {
    this.records.set(record.sessionId, { ...record });
    this.scheduleDiskWrite();
  }

  get(sessionId: string): SessionRecord | undefined {
    return this.records.get(sessionId);
  }

  findByPlatform(
    channelId: string,
    predicate: (platform: Record<string, unknown>) => boolean,
  ): SessionRecord | undefined {
    for (const record of this.records.values()) {
      // Check new platforms format first
      if (record.platforms?.[channelId]) {
        if (predicate(record.platforms[channelId])) return record;
      }
      // Fallback to legacy platform field
      if (record.channelId === channelId && predicate(record.platform as Record<string, unknown>)) {
        return record;
      }
    }
    return undefined;
  }

  /**
   * Find a session by its ACP agent session ID.
   * Checks current, original, and historical agent session IDs (from agent switches)
   * since the agent session ID changes on each switch.
   */
  findByAgentSessionId(agentSessionId: string): SessionRecord | undefined {
    for (const record of this.records.values()) {
      if (
        record.agentSessionId === agentSessionId ||
        record.originalAgentSessionId === agentSessionId
      ) {
        return record;
      }
      if (record.agentSwitchHistory?.some((e) => e.agentSessionId === agentSessionId)) {
        return record;
      }
    }
    return undefined;
  }

  findAssistant(channelId: string): SessionRecord | undefined {
    for (const record of this.records.values()) {
      if (record.isAssistant === true && record.channelId === channelId) {
        return record;
      }
    }
    return undefined;
  }

  list(channelId?: string): SessionRecord[] {
    const all = [...this.records.values()];
    if (channelId) return all.filter((r) => r.channelId === channelId);
    return all;
  }

  async remove(sessionId: string): Promise<void> {
    this.records.delete(sessionId);
    this.scheduleDiskWrite();
  }

  flush(): void {
    this.flushSync();
  }

  flushSync(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    const data: StoreFile = {
      version: 1,
      sessions: Object.fromEntries(this.records),
    };
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    // Write to a temp file first, then atomically rename into place.
    // This prevents sessions.json from being left in a corrupt state if the
    // process is killed (SIGKILL, OOM) while the write is in progress.
    const tmpPath = `${this.filePath}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2));
    fs.renameSync(tmpPath, this.filePath);
  }

  /** Clean up timers and process listeners. Call on shutdown to prevent leaks. */
  destroy(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    if (this.cleanupInterval) clearInterval(this.cleanupInterval);
    if (this.flushHandler) {
      process.removeListener("SIGTERM", this.flushHandler);
      process.removeListener("SIGINT", this.flushHandler);
      process.removeListener("exit", this.flushHandler);
      this.flushHandler = null;
    }
  }

  private load(): void {
    // Remove any orphaned temp file left by a previous interrupted write.
    // If the crash happened before the rename, sessions.json is still the last
    // good state and the .tmp file is stale — safe to delete.
    try { fs.unlinkSync(`${this.filePath}.tmp`); } catch { /* not present */ }

    if (!fs.existsSync(this.filePath)) return;
    try {
      const raw = JSON.parse(
        fs.readFileSync(this.filePath, "utf-8"),
      ) as StoreFile;
      if (raw.version !== 1) {
        log.warn(
          { version: raw.version },
          "Unknown session store version, skipping load",
        );
        return;
      }
      for (const [id, record] of Object.entries(raw.sessions)) {
        this.records.set(id, this.migrateRecord(record));
      }
      log.debug({ count: this.records.size }, "Loaded session records");
    } catch (err) {
      log.error({ err }, "Failed to load session store, backing up corrupt file");
      try {
        fs.renameSync(this.filePath, `${this.filePath}.bak`);
      } catch { /* best effort */ }
    }
  }

  /**
   * Migrate old SessionRecord format to new multi-adapter format.
   * Converts single-adapter `platform` field to per-adapter `platforms` map,
   * and initializes `attachedAdapters` for records created before multi-adapter support.
   */
  private migrateRecord(record: SessionRecord): SessionRecord {
    // Migrate platform → platforms
    if (!record.platforms && record.platform && typeof record.platform === "object") {
      const platformData = record.platform as Record<string, unknown>;
      if (Object.keys(platformData).length > 0) {
        record.platforms = { [record.channelId]: platformData };
      }
    }
    // Default attachedAdapters
    if (!record.attachedAdapters) {
      record.attachedAdapters = [record.channelId];
    }
    return record;
  }

  /** Remove expired session records (past TTL). Active and assistant sessions are preserved. */
  private cleanup(): void {
    const cutoff = Date.now() - this.ttlDays * 24 * 60 * 60 * 1000;
    let removed = 0;
    for (const [id, record] of this.records) {
      if (record.status === "active" || record.status === "initializing")
        continue;
      if (record.isAssistant === true)
        continue;
      const raw = record.lastActiveAt;
      if (!raw) continue;
      const lastActive = new Date(raw).getTime();
      if (isNaN(lastActive)) continue;
      if (lastActive < cutoff) {
        this.records.delete(id);
        removed++;
      }
    }
    if (removed > 0) {
      log.info({ removed }, "Cleaned up expired session records");
      this.scheduleDiskWrite();
    }
  }

  private scheduleDiskWrite(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.flushSync();
    }, DEBOUNCE_MS);
  }
}
