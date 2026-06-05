import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { JsonFileSessionStore } from "../core/sessions/session-store.js";
import type { SessionRecord } from "../core/types.js";

function makeRecord(overrides: Partial<SessionRecord> = {}): SessionRecord {
  return {
    sessionId: "sess-1",
    agentSessionId: "agent-uuid-1",
    agentName: "claude",
    workingDir: "/tmp/workspace",
    channelId: "telegram",
    status: "active",
    createdAt: new Date().toISOString(),
    lastActiveAt: new Date().toISOString(),
    platform: { topicId: 123 },
    ...overrides,
  };
}

describe("JsonFileSessionStore", () => {
  let tmpDir: string;
  let filePath: string;
  let store: JsonFileSessionStore;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "viben-test-"));
    filePath = path.join(tmpDir, "sessions.json");
    store = new JsonFileSessionStore(filePath, 30);
  });

  afterEach(() => {
    store.destroy();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("saves and retrieves a record", async () => {
    const record = makeRecord();
    await store.save(record);
    expect(store.get("sess-1")).toEqual(record);
  });

  it("returns undefined for unknown sessionId", () => {
    expect(store.get("nonexistent")).toBeUndefined();
  });

  it("finds record by platform predicate", async () => {
    await store.save(makeRecord());
    const found = store.findByPlatform("telegram", (p) => p.topicId === 123);
    expect(found?.sessionId).toBe("sess-1");
  });

  it("returns undefined when predicate does not match", async () => {
    await store.save(makeRecord());
    const found = store.findByPlatform("telegram", (p) => p.topicId === 999);
    expect(found).toBeUndefined();
  });

  it("lists records filtered by channelId", async () => {
    await store.save(makeRecord({ sessionId: "s1", channelId: "telegram" }));
    await store.save(makeRecord({ sessionId: "s2", channelId: "discord" }));
    expect(store.list("telegram")).toHaveLength(1);
    expect(store.list()).toHaveLength(2);
  });

  it("removes a record", async () => {
    await store.save(makeRecord());
    await store.remove("sess-1");
    expect(store.get("sess-1")).toBeUndefined();
  });

  it("persists to disk on flush", async () => {
    await store.save(makeRecord());
    store.flushSync();
    const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    expect(raw.version).toBe(1);
    expect(raw.sessions["sess-1"]).toBeDefined();
  });

  it("loads from existing file on construction", async () => {
    await store.save(makeRecord());
    store.flushSync();
    store.destroy();

    const store2 = new JsonFileSessionStore(filePath, 30);
    expect(store2.get("sess-1")).toBeDefined();
    store2.destroy();
  });

  it("auto-cleans records older than TTL", async () => {
    const old = makeRecord({
      sessionId: "old",
      status: "finished",
      lastActiveAt: new Date(
        Date.now() - 31 * 24 * 60 * 60 * 1000,
      ).toISOString(),
    });
    const recent = makeRecord({ sessionId: "new" });
    const data = { version: 1, sessions: { old, new: recent } };
    fs.writeFileSync(filePath, JSON.stringify(data));

    const store2 = new JsonFileSessionStore(filePath, 30);
    expect(store2.get("old")).toBeUndefined();
    expect(store2.get("new")).toBeDefined();
    store2.destroy();
  });

  it("does not clean active records even if old", async () => {
    const old = makeRecord({
      sessionId: "old-active",
      status: "active",
      lastActiveAt: new Date(
        Date.now() - 60 * 24 * 60 * 60 * 1000,
      ).toISOString(),
    });
    const data = { version: 1, sessions: { "old-active": old } };
    fs.writeFileSync(filePath, JSON.stringify(data));

    const store2 = new JsonFileSessionStore(filePath, 30);
    expect(store2.get("old-active")).toBeDefined();
    store2.destroy();
  });
});
