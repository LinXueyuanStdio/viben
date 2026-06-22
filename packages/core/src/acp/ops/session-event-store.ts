import * as fs from "node:fs/promises";
import * as path from "node:path";
import { join } from "node:path";
import { getStateDir } from "../../config/paths";
import { logger as globalLogger } from "../../telemetry";
import { AsyncLock } from "../../utils/async-lock";
import { validateAcpSessionIdentity } from "./session-index-store";
import type {
  AcpSessionEvent,
  AcpSessionEventPatch,
  AcpSessionEventStatus,
} from "../types";

const DEFAULT_EVENT_ROOT = join(getStateDir(), "acp", "sessions");
const EVENTS_FILE = "events.jsonl";
const log = globalLogger.child({ module: "acp-session-event-store" });

export interface AcpSessionEventIdentity {
  executor_type: string;
  session_id: string;
}

export interface AcpSessionEventStore {
  appendEvent(identity: AcpSessionEventIdentity, event: Omit<AcpSessionEvent, "seq">): Promise<number>;
  updateEventStatus(identity: AcpSessionEventIdentity, seq: number, status: AcpSessionEvent["status"]): Promise<void>;
  loadEvents(identity: AcpSessionEventIdentity): Promise<AcpSessionEvent[]>;
  getEventStoreUri(identity: AcpSessionEventIdentity): string;
  deleteEvents(identity: AcpSessionEventIdentity): Promise<void>;
}

type JsonlSessionEventRecord = AcpSessionEvent | AcpSessionEventPatch;

export class JsonlAcpSessionEventStore implements AcpSessionEventStore {
  private readonly writeLock = new AsyncLock();
  private readonly seqCounters = new Map<string, number>();

  constructor(private readonly baseDir: string = DEFAULT_EVENT_ROOT) {}

  async appendEvent(identity: AcpSessionEventIdentity, event: Omit<AcpSessionEvent, "seq">): Promise<number> {
    validateAcpSessionIdentity(identity.executor_type, identity.session_id);
    return this.writeLock.withLock(lockKey(identity), async () => {
      const seq = await this.getNextSeq(identity);
      await fs.mkdir(this.sessionDir(identity), { recursive: true });
      await fs.appendFile(this.eventsPath(identity), `${JSON.stringify({ ...event, seq })}\n`, "utf8");
      return seq;
    });
  }

  async updateEventStatus(
    identity: AcpSessionEventIdentity,
    seq: number,
    status: AcpSessionEvent["status"]
  ): Promise<void> {
    validateAcpSessionIdentity(identity.executor_type, identity.session_id);
    await this.writeLock.withLock(lockKey(identity), async () => {
      const patch: AcpSessionEventPatch = {
        _type: "patch",
        target_seq: seq,
        patch: { status: status as AcpSessionEventStatus },
      };
      await fs.mkdir(this.sessionDir(identity), { recursive: true });
      await fs.appendFile(this.eventsPath(identity), `${JSON.stringify(patch)}\n`, "utf8");
    });
  }

  async loadEvents(identity: AcpSessionEventIdentity): Promise<AcpSessionEvent[]> {
    validateAcpSessionIdentity(identity.executor_type, identity.session_id);
    const lines = await this.readEventLines(identity);
    const events = new Map<number, AcpSessionEvent>();

    lines.forEach((line, index) => {
      const record = this.parseRecord(line, identity, index + 1);
      if (!record) return;

      if (isPatchRecord(record)) {
        const event = events.get(record.target_seq);
        if (event) {
          events.set(record.target_seq, { ...event, ...record.patch });
        }
        return;
      }

      events.set(record.seq, record);
    });

    return Array.from(events.values()).sort((left, right) => left.seq - right.seq);
  }

  getEventStoreUri(identity: AcpSessionEventIdentity): string {
    validateAcpSessionIdentity(identity.executor_type, identity.session_id);
    return path.join(this.sessionDir(identity), EVENTS_FILE);
  }

  async deleteEvents(identity: AcpSessionEventIdentity): Promise<void> {
    validateAcpSessionIdentity(identity.executor_type, identity.session_id);
    await this.writeLock.withLock(lockKey(identity), async () => {
      await fs.rm(this.sessionDir(identity), { recursive: true, force: true });
      this.seqCounters.delete(lockKey(identity));
    });
  }

  private eventsPath(identity: AcpSessionEventIdentity): string {
    return this.getEventStoreUri(identity);
  }

  private sessionDir(identity: AcpSessionEventIdentity): string {
    const base = path.resolve(this.baseDir);
    const resolved = path.resolve(base, safePathSegment(identity.executor_type), safePathSegment(identity.session_id));
    if (!isPathInside(resolved, base)) {
      throw new Error(`ACP session event path escapes root: ${identity.executor_type}/${identity.session_id}`);
    }
    return resolved;
  }

  private async getNextSeq(identity: AcpSessionEventIdentity): Promise<number> {
    const key = lockKey(identity);
    const cachedSeq = this.seqCounters.get(key);
    if (cachedSeq !== undefined) {
      const nextSeq = cachedSeq + 1;
      this.seqCounters.set(key, nextSeq);
      return nextSeq;
    }

    const maxSeq = await this.readMaxSeq(identity);
    const nextSeq = maxSeq + 1;
    this.seqCounters.set(key, nextSeq);
    return nextSeq;
  }

  private async readMaxSeq(identity: AcpSessionEventIdentity): Promise<number> {
    let maxSeq = -1;
    const lines = await this.readEventLines(identity);
    lines.forEach((line, index) => {
      const record = this.parseRecord(line, identity, index + 1);
      if (record && !isPatchRecord(record) && Number.isInteger(record.seq)) {
        maxSeq = Math.max(maxSeq, record.seq);
      }
    });
    return maxSeq;
  }

  private async readEventLines(identity: AcpSessionEventIdentity): Promise<string[]> {
    try {
      const content = await fs.readFile(this.eventsPath(identity), "utf8");
      return content.split(/\r?\n/).filter((line) => line.trim().length > 0);
    } catch (error) {
      if (isNodeError(error) && error.code === "ENOENT") {
        return [];
      }
      throw error;
    }
  }

  private parseRecord(line: string, identity: AcpSessionEventIdentity, lineNumber: number): JsonlSessionEventRecord | undefined {
    try {
      const record = JSON.parse(line) as unknown;
      if (isEventRecord(record) || isPatchRecord(record)) {
        return record;
      }
      log.warn({ identity, lineNumber }, "Skipping invalid ACP session event JSONL record");
      return undefined;
    } catch (error) {
      log.warn({ err: error, identity, lineNumber }, "Skipping malformed ACP session event JSONL line");
      return undefined;
    }
  }
}

export class InMemoryAcpSessionEventStore implements AcpSessionEventStore {
  private readonly events = new Map<string, AcpSessionEvent[]>();
  private readonly seqCounters = new Map<string, number>();

  async appendEvent(identity: AcpSessionEventIdentity, event: Omit<AcpSessionEvent, "seq">): Promise<number> {
    validateAcpSessionIdentity(identity.executor_type, identity.session_id);
    const key = lockKey(identity);
    const seq = (this.seqCounters.get(key) ?? -1) + 1;
    this.seqCounters.set(key, seq);
    this.events.set(key, [...(this.events.get(key) ?? []), cloneEvent({ ...event, seq })]);
    return seq;
  }

  async updateEventStatus(
    identity: AcpSessionEventIdentity,
    seq: number,
    status: AcpSessionEvent["status"]
  ): Promise<void> {
    validateAcpSessionIdentity(identity.executor_type, identity.session_id);
    const key = lockKey(identity);
    const events = this.events.get(key) ?? [];
    this.events.set(
      key,
      events.map((event) => (event.seq === seq ? { ...event, status } : event))
    );
  }

  async loadEvents(identity: AcpSessionEventIdentity): Promise<AcpSessionEvent[]> {
    validateAcpSessionIdentity(identity.executor_type, identity.session_id);
    return [...(this.events.get(lockKey(identity)) ?? [])]
      .sort((left, right) => left.seq - right.seq)
      .map((event) => cloneEvent(event));
  }

  getEventStoreUri(identity: AcpSessionEventIdentity): string {
    validateAcpSessionIdentity(identity.executor_type, identity.session_id);
    return `memory://acp/sessions/${safePathSegment(identity.executor_type)}/${safePathSegment(identity.session_id)}/${EVENTS_FILE}`;
  }

  async deleteEvents(identity: AcpSessionEventIdentity): Promise<void> {
    validateAcpSessionIdentity(identity.executor_type, identity.session_id);
    const key = lockKey(identity);
    this.events.delete(key);
    this.seqCounters.delete(key);
  }
}

export function createDefaultAcpSessionEventStore(): AcpSessionEventStore {
  if (process.env.VIBEN_ACP_SESSION_EVENT_STORE === "memory") {
    return new InMemoryAcpSessionEventStore();
  }
  return new JsonlAcpSessionEventStore(process.env.VIBEN_ACP_SESSION_EVENT_ROOT || DEFAULT_EVENT_ROOT);
}

function lockKey(identity: AcpSessionEventIdentity): string {
  return `${identity.executor_type}:${identity.session_id}`;
}

function safePathSegment(value: string): string {
  if (!value) {
    throw new Error("ACP session event identity segments must not be empty");
  }
  return value;
}

function isPathInside(child: string, parent: string): boolean {
  const relativePath = path.relative(parent, child);
  return relativePath !== "" && relativePath !== ".." && !relativePath.startsWith(`..${path.sep}`) && !path.isAbsolute(relativePath);
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

function isEventRecord(record: unknown): record is AcpSessionEvent {
  return (
    typeof record === "object" &&
    record !== null &&
    !("_type" in record) &&
    Number.isInteger((record as { seq?: unknown }).seq)
  );
}

function isPatchRecord(record: unknown): record is AcpSessionEventPatch {
  return (
    typeof record === "object" &&
    record !== null &&
    (record as { _type?: unknown })._type === "patch" &&
    Number.isInteger((record as { target_seq?: unknown }).target_seq) &&
    typeof (record as { patch?: unknown }).patch === "object" &&
    (record as { patch?: unknown }).patch !== null
  );
}

function cloneEvent(event: AcpSessionEvent): AcpSessionEvent {
  return structuredClone(event);
}
