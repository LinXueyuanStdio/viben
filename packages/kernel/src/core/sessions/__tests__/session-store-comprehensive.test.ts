import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { JsonFileSessionStore } from "../session-store.js";
import type { SessionRecord } from "../../types.js";

function makeRecord(overrides: Partial<SessionRecord> = {}): SessionRecord {
  return {
    sessionId: "sess-1",
    agentSessionId: "agent-sess-1",
    agentName: "claude",
    workingDir: "/workspace",
    channelId: "telegram",
    status: "active",
    createdAt: new Date().toISOString(),
    lastActiveAt: new Date().toISOString(),
    name: "Test Session",
    dangerousMode: false,
    platform: {},
    ...overrides,
  };
}

describe("JsonFileSessionStore — Comprehensive Tests", () => {
  let tmpDir: string;
  let filePath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "session-store-test-"));
    filePath = path.join(tmpDir, "sessions.json");
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe("save and get", () => {
    it("saves and retrieves a record", async () => {
      const store = new JsonFileSessionStore(filePath, 30);
      const record = makeRecord();

      await store.save(record);
      const retrieved = store.get("sess-1");

      expect(retrieved).toEqual(record);
      store.destroy();
    });

    it("returns undefined for non-existent record", () => {
      const store = new JsonFileSessionStore(filePath, 30);
      expect(store.get("nonexistent")).toBeUndefined();
      store.destroy();
    });

    it("overwrites record with same sessionId", async () => {
      const store = new JsonFileSessionStore(filePath, 30);

      await store.save(makeRecord({ name: "Original" }));
      await store.save(makeRecord({ name: "Updated" }));

      expect(store.get("sess-1")?.name).toBe("Updated");
      store.destroy();
    });

    it("stores a copy, not a reference", async () => {
      const store = new JsonFileSessionStore(filePath, 30);
      const record = makeRecord();

      await store.save(record);

      // Mutating original should not affect stored
      record.name = "Mutated";
      expect(store.get("sess-1")?.name).toBe("Test Session");
      store.destroy();
    });
  });

  describe("findByPlatform", () => {
    it("finds record by platform predicate", async () => {
      const store = new JsonFileSessionStore(filePath, 30);

      await store.save(
        makeRecord({
          sessionId: "sess-1",
          channelId: "telegram",
          platform: { topicId: 123 },
        }),
      );
      await store.save(
        makeRecord({
          sessionId: "sess-2",
          channelId: "telegram",
          platform: { topicId: 456 },
        }),
      );

      const found = store.findByPlatform(
        "telegram",
        (p) => p.topicId === 123,
      );
      expect(found?.sessionId).toBe("sess-1");
      store.destroy();
    });

    it("returns undefined when channelId doesn't match", async () => {
      const store = new JsonFileSessionStore(filePath, 30);
      await store.save(
        makeRecord({
          channelId: "discord",
          platform: { threadId: "abc" },
        }),
      );

      const found = store.findByPlatform(
        "telegram",
        (p) => p.threadId === "abc",
      );
      expect(found).toBeUndefined();
      store.destroy();
    });

    it("returns undefined when no record matches predicate", async () => {
      const store = new JsonFileSessionStore(filePath, 30);
      await store.save(makeRecord({ platform: { topicId: 123 } }));

      const found = store.findByPlatform("telegram", (p) => p.topicId === 999);
      expect(found).toBeUndefined();
      store.destroy();
    });
  });

  describe("findByAgentSessionId", () => {
    it("finds by direct agentSessionId", async () => {
      const store = new JsonFileSessionStore(filePath, 30);
      await store.save(makeRecord({ agentSessionId: "agent-abc" }));

      const found = store.findByAgentSessionId("agent-abc");
      expect(found?.sessionId).toBe("sess-1");
      store.destroy();
    });

    it("finds by originalAgentSessionId (adopted sessions)", async () => {
      const store = new JsonFileSessionStore(filePath, 30);
      await store.save(
        makeRecord({
          agentSessionId: "new-id",
          originalAgentSessionId: "original-id",
        }),
      );

      const found = store.findByAgentSessionId("original-id");
      expect(found?.sessionId).toBe("sess-1");
      store.destroy();
    });

    it("returns undefined when not found", () => {
      const store = new JsonFileSessionStore(filePath, 30);
      expect(store.findByAgentSessionId("ghost")).toBeUndefined();
      store.destroy();
    });
  });

  describe("list", () => {
    it("lists all records", async () => {
      const store = new JsonFileSessionStore(filePath, 30);
      await store.save(makeRecord({ sessionId: "a" }));
      await store.save(makeRecord({ sessionId: "b" }));

      const all = store.list();
      expect(all).toHaveLength(2);
      store.destroy();
    });

    it("filters by channelId", async () => {
      const store = new JsonFileSessionStore(filePath, 30);
      await store.save(makeRecord({ sessionId: "a", channelId: "telegram" }));
      await store.save(makeRecord({ sessionId: "b", channelId: "discord" }));

      const filtered = store.list("telegram");
      expect(filtered).toHaveLength(1);
      expect(filtered[0].sessionId).toBe("a");
      store.destroy();
    });

    it("returns empty array when no records", () => {
      const store = new JsonFileSessionStore(filePath, 30);
      expect(store.list()).toEqual([]);
      store.destroy();
    });
  });

  describe("remove", () => {
    it("removes a record", async () => {
      const store = new JsonFileSessionStore(filePath, 30);
      await store.save(makeRecord());

      await store.remove("sess-1");

      expect(store.get("sess-1")).toBeUndefined();
      store.destroy();
    });

    it("removing non-existent record is safe", async () => {
      const store = new JsonFileSessionStore(filePath, 30);
      await expect(store.remove("ghost")).resolves.toBeUndefined();
      store.destroy();
    });
  });

  describe("persistence (flushSync)", () => {
    it("persists data to disk on flushSync", async () => {
      const store = new JsonFileSessionStore(filePath, 30);
      await store.save(makeRecord());
      store.flushSync();

      // Verify file exists and contains data
      const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      expect(data.version).toBe(1);
      expect(data.sessions["sess-1"]).toBeDefined();
      store.destroy();
    });

    it("loads data from existing file on construction", async () => {
      // Create store, save, flush
      const store1 = new JsonFileSessionStore(filePath, 30);
      await store1.save(makeRecord({ name: "Persisted" }));
      store1.flushSync();
      store1.destroy();

      // New store from same file
      const store2 = new JsonFileSessionStore(filePath, 30);
      const record = store2.get("sess-1");
      expect(record?.name).toBe("Persisted");
      store2.destroy();
    });

    it("creates directory if it doesn't exist", () => {
      const deepPath = path.join(tmpDir, "a", "b", "c", "sessions.json");
      const store = new JsonFileSessionStore(deepPath, 30);
      store.flushSync();

      expect(fs.existsSync(deepPath)).toBe(true);
      store.destroy();
    });
  });

  describe("TTL cleanup", () => {
    it("removes non-active sessions older than TTL on load", async () => {
      // First: create a store and save old records, then flush to disk
      const store1 = new JsonFileSessionStore(filePath, 1); // 1 day TTL

      const oldDate = new Date(
        Date.now() - 2 * 24 * 60 * 60 * 1000,
      ).toISOString();

      await store1.save(
        makeRecord({
          sessionId: "old-finished",
          status: "finished",
          lastActiveAt: oldDate,
        }),
      );
      await store1.save(
        makeRecord({
          sessionId: "old-cancelled",
          status: "cancelled",
          lastActiveAt: oldDate,
        }),
      );
      await store1.save(
        makeRecord({
          sessionId: "old-error",
          status: "error",
          lastActiveAt: oldDate,
        }),
      );
      await store1.save(
        makeRecord({
          sessionId: "recent",
          status: "finished",
          lastActiveAt: new Date().toISOString(),
        }),
      );
      store1.flushSync();
      store1.destroy();

      // Load a new store from the same file — cleanup runs on constructor
      const store2 = new JsonFileSessionStore(filePath, 1);

      expect(store2.get("old-finished")).toBeUndefined();
      expect(store2.get("old-cancelled")).toBeUndefined();
      expect(store2.get("old-error")).toBeUndefined();
      expect(store2.get("recent")).toBeDefined();
      store2.destroy();
    });

    it("preserves active sessions regardless of age", async () => {
      const store = new JsonFileSessionStore(filePath, 1);
      const oldDate = new Date(
        Date.now() - 30 * 24 * 60 * 60 * 1000,
      ).toISOString();

      await store.save(
        makeRecord({
          sessionId: "old-active",
          status: "active",
          lastActiveAt: oldDate,
        }),
      );

      expect(store.get("old-active")).toBeDefined();
      store.destroy();
    });

    it("preserves initializing sessions regardless of age", async () => {
      const store = new JsonFileSessionStore(filePath, 1);
      const oldDate = new Date(
        Date.now() - 30 * 24 * 60 * 60 * 1000,
      ).toISOString();

      await store.save(
        makeRecord({
          sessionId: "old-init",
          status: "initializing",
          lastActiveAt: oldDate,
        }),
      );

      expect(store.get("old-init")).toBeDefined();
      store.destroy();
    });
  });

  describe("corrupt file handling", () => {
    it("starts empty on corrupted JSON file", () => {
      fs.writeFileSync(filePath, "not valid json {{{");
      const store = new JsonFileSessionStore(filePath, 30);

      expect(store.list()).toEqual([]);
      store.destroy();
    });

    it("skips loading on unknown version", () => {
      fs.writeFileSync(
        filePath,
        JSON.stringify({ version: 99, sessions: { x: {} } }),
      );
      const store = new JsonFileSessionStore(filePath, 30);

      expect(store.list()).toEqual([]);
      store.destroy();
    });

    it("starts empty when file doesn't exist", () => {
      const store = new JsonFileSessionStore(
        path.join(tmpDir, "nonexistent.json"),
        30,
      );
      expect(store.list()).toEqual([]);
      store.destroy();
    });
  });

  describe("destroy()", () => {
    it("cleans up timers and process listeners", () => {
      const store = new JsonFileSessionStore(filePath, 30);
      // Should not throw
      store.destroy();
      store.destroy(); // idempotent
    });
  });

  describe("concurrent operations", () => {
    it("handles concurrent saves", async () => {
      const store = new JsonFileSessionStore(filePath, 30);

      await Promise.all([
        store.save(makeRecord({ sessionId: "a" })),
        store.save(makeRecord({ sessionId: "b" })),
        store.save(makeRecord({ sessionId: "c" })),
      ]);

      expect(store.list()).toHaveLength(3);
      store.destroy();
    });

    it("handles save and remove concurrently", async () => {
      const store = new JsonFileSessionStore(filePath, 30);

      await store.save(makeRecord({ sessionId: "a" }));
      await Promise.all([
        store.save(makeRecord({ sessionId: "b" })),
        store.remove("a"),
      ]);

      expect(store.get("a")).toBeUndefined();
      expect(store.get("b")).toBeDefined();
      store.destroy();
    });
  });

  describe("findAssistant", () => {
    it("returns the assistant record for a channel", async () => {
      const store = new JsonFileSessionStore(filePath, 30);
      await store.save({
        sessionId: "sess-1",
        agentSessionId: "agent-1",
        agentName: "claude-code",
        workingDir: "/tmp",
        channelId: "telegram",
        status: "finished",
        createdAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
        isAssistant: true,
        platform: {},
      });
      const result = store.findAssistant("telegram");
      expect(result?.sessionId).toBe("sess-1");
      store.destroy();
    });

    it("returns undefined when no assistant record for channel", async () => {
      const store = new JsonFileSessionStore(filePath, 30);
      await store.save({
        sessionId: "sess-1",
        agentSessionId: "agent-1",
        agentName: "claude-code",
        workingDir: "/tmp",
        channelId: "telegram",
        status: "finished",
        createdAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
        isAssistant: false,
        platform: {},
      });
      expect(store.findAssistant("telegram")).toBeUndefined();
      store.destroy();
    });

    it("ignores assistant records for other channels", async () => {
      const store = new JsonFileSessionStore(filePath, 30);
      await store.save({
        sessionId: "sess-1",
        agentSessionId: "agent-1",
        agentName: "claude-code",
        workingDir: "/tmp",
        channelId: "slack",
        status: "finished",
        createdAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
        isAssistant: true,
        platform: {},
      });
      expect(store.findAssistant("telegram")).toBeUndefined();
      store.destroy();
    });
  });

  describe("TTL cleanup exempts assistant sessions", () => {
    it("does not delete assistant records past TTL", async () => {
      const store = new JsonFileSessionStore(filePath, 1); // 1 day TTL
      const oldDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(); // 3 days ago
      await store.save({
        sessionId: "assistant-sess",
        agentSessionId: "agent-1",
        agentName: "claude-code",
        workingDir: "/tmp",
        channelId: "telegram",
        status: "finished",
        createdAt: oldDate,
        lastActiveAt: oldDate,
        isAssistant: true,
        platform: {},
      });
      // Trigger cleanup by creating a new store that loads and cleans up
      store.flushSync();
      const store2 = new JsonFileSessionStore((store as any).filePath, 1);
      expect(store2.get("assistant-sess")).toBeDefined();
      store.destroy();
      store2.destroy();
    });
  });
});
