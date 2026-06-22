import { describe, expect, it } from "vitest";
import { DefaultAcpSessionStorageAdapter, cleanupStaleAcpSessions } from "./session-storage";
import type { AcpSessionEventIdentity, AcpSessionEventStore } from "./session-event-store";
import type { AcpSessionIndexStore, AcpSessionRecord } from "./session-index-store";

describe("DefaultAcpSessionStorageAdapter", () => {
  it("hard deletes the index record before deleting events", async () => {
    const calls: string[] = [];
    const identity: AcpSessionEventIdentity = {
      executor_type: "CLAUDE_CODE",
      session_id: "session-1",
    };
    const index = createIndexStore({
      async hardDeleteRecord(executorType: string, sessionId: string): Promise<void> {
        expect(executorType).toBe(identity.executor_type);
        expect(sessionId).toBe(identity.session_id);
        calls.push("index");
      },
    });
    const events = createEventStore(calls, {
      async deleteEvents(receivedIdentity: AcpSessionEventIdentity): Promise<void> {
        expect(receivedIdentity).toEqual(identity);
        calls.push("events");
      },
    });

    const storage = new DefaultAcpSessionStorageAdapter(index, events);

    await storage.hardDeleteSession(identity);

    expect(calls).toEqual(["index", "events"]);
  });
});

describe("cleanupStaleAcpSessions", () => {
  it("finishes stale parked sessions without deleting their events", async () => {
    const stale = baseRecord();
    const calls: string[] = [];
    const index = createIndexStore({
      async listRecords(): Promise<AcpSessionRecord[]> {
        return [stale];
      },
      async getRecord(executorType: string, sessionId: string): Promise<AcpSessionRecord | null> {
        expect(executorType).toBe(stale.executor_type);
        expect(sessionId).toBe(stale.session_id);
        calls.push("getRecord");
        return stale;
      },
      async updateStatus(
        executorType: string,
        sessionId: string,
        status: string
      ): Promise<void> {
        expect(executorType).toBe(stale.executor_type);
        expect(sessionId).toBe(stale.session_id);
        expect(status).toBe("finished");
        calls.push("updateStatus");
      },
    });
    const events = createEventStore(calls);

    await cleanupStaleAcpSessions(new DefaultAcpSessionStorageAdapter(index, events));

    expect(calls).toEqual(["getRecord", "updateStatus"]);
  });

  it("does not finish a stale parked session that changed before update", async () => {
    const stale = baseRecord();
    const calls: string[] = [];
    const index = createIndexStore({
      async listRecords(): Promise<AcpSessionRecord[]> {
        return [stale];
      },
      async getRecord(): Promise<AcpSessionRecord | null> {
        calls.push("getRecord");
        return {
          ...stale,
          status: "active",
          last_active_at: "2026-06-22T00:00:00.000Z",
        };
      },
      async updateStatus(): Promise<void> {
        calls.push("updateStatus");
      },
    });
    const events = createEventStore(calls);

    await cleanupStaleAcpSessions(new DefaultAcpSessionStorageAdapter(index, events));

    expect(calls).toEqual(["getRecord"]);
  });
});

function baseRecord(overrides: Partial<AcpSessionRecord> = {}): AcpSessionRecord {
  return {
    executor_type: "CLAUDE_CODE",
    session_id: "session-1",
    status: "parked",
    cwd: "/repo",
    acp_record: {},
    event_store_type: "jsonl",
    event_store_uri: "CLAUDE_CODE/session-1/events.jsonl",
    event_last_seq: 1,
    created_at: "2026-06-01T00:00:00.000Z",
    last_active_at: "2026-06-01T00:00:00.000Z",
    parked_at: "2026-06-01T00:00:00.000Z",
    ...overrides,
  };
}

function createIndexStore(overrides: Partial<AcpSessionIndexStore>): AcpSessionIndexStore {
  return {
    async upsertRecord(): Promise<void> {},
    async getRecord(): Promise<AcpSessionRecord | null> {
      return null;
    },
    async findBySessionId(): Promise<AcpSessionRecord[]> {
      return [];
    },
    async listRecords(): Promise<AcpSessionRecord[]> {
      return [];
    },
    async updateStatus(): Promise<void> {},
    async updateEventCursor(): Promise<void> {},
    async softDeleteRecord(): Promise<void> {},
    async hardDeleteRecord(): Promise<void> {},
    ...overrides,
  };
}

function createEventStore(
  calls: string[],
  overrides: Partial<AcpSessionEventStore> = {}
): AcpSessionEventStore {
  return {
    async appendEvent(): Promise<number> {
      return 0;
    },
    async updateEventStatus(): Promise<void> {},
    async loadEvents(): Promise<[]> {
      return [];
    },
    getEventStoreUri(): string {
      return "CLAUDE_CODE/session-1/events.jsonl";
    },
    async deleteEvents(): Promise<void> {
      calls.push("deleteEvents");
    },
    ...overrides,
  };
}
