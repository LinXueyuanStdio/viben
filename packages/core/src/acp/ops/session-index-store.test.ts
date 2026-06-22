import { describe, expect, it, vi } from "vitest";
import {
  createDefaultAcpSessionIndexStore,
  InMemoryAcpSessionIndexStore,
  SqliteAcpSessionIndexStore,
  type AcpSessionIndexStore,
  type AcpSessionRecord,
} from "./session-index-store";

function baseRecord(overrides: Partial<AcpSessionRecord> = {}): AcpSessionRecord {
  return {
    executor_type: "CLAUDE_CODE",
    session_id: "session-1",
    status: "active",
    cwd: "/repo",
    workspace_path: "/repo",
    agent_dir: "/repo/.agents/default",
    agent_config_path: "/repo/.agents/default/agent.yaml",
    backend_id: "claude",
    title: "Default agent",
    permission_mode: "plan",
    acp_record: {
      id: "session-1",
      nested: { value: true },
    },
    persist_session_id: "persist-session-1",
    persist_task_id: "task-1",
    gateway_url: "http://127.0.0.1:18790",
    event_store_type: "jsonl",
    event_store_uri: "/state/acp/sessions/CLAUDE_CODE/session-1/events.jsonl",
    event_last_seq: 2,
    created_at: "2026-06-20T00:00:00.000Z",
    last_active_at: "2026-06-20T00:00:02.000Z",
    meta: { source: "test" },
    ...overrides,
  };
}

async function expectStoreBehavior(createStore: () => AcpSessionIndexStore) {
  const store = createStore();

  const record = baseRecord({
    last_error: {
      message: "failed",
      code: "ACP_FAILED",
      cause: { message: "root cause" },
    },
  });

  await store.upsertRecord(record);

  await expect(store.getRecord("CLAUDE_CODE", "session-1")).resolves.toEqual(record);
}

describe("AcpSessionIndexStore", () => {
  it("only uses the in-memory default store when explicitly requested", async () => {
    const originalStore = process.env.VIBEN_ACP_SESSION_INDEX_STORE;
    const originalPath = process.env.VIBEN_ACP_SESSION_INDEX_DB_PATH;
    process.env.VIBEN_ACP_SESSION_INDEX_DB_PATH = ":memory:";

    try {
      delete process.env.VIBEN_ACP_SESSION_INDEX_STORE;
      expect(createDefaultAcpSessionIndexStore()).toBeInstanceOf(SqliteAcpSessionIndexStore);

      process.env.VIBEN_ACP_SESSION_INDEX_STORE = "memory";
      expect(createDefaultAcpSessionIndexStore()).toBeInstanceOf(InMemoryAcpSessionIndexStore);
    } finally {
      restoreEnv("VIBEN_ACP_SESSION_INDEX_STORE", originalStore);
      restoreEnv("VIBEN_ACP_SESSION_INDEX_DB_PATH", originalPath);
    }
  });

  it("surfaces sqlite initialization failures instead of falling back to memory", () => {
    const originalStore = process.env.VIBEN_ACP_SESSION_INDEX_STORE;
    const originalPath = process.env.VIBEN_ACP_SESSION_INDEX_DB_PATH;
    process.env.VIBEN_ACP_SESSION_INDEX_DB_PATH = "/dev/null/sessions.sqlite";

    try {
      delete process.env.VIBEN_ACP_SESSION_INDEX_STORE;
      expect(() => createDefaultAcpSessionIndexStore()).toThrow();
    } finally {
      restoreEnv("VIBEN_ACP_SESSION_INDEX_STORE", originalStore);
      restoreEnv("VIBEN_ACP_SESSION_INDEX_DB_PATH", originalPath);
    }
  });

  it("roundtrips JSON fields through the sqlite store", async () => {
    await expectStoreBehavior(() => new SqliteAcpSessionIndexStore(":memory:"));
  });

  it("roundtrips JSON fields through the in-memory store", async () => {
    await expectStoreBehavior(() => new InMemoryAcpSessionIndexStore());
  });

  it("preserves created_at when upserting an existing sqlite record", async () => {
    const store = new SqliteAcpSessionIndexStore(":memory:");
    await store.upsertRecord(baseRecord({
      created_at: "2026-06-20T00:00:00.000Z",
      last_active_at: "2026-06-20T00:00:01.000Z",
    }));

    await store.upsertRecord(baseRecord({
      title: "Updated title",
      created_at: "2026-06-21T00:00:00.000Z",
      last_active_at: "2026-06-21T00:00:01.000Z",
    }));

    await expect(store.getRecord("CLAUDE_CODE", "session-1")).resolves.toMatchObject({
      title: "Updated title",
      created_at: "2026-06-20T00:00:00.000Z",
      last_active_at: "2026-06-21T00:00:01.000Z",
    });
  });

  it("does not regress event_last_seq when upserting an older sqlite cursor", async () => {
    const store = new SqliteAcpSessionIndexStore(":memory:");
    await store.upsertRecord(baseRecord({ event_last_seq: 5 }));

    await store.upsertRecord(baseRecord({ event_last_seq: 3 }));

    await expect(store.getRecord("CLAUDE_CODE", "session-1")).resolves.toMatchObject({
      event_last_seq: 5,
    });
  });

  it("does not regress event_last_seq when upserting an older in-memory cursor", async () => {
    const store = new InMemoryAcpSessionIndexStore();
    await store.upsertRecord(baseRecord({ event_last_seq: 5 }));

    await store.upsertRecord(baseRecord({ event_last_seq: 3 }));

    await expect(store.getRecord("CLAUDE_CODE", "session-1")).resolves.toMatchObject({
      event_last_seq: 5,
    });
  });

  it("does not regress event_last_seq when updating sqlite cursor directly", async () => {
    const sqliteStore = new SqliteAcpSessionIndexStore(":memory:");
    await sqliteStore.upsertRecord(baseRecord({ event_last_seq: 2 }));
    await sqliteStore.updateEventCursor("CLAUDE_CODE", "session-1", 5);
    await sqliteStore.updateEventCursor("CLAUDE_CODE", "session-1", 3);

    await expect(sqliteStore.getRecord("CLAUDE_CODE", "session-1")).resolves.toMatchObject({
      event_last_seq: 5,
    });
  });

  it("does not regress event_last_seq when updating in-memory cursor directly", async () => {
    const memoryStore = new InMemoryAcpSessionIndexStore();
    await memoryStore.upsertRecord(baseRecord({ event_last_seq: 2 }));
    await memoryStore.updateEventCursor("CLAUDE_CODE", "session-1", 5);
    await memoryStore.updateEventCursor("CLAUDE_CODE", "session-1", 3);

    await expect(memoryStore.getRecord("CLAUDE_CODE", "session-1")).resolves.toMatchObject({
      event_last_seq: 5,
    });
  });

  it("keeps identical session_id values separate by executor_type", async () => {
    const store = new SqliteAcpSessionIndexStore(":memory:");
    await store.upsertRecord(baseRecord({ executor_type: "CLAUDE_CODE", session_id: "same-id", title: "Claude" }));
    await store.upsertRecord(baseRecord({ executor_type: "CODEX", session_id: "same-id", title: "Codex" }));

    await expect(store.getRecord("CLAUDE_CODE", "same-id")).resolves.toMatchObject({ title: "Claude" });
    await expect(store.getRecord("CODEX", "same-id")).resolves.toMatchObject({ title: "Codex" });
  });

  it("finds all records matching a session_id across executor types", async () => {
    const store = new SqliteAcpSessionIndexStore(":memory:");
    await store.upsertRecord(baseRecord({ executor_type: "CLAUDE_CODE", session_id: "shared" }));
    await store.upsertRecord(baseRecord({ executor_type: "CODEX", session_id: "shared" }));
    await store.upsertRecord(baseRecord({ executor_type: "CODEX_APP_SERVER", session_id: "other" }));

    await expect(store.findBySessionId("shared")).resolves.toEqual([
      expect.objectContaining({ executor_type: "CLAUDE_CODE", session_id: "shared" }),
      expect.objectContaining({ executor_type: "CODEX", session_id: "shared" }),
    ]);
  });

  it("lists active and parked records by default, excludes deleted records, and supports filters", async () => {
    const store = new SqliteAcpSessionIndexStore(":memory:");
    await store.upsertRecord(baseRecord({ session_id: "active", status: "active", last_active_at: "2026-06-20T00:00:03.000Z" }));
    await store.upsertRecord(baseRecord({ session_id: "parked", status: "parked", last_active_at: "2026-06-20T00:00:04.000Z" }));
    await store.upsertRecord(baseRecord({ session_id: "finished", status: "finished", last_active_at: "2026-06-20T00:00:05.000Z" }));
    await store.upsertRecord(baseRecord({ session_id: "deleted", status: "active", deleted_at: "2026-06-20T00:00:06.000Z" }));
    await store.upsertRecord(baseRecord({
      session_id: "other-task",
      status: "active",
      persist_task_id: "task-2",
      last_active_at: "2026-06-20T00:00:03.500Z",
    }));

    await expect(store.listRecords()).resolves.toEqual([
      expect.objectContaining({ session_id: "parked" }),
      expect.objectContaining({ session_id: "other-task" }),
      expect.objectContaining({ session_id: "active" }),
    ]);
    await expect(store.listRecords({ statuses: ["finished"] })).resolves.toEqual([
      expect.objectContaining({ session_id: "finished" }),
    ]);
    await expect(store.listRecords({ include_deleted: true, statuses: ["active"], limit: 2 })).resolves.toHaveLength(2);
    await expect(store.listRecords({ persist_task_id: "task-2" })).resolves.toEqual([
      expect.objectContaining({ session_id: "other-task" }),
    ]);
    await expect(store.listRecords({ cursor: "2026-06-20T00:00:04.000Z" })).resolves.toEqual([
      expect.objectContaining({ session_id: "other-task" }),
      expect.objectContaining({ session_id: "active" }),
    ]);
  });

  it("updates status, event cursor, soft deletes, and hard deletes", async () => {
    const store = new SqliteAcpSessionIndexStore(":memory:");
    await store.upsertRecord(baseRecord());

    await store.updateStatus("CLAUDE_CODE", "session-1", "error", {
      last_active_at: "2026-06-20T00:00:10.000Z",
      finished_at: "2026-06-20T00:00:11.000Z",
      last_error: { message: "boom", code: 500 },
    });
    await store.updateEventCursor("CLAUDE_CODE", "session-1", 42);
    await expect(store.getRecord("CLAUDE_CODE", "session-1")).resolves.toMatchObject({
      status: "error",
      last_active_at: "2026-06-20T00:00:10.000Z",
      finished_at: "2026-06-20T00:00:11.000Z",
      event_last_seq: 42,
      last_error: { message: "boom", code: 500 },
    });

    await store.softDeleteRecord("CLAUDE_CODE", "session-1", "2026-06-20T00:00:12.000Z");
    await expect(store.listRecords({ include_deleted: false, statuses: ["error"] })).resolves.toEqual([]);
    await expect(store.getRecord("CLAUDE_CODE", "session-1")).resolves.toMatchObject({
      deleted_at: "2026-06-20T00:00:12.000Z",
    });

    await store.hardDeleteRecord("CLAUDE_CODE", "session-1");
    await expect(store.getRecord("CLAUDE_CODE", "session-1")).resolves.toBeNull();
  });

  it("returns defaults and warns when JSON fields are corrupt", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const store = new SqliteAcpSessionIndexStore(":memory:");
    store.dbForTests.prepare(`
      INSERT INTO acp_sessions (
        executor_type, session_id, status, cwd, acp_record_json, event_store_type,
        event_store_uri, event_last_seq, created_at, last_active_at, last_error_json, meta_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      "CLAUDE_CODE",
      "bad-json",
      "active",
      "/repo",
      "{bad",
      "jsonl",
      "/events.jsonl",
      -1,
      "2026-06-20T00:00:00.000Z",
      "2026-06-20T00:00:01.000Z",
      "{bad",
      "{bad"
    );

    await expect(store.getRecord("CLAUDE_CODE", "bad-json")).resolves.toMatchObject({
      acp_record: {},
      last_error: undefined,
      meta: undefined,
    });
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}
